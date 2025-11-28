import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/', async (req, res) => res.json(success([])));
router.post('/', async (req, res) => res.status(201).json(success({})));
router.put('/:id', async (req, res) => res.json(success({})));
router.delete('/:id', async (req, res) => res.json(success({ deleted: true })));
router.get('/year/:year', async (req, res) => res.json(success([])));

export default router;
