// src/pages/projects/ProjectCreate.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Building2, MapPin, Briefcase } from 'lucide-react';
import { clsx } from 'clsx';

const schema = z.object({
  project_code:   z.string().min(3, 'Project code required'),
  name:           z.string().min(3, 'Project name required'),
  type:           z.enum(['residential','commercial','infrastructure','industrial']),
  client_name:    z.string().min(2, 'Client name required'),
  client_gstin:   z.string().optional(),
  client_pan:     z.string().optional(),
  location:       z.string().min(3, 'Location required'),
  city:           z.string().min(2, 'City required'),
  state:          z.string().min(2, 'State required'),
  contract_value: z.string().min(1, 'Contract value required'),
  start_date:     z.string().min(1, 'Start date required'),
  end_date:       z.string().min(1, 'End date required'),
  rera_number:    z.string().optional(),
  gst_type:       z.enum(['intra','inter']),
  description:    z.string().optional(),
});

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

export default function ProjectCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { gst_type: 'intra', type: 'residential' },
  });

  const createMutation = useMutation({
    mutationFn: (data) => projectAPI.create({ ...data, contract_value: parseFloat(data.contract_value) }),
    onSuccess: (res) => {
      toast.success('Project created successfully!');
      qc.invalidateQueries(['projects']);
      navigate(`/projects/${res.data.data.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create project'),
  });

  const projectType = watch('type');

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 shadow-sm transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">New Project Setup</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Initialize construction portfolio entry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(createMutation.mutate)} className="space-y-6">
        
        {/* Basic Info */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><Building2 size={18} /></div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] italic">Project Parameters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Project Code *</label>
              <input {...register('project_code')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm" placeholder="PRJ-001" />
              {errors.project_code && <p className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wide">{errors.project_code.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Project Type *</label>
              <select {...register('type')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none">
                <option value="residential">Residential Complex</option>
                <option value="commercial">Commercial Hub</option>
                <option value="infrastructure">Core Infrastructure</option>
                <option value="industrial">Industrial Facility</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Project Full Name *</label>
            <input {...register('name')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black text-slate-900 italic outline-none focus:border-indigo-400 transition-all shadow-sm" placeholder="e.g. Skyline Heights — 2B+G+18 Tower" />
            {errors.name && <p className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wide">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Scope Description</label>
            <textarea {...register('description')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm" rows={2} placeholder="Brief project scope & description..." />
          </div>
        </div>

        {/* Client */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm"><Briefcase size={18} /></div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] italic">Client Registry</h2>
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Client Entity Name *</label>
            <input {...register('client_name')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase italic outline-none focus:border-blue-400 transition-all shadow-sm" placeholder="e.g. TQS Developers Pvt Ltd" />
            {errors.client_name && <p className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wide">{errors.client_name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">GSTIN</label>
              <input {...register('client_gstin')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 font-mono uppercase tracking-widest outline-none focus:border-blue-400 transition-all shadow-sm" placeholder="27AABCS1234C1Z5" maxLength={15} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">PAN</label>
              <input {...register('client_pan')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 font-mono uppercase tracking-widest outline-none focus:border-blue-400 transition-all shadow-sm" placeholder="AABCS1234C" maxLength={10} />
            </div>
          </div>
        </div>

        {/* Location & Tax */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm"><MapPin size={18} /></div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] italic">Geography & Compliance</h2>
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Site Address *</label>
            <input {...register('location')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-400 transition-all shadow-sm" placeholder="Plot No., Street, Area" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">City *</label>
              <input {...register('city')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase italic outline-none focus:border-emerald-400 transition-all shadow-sm" placeholder="Pune" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">State *</label>
              <select {...register('state')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase italic outline-none focus:border-emerald-400 transition-all shadow-sm appearance-none">
                <option value="">Select State</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">GST Mode *</label>
              <select {...register('gst_type')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase italic outline-none focus:border-emerald-400 transition-all shadow-sm appearance-none">
                <option value="intra">Intra-state (CGST + SGST)</option>
                <option value="inter">Inter-state (IGST)</option>
              </select>
            </div>
            {projectType === 'residential' && (
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">RERA / MahaRERA No.</label>
                <input {...register('rera_number')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 font-mono uppercase tracking-widest outline-none focus:border-emerald-400 transition-all shadow-sm" placeholder="P52100054321" />
              </div>
            )}
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm"><Save size={18} /></div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] italic">Fiscal Baseline</h2>
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Contract Value (INR) *</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black italic">₹</span>
              <input {...register('contract_value')} type="number" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-5 py-4 text-lg font-black text-slate-900 font-mono tracking-tighter outline-none focus:border-amber-400 transition-all shadow-sm" placeholder="85000000" />
            </div>
            {errors.contract_value && <p className="text-red-500 text-[10px] font-bold mt-1.5 uppercase tracking-wide">{errors.contract_value.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Strategic Start Date *</label>
              <input {...register('start_date')} type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase italic outline-none focus:border-amber-400 transition-all shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Target Completion *</label>
              <input {...register('end_date')} type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-900 uppercase italic outline-none focus:border-amber-400 transition-all shadow-sm" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm italic">
             Discard Protocol
          </button>
          <button type="submit" disabled={createMutation.isPending} className="flex-[2] py-5 bg-blue-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 italic disabled:opacity-50">
            <Save size={16} />
            {createMutation.isPending ? 'Initializing Ledger...' : 'Commit Project Blueprint'}
          </button>
        </div>
      </form>
    </div>
  );
}
