import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowLeft, ClipboardList } from 'lucide-react';
import api, { projectAPI } from '../../api/client';
import dayjs from 'dayjs';

const WEATHER_OPTIONS = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Rainy', 'Windy'];

const emptyActivity = () => ({ description: '', location: '', qty: '', unit: '', remarks: '' });
const emptyWorker = () => ({ trade: '', contractor: '', count: '', ot_hours: 0 });
const emptyMaterial = () => ({ material_name: '', quantity: '', unit: '', remarks: '' });

export default function DPRCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    project_id: '',
    report_date: dayjs().format('YYYY-MM-DD'),
    weather: 'Sunny',
    site_conditions: '',
    prepared_by: '',
  });
  const [activities, setActivities] = useState([emptyActivity()]);
  const [workers, setWorkers] = useState([emptyWorker()]);
  const [materials, setMaterials] = useState([emptyMaterial()]);
  const [issues, setIssues] = useState('');
  const [nextDayPlan, setNextDayPlan] = useState('');

  const { data: projects = [] } = useQuery({ queryKey: ['projects-simple'], queryFn: () => projectAPI.list() });

  const createMut = useMutation({
    mutationFn: (payload) => api.post('/dpr', payload),
    onSuccess: () => { toast.success('DPR submitted'); navigate('/site/dpr'); },
    onError: () => toast.error('Failed to submit DPR'),
  });

  const updateActivity = (i, field, val) => setActivities(a => a.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const updateWorker = (i, field, val) => setWorkers(w => w.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const updateMaterial = (i, field, val) => setMaterials(m => m.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const totalWorkers = workers.reduce((s, w) => s + (Number(w.count) || 0), 0);

  const handleSubmit = (status = 'submitted') => {
    if (!form.project_id) return toast.error('Select a project');
    createMut.mutate({ ...form, status, activities, workers, materials, issues_faced: issues, next_day_plan: nextDayPlan });
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
            New Daily Progress Report
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Fill site activity, manpower, material consumption</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
        <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic mb-6 border-b border-slate-100 pb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-indigo-500" /> Report Details</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Project Target *</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
              <option value="">Select organizational project target</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Report Date *</label>
            <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-xs font-bold text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm" value={form.report_date} onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Atmospheric Info</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic" value={form.weather} onChange={e => setForm(f => ({ ...f, weather: e.target.value }))}>
              {WEATHER_OPTIONS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Prepared By Engineer</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm italic placeholder:normal-case placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-400" placeholder="Name & designation" value={form.prepared_by} onChange={e => setForm(f => ({ ...f, prepared_by: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Site Conditions / Notes</label>
            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-4 px-5 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 transition-all shadow-sm" rows={2} placeholder="Access issues, safety observations, weather impacts..." value={form.site_conditions} onChange={e => setForm(f => ({ ...f, site_conditions: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Work Activities */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
          <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">Work Activities</h2>
          <button onClick={() => setActivities(a => [...a, emptyActivity()])} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors italic">
            <Plus size={12} /> Add Activity Matrix
          </button>
        </div>
        <div className="space-y-4">
          {activities.map((a, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 items-start bg-slate-50/50 p-3 rounded-2xl border border-slate-100 relative group">
              <div className="col-span-12 md:col-span-5">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Description Profile</label>}
                <input className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="e.g. RCC slab casting Block B" value={a.description} onChange={e => updateActivity(i, 'description', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-2">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Location Zone</label>}
                <input className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="Zone/Floor" value={a.location} onChange={e => updateActivity(i, 'location', e.target.value)} />
              </div>
              <div className="col-span-3 md:col-span-2">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Qty Executed</label>}
                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="0" value={a.qty} onChange={e => updateActivity(i, 'qty', e.target.value)} />
              </div>
              <div className="col-span-3 md:col-span-2">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Measurement</label>}
                <input className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="Cum/Sqm..." value={a.unit} onChange={e => updateActivity(i, 'unit', e.target.value)} />
              </div>
              <div className="col-span-12 md:col-span-1 flex items-center justify-center md:items-end md:pb-1">
                {activities.length > 1 && (
                  <button onClick={() => setActivities(a => a.filter((_, idx) => idx !== i))} className="w-full md:w-10 h-10 flex items-center justify-center text-red-400 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manpower */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-4">
             <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">Labor Logistics</h2>
             <div className="bg-slate-100 font-mono font-black text-slate-600 text-xs px-3 py-1 rounded-lg border border-slate-200">Total Deploy: {totalWorkers}</div>
          </div>
          <button onClick={() => setWorkers(w => [...w, emptyWorker()])} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors italic">
            <Plus size={12} /> Add Labor Block
          </button>
        </div>
        <div className="space-y-4">
          {workers.map((w, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 items-start bg-slate-50/50 p-3 rounded-2xl border border-slate-100 relative group">
              <div className="col-span-12 md:col-span-3">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Trade Category</label>}
                <input className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="Mason, Carpenter..." value={w.trade} onChange={e => updateWorker(i, 'trade', e.target.value)} />
              </div>
              <div className="col-span-12 md:col-span-4">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Labor Supply Contractor</label>}
                <input className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all italic" placeholder="Contractor identity" value={w.contractor} onChange={e => updateWorker(i, 'contractor', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-2">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Head Count</label>}
                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="0" value={w.count} onChange={e => updateWorker(i, 'count', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-2">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Overtime Hrs (OT)</label>}
                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-mono font-black text-emerald-600 outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="0" value={w.ot_hours} onChange={e => updateWorker(i, 'ot_hours', e.target.value)} />
              </div>
              <div className="col-span-12 md:col-span-1 flex items-center justify-center md:items-end md:pb-1">
                {workers.length > 1 && (
                  <button onClick={() => setWorkers(w => w.filter((_, idx) => idx !== i))} className="w-full md:w-10 h-10 flex items-center justify-center text-red-400 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Materials */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
          <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">Materials Consumed</h2>
          <button onClick={() => setMaterials(m => [...m, emptyMaterial()])} className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors italic">
            <Plus size={12} /> Add Material Line
          </button>
        </div>
        <div className="space-y-4">
          {materials.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 items-start bg-slate-50/50 p-3 rounded-2xl border border-slate-100 relative group">
              <div className="col-span-12 md:col-span-5">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Material Name</label>}
                <input className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="Cement, Steel, specific aggregate..." value={m.material_name} onChange={e => updateMaterial(i, 'material_name', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-3">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Gross Quantity Consumed</label>}
                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="0" value={m.quantity} onChange={e => updateMaterial(i, 'quantity', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-3">
                {i === 0 && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic block mb-2 px-1">Measurement Unit</label>}
                <input className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="Bags/MT..." value={m.unit} onChange={e => updateMaterial(i, 'unit', e.target.value)} />
              </div>
              <div className="col-span-12 md:col-span-1 flex items-center justify-center md:items-end md:pb-1">
                {materials.length > 1 && (
                  <button onClick={() => setMaterials(m => m.filter((_, idx) => idx !== i))} className="w-full md:w-10 h-10 flex items-center justify-center text-red-400 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issues & Next Day Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-red-50/40 border border-red-100 rounded-[2.5rem] p-8 shadow-sm">
          <h2 className="text-[11px] font-black text-red-600 uppercase tracking-widest italic mb-4">Issues / Problems Faced</h2>
          <textarea className="w-full bg-white border border-red-200 rounded-[1.5rem] py-4 px-5 text-sm font-bold text-slate-900 outline-none focus:border-red-400 shadow-sm transition-all" rows={5} placeholder="Labour shortage, material delay, equipment breakdown, safety incident..." value={issues} onChange={e => setIssues(e.target.value)} />
        </div>
        <div className="bg-indigo-50/40 border border-indigo-100 rounded-[2.5rem] p-8 shadow-sm">
          <h2 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest italic mb-4">Next Day Agenda</h2>
          <textarea className="w-full bg-white border border-indigo-200 rounded-[1.5rem] py-4 px-5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all" rows={5} placeholder="Planned operational activities for tomorrow..." value={nextDayPlan} onChange={e => setNextDayPlan(e.target.value)} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-8 pt-4">
        <button className="px-6 py-4 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all shadow-sm italic" onClick={() => navigate(-1)}>Discard Record</button>
        <button className="px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all shadow-sm italic shadow-slate-900/20" onClick={() => handleSubmit('draft')} disabled={createMut.isPending}>
          Archive as Template/Draft
        </button>
        <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30 italic" onClick={() => handleSubmit('submitted')} disabled={createMut.isPending}>
          {createMut.isPending ? 'Committing...' : 'Commit DPR'}
        </button>
      </div>
    </div>
  );
}
