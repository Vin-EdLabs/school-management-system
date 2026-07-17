import React, { useRef } from 'react';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { formatGhs } from '@/services/partnerApi';
import { usePartnerSession } from './partnerSession';
import {
  PartnerEmptyState, PartnerPage, PartnerPageHeader, LeadStatusBadge, PortalCard,
} from './partnerShared';
import ReferSchoolModal from './ReferSchoolModal';
import { PartnerListSkeleton } from './PartnerLoading';
import { usePartnerLeads, useInvalidatePartnerQueries } from './usePartnerQueries';
import PartnerIdCardShowcase from './PartnerIdCardShowcase';
import { Button } from '@/components/ui/button';
import { ReferralProgressTrack, SchoolMeetingLinkBlock } from './ReferralFollowUp';

export default function PartnerSchools() {
  const { partner, refresh } = usePartnerSession();
  const { data: leads = [], isLoading, isFetching, refetch } = usePartnerLeads();
  const { prependLead, invalidateLeads } = useInvalidatePartnerQueries();
  const [referOpen, setReferOpen] = React.useState(false);
  const pullStartY = useRef<number | null>(null);

  React.useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      pullStartY.current = window.scrollY <= 2 ? e.touches[0].clientY : null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (pullStartY.current === null) return;
      const delta = e.changedTouches[0].clientY - pullStartY.current;
      pullStartY.current = null;
      if (delta > 70 && window.scrollY <= 2) void refetch();
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [refetch]);

  if (isLoading) {
    return <PartnerListSkeleton rows={3} />;
  }

  return (
    <PartnerPage>
      <PartnerPageHeader
        title="My Schools"
        subtitle="Track each referral — demo links appear here when ScholarNerve schedules a meeting."
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-emerald-200 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {partner.status === 'approved' && partner.partnerId ? (
        <PartnerIdCardShowcase partner={partner} variant="compact" />
      ) : null}

      {isFetching && !isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="snp-skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <PartnerEmptyState
          icon={Building2}
          title="You haven't referred any schools yet"
          body='Tap "Refer School" to get started. When a demo is booked, the Google Meet or Zoom link will show on that school.'
          action={
            partner.status === 'approved' ? (
              <Button type="button" onClick={() => setReferOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" /> Refer School
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {leads.map((lead, i) => (
            <PortalCard
              key={lead.id}
              className="snp-fade-up p-4 sm:p-5"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15.5px] font-bold text-slate-900 dark:text-white">{lead.school_name}</p>
                  {lead.proprietor_name && (
                    <p className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">{lead.proprietor_name}</p>
                  )}
                </div>
                <LeadStatusBadge status={lead.status} />
              </div>

              <ReferralProgressTrack status={lead.status} />

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-slate-400 dark:text-slate-500">
                <span>
                  Submitted{' '}
                  {new Date(lead.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {lead.region && <span>{lead.region}</span>}
                {lead.demo_date && (
                  <span>
                    Demo date:{' '}
                    {new Date(lead.demo_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
                {lead.plan_amount && Number(lead.plan_amount) > 0 && (
                  <span>
                    Plan: {Number(lead.plan_amount) >= 400 ? 'Premium' : 'Starter'} {formatGhs(lead.plan_amount)}/mo
                  </span>
                )}
              </div>

              {lead.demo_meeting_url ? (
                <SchoolMeetingLinkBlock
                  schoolName={lead.school_name}
                  url={lead.demo_meeting_url}
                  demoDate={lead.demo_date}
                />
              ) : lead.status !== 'converted' && lead.status !== 'dead' ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  ScholarNerve may call this school directly, or you can follow up in person. When the demo is booked, the meeting link will appear here.
                </p>
              ) : null}

              {lead.status === 'converted' && Number(lead.monthly_commission) > 0 && (
                <div className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-950/40">
                  <span className="text-[13px] font-bold text-emerald-800 dark:text-emerald-300">
                    Your monthly commission:{' '}
                    <span className="text-[15px]">{formatGhs(lead.monthly_commission)}</span>
                  </span>
                </div>
              )}
            </PortalCard>
          ))}
        </div>
      )}

      {partner.status === 'approved' && leads.length > 0 && (
        <Button
          type="button"
          onClick={() => setReferOpen(true)}
          className="mt-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" /> Refer School
        </Button>
      )}

      <ReferSchoolModal
        open={referOpen}
        onClose={() => setReferOpen(false)}
        onSubmitted={(lead) => {
          prependLead(lead);
          void invalidateLeads();
          void refresh();
        }}
      />
    </PartnerPage>
  );
}
