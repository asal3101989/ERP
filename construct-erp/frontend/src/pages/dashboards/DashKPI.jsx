// Shared KPI card used by all role dashboards
import React from 'react';

const COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-50',  icon: 'bg-indigo-100 text-indigo-600',  val: 'text-indigo-700' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
  amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600',     val: 'text-amber-700' },
  red:     { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',         val: 'text-red-700' },
  blue:    { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',       val: 'text-blue-700' },
  purple:  { bg: 'bg-purple-50',  icon: 'bg-purple-100 text-purple-600',   val: 'text-purple-700' },
  slate:   { bg: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-600',     val: 'text-slate-700' },
};

export function DashKPI({ label, value, sub, icon: Icon, color = 'indigo', loading }) {
  const c = COLOR_MAP[color] || COLOR_MAP.indigo;
  return (
    <div className={`rounded-xl border border-slate-100 p-4 flex items-start gap-4 bg-white shadow-sm`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
        {loading ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : Icon && <Icon className="w-5 h-5" />}
      </div>
      <div className="min-w-0">
        {loading
          ? <div className="h-7 w-24 bg-slate-100 rounded animate-pulse mb-1" />
          : <p className={`text-2xl font-bold leading-tight ${c.val}`}>{value ?? '—'}</p>
        }
        <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function DashSection({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function DashTable({ cols, rows, empty = 'No records found' }) {
  if (!rows?.length) {
    return <p className="text-center text-xs text-slate-400 py-6">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            {cols.map(c => (
              <th key={c.key} className={`pb-2 text-slate-400 font-semibold uppercase tracking-wide ${c.right ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
              {cols.map(c => (
                <td key={c.key} className={`py-2 pr-3 ${c.right ? 'text-right' : ''} ${c.cls || 'text-slate-600'}`}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const inr = (v) => {
  const n = parseFloat(v || 0);
  if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const Badge = ({ label, cls }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>
);
