import type { jsPDF } from 'jspdf';

export async function loadImageDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Image conversion failed'));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function logoImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,/i);
  if (!match) return 'PNG';
  const ext = match[1].toUpperCase();
  return ext === 'JPG' ? 'JPEG' : (ext as 'PNG' | 'JPEG');
}

/** Classic school report header — matches discount-student PDF styling. Returns Y for table start. */
export function drawClassicSchoolPdfHeader(
  doc: jsPDF,
  options: {
    schoolName: string;
    logoDataUrl: string | null;
    reportTitle: string;
    metaLines: string[];
    margin?: number;
  }
): number {
  const margin = options.margin ?? 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerTop = 18;
  const headerHeight = 24;

  if (options.logoDataUrl) {
    doc.addImage(
      options.logoDataUrl,
      logoImageFormat(options.logoDataUrl),
      margin,
      headerTop - 2,
      24,
      24
    );
  }

  const titleX = options.logoDataUrl ? margin + 32 : margin;

  doc.setTextColor(34, 34, 34);
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text(options.schoolName.trim() || 'School Name', titleX, headerTop + 6);

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(options.reportTitle, titleX, headerTop + 12);

  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);
  let metaY = headerTop + headerHeight + 4;
  for (const line of options.metaLines) {
    doc.text(line, margin, metaY);
    metaY += 6;
  }

  doc.setDrawColor(45, 45, 45);
  doc.setLineWidth(0.35);
  doc.line(margin, metaY + 2, pageWidth - margin, metaY + 2);

  doc.setTextColor(0, 0, 0);
  return metaY + 10;
}

export function formatPdfMoney(amount: number): string {
  return Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function pdfLastTableY(doc: jsPDF): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return typeof t?.finalY === 'number' ? t.finalY : 40;
}
