import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import {
  AreaChart, Area, RadialBarChart, RadialBar,
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { tqsBillsAPI, projectAPI } from '../../api/client';
import {
  FileText, Clock, CheckCircle2, AlertTriangle,
  Package, IndianRupee, ClipboardCheck, Warehouse,
  CreditCard, TrendingUp, ChevronRight, Zap, Activity
} from 'lucide-react';

const inr = (v) => Math.round(Number(v || 0)).toLocaleString('en-IN');

const STATUS_CONFIG = {
  pending:             { label: 'Pending',     color: '#F59E0B', icon: Clock },
  stores:              { label: 'Stores',      color: '#3B82F6', icon: Warehouse },
  document_controller: { label: 'Doc Control', color: '#06B6D4', icon: FileText },
  qs:                  { label: 'QS',          color: '#6366F1', icon: ClipboardCheck },
  accounts:            { label: 'Accounts',    color: '#8B5CF6', icon: CreditCard },
  procurement:         { label: 'Procurement', color: '#F97316', icon: Package },
  paid:                { label: 'Paid',        color: '#10B981', icon: CheckCircle2 },
};

const GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'],
];

// Animated counter hook
function useAnimatedCounter(target, duration = 1.5) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: v => setValue(Math.round(v)),
    });
    return controls.stop;
  }, [target]);
  return value;
}

// 3D Tilt Card
function TiltCard({ children, style = {}, className = '' }) {
  const ref = useRef(null);
  const [rot, setRot] = useState({ x: 0, y: 0 });

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 14;
    const y = ((e.clientX - rect.left) / rect.width - 0.5) * -14;
    setRot({ x, y });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setRot({ x: 0, y: 0 })}
      animate={{ rotateX: rot.x, rotateY: rot.y }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ transformStyle: 'preserve-3d', perspective: 800, ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// KPI Card with 3D tilt + animated counter
function KpiCard({ label, value, numericValue, sub, gradient, icon: Icon, delay = 0 }) {
  const count = useAnimatedCounter(numericValue || 0);
  const displayValue = numericValue !== undefined
    ? (value.startsWith('₹') ? `₹${inr(count)}` : count)
    : value;

  return (
    <TiltCard>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay, duration: 0.5, ease: 'easeOut' }}
        style={{
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          borderRadius: 16,
          padding: '22px 20px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 20px 40px ${gradient[0]}55`,
          cursor: 'default',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Background circles */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 20, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: -0.5 }}>{displayValue}</p>
            {sub && <p style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>{sub}</p>}
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', transform: 'translateZ(20px)' }}>
            <Icon size={22} color="#fff" />
          </div>
        </div>

        <div style={{ marginTop: 16, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '70%' }}
            transition={{ delay: delay + 0.3, duration: 1, ease: 'easeOut' }}
            style={{ height: '100%', background: 'rgba(255,255,255,0.7)', borderRadius: 2 }}
          />
        </div>
      </motion.div>
    </TiltCard>
  );
}

// Glassmorphism card
function GlassCard({ children, style = {}, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        padding: 20,
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Activity size={14} color="#6366f1" /> {children}
    </p>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,23,42,0.9)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 11 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: '2px 0 0', color: p.color }}>₹{inr(p.value)}</p>
      ))}
    </div>
  );
};

export default function DQSDashboardPage() {
  const navigate = useNavigate();

  const { data: bills = [] } = useQuery({
    queryKey: ['tqs-bills-all'],
    queryFn: () => tqsBillsAPI.list({}).then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
  });

  const totalBills      = bills.length;
  const pending         = bills.filter(b => b.workflow_status === 'pending').length;
  const inStores        = bills.filter(b => b.workflow_status === 'stores').length;
  const inDocControl    = bills.filter(b => b.workflow_status === 'document_controller').length;
  const inQS            = bills.filter(b => b.workflow_status === 'qs').length;
  const inAccounts      = bills.filter(b => b.workflow_status === 'accounts').length;
  const inProcurement   = bills.filter(b => b.workflow_status === 'procurement').length;
  const paid            = bills.filter(b => b.workflow_status === 'paid').length;

  const totalInvoiceValue = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const totalPaid         = bills.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);
  const totalCertified    = bills.reduce((s, b) => s + parseFloat(b.certified_net || 0), 0);
  const totalPending      = totalCertified - totalPaid;

  const today = new Date();
  const overdue = bills.filter(b => {
    if (b.workflow_status === 'paid') return false;
    if (!b.certified_net || parseFloat(b.certified_net) <= 0) return false;
    return (today - new Date(b.created_at)) / (1000 * 60 * 60 * 24) > 30;
  });

  const recent = [...bills].slice(0, 6);

  // Pipeline data for radial chart
  const pipelineData = [
    { name: 'Paid',        value: paid,          fill: '#10B981' },
    { name: 'Accounts',   value: inAccounts,     fill: '#8B5CF6' },
    { name: 'QS',         value: inQS,           fill: '#6366F1' },
    { name: 'Procurement',value: inProcurement,  fill: '#F97316' },
    { name: 'Doc Control',value: inDocControl,   fill: '#06B6D4' },
    { name: 'Stores',     value: inStores,       fill: '#3B82F6' },
    { name: 'Pending',    value: pending,        fill: '#F59E0B' },
  ];

  // Donut data
  const donutData = pipelineData.filter(d => d.value > 0);

  // Bar chart — monthly mock using real totals split
  const barData = [
    { month: 'Jan', invoiced: totalInvoiceValue * 0.08, certified: totalCertified * 0.07 },
    { month: 'Feb', invoiced: totalInvoiceValue * 0.1,  certified: totalCertified * 0.09 },
    { month: 'Mar', invoiced: totalInvoiceValue * 0.13, certified: totalCertified * 0.12 },
    { month: 'Apr', invoiced: totalInvoiceValue * 0.15, certified: totalCertified * 0.14 },
    { month: 'May', invoiced: totalInvoiceValue * 0.12, certified: totalCertified * 0.11 },
    { month: 'Jun', invoiced: totalInvoiceValue * 0.18, certified: totalCertified * 0.16 },
    { month: 'Jul', invoiced: totalInvoiceValue * 0.24, certified: totalCertified * 0.31 },
  ];

  // Area chart
  const areaData = barData.map(d => ({ ...d, paid: d.certified * 0.75 }));

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)', minHeight: '100vh', padding: '0' }}>

      {/* Animated background dots */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ x: [0, 30, 0], y: [0, -30, 0], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 6 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: i }}
            style={{
              position: 'absolute',
              width: 300 + i * 80,
              height: 300 + i * 80,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${['#6366f155','#8b5cf655','#06b6d455','#f59e0b33','#10b98133','#f9731633'][i]}, transparent)`,
              left: `${[10, 60, 30, 80, 5, 50][i]}%`,
              top: `${[10, 50, 80, 20, 60, 40][i]}%`,
              transform: 'translate(-50%,-50%)',
            }}
          />
        ))}
      </div>

      {/* Top Bar */}
      <div style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px #6366f155' }}
          >
            <Zap size={18} color="#fff" />
          </motion.div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>DQS Dashboard</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Live invoice tracker · All departments</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {overdue.length > 0 && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '6px 12px' }}
            >
              <AlertTriangle size={13} color="#ef4444" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{overdue.length} overdue</span>
            </motion.div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {totalBills} total bills
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Total Bills"      value={String(totalBills)}            numericValue={totalBills}       sub="All invoices"       gradient={GRADIENTS[0]} icon={FileText}      delay={0} />
          <KpiCard label="Invoice Value"    value={`₹${inr(totalInvoiceValue)}`}  numericValue={totalInvoiceValue} sub="Total invoiced"    gradient={GRADIENTS[2]} icon={IndianRupee}   delay={0.1} />
          <KpiCard label="Certified Amount" value={`₹${inr(totalCertified)}`}     numericValue={totalCertified}    sub="QS certified"      gradient={GRADIENTS[3]} icon={ClipboardCheck} delay={0.2} />
          <KpiCard label="Balance to Pay"   value={`₹${inr(totalPending)}`}       numericValue={totalPending}      sub="Pending payment"   gradient={GRADIENTS[4]} icon={Clock}         delay={0.3} />
        </div>

        {/* Mini stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Pending',     value: pending,       color: '#F59E0B' },
            { label: 'Stores',      value: inStores,      color: '#3B82F6' },
            { label: 'Doc Control', value: inDocControl,  color: '#06B6D4' },
            { label: 'QS',          value: inQS,          color: '#6366F1' },
            { label: 'Accounts',    value: inAccounts,    color: '#8B5CF6' },
            { label: 'Procurement', value: inProcurement, color: '#F97316' },
            { label: 'Paid',        value: paid,          color: '#10B981' },
          ].map((s, i) => (
            <motion.button
              key={s.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              whileHover={{ scale: 1.05, y: -3 }}
              onClick={() => navigate(`/tqs/bills?status=${Object.keys(STATUS_CONFIG)[i]}`)}
              style={{
                background: `${s.color}15`,
                border: `1.5px solid ${s.color}40`,
                borderRadius: 12,
                padding: '12px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</p>
              <div style={{ marginTop: 6, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: totalBills > 0 ? `${Math.round((s.value / totalBills) * 100)}%` : '0%' }}
                  transition={{ delay: 0.6 + i * 0.05, duration: 0.8 }}
                  style={{ height: '100%', background: s.color, borderRadius: 1 }}
                />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Area Chart */}
          <GlassCard delay={0.5}>
            <SectionTitle>Invoice vs Certified Trend</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={areaData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gInvoiced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCertified" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${inr(v)}`} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="invoiced" stroke="#6366f1" strokeWidth={2.5} fill="url(#gInvoiced)" dot={false} name="Invoiced" />
                <Area type="monotone" dataKey="certified" stroke="#10b981" strokeWidth={2.5} fill="url(#gCertified)" dot={false} name="Certified" />
                <Area type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={2} fill="url(#gPaid)" dot={false} name="Paid" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {[['#6366f1', 'Invoiced'], ['#10b981', 'Certified'], ['#f59e0b', 'Paid']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 20, height: 3, background: c, borderRadius: 2 }} />
                  <span style={{ fontSize: 10, color: '#64748b' }}>{l}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Donut Chart */}
          <GlassCard delay={0.55}>
            <SectionTitle>Pipeline Distribution</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={donutData.length ? donutData : [{ name: 'No data', value: 1, fill: '#e2e8f0' }]}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={300}
                  animationDuration={1200}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} bills`, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: -4 }}>
              {donutData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill }} />
                  <span style={{ fontSize: 9, color: '#64748b' }}>{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Charts Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Bar Chart */}
          <GlassCard delay={0.6} style={{ gridColumn: 'span 2' }}>
            <SectionTitle>Monthly Invoice vs Certified</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }} barSize={14} barGap={4}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${inr(v)}`} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} name="Invoiced" />
                <Bar dataKey="certified" fill="#10b981" radius={[4, 4, 0, 0]} name="Certified" />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Radial progress */}
          <GlassCard delay={0.65}>
            <SectionTitle>Collection Rate</SectionTitle>
            <div style={{ position: 'relative', height: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="90%" data={[
                  { name: 'Paid', value: totalCertified > 0 ? Math.round((totalPaid / totalCertified) * 100) : 0, fill: '#10b981' },
                  { name: 'Target', value: 100, fill: '#e2e8f0' },
                ]} startAngle={180} endAngle={-180}>
                  <RadialBar dataKey="value" cornerRadius={6} animationBegin={400} animationDuration={1200} />
                  <Tooltip formatter={v => [`${v}%`]} contentStyle={{ fontSize: 11 }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#10b981', margin: 0 }}>
                  {totalCertified > 0 ? Math.round((totalPaid / totalCertified) * 100) : 0}%
                </p>
                <p style={{ fontSize: 9, color: '#94a3b8', margin: 0 }}>collected</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>

          {/* Overdue */}
          <GlassCard delay={0.7}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <SectionTitle>Overdue Bills</SectionTitle>
              {overdue.length > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '2px 8px' }}
                >
                  {overdue.length}
                </motion.span>
              )}
            </div>
            {overdue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 8px 24px #10b98144' }}
                >
                  <CheckCircle2 size={24} color="#fff" />
                </motion.div>
                <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, margin: 0 }}>All on track</p>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>No overdue payments</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {overdue.slice(0, 5).map((b, i) => (
                  <motion.button
                    key={b.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.05 }}
                    whileHover={{ x: 4 }}
                    onClick={() => navigate(`/tqs/bills/${b.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={13} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.vendor_name}</p>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>₹{inr(b.certified_net || b.total_amount)}</p>
                    </div>
                    <ChevronRight size={12} color="#d1d5db" />
                  </motion.button>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Recent Bills */}
          <GlassCard delay={0.75}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <SectionTitle>Recent Bills</SectionTitle>
              <button onClick={() => navigate('/tqs/bills')} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 80px', gap: 8, padding: '0 10px 8px', borderBottom: '1px solid #f1f5f9' }}>
              {['Vendor', 'Invoice', 'Amount', 'Status'].map(h => (
                <span key={h} style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {recent.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No bills yet</p>
              ) : recent.map((b, i) => {
                const cfg = STATUS_CONFIG[b.workflow_status] || STATUS_CONFIG.pending;
                return (
                  <motion.button
                    key={b.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85 + i * 0.05 }}
                    whileHover={{ x: 4, background: 'rgba(99,102,241,0.04)' }}
                    onClick={() => navigate(`/tqs/bills/${b.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 80px', gap: 8, padding: '9px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.vendor_name}</span>
                    <span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.inv_number || b.sl_number}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>₹{inr(b.total_amount)}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.color + '18', padding: '3px 8px', borderRadius: 20, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {cfg.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
