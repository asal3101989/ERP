// src/pages/stores/GRNPrintPage.jsx
import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import {
  Printer, Search, ChevronRight, RefreshCw, FileText,
  Calendar, Building2, Truck, CheckCircle2, Clock,
  AlertTriangle, XCircle, Eye
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { grnAPI, projectAPI } from '../../api/client';
import GRNPrintTemplate from './GRNPrintTemplate';

const STATUS = {
  pending:         { label: 'Pending',      color: 'bg-amber-100 text-amber-800 border-amber-200',    icon: Clock },
  verified_stores: { label: 'Stores OK',    color: 'bg-blue-100 text-blue-800 border-blue-200',       icon: CheckCircle2 },
  approved:        { label: 'Approved',     color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  rejected:        { label: 'Rejected',     color: 'bg-red-100 text-red-800 border-red-200',          icon: XCircle },
  partial:         { label: 'Partial',      color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
};

function StatusBadge({ status }) {
  const cfg = STATUS[status] || STATUS.pending;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', cfg.color)}>
      <Icon size={10} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

export default function GRNPrintPage() {
  const printRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const { data: grnList = [], isLoading, refetch } = useQuery({
    queryKey: ['grn-list', projectFilter],
    queryFn: () => grnAPI.list(projectFilter ? { project_id: projectFilter } : {}).then(r => r.data.data),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const { data: selectedGRN, isLoading: loadingDetail } = useQuery({
    queryKey: ['grn', selectedId],
    queryFn: () => grnAPI.get(selectedId).then(r => r.data.data),
    enabled: !!selectedId,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const filtered = grnList.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.grn_number?.toLowerCase().includes(q) ||
      g.project_name?.toLowerCase().includes(q) ||
      g.vendor_name?.toLowerCase().includes(q) ||
      g.supplier_name?.toLowerCase().includes(q) ||
      g.challan_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full flex bg-slate-50 overflow-hidden">

      {/* ── LEFT PANEL: GRN List ─────────────────────────────── */}
      <div className="w-96 border-r border-slate-200 bg-white flex flex-col flex-shrink-0">

        {/* List header */}
        <div className="px-4 py-4 border-b border-slate-200">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Printer size={16} className="text-slate-600" />
            GRN Print
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Select a GRN to preview and print</p>

          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search GRN, supplier, challan…"
                className="w-full h-8 pl-7 pr-3 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="flex-1 h-8 border border-slate-200 rounded-lg px-2 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={() => refetch()} className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* GRN list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <FileText size={24} className="mb-2 opacity-40" />
              <p className="text-sm">No GRNs found</p>
            </div>
          ) : (
            filtered.map(g => {
              const status = g.quality_status || g.status || 'pending';
              const isSelected = selectedId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedId(g.id)}
                  className={clsx(
                    'w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 flex items-start gap-3',
                    isSelected && 'bg-blue-50 border-l-2 border-l-blue-500'
                  )}
                >
                  <div className={clsx('mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    isSelected ? 'bg-blue-500' : 'bg-slate-100'
                  )}>
                    <FileText size={14} className={isSelected ? 'text-white' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-blue-700 truncate">{g.grn_number}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-0.5 truncate">{g.project_name}</div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Calendar size={10} />
                        {g.grn_date ? dayjs(g.grn_date).format('DD MMM YYYY') : '—'}
                      </span>
                      {(g.vendor_name || g.supplier_name) && (
                        <span className="flex items-center gap-0.5 truncate">
                          <Truck size={10} />
                          {g.vendor_name || g.supplier_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400">
          {filtered.length} GRN{filtered.length !== 1 ? 's' : ''} listed
        </div>
      </div>

      {/* ── RIGHT PANEL: Preview + Print ─────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-slate-400">
            <Eye size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-bold text-slate-500">Select a GRN to preview</p>
            <p className="text-sm mt-1">Choose any GRN from the list on the left to preview the print layout</p>
          </div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading GRN…
          </div>
        ) : (
          <>
            {/* Print toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
              <div className="flex-1">
                <span className="font-mono font-black text-sm text-slate-900">{selectedGRN?.grn_number}</span>
                <span className="text-slate-400 mx-2">·</span>
                <span className="text-sm text-slate-600">{selectedGRN?.project_name}</span>
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-5 py-2 rounded-xl transition shadow-sm"
              >
                <Printer size={15} />
                Print GRN
              </button>
            </div>

            {/* Print preview scroll area */}
            <div className="flex-1 overflow-auto bg-slate-300 p-6 flex justify-center">
              <div className="shadow-2xl">
                <GRNPrintTemplate ref={printRef} data={selectedGRN} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
