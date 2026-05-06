// src/pages/quality/SubmittalsPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ClipboardCheck, Plus, X, Search, Eye,
  Download, RefreshCw, CheckCircle2, Clock,
  AlertCircle, FileText, Upload, ChevronRight,
  Send, RotateCcw, XCircle, Calendar, User
} from 'lucide-react';
import { qualityAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';

const SUBMITTAL_TYPES = [
  'Shop Drawing', 'Material Sample', 'Method Statement',
  'Material Submittal', 'Product Data', 'Inspection Test Plan',
  'Quality Assurance Plan', 'Work Procedure',
];

const STATUS_CONFIG = {
  'Draft':             { cls: 'bg-slate-100 text-slate-600 border-slate-200',   icon: FileText },
  'Submitted':         { cls: 'bg-blue-50 text-blue-700 border-blue-200',        icon: Send },
  'Under Review':      { cls: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Clock },
  'Approved':          { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  'Approved with Comments': { cls: 'bg-teal-50 text-teal-700 border-teal-200',  icon: CheckCircle2 },
  'Rejected':          { cls: 'bg-red-50 text-red-700 border-red-200',           icon: XCircle },
  'Revise & Resubmit': { cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: RotateCcw },
};

const TABS = ['All', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Revise & Resubmit'];

export default function SubmittalsPage() {
  const [showForm, setShowForm]     = useState(false);
  const [activeTab, setActiveTab]   = useState('All');
  const [search, setSearch]         = useState('');
  const [selectedSub, setSelectedSub] = useState(null);

  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  /* ── Data ─────────────────────────────────────────────────────── */
  const { data: submittals = [], isLoading } = useQuery({
    queryKey: ['quality-submittals'],
    queryFn: () => qualityAPI.listSubmittals().then(r => r.data?.data || r.data || []),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => {
      const d = r?.data;
      return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
    }).catch(() => []),
  });

  /* ── Mutations ─────────────────────────────────────────────────── */
  const createMut = useMutation({
    mutationFn: (d) => qualityAPI.createSubmittal(d),
    onSuccess: () => {
      toast.success('Submittal logged successfully');
      reset(); setShowForm(false);
      qc.invalidateQueries(['quality-submittals']);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create submittal'),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status, remarks }) => qualityAPI.updateSubmittalStatus(id, { status, remarks }),
    onSuccess: () => {
      toast.success('Submittal status updated');
      setSelectedSub(null);
      qc.invalidateQueries(['quality-submittals']);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update status'),
  });

  /* ── Filter ────────────────────────────────────────────────────── */
  const filtered = submittals.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.submittal_number?.toLowerCase().includes(q) || s.title?.toLowerCase().includes(q) || s.spec_section?.toLowerCase().includes(q);
    const matchTab = activeTab === 'All' || s.status === activeTab;
    return matchSearch && matchTab;
  });

  /* ── Stats ─────────────────────────────────────────────────────── */
  const countByStatus = (s) => submittals.filter(x => x.status === s).length;

  return (
    <div className="bg-[#f4f6f9] min-h-full p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Submittals Log</h1>
            <p className="text-xs text-slate-500">Shop drawings, material samples, method statements</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Submittal
        </button>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',          value: submittals.length,             color: 'slate' },
          { label: 'Pending Review', value: countByStatus('Under Review'), color: 'amber' },
          { label: 'Approved',       value: countByStatus('Approved'),     color: 'emerald' },
          { label: 'Rejected',       value: countByStatus('Rejected'),     color: 'red' },
          { label: 'Revise & Resubmit', value: countByStatus('Revise & Resubmit'), color: 'orange' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#e2e6ec] px-4 py-3">
            <div className={`text-xl font-bold text-${color}-600`}>{value}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                activeTab === tab
                  ? 'bg-teal-600 text-white'
                  : 'bg-[#f8f9fc] text-slate-600 hover:bg-slate-100 border border-[#e2e6ec]'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search submittals..."
            className="pl-9 pr-3 py-2 bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-300 w-56"
          />
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] overflow-hidden">
        <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Submittal Register</span>
          <span className="text-xs text-slate-400">{filtered.length} records</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <ClipboardCheck className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No submittals found</p>
            <p className="text-xs">Use "New Submittal" to log your first entry</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fc] border-b border-[#e2e6ec]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Submittal No.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Title & Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Spec Section</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Submitted By</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(sub => {
                  const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG['Draft'];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-teal-600 font-bold text-xs font-mono">{sub.submittal_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 text-sm">{sub.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-semibold uppercase tracking-wide">{sub.submittal_type}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{sub.spec_section || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <User className="w-3 h-3 text-slate-400" />
                          {sub.submitted_by || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {sub.submitted_date ? dayjs(sub.submitted_date).format('DD MMM YYYY') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('flex items-center gap-1 w-fit text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border', cfg.cls)}>
                          <StatusIcon className="w-3 h-3" />
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedSub(sub)}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                          >
                            Review <ChevronRight className="w-3 h-3" />
                          </button>
                          <button className="bg-white border border-[#e2e6ec] text-slate-700 rounded-lg p-2 hover:bg-slate-50 transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Submittal Modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">
            <div className="px-6 py-4 bg-teal-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white leading-none">New Submittal</h2>
                  <p className="text-xs text-teal-200 mt-0.5">Log a new submittal for review</p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); reset(); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit(createMut.mutate)} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Submittal Number *</label>
                  <input {...register('submittal_number', { required: true })} placeholder="e.g. SUB-001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400 font-mono" />
                  {errors.submittal_number && <p className="text-xs text-red-500 mt-1">Required</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Submittal Type *</label>
                  <select {...register('submittal_type', { required: true })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400">
                    <option value="">Select type...</option>
                    {SUBMITTAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Title / Description *</label>
                <input {...register('title', { required: true })} placeholder="e.g. Rebar Shop Drawing - Block A Foundation" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Spec Section</label>
                  <input {...register('spec_section')} placeholder="e.g. 03 20 00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
                  <select {...register('project_id')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400">
                    <option value="">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Submitted By *</label>
                  <input {...register('submitted_by', { required: true })} placeholder="Name / Company" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date of Submission *</label>
                  <input type="date" {...register('submitted_date', { required: true })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Review Required By</label>
                  <input type="date" {...register('due_date')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Initial Status</label>
                  <select {...register('status')} defaultValue="Submitted" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400">
                    {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Remarks</label>
                <textarea {...register('remarks')} rows={2} placeholder="Additional notes or scope clarification..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowForm(false); reset(); }} className="flex-1 bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center justify-center gap-2 disabled:opacity-50">
                  {createMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Review Modal ────────────────────────────────────────────── */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-teal-600 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">{selectedSub.submittal_number}</h2>
                <p className="text-xs text-teal-200 mt-0.5">{selectedSub.title}</p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-700 text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Type', selectedSub.submittal_type],
                  ['Spec Section', selectedSub.spec_section || '—'],
                  ['Submitted By', selectedSub.submitted_by],
                  ['Date', selectedSub.submitted_date ? dayjs(selectedSub.submitted_date).format('DD MMM YYYY') : '—'],
                  ['Due Date', selectedSub.due_date ? dayjs(selectedSub.due_date).format('DD MMM YYYY') : '—'],
                  ['Current Status', selectedSub.status],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{k}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Update Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Approved', 'Approved with Comments', 'Rejected', 'Revise & Resubmit'].map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatusMut.mutate({ id: selectedSub.id, status: s })}
                        disabled={updateStatusMut.isPending}
                        className={clsx('text-xs font-bold px-3 py-2.5 rounded-lg border transition-all hover:scale-[1.02] disabled:opacity-50', cfg.cls)}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={() => setSelectedSub(null)} className="w-full bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2.5">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
