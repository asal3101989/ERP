import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dqsBillsAPI, projectAPI } from '../../api/client';
import { BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts';

const inr = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const lakhs = (v) => (Number(v || 0) / 100000).toFixed(2);

const STATUS_COLORS = {
  pending:             '#f59e0b',
  stores:              '#3b82f6',
  document_controller: '#06b6d4',
  qs:                  '#6366f1',
  accounts:            '#8b5cf6',
  procurement:         '#f97316',
  paid:                '#22c55e',
};
const STATUS_LABELS = {
  pending:             'Pending',
  stores:              'Stores',
  document_controller: 'Doc Ctrl',
  qs:                  'QS',
  accounts:            'Accounts',
  procurement:         'Procurement',
  paid:                'Paid',
};
const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

function getCurrentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function getFYBounds(fy) {
  const [sy] = fy.split('-').map(Number);
  return { from: new Date(sy, 3, 1), to: new Date(sy + 1, 2, 31, 23, 59, 59) };
}

const TOOLTIP_STYLE = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 };

function KPI({ label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    green:  'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
    purple: 'bg-violet-50 border-violet-100 text-violet-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

export default function DQSAnalyticsPage() {
  const [fy, setFy] = useState(getCurrentFY());
  const [projectId, setProjectId] = useState('');

  const { data: bills = [] } = useQuery({
    queryKey: ['dqs-bills-analytics', projectId],
    queryFn: () => dqsBillsAPI.list({ project_id: projectId || undefined, limit: 2000 })
      .then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
    staleTime: 60000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.projects ?? d?.data ?? []); }),
    staleTime: 300000,
  });

  const { from, to } = getFYBounds(fy);

  const fyBills = useMemo(() =>
    bills.filter(b => {
      const d = b.inv_date ? new Date(b.inv_date) : (b.created_at ? new Date(b.created_at) : null);
      return d && d >= from && d <= to;
    }), [bills, from, to]);

  // Status distribution (count)
  const statusDist = useMemo(() => {
    const counts = {};
    fyBills.forEach(b => { counts[b.workflow_status] = (counts[b.workflow_status] || 0) + 1; });
    return Object.entries(counts).map(([s, v]) => ({
      name: STATUS_LABELS[s] || s,
      value: v,
      fill: STATUS_COLORS[s] || '#94a3b8',
    }));
  }, [fyBills]);

  // Status distribution (amount)
  const statusAmtDist = useMemo(() => {
    const totals = {};
    fyBills.forEach(b => {
      const s = b.workflow_status;
      totals[s] = (totals[s] || 0) + Number(b.total_amount || 0);
    });
    return Object.entries(totals).map(([s, v]) => ({
      name: STATUS_LABELS[s] || s,
      amount: parseFloat((v / 100000).toFixed(2)),
      fill: STATUS_COLORS[s] || '#94a3b8',
    }));
  }, [fyBills]);

  // Month-wise bill count + amount
  const MONTH_NAMES = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
  const monthlyData = useMemo(() => {
    const map = {};
    MONTH_NAMES.forEach((m, i) => { map[i] = { month: m, count: 0, total: 0, paid: 0 }; });
    fyBills.forEach(b => {
      const d = b.inv_date ? new Date(b.inv_date) : null;
      if (!d) return;
      let idx = d.getMonth() - 3; // April=0
      if (idx < 0) idx += 12;
      if (idx >= 0 && idx < 12) {
        map[idx].count += 1;
        map[idx].total += Number(b.total_amount || 0);
        if (b.workflow_status === 'paid') map[idx].paid += Number(b.total_amount || 0);
      }
    });
    return Object.values(map).map(r => ({
      ...r,
      total: parseFloat((r.total / 100000).toFixed(2)),
      paid:  parseFloat((r.paid  / 100000).toFixed(2)),
    }));
  }, [fyBills]);

  // Top 10 vendors by total amount
  const vendorData = useMemo(() => {
    const map = {};
    fyBills.forEach(b => {
      const v = b.vendor_name || 'Unknown';
      if (!map[v]) map[v] = { name: v, total: 0, count: 0, paid: 0 };
      map[v].total += Number(b.total_amount || 0);
      map[v].count += 1;
      if (b.workflow_status === 'paid') map[v].paid += Number(b.total_amount || 0);
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(r => ({
        name: r.name.length > 20 ? r.name.substring(0, 18) + '…' : r.name,
        fullName: r.name,
        total: parseFloat((r.total / 100000).toFixed(2)),
        paid:  parseFloat((r.paid  / 100000).toFixed(2)),
        count: r.count,
      }));
  }, [fyBills]);

  // Cumulative payment trend
  const cumulTrend = useMemo(() => {
    let cum = 0;
    return monthlyData.map(m => {
      cum += m.paid;
      return { ...m, cumPaid: parseFloat(cum.toFixed(2)) };
    });
  }, [monthlyData]);

  // KPIs
  const totalBills     = fyBills.length;
  const totalAmt       = fyBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const paidAmt        = fyBills.filter(b => b.workflow_status === 'paid').reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const certAmt        = fyBills.reduce((s, b) => s + Number(b.certified_net || 0), 0);
  const paidPct        = totalAmt > 0 ? ((paidAmt / totalAmt) * 100).toFixed(1) : '0.0';

  const fyOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return `${y}-${y + 1}`;
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE} className="p-3 text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: ₹{p.value}L</p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div style={TOOLTIP_STYLE} className="p-3 text-xs">
        <p className="font-semibold">{d.name}</p>
        <p style={{ color: d.payload.fill }}>{d.value} bills</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <BarChart3 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">DQS Analytics</h1>
            <p className="text-xs text-slate-500">Visual insights on invoice workflows &amp; payment trends</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={fy}
            onChange={e => setFy(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            {fyOptions.map(f => (
              <option key={f} value={f}>FY {f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Bills (FY)" value={totalBills} color="indigo" />
        <KPI label="Total Invoice Value" value={`₹${lakhs(totalAmt)}L`} sub="in lakhs" color="purple" />
        <KPI label="Certified Amount" value={`₹${lakhs(certAmt)}L`} sub="QS certified" color="amber" />
        <KPI label="Amount Paid" value={`₹${lakhs(paidAmt)}L`} sub={`${paidPct}% of total`} color="green" />
      </div>

      {/* Row 1: Workflow Status (count pie) + Status by Amount (bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Status Pie */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-700">Bills by Workflow Status</h2>
          </div>
          {statusDist.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">No data for selected period</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <RPieChart>
                  <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </RPieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {statusDist.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.fill }} />
                    <span className="text-slate-600">{s.name}</span>
                    <span className="ml-auto font-semibold text-slate-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status by Amount bar */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-700">Invoice Value by Status (₹ Lakhs)</h2>
          </div>
          {statusAmtDist.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">No data for selected period</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusAmtDist} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`₹${v}L`, 'Amount']}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {statusAmtDist.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Month-wise Bills Count + Amount */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700">Month-wise Invoice Volume &amp; Value</h2>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="total" name="Total (₹L)" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="paid" name="Paid (₹L)" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 3: Cumulative Payment Trend + Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Cumulative Paid Trend */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-slate-700">Cumulative Payment Trend (₹ Lakhs)</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cumulTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`₹${v}L`, 'Cumulative Paid']}
                contentStyle={TOOLTIP_STYLE}
              />
              <Area type="monotone" dataKey="cumPaid" stroke="#22c55e" strokeWidth={2} fill="url(#paidGrad)" name="Cumulative Paid (₹L)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Vendors */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700">Top 10 Vendors by Invoice Value (₹ Lakhs)</h2>
          </div>
          {vendorData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">No data for selected period</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={vendorData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip
                  formatter={(v, n, p) => [`₹${v}L`, n === 'total' ? 'Invoice Total' : 'Paid']}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="total" name="total" fill="#6366f1" radius={[0, 3, 3, 0]} />
                <Bar dataKey="paid"  name="paid"  fill="#22c55e" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly Bills Count table */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Month-wise Bill Count</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {MONTH_NAMES.map(m => (
                  <th key={m} className="px-2 py-2 text-xs font-semibold text-slate-500 text-center bg-slate-50">{m}</th>
                ))}
                <th className="px-2 py-2 text-xs font-semibold text-slate-500 text-center bg-slate-50">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-2 py-2.5 text-center font-semibold text-slate-700 border-t border-slate-50">
                    {m.count}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center font-bold text-indigo-700 border-t border-slate-50">
                  {monthlyData.reduce((s, m) => s + m.count, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
