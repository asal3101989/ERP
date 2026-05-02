import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hrPayrollAPI } from '../../api/client';

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (v) => `₹${parseFloat(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function PayslipPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['hr-payslip', id],
    queryFn: () => hrPayrollAPI.getPayslip(id).then(r => r.data),
  });

  const p = data?.data;

  useEffect(() => {
    if (p) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [p]);

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading payslip…</div>;
  if (!p) return <div className="text-center py-20 text-red-400">Payslip not found</div>;

  const earnings = [
    { label: 'Basic Salary',       value: p.basic },
    { label: 'HRA',                value: p.hra },
    { label: 'Conveyance',         value: p.conveyance },
    { label: 'Medical Allowance',  value: p.medical },
    { label: 'Special Allowance',  value: p.special_allowance },
    { label: 'Other Earnings',     value: p.other_earnings },
  ].filter(e => parseFloat(e.value) > 0);

  const deductions = [
    { label: 'PF (Employee)',      value: p.pf_employee },
    { label: 'PF (Employer)',      value: p.pf_employer, note: 'CTC' },
    { label: 'ESI (Employee)',     value: p.esi_employee },
    { label: 'ESI (Employer)',     value: p.esi_employer, note: 'CTC' },
    { label: 'Professional Tax',   value: p.pt },
    { label: 'TDS',                value: p.tds },
    { label: 'Loan Deduction',     value: p.loan_deduction },
    { label: 'Advance Recovery',   value: p.advance_deduction },
    { label: 'Other Deductions',   value: p.other_deductions },
  ].filter(d => parseFloat(d.value) > 0 && !d.note);

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 15mm; }
        }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {/* Back button (hidden on print) */}
      <div className="no-print mb-4 p-4">
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600">
          ← Back
        </button>
        <button onClick={() => window.print()} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500">
          Print / Download PDF
        </button>
      </div>

      {/* Payslip */}
      <div className="max-w-2xl mx-auto bg-white text-gray-900 p-8 shadow-xl print:shadow-none print:max-w-none">
        {/* Company Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <div className="text-2xl font-bold text-gray-900">{p.company_name || 'Company Name'}</div>
          <div className="text-lg font-semibold text-gray-700 mt-1">SALARY SLIP</div>
          <div className="text-gray-600">{MONTHS[p.month]} {p.year}</div>
        </div>

        {/* Employee Details */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6 bg-gray-50 p-4 rounded">
          <div><span className="text-gray-500">Employee Name:</span> <strong>{p.employee_name}</strong></div>
          <div><span className="text-gray-500">Employee Code:</span> <strong>{p.employee_code}</strong></div>
          <div><span className="text-gray-500">Department:</span> <strong>{p.department_name}</strong></div>
          <div><span className="text-gray-500">Designation:</span> <strong>{p.designation_name}</strong></div>
          <div><span className="text-gray-500">PAN Number:</span> <strong>{p.pan_number || '—'}</strong></div>
          <div><span className="text-gray-500">UAN:</span> <strong>{p.uan_number || '—'}</strong></div>
          <div><span className="text-gray-500">Bank:</span> <strong>{p.bank_name || '—'}</strong></div>
          <div><span className="text-gray-500">Account No:</span> <strong>{p.bank_account_number || '—'}</strong></div>
          <div><span className="text-gray-500">Working Days:</span> <strong>{p.working_days}</strong></div>
          <div><span className="text-gray-500">Paid Days:</span> <strong>{parseFloat(p.paid_days).toFixed(1)}</strong></div>
          {parseFloat(p.lop_days) > 0 && (
            <div><span className="text-gray-500">LOP Days:</span> <strong className="text-red-600">{parseFloat(p.lop_days).toFixed(1)}</strong></div>
          )}
          <div><span className="text-gray-500">Joining Date:</span> <strong>{p.date_of_joining ? new Date(p.date_of_joining).toLocaleDateString('en-IN') : '—'}</strong></div>
        </div>

        {/* Earnings & Deductions Table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left px-4 py-2 w-1/2">Earnings</th>
              <th className="text-right px-4 py-2 w-1/4">Amount</th>
              <th className="text-left px-4 py-2 w-1/4 border-l border-gray-600">Deductions</th>
              <th className="text-right px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(earnings.length, deductions.length) }, (_, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-4 py-1.5">{earnings[i]?.label || ''}</td>
                <td className="px-4 py-1.5 text-right">{earnings[i] ? fmt(earnings[i].value) : ''}</td>
                <td className="px-4 py-1.5 border-l border-gray-200">{deductions[i]?.label || ''}</td>
                <td className="px-4 py-1.5 text-right text-red-600">{deductions[i] ? fmt(deductions[i].value) : ''}</td>
              </tr>
            ))}
            <tr className="bg-gray-800 text-white font-bold">
              <td className="px-4 py-2">Gross Earnings</td>
              <td className="px-4 py-2 text-right">{fmt(p.gross_earnings)}</td>
              <td className="px-4 py-2 border-l border-gray-600">Total Deductions</td>
              <td className="px-4 py-2 text-right">{fmt(p.total_deductions)}</td>
            </tr>
          </tbody>
        </table>

        {/* Net Pay */}
        <div className="bg-green-800 text-white text-center py-4 rounded text-lg font-bold mb-6">
          NET PAY: {fmt(p.net_pay)}
        </div>

        {/* PF / ESI employer contribution (CTC info) */}
        <div className="text-xs text-gray-500 mb-6 border border-gray-200 rounded p-3">
          <strong>Employer Contributions (not deducted from salary):</strong>&nbsp;
          PF Employer: {fmt(p.pf_employer)} | ESI Employer: {fmt(p.esi_employer)}
        </div>

        {/* Signature */}
        <div className="flex justify-between mt-8 text-sm">
          <div className="text-center">
            <div className="border-t border-gray-400 mt-12 pt-2 w-40">Employee Signature</div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 mt-12 pt-2 w-40">HR / Accounts</div>
          </div>
        </div>
        <div className="text-center text-xs text-gray-400 mt-6">
          This is a computer-generated payslip. No signature required if digitally authorized.
        </div>
      </div>
    </>
  );
}
