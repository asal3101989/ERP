// src/pages/assets/AssetPage.jsx
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Wrench, AlertTriangle, Truck, Settings, Fuel, Gauge, MapPin,
  Calendar, Clock, CheckCircle2, Zap, History, Search, Download,
  ChevronRight, X, Package, Box, ArrowRightLeft, FileText, MoreVertical,
  Activity, IndianRupee, ClipboardList, TrendingUp,
} from 'lucide-react';
import { assetAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import AssetBarcodeCard from '../../components/common/AssetBarcodeCard';

const ASSET_TYPES = [
  'Excavator', 'Crane', 'Concrete Mixer', 'Generator', 'Compactor',
  'Tipper Truck', 'JCB', 'Water Tanker', 'Scaffolding Set',
  'Bar Bending Machine', 'Concrete Pump', 'Tower Crane',
  'Survey Equipment', 'Power Tools', 'Other'
];

const STATUS_CONFIG = {
  available:   { label: 'Idle / Available', short: 'Idle',        color: 'bg-slate-50 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   icon: Clock },
  assigned:    { label: 'Deployed on Site', short: 'Deployed',    color: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500',    icon: Zap },
  maintenance: { label: 'Under Maintenance',short: 'In Service',  color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500',   icon: Wrench },
  breakdown:   { label: 'Breakdown',        short: 'Breakdown',   color: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500',     icon: AlertTriangle },
  disposed:    { label: 'Decommissioned',   short: 'Disposed',    color: 'bg-slate-100 text-slate-500 border-slate-200',  dot: 'bg-slate-400',   icon: History },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap', cfg.color)}>
      <Icon size={11} strokeWidth={2.5} /> {cfg.short}
    </span>
  );
}

export default function AssetPage() {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(null); // { type, asset }
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [search, setSearch]             = useState('');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets-fleet'],
    queryFn: () => assetAPI.list().then(r => r.data.data),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.asset_name?.toLowerCase().includes(q) &&
            !a.asset_code?.toLowerCase().includes(q) &&
            !a.asset_type?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [assets, statusFilter, typeFilter, search]);

  const stats = [
    { key: 'all',         label: 'Total Assets',  icon: Truck,         tone: 'text-slate-700',   dot: 'bg-slate-400'   },
    { key: 'assigned',    label: 'Deployed',      icon: Zap,           tone: 'text-blue-700',    dot: 'bg-blue-500'    },
    { key: 'maintenance', label: 'In Service',    icon: Wrench,        tone: 'text-amber-700',   dot: 'bg-amber-500'   },
    { key: 'breakdown',   label: 'Breakdowns',    icon: AlertTriangle, tone: 'text-red-700',     dot: 'bg-red-500'     },
  ];

  const totalValue = assets.reduce((s, a) => s + parseFloat(a.purchase_value || 0), 0);

  const exportToCSV = () => {
    const headers = ['Code', 'Name', 'Type', 'Brand/Model', 'Status', 'Site', 'Meter', 'Purchase Value'];
    const rows = filtered.map(a => [
      a.asset_code, a.asset_name, a.asset_type, `${a.brand || ''} ${a.model || ''}`.trim(),
      STATUS_CONFIG[a.status]?.label || a.status,
      a.current_project_name || 'Yard',
      `${a.current_meter || 0} ${a.meter_type || ''}`,
      a.purchase_value || 0,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Fleet_Register_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
    toast.success('Exporting fleet register…');
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Truck className="w-3.5 h-3.5" /> Assets
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Plant &amp; Machinery Fleet</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Track deployment, fuel, service schedules and operational telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {stats.map(({ key, label, icon: Icon, tone, dot }) => {
          const count = key === 'all' ? assets.length : assets.filter(a => a.status === key).length;
          const isActive = statusFilter === key || (key === 'all' && statusFilter === 'all');
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key === 'all' ? 'all' : (statusFilter === key ? 'all' : key))}
              className={clsx(
                'bg-white border rounded-xl p-4 text-left shadow-sm transition-all hover:shadow-md',
                isActive ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={clsx('w-4 h-4', tone)} />
                <span className={clsx('w-2 h-2 rounded-full', dot)} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{count}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </button>
          );
        })}

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            ₹{(totalValue / 100000).toFixed(1)}L
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Total Book Value</div>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, name, type…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
          />
        </div>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="all">All Types</option>
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[['all', 'All'], ['available', 'Idle'], ['assigned', 'Deployed'], ['maintenance', 'Service'], ['breakdown', 'Breakdown']].map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                statusFilter === val
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
              )}
            >
              {lbl}
              {val !== 'all' && <span className="ml-1 opacity-70">{assets.filter(a => a.status === val).length}</span>}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 ml-auto hidden sm:block">
          {filtered.length} of {assets.length}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Code', 'Asset', 'Type', 'Site', 'Meter', 'Status', 'Service Due', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(asset => {
                const isServiceDue = asset.next_service_date && dayjs(asset.next_service_date).isBefore(dayjs().add(7, 'day'));
                return (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-bold font-mono text-indigo-600 group-hover:underline">
                        {asset.asset_code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                          {(asset.asset_type === 'Tipper Truck' || asset.asset_type === 'Water Tanker')
                            ? <Truck className="w-4 h-4" />
                            : <Settings className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{asset.asset_name}</div>
                          {(asset.brand || asset.model) && (
                            <div className="text-[11px] text-slate-400">{asset.brand} {asset.model}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        {asset.asset_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {asset.current_project_name || 'Central Yard'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-mono font-semibold text-slate-700">
                        {parseFloat(asset.current_meter || 0).toLocaleString()}
                        <span className="text-slate-400 ml-1 font-sans font-normal">{asset.meter_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {asset.next_service_date ? (
                        <span className={clsx(
                          'text-xs font-medium inline-flex items-center gap-1',
                          isServiceDue ? 'text-amber-600' : 'text-slate-500'
                        )}>
                          <Calendar className="w-3 h-3" />
                          {dayjs(asset.next_service_date).format('DD MMM')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">No assets found</p>
                    <p className="text-xs text-slate-300 mt-1">Adjust your filters or add a new asset</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          Showing {filtered.length} of {assets.length} assets
        </div>
      </div>

      {/* ── Detail Slide-over ─────────────────────────── */}
      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onLog={(type) => setShowLogModal({ type, asset: selectedAsset })}
        />
      )}

      {/* ── Modals ───────────────────────────────────── */}
      {showLogModal && (
        <LogModal
          config={showLogModal}
          onClose={() => setShowLogModal(null)}
          projects={projects}
        />
      )}
      {showAddModal && (
        <AddAssetModal
          onClose={() => setShowAddModal(false)}
          projects={projects}
        />
      )}
    </div>
  );
}

// ─── Detail Slide-over Panel ────────────────────────────────────────
function AssetDetailPanel({ asset, onClose, onLog }) {
  const cfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available;
  const efficiency = asset.total_units_worked > 0
    ? (asset.total_fuel_consumed / asset.total_units_worked).toFixed(2)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[600px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-indigo-600 font-bold">{asset.asset_code}</div>
              <h2 className="text-base font-bold text-slate-900">{asset.asset_name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={asset.status} />
            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label="Type" value={asset.asset_type} />
            <InfoCell label="Brand / Model" value={`${asset.brand || '—'} ${asset.model || ''}`.trim()} />
            <InfoCell label="Fuel Type" value={asset.fuel_type || '—'} />
            <InfoCell label="Site" value={asset.current_project_name || 'Central Yard'} icon={MapPin} />
            <InfoCell label="Purchase Date" value={asset.purchase_date ? dayjs(asset.purchase_date).format('DD MMM YYYY') : '—'} />
            <InfoCell label="Purchase Value" value={asset.purchase_value ? `₹${parseFloat(asset.purchase_value).toLocaleString('en-IN')}` : '—'} />
          </div>

          <AssetBarcodeCard
            value={asset.qr_code || asset.asset_code}
            title={asset.asset_name}
            subtitle={asset.asset_type || 'Plant Asset'}
            metaLabel="Asset Code"
            metaValue={asset.asset_code}
          />

          {/* Telemetry */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Operational Telemetry
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <TelCard label="Current Meter" value={parseFloat(asset.current_meter || 0).toLocaleString()} unit={asset.meter_type} icon={Gauge} tone="text-indigo-600" />
              <TelCard label="Total Fuel" value={parseFloat(asset.total_fuel_consumed || 0).toFixed(0)} unit="Litres" icon={Fuel} tone="text-amber-600" />
              <TelCard label="Efficiency" value={efficiency || '—'} unit={efficiency ? `L/${asset.meter_type === 'Hours' ? 'Hr' : 'Km'}` : ''} icon={TrendingUp} tone="text-emerald-600" />
            </div>
          </div>

          {/* Service alert */}
          {asset.next_service_date && (
            <div className={clsx(
              'rounded-lg p-3 flex items-center gap-3 border',
              dayjs(asset.next_service_date).isBefore(dayjs().add(7, 'day'))
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'
            )}>
              <Calendar className={clsx(
                'w-4 h-4',
                dayjs(asset.next_service_date).isBefore(dayjs().add(7, 'day')) ? 'text-amber-600' : 'text-slate-500'
              )} />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-700">Next Service Due</div>
                <div className="text-xs text-slate-500">{dayjs(asset.next_service_date).format('DD MMM YYYY')}</div>
              </div>
              <span className="text-xs font-medium text-slate-600">
                {dayjs(asset.next_service_date).fromNow?.() || dayjs(asset.next_service_date).format('DD/MM/YY')}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions Menu */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onLog('usage')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-all"
          >
            <Gauge className="w-4 h-4" /> Log Usage
          </button>
          <button
            onClick={() => onLog('fuel')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Fuel className="w-4 h-4" /> Fill Diesel
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, icon: Icon }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {value}
      </div>
    </div>
  );
}

function TelCard({ label, value, unit, icon: Icon, tone }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className={clsx('w-3.5 h-3.5', tone)} />
      </div>
      <div className="text-lg font-bold text-slate-900 font-mono">
        {value}
        {unit && <span className="text-[11px] text-slate-400 ml-1 font-sans font-normal">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Log Modal (Fuel or Usage) ──────────────────────────────────────
function LogModal({ config, onClose, projects }) {
  const { asset, type } = config;
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    project_id: asset.current_location || '',
    quantity: '', rate_per_liter: 92.5,
    meter_reading: asset.current_meter || '',
    start_meter: asset.current_meter || '', end_meter: '',
    operator_name: '', activity_name: '', remarks: ''
  });

  const mutation = useMutation({
    mutationFn: (d) => type === 'fuel' ? assetAPI.logFuel(d) : assetAPI.logUsage(d),
    onSuccess: () => {
      toast.success(type === 'fuel' ? 'Fuel log saved' : 'Usage log saved');
      qc.invalidateQueries({ queryKey: ['assets-fleet'] });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Logging failed'),
  });

  const handleSubmit = () => mutation.mutate({ asset_id: asset.id, ...formData });

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              {type === 'fuel' ? <Fuel className="w-4 h-4" /> : <Gauge className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {type === 'fuel' ? 'Log Fuel Filling' : 'Log Daily Usage'}
              </h2>
              <p className="text-xs text-slate-500">{asset.asset_name} • <span className="font-mono">{asset.asset_code}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <Field label="Project / Site">
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={formData.project_id}
              onChange={e => setFormData(p => ({ ...p, project_id: e.target.value }))}
            >
              <option value="">Select project…</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          {type === 'fuel' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Litres Filled">
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400"
                  value={formData.quantity}
                  onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                />
              </Field>
              <Field label="Meter Reading">
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400"
                  value={formData.meter_reading}
                  onChange={e => setFormData(p => ({ ...p, meter_reading: e.target.value }))}
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Start (${asset.meter_type})`}>
                <input
                  type="number"
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-500"
                  value={formData.start_meter}
                  readOnly
                />
              </Field>
              <Field label="End Reading">
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400"
                  value={formData.end_meter}
                  onChange={e => setFormData(p => ({ ...p, end_meter: e.target.value }))}
                />
              </Field>
            </div>
          )}

          <Field label="Operator / Driver Name">
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="e.g. Rajesh Kumar"
              value={formData.operator_name}
              onChange={e => setFormData(p => ({ ...p, operator_name: e.target.value }))}
            />
          </Field>

          <Field label="Remarks">
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
              rows={3}
              placeholder="Breakdown notes, observations…"
              value={formData.remarks}
              onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            {mutation.isPending ? 'Saving…' : 'Submit Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Asset Modal ────────────────────────────────────────────────
function AddAssetModal({ onClose, projects }) {
  const [form, setForm] = useState({
    asset_code: '', asset_name: '', asset_type: 'Excavator',
    brand: '', model: '', current_location: '',
    purchase_value: '', purchase_date: '', meter_type: 'Hours',
    current_meter: '', fuel_type: 'Diesel'
  });
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: (d) => assetAPI.create(d),
    onSuccess: () => { toast.success('Asset added'); qc.invalidateQueries({ queryKey: ['assets-fleet'] }); onClose(); },
    onError: () => toast.error('Failed to add asset'),
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Register New Asset</h2>
              <p className="text-xs text-slate-500">Add new plant or machinery to the fleet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset Code"><input className="input-light" placeholder="e.g. EX-001" value={form.asset_code} onChange={e => setForm(f => ({ ...f, asset_code: e.target.value }))} /></Field>
            <Field label="Display Name"><input className="input-light" placeholder="e.g. JCB 4DX-3" value={form.asset_name} onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))} /></Field>

            <Field label="Asset Type">
              <select className="input-light" value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}>
                {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Fuel Type">
              <select className="input-light" value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                <option>Diesel</option><option>Petrol</option><option>Electric</option><option>Manual</option>
              </select>
            </Field>

            <Field label="Brand"><input className="input-light" placeholder="e.g. Tata, JCB" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></Field>
            <Field label="Model"><input className="input-light" placeholder="e.g. 4DX, 3CX" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></Field>

            <Field label="Meter Type">
              <select className="input-light" value={form.meter_type} onChange={e => setForm(f => ({ ...f, meter_type: e.target.value }))}>
                <option value="Hours">Working Hours</option>
                <option value="Km">Kilometers</option>
              </select>
            </Field>
            <Field label="Initial Meter Reading">
              <input type="number" className="input-light font-mono" value={form.current_meter} onChange={e => setForm(f => ({ ...f, current_meter: e.target.value }))} />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-5 grid grid-cols-2 gap-3">
            <Field label="Purchase Date"><input type="date" className="input-light" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></Field>
            <Field label="Purchase Value (₹)"><input type="number" className="input-light font-mono" value={form.purchase_value} onChange={e => setForm(f => ({ ...f, purchase_value: e.target.value }))} /></Field>
          </div>

          <Field label="Base Location / Site">
            <select className="input-light" value={form.current_location} onChange={e => setForm(f => ({ ...f, current_location: e.target.value }))}>
              <option value="">Unassigned (Central Yard)</option>
              {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => createMut.mutate(form)}
            disabled={createMut.isPending}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            {createMut.isPending ? 'Saving…' : 'Register Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable bits ──────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

// Inline utility: input-light style (since not in a global stylesheet)
const styleTag = `
  .input-light {
    width: 100%;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #0f172a;
    outline: none;
    transition: border-color 0.15s;
  }
  .input-light:focus { border-color: #818cf8; }
`;
if (typeof document !== 'undefined' && !document.getElementById('asset-page-styles')) {
  const s = document.createElement('style');
  s.id = 'asset-page-styles';
  s.textContent = styleTag;
  document.head.appendChild(s);
}
