import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveWebsiteImageUrl } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal } from '../SchoolWebsiteLayout';
import { SwFramedImage } from '../SwFramedImage';
import { galleryImageSrc, useLoadableGalleryImages } from '../hooks/useLoadableGalleryImages';

const CATEGORY_LABELS: Record<string, string> = {
  classrooms: 'Classrooms',
  labs: 'Labs',
  events: 'Events',
  activities: 'Activities',
  facilities: 'Facilities',
};

export default function GalleryPage() {
  const { data } = useSchoolWebsite();
  const images = useMemo(() => data?.gallery || [], [data?.gallery]);
  const loadableImages = useLoadableGalleryImages(images);
  const [category, setCategory] = useState<string>('All');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    loadableImages.forEach((img) => {
      const cat = img.category || 'other';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return [
      { key: 'All', label: 'All', count: loadableImages.length },
      ...Array.from(counts.entries()).map(([key, count]) => ({
        key,
        label: CATEGORY_LABELS[key] || key,
        count,
      })),
    ];
  }, [loadableImages]);

  const filtered = useMemo(
    () => (category === 'All' ? loadableImages : loadableImages.filter((img) => img.category === category)),
    [loadableImages, category]
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null ? i : (i + 1) % filtered.length));
      if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i === null ? i : (i - 1 + filtered.length) % filtered.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, filtered.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxIdx]);

  const current = lightboxIdx !== null ? filtered[lightboxIdx] : null;

  return (
    <>
      <PageHero title="Gallery" subtitle="Moments and memories from around our school" />

      <section className="sw-section sw-gallery-section bg-white">
        <div className="sw-container">
          {categories.length > 1 && (
            <Reveal>
              <div className="mb-14 flex flex-wrap justify-center gap-2.5">
                {categories.map(({ key, label, count }) => {
                  const active = key === category;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key)}
                      className={cn('sw-gallery-filter', active && 'is-active')}
                    >
                      {label}
                      <span className="sw-gallery-filter-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </Reveal>
          )}

          {filtered.length === 0 ? (
            <Reveal>
              <div className="sw-card mx-auto max-w-md p-14 text-center">
                <ImageOff className="mx-auto h-10 w-10" style={{ color: 'var(--sw-border)' }} />
                <p className="sw-serif mt-5 text-2xl">Gallery coming soon</p>
                <p className="mt-2 text-sm" style={{ color: 'var(--sw-muted)' }}>
                  Photos will appear here once the school publishes them.
                </p>
              </div>
            </Reveal>
          ) : (
            <div className="sw-gallery-framed-grid">
              {filtered.map((img, i) => {
                const src = galleryImageSrc(img);
                const label = CATEGORY_LABELS[img.category || ''] || img.category || 'Photo';
                if (!src) return null;
                return (
                  <Reveal key={img.id ?? i} delay={(i % 3) * 70}>
                    <figure className="sw-gallery-framed-item group">
                      <SwFramedImage
                        src={src}
                        alt={label}
                        onClick={() => setLightboxIdx(i)}
                      />
                      <figcaption className="sw-gallery-framed-caption">
                        <span className="font-medium capitalize" style={{ color: 'var(--sw-text)' }}>
                          {label}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide opacity-0 transition group-hover:opacity-100"
                          style={{ color: 'var(--sw-primary)' }}
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                          View
                        </span>
                      </figcaption>
                    </figure>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {current && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxIdx(null)}
          role="dialog"
          aria-modal
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full p-2 transition hover:bg-white/10"
            style={{ color: 'var(--sw-gold)' }}
            onClick={() => setLightboxIdx(null)}
            aria-label="Close"
          >
            <X className="h-7 w-7" />
          </button>

          {filtered.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition hover:bg-white/10 md:left-8"
                style={{ color: 'var(--sw-gold)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((i) => (i === null ? i : (i - 1 + filtered.length) % filtered.length));
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-9 w-9" />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition hover:bg-white/10 md:right-8"
                style={{ color: 'var(--sw-gold)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((i) => (i === null ? i : (i + 1) % filtered.length));
                }}
                aria-label="Next image"
              >
                <ChevronRight className="h-9 w-9" />
              </button>
            </>
          )}

          <figure className="max-h-[90vh] max-w-6xl px-2" onClick={(e) => e.stopPropagation()}>
            <div className="sw-framed-image sw-framed-image--lightbox mx-auto max-w-5xl">
              <img
                src={resolveWebsiteImageUrl(current.url) || ''}
                alt={current.category || ''}
                className="sw-framed-image__img max-h-[78vh] w-auto max-w-full object-contain"
              />
              <span className="sw-framed-image__accent" aria-hidden />
            </div>
            <figcaption className="mt-5 flex items-center justify-center gap-3 text-sm text-white/85">
              {current.category && (
                <span className="rounded-full border border-white/25 px-3 py-1 capitalize">
                  {CATEGORY_LABELS[current.category] || current.category}
                </span>
              )}
              {filtered.length > 1 && lightboxIdx !== null && (
                <span>
                  {lightboxIdx + 1} / {filtered.length}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
