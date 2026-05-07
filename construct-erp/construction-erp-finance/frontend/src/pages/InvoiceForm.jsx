// ============================================================
// frontend/src/pages/InvoiceForm.jsx
// Invoice creation form: AP (Vendor) and AR (Client)
// ============================================================
import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

const GST_RATES = [0, 5, 12, 18, 28];
const COST_HEADS = ["MATERIAL", "LABOR", "EQUIPMENT", "SUBCONTRACTOR", "OVERHEAD"];
const TDS_SECTIONS = [
  { code: "SEC_194C", label: "194C – Contractor (2%)" },
  { code: "SEC_194J", label: "194J – Professional (10%)" },
  { code: "SEC_194I", label: "194I – Rent (10%)" },
  { code: "SEC_194Q", label: "194Q – Purchase of Goods (0.1%)" },
  { code: "NOT_APPLICABLE", label: "Not Applicable" },
];
const TDS_RATES = { SEC_194C: 2, SEC_194J: 10, SEC_194I: 10, SEC_194Q: 0.1, NOT_APPLICABLE: 0 };

const emptyLine = () => ({
  description: "",
  quantity: 1,
  unit: "Nos",
  unitRate: 0,
  gstType: "CGST",
  gstRate: 18,
  hsnCode: "",
  costHead: "MATERIAL",
});

const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function InvoiceForm({ onSuccess, onCancel, editData = null }) {
  const [type, setType] = useState("VENDOR_INVOICE");
  const [form, setForm] = useState({
    externalInvoiceNo: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    narration: "",
    retentionPct: 0,
    tdsSection: "SEC_194C",
    tdsRate: 2,
    projectId: "",
    vendorId: "",
    clientId: "",
    poId: "",
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [vendors, setVendors] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const token = localStorage.getItem("erp_token");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/vendors?limit=100`, { headers }).then(r => r.json()),
      fetch(`${API}/clients?limit=100`, { headers }).then(r => r.json()),
      fetch(`${API}/projects?limit=100`, { headers }).then(r => r.json()),
    ]).then(([v, c, p]) => {
      setVendors(v.data || []);
      setClients(c.data || []);
      setProjects(p.data || p || []);
    });
  }, []);

  // Auto-calculate due date based on vendor payment terms
  useEffect(() => {
    if (form.invoiceDate) {
      const vendor = vendors.find(v => v.id === form.vendorId);
      const terms = vendor?.paymentTerms || 30;
      const due = new Date(form.invoiceDate);
      due.setDate(due.getDate() + terms);
      setForm(f => ({ ...f, dueDate: due.toISOString().slice(0, 10) }));
    }
  }, [form.vendorId, form.invoiceDate]);

  // Totals calculation
  const calcTotals = () => {
    let subTotal = 0, cgst = 0, sgst = 0, igst = 0;
    for (const line of lines) {
      const base = Number(line.quantity) * Number(line.unitRate);
      subTotal += base;
      if (line.gstType === "IGST") igst += base * Number(line.gstRate) / 100;
      else if (line.gstType !== "EXEMPT") {
        cgst += base * Number(line.gstRate) / 2 / 100;
        sgst += base * Number(line.gstRate) / 2 / 100;
      }
    }
    const totalGst = cgst + sgst + igst;
    const tdsAmount = subTotal * Number(form.tdsRate) / 100;
    const retentionAmount = (subTotal + totalGst) * Number(form.retentionPct) / 100;
    const grandTotal = subTotal + totalGst;
    return { subTotal, cgst, sgst, igst, totalGst, tdsAmount, retentionAmount, grandTotal };
  };

  const totals = calcTotals();

  const updateLine = (idx, field, value) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const e = {};
    if (type === "VENDOR_INVOICE" && !form.vendorId) e.vendorId = "Select a vendor";
    if (type === "CLIENT_INVOICE" && !form.clientId) e.clientId = "Select a client";
    if (!form.invoiceDate) e.invoiceDate = "Invoice date required";
    if (!form.dueDate) e.dueDate = "Due date required";
    if (lines.some(l => !l.description)) e.lines = "All line items need a description";
    if (lines.some(l => Number(l.unitRate) <= 0)) e.rates = "Unit rate must be > 0";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (asDraft = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("erp_token");
      const payload = {
        type,
        ...form,
        grandTotal: totals.grandTotal,
        lineItems: lines,
      };
      const res = await fetch(`${API}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create invoice");
      }
      const invoice = await res.json();
      if (!asDraft) {
        // Auto-submit for approval
        await fetch(`${API}/invoices/${invoice.id}/submit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      onSuccess?.(invoice);
    } catch (err) {
      setErrors({ _global: err.message });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (field) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[field] ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">New Invoice</h2>
          <p className="text-xs text-gray-500 mt-0.5">Create vendor bill or client invoice</p>
        </div>
        <div className="flex gap-2">
          {["VENDOR_INVOICE", "CLIENT_INVOICE"].map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                type === t
                  ? t === "VENDOR_INVOICE" ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300" : "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t === "VENDOR_INVOICE" ? "📥 Vendor Bill (AP)" : "📤 Client Invoice (AR)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {errors._global && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {errors._global}
          </div>
        )}

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {/* Party selection */}
          {type === "VENDOR_INVOICE" ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vendor *</label>
              <select value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))} className={inputCls("vendorId")}>
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.vendorCode})</option>)}
              </select>
              {errors.vendorId && <p className="text-xs text-red-500 mt-0.5">{errors.vendorId}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
              <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inputCls("clientId")}>
                <option value="">Select Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.clientCode})</option>)}
              </select>
              {errors.clientId && <p className="text-xs text-red-500 mt-0.5">{errors.clientId}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputCls("projectId")}>
              <option value="">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>)}
            </select>
          </div>

          {type === "VENDOR_INVOICE" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vendor Invoice No.</label>
              <input
                type="text"
                placeholder="e.g., UTC/2024/1234"
                value={form.externalInvoiceNo}
                onChange={e => setForm(f => ({ ...f, externalInvoiceNo: e.target.value }))}
                className={inputCls("externalInvoiceNo")}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date *</label>
            <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} className={inputCls("invoiceDate")} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Due Date *</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputCls("dueDate")} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Narration</label>
            <input type="text" placeholder="Work description..." value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} className={inputCls()} />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Line Items</h3>
            <button onClick={addLine} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              + Add Line
            </button>
          </div>
          {errors.lines && <p className="text-xs text-red-500 mb-2">{errors.lines}</p>}

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left w-48">Description *</th>
                  <th className="px-3 py-2 text-right w-20">Qty</th>
                  <th className="px-3 py-2 text-left w-16">Unit</th>
                  <th className="px-3 py-2 text-right w-28">Rate (₹) *</th>
                  <th className="px-3 py-2 text-left w-20">GST Type</th>
                  <th className="px-3 py-2 text-right w-16">GST %</th>
                  {type === "VENDOR_INVOICE" && <th className="px-3 py-2 text-left w-28">Cost Head</th>}
                  <th className="px-3 py-2 text-left w-24">HSN/SAC</th>
                  <th className="px-3 py-2 text-right w-28">Amount</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const lineAmt = Number(line.quantity) * Number(line.unitRate);
                  const gstAmt = line.gstType === "EXEMPT" ? 0 : lineAmt * Number(line.gstRate) / 100;
                  return (
                    <tr key={idx} className="border-t border-gray-50 hover:bg-blue-50/30">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          placeholder="Item description"
                          value={line.description}
                          onChange={e => updateLine(idx, "description", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => updateLine(idx, "quantity", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={line.unit} onChange={e => updateLine(idx, "unit", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={line.unitRate} onChange={e => updateLine(idx, "unitRate", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.gstType} onChange={e => updateLine(idx, "gstType", e.target.value)}
                          className="w-full px-1 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                          {["CGST", "IGST", "EXEMPT"].map(g => <option key={g}>{g}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.gstRate} onChange={e => updateLine(idx, "gstRate", e.target.value)}
                          className="w-full px-1 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                          {GST_RATES.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      {type === "VENDOR_INVOICE" && (
                        <td className="px-2 py-1.5">
                          <select value={line.costHead} onChange={e => updateLine(idx, "costHead", e.target.value)}
                            className="w-full px-1 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                            {COST_HEADS.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                      )}
                      <td className="px-2 py-1.5">
                        <input type="text" placeholder="HSN/SAC" value={line.hsnCode} onChange={e => updateLine(idx, "hsnCode", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-gray-700">
                        {fmt(lineAmt + gstAmt)}
                      </td>
                      <td className="px-1 py-1.5">
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(idx)} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tax & Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TDS & Retention */}
          {type === "VENDOR_INVOICE" && (
            <div className="space-y-3 bg-amber-50 rounded-lg p-4 border border-amber-100">
              <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Deductions</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">TDS Section</label>
                  <select
                    value={form.tdsSection}
                    onChange={e => setForm(f => ({ ...f, tdsSection: e.target.value, tdsRate: TDS_RATES[e.target.value] || 0 }))}
                    className="w-full px-2 py-1.5 border border-amber-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {TDS_SECTIONS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">TDS Rate (%)</label>
                  <input type="number" step="0.01" value={form.tdsRate}
                    onChange={e => setForm(f => ({ ...f, tdsRate: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-amber-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Retention (%)</label>
                  <input type="number" step="0.5" min="0" max="10" value={form.retentionPct}
                    onChange={e => setForm(f => ({ ...f, retentionPct: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-amber-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" />
                </div>
                <div className="flex flex-col justify-end">
                  <p className="text-xs text-amber-700">TDS Deduction: <span className="font-semibold">{fmt(totals.tdsAmount)}</span></p>
                  <p className="text-xs text-amber-700">Retention: <span className="font-semibold">{fmt(totals.retentionAmount)}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Totals Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-2">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Summary</h4>
            {[
              ["Sub Total", totals.subTotal],
              ...(totals.cgst > 0 ? [["CGST", totals.cgst], ["SGST", totals.sgst]] : []),
              ...(totals.igst > 0 ? [["IGST", totals.igst]] : []),
              ...(type === "VENDOR_INVOICE" && totals.tdsAmount > 0 ? [["(–) TDS", -totals.tdsAmount]] : []),
              ...(totals.retentionAmount > 0 ? [["(–) Retention", -totals.retentionAmount]] : []),
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-xs text-gray-600">
                <span>{label}</span>
                <span className={val < 0 ? "text-red-600" : ""}>{fmt(Math.abs(val))}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold text-gray-900">
              <span>Grand Total</span>
              <span className="text-blue-700">{fmt(totals.grandTotal)}</span>
            </div>
            {type === "VENDOR_INVOICE" && (
              <div className="flex justify-between text-xs text-green-700 font-medium">
                <span>Net Payable</span>
                <span>{fmt(totals.grandTotal - totals.tdsAmount - totals.retentionAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium shadow-sm"
            >
              {saving ? "Saving..." : "Submit for Approval →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
