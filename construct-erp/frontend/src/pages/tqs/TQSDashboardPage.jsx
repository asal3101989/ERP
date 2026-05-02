import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tqsBillsAPI, tqsTrackerAPI, projectAPI } from '../../api/client';
import {
  LayoutDashboard, FileText, Clock, CheckCircle2,
  AlertTriangle, TrendingUp, Package, ArrowRight,
  IndianRupee, ClipboardCheck, Warehouse, CreditCard
} from 'lucide-react';

const inr = (v) => Math.round(Number(v || 0)).toLocaleString('en-IN');

const STATUS_COLORS = {
  pending:  { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-400' },
  stores:   { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-400' },
  document_controller: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-400' },
  qs:       { bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-400' },
  accounts: { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-400' },
  procurement: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400' },
  paid:     { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-400' },
};

export default function TQSDashboardPage() {
  const navigate = useNavigate();

  const { data: bills = [] } = useQuery({
    queryKey: ['tqs-bills-all'],
    queryFn: () => tqsBillsAPI.list({}).then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d?.projects ?? d?.data ?? []);
    }),
  });

  // KPI calculations
  const totalBills   = bills.length;
  const pending      = bills.filter(b => b.workflow_status === 'pending').length;
  const inStores     = bills.filter(b => b.workflow_status === 'stores').length;
  const inDocControl = bills.filter(b => b.workflow_status === 'document_controller').length;
  const inQS         = bills.filter(b => b.workflow_status === 'qs').length;
  const inAccounts   = bills.filter(b => b.workflow_status === 'accounts').length;
  const inProcurement = bills.filter(b => b.workflow_status === 'procurement').length;
  const paid         = bills.filter(b => b.workflow_status === 'paid').length;

  const totalInvoiceValue = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const totalPaid         = bills.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);
  const totalCertified    = bills.reduce((s, b) => s + parseFloat(b.certified_net || 0), 0);
  const totalPending      = totalCertified - totalPaid;

  // Overdue: certified but not paid, and older than 30 days
  const today = new Date();
  const overdue = bills.filter(b => {
    if (b.workflow_status === 'paid') return false;
    if (!b.certified_net || parseFloat(b.certified_net) <= 0) return false;
    const created = new Date(b.created_at);
    return (today - created) / (1000 * 60 * 60 * 24) > 30;
  });

  // Recent bills (last 10)
  const recent = [...bills].slice(0, 10);

  // Workflow pipeline breakdown
  const pipeline = [
    { label: 'Pending',   value: pending,    status: 'pending',  icon: Clock },
    { label: 'Stores',    value: inStores,   status: 'stores',   icon: Warehouse },
    { label: 'Doc Ctrl',  value: inDocControl, status: 'document_controller', icon: FileText },
    { label: 'QS',        value: inQS,       status: 'qs',       icon: ClipboardCheck },
    { label: 'Accounts',  value: inAccounts, status: 'accounts', icon: CreditCard },
    { label: 'Procure',   value: inProcurement, status: 'procurement', icon: Package },
    { label: 'Paid',      value: paid,       status: 'paid',     icon: CheckCircle2 },
  ];

  return (
    <div className="p-6 space-y-6 bg-[#f4f6f9] min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">TQS Dashboard</h1>
          <p className="text-xs text-slate-500">Invoice tracker overview — all departments</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Bills',       value: totalBills,   sub: 'All invoices',          color: 'bg-indigo-600', icon: FileText },
          { label: 'Invoice Value',     value: `₹${inr(totalInvoiceValue)}`, sub: 'Total invoiced', color: 'bg-blue-600', icon: IndianRupee },
          { label: 'Certified Amount',  value: `₹${inr(totalCertified)}`,    sub: 'QS certified',   color: 'bg-purple-600', icon: ClipboardCheck },
          { label: 'Balance to Pay',    value: `₹${inr(totalPending)}`,      sub: 'Pending payment', color: 'bg-amber-500', icon: Clock },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
            <div className={`w-10 h-10 ${k.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <k.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-800 truncate">{k.value}</p>
              <p className="text-xs text-slate-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Workflow Pipeline</h2>
        <div className="flex gap-2 items-stretch">
          {pipeline.map((p, i) => {
            const cfg = STATUS_COLORS[p.status];
            const pct = totalBills > 0 ? Math.round((p.value / totalBills) * 100) : 0;
            return (
              <React.Fragment key={p.status}>
                <button
                  onClick={() => navigate(`/tqs/bills?status=${p.status}`)}
                  className={`flex-1 rounded-xl border ${cfg.border} ${cfg.bg} p-3 text-center hover:shadow-md transition-all group`}
                >
                  <p.icon className={`w-5 h-5 mx-auto mb-1.5 ${cfg.text}`} />
                  <p className={`text-2xl font-bold ${cfg.text}`}>{p.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.label}</p>
                  <p className="text-xs text-slate-400">{pct}%</p>
                </button>
                {i < pipeline.length - 1 && (
                  <div className="flex items-center text-slate-300">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Overdue Alert */}
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Overdue Bills</h2>
            {overdue.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                {overdue.length} overdue
              </span>
            )}
          </div>
          {overdue.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500">No overdue bills</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {overdue.slice(0, 8).map(b => (
                <button
                  key={b.id}
                  onClick={() => navigate(`/tqs/bills/${b.id}`)}
                  className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 truncate">{b.vendor_name}</p>
                    <p className="text-[10px] text-slate-400">{b.inv_number} · ₹{inr(b.certified_net || b.total_amount)}</p>
                  </div>
                </button>
              ))}
              {overdue.length > 8 && (
                <button onClick={() => navigate('/tqs/bills?status=accounts')} className="w-full text-center text-xs text-indigo-600 hover:underline pt-1">
                  View all {overdue.length} overdue →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent Bills */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Recent Bills</h2>
            <button onClick={() => navigate('/tqs/bills')} className="text-xs text-indigo-600 hover:underline">View all →</button>
          </div>
          <div className="space-y-1">
            {recent.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No bills yet</p>
            ) : recent.map(b => {
              const cfg = STATUS_COLORS[b.workflow_status] || STATUS_COLORS.pending;
              return (
                <button
                  key={b.id}
                  onClick={() => navigate(`/tqs/bills/${b.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{b.vendor_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{b.sl_number} · {b.inv_number}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-slate-700">₹{inr(b.total_amount)}</p>
                    <span className={`text-[10px] font-semibold ${cfg.text}`}>
                      {b.workflow_status?.charAt(0).toUpperCase() + b.workflow_status?.slice(1)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
