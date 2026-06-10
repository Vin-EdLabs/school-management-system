import React, { useCallback, useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

const SCROLL_THRESHOLD = 400;

const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`scroll-to-top-btn fixed bottom-20 right-4 z-[90] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--sn-border)] bg-white text-[var(--brand)] shadow-lg shadow-emerald-950/10 ring-1 ring-emerald-950/5 transition-all duration-300 hover:scale-105 hover:bg-[var(--brand)] hover:text-white hover:shadow-xl sm:bottom-24 md:right-6 ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <ChevronUp className="h-6 w-6 stroke-[2.5]" aria-hidden />
    </button>
  );
};

export default ScrollToTopButton;
