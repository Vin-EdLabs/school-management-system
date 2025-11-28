import { Router } from 'express';
import { success } from '../utils/response.js';

const router = Router();

router.get('/summary', async (req, res) => res.json(success({}))); 
router.get('/term/:termId', async (req, res) => res.json(success({}))); 
router.get('/year/:year', async (req, res) => res.json(success({}))); 
router.get('/trends', async (req, res) => res.json(success([]))); 
router.get('/pie-chart', async (req, res) => res.json(success({}))); 

router.get('/export/csv', async (req, res) => res.json(success({ url: '/reports/export/csv?stub=1' })));
router.get('/export/pdf', async (req, res) => res.json(success({ url: '/reports/export/pdf?stub=1' })));
router.get('/export/excel', async (req, res) => res.json(success({ url: '/reports/export/excel?stub=1' })));

export default router;
