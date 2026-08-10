import React from 'react';
import LandingPageLayout from './LandingPageLayout';
import { LandingSeoHelmet } from './LandingSeoHelmet';
import ContactSection from '@/components/landing/ContactSection';

export default function ContactPage() {
  return (
    <LandingPageLayout>
      <LandingSeoHelmet
        title="Contact ScholarNerve – Get a Demo or Onboard Your School"
        description="Contact the ScholarNerve team. Get a demo, ask questions, or request onboarding for your school. We help Ghanaian and African schools go digital in 24 hours."
        keywords="contact ScholarNerve, school software demo Ghana, ScholarNerve support, onboard my school Africa"
        path="/contact"
        ogTitle="Contact ScholarNerve"
        ogDescription="Get in touch with the ScholarNerve team for demos, onboarding and support."
      />
      <section className="scholar-section bg-white px-4 pb-0 pt-10 sm:px-5 sm:pt-12">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="scholar-eyebrow">Contact</p>
          <h1 className="scholar-display scholar-section-title text-[var(--ink)]">
            Get in Touch with ScholarNerve
          </h1>
        </div>
      </section>
      <ContactSection standalone />
    </LandingPageLayout>
  );
}
