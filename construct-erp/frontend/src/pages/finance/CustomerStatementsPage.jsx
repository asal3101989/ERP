import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeDollarSign, FileSignature, Search, Filter, Receipt, Wallet, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { projectAPI, raBillAPI } from '../../api/client';
import FinanceActionBar from '../../components/finance/FinanceActionBar';
import dayjs from 'dayjs';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const statusTone = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  submitted: 'bg-amber-50 text-amber-600 border-amber-200',
  verified: 'bg-blue-50 text-blue-600 border-blue-200',
  certified: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  paid: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

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

export default function CustomerStatementsPage() {
  const [selectedProject, setSelectedProject] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['finance-customer-projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['finance-customer-statements'],
    queryFn: () => raBillAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const filtered = bills.filter(b => {
    if (selectedProject !== 'all' && b.project_id !== selectedProject) return false;
    if (status !== 'all' && b.status !== status) return false;
    if (startDate && b.bill_date && dayjs(b.bill_date).isBefore(dayjs(startDate), 'day')) return false;
    if (endDate && b.bill_date && dayjs(b.bill_date).isAfter(dayjs(endDate), 'day')) return false;
    if (search) {
      const s = search.toLowerCase();
      return [b.bill_number, b.project_name, b.contractor_name, b.work_description]
        .some(v => String(v || '').toLowerCase().includes(s));
    }
    return true;
  });

  const billed = filtered.reduce((s, b) => s + Number(b.net_payable || 0), 0);
  const received = filtered.reduce((s, b) => s + Number(b.amount_received || 0), 0);
  const outstanding = billed - received;
  const paidCount = filtered.filter(b => b.status === 'paid').length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto bg-slate-50 min-h-screen text-[0.94rem]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <FileSignature className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[1.25rem] md:text-[1.5rem] font-black text-slate-900 uppercase tracking-tight italic">Customer Statements</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Project-wise receivables, RA bills and collections</p>
          </div>
        </div>
        <Link to="/qs/ra-bills" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest shadow-lg">
          Open RA Bills <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total Billed" value={inr(billed)} sub={`${filtered.length} bills`} accent="indigo" />
        <Card label="Total Received" value={inr(received)} sub="Client receipts posted" accent="emerald" />
        <Card label="Outstanding" value={inr(outstanding)} sub="Open receivable balance" accent="rose" />
        <Card label="Paid Bills" value={paidCount} sub="Closed / cleared" accent="amber" />
      </div>

      <FinanceActionBar
        data={filtered}
        fileName="Customer_Statements"
        search={search}
        onSearchChange={setSearch}
        projectId={selectedProject}
        onProjectChange={setSelectedProject}
        projectOptions={projects}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        searchPlaceholder="Search project, contractor, or bill number"
        onReset={() => {
          setSearch('');
          setSelectedProject('all');
          setStatus('all');
          setStartDate('');
          setEndDate('');
        }}
        extraControls={
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-[10px] font-black uppercase tracking-widest outline-none"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="verified">Verified</option>
            <option value="certified">Certified</option>
            <option value="paid">Paid</option>
          </select>
        }
      />

      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Project / Contractor', 'Bill', 'Bill Date', 'Net Payable', 'Received', 'Balance', 'Status'].map(h => (
                  <th key={h} className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(b => {
                const balance = Number(b.net_payable || 0) - Number(b.amount_received || 0);
                return (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-5">
                      <div className="font-black text-slate-900">{b.project_name || '—'}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{b.contractor_name || 'Contractor'}</div>
                    </td>
                    <td className="py-4 px-5 font-mono text-indigo-600 font-black">{b.bill_number || `RA-${b.id.slice(0, 8)}`}</td>
                    <td className="py-4 px-5 text-xs font-bold text-slate-500 whitespace-nowrap">{b.bill_date ? dayjs(b.bill_date).format('DD MMM YYYY') : '—'}</td>
                    <td className="py-4 px-5 font-mono text-slate-700">{inr(b.net_payable)}</td>
                    <td className="py-4 px-5 font-mono text-emerald-600">{inr(b.amount_received || 0)}</td>
                    <td className="py-4 px-5 font-mono font-black text-rose-600">{inr(balance)}</td>
                    <td className="py-4 px-5">
                      <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusTone[b.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {b.status || 'pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                    No statements found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
