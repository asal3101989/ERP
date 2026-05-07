import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dqsBillsAPI, projectAPI } from '../../api/client';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import SignaturePadModal from '../../components/common/SignaturePadModal';
import {
  ArrowLeft, FileText, Warehouse, ClipboardCheck, CreditCard,
  Upload, Trash2, ExternalLink, Clock, CheckCircle2, AlertCircle,
  IndianRupee, X, Download, Printer, ListOrdered, Award, PenLine, RefreshCw,
  Inbox,
  Cloud, CloudOff
} from 'lucide-react';

const inr = (v) => Math.round(Number(v || 0)).toLocaleString('en-IN');
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

const STATUS_COLORS = {
  pending:  'bg-amber-100 text-amber-700',
  stores:   'bg-blue-100 text-blue-700',
  document_controller: 'bg-cyan-100 text-cyan-700',
  qs:       'bg-indigo-100 text-indigo-700',
  procurement: 'bg-orange-100 text-orange-700',
  accounts: 'bg-purple-100 text-purple-700',
  paid:     'bg-emerald-100 text-emerald-700',
};

const TABS = [
  { id: 'overview',  label: 'Overview',       icon: FileText },
  { id: 'stores',    label: 'Stores',          icon: Warehouse },
  { id: 'doc_control', label: 'Document Controller', icon: Inbox },
  { id: 'qs',        label: 'QS Certification',icon: ClipboardCheck },
  { id: 'accounts',  label: 'Accounts',        icon: CreditCard },
  { id: 'procurement', label: 'Procurement',   icon: Inbox },
  { id: 'payment',   label: 'Payment',          icon: IndianRupee },
];

const DEPT_TAB_MAP = [
  { match: ['store'], tabs: ['stores'] },
  { match: ['document controller', 'document', 'controller', 'doc'], tabs: ['doc_control'] },
  { match: ['qs'], tabs: ['qs'] },
  { match: ['account', 'finance'], tabs: ['accounts', 'payment'] },
  { match: ['procure', 'purchase'], tabs: ['procurement'] },
];

function getVisibleTabsForDepartment(department, role) {
  const normalizedDept = String(department || '').toLowerCase();
  if (['super_admin', 'admin'].includes(role)) return TABS;

  for (const rule of DEPT_TAB_MAP) {
    if (rule.match.some(token => normalizedDept.includes(token))) {
      return TABS.filter(tab => tab.id === 'overview' || rule.tabs.includes(tab.id));
    }
  }

  return TABS.filter(tab => tab.id === 'overview');
}

function Field({ label, value }) {
  return (
    <div>
      <span className="block text-xs text-slate-500 font-medium mb-0.5">{label}</span>
      <span className="text-sm text-slate-800">{value || '—'}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{children}</p>;
}

/* ─── Overview Tab ─── */
function OverviewTab({ bill }) {
  const items = bill.line_items || [];
  const upd = bill.bill_updates || {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Basic Amount', value: `₹${inr(bill.basic_amount)}` },
          { label: 'GST Amount',   value: `₹${inr(bill.gst_amount)}` },
          { label: 'Transport',    value: `₹${inr(bill.transport_charges)}` },
          { label: 'Total Invoice',value: `₹${inr(bill.total_amount)}` },
        ].map(c => (
          <div key={c.label} className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium">{c.label}</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="CGST" value={bill.cgst_pct ? `${bill.cgst_pct}% = ₹${inr(bill.cgst_amt)}` : null} />
        <Field label="SGST" value={bill.sgst_pct ? `${bill.sgst_pct}% = ₹${inr(bill.sgst_amt)}` : null} />
        <Field label="IGST" value={bill.igst_pct ? `${bill.igst_pct}% = ₹${inr(bill.igst_amt)}` : null} />
        <Field label="Other Charges" value={bill.other_charges ? `₹${inr(bill.other_charges)}` : null} />
        <Field label="Bill Type" value={bill.bill_type === 'wo' ? 'Work Order' : 'Purchase Order'} />
        <Field label="Invoice Month" value={bill.inv_month} />
        <Field label="Sent to HO" value={fmt(upd.sent_to_ho_date)} />
        <Field label="HO Received" value={fmt(upd.ho_received_date)} />
        <Field label="Handed to QS" value={fmt(upd.handed_over_qs_date)} />
        <Field label="Handed to Accounts" value={fmt(upd.handed_over_accounts_date)} />
        <Field label="Accounts Received from QS" value={fmt(upd.accts_received_from_qs_date)} />
        <Field label="Proc. Received from Accounts" value={fmt(upd.proc_received_from_accounts_date)} />
        <Field label="Proc. Handed over to Accounts" value={fmt(upd.proc_handed_over_to_accounts_date)} />
      </div>

      {items.length > 0 && (
        <div>
          <SectionTitle>Line Items</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Description', 'Unit', 'Qty', 'Rate (₹)', 'GST%', 'Total (₹)'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((it, i) => (
                  <tr key={it.id || i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 text-slate-700">{it.item_name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{it.unit}</td>
                    <td className="px-4 py-2.5 text-slate-700">{it.quantity}</td>
                    <td className="px-4 py-2.5 text-slate-700">₹{inr(it.rate)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{it.gst_pct}%</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">₹{inr(it.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Stores Tab ─── */
function StoresTab({ bill, billId }) {
  const qc = useQueryClient();
  const upd = bill.bill_updates || {};
  const [form, setForm] = useState({
    store_recv_date: upd.store_recv_date?.slice(0, 10) || '',
    dc_number: upd.dc_number || '',
    vehicle_number: upd.vehicle_number || '',
    inspection_status: upd.inspection_status || 'pending',
    received_by: upd.received_by || '',
    sent_to_ho_date: upd.sent_to_ho_date?.slice(0, 10) || '',
    store_remarks: upd.store_remarks || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.updateStores(billId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dqs-bill', billId] }); toast.success('Stores updated'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-5">
      <SectionTitle>Store Receipt Details</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Received Date', key: 'store_recv_date', type: 'date' },
            { label: 'DC Number', key: 'dc_number' },
            { label: 'Vehicle Number', key: 'vehicle_number' },
            { label: 'Received By', key: 'received_by' },
            { label: 'Sent to HO Date', key: 'sent_to_ho_date', type: 'date' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
            <input
              type={f.type || 'text'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={form[f.key]} onChange={e => set(f.key, e.target.value)}
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Inspection Status</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            value={form.inspection_status} onChange={e => set('inspection_status', e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
          <textarea
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
          value={form.store_remarks} onChange={e => set('store_remarks', e.target.value)}
        />
      </div>
      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving…' : 'Save & Send to Document Controller'}
      </button>
    </div>
  );
}

/* ─── Document Controller Tab ─── */
function DocumentControlTab({ bill, billId }) {
  const qc = useQueryClient();
  const upd = bill.bill_updates || {};
  const [form, setForm] = useState({
    ho_received_date: upd.ho_received_date?.slice(0, 10) || '',
    handed_over_qs_date: upd.handed_over_qs_date?.slice(0, 10) || '',
    document_controller_remarks: upd.document_controller_remarks || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.updateDocumentControl(billId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dqs-bill', billId] }); toast.success('Document Controller updated'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-5">
      <SectionTitle>Head Office Document Control</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Date Received at HO', key: 'ho_received_date', type: 'date' },
          { label: 'Date Handed Over to QS', key: 'handed_over_qs_date', type: 'date' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
            <input
              type={f.type || 'text'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
        <textarea
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
          value={form.document_controller_remarks}
          onChange={e => set('document_controller_remarks', e.target.value)}
        />
      </div>
      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving…' : 'Save & Send to QS'}
      </button>
    </div>
  );
}

/* ─── Signature Box (top-level so React Fast Refresh can track it) ─── */
function SigBox({ stage, label, role, upd, pcReady, isPending, onSign }) {
  const sigImg   = upd[`pc_${stage}_sig_img`];
  const signedBy = upd[`pc_${stage}_signed_by`];
  const signedAt = upd[`pc_${stage}_signed_at`];
  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center gap-2 min-h-[120px]">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-[10px] text-slate-400">{role}</p>
      {sigImg ? (
        <>
          <img src={sigImg} alt="signature" className="h-14 object-contain border border-slate-100 rounded" />
          <p className="text-[9px] text-emerald-600 font-semibold">
            {signedBy} · {signedAt ? new Date(signedAt).toLocaleDateString('en-IN') : ''}
          </p>
        </>
      ) : (
        <button
          onClick={() => onSign(stage)}
          disabled={!pcReady || isPending}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg disabled:opacity-40 transition"
        >
          <PenLine className="w-3.5 h-3.5" /> Sign
        </button>
      )}
    </div>
  );
}

/* ─── QS Certification Tab ─── */
function QSTab({ bill, billId }) {
  const qc  = useQueryClient();
  const upd = bill.bill_updates || {};

  // ── Certification form state ─────────────────────────────────────────────
  const [form, setForm] = useState({
    qs_received_date:  upd.qs_received_date?.slice(0, 10)  || upd.handed_over_qs_date?.slice(0, 10) || '',
    qs_certified_date: upd.qs_certified_date?.slice(0, 10) || '',
    handed_over_accounts_date: upd.handed_over_accounts_date?.slice(0, 10) || '',
    qs_gross:          upd.qs_gross          || '',
    qs_tax:            upd.qs_tax            || '',
    advance_recovered: upd.advance_recovered || '0',
    credit_note_amt:   upd.credit_note_amt   || '0',
    retention_money:   upd.retention_money   || '0',
    tds_deduction:     upd.tds_deduction     || '0',
    other_deductions:  upd.other_deductions  || '0',
    qs_remarks:        upd.qs_remarks        || '',
    // RA fields
    ra_sequence:    upd.ra_sequence    || 1,
    ra_bill_number: upd.ra_bill_number || '',
    is_final_bill:  upd.is_final_bill  || false,
    qs_summary_template: Array.isArray(upd.qs_summary_template) ? upd.qs_summary_template : [],
    qs_ra_items: Array.isArray(upd.qs_ra_items) ? upd.qs_ra_items : [],
    cgst_pct: upd.ra_cgst_pct ?? (bill.cgst_pct ?? 9),
    sgst_pct: upd.ra_sgst_pct ?? (bill.sgst_pct ?? 9),
    igst_pct: upd.ra_igst_pct ?? (bill.igst_pct ?? 0),
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const summaryTotal = form.qs_summary_template.reduce((s, row) => s + (parseFloat(row.amount) || 0), 0);

  // RA items helpers
  const raItemsGross = form.qs_ra_items.reduce((s, r) => s + (parseFloat(r.qs_pres_qty)||0)*(parseFloat(r.po_rate)||0), 0);
  const addRAItem = () => set('qs_ra_items', [...form.qs_ra_items, { description:'', unit:'', po_qty:'', po_rate:'', inv_prev_qty:'', inv_pres_qty:'', qs_prev_qty:'', qs_pres_qty:'', weighment:'', msb:'', ign:'', grs:'', remarks:'' }]);
  const updateRAItem = (i, field, val) => { const arr=[...form.qs_ra_items]; arr[i]={...arr[i],[field]:val}; set('qs_ra_items',arr); if(field==='qs_pres_qty'||field==='po_rate'){ const total=arr.reduce((s,r)=>s+(parseFloat(r.qs_pres_qty)||0)*(parseFloat(r.po_rate)||0),0); set('qs_gross',total.toFixed(2)); } };
  const removeRAItem = (i) => { const arr=form.qs_ra_items.filter((_,idx)=>idx!==i); set('qs_ra_items',arr); set('qs_gross',arr.reduce((s,r)=>s+(parseFloat(r.qs_pres_qty)||0)*(parseFloat(r.po_rate)||0),0).toFixed(2)); };

  // GST auto-calc
  const raCgstAmt  = (parseFloat(form.qs_gross)||0) * (parseFloat(form.cgst_pct)||0) / 100;
  const raSgstAmt  = (parseFloat(form.qs_gross)||0) * (parseFloat(form.sgst_pct)||0) / 100;
  const raIgstAmt  = (parseFloat(form.qs_gross)||0) * (parseFloat(form.igst_pct)||0) / 100;
  const raTaxTotal = raCgstAmt + raSgstAmt + raIgstAmt;
  const handleGstRateChange = (field, val) => {
    const gross = parseFloat(form.qs_gross) || 0;
    const c = field==='cgst_pct' ? parseFloat(val)||0 : parseFloat(form.cgst_pct)||0;
    const s = field==='sgst_pct' ? parseFloat(val)||0 : parseFloat(form.sgst_pct)||0;
    const ig = field==='igst_pct' ? parseFloat(val)||0 : parseFloat(form.igst_pct)||0;
    const tax = (gross*c/100 + gross*s/100 + gross*ig/100).toFixed(2);
    setForm(p => ({ ...p, [field]: val, qs_tax: tax }));
  };

  const qsTotal     = (parseFloat(form.qs_gross) || 0) + (parseFloat(form.qs_tax) || 0);
  const totalDed    = ['advance_recovered','credit_note_amt','retention_money','tds_deduction','other_deductions']
                        .reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
  const certifiedNet = qsTotal - totalDed;

  // ── RA Summary query ─────────────────────────────────────────────────────
  const { data: raSummaryData } = useQuery({
    queryKey: ['dqs-ra-summary', billId],
    queryFn:  () => dqsBillsAPI.getRASummary(billId).then(r => r.data?.data ?? r.data),
    enabled: !!billId,
  });
  const raSummary = raSummaryData || {};
  const prevTotal  = parseFloat(raSummary.previous_certified_total || 0);
  const cumulative = prevTotal + certifiedNet;

  // Auto-fill suggested RA sequence if not yet set
  const suggestedSeq = raSummary.suggested_ra_sequence || 1;

  // ── Signature pad state ──────────────────────────────────────────────────
  const [sigModal, setSigModal] = useState(null); // 'qs' | 'pm' | 'accts' | null
  const [showRA, setShowRA]     = useState(true);

  // ── Mutations ────────────────────────────────────────────────────────────
  const qsMutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.updateQS(billId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dqs-bill', billId] });
      qc.invalidateQueries({ queryKey: ['dqs-ra-summary', billId] });
      toast.success('QS certification saved');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const genPCMutation = useMutation({
    mutationFn: () => dqsBillsAPI.generatePaymentCert(billId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dqs-bill', billId] }); toast.success('Payment Certificate generated!'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const signMutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.signPaymentCert(billId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dqs-bill', billId] }); toast.success('Signature saved'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const handleSign = (stage, imgData) => {
    signMutation.mutate({ stage, sig_img: imgData, signed_by: bill.created_by_name || 'User' });
  };

  const pcReady = !!upd.pc_number;

  return (
    <div className="space-y-5">
      {/* ── RA Bill Summary panel ─────────────────────────────────────── */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRA(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">RA Bill Summary</span>
            {raSummary.po_number && (
              <span className="text-[10px] text-indigo-400 font-mono">{raSummary.po_number}</span>
            )}
          </div>
          <span className="text-xs text-indigo-400">{showRA ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {showRA && (
          <div className="px-4 pb-4 space-y-3">
            {/* Previous bills table */}
            {(raSummary.previous_bills || []).length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-indigo-100">
                <table className="w-full text-xs">
                  <thead className="bg-indigo-100/60">
                    <tr>
                      {['RA #','SL No','Invoice #','Certified Net (₹)','Cumulative (₹)','Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50">
                    {(raSummary.previous_bills || []).map((r, i) => (
                      <tr key={r.id || i} className="hover:bg-indigo-50/40">
                        <td className="px-3 py-2 font-semibold text-indigo-700">{r.ra_bill_number || `RA-${r.ra_sequence || i+1}`}</td>
                        <td className="px-3 py-2 text-slate-600">{r.sl_number}</td>
                        <td className="px-3 py-2 text-slate-500">{r.inv_number}</td>
                        <td className="px-3 py-2 font-semibold text-slate-700">₹{inr(r.certified_net)}</td>
                        <td className="px-3 py-2 text-slate-600">₹{inr(r.cumulative_certified_amount)}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold uppercase">{r.workflow_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-indigo-400 italic">No previous certified bills for this vendor + PO. This will be RA-1.</p>
            )}

            {/* RA fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-indigo-600 uppercase mb-1">RA Sequence #</label>
                <input
                  type="number" min="1"
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                  value={form.ra_sequence}
                  onChange={e => set('ra_sequence', parseInt(e.target.value) || suggestedSeq)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-indigo-600 uppercase mb-1">RA Bill Number</label>
                <input
                  type="text"
                  placeholder={`RA-${form.ra_sequence}`}
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                  value={form.ra_bill_number}
                  onChange={e => set('ra_bill_number', e.target.value)}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-indigo-300 text-indigo-600 accent-indigo-600"
                    checked={form.is_final_bill}
                    onChange={e => set('is_final_bill', e.target.checked)}
                  />
                  <span className="text-xs font-medium text-indigo-700">Final Bill</span>
                </label>
              </div>
            </div>

            {/* Running totals strip */}
            <div className="grid grid-cols-3 gap-3 bg-white rounded-lg border border-indigo-100 p-3">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Previous Certified</p>
                <p className="text-base font-bold text-slate-600 mt-0.5">₹{inr(prevTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">This Bill Net</p>
                <p className="text-base font-bold text-indigo-700 mt-0.5">₹{inr(certifiedNet)}</p>
              </div>
              <div className="text-center border-l border-indigo-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Cumulative Total</p>
                <p className="text-lg font-black text-emerald-600 mt-0.5">₹{inr(cumulative)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Summary Template ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <SectionTitle>QS Summary Template (Optional)</SectionTitle>
          <button
            onClick={() => set('qs_summary_template', [...form.qs_summary_template, { description: '', amount: '' }])}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            + Add Row
          </button>
        </div>
        {form.qs_summary_template.length > 0 && (
          <div className="p-4 space-y-3">
            {form.qs_summary_template.map((row, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Item Description (e.g. Earthwork, Concrete)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={row.description}
                    onChange={e => {
                      const newArr = [...form.qs_summary_template];
                      newArr[i].description = e.target.value;
                      set('qs_summary_template', newArr);
                    }}
                  />
                </div>
                <div className="w-1/3">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount (₹)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={row.amount}
                    onChange={e => {
                      const newArr = [...form.qs_summary_template];
                      newArr[i].amount = e.target.value;
                      set('qs_summary_template', newArr);
                      
                      // Auto-update gross if user desires
                      const newTotal = newArr.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                      set('qs_gross', newTotal);
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    const newArr = form.qs_summary_template.filter((_, idx) => idx !== i);
                    set('qs_summary_template', newArr);
                    set('qs_gross', newArr.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));
                  }}
                  className="mt-2 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="text-right text-xs font-bold text-slate-600 mt-2">
              Summary Total: ₹{inr(summaryTotal)}
            </div>
          </div>
        )}
      </div>

      {/* ── RA Bill Line Items ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">RA Bill Item Quantities</span>
            {form.qs_ra_items.length > 0 && <span className="text-[10px] text-indigo-500">QS Gross Auto-calculated: ₹{inr(raItemsGross)}</span>}
          </div>
          <button onClick={addRAItem} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">+ Add Item</button>
        </div>
        {form.qs_ra_items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['Description','Unit','PO Qty','PO Rate','Inv Prev Qty','Inv Pres Qty','QS Prev Qty','QS Pres Qty','Weighment','MSB','IGN','GRS','Remarks',''].map(h=>(
                    <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {form.qs_ra_items.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-1 py-1"><input className="w-36 border border-slate-200 rounded px-2 py-1 text-xs" placeholder="Description" value={row.description} onChange={e=>updateRAItem(i,'description',e.target.value)} /></td>
                    <td className="px-1 py-1"><input className="w-14 border border-slate-200 rounded px-2 py-1 text-xs" placeholder="MT" value={row.unit} onChange={e=>updateRAItem(i,'unit',e.target.value)} /></td>
                    <td className="px-1 py-1"><input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-xs" placeholder="0" value={row.po_qty} onChange={e=>updateRAItem(i,'po_qty',e.target.value)} /></td>
                    <td className="px-1 py-1"><input type="number" className="w-20 border border-slate-200 rounded px-2 py-1 text-xs" placeholder="0.00" value={row.po_rate} onChange={e=>updateRAItem(i,'po_rate',e.target.value)} /></td>
                    <td className="px-1 py-1"><input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-yellow-50" placeholder="0" value={row.inv_prev_qty} onChange={e=>updateRAItem(i,'inv_prev_qty',e.target.value)} /></td>
                    <td className="px-1 py-1"><input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-yellow-50" placeholder="0" value={row.inv_pres_qty} onChange={e=>updateRAItem(i,'inv_pres_qty',e.target.value)} /></td>
                    <td className="px-1 py-1"><input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-purple-50" placeholder="0" value={row.qs_prev_qty} onChange={e=>updateRAItem(i,'qs_prev_qty',e.target.value)} /></td>
                    <td className="px-1 py-1"><input type="number" className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-purple-50 font-semibold" placeholder="0" value={row.qs_pres_qty} onChange={e=>updateRAItem(i,'qs_pres_qty',e.target.value)} /></td>
                    <td className="px-1 py-1"><input className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-blue-50" placeholder="0" value={row.weighment||''} onChange={e=>updateRAItem(i,'weighment',e.target.value)} /></td>
                    <td className="px-1 py-1"><input className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-blue-50" placeholder="0" value={row.msb||''} onChange={e=>updateRAItem(i,'msb',e.target.value)} /></td>
                    <td className="px-1 py-1"><input className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-blue-50" placeholder="0" value={row.ign||''} onChange={e=>updateRAItem(i,'ign',e.target.value)} /></td>
                    <td className="px-1 py-1"><input className="w-16 border border-slate-200 rounded px-2 py-1 text-xs bg-blue-50" placeholder="0" value={row.grs||''} onChange={e=>updateRAItem(i,'grs',e.target.value)} /></td>
                    <td className="px-1 py-1"><input className="w-24 border border-slate-200 rounded px-2 py-1 text-xs" placeholder="Remarks" value={row.remarks||''} onChange={e=>updateRAItem(i,'remarks',e.target.value)} /></td>
                    <td className="px-1 py-1"><button onClick={()=>removeRAItem(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GST Rates — matches Excel rows CGST/SGST/IGST */}
        <div className="border-t border-slate-100 bg-amber-50/60 px-4 py-3">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-3">GST on QS Certified Amount (Auto-fills Tax field below)</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'CGST %', key: 'cgst_pct', amt: raCgstAmt },
              { label: 'SGST %', key: 'sgst_pct', amt: raSgstAmt },
              { label: 'IGST %', key: 'igst_pct', amt: raIgstAmt },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] font-semibold text-amber-700 mb-1">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.01" min="0" max="28"
                    className="w-20 border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-none"
                    value={form[f.key]}
                    onChange={e => handleGstRateChange(f.key, e.target.value)}
                  />
                  <span className="text-xs text-slate-500">= <strong className="text-amber-800">₹{inr(f.amt)}</strong></span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-amber-200 flex justify-between items-center">
            <span className="text-xs font-semibold text-amber-800">Total GST (QS Tax Amount)</span>
            <span className="text-sm font-bold text-amber-900">₹{inr(raTaxTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Certification form ──────────────────────────────────────────── */}
      <SectionTitle>QS Certification</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">QS Received Date</label>
          <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={form.qs_received_date} onChange={e => set('qs_received_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Certified Date</label>
          <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={form.qs_certified_date} onChange={e => set('qs_certified_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Handed Over to Accounts</label>
          <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={form.handed_over_accounts_date} onChange={e => set('handed_over_accounts_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">QS Gross Amount (₹)</label>
          <input type="number" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={form.qs_gross} onChange={e => set('qs_gross', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">QS Tax Amount (₹)</label>
          <input type="number" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={form.qs_tax} onChange={e => set('qs_tax', e.target.value)} />
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Deductions</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Advance Recovery (₹)', key: 'advance_recovered' },
            { label: 'Credit Note (₹)',       key: 'credit_note_amt' },
            { label: 'Retention Money (₹)',   key: 'retention_money' },
            { label: 'TDS Deduction (₹)',     key: 'tds_deduction' },
            { label: 'Other Deductions (₹)',  key: 'other_deductions' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
              <input type="number" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-3 gap-4 text-right">
          <div>
            <p className="text-xs text-slate-500">QS Total</p>
            <p className="text-base font-bold text-slate-700">₹{inr(qsTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Deductions</p>
            <p className="text-base font-bold text-red-600">−₹{inr(totalDed)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Certified Net</p>
            <p className="text-xl font-bold text-emerald-600">₹{inr(certifiedNet)}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">QS Remarks</label>
        <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" value={form.qs_remarks} onChange={e => set('qs_remarks', e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => qsMutation.mutate(form)} disabled={qsMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          {qsMutation.isPending ? 'Saving…' : 'Save QS Certification'}
        </button>
        <a
          href={`/dqs/bills/${billId}/ra-abstract`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition"
        >
          <Printer className="w-3.5 h-3.5" /> Print RA Abstract
        </a>
      </div>

      {/* ── Payment Certificate section ─────────────────────────────────── */}
      <div className="border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-bold text-slate-700">Payment Certificate</span>
            {pcReady && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{upd.pc_number}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pcReady && (
              <a
                href={`/dqs/bills/${billId}/payment-cert`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                <Printer className="w-3.5 h-3.5" /> Print A4
              </a>
            )}
            {!pcReady && (
              <button
                onClick={() => genPCMutation.mutate()}
                disabled={genPCMutation.isPending || !upd.certified_net}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition"
                title={!upd.certified_net ? 'Save QS certification first' : ''}
              >
                <Award className="w-3.5 h-3.5" />
                {genPCMutation.isPending ? 'Generating…' : 'Generate PC'}
              </button>
            )}
          </div>
        </div>

        {!pcReady ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
            <p className="text-xs text-amber-600">
              {upd.certified_net
                ? 'Click "Generate PC" to create the Payment Certificate and enable signatures.'
                : 'Save QS Certification first, then generate the Payment Certificate.'}
            </p>
          </div>
        ) : (
          <>
            {/* PC summary strip */}
            <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-[10px] text-slate-500 font-semibold uppercase">PC Number</p><p className="font-bold text-amber-700">{upd.pc_number}</p></div>
              <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Generated</p><p className="font-semibold text-slate-700">{upd.pc_generated_at ? new Date(upd.pc_generated_at).toLocaleDateString('en-IN') : '—'}</p></div>
              <div><p className="text-[10px] text-slate-500 font-semibold uppercase">RA Bill #</p><p className="font-semibold text-slate-700">{upd.ra_bill_number || '—'}</p></div>
              <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Certified Net</p><p className="font-bold text-emerald-700">₹{inr(upd.certified_net)}</p></div>
            </div>

            {/* 3 signature boxes */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Authorisation Signatures</p>
            <div className="grid grid-cols-3 gap-4">
              <SigBox stage="qs"    label="QS Engineer"      role="Verified & Certified"  upd={upd} pcReady={pcReady} isPending={signMutation.isPending} onSign={setSigModal} />
              <SigBox stage="pm"    label="Project Manager"  role="Reviewed & Approved"   upd={upd} pcReady={pcReady} isPending={signMutation.isPending} onSign={setSigModal} />
              <SigBox stage="accts" label="Accounts"         role="Approved for Payment"  upd={upd} pcReady={pcReady} isPending={signMutation.isPending} onSign={setSigModal} />
            </div>
          </>
        )}
      </div>

      {/* ── Signature modal ──────────────────────────────────────────────── */}
      {sigModal && (
        <SignaturePadModal
          title={sigModal === 'qs' ? 'QS Engineer' : sigModal === 'pm' ? 'Project Manager' : 'Accounts Officer'}
          subtitle={`Payment Certificate ${upd.pc_number} · ${bill.vendor_name}`}
          onSave={(imgData) => handleSign(sigModal, imgData)}
          onClose={() => setSigModal(null)}
        />
      )}
    </div>
  );
}

/* ─── Accounts / Procurement / Payment Tabs ─── */
const PAYMENT_MODES = [
  { value: 'RTGS',          label: 'RTGS' },
  { value: 'NEFT',          label: 'NEFT' },
  { value: 'IMPS',          label: 'IMPS' },
  { value: 'UPI',           label: 'UPI' },
  { value: 'Cheque',        label: 'Cheque' },
  { value: 'Cash',          label: 'Cash' },
  { value: 'DD',            label: 'Demand Draft' },
  { value: 'bank_transfer', label: 'Bank Transfer (Other)' },
];

function AccountsTab({ bill, billId }) {
  const qc  = useQueryClient();
  const upd = bill.bill_updates || {};
  const [form, setForm] = useState({
    accts_received_from_qs_date: upd.accts_received_from_qs_date?.slice(0, 10) || '',
    accts_jv_date:    upd.accts_jv_date?.slice(0, 10)    || '',
    accts_remarks:    upd.accts_remarks    || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.updateAccounts(billId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dqs-bill', billId] });
      toast.success('Accounts updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-5">
      <SectionTitle>Accounts / JV</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Received from QS Date</label>
          <input type="date"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.accts_received_from_qs_date} onChange={e => set('accts_received_from_qs_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">JV Date (Accounts)</label>
          <input type="date"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.accts_jv_date} onChange={e => set('accts_jv_date', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Accounts Remarks</label>
        <textarea rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          value={form.accts_remarks} onChange={e => set('accts_remarks', e.target.value)} />
      </div>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving…' : 'Save & Send to Procurement'}
      </button>
    </div>
  );
}

function ProcurementTab({ bill, billId }) {
  const qc  = useQueryClient();
  const upd = bill.bill_updates || {};
  const [form, setForm] = useState({
    proc_received_from_accounts_date: upd.proc_received_from_accounts_date?.slice(0, 10) || '',
    proc_handed_over_to_accounts_date: upd.proc_handed_over_to_accounts_date?.slice(0, 10) || '',
    procurement_remarks: upd.procurement_remarks || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.updateProcurement(billId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dqs-bill', billId] });
      toast.success('Procurement updated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-5">
      <SectionTitle>Procurement Handoff</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Received from Accounts Date</label>
          <input type="date"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.proc_received_from_accounts_date} onChange={e => set('proc_received_from_accounts_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Handed Over to Accounts Date</label>
          <input type="date"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.proc_handed_over_to_accounts_date} onChange={e => set('proc_handed_over_to_accounts_date', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Procurement Remarks</label>
        <textarea rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          value={form.procurement_remarks} onChange={e => set('procurement_remarks', e.target.value)} />
      </div>
      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving…' : 'Save Procurement Handoff'}
      </button>
    </div>
  );
}

function PaymentTab({ bill, billId }) {
  const qc  = useQueryClient();
  const upd = bill.bill_updates || {};
  const [form, setForm] = useState({
    paid_amount:      upd.paid_amount      || '',
    payment_date:     upd.payment_date?.slice(0, 10)     || '',
    payment_mode:     upd.payment_mode     || '',
    reference_number: upd.reference_number || '',
    bank_name:        upd.bank_name        || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const certified = parseFloat(upd.certified_net || bill.total_amount) || 0;
  const paid      = parseFloat(form.paid_amount) || 0;
  const balance   = certified - paid;
  const tds       = parseFloat(upd.tds_deduction || 0);

  const mutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.updatePayment(billId, d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['dqs-bill', billId] });
      if (res?.data?.data?.finance_payment_id) {
        toast.success('Payment recorded & Finance entry created!');
      } else {
        toast.success('Payment recorded');
      }
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const financeLinked = !!upd.finance_payment_id;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Certified Net',  value: inr(certified),    color: 'text-slate-800' },
          { label: 'TDS Deducted',   value: inr(tds),          color: 'text-orange-600' },
          { label: 'Net Payable',    value: inr(certified - tds), color: 'text-indigo-700' },
          { label: 'Balance to Pay', value: inr(balance),      color: balance > 0 ? 'text-red-500' : 'text-emerald-600' },
        ].map(c => (
          <div key={c.label} className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium">{c.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${c.color}`}>₹{c.value}</p>
          </div>
        ))}
      </div>

      {financeLinked && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-emerald-700">Finance Payment Record Created</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">This payment is recorded in the Finance module and appears in TDS reports and cash flow.</p>
          </div>
          <a
            href="/finance/payments"
            className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <SectionTitle>Payment</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid (₹)</label>
          <input type="number" step="0.01"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
          <input type="date"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}
          >
            <option value="">— Select —</option>
            {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reference / Cheque No.</label>
          <input type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="UTR / Cheque number"
            value={form.reference_number} onChange={e => set('reference_number', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Bank Name</label>
          <input type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g. HDFC, SBI"
            value={form.bank_name} onChange={e => set('bank_name', e.target.value)} />
        </div>
      </div>

      {!financeLinked && paid > 0 && form.payment_date && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          <IndianRupee className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Saving will automatically create a <strong>Finance payment record</strong> for ₹{inr(paid - tds)} — it will appear in TDS reports and cash flow under the <em>{bill.bill_type === 'wo' ? 'Subcontractor' : 'Vendor'}</em> category.
          </p>
        </div>
      )}

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving…' : financeLinked ? 'Update Payment' : 'Save Payment'}
      </button>
    </div>
  );
}

/* ─── Files Panel ─── */
function FilesPanel({ bill, billId }) {
  const qc = useQueryClient();
  const fileRef = useRef();
  const files = bill.files || [];

  const uploadMutation = useMutation({
    mutationFn: (fd) => dqsBillsAPI.uploadFile(billId, fd),
    onSuccess: (res) => {
      const synced = res.data?.onedrive_synced;
      toast.success(synced ? 'Uploaded & synced to OneDrive ☁' : 'Uploaded locally');
      qc.invalidateQueries({ queryKey: ['dqs-bill', billId] });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (fid) => dqsBillsAPI.deleteFile(billId, fid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dqs-bill', billId] }); toast.success('File deleted'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const syncMutation = useMutation({
    mutationFn: (fid) => dqsBillsAPI.syncFileToOneDrive(billId, fid),
    onSuccess: (res) => {
      const synced = res.data?.onedrive_synced;
      toast.success(synced ? 'Attachment synced to OneDrive' : 'Attachment sync skipped');
      qc.invalidateQueries({ queryKey: ['dqs-bill', billId] });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'OneDrive sync failed'),
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    uploadMutation.mutate(fd);
    e.target.value = '';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Attachments</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No files attached</p>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex flex-col bg-slate-50 rounded-lg p-2 gap-1.5 border border-slate-100 hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="text-xs text-slate-700 flex-1 truncate font-medium" title={f.file_name}>{f.file_name}</span>
                <span className="text-[10px] text-slate-400">{f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : ''}</span>
              </div>
              
              <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-2">
                  {f.onedrive_web_url ? (
                    <a href={f.onedrive_web_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                      <Cloud className="w-3 h-3" /> OneDrive
                    </a>
                  ) : (
                    <button
                      onClick={() => syncMutation.mutate(f.id)}
                      disabled={syncMutation.isPending}
                      className="flex items-center gap-1 text-[10px] text-slate-400 transition hover:text-blue-600 disabled:opacity-50"
                    >
                      {syncMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CloudOff className="w-3 h-3" />}
                      {syncMutation.isPending ? 'Syncing…' : 'Local'}
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <a href={f.local_url || `/uploads/dqs-bills/${billId}/${f.file_name}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600 p-1">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => deleteMutation.mutate(f.id)} className="text-slate-400 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── History Panel ─── */
function HistoryPanel({ history = [] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Audit History</p>
      {history.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">No history yet</p>
      ) : (
        <div className="space-y-2">
          {history.map((h, i) => (
            <div key={h.id || i} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-700">{h.dept}</span>
                <span className="mx-1.5 text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-600">{h.action}</span>
                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(h.ts).toLocaleString('en-IN')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Workflow Steps Strip ─── */
const WORKFLOW_STEPS = [
  { id: 'pending',             label: 'Received'    },
  { id: 'stores',              label: 'Stores'      },
  { id: 'document_controller', label: 'Doc Control' },
  { id: 'qs',                  label: 'QS Cert'     },
  { id: 'accounts',            label: 'Accounts'    },
  { id: 'procurement',         label: 'Procurement' },
  { id: 'paid',                label: 'Paid'        },
];
const STEP_ORDER = WORKFLOW_STEPS.map(s => s.id);

function WorkflowStrip({ status }) {
  const currentIdx = STEP_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-0">
      {WORKFLOW_STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const pending = i > currentIdx;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1 min-w-[72px]">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                done    ? 'bg-emerald-500 border-emerald-500 text-white' :
                active  ? 'bg-indigo-600 border-indigo-600 text-white' :
                          'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] font-semibold text-center leading-tight ${
                done ? 'text-emerald-600' : active ? 'text-indigo-600' : 'text-slate-400'
              }`}>{step.label}</span>
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 ${i < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Main Page ─── */
export default function DQSBillDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const visibleTabs = useMemo(
    () => getVisibleTabsForDepartment(user?.department, user?.role),
    [user?.department, user?.role]
  );

  useEffect(() => {
    if (!visibleTabs.some(tab => tab.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, visibleTabs]);

  const { data: bill, isLoading, error } = useQuery({
    queryKey: ['dqs-bill', id],
    queryFn: () => dqsBillsAPI.get(id).then(r => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => r.data?.data ?? r.data ?? []),
  });

  const qc = useQueryClient();
  const [metaProject, setMetaProject]   = useState(null);
  const [metaWorkDesc, setMetaWorkDesc] = useState(null);
  const metaMutation = useMutation({
    mutationFn: (d) => dqsBillsAPI.updateMeta(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dqs-bill', id] }); toast.success('Bill info updated'); },
  });

  // ── PO Linking ──────────────────────────────────────────────────────────
  const [showLinkPO, setShowLinkPO]   = useState(false);
  const [poSearch, setPoSearch]       = useState('');
  const { data: availablePOs = [] } = useQuery({
    queryKey: ['dqs-link-pos', bill?.project_id],
    queryFn: () => dqsBillsAPI.lookupPOs({ project_id: bill?.project_id }).then(r => r.data?.data ?? []),
    enabled: showLinkPO,
  });
  const filteredLinkPOs = availablePOs.filter(po => {
    const q = poSearch.toLowerCase();
    return !q || (po.po_number || '').toLowerCase().includes(q) || (po.vendor_name || '').toLowerCase().includes(q);
  });
  const linkPOMut = useMutation({
    mutationFn: (po_id) => dqsBillsAPI.update(id, { po_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dqs-bill', id] });
      setShowLinkPO(false);
      setPoSearch('');
      toast.success('Bill linked to PO');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Link failed'),
  });
  const unlinkPOMut = useMutation({
    mutationFn: () => dqsBillsAPI.update(id, { po_id: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dqs-bill', id] }); toast.success('PO link removed'); },
  });

  if (isLoading) return (
    <div className="p-8 space-y-4 bg-[#f4f6f9] min-h-screen">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`h-${i === 0 ? 20 : 12} bg-white rounded-xl animate-pulse border border-slate-100`} />
      ))}
    </div>
  );

  if (error || !bill) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f6f9]">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-slate-700 font-semibold mb-1">Bill Not Found</p>
        <p className="text-sm text-slate-400 mb-5">This bill may have been deleted or you may not have access.</p>
        <button onClick={() => navigate('/dqs/bills')} className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
          Back to Bills
        </button>
      </div>
    </div>
  );

  const statusCls   = STATUS_COLORS[bill.workflow_status] || STATUS_COLORS.pending;
  const statusLabel = (bill.workflow_status || 'pending').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const upd         = bill.bill_updates || {};

  return (
    <div className="bg-[#f4f6f9] min-h-screen">

      {/* ── Sticky Page Header ─────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#e2e6ec] shadow-sm">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate('/dqs/bills')}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base font-bold text-[#1a1c21] truncate">{bill.sl_number}</span>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${statusCls}`}>
                {statusLabel}
              </span>
              {upd.pc_number && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  PC: {upd.pc_number}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{bill.vendor_name} &nbsp;·&nbsp; {bill.inv_number}</p>
          </div>

          {/* Amount pills */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Basic</p>
              <p className="text-sm font-bold text-slate-700">₹{inr(bill.basic_amount)}</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total Invoice</p>
              <p className="text-sm font-bold text-indigo-700">₹{inr(bill.total_amount)}</p>
            </div>
            {upd.certified_net && (
              <>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Certified Net</p>
                  <p className="text-sm font-bold text-emerald-600">₹{inr(upd.certified_net)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 max-w-[1400px] mx-auto">

        {/* ── Workflow Progress Strip ─────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#e2e6ec] shadow-sm px-6 py-4">
          <WorkflowStrip status={bill.workflow_status || 'pending'} />
        </div>

        {/* ── Cross-module links ──────────────────────────────── */}
        {(bill.po_id || bill.grn_id) && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Linked to Procurement</span>
            {bill.po_id && (
              <a href="/procurement/po" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-all">
                <FileText className="w-3.5 h-3.5" />
                PO: {bill.linked_po_number || bill.po_number}
                {bill.linked_po_total && <span className="text-indigo-400 font-normal ml-1">₹{Number(bill.linked_po_total).toLocaleString('en-IN')}</span>}
              </a>
            )}
            {bill.grn_id && (
              <a href="/procurement/grn" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-all">
                <FileText className="w-3.5 h-3.5" />
                GRN: {bill.linked_grn_number}
                {bill.linked_grn_date && <span className="text-emerald-400 font-normal ml-1">{fmt(bill.linked_grn_date)}</span>}
              </a>
            )}
          </div>
        )}

        <div className="flex gap-5 items-start">
          {/* ── Main content ─────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Bill Info Card */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] shadow-sm overflow-hidden">
              {/* Card header bar */}
              <div className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Bill Information</span>
                <span className="text-[11px] text-indigo-200">{bill.bill_type === 'wo' ? 'Work Order Bill' : 'Purchase Order Bill'}</span>
              </div>

              <div className="p-5">
                {/* Row 1 — key identifiers */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 pb-4 border-b border-slate-100">

                  {/* PO / WO # — with Link to PO feature */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">PO / WO #</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{bill.po_number || '—'}</p>
                      {bill.po_id ? (
                        <button
                          onClick={() => { if (window.confirm('Remove PO link?')) unlinkPOMut.mutate(); }}
                          title="Remove PO link"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 hover:bg-red-100 hover:text-red-600 font-semibold transition-all"
                        >linked ✕</button>
                      ) : (
                        <button
                          onClick={() => setShowLinkPO(v => !v)}
                          title="Link to a PO record"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 font-semibold transition-all"
                        >+ Link PO</button>
                      )}
                    </div>

                    {/* Dropdown for PO search + select */}
                    {showLinkPO && (
                      <div className="mt-2 bg-white border border-indigo-200 rounded-lg shadow-lg p-2 z-10 w-72">
                        <input
                          autoFocus
                          placeholder="Search PO number or vendor…"
                          value={poSearch}
                          onChange={e => setPoSearch(e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
                        />
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {filteredLinkPOs.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-3">No approved POs found</p>
                          )}
                          {filteredLinkPOs.map(po => (
                            <button
                              key={po.id}
                              onClick={() => linkPOMut.mutate(po.id)}
                              disabled={linkPOMut.isPending}
                              className="w-full text-left px-2 py-1.5 rounded hover:bg-indigo-50 transition-all"
                            >
                              <p className="text-xs font-semibold text-slate-800 font-mono">{po.po_number}</p>
                              <p className="text-[10px] text-slate-400">{po.vendor_name} · ₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</p>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setShowLinkPO(false)} className="mt-1 w-full text-center text-[10px] text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                    )}
                  </div>

                  {[
                    { label: 'Invoice #',       value: bill.inv_number },
                    { label: 'Invoice Date',    value: fmt(bill.inv_date) },
                    { label: 'Received Date',   value: fmt(bill.received_date) },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{f.label}</p>
                      <p className="text-sm font-semibold text-slate-800">{f.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Row 2 — editable fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 pt-4 pb-4 border-b border-slate-100">
                  {/* Project */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Project</p>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                      value={metaProject ?? bill.project_id ?? ''}
                      onChange={e => {
                        setMetaProject(e.target.value);
                        metaMutation.mutate({ project_id: e.target.value || null, work_desc: metaWorkDesc ?? bill.work_desc ?? '' });
                      }}
                    >
                      <option value="">— Select Project —</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  {/* Package Description */}
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Package Description</p>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                        placeholder="e.g. PPC Cement for DQS, Yelahanka"
                        value={metaWorkDesc ?? bill.work_desc ?? ''}
                        onChange={e => setMetaWorkDesc(e.target.value)}
                      />
                      <button
                        onClick={() => metaMutation.mutate({ project_id: metaProject ?? bill.project_id ?? null, work_desc: metaWorkDesc ?? bill.work_desc ?? '' })}
                        disabled={metaMutation.isPending}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  {/* Invoice Month */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Invoice Month</p>
                    <p className="text-sm font-semibold text-slate-800">{bill.inv_month || '—'}</p>
                  </div>
                </div>

                {/* Row 3 — amount summary boxes */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  {[
                    { label: 'Basic Amount',  value: `₹${inr(bill.basic_amount)}`,  bg: 'bg-slate-50',    text: 'text-slate-800' },
                    { label: 'GST Amount',    value: `₹${inr(bill.gst_amount)}`,    bg: 'bg-amber-50',    text: 'text-amber-700' },
                    { label: 'Total Invoice', value: `₹${inr(bill.total_amount)}`,  bg: 'bg-indigo-50',   text: 'text-indigo-700' },
                    { label: 'Certified Net', value: upd.certified_net ? `₹${inr(upd.certified_net)}` : '—', bg: 'bg-emerald-50', text: 'text-emerald-700' },
                  ].map(c => (
                    <div key={c.label} className={`${c.bg} rounded-xl px-4 py-3 border border-white`}>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{c.label}</p>
                      <p className={`text-lg font-black ${c.text}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs Card */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] shadow-sm overflow-hidden">
              {/* Tab nav */}
              <div className="flex border-b border-[#e2e6ec] overflow-x-auto bg-[#f8f9fc]">
                {visibleTabs.map(tab => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap shrink-0 ${
                        active
                          ? 'border-indigo-600 text-indigo-600 bg-white'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
                      }`}
                    >
                      <tab.icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-500' : 'text-slate-400'}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-6">
                {activeTab === 'overview'    && <OverviewTab bill={bill} />}
                {activeTab === 'stores'      && <StoresTab bill={bill} billId={id} />}
                {activeTab === 'doc_control' && <DocumentControlTab bill={bill} billId={id} />}
                {activeTab === 'qs'          && <QSTab bill={bill} billId={id} />}
                {activeTab === 'accounts'    && <AccountsTab bill={bill} billId={id} />}
                {activeTab === 'procurement' && <ProcurementTab bill={bill} billId={id} />}
                {activeTab === 'payment'     && <PaymentTab bill={bill} billId={id} />}
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ─────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {/* Attachments */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e6ec] bg-[#f8f9fc] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Attachments</span>
                <span className="text-[10px] text-slate-400">{(bill.files || []).length} file{(bill.files || []).length !== 1 ? 's' : ''}</span>
              </div>
              <div className="p-4">
                <FilesPanel bill={bill} billId={id} />
              </div>
            </div>

            {/* Audit History */}
            <div className="bg-white rounded-xl border border-[#e2e6ec] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e6ec] bg-[#f8f9fc]">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Audit History</span>
              </div>
              <div className="p-4">
                <HistoryPanel history={bill.history || []} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
