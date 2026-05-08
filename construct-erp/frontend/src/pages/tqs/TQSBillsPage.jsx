import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { tqsBillsAPI, projectAPI, tqsVendorsAPI, poAPI, inventoryAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { FileText, Plus, Search, ChevronRight, X, ChevronUp, ChevronDown, Pencil, Trash2, AlertTriangle } from 'lucide-react';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700' },
  stores:   { label: 'Stores',   cls: 'bg-blue-100 text-blue-700' },
  document_controller: { label: 'Document Controller', cls: 'bg-cyan-100 text-cyan-700' },
  qs:       { label: 'QS',       cls: 'bg-indigo-100 text-indigo-700' },
  procurement: { label: 'Procurement', cls: 'bg-orange-100 text-orange-700' },
  accounts: { label: 'Accounts', cls: 'bg-purple-100 text-purple-700' },
  paid:     { label: 'Paid',     cls: 'bg-emerald-100 text-emerald-700' },
};

const inr = (v) => Math.round(Number(v || 0)).toLocaleString('en-IN');

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const EMPTY_FORM = {
  vendor_id: '', vendor_name: '', project_id: '', bill_type: 'po', tax_mode: 'intrastate',
  work_desc: '', po_id: '', grn_id: '', po_number: '', po_date: '',
  inv_number: '', inv_date: '', inv_month: '',
  received_date: '', basic_amount: '',
  transport_charges: '', transport_gst_pct: '', transport_gst_amt: '', transport_desc: '',
  other_charges: '', other_charges_desc: '',
  credit_note_num: '', credit_note_val: '', remarks: '',
  // transient (not sent to backend)
  cgst_pct: '', sgst_pct: '', igst_pct: '',
};

const EMPTY_ITEM = { category: '', item_name: '', unit: '', quantity: '', rate: '', gst_pct: '18', po_item_id: '', remaining_qty: null };

const F = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white';

function Lbl({ children, req }) {
  return <label className="block text-xs font-medium text-slate-600 mb-1">{children}{req && <span className="text-red-500 ml-0.5">*</span>}</label>;
}

function calcItemRow(it, taxMode) {
  const basic = parseFloat(it.quantity || 0) * parseFloat(it.rate || 0);
  const gstPct = parseFloat(it.gst_pct || 0);
  const mode = taxMode === 'interstate' ? 'interstate' : 'intrastate';
  const gst = basic * gstPct / 100;
  return { basic, gst, total: basic + gst, mode };
}

function NewBillModal({ onClose, projects, defaultProjectId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_FORM, project_id: defaultProjectId || '' });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorList, setShowVendorList] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ['tqs-vendors'],
    queryFn: () => tqsVendorsAPI.list().then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
    staleTime: 60000,
  });

  // Inventory items from Store Ledger — for item-name autocomplete + category auto-fill
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => inventoryAPI.itemsLookup().then(r => r.data?.data ?? []),
    staleTime: 1000 * 60 * 5,
  });

  // Fast lookup map: lowercase material_name → { category, unit }
  const itemLookupMap = React.useMemo(() => {
    const map = {};
    inventoryItems.forEach(item => {
      map[item.material_name.toLowerCase()] = item;
    });
    return map;
  }, [inventoryItems]);

  // Approved POs available for invoicing (filtered by project once selected)
  const { data: availablePOs = [] } = useQuery({
    queryKey: ['tqs-lookup-pos', form.project_id],
    queryFn: () => tqsBillsAPI.lookupPOs(form.project_id ? { project_id: form.project_id } : {})
      .then(r => r.data?.data || []),
    staleTime: 30000,
    enabled: true,
  });

  // When user picks a PO, auto-fill vendor, po_number, po_date AND fetch line items
  const handlePOPick = async (poId) => {
    if (!poId) {
      setForm(f => ({ ...f, po_id: '', grn_id: '' }));
      return;
    }
    const po = availablePOs.find(p => p.id === poId);
    if (!po) return;
    setForm(f => ({
      ...f,
      po_id: po.id,
      po_number: po.po_number || f.po_number,
      po_date: po.po_date ? po.po_date.slice(0, 10) : f.po_date,
      vendor_id: po.vendor_id || f.vendor_id,
      vendor_name: po.vendor_name || f.vendor_name,
      project_id: po.project_id || f.project_id,
      grn_id: '',
    }));
    setVendorSearch(po.vendor_name || '');

    // Fetch PO line items + remaining invoiceable balance
    try {
      const [poRes, balRes] = await Promise.all([
        poAPI.get(poId),
        tqsBillsAPI.lookupPOBalance(poId),
      ]);
      const poData  = poRes.data?.data || poRes.data;
      const poItems = poData?.items || poData?.po_items || [];
      const balMap  = {};
      for (const b of (balRes.data?.data || [])) balMap[b.po_item_id] = b;

      if (poItems.length > 0) {
        setItems(poItems.map(it => {
          const bal = balMap[it.id] || {};
          return {
            category:      '',
            item_name:     it.material_name || it.item_name || it.description || '',
            unit:          it.unit          || '',
            quantity:      bal.remaining_qty != null ? String(bal.remaining_qty) : (it.quantity || ''),
            rate:          it.rate          || '',
            gst_pct:       it.gst_rate != null ? String(it.gst_rate)
                         : it.gst_pct  != null ? String(it.gst_pct) : '18',
            po_item_id:    it.id            || '',
            remaining_qty: bal.remaining_qty != null ? parseFloat(bal.remaining_qty) : null,
          };
        }));
        toast.success(`PO ${po.po_number} linked — ${poItems.length} item${poItems.length > 1 ? 's' : ''} loaded`);
      } else {
        toast.success(`PO ${po.po_number} linked — vendor & project auto-filled`);
      }
    } catch {
      toast.success(`PO ${po.po_number} linked — vendor & project auto-filled`);
    }
  };

  // GRNs against the chosen PO (optional linkage)
  const { data: availableGRNs = [] } = useQuery({
    queryKey: ['tqs-lookup-grns', form.po_id, form.project_id],
    queryFn: () => tqsBillsAPI.lookupGRNs({
      ...(form.po_id ? { po_id: form.po_id } : {}),
      ...(form.project_id ? { project_id: form.project_id } : {}),
    }).then(r => r.data?.data || []),
    enabled: !!(form.po_id || form.project_id),
    staleTime: 30000,
  });

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const selectVendor = (v) => {
    setForm(f => ({ ...f, vendor_name: v.name, vendor_id: v.id }));
    setVendorSearch(v.name);
    setShowVendorList(false);
  };

  const updateItem = (i, k, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  // When item_name is typed/selected: auto-fill category & unit from store ledger
  const handleItemName = (i, value) => {
    const match = itemLookupMap[value.toLowerCase()];
    setItems(p => p.map((it, idx) => {
      if (idx !== i) return it;
      return {
        ...it,
        item_name: value,
        // Category is ONLY set from store ledger — locked once matched, cleared if item changes to no-match
        category: match?.category ?? '',
        unit:     match?.unit     ? match.unit : it.unit,
      };
    }));
  };

  const addItem    = () => setItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));

  // Auto-fill basic_amount from items sum
  const itemsBasic   = items.reduce((s, it) => s + parseFloat(it.quantity || 0) * parseFloat(it.rate || 0), 0);
  const itemsGST     = items.reduce((s, it) => s + calcItemRow(it, form.tax_mode).gst, 0);
  const manualBasic  = parseFloat(form.basic_amount) || 0;
  const effectBasic  = itemsBasic > 0 ? itemsBasic : manualBasic;

  // GST on basic (only used when no line items)
  const noItems = items.every(it => !it.item_name);
  const taxMode = form.tax_mode;
  let cgstPct = 0, sgstPct = 0, igstPct = 0, cgstAmt = 0, sgstAmt = 0, igstAmt = 0, totalGST = 0;
  if (noItems) {
    // manual GST entry via quick buttons — user sets raw totals
    cgstAmt = manualBasic * (parseFloat(form.cgst_pct) || 0) / 100;
    sgstAmt = manualBasic * (parseFloat(form.sgst_pct) || 0) / 100;
    igstAmt = manualBasic * (parseFloat(form.igst_pct) || 0) / 100;
    totalGST = cgstAmt + sgstAmt + igstAmt;
  } else {
    totalGST = itemsGST;
    if (taxMode === 'interstate') { igstPct = 0; igstAmt = totalGST; }
    else { cgstAmt = totalGST / 2; sgstAmt = totalGST / 2; }
  }

  const transportAmt = parseFloat(form.transport_charges) || 0;
  const transportGST = transportAmt * (parseFloat(form.transport_gst_pct) || 0) / 100;
  const otherAmt     = parseFloat(form.other_charges) || 0;
  const grandTotal   = effectBasic + totalGST + transportAmt + transportGST + otherAmt;

  // Quick GST button handler (sets CGST+SGST for intrastate, IGST for interstate)
  const applyGST = (pct, isIGST = false) => {
    if (isIGST) {
      set('tax_mode', 'interstate');
      setForm(f => ({ ...f, tax_mode: 'interstate', cgst_pct: '0', sgst_pct: '0', igst_pct: String(pct) }));
      setItems(p => p.map(it => ({ ...it, gst_pct: String(pct) })));
    } else {
      const half = (pct / 2).toFixed(1);
      setForm(f => ({ ...f, tax_mode: 'intrastate', cgst_pct: half, sgst_pct: half, igst_pct: '0' }));
      setItems(p => p.map(it => ({ ...it, gst_pct: String(pct) })));
    }
  };

  const mutation = useMutation({
    mutationFn: (data) => tqsBillsAPI.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tqs-bills'] });
      toast.success('Bill created');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create bill'),
  });

  // Convert empty strings to 0 for numeric DB columns
  const n = (v) => (v === '' || v == null) ? 0 : parseFloat(v) || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.vendor_name?.trim()) return toast.error('Vendor is required');
    if (!form.inv_number?.trim()) return toast.error('Invoice number is required');
    if (!form.inv_date) return toast.error('Invoice date is required');

    // Client-side PO quantity guard — catch it before the round-trip
    for (const it of items) {
      if (!it.item_name?.trim()) continue;
      if (it.remaining_qty !== null && it.remaining_qty !== undefined) {
        const entered = parseFloat(it.quantity || 0);
        if (entered > it.remaining_qty + 0.0001) {
          return toast.error(
            `"${it.item_name}": quantity ${entered} exceeds available ${it.remaining_qty}. ` +
            `Reduce the quantity or raise a separate bill for the remainder.`
          );
        }
      }
    }

    mutation.mutate({
      ...form,
      // Sanitize every numeric field — Postgres rejects empty strings for numeric columns
      basic_amount:       effectBasic.toFixed(2),
      cgst_pct:           cgstPct,        cgst_amt:          cgstAmt.toFixed(2),
      sgst_pct:           sgstPct,        sgst_amt:          sgstAmt.toFixed(2),
      igst_pct:           igstPct,        igst_amt:          igstAmt.toFixed(2),
      gst_amount:         totalGST.toFixed(2),
      transport_charges:  n(form.transport_charges).toFixed(2),
      transport_gst_pct:  n(form.transport_gst_pct),
      transport_gst_amt:  transportGST.toFixed(2),
      other_charges:      n(form.other_charges).toFixed(2),
      credit_note_val:    n(form.credit_note_val).toFixed(2),
      total_amount:       grandTotal.toFixed(2),
      items:              items.filter(it => it.item_name?.trim()),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-indigo-600 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-white" />
            <h2 className="text-base font-semibold text-white">New Invoice Entry</h2>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── SECTION 1: Vendor & PO Info ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Vendor & PO Information</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Project */}
              <div>
                <Lbl req>Project</Lbl>
                <select className={F} value={form.project_id} onChange={e => set('project_id', e.target.value)} required>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Bill Type */}
              <div>
                <Lbl>Bill Type</Lbl>
                <select className={F} value={form.bill_type} onChange={e => set('bill_type', e.target.value)}>
                  <option value="po">Purchase Order (PO)</option>
                  <option value="wo">Work Order (WO)</option>
                </select>
              </div>

              {/* Vendor combobox */}
              <div className="relative">
                <Lbl req>Vendor / Supplier</Lbl>
                <input
                  className={F}
                  placeholder="Type to search vendors…"
                  value={vendorSearch}
                  onChange={e => { setVendorSearch(e.target.value); set('vendor_name', e.target.value); set('vendor_id', ''); setShowVendorList(true); }}
                  onFocus={() => setShowVendorList(true)}
                  onBlur={() => setTimeout(() => setShowVendorList(false), 150)}
                  required
                />
                {showVendorList && filteredVendors.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                    {filteredVendors.map(v => (
                      <button key={v.id} type="button" onMouseDown={() => selectVendor(v)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 text-slate-700 border-b border-slate-50 last:border-0">
                        <span className="font-medium">{v.name}</span>
                        {v.vendor_type && <span className="ml-2 text-xs text-slate-400">{v.vendor_type}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Work Description — only for WO */}
              {form.bill_type === 'wo' && (
                <div className="col-span-2 md:col-span-3">
                  <Lbl req>Work Description</Lbl>
                  <input className={F} placeholder="Brief description of work done"
                    value={form.work_desc} onChange={e => set('work_desc', e.target.value)} />
                </div>
              )}

              {/* Link to Procurement PO (auto-fills vendor/po#/date) */}
              {form.bill_type === 'po' && (
                <div className="col-span-2 md:col-span-3">
                  <Lbl>Link to Approved PO <span className="text-[10px] text-slate-400 font-normal">(optional — auto-fills vendor & PO details)</span></Lbl>
                  <select className={F} value={form.po_id} onChange={e => handlePOPick(e.target.value)}>
                    <option value="">— Manual entry (no PO link) —</option>
                    {availablePOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} · {po.vendor_name} · ₹{Number(po.total_amount || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* PO/WO Number — editable but auto-filled from PO picker */}
              <div>
                <Lbl>{form.bill_type === 'wo' ? 'WO Number' : 'PO Number'}<span className="text-red-500 ml-0.5">*</span></Lbl>
                <input className={F} placeholder={form.bill_type === 'wo' ? 'WO-2025-001' : 'PO-2025-001'}
                  value={form.po_number} onChange={e => set('po_number', e.target.value)} />
              </div>

              {/* PO Date */}
              <div>
                <Lbl>{form.bill_type === 'wo' ? 'WO Date' : 'PO Date'}</Lbl>
                <input type="date" className={F} value={form.po_date} onChange={e => set('po_date', e.target.value)} />
              </div>

              {/* GRN link (optional, shown only when PO linked and GRNs exist) */}
              {form.bill_type === 'po' && form.po_id && availableGRNs.length > 0 && (
                <div className="col-span-2 md:col-span-3">
                  <Lbl>Link to GRN <span className="text-[10px] text-slate-400 font-normal">(optional — ties invoice to material receipt)</span></Lbl>
                  <select className={F} value={form.grn_id} onChange={e => set('grn_id', e.target.value)}>
                    <option value="">— No GRN link —</option>
                    {availableGRNs.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.serial_no_formatted || g.grn_number} · {g.grn_date?.slice(0,10)} · Qty {Number(g.total_quantity||0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Invoice Number */}
              <div>
                <Lbl req>Invoice Number</Lbl>
                <input className={F} placeholder="INV-001"
                  value={form.inv_number} onChange={e => set('inv_number', e.target.value)} required />
              </div>

              {/* Invoice Date — auto-derives Invoice Month */}
              <div>
                <Lbl req>Invoice Date</Lbl>
                <input type="date" className={F} value={form.inv_date}
                  onChange={e => {
                    const d = e.target.value;
                    const autoMonth = d
                      ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                          .toUpperCase().replace(' ', '-')
                      : '';
                    setForm(f => ({ ...f, inv_date: d, inv_month: autoMonth || f.inv_month }));
                  }}
                  required />
              </div>

              {/* Invoice Month — auto-filled from date, editable */}
              <div>
                <Lbl>Invoice Month</Lbl>
                <input className={F} placeholder="e.g. APRIL-2026"
                  value={form.inv_month} onChange={e => set('inv_month', e.target.value)} />
              </div>

              {/* Received Date */}
              <div>
                <Lbl>Received Date</Lbl>
                <input type="date" className={F} value={form.received_date} onChange={e => set('received_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Invoice Materials (Line Items) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Invoice Materials</p>
              <div className="flex items-center gap-3">
                {/* Tax Mode */}
                <select
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                  value={form.tax_mode} onChange={e => set('tax_mode', e.target.value)}
                >
                  <option value="intrastate">Intrastate (CGST + SGST)</option>
                  <option value="interstate">Interstate (IGST)</option>
                </select>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
            </div>

            {/* GST quick-select */}
            {(() => {
              const isIGST = form.tax_mode === 'interstate';
              const activePct = items.length > 0 && items.every(it => it.gst_pct === items[0].gst_pct)
                ? items[0].gst_pct : null;
              return (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs text-slate-400 self-center">Quick GST:</span>
                  {[0, 5, 12, 18, 28].map(pct => {
                    const active = !isIGST && activePct === String(pct);
                    return (
                      <button key={pct} type="button" onClick={() => applyGST(pct)}
                        className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600'
                        }`}>
                        {pct}%
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => applyGST(18, true)}
                    className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                      isIGST
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'border-amber-200 hover:bg-amber-50 text-amber-700'
                    }`}>
                    IGST 18%
                  </button>
                </div>
              );
            })()}

            {/* Items table */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 font-semibold">Category</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-semibold">Description / Item</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-semibold w-14">Unit</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-semibold w-20">Qty</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-semibold w-24">Rate</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-semibold w-20">Basic</th>
                    <th className="px-3 py-2 text-center text-slate-500 font-semibold w-14">GST%</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-semibold w-20">GST Amt</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-semibold w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const { basic, gst, total } = calcItemRow(it, form.tax_mode);
                    return (
                      <tr key={i} className="border-t border-slate-50">
                        <td className="px-2 py-1.5">
                          <div className={`w-28 px-2 py-1 text-xs rounded border ${it.category ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-400 italic'}`}>
                            {it.category || 'Auto-filled'}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            list={`item-list-${i}`}
                            className="w-full min-w-[140px] border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="Item / material name"
                            value={it.item_name}
                            onChange={e => handleItemName(i, e.target.value)}
                          />
                          <datalist id={`item-list-${i}`}>
                            {inventoryItems.map((item, idx) => (
                              <option key={idx} value={item.material_name} />
                            ))}
                          </datalist>
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-14 border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="Nos"
                            value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          {(() => {
                            const rem = it.remaining_qty;
                            const entered = parseFloat(it.quantity || 0);
                            const exceeded = rem !== null && rem !== undefined && entered > rem + 0.0001;
                            return (
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="number" step="0.001"
                                  max={rem !== null && rem !== undefined ? rem : undefined}
                                  className={`w-20 border rounded px-2 py-1 text-xs text-right outline-none focus:ring-1 ${
                                    exceeded
                                      ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-400'
                                      : 'border-slate-200 focus:ring-indigo-400'
                                  }`}
                                  placeholder="0"
                                  value={it.quantity}
                                  onChange={e => updateItem(i, 'quantity', e.target.value)}
                                />
                                {rem !== null && rem !== undefined && (
                                  <span className={`text-[10px] leading-tight ${exceeded ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                                    {exceeded ? `⚠ max ${rem}` : `Avail: ${rem}`}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" className="w-24 border border-slate-200 rounded px-2 py-1 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="0.00"
                            value={it.rate} onChange={e => updateItem(i, 'rate', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-600 font-medium">{basic > 0 ? basic.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.5" className="w-14 border border-slate-200 rounded px-2 py-1 text-xs text-center outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="18"
                            value={it.gst_pct} onChange={e => updateItem(i, 'gst_pct', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-500">{gst > 0 ? gst.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-slate-700">{total > 0 ? total.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {itemsBasic > 0 && (
                  <tfoot className="bg-indigo-50 border-t border-indigo-100">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-xs text-right font-semibold text-slate-600">Items Total:</td>
                      <td className="px-2 py-2 text-right text-xs font-semibold text-slate-700">{itemsBasic.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td></td>
                      <td className="px-2 py-2 text-right text-xs font-semibold text-slate-500">{itemsGST.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-indigo-700">{(itemsBasic + itemsGST).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Manual basic amount — only when no items */}
            {itemsBasic === 0 && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 mb-2">No line items — enter invoice amount manually:</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Lbl req>Basic Amount (₹)</Lbl>
                    <input type="number" step="0.01" className={F} placeholder="0.00"
                      value={form.basic_amount} onChange={e => set('basic_amount', e.target.value)} />
                  </div>
                  {taxMode === 'intrastate' ? (<>
                    <div>
                      <Lbl>CGST %</Lbl>
                      <input type="number" step="0.5" className={F} placeholder="9"
                        value={form.cgst_pct} onChange={e => set('cgst_pct', e.target.value)} />
                    </div>
                    <div>
                      <Lbl>SGST %</Lbl>
                      <input type="number" step="0.5" className={F} placeholder="9"
                        value={form.sgst_pct} onChange={e => set('sgst_pct', e.target.value)} />
                    </div>
                  </>) : (
                    <div>
                      <Lbl>IGST %</Lbl>
                      <input type="number" step="0.5" className={F} placeholder="18"
                        value={form.igst_pct} onChange={e => set('igst_pct', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 3: Additional Charges ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Additional Charges</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Lbl>Transport Description</Lbl>
                <input className={F} placeholder="e.g. Freight, Delivery…"
                  value={form.transport_desc} onChange={e => set('transport_desc', e.target.value)} />
              </div>
              <div>
                <Lbl>Transport Amount (₹)</Lbl>
                <input type="number" step="0.01" className={F} placeholder="0.00"
                  value={form.transport_charges} onChange={e => set('transport_charges', e.target.value)} />
              </div>
              <div>
                <Lbl>Transport GST %</Lbl>
                <input type="number" step="0.5" className={F} placeholder="18"
                  value={form.transport_gst_pct} onChange={e => set('transport_gst_pct', e.target.value)} />
              </div>
              <div>
                <Lbl>Transport GST Amt</Lbl>
                <input type="number" className={F + ' bg-slate-100 text-slate-500'} readOnly
                  value={transportGST > 0 ? transportGST.toFixed(2) : ''} placeholder="Auto" />
              </div>
              <div>
                <Lbl>Other Charges Description</Lbl>
                <input className={F} placeholder="e.g. Packing, Insurance…"
                  value={form.other_charges_desc} onChange={e => set('other_charges_desc', e.target.value)} />
              </div>
              <div>
                <Lbl>Other Charges (₹)</Lbl>
                <input type="number" step="0.01" className={F} placeholder="0.00"
                  value={form.other_charges} onChange={e => set('other_charges', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── SECTION 4: Credit Note ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Credit Note (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl>Credit Note Number</Lbl>
                <input className={F} placeholder="CN-001"
                  value={form.credit_note_num} onChange={e => set('credit_note_num', e.target.value)} />
              </div>
              <div>
                <Lbl>Credit Note Value (₹)</Lbl>
                <input type="number" step="0.01" className={F} placeholder="0.00"
                  value={form.credit_note_val} onChange={e => set('credit_note_val', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── SECTION 5: Invoice Totals (read-only) ── */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-3">Invoice Totals</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-0.5">Basic Amount</p>
                <p className="font-bold text-slate-800">₹{effectBasic.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              {taxMode === 'intrastate' ? (<>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-0.5">CGST</p>
                  <p className="font-semibold text-slate-700">₹{(totalGST / 2).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-0.5">SGST</p>
                  <p className="font-semibold text-slate-700">₹{(totalGST / 2).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                </div>
              </>) : (
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-0.5">IGST</p>
                  <p className="font-semibold text-slate-700">₹{totalGST.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                </div>
              )}
              {(transportAmt > 0 || otherAmt > 0) && (
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Extra Charges</p>
                  <p className="font-semibold text-slate-700">₹{(transportAmt + transportGST + otherAmt).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                </div>
              )}
            </div>
            <div className="border-t border-indigo-200 pt-3 text-right">
              <span className="text-sm text-slate-600 mr-3">Total Invoice Amount:</span>
              <span className="text-xl font-bold text-indigo-700">₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* ── SECTION 6: Remarks ── */}
          <div>
            <Lbl>Remarks / Notes</Lbl>
            <textarea rows={2} className={F + ' resize-none'}
              placeholder="Any initial remarks…"
              value={form.remarks} onChange={e => set('remarks', e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-100">Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
            {mutation.isPending ? 'Saving…' : 'Create Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}

const COLUMNS = [
  { key: 'sl_number',       label: 'SL No',       align: 'left'  },
  { key: 'vendor_name',     label: 'Vendor',       align: 'left'  },
  { key: 'inv_number',      label: 'Invoice #',    align: 'left'  },
  { key: 'inv_date',        label: 'Inv Date',     align: 'left'  },
  { key: 'inv_month',       label: 'Month',        align: 'left'  },
  { key: 'po_number',       label: 'PO / WO',      align: 'left'  },
  { key: 'basic_amount',    label: 'Basic (₹)',    align: 'right' },
  { key: 'gst_amount',      label: 'GST (₹)',      align: 'right' },
  { key: 'total_amount',    label: 'Total (₹)',    align: 'right' },
  { key: 'certified_net',   label: 'Certified (₹)',align: 'right' },
  { key: 'paid_amount',     label: 'Paid (₹)',     align: 'right' },
  { key: 'workflow_status', label: 'Status',       align: 'left'  },
];

const trailingNum = (s) => { const m = String(s || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };

function sortRows(rows, col, dir) {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    let av = a[col], bv = b[col];
    // SL number — extract trailing integer for proper 1,2,3…10,11 order
    if (col === 'sl_number') {
      av = trailingNum(av); bv = trailingNum(bv);
      return dir === 'asc' ? av - bv : bv - av;
    }
    // numeric columns
    if (['basic_amount','gst_amount','total_amount','certified_net','paid_amount'].includes(col)) {
      av = parseFloat(av) || 0; bv = parseFloat(bv) || 0;
      return dir === 'asc' ? av - bv : bv - av;
    }
    // date
    if (col === 'inv_date') {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
      return dir === 'asc' ? av - bv : bv - av;
    }
    // string
    av = (av || '').toLowerCase(); bv = (bv || '').toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Edit Bill Modal ────────────────────────────────────────────────────────────
function EditBillModal({ bill, projects, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    vendor_name:      bill.vendor_name       || '',
    vendor_id:        bill.vendor_id         || '',
    project_id:       bill.project_id        || '',
    po_number:        bill.po_number         || '',
    po_date:          bill.po_date           ? bill.po_date.slice(0, 10) : '',
    inv_number:       bill.inv_number        || '',
    inv_date:         bill.inv_date          ? bill.inv_date.slice(0, 10) : '',
    inv_month:        bill.inv_month         || '',
    received_date:    bill.received_date     ? bill.received_date.slice(0, 10) : '',
    bill_type:        bill.bill_type         || 'po',
    work_desc:        bill.work_desc         || '',
    tax_mode:         bill.tax_mode          || 'intrastate',
    basic_amount:     bill.basic_amount      || '',
    cgst_pct:         bill.cgst_pct          || '9',
    sgst_pct:         bill.sgst_pct          || '9',
    igst_pct:         bill.igst_pct          || '0',
    transport_charges:bill.transport_charges || '',
    transport_gst_pct:bill.transport_gst_pct || '',
    other_charges:    bill.other_charges     || '',
    credit_note_num:  bill.credit_note_num   || '',
    credit_note_val:  bill.credit_note_val   || '',
    remarks:          bill.remarks           || '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Live calculations ─────────────────────────────────────────────────────
  const basicAmt     = parseFloat(form.basic_amount)      || 0;
  const taxMode      = form.tax_mode;
  const cgstAmt      = taxMode === 'intrastate' ? basicAmt * (parseFloat(form.cgst_pct) || 0) / 100 : 0;
  const sgstAmt      = taxMode === 'intrastate' ? basicAmt * (parseFloat(form.sgst_pct) || 0) / 100 : 0;
  const igstAmt      = taxMode === 'interstate' ? basicAmt * (parseFloat(form.igst_pct) || 0) / 100 : 0;
  const totalGST     = cgstAmt + sgstAmt + igstAmt;
  const transportAmt = parseFloat(form.transport_charges)  || 0;
  const transportGST = transportAmt * (parseFloat(form.transport_gst_pct) || 0) / 100;
  const otherAmt     = parseFloat(form.other_charges)      || 0;
  const creditVal    = parseFloat(form.credit_note_val)    || 0;
  const grandTotal   = basicAmt + totalGST + transportAmt + transportGST + otherAmt - creditVal;

  // Quick GST buttons
  const applyGST = (pct, isIGST = false) => {
    if (isIGST) {
      setForm(f => ({ ...f, tax_mode: 'interstate', cgst_pct: '0', sgst_pct: '0', igst_pct: String(pct) }));
    } else {
      const half = (pct / 2).toFixed(1);
      setForm(f => ({ ...f, tax_mode: 'intrastate', cgst_pct: half, sgst_pct: half, igst_pct: '0' }));
    }
  };

  const updateMut = useMutation({
    mutationFn: (data) => tqsBillsAPI.update(bill.id, data),
    onSuccess: () => {
      toast.success('Bill updated');
      qc.invalidateQueries({ queryKey: ['tqs-bills'] });
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Update failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.vendor_name?.trim()) return toast.error('Vendor is required');
    if (!form.inv_number?.trim())  return toast.error('Invoice number is required');
    if (!form.inv_date)            return toast.error('Invoice date is required');

    updateMut.mutate({
      ...form,
      basic_amount:      basicAmt.toFixed(2),
      cgst_pct:          taxMode === 'intrastate' ? parseFloat(form.cgst_pct) || 0 : 0,
      cgst_amt:          cgstAmt.toFixed(2),
      sgst_pct:          taxMode === 'intrastate' ? parseFloat(form.sgst_pct) || 0 : 0,
      sgst_amt:          sgstAmt.toFixed(2),
      igst_pct:          taxMode === 'interstate' ? parseFloat(form.igst_pct) || 0 : 0,
      igst_amt:          igstAmt.toFixed(2),
      gst_amount:        totalGST.toFixed(2),
      transport_charges: transportAmt.toFixed(2),
      transport_gst_pct: parseFloat(form.transport_gst_pct) || 0,
      transport_gst_amt: transportGST.toFixed(2),
      other_charges:     otherAmt.toFixed(2),
      credit_note_val:   creditVal.toFixed(2),
      total_amount:      grandTotal.toFixed(2),
    });
  };

  const inrFmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-indigo-600 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <Pencil className="w-4 h-4 text-white" />
            <div>
              <h2 className="text-sm font-semibold text-white">Edit Bill — SL #{bill.sl_number}</h2>
              <p className="text-xs text-indigo-200">{bill.vendor_name} · {bill.inv_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── SECTION 1: Bill Info ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Bill Information</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Lbl req>Vendor Name</Lbl>
                <input className={F} value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} />
              </div>
              <div>
                <Lbl req>Invoice Number</Lbl>
                <input className={F} value={form.inv_number} onChange={e => set('inv_number', e.target.value)} />
              </div>
              <div>
                <Lbl req>Invoice Date</Lbl>
                <input type="date" className={F} value={form.inv_date}
                  onChange={e => {
                    const d = e.target.value;
                    const autoMonth = d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase().replace(' ', '-') : '';
                    setForm(f => ({ ...f, inv_date: d, inv_month: autoMonth || f.inv_month }));
                  }} />
              </div>
              <div>
                <Lbl>Invoice Month</Lbl>
                <input className={F} placeholder="e.g. APRIL-2026" value={form.inv_month} onChange={e => set('inv_month', e.target.value)} />
              </div>
              <div>
                <Lbl>PO / WO Number</Lbl>
                <input className={F} value={form.po_number} onChange={e => set('po_number', e.target.value)} />
              </div>
              <div>
                <Lbl>PO / WO Date</Lbl>
                <input type="date" className={F} value={form.po_date} onChange={e => set('po_date', e.target.value)} />
              </div>
              <div>
                <Lbl>Received Date</Lbl>
                <input type="date" className={F} value={form.received_date} onChange={e => set('received_date', e.target.value)} />
              </div>
              <div>
                <Lbl>Bill Type</Lbl>
                <select className={F} value={form.bill_type} onChange={e => set('bill_type', e.target.value)}>
                  <option value="po">Purchase Order (PO)</option>
                  <option value="wo">Work Order (WO)</option>
                  <option value="service">Service</option>
                  <option value="advance">Advance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {projects.length > 0 && (
                <div className="col-span-2">
                  <Lbl>Project</Lbl>
                  <select className={F} value={form.project_id} onChange={e => set('project_id', e.target.value)}>
                    <option value="">— Select Project —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {form.bill_type === 'wo' && (
                <div className="col-span-2">
                  <Lbl>Work Description</Lbl>
                  <input className={F} value={form.work_desc} onChange={e => set('work_desc', e.target.value)} placeholder="Brief description of work done" />
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 2: GST & Amounts ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Invoice Amounts & GST</p>
              <select
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                value={form.tax_mode} onChange={e => set('tax_mode', e.target.value)}
              >
                <option value="intrastate">Intrastate (CGST + SGST)</option>
                <option value="interstate">Interstate (IGST)</option>
              </select>
            </div>

            {/* Quick GST buttons */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-xs text-slate-400 self-center">Quick GST:</span>
              {[0, 5, 12, 18, 28].map(pct => {
                const active = taxMode === 'intrastate' &&
                  parseFloat(form.cgst_pct) * 2 === pct;
                return (
                  <button key={pct} type="button" onClick={() => applyGST(pct)}
                    className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                      active ? 'bg-indigo-600 text-white border-indigo-600'
                             : 'border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600'
                    }`}>
                    {pct}%
                  </button>
                );
              })}
              <button type="button" onClick={() => applyGST(18, true)}
                className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                  taxMode === 'interstate' ? 'bg-amber-500 text-white border-amber-500'
                                          : 'border-amber-200 hover:bg-amber-50 text-amber-700'
                }`}>
                IGST 18%
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Basic Amount */}
              <div>
                <Lbl req>Basic Amount (₹)</Lbl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <input type="number" step="0.01" className={F + ' pl-7'} placeholder="0.00"
                    value={form.basic_amount} onChange={e => set('basic_amount', e.target.value)} />
                </div>
              </div>

              {/* GST inputs — intrastate */}
              {taxMode === 'intrastate' ? (<>
                <div>
                  <Lbl>CGST %</Lbl>
                  <input type="number" step="0.5" className={F} placeholder="9"
                    value={form.cgst_pct} onChange={e => set('cgst_pct', e.target.value)} />
                  <p className="text-xs text-indigo-600 font-semibold mt-1">
                    = ₹{inrFmt(cgstAmt)} <span className="text-slate-400 font-normal">(auto)</span>
                  </p>
                </div>
                <div>
                  <Lbl>SGST %</Lbl>
                  <input type="number" step="0.5" className={F} placeholder="9"
                    value={form.sgst_pct} onChange={e => set('sgst_pct', e.target.value)} />
                  <p className="text-xs text-indigo-600 font-semibold mt-1">
                    = ₹{inrFmt(sgstAmt)} <span className="text-slate-400 font-normal">(auto)</span>
                  </p>
                </div>
              </>) : (
                <div>
                  <Lbl>IGST %</Lbl>
                  <input type="number" step="0.5" className={F} placeholder="18"
                    value={form.igst_pct} onChange={e => set('igst_pct', e.target.value)} />
                  <p className="text-xs text-amber-600 font-semibold mt-1">
                    = ₹{inrFmt(igstAmt)} <span className="text-slate-400 font-normal">(auto)</span>
                  </p>
                </div>
              )}

              {/* Transport */}
              <div>
                <Lbl>Transport Charges (₹)</Lbl>
                <input type="number" step="0.01" className={F} placeholder="0.00"
                  value={form.transport_charges} onChange={e => set('transport_charges', e.target.value)} />
              </div>
              <div>
                <Lbl>Transport GST %</Lbl>
                <input type="number" step="0.5" className={F} placeholder="18"
                  value={form.transport_gst_pct} onChange={e => set('transport_gst_pct', e.target.value)} />
                {transportGST > 0 && (
                  <p className="text-xs text-slate-500 mt-1">= ₹{inrFmt(transportGST)}</p>
                )}
              </div>

              {/* Other & Credit */}
              <div>
                <Lbl>Other Charges (₹)</Lbl>
                <input type="number" step="0.01" className={F} placeholder="0.00"
                  value={form.other_charges} onChange={e => set('other_charges', e.target.value)} />
              </div>
              <div>
                <Lbl>Credit Note Number</Lbl>
                <input className={F} placeholder="CN-001"
                  value={form.credit_note_num} onChange={e => set('credit_note_num', e.target.value)} />
              </div>
              <div>
                <Lbl>Credit Note Value (₹)</Lbl>
                <input type="number" step="0.01" className={F} placeholder="0.00"
                  value={form.credit_note_val} onChange={e => set('credit_note_val', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── SECTION 3: Live Totals ── */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-3">Invoice Totals (Live)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <div className="text-center bg-white rounded-lg p-2.5 border border-indigo-100">
                <p className="text-xs text-slate-500 mb-0.5">Basic Amount</p>
                <p className="font-bold text-slate-800">₹{inrFmt(basicAmt)}</p>
              </div>
              {taxMode === 'intrastate' ? (<>
                <div className="text-center bg-white rounded-lg p-2.5 border border-indigo-100">
                  <p className="text-xs text-slate-500 mb-0.5">CGST ({form.cgst_pct || 0}%)</p>
                  <p className="font-semibold text-indigo-700">₹{inrFmt(cgstAmt)}</p>
                </div>
                <div className="text-center bg-white rounded-lg p-2.5 border border-indigo-100">
                  <p className="text-xs text-slate-500 mb-0.5">SGST ({form.sgst_pct || 0}%)</p>
                  <p className="font-semibold text-indigo-700">₹{inrFmt(sgstAmt)}</p>
                </div>
              </>) : (
                <div className="text-center bg-white rounded-lg p-2.5 border border-amber-100">
                  <p className="text-xs text-slate-500 mb-0.5">IGST ({form.igst_pct || 0}%)</p>
                  <p className="font-semibold text-amber-700">₹{inrFmt(igstAmt)}</p>
                </div>
              )}
              <div className="text-center bg-white rounded-lg p-2.5 border border-indigo-100">
                <p className="text-xs text-slate-500 mb-0.5">Total GST</p>
                <p className="font-semibold text-slate-700">₹{inrFmt(totalGST)}</p>
              </div>
            </div>
            {(transportAmt > 0 || otherAmt > 0 || creditVal > 0) && (
              <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                {transportAmt > 0 && (
                  <div className="text-center bg-white rounded-lg p-2 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-0.5">Transport + GST</p>
                    <p className="font-semibold text-slate-700">₹{inrFmt(transportAmt + transportGST)}</p>
                  </div>
                )}
                {otherAmt > 0 && (
                  <div className="text-center bg-white rounded-lg p-2 border border-slate-100">
                    <p className="text-xs text-slate-500 mb-0.5">Other Charges</p>
                    <p className="font-semibold text-slate-700">₹{inrFmt(otherAmt)}</p>
                  </div>
                )}
                {creditVal > 0 && (
                  <div className="text-center bg-white rounded-lg p-2 border border-red-100">
                    <p className="text-xs text-slate-500 mb-0.5">Credit Note</p>
                    <p className="font-semibold text-red-600">− ₹{inrFmt(creditVal)}</p>
                  </div>
                )}
              </div>
            )}
            <div className="border-t border-indigo-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Total Invoice Amount:</span>
              <span className="text-2xl font-black text-indigo-700">₹{inrFmt(grandTotal)}</span>
            </div>
          </div>

          {/* ── SECTION 4: Remarks ── */}
          <div>
            <Lbl>Remarks / Notes</Lbl>
            <textarea rows={2} className={F + ' resize-none'}
              placeholder="Any remarks…"
              value={form.remarks} onChange={e => set('remarks', e.target.value)} />
          </div>

        </form>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={updateMut.isPending}
            className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-60 transition-colors flex items-center gap-2">
            {updateMut.isPending ? 'Saving…' : <><Pencil className="w-3.5 h-3.5" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TQSBillsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);   // bill object to edit
  const [deleteTarget, setDeleteTarget] = useState(null); // bill object pending delete confirmation
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [sortCol, setSortCol] = useState('sl_number');
  const [sortDir, setSortDir] = useState('desc');

  const deleteMut = useMutation({
    mutationFn: (id) => tqsBillsAPI.delete(id),
    onSuccess: () => {
      toast.success('Bill deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['tqs-bills'] });
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Delete failed'),
  });

  // Sync status filter with URL search params so sidebar links switch the view
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    setStatusFilter(urlStatus);
  }, [searchParams]);

  const handleSort = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  };

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectAPI.list().then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d?.projects ?? d?.data ?? []);
    }),
  });

  // Auto-select the only project when there's exactly one
  useEffect(() => {
    if (projects.length === 1 && !projectFilter) {
      setProjectFilter(projects[0].id);
    }
  }, [projects]);

  const activeProject = projects.find(p => p.id === projectFilter) || null;

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['tqs-bills', { search, projectFilter, statusFilter }],
    queryFn: () => tqsBillsAPI.list({
      search: search || undefined,
      project_id: projectFilter || undefined,
      status: statusFilter || undefined,
    }).then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
  });

  const sorted = sortRows(bills, sortCol, sortDir);

  const kpiPending  = bills.filter(b => b.workflow_status === 'pending').length;
  const kpiStores   = bills.filter(b => b.workflow_status === 'stores').length;
  const kpiQS       = bills.filter(b => b.workflow_status === 'qs').length;
  const kpiAccounts = bills.filter(b => b.workflow_status === 'accounts').length;
  const kpiPaid     = bills.filter(b => b.workflow_status === 'paid').length;
  const totalValue  = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const paidValue   = bills.filter(b => b.workflow_status === 'paid').reduce((s, b) => s + parseFloat(b.paid_amount || 0), 0);

  const KPI = ({ label, value, sub, statusKey, color = 'indigo' }) => {
    const active = statusKey !== undefined && statusFilter === statusKey;
    const colors = {
      indigo: 'bg-indigo-600', amber: 'bg-amber-500', emerald: 'bg-emerald-500',
      blue: 'bg-blue-500', purple: 'bg-purple-500', rose: 'bg-rose-500',
    };
    return (
      <button
        onClick={() => statusKey !== undefined && setStatusFilter(p => p === statusKey ? '' : statusKey)}
        className={`bg-white rounded-xl border p-3 text-left transition-all hover:shadow-md ${active ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-100'}`}
      >
        <div className={`inline-block w-2 h-2 rounded-full ${colors[color]} mb-2`} />
        <div className="text-xl font-black text-slate-800">{value}</div>
        <div className="text-xs font-semibold text-slate-600">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </button>
    );
  };

  const inrCr = (v) => {
    const n = parseFloat(v) || 0;
    if (n >= 1e7) return `₹${(n/1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `₹${(n/1e5).toFixed(2)} L`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  };

  return (
    <div className="p-4 space-y-4 bg-[#f4f6f9] min-h-full">

      {/* ── Project Banner ── */}
      {activeProject && (
        <div className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-5 py-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Active Project</div>
            <div className="text-base font-black truncate">{activeProject.name}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-indigo-200 font-semibold">TOTAL VALUE</div>
            <div className="text-lg font-black">{inrCr(totalValue)}</div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="ml-2 flex items-center gap-1.5 px-4 py-2 bg-white text-indigo-700 text-sm font-black rounded-lg hover:bg-indigo-50 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> New Bill
          </button>
        </div>
      )}

      {/* Fallback header when no project selected */}
      {!activeProject && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">TQS Invoice Tracker</h1>
              <p className="text-xs text-slate-500">Select a project to view bills</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg">
            <Plus className="w-4 h-4" /> New Bill
          </button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        <KPI label="Total Bills"   value={bills.length}   sub={inrCr(totalValue)}  color="indigo" />
        <KPI label="Pending"       value={kpiPending}     statusKey="pending"      color="amber" />
        <KPI label="At Stores"     value={kpiStores}      statusKey="stores"       color="blue" />
        <KPI label="At QS"         value={kpiQS}          statusKey="qs"           color="purple" />
        <KPI label="At Accounts"   value={kpiAccounts}    statusKey="accounts"     color="rose" />
        <KPI label="Paid"          value={kpiPaid}        statusKey="paid"         sub={inrCr(paidValue)} color="emerald" />
        <KPI label="In Progress"   value={bills.length - kpiPaid - kpiPending} statusKey="" color="indigo" />
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="Search SL no, invoice #, vendor…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {/* Project selector */}
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
          value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Status pills */}
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key}
              onClick={() => setStatusFilter(p => p === key ? '' : key)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                statusFilter === key ? cfg.cls + ' border-current shadow-sm' : 'border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100'
              }`}>
              {cfg.label}
            </button>
          ))}
          {(search || statusFilter) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 px-2">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="ml-auto text-xs text-slate-400 font-medium">
          {sorted.length} bill{sorted.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-slate-800 text-white">
              {COLUMNS.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide cursor-pointer select-none hover:bg-slate-700 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortCol === col.key ? (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-300" /> : <ChevronDown className="w-3 h-3 text-indigo-300" />
                    ) : (
                      <span className="flex flex-col opacity-30">
                        <ChevronUp className="w-2.5 h-2.5 -mb-0.5" />
                        <ChevronDown className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-xs font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  {Array.from({ length: COLUMNS.length + 1 }).map((__, j) => (
                    <td key={j} className="px-3 py-2.5"><div className="h-3.5 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-14 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-semibold">No bills found</p>
                  <p className="text-xs mt-1 text-slate-400">Create your first TQS bill to get started</p>
                </td>
              </tr>
            ) : sorted.map((b, idx) => (
              <tr key={b.id}
                className={`cursor-pointer transition-colors hover:bg-indigo-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                onClick={() => navigate(`/tqs/bills/${b.id}`)}>
                <td className="px-3 py-2 font-black font-mono text-xs text-indigo-700">{b.sl_number}</td>
                <td className="px-3 py-2 font-semibold text-slate-800 max-w-[170px] truncate">{b.vendor_name}</td>
                <td className="px-3 py-2 text-slate-600 font-mono text-xs">{b.inv_number}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{b.inv_date ? new Date(b.inv_date).toLocaleDateString('en-IN') : '—'}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{b.inv_month || '—'}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{b.po_number || '—'}</td>
                <td className="px-3 py-2 text-right text-slate-700 font-medium">₹{inr(b.basic_amount)}</td>
                <td className="px-3 py-2 text-right text-slate-500">₹{inr(b.gst_amount)}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">₹{inr(b.total_amount)}</td>
                <td className="px-3 py-2 text-right text-indigo-600 font-semibold">{b.certified_net ? `₹${inr(b.certified_net)}` : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{b.paid_amount && parseFloat(b.paid_amount) > 0 ? `₹${inr(b.paid_amount)}` : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2"><StatusBadge status={b.workflow_status} /></td>
                <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button title="Edit" onClick={() => setEditingBill(b)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button title="Delete" onClick={() => setDeleteTarget(b)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-200 ml-0.5" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Summary footer */}
          {sorted.length > 0 && (
            <tfoot>
              <tr className="bg-slate-800 text-white">
                <td colSpan={6} className="px-3 py-2.5 text-xs font-bold text-right text-slate-300">
                  TOTALS ({sorted.length} bills)
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-black">
                  ₹{inr(sorted.reduce((s,b) => s + parseFloat(b.basic_amount||0), 0))}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-300">
                  ₹{inr(sorted.reduce((s,b) => s + parseFloat(b.gst_amount||0), 0))}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-black text-yellow-300">
                  ₹{inr(sorted.reduce((s,b) => s + parseFloat(b.total_amount||0), 0))}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-black text-indigo-300">
                  ₹{inr(sorted.reduce((s,b) => s + parseFloat(b.certified_net||0), 0))}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-black text-emerald-300">
                  ₹{inr(sorted.reduce((s,b) => s + parseFloat(b.paid_amount||0), 0))}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModal && (
        <NewBillModal
          onClose={() => setShowModal(false)}
          projects={projects}
          defaultProjectId={projectFilter || (projects.length === 1 ? projects[0].id : '')}
        />
      )}

      {/* ── Edit Bill Modal ── */}
      {editingBill && (
        <EditBillModal
          bill={editingBill}
          projects={projects}
          onClose={() => setEditingBill(null)}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Delete Bill?</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  SL #{deleteTarget.sl_number} · {deleteTarget.vendor_name} · Inv {deleteTarget.inv_number}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">This action cannot be undone. All line items and workflow history for this bill will be permanently removed.</p>
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-60"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
