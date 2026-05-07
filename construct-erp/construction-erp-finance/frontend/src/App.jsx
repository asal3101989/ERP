// ============================================================
// frontend/src/App.jsx
// Main app shell — sidebar + routing between finance module pages
// ============================================================
import { useState, createContext, useContext } from "react";
import FinanceDashboard from "./pages/FinanceDashboard";
import VendorBills from "./pages/VendorBills";
import ClientInvoices from "./pages/ClientInvoices";
import BudgetTracker from "./pages/BudgetTracker";
import InvoiceForm from "./pages/InvoiceForm";
import PaymentForm from "./pages/PaymentForm";

// ── Auth context ──────────────────────────────────────────────
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

// ── Nav structure ─────────────────────────────────────────────
const NAV = [
  { id: "dashboard",   label: "Dashboard",        icon: "📊", group: "Overview" },
  { id: "ap",          label: "Vendor Bills",      icon: "📥", group: "Payables" },
  { id: "payments-out",label: "Make Payment",      icon: "💸", group: "Payables" },
  { id: "ar",          label: "Client Invoices",   icon: "📤", group: "Receivables" },
  { id: "payments-in", label: "Record Receipt",    icon: "💰", group: "Receivables" },
  { id: "budget",      label: "Budget Tracker",    icon: "🎯", group: "Cost Control" },
  { id: "journal",     label: "Journal Entries",   icon: "📒", group: "Ledger" },
  { id: "reports",     label: "Reports",           icon: "📈", group: "Ledger" },
];

// ── Login screen ──────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("admin@constructerp.in");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Login failed"); }
      const data = await res.json();
      localStorage.setItem("erp_token", data.accessToken);
      localStorage.setItem("erp_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">🏗️</div>
          <h1 className="text-2xl font-bold text-gray-900">Construction ERP</h1>
          <p className="text-gray-500 text-sm mt-1">Finance Module</p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm mt-2"
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center font-medium mb-2">Demo credentials</p>
          <div className="space-y-1 text-xs text-gray-500">
            {[
              ["Admin", "admin@constructerp.in"],
              ["Accountant", "accountant@constructerp.in"],
              ["Project Manager", "pm@constructerp.in"],
            ].map(([role, mail]) => (
              <button key={mail} onClick={() => { setEmail(mail); setPassword("Admin@123"); }}
                className="w-full text-left flex justify-between px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
                <span className="font-medium">{role}</span>
                <span className="text-gray-400">{mail}</span>
              </button>
            ))}
            <p className="text-center text-gray-300 mt-1">All passwords: Admin@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ active, onNav, user, onLogout }) {
  const groups = [...new Set(NAV.map(n => n.group))];
  return (
    <aside className="w-56 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm">🏗️</div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">Construction ERP</p>
            <p className="text-[10px] text-slate-400">Finance Module</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {groups.map(group => (
          <div key={group}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">{group}</p>
            {NAV.filter(n => n.group === group).map(item => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  active === item.id
                    ? "bg-blue-600 text-white font-medium shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
            {user?.fullName?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.fullName || "User"}</p>
            <p className="text-[10px] text-slate-500">{user?.role}</p>
          </div>
          <button onClick={onLogout} title="Logout" className="text-slate-500 hover:text-red-400 transition-colors text-sm">⏻</button>
        </div>
      </div>
    </aside>
  );
}

// ── Placeholder pages ─────────────────────────────────────────
function JournalEntriesPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <p className="text-4xl mb-3">📒</p>
      <p className="text-sm font-medium">Journal Entries</p>
      <p className="text-xs mt-1">Manual journal entry creation and GL view</p>
      <p className="text-xs text-blue-500 mt-3">API: GET/POST /api/v1/ledger/journal-entries</p>
    </div>
  );
}

function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <p className="text-4xl mb-3">📈</p>
      <p className="text-sm font-medium">Reports & Analytics</p>
      <p className="text-xs mt-1">P&L, Balance Sheet, Cash Flow Statement, GST, TDS</p>
      <p className="text-xs text-blue-500 mt-3">API: /api/v1/reports/*</p>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
export default function App() {
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem("erp_user") || "null"); } catch { return null; }
  })();
  const hasToken = !!localStorage.getItem("erp_token");

  const [user, setUser] = useState(hasToken ? storedUser : null);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null); // { type: "invoice" | "payment", invoiceType?: string }

  const handleLogout = () => {
    localStorage.removeItem("erp_token");
    localStorage.removeItem("erp_user");
    setUser(null);
  };

  if (!user) return <LoginScreen onLogin={(u) => setUser(u)} />;

  const renderPage = () => {
    switch (page) {
      case "dashboard":    return <FinanceDashboard />;
      case "ap":           return (
        <VendorBills
          onNewInvoice={() => setModal({ type: "invoice", invoiceType: "VENDOR_INVOICE" })}
          onPayInvoice={(inv) => setModal({ type: "payment", preselected: inv })}
        />
      );
      case "ar":           return (
        <ClientInvoices
          onNewInvoice={() => setModal({ type: "invoice", invoiceType: "CLIENT_INVOICE" })}
          onRecordReceipt={(inv) => setModal({ type: "payment", invoiceType: "INCOMING", preselected: inv })}
        />
      );
      case "budget":       return <BudgetTracker />;
      case "payments-out": return <PaymentForm onSuccess={() => setPage("ap")} onCancel={() => setPage("ap")} />;
      case "payments-in":  return <PaymentForm onSuccess={() => setPage("ar")} onCancel={() => setPage("ar")} />;
      case "journal":      return <JournalEntriesPage />;
      case "reports":      return <ReportsPage />;
      default:             return <FinanceDashboard />;
    }
  };

  return (
    <AuthCtx.Provider value={{ user }}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar active={page} onNav={setPage} user={user} onLogout={handleLogout} />

        {/* Main content */}
        <main className="ml-56 min-h-screen">
          <div className="px-6 py-6 max-w-screen-xl">
            {renderPage()}
          </div>
        </main>

        {/* Modal overlay */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-12 px-4 overflow-y-auto">
            <div className="w-full max-w-5xl mb-8">
              {modal.type === "invoice" && (
                <InvoiceForm
                  onSuccess={(inv) => { setModal(null); setPage(modal.invoiceType === "CLIENT_INVOICE" ? "ar" : "ap"); }}
                  onCancel={() => setModal(null)}
                />
              )}
              {modal.type === "payment" && (
                <PaymentForm
                  onSuccess={() => { setModal(null); setPage("ap"); }}
                  onCancel={() => setModal(null)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </AuthCtx.Provider>
  );
}
