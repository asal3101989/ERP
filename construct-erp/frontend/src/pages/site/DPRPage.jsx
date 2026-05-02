import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Camera, ChevronRight, Users, ClipboardList } from 'lucide-react';
import api, { projectAPI } from '../../api/client';
import dayjs from 'dayjs';
import { clsx } from 'clsx';

const STATUS_BADGE = { 
  draft: 'bg-slate-100 text-slate-500 border border-slate-200', 
  submitted: 'bg-amber-50 text-amber-600 border border-amber-200', 
  approved: 'bg-emerald-50 text-emerald-600 border border-emerald-200', 
  rejected: 'bg-red-50 text-red-600 border border-red-200' 
};
const WEATHER_ICON = { Sunny: '☀️', Cloudy: '☁️', Rainy: '🌧️', 'Partly Cloudy': '⛅', Windy: '💨', 'Light Rain': '🌦️' };

export default function DPRPage() {
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState(dayjs().format('YYYY-MM'));

  const { data: rawDPRs } = useQuery({ queryKey: ['dprs', filterProject, filterMonth], queryFn: () => api.get('/dpr', { params: { project_id: filterProject !== 'all' ? filterProject : undefined, month: filterMonth } }).then(r => r.data),  });
  const { data: projects = [] } = useQuery({ queryKey: ['projects-simple'], queryFn: () => projectAPI.list() });

  const dprs = (rawDPRs ?? []).map(d => ({ ...d, project_name: d.project_name ?? d.project ?? '—' }));
  const filtered = dprs.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
             <ClipboardList className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Daily Progress Reports</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Site-wise DPR — activities, manpower, materials, photos</p>
          </div>
        </div>
        <Link to="/site/dpr/new" className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2 italic">
          <Plus size={16} /> New DPR
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter italic">{filtered.length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">DPRs This Month</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-3xl font-black text-emerald-600 font-mono tracking-tighter italic">{filtered.filter(d => d.status === 'approved').length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Approved</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-3xl font-black text-amber-500 font-mono tracking-tighter italic">{filtered.filter(d => d.status === 'submitted').length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Pending Review</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-3xl font-black text-indigo-600 font-mono tracking-tighter italic">{filtered.reduce((s, d) => s + (d.total_workers || 0), 0)}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Total Workers Today</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-4 flex flex-col md:flex-row gap-4 shadow-sm">
        <input type="month" className="w-full md:w-48 bg-slate-50 border border-slate-200 py-3.5 px-6 rounded-2xl text-[10px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm italic" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 py-3.5 px-6 rounded-2xl text-[10px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic min-w-[200px]">
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full md:w-48 bg-slate-50 border border-slate-200 py-3.5 px-6 rounded-2xl text-[10px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {filtered.map(d => (
          <div key={d.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-6 flex flex-col md:flex-row md:items-center gap-6 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group shadow-sm">
            <div className="text-4xl w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">{WEATHER_ICON[d.weather] || '🌤️'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg uppercase tracking-widest">{d.dpr_number}</span>
                <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest italic shadow-sm", STATUS_BADGE[d.status] || 'bg-slate-100 text-slate-500 border border-slate-200')}>{d.status}</span>
              </div>
              <div className="text-slate-900 font-black uppercase text-base tracking-tight italic mb-1 truncate">{d.project_name}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex flex-wrap gap-2 items-center">
                 <span className="text-slate-900">{dayjs(d.report_date).format('dddd, DD MMM YYYY')}</span>
                 <span className="text-slate-300">•</span>
                 <span>{d.weather}</span>
                 <span className="text-slate-300">•</span>
                 <span>Prep: {d.prepared_by}</span>
              </div>
            </div>
            <div className="flex items-center gap-8 text-center bg-slate-50 border border-slate-100 rounded-[2rem] px-8 py-4">
              <div className="flex flex-col items-center gap-1">
                <div className="text-slate-900 font-black font-mono text-xl tracking-tighter italic flex items-center gap-1"><Users size={16} className="text-indigo-400" />{d.total_workers}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Workers</div>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-slate-900 font-black font-mono text-xl tracking-tighter italic">{d.activities_count}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Activities</div>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-slate-900 font-black font-mono text-xl tracking-tighter italic flex items-center gap-1"><Camera size={16} className="text-slate-400" />{d.photos_count}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Photos</div>
              </div>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all">
               <ChevronRight size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl mx-auto flex items-center justify-center mb-6"><ClipboardList className="w-10 h-10 text-slate-300" /></div>
            <p className="font-black text-slate-400 uppercase tracking-[0.3em] italic mb-6">No DPRs found for selected timeline</p>
            <Link to="/site/dpr/new" className="px-6 py-3 bg-white border border-indigo-200 text-indigo-600 hover:text-white hover:bg-indigo-600 hover:border-transparent font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-sm inline-flex items-center gap-2 italic"><Plus size={14} /> Create First Operational DPR</Link>
          </div>
        )}
      </div>
    </div>
  );
}
