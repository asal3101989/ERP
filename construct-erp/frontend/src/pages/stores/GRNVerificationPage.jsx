// src/pages/stores/GRNVerificationPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Search, CheckCircle2, Clock, XCircle,
  PackageCheck, ChevronRight, AlertTriangle, RefreshCw,
  Building2, Truck, Hash, Calendar, ClipboardList, X,
  CheckCheck, Eye
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { grnAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';

/* ─── Status config ──────────────────────────────────────────── */
const STATUS = {
  pending:         { label: 'Pending',       color: 'bg-amber-100 text-amber-800 border-amber-200',    dot: 'bg-amber-500',   icon: Clock },
  verified_stores: { label: 'Stores OK',     color: 'bg-blue-100 text-blue-800 border-blue-200',       dot: 'bg-blue-500',    icon: ShieldCheck },
  approved:        { label: 'Approved',      color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
  rejected:        { label: 'Rejected',      color: 'bg-red-100 text-red-800 border-red-200',          dot: 'bg-red-500',     icon: XCircle },
  partial:         { label: 'Partial',       color: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500',  icon: AlertTriangle },
};

function StatusBadge({ status }) {
  const cfg = STATUS[status] || STATUS.pending;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.color)}>
      <Icon size={11} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

/* ─── Detail Panel ───────────────────────────────────────────── */
function GRNDetailPanel({ grn, onClose, onVerify, onApprove, loading }) {
  if (!grn) return null;
  const status = grn.quality_status || grn.status || 'pending';

  return (
    <div className="fixed inset-0 z-50 bg-[#f4f6f9] flex flex-col">
      {/* Workspace */}
      <div className="bg-white shadow-sm flex flex-col overflow-hidden h-full">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Stores / GRN Verification</div>
            <h2 className="text-lg font-black text-slate-900">{grn.grn_number}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{grn.project_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <button onClick={onClose} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6f9]">
          <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
            <div className="space-y-5">

          {/* Meta grid */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Receipt Details</p>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">GRN information</h3>
              </div>
              <StatusBadge status={status} />
            </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              ['Supplier',     grn.vendor_name || grn.supplier_name || '—'],
              ['GRN Date',     grn.grn_date ? dayjs(grn.grn_date).format('DD MMM YYYY') : '—'],
              ['Challan No.',  grn.challan_number || '—'],
              ['Vehicle',      grn.vehicle_number || '—'],
              ['Gate Pass',    grn.gate_pass_no || '—'],
              ['Site Location',grn.site_location || '—'],
            ].map(([lbl, val]) => (
              <div key={lbl} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">{lbl}</div>
                <div className="text-sm font-bold text-slate-900 truncate">{val}</div>
              </div>
            ))}
          </div>
          </div>

          {/* Items */}
          {grn.items && grn.items.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 bg-white border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <PackageCheck size={13} />
                Material Items ({grn.items.length})
              </div>
              <div className="overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Material</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</th>
                      <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grn.items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-black text-slate-900">{it.material_name}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-indigo-600">{it.quantity_received}</td>
                        <td className="px-4 py-3 text-slate-500">{it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Approval chain */}
            </div>
            <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3.5 bg-white border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={13} />
              Approval Chain
            </div>
            <div className="p-4 space-y-2">
              {[
                { step: 'Received',        done: true,                                  name: grn.received_by_name, time: null },
                { step: 'Stores Verified', done: status === 'verified_stores' || status === 'approved', name: grn.verified_stores_name, time: grn.verified_stores_at },
                { step: 'QC Approved',     done: status === 'approved',                 name: grn.approved_qc_name, time: grn.approved_qc_at },
              ].map((s, i) => (
                <div key={i} className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs',
                  s.done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-60'
                )}>
                  <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    s.done ? 'bg-emerald-500' : 'bg-slate-300'
                  )}>
                    {s.done ? <CheckCircle2 size={12} className="text-white" /> : <Clock size={12} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-700">{s.step}</span>
                    {s.name && <span className="text-slate-500 ml-2">by {s.name}</span>}
                    {s.time && <span className="text-slate-400 ml-2">· {dayjs(s.time).format('DD MMM, h:mm A')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          {grn.remarks && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Remarks</div>
              <div className="text-sm text-slate-700 bg-slate-50 rounded-xl px-3 py-2">{grn.remarks}</div>
            </div>
          )}
            </div>
          </div>
        </div>

        {/* Action footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex-shrink-0 space-y-2">
          {status === 'pending' && (
            <button
              onClick={onVerify}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition"
            >
              <ShieldCheck size={16} />
              {loading ? 'Processing…' : 'Mark as Stores Verified'}
            </button>
          )}
          {status === 'verified_stores' && (
            <button
              onClick={onApprove}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition"
            >
              <CheckCheck size={16} />
              {loading ? 'Posting to Inventory…' : 'Approve & Post to Stock Ledger'}
            </button>
          )}
          {status === 'approved' && (
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-semibold">
              <CheckCircle2 size={16} />
              Approved — Stock posted to ledger
            </div>
          )}
          <button onClick={onClose} className="w-full py-2 text-slate-500 text-sm font-medium hover:text-slate-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function GRNVerificationPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const { data: grnList = [], isLoading, refetch } = useQuery({
    queryKey: ['grn-list', projectFilter],
    queryFn: () => grnAPI.list(projectFilter ? { project_id: projectFilter } : {}).then(r => r.data.data),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const { data: detailData } = useQuery({
    queryKey: ['grn', selectedId],
    queryFn: () => grnAPI.get(selectedId).then(r => r.data.data),
    enabled: !!selectedId,
  });

  const verifyMutation = useMutation({
    mutationFn: (id) => grnAPI.approve(id, 'verify-stores'),
    onSuccess: () => {
      toast.success('GRN marked as stores verified');
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

  const filtered = grnList.filter(g => {
    const status = g.quality_status || g.status || 'pending';
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!g.grn_number?.toLowerCase().includes(q) &&
          !g.project_name?.toLowerCase().includes(q) &&
          !g.vendor_name?.toLowerCase().includes(q) &&
          !g.supplier_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const counts = {
    pending:         grnList.filter(g => (g.quality_status || g.status) === 'pending').length,
    verified_stores: grnList.filter(g => (g.quality_status || g.status) === 'verified_stores').length,
    approved:        grnList.filter(g => (g.quality_status || g.status) === 'approved').length,
  };

  const FILTERS = [
    { key: 'all',             label: 'All GRNs',     count: grnList.length },
    { key: 'pending',         label: 'Pending',      count: counts.pending },
    { key: 'verified_stores', label: 'Stores Verified', count: counts.verified_stores },
    { key: 'approved',        label: 'Approved',     count: counts.approved },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              GRN Verification
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Review and approve incoming goods receipts</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 transition"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          {[
            { label: 'Pending Review',    value: counts.pending,         color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { label: 'Awaiting QC',       value: counts.verified_stores, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: 'Approved & Posted', value: counts.approved,        color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          ].map(s => (
            <div key={s.label} className={clsx('flex items-center gap-2 border rounded-lg px-3 py-1.5 text-xs font-semibold', s.color)}>
              <span className="text-base font-black">{s.value}</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Filters row */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap flex-shrink-0">
        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                statusFilter === f.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              )}
            >
              {f.label}
              {f.count > 0 && (
                <span className={clsx('ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black',
                  statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                )}>{f.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="h-8 border border-slate-200 rounded-lg px-2 text-xs text-slate-700 bg-white focus:outline-none focus:border-blue-400"
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search GRN, supplier…"
            className="h-8 pl-7 pr-3 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:border-blue-400 w-52"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <ClipboardList size={36} className="text-slate-300 mb-3" />
            <p className="text-slate-500 font-semibold">No GRNs found</p>
            <p className="text-slate-400 text-sm mt-1">
              {statusFilter === 'pending' ? 'All GRNs are verified — nothing pending.' : 'Try adjusting filters.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">GRN Number</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Challan</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(g => {
                  const status = g.quality_status || g.status || 'pending';
                  return (
                    <tr
                      key={g.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedId(g.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-blue-700 text-xs">{g.grn_number}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {g.grn_date ? dayjs(g.grn_date).format('DD MMM YYYY') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-800 font-medium text-xs line-clamp-1 max-w-[140px]">{g.project_name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{g.vendor_name || g.supplier_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{g.challan_number || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedId(g.id); }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                        >
                          <Eye size={13} />
                          Review
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
              Showing {filtered.length} of {grnList.length} GRNs
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedId && detailData && (
        <GRNDetailPanel
          grn={detailData}
          onClose={() => setSelectedId(null)}
          onVerify={() => verifyMutation.mutate(selectedId)}
          onApprove={() => approveMutation.mutate(selectedId)}
          loading={verifyMutation.isPending || approveMutation.isPending}
        />
      )}
    </div>
  );
}
