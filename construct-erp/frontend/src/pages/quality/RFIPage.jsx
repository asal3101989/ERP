// src/pages/quality/RFIPage.jsx
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  FileSearch, Plus, X, BadgeCheck,
  MapPin, Clock, User, ClipboardList,
  CheckCircle2, AlertCircle, Eye, Info,
  Filter, Calendar, Activity, XCircle,
  PenTool, Download, Layers, Printer,
  Camera
} from 'lucide-react';
import { qualityAPI, projectAPI } from '../../api/client';
import AttachmentPanel from '../../components/quality/AttachmentPanel';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import { QualityPrintTemplate } from './QualityPrintTemplate';
import PhotoMarkupTool from './PhotoMarkupTool';

export default function RFIPage() {
  const [showForm, setShowForm] = useState(false);
  const [newAttachments, setNewAttachments] = useState([]);
  const [selectedRFI, setSelectedRFI] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // pending, inspected, approved
  const [markupImage, setMarkupImage] = useState(null); // URL for markup
  const [printData, setPrintData] = useState(null);
  const printRef = useRef();

  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    onAfterPrint: () => setPrintData(null),
  });

  const { data: rfis = [], isLoading } = useQuery({
    queryKey: ['quality-rfi'],
    queryFn: () => qualityAPI.listRFI().then(r => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => { const d = r?.data; return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : (Array.isArray(r) ? r : [])) }).catch(() => []),
  });

  const { data: checklists } = useQuery({
    queryKey: ['quality-checklists'],
    queryFn: () => qualityAPI.listChecklists().then(r => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const { data: drawings } = useQuery({
    queryKey: ['quality-drawings'],
    queryFn: () => qualityAPI.listDrawings().then(r => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const createMut = useMutation({
    mutationFn: (d) => qualityAPI.createRFI({ ...d, attachments: newAttachments }),
    onSuccess: () => {
      toast.success('Inspection Request (RFI) Raised');
      reset(); setShowForm(false); setNewAttachments([]);
      qc.invalidateQueries(['quality-rfi']);
    },
  });

  const signMut = useMutation({
    mutationFn: ({ id, data }) => qualityAPI.signRFI(id, data),
    onSuccess: () => {
      toast.success('Signature captured successfully');
      qc.invalidateQueries(['quality-rfi']);
    },
  });

  const inspectMut = useMutation({
    mutationFn: ({ id, data }) => qualityAPI.inspectRFI(id, data),
    onSuccess: () => {
      toast.success('Inspection evaluation recorded');
      setSelectedRFI(null);
      qc.invalidateQueries(['quality-rfi']);
    },
  });

  const attachMut = useMutation({
    mutationFn: ({ id, attachments }) => qualityAPI.updateRFIAttachments(id, attachments),
    onSuccess: () => { qc.invalidateQueries(['quality-rfi']); toast.success('Attachments saved'); },
  });

  return (
    <div className="bg-[#f4f6f9] min-h-full p-6 space-y-5">
      {/* Off-screen Print Template */}
      <div style={{ display: 'none' }}>
        <QualityPrintTemplate ref={printRef} data={printData} type="rfi" />
      </div>

      {/* Photo Markup Overlay */}
      {markupImage && (
        <PhotoMarkupTool
          imageUrl={markupImage}
          onCancel={() => setMarkupImage(null)}
          onSave={(data) => {
            toast.success('Markup evidence synchronized');
            setMarkupImage(null);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Request for Inspection (RFI)</h1>
            <p className="text-xs text-slate-500">Request for Inspection — Branded PDF Reporting</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Raise RFI
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-[#f8f9fc] p-1 rounded-xl flex gap-1 w-fit border border-[#e2e6ec]">
        {['pending', 'inspected', 'approved'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              activeTab === tab
                ? 'bg-white text-indigo-600 shadow-sm rounded-lg font-semibold text-sm px-5 py-2'
                : 'text-slate-500 hover:text-slate-700 text-sm px-5 py-2 rounded-lg'
            )}
          >
            {tab === 'pending' ? 'Site Queue' : tab === 'inspected' ? 'Audit Review' : 'Certified'}
          </button>
        ))}
      </div>

      {/* RFI Table */}
      <div className="bg-white rounded-xl border border-[#e2e6ec] overflow-hidden">
        <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Inspection Records</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-[#f8f9fc] border-b border-[#e2e6ec]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Inspection ID & Drawing</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Activity & Location</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Schedule</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status & Sign-off</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rfis?.filter(r => {
              if (activeTab === 'pending') return r.status === 'raised';
              if (activeTab === 'inspected') return r.status === 'inspected';
              if (activeTab === 'approved') return r.status === 'approved';
              return true;
            }).map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f8f9fc] border border-[#e2e6ec] flex items-center justify-center text-indigo-600">
                      <Layers size={16} />
                    </div>
                    <div>
                      <div className="text-indigo-600 font-semibold text-xs font-mono">{r.rfi_number}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <BadgeCheck size={10} /> {r.drawing_number || 'N/A'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-800 font-medium text-sm">{r.activity_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.location}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                    {r.inspection_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                    <Calendar size={12} className="text-slate-400" />
                    {dayjs(r.scheduled_at).format('DD MMM • HH:mm')}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <span className={clsx(
                      'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border w-fit',
                      r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      r.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    )}>
                      {r.status}
                    </span>
                    <div className="flex -space-x-2">
                      {r.signatures?.map((s, i) => (
                        <div
                          key={i}
                          title={`${s.role}: ${s.name}`}
                          className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-indigo-700 shadow-sm cursor-help"
                        >
                          {s.name.slice(0, 1)}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {r.status === 'raised' && (
                      <button
                        onClick={() => setSelectedRFI(r)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2"
                      >
                        Execute Inspection
                      </button>
                    )}
                    <button
                      onClick={() => { setPrintData(r); setTimeout(handlePrint, 100); }}
                      className="bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg p-2 hover:bg-slate-50 transition-colors"
                      title="Print Branded Report"
                    >
                      <Printer size={15} />
                    </button>
                    <button className="bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg p-2 hover:bg-slate-50 transition-colors">
                      <Eye size={15} />
                    </button>
                    <button className="bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg p-2 hover:bg-slate-50 transition-colors">
                      <Download size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Raise RFI Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSearch className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white leading-none">New Inspection Request</h2>
                  <p className="text-xs text-indigo-200 mt-0.5">Fill in the details to raise an RFI</p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(createMut.mutate)} className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Inspection Type</label>
                  <select
                    {...register('inspection_type', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="internal">Internal Quality Audit</option>
                    <option value="client">Client Verification</option>
                    <option value="joint">Joint Measurement / Inspection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference Drawing (GFC)</label>
                  <select
                    {...register('drawing_id', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">Select Drawing...</option>
                    {drawings?.map(d => (
                      <option key={d.id} value={d.id}>{d.drawing_number} - {d.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quality ITP Protocol</label>
                  <select
                    {...register('checklist_id', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {checklists?.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Schedule Execution</label>
                  <input
                    type="datetime-local"
                    {...register('scheduled_at', { required: true })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Activity / Scope</label>
                <input
                  {...register('activity_name', { required: true })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="e.g. Slab Rebar Check - Zone B-4"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
                <input
                  {...register('location', { required: true })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="e.g. Block A, Level 3"
                />
              </div>

              <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  Drawing-linked RFIs ensure that inspections are performed against the latest Good-for-Construction (GFC) revision.
                </p>
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
                  Authorize RFI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Execution Modal */}
      {selectedRFI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PenTool className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Quality Authorization</h2>
                  <p className="text-xs text-indigo-200 mt-0.5">Inspection Serial: {selectedRFI.rfi_number}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRFI(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden">
              {/* Left: Metadata & Signatures */}
              <div className="bg-white p-6 border-r border-[#e2e6ec] space-y-6 overflow-y-auto">
                {/* Material Context */}
                <div>
                  <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-4 py-2.5 -mx-6 mb-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Material Context</span>
                  </div>
                  <p className="text-slate-800 font-semibold text-sm">{selectedRFI.drawing_number} — {selectedRFI.drawing_title}</p>
                  <p className="text-xs text-slate-500 mt-1">{selectedRFI.activity_name} @ {selectedRFI.location}</p>
                </div>

                {/* Evidence Capture */}
                <div>
                  <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-4 py-2.5 -mx-6 mb-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Evidence Capture</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMarkupImage('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400')}
                      className="aspect-video bg-[#f8f9fc] border-2 border-dashed border-[#e2e6ec] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                    >
                      <Camera size={18} className="text-slate-400" />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Annotate Evidence</span>
                    </button>
                    <div className="aspect-video bg-[#f8f9fc] border border-[#e2e6ec] rounded-xl overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400"
                        className="w-full h-full object-cover"
                        alt="Evidence"
                      />
                    </div>
                  </div>
                </div>

                {/* Multi-Party Sign-off */}
                <div>
                  <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-4 py-2.5 -mx-6 mb-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Multi-Party Sign-off</span>
                  </div>
                  <div className="space-y-2">
                    {['Site Engineer', 'Quality Control', 'Client Rep'].map((role, i) => {
                      const sig = selectedRFI.signatures?.find(s => s.role === role);
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#f8f9fc] border border-[#e2e6ec] rounded-lg">
                          <div>
                            <p className="text-xs text-slate-500 font-medium leading-none mb-0.5">{role}</p>
                            <p className="text-sm font-semibold text-slate-800 leading-none">
                              {sig ? sig.name : 'Awaiting Sign-off'}
                            </p>
                          </div>
                          {!sig ? (
                            <button
                              onClick={() => {
                                const name = prompt(`Enter name for ${role}:`);
                                if (name) signMut.mutate({ id: selectedRFI.id, data: { role, name, sign_data: 'DIGITAL_SIG' } });
                              }}
                              className="bg-white border border-[#e2e6ec] text-slate-700 text-sm font-semibold rounded-lg px-4 py-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                            >
                              Authorize
                            </button>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <CheckCircle2 size={16} className="text-emerald-500" />
                              <span className="text-[10px] text-slate-400 font-medium">{dayjs(sig.date).format('HH:mm DD/MM')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: ITP Checklist */}
              <div className="p-6 space-y-5 overflow-y-auto bg-[#f4f6f9]">
                <div className="bg-[#f8f9fc] border-b border-[#e2e6ec] px-4 py-2.5 -mx-6 mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ITP Requirement Checklist</span>
                </div>
                <div className="space-y-3">
                  {[
                    'Structural Reinforcement matches GFC',
                    'Concrete batching verified',
                    'Joint Sealant correctly applied',
                    'Levels verified by instrumentation',
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-xl border border-[#e2e6ec] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-800 font-medium flex-1">{item}</span>
                        <div className="flex gap-2 shrink-0">
                          <button className="px-3 py-1.5 bg-[#f8f9fc] border border-[#e2e6ec] text-slate-500 text-xs font-semibold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                            Fail
                          </button>
                          <button className="px-3 py-1.5 bg-[#f8f9fc] border border-[#e2e6ec] text-slate-500 text-xs font-semibold rounded-lg hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors">
                            Pass
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Enter auditor remarks..."
                        rows={1}
                      />
                    </div>
                  ))}
                </div>

                <AttachmentPanel
                  attachments={selectedRFI?.attachments || []}
                  onUpdate={(atts) => attachMut.mutate({ id: selectedRFI.id, attachments: atts })}
                  label="RFI Attachments"
                />

                <div className="flex gap-3 pt-4 border-t border-[#e2e6ec]">
                  <button
                    onClick={() => inspectMut.mutate({ id: selectedRFI.id, data: { status: 'rejected' } })}
                    className="flex-1 bg-red-50 text-red-700 border border-red-200 text-sm font-semibold rounded-lg px-4 py-2 hover:bg-red-100 transition-colors"
                  >
                    Reject Work (NCR)
                  </button>
                  <button
                    onClick={() => inspectMut.mutate({ id: selectedRFI.id, data: { status: 'approved' } })}
                    disabled={selectedRFI.signatures?.length < 2}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Certify Quality
                  </button>
                </div>
                {selectedRFI.signatures?.length < 2 && (
                  <p className="text-xs text-red-500 text-center">
                    Minimum 2 digital signatures required to certify this protocol.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
