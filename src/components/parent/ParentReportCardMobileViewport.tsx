import React, { useEffect } from 'react';

const MOBILE_MAX_WIDTH = 767;
const MIN_READABLE_SCALE = 0.68;

type Props = {
  children: React.ReactNode;
  /** Re-run scale when report content changes */
  layoutKey?: string | number | null;
  /** DOM id on the report card root (must match the scaled element) */
  containerId?: string;
  /** DOM id on the viewport wrapper */
  viewportId?: string;
};

const DEFAULT_CONTAINER_ID = 'report-card-container';
const DEFAULT_VIEWPORT_ID = 'report-card-viewport';

/**
 * Scales the parent-portal report card to fit mobile width.
 * Falls back to horizontal scroll if scale would be unreadably small.
 * Desktop (md+) is unchanged.
 */
const ParentReportCardMobileViewport: React.FC<Props> = ({
  children,
  layoutKey,
  containerId = DEFAULT_CONTAINER_ID,
  viewportId = DEFAULT_VIEWPORT_ID,
}) => {
  useEffect(() => {
    const scaleToFit = () => {
      const reportEl = document.getElementById(containerId);
      const viewport = document.getElementById(viewportId);
      if (!reportEl) return;

      const isMobile = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;

      if (!isMobile) {
        reportEl.style.transform = 'none';
        reportEl.style.transformOrigin = '';
        reportEl.style.marginBottom = '0';
        if (viewport) {
          viewport.style.overflowX = '';
          viewport.style.WebkitOverflowScrolling = '';
        }
        return;
      }

      const containerWidth =
        viewport?.clientWidth ||
        reportEl.parentElement?.clientWidth ||
        window.innerWidth;

      const reportWidth = reportEl.scrollWidth;

      if (reportWidth <= containerWidth) {
        reportEl.style.transform = 'none';
        reportEl.style.transformOrigin = '';
        reportEl.style.marginBottom = '0';
        if (viewport) {
          viewport.style.overflowX = 'hidden';
        }
        return;
      }

      const scale = containerWidth / reportWidth;

      if (scale < MIN_READABLE_SCALE) {
        reportEl.style.transform = 'none';
        reportEl.style.transformOrigin = '';
        reportEl.style.marginBottom = '0';
        if (viewport) {
          viewport.style.overflowX = 'auto';
          (viewport.style as CSSStyleDeclaration & { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
        }
        return;
      }

      if (viewport) {
        viewport.style.overflowX = 'hidden';
      }
      reportEl.style.transform = `scale(${scale})`;
      reportEl.style.transformOrigin = 'top left';
      reportEl.style.marginBottom = `${-reportEl.offsetHeight * (1 - scale)}px`;
    };

    scaleToFit();

    const reportEl = document.getElementById(containerId);
    const ro = reportEl ? new ResizeObserver(scaleToFit) : null;
    if (reportEl && ro) ro.observe(reportEl);

    window.addEventListener('resize', scaleToFit);
    window.addEventListener('orientationchange', scaleToFit);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', scaleToFit);
      window.removeEventListener('orientationchange', scaleToFit);
    };
  }, [layoutKey, containerId, viewportId]);

  return (
    <div
      id={viewportId}
      className="w-full max-w-full md:overflow-visible"
      style={{
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
};

export default ParentReportCardMobileViewport;
