// src/pages/finance/BudgetPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, X, ChevronDown, PieChart, Zap, Warehouse, Package, RefreshCw, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import api, { projectAPI, inventoryAPI } from '../../api/client';
import toast from 'react-hot-toast';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const inr  = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const inrL = (v) => `₹${(parseFloat(v || 0) / 100000).toFixed(2)}L`;

const COST_HEADS = [
  { group: 'Material',          items: ['Material — Concrete & Aggregates', 'Material — Steel & Reinforcement', 'Material — Cement & Masonry', 'Material — Finishing & Tiles'] },
  { group: 'Labour',            items: ['Labour — Skilled', 'Labour — Unskilled', 'Labour — Supervisory'] },
  { group: 'Plant & Machinery', items: ['Plant & Machinery — Owned', 'Plant & Machinery — Hired'] },
  { group: 'Subcontracting',    items: ['Subcontracting — Civil', 'Subcontracting — MEP', 'Subcontracting — Structural'] },
  { group: 'Overhead',          items: ['Site Overhead', 'Head Office Overhead', 'Contingency', 'Provisional Sum'] },
];

function UtilBar({ pct }) {
  const color = pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[80px] shadow-inner">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={clsx('text-[10px] font-mono w-12 text-right font-black tracking-tighter',
        pct > 100 ? 'text-red-600' : pct > 85 ? 'text-amber-600' : 'text-emerald-600'
      )}>{pct.toFixed(1)}%</span>
    </div>
  );
}

// ValueBar — horizontal fill bar for stock tables
function ValueBar({ pct, color = 'bg-indigo-500' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-[10px] font-mono font-black text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function BudgetPage() {
  const [activeTab, setActiveTab]  = useState('budget');
  const [projectId, setProjectId]  = useState('');
  const [showForm, setShowForm]    = useState(false);
  const [form, setForm]            = useState({ cost_head: '', budgeted_amount: '', remarks: '' });
  const [editId, setEditId]        = useState(null);
  const qc = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data).catch(() => []),
  });

  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['budget', projectId],
    queryFn: () => api.get(`/budget?project_id=${projectId}`).then(r => r.data.data),
    enabled: !!projectId,
  });

  // Stock valuation — all projects (no filter) for the overview; filtered when project selected
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

  const totals = {
    budget: budgeted.reduce((s, i) => s + parseFloat(i.budgeted_amount || 0), 0),
    actual: allItems.reduce((s, i) => s + parseFloat(i.actual_amount || 0), 0),
  };
  const overrun      = totals.actual > totals.budget;
  const overrunItems = budgeted.filter(i => parseFloat(i.actual_amount) > parseFloat(i.budgeted_amount));

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ cost_head: '', budgeted_amount: '', remarks: '' }); };

  // ── Stock valuation derived values ─────────────────────────────────────────
  const totalStockValue  = valuationRows.reduce((s, r) => s + parseFloat(r.stock_value || 0), 0);
  const totalStockItems  = valuationRows.reduce((s, r) => s + parseInt(r.item_count || 0), 0);

  // per-project rollup (for "all projects" view)
  const projectRollup = Object.values(
    valuationRows.reduce((acc, r) => {
      if (!acc[r.project_id]) acc[r.project_id] = { project_id: r.project_id, project_name: r.project_name, item_count: 0, stock_value: 0 };
      acc[r.project_id].item_count  += parseInt(r.item_count || 0);
      acc[r.project_id].stock_value += parseFloat(r.stock_value || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.stock_value - a.stock_value);

  // Material budget lines for comparison
  const matBudgetTotal = (budgetData ?? [])
    .filter(i => i.cost_head && i.cost_head.toLowerCase().startsWith('material'))
    .reduce((s, i) => s + parseFloat(i.budgeted_amount || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <PieChart className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
              {activeTab === 'budget' ? 'Budget vs Actual' : 'Stock on Hand'}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              {activeTab === 'budget'
                ? 'Actual spend auto-calculated from recorded payments — live'
                : 'Current inventory valuation — qty × unit rate per project'}
            </p>
          </div>
        </div>
        {activeTab === 'budget' && (
          <DataToolbar data={allItems} fileName="Budget_Analysis_Export" onAdd={() => setShowForm(true)} addLabel="Add Budget Line" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm w-fit">
        {[['budget', PieChart, 'Budget vs Actual'], ['stock', Warehouse, 'Stock on Hand']].map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest italic transition-all',
              activeTab === key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ BUDGET TAB ══════════════ */}
      {activeTab === 'budget' && <>

      {/* Project selector */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-sm relative">
        <select
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pl-5 pr-10 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
        >
          <option value="">— Select Project —</option>
          {(projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <ChevronDown className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {projectId && (
        <>
          {/* Live indicator */}
          <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">
            <Zap size={12} className="text-emerald-500" />
            Actual spend is live — pulled automatically from all payments recorded against this project
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter italic">{inrL(totals.budget)}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Total Budget</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
              <div className={clsx('text-3xl font-black font-mono tracking-tighter italic', overrun ? 'text-red-500' : 'text-indigo-600')}>{inrL(totals.actual)}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Actual Spend (Live)</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
              <div className={clsx('text-3xl font-black font-mono tracking-tighter italic', overrun ? 'text-red-500' : 'text-emerald-600')}>{inrL(Math.abs(totals.budget - totals.actual))}</div>
              <div className={clsx('text-[10px] font-black uppercase tracking-widest mt-2 italic', overrun ? 'text-red-500' : 'text-emerald-600')}>
                {overrun ? 'Over Budget' : 'Balance Remaining'}
              </div>
            </div>
            <div className={clsx('border rounded-[2rem] p-6 text-center shadow-sm', overrunItems.length > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100')}>
              <div className={clsx('text-3xl font-black font-mono tracking-tighter italic', overrunItems.length > 0 ? 'text-red-600' : 'text-emerald-600')}>{overrunItems.length}</div>
              <div className={clsx('text-[10px] font-black uppercase tracking-widest mt-2 italic', overrunItems.length > 0 ? 'text-red-500' : 'text-emerald-600')}>Overrun Items</div>
            </div>
          </div>

          {/* Overall utilization bar */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Overall Budget Utilization</span>
              <span className={clsx('text-xl font-mono font-black italic tracking-tighter', overrun ? 'text-red-600' : 'text-emerald-600')}>
                {totals.budget > 0 ? ((totals.actual / totals.budget) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
              <div
                className={clsx('h-full rounded-full transition-all',
                  overrun ? 'bg-red-500' : totals.actual / totals.budget > 0.85 ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${Math.min(100, totals.budget > 0 ? (totals.actual / totals.budget) * 100 : 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">
              <span>₹0</span><span>{inrL(totals.budget)} Budget</span>
            </div>
          </div>

          {/* Overrun alert */}
          {overrunItems.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-[2.5rem] p-8 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 text-red-500/10 pointer-events-none scale-150 rotate-12">
                <AlertTriangle size={120} />
              </div>
              <div className="flex items-center gap-3 text-red-600 text-sm font-black uppercase tracking-widest italic relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-red-500"><AlertTriangle className="w-5 h-5" /></div>
                Budget Overrun — {overrunItems.length} Cost Head{overrunItems.length > 1 ? 's' : ''}
              </div>
              <div className="space-y-2 relative z-10">
                {overrunItems.map(i => {
                  const over = parseFloat(i.actual_amount) - parseFloat(i.budgeted_amount);
                  return (
                    <div key={i.id} className="flex items-center justify-between text-xs bg-white/60 p-3 rounded-xl border border-red-100">
                      <span className="text-red-800 font-bold uppercase tracking-tight italic">{i.cost_head}</span>
                      <div className="text-right">
                        <span className="text-red-500 font-mono font-black italic">+{inr(over)} over</span>
                        <div className="text-[10px] text-red-400">Budget {inr(i.budgeted_amount)} · Actual {inr(i.actual_amount)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unbudgeted spend warning */}
          {unbudgeted.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-6 shadow-sm">
              <div className="flex items-center gap-3 text-amber-700 text-[11px] font-black uppercase tracking-widest italic mb-4">
                <AlertTriangle size={16} className="text-amber-500" />
                Unbudgeted Spend — payments recorded with no budget line ({unbudgeted.length} cost heads)
              </div>
              <div className="space-y-2">
                {unbudgeted.map((u, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/70 p-3 rounded-xl border border-amber-100 text-xs">
                    <span className="font-bold text-amber-800 uppercase italic">{u.cost_head}</span>
                    <span className="font-mono font-black text-amber-600">{inr(u.actual_amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget Table */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Budget Lines</span>
              <span className="text-[10px] font-bold text-emerald-600 italic flex items-center gap-1">
                <Zap size={10} /> Actual column updates automatically as payments are recorded
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Cost Head', 'Budgeted', 'Actual (Live)', 'Variance', 'Utilization', ''].map(h => (
                      <th key={h} className={clsx('py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic',
                        ['Budgeted', 'Actual (Live)', 'Variance'].includes(h) ? 'text-right' : '')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading && (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-black uppercase tracking-widest italic text-[10px]">Loading...</td></tr>
                  )}
                  {budgeted.map(item => {
                    const budget   = parseFloat(item.budgeted_amount || 0);
                    const actual   = parseFloat(item.actual_amount || 0);
                    const variance = budget - actual;
                    const pct      = budget > 0 ? (actual / budget) * 100 : 0;
                    return (
                      <tr key={item.id} className={clsx('hover:bg-slate-50/50 transition-colors', pct > 100 && 'bg-red-50/30')}>
                        <td className="py-5 px-6 text-slate-900 font-black text-xs uppercase italic tracking-tight">{item.cost_head}</td>
                        <td className="py-5 px-6 font-mono text-slate-600 font-bold text-sm text-right whitespace-nowrap">{inr(budget)}</td>
                        <td className="py-5 px-6 text-right whitespace-nowrap">
                          <div className={clsx('font-mono font-black text-sm', actual > budget ? 'text-red-600' : 'text-indigo-600')}>{inr(actual)}</div>
                          <div className="text-[9px] text-emerald-500 font-bold italic">auto</div>
                        </td>
                        <td className="py-5 px-6 font-mono font-bold text-sm text-right whitespace-nowrap">
                          <span className={variance < 0 ? 'text-red-500 font-black' : 'text-emerald-500'}>
                            {variance < 0 ? '−' : '+'}{inr(Math.abs(variance))}
                          </span>
                        </td>
                        <td className="py-5 px-6 min-w-[200px]">
                          {budget > 0
                            ? <UtilBar pct={pct} />
                            : <span className="text-slate-400 text-[10px] font-black uppercase italic tracking-widest">— No budget —</span>}
                        </td>
                        <td className="py-5 px-6" onClick={e => e.stopPropagation()}>
                          <TableActions
                            onEdit={() => {
                              setForm({ cost_head: item.cost_head, budgeted_amount: item.budgeted_amount, remarks: item.remarks || '' });
                              setEditId(item.id);
                              setShowForm(true);
                            }}
                            onDelete={() => deleteMut.mutate(item.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  {budgeted.length > 0 && (
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="py-5 px-6 text-slate-900 font-black uppercase text-xs tracking-widest italic">Total</td>
                      <td className="py-5 px-6 font-mono font-black text-indigo-600 text-base text-right italic">{inr(totals.budget)}</td>
                      <td className="py-5 px-6 font-mono font-black text-base text-right italic">
                        <span className={totals.actual > totals.budget ? 'text-red-600' : 'text-indigo-600'}>{inr(totals.actual)}</span>
                      </td>
                      <td className="py-5 px-6 font-mono font-black text-base text-right italic">
                        <span className={totals.actual > totals.budget ? 'text-red-600' : 'text-emerald-600'}>
                          {totals.actual > totals.budget ? '−' : '+'}{inr(Math.abs(totals.budget - totals.actual))}
                        </span>
                      </td>
                      <td className="py-5 px-6"><UtilBar pct={totals.budget > 0 ? (totals.actual / totals.budget) * 100 : 0} /></td>
                      <td />
                    </tr>
                  )}
                  {!isLoading && budgeted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-24 text-center">
                        <PieChart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <div className="text-slate-400 font-black uppercase tracking-[0.3em] italic text-sm">No budget lines yet</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Click "Add Budget Line" to set cost head limits</div>
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
        <div className="py-32 text-center">
          <PieChart className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <div className="text-slate-400 font-black uppercase tracking-[0.3em] italic">Select a project to view budget</div>
        </div>
      )}

      {/* ── end budget tab ── */}
      </>}

      {/* ══════════════ STOCK ON HAND TAB ══════════════ */}
      {activeTab === 'stock' && (
        <div className="space-y-8">

          {/* Project filter + refresh */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-xs">
              <select
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-5 pr-10 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">— All Projects —</option>
                {(projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={() => valRefetch()}
              className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm text-slate-400 hover:text-indigo-600 transition-all"
            >
              <RefreshCw className={clsx('w-4 h-4', valLoading && 'animate-spin')} />
            </button>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-1">
              <Zap size={10} className="text-emerald-500" /> Live from Store Ledger
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
              <div className="text-3xl font-black text-indigo-600 font-mono tracking-tighter italic">{inrL(totalStockValue)}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Total Stock Value</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
              <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter italic">{totalStockItems}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Distinct Items</div>
            </div>
            {projectId && matBudgetTotal > 0 ? (
              <div className={clsx('border rounded-[2rem] p-6 text-center shadow-sm',
                totalStockValue > matBudgetTotal ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
              )}>
                <div className={clsx('text-3xl font-black font-mono tracking-tighter italic',
                  totalStockValue > matBudgetTotal ? 'text-amber-600' : 'text-emerald-600'
                )}>
                  {matBudgetTotal > 0 ? ((totalStockValue / matBudgetTotal) * 100).toFixed(0) : 0}%
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">of Material Budget</div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
                <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter italic">
                  {projectRollup.length}
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Projects with Stock</div>
              </div>
            )}
          </div>

          {/* Material Budget vs Stock Value — shown when project is selected and has material budget */}
          {projectId && matBudgetTotal > 0 && (
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">Material Budget vs Stock on Hand</span>
                <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="w-3 h-1.5 rounded bg-slate-200 inline-block" />Budget {inrL(matBudgetTotal)}</span>
                  <span className="flex items-center gap-1.5 text-indigo-600"><span className="w-3 h-1.5 rounded bg-indigo-500 inline-block" />Stock {inrL(totalStockValue)}</span>
                </div>
              </div>
              <div className="space-y-3">
                {/* Budget bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-1.5">
                    <span>Material Budget</span><span>{inr(matBudgetTotal)}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-slate-300" style={{ width: '100%' }} /></div>
                </div>
                {/* Stock bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-black text-indigo-500 uppercase tracking-widest italic mb-1.5">
                    <span>Current Stock Value</span><span>{inr(totalStockValue)}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full transition-all', totalStockValue > matBudgetTotal ? 'bg-amber-500' : 'bg-indigo-500')}
                      style={{ width: `${Math.min(100, matBudgetTotal > 0 ? (totalStockValue / matBudgetTotal) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-4">
                Stock on Hand is the current inventory value from Store Ledger. Material Budget is the sum of all Material cost head budgets for this project.
              </p>
            </div>
          )}

          {/* All-projects table (when no project selected) */}
          {!projectId && (
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Stock Value by Project</span>
                <span className="text-[10px] text-slate-400 font-bold italic">All projects · closing stock × unit rate</span>
              </div>
              {valLoading ? (
                <div className="py-16 text-center text-slate-400 font-black uppercase tracking-widest italic text-[10px]">Loading...</div>
              ) : projectRollup.length === 0 ? (
                <div className="py-16 text-center">
                  <Warehouse className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <div className="text-slate-400 font-black uppercase tracking-widest italic text-sm">No inventory data found</div>
                  <div className="text-[10px] text-slate-400 mt-2">Import stock data in Store Ledger first</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Project', 'Items', 'Stock Value', '% of Total', ''].map(h => (
                          <th key={h} className={clsx('py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic',
                            ['Items', 'Stock Value'].includes(h) && 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectRollup.map(p => {
                        const pct = totalStockValue > 0 ? (p.stock_value / totalStockValue) * 100 : 0;
                        return (
                          <tr key={p.project_id} className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                            onClick={() => setProjectId(p.project_id)}>
                            <td className="py-4 px-6 text-slate-900 font-black text-xs uppercase italic tracking-tight">{p.project_name}</td>
                            <td className="py-4 px-6 font-mono text-slate-600 font-bold text-sm text-right">{p.item_count}</td>
                            <td className="py-4 px-6 font-mono font-black text-indigo-600 text-sm text-right whitespace-nowrap">{inr(p.stock_value)}</td>
                            <td className="py-4 px-6 min-w-[160px]"><ValueBar pct={pct} /></td>
                            <td className="py-4 px-6 text-slate-300 hover:text-indigo-500 transition-colors"><ChevronRight className="w-4 h-4" /></td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="py-4 px-6 font-black text-slate-900 uppercase text-xs italic tracking-widest">Total</td>
                        <td className="py-4 px-6 font-mono font-black text-slate-900 text-sm text-right">{totalStockItems}</td>
                        <td className="py-4 px-6 font-mono font-black text-indigo-600 text-base text-right italic">{inr(totalStockValue)}</td>
                        <td /><td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Category breakdown (when project selected) */}
          {projectId && (
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Category Breakdown</span>
                <button onClick={() => setProjectId('')} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest italic">
                  ← All Projects
                </button>
              </div>
              {valLoading ? (
                <div className="py-16 text-center text-slate-400 font-black uppercase tracking-widest italic text-[10px]">Loading...</div>
              ) : valuationRows.length === 0 ? (
                <div className="py-16 text-center">
                  <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <div className="text-slate-400 font-black uppercase tracking-widest italic text-sm">No stock data for this project</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Category', 'Items', 'Total Qty', 'Stock Value', '% of Total', ''].map(h => (
                          <th key={h} className={clsx('py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic',
                            ['Items', 'Total Qty', 'Stock Value'].includes(h) && 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {valuationRows.map((row, i) => {
                        const pct = totalStockValue > 0 ? (parseFloat(row.stock_value) / totalStockValue) * 100 : 0;
                        const colors = ['bg-indigo-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500'];
                        return (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 text-slate-900 font-black text-xs uppercase italic tracking-tight">{row.category}</td>
                            <td className="py-4 px-6 font-mono text-slate-600 font-bold text-sm text-right">{row.item_count}</td>
                            <td className="py-4 px-6 font-mono text-slate-600 font-bold text-sm text-right">{Number(row.total_qty || 0).toFixed(2)}</td>
                            <td className="py-4 px-6 font-mono font-black text-indigo-600 text-sm text-right whitespace-nowrap">{inr(row.stock_value)}</td>
                            <td className="py-4 px-6 min-w-[160px]"><ValueBar pct={pct} color={colors[i % colors.length]} /></td>
                            <td />
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="py-4 px-6 font-black text-slate-900 uppercase text-xs italic tracking-widest">Total</td>
                        <td className="py-4 px-6 font-mono font-black text-slate-900 text-sm text-right">{totalStockItems}</td>
                        <td className="py-4 px-6 font-mono font-black text-slate-900 text-sm text-right">
                          {valuationRows.reduce((s, r) => s + parseFloat(r.total_qty || 0), 0).toFixed(2)}
                        </td>
                        <td className="py-4 px-6 font-mono font-black text-indigo-600 text-base text-right italic">{inr(totalStockValue)}</td>
                        <td /><td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400 italic text-center pb-4">
            Stock values are read-only — sourced directly from Store Ledger (closing qty × unit rate). No journal entries are posted automatically at this stage.
          </p>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between p-8 bg-slate-50 border-b border-slate-100">
              <h2 className="font-black text-xl text-slate-900 uppercase tracking-tight italic">
                {editId ? 'Edit Budget Line' : 'Add Budget Line'}
              </h2>
              <button onClick={resetForm} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 text-slate-400 hover:text-slate-900 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Cost Head *</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic"
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
                {editId && <p className="text-[10px] text-slate-400 italic">Cost head cannot be changed after creation.</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Budget Limit (₹) *</label>
                <input
                  type="number"
                  className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0.00"
                  value={form.budgeted_amount}
                  onChange={e => setForm(p => ({ ...p, budgeted_amount: e.target.value }))}
                />
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-[11px] text-indigo-600 font-bold italic">
                ⚡ Actual spend will be calculated automatically from payments tagged to this cost head — no manual entry needed.
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Remarks</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="Optional notes..."
                  value={form.remarks}
                  onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                />
              </div>
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button onClick={resetForm} className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-sm italic">
                  Cancel
                </button>
                <button
                  onClick={() => editId
                    ? updateMutation.mutate({ id: editId, d: form })
                    : createMutation.mutate(form)
                  }
                  disabled={createMutation.isPending || updateMutation.isPending || !form.cost_head || !form.budgeted_amount}
                  className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30 italic"
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
