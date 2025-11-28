import { Router } from 'express';
import * as paymentsService from '../services/payments.service.js';
import { failure, success } from '../utils/response.js';

const router = Router();

router.get('/', async (req, res) => {
	try {
		const list = await paymentsService.listPayments(req.query ?? {} as any);
		return res.json(success(list));
	} catch (err: any) {
		return res.status(500).json(failure(err.message));
	}
});

router.post('/', async (req, res) => {
	try {
		const recorded = await paymentsService.recordPayment(req.body);
		return res.status(201).json(success(recorded));
	} catch (err: any) {
		return res.status(500).json(failure(err.message));
	}
});

router.get('/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const p = await paymentsService.getPayment(id);
		if (!p) return res.status(404).json(failure('Payment not found'));
		return res.json(success(p));
	} catch (err: any) {
		return res.status(500).json(failure(err.message));
	}
});

router.get('/student/:studentId', async (req, res) => {
	try {
		const studentId = Number(req.params.studentId);
		const payments = await paymentsService.getPaymentsForStudent(studentId);
		return res.json(success(payments));
	} catch (err: any) {
		return res.status(500).json(failure(err.message));
	}
});

router.get('/term/:termId', async (req, res) => {
	try {
		// For now delegate to list with filter
		const list = await paymentsService.listPayments({ termId: req.params.termId });
		return res.json(success(list));
	} catch (err: any) {
		return res.status(500).json(failure(err.message));
	}
});

router.get('/export', async (req, res) => res.json(success({ url: '/reports/export/csv?stub=1' })));

export default router;
