// src/pages/procurement/POPrintTemplate.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';

const POPrintTemplate = React.forwardRef(({ data }, ref) => {
  const verificationUrl = data ? `${window.location.origin}/verify/po/${data.id}` : '';
  const items = data?.items || [];
  
  // Calculate totals
  const subTotal = items.reduce((s, it) => s + (parseFloat(it.quantity) * parseFloat(it.rate)), 0);
  const totalGst = items.reduce((s, it) => s + parseFloat(it.gst_amount || 0), 0);
  const grandTotal = subTotal + totalGst;

  const inr = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

  return (
    <div ref={ref} className="po-print-wrapper overflow-visible">
      {!data ? (
        <div className="p-10 text-center font-bold text-slate-900 border-2 border-dashed border-slate-200 rounded-xl">
          Preparing High-Quality Purchase Order...
        </div>
      ) : (
        <div className="po-print-container bg-white text-black p-12 font-sans" style={{ minHeight: '297mm', width: '210mm', position: 'relative', boxSizing: 'border-box' }}>
          
          {/* Header Section */}
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
            <div className="flex flex-col">
              <img src="/bcim-logo.png" alt="BCIM" className="h-14 object-contain mb-2 self-start" />
              <div className="text-[10px] leading-tight text-slate-700">
                <p className="font-bold text-sm">BCIM ENGINEERING PRIVATE LIMITED</p>
                <p>#123 Business Hub, MG Road, Bangalore - 560001</p>
                <p>GSTIN: 29AAXCB2929P1Z1</p>
                <p>Tel: +91 80 22244455 | Email: procurement@bcim.in</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-black text-slate-900 mb-1">PURCHASE ORDER</h1>
              <div className="bg-black text-white px-3 py-1 inline-block text-xs font-bold rounded">
                REF: {data.serial_no_formatted || data.po_number}
              </div>
              <div className="mt-3">
                 <QRCodeSVG value={verificationUrl} size={50} />
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
            {/* Vendor Details */}
            <div className="border border-slate-200 p-3 rounded-lg">
              <h3 className="font-black text-[10px] uppercase text-slate-500 mb-2 border-b border-slate-100 pb-1">Vendor Information</h3>
              <p className="text-sm font-bold">{data.vendor_name}</p>
              <p className="text-slate-600 mt-1 whitespace-pre-line">{data.vendor_address || 'Vendor Address Not Provided'}</p>
              <p className="mt-2 font-medium">GSTIN: {data.vendor_gstin || '---'}</p>
            </div>
            
            {/* PO Summary */}
            <div className="space-y-2">
              <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                <span className="font-bold text-slate-500 uppercase text-[9px]">PO Date</span>
                <span className="font-bold">{dayjs(data.po_date).format('DD MMM YYYY')}</span>
              </div>
              <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Exp. Delivery</span>
                <span className="font-bold">{data.delivery_date ? dayjs(data.delivery_date).format('DD MMM YYYY') : 'As Per Terms'}</span>
              </div>
              <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Project Name</span>
                <span className="font-bold">{data.project_name}</span>
              </div>
              <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Project Code</span>
                <span className="font-mono">{data.project_code}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                  <th className="border border-black p-2 w-10 text-center">SL</th>
                  <th className="border border-black p-2 text-left">Material Description & HSN</th>
                  <th className="border border-black p-2 w-16 text-center">Unit</th>
                  <th className="border border-black p-2 w-16 text-center">Qty</th>
                  <th className="border border-black p-2 w-24 text-right">Rate</th>
                  <th className="border border-black p-2 w-16 text-center">GST%</th>
                  <th className="border border-black p-2 w-28 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((it, i) => (
                  <tr key={it.id} className="border-b border-slate-200">
                    <td className="border border-black p-2 text-center">{i + 1}</td>
                    <td className="border border-black p-2">
                      <p className="font-bold text-slate-900">{it.material_name}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-tighter">HSN: {it.hsn_code || '---'}</p>
                    </td>
                    <td className="border border-black p-2 text-center uppercase">{it.unit}</td>
                    <td className="border border-black p-2 text-center font-bold">{parseFloat(it.quantity)}</td>
                    <td className="border border-black p-2 text-right">₹{parseFloat(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-2 text-center">{parseFloat(it.gst_rate)}%</td>
                    <td className="border border-black p-2 text-right font-black">
                      ₹{parseFloat(it.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )) : (
                  [...Array(10)].map((_, i) => (
                    <tr key={i} className="h-8 border border-black italic text-slate-100 text-[10px]">
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                      <td className="border border-black p-2"></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-between items-start mb-8">
            <div className="w-1/2 p-3 border border-slate-200 rounded-lg bg-slate-50 text-[10px]">
              <h4 className="font-bold uppercase text-slate-400 mb-2 border-b border-slate-200 pb-1">Amount in Words</h4>
              <p className="font-bold italic text-slate-700">Rupees Only</p>
            </div>
            <div className="w-1/3 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="font-bold text-slate-500 uppercase">Sub Total</span>
                <span className="font-bold">₹{parseFloat(subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[11px] pb-1 border-b border-slate-300">
                <span className="font-bold text-slate-500 uppercase">Total GST</span>
                <span className="font-bold">₹{parseFloat(totalGst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm bg-slate-900 text-white p-2 rounded">
                <span className="font-black uppercase tracking-wider">Grand Total</span>
                <span className="font-black tracking-tight">₹{parseFloat(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="mb-10 text-[9px] border border-slate-200 p-3 rounded-lg">
             <h4 className="font-black text-slate-900 uppercase mb-2">Terms & Conditions</h4>
             <ul className="list-decimal list-inside space-y-1 text-slate-600">
                <li>Rate is inclusive of Freight and loading/unloading unless specified otherwise.</li>
                <li>Material should exactly match the specifications provided.</li>
                <li>Tax Invoice must reach our accounts department within 2 days of delivery.</li>
                <li>BCIM Engineering Private Limited reserves the right to reject sub-standard material.</li>
             </ul>
          </div>

          {/* Bank Details */}
          <div className="grid grid-cols-2 gap-8 text-[9px] mb-8">
             <div className="border border-slate-200 p-2 rounded">
                <h4 className="font-bold text-slate-500 uppercase mb-1">Company Bank Details</h4>
                <p>BANK: HDFC BANK LTD</p>
                <p>A/C NO: 502000482930219</p>
                <p>IFSC: HDFC0000043</p>
             </div>
             <div className="italic text-slate-500 flex items-end justify-center text-center">
                This is a computer generated document and does not require a physical signature if verified via QR.
             </div>
          </div>

          {/* Approval Grid */}
          <div className="grid grid-cols-4 border border-black text-[9px] h-24 mt-auto">
            {/* Stage 1: Auditor */}
            <div className="border-r border-black flex flex-col items-center p-1 text-center">
               <div className="flex-1 flex flex-col items-center justify-center">
                  {data.verified_audit_sig ? (
                    <img src={data.verified_audit_sig} alt="Sig" className="max-h-10 max-w-full" />
                  ) : (
                    <div className="text-slate-300 italic">Digitally Signed</div>
                  )}
               </div>
               <div className="font-bold border-t border-black w-full pt-1">Procurement / Auditor</div>
               <p className="text-[8px]">{data.verified_audit_name || 'Pending'}</p>
            </div>

            {/* Stage 2: Finance */}
            <div className="border-r border-black flex flex-col items-center p-1 text-center">
               <div className="flex-1 flex flex-col items-center justify-center">
                  {data.checked_finance_sig ? (
                    <img src={data.checked_finance_sig} alt="Sig" className="max-h-10 max-w-full" />
                  ) : data.checked_finance_name ? (
                     <div className="text-emerald-600 font-bold uppercase tracking-widest text-[8px]">Checked & Passed</div>
                  ) : null}
               </div>
               <div className="font-bold border-t border-black w-full pt-1">Finance / Accounts</div>
               <p className="text-[8px]">{data.checked_finance_name || 'Pending'}</p>
            </div>

            {/* Stage 3: Management */}
            <div className="border-r border-black flex flex-col items-center p-1 text-center">
               <div className="flex-1 flex flex-col items-center justify-center">
                  {data.released_mgmt_sig ? (
                    <img src={data.released_mgmt_sig} alt="Sig" className="max-h-10 max-w-full" />
                  ) : (
                    <div className="text-slate-300 italic opacity-50">Authorized Release</div>
                  )}
               </div>
               <div className="font-bold border-t border-black w-full pt-1">Management Approval</div>
               <p className="text-[8px] font-bold">{data.released_mgmt_name || 'Pending'}</p>
            </div>

            {/* Stage 4: MD */}
            <div className="flex flex-col items-center p-1 text-center">
               <div className="flex-1 flex flex-col items-center justify-center">
                  {data.authorized_md_sig ? (
                    <img src={data.authorized_md_sig} alt="Sig" className="max-h-10 max-w-full" />
                  ) : data.authorized_md_name ? (
                     <div className="border-4 border-emerald-600 text-emerald-600 p-0.5 rounded-full font-black text-[6px] transform -rotate-12">BCIM AUTHORIZED</div>
                  ) : null}
               </div>
               <div className="font-bold border-t border-black w-full pt-1 font-display uppercase tracking-widest">Managing Director</div>
               <p className="text-[8px] font-black">{data.authorized_md_name || 'BCIM AUTHORIZED'}</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
});

export default POPrintTemplate;
