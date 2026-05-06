// src/components/common/AssetBarcodeCard.jsx — Professional IT Asset Label
import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download } from 'lucide-react';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function AssetBarcodeCard({
  value,
  title,
  subtitle,
  metaLabel = 'Asset Tag',
  metaValue,
  extraFields = [],
  className,
  size = 130,
  companyName = 'BCIM Engineering Pvt Ltd',
}) {
  const qrRef      = useRef(null);
  const barcodeVal = String(value || metaValue || title || '').trim();

  /* ── Print popup ── */
  const handlePrint = () => {
    if (!barcodeVal) return;
    const popup = window.open('', '_blank', 'width=500,height=400');
    if (!popup) return;

    const qrMarkup   = qrRef.current?.innerHTML || '';
    const extraRows  = extraFields
      .filter(f => f.value)
      .map(f => `
        <div class="field">
          <span class="field-label">${esc(f.label)}</span>
          <span class="field-value">${esc(f.value)}</span>
        </div>`).join('');

    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Asset Label — ${esc(metaValue || barcodeVal)}</title>
  <style>
    @page { size: 100mm 60mm landscape; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .label {
      width: 98mm;
      background: #fff;
      border: 1.5px solid #1e3a5f;
      border-radius: 5px;
      overflow: hidden;
    }

    /* Top header */
    .header {
      background: linear-gradient(135deg, #0f2d6b 0%, #1a56db 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 10px;
    }
    .company-name {
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #fff;
    }
    .it-badge {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 3px;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #fff;
      padding: 1px 6px;
    }

    /* Body */
    .body {
      display: flex;
      align-items: stretch;
    }

    /* QR side */
    .qr-col {
      width: 36mm;
      background: #f0f4ff;
      border-right: 1px dashed #93c5fd;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 7px 6px 5px;
      gap: 4px;
    }
    .qr-box {
      background: #fff;
      border-radius: 4px;
      padding: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    }
    .qr-box svg { display: block; }
    .scan-text {
      font-size: 6px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #6b7280;
      text-align: center;
    }

    /* Info side */
    .info-col {
      flex: 1;
      padding: 7px 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .asset-tag {
      font-family: 'Courier New', monospace;
      font-size: 16px;
      font-weight: 900;
      color: #0f2d6b;
      letter-spacing: 0.05em;
      line-height: 1;
    }
    .device-line {
      font-size: 9.5px;
      font-weight: 700;
      color: #1f2937;
      margin-top: 1px;
    }
    .type-line {
      font-size: 7.5px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #6b7280;
    }

    .divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 4px 0;
    }

    .field { display: flex; align-items: baseline; gap: 4px; margin-bottom: 2px; }
    .field-label {
      font-size: 6.5px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9ca3af;
      min-width: 36%;
    }
    .field-value {
      font-size: 7.5px;
      font-weight: 600;
      color: #111827;
      flex: 1;
      word-break: break-all;
    }

    /* Footer */
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 3px 10px;
    }
    .footer-left { font-size: 6.5px; color: #9ca3af; letter-spacing: 0.05em; }
    .footer-right { font-size: 6px; color: #d1d5db; font-style: italic; }

    @media print {
      body { min-height: unset; background: #fff; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <span class="company-name">${esc(companyName)}</span>
      <span class="it-badge">IT ASSET</span>
    </div>
    <div class="body">
      <div class="qr-col">
        <div class="qr-box">${qrMarkup}</div>
        <div class="scan-text">Scan to identify</div>
      </div>
      <div class="info-col">
        <div class="asset-tag">${esc(metaValue || barcodeVal)}</div>
        <div class="device-line">${esc(title || '')}</div>
        ${subtitle ? `<div class="type-line">${esc(subtitle)}</div>` : ''}
        <hr class="divider"/>
        ${extraRows}
      </div>
    </div>
    <div class="footer">
      <span class="footer-left">Scan QR to view full asset details</span>
      <span class="footer-right">Property of ${esc(companyName)}</span>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); window.onfocus = function(){ window.close(); }; }</script>
</body>
</html>`);
    popup.document.close();
  };

  /* ── Download QR as PNG ── */
  const downloadQR = () => {
    const svg  = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const xml  = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${barcodeVal}_QR.svg`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  if (!barcodeVal) return null;

  return (
    <div className={className}>
      {/* ── Sticker Preview ── */}
      <div className="overflow-hidden rounded-xl border-2 border-[#1e3a5f] shadow-lg">

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'linear-gradient(135deg, #0f2d6b 0%, #1a56db 100%)' }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">
            {companyName}
          </span>
          <span className="rounded border border-white/30 bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            IT ASSET
          </span>
        </div>

        {/* Body */}
        <div className="flex items-stretch bg-white">

          {/* QR Column */}
          <div className="flex flex-col items-center justify-center gap-2 border-r border-dashed border-blue-200 bg-[#f0f4ff] px-5 py-4">
            <div className="rounded-lg bg-white p-2 shadow-md ring-1 ring-blue-100">
              <div ref={qrRef}>
                <QRCodeSVG
                  value={barcodeVal}
                  size={size}
                  includeMargin={false}
                  fgColor="#0f2d6b"
                  level="M"
                />
              </div>
            </div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-gray-400">
              Scan to identify
            </p>
          </div>

          {/* Info Column */}
          <div className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-4">
            {/* Asset Tag */}
            <div className="font-mono text-2xl font-black leading-none tracking-wide text-[#0f2d6b]">
              {metaValue || barcodeVal}
            </div>
            {/* Device */}
            <div className="text-sm font-bold text-gray-900">{title}</div>
            {subtitle && (
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {subtitle}
              </div>
            )}

            {/* Divider */}
            <div className="my-1 border-t border-gray-100" />

            {/* Extra fields */}
            <div className="space-y-1">
              {extraFields.filter(f => f.value).map((f, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="min-w-[72px] text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                    {f.label}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-800">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-1.5">
          <span className="text-[9px] text-gray-400 tracking-wide">Scan QR to view full asset details</span>
          <span className="text-[8px] italic text-gray-300">Property of {companyName}</span>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f2d6b] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a3f8f]"
        >
          <Printer className="h-4 w-4" />
          Print Label
        </button>
        <button
          type="button"
          onClick={downloadQR}
          title="Download QR as SVG"
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          QR
        </button>
      </div>
    </div>
  );
}
