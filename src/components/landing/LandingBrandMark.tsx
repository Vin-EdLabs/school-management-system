import React from 'react';

export default function LandingBrandMark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/android-chrome-192x192.png"
      alt="ScholarNerve"
      className={`object-cover ${className}`}
    />
  );
}
