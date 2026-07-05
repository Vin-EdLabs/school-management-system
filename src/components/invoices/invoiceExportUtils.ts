import { createRoot } from 'react-dom/client';
import React from 'react';
import InvoiceDocument from './InvoiceDocument';
import type { InvoicePdfPayload } from '@/services/invoiceApi';
import { buildInvoiceFilename, downloadInvoicePdf, invoiceElementToPdfBlob } from './buildInvoicePdf';

export async function renderInvoiceElement(data: InvoicePdfPayload): Promise<{
  host: HTMLDivElement;
  element: HTMLElement;
  cleanup: () => void;
}> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-9999px';
  host.style.top = '0';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(InvoiceDocument, { data }));
  await new Promise((r) => setTimeout(r, 180));
  const element = host.firstElementChild as HTMLElement;
  if (!element) {
    root.unmount();
    document.body.removeChild(host);
    throw new Error('Could not render invoice');
  }
  return {
    host,
    element,
    cleanup: () => {
      root.unmount();
      if (host.parentNode) document.body.removeChild(host);
    },
  };
}

export async function downloadInvoicePayload(data: InvoicePdfPayload): Promise<void> {
  const { element, cleanup } = await renderInvoiceElement(data);
  try {
    await downloadInvoicePdf(
      element,
      buildInvoiceFilename(data.invoice.invoiceNumber, data.invoice.studentName)
    );
  } finally {
    cleanup();
  }
}

import { openPrintPreview } from '../../contexts/PrintPreviewContext';

export function printInvoiceElement(element: HTMLElement, title: string): void {
  openPrintPreview({
    title,
    html: `
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 8mm; size: A4 portrait; }
          @media print {
            body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: Arial, sans-serif; background: #fff; margin: 0; padding: 16px; }
        </style>
      </head>
      <body>${element.outerHTML}</body>
    </html>
  `,
  });
}

export async function printInvoicePayload(data: InvoicePdfPayload): Promise<void> {
  const { element, cleanup } = await renderInvoiceElement(data);
  try {
    printInvoiceElement(
      element,
      `Invoice ${data.invoice.invoiceNumber} — ${data.invoice.studentName || 'Student'}`
    );
  } finally {
    cleanup();
  }
}

export async function downloadInvoicesZipFromPayloads(payloads: InvoicePdfPayload[]): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const payload of payloads) {
    const { element, cleanup } = await renderInvoiceElement(payload);
    try {
      const blob = await invoiceElementToPdfBlob(element);
      zip.file(buildInvoiceFilename(payload.invoice.invoiceNumber, payload.invoice.studentName), blob);
    } finally {
      cleanup();
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoices_${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
