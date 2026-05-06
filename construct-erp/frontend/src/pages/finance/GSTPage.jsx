// src/pages/finance/GSTPage.jsx — Zoho Books style
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Calculator, Plus, X, FileText, TrendingUp, Landmark, ChevronDown, Download, RefreshCw } from 'lucide-react';
import api, { invoiceAPI, projectAPI, raBillAPI, tqsBillsAPI } from '../../api/client';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

// ── Helpers ───────────────────────────────────────────────────────────────────
const inr = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));
const pct = (num, den) => den ? ((num / den) * 100).toFixed(1) + '%' : '0%';

const GST_RATES = [
  { label: 'Affordable Housing (CLSS)', rate: 1, category: 'Residential', note: 'u/s 80-IBA' },
  { label: 'Residential (Under Construction)', rate: 5, category: 'Residential', note: 'No ITC available' },
  { label: 'Commercial Construction', rate: 12, category: 'Commercial', note: 'Works Contract' },
  { label: 'Works Contract (Govt)', rate: 12, category: 'Government', note: 'HSN 9954' },
  { label: 'Works Contract (Other)', rate: 18, category: 'Other', note: 'HSN 9954' },
  { label: 'Cement', rate: 28, category: 'Materials', note: 'HSN 2523' },
  { label: 'Steel / TMT Bars', rate: 18, category: 'Materials', note: 'HSN 7214' },
  { label: 'Sand & Aggregates', rate: 5, category: 'Materials', note: 'HSN 2505' },
  { label: 'Electrical Fittings', rate: 18, category: 'Materials', note: 'HSN 8536' },
];

// ── GST Calculator Modal ───────────────────────────────────────────────────────
function GSTCalculator({ onClose }) {
  const [taxable, setTaxable] = useState(1000000);
  const [gstType, setGstType] = useState('cgst_sgst');
  const [rate, setRate] = useState(18);

  const cgst = gstType === 'cgst_sgst' ? (taxable * rate / 2) / 100 : 0;
  const sgst = gstType === 'cgst_sgst' ? (taxable * rate / 2) / 100 : 0;
  const igst = gstType === 'igst' ? (taxable * rate) / 100 : 0;
  const totalGST = cgst + sgst + igst;
  const total = taxable + totalGST;
  const tds = (taxable * 2) / 100;
  const netAfterTDS = total - tds;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">GST Calculator</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Taxable Amount (₹)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={taxable}
              onChange={e => setTaxable(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={gstType}
                onChange={e => setGstType(e.target.value)}
              >
                <option value="cgst_sgst">Intra-state (CGST + SGST)</option>
                <option value="igst">Inter-state (IGST)</option>
                <option value="exempt">Exempt</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={rate}
                onChange={e => setRate(parseInt(e.target.value))}
              >
                <option value={1}>1% — Affordable</option>
                <option value={5}>5% — Residential</option>
                <option value={12}>12% — Govt / Commercial</option>
                <option value={18}>18% — Works Contract</option>
                <option value={28}>28% — Cement</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm font-mono">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Amount</span>
              <span className="font-semibold text-gray-900">{inr(taxable)}</span>
            </div>
            {gstType === 'cgst_sgst' && <>
              <div className="flex justify-between text-blue-600">
                <span>CGST @ {rate / 2}%</span>
                <span>+ {inr(cgst)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>SGST @ {rate / 2}%</span>
                <span>+ {inr(sgst)}</span>
              </div>
            </>}
            {gstType === 'igst' && (
              <div className="flex justify-between text-purple-600">
                <span>IGST @ {rate}%</span>
                <span>+ {inr(igst)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Invoice Total</span>
              <span>{inr(total)}</span>
            </div>
            <div className="flex justify-between text-red-500 text-xs">
              <span>Less: TDS u/s 194C (2%)</span>
              <span>− {inr(tds)}</span>
            </div>
            <div className="flex justify-between text-blue-700 font-bold border-t border-gray-200 pt-2 text-base">
              <span>Net Receivable</span>
              <span>{inr(netAfterTDS)}</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">HSN: 9954 (Construction Services) • For reference only</p>
        </div>
      </div>
    </div>
  );
}

// ── Create Invoice Modal ───────────────────────────────────────────────────────
function CreateInvoiceModal({ projects, onClose, onCreate }) {
  const { register, handleSubmit, watch } = useForm({ defaultValues: { gst_type: 'cgst_sgst', gst_rate: 18 } });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Issue Tax Invoice</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onCreate)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number *</label>
              <input
                {...register('invoice_number', { required: true })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                placeholder="INV/2425/090"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
              <input
                {...register('invoice_date', { required: true })}
                type="date"
                defaultValue={dayjs().format('YYYY-MM-DD')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select
              {...register('project_id', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select Project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
              <input
                {...register('client_name', { required: true })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="M/S ABC Limited"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client GSTIN</label>
              <input
                {...register('client_gstin')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                placeholder="27AABCS1234C1Z5"
                maxLength={15}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
              <input
                {...register('hsn_code')}
                defaultValue="9954"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taxable Amount (₹) *</label>
              <input
                {...register('taxable_amount', { required: true })}
                type="number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="1000000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Type *</label>
              <select
                {...register('gst_type')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cgst_sgst">Intra-state (CGST + SGST)</option>
                <option value="igst">Inter-state (IGST)</option>
                <option value="exempt">Exempt</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%) *</label>
              <select
                {...register('gst_rate')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1% — Affordable Housing</option>
                <option value={5}>5% — Residential</option>
                <option value={12}>12% — Commercial / Govt</option>
                <option value={18}>18% — Works Contract</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Issue Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['GST Summary', 'ITC (Purchases)', 'GST Rates'];

export default function GSTPage() {
  const [showCalc, setShowCalc]   = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [tab, setTab]             = useState('GST Summary');
  const qc = useQueryClient();

  // Outgoing invoices (issued to clients)
  const { data: invoices = [], refetch: refetchInv, isFetching: fetchingInv } = useQuery({
    queryKey: ['gst-invoices'],
    queryFn: () => invoiceAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  // TQS bills — input tax (ITC)
  const { data: tqsRes, refetch: refetchTqs, isFetching: fetchingTqs } = useQuery({
    queryKey: ['tqs-bills-gst'],
    queryFn: () => tqsBillsAPI.list({ limit: 1000 }).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
    }).catch(() => []),
  });
  const tqsBills = tqsRes || [];

  // Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => { const d = r?.data; return Array.isArray(d) ? d : (d?.data || []); }).catch(() => []),
  });

  const createMutation = useMutation({
    mutationFn: (d) => invoiceAPI.create({ ...d, taxable_amount: parseFloat(d.taxable_amount) }),
    onSuccess: () => { toast.success('Invoice created'); setShowForm(false); qc.invalidateQueries(['gst-invoices']); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create invoice'),
  });

  // ── Computed KPIs ────────────────────────────────────────────────────────
  const outputGST = useMemo(() => {
    const cgst = invoices.reduce((s, i) => s + parseFloat(i.cgst_amount || 0), 0);
    const sgst = invoices.reduce((s, i) => s + parseFloat(i.sgst_amount || 0), 0);
    const igst = invoices.reduce((s, i) => s + parseFloat(i.igst_amount || 0), 0);
    return { cgst, sgst, igst, total: cgst + sgst + igst };
  }, [invoices]);

  const inputITC = useMemo(() => {
    const bills = tqsBills.filter(b => parseFloat(b.gst_amount || 0) > 0);
    const total = bills.reduce((s, b) => s + parseFloat(b.gst_amount || 0), 0);
    const cgst = bills.reduce((s, b) => s + parseFloat(b.cgst_amount || b.gst_amount / 2 || 0), 0);
    const sgst = bills.reduce((s, b) => s + parseFloat(b.sgst_amount || b.gst_amount / 2 || 0), 0);
    return { total, cgst, sgst, count: bills.length };
  }, [tqsBills]);

  const netGSTPayable = Math.max(0, outputGST.total - inputITC.total);

  // ── CSV Export ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Invoice No', 'Date', 'Client', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status'],
      ...invoices.map(i => [
        i.invoice_number, dayjs(i.invoice_date).format('DD-MM-YYYY'),
        i.client_name, i.taxable_amount,
        i.cgst_amount, i.sgst_amount, i.igst_amount, i.total_amount,
        i.payment_status,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `GST_Invoices_${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
  };

  const isFetching = fetchingInv || fetchingTqs;

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST &amp; Tax Compliance</h1>
          <p className="text-sm text-gray-500 mt-0.5">CGST / SGST / IGST — Works Contract (HSN 9954)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchInv(); refetchTqs(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowCalc(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors font-medium"
          >
            <Calculator className="h-4 w-4" />
            Calculator
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Issue Invoice
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Output GST (Collected)', value: inr(outputGST.total), sub: `${invoices.length} invoices`, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Input Tax Credit (ITC)', value: inr(inputITC.total), sub: `${inputITC.count} vendor bills`, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
          { label: 'Net GST Payable', value: inr(netGSTPayable), sub: 'Output − ITC', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
          { label: 'Total Invoiced (Excl. GST)', value: inr(invoices.reduce((s, i) => s + parseFloat(i.taxable_amount || 0), 0)), sub: 'Taxable value', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-2">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color} font-mono`}>{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg">
        <nav className="flex">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: GST Summary ── */}
      {tab === 'GST Summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output GST breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Output GST — Collected from Clients
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">CGST (Intra-state)</span>
                  <span className="font-semibold text-gray-900 font-mono">{inr(outputGST.cgst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">SGST (Intra-state)</span>
                  <span className="font-semibold text-gray-900 font-mono">{inr(outputGST.sgst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">IGST (Inter-state)</span>
                  <span className="font-semibold text-gray-900 font-mono">{inr(outputGST.igst)}</span>
                </div>
                <div className="flex justify-between py-2 font-bold">
                  <span className="text-gray-900">Total Output GST</span>
                  <span className="text-blue-600 font-mono">{inr(outputGST.total)}</span>
                </div>
              </div>
            </div>

            {/* ITC Summary */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-green-600" />
                Input Tax Credit (ITC) — Available
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">CGST on Purchases</span>
                  <span className="font-semibold text-gray-900 font-mono">{inr(inputITC.cgst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">SGST on Purchases</span>
                  <span className="font-semibold text-gray-900 font-mono">{inr(inputITC.sgst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Total GST Paid on Inputs</span>
                  <span className="font-semibold text-gray-900 font-mono">{inr(inputITC.total)}</span>
                </div>
                <div className="flex justify-between py-2 font-bold">
                  <span className="text-gray-900">ITC Available</span>
                  <span className="text-green-600 font-mono">{inr(inputITC.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net payable box */}
          <div className="bg-white border border-orange-200 rounded-lg shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Net GST Payable</p>
                <p className="text-xs text-gray-500 mt-0.5">Output GST − ITC = Amount payable to government via GSTR-3B</p>
              </div>
              <div className="text-3xl font-bold text-orange-600 font-mono">{inr(netGSTPayable)}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-center">
              {[
                { label: 'GSTR-1 Due', value: '11th of next month', color: 'bg-blue-50 text-blue-700' },
                { label: 'GSTR-3B Due', value: '20th of next month', color: 'bg-purple-50 text-purple-700' },
                { label: 'Annual Return', value: 'GSTR-9 — by Dec 31', color: 'bg-gray-50 text-gray-700' },
              ].map((d, i) => (
                <div key={i} className={`rounded-lg p-2 ${d.color}`}>
                  <div className="font-semibold">{d.label}</div>
                  <div className="mt-0.5">{d.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Tax Invoices Issued</h3>
              <span className="text-xs text-gray-500">{invoices.length} invoices</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Invoice No.', 'Date', 'Client', 'Project', 'Taxable', 'GST', 'Total', 'Type', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-blue-600 font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dayjs(inv.invoice_date).format('DD MMM YYYY')}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{inv.client_name}</div>
                        {inv.client_gstin && <div className="text-xs text-gray-500 font-mono">{inv.client_gstin}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[140px] truncate">{inv.project_name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{inr(inv.taxable_amount)}</td>
                      <td className="px-4 py-3">
                        {inv.gst_type === 'cgst_sgst' ? (
                          <div className="text-xs space-y-0.5 font-mono">
                            <div className="text-blue-600">C: {inr(inv.cgst_amount)}</div>
                            <div className="text-green-600">S: {inr(inv.sgst_amount)}</div>
                          </div>
                        ) : (
                          <div className="text-xs font-mono text-purple-600">I: {inr(inv.igst_amount)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{inr(inv.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.gst_type === 'igst' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {inv.gst_type === 'igst' ? 'Inter-state' : 'Intra-state'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {inv.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">No tax invoices issued yet</p>
                        <button onClick={() => setShowForm(true)} className="mt-2 text-blue-600 text-sm font-medium hover:underline">
                          Issue first invoice
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: ITC (Purchases) ── */}
      {tab === 'ITC (Purchases)' && (
        <div className="space-y-4">
          {/* ITC Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Total ITC Available</p>
              <p className="text-xl font-bold text-green-600 font-mono">{inr(inputITC.total)}</p>
              <p className="text-xs text-gray-400 mt-1">From {inputITC.count} vendor bills</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">CGST Credit</p>
              <p className="text-xl font-bold text-blue-600 font-mono">{inr(inputITC.cgst)}</p>
              <p className="text-xs text-gray-400 mt-1">Intra-state component</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">SGST Credit</p>
              <p className="text-xl font-bold text-blue-600 font-mono">{inr(inputITC.sgst)}</p>
              <p className="text-xs text-gray-400 mt-1">Intra-state component</p>
            </div>
          </div>

          {/* ITC bill table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Vendor Bills with GST (Input Tax)</h3>
              <span className="text-xs text-gray-500">{tqsBills.filter(b => parseFloat(b.gst_amount || 0) > 0).length} bills</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Invoice No.', 'Vendor', 'Date', 'Basic Amount', 'GST Amount', 'CGST', 'SGST', 'Total', 'Type'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tqsBills
                    .filter(b => parseFloat(b.gst_amount || 0) > 0)
                    .slice(0, 100)
                    .map(b => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-blue-600 font-medium text-xs">{b.inv_number || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{b.vendor_name || '—'}</div>
                          {b.vendor_gstin && <div className="text-xs text-gray-500 font-mono">{b.vendor_gstin}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {b.inv_date ? dayjs(b.inv_date).format('DD MMM YYYY') : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{inr(b.basic_amount)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-green-600">{inr(b.gst_amount)}</td>
                        <td className="px-4 py-3 font-mono text-blue-600 text-xs">{inr(b.cgst_amount || b.gst_amount / 2)}</td>
                        <td className="px-4 py-3 font-mono text-blue-600 text-xs">{inr(b.sgst_amount || b.gst_amount / 2)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">{inr(b.total_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.bill_type === 'wo' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {b.bill_type === 'wo' ? 'Work Order' : 'PO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {tqsBills.filter(b => parseFloat(b.gst_amount || 0) > 0).length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                        No vendor bills with GST found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tqsBills.filter(b => parseFloat(b.gst_amount || 0) > 0).length > 100 && (
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
                Showing first 100 of {tqsBills.filter(b => parseFloat(b.gst_amount || 0) > 0).length} bills
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: GST Rates ── */}
      {tab === 'GST Rates' && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">GST Rate Reference — Construction Industry</h3>
            <p className="text-xs text-gray-500 mt-0.5">Applicable rates as per GST Act for works contract and building materials</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Category', 'Description', 'GST Rate', 'Note'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {GST_RATES.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.category === 'Residential' ? 'bg-blue-50 text-blue-700' :
                        r.category === 'Government' ? 'bg-purple-50 text-purple-700' :
                        r.category === 'Materials' ? 'bg-orange-50 text-orange-700' :
                        'bg-gray-50 text-gray-700'
                      }`}>
                        {r.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.label}</td>
                    <td className="px-5 py-3">
                      <span className={`text-lg font-bold font-mono ${
                        r.rate <= 5 ? 'text-green-600' :
                        r.rate <= 12 ? 'text-blue-600' :
                        r.rate <= 18 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {r.rate}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 bg-blue-50 border-t border-blue-100">
            <p className="text-xs text-blue-700 font-medium">Important: ITC is not available on residential construction projects. Claim ITC only on commercial/works contract projects.</p>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showCalc && <GSTCalculator onClose={() => setShowCalc(false)} />}
      {showForm && (
        <CreateInvoiceModal
          projects={projects}
          onClose={() => setShowForm(false)}
          onCreate={createMutation.mutate}
        />
      )}
    </div>
  );
}
