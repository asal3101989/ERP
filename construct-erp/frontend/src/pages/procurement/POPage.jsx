// src/pages/procurement/POPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import {
  ShoppingCart, Plus, X, Check, Clock, Search, Download,
  Printer, AlertCircle, ChevronRight, Trash2, Activity,
  Package, Building2, Calendar, BadgeCheck, FileText,
  CheckCircle2, UserCheck, Landmark, XCircle, Upload, FileUp,
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { poAPI, vendorAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import POPrintTemplate from './POPrintTemplate';

const UNITS = ['MT', 'Bags', 'CUM', 'SQM', 'Nos', 'RMT', 'KG', 'Litre', 'Month', 'LS'];

const STATUS_CONFIG = {
  pending:         { label: 'Pending Audit',   short: 'Pending',      color: 'bg-yellow-50 text-yellow-700 border-yellow-200',  dot: 'bg-yellow-500',  icon: Clock,        stage: 1 },
  verified_audit:  { label: 'Audit Verified',  short: 'Audit OK',     color: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-500',    icon: UserCheck,    stage: 2 },
  checked_finance: { label: 'Finance Passed',  short: 'Finance OK',   color: 'bg-indigo-50 text-indigo-700 border-indigo-200',   dot: 'bg-indigo-500',  icon: BadgeCheck,   stage: 3 },
  released_mgmt:   { label: 'Mgmt Released',   short: 'Released',     color: 'bg-violet-50 text-violet-700 border-violet-200',   dot: 'bg-violet-500',  icon: Building2,    stage: 4 },
  approved:        { label: 'MD Authorized',   short: 'Authorized',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200',dot: 'bg-emerald-500', icon: CheckCircle2, stage: 5 },
  part_received:   { label: 'Part Received',   short: 'Part Rcvd',    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',         dot: 'bg-cyan-500',    icon: Package,      stage: 6 },
  fully_received:  { label: 'Fully Received',  short: 'Received',     color: 'bg-green-50 text-green-700 border-green-200',      dot: 'bg-green-500',   icon: Check,        stage: 7 },
  rejected:        { label: 'Rejected',         short: 'Rejected',     color: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-400',     icon: XCircle,      stage: 0 },
};

const STAGE_ACTIONS = [
  { id: 'verify-audit',  label: 'Audit Verify',     reqStatus: 'pending' },
  { id: 'check-finance', label: 'Finance Check',     reqStatus: 'verified_audit' },
  { id: 'release-mgmt',  label: 'Director Release',  reqStatus: 'checked_finance' },
  { id: 'authorize-md',  label: 'MD Authorize',      reqStatus: 'released_mgmt' },
];

const inr  = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmt  = d => d ? dayjs(d).format('DD MMM YYYY') : '—';

/* ─── Signature Pad Modal ─── */
function SignaturePadModal({ signerName, signerRole, onSave, onClose }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const lastPos   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const startDraw = e => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, canvasRef.current); };
  const draw = e => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastPos.current = pos;
  };
  const endDraw = () => { drawing.current = false; };
  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };
  const save = () => {
    const canvas = canvasRef.current;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const hasSign = Array.from(data).some((v, i) => i % 4 !== 3 && v < 240);
    if (!hasSign) return toast.error('Please draw your signature first');
    onSave(canvas.toDataURL('image/png'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Digital Signature</h3>
            <p className="text-xs text-slate-400 mt-0.5">{signerRole} — {signerName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-slate-400 mb-2 text-center">Draw your signature in the box below</p>
          <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white cursor-crosshair">
            <canvas ref={canvasRef} width={420} height={160}
              style={{ display: 'block', width: '100%', height: '160px', touchAction: 'none' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-slate-400 italic">Use mouse or touch to sign</p>
            <button onClick={clear} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>
        <div className="mx-5 mb-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-[11px] text-slate-500">
            Signing as: <span className="font-semibold text-slate-700">{signerName}</span>
            &nbsp;·&nbsp; {signerRole}
            &nbsp;·&nbsp; {dayjs().format('DD MMM YYYY, HH:mm')}
          </p>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Confirm Signature
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap', cfg.color)}>
      <Icon size={11} strokeWidth={2.5} />
      {cfg.short}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

const INP = 'w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all';

/* ─── New PO Modal ─── */
const EMPTY_ITEM = { material_name:'', mix_design:'', hsn_code:'', unit:'Cum', quantity:'', rate:'', gst_rate:'18', req_date:'' };
const TC_DEFAULT = `1. All Bills and DCs should contain the Reference of the Concerned PO.
2. All materials supplied will be subject to inspections & test when received at our site.
3. Final Bill shall be cleared after Certification by the Concerned Engg & on actual measurements taken at Site.
4. If any Goods damaged or rejected must be replaced immediately at the suppliers own expenses.
5. Payment: 30 Days from the date of supply.
6. Lead Time: As per site requirement.
7. Bill Requirement: Bill must carry PO number, GST number, HSN Code, Bill number, LUT details, Transporter challan.
8. Quantity Certification: Quantity mentioned in the Order may be approximate; actual & mutually certified measurement will be accounted for payment.
9. Price Escalation: Price is absolute frozen for this Order. No escalation will be entertained.
10. TDS as applicable under Income Tax Laws shall be deducted at applicable rates.`;

function NewPOModal({ onClose, vendors, projects, onCreate, isPending, prefill }) {
  const [form, setForm] = useState({
    vendor_id:        prefill?.vendor_id        || '',
    project_id:       prefill?.project_id       || '',
    po_date:          prefill?.po_date          || dayjs().format('YYYY-MM-DD'),
    delivery_date:    '',
    po_ref_no:        prefill?.po_ref           || '',
    po_req_no:        prefill?.po_req_no        || '',
    approval_no:      '',
    delivery_address: prefill?.delivery_address || '',
    narration:        prefill?.narration        || '',
    cgst_rate:        prefill?.cgst_rate        || '9',
    sgst_rate:        prefill?.sgst_rate        || '9',
    igst_rate:        '0',
    gst_inclusive:    prefill?.gst_inclusive    ?? true,
    terms_conditions: prefill?.terms_conditions || TC_DEFAULT,
    notes:            prefill?.notes            || (prefill?.mrs_ref ? `Ref: CS / ${prefill.mrs_ref}` : ''),
  });
  const [items, setItems] = useState(
    prefill?.items?.length ? prefill.items : [{ ...EMPTY_ITEM }]
  );

  const set     = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = i => setItems(p => p.filter((_, idx) => idx !== i));

  const subTotal  = items.reduce((s, it) => s + (parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0), 0);
  const cgstAmt   = form.gst_inclusive ? 0 : subTotal * (parseFloat(form.cgst_rate)||0) / 100;
  const sgstAmt   = form.gst_inclusive ? 0 : subTotal * (parseFloat(form.sgst_rate)||0) / 100;
  const igstAmt   = form.gst_inclusive ? 0 : subTotal * (parseFloat(form.igst_rate)||0) / 100;
  const grandTotal = subTotal + cgstAmt + sgstAmt + igstAmt;

  const handleSubmit = () => {
    if (!form.vendor_id)  return toast.error('Select a vendor');
    if (!form.project_id) return toast.error('Select a project');
    if (items.some(it => !it.material_name?.trim() || !it.quantity || !it.rate))
      return toast.error('All items need description, quantity and rate');
    onCreate({ ...form, delivery_date: form.delivery_date || null, items });
  };

  const TA = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 transition-all resize-none';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 w-full max-w-5xl rounded-2xl flex flex-col max-h-[95vh] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {form.po_ref_no ? `Purchase Order — ${form.po_ref_no}` : 'Create Purchase Order'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">BCIM-PUR-F-03 · 4-stage authorization workflow</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {prefill?.mrs_ref && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span><strong>Pre-filled from CS</strong> — {prefill.mrs_ref} · {prefill.vendor_name}</span>
            </div>
          )}

          {/* ── SECTION 1: PO HEADER ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Purchase Order Details</h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Vendor *">
                <select className={INP} value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Project *">
                <select className={INP} value={form.project_id} onChange={e => set('project_id', e.target.value)}>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="PO No (Ref)">
                <input className={INP} placeholder="e.g. POTQS001-A3" value={form.po_ref_no} onChange={e => set('po_ref_no', e.target.value)} />
              </Field>
              <Field label="PO Date *">
                <input type="date" className={INP} value={form.po_date} onChange={e => set('po_date', e.target.value)} />
              </Field>
              <Field label="PO Req No">
                <input className={INP} placeholder="e.g. Mail / MR-018" value={form.po_req_no} onChange={e => set('po_req_no', e.target.value)} />
              </Field>
              <Field label="Approval No">
                <input className={INP} placeholder="Approval reference" value={form.approval_no} onChange={e => set('approval_no', e.target.value)} />
              </Field>
              <Field label="Expected Delivery">
                <input type="date" className={INP} value={form.delivery_date} onChange={e => set('delivery_date', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* ── SECTION 2: DELIVERY ADDRESS ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Delivery Address</h3>
            </div>
            <div className="p-4">
              <textarea rows={3} className={TA}
                placeholder="YNT 63, Survey No. 5/3 & 6/1, Mandalakunte Village, Chikkabommasandra, Yelahanka Hobli, Near Mother Dairy, Bangalore 560065&#10;Contact Person: Mr. Ananthan 73036 75533"
                value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
            </div>
          </div>

          {/* ── SECTION 3: LINE ITEMS ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Line Items</h3>
              <button onClick={addItem} className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors">
                <Plus className="w-3 h-3" /> Add Row
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              {/* Column headers */}
              <div className="grid gap-2 mb-2 min-w-[900px]"
                style={{ gridTemplateColumns: '32px 2fr 1.5fr 70px 70px 90px 90px 80px 70px 32px' }}>
                {['#', 'Description', 'Mix Design', 'Unit', 'HSN', 'Qty', 'Rate (₹)', 'Req Date', 'GST%', ''].map(h => (
                  <div key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">{h}</div>
                ))}
              </div>
              {/* Rows */}
              <div className="space-y-2 min-w-[900px]">
                {items.map((it, i) => (
                  <div key={i} className="grid gap-2 items-center"
                    style={{ gridTemplateColumns: '32px 2fr 1.5fr 70px 70px 90px 90px 80px 70px 32px' }}>
                    <div className="text-xs text-slate-400 text-center">{i + 1}</div>
                    <input className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm outline-none focus:border-indigo-400 transition-all"
                      placeholder="M30 Grade Concrete" value={it.material_name} onChange={e => setItem(i, 'material_name', e.target.value)} />
                    <input className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm outline-none focus:border-indigo-400 transition-all"
                      placeholder="280 Kgs Cement + 70 Kgs GGBS" value={it.mix_design||''} onChange={e => setItem(i, 'mix_design', e.target.value)} />
                    <select className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-1 text-sm outline-none focus:border-indigo-400 transition-all"
                      value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:border-indigo-400 transition-all"
                      placeholder="HSN" value={it.hsn_code||''} onChange={e => setItem(i, 'hsn_code', e.target.value)} />
                    <input type="number" className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm text-right outline-none focus:border-indigo-400 transition-all"
                      placeholder="0" value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                    <input type="number" className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm text-right outline-none focus:border-indigo-400 transition-all"
                      placeholder="0.00" value={it.rate} onChange={e => setItem(i, 'rate', e.target.value)} />
                    <input type="date" className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-1 text-xs outline-none focus:border-indigo-400 transition-all"
                      value={it.req_date||''} onChange={e => setItem(i, 'req_date', e.target.value)} />
                    <input type="number" className="h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm text-center outline-none focus:border-indigo-400 transition-all"
                      value={it.gst_rate} onChange={e => setItem(i, 'gst_rate', e.target.value)} />
                    <button onClick={() => removeItem(i)} disabled={items.length === 1}
                      className="w-8 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Totals + GST ── */}
            <div className="border-t border-slate-200 p-4 flex flex-col md:flex-row gap-4 items-start justify-between bg-slate-50/50">
              {/* GST Settings */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">GST Settings</p>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.gst_inclusive} onChange={e => set('gst_inclusive', e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600" />
                  GST Inclusive in rate (as in PDF)
                </label>
                <div className="flex gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">CGST %</p>
                    <input type="number" className="w-16 h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs text-center outline-none focus:border-indigo-400"
                      value={form.cgst_rate} onChange={e => set('cgst_rate', e.target.value)} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">SGST %</p>
                    <input type="number" className="w-16 h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs text-center outline-none focus:border-indigo-400"
                      value={form.sgst_rate} onChange={e => set('sgst_rate', e.target.value)} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1">IGST %</p>
                    <input type="number" className="w-16 h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs text-center outline-none focus:border-indigo-400"
                      value={form.igst_rate} onChange={e => set('igst_rate', e.target.value)} />
                  </div>
                </div>
              </div>
              {/* Totals */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[230px] space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Sub Total</span><span className="font-semibold text-slate-800">{inr(subTotal)}</span>
                </div>
                {!form.gst_inclusive ? (<>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>CGST @ {form.cgst_rate}%</span><span>{inr(cgstAmt)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>SGST @ {form.sgst_rate}%</span><span>{inr(sgstAmt)}</span>
                  </div>
                  {parseFloat(form.igst_rate) > 0 && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>IGST @ {form.igst_rate}%</span><span>{inr(igstAmt)}</span>
                    </div>
                  )}
                </>) : (
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span>CGST {form.cgst_rate}% + SGST {form.sgst_rate}%</span><span>Inclusive</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-200 pt-2">
                  <span>Grand Total</span><span className="text-indigo-700">{inr(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 4: NARRATION ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Narration</h3>
            </div>
            <div className="p-4">
              <textarea rows={2} className={TA}
                placeholder="e.g. Concrete for TQS Retaining wall work, Security cabin & Compound Wall work"
                value={form.narration} onChange={e => set('narration', e.target.value)} />
            </div>
          </div>

          {/* ── SECTION 5: TERMS & CONDITIONS ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Terms &amp; Conditions</h3>
            </div>
            <div className="p-4">
              <textarea rows={8} className={TA}
                value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} />
            </div>
          </div>

          {/* ── SECTION 6: SPECIAL NOTES ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Special Notes / Bank Details</h3>
            </div>
            <div className="p-4">
              <textarea rows={2} className={TA}
                placeholder="Additional instructions, bank details, packing notes…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <span className="text-xs text-slate-400">{items.filter(it => it.material_name && it.quantity).length} item(s) · Grand Total: <strong>{inr(grandTotal)}</strong></span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-5 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-all">Cancel</button>
            <button onClick={handleSubmit} disabled={isPending}
              className="px-6 h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm">
              {isPending ? 'Submitting…' : 'Submit for Audit →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const STAGE_LABELS = {
  'verify-audit':  'Audit Verification',
  'check-finance': 'Finance Check',
  'release-mgmt':  'Director Release',
  'authorize-md':  'MD Authorization',
};

/* ─── Detail Slide-over ─── */
function PODetailPanel({ po, detailedPO, onClose, onApprove, onReject, isApproving, isRejecting, user }) {
  const [sigModal, setSigModal] = useState(null); // { stage }
  const liveStatus = detailedPO?.status ?? po.status;
  const currentAction = STAGE_ACTIONS.find(a => a.reqStatus === liveStatus);
  const cfg = STATUS_CONFIG[liveStatus] || STATUS_CONFIG.pending;
  const signatures = detailedPO?.signatures || {};

  return (
    <>
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white border-l border-slate-200 w-[600px] flex flex-col h-full overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 font-mono">{po.serial_no_formatted || po.po_number}</p>
              <p className="text-xs text-slate-400 mt-0.5">{po.vendor_name} · {fmt(po.po_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={liveStatus} />
            <button onClick={() => window.print()} disabled={!detailedPO}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-40 transition-all">
              <Printer className="w-3.5 h-3.5" /> {!detailedPO ? '…' : 'Print'}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f4f6f9]">

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sub Total',    value: inr(po.sub_total),   color: 'text-slate-800' },
              { label: 'GST',          value: inr(po.total_gst),   color: 'text-amber-600' },
              { label: 'Grand Total',  value: inr(po.grand_total), color: 'text-indigo-700' },
            ].map((k, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">{k.label}</p>
                <p className={clsx('text-sm font-bold', k.color)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Vendor',    po.vendor_name],
              ['Project',   po.project_name],
              ['PO Date',   fmt(po.po_date)],
              ['Delivery',  fmt(po.delivery_date)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Line Items</span>
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                {(detailedPO?.items || []).length} items
              </span>
            </div>
            {!detailedPO ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['#', 'Material', 'Unit', 'Qty', 'Rate', 'Total'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(detailedPO.items || []).map((it, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">
                        {it.material_name}
                        {it.hsn_code && <div className="text-slate-400 font-normal">HSN: {it.hsn_code}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold uppercase">{it.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-indigo-600">{parseFloat(it.quantity)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{inr(it.rate)}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{inr(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Approval pipeline */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Approval Pipeline</span>
            </div>
            <div className="p-4">
              <div className="relative">
                <div className="absolute bg-slate-200 left-[17px] top-5" style={{ width: 1, height: 'calc(100% - 40px)' }} />
                <div className="space-y-3">
                  {STAGE_ACTIONS.map((stage, idx) => {
                    const curStage = (STATUS_CONFIG[liveStatus] || STATUS_CONFIG.pending).stage;
                    const isDone   = curStage > idx + 1;
                    const isActive = curStage === idx + 1;
                    const sig      = signatures[stage.id];
                    return (
                      <div key={stage.id} className="flex items-start gap-3 relative">
                        <div className={clsx(
                          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 mt-0.5',
                          isDone   ? 'bg-emerald-500 border-emerald-500' :
                          isActive ? 'bg-indigo-600 border-indigo-600'   :
                                     'bg-white border-slate-200'
                        )}>
                          {isDone
                            ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            : <span className={clsx('text-xs font-bold', isActive ? 'text-white' : 'text-slate-400')}>{idx + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={clsx('text-xs font-semibold',
                            isDone ? 'text-slate-400 line-through' : isActive ? 'text-slate-900' : 'text-slate-400'
                          )}>{stage.label}</p>
                          {sig?.img && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <img src={sig.img} alt="signature"
                                className="h-8 max-w-[120px] object-contain bg-white border border-slate-200 rounded px-1" />
                              <span className="text-[10px] text-slate-400">{sig.by} · {sig.at ? dayjs(sig.at).format('DD MMM, HH:mm') : ''}</span>
                            </div>
                          )}
                        </div>
                        {isDone   && !sig?.img && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mt-0.5">Done</span>}
                        {isActive && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 animate-pulse mt-0.5">Pending</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {po.notes && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-slate-600">{po.notes}</p>
            </div>
          )}

          {/* Action panel */}
          {currentAction && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Action Required</p>
                  <p className="text-xs text-emerald-700 font-medium">{currentAction.label} — sign to authorize</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSigModal({ stage: currentAction.id })}
                  disabled={isApproving}
                  className="flex-[2] h-9 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isApproving ? 'Processing…' : 'Sign & Authorize'}
                </button>
                <button
                  onClick={onReject}
                  disabled={isRejecting}
                  className="flex-1 h-9 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {isRejecting ? '…' : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Signature modal — inside slide-over */}
        {sigModal && (
          <SignaturePadModal
            signerName={user?.name || 'Authorized Signatory'}
            signerRole={STAGE_LABELS[sigModal.stage] || sigModal.stage}
            onSave={dataUrl => { onApprove(sigModal.stage, dataUrl); setSigModal(null); }}
            onClose={() => setSigModal(null)}
          />
        )}
      </div>
    </div>

    {/* Print zone */}
    <div className="po-print-zone"><POPrintTemplate data={detailedPO} /></div>
    <style dangerouslySetInnerHTML={{ __html: `
      @media screen { .po-print-zone { display: none !important; } }
      @media print {
        body * { visibility: hidden !important; }
        .po-print-zone, .po-print-zone * { visibility: visible !important; }
        .po-print-zone { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; }
        @page { size: A4 portrait; margin: 0; }
      }
    `}} />
    </>
  );
}

/* ─── PDF Import Modal ─── */
function PDFImportModal({ parsed, vendors, projects, onConfirm, onClose }) {
  const [vendorId, setVendorId]   = useState('');
  const [projectId, setProjectId] = useState('');
  const [items, setItems]         = useState(parsed.items || []);

  // Try to auto-match vendor by name
  useEffect(() => {
    if (!vendors.length) return;
    const name = (parsed.vendorName || '').toLowerCase();
    const match = vendors.find(v => v.name.toLowerCase().includes(name) || name.includes(v.name.toLowerCase().split(' ')[0]));
    if (match) setVendorId(match.id);
  }, [vendors, parsed.vendorName]);

  // Auto-match project
  useEffect(() => {
    if (!projects.length) return;
    const proj = (parsed.projectRaw || '').toLowerCase();
    const match = projects.find(p => p.name.toLowerCase().includes(proj.split(' ')[0]) || proj.includes(p.name.toLowerCase().split(' ')[0]));
    if (match) setProjectId(match.id);
  }, [projects, parsed.projectRaw]);

  const setItem = (i, k, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const subTotal = items.reduce((s, it) => s + (parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0), 0);

  const handleConfirm = () => {
    if (!vendorId)  return toast.error('Please select a vendor');
    if (!projectId) return toast.error('Please select a project');
    // Build terms & conditions from PDF payment terms
    const termsLines = [
      parsed.paymentTerms ? `Payment: ${parsed.paymentTerms}` : '',
      'All Bills and DCs should contain the Reference of the Concerned PO.',
      'All materials supplied will be subject to inspections & test when received at site.',
      'Final Bill shall be cleared after Certification by the Concerned Engg & on actual measurements taken at Site.',
      'If any Goods damaged or rejected must be replaced immediately at the suppliers own expenses.',
      'Lead Time: As per site requirement.',
      'Price is absolute frozen for this Order. No price escalation will be entertained.',
    ].filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join('\n');

    onConfirm({
      vendor_id:        vendorId,
      project_id:       projectId,
      po_date:          parsed.poDate || dayjs().format('YYYY-MM-DD'),
      po_ref:           parsed.poNumber || '',
      narration:        parsed.narration || '',
      notes:            '',
      terms_conditions: termsLines,
      items,
    });
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FileUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">PDF Import Preview</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Ref: {parsed.poNumber || '—'} · {parsed.poDate || '—'} · Vendor: {parsed.vendorName || '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Banner */}
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>Data extracted from PDF. Verify the vendor &amp; project mapping below, adjust any fields, then click <strong>Create PO</strong>.</span>
          </div>

          {/* Vendor & Project */}
          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Mapping</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Vendor (PDF: <span className="text-slate-700">{parsed.vendorName || '—'}</span>)
                </label>
                <select className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
                  value={vendorId} onChange={e => setVendorId(e.target.value)}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Project (PDF: <span className="text-slate-700">{parsed.projectRaw || '—'}</span>)
                </label>
                <select className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
                  value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Line Items ({items.length})
            </h3>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="col-span-4">
                    <p className="text-[10px] text-slate-400 mb-0.5">Description</p>
                    <input className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
                      value={it.material_name} onChange={e => setItem(i, 'material_name', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-400 mb-0.5">Unit</p>
                    <input className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
                      value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-400 mb-0.5">Qty</p>
                    <input type="number" className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
                      value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-400 mb-0.5">Rate (₹)</p>
                    <input type="number" className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
                      value={it.rate} onChange={e => setItem(i, 'rate', e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] text-slate-400 mb-0.5">GST%</p>
                    <input type="number" className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
                      value={it.gst_rate} onChange={e => setItem(i, 'gst_rate', e.target.value)} />
                  </div>
                  <div className="col-span-1 text-right pt-4">
                    <p className="text-xs font-semibold text-slate-700">
                      ₹{((parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0)).toLocaleString('en-IN',{maximumFractionDigits:0})}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
              <div className="text-sm font-bold text-slate-900">
                Sub Total: ₹{subTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Narration */}
          {parsed.narration && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
              <span className="font-semibold">Narration:</span> {parsed.narration}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <p className="text-xs text-slate-400">Grand Total (PDF): ₹{(parsed.grandTotal||0).toLocaleString('en-IN')}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-all">Cancel</button>
            <button onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
              <ShoppingCart className="w-4 h-4" /> Create PO from PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function POPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const location = useLocation();
  const [showForm, setShowForm]         = useState(false);
  const [prefillData, setPrefillData]   = useState(null);
  const [selectedPO, setSelectedPO]     = useState(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [parsedPDF, setParsedPDF]       = useState(null);
  const [pdfParsing, setPdfParsing]     = useState(false);
  const pdfInputRef = useRef(null);

  const handlePDFUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.type !== 'application/pdf') return toast.error('Please select a PDF file');
    setPdfParsing(true);
    const toastId = toast.loading('Reading PDF…');
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/purchase-orders/parse-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Parse failed');
      if (!json.data?.items?.length) throw new Error('No line items found in PDF — please check the file');
      toast.success(`Extracted ${json.data.items.length} items from PDF`, { id: toastId });
      setParsedPDF(json.data);
    } catch (err) {
      toast.error(err.message || 'Could not read PDF', { id: toastId });
    } finally {
      setPdfParsing(false);
    }
  };

  useEffect(() => {
    if (location.state?.fromCS) {
      setPrefillData(location.state.fromCS);
      setShowForm(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const { data: poData = [] } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => poAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? []); }),
  });
  const { data: vendorsData = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data ?? d?.vendors ?? []); }),
  });
  const { data: projectsData = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.projects ?? d?.data ?? []); }),
  });
  const { data: detailedPO } = useQuery({
    queryKey: ['purchase-orders', selectedPO?.id],
    queryFn: () => poAPI.get(selectedPO.id).then(r => { const d = r.data; return d?.data ?? d; }),
    enabled: !!selectedPO?.id,
  });

  const createMutation = useMutation({
    mutationFn: d => poAPI.create(d),
    onSuccess: () => {
      toast.success('PO submitted for audit');
      setShowForm(false);
      setPrefillData(null);
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: e => toast.error(e?.response?.data?.error || 'Failed to create PO'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, stage, signature_img }) => poAPI.approve(id, stage, { signature_img }),
    onSuccess: () => {
      toast.success('Authorized successfully');
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['purchase-orders', selectedPO?.id] });
    },
    onError: e => toast.error(e?.response?.data?.error || 'Action failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: id => poAPI.approve(id, 'reject', {}),
    onSuccess: () => {
      toast.success('PO rejected');
      setSelectedPO(null);
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: e => toast.error(e?.response?.data?.error || 'Reject failed'),
  });

  const filtered = poData.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search && !p.po_number?.toLowerCase().includes(search.toLowerCase()) &&
        !p.vendor_name?.toLowerCase().includes(search.toLowerCase()) &&
        !p.project_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ['PO Number', 'Vendor', 'Project', 'PO Date', 'Grand Total', 'Status'];
    const rows = filtered.map(p => [
      p.serial_no_formatted || p.po_number, p.vendor_name, p.project_name,
      fmt(p.po_date), p.grand_total, p.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `PO_Log_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
    toast.success('Exporting PO log…');
  };

  const stats = [
    { key: 'pending',         label: 'Pending Audit',  icon: Clock,        dot: 'bg-yellow-400' },
    { key: 'checked_finance', label: 'Finance OK',      icon: BadgeCheck,   dot: 'bg-indigo-400' },
    { key: 'approved',        label: 'Authorized',      icon: CheckCircle2, dot: 'bg-emerald-400' },
    { key: 'fully_received',  label: 'Received',        icon: Package,      dot: 'bg-green-400' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <ShoppingCart className="w-3.5 h-3.5" /> Procurement
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-400 mt-0.5">4-stage authorization workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 transition-all shadow-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          {/* Hidden file input for PDF */}
          <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePDFUpload} />
          <button onClick={() => pdfInputRef.current?.click()} disabled={pdfParsing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60">
            <FileUp className="w-4 h-4" /> {pdfParsing ? 'Reading PDF…' : 'Import PDF'}
          </button>
          <button onClick={() => { setPrefillData(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> New Purchase Order
          </button>
        </div>
      </div>

      {/* Signature alert */}
      {!user?.signature_url && (
        <div className="mb-5 bg-yellow-50 border border-yellow-200 border-l-4 border-l-yellow-400 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-xs text-yellow-800 font-medium">
            Digital signature required to authorize POs.{' '}
            <Link to="/profile" className="underline font-semibold hover:text-yellow-900">Upload in Profile →</Link>
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ key, label, icon: Icon, dot }) => {
          const count = poData.filter(p => p.status === key).length;
          return (
            <button key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={clsx(
                'bg-white border rounded-xl p-4 text-left shadow-sm transition-all hover:shadow-md',
                statusFilter === key ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
              )}>
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-slate-400" />
                <span className={clsx('w-2 h-2 rounded-full', dot)} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{count}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search PO number, vendor, project…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-all" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            ['all', 'All'],
            ['pending', 'Pending'],
            ['verified_audit', 'Audit OK'],
            ['checked_finance', 'Finance OK'],
            ['released_mgmt', 'Released'],
            ['approved', 'Authorized'],
            ['rejected', 'Rejected'],
          ].map(([val, lbl]) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                statusFilter === val
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
              )}>
              {lbl}
              {val !== 'all' && <span className="ml-1 opacity-70">{poData.filter(p => p.status === val).length}</span>}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto hidden sm:block">{filtered.length} of {poData.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['PO Reference', 'Vendor / Project', 'PO Date', 'Delivery', 'Grand Total', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(po => (
                <tr key={po.id} onClick={() => setSelectedPO(po)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-bold font-mono text-indigo-600 group-hover:underline">
                      {po.serial_no_formatted || po.po_number}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-slate-800 max-w-40 truncate">{po.vendor_name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-40">{po.project_name}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-700">{fmt(po.po_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{fmt(po.delivery_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs font-bold text-slate-800">{inr(po.grand_total)}</div>
                    <div className="text-xs text-slate-400">incl. GST</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-400">No purchase orders found</p>
                    <p className="text-xs text-slate-300 mt-1">Adjust filters or create a new PO</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          Showing {filtered.length} of {poData.length} purchase orders
        </div>
      </div>

      {/* Detail slide-over */}
      {selectedPO && (
        <PODetailPanel
          po={selectedPO}
          detailedPO={detailedPO}
          onClose={() => setSelectedPO(null)}
          onApprove={(stage, signature_img) => {
            approveMutation.mutate({ id: selectedPO.id, stage, signature_img });
          }}
          onReject={() => rejectMutation.mutate(selectedPO.id)}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
          user={user}
        />
      )}

      {/* PDF Import preview modal */}
      {parsedPDF && (
        <PDFImportModal
          parsed={parsedPDF}
          vendors={vendorsData}
          projects={projectsData}
          onClose={() => setParsedPDF(null)}
          onConfirm={prefill => {
            setParsedPDF(null);
            setPrefillData(prefill);
            setShowForm(true);
          }}
        />
      )}

      {/* New PO modal */}
      {showForm && (
        <NewPOModal
          onClose={() => { setShowForm(false); setPrefillData(null); }}
          vendors={vendorsData}
          projects={projectsData}
          onCreate={d => createMutation.mutate(d)}
          isPending={createMutation.isPending}
          prefill={prefillData}
        />
      )}
    </div>
  );
}
