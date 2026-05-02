// src/pages/hr/WorkerList.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { HardHat, Plus, X, Search, Filter, UserCheck, Wallet, Landmark, Zap } from 'lucide-react';
import { workerAPI, default as api } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const SKILL_CONFIG = {
  mason:       { label: 'Mason',      bg: 'bg-blue-50',     text: 'text-blue-600',    border: 'border-blue-100' },
  carpenter:   { label: 'Carpenter',  bg: 'bg-teal-50',     text: 'text-teal-600',    border: 'border-teal-100' },
  bar_bender:  { label: 'Bar Bender', bg: 'bg-amber-50',    text: 'text-amber-600',   border: 'border-amber-100' },
  electrician: { label: 'Electrician',bg: 'bg-purple-50',   text: 'text-purple-600',  border: 'border-purple-100' },
  plumber:     { label: 'Plumber',    bg: 'bg-orange-50',   text: 'text-orange-600',  border: 'border-orange-100' },
  helper:      { label: 'Helper',     bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-100' },
  supervisor:  { label: 'Supervisor', bg: 'bg-emerald-50',  text: 'text-emerald-600', border: 'border-emerald-100' }
};

export default function WorkerList() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [skill, setSkill] = useState('all');
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data } = useQuery({ 
    queryKey: ['workers'], 
    queryFn: () => workerAPI.list().then(r => r.data.data).catch(() => []) 
  });

  const createMutation = useMutation({
    mutationFn: (d) => workerAPI.create(d),
    onSuccess: () => { 
      toast.success('Worker Authorized into Registry'); 
      reset(); 
      setShowForm(false); 
      qc.invalidateQueries(['workers']); 
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Authorization Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/workers/${id}`),
    onSuccess: () => {
      toast.success('Personnel record expunged');
      qc.invalidateQueries(['workers']);
    },
    onError: () => toast.error('Failed to expunge worker record'),
  });

  const workers = (data || []).filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (skill !== 'all' && w.skill_type !== skill) return false;
    return true;
  });

  const totalDailyWage = workers.reduce((s, w) => s + parseFloat(w.daily_rate || 0), 0);
  const totalPF = Math.round(totalDailyWage * 26 * 0.12);

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
              <HardHat className="w-7 h-7" />
           </div>
           <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Personnel & Labour Hub</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">BOCW Verified • Daily Wage Protocol • PF/ESI Enforcement</p>
           </div>
        </div>
        <DataToolbar 
          data={workers} 
          fileName="BCIM_Labour_Registry" 
          onAdd={() => setShowForm(true)} 
          addLabel="Authorize Personnel"
        />
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Active Strength" value={workers.filter(w => w.is_active).length} icon={UserCheck} color="text-emerald-600" />
        <StatCard label="Daily Wage Bill" value={`₹${totalDailyWage.toLocaleString('en-IN')}`} icon={Wallet} color="text-indigo-600" />
        <StatCard label="Est. PF Liability" value={`₹${totalPF.toLocaleString('en-IN')}`} icon={Landmark} color="text-blue-600" />
        <StatCard label="Trade Diversity" value={[...new Set(workers.map(w => w.skill_type))].length} icon={Zap} color="text-amber-600" />
      </div>

      {/* Statutory Info Bar */}
      <div className="bg-white border border-slate-200 p-6 rounded-[2rem] flex items-center gap-6 shadow-sm">
        <div className="px-5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 italic shrink-0">PF/ESI Protocols:</div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-1 flex items-center gap-4">
           <span>EE PF 12% | ER PF 12%</span>
           <span className="w-1 h-1 bg-slate-300 rounded-full" />
           <span>EE ESI 0.75% | ER ESI 3.25%</span>
           <span className="w-1 h-1 bg-slate-300 rounded-full" />
           <span className="italic opacity-80 decoration-indigo-200 underline">Compliance Ceiling: PF ₹15,000 | ESI ₹21,000</span>
        </div>
        <div className="text-[9px] font-black text-amber-600 uppercase italic">Challan Deadline: 15th M+1</div>
      </div>

      {/* Navigation & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-900 outline-none focus:border-indigo-500 transition-all shadow-sm" 
             placeholder="Search personnel by name or code..." 
             value={search} 
             onChange={e => setSearch(e.target.value)}
           />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['all', 'mason', 'carpenter', 'bar_bender', 'electrician', 'helper'].map(s => (
            <button 
              key={s} 
              onClick={() => setSkill(s)} 
              className={clsx(
                'px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 italic shadow-sm',
                skill === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'
              )}
            >
              {s === 'all' ? 'View All Trades' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Registry Ledger */}
      <div className="bg-white border border-slate-200 overflow-hidden rounded-[2.5rem] shadow-sm">
        <div className="p-8 border-b border-slate-100 bg-white flex items-center justify-between">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 italic">
              <Landmark size={16} className="text-indigo-600" /> Administrative Personnel Ledger
           </h3>
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Forensic Audit Enabled</div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Worker Designation</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Skill Class</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Administrative Segment</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily Compensation</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">BOCW / Origin</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {workers.map(w => {
                const sc = SKILL_CONFIG[w.skill_type] || SKILL_CONFIG.helper;
                return (
                  <tr key={w.id} className="hover:bg-slate-50 transition-all group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                         <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform font-black">
                            {w.name.charAt(0)}
                         </div>
                         <div>
                            <div className="text-slate-900 font-black text-sm uppercase tracking-tight italic">{w.name}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 font-mono">CODE: {w.worker_code}</div>
                         </div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                       <span className={clsx("px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.1em] border shadow-sm italic", sc.bg, sc.text, sc.border)}>
                          {sc.label}
                       </span>
                    </td>
                    <td className="p-6">
                       <div className="text-[10px] font-black text-slate-900 uppercase italic mb-1">{w.gang_name || 'No Gang Assigned'}</div>
                       <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{w.contractor_name || 'Direct Employment'}</div>
                    </td>
                    <td className="p-6">
                       <div className="text-xs font-black text-slate-900 italic tracking-tight">₹{w.daily_rate}/day</div>
                       <div className="text-[9px] text-emerald-600 font-bold uppercase mt-1">Net Payable</div>
                    </td>
                    <td className="p-6">
                       <div className="text-[10px] font-black text-slate-900 uppercase italic mb-1">{w.bocw_number || 'REG: NOT FILED'}</div>
                       <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{w.state_of_origin}</div>
                    </td>
                    <td className="p-6">
                       <span className={clsx(
                         "px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border shadow-sm italic",
                         w.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                       )}>
                         {w.is_active ? 'In Service' : 'Discharged'}
                       </span>
                    </td>
                    <td className="p-6 text-right">
                       <div onClick={e => e.stopPropagation()}>
                          <TableActions disableEdit onDelete={() => deleteMut.mutate(w.id)} />
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Worker Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-sm w-full max-w-xl rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20"><Plus size={24} /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic leading-none mb-1">Worker Authorization</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none italic">New Personnel Enrollment Protocol</p>
                  </div>
               </div>
               <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50 transition-all"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit(createMutation.mutate)} className="p-10 space-y-8 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Worker Full Name</label>
                   <input {...register('name', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase italic outline-none focus:border-indigo-500 transition-all" placeholder="e.g. Raju Yadav" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Skill Class Assignment</label>
                   <select {...register('skill_type', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase italic outline-none focus:border-indigo-500 transition-all">
                      {Object.keys(SKILL_CONFIG).map(sk => <option key={sk} value={sk}>{SKILL_CONFIG[sk].label}</option>)}
                   </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Negotiated Daily Rate (₹)</label>
                   <input {...register('daily_rate', { required: true })} type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 font-mono outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="850" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">BOCW Registry Number</label>
                   <input {...register('bocw_number')} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-indigo-600 font-mono outline-none focus:border-indigo-500 transition-all" placeholder="MH48291" />
                </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Native Territory / State of Origin</label>
                 <select {...register('state_of_origin')} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase outline-none focus:border-indigo-500 transition-all">
                    {['Maharashtra', 'Bihar', 'Uttar Pradesh', 'Rajasthan', 'Madhya Pradesh', 'West Bengal', 'Odisha', 'Jharkhand'].map(s => <option key={s}>{s}</option>)}
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none">Authentication/Joining Date</label>
                 <input {...register('joined_date')} type="date" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase outline-none focus:border-indigo-500 transition-all font-mono" />
              </div>

              <div className="flex gap-4 pt-4">
                 <button type="button" className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all" onClick={() => setShowForm(false)}>Discard Protocol</button>
                 <button type="submit" disabled={createMutation.isPending} className="flex-2 py-5 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30 italic">
                    Authorize Personnel 🛡
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white p-8 border border-slate-200 rounded-[2.5rem] shadow-sm group hover:border-indigo-500/30 transition-all cursor-default relative overflow-hidden">
       <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">{label}</span>
          <Icon className={clsx("w-5 h-5 opacity-20", color)} />
       </div>
       <div className={clsx("text-4xl font-black italic tracking-tighter leading-none mt-1", color)}>{value}</div>
    </div>
  );
}
