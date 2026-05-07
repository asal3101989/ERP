import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─── Design tokens ────────────────────────────────────────────
const COLORS = {
  primary: "#1B4FD8",
  accent: "#F59E0B",
  green: "#10B981",
  red: "#EF4444",
  purple: "#8B5CF6",
  slate: "#64748B",
  surface: "#F8FAFC",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#94A3B8",
};

const CHART_COLORS = ["#1B4FD8", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

// ─── Mock data (mirrors what API returns) ────────────────────
const MOCK_KPIs = {
  revenue: 185000000,
  expenses: 141500000,
  grossProfit: 43500000,
  grossMargin: "23.5",
  pendingAP: { amount: 28400000, count: 14 },
  pendingAR: { amount: 47200000, count: 9 },
  overdueInvoices: 5,
};

const MONTHLY_TREND = [
  { month: "Apr", revenue: 12000000, expenses: 9200000 },
  { month: "May", revenue: 14500000, expenses: 11800000 },
  { month: "Jun", revenue: 13200000, expenses: 10100000 },
  { month: "Jul", revenue: 16800000, expenses: 12400000 },
  { month: "Aug", revenue: 15100000, expenses: 11200000 },
  { month: "Sep", revenue: 18200000, expenses: 13700000 },
  { month: "Oct", revenue: 21500000, expenses: 16200000 },
  { month: "Nov", revenue: 19800000, expenses: 15100000 },
  { month: "Dec", revenue: 22400000, expenses: 17800000 },
  { month: "Jan", revenue: 17600000, expenses: 14200000 },
  { month: "Feb", revenue: 15900000, expenses: 12400000 },
  { month: "Mar", revenue: 18000000, expenses: 14100000 },
];

const PROJECT_BUDGET_DATA = [
  { name: "NH-44 Highway", budget: 380, actual: 199.8, pct: 52.6 },
  { name: "Prestige Skyline", budget: 120, actual: 67.4, pct: 56.2 },
  { name: "Metro Station", budget: 245, actual: 198.2, pct: 80.9 },
  { name: "Airport Rd", budget: 90, actual: 44.1, pct: 49.0 },
];

const COST_PIE = [
  { name: "Material", value: 38 },
  { name: "Labor", value: 22 },
  { name: "Equipment", value: 16 },
  { name: "Subcontractor", value: 18 },
  { name: "Overhead", value: 6 },
];

const INVOICES = [
  { id: "INV-2024-00098", vendor: "Ultratech Cement", type: "AP", amount: 4250000, status: "PENDING_APPROVAL_L2", dueDate: "2025-05-15", project: "NH-44 Highway" },
  { id: "INV-2024-00099", vendor: "Sri Sai Steel", type: "AP", amount: 1875000, status: "APPROVED", dueDate: "2025-05-08", project: "Prestige Skyline" },
  { id: "INV-2024-00100", client: "KSHD Dept", type: "AR", amount: 12500000, status: "PARTIALLY_PAID", dueDate: "2025-04-30", project: "NH-44 Highway" },
  { id: "INV-2024-00101", vendor: "Ace Equipment", type: "AP", amount: 680000, status: "DRAFT", dueDate: "2025-05-20", project: "NH-44 Highway" },
  { id: "INV-2024-00102", client: "Prestige Estates", type: "AR", amount: 8750000, status: "APPROVED", dueDate: "2025-05-25", project: "Prestige Skyline" },
  { id: "INV-2024-00103", vendor: "Ultratech Cement", type: "AP", amount: 3120000, status: "PAID", dueDate: "2025-04-15", project: "NH-44 Highway" },
];

const CASHFLOW_FORECAST = [
  { week: "W1 May", inflow: 12500000, outflow: 8200000 },
  { week: "W2 May", inflow: 8750000, outflow: 6100000 },
  { week: "W3 May", inflow: 15000000, outflow: 11400000 },
  { week: "W4 May", inflow: 5200000, outflow: 9800000 },
  { week: "W1 Jun", inflow: 22000000, outflow: 7200000 },
  { week: "W2 Jun", inflow: 6800000, outflow: 12500000 },
];

// ─── Helpers ──────────────────────────────────────────────────
const fmtCr = (n: number) => `₹${(n / 10000000).toFixed(2)} Cr`;
const fmtLakh = (n: number) => `₹${(n / 100000).toFixed(2)} L`;
const fmt = (n: number) => n >= 10000000 ? fmtCr(n) : fmtLakh(n);

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Draft", color: "#64748B", bg: "#F1F5F9" },
  SUBMITTED: { label: "Submitted", color: "#2563EB", bg: "#DBEAFE" },
  PENDING_APPROVAL_L1: { label: "Approval L1", color: "#D97706", bg: "#FEF3C7" },
  PENDING_APPROVAL_L2: { label: "Approval L2", color: "#F59E0B", bg: "#FFFBEB" },
  PENDING_APPROVAL_L3: { label: "Approval L3", color: "#DC2626", bg: "#FEE2E2" },
  APPROVED: { label: "Approved", color: "#059669", bg: "#D1FAE5" },
  PARTIALLY_PAID: { label: "Part. Paid", color: "#7C3AED", bg: "#EDE9FE" },
  PAID: { label: "Paid", color: "#10B981", bg: "#ECFDF5" },
  REJECTED: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = statusConfig[status] || { label: status, color: "#64748B", bg: "#F1F5F9" };
  return (
    <span style={{ color: cfg.color, background: cfg.bg, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
      {cfg.label}
    </span>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────
const KPICard = ({ label, value, sub, icon, color, trend }: any) => (
  <div style={{
    background: "#fff", borderRadius: 16, padding: "20px 24px",
    border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    display: "flex", flexDirection: "column", gap: 8,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</span>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.text, letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: trend === "up" ? COLORS.green : trend === "down" ? COLORS.red : COLORS.muted }}>{sub}</div>}
  </div>
);

// ─── Budget Progress Bar ───────────────────────────────────────
const BudgetBar = ({ item }: { item: typeof PROJECT_BUDGET_DATA[0] }) => {
  const pct = item.pct;
  const color = pct > 85 ? COLORS.red : pct > 65 ? COLORS.accent : COLORS.green;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{item.name}</span>
        <span style={{ fontSize: 12, color: COLORS.muted }}>₹{item.actual}Cr / ₹{item.budget}Cr</span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: COLORS.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 8, transition: "width 1s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: COLORS.muted }}>Utilized</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────
const TABS = ["Dashboard", "Invoices", "Payments", "Budget", "Reports", "Ledger"];

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [invoiceFilter, setInvoiceFilter] = useState("ALL");

  const filteredInvoices = invoiceFilter === "ALL"
    ? INVOICES
    : INVOICES.filter(i => i.type === invoiceFilter);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.surface, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* ── Header ── */}
      <header style={{
        background: "#fff", borderBottom: `1px solid ${COLORS.border}`,
        padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: COLORS.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#fff"
          }}>🏗️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, letterSpacing: -0.3 }}>ConstructERP</div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 0.5 }}>FINANCE MODULE</div>
          </div>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: "flex", gap: 4 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? COLORS.primary : "transparent",
              color: activeTab === tab ? "#fff" : COLORS.muted,
              transition: "all 0.15s",
            }}>
              {tab}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Rajesh Kumar</div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>Admin</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>RK</div>
        </div>
      </header>

      <main style={{ padding: "28px 32px", maxWidth: 1440, margin: "0 auto" }}>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "Dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Page title */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0 }}>Finance Overview</h1>
                <p style={{ fontSize: 13, color: COLORS.muted, margin: "4px 0 0" }}>FY 2024–25 · As of May 5, 2025</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: COLORS.text }}>Export ↓</button>
                <button style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: COLORS.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New Invoice</button>
              </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <KPICard label="Total Revenue" value={fmtCr(MOCK_KPIs.revenue)} icon="📈" color={COLORS.green} sub={`Gross Margin: ${MOCK_KPIs.grossMargin}%`} trend="up" />
              <KPICard label="Total Expenses" value={fmtCr(MOCK_KPIs.expenses)} icon="📉" color={COLORS.red} sub="Direct project costs" trend="neutral" />
              <KPICard label="Payables Due" value={fmtLakh(MOCK_KPIs.pendingAP.amount)} icon="💳" color={COLORS.accent} sub={`${MOCK_KPIs.pendingAP.count} invoices pending`} trend="neutral" />
              <KPICard label="Receivables Due" value={fmtLakh(MOCK_KPIs.pendingAR.amount)} icon="💰" color={COLORS.purple} sub={`${MOCK_KPIs.overdueInvoices} overdue`} trend="down" />
            </div>

            {/* Charts Row 1 */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              {/* Revenue vs Expenses */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: 0 }}>Revenue vs Expenses</h2>
                  <p style={{ fontSize: 12, color: COLORS.muted, margin: "4px 0 0" }}>FY 2024-25 Monthly Trend</p>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={MONTHLY_TREND} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.muted }} />
                    <YAxis tickFormatter={(v) => `₹${(v / 10000000).toFixed(0)}Cr`} tick={{ fontSize: 10, fill: COLORS.muted }} />
                    <Tooltip
                      formatter={(val: number) => [`₹${(val / 10000000).toFixed(2)} Cr`, ""]}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 12 }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke={COLORS.green} fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke={COLORS.red} fill="url(#expGrad)" strokeWidth={2} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Cost breakdown pie */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 4px" }}>Cost Breakdown</h2>
                <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 16px" }}>By cost head (all projects)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={COST_PIE} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {COST_PIE.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val: number) => [`${val}%`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", justifyContent: "center" }}>
                  {COST_PIE.map((item, i) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i] }} />
                      <span style={{ color: COLORS.muted }}>{item.name} {item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Budget utilization */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 4px" }}>Budget Utilization</h2>
                <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 20px" }}>Actual vs Planned — Active Projects</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {PROJECT_BUDGET_DATA.map((item) => <BudgetBar key={item.name} item={item} />)}
                </div>
              </div>

              {/* Cash flow forecast */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 4px" }}>Cash Flow Forecast</h2>
                <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 16px" }}>Inflows vs Outflows — Next 6 Weeks</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={CASHFLOW_FORECAST} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: COLORS.muted }} />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 10, fill: COLORS.muted }} />
                    <Tooltip
                      formatter={(val: number) => [`₹${(val / 1000000).toFixed(2)} M`, ""]}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 12 }}
                    />
                    <Legend />
                    <Bar dataKey="inflow" name="Inflows" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow" name="Outflows" fill={`${COLORS.red}CC`} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent invoices */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: 0 }}>Recent Invoices</h2>
                <button onClick={() => setActiveTab("Invoices")} style={{ fontSize: 12, color: COLORS.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>View All →</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    {["Invoice #", "Party", "Type", "Amount", "Status", "Due Date", "Project"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.muted, fontWeight: 600, padding: "0 12px 10px 0", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INVOICES.slice(0, 5).map(inv => (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "12px 12px 12px 0", fontSize: 13, fontWeight: 600, color: COLORS.primary }}>{inv.id}</td>
                      <td style={{ padding: "12px 12px 12px 0", fontSize: 13, color: COLORS.text }}>{inv.vendor || inv.client}</td>
                      <td style={{ padding: "12px 12px 12px 0" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: inv.type === "AP" ? COLORS.red : COLORS.green, background: inv.type === "AP" ? "#FEE2E2" : "#D1FAE5", padding: "2px 8px", borderRadius: 10 }}>{inv.type}</span>
                      </td>
                      <td style={{ padding: "12px 12px 12px 0", fontSize: 13, fontWeight: 600, color: COLORS.text }}>{fmt(inv.amount)}</td>
                      <td style={{ padding: "12px 12px 12px 0" }}><StatusBadge status={inv.status} /></td>
                      <td style={{ padding: "12px 12px 12px 0", fontSize: 12, color: COLORS.muted }}>{inv.dueDate}</td>
                      <td style={{ padding: "12px 12px 12px 0", fontSize: 12, color: COLORS.muted }}>{inv.project}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── INVOICES TAB ── */}
        {activeTab === "Invoices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0 }}>Invoice Management</h1>
              <button style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: COLORS.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Create Invoice</button>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8 }}>
              {["ALL", "AP", "AR"].map(f => (
                <button key={f} onClick={() => setInvoiceFilter(f)} style={{
                  padding: "7px 16px", borderRadius: 8, border: `1px solid ${invoiceFilter === f ? COLORS.primary : COLORS.border}`,
                  background: invoiceFilter === f ? `${COLORS.primary}10` : "#fff",
                  color: invoiceFilter === f ? COLORS.primary : COLORS.muted,
                  fontSize: 13, fontWeight: 600, cursor: "pointer"
                }}>{f === "ALL" ? "All Invoices" : f === "AP" ? "Vendor Bills (AP)" : "Client Invoices (AR)"}</button>
              ))}
            </div>

            {/* Invoice table */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    {["Invoice #", "Party", "Type", "Project", "Amount", "GST", "Net Payable", "Status", "Due Date", "Actions"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.muted, fontWeight: 700, padding: "0 10px 12px 0", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = COLORS.surface)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "13px 10px 13px 0", fontSize: 13, fontWeight: 600, color: COLORS.primary }}>{inv.id}</td>
                      <td style={{ padding: "13px 10px 13px 0", fontSize: 13, color: COLORS.text, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.vendor || inv.client}</td>
                      <td style={{ padding: "13px 10px 13px 0" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: inv.type === "AP" ? COLORS.red : COLORS.green, background: inv.type === "AP" ? "#FEE2E2" : "#D1FAE5", padding: "2px 8px", borderRadius: 10 }}>{inv.type}</span>
                      </td>
                      <td style={{ padding: "13px 10px 13px 0", fontSize: 12, color: COLORS.muted }}>{inv.project}</td>
                      <td style={{ padding: "13px 10px 13px 0", fontSize: 13, fontWeight: 600 }}>{fmt(inv.amount)}</td>
                      <td style={{ padding: "13px 10px 13px 0", fontSize: 12, color: COLORS.muted }}>{fmt(inv.amount * 0.18)}</td>
                      <td style={{ padding: "13px 10px 13px 0", fontSize: 13, fontWeight: 700, color: COLORS.text }}>{fmt(inv.amount * 1.18 * (1 - 0.02))}</td>
                      <td style={{ padding: "13px 10px 13px 0" }}><StatusBadge status={inv.status} /></td>
                      <td style={{ padding: "13px 10px 13px 0", fontSize: 12, color: new Date(inv.dueDate) < new Date() ? COLORS.red : COLORS.muted, fontWeight: new Date(inv.dueDate) < new Date() ? 700 : 400 }}>{inv.dueDate}</td>
                      <td style={{ padding: "13px 10px 13px 0" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ fontSize: 11, color: COLORS.primary, background: `${COLORS.primary}12`, border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>View</button>
                          {inv.status === "DRAFT" && <button style={{ fontSize: 11, color: COLORS.green, background: `${COLORS.green}12`, border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Submit</button>}
                          {inv.status.startsWith("PENDING") && <button style={{ fontSize: 11, color: COLORS.accent, background: `${COLORS.accent}18`, border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Approve</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BUDGET TAB ── */}
        {activeTab === "Budget" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0 }}>Project Budget Control</h1>
              <button style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: COLORS.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Create Budget</button>
            </div>

            {/* Budget vs Actual Chart */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 4px" }}>Budget vs Actual — All Projects</h2>
              <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 16px" }}>In Crores (₹ Cr)</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={PROJECT_BUDGET_DATA} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={v => `₹${v}Cr`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: COLORS.text }} width={120} />
                  <Tooltip formatter={(val: number) => [`₹${val} Cr`, ""]} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill={`${COLORS.primary}40`} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" name="Actual" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* NH-44 Budget Detail */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 2px" }}>NH-44 Highway — Cost Head Analysis</h2>
                <p style={{ fontSize: 12, color: COLORS.muted }}>BUD-2024-00001 · Version 1 · Approved</p>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    {["Cost Head", "Planned", "Committed", "Actual", "Available", "Utilization", "Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.muted, fontWeight: 700, padding: "0 12px 12px 0", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { head: "Material", planned: 152, committed: 28, actual: 42, color: COLORS.primary },
                    { head: "Labor", planned: 76, committed: 0, actual: 19.8, color: COLORS.green },
                    { head: "Equipment", planned: 57, committed: 9.5, actual: 12.5, color: COLORS.purple },
                    { head: "Subcontractor", planned: 66.5, committed: 14, actual: 21, color: COLORS.accent },
                    { head: "Overhead", planned: 19, committed: 0, actual: 4.5, color: COLORS.slate },
                    { head: "Contingency", planned: 9.5, committed: 0, actual: 0, color: COLORS.muted },
                  ].map(row => {
                    const available = row.planned - row.committed - row.actual;
                    const util = ((row.actual / row.planned) * 100).toFixed(1);
                    const isOver = row.actual > row.planned;
                    const isAtRisk = Number(util) > 65;
                    return (
                      <tr key={row.head} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "13px 12px 13px 0", fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: row.color }} />
                            {row.head}
                          </div>
                        </td>
                        <td style={{ padding: "13px 12px 13px 0", fontSize: 13 }}>₹{row.planned}Cr</td>
                        <td style={{ padding: "13px 12px 13px 0", fontSize: 13, color: COLORS.accent }}>₹{row.committed}Cr</td>
                        <td style={{ padding: "13px 12px 13px 0", fontSize: 13, fontWeight: 600 }}>₹{row.actual}Cr</td>
                        <td style={{ padding: "13px 12px 13px 0", fontSize: 13, color: isOver ? COLORS.red : COLORS.green, fontWeight: 600 }}>₹{available.toFixed(1)}Cr</td>
                        <td style={{ padding: "13px 12px 13px 0", minWidth: 120 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 4, background: COLORS.border }}>
                              <div style={{ height: "100%", width: `${Math.min(Number(util), 100)}%`, background: isOver ? COLORS.red : isAtRisk ? COLORS.accent : COLORS.green, borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 36, color: isOver ? COLORS.red : isAtRisk ? COLORS.accent : COLORS.text }}>{util}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 12px 13px 0" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: isOver ? COLORS.red : isAtRisk ? COLORS.accent : COLORS.green, background: isOver ? "#FEE2E2" : isAtRisk ? "#FFFBEB" : "#D1FAE5", padding: "2px 8px", borderRadius: 10 }}>
                            {isOver ? "Over Budget" : isAtRisk ? "At Risk" : "On Track"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === "Reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0 }}>Reports & Analytics</h1>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { icon: "📊", title: "P&L Statement", desc: "Project-wise profit & loss", tag: "Monthly" },
                { icon: "⚖️", title: "Trial Balance", desc: "Account-level debit/credit summary", tag: "Period" },
                { icon: "💼", title: "Balance Sheet", desc: "Assets, liabilities & equity", tag: "As of Date" },
                { icon: "🧾", title: "GSTR-2A / ITC", desc: "Input tax credit reconciliation", tag: "GST" },
                { icon: "📋", title: "TDS Report 26Q", desc: "Quarterly TDS deduction details", tag: "TDS" },
                { icon: "📈", title: "AP/AR Aging", desc: "Outstanding payables & receivables", tag: "Aging" },
                { icon: "💰", title: "Cash Flow Statement", desc: "Operating, investing, financing flows", tag: "Annual" },
                { icon: "🏗️", title: "Cost Analysis", desc: "Budget vs actual by project", tag: "Project" },
                { icon: "👷", title: "Payroll Summary", desc: "Site-wise salary & deductions", tag: "Monthly" },
              ].map(report => (
                <div key={report.title} style={{
                  background: "#fff", borderRadius: 14, padding: 20, border: `1px solid ${COLORS.border}`,
                  cursor: "pointer", transition: "all 0.15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${COLORS.primary}15`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{report.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{report.title}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>{report.desc}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.primary, background: `${COLORS.primary}12`, padding: "2px 8px", borderRadius: 8, letterSpacing: 0.5 }}>{report.tag}</span>
                    <span style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600 }}>Generate →</span>
                  </div>
                </div>
              ))}
            </div>

            {/* GST Summary */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 16px" }}>GST Summary — Apr 2025</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {[
                  { label: "Output GST (CGST)", amount: "₹18.42 L", tag: "Liability" },
                  { label: "Output GST (SGST)", amount: "₹18.42 L", tag: "Liability" },
                  { label: "Input ITC (CGST)", amount: "₹12.18 L", tag: "Credit" },
                  { label: "Input ITC (SGST)", amount: "₹12.18 L", tag: "Credit" },
                ].map(g => (
                  <div key={g.label} style={{ padding: 16, borderRadius: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>{g.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{g.amount}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: g.tag === "Credit" ? COLORS.green : COLORS.red, fontWeight: 600 }}>{g.tag}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: `${COLORS.primary}08`, border: `1px solid ${COLORS.primary}20` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Net GST Payable (after ITC): </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.primary }}>₹12.48 L</span>
              </div>
            </div>
          </div>
        )}

        {/* ── LEDGER TAB ── */}
        {activeTab === "Ledger" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0 }}>General Ledger</h1>

            {/* Trial Balance Preview */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 4px" }}>Trial Balance</h2>
                  <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>Period: Apr 1, 2025 – Apr 30, 2025</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="date" style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} defaultValue="2025-04-01" />
                  <input type="date" style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} defaultValue="2025-04-30" />
                  <button style={{ padding: "6px 14px", borderRadius: 8, background: COLORS.primary, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Generate</button>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    {["Code", "Account Name", "Type", "Debit (₹)", "Credit (₹)", "Net"].map(h => (
                      <th key={h} style={{ textAlign: h.includes("₹") ? "right" : "left", fontSize: 11, color: COLORS.muted, fontWeight: 700, padding: "0 12px 12px 0", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: "1001", name: "Cash in Hand", type: "ASSET", dr: 125000, cr: 98000 },
                    { code: "1010", name: "HDFC Bank Current A/C", type: "ASSET", dr: 4250000, cr: 2180000 },
                    { code: "1002", name: "Accounts Receivable", type: "ASSET", dr: 47200000, cr: 12500000 },
                    { code: "1020", name: "GST Input Tax Credit", type: "ASSET", dr: 1218000, cr: 0 },
                    { code: "2001", name: "Accounts Payable", type: "LIABILITY", dr: 0, cr: 28400000 },
                    { code: "2010", name: "TDS Payable", type: "LIABILITY", dr: 0, cr: 284000 },
                    { code: "2020", name: "GST Output Tax", type: "LIABILITY", dr: 0, cr: 1842000 },
                    { code: "4001", name: "Contract Revenue", type: "REVENUE", dr: 0, cr: 18500000 },
                    { code: "5001", name: "Material Cost", type: "EXPENSE", dr: 8200000, cr: 0 },
                    { code: "5004", name: "Subcontractor Cost", type: "EXPENSE", dr: 4100000, cr: 0 },
                    { code: "5010", name: "Salary & Wages", type: "EXPENSE", dr: 1850000, cr: 0 },
                  ].map(row => {
                    const net = row.dr - row.cr;
                    const typeColors: Record<string, string> = { ASSET: COLORS.green, LIABILITY: COLORS.red, REVENUE: COLORS.purple, EXPENSE: COLORS.accent };
                    return (
                      <tr key={row.code} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "11px 12px 11px 0", fontSize: 12, fontFamily: "monospace", color: COLORS.muted }}>{row.code}</td>
                        <td style={{ padding: "11px 12px 11px 0", fontSize: 13, fontWeight: 600, color: COLORS.text }}>{row.name}</td>
                        <td style={{ padding: "11px 12px 11px 0" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: typeColors[row.type], background: `${typeColors[row.type]}15`, padding: "2px 6px", borderRadius: 6 }}>{row.type}</span>
                        </td>
                        <td style={{ padding: "11px 12px 11px 0", fontSize: 13, textAlign: "right", color: row.dr > 0 ? COLORS.text : COLORS.muted }}>
                          {row.dr > 0 ? `₹${(row.dr / 100000).toFixed(2)}L` : "-"}
                        </td>
                        <td style={{ padding: "11px 12px 11px 0", fontSize: 13, textAlign: "right", color: row.cr > 0 ? COLORS.text : COLORS.muted }}>
                          {row.cr > 0 ? `₹${(row.cr / 100000).toFixed(2)}L` : "-"}
                        </td>
                        <td style={{ padding: "11px 12px 11px 0", fontSize: 13, textAlign: "right", fontWeight: 700, color: net >= 0 ? COLORS.green : COLORS.red }}>
                          {net >= 0 ? "+" : ""}{`₹${(Math.abs(net) / 100000).toFixed(2)}L`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: `2px solid ${COLORS.border}`, background: COLORS.surface }}>
                    <td colSpan={3} style={{ padding: "12px 12px 12px 0", fontSize: 13, fontWeight: 800, color: COLORS.text }}>TOTALS</td>
                    <td style={{ padding: "12px 12px 12px 0", fontSize: 13, fontWeight: 800, textAlign: "right", color: COLORS.primary }}>₹666.43L</td>
                    <td style={{ padding: "12px 12px 12px 0", fontSize: 13, fontWeight: 800, textAlign: "right", color: COLORS.primary }}>₹637.04L</td>
                    <td style={{ padding: "12px 12px 12px 0" }} />
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 8, background: "#D1FAE5", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>Books are balanced · Difference: ₹0.00</span>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENTS TAB ── */}
        {activeTab === "Payments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0 }}>Payment Processing</h1>
              <button style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: COLORS.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Process Payment</button>
            </div>

            {/* AP Aging */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 16px" }}>AP Aging Summary</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                {[
                  { label: "Current", amount: 12800000, color: COLORS.green },
                  { label: "1–30 Days", amount: 8400000, color: COLORS.accent },
                  { label: "31–60 Days", amount: 5200000, color: "#F97316" },
                  { label: "61–90 Days", amount: 1600000, color: COLORS.red },
                  { label: "90+ Days", amount: 400000, color: "#7F1D1D" },
                ].map(bucket => (
                  <div key={bucket.label} style={{ padding: 16, borderRadius: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6, fontWeight: 600 }}>{bucket.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: bucket.color }}>{fmtLakh(bucket.amount)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent payments */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: `1px solid ${COLORS.border}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: "0 0 16px" }}>Recent Payments</h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    {["Payment #", "Party", "Mode", "Amount", "TDS Deducted", "Net Paid", "Status", "Date", "UTR/Ref"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.muted, fontWeight: 700, padding: "0 10px 12px 0", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "PAY-2024-00008", party: "Ultratech Cement", mode: "NEFT", amount: 3120000, tds: 62400, date: "2025-04-15", status: "COMPLETED", ref: "HDFC24105R123456" },
                    { id: "PAY-2024-00007", party: "Sri Sai Steel", mode: "RTGS", amount: 1875000, tds: 37500, date: "2025-04-12", status: "COMPLETED", ref: "HDFC24102R987654" },
                    { id: "PAY-2024-00006", party: "Ace Equipment", mode: "NEFT", amount: 680000, tds: 13600, date: "2025-04-10", status: "PROCESSING", ref: "Pending" },
                    { id: "PAY-2024-00005", party: "Ultratech Cement", mode: "RTGS", amount: 2840000, tds: 56800, date: "2025-04-05", status: "COMPLETED", ref: "SBIN24095R654321" },
                  ].map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "12px 10px 12px 0", fontSize: 13, fontWeight: 600, color: COLORS.primary }}>{p.id}</td>
                      <td style={{ padding: "12px 10px 12px 0", fontSize: 13 }}>{p.party}</td>
                      <td style={{ padding: "12px 10px 12px 0" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.purple, background: `${COLORS.purple}15`, padding: "2px 8px", borderRadius: 8 }}>{p.mode}</span>
                      </td>
                      <td style={{ padding: "12px 10px 12px 0", fontSize: 13, fontWeight: 600 }}>{fmtLakh(p.amount)}</td>
                      <td style={{ padding: "12px 10px 12px 0", fontSize: 12, color: COLORS.red }}>{fmtLakh(p.tds)}</td>
                      <td style={{ padding: "12px 10px 12px 0", fontSize: 13, fontWeight: 700, color: COLORS.green }}>{fmtLakh(p.amount - p.tds)}</td>
                      <td style={{ padding: "12px 10px 12px 0" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: p.status === "COMPLETED" ? COLORS.green : COLORS.accent,
                          background: p.status === "COMPLETED" ? "#D1FAE5" : "#FFFBEB",
                          padding: "2px 8px", borderRadius: 10
                        }}>{p.status}</span>
                      </td>
                      <td style={{ padding: "12px 10px 12px 0", fontSize: 12, color: COLORS.muted }}>{p.date}</td>
                      <td style={{ padding: "12px 10px 12px 0", fontSize: 11, fontFamily: "monospace", color: COLORS.muted }}>{p.ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
