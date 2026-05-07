// src/pages/stores/GRNPage.jsx  — Unified GRN (Create · View · Verify · Approve · Print)
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PackageCheck, Plus, X, Search, Download, Printer,
  Truck, CheckCircle2, Clock, AlertTriangle, Package,
  ChevronRight, FileText, Calendar, Hash, TrendingUp,
  ShieldCheck, CheckCheck, RefreshCw, ClipboardList,
  Eye, Building2, Link2, Info
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { grnAPI, projectAPI, vendorAPI, poAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import GRNPrintTemplate from './GRNPrintTemplate';

const UNITS = ['MT', 'Bags', 'CUM', 'Brass', 'Nos', 'RMT', 'Drum', 'Ltr', 'Kg', 'Sqft', 'Sqm', 'Pair', 'Roll', 'Bundle'];

const STATUS_CONFIG = {
  pending:         { label: 'Pending',        short: 'Pending',      color: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-500',   icon: Clock },
  verified_stores: { label: 'Stores Verified', short: 'Stores OK',   color: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500',    icon: ShieldCheck },
  approved:        { label: 'Approved',        short: 'Approved',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
  rejected:        { label: 'Rejected',        short: 'Rejected',    color: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-500',     icon: AlertTriangle },
  partial:         { label: 'Partial',         short: 'Partial',     color: 'bg-orange-50 text-orange-700 border-orange-200',  dot: 'bg-orange-500',  icon: AlertTriangle },
};

const inr = n => Number(n || 0).toLocaleString('en-IN');

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap', cfg.color)}>
      <Icon size={11} strokeWidth={2.5} />
      {cfg.short}
    </span>
  );
}

/* ── Workflow stepper ─────────────────────────────────────────── */
const STEPS = [
  { key: 'created',        label: 'GRN Created',       desc: 'Material received at site' },
  { key: 'verified_stores',label: 'Stores Verified',   desc: 'Stores team confirmed quantities' },
  { key: 'approved',       label: 'QC Approved',       desc: 'Quality check done, posted to stock' },
];

function WorkflowStepper({ status }) {
  const active = status === 'approved' ? 2 : status === 'verified_stores' ? 1 : 0;
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-1 min-w-0">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-black transition-all',
              i < active  ? 'bg-emerald-500 border-emerald-500 text-white' :
              i === active ? 'bg-indigo-600 border-indigo-600 text-white' :
                             'bg-white border-slate-300 text-slate-400'
            )}>
              {i < active ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <div className="text-center">
              <div className={clsx('text-[10px] font-bold leading-tight',
                i <= active ? 'text-slate-800' : 'text-slate-400'
              )}>{s.label}</div>
              <div className="text-[9px] text-slate-400 leading-tight max-w-[80px]">{s.desc}</div>
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div className={clsx('flex-1 h-0.5 mx-1 mb-5', i < active ? 'bg-emerald-400' : 'bg-slate-200')} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Detail / Approval Panel ──────────────────────────────────── */
function GRNDetailPanel({ grn, onClose, onVerify, onApprove, verifyLoading, approveLoading, printRef }) {
  if (!grn) return null;
  const status = grn.quality_status || grn.status || 'pending';
  const items  = grn.items || [];
  const totalValue = items.reduce((s, it) =>
    s + parseFloat(it.quantity_received || 0) * parseFloat(it.rate || 0), 0
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Goods Receipt Note</div>
            <h2 className="text-xl font-black text-white font-mono">{grn.grn_number}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{grn.project_name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={status} />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Workflow stepper */}
        <div className="bg-slate-800 px-6 py-4 flex-shrink-0">
          <WorkflowStepper status={status} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50">

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ['Supplier',      grn.vendor_name || grn.supplier_name || '—'],
              ['GRN Date',      grn.grn_date ? dayjs(grn.grn_date).format('DD MMM YYYY') : '—'],
              ['Challan No.',   grn.challan_number || '—'],
              ['Invoice No.',   grn.invoice_number || '—'],
              ['Vehicle No.',   grn.vehicle_number || '—'],
              ['Gate Pass',     grn.gate_pass_no   || '—'],
              ['Site Location', grn.site_location  || '—'],
              ['WB Slip No.',   grn.wb_slip_no     || '—'],
              ['Received By',   grn.received_by_name || '—'],
            ].map(([lbl, val]) => (
              <div key={lbl} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{lbl}</div>
                <div className="text-sm font-semibold text-slate-800 truncate">{val}</div>
              </div>
            ))}
          </div>

          {/* Remarks */}
          {grn.remarks && (
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Remarks</div>
              <div className="text-sm text-slate-700">{grn.remarks}</div>
            </div>
          )}

          {/* Items table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Package size={13} /> Material Items Received
              </span>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {items.length} items
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['#','Material','Unit','Qty Received','Rate','Amount'].map(h => (
                    <th key={h} className={clsx(
                      'px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50',
                      ['Qty Received','Rate','Amount'].includes(h) ? 'text-right' : 'text-left'
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((it, i) => {
                  const amount = parseFloat(it.quantity_received || 0) * parseFloat(it.rate || 0);
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{it.material_name}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold uppercase text-[10px]">{it.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600 font-mono">{it.quantity_received}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                        {parseFloat(it.rate) > 0 ? `₹${inr(it.rate)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-indigo-600 font-mono">
                        {amount > 0 ? `₹${inr(amount)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totalValue > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold text-slate-500 uppercase">Total Value</td>
                    <td className="px-3 py-2 text-right font-black text-indigo-700 font-mono text-sm">₹{inr(totalValue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Approval chain */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={13} /> Approval Chain
              </span>
            </div>
            <div className="p-4 space-y-2">
              {[
                { step: 'GRN Created',     done: true,
                  name: grn.received_by_name, time: grn.grn_date,     icon: PackageCheck },
                { step: 'Stores Verified', done: status === 'verified_stores' || status === 'approved',
                  name: grn.verified_stores_name, time: grn.verified_stores_at, icon: ShieldCheck },
                { step: 'QC Approved',     done: status === 'approved',
                  name: grn.approved_qc_name,  time: grn.approved_qc_at,     icon: CheckCheck },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs transition',
                    s.done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  )}>
                    <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                      s.done ? 'bg-emerald-500' : 'bg-slate-300'
                    )}>
                      <Icon size={13} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-700">{s.step}</span>
                      {s.name && <span className="text-slate-500 ml-2">by {s.name}</span>}
                      {s.time && <span className="text-slate-400 ml-2">· {dayjs(s.time).format('DD MMM YYYY')}</span>}
                    </div>
                    {s.done && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex-shrink-0 space-y-2">
          {/* Step 1: Pending → Stores Verified */}
          {status === 'pending' && (
            <button
              onClick={onVerify}
              disabled={verifyLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition shadow-sm"
            >
              <ShieldCheck size={16} />
              {verifyLoading ? 'Processing…' : 'Step 1 — Mark as Stores Verified'}
            </button>
          )}

          {/* Step 2: Stores Verified → QC Approved */}
          {status === 'verified_stores' && (
            <button
              onClick={onApprove}
              disabled={approveLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition shadow-sm"
            >
              <CheckCheck size={16} />
              {approveLoading ? 'Posting to Inventory…' : 'Step 2 — Approve & Post to Stock Ledger'}
            </button>
          )}

          {/* Approved */}
          {status === 'approved' && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Fully Approved — Stock posted to inventory ledger
            </div>
          )}

          {/* Print + Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { /* trigger print from parent */ document.dispatchEvent(new CustomEvent('grn-print')); }}
              className="flex-1 flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm transition"
            >
              <Printer size={15} /> Print GRN
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-slate-500 text-sm font-medium hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function GRNPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm]         = useState(false);
  const [selectedId, setSelectedId]     = useState(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('');
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({ contentRef: printRef });
  const printFnRef  = useRef(handlePrint);
  React.useEffect(() => { printFnRef.current = handlePrint; });

  // Listen for print trigger dispatched from inside the detail panel
  React.useEffect(() => {
    const handler = () => printFnRef.current?.();
    document.addEventListener('grn-print', handler);
    return () => document.removeEventListener('grn-print', handler);
  }, []);

  const { data: grnList = [], isLoading, refetch } = useQuery({
    queryKey: ['grn-list', projectFilter],
    queryFn: () => grnAPI.list(projectFilter ? { project_id: projectFilter } : {}).then(r => r.data.data),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const { data: detailedGRN } = useQuery({
    queryKey: ['grn', selectedId],
    queryFn: () => grnAPI.get(selectedId).then(r => r.data.data),
    enabled: !!selectedId,
  });

  const verifyMutation = useMutation({
    mutationFn: (id) => grnAPI.approve(id, 'verify-stores'),
    onSuccess: () => {
      toast.success('Stores verification complete');
      qc.invalidateQueries({ queryKey: ['grn-list'] });
      qc.invalidateQueries({ queryKey: ['grn', selectedId] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Verification failed'),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => grnAPI.approve(id, 'approve-qc'),
    onSuccess: () => {
      toast.success('GRN approved — stock posted to ledger!');
      qc.invalidateQueries({ queryKey: ['grn-list'] });
      qc.invalidateQueries({ queryKey: ['grn', selectedId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Approval failed'),
  });

  // Counts
  const counts = {
    pending:         grnList.filter(g => (g.status || g.quality_status) === 'pending').length,
    verified_stores: grnList.filter(g => (g.status || g.quality_status) === 'verified_stores').length,
    approved:        grnList.filter(g => (g.status || g.quality_status) === 'approved').length,
  };

  const filtered = grnList.filter(g => {
    const s = g.status || g.quality_status || 'pending';
    if (statusFilter !== 'all' && s !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!g.grn_number?.toLowerCase().includes(q) &&
          !g.project_name?.toLowerCase().includes(q) &&
          !g.vendor_name?.toLowerCase().includes(q) &&
          !g.supplier_name?.toLowerCase().includes(q) &&
          !g.challan_number?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ['GRN Number','Date','Project','Supplier','Challan No','Status'];
    const rows = filtered.map(g => [
      g.grn_number,
      dayjs(g.grn_date).format('DD/MM/YYYY'),
      g.project_name,
      g.supplier_name || g.vendor_name || '',
      g.challan_number || '',
      g.status || g.quality_status || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `GRN_${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const STATUS_FILTERS = [
    { key: 'all',             label: 'All',            count: grnList.length },
    { key: 'pending',         label: 'Pending',        count: counts.pending,         color: 'bg-amber-500' },
    { key: 'verified_stores', label: 'Stores Verified',count: counts.verified_stores, color: 'bg-blue-500' },
    { key: 'approved',        label: 'Approved',       count: counts.approved,        color: 'bg-emerald-500' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-full mx-auto min-h-screen bg-[#f4f6f9]">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <PackageCheck className="w-3.5 h-3.5" /> Stores
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Receipt Notes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Receive · Verify · Approve · Post to inventory — all in one place</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()}
            className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded-lg text-slate-500 hover:border-slate-300 hover:text-slate-700 transition bg-white shadow-sm">
            <RefreshCw size={14} />
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 transition shadow-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm">
            <Plus size={14} /> New GRN
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total GRNs',      value: grnList.length,    icon: FileText,      color: 'text-slate-400',    bg: 'bg-white border-slate-200' },
          { label: 'Pending Review',  value: counts.pending,    icon: Clock,         color: 'text-amber-500',    bg: 'bg-amber-50 border-amber-200' },
          { label: 'Stores Verified', value: counts.verified_stores, icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Approved',        value: counts.approved,   icon: CheckCircle2,  color: 'text-emerald-500',  bg: 'bg-emerald-50 border-emerald-200' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={clsx('border rounded-xl p-4 shadow-sm', bg)}>
            <Icon className={clsx('w-4 h-4 mb-2', color)} />
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Workflow banner (if pending) ─────────────────────────── */}
      {counts.pending > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Clock size={16} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            {counts.pending} GRN{counts.pending > 1 ? 's' : ''} waiting for stores verification
          </span>
          <button onClick={() => setStatusFilter('pending')} className="ml-auto text-xs font-bold text-amber-700 underline">
            Review now →
          </button>
        </div>
      )}
      {counts.verified_stores > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <ShieldCheck size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-blue-800">
            {counts.verified_stores} GRN{counts.verified_stores > 1 ? 's' : ''} stores-verified — pending QC approval to post stock
          </span>
          <button onClick={() => setStatusFilter('verified_stores')} className="ml-auto text-xs font-bold text-blue-700 underline">
            Approve now →
          </button>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3 shadow-sm">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                statusFilter === f.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              )}>
              {f.color && <span className={clsx('w-1.5 h-1.5 rounded-full', f.color)} />}
              {f.label}
              <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-black',
                statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              )}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Project filter */}
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-700 outline-none focus:border-indigo-400">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search GRN, supplier, challan…"
            className="h-9 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-indigo-400 transition w-56" />
        </div>

        <span className="text-xs text-slate-400">{filtered.length} of {grnList.length}</span>
      </div>

      {/* ── GRN Table ───────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['GRN Number','Date','Project','Supplier','Challan No.','Site','Items','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-5 bg-slate-100 animate-pulse rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.map(grn => {
                const status = grn.status || grn.quality_status || 'pending';
                return (
                  <tr key={grn.id} onClick={() => setSelectedId(grn.id)}
                    className="cursor-pointer hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold font-mono text-indigo-700 group-hover:underline">{grn.grn_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                      {grn.grn_date ? dayjs(grn.grn_date).format('DD MMM YYYY') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800 max-w-[140px] truncate">{grn.project_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-700 max-w-[130px] truncate">{grn.supplier_name || grn.vendor_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        {grn.challan_number || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{grn.site_location || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {grn.total_quantity || '—'} units
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">No GRNs found</p>
                    <p className="text-xs text-slate-300 mt-1">
                      {statusFilter === 'pending' ? 'All caught up — no pending GRNs.' : 'Adjust filters or create a new GRN.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          Showing {filtered.length} of {grnList.length} receipt notes
        </div>
      </div>

      {/* ── Detail / Verification Panel ─────────────────────────── */}
      {selectedId && detailedGRN && (
        <GRNDetailPanel
          grn={detailedGRN}
          onClose={() => setSelectedId(null)}
          onVerify={() => verifyMutation.mutate(selectedId)}
          onApprove={() => approveMutation.mutate(selectedId)}
          verifyLoading={verifyMutation.isPending}
          approveLoading={approveMutation.isPending}
        />
      )}

      {/* ── New GRN Form ────────────────────────────────────────── */}
      {showForm && (
        <GRNForm onClose={() => setShowForm(false)} projects={projects} qc={qc} />
      )}

      {/* Hidden print area */}
      <div className="hidden">
        <div ref={printRef}>
          {detailedGRN && <GRNPrintTemplate data={detailedGRN} />}
        </div>
      </div>
    </div>
  );
}

/* ── GRN Create Form ─────────────────────────────────────────── */
function GRNForm({ onClose, projects, qc }) {
  const [form, setForm] = useState({
    project_id: '', po_id: '', vendor_id: '', grn_date: dayjs().format('YYYY-MM-DD'),
    vehicle_number: '', driver_name: '', challan_number: '', invoice_number: '',
    site_location: '', gate_pass_no: '', wb_slip_no: '', remarks: '',
  });
  const [items, setItems] = useState([
    { material_name: '', unit: 'Nos', quantity_received: '', quality_remarks: '', po_item_id: null }
  ]);
  const [poLinked, setPoLinked] = useState(null); // stores selected PO detail

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorAPI.list().then(r => r.data.data),
  });

  // Load approved/sent POs for selected project
  const { data: availablePOs = [] } = useQuery({
    queryKey: ['pos-for-grn', form.project_id],
    queryFn: () => poAPI.list({ project_id: form.project_id, status: 'approved' })
      .then(r => r.data.data || []),
    enabled: !!form.project_id,
  });

  // Also load 'sent' POs (already dispatched to vendor)
  const { data: sentPOs = [] } = useQuery({
    queryKey: ['pos-for-grn-sent', form.project_id],
    queryFn: () => poAPI.list({ project_id: form.project_id, status: 'sent' })
      .then(r => r.data.data || []),
    enabled: !!form.project_id,
  });

  const allAvailablePOs = [...availablePOs, ...sentPOs];

  // When PO is selected, auto-fill vendor and items
  useEffect(() => {
    if (!form.po_id) {
      setPoLinked(null);
      return;
    }
    poAPI.get(form.po_id).then(r => {
      const po = r.data.data;
      setPoLinked(po);
      // Auto-fill vendor
      if (po.vendor_id) setForm(prev => ({ ...prev, vendor_id: po.vendor_id }));
      // Auto-fill items from PO items
      if (po.items?.length) {
        setItems(po.items.map(it => ({
          material_name: it.material_name || '',
          unit: it.unit || 'Nos',
          quantity_received: '',   // blank — stores team fills actual received qty
          quality_remarks: '',
          po_item_id: it.id || null,
          po_qty: it.quantity,     // reference quantity from PO (display only)
          po_rate: it.rate,        // reference rate from PO
        })));
      }
    }).catch(() => {
      toast.error('Could not load PO details');
    });
  }, [form.po_id]);

  // Reset PO link when project changes
  useEffect(() => {
    setForm(prev => ({ ...prev, po_id: '', vendor_id: '' }));
    setPoLinked(null);
    setItems([{ material_name: '', unit: 'Nos', quantity_received: '', quality_remarks: '', po_item_id: null }]);
  }, [form.project_id]);

  const createMutation = useMutation({
    mutationFn: (d) => grnAPI.create(d),
    onSuccess: () => {
      toast.success('GRN created — pending verification!');
      qc.invalidateQueries({ queryKey: ['grn-list'] });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create GRN'),
  });

  const submit = () => {
    if (!form.project_id) return toast.error('Select a project');
    if (!form.grn_date)   return toast.error('GRN date is required');
    const validItems = items.filter(i => i.material_name?.trim() && i.quantity_received);
    if (!validItems.length) return toast.error('Add at least one item with quantity');
    createMutation.mutate({ ...form, items: validItems });
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const updateItem = (idx, k, v) => { const n = [...items]; n[idx][k] = v; setItems(n); };
  const addRow = () => setItems([...items, { material_name: '', unit: 'Nos', quantity_received: '', quality_remarks: '', po_item_id: null }]);
  const removeRow = (idx) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };

  const inp = 'w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <PackageCheck size={16} className="text-emerald-400" /> New Goods Receipt Note
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Record inward material with challan & vehicle details</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Section 1: Receipt details */}
          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Receipt Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Project *',      key: 'project_id',    type: 'select', opts: projects.map(p => ({ v: p.id, l: p.name })), ph: 'Select project…' },
                { label: 'GRN Date *',     key: 'grn_date',      type: 'date' },
                { label: 'Vendor / Supplier', key: 'vendor_id',  type: 'select', opts: vendors.map(v => ({ v: v.id, l: v.name })), ph: 'Select vendor…', optional: true },
                { label: 'Challan Number', key: 'challan_number',type: 'text',   ph: 'e.g. CH-2026-001' },
                { label: 'Invoice Number', key: 'invoice_number',type: 'text',   ph: 'Invoice ref.' },
                { label: 'Vehicle Number', key: 'vehicle_number',type: 'text',   ph: 'e.g. KA01AB1234', upper: true },
                { label: 'Driver Name',    key: 'driver_name',   type: 'text',   ph: 'Driver name' },
                { label: 'Site Location',  key: 'site_location', type: 'text',   ph: 'e.g. Main Store' },
                { label: 'Gate Pass No.',  key: 'gate_pass_no',  type: 'text',   ph: 'Gate pass number' },
                { label: 'WB Slip No.',    key: 'wb_slip_no',    type: 'text',   ph: 'Weighbridge slip' },
              ].map(({ label, key, type, opts, ph, upper, optional }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">{label}</label>
                  {type === 'select' ? (
                    <select value={form[key]} onChange={e => setField(key, e.target.value)} className={inp}>
                      <option value="">{ph}</option>
                      {opts?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ) : (
                    <input type={type} value={form[key]} onChange={e => setField(key, upper ? e.target.value.toUpperCase() : e.target.value)}
                      placeholder={ph} className={inp} />
                  )}
                </div>
              ))}
            </div>

            {/* PO Link — shown only when project is selected */}
            {form.project_id && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 size={13} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Link to Purchase Order (Optional)</span>
                </div>
                {allAvailablePOs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No approved / sent POs found for this project</p>
                ) : (
                  <select
                    value={form.po_id}
                    onChange={e => setField('po_id', e.target.value)}
                    className={inp + ' max-w-md'}
                  >
                    <option value="">— No PO link (walk-in / direct purchase) —</option>
                    {allAvailablePOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} — {po.vendor_name} ({po.status === 'sent' ? 'Sent' : 'Approved'})
                      </option>
                    ))}
                  </select>
                )}

                {/* PO linked banner */}
                {poLinked && (
                  <div className="mt-3 flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                    <Info size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-indigo-700">
                        Linked to {poLinked.po_number}
                      </p>
                      <p className="text-xs text-indigo-500 mt-0.5">
                        Vendor auto-filled · {poLinked.items?.length || 0} item(s) pre-loaded from PO — enter actual quantities received below
                      </p>
                    </div>
                    <button onClick={() => setField('po_id', '')} className="text-indigo-400 hover:text-indigo-600 transition">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Items */}
          <div className="border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Material Items Received
                {poLinked && <span className="ml-2 text-indigo-500 font-normal normal-case">(from PO — enter actual qty)</span>}
              </h3>
              <button onClick={addRow}
                className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition">
                <Plus size={12} /> Add Row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Material Name *','Unit', ...(poLinked ? ['PO Qty'] : []), 'Qty Received *','Quality Remarks',''].map(h => (
                      <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="pr-2 py-1.5">
                        <input placeholder="Material name" value={it.material_name}
                          onChange={e => updateItem(idx, 'material_name', e.target.value)}
                          className="w-48 h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:border-indigo-400" />
                      </td>
                      <td className="pr-2 py-1.5">
                        <select value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                          className="w-20 h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm outline-none focus:border-indigo-400">
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      {/* PO reference qty column */}
                      {poLinked && (
                        <td className="pr-2 py-1.5">
                          <div className="w-24 h-9 bg-indigo-50 border border-indigo-100 rounded-lg px-3 flex items-center justify-end text-sm text-indigo-500 font-medium">
                            {it.po_qty || '—'}
                          </div>
                        </td>
                      )}
                      <td className="pr-2 py-1.5">
                        <input type="number" placeholder="0" value={it.quantity_received}
                          onChange={e => {
                            const v = e.target.value;
                            // warn if exceeds PO qty
                            if (it.po_qty && parseFloat(v) > parseFloat(it.po_qty)) {
                              toast('Qty exceeds PO quantity!', { icon: '⚠️' });
                            }
                            updateItem(idx, 'quantity_received', v);
                          }}
                          className="w-28 h-9 bg-emerald-50 border border-emerald-200 rounded-lg px-3 text-sm text-emerald-700 font-semibold text-right outline-none focus:border-emerald-400" />
                      </td>
                      <td className="pr-2 py-1.5">
                        <input placeholder="Notes" value={it.quality_remarks}
                          onChange={e => updateItem(idx, 'quality_remarks', e.target.value)}
                          className="w-36 h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:border-indigo-400" />
                      </td>
                      <td className="py-1.5">
                        <button onClick={() => removeRow(idx)} disabled={items.length === 1}
                          className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 transition">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Remarks</h3>
            <textarea rows={2} placeholder="Any notes about this receipt…" value={form.remarks}
              onChange={e => setField('remarks', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-indigo-400 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <span className="text-xs text-slate-400">
            {items.filter(i => i.material_name && i.quantity_received).length} item(s) ready
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-5 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition">
              Cancel
            </button>
            <button onClick={submit} disabled={createMutation.isPending}
              className="px-6 h-9 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm">
              {createMutation.isPending ? 'Creating…' : 'Create GRN →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
