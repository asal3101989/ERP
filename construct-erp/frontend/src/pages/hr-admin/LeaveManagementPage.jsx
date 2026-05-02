// src/pages/hr-admin/LeaveManagementPage.jsx  — Modern redesign
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Check, X, Plus, Users, ChevronLeft, ChevronRight,
  Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Edit2, Trash2,
} from 'lucide-react';
import { hrLeaveAPI, hrMastersAPI, hrEmployeesAPI } from '../../api/client';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────
const fade = (d = 0) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: d, ease: [0.16, 1, 0.3, 1] } });
const AVATAR_GRADS = [['#6366F1','#4F46E5'],['#0EA5E9','#0284C7'],['#10B981','#059669'],['#F59E0B','#D97706'],['#EF4444','#DC2626'],['#8B5CF6','#7C3AED']];
const avatarGrad = (n) => AVATAR_GRADS[(n?.charCodeAt(0)||0) % AVATAR_GRADS.length];
const initials = (n) => (n||'U').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();

const STATUS_CFG = {
  pending:   { label: 'Pending',   bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  icon: Clock       },
  approved:  { label: 'Approved',  bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  icon: CheckCircle },
  rejected:  { label: 'Rejected',  bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    icon: XCircle     },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   icon: X           },
};

const inp = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all";
const label = "text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5";

// ── Apply Leave Modal ─────────────────────────────────────────────────────────
function ApplyLeaveModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ user_id: '', leave_type_id: '', from_date: '', to_date: '', half_day: false, reason: '' });
  const { data: empData } = useQuery({ queryKey: ['hr-employees-all'], queryFn: () => hrEmployeesAPI.list({ employment_status: 'active' }).then(r => r.data) });
  const { data: ltData }  = useQuery({ queryKey: ['hr-leave-types'],   queryFn: () => hrMastersAPI.listLeaveTypes().then(r => r.data) });

  const submitMut = useMutation({
    mutationFn: (data) => hrLeaveAPI.submitRequest(data),
    onSuccess: () => { toast.success('Leave applied successfully'); onSuccess(); },
    onError: e => toast.error(e.response?.data?.error || 'Error submitting leave'),
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.22 }} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <p className="font-semibold text-gray-900">Apply Leave</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={label}>Employee</label>
            <select className={inp} value={form.user_id} onChange={e => set('user_id', e.target.value)}>
              <option value="">Select Employee</option>
              {(empData?.data || []).map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Leave Type</label>
            <select className={inp} value={form.leave_type_id} onChange={e => set('leave_type_id', e.target.value)}>
              <option value="">Select Type</option>
              {(ltData?.data || []).map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>From Date</label><input type="date" className={inp} value={form.from_date} onChange={e => set('from_date', e.target.value)} /></div>
            <div><label className={label}>To Date</label><input type="date" className={inp} value={form.to_date} onChange={e => set('to_date', e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${form.half_day ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}`}
              onClick={() => set('half_day', !form.half_day)}>
              {form.half_day && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm text-gray-700 select-none">Half Day</span>
          </label>
          <div>
            <label className={label}>Reason</label>
            <textarea className={inp + ' resize-none'} rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Optional reason…" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={() => submitMut.mutate(form)} disabled={submitMut.isPending || !form.user_id || !form.leave_type_id || !form.from_date}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
            {submitMut.isPending ? 'Applying…' : 'Apply Leave'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Requests Tab ──────────────────────────────────────────────────────────────
function RequestsTab() {
  const qc = useQueryClient();
  const [statusF, setStatusF] = useState('pending');
  const [applyModal, setApplyModal] = useState(false);

  const { data: reqData, isLoading } = useQuery({
    queryKey: ['hr-leave-requests', statusF],
    queryFn: () => hrLeaveAPI.listRequests({ status: statusF || undefined }).then(r => r.data),
  });
  const requests = reqData?.data || [];

  const approveMut = useMutation({
    mutationFn: (id) => hrLeaveAPI.approve(id),
    onSuccess: () => { toast.success('Leave approved'); qc.invalidateQueries({ queryKey: ['hr-leave-requests'] }); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => hrLeaveAPI.reject(id, { rejection_reason: reason }),
    onSuccess: () => { toast.success('Leave rejected'); qc.invalidateQueries({ queryKey: ['hr-leave-requests'] }); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const handleReject = (r) => {
    const reason = window.prompt('Rejection reason (optional):');
    if (reason !== null) rejectMut.mutate({ id: r.id, reason });
  };

  const counts = { pending: 0, approved: 0, rejected: 0, '': requests.length };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { value: 'pending',  label: 'Pending',  color: 'text-amber-600'  },
            { value: 'approved', label: 'Approved', color: 'text-green-600'  },
            { value: 'rejected', label: 'Rejected', color: 'text-red-600'    },
            { value: '',         label: 'All',      color: 'text-gray-600'   },
          ].map(s => (
            <button key={s.value} onClick={() => setStatusF(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusF === s.value ? 'bg-white shadow-sm text-indigo-700' : `text-gray-500 hover:text-gray-700`
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={() => setApplyModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:shadow-md transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-gray-400">Loading requests…</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-gray-300" />
          </div>
          <p className="font-medium text-gray-600">No {statusF || ''} requests</p>
          <p className="text-sm text-gray-400 mt-1">Everything is up to date</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r, i) => {
            const [g1, g2] = avatarGrad(r.employee_name);
            const st = STATUS_CFG[r.status] || STATUS_CFG.pending;
            const StIcon = st.icon;
            const days = r.days || r.total_days || '?';
            return (
              <motion.div key={r.id} {...fade(i * 0.03)}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                    {initials(r.employee_name)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-gray-900">{r.employee_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{r.employee_code}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${st.bg} ${st.text}`}>
                        <StIcon className="w-3 h-3" />
                        {st.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                        </div>
                        <span className="text-gray-600 font-medium">{r.leave_type_name || 'Leave'}</span>
                        <span className="text-gray-400">·</span>
                        <span className="font-bold text-gray-800">{days} day{days !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(r.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {r.from_date !== r.to_date && (
                          <> → {new Date(r.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                        )}
                      </div>
                    </div>

                    {r.reason && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded-lg">"{r.reason}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  {r.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0 self-center">
                      <button onClick={() => approveMut.mutate(r.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleReject(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {applyModal && (
          <ApplyLeaveModal onClose={() => setApplyModal(false)} onSuccess={() => { setApplyModal(false); qc.invalidateQueries({ queryKey: ['hr-leave-requests'] }); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Balances Tab ──────────────────────────────────────────────────────────────
function BalancesTab() {
  const [userId, setUserId] = useState('');
  const year = new Date().getFullYear();
  const { data: empData } = useQuery({ queryKey: ['hr-employees-all'], queryFn: () => hrEmployeesAPI.list({ employment_status: 'active' }).then(r => r.data) });
  const { data: balData, isLoading } = useQuery({
    queryKey: ['hr-leave-balances-admin', userId, year],
    queryFn: () => hrLeaveAPI.getBalances({ user_id: userId || undefined, year }).then(r => r.data),
    enabled: Boolean(userId),
  });
  const balances = balData?.data || [];

  const selectedEmp = (empData?.data || []).find(e => e.id == userId);

  return (
    <div className="space-y-4">
      {/* Employee picker */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className={label}>Select Employee</label>
            <select className={inp} value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">— Choose an employee —</option>
              {(empData?.data || []).map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
            </select>
          </div>
          {selectedEmp && (
            <div className="flex items-center gap-3 mt-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ background: `linear-gradient(135deg, ${avatarGrad(selectedEmp.name)[0]}, ${avatarGrad(selectedEmp.name)[1]})` }}>
                {initials(selectedEmp.name)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{selectedEmp.name}</p>
                <p className="text-xs text-gray-400">{selectedEmp.designation_name || selectedEmp.department_name || '—'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Balance cards */}
      {!userId && (
        <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center shadow-sm">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Select an employee to view leave balances</p>
        </div>
      )}

      {userId && isLoading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
      )}

      {userId && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {balances.map((b, i) => {
            const taken  = parseFloat(b.taken || 0);
            const total  = parseFloat(b.days_per_year || b.accrued || 1);
            const avail  = parseFloat(b.closing_balance || 0);
            const pct    = Math.min(100, (avail / total) * 100);
            const [g1, g2] = AVATAR_GRADS[i % AVATAR_GRADS.length];
            return (
              <motion.div key={b.id} {...fade(i * 0.04)}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{b.leave_type_name}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: `${g1}18`, color: g1 }}>{b.leave_code || b.code}</span>
                  </div>
                  <div className="text-3xl font-bold" style={{ color: g1 }}>{avail.toFixed(1)}</div>
                </div>

                {/* Progress ring placeholder → bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Available</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${g1}, ${g2})` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Accrued', value: parseFloat(b.accrued || 0).toFixed(1) },
                    { label: 'Taken',   value: taken.toFixed(1) },
                    { label: 'Carry Fwd', value: parseFloat(b.carry_forwarded || 0).toFixed(1) },
                    { label: 'Balance', value: avail.toFixed(1) },
                  ].map(x => (
                    <div key={x.label} className="bg-gray-50 rounded-lg px-2 py-1.5">
                      <p className="text-gray-400">{x.label}</p>
                      <p className="font-bold text-gray-700 mt-0.5">{x.value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {balances.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-gray-100 py-10 text-center shadow-sm text-sm text-gray-400">
              No leave balances found for {year}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Leave Types Tab ───────────────────────────────────────────────────────────
function LeaveTypesTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const { data } = useQuery({ queryKey: ['hr-leave-types'], queryFn: () => hrMastersAPI.listLeaveTypes().then(r => r.data) });
  const types = data?.data || [];

  const saveMut = useMutation({
    mutationFn: (d) => modal?.id ? hrMastersAPI.updateLeaveType(modal.id, d) : hrMastersAPI.createLeaveType(d),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['hr-leave-types'] }); setModal(null); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const delMut = useMutation({
    mutationFn: (id) => hrMastersAPI.deleteLeaveType(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['hr-leave-types'] }); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:shadow-md transition-all"
          style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
          <Plus className="w-4 h-4" /> Add Leave Type
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {types.map((t, i) => {
          const [g1, g2] = AVATAR_GRADS[i % AVATAR_GRADS.length];
          return (
            <motion.div key={t.id} {...fade(i * 0.04)}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                  {t.code}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(t)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => window.confirm(`Delete "${t.name}"?`) && delMut.mutate(t.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-gray-900">{t.name}</p>
              <p className="text-2xl font-bold mt-2" style={{ color: g1 }}>{t.days_per_year}</p>
              <p className="text-xs text-gray-400">days per year</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.is_paid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {t.is_paid ? 'Paid' : 'Unpaid'}
                </span>
                {t.carry_forward && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    CF: {t.max_carry_forward}d
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Leave Type Modal */}
      <AnimatePresence>
        {modal !== null && (
          <LeaveTypeModal lt={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={(d) => saveMut.mutate(d)} isPending={saveMut.isPending} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LeaveTypeModal({ lt, onClose, onSave, isPending }) {
  const [f, setF] = useState({
    name: lt?.name || '', code: lt?.code || '',
    days_per_year: lt?.days_per_year || 0,
    carry_forward: lt?.carry_forward || false,
    max_carry_forward: lt?.max_carry_forward || 0,
    is_paid: lt?.is_paid ?? true,
  });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <p className="font-semibold text-gray-900">{lt ? 'Edit' : 'Add'} Leave Type</p>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={label}>Name</label>
            <input className={inp} value={f.name} onChange={e => s('name', e.target.value)} placeholder="e.g. Earned Leave" />
          </div>
          <div>
            <label className={label}>Code</label>
            <input className={inp} value={f.code} onChange={e => s('code', e.target.value.toUpperCase())} placeholder="e.g. EL" maxLength={5} />
          </div>
          <div>
            <label className={label}>Days Per Year</label>
            <input className={inp} type="number" value={f.days_per_year} onChange={e => s('days_per_year', e.target.value)} />
          </div>
          <div className="flex gap-6">
            {[['carry_forward','Carry Forward'],['is_paid','Paid Leave']].map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${f[k] ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}
                  onClick={() => s(k, !f[k])}>
                  {f[k] && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-700 select-none">{lbl}</span>
              </label>
            ))}
          </div>
          {f.carry_forward && (
            <div>
              <label className={label}>Max Carry Forward Days</label>
              <input className={inp} type="number" value={f.max_carry_forward} onChange={e => s('max_carry_forward', e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={() => f.name && f.code && onSave(f)} disabled={isPending || !f.name || !f.code}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeaveManagementPage() {
  const [activeTab, setActiveTab] = useState('Requests');
  const TABS = [
    { key: 'Requests',    label: 'Requests',    icon: Calendar },
    { key: 'Balances',    label: 'Balances',    icon: RefreshCw },
    { key: 'Leave Types', label: 'Leave Types', icon: Users },
  ];

  return (
    <div className="p-6 space-y-5" style={{ background: '#F8F9FA', minHeight: '100vh' }}>
      {/* Header */}
      <motion.div {...fade(0)} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-sm text-gray-500">Requests, balances &amp; leave type configuration</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div {...fade(0.05)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
          {activeTab === 'Requests'    && <RequestsTab />}
          {activeTab === 'Balances'    && <BalancesTab />}
          {activeTab === 'Leave Types' && <LeaveTypesTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
