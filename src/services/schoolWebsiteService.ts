import { apiService, resolveApiBaseUrl } from './api';

export type WebsiteHighlight = { icon: string; title: string; description: string };
export type WebsiteStats = {
  founded_year?: number | null;
  student_count?: number | null;
  programs_count?: number | null;
  pass_rate?: string | null;
};

export type WebsiteHomeContent = {
  enrolment_label?: string | null;
  welcome_heading?: string | null;
  welcome_heading_accent?: string | null;
  welcome_link_text?: string | null;
  highlights_eyebrow?: string | null;
  highlights_title?: string | null;
  highlights_bg_color?: string | null;
  cta_title?: string | null;
  cta_subtitle?: string | null;
  cta_button_text?: string | null;
  cta_bg_color?: string | null;
};

export type WebsiteEventImage = { url: string; caption?: string };
export type WebsiteEvent = {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  cover_image_url: string | null;
  gallery_images: WebsiteEventImage[];
  sort_order?: number;
};

export type PublicWebsiteBundle = {
  enabled: boolean;
  tenant?: { name: string; slug: string };
  website?: {
    school_name: string;
    slug: string;
    accent_color: string;
    custom_accent?: string | null;
    logo_url: string | null;
    banner_image_url: string | null;
    tagline: string | null;
    welcome_text: string | null;
    welcome_image_url: string | null;
    welcome_image_secondary_url?: string | null;
    home_content?: WebsiteHomeContent;
    highlights: WebsiteHighlight[];
    stats: WebsiteStats;
    social_links: Record<string, string>;
  };
  about?: Record<string, unknown>;
  admission?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  gallery?: Array<{ id: number; url: string; thumbnail_url: string; category: string }>;
  events?: WebsiteEvent[];
  classes?: Array<{ id: number; name: string; level: string | null }>;
};

function resolvePublicApiBase(): string {
  return resolveApiBaseUrl();
}

async function publicFetch<T>(path: string, slug: string, init?: RequestInit): Promise<T> {
  const base = resolvePublicApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': slug,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
  return data as T;
}

async function publicForm<T>(path: string, slug: string, form: FormData): Promise<T> {
  const base = resolvePublicApiBase();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'X-Tenant-Slug': slug },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Upload failed');
  return data as T;
}

export const schoolWebsitePublicService = {
  getSite(slug: string) {
    return publicFetch<PublicWebsiteBundle>('/public-website/site', slug);
  },

  submitApplication(slug: string, body: Record<string, unknown>) {
    return publicFetch<{ success: boolean; id: number }>('/public-website/applications', slug, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  uploadDocument(slug: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return publicForm<{ url: string; name: string; type: string }>('/public-website/applications/upload', slug, fd);
  },

  submitContact(slug: string, body: { name: string; phone: string; email?: string; message: string }) {
    return publicFetch<{ success: boolean }>('/public-website/contact', slug, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  submitTranscriptRequest(slug: string, body: Record<string, unknown>) {
    return publicFetch<{ success: boolean; id: number }>('/public-website/transcript-request', slug, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  submitTestimonial(slug: string, body: Record<string, unknown>) {
    return publicFetch<{ success: boolean; id: number }>('/public-website/testimonial', slug, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  submitEmployment(slug: string, body: Record<string, unknown>) {
    return publicFetch<{ success: boolean; id: number }>('/public-website/employment', slug, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const schoolWebsiteAdminService = {
  getOverview() {
    return apiService.get<Record<string, unknown>>('/school-website/overview');
  },

  requestWebsiteEnable(message?: string) {
    return apiService.post<{ ok: boolean; id: number }>('/school-website/request-enable', {
      message: message || undefined,
    });
  },

  updateSettings(body: Record<string, unknown>) {
    return apiService.patch<Record<string, unknown>>('/school-website/settings', body);
  },

  uploadImage(file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return apiService.postForm<{ url: string }>('/school-website/upload-image', fd);
  },

  getAbout() {
    return apiService.get<Record<string, unknown>>('/school-website/about');
  },

  saveAbout(body: Record<string, unknown>) {
    return apiService.put<Record<string, unknown>>('/school-website/about', body);
  },

  getAdmissionConfig() {
    return apiService.get<Record<string, unknown>>('/school-website/admissions/config');
  },

  saveAdmissionConfig(body: Record<string, unknown>) {
    return apiService.put<Record<string, unknown>>('/school-website/admissions/config', body);
  },

  getCareersConfig() {
    return apiService.get<Record<string, unknown>>('/school-website/careers/config');
  },

  saveCareersConfig(body: Record<string, unknown>) {
    return apiService.put<Record<string, unknown>>('/school-website/careers/config', body);
  },

  listApplications() {
    return apiService.get<{ items: Array<Record<string, unknown>> }>(
      '/school-website/admissions/applications'
    );
  },

  getApplication(id: number) {
    return apiService.get<Record<string, unknown>>(`/school-website/admissions/applications/${id}`);
  },

  updateApplicationStatus(id: number, status: string) {
    return apiService.patch<Record<string, unknown>>(
      `/school-website/admissions/applications/${id}/status`,
      { status }
    );
  },

  listGallery() {
    return apiService.get<{ items: Array<Record<string, unknown>> }>('/school-website/gallery');
  },

  uploadGalleryImage(file: File, category: string) {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('category', category);
    return apiService.postForm<Record<string, unknown>>('/school-website/gallery', fd);
  },

  deleteGalleryImage(id: number) {
    return apiService.delete<{ ok: boolean }>(`/school-website/gallery/${id}`);
  },

  reorderGallery(orderedIds: number[]) {
    return apiService.put<{ items: Array<Record<string, unknown>> }>(
      '/school-website/gallery/reorder',
      { ordered_ids: orderedIds }
    );
  },

  listEvents() {
    return apiService.get<{ items: WebsiteEvent[] }>('/school-website/events');
  },

  createEvent(body: Record<string, unknown>) {
    return apiService.post<WebsiteEvent>('/school-website/events', body);
  },

  updateEvent(id: number, body: Record<string, unknown>) {
    return apiService.put<WebsiteEvent>(`/school-website/events/${id}`, body);
  },

  deleteEvent(id: number) {
    return apiService.delete<{ ok: boolean }>(`/school-website/events/${id}`);
  },

  getPortalNotificationSummary() {
    return apiService.get<{
      pending_applications: number;
      unread_contact_messages: number;
      pending_employment: number;
      unread_transcript_requests: number;
      unread_testimonials: number;
      total: number;
    }>('/school-website/notifications/summary');
  },

  markContactMessagesRead() {
    return apiService.post<{ ok: boolean }>('/school-website/contact/messages/read-all', {});
  },

  markContactMessageRead(id: number) {
    return apiService.patch<{ id: number; is_read: boolean }>(
      `/school-website/contact/messages/${id}/read`,
      {}
    );
  },

  listEmploymentApplications() {
    return apiService.get<{ items: Array<Record<string, unknown>> }>('/school-website/employment/applications');
  },

  updateEmploymentStatus(id: number, status: string) {
    return apiService.patch<Record<string, unknown>>(`/school-website/employment/applications/${id}/status`, {
      status,
    });
  },

  getContact() {
    return apiService.get<Record<string, unknown>>('/school-website/contact');
  },

  listContactMessages() {
    return apiService.get<{ items: Array<Record<string, unknown>> }>('/school-website/contact/messages');
  },

  saveContact(body: Record<string, unknown>) {
    return apiService.put<Record<string, unknown>>('/school-website/contact', body);
  },

  listTranscriptRequests() {
    return apiService.get<{ items: Array<Record<string, unknown>> }>('/school-website/alumni/transcript-requests');
  },

  markTranscriptRequestRead(id: number) {
    return apiService.patch<{ id: number; is_read: boolean }>(
      `/school-website/alumni/transcript-requests/${id}/read`,
      {}
    );
  },

  updateTranscriptRequestStatus(id: number, status: string) {
    return apiService.patch<Record<string, unknown>>(
      `/school-website/alumni/transcript-requests/${id}/status`,
      { status }
    );
  },

  listTestimonialSubmissions() {
    return apiService.get<{ items: Array<Record<string, unknown>> }>('/school-website/alumni/testimonials');
  },

  markTestimonialRead(id: number) {
    return apiService.patch<{ id: number; is_read: boolean }>(
      `/school-website/alumni/testimonials/${id}/read`,
      {}
    );
  },

  updateTestimonialStatus(id: number, status: string) {
    return apiService.patch<Record<string, unknown>>(`/school-website/alumni/testimonials/${id}/status`, {
      status,
    });
  },
};

export type WebsiteEnableRequest = {
  id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_slug?: string;
  requested_by_name?: string | null;
  message: string;
  created_at: string;
};

export const superAdminWebsiteService = {
  list() {
    return apiService.get<{
      schools: Array<Record<string, unknown>>;
      stats: { active_sites: number; pending_applications: number; pending_enable_requests?: number };
      enable_requests: WebsiteEnableRequest[];
    }>('/super-admin/websites', { skipTenant: true, skipTenantHeaders: true });
  },

  setEnabled(tenantId: number, enabled: boolean) {
    return apiService.patch<{ tenant_id: number; is_enabled: boolean }>(
      `/super-admin/websites/${tenantId}/enabled`,
      { enabled },
      { skipTenant: true, skipTenantHeaders: true }
    );
  },

  setSubdomain(tenantId: number, subdomain: string | null) {
    return apiService.patch<{
      tenant_id: number;
      public_subdomain: string | null;
      effective_public_subdomain: string;
    }>(`/super-admin/websites/${tenantId}/subdomain`, { subdomain }, { skipTenant: true, skipTenantHeaders: true });
  },
};

export function resolveWebsiteImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  const base = apiService.getBaseUrl().replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}
