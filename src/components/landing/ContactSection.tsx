import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, Mail, MessageSquare, Phone, School, User } from 'lucide-react';
import {
  SCHOLARNERVE_EMAIL,
  SCHOLARNERVE_PHONE,
  SCHOLARNERVE_PHONE_TEL,
  SCHOLARNERVE_WHATSAPP,
  WHATSAPP_DEMO_URL,
} from '@/content/scholarNerveContact';
import { REGISTER_SCHOOL_PATH } from '@/utils/landingScroll';
import { resolveApiBaseUrl } from '@/services/api';

const API_BASE = resolveApiBaseUrl();

const inputClass = 'scholar-register-field w-full';

type InquiryType = 'contact' | 'demo' | 'pricing';

export default function ContactSection({ standalone = false }: { standalone?: boolean }) {
  const location = useLocation();
  const [form, setForm] = useState({
    name: '',
    schoolName: '',
    email: '',
    phone: '',
    inquiryType: 'contact' as InquiryType,
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const intent = new URLSearchParams(location.search).get('intent');
    if (intent === 'demo') {
      setForm((prev) => ({ ...prev, inquiryType: 'demo' }));
    }
  }, [location.search]);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/platform-inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          schoolName: form.schoolName,
          email: form.email,
          phone: form.phone || null,
          inquiryType: form.inquiryType,
          message: form.message || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send message');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      alert((err as Error).message || 'Something went wrong. Please try WhatsApp or email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id={standalone ? undefined : 'contact'} className="scroll-mt-16 bg-[var(--surface-2)] px-4 py-16 sm:scroll-mt-20 sm:px-5 sm:py-20">
      <div className="mx-auto max-w-[1100px]">
        {!standalone ? (
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand)]">Contact ScholarNerve</p>
          <h2 className="scholar-display mt-2 text-3xl font-black text-[var(--ink)] sm:text-4xl">We&apos;re Here to Help</h2>
          <p className="mt-3 text-base text-[var(--ink-muted)]">
            Questions about pricing, demos, or onboarding? Send us a message — our team receives it directly.
          </p>
        </div>
        ) : (
        <div className="mx-auto max-w-2xl text-center">
          <p className="mt-3 text-base text-[var(--ink-muted)]">
            Questions about pricing, demos, or onboarding? Send us a message — our team receives it directly.
          </p>
        </div>
        )}

        <div className="mx-auto mt-10 grid max-w-[1100px] gap-8 lg:grid-cols-[1fr_340px]">
          <div className="rounded-2xl border border-[var(--sn-border)] bg-white p-6 shadow-[var(--shadow-premium)] sm:p-8">
            {submitted ? (
              <div className="py-8 text-center">
                <CheckCircle className="mx-auto h-14 w-14 text-emerald-600" />
                <h3 className="scholar-display mt-4 text-2xl font-bold text-[var(--ink)]">Message sent!</h3>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  Our team will reach out shortly. You can also start your free trial right away.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link to={REGISTER_SCHOOL_PATH} className="scholar-btn-primary">
                    Start free trial
                  </Link>
                  <Link to="/pricing" className="scholar-btn-secondary">
                    View pricing
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[var(--ink-muted)]">I&apos;m interested in</label>
                  <select value={form.inquiryType} onChange={update('inquiryType')} className={inputClass}>
                    <option value="contact">General contact</option>
                    <option value="demo">Book a free demo</option>
                    <option value="pricing">Pricing question</option>
                  </select>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)]">
                      <User className="h-4 w-4" /> Your name *
                    </label>
                    <input required value={form.name} onChange={update('name')} className={inputClass} placeholder="Your full name" />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)]">
                      <School className="h-4 w-4" /> School name
                    </label>
                    <input value={form.schoolName} onChange={update('schoolName')} className={inputClass} placeholder="School name" />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)]">
                      <Mail className="h-4 w-4" /> Email *
                    </label>
                    <input required type="email" value={form.email} onChange={update('email')} className={inputClass} placeholder="you@school.edu.gh" />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)]">
                      <Phone className="h-4 w-4" /> Phone
                    </label>
                    <input value={form.phone} onChange={update('phone')} className={inputClass} placeholder="+233 ..." />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--ink-muted)]">
                    <MessageSquare className="h-4 w-4" /> Message
                  </label>
                  <textarea
                    value={form.message}
                    onChange={update('message')}
                    className={`${inputClass} min-h-[120px] resize-y`}
                    placeholder="Tell us about your school, student count, or what you'd like to see in a demo..."
                  />
                </div>
                <button type="submit" disabled={submitting} className="scholar-btn-primary w-full sm:w-auto">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    'Send message'
                  )}
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--sn-border)] bg-white p-5 shadow-sm">
              <h3 className="scholar-display text-lg font-bold text-[var(--ink)]">Talk to us directly</h3>
              <div className="mt-4 space-y-3 text-sm">
                <a href={WHATSAPP_DEMO_URL} target="_blank" rel="noreferrer" className="block font-semibold text-[var(--brand-dark)] hover:underline">
                  WhatsApp: {SCHOLARNERVE_WHATSAPP}
                </a>
                <a href={SCHOLARNERVE_PHONE_TEL} className="block text-[var(--ink-muted)] hover:text-[var(--ink)]">
                  Call: {SCHOLARNERVE_PHONE}
                </a>
                <a href={`mailto:${SCHOLARNERVE_EMAIL}`} className="block text-[var(--ink-muted)] hover:text-[var(--ink)]">
                  {SCHOLARNERVE_EMAIL}
                </a>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <p className="text-sm font-semibold text-emerald-900">Prefer to start immediately?</p>
              <p className="mt-1 text-sm text-emerald-800/90">Register your school and get 2 months free — no card required.</p>
              <Link to={REGISTER_SCHOOL_PATH} className="scholar-btn-primary mt-4 inline-flex w-full justify-center sm:w-auto">
                Start free trial
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
