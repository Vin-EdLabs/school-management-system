import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import html2pdf from 'html2pdf.js';
import AppointmentLetterDocument, {
  type AppointmentLetterData,
  cloneLetterForOutput,
} from './AppointmentLetterDocument';
import { resolveLogoUrl } from '@/services/tenantService';

const SOURCE_ID = 'appointment-letter-pdf-source';
const OUTPUT_ID = 'appointment-letter-pdf-output';
const PAGE_WIDTH_PX = 794; // A4 at 96dpi
const CONTENT_WIDTH_PX = 700;
const PAGE_MARGIN_MM = 12;
const FRAME_INSET_MM = 6;

function offscreenContainer(): HTMLDivElement {
  const div = document.createElement('div');
  div.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH_PX}px;background:#fff;z-index:-1;`;
  document.body.appendChild(div);
  return div;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Try progressively: fetch (no credentials), fetch (credentials), then canvas via a CORS <img>. */
async function toDataUrl(src: string): Promise<string | null> {
  for (const credentials of ['omit', 'include'] as RequestCredentials[]) {
    try {
      const res = await fetch(src, { credentials, mode: 'cors' });
      if (res.ok) return await blobToDataUrl(await res.blob());
    } catch {
      // try next strategy
    }
  }
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });
  } catch {
    return null;
  }
}

/** Inline every image so html2canvas never hits a cross-origin/tainted-canvas failure. */
async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const raw = img.getAttribute('src') || '';
      if (!raw || raw.startsWith('data:')) return;
      const dataUrl = await toDataUrl(resolveLogoUrl(raw) || raw);
      if (dataUrl) img.setAttribute('src', dataUrl);
    })
  );
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => (img.decode ? img.decode().catch(() => undefined).then(() => resolve()) : resolve());
          if (img.complete) done();
          else {
            img.onload = done;
            img.onerror = () => resolve();
          }
        })
    )
  );
}

/**
 * html2canvas can't size <img> inside inline-flex boxes (logo/photo come out blank),
 * so paint them as CSS backgrounds on the box instead.
 */
function imagesToBackgrounds(root: HTMLElement): void {
  root.querySelectorAll<HTMLImageElement>('div.overflow-hidden > img').forEach((img) => {
    const box = img.parentElement as HTMLElement;
    const src = img.getAttribute('src');
    if (!box || !src) return;
    const cover = img.classList.contains('object-cover');
    box.style.display = 'block';
    box.style.backgroundImage = `url("${src}")`;
    box.style.backgroundRepeat = 'no-repeat';
    box.style.backgroundPosition = 'center';
    box.style.backgroundSize = cover ? 'cover' : 'contain';
    box.style.backgroundColor = '#fff';
    img.remove();
  });
}

/** Render the letter offscreen from its data and save it as a real, correctly laid-out A4 PDF. */
export async function downloadAppointmentLetterPdf(data: AppointmentLetterData, filename: string): Promise<void> {
  const sourceHost = offscreenContainer();
  const root = createRoot(sourceHost);
  const outputHost = offscreenContainer();
  try {
    flushSync(() => {
      root.render(<AppointmentLetterDocument data={data} id={SOURCE_ID} readOnly userRole="admin" />);
    });

    const clone = cloneLetterForOutput(SOURCE_ID);
    if (!clone) throw new Error('Could not render the appointment letter');

    // The frame is drawn on every PDF page below, so the on-screen border is dropped here.
    const fix = document.createElement('style');
    fix.textContent = `
      #${OUTPUT_ID} { border: 0 !important; box-shadow: none !important; padding: 8px 4px !important; }
      #${OUTPUT_ID} span.border-b { display: inline-block; line-height: 1.5; padding-top: 1px; padding-bottom: 4px; }
      #${OUTPUT_ID} img { max-width: none; }
      #${OUTPUT_ID} table.border-all { border-collapse: separate; border-spacing: 0; border-top: 1.5px solid #000; border-left: 1.5px solid #000; }
      #${OUTPUT_ID} table.border-all th, #${OUTPUT_ID} table.border-all td {
        border: 0 !important; border-right: 1.5px solid #000 !important; border-bottom: 1.5px solid #000 !important;
      }
    `;
    outputHost.appendChild(fix);
    clone.id = OUTPUT_ID;
    clone.style.width = `${CONTENT_WIDTH_PX}px`;
    clone.style.maxWidth = 'none';
    clone.style.margin = '0';
    outputHost.appendChild(clone);

    await inlineImages(clone);
    imagesToBackgrounds(clone);

    const name = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    const worker = html2pdf()
      .set({
        margin: [PAGE_MARGIN_MM, PAGE_MARGIN_MM, PAGE_MARGIN_MM, PAGE_MARGIN_MM],
        filename: name,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: PAGE_WIDTH_PX },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'img', '.pdf-avoid'] },
      } as Record<string, unknown>)
      .from(clone)
      .toPdf()
      .get('pdf')
      .then((pdf: {
        internal: { getNumberOfPages: () => number; pageSize: { getWidth: () => number; getHeight: () => number } };
        setPage: (n: number) => void;
        setDrawColor: (c: number) => void;
        setLineWidth: (w: number) => void;
        rect: (x: number, y: number, w: number, h: number) => void;
      }) => {
        const pages = pdf.internal.getNumberOfPages();
        const w = pdf.internal.pageSize.getWidth();
        const h = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= pages; i += 1) {
          pdf.setPage(i);
          pdf.setDrawColor(0);
          pdf.setLineWidth(0.7);
          pdf.rect(FRAME_INSET_MM, FRAME_INSET_MM, w - FRAME_INSET_MM * 2, h - FRAME_INSET_MM * 2);
        }
      }) as unknown as { save: () => Promise<void> };
    await worker.save();
  } finally {
    root.unmount();
    sourceHost.remove();
    outputHost.remove();
  }
}

export function appointmentLetterFilename(data: AppointmentLetterData): string {
  const safe = (data.teacher.fullName || 'Teacher').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const ref = data.referenceNumber ? `_${data.referenceNumber.replace(/[^\w-]/g, '')}` : '';
  return `Appointment_Letter_${safe}${ref}.pdf`;
}
