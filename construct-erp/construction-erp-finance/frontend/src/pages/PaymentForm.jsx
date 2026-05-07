// ============================================================
// frontend/src/pages/PaymentForm.jsx
// Payment entry: allocate against multiple invoices, NEFT/RTGS/CHEQUE
// ============================================================
import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "CHEQUE", "CASH", "UPI", "BANK_TRANSFER"];

export default function PaymentForm({ onSuccess, onCancel }) {
  const [paymentType, setPaymentType] = useState("OUTGOING"); // OUTGOING = pay vendor, INCOMING = receive from client
  const [mode, setMode] = useState("NEFT");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactionRef, setTransactionRef] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [ourBankAccount, setOurBankAccount] = useState("HDFC Bank – 50100123456789");

  const [invoices, setInvoices] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [allocations, setAllocations] = useState({}); // invoiceId → amount
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Fetch outstanding invoices based on payment type
  useEffect(() => {
    const token = localStorage.getItem("erp_token");
    setLoadingInvoices(true);
    const endpoint = paymentType === "OUTGOING" ? "outstanding/ap" : "outstanding/ar";
    fetch(`${API}/invoices/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .finally(() => setLoadingInvoices(false));
  }, [paymentType]);

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + Number(v || 0), 0);

  const setAlloc = (invoiceId, value) => {
    setAllocations(prev => ({ ...prev, [invoiceId]: value }));
  };

  const allocateFull = (invoice) => {
    setAlloc(invoice.id, Number(invoice.balanceDue));
  };

  const validate = () => {
    const e = {};
    if (!paymentDate) e.paymentDate = "Payment date required";
    if (totalAllocated <= 0) e.allocations = "Allocate payment to at least one invoice";
    if (mode === "CHEQUE" && !chequeNumber) e.chequeNumber = "Cheque number required";
    if (["NEFT", "RTGS"].includes(mode) && !transactionRef) e.transactionRef = "UTR/Transaction reference required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("erp_token");
      const allocationList = Object.entries(allocations)
        .filter(([, amt]) => Number(amt) > 0)
        .map(([invoiceId, amount]) => ({ invoiceId, amount: Number(amount) }));

      // Get bank account from first vendor invoice if outgoing
      const firstInvoice = invoices.find(i => allocationList.some(a => a.invoiceId === i.id));
      const bankAccountId = firstInvoice?.vendor?.bankAccounts?.[0]?.id;

      const payload = {
        paymentMode: mode,
        paymentDate: new Date(paymentDate).toISOString(),
        ...(bankAccountId && { bankAccountId }),
        ...(transactionRef && { transactionRef }),
        ...(chequeNumber && { chequeNumber }),
        ...(chequeDate && { chequeDate: new Date(chequeDate).toISOString() }),
        ourBankAccount,
        remarks,
        allocations: allocationList,
      };

      const res = await fetch(`${API}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment failed");
      }

      const payment = await res.json();
      onSuccess?.(payment);
    } catch (err) {
      setErrors({ _global: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
          <p className="text-xs text-gray-500 mt-0.5">Allocate against outstanding invoices</p>
        </div>
        <div className="flex gap-2">
          {[["OUTGOING", "📤 Pay Vendor"], ["INCOMING", "📥 Receive from Client"]].map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setPaymentType(t); setAllocations({}); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                paymentType === t
                  ? t === "OUTGOING" ? "bg-red-100 text-red-700 ring-1 ring-red-300" : "bg-green-100 text-green-700 ring-1 ring-green-300"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {label}
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

        {/* Payment Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Mode</label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_MODES.map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-all ${
                    mode === m ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-400"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.paymentDate ? "border-red-400" : "border-gray-200"}`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {["NEFT", "RTGS", "IMPS"].includes(mode) ? "UTR / Transaction Ref *" : "Reference"}
            </label>
            <input
              type="text"
              placeholder={mode === "CHEQUE" ? "Leave blank" : "UTR/NEFT reference..."}
              value={transactionRef}
              onChange={e => setTransactionRef(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.transactionRef ? "border-red-400" : "border-gray-200"}`}
            />
            {errors.transactionRef && <p className="text-xs text-red-500 mt-0.5">{errors.transactionRef}</p>}
          </div>

          {mode === "CHEQUE" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cheque Number *</label>
                <input
                  type="text"
                  value={chequeNumber}
                  onChange={e => setChequeNumber(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.chequeNumber ? "border-red-400" : "border-gray-200"}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cheque Date</label>
                <input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Our Bank Account</label>
            <select value={ourBankAccount} onChange={e => setOurBankAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>HDFC Bank – 50100123456789</option>
              <option>SBI – 35678901234567</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Invoice Allocation */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Outstanding {paymentType === "OUTGOING" ? "Vendor Invoices" : "Client Invoices"}
            </h3>
            {errors.allocations && <p className="text-xs text-red-500">{errors.allocations}</p>}
          </div>

          {loadingInvoices ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-gray-100">
              No outstanding invoices found
            </div>
          ) : (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Invoice #</th>
                    <th className="px-4 py-2.5 text-left">{paymentType === "OUTGOING" ? "Vendor" : "Client"}</th>
                    <th className="px-4 py-2.5 text-left">Project</th>
                    <th className="px-4 py-2.5 text-right">Invoice Amt</th>
                    <th className="px-4 py-2.5 text-right">Balance Due</th>
                    <th className="px-4 py-2.5 text-center">Due Date</th>
                    <th className="px-4 py-2.5 text-right w-36">Allocate (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isOverdue = new Date(inv.dueDate) < new Date();
                    return (
                      <tr key={inv.id} className="border-t border-gray-50 hover:bg-blue-50/20">
                        <td className="px-4 py-2.5 font-mono text-blue-700">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {paymentType === "OUTGOING" ? inv.vendor?.name : inv.client?.name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{inv.project?.name || "–"}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmt(inv.grandTotal)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(inv.balanceDue)}</td>
                        <td className={`px-4 py-2.5 text-center ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                          {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                          {isOverdue && " ⚠️"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max={Number(inv.balanceDue)}
                              step="1"
                              value={allocations[inv.id] || ""}
                              onChange={e => setAlloc(inv.id, e.target.value)}
                              placeholder="0"
                              className="w-24 px-2 py-1 border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                            />
                            <button
                              onClick={() => allocateFull(inv)}
                              title="Allocate full balance"
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap"
                            >
                              Full
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Total & Submit */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-5 py-4 border border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Total Payment Amount</p>
            <p className={`text-2xl font-bold mt-0.5 ${paymentType === "OUTGOING" ? "text-red-700" : "text-green-700"}`}>
              {fmt(totalAllocated)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {Object.values(allocations).filter(v => Number(v) > 0).length} invoice(s) allocated
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || totalAllocated <= 0}
              className={`px-6 py-2.5 text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors text-white ${
                paymentType === "OUTGOING" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {saving ? "Processing..." : `Record ${paymentType === "OUTGOING" ? "Payment" : "Receipt"} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
