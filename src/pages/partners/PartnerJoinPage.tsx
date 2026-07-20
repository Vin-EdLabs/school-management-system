import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import ScrollToTopButton from '@/components/landing/ScrollToTopButton';
import PartnersHeaderBrand from './PartnersHeaderBrand';
import PartnerRegistrationWizard from './PartnerRegistrationWizard';
import { getPartnersPortalLoginUrl } from '@/utils/partnersHost';
import './partners.css';

/** Public signup entry at partners.scholarnerve.com/join?ref=SN-XXX-XX */
export default function PartnerJoinPage() {
  useEffect(() => {
    document.title = 'Join ScholarNerve Partners';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="scholar-landing min-h-screen overflow-x-hidden">
      <LandingHeader
        brandMark={null}
        brandLockup={<PartnersHeaderBrand />}
        brandHref="/join"
        variant="partners"
      />

      <main className="pt-14 sm:pt-16">
        <section className="px-4 py-12 sm:px-5 sm:py-16">
          <div className="mx-auto max-w-[640px] text-center">
            <p className="scholar-eyebrow">ScholarNerve Partner Network</p>
            <h1 className="scholar-display scholar-section-title mt-3 text-[var(--ink)]">
              Create your partner account
            </h1>
            <p className="mt-3 text-[15px] font-light text-[var(--ink-muted)]">
              Complete the steps below to apply. Already approved?{' '}
              <a href={getPartnersPortalLoginUrl()} className="font-semibold text-[var(--brand-dark)] underline-offset-2 hover:underline">
                Sign in to your dashboard
              </a>
            </p>
          </div>
          <div className="mx-auto max-w-[640px]">
            <PartnerRegistrationWizard />
          </div>
          <p className="mx-auto mt-8 max-w-md text-center text-sm text-[var(--ink-subtle)]">
            <a href="/login" className="inline-flex items-center gap-1 font-semibold text-[var(--brand-dark)] hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to partner login
            </a>
          </p>
        </section>
      </main>

      <LandingFooter />
      <ScrollToTopButton />
    </div>
  );
}
