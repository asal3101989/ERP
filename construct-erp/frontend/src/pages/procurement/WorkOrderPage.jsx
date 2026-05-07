// src/pages/procurement/WorkOrderPage.jsx
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import {
  Briefcase, Plus, X, Search, FileText,
  Printer, Download, ShieldCheck,
  UserPlus, Building2, Calculator,
  TrendingUp, Clock, CheckCircle2,
  Hammer, FileUp, Check,
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { subcontractorAPI, vendorAPI, projectAPI, default as api } from '../../api/client';
import toast from 'react-hot-toast';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const UNITS = ['SQFT', 'SQM', 'RMT', 'Nos', 'MT', 'Point', 'Month', 'LS', 'Day'];

const inr = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

export default function WorkOrderPage() {
  const { user } = useAuthStore();
  const [showForm, setShowForm]     = useState(false);
  const [selectedWO, setSelectedWO] = useState(null);
  const [search, setSearch]         = useState('');
  const [pdfParsing, setPdfParsing] = useState(false);
  const pdfInputRef = useRef(null);

  // WO Items State
  const [items, setItems] = useState([{ description: '', quantity: '', unit: 'SQFT', rate: '', remarks: '' }]);
  const [formData, setFormData] = useState({
    project_id: '',
    vendor_id: '',
    wo_number: `WO-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random()*1000)}`,
    wo_date: dayjs().format('YYYY-MM-DD'),
    subject: '',
    terms_conditions: '1. Retention of 5% will be deducted from each bill.\n2. Security Deposit of 5% applicable.\n3. Safety protocols must be strictly followed.\n4. Work must be completed as per technical specifications.'
  });

  const handlePDFUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.type !== 'application/pdf') return toast.error('Please select a PDF file');
    setPdfParsing(true);
    const toastId = toast.loading('Reading Work Order PDF…');
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('pdf', file);
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/subcontractors/work-orders/parse-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Parse failed');
      if (!json.data?.items?.length) throw new Error('No line items found in PDF');
      const p = json.data;
      // Pre-fill form
      setFormData(prev => ({
        ...prev,
        wo_number: p.woNumber || prev.wo_number,
        wo_date:   p.woDate   || prev.wo_date,
        subject:   p.narration || '',
        terms_conditions: prev.terms_conditions,
        _vendorNameHint:  p.vendorName  || '',
        _projectNameHint: p.projectRaw  || '',
        _referenceNo:     p.referenceNo || '',
      }));
      setItems(p.items);
      toast.success(`Extracted ${p.items.length} items from PDF`, { id: toastId });
      setShowForm(true);
    } catch (err) {
      toast.error(err.message || 'Could not read PDF', { id: toastId });
    } finally {
      setPdfParsing(false);
    }
  };

  const qc = useQueryClient();

  // Queries
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

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (d) => subcontractorAPI.createWorkOrder(d),
    onSuccess: () => {
      toast.success('Work Order finalized and issued!');
      setShowForm(false);
      setItems([{ description: '', quantity: '', unit: 'SQFT', rate: '', remarks: '' }]);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to issue Work Order'),
  });

  // Delete Mutation
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/work-orders/${id}`),
    onSuccess: () => {
      toast.success('Work Order deleted');
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: () => toast.error('Failed to delete Work Order'),
  });

  const filtered = (woData ?? []).filter(wo => 
    wo.wo_number.toLowerCase().includes(search.toLowerCase()) ||
    wo.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
    wo.project_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formTotal = items.reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0)), 0);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Header section with strategic aesthetics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Work Order Registry</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5 flex-wrap">
               <ShieldCheck size={14} className="text-indigo-500" /> Subcontractor Labor Contracting Portal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePDFUpload} />
          <button onClick={() => pdfInputRef.current?.click()} disabled={pdfParsing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60">
            <FileUp className="w-4 h-4" /> {pdfParsing ? 'Reading…' : 'Import PDF'}
          </button>
          <DataToolbar
            data={filtered}
            fileName="Work_Order_Register_Export"
            onAdd={() => { setItems([{ description: '', quantity: '', unit: 'Day', rate: '', remarks: '' }]); setShowForm(true); }}
            addLabel="Draft New Work Order"
          />
        </div>
      </div>

      {/* KPI Ribbons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 italic">Total Contract Value</p>
               <p className="text-2xl font-black text-slate-900 font-mono italic">₹{(woData?.reduce((s,w) => s + parseFloat(w.total_value), 0) / 10000000).toFixed(2)} Cr</p>
            </div>
            <TrendingUp size={32} className="text-slate-100 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform" />
         </div>
         <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 italic">Active Labor Contracts</p>
               <p className="text-2xl font-black text-slate-900 font-mono italic">{woData?.length || 0}</p>
            </div>
            <Clock size={32} className="text-slate-100 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform" />
         </div>
         <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 italic">Pending Measurements</p>
               <p className="text-2xl font-black text-slate-900 font-mono italic">₹1.24 Cr</p>
            </div>
            <Calculator size={32} className="text-slate-100 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform" />
         </div>
         <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
               <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-2 italic">Portfolio Health</p>
               <p className="text-2xl font-black text-emerald-600 font-mono italic">96.4%</p>
            </div>
            <ShieldCheck size={32} className="text-emerald-100 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform" />
         </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-4 flex items-center shadow-sm relative">
        <Search className="absolute left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search contracts by sub-con, WO#, or project target..." 
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-5 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 placeholder:normal-case placeholder:tracking-normal italic"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* WO Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Contract Ident</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Sub-Contractor</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Target Project</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right italic">Contract Value</th>
                <th className="px-6 py-5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(wo => (
                <tr key={wo.id} className="hover:bg-slate-50/50 transition-all cursor-pointer group" onClick={() => setSelectedWO(wo)}>
                  <td className="px-6 py-5">
                    <p className="text-sm font-black text-indigo-600 font-mono tracking-tighter uppercase italic">{wo.wo_number}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{dayjs(wo.wo_date).format('DD MMM YYYY')}</p>
                  </td>
                  <td className="px-6 py-5">
                     <p className="text-xs font-black text-slate-900 uppercase tracking-tight italic leading-none mb-1.5">{wo.vendor_name}</p>
                     <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Specialist Vendor</p>
                  </td>
                  <td className="px-6 py-5 text-slate-500 font-black uppercase text-[10px] tracking-widest italic">
                    {wo.project_name}
                  </td>
                  <td className="px-6 py-5">
                    <span className={clsx(
                      'px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm italic',
                      wo.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                    )}>
                      {wo.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-base font-black text-slate-900 font-mono tracking-tighter italic">{inr(wo.total_value)}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sum Itemized</p>
                  </td>
                  <td className="px-6 py-5 text-right w-16" onClick={e => e.stopPropagation()}>
                    <TableActions disableEdit onDelete={() => deleteMut.mutate(wo.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-24 text-center">
              <Briefcase size={48} className="text-indigo-100 mx-auto mb-4" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] italic">No Work Orders currently archived</p>
            </div>
          )}
        </div>
      </div>

      {/* Add WO Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-[3.5rem] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
             <div className="p-8 border-b border-slate-100 shrink-0 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Draft Specialist Work Order</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Phase 7: Labor & Contracting Protocol</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                  <X size={20} />
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
                {/* PDF Import banner */}
                {formData._vendorNameHint && (
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800">
                    <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Imported from PDF</span>
                      {' — '}WO Ref: <strong>{formData.wo_number}</strong>
                      {' · '}Contractor: <strong>{formData._vendorNameHint}</strong>
                      {' · '}Project: <strong>{formData._projectNameHint}</strong>
                      {formData._referenceNo ? <> · Ref: <strong>{formData._referenceNo}</strong></> : null}
                      <p className="mt-1 text-emerald-700">Select the matching Vendor and Project from the dropdowns below, then submit.</p>
                    </div>
                  </div>
                )}
                {/* Header Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
                   <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 italic">
                         <Building2 size={14} className="text-indigo-500" /> Target Construction Project
                      </label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-900 uppercase outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic"
                        value={formData.project_id}
                        onChange={e => setFormData(p => ({ ...p, project_id: e.target.value }))}
                      >
                         <option value="">Select Project Target</option>
                         {projectsData?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 italic">
                         <UserPlus size={14} className="text-indigo-500" /> Specialist Sub-Contractor
                      </label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-900 uppercase outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic"
                        value={formData.vendor_id}
                        onChange={e => setFormData(p => ({ ...p, vendor_id: e.target.value }))}
                      >
                         <option value="">Select Specialist Vendor</option>
                         {vendorsData?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">WO Subject / Scope Summary</label>
                      <input 
                        type="text" 
                        placeholder="E.G., EXTERNAL GLASS FACADE INSTALLATION - BLOCK B"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-900 uppercase outline-none focus:border-indigo-400 transition-all shadow-sm italic"
                        value={formData.subject}
                        onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))}
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-3">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">WO Number</label>
                         <input 
                           type="text" 
                           className="w-full bg-slate-100 border border-slate-200 rounded-2xl p-4 text-xs font-black text-indigo-600 font-mono italic outline-none shadow-inner"
                           value={formData.wo_number}
                           readOnly
                         />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Contract Date</label>
                         <input 
                           type="date" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-900 outline-none focus:border-indigo-400 transition-all shadow-sm italic"
                           value={formData.wo_date}
                           onChange={e => setFormData(p => ({ ...p, wo_date: e.target.value }))}
                         />
                      </div>
                   </div>
                </div>

                {/* Line Items Builder */}
                <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm space-y-6">
                   <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 italic">
                         <Hammer size={16} className="text-indigo-500" /> Precise Technical Scope Items
                      </h3>
                      <button 
                        onClick={() => setItems(p => [...p, { description: '', quantity: '', unit: 'SQFT', rate: '', remarks: '' }])}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm italic"
                      >
                         + Insert Specification
                      </button>
                   </div>
                   
                   <div className="space-y-4">
                      {items.map((it, i) => (
                        <div key={i} className="grid grid-cols-12 gap-4 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:border-indigo-300 transition-all group relative">
                           <div className="col-span-4 space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Trade Description</label>
                              <input 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-slate-900 uppercase outline-none focus:border-indigo-400 shadow-sm italic"
                                placeholder="Details..." 
                                value={it.description}
                                onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                              />
                           </div>
                           <div className="col-span-2 space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Contract Qty</label>
                              <input 
                                type="number"
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-center text-xs font-black text-slate-900 font-mono outline-none focus:border-indigo-400 shadow-sm"
                                value={it.quantity}
                                onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))}
                              />
                           </div>
                           <div className="col-span-2 space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Unit</label>
                              <select 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm appearance-none italic"
                                value={it.unit}
                                onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))}
                              >
                                 {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                           </div>
                           <div className="col-span-3 space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Unit Rate (₹)</label>
                              <input 
                                type="number"
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-right text-xs font-black text-indigo-600 font-mono outline-none focus:border-indigo-400 shadow-sm"
                                value={it.rate}
                                onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, rate: e.target.value } : x))}
                              />
                           </div>
                           <div className="col-span-1 flex items-end justify-center pb-1.5">
                              <button 
                                onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-red-500 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                              >
                                <X size={16} />
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Terms and Financial Overlay */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
                   <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 italic">
                         <FileText size={14} className="text-slate-400" /> Master Terms & Conditions
                      </label>
                      <textarea 
                        className="w-full h-44 bg-slate-50 border border-slate-100 rounded-[2rem] p-6 text-[10px] font-bold text-slate-700 leading-relaxed outline-none focus:border-indigo-300 shadow-inner resize-none tracking-widest"
                        value={formData.terms_conditions}
                        onChange={e => setFormData(p => ({ ...p, terms_conditions: e.target.value }))}
                      />
                   </div>
                   <div className="lg:col-span-4 self-start">
                      <div className="bg-indigo-600 rounded-[2.5rem] p-8 space-y-6 shadow-2xl shadow-indigo-600/30 relative overflow-hidden">
                         <Briefcase className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500/30 rotate-12" />
                         <div className="relative z-10 space-y-5">
                            <div className="flex justify-between items-center text-white/80">
                               <span className="text-[9px] font-black uppercase tracking-widest italic">Document Value</span>
                            </div>
                            <div className="space-y-1">
                               <p className="text-3xl font-black text-white font-mono tracking-tighter leading-none italic uppercase">{inr(formTotal)}</p>
                               <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Institutional Aggregate Contract Sum</p>
                            </div>
                            <div className="pt-5 border-t border-indigo-500 space-y-3">
                               <div className="flex justify-between text-[10px] text-indigo-200 font-bold uppercase tracking-widest">
                                  <span>Security Retention</span>
                                  <span className="font-mono text-white">₹{(formTotal * 0.05).toLocaleString('en-IN')}</span>
                                </div>
                               <div className="flex justify-between text-[10px] text-indigo-200 font-bold uppercase tracking-widest">
                                  <span>TDS Est.</span>
                                  <span className="font-mono text-white">₹{(formTotal * 0.02).toLocaleString('en-IN')}</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex gap-4">
                <button 
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 font-black uppercase text-[11px] tracking-[0.2em] rounded-[2rem] hover:text-slate-900 transition-all shadow-sm italic hover:bg-slate-50 hover:border-slate-300"
                >
                  Discard Draft
                </button>
                <button 
                  onClick={() => createMutation.mutate({ ...formData, items })}
                  disabled={createMutation.isPending || !formData.project_id || !formData.vendor_id || items.length === 0}
                  className="flex-[2] py-5 bg-indigo-600 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-[2rem] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30 italic disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Finalizing Core Contract...' : 'Authorize and Finalize Work Order'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* WO Detail Sidebar / Modal */}
      {selectedWO && (
         <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-white border-l border-slate-200 h-full p-10 overflow-y-auto space-y-10 shadow-2xl animate-in slide-in-from-right duration-500">
               <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">{selectedWO.wo_number}</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{selectedWO.subject}</p>
                  </div>
                  <button onClick={() => setSelectedWO(null)} className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                    <X size={20} />
                  </button>
               </div>

               <div className="grid grid-cols-2 gap-8">
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-[2rem] shadow-sm">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 italic">Authorized Sub-Contractor</label>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{selectedWO.vendor_name}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-[2rem] shadow-sm">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 italic">Linked Project Entity</label>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{selectedWO.project_name}</p>
                  </div>
               </div>

               <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-0"></div>
                  <div className="flex justify-between items-center relative z-10">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Core Contract Progress</span>
                     <span className="text-[11px] font-black text-indigo-700 italic tracking-tighter uppercase whitespace-nowrap px-4 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-sm">₹0.00 Billed to Date</span>
                  </div>
                  
                  <div className="space-y-3 relative z-10">
                     <div className="flex justify-between text-xs font-black text-slate-900 uppercase tracking-widest italic">
                        <span>Physical Completion</span>
                        <span className="text-indigo-600">0%</span>
                     </div>
                     <div className="h-1.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 w-0" />
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Official Work Specifications</h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-8 space-y-5 shadow-inner">
                     <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic mb-2">Sub-Contractor Obligations</p>
                     <p className="text-[11px] text-slate-600 font-bold whitespace-pre-line leading-relaxed italic overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-slate-200 pr-4">
                        {selectedWO.terms_conditions}
                     </p>
                  </div>
               </div>

               <div className="flex gap-4 pt-10 border-t border-slate-100">
                  <button className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl hover:text-slate-900 hover:border-slate-300 transition-all flex items-center justify-center gap-2 italic shadow-sm">
                     <Printer size={16} /> Official Audit Print
                  </button>
                  <button className="flex-1 py-5 bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 italic flex items-center justify-center gap-2">
                     Modify Contract
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
