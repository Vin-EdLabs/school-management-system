import { useEffect, useState } from 'react';
import { resolveWebsiteImageUrl } from '@/services/schoolWebsiteService';

type LoadableImage = {
  id: number;
  url: string;
  thumbnail_url?: string | null;
  category?: string;
};

function preloadImage(img: LoadableImage): Promise<LoadableImage | null> {
  const src = resolveWebsiteImageUrl(img.thumbnail_url || img.url);
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const el = new Image();
    el.onload = () => resolve(img);
    el.onerror = () => resolve(null);
    el.src = src;
  });
}

/** Returns only gallery items whose image URL loads successfully. */
export function useLoadableGalleryImages(images: LoadableImage[], limit?: number) {
  const [visible, setVisible] = useState<LoadableImage[]>([]);

  useEffect(() => {
    let cancelled = false;
    setVisible([]);

    if (images.length === 0) return;

    const pool = limit ? images.slice(0, limit + 4) : images;

    void Promise.all(pool.map(preloadImage)).then((results) => {
      if (cancelled) return;
      const loaded = results.filter((img): img is LoadableImage => img !== null);
      setVisible(limit ? loaded.slice(0, limit) : loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [images, limit]);

  return visible;
}

export function galleryImageSrc(img: LoadableImage): string | null {
  return resolveWebsiteImageUrl(img.thumbnail_url || img.url);
}
