import React from 'react';
import { resolveLogoUrl } from '@/services/tenantService';
import { formatDisplayDate } from '@/utils/dateFormat';
import type { InvoicePdfPayload } from '@/services/invoiceApi';

const GH = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

type InvoiceDocumentProps = {
  data: InvoicePdfPayload;
  className?: string;
};

const InvoiceDocument = React.forwardRef<HTMLDivElement, InvoiceDocumentProps>(({ data, className }, ref) => {
  const { invoice, school, paymentAccounts } = data;
  const logo = resolveLogoUrl(school.logoUrl);
  const primary = school.primaryColor || '#1a3a6b';

  const totalBilled =
    invoice.totalBilled ??
    roundMoney(invoice.termFee + invoice.individualCharges + invoice.arrears);
  const amountPaid = invoice.amountPaid ?? 0;
  const creditApplied = invoice.creditApplied ?? 0;
  const discountAmount = invoice.discountAmount ?? 0;

  const lineItems = invoice.lineItems?.length
    ? invoice.lineItems
    : [
        ...(invoice.termFee > 0 ? [{ description: `Tuition Fee — ${invoice.termLabel || 'Current term'}`, amount: invoice.termFee }] : []),
        ...(invoice.individualCharges > 0 ? [{ description: 'Individual charges', amount: invoice.individualCharges }] : []),
        ...(invoice.arrears > 0 ? [{ description: 'Arrears', amount: invoice.arrears }] : []),
        ...(creditApplied > 0 ? [{ description: 'Credit Applied', amount: -creditApplied }] : []),
        ...(amountPaid > 0 ? [{ description: 'Payments Received', amount: -amountPaid }] : []),
      ];

  const lineItemsTotal = roundMoney(lineItems.reduce((sum, line) => sum + line.amount, 0));
  const balanceDue = invoice.outstanding ?? invoice.totalDue ?? lineItemsTotal;

  return (
    <div
      ref={ref}
      className={className}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111', background: '#fff', padding: 32, maxWidth: 800, margin: '0 auto' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {logo ? (
            <img src={logo} alt="" style={{ width: 72, height: 72, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 72, height: 72, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>LOGO</div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: primary }}>{school.name}</div>
            {school.address ? <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{school.address}</div> : null}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, color: primary }}>INVOICE</div>
          <div style={{ fontSize: 12, marginTop: 8 }}><strong>Invoice #:</strong> {invoice.invoiceNumber}</div>
          <div style={{ fontSize: 12 }}><strong>Issue Date:</strong> {formatDisplayDate(invoice.issueDate)}</div>
          {invoice.dueDate ? (
            <div style={{ fontSize: 12 }}><strong>Due Date:</strong> {formatDisplayDate(invoice.dueDate)}</div>
          ) : null}
        </div>
      </div>

      <div style={{ marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>Bill To</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{invoice.studentName}</div>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Student ID: {invoice.studentCode || '—'}</div>
        <div style={{ fontSize: 13, color: '#475569' }}>Class: {invoice.className || '—'}</div>
        {invoice.termLabel ? <div style={{ fontSize: 13, color: '#475569' }}>Term: {invoice.termLabel}</div> : null}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${primary}` }}>
            <th style={{ textAlign: 'left', padding: '10px 8px' }}>Description</th>
            <th style={{ textAlign: 'right', padding: '10px 8px', width: 140 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '10px 8px' }}>{line.description}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                {line.amount < 0 ? `-${GH(Math.abs(line.amount))}` : GH(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 }}>
        <tbody>
          {totalBilled > 0 && (discountAmount > 0 || creditApplied > 0 || amountPaid > 0) ? (
            <>
              <tr>
                <td style={{ padding: '6px 8px', color: '#64748b' }}>Term bill subtotal</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{GH(totalBilled)}</td>
              </tr>
              {discountAmount > 0 ? (
                <tr>
                  <td style={{ padding: '6px 8px', color: '#64748b' }}>
                    {invoice.discountLabel || 'Less beneficiary discount'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>
                    -{GH(discountAmount)}
                  </td>
                </tr>
              ) : null}
              {creditApplied > 0 ? (
                <tr>
                  <td style={{ padding: '6px 8px', color: '#64748b' }}>Less credit applied</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>
                    -{GH(creditApplied)}
                  </td>
                </tr>
              ) : null}
              {amountPaid > 0 ? (
                <tr>
                  <td style={{ padding: '6px 8px', color: '#64748b' }}>Less payments received</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>
                    -{GH(amountPaid)}
                  </td>
                </tr>
              ) : null}
            </>
          ) : null}
          <tr style={{ borderTop: `2px solid ${primary}` }}>
            <td style={{ padding: '12px 8px', fontWeight: 800, fontSize: 14 }}>
              {balanceDue <= 0 ? 'BALANCE DUE' : 'AMOUNT DUE NOW'}
            </td>
            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, fontSize: 16, fontFamily: 'monospace', color: primary }}>
              {GH(Math.max(0, balanceDue))}
            </td>
          </tr>
          {balanceDue <= 0 && (amountPaid > 0 || creditApplied > 0) ? (
            <tr>
              <td colSpan={2} style={{ padding: '8px', fontSize: 12, color: '#059669', fontWeight: 600 }}>
                Paid in full — thank you.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {paymentAccounts.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Payment Methods Accepted</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
            {paymentAccounts.map((a, i) => (
              <li key={i}>
                {a.name}
                {a.type === 'bank' && a.bankName ? ` — ${a.bankName}` : ''}
                {a.accountNumber ? ` (${a.accountNumber})` : ''}
                {a.momoNumber ? ` — MoMo: ${a.momoNumber}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : school.bankDetails ? (
        <div style={{ marginBottom: 20, fontSize: 12, whiteSpace: 'pre-wrap' }}>
          <strong>Payment Details:</strong><br />{school.bankDetails}
        </div>
      ) : null}

      <div style={{ fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <p style={{ margin: '0 0 8px' }}>Amounts reflect the student&apos;s live fee account. Payments recorded after issue date are included above.</p>
        <p style={{ margin: '0 0 8px' }}>Please make payment by the due date above. Questions? Contact the school office.</p>
        {school.contact ? <p style={{ margin: '0 0 4px' }}>Phone: {school.contact}</p> : null}
        {school.email ? <p style={{ margin: '0 0 4px' }}>Email: {school.email}</p> : null}
        {school.footer ? <p style={{ margin: '8px 0 0', fontStyle: 'italic' }}>{school.footer}</p> : null}
      </div>
    </div>
  );
});

InvoiceDocument.displayName = 'InvoiceDocument';
export default InvoiceDocument;
