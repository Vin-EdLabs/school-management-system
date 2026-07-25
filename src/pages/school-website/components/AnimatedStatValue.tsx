import React, { useEffect, useMemo, useRef, useState } from 'react';

function parseStatValue(raw: string): { numeric: number; prefix: string; suffix: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([^0-9\-]*)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const numeric = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return { prefix: match[1], suffix: match[3], numeric };
}

export default function AnimatedStatValue({
  value,
  duration = 1400,
  delay = 0,
  className,
  style,
}: {
  value: string;
  duration?: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState('0');
  const parsed = useMemo(() => parseStatValue(value), [value]);

  useEffect(() => {
    if (!parsed) {
      setDisplay(value);
      return;
    }

    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let startTime: number | null = null;
    let timeoutId = 0;

    const run = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(parsed.numeric * eased);
      setDisplay(`${parsed.prefix}${current.toLocaleString()}${parsed.suffix}`);
      if (progress < 1) {
        frame = requestAnimationFrame(run);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        timeoutId = window.setTimeout(() => {
          frame = requestAnimationFrame(run);
        }, delay);
      },
      { threshold: 0.2, rootMargin: '0px 0px -24px 0px' }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(frame);
    };
  }, [value, duration, delay, parsed?.numeric, parsed?.prefix, parsed?.suffix]);

  if (!parsed) {
    return (
      <span className={className} style={style}>
        {value}
      </span>
    );
  }

  return (
    <span ref={ref} className={className} style={style}>
      {display}
    </span>
  );
}
