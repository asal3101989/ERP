// src/pages/quality/DocumentControlPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  FolderSearch, Plus, X, Layers,
  FileText, History, ShieldCheck,
  Clock, User, Download, Eye,
} from 'lucide-react';
import { qualityAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const STATUS_BADGE = {
  IFC:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  IFA:         'bg-amber-50 text-amber-700 border-amber-200',
  Superseded:  'bg-red-50 text-red-700 border-red-200',
  approved:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending:     'bg-amber-50 text-amber-700 border-amber-200',
  rejected:    'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${cls}`}>
      {status || '—'}
    </span>
  );
}

export default function DocumentControlPage() {
  const [activeTab, setActiveTab] = useState('drawings');
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: drawings, isLoading: isDrawingsLoading } = useQuery({
    queryKey: ['quality-drawings'],
    queryFn: () => qualityAPI.listDrawings().then(r => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const { data: submittals, isLoading: isSubmittalsLoading } = useQuery({
    queryKey: ['quality-submittals'],
    queryFn: () => qualityAPI.listSubmittals().then(r => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => {
      const d = r?.data;
      return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : (Array.isArray(r) ? r : []));
    }).catch(() => []),
  });

  const createDrawingMut = useMutation({
    mutationFn: (d) => qualityAPI.createDrawing(d),
    onSuccess: () => {
      toast.success('Drawing registered in GFC Ledger');
      reset();
      setShowForm(false);
      qc.invalidateQueries(['quality-drawings']);
    },
  });

  const tabs = [
    { id: 'drawings',   label: 'Drawing Register (GFC)',    icon: Layers     },
    { id: 'submittals', label: 'Material Submittals (MAS)', icon: ShieldCheck },
  ];

  return (
    <div className="bg-[#f4f6f9] min-h-full p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <FolderSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Document Control Registry</h1>
            <p className="text-xs text-slate-500">Revision Management · Engineering Drawings · Material Submittals</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register {activeTab === 'drawings' ? 'Drawing' : 'Submittal'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-[#f8f9fc] p-1 rounded-xl flex gap-1 w-fit border border-[#e2e6ec]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id
              ? 'bg-white text-indigo-600 shadow-sm rounded-lg font-semibold text-sm px-5 py-2 flex items-center gap-2'
              : 'text-slate-500 hover:text-slate-700 text-sm px-5 py-2 rounded-lg transition-colors flex items-center gap-2'}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Drawings Table */}
      {activeTab === 'drawings' && (
        <div className="bg-white rounded-xl border border-[#e2e6ec] overflow-hidden">
          <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Drawing Register — Good For Construction</span>
            <span className="text-xs text-slate-500">{drawings?.length ?? 0} drawings</span>
          </div>
          <table className="w-full">
            <thead className="bg-[#f8f9fc] border-b border-slate-100">
              <tr>
                {['Drawing Number', 'Title', 'Discipline', 'Revision', 'Status', 'Project', 'Revision Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isDrawingsLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td>
                </tr>
              )}
              {!isDrawingsLoading && (!drawings || drawings.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No drawings registered yet</td>
                </tr>
              )}
              {drawings?.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-mono text-xs font-semibold text-slate-700">{d.drawing_number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{d.title || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{d.discipline || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-indigo-600">Rev {d.revision ?? '0'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{d.project_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {d.revision_date ? dayjs(d.revision_date).format('DD MMM YYYY') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submittals Table */}
      {activeTab === 'submittals' && (
        <div className="bg-white rounded-xl border border-[#e2e6ec] overflow-hidden">
          <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Material Submittals Register</span>
            <span className="text-xs text-slate-500">{submittals?.length ?? 0} submittals</span>
          </div>
          <table className="w-full">
            <thead className="bg-[#f8f9fc] border-b border-slate-100">
              <tr>
                {['Submittal Number', 'Description', 'Vendor', 'Status', 'Submission Date', 'Review Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isSubmittalsLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td>
                </tr>
              )}
              {!isSubmittalsLoading && (!submittals || submittals.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">Awaiting technical submittals from vendors</td>
                </tr>
              )}
              {submittals?.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-slate-700">{s.submittal_number}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{s.description || s.material_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{s.vendor_name || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {s.submission_date ? dayjs(s.submission_date).format('DD MMM YYYY') : (s.created_at ? dayjs(s.created_at).format('DD MMM YYYY') : '—')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {s.review_date ? dayjs(s.review_date).format('DD MMM YYYY') : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Drawing Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[92vh]">
            {/* Modal header */}
            <div className="px-6 py-4 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-white" />
                <span className="text-base font-semibold text-white">Register Drawing</span>
              </div>
              <button onClick={() => setShowForm(false)} className="text-indigo-200 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(createDrawingMut.mutate)} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
                  <select {...register('project_id', { required: true })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">Select project…</option>
                    {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Drawing Number</label>
                  <input
                    {...register('drawing_number', { required: true })}
                    placeholder="e.g. BCIM-P2-STR-GF-001"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                <input
                  {...register('title', { required: true })}
                  placeholder="e.g. Ground Floor Slab Reinforcement Plan"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Discipline</label>
                  <select {...register('discipline', { required: true })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="Structural">Structural / RCC</option>
                    <option value="Architectural">Architectural / Finishing</option>
                    <option value="MEP">MEP / Electrical</option>
                    <option value="Plumbing">Plumbing / PHE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Revision</label>
                  <input
                    {...register('revision')}
                    defaultValue="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select {...register('status')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="IFC">IFC — Issued for Construction</option>
                  <option value="IFA">IFA — Issued for Approval</option>
                  <option value="Superseded">Superseded</option>
                </select>
              </div>

              <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                <History className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">Registering a document in the GFC Ledger establishes it as the prime source for all site inspections and quality audits.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={createDrawingMut.isPending}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
                >
                  {createDrawingMut.isPending ? 'Saving…' : 'Authorize Registry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
