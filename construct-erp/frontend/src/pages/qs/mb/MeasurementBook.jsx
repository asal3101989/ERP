// MeasurementBook.jsx — Root Orchestrator
// Wires MBCover, MBMeasurementDetail, MBAbstract to live API data.
// Also exports MeasurementBookPage for URL-param driven routing.

import React, { useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { FileText, Ruler, Table2, ChevronLeft, Send, Loader2, AlertCircle, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

import { projectAPI, boqAPI, measurementAPI, raBillAPI, variationAPI } from '../../../api/client';
import MBCover              from './MBCover';
import MBMeasurementDetail  from './MBMeasurementDetail';
import MBAbstract           from './MBAbstract';
import MBPrintDocument      from './MBPrintDocument';

// ── helpers ──────────────────────────────────────────────────────────────────

const num = (v) => parseFloat(v || 0);

// ── STATUS BADGE ─────────────────────────────────────────────────────────────

const STATUSES = ['Draft', 'QS Review', 'Client Submitted', 'Certified', 'Paid'];

function StatusBar({ current, onChange }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {STATUSES.map((s, i) => {
        const idx  = STATUSES.indexOf(current);
        const done = i < idx;
        const active = s === current;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={[
              'px-3 py-1.5 text-xs font-semibold whitespace-nowrap border-y border-r first:border-l first:rounded-l-lg last:rounded-r-lg transition-colors',
              active ? 'bg-blue-600 text-white border-blue-600' :
              done   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                       'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            {i + 1}. {s}
          </button>
        );
      })}
    </div>
  );
}

// ── TAB SHELL ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'cover',        label: 'Cover Sheet',  Icon: FileText },
  { key: 'measurements', label: 'Measurements', Icon: Ruler    },
  { key: 'abstract',     label: 'Abstract',     Icon: Table2   },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function MeasurementBook({
  project_id,
  ra_bill_id,
  onClose,
  onBillCreated,
}) {
  const navigate = useNavigate();

  // ── Tab & status state ───────────────────────────────────────────────────
  const [activeTab,  setActiveTab]  = useState('cover');
  const [mbStatus,   setMbStatus]   = useState('Draft');

  // ── Cover data ───────────────────────────────────────────────────────────
  const [coverData, setCoverData] = useState({
    ra_bill_no:       '',
    invoice_ref:      '',
    bill_period_from: '',
    bill_period_to:   '',
    date_of_invoice:  dayjs().format('YYYY-MM-DD'),
    package_desc:     '',
    prepared_by:      '',
    checked_by:       '',
    approved_by:      '',
  });

  // ── Deductions (from MBAbstract) ────────────────────────────────────────
  const [deductions, setDeductions] = useState({
    retentionPct:   5,
    mobAdvance:     0,
    steelRecovery:  0,
    adhocDeduction: 0,
  });

  // Abstract rows captured via ref (avoid re-render loop)
  const abstractRowsRef = useRef([]);
  const abstractSummaryRef = useRef({});

  // Print ref
  const printRef = useRef(null);

  const handleAbstractComputed = useCallback((rows) => {
    abstractRowsRef.current = rows;
  }, []);

  const handleDeductionsChange = useCallback((vals) => {
    abstractSummaryRef.current = vals;
  }, []);

  // ── API Queries ─────────────────────────────────────────────────────────
  const {
    data: project,
    isLoading: loadingProject,
    isError: errorProject,
  } = useQuery({
    queryKey:  ['project', project_id],
    queryFn:   () => projectAPI.get(project_id).then(r => r.data?.data || r.data),
    enabled:   !!project_id,
    staleTime: 60_000,
  });

  const {
    data: boqItems = [],
    isLoading: loadingBOQ,
  } = useQuery({
    queryKey:  ['boq-summary', project_id],
    queryFn:   () => boqAPI.summary(project_id).then(r => {
      const d = r.data?.data || r.data || [];
      return Array.isArray(d) ? d : [];
    }),
    enabled:   !!project_id,
    staleTime: 60_000,
  });

  const {
    data: measurements = [],
    isLoading: loadingMeasurements,
  } = useQuery({
    queryKey:  ['measurements-approved', project_id],
    queryFn:   () => measurementAPI.list({ project_id, status: 'pm_approved' }).then(r => {
      const d = r.data?.data || r.data || [];
      return Array.isArray(d) ? d : [];
    }),
    enabled:   !!project_id,
    staleTime: 30_000,
  });

  const {
    data: voItems = [],
    isLoading: loadingVO,
  } = useQuery({
    queryKey:  ['variation-approved-items', project_id],
    queryFn:   () => variationAPI.approvedItems({ project_id }).then(r => {
      const d = r.data?.data || r.data || [];
      return Array.isArray(d) ? d : [];
    }),
    enabled:   !!project_id,
    staleTime: 60_000,
  });

  // ── Submit mutation ──────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: (payload) => raBillAPI.create(payload),
    onSuccess: (res) => {
      const id = res.data?.data?.id || res.data?.id;
      toast.success('RA Bill created successfully!');
      onBillCreated?.(id);
      if (id) navigate(`/qs/ra-bills/${id}`);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create RA Bill');
    },
  });

  const handleSubmit = () => {
    if (!coverData.ra_bill_no?.trim()) {
      toast.error('RA Bill No. is required on the Cover Sheet');
      setActiveTab('cover');
      return;
    }

    const rows  = abstractRowsRef.current;
    const sumry = abstractSummaryRef.current;
    const grossAmount = rows.reduce((s, r) => s + (num(r.present_qty) * num(r.rate)), 0);

    const payload = {
      project_id,
      bill_number:  coverData.ra_bill_no,
      bill_date:    coverData.date_of_invoice || dayjs().format('YYYY-MM-DD'),
      invoice_ref:  coverData.invoice_ref,
      package_desc: coverData.package_desc,
      bill_period_from: coverData.bill_period_from,
      bill_period_to:   coverData.bill_period_to,
      prepared_by:  coverData.prepared_by,
      checked_by:   coverData.checked_by,
      approved_by:  coverData.approved_by,
      gst_rate:     18,
      retention_percent:            deductions.retentionPct,
      mobilization_advance_recovery: num(deductions.mobAdvance),
      material_recovery_steel:       num(deductions.steelRecovery),
      other_deductions:              num(deductions.adhocDeduction),
      gross_amount:  grossAmount,
      net_certified: sumry.netCertified || 0,
      status:        'submitted',
      items: rows
        .filter(r => num(r.present_qty) > 0)
        .map(r => ({
          boq_item_id:       r.id,
          unit:              r.unit,
          rate:              num(r.rate),
          prev_certified_qty: num(r.prev_qty),
          current_qty:       num(r.present_qty),
          amount:            num(r.present_qty) * num(r.rate),
        })),
    };

    submitMutation.mutate(payload);
  };

  // ── Print / Download PDF (must be after project query so project is in scope) ──
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `MB_${coverData.ra_bill_no || 'Draft'}_${project?.name || 'Project'}`,
    onBeforePrint: () => {
      if (!coverData.ra_bill_no) toast('Tip: Fill RA Bill No. on the Cover Sheet before printing', { icon: '📋' });
      return Promise.resolve();
    },
  });

  // ── Loading / Error states ───────────────────────────────────────────────
  const isLoading = loadingProject || loadingBOQ || loadingMeasurements || loadingVO;

  if (!project_id) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <AlertCircle className="w-5 h-5 mr-2" />
        No project selected. Please open from a project context.
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-[#1F3864] text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <p className="text-[10px] tracking-widest text-blue-300 uppercase">Measurement Book</p>
            <h1 className="text-lg font-bold leading-tight">
              {project?.name || 'Loading…'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBar current={mbStatus} onChange={setMbStatus} />

          {/* Print */}
          <button
            onClick={handlePrint}
            disabled={isLoading}
            title="Print Measurement Book"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-white/20"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          {/* Download PDF (same as print — browser handles Save as PDF) */}
          <button
            onClick={handlePrint}
            disabled={isLoading}
            title="Download as PDF"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-white/20"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>

          {/* Create Bill */}
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || isLoading}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {submitMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
            Create RA Bill
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={[
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading measurement book data…
        </div>
      ) : errorProject ? (
        <div className="flex-1 flex items-center justify-center text-red-500 gap-2">
          <AlertCircle className="w-5 h-5" />
          Failed to load project. Please check the project ID.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {activeTab === 'cover' && (
            <MBCover
              data={coverData}
              onChange={setCoverData}
              project={project || {}}
            />
          )}

          {activeTab === 'measurements' && (
            <MBMeasurementDetail
              boqItems={boqItems}
              measurements={measurements}
            />
          )}

          {activeTab === 'abstract' && (
            <MBAbstract
              projectMeta={{
                workOrderNo: project?.work_order_number || '—',
                raBillNo:    coverData.ra_bill_no || '—',
                projectName: project?.name || '—',
              }}
              boqItems={boqItems}
              measurements={measurements}
              voItems={voItems}
              initialDeductions={deductions}
              onAbstractComputed={handleAbstractComputed}
              onDeductionsChange={handleDeductionsChange}
            />
          )}
        </div>
      )}
      {/* Hidden print document — rendered off-screen, captured by react-to-print */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '297mm' }}>
        <MBPrintDocument
          ref={printRef}
          cover={coverData}
          project={project || {}}
          boqItems={boqItems}
          measurements={measurements}
          voItems={voItems}
          deductions={deductions}
        />
      </div>
    </div>
  );
}

// ── URL-param wrapper ────────────────────────────────────────────────────────

export function MeasurementBookPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  const project_id = searchParams.get('project_id') || '';
  const ra_bill_id = searchParams.get('ra_bill_id') || '';

  return (
    <MeasurementBook
      project_id={project_id}
      ra_bill_id={ra_bill_id}
      onClose={() => navigate(-1)}
      onBillCreated={(id) => id && navigate(`/qs/ra-bills/${id}`)}
    />
  );
}
