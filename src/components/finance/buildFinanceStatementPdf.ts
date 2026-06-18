// Captures the on-screen preview DOM for pixel-accurate PDF export and print.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — html2pdf.js has no bundled types
import html2pdf from 'html2pdf.js';

export async function loadLogoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function buildFinanceStatementFilename(studentName: string, studentId: string): string {
  const safeName = studentName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const safeId = studentId.replace(/[^\w-]/g, '');
  const datePart = new Date().toISOString().split('T')[0];
  return `Finance_Statement_${safeName}_${safeId}_${datePart}.pdf`;
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll('img');
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

function prepareCaptureClone(previewElement: HTMLElement): { container: HTMLDivElement; clone: HTMLElement } {
  const container = document.createElement('div');
  container.className = 'finance-statement-print-root finance-statement-pdf-capture';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.background = '#fff';
  container.style.zIndex = '-1';

  const clone = previewElement.cloneNode(true) as HTMLElement;
  clone.classList.add('finance-statement-exporting');
  container.appendChild(clone);
  document.body.appendChild(container);
  return { container, clone };
}

export async function downloadFinanceStatementPdf(
  previewElement: HTMLElement,
  filename: string
): Promise<void> {
  const { container, clone } = prepareCaptureClone(previewElement);
  await waitForImages(clone);

  try {
    const worker = html2pdf()
      .set({
        margin: [5, 5, 5, 5],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollY: 0,
          scrollX: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          before: ['.fs-payment-section', '.fs-account-summary-section'],
        },
      })
      .from(clone)
      .toPdf();

    const pdf = await worker.get('pdf');
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Page ${i} of ${total}`,
        pdf.internal.pageSize.getWidth() / 2,
        pdf.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export function printFinanceStatementPreview(previewElement: HTMLElement): void {
  const clone = previewElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.fs-no-print, button, [type="button"]').forEach(el => el.remove());
  clone.querySelectorAll('.hidden').forEach(el => {
    (el as HTMLElement).style.display = '';
    el.classList.remove('hidden');
  });

  const headStylesheets = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map(el => el.outerHTML)
    .join('\n');

  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>Finance Statement</title>
        ${headStylesheets}
        <style>
          @page { margin: 5mm; size: A4 portrait; }
          @media print {
            body, body * { visibility: visible !important; }
            .fs-no-print, .fs-no-print *, button, button * { display: none !important; }
            body {
              margin: 0 !important; padding: 0 !important;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            color: #000; background: #fff; margin: 10px; font-size: 12px;
          }
          .finance-statement-preview {
            max-width: 800px; margin: 0 auto;
            padding: 0;
          }
          img { max-width: 100%; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 4px 6px; vertical-align: middle; }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
        <script>setTimeout(function(){window.print()},500)</script>
      </body>
    </html>
  `);
  win.document.close();
}
