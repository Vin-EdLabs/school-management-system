import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const router = express.Router();

// 1. Get or Create a Private Conversation
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { targetUserId } = req.body;

    if (!targetUserId) return res.status(400).json({ error: 'Target user ID is required' });
    if (String(userId) === String(targetUserId)) return res.status(400).json({ error: 'Cannot chat with yourself' });

    // Order IDs to check unique constraint (a, b)
    const [pA, pB] = [userId, targetUserId].sort((a, b) => a - b);

    const existing = await query(
      'SELECT * FROM private_conversations WHERE participant_a = $1 AND participant_b = $2',
      [pA, pB]
    );

    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    const result = await query(
      `INSERT INTO private_conversations (participant_a, participant_b)
       VALUES ($1, $2) RETURNING *`,
      [pA, pB]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Conversation create error:', error);
    res.status(500).json({ error: 'Failed to establish conversation' });
  }
});

// 2. List all private conversations for the current user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT c.*, 
              u.username as other_username,
              COALESCE(tr.full_name, pos.full_name, u.username) as other_full_name,
              t.name as school_name
       FROM private_conversations c
       JOIN users u ON (c.participant_a = u.id AND c.participant_b = $1)
                    OR (c.participant_b = u.id AND c.participant_a = $1)
       LEFT JOIN tenants t ON u.tenant_id = t.id
       LEFT JOIN teachers tr ON u.teacher_id::text = tr.id::text AND tr.tenant_id = u.tenant_id
       LEFT JOIN payroll_other_staff pos ON u.other_staff_id = pos.id AND pos.tenant_id = u.tenant_id
       ORDER BY c.last_message_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetch conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// 3. Get messages for a private conversation
router.get('/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // Security: Check if user is a participant
    const convo = await query(
      'SELECT participant_a, participant_b FROM private_conversations WHERE id = $1',
      [conversationId]
    );

    if (convo.rows.length === 0 || (convo.rows[0].participant_a !== userId && convo.rows[0].participant_b !== userId)) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const result = await query(
      `SELECT m.*, 
              COALESCE(tr.full_name, pos.full_name, u.username) as sender_name,
              p.content as parent_content,
              COALESCE(ptr.full_name, ppos.full_name, pu.username) as parent_name,
              (
                SELECT json_agg(r) FROM (
                  SELECT emoji, COUNT(*) as count, 
                  EXISTS(SELECT 1 FROM private_message_reactions WHERE message_id = m.id AND user_id = $2 AND emoji = r.emoji) as me_reacted
                  FROM private_message_reactions r
                  WHERE message_id = m.id
                  GROUP BY emoji
                ) r
              ) as reactions
       FROM private_messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN teachers tr ON u.teacher_id::text = tr.id::text AND tr.tenant_id = u.tenant_id
       LEFT JOIN payroll_other_staff pos ON u.other_staff_id = pos.id AND pos.tenant_id = u.tenant_id
       LEFT JOIN private_messages p ON m.reply_to_id = p.id
       LEFT JOIN users pu ON p.sender_id = pu.id
       LEFT JOIN teachers ptr ON pu.teacher_id::text = ptr.id::text AND ptr.tenant_id = pu.tenant_id
       LEFT JOIN payroll_other_staff ppos ON pu.other_staff_id = ppos.id AND ppos.tenant_id = pu.tenant_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT 100`,
      [conversationId, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetch private messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 4. Send a private message (supports Reply Privately metadata)
router.post('/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const { content, reply_to_id = null, media_url = null } = req.body;

    if (!content && !media_url) return res.status(400).json({ error: 'Content required' });

    const insertResult = await query(
      `INSERT INTO private_messages (conversation_id, sender_id, content, reply_to_id, media_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [conversationId, userId, content || '', reply_to_id, media_url]
    );

    const newId = insertResult.rows[0].id;
    const full = await query(
      `SELECT m.*, 
              COALESCE(tr.full_name, pos.full_name, u.username) as sender_name,
              p.content as parent_content,
              COALESCE(ptr.full_name, ppos.full_name, pu.username) as parent_name
       FROM private_messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN teachers tr ON u.teacher_id::text = tr.id::text AND tr.tenant_id = u.tenant_id
       LEFT JOIN payroll_other_staff pos ON u.other_staff_id = pos.id AND pos.tenant_id = u.tenant_id
       LEFT JOIN private_messages p ON m.reply_to_id = p.id
       LEFT JOIN users pu ON p.sender_id = pu.id
       LEFT JOIN teachers ptr ON pu.teacher_id::text = ptr.id::text AND ptr.tenant_id = pu.tenant_id
       LEFT JOIN payroll_other_staff ppos ON pu.other_staff_id = ppos.id AND ppos.tenant_id = pu.tenant_id
       WHERE m.id = $1`,
      [newId]
    );

    const newMessage = full.rows[0];

    // Update conversation timestamp
    await query('UPDATE private_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1', [conversationId]);

    // Emit to both participants
    const convo = await query('SELECT participant_a, participant_b FROM private_conversations WHERE id = $1', [conversationId]);
    const io = getIO();
    io.to(`user:${convo.rows[0].participant_a}`).emit('new-private-message', { ...newMessage, conversation_id: conversationId });
    io.to(`user:${convo.rows[0].participant_b}`).emit('new-private-message', { ...newMessage, conversation_id: conversationId });

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// 5. Toggle reaction on a private message
router.post('/:id/messages/:msgId/react', authenticate, async (req: AuthRequest, res) => {
   try {
      const userId = req.user!.id;
      const conversationId = req.params.id;
      const msgId = req.params.msgId;
      const { emoji } = req.body;

      if (!emoji) return res.status(400).json({ error: 'Emoji required' });

      // Toggle logic
      const existing = await query(
         'SELECT id FROM private_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
         [msgId, userId, emoji]
      );

      if (existing.rows.length > 0) {
         await query('DELETE FROM private_message_reactions WHERE id = $1', [existing.rows[0].id]);
      } else {
         await query(
            'INSERT INTO private_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
            [msgId, userId, emoji]
         );
      }

      const allReactions = await query(
         `SELECT emoji, COUNT(*) as count, 
                 EXISTS(SELECT 1 FROM private_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = r.emoji) as me_reacted
          FROM private_message_reactions r
          WHERE message_id = $1
          GROUP BY emoji`,
         [msgId, userId]
      );

      // Emit via socket (to both participants)
      try {
         const convo = await query('SELECT participant_a, participant_b FROM private_conversations WHERE id = $1', [conversationId]);
         const io = getIO();
         io.to(`user:${convo.rows[0].participant_a}`).emit('message-reacted', { id: msgId, reactions: allReactions.rows, conversation_id: conversationId });
         io.to(`user:${convo.rows[0].participant_b}`).emit('message-reacted', { id: msgId, reactions: allReactions.rows, conversation_id: conversationId });
      } catch (e) {}

      res.json(allReactions.rows);
   } catch (error) {
      console.error('Reaction toggle error:', error);
      res.status(500).json({ error: 'Failed' });
   }
});

export default router;
