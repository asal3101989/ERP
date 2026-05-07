// src/pages/stores/MRSPrintTemplate.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';

const MRSPrintTemplate = React.forwardRef(({ data }, ref) => {
  const verificationUrl = data ? `${window.location.origin}/verify/mrs/${data.id}` : '';
  const items = data?.items || [];

  return (
    <div ref={ref} className="mrs-print-wrapper overflow-visible">
      {!data ? (
        <div className="p-10 text-center font-bold text-slate-900 border-2 border-dashed border-slate-200 rounded-xl">
          Preparing High-Quality Document...
        </div>
      ) : (
        <div className="mrs-print-container bg-white text-black p-10 font-sans mx-auto shadow-none text-left" style={{ minHeight: '210mm', width: '297mm', position: 'relative', boxSizing: 'border-box' }}>
          {/* Header Section */}
          <div className="flex border-2 border-black">
            <div className="w-1/4 p-2 border-r-2 border-black flex items-center justify-center">
              <img src="/bcim-logo.png" alt="BCIM" className="h-12 object-contain" />
            </div>
            <div className="w-1/2 p-2 border-r-2 border-black flex flex-col items-center justify-center">
              <h1 className="text-sm font-bold underline">MATERIAL / SERVICE REQUISITION</h1>
            </div>
            <div className="w-1/4 p-2 text-[10px] flex flex-col justify-center">
              <div className="font-bold">Tel : 080 22244455</div>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex border-x-2 border-b-2 border-black text-[10px]">
            <div className="w-1/2 p-2 border-r-2 border-black space-y-1 text-left">
              <div className="flex"><span className="w-32 font-bold">Project</span><span className="flex-1">: {data.project_name || 'BCIM-BLR-DQS'}</span></div>
              <div className="flex"><span className="w-32 font-bold">Project Code</span><span className="flex-1">: {data.project_code}</span></div>
              <div className="flex"><span className="w-32 font-bold">Head office / Project Name</span><span className="flex-1">: {data.head_office_project_name}</span></div>
              <div className="flex"><span className="w-32 font-bold">Department</span><span className="flex-1">: {data.department || 'Projects'}</span></div>
            </div>
            <div className="w-1/2 p-2 space-y-1 text-left">
              <div className="flex"><span className="w-32 font-bold">Serial No</span><span className="flex-1">: {data.serial_no_formatted}</span></div>
              <div className="flex"><span className="w-32 font-bold">Date</span><span className="flex-1">: {dayjs(data.created_at).format('DD/MM/YYYY')}</span></div>
              <div className="mt-2 flex justify-end">
                <QRCodeSVG value={verificationUrl} size={40} />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-x-2 border-b-2 border-black">
            <table className="w-full text-center border-collapse text-[10px]">
              <thead>
                <tr className="border-b-2 border-black font-bold">
                  <th className="border-r-2 border-black w-12 py-1">SL. NO</th>
                  <th className="border-r-2 border-black w-20 py-1">ITEM CODE</th>
                  <th className="border-r-2 border-black py-1">DESCRIPTION</th>
                  <th className="border-r-2 border-black w-14 py-1">UNIT</th>
                  <th className="border-r-2 border-black w-14 py-1">QTY</th>
                  <th className="border-r-2 border-black w-24 py-1">DATE REQUIRED</th>
                  <th className="border-r-2 border-black w-32 py-1">VENDOR / SUPPLIER (Optional)</th>
                  <th className="py-1">REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(Math.max(items.length, 12))].map((_, i) => (
                  <tr key={i} className="border-b border-gray-300 h-8">
                    <td className="border-r-2 border-black">{i < items.length ? i + 1 : ''}</td>
                    <td className="border-r-2 border-black">{items[i]?.item_code || ''}</td>
                    <td className="border-r-2 border-black text-left px-2">{items[i]?.material_name || items[i]?.material || ''}</td>
                    <td className="border-r-2 border-black uppercase">{items[i]?.unit || ''}</td>
                    <td className="border-r-2 border-black">{items[i]?.quantity || items[i]?.qty || ''}</td>
                    <td className="border-r-2 border-black">{items[i]?.required_date ? dayjs(items[i].required_date).format('DD/MM/YYYY') : ''}</td>
                    <td className="border-r-2 border-black">{items[i]?.preferred_vendor || ''}</td>
                    <td className="px-1 text-left">{items[i]?.remarks || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Purchase Section */}
          <div className="border-x-2 border-b-2 border-black p-2 text-[10px] bg-gray-50 text-left">
            <div className="flex justify-between font-bold underline mb-2">
              <span>For The Uses of Purchase Department</span>
              <span>Processed By</span>
            </div>
            <div className="flex">
              <div className="w-1/2 space-y-1">
                <div>Received Date : {data.purchase_received_date ? dayjs(data.purchase_received_date).format('DD/MM/YYYY') : '________________'}</div>
                <div>Purchase order No. & Date : {data.po_no_date || '________________'}</div>
              </div>
              <div className="w-1/2 space-y-1 text-right">
                <div>Date : {data.processed_at ? dayjs(data.processed_at).format('DD/MM/YYYY') : '________________'}</div>
                <div>Expected Date of Delivery : {data.expected_delivery_date ? dayjs(data.expected_delivery_date).format('DD/MM/YYYY') : '________________'}</div>
              </div>
            </div>
          </div>

          {/* Approval Grid */}
          <div className="border-x-2 border-b-2 border-black text-[9px] text-left">
            <div className="flex h-24">
              <div className="w-1/6 border-r-2 border-black flex flex-col items-center">
                <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
                  {data.raised_by_sig ? (
                    <img src={data.raised_by_sig} alt="Sig" className="max-h-12 max-w-full" />
                  ) : (
                    <div className="text-gray-300 italic">Digitally Signed</div>
                  )}
                  <div className="font-bold border-t border-black w-full mt-1">Requested By</div>
                </div>
                <div className="w-full p-1 border-t-2 border-black">
                  <div>Name: {data.raised_by_name}</div>
                  <div>Date: {dayjs(data.created_at).format('DD/MM/YYYY')}</div>
                </div>
              </div>

              <div className="w-1/6 border-r-2 border-black flex flex-col items-center">
                <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
                  {(data.tower_sig_img || data.verified_tower_sig) ? (
                    <img src={data.tower_sig_img || data.verified_tower_sig} alt="Sig" className="max-h-12 max-w-full" />
                  ) : data.verified_tower_name ? (
                    <div className="text-green-600 font-bold text-[9px]">VERIFIED</div>
                  ) : null}
                  <div className="font-bold border-t border-black w-full mt-1">Verified / checked by Tower Manager</div>
                </div>
                <div className="w-full p-1 border-t-2 border-black">
                  <div>Name: {data.verified_tower_name || ''}</div>
                  <div>Date: {data.verified_tower_mgr_at ? dayjs(data.verified_tower_mgr_at).format('DD/MM/YYYY') : ''}</div>
                </div>
              </div>

              <div className="w-1/6 border-r-2 border-black flex flex-col items-center">
                <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
                  {(data.pm_sig_img || data.approved_pm_sig) ? (
                    <img src={data.pm_sig_img || data.approved_pm_sig} alt="Sig" className="max-h-12 max-w-full" />
                  ) : data.approved_pm_name ? (
                    <div className="text-green-600 font-bold text-[9px]">APPROVED</div>
                  ) : null}
                  <div className="font-bold border-t border-black w-full mt-1">Approved by Project Manager</div>
                </div>
                <div className="w-full p-1 border-t-2 border-black">
                  <div>Name: {data.approved_pm_name || ''}</div>
                  <div>Date: {data.approved_pm_at ? dayjs(data.approved_pm_at).format('DD/MM/YYYY') : ''}</div>
                </div>
              </div>

              <div className="w-1/6 border-r-2 border-black flex flex-col items-center">
                <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
                  {(data.srpm_sig_img || data.approved_srpm_sig) ? (
                    <img src={data.srpm_sig_img || data.approved_srpm_sig} alt="Sig" className="max-h-12 max-w-full" />
                  ) : data.approved_srpm_name ? (
                    <div className="text-green-600 font-bold text-[9px]">APPROVED</div>
                  ) : null}
                  <div className="font-bold border-t border-black w-full mt-1">Approved by Sr. Project Manager</div>
                </div>
                <div className="w-full p-1 border-t-2 border-black">
                  <div>Name: {data.approved_srpm_name || ''}</div>
                  <div>Date: {data.approved_sr_pm_at ? dayjs(data.approved_sr_pm_at).format('DD/MM/YYYY') : ''}</div>
                </div>
              </div>

              <div className="w-1/6 border-r-2 border-black flex flex-col items-center">
                <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
                  {(data.mgmt_sig_img || data.approved_mgmt_sig) ? (
                    <img src={data.mgmt_sig_img || data.approved_mgmt_sig} alt="Sig" className="max-h-12 max-w-full" />
                  ) : data.approved_mgmt_name ? (
                    <div className="text-green-600 font-bold text-[9px]">RELEASED</div>
                  ) : null}
                  <div className="font-bold border-t border-black w-full mt-1">Management</div>
                </div>
                <div className="w-full p-1 border-t-2 border-black">
                  <div>Director: {data.approved_mgmt_name || ''}</div>
                  <div>Date: {data.approved_mgmt_at ? dayjs(data.approved_mgmt_at).format('DD/MM/YYYY') : ''}</div>
                </div>
              </div>

              <div className="w-1/6 flex flex-col items-center">
                <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
                  {(data.md_sig_img || data.approved_md_sig) ? (
                    <img src={data.md_sig_img || data.approved_md_sig} alt="Sig" className="max-h-12 max-w-full" />
                  ) : data.approved_md_name ? (
                    <div className="text-green-600 font-bold text-[9px]">AUTHORIZED</div>
                  ) : null}
                  <div className="font-bold border-t border-black w-full mt-1">Management</div>
                </div>
                <div className="w-full p-1 border-t-2 border-black">
                  <div>Managing Director: {data.approved_md_name || ''}</div>
                  <div>Date: {data.approved_md_at ? dayjs(data.approved_md_at).format('DD/MM/YYYY') : ''}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default MRSPrintTemplate;
