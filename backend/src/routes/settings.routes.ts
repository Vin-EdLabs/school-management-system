import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/active-term', async (req, res) => res.json(success({}))); 
router.put('/active-term', async (req, res) => res.json(success({ updated: true }))); 
router.get('/active-year', async (req, res) => res.json(success({}))); 
router.put('/active-year', async (req, res) => res.json(success({ updated: true }))); 

export default router;
