import React from 'react';
import type { PlatformInvoice, InvoiceBranding } from '@/services/platformBillingApi';

const TEAL = '#0D7377';
const TEAL_LIGHT = '#F0FDFA';
const GREEN = '#059669';
const DARK = '#1A1A2E';
const GRAY = '#6B7280';

/** ScholarNerve's actual app icon/favicon — same asset used everywhere else in the app. */
export const FALLBACK_LOGO_URL = '/android-chrome-192x192.png';

export type { InvoiceBranding };

export type BillToInfo = {
  name: string;
  addressLine?: string | null;
  cityCountry?: string | null;
  email?: string | null;
  phone?: string | null;
};

export const DEFAULT_INVOICE_BRANDING: InvoiceBranding = {
  companyName: 'ScholarNerve',
  tagline: 'Empowering minds through intelligent learning',
  address: 'Accra, Ghana',
  email: 'scholarnerve@gmail.com',
  phone: '+233 20 000 0000',
  bankName: 'Example Bank Ghana',
  bankAccountName: 'ScholarNerve',
  bankAccountNumber: '0123456789',
  momoNumber: '+233 20 000 0000',
  defaultNotes:
    'Thank you for choosing ScholarNerve. This invoice covers your subscription for the period indicated. For any questions regarding this invoice, please contact us.',
  logoUrl: null,
};

function money(n: number) {
  return `GH₵ ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLongDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

function formatShortDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: GRAY, marginBottom: 4 }}>
    {children}
  </div>
);

type Props = {
  invoice: PlatformInvoice;
  billTo: BillToInfo;
  branding?: InvoiceBranding;
  children?: React.ReactNode;
};

const PlatformInvoiceDocument = React.forwardRef<HTMLDivElement, Props>(({ invoice, billTo, branding = DEFAULT_INVOICE_BRANDING, children }, ref) => {
  const isPaid = invoice.status === 'paid';
  const isWaived = invoice.status === 'waived';
  const isSettled = isPaid || isWaived;
  const documentTitle = isSettled ? 'RECEIPT' : 'INVOICE';
  const accentColor = isSettled ? GREEN : TEAL;
  const displayedAmount = isSettled ? invoice.paidAmount ?? invoice.finalAmount : invoice.finalAmount;
  const hasDiscount = invoice.finalAmount < invoice.computedAmount;
  const discountAmount = Math.max(0, invoice.computedAmount - invoice.finalAmount);
  const periodSub =
    invoice.periodStart && invoice.periodEnd
      ? `${formatShortDate(invoice.periodStart)} – ${formatShortDate(invoice.periodEnd)}`
      : invoice.periodLabel || '';

  const paymentMethodLabel = isWaived
    ? 'Waived by ScholarNerve'
    : invoice.paystackReference
      ? 'Paystack'
      : 'ScholarNerve Billing';

  return (
    <div
      ref={ref}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: DARK,
        background: '#fff',
        maxWidth: 760,
        margin: '0 auto',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(13,115,119,0.12)',
      }}
    >
      <div style={{ height: 8, background: TEAL }} />

      <div style={{ padding: '36px 44px 30px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <img
              src={branding.logoUrl || FALLBACK_LOGO_URL}
              alt=""
              crossOrigin="anonymous"
              style={{ width: 48, height: 48, objectFit: 'contain', marginTop: 2, borderRadius: 10 }}
            />
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: DARK, lineHeight: 1.2 }}>{branding.companyName}</div>
              <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2, maxWidth: 220 }}>{branding.tagline}</div>
              <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>{branding.address}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1, color: DARK }}>{documentTitle}</div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: GRAY, lineHeight: 1.7 }}>
              {isSettled ? (
                <>
                  <div>
                    <strong style={{ color: DARK }}>Receipt number</strong> {invoice.invoiceNumber}
                  </div>
                  <div>
                    <strong style={{ color: DARK }}>Invoice number</strong> {invoice.invoiceNumber}
                  </div>
                  <div>
                    <strong style={{ color: DARK }}>Date paid</strong> {formatLongDate(invoice.paidAt)}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong style={{ color: DARK }}>Invoice number</strong> {invoice.invoiceNumber}
                  </div>
                  <div>
                    <strong style={{ color: DARK }}>Date of issue</strong> {formatLongDate(invoice.createdAt)}
                  </div>
                  <div>
                    <strong style={{ color: DARK }}>Date due</strong> {formatLongDate(invoice.dueDate)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: `linear-gradient(to right, ${TEAL}, ${TEAL}22)`, margin: '24px 0' }} />

        {/* FROM / BILL TO */}
        <div style={{ display: 'flex', gap: 40, marginBottom: 26 }}>
          <div style={{ flex: 1 }}>
            <Label>From</Label>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK }}>{branding.companyName}</div>
            <div style={{ fontSize: 12.5, color: GRAY, marginTop: 3, lineHeight: 1.6 }}>
              {branding.address}
              <br />
              {branding.email}
              <br />
              {branding.phone}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Label>Bill To</Label>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: TEAL }}>{billTo.name}</div>
            <div style={{ fontSize: 12.5, color: GRAY, marginTop: 3, lineHeight: 1.6 }}>
              {billTo.addressLine ? (
                <>
                  {billTo.addressLine}
                  <br />
                </>
              ) : null}
              {billTo.cityCountry ? (
                <>
                  {billTo.cityCountry}
                  <br />
                </>
              ) : null}
              {billTo.email || ''}
            </div>
          </div>
        </div>

        {/* Amount banner */}
        <div style={{ fontSize: 19, fontWeight: 800, color: accentColor, marginBottom: 18 }}>
          {money(displayedAmount)} {isPaid ? 'paid on' : isWaived ? 'waived on' : 'due'}{' '}
          {isSettled ? formatLongDate(invoice.paidAt) : formatLongDate(invoice.dueDate)}
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 4 }}>
          <thead>
            <tr style={{ background: TEAL, color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, borderRadius: '8px 0 0 0' }}>
                Description
              </th>
              <th style={{ textAlign: 'center', padding: '10px 10px', fontWeight: 700, fontSize: 11, width: 56 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700, fontSize: 11, width: 100 }}>
                Unit price
              </th>
              <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, width: 110, borderRadius: '0 8px 0 0' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: TEAL_LIGHT }}>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, color: DARK }}>{branding.companyName} Subscription</div>
                {periodSub ? <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>{periodSub}</div> : null}
              </td>
              <td style={{ padding: '12px 10px', textAlign: 'center', color: DARK }}>{invoice.studentCount}</td>
              <td style={{ padding: '12px 10px', textAlign: 'right', color: DARK }}>{money(invoice.pricePerStudent)}</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: DARK }}>
                {money(invoice.computedAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 22 }}>
          <tbody>
            <tr>
              <td style={{ padding: '10px 14px', color: GRAY }} colSpan={3}>
                Subtotal
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: DARK }}>{money(invoice.computedAmount)}</td>
            </tr>
            {hasDiscount ? (
              <tr>
                <td style={{ padding: '2px 14px', color: GREEN }} colSpan={3}>
                  {isWaived ? 'ScholarNerve discount — fully waived' : 'Discount / adjustment'}
                </td>
                <td style={{ padding: '2px 14px', textAlign: 'right', color: GREEN }}>-{money(discountAmount)}</td>
              </tr>
            ) : null}
            <tr style={{ borderTop: `1px solid #e5e7eb` }}>
              <td style={{ padding: '10px 14px', fontWeight: 700, color: DARK }} colSpan={3}>
                Total
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: DARK }}>
                {money(invoice.finalAmount)}
              </td>
            </tr>
            <tr style={{ background: isSettled ? '#ECFDF5' : TEAL_LIGHT }}>
              <td
                style={{
                  padding: '12px 14px',
                  fontWeight: 800,
                  color: accentColor,
                  borderRadius: '8px 0 0 8px',
                }}
                colSpan={3}
              >
                {isPaid ? 'Amount Paid' : isWaived ? 'Amount Waived' : 'Amount Due'}
              </td>
              <td
                style={{
                  padding: '12px 14px',
                  textAlign: 'right',
                  fontWeight: 800,
                  fontSize: 14,
                  color: accentColor,
                  borderRadius: '0 8px 8px 0',
                }}
              >
                {money(displayedAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        {isSettled ? (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 8 }}>Payment History</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: TEAL, color: '#fff' }}>
                  <th style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 700, fontSize: 10.5, borderRadius: '8px 0 0 0' }}>
                    Payment method
                  </th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 700, fontSize: 10.5 }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 700, fontSize: 10.5 }}>Amount paid</th>
                  <th style={{ textAlign: 'right', padding: '9px 14px', fontWeight: 700, fontSize: 10.5, borderRadius: '0 8px 0 0' }}>
                    Receipt number
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: TEAL_LIGHT }}>
                  <td style={{ padding: '10px 14px', color: DARK }}>{paymentMethodLabel}</td>
                  <td style={{ padding: '10px 10px', color: DARK }}>{formatShortDate(invoice.paidAt)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: DARK }}>{money(displayedAmount)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: DARK, fontFamily: 'monospace' }}>
                    {invoice.invoiceNumber}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 6 }}>Payment Instructions</div>
            <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.7 }}>
              Please make payment via bank transfer or mobile money to the details below. Include the invoice number as
              the payment reference.
              <br />
              {branding.bankName ? (
                <>
                  <strong style={{ color: DARK }}>Bank:</strong> {branding.bankName}
                  <br />
                </>
              ) : null}
              {branding.bankAccountName ? (
                <>
                  <strong style={{ color: DARK }}>Account Name:</strong> {branding.bankAccountName}
                  <br />
                </>
              ) : null}
              {branding.bankAccountNumber ? (
                <>
                  <strong style={{ color: DARK }}>Account Number:</strong> {branding.bankAccountNumber}
                  <br />
                </>
              ) : null}
              {branding.momoNumber ? (
                <>
                  <strong style={{ color: DARK }}>Mobile Money:</strong> {branding.momoNumber}
                </>
              ) : null}
            </div>
          </div>
        )}

        {(invoice.note || branding.defaultNotes) && !isSettled ? (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.7 }}>
              {invoice.note ? <div style={{ marginBottom: 6 }}>{invoice.note}</div> : null}
              {branding.defaultNotes}
            </div>
          </div>
        ) : null}

        {isSettled && invoice.note ? (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.7 }}>{invoice.note}</div>
          </div>
        ) : null}

        {children ? <div style={{ marginTop: 8, marginBottom: 4 }}>{children}</div> : null}

        <div style={{ height: 1, background: '#e5e7eb', margin: '22px 0 16px' }} />
        <div style={{ textAlign: 'center', fontSize: 11, color: GRAY, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: DARK }}>
            {branding.companyName} • {branding.address}
          </div>
          <div>
            {isSettled
              ? 'Thank you for your payment. This receipt confirms that your payment has been successfully processed.'
              : 'This is a computer-generated invoice and does not require a signature.'}
          </div>
        </div>
      </div>

      <div style={{ height: 8, background: TEAL }} />
    </div>
  );
});

PlatformInvoiceDocument.displayName = 'PlatformInvoiceDocument';

export default PlatformInvoiceDocument;
