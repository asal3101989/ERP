// MBPrintDocument.jsx — Full Measurement Book Print Layout
// Rendered off-screen and used by react-to-print. Covers all 3 sections:
//   1. Cover Sheet
//   2. Measurement Detail (one page-break section per BOQ item)
//   3. Abstract of Measurements

import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

// ── helpers ──────────────────────────────────────────────────────────────────

const num  = (v) => parseFloat(v || 0);
const GST  = 0.09;

const fmtN = (v, d = 2) =>
  num(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtQ = (v) => fmtN(v, 3);

const fmtDate = (d) =>
  d ? dayjs(d).format('DD-MM-YYYY') : '—';

// ── Inline style helpers (tailwind won't be available in react-to-print iframe context on some setups) ──
const S = {
  page: {
    fontFamily: 'Arial, sans-serif',
    fontSize: '11px',
    color: '#1a1c21',
    lineHeight: 1.4,
    padding: '24px 28px',
  },
  pageBreak: { pageBreakBefore: 'always' },
  noBreak:   { pageBreakInside: 'avoid' },

  // Header banner
  banner:    { background: '#1F3864', color: '#fff', padding: '14px 20px', marginBottom: 0 },
  subBanner: { background: '#2E75B6', color: '#fff', padding: '6px 20px', marginBottom: '16px' },

  // Table
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: '10px' },
  th:        { background: '#1F3864', color: '#fff', padding: '5px 6px', border: '1px solid #2E75B6', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' },
  th2:       { background: '#2E75B6', color: '#fff', padding: '5px 6px', border: '1px solid #1F3864', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' },
  tdC:       { padding: '4px 6px', border: '1px solid #e2e6ec', textAlign: 'center', fontSize: '10px' },
  tdL:       { padding: '4px 6px', border: '1px solid #e2e6ec', textAlign: 'left',   fontSize: '10px' },
  tdR:       { padding: '4px 6px', border: '1px solid #e2e6ec', textAlign: 'right',  fontSize: '10px', fontFamily: 'monospace' },
  tdHl:      { padding: '4px 6px', border: '1px solid #bbdefb', textAlign: 'right',  fontSize: '10px', fontFamily: 'monospace', background: '#e3f2fd', fontWeight: 'bold', color: '#1565c0' },

  // Label / value pairs
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: '12px' },
  label: { fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '2px' },
  value: { fontSize: '11px', color: '#1a1c21', borderBottom: '1px solid #e2e6ec', paddingBottom: '4px', minHeight: '20px' },

  // Summary row
  totRow: { background: '#1F3864', color: '#fff' },
  subRow: { background: '#2E75B6', color: '#fff' },
  gstRow: { background: '#e8f5e9', color: '#2e7d32' },
};

// ── SECTION 1: COVER SHEET ───────────────────────────────────────────────────

function PrintCover({ cover, project }) {
  return (
    <div style={S.page}>
      {/* Banner */}
      <div style={S.banner}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.3em', color: '#93c5fd', textTransform: 'uppercase', marginBottom: '4px' }}>
            BCIM ENGINEERING PRIVATE LIMITED
          </div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.08em' }}>MEASUREMENT BOOK</div>
          <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '4px', fontStyle: 'italic' }}>
            Running Account Bill – Civil / MEP Works
          </div>
        </div>
      </div>
      <div style={S.subBanner}>
        <span style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          Project &amp; Bill Details — Form MB-01
        </span>
      </div>

      {/* Project read-only fields */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e2e6ec', paddingBottom: '4px', marginBottom: '10px' }}>
          Project Information
        </div>
        <div style={S.grid2}>
          {[
            ['Project Name',    project?.name || '—'],
            ['Client / Owner',  project?.client_name || project?.owner || '—'],
            ['Site / Location', project?.location || project?.site_address || '—'],
            ['Work Order No.',  project?.work_order_number || cover?.wo_number || '—'],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <span style={S.label}>{lbl}</span>
              <div style={S.value}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bill editable fields */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e2e6ec', paddingBottom: '4px', marginBottom: '10px' }}>
          Bill Details
        </div>
        <div style={S.grid2}>
          {[
            ['RA Bill No.',        cover?.ra_bill_no    || '—'],
            ['Invoice Ref.',       cover?.invoice_ref   || '—'],
            ['Bill Period From',   fmtDate(cover?.bill_period_from)],
            ['Bill Period To',     fmtDate(cover?.bill_period_to)],
            ['Date of Invoice',    fmtDate(cover?.date_of_invoice)],
            ['Package / Description', cover?.package_desc || '—'],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <span style={S.label}>{lbl}</span>
              <div style={S.value}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Signature block */}
      <div style={{ borderTop: '1px solid #e2e6ec', paddingTop: '16px' }}>
        <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
          Authorisation
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          {[
            ['Prepared By (QS)', cover?.prepared_by],
            ['Checked By',       cover?.checked_by],
            ['Approved By',      cover?.approved_by],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ textAlign: 'center' }}>
              <span style={S.label}>{lbl}</span>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '30px', minHeight: '18px' }}>{val || ''}</div>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '9px', color: '#94a3b8' }}>
                Signature &amp; Date
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meta strip */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
        <span>WO: {project?.work_order_number || '—'} · Bill: {cover?.ra_bill_no || '—'}</span>
        <span>Invoice: {cover?.invoice_ref || '—'}</span>
        <span>Printed: {dayjs().format('DD-MM-YYYY HH:mm')}</span>
      </div>
    </div>
  );
}

// ── SECTION 2: MEASUREMENT DETAIL (one per BOQ item) ─────────────────────────

function PrintMeasurementSheet({ item, rows, cover, project, isFirst }) {
  const cumQty     = rows.reduce((s, r) => s + num(r.net_quantity), 0);
  const prevQty    = num(item.certified_qty);
  const presentQty = Math.max(0, cumQty - prevQty);
  const isSteel    = ['MT', 'KG'].includes((item.unit || '').toUpperCase());

  return (
    <div style={{ ...S.page, ...(isFirst ? {} : S.pageBreak) }}>
      {/* Item Header */}
      <div style={S.banner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#93c5fd', textTransform: 'uppercase', marginBottom: '3px' }}>
              Measurement Detail Sheet
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{item.description}</div>
            <div style={{ fontSize: '10px', color: '#bfdbfe', marginTop: '2px' }}>
              {item.sr_no && <span>CSI: {item.sr_no} &nbsp;·&nbsp;</span>}
              Unit: {item.unit} &nbsp;·&nbsp; BOQ Qty: {fmtQ(item.quantity)} {item.unit} &nbsp;·&nbsp; Rate: ₹{fmtN(item.rate)}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px', color: '#bfdbfe' }}>
            <div>{project?.name || '—'}</div>
            <div>Bill: {cover?.ra_bill_no || '—'}</div>
          </div>
        </div>
      </div>
      <div style={{ height: '2px', background: '#2E75B6', marginBottom: '14px' }} />

      {/* Measurement Table */}
      {isSteel ? (
        <table style={S.table}>
          <thead>
            <tr>
              {['Sl.', 'Description / Location', 'Nos', 'Net Qty (MT)', 'Date', 'Remarks'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.tdC, fontStyle: 'italic', color: '#94a3b8', padding: '20px' }}>No approved measurements recorded.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ ...S.tdC, color: '#94a3b8', width: '28px' }}>{i + 1}</td>
                <td style={S.tdL}>{r.description || '—'}{r.location ? ` (${r.location})` : ''}</td>
                <td style={{ ...S.tdC, width: '40px' }}>{fmtN(r.nos, 0)}</td>
                <td style={{ ...S.tdHl, width: '80px' }}>{fmtQ(num(r.net_quantity))}</td>
                <td style={{ ...S.tdC, width: '70px' }}>{r.entry_date ? dayjs(r.entry_date).format('DD MMM YY') : '—'}</td>
                <td style={S.tdL}>{r.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['Sl.', 'Description / Location', 'Nos', 'L (m)', 'B (m)', 'H (m)', `Net Qty (${item.unit})`, 'Date', 'Remarks'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ ...S.tdC, fontStyle: 'italic', color: '#94a3b8', padding: '20px' }}>No approved measurements recorded.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ ...S.tdC, color: '#94a3b8', width: '28px' }}>{i + 1}</td>
                <td style={S.tdL}>{r.description || '—'}{r.location ? ` (${r.location})` : ''}</td>
                <td style={{ ...S.tdC, width: '36px', fontFamily: 'monospace' }}>{fmtN(num(r.nos), 2)}</td>
                <td style={{ ...S.tdC, width: '52px', fontFamily: 'monospace' }}>{fmtQ(num(r.length))}</td>
                <td style={{ ...S.tdC, width: '52px', fontFamily: 'monospace' }}>{fmtQ(num(r.breadth))}</td>
                <td style={{ ...S.tdC, width: '52px', fontFamily: 'monospace' }}>{fmtQ(num(r.height))}</td>
                <td style={{ ...S.tdHl, width: '80px' }}>{fmtQ(num(r.net_quantity))}</td>
                <td style={{ ...S.tdC, width: '70px' }}>{r.entry_date ? dayjs(r.entry_date).format('DD MMM YY') : '—'}</td>
                <td style={S.tdL}>{r.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Summary Footer */}
      <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <table style={{ ...S.table, border: '1px solid #e2e6ec' }}>
          <tbody>
            {[
              ['Cumulative Quantity',   fmtQ(cumQty),     '#e8f5e9', '#2e7d32'],
              ['Prev. Certified Qty',   fmtQ(prevQty),    '#fffde7', '#f57f17'],
              ['Present Bill Quantity', fmtQ(presentQty), '#1F3864', '#fff'],
            ].map(([lbl, val, bg, clr]) => (
              <tr key={lbl}>
                <td style={{ padding: '6px 10px', background: bg, color: clr, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>{lbl}</td>
                <td style={{ padding: '6px 10px', background: bg, color: clr, fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'right' }}>{val} {item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ ...S.table, border: '1px solid #e2e6ec' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>BOQ Rate</td>
              <td style={{ padding: '6px 10px', fontFamily: 'monospace', textAlign: 'right' }}>₹{fmtN(item.rate)} / {item.unit}</td>
            </tr>
            <tr style={{ background: '#eff6ff' }}>
              <td style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', color: '#1d4ed8' }}>Present Bill Amount</td>
              <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1d4ed8', textAlign: 'right', fontSize: '13px' }}>
                ₹{fmtN(presentQty * num(item.rate))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SECTION 3: ABSTRACT ───────────────────────────────────────────────────────

function PrintAbstract({ boqItems, measurements, voItems = [], cover, project, deductions }) {
  const { retentionPct = 5, mobAdvance = 0, steelRecovery = 0, adhocDeduction = 0 } = deductions || {};

  const rows = boqItems.map(item => {
    const prevQty    = num(item.certified_qty);
    const presentQty = measurements
      .filter(m => String(m.boq_item_id) === String(item.id))
      .reduce((s, m) => s + num(m.net_quantity), 0);
    const cumQty  = prevQty + presentQty;
    const rate    = num(item.rate);
    const boqQty  = num(item.quantity);
    return {
      ...item,
      prevQty, presentQty, cumQty,
      boqAmt:     boqQty  * rate,
      prevAmt:    prevQty * rate,
      presentAmt: presentQty * rate,
      cumAmt:     cumQty * rate,
      balQty:     boqQty - cumQty,
    };
  });

  const voTotal        = voItems.reduce((s, v) => s + num(v.quantity) * num(v.rate), 0);
  const subTotal       = rows.reduce((s, r) => s + r.presentAmt, 0) + voTotal;
  const cgst           = subTotal * GST;
  const sgst           = subTotal * GST;
  const grossCertified = subTotal + cgst + sgst;
  const retentionAmt   = grossCertified * (retentionPct / 100);
  const totalDed       = retentionAmt + num(mobAdvance) + num(steelRecovery) + num(adhocDeduction);
  const netCertified   = grossCertified - totalDed;

  return (
    <div style={{ ...S.page, ...S.pageBreak }}>
      {/* Banner */}
      <div style={S.banner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#93c5fd', textTransform: 'uppercase', marginBottom: '3px' }}>Measurement Book</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Abstract of Measurements</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px', color: '#bfdbfe' }}>
            <div>{project?.name || '—'}</div>
            <div>WO: {project?.work_order_number || '—'}</div>
            <div>Bill: {cover?.ra_bill_no || '—'}</div>
          </div>
        </div>
      </div>
      <div style={{ background: '#D9E1F2', padding: '6px 20px', marginBottom: '14px', display: 'flex', gap: '32px', fontSize: '10px', color: '#1e293b' }}>
        <span><b>Client:</b> {project?.client_name || '—'}</span>
        <span><b>Period:</b> {fmtDate(cover?.bill_period_from)} to {fmtDate(cover?.bill_period_to)}</span>
        <span><b>Invoice:</b> {cover?.invoice_ref || '—'}</span>
        <span><b>Printed:</b> {dayjs().format('DD-MM-YYYY')}</span>
      </div>

      {/* Main Table */}
      <table style={S.table}>
        <thead>
          <tr>
            {[
              ['Sr.',         '', 1],
              ['Description', '', 1],
              ['Unit',        '', 1],
              ['BOQ Qty',     '', 1],
              ['Rate (₹)',    '', 1],
              ['BOQ Amt (₹)', '', 1],
              ['Previous Bill', 2, 0],
              ['Present Bill',  2, 0],
              ['Cumulative',    2, 0],
              ['Bal Qty',      '', 1],
            ].map(([h, span, rs]) =>
              span
                ? <th key={h} style={{ ...S.th2, ...S.th }} colSpan={span}>{h}</th>
                : <th key={h} style={S.th} rowSpan={2}>{h}</th>
            )}
          </tr>
          <tr>
            {['Qty', 'Amt (₹)', 'Qty', 'Amt (₹)', 'Qty', 'Amt (₹)'].map((h, i) => (
              <th key={i} style={i < 2 ? S.th : i < 4 ? { ...S.th, background: '#1F5694' } : S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ ...S.tdC, color: '#64748b', width: '28px' }}>{idx + 1}</td>
              <td style={S.tdL}>
                <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>{r.sr_no}</span>
                {r.description}
              </td>
              <td style={{ ...S.tdC, width: '36px' }}>{r.unit}</td>
              <td style={{ ...S.tdR, width: '58px' }}>{fmtQ(r.quantity)}</td>
              <td style={{ ...S.tdR, width: '62px' }}>{fmtN(r.rate)}</td>
              <td style={{ ...S.tdR, width: '78px' }}>{fmtN(r.boqAmt)}</td>
              <td style={{ ...S.tdR, width: '58px', color: '#475569' }}>{fmtQ(r.prevQty)}</td>
              <td style={{ ...S.tdR, width: '78px', color: '#475569' }}>{fmtN(r.prevAmt)}</td>
              <td style={{ ...S.tdHl, width: '64px' }}>{fmtQ(r.presentQty)}</td>
              <td style={{ ...S.tdHl, width: '84px' }}>{fmtN(r.presentAmt)}</td>
              <td style={{ ...S.tdR, width: '58px' }}>{fmtQ(r.cumQty)}</td>
              <td style={{ ...S.tdR, width: '78px' }}>{fmtN(r.cumAmt)}</td>
              <td style={{ ...S.tdR, width: '52px', color: r.balQty < 0 ? '#dc2626' : '#475569' }}>{fmtQ(r.balQty)}</td>
            </tr>
          ))}
        </tbody>
        {/* ── VO / Extra Items ── */}
        {voItems.length > 0 && (
          <>
            <tr style={{ background: '#fff8e1' }}>
              <td colSpan={13} style={{ padding: '5px 8px', fontWeight: 'bold', fontSize: '9px', color: '#e65100', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '2px solid #ffb300' }}>
                Extra Items / Variation Orders
              </td>
            </tr>
            {voItems.map((v, idx) => (
              <tr key={v.id} style={{ background: '#fffde7' }}>
                <td style={{ ...S.tdC, color: '#94a3b8', width: '28px' }}>{rows.length + idx + 1}</td>
                <td style={S.tdL}>
                  <span style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 'bold', display: 'block' }}>{v.vo_number}</span>
                  {v.new_item_description || v.boq_description || '—'}
                  {v.reason && <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>{v.reason}</span>}
                </td>
                <td style={{ ...S.tdC, width: '36px' }}>{v.unit}</td>
                <td style={{ ...S.tdR, width: '58px' }}>{fmtQ(num(v.quantity))}</td>
                <td style={{ ...S.tdR, width: '62px' }}>{fmtN(num(v.rate))}</td>
                <td style={{ ...S.tdR, width: '78px', fontWeight: 'bold', color: '#b45309' }}>{fmtN(num(v.quantity) * num(v.rate))}</td>
                <td colSpan={7} style={{ ...S.tdC, color: '#cbd5e1', fontSize: '9px' }}>—</td>
              </tr>
            ))}
            <tr style={{ background: '#fef3c7' }}>
              <td colSpan={5} style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '9px', color: '#92400e', textTransform: 'uppercase' }}>
                Extra Items Sub-Total
              </td>
              <td style={{ ...S.tdR, fontWeight: 'bold', color: '#92400e' }}>{fmtN(voTotal)}</td>
              <td colSpan={7} />
            </tr>
          </>
        )}

        <tfoot>
          {[
            ['SUB TOTAL',          subTotal,       S.subRow],
            [`CGST @ 9%`,          cgst,           S.gstRow],
            [`SGST @ 9%`,          sgst,           S.gstRow],
            ['TOTAL GROSS CERTIFIED', grossCertified, S.totRow],
          ].map(([lbl, val, style]) => (
            <tr key={lbl} style={style}>
              <td colSpan={9} style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {lbl}
              </td>
              <td style={{ ...S.tdR, fontWeight: 'bold', fontSize: '11px' }}>₹{fmtN(val)}</td>
              <td colSpan={3} />
            </tr>
          ))}
        </tfoot>
      </table>

      {/* Deductions & Net Certified */}
      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Deductions table */}
        <div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.06em' }}>Deductions</div>
          <table style={{ ...S.table, border: '1px solid #e2e6ec' }}>
            <tbody>
              {[
                [`Retention Money @ ${retentionPct}%`,  retentionAmt],
                ['Mobilization Advance Recovery',         num(mobAdvance)],
                ['Material Recovery – Steel',             num(steelRecovery)],
                ['Other / Adhoc Deduction',               num(adhocDeduction)],
                ['TOTAL DEDUCTIONS',                      totalDed],
              ].map(([lbl, val], i) => (
                <tr key={lbl} style={i === 4 ? { background: '#fee2e2' } : {}}>
                  <td style={{ ...S.tdL, fontWeight: i === 4 ? 'bold' : 'normal', color: i === 4 ? '#b91c1c' : '#1a1c21' }}>{lbl}</td>
                  <td style={{ ...S.tdR, color: i === 4 ? '#b91c1c' : '#1a1c21', fontWeight: i === 4 ? 'bold' : 'normal' }}>₹{fmtN(val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment Certificate */}
        <div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.06em' }}>Payment Certificate</div>
          <table style={{ ...S.table, border: '1px solid #e2e6ec' }}>
            <tbody>
              <tr>
                <td style={S.tdL}>Gross Certified</td>
                <td style={S.tdR}>₹{fmtN(grossCertified)}</td>
              </tr>
              <tr style={{ background: '#fef9c3' }}>
                <td style={{ ...S.tdL, fontWeight: 'bold', color: '#92400e' }}>Total Deductions</td>
                <td style={{ ...S.tdR, fontWeight: 'bold', color: '#b45309' }}>₹{fmtN(totalDed)}</td>
              </tr>
              <tr style={{ background: '#1F3864' }}>
                <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#fff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NET CERTIFIED AMOUNT</td>
                <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace', textAlign: 'right', fontSize: '14px' }}>₹{fmtN(netCertified)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Footer */}
      <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
        {[['Prepared By (QS)', cover?.prepared_by], ['Checked By', cover?.checked_by], ['Approved By', cover?.approved_by]].map(([lbl, name]) => (
          <div key={lbl} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '28px', minHeight: '16px' }}>{name || ''}</div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '9px', color: '#94a3b8' }}>{lbl} — Signature &amp; Date</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ROOT PRINT DOCUMENT (forwardRef for react-to-print) ──────────────────────

const MBPrintDocument = forwardRef(function MBPrintDocument(
  { cover, project, boqItems, measurements, voItems = [], deductions },
  ref
) {
  return (
    <div ref={ref} style={{ background: '#fff' }}>
      {/* Global print styles injected via style tag */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body   { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* 1. Cover */}
      <PrintCover cover={cover} project={project} />

      {/* 2. One measurement sheet per BOQ item */}
      {boqItems.map((item, idx) => {
        const rows = measurements.filter(
          m => String(m.boq_item_id) === String(item.id)
        );
        return (
          <PrintMeasurementSheet
            key={item.id}
            item={item}
            rows={rows}
            cover={cover}
            project={project}
            isFirst={idx === 0}
          />
        );
      })}

      {/* 3. Abstract */}
      <PrintAbstract
        boqItems={boqItems}
        measurements={measurements}
        voItems={voItems}
        cover={cover}
        project={project}
        deductions={deductions}
      />
    </div>
  );
});

export default MBPrintDocument;
