// src/pages/stores/IssuePage.jsx
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight, Search, Plus, Clock, CheckCircle2,
  Printer, Box, ShieldCheck, MapPin, HardHat,
  FileText, Send, X
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { minAPI, projectAPI, mrsAPI, vendorAPI, inventoryAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import MINPrintTemplate from './MINPrintTemplate';

const inr = n => Number(n || 0).toLocaleString('en-IN');

export default function IssuePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedMIN, setSelectedMIN] = useState(null);
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => setSelectedMIN(null),
  });

  React.useEffect(() => {
    if (selectedMIN) handlePrint();
  }, [selectedMIN, handlePrint]);

  const { data: mins, isLoading } = useQuery({
    queryKey: ['min-list'],
    queryFn: () => minAPI.list().then(r => r.data.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const { data: contractors } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => vendorAPI.list().then(r => r.data.data),
  });

  const authorizeMutation = useMutation({
    mutationFn: (id) => minAPI.authorize(id),
    onSuccess: () => {
      toast.success('Stock deducted and material issued!');
      qc.invalidateQueries({ queryKey: ['min-list'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Authorization failed'),
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const allMINs = mins || [];
  const draftCount = allMINs.filter(m => m.status === 'draft').length;
  const issuedCount = allMINs.filter(m => m.status === 'issued').length;
  const totalValue = allMINs.reduce((s, m) => s + parseFloat(m.total_value || 0), 0);

  const minList = allMINs.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${m.min_number} ${m.project_name} ${m.activity_name || ''} ${m.issued_to || ''} ${m.contractor_name || ''}`.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white border border-slate-200 rounded-3xl px-6 py-6 shadow-sm">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Stores / Issues</div>
          <h1 className="mt-2 text-3xl font-black text-slate-900 tracking-tight">Material issue notes</h1>
          <p className="text-sm text-slate-500 mt-2">Control outward stock movement, finalize deductions, and keep issue acknowledgements traceable.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Material Issue
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500">Pending Issues</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{draftCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">Draft MINs</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-emerald-600">Finalized</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{issuedCount}</div>
          <div className="text-xs text-emerald-500 mt-0.5">Total Issued</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm md:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Consumption Value</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">₹{inr(totalValue)}</span>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-medium text-emerald-600">
              Audit Verified
            </span>
          </div>
        </div>
      </div>

      {/* Search & filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 mb-5 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search MIN number, project, activity…"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {[['all', 'All'], ['draft', 'Pending'], ['issued', 'Issued']].map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={clsx('px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                statusFilter === val
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300'
              )}
            >
              {lbl}
              {val !== 'all' && (
                <span className="ml-1 opacity-70">
                  {val === 'draft' ? draftCount : issuedCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 ml-auto hidden sm:block">{minList.length} of {allMINs.length}</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(n => <div key={n} className="h-16 bg-slate-200 animate-pulse rounded-xl" />)}</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Issue Register</p>
              <h2 className="text-sm font-black text-slate-900 mt-0.5">Material issue control list</h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">{minList.length} visible</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">{allMINs.length} total</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">MIN Document</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Work Activity</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Recipient</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {minList.map(min => (
                  <tr key={min.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-indigo-600 font-mono">{min.min_number}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{min.project_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-700 truncate max-w-[200px]">{min.activity_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <HardHat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div>
                          <div className="text-sm text-slate-700 truncate max-w-[180px]">{min.issued_to || 'Site Team'}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{min.contractor_name || 'Local / internal work'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={clsx('w-2 h-2 rounded-full', min.status === 'issued' ? 'bg-emerald-500' : 'bg-amber-500')} />
                        <span className={clsx('text-xs font-medium', min.status === 'issued' ? 'text-emerald-600' : 'text-amber-600')}>
                          {min.status === 'issued' ? 'Issued' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 ml-4">
                        {dayjs(min.issue_date).format('D MMM, HH:mm')}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {min.status === 'draft' && (
                        <button
                          onClick={() => authorizeMutation.mutate(min.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-all"
                        >
                          Finalize & Deduct
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedMIN(min)}
                        className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {minList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                        <Box className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-700">
                        {search || statusFilter !== 'all' ? 'No results match your filters' : 'No material issue notes yet'}
                      </p>
                      {(search || statusFilter !== 'all') && (
                        <button
                          onClick={() => { setSearch(''); setStatusFilter('all'); }}
                          className="mt-2 text-xs text-indigo-500 underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
            {minList.length} issue note{minList.length !== 1 ? 's' : ''} total
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <MINForm
          onClose={() => setShowForm(false)}
          projects={projects}
          contractors={contractors}
          qc={qc}
        />
      )}

      {/* Hidden print area */}
      <div className="hidden">
        <div ref={printRef}>
          {selectedMIN && <MINPrintTemplate min={selectedMIN} />}
        </div>
      </div>
    </div>
  );
}

// ── MINForm ───────────────────────────────────────────────────────────────────

function MINForm({ onClose, projects, contractors, qc }) {
  const [formData, setFormData] = useState({
    project_id: '', activity_name: '', contractor_id: '',
    issued_to: '', issue_date: dayjs().format('YYYY-MM-DD'), remarks: '',
  });
  const [items, setItems] = useState([]);
  const [inventorySearch, setInventorySearch] = useState('');

  const { data: inventory } = useQuery({
    queryKey: ['inventory-lookup', formData.project_id],
    queryFn: () => inventoryAPI.list({ project_id: formData.project_id }).then(r => r.data.data),
    enabled: !!formData.project_id,
  });

  const createMutation = useMutation({
    mutationFn: (d) => minAPI.create(d),
    onSuccess: () => {
      toast.success('Material issue note created as draft!');
      qc.invalidateQueries({ queryKey: ['min-list'] });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Issue failed'),
  });

  const addItem = (inv) => {
    if (items.some(it => it.inventory_id === inv.id)) return;
    setItems([...items, {
      inventory_id: inv.id,
      material_name: inv.material_name,
      unit: inv.unit,
      quantity_issued: '',
      rate: inv.rate || 0,
      purpose: formData.activity_name,
    }]);
  };

  const filteredInventory = (inventory || []).filter(i =>
    i.material_name.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-[#f4f6f9] z-[100]">
      <div className="bg-white w-full h-full overflow-hidden flex flex-col shadow-sm">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Send className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">New Material Issue Note</h2>
              <p className="text-xs text-slate-400 mt-0.5">Store outward — creates draft pending authorization</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6f9]">
          <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Project">
                <select
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                  value={formData.project_id}
                  onChange={e => setFormData(p => ({ ...p, project_id: e.target.value }))}
                >
                  <option value="">Select site store…</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Work Activity">
                <input
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                  placeholder="e.g. Columns Casting Ground Floor"
                  value={formData.activity_name}
                  onChange={e => setFormData(p => ({ ...p, activity_name: e.target.value }))}
                />
              </Field>
            </div>
            <div className="space-y-4">
              <Field label="Subcontractor / Agency (Optional)">
                <select
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                  value={formData.contractor_id}
                  onChange={e => setFormData(p => ({ ...p, contractor_id: e.target.value }))}
                >
                  <option value="">None - local / internal work</option>
                  {contractors?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Issued To / Receiver">
                  <input
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                    placeholder="Foreman, engineer, staff name"
                    value={formData.issued_to}
                    onChange={e => setFormData(p => ({ ...p, issued_to: e.target.value }))}
                  />
                </Field>
                <Field label="Issue Date">
                  <input
                    type="date"
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                    value={formData.issue_date}
                    onChange={e => setFormData(p => ({ ...p, issue_date: e.target.value }))}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Material selector */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-500" /> Inventory Items
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-72 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
                  placeholder="Search stock in project store…"
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                />
                {inventorySearch && (
                  <div className="absolute top-full right-0 mt-2 w-full bg-white border border-slate-200 rounded-xl max-h-60 overflow-y-auto z-[110] shadow-xl">
                    {filteredInventory.map(i => (
                      <button
                        key={i.id}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors"
                        onClick={() => { addItem(i); setInventorySearch(''); }}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{i.material_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Available: <span className="text-indigo-600 font-medium">{i.closing_stock ?? '—'} {i.unit || ''}</span></p>
                        </div>
                        <Plus className="w-4 h-4 text-indigo-500" />
                      </button>
                    ))}
                    {filteredInventory.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">No matching items found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-12 gap-4 items-center hover:border-indigo-200 transition-colors">
                  <div className="col-span-4">
                    <p className="text-sm font-semibold text-slate-800">{it.material_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Unit: {it.unit}</p>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-slate-400 block mb-1">Quantity to Issue</label>
                    <input
                      type="number"
                      className="w-full h-8 bg-white border border-slate-200 rounded-lg px-3 text-sm text-indigo-600 font-mono outline-none focus:border-indigo-400 text-center"
                      placeholder="Qty"
                      value={it.quantity_issued}
                      onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, quantity_issued: e.target.value } : x))}
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="text-xs text-slate-400 block mb-1">Purpose</label>
                    <input
                      className="w-full h-8 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
                      placeholder="Activity details…"
                      value={it.purpose}
                      onChange={e => setItems(p => p.map((x, i) => i === idx ? { ...x, purpose: e.target.value } : x))}
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <Box className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-400">No items added yet</p>
                  <p className="text-xs text-slate-300 mt-1">Search and add stock materials above</p>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            Stage 01 — Draft, pending authorization
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate({ ...formData, items })}
              disabled={createMutation.isPending || !items.length}
              className="px-6 h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-40 shadow-sm"
            >
              {createMutation.isPending ? 'Saving…' : 'Save Draft MIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
