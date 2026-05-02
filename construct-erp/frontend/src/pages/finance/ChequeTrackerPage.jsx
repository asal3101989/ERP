import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleSlash, Search, ArrowRight, Banknote, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { paymentAPI, projectAPI } from '../../api/client';
import FinanceActionBar from '../../components/finance/FinanceActionBar';
import dayjs from 'dayjs';

const inr = v => `₹${Number(v || 0).toLocaleString('en-IN')}`;

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

export default function ChequeTrackerPage() {
  const [projectId, setProjectId] = useState('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['finance-cheque-projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['finance-cheque-payments'],
    queryFn: () => paymentAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const chequePayments = payments.filter(p => {
    const isCheque = String(p.payment_mode || '').toLowerCase().includes('cheque') || String(p.reference_number || '').toLowerCase().includes('chq');
    if (!isCheque) return false;
    if (projectId !== 'all' && p.project_id !== projectId) return false;
    if (startDate && p.payment_date && dayjs(p.payment_date).isBefore(dayjs(startDate), 'day')) return false;
    if (endDate && p.payment_date && dayjs(p.payment_date).isAfter(dayjs(endDate), 'day')) return false;
    if (search) {
      const s = search.toLowerCase();
      return [p.entity_name, p.reference_number, p.bank_name, p.project_name]
        .some(v => String(v || '').toLowerCase().includes(s));
    }
    return true;
  });

  const issued = chequePayments.length;
  const total = chequePayments.reduce((s, p) => s + Number(p.net_amount || p.amount || 0), 0);
  const withBank = chequePayments.filter(p => p.bank_name).length;
  const needsRef = chequePayments.filter(p => !p.reference_number).length;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1500px] mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <CircleSlash className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Cheque Tracker</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Issued cheques, references and bank details</p>
          </div>
        </div>
        <Link to="/finance/payments" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">
          Open Payments <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Cheque Issued" value={issued} sub={inr(total)} accent="indigo" />
        <Card label="With Bank Name" value={withBank} sub="Bank assigned" accent="emerald" />
        <Card label="Missing Ref" value={needsRef} sub="Needs reference number" accent="amber" />
        <Card label="Cheque Mode Value" value={inr(total)} sub="Tracked disbursement" accent="rose" />
      </div>

      <FinanceActionBar
        data={chequePayments}
        fileName="Cheque_Tracker"
        search={search}
        onSearchChange={setSearch}
        projectId={projectId}
        onProjectChange={setProjectId}
        projectOptions={projects}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        searchPlaceholder="Search cheque no, payee, bank or project"
        onReset={() => {
          setSearch('');
          setProjectId('all');
          setStartDate('');
          setEndDate('');
        }}
      />

      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Date', 'Project / Payee', 'Bank', 'Cheque / Ref', 'Amount', 'Status'].map(h => <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chequePayments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.payment_date ? dayjs(p.payment_date).format('DD MMM YYYY') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-900">{p.project_name || '—'}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{p.entity_name || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.bank_name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{p.reference_number || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-900 font-black">{inr(p.net_amount || p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${p.reference_number ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {p.reference_number ? 'Tracked' : 'Needs Ref'}
                    </span>
                  </td>
                </tr>
              ))}
              {!chequePayments.length && <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No cheque payments found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
