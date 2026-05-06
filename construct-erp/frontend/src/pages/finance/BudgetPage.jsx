// src/pages/finance/BudgetPage.jsx — Zoho Books style
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, X, PieChart, Warehouse, Package, RefreshCw, ChevronRight, Plus, Download, Zap } from 'lucide-react';
import api, { projectAPI, inventoryAPI } from '../../api/client';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
const inr  = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));
const inrL = (v) => `₹${(parseFloat(v || 0) / 100000).toFixed(2)}L`;

const COST_HEADS = [
  { group: 'Material',          items: ['Material — Concrete & Aggregates', 'Material — Steel & Reinforcement', 'Material — Cement & Masonry', 'Material — Finishing & Tiles'] },
  { group: 'Labour',            items: ['Labour — Skilled', 'Labour — Unskilled', 'Labour — Supervisory'] },
  { group: 'Plant & Machinery', items: ['Plant & Machinery — Owned', 'Plant & Machinery — Hired'] },
  { group: 'Subcontracting',    items: ['Subcontracting — Civil', 'Subcontracting — MEP', 'Subcontracting — Structural'] },
  { group: 'Overhead',          items: ['Site Overhead', 'Head Office Overhead', 'Contingency', 'Provisional Sum'] },
];

function UtilBar({ value, max }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over = max > 0 && value > max;
  const warn = !over && pct > 85;
  const color = over ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-green-500';
  const text  = over ? 'text-red-600' : warn ? 'text-amber-600' : 'text-green-600';
  const pctReal = max > 0 ? ((value / max) * 100).toFixed(1) : '0.0';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[80px]">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium w-12 text-right font-mono ${text}`}>{pctReal}%</span>
    </div>
  );
}

function ValueBar({ value, max, color = 'bg-blue-500' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function BudgetPage() {
  const [activeTab, setActiveTab] = useState('budget');
  const [projectId, setProjectId] = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ cost_head: '', budgeted_amount: '', remarks: '' });
  const [editId, setEditId]       = useState(null);
  const qc = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data).catch(() => []),
  });

  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['budget', projectId],
    queryFn: () => api.get(`/budget?project_id=${projectId}`).then(r => r.data.data),
    enabled: !!projectId,
  });

  const { data: valuationRows = [], isLoading: valLoading, refetch: valRefetch } = useQuery({
    queryKey: ['stock-valuation', activeTab === 'stock' ? projectId : '__skip__'],
    queryFn: () => inventoryAPI.valuation(projectId ? { project_id: projectId } : {}).then(r => r.data.data),
    enabled: activeTab === 'stock',
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/budget', { ...d, project_id: projectId }),
    onSuccess: () => {
      toast.success('Budget line saved');
      setShowForm(false);
      setForm({ cost_head: '', budgeted_amount: '', remarks: '' });
      qc.invalidateQueries({ queryKey: ['budget', projectId] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => api.put(`/budget/${id}`, d),
    onSuccess: () => {
      toast.success('Updated');
      setShowForm(false);
      setEditId(null);
      qc.invalidateQueries({ queryKey: ['budget', projectId] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/budget/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['budget', projectId] }); },
    onError: () => toast.error('Failed to delete'),
  });

  const allItems     = budgetData ?? [];
  const budgeted     = allItems.filter(i => !i.unbudgeted);
  const unbudgeted   = allItems.filter(i => i.unbudgeted);
  const totals       = {
    budget: budgeted.reduce((s, i) => s + parseFloat(i.budgeted_amount || 0), 0),
    actual: allItems.reduce((s, i) => s + parseFloat(i.actual_amount || 0), 0),
  };
  const overrun      = totals.actual > totals.budget;
  const overrunItems = budgeted.filter(i => parseFloat(i.actual_amount) > parseFloat(i.budgeted_amount));

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ cost_head: '', budgeted_amount: '', remarks: '' }); };

  const totalStockValue = valuationRows.reduce((s, r) => s + parseFloat(r.stock_value || 0), 0);
  const totalStockItems = valuationRows.reduce((s, r) => s + parseInt(r.item_count || 0), 0);
  const projectRollup   = Object.values(
    valuationRows.reduce((acc, r) => {
      if (!acc[r.project_id]) acc[r.project_id] = { project_id: r.project_id, project_name: r.project_name, item_count: 0, stock_value: 0 };
      acc[r.project_id].item_count  += parseInt(r.item_count || 0);
      acc[r.project_id].stock_value += parseFloat(r.stock_value || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.stock_value - a.stock_value);

  const matBudgetTotal = (budgetData ?? [])
    .filter(i => i.cost_head && i.cost_head.toLowerCase().startsWith('material'))
    .reduce((s, i) => s + parseFloat(i.budgeted_amount || 0), 0);

  const exportCSV = () => {
    const rows = [
      ['Cost Head', 'Budgeted', 'Actual', 'Variance', 'Utilization %'],
      ...budgeted.map(i => {
        const b = parseFloat(i.budgeted_amount || 0);
        const a = parseFloat(i.actual_amount || 0);
        return [i.cost_head, b, a, b - a, b > 0 ? ((a / b) * 100).toFixed(1) : '0'];
      }),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Budget_Analysis.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === 'budget' ? 'Budget vs Actual' : 'Stock on Hand'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeTab === 'budget'
              ? 'Live actual spend pulled automatically from recorded payments'
              : 'Current inventory valuation — qty × unit rate per project'}
          </p>
        </div>
        {activeTab === 'budget' && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Budget Line
            </button>
          </div>
        )}
        {activeTab === 'stock' && (
          <button
            onClick={() => valRefetch()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${valLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg">
        <nav className="flex">
          {[['budget', PieChart, 'Budget vs Actual'], ['stock', Warehouse, 'Stock on Hand']].map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════════ BUDGET TAB ══════════════ */}
      {activeTab === 'budget' && (
        <div className="space-y-5">
          {/* Project selector */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
            >
              <option value="">— Select a project to view budget —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {projectId && (
            <>
              {/* Live badge */}
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 w-fit">
                <Zap className="h-3.5 w-3.5 text-green-600" />
                Actual spend is live — pulled automatically from all payments recorded against this project
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Budget', value: inrL(totals.budget), color: 'text-gray-900' },
                  { label: 'Actual Spend (Live)', value: inrL(totals.actual), color: overrun ? 'text-red-600' : 'text-blue-600' },
                  {
                    label: overrun ? 'Over Budget' : 'Balance Remaining',
                    value: inrL(Math.abs(totals.budget - totals.actual)),
                    color: overrun ? 'text-red-600' : 'text-green-600',
                  },
                  {
                    label: 'Overrun Items',
                    value: overrunItems.length,
                    color: overrunItems.length > 0 ? 'text-red-600' : 'text-green-600',
                    bg: overrunItems.length > 0 ? 'bg-red-50 border-red-100' : undefined,
                  },
                ].map((kpi, i) => (
                  <div key={i} className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${kpi.bg || ''}`}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{kpi.label}</p>
                    <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Overall utilization bar */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Overall Budget Utilization</span>
                  <span className={`text-lg font-bold font-mono ${overrun ? 'text-red-600' : 'text-green-600'}`}>
                    {totals.budget > 0 ? ((totals.actual / totals.budget) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overrun ? 'bg-red-500' : totals.actual / totals.budget > 0.85 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, totals.budget > 0 ? (totals.actual / totals.budget) * 100 : 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>₹0</span>
                  <span>{inrL(totals.budget)} Budget</span>
                </div>
              </div>

              {/* Overrun alert */}
              {overrunItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Budget Overrun — {overrunItems.length} cost head{overrunItems.length > 1 ? 's' : ''} exceeded
                  </div>
                  <div className="space-y-2">
                    {overrunItems.map(i => {
                      const over = parseFloat(i.actual_amount) - parseFloat(i.budgeted_amount);
                      return (
                        <div key={i.id} className="flex items-center justify-between text-sm bg-white rounded-lg p-3 border border-red-100">
                          <span className="font-medium text-red-800">{i.cost_head}</span>
                          <div className="text-right">
                            <span className="text-red-600 font-semibold font-mono">+{inr(over)} over</span>
                            <div className="text-xs text-red-400 mt-0.5">Budget {inr(i.budgeted_amount)} · Actual {inr(i.actual_amount)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unbudgeted spend */}
              {unbudgeted.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Unbudgeted Spend — {unbudgeted.length} cost head{unbudgeted.length > 1 ? 's' : ''} with no budget line
                  </div>
                  <div className="space-y-2">
                    {unbudgeted.map((u, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg p-3 border border-amber-100">
                        <span className="font-medium text-amber-800">{u.cost_head}</span>
                        <span className="font-mono font-semibold text-amber-600">{inr(u.actual_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget Table */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Budget Lines</span>
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Actual column updates automatically as payments are recorded
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Cost Head', 'Budgeted', 'Actual (Live)', 'Variance', 'Utilization', 'Actions'].map(h => (
                          <th key={h} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${['Budgeted', 'Actual (Live)', 'Variance'].includes(h) ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isLoading && (
                        <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">Loading...</td></tr>
                      )}
                      {budgeted.map(item => {
                        const budget   = parseFloat(item.budgeted_amount || 0);
                        const actual   = parseFloat(item.actual_amount || 0);
                        const variance = budget - actual;
                        const isOver   = actual > budget;
                        return (
                          <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isOver ? 'bg-red-50/30' : ''}`}>
                            <td className="px-5 py-3 font-medium text-gray-900">{item.cost_head}</td>
                            <td className="px-5 py-3 text-right font-mono text-gray-700">{inr(budget)}</td>
                            <td className="px-5 py-3 text-right">
                              <div className={`font-mono font-semibold ${isOver ? 'text-red-600' : 'text-blue-600'}`}>{inr(actual)}</div>
                              <div className="text-xs text-green-500">auto</div>
                            </td>
                            <td className="px-5 py-3 text-right font-mono">
                              <span className={variance < 0 ? 'text-red-500 font-semibold' : 'text-green-600'}>
                                {variance < 0 ? '−' : '+'}{inr(Math.abs(variance))}
                              </span>
                            </td>
                            <td className="px-5 py-3 min-w-[180px]">
                              {budget > 0
                                ? <UtilBar value={actual} max={budget} />
                                : <span className="text-xs text-gray-400">— No budget —</span>}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setForm({ cost_head: item.cost_head, budgeted_amount: item.budgeted_amount, remarks: item.remarks || '' });
                                    setEditId(item.id);
                                    setShowForm(true);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteMut.mutate(item.id)}
                                  className="text-xs text-red-400 hover:text-red-600 font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {budgeted.length > 0 && (
                        <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                          <td className="px-5 py-3 text-gray-900">Total</td>
                          <td className="px-5 py-3 text-right font-mono text-blue-600">{inr(totals.budget)}</td>
                          <td className="px-5 py-3 text-right font-mono">
                            <span className={totals.actual > totals.budget ? 'text-red-600' : 'text-blue-600'}>{inr(totals.actual)}</span>
                          </td>
                          <td className="px-5 py-3 text-right font-mono">
                            <span className={totals.actual > totals.budget ? 'text-red-600' : 'text-green-600'}>
                              {totals.actual > totals.budget ? '−' : '+'}{inr(Math.abs(totals.budget - totals.actual))}
                            </span>
                          </td>
                          <td className="px-5 py-3 min-w-[180px]">
                            <UtilBar value={totals.actual} max={totals.budget} />
                          </td>
                          <td />
                        </tr>
                      )}
                      {!isLoading && budgeted.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-14 text-center">
                            <PieChart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No budget lines yet</p>
                            <button onClick={() => setShowForm(true)} className="mt-2 text-blue-600 text-sm font-medium hover:underline">
                              Add first budget line
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!projectId && (
            <div className="py-20 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
              <PieChart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a project above to view its budget</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ STOCK TAB ══════════════ */}
      {activeTab === 'stock' && (
        <div className="space-y-5">
          {/* Project filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex gap-3 items-end">
            <div className="flex-1 max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Project</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">— All Projects —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="text-xs text-green-600 flex items-center gap-1 pb-2">
              <Zap className="h-3.5 w-3.5" />
              Live from Store Ledger
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1">Total Stock Value</p>
              <p className="text-2xl font-bold text-blue-600 font-mono">{inrL(totalStockValue)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1">Distinct Items</p>
              <p className="text-2xl font-bold text-gray-900 font-mono">{totalStockItems}</p>
            </div>
            {projectId && matBudgetTotal > 0 ? (
              <div className={`border rounded-lg p-4 shadow-sm ${totalStockValue > matBudgetTotal ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
                <p className="text-xs font-medium text-gray-500 mb-1">% of Material Budget</p>
                <p className={`text-2xl font-bold font-mono ${totalStockValue > matBudgetTotal ? 'text-amber-600' : 'text-green-600'}`}>
                  {matBudgetTotal > 0 ? ((totalStockValue / matBudgetTotal) * 100).toFixed(0) : 0}%
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 mb-1">Projects with Stock</p>
                <p className="text-2xl font-bold text-gray-900 font-mono">{projectRollup.length}</p>
              </div>
            )}
          </div>

          {/* Material Budget vs Stock (when project selected and has material budget) */}
          {projectId && matBudgetTotal > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-700">Material Budget vs Stock on Hand</span>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-1.5 rounded bg-gray-300 inline-block" />Budget {inrL(matBudgetTotal)}</span>
                  <span className="flex items-center gap-1.5 text-blue-600"><span className="w-3 h-1.5 rounded bg-blue-500 inline-block" />Stock {inrL(totalStockValue)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Material Budget</span><span>{inr(matBudgetTotal)}</span></div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gray-300" style={{ width: '100%' }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-blue-600 mb-1"><span>Current Stock Value</span><span>{inr(totalStockValue)}</span></div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${totalStockValue > matBudgetTotal ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, matBudgetTotal > 0 ? (totalStockValue / matBudgetTotal) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All-projects table */}
          {!projectId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Stock Value by Project</span>
                <span className="text-xs text-gray-400">Closing stock × unit rate</span>
              </div>
              {valLoading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
              ) : projectRollup.length === 0 ? (
                <div className="py-12 text-center">
                  <Warehouse className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No inventory data found</p>
                  <p className="text-xs text-gray-400 mt-1">Import stock data in Store Ledger first</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Project', 'Items', 'Stock Value', '% of Total', ''].map(h => (
                          <th key={h} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${['Items', 'Stock Value'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {projectRollup.map(p => {
                        const pct = totalStockValue > 0 ? (p.stock_value / totalStockValue) * 100 : 0;
                        return (
                          <tr key={p.project_id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setProjectId(p.project_id)}>
                            <td className="px-5 py-3 font-medium text-gray-900">{p.project_name}</td>
                            <td className="px-5 py-3 text-right font-mono text-gray-600">{p.item_count}</td>
                            <td className="px-5 py-3 text-right font-mono font-semibold text-blue-600">{inr(p.stock_value)}</td>
                            <td className="px-5 py-3 min-w-[150px]"><ValueBar value={p.stock_value} max={totalStockValue} /></td>
                            <td className="px-5 py-3 text-gray-300"><ChevronRight className="h-4 w-4" /></td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                        <td className="px-5 py-3 text-gray-900">Total</td>
                        <td className="px-5 py-3 text-right font-mono text-gray-900">{totalStockItems}</td>
                        <td className="px-5 py-3 text-right font-mono text-blue-600">{inr(totalStockValue)}</td>
                        <td /><td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Category breakdown (project selected) */}
          {projectId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Category Breakdown</span>
                <button onClick={() => setProjectId('')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  ← All Projects
                </button>
              </div>
              {valLoading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
              ) : valuationRows.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No stock data for this project</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Category', 'Items', 'Total Qty', 'Stock Value', '% of Total'].map(h => (
                          <th key={h} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${['Items', 'Total Qty', 'Stock Value'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {valuationRows.map((row, i) => {
                        const colors = ['bg-blue-500','bg-violet-500','bg-green-500','bg-amber-500','bg-rose-500','bg-cyan-500'];
                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-900">{row.category}</td>
                            <td className="px-5 py-3 text-right font-mono text-gray-600">{row.item_count}</td>
                            <td className="px-5 py-3 text-right font-mono text-gray-600">{Number(row.total_qty || 0).toFixed(2)}</td>
                            <td className="px-5 py-3 text-right font-mono font-semibold text-blue-600">{inr(row.stock_value)}</td>
                            <td className="px-5 py-3 min-w-[150px]">
                              <ValueBar value={parseFloat(row.stock_value)} max={totalStockValue} color={colors[i % colors.length]} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                        <td className="px-5 py-3 text-gray-900">Total</td>
                        <td className="px-5 py-3 text-right font-mono text-gray-900">{totalStockItems}</td>
                        <td className="px-5 py-3 text-right font-mono text-gray-900">
                          {valuationRows.reduce((s, r) => s + parseFloat(r.total_qty || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-blue-600">{inr(totalStockValue)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center pb-2">
            Stock values are read-only — sourced from Store Ledger (closing qty × unit rate).
          </p>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{editId ? 'Edit Budget Line' : 'Add Budget Line'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Head *</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.cost_head}
                  onChange={e => setForm(p => ({ ...p, cost_head: e.target.value }))}
                  disabled={!!editId}
                >
                  <option value="">Select cost head</option>
                  {COST_HEADS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map(item => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))}
                </select>
                {editId && <p className="text-xs text-gray-400 mt-1">Cost head cannot be changed after creation.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Limit (₹) *</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="0.00"
                  value={form.budgeted_amount}
                  onChange={e => setForm(p => ({ ...p, budgeted_amount: e.target.value }))}
                />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                ⚡ Actual spend will be calculated automatically from payments tagged to this cost head.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional notes..."
                  value={form.remarks}
                  onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetForm}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => editId
                    ? updateMutation.mutate({ id: editId, d: form })
                    : createMutation.mutate(form)
                  }
                  disabled={createMutation.isPending || updateMutation.isPending || !form.cost_head || !form.budgeted_amount}
                  className="flex-[2] py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Budget Line'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
