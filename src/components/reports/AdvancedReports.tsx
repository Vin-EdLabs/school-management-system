import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Download, FileText, Calculator, DollarSign, TrendingUp, 
  TrendingDown, Users, Calendar, Share2, Printer, ChevronDown, 
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import './AdvancedReports.css';

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
            <span className="font-bold text-white">{Math.round(progress)}%</span>
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
    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-[var(--report-accent-blue)]">
      <Icon size={20} />
    </div>
    <div>
      <div className="stat-label text-[10px]">{label}</div>
      <div className="text-lg font-bold report-number-font">{value}</div>
    </div>
  </div>
);

const AdvancedReports = () => {
  const [activeTerm, setActiveTerm] = useState('Term 1');
  const [activeYear, setActiveYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState(new Date());

  // Data States
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [feesByClass, setFeesByClass] = useState<any[]>([]);
  const [outstandingFees, setOutstandingFees] = useState<any[]>([]);
  const [expenditure, setExpenditure] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [incomeVsExpense, setIncomeVsExpense] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const termNum = activeTerm.match(/\d+/)?.[0] || "1";
      const query = `?term=${termNum}&year=${activeYear}`;

      const [
        finRes,
        classFeesRes,
        outstandingRes,
        expenditureRes,
        payrollRes,
        performanceRes,
        attendanceRes,
        iveRes
      ] = await Promise.all([
        apiService.get<any>(`/reports/financial-summary${query}`),
        apiService.get<any[]>(`/reports/fees-by-class${query}`),
        apiService.get<any[]>(`/reports/outstanding-fees${query}`),
        apiService.get<any[]>(`/reports/expenditure${query}`),
        apiService.get<any[]>(`/reports/payroll-summary${query}`),
        apiService.get<any>(`/reports/academic-performance${query}`),
        apiService.get<any[]>(`/reports/attendance-summary${query}`),
        apiService.get<any[]>(`/reports/income-vs-expenditure${query}`)
      ]);

      setFinancialSummary(finRes);
      setFeesByClass(classFeesRes);
      setOutstandingFees(outstandingRes);
      setExpenditure(expenditureRes);
      setPayroll(payrollRes);
      setPerformance(performanceRes);
      setAttendance(attendanceRes.map(a => ({
        ...a,
        date: new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        rate: a.total > 0 ? (a.present / a.total) * 100 : 0
      })).reverse());
      setIncomeVsExpense(iveRes);
      setLastSync(new Date());
    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err.message || "An error occurred while loading report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTerm, activeYear]);

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#6b7280'];

  if (loading && !financialSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
        <RefreshCw className="animate-spin text-blue-500" size={48} />
        <p className="text-[var(--report-text-secondary)] font-medium">Synthesizing intelligence data...</p>
      </div>
    );
  }

  if (error && !financialSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
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
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
            <GraduationCap className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold report-header-font tracking-tight">
              ScholarNerve <span className="text-[var(--report-accent-gold)]">Intelligence</span>
            </h1>
            <div className="flex items-center text-[var(--report-text-secondary)] text-sm mt-1">
              <Clock size={14} className="mr-1" />
              <span>System last synchronized: {lastSync.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-[var(--report-card-bg)] border-[var(--report-card-border)] text-white hover:bg-white/5">
                Financial Year {activeYear} <ChevronDown size={16} className="ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[var(--report-card-bg)] border-[var(--report-card-border)] text-white">
              <DropdownMenuItem onClick={() => setActiveYear('2025')}>2025</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveYear('2024')}>2024</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="tab-switcher">
            {['Term 1', 'Term 2', 'Term 3'].map(term => (
              <div 
                key={term}
                className={`tab-item ${activeTerm === term ? 'active' : ''}`}
                onClick={() => setActiveTerm(term)}
              >
                {term}
              </div>
            ))}
          </div>

          <div className="flex space-x-2">
            <Button size="icon" variant="outline" className="bg-[var(--report-card-bg)] border-[var(--report-card-border)] text-white hover:bg-white/5" onClick={() => window.print()}>
              <Printer size={18} />
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-900/20">
              <Download size={18} className="mr-2" />
              Export Intelligence Report
            </Button>
          </div>
        </div>
      </header>

      {/* --- HERO STATS ROW --- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
          label="Outstanding Balance"
          value={`GHS ${financialSummary?.outstanding || 0}`}
          subtext="Current accounts receivable"
          trend={{ value: "Action required", positive: false }}
          glowColor="red"
          delay={300}
        />
        <StatCard 
          label="Net Operating Surplus"
          value={`GHS ${financialSummary?.netBalance || 0}`}
          subtext="Liquid position after costs"
          trend={{ value: financialSummary?.netBalance > 0 ? "Profitable" : "Deficit", positive: financialSummary?.netBalance > 0 }}
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
              <p className="text-sm text-[var(--report-text-secondary)]">Monthly comparison of Income vs Expenditure</p>
            </div>
            <div className="flex space-x-4">
              <div className="flex items-center text-xs">
                <div className="w-3 h-3 rounded-full bg-[var(--report-accent-gold)] mr-2" />
                <span>Income</span>
              </div>
              <div className="flex items-center text-xs">
                <div className="w-3 h-3 rounded-full bg-slate-700 mr-2" />
                <span>Expenditure</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpense} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  tickFormatter={(val) => `GHS ${val >= 1000 ? (val/1000) + 'k' : val}`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="income" fill="var(--report-accent-gold)" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="expense" fill="#334155" radius={[4, 4, 0, 0]} barSize={30} />
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
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '8px' }}
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
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRate)" strokeWidth={2} name="Attendance Rate %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] mt-4 text-[var(--report-text-secondary)]">Average attendance: <span className="text-white font-bold">{Math.round(attendance.reduce((a, b) => a + b.rate, 0) / (attendance.length || 1))}%</span> over last 30 sessions</p>
          </div>

          <div className="luxury-card p-6 bg-gradient-to-br from-emerald-900/20 to-blue-900/20 border-emerald-500/30">
            <h3 className="text-lg font-bold report-header-font mb-2 text-emerald-400">Profitability Core</h3>
            <p className="text-xs text-emerald-400/60 mb-6">Term Surplus Projection</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
                <span className="text-sm">Realized Income</span>
                <span className="font-bold text-emerald-400">GHS {financialSummary?.collected || 0} <ArrowUpRight size={14} className="inline ml-1" /></span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
                <span className="text-sm">Operational Costs</span>
                <span className="font-bold text-red-400">GHS {incomeVsExpense.reduce((a, b) => a + b.expense, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-base font-bold">NET POSITION</span>
                <span className={`text-2xl font-bold ${financialSummary?.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'} drop-shadow-lg`}>
                  GHS {financialSummary?.netBalance?.toLocaleString() || 0}
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
                          <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${rate > 80 ? 'bg-emerald-500' : rate > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-bold">
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
            <Button size="sm" className="bg-red-600/10 text-red-400 border-red-600/20 hover:bg-red-600/20 h-7 text-[10px]">
              Bulk Reminders
            </Button>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {outstandingFees.length === 0 ? (
              <div className="text-center py-8 text-[var(--report-text-secondary)] italic">No outstanding balances detected. Excellent!</div>
            ) : outstandingFees.map((student, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
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
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1f2937" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#f9fafb', fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '8px' }}
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
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-blue-400">
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

      {/* --- FOOTER / EXPORT SECTION --- */}
      <footer className="pt-12 border-t border-[var(--report-card-border)]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-2 opacity-50">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-[10px] font-bold text-white">S</div>
            <span className="text-xs font-semibold tracking-widest uppercase">ScholarNerve Reports V2.0</span>
          </div>
          <div className="flex space-x-6 text-xs text-[var(--report-text-secondary)]">
            <span className="cursor-pointer hover:text-white transition-colors">Strategic Insights</span>
            <span className="cursor-pointer hover:text-white transition-colors">Financial Audits</span>
            <span className="cursor-pointer hover:text-white transition-colors">Academic Ledger</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdvancedReports;
