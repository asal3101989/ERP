// src/pages/stores/MRSPrintTemplate.jsx
// Integrated from MRPrintLayout.jsx — A4 popup-window print approach
import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';

// ─── Date formatter ───────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '';
  try { return dayjs(d).format('DD/MM/YYYY'); } catch { return d; }
};

// ─── Print trigger — opens popup window with inline CSS ───────────────────────
export function useMRSPrint(ref) {
  return () => {
    const content = ref.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=1050,height=850');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Material Requisition</title>
      <style>${PRINT_CSS}</style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MRSPrintTemplate({ data, onClose }) {
  const printRef = useRef();
  const triggerPrint = useMRSPrint(printRef);

  if (!data) return null;

  const items    = data.items || [];
  const MIN_ROWS = 8;
  const padded   = [
    ...items,
    ...Array.from({ length: Math.max(0, MIN_ROWS - items.length) }, (_, i) => ({
      _blank: true, sl: items.length + i + 1,
    })),
  ];

  const verificationUrl = `${window.location.origin}/verify/mrs/${data.id}`;

  return (
    <>
      <style>{SCREEN_CSS}</style>

      {/* ── Toolbar ── */}
      <div className="mrp-toolbar">
        <div className="mrp-toolbar-left">
          <div className="mrp-tlogo">
            <span className="mrp-tlogo-mark">B</span>
            <span className="mrp-tlogo-text">BCIM</span>
          </div>
          <div>
            <div className="mrp-ttitle">MR Print Preview</div>
            <div className="mrp-tsub">{data.serial_no_formatted || data.mrs_number}</div>
          </div>
        </div>
        <div className="mrp-toolbar-right">
          {onClose && (
            <button className="mrp-btn mrp-btn-ghost" onClick={onClose}>← Back</button>
          )}
          <button className="mrp-btn mrp-btn-primary" onClick={triggerPrint}>
            🖨 Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── A4 Preview ── */}
      <div className="mrp-preview-bg">
        <div className="mrp-a4" ref={printRef}>

          {/* ══ HEADER ══ */}
          <table className="mrp-hdr-tbl">
            <tbody>
              <tr>
                <td className="mrp-logo-cell" rowSpan={2}>
                  <div className="mrp-logo-block">
                    <div className="mrp-logo-box">B</div>
                    <div className="mrp-logo-name">BCIM</div>
                    <div className="mrp-logo-full">BCIM Engineering Private Limited</div>
                    <div className="mrp-logo-addr">"B" Wing, Divyasree Chambers, No. 11,<br />O'Shaugnessy Road, Bangalore – 560 025</div>
                    <div className="mrp-logo-tel">Tel: 080 22244455</div>
                  </div>
                </td>
                <td className="mrp-doc-title-cell" colSpan={2}>
                  <div className="mrp-doc-title">MATERIAL / SERVICE REQUISITION</div>
                </td>
              </tr>
              <tr>
                <td className="mrp-ref-cell">
                  <table className="mrp-ref-tbl">
                    <tbody>
                      <tr>
                        <td className="mrp-ref-lbl">Serial No</td>
                        <td className="mrp-ref-colon">:</td>
                        <td className="mrp-ref-val"><strong>{data.serial_no_formatted || data.mrs_number}</strong></td>
                      </tr>
                      <tr>
                        <td className="mrp-ref-lbl">Date</td>
                        <td className="mrp-ref-colon">:</td>
                        <td className="mrp-ref-val">{fmtDate(data.required_by || data.created_at)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td className="mrp-qr-cell">
                  <QRCodeSVG value={verificationUrl} size={56} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* ══ PROJECT INFO ══ */}
          <table className="mrp-info-tbl">
            <tbody>
              <tr>
                <td className="mrp-lbl">Project</td>
                <td className="mrp-colon">:</td>
                <td className="mrp-val">{data.project_name}</td>
                <td className="mrp-lbl mrp-border-left">Serial No</td>
                <td className="mrp-colon">:</td>
                <td className="mrp-val">{data.serial_no_formatted || data.mrs_number}</td>
              </tr>
              <tr>
                <td className="mrp-lbl">Project Code</td>
                <td className="mrp-colon">:</td>
                <td className="mrp-val">{data.project_code}</td>
                <td className="mrp-lbl mrp-border-left">Date</td>
                <td className="mrp-colon">:</td>
                <td className="mrp-val">{fmtDate(data.required_by || data.created_at)}</td>
              </tr>
              <tr>
                <td className="mrp-lbl" colSpan={3}>
                  Head Office / Project Name : {data.head_office_project_name}
                </td>
                <td colSpan={3}></td>
              </tr>
              <tr>
                <td className="mrp-lbl">Department</td>
                <td className="mrp-colon">:</td>
                <td className="mrp-val">{data.department}</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>

          {/* ══ ITEMS TABLE ══ */}
          <table className="mrp-items-tbl">
            <thead>
              <tr>
                <th className="it-sl">SL. NO</th>
                <th className="it-code">ITEM CODE</th>
                <th className="it-desc">DESCRIPTION</th>
                <th className="it-unit">UNIT</th>
                <th className="it-qty">QTY</th>
                <th className="it-date">DATE REQUIRED</th>
                <th className="it-vendor">VENDOR / SUPPLIER (Optional)</th>
                <th className="it-rmk">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {padded.map((it, idx) => (
                <tr key={idx} className="it-row">
                  <td className="it-sl">{it._blank ? '' : idx + 1}</td>
                  <td className="it-code">{it._blank ? '' : (it.item_code || '')}</td>
                  <td className="it-desc">{it._blank ? '' : (it.material_name || it.material || '')}</td>
                  <td className="it-unit">{it._blank ? '' : (it.unit || '')}</td>
                  <td className="it-qty">{it._blank ? '' : (it.quantity || it.qty || '')}</td>
                  <td className="it-date">{it._blank ? '' : fmtDate(it.required_date || it.date_required)}</td>
                  <td className="it-vendor">{it._blank ? '' : (it.preferred_vendor || it.vendor || '')}</td>
                  <td className="it-rmk">{it._blank ? '' : (it.purpose || it.remarks || '')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ══ PURCHASE DEPT ══ */}
          <table className="mrp-purchase-tbl">
            <tbody>
              <tr>
                <td colSpan={3} className="mrp-purchase-heading">For The Uses of Purchase Department</td>
                <td colSpan={2} className="mrp-purchase-processed-lbl">Processed By</td>
                <td colSpan={2} className="mrp-purchase-processed-val">{data.processed_by_name || ''}</td>
              </tr>
              <tr>
                <td className="mrp-pd-lbl">Received Date</td>
                <td className="mrp-pd-colon">:</td>
                <td className="mrp-pd-val">{data.purchase_received_date ? fmtDate(data.purchase_received_date) : ''}</td>
                <td colSpan={2} className="mrp-pd-lbl">Date</td>
                <td colSpan={2} className="mrp-pd-val">{data.processed_at ? fmtDate(data.processed_at) : ''}</td>
              </tr>
              <tr>
                <td className="mrp-pd-lbl">Purchase Order No. &amp; Date</td>
                <td className="mrp-pd-colon">:</td>
                <td className="mrp-pd-val">{data.po_no_date || ''}</td>
                <td colSpan={2} className="mrp-pd-lbl">Expected Date of Delivery</td>
                <td colSpan={2} className="mrp-pd-val">{data.expected_delivery_date ? fmtDate(data.expected_delivery_date) : ''}</td>
              </tr>
            </tbody>
          </table>

          {/* ══ APPROVALS ══ */}
          <table className="mrp-approvals-tbl">
            <tbody>
              {/* Signature images row */}
              <tr className="appr-sig-row">
                {[
                  data.raised_by_sig,
                  data.tower_sig_img || data.verified_tower_sig,
                  data.pm_sig_img    || data.approved_pm_sig,
                  data.srpm_sig_img  || data.approved_srpm_sig,
                  data.mgmt_sig_img  || data.approved_mgmt_sig,
                  data.md_sig_img    || data.approved_md_sig,
                ].map((sig, i) => (
                  <td key={i}>
                    {sig
                      ? <img src={sig} alt="sig" style={{ maxHeight: 36, maxWidth: '90%' }} />
                      : null}
                  </td>
                ))}
              </tr>
              {/* Labels row */}
              <tr className="appr-lbl-row">
                <td>Requested By</td>
                <td>Verified and checked by Tower Manager</td>
                <td>Approved by Project Manager</td>
                <td>Approved by Sr. Project Manager</td>
                <td>Management</td>
                <td>Management</td>
              </tr>
              {/* Signature lines */}
              <tr className="appr-line-row">
                <td><div className="appr-line" /></td>
                <td><div className="appr-line" /></td>
                <td><div className="appr-line" /></td>
                <td><div className="appr-line" /></td>
                <td><div className="appr-line" /></td>
                <td><div className="appr-line" /></td>
              </tr>
              {/* Names row */}
              <tr className="appr-name-row">
                <td>Name: {data.raised_by_name || ''}</td>
                <td>Name: {data.verified_tower_name || ''}</td>
                <td>Name: {data.approved_pm_name || ''}</td>
                <td>Name: {data.approved_srpm_name || ''}</td>
                <td>Director: {data.approved_mgmt_name || ''}</td>
                <td>Managing Director: {data.approved_md_name || ''}</td>
              </tr>
              {/* Dates row */}
              <tr className="appr-date-row">
                <td>Date: {fmtDate(data.created_at)}</td>
                <td>Date: {fmtDate(data.verified_tower_mgr_at)}</td>
                <td>Date: {fmtDate(data.approved_pm_at)}</td>
                <td>Date: {fmtDate(data.approved_sr_pm_at)}</td>
                <td>Date: {fmtDate(data.approved_mgmt_at)}</td>
                <td>Date: {fmtDate(data.approved_md_at)}</td>
              </tr>
            </tbody>
          </table>

          {/* ══ FOOTER ══ */}
          <div className="mrp-footer">
            BCIM ENGINEERING PRIVATE LIMITED &nbsp;|&nbsp; "B" Wing, Divyasree Chambers,
            No. 11, O'Shaugnessy Road, Bangalore – 560 025
          </div>

        </div>{/* end .mrp-a4 */}
      </div>
    </>
  );
}

// ─── Screen CSS ───────────────────────────────────────────────────────────────
const SCREEN_CSS = `
  .mrp-toolbar {
    background: #1e40af; padding: 12px 28px;
    display: flex; align-items: center; justify-content: space-between;
    font-family: 'DM Sans', system-ui, sans-serif;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 2px 8px rgba(30,64,175,.3);
  }
  .mrp-toolbar-left  { display: flex; align-items: center; gap: 14px; }
  .mrp-toolbar-right { display: flex; gap: 10px; }
  .mrp-tlogo         { display: flex; align-items: center; gap: 6px; }
  .mrp-tlogo-mark {
    width: 30px; height: 30px; background: white; color: #1e40af;
    border-radius: 5px; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px;
  }
  .mrp-tlogo-text { font-weight: 700; font-size: 17px; color: white; letter-spacing: 2px; }
  .mrp-ttitle { font-weight: 600; font-size: 15px; color: white; }
  .mrp-tsub   { font-size: 11px; color: rgba(255,255,255,.7); }
  .mrp-btn {
    padding: 7px 18px; border-radius: 6px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; transition: all .15s;
  }
  .mrp-btn-ghost   { background: rgba(255,255,255,.15); color: white; }
  .mrp-btn-ghost:hover { background: rgba(255,255,255,.25); }
  .mrp-btn-primary { background: white; color: #1e40af; }
  .mrp-btn-primary:hover { background: #eff6ff; }
  .mrp-preview-bg {
    background: #e5e7eb; min-height: calc(100vh - 54px);
    padding: 32px 24px; display: flex; justify-content: center;
  }
  .mrp-a4 {
    background: white; width: 210mm; min-height: 297mm;
    padding: 12mm 14mm; box-shadow: 0 4px 24px rgba(0,0,0,.18);
    font-family: Arial, sans-serif; font-size: 9pt;
    border: 1px solid #d1d5db;
  }
`;

// ─── Print CSS (injected into popup window) ───────────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; }

  /* ── Header ── */
  .mrp-hdr-tbl { width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 0; }
  .mrp-hdr-tbl td { border: 1px solid #000; padding: 5px 8px; vertical-align: middle; }
  .mrp-logo-cell { width: 38%; }
  .mrp-logo-block { text-align: left; }
  .mrp-logo-box {
    display: inline-block; width: 26px; height: 26px; background: #1e40af; color: white;
    font-weight: 700; font-size: 14pt; text-align: center; line-height: 26px;
    border-radius: 4px; margin-bottom: 3px;
  }
  .mrp-logo-name { font-size: 16pt; font-weight: 700; letter-spacing: 3px; color: #1e40af; }
  .mrp-logo-full { font-size: 8pt; font-weight: 700; }
  .mrp-logo-addr { font-size: 7.5pt; color: #333; line-height: 1.4; margin-top: 2px; }
  .mrp-logo-tel  { font-size: 7.5pt; color: #333; margin-top: 2px; }
  .mrp-doc-title-cell { text-align: center; vertical-align: middle; }
  .mrp-doc-title { font-size: 13pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
  .mrp-ref-cell { vertical-align: top; }
  .mrp-ref-tbl  { width: 100%; border-collapse: collapse; }
  .mrp-ref-tbl td { padding: 2px 4px; border: none; font-size: 9pt; }
  .mrp-ref-lbl  { width: 60px; font-weight: 600; white-space: nowrap; }
  .mrp-ref-colon { width: 10px; }
  .mrp-ref-val  { font-weight: 700; }
  .mrp-qr-cell  { text-align: center; vertical-align: middle; width: 70px; }

  /* ── Info ── */
  .mrp-info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; margin-bottom: 0; }
  .mrp-info-tbl td { border: 1px solid #000; padding: 3px 7px; font-size: 9pt; }
  .mrp-lbl   { font-weight: 600; width: 120px; background: #f8f8f8; }
  .mrp-colon { width: 10px; }
  .mrp-val   { min-width: 120px; }
  .mrp-border-left { border-left: 1px solid #000; padding-left: 8px; }

  /* ── Items ── */
  .mrp-items-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; margin-bottom: 0; }
  .mrp-items-tbl th {
    border: 1px solid #000; padding: 5px; font-size: 8pt;
    text-align: center; background: #dce6f1; text-transform: uppercase;
    font-weight: 700; letter-spacing: .3px;
  }
  .it-sl     { width: 32px;  text-align: center; }
  .it-code   { width: 70px;  }
  .it-desc   { min-width: 140px; }
  .it-unit   { width: 40px;  text-align: center; }
  .it-qty    { width: 40px;  text-align: center; }
  .it-date   { width: 80px;  text-align: center; }
  .it-vendor { width: 110px; }
  .it-rmk    { width: 80px;  }
  .it-row td { border: 1px solid #000; padding: 5px; height: 22px; font-size: 8.5pt; vertical-align: middle; }

  /* ── Purchase Dept ── */
  .mrp-purchase-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; margin-bottom: 0; }
  .mrp-purchase-tbl td { border: 1px solid #000; padding: 4px 7px; font-size: 8.5pt; }
  .mrp-purchase-heading { font-weight: 700; font-size: 9pt; background: #f0f0f0; }
  .mrp-purchase-processed-lbl { font-weight: 600; background: #f8f8f8; }
  .mrp-pd-lbl   { font-weight: 600; background: #f8f8f8; white-space: nowrap; }
  .mrp-pd-colon { width: 10px; }
  .mrp-pd-val   { min-width: 100px; }

  /* ── Approvals ── */
  .mrp-approvals-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; margin-bottom: 0; }
  .mrp-approvals-tbl td { border: 1px solid #000; padding: 4px 6px; font-size: 8pt; width: 16.66%; vertical-align: bottom; }
  .appr-sig-row td  { height: 44px; text-align: center; vertical-align: middle; }
  .appr-lbl-row td  { font-weight: 700; font-size: 7.5pt; background: #f0f4fa; text-align: center; height: 28px; vertical-align: middle; }
  .appr-line-row td { padding: 0 6px 4px; }
  .appr-line { border-bottom: 1px solid #000; width: 80%; margin: 0 auto; }
  .appr-name-row td { font-size: 8pt; padding-top: 3px; }
  .appr-date-row td { font-size: 8pt; padding-bottom: 5px; }

  /* ── Footer ── */
  .mrp-footer {
    text-align: center; font-size: 7.5pt; color: #333;
    border: 1px solid #000; border-top: none;
    padding: 4px; background: #f8f8f8;
  }

  @page { size: A4 portrait; margin: 10mm 12mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;
