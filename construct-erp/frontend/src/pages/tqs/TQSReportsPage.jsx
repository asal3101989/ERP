import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tqsBillsAPI, projectAPI } from '../../api/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart3, Printer, Download, AlertTriangle, Calendar, Users,
  FileText, CreditCard, IndianRupee, Clock, CheckCircle2,
  TrendingUp, Receipt, ChevronDown, Filter, X, FileBarChart,
  Layers, Package, Activity,
} from 'lucide-react';

// ─── Formatters ────────────────────────────────────────────────────────────────
const inr  = (v) => Math.round(Number(v || 0)).toLocaleString('en-IN');
const fmt  = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
const lakhs = (v) => (Number(v || 0) / 100000).toFixed(2);

function getCurrentFY() {
  const m = new Date().getMonth() + 1;
  const y = new Date().getFullYear();
  return m >= 4 ? y : y - 1;
}

function getFYBounds(fy) {
  return { start: new Date(`${fy}-04-01`), end: new Date(`${fy + 1}-03-31T23:59:59`) };
}

// ─── Reusable table components ─────────────────────────────────────────────────
function Th({ children, right, center }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 whitespace-nowrap print:whitespace-normal print:px-2 print:py-1.5
      ${right ? 'text-right' : center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
}
function Td({ children, right, center, bold, color, mono, small }) {
  return (
    <td className={`px-3 py-2.5 border-b border-slate-50 whitespace-nowrap print:whitespace-normal print:px-2 print:py-1.5
      ${right ? 'text-right' : center ? 'text-center' : ''}
      ${bold ? 'font-semibold' : ''}
      ${mono ? 'font-mono text-xs' : small ? 'text-xs' : 'text-sm'}
      ${color || 'text-slate-700'}`}>
      {children}
    </td>
  );
}
function TotRow({ cols }) {
  return (
    <tr className="bg-indigo-50">
      {cols.map((c, i) => (
        <td key={i} className={`px-3 py-2.5 text-sm font-bold whitespace-nowrap
          ${c.right ? 'text-right' : ''} ${c.color || 'text-indigo-700'}`}>
          {c.v}
        </td>
      ))}
    </tr>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:             { label: 'Pending',     cls: 'bg-amber-100 text-amber-700' },
  stores:              { label: 'Stores',      cls: 'bg-blue-100 text-blue-700' },
  document_controller: { label: 'Doc Ctrl',    cls: 'bg-cyan-100 text-cyan-700' },
  qs:                  { label: 'QS',          cls: 'bg-indigo-100 text-indigo-700' },
  accounts:            { label: 'Accounts',    cls: 'bg-purple-100 text-purple-700' },
  procurement:         { label: 'Procurement', cls: 'bg-orange-100 text-orange-700' },
  paid:                { label: 'Paid',        cls: 'bg-emerald-100 text-emerald-700' },
};
function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}

// ─── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ id, title, subtitle, icon: Icon, color = 'indigo', actions, children, landscape }) {
  const cols = { indigo: 'text-indigo-600', amber: 'text-amber-500', emerald: 'text-emerald-500', red: 'text-red-500', violet: 'text-violet-600' };
  return (
    <div id={id} data-report-section {...(landscape ? { 'data-print-landscape': '' } : {})}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:overflow-visible print:rounded-none print:shadow-none print:border-0 print:mb-4">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${cols[color]}`} />
          <div>
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="section-actions flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── PDF helper ────────────────────────────────────────────────────────────────
function pdfHeader(doc, title, sub) {
  doc.setFontSize(14); doc.setTextColor(30);
  doc.text('BCIM Engineering Pvt. Ltd.', 40, 30);
  doc.setFontSize(11); doc.setTextColor(79, 70, 229);
  doc.text(title, 40, 44);
  doc.setFontSize(8); doc.setTextColor(100);
  doc.text(sub, 40, 55);
  doc.setDrawColor(200); doc.line(40, 60, doc.internal.pageSize.width - 40, 60);
}

// ─── Report tabs ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'summary',    label: 'Summary',          icon: BarChart3 },
  { key: 'register',  label: 'Bill Register',     icon: FileText },
  { key: 'status',    label: 'Status-wise',       icon: Layers },
  { key: 'monthly',   label: 'Month-wise',        icon: Calendar },
  { key: 'vendor',    label: 'Vendor-wise',       icon: Users },
  { key: 'aging',     label: 'Aging / Overdue',   icon: Clock },
  { key: 'gst',       label: 'GST Summary',       icon: Receipt },
  { key: 'payment',   label: 'Payment Register',  icon: CreditCard },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function TQSReportsPage() {
  const [tab, setTab]           = useState('summary');
  const [fy, setFy]             = useState(getCurrentFY());
  const [projectFilter, setPF]  = useState('');
  const [statusFilter, setSF]   = useState('');
  const printRef = useRef();

  const fyLabel = `FY ${fy}-${String(fy + 1).slice(2)}`;
  const { start: fyStart, end: fyEnd } = getFYBounds(fy);

  const { data: allBills = [], isLoading } = useQuery({
    queryKey: ['tqs-bills-all'],
    queryFn: () => tqsBillsAPI.list({ limit: 5000 }).then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
    staleTime: 60000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.projects ?? d?.data ?? []); }),
  });

  const projectName = projects.find(p => p.id === projectFilter)?.name || 'All Projects';

  // Apply FY + project + status filters
  const bills = useMemo(() => allBills.filter(b => {
    const dt = new Date(b.inv_date || b.created_at);
    const inFY = dt >= fyStart && dt <= fyEnd;
    const inProject = !projectFilter || b.project_id === projectFilter;
    const inStatus  = !statusFilter  || b.workflow_status === statusFilter;
    return inFY && inProject && inStatus;
  }), [allBills, fyStart, fyEnd, projectFilter, statusFilter]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totBasic     = bills.reduce((s, b) => s + parseFloat(b.basic_amount || 0), 0);
  const totGst       = bills.reduce((s, b) => s + parseFloat(b.gst_amount || 0), 0);
  const totInvoice   = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const totCertified = bills.reduce((s, b) => s + parseFloat(b.certified_net || 0), 0);
  const totPaid      = bills.reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);
  const totBalance   = totCertified - totPaid;

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statusGroups = useMemo(() => {
    const map = {};
    Object.keys(STATUS_CFG).forEach(k => { map[k] = { count: 0, basic: 0, total: 0, certified: 0, paid: 0 }; });
    bills.forEach(b => {
      const s = b.workflow_status;
      if (!map[s]) map[s] = { count: 0, basic: 0, total: 0, certified: 0, paid: 0 };
      map[s].count++;
      map[s].basic     += parseFloat(b.basic_amount || 0);
      map[s].total     += parseFloat(b.total_amount || 0);
      map[s].certified += parseFloat(b.certified_net || 0);
      map[s].paid      += parseFloat(b.paid_amount || 0);
    });
    return map;
  }, [bills]);

  // ── Month-wise ─────────────────────────────────────────────────────────────
  const monthRows = useMemo(() => {
    const map = {};
    bills.forEach(b => {
      const dt  = new Date(b.inv_date || b.created_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const lbl = dt.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      if (!map[key]) map[key] = { key, label: lbl, bills: 0, basic: 0, gst: 0, total: 0, certified: 0, paid: 0 };
      map[key].bills++;
      map[key].basic     += parseFloat(b.basic_amount || 0);
      map[key].gst       += parseFloat(b.gst_amount || 0);
      map[key].total     += parseFloat(b.total_amount || 0);
      map[key].certified += parseFloat(b.certified_net || 0);
      map[key].paid      += parseFloat(b.paid_amount || 0);
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [bills]);

  // ── Vendor-wise ────────────────────────────────────────────────────────────
  const vendorRows = useMemo(() => {
    const map = {};
    bills.forEach(b => {
      const v = b.vendor_name || 'Unknown';
      if (!map[v]) map[v] = { vendor: v, bills: 0, basic: 0, gst: 0, total: 0, certified: 0, paid: 0 };
      map[v].bills++;
      map[v].basic     += parseFloat(b.basic_amount || 0);
      map[v].gst       += parseFloat(b.gst_amount || 0);
      map[v].total     += parseFloat(b.total_amount || 0);
      map[v].certified += parseFloat(b.certified_net || 0);
      map[v].paid      += parseFloat(b.paid_amount || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [bills]);

  // ── Aging analysis ─────────────────────────────────────────────────────────
  const today = new Date();
  const agingRows = useMemo(() => {
    return bills
      .filter(b => b.workflow_status !== 'paid' && parseFloat(b.certified_net || 0) > 0)
      .map(b => {
        const certDate = new Date(b.updated_at || b.created_at);
        const days = Math.floor((today - certDate) / 86400000);
        const balance = parseFloat(b.certified_net || 0) - parseFloat(b.paid_amount || 0);
        return { ...b, days, balance };
      })
      .sort((a, b) => b.days - a.days);
  }, [bills]);

  const agingBuckets = useMemo(() => {
    const b = { '0-30': 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };
    const a = { '0-30': 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };
    agingRows.forEach(r => {
      const k = r.days <= 30 ? '0-30' : r.days <= 60 ? '31-60' : r.days <= 90 ? '61-90' : r.days <= 120 ? '91-120' : '120+';
      b[k]++; a[k] += r.balance;
    });
    return Object.entries(b).map(([range, count]) => ({ range, count, amount: a[range] }));
  }, [agingRows]);

  // ── GST Summary ────────────────────────────────────────────────────────────
  const gstMonthRows = useMemo(() => {
    const map = {};
    bills.forEach(b => {
      const dt  = new Date(b.inv_date || b.created_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const lbl = dt.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      if (!map[key]) map[key] = { key, label: lbl, bills: 0, basic: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, total: 0 };
      map[key].bills++;
      map[key].basic    += parseFloat(b.basic_amount || 0);
      map[key].cgst     += parseFloat(b.cgst_amt || 0);
      map[key].sgst     += parseFloat(b.sgst_amt || 0);
      map[key].igst     += parseFloat(b.igst_amt || 0);
      map[key].totalGst += parseFloat(b.gst_amount || 0);
      map[key].total    += parseFloat(b.total_amount || 0);
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [bills]);

  // ── Payment register ───────────────────────────────────────────────────────
  const paymentRows = useMemo(() =>
    bills.filter(b => parseFloat(b.paid_amount || 0) > 0).sort((a, b) =>
      new Date(b.inv_date || b.created_at) - new Date(a.inv_date || a.created_at)
    ), [bills]);

  // ══ PDF Exports ═══════════════════════════════════════════════════════════════
  const subLine = `${fyLabel}  |  ${projectName}  |  Generated: ${new Date().toLocaleString('en-IN')}`;

  function exportSummaryPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — Summary Report', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['Total Bills', 'Invoice Value (₹)', 'QS Certified (₹)', 'Paid (₹)', 'Balance Pending (₹)']],
      body: [[bills.length, inr(totInvoice), inr(totCertified), inr(totPaid), inr(totBalance)]],
      styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] },
    });
    // Status breakdown
    doc.setFontSize(10); doc.setTextColor(40);
    doc.text('Workflow Status Breakdown', 40, doc.lastAutoTable.finalY + 20);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 28,
      head: [['Status', 'Bills', 'Invoice Total (₹)', 'Certified (₹)', 'Paid (₹)']],
      body: Object.entries(STATUS_CFG).map(([k, cfg]) => {
        const g = statusGroups[k] || { count: 0, total: 0, certified: 0, paid: 0 };
        return [cfg.label, g.count, inr(g.total), inr(g.certified), inr(g.paid)];
      }),
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`TQS-Summary-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  function exportBillRegisterPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — Bill Register', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['SL No','Vendor','Invoice #','Inv Date','Month','PO/WO','Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)','Status']],
      body: bills.map(b => [
        b.sl_number, b.vendor_name, b.inv_number, fmt(b.inv_date),
        b.inv_month || '—', b.po_number || '—',
        inr(b.basic_amount), inr(b.gst_amount), inr(b.total_amount),
        inr(b.certified_net), inr(b.paid_amount),
        STATUS_CFG[b.workflow_status]?.label || b.workflow_status,
      ]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`TQS-BillRegister-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  function exportStatusPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — Status-wise Report', subLine);
    let y = 70;
    for (const [k, cfg] of Object.entries(STATUS_CFG)) {
      const stageBills = bills.filter(b => b.workflow_status === k);
      if (stageBills.length === 0) continue;
      const stageTotal = stageBills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
      doc.setFontSize(9); doc.setTextColor(40);
      doc.text(`${cfg.label}  —  ${stageBills.length} bills  |  Total: ₹${inr(stageTotal)}`, 40, y + 10);
      autoTable(doc, {
        startY: y + 18,
        head: [['SL No','Vendor','Invoice #','Inv Date','PO/WO','Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)']],
        body: stageBills.map(b => [
          b.sl_number, b.vendor_name, b.inv_number, fmt(b.inv_date), b.po_number || '—',
          inr(b.basic_amount), inr(b.gst_amount), inr(b.total_amount), inr(b.certified_net), inr(b.paid_amount),
        ]),
        styles: { fontSize: 7 }, headStyles: { fillColor: [30, 58, 95] },
      });
      y = doc.lastAutoTable.finalY + 20;
      if (y > 500) { doc.addPage(); y = 40; }
    }
    doc.save(`TQS-StatusWise-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  function exportMonthlyPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — Month-wise Summary', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['Month','Bills','Basic (₹)','GST (₹)','Invoice Total (₹)','Certified (₹)','Paid (₹)','Balance (₹)']],
      body: [
        ...monthRows.map(m => [m.label, m.bills, inr(m.basic), inr(m.gst), inr(m.total), inr(m.certified), inr(m.paid), inr(m.total - m.paid)]),
        ['TOTAL', bills.length, inr(totBasic), inr(totGst), inr(totInvoice), inr(totCertified), inr(totPaid), inr(totBalance)],
      ],
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] },
      didParseCell: d => { if (d.row.index === monthRows.length) d.cell.styles.fontStyle = 'bold'; },
    });
    doc.save(`TQS-Monthly-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  function exportVendorPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — Vendor-wise Summary', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['Vendor','Bills','Basic (₹)','GST (₹)','Invoice Total (₹)','Certified (₹)','Paid (₹)','Balance (₹)']],
      body: [
        ...vendorRows.map(v => [v.vendor, v.bills, inr(v.basic), inr(v.gst), inr(v.total), inr(v.certified), inr(v.paid), inr(v.total - v.paid)]),
        ['TOTAL', bills.length, inr(totBasic), inr(totGst), inr(totInvoice), inr(totCertified), inr(totPaid), inr(totBalance)],
      ],
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`TQS-Vendors-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  function exportAgingPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — Aging / Outstanding Report', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['Aging Bucket','Bills Count','Outstanding Amount (₹)']],
      body: agingBuckets.map(r => [`${r.range} days`, r.count, inr(r.amount)]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [220, 38, 38] },
    });
    doc.addPage();
    pdfHeader(doc, 'Outstanding Bills Detail', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['SL No','Vendor','Invoice #','Inv Date','Certified (₹)','Paid (₹)','Balance (₹)','Days Outstanding','Status']],
      body: agingRows.map(b => [
        b.sl_number, b.vendor_name, b.inv_number, fmt(b.inv_date),
        inr(b.certified_net), inr(b.paid_amount), inr(b.balance),
        `${b.days} days`, STATUS_CFG[b.workflow_status]?.label || b.workflow_status,
      ]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [220, 38, 38] },
    });
    doc.save(`TQS-Aging-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  function exportGSTPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — GST Summary', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['Month','Bills','Basic (₹)','CGST (₹)','SGST (₹)','IGST (₹)','Total GST (₹)','Invoice Total (₹)']],
      body: [
        ...gstMonthRows.map(m => [m.label, m.bills, inr(m.basic), inr(m.cgst), inr(m.sgst), inr(m.igst), inr(m.totalGst), inr(m.total)]),
        ['TOTAL', bills.length,
          inr(totBasic),
          inr(gstMonthRows.reduce((s,m)=>s+m.cgst,0)),
          inr(gstMonthRows.reduce((s,m)=>s+m.sgst,0)),
          inr(gstMonthRows.reduce((s,m)=>s+m.igst,0)),
          inr(totGst), inr(totInvoice)],
      ],
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`TQS-GST-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  function exportPaymentPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdfHeader(doc, 'TQS Tracker — Payment Register', subLine);
    autoTable(doc, {
      startY: 70,
      head: [['SL No','Vendor','Invoice #','Inv Date','Invoice Total (₹)','Certified (₹)','Paid (₹)','Balance (₹)','Status']],
      body: [
        ...paymentRows.map(b => [
          b.sl_number, b.vendor_name, b.inv_number, fmt(b.inv_date),
          inr(b.total_amount), inr(b.certified_net), inr(b.paid_amount),
          inr(parseFloat(b.certified_net||0) - parseFloat(b.paid_amount||0)),
          STATUS_CFG[b.workflow_status]?.label || b.workflow_status,
        ]),
        ['', 'TOTAL', '', '', inr(paymentRows.reduce((s,b)=>s+parseFloat(b.total_amount||0),0)),
          inr(paymentRows.reduce((s,b)=>s+parseFloat(b.certified_net||0),0)),
          inr(paymentRows.reduce((s,b)=>s+parseFloat(b.paid_amount||0),0)), '', ''],
      ],
      styles: { fontSize: 7 }, headStyles: { fillColor: [5, 150, 105] },
    });
    doc.save(`TQS-Payments-${fyLabel.replace(/\s/g, '-')}.pdf`);
  }

  const exportAll = () => {
    exportSummaryPDF(); exportMonthlyPDF(); exportVendorPDF();
    exportAgingPDF(); exportGSTPDF(); exportPaymentPDF();
  };

  // ══ Empty / loading ════════════════════════════════════════════════════════
  const EmptyState = ({ msg = 'No data for selected period' }) => (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <FileBarChart className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm font-medium">{msg}</p>
    </div>
  );

  const ExportBtn = ({ onClick, label = 'Export PDF' }) => (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
      <Download className="w-3.5 h-3.5" /> {label}
    </button>
  );

  // Print a specific section — auto-detects landscape, handles nested sections
  const printSection = (sectionId) => {
    const target = document.getElementById(sectionId);
    if (!target) { window.print(); return; }
    const landscape = target.hasAttribute('data-print-landscape');
    const style = document.createElement('style');
    style.id = '__tqs-print-iso__';
    style.textContent = `
      @media print {
        ${landscape ? '@page { size: A4 landscape; margin: 10mm 12mm 14mm 12mm; }' : '@page { size: A4 portrait; margin: 14mm 12mm 18mm 12mm; }'}
        /* Unlock ALL scroll/height containers so content isn't clipped to 1 page */
        html, body, #root,
        body > div, body > div > div, body > div > div > div,
        main { height: auto !important; max-height: none !important; overflow: visible !important; }
        /* Hide all report sections except the target */
        [data-report-section]:not(#${sectionId}) { display: none !important; }
        /* Re-show nested sections INSIDE the target */
        #${sectionId} [data-report-section] { display: block !important; }
        #${sectionId} { display: block !important; page-break-inside: auto !important; break-inside: auto !important; overflow: visible !important; }
        thead { display: table-header-group !important; }
        tbody tr { page-break-inside: avoid; break-inside: avoid; }
        tfoot { display: table-footer-group !important; }
        .print-doc-header { display: block !important; margin-bottom: 8px !important; }
        .kpi-strip-print { display: none !important; }
        nav, aside, header, button, select, .section-actions { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const PrintBtn = ({ sectionId }) => (
    <button onClick={() => printSection(sectionId)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
      <Printer className="w-3.5 h-3.5" /> Print
    </button>
  );

  const BtnGroup = ({ sectionId, onExport, exportLabel = 'Export PDF' }) => (
    <div className="flex items-center gap-2">
      <PrintBtn sectionId={sectionId} />
      <ExportBtn onClick={onExport} label={exportLabel} />
    </div>
  );

  // ── Render active report ───────────────────────────────────────────────────
  const activeTab = TABS.find(t => t.key === tab);

  return (
    <>
      {/* ── Print Stylesheet ─────────────────────────────────────────────── */}
      <style>{`
        /* ── Default: Portrait A4 ─────────────────── */
        @page { size: A4 portrait; margin: 14mm 12mm 18mm 12mm; }

        /* ── Landscape override for wide tables ──── */
        @page :landscape { size: A4 landscape; margin: 12mm 14mm 16mm 14mm; }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
          body, html { background: #fff !important; font-family: 'Segoe UI', Arial, sans-serif !important; }

          /* ── CRITICAL: unlock the layout scroll containers so ALL pages print ── */
          html, body, #root,
          body > div, body > div > div,
          body > div > div > div {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          main {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          /* ── Hide all chrome/nav/buttons ── */
          nav, aside, header,
          .print-hide, [data-print-hide],
          button, select { display: none !important; }

          /* ── Page footer with page numbers ── */
          @page { @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #64748b; } }

          /* ── Document header ── */
          .print-doc-header {
            display: block !important;
            margin-bottom: 10px;
            padding: 10px 14px 10px;
            background: #1e3a5f !important;
            color: #fff !important;
            border-radius: 4px;
          }
          .print-doc-header * { color: #fff !important; }

          /* ── KPI strip ── */
          .print-kpi-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
          }
          .kpi-strip-print { padding: 8px 0 !important; }

          /* ── Section cards ── */
          [data-report-section] {
            overflow: visible !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 4px !important;
            box-shadow: none !important;
            margin-bottom: 16px !important;
            /* Allow sections to break across pages — tables can be long */
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          [data-report-section] .section-actions { display: none !important; }
          .overflow-x-auto { overflow: visible !important; }

          /* Keep table header on every page */
          thead { display: table-header-group !important; }
          /* Don't split individual rows across pages */
          tbody tr { page-break-inside: avoid; break-inside: avoid; }
          /* Keep tfoot together */
          tfoot { display: table-footer-group !important; page-break-inside: avoid; }

          /* ── PROFESSIONAL TABLE STYLES ── */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 7.5pt !important;
            overflow: visible !important;
            table-layout: fixed;
          }
          thead tr {
            background: #1e3a5f !important;
            color: #fff !important;
          }
          thead th {
            background: #1e3a5f !important;
            color: #fff !important;
            font-size: 6.5pt !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
            padding: 5px 6px !important;
            border: 0.5pt solid #1e3a5f !important;
            white-space: nowrap;
          }
          tbody tr:nth-child(even) { background: #f8fafc !important; }
          tbody tr:nth-child(odd)  { background: #ffffff !important; }
          tbody td {
            padding: 4px 6px !important;
            font-size: 7.5pt !important;
            border: 0.5pt solid #e2e8f0 !important;
            vertical-align: middle;
            white-space: normal;
            word-break: break-word;
          }
          tfoot tr {
            background: #f0f4ff !important;
            border-top: 1.5pt solid #1e3a5f !important;
          }
          tfoot td {
            padding: 5px 6px !important;
            font-size: 7.5pt !important;
            font-weight: 700 !important;
            border: 0.5pt solid #cbd5e1 !important;
            color: #1e3a5f !important;
          }

          /* ── Amount columns: never wrap, right-align ── */
          .col-amount {
            white-space: nowrap !important;
            text-align: right !important;
            font-variant-numeric: tabular-nums !important;
          }
          .col-mono {
            font-family: 'Courier New', monospace !important;
            font-size: 7pt !important;
            white-space: nowrap !important;
          }
          .col-badge {
            white-space: nowrap !important;
          }

          /* ── Bill Register specific column widths (landscape) ── */
          #rpt-bill-register table { table-layout: fixed; }
          #rpt-bill-register col.c-sl   { width: 28pt; }
          #rpt-bill-register col.c-ven  { width: 85pt; }
          #rpt-bill-register col.c-inv  { width: 68pt; }
          #rpt-bill-register col.c-date { width: 44pt; }
          #rpt-bill-register col.c-mon  { width: 38pt; }
          #rpt-bill-register col.c-po   { width: 72pt; }
          #rpt-bill-register col.c-desc { width: 90pt; }
          #rpt-bill-register col.c-amt  { width: 54pt; }
          #rpt-bill-register col.c-stat { width: 44pt; }

          /* ── Section title ── */
          [data-report-section] > div:first-child {
            background: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 7px 12px !important;
          }
          [data-report-section] > div:first-child h2 {
            font-size: 9pt !important;
            font-weight: 700 !important;
            color: #1e293b !important;
          }
          [data-report-section] > div:first-child p {
            font-size: 7pt !important;
            color: #64748b !important;
          }

          /* ── Status badges ── */
          span[class*="rounded-full"] {
            font-size: 6pt !important;
            padding: 1px 4px !important;
            border-radius: 2px !important;
          }

          /* ── Progress bars ── */
          .h-1\\.5 { height: 3pt !important; }
        }
      `}</style>

      {/* ── Print-only document header ───────────────────────────────────── */}
      <div className="print-doc-header hidden" style={{ display: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, opacity: 0.8 }}>
              BCIM Engineering Pvt. Ltd.
            </p>
            <h1 style={{ fontSize: '15pt', fontWeight: 900, margin: '3px 0 2px', letterSpacing: '-0.01em' }}>
              TQS Invoice Tracker — Reports
            </h1>
            <p style={{ fontSize: '8pt', margin: 0, opacity: 0.85 }}>
              {fyLabel} &nbsp;&bull;&nbsp; {projectName}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '7pt', opacity: 0.75, marginTop: '4px' }}>
            <div>Generated: {new Date().toLocaleString('en-IN')}</div>
            <div style={{ marginTop: '2px' }}>CONFIDENTIAL</div>
          </div>
        </div>
      </div>

      <div ref={printRef} className="flex flex-col gap-0 bg-[#f4f6f9] min-h-full print:bg-white">

        {/* ── Page Header ── */}
        <div className="px-6 pt-5 pb-0 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">TQS Reports</h1>
                <p className="text-xs text-slate-500">Invoice register · status · aging · GST · payment reports</p>
              </div>
            </div>

            {/* Global controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                value={fy} onChange={e => setFy(Number(e.target.value))}>
                {[2026, 2025, 2024, 2023].map(y => (
                  <option key={y} value={y}>FY {y}-{String(y + 1).slice(2)}</option>
                ))}
              </select>
              <select
                className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                value={projectFilter} onChange={e => setPF(e.target.value)}>
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                value={statusFilter} onChange={e => setSF(e.target.value)}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={exportAll}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm">
                <Download className="w-4 h-4" /> Export All
              </button>
            </div>
          </div>

          {/* Active filter bar */}
          {(projectFilter || statusFilter) && (
            <div className="flex items-center gap-2 mb-3 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Filtered by:</span>
              {projectFilter && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">{projectName}</span>}
              {statusFilter && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">{STATUS_CFG[statusFilter]?.label}</span>}
              <button onClick={() => { setPF(''); setSF(''); }} className="ml-1 text-slate-400 hover:text-red-500 flex items-center gap-0.5">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          )}

          {/* ── Tab nav ── */}
          <div className="flex gap-1 overflow-x-auto pb-0 border-b border-slate-200">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all
                    ${active ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {active && (
                    <span className="ml-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                      {bills.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── KPI Strip (always visible) ── */}
        <div className="kpi-strip-print px-6 py-4 print:px-0 print:py-2">
          <div className="print-kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: `${fyLabel} Bills`,  value: bills.length,         icon: FileText,    color: 'bg-indigo-600' },
              { label: 'Invoice Value',      value: `₹${inr(totInvoice)}`, icon: IndianRupee, color: 'bg-blue-600' },
              { label: 'QS Certified',       value: `₹${inr(totCertified)}`, icon: CheckCircle2, color: 'bg-violet-600' },
              { label: 'Amount Paid',        value: `₹${inr(totPaid)}`,   icon: CreditCard,  color: 'bg-emerald-600' },
              { label: 'Balance Pending',    value: `₹${inr(totBalance)}`, icon: Clock,      color: 'bg-amber-500' },
              { label: 'Overdue Bills',      value: agingRows.length,     icon: AlertTriangle, color: 'bg-red-500' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-100 p-3.5 flex items-center gap-3 shadow-sm">
                <div className={`${k.color} w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <k.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{k.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{k.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Report Content ── */}
        <div className="px-6 pb-8 space-y-5 flex-1">

          {/* ══ SUMMARY ══════════════════════════════════════════════════════ */}
          {tab === 'summary' && (
            <>
              {/* Status breakdown cards */}
              <SectionCard id="rpt-summary-status" title="Workflow Status Breakdown" subtitle="Bills count and value at each stage" icon={Layers}
                actions={<BtnGroup sectionId="rpt-summary-status" onExport={exportSummaryPDF} />}>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {Object.entries(STATUS_CFG).map(([k, cfg]) => {
                    const g = statusGroups[k] || { count: 0, total: 0 };
                    return (
                      <div key={k} className={`rounded-xl border p-3 text-center ${g.count > 0 ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                        <p className="text-2xl font-black text-slate-800">{g.count}</p>
                        <StatusBadge status={k} />
                        <p className="text-[10px] text-slate-500 mt-1.5">₹{inr(g.total)}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Summary table */}
              <SectionCard id="rpt-status-financial" title="Status-wise Financial Summary" icon={IndianRupee}
                actions={<BtnGroup sectionId="rpt-status-financial" onExport={exportSummaryPDF} />}>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Status','Bills','Invoice Value (₹)','QS Certified (₹)','Paid (₹)','Balance (₹)','% of Total'].map(h => (
                          <Th key={h} right={!['Status','Bills'].includes(h)}>{h}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(STATUS_CFG).map(([k, cfg]) => {
                        const g = statusGroups[k] || { count: 0, total: 0, certified: 0, paid: 0 };
                        const pct = totInvoice > 0 ? ((g.total / totInvoice) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={k} className="hover:bg-slate-50">
                            <Td><StatusBadge status={k} /></Td>
                            <Td>{g.count}</Td>
                            <Td right bold>₹{inr(g.total)}</Td>
                            <Td right color="text-indigo-600">₹{inr(g.certified)}</Td>
                            <Td right color="text-emerald-600">₹{inr(g.paid)}</Td>
                            <Td right color="text-amber-600">₹{inr(g.total - g.paid)}</Td>
                            <Td right>
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-slate-500">{pct}%</span>
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <TotRow cols={[
                        { v: 'TOTAL' }, { v: bills.length },
                        { v: `₹${inr(totInvoice)}`, right: true },
                        { v: `₹${inr(totCertified)}`, right: true, color: 'text-indigo-700' },
                        { v: `₹${inr(totPaid)}`, right: true, color: 'text-emerald-700' },
                        { v: `₹${inr(totBalance)}`, right: true, color: 'text-amber-700' },
                        { v: '100%', right: true },
                      ]} />
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              {/* Top vendors mini */}
              <SectionCard title="Top Vendors by Invoice Value" icon={Users}>
                <div className="space-y-2">
                  {vendorRows.slice(0, 8).map((v, i) => {
                    const pct = totInvoice > 0 ? (v.total / totInvoice) * 100 : 0;
                    return (
                      <div key={v.vendor} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold text-slate-700 truncate">{v.vendor}</span>
                            <span className="text-xs font-bold text-slate-800 ml-2 flex-shrink-0">₹{inr(v.total)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </>
          )}

          {/* ══ BILL REGISTER ════════════════════════════════════════════════ */}
          {tab === 'register' && (
            <SectionCard id="rpt-bill-register" title="Complete Bill Register" subtitle={`${bills.length} bills · ${fyLabel}`}
              icon={FileText} landscape
              actions={<BtnGroup sectionId="rpt-bill-register" onExport={exportBillRegisterPDF} />}>
              {bills.length === 0 ? <EmptyState /> : (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full">
                    <colgroup>
                      <col className="c-sl" />
                      <col className="c-ven" />
                      <col className="c-inv" />
                      <col className="c-date" />
                      <col className="c-mon" />
                      <col className="c-po" />
                      <col className="c-desc" />
                      <col className="c-amt" />{/* Basic */}
                      <col className="c-amt" />{/* GST */}
                      <col className="c-amt" />{/* Total */}
                      <col className="c-amt" />{/* Certified */}
                      <col className="c-amt" />{/* Paid */}
                      <col className="c-stat" />
                    </colgroup>
                    <thead>
                      <tr>
                        {['SL','Vendor','Invoice #','Date','Month','PO / WO','Work Description','Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)','Status'].map(h => (
                          <Th key={h} right={['Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)'].includes(h)}>{h}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b, i) => (
                        <tr key={b.id} className={`hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                          <td className="col-mono px-3 py-2.5 border-b border-slate-50 text-center text-indigo-700 text-xs font-mono">{b.sl_number}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-sm font-semibold text-slate-800 print:text-xs">{b.vendor_name}</td>
                          <td className="col-mono px-3 py-2.5 border-b border-slate-50 text-xs font-mono">{b.inv_number}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-xs text-slate-600 print:whitespace-nowrap">{fmt(b.inv_date)}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-xs text-slate-600 print:whitespace-nowrap">{b.inv_month || '—'}</td>
                          <td className="col-mono px-3 py-2.5 border-b border-slate-50 text-xs font-mono">{b.po_number || '—'}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-xs text-slate-600">
                            <span className="line-clamp-2 print:line-clamp-none" title={b.work_desc}>{b.work_desc || '—'}</span>
                          </td>
                          <td className="col-amount px-3 py-2.5 border-b border-slate-50 text-sm text-right">₹{inr(b.basic_amount)}</td>
                          <td className="col-amount px-3 py-2.5 border-b border-slate-50 text-xs text-right text-slate-500">₹{inr(b.gst_amount)}</td>
                          <td className="col-amount px-3 py-2.5 border-b border-slate-50 text-sm font-semibold text-right">₹{inr(b.total_amount)}</td>
                          <td className="col-amount px-3 py-2.5 border-b border-slate-50 text-sm text-right text-indigo-600">₹{inr(b.certified_net)}</td>
                          <td className="col-amount px-3 py-2.5 border-b border-slate-50 text-sm text-right text-emerald-600">₹{inr(b.paid_amount)}</td>
                          <td className="col-badge px-3 py-2.5 border-b border-slate-50"><StatusBadge status={b.workflow_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <TotRow cols={[
                        { v: `TOTAL (${bills.length})` }, {v:''},{v:''},{v:''},{v:''},{v:''},{v:''},
                        { v: `₹${inr(totBasic)}`, right: true },
                        { v: `₹${inr(totGst)}`, right: true },
                        { v: `₹${inr(totInvoice)}`, right: true },
                        { v: `₹${inr(totCertified)}`, right: true, color: 'text-indigo-700' },
                        { v: `₹${inr(totPaid)}`, right: true, color: 'text-emerald-700' },
                        { v: '' },
                      ]} />
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* ══ STATUS-WISE ══════════════════════════════════════════════════ */}
          {tab === 'status' && (
            <div id="rpt-status-all" data-report-section
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-visible print:rounded-md print:shadow-none print:border print:border-slate-300">
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Status-wise Report</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{bills.length} bills across all workflow stages · {fyLabel}</p>
                  </div>
                </div>
                <div className="section-actions flex items-center gap-2">
                  <BtnGroup sectionId="rpt-status-all" onExport={exportStatusPDF} exportLabel="Export PDF" />
                </div>
              </div>
              {/* Stage sub-sections — plain divs (no nested data-report-section) */}
              <div className="divide-y divide-slate-50">
                {Object.entries(STATUS_CFG).map(([k, cfg]) => {
                  const stageBills = bills.filter(b => b.workflow_status === k);
                  if (stageBills.length === 0) return null;
                  const stageTot    = stageBills.reduce((s, b) => s + parseFloat(b.total_amount  || 0), 0);
                  const stageCert   = stageBills.reduce((s, b) => s + parseFloat(b.certified_net || 0), 0);
                  const stagePaid   = stageBills.reduce((s, b) => s + parseFloat(b.paid_amount   || 0), 0);
                  const stageBasic  = stageBills.reduce((s, b) => s + parseFloat(b.basic_amount  || 0), 0);
                  const stageGst    = stageBills.reduce((s, b) => s + parseFloat(b.gst_amount    || 0), 0);
                  return (
                    <div key={k} className="p-5 print:p-3 print:page-break-inside-avoid">
                      {/* Stage title bar */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                        <span className="text-xs text-slate-500 font-medium">{stageBills.length} bills</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-semibold text-slate-700">₹{inr(stageTot)}</span>
                      </div>
                      {/* Stage table */}
                      <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full">
                          <thead>
                            <tr>
                              {['SL','Vendor','Invoice #','Inv Date','PO / WO','Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)'].map(h => (
                                <Th key={h} right={['Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)'].includes(h)}>{h}</Th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stageBills.map((b, i) => (
                              <tr key={b.id} className={`hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                                <Td mono color="text-indigo-700">{b.sl_number}</Td>
                                <Td bold>{b.vendor_name}</Td>
                                <Td mono small>{b.inv_number}</Td>
                                <Td small>{fmt(b.inv_date)}</Td>
                                <Td small mono>{b.po_number || '—'}</Td>
                                <Td right>₹{inr(b.basic_amount)}</Td>
                                <Td right small color="text-slate-500">₹{inr(b.gst_amount)}</Td>
                                <Td right bold>₹{inr(b.total_amount)}</Td>
                                <Td right color="text-indigo-600">₹{inr(b.certified_net)}</Td>
                                <Td right color="text-emerald-600">₹{inr(b.paid_amount)}</Td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <TotRow cols={[
                              { v: `TOTAL (${stageBills.length})` },{v:''},{v:''},{v:''},{v:''},
                              { v: `₹${inr(stageBasic)}`,  right: true },
                              { v: `₹${inr(stageGst)}`,    right: true },
                              { v: `₹${inr(stageTot)}`,    right: true },
                              { v: `₹${inr(stageCert)}`,   right: true, color: 'text-indigo-700' },
                              { v: `₹${inr(stagePaid)}`,   right: true, color: 'text-emerald-700' },
                            ]} />
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ MONTH-WISE ══════════════════════════════════════════════════ */}
          {tab === 'monthly' && (
            <SectionCard id="rpt-monthly" title={`Month-wise Invoice Summary — ${fyLabel}`} icon={Calendar}
              actions={<BtnGroup sectionId="rpt-monthly" onExport={exportMonthlyPDF} />}>
              {monthRows.length === 0 ? <EmptyState /> : (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Month','Bills','Basic (₹)','GST (₹)','Invoice Total (₹)','Certified (₹)','Paid (₹)','Balance (₹)'].map(h => (
                          <Th key={h} right={!['Month','Bills'].includes(h)}>{h}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthRows.map(m => (
                        <tr key={m.key} className="hover:bg-slate-50">
                          <Td bold color="text-slate-800">{m.label}</Td>
                          <Td center>{m.bills}</Td>
                          <Td right>₹{inr(m.basic)}</Td>
                          <Td right color="text-slate-500">₹{inr(m.gst)}</Td>
                          <Td right bold>₹{inr(m.total)}</Td>
                          <Td right color="text-indigo-600">₹{inr(m.certified)}</Td>
                          <Td right color="text-emerald-600">₹{inr(m.paid)}</Td>
                          <Td right color="text-amber-600">₹{inr(m.total - m.paid)}</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <TotRow cols={[
                        { v: 'TOTAL' }, { v: bills.length, center: true },
                        { v: `₹${inr(totBasic)}`, right: true },
                        { v: `₹${inr(totGst)}`, right: true },
                        { v: `₹${inr(totInvoice)}`, right: true },
                        { v: `₹${inr(totCertified)}`, right: true, color: 'text-indigo-700' },
                        { v: `₹${inr(totPaid)}`, right: true, color: 'text-emerald-700' },
                        { v: `₹${inr(totBalance)}`, right: true, color: 'text-amber-700' },
                      ]} />
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* ══ VENDOR-WISE ══════════════════════════════════════════════════ */}
          {tab === 'vendor' && (
            <div className="space-y-5">
              <SectionCard id="rpt-vendor-summary" title="Vendor-wise Invoice Summary" subtitle={`${vendorRows.length} vendors · ${fyLabel}`}
                icon={Users} actions={<BtnGroup sectionId="rpt-vendor-summary" onExport={exportVendorPDF} />}>
                {vendorRows.length === 0 ? <EmptyState /> : (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {['#','Vendor','Bills','Basic (₹)','GST (₹)','Invoice Total (₹)','Certified (₹)','Paid (₹)','Balance (₹)','% Share'].map(h => (
                            <Th key={h} right={!['#','Vendor','Bills'].includes(h)}>{h}</Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vendorRows.map((v, i) => {
                          const pct = totInvoice > 0 ? ((v.total / totInvoice) * 100).toFixed(1) : '0.0';
                          const balance = v.total - v.paid;
                          return (
                            <tr key={v.vendor} className="hover:bg-slate-50">
                              <Td small color="text-slate-400">{i + 1}</Td>
                              <Td bold>{v.vendor}</Td>
                              <Td center>{v.bills}</Td>
                              <Td right>₹{inr(v.basic)}</Td>
                              <Td right color="text-slate-500">₹{inr(v.gst)}</Td>
                              <Td right bold>₹{inr(v.total)}</Td>
                              <Td right color="text-indigo-600">₹{inr(v.certified)}</Td>
                              <Td right color="text-emerald-600">₹{inr(v.paid)}</Td>
                              <Td right color={balance > 0 ? 'text-amber-600' : 'text-slate-400'} bold>₹{inr(balance)}</Td>
                              <Td right>
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-500">{pct}%</span>
                                </div>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <TotRow cols={[
                          { v: '' }, { v: `TOTAL (${vendorRows.length})` }, { v: bills.length, center: true },
                          { v: `₹${inr(totBasic)}`, right: true },
                          { v: `₹${inr(totGst)}`, right: true },
                          { v: `₹${inr(totInvoice)}`, right: true },
                          { v: `₹${inr(totCertified)}`, right: true, color: 'text-indigo-700' },
                          { v: `₹${inr(totPaid)}`, right: true, color: 'text-emerald-700' },
                          { v: `₹${inr(totBalance)}`, right: true, color: 'text-amber-700' },
                          { v: '100%', right: true },
                        ]} />
                      </tfoot>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Per-vendor detail: bills per vendor */}
              {vendorRows.slice(0, 5).map(v => {
                const vBills = bills.filter(b => b.vendor_name === v.vendor);
                return (
                  <SectionCard key={v.vendor} title={v.vendor}
                    subtitle={`${vBills.length} bills · ₹${inr(v.total)} total`} icon={Users}>
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full">
                        <thead>
                          <tr>{['SL No','Invoice #','Inv Date','PO/WO','Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)','Status'].map(h => (
                            <Th key={h} right={['Basic (₹)','GST (₹)','Total (₹)','Certified (₹)','Paid (₹)'].includes(h)}>{h}</Th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {vBills.map(b => (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <Td mono color="text-indigo-700">{b.sl_number}</Td>
                              <Td mono small>{b.inv_number}</Td>
                              <Td small>{fmt(b.inv_date)}</Td>
                              <Td small mono>{b.po_number || '—'}</Td>
                              <Td right>₹{inr(b.basic_amount)}</Td>
                              <Td right small color="text-slate-500">₹{inr(b.gst_amount)}</Td>
                              <Td right bold>₹{inr(b.total_amount)}</Td>
                              <Td right color="text-indigo-600">₹{inr(b.certified_net)}</Td>
                              <Td right color="text-emerald-600">₹{inr(b.paid_amount)}</Td>
                              <Td><StatusBadge status={b.workflow_status} /></Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                );
              })}
            </div>
          )}

          {/* ══ AGING / OVERDUE ══════════════════════════════════════════════ */}
          {tab === 'aging' && (
            <div className="space-y-5">
              {/* Bucket cards */}
              <SectionCard id="rpt-aging" title="Outstanding Amount — Aging Analysis"
                subtitle="Certified but unpaid bills grouped by age"
                icon={Clock} color="amber"
                actions={<BtnGroup sectionId="rpt-aging" onExport={exportAgingPDF} />}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                  {agingBuckets.map(r => {
                    const isHot = r.range === '91-120' || r.range === '120+';
                    return (
                      <div key={r.range} className={`rounded-xl border p-4 text-center ${isHot ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                        <p className={`text-2xl font-black ${isHot ? 'text-red-600' : 'text-slate-800'}`}>{r.count}</p>
                        <p className={`text-xs font-bold mt-0.5 ${isHot ? 'text-red-500' : 'text-slate-500'}`}>{r.range} days</p>
                        <p className={`text-xs mt-1.5 font-semibold ${isHot ? 'text-red-600' : 'text-amber-600'}`}>₹{inr(r.amount)}</p>
                      </div>
                    );
                  })}
                </div>

                {agingRows.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-emerald-500">
                    <CheckCircle2 className="w-10 h-10 mb-2" />
                    <p className="text-sm font-semibold">No outstanding bills — all certified bills are paid!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {['SL No','Vendor','Invoice #','Inv Date','Certified (₹)','Paid (₹)','Balance (₹)','Days Outstanding','Aging','Status'].map(h => (
                            <Th key={h} right={['Certified (₹)','Paid (₹)','Balance (₹)','Days Outstanding'].includes(h)}>{h}</Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agingRows.map(b => {
                          const bucket = b.days <= 30 ? '0-30' : b.days <= 60 ? '31-60' : b.days <= 90 ? '61-90' : b.days <= 120 ? '91-120' : '120+';
                          const hot = b.days > 90;
                          return (
                            <tr key={b.id} className={`hover:bg-red-50/30 ${hot ? 'bg-red-50/20' : ''}`}>
                              <Td mono color="text-indigo-700">{b.sl_number}</Td>
                              <Td bold>{b.vendor_name}</Td>
                              <Td mono small>{b.inv_number}</Td>
                              <Td small>{fmt(b.inv_date)}</Td>
                              <Td right color="text-indigo-600">₹{inr(b.certified_net)}</Td>
                              <Td right color="text-emerald-600">₹{inr(b.paid_amount)}</Td>
                              <Td right bold color={hot ? 'text-red-600' : 'text-amber-600'}>₹{inr(b.balance)}</Td>
                              <Td right color={hot ? 'text-red-600' : 'text-slate-600'}>{b.days} days</Td>
                              <Td>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                                  ${bucket === '120+' ? 'bg-red-100 text-red-700' :
                                    bucket === '91-120' ? 'bg-orange-100 text-orange-700' :
                                    bucket === '61-90' ? 'bg-amber-100 text-amber-700' :
                                    bucket === '31-60' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-slate-100 text-slate-600'}`}>
                                  {bucket}d
                                </span>
                              </Td>
                              <Td><StatusBadge status={b.workflow_status} /></Td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <TotRow cols={[
                          { v: `TOTAL (${agingRows.length})` },{v:''},{v:''},{v:''},
                          { v: `₹${inr(agingRows.reduce((s,b)=>s+parseFloat(b.certified_net||0),0))}`, right: true, color: 'text-indigo-700' },
                          { v: `₹${inr(agingRows.reduce((s,b)=>s+parseFloat(b.paid_amount||0),0))}`, right: true, color: 'text-emerald-700' },
                          { v: `₹${inr(agingRows.reduce((s,b)=>s+b.balance,0))}`, right: true, color: 'text-red-700' },
                          {v:''},{v:''},{v:''},
                        ]} />
                      </tfoot>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ══ GST SUMMARY ══════════════════════════════════════════════════ */}
          {tab === 'gst' && (
            <div className="space-y-5">
              {/* GST type totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Taxable Value',  value: `₹${inr(totBasic)}`,  color: 'bg-slate-600' },
                  { label: 'CGST (Intrastate)',     value: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.cgst,0))}`, color: 'bg-blue-600' },
                  { label: 'SGST (Intrastate)',     value: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.sgst,0))}`, color: 'bg-indigo-600' },
                  { label: 'IGST (Interstate)',     value: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.igst,0))}`, color: 'bg-violet-600' },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
                    <div className={`${k.color} w-8 h-8 rounded-lg flex-shrink-0`} />
                    <div>
                      <p className="text-base font-black text-slate-800">{k.value}</p>
                      <p className="text-xs text-slate-500">{k.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <SectionCard id="rpt-gst-monthly" title={`GST Month-wise Summary — ${fyLabel}`} icon={Receipt} color="violet"
                actions={<BtnGroup sectionId="rpt-gst-monthly" onExport={exportGSTPDF} />}>
                {gstMonthRows.length === 0 ? <EmptyState /> : (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full">
                      <thead>
                        <tr>{['Month','Bills','Taxable Value (₹)','CGST (₹)','SGST (₹)','IGST (₹)','Total GST (₹)','Invoice Total (₹)'].map(h => (
                          <Th key={h} right={!['Month','Bills'].includes(h)}>{h}</Th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {gstMonthRows.map(m => (
                          <tr key={m.key} className="hover:bg-slate-50">
                            <Td bold>{m.label}</Td>
                            <Td center>{m.bills}</Td>
                            <Td right>₹{inr(m.basic)}</Td>
                            <Td right color="text-blue-600">₹{inr(m.cgst)}</Td>
                            <Td right color="text-indigo-600">₹{inr(m.sgst)}</Td>
                            <Td right color="text-violet-600">₹{inr(m.igst)}</Td>
                            <Td right bold color="text-slate-800">₹{inr(m.totalGst)}</Td>
                            <Td right bold>₹{inr(m.total)}</Td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <TotRow cols={[
                          { v: 'TOTAL' }, { v: bills.length, center: true },
                          { v: `₹${inr(totBasic)}`, right: true },
                          { v: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.cgst,0))}`, right: true, color: 'text-blue-700' },
                          { v: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.sgst,0))}`, right: true, color: 'text-indigo-700' },
                          { v: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.igst,0))}`, right: true, color: 'text-violet-700' },
                          { v: `₹${inr(totGst)}`, right: true },
                          { v: `₹${inr(totInvoice)}`, right: true },
                        ]} />
                      </tfoot>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* GST Bill detail */}
              <SectionCard id="rpt-gst-detail" title="Invoice-wise GST Breakup" icon={Receipt} color="violet"
                actions={<BtnGroup sectionId="rpt-gst-detail" onExport={exportGSTPDF} />}>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full">
                    <thead>
                      <tr>{['SL No','Vendor','Invoice #','Inv Date','Tax Mode','Taxable (₹)','CGST %','CGST (₹)','SGST %','SGST (₹)','IGST %','IGST (₹)','Total GST (₹)','Invoice Total (₹)'].map(h => (
                        <Th key={h} right={['Taxable (₹)','CGST (₹)','SGST (₹)','IGST (₹)','Total GST (₹)','Invoice Total (₹)'].includes(h)}
                          center={['CGST %','SGST %','IGST %'].includes(h)}>{h}</Th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {bills.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <Td mono color="text-indigo-700">{b.sl_number}</Td>
                          <Td bold>{b.vendor_name}</Td>
                          <Td mono small>{b.inv_number}</Td>
                          <Td small>{fmt(b.inv_date)}</Td>
                          <Td center small><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${b.tax_mode === 'interstate' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{b.tax_mode === 'interstate' ? 'IGST' : 'CGST+SGST'}</span></Td>
                          <Td right>₹{inr(b.basic_amount)}</Td>
                          <Td center small color="text-slate-500">{b.cgst_pct ? `${b.cgst_pct}%` : '—'}</Td>
                          <Td right color="text-blue-600">₹{inr(b.cgst_amt)}</Td>
                          <Td center small color="text-slate-500">{b.sgst_pct ? `${b.sgst_pct}%` : '—'}</Td>
                          <Td right color="text-indigo-600">₹{inr(b.sgst_amt)}</Td>
                          <Td center small color="text-slate-500">{b.igst_pct ? `${b.igst_pct}%` : '—'}</Td>
                          <Td right color="text-violet-600">₹{inr(b.igst_amt)}</Td>
                          <Td right bold>₹{inr(b.gst_amount)}</Td>
                          <Td right bold>₹{inr(b.total_amount)}</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <TotRow cols={[
                        { v: `TOTAL (${bills.length})` },{v:''},{v:''},{v:''},{v:''},
                        { v: `₹${inr(totBasic)}`, right: true },
                        {v:''},
                        { v: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.cgst,0))}`, right: true, color: 'text-blue-700' },
                        {v:''},
                        { v: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.sgst,0))}`, right: true, color: 'text-indigo-700' },
                        {v:''},
                        { v: `₹${inr(gstMonthRows.reduce((s,m)=>s+m.igst,0))}`, right: true, color: 'text-violet-700' },
                        { v: `₹${inr(totGst)}`, right: true },
                        { v: `₹${inr(totInvoice)}`, right: true },
                      ]} />
                    </tfoot>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ══ PAYMENT REGISTER ═════════════════════════════════════════════ */}
          {tab === 'payment' && (
            <SectionCard id="rpt-payments" title="Payment Register"
              subtitle={`${paymentRows.length} bills with payments recorded · ${fyLabel}`}
              icon={CreditCard} color="emerald"
              actions={<BtnGroup sectionId="rpt-payments" onExport={exportPaymentPDF} />}>
              {paymentRows.length === 0 ? <EmptyState msg="No payment records for selected period" /> : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Bills Paid',         value: paymentRows.length,    color: 'text-emerald-700' },
                      { label: 'Total Paid Amount',  value: `₹${inr(paymentRows.reduce((s,b)=>s+parseFloat(b.paid_amount||0),0))}`, color: 'text-emerald-700' },
                      { label: 'Total Certified',    value: `₹${inr(paymentRows.reduce((s,b)=>s+parseFloat(b.certified_net||0),0))}`, color: 'text-indigo-700' },
                    ].map(k => (
                      <div key={k.label} className="bg-white rounded-xl border border-slate-100 p-4">
                        <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full">
                      <thead>
                        <tr>{['SL No','Vendor','Invoice #','Inv Date','Month','PO/WO','Certified (₹)','Paid (₹)','Balance (₹)','Status'].map(h => (
                          <Th key={h} right={['Certified (₹)','Paid (₹)','Balance (₹)'].includes(h)}>{h}</Th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {paymentRows.map((b, i) => {
                          const balance = parseFloat(b.certified_net || 0) - parseFloat(b.paid_amount || 0);
                          return (
                            <tr key={b.id} className={`hover:bg-emerald-50/30 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                              <Td mono color="text-indigo-700">{b.sl_number}</Td>
                              <Td bold>{b.vendor_name}</Td>
                              <Td mono small>{b.inv_number}</Td>
                              <Td small>{fmt(b.inv_date)}</Td>
                              <Td small>{b.inv_month || '—'}</Td>
                              <Td small mono>{b.po_number || '—'}</Td>
                              <Td right color="text-indigo-600">₹{inr(b.certified_net)}</Td>
                              <Td right bold color="text-emerald-600">₹{inr(b.paid_amount)}</Td>
                              <Td right color={balance > 0 ? 'text-amber-600' : 'text-slate-400'}>₹{inr(balance)}</Td>
                              <Td><StatusBadge status={b.workflow_status} /></Td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <TotRow cols={[
                          { v: `TOTAL (${paymentRows.length})` },{v:''},{v:''},{v:''},{v:''},{v:''},
                          { v: `₹${inr(paymentRows.reduce((s,b)=>s+parseFloat(b.certified_net||0),0))}`, right: true, color: 'text-indigo-700' },
                          { v: `₹${inr(paymentRows.reduce((s,b)=>s+parseFloat(b.paid_amount||0),0))}`, right: true, color: 'text-emerald-700' },
                          { v: `₹${inr(paymentRows.reduce((s,b)=>s+parseFloat(b.certified_net||0)-parseFloat(b.paid_amount||0),0))}`, right: true, color: 'text-amber-700' },
                          { v: '' },
                        ]} />
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>
          )}

        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#root) { display: none !important; }
          aside, nav, header, .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          table { page-break-inside: avoid; }
        }
      `}</style>
    </>
  );
}
