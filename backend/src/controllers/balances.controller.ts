import type { Request, Response } from 'express';
import * as repo from '../repositories/balances.repository.js';
import { failure, success } from '../utils/response.js';

export async function listByTerm(req: Request, res: Response) {
    try {
        const termId = Number(req.params.termId);
        const list = await repo.getBalancesForTerm(termId);
        return res.json(success(list));
    } catch (err: any) {
        return res.status(500).json(failure(err.message));
    }
}

export async function update(req: Request, res: Response) {
    try {
        const { studentId, termId } = req.params;
        const data = req.body;
        const updated = await repo.updateBalance(Number(studentId), Number(termId), data);
        return res.json(success(updated));
    } catch (err: any) {
        return res.status(500).json(failure(err.message));
    }
}

export async function getStudentBalance(req: Request, res: Response) {
    try {
        const { studentId, termId } = req.params;
        const balance = await repo.getBalanceForStudent(Number(studentId), Number(termId));
        return res.json(success(balance || { arrears: 0, credit_balance: 0 }));
    } catch (err: any) {
        return res.status(500).json(failure(err.message));
    }
}
