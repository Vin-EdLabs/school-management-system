// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import html2pdf from 'html2pdf.js';
import type { InvoicePdfPayload } from '@/services/invoiceApi';

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll('img');
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  );
}

const PDF_OPTIONS = {
  margin: [8, 8, 8, 8],
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, allowTaint: true },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
};

export async function invoiceElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  await waitForImages(element);
  return html2pdf().set(PDF_OPTIONS).from(element).outputPdf('blob');
}

export async function downloadInvoicePdf(element: HTMLElement, filename: string): Promise<void> {
  await waitForImages(element);
  await html2pdf().set({ ...PDF_OPTIONS, filename }).from(element).save();
}

export function buildInvoiceFilename(invoiceNumber: string, studentName?: string): string {
  const safe = (studentName || 'Student').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  return `Invoice_${invoiceNumber}_${safe}.pdf`;
}

export async function downloadInvoicesZip(
  payloads: InvoicePdfPayload[],
  render: (payload: InvoicePdfPayload, container: HTMLElement) => HTMLElement
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    for (const payload of payloads) {
      const el = render(payload, container);
      container.appendChild(el);
      await waitForImages(el);
      const blob = await invoiceElementToPdfBlob(el);
      zip.file(buildInvoiceFilename(payload.invoice.invoiceNumber, payload.invoice.studentName), blob);
      container.removeChild(el);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoices_${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    document.body.removeChild(container);
  }
}
