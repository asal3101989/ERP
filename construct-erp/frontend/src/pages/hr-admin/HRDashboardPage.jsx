// src/pages/hr-admin/HRDashboardPage.jsx  — HR & Admin Hub
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, CreditCard, Calendar, Clock, TrendingUp, UserCheck,
  Banknote, AlertTriangle, ChevronRight, Building2, Star,
  ArrowUpRight, Fingerprint, FileBarChart, Upload, HardHat,
  UserX, CheckCircle, XCircle, ClockIcon, Award,
} from 'lucide-react';
import { hrEmployeesAPI, hrPayrollAPI, hrLeaveAPI, hrMastersAPI } from '../../api/client';

// ── tiny helpers ──────────────────────────────────────────────────────────────
const fmt = (v) =>
  `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] },
});

const AVATAR_COLORS = [
  ['#6366F1', '#4F46E5'], ['#0EA5E9', '#0284C7'], ['#10B981', '#059669'],
  ['#F59E0B', '#D97706'], ['#EF4444', '#DC2626'], ['#8B5CF6', '#7C3AED'],
  ['#EC4899', '#DB2777'], ['#14B8A6', '#0D9488'],
];
const avatarGrad = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials = (name) =>
  (name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

// ── quick-action cards ────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: 'Employees',        icon: Users,         to: '/hr-admin/employees',         color: '#6366F1', bg: '#EEF2FF' },
  { label: 'Attendance',       icon: Clock,         to: '/hr-admin/attendance',         color: '#0EA5E9', bg: '#E0F2FE' },
  { label: 'Leave Requests',   icon: Calendar,      to: '/hr-admin/leaves',             color: '#10B981', bg: '#ECFDF5' },
  { label: 'Payroll',          icon: CreditCard,    to: '/hr-admin/payroll',            color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'Salary Structures',icon: TrendingUp,    to: '/hr-admin/salary-structures',  color: '#8B5CF6', bg: '#F5F3FF' },
  { label: 'Departments',      icon: Building2,     to: '/hr-admin/departments',        color: '#EC4899', bg: '#FDF2F8' },
  { label: 'Loans & Advances', icon: Banknote,      to: '/hr-admin/loans',              color: '#14B8A6', bg: '#F0FDFA' },
  { label: 'Expense Claims',   icon: AlertTriangle, to: '/hr-admin/expenses',           color: '#EF4444', bg: '#FEF2F2' },
  { label: 'Appraisals',       icon: Award,         to: '/hr-admin/appraisals',         color: '#F97316', bg: '#FFF7ED' },
  { label: 'Holiday Calendar', icon: Star,          to: '/hr-admin/holidays',           color: '#A855F7', bg: '#FAF5FF' },
  { label: 'HR Reports',       icon: FileBarChart,  to: '/hr-admin/reports',            color: '#0284C7', bg: '#E0F2FE' },
  { label: 'ESSL Biometric',   icon: Fingerprint,   to: '/hr-admin/essl-sync',          color: '#64748B', bg: '#F1F5F9' },
  { label: 'Import Data',      icon: Upload,        to: '/hr-admin/import',             color: '#6366F1', bg: '#EEF2FF' },
  { label: 'Site Workers',     icon: HardHat,       to: '/hr/workers',                  color: '#D97706', bg: '#FFFBEB' },
];

// ── stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, bg, trend, delay = 0 }) {
  return (
    <motion.div {...fade(delay)}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-900 leading-none">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`inline-flex items-center gap-1 mt-3 text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          <ArrowUpRight className={`w-3 h-3 ${trend < 0 ? 'rotate-90' : ''}`} />
          {Math.abs(trend)}% vs last month
        </div>
      )}
      {/* subtle bg glow */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-5"
        style={{ background: color }} />
    </motion.div>
  );
}

// ── leave badge ───────────────────────────────────────────────────────────────
const LEAVE_BADGE = {
  pending:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Pending'  },
  approved: { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500',   label: 'Approved' },
  rejected: { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Rejected' },
};

export default function HRDashboardPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year]  = useState(now.getFullYear());

  // ── data fetching ────────────────────────────────────────────────────────────
  const { data: empData }     = useQuery({ queryKey: ['hr-employees','','','active'], queryFn: () => hrEmployeesAPI.list({ employment_status: 'active' }).then(r => r.data) });
  const { data: allEmpData }  = useQuery({ queryKey: ['hr-employees-all'], queryFn: () => hrEmployeesAPI.list({}).then(r => r.data) });
  const { data: leaveData }   = useQuery({ queryKey: ['hr-leave-requests','pending'], queryFn: () => hrLeaveAPI.listRequests({ status: 'pending' }).then(r => r.data) });
  const { data: payrollData } = useQuery({ queryKey: ['hr-payroll', month, year], queryFn: () => hrPayrollAPI.list({ month, year }).then(r => r.data) });
  const { data: deptData }    = useQuery({ queryKey: ['hr-departments'], queryFn: () => hrMastersAPI.listDepts().then(r => r.data) });
  const { data: headcountData } = useQuery({ queryKey: ['hr-headcount'], queryFn: () => hrPayrollAPI.headcount().then(r => r.data) });

  const employees  = empData?.data  || [];
  const allEmployees = allEmpData?.data || [];
  const leaves     = leaveData?.data || [];
  const payroll    = payrollData?.data || [];
  const totals     = payrollData?.totals || {};
  const depts      = deptData?.data || [];
  const hc         = headcountData?.data || [];

  // derived KPIs
  const totalActive  = employees.length;
  const permanent    = employees.filter(e => e.employment_type === 'permanent').length;
  const probation    = employees.filter(e => e.employment_type === 'probation').length;
  const contract     = employees.filter(e => e.employment_type === 'contract').length;
  const pendingLeaves = leaves.length;
  const payrollPaid   = payroll.filter(r => r.status === 'paid').length;
  const payrollDraft  = payroll.filter(r => r.status === 'draft').length;

  // Dept distribution (max bar = largest dept count)
  const deptDist = depts.map(d => ({
    name: d.name,
    count: allEmployees.filter(e => e.department_id === d.id || e.department_name === d.name).length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);
  const maxDeptCount = deptDist[0]?.count || 1;

  // recent leave requests (top 5)
  const recentLeaves = leaves.slice(0, 5);

  // month label
  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#F8F9FA' }}>

      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <motion.div {...fade(0)} className="relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #4F46E5 50%, #7C3AED 100%)' }}>
        <div className="px-8 py-7 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-white/70" />
                <span className="text-white/70 text-sm font-medium">HR & Administration</span>
              </div>
              <h1 className="text-3xl font-bold text-white">People Dashboard</h1>
              <p className="text-white/60 text-sm mt-1">
                {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Total Headcount', value: totalActive, icon: UserCheck },
                { label: 'Pending Leaves',  value: pendingLeaves, icon: Calendar },
                { label: 'Payroll ' + MONTHS[month], value: payroll.length > 0 ? `${payrollPaid}/${payroll.length} paid` : 'Not run', icon: CreditCard },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                  <s.icon className="w-4 h-4 text-white/70 flex-shrink-0" />
                  <div>
                    <div className="text-white/60 text-[10px] uppercase tracking-wide">{s.label}</div>
                    <div className="text-white font-bold text-base leading-none mt-0.5">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* decorative orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-8" style={{ background: 'radial-gradient(circle, #818CF8, transparent 70%)' }} />
      </motion.div>

      {/* ── KPI Grid ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard delay={0.05} label="Total Active" value={totalActive} icon={UserCheck} color="#6366F1" bg="#EEF2FF" sub="All employment types" />
        <StatCard delay={0.08} label="Permanent"    value={permanent}   icon={Users}     color="#0EA5E9" bg="#E0F2FE" sub="Full-time staff" />
        <StatCard delay={0.11} label="On Probation" value={probation}   icon={ClockIcon} color="#F59E0B" bg="#FFFBEB" sub="Under review" />
        <StatCard delay={0.14} label="Contract"     value={contract}    icon={UserX}     color="#EF4444" bg="#FEF2F2" sub="Fixed term" />
        <StatCard delay={0.17} label="Leave Pending" value={pendingLeaves} icon={Calendar} color="#10B981" bg="#ECFDF5" sub="Awaiting approval" />
        <StatCard delay={0.20} label="Payroll Draft" value={payrollDraft}  icon={CreditCard} color="#8B5CF6" bg="#F5F3FF" sub={`${MONTHS[month]} ${year}`} />
      </div>

      {/* ── Main two-column layout ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left col (2/3): Quick Actions + Dept Distribution */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Actions */}
          <motion.div {...fade(0.22)} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {QUICK_LINKS.map((link, i) => (
                <motion.button
                  key={link.to}
                  onClick={() => navigate(link.to)}
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all text-center"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: link.bg }}>
                    <link.icon className="w-4 h-4" style={{ color: link.color }} />
                  </div>
                  <span className="text-[10px] font-medium text-gray-600 leading-tight">{link.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Department Distribution */}
          <motion.div {...fade(0.26)} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Department Headcount</h2>
              <button onClick={() => navigate('/hr-admin/departments')}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {deptDist.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No department data</div>
            ) : (
              <div className="space-y-3">
                {deptDist.map((d, i) => (
                  <div key={d.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{d.name}</span>
                      <span className="text-sm font-bold text-gray-900">{d.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.count / maxDeptCount) * 100}%` }}
                        transition={{ duration: 0.7, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${AVATAR_COLORS[i % AVATAR_COLORS.length][0]}, ${AVATAR_COLORS[i % AVATAR_COLORS.length][1]})` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Payroll Summary */}
          {payroll.length > 0 && (
            <motion.div {...fade(0.30)} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Payroll — {MONTHS[month]} {year}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{payroll.length} employees processed</p>
                </div>
                <button onClick={() => navigate('/hr-admin/payroll')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                  Open Payroll <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Gross Earnings',   value: fmt(totals.gross_earnings),   color: '#6366F1', bg: '#EEF2FF' },
                  { label: 'Total Deductions', value: fmt(totals.total_deductions), color: '#EF4444', bg: '#FEF2F2' },
                  { label: 'Net Payable',      value: fmt(totals.net_pay),          color: '#10B981', bg: '#ECFDF5' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl p-4" style={{ background: c.bg }}>
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className="text-lg font-bold" style={{ color: c.color }}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Status breakdown */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                {[
                  { label: 'Draft',    count: payroll.filter(r => r.status === 'draft').length,    color: 'text-gray-500',   bg: 'bg-gray-100' },
                  { label: 'Approved', count: payroll.filter(r => r.status === 'approved').length, color: 'text-blue-600',   bg: 'bg-blue-50' },
                  { label: 'Paid',     count: payroll.filter(r => r.status === 'paid').length,     color: 'text-green-600',  bg: 'bg-green-50' },
                ].map(s => (
                  <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${s.bg}`}>
                    <span className={`text-sm font-bold ${s.color}`}>{s.count}</span>
                    <span className={`text-xs ${s.color}`}>{s.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right col (1/3): Pending Leaves + Recent Employees */}
        <div className="space-y-6">

          {/* Pending Leave Requests */}
          <motion.div {...fade(0.24)} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-amber-500" />
                </div>
                <h2 className="text-base font-semibold text-gray-800">Pending Leaves</h2>
              </div>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {pendingLeaves}
              </span>
            </div>

            {recentLeaves.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">All caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentLeaves.map((req, i) => {
                  const [from, to] = [LEAVE_BADGE['pending'], LEAVE_BADGE['pending']];
                  const badge = LEAVE_BADGE[req.status] || LEAVE_BADGE.pending;
                  const days = req.total_days || '?';
                  const [g1, g2] = avatarGrad(req.employee_name);
                  return (
                    <div key={req.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                        {initials(req.employee_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{req.employee_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{req.leave_type_name || 'Leave'} · {days} day{days !== 1 ? 's' : ''}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${badge.bg} ${badge.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {pendingLeaves > 0 && (
              <div className="px-5 pb-4 pt-2">
                <button onClick={() => navigate('/hr-admin/leaves')}
                  className="w-full py-2 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  Review All Requests
                </button>
              </div>
            )}
          </motion.div>

          {/* Recent Employees */}
          <motion.div {...fade(0.28)} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-indigo-500" />
                </div>
                <h2 className="text-base font-semibold text-gray-800">Recent Hires</h2>
              </div>
              <button onClick={() => navigate('/hr-admin/employees')} className="text-xs text-indigo-600 font-medium">View all</button>
            </div>

            <div className="divide-y divide-gray-50">
              {[...employees]
                .sort((a, b) => new Date(b.date_of_joining || 0) - new Date(a.date_of_joining || 0))
                .slice(0, 6)
                .map(emp => {
                  const [g1, g2] = avatarGrad(emp.name);
                  return (
                    <div key={emp.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/hr-admin/employees/${emp.id}`)}>
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                        {initials(emp.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{emp.name}</p>
                        <p className="text-xs text-gray-400 truncate">{emp.designation_name || emp.designation || emp.department_name || '—'}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </div>
                  );
                })}
            </div>

            <div className="px-5 pb-4 pt-2">
              <button onClick={() => navigate('/hr-admin/employees/new')}
                className="w-full py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
                + Add New Employee
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
