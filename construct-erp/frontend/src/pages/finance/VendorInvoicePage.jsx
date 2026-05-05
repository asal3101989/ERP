// src/pages/finance/VendorInvoicePage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, Plus, Search, Filter, 
  CheckCircle2, Clock, ShieldCheck, 
  ArrowUpRight, ExternalLink, Printer,
  AlertCircle, DollarSign, Tag, Building2
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { invoiceAPI, projectAPI, tqsBillsAPI, default as api } from '../../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const STATUS_CONFIG = {
  pending:    { label: 'Booked / Pending', class: 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm', icon: Clock },
  verified:   { label: 'Audit Verified',   class: 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm',     icon: ShieldCheck },
  authorized: { label: 'Accounts Ready',   class: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm', icon: CheckCircle2 },
  paid:       { label: 'Payment Released', class: 'bg-slate-50 text-slate-500 border-slate-200 shadow-sm',       icon: DollarSign },
};

export default function VendorInvoicePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['vendor-invoices'],
    queryFn: () => invoiceAPI.list().then(r => r.data.data).catch(() => []),
  });

  const { data: tqsBillsRaw } = useQuery({
    queryKey: ['tqs-bills-finance'],
    queryFn: () => tqsBillsAPI.list({ limit: 500 }).then(r => {
      const rows = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
      // Map TQS bill fields to invoice shape for unified display
      return rows.map(b => ({
        id: b.id,
        _source: 'tqs',
        invoice_number: b.inv_number || b.sl_number,
        invoice_date: b.inv_date || b.created_at,
        vendor_name: b.vendor_name,
        project_name: b.project_name,
        project_id: b.project_id,
        net_amount: b.total_amount || 0,
        taxable_amount: b.basic_amount || 0,
        due_date: null,
        po_number: b.po_number,
        grn_number: null,
        tqs_sl: b.sl_number,
        bill_type: b.bill_type,
        payment_status: b.payment_status,
        status: (() => {
          const ws = b.workflow_status;
          if (ws === 'paid') return 'paid';
          if (ws === 'procurement' || ws === 'accounts') return 'authorized';
          if (ws === 'qs') return 'verified';
          return 'pending';
        })(),
        verified_by_name: null,
        authorized_by_name: null,
      }));
    }).catch(() => []),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data).catch(() => []),
  });

  const verifyMut = useMutation({
    mutationFn: (id) => invoiceAPI.verify(id),
    onSuccess: () => { toast.success('Bill verified by audit'); qc.invalidateQueries(['vendor-invoices']); },
  });

  const authMut = useMutation({
    mutationFn: (id) => invoiceAPI.authorize(id),
    onSuccess: () => { toast.success('Bill authorized for payment'); qc.invalidateQueries(['vendor-invoices']); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      toast.success('Invoice deleted successfully');
      qc.invalidateQueries(['vendor-invoices']);
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const allInvoices = [...(invoices || []), ...(tqsBillsRaw || [])];

  const filtered = allInvoices.filter(inv => {
    if (filterProject !== 'all' && inv.project_id !== filterProject) return false;
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen text-[0.94rem]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center border border-slate-200 shadow-sm">
          <FileText className="w-5 h-5 text-indigo-600" />
        </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Vendor Payables</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Invoicing & Bill Booking • 3-Way Match Verification</p>
          </div>
        </div>
        <DataToolbar 
          data={filtered} 
          fileName="Vendor_Invoices_Export" 
          onAdd={() => navigate('/finance/invoices/booking')} 
          addLabel="Book Vendor Bill" 
        />
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Pending Audit" value={filtered.filter(i => i.status === 'pending').length} sub="Requires Verification" color="text-amber-500" />
          <KpiCard label="Ready for Payment" value={filtered.filter(i => i.status === 'authorized').length} sub="Accounts Approved" color="text-emerald-500" />
          <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm p-8 col-span-2 flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] scale-150 rotate-12 pointer-events-none">
                <DollarSign size={120} />
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-right italic relative z-10">Outstanding Liabilities Target</span>
             <div className="flex items-baseline justify-end gap-3 text-4xl font-black text-indigo-600 font-mono italic tracking-tighter relative z-10">
                <span className="text-sm font-bold text-slate-400 not-italic uppercase tracking-widest">INR</span>
                {filtered.reduce((s, i) => s + parseFloat(i.net_amount || 0), 0).toLocaleString('en-IN')}
             </div>
          </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-[1.75rem] p-3.5 flex flex-col md:flex-row items-center gap-3 shadow-sm relative">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input className="w-full bg-slate-50 border border-slate-200 py-2.5 pl-10 pr-4 rounded-xl text-[11px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 placeholder:normal-case placeholder:tracking-normal italic shadow-sm" placeholder="Search Invoice No, Vendor, or GRN Reference..." />
         </div>
         <div className="flex gap-4 w-full md:w-auto">
           <select className="flex-1 md:w-auto bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl text-[9px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="all">All Project Sites</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
           <select className="flex-1 md:w-auto bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl text-[9px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Progress Stages</option>
              <option value="pending">Pending Verification</option>
              <option value="verified">Verified (Audit)</option>
              <option value="authorized">Ready for Payment</option>
           </select>
         </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Vendor & Invoice', 'Match References', 'Net Value', 'Workflow Stage', 'Fiscal Actions', ''].map((h, i) => (
                  <th key={i} className={clsx("py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic", h === 'Net Value' || h === 'Fiscal Actions' ? 'text-right' : '')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filtered.map(inv => {
                 const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                 return (
                   <tr key={inv.id} className="hover:bg-slate-50/50 transition-all group">
                     <td className="py-5 px-6">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-105 group-hover:border-indigo-200 transition-all">
                              <Building2 className="w-6 h-6" />
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                <div className="text-slate-900 font-black text-xs uppercase tracking-tight italic">{inv.vendor_name}</div>
                                {inv._source === 'tqs' && (
                                  <span className="text-[8px] font-black uppercase tracking-widest bg-violet-100 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-md">TQS</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                 <Tag className="w-3.5 h-3.5 text-slate-400" />
                                 <span className="text-[10px] font-mono text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{inv.invoice_number}</span>
                                 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">• {inv.invoice_date ? dayjs(inv.invoice_date).format('DD MMM YYYY') : '—'}</span>
                              </div>
                              {inv._source === 'tqs' && inv.tqs_sl && (
                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">SL: {inv.tqs_sl} · {inv.bill_type === 'wo' ? 'Work Order' : 'Purchase Order'}</div>
                              )}
                           </div>
                        </div>
                     </td>
                     <td className="py-5 px-6">
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                              <span className="text-slate-400 w-8">PO:</span> 
                              <span className="text-slate-900 font-mono italic font-black shadow-sm px-2 py-0.5 border border-slate-200 rounded-md bg-white">{inv.po_number || 'N/A'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                              <span className="text-slate-400 w-8">GRN:</span> 
                              <span className="text-slate-900 font-mono italic font-black shadow-sm px-2 py-0.5 border border-slate-200 rounded-md bg-white">{inv.grn_number || 'N/A'}</span>
                           </div>
                        </div>
                     </td>
                     <td className="py-5 px-6 text-right">
                        <div className="text-slate-900 font-black font-mono tracking-tighter text-lg italic">₹{parseFloat(inv.net_amount).toLocaleString('en-IN')}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Due: {dayjs(inv.due_date).format('DD/MM/YY')}</div>
                     </td>
                     <td className="py-5 px-6">
                        <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border w-fit italic', cfg.class)}>
                           <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2 italic px-1">
                           {inv.status === 'verified' ? `Verified by ${inv.verified_by_name}` : (inv.status === 'authorized' ? `Auth by ${inv.authorized_by_name}` : 'Awaiting Audit')}
                        </div>
                     </td>
                     <td className="py-5 px-6 text-right flex justify-end gap-2 items-center">
                         {inv._source !== 'tqs' && inv.status === 'pending' && <button onClick={() => verifyMut.mutate(inv.id)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20 italic">Verify</button>}
                         {inv._source !== 'tqs' && inv.status === 'verified' && <button onClick={() => authMut.mutate(inv.id)} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-600/20 italic">Authorize</button>}
                         {inv._source === 'tqs' && (
                           <button onClick={() => navigate(`/tqs/bills/${inv.id}`)} className="px-4 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-600 border border-violet-200 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all italic flex items-center gap-1.5">
                             <ExternalLink className="w-3 h-3" /> Open in TQS
                           </button>
                         )}
                         {inv._source !== 'tqs' && <button className="w-10 h-10 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-400 flex items-center justify-center rounded-xl border border-slate-200 shadow-sm transition-all"><Printer className="w-4 h-4 text-slate-500" /></button>}
                     </td>
                     <td className="py-5 px-6" onClick={e => e.stopPropagation()}>
                         {inv._source !== 'tqs' && <TableActions disableEdit onDelete={() => deleteMut.mutate(inv.id)} />}
                      </td>
                   </tr>
                 );
               })}
               {filtered.length === 0 && (
                 <tr>
                   <td colSpan={6} className="py-24 text-center">
                     <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl mx-auto flex items-center justify-center mb-6">
                       <FileText className="w-10 h-10 text-slate-300" />
                     </div>
                     <span className="text-slate-400 font-black uppercase tracking-[0.3em] italic">No Vendor Invoices Found</span>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 block">Try adjusting filters or book a new inward bill</p>
                   </td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 italic">{label}</span>
       <div className={clsx('text-4xl font-black italic tracking-tighter font-mono', color)}>{value}</div>
       <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">{sub}</div>
    </div>
  );
}
