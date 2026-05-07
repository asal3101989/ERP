// src/components/common/AssetBarcodeCard.jsx — Professional IT Asset Label
import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download } from 'lucide-react';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Convert logo to base64 so it embeds in print popup
async function getLogoBase64() {
  try {
    const res  = await fetch('/bcim-logo.png');
    const blob = await res.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
  const handlePrint = async () => {
    if (!barcodeVal) return;
    const popup = window.open('', '_blank', 'width=540,height=420');
    if (!popup) return;

    const logoB64  = await getLogoBase64();
    const logoHtml = logoB64
      ? `<img src="${logoB64}" class="logo-img" alt="logo" />`
      : `<div class="logo-placeholder">BCIM</div>`;

    const qrMarkup  = qrRef.current?.innerHTML || '';
    const extraRows = extraFields
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
    @page { size: 105mm 65mm landscape; margin: 0; }
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
      width: 103mm;
      background: #fff;
      border: 2px solid #0f2d6b;
      border-radius: 6px;
      overflow: hidden;
    }

    /* Header */
    .header {
      background: #0f2d6b;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px;
    }
    .logo-img {
      width: 28px;
      height: 28px;
      object-fit: contain;
      background: #fff;
      border-radius: 4px;
      padding: 2px;
      flex-shrink: 0;
    }
    .logo-placeholder {
      width: 28px;
      height: 28px;
      background: #fff;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      font-weight: 900;
      color: #0f2d6b;
      flex-shrink: 0;
    }
    .header-text { flex: 1; }
    .company-name {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #ffffff;
      line-height: 1.2;
    }
    .company-sub {
      font-size: 7px;
      font-weight: 600;
      color: rgba(255,255,255,0.75);
      letter-spacing: 0.05em;
    }
    .it-badge {
      background: #ffffff;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0f2d6b;
      padding: 2px 7px;
      flex-shrink: 0;
    }

    /* Body */
    .body { display: flex; align-items: stretch; }

    /* QR col */
    .qr-col {
      width: 38mm;
      background: #eef2ff;
      border-right: 1.5px dashed #93c5fd;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 6px 6px;
      gap: 4px;
      flex-shrink: 0;
    }
    .qr-box {
      background: #fff;
      border-radius: 4px;
      padding: 5px;
      box-shadow: 0 2px 8px rgba(15,45,107,0.18);
    }
    .qr-box svg { display: block; }
    .scan-text {
      font-size: 6.5px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #374151;
      text-align: center;
    }

    /* Info col */
    .info-col {
      flex: 1;
      padding: 8px 11px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .asset-tag {
      font-family: 'Courier New', monospace;
      font-size: 17px;
      font-weight: 900;
      color: #0f2d6b;
      letter-spacing: 0.06em;
      line-height: 1;
    }
    .device-line {
      font-size: 10px;
      font-weight: 800;
      color: #111827;
      margin-top: 2px;
    }
    .type-line {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #374151;
    }
    .divider {
      border: none;
      border-top: 1.5px solid #d1d5db;
      margin: 4px 0;
    }
    .field { display: flex; align-items: baseline; gap: 5px; margin-bottom: 2.5px; }
    .field-label {
      font-size: 7px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #374151;
      min-width: 38%;
    }
    .field-value {
      font-size: 8px;
      font-weight: 800;
      color: #111827;
      flex: 1;
      word-break: break-all;
    }

    /* Footer */
    .footer {
      background: #0f2d6b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 3px 10px;
    }
    .footer-left {
      font-size: 6.5px;
      font-weight: 700;
      color: rgba(255,255,255,0.85);
      letter-spacing: 0.05em;
    }
    .footer-right {
      font-size: 6.5px;
      font-weight: 700;
      color: rgba(255,255,255,0.65);
    }

    @media print {
      body { min-height: unset; background: #fff; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      ${logoHtml}
      <div class="header-text">
        <div class="company-name">${esc(companyName)}</div>
        <div class="company-sub">IT Asset Management</div>
      </div>
      <span class="it-badge">IT ASSET</span>
    </div>

    <div class="body">
      <div class="qr-col">
        <div class="qr-box">${qrMarkup}</div>
        <div class="scan-text">▸ Scan to identify</div>
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
      <span class="footer-left">▸ Scan QR code to view full asset details</span>
      <span class="footer-right">Property of ${esc(companyName)}</span>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); window.onfocus = function(){ window.close(); }; }</script>
</body>
</html>`);
    popup.document.close();
  };

  /* ── Download QR as SVG ── */
  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
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
      <div className="overflow-hidden rounded-xl border-[2.5px] border-[#0f2d6b] shadow-xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: '#0f2d6b' }}>
          {/* Logo */}
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white p-1 shadow-sm">
            <img src="/bcim-logo.png" alt="BCIM" className="h-full w-full object-contain"
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
            />
            <div className="hidden h-full w-full items-center justify-center text-[9px] font-black text-[#0f2d6b]">
              BCIM
            </div>
          </div>
          {/* Company text */}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.1em] text-white leading-tight">
              {companyName}
            </div>
            <div className="text-[9px] font-semibold text-white/70 leading-tight mt-0.5">
              IT Asset Management
            </div>
          </div>
          {/* Badge */}
          <div className="shrink-0 rounded bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[#0f2d6b]">
            IT ASSET
          </div>
        </div>

        {/* Body */}
        <div className="flex items-stretch bg-white">

          {/* QR Column */}
          <div className="flex flex-col items-center justify-center gap-2 border-r-2 border-dashed border-blue-200 bg-[#eef2ff] px-5 py-4 shrink-0">
            <div className="rounded-lg bg-white p-2.5 shadow-md ring-2 ring-[#0f2d6b]/20">
              <div ref={qrRef}>
                <QRCodeSVG value={barcodeVal} size={size} includeMargin={false} fgColor="#0f2d6b" level="M" />
              </div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-600">
              ▸ Scan to identify
            </p>
          </div>

          {/* Info Column */}
          <div className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-4">
            {/* Asset Tag */}
            <div className="font-mono text-2xl font-black leading-none tracking-wide text-[#0f2d6b]">
              {metaValue || barcodeVal}
            </div>
            {/* Device */}
            <div className="text-sm font-black text-gray-900">{title}</div>
            {subtitle && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                {subtitle}
              </div>
            )}

            {/* Divider */}
            <div className="my-1 border-t-2 border-gray-200" />

            {/* Extra fields */}
            <div className="space-y-1.5">
              {extraFields.filter(f => f.value).map((f, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="min-w-[68px] text-[9px] font-black uppercase tracking-wider text-gray-500">
                    {f.label}
                  </span>
                  <span className="text-[11px] font-bold text-gray-900">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-1.5" style={{ background: '#0f2d6b' }}>
          <span className="text-[9px] font-bold text-white/80 tracking-wide">▸ Scan QR to view full asset details</span>
          <span className="text-[8.5px] font-semibold text-white/60">Property of {companyName}</span>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: '#0f2d6b' }}
        >
          <Printer className="h-4 w-4" />
          Print Label
        </button>
        <button
          type="button"
          onClick={downloadQR}
          title="Download QR as SVG"
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-[#0f2d6b] bg-white px-4 py-2.5 text-sm font-bold text-[#0f2d6b] transition hover:bg-blue-50"
        >
          <Download className="h-4 w-4" />
          QR
        </button>
      </div>
    </div>
  );
}
