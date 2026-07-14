import { useEffect } from 'react';
import { LANDING_STRUCTURED_DATA_BLOCKS } from '@/content/landingStructuredData';

const SCRIPT_IDS = [
  'landing-ld-software-application',
  'landing-ld-faq',
  'landing-ld-organization',
  'landing-ld-website',
] as const;

/** JSON-LD structured data for the public landing page only (not admin routes). */
export function LandingStructuredData() {
  useEffect(() => {
    const inserted: HTMLScriptElement[] = [];

    LANDING_STRUCTURED_DATA_BLOCKS.forEach((json, index) => {
      const id = SCRIPT_IDS[index] || `landing-ld-${index}`;
      if (document.getElementById(id)) return;

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      script.text = json;
      document.head.appendChild(script);
      inserted.push(script);
    });

    return () => {
      inserted.forEach((script) => script.remove());
    };
  }, []);

  return null;
}
