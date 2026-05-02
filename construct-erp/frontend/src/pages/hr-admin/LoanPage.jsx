import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Plus, Check, X } from 'lucide-react';
import { hrLoansAPI, hrEmployeesAPI } from '../../api/client';
import toast from 'react-hot-toast';

const STATUS_PILL = {
  pending:  'bg-amber-900/30 text-amber-400 border border-amber-700',
  approved: 'bg-blue-900/30 text-blue-400 border border-blue-700',
  rejected: 'bg-red-900/30 text-red-400 border border-red-700',
  closed:   'bg-emerald-900/30 text-emerald-400 border border-emerald-700',
};
const fmt = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN')}`;

export default function LoanPage() {
  const qc = useQueryClient();
  const [modal, setModal]   = useState(false);
  const [typeF, setTypeF]   = useState('');
  const [statusF, setStatusF] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['hr-loans', typeF, statusF],
    queryFn: () => hrLoansAPI.list({ loan_type: typeF || undefined, status: statusF || undefined }).then(r => r.data),
  });
  const loans = data?.data || [];

  const approveMut = useMutation({
    mutationFn: ({ id, data }) => hrLoansAPI.approve(id, data),
    onSuccess: () => { toast.success('Approved'); qc.invalidateQueries({ queryKey: ['hr-loans'] }); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const rejectMut = useMutation({
    mutationFn: (id) => hrLoansAPI.reject(id),
    onSuccess: () => { toast.success('Rejected'); qc.invalidateQueries({ queryKey: ['hr-loans'] }); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const totalPending  = loans.filter(l => l.status === 'pending').reduce((s,l) => s + parseFloat(l.amount||0), 0);
  const totalApproved = loans.filter(l => l.status === 'approved').reduce((s,l) => s + parseFloat(l.balance_amount||0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-600/20 rounded-lg"><Banknote className="w-6 h-6 text-amber-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Loans & Advances</h1>
            <p className="text-sm text-slate-400">Employee loans, salary advances and EMI tracking</p>
          </div>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Request
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests',    value: loans.length,                                   color: 'text-white' },
          { label: 'Pending Approval',  value: loans.filter(l => l.status === 'pending').length, color: 'text-amber-400' },
          { label: 'Total Pending Amt', value: fmt(totalPending),                              color: 'text-red-400' },
          { label: 'Outstanding Balance',value: fmt(totalApproved),                            color: 'text-blue-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
          {['','advance','loan'].map(t => (
            <button key={t} onClick={() => setTypeF(t)}
              className={`px-3 py-1 rounded text-sm ${typeF === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
          {['','pending','approved','closed'].map(s => (
            <button key={s} onClick={() => setStatusF(s)}
              className={`px-3 py-1 rounded text-sm ${statusF === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Employee','Type','Amount','Reason','EMI','Repaid','Balance','Status','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loans.map(l => (
                <tr key={l.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{l.employee_name}</div>
                    <div className="text-slate-500 text-xs">{l.employee_code}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-300">{l.loan_type}</td>
                  <td className="px-4 py-3 text-white font-bold">{fmt(l.amount)}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{l.reason || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{l.emi_amount ? `${fmt(l.emi_amount)}/mo` : '—'}</td>
                  <td className="px-4 py-3 text-emerald-400">{fmt(l.repaid_amount)}</td>
                  <td className="px-4 py-3 text-amber-400 font-medium">{fmt(l.balance_amount || l.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_PILL[l.status] || ''}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {l.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => approveMut.mutate({ id: l.id, data: {} })} title="Approve"
                          className="p-1.5 bg-emerald-700/30 hover:bg-emerald-700/60 text-emerald-400 rounded-lg">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => rejectMut.mutate(l.id)} title="Reject"
                          className="p-1.5 bg-red-700/30 hover:bg-red-700/60 text-red-400 rounded-lg">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">No loans or advances</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal && <LoanModal onClose={() => setModal(false)} onSuccess={() => { setModal(false); qc.invalidateQueries({ queryKey: ['hr-loans'] }); }} />}
    </div>
  );
}

function LoanModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ user_id:'', loan_type:'advance', amount:'', reason:'', emi_amount:'', emi_months:'' });
  const { data: empData } = useQuery({ queryKey: ['hr-employees-active'], queryFn: () => hrEmployeesAPI.list({ employment_status:'active' }).then(r => r.data) });
  const s = (k,v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm";

  const createMut = useMutation({
    mutationFn: (d) => hrLoansAPI.create(d),
    onSuccess: () => { toast.success('Loan request submitted'); onSuccess(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <h2 className="font-semibold text-white mb-4">New Loan / Advance Request</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 block mb-1">Employee</label>
            <select className={inp} value={form.user_id} onChange={e => s('user_id', e.target.value)}>
              <option value="">Select Employee</option>
              {(empData?.data||[]).map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
            </select>
          </div>
          <div><label className="text-xs text-slate-400 block mb-1">Type</label>
            <select className={inp} value={form.loan_type} onChange={e => s('loan_type', e.target.value)}>
              <option value="advance">Salary Advance</option>
              <option value="loan">Loan</option>
            </select>
          </div>
          <div><label className="text-xs text-slate-400 block mb-1">Amount (₹)</label><input className={inp} type="number" value={form.amount} onChange={e => s('amount', e.target.value)} /></div>
          <div><label className="text-xs text-slate-400 block mb-1">Reason</label><textarea className={inp} rows={2} value={form.reason} onChange={e => s('reason', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 block mb-1">EMI Amount (₹)</label><input className={inp} type="number" value={form.emi_amount} onChange={e => s('emi_amount', e.target.value)} /></div>
            <div><label className="text-xs text-slate-400 block mb-1">EMI Months</label><input className={inp} type="number" value={form.emi_months} onChange={e => s('emi_months', e.target.value)} /></div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
          <button onClick={() => form.user_id && form.amount && createMut.mutate(form)} disabled={createMut.isPending}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {createMut.isPending ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
