import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Check, X, ExternalLink } from 'lucide-react';
import { hrExpensesAPI, hrEmployeesAPI } from '../../api/client';
import toast from 'react-hot-toast';

const STATUS_PILL = {
  pending:  'bg-amber-900/30 text-amber-400 border border-amber-700',
  approved: 'bg-blue-900/30 text-blue-400 border border-blue-700',
  rejected: 'bg-red-900/30 text-red-400 border border-red-700',
  paid:     'bg-emerald-900/30 text-emerald-400 border border-emerald-700',
};
const EXPENSE_TYPES = ['travel','food','accommodation','fuel','tools','misc'];
const fmt = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN')}`;

export default function ExpenseClaimPage() {
  const qc = useQueryClient();
  const [modal, setModal]   = useState(false);
  const [statusF, setStatusF] = useState('pending');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hr-expenses', statusF],
    queryFn: () => hrExpensesAPI.list({ status: statusF || undefined }).then(r => r.data),
  });
  const claims = data?.data || [];

  const approveMut = useMutation({
    mutationFn: (id) => hrExpensesAPI.approve(id),
    onSuccess: () => { toast.success('Approved'); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const rejectMut = useMutation({
    mutationFn: (id) => hrExpensesAPI.reject(id),
    onSuccess: () => { toast.success('Rejected'); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const payMut = useMutation({
    mutationFn: (id) => hrExpensesAPI.pay(id, { paid_date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => { toast.success('Marked as paid'); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const totalPending  = claims.filter(c => c.status === 'pending').reduce((s,c) => s + parseFloat(c.amount||0), 0);
  const totalApproved = claims.filter(c => c.status === 'approved').reduce((s,c) => s + parseFloat(c.amount||0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg"><Receipt className="w-6 h-6 text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Expense Claims</h1>
            <p className="text-sm text-slate-400">Employee expense reimbursements</p>
          </div>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Claim
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Claims',     value: claims.length,                  color: 'text-white' },
          { label: 'Pending Amount',   value: fmt(totalPending),              color: 'text-amber-400' },
          { label: 'Approved Amount',  value: fmt(totalApproved),             color: 'text-blue-400' },
          { label: 'Paid Claims',      value: claims.filter(c => c.status === 'paid').length, color: 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-slate-700 rounded-lg p-1 w-fit">
        {['pending','approved','paid','rejected',''].map(s => (
          <button key={s} onClick={() => setStatusF(s)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${statusF === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading…</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Employee','Type','Date','Amount','Description','Project','Status','Bill','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{c.employee_name}</div>
                    <div className="text-slate-500 text-xs">{c.employee_code}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-300">{c.expense_type}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(c.claim_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 text-white font-bold">{fmt(c.amount)}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{c.description}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{c.project_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_PILL[c.status] || ''}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.bill_url ? (
                      <a href={c.bill_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {c.status === 'pending' && <>
                        <button onClick={() => approveMut.mutate(c.id)} className="p-1.5 bg-emerald-700/30 hover:bg-emerald-700/60 text-emerald-400 rounded-lg" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => rejectMut.mutate(c.id)} className="p-1.5 bg-red-700/30 hover:bg-red-700/60 text-red-400 rounded-lg" title="Reject"><X className="w-3.5 h-3.5" /></button>
                      </>}
                      {c.status === 'approved' && (
                        <button onClick={() => payMut.mutate(c.id)} className="px-2 py-1 bg-emerald-700/30 hover:bg-emerald-700/60 text-emerald-400 rounded-lg text-xs">Pay</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {claims.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-slate-500">No expense claims</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && <ClaimModal onClose={() => setModal(false)} onSuccess={() => { setModal(false); refetch(); }} />}
    </div>
  );
}

function ClaimModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ user_id:'', expense_type:'travel', claim_date: new Date().toISOString().split('T')[0], amount:'', description:'', project_id:'' });
  const [file, setFile] = useState(null);
  const { data: empData } = useQuery({ queryKey:['hr-employees-active'], queryFn: () => hrEmployeesAPI.list({ employment_status:'active' }).then(r => r.data) });
  const s = (k,v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm";

  const createMut = useMutation({
    mutationFn: (fd) => hrExpensesAPI.create(fd),
    onSuccess: () => { toast.success('Claim submitted'); onSuccess(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const handleSubmit = () => {
    if (!form.user_id || !form.amount) return toast.error('Employee and amount required');
    const fd = new FormData();
    Object.entries(form).forEach(([k,v]) => v && fd.append(k, v));
    if (file) fd.append('bill', file);
    createMut.mutate(fd);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <h2 className="font-semibold text-white mb-4">Submit Expense Claim</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 block mb-1">Employee</label>
            <select className={inp} value={form.user_id} onChange={e => s('user_id', e.target.value)}>
              <option value="">Select Employee</option>
              {(empData?.data||[]).map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 block mb-1">Expense Type</label>
              <select className={inp} value={form.expense_type} onChange={e => s('expense_type', e.target.value)}>
                {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-400 block mb-1">Date</label><input type="date" className={inp} value={form.claim_date} onChange={e => s('claim_date', e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-slate-400 block mb-1">Amount (₹)</label><input className={inp} type="number" value={form.amount} onChange={e => s('amount', e.target.value)} /></div>
          <div><label className="text-xs text-slate-400 block mb-1">Description</label><textarea className={inp} rows={2} value={form.description} onChange={e => s('description', e.target.value)} /></div>
          <div><label className="text-xs text-slate-400 block mb-1">Bill / Receipt (optional)</label>
            <input type="file" className="text-slate-400 text-sm" onChange={e => setFile(e.target.files[0])} /></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={createMut.isPending} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {createMut.isPending ? 'Submitting…' : 'Submit Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
