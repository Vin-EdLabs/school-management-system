import { useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';
import PartnersLandingPage from './partners/PartnersLandingPage';

/** Hash routes that show the partner apply landing (separate from the school homepage). */
const PARTNER_LANDING_HASHES = new Set([
  '#partners',
  '#apply',
  '#how-it-works',
  '#earnings',
  '#tiers',
]);

export default function PublicLandingSwitch() {
  const { hash } = useLocation();
  if (PARTNER_LANDING_HASHES.has(hash)) {
    return <PartnersLandingPage />;
  }
  return <LandingPage />;
}
