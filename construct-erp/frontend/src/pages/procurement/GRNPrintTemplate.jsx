// src/pages/procurement/GRNPrintTemplate.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';

const GRNPrintTemplate = React.forwardRef(({ data }, ref) => {
  const verificationUrl = data ? `${window.location.origin}/verify/grn/${data.id}` : '';
  const items = data?.items || [];
  
  return (
    <div ref={ref} className="grn-print-wrapper overflow-visible">
      {!data ? (
        <div className="p-10 text-center font-bold text-slate-900 border-2 border-dashed border-slate-200 rounded-xl">
          Preparing Material Receipt Document...
        </div>
      ) : (
        <div className="grn-print-container bg-white text-black p-12 font-sans" style={{ minHeight: '297mm', width: '210mm', position: 'relative', boxSizing: 'border-box' }}>
          
          {/* Header Section */}
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
            <div className="flex flex-col">
              <img src="/bcim-logo.png" alt="BCIM" className="h-14 object-contain mb-2 self-start" />
              <div className="text-[10px] leading-tight text-slate-700">
                <p className="font-bold text-sm uppercase">BCIM ENGINEERING PRIVATE LIMITED</p>
                <p>#Store Hub, Project Logistics Division</p>
                <p>GSTIN: 29AAXCB2929P1Z1</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-black text-slate-900 mb-1">GOODS RECEIPT NOTE</h1>
              <div className="bg-black text-white px-3 py-1 inline-block text-xs font-bold rounded uppercase">
                GRN NO: {data.serial_no_formatted || data.grn_number}
              </div>
              <div className="mt-3">
                 <QRCodeSVG value={verificationUrl} size={50} />
              </div>
            </div>
          </div>

          {/* Logistics & Inwarding Details */}
          <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
            <div className="border border-slate-200 p-3 rounded-lg bg-slate-50">
              <h3 className="font-black text-[10px] uppercase text-slate-500 mb-2 border-b border-slate-200 pb-1">Delivery & Origins</h3>
              <p className="font-bold text-slate-900 mb-1">VENDOR: {data.vendor_name || 'Direct Receipt'}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                 <div>
                    <p className="text-[9px] text-slate-500 uppercase font-black">Challan No</p>
                    <p className="font-bold">{data.challan_number || '---'}</p>
                 </div>
                 <div>
                    <p className="text-[9px] text-slate-500 uppercase font-black">Invoice No</p>
                    <p className="font-bold">{data.invoice_number || '---'}</p>
                 </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Receipt Date</span>
                <span className="font-bold">{dayjs(data.grn_date).format('DD MMM YYYY')}</span>
              </div>
              <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Project Site</span>
                <span className="font-bold">{data.project_name}</span>
              </div>
              <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Location</span>
                <span className="font-bold uppercase tracking-tight">{data.site_location || 'Main Yard'}</span>
              </div>
            </div>
          </div>

          {/* Vehicle & Gate Pass Data */}
          <div className="grid grid-cols-4 gap-4 mb-6 text-[10px] border border-black p-3 bg-slate-50/50">
             <div>
                <span className="text-slate-500 font-bold uppercase block mb-0.5">Vehicle Number</span>
                <span className="font-black">{data.vehicle_number || '---'}</span>
             </div>
             <div>
                <span className="text-slate-500 font-bold uppercase block mb-0.5">Driver Name</span>
                <span className="font-black uppercase">{data.driver_name || '---'}</span>
             </div>
             <div>
                <span className="text-slate-500 font-bold uppercase block mb-0.5">Gate Pass No</span>
                <span className="font-black">{data.gate_pass_no || '---'}</span>
             </div>
             <div>
                <span className="text-slate-500 font-bold uppercase block mb-0.5">WB Slip No</span>
                <span className="font-black">{data.wb_slip_no || '---'}</span>
             </div>
          </div>

          {/* Materials Table */}
          <div className="mb-8">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                  <th className="border border-black p-2 w-10 text-center">SL</th>
                  <th className="border border-black p-2 text-left">Material Specification</th>
                  <th className="border border-black p-2 w-20 text-center">Unit</th>
                  <th className="border border-black p-2 w-24 text-center">Qty Received</th>
                  <th className="border border-black p-2 text-left">Quality Observation</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((it, i) => (
                  <tr key={it.id} className="border-b border-slate-200">
                    <td className="border border-black p-2 text-center">{i + 1}</td>
                    <td className="border border-black p-2">
                      <p className="font-bold text-slate-900">{it.material_name}</p>
                    </td>
                    <td className="border border-black p-2 text-center uppercase">{it.unit}</td>
                    <td className="border border-black p-2 text-center font-black text-sm">{parseFloat(it.quantity_received).toLocaleString()}</td>
                    <td className="border border-black p-2 text-slate-600 italic">
                      {it.quality_remarks || 'Visual inspection: OK'}
                    </td>
                  </tr>
                )) : (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="h-8 border border-black italic text-slate-100 text-[10px]">
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

          {/* Footnotes */}
          <div className="mb-12 text-[9px] border border-slate-200 p-3 rounded-lg bg-slate-50">
             <h4 className="font-black text-slate-900 uppercase mb-2">Note to Vendor / Accounts</h4>
             <p className="text-slate-600 leading-relaxed italic">
                The quantities mentioned above are subject to final quality approval and confirmation. 
                Finance department will process invoices based ONLY on approved quantities after QC sign-off.
                Shortages / damages noted above must be reconciled within 24 hours.
             </p>
          </div>

          {/* Approval Signature Chain */}
          <div className="mt-auto pt-10 grid grid-cols-2 gap-12">
             {/* Stage 1: Storekeeper */}
             <div className="border-t-2 border-black pt-2 text-center">
                <div className="h-20 flex flex-col items-center justify-center">
                   {data.verified_stores_sig ? (
                     <img src={data.verified_stores_sig} alt="Stores Sig" className="max-h-16" />
                   ) : (
                     <div className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Physical Receipt Confirmation</div>
                   )}
                </div>
                <p className="font-black uppercase text-[10px] mt-2">Verified By (Storekeeper)</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">{data.verified_stores_name || 'Pending Verification'}</p>
                {data.verified_stores_at && <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-tighter">{dayjs(data.verified_stores_at).format('DD/MM/YYYY HH:mm')}</p>}
             </div>

             {/* Stage 2: QC */}
             <div className="border-t-2 border-black pt-2 text-center">
                <div className="h-20 flex flex-col items-center justify-center">
                   {data.approved_qc_sig ? (
                     <img src={data.approved_qc_sig} alt="QC Sig" className="max-h-16" />
                   ) : (
                     <div className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Quality Approval Seal</div>
                   )}
                </div>
                <p className="font-black uppercase text-[10px] mt-2">Approved By (Quality / Engineering)</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">{data.approved_qc_name || 'Pending QC Approval'}</p>
                {data.approved_qc_at && <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-tighter">{dayjs(data.approved_qc_at).format('DD/MM/YYYY HH:mm')}</p>}
             </div>
          </div>

          {/* Bottom Footnote */}
          <div className="absolute bottom-12 left-12 right-12 text-center opacity-30 text-[8px] font-bold uppercase tracking-widest italic">
             This is a digital document generated by ConstructERP Industrial Suite. Identity verified via secure authentication tokens.
          </div>

        </div>
      )}
    </div>
  );
});

export default GRNPrintTemplate;
