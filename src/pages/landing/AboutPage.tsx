import React from 'react';
import LandingPageLayout from './LandingPageLayout';
import { LandingSeoHelmet } from './LandingSeoHelmet';
import AboutSection from '@/components/landing/AboutSection';

export default function AboutPage() {
  return (
    <LandingPageLayout>
      <LandingSeoHelmet
        title="About ScholarNerve – Built for African Schools by TechNerve"
        description="ScholarNerve is built by TechNerve to digitize school administration across Africa, starting with Ghana's private primary and JHS schools. Learn our story, mission and vision."
        keywords="about ScholarNerve, TechNerve Ghana, school management Africa, EdTech Ghana, school software story, who built ScholarNerve"
        path="/about"
        ogTitle="About ScholarNerve – Built for African Schools by TechNerve"
        ogDescription="ScholarNerve is built by TechNerve to digitize school management across Africa starting with Ghana's private primary and JHS schools."
      />
      <AboutSection pageTitle="Built for African Schools" />
    </LandingPageLayout>
  );
}
