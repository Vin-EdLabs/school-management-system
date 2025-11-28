import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/check', async (req, res) => res.json(success([])));

export default router;
