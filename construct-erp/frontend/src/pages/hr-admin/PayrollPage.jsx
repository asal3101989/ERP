// src/pages/hr-admin/PayrollPage.jsx  — Modern redesign
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Play, Check, DollarSign, Download, AlertCircle,
  CheckCircle, Clock, Banknote, TrendingDown, Users, X, ChevronDown,
  FileText, ArrowRight,
} from 'lucide-react';
import { hrPayrollAPI } from '../../api/client';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────
const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fade = (d = 0) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.38, delay: d, ease: [0.16, 1, 0.3, 1] } });

const AVATAR_GRADS = [
  ['#6366F1','#4F46E5'],['#0EA5E9','#0284C7'],['#10B981','#059669'],
  ['#F59E0B','#D97706'],['#EF4444','#DC2626'],['#8B5CF6','#7C3AED'],
];
const avatarGrad = (n) => AVATAR_GRADS[(n?.charCodeAt(0)||0) % AVATAR_GRADS.length];
const initials = (n) => (n||'U').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();

const STATUS_CFG = {
  draft:    { label: 'Draft',    bg: 'bg-gray-100',     text: 'text-gray-600',  dot: 'bg-gray-400',    ring: 'ring-gray-200'    },
  approved: { label: 'Approved', bg: 'bg-blue-50',      text: 'text-blue-700',  dot: 'bg-blue-500',    ring: 'ring-blue-200'    },
  paid:     { label: 'Paid',     bg: 'bg-emerald-50',   text: 'text-green-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
};

// ── Workflow stepper ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 'generate', label: 'Generate',  icon: Play         },
  { id: 'review',   label: 'Review',    icon: FileText     },
  { id: 'approve',  label: 'Approve',   icon: Check        },
  { id: 'disburse', label: 'Disburse',  icon: DollarSign   },
];

function getWorkflowStep(records) {
  if (records.length === 0) return 0;
  const allPaid     = records.every(r => r.status === 'paid');
  const allApproved = records.every(r => r.status !== 'draft');
  const hasDraft    = records.some(r => r.status === 'draft');
  if (allPaid)       return 3;
  if (allApproved)   return 2;
  if (!hasDraft)     return 2;
  return 1;
}

function WorkflowStepper({ step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done    = i < step;
        const current = i === step;
        return (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              done    ? 'text-emerald-600' :
              current ? 'text-indigo-700 bg-indigo-50' :
                        'text-gray-400'
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done    ? 'bg-emerald-100 text-emerald-600' :
                current ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' :
                          'bg-gray-100 text-gray-400'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : <s.icon className="w-3.5 h-3.5" />}
              </div>
              <span className={`text-sm font-medium ${current ? 'text-indigo-700' : ''}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${i < step ? 'text-emerald-400' : 'text-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Pay Modal ─────────────────────────────────────────────────────────────────
function PayModal({ onClose, onConfirm, isPending, month, year, count }) {
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'bank_transfer',
    payment_ref: '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Mark Payroll as Paid</p>
              <p className="text-xs text-gray-400">{MONTHS[month]} {year} — {count} employees</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">This will mark all approved payslips as paid and create payment records in Finance.</p>
          </div>

          {/* Fields */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Payment Date</label>
            <input type="date"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              value={form.payment_date}
              onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Payment Mode</label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-indigo-400"
              value={form.payment_mode}
              onChange={e => setForm(p => ({ ...p, payment_mode: e.target.value }))}
            >
              <option value="bank_transfer">Bank Transfer / NEFT</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Reference / UTR</label>
            <input
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              placeholder="Transaction reference number"
              value={form.payment_ref}
              onChange={e => setForm(p => ({ ...p, payment_ref: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(form)}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
          >
            {isPending ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const now      = new Date();
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [year,     setYear]     = useState(now.getFullYear());
  const [payModal, setPayModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hr-payroll', month, year],
    queryFn: () => hrPayrollAPI.list({ month, year }).then(r => r.data),
  });
  const records = data?.data   || [];
  const totals  = data?.totals || {};

  const runMut = useMutation({
    mutationFn: () => hrPayrollAPI.run({ month, year }),
    onSuccess: res => { toast.success(`Payroll generated for ${res.data?.data?.length || 0} employees`); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to generate payroll'),
  });

  const approveMut = useMutation({
    mutationFn: (id) => hrPayrollAPI.approve(id),
    onSuccess: () => { toast.success('Payslip approved'); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const bulkPayMut = useMutation({
    mutationFn: (d) => hrPayrollAPI.bulkPay(d),
    onSuccess: res => { toast.success(`Paid ${res.data?.count} employees`); setPayModal(false); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const hasDraft    = records.some(r => r.status === 'draft');
  const hasApproved = records.some(r => r.status === 'approved');
  const workflowStep = getWorkflowStep(records);

  const approveAll = async () => {
    const drafts = records.filter(r => r.status === 'draft');
    await Promise.all(drafts.map(r => hrPayrollAPI.approve(r.id)));
    toast.success(`${drafts.length} payslips approved`);
    refetch();
  };

  return (
    <div className="p-6 space-y-5" style={{ background: '#F8F9FA', minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div {...fade(0)} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Monthly Payroll</h1>
            <p className="text-sm text-gray-500">Generate, approve and disburse salaries</p>
          </div>
        </div>

        {/* Month / Year picker */}
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-indigo-400 shadow-sm">
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-indigo-400 shadow-sm">
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </motion.div>

      {/* ── Workflow Banner ─────────────────────────────────────────────────── */}
      <motion.div {...fade(0.06)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <WorkflowStepper step={workflowStep} />

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => runMut.mutate()}
              disabled={runMut.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all hover:shadow-md active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
            >
              <Play className="w-4 h-4" />
              {runMut.isPending ? 'Generating…' : records.length > 0 ? 'Regenerate' : 'Generate Payroll'}
            </button>

            {hasDraft && (
              <button onClick={approveAll}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-md active:scale-95"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#FFF' }}
              >
                <Check className="w-4 h-4" /> Approve All
              </button>
            )}

            {hasApproved && (
              <button onClick={() => setPayModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-md active:scale-95"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                <DollarSign className="w-4 h-4" /> Mark as Paid
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Totals KPI Row ──────────────────────────────────────────────────── */}
      {records.length > 0 && (
        <motion.div {...fade(0.10)} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Employees',       value: records.length,               icon: Users,       color: '#6366F1', bg: '#EEF2FF', isCount: true },
            { label: 'Gross Earnings',  value: fmt(totals.gross_earnings),   icon: Banknote,    color: '#0EA5E9', bg: '#E0F2FE' },
            { label: 'Total Deductions',value: fmt(totals.total_deductions), icon: TrendingDown,color: '#EF4444', bg: '#FEF2F2' },
            { label: 'Net Payable',     value: fmt(totals.net_pay),          icon: CreditCard,  color: '#10B981', bg: '#ECFDF5' },
          ].map((c, i) => (
            <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500">{c.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
                  <c.icon className="w-4 h-4" style={{ color: c.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Payroll Table ───────────────────────────────────────────────────── */}
      <motion.div {...fade(0.14)} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" />
            <p className="text-sm text-gray-400">Loading payroll…</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-700">No payroll for {MONTHS[month]} {year}</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">Click "Generate Payroll" to create draft payslips for all active employees</p>
            </div>
            <button onClick={() => runMut.mutate()} disabled={runMut.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
              <Play className="w-4 h-4" />
              {runMut.isPending ? 'Generating…' : 'Generate Payroll'}
            </button>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">Employee</div>
              <div className="col-span-1 text-center">Days</div>
              <div className="col-span-1 text-center">LOP</div>
              <div className="col-span-2 text-right">Gross</div>
              <div className="col-span-1 text-right">PF</div>
              <div className="col-span-1 text-right">ESI</div>
              <div className="col-span-1 text-right">TDS</div>
              <div className="col-span-1 text-right font-bold text-gray-600">Net Pay</div>
              <div className="col-span-1 text-center">Status</div>
            </div>

            <div className="divide-y divide-gray-50">
              {records.map(r => {
                const [g1, g2] = avatarGrad(r.employee_name);
                const st = STATUS_CFG[r.status] || STATUS_CFG.draft;
                return (
                  <motion.div
                    key={r.id}
                    whileHover={{ backgroundColor: '#FAFAFA' }}
                    className="grid grid-cols-12 px-5 py-3.5 items-center transition-colors"
                  >
                    {/* Employee */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                        {initials(r.employee_name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.employee_name}</p>
                        <p className="text-xs text-gray-400">{r.employee_code} · {r.department_name || '—'}</p>
                      </div>
                    </div>

                    <div className="col-span-1 text-center">
                      <p className="text-sm text-gray-700">{parseFloat(r.paid_days || 0).toFixed(1)}</p>
                      <p className="text-[10px] text-gray-400">of {r.working_days}</p>
                    </div>

                    <div className="col-span-1 text-center">
                      <span className={`text-xs font-medium ${parseFloat(r.lop_days || 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {parseFloat(r.lop_days || 0).toFixed(1)}
                      </span>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="text-sm font-semibold text-gray-800">{fmt(r.gross_earnings)}</p>
                    </div>

                    <div className="col-span-1 text-right text-xs text-gray-500">{fmt(r.pf_employee)}</div>
                    <div className="col-span-1 text-right text-xs text-gray-500">{fmt(r.esi_employee)}</div>
                    <div className="col-span-1 text-right text-xs text-gray-500">{fmt(r.tds)}</div>

                    <div className="col-span-1 text-right">
                      <p className="text-sm font-bold text-emerald-600">{fmt(r.net_pay)}</p>
                    </div>

                    {/* Status + Actions */}
                    <div className="col-span-1 flex items-center justify-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      {r.status === 'draft' && (
                        <button onClick={() => approveMut.mutate(r.id)} title="Approve"
                          className="w-6 h-6 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors">
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => navigate(`/hr-admin/payroll/${r.id}/payslip`)} title="View Payslip"
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors">
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer totals */}
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 grid grid-cols-12 items-center">
              <div className="col-span-3">
                <p className="text-sm font-semibold text-gray-700">{records.length} employees</p>
              </div>
              <div className="col-span-1" />
              <div className="col-span-1" />
              <div className="col-span-2 text-right">
                <p className="text-sm font-bold text-gray-800">{fmt(totals.gross_earnings)}</p>
              </div>
              <div className="col-span-1 text-right text-xs font-semibold text-gray-600">{fmt(totals.pf_employee)}</div>
              <div className="col-span-1 text-right text-xs font-semibold text-gray-600">{fmt(totals.esi_employee)}</div>
              <div className="col-span-1 text-right text-xs font-semibold text-gray-600">{fmt(totals.tds)}</div>
              <div className="col-span-1 text-right">
                <p className="text-sm font-bold text-emerald-700">{fmt(totals.net_pay)}</p>
              </div>
              <div className="col-span-1" />
            </div>
          </>
        )}
      </motion.div>

      {/* ── Pay Modal ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {payModal && (
          <PayModal
            month={month}
            year={year}
            count={records.filter(r => r.status === 'approved').length}
            onClose={() => setPayModal(false)}
            onConfirm={(form) => bulkPayMut.mutate({ month, year, ...form })}
            isPending={bulkPayMut.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
