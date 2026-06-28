import React, { useCallback, useEffect, useState } from 'react';

const MOBILE_MAX_WIDTH = 767;
const MIN_READABLE_SCALE = 0.72;

type Props = {
  children: React.ReactNode;
  contentRef: React.RefObject<HTMLDivElement>;
  /** Re-run scale when report content changes */
  layoutKey?: string | number | null;
};

/**
 * Scales the parent-portal report card to fit mobile viewport width (no horizontal scroll).
 * Desktop (md+) is unchanged — children render at full size.
 */
const ParentReportCardMobileViewport: React.FC<Props> = ({ children, contentRef, layoutKey }) => {
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);
  const [naturalWidth, setNaturalWidth] = useState<number | undefined>(undefined);

  const recomputeScale = useCallback(() => {
    const el = contentRef.current;
    const isMobile = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;

    if (!el || !isMobile) {
      setScale(1);
      setScaledHeight(undefined);
      setNaturalWidth(undefined);
      return;
    }

    const width = el.scrollWidth || el.offsetWidth;
    const height = el.offsetHeight;
    if (!width) return;

    const horizontalPadding = 28;
    const available = Math.max(window.innerWidth - horizontalPadding, 280);
    let nextScale = available / width;

    if (window.innerWidth < 360) {
      nextScale = Math.max(nextScale, MIN_READABLE_SCALE);
    }

    nextScale = Math.min(1, nextScale);

    setNaturalWidth(width);
    setScale(nextScale);
    setScaledHeight(height * nextScale);
  }, [contentRef]);

  useEffect(() => {
    recomputeScale();

    const el = contentRef.current;
    const ro = el ? new ResizeObserver(() => recomputeScale()) : null;
    if (el && ro) ro.observe(el);

    window.addEventListener('resize', recomputeScale);
    window.addEventListener('orientationchange', recomputeScale);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', recomputeScale);
      window.removeEventListener('orientationchange', recomputeScale);
    };
  }, [contentRef, layoutKey, recomputeScale]);

  const isScaled = scale < 1 && naturalWidth;

  return (
    <div className="w-full max-w-full overflow-x-hidden md:overflow-visible">
      <div
        className="mx-auto md:contents"
        style={
          isScaled
            ? {
                width: naturalWidth * scale,
                height: scaledHeight,
                maxWidth: '100%',
                overflow: 'hidden',
              }
            : undefined
        }
      >
        <div
          style={
            isScaled
              ? {
                  width: naturalWidth,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ParentReportCardMobileViewport;
