import React from 'react';
import { resolveWebsiteImageUrl } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal, SectionHeading } from '../SchoolWebsiteLayout';
import { SwFeaturedImage } from '../SwFeaturedImage';

export default function AboutPage() {
  const { accent, schoolName, data } = useSchoolWebsite();
  const about = data?.about || {};
  const coreValues = (about.core_values as string[]) || [];
  const directorPhoto = resolveWebsiteImageUrl(about.director_photo_url as string);
  const historyImg = resolveWebsiteImageUrl(about.history_image_url as string);
  const overviewImg = resolveWebsiteImageUrl(about.overview_image_url as string);

  const vmvCards = [
    { numeral: '01', title: 'Vision', body: about.vision as string, values: null as string[] | null },
    { numeral: '02', title: 'Mission', body: about.mission as string, values: null as string[] | null },
    {
      numeral: '03',
      title: 'Core Values',
      body: null,
      values: coreValues.length ? coreValues : null,
    },
  ].filter((c) => c.body || (c.values && c.values.length > 0));

  const hasHistory = about.history || historyImg;
  const hasOverview = about.institution_overview || overviewImg;
  const hasDirector =
    directorPhoto || about.director_message || about.director_name || about.director_title;

  return (
    <>
      <PageHero title="About Us" subtitle="Our story, values, and the people who lead us" />

      {hasHistory && (
        <section className="sw-section bg-white">
          <div className="sw-container grid items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <p className="sw-eyebrow">Our History</p>
              <h2 className="sw-serif mt-3 text-3xl leading-tight md:text-[40px]">Our story</h2>
              {about.history && (
                <div className="sw-prose mt-6" dangerouslySetInnerHTML={{ __html: String(about.history) }} />
              )}
            </Reveal>
            {historyImg && (
              <Reveal delay={120}>
                <SwFeaturedImage src={historyImg} alt="Our campus" variant="history" />
              </Reveal>
            )}
          </div>
        </section>
      )}

      {hasOverview && (
        <section className="sw-section bg-white !pt-0">
          <div className="sw-container grid items-center gap-14 lg:grid-cols-2">
            {overviewImg && (
              <Reveal className="order-2 lg:order-1" delay={120}>
                <SwFeaturedImage src={overviewImg} alt="Learning at our school" variant="overview" />
              </Reveal>
            )}
            <Reveal className={overviewImg ? 'order-1 lg:order-2' : undefined}>
              <p className="sw-eyebrow">Who we are today</p>
              <h2 className="sw-serif mt-3 text-3xl leading-tight md:text-[40px]">A community built on care</h2>
              {about.institution_overview && (
                <div
                  className="sw-prose mt-6"
                  dangerouslySetInnerHTML={{ __html: String(about.institution_overview) }}
                />
              )}
            </Reveal>
          </div>
        </section>
      )}

      {vmvCards.length > 0 && (
        <section className="sw-section sw-section-gold">
          <div className="sw-container">
            <Reveal>
              <SectionHeading eyebrow="What guides us" title="Vision, mission & values" centered />
            </Reveal>
            <div className="grid gap-6 md:grid-cols-3">
              {vmvCards.map((card, i) => (
                <Reveal key={card.title} delay={i * 100}>
                  <div className="sw-card relative h-full overflow-hidden p-8">
                    <span
                      className="sw-serif pointer-events-none absolute -right-2 -top-6 select-none text-[110px] leading-none"
                      style={{ color: 'color-mix(in srgb, var(--sw-primary) 10%, transparent)' }}
                      aria-hidden
                    >
                      {card.numeral}
                    </span>
                    <h3 className="sw-serif relative text-2xl" style={{ color: accent }}>
                      {card.title}
                    </h3>
                    {card.values ? (
                      <ul className="relative mt-5 space-y-2.5 text-sm" style={{ color: 'var(--sw-muted)' }}>
                        {card.values.map((v) => (
                          <li key={v} className="flex items-center gap-2.5">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--sw-gold)' }} />
                            {v}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="relative mt-5 text-sm leading-relaxed" style={{ color: 'var(--sw-muted)' }}>
                        {card.body}
                      </p>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {hasDirector && (
        <section className="sw-section bg-white">
          <div className="sw-container grid items-center gap-14 lg:grid-cols-[340px,1fr]">
            {directorPhoto && (
              <Reveal>
                <div className="relative mx-auto max-w-[340px]">
                  <img
                    src={directorPhoto}
                    alt={(about.director_name as string) || 'Head of School'}
                    loading="lazy"
                    className="w-full rounded-xl object-cover shadow-lg"
                    style={{ aspectRatio: '4 / 5' }}
                  />
                  <div
                    className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-xl"
                    style={{ border: '3px solid var(--sw-gold)' }}
                    aria-hidden
                  />
                </div>
              </Reveal>
            )}
            <Reveal delay={120}>
              {about.director_message && (
                <>
                  <span className="sw-serif block text-[90px] leading-[0.5] text-[var(--sw-gold)]" aria-hidden>
                    “
                  </span>
                  <blockquote
                    className="sw-serif mt-4 text-2xl font-semibold italic leading-snug md:text-[32px]"
                    dangerouslySetInnerHTML={{ __html: String(about.director_message) }}
                  />
                </>
              )}
              {(about.director_name || about.director_title) && (
                <div className="mt-8 flex items-center gap-4">
                  <span className="h-px w-12" style={{ background: 'var(--sw-gold)' }} />
                  <div>
                    {about.director_name && (
                      <p className="font-semibold" style={{ color: 'var(--sw-text)' }}>
                        {String(about.director_name)}
                      </p>
                    )}
                    {about.director_title && (
                      <p className="text-sm" style={{ color: 'var(--sw-muted)' }}>
                        {String(about.director_title)}
                        {about.director_name ? `, ${schoolName}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Reveal>
          </div>
        </section>
      )}
    </>
  );
}
