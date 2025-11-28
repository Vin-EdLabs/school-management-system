import { Router } from 'express';
import { failure, success } from '../utils/response.js';

const router = Router();

router.get('/check', async (req, res) => {
	try {
		// Placeholder: implement notification retrieval/push later
		return res.json(success([]));
	} catch (err: any) {
		return res.status(500).json(failure(err.message));
	}
});

export default router;
