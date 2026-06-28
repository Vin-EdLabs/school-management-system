import React, { useEffect, useRef } from 'react';
import './staffReportCard.css';

const REPORT_NATURAL_WIDTH = 600;
const MIN_READABLE_SCALE = 0.68;
const MOBILE_MAX_WIDTH = 767;

type Props = {
  children: React.ReactNode;
  /** Re-run scale when report content changes */
  layoutKey?: string | number | null;
};

/**
 * Mobile viewport for admin/teacher/headmaster terminal report preview.
 * Scales to fit when possible; falls back to horizontal scroll on very small screens.
 */
const StaffReportCardViewport: React.FC<Props> = ({ children, layoutKey }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scaleToFit = () => {
      const el = document.getElementById('admin-report-card');
      const scrollEl = scrollRef.current;
      if (!el || !scrollEl) return;

      const isMobile = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;

      if (!isMobile) {
        el.style.transform = 'none';
        el.style.transformOrigin = '';
        el.style.width = '100%';
        el.style.marginBottom = '0';
        scrollEl.style.overflowX = '';
        (scrollEl.style as CSSStyleDeclaration & { webkitOverflowScrolling?: string }).webkitOverflowScrolling = '';
        return;
      }

      const available = scrollEl.clientWidth;
      const natural = REPORT_NATURAL_WIDTH;

      if (available >= natural) {
        el.style.transform = 'none';
        el.style.transformOrigin = '';
        el.style.width = '100%';
        el.style.marginBottom = '0';
        scrollEl.style.overflowX = 'hidden';
        return;
      }

      const s = available / natural;

      if (s < MIN_READABLE_SCALE) {
        el.style.transform = 'none';
        el.style.transformOrigin = '';
        el.style.width = `${natural}px`;
        el.style.marginBottom = '0';
        scrollEl.style.overflowX = 'auto';
        (scrollEl.style as CSSStyleDeclaration & { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
        return;
      }

      scrollEl.style.overflowX = 'hidden';
      el.style.transform = `scale(${s})`;
      el.style.transformOrigin = 'top left';
      el.style.width = `${natural}px`;
      el.style.marginBottom = `${-el.offsetHeight * (1 - s)}px`;
    };

    scaleToFit();

    const el = document.getElementById('admin-report-card');
    const ro = el ? new ResizeObserver(scaleToFit) : null;
    if (el && ro) ro.observe(el);

    window.addEventListener('resize', scaleToFit);
    window.addEventListener('orientationchange', scaleToFit);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', scaleToFit);
      window.removeEventListener('orientationchange', scaleToFit);
    };
  }, [layoutKey]);

  return (
    <div
      ref={scrollRef}
      className="staff-report-card-scroll w-full max-w-full"
      style={{
        width: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="staff-report-card-inner-wrap"
        style={{ minWidth: `${REPORT_NATURAL_WIDTH}px`, margin: '0 auto' }}
      >
        {children}
      </div>
    </div>
  );
};

export default StaffReportCardViewport;
