// src/pages/common/MeetingsPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Users, Plus, X, Search, Eye, RefreshCw,
  Calendar, Clock, MapPin, Trash2, ChevronDown,
  CheckCircle2, AlertCircle, FileText, Printer
} from 'lucide-react';
import { meetingsAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';

const MEETING_TYPES = ['Site Progress Meeting', 'Design Review', 'Safety Toolbox Talk', 'Client Meeting', 'Subcontractor Meeting', 'Internal Coordination', 'QA/QC Review', 'Planning Meeting'];
const STATUS_CLS = {
  'Scheduled': 'bg-blue-50 text-blue-700 border-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cancelled': 'bg-red-50 text-red-700 border-red-200',
};

export default function MeetingsPage() {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const qc = useQueryClient();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    defaultValues: { attendees: [{ name: '', role: '' }], action_items: [{ description: '', owner: '', due_date: '' }] }
  });
  const { fields: attendeeFields, append: addAttendee, remove: removeAttendee } = useFieldArray({ control, name: 'attendees' });
  const { fields: actionFields, append: addAction, remove: removeAction } = useFieldArray({ control, name: 'action_items' });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => meetingsAPI.list().then(r => r.data?.data || r.data || []),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => { const d = r?.data; return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []; }).catch(() => []),
  });

  const createMut = useMutation({
    mutationFn: (d) => meetingsAPI.create(d),
    onSuccess: () => { toast.success('Meeting minutes saved'); reset(); setShowForm(false); qc.invalidateQueries(['meetings']); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save meeting'),
  });

  const closeMut = useMutation({
    mutationFn: (id) => meetingsAPI.close(id),
    onSuccess: () => { toast.success('Meeting closed'); setSelected(null); qc.invalidateQueries(['meetings']); },
  });

  const filtered = meetings.filter(m => {
    const q = search.toLowerCase();
    const ms = !q || m.title?.toLowerCase().includes(q) || m.meeting_number?.toLowerCase().includes(q);
    const mst = filterStatus === 'all' || m.status === filterStatus;
    return ms && mst;
  });

  return (
    <div className="bg-[#f4f6f9] min-h-full p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Meeting Minutes</h1>
            <p className="text-xs text-slate-500">Site meetings, action items & attendance records</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> New Meeting
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Meetings', value: meetings.length, color: 'violet' },
          { label: 'Scheduled', value: meetings.filter(m => m.status === 'Scheduled').length, color: 'blue' },
          { label: 'Completed', value: meetings.filter(m => m.status === 'Completed').length, color: 'emerald' },
          { label: 'Open Actions', value: meetings.reduce((acc, m) => acc + (m.action_items?.filter(a => !a.completed)?.length || 0), 0), color: 'amber' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#e2e6ec] px-4 py-3">
            <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search meetings..." className="w-full pl-9 pr-3 py-2 bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-300" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-[#e2e6ec] rounded-lg px-3 py-2 text-sm text-slate-700 bg-[#f8f9fc] outline-none">
          <option value="all">All Statuses</option>
          {Object.keys(STATUS_CLS).map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400 font-semibold ml-auto">{filtered.length} meetings</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] overflow-hidden">
        <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-5 py-3">
          <span className="text-sm font-semibold text-slate-700">Meeting Register</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <Users className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No meetings recorded</p>
            <p className="text-xs">Click "New Meeting" to log your first meeting minutes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fc] border-b border-[#e2e6ec]">
                <tr>
                  {['Meeting No.', 'Title & Type', 'Project', 'Date & Venue', 'Attendees', 'Actions Open', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-violet-600 font-bold text-xs font-mono">{m.meeting_number || `MTG-${m.id}`}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 text-sm">{m.title}</div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{m.meeting_type}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.project_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-slate-600"><Calendar className="w-3 h-3 text-slate-400" />{m.meeting_date ? dayjs(m.meeting_date).format('DD MMM YYYY') : '—'}</div>
                      {m.venue && <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><MapPin className="w-3 h-3" />{m.venue}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.attendees?.length || 0} attendees</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', m.action_items?.filter(a => !a.completed).length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                        {m.action_items?.filter(a => !a.completed).length || 0} open
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border', STATUS_CLS[m.status] || STATUS_CLS['Scheduled'])}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(m)} className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Meeting Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[95vh]">
            <div className="px-6 py-4 bg-violet-600 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Record Meeting Minutes</h2>
                  <p className="text-xs text-violet-200 mt-0.5">Log attendance, agenda & action items</p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); reset(); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-700 hover:bg-violet-800 text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit(createMut.mutate)} className="p-6 space-y-5 overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Meeting Number</label>
                  <input {...register('meeting_number')} placeholder="e.g. MTG-001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Meeting Type *</label>
                  <select {...register('meeting_type', { required: true })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400">
                    <option value="">Select type...</option>
                    {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Meeting Title / Subject *</label>
                <input {...register('title', { required: true })} placeholder="e.g. Weekly Site Progress Meeting - Week 18" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
                  <input type="date" {...register('meeting_date', { required: true })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Time</label>
                  <input type="time" {...register('meeting_time')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
                  <select {...register('project_id')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400">
                    <option value="">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Venue / Location</label>
                <input {...register('venue')} placeholder="e.g. Site Office, Block A" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Minutes / Key Discussions</label>
                <textarea {...register('minutes')} rows={3} placeholder="Summarize discussions, decisions, and key points..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>

              {/* Attendees */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Attendees</label>
                  <button type="button" onClick={() => addAttendee({ name: '', role: '' })} className="text-xs text-violet-600 font-semibold flex items-center gap-1 hover:text-violet-800">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {attendeeFields.map((f, i) => (
                    <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input {...register(`attendees.${i}.name`)} placeholder="Full Name" className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                      <input {...register(`attendees.${i}.role`)} placeholder="Role / Company" className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                      <button type="button" onClick={() => removeAttendee(i)} className="w-8 h-9 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Action Items</label>
                  <button type="button" onClick={() => addAction({ description: '', owner: '', due_date: '' })} className="text-xs text-violet-600 font-semibold flex items-center gap-1 hover:text-violet-800">
                    <Plus className="w-3 h-3" /> Add Action
                  </button>
                </div>
                <div className="space-y-2">
                  {actionFields.map((f, i) => (
                    <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2">
                      <input {...register(`action_items.${i}.description`)} placeholder="Action description" className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                      <input {...register(`action_items.${i}.owner`)} placeholder="Owner" className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                      <input type="date" {...register(`action_items.${i}.due_date`)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
                      <button type="button" onClick={() => removeAction(i)} className="w-8 h-9 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowForm(false); reset(); }} className="flex-1 bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center justify-center gap-2 disabled:opacity-50">
                  {createMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Save Minutes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-violet-600 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">{selected.meeting_number || 'Meeting'}</h2>
                <p className="text-xs text-violet-200 mt-0.5">{selected.title}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-700 text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[['Type', selected.meeting_type], ['Date', selected.meeting_date ? dayjs(selected.meeting_date).format('DD MMM YYYY') : '—'], ['Venue', selected.venue || '—'], ['Status', selected.status], ['Project', selected.project_name || '—'], ['Time', selected.meeting_time || '—']].map(([k, v]) => (
                  <div key={k} className="bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{k}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              {selected.minutes && (
                <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">Minutes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.minutes}</p>
                </div>
              )}
              {selected.attendees?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attendees ({selected.attendees.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.attendees.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">{(a.name || '?')[0]}</div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{a.name}</p>
                          <p className="text-[10px] text-slate-500">{a.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.action_items?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Action Items</p>
                  <div className="space-y-2">
                    {selected.action_items.map((a, i) => (
                      <div key={i} className={clsx('flex items-start gap-3 border rounded-lg px-3 py-2', a.completed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
                        {a.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{a.description}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Owner: <strong>{a.owner}</strong> · Due: {a.due_date ? dayjs(a.due_date).format('DD MMM YYYY') : 'Not set'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                {selected.status !== 'Completed' && (
                  <button onClick={() => closeMut.mutate(selected.id)} disabled={closeMut.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Mark Complete
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="flex-1 bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2.5">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
