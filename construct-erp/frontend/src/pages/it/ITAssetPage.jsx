// src/pages/it/ITAssetPage.jsx  —  ManageEngine-style redesign
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Cpu, Plus, X, AlertTriangle, Monitor, Server, Laptop, Network,
  Printer, ShieldAlert, HelpCircle, Zap, Search, RefreshCw,
  Edit2, Trash2, QrCode, ChevronRight, BarChart2, CheckCircle,
  Clock, Package, Settings, Eye, Upload, Download, FileSpreadsheet,
} from 'lucide-react';
import { itAssetAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import AssetBarcodeCard from '../../components/common/AssetBarcodeCard';

/* ─── Constants ─────────────────────────────────────────────── */
const ASSET_TYPES = [
  { key: 'all',       label: 'All Assets',  Icon: Package,    color: '#1a73e8' },
  { key: 'laptop',    label: 'Laptops',     Icon: Laptop,     color: '#1a73e8' },
  { key: 'desktop',   label: 'Desktops',    Icon: Monitor,    color: '#1a73e8' },
  { key: 'server',    label: 'Servers',     Icon: Server,     color: '#6c35de' },
  { key: 'network',   label: 'Network',     Icon: Network,    color: '#0f9d58' },
  { key: 'cctv',      label: 'CCTV',        Icon: Eye,        color: '#f4a100' },
  { key: 'biometric', label: 'Biometric',   Icon: ShieldAlert,color: '#f4a100' },
  { key: 'printer',   label: 'Printers',    Icon: Printer,    color: '#5f6368' },
  { key: 'ups',       label: 'UPS',         Icon: Zap,        color: '#d93025' },
  { key: 'other',     label: 'Others',      Icon: HelpCircle, color: '#5f6368' },
];

const STATUS_OPTIONS = [
  { key: 'all',          label: 'All Status',    dot: '#9aa0a6' },
  { key: 'in_use',       label: 'In Use',        dot: '#0f9d58' },
  { key: 'available',    label: 'Available',     dot: '#1a73e8' },
  { key: 'under_repair', label: 'Under Repair',  dot: '#f4a100' },
  { key: 'retired',      label: 'Retired',       dot: '#9aa0a6' },
  { key: 'lost',         label: 'Lost / Stolen', dot: '#d93025' },
];

const STATUS_BADGE = {
  in_use:       'bg-green-50 text-green-700 border border-green-200',
  available:    'bg-blue-50 text-blue-700 border border-blue-200',
  under_repair: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  retired:      'bg-gray-100 text-gray-600 border border-gray-200',
  lost:         'bg-red-50 text-red-700 border border-red-200',
};

const LABEL = {
  in_use: 'In Use', available: 'Available',
  under_repair: 'Under Repair', retired: 'Retired', lost: 'Lost/Stolen',
};

const TYPE_ICON = Object.fromEntries(ASSET_TYPES.slice(1).map(t => [t.key, t]));

/* ─── Main Component ─────────────────────────────────────────── */
export default function ITAssetPage() {
  const [showForm,      setShowForm]      = useState(false);
  const [editAsset,     setEditAsset]     = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [filterType,    setFilterType]    = useState('all');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [search,        setSearch]        = useState('');
  const [importing,     setImporting]     = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset, setValue } = useForm();
  const importRef = React.useRef(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['it-assets'],
    queryFn: () => itAssetAPI.list().then(r => r.data.data).catch(() => []),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => r.data.data || r.data).catch(() => []),
  });

  const createMutation = useMutation({
    mutationFn: payload => itAssetAPI.create(payload),
    onSuccess: () => { toast.success('Asset registered successfully'); reset(); setShowForm(false); qc.invalidateQueries({ queryKey: ['it-assets'] }); },
    onError:   () => toast.error('Failed to register asset'),
  });

  const allAssets = data || [];

  const filtered = allAssets.filter(a => {
    if (filterType   !== 'all' && a.asset_type !== filterType)   return false;
    if (filterStatus !== 'all' && a.status     !== filterStatus) return false;
    if (search && !`${a.asset_tag} ${a.brand} ${a.model} ${a.location_description || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const warrantyAlerts  = allAssets.filter(a => { const d = a.warranty_expiry ? dayjs(a.warranty_expiry).diff(dayjs(), 'day') : null; return d !== null && d >= 0 && d <= 90; });
  const totalValue      = allAssets.reduce((s, a) => s + parseFloat(a.purchase_cost || 0), 0);
  const inUseCount      = allAssets.filter(a => a.status === 'in_use').length;
  const availableCount  = allAssets.filter(a => a.status === 'available').length;

  const openEdit = asset => {
    setEditAsset(asset);
    Object.entries(asset).forEach(([k, v]) => setValue(k, v));
    setShowForm(true);
  };
  const closeForm = () => { reset(); setShowForm(false); setEditAsset(null); };

  /* ── Export CSV ── */
  const exportCSV = () => {
    const cols = ['asset_tag','asset_type','brand','model','serial_number','os','status',
                  'assigned_to_name','location_description','purchase_date','purchase_cost',
                  'warranty_expiry','project_name','notes'];
    const header = cols.join(',');
    const rows = allAssets.map(a =>
      cols.map(c => {
        const v = a[c] ?? '';
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(',')
    );
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `IT_Assets_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success(`Exported ${allAssets.length} assets`);
  };

  /* ── Download Template ── */
  const downloadTemplate = () => {
    const header = 'asset_tag,asset_type,brand,model,serial_number,os,purchase_date,purchase_cost,warranty_expiry,status,location_description,notes';
    const sample = 'IT-LAP-001,laptop,Dell,Latitude 5540,SN1234567,Windows 11 Pro,2024-01-15,85000,2027-01-15,in_use,HO - Accounts Dept,Assigned to finance team';
    const types  = '# asset_type: laptop | desktop | server | network | cctv | biometric | printer | ups | other';
    const status = '# status: in_use | available | under_repair | retired | lost';
    const blob = new Blob([[header, sample, types, status].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'IT_Assets_Import_Template.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  /* ── Import CSV ── */
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      if (lines.length < 2) { toast.error('No data rows found in CSV'); return; }
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
      }).filter(r => r.asset_tag && r.brand && r.model);
      if (!rows.length) { toast.error('No valid rows — check required columns: asset_tag, brand, model, asset_type'); return; }
      const res = await itAssetAPI.import(rows);
      toast.success(res.data?.message || 'Import complete');
      qc.invalidateQueries({ queryKey: ['it-assets'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  /* KPI Cards */
  const kpis = [
    { label: 'Total Assets',      value: allAssets.length,       icon: Package,      color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'In Use',            value: inUseCount,             icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Available',         value: availableCount,         icon: BarChart2,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Warranty Alerts',   value: warrantyAlerts.length,  icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Capital Value (L)', value: `₹${(totalValue/100000).toFixed(2)}L`, icon: Settings, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="flex h-full min-h-screen bg-gray-50">

      {/* ── Left Sidebar ── */}
      <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">IT Assets</span>
          </div>
        </div>

        {/* Asset Types */}
        <div className="flex-1 overflow-y-auto py-3">
          <div className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Asset Categories</div>
          {ASSET_TYPES.map(({ key, label, Icon }) => {
            const count = key === 'all' ? allAssets.length : allAssets.filter(a => a.asset_type === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterType(key)}
                className={clsx(
                  'flex w-full items-center gap-2.5 px-4 py-2 text-[13px] transition-colors',
                  filterType === key
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={clsx('h-4 w-4 shrink-0', filterType === key ? 'text-blue-600' : 'text-gray-400')} />
                <span className="flex-1 text-left">{label}</span>
                <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', filterType === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500')}>
                  {count}
                </span>
              </button>
            );
          })}

          <div className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Status Filter</div>
          {STATUS_OPTIONS.map(({ key, label, dot }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterStatus(key)}
              className={clsx(
                'flex w-full items-center gap-2.5 px-4 py-2 text-[13px] transition-colors',
                filterStatus === key
                  ? 'bg-blue-50 font-semibold text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
              {label}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <span>Assets & IT</span>
            <ChevronRight className="h-4 w-4" />
            <span className="font-semibold text-gray-800">IT Assets</span>
          </div>
          <div className="flex items-center gap-2">
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <button
              type="button"
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              title="Download CSV import template"
              className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> Template
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5 text-blue-500" />
              {importing ? 'Importing...' : 'Import CSV'}
            </button>
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5 text-indigo-500" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => { setEditAsset(null); reset(); setShowForm(true); }}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Asset
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpis.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={clsx('rounded p-1', bg)}>
                    <Icon className={clsx('h-4 w-4', color)} />
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-800">{value}</div>
              </div>
            ))}
          </div>

          {/* Warranty Alert Banner */}
          {warrantyAlerts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">{warrantyAlerts.length} asset(s) warranty expiring within 90 days</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {warrantyAlerts.map(a => (
                  <span key={a.id} className="rounded border border-amber-200 bg-white px-2 py-0.5 text-xs text-amber-700">
                    {a.asset_tag} — {dayjs(a.warranty_expiry).diff(dayjs(), 'day')}d left
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
              placeholder="Search by asset tag, brand, model, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}>
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Asset Table */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {filtered.length} Asset{filtered.length !== 1 ? 's' : ''} Found
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Asset Tag', 'Type', 'Brand / Model', 'Serial No.', 'Status', 'Deployed To', 'Location', 'Warranty', 'Value (INR)', 'Actions'].map(h => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(asset => {
                    const typeInfo  = TYPE_ICON[asset.asset_type] || { label: 'Other', Icon: HelpCircle, color: '#5f6368' };
                    const daysLeft  = asset.warranty_expiry ? dayjs(asset.warranty_expiry).diff(dayjs(), 'day') : null;
                    const { Icon: TypeIcon } = typeInfo;

                    return (
                      <tr key={asset.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">
                            {asset.asset_tag}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-700">
                            <TypeIcon className="h-3.5 w-3.5 text-gray-400" />
                            {typeInfo.label}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{asset.brand} {asset.model}</div>
                          {asset.os && <div className="text-xs text-gray-400">{asset.os}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {asset.serial_number || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={clsx('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_BADGE[asset.status] || STATUS_BADGE.available)}>
                            {LABEL[asset.status] || asset.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div>{asset.assigned_to_name || <span className="text-gray-300">—</span>}</div>
                          {asset.project_name && <div className="text-xs text-blue-500">{asset.project_name}</div>}
                        </td>
                        <td className="max-w-[160px] px-4 py-3 text-xs text-gray-500">
                          <div className="truncate">{asset.location_description || <span className="text-gray-300">—</span>}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">
                          {daysLeft === null ? (
                            <span className="text-gray-300">—</span>
                          ) : daysLeft < 0 ? (
                            <span className="text-red-600 font-semibold">Expired ({Math.abs(daysLeft)}d ago)</span>
                          ) : daysLeft <= 90 ? (
                            <span className="text-amber-600 font-semibold">{daysLeft}d left ⚠️</span>
                          ) : (
                            <span className="text-green-600">{dayjs(asset.warranty_expiry).format('DD MMM YYYY')}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-800">
                          {asset.purchase_cost ? `₹${parseInt(asset.purchase_cost, 10).toLocaleString('en-IN')}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="View QR Code"
                              onClick={() => setSelectedAsset(asset)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Edit Asset"
                              onClick={() => openEdit(asset)}
                              className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="mb-3 h-10 w-10 text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">No assets found</p>
                  <p className="mt-1 text-xs text-gray-300">Try adjusting your filters or add a new asset</p>
                </div>
              )}

              {isLoading && (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add / Edit Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600">
                  <Cpu className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{editAsset ? 'Edit Asset' : 'Add New Asset'}</h2>
                  <p className="text-xs text-gray-400">Fill in the asset details below</p>
                </div>
              </div>
              <button type="button" onClick={closeForm} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(createMutation.mutate)} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">

                <FormField label="Asset Tag *">
                  <input {...register('asset_tag', { required: true })} className={inputCls} placeholder="IT-LAP-001" />
                </FormField>

                <FormField label="Asset Type *">
                  <select {...register('asset_type', { required: true })} className={inputCls}>
                    <option value="">Select type</option>
                    {ASSET_TYPES.slice(1).map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </FormField>

                <FormField label="Status">
                  <select {...register('status')} className={inputCls}>
                    {STATUS_OPTIONS.slice(1).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </FormField>

                <FormField label="Brand *">
                  <input {...register('brand', { required: true })} className={inputCls} placeholder="Dell / HP / Lenovo" />
                </FormField>

                <FormField label="Model *">
                  <input {...register('model', { required: true })} className={inputCls} placeholder="Latitude 5540" />
                </FormField>

                <FormField label="Serial Number">
                  <input {...register('serial_number')} className={inputCls} placeholder="SN1234567" />
                </FormField>

                <FormField label="OS / Firmware">
                  <input {...register('os')} className={inputCls} placeholder="Windows 11 Pro" />
                </FormField>

                <FormField label="Purchase Date">
                  <input type="date" {...register('purchase_date')} className={inputCls} />
                </FormField>

                <FormField label="Purchase Cost (₹)">
                  <input type="number" {...register('purchase_cost')} className={inputCls} placeholder="85000" />
                </FormField>

                <FormField label="Warranty Expiry">
                  <input type="date" {...register('warranty_expiry')} className={inputCls} />
                </FormField>

                <FormField label="Assigned To">
                  <input {...register('assigned_to_name')} className={inputCls} placeholder="Employee name" />
                </FormField>

                <FormField label="Assigned Project">
                  <select {...register('location_project_id')} className={inputCls}>
                    <option value="">— No Project / HO —</option>
                    {(projectsData || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Location / Department">
                  <input {...register('location_description')} className={inputCls} placeholder="HO - Accounts Dept" />
                </FormField>

                <div className="col-span-2 sm:col-span-3">
                  <FormField label="Notes">
                    <textarea {...register('notes')} className={inputCls + ' resize-none'} rows={2} placeholder="Any additional notes about this asset..." />
                  </FormField>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeForm} className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : editAsset ? 'Update Asset' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedAsset && (
        <ITAssetBarcodeModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */
const inputCls = 'w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition';

function FormField({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

/* ─── QR Modal ─────────────────────────────────────────────────── */
function ITAssetBarcodeModal({ asset, onClose }) {
  const assetType  = TYPE_ICON[asset.asset_type]?.label || 'IT Asset';
  const assetTitle = `${asset.brand || ''} ${asset.model || ''}`.trim() || asset.asset_tag;
  const { Icon: TypeIcon, color: typeColor } = TYPE_ICON[asset.asset_type] || { Icon: HelpCircle, color: '#5f6368' };
  const daysLeft = asset.warranty_expiry ? dayjs(asset.warranty_expiry).diff(dayjs(), 'day') : null;

  const specs = [
    { label: 'Asset Tag',      value: asset.asset_tag },
    { label: 'Type',           value: assetType },
    { label: 'Brand',          value: asset.brand || '—' },
    { label: 'Model',          value: asset.model || '—' },
    { label: 'Serial No.',     value: asset.serial_number || '—' },
    { label: 'OS / Firmware',  value: asset.os || '—' },
    { label: 'Status',         value: LABEL[asset.status] || asset.status || '—' },
    { label: 'Assigned To',    value: asset.assigned_to_name || '—' },
    { label: 'Project',        value: asset.project_name || '—' },
    { label: 'Location',       value: asset.location_description || '—' },
    { label: 'Purchase Date',  value: asset.purchase_date ? dayjs(asset.purchase_date).format('DD MMM YYYY') : '—' },
    { label: 'Purchase Cost',  value: asset.purchase_cost ? `₹${parseInt(asset.purchase_cost).toLocaleString('en-IN')}` : '—' },
    { label: 'Warranty',       value: daysLeft === null ? '—' : daysLeft < 0 ? `Expired (${Math.abs(daysLeft)}d ago)` : `${dayjs(asset.warranty_expiry).format('DD MMM YYYY')} (${daysLeft}d left)` },
    { label: 'Notes',          value: asset.notes || '—' },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #0f2d6b 0%, #1a56db 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <TypeIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-mono text-lg font-black tracking-wider text-white">{asset.asset_tag}</h2>
              <p className="text-xs text-blue-200">{assetTitle} &nbsp;·&nbsp; {assetType}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid sm:grid-cols-[auto_1fr] gap-0">

          {/* Left — Label Preview */}
          <div className="border-r border-gray-100 bg-slate-50 p-6">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Asset Label</p>
            <AssetBarcodeCard
              value={asset.asset_tag}
              title={assetTitle}
              subtitle={assetType}
              metaLabel="Asset Tag"
              metaValue={asset.asset_tag}
              size={140}
              extraFields={[
                { label: 'Serial No.', value: asset.serial_number },
                { label: 'Status',     value: LABEL[asset.status] || asset.status },
                { label: 'Location',   value: asset.location_description },
                { label: 'Assigned',   value: asset.assigned_to_name },
              ]}
            />
          </div>

          {/* Right — Asset Specs */}
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Asset Specifications</p>
            <div className="space-y-1">
              {specs.map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3 rounded-lg px-3 py-2 odd:bg-gray-50">
                  <span className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400 pt-0.5">
                    {label}
                  </span>
                  <span className={`flex-1 text-xs font-semibold break-all
                    ${label === 'Asset Tag' ? 'font-mono text-sm font-black text-[#0f2d6b]' : 'text-gray-800'}
                    ${label === 'Status' ? (asset.status === 'in_use' ? 'text-green-700' : asset.status === 'under_repair' ? 'text-amber-700' : asset.status === 'lost' ? 'text-red-700' : 'text-gray-700') : ''}
                    ${label === 'Warranty' && daysLeft !== null && daysLeft < 0 ? 'text-red-600' : ''}
                    ${label === 'Warranty' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 90 ? 'text-amber-600' : ''}
                  `}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
