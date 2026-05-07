// ============================================================
// frontend/src/pages/ClientInvoices.jsx
// AR invoice listing: milestone billing, receipt tracking, aging
// ============================================================
import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const dateFmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_META = {
  DRAFT:          { label: "Draft",        color: "bg-gray-100 text-gray-500" },
  SUBMITTED:      { label: "Submitted",    color: "bg-sky-100 text-sky-700" },
  APPROVED:       { label: "Approved",     color: "bg-green-100 text-green-700" },
  PARTIALLY_PAID: { label: "Part Paid",    color: "bg-violet-100 text-violet-700" },
  PAID:           { label: "Paid ✓",       color: "bg-emerald-100 text-emerald-700" },
  REJECTED:       { label: "Rejected",     color: "bg-red-100 text-red-700" },
  CANCELLED:      { label: "Cancelled",    color: "bg-gray-100 text-gray-400" },
};

// Aging bucket colors
const agingColor = (days) => {
  if (days <= 0) return "text-green-600";
  if (days <= 30) return "text-yellow-600";
  if (days <= 60) return "text-orange-600";
  return "text-red-600";
};

export default function ClientInvoices({ onNewInvoice, onRecordReceipt }) {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [agingSummary, setAgingSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("invoices"); // "invoices" | "aging"
  const LIMIT = 15;

  const token = () => localStorage.getItem("erp_token");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      type: "CLIENT_INVOICE",
      page: String(page),
      limit: String(LIMIT),
      ...(statusFilter !== "ALL" && { status: statusFilter }),
      ...(projectFilter && { projectId: projectFilter }),
      ...(clientFilter && { clientId: clientFilter }),
    });
    try {
      const res = await fetch(`${API}/invoices?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setInvoices(data.data || []);
      setTotal(data.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, projectFilter, clientFilter]);

  const fetchAgingSummary = useCallback(async () => {
    const res = await fetch(`${API}/invoices/outstanding/ar`, { headers: { Authorization: `Bearer ${token()}` } });
    const data = await res.json();
    // Build aging buckets
    const today = new Date();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
    const byClient = {};
    for (const inv of data) {
      const days = Math.floor((today - new Date(inv.dueDate)) / 86400000);
      const balance = Number(inv.balanceDue);
      if (days <= 0) buckets.current += balance;
      else if (days <= 30) buckets.d30 += balance;
      else if (days <= 60) buckets.d60 += balance;
      else if (days <= 90) buckets.d90 += balance;
      else buckets.over90 += balance;

      const cid = inv.clientId;
      if (!byClient[cid]) byClient[cid] = { name: inv.client?.name, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
      byClient[cid][days <= 0 ? "current" : days <= 30 ? "d30" : days <= 60 ? "d60" : days <= 90 ? "d90" : "over90"] += balance;
      byClient[cid].total += balance;
    }
    setAgingSummary({ buckets, byClient: Object.values(byClient), rawInvoices: data });
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchAgingSummary(); }, [fetchAgingSummary]);

  useEffect(() => {
    const h = { Authorization: `Bearer ${token()}` };
    Promise.all([
      fetch(`${API}/projects?limit=100`, { headers: h }).then(r => r.json()),
      fetch(`${API}/clients?limit=100`, { headers: h }).then(r => r.json()),
    ]).then(([p, c]) => {
      setProjects(p.data || p || []);
      setClients(c.data || []);
    });
  }, []);

  const totalBilled = invoices.reduce((s, i) => s + Number(i.grandTotal), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.balanceDue || 0), 0);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Client Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} invoices · {fmt(totalBilled)} billed · {fmt(totalOutstanding)} outstanding
          </p>
        </div>
        <button
          onClick={onNewInvoice}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm"
        >
          + Raise Invoice
        </button>
      </div>

      {/* Aging Summary Cards */}
      {agingSummary && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Current", key: "current", color: "border-green-200 bg-green-50", text: "text-green-700" },
            { label: "1–30 Days", key: "d30", color: "border-yellow-200 bg-yellow-50", text: "text-yellow-700" },
            { label: "31–60 Days", key: "d60", color: "border-orange-200 bg-orange-50", text: "text-orange-700" },
            { label: "61–90 Days", key: "d90", color: "border-red-200 bg-red-50", text: "text-red-700" },
            { label: "90+ Days", key: "over90", color: "border-red-300 bg-red-100", text: "text-red-800" },
          ].map(({ label, key, color, text }) => (
            <div key={key} className={`rounded-xl border p-4 ${color}`}>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className={`text-lg font-bold mt-1 ${text}`}>{fmt(agingSummary.buckets[key])}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab + Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {["invoices", "aging"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {tab === "invoices" ? "📋 Invoices" : "📊 AR Aging"}
            </button>
          ))}
        </div>

        {activeTab === "invoices" && (
          <div className="flex gap-2 flex-wrap">
            {["ALL", "APPROVED", "PARTIALLY_PAID", "PAID", "DRAFT"].map(f => (
              <button key={f} onClick={() => { setStatusFilter(f); setPage(1); }}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${statusFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                {f === "ALL" ? "All" : STATUS_META[f]?.label || f}
              </button>
            ))}
            <select value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600">
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Invoices Table */}
      {activeTab === "invoices" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                Loading...
              </div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-sm font-medium">No client invoices found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Project</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Invoice Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Billed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Received</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map(inv => {
                  const meta = STATUS_META[inv.status] || STATUS_META.DRAFT;
                  const today = new Date();
                  const daysPastDue = Math.floor((today - new Date(inv.dueDate)) / 86400000);
                  const paidAmount = Number(inv.grandTotal) - Number(inv.balanceDue);
                  const pct = Number(inv.grandTotal) > 0
                    ? Math.round((paidAmount / Number(inv.grandTotal)) * 100) : 0;

                  return (
                    <tr key={inv.id} className="hover:bg-green-50/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-green-700 font-medium">{inv.invoiceNumber}</span>
                        {inv.narration && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-32">{inv.narration}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{inv.client?.name || "—"}</div>
                        <div className="text-xs text-gray-400">{inv.client?.clientCode}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-32 truncate">
                        {inv.project?.name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600">{dateFmt(inv.invoiceDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium ${agingColor(daysPastDue)}`}>
                          {dateFmt(inv.dueDate)}
                          {daysPastDue > 0 && (
                            <span className="block text-xs">({daysPastDue}d overdue)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(inv.grandTotal)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-right">
                          <span className="text-emerald-700 font-medium">{fmt(paidAmount)}</span>
                          {pct > 0 && pct < 100 && (
                            <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                              <div className="bg-emerald-400 h-1 rounded-full" style={{ width: `${pct}%` }}></div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${Number(inv.balanceDue) > 0 ? "text-orange-700" : "text-gray-400"}`}>
                          {fmt(inv.balanceDue)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {["APPROVED", "PARTIALLY_PAID"].includes(inv.status) && Number(inv.balanceDue) > 0 && (
                          <button
                            onClick={() => onRecordReceipt?.(inv)}
                            className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                          >
                            Record Receipt
                          </button>
                        )}
                        {inv.status === "DRAFT" && (
                          <button className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                            Submit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} total</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-white disabled:opacity-40">← Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-white disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AR Aging Tab */}
      {activeTab === "aging" && agingSummary && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Accounts Receivable Aging — Client-wise</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 uppercase">Current</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-yellow-600 uppercase">1–30 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-orange-600 uppercase">31–60 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-600 uppercase">61–90 Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-800 uppercase">90+ Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {agingSummary.byClient.sort((a, b) => b.total - a.total).map((client, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{client.name}</td>
                  <td className="px-4 py-3 text-right text-green-600">{client.current > 0 ? fmt(client.current) : "—"}</td>
                  <td className="px-4 py-3 text-right text-yellow-600">{client.d30 > 0 ? fmt(client.d30) : "—"}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{client.d60 > 0 ? fmt(client.d60) : "—"}</td>
                  <td className="px-4 py-3 text-right text-red-600">{client.d90 > 0 ? fmt(client.d90) : "—"}</td>
                  <td className="px-4 py-3 text-right text-red-800 font-medium">{client.over90 > 0 ? fmt(client.over90) : "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(client.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Total</td>
                {["current", "d30", "d60", "d90", "over90"].map(k => (
                  <td key={k} className="px-4 py-3 text-right text-xs font-bold text-gray-800">
                    {fmt(agingSummary.buckets[k])}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  {fmt(Object.values(agingSummary.buckets).reduce((s, v) => s + v, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
