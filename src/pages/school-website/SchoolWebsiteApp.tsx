import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SchoolWebsiteProvider, useSchoolWebsite } from './SchoolWebsiteContext';
import SchoolWebsiteLayout from './SchoolWebsiteLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import AdmissionsPage from './pages/AdmissionsPage';
import GalleryPage from './pages/GalleryPage';
import EventsPage from './pages/EventsPage';
import ContactPage from './pages/ContactPage';
import CareersPage from './pages/CareersPage';
import AlumniPage from './pages/AlumniPage';
import ManagementPage from './pages/ManagementPage';
import ComingSoonPage from './pages/ComingSoonPage';
import './schoolWebsite.css';

/** The public site is always light regardless of the portal theme. */
function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('light', 'dark');
    root.classList.add('light');
    return () => {
      root.classList.remove('light', 'dark');
      root.classList.add(previous);
    };
  }, []);
}

function SchoolWebsiteRoutes() {
  const { loading, error, data, schoolName } = useSchoolWebsite();

  if (!loading && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 text-center">
        <div>
          <p className="sw-serif text-2xl font-bold">Unable to load website</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--sw-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!loading && !data?.enabled) {
    return <ComingSoonPage schoolName={data?.tenant?.name || schoolName} />;
  }

  return (
    <Routes>
      <Route element={<SchoolWebsiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="admissions" element={<AdmissionsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="careers" element={<CareersPage />} />
        <Route path="alumni" element={<AlumniPage />} />
        <Route path="contact" element={<ContactPage />} />
      </Route>
    </Routes>
  );
}

function SchoolWebsiteRoot() {
  const { accent, schoolName, data } = useSchoolWebsite();

  // Document title + description for SEO (SPA equivalent of generateMetadata).
  useEffect(() => {
    if (!schoolName) return;
    document.title = data?.website?.tagline
      ? `${schoolName} — ${data.website.tagline}`
      : schoolName;
  }, [schoolName, data?.website?.tagline]);

  return (
    <div
      className="school-website flex min-h-screen flex-col"
      style={{ ['--sw-primary' as string]: accent }}
    >
      <SchoolWebsiteRoutes />
    </div>
  );
}

export default function SchoolWebsiteApp({ slug }: { slug: string }) {
  useForceLightTheme();
  return (
    <SchoolWebsiteProvider slug={slug}>
      <SchoolWebsiteRoot />
    </SchoolWebsiteProvider>
  );
}
