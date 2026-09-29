import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Download, DollarSign, TrendingUp, 
  Users, ChevronDown, FileText,
  ArrowUpRight, ArrowDownRight, UserCheck, 
  Wallet, GraduationCap, Clock, AlertCircle, RefreshCw,
  Receipt, Landmark
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, 
  Cell, AreaChart, Area
} from 'recharts';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useSchool } from '@/contexts/SchoolContext';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { formatDisplayDate } from '@/utils/dateFormat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import './AdvancedReports.css';
import { formatAcademicYearLabel } from '@/utils/academicYearDisplay';
import { normalizeFinancialSummary } from '@/hooks/useReportQueries';
import { downloadFinancialReportPdf } from './buildFinancialReportPdf';
import { useFinanceRealtime } from '@/hooks/useFinanceRealtime';
import { useTermStatus } from '@/contexts/TermStatusContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';

type AcademicTermRow = {
  id: number;
  term_name: string;
  year: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
};

// --- Types ---
interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  trend?: { value: string; positive: boolean };
  progress?: number;
  icon?: React.ComponentType<{ className?: string; size?: number | string }>;
  accentColor?: 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'violet';
  delay?: number;
}

// --- Components ---

const AnimatedNumber = ({ value, prefix = "", duration = 1000 }: { value: number; prefix?: string; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.floor(value);
    if (start === end) {
      setDisplayValue(end);
      return;
    }

    let totalMiliseconds = duration;
    let incrementTime = Math.max(10, (totalMiliseconds / Math.abs(end || 1)) * 10);
    let step = end / (totalMiliseconds / incrementTime);

    let timer = setInterval(() => {
      start += step;
      if ((step > 0 && start >= end) || (step < 0 && start <= end)) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span className="report-number-font">{prefix}{displayValue.toLocaleString()}</span>;
};

const StatCard = ({
  label,
  value,
  subtext,
  trend,
  progress,
  icon: Icon,
  accentColor = 'blue',
  delay = 0,
}: StatCardProps) => {
  const numericValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  const prefix = value.includes('GHS') ? 'GHS ' : '';

  const accentStyles = {
    amber: {
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/15',
      progressFill: 'from-amber-500 to-amber-400',
      borderHover: 'hover:border-amber-400/50',
    },
    emerald: {
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/15',
      progressFill: 'from-emerald-500 to-emerald-400',
      borderHover: 'hover:border-emerald-400/50',
    },
    rose: {
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/15',
      progressFill: 'from-rose-500 to-rose-400',
      borderHover: 'hover:border-rose-400/50',
    },
    blue: {
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/15',
      progressFill: 'from-blue-500 to-blue-400',
      borderHover: 'hover:border-blue-400/50',
    },
    indigo: {
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-500/15',
      progressFill: 'from-indigo-500 to-indigo-400',
      borderHover: 'hover:border-indigo-400/50',
    },
    violet: {
      iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 dark:bg-violet-500/15',
      progressFill: 'from-violet-500 to-violet-400',
      borderHover: 'hover:border-violet-400/50',
    },
  }[accentColor] || {
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    progressFill: 'from-blue-500 to-blue-400',
    borderHover: 'hover:border-blue-400/50',
  };

  return (
    <div 
      className={`group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 ${accentStyles.borderHover} animate-entrance flex flex-col justify-between`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div>
        {/* Header: Full label with Icon - never clipped */}
        <div className="flex items-center gap-2.5 mb-2.5">
          {Icon && (
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentStyles.iconBg}`}>
              <Icon size={18} />
            </div>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {label}
          </span>
        </div>

        {/* Main Metric Value */}
        <div className="my-1 flex items-baseline">
          <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {isNaN(numericValue) ? (
              value
            ) : (
              <AnimatedNumber value={numericValue} prefix={prefix} duration={1200} />
            )}
          </span>
        </div>
      </div>

      {/* Footer / Subtext & Trend Badge */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
        {progress !== undefined ? (
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">{subtext}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${accentStyles.progressFill} transition-all duration-1000`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {trend && (
              <div
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                  trend.positive
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                }`}
              >
                {trend.positive ? <ArrowUpRight size={12} className="shrink-0" /> : <ArrowDownRight size={12} className="shrink-0" />}
                <span>{trend.value}</span>
              </div>
            )}
            <span className="text-slate-500 dark:text-slate-400 font-normal">
              {subtext}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const MiniStatCard = ({
  label,
  value,
  icon: Icon,
  accent = 'blue',
  delay = 0,
}: {
  label: string;
  value: string;
  icon: any;
  accent?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'violet';
  delay?: number;
}) => {
  const accentStyles = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/15',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/15',
  }[accent] || 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15';

  return (
    <div 
      className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 animate-entrance flex flex-col justify-between"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {label}
        </span>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accentStyles}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
        {value}
      </div>
    </div>
  );
};

const AdvancedReports = () => {
  const { theme } = useTheme();
  const { school } = useSchool();
  const {
    setViewingTermLabel,
    isTermClosedByLabel,
    isBrowsingClosedTerm,
    viewingTermLabel,
    viewingLedgerTermId,
  } = useTermStatus();
  const { currentTerm: contextTerm, currentYear: contextYear, activeLedgerTermId } = useActiveTerm();
  const [academicTerms, setAcademicTerms] = useState<AcademicTermRow[]>([]);
  const [activeYearKey, setActiveYearKey] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
  const [periodReady, setPeriodReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // financial-only reports component (academic reporting moved to separate module)
  const [lastSync, setLastSync] = useState(new Date());

  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [feesByClass, setFeesByClass] = useState<any[]>([]);
  const [outstandingFees, setOutstandingFees] = useState<any[]>([]);
  const [expenditure, setExpenditure] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [incomeVsExpense, setIncomeVsExpense] = useState<any[]>([]);
  const [incomeRows, setIncomeRows] = useState<any[]>([]);
  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [fundTransfers, setFundTransfers] = useState<any[]>([]);
  const [collectionsByAccount, setCollectionsByAccount] = useState<any[]>([]);

  const stripYear = (n: string) => n.replace(/\s+\d{4}(\s*\/\s*\d{4})?$/, '').trim();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiService.get<{ current_term?: string; current_year?: string }>('/settings'),
      apiService.get<any[]>('/settings/academic-terms').catch(() => []),
    ])
      .then(([s, termsRaw]) => {
        if (cancelled) return;
        const list: AcademicTermRow[] = (Array.isArray(termsRaw) ? termsRaw : []).map((t: any) => ({
          id: Number(t.id),
          term_name: String(t.term_name || '').trim(),
          year: String(t.year || '').trim(),
          start_date: t.start_date,
          end_date: t.end_date,
          is_active: !!t.is_active,
        }));
        setAcademicTerms(list);

        // When browsing a closed-term snapshot, lock reports to that term.
        const browseLabel = isBrowsingClosedTerm
          ? (viewingTermLabel || contextTerm || '').trim()
          : '';
        const cy = browseLabel
          ? browseLabel.match(/\b(20\d{2}(?:\/\d{2,4})?)\b/)?.[1] || contextYear
          : String(s?.current_year ?? '').trim();
        const ct = browseLabel
          ? stripYear(browseLabel) || browseLabel
          : String(s?.current_term ?? '').trim();
        const yearSet = [...new Set(list.map((x) => x.year).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const yearKeys = yearSet.length ? yearSet : cy ? [cy] : [String(new Date().getFullYear())];
        const pickYear =
          cy && yearKeys.includes(cy)
            ? cy
            : cy && yearKeys.find((y) => y.includes(cy) || cy.includes(y))
              ? yearKeys.find((y) => y.includes(cy) || cy.includes(y))!
              : yearKeys[0];
        setActiveYearKey(pickYear);

        const termsForYear = list
          .filter((t) => t.year === pickYear)
          .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
        let termPick = stripYear(ct) || 'Term 1';
        if (termsForYear.length) {
          const byName = termsForYear.find(
            (t) => t.term_name === termPick || t.term_name === ct || ct.includes(t.term_name) || stripYear(ct) === t.term_name
          );
          termPick = byName ? byName.term_name : termsForYear[0].term_name;
        }
        setActiveTerm(termPick);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPeriodReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isBrowsingClosedTerm, viewingTermLabel, contextTerm, contextYear]);

  // Keep period selectors aligned when browse term changes after mount.
  useEffect(() => {
    if (!isBrowsingClosedTerm || !viewingTermLabel) return;
    const year =
      viewingTermLabel.match(/\b(20\d{2}(?:\/\d{2,4})?)\b/)?.[1] || contextYear;
    const termName = stripYear(viewingTermLabel) || viewingTermLabel;
    if (year) setActiveYearKey(year);
    if (termName) setActiveTerm(termName);
  }, [isBrowsingClosedTerm, viewingTermLabel, contextYear]);

  const yearOptions = useMemo(() => {
    const keys = [...new Set(academicTerms.map((t) => t.year).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return keys.length ? keys : activeYearKey ? [activeYearKey] : [];
  }, [academicTerms, activeYearKey]);

  const termsForSelectedYear = useMemo(() => {
    return academicTerms
      .filter((t) => t.year === activeYearKey)
      .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
  }, [academicTerms, activeYearKey]);

  const termTabs = useMemo(() => {
    if (termsForSelectedYear.length) return termsForSelectedYear.map((t) => t.term_name);
    return ['Term 1', 'Term 2', 'Term 3'];
  }, [termsForSelectedYear]);

  const handleAcademicYearSelect = (yearKey: string) => {
    if (isBrowsingClosedTerm) return;
    setActiveYearKey(yearKey);
    const tfy = academicTerms
      .filter((t) => t.year === yearKey)
      .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    if (tfy.length) setActiveTerm(tfy[0].term_name);
  };

  const fullViewingTermLabel = useMemo(
    () => `${activeTerm} ${activeYearKey}`.trim(),
    [activeTerm, activeYearKey]
  );

  useEffect(() => {
    if (isBrowsingClosedTerm) return;
    if (periodReady && fullViewingTermLabel) {
      setViewingTermLabel(fullViewingTermLabel);
    }
  }, [periodReady, fullViewingTermLabel, setViewingTermLabel, isBrowsingClosedTerm]);

  useEffect(
    () => () => {
      if (!isBrowsingClosedTerm) setViewingTermLabel(null);
    },
    [setViewingTermLabel, isBrowsingClosedTerm]
  );

  const fetchData = useCallback(async () => {
    if (!periodReady || !activeYearKey || !activeTerm) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('term', activeTerm);
    params.set('year', activeYearKey);
    const reportTermId = viewingLedgerTermId ?? activeLedgerTermId;
    if (reportTermId != null) params.set('termId', String(reportTermId));
    const base = `?${params.toString()}`;
    const bust = `&_=${Date.now()}`;

    let finRaw: any = null;
    let termFrom = '';
    let termTo = '';
    try {
      finRaw = await apiService.get<any>(`/reports/financial-summary${base}${bust}`).catch((err) => {
        console.error('Failed to fetch financial summary:', err);
        return null;
      });
      if (finRaw) {
        const finRes = normalizeFinancialSummary(finRaw);
        setFinancialSummary(finRes);
        setCollectionsByAccount(
          Array.isArray(finRes?.collectionsByAccount) ? finRes.collectionsByAccount : []
        );
        termFrom = String(finRes.financePeriodStart || '').split('T')[0];
        termTo = String(finRes.financePeriodEnd || '').split('T')[0];
      } else {
        setError('Failed to fetch financial summary');
        setCollectionsByAccount([]);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch financial summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch financial summary');
      setCollectionsByAccount([]);
    }

    const listParams = new URLSearchParams();
    if (termFrom && termTo) {
      listParams.set('startDate', termFrom);
      listParams.set('endDate', termTo);
    }
    listParams.set('_', String(Date.now()));
    const listBust = `?${listParams.toString()}`;
    const iveParams = new URLSearchParams(params);
    if (termFrom && termTo) {
      iveParams.set('startDate', termFrom);
      iveParams.set('endDate', termTo);
    }
    const iveBase = `?${iveParams.toString()}`;

    const [
      classFeesRes,
      outstandingRes,
      expenditureRes,
      payrollRes,
      performanceRes,
      attendanceRes,
      iveRes,
      incomeList,
      expenseList,
      fundTransfersRes,
    ] = await Promise.all([
      apiService.get<any[]>(`/reports/fees-by-class${base}${bust}`).catch(() => []),
      apiService.get<any[]>(`/reports/outstanding-fees${base}${bust}`).catch(() => []),
      apiService.get<any[]>(`/reports/expenditure${base}${bust}`).catch(() => []),
      apiService.get<any[]>(`/reports/payroll-summary${base}${bust}`).catch(() => []),
      apiService.get<any>(`/reports/academic-performance${base}${bust}`).catch(() => ({})),
      apiService.get<any[]>(`/reports/attendance-summary${base}${bust}`).catch(() => []),
      apiService.get<any[]>(`/reports/income-vs-expenditure${iveBase}${bust}`).catch(() => []),
      apiService.get<any[]>(`/income${listBust}`).catch(() => []),
      apiService.get<any[]>(`/expenses${listBust}`).catch(() => []),
      apiService
        .get<any[]>(
          `/reports/fund-transfers?${termFrom && termTo ? `startDate=${termFrom}&endDate=${termTo}&` : ''}limit=500&_=${Date.now()}`
        )
        .catch(() => []),
    ]);

    setFeesByClass(classFeesRes);
    setOutstandingFees(outstandingRes);
    setExpenditure(expenditureRes);
    setPayroll(payrollRes);
    setPerformance(performanceRes);
    setAttendance(
      attendanceRes
        .map((a) => ({
          ...a,
          date: formatDisplayDate(a.date),
          rate: a.total > 0 ? (a.present / a.total) * 100 : 0,
        }))
        .reverse()
    );
    setIncomeVsExpense(iveRes);
    setIncomeRows(
      (Array.isArray(incomeList) ? incomeList : []).map((row: any) => ({
        ...row,
        Account: row.account_label || 'Unlinked',
      }))
    );
    setExpenseRows(
      (Array.isArray(expenseList) ? expenseList : []).map((row: any) => ({
        ...row,
        Account: row.account_label || 'Unlinked',
      }))
    );
    setFundTransfers(Array.isArray(fundTransfersRes) ? fundTransfersRes : []);
    setLastSync(new Date());
    setLoading(false);
  }, [
    periodReady,
    activeYearKey,
    activeTerm,
    viewingLedgerTermId,
    isBrowsingClosedTerm,
    activeLedgerTermId,
  ]);

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;
  useFinanceRealtime({
    onInvalidate: () => {
      if (periodReady) void fetchDataRef.current();
    },
  });

  useEffect(() => {
    if (!periodReady) return;
    fetchData();
  }, [periodReady, fetchData]);

  const chartTooltip = useMemo(
    () =>
      theme === 'dark'
        ? { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e5e7eb' }
        : { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' },
    [theme]
  );

  const chartMuted = theme === 'dark' ? '#64748b' : '#64748b';
  const chartGrid = theme === 'dark' ? '#334155' : '#e2e8f0';
  const barExpenseFill = theme === 'dark' ? '#475569' : '#94a3b8';

  const academicYearLabel = financialSummary?.academicYearDisplay || formatAcademicYearLabel(activeYearKey);

  const handleExportPdf = () => {
    downloadFinancialReportPdf({
      schoolName: school?.name || 'School',
      termLabel: activeTerm,
      academicYearLabel,
      financeFrom: financialSummary?.financePeriodStart || '',
      financeTo: financialSummary?.financePeriodEnd || '',
      summary: financialSummary || {},
      feesByClass,
      outstandingFees,
      incomeRows,
      expenseRows,
      incomeVsExpense,
      fundTransfers,
    });
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const safePeriod = `${academicYearLabel.replace(/\//g, '-')}_${activeTerm.replace(/\s+/g, '_')}`;

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          School: school?.name || 'School',
          'Academic year': academicYearLabel,
          Term: activeTerm,
          'Finance window': `${financialSummary?.financePeriodStart || ''} → ${financialSummary?.financePeriodEnd || ''}`,
          'Generated at': new Date().toISOString(),
          'Total expected (GHS)': financialSummary?.totalExpected ?? 0,
          'Collected (GHS)': financialSummary?.collected ?? 0,
          'Outstanding (GHS)': financialSummary?.outstanding ?? 0,
          'Other income (GHS)': financialSummary?.otherIncome ?? 0,
          'Expenses (GHS)': financialSummary?.totalExpenses ?? 0,
          'Net position (GHS)': financialSummary?.systemNetPosition ?? financialSummary?.netBalance ?? 0,
          'Collection %': Math.round(financialSummary?.collectionRate ?? 0),
        },
      ]),
      'Summary'
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        feesByClass.map((row) => ({
          Class: row.name,
          Students: row.students,
          'Expected (GHS)': Number(row.expected),
          'Collected (GHS)': Number(row.collected),
          'Outstanding (GHS)': Number(row.outstanding),
        }))
      ),
      'Fees by class'
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        outstandingFees.map((r) => ({
          Name: r.name,
          Class: r.class,
          'Balance (GHS)': Number(r.amount),
          'Days since last pay': r.days ?? 0,
        }))
      ),
      'Outstanding'
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        incomeVsExpense.map((r) => ({
          Month: r.name,
          'Income (GHS)': Number(r.income),
          'Expense (GHS)': Number(r.expense),
        }))
      ),
      'Income vs expense'
    );

    if (incomeRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), 'Income detail');
    }
    if (expenseRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Expense detail');
    }
    if (collectionsByAccount.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          collectionsByAccount.map((row) => ({
            Account: row.accountLabel,
            'Fees Collected': row.feesCollected,
            'Other Income': row.otherIncome,
            Expenses: row.expenses,
            'Current Balance': row.currentBalance,
          }))
        ),
        'By account'
      );
    }
    if (fundTransfers.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          fundTransfers.map((row) => ({
            Date: row.transfer_date,
            From: row.from_account_label,
            To: row.to_account_label,
            Amount: row.amount,
            Note: row.note,
            By: row.transferred_by_name,
          }))
        ),
        'Fund transfers'
      );
    }

    XLSX.writeFile(wb, `financial-report_${safePeriod}.xlsx`);
  };

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#6b7280'];

  if (loading && !financialSummary) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center bg-slate-50 dark:bg-slate-950/50 px-4">
        <BrandedLoading
          logoUrl={school?.logo_url ?? null}
          label="Loading reports…"
          className="py-12"
          active={loading && !financialSummary}
          onRetry={fetchData}
        />
      </div>
    );
  }

  if (error && !financialSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-[80dvh] space-y-4">
        <AlertCircle className="text-red-500" size={48} />
        <h2 className="text-xl font-bold">Data Synchronization Failed</h2>
        <p className="text-[var(--report-text-secondary)]">{error}</p>
        <Button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700">
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="reports-container p-6 lg:p-8 space-y-8 overflow-x-hidden">
      {/* --- HEADER SECTION --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-blue-600 shadow-lg">
            <GraduationCap className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Financial Reports &amp; Analytics
            </h1>
            <p className="mt-0.5 text-sm text-[var(--report-text-secondary)]">
              {school?.name ? `${school.name} · ` : ''}
              <span className="font-semibold text-[var(--report-text-primary)]">{activeTerm}</span>
              {' · '}
              <span className="font-semibold text-[var(--report-text-primary)]">{academicYearLabel}</span>
            </p>
            {financialSummary?.financePeriodStart && financialSummary?.financePeriodEnd && (
              <p className="mt-1 text-xs text-[var(--report-text-secondary)]">
                Income &amp; expenses counted between {financialSummary.financePeriodStart} and {financialSummary.financePeriodEnd}
              </p>
            )}
            <div className="mt-1 flex items-center text-sm text-[var(--report-text-secondary)]">
              <Clock size={14} className="mr-1 shrink-0" />
              <span>Last updated: {lastSync.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                Year {formatAcademicYearLabel(activeYearKey)} <ChevronDown size={16} className="ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem] max-h-[min(24rem,70vh)] overflow-y-auto">
              {yearOptions.length === 0 ? (
                <DropdownMenuItem disabled>No years in Academic Terms — add terms in Settings</DropdownMenuItem>
              ) : (
                yearOptions.map((yk) => {
                  const label = formatAcademicYearLabel(yk);
                  return (
                    <DropdownMenuItem key={yk} onClick={() => handleAcademicYearSelect(yk)}>
                      <span>{label}</span>
                      {yk !== label ? <span className="ml-1 text-[10px] text-slate-500">({yk})</span> : null}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="tab-switcher max-w-full flex-wrap">
            {termTabs.map((term) => {
              const tabLabel = `${term} ${activeYearKey}`.trim();
              const closed = isTermClosedByLabel(tabLabel);
              return (
              <div
                key={term}
                className={`tab-item readonly-allowed ${activeTerm === term ? 'active' : ''} ${closed ? 'opacity-70' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (isBrowsingClosedTerm) return;
                  setActiveTerm(term);
                }}
                onKeyDown={(e) => {
                  if (isBrowsingClosedTerm) return;
                  if (e.key === 'Enter' || e.key === ' ') setActiveTerm(term);
                }}
              >
                {closed ? '🔒 ' : ''}{term}{closed ? ' (Closed)' : ''}
              </div>
            );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="icon"
              variant="outline"
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              type="button"
              onClick={() => fetchData()}
              disabled={loading}
              aria-label="Refresh data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="outline"
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              type="button"
              onClick={handleExportPdf}
            >
              <FileText size={18} className="mr-2" />
              Export PDF
            </Button>
            <Button
              className="bg-emerald-600 text-white shadow-md hover:bg-emerald-700 dark:shadow-emerald-900/20"
              type="button"
              onClick={handleExportExcel}
            >
              <Download size={18} className="mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </header>

      {/* --- FINANCIAL METRICS OVERVIEW --- */}
      <div className="space-y-4">
        {/* Row 1: Term Fees & Collections (4 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Fees Expected"
            value={`GHS ${financialSummary?.totalExpected || 0}`}
            subtext="Projected term fee revenue"
            progress={financialSummary?.collectionRate || 0}
            icon={Receipt}
            accentColor="amber"
            delay={50}
          />
          <StatCard 
            label="Fees Collected"
            value={`GHS ${financialSummary?.collected || 0}`}
            subtext={`${fullViewingTermLabel || 'Selected term'} fees`}
            trend={{ value: `${Math.round(financialSummary?.collectionRate || 0)}% of bill`, positive: true }}
            icon={Wallet}
            accentColor="emerald"
            delay={100}
          />
          <StatCard 
            label="Outstanding Fees"
            value={`GHS ${financialSummary?.outstanding || 0}`}
            subtext="Accounts receivable"
            trend={{ value: "Pending payment", positive: false }}
            icon={Clock}
            accentColor="rose"
            delay={150}
          />
          <StatCard 
            label="Other Income"
            value={`GHS ${financialSummary?.otherIncome || 0}`}
            subtext="Donations & services"
            trend={{ value: "Non-fee income", positive: true }}
            icon={TrendingUp}
            accentColor="blue"
            delay={200}
          />
        </div>

        {/* Row 2: Cash Flow & Net Position (3 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard 
            label="Total Income"
            value={`GHS ${financialSummary?.totalIncome ?? ((financialSummary?.collected ?? 0) + (financialSummary?.otherIncome ?? 0))}`}
            subtext="Fees collected + other revenue"
            trend={{ value: "Total revenue", positive: true }}
            icon={DollarSign}
            accentColor="emerald"
            delay={250}
          />
          <StatCard 
            label="Total Expenses"
            value={`GHS ${financialSummary?.totalExpenses ?? 0}`}
            subtext="Operating costs (excludes transfers)"
            trend={{ value: "Operational spend", positive: false }}
            icon={ArrowDownRight}
            accentColor="rose"
            delay={300}
          />
          <StatCard 
            label="System Net Position"
            value={`GHS ${(financialSummary?.systemNetPosition ?? financialSummary?.netBalance) ?? 0}`}
            subtext="Cumulative net position across all terms"
            trend={{
              value: (financialSummary?.systemNetPosition ?? financialSummary?.netBalance ?? 0) >= 0 ? 'Surplus' : 'Deficit',
              positive: (financialSummary?.systemNetPosition ?? financialSummary?.netBalance ?? 0) >= 0,
            }}
            icon={Landmark}
            accentColor={(financialSummary?.systemNetPosition ?? financialSummary?.netBalance ?? 0) >= 0 ? "indigo" : "rose"}
            delay={350}
          />
        </div>
      </div>

      {/* --- SECOND STATS ROW (Operations KPIs) --- */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <MiniStatCard label="Active Students" value={feesByClass.reduce((a, b) => a + b.students, 0).toString()} icon={Users} accent="blue" delay={400} />
        <MiniStatCard label="Staff on Payroll" value={payroll.length.toString()} icon={Wallet} accent="indigo" delay={450} />
        <MiniStatCard label="Monthly Payroll" value={`GHS ${payroll.reduce((a, b) => a + parseFloat(b.net), 0).toLocaleString()}`} icon={DollarSign} accent="emerald" delay={500} />
        <MiniStatCard label="School Average" value={`${Math.round(performance?.schoolAverage || 0)}%`} icon={GraduationCap} accent="amber" delay={550} />
        <MiniStatCard label="Attendance Rate" value={`${Math.round(attendance[attendance.length - 1]?.rate || 0)}%`} icon={UserCheck} accent="violet" delay={600} />
      </section>

      <>
          {/* --- MAIN CONTENT GRID --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* INCOME VS EXPENSE CHART */}
        <div className="lg:col-span-2 luxury-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold report-header-font">Fiscal Flow Analysis</h3>
              <p className="text-sm text-[var(--report-text-secondary)]">
                Monthly fees + other income vs expenses (this term date range)
              </p>
            </div>
            <div className="flex space-x-4">
              <div className="flex items-center text-xs">
                <div className="w-3 h-3 rounded-full bg-[var(--report-accent-gold)] mr-2" />
                <span>Income</span>
              </div>
              <div className="flex items-center text-xs">
                  <div className="mr-2 h-3 w-3 rounded-full bg-slate-400 dark:bg-slate-600" />
                <span>Expenditure</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpense} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: chartMuted, fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: chartMuted, fontSize: 12 }} 
                  tickFormatter={(val) => `GHS ${val >= 1000 ? (val/1000) + 'k' : val}`}
                />
                <Tooltip 
                  cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)' }}
                  contentStyle={{ ...chartTooltip, borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="income" fill="var(--report-accent-gold)" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="expense" fill={barExpenseFill} radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* EXPENDITURE DONUT */}
        <div className="space-y-8">
          <div className="luxury-card p-6">
            <h3 className="text-lg font-bold report-header-font mb-6">Expenditure Breakdown</h3>
            <div className="h-[250px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenditure}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenditure.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ ...chartTooltip, borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase tracking-widest text-[var(--report-text-secondary)]">Total</span>
                <span className="text-xl font-bold">GHS {expenditure.reduce((a, b) => a + parseFloat(b.value), 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {expenditure.slice(0, 5).map((item, i) => (
                <div key={i} className="flex justify-between items-center text-[11px]">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--report-text-secondary)]">{item.name}</span>
                  </div>
                  <span className="font-bold font-mono">GHS {parseFloat(item.value).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="luxury-card p-6">
            <h3 className="text-lg font-bold report-header-font mb-6">Attendance Reliability</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendance}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <Tooltip 
                    contentStyle={{ ...chartTooltip, borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRate)" strokeWidth={2} name="Attendance Rate %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] mt-4 text-[var(--report-text-secondary)]">Average attendance: <span className="font-bold text-[var(--report-text-primary)]">{Math.round(attendance.reduce((a, b) => a + b.rate, 0) / (attendance.length || 1))}%</span> over last 30 sessions</p>
          </div>

          <div className="luxury-card report-profit-card p-6">
            <h3 className="mb-2 text-lg font-bold text-emerald-700 dark:text-emerald-400 report-header-font">Profitability</h3>
            <p className="mb-6 text-xs text-emerald-800/80 dark:text-emerald-400/70">
              Term activity below is for {fullViewingTermLabel || 'the selected term'} only.
              System net combines opening balance with all prior terms.
            </p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Fees collected (this term)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">GHS {(financialSummary?.collected ?? 0).toLocaleString()} <ArrowUpRight size={14} className="inline ml-1" /></span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Other income (this term)</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">GHS {(financialSummary?.otherIncome ?? 0).toLocaleString()} <ArrowUpRight size={14} className="inline ml-1" /></span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm font-medium text-[var(--report-text-primary)]">Total income (this term)</span>
                <span className="font-bold text-[var(--report-text-primary)]">
                  GHS {(financialSummary?.totalIncome ?? ((financialSummary?.collected ?? 0) + (financialSummary?.otherIncome ?? 0))).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Expenses (this term)</span>
                <span className="font-bold text-red-600 dark:text-red-400">GHS {(financialSummary?.totalExpenses ?? incomeVsExpense.reduce((a, b) => a + Number(b.expense || 0), 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Term activity net</span>
                <span className="font-bold text-[var(--report-text-primary)]">
                  GHS {(financialSummary?.periodActivityNet ?? ((financialSummary?.collected ?? 0) + (financialSummary?.otherIncome ?? 0) - (financialSummary?.totalExpenses ?? 0))).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-base font-bold text-[var(--report-text-primary)]">System net (all terms)</span>
                <span className={`text-2xl font-bold ${(financialSummary?.systemNetPosition ?? financialSummary?.netBalance ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  GHS {(financialSummary?.systemNetPosition ?? financialSummary?.netBalance ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FEES BREAKDOWN TABLE */}
        <div className="lg:col-span-3 luxury-card overflow-hidden">
          <div className="p-6 border-b border-[var(--report-card-border)] flex justify-between items-center">
            <h3 className="text-xl font-bold report-header-font">Fees Breakdown by Class</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-[var(--report-text-secondary)]">Real-time Data</span>
            </div>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="luxury-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Students</th>
                  <th>Expected</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                  <th>Collection %</th>
                </tr>
              </thead>
              <tbody>
                {feesByClass.map((row, i) => {
                  const rate = row.expected > 0 ? (row.collected / row.expected) * 100 : 0;
                  return (
                    <tr key={i}>
                      <td className="font-bold">{row.name}</td>
                      <td className="report-number-font">{row.students}</td>
                      <td className="report-number-font text-[var(--report-text-secondary)]">GHS {parseFloat(row.expected).toLocaleString()}</td>
                      <td className="report-number-font text-emerald-400 font-bold">GHS {parseFloat(row.collected).toLocaleString()}</td>
                      <td className={`report-number-font font-bold ${parseFloat(row.outstanding) > 1000 ? 'text-red-400' : parseFloat(row.outstanding) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        GHS {parseFloat(row.outstanding).toLocaleString()}
                      </td>
                      <td>
                        <div className="flex items-center">
                          <span className="mr-2 text-xs w-8">{Math.round(rate)}%</span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                            <div className={`h-full ${rate > 80 ? 'bg-emerald-500' : rate > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/90 font-bold dark:bg-white/5">
                  <td colSpan={2} className="text-right uppercase tracking-wider text-xs opacity-60">Grand Total</td>
                  <td className="report-number-font text-lg">GHS {feesByClass.reduce((a, b) => a + parseFloat(b.expected), 0).toLocaleString()}</td>
                  <td className="report-number-font text-lg text-emerald-400">GHS {feesByClass.reduce((a, b) => a + parseFloat(b.collected), 0).toLocaleString()}</td>
                  <td className="report-number-font text-lg text-red-400">GHS {feesByClass.reduce((a, b) => a + parseFloat(b.outstanding), 0).toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* OUTSTANDING FEES - WHO OWES */}
        <div className="luxury-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold report-header-font flex items-center">
              <Clock size={20} className="mr-2 text-red-400" />
              Top Debtors
            </h3>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {outstandingFees.length === 0 ? (
              <div className="text-center py-8 text-[var(--report-text-secondary)] italic">No outstanding balances detected. Excellent!</div>
            ) : outstandingFees.map((student, i) => (
              <div key={i} className="debtor-row flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-bold">{student.name}</div>
                  <div className="text-[10px] text-[var(--report-text-secondary)] uppercase">{student.class} • {student.days || 0} days overdue</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-400 report-number-font">GHS {parseFloat(student.amount).toLocaleString()}</div>
                  <button className="text-[9px] text-blue-400 hover:underline">Contact Parent</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACADEMIC PERFORMANCE SECTION */}
        <div className="lg:col-span-2 luxury-card p-6">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold report-header-font">Academic Performance</h3>
              <p className="text-sm text-[var(--report-text-secondary)]">Average scores across all classes</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-[var(--report-text-secondary)]">School Average</span>
              <div className="text-2xl font-bold text-blue-400 report-number-font">{Math.round(performance?.schoolAverage || 0)}%</div>
            </div>
          </div>
          
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={performance?.classPerformance || []} margin={{ left: 40, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={chartGrid} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: chartMuted, fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)' }}
                  contentStyle={{ ...chartTooltip, borderRadius: '8px' }}
                />
                <Bar 
                  dataKey="score" 
                  radius={[0, 4, 4, 0]} 
                  barSize={16}
                >
                  {(performance?.classPerformance || []).map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.score > 80 ? '#10b981' : entry.score > 60 ? '#3b82f6' : '#ef4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TOP PERFORMERS LIST */}
        <div className="luxury-card p-6">
          <h3 className="text-lg font-bold report-header-font mb-6 flex items-center">
            <TrendingUp size={20} className="mr-2 text-emerald-400" />
            Top Academic Talents
          </h3>
          <div className="space-y-6">
            {(performance?.topPerformers || []).map((student: any, i: number) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-blue-400">
                    #{i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold group-hover:text-blue-400 transition-colors">{student.name}</div>
                    <div className="text-[10px] text-[var(--report-text-secondary)] uppercase">{student.class}</div>
                  </div>
                </div>
                <div className="text-sm font-bold text-emerald-400 report-number-font">
                  {Math.round(student.score)}%
                </div>
              </div>
            ))}
            {(!performance?.topPerformers || performance?.topPerformers.length === 0) && (
              <div className="text-center py-8 text-[var(--report-text-secondary)] italic">No performance data available for this period.</div>
            )}
          </div>
        </div>

      </div>

      {/* COLLECTIONS BY PAYMENT ACCOUNT */}
      <div className="luxury-card overflow-hidden">
        <div className="border-b border-[var(--report-card-border)] p-6">
          <h3 className="text-xl font-bold report-header-font">Collections by Payment Account</h3>
          <p className="mt-1 text-sm text-[var(--report-text-secondary)]">
            Term fee collections, other income, and expenses by account for {activeTerm} / {academicYearLabel}
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="luxury-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Fees Collected (term)</th>
                <th>Other Income</th>
                <th>Expenses</th>
                <th>Current Balance</th>
              </tr>
            </thead>
            <tbody>
              {collectionsByAccount.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--report-text-secondary)] italic">
                    No payment accounts or transactions yet.
                  </td>
                </tr>
              ) : (
                collectionsByAccount.map((row, i) => (
                  <tr key={`${row.accountId ?? 'unlinked'}-${i}`}>
                    <td className="font-bold">{row.accountLabel}</td>
                    <td className="report-number-font">GHS {Number(row.feesCollected || 0).toLocaleString()}</td>
                    <td className="report-number-font">GHS {Number(row.otherIncome || 0).toLocaleString()}</td>
                    <td className="report-number-font">GHS {Number(row.expenses || 0).toLocaleString()}</td>
                    <td className="report-number-font font-bold text-emerald-500">
                      GHS {Number(row.currentBalance || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FUND TRANSFERS — separate from income/expenses */}
      <div className="luxury-card overflow-hidden">
        <div className="border-b border-[var(--report-card-border)] p-6">
          <h3 className="text-xl font-bold report-header-font">Fund Transfers</h3>
          <p className="mt-1 text-sm text-[var(--report-text-secondary)]">
            Internal movements between accounts — not counted as income or expenses
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="luxury-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
                <th>Note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {fundTransfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--report-text-secondary)] italic">
                    No fund transfers recorded yet.
                  </td>
                </tr>
              ) : (
                fundTransfers.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDisplayDate(row.transfer_date)}</td>
                    <td>{row.from_account_label}</td>
                    <td>{row.to_account_label}</td>
                    <td className="report-number-font font-bold">GHS {Number(row.amount || 0).toLocaleString()}</td>
                    <td className="max-w-xs truncate">{row.note}</td>
                    <td>{row.transferred_by_name || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* INCOME DETAIL */}
        <div className="luxury-card overflow-hidden">
          <div className="border-b border-[var(--report-card-border)] p-6">
            <h3 className="text-lg font-bold report-header-font">Income Detail</h3>
          </div>
          <div className="max-h-[360px] overflow-auto p-4">
            <table className="luxury-table text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Account</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomeRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center italic text-[var(--report-text-secondary)]">No income records</td></tr>
                ) : incomeRows.map((row: any) => (
                  <tr key={row.id}>
                    <td>{formatDisplayDate(row.income_date || row.created_at)}</td>
                    <td>{row.source || row.title || '—'}</td>
                    <td>{row.account_label || row.Account || 'Unlinked'}</td>
                    <td className="report-number-font">GHS {Number(row.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EXPENSE DETAIL */}
        <div className="luxury-card overflow-hidden">
          <div className="border-b border-[var(--report-card-border)] p-6">
            <h3 className="text-lg font-bold report-header-font">Expense Detail</h3>
          </div>
          <div className="max-h-[360px] overflow-auto p-4">
            <table className="luxury-table text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Account</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center italic text-[var(--report-text-secondary)]">No expense records</td></tr>
                ) : expenseRows.map((row: any) => (
                  <tr key={row.id}>
                    <td>{formatDisplayDate(row.payment_date || row.created_at)}</td>
                    <td>{row.title || row.description || '—'}</td>
                    <td>{row.account_label || row.Account || 'Unlinked'}</td>
                    <td className="report-number-font">GHS {Number(row.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>

      {/* --- FOOTER / EXPORT SECTION --- */}
      <footer className="border-t border-[var(--report-card-border)] pt-8 text-center text-xs text-[var(--report-text-secondary)]">
        <p>
          Fee totals follow the selected term using live fee structures and payments. Other income and expenses use the date range from your Academic Terms for that year (or Sept–Aug if dates are missing). Export PDF for a formatted report including income and expense line items.
        </p>
      </footer>
    </div>
  );
};

export default AdvancedReports;
