import express from 'express';
import * as controller from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/summary', requireAuth, controller.summary);
router.get('/term/:termId', requireAuth, controller.termReport);
router.get('/year/:year', requireAuth, controller.yearReport);
router.get('/trends', requireAuth, controller.trends);
router.get('/pie-chart', requireAuth, controller.pieChart);

router.get('/export/csv', requireAuth, controller.exportCsv);
router.get('/export/pdf', requireAuth, controller.exportPdf);
router.get('/export/excel', requireAuth, controller.exportExcel);

export default router;
