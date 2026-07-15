import React from 'react';
import { cn } from '@/lib/utils';

type SwFramedImageProps = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
};

/** Gold offset border frame — same treatment as Head of School on About page. */
export function SwFramedImage({ src, alt, className, imgClassName, onClick }: SwFramedImageProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('sw-framed-image block w-full text-left', onClick && 'cursor-zoom-in', className)}
    >
      <img src={src} alt={alt} loading="lazy" className={cn('sw-framed-image__img', imgClassName)} />
      <span className="sw-framed-image__accent" aria-hidden />
    </Wrapper>
  );
}
