import React, { useCallback, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import type { CardEntityType, IDCardColors, IDCardData } from '@/types/idCard';
import { CARD_HEIGHT_PX, CARD_WIDTH_PX } from '@/types/idCard';
import { resolveLogoUrl } from '@/services/tenantService';
import { formatIdCardAcademicYear } from '@/utils/idCardAcademicYear';
import { resolveIdCardVerifyUrl } from '@/utils/idCardVerifyUrl';
import StudentCardFront, { StudentCardBack } from './StudentCardFront';
import StaffCardFront, { StaffCardBack } from './StaffCardFront';
import type { CardMeta, EntityProfile, LostReportRow } from './IdCardDetailView';

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  return resolveLogoUrl(url);
}

export type CardExportOptions = {
  entityType: CardEntityType;
  data: IDCardData;
  colors: IDCardColors;
  fullName: string;
  onExporting?: (exporting: boolean, action?: string) => void;
};

const CAPTURE_CONTAINER_STYLE = `
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: ${CARD_WIDTH_PX}px;
  height: ${CARD_HEIGHT_PX}px;
  background: white;
  overflow: visible;
  z-index: -1;
`;

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
    window.setTimeout(resolve, 2000);
  });
}

async function waitForFonts(): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

function renderCardFace(
  entityType: CardEntityType,
  face: 'front' | 'back',
  data: IDCardData,
  colors: IDCardColors
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  container.style.cssText = CAPTURE_CONTAINER_STYLE;
  document.body.appendChild(container);
  const root = createRoot(container);

  const props = { data, colors, printMode: true as const };
  if (face === 'front') {
    root.render(entityType === 'STUDENT' ? <StudentCardFront {...props} /> : <StaffCardFront {...props} />);
  } else {
    root.render(entityType === 'STUDENT' ? <StudentCardBack {...props} /> : <StaffCardBack {...props} />);
  }

  return { container, root };
}

async function captureCardFace(
  entityType: CardEntityType,
  face: 'front' | 'back',
  data: IDCardData,
  colors: IDCardColors,
  scale = 1
): Promise<string> {
  const { container, root } = renderCardFace(entityType, face, data, colors);

  try {
    await new Promise((r) => window.setTimeout(r, 800));
    await waitForFonts();
    await waitForImages(container);

    const width = CARD_WIDTH_PX * scale;
    const height = CARD_HEIGHT_PX * scale;

    return await domtoimage.toPng(container, {
      width,
      height,
      quality: 1,
      bgcolor: '#ffffff',
      style: {
        transform: scale === 1 ? 'none' : `scale(${scale})`,
        transformOrigin: 'top left',
        width: `${CARD_WIDTH_PX}px`,
        height: `${CARD_HEIGHT_PX}px`,
      },
    });
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

export async function handleDownloadPDF(options: CardExportOptions, action = 'pdf') {
  const { entityType, data, colors, fullName, onExporting } = options;
  onExporting?.(true, action);

  try {
    const frontDataUrl = await captureCardFace(entityType, 'front', data, colors);
    const backDataUrl = await captureCardFace(entityType, 'back', data, colors);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [105, 148],
    });

    const cardW = 85.6;
    const cardH = 54;
    const pageW = 105;
    const pageH = 148;
    const gap = 8;
    const totalH = cardH * 2 + gap;
    const startX = (pageW - cardW) / 2;
    const startY = (pageH - totalH) / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');

    pdf.addImage(frontDataUrl, 'PNG', startX, startY, cardW, cardH);
    pdf.addImage(backDataUrl, 'PNG', startX, startY + cardH + gap, cardW, cardH);

    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.setLineDashPattern([1, 1.5], 0);
    pdf.rect(startX - 1, startY - 1, cardW + 2, cardH + 2);
    pdf.rect(startX - 1, startY + cardH + gap - 1, cardW + 2, cardH + 2);

    pdf.setFontSize(6);
    pdf.setTextColor(180, 180, 180);
    pdf.text('FRONT', startX, startY - 2);
    pdf.text('BACK', startX, startY + cardH + gap - 2);

    pdf.save(`ID-Card-${fullName.replace(/\s+/g, '-')}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    toast.error('PDF export failed. Please try again.');
  } finally {
    onExporting?.(false);
  }
}

export async function handleDownloadPNG(face: 'front' | 'back', options: CardExportOptions, action?: string) {
  const { entityType, data, colors, fullName, onExporting } = options;
  onExporting?.(true, action || face);

  try {
    const dataUrl = await captureCardFace(entityType, face, data, colors, 3);
    const link = document.createElement('a');
    link.download = `ID-Card-${face === 'front' ? 'Front' : 'Back'}-${fullName.replace(/\s+/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('PNG export failed:', error);
    toast.error('PNG export failed. Please try again.');
  } finally {
    onExporting?.(false);
  }
}

export async function handlePrintCard(options: CardExportOptions, action = 'print') {
  const { entityType, data, colors, onExporting } = options;
  onExporting?.(true, action);

  try {
    const frontDataUrl = await captureCardFace(entityType, 'front', data, colors);
    const backDataUrl = await captureCardFace(entityType, 'back', data, colors);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Print iframe unavailable');

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 105mm 148mm portrait; margin: 0; }
  body {
    width: 105mm; height: 148mm; background: white;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8mm; padding: 8mm;
  }
  .card-wrapper { width: 85.6mm; height: 54mm; position: relative; }
  .card-label {
    font-family: sans-serif; font-size: 6pt; color: #aaaaaa;
    letter-spacing: 2pt; text-transform: uppercase; margin-bottom: 1.5mm;
  }
  img { width: 85.6mm; height: 54mm; display: block; border-radius: 3.5mm; }
  .cut-line {
    position: absolute; inset: -1mm; border: 0.2mm dashed #cccccc;
    border-radius: 4mm; pointer-events: none;
  }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style></head><body>
  <div>
    <div class="card-label">FRONT</div>
    <div class="card-wrapper"><img src="${frontDataUrl}" /><div class="cut-line"></div></div>
  </div>
  <div>
    <div class="card-label">BACK</div>
    <div class="card-wrapper"><img src="${backDataUrl}" /><div class="cut-line"></div></div>
  </div>
</body></html>`);
    iframeDoc.close();

    await new Promise((r) => window.setTimeout(r, 600));
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    window.setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  } catch (error) {
    console.error('Print failed:', error);
    toast.error('Print failed. Please try again.');
  } finally {
    onExporting?.(false);
  }
}

/** @deprecated Use handlePrintCard */
export function handlePrint() {
  toast.error('Use Print from the card detail page.');
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export type CardEditorState = {
  entityType: CardEntityType;
  entityId: number;
  staffType?: string;
  data: IDCardData;
  colors: IDCardColors;
  readOnly?: boolean;
  cardMeta?: CardMeta | null;
  profile?: EntityProfile;
  lostReports?: LostReportRow[];
};

export function useCardLoader(
  entityType: CardEntityType | null,
  entityId: number | null,
  staffType?: string
) {
  const [state, setState] = useState<CardEditorState | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    try {
      const { apiService } = await import('@/services/api');
      const path =
        entityType === 'STUDENT'
          ? `/id-cards/student/${entityId}`
          : `/id-cards/staff/${entityId}?staffType=${staffType || 'teacher'}`;
      const res = await apiService.get<{
        entityType: CardEntityType;
        entityId: number;
        staffType?: string;
        colors: IDCardColors;
        cardData: IDCardData;
        readOnly?: boolean;
        cardMeta?: CardMeta | null;
        profile?: EntityProfile;
        lostReports?: LostReportRow[];
      }>(path);
      setState({
        entityType: res.entityType,
        entityId: res.entityId,
        staffType: res.staffType,
        data: {
          ...res.cardData,
          logoUrl: resolveMediaUrl(res.cardData.logoUrl),
          photoUrl: resolveMediaUrl(res.cardData.photoUrl),
          academicYear: formatIdCardAcademicYear(res.cardData.academicYear),
          qrUrl: res.cardData.qrUrl || resolveIdCardVerifyUrl(res.entityType, res.entityId),
        },
        colors: {
          ...res.colors,
          footerBg: res.colors.footerBg || res.colors.primaryColor,
          poweredByColor: res.colors.poweredByColor || res.colors.accentColor,
        },
        readOnly: res.readOnly,
        cardMeta: res.cardMeta ?? null,
        profile: res.profile,
        lostReports: res.lostReports ?? [],
      });
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, staffType]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, setState, loading, reload: load };
}

export function useCardExporting() {
  const [exporting, setExporting] = useState(false);
  const [exportAction, setExportAction] = useState<string | null>(null);
  const setExportState = useCallback((v: boolean, action?: string) => {
    setExporting(v);
    setExportAction(v ? action || null : null);
  }, []);
  return { exporting, exportAction, setExporting: setExportState };
}
