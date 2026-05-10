import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GraduationCap, ArrowLeft, MapPin, Users, Calendar, Building2, Phone, Mail, User, Loader2, CheckCircle } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Warm accent gradients - same as landing page */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_30%_0%,rgba(34,197,94,0.12),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_20%,rgba(251,146,60,0.1),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_100%,rgba(34,197,94,0.08),transparent_50%)] pointer-events-none" />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center max-w-6xl">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">TECHNERVE</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">Back to Home</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative container mx-auto px-4 pt-20 pb-12 max-w-6xl">
        {submitted ? (
          <div className="min-h-[60dvh] flex items-center justify-center">
            <div className="text-center max-w-md mx-auto animate-in fade-in-0 zoom-in-95 duration-500">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Thank you!</h2>
              <p className="text-lg text-slate-600 mb-1">Your registration has been submitted successfully.</p>
              <p className="text-slate-500 text-sm mb-8">
                TECHNERVE will review your application and contact you within 24 hours. Check your email for next steps.
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
              <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-emerald-600 mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-slate-900">
                Register Your School
                <span className="block text-emerald-600">Join TECHNERVE</span>
              </h1>
              <p className="text-lg text-slate-600 mb-4 leading-relaxed">
                Complete the form below to request access. Our team will review your application and set up your school within 24 hours.
              </p>
              <div className="mb-6 p-4 rounded-xl bg-slate-100/80 border border-slate-200/60">
                <p className="text-sm font-semibold text-slate-800 mb-2">TECHNERVE School Management System</p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  A complete platform for schools to manage students, teachers, classes, fees, and finances in one place.
                  Includes enrollment, attendance, fee collection, receipts, payroll, reports, and custom branding.
                  Your school gets a secure, isolated environment with real-time dashboards and dedicated support.
                </p>
              </div>
              <ul className="space-y-3 text-slate-600">
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
              <div className="mt-10 rounded-2xl overflow-hidden shadow-xl shadow-slate-200/80 ring-1 ring-slate-200/50 hidden lg:block">
                <img
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&q=80"
                  alt="School"
                  className="w-full h-64 object-cover"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/30 p-8 md:p-10">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    School Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="schoolName" className="text-slate-700">School Name *</Label>
                      <Input
                        id="schoolName"
                        value={formData.schoolName}
                        onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                        className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                        placeholder="e.g. St. Mary's Academy"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="schoolAddress" className="text-slate-700 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" /> School Address
                      </Label>
                      <Input
                        id="schoolAddress"
                        value={formData.schoolAddress}
                        onChange={(e) => setFormData({ ...formData, schoolAddress: e.target.value })}
                        className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                        placeholder="Street, city, region"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="location" className="text-slate-700">Location / Region</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                          placeholder="e.g. Accra"
                        />
                      </div>
                      <div>
                        <Label htmlFor="studentCount" className="text-slate-700 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" /> Approx. Students
                        </Label>
                        <Input
                          id="studentCount"
                          type="number"
                          min="1"
                          value={formData.studentCount}
                          onChange={(e) => setFormData({ ...formData, studentCount: e.target.value })}
                          className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                          placeholder="e.g. 250"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="preferredStart" className="text-slate-700 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" /> Preferred Start Date
                      </Label>
                      <Input
                        id="preferredStart"
                        type="text"
                        value={formData.preferredStart}
                        onChange={(e) => setFormData({ ...formData, preferredStart: e.target.value })}
                        className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                        placeholder="e.g. Next term / ASAP"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    Primary Contact (Administrator)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="adminName" className="text-slate-700">Full Name *</Label>
                      <Input
                        id="adminName"
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-slate-700 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" /> Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                        placeholder="admin@school.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-slate-700 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" /> Phone
                      </Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1.5 bg-slate-50 border-slate-200 text-slate-900"
                        placeholder="+233 ..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="message" className="text-slate-700">Additional Information</Label>
                      <textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="mt-1.5 w-full min-h-[80px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="Any other details, questions, or special requirements..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 border-0"
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
                  <Button type="button" variant="outline" onClick={() => navigate('/')} className="border-slate-300">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <footer className="relative border-t border-slate-200 bg-white py-6 mt-16">
        <div className="container mx-auto px-4 max-w-6xl text-center text-slate-500 text-sm">
          © {new Date().getFullYear()} TECHNERVE. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default RegisterSchool;
