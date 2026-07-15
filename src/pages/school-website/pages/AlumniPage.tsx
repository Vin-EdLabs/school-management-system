import React, { useMemo, useState } from 'react';
import {
  Award,
  FileText,
  Loader2,
  Mail,
  MessageSquareQuote,
  Phone,
  ScrollText,
  User,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { resolveWebsiteImageUrl, type WebsiteAlumniProfile } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal, SectionHeading } from '../SchoolWebsiteLayout';
import ApplicationSuccessScreen from '../components/ApplicationSuccessScreen';

const SW_FIELD = 'sw-field h-11 w-full';

const DOCUMENT_CARDS = [
  {
    id: 'transcript',
    icon: ScrollText,
    title: 'School Transcript',
    description:
      'Official record of your academic performance while at the school — required for transfers, further studies, and many applications.',
  },
  {
    id: 'bece',
    icon: Award,
    title: 'BECE Results',
    description:
      'Certified copy of your Basic Education Certificate Examination results issued through the school records office.',
  },
  {
    id: 'both',
    icon: FileText,
    title: 'Transcript & BECE',
    description:
      'Request both your school transcript and BECE results together in a single application.',
  },
  {
    id: 'testimonial',
    icon: MessageSquareQuote,
    title: 'Testimonial Letter',
    description:
      'An official reference or testimonial letter from the school for employment, university admission, or other purposes.',
  },
] as const;

function successMessage(documentType: string, schoolName: string) {
  if (documentType === 'testimonial') {
    return `Thank you. ${schoolName} will prepare your testimonial letter and contact you on the phone number provided when it is ready.`;
  }
  if (documentType === 'bece') {
    return 'Thank you. Our records office will process your BECE results request and contact you on the phone number provided.';
  }
  if (documentType === 'both') {
    return 'Thank you. Our records office will process your transcript and BECE results request and contact you on the phone number provided.';
  }
  return 'Thank you. Our records office will process your transcript request and contact you on the phone number provided.';
}

function notesPlaceholder(documentType: string) {
  if (documentType === 'testimonial') {
    return 'Purpose of the letter, employer or institution name, delivery preference…';
  }
  return 'Former class, delivery preference, or other details…';
}

export default function AlumniPage() {
  const { slug, schoolName, data } = useSchoolWebsite();
  const alumniProfiles = (data?.alumni_profiles || []) as WebsiteAlumniProfile[];
  const [submittedType, setSubmittedType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    completion_year: '',
    phone: '',
    email: '',
    document_type: 'transcript',
    notes: '',
  });

  const activeCard = useMemo(
    () => DOCUMENT_CARDS.find((c) => c.id === form.document_type) || DOCUMENT_CARDS[0],
    [form.document_type]
  );

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.completion_year.trim() || !form.phone.trim()) {
      toast({ title: 'Please fill in name, year of completion, and phone', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await schoolWebsitePublicService.submitTranscriptRequest(slug, form);
      setSubmittedType(form.document_type);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast({
        title: 'Could not submit request',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedType) {
    return (
      <ApplicationSuccessScreen
        title="Request Received!"
        message={successMessage(submittedType, schoolName)}
      />
    );
  }

  return (
    <>
      <PageHero
        title="Alumni"
        subtitle="Celebrating our graduates and supporting document requests from former students"
      />

      {alumniProfiles.length > 0 && (
        <section className="sw-section bg-white">
          <div className="sw-container">
            <SectionHeading
              eyebrow="Success stories"
              title="Distinguished alumni"
              centered
            />
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {alumniProfiles.map((profile, i) => {
                const photo = resolveWebsiteImageUrl(profile.photo_url);
                return (
                  <Reveal key={profile.id} delay={i * 80}>
                    <article className="sw-card h-full overflow-hidden">
                      <div className="flex items-center gap-4 border-b border-slate-100 p-6">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--sw-gold)]/30">
                          {photo ? (
                            <img src={photo} alt={profile.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <div
                              className="sw-serif flex h-full w-full items-center justify-center text-xl text-white"
                              style={{ background: 'var(--sw-primary)' }}
                            >
                              {profile.full_name.slice(0, 1)}
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="sw-serif text-lg">{profile.full_name}</h3>
                          {profile.graduation_year && (
                            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--sw-gold)' }}>
                              Class of {profile.graduation_year}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="p-6 pt-5">
                        {profile.achievement && (
                          <p className="text-sm font-semibold" style={{ color: 'var(--sw-primary)' }}>
                            {profile.achievement}
                          </p>
                        )}
                        {profile.testimonial && (
                          <p className="mt-3 text-sm leading-relaxed italic" style={{ color: 'var(--sw-muted)' }}>
                            &ldquo;{profile.testimonial}&rdquo;
                          </p>
                        )}
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="sw-section sw-alumni-section" style={{ background: 'var(--sw-offwhite)' }}>
        <div className="sw-container sw-alumni-page">
          <Reveal>
            <SectionHeading
              eyebrow="Records office"
              title="Alumni & document requests"
              centered
            />
          </Reveal>
          <Reveal delay={40}>
            <p className="sw-alumni-intro mx-auto max-w-2xl text-center text-sm leading-relaxed md:text-base">
              Former students and alumni can request transcripts, BECE results, or a testimonial letter from{' '}
              {schoolName}. Choose the document type below, fill in the form, and our office will call you when it
              is ready.
            </p>
          </Reveal>

          <Reveal delay={40}>
            <div className="sw-alumni-info-grid mx-auto mt-10 max-w-5xl">
              {DOCUMENT_CARDS.map((card) => {
                const Icon = card.icon;
                const selected = form.document_type === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`sw-alumni-info-card${selected ? ' is-selected' : ''}`}
                    onClick={() => setForm({ ...form, document_type: card.id })}
                  >
                    <span className="sw-alumni-info-card-icon">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="sw-serif sw-alumni-info-card-title">{card.title}</h3>
                    <p className="sw-alumni-info-card-desc">{card.description}</p>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <div className="sw-alumni-forms mx-auto mt-10 max-w-3xl">
            <Reveal delay={80}>
              <form onSubmit={(e) => void submitRequest(e)} className="sw-form-card sw-alumni-form overflow-hidden">
                <div className="sw-alumni-form-header sw-alumni-form-header--navy">
                  <span className="sw-alumni-form-icon">
                    <activeCard.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="sw-eyebrow !text-[var(--sw-gold)]">Document request</p>
                    <h2 className="sw-serif mt-1 text-2xl text-white">Request Official Documents</h2>
                    <p className="mt-2 text-sm text-white/80">
                      Requesting: <strong className="text-white">{activeCard.title}</strong>
                    </p>
                  </div>
                </div>
                <div className="space-y-5 p-6 md:p-8">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="doc-name" className="flex items-center gap-2">
                        <User className="h-4 w-4" style={{ color: 'var(--sw-primary)' }} />
                        Full name *
                      </Label>
                      <Input
                        id="doc-name"
                        className={SW_FIELD}
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doc-year">Year of completion *</Label>
                      <Input
                        id="doc-year"
                        className={SW_FIELD}
                        placeholder="e.g. 2019"
                        value={form.completion_year}
                        onChange={(e) => setForm({ ...form, completion_year: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doc-phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" style={{ color: 'var(--sw-primary)' }} />
                        Phone *
                      </Label>
                      <Input
                        id="doc-phone"
                        type="tel"
                        className={SW_FIELD}
                        placeholder="+233 …"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Document requested *</Label>
                      <Select
                        value={form.document_type}
                        onValueChange={(v) => setForm({ ...form, document_type: v })}
                      >
                        <SelectTrigger className={`${SW_FIELD} sw-select-trigger`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="sw-select-content">
                          <SelectItem value="transcript" className="sw-select-item">School Transcript</SelectItem>
                          <SelectItem value="bece" className="sw-select-item">BECE Results</SelectItem>
                          <SelectItem value="both" className="sw-select-item">Both Transcript &amp; BECE</SelectItem>
                          <SelectItem value="testimonial" className="sw-select-item">Testimonial Letter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="doc-email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" style={{ color: 'var(--sw-primary)' }} />
                        Email (optional)
                      </Label>
                      <Input
                        id="doc-email"
                        type="email"
                        className={SW_FIELD}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="doc-notes">Additional notes (optional)</Label>
                      <Textarea
                        id="doc-notes"
                        rows={3}
                        className="sw-field w-full resize-y rounded-lg"
                        placeholder={notesPlaceholder(form.document_type)}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={submitting} className="sw-btn sw-btn-primary w-full gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit request
                  </button>
                </div>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
