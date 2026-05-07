// src/pages/Dashboard.jsx
import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { motion, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, CartesianGrid,
} from 'recharts';
import {
  Building2, DollarSign, Shield, Receipt, TrendingUp,
  AlertTriangle, ArrowRight, RefreshCw, Package, CheckCircle2,
  Clock, Wallet, FileWarning, HardHat, CalendarRange, FileText,
  ClipboardList, Zap, Activity, ChevronRight, TrendingDown,
  BarChart2, Users, Star,
} from 'lucide-react';
import {
  projectAPI, analyticsAPI, dqsBillsAPI,
} from '../api/client';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';

const PMDashboard           = lazy(() => import('./dashboards/PMDashboard'));
const SiteEngineerDashboard = lazy(() => import('./dashboards/SiteEngineerDashboard'));
const QSDashboard           = lazy(() => import('./dashboards/QSDashboard'));
const AccountsDashboard     = lazy(() => import('./dashboards/AccountsDashboard'));
const HRDashboard           = lazy(() => import('./dashboards/HRDashboard'));
const HSEDashboard          = lazy(() => import('./dashboards/HSEDashboard'));
const StoresDashboard       = lazy(() => import('./dashboards/StoresDashboard'));
const ProcurementDashboard  = lazy(() => import('./dashboards/ProcurementDashboard'));

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

const GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#f093fb', '#f5576c'],
  ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'],
  ['#a1c4fd', '#c2e9fb'],
];

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
  const map = { '7d': 6, '30d': 29, '90d': 89, '1y': 364 };
  const days = map[range] ?? 29;
  return { dateFrom: now.subtract(days, 'day').format('YYYY-MM-DD'), dateTo: now.format('YYYY-MM-DD') };
};

// Animated counter
function AnimatedNumber({ target, prefix = '', suffix = '', format }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const controls = animate(0, parseFloat(target) || 0, {
      duration: 1.5, ease: 'easeOut',
      onUpdate: v => setVal(v),
    });
    return controls.stop;
  }, [target]);
  const display = format ? format(val) : Math.round(val);
  return <>{prefix}{display}{suffix}</>;
}

function DashLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%' }}
      />
    </div>
  );
}

// 3D tilt KPI card
function KpiCard({ title, value, rawValue, sub, gradient, icon: Icon, delay = 0, to }) {
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const ref = React.useRef(null);

  const handleMove = (e) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setRot({
      x: ((e.clientY - rect.top) / rect.height - 0.5) * 12,
      y: ((e.clientX - rect.left) / rect.width - 0.5) * -12,
    });
  };

  const inner = (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setRot({ x: 0, y: 0 })}
      animate={{ rotateX: rot.x, rotateY: rot.y }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ transformStyle: 'preserve-3d', perspective: 800, height: '100%' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay, duration: 0.5 }}
        whileHover={{ y: -3 }}
        style={{
          background: `linear-gradient(135deg,${gradient[0]},${gradient[1]})`,
          borderRadius: 14, padding: '18px 16px', color: '#fff',
          position: 'relative', overflow: 'hidden',
          boxShadow: `0 16px 32px ${gradient[0]}44`,
          height: '100%',
        }}
      >
        <div style={{ position: 'absolute', top: -15, right: -15, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 20, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 9, fontWeight: 700, opacity: 0.8, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' }}>{title}</p>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
              {rawValue !== undefined
                ? <AnimatedNumber target={rawValue} format={v => inr(v).replace('₹', '')} prefix="₹" />
                : value}
            </p>
            {sub && <p style={{ fontSize: 10, opacity: 0.7, marginTop: 5, lineHeight: 1.3 }}>{sub}</p>}
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', flexShrink: 0, marginLeft: 8 }}>
            <Icon size={19} color="#fff" />
          </div>
        </div>
        <div style={{ marginTop: 12, height: 2, background: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} transition={{ delay: delay + 0.4, duration: 1 }}
            style={{ height: '100%', background: 'rgba(255,255,255,0.65)', borderRadius: 2 }} />
        </div>
      </motion.div>
    </motion.div>
  );

  if (!to) return inner;
  return <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
}

// Glass section card
function GlassCard({ title, action, actionTo, children, delay = 0, style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        padding: '16px 18px',
        ...style,
      }}
    >
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          {title && (
            <p style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} color="#6366f1" /> {title}
            </p>
          )}
          {action && actionTo && (
            <Link to={actionTo} style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              {action} <ChevronRight size={12} />
            </Link>
          )}
        </div>
      )}
      {children}
    </motion.div>
  );
}

function EmptyState({ text }) {
  return <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{text}</div>;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,23,42,0.92)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 11 }}>
      <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: '2px 0', color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? `₹${compactNumber(p.value)}` : p.value}
        </p>
      ))}
    </div>
  );
};

function PulseRow({ icon: Icon, label, value, sub, color = '#6366f1' }) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${color}22`, borderRadius: 10, padding: '9px 10px', background: `${color}08` }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={color} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
    </motion.div>
  );
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

  const { data: tqsBills = [] } = useQuery({
    queryKey: ['dashboard-tqs-bills', refreshKey],
    queryFn: () => dqsBillsAPI.list({}).then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])).catch(() => []),
  });

  const dashboardProjects   = dashboard?.projects || [];
  const filterOptions       = dashboard?.filters?.options || {};
  const projectOptions      = filterOptions.projects?.length ? filterOptions.projects : companyProjects.map(p => ({ id: p.id, name: p.name, project_code: p.project_code, type: p.type }));
  const businessUnitOptions = filterOptions.business_units?.length ? filterOptions.business_units : [...new Set(companyProjects.map(p => p.type).filter(Boolean))].sort();
  const dashboardKpis       = dashboard?.kpis || {};
  const dashboardCharts     = dashboard?.charts || {};
  const dashboardRecent     = dashboard?.recent || {};
  const dashboardWatchlists = dashboard?.watchlists || {};
  const dashboardPulse      = dashboard?.pulse || {};
  const dashboardExceptions = dashboard?.exceptions || [];

  const safeProjects  = Array.isArray(dashboardProjects) ? dashboardProjects : [];
  const safeRABills   = Array.isArray(dashboardRecent.ra_bills) ? dashboardRecent.ra_bills : [];
  const safePayments  = Array.isArray(dashboardRecent.payments) ? dashboardRecent.payments : [];
  const safeDocs      = Array.isArray(dashboardRecent.documents) ? dashboardRecent.documents : [];

  const lowStockCount         = dashboardKpis.low_stock_count ?? dashboardPulse?.procurement_stores?.low_stock_materials ?? 0;
  const workforceCount        = dashboardKpis.workforce_count ?? 0;
  const openIncidents         = dashboardKpis.open_incidents ?? 0;
  const expiringPermits       = dashboardKpis.expiring_permits ?? 0;
  const openRFIs              = dashboardKpis.open_rfis ?? 0;
  const openNCRs              = dashboardKpis.open_ncrs ?? 0;
  const safetyScore           = dashboardKpis.safety_score;
  const activeProjects        = dashboardKpis.active_projects ?? 0;
  const delayedProjects       = dashboardKpis.delayed_projects ?? 0;
  const completedProjects     = dashboardKpis.completed_projects ?? 0;
  const planningProjects      = dashboardKpis.planning_projects ?? 0;
  const totalContractValue    = dashboardKpis.total_contract_value ?? 0;
  const totalCertified        = dashboardKpis.total_certified ?? 0;
  const pendingRABillCount    = dashboardKpis.pending_ra_bills ?? 0;
  const pendingRAValue        = dashboardKpis.pending_ra_value ?? 0;
  const totalCollections      = dashboardKpis.total_collections ?? 0;
  const receivables           = dashboardKpis.receivables ?? Math.max(totalCertified - totalCollections, 0);
  const documentsCount        = dashboardKpis.documents_count ?? safeDocs.length;
  const financeTrendData      = dashboardCharts.finance_trend || [];
  const projectStatusData     = dashboardCharts.project_status || [];
  const delayedWatchlist      = [...(dashboardWatchlists.delayed_projects || [])].slice(0, 5);
  const recentBills           = [...safeRABills].slice(0, 5);
  const recentPayments        = [...safePayments].slice(0, 5);
  const recentDocuments       = [...safeDocs].slice(0, 4);
  const topLowStock           = dashboardPulse?.procurement_stores?.top_low_stock_material || 'No critical material';
  const overduePOCount        = dashboardPulse?.procurement_stores?.pos_requiring_attention ?? 0;
  const totalPurchaseOrders   = dashboardPulse?.procurement_stores?.total_pos ?? 0;
  const totalDocuments        = dashboardPulse?.procurement_stores?.open_documents ?? documentsCount;
  const registeredWorkforce   = dashboardPulse?.documents_workforce?.workforce_count ?? workforceCount;
  const completedProjectsCount = dashboardPulse?.documents_workforce?.completed_projects ?? completedProjects;
  const totalPermits          = dashboardPulse?.quality_safety?.permits_count ?? expiringPermits;
  const totalRFICount         = dashboardPulse?.quality_safety?.rfi_count ?? openRFIs;
  const totalNCRCount         = dashboardPulse?.quality_safety?.ncr_count ?? openNCRs;
  const pendingVendorBills    = dashboardPulse?.procurement_stores?.pending_vendor_bills ?? pendingRABillCount;
  const pendingVendorBillValue = dashboardPulse?.procurement_stores?.pending_vendor_bill_value ?? pendingRAValue;
  const safetyScoreValue      = dashboardPulse?.quality_safety?.safety_score ?? safetyScore;
  const collectionRate        = totalCertified > 0 ? Math.round((totalCollections / totalCertified) * 100) : 0;

  // TQS bills stats
  const tqsTotalBills      = tqsBills.length;
  const tqsTotalInvoice    = tqsBills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const tqsTotalCertified  = tqsBills.reduce((s, b) => s + parseFloat(b.certified_net || 0), 0);
  const tqsTotalPaid       = tqsBills.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);
  const tqsBalance         = tqsTotalCertified - tqsTotalPaid;
  const tqsPaid            = tqsBills.filter(b => b.workflow_status === 'paid').length;
  const tqsPending         = tqsBills.filter(b => b.workflow_status !== 'paid').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Radial data for collection rate
  const radialData = [{ name: 'Collected', value: collectionRate, fill: '#10b981' }];

  return (
    <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 40%,#0f172a 100%)', minHeight: '100vh', fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Animated bg blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {[...Array(5)].map((_, i) => (
          <motion.div key={i}
            animate={{ x: [0, 20, 0], y: [0, -20, 0], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 7 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: i * 1.2 }}
            style={{
              position: 'absolute', borderRadius: '50%',
              width: 350 + i * 80, height: 350 + i * 80,
              background: `radial-gradient(circle,${['#6366f144','#8b5cf644','#06b6d433','#f59e0b22','#10b98133'][i]},transparent)`,
              left: `${[5, 55, 25, 75, 40][i]}%`, top: `${[5, 45, 75, 15, 55][i]}%`,
              transform: 'translate(-50%,-50%)',
            }}
          />
        ))}
      </div>

      {/* Top bar */}
      <div style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px #6366f155' }}>
            <Zap size={16} color="#fff" />
          </motion.div>
          <div>
            <div style={{ fontSize: 9, color: '#818cf8', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Executive Command Centre</div>
            <h1 style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: 0 }}>{greeting}, {user?.name?.split(' ')[0] || 'Admin'}</h1>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{dayjs().format('dddd, D MMMM YYYY')} · Portfolio wide view</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dashboardLoading && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 16, height: 16, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%' }} />
          )}
          <Link to="/projects" style={{ textDecoration: 'none' }}>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
              <Building2 size={13} /> All Projects
            </motion.button>
          </Link>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setRefreshKey(k => k + 1)}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={13} color="rgba(255,255,255,0.6)" />
          </motion.button>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '20px 24px', maxWidth: 1520, margin: '0 auto' }}>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', marginBottom: 18, backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(140px,0.6fr) minmax(140px,0.6fr)', gap: 10, alignItems: 'end' }}>
            {[
              { label: 'Project', value: selectedProjectId, onChange: setSelectedProjectId, options: [{ value: 'all', label: 'All Projects' }, ...projectOptions.map(p => ({ value: p.id, label: p.project_code ? `${p.name} (${p.project_code})` : p.name }))] },
              { label: 'Date Range', value: selectedDateRange, onChange: setSelectedDateRange, options: [{ value: 'all', label: 'All Time' }, { value: '7d', label: 'Last 7 Days' }, { value: '30d', label: 'Last 30 Days' }, { value: '90d', label: 'Last 90 Days' }, { value: '1y', label: 'Last 1 Year' }] },
              { label: 'Business Unit', value: selectedBusinessUnit, onChange: setSelectedBusinessUnit, options: [{ value: 'all', label: 'All Units' }, ...businessUnitOptions.map(u => ({ value: u, label: u }))] },
            ].map(f => (
              <label key={f.label} style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</span>
                <select value={f.value} onChange={e => f.onChange(e.target.value)}
                  style={{ height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', padding: '0 10px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 600, outline: 'none' }}>
                  {f.options.map(o => <option key={o.value} value={o.value} style={{ background: '#1e293b' }}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </motion.div>

        {/* KPI Cards — row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
          <KpiCard title="Portfolio Value"    rawValue={totalContractValue} sub={`${safeProjects.length} projects`} gradient={GRADIENTS[0]} icon={DollarSign}  delay={0}    to="/projects" />
          <KpiCard title="Certified Billing"  rawValue={totalCertified}     sub={`${pendingRABillCount} bills pending`} gradient={GRADIENTS[1]} icon={Receipt}    delay={0.07} to="/qs/ra-bills" />
          <KpiCard title="Collections"        rawValue={totalCollections}   sub={`${inr(receivables)} receivable`} gradient={GRADIENTS[2]} icon={Wallet}     delay={0.14} to="/finance/payments" />
          <KpiCard title="Pending RA Value"   rawValue={pendingRAValue}     sub={`${pendingRABillCount} pending bills`} gradient={GRADIENTS[3]} icon={Clock}      delay={0.21} to="/qs/ra-bills" />
        </div>

        {/* KPI Cards — row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
          <KpiCard title="Active Projects"  value={activeProjects}  sub={`${delayedProjects} delayed · ${planningProjects} planning`} gradient={GRADIENTS[4]} icon={Building2}   delay={0.28} to="/projects" />
          <KpiCard title="Safety Score"     value={safetyScore != null ? `${Math.round(safetyScore)}/100` : 'N/A'} sub={`${openIncidents} open incidents`} gradient={GRADIENTS[5]} icon={Shield}      delay={0.35} to="/hse/incidents" />
          <KpiCard title="Quality Issues"   value={openRFIs + openNCRs} sub={`${openRFIs} RFIs · ${openNCRs} NCRs`} gradient={GRADIENTS[6]} icon={FileWarning}  delay={0.42} to="/quality" />
          <KpiCard title="Workforce"        value={workforceCount} sub={`${documentsCount} documents`} gradient={GRADIENTS[7]} icon={HardHat}      delay={0.49} to="/hr/workers" />
        </div>

        {/* TQS Bills Summary Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
          <KpiCard title="TQS Total Bills"     value={String(tqsTotalBills)}          sub={`${tqsPaid} paid · ${tqsPending} pending`}  gradient={['#f7971e','#ffd200']} icon={FileText}      delay={0.56} to="/tqs" />
          <KpiCard title="TQS Invoice Value"   rawValue={tqsTotalInvoice}             sub="Total vendor invoices"                       gradient={['#11998e','#38ef7d']} icon={DollarSign}    delay={0.6}  to="/tqs/bills" />
          <KpiCard title="TQS Certified"       rawValue={tqsTotalCertified}           sub="QS certified amount"                         gradient={['#6a11cb','#2575fc']} icon={ClipboardList}  delay={0.64} to="/tqs/bills" />
          <KpiCard title="TQS Balance to Pay"  rawValue={tqsBalance}                  sub="Outstanding vendor payments"                 gradient={['#f953c6','#b91d73']} icon={Clock}          delay={0.68} to="/tqs/bills" />
        </div>

        {/* Charts row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Area chart */}
          <GlassCard title="Billing vs Collections Trend" delay={0.3}>
            {financeTrendData.every(i => i.billed === 0 && i.collected === 0) ? (
              <EmptyState text="No billing or collection data for selected range" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={financeTrendData}>
                  <defs>
                    <linearGradient id="gBill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCollect" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="billed" stroke="#6366f1" strokeWidth={2.5} fill="url(#gBill)" name="Billed" />
                  <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.5} fill="url(#gCollect)" name="Collected" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              {[['#6366f1', 'Billed'], ['#10b981', 'Collected']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 18, height: 2.5, background: c, borderRadius: 2 }} />
                  <span style={{ fontSize: 10, color: '#64748b' }}>{l}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Project status donut */}
          <GlassCard title="Project Status" action="View All" actionTo="/projects" delay={0.35}>
            {projectStatusData.length === 0 ? <EmptyState text="No project data" /> : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={projectStatusData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3} animationBegin={400} animationDuration={1000}>
                      {projectStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 10, color: '#fff', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'grid', gap: 5 }}>
                  {projectStatusData.map((item, i) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: '#64748b' }}>{item.name}</span>
                      <strong style={{ marginLeft: 'auto', color: '#0f172a' }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </GlassCard>

          {/* Collection rate radial */}
          <GlassCard title="Collection Rate" delay={0.4}>
            <div style={{ position: 'relative', height: 150 }}>
              <ResponsiveContainer width="100%" height={150}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="45%" outerRadius="85%"
                  data={[{ name: 'Collected', value: collectionRate, fill: '#10b981' }, { name: 'Target', value: 100, fill: '#e2e8f0' }]}
                  startAngle={180} endAngle={-180}>
                  <RadialBar dataKey="value" cornerRadius={6} animationBegin={500} animationDuration={1200} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <p style={{ fontSize: 26, fontWeight: 800, color: '#10b981', margin: 0 }}>{collectionRate}%</p>
                <p style={{ fontSize: 9, color: '#94a3b8', margin: 0 }}>of certified</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#64748b' }}>Certified</span>
                <strong style={{ color: '#0f172a' }}>{inr(totalCertified)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#64748b' }}>Collected</span>
                <strong style={{ color: '#10b981' }}>{inr(totalCollections)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#64748b' }}>Outstanding</span>
                <strong style={{ color: '#ef4444' }}>{inr(receivables)}</strong>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Exceptions + Delayed watchlist row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.2fr', gap: 14, marginBottom: 14 }}>

          {/* Exceptions */}
          <GlassCard title="Exceptions & Alerts" delay={0.45}>
            <div style={{ display: 'grid', gap: 7 }}>
              {dashboardExceptions.length === 0 ? <EmptyState text="No exceptions" /> : dashboardExceptions.map((card) => (
                <Link key={card.label} to={card.to} style={{ textDecoration: 'none', border: `1px solid ${card.tone}33`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, background: `${card.tone}08` }}>
                  <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: card.tone, flexShrink: 0 }} />
                  <span style={{ color: '#334155', fontSize: 12, fontWeight: 600 }}>{card.label}</span>
                  <span style={{ marginLeft: 'auto', color: '#0f172a', fontSize: 15, fontWeight: 800 }}>{card.value}</span>
                </Link>
              ))}
            </div>
          </GlassCard>

          {/* Delayed projects */}
          <GlassCard title="Delayed Projects Watchlist" action="View All" actionTo="/projects" delay={0.5}>
            {delayedWatchlist.length === 0 ? <EmptyState text="No delayed projects" /> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {delayedWatchlist.map((project) => {
                  const progress = Math.max(0, Math.min(100, parseFloat(project.progress_pct || 0)));
                  return (
                    <motion.div key={project.id} whileHover={{ x: 3 }}
                      style={{ border: '1px solid #fde7c7', borderRadius: 10, padding: '10px 12px', background: '#fff7ed' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ color: '#0f172a', fontSize: 12 }}>{project.name}</strong>
                        <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800 }}>{progress}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: '#fde7c7', overflow: 'hidden', marginBottom: 4 }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: 0.6 }}
                          style={{ height: '100%', background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{project.city || 'City not set'} · {inr(project.contract_value)}</div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Recent Payments */}
          <GlassCard title="Recent Payments" action="View All" actionTo="/finance/payments" delay={0.55}>
            {recentPayments.length === 0 ? <EmptyState text="No payments recorded" /> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {recentPayments.map((payment) => (
                  <motion.div key={payment.id} whileHover={{ x: 3 }}
                    style={{ border: '1px solid #d1fae5', borderRadius: 10, padding: '8px 12px', background: '#ecfdf5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payment.entity_name || payment.project_name || 'Payment'}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{dayjs(payment.payment_date || payment.created_at).format('DD MMM YYYY')}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>{inr(payment.net_amount || payment.amount)}</div>
                        <div style={{ fontSize: 9, color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>{payment.payment_type || 'payment'}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Bottom pulse row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

          <GlassCard title="Procurement & Stores Pulse" action="Inventory" actionTo="/procurement/inventory" delay={0.6}>
            <div style={{ display: 'grid', gap: 7 }}>
              <PulseRow icon={ClipboardList} label="POs Requiring Attention" value={overduePOCount}      sub={`${totalPurchaseOrders} total orders`}     color="#f97316" />
              <PulseRow icon={Package}       label="Low Stock Materials"      value={lowStockCount}       sub={topLowStock}                                color="#ef4444" />
              <PulseRow icon={Receipt}       label="Pending Vendor Bills"     value={pendingVendorBills}  sub={inr(pendingVendorBillValue)}                color="#8b5cf6" />
              <PulseRow icon={Building2}     label="Open Documents"           value={totalDocuments}      sub={`${recentDocuments.length} recent uploads`} color="#06b6d4" />
            </div>
          </GlassCard>

          <GlassCard title="Quality & Safety Pulse" action="HSE" actionTo="/hse" delay={0.65}>
            <div style={{ display: 'grid', gap: 7 }}>
              <PulseRow icon={Shield}        label="Safety Score"       value={safetyScoreValue != null ? `${Math.round(safetyScoreValue)}` : 'N/A'} sub={`${openIncidents} open incidents`}   color="#10b981" />
              <PulseRow icon={AlertTriangle} label="Expiring Permits"   value={expiringPermits}  sub={`${totalPermits} permits on record`}           color="#f59e0b" />
              <PulseRow icon={FileWarning}   label="Open NCRs"          value={openNCRs}         sub={`${totalNCRCount} total NCR entries`}           color="#ef4444" />
              <PulseRow icon={CheckCircle2}  label="Open RFIs"          value={openRFIs}         sub={`${totalRFICount} total RFI entries`}           color="#6366f1" />
            </div>
          </GlassCard>

          <GlassCard title="Documents & Workforce" action="Documents" actionTo="/documents" delay={0.7}>
            {recentDocuments.length === 0 ? <EmptyState text="No recent documents" /> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {recentDocuments.map((doc) => (
                  <motion.div key={doc.id} whileHover={{ x: 3 }}
                    style={{ border: '1px solid #e8edf3', borderRadius: 9, padding: '7px 10px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={13} color="#6366f1" />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.file_name}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{doc.module || 'general'} · {dayjs(doc.created_at).format('DD MMM')}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'grid', gap: 6 }}>
                  <PulseRow icon={HardHat}      label="Registered Workforce"  value={registeredWorkforce}      sub="active worker records" color="#6366f1" />
                  <PulseRow icon={CalendarRange} label="Completed Projects"    value={completedProjectsCount}   sub="closed deliveries"     color="#10b981" />
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        select option { background: #1e293b; color: #fff; }
      `}</style>
    </div>
  );
}
