import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/fees/term/:termId', async (req, res) => res.json(success({}))); 
router.get('/income/year/:year', async (req, res) => res.json(success({}))); 
router.get('/expenses/year/:year', async (req, res) => res.json(success({}))); 
router.get('/net/year/:year', async (req, res) => res.json(success({}))); 

export default router;
