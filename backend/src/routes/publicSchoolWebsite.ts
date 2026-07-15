/**
 * Public School Website API — no auth required
 */
import express from 'express';
import multer from 'multer';
import { resolvePublicWebsiteTenant } from '../middleware/resolvePublicWebsiteTenant.js';
import type { TenantRequest } from '../middleware/tenantResolver.js';
import {
  bufferToDataUrl,
  getPublicWebsiteBundle,
  resolveUploadMimeType,
  submitApplication,
  submitContactMessage,
  submitEmploymentApplication,
  submitTestimonial,
  submitTranscriptRequest,
} from '../services/schoolWebsiteService.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(resolvePublicWebsiteTenant);

function tenantIdOf(req: TenantRequest): number {
  if (!req.tenantId) throw Object.assign(new Error('School not found'), { status: 404 });
  return req.tenantId;
}

function handleError(res: express.Response, err: unknown) {
  const status = (err as { status?: number })?.status || 500;
  const message = err instanceof Error ? err.message : 'Request failed';
  if (status >= 500) console.error('Public website error:', err);
  return res.status(status).json({ error: message });
}

/** Full public site payload */
router.get('/site', async (req: TenantRequest, res) => {
  try {
    const data = await getPublicWebsiteBundle(tenantIdOf(req));
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

/** Submit admission application */
router.post('/applications', async (req: TenantRequest, res) => {
  try {
    const created = await submitApplication(tenantIdOf(req), req.body);
    res.status(201).json({ success: true, id: created.id, submitted_at: created.submitted_at });
  } catch (err) {
    handleError(res, err);
  }
});

/** Upload document for application (returns data URL) */
router.post('/applications/upload', upload.single('file'), async (req: TenantRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const type = resolveUploadMimeType(req.file.mimetype, req.file.originalname);
    const url = bufferToDataUrl(req.file);
    res.json({ url, name: req.file.originalname, type });
  } catch (err) {
    handleError(res, err);
  }
});

/** Contact form */
router.post('/contact', async (req: TenantRequest, res) => {
  try {
    const { name, phone, email, message } = req.body || {};
    await submitContactMessage(tenantIdOf(req), { name, phone, email, message });
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

/** Employment / careers application */
router.post('/employment', async (req: TenantRequest, res) => {
  try {
    const created = await submitEmploymentApplication(tenantIdOf(req), req.body);
    res.status(201).json({ success: true, id: created.id, submitted_at: created.submitted_at });
  } catch (err) {
    handleError(res, err);
  }
});

/** Transcript / BECE result request */
router.post('/transcript-request', async (req: TenantRequest, res) => {
  try {
    const created = await submitTranscriptRequest(tenantIdOf(req), req.body);
    res.status(201).json({ success: true, id: created.id });
  } catch (err) {
    handleError(res, err);
  }
});

/** Alumni testimonial letter request */
router.post('/testimonial', async (req: TenantRequest, res) => {
  try {
    const created = await submitTestimonial(tenantIdOf(req), req.body);
    res.status(201).json({ success: true, id: created.id });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
