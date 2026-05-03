// src/components/common/AssetBarcodeCard.jsx
// Professional printable asset label — sticker-style
import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';

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
  extraFields = [],   // [{ label, value }]
  className,
  size = 140,
  companyName = 'BCIM Engineering Pvt Ltd',
}) {
  const qrRef       = useRef(null);
  const barcodeVal  = String(value || metaValue || title || '').trim();

  const handlePrint = () => {
    if (!barcodeVal || typeof window === 'undefined') return;
    const popup = window.open('', '_blank', 'width=420,height=620');
    if (!popup) return;

    const safeCompany   = esc(companyName);
    const safeTitle     = esc(title     || barcodeVal);
    const safeSubtitle  = esc(subtitle  || '');
    const safeMetaVal   = esc(metaValue || barcodeVal);
    const qrMarkup      = qrRef.current?.innerHTML || '';

    // Build extra fields rows
    const extraRows = extraFields
      .filter(f => f.value)
      .map(f => `<tr><td class="lbl">${esc(f.label)}</td><td class="val">${esc(f.value)}</td></tr>`)
      .join('');

    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Asset Label — ${safeMetaVal}</title>
  <style>
    @page { size: 90mm 60mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, sans-serif;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    /* ── Sticker Label ── */
    .sticker {
      width: 88mm;
      border: 1.5px solid #1a73e8;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    /* Header band */
    .header {
      background: #1a73e8;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
    }
    .company { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .badge   { font-size: 8px; background: rgba(255,255,255,0.25); border-radius: 3px; padding: 1px 5px; }

    /* Body: QR left, details right */
    .body {
      display: flex;
      align-items: stretch;
      background: #fff;
    }

    .qr-col {
      border-right: 1px dashed #bfdbfe;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f0f7ff;
      min-width: 58mm;
    }
    .qr-col svg { display: block; }
    .scan-hint { margin-top: 4px; font-size: 6.5px; color: #6b7280; letter-spacing: 0.08em; text-transform: uppercase; }

    .info-col {
      flex: 1;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
    }

    .asset-tag {
      font-size: 14px;
      font-weight: 800;
      color: #1a73e8;
      letter-spacing: 0.04em;
      word-break: break-all;
    }
    .device-name {
      font-size: 10px;
      font-weight: 700;
      color: #111827;
    }
    .device-type {
      font-size: 8.5px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    table.fields { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.fields td { font-size: 7.5px; padding: 1.5px 0; vertical-align: top; }
    td.lbl { color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; width: 40%; }
    td.val { color: #111827; font-weight: 600; word-break: break-all; }

    /* Footer */
    .footer {
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      text-align: center;
      font-size: 7px;
      color: #9ca3af;
      padding: 3px 8px;
      letter-spacing: 0.04em;
    }

    @media print {
      body { min-height: unset; }
    }
  </style>
</head>
<body>
  <div class="sticker">
    <div class="header">
      <span class="company">${safeCompany}</span>
      <span class="badge">IT ASSET</span>
    </div>
    <div class="body">
      <div class="qr-col">
        ${qrMarkup}
        <div class="scan-hint">Scan to identify</div>
      </div>
      <div class="info-col">
        <div class="asset-tag">${safeMetaVal}</div>
        <div class="device-name">${safeTitle}</div>
        ${safeSubtitle ? `<div class="device-type">${safeSubtitle}</div>` : ''}
        ${extraRows ? `<table class="fields">${extraRows}</table>` : ''}
      </div>
    </div>
    <div class="footer">Scan QR Code to view asset details &nbsp;·&nbsp; ${safeCompany}</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`);
    popup.document.close();
  };

  if (!barcodeVal) return null;

  return (
    <div className={className}>
      {/* Preview Card */}
      <div className="overflow-hidden rounded-xl border-2 border-blue-200 bg-white shadow">
        {/* Header */}
        <div className="flex items-center justify-between bg-blue-600 px-4 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-white">{companyName}</span>
          <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">IT ASSET</span>
        </div>

        {/* Body */}
        <div className="flex items-stretch">
          {/* QR */}
          <div className="flex flex-col items-center justify-center border-r border-dashed border-blue-200 bg-blue-50 p-4">
            <div ref={qrRef}>
              <QRCodeSVG value={barcodeVal} size={size} includeMargin={false} />
            </div>
            <p className="mt-2 text-[9px] uppercase tracking-widest text-gray-400">Scan to identify</p>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col justify-center gap-1.5 p-4">
            <div className="text-xl font-extrabold tracking-tight text-blue-600">{metaValue || barcodeVal}</div>
            <div className="text-sm font-bold text-gray-900">{title}</div>
            {subtitle && <div className="text-xs uppercase tracking-wider text-gray-400">{subtitle}</div>}
            {extraFields.filter(f => f.value).map((f, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-gray-400">{f.label}:</span>
                <span className="font-semibold text-gray-700">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 py-1.5 text-center text-[9px] text-gray-400">
          Scan QR Code to view asset details · {companyName}
        </div>
      </div>

      {/* Print Button */}
      <button
        type="button"
        onClick={handlePrint}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
      >
        <Printer className="h-4 w-4" />
        Print Asset Label
      </button>
    </div>
  );
}
