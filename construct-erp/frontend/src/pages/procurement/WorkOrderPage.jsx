// src/pages/procurement/WorkOrderPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import {
  Hammer, Plus, X, Search, FileText,
  Printer, Building2, Clock, CheckCircle2,
  ChevronRight, UserPlus, Calculator,
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { subcontractorAPI, vendorAPI, projectAPI, default as api } from '../../api/client';
import toast from 'react-hot-toast';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const UNITS = ['SQFT', 'SQM', 'RMT', 'Nos', 'MT', 'Point', 'Month', 'LS', 'Day'];

const inr = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CONFIG = {
  draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  pending:  { label: 'Pending',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-600 border-red-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all placeholder:text-slate-400';

export default function WorkOrderPage() {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedWO, setSelectedWO] = useState(null);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: '', unit: 'SQFT', rate: '', remarks: '' }]);
  const [formData, setFormData] = useState({
    project_id: '',
    vendor_id: '',
    wo_number: `WO-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`,
    wo_date: dayjs().format('YYYY-MM-DD'),
    subject: '',
    terms_conditions: '1. Retention of 5% will be deducted from each bill.\n2. Security Deposit of 5% applicable.\n3. Safety protocols must be strictly followed.\n4. Work must be completed as per technical specifications.',
  });

  const qc = useQueryClient();

  const { data: woData, isLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: () => subcontractorAPI.listWorkOrders().then(r => r.data.data),
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorAPI.list().then(r => r.data.data),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: d => subcontractorAPI.createWorkOrder(d),
    onSuccess: () => {
      toast.success('Work Order issued successfully');
      setShowForm(false);
      setItems([{ description: '', quantity: '', unit: 'SQFT', rate: '', remarks: '' }]);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: e => toast.error(e?.response?.data?.error || 'Failed to issue Work Order'),
  });

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/work-orders/${id}`),
    onSuccess: () => {
      toast.success('Work Order deleted');
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: () => toast.error('Failed to delete Work Order'),
  });

  const allWOs = woData ?? [];
  const filtered = allWOs.filter(wo =>
    `${wo.wo_number} ${wo.vendor_name || ''} ${wo.project_name || ''} ${wo.subject || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = allWOs.reduce((s, w) => s + parseFloat(w.total_value || 0), 0);
  const pendingCount = allWOs.filter(w => w.status === 'pending').length;
  const formTotal = items.reduce((s, it) => s + parseFloat(it.quantity || 0) * parseFloat(it.rate || 0), 0);

  const resetForm = () => {
    setShowForm(false);
    setItems([{ description: '', quantity: '', unit: 'SQFT', rate: '', remarks: '' }]);
    setFormData(p => ({ ...p, project_id: '', vendor_id: '', subject: '' }));
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Hammer className="w-3.5 h-3.5" /> Procurement
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-sm text-slate-400 mt-0.5">Subcontractor & labour work order management</p>
        </div>
        <div className="flex items-center gap-3">
          <DataToolbar data={filtered} fileName="Work_Order_Register" onAdd={() => setShowForm(true)} addLabel="New Work Order" />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total WOs',      value: allWOs.length,                                     color: 'text-slate-900',   icon: FileText,      bg: 'bg-white border-slate-200' },
          { label: 'Total Value',    value: `₹${inr(totalValue)}`,                             color: 'text-indigo-700',  icon: Calculator,    bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Pending Appvl', value: pendingCount,                                       color: 'text-amber-700',   icon: Clock,         bg: 'bg-amber-50 border-amber-100' },
          { label: 'Approved',       value: allWOs.filter(w => w.status === 'approved').length, color: 'text-emerald-700', icon: CheckCircle2,  bg: 'bg-emerald-50 border-emerald-100' },
        ].map(({ label, value, color, icon: Icon, bg }) => (
          <div key={label} className={clsx('border rounded-xl p-4 shadow-sm', bg)}>
            <Icon className={clsx('w-4 h-4 mb-2', color)} />
            <div className={clsx('text-xl font-bold font-mono', color)}>{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex items-center gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by WO number, vendor, project…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
          />
        </div>
        <span className="text-xs text-slate-400 shrink-0">{filtered.length} of {allWOs.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['WO Number', 'Subject', 'Vendor / Sub-Con', 'Project', 'Date', 'Status', 'Value', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-5 bg-slate-100 animate-pulse rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.map(wo => (
                <tr key={wo.id} onClick={() => setSelectedWO(wo)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <Hammer className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <span className="text-xs font-bold font-mono text-indigo-700 group-hover:underline">{wo.wo_number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-xs text-slate-700 truncate">{wo.subject || '—'}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <UserPlus className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 max-w-[130px] truncate">{wo.vendor_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-600 max-w-[130px] truncate">{wo.project_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {wo.wo_date ? dayjs(wo.wo_date).format('DD MMM YYYY') : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={wo.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold font-mono text-slate-800">
                    ₹{inr(wo.total_value)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      <TableActions disableEdit onDelete={() => deleteMut.mutate(wo.id)} recordName={wo.wo_number} />
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Hammer className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">
                      {search ? 'No work orders match your search' : 'No work orders yet'}
                    </p>
                    {search && (
                      <button onClick={() => setSearch('')} className="mt-2 text-xs text-indigo-500 underline">
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          {allWOs.length} work order{allWOs.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* Create WO Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">New Work Order</p>
                  <p className="text-xs text-slate-400 mt-0.5">Issue a work order to a subcontractor or vendor</p>
                </div>
              </div>
              <button onClick={resetForm}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Header fields */}
              <div className="border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Work Order Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Project *">
                    <select className={inputCls} value={formData.project_id}
                      onChange={e => setFormData(p => ({ ...p, project_id: e.target.value }))}>
                      <option value="">Select project…</option>
                      {projectsData?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Vendor / Subcontractor *">
                    <select className={inputCls} value={formData.vendor_id}
                      onChange={e => setFormData(p => ({ ...p, vendor_id: e.target.value }))}>
                      <option value="">Select vendor…</option>
                      {vendorsData?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </Field>
                  <Field label="WO Date">
                    <input type="date" className={inputCls} value={formData.wo_date}
                      onChange={e => setFormData(p => ({ ...p, wo_date: e.target.value }))} />
                  </Field>
                  <Field label="WO Number">
                    <input className={`${inputCls} bg-slate-100 text-indigo-700 font-mono`} value={formData.wo_number} readOnly />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Subject / Scope">
                      <input className={inputCls} placeholder="e.g. External plaster work – Block B" value={formData.subject}
                        onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scope Items</h3>
                  <button
                    onClick={() => setItems(p => [...p, { description: '', quantity: '', unit: 'SQFT', rate: '', remarks: '' }])}
                    className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                </div>
                <div className="grid gap-1.5 mb-2" style={{ gridTemplateColumns: '3fr 90px 80px 120px 36px' }}>
                  {['Description', 'Qty', 'Unit', 'Rate (₹)', ''].map(h => (
                    <div key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">{h}</div>
                  ))}
                </div>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '3fr 90px 80px 120px 36px' }}>
                      <input
                        className={inputCls}
                        placeholder="Description of work"
                        value={it.description}
                        onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                      />
                      <input
                        type="number" min="0"
                        className={inputCls}
                        placeholder="0"
                        value={it.quantity}
                        onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))}
                      />
                      <select
                        className={inputCls}
                        value={it.unit}
                        onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input
                        type="number" min="0"
                        className={inputCls}
                        placeholder="0.00"
                        value={it.rate}
                        onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, rate: e.target.value } : x))}
                      />
                      <button
                        onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                        disabled={items.length === 1}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all disabled:opacity-30"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Security Deposit (5%): <span className="font-mono text-slate-600">₹{inr(formTotal * 0.05)}</span>
                    <span className="mx-3">·</span>
                    TDS Est. (2%): <span className="font-mono text-slate-600">₹{inr(formTotal * 0.02)}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    Total: <span className="font-mono text-indigo-700">₹{inr(formTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Terms & Conditions</h3>
                <textarea
                  rows={5}
                  className={inputCls}
                  value={formData.terms_conditions}
                  onChange={e => setFormData(p => ({ ...p, terms_conditions: e.target.value }))}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
              <button onClick={resetForm}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 transition-all">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({ ...formData, items })}
                disabled={createMutation.isPending || !formData.project_id || !formData.vendor_id}
                className="flex-[2] py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-60">
                {createMutation.isPending ? 'Issuing…' : 'Issue Work Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WO Detail Side Panel */}
      {selectedWO && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedWO(null)} />
          <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">

            <div className="bg-slate-900 px-6 py-4 flex items-start justify-between shrink-0">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Work Order</div>
                <h2 className="text-xl font-black text-white font-mono">{selectedWO.wo_number}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{selectedWO.subject || '—'}</p>
              </div>
              <button onClick={() => setSelectedWO(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f4f6f9]">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Vendor', selectedWO.vendor_name],
                  ['Project', selectedWO.project_name],
                  ['WO Date', selectedWO.wo_date ? dayjs(selectedWO.wo_date).format('DD MMM YYYY') : '—'],
                  ['Status', selectedWO.status],
                  ['Total Value', `₹${inr(selectedWO.total_value)}`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {selectedWO.terms_conditions && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Terms & Conditions</p>
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{selectedWO.terms_conditions}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0 flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 transition-all">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={() => setSelectedWO(null)}
                className="flex-1 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
