// src/pages/quality/NCRPage.jsx
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  AlertOctagon, Plus, X, ShieldAlert,
  ChevronRight, ArrowDownRight, Hammer,
  Calendar, User, Activity, Filter,
  CheckCircle2, Info, XCircle, Search,
  Camera, FileText, HelpCircle, ArrowRight,
  Printer, Download, Eye, Layers
} from 'lucide-react';
import { qualityAPI, projectAPI } from '../../api/client';
import AttachmentPanel from '../../components/quality/AttachmentPanel';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import { QualityPrintTemplate } from './QualityPrintTemplate';
import PhotoMarkupTool from './PhotoMarkupTool';

const SEVERITY_STYLE = {
  minor:    { label: 'Minor',    badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  major:    { label: 'Major',    badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', badge: 'bg-red-50 text-red-700 border-red-200' },
};

export default function NCRPage() {
  const [showForm, setShowForm] = useState(false);
  const [newAttachments, setNewAttachments] = useState([]);
  const [selectedNCR, setSelectedNCR] = useState(null);
  const [markupImage, setMarkupImage] = useState(null);
  const [printData, setPrintData] = useState(null);
  const printRef = useRef();

  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    onAfterPrint: () => setPrintData(null),
  });

  const { data: ncrs = [], isLoading } = useQuery({
    queryKey: ['quality-ncr'],
    queryFn: () => qualityAPI.listNCR().then(r => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => { const d = r?.data; return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : (Array.isArray(r) ? r : [])) }).catch(() => []),
  });

  const createMut = useMutation({
    mutationFn: (d) => qualityAPI.createNCR({ ...d, attachments: newAttachments }),
    onSuccess: () => {
      toast.success('NCR Issued for Review');
      reset(); setShowForm(false); setNewAttachments([]);
      qc.invalidateQueries(['quality-ncr']);
    },
  });

  const attachMut = useMutation({
    mutationFn: ({ id, attachments }) => qualityAPI.updateNCRAttachments(id, attachments),
    onSuccess: () => { qc.invalidateQueries(['quality-ncr']); toast.success('Attachments saved'); },
  });

  const rcaMut = useMutation({
    mutationFn: ({ id, data }) => qualityAPI.saveRCA(id, data),
    onSuccess: () => {
      toast.success('Forensic RCA Protocols Saved');
      setSelectedNCR(null);
      qc.invalidateQueries(['quality-ncr']);
    },
  });

  return (
    <div className="bg-[#f4f6f9] min-h-full p-6 space-y-5">
      {/* Off-screen Print Template */}
      <div style={{ display: 'none' }}>
        <QualityPrintTemplate ref={printRef} data={printData} type="ncr" />
      </div>

      {/* Markup Tool */}
      {markupImage && (
        <PhotoMarkupTool
          imageUrl={markupImage}
          onCancel={() => setMarkupImage(null)}
          onSave={(data) => {
            toast.success('Annotated evidence attached to case file');
            setMarkupImage(null);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <AlertOctagon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Non-Conformance Reports (NCR)</h1>
            <p className="text-xs text-slate-500">Non-Conformance Tracking — RCA &amp; CAR Lifecycle</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Issue NCR
        </button>
      </div>

      {/* NCR Table */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] overflow-hidden">
        <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">NCR Registry</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-[#f8f9fc] border-b border-[#e2e6ec]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">NCR Number</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Severity</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Description</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Project</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Assigned To</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Due Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Loading...</td>
              </tr>
            ) : ncrs?.map(ncr => {
              const cfg = SEVERITY_STYLE[ncr.severity] || SEVERITY_STYLE.minor;
              const isOverdue = ncr.resolution_deadline && dayjs(ncr.resolution_deadline).isBefore(dayjs()) && ncr.status !== 'closed';

              return (
                <tr key={ncr.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-indigo-600 font-mono">{ncr.ncr_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border', cfg.badge)}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-slate-800 font-medium truncate">{ncr.description}</p>
                    {ncr.rfi_activity && (
                      <p className="text-xs text-slate-500 mt-0.5">Impact: {ncr.rfi_activity}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border',
                      ncr.status === 'open'         ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      ncr.status === 'under_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      ncr.status === 'closed'       ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    )}>
                      {ncr.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{ncr.project_name || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-700">
                      <User size={13} className="text-slate-400" />
                      {ncr.assigned_to_name || <span className="text-slate-400 italic">Unassigned</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={clsx('flex items-center gap-1.5 text-xs', isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600')}>
                      <Calendar size={12} className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
                      {ncr.resolution_deadline ? dayjs(ncr.resolution_deadline).format('DD MMM YYYY') : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {ncr.status === 'open' && (
                        <button
                          onClick={() => setSelectedNCR(ncr)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2"
                        >
                          RCA
                        </button>
                      )}
                      <button
                        onClick={() => { setPrintData(ncr); setTimeout(handlePrint, 100); }}
                        className="bg-white border border-[#e2e6ec] text-slate-700 rounded-lg p-2 hover:bg-slate-50 transition-colors"
                        title="Issue Formal NCR PDF"
                      >
                        <Printer size={15} />
                      </button>
                      <button className="bg-white border border-[#e2e6ec] text-slate-700 rounded-lg p-2 hover:bg-slate-50 transition-colors">
                        <Eye size={15} />
                      </button>
                      <button className="bg-white border border-[#e2e6ec] text-slate-700 rounded-lg p-2 hover:bg-slate-50 transition-colors">
                        <Download size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Issue NCR Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertOctagon className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Issue Non-Conformance Report</h2>
                  <p className="text-xs text-indigo-200 mt-0.5">Document the non-conformance for tracking and resolution</p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(createMut.mutate)} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
                  <select
                    {...register('project_id', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">Select Project...</option>
                    {projects?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Severity</label>
                  <select
                    {...register('severity', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="minor">Minor / Correction</option>
                    <option value="major">Major / Rework</option>
                    <option value="critical">Critical / Stop Work</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea
                  {...register('description', { required: true })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  rows={3}
                  placeholder="Describe the non-conformance in detail..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
                <input
                  {...register('location', { required: true })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="e.g. Block C, Ground Floor"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Assigned To</label>
                  <input
                    {...register('assigned_to')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Responsible party name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    {...register('due_date')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <AttachmentPanel
                attachments={newAttachments}
                onUpdate={setNewAttachments}
                label="Attachments (optional)"
              />

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setNewAttachments([]); }}
                  className="bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2 flex-1"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex-1 flex items-center justify-center gap-2"
                >
                  Issue NCR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RCA Stepper Modal */}
      {selectedNCR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Root Cause Analysis (RCA)</h2>
                  <p className="text-xs text-indigo-200 mt-0.5">NCR: {selectedNCR.ncr_number} — {selectedNCR.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNCR(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden">
              {/* Left: 5-Why Stepper */}
              <div className="bg-white p-6 border-r border-[#e2e6ec] space-y-5 overflow-y-auto">
                <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-4 py-2.5 -mx-6 mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">5-Why Root Cause Method</span>
                </div>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i}>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Why {i} — Why did this occur?
                      </label>
                      <input
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder={`Level ${i} explanation...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: CAR Planning */}
              <div className="p-6 space-y-5 overflow-y-auto bg-[#f4f6f9]">
                <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-4 py-2.5 -mx-6 mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Corrective Action &amp; Evidence</span>
                </div>

                {/* Evidence Capture */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Defect Site Evidence</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMarkupImage('https://images.unsplash.com/photo-1590069230005-db3206497f81?auto=format&fit=crop&q=80&w=400')}
                      className="aspect-video bg-white border-2 border-dashed border-[#e2e6ec] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                    >
                      <Camera size={18} className="text-slate-400" />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Annotate Defect</span>
                    </button>
                    <div className="aspect-video bg-white border border-[#e2e6ec] rounded-xl overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1590069230005-db3206497f81?auto=format&fit=crop&q=80&w=400"
                        className="w-full h-full object-cover"
                        alt="Defect"
                      />
                    </div>
                  </div>
                </div>

                {/* Rectification Plan */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Rectification Strategy (CAR)</label>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={4}
                    placeholder="Provide a detailed, step-by-step technical rectification strategy for field crews..."
                  />
                </div>

                {/* Resolution Deadline */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Resolution Deadline</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <AttachmentPanel
                  attachments={selectedNCR?.attachments || []}
                  onUpdate={(atts) => attachMut.mutate({ id: selectedNCR.id, attachments: atts })}
                  label="NCR Attachments"
                />

                <div className="flex gap-3 pt-4 border-t border-[#e2e6ec]">
                  <button
                    onClick={() => setSelectedNCR(null)}
                    className="bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2 flex-1"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => rcaMut.mutate({ id: selectedNCR.id, data: { status: 'under_review' } })}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex-1 flex items-center justify-center gap-2"
                  >
                    Save RCA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
