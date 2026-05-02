// src/pages/qs/ReportsPage.jsx - QS Reports Module (Redesigned)
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, Calendar, Filter, Search,
  TrendingUp, BarChart3, PieChart, Activity,
  Building2, Package, Users, DollarSign,
  ChevronDown, Printer, Eye, AlertCircle,
  CheckCircle, X, Layers, Zap
} from 'lucide-react';
import { projectAPI, raBillAPI, measurementAPI, inventoryAPI } from '../../api/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import dayjs from 'dayjs';

const ReportsPage = () => {
  const [selectedReport, setSelectedReport] = useState('');
  const [dateRange, setDateRange] = useState('this-month');
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
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

  const { data: measurements = [] } = useQuery({
    queryKey: ['measurements-all'],
    queryFn: () => measurementAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory-all'],
    queryFn: () => inventoryAPI.list().then(r => r.data?.data || []).catch(() => []),
  });

  const reportTypes = [
    {
      id: 'boq-summary',
      name: 'BOQ Summary',
      description: 'Complete Bill of Quantities overview with project-wise breakdown',
      icon: Layers,
      category: 'QS',
      accent: '#3b82f6',
      accentLight: '#eff6ff',
    },
    {
      id: 'measurement-report',
      name: 'Measurement Report',
      description: 'Detailed site measurements and quantity verification',
      icon: Package,
      category: 'QS',
      accent: '#10b981',
      accentLight: '#f0fdf4',
    },
    {
      id: 'ra-bill-summary',
      name: 'RA Bill Summary',
      description: 'Running Account bills overview and payment status',
      icon: DollarSign,
      category: 'Billing',
      accent: '#8b5cf6',
      accentLight: '#f5f3ff',
    },
    {
      id: 'payment-tracking',
      name: 'Payment Tracking',
      description: 'Bill payment status, timeline and pending analysis',
      icon: TrendingUp,
      category: 'Billing',
      accent: '#f59e0b',
      accentLight: '#fffbeb',
    },
    {
      id: 'project-progress',
      name: 'Project Progress',
      description: 'Overall project completion metrics and milestones',
      icon: BarChart3,
      category: 'QS',
      accent: '#6366f1',
      accentLight: '#eef2ff',
    },
    {
      id: 'cost-analysis',
      name: 'Cost Analysis',
      description: 'Detailed cost breakdown, variance and budget analysis',
      icon: PieChart,
      category: 'QS',
      accent: '#ec4899',
      accentLight: '#fdf2f8',
    },
    {
      id: 'billing-performance',
      name: 'Billing Performance',
      description: 'Billing efficiency metrics and collection trends',
      icon: Activity,
      category: 'Billing',
      accent: '#14b8a6',
      accentLight: '#f0fdfa',
    },
    {
      id: 'resource-utilization',
      name: 'Resource Utilization',
      description: 'Material consumption and resource usage analysis',
      icon: Users,
      category: 'QS',
      accent: '#f97316',
      accentLight: '#fff7ed',
    },
  ];

  const categories = ['All', 'QS', 'Billing'];

  const filteredReports = reportTypes.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || report.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const generateReportData = (reportId) => {
    let filteredProjects = projects;
    let filteredBills = raBills;

    if (selectedProject !== 'all') {
      filteredProjects = projects.filter(p => p.id === selectedProject);
      filteredBills = raBills.filter(b => b.project_id === selectedProject);
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
        default: startDate = now.startOf('month');
      }
      filteredBills = filteredBills.filter(bill =>
        dayjs(bill.bill_date || bill.created_at).isAfter(startDate)
      );
    }

    const filteredMeasurements = measurements.filter(m =>
      selectedProject === 'all' || m.project_id === selectedProject
    );
    const filteredInventory = inventory.filter(i =>
      selectedProject === 'all' || i.project_id === selectedProject
    );
    const inr = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN')}`;

    switch (reportId) {
      case 'boq-summary': {
        const data = filteredProjects.length > 0
          ? filteredProjects.map(p => {
              const projectBills = filteredBills.filter(b => b.project_id === p.id);
              const certified = projectBills.filter(b => ['certified','paid'].includes(b.status));
              const certifiedAmt = certified.reduce((s,b) => s + parseFloat(b.net_payable || 0), 0);
              const contractVal = parseFloat(p.contract_value || 0);
              const pctBilled = contractVal > 0 ? Math.min(100, ((certifiedAmt / contractVal) * 100)).toFixed(1) : '0.0';
              return {
                project: p.name,
                status: p.status || 'active',
                contractValue: inr(contractVal),
                certifiedBills: certified.length,
                certifiedAmount: inr(certifiedAmt),
                balanceAmount: inr(contractVal - certifiedAmt),
                percentBilled: `${pctBilled}%`,
              };
            })
          : [{ project: 'No Projects', status: '—', contractValue: '₹0', certifiedBills: 0, certifiedAmount: '₹0', balanceAmount: '₹0', percentBilled: '0%' }];
        const totalContract = filteredProjects.reduce((s,p) => s + parseFloat(p.contract_value || 0), 0);
        const totalCertified = filteredBills.filter(b => ['certified','paid'].includes(b.status)).reduce((s,b) => s + parseFloat(b.net_payable || 0), 0);
        return {
          title: 'BOQ Summary Report',
          type: 'boq-summary',
          data,
          summary: {
            'Total Projects': filteredProjects.length,
            'Contract Value': inr(totalContract),
            'Certified Amount': inr(totalCertified),
            'Balance': inr(totalContract - totalCertified),
          },
        };
      }

      case 'measurement-report': {
        const data = filteredMeasurements.length > 0
          ? filteredMeasurements.map(m => ({
              mbNumber: m.mb_number || `MB-${m.id}`,
              project: projects.find(p => p.id === m.project_id)?.name || 'Unknown',
              location: m.location || '—',
              measuredDate: m.measurement_date ? dayjs(m.measurement_date).format('DD-MMM-YYYY') : '—',
              netQuantity: parseFloat(m.net_quantity || 0).toFixed(3),
              unit: m.unit || '—',
              status: (m.status || 'pending').replace(/_/g,' '),
            }))
          : [{ mbNumber: 'No Data', project: '—', location: '—', measuredDate: '—', netQuantity: '0.000', unit: '—', status: '—' }];
        const approvedQty = filteredMeasurements.filter(m => m.status === 'pm_approved').reduce((s,m) => s + parseFloat(m.net_quantity || 0), 0);
        const pendingCount = filteredMeasurements.filter(m => !['pm_approved'].includes(m.status)).length;
        return {
          title: 'Measurement Report',
          type: 'measurement-report',
          data,
          summary: {
            'Total Entries': filteredMeasurements.length,
            'Approved': filteredMeasurements.filter(m => m.status === 'pm_approved').length,
            'Pending Approval': pendingCount,
            'Approved Qty': approvedQty.toFixed(2),
          },
        };
      }

      case 'payment-tracking': {
        const data = filteredBills.length > 0
          ? filteredBills.map(b => {
              const daysOld = dayjs().diff(dayjs(b.bill_date || b.created_at), 'day');
              return {
                billNumber: b.bill_number || `RA-${b.id}`,
                project: projects.find(p => p.id === b.project_id)?.name || 'Unknown',
                billDate: dayjs(b.bill_date || b.created_at).format('DD-MMM-YYYY'),
                netPayable: inr(b.net_payable || 0),
                amountReceived: inr(b.amount_received || 0),
                balance: inr(parseFloat(b.net_payable || 0) - parseFloat(b.amount_received || 0)),
                daysOld: daysOld,
                paymentStatus: b.status || 'pending',
              };
            })
          : [{ billNumber: '—', project: '—', billDate: '—', netPayable: '₹0', amountReceived: '₹0', balance: '₹0', daysOld: 0, paymentStatus: '—' }];
        const totalBilled = filteredBills.reduce((s,b) => s + parseFloat(b.net_payable || 0), 0);
        const totalReceived = filteredBills.reduce((s,b) => s + parseFloat(b.amount_received || 0), 0);
        const overdue = filteredBills.filter(b => b.status !== 'paid' && dayjs().diff(dayjs(b.bill_date || b.created_at), 'day') > 30).length;
        return {
          title: 'Payment Tracking Report',
          type: 'payment-tracking',
          data,
          summary: {
            'Total Billed': inr(totalBilled),
            'Total Received': inr(totalReceived),
            'Outstanding': inr(totalBilled - totalReceived),
            'Overdue (>30d)': overdue,
          },
        };
      }

      case 'project-progress': {
        const statusOrder = { active: 0, planning: 1, on_hold: 2, completed: 3 };
        const data = filteredProjects.length > 0
          ? [...filteredProjects]
            .sort((a,b) => (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9))
            .map(p => {
              const bills = filteredBills.filter(b => b.project_id === p.id);
              const certified = bills.filter(b => ['certified','paid'].includes(b.status));
              const contractVal = parseFloat(p.contract_value || 0);
              const certifiedAmt = certified.reduce((s,b) => s + parseFloat(b.net_payable || 0), 0);
              return {
                project: p.name,
                type: p.type || '—',
                status: (p.status || '').replace(/_/g,' '),
                contractValue: inr(contractVal),
                raBillsRaised: bills.length,
                certifiedAmount: inr(certifiedAmt),
                percentComplete: contractVal > 0 ? `${Math.min(100,((certifiedAmt/contractVal)*100)).toFixed(1)}%` : '0%',
                startDate: p.start_date ? dayjs(p.start_date).format('DD-MMM-YYYY') : '—',
              };
            })
          : [{ project: 'No Projects', type: '—', status: '—', contractValue: '₹0', raBillsRaised: 0, certifiedAmount: '₹0', percentComplete: '0%', startDate: '—' }];
        const active = filteredProjects.filter(p => p.status === 'active').length;
        const completed = filteredProjects.filter(p => p.status === 'completed').length;
        return {
          title: 'Project Progress Report',
          type: 'project-progress',
          data,
          summary: {
            'Total Projects': filteredProjects.length,
            'Active': active,
            'Completed': completed,
            'On Hold': filteredProjects.filter(p => p.status === 'on_hold').length,
          },
        };
      }

      case 'cost-analysis': {
        const data = filteredProjects.length > 0
          ? filteredProjects.map(p => {
              const bills = filteredBills.filter(b => b.project_id === p.id && ['certified','paid'].includes(b.status));
              const billed = bills.reduce((s,b) => s + parseFloat(b.net_payable || 0), 0);
              const deductions = bills.reduce((s,b) => s + parseFloat(b.deductions || 0), 0);
              const contractVal = parseFloat(p.contract_value || 0);
              const variance = billed - contractVal;
              return {
                project: p.name,
                contractValue: inr(contractVal),
                certifiedBilled: inr(billed),
                totalDeductions: inr(deductions),
                variance: inr(variance),
                variancePct: contractVal > 0 ? `${((variance / contractVal) * 100).toFixed(1)}%` : '0%',
              };
            })
          : [{ project: 'No Data', contractValue: '₹0', certifiedBilled: '₹0', totalDeductions: '₹0', variance: '₹0', variancePct: '0%' }];
        const totalContract = filteredProjects.reduce((s,p) => s + parseFloat(p.contract_value || 0), 0);
        const totalBilled2 = filteredBills.filter(b => ['certified','paid'].includes(b.status)).reduce((s,b) => s + parseFloat(b.net_payable || 0), 0);
        return {
          title: 'Cost Analysis Report',
          type: 'cost-analysis',
          data,
          summary: {
            'Total Contract': inr(totalContract),
            'Total Certified': inr(totalBilled2),
            'Variance': inr(totalBilled2 - totalContract),
            'Projects Analysed': filteredProjects.length,
          },
        };
      }

      case 'billing-performance': {
        const byProject = filteredProjects.map(p => {
          const bills = filteredBills.filter(b => b.project_id === p.id);
          const paid = bills.filter(b => b.status === 'paid');
          const pending = bills.filter(b => !['paid','rejected'].includes(b.status));
          const avgDays = paid.length > 0
            ? (paid.reduce((s,b) => s + dayjs(b.updated_at || b.created_at).diff(dayjs(b.bill_date || b.created_at), 'day'), 0) / paid.length).toFixed(0)
            : '—';
          return {
            project: p.name,
            totalBills: bills.length,
            paidBills: paid.length,
            pendingBills: pending.length,
            collectionRate: bills.length > 0 ? `${((paid.length / bills.length) * 100).toFixed(1)}%` : '0%',
            avgPaymentDays: avgDays,
            totalBilled: inr(bills.reduce((s,b) => s + parseFloat(b.net_payable || 0), 0)),
          };
        });
        const data = byProject.length > 0
          ? byProject
          : [{ project: 'No Data', totalBills: 0, paidBills: 0, pendingBills: 0, collectionRate: '0%', avgPaymentDays: '—', totalBilled: '₹0' }];
        const totalPaid = filteredBills.filter(b => b.status === 'paid').length;
        return {
          title: 'Billing Performance Report',
          type: 'billing-performance',
          data,
          summary: {
            'Total Bills': filteredBills.length,
            'Paid Bills': totalPaid,
            'Pending Bills': filteredBills.filter(b => !['paid','rejected'].includes(b.status)).length,
            'Collection Rate': filteredBills.length > 0 ? `${((totalPaid / filteredBills.length) * 100).toFixed(1)}%` : '0%',
          },
        };
      }

      case 'resource-utilization': {
        const data = filteredInventory.length > 0
          ? filteredInventory.map(item => ({
              material: item.material_name || '—',
              category: item.category || '—',
              unit: item.unit || '—',
              openingStock: parseFloat(item.opening_stock || 0).toFixed(2),
              received: parseFloat(item.received_qty || 0).toFixed(2),
              issued: parseFloat(item.issued_qty || 0).toFixed(2),
              closingStock: parseFloat(item.closing_stock || 0).toFixed(2),
              stockStatus: parseFloat(item.closing_stock || 0) < parseFloat(item.minimum_level || 0) ? 'LOW' : 'OK',
            }))
          : [{ material: 'No Data', category: '—', unit: '—', openingStock: '0', received: '0', issued: '0', closingStock: '0', stockStatus: '—' }];
        const lowStock = filteredInventory.filter(i => parseFloat(i.closing_stock || 0) < parseFloat(i.minimum_level || 0)).length;
        return {
          title: 'Resource Utilization Report',
          type: 'resource-utilization',
          data,
          summary: {
            'Total Materials': filteredInventory.length,
            'Low Stock Alerts': lowStock,
            'Categories': [...new Set(filteredInventory.map(i => i.category).filter(Boolean))].length,
            'Total Issued Qty': filteredInventory.reduce((s,i) => s + parseFloat(i.issued_qty || 0), 0).toFixed(0),
          },
        };
      }

      case 'ra-bill-summary': {
        const data = filteredBills.length > 0
          ? filteredBills.map(bill => ({
              billNumber: bill.bill_number || `RA-${bill.id}`,
              projectName: projects.find(p => p.id === bill.project_id)?.name || 'Unknown',
              billDate: dayjs(bill.bill_date || bill.created_at).format('DD-MMM-YYYY'),
              grossAmount: inr(bill.gross_amount || 0),
              deductions: inr(bill.deductions || 0),
              netPayable: inr(bill.net_payable || 0),
              status: bill.status || 'pending',
            }))
          : [{ billNumber: 'No Bills', projectName: 'No Data', billDate: '—', grossAmount: '₹0', deductions: '₹0', netPayable: '₹0', status: 'none' }];
        return {
          title: 'RA Bill Summary',
          type: 'ra-bill-summary',
          data,
          summary: {
            'Total Bills': filteredBills.length,
            'Total Gross': inr(filteredBills.reduce((s,b) => s + parseFloat(b.gross_amount || 0), 0)),
            'Total Net Payable': inr(filteredBills.reduce((s,b) => s + parseFloat(b.net_payable || 0), 0)),
            'Paid Bills': filteredBills.filter(b => b.status === 'paid').length,
          },
        };
      }

      default:
        return {
          title: reportTypes.find(r => r.id === reportId)?.name || 'Report',
          type: reportId,
          data: filteredProjects.slice(0, 5).map(p => ({
            project: p.name || 'Unknown',
            contractValue: `₹${parseFloat(p.contract_value || 0).toLocaleString('en-IN')}`,
            status: p.status || 'active',
          })),
          summary: { 'Total Projects': filteredProjects.length, 'Total Bills': filteredBills.length },
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
      const reportData = generateReportData(reportId);
      setGeneratedReport(reportData);
    } catch (err) {
      setError('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = (format = 'pdf') => {
    if (!generatedReport) { setError('Please generate a report first'); return; }
    if (format === 'pdf') {
      generatePDF();
    } else {
      const content = JSON.stringify(generatedReport, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedReport.title.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const generatePDF = () => {
    if (!generatedReport) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const now = dayjs().format('DD MMM YYYY, hh:mm A');

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 32, 80);
    doc.text('BCIM Engineering Pvt. Ltd.', 14, 16);
    doc.setFontSize(11);
    doc.setTextColor(59, 130, 246);
    doc.text(generatedReport.title, 14, 24);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${now}  |  QS Reports Module`, 14, 30);

    // Summary
    let y = 38;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 32, 80);
    doc.text('SUMMARY', 14, y);
    y += 4;
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

    // Data table
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

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pages}  |  BCIM ERP — QS Reports  |  Confidential`, 14, doc.internal.pageSize.height - 8);
    }

    doc.save(`${generatedReport.title.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.pdf`);
  };

  const formatCurrency = (val) => val > 1000000
    ? `₹${(val / 1000000).toFixed(2)}M`
    : val > 1000
      ? `₹${(val / 1000).toFixed(1)}K`
      : `₹${val.toLocaleString('en-IN')}`;

  const statsCards = [
    { label: 'Total Reports', value: reportTypes.length, icon: FileText, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'QS Reports', value: reportTypes.filter(r => r.category === 'QS').length, icon: Package, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Billing Reports', value: reportTypes.filter(r => r.category === 'Billing').length, icon: DollarSign, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Active Projects', value: projects.length, icon: Building2, color: '#f59e0b', bg: '#fffbeb' },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#f8fafc', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div style={{ width: 36, height: 36, background: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>QS Reports</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Generate and export quantity surveying reports</p>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statsCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div style={{ width: 42, height: 42, background: s.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 24 }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#334155', outline: 'none', background: '#f8fafc' }}
            />
          </div>
          {/* Date Range */}
          <div style={{ position: 'relative' }}>
            <Calendar size={15} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#334155', appearance: 'none', background: '#f8fafc', outline: 'none' }}
            >
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
            <Building2 size={15} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#334155', appearance: 'none', background: '#f8fafc', outline: 'none' }}
            >
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={13} color="#94a3b8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: activeCategory === cat ? '#3b82f6' : '#f1f5f9',
                  color: activeCategory === cat ? 'white' : '#64748b',
                }}
              >{cat}</button>
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
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</span>
            </div>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={15} color="#ef4444" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Report Cards Grid ── */}
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
                background: 'white',
                borderRadius: 16,
                border: isActive ? `1.5px solid ${report.accent}` : '1px solid #e2e8f0',
                overflow: 'hidden',
                transition: 'border 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Top accent bar */}
              <div style={{ height: 4, background: report.accent }} />

              <div style={{ padding: '20px 20px 18px' }}>
                {/* Icon + category */}
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

                {/* Generate button */}
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
                    <>
                      <Eye size={14} />
                      Generate Report
                    </>
                  )}
                </button>

                {/* Download row */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {['PDF', 'Excel'].map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => {
                        if (!generatedReport || generatedReport.type !== report.id) {
                          setError(`Please generate the "${report.name}" report first`);
                        } else {
                          handleDownloadReport(fmt.toLowerCase());
                        }
                      }}
                      style={{ flex: 1, padding: '8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', fontSize: 12, fontWeight: 500, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <Download size={12} />{fmt}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (!generatedReport || generatedReport.type !== report.id) {
                        setError(`Please generate the "${report.name}" report first`);
                      } else {
                        generatePDF();
                      }
                    }}
                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
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
          <motion.div
            key="report-output"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 24 }}
          >
            {/* Report header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={18} color="#10b981" />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{generatedReport.title}</h2>
                  <p style={{ fontSize: 12, color: '#64748b' }}>Generated {new Date().toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleDownloadReport('pdf')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  onClick={() => handleDownloadReport('excel')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Download size={14} /> Excel
                </button>
                <button
                  onClick={() => setGeneratedReport(null)}
                  style={{ padding: '9px 12px', background: '#f1f5f9', border: 'none', borderRadius: 9, cursor: 'pointer' }}
                >
                  <X size={15} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Summary</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(generatedReport.summary).map(([key, value]) => (
                  <div key={key} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                      {typeof value === 'number' && value > 1000000
                        ? formatCurrency(value)
                        : typeof value === 'number'
                          ? value.toLocaleString('en-IN')
                          : value}
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
                            {typeof val === 'number' && val > 1000000
                              ? formatCurrency(val)
                              : typeof val === 'number'
                                ? val.toLocaleString('en-IN')
                                : val}
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
          <motion.div
            key="empty-state"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'white', borderRadius: 16, border: '1.5px dashed #e2e8f0', padding: '32px 24px', textAlign: 'center', marginBottom: 24 }}
          >
            <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Zap size={22} color="#94a3b8" />
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

export default ReportsPage;
