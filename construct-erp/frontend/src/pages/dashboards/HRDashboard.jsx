import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, UserCheck, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { hrEmployeesAPI, hrAttendanceAPI, hrPayrollAPI, hrLeaveAPI } from '../../api/client';
import useAuthStore from '../../store/authStore';
import { DashKPI, DashSection, DashTable, Badge, inr } from './DashKPI';
import dayjs from 'dayjs';

const LEAVE_CLS = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };

export default function HRDashboard() {
  const { user } = useAuthStore();
  const thisMonthNum = dayjs().month() + 1;
  const thisYearNum  = dayjs().year();

  const { data: empData, isLoading: loadE } = useQuery({
    queryKey: ['hr-dash-employees'],
    queryFn: () => hrEmployeesAPI.list({ employment_status: 'active' }).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []);
    }),
  });

  const { data: attData, isLoading: loadA } = useQuery({
    queryKey: ['hr-dash-attendance', thisMonthNum, thisYearNum],
    queryFn: () => hrAttendanceAPI.summary({ month: thisMonthNum, year: thisYearNum }).then(r => r.data?.data ?? r.data ?? {}),
  });

  const { data: leaves = [], isLoading: loadL } = useQuery({
    queryKey: ['hr-dash-leaves'],
    queryFn: () => hrLeaveAPI.listRequests({ status: 'pending' }).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []);
    }),
  });

  const { data: payrollData } = useQuery({
    queryKey: ['hr-dash-payroll', thisMonthNum, thisYearNum],
    queryFn: () => hrPayrollAPI.list({ month: thisMonthNum, year: thisYearNum }).then(r => r.data?.data ?? []),
  });
  const payroll = payrollData ?? [];

  const employees   = Array.isArray(empData) ? empData : [];
  const active      = employees.length; // already filtered by employment_status=active

  // attData is an array of per-employee monthly summaries; sum up present counts
  const attRows = Array.isArray(attData) ? attData : (attData?.data ?? []);
  const presentCount = attRows.reduce((sum, r) => sum + parseInt(r.present || 0), 0);
  const absentCount  = attRows.reduce((sum, r) => sum + parseInt(r.absent  || 0), 0);
  const onLeaveCount = attRows.reduce((sum, r) => sum + parseInt(r.on_leave || 0), 0);

  const pendingLeave= leaves.length;
  const payrollDone = Array.isArray(payroll) ? payroll.filter(p => p.status === 'paid').length : 0;

  const empCols = [
    { key: 'name',             label: 'Name',        cls: 'font-medium text-slate-700' },
    { key: 'designation_name', label: 'Designation', cls: 'text-slate-500', render: r => <span>{r.designation_name || r.designation || '—'}</span> },
    { key: 'department_name',  label: 'Dept',        cls: 'text-slate-500', render: r => <span>{r.department_name || r.department || '—'}</span> },
    { key: 'employment_status',label: 'Status',      render: r => <Badge label={r.employment_status || 'active'} cls={r.employment_status !== 'active' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'} /> },
  ];

  const leaveCols = [
    { key: 'employee_name', label: 'Employee', cls: 'font-medium text-slate-700' },
    { key: 'leave_type_name', label: 'Type' },
    { key: 'from_date',     label: 'From',     render: r => r.from_date ? dayjs(r.from_date).format('DD MMM') : '—' },
    { key: 'to_date',       label: 'To',       render: r => r.to_date ? dayjs(r.to_date).format('DD MMM') : '—' },
    { key: 'status',        label: 'Status',   render: r => <Badge label={r.status || 'pending'} cls={LEAVE_CLS[r.status] || LEAVE_CLS.pending} /> },
  ];

  return (
    <div className="p-6 space-y-5 bg-[#f4f6f9] min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5">HR Dashboard — {dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
        <Badge label="HR" cls="bg-rose-100 text-rose-700 text-xs px-3 py-1" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashKPI icon={Users}     label="Active Employees"   value={active}            color="indigo"  loading={loadE} />
        <DashKPI icon={UserCheck} label="Present This Month" value={presentCount}       color="emerald" loading={loadA} />
        <DashKPI icon={Calendar}  label="Pending Leaves"     value={pendingLeave}       color="amber"   loading={loadL} />
        <DashKPI icon={DollarSign}label="Payroll Paid"       value={`${payrollDone} emp`} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashSection
          title="Employee Directory"
          action={<Link to="/hr-admin/employees" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={empCols} rows={employees.slice(0, 8)} empty="No employees found" />
        </DashSection>

        <DashSection
          title="Pending Leave Requests"
          action={<Link to="/hr-admin/leaves" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">All <ArrowRight className="w-3 h-3" /></Link>}
        >
          <DashTable cols={leaveCols} rows={leaves.slice(0, 8)} empty="No pending leave requests" />
        </DashSection>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'On Leave (Month)',  value: onLeaveCount,  color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Absent (Month)',    value: absentCount,   color: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Attendance Marked', value: attRows.length, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
