// src/pages/finance/VendorInvoicePage.jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, Search,
  CheckCircle2, Clock, ShieldCheck,
  ArrowUpRight, DollarSign, Tag, Building2
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { tqsBillsAPI, projectAPI } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import DataToolbar from '../../components/common/DataToolbar';

const STATUS_CONFIG = {
  pending:             { label: 'Pending',          class: 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm',   icon: Clock },
  stores:              { label: 'In Stores',         class: 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm', icon: Clock },
  document_controller: { label: 'Doc Control',      class: 'bg-sky-50 text-sky-600 border-sky-200 shadow-sm',          icon: Clock },
  qs:                  { label: 'QS Certification',  class: 'bg-violet-50 text-violet-600 border-violet-200 shadow-sm', icon: ShieldCheck },
  accounts:            { label: 'Accounts',          class: 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm',       icon: ShieldCheck },
  procurement:         { label: 'Ready for Payment', class: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm', icon: CheckCircle2 },
  paid:                { label: 'Paid',              class: 'bg-slate-50 text-slate-500 border-slate-200 shadow-sm',    icon: DollarSign },
};

export default function VendorInvoicePage() {
  const navigate = useNavigate();
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [search, setSearch] = useState('');

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['vendor-invoices-tqs'],
    queryFn: () => tqsBillsAPI.list({ limit: 500 }).then(r => r.data?.data || []).catch(() => []),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  // Map TQS bill fields to display fields
  const invoices = bills.map(b => ({
    id: b.id,
    vendor_name: b.vendor_name || '—',
    invoice_number: b.inv_number || b.sl_number || '—',
    invoice_date: b.inv_date || b.received_date,
    po_number: b.po_number,
    grn_number: b.grn_number,
    net_amount: Number(b.total_amount || b.basic_amount || 0),
    basic_amount: Number(b.basic_amount || 0),
    gst_amount: Number(b.gst_amount || 0),
    status: b.workflow_status || 'pending',
    payment_status: b.payment_status,
    bill_type: b.bill_type,
    project_id: b.project_id,
    project_name: b.project_name,
    sl_number: b.sl_number,
  }));

  const filtered = invoices.filter(inv => {
    if (filterProject !== 'all' && inv.project_id !== filterProject) return false;
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return [inv.vendor_name, inv.invoice_number, inv.po_number, inv.sl_number]
        .some(v => String(v || '').toLowerCase().includes(s));
    }
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
          <KpiCard label="Total Bills" value={filtered.length} sub={`${bills.length} in TQS tracker`} color="text-indigo-500" />
          <KpiCard label="Pending Payment" value={filtered.filter(i => !['paid'].includes(i.status)).length} sub="Awaiting clearance" color="text-amber-500" />
          <KpiCard label="Paid" value={filtered.filter(i => i.status === 'paid').length} sub="Cleared bills" color="text-emerald-500" />
          <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm p-8 flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] scale-150 rotate-12 pointer-events-none">
                <DollarSign size={120} />
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 italic relative z-10">Total Value</span>
             <div className="text-2xl font-black text-indigo-600 font-mono italic tracking-tighter relative z-10">
                ₹{filtered.reduce((s, i) => s + (i.net_amount || 0), 0).toLocaleString('en-IN')}
             </div>
          </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-[1.75rem] p-3.5 flex flex-col md:flex-row items-center gap-3 shadow-sm relative">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 py-2.5 pl-10 pr-4 rounded-xl text-[11px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 placeholder:normal-case placeholder:tracking-normal italic shadow-sm" placeholder="Search Invoice No, Vendor, PO No..." />
         </div>
         <div className="flex gap-4 w-full md:w-auto">
           <select className="flex-1 md:w-auto bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl text-[9px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="all">All Projects</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
           <select className="flex-1 md:w-auto bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl text-[9px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Stages</option>
              <option value="pending">Pending</option>
              <option value="stores">Stores</option>
              <option value="document_controller">Doc Control</option>
              <option value="qs">QS</option>
              <option value="accounts">Accounts</option>
              <option value="procurement">Ready for Payment</option>
              <option value="paid">Paid</option>
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
               {isLoading ? (
                 <tr><td colSpan={6} className="py-16 text-center text-slate-400">Loading bills…</td></tr>
               ) : filtered.map(inv => {
                 const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                 return (
                   <tr key={inv.id} className="hover:bg-slate-50/50 transition-all group">
                     <td className="py-5 px-6">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-105 group-hover:border-indigo-200 transition-all">
                              <Building2 className="w-6 h-6" />
                           </div>
                           <div>
                              <div className="text-slate-900 font-black text-xs uppercase tracking-tight italic">{inv.vendor_name}</div>
                              <div className="flex items-center gap-2 mt-1.5">
                                 <Tag className="w-3.5 h-3.5 text-slate-400" />
                                 <span className="text-[10px] font-mono text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{inv.invoice_number}</span>
                                 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">• {inv.invoice_date ? dayjs(inv.invoice_date).format('DD MMM YYYY') : '—'}</span>
                              </div>
                           </div>
                        </div>
                     </td>
                     <td className="py-5 px-6">
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                              <span className="text-slate-400 w-8">PO:</span>
                              <span className="text-slate-900 font-mono italic font-black shadow-sm px-2 py-0.5 border border-slate-200 rounded-md bg-white">{inv.po_number || '—'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                              <span className="text-slate-400 w-8">SL:</span>
                              <span className="text-slate-900 font-mono italic font-black shadow-sm px-2 py-0.5 border border-slate-200 rounded-md bg-white">{inv.sl_number || '—'}</span>
                           </div>
                        </div>
                     </td>
                     <td className="py-5 px-6 text-right">
                        <div className="text-slate-900 font-black font-mono tracking-tighter text-lg italic">₹{inv.net_amount.toLocaleString('en-IN')}</div>
                        {inv.gst_amount > 0 && <div className="text-[9px] text-slate-400 font-bold mt-1">GST: ₹{inv.gst_amount.toLocaleString('en-IN')}</div>}
                     </td>
                     <td className="py-5 px-6">
                        <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border w-fit italic', cfg.class)}>
                           <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                        </div>
                        {inv.project_name && (
                          <div className="text-[9px] text-slate-400 font-bold mt-2 px-1 truncate max-w-[160px]">{inv.project_name}</div>
                        )}
                     </td>
                     <td className="py-5 px-6 text-right">
                       <a href="/tqs/bills" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all italic inline-flex items-center gap-1.5">
                         <ArrowUpRight className="w-3.5 h-3.5" /> Open in TQS
                       </a>
                     </td>
                     <td className="py-5 px-6">
                       <span className={clsx('text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg',
                         inv.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                         inv.payment_status === 'partial' ? 'bg-violet-50 text-violet-600' :
                         'bg-amber-50 text-amber-600'
                       )}>{inv.payment_status || 'pending'}</span>
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
