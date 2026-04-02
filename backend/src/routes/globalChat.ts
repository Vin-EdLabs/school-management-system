import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket.js';

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/chat'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });
const router = express.Router();

// Get recent messages for a specific channel (with reply context)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { channel = 'general' } = req.query;
    
    // Check access - simplified for now: everyone sees general, roles see their own
    const userRole = req.user!.role;
    const allowedChannels = ['general'];
    
    if (userRole === 'teacher') allowedChannels.push('teachers');
    if (userRole === 'finance') allowedChannels.push('financial');
    if (['administrator', 'super-admin', 'principal'].includes(userRole)) {
      allowedChannels.push('teachers', 'financial', 'admin');
    }

    if (!allowedChannels.includes(channel as string)) {
      return res.status(403).json({ error: 'Access denied to this channel' });
    }

    const result = await query(
      `SELECT m.*, 
              COALESCE(t.name, m.tenant_name) as tenant_name,
              m.full_name,
              p.content as parent_content,
              p.full_name as parent_name,
              (
                SELECT json_agg(r) FROM (
                  SELECT emoji, COUNT(*) as count, 
                  EXISTS(SELECT 1 FROM global_chat_reactions WHERE message_id = m.id AND user_id = $2 AND emoji = r.emoji) as me_reacted
                  FROM global_chat_reactions r
                  WHERE message_id = m.id
                  GROUP BY emoji
                ) r
              ) as reactions
       FROM global_chat_messages m
       LEFT JOIN tenants t ON m.tenant_id = t.id
       LEFT JOIN global_chat_messages p ON m.reply_to_id = p.id
       WHERE m.channel = $1 AND m.is_deleted = false
       ORDER BY m.created_at DESC
       LIMIT 100`,
      [channel, req.user!.id]
    );

    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Fetch global chat error:', error);
    res.status(500).json({ error: 'Failed to fetch global chat' });
  }
});

// Post a new message to a specific channel (Supports Replies & Media)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { content, channel = 'general', reply_to_id = null, media_url = null } = req.body;

    if ((!content || content.trim() === '') && !media_url) {
      return res.status(400).json({ error: 'Message content or media is required' });
    }

    // Role-based access control for posting
    const allowedToPost = ['general'];
    if (user.role === 'teacher' && channel === 'teachers') allowedToPost.push('teachers');
    if (user.role === 'finance' && channel === 'financial') allowedToPost.push('financial');
    if (['administrator', 'super-admin', 'principal'].includes(user.role)) {
      allowedToPost.push('teachers', 'financial', 'admin');
    }

    if (!allowedToPost.includes(channel)) {
      return res.status(403).json({ error: 'Not authorized to post to this channel' });
    }

    let tenantName = 'System';
    if (user.tenantId) {
      const t = await query('SELECT name FROM tenants WHERE id = $1', [user.tenantId]);
      tenantName = t.rows[0]?.name || 'Unknown School';
    }

    const insertResult = await query(
      `INSERT INTO global_chat_messages 
       (tenant_id, tenant_name, user_id, username, full_name, role, content, channel, reply_to_id, media_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [user.tenantId, tenantName, user.id, user.username, user.fullName || user.username, user.role, content || '', channel, reply_to_id, media_url]
    );

    const newId = insertResult.rows[0].id;
    
    // Fetch enriched message
    const fullMessageResult = await query(
      `SELECT m.*, 
              COALESCE(t.name, m.tenant_name) as tenant_name,
              m.full_name,
              p.content as parent_content,
              p.full_name as parent_name
       FROM global_chat_messages m
       LEFT JOIN tenants t ON m.tenant_id = t.id
       LEFT JOIN global_chat_messages p ON m.reply_to_id = p.id
       WHERE m.id = $1`,
      [newId]
    );

    const newMessage = fullMessageResult.rows[0];

    // Emit via socket
    try {
      const io = getIO();
      io.to(`global:${channel}`).emit('new-global-message', newMessage);
      io.emit('new-global-message', newMessage); 
    } catch (socketErr) {}

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Post global chat error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// Single media upload for chat
router.post('/upload', authenticate, upload.single('media'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const media_url = `/uploads/chat/${req.file.filename}`;
    res.json({ media_url });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Toggle reaction on a message (Medical-grade emoji support)
router.post('/:id/react', authenticate, async (req: AuthRequest, res) => {
   try {
      const userId = req.user!.id;
      const msgId = req.params.id;
      const { emoji } = req.body;

      if (!emoji) return res.status(400).json({ error: 'Emoji required' });

      // Check if user already reacted with this emoji
      const existing = await query(
         'SELECT id FROM global_chat_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
         [msgId, userId, emoji]
      );

      if (existing.rows.length > 0) {
         // Un-react
         await query('DELETE FROM global_chat_reactions WHERE id = $1', [existing.rows[0].id]);
      } else {
         // React
         await query(
            'INSERT INTO global_chat_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
            [msgId, userId, emoji]
         );
      }

      // Fetch all reactions for this message to broadcast
      const allReactions = await query(
         `SELECT emoji, COUNT(*) as count, 
                 EXISTS(SELECT 1 FROM global_chat_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = r.emoji) as me_reacted
          FROM global_chat_reactions r
          WHERE message_id = $1
          GROUP BY emoji`,
         [msgId, userId]
      );

      // Broadcast update via Socket.io
      try {
         const io = getIO();
         io.emit('message-reacted', { id: msgId, reactions: allReactions.rows });
      } catch (e) {}

      res.json(allReactions.rows);
   } catch (error) {
      console.error('Reaction toggle error:', error);
      res.status(500).json({ error: 'Failed to toggle reaction' });
   }
});

// Delete a message (Delete for Everyone)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
   try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const msgId = req.params.id;

      // Check if message exists and belongs to user (or is admin)
      const msg = await query('SELECT user_id, channel FROM global_chat_messages WHERE id = $1', [msgId]);
      if (msg.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

      const isOwner = msg.rows[0].user_id === userId;
      const isAdmin = ['administrator', 'super-admin', 'principal'].includes(userRole);

      if (!isOwner && !isAdmin) {
         return res.status(403).json({ error: 'Unauthorized to delete this message' });
      }

      await query(
         'UPDATE global_chat_messages SET is_deleted = true, content = \'[Message Deleted]\' WHERE id = $1',
         [msgId]
      );

      // Emit deletion event to all clients
      try {
         const io = getIO();
         io.emit('message-deleted', { id: msgId, channel: msg.rows[0].channel });
      } catch (e) {}

      res.status(204).send();
   } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ error: 'Failed to delete message' });
   }
});

// Get list of mentionable entities (Schools, Roles, Users)
// Get list of mentionable entities (Schools, Roles, Users) with Hierarchical & Level-Based restrictions
router.get('/mentions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { query: searchQuery = '', channel = 'general' } = req.query;
    const q = `%${searchQuery}%`;
    const userRole = req.user!.role;

    // 1. Hierarchy Mapping (Super Admin=4, Admin=3, Staff=2, Student=1)
    const roleRanks: Record<string, number> = {
      'super-admin': 4,
      'administrator': 3,
      'principal': 3,
      'teacher': 2,
      'finance': 2,
      'student': 1
    };
    const senderRank = roleRanks[userRole] || 1;

    // 2. Channel Restriction Mapping: Only suggest roles permitted within current channel
    const channelPermittedRoles: Record<string, string[]> = {
      'admin': ['administrator', 'super-admin', 'principal'],
      'teachers': ['teacher'],
      'financial': ['finance'],
      'general': ['administrator', 'super-admin', 'principal', 'teacher', 'finance', 'student']
    };
    const targetRoles = channelPermittedRoles[channel as string] || ['student'];

    // 3. Fetch Institutional Metadata (School tagging is always global context)
    const schoolMatches = await query(
      `SELECT id, name as label, 'school' as type FROM tenants WHERE name ILIKE $1 LIMIT 3`,
      [q]
    );

    // Expand schools into "Specific School Teachers" options as well
    const schools: any[] = [];
    schoolMatches.rows.forEach(s => {
       schools.push(s); // Add regular school
       schools.push({
          id: s.id,
          label: `${s.label} Teachers`,
          type: 'school',
          school_name: s.label
       });
    });

    // 4. Roles search (Local context roles)
    const rolesList = [
      { id: 'administrator', label: 'Admins', type: 'role' },
      { id: 'principal', label: 'Principals', type: 'role' },
      { id: 'teacher', label: 'Teachers', type: 'role' },
      { id: 'finance', label: 'Financial', type: 'role' }
    ].filter(r => {
      const isSearchMatch = r.label.toLowerCase().includes((searchQuery as string).toLowerCase());
      const isRoleAllowedInChannel = targetRoles.includes(r.id);
      return isSearchMatch && isRoleAllowedInChannel;
    });

    // 5. THE INTELLIGENT SEARCH: Name + Rank + Level + Isolation
    const staff = await query(
      `SELECT id, label, type, school_name, role, level, department FROM (
         -- Part 1: Users table with Hierarchical/Channel filtering and Staff Metadata
         SELECT 
            u.id, 
            COALESCE(tr.full_name, pos.full_name, u.username) as label, 
            'user' as type, 
            t.name as school_name,
            u.role,
            c.level as level,
            CASE 
               WHEN tr.id IS NOT NULL THEN 'Faculty'
               WHEN pos.id IS NOT NULL THEN 'Staff'
               ELSE 'System'
            END as department,
            CASE 
               WHEN u.role = 'super-admin' THEN 4
               WHEN u.role = 'administrator' THEN 3
               WHEN u.role = 'principal' THEN 3
               WHEN u.role IN ('teacher', 'finance') THEN 2
               ELSE 1 
            END as rank
         FROM users u
         LEFT JOIN tenants t ON u.tenant_id = t.id
         -- Link to Faculty/Staff profiles
         LEFT JOIN teachers tr ON u.teacher_id::text = tr.id::text AND tr.tenant_id = u.tenant_id
         LEFT JOIN payroll_other_staff pos ON u.other_staff_id = pos.id AND pos.tenant_id = u.tenant_id
         -- Metadata from assigned class
         LEFT JOIN classes c ON tr.class_assigned_id = c.id
         WHERE (tr.full_name ILIKE $1 OR pos.full_name ILIKE $1 OR u.username ILIKE $1)
           AND u.id != $3
           AND u.role = ANY($2::text[]) -- Strict Channel Isolation
       ) AS candidates
       WHERE rank <= $4 -- Hierarchy Enforcement: No punching up
       ORDER BY (level IS NOT NULL) DESC, label -- Prioritize level-assigned staff
       LIMIT 20`,
      [q, targetRoles, req.user!.id, senderRank]
    );

    // Final self-id protection check for absolute certainty
    const allSuggestions = [
      ...schools,
      ...rolesList,
      ...staff.rows
    ];

    const filtered = allSuggestions.filter(item => {
      if (item.type === 'user') {
        const isSameId = String(item.id) === String(req.user!.id);
        const nameFallback = req.user!.fullName || req.user!.username;
        const isSameName = item.label === nameFallback;
        return !isSameId && !isSameName;
      }
      return true;
    });

    res.json(filtered);
  } catch (error) {
    console.error('Intelligent Mentions Engine Failure:', error);
    res.status(500).json({ error: 'Search Engine Error' });
  }
});

export default router;
