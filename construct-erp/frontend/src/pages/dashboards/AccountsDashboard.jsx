import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DollarSign, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { dqsBillsAPI, paymentAPI } from '../../api/client';
import useAuthStore from '../../store/authStore';
import { DashKPI, DashSection, DashTable, Badge, inr } from './DashKPI';
import dayjs from 'dayjs';

const AGING_COLOR = { '0-30': 'bg-emerald-500', '31-60': 'bg-amber-400', '61-90': 'bg-orange-500', '90+': 'bg-red-600', unscheduled: 'bg-slate-400' };

export default function AccountsDashboard() {
  const { user } = useAuthStore();

  const { data: bills = [], isLoading: loadB } = useQuery({
    queryKey: ['accts-dash-bills'],
    queryFn: () => dqsBillsAPI.list().then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
  });

  const { data: aging = [], isLoading: loadA } = useQuery({
    queryKey: ['accts-dash-aging'],
    queryFn: () => dqsBillsAPI.getAPAging().then(r => r.data?.data ?? []),
  });

  const { data: payments = [], isLoading: loadPay } = useQuery({
    queryKey: ['accts-dash-payments'],
    queryFn: () => paymentAPI.list().then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []);
    }),
  });

  const readyForPayment  = bills.filter(b => b.workflow_status === 'accounts');
  const paidThisMonth    = bills.filter(b => b.workflow_status === 'paid' && dayjs(b.updated_at).isSame(dayjs(), 'month'));
  const totalDue         = readyForPayment.reduce((s, b) => s + parseFloat(b.certified_net || b.total_amount || 0), 0);
  const paidAmt          = paidThisMonth.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);

  const overdue90 = aging.filter(a => a.aging_bucket === '90+');
  const totalOverdue = overdue90.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  // Aging bucket summary
  const agingBuckets = ['0-30', '31-60', '61-90', '90+'].map(bucket => ({
    bucket,
    count: aging.filter(a => a.aging_bucket === bucket).length,
    total: aging.filter(a => a.aging_bucket === bucket).reduce((s, a) => s + parseFloat(a.balance || 0), 0),
  }));

  const readyCols = [
    { key: 'sl_number',    label: 'SL #',      cls: 'font-mono text-slate-500 text-[11px]' },
    { key: 'vendor_name',  label: 'Vendor',    cls: 'font-medium text-slate-700 max-w-[120px] truncate' },
    { key: 'certified_net',label: 'Certified', right: true, render: r => inr(r.certified_net || r.total_amount) },
    { key: 'pc_number',    label: 'PC #',      render: r => r.pc_number || <span className="text-slate-300 italic">No PC</span> },
    { key: 'inv_date',     label: 'Inv Date',  render: r => r.inv_date ? dayjs(r.inv_date).format('DD MMM') : '—' },
  ];

  const paymentCols = [
    { key: 'entity_name',      label: 'Vendor',    cls: 'font-medium text-slate-700' },
    { key: 'amount',           label: 'Amount',    right: true, render: r => inr(r.amount) },
    { key: 'payment_mode',     label: 'Mode',      render: r => r.payment_mode || '—' },
    { key: 'payment_date',     label: 'Date',      render: r => r.payment_date ? dayjs(r.payment_date).format('DD MMM') : '—' },
  ];

  return (
    <div className="p-6 space-y-5 bg-[#f4f6f9] min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5">Accounts Dashboard — {dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
        <Badge label="Accountant" cls="bg-emerald-100 text-emerald-700 text-xs px-3 py-1" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashKPI icon={DollarSign}    label="Payments Due"         value={readyForPayment.length} sub={inr(totalDue)}    color="amber"   loading={loadB} />
        <DashKPI icon={CheckCircle2}  label="Paid This Month"      value={paidThisMonth.length}   sub={inr(paidAmt)}     color="emerald" loading={loadB} />
        <DashKPI icon={AlertTriangle} label="Overdue 90+ Days"     value={overdue90.length}       sub={inr(totalOverdue)}color="red"     loading={loadA} />
        <DashKPI icon={Clock}         label="Pending Payments"     value={bills.filter(b=>b.workflow_status!=='paid').length} color="blue" loading={loadB} />
      </div>

      {/* AP Aging Bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">AP Aging Distribution</p>
        <div className="flex gap-3 flex-wrap">
          {agingBuckets.map(b => (
            <div key={b.bucket} className="flex-1 min-w-[100px] bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
              <div className={`h-1.5 rounded-full mb-2 ${AGING_COLOR[b.bucket] || 'bg-slate-400'}`} style={{ width: '100%' }} />
              <p className="text-lg font-bold text-slate-700">{b.count}</p>
              <p className="text-[11px] text-slate-500 font-medium">{b.bucket} days</p>
              <p className="text-[11px] text-slate-400">{inr(b.total)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashSection
          title="Bills Ready for Payment"
          action={<Link to="/dqs/bills?status=accounts" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={readyCols} rows={readyForPayment.slice(0, 8)} empty="No bills awaiting payment" />
        </DashSection>

        <DashSection
          title="Recent Payments"
          action={<Link to="/finance/payments" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={paymentCols} rows={payments.slice(0, 8)} empty="No recent payments" />
        </DashSection>
      </div>
    </div>
  );
}
