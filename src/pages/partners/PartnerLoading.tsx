import React from 'react';

export function PartnerSkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`snp-skeleton rounded-2xl ${className}`} />;
}

export function PartnerDashboardSkeleton() {
  return (
    <div className="snp-page mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:space-y-5 sm:p-6">
      <PartnerSkeletonBlock className="h-28" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PartnerSkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <PartnerSkeletonBlock className="h-44" />
    </div>
  );
}

export function PartnerListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="snp-page mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <PartnerSkeletonBlock className="h-10 w-40" />
        <PartnerSkeletonBlock className="h-10 w-10 rounded-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <PartnerSkeletonBlock key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function PartnerTrainingSkeleton() {
  return (
    <div className="snp-page mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:p-6">
      <PartnerSkeletonBlock className="h-10 w-36" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PartnerSkeletonBlock key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}

export function PartnerCommissionsSkeleton() {
  return (
    <div className="snp-page mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:p-6">
      <PartnerSkeletonBlock className="h-28" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <PartnerSkeletonBlock key={i} className="h-20" />
        ))}
      </div>
      <PartnerSkeletonBlock className="h-64" />
    </div>
  );
}

export function PartnerPortalSkeleton() {
  return (
    <div className="sn-partner-portal flex min-h-screen flex-col bg-[#F8FAFC] dark:bg-slate-950">
      <div className="snp-app-header border-b px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex-1 space-y-2">
            <PartnerSkeletonBlock className="h-5 w-36" />
            <PartnerSkeletonBlock className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <PartnerSkeletonBlock className="h-10 w-10 rounded-xl" />
            <PartnerSkeletonBlock className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>
      <PartnerDashboardSkeleton />
    </div>
  );
}

export function PartnerLoadingScreen() {
  return <PartnerPortalSkeleton />;
}
