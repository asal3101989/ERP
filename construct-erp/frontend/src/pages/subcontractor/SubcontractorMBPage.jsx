// src/pages/subcontractor/SubcontractorMBPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Ruler, Plus, X, Search, Camera, 
  MapPin, Calendar, CheckCircle, 
  Clock, AlertCircle, FileText,
  ChevronRight, Building2, Briefcase
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { subcontractorAPI, projectAPI } from '../../api/client';
import toast from 'react-hot-toast';

export default function SubcontractorMBPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWO, setSelectedWO] = useState('');
  const [formData, setFormData] = useState({
    wo_item_id: '',
    measurement_date: dayjs().format('YYYY-MM-DD'),
    quantity: '',
    location_details: '',
    photo_evidence: ''
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

  const { data: woDetails } = useQuery({
    queryKey: ['work-order-details', selectedWO],
    queryFn: () => subcontractorAPI.getWorkOrder(selectedWO).then(r => r.data),
    enabled: !!selectedWO
  });

  // Measurements List Simulation (since we don't have a list endpoint yet, we'll fetch via WO details or similar)
  // In a real app, we'd have a specialized list endpoint.

  const createMutation = useMutation({
    mutationFn: (d) => subcontractorAPI.recordMeasurement(d),
    onSuccess: () => {
      toast.success('Measurement recorded successfully!');
      setShowForm(false);
      setFormData({
        wo_item_id: '',
        measurement_date: dayjs().format('YYYY-MM-DD'),
        quantity: '',
        location_details: '',
        photo_evidence: ''
      });
      qc.invalidateQueries({ queryKey: ['work-order-details'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to record measurement'),
  });

  const handleCreate = () => {
    if (!selectedWO || !formData.wo_item_id || !formData.quantity) {
      return toast.error('Please fill all required fields');
    }
    createMutation.mutate({ ...formData, wo_id: selectedWO });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header section with strategic aesthetics */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <Ruler className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Measurement Book (MB)</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
               <MapPin size={12} className="text-amber-600" /> Site Progress Verification Protocol
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all shadow-xl shadow-amber-600/20 flex items-center gap-2 italic"
        >
          <Plus size={16} /> Record New Entry
        </button>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3 shadow-sm">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
               <Building2 size={12} className="text-amber-500" /> Active Site Location
            </label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-amber-500/50"
              value={selectedProject}
              onChange={e => { setSelectedProject(e.target.value); setSelectedWO(''); }}
            >
               <option value="">Select Project Target</option>
               {projectsData?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
         </div>
         <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3 shadow-sm">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
               <Briefcase size={12} className="text-amber-500" /> Authorized Work Order
            </label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-amber-500/50"
              value={selectedWO}
              onChange={e => setSelectedWO(e.target.value)}
              disabled={!selectedProject}
            >
               <option value="">Select Contract Target</option>
               {woData?.map(wo => <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.vendor_name}</option>)}
            </select>
         </div>
      </div>

      {!selectedWO ? (
         <div className="py-28 bg-white border border-slate-200 rounded-[3rem] text-center space-y-8 animate-in fade-in duration-700 shadow-sm">
            <div className="relative inline-block">
               <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto border border-slate-200 shadow-xl">
                  <Ruler size={40} className="text-slate-800" />
               </div>
               <div className="absolute -right-2 -top-2 w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center border-4 border-white animate-bounce">
                  <AlertCircle size={14} className="text-white" />
               </div>
            </div>
            <div className="space-y-2 max-w-sm mx-auto">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Initialization Protocol Active</h3>
               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">
                  The Measurement Book requires a verified Project and Work Order to unlock site progress recording.
               </p>
            </div>
            
            {/* Quick Start Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto px-10">
               <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-2">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-amber-500 shadow-sm">01</div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target Project</p>
               </div>
               <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-2">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-amber-500 shadow-sm">02</div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lock Work Order</p>
               </div>
               <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-2">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-amber-500 shadow-sm">03</div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Record Progress</p>
               </div>
            </div>
         </div>
      ) : (
         <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* WO Summary Card */}
            <div className="bg-white border border-amber-600/20 rounded-[2.5rem] p-8 mb-8 flex items-center justify-between shadow-sm">
               <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-900 italic tracking-tighter uppercase">{woDetails?.wo_number}</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{woDetails?.vendor_name} — {woDetails?.subject}</p>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Contract Sum</p>
                  <p className="text-2xl font-black text-amber-600 italic">₹{parseFloat(woDetails?.total_value).toLocaleString('en-IN')}</p>
               </div>
            </div>

            {/* Progress Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               {/* Line Items Progress */}
               <div className="lg:col-span-8 space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 italic">
                     <FileText size={16} className="text-amber-500" /> Scope Itemization & Completion Status
                  </h3>
                  <div className="space-y-3">
                     {woDetails?.items?.map(item => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-[2rem] p-6 hover:border-amber-500/20 transition-all group shadow-sm">
                           <div className="flex items-center justify-between mb-4">
                              <div className="space-y-1">
                                 <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.description}</p>
                                 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Unit: {item.unit} | Rate: ₹{parseFloat(item.rate).toLocaleString()}</p>
                              </div>
                               <div className="text-right">
                                 <p className="text-[10px] font-black text-slate-900 font-mono tracking-tighter">Budget: {item.quantity}</p>
                                 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5 italic">Total Limit</p>
                               </div>
                            </div>
                           
                            {/* Progress Bar Simulation */}
                            <div className="space-y-2">
                               <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                  <span className="text-slate-500 italic">Certification Status</span>
                                  <span className="text-amber-600 italic font-black">Verified: 0 / {item.quantity}</span>
                               </div>
                               <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-600 w-0 transition-all duration-1000" />
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
 
                {/* Activity Log (Simulated) */}
                <div className="lg:col-span-4 space-y-4">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 italic">
                      <Clock size={16} className="text-amber-500" /> Forensic Entry Log
                   </h3>
                   <div className="bg-white border border-slate-200 rounded-[2rem] p-8 h-[500px] flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
                      <Clock size={32} className="text-slate-300" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">No measurements have been archived for this contract cycle</p>
                   </div>
                </div>
             </div>
          </div>
       )}
 
       {/* Entry Modal */}
       {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white border border-slate-200 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-xl shadow-amber-600/20">
                       <Ruler size={24} />
                     </div>
                     <div>
                       <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Record Site Progress</h2>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest tracking-tighter">Quantity Recording & Forensic Entry</p>
                     </div>
                   </div>
                   <button onClick={() => setShowForm(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all">
                     <X size={20} />
                   </button>
                </div>
 
                <div className="p-10 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Select Trade Specification</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-amber-500/50"
                        value={formData.wo_item_id}
                        onChange={e => setFormData(p => ({ ...p, wo_item_id: e.target.value }))}
                      >
                         <option value="">Select Work Item</option>
                         {woDetails?.items?.map(it => <option key={it.id} value={it.id}>{it.description} ({it.unit})</option>)}
                      </select>
                   </div>
 
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Measured Quantity</label>
                         <input 
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-black text-amber-600 font-mono outline-none focus:border-amber-500/50"
                            placeholder="0.00"
                            value={formData.quantity}
                            onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Date of Measurement</label>
                         <input 
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 outline-none focus:border-amber-500/50"
                            value={formData.measurement_date}
                            onChange={e => setFormData(p => ({ ...p, measurement_date: e.target.value }))}
                         />
                      </div>
                   </div>
 
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic flex items-center gap-2">
                         <MapPin size={12} className="text-amber-500" /> Precise Location / Activity Detail
                      </label>
                      <input 
                         type="text"
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-amber-500/50"
                         placeholder="E.G., BLOCK A, 14TH FLOOR, FLAT 1402... NORTH BALCONY"
                         value={formData.location_details}
                         onChange={e => setFormData(p => ({ ...p, location_details: e.target.value }))}
                      />
                   </div>
 
                   <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[2rem] p-8 text-center space-y-2 group cursor-pointer hover:border-amber-500/30 transition-all">
                      <Camera size={24} className="text-slate-400 mx-auto group-hover:text-amber-600 transition-all" />
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Attach Photographic Audit Proof</p>
                   </div>
 
                   <div className="flex gap-4 pt-6">
                      <button 
                         onClick={() => setShowForm(false)}
                         className="flex-1 py-4 bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-slate-200 hover:text-slate-900 transition-all"
                      >
                         Cancel
                      </button>
                      <button 
                         onClick={handleCreate}
                         disabled={createMutation.isPending}
                         className="flex-[2] py-4 bg-amber-600 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-600/20 italic disabled:opacity-20 flex items-center justify-center gap-2"
                      >
                         {createMutation.isPending ? 'Authenticating Data...' : 'Record Certification'} <ChevronRight size={14} />
                      </button>
                   </div>
                </div>
             </div>
          </div>
       )}
    </div>
  );
}
