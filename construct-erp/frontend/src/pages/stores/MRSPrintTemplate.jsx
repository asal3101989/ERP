// src/pages/stores/MRSPrintTemplate.jsx
// Professional A4 Landscape — Segoe UI / Arial, clean navy table headers
import { useRef } from 'react';
import dayjs from 'dayjs';

const fmtDate = (d) => {
  if (!d) return '';
  try { return dayjs(d).format('DD/MM/YYYY'); } catch { return String(d); }
};

const now = () => dayjs().format('D/M/YYYY, h:mm:ss a');

// ── base font stack (professional, works on every OS) ─────────────────────────
const FONT = "'Segoe UI', Calibri, Arial, Helvetica, sans-serif";

// ── Print trigger ─────────────────────────────────────────────────────────────
async function resolveImgSrcs(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:') || src.startsWith('http')) return;
    try {
      const abs = new URL(src, window.location.origin).href;
      const res = await fetch(abs);
      const blob = await res.blob();
      const b64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      img.setAttribute('src', b64);
    } catch { /* leave as-is */ }
  }));
  return doc.body.innerHTML;
}

export function useMRSPrint(ref) {
  return async () => {
    const raw = ref.current?.innerHTML;
    if (!raw) return;
    const content = await resolveImgSrcs(raw);
    const win = window.open('', '_blank', 'width=1280,height=900');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Material Requisition</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Segoe UI',Calibri,Arial,Helvetica,sans-serif;font-size:9pt;color:#000;background:#fff;}
        @page{size:A4 landscape;margin:8mm 12mm;}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };
}

export default function MRSPrintTemplate({ data, onClose }) {
  const printRef = useRef();
  const triggerPrint = useMRSPrint(printRef);

  if (!data) return null;

  const items    = data.items || [];
  const MIN_ROWS = 8;
  const padded   = [
    ...items,
    ...Array.from({ length: Math.max(0, MIN_ROWS - items.length) }, () => ({ _blank: true })),
  ];

  // ── shared cell styles ──────────────────────────────────────────────────────
  const border  = '1px solid #bbb';
  const cell    = (extra = {}) => ({
    border, padding: '5px 8px', verticalAlign: 'middle',
    fontSize: '9pt', fontFamily: FONT, ...extra,
  });
  const hdrCell = (extra = {}) => ({
    ...cell({
      fontWeight: 700, textAlign: 'center',
      background: '#1e3a6e', color: '#fff',
      fontSize: '8pt', letterSpacing: '0.3px',
      padding: '6px 8px',
      ...extra,
    }),
  });

  // ── label : value row helper ────────────────────────────────────────────────
  const LV = ({ label, value, labelW = 148 }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 3 }}>
      <span style={{ width: labelW, fontWeight: 600, fontSize: '8.5pt', color: '#222', flexShrink: 0 }}>{label}</span>
      <span style={{ marginRight: 6, color: '#555' }}>:</span>
      <span style={{ fontSize: '8.5pt', color: '#000' }}>{value}</span>
    </div>
  );

  return (
    <>
      {/* ── Screen toolbar ── */}
      <div style={{
        background: '#1e3a6e', padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100, fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>MR Print Preview</div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12 }}>
            {data.serial_no_formatted || data.mrs_number}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {onClose && (
            <button onClick={onClose} style={{
              padding: '6px 18px', borderRadius: 6,
              background: 'rgba(255,255,255,.15)', color: '#fff',
              border: '1px solid rgba(255,255,255,.2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>← Back</button>
          )}
          <button onClick={triggerPrint} style={{
            padding: '6px 18px', borderRadius: 6,
            background: '#fff', color: '#1e3a6e',
            border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>🖨 Print / Save PDF</button>
        </div>
      </div>

      {/* ── A4 Landscape Preview ── */}
      <div style={{
        background: '#d1d5db', minHeight: 'calc(100vh - 46px)',
        padding: '28px 24px', display: 'flex', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div ref={printRef} style={{
          background: '#fff',
          width: '297mm',
          minHeight: '210mm',
          padding: '9mm 13mm',
          boxShadow: '0 4px 28px rgba(0,0,0,.18)',
          fontFamily: FONT,
          fontSize: '9pt',
          color: '#000',
        }}>

          {/* ══ PAGE HEADER ══ */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            {/* Logo */}
            <div style={{ width: 170, flexShrink: 0 }}>
              <img src="/bcim-logo.png" alt="BCIM" style={{ height: 50, maxWidth: 160, objectFit: 'contain' }} />
            </div>

            {/* Centre — company name + document title */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '11pt', fontWeight: 700, color: '#1e3a6e', letterSpacing: '0.5px', marginBottom: 2 }}>
                BCIM ENGINEERING PRIVATE LIMITED
              </div>
              <div style={{
                display: 'inline-block',
                fontSize: '10pt', fontWeight: 700,
                color: '#000', letterSpacing: '1.5px',
                borderBottom: '2.5px solid #1e3a6e',
                paddingBottom: 2,
              }}>
                MATERIAL / SERVICE REQUISITION
              </div>
            </div>

            {/* Right — tel + serial */}
            <div style={{ width: 170, flexShrink: 0, textAlign: 'right', fontSize: '8pt' }}>
              <div style={{ color: '#444', marginBottom: 2 }}>📞 080 22244455</div>
              <div style={{ fontWeight: 700, color: '#1e3a6e', fontSize: '9pt' }}>
                {data.serial_no_formatted || data.mrs_number}
              </div>
              <div style={{ color: '#555', marginTop: 1 }}>
                Date: {fmtDate(data.required_by || data.created_at)}
              </div>
            </div>
          </div>

          {/* ── thin rule ── */}
          <div style={{ height: 2, background: '#1e3a6e', marginBottom: 7, borderRadius: 1 }} />

          {/* ══ PROJECT INFO BAND ══ */}
          <div style={{
            background: '#f4f6fb', border: '1px solid #d0d8ef',
            borderRadius: 5, padding: '7px 12px', marginBottom: 8,
            display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32,
          }}>
            <div>
              <LV label="Project"                value={data.project_name} />
              <LV label="Project Code"           value={data.project_code || '—'} />
            </div>
            <div>
              <LV label="Head Office / Project"  value={data.head_office_project_name || '—'} />
              <LV label="Department"             value={data.department || '—'} />
            </div>
          </div>

          {/* ══ ITEMS TABLE ══ */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={hdrCell({ width: 36 })}>SL.<br />NO</th>
                <th style={hdrCell({ width: 78 })}>ITEM CODE</th>
                <th style={hdrCell({ textAlign: 'left' })}>DESCRIPTION</th>
                <th style={hdrCell({ width: 52 })}>UNIT</th>
                <th style={hdrCell({ width: 54 })}>QTY</th>
                <th style={hdrCell({ width: 82 })}>DATE<br />REQUIRED</th>
                <th style={hdrCell({ width: 140 })}>VENDOR / SUPPLIER<br />[OPTIONAL]</th>
                <th style={hdrCell({ width: 100 })}>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {padded.map((it, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafc' }}>
                  <td style={cell({ textAlign: 'center', height: 30, color: '#555', fontSize: '8.5pt' })}>
                    {it._blank ? '' : i + 1}
                  </td>
                  <td style={cell({ textAlign: 'center', fontSize: '8.5pt', color: '#444' })}>
                    {it._blank ? '' : (it.item_code || '')}
                  </td>
                  <td style={cell({ textAlign: 'left' })}>
                    {!it._blank && (
                      <>
                        <div style={{ fontWeight: 600, fontSize: '9pt', color: '#000' }}>
                          {(it.material_name || it.material || '').toUpperCase()}
                        </div>
                        {it.purpose && (
                          <div style={{ fontSize: '7.5pt', color: '#666', marginTop: 1 }}>{it.purpose}</div>
                        )}
                      </>
                    )}
                  </td>
                  <td style={cell({ textAlign: 'center', textTransform: 'uppercase', fontSize: '8.5pt' })}>
                    {it._blank ? '' : (it.unit || '')}
                  </td>
                  <td style={cell({ textAlign: 'center', fontWeight: 600 })}>
                    {it._blank ? '' : (it.quantity ?? it.qty ?? '')}
                  </td>
                  <td style={cell({ textAlign: 'center', fontSize: '8.5pt' })}>
                    {it._blank ? '' : fmtDate(it.date_required || it.required_date)}
                  </td>
                  <td style={cell({ fontSize: '8.5pt' })}>
                    {it._blank ? '' : (it.vendor || it.preferred_vendor || '')}
                  </td>
                  <td style={cell({ fontSize: '8.5pt' })}>
                    {it._blank ? '' : (it.remarks || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ══ PURCHASE DEPT ══ */}
          <div style={{
            border: '1px solid #bbb', borderTop: 'none',
            background: '#fafbfc', padding: '6px 10px',
          }}>
            <div style={{
              fontWeight: 700, fontSize: '8.5pt', marginBottom: 5,
              textDecoration: 'underline', color: '#1e3a6e',
            }}>
              For The Use of Purchase Department:
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', marginBottom: 4 }}>
              <div>
                Received Date :&nbsp;
                <span style={{ display: 'inline-block', width: 170, borderBottom: '1px solid #888', color: '#000' }}>
                  {fmtDate(data.purchase_received_date)}
                </span>
              </div>
              <div>
                Processed By :&nbsp;
                <span style={{ display: 'inline-block', width: 120, borderBottom: '1px solid #888' }}>
                  {data.processed_by_name || ''}
                </span>
                &nbsp;&nbsp;Date :&nbsp;
                <span style={{ display: 'inline-block', width: 90, borderBottom: '1px solid #888' }}>
                  {fmtDate(data.processed_at)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt' }}>
              <div>
                Purchase Order No. &amp; Date :&nbsp;
                <span style={{ display: 'inline-block', width: 160, borderBottom: '1px solid #888' }}>
                  {data.po_no_date || ''}
                </span>
              </div>
              <div>
                Expected Date of Delivery :&nbsp;
                <span style={{ display: 'inline-block', width: 130, borderBottom: '1px solid #888' }}>
                  {fmtDate(data.expected_delivery_date)}
                </span>
              </div>
            </div>
          </div>

          {/* ══ APPROVALS ══ */}
          {(() => {
            const cols = [
              { label: 'Requested By',                        name: data.raised_by_name,      date: data.created_at,            sig: data.raised_by_sig  },
              { label: 'Verified and Checked by\nTower Manager', name: data.verified_tower_name, date: data.verified_tower_mgr_at, sig: data.tower_sig_img  },
              { label: 'Approved by\nProject Leader',         name: data.approved_pm_name,    date: data.approved_pm_at,        sig: data.pm_sig_img     },
              { label: 'Approved by\nSr. Project Manager',    name: data.approved_srpm_name,  date: data.approved_sr_pm_at,     sig: data.srpm_sig_img   },
              { label: 'Management\n(Director)',               name: data.approved_mgmt_name,  date: data.approved_mgmt_at,      sig: data.mgmt_sig_img   },
              { label: 'Management\n(Managing Director)',      name: data.approved_md_name,    date: data.approved_md_at,        sig: data.md_sig_img     },
            ];
            const w = `${(100 / cols.length).toFixed(3)}%`;
            const approvalBorder = '1px solid #bbb';
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
                <tbody>
                  {/* Label row — navy bg */}
                  <tr>
                    {cols.map((c, i) => (
                      <td key={i} style={{
                        border: approvalBorder, width: w,
                        padding: '5px 6px',
                        fontWeight: 700, fontSize: '7.5pt',
                        textAlign: 'center', verticalAlign: 'middle',
                        whiteSpace: 'pre-line', lineHeight: 1.4,
                        background: '#1e3a6e', color: '#fff',
                      }}>
                        {c.label}
                      </td>
                    ))}
                  </tr>
                  {/* Signature row */}
                  <tr>
                    {cols.map((c, i) => (
                      <td key={i} style={{
                        border: approvalBorder, width: w,
                        height: 48, padding: '4px 6px',
                        textAlign: 'center', verticalAlign: 'middle',
                        background: '#fff',
                      }}>
                        {c.sig
                          ? <img src={c.sig} alt="sig" style={{ maxHeight: 38, maxWidth: '92%' }} />
                          : null}
                      </td>
                    ))}
                  </tr>
                  {/* Name + Date row */}
                  <tr>
                    {cols.map((c, i) => (
                      <td key={i} style={{
                        border: approvalBorder, width: w,
                        padding: '4px 7px', fontSize: '7.5pt',
                        verticalAlign: 'top', background: '#fafbfc',
                      }}>
                        <div style={{ marginBottom: 1 }}>
                          <span style={{ color: '#555' }}>Name : </span>
                          <span style={{ fontWeight: 600 }}>{c.name || ''}</span>
                        </div>
                        <div>
                          <span style={{ color: '#555' }}>Date : </span>
                          {fmtDate(c.date)}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            );
          })()}

          {/* ══ FOOTER ══ */}
          <div style={{
            textAlign: 'center', fontSize: '7pt', color: '#888',
            marginTop: 5, fontFamily: FONT,
            borderTop: '1px solid #e0e0e0', paddingTop: 4,
          }}>
            BCIM Engineering Private Limited &nbsp;·&nbsp; Computer-generated document &nbsp;·&nbsp; Printed on {now()}
          </div>

        </div>
      </div>
    </>
  );
}
