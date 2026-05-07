// src/pages/billing/BillingReportsPage.jsx - Billing Reports Module (Redesigned)
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, Calendar, Filter, Search,
  TrendingUp, BarChart3, PieChart, Activity,
  DollarSign, Receipt, CreditCard, AlertCircle,
  ChevronDown, Printer, Eye, Clock,
  CheckCircle, XCircle, ArrowUpRight, X, Zap,
  Building2
} from 'lucide-react';
import { projectAPI, raBillAPI, paymentAPI, reportAPI, vendorAPI } from '../../api/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const BillingReportsPage = () => {
  const [selectedReport, setSelectedReport] = useState('');
  const [dateRange, setDateRange] = useState('this-year');
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [billingStatus, setBillingStatus] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: raBills = [] } = useQuery({
    queryKey: ['ra-bills'],
    queryFn: () => raBillAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: vendorLedger = [] } = useQuery({
    queryKey: ['vendor-ledger-report', selectedProject],
    queryFn: () => reportAPI.vendorLedger(selectedProject !== 'all' ? { project_id: selectedProject } : {})
      .then(r => r.data?.data || []).catch(() => []),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: () => vendorAPI.list().then(r => r.data?.data || r.data || []).catch(() => []),
  });

  const billingReportTypes = [
    {
      id: 'ra-bill-register',
      name: 'RA Bill Register',
      description: 'Comprehensive register of all running account bills',
      icon: Receipt,
      accent: '#3b82f6',
      accentLight: '#eff6ff',
      category: 'Register',
    },
    {
      id: 'payment-register',
      name: 'Payment Register',
      description: 'Detailed payment transaction records and history',
      icon: CreditCard,
      accent: '#10b981',
      accentLight: '#f0fdf4',
      category: 'Register',
    },
    {
      id: 'outstanding-bills',
      name: 'Outstanding Bills',
      description: 'Unpaid and pending bills with aging analysis',
      icon: AlertCircle,
      accent: '#ef4444',
      accentLight: '#fef2f2',
      category: 'Analysis',
    },
    {
      id: 'aging-report',
      name: 'Aging Report',
      description: 'Bill aging analysis by 30/60/90+ day periods',
      icon: Clock,
      accent: '#f97316',
      accentLight: '#fff7ed',
      category: 'Analysis',
    },
    {
      id: 'cash-flow',
      name: 'Cash Flow Statement',
      description: 'Monthly cash inflow and outflow trends',
      icon: TrendingUp,
      accent: '#8b5cf6',
      accentLight: '#f5f3ff',
      category: 'Summary',
    },
    {
      id: 'billing-efficiency',
      name: 'Billing Efficiency',
      description: 'Billing cycle performance and collection metrics',
      icon: BarChart3,
      accent: '#6366f1',
      accentLight: '#eef2ff',
      category: 'Analysis',
    },
    {
      id: 'revenue-forecast',
      name: 'Revenue Forecast',
      description: 'Projected revenue based on pipeline trends',
      icon: ArrowUpRight,
      accent: '#14b8a6',
      accentLight: '#f0fdfa',
      category: 'Summary',
    },
    {
      id: 'client-billing',
      name: 'Client Billing Summary',
      description: 'Billing breakdown and collection by client',
      icon: PieChart,
      accent: '#ec4899',
      accentLight: '#fdf2f8',
      category: 'Summary',
    },
    {
      id: 'vendor-ledger',
      name: 'Vendor Ledger',
      description: 'Consolidated invoiced, certified, paid and outstanding per vendor',
      icon: Building2,
      accent: '#0f766e',
      accentLight: '#f0fdfa',
      category: 'Vendor',
    },
    {
      id: 'vendor-outstanding',
      name: 'Vendor Outstanding',
      description: 'Unpaid balances owed to each vendor across all sources',
      icon: AlertCircle,
      accent: '#b45309',
      accentLight: '#fffbeb',
      category: 'Vendor',
    },
    {
      id: 'vendor-tds',
      name: 'Vendor TDS Report',
      description: 'TDS deducted per vendor — useful for Form 26Q filing',
      icon: CreditCard,
      accent: '#7c3aed',
      accentLight: '#f5f3ff',
      category: 'Vendor',
    },
    {
      id: 'vendor-payment-register',
      name: 'Vendor Payment Register',
      description: 'All payments made to vendors with mode and reference',
      icon: DollarSign,
      accent: '#0369a1',
      accentLight: '#f0f9ff',
      category: 'Vendor',
    },
  ];

  const categories = ['All', 'Register', 'Analysis', 'Summary', 'Vendor'];

  const filteredReports = billingReportTypes.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || report.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // ── Billing stats ──
  const totalBills = raBills.length;
  const paidBills = raBills.filter(b => b.status === 'paid').length;
  const pendingBills = raBills.filter(b => b.status === 'submitted').length;
  const totalBilled = raBills.reduce((s, b) => s + parseFloat(b.net_payable || 0), 0);
  const totalCollected = raBills
    .filter(b => b.payment_status === 'paid')
    .reduce((s, b) => s + parseFloat(b.amount_received || b.net_payable || 0), 0);
  const outstanding = totalBilled - totalCollected;
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : 0;

  const generateReportData = (reportId) => {
    let filteredBills = raBills;
    let filteredPayments = payments;

    if (selectedProject !== 'all') {
      filteredBills = raBills.filter(b => b.project_id === selectedProject);
      filteredPayments = payments.filter(p => p.project_id === selectedProject);
    }

    if (billingStatus !== 'all') {
      filteredBills = filteredBills.filter(b => b.status === billingStatus);
    }

    if (dateRange !== 'all') {
      const now = dayjs();
      let startDate;
      switch (dateRange) {
        case 'today': startDate = now.startOf('day'); break;
        case 'this-week': startDate = now.startOf('week'); break;
        case 'this-month': startDate = now.startOf('month'); break;
        case 'last-month': startDate = now.subtract(1, 'month').startOf('month'); break;
        case 'this-quarter': startDate = now.startOf('quarter'); break;
        case 'this-year': startDate = now.startOf('year'); break;
        default: startDate = now.startOf('year');
      }
      filteredBills = filteredBills.filter(b => dayjs(b.bill_date || b.created_at).isAfter(startDate));
      filteredPayments = filteredPayments.filter(p => dayjs(p.payment_date || p.created_at).isAfter(startDate));
    }

    switch (reportId) {
      case 'ra-bill-register':
        return {
          title: 'RA Bill Register',
          type: reportId,
          data: filteredBills.length > 0 ? filteredBills.map(bill => ({
            billNumber: bill.bill_number || `RA-${bill.id}`,
            project: projects.find(p => p.id === bill.project_id)?.name || 'Unknown',
            billDate: bill.bill_date || '—',
            grossAmount: parseFloat(bill.gross_amount || 0),
            deductions: parseFloat(bill.deductions || 0),
            netPayable: parseFloat(bill.net_payable || 0),
            status: bill.status || 'pending',
          })) : [{ billNumber: 'No Bills', project: 'No Data', billDate: '—', grossAmount: 0, deductions: 0, netPayable: 0, status: '—' }],
          summary: {
            totalBills: filteredBills.length,
            totalGross: filteredBills.reduce((s, b) => s + parseFloat(b.gross_amount || 0), 0),
            totalNet: filteredBills.reduce((s, b) => s + parseFloat(b.net_payable || 0), 0),
            paidBills: filteredBills.filter(b => b.status === 'paid').length,
          },
        };

      case 'payment-register':
        return {
          title: 'Payment Register',
          type: reportId,
          data: filteredPayments.length > 0 ? filteredPayments.map(p => ({
            reference: p.reference_number || `PAY-${p.id}`,
            date: p.payment_date || p.created_at || '—',
            amount: parseFloat(p.amount || 0),
            mode: p.payment_mode || 'N/A',
            status: p.status || 'completed',
          })) : [{ reference: 'No Payments', date: '—', amount: 0, mode: '—', status: '—' }],
          summary: {
            totalPayments: filteredPayments.length,
            totalAmount: filteredPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
          },
        };

      case 'outstanding-bills':
        const outstanding = filteredBills.filter(b => b.status !== 'paid');
        return {
          title: 'Outstanding Bills Report',
          type: reportId,
          data: outstanding.length > 0 ? outstanding.map(bill => ({
            billNumber: bill.bill_number || `RA-${bill.id}`,
            project: projects.find(p => p.id === bill.project_id)?.name || 'Unknown',
            dueAmount: parseFloat(bill.net_payable || 0),
            daysOverdue: dayjs().diff(dayjs(bill.bill_date || bill.created_at), 'day'),
            status: bill.status || 'pending',
          })) : [{ billNumber: 'No Outstanding', project: '—', dueAmount: 0, daysOverdue: 0, status: '—' }],
          summary: {
            totalOutstanding: outstanding.length,
            totalDue: outstanding.reduce((s, b) => s + parseFloat(b.net_payable || 0), 0),
          },
        };

      case 'aging-report':
        const now = dayjs();
        const aged = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
        filteredBills.filter(b => b.status !== 'paid').forEach(bill => {
          const days = now.diff(dayjs(bill.bill_date || bill.created_at), 'day');
          if (days <= 30) aged['0-30'].push(bill);
          else if (days <= 60) aged['31-60'].push(bill);
          else if (days <= 90) aged['61-90'].push(bill);
          else aged['90+'].push(bill);
        });
        return {
          title: 'Aging Report',
          type: reportId,
          data: Object.entries(aged).map(([period, bills]) => ({
            agingPeriod: `${period} days`,
            billCount: bills.length,
            totalAmount: bills.reduce((s, b) => s + parseFloat(b.net_payable || 0), 0),
          })),
          summary: {
            totalUnpaid: filteredBills.filter(b => b.status !== 'paid').length,
            totalOverdue: filteredBills.filter(b => b.status !== 'paid' && now.diff(dayjs(b.bill_date || b.created_at), 'day') > 30).length,
          },
        };

      case 'cash-flow': {
        // Group payments by month
        const monthMap = {};
        filteredPayments.forEach(p => {
          const key = dayjs(p.payment_date || p.created_at).format('MMM YYYY');
          if (!monthMap[key]) monthMap[key] = { month: key, inflow: 0, outflow: 0, netFlow: 0 };
          monthMap[key].inflow += parseFloat(p.amount || 0);
        });
        filteredBills.forEach(b => {
          const key = dayjs(b.bill_date || b.created_at).format('MMM YYYY');
          if (!monthMap[key]) monthMap[key] = { month: key, inflow: 0, outflow: 0, netFlow: 0 };
          monthMap[key].outflow += parseFloat(b.net_payable || 0);
        });
        const cashData = Object.values(monthMap).sort((a, b) => dayjs(a.month, 'MMM YYYY').diff(dayjs(b.month, 'MMM YYYY')));
        cashData.forEach(m => { m.netFlow = m.inflow - m.outflow; });
        const fmtM = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN')}`;
        const data = cashData.length > 0
          ? cashData.map(m => ({ month: m.month, inflow: fmtM(m.inflow), outflow: fmtM(m.outflow), netFlow: fmtM(m.netFlow) }))
          : [{ month: 'No Data', inflow: '₹0', outflow: '₹0', netFlow: '₹0' }];
        const totalIn = filteredPayments.reduce((s,p) => s + parseFloat(p.amount || 0), 0);
        const totalOut = filteredBills.reduce((s,b) => s + parseFloat(b.net_payable || 0), 0);
        return {
          title: 'Cash Flow Statement',
          type: 'cash-flow',
          data,
          summary: {
            'Total Inflow': fmtM(totalIn),
            'Total Outflow': fmtM(totalOut),
            'Net Cash Flow': fmtM(totalIn - totalOut),
            'Months': cashData.length,
          },
        };
      }

      case 'billing-efficiency': {
        const fmtE = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN')}`;
        const byProject = projects.map(p => {
          const bills = filteredBills.filter(b => b.project_id === p.id);
          const paid = bills.filter(b => b.status === 'paid');
          const totalBilled2 = bills.reduce((s,b) => s + parseFloat(b.net_payable||0), 0);
          const totalCollected2 = paid.reduce((s,b) => s + parseFloat(b.amount_received || b.net_payable||0), 0);
          const collectionRate = totalBilled2 > 0 ? ((totalCollected2 / totalBilled2) * 100).toFixed(1) : '0.0';
          const avgDays = paid.length > 0
            ? Math.round(paid.reduce((s,b) => s + Math.max(0, dayjs(b.updated_at || b.created_at).diff(dayjs(b.bill_date || b.created_at), 'day')), 0) / paid.length)
            : 0;
          return { project: p.name, totalBills: bills.length, paidBills: paid.length, totalBilled: fmtE(totalBilled2), collected: fmtE(totalCollected2), collectionRate: `${collectionRate}%`, avgDaysToCollect: avgDays };
        }).filter(p => p.totalBills > 0);
        const allPaid = filteredBills.filter(b => b.status === 'paid').length;
        return {
          title: 'Billing Efficiency Report',
          type: 'billing-efficiency',
          data: byProject.length > 0 ? byProject : [{ project: 'No Data', totalBills: 0, paidBills: 0, totalBilled: '₹0', collected: '₹0', collectionRate: '0%', avgDaysToCollect: 0 }],
          summary: {
            'Total Bills': filteredBills.length,
            'Paid Bills': allPaid,
            'Collection Rate': filteredBills.length > 0 ? `${((allPaid / filteredBills.length) * 100).toFixed(1)}%` : '0%',
            'Projects Active': byProject.length,
          },
        };
      }

      case 'revenue-forecast': {
        const fmtF = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN')}`;
        // Project remaining value = contract - certified
        const forecastData = projects.map(p => {
          const certifiedBills = raBills.filter(b => b.project_id === p.id && ['certified','paid'].includes(b.status));
          const certified = certifiedBills.reduce((s,b) => s + parseFloat(b.net_payable||0), 0);
          const contractVal = parseFloat(p.contract_value || 0);
          const remaining = Math.max(0, contractVal - certified);
          const pctComplete = contractVal > 0 ? ((certified / contractVal) * 100).toFixed(1) : '0.0';
          return { project: p.name, status: p.status || '—', contractValue: fmtF(contractVal), certifiedToDate: fmtF(certified), remainingValue: fmtF(remaining), percentComplete: `${pctComplete}%` };
        }).filter(p => parseFloat((p.contractValue || '0').replace(/[₹,]/g,'')) > 0);
        const totalRemaining = projects.reduce((s,p) => {
          const cert = raBills.filter(b => b.project_id === p.id && ['certified','paid'].includes(b.status)).reduce((a,b) => a + parseFloat(b.net_payable||0), 0);
          return s + Math.max(0, parseFloat(p.contract_value||0) - cert);
        }, 0);
        const totalContract = projects.reduce((s,p) => s + parseFloat(p.contract_value||0), 0);
        return {
          title: 'Revenue Forecast Report',
          type: 'revenue-forecast',
          data: forecastData.length > 0 ? forecastData : [{ project: 'No Data', status: '—', contractValue: '₹0', certifiedToDate: '₹0', remainingValue: '₹0', percentComplete: '0%' }],
          summary: {
            'Total Pipeline': fmtF(totalContract),
            'Certified To Date': fmtF(totalContract - totalRemaining),
            'Forecast Remaining': fmtF(totalRemaining),
            'Active Projects': projects.filter(p => p.status === 'active').length,
          },
        };
      }

      case 'client-billing': {
        const fmtC = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN')}`;
        const data = projects.map(p => {
          const bills = filteredBills.filter(b => b.project_id === p.id);
          const paid = bills.filter(b => b.status === 'paid');
          const pending = bills.filter(b => !['paid','rejected'].includes(b.status));
          const totalNet = bills.reduce((s,b) => s + parseFloat(b.net_payable||0), 0);
          const totalCollected2 = paid.reduce((s,b) => s + parseFloat(b.amount_received || b.net_payable||0), 0);
          return { project: p.name, totalBills: bills.length, paidBills: paid.length, pendingBills: pending.length, totalBilled: fmtC(totalNet), amountCollected: fmtC(totalCollected2), outstanding: fmtC(totalNet - totalCollected2) };
        }).filter(p => p.totalBills > 0);
        const grandNet = filteredBills.reduce((s,b) => s + parseFloat(b.net_payable||0), 0);
        const grandCollected = filteredBills.filter(b => b.status === 'paid').reduce((s,b) => s + parseFloat(b.amount_received || b.net_payable||0), 0);
        return {
          title: 'Client Billing Summary',
          type: 'client-billing',
          data: data.length > 0 ? data : [{ project: 'No Data', totalBills: 0, paidBills: 0, pendingBills: 0, totalBilled: '₹0', amountCollected: '₹0', outstanding: '₹0' }],
          summary: {
            'Total Clients': data.length,
            'Total Billed': fmtC(grandNet),
            'Total Collected': fmtC(grandCollected),
            'Outstanding': fmtC(grandNet - grandCollected),
          },
        };
      }

      case 'vendor-ledger': {
        const fmtV = v => `₹${parseFloat(v || 0).toLocaleString('en-IN')}`;
        const rows = vendorLedger.length > 0
          ? vendorLedger.map(v => ({
              vendor: v.vendor_name || '—',
              bills: v.bill_count || 0,
              invoiced: fmtV(v.total_invoiced),
              certified: fmtV(v.total_certified),
              paid: fmtV(v.total_paid),
              tdsDeducted: fmtV(v.total_tds),
              retention: fmtV(v.total_retention),
              outstanding: fmtV(v.outstanding),
            }))
          : [{ vendor: 'No Data', bills: 0, invoiced: '₹0', certified: '₹0', paid: '₹0', tdsDeducted: '₹0', retention: '₹0', outstanding: '₹0' }];
        const totInvoiced = vendorLedger.reduce((s, v) => s + parseFloat(v.total_invoiced || 0), 0);
        const totPaid = vendorLedger.reduce((s, v) => s + parseFloat(v.total_paid || 0), 0);
        const totOutstanding = vendorLedger.reduce((s, v) => s + parseFloat(v.outstanding || 0), 0);
        const totTds = vendorLedger.reduce((s, v) => s + parseFloat(v.total_tds || 0), 0);
        return {
          title: 'Vendor Ledger',
          type: 'vendor-ledger',
          data: rows,
          summary: {
            'Total Vendors': vendorLedger.length,
            'Total Invoiced': fmtV(totInvoiced),
            'Total Paid': fmtV(totPaid),
            'Outstanding': fmtV(totOutstanding),
            'TDS Deducted': fmtV(totTds),
          },
        };
      }

      case 'vendor-outstanding': {
        const fmtO = v => `₹${parseFloat(v || 0).toLocaleString('en-IN')}`;
        const outstanding = vendorLedger.filter(v => parseFloat(v.outstanding || 0) > 0);
        const rows = outstanding.length > 0
          ? outstanding
              .sort((a, b) => parseFloat(b.outstanding) - parseFloat(a.outstanding))
              .map(v => ({
                vendor: v.vendor_name || '—',
                bills: v.bill_count || 0,
                totalInvoiced: fmtO(v.total_invoiced),
                totalPaid: fmtO(v.total_paid),
                outstanding: fmtO(v.outstanding),
                retentionHeld: fmtO(v.total_retention),
              }))
          : [{ vendor: 'No Outstanding', bills: 0, totalInvoiced: '₹0', totalPaid: '₹0', outstanding: '₹0', retentionHeld: '₹0' }];
        const totOut = outstanding.reduce((s, v) => s + parseFloat(v.outstanding || 0), 0);
        const totRet = outstanding.reduce((s, v) => s + parseFloat(v.total_retention || 0), 0);
        return {
          title: 'Vendor Outstanding Report',
          type: 'vendor-outstanding',
          data: rows,
          summary: {
            'Vendors with Outstanding': outstanding.length,
            'Total Outstanding': fmtO(totOut),
            'Retention Held': fmtO(totRet),
            'Net Payable': fmtO(totOut - totRet),
          },
        };
      }

      case 'vendor-tds': {
        const fmtT = v => `₹${parseFloat(v || 0).toLocaleString('en-IN')}`;
        const rows = vendorLedger.filter(v => parseFloat(v.total_tds || 0) > 0);
        const data = rows.length > 0
          ? rows
              .sort((a, b) => parseFloat(b.total_tds) - parseFloat(a.total_tds))
              .map(v => ({
                vendor: v.vendor_name || '—',
                grossInvoiced: fmtT(v.total_invoiced),
                tdsDeducted: fmtT(v.total_tds),
                netPaid: fmtT(v.total_paid),
              }))
          : [{ vendor: 'No TDS Data', grossInvoiced: '₹0', tdsDeducted: '₹0', netPaid: '₹0' }];
        const totTdsV = rows.reduce((s, v) => s + parseFloat(v.total_tds || 0), 0);
        const totGross = rows.reduce((s, v) => s + parseFloat(v.total_invoiced || 0), 0);
        return {
          title: 'Vendor TDS Report',
          type: 'vendor-tds',
          data,
          summary: {
            'Vendors with TDS': rows.length,
            'Total Gross': fmtT(totGross),
            'Total TDS Deducted': fmtT(totTdsV),
            'Effective TDS %': totGross > 0 ? `${((totTdsV / totGross) * 100).toFixed(1)}%` : '0%',
          },
        };
      }

      case 'vendor-payment-register': {
        const fmtP2 = v => `₹${parseFloat(v || 0).toLocaleString('en-IN')}`;
        const vendorPayments = payments.filter(p => p.payment_type !== 'customer_receipt');
        const data = vendorPayments.length > 0
          ? vendorPayments.map(p => ({
              date: p.payment_date ? dayjs(p.payment_date).format('DD MMM YYYY') : '—',
              vendor: p.entity_name || '—',
              reference: p.reference_number || `PAY-${p.id?.slice(0, 8)}`,
              mode: p.payment_mode || '—',
              bank: p.bank_name || '—',
              amount: fmtP2(p.amount),
              tds: fmtP2(p.tds_deducted),
              netPaid: fmtP2(p.net_amount),
              costHead: p.cost_head || '—',
            }))
          : [{ date: 'No Payments', vendor: '—', reference: '—', mode: '—', bank: '—', amount: '₹0', tds: '₹0', netPaid: '₹0', costHead: '—' }];
        const totAmt = vendorPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const totTdsPay = vendorPayments.reduce((s, p) => s + parseFloat(p.tds_deducted || 0), 0);
        const totNet = vendorPayments.reduce((s, p) => s + parseFloat(p.net_amount || 0), 0);
        return {
          title: 'Vendor Payment Register',
          type: 'vendor-payment-register',
          data,
          summary: {
            'Total Payments': vendorPayments.length,
            'Gross Amount': fmtP2(totAmt),
            'TDS Deducted': fmtP2(totTdsPay),
            'Net Paid': fmtP2(totNet),
          },
        };
      }

      default:
        return {
          title: billingReportTypes.find(r => r.id === reportId)?.name || 'Billing Report',
          type: reportId,
          data: filteredBills.slice(0, 8).map(bill => ({
            billNumber: bill.bill_number || `RA-${bill.id}`,
            amount: `₹${parseFloat(bill.net_payable || 0).toLocaleString('en-IN')}`,
            status: bill.status || 'pending',
          })),
          summary: {
            'Total Records': filteredBills.length,
            'Total Amount': `₹${filteredBills.reduce((s,b) => s + parseFloat(b.net_payable||0), 0).toLocaleString('en-IN')}`,
          },
        };
    }
  };

  const handleGenerateReport = async (reportId) => {
    setSelectedReport(reportId);
    setIsGenerating(true);
    setError('');
    setGeneratedReport(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1800));
      const data = generateReportData(reportId);
      setGeneratedReport(data);
    } catch (err) {
      setError('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = (format = 'pdf') => {
    if (!generatedReport) { setError('Please generate a report first'); return; }
    if (format === 'pdf') { generatePDF(); return; }
    const content = JSON.stringify(generatedReport, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedReport.title.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generatePDF = () => {
    if (!generatedReport) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const now = dayjs().format('DD MMM YYYY, hh:mm A');

    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 32, 80);
    doc.text('BCIM Engineering Pvt. Ltd.', 14, 16);
    doc.setFontSize(11); doc.setTextColor(59, 130, 246);
    doc.text(generatedReport.title, 14, 24);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${now}  |  Billing Reports Module`, 14, 30);

    let y = 38;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 32, 80);
    doc.text('SUMMARY', 14, y); y += 4;
    const summaryEntries = Object.entries(generatedReport.summary);
    const colW = 60;
    summaryEntries.forEach(([key, val], i) => {
      const x = 14 + (i % 4) * colW;
      const rowY = y + Math.floor(i / 4) * 12;
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
      doc.text(key.toUpperCase(), x, rowY + 4);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 32, 80);
      doc.text(String(val ?? '—'), x, rowY + 10);
    });
    y += Math.ceil(summaryEntries.length / 4) * 12 + 6;

    if (generatedReport.data.length > 0) {
      const head = [Object.keys(generatedReport.data[0]).map(k => k.replace(/([A-Z])/g, ' $1').trim().toUpperCase())];
      const body = generatedReport.data.map(row => Object.values(row).map(v => String(v ?? '—')));
      autoTable(doc, {
        startY: y,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [15, 32, 80], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      });
    }

    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`Page ${i} of ${pages}  |  BCIM ERP — Billing Reports  |  Confidential`, 14, doc.internal.pageSize.height - 8);
    }

    doc.save(`${generatedReport.title.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.pdf`);
  };


  const formatCurrency = (val) =>
    val > 1000000 ? `₹${(val / 1000000).toFixed(2)}M`
    : val > 1000 ? `₹${(val / 1000).toFixed(1)}K`
    : `₹${val.toLocaleString('en-IN')}`;

  const overviewCards = [
    { label: 'Total Bills', value: totalBills, sub: `${paidBills} paid`, icon: Receipt, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Total Billed', value: formatCurrency(totalBilled), sub: 'Gross amount', icon: DollarSign, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Outstanding', value: formatCurrency(outstanding), sub: `${pendingBills} pending bills`, icon: AlertCircle, color: '#ef4444', bg: '#fef2f2' },
    { label: 'Collection Rate', value: `${collectionRate}%`, sub: formatCurrency(totalCollected) + ' collected', icon: TrendingUp, color: '#8b5cf6', bg: '#f5f3ff' },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#f8fafc', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Header ── */}
      <div className="mb-8">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#8b5cf6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>Billing Reports</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Comprehensive billing and payment reporting suite</p>
          </div>
        </div>
      </div>

      {/* ── Overview Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {overviewCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, background: card.bg, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <card.icon size={18} color={card.color} />
              </div>
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{card.value}</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>{card.label}</p>
            <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 24 }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#334155', outline: 'none', background: '#f8fafc' }}
            />
          </div>
          {/* Date Range */}
          <div style={{ position: 'relative' }}>
            <Calendar size={14} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#334155', appearance: 'none', background: '#f8fafc', outline: 'none' }}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
            </select>
            <ChevronDown size={13} color="#94a3b8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          {/* Project */}
          <div style={{ position: 'relative' }}>
            <FileText size={14} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#334155', appearance: 'none', background: '#f8fafc', outline: 'none' }}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={13} color="#94a3b8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          {/* Status */}
          <div style={{ position: 'relative' }}>
            <Filter size={14} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select value={billingStatus} onChange={e => setBillingStatus(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#334155', appearance: 'none', background: '#f8fafc', outline: 'none' }}>
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
            <ChevronDown size={13} color="#94a3b8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          {/* Category Pills */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeCategory === cat ? '#8b5cf6' : '#f1f5f9', color: activeCategory === cat ? 'white' : '#64748b' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={15} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</span>
            </div>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={14} color="#ef4444" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Report Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
        {filteredReports.map((report, i) => {
          const isActive = selectedReport === report.id;
          const isThisGenerating = isGenerating && isActive;
          return (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.09)' }}
              style={{
                background: 'white', borderRadius: 16,
                border: isActive ? `1.5px solid ${report.accent}` : '1px solid #e2e8f0',
                overflow: 'hidden', transition: 'border 0.2s, box-shadow 0.2s',
              }}
            >
              <div style={{ height: 4, background: report.accent }} />
              <div style={{ padding: '20px 20px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, background: report.accentLight, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <report.icon size={21} color={report.accent} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: report.accent, background: report.accentLight, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {report.category}
                  </span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6, lineHeight: 1.3 }}>{report.name}</h3>
                <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 18 }}>{report.description}</p>

                <button
                  onClick={() => handleGenerateReport(report.id)}
                  disabled={isGenerating}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 9, border: 'none', cursor: isGenerating ? 'not-allowed' : 'pointer',
                    background: isThisGenerating ? '#e2e8f0' : report.accent, color: isThisGenerating ? '#94a3b8' : 'white',
                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'opacity 0.15s', marginBottom: 10,
                  }}
                >
                  {isThisGenerating ? (
                    <>
                      <div style={{ width: 14, height: 14, border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Generating...
                    </>
                  ) : (
                    <><Eye size={14} />Generate Report</>
                  )}
                </button>

                <div style={{ display: 'flex', gap: 6 }}>
                  {['PDF', 'Excel'].map(fmt => (
                    <button key={fmt}
                      onClick={() => {
                        if (!generatedReport || generatedReport.type !== report.id) {
                          setError(`Please generate "${report.name}" first`);
                        } else { handleDownloadReport(fmt.toLowerCase()); }
                      }}
                      style={{ flex: 1, padding: '8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 12, fontWeight: 500, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <Download size={12} />{fmt}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (!generatedReport || generatedReport.type !== report.id) {
                        setError(`Please generate "${report.name}" first`);
                      } else { generatePDF(); }
                    }}
                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Printer size={13} color="#64748b" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Generated Report Preview ── */}
      <AnimatePresence>
        {generatedReport ? (
          <motion.div key="report-out" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 24 }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={18} color="#8b5cf6" />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{generatedReport.title}</h2>
                  <p style={{ fontSize: 12, color: '#64748b' }}>Generated {new Date().toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDownloadReport('pdf')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Download size={14} /> PDF
                </button>
                <button onClick={() => handleDownloadReport('excel')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Download size={14} /> Excel
                </button>
                <button onClick={() => setGeneratedReport(null)}
                  style={{ padding: '9px 12px', background: '#f1f5f9', border: 'none', borderRadius: 9, cursor: 'pointer' }}>
                  <X size={15} color="#64748b" />
                </button>
              </div>
            </div>
            {/* Summary */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Summary</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(generatedReport.summary).map(([key, value]) => (
                  <div key={key} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                      {typeof value === 'number' && value > 1000000 ? formatCurrency(value) : typeof value === 'number' ? value.toLocaleString('en-IN') : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {/* Data table */}
            <div style={{ padding: '20px 24px', overflowX: 'auto' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Data</p>
              {generatedReport.data.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {Object.keys(generatedReport.data[0]).map(key => (
                        <th key={key} style={{ background: '#f1f5f9', padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {generatedReport.data.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {Object.values(row).map((val, ci) => (
                          <td key={ci} style={{ padding: '10px 14px', color: '#334155', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            {typeof val === 'number' && val > 1000000 ? formatCurrency(val) : typeof val === 'number' ? val.toLocaleString('en-IN') : val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'white', borderRadius: 16, border: '1.5px dashed #e2e8f0', padding: '32px 24px', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, background: '#f5f3ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Zap size={22} color="#8b5cf6" />
            </div>
            <p style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>No report generated yet</p>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Click "Generate Report" on any card above to preview and download</p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default BillingReportsPage;
