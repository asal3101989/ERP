import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tqsBillsAPI, tqsTrackerAPI, projectAPI } from '../../api/client';
import {
  LayoutDashboard, FileText, Clock, CheckCircle2,
  AlertTriangle, Package, ArrowRight,
  IndianRupee, ClipboardCheck, Warehouse, CreditCard,
  TrendingUp, ChevronRight, Bell, RefreshCw
} from 'lucide-react';

const inr = (v) => Math.round(Number(v || 0)).toLocaleString('en-IN');

const STATUS_CONFIG = {
  pending:             { label: 'Pending',     color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
  stores:              { label: 'Stores',      color: '#3B82F6', bg: '#EFF6FF', icon: Warehouse },
  document_controller: { label: 'Doc Control', color: '#06B6D4', bg: '#ECFEFF', icon: FileText },
  qs:                  { label: 'QS',          color: '#6366F1', bg: '#EEF2FF', icon: ClipboardCheck },
  accounts:            { label: 'Accounts',    color: '#8B5CF6', bg: '#F5F3FF', icon: CreditCard },
  procurement:         { label: 'Procurement', color: '#F97316', bg: '#FFF7ED', icon: Package },
  paid:                { label: 'Paid',        color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
};

function ZohoKpiCard({ label, value, sub, accent, icon: Icon, trend }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8ECF0', padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, letterSpacing: 0.2 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: accent + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#1A202C', margin: 0, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</p>}
      </div>
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: -2 }}>
          <TrendingUp size={12} style={{ color: '#10B981' }} />
          <span style={{ fontSize: 11, color: '#10B981', fontWeight: 500 }}>{trend}</span>
        </div>
      )}
    </div>
  );
}

function PipelineStage({ label, value, total, color, bg, icon: Icon, status, onClick }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: bg, border: `1.5px solid ${color}22`,
        borderRadius: 8, padding: '14px 10px', textAlign: 'center',
        cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px ${color}33`; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = `${color}22`; }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{pct}%</p>
    </button>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1A202C', margin: 0, letterSpacing: 0.1 }}>{title}</h2>
      {action && (
        <button onClick={onAction} style={{ fontSize: 12, color: '#1A6FCC', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
          {action} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}

export default function TQSDashboardPage() {
  const navigate = useNavigate();

  const { data: bills = [], isLoading, refetch } = useQuery({
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

  const recent = [...bills].slice(0, 8);

  const pipeline = [
    { status: 'pending',             value: pending },
    { status: 'stores',              value: inStores },
    { status: 'document_controller', value: inDocControl },
    { status: 'qs',                  value: inQS },
    { status: 'accounts',            value: inAccounts },
    { status: 'procurement',         value: inProcurement },
    { status: 'paid',                value: paid },
  ];

  return (
    <div style={{ background: '#F0F2F5', minHeight: '100vh', padding: '0' }}>
      {/* Zoho-style Top Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8ECF0', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #1A6FCC, #0D4E99)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutDashboard size={16} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#1A202C', margin: 0 }}>TQS Dashboard</h1>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Invoice tracker · All departments</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {overdue.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '5px 10px' }}>
              <Bell size={13} style={{ color: '#EF4444' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}>{overdue.length} overdue</span>
            </div>
          )}
          <button
            onClick={() => refetch()}
            style={{ width: 32, height: 32, borderRadius: 6, background: '#F3F4F6', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <RefreshCw size={14} style={{ color: '#6B7280' }} />
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <ZohoKpiCard label="Total Bills"       value={totalBills}              sub="All invoices"       accent="#1A6FCC" icon={FileText}      trend={`${paid} paid this cycle`} />
          <ZohoKpiCard label="Invoice Value"     value={`₹${inr(totalInvoiceValue)}`} sub="Total invoiced" accent="#0891B2" icon={IndianRupee}   />
          <ZohoKpiCard label="Certified Amount"  value={`₹${inr(totalCertified)}`}    sub="QS certified"   accent="#7C3AED" icon={ClipboardCheck} />
          <ZohoKpiCard label="Balance to Pay"    value={`₹${inr(totalPending)}`}      sub="Pending payment" accent="#D97706" icon={Clock}          trend={overdue.length > 0 ? `${overdue.length} overdue` : 'On track'} />
        </div>

        {/* Workflow Pipeline */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8ECF0', padding: '20px 20px 18px', marginBottom: 24 }}>
          <SectionHeader title="Workflow Pipeline" action="View Bills" onAction={() => navigate('/tqs/bills')} />
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            {pipeline.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status];
              return (
                <React.Fragment key={p.status}>
                  <PipelineStage
                    label={cfg.label}
                    value={p.value}
                    total={totalBills}
                    color={cfg.color}
                    bg={cfg.bg}
                    icon={cfg.icon}
                    status={p.status}
                    onClick={() => navigate(`/tqs/bills?status=${p.status}`)}
                  />
                  {i < pipeline.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', color: '#D1D5DB' }}>
                      <ArrowRight size={14} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>

          {/* Overdue Bills */}
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8ECF0', padding: '20px' }}>
            <SectionHeader
              title="Overdue Bills"
              action={overdue.length > 4 ? `View all ${overdue.length}` : undefined}
              onAction={() => navigate('/tqs/bills?status=accounts')}
            />
            {overdue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <CheckCircle2 size={22} style={{ color: '#10B981' }} />
                </div>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0, fontWeight: 500 }}>All bills on track</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>No overdue payments</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                {overdue.slice(0, 6).map(b => (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/tqs/bills/${b.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 6,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      transition: 'background 0.12s', textAlign: 'left', width: '100%',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 6, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={14} style={{ color: '#EF4444' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#1A202C', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.vendor_name}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0' }}>{b.inv_number} · ₹{inr(b.certified_net || b.total_amount)}</p>
                    </div>
                    <ChevronRight size={13} style={{ color: '#D1D5DB', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Bills */}
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8ECF0', padding: '20px' }}>
            <SectionHeader title="Recent Bills" action="View all" onAction={() => navigate('/tqs/bills')} />
            {recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: 13, color: '#9CA3AF' }}>No bills yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 90px', gap: 8, padding: '4px 10px 8px', borderBottom: '1px solid #F3F4F6' }}>
                  {['Vendor', 'Invoice No.', 'Amount', 'Status'].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
                  ))}
                </div>
                {recent.map(b => {
                  const cfg = STATUS_CONFIG[b.workflow_status] || STATUS_CONFIG.pending;
                  return (
                    <button
                      key={b.id}
                      onClick={() => navigate(`/tqs/bills/${b.id}`)}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 100px 90px', gap: 8,
                        padding: '9px 10px', borderRadius: 6,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        transition: 'background 0.12s', textAlign: 'left', alignItems: 'center',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A202C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.vendor_name}</span>
                      <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.inv_number || b.sl_number}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A202C' }}>₹{inr(b.total_amount)}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: cfg.color,
                        background: cfg.bg,
                        padding: '3px 8px', borderRadius: 20,
                        display: 'inline-block', whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
