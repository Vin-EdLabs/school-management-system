import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  Building2,
  Phone,
  Mail,
  User,
  Loader2,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ScrollToTopButton from '@/components/landing/ScrollToTopButton';
import { REGISTER_FORM_ID, scrollToRegisterForm } from '@/utils/landingScroll';

const BENEFITS = [
  'Quick setup — we handle everything',
  'Dedicated support during onboarding',
  'Secure, isolated data for your school',
] as const;

const ONBOARDING_STEPS = [
  'We verify your school details',
  'We set up your secure portal',
  'Your admin receives access',
  'Teachers and parents can join',
] as const;

const inputClass = 'scholar-register-field w-full';

const RegisterSchool = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolAddress: '',
    location: '',
    studentCount: '',
    adminName: '',
    email: '',
    phone: '',
    message: '',
    preferredStart: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted || location.hash !== `#${REGISTER_FORM_ID}`) return;

    const timer = window.setTimeout(() => scrollToRegisterForm(), 80);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash, submitted]);

  const updateField = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const res = await fetch(`${base}/school-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: formData.schoolName,
          adminName: formData.adminName,
          email: formData.email,
          phone: formData.phone || null,
          message: [
            formData.schoolAddress && `Address: ${formData.schoolAddress}`,
            formData.location && `Location: ${formData.location}`,
            formData.studentCount && `Approx. students: ${formData.studentCount}`,
            formData.preferredStart && `Preferred start: ${formData.preferredStart}`,
            formData.message,
          ]
            .filter(Boolean)
            .join('\n') || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit');
      }
      setFormData({
        schoolName: '',
        schoolAddress: '',
        location: '',
        studentCount: '',
        adminName: '',
        email: '',
        phone: '',
        message: '',
        preferredStart: '',
      });
      setSubmitted(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to submit. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scholar-landing min-h-screen overflow-hidden bg-[var(--surface-2)] text-[var(--ink)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(13,158,117,0.16),transparent_60%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(13,158,117,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(13,158,117,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_top,black,transparent_72%)]" />

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--sn-border)] bg-white/90 backdrop-blur-[20px]">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 overflow-hidden rounded-[13px] bg-white shadow-lg shadow-emerald-950/15 ring-1 ring-[var(--sn-border)]">
              <img src="/android-chrome-192x192.png" alt="ScholarNerve" className="h-full w-full object-cover" />
            </span>
            <span className="scholar-display text-xl font-bold tracking-tight text-[var(--ink)]">ScholarNerve</span>
          </Link>
          <Link to="/">
            <Button
              variant="outline"
              className="rounded-full border-[var(--sn-border-strong)] bg-white text-[var(--ink-muted)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-dark)]"
            >
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative container mx-auto max-w-6xl px-4 pb-12 pt-28">
        {submitted ? (
          <div className="flex min-h-[60dvh] items-center justify-center">
            <div className="scholar-register-success">
              <div className="scholar-register-success-icon">
                <CheckCircle className="h-10 w-10" />
              </div>
              <p className="scholar-register-hero-badge mb-4">Application received</p>
              <h2 className="scholar-display text-2xl font-bold text-[var(--ink)] md:text-3xl">Thank you!</h2>
              <p className="mt-3 text-base leading-7 text-[var(--ink-muted)]">
                Your registration has been submitted successfully.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-subtle)]">
                ScholarNerve will review your application and contact you within 24 hours. Check your email for next steps.
              </p>
              <Link to="/" className="mt-8 inline-block">
                <Button className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-8 text-white hover:from-emerald-500 hover:to-teal-500">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
            <div className="lg:sticky lg:top-28">
              <Link
                to="/"
                className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--brand)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>

              <p className="scholar-register-hero-badge mb-4">
                <Building2 className="h-3.5 w-3.5" />
                School onboarding
              </p>
              <h1 className="scholar-display text-4xl font-extrabold tracking-tight text-[var(--ink)] md:text-5xl">
                Register Your School
                <span className="mt-1 block bg-gradient-to-r from-[var(--brand)] to-teal-600 bg-clip-text text-transparent">
                  Join ScholarNerve
                </span>
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-[var(--ink-muted)]">
                Complete the form to request access. Our team will review your application and set up your school within 24 hours.
              </p>

              <div className="mt-6 rounded-2xl border border-[var(--sn-border)] bg-white/85 p-5 shadow-sm backdrop-blur">
                <p className="text-sm font-bold text-[var(--ink)]">ScholarNerve School Management System</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                  Manage students, teachers, classes, fees, and finances in one secure platform — with enrollment, attendance,
                  receipts, payroll, reports, and custom branding for your school.
                </p>
              </div>

              <div className="mt-5 space-y-2.5">
                {BENEFITS.map((benefit) => (
                  <div key={benefit} className="scholar-register-benefit">
                    <span className="scholar-register-benefit-icon">✓</span>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 overflow-hidden rounded-[28px] border border-[var(--sn-border)] bg-[var(--ink)] p-6 text-white shadow-2xl shadow-emerald-950/10">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-light)]">Onboarding checklist</p>
                <div className="mt-4 space-y-2.5">
                  {ONBOARDING_STEPS.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white/80"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200">
                        {index + 1}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div id={REGISTER_FORM_ID} className="scholar-register-form-card scroll-mt-28">
              <div className="scholar-register-form-head">
                <div className="scholar-register-steps">
                  <span className="scholar-register-step is-active">1. School</span>
                  <span className="scholar-register-step is-active">2. Contact</span>
                  <span className="scholar-register-step">Submit</span>
                </div>
                <h2 className="scholar-display mt-4 text-2xl font-bold text-[var(--ink)]">Application form</h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  Fields marked with <span className="font-semibold text-[var(--brand-dark)]">*</span> are required.
                </p>
              </div>

              <div className="scholar-register-form-body">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <section className="scholar-register-section">
                    <h3 className="scholar-register-section-title">
                      <span className="scholar-register-section-icon">
                        <Building2 className="h-4 w-4" />
                      </span>
                      School information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="schoolName" className="scholar-register-label">
                          School name <span className="text-[var(--brand)]">*</span>
                        </Label>
                        <input
                          id="schoolName"
                          value={formData.schoolName}
                          onChange={updateField('schoolName')}
                          className={inputClass}
                          placeholder="e.g. St. Mary's Academy"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="schoolAddress" className="scholar-register-label">
                          <MapPin className="h-3.5 w-3.5" />
                          School address
                        </Label>
                        <input
                          id="schoolAddress"
                          value={formData.schoolAddress}
                          onChange={updateField('schoolAddress')}
                          className={inputClass}
                          placeholder="Street, city, region"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="location" className="scholar-register-label">
                            Location / region
                          </Label>
                          <input
                            id="location"
                            value={formData.location}
                            onChange={updateField('location')}
                            className={inputClass}
                            placeholder="e.g. Accra"
                          />
                        </div>
                        <div>
                          <Label htmlFor="studentCount" className="scholar-register-label">
                            <Users className="h-3.5 w-3.5" />
                            Approx. students
                          </Label>
                          <input
                            id="studentCount"
                            type="number"
                            min="1"
                            value={formData.studentCount}
                            onChange={updateField('studentCount')}
                            className={inputClass}
                            placeholder="e.g. 250"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="preferredStart" className="scholar-register-label">
                          <Calendar className="h-3.5 w-3.5" />
                          Preferred start date
                        </Label>
                        <input
                          id="preferredStart"
                          type="text"
                          value={formData.preferredStart}
                          onChange={updateField('preferredStart')}
                          className={inputClass}
                          placeholder="e.g. Next term / ASAP"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="scholar-register-section">
                    <h3 className="scholar-register-section-title">
                      <span className="scholar-register-section-icon">
                        <User className="h-4 w-4" />
                      </span>
                      Primary contact (administrator)
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="adminName" className="scholar-register-label">
                          Full name <span className="text-[var(--brand)]">*</span>
                        </Label>
                        <input
                          id="adminName"
                          value={formData.adminName}
                          onChange={updateField('adminName')}
                          className={inputClass}
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="scholar-register-label">
                          <Mail className="h-3.5 w-3.5" />
                          Email <span className="text-[var(--brand)]">*</span>
                        </Label>
                        <input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={updateField('email')}
                          className={inputClass}
                          placeholder="admin@school.com"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="scholar-register-label">
                          <Phone className="h-3.5 w-3.5" />
                          Phone
                        </Label>
                        <input
                          id="phone"
                          value={formData.phone}
                          onChange={updateField('phone')}
                          className={inputClass}
                          placeholder="+233 ..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="message" className="scholar-register-label">
                          Additional information
                        </Label>
                        <textarea
                          id="message"
                          value={formData.message}
                          onChange={updateField('message')}
                          className={`${inputClass} scholar-register-textarea`}
                          placeholder="Any other details, questions, or special requirements..."
                          rows={3}
                        />
                      </div>
                    </div>
                  </section>

                  <div className="scholar-register-actions">
                    <button type="submit" className="scholar-register-submit" disabled={submitting}>
                      {submitting ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Submitting...
                        </span>
                      ) : (
                        'Submit registration request'
                      )}
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/')}
                      className="h-12 rounded-full border-[var(--sn-border-strong)] bg-white px-7 text-[var(--ink-muted)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-dark)] sm:min-w-[8.5rem]"
                    >
                      Cancel
                    </Button>
                  </div>

                  <p className="scholar-register-trust">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-[var(--brand)]" />
                    Your details are sent securely. We only use them to set up and contact you about your school.
                  </p>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="relative mt-16 border-t border-[var(--sn-border)] bg-white py-6">
        <div className="container mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 text-center text-sm text-[var(--ink-subtle)]">
          <img src="/android-chrome-192x192.png" alt="" className="h-6 w-6 rounded-md" />
          © {new Date().getFullYear()} ScholarNerve. All rights reserved.
        </div>
      </footer>

      <ScrollToTopButton />
    </div>
  );
};

export default RegisterSchool;
