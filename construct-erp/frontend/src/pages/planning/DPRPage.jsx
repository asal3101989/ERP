// src/pages/planning/DPRPage.jsx
// Daily Progress Report – mirrors the existing Planning ERP design system
import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Search, Download, X, Save,
  Calendar, MapPin, Users, Package, Truck,
  CheckCircle2, Clock, AlertTriangle, ChevronRight,
  CloudRain, Sun, Cloud, Printer, Eye, Edit2,
  Wrench, BarChart2, ClipboardList, Flag, TrendingUp,
  Trash2, ChevronDown, ChevronUp, Upload,
} from 'lucide-react';
import { planningAPI, projectAPI, subcontractorAPI, vendorAPI } from '../../api/client';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import DPRPrintTemplate from './DPRPrintTemplate';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEATHER_OPTIONS = [
  { value: 'sunny',   label: 'Sunny',   icon: Sun,       color: 'text-amber-500' },
  { value: 'cloudy',  label: 'Cloudy',  icon: Cloud,     color: 'text-slate-500' },
  { value: 'rainy',   label: 'Rainy',   icon: CloudRain, color: 'text-blue-500' },
  { value: 'normal',  label: 'Normal',  icon: Sun,       color: 'text-emerald-500' },
];

const STATUS_CFG = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600 border-slate-200' },
  submitted: { label: 'Submitted', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:  { label: 'Approved',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ACTIVITY_TYPES = [
  'structural', 'civil', 'finishing', 'mechanical', 'electrical', 'other',
];

const CONCRETE_GRADES = [
  'M5','M10','M15 Scr','M20','M25','M30',
  'M35 (OPC+FLYASH)','M35 (OPC)','M40 (OPC+FLYASH)','M40 (OPC)','M45','M50 (OPC)','M50','M60',
];

const STEEL_DIAS = ['8mm','10mm','12mm','16mm','20mm','25mm','32mm'];

const LABOUR_CATEGORIES = [
  'Mason','Carpenter','Barbender','Scaffolder','Unskilled','Helpers','Supporting Team (P&M)',
];

const PLANT_ITEMS = [
  'Excavators / JCB','Dewatering Pumps','Compactors / Roller',
  'D.G Sets','Tower Crane','Transit Mixer','Concrete Pump',
  'Bar Bending Machine','Bar Cutting Machine','Welding Machine',
  'Tippers','Hydra Crane','Fork Lift / Bobcat',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyDraft() {
  return {
    report_date: dayjs().format('YYYY-MM-DD'),
    weather: 'sunny',
    site_conditions: 'Dry',
    rain_log: '',
    // Work progress rows
    work_items: [{ description: '', unit: 'Cum', boq_qty: '', planned: '', achieved: '', cumulative: '', remarks: '' }],
    // Concrete consumption
    concrete_today: CONCRETE_GRADES.map(g => ({ grade: g, supplier: '', qty: '' })),
    // Labour
    staff: [
      { category: 'Management',          nos: '' },
      { category: 'Execution',           nos: '' },
      { category: 'Contracts/QS/Planning',nos: '' },
      { category: 'QC / Surveyors',      nos: '' },
      { category: 'Technical',           nos: '' },
      { category: 'Safety Officers',     nos: '' },
      { category: 'Plant & Machinery, Stores', nos: '' },
      { category: 'Admin / HR / IT',     nos: '' },
      { category: 'MEP',                 nos: '' },
    ],
    direct_workers: LABOUR_CATEGORIES.map(c => ({ category: c, day: '', night: '' })),
    subcontractors: [{ subcontract_wo_id: '', vendor_id: '', name: '', work: '', day: '', night: '' }],
    // Plant & Machinery
    plant_items: PLANT_ITEMS.map(p => ({ item: p, nos: '' })),
    // Steel
    steel: STEEL_DIAS.map(d => ({ dia: d, receipts_today: '', receipts_till_date: '', available: '', consumption: '' })),
    // Constraints / RFI
    constraints: '',
    rfi: '',
    prepared_by: '',
    approved_by: '',
  };
}

function WeatherIcon({ value, size = 4 }) {
  const cfg = WEATHER_OPTIONS.find(w => w.value === value) || WEATHER_OPTIONS[0];
  const Icon = cfg.icon;
  return <Icon className={clsx(`w-${size} h-${size}`, cfg.color)} />;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function Section({ title, icon: Icon, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className={clsx(
          'px-5 py-3.5 border-b border-slate-100 flex items-center justify-between',
          collapsible && 'cursor-pointer hover:bg-slate-50 transition-colors'
        )}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-indigo-600" />}
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        {collapsible && (
          open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </div>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value || '—'}</div>
    </div>
  );
}

function Inp({ ...props }) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-colors',
        props.className
      )}
    />
  );
}

function Sel({ children, ...props }) {
  return (
    <select
      {...props}
      className={clsx(
        'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-colors',
        props.className
      )}
    >
      {children}
    </select>
  );
}

function Lbl({ children }) {
  return <label className="text-xs font-semibold text-slate-600 block mb-1">{children}</label>;
}

// ─── DPR List Row ─────────────────────────────────────────────────────────────

function DPRRow({ dpr, onView, onEdit }) {
  const weatherCfg = WEATHER_OPTIONS.find(w => w.value === dpr.weather) || WEATHER_OPTIONS[0];
  const WeatherIco = weatherCfg.icon;
  return (
    <tr
      className="cursor-pointer hover:bg-slate-50 transition-colors group"
      onClick={() => onView(dpr)}
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-xs font-bold font-mono text-indigo-600">{dayjs(dpr.report_date).format('DD MMM YYYY')}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <WeatherIco className={clsx('w-3.5 h-3.5', weatherCfg.color)} />
          <span className="text-xs text-slate-600">{weatherCfg.label}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {dpr.site_conditions || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {dpr.prepared_by || '—'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={dpr.status} />
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {dayjs(dpr.created_at).format('DD MMM, hh:mm A')}
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
      </td>
    </tr>
  );
}

// ─── DPR View Panel ───────────────────────────────────────────────────────────

function DPRViewPanel({ dpr, project, onClose, onEdit, qc }) {
  const { user } = useAuthStore();
  const canApprove = ['project_manager', 'admin', 'super_admin'].includes(user?.role);

  const approveMut = useMutation({
    mutationFn: id => planningAPI.approveDPR(id),
    onSuccess: () => {
      toast.success('DPR approved!');
      qc.invalidateQueries({ queryKey: ['dpr-list'] });
      onClose();
    },
    onError: e => toast.error(e?.response?.data?.error || 'Approval failed'),
  });

  const deleteMut = useMutation({
    mutationFn: id => planningAPI.deleteDPR(id),
    onSuccess: () => {
      toast.success('DPR deleted');
      qc.invalidateQueries({ queryKey: ['dpr-list'] });
      onClose();
    },
    onError: e => toast.error(e?.response?.data?.error || 'Delete failed'),
  });

  const d = dpr;

  // Compute labour totals
  const totalDirect = (d.direct_workers || []).reduce(
    (acc, w) => ({ day: acc.day + (Number(w.day) || 0), night: acc.night + (Number(w.night) || 0) }), { day: 0, night: 0 }
  );
  const totalSub = (d.subcontractors || []).reduce(
    (acc, w) => acc + (Number(w.day) || 0) + (Number(w.night) || 0), 0
  );
  const totalStaff = (d.staff || []).reduce((acc, s) => acc + (Number(s.nos) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[1180px] bg-white shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <FileText className="w-3.5 h-3.5" /> Daily Progress Report
            </div>
            <h2 className="text-base font-bold text-slate-900">
              DPR — {dayjs(d.report_date).format('DD MMMM YYYY')}
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">{project?.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={d.status} />
            {d.status !== 'approved' && canApprove && (
              <button
                onClick={() => approveMut.mutate(d.id)}
                disabled={approveMut.isPending}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {approveMut.isPending ? 'Approving…' : 'Approve'}
              </button>
            )}
            {d.status === 'draft' && (
              <button
                onClick={() => onEdit(d)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <DPRPrintTemplate dpr={d} project={project} />

          {/* Project Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCell label="Report Date" value={dayjs(d.report_date).format('DD MMM YYYY')} />
            <InfoCell label="Weather" value={
              <div className="flex items-center gap-1.5">
                <WeatherIcon value={d.weather} />
                {WEATHER_OPTIONS.find(w => w.value === d.weather)?.label || d.weather}
              </div>
            } />
            <InfoCell label="Site Conditions" value={d.site_conditions} />
            <InfoCell label="Rain Log" value={d.rain_log || 'Nil'} />
          </div>

          {/* Work Progress */}
          {d.work_items?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Work Progress</h3>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Activity Description', 'Unit', 'BOQ Qty', 'Planned', 'Achieved', 'Cumulative', 'Remarks'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {d.work_items.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800 font-medium">{row.description || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.unit}</td>
                        <td className="px-3 py-2 text-slate-600">{row.boq_qty || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.planned || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-indigo-700">{row.achieved || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.cumulative || '—'}</td>
                        <td className="px-3 py-2 text-slate-400">{row.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Concrete Consumption */}
          {d.concrete_today?.some(c => c.qty) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Concrete Consumption Today</h3>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Grade', 'Supplier', 'Qty (Cum)'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {d.concrete_today.filter(c => c.qty).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-800">{c.grade}</td>
                        <td className="px-3 py-2 text-slate-600">{c.supplier || '—'}</td>
                        <td className="px-3 py-2 font-bold text-indigo-700">{c.qty}</td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                      <td className="px-3 py-2 font-bold text-indigo-800" colSpan={2}>Total</td>
                      <td className="px-3 py-2 font-bold text-indigo-800">
                        {d.concrete_today.reduce((s, c) => s + (Number(c.qty) || 0), 0).toFixed(2)} Cum
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Labour */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Staff */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Staff ({totalStaff} total)</h3>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Category</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Nos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(d.staff || []).filter(s => s.nos).map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">{s.category}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{s.nos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Direct Workers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Direct Workers (Day: {totalDirect.day} | Night: {totalDirect.night})
                </h3>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Category</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Day</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Night</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(d.direct_workers || []).filter(w => w.day || w.night).map((w, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">{w.category}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{w.day || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{w.night || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Plant & Machinery */}
          {d.plant_items?.some(p => p.nos) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Plant & Machinery</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {d.plant_items.filter(p => p.nos).map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-600">{p.item}</span>
                    <span className="text-xs font-bold text-slate-800 ml-2">{p.nos}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steel */}
          {d.steel?.some(s => s.receipts_today || s.available || s.consumption) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Steel – Material Report</h3>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Dia', 'Receipts Today', 'Till Date', 'Available', 'Consumption'].map(h => (
                        <th key={h} className="px-3 py-2 text-right first:text-left font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {d.steel.filter(s => s.receipts_today || s.available || s.consumption).map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-800">{s.dia}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{s.receipts_today || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{s.receipts_till_date || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{s.available || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-indigo-700">{s.consumption || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Constraints & Footer */}
          {(d.constraints || d.rfi) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {d.constraints && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Constraints</div>
                  <p className="text-xs text-amber-800 leading-relaxed">{d.constraints}</p>
                </div>
              )}
              {d.rfi && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">RFI / Open Issues</div>
                  <p className="text-xs text-blue-800 leading-relaxed">{d.rfi}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InfoCell label="Prepared By" value={d.prepared_by} />
            <InfoCell label="Approved By" value={d.approved_by} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => { if (window.confirm('Delete this DPR?')) deleteMut.mutate(d.id); }}
            className="flex items-center gap-1.5 px-3 py-2 text-red-600 text-xs font-medium hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function DPRModal({ projectId, existing, onClose, qc }) {
  const [form, setForm] = useState(existing ? { ...existing } : emptyDraft());
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isEdit = !!existing;
  const { data: subcontractWorkOrders = [] } = useQuery({
    queryKey: ['subcontractor-work-orders', projectId],
    queryFn: () => subcontractorAPI.listWorkOrders({ project_id: projectId }).then(r => r.data?.data ?? []),
    enabled: !!projectId,
  });
  const { data: subcontractorVendors = [] } = useQuery({
    queryKey: ['subcontractor-vendors'],
    queryFn: () => vendorAPI.list({ type: 'subcontractor' }).then(r => r.data?.data ?? r.data?.vendors ?? []),
    staleTime: 1000 * 60 * 5,
  });

  const saveMut = useMutation({
    mutationFn: d => isEdit ? planningAPI.updateDPR(existing.id, d) : planningAPI.createDPR(d),
    onSuccess: () => {
      toast.success(isEdit ? 'DPR updated' : 'DPR created');
      qc.invalidateQueries({ queryKey: ['dpr-list'] });
      onClose();
    },
    onError: e => toast.error(e?.response?.data?.error || 'Save failed'),
  });

  const handleSubmit = () => {
    if (!form.report_date) return toast.error('Report date is required');
    saveMut.mutate({ ...form, project_id: projectId });
  };

  // ── Helpers for table editors ────────────────────────────────────
  const updateRow = (key, idx, field, val) => {
    const arr = [...form[key]];
    arr[idx] = { ...arr[idx], [field]: val };
    F(key, arr);
  };

  const addRow = (key, template) => F(key, [...form[key], template]);
  const removeRow = (key, idx) => F(key, form[key].filter((_, i) => i !== idx));
  const subcontractorOptions = useMemo(() => {
    const fromVendors = (subcontractorVendors || []).map((vendor) => ({
      value: `vendor:${vendor.id}`,
      vendor_id: vendor.id,
      name: vendor.name,
      work: '',
      source: 'vendor',
    }));

    const seen = new Set(fromVendors.map((item) => item.vendor_id));
    const fromWorkOrders = (subcontractWorkOrders || [])
      .filter((wo) => !seen.has(wo.vendor_id))
      .map((wo) => ({
        value: `wo:${wo.id}`,
        vendor_id: wo.vendor_id || '',
        subcontract_wo_id: wo.id,
        name: wo.vendor_name || '',
        work: wo.subject || '',
        source: 'work_order',
      }));

    return [...fromVendors, ...fromWorkOrders];
  }, [subcontractorVendors, subcontractWorkOrders]);
  const updateSubcontractorSelection = (idx, workOrderId) => {
    const selectedOption = subcontractorOptions.find((option) => option.value === workOrderId);
    const arr = [...form.subcontractors];

    if (!selectedOption) {
      arr[idx] = {
        ...arr[idx],
        subcontract_wo_id: '',
        vendor_id: '',
        name: '',
        work: '',
      };
    } else {
      const matchedWorkOrder = selectedOption.source === 'work_order'
        ? subcontractWorkOrders.find((wo) => String(wo.id) === String(selectedOption.subcontract_wo_id))
        : subcontractWorkOrders.find((wo) => String(wo.vendor_id) === String(selectedOption.vendor_id));

      arr[idx] = {
        ...arr[idx],
        subcontract_wo_id: matchedWorkOrder?.id || '',
        vendor_id: selectedOption.vendor_id || '',
        name: selectedOption.name || '',
        work: matchedWorkOrder?.subject || selectedOption.work || arr[idx].work || '',
      };
    }

    F('subcontractors', arr);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 flex flex-col my-6">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit DPR' : 'New Daily Progress Report'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? `Editing report for ${dayjs(existing.report_date).format('DD MMM YYYY')}` : 'Fill in today\'s site progress'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">

          {/* ── Section 1: Project Header ─────────────────────────── */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Report Details
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Lbl>Report Date *</Lbl>
                <Inp type="date" value={form.report_date} onChange={e => F('report_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Lbl>Weather</Lbl>
                <Sel value={form.weather} onChange={e => F('weather', e.target.value)}>
                  {WEATHER_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </Sel>
              </div>
              <div className="space-y-1">
                <Lbl>Site Conditions</Lbl>
                <Sel value={form.site_conditions} onChange={e => F('site_conditions', e.target.value)}>
                  {['Dry','Slushy','Wet','Rainy'].map(c => <option key={c} value={c}>{c}</option>)}
                </Sel>
              </div>
              <div className="space-y-1">
                <Lbl>Rain Log</Lbl>
                <Inp placeholder="e.g. Light rain 1hr" value={form.rain_log} onChange={e => F('rain_log', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Section 2: Work Progress ──────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5" /> Work Progress
              </div>
              <button
                onClick={() => addRow('work_items', { description: '', unit: 'Cum', boq_qty: '', planned: '', achieved: '', cumulative: '', remarks: '' })}
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Row
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Activity Description', 'Unit', 'BOQ Qty', 'Planned', 'Achieved', 'Cumulative', 'Remarks', ''].map(h => (
                      <th key={h} className="px-2 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {form.work_items.map((row, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <Inp placeholder="e.g. Slab Concrete 22F" value={row.description} onChange={e => updateRow('work_items', i, 'description', e.target.value)} className="min-w-44" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Sel value={row.unit} onChange={e => updateRow('work_items', i, 'unit', e.target.value)} className="w-20">
                          {['Cum','Sqm','MT','Nos','RM','Kg','Bags','Rmt'].map(u => <option key={u}>{u}</option>)}
                        </Sel>
                      </td>
                      <td className="px-2 py-1.5"><Inp type="number" className="w-20" value={row.boq_qty} onChange={e => updateRow('work_items', i, 'boq_qty', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><Inp type="number" className="w-20" value={row.planned} onChange={e => updateRow('work_items', i, 'planned', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><Inp type="number" className="w-20" value={row.achieved} onChange={e => updateRow('work_items', i, 'achieved', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><Inp type="number" className="w-24" value={row.cumulative} onChange={e => updateRow('work_items', i, 'cumulative', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><Inp placeholder="Notes…" className="min-w-28" value={row.remarks} onChange={e => updateRow('work_items', i, 'remarks', e.target.value)} /></td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeRow('work_items', i)} className="p-1 text-slate-300 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 3: Concrete Consumption ──────────────────── */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" /> Concrete Consumption Today
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Grade', 'Supplier / Source', 'Qty (Cum)'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {form.concrete_today.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-semibold text-slate-700 whitespace-nowrap">{c.grade}</td>
                      <td className="px-3 py-1.5">
                        <Inp
                          placeholder="e.g. IJM / Batching Plant / RDC"
                          value={c.supplier}
                          onChange={e => updateRow('concrete_today', i, 'supplier', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Inp
                          type="number"
                          className="w-28"
                          placeholder="0.00"
                          value={c.qty}
                          onChange={e => updateRow('concrete_today', i, 'qty', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                    <td className="px-3 py-2 font-bold text-indigo-800" colSpan={2}>Total</td>
                    <td className="px-3 py-2 font-bold text-indigo-800">
                      {form.concrete_today.reduce((s, c) => s + (Number(c.qty) || 0), 0).toFixed(2)} Cum
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 4: Labour ────────────────────────────────── */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Resources – Labour
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Staff */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Staff</div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-left font-semibold text-slate-500">Category</th>
                        <th className="px-2 py-2 text-right font-semibold text-slate-500 w-16">Nos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {form.staff.map((s, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 text-slate-600 text-[11px]">{s.category}</td>
                          <td className="px-2 py-1.5">
                            <Inp type="number" className="w-full text-right" value={s.nos} onChange={e => updateRow('staff', i, 'nos', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t border-slate-200">
                        <td className="px-2 py-2 font-bold text-slate-700 text-[11px]">Total</td>
                        <td className="px-2 py-2 text-right font-bold text-slate-700">
                          {form.staff.reduce((s, r) => s + (Number(r.nos) || 0), 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Direct Workers */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Direct Workers</div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-left font-semibold text-slate-500">Category</th>
                        <th className="px-2 py-2 text-center font-semibold text-slate-500 w-14">Day</th>
                        <th className="px-2 py-2 text-center font-semibold text-slate-500 w-14">Night</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {form.direct_workers.map((w, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 text-slate-600 text-[11px]">{w.category}</td>
                          <td className="px-2 py-1.5">
                            <Inp type="number" className="w-full text-center" value={w.day} onChange={e => updateRow('direct_workers', i, 'day', e.target.value)} />
                          </td>
                          <td className="px-2 py-1.5">
                            <Inp type="number" className="w-full text-center" value={w.night} onChange={e => updateRow('direct_workers', i, 'night', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t border-slate-200">
                        <td className="px-2 py-2 font-bold text-slate-700 text-[11px]">Total</td>
                        <td className="px-2 py-2 text-center font-bold text-slate-700">
                          {form.direct_workers.reduce((s, r) => s + (Number(r.day) || 0), 0)}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-slate-700">
                          {form.direct_workers.reduce((s, r) => s + (Number(r.night) || 0), 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Subcontractors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-700">Subcontractors</div>
                  <button
                    onClick={() => addRow('subcontractors', { subcontract_wo_id: '', vendor_id: '', name: '', work: '', day: '', night: '' })}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {form.subcontractors.map((s, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sel
                          value={
                            s.vendor_id
                              ? (s.subcontract_wo_id ? `wo:${s.subcontract_wo_id}` : `vendor:${s.vendor_id}`)
                              : ''
                          }
                          onChange={e => updateSubcontractorSelection(i, e.target.value)}
                          className="flex-1"
                        >
                          <option value="">Select subcontractor</option>
                          {subcontractorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.name}{option.work ? ` - ${option.work}` : ''}
                            </option>
                          ))}
                        </Sel>
                        <button onClick={() => removeRow('subcontractors', i)} className="p-1 text-slate-300 hover:text-red-500 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <Inp
                        placeholder="Work / Trade"
                        value={s.work}
                        onChange={e => updateRow('subcontractors', i, 'work', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Inp type="number" placeholder="Day" value={s.day} onChange={e => updateRow('subcontractors', i, 'day', e.target.value)} />
                        <Inp type="number" placeholder="Night" value={s.night} onChange={e => updateRow('subcontractors', i, 'night', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 5: Plant & Machinery ─────────────────────── */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5" /> Plant & Machinery
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {form.plant_items.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-600 flex-1">{p.item}</span>
                  <Inp
                    type="number"
                    className="w-16 text-center"
                    placeholder="0"
                    value={p.nos}
                    onChange={e => updateRow('plant_items', i, 'nos', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 6: Steel ─────────────────────────────────── */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" /> Material – Steel (Fe 500, MT)
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Dia', 'Receipts Today (MT)', 'Till Date (MT)', 'Available (MT)', 'Consumption Today (MT)'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {form.steel.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-semibold text-slate-700 whitespace-nowrap">{s.dia}</td>
                      <td className="px-3 py-1.5"><Inp type="number" placeholder="0" value={s.receipts_today} onChange={e => updateRow('steel', i, 'receipts_today', e.target.value)} /></td>
                      <td className="px-3 py-1.5"><Inp type="number" placeholder="0" value={s.receipts_till_date} onChange={e => updateRow('steel', i, 'receipts_till_date', e.target.value)} /></td>
                      <td className="px-3 py-1.5"><Inp type="number" placeholder="0" value={s.available} onChange={e => updateRow('steel', i, 'available', e.target.value)} /></td>
                      <td className="px-3 py-1.5"><Inp type="number" placeholder="0" value={s.consumption} onChange={e => updateRow('steel', i, 'consumption', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 7: Constraints & Sign-off ─────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Lbl>Constraints / Issues</Lbl>
              <textarea
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 resize-none"
                placeholder="Any constraints, issues or blockers on site today…"
                value={form.constraints}
                onChange={e => F('constraints', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Lbl>RFI / Open Items</Lbl>
              <textarea
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 resize-none"
                placeholder="Any RFI raised, pending approvals…"
                value={form.rfi}
                onChange={e => F('rfi', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Lbl>Prepared By</Lbl>
              <Inp placeholder="Engineer name" value={form.prepared_by} onChange={e => F('prepared_by', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Lbl>Approved By</Lbl>
              <Inp placeholder="Project Director / PM" value={form.approved_by} onChange={e => F('approved_by', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 flex-shrink-0 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveMut.isPending}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saveMut.isPending ? 'Saving…' : isEdit ? 'Update DPR' : 'Submit DPR'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DPRPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canCreate = ['project_manager', 'site_engineer', 'admin', 'super_admin'].includes(user?.role);

  const [projectId, setProjectId]   = useState('');
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusF]  = useState('all');
  const [showModal, setShowModal]   = useState(false);
  const [selected, setSelected]     = useState(null);  // DPR to view
  const [editDPR, setEditDPR]       = useState(null);  // DPR to edit
  const importInputRef = useRef(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data ?? []),
  });

  const { data: dprs = [], isLoading } = useQuery({
    queryKey: ['dpr-list', projectId],
    queryFn: () => planningAPI.listDPRs({ project_id: projectId }).then(r => r.data.data),
    enabled: !!projectId,
  });

  const selectedProject = projects.find(p => p.id === projectId);

  const importMut = useMutation({
    mutationFn: file => planningAPI.importDPR(file, projectId),
    onSuccess: (res) => {
      const summary = res.data?.summary;
      const action = summary?.mode === 'updated' ? 'updated' : 'imported';
      toast.success(`DPR ${action} for ${summary?.report_date || 'selected date'}`);
      qc.invalidateQueries({ queryKey: ['dpr-list'] });
      if (importInputRef.current) importInputRef.current.value = '';
    },
    onError: e => {
      const message = e?.response?.data?.error || e?.message || 'DPR import failed';
      toast.error(message);
      if (importInputRef.current) importInputRef.current.value = '';
    },
  });

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importMut.mutate(file);
  };

  const filtered = useMemo(() => {
    let list = dprs;
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        dayjs(d.report_date).format('DD MMM YYYY').toLowerCase().includes(q) ||
        (d.prepared_by || '').toLowerCase().includes(q) ||
        (d.weather || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.report_date) - new Date(a.report_date));
  }, [dprs, search, statusFilter]);

  // ── KPI summary ───────────────────────────────────────────────────
  const totalDPRs    = dprs.length;
  const approvedDPRs = dprs.filter(d => d.status === 'approved').length;
  const draftDPRs    = dprs.filter(d => d.status === 'draft').length;
  const thisMonthDPRs = dprs.filter(d => dayjs(d.report_date).isSame(dayjs(), 'month')).length;

  const kpis = [
    { label: 'Total Reports',   value: totalDPRs,     sub: 'All time',           icon: FileText,    color: 'text-indigo-600',  dot: 'bg-indigo-500' },
    { label: 'This Month',      value: thisMonthDPRs,  sub: dayjs().format('MMM YYYY'), icon: Calendar,    color: 'text-blue-600',    dot: 'bg-blue-500' },
    { label: 'Approved',        value: approvedDPRs,   sub: 'Reviewed & signed',  icon: CheckCircle2,color: 'text-emerald-600', dot: 'bg-emerald-500' },
    { label: 'Pending Review',  value: draftDPRs,      sub: 'Awaiting approval',  icon: Clock,       color: 'text-amber-600',   dot: 'bg-amber-400' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <FileText className="w-3.5 h-3.5" /> Planning & Execution
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Progress Report</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Site progress, labour, concrete & material tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 shadow-sm w-72"
          >
            <option value="">— Select a project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {projectId && canCreate && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <Upload className="w-4 h-4" /> {importMut.isPending ? 'Importing...' : 'Import Excel'}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" /> New DPR
              </button>
            </>
          )}
        </div>
      </div>

      {!projectId ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-16 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Select a project to view its Daily Progress Reports</p>
          <p className="text-slate-400 text-xs mt-1">All DPR data is project-specific</p>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpis.map(({ label, value, sub, icon: Icon, color, dot }) => (
              <div
                key={label}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={clsx('w-4 h-4', color)} />
                  <span className={clsx('w-2 h-2 rounded-full', dot)} />
                </div>
                <div className="text-2xl font-bold text-slate-900">{value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                <div className="text-xs text-slate-300 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Project Info Banner ─────────────────────────────── */}
          {selectedProject && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-3.5 mb-5 flex flex-wrap items-center gap-4">
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Project</div>
                <div className="text-sm font-bold text-slate-800">{selectedProject.name}</div>
              </div>
              {selectedProject.client && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Client</div>
                  <div className="text-sm text-slate-600">{selectedProject.client}</div>
                </div>
              )}
              {selectedProject.start_date && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Start Date</div>
                  <div className="text-sm text-slate-600">{dayjs(selectedProject.start_date).format('DD MMM YYYY')}</div>
                </div>
              )}
              {selectedProject.end_date && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Target Completion</div>
                  <div className="text-sm text-slate-600">{dayjs(selectedProject.end_date).format('DD MMM YYYY')}</div>
                </div>
              )}
              <div className="ml-auto">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Balance Days</div>
                <div className="text-sm font-bold text-slate-800">
                  {selectedProject.end_date
                    ? Math.max(0, dayjs(selectedProject.end_date).diff(dayjs(), 'day')) + 'd'
                    : '—'}
                </div>
              </div>
            </div>
          )}

          {/* ── Toolbar ────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3 shadow-sm">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by date, prepared by…"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[['all','All'], ['draft','Draft'], ['submitted','Submitted'], ['approved','Approved']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setStatusF(val)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    statusFilter === val
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {dprs.length} reports</span>
          </div>

          {/* ── DPR Table ───────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Report Date', 'Weather', 'Site Conditions', 'Prepared By', 'Status', 'Created At', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-400">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">No DPR records found</p>
                      {canCreate && (
                        <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-indigo-600 hover:underline">
                          + Submit the first DPR
                        </button>
                      )}
                    </td></tr>
                  ) : (
                    filtered.map(dpr => (
                      <DPRRow
                        key={dpr.id}
                        dpr={dpr}
                        onView={d => setSelected(d)}
                        onEdit={d => { setEditDPR(d); setSelected(null); }}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
              {filtered.length} of {dprs.length} daily progress reports
            </div>
          </div>
        </>
      )}

      {/* ── View Slide-over ─────────────────────────────────────── */}
      {selected && (
        <DPRViewPanel
          dpr={selected}
          project={selectedProject}
          onClose={() => setSelected(null)}
          onEdit={d => { setEditDPR(d); setSelected(null); }}
          qc={qc}
        />
      )}

      {/* ── Add Modal ───────────────────────────────────────────── */}
      {showModal && (
        <DPRModal
          projectId={projectId}
          existing={null}
          onClose={() => setShowModal(false)}
          qc={qc}
        />
      )}

      {/* ── Edit Modal ──────────────────────────────────────────── */}
      {editDPR && (
        <DPRModal
          projectId={projectId}
          existing={editDPR}
          onClose={() => setEditDPR(null)}
          qc={qc}
        />
      )}
    </div>
  );
}
