// src/pages/Dashboard.jsx
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Building2,
  DollarSign,
  Shield,
  Receipt,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Package,
  CheckCircle2,
  Clock,
  Wallet,
  FileWarning,
  HardHat,
  CalendarRange,
  FileText,
  ClipboardList,
} from 'lucide-react';
import {
  projectAPI,
  incidentAPI,
  raBillAPI,
  analyticsAPI,
  paymentAPI,
  poAPI,
  inventoryAPI,
  permitAPI,
  qualityAPI,
  documentsAPI,
  workerAPI,
} from '../api/client';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';

const PMDashboard = lazy(() => import('./dashboards/PMDashboard'));
const SiteEngineerDashboard = lazy(() => import('./dashboards/SiteEngineerDashboard'));
const QSDashboard = lazy(() => import('./dashboards/QSDashboard'));
const AccountsDashboard = lazy(() => import('./dashboards/AccountsDashboard'));
const HRDashboard = lazy(() => import('./dashboards/HRDashboard'));
const HSEDashboard = lazy(() => import('./dashboards/HSEDashboard'));
const StoresDashboard = lazy(() => import('./dashboards/StoresDashboard'));
const ProcurementDashboard = lazy(() => import('./dashboards/ProcurementDashboard'));

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

const inr = (value) => {
  const n = parseFloat(value) || 0;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const compactNumber = (value) => {
  const n = parseFloat(value) || 0;
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return `${Math.round(n)}`;
};

const toArray = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getRangeBounds = (range) => {
  if (range === 'all') return { dateFrom: null, dateTo: null };

  const now = dayjs();
  const map = {
    '7d': 6,
    '30d': 29,
    '90d': 89,
    '1y': 364,
  };
  const days = map[range] ?? 29;
  return {
    dateFrom: now.subtract(days, 'day').format('YYYY-MM-DD'),
    dateTo: now.format('YYYY-MM-DD'),
  };
};

function DashLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#f8fafc' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}

function KPICard({ title, value, sub, icon: Icon, tone = 'indigo', delay = 0, to }) {
  const tones = {
    indigo: { bg: 'linear-gradient(135deg,#eef2ff,#ffffff)', badge: '#6366f1', glow: 'rgba(99,102,241,0.18)' },
    emerald: { bg: 'linear-gradient(135deg,#ecfdf5,#ffffff)', badge: '#10b981', glow: 'rgba(16,185,129,0.18)' },
    amber: { bg: 'linear-gradient(135deg,#fff7ed,#ffffff)', badge: '#f59e0b', glow: 'rgba(245,158,11,0.18)' },
    red: { bg: 'linear-gradient(135deg,#fef2f2,#ffffff)', badge: '#ef4444', glow: 'rgba(239,68,68,0.18)' },
    sky: { bg: 'linear-gradient(135deg,#f0f9ff,#ffffff)', badge: '#0ea5e9', glow: 'rgba(14,165,233,0.18)' },
  };
  const palette = tones[tone] || tones.indigo;

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2, boxShadow: `0 10px 28px ${palette.glow}` }}
      style={{
        background: palette.bg,
        border: '1px solid #e8edf3',
        borderRadius: 14,
        padding: '12px 14px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: palette.badge,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 6px 16px ${palette.glow}`,
        }}
      >
        <Icon style={{ width: 18, height: 18, color: '#fff' }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 1, lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
    </motion.div>
  );

  if (!to) return card;

  return (
    <Link to={to} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      {card}
    </Link>
  );
}

function SectionCard({ title, action, actionTo, children, delay = 0, minHeight }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: '#ffffff',
        border: '1px solid #e8edf3',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
        minHeight,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{title}</div>
        {action && actionTo && (
          <Link to={actionTo} style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11, fontWeight: 700, color: '#6366f1' }}>
            {action}
            <ArrowRight style={{ width: 11, height: 11 }} />
          </Link>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function EmptyState({ text }) {
  return <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{text}</div>;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const role = user?.role || '';
  const dept = (user?.department || '').toLowerCase();

  if (!['super_admin', 'admin'].includes(role)) {
    let RoleDash = null;
    if (role === 'project_manager') RoleDash = PMDashboard;
    else if (role === 'site_engineer') RoleDash = SiteEngineerDashboard;
    else if (role === 'qs_engineer') RoleDash = QSDashboard;
    else if (role === 'accountant') RoleDash = AccountsDashboard;
    else if (role === 'hr') RoleDash = HRDashboard;
    else if (role === 'hse_officer') RoleDash = HSEDashboard;
    else if (dept.includes('store')) RoleDash = StoresDashboard;
    else if (dept.includes('procurement') || dept.includes('purchase')) RoleDash = ProcurementDashboard;
    if (RoleDash) return <Suspense fallback={<DashLoader />}><RoleDash /></Suspense>;
  }

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('30d');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('all');

  const dateBounds = useMemo(() => getRangeBounds(selectedDateRange), [selectedDateRange]);
  const executiveParams = useMemo(() => ({
    project_id: selectedProjectId !== 'all' ? selectedProjectId : undefined,
    business_unit: selectedBusinessUnit !== 'all' ? selectedBusinessUnit : undefined,
    date_from: dateBounds.dateFrom || undefined,
    date_to: dateBounds.dateTo || undefined,
  }), [selectedProjectId, selectedBusinessUnit, dateBounds.dateFrom, dateBounds.dateTo]);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics-executive', refreshKey, executiveParams],
    queryFn: () => analyticsAPI.executive(executiveParams).then((r) => r.data?.data || null).catch(() => null),
  });

  const { data: companyProjects = [] } = useQuery({
    queryKey: ['dashboard-projects-fallback'],
    queryFn: () => projectAPI.list().then((r) => toArray(r)).catch(() => []),
    staleTime: 1000 * 60 * 10,
  });

  const dashboardProjects = dashboard?.projects || [];
  const filterOptions = dashboard?.filters?.options || {};
  const projectOptions = filterOptions.projects?.length
    ? filterOptions.projects
    : companyProjects.map((project) => ({ id: project.id, name: project.name, project_code: project.project_code, type: project.type }));
  const businessUnitOptions = filterOptions.business_units?.length
    ? filterOptions.business_units
    : [...new Set(companyProjects.map((project) => project.type).filter(Boolean))].sort();
  const dashboardKpis = dashboard?.kpis || {};
  const dashboardCharts = dashboard?.charts || {};
  const dashboardRecent = dashboard?.recent || {};
  const dashboardWatchlists = dashboard?.watchlists || {};
  const dashboardPulse = dashboard?.pulse || {};
  const dashboardExceptions = dashboard?.exceptions || [];
  const safeProjects = Array.isArray(dashboardProjects) ? dashboardProjects : [];
  const safeRABills = Array.isArray(dashboardRecent.ra_bills) ? dashboardRecent.ra_bills : [];
  const safePayments = Array.isArray(dashboardRecent.payments) ? dashboardRecent.payments : [];
  const safeDocs = Array.isArray(dashboardRecent.documents) ? dashboardRecent.documents : [];
  const lowStockCount = dashboardKpis.low_stock_count ?? dashboardPulse?.procurement_stores?.low_stock_materials ?? 0;
  const workforceCount = dashboardKpis.workforce_count ?? 0;
  const openIncidents = dashboardKpis.open_incidents ?? 0;
  const expiringPermits = dashboardKpis.expiring_permits ?? 0;
  const openRFIs = dashboardKpis.open_rfis ?? 0;
  const openNCRs = dashboardKpis.open_ncrs ?? 0;
  const safetyScore = dashboardKpis.safety_score;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const activeProjects = dashboardKpis.active_projects ?? 0;
  const delayedProjects = dashboardKpis.delayed_projects ?? 0;
  const completedProjects = dashboardKpis.completed_projects ?? 0;
  const planningProjects = dashboardKpis.planning_projects ?? 0;
  const totalContractValue = dashboardKpis.total_contract_value ?? 0;
  const totalProjects = dashboardKpis.total_projects ?? safeProjects.length;
  const totalCertified = dashboardKpis.total_certified ?? 0;
  const pendingRABillCount = dashboardKpis.pending_ra_bills ?? 0;
  const pendingRAValue = dashboardKpis.pending_ra_value ?? 0;
  const totalCollections = dashboardKpis.total_collections ?? 0;
  const receivables = dashboardKpis.receivables ?? Math.max(totalCertified - totalCollections, 0);
  const documentsCount = dashboardKpis.documents_count ?? safeDocs.length;

  const financeTrendData = dashboardCharts.finance_trend || [];
  const projectStatusData = dashboardCharts.project_status || [];
  const exceptionCards = dashboardExceptions;
  const recentDocuments = [...safeDocs].slice(0, 5);
  const delayedWatchlist = [...(dashboardWatchlists.delayed_projects || [])].slice(0, 5);
  const recentBills = [...safeRABills].slice(0, 5);
  const recentPayments = [...safePayments].slice(0, 5);
  const topLowStock = dashboardPulse?.procurement_stores?.top_low_stock_material || 'No critical material right now';
  const overduePOCount = dashboardPulse?.procurement_stores?.pos_requiring_attention ?? 0;
  const totalPurchaseOrders = dashboardPulse?.procurement_stores?.total_pos ?? 0;
  const totalDocuments = dashboardPulse?.procurement_stores?.open_documents ?? documentsCount;
  const registeredWorkforce = dashboardPulse?.documents_workforce?.workforce_count ?? workforceCount;
  const completedProjectsCount = dashboardPulse?.documents_workforce?.completed_projects ?? completedProjects;
  const totalPermits = dashboardPulse?.quality_safety?.permits_count ?? expiringPermits;
  const totalRFICount = dashboardPulse?.quality_safety?.rfi_count ?? openRFIs;
  const totalNCRCount = dashboardPulse?.quality_safety?.ncr_count ?? openNCRs;
  const pendingVendorBills = dashboardPulse?.procurement_stores?.pending_vendor_bills ?? pendingRABillCount;
  const pendingVendorBillValue = dashboardPulse?.procurement_stores?.pending_vendor_bill_value ?? pendingRAValue;
  const safetyScoreValue = dashboardPulse?.quality_safety?.safety_score ?? safetyScore;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        fontFamily: "'Inter',-apple-system,sans-serif",
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          opacity: 0.38,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.15) 1px,transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1520, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}
        >
          <div>
            <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              Executive Command Centre
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              {greeting}, {user?.name?.split(' ')[0] || 'Admin'}
            </h1>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
              {dayjs().format('dddd, D MMMM YYYY')} · Portfolio wide executive view
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setRefreshKey((key) => key + 1)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366f1',
                cursor: 'pointer',
              }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
            </motion.button>
            <Link to="/projects" style={{ textDecoration: 'none' }}>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  padding: '7px 14px',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border: 'none',
                  borderRadius: 9,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 6px 16px rgba(99,102,241,0.24)',
                }}
              >
                <Building2 style={{ width: 13, height: 13 }} />
                All Projects
              </motion.button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          style={{
            background: '#ffffff',
            border: '1px solid #e8edf3',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(160px,0.7fr) minmax(160px,0.7fr) auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project</span>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid #dbe4ee', padding: '0 10px', background: '#f8fafc', color: '#0f172a', fontSize: 12, fontWeight: 600, outline: 'none' }}>
                <option value="all">All Projects</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_code ? `${project.name} (${project.project_code})` : project.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date Range</span>
              <select value={selectedDateRange} onChange={(e) => setSelectedDateRange(e.target.value)} style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid #dbe4ee', padding: '0 10px', background: '#f8fafc', color: '#0f172a', fontSize: 12, fontWeight: 600, outline: 'none' }}>
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last 1 Year</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Business Unit</span>
              <select value={selectedBusinessUnit} onChange={(e) => setSelectedBusinessUnit(e.target.value)} style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid #dbe4ee', padding: '0 10px', background: '#f8fafc', color: '#0f172a', fontSize: 12, fontWeight: 600, outline: 'none' }}>
                <option value="all">All Business Units</option>
                {businessUnitOptions.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>{dashboardLoading ? 'Refreshing...' : 'Live view'}</div>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setRefreshKey((key) => key + 1)} style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #dbe4ee', background: '#f8fafc', color: '#0f172a', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                Refresh
              </motion.button>
            </div>
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginBottom: 12 }}>
          <KPICard title="Portfolio Value" value={inr(totalContractValue)} sub={`${safeProjects.length} total projects`} icon={DollarSign} tone="indigo" delay={0} to="/projects" />
          <KPICard title="Certified Billing" value={inr(totalCertified)} sub={`${pendingRABillCount} bills pending action`} icon={Receipt} tone="sky" delay={0.05} to="/qs/ra-bills" />
          <KPICard title="Collections" value={inr(totalCollections)} sub={`${compactNumber(receivables)} receivables outstanding`} icon={Wallet} tone="emerald" delay={0.1} to="/finance/payments" />
          <KPICard title="Active Projects" value={activeProjects} sub={`${delayedProjects} delayed · ${planningProjects} planning`} icon={Building2} tone="sky" delay={0.15} to="/projects" />
          <KPICard title="Safety Score" value={safetyScore != null ? `${Math.round(safetyScore)}/100` : 'N/A'} sub={`${openIncidents} open incidents · ${expiringPermits} expiring permits`} icon={Shield} tone="red" delay={0.2} to="/hse/incidents" />
          <KPICard title="Quality Exposure" value={`${openRFIs + openNCRs}`} sub={`${openRFIs} RFIs · ${openNCRs} NCRs open`} icon={FileWarning} tone="amber" delay={0.25} to="/quality" />
          <KPICard title="Stores Watch" value={lowStockCount} sub={topLowStock} icon={Package} tone="amber" delay={0.3} to="/procurement/inventory" />
          <KPICard title="Workforce Base" value={workforceCount} sub={`${documentsCount} documents tracked`} icon={HardHat} tone="emerald" delay={0.35} to="/hr/workers" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <SectionCard title="Billing vs Collections (₹ Lakhs)" delay={0.2} minHeight={260}>
            {financeTrendData.every((item) => item.billed === 0 && item.collected === 0) ? (
              <EmptyState text="No billing or collection data available for the last 6 months" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={financeTrendData}>
                  <defs>
                    <linearGradient id="billGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="collectGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                    formatter={(value) => [`₹${Number(value).toFixed(2)} L`, '']}
                  />
                  <Area type="monotone" dataKey="billed" stroke="#6366f1" strokeWidth={2.5} fill="url(#billGrad)" name="Billed" />
                  <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.5} fill="url(#collectGrad)" name="Collected" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          <SectionCard title="Project Status" action="Projects" actionTo="/projects" delay={0.25} minHeight={260}>
            {projectStatusData.length === 0 ? (
              <EmptyState text="No project status data available" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={projectStatusData} dataKey="value" innerRadius={42} outerRadius={68} paddingAngle={3}>
                      {projectStatusData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, color: '#fff', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'grid', gap: 6 }}>
                  {projectStatusData.map((item, index) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span style={{ color: '#64748b' }}>{item.name}</span>
                      <strong style={{ marginLeft: 'auto', color: '#0f172a' }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Exceptions" delay={0.3} minHeight={260}>
            <div style={{ display: 'grid', gap: 7 }}>
              {exceptionCards.map((card) => (
                <Link
                  key={card.label}
                  to={card.to}
                  style={{
                    textDecoration: 'none',
                    border: '1px solid #e8edf3',
                    borderRadius: 10,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#f8fafc',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: card.tone, flexShrink: 0 }} />
                  <span style={{ color: '#334155', fontSize: 12, fontWeight: 700 }}>{card.label}</span>
                  <span style={{ marginLeft: 'auto', color: '#0f172a', fontSize: 14, fontWeight: 800 }}>{card.value}</span>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <SectionCard title="Delayed Projects Watchlist" action="View All" actionTo="/projects" delay={0.35} minHeight={240}>
            {delayedWatchlist.length === 0 ? (
              <EmptyState text="No delayed projects right now" />
            ) : (
              <div style={{ display: 'grid', gap: 7 }}>
                {delayedWatchlist.map((project) => {
                  const progress = Math.max(0, Math.min(100, parseFloat(project.progress_pct || 0)));
                  return (
                    <div key={project.id} style={{ border: '1px solid #fde7c7', borderRadius: 10, padding: '10px 12px', background: '#fff7ed' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ color: '#0f172a', fontSize: 12 }}>{project.name}</strong>
                        <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800 }}>{progress}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: '#fde7c7', overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: '#f59e0b' }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{project.city || 'City not set'} · {inr(project.contract_value)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent RA Bills" action="RA Bills" actionTo="/qs/ra-bills" delay={0.4} minHeight={240}>
            {recentBills.length === 0 ? (
              <EmptyState text="No RA bills available" />
            ) : (
              <div style={{ display: 'grid', gap: 7 }}>
                {recentBills.map((bill) => (
                  <div key={bill.id} style={{ border: '1px solid #e8edf3', borderRadius: 10, padding: '8px 12px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{bill.bill_number || `RA-${bill.id}`}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{dayjs(bill.bill_date || bill.created_at).format('DD MMM YYYY')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{inr(bill.net_payable || bill.total_amount)}</div>
                        <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 800, textTransform: 'uppercase' }}>{bill.status || 'draft'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent Payments" action="Payments" actionTo="/finance/payments" delay={0.45} minHeight={240}>
            {recentPayments.length === 0 ? (
              <EmptyState text="No payments recorded" />
            ) : (
              <div style={{ display: 'grid', gap: 7 }}>
                {recentPayments.map((payment) => (
                  <div key={payment.id} style={{ border: '1px solid #d1fae5', borderRadius: 10, padding: '8px 12px', background: '#ecfdf5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{payment.entity_name || payment.project_name || 'Payment Entry'}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{dayjs(payment.payment_date || payment.created_at).format('DD MMM YYYY')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{inr(payment.net_amount || payment.amount)}</div>
                        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>{payment.payment_type || 'payment'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <SectionCard title="Procurement & Stores Pulse" action="Inventory" actionTo="/procurement/inventory" delay={0.5} minHeight={220}>
            <div style={{ display: 'grid', gap: 8 }}>
              <PulseRow icon={ClipboardList} label="POs Requiring Attention" value={overduePOCount} sub={`${totalPurchaseOrders} total purchase orders`} />
              <PulseRow icon={Package} label="Low Stock Materials" value={lowStockCount} sub={topLowStock} />
              <PulseRow icon={Receipt} label="Pending Vendor Bills" value={pendingVendorBills} sub={inr(pendingVendorBillValue)} />
              <PulseRow icon={Building2} label="Open Documents" value={totalDocuments} sub={`${recentDocuments.length} recently uploaded`} />
            </div>
          </SectionCard>

          <SectionCard title="Quality & Safety Pulse" action="HSE" actionTo="/hse" delay={0.55} minHeight={220}>
            <div style={{ display: 'grid', gap: 8 }}>
              <PulseRow icon={Shield} label="Safety Score" value={safetyScoreValue != null ? `${Math.round(safetyScoreValue)}` : 'N/A'} sub={`${openIncidents} open incidents`} />
              <PulseRow icon={AlertTriangle} label="Expiring Permits" value={expiringPermits} sub={`${totalPermits} permits on record`} />
              <PulseRow icon={FileWarning} label="Open NCRs" value={openNCRs} sub={`${totalNCRCount} total NCR entries`} />
              <PulseRow icon={CheckCircle2} label="Open RFIs" value={openRFIs} sub={`${totalRFICount} total RFI entries`} />
            </div>
          </SectionCard>

          <SectionCard title="Documents & Workforce" action="Documents" actionTo="/documents" delay={0.6} minHeight={220}>
            {recentDocuments.length === 0 ? (
              <EmptyState text="No recent documents uploaded" />
            ) : (
              <div style={{ display: 'grid', gap: 7 }}>
                {recentDocuments.map((doc) => (
                  <div key={doc.id} style={{ border: '1px solid #e8edf3', borderRadius: 9, padding: '7px 10px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText style={{ width: 13, height: 13, color: '#6366f1', flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.file_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{doc.module || 'general'} · {dayjs(doc.created_at).format('DD MMM')}</div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid #eef2f7', display: 'grid', gap: 8 }}>
                  <PulseRow compact icon={HardHat} label="Registered Workforce" value={registeredWorkforce} sub="all active worker records" />
                  <PulseRow compact icon={CalendarRange} label="Completed Projects" value={completedProjectsCount} sub="closed or completed delivery" />
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

function PulseRow({ icon: Icon, label, value, sub, compact = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: '1px solid #e8edf3',
        borderRadius: 10,
        padding: '8px 10px',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: 'rgba(99,102,241,0.10)',
          color: '#6366f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: 14, height: 14 }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{value}</div>
    </div>
  );
}
