import { apiService } from './api';

export type InvoiceLineItem = { description: string; amount: number };

export type Invoice = {
  id: number;
  tenantId: number;
  studentId: number;
  termId: number | null;
  academicYearId: number | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  termFee: number;
  individualCharges: number;
  arrears: number;
  creditApplied: number;
  totalDue: number;
  status: string;
  liveStatus: string;
  lineItems: InvoiceLineItem[];
  generatedByUserId: number | null;
  createdAt: string;
  studentName?: string;
  studentCode?: string;
  className?: string;
  termLabel?: string;
  generatedByName?: string;
  outstanding?: number;
  totalBilled?: number;
  amountPaid?: number;
  discountAmount?: number;
  discountLabel?: string | null;
};

export type InvoicePdfPayload = {
  invoice: Invoice;
  school: {
    name: string;
    address: string;
    contact: string;
    email: string;
    footer: string;
    bankDetails: string;
    logoUrl: string | null;
    primaryColor: string;
  };
  paymentAccounts: Array<{
    name: string;
    type: string;
    accountNumber: string | null;
    bankName: string | null;
    momoNumber: string | null;
  }>;
};

export type BulkInvoiceSummary = {
  generated: number;
  skipped: number;
  totalInvoicedAmount: number;
  invoices: Invoice[];
  existingInvoices?: Invoice[];
  skippedStudents: Array<{ studentId: number; studentName: string; reason: string }>;
};

export async function listInvoices(params?: {
  termId?: number | null;
  classId?: number | null;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Invoice[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.termId) q.set('termId', String(params.termId));
  if (params?.classId) q.set('classId', String(params.classId));
  if (params?.status && params.status !== 'all') q.set('status', params.status);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiService.get(`/invoices${qs ? `?${qs}` : ''}`);
}

export async function generateInvoice(body: {
  student_id: number;
  term_id?: number | null;
  due_date?: string | null;
}): Promise<Invoice & { refreshed?: boolean }> {
  return apiService.post('/invoices/generate', body);
}

export async function generateBulkInvoices(body: {
  term_id?: number | null;
  class_id?: number | null;
  due_date?: string | null;
}): Promise<BulkInvoiceSummary> {
  return apiService.post('/invoices/generate-bulk', body);
}

export async function fetchInvoicePdfData(invoiceId: number, parent = false): Promise<InvoicePdfPayload> {
  const path = parent ? `/parent/invoices/${invoiceId}/pdf-data` : `/invoices/${invoiceId}/pdf-data`;
  return apiService.get(path);
}

export async function listParentInvoices(termId?: number): Promise<{ items: Invoice[]; total: number }> {
  const q = termId ? `?termId=${termId}` : '';
  return apiService.get(`/parent/invoices${q}`);
}

export function invoiceStatusLabel(status: string): string {
  switch (status) {
    case 'paid': return 'Paid';
    case 'partially_paid': return 'Partially Paid';
    case 'overdue': return 'Overdue';
    case 'issued': return 'Issued';
    default: return status;
  }
}

export function invoiceStatusClass(status: string): string {
  switch (status) {
    case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'partially_paid': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
