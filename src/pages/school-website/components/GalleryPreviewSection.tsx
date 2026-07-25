import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { Reveal, SectionHeading } from '../SchoolWebsiteLayout';
import { galleryImageSrc } from '../hooks/useLoadableGalleryImages';

type GalleryItem = {
  id: number;
  url: string;
  thumbnail_url?: string | null;
  category?: string;
};

function GalleryPreviewTile({
  img,
  index,
  onFailed,
}: {
  img: GalleryItem;
  index: number;
  onFailed: () => void;
}) {
  const src = galleryImageSrc(img);
  const [hidden, setHidden] = useState(false);

  if (!src || hidden) return null;

  return (
    <Reveal delay={index * 60}>
      <Link
        to="/gallery"
        className="group relative block overflow-hidden rounded-xl shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
        style={{ aspectRatio: '1 / 1' }}
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          onError={() => {
            setHidden(true);
            onFailed();
          }}
        />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">
          {img.category}
        </span>
      </Link>
    </Reveal>
  );
}

/** Home page "Campus life" strip — shown on all published school sites when gallery photos exist. */
export default function GalleryPreviewSection({ images }: { images: GalleryItem[] }) {
  const preview = useMemo(() => images.slice(0, 6), [images]);
  const [failedCount, setFailedCount] = useState(0);

  if (preview.length === 0 || failedCount >= preview.length) return null;

  return (
    <section className="sw-section bg-white !pt-0">
      <div className="sw-container">
        <Reveal>
          <SectionHeading eyebrow="Campus life" title="Moments from our school" centered />
          <p className="-mt-10 mb-10 text-center text-sm" style={{ color: 'var(--sw-muted)' }}>
            Classrooms, sports, arts, and the everyday joy of learning.
          </p>
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
          {preview.map((img, i) => (
            <GalleryPreviewTile
              key={img.id}
              img={img}
              index={i}
              onFailed={() => setFailedCount((n) => n + 1)}
            />
          ))}
        </div>
        <Reveal delay={200}>
          <div className="mt-10 text-center">
            <Link to="/gallery" className="sw-btn sw-btn-outline inline-flex gap-2">
              <ImageIcon className="h-4 w-4" />
              View full gallery
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
