// src/pages/projects/ProjectCreate.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Building2, MapPin, Briefcase, IndianRupee, ChevronRight } from 'lucide-react';

const schema = z.object({
  project_code:   z.string().min(3, 'Project code is required'),
  name:           z.string().min(3, 'Project name is required'),
  type:           z.enum(['residential','commercial','infrastructure','industrial']),
  client_name:    z.string().min(2, 'Client name is required'),
  client_gstin:   z.string().optional(),
  client_pan:     z.string().optional(),
  location:       z.string().min(3, 'Location is required'),
  city:           z.string().min(2, 'City is required'),
  state:          z.string().min(2, 'State is required'),
  contract_value: z.string().min(1, 'Contract value is required'),
  start_date:     z.string().min(1, 'Start date is required'),
  end_date:       z.string().min(1, 'End date is required'),
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

const inputCls = 'w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
const errorCls = 'mt-1 text-xs text-red-500';

function Field({ label, error, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className={errorCls}>{error}</p>}
    </div>
  );
}

function Section({ icon: Icon, color, title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className={`flex items-center gap-3 border-b border-gray-100 px-5 py-4 ${color}`}>
        <Icon className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function ProjectCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { gst_type: 'intra', type: 'residential' },
  });

  const createMutation = useMutation({
    mutationFn: data => projectAPI.create({ ...data, contract_value: parseFloat(data.contract_value) }),
    onSuccess: res => {
      toast.success('Project created successfully!');
      qc.invalidateQueries(['projects']);
      navigate(`/projects/${res.data.data.id}`);
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create project'),
  });

  const projectType = watch('type');

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Bar */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Overview</span>
          <ChevronRight className="h-4 w-4" />
          <span className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/projects')}>Projects</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-semibold text-gray-800">New Project</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">

        {/* Page Header */}
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:text-blue-600 transition">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">New Project</h1>
            <p className="text-xs text-gray-400">Fill in the details to create a new project</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(createMutation.mutate)} className="space-y-4">

          {/* 1. Project Details */}
          <Section icon={Building2} color="bg-blue-50 text-blue-600" title="Project Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Project Code *" error={errors.project_code?.message}>
                <input {...register('project_code')} className={inputCls} placeholder="PRJ-001" />
              </Field>
              <Field label="Project Type *" error={errors.type?.message}>
                <select {...register('type')} className={inputCls}>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="industrial">Industrial</option>
                </select>
              </Field>
            </div>
            <Field label="Project Name *" error={errors.name?.message}>
              <input {...register('name')} className={inputCls} placeholder="e.g. Skyline Heights — 2B+G+18 Tower" />
            </Field>
            <Field label="Project Description">
              <textarea {...register('description')} className={inputCls + ' resize-none'} rows={2} placeholder="Brief project scope and description..." />
            </Field>
          </Section>

          {/* 2. Client Details */}
          <Section icon={Briefcase} color="bg-indigo-50 text-indigo-600" title="Client Details">
            <Field label="Client Name *" error={errors.client_name?.message}>
              <input {...register('client_name')} className={inputCls} placeholder="e.g. TQS Developers Pvt Ltd" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Client GSTIN">
                <input {...register('client_gstin')} className={inputCls + ' font-mono uppercase'} placeholder="27AABCS1234C1Z5" maxLength={15} />
              </Field>
              <Field label="Client PAN">
                <input {...register('client_pan')} className={inputCls + ' font-mono uppercase'} placeholder="AABCS1234C" maxLength={10} />
              </Field>
            </div>
          </Section>

          {/* 3. Location & Compliance */}
          <Section icon={MapPin} color="bg-green-50 text-green-600" title="Location & Compliance">
            <Field label="Site Address *" error={errors.location?.message}>
              <input {...register('location')} className={inputCls} placeholder="Plot No., Street, Area" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City *" error={errors.city?.message}>
                <input {...register('city')} className={inputCls} placeholder="Bangalore" />
              </Field>
              <Field label="State *" error={errors.state?.message}>
                <select {...register('state')} className={inputCls}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="GST Type *">
                <select {...register('gst_type')} className={inputCls}>
                  <option value="intra">Intra-state (CGST + SGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                </select>
              </Field>
              {projectType === 'residential' && (
                <Field label="RERA / MahaRERA Number">
                  <input {...register('rera_number')} className={inputCls + ' font-mono uppercase'} placeholder="P52100054321" />
                </Field>
              )}
            </div>
          </Section>

          {/* 4. Financial & Timeline */}
          <Section icon={IndianRupee} color="bg-amber-50 text-amber-600" title="Financial & Timeline">
            <Field label="Contract Value (₹) *" error={errors.contract_value?.message}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                <input {...register('contract_value')} type="number" className={inputCls + ' pl-7 font-mono'} placeholder="85000000" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date *" error={errors.start_date?.message}>
                <input {...register('start_date')} type="date" className={inputCls} />
              </Field>
              <Field label="End Date *" error={errors.end_date?.message}>
                <input {...register('end_date')} type="date" className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => navigate(-1)} className="rounded border border-gray-200 bg-white px-5 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
