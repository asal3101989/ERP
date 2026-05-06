// src/pages/finance/CustomerStatementsPage.jsx
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSignature, Search, ArrowRight, AlertTriangle, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { projectAPI, raBillAPI } from '../../api/client';
import dayjs from 'dayjs';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const dateFmt = (d) => d ? dayjs(d).format('DD MMM YY') : '—';

const STATUS_META = {
  draft:      { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
  submitted:  { label: 'Submitted', cls: 'bg-sky-100 text-sky-700' },
  verified:   { label: 'Verified',  cls: 'bg-blue-100 text-blue-700' },
  certified:  { label: 'Certified', cls: 'bg-indigo-100 text-indigo-700' },
  paid:       { label: 'Paid ✓',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:   { label: 'Rejected',  cls: 'bg-red-100 text-red-700' },
};

const AGING_BUCKETS = [
  { key: 'current', label: 'Not Yet Due',  color: '#10B981', bg: '#ECFDF5' },
  { key: 'd30',     label: '1–30 Days',    color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'd60',     label: '31–60 Days',   color: '#F97316', bg: '#FFF7ED' },
  { key: 'd90',     label: '61–90 Days',   color: '#EF4444', bg: '#FEF2F2' },
  { key: 'over90',  label: '90+ Days',     color: '#7C3AED', bg: '#F5F3FF' },
];

function agingBucket(billDate) {
  if (!billDate) return 'over90';
  const days = dayjs().diff(dayjs(billDate), 'day');
  if (days <= 0)  return 'current';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= 90) return 'd90';
  return 'over90';
}

function StatusBadge({ status }) {
  const cfg = STATUS_META[String(status || '').toLowerCase()] || { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function KpiCard({ label, value, sub, color = '#1B4FD8', bg = '#EFF6FF' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-400 font-medium">{sub}</div>}
    </div>
  );
}

export default function CustomerStatementsPage() {
  const [activeTab, setActiveTab]       = useState('bills');
  const [selectedProject, setSelectedProject] = useState('all');
  const [search, setSearch]             = useState('');
  const [status, setStatus]             = useState('all');

  const { data: projects = [] } = useQuery({
    queryKey: ['cs-projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['cs-rabills'],
    queryFn: () => raBillAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  // ── Filtered bills ──────────────────────────────────────────────────────
  const filtered = useMemo(() => bills.filter(b => {
    if (selectedProject !== 'all' && b.project_id !== selectedProject) return false;
    if (status !== 'all' && String(b.status).toLowerCase() !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      return [b.bill_number, b.project_name, b.contractor_name, b.work_description]
        .some(v => String(v || '').toLowerCase().includes(s));
    }
    return true;
  }), [bills, selectedProject, status, search]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total       = filtered.reduce((s, b) => s + Number(b.gross_amount || b.net_payable || 0), 0);
    const received    = filtered.reduce((s, b) => s + Number(b.amount_received || 0), 0);
    const outstanding = total - received;
    const overdue     = filtered.filter(b => {
      if (['paid'].includes(String(b.status).toLowerCase())) return false;
      return dayjs().diff(dayjs(b.bill_date), 'day') > 30;
    });
    return { total, received, outstanding, overdueCount: overdue.length, overdueAmt: overdue.reduce((s, b) => s + Number(b.gross_amount || b.net_payable || 0) - Number(b.amount_received || 0), 0) };
  }, [filtered]);

  // ── Aging analysis (unpaid bills only) ──────────────────────────────────
  const aging = useMemo(() => {
    const unpaid = bills.filter(b => !['paid', 'rejected'].includes(String(b.status).toLowerCase()));
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
    const byProject = {};

    unpaid.forEach(b => {
      const balance = Number(b.gross_amount || b.net_payable || 0) - Number(b.amount_received || 0);
      const bkt = agingBucket(b.bill_date);
      buckets[bkt] += balance;

      const proj = b.project_name || 'Unassigned';
      if (!byProject[proj]) byProject[proj] = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
      byProject[proj][bkt] += balance;
      byProject[proj].total += balance;
    });

    return { buckets, byProject: Object.entries(byProject).sort((a, b) => b[1].total - a[1].total) };
  }, [bills]);

  const totalAging = Object.values(aging.buckets).reduce((s, v) => s + v, 0);

  // ── CSV export ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Bill Number', 'Project', 'Contractor', 'Bill Date', 'Gross Amount', 'Received', 'Balance', 'Status'];
    const rows = filtered.map(b => [
      b.bill_number || '', b.project_name || '', b.contractor_name || '',
      b.bill_date ? dayjs(b.bill_date).format('DD-MM-YYYY') : '',
      b.gross_amount || 0, b.amount_received || 0,
      (Number(b.gross_amount || 0) - Number(b.amount_received || 0)).toFixed(2),
      b.status || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Receivables_${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-5 space-y-5 font-sans">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Receivables</h1>
          <p className="text-sm text-slate-400 mt-0.5">RA bills, client collections and AR aging analysis</p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <button onClick={exportCSV}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <Link to="/qs/ra-bills"
            className="px-4 py-2 rounded-lg bg-[#1B4FD8] text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5" /> Open RA Bills
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Billed"    value={inr(kpis.total)}       sub={`${filtered.length} bills`}             color="#1B4FD8" />
        <KpiCard label="Amount Received" value={inr(kpis.received)}    sub="Client receipts posted"                  color="#10B981" />
        <KpiCard label="Outstanding"     value={inr(kpis.outstanding)} sub="Open receivable balance"                 color="#EF4444" />
        <KpiCard label="Overdue (>30d)"  value={`${kpis.overdueCount} bills`} sub={inr(kpis.overdueAmt) + ' at risk'} color="#F59E0B" />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[['bills', 'RA Bills'], ['aging', 'AR Aging']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── BILLS TAB ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === 'bills' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search project, contractor, bill no…"
                className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
              />
            </div>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 outline-none">
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 outline-none">
              <option value="all">All Status</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {(search || selectedProject !== 'all' || status !== 'all') && (
              <button onClick={() => { setSearch(''); setSelectedProject('all'); setStatus('all'); }}
                className="px-3 py-2 text-sm text-slate-500 hover:text-red-500 font-medium">
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Project / Contractor', 'Bill No.', 'Bill Date', 'Gross Amount', 'Received', 'Balance', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">No bills found</td></tr>
                  ) : filtered.map(b => {
                    const balance = Number(b.gross_amount || b.net_payable || 0) - Number(b.amount_received || 0);
                    const pctReceived = Number(b.gross_amount || b.net_payable || 1) > 0
                      ? (Number(b.amount_received || 0) / Number(b.gross_amount || b.net_payable || 1)) * 100
                      : 0;
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900 text-[13px]">{b.project_name || '—'}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{b.contractor_name || 'Contractor'}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[12px] font-bold text-blue-700">
                          {b.bill_number || `RA-${String(b.id || '').slice(0, 8)}`}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-400 whitespace-nowrap">{dateFmt(b.bill_date)}</td>
                        <td className="px-5 py-3.5 font-mono text-[13px] font-semibold text-slate-800">{inr(b.gross_amount || b.net_payable)}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-mono text-[13px] text-emerald-600 font-semibold">{inr(b.amount_received || 0)}</div>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(pctReceived, 100)}%` }} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[13px] font-bold" style={{ color: balance > 0 ? '#EF4444' : '#10B981' }}>
                          {inr(balance)}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                        <td className="px-5 py-3.5">
                          <Link to="/qs/ra-bills" className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1">
                            View <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-5 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wide">Total ({filtered.length} bills)</td>
                      <td className="px-5 py-3 font-mono text-[13px] font-black text-slate-800">{inr(kpis.total)}</td>
                      <td className="px-5 py-3 font-mono text-[13px] font-black text-emerald-700">{inr(kpis.received)}</td>
                      <td className="px-5 py-3 font-mono text-[13px] font-black text-red-700">{inr(kpis.outstanding)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── AR AGING TAB ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === 'aging' && (
        <div className="space-y-5">

          {/* Aging bucket summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {AGING_BUCKETS.map(bkt => {
              const amt = aging.buckets[bkt.key] || 0;
              const pct = totalAging > 0 ? ((amt / totalAging) * 100).toFixed(0) : 0;
              return (
                <div key={bkt.key} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{bkt.label}</div>
                  <div className="mt-2 text-xl font-extrabold" style={{ color: bkt.color }}>{inr(amt)}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{pct}% of total</div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bkt.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aging by project table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-[15px] font-bold text-slate-800">AR Aging by Project</h2>
              <span className="text-[11px] text-slate-400 font-medium">Unpaid / outstanding bills only</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-5 py-3">Project</th>
                    {AGING_BUCKETS.map(b => (
                      <th key={b.key} className="text-right text-[10px] font-black uppercase tracking-widest px-4 py-3" style={{ color: b.color }}>{b.label}</th>
                    ))}
                    <th className="text-right text-[10px] font-black uppercase tracking-widest text-slate-700 px-5 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {aging.byProject.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                        No outstanding receivables — all clear!
                      </td>
                    </tr>
                  ) : aging.byProject.map(([proj, data]) => (
                    <tr key={proj} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-800 text-[13px]">{proj}</td>
                      {AGING_BUCKETS.map(bkt => (
                        <td key={bkt.key} className="px-4 py-3.5 text-right font-mono text-[12px]"
                          style={{ color: data[bkt.key] > 0 ? bkt.color : '#CBD5E1', fontWeight: data[bkt.key] > 0 ? 700 : 400 }}>
                          {data[bkt.key] > 0 ? inr(data[bkt.key]) : '—'}
                        </td>
                      ))}
                      <td className="px-5 py-3.5 text-right font-mono text-[13px] font-black text-slate-900">{inr(data.total)}</td>
                    </tr>
                  ))}
                </tbody>
                {aging.byProject.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td className="px-5 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wide">Total</td>
                      {AGING_BUCKETS.map(bkt => (
                        <td key={bkt.key} className="px-4 py-3 text-right font-mono text-[12px] font-black" style={{ color: bkt.color }}>
                          {inr(aging.buckets[bkt.key])}
                        </td>
                      ))}
                      <td className="px-5 py-3 text-right font-mono text-[13px] font-black text-slate-900">{inr(totalAging)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {totalAging > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[12px] text-amber-700 font-medium">
                <span className="font-bold">{inr(aging.buckets.over90)}</span> is overdue by more than 90 days.
                Follow up on outstanding RA bills to improve cash flow.
                <Link to="/qs/ra-bills" className="ml-2 font-bold underline">View RA Bills →</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
