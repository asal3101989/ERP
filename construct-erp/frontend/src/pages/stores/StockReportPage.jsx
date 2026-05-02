// src/pages/stores/StockReportPage.jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, TrendingUp, TrendingDown, Download,
  AlertTriangle, Package, Search, Filter,
  Calendar, ChevronDown, RefreshCw, FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { inventoryAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'All Categories',
  'Safety Materials',
  'Construction Materials',
  'Cutting / Grinding Tools',
  'Reinforcement Accessories',
  'Waterproofing Items',
  'Painting / Finishing',
  'Electrical (Infra)',
  'Welding Supplies',
  'Formwork / Shuttering',
  'Cover Blocks / Spacers',
  'Hand Tools / Sundry',
  'Structural (MS Channels)',
];

const inr = n => Number(n || 0).toLocaleString('en-IN');

function MiniBar({ value, max, color = 'bg-indigo-400' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StockReportPage() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [projectFilter, setProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('monthly'); // 'monthly' | 'valuation' | 'slow'

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const { data: reportData = [], isLoading, refetch } = useQuery({
    queryKey: ['stock-report', month, projectFilter],
    queryFn: () => inventoryAPI.monthlyReport({
      month,
      project_id: projectFilter || undefined,
    }).then(r => r.data.data),
  });

  // Derived stats
  const totalItems = reportData.length;
  const totalReceived = reportData.reduce((s, r) => s + parseFloat(r.received_qty || 0), 0);
  const totalIssued = reportData.reduce((s, r) => s + parseFloat(r.issued_qty || 0), 0);
  const totalClosing = reportData.reduce((s, r) => s + parseFloat(r.closing_stock || 0), 0);
  const totalValue = reportData.reduce((s, r) => s + parseFloat(r.stock_value || 0), 0);
  const slowMoving = reportData.filter(r => parseFloat(r.issued_qty || 0) === 0 && parseFloat(r.opening_stock || 0) > 0);
  const outOfStock = reportData.filter(r => parseFloat(r.closing_stock || 0) <= 0);

  const filtered = reportData.filter(r => {
    if (search && !r.material_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'All Categories' && r.category !== categoryFilter) return false;
    return true;
  });

  // For monthly view — receive vs consumption
  const maxQty = Math.max(...reportData.map(r => Math.max(
    parseFloat(r.received_qty || 0),
    parseFloat(r.issued_qty || 0),
  )), 1);

  const exportCSV = () => {
    const headers = [
      'Material', 'Category', 'Unit', 'Opening Stock', 'Received',
      'Total Qty', 'Issued', 'Closing Stock', 'Stock at Site', 'Rate', 'Stock Value'
    ];
    const rows = filtered.map(r => [
      r.material_name, r.category || '—', r.unit,
      r.opening_stock || 0, r.received_qty || 0,
      r.total_qty || 0, r.issued_qty || 0,
      r.closing_stock || 0, r.stock_at_site || 0,
      r.rate || 0, r.stock_value || 0,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Stock_Report_${month}.csv`;
    link.click();
    toast.success(`Stock report exported for ${dayjs(month).format('MMMM YYYY')}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <BarChart2 className="w-3.5 h-3.5" /> Stores
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Report</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Monthly receive vs consumption analysis — {dayjs(month).format('MMMM YYYY')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Total Items</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalItems}</div>
          <div className="text-xs text-slate-400 mt-0.5">In catalogue</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-emerald-600">Received</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{inr(totalReceived)}</div>
          <div className="text-xs text-emerald-500 mt-0.5">Units this month</div>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <span className="text-xs text-rose-600">Issued / Consumed</span>
          </div>
          <div className="text-2xl font-bold text-rose-700">{inr(totalIssued)}</div>
          <div className="text-xs text-rose-500 mt-0.5">Units this month</div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <span className="text-xs text-indigo-600">Stock Value</span>
          </div>
          <div className="text-2xl font-bold text-indigo-700">₹{inr(totalValue)}</div>
          <div className="text-xs text-indigo-500 mt-0.5">Closing stock × rate</div>
        </div>
      </div>

      {/* Alerts */}
      {(outOfStock.length > 0 || slowMoving.length > 0) && (
        <div className="flex flex-wrap gap-3 mb-5">
          {outOfStock.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
              <AlertTriangle className="w-4 h-4" />
              {outOfStock.length} item{outOfStock.length !== 1 ? 's' : ''} out of stock
            </div>
          )}
          {slowMoving.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              {slowMoving.length} slow-moving item{slowMoving.length !== 1 ? 's' : ''} (no issue this month)
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1.5 w-fit shadow-sm mb-5">
        {[
          ['monthly', 'Monthly Stock Register'],
          ['valuation', 'Stock Valuation'],
          ['slow', `Slow Moving (${slowMoving.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="month"
            className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </div>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 transition-all"
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 transition-all"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search material…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all"
          />
        </div>
        <span className="text-xs text-slate-400 ml-auto hidden sm:block">{filtered.length} items</span>
      </div>

      {/* ── Monthly Stock Register Tab ── */}
      {tab === 'monthly' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[
                    'S.No', 'Material Description', 'Unit',
                    'Opening Stock', 'Received', 'Total Qty',
                    'Issued', 'Closing Stock', 'Stock at Site', 'Receive vs Issue'
                  ].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 bg-slate-100 animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.map((row, idx) => {
                  const closing = parseFloat(row.closing_stock || 0);
                  const reorder = parseFloat(row.reorder_level || 0);
                  const issued = parseFloat(row.issued_qty || 0);
                  const received = parseFloat(row.received_qty || 0);
                  const isOut = closing <= 0;
                  const isLow = !isOut && reorder > 0 && closing <= reorder;
                  const isSlow = issued === 0 && parseFloat(row.opening_stock || 0) > 0;

                  return (
                    <tr key={row.id || idx} className={clsx(
                      'hover:bg-slate-50 transition-colors',
                      isOut && 'bg-red-50/40',
                      isLow && !isOut && 'bg-amber-50/40',
                    )}>
                      <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-slate-800 max-w-48">{row.material_name}</div>
                          {isSlow && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 font-medium whitespace-nowrap">
                              Slow
                            </span>
                          )}
                          {isOut && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 font-medium whitespace-nowrap">
                              Out
                            </span>
                          )}
                        </div>
                        {row.category && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{row.category}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {row.unit}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-slate-600">
                        {Number(row.opening_stock || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold font-mono text-emerald-600">
                        {received > 0 ? `+${Number(received).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono font-semibold text-slate-700">
                        {Number(row.total_qty || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold font-mono text-rose-600">
                        {issued > 0 ? `−${Number(issued).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={clsx(
                          'text-xs font-bold font-mono',
                          isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                        )}>
                          {Number(closing).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-indigo-600 font-semibold">
                        {Number(row.stock_at_site || closing).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-600 w-12 text-right font-mono">{received.toFixed(1)}</span>
                            <MiniBar value={received} max={maxQty} color="bg-emerald-400" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-rose-500 w-12 text-right font-mono">{issued.toFixed(1)}</span>
                            <MiniBar value={issued} max={maxQty} color="bg-rose-400" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-400">No data for selected period</p>
                      <p className="text-xs text-slate-300 mt-1">Try changing the month or project filter</p>
                    </td>
                  </tr>
                )}
              </tbody>
              {!isLoading && filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={3} className="px-3 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Totals ({filtered.length} items)
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold font-mono text-slate-700">
                      {filtered.reduce((s, r) => s + parseFloat(r.opening_stock || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold font-mono text-emerald-600">
                      +{filtered.reduce((s, r) => s + parseFloat(r.received_qty || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold font-mono text-slate-700">
                      {filtered.reduce((s, r) => s + parseFloat(r.total_qty || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold font-mono text-rose-600">
                      −{filtered.reduce((s, r) => s + parseFloat(r.issued_qty || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold font-mono text-slate-900">
                      {filtered.reduce((s, r) => s + parseFloat(r.closing_stock || 0), 0).toFixed(2)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Stock Valuation Tab ── */}
      {tab === 'valuation' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['S.No', 'Material Description', 'Unit', 'Closing Stock', 'Rate (₹)', 'Stock Value (₹)'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered
                    .filter(r => parseFloat(r.closing_stock || 0) > 0 && parseFloat(r.rate || 0) > 0)
                    .sort((a, b) => parseFloat(b.stock_value || 0) - parseFloat(a.stock_value || 0))
                    .map((row, idx) => {
                      const stockValue = parseFloat(row.closing_stock || 0) * parseFloat(row.rate || 0);
                      const totalV = filtered.reduce((s, r) =>
                        s + (parseFloat(r.closing_stock || 0) * parseFloat(r.rate || 0)), 0);
                      const pct = totalV > 0 ? (stockValue / totalV * 100) : 0;
                      return (
                        <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="text-xs font-semibold text-slate-800">{row.material_name}</div>
                            {row.category && <div className="text-[10px] text-slate-400 mt-0.5">{row.category}</div>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              {row.unit}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono font-semibold text-slate-700">
                            {Number(row.closing_stock || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                            ₹{inr(row.rate)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold font-mono text-indigo-600">
                                ₹{inr(stockValue.toFixed(2))}
                              </span>
                              <div className="flex-1 max-w-20">
                                <MiniBar value={stockValue} max={totalValue} color="bg-indigo-400" />
                              </div>
                              <span className="text-[10px] text-slate-400">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-indigo-700 uppercase tracking-wider text-right">
                    Total Stock Value
                  </td>
                  <td className="px-4 py-3 text-sm font-black font-mono text-indigo-700">
                    ₹{inr(totalValue.toFixed(2))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Slow Moving Items Tab ── */}
      {tab === 'slow' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Slow-moving items</p>
              <p className="text-xs text-amber-600 mt-0.5">
                These {slowMoving.length} items had stock but zero issuance in {dayjs(month).format('MMMM YYYY')}.
                Consider reviewing procurement or redistributing to active sites.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Material', 'Category', 'Unit', 'Opening Stock', 'Closing Stock', 'Idle Since'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {slowMoving.filter(r => {
                    if (search && !r.material_name?.toLowerCase().includes(search.toLowerCase())) return false;
                    return true;
                  }).map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="text-xs font-semibold text-slate-800">{row.material_name}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{row.category || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {row.unit}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                        {Number(row.opening_stock || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-bold font-mono text-amber-600">
                        {Number(row.closing_stock || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">
                        {row.last_issued_at
                          ? dayjs(row.last_issued_at).format('DD MMM YYYY')
                          : 'Never issued'}
                      </td>
                    </tr>
                  ))}
                  {slowMoving.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Package className="w-7 h-7 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-400">No slow-moving items this month</p>
                        <p className="text-xs text-slate-300 mt-1">All stocked items had at least one issue</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-4 text-xs text-slate-400 text-right">
        Data as of {dayjs().format('D MMM YYYY, HH:mm')} • {dayjs(month).format('MMMM YYYY')}
      </div>
    </div>
  );
}
