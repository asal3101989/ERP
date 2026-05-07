import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  Clock3,
  PackageCheck,
  ShieldAlert,
  Truck,
  Warehouse,
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { grnAPI, inventoryAPI, minAPI, mrsAPI, projectAPI } from '../../api/client';

const inr = (value) => `Rs${Number(value || 0).toLocaleString('en-IN')}`;

const WORKSPACES = [
  {
    label: 'Receipts',
    to: '/stores/grn',
    icon: PackageCheck,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    desc: 'GRN intake, verification, and stock posting',
  },
  {
    label: 'Requests',
    to: '/stores/mrs',
    icon: ClipboardList,
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
    desc: 'Material requests and approval workflow',
  },
  {
    label: 'Issues',
    to: '/stores/issue',
    icon: Truck,
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
    desc: 'Issue notes, draft MINs, and stock release',
  },
  {
    label: 'Ledger',
    to: '/stores/ledger',
    icon: BookOpen,
    tone: 'bg-violet-50 text-violet-700 border-violet-100',
    desc: 'Stock balance, movement, and valuation',
  },
];

function KpiCard({ label, value, sub, tone = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className={clsx('mt-3 text-3xl font-black tracking-tight', tone)}>{value}</div>
      <div className="mt-2 text-[11px] text-slate-500 font-medium">{sub}</div>
    </div>
  );
}

function QueueList({ title, items, emptyText, accent = 'bg-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">{title}</h3>
        <span className={clsx('w-2.5 h-2.5 rounded-full', accent)} />
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 && (
          <div className="px-5 py-10 text-sm text-slate-400">{emptyText}</div>
        )}
        {items.map((item) => (
          <div key={item.key} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{item.title}</div>
                <div className="mt-1 text-[11px] text-slate-500">{item.meta}</div>
              </div>
              {item.badge && (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  {item.badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StoresHubPage() {
  const [projectFilter, setProjectFilter] = useState('all');

  const { data: projectsData = [] } = useQuery({
    queryKey: ['stores-hub-projects'],
    queryFn: () => projectAPI.list().then((r) => r.data?.data || r.data || []),
    staleTime: 300000,
  });

  const { data: inventoryData = [] } = useQuery({
    queryKey: ['stores-hub-inventory', projectFilter],
    queryFn: () => inventoryAPI.list(projectFilter !== 'all' ? { project_id: projectFilter } : {}).then((r) => r.data?.data || []),
    staleTime: 60000,
  });

  const { data: lowStockData = [] } = useQuery({
    queryKey: ['stores-hub-low-stock', projectFilter],
    queryFn: () => inventoryAPI.lowStock(projectFilter !== 'all' ? { project_id: projectFilter } : {}).then((r) => r.data?.data || []),
    staleTime: 60000,
  });

  const { data: grnData = [] } = useQuery({
    queryKey: ['stores-hub-grn'],
    queryFn: () => grnAPI.list().then((r) => r.data?.data || []),
    staleTime: 60000,
  });

  const { data: mrsData = [] } = useQuery({
    queryKey: ['stores-hub-mrs'],
    queryFn: () => mrsAPI.list().then((r) => r.data?.data || []),
    staleTime: 60000,
  });

  const { data: minData = [] } = useQuery({
    queryKey: ['stores-hub-min'],
    queryFn: () => minAPI.list().then((r) => r.data?.data || []),
    staleTime: 60000,
  });

  const projects = Array.isArray(projectsData) ? projectsData : [];

  const scopedGrns = useMemo(() => (
    projectFilter === 'all' ? grnData : grnData.filter((item) => item.project_id === projectFilter)
  ), [grnData, projectFilter]);

  const scopedMrs = useMemo(() => (
    projectFilter === 'all' ? mrsData : mrsData.filter((item) => item.project_id === projectFilter)
  ), [mrsData, projectFilter]);

  const scopedMins = useMemo(() => (
    projectFilter === 'all' ? minData : minData.filter((item) => item.project_id === projectFilter)
  ), [minData, projectFilter]);

  const inventoryValue = inventoryData.reduce((sum, item) => sum + (Number(item.closing_stock || 0) * Number(item.unit_rate || 0)), 0);
  const pendingGrnCount = scopedGrns.filter((item) => !['approved'].includes(String(item.status || item.quality_status || '').toLowerCase())).length;
  const pendingMrsCount = scopedMrs.filter((item) => !['issued', 'rejected'].includes(String(item.status || '').toLowerCase())).length;
  const draftIssueCount = scopedMins.filter((item) => String(item.status || '').toLowerCase() === 'draft').length;

  const recentGrns = scopedGrns
    .slice()
    .sort((a, b) => new Date(b.created_at || b.grn_date || 0) - new Date(a.created_at || a.grn_date || 0))
    .slice(0, 5)
    .map((item) => ({
      key: item.id,
      title: item.grn_number || 'GRN',
      meta: `${item.project_name || '-'} | ${item.vendor_name || item.supplier_name || '-'}`,
      badge: item.status || item.quality_status || 'pending',
    }));

  const recentMrs = scopedMrs
    .slice()
    .sort((a, b) => new Date(b.created_at || b.request_date || 0) - new Date(a.created_at || a.request_date || 0))
    .slice(0, 5)
    .map((item) => ({
      key: item.id,
      title: item.serial_no || item.mrs_number || 'MRS',
      meta: `${item.project_name || '-'} | required ${item.required_by ? dayjs(item.required_by).format('DD MMM') : '-'}`,
      badge: item.status || 'pending',
    }));

  const lowStockItems = lowStockData
    .slice(0, 5)
    .map((item) => ({
      key: item.id,
      title: item.material_name || '-',
      meta: `${item.project_name || '-'} | balance ${Number(item.closing_stock || 0).toLocaleString('en-IN')} ${item.unit || ''}`.trim(),
      badge: 'low',
    }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Stores Workspace</div>
            <h1 className="mt-2 text-3xl font-black text-slate-900 tracking-tight">Inventory control, receipts, and material issue</h1>
            <p className="mt-2 text-sm text-slate-500 max-w-3xl">
              A cleaner operational front door for store teams - review stock health, inbound receipts, requisition queues, and issue backlogs from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-[11px] font-black uppercase tracking-widest outline-none min-w-[220px]"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <Link
              to="/stores/ledger"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest"
            >
              Open Ledger
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Active Stock Items" value={inventoryData.length} sub="Material lines in current scope" tone="text-slate-900" />
          <KpiCard label="Inventory Value" value={inr(inventoryValue)} sub="Closing stock x current rate" tone="text-indigo-600" />
          <KpiCard label="Low Stock Alerts" value={lowStockData.length} sub="Needs replenishment or review" tone="text-red-500" />
          <KpiCard label="Pending Actions" value={pendingGrnCount + pendingMrsCount + draftIssueCount} sub="GRN, MRS, and draft issue queues" tone="text-amber-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,1fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Store workspaces</h2>
              <p className="text-sm text-slate-500 mt-1">Zoho-style quick access into the daily stores workflows.</p>
            </div>
            <Warehouse className="w-5 h-5 text-slate-300" />
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {WORKSPACES.map((workspace) => {
              const Icon = workspace.icon;
              return (
                <Link
                  key={workspace.to}
                  to={workspace.to}
                  className="border border-slate-200 rounded-2xl p-4 hover:border-slate-300 hover:shadow-sm transition bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={clsx('w-11 h-11 rounded-2xl border flex items-center justify-center', workspace.tone)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-300" />
                  </div>
                  <div className="mt-4 text-sm font-black text-slate-900 uppercase tracking-wide">{workspace.label}</div>
                  <div className="mt-1 text-sm text-slate-500 leading-6">{workspace.desc}</div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Operational snapshot</h2>
              <p className="text-sm text-slate-500 mt-1">The queues that usually need attention first.</p>
            </div>
            <Clock3 className="w-5 h-5 text-slate-300" />
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-black text-slate-900">Pending GRNs</div>
                <div className="text-[11px] text-slate-500 mt-1">Receipts waiting for stores or QC completion</div>
              </div>
              <div className="text-2xl font-black text-emerald-600">{pendingGrnCount}</div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-black text-slate-900">Open requisitions</div>
                <div className="text-[11px] text-slate-500 mt-1">MRS requests not yet fully issued</div>
              </div>
              <div className="text-2xl font-black text-blue-600">{pendingMrsCount}</div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-black text-slate-900">Draft issues</div>
                <div className="text-[11px] text-slate-500 mt-1">Issue notes saved but not authorized</div>
              </div>
              <div className="text-2xl font-black text-amber-600">{draftIssueCount}</div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-black text-slate-900">Low stock lines</div>
                <div className="text-[11px] text-slate-500 mt-1">Materials already under threshold</div>
              </div>
              <div className="text-2xl font-black text-red-500">{lowStockData.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <QueueList
          title="Recent Receipts"
          items={recentGrns}
          emptyText="No recent GRNs in the selected scope."
          accent="bg-emerald-500"
        />
        <QueueList
          title="Recent Requisitions"
          items={recentMrs}
          emptyText="No recent material requests in the selected scope."
          accent="bg-blue-500"
        />
        <QueueList
          title="Low Stock Watchlist"
          items={lowStockItems}
          emptyText="No low stock alerts right now."
          accent="bg-red-500"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">How the module is organized now</h2>
            <p className="text-sm text-slate-500 mt-1">Less jargon up front, clearer operational entry points underneath.</p>
          </div>
          <ShieldAlert className="w-5 h-5 text-slate-300" />
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-black text-slate-900">Overview</div>
            <div className="mt-1 text-slate-500">Module dashboard and queue visibility.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-black text-slate-900">Receipts</div>
            <div className="mt-1 text-slate-500">GRN intake and approval-driven stock posting.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-black text-slate-900">Requests & Issues</div>
            <div className="mt-1 text-slate-500">MRS approvals and MIN release flow.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="font-black text-slate-900">Ledger</div>
            <div className="mt-1 text-slate-500">Stock balance, movement analysis, and valuation.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
