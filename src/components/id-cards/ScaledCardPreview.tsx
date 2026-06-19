import React from 'react';
import { CARD_HEIGHT_PX, CARD_WIDTH_PX } from '@/types/idCard';

type ScaledCardPreviewProps = {
  scale: number;
  children: React.ReactNode;
  shadow?: boolean;
};

/** Scale a card for preview without clipping — uses top-left origin and exact wrapper dimensions. */
export function ScaledCardPreview({ scale, children, shadow = true }: ScaledCardPreviewProps) {
  const w = CARD_WIDTH_PX * scale;
  const h = CARD_HEIGHT_PX * scale;
  return (
    <div style={{ width: w, height: h, margin: '0 auto', position: 'relative' }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: CARD_WIDTH_PX,
          height: CARD_HEIGHT_PX,
          borderRadius: 14,
          ...(shadow ? { boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function previewWrapperHeight(scale: number): number {
  return Math.ceil(CARD_HEIGHT_PX * scale);
}
