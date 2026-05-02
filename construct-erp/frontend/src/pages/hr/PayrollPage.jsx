// src/pages/hr/PayrollPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Play, X, ChevronDown, ChevronUp, Clock, Filter, CreditCard, Landmark, History, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { payrollAPI, projectAPI, default as api } from '../../api/client';
import toast from 'react-hot-toast';
import TableActions from '../../components/common/TableActions';

const inr = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PayrollPage() {
  const [projectId, setProjectId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [periodTo, setPeriodTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [expanded, setExpanded] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payMode, setPayMode] = useState('cash');
  const qc = useQueryClient();

  const { data: projects } = useQuery({ 
    queryKey: ['projects'], 
    queryFn: () => projectAPI.list().then(r => r.data.data).catch(() => null) 
  });

  const { data: payrollData } = useQuery({ 
    queryKey: ['payroll', projectId, periodFrom, periodTo], 
    queryFn: () => payrollAPI.list({ project_id: projectId || undefined, period_from: periodFrom, period_to: periodTo }).then(r => r.data.data).catch(() => null) 
  });

  const genMutation = useMutation({
    mutationFn: () => payrollAPI.generate({ project_id: projectId, period_from: periodFrom, period_to: periodTo }),
    onSuccess: (r) => { 
      toast.success(`Payroll generated for ${r.data.data?.length || 0} personnel units`); 
      qc.invalidateQueries({ queryKey: ['payroll'] }); 
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Payroll Generation Failed'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id }) => payrollAPI.pay(id),
    onSuccess: () => { 
      toast.success('Disbursement Recorded Successfully'); 
      setPayModal(null); 
      qc.invalidateQueries(['payroll']); 
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Disbursement Recording Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/payroll/${id}`),
    onSuccess: () => {
      toast.success('Payroll record expunged from ledger');
      qc.invalidateQueries(['payroll']);
    },
    onError: () => toast.error('Failed to expunge payroll record'),
  });

  const all = payrollData ?? [];
  const totals = all.reduce((s, r) => ({
    gross: s.gross + parseFloat(r.gross_wages || 0),
    pf: s.pf + parseFloat(r.pf_employee || 0) + parseFloat(r.pf_employer || 0),
    esi: s.esi + parseFloat(r.esi_employee || 0) + parseFloat(r.esi_employer || 0),
    net: s.net + parseFloat(r.net_wages || 0)
  }), { gross: 0, pf: 0, esi: 0, net: 0 });

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/20">
              <Banknote className="w-7 h-7" />
           </div>
           <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Payroll Processing Ledger</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Automated Muster Reconciliation • Statutory Compliance PF/ESI • Net Disbursement</p>
           </div>
        </div>
        <button 
          onClick={() => genMutation.mutate()} 
          disabled={!projectId || genMutation.isPending}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] shadow-xl shadow-amber-500/20 italic transition-all"
        >
          <Play className="w-4 h-4" /> {genMutation.isPending ? 'Generating Processing Logic...' : 'Initiate Payroll Execution'}
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white border border-slate-200 p-8 rounded-[3rem] shadow-sm flex flex-col lg:flex-row gap-8 items-center">
        <div className="w-full lg:w-96 space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none italic">Target Operational Segment</label>
           <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 uppercase italic outline-none focus:border-amber-500 transition-all shadow-inner" value={projectId} onChange={e => setProjectId(e.target.value)}>
             <option value="">All Project Site Segments</option>
             {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
        </div>

        <div className="flex-1 space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 leading-none italic">Fiscal Period Selection</label>
           <div className="flex items-center gap-4">
             <div className="relative flex-1">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                <input type="date" className="w-full p-3.5 pl-10 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 font-mono uppercase shadow-inner outline-none focus:border-amber-500 transition-all" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
             </div>
             <span className="text-slate-300 font-black italic">→</span>
             <div className="relative flex-1">
                <History className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                <input type="date" className="w-full p-3.5 pl-10 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 font-mono uppercase shadow-inner outline-none focus:border-amber-500 transition-all" value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
             </div>
           </div>
        </div>
      </div>

      {/* Fiscal Diagnostics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <DiagnosticCard label="Gross Wages" value={inr(totals.gross)} color="text-amber-600" />
        <DiagnosticCard label="PF Liability" value={inr(totals.pf)} color="text-red-500" />
        <DiagnosticCard label="ESI Liability" value={inr(totals.esi)} color="text-blue-500" />
        <DiagnosticCard label="Net Payable" value={inr(totals.net)} color="text-emerald-600" />
        <DiagnosticCard label="Pending Units" value={all.filter(r => r.payment_status === 'pending').length} color="text-indigo-600" />
      </div>

      {/* Payroll Records Ledger */}
      <div className="space-y-4">
        {all.map(rec => {
          const isExp = expanded === rec.id;
          return (
            <div key={rec.id} className={clsx('bg-white border rounded-[2.5rem] transition-all overflow-hidden shadow-sm', isExp ? 'border-amber-500 ring-4 ring-amber-500/5' : 'border-slate-200 hover:border-amber-300')}>
              <div className="p-6 md:p-8 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(p => p === rec.id ? null : rec.id)}>
                <div className="flex-1">
                  <div className="flex items-center gap-4 flex-wrap mb-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black">
                       {rec.worker_name.charAt(0)}
                    </div>
                    <span className="font-black text-slate-900 text-sm uppercase italic tracking-tight">{rec.worker_name}</span>
                    <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 italic">{rec.skill_type}</span>
                    <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{rec.gang_name}</span>
                    <span className={clsx('px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border italic ml-auto md:ml-0', rec.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100')}>
                       {rec.payment_status === 'paid' ? '✓ Disbursed' : '⏳ Awaiting Fund Transfer'}
                    </span>
                  </div>
                  <div className="flex gap-6 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] italic ml-14">
                    <span>Period: {dayjs(rec.period_from).format('D MMM')} → {dayjs(rec.period_to).format('D MMM YYYY')}</span>
                    <span className="text-slate-200">|</span>
                    <span>Deployment: <span className="text-slate-900 font-mono">{rec.days_present} Days</span></span>
                    <span className="text-slate-200">|</span>
                    <span>OT: <span className="text-amber-600 font-mono">{rec.ot_hours} Hours</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-6 ml-6">
                  <div className="text-right">
                     <div className="text-[9px] font-black text-slate-400 uppercase italic mb-1.5">Net Disbursement</div>
                     <div className="font-mono font-black text-emerald-600 text-lg leading-none italic">{inr(rec.net_wages)}</div>
                  </div>
                  {rec.payment_status === 'pending' && (
                    <button 
                      onClick={e => { e.stopPropagation(); setPayModal(rec); }} 
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 italic"
                    >
                      Process Payment
                    </button>
                  )}
                  <div onClick={e => e.stopPropagation()}>
                    <TableActions disableEdit onDelete={() => deleteMut.mutate(rec.id)} />
                  </div>
                  <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center transition-all", isExp ? "bg-amber-50 text-amber-500" : "bg-slate-50 text-slate-300")}>
                    {isExp ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {isExp && (
                <div className="px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 grid grid-cols-2 md:grid-cols-7 gap-4">
                    <BreakdownItem label="Basic Pay" value={inr(rec.basic_wages)} />
                    <BreakdownItem label="OT Bonus" value={inr(rec.ot_wages)} />
                    <BreakdownItem label="Gross" value={inr(rec.gross_wages)} highlight="text-amber-600" />
                    <BreakdownItem label="Employee PF" value={inr(rec.pf_employee)} highlight="text-red-500" />
                    <BreakdownItem label="Employee ESI" value={inr(rec.esi_employee)} highlight="text-red-500" />
                    <BreakdownItem label="Employer Contribution" value={inr(parseFloat(rec.pf_employer) + parseFloat(rec.esi_employer))} highlight="text-blue-500" />
                    <BreakdownItem label="Net Payable" value={inr(rec.net_wages)} highlight="text-emerald-600" />
                  </div>
                  <div className="mt-4 px-6 py-3 bg-white border border-slate-100 rounded-2xl flex items-center justify-between">
                     <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                        <ShieldCheck size={14} className="text-emerald-500" /> Statutory Calculations Verified by BCIM Forensic Payroll Engine
                     </div>
                     <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Hash: #{rec.id.substring(0,8).toUpperCase()}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {all.length === 0 && (
           <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white">
              <p className="text-slate-400 font-black uppercase text-[10px] italic tracking-[0.3em]">No Payroll Records Detected for the Selected Period</p>
           </div>
        )}
      </div>

      {/* Disbursement Modal */}
      {payModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 shadow-2xl w-full max-w-sm rounded-[3rem] overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
               <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Disbursement Confirmation</h2>
               <button onClick={() => setPayModal(null)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-8 space-y-8">
               <div className="text-center">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-2">Authorizing Payment to:</div>
                  <div className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{payModal.worker_name}</div>
                  <div className="mt-6 inline-block bg-emerald-50 border border-emerald-100 px-6 py-3 rounded-2xl">
                     <div className="text-3xl font-black text-emerald-600 italic tracking-tighter leading-none font-mono">{inr(payModal.net_wages)}</div>
                  </div>
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Execution Mode</label>
                  <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 uppercase italic outline-none focus:border-amber-500 transition-all shadow-inner" value={payMode} onChange={e => setPayMode(e.target.value)}>
                    {['cash', 'neft', 'rtgs', 'upi', 'cheque'].map(m => <option key={m}>{m.toUpperCase()}</option>)}
                  </select>
               </div>

               <div className="flex gap-4">
                  <button onClick={() => setPayModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Abort Audit</button>
                  <button onClick={() => payMutation.mutate({ id: payModal.id })} disabled={payMutation.isPending} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] shadow-xl shadow-emerald-600/20 italic">Authorize Transfer</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosticCard({ label, value, color }) {
  return (
    <div className="bg-white p-6 border border-slate-200 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-all">
       <div className={clsx('text-2xl font-black italic tracking-tighter leading-none font-mono mb-2', color)}>{value}</div>
       <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">{label}</div>
    </div>
  );
}

function BreakdownItem({ label, value, highlight = "text-slate-900" }) {
  return (
    <div className="text-center space-y-1">
       <div className={clsx("font-mono font-black italic tracking-tight leading-none text-[11px]", highlight)}>{value}</div>
       <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none italic">{label}</div>
    </div>
  );
}
