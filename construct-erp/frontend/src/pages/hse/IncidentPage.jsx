// src/pages/hse/IncidentPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { 
  AlertTriangle, Plus, X, ShieldAlert, 
  ChevronRight, Camera, User, Calendar, 
  MapPin, Clock, Filter, FileText, CheckCircle2,
  Activity, ArrowDownRight, Tag
} from 'lucide-react';
import { incidentAPI, projectAPI, default as api } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const SEVERITY_CONFIG = {
  low:      { label: 'Minor / Low', class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  medium:   { label: 'Notice / Med',  class: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  high:     { label: 'Warning / High',   class: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  critical: { label: 'CRITICAL / LTI',  class: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

export default function IncidentPage() {
  const [showForm, setShowForm] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incidents', filterProject],
    queryFn: () => incidentAPI.list(filterProject !== 'all' ? { project_id: filterProject } : {}).then(r => r.data.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (d) => incidentAPI.create(d),
    onSuccess: () => {
      toast.success('Incident logged for forensic review');
      reset(); setShowForm(false);
      qc.invalidateQueries(['incidents']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to submit'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/incidents/${id}`),
    onSuccess: () => {
      toast.success('Incident record expunged');
      qc.invalidateQueries(['incidents']);
    },
    onError: () => toast.error('Failed to delete incident record'),
  });

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-7 h-7 text-red-500" />
           </div>
           <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Forensic Incident Hub</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Near Miss Analysis • Accident Root-Cause Tracking</p>
           </div>
        </div>
        <DataToolbar 
          data={incidents} 
          fileName="Incident_Forensic_Export" 
          onAdd={() => setShowForm(true)} 
          addLabel="Log New Incident"
        />
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Near Misses" value={incidents?.filter(i => i.incident_type === 'near_miss').length || 0} color="text-amber-500" />
          <StatCard label="Minor Injuries" value={incidents?.filter(i => i.incident_type === 'minor_injury').length || 0} color="text-blue-500" />
          <StatCard label="Critical/LTI" value={incidents?.filter(i => i.incident_type === 'major_accident').length || 0} color="text-red-500" />
          <StatCard label="Open Root-Cause Plans" value={incidents?.filter(i => i.status === 'open').length || 0} color="text-slate-400" />
      </div>

      {/* Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         
         {/* Left Side: Filtration & Stats */}
         <div className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 italic border-b border-slate-100 pb-2"><Filter size={12}/> Site Filtration</h3>
               <select 
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-tight text-slate-900 outline-none focus:border-red-500 transition-all"
                 value={filterProject}
                 onChange={e => setFilterProject(e.target.value)}
               >
                  <option value="all">Global Site Selection</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm space-y-6">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 pb-3 border-b border-slate-100 italic"><ShieldAlert size={12} className="text-red-500"/> Severity Protocol</h3>
               <div className="space-y-4">
                  {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between group cursor-default">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight group-hover:text-slate-900 transition-colors">{v.label}</span>
                       <div className={clsx("w-2.5 h-2.5 rounded-full border border-white shadow-sm", v.class.split(' ')[0].replace('bg-', 'bg-').replace('/10', ''))} />
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Main Log: The Forensic Inbox */}
         <div className="lg:col-span-9 space-y-6">
            {isLoading ? (
               <div className="skeleton h-48 w-full rounded-[2.5rem]" />
            ) : incidents?.map(inc => {
              const cfg = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.medium;
              return (
                <div key={inc.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-10 group hover:border-red-500/30 transition-all shadow-sm space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                   <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                      <div className="space-y-5 flex-1">
                         <div className="flex items-center gap-3">
                            <span className={clsx("px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] border shadow-sm", cfg.class)}>
                               {cfg.label}
                            </span>
                            <span className="text-[10px] text-slate-900 font-black uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-inner italic">
                               {inc.incident_type?.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-black tracking-widest leading-none bg-white border border-slate-100 px-3 py-1.5 rounded-xl">{dayjs(inc.incident_date).format('DD MMM YYYY')}</span>
                         </div>
                         <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight leading-tight group-hover:text-red-600 transition-colors">{inc.description}</h2>
                         <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                            <div className="flex items-center gap-2"><MapPin size={14} className="text-red-500" /> {inc.location} • <span className="text-slate-400">{inc.project_name}</span></div>
                            <div className="flex items-center gap-2 font-mono"><Clock size={14} className="text-slate-400" /> {inc.incident_time || 'UNIDENTIFIED'}</div>
                         </div>
                      </div>
                      <div className="text-right shrink-0">
                         <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 leading-none">Internal Report ID</div>
                         <div className="text-lg font-black text-slate-900 font-mono tracking-tighter uppercase italic bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 shadow-inner">{inc.incident_number}</div>
                         <div className={clsx("mt-5 text-[9px] font-black uppercase tracking-widest p-2 px-5 rounded-2xl border w-fit ml-auto shadow-sm", inc.status === 'open' ? 'border-red-200 text-red-600 bg-red-50/50' : 'border-emerald-200 text-emerald-600 bg-emerald-50/50')}>
                            {inc.status === 'open' ? 'Investigation Active' : 'Case Finalized'}
                         </div>
                      </div>
                   </div>

                   {/* Forensic Details Section */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-slate-100">
                      <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 space-y-3 shadow-inner">
                         <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 italic leading-none"><ArrowDownRight size={14} className="text-red-500" /> Primary Root Cause</div>
                         <p className="text-xs font-bold text-slate-600 italic leading-relaxed">"{inc.root_cause || 'Awaiting deep-dive investigation report from site safety segments...'}"</p>
                      </div>
                      <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 space-y-3 shadow-inner">
                         <div className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2 italic leading-none"><CheckCircle2 size={14}/> Corrective Action Protocol</div>
                         <p className="text-xs font-bold text-slate-600 italic leading-relaxed">"{inc.immediate_action || 'Safe zone established via primary barricades. Mandatory TBT conducted.'}"</p>
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-6">
                      <div className="flex items-center gap-8 text-[9px] font-black text-slate-500 uppercase italic px-2">
                         <div className="flex items-center gap-2.5"><User size={14} className="text-slate-400" /> Reported by: <span className="text-blue-600 border-b border-blue-100">{inc.reported_by_name}</span></div>
                         <div className={clsx("flex items-center gap-2.5", inc.lost_time_days > 0 ? "text-red-600" : "text-slate-400")}><Activity size={14}/> Lost Business Days: <span className="font-mono">{inc.lost_time_days || 0}</span></div>
                      </div>
                      <div className="flex gap-2.5">
                         <button className="w-10 h-10 flex items-center justify-center bg-white text-slate-400 hover:text-red-600 border border-slate-200 shadow-sm rounded-xl transition-all"><Camera className="w-4 h-4" /></button>
                         <button className="w-10 h-10 flex items-center justify-center bg-white text-slate-400 hover:text-red-600 border border-slate-200 shadow-sm rounded-xl transition-all"><FileText className="w-4 h-4" /></button>
                         <button className="px-6 py-2.5 bg-slate-900 font-black text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 italic">Audit Dossier</button>
                         <div className="ml-2" onClick={e => e.stopPropagation()}>
                           <TableActions disableEdit onDelete={() => deleteMut.mutate(inc.id)} />
                         </div>
                      </div>
                   </div>
                </div>
              );
            })}
         </div>
      </div>

      {/* Incident Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-sm w-full max-w-3xl rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-600/20"><AlertTriangle size={24} /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic leading-none mb-1">Incident Registry Protocol</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">High-Risk Event Logging & Forensic Capture</p>
                  </div>
               </div>
               <button onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50 transition-all"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit(createMut.mutate)} className="p-10 space-y-8 overflow-y-auto max-h-[75vh]">
               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none">Target Project Site</label>
                        <select {...register('project_id', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase outline-none focus:border-red-500 transition-all">
                           <option value="">Select Project Target Site...</option>
                           {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none">Incident Category</label>
                        <select {...register('incident_type', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase outline-none focus:border-red-500 transition-all">
                           <option value="near_miss">Near Miss (Safe but risk noticed)</option>
                           <option value="minor_injury">Minor Injury (First-Aid required)</option>
                           <option value="major_accident">Major Accident (Hospitalization)</option>
                           <option value="fatality">Fatality (Full Loss of Life)</option>
                        </select>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none">Severity Protocol</label>
                        <select {...register('severity', { required: true })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase outline-none focus:border-red-500 transition-all">
                           <option value="low">Category 1: Low Impact</option>
                           <option value="medium">Category 2: Medium Concern</option>
                           <option value="high">Category 3: High Risk Event</option>
                           <option value="critical">Category 4: Critical / LTI</option>
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none ml-1">Incident Date</label>
                           <input type="date" {...register('incident_date', { required: true })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-900 uppercase outline-none focus:border-red-500 transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none ml-1">Event Time</label>
                           <input type="time" {...register('incident_time')} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-900 outline-none focus:border-red-500 transition-all" />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Precise Location Coordinate</label>
                  <div className="relative">
                     <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                     <input {...register('location', { required: true })} className="w-full p-5 pl-12 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-xs font-bold text-slate-900 uppercase outline-none focus:border-red-500 shadow-inner transition-all italic" placeholder="e.g. BLOCK-B, 14TH FLOOR, EXTERIOR SCAFFOLD FACE" />
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Forensic Narrative (Chronology)</label>
                  <textarea {...register('description', { required: true })} rows={4} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-xs italic font-bold text-slate-900 outline-none focus:border-red-500 shadow-inner resize-none transition-all" placeholder="Provide a detailed, chronological account of high-risk events..." />
               </div>

               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Immediate Mitigation Taken</label>
                     <input {...register('immediate_action')} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-xs font-bold text-slate-900 uppercase outline-none focus:border-red-500 shadow-inner transition-all italic" placeholder="e.g. PRIMARY BARRICADES INSTALLED" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 leading-none italic">Actual Days Lost (LTI Protocol)</label>
                     <input type="number" {...register('lost_time_days')} defaultValue={0} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-black text-red-600 font-mono outline-none focus:border-red-500 shadow-inner transition-all" />
                  </div>
               </div>

               <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-6 italic leading-relaxed shadow-2xl shadow-slate-900/30">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0"><Info size={24} className="text-blue-400" /></div>
                  <span>Submission triggers an automated high-severity alert to Corporate HSE segments for mandatory root-cause analysis within 12 standard business hours.</span>
               </div>

               <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Discard Protocol</button>
                  <button type="submit" disabled={createMut.isPending} className="flex-2 py-5 bg-red-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-600/30 italic flex items-center justify-center gap-3">
                     Authorize Registry Submission <ChevronRight size={18} />
                  </button>
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
        <div className="bg-white p-8 border border-slate-200 rounded-[2.5rem] shadow-sm group hover:border-red-500/30 transition-all cursor-default relative overflow-hidden">
           <div className={clsx("absolute top-0 left-0 w-1.5 h-full", color.replace('text-', 'bg-'))} />
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 leading-none italic">{label}</span>
           <div className={clsx("text-4xl font-black italic tracking-tighter leading-none font-mono", color)}>{value}</div>
        </div>
  );
}
