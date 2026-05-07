// src/pages/finance/VendorInvoicePage.jsx — Zoho Books style
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, SlidersHorizontal, Download, RefreshCw,
  ChevronLeft, ChevronRight, ExternalLink, ArrowUpDown,
} from 'lucide-react';
import dayjs from 'dayjs';
import { dqsBillsAPI, projectAPI } from '../../api/client';
import { Link } from 'react-router-dom';

// ── Helpers ──────────────────────────────────────────────────────────────────
const inr = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));
const dateFmt = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';

// Map DQS workflow_status → Zoho-style display status
function mapStatus(bill) {
  const ws = String(bill.workflow_status || '').toLowerCase();
  const ps = String(bill.payment_status  || '').toLowerCase();
  if (ps === 'paid' || ws === 'paid') return 'paid';
  if (ps === 'partial')               return 'partial';
  if (ws === 'procurement')           return 'approved';
  if (ws === 'accounts')              return 'accounts';
  if (ws === 'qs')                    return 'qs';
  if (ws === 'document_controller')   return 'doc_ctrl';
  if (ws === 'stores')                return 'stores';
  return 'open';
}

const STATUS = {
  all:      { label: 'All',              dot: '#94A3B8', pill: 'bg-slate-100 text-slate-600' },
  open:     { label: 'Open',             dot: '#3B82F6', pill: 'bg-blue-50 text-blue-700'   },
  stores:   { label: 'Stores',           dot: '#F97316', pill: 'bg-orange-50 text-orange-700'},
  doc_ctrl: { label: 'Doc Control',      dot: '#06B6D4', pill: 'bg-cyan-50 text-cyan-700'   },
  qs:       { label: 'QS',               dot: '#8B5CF6', pill: 'bg-violet-50 text-violet-700'},
  accounts: { label: 'Accounts',         dot: '#1D4ED8', pill: 'bg-indigo-50 text-indigo-700'},
  approved: { label: 'Ready to Pay',     dot: '#10B981', pill: 'bg-emerald-50 text-emerald-700'},
  partial:  { label: 'Partial',          dot: '#F59E0B', pill: 'bg-amber-50 text-amber-700' },
  paid:     { label: 'Paid',             dot: '#10B981', pill: 'bg-green-50 text-green-700' },
};

const TAB_FILTERS = ['all', 'open', 'stores', 'doc_ctrl', 'qs', 'accounts', 'approved', 'partial', 'paid'];

const PAGE_SIZE = 20;

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = STATUS[status] || STATUS.open;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${cfg.pill}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color = '#1D4ED8' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="mt-1 text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function VendorInvoicePage() {
  const [activeTab, setActiveTab]   = useState('all');
  const [search, setSearch]         = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortField, setSortField]   = useState('inv_date');
  const [sortDir, setSortDir]       = useState('desc');
  const [page, setPage]             = useState(1);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: rawBills = [], isLoading, refetch } = useQuery({
    queryKey: ['vendor-payables-dqs'],
    queryFn: () => dqsBillsAPI.list({ limit: 1000 }).then(r => r.data?.data || []).catch(() => []),
    staleTime: 30_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
    staleTime: 300_000,
  });

  // ── Normalize bills ────────────────────────────────────────────────────────
  const bills = useMemo(() => rawBills.map(b => ({
    id:           b.id,
    sl_number:    b.sl_number || '—',
    inv_number:   b.inv_number || b.sl_number || '—',
    vendor_name:  b.vendor_name || '—',
    inv_date:     b.inv_date || b.received_date || null,
    po_number:    b.po_number || '—',
    bill_type:    (b.bill_type || 'po').toUpperCase(),
    basic_amount: Number(b.basic_amount || 0),
    gst_amount:   Number(b.gst_amount || 0),
    total_amount: Number(b.total_amount || b.basic_amount || 0),
    paid_amount:  Number(b.paid_amount || 0),
    balance:      Number(b.total_amount || 0) - Number(b.paid_amount || 0),
    project_id:   b.project_id,
    project_name: b.project_name || '—',
    status:       mapStatus(b),
  })), [rawBills]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = bills.reduce((s, b) => s + b.total_amount, 0);
    const outstanding= bills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.balance, 0);
    const paid       = bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.total_amount, 0);
    const readyToPay = bills.filter(b => b.status === 'approved').length;
    return { total, outstanding, paid, readyToPay, count: bills.length };
  }, [bills]);

  // ── Filter + search + sort ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = bills;
    if (activeTab !== 'all') list = list.filter(b => b.status === activeTab);
    if (projectFilter !== 'all') list = list.filter(b => b.project_id === projectFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b =>
        [b.vendor_name, b.inv_number, b.po_number, b.sl_number, b.project_name]
          .some(v => String(v).toLowerCase().includes(s))
      );
    }
    list = [...list].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [bills, activeTab, projectFilter, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['SL No', 'Invoice No', 'Vendor', 'PO No', 'Type', 'Date', 'Basic', 'GST', 'Total', 'Paid', 'Balance', 'Status', 'Project'];
    const rows = filtered.map(b => [
      b.sl_number, b.inv_number, b.vendor_name, b.po_number, b.bill_type,
      b.inv_date ? dayjs(b.inv_date).format('DD-MM-YYYY') : '',
      b.basic_amount, b.gst_amount, b.total_amount, b.paid_amount, b.balance,
      STATUS[b.status]?.label || b.status, b.project_name,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Vendor_Bills_${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
  };

  // ── Tab count helper ───────────────────────────────────────────────────────
  const tabCount = (key) => key === 'all' ? bills.length : bills.filter(b => b.status === key).length;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Vendor Bills</h1>
          <p className="text-xs text-gray-400">All bills from DQS tracker</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <Link to="/dqs/bills" className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-blue-700 text-white text-sm font-medium">
            <ExternalLink className="w-3.5 h-3.5" /> Open DQS Tracker
          </Link>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Total Bills"        value={stats.count}            sub="All time"                     color="#1D4ED8" />
          <SummaryCard label="Total Value"         value={inr(stats.total)}       sub="Gross including GST"          color="#374151" />
          <SummaryCard label="Outstanding Balance" value={inr(stats.outstanding)} sub="Unpaid / partially paid"      color="#DC2626" />
          <SummaryCard label="Ready to Pay"        value={`${stats.readyToPay} bills`} sub={`${inr(bills.filter(b=>b.status==='approved').reduce((s,b)=>s+b.balance,0))} pending`} color="#059669" />
        </div>

        {/* ── Filter row ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-1.5 flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search vendor, invoice, PO…"
              className="text-sm outline-none w-full placeholder:text-gray-400 bg-transparent"
            />
          </div>

          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
            className="bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-600 outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="ml-auto text-xs text-gray-400 font-medium">
            {filtered.length} bill{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Status tabs ── */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TAB_FILTERS.map(key => {
            const count = tabCount(key);
            if (count === 0 && key !== 'all') return null;
            return (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setPage(1); }}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-[#1D4ED8] text-[#1D4ED8]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {STATUS[key]?.label}
                <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  activeTab === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <button onClick={() => toggleSort('inv_date')} className="flex items-center gap-1 hover:text-gray-700">
                      Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bill #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <button onClick={() => toggleSort('vendor_name')} className="flex items-center gap-1 hover:text-gray-700">
                      Vendor <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PO / Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <button onClick={() => toggleSort('total_amount')} className="flex items-center gap-1 hover:text-gray-700 ml-auto">
                      Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance Due</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">Loading bills…</td></tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="text-gray-300 text-4xl mb-3">📄</div>
                      <div className="text-gray-500 font-medium">No bills found</div>
                      <div className="text-gray-400 text-xs mt-1">Try adjusting your filters</div>
                    </td>
                  </tr>
                ) : paginated.map(bill => (
                  <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{dateFmt(bill.inv_date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-blue-700 text-xs">{bill.inv_number}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{bill.sl_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 text-sm max-w-[180px] truncate">{bill.vendor_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">{bill.po_number}</div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mt-0.5 inline-block">{bill.bill_type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{bill.project_name}</td>
                    <td className="px-4 py-3"><StatusPill status={bill.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-gray-800 text-sm">{inr(bill.total_amount)}</div>
                      {bill.gst_amount > 0 && <div className="text-[10px] text-gray-400">GST: {inr(bill.gst_amount)}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold text-sm ${bill.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {bill.balance > 0 ? inr(bill.balance) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/dqs/bills" className="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              {paginated.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-gray-500">
                      Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length} bills
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800 text-sm">
                      {inr(paginated.reduce((s, b) => s + b.total_amount, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600 text-sm">
                      {inr(paginated.reduce((s, b) => s + b.balance, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      page === p ? 'bg-[#1D4ED8] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && <span className="text-gray-400 text-sm">…{totalPages}</span>}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
