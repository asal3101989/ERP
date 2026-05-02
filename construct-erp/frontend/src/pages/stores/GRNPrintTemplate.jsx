// src/pages/stores/GRNPrintTemplate.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';

const GRNPrintTemplate = React.forwardRef(({ data }, ref) => {
  if (!data) {
    return (
      <div ref={ref} className="p-10 text-center font-bold text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-white">
        Preparing Document…
      </div>
    );
  }

  // Normalise field names (backend uses vendor_name / grn_date / verified_stores_name etc.)
  const supplierName   = data.supplier_name || data.vendor_name || '—';
  const receiptDate    = data.receipt_date  || data.grn_date    || null;
  const verifiedBy     = data.verified_by_name    || data.verified_stores_name || null;
  const approvedBy     = data.approved_by_name    || data.approved_qc_name     || null;
  const statusLabel    = {
    pending:         'Pending',
    verified_stores: 'Stores Verified',
    approved:        'Approved',
    rejected:        'Rejected',
    partial:         'Partial',
  }[data.quality_status || data.status] || (data.quality_status || data.status || '—');

  const items        = data.items || [];
  const MIN_ROWS     = 10;
  const displayRows  = Math.max(items.length, MIN_ROWS);
  const totalValue   = items.reduce((s, i) =>
    s + (parseFloat(i.quantity_received || 0) * parseFloat(i.rate || 0)), 0
  );

  const verificationUrl = `${window.location.origin}/verify/grn/${data.id}`;

  return (
    <div ref={ref}>
      <div
        className="bg-white text-black font-sans"
        style={{ width: '297mm', minHeight: '210mm', padding: '10mm', boxSizing: 'border-box', position: 'relative' }}
      >

        {/* ── HEADER ───────────────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black' }}>
          <tbody>
            <tr>
              {/* Logo */}
              <td style={{ width: '22%', border: '2px solid black', padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                <img src="/bcim-logo.png" alt="BCIM" style={{ height: '44px', objectFit: 'contain' }} />
              </td>

              {/* Title block */}
              <td style={{ border: '2px solid black', padding: '6px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, textDecoration: 'underline', letterSpacing: '0.05em' }}>
                  GOODS RECEIPT NOTE (GRN)
                </div>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                  BCIM Engineering Private Limited — Inward Material Receipt Record
                </div>
              </td>

              {/* GRN meta */}
              <td style={{ width: '28%', border: '2px solid black', padding: '6px', fontSize: '9px', verticalAlign: 'top' }}>
                <MetaRow label="GRN No."   value={data.grn_number} bold />
                <MetaRow label="Date"      value={receiptDate ? dayjs(receiptDate).format('DD/MM/YYYY') : '—'} />
                <MetaRow label="Status"    value={statusLabel} />
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── INFO SECTION ─────────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderLeft: '2px solid black', borderRight: '2px solid black', borderBottom: '2px solid black' }}>
          <tbody>
            <tr>
              {/* Left column */}
              <td style={{ width: '50%', borderRight: '2px solid black', padding: '6px', verticalAlign: 'top', fontSize: '9px' }}>
                <InfoRow label="Project"         value={data.project_name || '—'} />
                <InfoRow label="Supplier / Vendor" value={supplierName} />
                <InfoRow label="Challan Number"  value={data.challan_number || '—'} />
                <InfoRow label="Invoice Number"  value={data.invoice_number || '—'} />
                <InfoRow label="Vehicle Number"  value={data.vehicle_number || '—'} />
                <InfoRow label="Driver Name"     value={data.driver_name || '—'} />
              </td>

              {/* Right column */}
              <td style={{ width: '50%', padding: '6px', verticalAlign: 'top', fontSize: '9px' }}>
                <InfoRow label="Gate Pass No."   value={data.gate_pass_no || '—'} />
                <InfoRow label="WB Slip No."     value={data.wb_slip_no || '—'} />
                <InfoRow label="Site Location"   value={data.site_location || '—'} />
                <InfoRow label="Received By"     value={data.received_by_name || '—'} />
                <InfoRow label="PO Reference"    value={data.po_number || data.wo_reference || '—'} />

                {/* QR code */}
                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                  <QRCodeSVG value={verificationUrl} size={52} />
                  <div style={{ fontSize: '7px', color: '#888', marginTop: '2px' }}>Scan to verify</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── ITEMS TABLE ──────────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderLeft: '2px solid black', borderRight: '2px solid black', borderBottom: '2px solid black', fontSize: '9px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black', fontWeight: 700, textAlign: 'center', backgroundColor: '#f8f9fa' }}>
              <TH w="5%"  >SL</TH>
              <TH w="32%" left>MATERIAL DESCRIPTION</TH>
              <TH w="7%"  >UNIT</TH>
              <TH w="9%"  >BATCH NO.</TH>
              <TH w="8%"  >ORD. QTY</TH>
              <TH w="8%"  >RECV. QTY</TH>
              <TH w="10%" >RATE (₹)</TH>
              <TH w="11%" >AMOUNT (₹)</TH>
              <TH         >REMARKS</TH>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: displayRows }).map((_, i) => {
              const it = items[i];
              const amount = it ? parseFloat(it.quantity_received || 0) * parseFloat(it.rate || 0) : 0;
              return (
                <tr key={i} style={{ borderBottom: '1px solid #ddd', height: '22px', textAlign: 'center' }}>
                  <td style={{ borderRight: '1px solid #ccc' }}>{i < items.length ? i + 1 : ''}</td>
                  <td style={{ borderRight: '1px solid #ccc', textAlign: 'left', paddingLeft: '4px', fontWeight: it ? 600 : 400 }}>{it?.material_name || ''}</td>
                  <td style={{ borderRight: '1px solid #ccc', textTransform: 'uppercase' }}>{it?.unit || ''}</td>
                  <td style={{ borderRight: '1px solid #ccc', fontSize: '8px', color: '#555' }}>{it?.batch_number || ''}</td>
                  <td style={{ borderRight: '1px solid #ccc', color: '#666' }}>{it?.quantity_ordered || ''}</td>
                  <td style={{ borderRight: '1px solid #ccc', fontWeight: 700 }}>{it?.quantity_received || ''}</td>
                  <td style={{ borderRight: '1px solid #ccc' }}>{it?.rate ? Number(it.rate).toFixed(2) : ''}</td>
                  <td style={{ borderRight: '1px solid #ccc', fontWeight: 700 }}>{it && amount > 0 ? amount.toFixed(2) : ''}</td>
                  <td style={{ paddingLeft: '4px', textAlign: 'left', fontSize: '8px', color: '#666' }}>{it?.quality_remarks || it?.remarks || ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid black', fontWeight: 700, backgroundColor: '#f8f9fa', textAlign: 'center' }}>
              <td colSpan={7} style={{ borderRight: '1px solid #ccc', textAlign: 'right', paddingRight: '6px', fontSize: '9px' }}>
                TOTAL VALUE (₹)
              </td>
              <td style={{ borderRight: '1px solid #ccc', fontSize: '10px', fontWeight: 900 }}>
                {totalValue > 0 ? totalValue.toFixed(2) : (data.total_value ? Number(data.total_value).toFixed(2) : '—')}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        {/* ── REMARKS ──────────────────────────────────────────── */}
        {data.remarks && (
          <div style={{ borderLeft: '2px solid black', borderRight: '2px solid black', borderBottom: '2px solid black', padding: '5px 8px', fontSize: '9px' }}>
            <span style={{ fontWeight: 700 }}>Remarks: </span>{data.remarks}
          </div>
        )}

        {/* ── SIGNATURE BLOCK ──────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderLeft: '2px solid black', borderRight: '2px solid black', borderBottom: '2px solid black' }}>
          <tbody>
            <tr>
              {[
                { role: 'Received By',     sub: 'Storekeeper',      name: data.received_by_name },
                { role: 'Verified By',     sub: 'Stores Manager',   name: verifiedBy },
                { role: 'Checked By',      sub: 'QC / Accounts',    name: data.checked_by_name || null },
                { role: 'Approved By',     sub: 'Project Manager',  name: approvedBy },
              ].map((sig, idx, arr) => (
                <td
                  key={sig.role}
                  style={{
                    width: '25%',
                    borderRight: idx < arr.length - 1 ? '2px solid black' : 'none',
                    verticalAlign: 'bottom',
                    padding: 0,
                  }}
                >
                  {/* Signature space */}
                  <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}>
                    {sig.name && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#166534', fontStyle: 'italic' }}>{sig.name}</span>
                    )}
                  </div>
                  {/* Name/date row */}
                  <div style={{ borderTop: '2px solid black', padding: '4px 6px', fontSize: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '9px' }}>{sig.role}</div>
                    <div style={{ color: '#555', marginTop: '1px' }}>({sig.sub})</div>
                    <div style={{ marginTop: '3px' }}>Name: {sig.name || '________________________'}</div>
                    <div>Date: {sig.name && receiptDate ? dayjs(receiptDate).format('DD/MM/YYYY') : '________________________'}</div>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '7px', color: '#aaa' }}>
          <span>Doc ID: GRN-{data.id?.slice(0, 8)?.toUpperCase()} • BCIM Construct-ERP v3.0</span>
          <span>Printed: {dayjs().format('DD/MM/YYYY HH:mm')} • This document is system-generated</span>
        </div>
      </div>
    </div>
  );
});

GRNPrintTemplate.displayName = 'GRNPrintTemplate';
export default GRNPrintTemplate;

/* ── Helper components ────────────────────────────────────────── */
function MetaRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', marginBottom: '3px' }}>
      <span style={{ width: '72px', fontWeight: 700, color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600 }}>: {value}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', marginBottom: '3px' }}>
      <span style={{ width: '110px', fontWeight: 700, color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>: {value}</span>
    </div>
  );
}

function TH({ children, w, left }) {
  return (
    <th style={{
      borderRight: '1px solid #ccc',
      padding: '4px 3px',
      width: w || undefined,
      textAlign: left ? 'left' : 'center',
      paddingLeft: left ? '4px' : undefined,
      fontSize: '8.5px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {children}
    </th>
  );
}
