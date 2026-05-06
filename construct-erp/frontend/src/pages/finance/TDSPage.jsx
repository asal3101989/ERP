// src/pages/finance/TDSPage.jsx — Zoho Books style
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, ArrowDownCircle, ArrowUpCircle, RefreshCw, Search } from 'lucide-react';
import api from '../../api/client';
import dayjs from 'dayjs';

// ── Helpers ───────────────────────────────────────────────────────────────────
const inr = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));

const TDS_SECTIONS = {
  '194C': 'Contractors & Sub-contractors',
  '194I': 'Rent',
  '194J': 'Professional / Technical Services',
  '194A': 'Interest',
  '194H': 'Commission / Brokerage',
  '194Q': 'Purchase of Goods',
};

export default function TDSPage() {
  const [activeTab, setActiveTab] = useState('outgoing');
  const [search, setSearch]       = useState('');
  const [section, setSection]     = useState('');

  const { data: raw, refetch, isFetching } = useQuery({
    queryKey: ['tds'],
    queryFn: () => api.get('/tds').then(r => r.data).catch(() => ({ outgoing: [], incoming: [] })),
  });

  const outgoing = raw?.outgoing || [];
  const incoming = raw?.incoming || [];

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalOutTDS    = outgoing.reduce((s, r) => s + Number(r.tds_amount || 0), 0);
  const depositedOut   = outgoing.filter(r => r.deposited).reduce((s, r) => s + Number(r.tds_amount || 0), 0);
  const pendingDeposit = totalOutTDS - depositedOut;
  const totalInTDS     = incoming.reduce((s, r) => s + Number(r.tds_amount || 0), 0);
  const netPosition    = totalOutTDS - totalInTDS;

  // ── Active records with filtering ───────────────────────────────────────────
  const allRecords = activeTab === 'outgoing' ? outgoing : incoming;
  const records = allRecords.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || (r.payee_name || '').toLowerCase().includes(q) || (r.pan || '').toLowerCase().includes(q);
    const matchSection = !section || r.section === section;
    return matchSearch && matchSection;
  });

  // ── CSV export (Form 26Q style) ─────────────────────────────────────────────
  const exportCSV = () => {
    const src = activeTab === 'outgoing' ? outgoing : incoming;
    const headers = activeTab === 'outgoing'
      ? ['Payee', 'PAN', 'Section', 'Project', 'Payment Amount', 'TDS Rate %', 'TDS Amount', 'Net Paid', 'Payment Date', 'Challan No', 'Deposited']
      : ['Client', 'PAN', 'Section', 'Project', 'Bill Gross', 'TDS Rate %', 'TDS by Client', 'Amount Received', 'Receipt Date', 'UTR/Ref', 'Form 16A'];
    const rows = [
      headers,
      ...src.map(r => [
        r.payee_name, r.pan || '', r.section, r.project_name || '',
        r.invoice_amount, r.tds_rate, r.tds_amount, r.net_paid,
        r.payment_date ? dayjs(r.payment_date).format('DD-MM-YYYY') : '',
        r.challan_number || '', r.deposited ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Form_26Q_${activeTab}_${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TDS Register</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            TDS deducted by us (payable) · TDS deducted by client (receivable credit via 26AS)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Form 26Q
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-2">TDS Deducted by Us</p>
          <p className="text-xl font-bold text-red-600 font-mono">{inr(totalOutTDS)}</p>
          <p className="text-xs text-gray-400 mt-1">{outgoing.length} vendor / labour payments</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-2">Pending Deposit to Govt</p>
          <p className="text-xl font-bold text-orange-600 font-mono">{inr(pendingDeposit)}</p>
          <p className="text-xs text-gray-400 mt-1">Via Form 281 / GSTR challan</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-2">TDS by Client (26AS)</p>
          <p className="text-xl font-bold text-green-600 font-mono">{inr(totalInTDS)}</p>
          <p className="text-xs text-gray-400 mt-1">{incoming.length} RA bill receipts</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-2">Net TDS Position</p>
          <p className={`text-xl font-bold font-mono ${netPosition > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {inr(Math.abs(netPosition))}
          </p>
          <p className="text-xs text-gray-400 mt-1">{netPosition > 0 ? 'Net payable to govt' : 'Net credit available'}</p>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'outgoing'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowUpCircle className="h-4 w-4" />
              TDS Deducted by Us
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'outgoing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>{outgoing.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('incoming')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'incoming'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowDownCircle className="h-4 w-4" />
              TDS by Client (RA Bills)
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'incoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>{incoming.length}</span>
            </button>
          </nav>
        </div>

        {/* Context banner */}
        <div className={`px-5 py-3 text-xs font-medium border-b ${
          activeTab === 'outgoing'
            ? 'bg-red-50 border-red-100 text-red-700'
            : 'bg-green-50 border-green-100 text-green-700'
        }`}>
          {activeTab === 'outgoing'
            ? 'We are the deductor — must deposit with govt via Form 281 and file quarterly Form 26Q by the 31st of the month following quarter end.'
            : 'Client is the deductor — they issue Form 16A. This appears as credit in our 26AS statement and reduces our advance tax liability.'}
        </div>

        {/* Filters */}
        <div className="px-5 py-3 flex flex-wrap gap-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search payee or PAN…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>
          <select
            value={section}
            onChange={e => setSection(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sections</option>
            {Object.entries(TDS_SECTIONS).map(([code, label]) => (
              <option key={code} value={code}>{code} — {label}</option>
            ))}
          </select>
          {(search || section) && (
            <button
              onClick={() => { setSearch(''); setSection(''); }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 self-center">{records.length} records</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {(activeTab === 'outgoing'
                  ? ['Payee', 'PAN', 'Section', 'Project', 'Payment Amt', 'TDS Rate', 'TDS Deducted', 'Net Paid', 'Date', 'Challan #', 'Status']
                  : ['Client', 'PAN', 'Section', 'Project', 'Bill Gross', 'TDS Rate', 'TDS by Client', 'Amt Received', 'Date', 'UTR / Ref', 'Form 16A']
                ).map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap ${
                    ['Payment Amt', 'TDS Deducted', 'Net Paid', 'Bill Gross', 'TDS by Client', 'Amt Received'].includes(h) ? 'text-right' : 'text-left'
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.payee_name}</div>
                    <div className="text-xs text-gray-500">{r.payee_type}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{r.pan || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      {r.section}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[130px] truncate">{r.project_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{inr(r.invoice_amount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.tds_rate}%</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">{inr(r.tds_amount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-600">{inr(r.net_paid)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {r.payment_date ? dayjs(r.payment_date).format('DD MMM YYYY') : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.challan_number || '—'}</td>
                  <td className="px-4 py-3">
                    {activeTab === 'outgoing' ? (
                      r.deposited
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Deposited</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Pending</span>
                    ) : (
                      r.deposited
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Received</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">Pending 16A</span>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-14 text-center">
                    <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">
                      {search || section
                        ? 'No records match the filter'
                        : activeTab === 'outgoing'
                          ? 'No outgoing TDS recorded yet — payments with TDS will appear here'
                          : 'No client TDS entries yet — mark RA bills as received with TDS'
                      }
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-sm">
                  <td colSpan={4} className="px-4 py-3 text-gray-700">
                    Total ({records.length} records)
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-800">
                    {inr(records.reduce((s, r) => s + Number(r.invoice_amount || 0), 0))}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {inr(records.reduce((s, r) => s + Number(r.tds_amount || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">
                    {inr(records.reduce((s, r) => s + Number(r.net_paid || 0), 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── TDS Section Reference ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">TDS Section Reference — Construction</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { section: '194C', rate: '1% / 2%', desc: 'Contracts — individuals / others', note: 'Limit: ₹30,000 / ₹1L per year' },
            { section: '194I', rate: '10%', desc: 'Rent — land, building, plant', note: 'Limit: ₹2.4L per year' },
            { section: '194J', rate: '10%', desc: 'Professional / Technical fees', note: 'Limit: ₹30,000 per year' },
            { section: '194A', rate: '10%', desc: 'Interest other than securities', note: 'Limit: ₹40,000 (banks)' },
            { section: '194H', rate: '5%', desc: 'Commission / Brokerage', note: 'Limit: ₹15,000 per year' },
            { section: '194Q', rate: '0.1%', desc: 'Purchase of goods (turnover > ₹10Cr)', note: 'Buyer deducts on > ₹50L' },
          ].map(s => (
            <div key={s.section} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">Sec {s.section}</span>
                <span className="text-sm font-bold text-gray-900">{s.rate}</span>
              </div>
              <p className="text-xs font-medium text-gray-700">{s.desc}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.note}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          * TDS must be deposited by 7th of the following month (March: 30th April). Quarterly returns (Form 26Q) due 31st of month following quarter end.
        </p>
      </div>
    </div>
  );
}
