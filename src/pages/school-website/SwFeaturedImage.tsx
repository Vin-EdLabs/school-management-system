import React from 'react';

type FeaturedImageVariant = 'history' | 'overview';

type SwFeaturedImageProps = {
  src: string;
  alt: string;
  variant: FeaturedImageVariant;
  className?: string;
};

export function SwFeaturedImage({ src, alt, variant, className }: SwFeaturedImageProps) {
  return (
    <div className={`sw-featured-image sw-featured-image--${variant}${className ? ` ${className}` : ''}`}>
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}
