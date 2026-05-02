import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Briefcase, FileText, AlertTriangle, CalendarClock, ArrowRight } from 'lucide-react';
import { projectAPI, tqsBillsAPI, raBillAPI } from '../../api/client';
import useAuthStore from '../../store/authStore';
import { DashKPI, DashSection, DashTable, inr, Badge } from './DashKPI';
import dayjs from 'dayjs';

const STATUS_CLS = {
  active:     'bg-emerald-100 text-emerald-700',
  planning:   'bg-blue-100 text-blue-700',
  completed:  'bg-slate-100 text-slate-600',
  on_hold:    'bg-amber-100 text-amber-700',
};

const BILL_CLS = {
  pending:  'bg-amber-100 text-amber-700',
  stores:   'bg-blue-100 text-blue-700',
  qs:       'bg-indigo-100 text-indigo-700',
  accounts: 'bg-purple-100 text-purple-700',
};

export default function PMDashboard() {
  const { user } = useAuthStore();

  const { data: projects = [], isLoading: loadP } = useQuery({
    queryKey: ['pm-dash-projects'],
    queryFn: () => projectAPI.list().then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d?.data ?? d?.projects ?? []);
    }),
  });

  const { data: bills = [], isLoading: loadB } = useQuery({
    queryKey: ['pm-dash-bills'],
    queryFn: () => tqsBillsAPI.list().then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
  });

  const active        = projects.filter(p => p.status === 'active').length;
  const totalValue    = projects.reduce((s, p) => s + parseFloat(p.contract_value || p.value || 0), 0);
  const pendingBills  = bills.filter(b => ['pending','stores','qs'].includes(b.workflow_status));
  const pendingAmt    = pendingBills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

  const upcoming = projects
    .filter(p => p.end_date && dayjs(p.end_date).diff(dayjs(), 'day') <= 60 && dayjs(p.end_date).isAfter(dayjs()))
    .sort((a, b) => dayjs(a.end_date).diff(dayjs(b.end_date)));

  const projCols = [
    { key: 'name',           label: 'Project',    cls: 'font-medium text-slate-700' },
    { key: 'status',         label: 'Status',     render: r => <Badge label={r.status || 'active'} cls={STATUS_CLS[r.status] || STATUS_CLS.active} /> },
    { key: 'contract_value', label: 'Value',      right: true, render: r => inr(r.contract_value || r.value) },
    { key: 'end_date',       label: 'Deadline',   render: r => r.end_date ? dayjs(r.end_date).format('DD MMM YY') : '—' },
  ];

  const billCols = [
    { key: 'vendor_name',     label: 'Vendor',   cls: 'font-medium text-slate-700 max-w-[130px] truncate' },
    { key: 'inv_number',      label: 'Invoice' },
    { key: 'total_amount',    label: 'Amount',   right: true, render: r => inr(r.total_amount) },
    { key: 'workflow_status', label: 'Stage',    render: r => <Badge label={r.workflow_status} cls={BILL_CLS[r.workflow_status] || 'bg-slate-100 text-slate-600'} /> },
  ];

  return (
    <div className="p-6 space-y-5 bg-[#f4f6f9] min-h-full">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5">Project Manager Dashboard — {dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
        <Badge label="Project Manager" cls="bg-indigo-100 text-indigo-700 text-xs px-3 py-1" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashKPI icon={Briefcase}    label="Active Projects"    value={active}              color="indigo"  loading={loadP} />
        <DashKPI icon={FileText}     label="Total Contract Value" value={inr(totalValue)}   color="emerald" loading={loadP} />
        <DashKPI icon={AlertTriangle} label="Bills Awaiting Approval" value={pendingBills.length} color="amber" loading={loadB} />
        <DashKPI icon={CalendarClock} label="Closing in 60 Days" value={upcoming.length}   color="blue"    loading={loadP} />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashSection
          title="My Projects"
          action={<Link to="/projects" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={projCols} rows={projects.slice(0, 8)} empty="No projects found" />
        </DashSection>

        <DashSection
          title="Bills Pending Approval"
          action={<Link to="/tqs/bills" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={billCols} rows={pendingBills.slice(0, 8)} empty="No pending approvals" />
          {pendingBills.length > 0 && (
            <p className="text-right text-xs text-slate-400 mt-2">Total pending: {inr(pendingAmt)}</p>
          )}
        </DashSection>
      </div>

      {/* Upcoming deadlines */}
      {upcoming.length > 0 && (
        <DashSection title="Projects Closing in 60 Days">
          <div className="flex flex-wrap gap-3">
            {upcoming.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <CalendarClock className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">{p.name}</p>
                  <p className="text-[11px] text-amber-600">Due {dayjs(p.end_date).format('D MMM YYYY')} · {dayjs(p.end_date).diff(dayjs(), 'day')} days left</p>
                </div>
              </div>
            ))}
          </div>
        </DashSection>
      )}
    </div>
  );
}
