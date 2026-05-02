// src/pages/it/ITTicketPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Ticket, Plus, Clock, AlertTriangle, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { itTicketAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const PRIORITY_MAP = {
  critical: { label: 'Critical', class: 'bg-red-50 text-red-600 border border-red-100',    slaH: 4,  icon: '🔴' },
  high:     { label: 'High',     class: 'bg-amber-50 text-amber-600 border border-amber-100',     slaH: 8,  icon: '🟡' },
  medium:   { label: 'Medium',   class: 'bg-blue-50 text-blue-600 border border-blue-100',   slaH: 24, icon: '🔵' },
  low:      { label: 'Low',      class: 'bg-slate-50 text-slate-600 border border-slate-200',   slaH: 48, icon: '⚪' },
};

const STATUS_MAP = {
  open:         { label: 'Open',         class: 'bg-red-50 text-red-600 border border-red-100' },
  in_progress:  { label: 'In Progress',  class: 'bg-amber-50 text-amber-600 border border-amber-100' },
  pending_user: { label: 'Pending User', class: 'bg-blue-50 text-blue-600 border border-blue-100' },
  resolved:     { label: 'Resolved',     class: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  closed:       { label: 'Closed',       class: 'bg-slate-50 text-slate-600 border border-slate-200' },
};

function SLAIndicator({ createdAt, slaHours, status }) {
  if (['resolved', 'closed'].includes(status)) return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest italic">✓ SLA Met</span>;
  const deadline = dayjs(createdAt).add(slaHours, 'hour');
  const hoursLeft = deadline.diff(dayjs(), 'hour');
  const pct = Math.max(0, Math.min(100, (hoursLeft / slaHours) * 100));
  const color = hoursLeft < 2 ? 'text-red-500' : hoursLeft < (slaHours * 0.3) ? 'text-amber-500' : 'text-emerald-500';
  return (
    <div className="flex items-center gap-1.5">
      <Clock className={clsx('w-3.5 h-3.5', color)} />
      <span className={clsx('text-[10px] font-black uppercase tracking-widest italic', color)}>
        {hoursLeft < 0 ? `SLA breached ${Math.abs(hoursLeft)}h ago` : `${hoursLeft}h remaining`}
      </span>
    </div>
  );
}

function TicketCard({ ticket, onResolve }) {
  const p = PRIORITY_MAP[ticket.priority];
  const s = STATUS_MAP[ticket.status];
  return (
    <div className={clsx(
      'bg-white border rounded-[2rem] p-6 shadow-sm transition-all hover:shadow-md group',
      ticket.priority === 'critical' ? 'border-red-200 hover:border-red-300' :
      ticket.priority === 'high'     ? 'border-amber-200 hover:border-amber-300' :
      ticket.priority === 'medium'   ? 'border-blue-200 hover:border-blue-300' : 'border-slate-200'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">{ticket.ticket_number || 'T-042'}</span>
            <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm", p?.class)}>{p?.icon} {p?.label}</span>
            <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm", s?.class)}>{s?.label}</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-200 bg-white shadow-sm italic">{ticket.category}</span>
          </div>
          <div>
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight italic line-clamp-1">{ticket.subject}</h3>
             <p className="text-[11px] text-slate-500 font-medium mt-1 line-clamp-2 leading-relaxed">{ticket.description}</p>
          </div>
          <div className="flex items-center gap-6 flex-wrap pt-2 border-t border-slate-100">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              📍 {ticket.location || 'HO Pune'} • {ticket.project_name || 'Head Office'}
            </div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
               🕒 {dayjs(ticket.created_at).fromNow()}
            </div>
            <div className="ml-auto">
               <SLAIndicator createdAt={ticket.created_at} slaHours={p?.slaH} status={ticket.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-shrink-0 ml-4">
          {['open','in_progress'].includes(ticket.status) && (
            <button
              className="px-5 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2 italic"
              onClick={() => onResolve(ticket.id)}
            >
              <CheckCircle2 size={14} /> Resolve
            </button>
          )}
          <button className="px-5 py-2.5 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2">
             View Protocol
          </button>
        </div>
      </div>
    </div>
  );
}


export default function ITTicketPage() {
  const [showForm, setShowForm] = useState(false);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const qc = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['it-tickets'],
    queryFn: () => itTicketAPI.list().then(r => r.data.data).catch(() => []),
  });

  const createMutation = useMutation({
    mutationFn: (d) => itTicketAPI.create(d),
    onSuccess: () => {
      toast.success('IT ticket raised successfully!');
      reset(); setShowForm(false);
      qc.invalidateQueries({ queryKey: ['it-tickets'] });
    },
    onError: () => toast.error('Failed to create ticket'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => itTicketAPI.resolve(id, { status: 'resolved' }),
    onSuccess: () => { toast.success('Ticket marked as resolved'); qc.invalidateQueries({ queryKey: ['it-tickets'] }); },
  });

  const tickets = (data || []).filter(t => {
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  const allTickets = data || [];
  const openCount = allTickets.filter(t => t.status === 'open').length;
  const critCount = allTickets.filter(t => t.priority === 'critical' && !['resolved','closed'].includes(t.status)).length;

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
               <Ticket className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
               <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic leading-none mb-1">IT Help Desk</h1>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">SLA-Tracked Support • Centralized Ops</p>
            </div>
         </div>
         <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-full transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2 italic" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Raise Support Ticket
         </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-red-300 transition-all">
            <div className="text-4xl font-black text-red-500 font-mono italic tracking-tighter leading-none">{critCount}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">Critical Open</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-amber-300 transition-all">
            <div className="text-4xl font-black text-amber-500 font-mono italic tracking-tighter leading-none">{openCount}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">Total Open</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-emerald-300 transition-all">
            <div className="text-4xl font-black text-emerald-500 font-mono italic tracking-tighter leading-none">3</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">Resolved Today</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-blue-300 transition-all">
            <div className="text-4xl font-black text-blue-500 font-mono italic tracking-tighter leading-none">87%</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">SLA Compliance</div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
         {/* Sidebar: SLA & Filters */}
         <div className="md:col-span-3 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2 italic">SLA Resolution Policy</h3>
               <div className="space-y-4">
                  {Object.entries(PRIORITY_MAP).map(([key, val]) => (
                     <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className="text-sm">{val.icon}</span>
                           <span className="text-xs font-black text-slate-700 uppercase italic tracking-tight">{val.label}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Res: {val.slaH}h</span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-6">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-100 pb-2 italic">Filter Matrix</h3>
               
               <div className="space-y-3">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 italic ml-1">Priority Layer</div>
                  <div className="flex flex-wrap gap-2">
                     {['all','critical','high','medium','low'].map(p => (
                        <button key={p} onClick={() => setFilterPriority(p)}
                           className={clsx('px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all italic border',
                              filterPriority === p ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                           )}
                        >{p === 'all' ? 'All Priority' : p}</button>
                     ))}
                  </div>
               </div>

               <div className="space-y-3 pt-2">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 italic ml-1">Lifecycle Status</div>
                  <div className="flex flex-wrap gap-2">
                     {['all','open','in_progress','resolved','closed'].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                           className={clsx('px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all italic border',
                              filterStatus === s ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                           )}
                        >{s === 'all' ? 'All Status' : s.replace('_',' ')}</button>
                     ))}
                  </div>
               </div>
            </div>
         </div>

         {/* Main Listing */}
         <div className="md:col-span-9 space-y-4">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic ml-2">Support Sequence Log</h3>
            </div>
            {tickets.length > 0 ? tickets.map(t => (
               <TicketCard key={t.id} ticket={t} onResolve={(id) => resolveMutation.mutate(id)} />
            )) : (
               <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white">
                  <Ticket size={40} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-black uppercase text-[10px] italic tracking-[0.3em]">No help desk sequences match criteria</p>
               </div>
            )}
         </div>
      </div>

      {/* New Ticket Modal */}
      {showForm && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20"><AlertTriangle className="w-6 h-6 text-white" /></div>
                     <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-none mb-1">Declare Support Vector</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">IT Help Desk Ticket Initialization</p>
                     </div>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-all"><X className="w-6 h-6" /></button>
               </div>

               <form onSubmit={handleSubmit(createMutation.mutate)} className="p-10 space-y-8 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Incident Category</label>
                        <select {...register('category', { required: true })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-indigo-500 transition-all shadow-sm">
                           <option value="">Select Domain</option>
                           <option value="hardware">Hardware / Physical</option>
                           <option value="software">Software Application</option>
                           <option value="network">Network & Comms</option>
                           <option value="cctv_biometric">CCTV / Bio-Access</option>
                           <option value="email">Enterprise Comms</option>
                           <option value="other">General Query</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">SLA Target Priority</label>
                        <select {...register('priority', { required: true })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-indigo-500 transition-all shadow-sm">
                           <option value="low">Low — 48h Response</option>
                           <option value="medium">Medium — 24h Response</option>
                           <option value="high">High — 8h Response</option>
                           <option value="critical">Critical — 4h Incident</option>
                        </select>
                     </div>
                     <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Operational Locale</label>
                        <select {...register('location')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-indigo-500 transition-all shadow-sm">
                           <option value="HO Pune">Head Office — Pune</option>
                           <option value="Skyline Site">Site — Skyline Heights</option>
                           <option value="NH-48 Site">Site — NH-48 Division</option>
                           <option value="Kohinoor Site">Site — Kohinoor Hub</option>
                        </select>
                     </div>
                     <div className="col-span-2 space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Subject Vector</label>
                        <input {...register('subject', { required: true })} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-900 uppercase tracking-tight outline-none focus:border-indigo-500 transition-all shadow-sm" placeholder="BRIEF INCIDENT IDENTIFIER" />
                     </div>
                     <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Diagnostic Detail</label>
                        <textarea {...register('description')} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all shadow-sm resize-none" rows={4} placeholder="Describe the error, operational impact, or exact requirements..." />
                     </div>
                  </div>

                  <div className="flex gap-4 pt-6 border-t border-slate-100">
                     <button type="button" className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-[1.5rem] transition-all" onClick={() => setShowForm(false)}>Abort Sequence</button>
                     <button type="submit" disabled={createMutation.isPending} className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-[1.5rem] shadow-xl shadow-indigo-600/20 italic disabled:opacity-50 flex items-center justify-center gap-2">
                        {createMutation.isPending ? 'Authenticating...' : 'Transmit Ticket Protocol'} <ChevronRight size={16}/>
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}
