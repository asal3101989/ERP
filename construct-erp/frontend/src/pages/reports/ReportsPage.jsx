// src/pages/reports/ReportsPage.jsx — ERP Reports Hub (Generate Reports)
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart3, FileText, Users, Package, ShieldCheck, AlertTriangle,
  TrendingUp, Receipt, IndianRupee, Layers, Activity, Calendar,
  HardHat, Briefcase, Search, FileBarChart, Building2, Truck,
  PackageCheck, FileSearch, Gavel, Send, Star, Clock, CreditCard,
  Flag, Ruler, BookOpen, ClipboardList, Target, ChevronRight,
  Printer, Download, RefreshCw, X, Filter, SlidersHorizontal,
  CheckCircle2, Circle, ChevronDown, Eye, FileSpreadsheet,
  ArrowUpRight, Wallet, DollarSign, AlertCircle, Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../api/client';

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  indigo:  { bg:'bg-indigo-50',  icon:'text-indigo-600',  badge:'bg-indigo-100 text-indigo-700',  btn:'bg-indigo-600 hover:bg-indigo-700',  ring:'ring-indigo-200',  hdr:'bg-indigo-600' },
  blue:    { bg:'bg-blue-50',    icon:'text-blue-600',    badge:'bg-blue-100 text-blue-700',      btn:'bg-blue-600 hover:bg-blue-700',      ring:'ring-blue-200',    hdr:'bg-blue-600' },
  violet:  { bg:'bg-violet-50',  icon:'text-violet-600',  badge:'bg-violet-100 text-violet-700',  btn:'bg-violet-600 hover:bg-violet-700',  ring:'ring-violet-200',  hdr:'bg-violet-600' },
  emerald: { bg:'bg-emerald-50', icon:'text-emerald-600', badge:'bg-emerald-100 text-emerald-700',btn:'bg-emerald-600 hover:bg-emerald-700',ring:'ring-emerald-200', hdr:'bg-emerald-600' },
  amber:   { bg:'bg-amber-50',   icon:'text-amber-600',   badge:'bg-amber-100 text-amber-700',    btn:'bg-amber-600 hover:bg-amber-700',    ring:'ring-amber-200',   hdr:'bg-amber-700' },
  teal:    { bg:'bg-teal-50',    icon:'text-teal-600',    badge:'bg-teal-100 text-teal-700',      btn:'bg-teal-600 hover:bg-teal-700',      ring:'ring-teal-200',    hdr:'bg-teal-600' },
  orange:  { bg:'bg-orange-50',  icon:'text-orange-600',  badge:'bg-orange-100 text-orange-700',  btn:'bg-orange-600 hover:bg-orange-700',  ring:'ring-orange-200',  hdr:'bg-orange-600' },
  red:     { bg:'bg-red-50',     icon:'text-red-600',     badge:'bg-red-100 text-red-700',        btn:'bg-red-600 hover:bg-red-700',        ring:'ring-red-200',     hdr:'bg-red-600' },
  cyan:    { bg:'bg-cyan-50',    icon:'text-cyan-600',    badge:'bg-cyan-100 text-cyan-700',      btn:'bg-cyan-600 hover:bg-cyan-700',      ring:'ring-cyan-200',    hdr:'bg-cyan-600' },
  slate:   { bg:'bg-slate-50',   icon:'text-slate-600',   badge:'bg-slate-100 text-slate-700',    btn:'bg-slate-600 hover:bg-slate-700',    ring:'ring-slate-200',   hdr:'bg-slate-600' },
};

// ── Departments ────────────────────────────────────────────────────────────────
const DEPTS = [
  { key:'all',            label:'All Reports',       icon:BarChart3,     color:'indigo' },
  { key:'dqs',            label:'DQS Tracker',       icon:Send,          color:'indigo' },
  { key:'finance',        label:'Finance',           icon:IndianRupee,   color:'emerald' },
  { key:'hr',             label:'HR & Admin',        icon:Users,         color:'violet' },
  { key:'procurement',    label:'Procurement',       icon:Truck,         color:'amber' },
  { key:'stores',         label:'Stores',            icon:Package,       color:'teal' },
  { key:'subcontractors', label:'Subcontractors',    icon:HardHat,       color:'orange' },
  { key:'qs',             label:'QS & Billing',      icon:Layers,        color:'emerald' },
  { key:'planning',       label:'Planning',          icon:Flag,          color:'blue' },
  { key:'quality',        label:'Quality (QA/QC)',   icon:ShieldCheck,   color:'blue' },
  { key:'hse',            label:'HSE & Safety',      icon:AlertTriangle, color:'red' },
  { key:'tender',         label:'Tender',            icon:Gavel,         color:'cyan' },
  { key:'assets',         label:'Assets & IT',       icon:Briefcase,     color:'slate' },
];

// ── Report definitions (with columns + api endpoint) ──────────────────────────
// Endpoints match actual backend routes in server.js
const REPORTS = [
  // ── DQS ──────────────────────────────────────────────────────────────────────
  {
    key:'dqs-bill-register', dept:'dqs', title:'Bill Register', icon:FileText, color:'indigo',
    desc:'All invoices with vendor, amount, status, and dates',
    filters:['dateRange','project'],
    endpoint:'/dqs/bills',
    // backend returns { data: [...] }
    dataKey:'data',
    // date filter params used by this route
    dateParams:{ from:'from_date', to:'to_date' },
    columns:[
      { key:'sl_number',       label:'Bill No',      mono:true },
      { key:'vendor_name',     label:'Vendor' },
      { key:'inv_number',      label:'Invoice No',   mono:true },
      { key:'inv_date',        label:'Date',         type:'date' },
      { key:'total_amount',      label:'Amount (₹)',   type:'amount' },
      { key:'workflow_status', label:'Status',       type:'status' },
      { key:'project_name',    label:'Project' },
    ],
  },
  {
    key:'dqs-aging', dept:'dqs', title:'Invoice Ageing', icon:Clock, color:'indigo',
    desc:'Ageing analysis — how long invoices have been pending',
    filters:['project'],
    endpoint:'/dqs/bills',
    dataKey:'data',
    columns:[
      { key:'sl_number',       label:'Bill No',     mono:true },
      { key:'vendor_name',     label:'Vendor' },
      { key:'total_amount',      label:'Amount (₹)',  type:'amount' },
      { key:'workflow_status', label:'Status',      type:'status' },
      { key:'days_pending',    label:'Days Pending',type:'number' },
    ],
    transform: rows => rows
      .filter(r => !['paid','rejected'].includes(r.workflow_status))
      .map(r => ({
        ...r,
        days_pending: r.received_date
          ? Math.floor((Date.now() - new Date(r.received_date)) / 86400000)
          : r.created_at
            ? Math.floor((Date.now() - new Date(r.created_at)) / 86400000)
            : 0,
      }))
      .sort((a,b) => b.days_pending - a.days_pending),
  },
  {
    key:'dqs-vendor-summary', dept:'dqs', title:'Vendor-wise Summary', icon:Users, color:'indigo',
    desc:'Invoice count and total amounts grouped by vendor',
    filters:['dateRange','project'],
    endpoint:'/dqs/bills',
    dataKey:'data',
    columns:[
      { key:'vendor_name',  label:'Vendor' },
      { key:'count',        label:'Bills',       type:'number' },
      { key:'total_amount', label:'Total (₹)',   type:'amount' },
      { key:'paid',         label:'Paid (₹)',    type:'amount' },
      { key:'pending',      label:'Pending (₹)', type:'amount' },
    ],
    aggregate: rows => {
      const m = {};
      rows.forEach(r => {
        const v = r.vendor_name || 'Unknown';
        if (!m[v]) m[v] = { vendor_name:v, count:0, total_amount:0, paid:0, pending:0 };
        m[v].count++;
        m[v].total_amount += parseFloat(r.total_amount)||0;
        if (['paid','approved'].includes(r.workflow_status)) m[v].paid += parseFloat(r.total_amount)||0;
        else m[v].pending += parseFloat(r.total_amount)||0;
      });
      return Object.values(m).sort((a,b) => b.total_amount - a.total_amount);
    },
  },
  {
    key:'dqs-ap-aging', dept:'dqs', title:'AP Ageing Report', icon:TrendingUp, color:'indigo',
    desc:'Accounts payable ageing buckets: current, 30, 60, 90+ days',
    filters:['project'],
    endpoint:'/dqs/bills/ap-aging',
    dataKey:'data',
    columns:[
      { key:'vendor_name', label:'Vendor' },
      { key:'current',     label:'0-30 Days (₹)',  type:'amount' },
      { key:'days_30',     label:'31-60 Days (₹)', type:'amount' },
      { key:'days_60',     label:'61-90 Days (₹)', type:'amount' },
      { key:'days_90',     label:'Unscheduled (₹)',type:'amount' },
      { key:'over_90',     label:'90+ Days (₹)',   type:'amount' },
      { key:'total',       label:'Total (₹)',      type:'amount' },
    ],
    // pivot individual bill rows into vendor-wise aging buckets
    aggregate: rows => {
      const m = {};
      rows.forEach(r => {
        const v = r.vendor_name || 'Unknown';
        if (!m[v]) m[v] = { vendor_name:v, current:0, days_30:0, days_60:0, days_90:0, over_90:0, total:0 };
        const amt = parseFloat(r.balance) || 0;
        const bucket = r.aging_bucket;
        if (bucket === '0-30')       m[v].current += amt;
        else if (bucket === '31-60') m[v].days_30  += amt;
        else if (bucket === '61-90') m[v].days_60  += amt;
        else if (bucket === '90+')   m[v].over_90  += amt;
        else                         m[v].days_90  += amt; // 'unscheduled'
        m[v].total += amt;
      });
      return Object.values(m).sort((a,b) => b.total - a.total);
    },
  },

  // ── Finance ──────────────────────────────────────────────────────────────────
  {
    key:'finance-tds', dept:'finance', title:'TDS Register', icon:FileText, color:'emerald',
    desc:'TDS deductions by vendor/entity with PAN and gross amounts',
    filters:['dateRange'],
    endpoint:'/reports/tds',
    dataKey:'data',
    columns:[
      { key:'entity_name',  label:'Vendor / Party' },
      { key:'entity_pan',   label:'PAN',           mono:true },
      { key:'gross_paid',   label:'Gross Paid (₹)', type:'amount' },
      { key:'tds_amount',   label:'TDS (₹)',        type:'amount' },
      { key:'transactions', label:'Txn Count',      type:'number' },
    ],
  },
  {
    key:'finance-payments', dept:'finance', title:'Payment Register', icon:Wallet, color:'emerald',
    desc:'All payments made with mode, reference, and amount',
    filters:['dateRange','project'],
    endpoint:'/payments',
    dataKey:'data',
    columns:[
      { key:'payment_date',     label:'Date',         type:'date' },
      { key:'entity_name',      label:'Vendor / Party' },
      { key:'amount',           label:'Amount (₹)',   type:'amount' },
      { key:'tds_deducted',     label:'TDS (₹)',      type:'amount' },
      { key:'net_amount',       label:'Net Paid (₹)', type:'amount' },
      { key:'payment_mode',     label:'Mode' },
      { key:'reference_number', label:'Reference',    mono:true },
      { key:'remarks',          label:'Remarks' },
    ],
  },
  {
    key:'finance-invoices', dept:'finance', title:'Vendor Payables', icon:Receipt, color:'emerald',
    desc:'Outstanding vendor invoices, due dates, and ageing',
    filters:['dateRange','project'],
    endpoint:'/invoices',
    dataKey:null,
    columns:[
      { key:'invoice_number', label:'Invoice No',  mono:true },
      { key:'vendor_name',    label:'Vendor' },
      { key:'invoice_date',   label:'Date',        type:'date' },
      { key:'total_amount',   label:'Amount (₹)',  type:'amount' },
      { key:'paid_amount',    label:'Paid (₹)',    type:'amount' },
      { key:'balance',        label:'Balance (₹)', type:'amount' },
      { key:'status',         label:'Status',      type:'status' },
    ],
  },

  // ── HR ────────────────────────────────────────────────────────────────────────
  {
    key:'hr-employees', dept:'hr', title:'Employee List', icon:Users, color:'violet',
    desc:'All employees with department, designation, and status',
    filters:[],
    endpoint:'/hr-admin/employees',
    dataKey:'data',
    columns:[
      { key:'employee_code', label:'Code',         mono:true },
      { key:'name',          label:'Name' },
      { key:'department',    label:'Department' },
      { key:'designation',   label:'Designation' },
      { key:'phone',         label:'Phone',        mono:true },
      { key:'role',          label:'Role',         type:'status' },
    ],
  },
  {
    key:'hr-payroll', dept:'hr', title:'Payroll Register', icon:IndianRupee, color:'violet',
    desc:'Monthly salary disbursement, deductions, and net pay',
    filters:['dateRange'],
    endpoint:'/hr-admin/payroll',
    dataKey:'data',
    columns:[
      { key:'employee_name',    label:'Employee' },
      { key:'employee_code',    label:'Code',            mono:true },
      { key:'basic',            label:'Basic (₹)',       type:'amount' },
      { key:'gross_earnings',   label:'Gross (₹)',       type:'amount' },
      { key:'total_deductions', label:'Deductions (₹)',  type:'amount' },
      { key:'net_pay',          label:'Net Pay (₹)',     type:'amount' },
      { key:'status',           label:'Status',          type:'status' },
    ],
  },

  // ── Procurement ───────────────────────────────────────────────────────────────
  {
    key:'procurement-po', dept:'procurement', title:'Purchase Order Register', icon:FileText, color:'amber',
    desc:'All POs with vendor, item, value, and delivery status',
    filters:['dateRange','project'],
    endpoint:'/purchase-orders',
    dataKey:null,
    columns:[
      { key:'po_number',     label:'PO No',        mono:true },
      { key:'vendor_name',   label:'Vendor' },
      { key:'description',   label:'Item / Material' },
      { key:'quantity',      label:'Qty',          type:'number' },
      { key:'unit_price',    label:'Rate (₹)',     type:'amount' },
      { key:'total_amount',  label:'Total (₹)',    type:'amount' },
      { key:'status',        label:'Status',       type:'status' },
      { key:'created_at',    label:'Date',         type:'date' },
    ],
  },
  {
    key:'procurement-vendor', dept:'procurement', title:'Vendor Register', icon:Star, color:'amber',
    desc:'All vendors with contact, category, and status',
    filters:[],
    endpoint:'/vendors',
    dataKey:null,
    columns:[
      { key:'name',          label:'Vendor' },
      { key:'contact_person',label:'Contact' },
      { key:'phone',         label:'Phone',        mono:true },
      { key:'email',         label:'Email' },
      { key:'category',      label:'Category' },
      { key:'status',        label:'Status',       type:'status' },
    ],
  },

  // ── Stores ────────────────────────────────────────────────────────────────────
  {
    key:'stores-grn', dept:'stores', title:'GRN Register', icon:PackageCheck, color:'teal',
    desc:'Goods received notes by vendor, material, and project',
    filters:['dateRange','project'],
    endpoint:'/grn',
    dataKey:null,
    columns:[
      { key:'grn_number',    label:'GRN No',       mono:true },
      { key:'vendor_name',   label:'Vendor' },
      { key:'item_name',     label:'Material' },
      { key:'received_qty',  label:'Qty Received', type:'number' },
      { key:'unit',          label:'Unit' },
      { key:'unit_rate',     label:'Rate (₹)',     type:'amount' },
      { key:'total_amount',  label:'Total (₹)',    type:'amount' },
      { key:'received_date', label:'Date',         type:'date' },
    ],
  },
  {
    key:'stores-stock', dept:'stores', title:'Stock / Inventory Report', icon:Package, color:'teal',
    desc:'Current inventory levels and minimum stock alerts',
    filters:['project'],
    endpoint:'/inventory',
    dataKey:null,
    columns:[
      { key:'item_name',     label:'Material' },
      { key:'category',      label:'Category' },
      { key:'current_stock', label:'Stock',         type:'number' },
      { key:'unit',          label:'Unit' },
      { key:'min_stock',     label:'Min Stock',     type:'number' },
      { key:'location',      label:'Location' },
    ],
  },
  {
    key:'stores-mrs', dept:'stores', title:'Material Requisition (MRS)', icon:ClipboardList, color:'teal',
    desc:'Material requisitions with approval and fulfilment status',
    filters:['dateRange','project'],
    endpoint:'/stores/mrs',
    dataKey:null,
    columns:[
      { key:'mrs_number',    label:'MRS No',       mono:true },
      { key:'requested_by',  label:'Requested By' },
      { key:'item_name',     label:'Material' },
      { key:'quantity',      label:'Qty',          type:'number' },
      { key:'unit',          label:'Unit' },
      { key:'status',        label:'Status',       type:'status' },
      { key:'created_at',    label:'Date',         type:'date' },
    ],
  },

  // ── Subcontractors ────────────────────────────────────────────────────────────
  {
    key:'sub-wo', dept:'subcontractors', title:'Work Order Register', icon:Briefcase, color:'orange',
    desc:'All work orders with subcontractor, contract value, and status',
    filters:['project'],
    endpoint:'/subcontractors/work-orders',
    dataKey:null,
    columns:[
      { key:'wo_number',          label:'WO No',         mono:true },
      { key:'subcontractor_name', label:'Subcontractor' },
      { key:'subject',            label:'Scope / Subject' },
      { key:'total_value',        label:'Contract (₹)',  type:'amount' },
      { key:'total_billed',       label:'Billed (₹)',    type:'amount' },
      { key:'status',             label:'Status',        type:'status' },
    ],
  },
  {
    key:'sub-bills', dept:'subcontractors', title:'RA Bill Summary', icon:Receipt, color:'orange',
    desc:'Running account bills — gross, deductions, net payable',
    filters:['project'],
    endpoint:'/subcontractors/bills',
    dataKey:null,
    columns:[
      { key:'bill_number',      label:'Bill No',      mono:true },
      { key:'wo_number',        label:'WO No',        mono:true },
      { key:'gross_amount',     label:'Gross (₹)',    type:'amount' },
      { key:'retention_amount', label:'Retention (₹)',type:'amount' },
      { key:'net_payable',      label:'Net (₹)',      type:'amount' },
      { key:'status',           label:'Status',       type:'status' },
    ],
  },

  // ── QS ───────────────────────────────────────────────────────────────────────
  {
    key:'qs-measurements', dept:'qs', title:'Measurement Book', icon:Ruler, color:'emerald',
    desc:'All measurements recorded and verified',
    filters:['project'],
    endpoint:'/measurements',
    dataKey:null,
    columns:[
      { key:'description',      label:'Description' },
      { key:'quantity',         label:'Qty',          type:'number' },
      { key:'unit',             label:'Unit' },
      { key:'rate',             label:'Rate (₹)',     type:'amount' },
      { key:'amount',           label:'Amount (₹)',   type:'amount' },
      { key:'status',           label:'Status',       type:'status' },
    ],
  },
  {
    key:'qs-ra-bills', dept:'qs', title:'RA Bills', icon:Receipt, color:'emerald',
    desc:'Client running account bills with certified and balance amounts',
    filters:['project'],
    endpoint:'/ra-bills',
    dataKey:null,
    columns:[
      { key:'bill_number',      label:'Bill No',      mono:true },
      { key:'bill_date',        label:'Date',         type:'date' },
      { key:'gross_amount',     label:'Gross (₹)',    type:'amount' },
      { key:'certified_amount', label:'Certified (₹)',type:'amount' },
      { key:'status',           label:'Status',       type:'status' },
    ],
  },

  // ── Planning ─────────────────────────────────────────────────────────────────
  {
    key:'planning-dpr', dept:'planning', title:'Daily Progress Report', icon:FileText, color:'blue',
    desc:'Site activity, manpower, equipment and progress per day',
    filters:['dateRange','project'],
    endpoint:'/dpr',
    dataKey:null,
    columns:[
      { key:'report_date',      label:'Date',         type:'date' },
      { key:'project_name',     label:'Project' },
      { key:'total_manpower',   label:'Manpower',     type:'number' },
      { key:'work_done',        label:'Work Done' },
      { key:'remarks',          label:'Remarks' },
    ],
  },

  // ── Quality ───────────────────────────────────────────────────────────────────
  {
    key:'quality-rfi', dept:'quality', title:'RFI Register', icon:FileSearch, color:'blue',
    desc:'Requests for information — open, responded, and closed',
    filters:['dateRange','project'],
    endpoint:'/quality/rfi',
    dataKey:null,
    columns:[
      { key:'rfi_number',       label:'RFI No',       mono:true },
      { key:'subject',          label:'Subject' },
      { key:'raised_by',        label:'Raised By' },
      { key:'created_at',       label:'Date',         type:'date' },
      { key:'status',           label:'Status',       type:'status' },
    ],
  },
  {
    key:'quality-ncr', dept:'quality', title:'NCR Register', icon:AlertTriangle, color:'blue',
    desc:'Non-conformance reports with corrective action status',
    filters:['dateRange','project'],
    endpoint:'/quality/ncr',
    dataKey:null,
    columns:[
      { key:'ncr_number',       label:'NCR No',       mono:true },
      { key:'description',      label:'Description' },
      { key:'location',         label:'Location' },
      { key:'created_at',       label:'Date',         type:'date' },
      { key:'status',           label:'Status',       type:'status' },
    ],
  },

  // ── HSE ───────────────────────────────────────────────────────────────────────
  {
    key:'hse-incidents', dept:'hse', title:'Incident Register', icon:AlertTriangle, color:'red',
    desc:'All safety incidents with severity, location, and status',
    filters:['dateRange','project'],
    endpoint:'/incidents',
    dataKey:null,
    columns:[
      { key:'incident_date',    label:'Date',         type:'date' },
      { key:'incident_type',    label:'Type' },
      { key:'location',         label:'Location' },
      { key:'severity',         label:'Severity',     type:'status' },
      { key:'reported_by',      label:'Reported By' },
      { key:'status',           label:'Status',       type:'status' },
    ],
  },

  // ── Tender ────────────────────────────────────────────────────────────────────
  {
    key:'tender-register', dept:'tender', title:'Tender Register', icon:Gavel, color:'cyan',
    desc:'All tenders issued, received, and awarded with values',
    filters:['dateRange'],
    endpoint:'/tenders',
    dataKey:null,
    columns:[
      { key:'tender_number',    label:'Tender No',    mono:true },
      { key:'title',            label:'Title' },
      { key:'estimated_value',  label:'Est. Value (₹)',type:'amount' },
      { key:'submission_date',  label:'Due Date',     type:'date' },
      { key:'status',           label:'Status',       type:'status' },
      { key:'awarded_to',       label:'Awarded To' },
    ],
  },

  // ── Assets ────────────────────────────────────────────────────────────────────
  {
    key:'assets-register', dept:'assets', title:'Asset Register', icon:Briefcase, color:'slate',
    desc:'All assets with status, location, and assigned user',
    filters:[],
    endpoint:'/assets',
    dataKey:null,
    columns:[
      { key:'asset_code',       label:'Asset Code',   mono:true },
      { key:'name',             label:'Asset Name' },
      { key:'category',         label:'Category' },
      { key:'location',         label:'Location' },
      { key:'assigned_to',      label:'Assigned To' },
      { key:'status',           label:'Status',       type:'status' },
      { key:'purchase_value',   label:'Value (₹)',    type:'amount' },
    ],
  },
];

// ── Status colour map ──────────────────────────────────────────────────────────
const STATUS_COLOR = {
  paid:'bg-emerald-100 text-emerald-700', approved:'bg-emerald-100 text-emerald-700',
  active:'bg-blue-100 text-blue-700', open:'bg-blue-100 text-blue-700',
  pending:'bg-amber-100 text-amber-700', submitted:'bg-amber-100 text-amber-700',
  draft:'bg-slate-100 text-slate-600',
  rejected:'bg-red-100 text-red-700', closed:'bg-slate-100 text-slate-600',
  high:'bg-red-100 text-red-700', medium:'bg-amber-100 text-amber-700', low:'bg-blue-100 text-blue-700',
};

function fmt(val, type) {
  if (val === null || val === undefined || val === '') return <span className="text-slate-300">—</span>;
  if (type === 'amount') return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
  if (type === 'date') return val ? new Date(val).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  if (type === 'number') return Number(val).toLocaleString('en-IN');
  if (type === 'status') {
    const cls = STATUS_COLOR[String(val).toLowerCase()] || 'bg-slate-100 text-slate-600';
    return <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide', cls)}>{val}</span>;
  }
  return String(val);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [dept, setDept] = useState('dqs');
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);

  // select first report of dqs by default
  useEffect(() => {
    const first = REPORTS.find(r => r.dept === 'dqs');
    if (first) setSelectedReport(first);
  }, []);

  const countByDept = useMemo(() => {
    const m = {};
    REPORTS.forEach(r => { m[r.dept] = (m[r.dept] || 0) + 1; });
    return m;
  }, []);

  const visibleReports = useMemo(() => {
    let list = dept === 'all' ? REPORTS : REPORTS.filter(r => r.dept === dept);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));
    }
    return list;
  }, [dept, search]);

  const handleSelectDept = (key) => {
    setDept(key);
    setSearch('');
    const first = REPORTS.find(r => key === 'all' ? true : r.dept === key);
    if (first) setSelectedReport(first);
  };

  return (
    <div className="flex h-full bg-[#f0f2f5] overflow-hidden">

      {/* ── Department sidebar ─────────────────────────────────────────────── */}
      <aside className="report-hub-dept-sidebar w-52 flex-shrink-0 flex flex-col overflow-hidden"
             style={{ background: 'linear-gradient(180deg, #0f1e35 0%, #111827 100%)' }}>

        {/* Header */}
        <div className="px-4 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
              <FileBarChart className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-tight tracking-tight">Reports Hub</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{REPORTS.length} reports available</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 mb-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-0.5
                        [&::-webkit-scrollbar]:w-1
                        [&::-webkit-scrollbar-track]:transparent
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-white/10">
          {DEPTS.map((d, idx) => {
            const Icon = d.icon;
            const active = dept === d.key;
            const c = C[d.color];
            const cnt = d.key === 'all' ? REPORTS.length : (countByDept[d.key] || 0);
            return (
              <React.Fragment key={d.key}>
                {/* Divider after "All Reports" */}
                {idx === 1 && (
                  <div className="mx-1 my-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                )}
                <button
                  onClick={() => handleSelectDept(d.key)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 relative group',
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                  )}
                >
                  {/* Left accent bar for active */}
                  {active && (
                    <span className={clsx(
                      'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full',
                      c.btn.split(' ')[0]
                    )} />
                  )}

                  {/* Icon box */}
                  <div className={clsx(
                    'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150',
                    active ? c.bg : 'bg-white/[0.06] group-hover:bg-white/10'
                  )}>
                    <Icon className={clsx('w-3 h-3', active ? c.icon : 'text-slate-500 group-hover:text-slate-300')} />
                  </div>

                  <span className="text-[11px] font-semibold flex-1 truncate leading-none">{d.label}</span>

                  <span className={clsx(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none tabular-nums',
                    active ? c.badge : 'bg-white/[0.08] text-slate-500'
                  )}>{cnt}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer hint */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] text-slate-600 leading-snug">
            Select a department → pick a report → click <span className="text-indigo-400 font-semibold">Generate</span>
          </p>
        </div>
      </aside>

      {/* ── Report list ────────────────────────────────────────────────────── */}
      <div className="report-hub-list-panel w-64 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden">

        {/* Panel header */}
        <div className="px-3 pt-3 pb-2.5 border-b border-slate-100 flex-shrink-0">
          {/* Dept label */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {DEPTS.find(d => d.key === dept)?.label || 'Reports'}
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">
              {visibleReports.length} report{visibleReports.length !== 1 ? 's' : ''}
            </span>
          </div>
          {/* Search */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-200
                          focus-within:border-indigo-300 focus-within:bg-indigo-50/30 transition-all">
            <Search className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reports…"
              className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Report cards */}
        <div className="flex-1 overflow-y-auto py-2 px-2
                        [&::-webkit-scrollbar]:w-1
                        [&::-webkit-scrollbar-track]:transparent
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        [&::-webkit-scrollbar-thumb]:bg-slate-200">
          {visibleReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
              <Search className="w-6 h-6 opacity-30" />
              <p className="text-xs">No reports found</p>
            </div>
          ) : (
            visibleReports.map(r => {
              const Icon = r.icon;
              const active = selectedReport?.key === r.key;
              const c = C[r.color];
              return (
                <button
                  key={r.key}
                  onClick={() => setSelectedReport(r)}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all duration-150 relative overflow-hidden group',
                    active
                      ? 'bg-slate-50 shadow-sm'
                      : 'hover:bg-slate-50'
                  )}
                >
                  {/* Colored left border accent */}
                  <span className={clsx(
                    'absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all duration-150',
                    active ? c.btn.split(' ')[0] : 'opacity-0 group-hover:opacity-40 ' + c.btn.split(' ')[0]
                  )} />

                  <div className="flex items-start gap-2.5 pl-1">
                    <div className={clsx(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-150',
                      active ? c.bg : 'bg-slate-100 group-hover:' + c.bg
                    )}>
                      <Icon className={clsx('w-3.5 h-3.5 transition-all duration-150', active ? c.icon : 'text-slate-400 group-hover:' + c.icon.split(' ')[0])} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={clsx(
                        'text-[11px] font-semibold leading-tight',
                        active ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'
                      )}>{r.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-2">{r.desc}</p>
                    </div>
                    {active && (
                      <ChevronRight className={clsx('w-3 h-3 flex-shrink-0 mt-1', c.icon)} />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Report generator ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {selectedReport
          ? <ReportGenerator report={selectedReport} />
          : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <FileBarChart className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a report to generate</p>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ReportGenerator({ report }) {
  const today = new Date().toISOString().slice(0,10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate]     = useState(today);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects]   = useState([]);

  const [loading, setLoading]  = useState(false);
  const [rows, setRows]        = useState(null);
  const [error, setError]      = useState('');
  const [generated, setGenerated] = useState(false);

  const hasDateFilter    = report.filters?.includes('dateRange');
  const hasProjectFilter = report.filters?.includes('project');

  // load projects list for filter
  useEffect(() => {
    if (!hasProjectFilter) return;
    api.get('/projects').then(r => setProjects(Array.isArray(r.data) ? r.data : r.data?.data || [])).catch(() => {});
  }, [hasProjectFilter]);

  // reset when report changes
  useEffect(() => {
    setRows(null);
    setError('');
    setGenerated(false);
  }, [report.key]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    setRows(null);
    try {
      const params = {};
      if (hasDateFilter) {
        // some routes use from/to, others from_date/to_date
        const fp = report.dateParams?.from || 'from_date';
        const tp = report.dateParams?.to   || 'to_date';
        params[fp] = fromDate;
        params[tp] = toDate;
        // also send the common aliases so any route can pick it up
        params.from = fromDate;
        params.to   = toDate;
      }
      if (hasProjectFilter && projectId) params.project_id = projectId;
      const res = await api.get(report.endpoint, { params });

      // extract array from response — try dataKey first, then common shapes
      const dk = report.dataKey;
      let data = dk && Array.isArray(res.data?.[dk]) ? res.data[dk]
               : Array.isArray(res.data)             ? res.data
               : Array.isArray(res.data?.data)       ? res.data.data
               : Array.isArray(res.data?.rows)        ? res.data.rows
               : Array.isArray(res.data?.bills)       ? res.data.bills
               : Array.isArray(res.data?.records)     ? res.data.records
               : [];
      if (report.transform) data = report.transform(data);
      if (report.aggregate) data = report.aggregate(data);
      setRows(data);
      setGenerated(true);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e.message || 'Failed to load data';
      setError(`${e?.response?.status ? `[${e.response.status}] ` : ''}${msg}`);
    } finally {
      setLoading(false);
    }
  }, [report, fromDate, toDate, projectId, hasDateFilter, hasProjectFilter]);

  const handlePrint = () => {
    const landscape = report.columns.length > 6;
    const style = document.createElement('style');
    style.id = '__rpt-print-style__';
    style.textContent = `
      @media print {
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm; }

        /* ── 1. Force ALL overflow containers to be visible so table can paginate ── */
        html, body {
          height: auto !important;
          overflow: visible !important;
        }
        /* Every flex/overflow container must become visible for multi-page printing */
        body * {
          overflow: visible !important;
          max-height: none !important;
        }
        /* Undo fixed/absolute heights on flex wrappers */
        .flex, .flex-col, .flex-1, [class*="overflow"] {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }

        /* ── 2. Hide the 3-panel layout chrome ── */
        .report-hub-dept-sidebar,
        .report-hub-list-panel,
        .report-hub-filter-bar,
        .report-hub-header { display: none !important; }

        /* ── 3. Report output card ── */
        #report-output {
          box-shadow: none !important;
          border-radius: 0 !important;
          border: none !important;
          overflow: visible !important;
          width: 100% !important;
        }

        /* ── 4. Print header ── */
        #report-print-header {
          display: flex !important;
          background: #1e3a5f !important;
          color: #fff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          padding: 10px 14px !important;
        }

        /* ── 5. Table — allow rows to flow across pages ── */
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: auto !important;
        }
        thead { display: table-header-group !important; }
        tfoot { display: table-footer-group !important; }
        tbody tr { page-break-inside: avoid; break-inside: avoid; }

        thead tr, thead th {
          background: #1e3a5f !important;
          color: #fff !important;
          font-size: 7pt !important;
          padding: 5px 6px !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        tbody tr:nth-child(even) {
          background: #f8fafc !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        tbody td {
          font-size: 7.5pt !important;
          padding: 4px 6px !important;
          border-bottom: 0.5pt solid #e2e8f0 !important;
        }
        tfoot tr {
          background: #f0f4ff !important;
          border-top: 1.5pt solid #1e3a5f !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        tfoot td {
          font-size: 7.5pt !important;
          font-weight: bold !important;
          padding: 4px 6px !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const handleExport = () => {
    if (!rows || !rows.length) return;
    const headers = report.columns.map(c => c.label);
    const csvRows = [
      headers.join(','),
      ...rows.map(r =>
        report.columns.map(c => {
          const v = r[c.key];
          if (v === null || v === undefined) return '';
          return `"${String(v).replace(/"/g,'""')}"`;
        }).join(',')
      )
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${report.title.replace(/\s+/g,'-')}-${today}.csv`;
    a.click();
  };

  const c = C[report.color] || C.indigo;
  const Icon = report.icon;

  // totals for amount columns
  const totals = useMemo(() => {
    if (!rows) return {};
    const t = {};
    report.columns.forEach(col => {
      if (col.type === 'amount' || col.type === 'number') {
        t[col.key] = rows.reduce((s, r) => s + (parseFloat(r[col.key]) || 0), 0);
      }
    });
    return t;
  }, [rows, report]);

  return (
    <div className="flex flex-col h-full print:h-auto print:overflow-visible">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="report-hub-header bg-white border-b border-slate-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}>
              <Icon className={clsx('w-5 h-5', c.icon)} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">{report.title}</h2>
              <p className="text-xs text-slate-400">{report.desc}</p>
            </div>
          </div>
          {generated && rows && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters + Generate button ──────────────────────────────────────── */}
      <div className="report-hub-filter-bar bg-white border-b border-slate-100 px-6 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          {hasDateFilter && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50"
                />
              </div>
            </>
          )}
          {hasProjectFilter && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Project</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50 min-w-[180px]"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.project_name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className={clsx(
              'flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold transition-all shadow-sm',
              loading ? 'opacity-60 cursor-not-allowed bg-indigo-400' : `${c.btn}`
            )}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            {loading ? 'Generating…' : 'Generate Report'}
          </button>
          {generated && rows && (
            <span className="text-xs text-slate-400 self-end pb-1.5">
              {rows.length} record{rows.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 print:overflow-visible print:h-auto">

        {/* Not yet generated */}
        {!generated && !loading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className={clsx('w-16 h-16 rounded-2xl flex items-center justify-center', c.bg)}>
              <Icon className={clsx('w-8 h-8 opacity-40', c.icon)} />
            </div>
            <p className="text-sm font-semibold text-slate-500">Set filters and click <span className="text-indigo-600">Generate Report</span></p>
            <p className="text-xs text-slate-400">Results will appear here as a table you can print or export</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty results */}
        {generated && !loading && rows && rows.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Info className="w-10 h-10 opacity-20" />
            <p className="text-sm font-medium">No records found for the selected filters</p>
            <p className="text-xs">Try changing the date range or project</p>
          </div>
        )}

        {/* Data table */}
        {rows && rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" id="report-output">
            {/* Print header (only visible on print) */}
            <div id="report-print-header" className="hidden items-center justify-between bg-[#1e3a5f] text-white px-6 py-4 mb-0">
              <div>
                <p className="text-base font-bold">{report.title}</p>
                {hasDateFilter && (
                  <p className="text-xs opacity-80 mt-0.5">Period: {new Date(fromDate).toLocaleDateString('en-IN')} — {new Date(toDate).toLocaleDateString('en-IN')}</p>
                )}
              </div>
              <p className="text-xs opacity-70">Generated: {new Date().toLocaleString('en-IN')}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="px-3 py-2.5 text-left font-semibold text-[11px] w-8">#</th>
                    {report.columns.map(col => (
                      <th key={col.key} className={clsx(
                        'px-3 py-2.5 font-semibold text-[11px] whitespace-nowrap',
                        col.type === 'amount' || col.type === 'number' ? 'text-right' : 'text-left'
                      )}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2 text-slate-400 text-[10px]">{i + 1}</td>
                      {report.columns.map(col => (
                        <td key={col.key} className={clsx(
                          'px-3 py-2 text-slate-700 border-b border-slate-100',
                          col.mono ? 'font-mono text-[10px]' : '',
                          col.type === 'amount' || col.type === 'number' ? 'text-right tabular-nums' : ''
                        )}>
                          {fmt(row[col.key], col.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                {Object.keys(totals).length > 0 && (
                  <tfoot>
                    <tr className="bg-[#f0f4ff] font-bold border-t-2 border-[#1e3a5f]">
                      <td className="px-3 py-2.5 text-[11px] text-slate-500">—</td>
                      {report.columns.map(col => (
                        <td key={col.key} className={clsx(
                          'px-3 py-2.5 text-[11px]',
                          col.type === 'amount' || col.type === 'number' ? 'text-right tabular-nums font-bold text-slate-800' : ''
                        )}>
                          {totals[col.key] !== undefined
                            ? col.type === 'amount'
                              ? '₹' + Number(totals[col.key]).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
                              : Number(totals[col.key]).toLocaleString('en-IN')
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
