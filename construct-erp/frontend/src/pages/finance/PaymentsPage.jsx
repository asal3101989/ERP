import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Banknote, CreditCard, FileCheck2, Plus, X } from 'lucide-react';
import api, { projectAPI, raBillAPI } from '../../api/client';
import dayjs from 'dayjs';
import { clsx } from 'clsx';
import FinanceActionBar from '../../components/finance/FinanceActionBar';
import TableActions from '../../components/common/TableActions';

const PAYMENT_MODES = ['RTGS', 'NEFT', 'IMPS', 'UPI', 'Cheque', 'Cash', 'DD'];
const PAYEE_TYPES = ['Vendor', 'Contractor', 'Employee', 'Utility', 'Government', 'Other'];

const COST_HEADS = [
  { group: 'Material', items: ['Material - Concrete & Aggregates', 'Material - Steel & Reinforcement', 'Material - Cement & Masonry', 'Material - Finishing & Tiles'] },
  { group: 'Labour', items: ['Labour - Skilled', 'Labour - Unskilled', 'Labour - Supervisory'] },
  { group: 'Plant & Machinery', items: ['Plant & Machinery - Owned', 'Plant & Machinery - Hired'] },
  { group: 'Subcontracting', items: ['Subcontracting - Civil', 'Subcontracting - MEP', 'Subcontracting - Structural'] },
  { group: 'Overhead', items: ['Site Overhead', 'Head Office Overhead', 'Contingency', 'Provisional Sum'] },
];

const EMPTY_PAY_FORM = { payment_date: '', payment_mode: 'RTGS', payment_ref: '' };

const fmt = (value) => `Rs${Number(value || 0).toLocaleString('en-IN')}`;

function computeTdsSplit(bill) {
  const netPayable = parseFloat(bill.net_payable || 0);
  const grossAmount = parseFloat(bill.gross_amount || 0);
  const billTdsAmount = parseFloat(bill.tds_amount || 0);
  const tdsRate = parseFloat(bill.tds_rate || 2);

  if (billTdsAmount > 0) {
    return { netPayable, clientTds: billTdsAmount, amountReceived: netPayable, tdsAlreadyInBill: true };
  }

  const clientTds = parseFloat((grossAmount * tdsRate / 100).toFixed(2));
  const amountReceived = parseFloat((netPayable - clientTds).toFixed(2));
  return { netPayable, clientTds, amountReceived, tdsAlreadyInBill: false };
}

function KpiCard({ label, value, sub, accent = 'text-indigo-600' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{label}</div>
      <div className={clsx('mt-3 text-3xl font-black font-mono tracking-tighter', accent)}>{value}</div>
      <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{sub}</div>
    </div>
  );
}

export default function PaymentsPage() {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('payments');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentProject, setPaymentProject] = useState('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  const [paymentSourceFilter, setPaymentSourceFilter] = useState('all');
  const [paymentStartDate, setPaymentStartDate] = useState('');
  const [paymentEndDate, setPaymentEndDate] = useState('');
  const [form, setForm] = useState({
    project_id: '',
    payee_name: '',
    payee_type: 'Vendor',
    description: '',
    amount: '',
    tds_rate: 0,
    payment_mode: 'RTGS',
    bank_ref: '',
    payment_date: '',
    cost_head: '',
  });

  const [payBill, setPayBill] = useState(null);
  const [payForm, setPayForm] = useState(EMPTY_PAY_FORM);
  const [raBillSearch, setRaBillSearch] = useState('');
  const [raBillFilter, setRaBillFilter] = useState('certified');
  const [raBillProject, setRaBillProject] = useState('all');
  const [raBillStartDate, setRaBillStartDate] = useState('');
  const [raBillEndDate, setRaBillEndDate] = useState('');

  const { data: rawPaymentsRes } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get('/payments').then((r) => r.data),
  });
  const { data: projectsRes } = useQuery({
    queryKey: ['projects-simple'],
    queryFn: () => projectAPI.list().then((r) => r.data),
  });
  const { data: allRaBillsRes } = useQuery({
    queryKey: ['ra-bills-finance'],
    queryFn: () => raBillAPI.list().then((r) => r.data),
  });

  const rawPayments = Array.isArray(rawPaymentsRes) ? rawPaymentsRes : (Array.isArray(rawPaymentsRes?.data) ? rawPaymentsRes.data : []);
  const projects = Array.isArray(projectsRes) ? projectsRes : (Array.isArray(projectsRes?.data) ? projectsRes.data : []);
  const allRaBills = Array.isArray(allRaBillsRes?.data) ? allRaBillsRes.data : [];

  const payments = useMemo(() => rawPayments.map((payment) => {
    const amount = Number(payment.amount || 0);
    const tdsAmount = Number(payment.tds_deducted ?? payment.tds_amount ?? 0);
    const netAmount = Number(payment.net_amount ?? payment.net_paid ?? (amount - tdsAmount));
    return {
      ...payment,
      project_name: payment.project_name ?? payment.project ?? '-',
      display_name: payment.entity_name || payment.payee_name || '-',
      description_text: payment.remarks || payment.description || '-',
      gross_amount: amount,
      tds_amount_value: tdsAmount,
      net_amount_value: netAmount,
      payment_type_value: String(payment.payment_type || payment.payee_type || 'other').toLowerCase(),
      source_value: payment.source || (payment.tqs_bill_id ? 'tqs' : 'manual'),
      reference_text: payment.reference_number || payment.payment_ref || payment.bank_ref || '-',
    };
  }), [rawPayments]);

  const certifiedBills = allRaBills.filter((bill) => bill.status === 'certified');
  const paidBills = allRaBills.filter((bill) => bill.status === 'paid');

  const createMut = useMutation({
    mutationFn: (payload) => api.post('/payments', payload),
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries(['payments']);
      setShowModal(false);
      setForm({
        project_id: '',
        payee_name: '',
        payee_type: 'Vendor',
        description: '',
        amount: '',
        tds_rate: 0,
        payment_mode: 'RTGS',
        bank_ref: '',
        payment_date: '',
        cost_head: '',
      });
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      toast.success('Payment deleted');
      qc.invalidateQueries(['payments']);
    },
    onError: () => toast.error('Failed to delete payment'),
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, data }) => raBillAPI.pay(id, data),
    onSuccess: () => {
      toast.success('RA bill marked as received');
      qc.invalidateQueries(['ra-bills-finance']);
      qc.invalidateQueries(['ra-bills']);
      setPayBill(null);
      setPayForm(EMPTY_PAY_FORM);
      setRaBillFilter('paid');
    },
    onError: (error) => toast.error(error?.response?.data?.error || 'Failed to mark as received'),
  });

  const filteredPayments = payments.filter((payment) => {
    if (paymentProject !== 'all' && payment.project_id !== paymentProject) return false;
    if (paymentTypeFilter !== 'all' && payment.payment_type_value !== paymentTypeFilter) return false;
    if (paymentSourceFilter !== 'all' && payment.source_value !== paymentSourceFilter) return false;
    if (paymentStartDate && (!payment.payment_date || dayjs(payment.payment_date).isBefore(dayjs(paymentStartDate), 'day'))) return false;
    if (paymentEndDate && (!payment.payment_date || dayjs(payment.payment_date).isAfter(dayjs(paymentEndDate), 'day'))) return false;
    if (search) {
      const needle = search.toLowerCase();
      const matched = [
        payment.display_name,
        payment.project_name,
        payment.payment_number,
        payment.reference_text,
        payment.bank_name,
        payment.description_text,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
      if (!matched) return false;
    }
    return true;
  });

  const raBillSource = raBillFilter === 'certified'
    ? certifiedBills
    : raBillFilter === 'paid'
      ? paidBills
      : allRaBills.filter((bill) => ['certified', 'paid'].includes(bill.status));

  const filteredBills = raBillSource.filter((bill) => {
    if (raBillProject !== 'all' && bill.project_id !== raBillProject) return false;
    if (raBillStartDate && (!bill.bill_date || dayjs(bill.bill_date).isBefore(dayjs(raBillStartDate), 'day'))) return false;
    if (raBillEndDate && (!bill.bill_date || dayjs(bill.bill_date).isAfter(dayjs(raBillEndDate), 'day'))) return false;
    if (!raBillSearch) return true;
    const needle = raBillSearch.toLowerCase();
    return [
      bill.bill_number,
      bill.project_name,
      bill.contractor_name,
      bill.payment_ref,
    ].some((value) => String(value || '').toLowerCase().includes(needle));
  });

  const paymentTypes = useMemo(() => {
    const values = Array.from(new Set(payments.map((payment) => payment.payment_type_value).filter(Boolean)));
    return values.sort();
  }, [payments]);

  const outgoingGross = filteredPayments.reduce((sum, payment) => sum + payment.gross_amount, 0);
  const outgoingTds = filteredPayments.reduce((sum, payment) => sum + payment.tds_amount_value, 0);
  const outgoingNet = filteredPayments.reduce((sum, payment) => sum + payment.net_amount_value, 0);
  const tqsLinkedCount = filteredPayments.filter((payment) => payment.source_value === 'tqs').length;

  const receiptNet = filteredBills.filter((bill) => bill.status === 'paid').reduce((sum, bill) => sum + Number(bill.amount_received || computeTdsSplit(bill).amountReceived || 0), 0);
  const receiptTds = filteredBills.filter((bill) => bill.status === 'paid').reduce((sum, bill) => sum + Number(bill.client_tds_amount || computeTdsSplit(bill).clientTds || 0), 0);
  const pendingReceiptCount = filteredBills.filter((bill) => bill.status === 'certified').length;
  const openReceivable = filteredBills.filter((bill) => bill.status === 'certified').reduce((sum, bill) => sum + Number(computeTdsSplit(bill).amountReceived || 0), 0);

  const tdsAmount = form.amount && form.tds_rate ? (Number(form.amount) * Number(form.tds_rate) / 100).toFixed(0) : 0;
  const netAmount = form.amount ? (Number(form.amount) - Number(tdsAmount)) : 0;
  const canSubmitPay = payForm.payment_date && payForm.payment_mode && payForm.payment_ref.trim();
  const tdsSplit = payBill ? computeTdsSplit(payBill) : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <CreditCard className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Payments</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Disbursements, TQS-linked payouts, and client receipts</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('payments')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
            activeTab === 'payments'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          )}
        >
          <CreditCard size={14} />
          Payments Out
        </button>
        <button
          onClick={() => setActiveTab('ra-bills')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
            activeTab === 'ra-bills'
              ? 'bg-violet-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          )}
        >
          <FileCheck2 size={14} />
          Client Receipts
        </button>
      </div>

      {activeTab === 'payments' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Net Disbursed" value={fmt(outgoingNet)} sub="Released to vendors and teams" accent="text-emerald-600" />
            <KpiCard label="Gross Amount" value={fmt(outgoingGross)} sub="Before TDS holdback" accent="text-slate-900" />
            <KpiCard label="TDS Deducted" value={fmt(outgoingTds)} sub="Deducted at source" accent="text-red-500" />
            <KpiCard label="TQS Linked" value={tqsLinkedCount} sub="Imported or synced records" accent="text-indigo-600" />
          </div>

          <FinanceActionBar
            data={filteredPayments}
            fileName="Payments_Register_Export"
            search={search}
            onSearchChange={setSearch}
            projectId={paymentProject}
            onProjectChange={setPaymentProject}
            projectOptions={projects}
            startDate={paymentStartDate}
            onStartDateChange={setPaymentStartDate}
            endDate={paymentEndDate}
            onEndDateChange={setPaymentEndDate}
            searchPlaceholder="Search payee, invoice, UTR, bank or project"
            projectLabel="All Projects"
            onReset={() => {
              setSearch('');
              setPaymentProject('all');
              setPaymentTypeFilter('all');
              setPaymentSourceFilter('all');
              setPaymentStartDate('');
              setPaymentEndDate('');
            }}
            extraControls={(
              <>
                <select
                  value={paymentTypeFilter}
                  onChange={(e) => setPaymentTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-[9px] font-black uppercase tracking-widest outline-none min-w-[160px]"
                >
                  <option value="all">All Types</option>
                  {paymentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={paymentSourceFilter}
                  onChange={(e) => setPaymentSourceFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-[9px] font-black uppercase tracking-widest outline-none min-w-[150px]"
                >
                  <option value="all">All Sources</option>
                  <option value="manual">Manual</option>
                  <option value="tqs">TQS</option>
                </select>
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Record Payment
                </button>
              </>
            )}
          />

          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Payment #', 'Payee', 'Project', 'Reference / Notes', 'Gross', 'TDS', 'Net Paid', 'Mode', 'Date', 'Source', ''].map((heading) => (
                      <th
                        key={heading}
                        className={clsx(
                          'py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic whitespace-nowrap',
                          ['Gross', 'TDS', 'Net Paid'].includes(heading) && 'text-right'
                        )}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 pl-6 font-mono font-black text-indigo-600 text-sm tracking-tight">{payment.payment_number || payment.id?.slice(0, 8).toUpperCase()}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm uppercase tracking-tight">{payment.display_name}</span>
                          {payment.source_value === 'tqs' && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[8px] font-black uppercase tracking-wide">TQS</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{payment.payment_type_value}</div>
                      </td>
                      <td className="p-4 font-bold text-slate-600 uppercase text-[10px] tracking-widest">{payment.project_name}</td>
                      <td className="p-4">
                        <div className="font-mono text-[11px] font-black text-slate-700 uppercase">{payment.reference_text}</div>
                        <div className="text-xs text-slate-500 mt-1 max-w-[260px] truncate">{payment.description_text}</div>
                      </td>
                      <td className="p-4 text-right font-mono font-black text-slate-900">{fmt(payment.gross_amount)}</td>
                      <td className="p-4 text-right font-mono font-black text-red-500">{payment.tds_amount_value > 0 ? fmt(payment.tds_amount_value) : '-'}</td>
                      <td className="p-4 text-right font-mono font-black text-emerald-600">{fmt(payment.net_amount_value)}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                          {payment.payment_mode || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {payment.payment_date ? dayjs(payment.payment_date).format('DD MMM YYYY') : '-'}
                      </td>
                      <td className="p-4">
                        <span className={clsx(
                          'px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border',
                          payment.source_value === 'tqs'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        )}>
                          {payment.source_value}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <TableActions disableEdit onDelete={() => deleteMut.mutate(payment.id)} />
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-20 text-center">
                        <div className="text-slate-400 font-black uppercase tracking-[0.3em] italic">No payment records found</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Try broadening the filters or record a new payment</div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredPayments.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={4} className="p-4 pl-6 text-slate-900 font-black uppercase tracking-widest text-[10px] italic">
                        Total ({filteredPayments.length} records)
                      </td>
                      <td className="p-4 text-right text-slate-900 font-mono font-black">{fmt(outgoingGross)}</td>
                      <td className="p-4 text-right text-red-500 font-mono font-black">{fmt(outgoingTds)}</td>
                      <td className="p-4 text-right text-emerald-600 font-mono font-black">{fmt(outgoingNet)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Receipts In" value={fmt(receiptNet)} sub="Client collections recorded" accent="text-emerald-600" />
            <KpiCard label="Client TDS" value={fmt(receiptTds)} sub="TDS held by clients" accent="text-red-500" />
            <KpiCard label="Pending Receipt" value={pendingReceiptCount} sub="Certified bills awaiting payment" accent="text-violet-600" />
            <KpiCard label="Open Value" value={fmt(openReceivable)} sub="Expected receipt from open bills" accent="text-slate-900" />
          </div>

          <FinanceActionBar
            data={filteredBills}
            fileName="RA_Bills_Receipts_Register"
            search={raBillSearch}
            onSearchChange={setRaBillSearch}
            projectId={raBillProject}
            onProjectChange={setRaBillProject}
            projectOptions={projects}
            startDate={raBillStartDate}
            onStartDateChange={setRaBillStartDate}
            endDate={raBillEndDate}
            onEndDateChange={setRaBillEndDate}
            searchPlaceholder="Search bill number, project, client or reference"
            projectLabel="All Projects"
            onReset={() => {
              setRaBillSearch('');
              setRaBillProject('all');
              setRaBillStartDate('');
              setRaBillEndDate('');
              setRaBillFilter('certified');
            }}
            extraControls={(
              <div className="flex gap-2">
                {[
                  { key: 'certified', label: `Pending (${certifiedBills.length})` },
                  { key: 'paid', label: `Received (${paidBills.length})` },
                  { key: 'all', label: 'All' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setRaBillFilter(item.key)}
                    className={clsx(
                      'px-3.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest',
                      raBillFilter === item.key
                        ? item.key === 'paid'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-violet-600 text-white'
                        : 'bg-slate-50 border border-slate-200 text-slate-600'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          />

          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Bill #', 'Project / Client', 'Bill Date', 'Net Payable', 'Client TDS', raBillFilter === 'paid' ? 'Received' : 'Status', raBillFilter === 'paid' ? 'Reference' : 'Certified By', ''].map((heading) => (
                      <th
                        key={heading}
                        className={clsx(
                          'py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic whitespace-nowrap',
                          ['Net Payable', 'Client TDS', 'Received'].includes(heading) && 'text-right'
                        )}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBills.map((bill) => {
                    const split = computeTdsSplit(bill);
                    const isPaid = bill.status === 'paid';
                    return (
                      <tr key={bill.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 pl-6">
                          <div className={clsx('font-mono font-black text-sm tracking-tight', isPaid ? 'text-emerald-700' : 'text-violet-700')}>{bill.bill_number}</div>
                          {raBillFilter === 'all' && (
                            <span className={clsx(
                              'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block border',
                              isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-violet-50 text-violet-600 border-violet-200'
                            )}>
                              {isPaid ? 'Paid' : 'Pending'}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{bill.project_name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{bill.contractor_name}</div>
                        </td>
                        <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {bill.bill_date ? dayjs(bill.bill_date).format('DD MMM YYYY') : '-'}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900">{fmt(bill.net_payable)}</td>
                        <td className="p-4 text-right font-mono font-black text-red-500">{fmt(split.clientTds)}</td>
                        {isPaid ? (
                          <>
                            <td className="p-4 text-right font-mono font-black text-emerald-600">{fmt(bill.amount_received || split.amountReceived)}</td>
                            <td className="p-4">
                              <div className="font-mono text-xs font-bold text-slate-700 uppercase">{bill.payment_ref || '-'}</div>
                              <div className="text-[10px] text-slate-400 font-bold mt-1">
                                {bill.payment_mode || '-'} | {bill.payment_date ? dayjs(bill.payment_date).format('DD MMM YYYY') : '-'}
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-4">
                              <span className="bg-violet-50 border border-violet-200 text-violet-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                Certified
                              </span>
                            </td>
                            <td className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{bill.certified_by_name || '-'}</td>
                          </>
                        )}
                        <td className="p-4 pr-6">
                          {!isPaid ? (
                            <button
                              onClick={() => {
                                setPayBill(bill);
                                setPayForm(EMPTY_PAY_FORM);
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-emerald-600/30 whitespace-nowrap"
                            >
                              <Banknote size={12} />
                              Mark Received
                            </button>
                          ) : (
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Received</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredBills.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <div className="text-slate-400 font-black uppercase tracking-[0.3em] italic">
                          {raBillFilter === 'paid' ? 'No received bills found' : 'No certified bills found'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-2xl overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                  <CreditCard size={18} />
                </div>
                Record Payment
              </h2>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Project *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400"
                    value={form.project_id}
                    onChange={(e) => setForm((current) => ({ ...current, project_id: e.target.value }))}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payee Name *</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 outline-none focus:border-indigo-400"
                    value={form.payee_name}
                    onChange={(e) => setForm((current) => ({ ...current, payee_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payee Type *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400"
                    value={form.payee_type}
                    onChange={(e) => setForm((current) => ({ ...current, payee_type: e.target.value }))}
                  >
                    {PAYEE_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Description / Invoice *</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400"
                    value={form.description}
                    onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Cost Head</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400"
                    value={form.cost_head}
                    onChange={(e) => setForm((current) => ({ ...current, cost_head: e.target.value }))}
                  >
                    <option value="">Select cost head (optional)</option>
                    {COST_HEADS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.items.map((item) => <option key={item} value={item}>{item}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Gross Amount *</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-base font-mono font-black text-indigo-600 outline-none focus:border-indigo-400"
                    value={form.amount}
                    onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">TDS Rate (%)</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400"
                    value={form.tds_rate}
                    onChange={(e) => setForm((current) => ({ ...current, tds_rate: Number(e.target.value) }))}
                  >
                    <option value={0}>0%</option>
                    <option value={1}>1%</option>
                    <option value={2}>2%</option>
                    <option value={10}>10%</option>
                  </select>
                </div>
                {Number(form.amount) > 0 && (
                  <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Gross</div>
                      <div className="text-slate-900 font-black font-mono mt-2">{fmt(form.amount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">TDS</div>
                      <div className="text-red-500 font-black font-mono mt-2">{fmt(tdsAmount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Net</div>
                      <div className="text-emerald-600 font-black font-mono mt-2">{fmt(netAmount)}</div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Mode *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400"
                    value={form.payment_mode}
                    onChange={(e) => setForm((current) => ({ ...current, payment_mode: e.target.value }))}
                  >
                    {PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Date *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400"
                    value={form.payment_date}
                    onChange={(e) => setForm((current) => ({ ...current, payment_date: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Bank Ref / UTR *</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-indigo-400"
                    value={form.bank_ref}
                    onChange={(e) => setForm((current) => ({ ...current, bank_ref: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl"
                  onClick={() => createMut.mutate({
                    ...form,
                    tds_deducted: tdsAmount,
                    net_amount: netAmount,
                    entity_name: form.payee_name,
                    payment_type: form.payee_type,
                    reference_number: form.bank_ref,
                    remarks: form.description,
                  })}
                  disabled={createMut.isPending || !form.project_id || !form.payee_name || !form.amount || !form.payment_date}
                >
                  {createMut.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {payBill && tdsSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-emerald-50">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                  <Banknote size={18} />
                </div>
                Record Receipt
              </h2>
              <button onClick={() => setPayBill(null)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Bill</span>
                  <span className="font-mono font-black text-violet-700 text-sm">{payBill.bill_number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Project</span>
                  <span className="text-xs font-black text-slate-700 uppercase">{payBill.project_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Client</span>
                  <span className="text-xs font-bold text-slate-600">{payBill.contractor_name}</span>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <div className="bg-slate-50 px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                  Receipt Breakdown
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs font-bold text-slate-600">Certified Net Payable</span>
                    <span className="font-mono font-black text-slate-900">{fmt(tdsSplit.netPayable)}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-xs font-bold text-red-500">Less Client TDS</span>
                    <span className="font-mono font-black text-red-500">{fmt(tdsSplit.clientTds)}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-4 bg-emerald-50">
                    <span className="text-sm font-black text-emerald-700 uppercase tracking-wide italic">Amount Received</span>
                    <span className="font-mono font-black text-emerald-600 text-xl tracking-tighter">{fmt(tdsSplit.amountReceived)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Date *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-400"
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm((current) => ({ ...current, payment_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Payment Mode *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-emerald-400"
                    value={payForm.payment_mode}
                    onChange={(e) => setPayForm((current) => ({ ...current, payment_mode: e.target.value }))}
                  >
                    {PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">UTR / Reference *</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-emerald-400"
                    value={payForm.payment_ref}
                    onChange={(e) => setPayForm((current) => ({ ...current, payment_ref: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl" onClick={() => setPayBill(null)}>
                  Cancel
                </button>
                <button
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2"
                  disabled={!canSubmitPay || markPaidMut.isPending}
                  onClick={() => markPaidMut.mutate({
                    id: payBill.id,
                    data: {
                      ...payForm,
                      client_tds_amount: tdsSplit.clientTds,
                      amount_received: tdsSplit.amountReceived,
                    },
                  })}
                >
                  <Banknote size={14} />
                  {markPaidMut.isPending ? 'Processing...' : `Confirm Receipt - ${fmt(tdsSplit.amountReceived)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
