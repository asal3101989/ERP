// src/pages/it/ITAssetPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Cpu,
  Plus,
  X,
  AlertTriangle,
  Monitor,
  Server,
  Laptop,
  Network,
  Usb,
  ShieldAlert,
  BadgeInfo,
  ScanLine,
} from 'lucide-react';
import { itAssetAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import AssetBarcodeCard from '../../components/common/AssetBarcodeCard';

const ASSET_TYPES = {
  laptop:    { label: 'Laptop', icon: <Laptop size={14} />, color: 'text-blue-500' },
  desktop:   { label: 'Desktop', icon: <Monitor size={14} />, color: 'text-blue-500' },
  server:    { label: 'Server', icon: <Server size={14} />, color: 'text-indigo-500' },
  network:   { label: 'Network', icon: <Network size={14} />, color: 'text-emerald-500' },
  cctv:      { label: 'CCTV', icon: <BadgeInfo size={14} />, color: 'text-amber-500' },
  biometric: { label: 'Biometric', icon: <ShieldAlert size={14} />, color: 'text-amber-500' },
  printer:   { label: 'Printer', icon: <Usb size={14} />, color: 'text-slate-500' },
  ups:       { label: 'UPS', icon: <AlertTriangle size={14} />, color: 'text-red-500' },
  other:     { label: 'Other', icon: <BadgeInfo size={14} />, color: 'text-slate-500' },
};

const STATUS_MAP = {
  in_use: { label: 'In Use', class: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  available: { label: 'Available', class: 'bg-blue-50 text-blue-600 border border-blue-100' },
  under_repair: { label: 'Under Repair', class: 'bg-amber-50 text-amber-600 border border-amber-100' },
  retired: { label: 'Retired', class: 'bg-slate-50 text-slate-600 border border-slate-200' },
  lost: { label: 'Lost/Stolen', class: 'bg-red-50 text-red-600 border border-red-100' },
};

export default function ITAssetPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data } = useQuery({
    queryKey: ['it-assets'],
    queryFn: () => itAssetAPI.list().then((r) => r.data.data).catch(() => []),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => itAssetAPI.create(payload),
    onSuccess: () => {
      toast.success('Asset added!');
      reset();
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['it-assets'] });
    },
    onError: () => toast.error('Failed to add asset'),
  });

  const allAssets = data || [];

  const assets = allAssets.filter((asset) => {
    if (filterType !== 'all' && asset.asset_type !== filterType) return false;
    if (filterStatus !== 'all' && asset.status !== filterStatus) return false;
    if (
      search &&
      !`${asset.asset_tag} ${asset.brand} ${asset.model} ${asset.location_description || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const warrantyExpiringSoon = allAssets.filter((asset) => {
    if (!asset.warranty_expiry) return false;
    const days = dayjs(asset.warranty_expiry).diff(dayjs(), 'day');
    return days >= 0 && days <= 90;
  });

  const totalValue = allAssets.reduce((sum, asset) => sum + parseFloat(asset.purchase_cost || 0), 0);

  return (
    <div className="min-h-screen space-y-8 bg-slate-50 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 shadow-sm">
            <Cpu className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="mb-1 text-2xl font-black uppercase italic leading-none tracking-tight text-slate-900">
              IT Infrastructure Registry
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
              Lifecycle Tracking | Warranty Audit | Capital Value
            </p>
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-[10px] font-black uppercase italic tracking-widest text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500"
          onClick={() => setShowForm(true)}
        >
          <Plus size={16} />
          Register Asset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm transition-all hover:border-slate-300">
          <div className="font-mono text-4xl font-black italic leading-none tracking-tighter text-slate-900">{allAssets.length}</div>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Total Assets</div>
        </div>
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm transition-all hover:border-emerald-300">
          <div className="font-mono text-4xl font-black italic leading-none tracking-tighter text-emerald-500">
            {allAssets.filter((asset) => asset.status === 'in_use').length}
          </div>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Actively Deployed</div>
        </div>
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm transition-all hover:border-amber-300">
          <div className="font-mono text-4xl font-black italic leading-none tracking-tighter text-amber-500">{warrantyExpiringSoon.length}</div>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Warranty Alerts (90d)</div>
        </div>
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm transition-all hover:border-blue-300">
          <div className="font-mono text-4xl font-black italic leading-none tracking-tighter text-blue-500">
            INR {(totalValue / 100000).toFixed(1)}L
          </div>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Aggregate Capital Value</div>
        </div>
      </div>

      {warrantyExpiringSoon.length > 0 && (
        <div className="rounded-[2.5rem] border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-600 italic">
            <AlertTriangle className="h-4 w-4" />
            Warranty Expiring Within 90 Days
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warrantyExpiringSoon.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                <span className="text-[11px] font-black uppercase italic tracking-tight text-slate-900">
                  {asset.asset_tag} - {asset.brand}
                </span>
                <span className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-1.5 font-mono text-[9px] font-black uppercase text-amber-600">
                  {dayjs(asset.warranty_expiry).diff(dayjs(), 'day')}d left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
        <input
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-900 italic outline-none shadow-inner transition-all focus:border-blue-300"
          placeholder="Search by tag, brand, model, or location..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex-1 space-y-3">
            <div className="ml-1 text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Equipment Topology</div>
            <div className="flex flex-wrap gap-2">
              {['all', ...Object.keys(ASSET_TYPES)].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest italic transition-all',
                    filterType === type
                      ? 'border-blue-200 bg-blue-50 text-blue-600 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {type === 'all' ? 'All Types' : <>{ASSET_TYPES[type].icon} {ASSET_TYPES[type].label}</>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="ml-1 text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Utilization Status</div>
            <div className="flex flex-wrap gap-2">
              {['all', 'in_use', 'available', 'under_repair', 'retired', 'lost'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={clsx(
                    'rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest italic transition-all',
                    filterStatus === status
                      ? 'border-slate-800 bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {status === 'all' ? 'All Status' : STATUS_MAP[status]?.label || status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {['Asset Tag', 'Type', 'Brand / Model', 'Status', 'Deployed To', 'Location', 'Warranty Status', 'Book Value (INR)', 'Barcode'].map((heading) => (
                  <th key={heading} className="whitespace-nowrap p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset) => {
                const assetType = ASSET_TYPES[asset.asset_type] || ASSET_TYPES.other;
                const status = STATUS_MAP[asset.status] || STATUS_MAP.available;
                const daysLeft = asset.warranty_expiry ? dayjs(asset.warranty_expiry).diff(dayjs(), 'day') : null;
                const warrantyColor = daysLeft === null
                  ? 'border-slate-200 bg-slate-50 text-slate-400'
                  : daysLeft < 0
                    ? 'rounded-xl border border-red-100 bg-red-50 px-3 py-1 text-red-600 shadow-sm'
                    : daysLeft <= 90
                      ? 'rounded-xl border border-amber-100 bg-amber-50 px-3 py-1 text-amber-600 shadow-sm'
                      : 'text-emerald-600 font-black';

                return (
                  <tr key={asset.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="p-6">
                      <span className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 font-mono text-[11px] font-black uppercase text-blue-600">
                        {asset.asset_tag}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-6">
                      <span className={clsx('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest', assetType.color)}>
                        {assetType.icon}
                        {assetType.label}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="mb-1 whitespace-nowrap text-[11px] font-black uppercase italic tracking-tight text-slate-900">
                        {asset.brand} {asset.model}
                      </div>
                      {asset.serial_number && (
                        <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500">
                          SN: {asset.serial_number}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-6">
                      <span className={clsx('rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm italic', status.class)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-6 text-[11px] font-black uppercase italic tracking-tight text-slate-900">
                      {asset.assigned_to_name || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="max-w-[180px] p-6 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      <div className="mb-1 truncate">{asset.location_description || '-'}</div>
                      {asset.notes && <div className="truncate italic text-slate-400 opacity-70">{asset.notes}</div>}
                    </td>
                    <td className="whitespace-nowrap p-6">
                      <span className={clsx('inline-block font-mono text-[9px] font-bold uppercase tracking-widest italic', warrantyColor)}>
                        {daysLeft === null
                          ? '-'
                          : daysLeft < 0
                            ? `Exp ${Math.abs(daysLeft)}d ago`
                            : `${dayjs(asset.warranty_expiry).format('D MMM YY')} (${daysLeft}d)`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-6 font-mono text-[11px] font-black italic tracking-tighter text-slate-900">
                      {asset.purchase_cost ? `INR ${parseInt(asset.purchase_cost, 10).toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="whitespace-nowrap p-6">
                      <button
                        type="button"
                        onClick={() => setSelectedAsset(asset)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-700 transition-all hover:border-blue-300 hover:text-blue-600"
                      >
                        <ScanLine className="h-3.5 w-3.5" />
                        View QR
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {assets.length === 0 && (
            <div className="m-6 rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-white py-24 text-center">
              <p className="text-[10px] font-black uppercase italic tracking-[0.3em] text-slate-400">No hardware assets match your filters</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="my-8 flex w-full max-w-4xl flex-col overflow-hidden rounded-[3rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/20">
                  <Cpu className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="mb-1 text-xl font-black uppercase italic leading-none tracking-tighter text-slate-900">Asset Registration Protocol</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Declare hardware to global corporate ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setShowForm(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(createMutation.mutate)} className="flex-1 space-y-8 overflow-y-auto p-10">
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Asset Identifier *</label>
                  <input {...register('asset_tag', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" placeholder="IT-LAP-010" />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Device Classification *</label>
                  <select {...register('asset_type', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500">
                    <option value="">Select Domain</option>
                    {Object.entries(ASSET_TYPES).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Brand Manufacturer *</label>
                  <input {...register('brand', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" placeholder="DELL / HP / LENOVO" />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Hardware Model *</label>
                  <input {...register('model', { required: true })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" placeholder="LATITUDE 5540" />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Serial Number (Factory)</label>
                  <input {...register('serial_number')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" placeholder="SN12345689" />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">OS / Core Firmware</label>
                  <input {...register('os')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" placeholder="WINDOWS 11 PRO" />
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Capital Acquisition Date</label>
                  <input type="date" {...register('purchase_date')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" />
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Total Book Value (INR)</label>
                  <input type="number" {...register('purchase_cost')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs font-bold text-blue-600 outline-none shadow-sm transition-all focus:border-blue-500" placeholder="85000" />
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Warranty Validation Limit</label>
                  <input type="date" {...register('warranty_expiry')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Deployment Zone</label>
                  <input {...register('location_description')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" placeholder="HO PUNE - ACCOUNTS DEPARTMENT" />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Forensic Annotations</label>
                  <textarea {...register('notes')} className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-xs font-bold uppercase text-slate-900 outline-none shadow-sm transition-all focus:border-blue-500" rows={3} placeholder="Diagnostic state, upgrade history, physical damage reports..." />
                </div>
              </div>

              <div className="flex gap-4 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  className="flex-1 rounded-[1.5rem] bg-slate-100 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200"
                  onClick={() => {
                    reset();
                    setShowForm(false);
                  }}
                >
                  Abort Sequence
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-[1.5rem] bg-blue-600 py-4 text-[10px] font-black uppercase italic tracking-[0.2em] text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Committing...' : 'Commit Hardware to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAsset && (
        <ITAssetBarcodeModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}

function ITAssetBarcodeModal({ asset, onClose }) {
  const assetType = ASSET_TYPES[asset.asset_type]?.label || 'IT Asset';
  const assignedTo = asset.assigned_to_name || asset.project_name || asset.location_description || 'Unassigned';
  const assetTitle = `${asset.brand || ''} ${asset.model || ''}`.trim() || asset.asset_tag;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-8 py-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 italic">Asset Barcode Panel</div>
            <h2 className="mt-2 text-xl font-black uppercase italic tracking-tight text-slate-900">{asset.asset_tag}</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">{assetTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid gap-6 p-8 lg:grid-cols-[1.2fr,0.8fr]">
          <AssetBarcodeCard
            value={asset.asset_tag}
            title={assetTitle}
            subtitle={assetType}
            metaLabel="Asset Tag"
            metaValue={asset.asset_tag}
            size={170}
          />

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Deployment</div>
              <div className="mt-2 text-sm font-bold text-slate-900">{assignedTo}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Serial Number</div>
              <div className="mt-2 font-mono text-sm font-bold text-slate-900">{asset.serial_number || 'Not recorded'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</div>
              <div className="mt-2 text-sm font-bold text-slate-900">{STATUS_MAP[asset.status]?.label || asset.status || 'Available'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Notes</div>
              <div className="mt-2 text-sm text-slate-600">{asset.notes || 'No notes recorded for this IT asset.'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
