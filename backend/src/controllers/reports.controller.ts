import type { Request, Response } from 'express';
import * as reportsService from '../services/reports.service.js';
import { failure, success } from '../utils/response.js';

export async function summary(req: Request, res: Response) {
  try {
    const data = await reportsService.getSummary();
    return res.json(success(data));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function termReport(req: Request, res: Response) {
  try {
    const termId = Number(req.params.termId);
    if (Number.isNaN(termId) || termId <= 0) return res.status(400).json(failure('Invalid termId'));
    const data = await reportsService.getTermAggregates(termId);
    return res.json(success(data));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function yearReport(req: Request, res: Response) {
  try {
    const year = Number(req.params.year);
    if (Number.isNaN(year)) return res.status(400).json(failure('Invalid year'));
    const data = await reportsService.getYearAggregates(year);
    return res.json(success(data));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function trends(req: Request, res: Response) {
  try {
    const data = await reportsService.getTrends();
    return res.json(success(data));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function pieChart(req: Request, res: Response) {
  try {
    // placeholder distribution; compute in service if needed
    return res.json(success({}));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    const q = req.query as any;
    // allow exporting summary or term/year depending on params
    let data: any = {};
    if (q.termId || req.params.termId) {
      const termId = Number(q.termId ?? req.params.termId);
      data = await reportsService.getTermAggregates(termId);
    } else if (q.year || req.params.year) {
      const year = Number(q.year ?? req.params.year);
      data = await reportsService.getYearAggregates(year);
    } else {
      data = await reportsService.getSummary();
    }

    // flatten simple object into CSV
    const keys = Object.keys(data);
    const header = keys.join(',');
    const row = keys.map((k) => {
      const v = data[k];
      if (v === null || v === undefined) return '';
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',');
    const csv = header + '\n' + row;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
    return res.send(Buffer.from(csv, 'utf-8'));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function exportPdf(req: Request, res: Response) {
  try {
    const q = req.query as any;
    const payload = {} as any;
    if (q.termId || req.params.termId) payload.termId = Number(q.termId ?? req.params.termId);
    if (q.year || req.params.year) payload.year = Number(q.year ?? req.params.year);
    const buffer = await reportsService.generatePdf(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function exportExcel(req: Request, res: Response) {
  try {
    const q = req.query as any;
    const payload = {} as any;
    if (q.termId || req.params.termId) payload.termId = Number(q.termId ?? req.params.termId);
    if (q.year || req.params.year) payload.year = Number(q.year ?? req.params.year);
    const buffer = await reportsService.generateExcel(payload);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function exportExcel(req: Request, res: Response) {
  try {
    return res.json(success({ url: '/reports/export/excel?stub=1' }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
