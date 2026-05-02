// src/pages/hse/PermitPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { 
  FileText, Plus, X, ShieldCheck, 
  ArrowUpRight, Clock, MapPin, HardHat,
  AlertTriangle, Filter, CheckCircle2,
  Calendar, Eye, Download, Info, Zap
} from 'lucide-react';
import { permitAPI, projectAPI, default as api } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const PERMIT_CONFIG = {
  height_work:    { label: 'Work at Height (>2m)', icon: ArrowUpRight, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  hot_work:       { label: 'Hot Work / Welding', icon: Zap,          color: 'text-orange-500', bg: 'bg-orange-500/10' },
  excavation:     { label: 'Deep Excavation',     icon: MapPin,       color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  confined_space: { label: 'Confined Space',     icon: ShieldCheck,  color: 'text-purple-500', bg: 'bg-purple-500/10' },
};

export default function PermitPage() {
  const [showForm, setShowForm] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: permits, isLoading } = useQuery({
    queryKey: ['permits', filterProject],
    queryFn: () => permitAPI.list(filterProject !== 'all' ? { project_id: filterProject } : {}).then(r => r.data.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (d) => permitAPI.create(d),
    onSuccess: () => {
      toast.success('Safe Work Permit (PTW) Issued');
      reset(); setShowForm(false);
      qc.invalidateQueries(['permits']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Authorization failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/permits/${id}`),
    onSuccess: () => {
      toast.success('Permit document expunged');
      qc.invalidateQueries(['permits']);
    },
    onError: () => toast.error('Failed to delete permit'),
  });

  const activeCount = permits?.filter(p => p.status === 'active').length || 0;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-7 h-7 text-blue-500" />
           </div>
           <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic text-shadow">Digital Permit-to-Work</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">High-Risk Activity Authorization • 2-Stage Sign-off</p>
           </div>
        </div>
        <DataToolbar 
           data={permits} 
           fileName="PTW_Permit_Ledger" 
           onAdd={() => setShowForm(true)} 
           addLabel="Apply for PTW"
         />
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Live Authorizations" value={activeCount} color="text-emerald-500" />
          <StatCard label="Work at Height" value={permits?.filter(p => p.permit_type === 'height_work').length || 0} color="text-blue-500" />
          <StatCard label="Hot Work / Fire" value={permits?.filter(p => p.permit_type === 'hot_work').length || 0} color="text-orange-500" />
          <StatCard label="Expired / Closed" value={permits?.filter(p => p.status === 'closed' || p.status === 'expired').length || 0} color="text-slate-500" />
      </div>

      {/* Main Grid: Permit Ledger */}
      <div className="bg-white border border-slate-200 overflow-hidden rounded-[2.5rem] shadow-sm">
        <div className="p-8 border-b border-slate-100 bg-white">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
              <Zap size={16} className="text-blue-500" /> Active High-Risk Authorization Registry
           </h3>
        </div>
        <div className="p-0">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Permit ID & Site</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type & Risk Profile</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Valid Window</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Issued To</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Sign-Off Status</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {permits?.map(p => {
                const cfg = PERMIT_CONFIG[p.permit_type] || PERMIT_CONFIG.height_work;
                const isExpired = p.status === 'expired' || dayjs(p.valid_to).isBefore(dayjs());
                
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-all group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                         <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-800 shadow-sm group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-slate-900 font-black text-sm uppercase tracking-tight italic">{p.permit_number}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.project_name}</div>
                         </div>
                      </div>
                    </td>
                    <td className="p-6">
                       <div className={clsx("flex items-center gap-2 p-1.5 px-4 rounded-xl border text-[9px] font-black uppercase tracking-[0.1em] mb-1.5 w-fit shadow-sm", cfg.bg, cfg.color.replace('text-', 'border-').replace('/10', '/30'))}>
                          <cfg.icon size={12} /> {cfg.label}
                       </div>
                       <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-black uppercase tracking-tight italic ml-1">
                          <MapPin size={10} className="text-slate-300" /> {p.location}
                       </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-xs font-mono">
                         <span className="p-1 px-2 bg-slate-50 rounded-lg">{dayjs(p.valid_from).format('DD MMM • HH:mm')}</span>
                         <span className="text-slate-300">→</span>
                         <span className={clsx("p-1 px-2 rounded-lg", isExpired ? "bg-red-500 text-white" : "bg-emerald-500 text-white")}>{dayjs(p.valid_to).format('HH:mm')}</span>
                      </div>
                      {isExpired && <div className="text-[7px] bg-red-600 text-white px-2 mt-2 rounded-full w-fit font-black uppercase italic animate-pulse shadow-sm">Permit Expired</div>}
                    </td>
                    <td className="p-6">
                       <div className="flex items-center gap-2 mb-1.5">
                          <HardHat size={14} className="text-amber-500" />
                          <span className="text-slate-900 font-black text-xs uppercase tracking-tight italic">{p.issued_to}</span>
                       </div>
                       <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest ml-5">Safety Auth: {p.issued_by_name}</div>
                    </td>
                    <td className="p-6">
                        <div className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border w-fit shadow-sm', 
                          p.status === 'active' ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/20' : 
                          p.status === 'expired' ? 'bg-red-500/5 text-red-600 border-red-500/20' :
                          'bg-slate-500/5 text-slate-600 border-slate-500/20')}>
                           {p.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {p.status}
                        </div>
                        <div className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2 italic px-1 ml-1 opacity-70">
                           HSE Corporate Approved
                        </div>
                    </td>
                    <td className="p-6 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <button className="w-9 h-9 flex items-center justify-center bg-white text-slate-400 hover:text-blue-600 border border-slate-200 shadow-sm rounded-xl transition-all"><Eye className="w-4 h-4" /></button>
                            <button className="w-9 h-9 flex items-center justify-center bg-white text-slate-400 hover:text-blue-600 border border-slate-200 shadow-sm rounded-xl transition-all"><Download className="w-4 h-4" /></button>
                            {p.status === 'active' && (
                              <button className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-red-100 transition-all shadow-sm">Terminate</button>
                            )}
                            <div onClick={e => e.stopPropagation()} className="ml-1">
                              <TableActions disableEdit onDelete={() => deleteMut.mutate(p.id)} />
                            </div>
                         </div>
                     </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Permit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-sm w-full max-w-2xl rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20"><FileText size={24} /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic leading-none mb-1">Safe Work Application</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">High-Risk Activity Authorization Protocol (PTW)</p>
                  </div>
               </div>
               <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50 transition-all"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit(createMut.mutate)} className="p-10 space-y-8 overflow-y-auto max-h-[75vh]">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none">HSE Site Segment</label>
                        <select {...register('project_id', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase tracking-tight outline-none focus:border-blue-500 transition-all">
                           <option value="">Select Project Target...</option>
                           {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none">High-Risk Activity Category</label>
                        <select {...register('permit_type', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase tracking-tight outline-none focus:border-blue-500 transition-all">
                           {Object.entries(PERMIT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none">Responsible Supervisor</label>
                        <input {...register('issued_to', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase tracking-tight outline-none focus:border-blue-500 transition-all shadow-inner italic" placeholder="Name of Verified Auth..." />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none ml-1">From (Start)</label>
                           <input type="datetime-local" {...register('valid_from', { required: true })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-900 uppercase outline-none focus:border-blue-500 transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none ml-1">Until (End)</label>
                           <input type="datetime-local" {...register('valid_to', { required: true })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-900 uppercase outline-none focus:border-blue-500 transition-all" />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Operational Work Scope</label>
                  <textarea {...register('work_description', { required: true })} rows={3} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] text-xs italic font-bold text-slate-900 outline-none focus:border-blue-500 shadow-inner resize-none transition-all" placeholder="Provide a detailed, forensic scope of high-risk work activities..." />
               </div>

               {/* Pre-conditions Checklist */}
               <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 space-y-6">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 pb-3 italic text-center">Mandatory Safety Sign-off Protocol</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-4">
                     {[
                       'Full PPE worn by all workers',
                       'Task-specific training conducted (TBT)',
                       'Machinery / Tools inspected',
                       'Fall protection / Barricades verified',
                       'Rescue plan established',
                       'Communication clear (Radios/Signals)'
                     ].map((item, i) => (
                       <label key={i} className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 bg-slate-50 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm" />
                          <span className="text-[10px] font-black text-slate-500 group-hover:text-blue-600 transition-colors uppercase tracking-tight italic">{item}</span>
                       </label>
                     ))}
                  </div>
               </div>

               <div className="bg-amber-500 text-white p-6 rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-5 italic leading-relaxed shadow-xl shadow-amber-500/20">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0"><AlertTriangle size={24} /></div>
                  <span>Warning: Working outside the scope of this permit or without mandatory safety protocols will lead to immediate site suspension and project disciplinary action.</span>
               </div>

               <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Discard Logic</button>
                  <button type="submit" disabled={createMut.isPending} className="flex-2 py-5 bg-blue-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 italic">Authorize Safe Work Permit 🛡</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white p-6 border border-slate-200 rounded-[2rem] shadow-sm group hover:border-blue-500/30 transition-all cursor-default">
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 leading-none italic">{label}</span>
       <div className={clsx("text-4xl font-black italic tracking-tighter leading-none", color)}>{value}</div>
    </div>
  );
}
