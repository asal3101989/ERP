import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen, FileText, Receipt, CreditCard, DollarSign, TrendingUp, Landmark,
  Wallet, ArrowRight, LineChart, BarChart3, ClipboardList, CircleSlash,
  FileSignature, Clock3, BadgeDollarSign, ShieldCheck
} from 'lucide-react';

const workspaces = [
  {
    label: 'Overview',
    to: '/finance',
    icon: BookOpen,
    tone: 'indigo',
    desc: 'Dashboards, management highlights and the finance starting point.',
    featured: true,
    links: [
      { label: 'Accounts Dashboard', to: '/finance/accounts-dashboard' },
      { label: 'Control Dashboard', to: '/finance/control-dashboard' },
      { label: 'Management MIS', to: '/finance/management-mis' },
    ],
  },
  {
    label: 'Payables',
    to: '/finance/payables',
    icon: FileText,
    tone: 'rose',
    desc: 'Vendor invoices, bill booking, approvals and payable control.',
    links: [
      { label: 'Vendor Payables', to: '/finance/invoices' },
      { label: 'Bill Booking', to: '/finance/invoices/booking' },
      { label: 'Payment Run', to: '/finance/payment-run' },
    ],
  },
  {
    label: 'Payments',
    to: '/finance/payments',
    icon: Wallet,
    tone: 'emerald',
    desc: 'Outgoing disbursements, bank matching, instruments and treasury follow-through.',
    links: [
      { label: 'Bank Reconciliation', to: '/finance/bank-reconciliation' },
      { label: 'Cheque Tracker', to: '/finance/cheque-tracker' },
      { label: 'TQS-linked Payments', to: '/tqs/bills' },
    ],
  },
  {
    label: 'Receivables',
    to: '/finance/receivables',
    icon: FileSignature,
    tone: 'sky',
    desc: 'Client-side collections, RA bill receipts and outstanding visibility.',
    links: [
      { label: 'Customer Statements', to: '/finance/customer-statements' },
      { label: 'RA Bills', to: '/qs/ra-bills' },
      { label: 'Receipts Register', to: '/finance/payments?tab=ra-bills' },
    ],
  },
  {
    label: 'Tax & Compliance',
    to: '/finance/tax-compliance',
    icon: DollarSign,
    tone: 'amber',
    desc: 'GST, TDS and statutory follow-up in one lane.',
    links: [
      { label: 'GST Billing', to: '/finance/gst' },
      { label: 'TDS Register', to: '/finance/tds' },
      { label: 'Control Dashboard', to: '/finance/control-dashboard' },
    ],
  },
  {
    label: 'Reports',
    to: '/finance/reports',
    icon: BarChart3,
    tone: 'violet',
    desc: 'Budget, project P&L, billing reports and finance intelligence.',
    links: [
      { label: 'Budget vs Actual', to: '/finance/budget' },
      { label: 'Finance Intelligence', to: '/finance/intelligence' },
      { label: 'Billing Reports', to: '/finance/billing-reports' },
    ],
  },
];

const TONE = {
  indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  violet: 'border-violet-100 bg-violet-50 text-violet-700',
  sky: 'border-sky-100 bg-sky-50 text-sky-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
};

const supportTools = [
  { label: 'Accounts Dashboard', to: '/finance/accounts-dashboard', icon: BookOpen, desc: 'AP aging and payment queue', tone: 'emerald' },
  { label: 'Bill Booking', to: '/finance/invoices/booking', icon: ClipboardList, desc: '3-way matching and invoice intake', tone: 'amber' },
  { label: 'Bank Reconciliation', to: '/finance/bank-reconciliation', icon: Landmark, desc: 'Books vs bank match register', tone: 'sky' },
  { label: 'Payment Run', to: '/finance/payment-run', icon: Clock3, desc: 'Batch-ready payable queue', tone: 'slate' },
  { label: 'GST Billing', to: '/finance/gst', icon: DollarSign, desc: 'GST invoice register', tone: 'amber' },
  { label: 'TDS Register', to: '/finance/tds', icon: CreditCard, desc: 'TDS payable and certificates', tone: 'violet' },
  { label: 'Customer Statements', to: '/finance/customer-statements', icon: BadgeDollarSign, desc: 'Collections and receivable aging', tone: 'emerald' },
  { label: 'Control Dashboard', to: '/finance/control-dashboard', icon: ShieldCheck, desc: 'Approval and control checks', tone: 'slate' },
];

function MenuCard({ item }) {
  const body = (
    <div
      className={[
        'group rounded-3xl border p-5 transition-all shadow-sm h-full',
        item.featured
          ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10'
          : item.soon
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${item.featured ? 'bg-white/10 border-white/10' : TONE[item.tone] || TONE.slate}`}>
          <item.icon className={`w-4 h-4 ${item.featured ? 'text-white' : ''}`} />
        </div>
        {!item.soon && (
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${item.featured ? 'border-white/20 text-white/80' : 'border-slate-200 text-slate-400'}`}>
            Open
          </span>
        )}
        {item.soon && (
          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-slate-200 text-slate-400">
            Coming Soon
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className={`font-black text-[0.98rem] tracking-tight ${item.featured ? 'text-white' : 'text-slate-900'}`}>{item.label}</h3>
        <p className={`text-[12px] mt-1.5 ${item.featured ? 'text-white/70' : 'text-slate-500'}`}>{item.desc}</p>
      </div>
      {Array.isArray(item.links) && item.links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.links.map(link => (
            <span
              key={link.label}
              className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${item.featured ? 'border-white/15 text-white/70' : 'border-slate-200 text-slate-400'}`}
            >
              {link.label}
            </span>
          ))}
        </div>
      )}
      {!item.soon && (
        <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em]">
          <span className={item.featured ? 'text-white/70' : 'text-slate-400'}>Go to page</span>
          <ArrowRight className={`w-3 h-3 ${item.featured ? 'text-white/70' : 'text-slate-400 group-hover:translate-x-0.5 transition-transform'}`} />
        </div>
      )}
    </div>
  );

  if (item.soon) return body;
  return <Link to={item.to} className="block h-full">{body}</Link>;
}

export default function FinanceHubPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-5 space-y-5 max-w-[1500px] mx-auto bg-slate-50 min-h-screen text-[0.94rem]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-[0.2em] border border-indigo-100">
            <DollarSign className="w-2.5 h-2.5" />
            Finance Module
          </div>
          <div>
            <h1 className="text-[1.3rem] md:text-[1.75rem] font-black text-slate-900 uppercase tracking-tight italic">Finance Command Center</h1>
            <p className="text-slate-500 mt-1.5 max-w-3xl text-[12px] leading-5">
              Six clear workspaces for payables, payments, receivables, tax, reporting and finance oversight.
              The detailed tools still exist, but the first choice is now much calmer.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => navigate('/finance/payables')}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white font-black text-[7px] uppercase tracking-[0.18em] shadow-lg shadow-slate-900/10"
          >
            Open Payables
          </button>
          <button
            onClick={() => navigate('/finance/receivables')}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-[7px] uppercase tracking-[0.18em] shadow-sm"
          >
            Open Receivables
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Primary Menus', value: '6', sub: 'Finance workspaces' },
          { label: 'Core Workflows', value: 'AP / AR', sub: 'Split more clearly' },
          { label: 'Support Tools', value: '8', sub: 'Still available below' },
          { label: 'Quick Start', value: 'Overview', sub: 'Start from the hub' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-[1.5rem] p-4 shadow-sm">
            <div className="text-[7px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</div>
            <div className="mt-2 text-[1.25rem] font-black text-slate-900 italic">{card.value}</div>
            <div className="mt-1.5 text-[8px] font-bold text-slate-500 uppercase tracking-[0.14em]">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <section className="space-y-2.5">
          <div>
            <h2 className="text-[0.82rem] font-black text-slate-900 uppercase tracking-tight">Primary Workspaces</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">These are the only six destinations shown in the Finance sidebar.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {workspaces.map(item => (
              <MenuCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className="space-y-2.5">
          <div>
            <h2 className="text-[0.82rem] font-black text-slate-900 uppercase tracking-tight">Support Tools</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Useful operational pages that stay available from links, but no longer crowd the sidebar.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {supportTools.map(item => (
              <MenuCard key={item.label} item={item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
