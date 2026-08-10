import React from 'react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import LandingBrandMark from '@/components/landing/LandingBrandMark';
import ScrollToTopButton from '@/components/landing/ScrollToTopButton';

export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="scholar-landing min-h-screen overflow-x-hidden">
      <LandingHeader brandMark={<LandingBrandMark className="h-full w-full" />} />
      <main className="pt-14 sm:pt-16">{children}</main>
      <LandingFooter />
      <ScrollToTopButton />
    </div>
  );
}
