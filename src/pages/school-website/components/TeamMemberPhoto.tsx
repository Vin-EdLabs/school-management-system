import React, { useState } from 'react';
import { resolveWebsiteImageUrl } from '@/services/schoolWebsiteService';
import { Reveal } from '../SchoolWebsiteLayout';

const TEAM_PHOTO_FALLBACK =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=900&h=1125&fit=crop&crop=faces&auto=format&q=92';

export function TeamMemberPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [current, setCurrent] = useState(src);

  if (!current) return null;

  return (
    <Reveal>
      <div className="relative mx-auto w-full max-w-[340px]">
        <img
          src={current}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="relative z-[1] w-full rounded-xl object-cover object-top shadow-lg"
          style={{ aspectRatio: '4 / 5' }}
          onError={() => {
            if (current !== TEAM_PHOTO_FALLBACK) setCurrent(TEAM_PHOTO_FALLBACK);
          }}
        />
        <div
          className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-xl"
          style={{ border: '3px solid var(--sw-gold)' }}
          aria-hidden
        />
      </div>
    </Reveal>
  );
}

export function resolveTeamPhotoUrl(url: string | null | undefined): string | null {
  return resolveWebsiteImageUrl(url);
}
