/**
 * School Website Management API — authenticated portal routes
 */
import express from 'express';
import multer from 'multer';
import {
  authenticate,
  requireRole,
  requireTenant,
  type AuthRequest,
} from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  addGalleryImage,
  bufferToDataUrl,
  createEvent,
  deleteEvent,
  deleteGalleryImage,
  getAboutContent,
  getAdminOverview,
  getAdmissionConfig,
  getCareersConfig,
  getApplication,
  getContactInfo,
  getWebsitePortalNotificationSummary,
  listApplications,
  listContactMessages,
  listEmploymentApplications,
  listEvents,
  listGallery,
  listTranscriptRequests,
  listTestimonialSubmissions,
  markContactMessagesRead,
  markContactMessageRead,
  markTranscriptRequestRead,
  markTestimonialRead,
  reorderGallery,
  requestWebsiteEnable,
  updateAboutContent,
  updateAdmissionConfig,
  updateCareersConfig,
  updateApplicationStatus,
  updateContactInfo,
  updateEmploymentApplicationStatus,
  updateTranscriptRequestStatus,
  updateTestimonialStatus,
  updateEvent,
  updateWebsiteSettings,
  type ApplicationStatus,
} from '../services/schoolWebsiteService.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const WEBSITE_ROLES = ['super-admin', 'administrator', 'website-manager'] as const;

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
router.use(requireRole(...WEBSITE_ROLES));

function tenantIdOf(req: AuthRequest): number {
  return Number(req.user!.tenantId);
}

function handleError(res: express.Response, err: unknown) {
  const status = (err as { status?: number })?.status || 500;
  const message = err instanceof Error ? err.message : 'Request failed';
  if (status >= 500) console.error('Website admin error:', err);
  return res.status(status).json({ error: message });
}

router.get('/overview', async (req: AuthRequest, res) => {
  try {
    res.json(await getAdminOverview(tenantIdOf(req)));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/request-enable', async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    res.json(
      await requestWebsiteEnable(
        tenantIdOf(req),
        {
          id: user.id,
          username: user.username,
          full_name: (user as { full_name?: string }).full_name,
        },
        req.body?.message
      )
    );
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/settings', async (req: AuthRequest, res) => {
  try {
    res.json(await updateWebsiteSettings(tenantIdOf(req), req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/upload-image', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = bufferToDataUrl(req.file);
    res.json({ url });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/about', async (req: AuthRequest, res) => {
  try {
    res.json(await getAboutContent(tenantIdOf(req)));
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/about', async (req: AuthRequest, res) => {
  try {
    res.json(await updateAboutContent(tenantIdOf(req), req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/admissions/config', async (req: AuthRequest, res) => {
  try {
    res.json(await getAdmissionConfig(tenantIdOf(req)));
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/admissions/config', async (req: AuthRequest, res) => {
  try {
    res.json(await updateAdmissionConfig(tenantIdOf(req), req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/careers/config', async (req: AuthRequest, res) => {
  try {
    res.json(await getCareersConfig(tenantIdOf(req)));
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/careers/config', async (req: AuthRequest, res) => {
  try {
    res.json(await updateCareersConfig(tenantIdOf(req), req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/admissions/applications', async (req: AuthRequest, res) => {
  try {
    res.json({ items: await listApplications(tenantIdOf(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/admissions/applications/:id', async (req: AuthRequest, res) => {
  try {
    res.json(await getApplication(tenantIdOf(req), Number(req.params.id)));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/admissions/applications/:id/status', async (req: AuthRequest, res) => {
  try {
    const status = req.body.status as ApplicationStatus;
    if (!['pending', 'under_review', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    res.json(
      await updateApplicationStatus(tenantIdOf(req), Number(req.params.id), status, {
        userId: req.user?.id ?? null,
        userRole: req.user?.role ?? null,
      })
    );
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/gallery', async (req: AuthRequest, res) => {
  try {
    res.json({ items: await listGallery(tenantIdOf(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/gallery', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = bufferToDataUrl(req.file);
    const category = String(req.body.category || 'facilities');
    const item = await addGalleryImage(tenantIdOf(req), url, category, url);
    res.status(201).json(item);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/gallery/:id', async (req: AuthRequest, res) => {
  try {
    res.json(await deleteGalleryImage(tenantIdOf(req), Number(req.params.id)));
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/gallery/reorder', async (req: AuthRequest, res) => {
  try {
    const orderedIds = Array.isArray(req.body.ordered_ids)
      ? req.body.ordered_ids.map(Number).filter(Number.isFinite)
      : [];
    res.json({ items: await reorderGallery(tenantIdOf(req), orderedIds) });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/events', async (req: AuthRequest, res) => {
  try {
    res.json({ items: await listEvents(tenantIdOf(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/events', async (req: AuthRequest, res) => {
  try {
    res.status(201).json(await createEvent(tenantIdOf(req), req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/events/:id', async (req: AuthRequest, res) => {
  try {
    res.json(await updateEvent(tenantIdOf(req), Number(req.params.id), req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/events/:id', async (req: AuthRequest, res) => {
  try {
    res.json(await deleteEvent(tenantIdOf(req), Number(req.params.id)));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/contact', async (req: AuthRequest, res) => {
  try {
    res.json(await getContactInfo(tenantIdOf(req)));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/contact/messages', async (req: AuthRequest, res) => {
  try {
    res.json({ items: await listContactMessages(tenantIdOf(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/contact', async (req: AuthRequest, res) => {
  try {
    res.json(await updateContactInfo(tenantIdOf(req), req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/contact/messages/read-all', async (req: AuthRequest, res) => {
  try {
    res.json(await markContactMessagesRead(tenantIdOf(req)));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/contact/messages/:id/read', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid message id' });
    res.json(await markContactMessageRead(tenantIdOf(req), id));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/notifications/summary', async (req: AuthRequest, res) => {
  try {
    res.json(await getWebsitePortalNotificationSummary(tenantIdOf(req)));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/employment/applications', async (req: AuthRequest, res) => {
  try {
    res.json({ items: await listEmploymentApplications(tenantIdOf(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/employment/applications/:id/status', async (req: AuthRequest, res) => {
  try {
    const status = req.body.status as ApplicationStatus;
    if (!['pending', 'under_review', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    res.json(
      await updateEmploymentApplicationStatus(tenantIdOf(req), Number(req.params.id), status)
    );
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/alumni/transcript-requests', async (req: AuthRequest, res) => {
  try {
    res.json({ items: await listTranscriptRequests(tenantIdOf(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/alumni/transcript-requests/:id/read', async (req: AuthRequest, res) => {
  try {
    res.json(await markTranscriptRequestRead(tenantIdOf(req), Number(req.params.id)));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/alumni/transcript-requests/:id/status', async (req: AuthRequest, res) => {
  try {
    res.json(
      await updateTranscriptRequestStatus(tenantIdOf(req), Number(req.params.id), String(req.body.status))
    );
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/alumni/testimonials', async (req: AuthRequest, res) => {
  try {
    res.json({ items: await listTestimonialSubmissions(tenantIdOf(req)) });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/alumni/testimonials/:id/read', async (req: AuthRequest, res) => {
  try {
    res.json(await markTestimonialRead(tenantIdOf(req), Number(req.params.id)));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/alumni/testimonials/:id/status', async (req: AuthRequest, res) => {
  try {
    res.json(await updateTestimonialStatus(tenantIdOf(req), Number(req.params.id), String(req.body.status)));
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
