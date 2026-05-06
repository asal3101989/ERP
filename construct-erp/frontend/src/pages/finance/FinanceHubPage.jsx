// src/pages/finance/FinanceHubPage.jsx
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, FileText, FileSignature, BarChart3,
  DollarSign, ArrowRight, ArrowUpRight, ArrowDownRight,
  Receipt, Building2, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { paymentAPI, invoiceAPI, raBillAPI, budgetAPI, projectAPI } from '../../api/client';
import dayjs from 'dayjs';

// ── Formatters ──────────────────────────────────────────────────────────────
const inr = (n) => {
  const num = Number(n || 0);
  if (num >= 10_000_000) return `₹${(num / 10_000_000).toFixed(2)} Cr`;
  if (num >= 100_000)    return `₹${(num / 100_000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};
const dateFmt = (d) => d ? dayjs(d).format('DD MMM YY') : '—';

// ── Colors ──────────────────────────────────────────────────────────────────
const PRIMARY  = '#1B4FD8';
const GREEN    = '#10B981';
const RED      = '#EF4444';
const AMBER    = '#F59E0B';
const PURPLE   = '#8B5CF6';
const PIE_COLORS = ['#1B4FD8', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const COST_HEAD_LABELS = {
  material:       'Material',
  labour:         'Labour',
  labor:          'Labour',
  plant:          'Plant & Machinery',
  subcontracting: 'Subcontracting',
  overhead:       'Overhead',
  other:          'Other',
};
function normCostHead(raw) {
  if (!raw) return 'other';
  const r = raw.toLowerCase();
  if (r.includes('material')) return 'material';
  if (r.includes('labour') || r.includes('labor')) return 'labour';
  if (r.includes('plant') || r.includes('machinery')) return 'plant';
  if (r.includes('sub')) return 'subcontracting';
  if (r.includes('overhead') || r.includes('site') || r.includes('office')) return 'overhead';
  return 'other';
}

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600'      },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700'      },
  verified:  { label: 'Verified',  cls: 'bg-sky-100 text-sky-700'        },
  authorized:{ label: 'Authorized',cls: 'bg-indigo-100 text-indigo-700'  },
  paid:      { label: 'Paid',      cls: 'bg-emerald-100 text-emerald-700'},
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700'        },
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700'    },
  certified: { label: 'Certified', cls: 'bg-violet-100 text-violet-700'  },
};
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[String(status || '').toLowerCase()] || { label: status, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, trend }) {
  const trendIcon = trend === 'up'
    ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
    : trend === 'down'
    ? <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
    : null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</div>
      {sub && (
        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
          {trendIcon}{sub}
        </div>
      )}
    </div>
  );
}

// ── Budget progress bar ───────────────────────────────────────────────────────
function BudgetBar({ name, actual, budget }) {
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
  const color = pct > 85 ? RED : pct > 65 ? AMBER : GREEN;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[12px] font-semibold text-slate-700 truncate max-w-[60%]">{name}</span>
        <span className="text-[11px] text-slate-400">{inr(actual)} / {inr(budget)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] text-slate-400">Utilized</span>
        <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <div className="font-bold text-slate-700 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{inr(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Quick nav cards ───────────────────────────────────────────────────────────
const NAV_CARDS = [
  { label: 'Payables',       to: '/finance/payables',      icon: FileText,      color: '#EF4444', bg: '#FEE2E2', desc: 'Vendor invoices & bill approvals' },
  { label: 'Payments',       to: '/finance/payments',      icon: Wallet,        color: '#10B981', bg: '#D1FAE5', desc: 'Outgoing disbursements & bank matching' },
  { label: 'Receivables',    to: '/finance/receivables',   icon: FileSignature, color: '#1B4FD8', bg: '#DBEAFE', desc: 'RA bills, collections & AR aging' },
  { label: 'Tax & Compliance', to: '/finance/tax-compliance', icon: DollarSign, color: '#F59E0B', bg: '#FEF3C7', desc: 'GST, TDS and statutory compliance' },
  { label: 'Reports',        to: '/finance/reports',       icon: BarChart3,     color: '#8B5CF6', bg: '#EDE9FE', desc: 'Budget, P&L and billing reports' },
  { label: 'Budget vs Actual', to: '/finance/budget',      icon: TrendingUp,    color: '#06B6D4', bg: '#CFFAFE', desc: 'Project-wise budget utilization' },
];

// ── MONTHS helper ─────────────────────────────────────────────────────────────
function last12Months() {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    months.push(dayjs().subtract(i, 'month'));
  }
  return months;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function FinanceHubPage() {
  const [activeSection, setActiveSection] = useState('dashboard');

  // ── Data fetching ───────────────────────────────────────────────────────
  const { data: paymentsData } = useQuery({
    queryKey: ['fin-hub-payments'],
    queryFn: () => paymentAPI.list({ limit: 200 }).then(r => r.data?.data || []).catch(() => []),
    staleTime: 60_000,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['fin-hub-invoices'],
    queryFn: () => invoiceAPI.list({ limit: 100 }).then(r => r.data?.data || []).catch(() => []),
    staleTime: 60_000,
  });

  const { data: raBillsData } = useQuery({
    queryKey: ['fin-hub-rabills'],
    queryFn: () => raBillAPI.list().then(r => r.data?.data || []).catch(() => []),
    staleTime: 60_000,
  });

  const { data: budgetsData } = useQuery({
    queryKey: ['fin-hub-budgets'],
    queryFn: () => budgetAPI.list().then(r => r.data?.data || []).catch(() => []),
    staleTime: 60_000,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['fin-hub-projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
    staleTime: 300_000,
  });

  const payments  = paymentsData  || [];
  const invoices  = invoicesData  || [];
  const raBills   = raBillsData   || [];
  const budgets   = budgetsData   || [];
  const projects  = projectsData  || [];

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalPaid    = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const pendingInv   = invoices.filter(i => !['paid'].includes(String(i.status).toLowerCase()));
    const pendingInvAmt= pendingInv.reduce((s, i) => s + Number(i.total_amount || i.amount || 0), 0);
    const paidRaBills  = raBills.filter(b => String(b.status).toLowerCase() === 'paid');
    const unpaidRaBills= raBills.filter(b => !['paid','rejected'].includes(String(b.status).toLowerCase()));
    const receivableAmt= unpaidRaBills.reduce((s, b) => s + Number(b.gross_amount || b.amount || 0), 0);
    const revenueAmt   = paidRaBills.reduce((s, b) => s + Number(b.gross_amount || b.amount || 0), 0);

    return {
      totalPaid,
      pendingInvCount: pendingInv.length,
      pendingInvAmt,
      receivableAmt,
      unpaidRaBillsCount: unpaidRaBills.length,
      revenueAmt,
      grossMargin: revenueAmt > 0 ? (((revenueAmt - totalPaid) / revenueAmt) * 100).toFixed(1) : '0.0',
    };
  }, [payments, invoices, raBills]);

  // ── Monthly trend (Revenue = RA bills paid, Expenses = payments made) ──
  const monthlyTrend = useMemo(() => {
    const months = last12Months();
    return months.map(m => {
      const key = m.format('YYYY-MM');
      const revenue  = raBills
        .filter(b => b.payment_date && dayjs(b.payment_date).format('YYYY-MM') === key)
        .reduce((s, b) => s + Number(b.amount_received || b.gross_amount || 0), 0);
      const expenses = payments
        .filter(p => p.payment_date && dayjs(p.payment_date).format('YYYY-MM') === key)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      return { month: m.format('MMM'), revenue, expenses };
    });
  }, [raBills, payments]);

  // ── Cost breakdown pie ──────────────────────────────────────────────────
  const costPie = useMemo(() => {
    const map = {};
    payments.forEach(p => {
      const head = normCostHead(p.cost_head);
      map[head] = (map[head] || 0) + Number(p.amount || 0);
    });
    return Object.entries(map)
      .map(([key, value]) => ({ name: COST_HEAD_LABELS[key] || key, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [payments]);

  // ── Budget utilization ──────────────────────────────────────────────────
  const budgetBars = useMemo(() => {
    if (!budgets.length) {
      // fallback: show projects with payment totals
      const byProject = {};
      payments.forEach(p => {
        if (p.project_name || p.project_id) {
          const name = p.project_name || p.project_id;
          byProject[name] = (byProject[name] || 0) + Number(p.amount || 0);
        }
      });
      return Object.entries(byProject).slice(0, 5).map(([name, actual]) => ({
        name,
        actual,
        budget: actual * 1.25, // estimate: assume 80% utilization if no budget
      }));
    }
    return budgets.slice(0, 5).map(b => ({
      name: b.project_name || projects.find(p => p.id === b.project_id)?.name || 'Project',
      actual: Number(b.actual_cost || b.spent || 0),
      budget: Number(b.total_budget || b.budget_amount || 0),
    }));
  }, [budgets, payments, projects]);

  // ── Cash flow (last 6 weeks) ────────────────────────────────────────────
  const cashFlow = useMemo(() => {
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const start = dayjs().subtract(i, 'week').startOf('week');
      const end   = dayjs().subtract(i, 'week').endOf('week');
      const inflow  = raBills
        .filter(b => b.payment_date && dayjs(b.payment_date).isAfter(start) && dayjs(b.payment_date).isBefore(end))
        .reduce((s, b) => s + Number(b.amount_received || b.gross_amount || 0), 0);
      const outflow = payments
        .filter(p => p.payment_date && dayjs(p.payment_date).isAfter(start) && dayjs(p.payment_date).isBefore(end))
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      weeks.push({ week: `W${6 - i} ${start.format('MMM')}`, inflow, outflow });
    }
    return weeks;
  }, [raBills, payments]);

  // ── Recent transactions ──────────────────────────────────────────────────
  const recentTxns = useMemo(() => {
    const payRows = payments.slice(0, 8).map(p => ({
      id: p.payment_ref || p.id?.slice(0, 8),
      party: p.payee_name || p.vendor_name || 'Vendor',
      type: 'OUT',
      amount: Number(p.amount || 0),
      status: p.status || 'paid',
      date: p.payment_date,
      project: p.project_name || '',
    }));
    const invRows = invoices.slice(0, 4).map(i => ({
      id: i.invoice_number || i.id?.slice(0, 8),
      party: i.vendor_name || 'Vendor',
      type: 'AP',
      amount: Number(i.total_amount || i.amount || 0),
      status: i.status || 'pending',
      date: i.invoice_date,
      project: i.project_name || '',
    }));
    return [...payRows, ...invRows]
      .sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix())
      .slice(0, 10);
  }, [payments, invoices]);

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-5 space-y-6 font-sans">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Finance Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">FY {dayjs().subtract(dayjs().month() < 3 ? 1 : 0, 'year').format('YYYY')}–{dayjs().subtract(dayjs().month() < 3 ? 0 : -1, 'year').format('YY')} · As of {dayjs().format('DD MMM YYYY')}</p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Link to="/finance/reports" className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Reports
          </Link>
          <Link to="/finance/payables" className="px-4 py-2 rounded-lg bg-[#1B4FD8] text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> New Invoice
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Expenses (Paid Out)"
          value={inr(kpis.totalPaid)}
          sub="Direct project costs"
          icon={TrendingDown}
          color={RED}
          trend="neutral"
        />
        <KpiCard
          label="Revenue Received"
          value={inr(kpis.revenueAmt)}
          sub={`Gross margin: ${kpis.grossMargin}%`}
          icon={TrendingUp}
          color={GREEN}
          trend="up"
        />
        <KpiCard
          label="Payables Pending"
          value={inr(kpis.pendingInvAmt)}
          sub={`${kpis.pendingInvCount} invoices pending`}
          icon={Receipt}
          color={AMBER}
          trend="neutral"
        />
        <KpiCard
          label="Receivables Outstanding"
          value={inr(kpis.receivableAmt)}
          sub={`${kpis.unpaidRaBillsCount} RA bills pending`}
          icon={FileSignature}
          color={PURPLE}
          trend="down"
        />
      </div>

      {/* ── Charts Row 1: Revenue vs Expenses + Cost Breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Revenue vs Expenses area chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-slate-800">Revenue vs Expenses</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">12-month trend · from RA bill receipts & vendor payments</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RED} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tickFormatter={v => inr(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue"  stroke={GREEN} fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke={RED}   fill="url(#expGrad)" strokeWidth={2} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cost breakdown pie */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-bold text-slate-800">Cost Breakdown</h2>
          <p className="text-[12px] text-slate-400 mt-0.5 mb-2">By cost head — all payments</p>
          {costPie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={costPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                    {costPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => inr(v)} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-1">
                {costPie.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
                    <div className="w-2 h-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-500">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
              <DollarSign className="w-8 h-8 mb-2 opacity-30" />
              No payment data yet
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Budget Utilization + Cash Flow ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Budget utilization */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-bold text-slate-800">Budget Utilization</h2>
          <p className="text-[12px] text-slate-400 mt-0.5 mb-5">Actual vs Planned — Active Projects</p>
          {budgetBars.length > 0 ? (
            <div className="space-y-4">
              {budgetBars.map((b, i) => <BudgetBar key={i} {...b} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
              <Building2 className="w-8 h-8 mb-2 opacity-30" />
              No budget data — <Link to="/finance/budget" className="text-blue-500 ml-1">set up budgets</Link>
            </div>
          )}
        </div>

        {/* Cash flow forecast */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-[15px] font-bold text-slate-800">Cash Flow</h2>
          <p className="text-[12px] text-slate-400 mt-0.5 mb-2">Weekly inflows vs outflows</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cashFlow} barGap={4} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tickFormatter={v => inr(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inflow"  name="Inflows"  fill={GREEN}         radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflow" name="Outflows" fill={`${RED}CC`}    radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-[15px] font-bold text-slate-800">Recent Transactions</h2>
          <Link to="/finance/payments" className="text-[12px] font-semibold text-blue-600 hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Ref / Invoice #', 'Party', 'Type', 'Project', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentTxns.length > 0 ? recentTxns.map((txn, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-[12px] font-bold text-blue-700">{txn.id || '—'}</td>
                  <td className="px-5 py-3 text-[13px] text-slate-800 max-w-[160px] truncate">{txn.party}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${txn.type === 'OUT' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {txn.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-slate-400 max-w-[140px] truncate">{txn.project || '—'}</td>
                  <td className="px-5 py-3 text-[13px] font-bold text-slate-800">{inr(txn.amount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={txn.status} /></td>
                  <td className="px-5 py-3 text-[12px] text-slate-400">{dateFmt(txn.date)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    No transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Quick Navigation ── */}
      <div>
        <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-400 mb-3">Finance Workspaces</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {NAV_CARDS.map(card => (
            <Link
              key={card.label}
              to={card.to}
              className="group bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-3"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{card.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{card.desc}</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors uppercase tracking-wide">
                Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
