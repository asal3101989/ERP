import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { tqsBillsAPI } from '../../api/client';
import useAuthStore from '../../store/authStore';
import { DashKPI, DashSection, DashTable, Badge, inr } from './DashKPI';
import dayjs from 'dayjs';

const AGING_CLS = {
  '0-30':       'bg-emerald-100 text-emerald-700',
  '31-60':      'bg-amber-100 text-amber-700',
  '61-90':      'bg-orange-100 text-orange-700',
  '90+':        'bg-red-100 text-red-700',
  unscheduled:  'bg-slate-100 text-slate-600',
};

export default function QSDashboard() {
  const { user } = useAuthStore();

  const { data: bills = [], isLoading: loadB } = useQuery({
    queryKey: ['qs-dash-bills'],
    queryFn: () => tqsBillsAPI.list().then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
  });

  const { data: aging = [], isLoading: loadA } = useQuery({
    queryKey: ['qs-dash-aging'],
    queryFn: () => tqsBillsAPI.getAPAging().then(r => r.data?.data ?? []),
  });

  const pendingQS   = bills.filter(b => b.workflow_status === 'stores');
  const certified   = bills.filter(b => ['qs','accounts','paid'].includes(b.workflow_status));
  const thisMonth   = certified.filter(b => dayjs(b.updated_at).isSame(dayjs(), 'month'));
  const certAmtMonth= thisMonth.reduce((s, b) => s + parseFloat(b.certified_net || 0), 0);
  const totalInvoiced = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

  // Average certification turnaround (days from inv_date to qs_certified_date)
  const withCertDate = bills.filter(b => b.inv_date && b.qs_certified_date);
  const avgTurnaround = withCertDate.length
    ? Math.round(withCertDate.reduce((s, b) => s + dayjs(b.qs_certified_date).diff(dayjs(b.inv_date), 'day'), 0) / withCertDate.length)
    : null;

  const pendingCols = [
    { key: 'sl_number',    label: 'SL #',     cls: 'font-mono text-slate-500 text-[11px]' },
    { key: 'vendor_name',  label: 'Vendor',   cls: 'font-medium text-slate-700 max-w-[120px] truncate' },
    { key: 'inv_number',   label: 'Invoice' },
    { key: 'total_amount', label: 'Amount',   right: true, render: r => inr(r.total_amount) },
    { key: 'inv_date',     label: 'Inv Date', render: r => r.inv_date ? dayjs(r.inv_date).format('DD MMM') : '—' },
  ];

  const certCols = [
    { key: 'vendor_name',  label: 'Vendor',  cls: 'font-medium text-slate-700 max-w-[120px] truncate' },
    { key: 'inv_number',   label: 'Invoice' },
    { key: 'certified_net',label: 'Certified', right: true, render: r => inr(r.certified_net) },
    { key: 'updated_at',   label: 'Cert Date', render: r => r.updated_at ? dayjs(r.updated_at).format('DD MMM') : '—' },
  ];

  const agingCols = [
    { key: 'vendor_name',    label: 'Vendor',      cls: 'font-medium text-slate-700' },
    { key: 'certified_net',  label: 'Certified',   right: true, render: r => inr(r.certified_net) },
    { key: 'balance',        label: 'Outstanding', right: true, render: r => inr(r.balance) },
    { key: 'aging_bucket',   label: 'Aging',       render: r => <Badge label={r.aging_bucket || '—'} cls={AGING_CLS[r.aging_bucket] || AGING_CLS.unscheduled} /> },
  ];

  return (
    <div className="p-6 space-y-5 bg-[#f4f6f9] min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5">QS Engineer Dashboard — {dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
        <Badge label="QS Engineer" cls="bg-purple-100 text-purple-700 text-xs px-3 py-1" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashKPI icon={Clock}       label="Awaiting QS Cert"       value={pendingQS.length}            color="amber"   loading={loadB} />
        <DashKPI icon={CheckCircle2}label="Certified This Month"    value={thisMonth.length}            color="emerald" loading={loadB} />
        <DashKPI icon={TrendingUp}  label="Cert Value This Month"   value={inr(certAmtMonth)}           color="indigo"  loading={loadB} />
        <DashKPI icon={FileText}    label="Avg Turnaround (days)"   value={avgTurnaround ?? '—'}        color="blue"    loading={loadB} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashSection
          title="Bills Awaiting QS Certification"
          action={<Link to="/tqs/bills?status=stores" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={pendingCols} rows={pendingQS.slice(0, 8)} empty="No bills awaiting certification" />
        </DashSection>

        <DashSection
          title="Recently Certified"
          action={<Link to="/tqs/bills?status=qs" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={certCols} rows={thisMonth.slice(0, 8)} empty="No certified bills this month" />
        </DashSection>
      </div>

      <DashSection title="AP Aging Summary" action={<Link to="/tqs/bills" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">Full Ledger <ArrowRight className="w-3 h-3" /></Link>}>
        <DashTable cols={agingCols} rows={aging.slice(0, 10)} empty="No outstanding amounts" />
      </DashSection>
    </div>
  );
}
