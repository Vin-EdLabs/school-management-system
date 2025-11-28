import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

// returns a map of permissions available per role - simple static example
router.get('/', async (req, res) => {
  return res.json(success({
    admin: ['*'],
    staff: ['students:read','students:update','payments:create','reports:view'],
    teacher: ['students:read','attendance:submit']
  }));
});

export default router;
