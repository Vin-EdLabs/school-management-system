import React from 'react';
import LandingPageLayout from './LandingPageLayout';
import { LandingSeoHelmet } from './LandingSeoHelmet';
import PricingSection from '@/components/landing/PricingSection';

export default function PricingPage() {
  return (
    <LandingPageLayout>
      <LandingSeoHelmet
        title="Pricing – ScholarNerve | GHS 5 Per Student Per Term"
        description="ScholarNerve starts at GHS 5 per student per term — the most affordable school management software for Ghanaian and African private primary and JHS schools. No setup fees, no hidden charges. Get started free."
        keywords="ScholarNerve pricing, school management software price Ghana, affordable school software Africa, GHS 5 per student, school software cost Ghana"
        path="/pricing"
        ogTitle="Pricing – ScholarNerve | GHS 5 Per Student Per Term"
        ogDescription="Affordable school management starting at GHS 5 per student per term. No setup fees, no hidden charges."
      />
      <section className="scholar-section bg-white px-4 pb-4 pt-10 sm:px-5 sm:pt-12">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="scholar-eyebrow">Pricing</p>
          <h1 className="scholar-display scholar-section-title text-[var(--ink)]">
            Simple, Affordable Pricing for African Schools
          </h1>
        </div>
      </section>
      <PricingSection />
    </LandingPageLayout>
  );
}
