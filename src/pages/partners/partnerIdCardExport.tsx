import { createRoot, type Root } from 'react-dom/client';
import domtoimage from 'dom-to-image-more';
import { CARD_HEIGHT_PX, CARD_WIDTH_PX } from '@/types/idCard';
import type { PartnerProfile } from '@/services/partnerApi';
import PartnerCardFront from './PartnerCardFront';

const CAPTURE_SCALE = 3;

async function waitForImages(container: HTMLElement): Promise<void> {
  await new Promise<void>((resolve) => {
    const images = container.querySelectorAll('img');
    if (images.length === 0) {
      resolve();
      return;
    }
    let loaded = 0;
    const done = () => {
      loaded += 1;
      if (loaded >= images.length) resolve();
    };
    images.forEach((img) => {
      if (img.complete) done();
      else {
        img.onload = done;
        img.onerror = done;
      }
    });
    window.setTimeout(resolve, 2500);
  });
}

async function waitForFonts(): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;
}

function renderOffscreen(partner: PartnerProfile): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: ${CARD_WIDTH_PX}px;
    height: ${CARD_HEIGHT_PX}px;
    background: white;
    overflow: visible;
    z-index: -1;
  `;
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<PartnerCardFront partner={partner} />);
  return { container, root };
}

export async function capturePartnerIdCardPng(partner: PartnerProfile): Promise<string> {
  const { container, root } = renderOffscreen(partner);
  try {
    await new Promise((r) => window.setTimeout(r, 600));
    await waitForFonts();
    await waitForImages(container);

    const width = CARD_WIDTH_PX * CAPTURE_SCALE;
    const height = CARD_HEIGHT_PX * CAPTURE_SCALE;

    return await domtoimage.toPng(container, {
      width,
      height,
      quality: 1,
      bgcolor: '#ffffff',
      style: {
        transform: `scale(${CAPTURE_SCALE})`,
        transformOrigin: 'top left',
        width: `${CARD_WIDTH_PX}px`,
        height: `${CARD_HEIGHT_PX}px`,
      },
    });
  } finally {
    root.unmount();
    container.remove();
  }
}

export async function downloadPartnerIdCard(partner: PartnerProfile): Promise<void> {
  const dataUrl = await capturePartnerIdCardPng(partner);
  const id = partner.partnerId || `partner-${partner.id}`;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `ScholarNerve-Partner-ID-${id}.png`;
  link.click();
}
