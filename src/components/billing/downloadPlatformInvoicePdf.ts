import { downloadInvoicePdf } from '@/components/invoices/buildInvoicePdf';
import type { PlatformInvoice } from '@/services/platformBillingApi';

export function platformInvoiceFilename(invoice: PlatformInvoice): string {
  const kind = invoice.status === 'paid' ? 'Receipt' : 'Invoice';
  return `${kind}_${invoice.invoiceNumber || invoice.id}.pdf`;
}

/** Reuses the same html2pdf pipeline already used for student fee invoices. */
export async function downloadPlatformInvoicePdf(element: HTMLElement, invoice: PlatformInvoice): Promise<void> {
  await downloadInvoicePdf(element, platformInvoiceFilename(invoice));
}
