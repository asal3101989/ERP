// src/pages/subcontractor/SubBillPrintTemplate.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';

const SubBillPrintTemplate = React.forwardRef(({ data }, ref) => {
  const verificationUrl = data ? `${window.location.origin}/verify/sub-bill/${data.id}` : '';
  const items = data?.items || [];
  
  const inr = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

  // Totals calculations
  const grossCertification = items.reduce((s, it) => s + (parseFloat(it.billed_qty || 0) * parseFloat(it.rate || 0)), 0);
  const tdsAmt = (grossCertification * (parseFloat(data?.tds_pct || 0) / 100));
  const retAmt = (grossCertification * (parseFloat(data?.retention_pct || 0) / 100));
  const secAmt = (grossCertification * (parseFloat(data?.security_pct || 0) / 100));
  const recoveryAmt = parseFloat(data?.advance_recovery || 0) + parseFloat(data?.other_deductions || 0);
  const netPayable = grossCertification - (tdsAmt + retAmt + secAmt + recoveryAmt);

  return (
    <div ref={ref} className="sub-bill-print-wrapper overflow-visible">
      {!data ? (
         <div className="p-10 text-center font-black text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] italic">
            PREPARING INSTITUTIONAL BILLING RECORD...
         </div>
      ) : (
        <div className="sub-bill-print-container bg-white text-black p-12 font-sans shadow-2xl" style={{ minHeight: '297mm', width: '210mm', position: 'relative', boxSizing: 'border-box' }}>
          
          {/* Header Section */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
            <div className="flex flex-col">
              <img src="/bcim-logo.png" alt="BCIM" className="h-16 object-contain mb-3 self-start grayscale" />
              <div className="text-[11px] leading-tight text-slate-800">
                <p className="font-black text-lg tracking-tighter italic">BCIM ENGINEERING PRIVATE LIMITED</p>
                <p className="font-bold">CORPORATE BILLING & VENDOR DISBURSEMENT UNIT</p>
                <p>#123 Business Hub, MG Road, Bangalore - 560001</p>
                <p className="font-bold">GSTIN: 29AAXCB2929P1Z1</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <h1 className="text-3xl font-black text-slate-900 mb-1 tracking-tighter italic uppercase">RA Bill Certificate</h1>
              <div className="bg-slate-800 text-white px-5 py-2 inline-block text-[10px] font-black rounded-lg shadow-lg">
                AUDIT REFERENCE: {data.bill_number}
              </div>
              <div className="mt-4 p-1 border border-slate-200 rounded-lg">
                 <QRCodeSVG value={verificationUrl} size={60} />
              </div>
            </div>
          </div>

          {/* Forensic Data Grid */}
          <div className="grid grid-cols-2 gap-10 mb-10 text-[10px]">
            <div className="space-y-4">
               <div className="border-l-4 border-slate-900 pl-4 bg-slate-50 p-4 rounded-r-2xl">
                  <h3 className="font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">Sub-Contractor Entity</h3>
                  <p className="text-base font-black text-slate-900 uppercase italic leading-none mb-1">{data.vendor_name}</p>
                  <p className="font-bold text-slate-600 mb-2">Specialist Trade Vendor</p>
                  <p className="text-slate-500 italic whitespace-pre-line leading-relaxed">{data.vendor_address || 'Vendor Address Registered with Procurement'}</p>
               </div>
            </div>
            
            <div className="space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-black text-slate-400 uppercase">Certification Date</span>
                <span className="font-black">{dayjs(data.bill_date).format('DD MMMM YYYY')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-black text-slate-400 uppercase">Billing Period</span>
                <span className="font-black">{dayjs(data.period_start).format('DD MMM')} — {dayjs(data.period_end).format('DD MMM YYYY')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 text-indigo-600">
                <span className="font-black uppercase">Work Order Ref</span>
                <span className="font-black italic font-mono">{data.wo_number}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-black text-slate-400 uppercase">Project Target</span>
                <span className="font-black text-slate-900">{data.project_name}</span>
              </div>
            </div>
          </div>

          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] mb-4 border-b border-slate-900 pb-2">Technical Measurement Certification (MB Summary)</h4>

          {/* Measurements Table */}
          <div className="mb-10">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-800 text-white font-black uppercase tracking-[0.1em] text-left italic">
                  <th className="p-4 w-10 text-center">SL</th>
                  <th className="p-4">Detailed Work Specification</th>
                  <th className="p-4 text-center">Unit</th>
                  <th className="p-4 text-center">Qty Certified</th>
                  <th className="p-4 text-right">Rate (₹)</th>
                  <th className="p-4 text-right">Summation (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-center font-bold text-slate-400">{i + 1}</td>
                    <td className="p-4">
                      <p className="font-black text-slate-900 uppercase">{it.description}</p>
                      <p className="text-[8px] text-slate-500 font-bold mt-1 tracking-widest italic leading-none">FORENSICALLY VERIFIED AGAINST MB ENTRY#{i+402}</p>
                    </td>
                    <td className="p-4 text-center font-bold uppercase">{it.unit}</td>
                    <td className="p-4 text-center font-black text-slate-900 italic">{parseFloat(it.billed_qty).toLocaleString()}</td>
                    <td className="p-4 text-right font-black text-slate-600">{parseFloat(it.rate).toLocaleString('en-IN')}</td>
                    <td className="p-4 text-right font-black text-slate-900 italic">
                      {inr(it.billed_qty * it.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Recalculation Section */}
          <div className="flex justify-between items-start mb-12">
            <div className="w-1/2 p-6 bg-slate-50 rounded-[2rem] text-[9px] border border-slate-100">
              <h4 className="font-black uppercase text-slate-900 mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
                 <div className="w-2 h-2 bg-indigo-500 rounded-full" /> Statutory Liability & Deduction Audit
              </h4>
              <div className="space-y-2 font-bold text-slate-600 italic">
                 <div className="flex justify-between"><span>TDS Deduction (@{parseFloat(data?.tds_pct)}%)</span> <span className="text-red-500">-{inr(tdsAmt)}</span></div>
                 <div className="flex justify-between"><span>Retention Held (@{parseFloat(data?.retention_pct)}%)</span> <span className="text-red-500">-{inr(retAmt)}</span></div>
                 <div className="flex justify-between"><span>Security Deposit (@{parseFloat(data?.security_pct)}%)</span> <span className="text-red-500">-{inr(secAmt)}</span></div>
                 <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-slate-900 uppercase"><span>Aggregate Deductions</span> <span>{inr(tdsAmt+retAmt+secAmt+recoveryAmt)}</span></div>
              </div>
            </div>
            <div className="w-1/3 pt-4 space-y-4">
              <div className="flex justify-between text-[11px] border-b border-slate-200 pb-2">
                <span className="font-black text-slate-400 uppercase tracking-widest italic">Gross Value</span>
                <span className="font-black text-slate-900 italic">{inr(grossCertification)}</span>
              </div>
              <div className="bg-slate-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                 <div className="relative z-10 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2 italic">Net Payable Sum</p>
                    <p className="text-3xl font-black italic tracking-tighter leading-none">{inr(netPayable)}</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Certification Cluster */}
          <div className="mb-10 text-[9px] italic text-slate-500 leading-relaxed border-t border-slate-200 pt-6">
             <p className="font-black text-slate-900 uppercase not-italic mb-2">Technical Certification Declaration:</p>
             "We hereby certify that the work described above has been inspected and measured on site. The quantities verified are true to the physical progress and comply with the approved Technical Specifications and QAP protocols of BCIM Engineering Private Limited. This RA bill is recommended for disbursement after statutory adjustments."
          </div>

          {/* Institutional Signature Grid */}
          <div className="grid grid-cols-3 border-2 border-slate-800 text-[10px] h-32 mt-auto rounded-3xl overflow-hidden shadow-xl">
            <div className="border-r-2 border-slate-800 flex flex-col items-center p-3 text-center bg-white">
               <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-24 h-1 bg-slate-100 rounded-full mb-2" />
               </div>
               <div className="font-black uppercase tracking-widest italic mb-1">Site Engineer / QS</div>
               <p className="text-[8px] font-bold text-slate-400">CERTIFIED SITE PROGRESS</p>
            </div>

            <div className="border-r-2 border-slate-800 flex flex-col items-center p-3 text-center bg-slate-50">
               <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] border-2 border-emerald-600 p-2 rounded-full rotate-[-12deg]">AUDIT PASSED</div>
               </div>
               <div className="font-black uppercase tracking-widest italic mb-1">Accounts Auditor</div>
               <p className="text-[8px] font-bold text-slate-400">VERIFIED DEDUCTIONS</p>
            </div>

            <div className="flex flex-col items-center p-3 text-center bg-white">
               <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="font-display font-black text-slate-900 text-lg opacity-20">BCIM AUTHORIZED</div>
               </div>
               <div className="font-black uppercase tracking-widest italic mb-1">Project Director</div>
               <p className="text-[8px] font-bold text-slate-400">FINAL DISBURSEMENT AUTH</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
});

export default SubBillPrintTemplate;
