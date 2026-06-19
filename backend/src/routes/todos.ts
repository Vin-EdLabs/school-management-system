import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const ALLOWED_ROLES = new Set(['administrator', 'finance', 'teacher', 'staff', 'super-admin']);

function normalizeRole(role: string | null | undefined): string {
  const value = String(role || '').toLowerCase().trim();
  if (value === 'superadmin') return 'super-admin';
  if (value === 'admin') return 'administrator';
  return value;
}

function requireTodoAccess(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const role = normalizeRole(req.user?.role);
  if (!req.user?.id || !ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ error: 'Personal todos are not available for this account' });
  }
  next();
}

function mapTodoRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    tenant_id: row.tenant_id != null ? Number(row.tenant_id) : null,
    user_id: Number(row.user_id),
    content: String(row.content),
    is_completed: Boolean(row.is_completed),
    reminder_at: row.reminder_at ? new Date(String(row.reminder_at)).toISOString() : null,
    reminder_sent: Boolean(row.reminder_sent),
    created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    updated_at: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

async function getOwnedTodo(userId: number, todoId: number) {
  const res = await query(
    `SELECT * FROM personal_todos WHERE id = $1 AND user_id = $2`,
    [todoId, userId]
  );
  return res.rows[0] || null;
}

router.use(authenticate);
router.use(requireTodoAccess);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT *
       FROM personal_todos
       WHERE user_id = $1
       ORDER BY is_completed ASC,
                reminder_at ASC NULLS LAST,
                created_at DESC`,
      [userId]
    );
    res.json(result.rows.map(mapTodoRow));
  } catch (error) {
    console.error('List todos error:', error);
    res.status(500).json({ error: 'Failed to load todos' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.user!.tenantId ?? null;
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Task content is required' });

    let reminderAt: Date | null = null;
    if (req.body?.reminder_at) {
      const parsed = new Date(String(req.body.reminder_at));
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Invalid reminder date' });
      }
      reminderAt = parsed;
    }

    const inserted = await query(
      `INSERT INTO personal_todos (tenant_id, user_id, content, reminder_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, userId, content, reminderAt]
    );
    res.status(201).json(mapTodoRow(inserted.rows[0]));
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const todoId = parseInt(req.params.id, 10);
    if (Number.isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo id' });

    const existing = await getOwnedTodo(userId, todoId);
    if (!existing) return res.status(404).json({ error: 'Todo not found' });

    const content =
      req.body?.content !== undefined ? String(req.body.content).trim() : String(existing.content);
    if (!content) return res.status(400).json({ error: 'Task content cannot be empty' });

    const isCompleted =
      req.body?.is_completed !== undefined ? Boolean(req.body.is_completed) : Boolean(existing.is_completed);

    let reminderAt: Date | null =
      existing.reminder_at ? new Date(String(existing.reminder_at)) : null;
    let resetReminderSent = false;

    if (req.body?.reminder_at === null) {
      reminderAt = null;
      resetReminderSent = true;
    } else if (req.body?.reminder_at !== undefined) {
      const parsed = new Date(String(req.body.reminder_at));
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Invalid reminder date' });
      }
      reminderAt = parsed;
      resetReminderSent = true;
    }

    if (isCompleted && !existing.is_completed) {
      resetReminderSent = true;
    }

    const updated = await query(
      `UPDATE personal_todos
       SET content = $1,
           is_completed = $2,
           reminder_at = $3,
           reminder_sent = CASE WHEN $4 THEN false ELSE reminder_sent END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [content, isCompleted, reminderAt, resetReminderSent, todoId, userId]
    );
    res.json(mapTodoRow(updated.rows[0]));
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const todoId = parseInt(req.params.id, 10);
    if (Number.isNaN(todoId)) return res.status(400).json({ error: 'Invalid todo id' });

    const deleted = await query(
      `DELETE FROM personal_todos WHERE id = $1 AND user_id = $2 RETURNING id`,
      [todoId, userId]
    );
    if (deleted.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

export default router;
