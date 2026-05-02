import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Truck, ClipboardList, Package, AlertTriangle, ArrowRight } from 'lucide-react';
import { grnAPI, mrsAPI, minAPI, inventoryAPI } from '../../api/client';
import useAuthStore from '../../store/authStore';
import { DashKPI, DashSection, DashTable, Badge } from './DashKPI';
import dayjs from 'dayjs';

const GRN_CLS = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };
const MRS_CLS = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', issued: 'bg-blue-100 text-blue-700', rejected: 'bg-red-100 text-red-700' };

export default function StoresDashboard() {
  const { user } = useAuthStore();

  const { data: grns = [], isLoading: loadG } = useQuery({
    queryKey: ['stores-dash-grns'],
    queryFn: () => grnAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []); }),
  });

  const { data: mrs = [], isLoading: loadM } = useQuery({
    queryKey: ['stores-dash-mrs'],
    queryFn: () => mrsAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []); }),
  });

  const { data: issues = [], isLoading: loadI } = useQuery({
    queryKey: ['stores-dash-issues'],
    queryFn: () => minAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []); }),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['stores-dash-inventory'],
    queryFn: () => inventoryAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []); }),
  });

  const pendingGRNs  = grns.filter(g => !g.quality_status || g.quality_status === 'pending');
  const openMRS      = mrs.filter(m => m.status === 'pending' || m.status === 'approved');
  const thisMonthIssues = issues.filter(i => dayjs(i.issue_date || i.created_at).isSame(dayjs(), 'month'));
  const lowStock     = inventory.filter(i => {
    const closing = parseFloat(i.closing_stock ?? i.current_stock ?? 0);
    const min     = parseFloat(i.min_stock ?? i.reorder_level ?? 0);
    return min > 0 && closing <= min;
  });

  const grnCols = [
    { key: 'grn_number',      label: 'GRN #',   cls: 'font-mono text-[11px] text-slate-500' },
    { key: 'vendor_name',     label: 'Vendor',  cls: 'font-medium text-slate-700 max-w-[120px] truncate' },
    { key: 'grn_date',        label: 'Date',    render: r => r.grn_date ? dayjs(r.grn_date).format('DD MMM') : '—' },
    { key: 'total_quantity',  label: 'Qty',     right: true },
    { key: 'quality_status',  label: 'QC',      render: r => <Badge label={r.quality_status || 'pending'} cls={GRN_CLS[r.quality_status] || GRN_CLS.pending} /> },
  ];

  const mrsCols = [
    { key: 'mrs_number',    label: 'MRS #',       cls: 'font-mono text-[11px] text-slate-500' },
    { key: 'project_name',  label: 'Project',     cls: 'text-slate-700' },
    { key: 'requested_by',  label: 'Requested By',cls: 'text-slate-500' },
    { key: 'requested_date',label: 'Date',        render: r => r.requested_date ? dayjs(r.requested_date).format('DD MMM') : '—' },
    { key: 'status',        label: 'Status',      render: r => <Badge label={r.status || 'pending'} cls={MRS_CLS[r.status] || MRS_CLS.pending} /> },
  ];

  return (
    <div className="p-6 space-y-5 bg-[#f4f6f9] min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5">Stores Dashboard — {dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
        <Badge label="Stores" cls="bg-teal-100 text-teal-700 text-xs px-3 py-1" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashKPI icon={Truck}         label="GRNs Pending QC"         value={pendingGRNs.length}      color="amber"   loading={loadG} />
        <DashKPI icon={ClipboardList} label="Open Requisitions"        value={openMRS.length}          color="indigo"  loading={loadM} />
        <DashKPI icon={Package}       label="Issues This Month"        value={thisMonthIssues.length}  color="emerald" loading={loadI} />
        <DashKPI icon={AlertTriangle} label="Low Stock Alerts"         value={lowStock.length}         color="red" />
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">⚠ Low Stock Items ({lowStock.length})</p>
          <div className="flex flex-wrap gap-2">
            {lowStock.slice(0, 10).map((item, i) => (
              <div key={i} className="bg-white border border-red-200 rounded-lg px-3 py-1.5 text-xs">
                <span className="font-semibold text-slate-700">{item.material_name}</span>
                <span className="text-red-500 ml-2">{item.closing_stock ?? item.current_stock} {item.unit} remaining</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashSection
          title="GRNs Awaiting Inspection"
          action={<Link to="/stores/grn" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All GRNs <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={grnCols} rows={pendingGRNs.slice(0, 8)} empty="No GRNs pending inspection ✅" />
        </DashSection>

        <DashSection
          title="Open Material Requisitions"
          action={<Link to="/stores/material-requisition" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All MRS <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={mrsCols} rows={openMRS.slice(0, 8)} empty="No open requisitions" />
        </DashSection>
      </div>
    </div>
  );
}
