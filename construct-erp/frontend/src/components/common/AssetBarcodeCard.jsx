import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ScanLine } from 'lucide-react';
import { clsx } from 'clsx';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function AssetBarcodeCard({
  value,
  title,
  subtitle,
  metaLabel = 'Asset ID',
  metaValue,
  className,
  size = 124,
}) {
  const barcodeValue = String(value || metaValue || title || '').trim();
  const qrWrapperRef = useRef(null);

  const handlePrint = () => {
    if (!barcodeValue || typeof window === 'undefined') return;

    const popup = window.open('', '_blank', 'width=520,height=700');
    if (!popup) return;

    const safeTitle = escapeHtml(title || 'Asset Label');
    const safeSubtitle = escapeHtml(subtitle || '');
    const safeMetaLabel = escapeHtml(metaLabel);
    const safeMetaValue = escapeHtml(metaValue || barcodeValue);
    const safeBarcodeValue = escapeHtml(barcodeValue);
    const qrMarkup = qrWrapperRef.current?.innerHTML || '';

    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${safeTitle}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 24px;
              color: #0f172a;
            }
            .label {
              border: 1px solid #cbd5e1;
              border-radius: 18px;
              padding: 24px;
              width: 100%;
              max-width: 360px;
              margin: 0 auto;
            }
            .eyebrow {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: #475569;
              margin-bottom: 8px;
            }
            .title {
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .subtitle {
              font-size: 13px;
              color: #475569;
              margin-bottom: 16px;
            }
            .qr {
              display: flex;
              justify-content: center;
              padding: 18px;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              background: #fff;
              margin-bottom: 16px;
            }
            .meta {
              font-size: 11px;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.14em;
              margin-bottom: 4px;
            }
            .value {
              font-family: Consolas, monospace;
              font-weight: 700;
              font-size: 18px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="eyebrow">Asset Barcode Label</div>
            <div class="title">${safeTitle}</div>
            ${safeSubtitle ? `<div class="subtitle">${safeSubtitle}</div>` : ''}
            <div class="qr">${qrMarkup}</div>
            <div class="meta">${safeMetaLabel}</div>
            <div class="value">${safeMetaValue}</div>
            <div class="meta" style="margin-top: 14px;">Encoded Value</div>
            <div class="value">${safeBarcodeValue}</div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  if (!barcodeValue) return null;

  return (
    <div className={clsx('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            <ScanLine className="h-3.5 w-3.5 text-slate-500" />
            Asset Barcode
          </div>
          <div className="text-sm font-black text-slate-900">{title || 'Asset Label'}</div>
          {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto,1fr] md:items-center">
        <div ref={qrWrapperRef} className="mx-auto rounded-2xl border border-slate-200 bg-white p-3">
          <QRCodeSVG value={barcodeValue} size={size} includeMargin />
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{metaLabel}</div>
            <div className="mt-1 font-mono text-sm font-bold text-slate-900">{metaValue || barcodeValue}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Encoded Value</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-600">{barcodeValue}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
            Scan this code to identify the asset quickly in IT and asset operations.
          </div>
        </div>
      </div>
    </div>
  );
}
