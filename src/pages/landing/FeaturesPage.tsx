import React, { useEffect, useState } from 'react';
import LandingPageLayout from './LandingPageLayout';
import { LandingSeoHelmet } from './LandingSeoHelmet';
import FeaturesSection, { type PublicStats } from '@/components/landing/FeaturesSection';
import { resolveApiBaseUrl } from '@/services/api';

const API_BASE = resolveApiBaseUrl();

const defaultStats: PublicStats = {
  schools: 0,
  students: 0,
  teachersAndStaff: 0,
  feesProcessed: 0,
};

export default function FeaturesPage() {
  const [stats, setStats] = useState<PublicStats>(defaultStats);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/tenant/public-stats`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Partial<PublicStats> | null) => {
        if (cancelled || !data) return;
        setStats({
          schools: Number(data.schools ?? 0),
          students: Number(data.students ?? 0),
          teachersAndStaff: Number(data.teachersAndStaff ?? 0),
          feesProcessed: Number(data.feesProcessed ?? 0),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.scroll-reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <LandingPageLayout>
      <LandingSeoHelmet
        title="Features – ScholarNerve | Complete School Management Platform"
        description="Explore ScholarNerve's full feature set — student enrollment, fee collection, boarding house management, GPS attendance, report cards, grading, staff payroll, and parent portal. Built for African JHS and primary schools."
        keywords="ScholarNerve features, school management features Ghana, boarding house management software, GPS attendance Africa, school fee collection, report card generator Africa"
        path="/features"
        ogTitle="Features – ScholarNerve | Complete School Management Platform"
        ogDescription="Student enrollment, fee collection, boarding management, GPS attendance, report cards, payroll and parent portal — all in one platform."
      />
      <FeaturesSection stats={stats} pageTitle="Everything Your School Needs in One Platform" />
    </LandingPageLayout>
  );
}
