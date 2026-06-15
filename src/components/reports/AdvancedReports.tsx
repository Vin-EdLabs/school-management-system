import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Download, DollarSign, TrendingUp, 
  Users, ChevronDown, FileText,
  ArrowUpRight, ArrowDownRight, UserCheck, 
  Wallet, GraduationCap, Clock, AlertCircle, RefreshCw
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
  glowColor?: 'emerald' | 'red' | 'gold' | 'blue';
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

const StatCard = ({ label, value, subtext, trend, progress, glowColor = 'blue', delay = 0 }: StatCardProps) => {
  const numericValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  const prefix = value.includes('GHS') ? 'GHS ' : '';

  return (
    <div 
      className={`luxury-card p-6 animate-entrance glow-${glowColor}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="stat-label">{label}</span>
        {trend && (
          <div className={`flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${trend.positive ? 'bg-emerald-500/10 text-[var(--report-accent-emerald)]' : 'bg-red-500/10 text-[var(--report-accent-red)]'}`}>
            {trend.positive ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
            {trend.value}
          </div>
        )}
      </div>
      <div className="stat-value mb-2 report-number-font flex items-baseline">
        {isNaN(numericValue) ? (
          value
        ) : (
          <AnimatedNumber value={numericValue} prefix={prefix} duration={1500} />
        )}
      </div>
      <div className="text-[10px] text-[var(--report-text-secondary)] font-medium uppercase tracking-wider">
        {subtext}
      </div>
      {progress !== undefined && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-[var(--report-text-secondary)]">Progress</span>
            <span className="font-bold stat-progress-pct">{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: glowColor === 'red' ? 'linear-gradient(90deg, #ef4444, #f87171)' : 
                            glowColor === 'gold' ? 'linear-gradient(90deg, #d4af37, #fbbf24)' : 
                            'linear-gradient(90deg, #10b981, #34d399)'
              }} 
              id={`progress-${label.replace(/\s+/g, '-').toLowerCase()}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStatCard = ({ label, value, icon: Icon, delay = 0 }: { label: string; value: string; icon: any; delay?: number }) => (
  <div 
    className="luxury-card p-4 flex items-center space-x-4 animate-entrance"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[var(--report-accent-blue)] dark:bg-blue-500/10">
      <Icon size={20} />
    </div>
    <div>
      <div className="stat-label text-[10px]">{label}</div>
      <div className="text-lg font-bold report-number-font">{value}</div>
    </div>
  </div>
);

const AdvancedReports = () => {
  const { theme } = useTheme();
  const { school } = useSchool();
  const { setViewingTermLabel, isTermClosedByLabel } = useTermStatus();
  const [academicTerms, setAcademicTerms] = useState<AcademicTermRow[]>([]);
  const [activeYearKey, setActiveYearKey] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
  const [periodReady, setPeriodReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

        const cy = String(s?.current_year ?? '').trim();
        const ct = String(s?.current_term ?? '').trim();
        const yearSet = [...new Set(list.map((x) => x.year).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const yearKeys = yearSet.length ? yearSet : cy ? [cy] : [String(new Date().getFullYear())];
        const pickYear = cy && yearKeys.includes(cy) ? cy : yearKeys[0];
        setActiveYearKey(pickYear);

        const termsForYear = list
          .filter((t) => t.year === pickYear)
          .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
        const stripYear = (n: string) => n.replace(/\s+\d{4}(\s*\/\s*\d{4})?$/, '').trim();
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
  }, []);

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
    if (periodReady && fullViewingTermLabel) {
      setViewingTermLabel(fullViewingTermLabel);
    }
  }, [periodReady, fullViewingTermLabel, setViewingTermLabel]);

  useEffect(() => () => setViewingTermLabel(null), [setViewingTermLabel]);

  const fetchData = useCallback(async () => {
    if (!periodReady || !activeYearKey || !activeTerm) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('term', activeTerm);
      params.set('year', activeYearKey);
      const base = `?${params.toString()}`;
      const bust = `&_=${Date.now()}`;

      const finRes = normalizeFinancialSummary(await apiService.get<any>(`/reports/financial-summary${base}${bust}`));
      setFinancialSummary(finRes);

      const listBust = `?_=${Date.now()}`;

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
        apiService.get<any[]>(`/reports/fees-by-class${base}${bust}`),
        apiService.get<any[]>(`/reports/outstanding-fees${base}${bust}`),
        apiService.get<any[]>(`/reports/expenditure${base}${bust}`),
        apiService.get<any[]>(`/reports/payroll-summary${base}${bust}`),
        apiService.get<any>(`/reports/academic-performance${base}${bust}`),
        apiService.get<any[]>(`/reports/attendance-summary${base}${bust}`),
        apiService.get<any[]>(`/reports/income-vs-expenditure${base}${bust}`),
        apiService.get<any[]>(`/income${listBust}`),
        apiService.get<any[]>(`/expenses${listBust}`),
        apiService.get<any[]>(`/reports/fund-transfers?scope=all&limit=500&_=${Date.now()}`),
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
      setCollectionsByAccount(Array.isArray(finRes?.collectionsByAccount) ? finRes.collectionsByAccount : []);
      setLastSync(new Date());
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.message || 'An error occurred while loading report data');
    } finally {
      setLoading(false);
    }
  }, [periodReady, activeYearKey, activeTerm]);

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
            <h1 className="text-3xl font-bold report-header-font tracking-tight">
              Financial reports <span className="text-[var(--report-accent-gold)]">&amp; analytics</span>
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
                onClick={() => setActiveTerm(term)}
                onKeyDown={(e) => {
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

      {/* --- HERO STATS ROW --- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
        <StatCard 
          label="Total Fees Expected"
          value={`GHS ${financialSummary?.totalExpected || 0}`}
          subtext="Projected revenue for term"
          progress={financialSummary?.collectionRate || 0}
          glowColor="gold"
          delay={100}
        />
        <StatCard 
          label="Fees Collected"
          value={`GHS ${financialSummary?.collected || 0}`}
          subtext="Total payments received"
          trend={{ value: `${Math.round(financialSummary?.collectionRate || 0)}% efficiency`, positive: true }}
          glowColor="emerald"
          delay={200}
        />
        <StatCard 
          label="Other Income"
          value={`GHS ${financialSummary?.otherIncome || 0}`}
          subtext={`Non-fee income (${academicYearLabel} window)`}
          trend={{ value: 'Donations, services & more', positive: true }}
          glowColor="blue"
          delay={250}
        />
        <StatCard 
          label="Outstanding Balance"
          value={`GHS ${financialSummary?.outstanding || 0}`}
          subtext="Current accounts receivable"
          trend={{ value: "Action required", positive: false }}
          glowColor="red"
          delay={300}
        />
        <StatCard 
          label="Total Income"
          value={`GHS ${financialSummary?.totalIncome ?? ((financialSummary?.feesCollectedPeriod ?? financialSummary?.collected ?? 0) + (financialSummary?.otherIncome ?? 0))}`}
          subtext={`Fees + other income (${academicYearLabel})`}
          trend={{ value: 'Period activity', positive: true }}
          glowColor="emerald"
          delay={375}
        />
        <StatCard 
          label="Total Expenses"
          value={`GHS ${financialSummary?.totalExpenses ?? 0}`}
          subtext={`All expenses (${academicYearLabel})`}
          trend={{ value: 'Excludes fund transfers', positive: false }}
          glowColor="red"
          delay={385}
        />
        <StatCard 
          label="Net Cash Position"
          value={`GHS ${(financialSummary?.netBalance ?? financialSummary?.systemNetPosition) ?? 0}`}
          subtext="All account balances (matches Cash & Bank)"
          trend={{ value: (financialSummary?.netBalance ?? 0) >= 0 ? 'Surplus' : 'Deficit', positive: (financialSummary?.netBalance ?? 0) >= 0 }}
          glowColor="blue"
          delay={400}
        />
      </section>

      {/* --- SECOND STATS ROW --- */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MiniStatCard label="Active Students" value={feesByClass.reduce((a, b) => a + b.students, 0).toString()} icon={Users} delay={500} />
        <MiniStatCard label="Staff on Payroll" value={payroll.length.toString()} icon={Wallet} delay={600} />
        <MiniStatCard label="Monthly Payroll" value={`GHS ${payroll.reduce((a, b) => a + parseFloat(b.net), 0).toLocaleString()}`} icon={DollarSign} delay={700} />
        <MiniStatCard label="School Performance" value={`${Math.round(performance?.schoolAverage || 0)}%`} icon={GraduationCap} delay={800} />
        <MiniStatCard label="Attendance Rate" value={`${Math.round(attendance[attendance.length - 1]?.rate || 0)}%`} icon={UserCheck} delay={900} />
      </section>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* INCOME VS EXPENSE CHART */}
        <div className="lg:col-span-2 luxury-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold report-header-font">Fiscal Flow Analysis</h3>
              <p className="text-sm text-[var(--report-text-secondary)]">Monthly fees + other income vs expenses ({academicYearLabel} date range)</p>
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
            <p className="mb-6 text-xs text-emerald-800/80 dark:text-emerald-400/70">Period activity for {academicYearLabel}. Net cash position equals all account balances combined (fund transfers excluded from income/expense totals).</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Fees collected (term)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">GHS {(financialSummary?.collected ?? 0).toLocaleString()} <ArrowUpRight size={14} className="inline ml-1" /></span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Other income ({academicYearLabel})</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">GHS {(financialSummary?.otherIncome ?? 0).toLocaleString()} <ArrowUpRight size={14} className="inline ml-1" /></span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm font-medium text-[var(--report-text-primary)]">Total income</span>
                <span className="font-bold text-[var(--report-text-primary)]">
                  GHS {(financialSummary?.totalIncome ?? ((financialSummary?.feesCollectedPeriod ?? financialSummary?.collected ?? 0) + (financialSummary?.otherIncome ?? 0))).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Expenses ({academicYearLabel})</span>
                <span className="font-bold text-red-600 dark:text-red-400">GHS {(financialSummary?.totalExpenses ?? incomeVsExpense.reduce((a, b) => a + Number(b.expense || 0), 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 dark:border-emerald-500/10">
                <span className="text-sm text-[var(--report-text-primary)]">Period activity net</span>
                <span className="font-bold text-[var(--report-text-primary)]">
                  GHS {(financialSummary?.periodActivityNet ?? ((financialSummary?.collected ?? 0) + (financialSummary?.otherIncome ?? 0) - (financialSummary?.totalExpenses ?? 0))).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-base font-bold text-[var(--report-text-primary)]">Net cash position</span>
                <span className={`text-2xl font-bold ${(financialSummary?.netBalance ?? financialSummary?.systemNetPosition ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  GHS {(financialSummary?.netBalance ?? financialSummary?.systemNetPosition ?? 0).toLocaleString()}
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
