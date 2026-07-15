import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function ApplicationSuccessScreen({
  title = 'Application Submitted!',
  message = 'Thank you for applying. Our team will review your submission and contact you shortly.',
}: {
  title?: string;
  message?: string;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <section className="flex min-h-[75vh] items-center justify-center bg-white px-4 py-24">
      <div className="text-center">
        <svg className="mx-auto h-24 w-24" viewBox="0 0 52 52" aria-hidden>
          <circle
            className="sw-check-circle"
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="var(--sw-primary)"
            strokeWidth="2.5"
          />
          <path
            className="sw-check-mark"
            fill="none"
            stroke="var(--sw-gold)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 27l8 8 16-17"
          />
        </svg>
        <h1 className="sw-serif mt-8 text-3xl sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-base" style={{ color: 'var(--sw-muted)' }}>
          {message}
        </p>
        <Link to="/" className="sw-btn sw-btn-primary mt-9">
          Return Home
        </Link>
      </div>
    </section>
  );
}
