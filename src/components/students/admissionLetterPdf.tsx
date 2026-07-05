// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — html2pdf.js has no bundled types
import html2pdf from 'html2pdf.js';
import { createRoot } from 'react-dom/client';
import { resolveLogoUrl } from '@/services/tenantService';
import AdmissionLetterDocument, { type AdmissionLetterData } from './AdmissionLetterDocument';

const PDF_OPTIONS = {
  margin: [5, 5, 5, 5],
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
};

export type AdmissionLetterPdfOptions = {
  logoUrl?: string | null;
};

async function loadLetterImageDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const resolved = resolveLogoUrl(url);
  if (!resolved) return null;
  if (resolved.startsWith('data:')) return resolved;
  try {
    const res = await fetch(resolved, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll('img');
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          if (img.complete && img.naturalWidth > 0) {
            done();
            return;
          }
          img.onload = done;
          img.onerror = done;
          window.setTimeout(done, 3000);
        })
    )
  );
}

function applyPreparedImages(root: HTMLElement, data: AdmissionLetterData): void {
  const logoImg = root.querySelector<HTMLImageElement>('[data-admission-letter-logo]');
  const photoImg = root.querySelector<HTMLImageElement>('[data-admission-letter-photo]');
  if (logoImg && data.school.logoUrl?.startsWith('data:')) {
    logoImg.src = data.school.logoUrl;
    logoImg.removeAttribute('crossorigin');
  }
  if (photoImg && data.student.photoUrl?.startsWith('data:')) {
    photoImg.src = data.student.photoUrl;
    photoImg.removeAttribute('crossorigin');
  }
}

export function buildAdmissionLetterFilename(data: AdmissionLetterData): string {
  const student = (data.student.fullName || 'Student')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_');
  const adm = data.student.admissionNumber || data.student.studentId || 'letter';
  const version = data.versionNumber ? `_v${data.versionNumber}` : '';
  return `Admission_Letter_${adm}${version}_${student}.pdf`;
}

export async function downloadAdmissionLetterPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  await waitForImages(element);
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  await html2pdf()
    .set({ ...PDF_OPTIONS, filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf` })
    .from(element)
    .save();
}

async function prepareAdmissionLetterForPdf(
  data: AdmissionLetterData,
  options?: AdmissionLetterPdfOptions
): Promise<AdmissionLetterData> {
  const logoSource = data.school.logoUrl || options?.logoUrl || null;
  const [logoData, photoData, signatureData, stampData] = await Promise.all([
    loadLetterImageDataUrl(logoSource),
    loadLetterImageDataUrl(data.student.photoUrl),
    loadLetterImageDataUrl(data.config.signatureImage),
    loadLetterImageDataUrl(data.config.stampImage),
  ]);

  return {
    ...data,
    school: {
      ...data.school,
      logoUrl: logoData || logoSource,
    },
    student: {
      ...data.student,
      photoUrl: photoData || data.student.photoUrl,
    },
    config: {
      ...data.config,
      signatureImage: signatureData || data.config.signatureImage,
      stampImage: stampData || data.config.stampImage,
    },
  };
}

async function renderLetterOffScreen(data: AdmissionLetterData): Promise<{
  el: HTMLElement;
  cleanup: () => void;
}> {
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-12000px;top:0;width:794px;background:#fff;pointer-events:none;';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <AdmissionLetterDocument
      data={data}
      id="admission-letter-pdf-export"
      className="shadow-none rounded-none"
      pdfMode
    />
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const el = container.querySelector('.admission-letter-doc') as HTMLElement | null;
  if (!el) {
    root.unmount();
    container.remove();
    throw new Error('Could not render admission letter for PDF');
  }

  applyPreparedImages(el, data);

  return {
    el,
    cleanup: () => {
      root.unmount();
      container.remove();
    },
  };
}

export async function downloadAdmissionLetterPdfFromData(
  data: AdmissionLetterData,
  options?: AdmissionLetterPdfOptions
): Promise<void> {
  const prepared = await prepareAdmissionLetterForPdf(data, options);
  const { el, cleanup } = await renderLetterOffScreen(prepared);
  try {
    await downloadAdmissionLetterPdf(el, buildAdmissionLetterFilename(prepared));
  } finally {
    cleanup();
  }
}
