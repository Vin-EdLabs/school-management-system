import { Helmet } from 'react-helmet-async';

const SITE = 'https://scholarnerve.com';
const OG_IMAGE = `${SITE}/og-image.png`;

export type LandingSeoProps = {
  title: string;
  description: string;
  keywords: string;
  path: string;
  ogTitle?: string;
  ogDescription?: string;
};

export function LandingSeoHelmet({
  title,
  description,
  keywords,
  path,
  ogTitle,
  ogDescription,
}: LandingSeoProps) {
  const canonical = `${SITE}${path.startsWith('/') ? path : `/${path}`}`;
  const resolvedOgTitle = ogTitle ?? title;
  const resolvedOgDescription = ogDescription ?? description;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:site_name" content="ScholarNerve" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedOgDescription} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
}
