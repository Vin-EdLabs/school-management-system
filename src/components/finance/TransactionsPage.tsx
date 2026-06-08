import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { useData } from '../../contexts/DataContext';
import { reportService } from '../../services/reportService';
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from '../../utils/dateFormat';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Wallet,
} from 'lucide-react';

type TransactionType = 'income' | 'expense';

interface TransactionRow {
  id: string;
  rawId: string;
  date: string;
  recordedAt?: string;
  type: TransactionType;
  category: string;
  name: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: string;
  sourceModule: 'fees' | 'income' | 'expenses';
}

interface TransactionsPageProps {
  onNavigate?: (module: string) => void;
}

const ALL = '__all__';
const CURRENCY = 'GHS';

const money = (value: number) =>
  `${CURRENCY} ${Number(value || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

const methodMatches = (method: string, filter: string) => {
  if (filter === ALL) return true;
  const m = normalize(method);
  if (filter === 'cash') return m.includes('cash');
  if (filter === 'momo') return m.includes('momo') || m.includes('mobile money') || m.includes('mobile');
  if (filter === 'bank') return m.includes('bank') || m.includes('transfer');
  return true;
};

const isSameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const TransactionsPage: React.FC<TransactionsPageProps> = ({ onNavigate }) => {
  const { payments, income, expenses, students } = useData();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [methodFilter, setMethodFilter] = useState(ALL);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const transactions = useMemo<TransactionRow[]>(() => {
    const feePayments = payments.map((payment) => {
      const student = students.find((s) => s.id === payment.studentId);
      const studentName = student
        ? `${student.firstName} ${student.lastName}`.trim()
        : payment.studentId || 'Student';

      return {
        id: `FEE-${payment.id}`,
        rawId: payment.id,
        date: payment.date,
        recordedAt: payment.recordedAt,
        type: 'income' as const,
        category: 'School Fees',
        name: studentName,
        description: payment.notes || payment.receiptNumber || `Fee payment for ${payment.term || 'term'}`,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod || 'Not specified',
        status: 'Completed',
        sourceModule: 'fees' as const,
      };
    });

    const otherIncome = income
      .filter((item) => item.category !== 'Fee Payment')
      .map((item) => ({
        id: `INC-${item.id}`,
        rawId: item.id,
        date: item.date,
        recordedAt: item.recordedAt,
        type: 'income' as const,
        category: item.category || item.source || 'Other Income',
        name: item.source || item.receivedBy || 'Income',
        description: item.description || item.notes || item.receivedBy || '-',
        amount: item.amount,
        paymentMethod: item.paymentMethod || 'Not specified',
        status: 'Completed',
        sourceModule: 'income' as const,
      }));

    const expenseRows = expenses.map((expense) => ({
      id: `EXP-${expense.id}`,
      rawId: expense.id,
      date: expense.paymentDate,
      recordedAt: expense.recordedAt,
      type: 'expense' as const,
      category: expense.category || 'Expense',
      name: expense.payeeName || expense.vendor || expense.title || 'Expense',
      description: expense.description || expense.purpose || expense.notes || expense.title || '-',
      amount: expense.amount,
      paymentMethod: expense.paymentMethod || 'Not specified',
      status: 'Completed',
      sourceModule: 'expenses' as const,
    }));

    return [...feePayments, ...otherIncome, ...expenseRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [payments, income, expenses, students]);

  const categories = useMemo(
    () => [...new Set(transactions.map((row) => row.category).filter(Boolean))].sort(),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const q = normalize(searchTerm);
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return transactions.filter((row) => {
      const rowDate = row.date ? new Date(`${row.date}T12:00:00`) : null;
      if (from && rowDate && rowDate < from) return false;
      if (to && rowDate && rowDate > to) return false;
      if (typeFilter !== ALL && row.type !== typeFilter) return false;
      if (categoryFilter !== ALL && row.category !== categoryFilter) return false;
      if (!methodMatches(row.paymentMethod, methodFilter)) return false;

      if (!q) return true;
      return [
        row.id,
        row.date,
        row.type,
        row.category,
        row.name,
        row.description,
        row.paymentMethod,
        row.status,
        String(row.amount),
      ].some((value) => normalize(value).includes(q));
    });
  }, [transactions, fromDate, toDate, typeFilter, categoryFilter, methodFilter, searchTerm]);

  const summary = useMemo(() => {
    const today = new Date();
    return filteredTransactions.reduce(
      (acc, row) => {
        if (row.type === 'income') acc.income += row.amount;
        if (row.type === 'expense') acc.expenses += row.amount;
        if (row.date && isSameDate(new Date(`${row.date}T12:00:00`), today)) {
          acc.today += row.amount;
        }
        acc.net = acc.income - acc.expenses;
        return acc;
      },
      { income: 0, expenses: 0, net: 0, today: 0 }
    );
  }, [filteredTransactions]);

  const exportRows = () =>
    filteredTransactions.map((row) => ({
      Date: formatDisplayDate(row.date),
      Time: formatDisplayTime(row.recordedAt),
      Type: row.type === 'income' ? 'Income' : 'Expense',
      Category: row.category,
      Name: row.name,
      Description: row.description,
      Amount: row.amount,
      'Payment Method': row.paymentMethod,
      Status: row.status,
      ID: row.id,
    }));

  const handleExportExcel = async () => {
    if (filteredTransactions.length === 0) {
      toast({ title: 'No transactions to export', variant: 'destructive' });
      return;
    }
    await reportService.exportToExcel(
      exportRows(),
      `transactions_${new Date().toISOString().split('T')[0]}`,
      'Transactions'
    );
    toast({ title: 'Excel export ready' });
  };

  const handleExportPdf = () => {
    if (filteredTransactions.length === 0) {
      toast({ title: 'No transactions to export', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Transactions Report', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${formatDisplayDateTime(new Date())}`, 14, 23);
    doc.text(`Total Income: ${money(summary.income)} | Total Expenses: ${money(summary.expenses)} | Net: ${money(summary.net)}`, 14, 29);

    let y = 39;
    doc.setFontSize(8);
    doc.text('Date', 14, y);
    doc.text('Type', 35, y);
    doc.text('Category', 52, y);
    doc.text('Name / Description', 86, y);
    doc.text('Amount', 178, y, { align: 'right' });
    y += 4;
    doc.line(14, y, 196, y);
    y += 5;

    filteredTransactions.forEach((row) => {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.text(formatDisplayDate(row.date), 14, y);
      doc.text(row.type === 'income' ? 'Inc' : 'Exp', 35, y);
      doc.text(String(row.category || '-').slice(0, 20), 52, y);
      doc.text(`${row.name} - ${row.description}`.slice(0, 58), 86, y);
      doc.text(money(row.amount), 178, y, { align: 'right' });
      y += 6;
    });

    doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF export ready' });
  };

  const openModule = (module: string) => {
    setAddDialogOpen(false);
    if (window.location.pathname.endsWith('/finance/transactions')) {
      const base = window.location.pathname.replace(/\/finance\/transactions\/?$/, '') || '/';
      window.history.pushState({}, '', base);
    }
    onNavigate?.(module);
  };

  const summaryCards = [
    { label: 'Total Income', value: money(summary.income), icon: ArrowUpRight, tone: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { label: 'Total Expenses', value: money(summary.expenses), icon: ArrowDownRight, tone: 'text-red-600 bg-red-50 border-red-100' },
    { label: 'Net Balance', value: money(summary.net), icon: Wallet, tone: summary.net >= 0 ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-red-600 bg-red-50 border-red-100' },
    { label: "Today's Transactions Total", value: money(summary.today), icon: Wallet, tone: 'text-slate-700 bg-slate-50 border-slate-100' },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">Unified income, fee payment, and expense activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primaryAction" onClick={() => setAddDialogOpen(true)} className="h-9">
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
          <Button variant="outline" onClick={handleExportPdf} className="h-9">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} className="h-9">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border border-border bg-white shadow-sm dark:bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-lg font-bold text-foreground">{card.value}</p>
              </div>
              <div className={`rounded-full border p-2 ${card.tone}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border bg-white shadow-sm dark:bg-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 bg-white dark:bg-slate-950" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 bg-white dark:bg-slate-950" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Payment Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="h-9 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="momo">MoMo</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, description, ID"
                  className="h-9 bg-white pl-9 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-border bg-white shadow-sm dark:bg-card">
        <CardHeader className="border-b border-border bg-white px-4 py-3 dark:bg-card">
          <CardTitle className="text-base font-semibold text-foreground">
            Main Transactions Table ({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white dark:bg-card">
          <div className="overflow-x-auto bg-white dark:bg-card">
            <Table className="bg-white dark:bg-card">
              <TableHeader className="bg-white dark:bg-card">
                <TableRow className="border-border hover:bg-white dark:hover:bg-card">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Method</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white dark:bg-card">
                {filteredTransactions.length === 0 ? (
                  <TableRow className="border-border bg-white hover:bg-white dark:bg-card dark:hover:bg-card">
                    <TableCell colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No transactions found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="cursor-pointer border-border bg-white hover:bg-gray-50 dark:bg-card dark:hover:bg-muted/40"
                    >
                      <TableCell className="px-4 py-2.5 text-sm text-foreground">
                        {formatDisplayDate(row.date)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            row.type === 'income'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-red-200 bg-red-50 text-red-700'
                          }
                        >
                          {row.type === 'income' ? 'Inc' : 'Exp'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-sm text-foreground">{row.category}</TableCell>
                      <TableCell className="px-4 py-2.5 text-sm font-medium text-foreground">{row.name}</TableCell>
                      <TableCell className="max-w-[260px] px-4 py-2.5 text-sm text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate">{row.description || '-'}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {row.description || '-'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-sm font-semibold text-foreground">
                        {money(row.amount)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">{row.paymentMethod}</TableCell>
                      <TableCell className="px-4 py-2.5">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted">
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Transaction Detail</DialogTitle>
            <DialogDescription>
              {selected?.id} - {selected?.type === 'income' ? 'Income' : 'Expense'}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDisplayDate(selected.date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Time</p>
                <p className="font-medium">{formatDisplayTime(selected.recordedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium">{money(selected.amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{selected.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment Method</p>
                <p className="font-medium">{selected.paymentMethod}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{selected.name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Description</p>
                <p className="font-medium">{selected.description || '-'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Choose where to record this transaction using the existing finance forms.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="primaryAction" className="h-20 flex-col gap-1" onClick={() => openModule('income')}>
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
              Add Income
            </Button>
            <Button variant="primaryAction" className="h-20 flex-col gap-1" onClick={() => openModule('expenses')}>
              <ArrowDownRight className="h-5 w-5 text-red-600" />
              Add Expense
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionsPage;
