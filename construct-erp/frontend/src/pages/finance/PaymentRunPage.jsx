import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Receipt, Wallet, ArrowRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { invoiceAPI, paymentAPI, projectAPI, tqsBillsAPI } from '../../api/client';
import dayjs from 'dayjs';

const inr = v => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const asArray = (value) => (Array.isArray(value) ? value : []);

function Card({ label, value, sub, accent = 'indigo' }) {
  const colors = {
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
  };
  return (
    <div className={`rounded-[1.75rem] border p-5 shadow-sm bg-white ${colors[accent] || colors.indigo}`}>
      <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-black font-mono tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] font-bold uppercase tracking-widest opacity-60">{sub}</div>}
    </div>
  );
}

export default function PaymentRunPage() {
  const [projectId, setProjectId] = useState('all');
  const [search, setSearch] = useState('');

  const { data: projectsRes } = useQuery({
    queryKey: ['finance-payment-run-projects'],
    queryFn: () => projectAPI.list().then(r => r.data).catch(() => null),
  });

  const { data: vendorInvoicesRes } = useQuery({
    queryKey: ['finance-payment-run-invoices'],
    queryFn: () => invoiceAPI.list({ status: 'authorized' }).then(r => r.data).catch(() => null),
  });

  const { data: tqsBillsRes } = useQuery({
    queryKey: ['finance-payment-run-tqs', projectId],
    queryFn: () => tqsBillsAPI.list({ status: 'accounts', ...(projectId !== 'all' ? { project_id: projectId } : {}) }).then(r => r.data).catch(() => null),
  });

  const { data: paymentsRes } = useQuery({
    queryKey: ['finance-payment-run-payments'],
    queryFn: () => paymentAPI.list().then(r => r.data).catch(() => null),
  });

  const projects = asArray(projectsRes?.data || projectsRes);
  const vendorInvoices = asArray(vendorInvoicesRes?.data || vendorInvoicesRes);
  const tqsBills = asArray(tqsBillsRes?.data || tqsBillsRes);
  const payments = asArray(paymentsRes?.data || paymentsRes);

  const invoiceQueue = vendorInvoices.filter(i => projectId === 'all' || i.project_id === projectId);
  const tqsQueue = tqsBills.filter(b => projectId === 'all' || b.project_id === projectId);
  const recent = payments.filter(p => projectId === 'all' || p.project_id === projectId).slice(0, 8);

  const totalQueued =
    invoiceQueue.reduce((s, i) => s + Number(i.net_amount || 0), 0) +
    tqsQueue.reduce((s, b) => s + Number(b.certified_net || b.total_amount || 0), 0);

  const searchLower = search.toLowerCase();
  const recentFiltered = recent.filter(p =>
    !search ||
    [p.entity_name, p.reference_number, p.payment_mode, p.project_name]
      .some(v => String(v || '').toLowerCase().includes(searchLower))
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto bg-slate-50 min-h-screen text-[0.94rem]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Clock3 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[1.25rem] md:text-[1.5rem] font-black text-slate-900 uppercase tracking-tight italic">Payment Run</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Queue for vendor invoices and TQS bills ready for settlement</p>
          </div>
        </div>
        <Link to="/finance/payments" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest shadow-lg">
          Open Payments <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Invoices Ready" value={invoiceQueue.length} sub={inr(invoiceQueue.reduce((s, i) => s + Number(i.net_amount || 0), 0))} accent="indigo" />
        <Card label="TQS Bills Ready" value={tqsQueue.length} sub={inr(tqsQueue.reduce((s, b) => s + Number(b.certified_net || b.total_amount || 0), 0))} accent="emerald" />
        <Card label="Payment Run Value" value={inr(totalQueued)} sub="Current queue total" accent="amber" />
        <Card label="Recent Payments" value={recent.length} sub="Latest disbursements" accent="rose" />
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] p-4 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recent payments"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-400"
          />
        </div>
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-[10px] font-black uppercase tracking-widest outline-none min-w-[180px]"
        >
          <option value="all">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setSearch('');
            setProjectId('all');
          }}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 uppercase tracking-tight">Vendor Invoices Ready</h2>
              <p className="text-xs text-slate-500 mt-1">Authorized bills waiting for payment action</p>
            </div>
            <Receipt className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Invoice', 'Project', 'Vendor', 'Due', 'Amount'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceQueue.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-indigo-600 font-black">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-700">{inv.project_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{inv.vendor_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.due_date ? dayjs(inv.due_date).format('DD MMM YYYY') : '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-900 font-black">{inr(inv.net_amount)}</td>
                  </tr>
                ))}
                {!invoiceQueue.length && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                      No vendor invoices ready
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 uppercase tracking-tight">TQS Bills Ready</h2>
              <p className="text-xs text-slate-500 mt-1">Accounts stage bills awaiting payment run</p>
            </div>
            <Wallet className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['SL #', 'Project', 'Vendor', 'Inv Date', 'Certified Net'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tqsQueue.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-emerald-600 font-black">{b.sl_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.project_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.vendor_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{b.inv_date ? dayjs(b.inv_date).format('DD MMM YYYY') : '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-900 font-black">{inr(b.certified_net || b.total_amount)}</td>
                  </tr>
                ))}
                {!tqsQueue.length && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                      No TQS bills queued for payment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-black text-slate-900 uppercase tracking-tight">Recent Payments</h2>
            <p className="text-xs text-slate-500 mt-1">Latest payments recorded in the register</p>
          </div>
          <Wallet className="w-5 h-5 text-rose-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Date', 'Project', 'Payee', 'Mode', 'Reference', 'Amount'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentFiltered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-500">{p.payment_date ? dayjs(p.payment_date).format('DD MMM YYYY') : '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{p.project_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{p.entity_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.payment_mode || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{p.reference_number || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-900 font-black">{inr(p.net_amount || p.amount)}</td>
                </tr>
              ))}
              {!recentFiltered.length && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                    No payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
