import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, FileText, Receipt, CreditCard, DollarSign,
  TrendingUp, Landmark, ShieldCheck, Wallet, ArrowRight, LineChart, BarChart3,
  Building2, Calculator, ClipboardList, CircleSlash, Banknote, FileSignature,
  FolderSearch, Clock3, BadgeDollarSign
} from 'lucide-react';

const sections = [
  {
    title: 'Overview',
    subtitle: 'Start here for a Zoho Books-style finance command center',
    items: [
      { label: 'Finance Home', to: '/finance', icon: LayoutDashboard, tone: 'indigo', desc: 'Executive finance landing page', featured: true },
      { label: 'Accounts Dashboard', to: '/finance/accounts-dashboard', icon: BookOpen, tone: 'emerald', desc: 'AP aging and payment queue' },
      { label: 'Finance Intelligence', to: '/finance/intelligence', icon: LineChart, tone: 'violet', desc: 'Vendor ledger, P&L and AP aging' },
      { label: 'Billing Reports', to: '/finance/billing-reports', icon: BarChart3, tone: 'sky', desc: 'Registers and cash flow analysis' },
    ],
  },
  {
    title: 'Sales & Receivables',
    subtitle: 'Customer billing, collections and statutory tax tracking',
    items: [
      { label: 'RA Bills', to: '/qs/ra-bills', icon: Receipt, tone: 'indigo', desc: 'Running account bills and certification' },
      { label: 'GST Billing', to: '/finance/gst', icon: DollarSign, tone: 'amber', desc: 'Tax invoice and GST summary' },
      { label: 'Collections', to: '/finance/customer-statements', icon: BadgeDollarSign, tone: 'emerald', desc: 'Receipts and collection visibility' },
      { label: 'Customer Statements', to: '/finance/customer-statements', icon: FileSignature, tone: 'slate', desc: 'Statement of accounts and ageing' },
    ],
  },
  {
    title: 'Purchases & Payables',
    subtitle: 'Vendor invoices, bill booking and payment processing',
    items: [
      { label: 'Vendor Payables', to: '/finance/invoices', icon: FileText, tone: 'rose', desc: 'Audit and authorize vendor invoices' },
      { label: 'Bill Booking', to: '/finance/invoices/booking', icon: ClipboardList, tone: 'amber', desc: '3-way matching and invoice booking' },
      { label: 'Payments', to: '/finance/payments', icon: Wallet, tone: 'emerald', desc: 'Payment register and disbursement control' },
      { label: 'TDS Register', to: '/finance/tds', icon: CreditCard, tone: 'violet', desc: 'TDS payable and credit tracking' },
    ],
  },
  {
    title: 'Banking & Cash',
    subtitle: 'Cash movement, bank control and reconciliation',
    items: [
      { label: 'Cash Flow', to: '/finance/billing-reports', icon: Banknote, tone: 'emerald', desc: 'Billing and payment movement trends' },
      { label: 'Bank Reconciliation', to: '/finance/bank-reconciliation', icon: Landmark, tone: 'sky', desc: 'Match books with bank register' },
      { label: 'Payment Run', to: '/finance/payment-run', icon: Clock3, tone: 'slate', desc: 'Batch queue for payments' },
      { label: 'Cheque / UTR Tracker', to: '/finance/cheque-tracker', icon: CircleSlash, tone: 'slate', desc: 'Instrument and reference control' },
    ],
  },
  {
    title: 'Budget & Control',
    subtitle: 'Project profitability, control accounts and budget monitoring',
    items: [
      { label: 'Budget vs Actual', to: '/finance/budget', icon: TrendingUp, tone: 'violet', desc: 'Cost head budget performance' },
      { label: 'Project P&L', to: '/finance/intelligence', icon: LineChart, tone: 'emerald', desc: 'Project-level revenue and margin' },
      { label: 'AP Aging', to: '/finance/accounts-dashboard', icon: Calculator, tone: 'amber', desc: 'Outstanding liability buckets' },
      { label: 'Control Dashboard', to: '/finance/control-dashboard', icon: ShieldCheck, tone: 'slate', desc: 'Approvals and controls matrix' },
    ],
  },
  {
    title: 'Reports & Compliance',
    subtitle: 'Statutory reports and management summaries',
    items: [
      { label: 'Finance Reports', to: '/finance/billing-reports', icon: BarChart3, tone: 'sky', desc: 'Registers, ageing and summaries' },
      { label: 'GST Summary', to: '/finance/gst', icon: DollarSign, tone: 'amber', desc: 'GST invoice register' },
      { label: 'TDS Summary', to: '/finance/tds', icon: CreditCard, tone: 'violet', desc: 'Form 26Q and TDS ledgers' },
      { label: 'Management MIS', to: '/finance/management-mis', icon: FolderSearch, tone: 'slate', desc: 'Executive financial MIS pack' },
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
              A Zoho Books-style menu hub for sales, purchases, banking, taxes, budgets and reporting.
              Use it as the one place to jump into every finance workflow.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => navigate('/finance/intelligence')}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white font-black text-[7px] uppercase tracking-[0.18em] shadow-lg shadow-slate-900/10"
          >
            Open Intelligence
          </button>
          <button
            onClick={() => navigate('/finance/billing-reports')}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-[7px] uppercase tracking-[0.18em] shadow-sm"
          >
            Billing Reports
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Menu Sections', value: '6', sub: 'Zoho-style groups' },
          { label: 'Live Pages', value: '9', sub: 'Already implemented' },
          { label: 'Coming Soon', value: '12', sub: 'Planned finance tools' },
          { label: 'Quick Start', value: 'Finance Home', sub: 'Start from the hub' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-[1.5rem] p-4 shadow-sm">
            <div className="text-[7px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</div>
            <div className="mt-2 text-[1.25rem] font-black text-slate-900 italic">{card.value}</div>
            <div className="mt-1.5 text-[8px] font-bold text-slate-500 uppercase tracking-[0.14em]">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {sections.map(section => (
          <section key={section.title} className="space-y-2.5">
            <div>
              <h2 className="text-[0.82rem] font-black text-slate-900 uppercase tracking-tight">{section.title}</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">{section.subtitle}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {section.items.map(item => (
                <MenuCard key={item.label} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
