// src/pages/finance/GSTPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DollarSign, Plus, X, FileText, TrendingUp, Landmark, Calculator } from 'lucide-react';
import api, { invoiceAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const inr = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GST_RATES = {
  residential_affordable: { rate: 1, label: 'Affordable Housing (CLSS) — 1%' },
  residential_other:      { rate: 5, label: 'Residential (Under Construction) — 5%' },
  commercial:             { rate: 12, label: 'Commercial Construction — 12%' },
  govt_works:             { rate: 12, label: 'Works Contract (Govt) — 12%' },
  other_works:            { rate: 18, label: 'Works Contract (Other) — 18%' },
  materials_cement:       { rate: 28, label: 'Cement (GST 28%)' },
  materials_steel:        { rate: 18, label: 'Steel / TMT — 18%' },
};

function GSTCalculator({ onClose }) {
  const [taxable, setTaxable] = useState(1000000);
  const [gstType, setGstType] = useState('cgst_sgst');
  const [rate, setRate] = useState(18);

  const cgst = gstType === 'cgst_sgst' ? (taxable * rate / 2) / 100 : 0;
  const sgst = gstType === 'cgst_sgst' ? (taxable * rate / 2) / 100 : 0;
  const igst = gstType === 'igst' ? (taxable * rate) / 100 : 0;
  const totalGST = cgst + sgst + igst;
  const total = taxable + totalGST;
  const tds = (taxable * 2) / 100;
  const netAfterTDS = total - tds;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-[3.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
        <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-indigo-600"><Calculator size={20} /></div>
             GST Calculator
          </h2>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Taxable Amount (₹)</label>
            <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all" value={taxable} onChange={e => setTaxable(parseFloat(e.target.value)||0)} />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">GST Type</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic" value={gstType} onChange={e => setGstType(e.target.value)}>
                <option value="cgst_sgst">Intra-state (CGST + SGST)</option>
                <option value="igst">Inter-state (IGST)</option>
                <option value="exempt">Exempt</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">GST Rate (%)</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic" value={rate} onChange={e => setRate(parseInt(e.target.value))}>
                <option value={1}>1% — Affordable</option>
                <option value={5}>5% — Residential</option>
                <option value={12}>12% — Govt/Com</option>
                <option value={18}>18% — General</option>
                <option value={28}>28% — Cement</option>
              </select>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-6 space-y-3 font-mono text-sm shadow-inner">
            <div className="flex justify-between text-slate-500 font-bold"><span>Taxable Amount</span><span className="text-slate-900">{inr(taxable)}</span></div>
            {gstType === 'cgst_sgst' && <>
              <div className="flex justify-between text-blue-500 font-bold"><span>CGST @ {rate/2}%</span><span>+ {inr(cgst)}</span></div>
              <div className="flex justify-between text-emerald-500 font-bold"><span>SGST @ {rate/2}%</span><span>+ {inr(sgst)}</span></div>
            </>}
            {gstType === 'igst' && <div className="flex justify-between text-purple-500 font-bold"><span>IGST @ {rate}%</span><span>+ {inr(igst)}</span></div>}
            <div className="flex justify-between text-slate-900 font-black border-t border-slate-200 pt-3 text-lg italic tracking-tighter"><span>Invoice Total</span><span>{inr(total)}</span></div>
            <div className="flex justify-between text-red-500 text-xs font-bold pt-1"><span>Less: TDS u/s 194C (2%)</span><span>− {inr(tds)}</span></div>
            <div className="flex justify-between text-indigo-600 font-black border-t border-slate-200 pt-3 text-2xl italic tracking-tighter"><span>Net Receivable</span><span>{inr(netAfterTDS)}</span></div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-[10px] text-indigo-600 font-bold uppercase tracking-widest italic text-center">
            HSN: 9954 (Construction Services) • Valid for 30 days
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GSTPage() {
  const [showCalc, setShowCalc] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('invoices');
  const qc = useQueryClient();
  const { register, handleSubmit, watch, reset } = useForm({ defaultValues: { gst_type: 'cgst_sgst', gst_rate: 18 } });

  const { data } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceAPI.list().then(r => r.data.data).catch(() => []),
  });

  const { data: gstSummary } = useQuery({
    queryKey: ['gst-summary'],
    queryFn: () => invoiceAPI.gstSummary({ year: new Date().getFullYear() }).then(r => r.data).catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (d) => invoiceAPI.create({ ...d, taxable_amount: parseFloat(d.taxable_amount) }),
    onSuccess: () => { toast.success('Invoice created!'); reset(); setShowForm(false); qc.invalidateQueries(['invoices']); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      toast.success('Invoice deleted');
      qc.invalidateQueries(['invoices']);
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const invoices = data || [];
  const totalCollected = invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
  const totalGST = invoices.reduce((s, i) => s + parseFloat(i.cgst_amount || 0) + parseFloat(i.sgst_amount || 0) + parseFloat(i.igst_amount || 0), 0);
  const totalPending = invoices.filter(i => i.payment_status === 'unpaid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
             <Landmark className="w-6 h-6 text-indigo-600" />
           </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">GST & Static Taxation</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">CGST / SGST / IGST — Works Contract (HSN 9954)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-5 py-3 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-sm flex items-center gap-2 italic" onClick={() => setShowCalc(true)}><Calculator className="w-4 h-4" /> Calculator</button>
          <button className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2 italic" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Issue Tax Invoice</button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
           <div className="text-3xl font-black text-emerald-600 font-mono tracking-tighter italic">₹{(totalCollected / 1e5).toFixed(1)}L</div>
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Total Collected</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
           <div className="text-3xl font-black text-indigo-600 font-mono tracking-tighter italic">₹{(totalGST / 1e5).toFixed(1)}L</div>
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">GST Collected</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
           <div className="text-3xl font-black text-amber-500 font-mono tracking-tighter italic">₹{(totalPending / 1e5).toFixed(1)}L</div>
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Pending Collection</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 text-center shadow-md">
           <div className="text-3xl font-black text-red-400 font-mono tracking-tighter italic">₹1.40L</div>
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Net GST Payable</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl w-fit border border-slate-200 shadow-sm">
        {['invoices', 'gst_rates', 'itc'].map(t => (
          <button key={t} onClick={() => setTab(t)}
             className={clsx('px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all italic',
              tab === t ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            )}>{t.replace('_', ' ')}</button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div className="space-y-6">
          <DataToolbar 
            data={invoices} 
            fileName="GST_Invoices_Export" 
            onAdd={() => setShowForm(true)} 
            addLabel="Create Invoice"
          />
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   {['Invoice No.', 'Date', 'Client / GSTIN', 'Taxable', 'GST Details', 'Total', 'TDS', 'Type', 'Status', ''].map((h, i) => (
                      <th key={i} className={clsx("py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic", h === 'Taxable' || h === 'Total' || h === 'TDS' ? 'text-right' : '')}>{h}</th>
                   ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-5 px-6">
                       <div className="font-mono text-indigo-600 font-black text-sm tracking-tight italic">{inv.invoice_number}</div>
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{inv.project_name}</div>
                    </td>
                    <td className="py-5 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{dayjs(inv.invoice_date).format('D MMM YYYY')}</td>
                    <td className="py-5 px-6">
                      <div className="text-xs font-black text-slate-900 uppercase italic">{inv.client_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-bold mt-1 uppercase tracking-widest">GSTIN: {inv.client_gstin}</div>
                    </td>
                    <td className="py-5 px-6 text-right font-mono font-bold text-slate-500">{inr(inv.taxable_amount)}</td>
                    <td className="py-5 px-6">
                      {inv.gst_type === 'cgst_sgst' ? (
                        <div className="text-[10px] font-mono font-bold uppercase space-y-1 tracking-widest">
                          <div><span className="text-blue-500">CGST:</span> <span className="text-slate-600">{inr(inv.cgst_amount)}</span></div>
                          <div><span className="text-emerald-500">SGST:</span> <span className="text-slate-600">{inr(inv.sgst_amount)}</span></div>
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest"><span className="text-purple-500">IGST:</span> <span className="text-slate-600">{inr(inv.igst_amount)}</span></div>
                      )}
                    </td>
                    <td className="py-5 px-6 text-right font-mono font-black text-slate-900 text-base italic tracking-tighter">{inr(inv.total_amount)}</td>
                    <td className="py-5 px-6 text-right font-mono text-red-500 text-xs font-bold">{inr(inv.tds_amount)}</td>
                    <td className="py-5 px-6 whitespace-nowrap">
                       <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest italic shadow-sm", inv.gst_type === 'igst' ? 'bg-purple-50 text-purple-600 border border-purple-200' : 'bg-blue-50 text-blue-600 border border-blue-200')}>{inv.gst_type === 'igst' ? 'Inter-state' : 'Intra-state'}</span>
                    </td>
                    <td className="py-5 px-6 whitespace-nowrap">
                       <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest italic shadow-sm", inv.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200')}>{inv.payment_status}</span>
                    </td>
                    <td className="py-5 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <TableActions disableEdit onDelete={() => deleteMut.mutate(inv.id)} />
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-24 text-center">
                       <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl mx-auto flex items-center justify-center mb-6"><FileText className="w-10 h-10 text-slate-300" /></div>
                       <div className="text-slate-400 font-black uppercase tracking-[0.3em] italic">No GST Invoices issued yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'gst_rates' && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic border-b border-slate-100 pb-4 mb-6">GST Rate Applicability — Construction</div>
          <div className="space-y-4">
            {Object.entries(GST_RATES).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-sm transition-all group">
                <span className="text-sm font-bold text-slate-600 uppercase tracking-tight italic">{val.label}</span>
                <span className={clsx('font-black text-2xl font-mono tracking-tighter italic', val.rate <= 5 ? 'text-emerald-500' : val.rate <= 12 ? 'text-blue-500' : val.rate <= 18 ? 'text-indigo-500' : 'text-purple-600')}>{val.rate}%</span>
              </div>
            ))}
          </div>
          <div className="mt-8 p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] text-xs font-bold text-indigo-700 space-y-3 leading-relaxed tracking-wide shadow-sm">
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-indigo-400" /> <strong className="text-indigo-900 border-b border-indigo-200 pb-0.5">GSTR-1</strong>: Due 11th of following month (outward supplies)</div>
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-indigo-400" /> <strong className="text-indigo-900 border-b border-indigo-200 pb-0.5">GSTR-3B</strong>: Due 20th of following month (net tax payment)</div>
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-indigo-400" /> <strong className="text-indigo-900 border-b border-indigo-200 pb-0.5">ITC</strong> can be claimed on eligible purchases (materials, services)</div>
            <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-indigo-400" /> <strong className="text-indigo-900 border-b border-indigo-200 pb-0.5">Reverse Charge</strong> applies on GTA services if unregistered</div>
          </div>
        </div>
      )}

      {tab === 'itc' && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic border-b border-slate-100 pb-4 mb-6">Input Tax Credit (ITC) Summary — FY 2024-25</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 shadow-inner">
              <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-6 italic">Output Tax (GST Collected)</div>
              <div className="space-y-4 font-mono text-sm font-bold">
                <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-slate-500 tracking-widest">CGST Collected</span><span className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">₹1,33,425</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-slate-500 tracking-widest">SGST Collected</span><span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">₹1,33,425</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-slate-500 tracking-widest">IGST Collected</span><span className="text-purple-600 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">₹4,03,200</span></div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-4 font-black text-slate-900 text-lg tracking-tighter italic"><span className="text-[11px] uppercase tracking-widest text-slate-900">Total Output</span><span>₹6,70,050</span></div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 shadow-inner">
              <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-6 italic">Input Tax Credit Available</div>
              <div className="space-y-4 font-mono text-sm font-bold">
                <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-slate-500 tracking-widest">ITC on Cement (28%)</span><span className="text-emerald-600">₹2,12,800</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-slate-500 tracking-widest">ITC on Steel (18%)</span><span className="text-emerald-600">₹98,600</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] uppercase text-slate-500 tracking-widest">ITC on Services</span><span className="text-emerald-600">₹42,000</span></div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-4 font-black text-emerald-600 text-lg tracking-tighter italic"><span className="text-[11px] uppercase tracking-widest text-emerald-600">Total ITC</span><span>₹3,53,400</span></div>
              </div>
            </div>
          </div>
          <div className="mt-8 p-8 bg-amber-50 border border-amber-200 rounded-[2.5rem] font-mono shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <span className="text-sm font-black text-amber-700 uppercase tracking-widest italic">Net GST Payable (Output − ITC)</span>
              <span className="text-4xl text-amber-600 font-black tracking-tighter italic bg-white px-5 py-2 rounded-2xl shadow-sm border border-amber-100">₹3,16,650</span>
            </div>
            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-4 text-center border-t border-amber-200 pt-3">Due by 20th of next month via GSTR-3B</div>
          </div>
        </div>
      )}

      {showCalc && <GSTCalculator onClose={() => setShowCalc(false)} />}

      {/* Create Invoice Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[3.5rem] w-full max-w-2xl shadow-2xl my-4 overflow-hidden animate-in zoom-in duration-300">
            <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-indigo-600"><FileText size={20} /></div>
                 Create GST Invoice
              </h2>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(createMutation.mutate)} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Invoice Number *</label>
                   <input {...register('invoice_number', {required:true})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all uppercase" placeholder="INV/2425/090" />
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Invoice Date *</label>
                   <input {...register('invoice_date', {required:true})} type="date" defaultValue={dayjs().format('YYYY-MM-DD')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Client Name *</label>
                 <input {...register('client_name', {required:true})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all italic" placeholder="M/S ABC Limited" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Client GSTIN</label>
                    <input {...register('client_gstin')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="27AABCS1234C1Z5" maxLength={15} />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">HSN Code</label>
                    <input {...register('hsn_code')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-indigo-400 shadow-sm transition-all text-center" defaultValue="9954" />
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Taxable Amount (₹) *</label>
                 <input {...register('taxable_amount', {required:true})} type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="1000000" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">GST Type *</label>
                  <select {...register('gst_type')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic">
                    <option value="cgst_sgst">Intra-state (CGST+SGST)</option>
                    <option value="igst">Inter-state (IGST)</option>
                    <option value="exempt">Exempt</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">GST Rate (%) *</label>
                  <select {...register('gst_rate')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic">
                    <option value={1}>1% — Affordable</option>
                    <option value={5}>5% — Residential</option>
                    <option value={12}>12% — Commercial</option>
                    <option value={18}>18% — Works Contract</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button type="button" className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-sm italic" onClick={() => setShowForm(false)}>Discard</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30 italic">{createMutation.isPending ? 'Generating...' : 'Issue Final Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
