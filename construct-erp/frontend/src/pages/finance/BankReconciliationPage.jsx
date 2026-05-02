import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark, Search, ArrowRightLeft, CheckCircle2, AlertTriangle, Banknote } from 'lucide-react';
import { projectAPI, paymentAPI } from '../../api/client';
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

const modeGroup = mode => {
  const m = String(mode || '').toLowerCase();
  if (m.includes('cheque')) return 'Cheque';
  if (m.includes('rtgs') || m.includes('neft') || m.includes('imps') || m.includes('upi')) return 'Electronic';
  if (m.includes('cash')) return 'Cash';
  return 'Other';
};

export default function BankReconciliationPage() {
  const [selectedProject, setSelectedProject] = useState('all');
  const [mode, setMode] = useState('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['finance-bank-projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['finance-bank-payments'],
    queryFn: () => paymentAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const filtered = payments.filter(p => {
    if (selectedProject !== 'all' && p.project_id !== selectedProject) return false;
    if (mode !== 'all' && modeGroup(p.payment_mode) !== mode) return false;
    if (startDate && p.payment_date && dayjs(p.payment_date).isBefore(dayjs(startDate), 'day')) return false;
    if (endDate && p.payment_date && dayjs(p.payment_date).isAfter(dayjs(endDate), 'day')) return false;
    if (search) {
      const s = search.toLowerCase();
      return [p.entity_name, p.reference_number, p.bank_name, p.payment_type, p.project_name]
        .some(v => String(v || '').toLowerCase().includes(s));
    }
    return true;
  });

  const total = filtered.reduce((s, p) => s + Number(p.net_amount || p.amount || 0), 0);
  const cheque = filtered.filter(p => modeGroup(p.payment_mode) === 'Cheque').length;
  const electronic = filtered.filter(p => modeGroup(p.payment_mode) === 'Electronic').length;
  const needsReview = filtered.filter(p => !p.reference_number || !p.bank_name).length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto bg-slate-50 min-h-screen text-[0.94rem]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Landmark className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[1.25rem] md:text-[1.5rem] font-black text-slate-900 uppercase tracking-tight italic">Bank Reconciliation</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Payment register, bank references and mode-wise matching</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total Banked" value={inr(total)} sub={`${filtered.length} payments`} accent="indigo" />
        <Card label="Cheque Payments" value={cheque} sub="Physical instruments" accent="amber" />
        <Card label="Electronic Payments" value={electronic} sub="RTGS / NEFT / IMPS / UPI" accent="emerald" />
        <Card label="Needs Review" value={needsReview} sub="Missing bank ref / bank name" accent="rose" />
      </div>

      <FinanceActionBar
        data={filtered}
        fileName="Bank_Reconciliation"
        search={search}
        onSearchChange={setSearch}
        projectId={selectedProject}
        onProjectChange={setSelectedProject}
        projectOptions={projects}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        searchPlaceholder="Search payee, ref, bank, or project"
        onReset={() => {
          setSearch('');
          setSelectedProject('all');
          setMode('all');
          setStartDate('');
          setEndDate('');
        }}
        extraControls={
          <select value={mode} onChange={e => setMode(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-[10px] font-black uppercase tracking-widest outline-none">
            <option value="all">All Modes</option>
            <option value="Cheque">Cheque</option>
            <option value="Electronic">Electronic</option>
            <option value="Cash">Cash</option>
            <option value="Other">Other</option>
          </select>
        }
      />

      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Date', 'Project / Payee', 'Mode', 'Bank', 'Reference', 'Amount', 'Review'].map(h => (
                  <th key={h} className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => {
                const review = !p.reference_number || !p.bank_name ? 'Review' : 'Matched';
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-5 text-xs font-bold text-slate-500 whitespace-nowrap">{p.payment_date ? dayjs(p.payment_date).format('DD MMM YYYY') : '—'}</td>
                    <td className="py-4 px-5">
                      <div className="font-black text-slate-900">{p.project_name || '—'}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{p.entity_name || '—'}</div>
                    </td>
                    <td className="py-4 px-5 text-xs font-bold uppercase tracking-widest">{p.payment_mode || '—'}</td>
                    <td className="py-4 px-5 text-xs text-slate-500">{p.bank_name || '—'}</td>
                    <td className="py-4 px-5 font-mono text-slate-700">{p.reference_number || '—'}</td>
                    <td className="py-4 px-5 font-mono text-slate-900 font-black">{inr(p.net_amount || p.amount)}</td>
                    <td className="py-4 px-5">
                      <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${review === 'Matched' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {review}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[11px]">No payment records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
