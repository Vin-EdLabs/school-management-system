import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/logins', async (req, res) => res.json(success([])));
router.get('/activity', async (req, res) => res.json(success([])));
router.get('/export', async (req, res) => res.json(success({ url: '/audit/export?stub=1' })));

export default router;
