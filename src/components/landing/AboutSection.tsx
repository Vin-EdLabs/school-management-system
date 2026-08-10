import React from 'react';
import { Link } from 'react-router-dom';
import { REGISTER_SCHOOL_PATH } from '@/utils/landingScroll';

type AboutSectionProps = {
  pageTitle?: string;
  embedded?: boolean;
};

export default function AboutSection({ pageTitle, embedded = false }: AboutSectionProps) {
  const HeadingTag = embedded ? 'h2' : 'h1';
  const heading = pageTitle ?? 'Your school deserves better tools.';

  return (
    <>
      {!embedded ? (
        <section className="scholar-section bg-white px-4 sm:px-5">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="scholar-eyebrow">About ScholarNerve</p>
            <HeadingTag className="scholar-display scholar-section-title text-[var(--ink)]">{heading}</HeadingTag>
            <p className="mx-auto mt-5 max-w-[620px] text-base font-light leading-7 text-[var(--ink-muted)] sm:text-lg sm:leading-8">
              ScholarNerve is a school management system for JHS and primary schools in Ghana covering student records,
              fee collection, attendance, grading, report cards, and parent communication in one secure platform — built
              to digitize school administration across Africa.
            </p>
            <p className="mx-auto mt-4 max-w-[620px] text-base font-light leading-7 text-[var(--ink-muted)]">
              Trusted by Light Preparatory, Victory International &amp; Rosa Gardens School Accra. Register today — we
              review every application and have your school set up and running within 24 hours.
            </p>
          </div>
        </section>
      ) : null}

      <section id={embedded ? 'about' : undefined} className="scholar-section relative overflow-hidden bg-[var(--ink)] px-4 text-center sm:px-5">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand)]/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/3 translate-y-1/3 rounded-full bg-[var(--brand)]/15 blur-3xl" />
        <div className="scroll-reveal relative mx-auto max-w-[760px]">
          <p className="scholar-eyebrow mx-auto border-white/10 bg-white/5 text-emerald-200">Get started in 24 hours</p>
          {embedded ? (
            <HeadingTag className="scholar-display scholar-section-title mt-2 text-white">{heading}</HeadingTag>
          ) : (
            <h2 className="scholar-display scholar-section-title mt-2 text-white">Your school deserves better tools.</h2>
          )}
          <p className="mx-auto mt-5 max-w-[620px] text-base font-light leading-7 text-white/60 sm:text-lg sm:leading-8">
            Register today. We review every application and have your school set up and running within 24 hours.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to={REGISTER_SCHOOL_PATH}
              className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-white px-7 py-3.5 font-semibold text-[var(--ink)] shadow-[0_18px_45px_rgba(255,255,255,0.12)] transition-transform hover:-translate-y-0.5"
            >
              Register Your School →
            </Link>
            <a
              href="tel:+233506741322"
              className="scholar-btn-secondary border-white/25 bg-transparent text-white/85 hover:border-white/50 hover:bg-white/5 hover:text-white"
            >
              Talk to us first
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
