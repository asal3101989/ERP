import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BCIM LOGO — inline SVG, pixel-perfect match to the original
// ─────────────────────────────────────────────────────────────────────────────
function BCIMLogo({ width = 130, height = 46 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 270 95"
      width={width}
      height={height}
      aria-label="BCIM Engineering Private Limited"
    >
      {/* ── Hexagon badge — dark navy ── */}
      <polygon
        points="47,5 76,5 91,30 76,55 47,55 32,30"
        fill="#1b2d52"
      />

      {/* ── Three red horizontal stripes ── */}
      <rect x="38" y="13"   width="35" height="9"   rx="1.5" fill="#cc2222" />
      <rect x="38" y="26"   width="35" height="9"   rx="1.5" fill="#cc2222" />
      <rect x="38" y="39"   width="35" height="9"   rx="1.5" fill="#cc2222" />

      {/* ── Navy gutters separating stripes ── */}
      <rect x="38" y="22"   width="35" height="4"   fill="#1b2d52" />
      <rect x="38" y="35"   width="35" height="4"   fill="#1b2d52" />

      {/* ── BCIM wordmark ── */}
      <text
        x="103"
        y="44"
        fontFamily="'Arial Black', 'Franklin Gothic Heavy', Arial, sans-serif"
        fontWeight="900"
        fontSize="32"
        fill="#1b2d52"
        letterSpacing="2"
      >
        BCIM
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Number → Indian Words
// ─────────────────────────────────────────────────────────────────────────────
const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function numToWords(n) {
  if (n === 0) return "Zero";
  const paise  = Math.round((n % 1) * 100);
  const rupees = Math.floor(n);
  const convert = (num) => {
    if (num === 0) return "";
    if (num < 20)       return ones[num];
    if (num < 100)      return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000)     return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + convert(num % 100) : "");
    if (num < 100000)   return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + convert(num % 1000) : "");
    if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + convert(num % 100000) : "");
    return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + convert(num % 10000000) : "");
  };
  let words = convert(rupees) + " Rupees";
  if (paise > 0) words += " and " + convert(paise) + " Paise";
  return words + " Only";
}

function fmt(val) {
  if (!val && val !== 0) return "—";
  return Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — replace fetchBillData() with your real API call
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_BILLS = {
  "PC-068-RA01": {
    pcNo:              "P22/PO68/5427/ASC",
    companyName:       "BCIM ENGINEERING PRIVATE LIMITED",
    projectName:       "TQS, Yelahanka — The Quiet Site, Bengaluru",
    vendorName:        "Ashok Steel and Cements",
    packageDesc:       "Supply of PPC Cement for TQS, Yelahanka",
    raBillNo:          "RA-01",
    poWoRef:           "POTQS068-A1 Dated 08.04.2026",
    poWoValue:         55500,
    invoiceNo:         "ASC014/26-27",
    invoiceDate:       "08.04.2026",
    mrRefNo:           "BCIM-TQS-BLR-MR-036",
    recommendationDate:"08.04.2026",
    paymentTerms:      "15 Days from the date of supply",
    abstract: [
      { slNo: 1, description: "PPC Cement 50 kg bags", unit: "Bags", qty: 100, rate: 555.00, amount: 55500.00 },
    ],
    summary: {
      originalContractValue:     55500,
      variationOrders:           0,
      finalContractValue:        55500,
      advanceCertified:          0,
      grossCertifiedTillDate:    55500,
      deductionMobilisationAdv:  0,
      deductionRetention:        0,
      otherDeductions:           0,
      totalNetCertifiedTillDate: 55500,
      lessPreviousCertificates:  0,
      balanceToFinish:           0,
      currentNetPaymentDue:      55500,
    },
    signatories: [
      { role: "Prepared By",  name: "",                  label: "QS Engineer" },
      { role: "Approved By",  name: "Mr. Srinivas Raju", label: "Director" },
      { role: "Approved By",  name: "Mr. Stephen A",     label: "Managing Director" },
    ],
    remarks: [
      "Any Statutory deductions required to be made apart from the above shall be made at Accounts Department.",
      "Payments made to be verified for correctness.",
      "All transactions in Indian Rupees.",
    ],
    accountsNote: "",
  },
};

async function fetchBillData(billId) {
  // Replace with: const res = await fetch(`/api/ra-bills/${billId}/payment-certificate`); return res.json();
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_BILLS[billId] ?? null), 300));
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT STYLES
// ─────────────────────────────────────────────────────────────────────────────
const printStyles = `
  @media print {
    body * { visibility: hidden !important; }
    #pc-print-root, #pc-print-root * { visibility: visible !important; }
    #pc-print-root { position: absolute; inset: 0; padding: 0; margin: 0; }
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 10mm 12mm; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Cell({ value, onChange, editable, className = "", align = "left", money = false }) {
  if (!editable) {
    return (
      <span className={`block ${align === "right" ? "text-right" : ""} ${className}`}>
        {money && value !== 0 && value !== "" ? fmt(value) : (value === 0 && money ? "—" : value ?? "—")}
      </span>
    );
  }
  return (
    <input
      type={money ? "number" : "text"}
      step={money ? "0.01" : undefined}
      value={value ?? ""}
      onChange={e => onChange(money ? parseFloat(e.target.value) || 0 : e.target.value)}
      className={`w-full border-b border-dashed border-gray-400 bg-transparent focus:outline-none focus:border-blue-500 text-xs ${align === "right" ? "text-right" : ""} ${className}`}
    />
  );
}

function InfoRow({ label, value, editable, onChange }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs leading-[1.65]">
      <span className="font-semibold text-gray-500 shrink-0 w-40">{label}</span>
      <span className="text-gray-400 shrink-0">:</span>
      {editable ? (
        <input
          className="flex-1 border-b border-dashed border-gray-400 bg-transparent focus:outline-none focus:border-blue-500 text-xs"
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <span className="flex-1 font-medium text-gray-800">{value || "—"}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentCertificate() {
  const [billId,   setBillId]   = useState("PC-068-RA01");
  const [input,    setInput]    = useState("PC-068-RA01");
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [editable, setEditable] = useState(false);
  const printRef = useRef();

  useEffect(() => { loadBill(billId); }, []);

  async function loadBill(id) {
    setLoading(true); setError("");
    try {
      const result = await fetchBillData(id.trim());
      if (!result) { setError(`No bill found for ID "${id}"`); setData(null); }
      else setData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function handleSearch() { setBillId(input); loadBill(input); }

  function update(path, value) {
    setData(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      if (path.startsWith("summary.") || path.startsWith("abstract")) recalc(clone);
      return clone;
    });
  }

  function recalc(d) {
    const s = d.summary;
    s.finalContractValue        = (s.originalContractValue || 0) + (s.variationOrders || 0);
    s.grossCertifiedTillDate    = (s.finalContractValue || 0) - (s.advanceCertified || 0);
    const totalDed              = (s.deductionMobilisationAdv || 0) + (s.deductionRetention || 0) + (s.otherDeductions || 0);
    s.totalNetCertifiedTillDate = (s.grossCertifiedTillDate || 0) - totalDed;
    s.currentNetPaymentDue      = (s.totalNetCertifiedTillDate || 0) - (s.lessPreviousCertificates || 0);
    s.balanceToFinish           = (s.originalContractValue || 0) - (s.totalNetCertifiedTillDate || 0);
  }

  const abstractTotal = data?.abstract?.reduce((a, r) => a + (r.amount || 0), 0) ?? 0;

  const summaryRows = data ? [
    { no: 1,  label: "Original Contract Value",                  key: "originalContractValue",    editable: true  },
    { no: 2,  label: "Net Change by Variation Orders",           key: "variationOrders",           editable: true  },
    { no: 3,  label: "Final Contract Value to Date",             key: "finalContractValue",        editable: false },
    { no: 4,  label: "Advance Certified",                        key: "advanceCertified",          editable: true  },
    { no: 5,  label: "Gross Certified Till Date",                key: "grossCertifiedTillDate",    editable: false },
    { no: 6,  label: "Deduction of Mobilisation Advance",        key: "deductionMobilisationAdv",  editable: true  },
    { no: 7,  label: "Deduction of Retention Amount",            key: "deductionRetention",        editable: true  },
    { no: 8,  label: "Any Other Deductions",                     key: "otherDeductions",           editable: true  },
    { no: 9,  label: "Total Net Certified Till Date",            key: "totalNetCertifiedTillDate", editable: false },
    { no: 10, label: "Less Previous Certificates for Payments",  key: "lessPreviousCertificates",  editable: true  },
    { no: 11, label: "Balance to Finish",                        key: "balanceToFinish",           editable: false },
    { no: 12, label: "Current Net Payment Due",                  key: "currentNetPaymentDue",      editable: false },
  ] : [];

  // ── row styling helpers
  const isBold  = (no) => [3, 5, 9, 12].includes(no);
  const isGreen = (no) => no === 12;

  return (
    <>
      <style>{printStyles}</style>

      {/* ════════════════════════════════════════════════════════════════════
          CONTROLS TOOLBAR  (hidden on print)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="no-print bg-slate-800 px-4 py-2.5 flex flex-wrap items-center gap-3">
        {/* Mini logo in toolbar */}
        <BCIMLogo width={80} height={28} />

        <span className="text-white text-xs font-semibold tracking-wide border-l border-slate-600 pl-3">
          Payment Certificate
        </span>

        <div className="flex items-center gap-2 ml-2">
          <label className="text-slate-400 text-xs">Bill ID:</label>
          <input
            className="border border-slate-600 bg-slate-700 text-white rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-slate-500"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="e.g. PC-068-RA01"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-500 text-white text-xs px-3 py-1 rounded hover:bg-blue-400 transition font-medium"
          >Load</button>
        </div>

        {data && (
          <>
            <button
              onClick={() => setEditable(p => !p)}
              className={`text-xs px-3 py-1 rounded border transition font-medium ${
                editable
                  ? "bg-amber-400 border-amber-400 text-slate-900"
                  : "bg-transparent border-slate-500 text-slate-300 hover:border-slate-300"
              }`}
            >{editable ? "✏️ Editing ON" : "✏️ Edit"}</button>

            <button
              onClick={() => window.print()}
              className="bg-emerald-500 text-white text-xs px-3 py-1 rounded hover:bg-emerald-400 transition font-medium"
            >🖨 Print / PDF</button>
          </>
        )}

        {loading && <span className="text-blue-400 text-xs animate-pulse">Loading…</span>}
        {error   && <span className="text-red-400 text-xs">{error}</span>}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          CERTIFICATE BODY
      ════════════════════════════════════════════════════════════════════ */}
      {data && (
        <div
          id="pc-print-root"
          ref={printRef}
          className="bg-white mx-auto text-gray-800"
          style={{ maxWidth: 860, padding: "28px 36px", fontFamily: "Arial, sans-serif", fontSize: 11 }}
        >

          {/* ══════════════════════════════════════════════════════════════
              CERTIFICATE HEADER  — Logo left | Title centre | PC# right
          ══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "3px solid #1b2d52",
              paddingBottom: 10,
              marginBottom: 14,
            }}
          >
            {/* ── Logo ── */}
            <div style={{ flexShrink: 0 }}>
              <BCIMLogo width={155} height={55} />
            </div>

            {/* ── Centre title block ── */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#1b2d52",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Payment Certificate
              </div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 3, letterSpacing: 0.5 }}>
                BCIM Engineering Private Limited — QS &amp; Billing Department
              </div>
            </div>

            {/* ── Right: PC No + Bill No ── */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#1b2d52",
                  background: "#eef2fa",
                  border: "1px solid #c0cbdf",
                  borderRadius: 4,
                  padding: "4px 10px",
                  display: "inline-block",
                }}
              >
                PC No: {data.pcNo}
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: "#555" }}>
                RA Bill No: <strong>{data.raBillNo}</strong>
              </div>
              <div style={{ fontSize: 10, color: "#555" }}>
                Date: <strong>{data.recommendationDate}</strong>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              META INFO  (two-column grid)
          ══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 24px",
              border: "1px solid #d0d7e8",
              borderRadius: 5,
              padding: "10px 14px",
              marginBottom: 14,
              background: "#fafbfe",
            }}
          >
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label="Company Name"   value={data.companyName}  editable={editable} onChange={v => update("companyName", v)} />
              <InfoRow label="Project Name"   value={data.projectName}  editable={editable} onChange={v => update("projectName", v)} />
              <InfoRow label="Package Desc."  value={data.packageDesc}  editable={editable} onChange={v => update("packageDesc", v)} />
              <InfoRow label="PO / WO Ref."   value={data.poWoRef}      editable={editable} onChange={v => update("poWoRef", v)} />
              <InfoRow label="PO / WO Value"  value={`₹ ${fmt(data.poWoValue)}`} editable={false} onChange={() => {}} />
              <InfoRow label="Payment Terms"  value={data.paymentTerms} editable={editable} onChange={v => update("paymentTerms", v)} />
            </div>
            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label="Vendor Name"         value={data.vendorName}        editable={editable} onChange={v => update("vendorName", v)} />
              <InfoRow label="Date of Invoice"     value={data.invoiceDate}       editable={editable} onChange={v => update("invoiceDate", v)} />
              <InfoRow label="Invoice Number"      value={data.invoiceNo}         editable={editable} onChange={v => update("invoiceNo", v)} />
              <InfoRow label="MR Ref. No."         value={data.mrRefNo}           editable={editable} onChange={v => update("mrRefNo", v)} />
              <InfoRow label="Recommendation Date" value={data.recommendationDate} editable={editable} onChange={v => update("recommendationDate", v)} />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              BILL ABSTRACT
          ══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#1b2d52",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 5,
              borderLeft: "3px solid #1b2d52",
              paddingLeft: 8,
            }}
          >
            Bill Abstract
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 10 }}>
            <thead>
              <tr style={{ background: "#1b2d52", color: "white" }}>
                {["Sl.", "Description", "Unit", "Qty", "Rate (₹)", "Amount (₹)"].map(h => (
                  <th key={h} style={{ border: "1px solid #1b2d52", padding: "5px 8px", textAlign: h === "Description" ? "left" : "center", fontWeight: 700, fontSize: 10 }}>
                    {h}
                  </th>
                ))}
                {editable && <th style={{ border: "1px solid #1b2d52", padding: "5px 4px", width: 28 }} />}
              </tr>
            </thead>
            <tbody>
              {data.abstract.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f7f9fd" }}>
                  <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px", textAlign: "center" }}>{row.slNo}</td>
                  <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px" }}>
                    <Cell value={row.description} editable={editable} onChange={v => update(`abstract.${i}.description`, v)} />
                  </td>
                  <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px", textAlign: "center" }}>
                    <Cell value={row.unit} editable={editable} onChange={v => update(`abstract.${i}.unit`, v)} />
                  </td>
                  <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px", textAlign: "right" }}>
                    <Cell value={row.qty} editable={editable} money align="right" onChange={v => { update(`abstract.${i}.qty`, v); update(`abstract.${i}.amount`, v * row.rate); }} />
                  </td>
                  <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px", textAlign: "right" }}>
                    <Cell value={row.rate} editable={editable} money align="right" onChange={v => { update(`abstract.${i}.rate`, v); update(`abstract.${i}.amount`, v * row.qty); }} />
                  </td>
                  <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                    {fmt(row.amount)}
                  </td>
                  {editable && (
                    <td style={{ border: "1px solid #cdd3e0", padding: "4px", textAlign: "center" }}>
                      <button style={{ color: "#e53e3e", fontSize: 11, cursor: "pointer", background: "none", border: "none" }}
                        onClick={() => setData(p => ({ ...p, abstract: p.abstract.filter((_, idx) => idx !== i) }))}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#eef2fa", fontWeight: 700 }}>
                <td colSpan={5} style={{ border: "1px solid #1b2d52", padding: "5px 8px", textAlign: "right", fontSize: 10, color: "#1b2d52" }}>
                  Total Abstract Value
                </td>
                <td style={{ border: "1px solid #1b2d52", padding: "5px 8px", textAlign: "right", color: "#1b2d52" }}>
                  {fmt(abstractTotal)}
                </td>
                {editable && <td style={{ border: "1px solid #1b2d52" }} />}
              </tr>
            </tfoot>
          </table>

          {editable && (
            <button
              className="no-print"
              style={{ fontSize: 11, marginBottom: 12, padding: "3px 12px", border: "1px dashed #3b82f6", color: "#3b82f6", borderRadius: 4, background: "none", cursor: "pointer" }}
              onClick={() => setData(p => ({
                ...p,
                abstract: [...p.abstract, { slNo: p.abstract.length + 1, description: "", unit: "", qty: 0, rate: 0, amount: 0 }]
              }))}
            >+ Add Row</button>
          )}

          {/* ══════════════════════════════════════════════════════════════
              CLAIM SUMMARY
          ══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#1b2d52",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 5,
              borderLeft: "3px solid #1b2d52",
              paddingLeft: 8,
            }}
          >
            Claim Summary
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 10 }}>
            <thead>
              <tr style={{ background: "#1b2d52", color: "white" }}>
                <th style={{ border: "1px solid #1b2d52", padding: "5px 8px", textAlign: "center", width: 36, fontSize: 10 }}>No.</th>
                <th style={{ border: "1px solid #1b2d52", padding: "5px 8px", textAlign: "left", fontSize: 10 }}>Description</th>
                <th style={{ border: "1px solid #1b2d52", padding: "5px 8px", textAlign: "right", width: 140, fontSize: 10 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, i) => {
                const val      = data.summary[row.key];
                const boldRow  = isBold(row.no);
                const greenRow = isGreen(row.no);
                return (
                  <tr key={i} style={{
                    background: greenRow ? "#f0fdf4" : boldRow ? "#fffbeb" : i % 2 === 0 ? "#fff" : "#f7f9fd",
                    fontWeight: boldRow ? 700 : 400,
                  }}>
                    <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px", textAlign: "center" }}>{row.no}</td>
                    <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px" }}>{row.label}</td>
                    <td style={{ border: "1px solid #cdd3e0", padding: "4px 8px", textAlign: "right" }}>
                      {row.editable && editable ? (
                        <Cell value={val} editable align="right" money onChange={v => { update(`summary.${row.key}`, v); recalc(data); }} />
                      ) : (
                        <span style={{ color: greenRow ? "#15803d" : "inherit", fontWeight: greenRow ? 800 : "inherit" }}>
                          {val === 0 ? "—" : fmt(val)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Amount in words ── */}
          <div style={{ border: "1px solid #1b2d52", borderRadius: 4, padding: "7px 12px", marginBottom: 14, background: "#f0fdf4", fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: "#1b2d52" }}>Amount Certified in Words: </span>
            <span style={{ fontWeight: 600, color: "#15803d" }}>
              {data.summary.currentNetPaymentDue > 0
                ? numToWords(data.summary.currentNetPaymentDue)
                : "Zero Rupees Only"}
            </span>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              REMARKS
          ══════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: 14, fontSize: 10 }}>
            <div style={{ fontWeight: 700, color: "#1b2d52", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Remarks:
            </div>
            {data.remarks.map((r, i) => (
              <div key={i} style={{ color: "#444", lineHeight: 1.7 }}>{i + 1}. {r}</div>
            ))}
            {data.accountsNote && (
              <div style={{ marginTop: 4, fontStyle: "italic", color: "#666" }}>
                Note to Accounts: {data.accountsNote}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              SIGNATURE BLOCK
          ══════════════════════════════════════════════════════════════ */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${data.signatories.length}, 1fr)`,
            gap: 16,
            marginTop: 28,
          }}>
            {data.signatories.map((sig, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10 }}>
                <div style={{ borderTop: "1.5px solid #1b2d52", paddingTop: 32, marginTop: 36 }}>
                  {editable ? (
                    <input
                      style={{ width: "100%", textAlign: "center", borderBottom: "1px dashed #aaa", background: "transparent", outline: "none", fontSize: 10, fontWeight: 600 }}
                      value={sig.name}
                      onChange={e => update(`signatories.${i}.name`, e.target.value)}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: "#1b2d52" }}>{sig.name || "___________________________"}</div>
                  )}
                  <div style={{ color: "#555", marginTop: 2 }}>{sig.label}</div>
                  <div style={{ color: "#888", marginTop: 1 }}>{sig.role}</div>
                  <div style={{ marginTop: 10, color: "#aaa" }}>Date: _______________</div>
                </div>
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              FOOTER
          ══════════════════════════════════════════════════════════════ */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 8,
              borderTop: "2px solid #1b2d52",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Footer logo (tiny) */}
            <BCIMLogo width={80} height={28} />

            {/* Footer text */}
            <div style={{ fontSize: 8.5, color: "#888", textAlign: "center" }}>
              BCIM Engineering Private Limited &nbsp;•&nbsp;
              PC No. {data.pcNo} &nbsp;•&nbsp;
              RA Bill No. {data.raBillNo} &nbsp;•&nbsp;
              Date: {data.recommendationDate}
            </div>

            {/* Stamp area */}
            <div style={{
              width: 80, height: 28,
              border: "1px dashed #bbb",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              color: "#bbb",
            }}>Stamp / Seal</div>
          </div>

        </div>
      )}

      {!data && !loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "#9ca3af", fontSize: 13 }}>
          Enter a Bill ID above and click <strong style={{ margin: "0 4px" }}>Load</strong> to fetch the Payment Certificate.
        </div>
      )}
    </>
  );
}
