import React, { useRef, useState } from 'react';
import { Briefcase, Camera, FileText, Loader2, Mail, Phone, UploadCloud, User, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { schoolWebsitePublicService } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal } from '../SchoolWebsiteLayout';
import ApplicationSuccessScreen from '../components/ApplicationSuccessScreen';
import ApplicationsClosedNotice from '../components/ApplicationsClosedNotice';
import { getApplicationWindowStatus } from '../utils/applicationWindow';

type Doc = { name: string; url: string; type: string; label?: string };

const SW_FIELD = 'sw-field h-11 w-full';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function isImageDoc(doc: Doc): boolean {
  return doc.type.startsWith('image/') || doc.url.startsWith('data:image/');
}

function resolveClientFileType(file: File): string {
  if (ALLOWED_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };
  return ext && map[ext] ? map[ext] : file.type;
}

export default function CareersPage() {
  const { slug, data } = useSchoolWebsite();
  const careers = data?.careers || {};
  const contact = data?.contact || {};
  const applicationWindow = getApplicationWindowStatus(careers);
  const open = applicationWindow.open;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    position_applied: '',
    message: '',
  });
  const [documents, setDocuments] = useState<Doc[]>([]);

  const isUploading = uploadingCount > 0;

  const uploadDoc = async (file: File) => {
    const resolvedType = resolveClientFileType(file);
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 5MB.', variant: 'destructive' });
      return;
    }
    if (!ALLOWED_TYPES.includes(resolvedType)) {
      toast({ title: 'Invalid file type', description: 'Use JPG, PNG, WebP, or PDF.', variant: 'destructive' });
      return;
    }

    setUploadingCount((c) => c + 1);
    try {
      const res = await schoolWebsitePublicService.uploadDocument(slug, file);
      if (!res.url?.startsWith('data:')) {
        throw new Error('Upload did not return a valid file');
      }
      setDocuments((prev) => [
        ...prev,
        {
          name: res.name,
          url: res.url,
          type: res.type || resolvedType,
          label: file.name,
        },
      ]);
      toast({ title: 'File attached' });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setUploadingCount((c) => Math.max(0, c - 1));
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      void uploadDoc(f);
    });
  };

  const removeDoc = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) {
      toast({ title: 'Please wait', description: 'Files are still uploading.', variant: 'destructive' });
      return;
    }
    if (!form.full_name.trim() || !form.phone.trim() || !form.message.trim()) {
      toast({ title: 'Please fill in name, phone, and message', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await schoolWebsitePublicService.submitEmployment(slug, {
        ...form,
        documents: documents.map((d) => ({
          name: d.name,
          url: d.url,
          type: d.type,
          label: d.label || d.name,
        })),
      });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast({
        title: 'Could not submit',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <ApplicationSuccessScreen
        title="Application Submitted!"
        message="Thank you for your interest in joining our school. Our team will review your application and contact you shortly."
      />
    );
  }

  return (
    <>
      <PageHero
        title="Careers"
        subtitle={
          open
            ? 'Join our team — teachers and staff are welcome to apply'
            : 'Employment applications are not open at this time'
        }
      />

      <section className="sw-section" style={{ background: 'var(--sw-offwhite)' }}>
        <div className="sw-container max-w-3xl">
          {!open && applicationWindow.reason && (
            <Reveal>
              <ApplicationsClosedNotice
                kind="careers"
                reason={applicationWindow.reason}
                contact={contact}
              />
            </Reveal>
          )}

          {careers.intro_text && (
            <Reveal>
              <div className={cn('sw-card p-8', !open ? 'mt-8' : 'mb-8')}>
                <div className="sw-prose text-sm" dangerouslySetInnerHTML={{ __html: String(careers.intro_text) }} />
              </div>
            </Reveal>
          )}

          {open && (
            <Reveal>
              <form onSubmit={(e) => void onSubmit(e)} className="sw-form-card overflow-hidden">
                <div className="border-b border-[var(--sw-border)] bg-gradient-to-r from-white to-[#fdfbf6] px-6 py-5 md:px-8">
                  <p className="sw-eyebrow">Apply to teach or work with us</p>
                  <h2 className="sw-serif mt-2 text-2xl">Employment application</h2>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--sw-muted)' }}>
                    Complete all fields below. You may attach your CV, certificates, or a passport photo (PDF or image).
                  </p>
                </div>

                <div className="space-y-8 px-6 py-8 md:px-8">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="career-name" className="flex items-center gap-2">
                        <User className="h-4 w-4" style={{ color: 'var(--sw-primary)' }} />
                        Full name *
                      </Label>
                      <Input
                        id="career-name"
                        className={SW_FIELD}
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="career-email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" style={{ color: 'var(--sw-primary)' }} />
                        Email
                      </Label>
                      <Input
                        id="career-email"
                        type="email"
                        className={SW_FIELD}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="career-phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" style={{ color: 'var(--sw-primary)' }} />
                        Phone *
                      </Label>
                      <Input
                        id="career-phone"
                        type="tel"
                        className={SW_FIELD}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+233 …"
                        required
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="career-position" className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" style={{ color: 'var(--sw-primary)' }} />
                        Position applying for
                      </Label>
                      <Input
                        id="career-position"
                        className={SW_FIELD}
                        placeholder="e.g. Mathematics Teacher, Administrator"
                        value={form.position_applied}
                        onChange={(e) => setForm({ ...form, position_applied: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="career-message">Cover letter / message *</Label>
                    <Textarea
                      id="career-message"
                      rows={6}
                      className="sw-field min-h-[9rem] w-full resize-y rounded-lg"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Tell us about your experience and why you want to join our school…"
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>CV, certificates, or photo (PDF or image)</Label>
                    <div
                      className={cn(
                        'sw-dropzone flex cursor-pointer flex-col items-center justify-center gap-3 px-4 py-10 text-center',
                        (documents.length > 0 || dragOver) && 'border-solid',
                        dragOver && 'is-dragover',
                        isUploading && 'pointer-events-none opacity-70'
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        handleFiles(e.dataTransfer.files);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                      }}
                    >
                      {isUploading ? (
                        <Loader2 className="h-9 w-9 animate-spin" style={{ color: 'var(--sw-primary)' }} />
                      ) : (
                        <UploadCloud className="h-9 w-9" style={{ color: 'var(--sw-primary)' }} />
                      )}
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--sw-text)' }}>
                          {isUploading ? 'Uploading…' : 'Drag & drop files here, or click to browse'}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--sw-muted)' }}>
                          PDF, JPG, PNG or WEBP — max 5MB each
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                        multiple
                        onChange={(e) => {
                          handleFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </div>

                    {documents.length > 0 && (
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {documents.map((d, i) => (
                          <li
                            key={`${d.name}-${i}`}
                            className="relative overflow-hidden rounded-lg border border-[var(--sw-border)] bg-white"
                          >
                            {isImageDoc(d) ? (
                              <div className="relative">
                                <div className="flex h-36 items-center justify-center overflow-hidden bg-[var(--sw-offwhite)]">
                                  <img
                                    src={d.url}
                                    alt={d.label || d.name}
                                    className="max-h-full max-w-full object-contain p-2"
                                  />
                                </div>
                                <div className="flex items-center gap-2 border-t border-[var(--sw-border)] px-3 py-2 text-sm">
                                  <Camera className="h-4 w-4 shrink-0" style={{ color: 'var(--sw-primary)' }} />
                                  <span className="min-w-0 flex-1 truncate">{d.label || d.name}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--sw-muted)' }}>
                                    Image
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-3 text-sm">
                                <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--sw-primary)' }} />
                                <span className="min-w-0 flex-1 truncate">{d.label || d.name}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--sw-muted)' }}>
                                  PDF
                                </span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeDoc(i)}
                              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white shadow"
                              style={{ background: 'var(--sw-primary)' }}
                              aria-label="Remove file"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || isUploading}
                    className="sw-btn sw-btn-primary w-full gap-2"
                  >
                    {submitting || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isUploading ? 'Uploading files…' : submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                </div>
              </form>
            </Reveal>
          )}
        </div>
      </section>
    </>
  );
}
