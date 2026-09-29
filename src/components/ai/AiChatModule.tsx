import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bot,
  Sparkles,
  Zap,
  Brain,
  MessageSquare,
  FileText,
  BarChart3,
  Calculator,
  ShieldAlert,
  Compass,
  Bus,
  CheckCircle2,
  Lock,
  Layers,
  Cpu,
} from 'lucide-react';
import { cn } from "@/lib/utils";

const UPCOMING_CAPABILITIES = [
  {
    icon: Calculator,
    title: 'Autonomous Fee Reconciliation',
    description: 'Natural language payment logging, automated receipt generation, and intelligent fee recovery alerts.',
    badge: 'Finance Core',
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-500 border-emerald-500/20',
  },
  {
    icon: Brain,
    title: 'Predictive Academic Diagnostics',
    description: 'Intelligent analysis tracking student grade trajectories to alert teachers of performance dips before major exams.',
    badge: 'Academics',
    color: 'from-violet-500/20 to-purple-500/10 text-violet-500 border-violet-500/20',
  },
  {
    icon: FileText,
    title: 'Instant Terminal Report Remarks',
    description: 'Auto-craft personalized, comprehensive student remarks aligned with Ghanaian (GES) and international curricula.',
    badge: 'Reporting',
    color: 'from-blue-500/20 to-indigo-500/10 text-blue-500 border-blue-500/20',
  },
  {
    icon: MessageSquare,
    title: 'Automated Parent Communications',
    description: 'Multilingual SMS and messaging to answer common parent inquiries, send term dates, and deliver fee reminders.',
    badge: 'Communication',
    color: 'from-amber-500/20 to-orange-500/10 text-amber-500 border-amber-500/20',
  },
  {
    icon: Bus,
    title: 'Dynamic Fleet & Transport AI',
    description: 'Real-time GPS route balancing, student pickup sequence optimization, and vehicle maintenance forecasting.',
    badge: 'Logistics',
    color: 'from-rose-500/20 to-pink-500/10 text-rose-500 border-rose-500/20',
  },
  {
    icon: BarChart3,
    title: 'Executive Financial Auditing',
    description: 'Natural language queries to audit monthly income, verify bank deposits, and highlight financial anomalies.',
    badge: 'Compliance',
    color: 'from-cyan-500/20 to-blue-500/10 text-cyan-500 border-cyan-500/20',
  },
];

const DEVELOPMENT_MILESTONES = [
  {
    quarter: 'Phase 1 • Q3 2026',
    title: 'Financial & Ledger Copilot',
    status: 'In Development',
    progress: 85,
    summary: 'Natural language fee queries, instant receipt verification, and automated debt reconciliation.',
  },
  {
    quarter: 'Phase 2 • Q4 2026',
    title: 'Academic Diagnostics & Remarks',
    status: 'Planned',
    progress: 40,
    summary: 'Automated teacher report card remark generation and student exam trajectory forecasts.',
  },
  {
    quarter: 'Phase 3 • Q1 2027',
    title: 'Parent Messaging & Voice Assistant',
    status: 'Planned',
    progress: 15,
    summary: 'Automated WhatsApp parent alerts, voice attendance logging, and autonomous bus dispatching.',
  },
];

export const AiChatModule: React.FC = () => {
  const { hasAccess } = useAuth();

  if (!hasAccess('ai-assistant')) {
    return (
      <div className="flex items-center justify-center min-h-[500px] p-6">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 mx-auto mb-5 bg-rose-50 dark:bg-rose-950/50 rounded-2xl flex items-center justify-center text-rose-500 shadow-inner border border-rose-200 dark:border-rose-900">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Only authorized administrator and finance leadership accounts have access to the AI intelligence preview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-violet-500/10 dark:bg-violet-500/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Hero Showcase Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-indigo-200/60 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 text-white shadow-2xl p-6 sm:p-8 lg:p-10">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Bot className="w-64 h-64 text-indigo-400" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300 animate-spin" style={{ animationDuration: '8s' }} />
            <span>ScholarNerve AI Copilot • Under Active Development</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15]">
            Next-Gen School Intelligence <br />
            <span className="bg-gradient-to-r from-blue-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent">
              Coming in a Future Update
            </span>
          </h1>

          <p className="text-sm sm:text-base text-indigo-100/80 leading-relaxed max-w-2xl font-normal">
            We are engineering an autonomous artificial intelligence engine built specifically for institutional school operations.
            From natural language fee reconciliation to predictive academic insights, the AI assistant will simplify repetitive administrative tasks when launched.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold backdrop-blur-md">
              <Cpu className="w-4 h-4 text-indigo-300" />
              <span>Institutional Model Training in Progress</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-medium backdrop-blur-md">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bank-Grade School Data Encryption</span>
            </div>
          </div>
        </div>
      </div>

      {/* Core Upcoming Capabilities */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Upcoming Capabilities
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            A preview of the automated workflows being engineered for school leadership, bursars, and teachers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {UPCOMING_CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <Card
                key={i}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 shadow-sm hover:shadow-md transition-all duration-300 group"
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border bg-gradient-to-br shadow-inner", cap.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {cap.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {cap.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {cap.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Launch Roadmap & Phasing */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-500" />
              Development Roadmap
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Phased architecture ensuring strict data privacy, curriculum alignment, and high accuracy.
            </p>
          </div>

          <Badge variant="outline" className="self-start sm:self-auto text-xs px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 font-semibold">
            Feature Rollout Schedule
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEVELOPMENT_MILESTONES.map((m, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {m.quarter}
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {m.progress}%
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  {m.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {m.summary}
                </p>
              </div>

              {/* Progress track */}
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full"
                  style={{ width: `${m.progress}%` }}
                />
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span className={cn("w-1.5 h-1.5 rounded-full", m.progress > 80 ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                <span>Status: {m.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Notice Banner */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 via-violet-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:via-slate-900 dark:to-purple-950/30 p-5 flex items-center gap-3.5 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
            Zero Configuration Required by School Staff
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            When this module is officially released, it will automatically connect to your school's existing students, fee records, and attendance data without requiring manual setup.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiChatModule;
