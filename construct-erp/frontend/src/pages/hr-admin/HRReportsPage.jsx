import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Download, Users, TrendingDown, Shield, FileText } from 'lucide-react';
import { hrPayrollAPI } from '../../api/client';
import toast from 'react-hot-toast';

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN',{minimumFractionDigits:0})}`;

const REPORT_TABS = [
  { id: 'headcount', label: 'Headcount',    icon: Users },
  { id: 'pf',        label: 'PF ECR',       icon: Shield },
  { id: 'esi',       label: 'ESI Return',   icon: Shield },
  { id: 'payslips',  label: 'Payroll Summary', icon: FileText },
];

// CSV download helper
function downloadCSV(data, filename) {
  if (!data.length) return toast.error('No data to export');
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} downloaded`);
}

function HeadcountTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr-headcount'],
    queryFn: () => hrPayrollAPI.headcount().then(r => r.data),
  });
  const rows = data?.data || [];
  const totals = rows.reduce((acc, r) => ({
    total:     acc.total     + parseInt(r.total     || 0),
    active:    acc.active    + parseInt(r.active    || 0),
    resigned:  acc.resigned  + parseInt(r.resigned  || 0),
    permanent: acc.permanent + parseInt(r.permanent || 0),
    contract:  acc.contract  + parseInt(r.contract  || 0),
    probation: acc.probation + parseInt(r.probation || 0),
  }), { total:0, active:0, resigned:0, permanent:0, contract:0, probation:0 });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-white">Department-wise Headcount</h3>
        <button onClick={() => downloadCSV(rows, 'headcount-report.csv')}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      {isLoading ? <div className="text-center py-8 text-slate-400">Loading…</div> : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-750">
                {['Department','Total','Active','Resigned','Permanent','Contract','Probation'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white font-medium">{r.department || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-white font-bold">{r.total}</td>
                  <td className="px-4 py-3 text-emerald-400">{r.active}</td>
                  <td className="px-4 py-3 text-red-400">{r.resigned}</td>
                  <td className="px-4 py-3 text-blue-400">{r.permanent}</td>
                  <td className="px-4 py-3 text-purple-400">{r.contract}</td>
                  <td className="px-4 py-3 text-amber-400">{r.probation}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-slate-700/50 font-bold border-t border-slate-600">
                <td className="px-4 py-3 text-slate-300">TOTAL</td>
                <td className="px-4 py-3 text-white">{totals.total}</td>
                <td className="px-4 py-3 text-emerald-400">{totals.active}</td>
                <td className="px-4 py-3 text-red-400">{totals.resigned}</td>
                <td className="px-4 py-3 text-blue-400">{totals.permanent}</td>
                <td className="px-4 py-3 text-purple-400">{totals.contract}</td>
                <td className="px-4 py-3 text-amber-400">{totals.probation}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PFECRTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hr-pf-ecr', month, year],
    queryFn: () => hrPayrollAPI.pfEcr({ month, year }).then(r => r.data),
  });
  const rows = data?.data || [];

  const totals = rows.reduce((acc, r) => ({
    basic:       acc.basic       + parseFloat(r.basic       || 0),
    pf_employee: acc.pf_employee + parseFloat(r.pf_employee || 0),
    pf_employer: acc.pf_employer + parseFloat(r.pf_employer || 0),
    total_pf:    acc.total_pf    + parseFloat(r.total_pf    || 0),
  }), { basic:0, pf_employee:0, pf_employer:0, total_pf:0 });

  const exportECR = () => {
    if (!rows.length) return toast.error('No data to export');
    // EPFO ECR format: UAN, MEMBER_NAME, GROSS_WAGES, EPF_WAGES, EPS_WAGES, EPF_CONTRIBUTION, EPS_CONTRIBUTION, NCP_DAYS
    const ecr = rows.map(r => [
      r.uan_number || '',
      r.name,
      parseFloat(r.basic || 0).toFixed(2),
      Math.min(parseFloat(r.basic || 0), 15000).toFixed(2),
      Math.min(parseFloat(r.basic || 0), 15000).toFixed(2),
      parseFloat(r.pf_employee || 0).toFixed(2),
      (Math.min(parseFloat(r.basic || 0), 15000) * 0.0833).toFixed(2),
      '0',
    ].join('#~#'));
    const content = ['#~#', ...ecr].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `PF-ECR-${MONTHS[month]}-${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PF ECR file downloaded');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={() => downloadCSV(rows, `pf-report-${MONTHS[month]}-${year}.csv`)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={exportECR}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> EPFO ECR File
          </button>
        </div>
      </div>

      {isLoading ? <div className="text-center py-8 text-slate-400">Loading…</div> : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Employee Name','UAN','PF Account','Basic Wages','PF (Employee)','PF (Employer)','Total PF'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{r.uan_number || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{r.pf_account_number || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt(r.basic)}</td>
                  <td className="px-4 py-3 text-blue-400">{fmt(r.pf_employee)}</td>
                  <td className="px-4 py-3 text-purple-400">{fmt(r.pf_employer)}</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold">{fmt(r.total_pf)}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="bg-slate-700/50 font-bold border-t border-slate-600">
                  <td className="px-4 py-3 text-slate-300" colSpan={3}>TOTAL ({rows.length} employees)</td>
                  <td className="px-4 py-3 text-white">{fmt(totals.basic)}</td>
                  <td className="px-4 py-3 text-blue-400">{fmt(totals.pf_employee)}</td>
                  <td className="px-4 py-3 text-purple-400">{fmt(totals.pf_employer)}</td>
                  <td className="px-4 py-3 text-emerald-400">{fmt(totals.total_pf)}</td>
                </tr>
              )}
              {!rows.length && <tr><td colSpan={7} className="text-center py-8 text-slate-500">No PF data for {MONTHS[month]} {year}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ESIReturnTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['hr-esi-return', month, year],
    queryFn: () => hrPayrollAPI.esiReturn({ month, year }).then(r => r.data),
  });
  const rows = data?.data || [];
  const totals = rows.reduce((acc, r) => ({
    gross: acc.gross + parseFloat(r.gross_earnings || 0),
    emp:   acc.emp   + parseFloat(r.esi_employee   || 0),
    er:    acc.er    + parseFloat(r.esi_employer    || 0),
    total: acc.total + parseFloat(r.total_esi       || 0),
  }), { gross:0, emp:0, er:0, total:0 });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => downloadCSV(rows, `esi-return-${MONTHS[month]}-${year}.csv`)} className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>
      {isLoading ? <div className="text-center py-8 text-slate-400">Loading…</div> : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Employee','ESI Number','Gross Wages','ESI (0.75%)','ESI Employer (3.25%)','Total ESI'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{r.esi_number || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt(r.gross_earnings)}</td>
                  <td className="px-4 py-3 text-blue-400">{fmt(r.esi_employee)}</td>
                  <td className="px-4 py-3 text-purple-400">{fmt(r.esi_employer)}</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold">{fmt(r.total_esi)}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="bg-slate-700/50 font-bold border-t border-slate-600">
                  <td className="px-4 py-3 text-slate-300" colSpan={2}>TOTAL ({rows.length})</td>
                  <td className="px-4 py-3 text-white">{fmt(totals.gross)}</td>
                  <td className="px-4 py-3 text-blue-400">{fmt(totals.emp)}</td>
                  <td className="px-4 py-3 text-purple-400">{fmt(totals.er)}</td>
                  <td className="px-4 py-3 text-emerald-400">{fmt(totals.total)}</td>
                </tr>
              )}
              {!rows.length && <tr><td colSpan={6} className="text-center py-8 text-slate-500">No ESI data for {MONTHS[month]} {year}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PayrollSummaryTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['hr-payroll-summary', month, year],
    queryFn: () => hrPayrollAPI.list({ month, year }).then(r => r.data),
  });
  const records = data?.data || [];
  const totals  = data?.totals || {};

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => downloadCSV(records.map(r => ({
          employee: r.employee_name, code: r.employee_code, dept: r.department_name,
          gross: r.gross_earnings, pf: r.pf_employee, esi: r.esi_employee, pt: r.pt, tds: r.tds,
          deductions: r.total_deductions, net: r.net_pay, status: r.status,
        })), `payroll-${MONTHS[month]}-${year}.csv`)}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Employees',       value: records.length,         color: 'text-white' },
          { label: 'Gross Payable',   value: fmt(totals.gross_earnings),  color: 'text-blue-400' },
          { label: 'Total Deductions',value: fmt(totals.total_deductions), color: 'text-red-400' },
          { label: 'Net Payable',     value: fmt(totals.net_pay),    color: 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div className="text-slate-500 text-xs mb-1">{c.label}</div>
            <div className={`font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {isLoading ? <div className="text-center py-8 text-slate-400">Loading…</div> : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Employee','Dept','Gross','PF','ESI','PT','TDS','Deductions','Net Pay','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-3 py-2.5 text-white font-medium">{r.employee_name}</td>
                  <td className="px-3 py-2.5 text-slate-400">{r.department_name || '—'}</td>
                  <td className="px-3 py-2.5 text-white">{fmt(r.gross_earnings)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{fmt(r.pf_employee)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{fmt(r.esi_employee)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{fmt(r.pt)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{fmt(r.tds)}</td>
                  <td className="px-3 py-2.5 text-red-400">{fmt(r.total_deductions)}</td>
                  <td className="px-3 py-2.5 text-emerald-400 font-bold">{fmt(r.net_pay)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status==='paid' ? 'bg-emerald-900/30 text-emerald-400' : r.status==='approved' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={10} className="text-center py-8 text-slate-500">No payroll for {MONTHS[month]} {year}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HRReportsPage() {
  const [activeTab, setActiveTab] = useState('headcount');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 rounded-lg"><FileBarChart className="w-6 h-6 text-blue-400" /></div>
        <div>
          <h1 className="text-2xl font-bold text-white">HR Reports</h1>
          <p className="text-sm text-slate-400">Headcount, PF ECR, ESI returns & payroll summary</p>
        </div>
      </div>

      <div className="border-b border-slate-700 flex gap-1 overflow-x-auto">
        {REPORT_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'headcount' && <HeadcountTab />}
      {activeTab === 'pf'        && <PFECRTab />}
      {activeTab === 'esi'       && <ESIReturnTab />}
      {activeTab === 'payslips'  && <PayrollSummaryTab />}
    </div>
  );
}
