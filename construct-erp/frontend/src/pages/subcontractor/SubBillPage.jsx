// src/pages/subcontractor/SubBillPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Receipt, Plus, X, Search, FileText, 
  Printer, Download, ShieldCheck, 
  Calculator, Building2, Briefcase,
  TrendingDown, CheckCircle2, ChevronRight,
  Wallet, Landmark, ScrollText
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { subcontractorAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import SubBillPrintTemplate from './SubBillPrintTemplate';

const inr = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

export default function SubBillPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWO, setSelectedWO] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  
  // Bill Creation State
  const [billItems, setBillItems] = useState([]); // Selected measurements to be billed
  const [deductions, setDeductions] = useState({
    tds_pct: 2.0,
    retention_pct: 5.0,
    security_pct: 5.0,
    advance_recovery: 0,
    other_deductions: 0
  });

  const [formData, setFormData] = useState({
    bill_number: `RA-${dayjs().format('YYYY')}-SC-${Math.floor(Math.random()*1000)}`,
    bill_date: dayjs().format('YYYY-MM-DD'),
    period_start: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
    period_end: dayjs().format('YYYY-MM-DD'),
    remarks: ''
  });

  const qc = useQueryClient();

  // Queries
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const { data: woData } = useQuery({
    queryKey: ['work-orders', selectedProject],
    queryFn: () => subcontractorAPI.listWorkOrders({ project_id: selectedProject }).then(r => r.data.data),
    enabled: !!selectedProject
  });

  // Pulling unbilled measurements from WO details for this simulation
  const { data: woDetails } = useQuery({
    queryKey: ['work-order-details-billing', selectedWO],
    queryFn: () => subcontractorAPI.getWorkOrder(selectedWO).then(r => r.data),
    enabled: !!selectedWO
  });

  const { data: billsData } = useQuery({
    queryKey: ['sub-bills', selectedProject],
    queryFn: () => subcontractorAPI.listBills({ project_id: selectedProject }).then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) => subcontractorAPI.createBill(d),
    onSuccess: () => {
      toast.success('Sub-Contractor RA Bill finalized successfully!');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['sub-bills'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Bill generation failed'),
  });

  const handlePrint = async (billId) => {
    try {
      const { data: fullBill } = await subcontractorAPI.getBill(billId);
      setSelectedBill(fullBill);
      setTimeout(() => {
        const printContent = document.getElementById('sub-bill-print-zone');
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = printContent.innerHTML;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); // To restore app state after crude print
      }, 500);
    } catch (e) {
      toast.error('Failed to load bill for printing');
    }
  };

  // Calculation Logic
  const grossAmount = billItems.reduce((s, it) => s + (parseFloat(it.quantity) * parseFloat(it.rate)), 0);
  const tdsAmt = (grossAmount * (deductions.tds_pct / 100));
  const retAmt = (grossAmount * (deductions.retention_pct / 100));
  const secAmt = (grossAmount * (deductions.security_pct / 100));
  const totalDeductions = tdsAmt + retAmt + secAmt + parseFloat(deductions.advance_recovery || 0) + parseFloat(deductions.other_deductions || 0);
  const netPayable = grossAmount - totalDeductions;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header section with strategic aesthetics */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <Receipt className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Sub-Contractor RA Billing</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
               <ShieldCheck size={12} className="text-emerald-600" /> Forensic Progress-to-Wallet Engine
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2 italic"
        >
          <Plus size={16} /> Generate New RA Bill
        </button>
      </div>

      {/* KPI Ribbons for Funding Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-sm">
            <div>
               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-2">Aggregate Liability</p>
               <p className="text-xl font-black text-slate-900 font-mono italic">₹42.84 Cr</p>
            </div>
            <TrendingDown size={24} className="text-red-500/20" />
         </div>
         <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-sm">
            <div>
               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-2">Total Certified (SC)</p>
               <p className="text-xl font-black text-slate-900 font-mono italic">₹22.10 Cr</p>
            </div>
            <Landmark size={24} className="text-emerald-500/20" />
         </div>
         <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-sm">
            <div>
               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-2">Retentions Held</p>
               <p className="text-xl font-black text-slate-900 font-mono italic">₹1.15 Cr</p>
            </div>
            <ShieldCheck size={24} className="text-indigo-500/20" />
         </div>
         <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-sm">
            <div>
               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-2">Audit Compliance</p>
               <p className="text-xl font-black text-emerald-600 font-mono italic">100%</p>
            </div>
            <CheckCircle2 size={24} className="text-emerald-500/20" />
         </div>
      </div>

      {/* Main Registry Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
              <ScrollText size={16} className="text-emerald-500" /> Sub-Contractor Payment Archive
           </h3>
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="FILTER BY BILL# OR VENDOR..." className="bg-slate-50 border border-slate-200 rounded-full py-2 pl-10 pr-6 text-[10px] font-black text-slate-400 outline-none uppercase tracking-widest focus:border-emerald-500/50 shadow-sm" />
           </div>
        </div>
        <div className="p-0">
           {billsData?.length > 0 ? (
             <table className="w-full text-left">
               <thead className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                 <tr>
                   <th className="p-6">Bill Ident</th>
                   <th className="p-6">Project / Contractor</th>
                   <th className="p-6">Gross Sum</th>
                   <th className="p-6">Net Payable</th>
                   <th className="p-6 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 bg-white">
                 {billsData.map(bill => (
                   <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                     <td className="p-6">
                        <p className="text-sm font-black text-emerald-600 italic uppercase leading-none mb-1">{bill.bill_number}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{dayjs(bill.bill_date).format('DD MMM YYYY')}</p>
                     </td>
                     <td className="p-6">
                        <p className="text-sm font-bold text-slate-900 leading-none mb-1">{bill.vendor_name}</p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{bill.project_name}</p>
                     </td>
                     <td className="p-6 text-slate-900 font-mono font-bold">{inr(bill.gross_amount)}</td>
                     <td className="p-6">
                        <p className="text-sm font-black text-slate-900 italic">{inr(bill.net_payable)}</p>
                     </td>
                     <td className="p-6 text-right">
                        <button 
                          onClick={() => handlePrint(bill.id)}
                          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:text-emerald-600 hover:border-emerald-500/50 transition-all flex items-center gap-2 ml-auto shadow-sm"
                        >
                          <Printer size={14} /> Print RA Bill
                        </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           ) : (
             <div className="py-20 text-center">
                <Receipt size={40} className="text-slate-100 mx-auto mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Awaiting First Disbursement Record</p>
             </div>
           )}
        </div>
      </div>

      {/* Bill Generation Modal */}
      {showForm && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white border border-slate-200 w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden shadow-2xl rounded-[3.5rem]">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-600/20">
                      <Calculator size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic leading-none mb-1">RA Disbursement Protocol</h2>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">Subcontractor Payment Authorization • Forensic Audit Active</p>
                    </div>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all shadow-sm">
                    <X size={20} />
                  </button>
               </div>

               <div className="flex-1 overflow-hidden grid grid-cols-12">
                  {/* Left Column: Data Selectors */}
                  <div className="col-span-8 overflow-y-auto p-10 space-y-10 scrollbar-hide border-r border-slate-100 bg-white">
                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none ml-1">Global Site Target</label>
                           <select 
                             className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase tracking-tight outline-none focus:border-emerald-500 transition-all"
                             value={selectedProject}
                             onChange={e => { setSelectedProject(e.target.value); setSelectedWO(''); }}
                           >
                              <option value="">Select Project Target</option>
                              {projectsData?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none ml-1">Locked Work Order</label>
                           <select 
                             className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase tracking-tight outline-none focus:border-emerald-500 transition-all"
                             value={selectedWO}
                             onChange={e => setSelectedWO(e.target.value)}
                             disabled={!selectedProject}
                           >
                              <option value="">Select Primary Contract</option>
                              {woData?.map(wo => <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.vendor_name}</option>)}
                           </select>
                        </div>
                     </div>

                     {/* Progress Picking (Unbilled Measurements) */}
                     {selectedWO ? (
                        <div className="space-y-6">
                           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 italic border-b border-slate-100 pb-2">
                              <TrendingDown size={14} className="text-emerald-500" /> Pending Site Certifications (MB Ledger)
                           </h3>
                           <div className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 text-center space-y-6">
                              <div className="grid grid-cols-1 gap-3">
                                 {woDetails?.items?.map(it => (
                                    <div key={it.id} className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl group cursor-pointer hover:border-emerald-500 transition-all shadow-sm" onClick={() => {
                                       if (!billItems.find(x => x.id === it.id)) setBillItems([...billItems, { ...it, billed_qty: it.quantity }]);
                                    }}>
                                       <div className="text-left">
                                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight italic leading-tight mb-1">{it.description}</p>
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Unit: {it.unit} | Certified Rate: {inr(it.rate)}</p>
                                       </div>
                                       <Plus size={18} className="text-emerald-500 opacity-20 group-hover:opacity-100 transition-all" />
                                    </div>
                                 ))}
                              </div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Select measurement entries to pull into current fiscal cycle</p>
                           </div>
                        </div>
                     ) : (
                        <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50">
                           <Briefcase size={40} className="text-slate-200 mx-auto mb-4" />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">AWAITING CONTRACT TARGET SELECTION</p>
                        </div>
                     )}

                     {/* Selected Items to Bill */}
                     {billItems.length > 0 && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 italic border-b border-slate-100 pb-2">
                              <FileText size={14} className="text-emerald-500" /> Active RA-Bill Reconciliation
                           </h3>
                           <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/50">
                              <table className="w-full text-left border-collapse">
                                 <thead className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50/80 backdrop-blur-sm border-b border-slate-100">
                                    <tr>
                                       <th className="py-5 px-6">Description</th>
                                       <th className="py-5 px-6 text-center">Billed Qty</th>
                                       <th className="py-5 px-6 text-right">Certification Sum</th>
                                       <th className="py-5 px-6 w-16"></th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-50">
                                    {billItems.map(it => (
                                       <tr key={it.id} className="hover:bg-slate-50/50 transition-all group">
                                          <td className="py-5 px-6">
                                             <div className="text-xs font-black text-slate-900 uppercase tracking-tight italic">{it.description}</div>
                                          </td>
                                          <td className="py-5 px-6 text-center">
                                              <input type="number" className="bg-slate-50 border border-slate-200 p-2.5 w-28 rounded-xl text-center text-emerald-600 font-black outline-none focus:border-emerald-500 shadow-inner text-sm transition-all" value={it.billed_qty} onChange={e => setBillItems(p => p.map(x => x.id === it.id ? { ...x, billed_qty: e.target.value } : x))} />
                                          </td>
                                          <td className="py-5 px-6 text-right text-sm font-bold text-slate-900 font-mono">₹{(it.billed_qty * it.rate).toLocaleString('en-IN')}</td>
                                          <td className="py-5 px-6 text-right">
                                             <button onClick={() => setBillItems(p => p.filter(x => x.id !== it.id))} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-full"><X size={16}/></button>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     )}
                  </div>

                  {/* Right Column: Deductions & Forensic Summary */}
                  <div className="col-span-4 bg-slate-50 p-10 flex flex-col justify-between border-l border-slate-100">
                     <div className="space-y-10">
                        <div>
                           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 italic border-b border-slate-200 pb-2">Fiscal Deductions (CAR)</h3>
                           <div className="space-y-6">
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between px-1">TDS Liability <span>(2.0%)</span></label>
                                 <div className="flex items-center gap-2">
                                     <input type="number" step="0.1" className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 shadow-sm transition-all" value={deductions.tds_pct} onChange={e => setDeductions(p => ({ ...p, tds_pct: e.target.value }))} />
                                    <span className="text-[10px] font-black text-slate-400">%</span>
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between px-1">Retention Fund <span>(5.0%)</span></label>
                                 <div className="flex items-center gap-2">
                                     <input type="number" step="0.1" className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 shadow-sm transition-all" value={deductions.retention_pct} onChange={e => setDeductions(p => ({ ...p, retention_pct: e.target.value }))} />
                                    <span className="text-[10px] font-black text-slate-400">%</span>
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between px-1">Security Deposit</label>
                                 <div className="flex items-center gap-2">
                                     <input type="number" step="0.1" className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 shadow-sm transition-all" value={deductions.security_pct} onChange={e => setDeductions(p => ({ ...p, security_pct: e.target.value }))} />
                                    <span className="text-[10px] font-black text-slate-400">%</span>
                                 </div>
                              </div>
                              <div className="space-y-2 pt-6 border-t border-slate-200">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 italic">Advance Recovery Sum (₹)</label>
                                  <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black text-red-600 outline-none focus:border-red-500 shadow-sm transition-all" value={deductions.advance_recovery} onChange={e => setDeductions(p => ({ ...p, advance_recovery: e.target.value }))} />
                              </div>
                           </div>
                        </div>

                        {/* Bill Header Info */}
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-slate-200/50">
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none ml-1">Archive Sequence</label>
                              <div className="text-sm font-black text-slate-900 tracking-tighter uppercase italic">{formData.bill_number}</div>
                           </div>
                           <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-1">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Cert. Date</label>
                                 <input type="date" className="w-full bg-transparent border-b border-slate-100 text-[11px] font-bold text-slate-900 outline-none pb-1" value={formData.bill_date} onChange={e => setFormData(p => ({ ...p, bill_date: e.target.value }))} />
                              </div>
                              <div className="space-y-1 text-right">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Cycle Close</label>
                                 <input type="date" className="w-full bg-transparent border-b border-slate-100 text-[11px] font-bold text-slate-900 outline-none text-right pb-1" value={formData.period_end} onChange={e => setFormData(p => ({ ...p, period_end: e.target.value }))} />
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-8 pt-10">
                        <div className="space-y-3 px-1">
                           <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest">
                              <span>Gross Certification</span>
                              <span className="text-slate-900 font-mono italic">₹{grossAmount.toLocaleString('en-IN')}</span>
                           </div>
                           <div className="flex justify-between text-[11px] font-bold text-red-500 uppercase tracking-widest">
                              <span>Aggregate Deductions</span>
                              <span className="font-mono"> - ₹{totalDeductions.toLocaleString('en-IN')}</span>
                           </div>
                        </div>
                        <div className="bg-emerald-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-emerald-600/30">
                           <Wallet className="absolute -right-8 -bottom-8 w-44 h-44 opacity-10 rotate-12" />
                           <div className="relative z-10 space-y-1">
                              <p className="text-[11px] font-black uppercase tracking-[0.3em] leading-none mb-2 opacity-70 italic">Verified Net Payable</p>
                              <p className="text-4xl font-black italic tracking-tighter leading-none">{inr(netPayable)}</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => createMutation.mutate({ ...formData, ...deductions, project_id: selectedProject, wo_id: selectedWO, items: billItems.map(it => ({ ...it, wo_item_id: it.id, billed_qty: it.billed_qty, rate: it.rate })) })}
                          disabled={createMutation.isPending || billItems.length === 0}
                          className="w-full py-6 bg-emerald-600 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-[2.5rem] hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 disabled:opacity-20 shadow-2xl shadow-emerald-500/40 italic"
                        >
                            {createMutation.isPending ? 'Fiscal Finalization Processing...' : 'Authorize RA Disbursement'} <ChevronRight size={18} />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}
      {/* Concealed Print Zone */}
      <div id="sub-bill-print-zone" className="hidden">
         <SubBillPrintTemplate data={selectedBill} />
      </div>
    </div>
  );
}
