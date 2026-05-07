// src/pages/stores/MRSPrintTemplate.jsx — Inline-styled A4 print template
import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';

const fmtDate = (d) => {
  if (!d) return '';
  try { return dayjs(d).format('DD/MM/YYYY'); } catch { return String(d); }
};

// ── Print trigger ─────────────────────────────────────────────────────────────
export function useMRSPrint(ref) {
  return () => {
    const content = ref.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=1050,height=900');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Material Requisition</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;font-size:9pt;color:#000;background:#fff;}
        @page{size:A4 portrait;margin:10mm 12mm;}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };
}

// ── Shared inline style objects ───────────────────────────────────────────────
const S = {
  // outer wrapper shown on screen
  preview: { background:'#e5e7eb', minHeight:'100vh', padding:'32px 24px', display:'flex', justifyContent:'center', fontFamily:'Arial,sans-serif' },
  // A4 page
  a4: { background:'#fff', width:'210mm', minHeight:'297mm', padding:'12mm 14mm', boxShadow:'0 4px 24px rgba(0,0,0,.18)', border:'1px solid #d1d5db', fontSize:'9pt', color:'#000', fontFamily:'Arial,sans-serif' },
  // tables
  tbl: { width:'100%', borderCollapse:'collapse', marginBottom:0 },
  td: { border:'1px solid #000', padding:'4px 7px', verticalAlign:'middle', fontSize:'9pt' },
  thLbl: { fontWeight:700, background:'#f8f8f8', whiteSpace:'nowrap', border:'1px solid #000', padding:'3px 7px', fontSize:'9pt' },
  thVal: { border:'1px solid #000', padding:'3px 7px', fontSize:'9pt' },
};

export default function MRSPrintTemplate({ data, onClose }) {
  const printRef = useRef();
  const triggerPrint = useMRSPrint(printRef);

  if (!data) return null;

  const items   = data.items || [];
  const MIN_ROWS = 8;
  const padded  = [
    ...items,
    ...Array.from({ length: Math.max(0, MIN_ROWS - items.length) }, () => ({ _blank: true })),
  ];
  const verificationUrl = `${window.location.origin}/verify/mrs/${data.id}`;

  return (
    <>
      {/* ── Screen toolbar ── */}
      <div style={{ background:'#1e40af', padding:'12px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 8px rgba(30,64,175,.3)', fontFamily:'system-ui,sans-serif' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:32, height:32, background:'#fff', color:'#1e40af', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17 }}>B</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'#fff' }}>MR Print Preview</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>{data.serial_no_formatted || data.mrs_number}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {onClose && (
            <button onClick={onClose} style={{ padding:'7px 18px', borderRadius:6, background:'rgba(255,255,255,.15)', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer' }}>← Back</button>
          )}
          <button onClick={triggerPrint} style={{ padding:'7px 18px', borderRadius:6, background:'#fff', color:'#1e40af', border:'none', fontSize:13, fontWeight:600, cursor:'pointer' }}>🖨 Print / Save PDF</button>
        </div>
      </div>

      {/* ── A4 Preview ── */}
      <div style={S.preview}>
        <div style={S.a4} ref={printRef}>

          {/* ══ HEADER TABLE ══ */}
          <table style={{ ...S.tbl, border:'1.5px solid #000' }}>
            <tbody>
              <tr>
                {/* Logo cell */}
                <td rowSpan={2} style={{ ...S.td, width:'38%', border:'1.5px solid #000', verticalAlign:'top', padding:'8px 10px' }}>
                  <div style={{ display:'inline-block', width:26, height:26, background:'#1e40af', color:'#fff', fontWeight:700, fontSize:14, textAlign:'center', lineHeight:'26px', borderRadius:4, marginBottom:3 }}>B</div>
                  <div style={{ fontSize:16, fontWeight:700, letterSpacing:3, color:'#1e40af' }}>BCIM</div>
                  <div style={{ fontSize:'8pt', fontWeight:700 }}>BCIM Engineering Private Limited</div>
                  <div style={{ fontSize:'7.5pt', color:'#333', lineHeight:1.4, marginTop:2 }}>"B" Wing, Divyasree Chambers, No. 11,<br />O'Shaugnessy Road, Bangalore – 560 025</div>
                  <div style={{ fontSize:'7.5pt', color:'#333', marginTop:2 }}>Tel: 080 22244455</div>
                </td>
                {/* Title */}
                <td colSpan={2} style={{ ...S.td, textAlign:'center', verticalAlign:'middle', border:'1.5px solid #000' }}>
                  <div style={{ fontSize:14, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase' }}>Material / Service Requisition</div>
                </td>
              </tr>
              <tr>
                {/* Serial / Date */}
                <td style={{ ...S.td, verticalAlign:'top', border:'1px solid #000' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ width:60, fontWeight:600, fontSize:'9pt', padding:'2px 4px', whiteSpace:'nowrap' }}>Serial No</td>
                        <td style={{ width:10, padding:'2px 4px', fontSize:'9pt' }}>:</td>
                        <td style={{ fontWeight:700, fontSize:'9pt', padding:'2px 4px' }}>{data.serial_no_formatted || data.mrs_number}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight:600, fontSize:'9pt', padding:'2px 4px' }}>Date</td>
                        <td style={{ padding:'2px 4px', fontSize:'9pt' }}>:</td>
                        <td style={{ fontSize:'9pt', padding:'2px 4px' }}>{fmtDate(data.required_by || data.created_at)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                {/* QR Code */}
                <td style={{ ...S.td, width:80, textAlign:'center', verticalAlign:'middle', border:'1px solid #000' }}>
                  <QRCodeSVG value={verificationUrl} size={60} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* ══ PROJECT INFO ══ */}
          <table style={{ ...S.tbl, border:'1px solid #000', borderTop:'none' }}>
            <tbody>
              <tr>
                <td style={S.thLbl}>Project</td>
                <td style={{ ...S.thVal, width:8 }}>:</td>
                <td style={S.thVal}>{data.project_name}</td>
                <td style={{ ...S.thLbl, borderLeft:'1px solid #000', paddingLeft:8 }}>Serial No</td>
                <td style={{ ...S.thVal, width:8 }}>:</td>
                <td style={S.thVal}>{data.serial_no_formatted || data.mrs_number}</td>
              </tr>
              <tr>
                <td style={S.thLbl}>Project Code</td>
                <td style={S.thVal}>:</td>
                <td style={S.thVal}>{data.project_code}</td>
                <td style={{ ...S.thLbl, borderLeft:'1px solid #000', paddingLeft:8 }}>Date</td>
                <td style={S.thVal}>:</td>
                <td style={S.thVal}>{fmtDate(data.required_by || data.created_at)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ ...S.thLbl, fontWeight:400 }}>
                  <span style={{ fontWeight:700 }}>Head Office / Project Name</span> : {data.head_office_project_name}
                </td>
                <td colSpan={3} style={S.thVal}></td>
              </tr>
              <tr>
                <td style={S.thLbl}>Department</td>
                <td style={S.thVal}>:</td>
                <td style={S.thVal}>{data.department}</td>
                <td colSpan={3} style={S.thVal}></td>
              </tr>
            </tbody>
          </table>

          {/* ══ ITEMS TABLE ══ */}
          <table style={{ ...S.tbl, border:'1px solid #000', borderTop:'none' }}>
            <thead>
              <tr style={{ background:'#dce6f1' }}>
                {[
                  ['SL. NO',   32,  'center'],
                  ['Item Code', 70, 'left'],
                  ['Description', 160, 'left'],
                  ['Unit',     40,  'center'],
                  ['Qty',      40,  'center'],
                  ['Date Required', 80, 'center'],
                  ['Vendor / Supplier (Optional)', 120, 'left'],
                  ['Remarks',  80,  'left'],
                ].map(([label, w, align]) => (
                  <th key={label} style={{ border:'1px solid #000', padding:'5px', fontSize:'8pt', textAlign:align, fontWeight:700, letterSpacing:.3, textTransform:'uppercase', width:w, background:'#dce6f1' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {padded.map((it, i) => (
                <tr key={i}>
                  <td style={{ border:'1px solid #000', padding:'5px', height:22, fontSize:'8.5pt', textAlign:'center', verticalAlign:'middle' }}>{it._blank ? '' : i + 1}</td>
                  <td style={{ border:'1px solid #000', padding:'5px', fontSize:'8.5pt', verticalAlign:'middle' }}>{it._blank ? '' : (it.item_code || '')}</td>
                  <td style={{ border:'1px solid #000', padding:'5px', fontSize:'8.5pt', verticalAlign:'middle' }}>{it._blank ? '' : (it.material_name || it.material || '')}</td>
                  <td style={{ border:'1px solid #000', padding:'5px', fontSize:'8.5pt', textAlign:'center', verticalAlign:'middle', textTransform:'uppercase' }}>{it._blank ? '' : (it.unit || '')}</td>
                  <td style={{ border:'1px solid #000', padding:'5px', fontSize:'8.5pt', textAlign:'center', verticalAlign:'middle' }}>{it._blank ? '' : (it.quantity || it.qty || '')}</td>
                  <td style={{ border:'1px solid #000', padding:'5px', fontSize:'8.5pt', textAlign:'center', verticalAlign:'middle' }}>{it._blank ? '' : fmtDate(it.date_required || it.required_date)}</td>
                  <td style={{ border:'1px solid #000', padding:'5px', fontSize:'8.5pt', verticalAlign:'middle' }}>{it._blank ? '' : (it.vendor || it.preferred_vendor || '')}</td>
                  <td style={{ border:'1px solid #000', padding:'5px', fontSize:'8.5pt', verticalAlign:'middle' }}>{it._blank ? '' : (it.remarks || it.purpose || '')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ══ PURCHASE DEPT ══ */}
          <table style={{ ...S.tbl, border:'1px solid #000', borderTop:'none' }}>
            <tbody>
              <tr>
                <td colSpan={3} style={{ border:'1px solid #000', padding:'4px 7px', fontWeight:700, fontSize:'9pt', background:'#f0f0f0' }}>For The Uses of Purchase Department</td>
                <td colSpan={2} style={{ border:'1px solid #000', padding:'4px 7px', fontWeight:600, background:'#f8f8f8', fontSize:'8.5pt' }}>Processed By</td>
                <td colSpan={2} style={{ border:'1px solid #000', padding:'4px 7px', fontSize:'8.5pt' }}>{data.processed_by_name || ''}</td>
              </tr>
              <tr>
                <td style={{ border:'1px solid #000', padding:'4px 7px', fontWeight:600, background:'#f8f8f8', fontSize:'8.5pt', whiteSpace:'nowrap' }}>Received Date</td>
                <td style={{ border:'1px solid #000', padding:'4px 7px', width:10, fontSize:'8.5pt' }}>:</td>
                <td style={{ border:'1px solid #000', padding:'4px 7px', fontSize:'8.5pt' }}>{fmtDate(data.purchase_received_date)}</td>
                <td colSpan={2} style={{ border:'1px solid #000', padding:'4px 7px', fontWeight:600, background:'#f8f8f8', fontSize:'8.5pt' }}>Date</td>
                <td colSpan={2} style={{ border:'1px solid #000', padding:'4px 7px', fontSize:'8.5pt' }}>{fmtDate(data.processed_at)}</td>
              </tr>
              <tr>
                <td style={{ border:'1px solid #000', padding:'4px 7px', fontWeight:600, background:'#f8f8f8', fontSize:'8.5pt', whiteSpace:'nowrap' }}>Purchase Order No. &amp; Date</td>
                <td style={{ border:'1px solid #000', padding:'4px 7px', width:10, fontSize:'8.5pt' }}>:</td>
                <td style={{ border:'1px solid #000', padding:'4px 7px', fontSize:'8.5pt' }}>{data.po_no_date || ''}</td>
                <td colSpan={2} style={{ border:'1px solid #000', padding:'4px 7px', fontWeight:600, background:'#f8f8f8', fontSize:'8.5pt' }}>Expected Date of Delivery</td>
                <td colSpan={2} style={{ border:'1px solid #000', padding:'4px 7px', fontSize:'8.5pt' }}>{fmtDate(data.expected_delivery_date)}</td>
              </tr>
            </tbody>
          </table>

          {/* ══ APPROVALS ══ */}
          {(() => {
            const approvers = [
              { label: 'Requested By',                        sig: data.raised_by_sig,      name: data.raised_by_name,      date: data.created_at,           title: '' },
              { label: 'Verified and checked by Tower Manager', sig: data.tower_sig_img,    name: data.verified_tower_name,  date: data.verified_tower_mgr_at, title: '' },
              { label: 'Approved by Project Manager',         sig: data.pm_sig_img,         name: data.approved_pm_name,    date: data.approved_pm_at,        title: '' },
              { label: 'Approved by Sr. Project Manager',     sig: data.srpm_sig_img,       name: data.approved_srpm_name,  date: data.approved_sr_pm_at,     title: '' },
              { label: 'Management',                          sig: data.mgmt_sig_img,       name: data.approved_mgmt_name,  date: data.approved_mgmt_at,      title: 'Director:' },
              { label: 'Management',                          sig: data.md_sig_img,         name: data.approved_md_name,    date: data.approved_md_at,        title: 'Managing Director:' },
            ];
            const cellStyle = { border:'1px solid #000', padding:'4px 6px', fontSize:'8pt', width:'16.66%', verticalAlign:'bottom' };
            return (
              <table style={{ ...S.tbl, border:'1px solid #000', borderTop:'none' }}>
                <tbody>
                  {/* Signature images */}
                  <tr>
                    {approvers.map((a, i) => (
                      <td key={i} style={{ ...cellStyle, height:44, textAlign:'center', verticalAlign:'middle' }}>
                        {a.sig ? <img src={a.sig} alt="sig" style={{ maxHeight:36, maxWidth:'90%' }} /> : null}
                      </td>
                    ))}
                  </tr>
                  {/* Labels */}
                  <tr>
                    {approvers.map((a, i) => (
                      <td key={i} style={{ ...cellStyle, fontWeight:700, fontSize:'7.5pt', background:'#f0f4fa', textAlign:'center', height:28, verticalAlign:'middle' }}>{a.label}</td>
                    ))}
                  </tr>
                  {/* Signature lines */}
                  <tr>
                    {approvers.map((_, i) => (
                      <td key={i} style={{ ...cellStyle, paddingBottom:4 }}>
                        <div style={{ borderBottom:'1px solid #000', width:'80%', margin:'0 auto' }}></div>
                      </td>
                    ))}
                  </tr>
                  {/* Names */}
                  <tr>
                    {approvers.map((a, i) => (
                      <td key={i} style={{ ...cellStyle, fontSize:'8pt', paddingTop:3 }}>
                        {a.title ? `${a.title} ` : 'Name: '}{a.name || ''}
                      </td>
                    ))}
                  </tr>
                  {/* Dates */}
                  <tr>
                    {approvers.map((a, i) => (
                      <td key={i} style={{ ...cellStyle, fontSize:'8pt', paddingBottom:5 }}>
                        Date: {fmtDate(a.date)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            );
          })()}

          {/* ══ FOOTER ══ */}
          <div style={{ textAlign:'center', fontSize:'7.5pt', color:'#333', border:'1px solid #000', borderTop:'none', padding:'4px', background:'#f8f8f8' }}>
            BCIM ENGINEERING PRIVATE LIMITED &nbsp;|&nbsp; "B" Wing, Divyasree Chambers, No. 11, O'Shaugnessy Road, Bangalore – 560 025
          </div>

        </div>
      </div>
    </>
  );
}
