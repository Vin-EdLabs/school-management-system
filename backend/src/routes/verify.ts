import express from 'express';
import {
  resolveCardHolder,
  createInitialLostCardReport,
  submitLostCardDetails,
} from '../services/lostCardService.js';
import { getClientIp } from '../utils/clientIp.js';

const router = express.Router();

router.get('/:entityType/:entityId', async (req, res) => {
  try {
    const entityType = String(req.params.entityType || '').toLowerCase();
    const entityId = parseInt(req.params.entityId, 10);
    if (!['student', 'staff'].includes(entityType) || Number.isNaN(entityId)) {
      return res.status(400).json({ error: 'Invalid card reference' });
    }
    const holder = await resolveCardHolder(entityType, entityId);
    if (!holder || holder.verificationStatus === 'revoked') {
      return res.status(404).json({ error: 'ID information not found' });
    }
    res.json({
      entityType: holder.entityType,
      entityId: holder.entityId,
      cardId: `${entityType}/${entityId}`,
      fullName: holder.bearerName,
      idNumber: holder.idNumber,
      cardTypeLabel: holder.cardTypeLabel,
      schoolName: holder.schoolName,
      phone: holder.phone,
      website: holder.website,
      logoUrl: holder.logoUrl,
      photoUrl: holder.photoUrl,
      verified: holder.verified,
      verificationStatus: holder.verificationStatus,
      verifiedAt: holder.verifiedAt,
    });
  } catch (error) {
    console.error('Verify card error:', error);
    res.status(500).json({ error: 'Failed to load card' });
  }
});

router.post('/:entityType/:entityId/report', async (req, res) => {
  try {
    const entityType = String(req.params.entityType || '').toLowerCase();
    const entityId = parseInt(req.params.entityId, 10);
    if (!['student', 'staff'].includes(entityType) || Number.isNaN(entityId)) {
      return res.status(400).json({ error: 'Invalid card reference' });
    }
    const stage = String(req.body?.stage || 'INITIAL').toUpperCase();
    if (stage !== 'INITIAL') {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    const holder = await resolveCardHolder(entityType, entityId);
    if (!holder || holder.verificationStatus === 'revoked') {
      return res.status(404).json({ error: 'ID information not found' });
    }

    const ip = getClientIp(req);
    const { reportId, referenceCode } = await createInitialLostCardReport(holder, ip);
    res.status(201).json({ reportId, referenceCode });
  } catch (error) {
    console.error('Initial lost card report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

router.patch('/report/:reportId/report-details', async (req, res) => {
  try {
    const reportId = String(req.params.reportId || '');
    if (!reportId) return res.status(400).json({ error: 'Invalid report id' });

    const skipped = !!req.body?.skipped;
    const result = await submitLostCardDetails(reportId, {
      foundLocation: req.body?.foundLocation,
      collectionPoint: req.body?.collectionPoint,
      reporterPhone: req.body?.reporterPhone,
      skipped,
    });
    if (!result) return res.status(404).json({ error: 'Report not found' });
    res.json(result);
  } catch (error) {
    console.error('Lost card details error:', error);
    res.status(500).json({ error: 'Failed to save details' });
  }
});

export default router;
