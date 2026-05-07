// src/pages/stores/MRSPrintTemplate.jsx
// Layout matches the reference PDF — A4 Landscape, clean bordered tables
import { useRef } from 'react';
import dayjs from 'dayjs';

const fmtDate = (d) => {
  if (!d) return '';
  try { return dayjs(d).format('DD/MM/YYYY'); } catch { return String(d); }
};

const now = () => dayjs().format('D/M/YYYY, h:mm:ss a');

// ── Print trigger ─────────────────────────────────────────────────────────────
export function useMRSPrint(ref) {
  return () => {
    const content = ref.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=1200,height=900');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Material Requisition</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Courier New',Courier,monospace;font-size:9pt;color:#000;background:#fff;}
        @page{size:A4 landscape;margin:10mm 12mm;}
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
  const border   = '1px solid #000';
  const cell     = (extra = {}) => ({ border, padding: '5px 7px', verticalAlign: 'middle', fontSize: '9pt', ...extra });
  const hdrCell  = (extra = {}) => ({ ...cell({ fontWeight: 700, textAlign: 'center', background: '#fff', ...extra }) });

  return (
    <>
      {/* ── Screen toolbar ── */}
      <div style={{ background: '#1e3a6e', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>MR Print Preview</div>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{data.serial_no_formatted || data.mrs_number}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {onClose && (
            <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 5, background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          )}
          <button onClick={triggerPrint} style={{ padding: '6px 16px', borderRadius: 5, background: '#fff', color: '#1e3a6e', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖨 Print / Save PDF</button>
        </div>
      </div>

      {/* ── A4 Landscape Preview ── */}
      <div style={{ background: '#d1d5db', minHeight: 'calc(100vh - 46px)', padding: '28px 24px', display: 'flex', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
        <div ref={printRef} style={{
          background: '#fff',
          width: '297mm',
          minHeight: '210mm',
          padding: '10mm 14mm',
          boxShadow: '0 4px 24px rgba(0,0,0,.2)',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '9pt',
          color: '#000',
        }}>

          {/* ══ PAGE HEADER ══ */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '13pt', fontWeight: 700, textDecoration: 'underline', letterSpacing: 1, fontFamily: 'Arial,sans-serif' }}>
                MATERIAL / SERVICE REQUISITION
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'right', fontSize: '9pt', fontWeight: 600 }}>
              Tel : 080 22244455
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '2px solid #000', margin: '4px 0 6px' }} />

          {/* ══ PROJECT INFO ══ */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 8 }}>
            {/* Left block */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '140px 12px 1fr', rowGap: 2 }}>
              {[
                ['Project',                data.project_name],
                ['Project Code',          data.project_code || ''],
                ['Head office / Project M', data.head_office_project_name || ''],
                ['Department',            data.department || ''],
              ].map(([lbl, val]) => (
                <>
                  <div key={lbl + 'l'} style={{ fontWeight: 700, fontSize: '9pt' }}>{lbl}</div>
                  <div key={lbl + 'c'} style={{ fontSize: '9pt' }}>:</div>
                  <div key={lbl + 'v'} style={{ fontSize: '9pt' }}>{val}</div>
                </>
              ))}
            </div>
            {/* Right block */}
            <div style={{ width: 220, display: 'grid', gridTemplateColumns: '60px 12px 1fr', rowGap: 2 }}>
              {[
                ['Serial #', data.serial_no_formatted || data.mrs_number],
                ['Date',     fmtDate(data.required_by || data.created_at)],
              ].map(([lbl, val]) => (
                <>
                  <div key={lbl + 'l'} style={{ fontWeight: 700, fontSize: '9pt' }}>{lbl}</div>
                  <div key={lbl + 'c'} style={{ fontSize: '9pt' }}>:</div>
                  <div key={lbl + 'v'} style={{ fontSize: '9pt' }}>{val}</div>
                </>
              ))}
            </div>
          </div>

          {/* ══ ITEMS TABLE ══ */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={hdrCell({ width: 40 })}>SL. NO</th>
                <th style={hdrCell({ width: 80 })}>ITEM CODE</th>
                <th style={hdrCell({ minWidth: 220, textAlign: 'left' })}>DESCRIPTION</th>
                <th style={hdrCell({ width: 50 })}>UNIT</th>
                <th style={hdrCell({ width: 50 })}>QTY</th>
                <th style={hdrCell({ width: 90 })}>DATE<br />REQUIRED</th>
                <th style={hdrCell({ width: 140 })}>VENDOR / SUPPLIER<br />[OPTIONAL]</th>
                <th style={hdrCell({ width: 100 })}>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {padded.map((it, i) => (
                <tr key={i}>
                  <td style={cell({ textAlign: 'center', height: 32 })}>
                    {it._blank ? '' : i + 1}
                  </td>
                  <td style={cell({ textAlign: 'center' })}>
                    {it._blank ? '' : (it.item_code || '')}
                  </td>
                  <td style={cell({ textAlign: 'left' })}>
                    {!it._blank && (
                      <>
                        <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '9pt' }}>
                          {it.material_name || it.material || ''}
                        </div>
                        {it.purpose && (
                          <div style={{ fontSize: '7.5pt', color: '#444', marginTop: 1 }}>{it.purpose}</div>
                        )}
                      </>
                    )}
                  </td>
                  <td style={cell({ textAlign: 'center', textTransform: 'uppercase' })}>
                    {it._blank ? '' : (it.unit || '')}
                  </td>
                  <td style={cell({ textAlign: 'center' })}>
                    {it._blank ? '' : (it.quantity ?? it.qty ?? '')}
                  </td>
                  <td style={cell({ textAlign: 'center' })}>
                    {it._blank ? '' : fmtDate(it.date_required || it.required_date)}
                  </td>
                  <td style={cell()}>
                    {it._blank ? '' : (it.vendor || it.preferred_vendor || '')}
                  </td>
                  <td style={cell()}>
                    {it._blank ? '' : (it.remarks || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ══ PURCHASE DEPT ══ */}
          <div style={{ border, borderTop: 'none', padding: '6px 8px', marginBottom: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '9pt', textDecoration: 'underline', marginBottom: 5 }}>
              For The Use of Purchase Department:
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: 3 }}>
              <div>
                Received Date :&nbsp;
                <span style={{ display: 'inline-block', width: 180, borderBottom: '1px solid #000' }}>
                  {fmtDate(data.purchase_received_date)}
                </span>
              </div>
              <div>
                Processed By :&nbsp;
                <span style={{ display: 'inline-block', width: 110, borderBottom: '1px solid #000' }}>
                  {data.processed_by_name || ''}
                </span>
                &nbsp;&nbsp;Date :&nbsp;
                <span style={{ display: 'inline-block', width: 90, borderBottom: '1px solid #000' }}>
                  {fmtDate(data.processed_at)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
              <div>
                Purchase order No. &amp; Date :&nbsp;
                <span style={{ display: 'inline-block', width: 160, borderBottom: '1px solid #000' }}>
                  {data.po_no_date || ''}
                </span>
              </div>
              <div>
                Expected Date of Delivery :&nbsp;
                <span style={{ display: 'inline-block', width: 130, borderBottom: '1px solid #000' }}>
                  {fmtDate(data.expected_delivery_date)}
                </span>
              </div>
            </div>
          </div>

          {/* ══ APPROVALS ══ */}
          {(() => {
            const cols = [
              { label: 'Requested By',                     name: data.raised_by_name,      date: data.created_at,            sig: data.raised_by_sig   },
              { label: 'Verified and checked by\nTower Manager',   name: data.verified_tower_name, date: data.verified_tower_mgr_at, sig: data.tower_sig_img   },
              { label: 'Approved by Project\nLeader',      name: data.approved_pm_name,    date: data.approved_pm_at,        sig: data.pm_sig_img      },
              { label: 'Approved by Sr. Project\nManager', name: data.approved_srpm_name,  date: data.approved_sr_pm_at,     sig: data.srpm_sig_img    },
              { label: 'Management\n(Director)',            name: data.approved_mgmt_name,  date: data.approved_mgmt_at,      sig: data.mgmt_sig_img    },
              { label: 'Management\n(Managing Director)',   name: data.approved_md_name,    date: data.approved_md_at,        sig: data.md_sig_img      },
            ];
            const w = `${(100 / cols.length).toFixed(4)}%`;
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
                <tbody>
                  {/* Label row */}
                  <tr>
                    {cols.map((c, i) => (
                      <td key={i} style={{ border, width: w, padding: '4px 6px', fontWeight: 700, fontSize: '8pt', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'pre-line' }}>
                        {c.label}
                      </td>
                    ))}
                  </tr>
                  {/* Signature space */}
                  <tr>
                    {cols.map((c, i) => (
                      <td key={i} style={{ border, width: w, height: 44, padding: '4px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {c.sig
                          ? <img src={c.sig} alt="sig" style={{ maxHeight: 36, maxWidth: '90%' }} />
                          : null}
                      </td>
                    ))}
                  </tr>
                  {/* Name + Date */}
                  <tr>
                    {cols.map((c, i) => (
                      <td key={i} style={{ border, width: w, padding: '4px 6px', fontSize: '8pt', verticalAlign: 'top' }}>
                        <div>Name :&nbsp; {c.name || ''}</div>
                        <div style={{ marginTop: 2 }}>Date :&nbsp; {fmtDate(c.date)}</div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            );
          })()}

          {/* ══ FOOTER ══ */}
          <div style={{ textAlign: 'center', fontSize: '7pt', color: '#555', marginTop: 6, fontFamily: 'Arial,sans-serif' }}>
            BCIM Engineering Private Limited &nbsp;·&nbsp; Computer-generated document &nbsp;·&nbsp; Printed on {now()}
          </div>

        </div>
      </div>
    </>
  );
}
