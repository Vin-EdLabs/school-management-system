import React, { useEffect } from 'react';
import LandingPageLayout from './LandingPageLayout';
import { LandingSeoHelmet } from './LandingSeoHelmet';
import { PartnersLandingSection } from '@/pages/partners/PartnersLandingPage';
import { getPartnersPortalLoginUrl } from '@/utils/partnersHost';
import '@/pages/partners/partners.css';

export default function PartnersPage() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.scroll-reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <LandingPageLayout>
      <LandingSeoHelmet
        title="Partner Network – ScholarNerve | Earn by Referring Schools"
        description="Join the ScholarNerve Partner Network and earn recurring commissions by referring schools across Africa. Become a Partner, Senior Partner, Team Leader or Regional Director. Get paid via MoMo."
        keywords="ScholarNerve partner network, refer schools earn commission, EdTech affiliate Ghana, school software partner Africa, MoMo commission Ghana"
        path="/partners"
        ogTitle="Partner Network – ScholarNerve | Earn by Referring Schools"
        ogDescription="Earn recurring commissions referring schools to ScholarNerve. Join Africa's fastest growing school management partner network."
      />
      <section className="scholar-section bg-[var(--surface-2)] px-4 pb-2 pt-8 sm:px-5 sm:pt-10">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="scholar-eyebrow">Partner Network</p>
          <h1 className="scholar-display scholar-section-title text-[var(--ink)]">
            Earn by Referring Schools to ScholarNerve
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--ink-muted)]">
            Introduce schools to ScholarNerve. Earn every month they stay — forever.
          </p>
          <a href={getPartnersPortalLoginUrl()} className="scholar-btn-primary mt-6 inline-flex items-center justify-center">
            Login to Partner Dashboard
          </a>
        </div>
      </section>
      <PartnersLandingSection hideHero />
    </LandingPageLayout>
  );
}
