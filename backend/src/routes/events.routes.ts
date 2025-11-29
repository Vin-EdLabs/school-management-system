import { Router } from 'express';
import { success, failure } from '../utils/response.js';

const router = Router();

// Simple events endpoint. Returns sample events when DB-backed events
// are not yet implemented. Frontend will fall back to its mock if this fails.
router.get('/', async (_req, res) => {
  try {
    const now = new Date();
    const sample = [
      {
        id: '1',
        title: 'Parent-Teacher Conference',
        date: now.toISOString(),
        time: '10:00',
        description: 'Quarterly parent-teacher meetings',
        color: 'bg-blue-500',
        category: 'Academic',
        reminder: true,
        reminderTime: '30',
        location: 'Main Hall',
      },
      {
        id: '2',
        title: 'School Sports Day',
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        time: '09:00',
        description: 'Annual athletics competition',
        color: 'bg-emerald-500',
        category: 'Sports',
        reminder: true,
        reminderTime: '60',
        location: 'Sports Ground',
      },
    ];

    return res.json(success(sample));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
});

export default router;
