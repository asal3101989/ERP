// src/pages/subcontractor/SubcontractorHubPage.jsx
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Briefcase, Ruler, Receipt, LayoutDashboard,
  Plus, Search, ChevronDown, CheckCircle, XCircle,
  Clock, AlertTriangle, TrendingUp, IndianRupee,
  Users, FileText, ArrowUpRight, X, RefreshCw,
  Eye, Edit2, Check, Ban, Building2, Calendar,
  Download, Printer,
} from 'lucide-react';
import { subcontractorAPI, vendorAPI, projectAPI } from '../../api/client';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtPct = (v, t) => (t > 0 ? ((v / t) * 100).toFixed(1) + '%' : '—');

const STATUS_COLORS = {
  draft:    'bg-slate-100 text-slate-600',
  active:   'bg-emerald-100 text-emerald-700',
  closed:   'bg-blue-100 text-blue-700',
  disputed: 'bg-red-100 text-red-700',
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-emerald-100 text-emerald-700',
  paid:      'bg-blue-100 text-blue-700',
  submitted: 'bg-violet-100 text-violet-700',
};

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status?.toLowerCase()] || 'bg-slate-100 text-slate-600';
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-bold capitalize', cls)}>
      {status || '—'}
    </span>
  );
}

function ProgressBar({ value, total, colorClass = 'bg-emerald-500' }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className={clsx('h-1.5 rounded-full', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color = 'text-slate-700', bg = 'bg-white' }) {
  return (
    <div className={clsx('rounded-2xl border border-slate-100 p-5 flex flex-col gap-2', bg)}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
          <Icon className={clsx('w-4 h-4', color)} />
        </div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className={clsx('text-2xl font-black', color)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh]', width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── TAB 1: Dashboard ─────────────────────────────────────────────────────────
function DashboardTab({ projectId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sub-dashboard', projectId],
    queryFn: () => subcontractorAPI.getDashboard({ project_id: projectId || undefined }).then(r => r.data),
    retry: 1,
  });

  const kpi = data?.kpi || {};
  const vendors = data?.byVendor || [];

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
      <span className="text-sm text-slate-400">Loading dashboard…</span>
    </div>
  );

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <AlertTriangle className="w-8 h-8 text-amber-400" />
      <span className="text-sm font-semibold text-slate-600">Could not load dashboard</span>
      <span className="text-xs text-slate-400">Ensure the backend server is running and restart it to pick up new routes.</span>
    </div>
  );

  const totalContract = kpi.total_contract_value || 0;
  const totalBilled   = kpi.total_billed || 0;
  const totalPaid     = kpi.total_paid || 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={Briefcase}     label="Work Orders"     value={kpi.total_wo ?? '—'}         color="text-blue-600" />
        <KpiCard icon={CheckCircle}   label="Active WOs"      value={kpi.active_wo ?? '—'}        color="text-emerald-600" />
        <KpiCard icon={IndianRupee}   label="Contract Value"  value={fmt(totalContract)}           color="text-slate-700" />
        <KpiCard icon={Receipt}       label="Total Billed"    value={fmt(totalBilled)}
          sub={fmtPct(totalBilled, totalContract) + ' of contract'}                               color="text-violet-600" />
        <KpiCard icon={TrendingUp}    label="Total Paid"      value={fmt(totalPaid)}
          sub={fmtPct(totalPaid, totalBilled) + ' of billed'}                                     color="text-emerald-600" />
        <KpiCard icon={Clock}         label="Bills Pending"   value={kpi.bills_pending_approval ?? '—'}
          color={kpi.bills_pending_approval > 0 ? 'text-amber-600' : 'text-slate-400'} />
      </div>

      {/* Collection progress */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Overall Progress</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Billed vs Contract</span>
              <span>{fmt(totalBilled)} / {fmt(totalContract)}</span>
            </div>
            <ProgressBar value={totalBilled} total={totalContract} colorClass="bg-violet-500" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Paid vs Billed</span>
              <span>{fmt(totalPaid)} / {fmt(totalBilled)}</span>
            </div>
            <ProgressBar value={totalPaid} total={totalBilled} colorClass="bg-emerald-500" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Outstanding Balance</span>
              <span className="font-semibold text-red-500">{fmt(totalBilled - totalPaid)}</span>
            </div>
            <ProgressBar value={totalBilled - totalPaid} total={totalBilled} colorClass="bg-red-400" />
          </div>
        </div>
      </div>

      {/* Per-vendor table */}
      {vendors.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">By Subcontractor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Subcontractor</th>
                  <th className="px-4 py-3 text-right">Work Orders</th>
                  <th className="px-4 py-3 text-right">Contract Value</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vendors.map((v) => (
                  <tr key={v.vendor_name} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{v.vendor_name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{v.wo_count}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(v.contract_value)}</td>
                    <td className="px-4 py-3 text-right text-violet-600 font-semibold">{fmt(v.billed_amount)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{fmt(v.paid_amount)}</td>
                    <td className="px-4 py-3 text-right text-red-500 font-semibold">{fmt(v.billed_amount - v.paid_amount)}</td>
                    <td className="px-4 py-3 w-32">
                      <ProgressBar value={v.paid_amount} total={v.billed_amount} colorClass="bg-emerald-500" />
                      <span className="text-[10px] text-slate-400">{fmtPct(v.paid_amount, v.billed_amount)} paid</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 2: Work Orders ───────────────────────────────────────────────────────
function WorkOrdersTab({ projectId, projects, vendors }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [form, setForm] = useState({ vendor_id: '', project_id: '', subject: '', contract_value: '', start_date: '', end_date: '', scope_of_work: '', terms_conditions: '' });
  const [err, setErr] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['sub-wo', projectId, statusFilter],
    queryFn: () => subcontractorAPI.listWorkOrders({
      project_id: projectId || undefined,
      status: statusFilter || undefined,
    }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d) => subcontractorAPI.createWorkOrder(d),
    onSuccess: () => { qc.invalidateQueries(['sub-wo']); qc.invalidateQueries(['sub-dashboard']); setShowCreate(false); setForm({ vendor_id: '', project_id: '', subject: '', contract_value: '', start_date: '', end_date: '', scope_of_work: '', terms_conditions: '' }); },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, ...d }) => subcontractorAPI.updateWorkOrder(id, d),
    onSuccess: () => { qc.invalidateQueries(['sub-wo']); qc.invalidateQueries(['sub-dashboard']); setShowDetail(null); },
  });

  const rows = useMemo(() => {
    const list = data?.data || data?.work_orders || (Array.isArray(data) ? data : []);
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(r => r.vendor_name?.toLowerCase().includes(q) || r.wo_number?.toLowerCase().includes(q) || r.subject?.toLowerCase().includes(q) || r.project_name?.toLowerCase().includes(q));
  }, [data, search]);

  function validateCreate() {
    const e = {};
    if (!form.vendor_id) e.vendor_id = 'Required';
    if (!form.project_id) e.project_id = 'Required';
    if (!form.subject) e.subject = 'Required';
    if (!form.contract_value || isNaN(form.contract_value)) e.contract_value = 'Enter valid amount';
    setErr(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work orders…" className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="disputed">Disputed</option>
        </select>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> New Work Order
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No work orders found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">WO No.</th>
                  <th className="px-4 py-3 text-left">Subcontractor</th>
                  <th className="px-4 py-3 text-left">Project</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-right">Contract Value</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{wo.wo_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{wo.vendor_name}</td>
                    <td className="px-4 py-3 text-slate-600">{wo.project_name}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{wo.subject}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(wo.contract_value)}</td>
                    <td className="px-4 py-3 text-right text-violet-600 font-semibold">{fmt(wo.total_billed)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={wo.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setShowDetail(wo)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="View / Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Work Order" width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Subcontractor *" error={err.vendor_id}>
            <select value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))} className={inputCls}>
              <option value="">Select vendor…</option>
              {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </FormField>
          <FormField label="Project *" error={err.project_id}>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className={inputCls}>
              <option value="">Select project…</option>
              {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label="Subject / Description *" error={err.subject}>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inputCls} placeholder="e.g. Civil works – Phase 1" />
          </FormField>
          <FormField label="Contract Value (₹) *" error={err.contract_value}>
            <input type="number" value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} className={inputCls} placeholder="0" />
          </FormField>
          <FormField label="Start Date">
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} />
          </FormField>
          <FormField label="End Date">
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inputCls} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Scope of Work">
              <textarea rows={3} value={form.scope_of_work} onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))} className={inputCls} placeholder="Describe the scope…" />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Terms & Conditions">
              <textarea rows={2} value={form.terms_conditions} onChange={e => setForm(f => ({ ...f, terms_conditions: e.target.value }))} className={inputCls} placeholder="Payment terms, retention, etc." />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button
            disabled={createMut.isPending}
            onClick={() => { if (validateCreate()) createMut.mutate({ ...form, contract_value: parseFloat(form.contract_value) }); }}
            className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-60"
          >
            {createMut.isPending ? 'Creating…' : 'Create Work Order'}
          </button>
        </div>
      </Modal>

      {/* Detail / Edit Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`WO — ${showDetail?.wo_number}`} width="max-w-xl">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Vendor:</span><p className="font-semibold">{showDetail.vendor_name}</p></div>
              <div><span className="text-slate-500">Project:</span><p className="font-semibold">{showDetail.project_name}</p></div>
              <div><span className="text-slate-500">Contract Value:</span><p className="font-semibold text-blue-700">{fmt(showDetail.contract_value)}</p></div>
              <div><span className="text-slate-500">Billed So Far:</span><p className="font-semibold text-violet-700">{fmt(showDetail.total_billed)}</p></div>
            </div>
            <FormField label="Status">
              <select defaultValue={showDetail.status} id="wo-status-sel" className={inputCls}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="disputed">Disputed</option>
              </select>
            </FormField>
            <FormField label="Terms & Conditions">
              <textarea id="wo-terms-inp" rows={3} defaultValue={showDetail.terms_conditions} className={inputCls} />
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button
                disabled={patchMut.isPending}
                onClick={() => {
                  const status = document.getElementById('wo-status-sel').value;
                  const terms = document.getElementById('wo-terms-inp').value;
                  patchMut.mutate({ id: showDetail.id, status, terms_conditions: terms });
                }}
                className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-60"
              >
                {patchMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TAB 3: Measurement Book ──────────────────────────────────────────────────
function MeasurementsTab({ projectId, projects, vendors }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ work_order_id: '', item_description: '', unit: '', measured_qty: '', rate: '', measurement_date: '', remarks: '' });
  const [err, setErr] = useState({});
  const [woFilter, setWoFilter] = useState('');

  const { data: woData } = useQuery({
    queryKey: ['sub-wo-list', projectId],
    queryFn: () => subcontractorAPI.listWorkOrders({ project_id: projectId || undefined }).then(r => r.data),
  });
  const workOrders = woData?.data || woData?.work_orders || (Array.isArray(woData) ? woData : []);

  const { data, isLoading } = useQuery({
    queryKey: ['sub-mb', projectId, woFilter],
    queryFn: () => subcontractorAPI.getMeasurements({
      project_id: projectId || undefined,
      wo_id: woFilter || undefined,
    }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d) => subcontractorAPI.recordMeasurement(d),
    onSuccess: () => { qc.invalidateQueries(['sub-mb']); setShowCreate(false); setForm({ work_order_id: '', item_description: '', unit: '', measured_qty: '', rate: '', measurement_date: '', remarks: '' }); },
  });

  const rows = useMemo(() => {
    const list = data?.data || data?.measurements || (Array.isArray(data) ? data : []);
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(r => r.item_description?.toLowerCase().includes(q) || r.vendor_name?.toLowerCase().includes(q) || r.wo_number?.toLowerCase().includes(q));
  }, [data, search]);

  function validateCreate() {
    const e = {};
    if (!form.work_order_id) e.work_order_id = 'Required';
    if (!form.item_description) e.item_description = 'Required';
    if (!form.measured_qty || isNaN(form.measured_qty)) e.measured_qty = 'Enter valid qty';
    setErr(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search measurements…" className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={woFilter} onChange={e => setWoFilter(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Work Orders</option>
          {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.wo_number} — {wo.vendor_name}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Record Measurement
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No measurements recorded</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">WO No.</th>
                  <th className="px-4 py-3 text-left">Subcontractor</th>
                  <th className="px-4 py-3 text-left">Item Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-right">Rate (₹)</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{m.wo_number}</td>
                    <td className="px-4 py-3 text-slate-700">{m.vendor_name}</td>
                    <td className="px-4 py-3 text-slate-800 max-w-xs truncate">{m.item_description}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(m.measured_qty).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500">{m.unit || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{m.rate ? fmt(m.rate) : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{m.amount ? fmt(m.amount) : (m.rate && m.measured_qty ? fmt(parseFloat(m.rate) * parseFloat(m.measured_qty)) : '—')}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{m.measurement_date ? new Date(m.measurement_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={m.approval_status || m.status || 'pending'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Record Measurement" width="max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Work Order *" error={err.work_order_id}>
              <select value={form.work_order_id} onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))} className={inputCls}>
                <option value="">Select Work Order…</option>
                {workOrders.filter(wo => ['active', 'draft'].includes(wo.status)).map(wo => (
                  <option key={wo.id} value={wo.id}>{wo.wo_number} — {wo.vendor_name} ({wo.project_name})</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Item Description *" error={err.item_description}>
              <input value={form.item_description} onChange={e => setForm(f => ({ ...f, item_description: e.target.value }))} className={inputCls} placeholder="e.g. PCC 1:4:8 – Foundation" />
            </FormField>
          </div>
          <FormField label="Quantity *" error={err.measured_qty}>
            <input type="number" value={form.measured_qty} onChange={e => setForm(f => ({ ...f, measured_qty: e.target.value }))} className={inputCls} placeholder="0" />
          </FormField>
          <FormField label="Unit">
            <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className={inputCls}>
              <option value="">Select…</option>
              {['Sqm', 'Sqft', 'Cum', 'Cft', 'Rmt', 'Rft', 'Nos', 'MT', 'Kg', 'Liter', 'LS'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </FormField>
          <FormField label="Rate per Unit (₹)">
            <input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} className={inputCls} placeholder="0" />
          </FormField>
          <FormField label="Measurement Date">
            <input type="date" value={form.measurement_date} onChange={e => setForm(f => ({ ...f, measurement_date: e.target.value }))} className={inputCls} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Remarks">
              <textarea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inputCls} placeholder="Optional notes…" />
            </FormField>
          </div>
        </div>
        {form.measured_qty && form.rate && (
          <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm text-blue-700 font-semibold">
            Calculated Amount: {fmt(parseFloat(form.measured_qty || 0) * parseFloat(form.rate || 0))}
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button
            disabled={createMut.isPending}
            onClick={() => { if (validateCreate()) createMut.mutate({ ...form, measured_qty: parseFloat(form.measured_qty), rate: form.rate ? parseFloat(form.rate) : undefined }); }}
            className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-60"
          >
            {createMut.isPending ? 'Saving…' : 'Record Measurement'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── TAB 4: RA Bills ──────────────────────────────────────────────────────────
function BillsTab({ projectId, vendors }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [form, setForm] = useState({ work_order_id: '', bill_number: '', bill_date: '', bill_amount: '', tax_amount: '', retention_percent: '', due_date: '' });
  const [err, setErr] = useState({});

  const { data: woData } = useQuery({
    queryKey: ['sub-wo-list', projectId],
    queryFn: () => subcontractorAPI.listWorkOrders({ project_id: projectId || undefined }).then(r => r.data),
  });
  const workOrders = woData?.data || woData?.work_orders || (Array.isArray(woData) ? woData : []);

  const { data, isLoading } = useQuery({
    queryKey: ['sub-bills', projectId, statusFilter],
    queryFn: () => subcontractorAPI.listBills({
      project_id: projectId || undefined,
      status: statusFilter || undefined,
    }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d) => subcontractorAPI.createBill(d),
    onSuccess: () => { qc.invalidateQueries(['sub-bills']); qc.invalidateQueries(['sub-dashboard']); setShowCreate(false); setForm({ work_order_id: '', bill_number: '', bill_date: '', bill_amount: '', tax_amount: '', retention_percent: '', due_date: '' }); },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, ...d }) => subcontractorAPI.updateBill(id, d),
    onSuccess: () => { qc.invalidateQueries(['sub-bills']); qc.invalidateQueries(['sub-dashboard']); setShowDetail(null); },
  });

  const bills = data?.data || data?.bills || (Array.isArray(data) ? data : []);

  function validateCreate() {
    const e = {};
    if (!form.work_order_id) e.work_order_id = 'Required';
    if (!form.bill_amount || isNaN(form.bill_amount)) e.bill_amount = 'Enter valid amount';
    setErr(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Raise RA Bill
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : bills.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No bills found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Bill No.</th>
                  <th className="px-4 py-3 text-left">WO No.</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-right">Bill Amt</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3 text-left">Bill Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bills.map((b) => {
                  const amt = parseFloat(b.bill_amount || b.gross_amount || 0);
                  const tax = parseFloat(b.tax_amount || 0);
                  // Use server-computed net_payable when available
                  const net = parseFloat(b.net_payable) || (amt + tax - amt * (parseFloat(b.retention_percent || 0) / 100));
                  const isOverdue = b.status !== 'paid' && b.due_date && new Date(b.due_date) < new Date();
                  return (
                    <tr key={b.id} className={clsx('hover:bg-slate-50', isOverdue && 'bg-red-50/30')}>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{b.bill_number || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.wo_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{b.vendor_name || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-800 font-semibold">{fmt(amt)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmt(tax)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(net)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{b.bill_date ? new Date(b.bill_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={isOverdue ? 'text-red-500 font-semibold' : 'text-slate-500'}>
                          {b.due_date ? new Date(b.due_date).toLocaleDateString('en-IN') : '—'}
                        </span>
                        {isOverdue && <span className="ml-1 text-[10px] font-bold text-red-500">OVERDUE</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setShowDetail(b)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Update">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Bill Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Raise RA Bill" width="max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Work Order *" error={err.work_order_id}>
              <select value={form.work_order_id} onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))} className={inputCls}>
                <option value="">Select Work Order…</option>
                {workOrders.filter(wo => ['active', 'draft'].includes(wo.status)).map(wo => (
                  <option key={wo.id} value={wo.id}>{wo.wo_number} — {wo.vendor_name}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Bill Number">
            <input value={form.bill_number} onChange={e => setForm(f => ({ ...f, bill_number: e.target.value }))} className={inputCls} placeholder="e.g. RA-001" />
          </FormField>
          <FormField label="Bill Date">
            <input type="date" value={form.bill_date} onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))} className={inputCls} />
          </FormField>
          <FormField label="Bill Amount (₹) *" error={err.bill_amount}>
            <input type="number" value={form.bill_amount} onChange={e => setForm(f => ({ ...f, bill_amount: e.target.value }))} className={inputCls} placeholder="0" />
          </FormField>
          <FormField label="Tax Amount (₹)">
            <input type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} className={inputCls} placeholder="0" />
          </FormField>
          <FormField label="Retention (%)">
            <input type="number" value={form.retention_percent} onChange={e => setForm(f => ({ ...f, retention_percent: e.target.value }))} className={inputCls} placeholder="0" min="0" max="100" />
          </FormField>
          <FormField label="Due Date">
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} />
          </FormField>
        </div>
        {form.bill_amount && (
          <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm space-y-1">
            <div className="flex justify-between text-slate-600"><span>Bill Amount</span><span>{fmt(parseFloat(form.bill_amount || 0))}</span></div>
            <div className="flex justify-between text-slate-600"><span>Tax</span><span>+ {fmt(parseFloat(form.tax_amount || 0))}</span></div>
            <div className="flex justify-between text-red-500"><span>Retention ({form.retention_percent || 0}%)</span><span>- {fmt(parseFloat(form.bill_amount || 0) * (parseFloat(form.retention_percent || 0) / 100))}</span></div>
            <div className="flex justify-between font-bold text-blue-700 border-t border-blue-100 pt-1"><span>Net Payable</span><span>{fmt(parseFloat(form.bill_amount || 0) + parseFloat(form.tax_amount || 0) - (parseFloat(form.bill_amount || 0) * parseFloat(form.retention_percent || 0) / 100))}</span></div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button
            disabled={createMut.isPending}
            onClick={() => { if (validateCreate()) createMut.mutate({ ...form, bill_amount: parseFloat(form.bill_amount), tax_amount: parseFloat(form.tax_amount || 0), retention_percent: parseFloat(form.retention_percent || 0) }); }}
            className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-60"
          >
            {createMut.isPending ? 'Raising…' : 'Raise Bill'}
          </button>
        </div>
      </Modal>

      {/* Update Bill Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Update Bill — ${showDetail?.bill_number || 'Draft'}`} width="max-w-md">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-slate-50 rounded-xl">
              <div><span className="text-slate-500">WO:</span><p className="font-semibold">{showDetail.wo_number}</p></div>
              <div><span className="text-slate-500">Vendor:</span><p className="font-semibold">{showDetail.vendor_name}</p></div>
              <div><span className="text-slate-500">Bill Amt:</span><p className="font-semibold text-blue-700">{fmt(showDetail.bill_amount || showDetail.gross_amount)}</p></div>
              <div><span className="text-slate-500">Tax:</span><p className="font-semibold">{fmt(showDetail.tax_amount || 0)}</p></div>
            </div>
            <FormField label="Status">
              <select defaultValue={showDetail.status} id="bill-status-sel" className={inputCls}>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </FormField>
            <FormField label="Payment Date">
              <input type="date" id="bill-pay-date" defaultValue={showDetail.payment_date?.split('T')[0] || ''} className={inputCls} />
            </FormField>
            <FormField label="Payment Reference">
              <input id="bill-pay-ref" defaultValue={showDetail.payment_ref || ''} className={inputCls} placeholder="NEFT/RTGS reference…" />
            </FormField>
            <FormField label="Payment Mode">
              <select id="bill-pay-mode" defaultValue={showDetail.payment_mode || ''} className={inputCls}>
                <option value="">Select…</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button
                disabled={patchMut.isPending}
                onClick={() => {
                  patchMut.mutate({
                    id: showDetail.id,
                    status: document.getElementById('bill-status-sel').value,
                    payment_date: document.getElementById('bill-pay-date').value || null,
                    payment_ref: document.getElementById('bill-pay-ref').value || null,
                    payment_mode: document.getElementById('bill-pay-mode').value || null,
                  });
                }}
                className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-60"
              >
                {patchMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
  { id: 'work-orders',  label: 'Work Orders',        icon: Briefcase },
  { id: 'measurements', label: 'Measurement Book',   icon: Ruler },
  { id: 'bills',        label: 'RA Bills',           icon: Receipt },
];

export default function SubcontractorHubPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projectFilter, setProjectFilter] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d?.projects ?? d?.data ?? []);
    }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-sub'],
    queryFn: () => vendorAPI.list({ type: 'subcontractor' }).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d?.vendors ?? d?.data ?? []);
    }),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              Subcontractors
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Work orders, measurements &amp; billing</p>
          </div>
          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-40"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'dashboard'    && <DashboardTab    projectId={projectFilter} />}
        {activeTab === 'work-orders'  && <WorkOrdersTab   projectId={projectFilter} projects={projects} vendors={vendors} />}
        {activeTab === 'measurements' && <MeasurementsTab projectId={projectFilter} projects={projects} vendors={vendors} />}
        {activeTab === 'bills'        && <BillsTab        projectId={projectFilter} vendors={vendors} />}
      </div>
    </div>
  );
}
