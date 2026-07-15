import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, CalendarDays, Clock, GraduationCap, Layers, MapPin, TrendingUp, Users } from 'lucide-react';
import { resolveWebsiteImageUrl, type WebsiteHomeContent } from '@/services/schoolWebsiteService';
import { formatDisplayDate } from '@/utils/dateFormat';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { Reveal, SectionHeading } from '../SchoolWebsiteLayout';
import { SwFramedImage } from '../SwFramedImage';

const HIGHLIGHT_ICONS = [BookOpen, Users, Award, GraduationCap];

function renderWelcomeHeading(heading: string, accentWord: string) {
  if (!accentWord || !heading.includes(accentWord)) return heading;
  const idx = heading.indexOf(accentWord);
  return (
    <>
      {heading.slice(0, idx)}
      <span className="sw-underline-gold">{accentWord}</span>
      {heading.slice(idx + accentWord.length)}
    </>
  );
}

function formatStatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function formatEventTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h)) return time;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

function eventDayParts(eventDate: string) {
  const d = new Date(`${eventDate}T00:00:00`);
  return {
    day: d.toLocaleDateString(undefined, { day: 'numeric' }),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
  };
}

export default function HomePage() {
  const { accent, schoolName, data } = useSchoolWebsite();
  const site = data?.website;
  const home = (site?.home_content || {}) as WebsiteHomeContent;
  const banner = resolveWebsiteImageUrl(site?.banner_image_url);
  const welcomeImg = resolveWebsiteImageUrl(site?.welcome_image_url);
  const welcomeImgSm = resolveWebsiteImageUrl(site?.welcome_image_secondary_url);
  const stats = site?.stats || {};
  const highlights = (site?.highlights || []).filter((h) => h.title?.trim()).slice(0, 4);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (data?.events || [])
      .filter((e) => new Date(`${e.event_date}T00:00:00`) >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 3);
  }, [data?.events]);

  const statCards = [
    { icon: CalendarDays, value: formatStatValue(stats.founded_year), label: 'Founded' },
    { icon: Users, value: stats.student_count != null ? String(stats.student_count) : null, label: 'Students' },
    {
      icon: Layers,
      value: formatStatValue(stats.programs_count) ?? (data?.classes?.length ? String(data.classes.length) : null),
      label: 'Programs',
    },
    { icon: TrendingUp, value: formatStatValue(stats.pass_rate), label: 'Pass Rate' },
  ].filter((s) => s.value);

  const showWelcome =
    welcomeImg ||
    welcomeImgSm ||
    site?.welcome_text ||
    home.welcome_heading ||
    home.welcome_link_text;

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        {banner ? (
          <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--sw-navy) 0%, var(--sw-primary) 100%)' }} />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(12,35,64,0.88) 0%, rgba(12,35,64,0.52) 60%, transparent 100%)',
          }}
        />

        <div className="sw-container relative z-10 py-28 text-center md:text-left">
          {home.enrolment_label && (
            <Reveal>
              <span className="sw-gold-pill">{home.enrolment_label}</span>
            </Reveal>
          )}
          <Reveal delay={100}>
            <h1 className="sw-serif mt-6 max-w-3xl text-[40px] leading-[1.05] !text-white md:text-[72px]">
              {schoolName}
            </h1>
          </Reveal>
          {site?.tagline && (
            <Reveal delay={200}>
              <p className="mx-auto mt-4 max-w-[480px] text-lg leading-relaxed text-white/80 md:mx-0">{site.tagline}</p>
            </Reveal>
          )}
          <Reveal delay={300}>
            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center md:justify-start">
              <Link to="/admissions" className="sw-btn sw-btn-primary">
                Apply Now
              </Link>
              <Link to="/about" className="sw-btn sw-btn-ghost">
                Explore School
              </Link>
            </div>
          </Reveal>
        </div>

        <svg
          className="absolute bottom-0 left-0 z-10 w-full"
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ height: 70 }}
        >
          <path d="M0,56 C240,92 480,20 760,34 C1040,48 1240,84 1440,52 L1440,90 L0,90 Z" fill="#ffffff" />
        </svg>
      </section>

      {/* ============ STATS STRIP ============ */}
      {statCards.length > 0 && (
        <section className="bg-white pb-16 pt-6 md:pt-10">
          <div className="sw-container">
            <Reveal>
              <div className="grid grid-cols-2 md:grid-cols-4">
                {statCards.map(({ icon: Icon, value, label }, i) => (
                  <div
                    key={label}
                    className="flex flex-col items-center px-4 py-8 text-center"
                    style={{ borderLeft: i > 0 ? '1px solid var(--sw-border)' : undefined }}
                  >
                    <span className="sw-icon-circle mb-4">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="sw-serif text-[42px] leading-none" style={{ color: accent }}>
                      {value}
                    </span>
                    <span className="mt-2 text-[13px] font-medium" style={{ color: 'var(--sw-muted)' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ============ WELCOME ============ */}
      {showWelcome && (
        <section className="sw-section bg-white !pt-4">
          <div className="sw-container grid items-center gap-14 lg:grid-cols-2">
            {(welcomeImg || welcomeImgSm) && (
              <Reveal className="order-2 lg:order-1">
                <div className="relative mx-auto max-w-lg pb-16 pr-10">
                  {welcomeImg && (
                    <img
                      src={welcomeImg}
                      alt="School life"
                      className="w-full rounded-xl object-contain shadow-lg"
                      loading="lazy"
                    />
                  )}
                  {welcomeImgSm && (
                    <img
                      src={welcomeImgSm}
                      alt=""
                      loading="lazy"
                      className={`${welcomeImg ? 'absolute -bottom-0 right-0 w-2/5' : 'w-full'} rounded-xl object-contain shadow-xl`}
                      style={{ border: '3px solid var(--sw-gold)' }}
                    />
                  )}
                </div>
              </Reveal>
            )}

            <Reveal className="order-1 lg:order-2" delay={120}>
              <p className="sw-eyebrow">Welcome to {schoolName}</p>
              {home.welcome_heading && (
                <h2 className="sw-serif mt-3 text-[34px] leading-tight md:text-[44px]">
                  {renderWelcomeHeading(home.welcome_heading, home.welcome_heading_accent || '')}
                </h2>
              )}
              {site?.welcome_text && (
                <div className="sw-prose mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: site.welcome_text }} />
              )}
              {home.welcome_link_text && (
                <Link
                  to="/about"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold no-underline"
                  style={{ color: accent }}
                >
                  {home.welcome_link_text}
                  <span aria-hidden>→</span>
                </Link>
              )}
            </Reveal>
          </div>
        </section>
      )}

      {/* ============ HEAD OF SCHOOL ============ */}
      {(() => {
        const about = data?.about || {};
        const directorPhoto = resolveWebsiteImageUrl(about.director_photo_url as string | undefined);
        const hasDirector =
          directorPhoto || about.director_message || about.director_name || about.director_title;
        if (!hasDirector) return null;
        return (
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
                <p className="sw-eyebrow">Leadership</p>
                <h2 className="sw-serif mt-3 text-3xl leading-tight md:text-[40px]">A word from our Head of School</h2>
                {about.director_message && (
                  <>
                    <span className="sw-serif mt-6 block text-[72px] leading-[0.5] text-[var(--sw-gold)] md:text-[90px]" aria-hidden>
                      “
                    </span>
                    <blockquote
                      className="sw-serif mt-4 text-xl font-semibold italic leading-snug md:text-2xl"
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
        );
      })()}

      {/* ============ WHY CHOOSE US ============ */}
      {highlights.length > 0 && (
        <section className="sw-section sw-highlights-section">
          <div className="sw-highlights-edge sw-highlights-edge--left" aria-hidden />
          <div className="sw-highlights-edge sw-highlights-edge--right" aria-hidden />

          <div className="sw-container relative">
            <div className="sw-highlights-panel">
              {(home.highlights_eyebrow || home.highlights_title) && (
                <Reveal>
                  <div className="sw-highlights-header">
                    {home.highlights_eyebrow && (
                      <p className="sw-eyebrow text-center">{home.highlights_eyebrow}</p>
                    )}
                    {home.highlights_title && (
                      <h2 className="sw-serif mt-3 text-center text-[34px] leading-tight md:text-[44px]">
                        {home.highlights_title}
                      </h2>
                    )}
                    <div className="sw-highlights-ornament mx-auto mt-6" aria-hidden>
                      <span className="sw-highlights-ornament-line" />
                      <span className="sw-highlights-ornament-gem" />
                      <span className="sw-highlights-ornament-line" />
                    </div>
                  </div>
                </Reveal>
              )}

              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                {highlights.map((h, i) => {
                  const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
                  return (
                    <Reveal key={i} delay={i * 80}>
                      <article className="sw-highlight-card group h-full" data-accent={String(i % 4)}>
                        <span className="sw-highlight-card-edge" aria-hidden />
                        <span className="sw-highlight-num" aria-hidden>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="sw-highlight-icon mb-5">
                          {h.icon && /\p{Extended_Pictographic}/u.test(h.icon) ? (
                            <span className="text-xl leading-none">{h.icon}</span>
                          ) : (
                            <Icon className="h-5 w-5" strokeWidth={1.75} />
                          )}
                        </span>
                        <h3 className="sw-serif pr-8 text-[22px] leading-snug">{h.title}</h3>
                        {h.description && (
                          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--sw-muted)' }}>
                            {h.description}
                          </p>
                        )}
                      </article>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ UPCOMING EVENTS (auto from published events) ============ */}
      {upcomingEvents.length > 0 && (
        <section className="sw-section sw-home-events bg-[var(--sw-offwhite)]">
          <div className="sw-container">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <span className="sw-event-live-pill mb-4">
                  <span className="sw-event-live-dot" aria-hidden />
                  Live on campus
                </span>
                <SectionHeading eyebrow="What's happening" title="Upcoming events" centered />
                <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--sw-muted)' }}>
                  Join us for these upcoming occasions on campus.
                </p>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event, i) => {
                const cover = resolveWebsiteImageUrl(event.cover_image_url);
                const { day, month } = eventDayParts(event.event_date);
                return (
                  <Reveal key={event.id} delay={i * 90}>
                    <Link to="/events" className="sw-home-event-card group block no-underline">
                      <div className="sw-home-event-card-visual">
                        {cover ? (
                          <SwFramedImage src={cover} alt={event.title} className="sw-home-event-frame" />
                        ) : (
                          <div className="sw-home-event-placeholder">
                            <CalendarDays className="h-10 w-10" style={{ color: 'var(--sw-border)' }} />
                          </div>
                        )}
                        <div className="sw-home-event-date">
                          <span className="sw-home-event-date-month">{month}</span>
                          <span className="sw-home-event-date-day">{day}</span>
                        </div>
                      </div>
                      <div className="sw-home-event-body">
                        <h3 className="sw-serif text-xl leading-snug transition group-hover:text-[var(--sw-primary)]">
                          {event.title}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--sw-muted)' }}>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" style={{ color: 'var(--sw-primary)' }} />
                            {formatDisplayDate(event.event_date)}
                          </span>
                          {event.event_time && (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" style={{ color: 'var(--sw-primary)' }} />
                              {formatEventTime(event.event_time)}
                            </span>
                          )}
                          {event.location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--sw-primary)' }} />
                              {event.location}
                            </span>
                          )}
                        </div>
                        <span
                          className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                          style={{ color: 'var(--sw-primary)' }}
                        >
                          View event
                          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={200}>
              <div className="mt-12 text-center">
                <Link to="/events" className="sw-btn sw-btn-outline inline-flex gap-2">
                  See all events
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ============ CTA CARD ============ */}
      {(home.cta_title || home.cta_subtitle || home.cta_button_text) && (
        <section className="sw-cta-section bg-white pb-20 pt-2 md:pb-24">
          <div className="sw-container flex justify-center">
            <Reveal className="w-full max-w-3xl">
              <div
                className="sw-cta-card relative overflow-hidden rounded-2xl p-6 md:p-8"
                style={{
                  background: `linear-gradient(135deg, ${home.cta_bg_color || accent} 0%, color-mix(in srgb, ${home.cta_bg_color || accent} 72%, #0c2340) 100%)`,
                }}
              >
                <div className="relative z-[1] flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
                  <div className="min-w-0 flex-1 text-left">
                    <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90">
                      <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                      Join us
                    </span>
                    {home.cta_title && (
                      <h2 className="sw-serif text-2xl leading-snug !text-white md:text-[28px]">{home.cta_title}</h2>
                    )}
                    {home.cta_subtitle && (
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">{home.cta_subtitle}</p>
                    )}
                  </div>
                  {home.cta_button_text && (
                    <Link
                      to="/admissions"
                      className="sw-btn sw-btn-gold group shrink-0 gap-2 whitespace-nowrap shadow-lg shadow-black/10"
                    >
                      {home.cta_button_text}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}
    </>
  );
}
