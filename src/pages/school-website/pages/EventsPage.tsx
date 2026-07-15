import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/utils/dateFormat';
import { resolveWebsiteImageUrl, type WebsiteEvent } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal } from '../SchoolWebsiteLayout';
import { SwFramedImage } from '../SwFramedImage';

function isUpcoming(eventDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${eventDate}T00:00:00`) >= today;
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
    year: d.getFullYear(),
  };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').trim();
}

function EventDateBlock({ eventDate, live }: { eventDate: string; live?: boolean }) {
  const { day, month, year } = eventDayParts(eventDate);
  return (
    <div className={cn('sw-event-date-block', live && 'is-live')}>
      {live && (
        <span className="sw-event-live-pill">
          <span className="sw-event-live-dot" aria-hidden />
          Upcoming
        </span>
      )}
      <span className="sw-event-date-month">{month}</span>
      <span className="sw-event-date-day">{day}</span>
      <span className="sw-event-date-year">{year}</span>
    </div>
  );
}

function EventDetailPanel({
  event,
  upcoming,
  onClose,
  onPrev,
  onNext,
  hasNav,
}: {
  event: WebsiteEvent;
  upcoming: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasNav: boolean;
}) {
  const cover = resolveWebsiteImageUrl(event.cover_image_url);
  const extraImages = (event.gallery_images || []).filter((img) => img.url);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="sw-event-panel-backdrop" role="dialog" aria-modal onClick={onClose}>
      <div className="sw-event-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sw-event-panel-close" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        {hasNav && (
          <>
            <button type="button" className="sw-event-panel-nav is-prev" onClick={onPrev} aria-label="Previous event">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" className="sw-event-panel-nav is-next" onClick={onNext} aria-label="Next event">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <div className="sw-event-panel-grid">
          <div className="sw-event-panel-visual">
            {cover ? (
              <SwFramedImage src={cover} alt={event.title} className="max-w-full" />
            ) : (
              <div className="sw-event-panel-placeholder">
                <CalendarDays className="h-14 w-14" style={{ color: 'var(--sw-primary)' }} />
              </div>
            )}
          </div>

          <div className="sw-event-panel-content">
            <div className="flex flex-wrap items-start gap-4">
              <EventDateBlock eventDate={event.event_date} live={upcoming} />
              <div className="min-w-0 flex-1">
                <h2 className="sw-serif text-3xl leading-tight md:text-[2.25rem]">{event.title}</h2>
                <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: 'var(--sw-muted)' }}>
                  {event.location && (
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <MapPin className="h-4 w-4 shrink-0" style={{ color: 'var(--sw-primary)' }} />
                      {event.location}
                    </span>
                  )}
                  {event.event_time && (
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Clock className="h-4 w-4 shrink-0" style={{ color: 'var(--sw-primary)' }} />
                      {formatEventTime(event.event_time)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {event.description && (
              <div className="sw-prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: event.description }} />
            )}

            {extraImages.length > 0 && (
              <div className="mt-10">
                <div className="mb-5 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: 'var(--sw-gold)' }} />
                  <h3 className="sw-serif text-xl">Event gallery</h3>
                </div>
                <div className="grid gap-8 sm:grid-cols-2">
                  {extraImages.map((img, i) => {
                    const src = resolveWebsiteImageUrl(img.url);
                    if (!src) return null;
                    return (
                      <figure key={i}>
                        <SwFramedImage src={src} alt={img.caption || `Event photo ${i + 1}`} />
                        {img.caption && (
                          <figcaption className="mt-3 text-center text-xs" style={{ color: 'var(--sw-muted)' }}>
                            {img.caption}
                          </figcaption>
                        )}
                      </figure>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  upcoming,
  featured,
  onOpen,
}: {
  event: WebsiteEvent;
  upcoming: boolean;
  featured?: boolean;
  onOpen: () => void;
}) {
  const cover = resolveWebsiteImageUrl(event.cover_image_url);
  const excerpt = event.description ? stripHtml(event.description) : '';

  return (
    <article className={cn('sw-event-row group', featured && 'is-featured', !upcoming && 'is-past')}>
      <button type="button" onClick={onOpen} className="sw-event-row-inner w-full text-left">
        <div className="sw-event-row-visual">
          {cover ? (
            <SwFramedImage src={cover} alt={event.title} />
          ) : (
            <div className="sw-event-row-placeholder">
              <CalendarDays className="h-10 w-10" style={{ color: 'var(--sw-primary)' }} />
            </div>
          )}
        </div>

        <div className="sw-event-row-body">
          <div className="flex flex-wrap items-start gap-4">
            <EventDateBlock eventDate={event.event_date} live={upcoming && !featured} />
            <div className="min-w-0 flex-1">
              {featured && upcoming && (
                <span className="sw-event-live-pill mb-3">
                  <span className="sw-event-live-dot" aria-hidden />
                  Next up
                </span>
              )}
              <h3 className={cn('sw-serif leading-snug', featured ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl')}>
                {event.title}
              </h3>
              <div className="mt-3 flex flex-wrap gap-3 text-sm" style={{ color: 'var(--sw-muted)' }}>
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
              {excerpt && (
                <p className={cn('mt-4 leading-relaxed', featured ? 'text-base' : 'text-sm line-clamp-3')} style={{ color: 'var(--sw-muted)' }}>
                  {excerpt}
                </p>
              )}
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--sw-primary)' }}>
                View full details
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>
      </button>
    </article>
  );
}

export default function EventsPage() {
  const { data } = useSchoolWebsite();
  const events = data?.events || [];
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const upcoming = useMemo(
    () => events.filter((e) => isUpcoming(e.event_date)).sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events]
  );
  const past = useMemo(
    () => events.filter((e) => !isUpcoming(e.event_date)).sort((a, b) => b.event_date.localeCompare(a.event_date)),
    [events]
  );

  const visible = tab === 'upcoming' ? upcoming : past;
  const selected = selectedIdx !== null ? visible[selectedIdx] : null;
  const featured = tab === 'upcoming' && upcoming.length > 0 ? upcoming[0] : null;
  const rest = tab === 'upcoming' && featured ? upcoming.slice(1) : visible;

  return (
    <>
      <PageHero title="Events" subtitle="School life in motion — what's coming up and moments we celebrate" />

      <section className="sw-section sw-events-section bg-white">
        <div className="sw-container">
          <Reveal>
            <div className="mx-auto mb-14 flex max-w-lg justify-center gap-2 rounded-full border border-[var(--sw-border)] bg-[var(--sw-offwhite)] p-1.5">
              {(['upcoming', 'past'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setSelectedIdx(null);
                  }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition',
                    tab === key ? 'bg-white shadow-md' : 'text-[var(--sw-muted)]'
                  )}
                  style={tab === key ? { color: 'var(--sw-primary)' } : undefined}
                >
                  {key === 'upcoming' && tab === 'upcoming' && upcoming.length > 0 && (
                    <span className="sw-event-live-dot" aria-hidden />
                  )}
                  {key === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
                </button>
              ))}
            </div>
          </Reveal>

          {visible.length === 0 ? (
            <Reveal>
              <div className="sw-card mx-auto max-w-lg p-12 text-center">
                <CalendarDays className="mx-auto h-10 w-10" style={{ color: 'var(--sw-border)' }} />
                <p className="sw-serif mt-5 text-2xl">
                  {tab === 'upcoming' ? 'No upcoming events' : 'No past events yet'}
                </p>
                <p className="mt-2 text-sm" style={{ color: 'var(--sw-muted)' }}>
                  {tab === 'upcoming'
                    ? 'Check back soon — new events will appear here.'
                    : 'Photos and recaps from past occasions will be shared here.'}
                </p>
              </div>
            </Reveal>
          ) : (
            <div className="space-y-10">
              {featured && (
                <Reveal>
                  <EventRow
                    event={featured}
                    upcoming
                    featured
                    onOpen={() => setSelectedIdx(0)}
                  />
                </Reveal>
              )}
              {rest.length > 0 && (
                <div className="space-y-8">
                  {rest.map((event, i) => {
                    const idx = featured ? i + 1 : i;
                    return (
                      <Reveal key={event.id} delay={(i % 2) * 80}>
                        <EventRow
                          event={event}
                          upcoming={tab === 'upcoming'}
                          onOpen={() => setSelectedIdx(idx)}
                        />
                      </Reveal>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {selected && (
        <EventDetailPanel
          event={selected}
          upcoming={tab === 'upcoming'}
          onClose={() => setSelectedIdx(null)}
          hasNav={visible.length > 1}
          onPrev={() => setSelectedIdx((i) => (i === null ? i : (i - 1 + visible.length) % visible.length))}
          onNext={() => setSelectedIdx((i) => (i === null ? i : (i + 1) % visible.length))}
        />
      )}
    </>
  );
}
