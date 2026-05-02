import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, CreditCard, CheckCircle, Search, X, Banknote, FileCheck2 } from 'lucide-react';
import api, { projectAPI, raBillAPI } from '../../api/client';
import dayjs from 'dayjs';
import { clsx } from 'clsx';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const PAYMENT_MODES = ['RTGS', 'NEFT', 'IMPS', 'UPI', 'Cheque', 'Cash', 'DD'];
const PAYEE_TYPES  = ['Vendor', 'Contractor', 'Employee', 'Utility', 'Government', 'Other'];

const COST_HEADS = [
  { group: 'Material',        items: ['Material — Concrete & Aggregates', 'Material — Steel & Reinforcement', 'Material — Cement & Masonry', 'Material — Finishing & Tiles'] },
  { group: 'Labour',          items: ['Labour — Skilled', 'Labour — Unskilled', 'Labour — Supervisory'] },
  { group: 'Plant & Machinery', items: ['Plant & Machinery — Owned', 'Plant & Machinery — Hired'] },
  { group: 'Subcontracting',  items: ['Subcontracting — Civil', 'Subcontracting — MEP', 'Subcontracting — Structural'] },
  { group: 'Overhead',        items: ['Site Overhead', 'Head Office Overhead', 'Contingency', 'Provisional Sum'] },
];
const STATUS_BADGE = {
  pending:   'bg-amber-50 text-amber-600 border border-amber-200',
  approved:  'bg-blue-50 text-blue-600 border border-blue-200',
  paid:      'bg-emerald-50 text-emerald-600 border border-emerald-200',
  rejected:  'bg-red-50 text-red-600 border border-red-200',
};

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const EMPTY_PAY_FORM = { payment_date: '', payment_mode: 'RTGS', payment_ref: '' };

// Compute client TDS breakdown for a certified bill.
// If TDS was already included in total_deductions (tds_amount > 0), net_payable is the final amount.
// If tds_amount = 0 (old bills), client will still deduct 2% on gross_amount.
function computeTdsSplit(bill) {
  const netPayable     = parseFloat(bill.net_payable || 0);
  const grossAmount    = parseFloat(bill.gross_amount || 0);
  const billTdsAmount  = parseFloat(bill.tds_amount || 0);
  const tdsRate        = parseFloat(bill.tds_rate || 2);

  if (billTdsAmount > 0) {
    // TDS already deducted — net_payable is what client pays, which already accounts for TDS.
    // client_tds here is informational (already in the deductions).
    return { netPayable, clientTds: billTdsAmount, amountReceived: netPayable, tdsAlreadyInBill: true };
  } else {
    // TDS not deducted in the bill — client will deduct on gross amount (Sec 194C)
    const clientTds     = parseFloat((grossAmount * tdsRate / 100).toFixed(2));
    const amountReceived = parseFloat((netPayable - clientTds).toFixed(2));
    return { netPayable, clientTds, amountReceived, tdsAlreadyInBill: false };
  }
}

export default function PaymentsPage() {
  const qc = useQueryClient();

  // tabs: 'payments' | 'ra-bills'
  const [activeTab, setActiveTab] = useState('payments');

  // General payments state
  const [showModal, setShowModal]       = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]             = useState('');
  const [form, setForm]                 = useState({
    project_id: '', payee_name: '', payee_type: 'Vendor', description: '',
    amount: '', tds_rate: 0, payment_mode: 'RTGS', bank_ref: '', payment_date: '',
    cost_head: '',
  });

  // RA Bill pay modal state
  const [payBill, setPayBill]           = useState(null);
  const [payForm, setPayForm]           = useState(EMPTY_PAY_FORM);
  const [raBillSearch, setRaBillSearch] = useState('');
  const [raBillFilter, setRaBillFilter] = useState('certified'); // 'certified' | 'paid' | 'all'

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: rawPaymentsRes } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get('/payments').then(r => r.data),
  });
  const { data: projectsRes } = useQuery({
    queryKey: ['projects-simple'],
    queryFn: () => projectAPI.list().then(r => r.data),
  });
  const { data: allRaBillsRes } = useQuery({
    queryKey: ['ra-bills-finance'],
    queryFn: () => raBillAPI.list().then(r => r.data),
  });

  const rawPayments = Array.isArray(rawPaymentsRes) ? rawPaymentsRes : (Array.isArray(rawPaymentsRes?.data) ? rawPaymentsRes.data : []);
  const projects    = Array.isArray(projectsRes)    ? projectsRes    : (Array.isArray(projectsRes?.data)    ? projectsRes.data    : []);
  const allRaBills  = Array.isArray(allRaBillsRes?.data) ? allRaBillsRes.data : [];

  const certifiedBills = allRaBills.filter(b => b.status === 'certified');
  const paidBills      = allRaBills.filter(b => b.status === 'paid');

  const payments = rawPayments.map(p => ({ ...p, project_name: p.project_name ?? p.project ?? '—' }));

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (d) => api.post('/payments', d),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries(['payments']); setShowModal(false); },
    onError: () => toast.error('Failed to record payment'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/payments/${id}`),
    onSuccess: () => { toast.success('Payment record deleted'); qc.invalidateQueries(['payments']); },
    onError: () => toast.error('Failed to delete payment record'),
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, data }) => raBillAPI.pay(id, data),
    onSuccess: () => {
      toast.success('RA Bill marked as Paid');
      qc.invalidateQueries(['ra-bills-finance']);
      qc.invalidateQueries(['ra-bills']);
      setPayBill(null);
      setPayForm(EMPTY_PAY_FORM);
      setRaBillFilter('paid'); // jump to paid tab so user sees where it went
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to mark as paid'),
  });

  const tdsSplit = payBill ? computeTdsSplit(payBill) : null;

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filtered = payments.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (search && !p.payee_name?.toLowerCase().includes(search.toLowerCase()) &&
        !p.payment_number?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const raBillSource = raBillFilter === 'certified' ? certifiedBills
                     : raBillFilter === 'paid'      ? paidBills
                     : allRaBills.filter(b => ['certified','paid'].includes(b.status));

  const filteredBills = raBillSource.filter(b =>
    !raBillSearch ||
    b.bill_number?.toLowerCase().includes(raBillSearch.toLowerCase()) ||
    b.project_name?.toLowerCase().includes(raBillSearch.toLowerCase()) ||
    b.contractor_name?.toLowerCase().includes(raBillSearch.toLowerCase())
  );

  const generalPaid     = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (Number(p.net_amount) || 0), 0);
  const raPaid          = paidBills.reduce((s, b) => s + (Number(b.amount_received) || computeTdsSplit(b).amountReceived || 0), 0);
  const totalPaid       = generalPaid + raPaid;

  const generalTDS      = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (Number(p.tds_amount) || 0), 0);
  const raTDS           = paidBills.reduce((s, b) => s + (Number(b.client_tds_amount) || computeTdsSplit(b).clientTds || 0), 0);
  const totalTDS        = generalTDS + raTDS;

  const pendingApproval = payments.filter(p => p.status === 'pending').length;
  const tdsAmount       = form.amount && form.tds_rate ? (form.amount * form.tds_rate / 100).toFixed(0) : 0;
  const netAmount       = form.amount ? (form.amount - tdsAmount) : 0;

  const canSubmitPay = payForm.payment_date && payForm.payment_mode && payForm.payment_ref.trim();

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <CreditCard className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Payment Register</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Outgoing payments to vendors · Incoming receipts from clients (RA Bills)</p>
          </div>
        </div>
        {activeTab === 'payments' && (
          <DataToolbar data={filtered} fileName="Payments_Register_Export" onAdd={() => setShowModal(true)} addLabel="Record New Payment" />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Outgoing */}
        <div className="bg-white border border-red-100 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-[9px] font-black text-red-300 uppercase tracking-widest mb-2 italic">Payments Out</div>
          <div className="text-3xl font-black text-red-500 font-mono tracking-tighter italic">{fmt(generalPaid)}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Vendors / Labour / Sub-con</div>
        </div>
        <div className="bg-white border border-amber-100 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-[9px] font-black text-amber-300 uppercase tracking-widest mb-2 italic">Payments Out</div>
          <div className="text-3xl font-black text-amber-500 font-mono tracking-tighter italic">{pendingApproval}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Awaiting Approval</div>
        </div>
        {/* Incoming */}
        <div className="bg-white border border-emerald-100 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2 italic">Receipts In</div>
          <div className="text-3xl font-black text-emerald-600 font-mono tracking-tighter italic">{fmt(raPaid)}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Received from Clients</div>
        </div>
        <div className="bg-white border border-violet-100 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-2 italic">Receipts In</div>
          <div className="text-3xl font-black text-violet-600 font-mono tracking-tighter italic">{certifiedBills.length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">RA Bills Pending Receipt</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('payments')}
          className={clsx(
            'flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
            activeTab === 'payments'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
          )}
        >
          <CreditCard size={14} /> Payments Out (Vendors / Labour / Sub-con)
        </button>
        <button
          onClick={() => setActiveTab('ra-bills')}
          className={clsx(
            'flex items-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
            activeTab === 'ra-bills'
              ? 'bg-violet-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
          )}
        >
          <FileCheck2 size={14} />
          RA Bills — Client Receipts
          {certifiedBills.length > 0 && (
            <span className="ml-1 bg-white/20 text-white px-2 py-0.5 rounded-full text-[9px]">
              {certifiedBills.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB: General Payments ─────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <>
          {/* Controls */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-4 flex flex-col md:flex-row items-center gap-4 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="w-full bg-slate-50 border border-slate-200 py-3.5 pl-12 pr-5 rounded-2xl text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300 placeholder:normal-case placeholder:tracking-normal italic shadow-sm"
                placeholder="Search Payee or Ref Number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'approved', 'paid', 'rejected'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={clsx('px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all italic',
                    filterStatus === s ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300')}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Payment #', 'Payee Details', 'Project', 'Description', 'Amount', 'TDS', 'Net Paid', 'Mode', 'Date', 'Status', ''].map((h, i) => (
                      <th key={i} className={clsx("py-5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic whitespace-nowrap",
                        ['Amount', 'TDS', 'Net Paid'].includes(h) ? 'text-right' : '')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4 pl-6 font-mono font-black text-indigo-600 text-sm tracking-tight italic">{p.payment_number || p.id?.slice(0, 8).toUpperCase()}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm uppercase tracking-tight italic">{p.entity_name || p.payee_name}</span>
                          {(p.source === 'tqs' || p.tqs_bill_id) && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[8px] font-black uppercase tracking-wide flex-shrink-0">TQS</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{p.payment_type || p.payee_type}</div>
                      </td>
                      <td className="p-4 font-bold text-slate-600 uppercase text-[10px] tracking-widest">{p.project_name}</td>
                      <td className="p-4 font-bold text-slate-500 italic text-xs max-w-[200px] truncate">{p.remarks || p.description}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900 tracking-tighter italic">{fmt(p.amount)}</td>
                      <td className="p-4 text-right font-mono font-bold text-red-500">{(p.tds_deducted || p.tds_amount) > 0 ? fmt(p.tds_deducted || p.tds_amount) : '—'}</td>
                      <td className="p-4 text-right font-mono font-black text-emerald-600 text-base tracking-tighter italic">{fmt(p.net_amount || p.net_paid)}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest">{p.payment_mode}</span>
                      </td>
                      <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {p.payment_date ? dayjs(p.payment_date).format('DD MMM YYYY') : '—'}
                      </td>
                      <td className="p-4">
                        <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest italic shadow-sm", STATUS_BADGE[p.status] || 'bg-slate-100 text-slate-600')}>{p.status}</span>
                      </td>
                      <td className="p-4 text-right pr-6" onClick={e => e.stopPropagation()}>
                        <TableActions disableEdit onDelete={() => deleteMut.mutate(p.id)} />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="py-24 text-center font-black text-slate-400 uppercase tracking-[0.3em] italic">No payment records found</td></tr>
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={4} className="p-5 pl-6 text-slate-900 font-black uppercase tracking-widest text-[10px] italic">Total Aggregate ({filtered.length} records)</td>
                      <td className="p-5 text-right text-slate-900 font-mono font-black text-base italic tracking-tighter">{fmt(filtered.reduce((s, p) => s + Number(p.amount), 0))}</td>
                      <td className="p-5 text-right text-red-500 font-mono font-black text-base italic tracking-tighter">{fmt(filtered.reduce((s, p) => s + Number(p.tds_deducted || p.tds_amount || 0), 0))}</td>
                      <td className="p-5 text-right text-emerald-600 font-mono font-black text-base italic tracking-tighter">{fmt(filtered.reduce((s, p) => s + Number(p.net_amount || p.net_paid || 0), 0))}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: RA Bills ─────────────────────────────────────────────────────── */}
      {activeTab === 'ra-bills' && (
        <>
          {/* Search + filter */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-4 flex flex-col md:flex-row items-center gap-4 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="w-full bg-slate-50 border border-slate-200 py-3.5 pl-12 pr-5 rounded-2xl text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-violet-400 transition-all placeholder:text-slate-300 placeholder:normal-case placeholder:tracking-normal italic shadow-sm"
                placeholder="Search Bill #, Project or Client..."
                value={raBillSearch}
                onChange={e => setRaBillSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {[
                { key: 'certified', label: `Pending Receipt (${certifiedBills.length})` },
                { key: 'paid',      label: `Paid (${paidBills.length})` },
                { key: 'all',       label: 'All' },
              ].map(f => (
                <button key={f.key} onClick={() => setRaBillFilter(f.key)}
                  className={clsx('px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all italic whitespace-nowrap',
                    raBillFilter === f.key
                      ? f.key === 'paid' ? 'bg-teal-600 text-white shadow-md' : 'bg-violet-600 text-white shadow-md'
                      : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900')}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* RA Bills Table */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className={clsx('px-6 py-4 border-b border-slate-100 flex items-center gap-3',
              raBillFilter === 'paid' ? 'bg-teal-50' : 'bg-violet-50')}>
              <FileCheck2 size={16} className={raBillFilter === 'paid' ? 'text-teal-600' : 'text-violet-600'} />
              <span className={clsx('text-[11px] font-black uppercase tracking-widest italic',
                raBillFilter === 'paid' ? 'text-teal-700' : 'text-violet-700')}>
                {raBillFilter === 'certified' ? `Certified — Awaiting Client Payment (${filteredBills.length})` :
                 raBillFilter === 'paid'      ? `Received from Client (${filteredBills.length})` :
                                               `All RA Bills — Receipt Register (${filteredBills.length})`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Bill #', 'Project / Client', 'Bill Date', 'Net Payable', 'Client TDS',
                      raBillFilter === 'paid' ? 'Received' : 'Status',
                      raBillFilter === 'paid' ? 'Payment Ref' : 'Certified By', ''].map((h, i) => (
                      <th key={i} className={clsx("py-5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic whitespace-nowrap",
                        ['Net Payable','Client TDS','Received'].includes(h) ? 'text-right' : '')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBills.map(b => {
                    const split = computeTdsSplit(b);
                    const isPaid = b.status === 'paid';
                    return (
                      <tr key={b.id} className={clsx('transition-colors group',
                        isPaid ? 'hover:bg-teal-50/30' : 'hover:bg-violet-50/30')}>
                        <td className="p-4 pl-6">
                          <div className={clsx('font-mono font-black text-sm tracking-tight italic',
                            isPaid ? 'text-teal-700' : 'text-violet-700')}>{b.bill_number}</div>
                          {(raBillFilter === 'all') && (
                            <span className={clsx('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block',
                              isPaid ? 'bg-teal-50 text-teal-600 border border-teal-200' : 'bg-violet-50 text-violet-600 border border-violet-200')}>
                              {isPaid ? 'Paid' : 'Pending'}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-black text-slate-900 text-sm uppercase tracking-tight italic">{b.project_name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{b.contractor_name}</div>
                        </td>
                        <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {b.bill_date ? dayjs(b.bill_date).format('DD MMM YYYY') : '—'}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900 tracking-tighter italic">{fmt(b.net_payable)}</td>
                        <td className="p-4 text-right font-mono font-bold text-red-500 text-xs">{fmt(split.clientTds)}</td>
                        {isPaid ? (
                          <>
                            <td className="p-4 text-right font-mono font-black text-emerald-600 text-base tracking-tighter italic">
                              {fmt(b.amount_received || split.amountReceived)}
                            </td>
                            <td className="p-4">
                              <div className="font-mono text-xs font-bold text-slate-700 uppercase">{b.payment_ref || '—'}</div>
                              <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                {b.payment_mode} · {b.payment_date ? dayjs(b.payment_date).format('DD MMM YYYY') : '—'}
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-4">
                              <span className="bg-violet-50 border border-violet-200 text-violet-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Certified</span>
                            </td>
                            <td className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{b.certified_by_name || '—'}</td>
                          </>
                        )}
                        <td className="p-4 pr-6">
                          {!isPaid && (
                            <button
                              onClick={() => { setPayBill(b); setPayForm(EMPTY_PAY_FORM); }}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-emerald-600/30 whitespace-nowrap"
                            >
                              <Banknote size={12} /> Mark Received
                            </button>
                          )}
                          {isPaid && (
                            <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest italic flex items-center gap-1">
                              ✓ Paid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredBills.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-24 text-center font-black text-slate-400 uppercase tracking-[0.3em] italic">
                        {raBillFilter === 'paid' ? 'No paid RA bills yet' : 'No certified RA bills pending payment'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredBills.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={3} className="p-5 pl-6 text-slate-900 font-black uppercase tracking-widest text-[10px] italic">
                        Total ({filteredBills.length} bills)
                      </td>
                      <td className="p-5 text-right text-slate-900 font-mono font-black text-base italic tracking-tighter">
                        {fmt(filteredBills.reduce((s, b) => s + Number(b.net_payable || 0), 0))}
                      </td>
                      <td className="p-5 text-right text-red-500 font-mono font-black text-base italic tracking-tighter">
                        {fmt(filteredBills.reduce((s, b) => s + Number(computeTdsSplit(b).clientTds || 0), 0))}
                      </td>
                      <td className="p-5 text-right text-emerald-600 font-mono font-black text-base italic tracking-tighter">
                        {fmt(filteredBills.reduce((s, b) => s + Number(b.amount_received || computeTdsSplit(b).amountReceived || 0), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Record General Payment ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-[3.5rem] w-full max-w-2xl overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm"><CreditCard size={20} /></div>
                Record New Payment
              </h2>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Project *</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Select project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payee Name *</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase outline-none focus:border-indigo-400 shadow-sm transition-all italic" placeholder="M/S Contractors Ltd" value={form.payee_name} onChange={e => setForm(f => ({ ...f, payee_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payee Type *</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic" value={form.payee_type} onChange={e => setForm(f => ({ ...f, payee_type: e.target.value }))}>
                    {PAYEE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Description / Invoice # *</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="E.g. Advance payment for Bill #22" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                    Cost Head <span className="text-indigo-400">(links to Budget vs Actual)</span>
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic"
                    value={form.cost_head}
                    onChange={e => setForm(f => ({ ...f, cost_head: e.target.value }))}
                  >
                    <option value="">— Select cost head (optional) —</option>
                    {COST_HEADS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map(item => <option key={item} value={item}>{item}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {form.cost_head && (
                    <p className="text-[10px] text-indigo-500 font-bold italic">
                      ✓ This payment will auto-update the "{form.cost_head}" actual in Budget vs Actual
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Gross Amount (₹) *</label>
                  <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">TDS Rate (%)</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic" value={form.tds_rate} onChange={e => setForm(f => ({ ...f, tds_rate: Number(e.target.value) }))}>
                    <option value={0}>0% (None)</option>
                    <option value={1}>1% (194C – Corp)</option>
                    <option value={2}>2% (194C – Indv)</option>
                    <option value={10}>10% (194J – Prof)</option>
                  </select>
                </div>
                {form.amount > 0 && (
                  <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm grid grid-cols-3 shadow-inner">
                    <div className="text-center"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Gross Pay</div><div className="text-slate-900 font-black font-mono tracking-tighter text-lg">{fmt(form.amount)}</div></div>
                    <div className="text-center"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">TDS Hold</div><div className="text-red-500 font-black font-mono tracking-tighter text-lg">{fmt(tdsAmount)}</div></div>
                    <div className="text-center"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Net Released</div><div className="text-emerald-600 font-black font-mono tracking-tighter text-lg">{fmt(netAmount)}</div></div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Mode *</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic" value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Date *</label>
                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all uppercase" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Bank Ref / UTR *</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-indigo-400 shadow-sm transition-all tracking-tight" placeholder="N03022... or Cheque Number" value={form.bank_ref} onChange={e => setForm(f => ({ ...f, bank_ref: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-sm italic" onClick={() => setShowModal(false)}>Discard</button>
                <button
                  className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30 italic"
                  onClick={() => createMut.mutate({ ...form, tds_deducted: tdsAmount, net_amount: netAmount, entity_name: form.payee_name, payment_type: form.payee_type, reference_number: form.bank_ref })}
                  disabled={createMut.isPending || !form.project_id || !form.payee_name || !form.amount}
                >
                  {createMut.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Mark RA Bill as Paid ───────────────────────────────────────── */}
      {payBill && tdsSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-emerald-50">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                  <Banknote size={20} />
                </div>
                Record Receipt
              </h2>
              <button onClick={() => setPayBill(null)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {/* Bill info */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Bill</span>
                  <span className="font-mono font-black text-violet-700 text-sm">{payBill.bill_number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Project</span>
                  <span className="text-xs font-black text-slate-700 uppercase italic">{payBill.project_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Client</span>
                  <span className="text-xs font-bold text-slate-600">{payBill.contractor_name}</span>
                </div>
              </div>

              {/* TDS breakdown */}
              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <div className="bg-slate-50 px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                  Payment Breakdown
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs font-bold text-slate-600">Certified Net Payable</span>
                    <span className="font-mono font-black text-slate-900">{fmt(tdsSplit.netPayable)}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                      Less: Client TDS @ {payBill.tds_rate || 2}%
                      <span className="text-[9px] bg-red-50 border border-red-200 text-red-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                        {tdsSplit.tdsAlreadyInBill ? 'in bill' : 'u/s 194C'}
                      </span>
                    </span>
                    <span className="font-mono font-black text-red-500">− {fmt(tdsSplit.clientTds)}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-4 bg-emerald-50">
                    <span className="text-sm font-black text-emerald-700 uppercase tracking-wide italic">Amount to be Received</span>
                    <span className="font-mono font-black text-emerald-600 text-xl tracking-tighter">{fmt(tdsSplit.amountReceived)}</span>
                  </div>
                </div>
              </div>

              {tdsSplit.tdsAlreadyInBill && (
                <p className="text-[10px] text-slate-400 font-bold italic">
                  * TDS was already included in the bill deductions — net payable is the final amount client will pay.
                </p>
              )}

              {/* Payment details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Date *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 outline-none focus:border-emerald-400 shadow-sm transition-all"
                    value={payForm.payment_date}
                    onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Mode *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-emerald-400 shadow-sm transition-all appearance-none italic"
                    value={payForm.payment_mode}
                    onChange={e => setPayForm(f => ({ ...f, payment_mode: e.target.value }))}
                  >
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">UTR / Reference Number *</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-emerald-400 shadow-sm transition-all tracking-tight"
                    placeholder="N03022... or Cheque No."
                    value={payForm.payment_ref}
                    onChange={e => setPayForm(f => ({ ...f, payment_ref: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all italic"
                  onClick={() => setPayBill(null)}
                >
                  Cancel
                </button>
                <button
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-600/30 italic flex items-center justify-center gap-2"
                  disabled={!canSubmitPay || markPaidMut.isPending}
                  onClick={() => markPaidMut.mutate({
                    id: payBill.id,
                    data: {
                      ...payForm,
                      client_tds_amount: tdsSplit.clientTds,
                      amount_received: tdsSplit.amountReceived,
                    }
                  })}
                >
                  <Banknote size={14} />
                  {markPaidMut.isPending ? 'Processing...' : `Confirm Receipt — ${fmt(tdsSplit.amountReceived)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
