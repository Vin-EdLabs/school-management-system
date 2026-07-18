import React, { useState } from 'react';
import { ChevronDown, Scale, School, Shield } from 'lucide-react';
import { PortalCard } from './partnerShared';
import { cn } from '@/lib/utils';

const HOW_IT_WORKS = [
  {
    title: 'Apply and get approved',
    body: 'Fill your application on scholarnerve.com/#partners. The ScholarNerve team reviews it within 48 hours. Once approved you receive your official Partner ID and full dashboard access.',
  },
  {
    title: 'Complete your training',
    body: 'Watch the short training videos in your dashboard. Join a strategy session with the ScholarNerve team. You will know exactly what to say and how to introduce the platform confidently.',
  },
  {
    title: 'Visit schools and spark interest',
    body: 'Go to schools in your area. Share the one-pager we give you. Show the 90-second demo video on your phone. Your only goal is to get the proprietor to agree to a 30-minute Zoom call.',
  },
  {
    title: 'ScholarNerve closes the deal',
    body: 'We handle the Zoom demo, pricing conversation, and full onboarding. The school gets linked to your Partner ID automatically.',
  },
  {
    title: 'Earn every month',
    body: 'Once the school starts paying you earn 50% for the first 2 months then 30% every month after — for as long as that school remains active. The more schools in your portfolio the higher your monthly income.',
  },
];

const RULES: { title: string; body: string }[] = [
  {
    title: 'Your account is yours alone',
    body: 'Never share your login or Partner ID with anyone. Your account is personal and non-transferable.',
  },
  {
    title: 'Always refer schools through your dashboard',
    body: 'Every school must be logged via the Refer School button. Schools not submitted through the system will not be counted or paid.',
  },
  {
    title: 'First submission wins',
    body: 'The Partner who submits a school first owns that relationship. Do not submit schools already referred by another Partner.',
  },
  {
    title: 'No unofficial promises',
    body: 'Never promise schools a price, feature, or timeline that ScholarNerve has not confirmed. All pricing is set by ScholarNerve only.',
  },
  {
    title: 'No side deals',
    body: "Do not offer schools discounts or arrangements outside of ScholarNerve's official pricing. This results in immediate suspension.",
  },
  {
    title: 'Complete your training first',
    body: 'All Partners must watch the training videos before referring schools. Untrained Partners are less effective and may misrepresent the platform.',
  },
  {
    title: 'Keep your MoMo details updated',
    body: 'ScholarNerve is not responsible for failed payouts due to wrong or outdated MoMo information on your profile.',
  },
  {
    title: 'Represent ScholarNerve professionally',
    body: 'You are a Partner — not an employee or manager of ScholarNerve. Introduce yourself accordingly and treat every school proprietor with respect.',
  },
  {
    title: 'Your commission depends on school retention',
    body: 'If a school you referred cancels, your commission for that school stops. Stay in touch with your schools and encourage them to keep using the platform.',
  },
  {
    title: 'Violations lead to suspension',
    body: 'Poaching leads, false submissions, misrepresenting ScholarNerve, or any dishonest conduct will result in immediate account suspension with no commission payout for pending earnings.',
  },
];

function AccordionSection({
  title,
  icon: Icon,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = `partner-section-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <PortalCard className="overflow-hidden !p-0">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 sm:px-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900">
          <Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block text-base font-bold text-slate-900 dark:text-white">{title}</span>
          {hint ? (
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'mt-2 h-5 w-5 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-trigger`}
          className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 sm:px-5"
        >
          {children}
        </div>
      ) : null}
    </PortalCard>
  );
}

/** How-it-works + rules — tap each card to expand all content inside. */
export default function PartnerHomeSections() {
  const [howOpen, setHowOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="space-y-3">
      <AccordionSection
        title="How the Partner Program Works"
        icon={School}
        hint="Tap to read all steps — available while your application is reviewed."
        open={howOpen}
        onToggle={() => setHowOpen((v) => !v)}
      >
        <ol className="space-y-4">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </AccordionSection>

      <AccordionSection
        title="ScholarNerve Partner Rules"
        icon={Scale}
        hint="Tap to read all rules — please review these before you start referring schools."
        open={rulesOpen}
        onToggle={() => setRulesOpen((v) => !v)}
      >
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <Shield className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Short, clear, and firm — every Partner agrees to these rules.
          </p>
        </div>
        <ol className="space-y-4">
          {RULES.map((rule, i) => (
            <li key={rule.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{rule.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{rule.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </AccordionSection>
    </div>
  );
}
