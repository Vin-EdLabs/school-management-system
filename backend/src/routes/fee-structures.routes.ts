import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/', async (req, res) => res.json(success([])));
router.post('/', async (req, res) => res.status(201).json(success({})));
router.get('/:id', async (req, res) => res.json(success({})));
router.put('/:id', async (req, res) => res.json(success({})));
router.put('/:id/assign-class', async (req, res) => res.json(success({ assigned: true })));
router.put('/:id/assign-term', async (req, res) => res.json(success({ assigned: true })));

export default router;
