import L from 'leaflet';
import { resolveLogoUrl } from '../services/tenantService';

const FALLBACK_SCHOOL_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
`;

/** Premium school hub marker — logo with pulse / blink ring. */
export function createSchoolMapIcon(logoUrl: string | null | undefined, schoolName: string): L.DivIcon {
  const resolved = resolveLogoUrl(logoUrl ?? null);
  const safeName = schoolName.replace(/"/g, '&quot;');
  const coreContent = resolved
    ? `<img src="${resolved}" alt="${safeName}" class="transport-school-logo-img" />`
    : `<div class="transport-school-logo-fallback">${FALLBACK_SCHOOL_SVG}</div>`;

  return L.divIcon({
    html: `
      <div class="transport-school-marker transport-school-marker--logo" title="${safeName}">
        <div class="transport-school-marker-pulse"></div>
        <div class="transport-school-marker-blink"></div>
        <div class="transport-school-marker-core transport-school-marker-core--logo">
          ${coreContent}
        </div>
      </div>
    `,
    className: 'custom-leaflet-marker-school',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -30],
  });
}
