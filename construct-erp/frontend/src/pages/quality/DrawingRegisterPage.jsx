// src/pages/quality/DrawingRegisterPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  FileText, Plus, X, Search, Filter,
  Download, Eye, Upload, ChevronDown,
  AlertCircle, CheckCircle2, Clock, RefreshCw,
  Layers, Tag, FolderOpen, BarChart3, Printer,
  ExternalLink, History
} from 'lucide-react';
import { qualityAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';

const DISCIPLINES = ['Architectural', 'Structural', 'MEP - Mechanical', 'MEP - Electrical', 'MEP - Plumbing', 'Civil', 'Landscape', 'Fire Fighting', 'HVAC'];
const STATUSES = ['Issued for Construction', 'Issued for Review', 'Superseded', 'Voided', 'Preliminary'];
const STATUS_STYLE = {
  'Issued for Construction': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Issued for Review':       'bg-blue-50 text-blue-700 border-blue-200',
  'Superseded':              'bg-amber-50 text-amberald-700 border-amber-200',
  'Voided':                  'bg-red-50 text-red-700 border-red-200',
  'Preliminary':             'bg-slate-100 text-slate-600 border-slate-200',
};

export default function DrawingRegisterPage() {
  const [showForm, setShowForm]     = useState(false);
  const [search, setSearch]         = useState('');
  const [filterDisc, setFilterDisc] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDrawing, setSelectedDrawing] = useState(null);

  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  /* ── Data ─────────────────────────────────────────────────────── */
  const { data: drawings = [], isLoading } = useQuery({
    queryKey: ['quality-drawings'],
    queryFn: () => qualityAPI.listDrawings().then(r => r.data?.data || r.data || []),
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
    mutationFn: (d) => qualityAPI.createDrawing(d),
    onSuccess: () => {
      toast.success('Drawing registered successfully');
      reset();
      setShowForm(false);
      qc.invalidateQueries(['quality-drawings']);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to register drawing'),
  });

  /* ── Filtering ─────────────────────────────────────────────────── */
  const filtered = drawings.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.drawing_number?.toLowerCase().includes(q) || d.title?.toLowerCase().includes(q);
    const matchDisc   = filterDisc   === 'all' || d.discipline   === filterDisc;
    const matchStatus = filterStatus === 'all' || d.status       === filterStatus;
    return matchSearch && matchDisc && matchStatus;
  });

  /* ── Stats ─────────────────────────────────────────────────────── */
  const ifc = drawings.filter(d => d.status === 'Issued for Construction').length;
  const review = drawings.filter(d => d.status === 'Issued for Review').length;
  const superseded = drawings.filter(d => d.status === 'Superseded').length;

  return (
    <div className="bg-[#f4f6f9] min-h-full p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Drawing Register</h1>
            <p className="text-xs text-slate-500">GFC / IFC / IFR drawings — revision tracking</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Register Drawing
        </button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Drawings', value: drawings.length, color: 'blue',    icon: Layers },
          { label: 'Issued for Construction', value: ifc,        color: 'emerald', icon: CheckCircle2 },
          { label: 'Under Review',  value: review,      color: 'amber',   icon: Clock },
          { label: 'Superseded',    value: superseded,  color: 'slate',   icon: History },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-[#e2e6ec] p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-${color}-50 border border-${color}-100 flex items-center justify-center`}>
              <Icon className={`w-4 h-4 text-${color}-600`} />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800">{value}</div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by number or title..."
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <select
          value={filterDisc}
          onChange={e => setFilterDisc(e.target.value)}
          className="border border-[#e2e6ec] rounded-lg px-3 py-2 text-sm text-slate-700 bg-[#f8f9fc] outline-none"
        >
          <option value="all">All Disciplines</option>
          {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-[#e2e6ec] rounded-lg px-3 py-2 text-sm text-slate-700 bg-[#f8f9fc] outline-none"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400 font-semibold ml-auto">{filtered.length} drawing{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] overflow-hidden">
        <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Drawing Index</span>
          <span className="text-xs text-slate-400">{filtered.length} records</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading drawings...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <Layers className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No drawings found</p>
            <p className="text-xs">Register your first drawing using the button above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fc] border-b border-[#e2e6ec]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Drawing No. & Title</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Discipline</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Revision</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Issued Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Scale / Size</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(drw => (
                  <tr key={drw.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-blue-600 font-bold text-xs font-mono">{drw.drawing_number}</div>
                          <div className="text-slate-700 font-medium text-sm">{drw.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                        {drw.discipline || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                        Rev {drw.revision || '0'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border',
                        STATUS_STYLE[drw.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                      )}>
                        {drw.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {drw.issued_date ? dayjs(drw.issued_date).format('DD MMM YYYY') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{drw.scale || '—'} / {drw.sheet_size || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedDrawing(drw)}
                          className="bg-white border border-[#e2e6ec] text-slate-700 rounded-lg p-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {drw.file_url && (
                          <a
                            href={drw.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-white border border-[#e2e6ec] text-slate-700 rounded-lg p-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                            title="Open Drawing"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          className="bg-white border border-[#e2e6ec] text-slate-700 rounded-lg p-2 hover:bg-slate-50 transition-colors"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Register Drawing Modal ──────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">
            <div className="px-6 py-4 bg-blue-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Register New Drawing</h2>
                  <p className="text-xs text-blue-200 mt-0.5">Add to the official drawing register</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); reset(); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-700 hover:bg-blue-800 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(createMut.mutate)} className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Drawing Number *</label>
                  <input
                    {...register('drawing_number', { required: true })}
                    placeholder="e.g. ARCH-GF-001"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                  />
                  {errors.drawing_number && <p className="text-xs text-red-500 mt-1">Required</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Revision *</label>
                  <input
                    {...register('revision', { required: true })}
                    placeholder="e.g. 0, A, B, C"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Drawing Title *</label>
                <input
                  {...register('title', { required: true })}
                  placeholder="e.g. Ground Floor Plan - Block A"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Discipline *</label>
                  <select
                    {...register('discipline', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Select discipline...</option>
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status *</label>
                  <select
                    {...register('status', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Select status...</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Issued Date</label>
                  <input
                    type="date"
                    {...register('issued_date')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
                  <select
                    {...register('project_id')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Scale</label>
                  <input {...register('scale')} placeholder="e.g. 1:100" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sheet Size</label>
                  <select {...register('sheet_size')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">—</option>
                    {['A0', 'A1', 'A2', 'A3', 'A4'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Drawn By</label>
                  <input {...register('drawn_by')} placeholder="Initials / Firm" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Remarks / Revision Notes</label>
                <textarea
                  {...register('remarks')}
                  rows={2}
                  placeholder="e.g. Updated column grid per structural review comments..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">File URL / Share Link</label>
                <input
                  {...register('file_url')}
                  placeholder="https://onedrive.com/... or /documents/..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); reset(); }}
                  className="bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2 flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {createMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Register Drawing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Drawing Detail Modal ────────────────────────────────────── */}
      {selectedDrawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 bg-blue-600 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">{selectedDrawing.drawing_number}</h2>
                <p className="text-xs text-blue-200 mt-0.5">{selectedDrawing.title}</p>
              </div>
              <button onClick={() => setSelectedDrawing(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-700 hover:bg-blue-800 text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Discipline',   selectedDrawing.discipline  || '—'],
                  ['Revision',     `Rev ${selectedDrawing.revision || '0'}`],
                  ['Status',       selectedDrawing.status      || '—'],
                  ['Issued Date',  selectedDrawing.issued_date ? dayjs(selectedDrawing.issued_date).format('DD MMM YYYY') : '—'],
                  ['Scale',        selectedDrawing.scale       || '—'],
                  ['Sheet Size',   selectedDrawing.sheet_size  || '—'],
                  ['Drawn By',     selectedDrawing.drawn_by    || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{k}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              {selectedDrawing.remarks && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Revision Notes</p>
                  <p className="text-sm text-slate-700">{selectedDrawing.remarks}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                {selectedDrawing.file_url && (
                  <a
                    href={selectedDrawing.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Open Drawing
                  </a>
                )}
                <button
                  onClick={() => setSelectedDrawing(null)}
                  className="flex-1 bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2.5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
