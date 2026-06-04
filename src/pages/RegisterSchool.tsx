import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Users, Calendar, Building2, Phone, Mail, User, Loader2, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const RegisterSchool = () => {
  const navigate = useNavigate();
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
          ].filter(Boolean).join('\n') || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit');
      }
      setFormData({ schoolName: '', schoolAddress: '', location: '', studentCount: '', adminName: '', email: '', phone: '', message: '', preferredStart: '' });
      setSubmitted(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to submit. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scholar-landing min-h-screen overflow-hidden bg-[var(--surface-2)] text-[var(--ink)]">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(13,158,117,0.16),transparent_60%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(13,158,117,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(13,158,117,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_top,black,transparent_72%)] pointer-events-none" />

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--sn-border)] bg-white/90 backdrop-blur-[20px]">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 overflow-hidden rounded-[13px] bg-white shadow-lg shadow-emerald-950/15 ring-1 ring-[var(--sn-border)]">
              <img src="/android-chrome-192x192.png" alt="ScholarNerve" className="h-full w-full object-cover" />
            </span>
            <span className="scholar-display text-xl font-bold tracking-tight text-[var(--ink)]">ScholarNerve</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" className="rounded-full border-[var(--sn-border-strong)] bg-white text-[var(--ink-muted)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-dark)] dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-50">
                Back to Home
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative container mx-auto max-w-6xl px-4 pb-12 pt-28">
        {submitted ? (
          <div className="min-h-[60dvh] flex items-center justify-center">
            <div className="text-center max-w-md mx-auto animate-in fade-in-0 zoom-in-95 duration-500">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="scholar-display text-2xl font-bold text-[var(--ink)] md:text-3xl">Thank you!</h2>
              <p className="mb-1 mt-2 text-lg text-[var(--ink-muted)]">Your registration has been submitted successfully.</p>
              <p className="mb-8 text-sm text-[var(--ink-subtle)]">
                SCHOLARNERVE will review your application and contact you within 24 hours. Check your email for next steps.
              </p>
              <Link to="/">
                <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--brand)]">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
              <h1 className="scholar-display mb-4 text-4xl font-extrabold tracking-tight text-[var(--ink)] md:text-5xl">
                Register Your School
                <span className="block text-[var(--brand)]">Join ScholarNerve</span>
              </h1>
              <p className="mb-5 text-lg leading-relaxed text-[var(--ink-muted)]">
                Complete the form below to request access. Our team will review your application and set up your school within 24 hours.
              </p>
              <div className="mb-6 rounded-2xl border border-[var(--sn-border)] bg-white/80 p-5 shadow-sm backdrop-blur">
                <p className="mb-2 text-sm font-bold text-[var(--ink)]">ScholarNerve School Management System</p>
                <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
                  A complete platform for schools to manage students, teachers, classes, fees, and finances in one place.
                  Includes enrollment, attendance, fee collection, receipts, payroll, reports, and custom branding.
                  Your school gets a secure, isolated environment with real-time dashboards and dedicated support.
                </p>
              </div>
              <ul className="space-y-3 text-[var(--ink-muted)]">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Quick setup — we handle everything</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Dedicated support during onboarding</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Secure, isolated data for your school</span>
                </li>
              </ul>
              <div className="mt-10 hidden overflow-hidden rounded-[28px] border border-[var(--sn-border)] bg-[var(--ink)] p-7 text-white shadow-2xl shadow-emerald-950/10 lg:block">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-light)]">Onboarding checklist</p>
                <div className="mt-5 space-y-3">
                  {['We verify your school details', 'We set up your secure portal', 'Your admin receives access', 'Teachers and parents can join'].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white/75">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--sn-border)] bg-white p-6 shadow-[0_24px_70px_rgba(8,80,65,0.12)] md:p-10">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    School Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="schoolName" className="text-[var(--ink-muted)]">School Name *</Label>
                      <Input
                        id="schoolName"
                        value={formData.schoolName}
                        onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                        className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                        placeholder="e.g. St. Mary's Academy"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="schoolAddress" className="flex items-center gap-2 text-[var(--ink-muted)]">
                        <MapPin className="w-3.5 h-3.5" /> School Address
                      </Label>
                      <Input
                        id="schoolAddress"
                        value={formData.schoolAddress}
                        onChange={(e) => setFormData({ ...formData, schoolAddress: e.target.value })}
                        className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                        placeholder="Street, city, region"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="location" className="text-[var(--ink-muted)]">Location / Region</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                          placeholder="e.g. Accra"
                        />
                      </div>
                      <div>
                        <Label htmlFor="studentCount" className="flex items-center gap-2 text-[var(--ink-muted)]">
                          <Users className="w-3.5 h-3.5" /> Approx. Students
                        </Label>
                        <Input
                          id="studentCount"
                          type="number"
                          min="1"
                          value={formData.studentCount}
                          onChange={(e) => setFormData({ ...formData, studentCount: e.target.value })}
                          className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                          placeholder="e.g. 250"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="preferredStart" className="flex items-center gap-2 text-[var(--ink-muted)]">
                        <Calendar className="w-3.5 h-3.5" /> Preferred Start Date
                      </Label>
                      <Input
                        id="preferredStart"
                        type="text"
                        value={formData.preferredStart}
                        onChange={(e) => setFormData({ ...formData, preferredStart: e.target.value })}
                        className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                        placeholder="e.g. Next term / ASAP"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <User className="w-4 h-4 text-emerald-600" />
                    Primary Contact (Administrator)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="adminName" className="text-[var(--ink-muted)]">Full Name *</Label>
                      <Input
                        id="adminName"
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="flex items-center gap-2 text-[var(--ink-muted)]">
                        <Mail className="w-3.5 h-3.5" /> Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                        placeholder="admin@school.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="flex items-center gap-2 text-[var(--ink-muted)]">
                        <Phone className="w-3.5 h-3.5" /> Phone
                      </Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1.5 border-emerald-100 bg-white text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                        placeholder="+233 ..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="message" className="text-[var(--ink-muted)]">Additional Information</Label>
                      <textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="mt-1.5 min-h-[96px] w-full rounded-md border border-emerald-100 bg-white px-3 py-2 text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-100 dark:bg-white dark:text-slate-950"
                        placeholder="Any other details, questions, or special requirements..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    className="h-12 flex-1 rounded-full border-0 bg-[var(--brand)] text-white shadow-lg shadow-emerald-500/25 hover:bg-[var(--brand-dark)]"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Registration Request'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/')}
                    className="h-12 rounded-full border-[var(--sn-border-strong)] bg-white px-7 text-[var(--ink-muted)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-dark)] dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-50"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
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
    </div>
  );
};

export default RegisterSchool;
