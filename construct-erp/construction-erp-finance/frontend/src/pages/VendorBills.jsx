// ============================================================
// frontend/src/pages/VendorBills.jsx
// AP invoice listing: filter, sort, approve, pay, export
// ============================================================
import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const dateFmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_META = {
  DRAFT:               { label: "Draft",         color: "bg-gray-100 text-gray-600",      dot: "bg-gray-400" },
  SUBMITTED:           { label: "Submitted",      color: "bg-blue-100 text-blue-700",      dot: "bg-blue-500" },
  PENDING_APPROVAL_L1: { label: "Pending L1",     color: "bg-yellow-100 text-yellow-700",  dot: "bg-yellow-500" },
  PENDING_APPROVAL_L2: { label: "Pending L2",     color: "bg-orange-100 text-orange-700",  dot: "bg-orange-500" },
  PENDING_APPROVAL_L3: { label: "Pending L3",     color: "bg-orange-100 text-orange-700",  dot: "bg-orange-600" },
  APPROVED:            { label: "Approved",        color: "bg-green-100 text-green-700",    dot: "bg-green-500" },
  REJECTED:            { label: "Rejected",        color: "bg-red-100 text-red-700",        dot: "bg-red-500" },
  PARTIALLY_PAID:      { label: "Partial",         color: "bg-indigo-100 text-indigo-700",  dot: "bg-indigo-400" },
  PAID:                { label: "Paid",            color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-500" },
  CANCELLED:           { label: "Cancelled",       color: "bg-gray-100 text-gray-400",      dot: "bg-gray-300" },
};

const FILTERS = ["ALL", "DRAFT", "PENDING_APPROVAL_L1", "PENDING_APPROVAL_L2", "APPROVED", "PARTIALLY_PAID", "PAID"];

export default function VendorBills({ onNewInvoice, onPayInvoice }) {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const LIMIT = 15;

  const token = () => localStorage.getItem("erp_token");
  const headers = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      type: "VENDOR_INVOICE",
      page: String(page),
      limit: String(LIMIT),
      ...(statusFilter !== "ALL" && { status: statusFilter }),
      ...(projectFilter && { projectId: projectFilter }),
    });
    try {
      const res = await fetch(`${API}/invoices?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setInvoices(data.data || []);
      setTotal(data.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, projectFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    fetch(`${API}/projects?limit=100`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setProjects(data.data || data || []));
  }, []);

  const doAction = async (invoiceId, action, body = {}) => {
    setActionLoading(invoiceId + action);
    try {
      const res = await fetch(`${API}/invoices/${invoiceId}/${action}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error || "Action failed");
        return;
      }
      await fetchInvoices();
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedData || expandedData.id !== id) {
      const res = await fetch(`${API}/invoices/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      setExpandedData(await res.json());
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    selected.size === invoices.length ? setSelected(new Set()) : setSelected(new Set(invoices.map(i => i.id)));
  };

  const totalPages = Math.ceil(total / LIMIT);

  // Aggregate stats for current filter
  const totalAmount = invoices.reduce((s, i) => s + Number(i.grandTotal), 0);
  const totalDue = invoices.reduce((s, i) => s + Number(i.balanceDue || 0), 0);

  const overdueCount = invoices.filter(i =>
    ["APPROVED", "PARTIALLY_PAID"].includes(i.status) && new Date(i.dueDate) < new Date()
  ).length;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendor Bills</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} invoices · {fmt(totalAmount)} total · {fmt(totalDue)} outstanding
            {overdueCount > 0 && <span className="ml-2 text-red-600 font-medium">· {overdueCount} overdue ⚠️</span>}
          </p>
        </div>
        <button
          onClick={onNewInvoice}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
        >
          + New Vendor Bill
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                statusFilter === f ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f === "ALL" ? "All" : STATUS_META[f]?.label || f}
            </button>
          ))}
        </div>

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {selected.size > 0 && (
          <div className="ml-auto flex gap-2">
            <span className="text-xs text-gray-500 self-center">{selected.size} selected</span>
            <button className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Bulk Approve
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm">Loading invoices...</p>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-4xl mb-3">📄</p>
            <p className="text-sm font-medium">No invoices found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selected.size === invoices.length} onChange={selectAll} className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Project</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Due</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Balance Due</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map(inv => {
                const meta = STATUS_META[inv.status] || STATUS_META.DRAFT;
                const isOverdue = ["APPROVED", "PARTIALLY_PAID"].includes(inv.status) && new Date(inv.dueDate) < new Date();
                const isExpanded = expandedId === inv.id;
                const loading = actionLoading?.startsWith(inv.id);

                return (
                  <>
                    <tr
                      key={inv.id}
                      className={`hover:bg-blue-50/30 transition-colors ${isExpanded ? "bg-blue-50/20" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <button onClick={() => toggleExpand(inv.id)} className="font-mono text-blue-700 hover:text-blue-900 text-left font-medium">
                            {inv.invoiceNumber}
                          </button>
                          {inv.externalInvoiceNo && (
                            <span className="text-xs text-gray-400 mt-0.5">Ref: {inv.externalInvoiceNo}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{inv.vendor?.name || "—"}</div>
                        <div className="text-xs text-gray-400">{inv.vendor?.vendorCode}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {inv.project?.name || <span className="text-gray-300">No project</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 text-xs">{dateFmt(inv.invoiceDate)}</td>
                      <td className={`px-4 py-3 text-center text-xs font-medium ${isOverdue ? "text-red-600" : "text-gray-600"}`}>
                        {dateFmt(inv.dueDate)}
                        {isOverdue && <span className="block text-red-500">OVERDUE</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(inv.grandTotal)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${Number(inv.balanceDue) > 0 ? "text-orange-700" : "text-green-600"}`}>
                          {fmt(inv.balanceDue)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* Context-aware action buttons */}
                          {inv.status === "DRAFT" && (
                            <button
                              onClick={() => doAction(inv.id, "submit")}
                              disabled={loading}
                              className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Submit
                            </button>
                          )}
                          {["PENDING_APPROVAL_L1", "PENDING_APPROVAL_L2", "PENDING_APPROVAL_L3"].includes(inv.status) && (
                            <>
                              <button
                                onClick={() => doAction(inv.id, "approve", { comments: "Approved" })}
                                disabled={loading}
                                className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt("Rejection reason:");
                                  if (reason) doAction(inv.id, "reject", { reason });
                                }}
                                disabled={loading}
                                className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </>
                          )}
                          {["APPROVED", "PARTIALLY_PAID"].includes(inv.status) && Number(inv.balanceDue) > 0 && (
                            <button
                              onClick={() => onPayInvoice?.(inv)}
                              className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => toggleExpand(inv.id)}
                            className="text-xs px-2 py-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
                            title="View details"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && expandedData?.id === inv.id && (
                      <tr key={`${inv.id}-detail`} className="bg-blue-50/30">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Line Items */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Line Items</h4>
                              <table className="w-full text-xs">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="text-left pb-1">Description</th>
                                    <th className="text-right pb-1">Qty</th>
                                    <th className="text-right pb-1">Rate</th>
                                    <th className="text-right pb-1">GST</th>
                                    <th className="text-right pb-1">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(expandedData.lineItems || []).map((li, i) => (
                                    <tr key={i} className="border-t border-blue-100">
                                      <td className="py-1 pr-2">{li.description}</td>
                                      <td className="py-1 text-right">{li.quantity} {li.unit}</td>
                                      <td className="py-1 text-right">{fmt(li.unitRate)}</td>
                                      <td className="py-1 text-right">{li.gstRate}%</td>
                                      <td className="py-1 text-right font-medium">{fmt(li.lineTotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Tax Summary + Workflow */}
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Tax Summary</h4>
                                <div className="space-y-1 text-xs">
                                  {[
                                    ["Sub Total", expandedData.subTotal],
                                    ["CGST", expandedData.cgstAmount],
                                    ["SGST", expandedData.sgstAmount],
                                    ["IGST", expandedData.igstAmount],
                                    ["TDS Deducted", expandedData.tdsAmount ? `-${fmt(expandedData.tdsAmount)}` : null],
                                    ["Grand Total", expandedData.grandTotal],
                                    ["Balance Due", expandedData.balanceDue],
                                  ].filter(([, v]) => v && Number(v) !== 0).map(([label, val]) => (
                                    <div key={label} className="flex justify-between">
                                      <span className="text-gray-500">{label}</span>
                                      <span className={`font-medium ${label === "Balance Due" ? "text-orange-700" : label === "Grand Total" ? "text-gray-900" : "text-gray-700"}`}>
                                        {typeof val === "string" ? val : fmt(val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Workflow log */}
                              {expandedData.workflowLogs?.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Approval Trail</h4>
                                  <div className="space-y-1.5">
                                    {expandedData.workflowLogs.slice(0, 4).map((log, i) => (
                                      <div key={i} className="flex items-start gap-2 text-xs">
                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] flex-shrink-0 mt-0.5 ${
                                          log.action === "APPROVE" ? "bg-green-500" :
                                          log.action === "REJECT" ? "bg-red-500" :
                                          "bg-blue-400"
                                        }`}>
                                          {log.action === "APPROVE" ? "✓" : log.action === "REJECT" ? "✕" : "→"}
                                        </span>
                                        <div>
                                          <span className="font-medium text-gray-700">{log.user?.fullName}</span>
                                          <span className="text-gray-400 ml-1">{log.action.toLowerCase()}</span>
                                          {log.comments && <p className="text-gray-400 italic">{log.comments}</p>}
                                          <p className="text-gray-300">{dateFmt(log.performedAt)}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-white disabled:opacity-40"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-7 text-xs rounded ${p === page ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-white"}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-white disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
