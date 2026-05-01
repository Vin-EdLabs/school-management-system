import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, Shield, BarChart3, Users, Zap, CheckCircle, ArrowRight, Mail, Phone, Award, UserCircle, BookOpen } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Warm accent gradients */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_30%_0%,rgba(34,197,94,0.12),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_20%,rgba(251,146,60,0.1),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_100%,rgba(34,197,94,0.08),transparent_50%)] pointer-events-none" />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center max-w-6xl">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">SCHOLARNERVE</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/register-school">
              <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 border-0 font-semibold px-6">
                Register School
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative pt-20">
        <section className="container mx-auto px-4 pt-12 pb-20 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.15] text-slate-900">
                Everything your school needs
                <span className="block text-emerald-600">in one place</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-xl mb-6 leading-relaxed">
                TECHNERVE School Management System is a complete platform for schools. Manage students, teachers, classes, fees, and finances in one place—with enrollment, attendance, grading, fee collection, receipts, payroll, and reports.
              </p>
              <p className="text-slate-600 max-w-xl mb-8 leading-relaxed">
                Dedicated <span className="font-medium text-slate-800">Teacher Portal</span> and <span className="font-medium text-slate-800">Parent Portal</span> keep everyone connected. Your school gets a secure, isolated environment with real-time dashboards, custom branding, and dedicated support.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register-school">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-6 text-lg h-auto rounded-xl shadow-xl shadow-emerald-500/30 border-0 group">
                    Get Started
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/80 ring-1 ring-slate-200/50">
                <img
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80"
                  alt="Students in classroom"
                  className="w-full h-[320px] md:h-[400px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent pointer-events-none" />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl p-4 border border-slate-100">
                <p className="text-sm font-semibold text-slate-800">500+ Schools</p>
                <p className="text-xs text-slate-500">Trust SCHOLARNERVE daily</p>
              </div>
            </div>
          </div>
        </section>

        {/* System overview */}
        <section className="py-16 relative">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 p-8 md:p-10 shadow-sm">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                TECHNERVE School Management System
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                A complete platform for schools to manage students, teachers, classes, fees, and finances in one place. Includes enrollment, attendance, <strong>grading</strong>, fee collection, receipts, payroll, reports, and custom branding.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Dedicated <strong>Teacher Portal</strong> for classes, grades, and attendance—and <strong>Parent Portal</strong> for fee status and student progress. Your school gets a secure, isolated environment with real-time dashboards and dedicated support.
              </p>
            </div>
          </div>
        </section>

        {/* Features with imagery */}
        <section className="border-y border-slate-200/80 bg-white py-24 relative">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-900">
              Everything you need
            </h2>
            <p className="text-slate-600 text-center max-w-2xl mx-auto mb-16">
              One platform to run your school—admin, teachers, and parents all stay connected.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: Users, title: 'Student Management', desc: 'Enrollment, records, and progress tracking all in one place', img: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&q=80' },
                { icon: GraduationCap, title: 'Teacher Portal', desc: 'Dedicated portal for teachers—classes, attendance, grades, and payment history', img: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=80' },
                { icon: UserCircle, title: 'Parent Portal', desc: 'Parents view fee status, receipts, and student progress anytime', img: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&q=80' },
                { icon: Award, title: 'Grading & Reports', desc: 'Record grades, generate report cards, and track academic progress', img: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80' },
                { icon: BarChart3, title: 'Fees & Finance', desc: 'Fee structures, payments, receipts, payroll, and financial reports', img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80' },
                { icon: Shield, title: 'Secure & Private', desc: "Each school's data is completely isolated and encrypted", img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&q=80' },
                { icon: Zap, title: 'Real-time Dashboards', desc: 'Live insights at a glance—enrollment, fees, attendance', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80' },
                { icon: CheckCircle, title: 'Custom Branding', desc: 'Your logo, colors, and identity across the platform', img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80' },
                { icon: BookOpen, title: 'Classes & Timetables', desc: 'Manage classes, assign teachers, track timetables', img: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80' },
              ].map(({ icon: Icon, title, desc, img }) => (
                <div
                  key={title}
                  className="group rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/80 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300"
                >
                  <div className="h-40 overflow-hidden">
                    <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-slate-900">{title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA with image */}
        <section className="py-24 relative">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 p-12 md:p-16 relative">
              <img
                src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=1200&q=80"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20"
              />
              <div className="relative text-center max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                  Ready to get started?
                </h2>
                <p className="text-emerald-100 mb-8 text-lg">
                  Register your school today. New schools are reviewed and receive access within 24 hours.
                </p>
                <Link to="/register-school">
                  <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 px-10 py-6 text-lg h-auto rounded-xl font-semibold shadow-xl">
                    Register Your School
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-slate-200 bg-white py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <a
                href="mailto:info@technerve.com"
                className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</p>
                  <p className="font-medium text-slate-800">info@technerve.com</p>
                </div>
              </a>
              <div className="flex flex-col gap-4">
                <a
                  href="tel:+233531932399"
                  className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Support</p>
                    <p className="font-medium text-slate-800">+233 53 193 2399</p>
                  </div>
                </a>
                <a
                  href="tel:+233557609106"
                  className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Direct</p>
                    <p className="font-medium text-slate-800">0557609106</p>
                  </div>
                </a>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-slate-500 text-sm">
                © {new Date().getFullYear()} TECHNERVE. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
