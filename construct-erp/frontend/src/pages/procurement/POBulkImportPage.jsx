// src/pages/procurement/POBulkImportPage.jsx
// Bulk import historical Purchase Orders from scanned PDFs.
// Filenames encode PO number + vendor name: "POTQS042-Bhuwalka & Sons Pvt Ltd.pdf"
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { poAPI, vendorAPI, projectAPI, documentsAPI } from '../../api/client';
import toast from 'react-hot-toast';
import {
  Upload, ChevronLeft, ChevronRight, CheckCircle2,
  SkipForward, AlertCircle, X, FileText, Loader2, Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useOCRExtract } from '../../hooks/useOCRExtract';

const inputCls = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all';

// ── Parse filename → { poNumber, vendorName }
function parseFilename(name) {
  const base = name.replace(/\.pdf$/i, '');
  // Handle "A1" amendments: POTQS041-A1-Inderjeet → poNumber=POTQS041-A1, vendor=Inderjeet
  const a1 = base.match(/^(POTQS\d+(?:-A\d+)?)-(.+)$/i);
  if (a1) return { poNumber: a1[1].toUpperCase(), vendorName: a1[2].trim() };
  // Generic: split on first dash
  const dash = base.indexOf('-');
  if (dash > 0) return { poNumber: base.slice(0, dash).trim(), vendorName: base.slice(dash + 1).trim() };
  return { poNumber: base, vendorName: '' };
}

// ── Fuzzy vendor match
function matchVendor(vendors, name) {
  if (!name || !vendors?.length) return null;
  const n = name.toLowerCase();
  return (
    vendors.find(v => v.name?.toLowerCase() === n) ||
    vendors.find(v => v.name?.toLowerCase().includes(n)) ||
    vendors.find(v => n.includes(v.name?.toLowerCase()))
  );
}

const STATUSES = ['approved', 'pending', 'part_received', 'fully_received', 'rejected'];

export default function POBulkImportPage() {
  const fileInputRef = useRef();

  // ── Step: 'select' | 'review' | 'done'
  const [step, setStep]           = useState('select');
  const [projectId, setProjectId] = useState('');
  const [queue, setQueue]         = useState([]); // { file, poNumber, vendorName, vendorId, objectUrl, form, state }
  const [current, setCurrent]     = useState(0);
  const [saved, setSaved]         = useState([]); // finalised records ready to import
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState(null);

  const { data: vendorsData } = useQuery({ queryKey: ['vendors-all'], queryFn: () => vendorAPI.list({ limit: 500 }) });
  const { data: projectsData } = useQuery({ queryKey: ['projects-all'], queryFn: () => projectAPI.list() });
  const vendors  = vendorsData?.data?.data || vendorsData?.data || [];
  const projects = projectsData?.data?.data || projectsData?.data || [];

  const { extract, ocrLoading } = useOCRExtract();

  const handleAutoExtract = async () => {
    if (!curItem) return;
    toast('Scanning PDF… this takes ~15 seconds', { icon: '🔍' });
    const result = await extract(curItem.file);
    if (!result) { toast.error('Could not read PDF — please fill manually'); return; }
    const updates = {};
    if (result.date)   updates.po_date      = result.date;
    if (result.amount) updates.grand_total   = result.amount;
    if (result.gst)    updates.gst_pct       = result.gst;
    if (Object.keys(updates).length) {
      setQueue(prev => prev.map((q, i) => i === current ? { ...q, form: { ...q.form, ...updates } } : q));
      toast.success(`Extracted: ${Object.keys(updates).join(', ')}`);
    } else {
      toast.error('Could not extract values — please fill manually');
    }
  };

  // ── Cleanup object URLs on unmount
  useEffect(() => () => queue.forEach(q => q.objectUrl && URL.revokeObjectURL(q.objectUrl)), [queue]);

  // ── File selection handler
  const handleFiles = useCallback((files) => {
    const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) { toast.error('No PDF files found'); return; }

    const items = pdfs.map(file => {
      const { poNumber, vendorName } = parseFilename(file.name);
      const matched = matchVendor(vendors, vendorName);
      return {
        file,
        poNumber,
        vendorName,
        vendorId:  matched?.id || '',
        objectUrl: URL.createObjectURL(file),
        state:     'pending', // pending | saved | skipped
        form: {
          po_number:    poNumber,
          vendor_id:    matched?.id || '',
          po_date:      '',
          delivery_date:'',
          quantity:     '',
          unit:         'LS',
          rate:         '',
          grand_total:  '',
          gst_pct:      '18',
          notes:        '',
          subject:      vendorName,
          status:       'approved',
        },
      };
    });
    setQueue(items);
    setCurrent(0);
  }, [vendors]);

  const curItem = queue[current];

  // ── Update form field for current item (auto-calc grand_total from qty×rate×gst)
  const setField = (key, val) => {
    setQueue(prev => prev.map((q, i) => {
      if (i !== current) return q;
      const updated = { ...q.form, [key]: val };
      // Auto-calculate grand total when quantity, rate, or gst_pct changes
      if (['quantity', 'rate', 'gst_pct'].includes(key)) {
        const qty  = parseFloat(key === 'quantity' ? val : updated.quantity) || 0;
        const rate = parseFloat(key === 'rate'     ? val : updated.rate)     || 0;
        const gst  = parseFloat(key === 'gst_pct'  ? val : updated.gst_pct)  || 0;
        if (qty > 0 && rate > 0) {
          const sub = qty * rate;
          updated.grand_total = (sub + sub * gst / 100).toFixed(2);
        }
      }
      return { ...q, form: updated, vendorId: key === 'vendor_id' ? val : q.vendorId };
    }));
  };

  // ── Save current record and advance
  const handleSaveNext = () => {
    const item = queue[current];
    if (!item.form.vendor_id)   { toast.error('Please select a vendor'); return; }
    if (!item.form.po_date)     { toast.error('Please enter the PO / Order Date'); return; }
    if (!item.form.grand_total) { toast.error('Please enter the Grand Total amount'); return; }

    setSaved(prev => [...prev.filter(s => s.po_number !== item.form.po_number), { ...item.form }]);
    setQueue(prev => prev.map((q, i) => i === current ? { ...q, state: 'saved' } : q));
    if (current < queue.length - 1) setCurrent(c => c + 1);
  };

  // ── Skip current
  const handleSkip = () => {
    setQueue(prev => prev.map((q, i) => i === current ? { ...q, state: 'skipped' } : q));
    if (current < queue.length - 1) setCurrent(c => c + 1);
  };

  // ── Final bulk import
  const handleImport = async () => {
    if (!projectId) { toast.error('Please select a project'); return; }
    if (!saved.length) { toast.error('No records to import'); return; }
    setImporting(true);
    try {
      // Step 1: Create all PO records
      const res = await poAPI.bulkImport({ project_id: projectId, records: saved });
      const importResult = res.data;

      // Step 2: Upload PDF for each successfully created PO
      const createdIds = importResult.created_ids || [];
      if (createdIds.length > 0) {
        toast(`Uploading ${createdIds.length} PDF files…`, { icon: '📎' });
        let uploaded = 0;
        for (const { po_number, id } of createdIds) {
          // Find the matching file in the queue by po_number
          const queueItem = queue.find(q => q.form?.po_number === po_number || q.poNumber === po_number);
          if (!queueItem?.file) continue;
          try {
            const fd = new FormData();
            fd.append('file', queueItem.file, queueItem.file.name);
            fd.append('project_id', projectId);
            fd.append('module', 'purchase_order');
            fd.append('module_record_id', id);
            await documentsAPI.upload(fd);
            uploaded++;
          } catch (e) {
            console.warn(`PDF upload failed for ${po_number}:`, e.message);
          }
        }
        importResult.pdfs_uploaded = uploaded;
      }

      setResult(importResult);
      setStep('done');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const savedCount   = queue.filter(q => q.state === 'saved').length;
  const skippedCount = queue.filter(q => q.state === 'skipped').length;
  const pendingCount = queue.filter(q => q.state === 'pending').length;

  // ──────────────────────────── RENDER ────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Bulk Import Purchase Orders</h1>
            <p className="text-xs text-slate-500">Import historical POs from scanned PDFs — filename auto-fills PO# and vendor</p>
          </div>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-6 text-xs font-medium">
        {[['select','1. Select Files'],['review','2. Review & Fill'],['done','3. Import']].map(([s, label]) => (
          <span key={s} className={clsx('pb-1.5 border-b-2 transition-colors',
            step === s ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400')}>
            {label}
          </span>
        ))}
      </div>

      <div className="max-w-screen-xl mx-auto p-6">

        {/* ── STEP 1: SELECT FILES ── */}
        {step === 'select' && (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Project selector */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Select Project <span className="text-red-500">*</span></label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputCls}>
                <option value="">— Choose project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.project_code})</option>)}
              </select>
              <p className="text-xs text-slate-400">All imported POs will be linked to this project.</p>
            </div>

            {/* File drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); setStep('review'); }}
              className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-14 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">Click to select PO PDFs  or drag &amp; drop</p>
              <p className="text-xs text-slate-400 mt-1">Select all PDFs at once · filenames must follow POTQS###-VendorName.pdf</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf" className="hidden"
                onChange={e => { handleFiles(e.target.files); if (e.target.files.length) setStep('review'); }} />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">How it works:</p>
              <p>• Select all PDF files from your PO folder at once</p>
              <p>• Each PDF opens alongside a form — fill in Date, Amount, and GST</p>
              <p>• Save each record, then click "Import All to ERP" at the end</p>
              <p>• Duplicate PO numbers are automatically skipped</p>
            </div>
          </div>
        )}

        {/* ── STEP 2: REVIEW QUEUE ── */}
        {step === 'review' && curItem && (
          <div className="flex gap-4 h-[calc(100vh-180px)]">

            {/* Left: queue list */}
            <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-slate-200 overflow-y-auto">
              <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {queue.length} Files
              </div>
              {queue.map((q, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={clsx('w-full text-left px-3 py-2.5 text-xs flex items-center gap-2 transition-colors',
                    i === current ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50')}>
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                    q.state === 'saved'   ? 'bg-emerald-500' :
                    q.state === 'skipped' ? 'bg-slate-300' : 'bg-amber-400')} />
                  <span className="truncate">{q.poNumber}</span>
                </button>
              ))}
            </div>

            {/* Centre: PDF viewer */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <iframe src={curItem.objectUrl} className="w-full h-full border-0" title="PO PDF" />
            </div>

            {/* Right: form */}
            <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-slate-900 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-sm font-bold text-white">{curItem.poNumber}</p>
                  <p className="text-xs text-slate-400">{current + 1} / {queue.length}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setCurrent(c => Math.min(queue.length - 1, c + 1))} disabled={current === queue.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex text-center text-xs flex-shrink-0">
                <div className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 font-semibold">{savedCount} Saved</div>
                <div className="flex-1 py-1.5 bg-amber-50 text-amber-700 font-semibold">{pendingCount} Pending</div>
                <div className="flex-1 py-1.5 bg-slate-50 text-slate-500 font-semibold">{skippedCount} Skipped</div>
              </div>

              {/* Form fields */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* Auto-Extract button */}
                <button onClick={handleAutoExtract} disabled={ocrLoading}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg py-2 flex items-center justify-center gap-2">
                  {ocrLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning PDF (~15s)…</>
                    : <><Sparkles className="w-3.5 h-3.5" /> Auto-Extract Date &amp; Amount</>}
                </button>
                <p className="text-xs text-slate-400 text-center -mt-1">Reads the PDF using OCR — review &amp; correct after</p>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">PO Number</label>
                  <input value={curItem.form.po_number} onChange={e => setField('po_number', e.target.value)}
                    className={inputCls} placeholder="POTQS001" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor <span className="text-red-500">*</span></label>
                  {!curItem.form.vendor_id && (
                    <p className="text-xs text-amber-600 mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> "{curItem.vendorName}" not matched — select manually
                    </p>
                  )}
                  <select value={curItem.form.vendor_id} onChange={e => setField('vendor_id', e.target.value)} className={inputCls}>
                    <option value="">— Select vendor —</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Order / Release Date <span className="text-red-500">*</span></label>
                  <input type="date" value={curItem.form.po_date} onChange={e => setField('po_date', e.target.value)}
                    className={inputCls} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Delivery Date</label>
                  <input type="date" value={curItem.form.delivery_date} onChange={e => setField('delivery_date', e.target.value)}
                    className={inputCls} />
                </div>

                {/* Quantity / Unit / Rate */}
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-600">Order Item</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                      <input type="number" value={curItem.form.quantity} onChange={e => setField('quantity', e.target.value)}
                        className={inputCls} placeholder="1" step="0.001" min="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
                      <select value={curItem.form.unit} onChange={e => setField('unit', e.target.value)} className={inputCls}>
                        {['LS','Nos','Kg','MT','Sqm','Sqft','Rmt','Rft','Ltr','Cum','Bags','Sets','Lot'].map(u =>
                          <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Rate (₹ per unit)</label>
                    <input type="number" value={curItem.form.rate} onChange={e => setField('rate', e.target.value)}
                      className={inputCls} placeholder="0.00" step="0.01" min="0" />
                  </div>
                  <p className="text-xs text-slate-400">Fill Qty × Rate to auto-calculate total below</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Grand Total (₹) <span className="text-red-500">*</span></label>
                  <input type="number" value={curItem.form.grand_total} onChange={e => setField('grand_total', e.target.value)}
                    className={inputCls} placeholder="0.00" step="0.01" />
                  <p className="text-xs text-slate-400 mt-0.5">Auto-filled from Qty × Rate × GST, or enter manually</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">GST %</label>
                  <div className="flex gap-1 mb-1">
                    {['0','5','12','18','28'].map(p => (
                      <button key={p} onClick={() => setField('gst_pct', p)}
                        className={clsx('px-2 py-1 text-xs rounded font-semibold border transition-colors',
                          curItem.form.gst_pct === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300')}>
                        {p}%
                      </button>
                    ))}
                  </div>
                  <input type="number" value={curItem.form.gst_pct} onChange={e => setField('gst_pct', e.target.value)}
                    className={inputCls} placeholder="18" step="0.01" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description / Subject</label>
                  <input value={curItem.form.subject} onChange={e => setField('subject', e.target.value)}
                    className={inputCls} placeholder="Scope of supply…" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select value={curItem.form.status} onChange={e => setField('status', e.target.value)} className={inputCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea rows={2} value={curItem.form.notes} onChange={e => setField('notes', e.target.value)}
                    className={inputCls} placeholder="Optional notes…" />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex-shrink-0 p-4 border-t border-slate-100 space-y-2">
                <button onClick={handleSaveNext}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Save &amp; Next
                </button>
                <button onClick={handleSkip}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-2">
                  <SkipForward className="w-4 h-4" /> Skip
                </button>

                {savedCount > 0 && (
                  <button onClick={() => setStep('done')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2">
                    {savedCount} Records Ready → Review &amp; Import
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: CONFIRM / DONE ── */}
        {step === 'done' && !result && (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-800">Ready to Import</h2>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{savedCount}</div>
                  <div className="text-xs text-emerald-700 font-medium">Ready to Import</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-slate-400">{skippedCount}</div>
                  <div className="text-xs text-slate-500 font-medium">Skipped</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
                  <div className="text-xs text-amber-700 font-medium">Not Filled</div>
                </div>
              </div>

              {/* Project selector again if empty */}
              {!projectId && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Project <span className="text-red-500">*</span></label>
                  <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputCls}>
                    <option value="">— Choose project —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Preview list */}
              <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
                {saved.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-700">{r.po_number}</span>
                    <span className="text-slate-500">{vendors.find(v => v.id === r.vendor_id)?.name || '—'}</span>
                    <span className="font-semibold text-slate-900">₹{Number(r.grand_total || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('review')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg py-2.5">
                  ← Back to Review
                </button>
                <button onClick={handleImport} disabled={importing || !projectId || !savedCount}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2">
                  {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : `Import ${savedCount} POs to ERP`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result screen */}
        {result && (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <div>
                  <h2 className="text-base font-bold text-slate-800">Import Complete</h2>
                  <p className="text-xs text-slate-500">Purchase Orders have been saved to the ERP</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{result.created}</div>
                  <div className="text-xs text-emerald-700 font-medium">POs Created</div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{result.pdfs_uploaded ?? 0}</div>
                  <div className="text-xs text-indigo-700 font-medium">PDFs Saved</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-slate-400">{result.skipped}</div>
                  <div className="text-xs text-slate-500 font-medium">Skipped (dup)</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">{result.errors?.length || 0}</div>
                  <div className="text-xs text-red-600 font-medium">Errors</div>
                </div>
              </div>

              {result.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-semibold text-red-700 mb-2">Errors:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e.po_number}: {e.reason}</p>
                  ))}
                </div>
              )}

              <a href="/procurement/po"
                className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg py-2.5">
                Go to Purchase Orders →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
