// ============================================================
// frontend/src/pages/BudgetTracker.jsx
// Project budget vs actual cost with variance analysis & alerts
// ============================================================
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
const fmt = (n) => new Intl.NumberFormat("en-IN", { notation: "compact", style: "currency", currency: "INR", maximumFractionDigits: 1 }).format(n || 0);
const fmtFull = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const COST_HEAD_COLORS = {
  MATERIAL:      { bar: "#3B82F6", bg: "bg-blue-100",    text: "text-blue-800",    icon: "🧱" },
  LABOR:         { bar: "#10B981", bg: "bg-emerald-100", text: "text-emerald-800", icon: "👷" },
  EQUIPMENT:     { bar: "#F59E0B", bg: "bg-amber-100",   text: "text-amber-800",   icon: "🏗️" },
  SUBCONTRACTOR: { bar: "#8B5CF6", bg: "bg-violet-100",  text: "text-violet-800",  icon: "🤝" },
  OVERHEAD:      { bar: "#6B7280", bg: "bg-gray-100",    text: "text-gray-700",    icon: "📋" },
  CONTINGENCY:   { bar: "#EC4899", bg: "bg-pink-100",    text: "text-pink-800",    icon: "🛡️" },
};

function UtilizationBar({ value, isAtRisk, isOverBudget }) {
  const color = isOverBudget ? "bg-red-500" : isAtRisk ? "bg-amber-500" : value > 50 ? "bg-blue-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-10 text-right ${isOverBudget ? "text-red-600" : isAtRisk ? "text-amber-600" : "text-gray-700"}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

export default function BudgetTracker() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [budget, setBudget] = useState(null);
  const [projectAnalysis, setProjectAnalysis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("detail"); // "detail" | "overview"
  const [showReviseModal, setShowReviseModal] = useState(false);

  const token = () => localStorage.getItem("erp_token");
  const h = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    Promise.all([
      fetch(`${API}/projects?limit=100`, { headers: h() }).then(r => r.json()),
      fetch(`${API}/reports/project-cost-analysis`, { headers: h() }).then(r => r.json()),
    ]).then(([p, analysis]) => {
      const list = p.data || p || [];
      setProjects(list);
      setProjectAnalysis(analysis || []);
      if (list.length > 0) setSelectedProject(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`${API}/budgets/project/${selectedProject}/summary`, { headers: h() })
      .then(r => r.json())
      .then(data => setBudget(data))
      .catch(() => setBudget(null))
      .finally(() => setLoading(false));
  }, [selectedProject]);

  const chartData = budget?.costHeads?.map(ch => ({
    name: ch.costHead,
    Planned: ch.planned / 1e7,
    Actual: ch.actual / 1e7,
    Committed: ch.committed / 1e7,
  })) || [];

  const overBudgetHeads = budget?.costHeads?.filter(ch => ch.isOverBudget) || [];
  const atRiskHeads = budget?.costHeads?.filter(ch => ch.isAtRisk && !ch.isOverBudget) || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Budget Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">Project cost control & variance analysis</p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={selectedProject || ""}
            onChange={e => setSelectedProject(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-56"
          >
            <option value="">Select Project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {["detail", "overview"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                {t === "detail" ? "📊 Detail" : "🗂️ Overview"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(overBudgetHeads.length > 0 || atRiskHeads.length > 0) && (
        <div className="space-y-2">
          {overBudgetHeads.map(ch => (
            <div key={ch.costHead} className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-red-500">🚨</span>
              <span className="text-red-800 font-medium">{COST_HEAD_COLORS[ch.costHead]?.icon} {ch.costHead}</span>
              <span className="text-red-700">Budget exceeded by {fmtFull(ch.actual - ch.planned)}</span>
              <button onClick={() => setShowReviseModal(true)} className="ml-auto text-xs bg-red-600 text-white px-3 py-1 rounded-full hover:bg-red-700">
                Request Revision
              </button>
            </div>
          ))}
          {atRiskHeads.map(ch => (
            <div key={ch.costHead} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm">
              <span>⚠️</span>
              <span className="text-amber-800 font-medium">{COST_HEAD_COLORS[ch.costHead]?.icon} {ch.costHead}</span>
              <span className="text-amber-700">{ch.utilization.toFixed(1)}% utilized — at risk of overrun</span>
            </div>
          ))}
        </div>
      )}

      {/* Project Overview Tab */}
      {tab === "overview" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">All Projects — Budget vs Actual (₹ Crore)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Project</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Contract Value</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Budget</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actual Spend</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Variance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-48">Utilization</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {projectAnalysis.map((p, i) => {
                const pct = p.budget > 0 ? (p.actual / p.budget) * 100 : 0;
                const isOver = p.actual > p.budget;
                return (
                  <tr key={i} className="hover:bg-blue-50/20 cursor-pointer" onClick={() => {
                    const proj = projects.find(pr => pr.projectCode === p.projectCode);
                    if (proj) { setSelectedProject(proj.id); setTab("detail"); }
                  }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.projectCode}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.contractValue)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.budget)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(p.actual)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isOver ? "text-red-600" : "text-green-600"}`}>
                      {isOver ? "–" : "+"}{fmt(Math.abs(p.variance))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${pct > 100 ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className={`text-xs font-medium w-10 text-right ${pct > 100 ? "text-red-600" : "text-gray-600"}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Tab */}
      {tab === "detail" && (
        loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm">Loading budget...</p>
            </div>
          </div>
        ) : !budget ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-xl border border-gray-100">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm font-medium">No approved budget found for this project</p>
            <button className="mt-3 text-xs text-blue-600 hover:text-blue-800">Create Budget →</button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Budget", value: budget.totalBudget, sub: `v${budget.version}`, color: "bg-blue-50 border-blue-100", textColor: "text-blue-700" },
                { label: "Actual Spend", value: budget.totalActual, sub: `${budget.overallUtilization?.toFixed(1)}% utilized`, color: "bg-amber-50 border-amber-100", textColor: "text-amber-700" },
                { label: "Committed", value: budget.totalCommitted, sub: "PO commitments", color: "bg-violet-50 border-violet-100", textColor: "text-violet-700" },
                {
                  label: "Available",
                  value: budget.totalBudget - budget.totalActual - budget.totalCommitted,
                  sub: budget.totalBudget > 0 ? `${(((budget.totalBudget - budget.totalActual - budget.totalCommitted) / budget.totalBudget) * 100).toFixed(1)}% free` : "",
                  color: "bg-emerald-50 border-emerald-100",
                  textColor: "text-emerald-700"
                },
              ].map(({ label, value, sub, color, textColor }) => (
                <div key={label} className={`rounded-xl border p-4 ${color}`}>
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${textColor}`}>{fmtFull(value)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Cost Head Comparison (₹ Crore)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={v => `₹${v}Cr`} />
                  <Tooltip
                    formatter={(v, n) => [`₹${(v * 1e7 / 1e7).toFixed(2)} Cr`, n]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Planned" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, idx) => {
                      const ch = budget.costHeads[idx];
                      return <Cell key={idx} fill={ch?.isOverBudget ? "#EF4444" : ch?.isAtRisk ? "#F59E0B" : "#3B82F6"} />;
                    })}
                  </Bar>
                  <Bar dataKey="Committed" fill="#C4B5FD" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cost Head Detail Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Cost Head Breakdown</h3>
                <p className="text-xs text-gray-400">{budget.project?.name} · Budget #{budget.budgetNumber}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cost Head</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Planned</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actual</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Committed</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Available</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Variance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-40">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(budget.costHeads || []).map(ch => {
                    const meta = COST_HEAD_COLORS[ch.costHead] || COST_HEAD_COLORS.OVERHEAD;
                    return (
                      <tr key={ch.costHead} className={`${ch.isOverBudget ? "bg-red-50/40" : ch.isAtRisk ? "bg-amber-50/40" : "hover:bg-gray-50/60"} transition-colors`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.bg} ${meta.text}`}>
                              {meta.icon} {ch.costHead}
                            </span>
                            {ch.isOverBudget && <span className="text-red-500 text-xs">🔴 Over</span>}
                            {ch.isAtRisk && !ch.isOverBudget && <span className="text-amber-500 text-xs">⚠️ Risk</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 pl-0.5">{ch.description}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtFull(ch.planned)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${ch.isOverBudget ? "text-red-700" : "text-gray-900"}`}>
                          {fmtFull(ch.actual)}
                        </td>
                        <td className="px-4 py-3 text-right text-violet-700">{fmtFull(ch.committed)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${ch.available < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {fmtFull(ch.available)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${ch.variance < 0 ? "text-red-600" : "text-green-600"}`}>
                          {ch.variance < 0 ? "–" : "+"}{fmtFull(Math.abs(ch.variance))}
                        </td>
                        <td className="px-4 py-3">
                          <UtilizationBar value={ch.utilization} isAtRisk={ch.isAtRisk} isOverBudget={ch.isOverBudget} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-800">{fmtFull(budget.totalBudget)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtFull(budget.totalActual)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-violet-700">{fmtFull(budget.totalCommitted)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">
                      {fmtFull(budget.totalBudget - budget.totalActual - budget.totalCommitted)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${budget.totalVariance < 0 ? "text-red-600" : "text-green-600"}`}>
                      {budget.totalVariance < 0 ? "–" : "+"}{fmtFull(Math.abs(budget.totalVariance))}
                    </td>
                    <td className="px-4 py-3">
                      <UtilizationBar value={budget.overallUtilization || 0} isAtRisk={budget.overallUtilization > 85} isOverBudget={budget.overallUtilization > 100} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
