import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileText, Loader2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  generateInvoice,
  generateBulkInvoices,
  fetchInvoicePdfData,
  type Invoice,
  type BulkInvoiceSummary,
} from '@/services/invoiceApi';
import InvoiceDocument from './InvoiceDocument';
import { buildInvoiceFilename, downloadInvoicePdf } from './buildInvoicePdf';

async function downloadInvoiceById(invoice: Invoice) {
  const data = await fetchInvoicePdfData(invoice.id);
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-9999px';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<InvoiceDocument data={data} />);
  await new Promise((r) => setTimeout(r, 150));
  const el = host.firstElementChild as HTMLElement;
  if (el) {
    await downloadInvoicePdf(el, buildInvoiceFilename(invoice.invoiceNumber, invoice.studentName));
  }
  root.unmount();
  document.body.removeChild(host);
}

type BulkProps = {
  mode: 'bulk';
  termId?: number | null;
  classes: Array<{ id: string; className: string }>;
  className?: string;
};

type SingleProps = {
  mode: 'single';
  studentId: number;
  studentName?: string;
  termId?: number | null;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'secondary' | 'default';
  className?: string;
};

type GenerateInvoiceActionsProps = BulkProps | SingleProps;

export const GenerateInvoiceBulkButton: React.FC<Omit<BulkProps, 'mode'>> = (props) => (
  <GenerateInvoiceActions mode="bulk" {...props} />
);

export const GenerateInvoiceButton: React.FC<Omit<SingleProps, 'mode'>> = (props) => (
  <GenerateInvoiceActions mode="single" {...props} />
);

const GenerateInvoiceActions: React.FC<GenerateInvoiceActionsProps> = (props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [bulkClass, setBulkClass] = useState('all');
  const [bulkResult, setBulkResult] = useState<BulkInvoiceSummary | null>(null);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);

  if (props.mode === 'single') {
    const { studentId, studentName, termId, size = 'sm', variant = 'outline' } = props;

    const handleSingle = async () => {
      setLoading(true);
      try {
        const inv = await generateInvoice({
          student_id: studentId,
          term_id: termId ?? undefined,
          due_date: dueDate || undefined,
        });
        setLastInvoice(inv);
        toast.success(`Invoice ${inv.invoiceNumber} generated`);
        setOpen(true);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Could not generate invoice');
      } finally {
        setLoading(false);
      }
    };

    return (
      <>
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={loading}
          className={cn("gap-1.5", props.className)}
          onClick={() => void handleSingle()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Invoice
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className={detailDialogContentClass}>
            <DialogHeader className={detailDialogHeaderClass}>
              <DialogTitle>Invoice generated</DialogTitle>
            </DialogHeader>
            <DialogBody className={detailDialogBodyClass}>
              {lastInvoice && (
                <div className="space-y-3">
                  <p className="text-sm">
                    <strong>{lastInvoice.invoiceNumber}</strong> for {studentName || 'student'} — GHS{' '}
                    {(lastInvoice.outstanding ?? lastInvoice.totalDue).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <Button
                    className="w-full gap-2"
                    onClick={() => lastInvoice && void downloadInvoiceById(lastInvoice)}
                  >
                    <FileDown className="h-4 w-4" /> Download PDF
                  </Button>
                </div>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const { termId, classes, className } = props;

  const handleBulk = async () => {
    setLoading(true);
    try {
      const summary = await generateBulkInvoices({
        term_id: termId ?? undefined,
        class_id: bulkClass !== 'all' ? Number(bulkClass) : undefined,
        due_date: dueDate || undefined,
      });
      setBulkResult(summary);
      toast.success(`${summary.generated} invoice(s) generated`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bulk generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={`gap-2 ${className || ''}`}
        onClick={() => {
          setOpen(true);
          setBulkResult(null);
          setDueDate('');
          setBulkClass('all');
        }}
      >
        <FileText className="h-4 w-4" />
        Generate Invoices
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={detailDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>Generate invoices for class</DialogTitle>
          </DialogHeader>
          <DialogBody className={detailDialogBodyClass}>
            {!bulkResult ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={bulkClass} onValueChange={setBulkClass}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due date (optional)</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <Button className="w-full" disabled={loading} onClick={() => void handleBulk()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate
                </Button>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p>
                  <strong>{bulkResult.generated}</strong> generated, <strong>{bulkResult.skipped}</strong> skipped.
                  Total: <strong>GHS {bulkResult.totalInvoicedAmount.toLocaleString()}</strong>
                </p>
                {bulkResult.invoices.slice(0, 8).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                    <span className="truncate">{inv.invoiceNumber} · {inv.studentName}</span>
                    <Button size="sm" variant="ghost" onClick={() => void downloadInvoiceById(inv)}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" className="w-full" onClick={() => setOpen(false)}>Done</Button>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GenerateInvoiceActions;
