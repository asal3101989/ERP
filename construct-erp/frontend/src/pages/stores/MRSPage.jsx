// src/pages/stores/MRSPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import {
  ClipboardList, Plus, X, CheckCircle, Clock, XCircle,
  Search, Printer, Download, CheckCircle2, ShieldCheck,
  UserCheck, Building2, Landmark, Check, Package,
  ChevronRight, AlertCircle, FileText, Trash2, Activity,
  ChevronDown, Tag,
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { mrsAPI, projectAPI, inventoryAPI } from '../../api/client';
import toast from 'react-hot-toast';
import MRSPrintTemplate from './MRSPrintTemplate';
import SignaturePadModal from '../../components/common/SignaturePadModal';

const UNITS = ['MT', 'Bags', 'CUM', 'Brass', 'Nos', 'RMT', 'Drum', 'Ltr', 'Kg', 'Sqft'];

const STATUS_CONFIG = {
  pending:        { label: 'Pending Verification', short: 'Pending',    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',  dot: 'bg-yellow-500',  icon: Clock,       stage: 1 },
  verified_tower: { label: 'Tower Verified',        short: 'Verified',   color: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-500',    icon: UserCheck,   stage: 2 },
  approved_pm:    { label: 'PM Approved',           short: 'PM Appvd',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200',dot: 'bg-emerald-500', icon: ShieldCheck, stage: 3 },
  approved_srpm:  { label: 'Sr. PM Approved',       short: 'SrPM Appvd', color: 'bg-teal-50 text-teal-700 border-teal-200',        dot: 'bg-teal-500',    icon: CheckCircle2,stage: 4 },
  approved_mgmt:  { label: 'Mgmt Released',         short: 'Released',   color: 'bg-indigo-50 text-indigo-700 border-indigo-200',   dot: 'bg-indigo-500',  icon: Building2,   stage: 5 },
  approved_md:    { label: 'Authorized by MD',      short: 'Authorized', color: 'bg-green-50 text-green-700 border-green-200',      dot: 'bg-green-500',   icon: Landmark,    stage: 6 },
  issued:         { label: 'Items Issued',          short: 'Issued',     color: 'bg-sky-50 text-sky-700 border-sky-200',            dot: 'bg-sky-500',     icon: CheckCircle, stage: 7 },
  rejected:       { label: 'Rejected',              short: 'Rejected',   color: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-400',     icon: XCircle,     stage: 0 },
};

const PRIORITY_CONFIG = {
  normal:   { label: 'Normal',   cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  urgent:   { label: 'Urgent',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-600 border-red-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap', cfg.color)}>
      <Icon size={11} strokeWidth={2.5} />
      {cfg.short}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

export default function MRSPage() {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedMRS, setSelectedMRS] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSigModal, setShowSigModal] = useState(false);
  const [pendingStage, setPendingStage] = useState(null); // { id, stage, label }
  const [items, setItems] = useState([{ material: '', qty: '', unit: 'Nos', purpose: '' }]);
  const [formData, setFormData] = useState({
    project_id: '', department: 'Projects', head_office_project_name: '',
    site_incharge: '', required_by: '', priority: 'normal', remarks: '',
  });

  const qc = useQueryClient();

  const { data: mrsData } = useQuery({
    queryKey: ['mrs'],
    queryFn: () => mrsAPI.list().then(r => r.data.data),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });
  const { data: detailedMRS } = useQuery({
    queryKey: ['mrs', selectedMRS?.id],
    queryFn: () => mrsAPI.get(selectedMRS.id).then(r => r.data.data),
    enabled: !!selectedMRS?.id,
  });

  // Inventory lookup — for material name combobox
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-lookup'],
    queryFn: () => inventoryAPI.itemsLookup().then(r => r.data?.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: existingCategories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => inventoryAPI.categories().then(r => r.data?.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  // New Item modal state
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemTargetIdx, setNewItemTargetIdx] = useState(null);
  const [newItemForm, setNewItemForm] = useState({ material_name: '', category: '', category_custom: '', unit: 'Nos' });
  const [categoryMode, setCategoryMode] = useState('select'); // 'select' | 'custom'

  const createMutation = useMutation({
    mutationFn: (d) => mrsAPI.create(d),
    onSuccess: () => {
      toast.success('MRS submitted for approval!');
      resetForm();
      qc.invalidateQueries({ queryKey: ['mrs'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Submission failed'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, stage, data }) => mrsAPI.approve(id, stage, data),
    onSuccess: (_, { id }) => {
      toast.success('Status updated successfully');
      qc.invalidateQueries({ queryKey: ['mrs'] });
      qc.invalidateQueries({ queryKey: ['mrs', id] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Action failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, remarks }) => mrsAPI.reject(id, { remarks }),
    onSuccess: () => {
      toast.success('MRS rejected');
      setSelectedMRS(null);
      qc.invalidateQueries({ queryKey: ['mrs'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Action failed'),
  });

  const addInventoryItemMutation = useMutation({
    mutationFn: (data) => inventoryAPI.create(data),
    onSuccess: (res, vars) => {
      toast.success(`"${vars.material_name}" added to store ledger`);
      qc.invalidateQueries({ queryKey: ['inventory-lookup'] });
      qc.invalidateQueries({ queryKey: ['inventory-categories'] });
      // Auto-fill the item row that triggered this
      if (newItemTargetIdx !== null) {
        const n = [...items];
        n[newItemTargetIdx].material = vars.material_name;
        n[newItemTargetIdx].unit = vars.unit || n[newItemTargetIdx].unit;
        setItems(n);
      }
      setShowNewItemModal(false);
      setNewItemForm({ material_name: '', category: '', category_custom: '', unit: 'Nos' });
      setCategoryMode('select');
      setNewItemTargetIdx(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to add item'),
  });

  const allMRS = mrsData ?? [];
  const filtered = allMRS.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search && !m.mrs_number?.toLowerCase().includes(search.toLowerCase()) &&
        !m.project_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportToCSV = () => {
    const headers = ['Serial No', 'Project', 'Department', 'Required By', 'Status', 'Date', 'Requested By'];
    const rows = filtered.map(m => [
      m.serial_no_formatted || m.mrs_number, m.project_name, m.department,
      dayjs(m.required_by).format('DD/MM/YYYY'), m.status,
      dayjs(m.created_at).format('DD/MM/YYYY'), m.raised_by_name,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `MRS_Log_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exporting MRS log…');
  };

  const stageActions = [
    { id: 'verify-tower', label: 'Verify (Tower Mgr)',    status: 'pending'       },
    { id: 'approve-pm',   label: 'Approve (Project Mgr)', status: 'verified_tower' },
    { id: 'approve-srpm', label: 'Approve (Sr. PM)',      status: 'approved_pm'   },
    { id: 'approve-mgmt', label: 'Release (Director)',    status: 'approved_srpm' },
    { id: 'approve-md',   label: 'Authorize (MD)',        status: 'approved_mgmt' },
  ];

  const liveStatus = detailedMRS?.status ?? selectedMRS?.status;
  const currentAction = stageActions.find(a => a.status === liveStatus);

  const stats = [
    { key: 'pending',     label: 'Pending',     icon: Clock,       dot: 'bg-yellow-400' },
    { key: 'approved_pm', label: 'PM Approved',  icon: ShieldCheck, dot: 'bg-emerald-400' },
    { key: 'approved_md', label: 'Authorized',   icon: Landmark,    dot: 'bg-indigo-400' },
    { key: 'issued',      label: 'Issued',       icon: CheckCircle, dot: 'bg-sky-400' },
  ];

  const resetForm = () => {
    setShowForm(false);
    setItems([{ material: '', qty: '', unit: 'Nos', purpose: '' }]);
    setFormData({ project_id: '', department: 'Projects', head_office_project_name: '', site_incharge: '', required_by: '', priority: 'normal', remarks: '' });
  };

  const handleSubmit = () => {
    if (!formData.project_id || !formData.required_by || items.every(i => !i.material || !i.qty)) {
      return toast.error('Please fill all required fields');
    }
    createMutation.mutate({
      ...formData,
      items: items.filter(i => i.material && i.qty),
      required_by: dayjs(formData.required_by).format('YYYY-MM-DD'),
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <ClipboardList className="w-3.5 h-3.5" /> Stores
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Material Requisition System</h1>
          <p className="text-sm text-slate-400 mt-0.5">Multi-stage approval workflow for material requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Requisition
          </button>
        </div>
      </div>

      {/* Signature alert */}
      {!user?.signature_url && (
        <div className="mb-5 bg-yellow-50 border border-yellow-200 border-l-4 border-l-yellow-400 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-xs text-yellow-800 font-medium">
            Digital signature required to authorize documents.{' '}
            <Link to="/profile" className="underline font-semibold hover:text-yellow-900">Upload in Profile →</Link>
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ key, label, icon: Icon, dot }) => {
          const count = allMRS.filter(m => m.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={clsx(
                'bg-white border rounded-xl p-4 text-left shadow-sm transition-all hover:shadow-md',
                statusFilter === key ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-slate-400" />
                <span className={clsx('w-2 h-2 rounded-full', dot)} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{count}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search MRS number or project…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[['all', 'All'], ['pending', 'Pending'], ['approved_pm', 'PM Appvd'], ['approved_md', 'Authorized'], ['issued', 'Issued'], ['rejected', 'Rejected']].map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                statusFilter === val
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
              )}
            >
              {lbl}
              {val !== 'all' && <span className="ml-1 opacity-70">{allMRS.filter(m => m.status === val).length}</span>}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto hidden sm:block">{filtered.length} of {allMRS.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['MRS Serial No', 'Project', 'Department', 'Required By', 'Priority', 'Status', 'Raised By', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(mrs => (
                <tr
                  key={mrs.id}
                  onClick={() => setSelectedMRS(mrs)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors group"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-bold font-mono text-indigo-600 group-hover:underline">
                      {mrs.serial_no_formatted || mrs.mrs_number}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-slate-800 max-w-40 truncate">{mrs.project_name}</div>
                    {mrs.project_code && <div className="text-xs text-slate-400 font-mono">{mrs.project_code}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                      {mrs.department || 'Projects'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-700">
                    {dayjs(mrs.required_by).format('DD MMM YYYY')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PriorityBadge priority={mrs.priority} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={mrs.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{mrs.raised_by_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{dayjs(mrs.created_at).format('D MMM YY')}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">No requisitions found</p>
                    <p className="text-xs text-slate-300 mt-1">Adjust your filters or create a new requisition</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          Showing {filtered.length} of {allMRS.length} requisitions
        </div>
      </div>

      {/* ── Detail Slide-over ── */}
      {selectedMRS && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedMRS(null)} />
          <div className="bg-white border-l border-slate-200 w-[600px] flex flex-col h-full overflow-hidden shadow-2xl">

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 font-mono">
                    {selectedMRS.serial_no_formatted || selectedMRS.mrs_number}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {dayjs(selectedMRS.created_at).format('D MMM YYYY, HH:mm')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={liveStatus} />
                <button
                  onClick={() => window.print()}
                  disabled={!detailedMRS}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-40 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" /> {!detailedMRS ? '…' : 'Print'}
                </button>
                <button
                  onClick={() => setSelectedMRS(null)}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f4f6f9]">

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Project', selectedMRS.project_name],
                  ['Department', selectedMRS.department || 'Projects'],
                  ['Project Code', selectedMRS.project_code || '—'],
                  ['Site Incharge', selectedMRS.site_incharge || '—'],
                  ['Required By', dayjs(selectedMRS.required_by).format('DD MMM YYYY')],
                  ['Raised By', selectedMRS.raised_by_name],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Items */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Material Items</span>
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {(selectedMRS.items || []).length} items
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['#', 'Material', 'Unit', 'Qty', 'Purpose'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(selectedMRS.items || []).map((it, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{it.material_name || it.material}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold uppercase">
                            {it.unit}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-indigo-600">{it.quantity || it.qty}</td>
                        <td className="px-3 py-2.5 text-slate-500">{it.purpose || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Approval pipeline */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Approval Pipeline</span>
                </div>
                <div className="p-4">
                  <div className="relative">
                    <div className="absolute bg-slate-200 left-[17px] top-5" style={{ width: 1, height: 'calc(100% - 40px)' }} />
                    <div className="space-y-3">
                      {stageActions.map((stage, idx) => {
                        const currentStage = (STATUS_CONFIG[liveStatus] || STATUS_CONFIG.pending).stage;
                        const isDone = currentStage > idx + 1;
                        const isActive = currentStage === idx + 1;
                        return (
                          <div key={stage.id} className="flex items-center gap-3 relative">
                            <div className={clsx(
                              'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2',
                              isDone ? 'bg-emerald-500 border-emerald-500'
                                : isActive ? 'bg-indigo-600 border-indigo-600'
                                : 'bg-white border-slate-200'
                            )}>
                              {isDone
                                ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                : <span className={clsx('text-xs font-bold', isActive ? 'text-white' : 'text-slate-400')}>{idx + 2}</span>
                              }
                            </div>
                            <div className="flex-1">
                              <p className={clsx('text-xs font-semibold',
                                isDone ? 'text-slate-400 line-through' : isActive ? 'text-slate-900' : 'text-slate-400'
                              )}>
                                {stage.label}
                              </p>
                            </div>
                            {isDone && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Done</span>
                            )}
                            {isActive && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 animate-pulse">Pending</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action panel */}
              {currentAction && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Action Required</p>
                      <p className="text-xs text-emerald-700 font-medium">{currentAction.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setPendingStage({ id: selectedMRS.id, stage: currentAction.id, label: currentAction.label });
                        setShowSigModal(true);
                      }}
                      disabled={approveMutation.isPending}
                      className="flex-[2] h-9 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      ✍ Sign &amp; Approve
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ id: selectedMRS.id, remarks: 'Rejected by approver' })}
                      className="flex-1 h-9 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Print zone */}
          <div className="mrs-print-zone">
            <MRSPrintTemplate data={detailedMRS} />
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            @media screen { .mrs-print-zone { display: none !important; } }
            @media print {
              body * { visibility: hidden !important; }
              .mrs-print-zone, .mrs-print-zone * { visibility: visible !important; }
              .mrs-print-zone { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; display: flex !important; justify-content: center !important; background: white !important; z-index: 999999 !important; }
              @page { size: A4 landscape; margin: 0; }
            }
          `}} />
        </div>
      )}

      {/* ── New MRS Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Create Material Requisition</p>
                  <p className="text-xs text-slate-400 mt-0.5">Multi-stage approval document</p>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Project Details */}
              <div className="border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Project Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Project *">
                    <select
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                      value={formData.project_id}
                      onChange={e => setFormData(p => ({ ...p, project_id: e.target.value }))}
                    >
                      <option value="">Select project…</option>
                      {projectsData?.map(proj => <option key={proj.id} value={proj.id}>{proj.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Department">
                    <select
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                      value={formData.department}
                      onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
                    >
                      <option value="Projects">Projects</option>
                      <option value="Admin">Admin</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </Field>
                  <Field label="HO Project Name">
                    <input
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                      placeholder="HO project name"
                      value={formData.head_office_project_name}
                      onChange={e => setFormData(p => ({ ...p, head_office_project_name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Site Incharge">
                    <input
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                      placeholder="Enter name"
                      value={formData.site_incharge}
                      onChange={e => setFormData(p => ({ ...p, site_incharge: e.target.value }))}
                    />
                  </Field>
                  <Field label="Required By *">
                    <input
                      type="date"
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                      value={formData.required_by}
                      onChange={e => setFormData(p => ({ ...p, required_by: e.target.value }))}
                    />
                  </Field>
                  <Field label="Priority">
                    <select
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                      value={formData.priority}
                      onChange={e => setFormData(p => ({ ...p, priority: e.target.value }))}
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                      <option value="critical">Critical</option>
                    </select>
                  </Field>
                </div>
              </div>

              {/* Material Items */}
              <div className="border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Material Items</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Select from store ledger or add new items</p>
                  </div>
                  <button
                    onClick={() => setItems([...items, { material: '', qty: '', unit: 'Nos', purpose: '' }])}
                    className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                </div>
                <div className="grid gap-1.5 mb-2" style={{ gridTemplateColumns: '2fr 90px 80px 2fr 36px' }}>
                  {['Material Name', 'Quantity', 'Unit', 'Purpose', ''].map(h => (
                    <div key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">{h}</div>
                  ))}
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid gap-2 items-start" style={{ gridTemplateColumns: '2fr 90px 80px 2fr 36px' }}>
                      <MaterialCombobox
                        value={item.material}
                        inventoryItems={inventoryItems}
                        onChange={(materialName, unit) => {
                          const n = [...items];
                          n[idx].material = materialName;
                          if (unit) n[idx].unit = unit;
                          setItems(n);
                        }}
                        onNewItem={(prefill) => {
                          setNewItemTargetIdx(idx);
                          setNewItemForm(f => ({ ...f, material_name: prefill || '', category: '', category_custom: '', unit: item.unit || 'Nos' }));
                          setCategoryMode('select');
                          setShowNewItemModal(true);
                        }}
                      />
                      <input
                        type="number"
                        placeholder="0"
                        className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all text-right"
                        value={item.qty}
                        onChange={e => { const n = [...items]; n[idx].qty = e.target.value; setItems(n); }}
                      />
                      <select
                        className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                        value={item.unit}
                        onChange={e => { const n = [...items]; n[idx].unit = e.target.value; setItems(n); }}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input
                        type="text"
                        placeholder="Intended use"
                        className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
                        value={item.purpose}
                        onChange={e => { const n = [...items]; n[idx].purpose = e.target.value; setItems(n); }}
                      />
                      <button
                        onClick={() => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); }}
                        disabled={items.length === 1}
                        className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all mt-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div className="border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Remarks</h3>
                <textarea
                  rows={3}
                  placeholder="Additional notes or special instructions…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all resize-none"
                  value={formData.remarks}
                  onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              <span className="text-xs text-slate-400">{items.filter(i => i.material && i.qty).length} item(s) ready</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetForm}
                  className="px-5 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  className="px-6 h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm"
                >
                  {createMutation.isPending ? 'Submitting…' : 'Submit Requisition →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Inventory Item Modal ── */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-indigo-600">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Add New Item to Store Ledger</p>
                  <p className="text-xs text-indigo-200 mt-0.5">Item will be available for future requisitions</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewItemModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="p-5 space-y-4">
              <Field label="Material Name *">
                <input
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                  placeholder="e.g. TMT Steel Bars Fe500"
                  value={newItemForm.material_name}
                  onChange={e => setNewItemForm(f => ({ ...f, material_name: e.target.value }))}
                />
              </Field>

              <Field label="Category">
                <div className="space-y-2">
                  {categoryMode === 'select' ? (
                    <div className="flex gap-2">
                      <select
                        className="flex-1 h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                        value={newItemForm.category}
                        onChange={e => setNewItemForm(f => ({ ...f, category: e.target.value }))}
                      >
                        <option value="">— Select category —</option>
                        {existingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setCategoryMode('custom')}
                        className="flex items-center gap-1 px-3 h-9 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 whitespace-nowrap transition-colors"
                      >
                        <Plus className="w-3 h-3" /> New Category
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 h-9 bg-slate-50 border border-indigo-300 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                        placeholder="Type new category name…"
                        value={newItemForm.category_custom}
                        onChange={e => setNewItemForm(f => ({ ...f, category_custom: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => { setCategoryMode('select'); setNewItemForm(f => ({ ...f, category_custom: '' })); }}
                        className="flex items-center gap-1 px-3 h-9 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors"
                      >
                        ← Back
                      </button>
                    </div>
                  )}
                  {categoryMode === 'custom' && newItemForm.category_custom && (
                    <p className="text-xs text-indigo-600 font-medium">
                      ✓ New category "<span className="font-bold">{newItemForm.category_custom}</span>" will be created
                    </p>
                  )}
                </div>
              </Field>

              <Field label="Unit">
                <select
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
                  value={newItemForm.unit}
                  onChange={e => setNewItemForm(f => ({ ...f, unit: e.target.value }))}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>

              {!formData.project_id && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800">
                    Please select a <strong>Project</strong> in the form before adding a new item. The item will be registered under that project's store ledger.
                  </p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowNewItemModal(false)}
                className="px-4 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button
                disabled={!newItemForm.material_name || !formData.project_id || addInventoryItemMutation.isPending}
                onClick={() => {
                  const category = categoryMode === 'custom' ? newItemForm.category_custom : newItemForm.category;
                  addInventoryItemMutation.mutate({
                    project_id: formData.project_id,
                    material_name: newItemForm.material_name,
                    category: category || null,
                    unit: newItemForm.unit,
                    opening_stock: 0,
                  });
                }}
                className="px-5 h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm"
              >
                {addInventoryItemMutation.isPending ? 'Adding…' : 'Add to Store Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Digital Signature Modal ── */}
      {showSigModal && pendingStage && (
        <SignaturePadModal
          title={user?.name || 'Approver'}
          subtitle={pendingStage.label}
          onSave={(signatureImg) => {
            approveMutation.mutate({
              id:    pendingStage.id,
              stage: pendingStage.stage,
              data:  { signature_img: signatureImg },
            });
            setPendingStage(null);
          }}
          onClose={() => { setShowSigModal(false); setPendingStage(null); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function MaterialCombobox({ value, inventoryItems, onChange, onNewItem }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync display text when external value changes (e.g. after new item added)
  useEffect(() => { setQ(value || ''); }, [value]);

  const filtered = inventoryItems
    .filter(i => !q || i.material_name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 40);

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const hasResults = filtered.length > 0;

  const handleSelect = (item) => {
    setQ(item.material_name);
    onChange(item.material_name, item.unit);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const v = e.target.value;
    setQ(v);
    onChange(v, '');
    setOpen(true);
  };

  // Find category of selected item (for hint)
  const selectedItem = inventoryItems.find(i => i.material_name === value);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Search store ledger…"
          className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
          value={q}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
      {selectedItem?.category && !open && (
        <div className="text-xs text-slate-400 px-1 mt-0.5 truncate">{selectedItem.category}</div>
      )}
      {open && (
        <div className="absolute z-[80] top-10 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          {!hasResults && q ? (
            <div className="px-3 py-2 text-xs text-slate-400 italic">No match for "{q}"</div>
          ) : !hasResults ? (
            <div className="px-3 py-2 text-xs text-slate-400">Store ledger is empty — add items below</div>
          ) : (
            Object.entries(grouped).map(([cat, catItems]) => (
              <div key={cat}>
                <div className="px-3 py-1 text-xs font-bold text-slate-400 bg-slate-50 uppercase tracking-wider border-b border-slate-100 sticky top-0">
                  {cat}
                </div>
                {catItems.map(item => (
                  <button
                    key={item.material_name}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-800 hover:bg-indigo-50 hover:text-indigo-800 flex items-center justify-between group transition-colors"
                  >
                    <span className="font-medium">{item.material_name}</span>
                    <span className="text-slate-400 font-mono text-xs group-hover:text-indigo-400">{item.unit}</span>
                  </button>
                ))}
              </div>
            ))
          )}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setOpen(false); onNewItem(q); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-indigo-600 font-semibold border-t border-slate-100 hover:bg-indigo-50 transition-colors"
          >
            <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Plus className="w-3 h-3 text-white" />
            </div>
            {q ? `Add "${q}" to store ledger` : 'Add new item to store ledger'}
          </button>
        </div>
      )}
    </div>
  );
}
