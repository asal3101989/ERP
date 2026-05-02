import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, User } from 'lucide-react';
import { hrEmployeesAPI, hrMastersAPI } from '../../api/client';
import toast from 'react-hot-toast';

const SECTIONS = ['Personal','Job Details','Bank & Statutory'];

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";
const selectCls = "w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

export default function EmployeeFormPage() {
  const { id }   = useParams(); // undefined = new, id = edit
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const isEdit   = Boolean(id);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    // User
    name: '', email: '', phone: '', role: 'viewer', employee_code: '',
    // Job
    department_id: '', designation_id: '', employment_type: 'permanent',
    date_of_joining: '', probation_end_date: '', notice_period_days: 30,
    // Personal
    date_of_birth: '', gender: '', father_name: '', mother_name: '',
    marital_status: '', blood_group: '', nationality: 'Indian',
    permanent_address: '', current_address: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    // Statutory
    pan_number: '', aadhaar_number: '', uan_number: '', pf_account_number: '', esi_number: '',
    // Bank
    bank_name: '', bank_account_number: '', bank_ifsc: '',
  });

  const { data: deptData }  = useQuery({ queryKey: ['hr-departments'],  queryFn: () => hrMastersAPI.listDepts().then(r => r.data) });
  const { data: desigData } = useQuery({ queryKey: ['hr-designations'], queryFn: () => hrMastersAPI.listDesigs({ department_id: form.department_id || undefined }).then(r => r.data) });

  const departments  = deptData?.data  || [];
  const designations = desigData?.data || [];

  // Load existing data if edit
  const { data: empData } = useQuery({
    queryKey: ['hr-employee-detail', id],
    queryFn: () => hrEmployeesAPI.get(id).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (empData?.data) {
      const e = empData.data;
      setForm(prev => ({
        ...prev,
        name: e.name || '', email: e.email || '', phone: e.phone || '', role: e.role || 'viewer',
        employee_code: e.employee_code || '',
        department_id: e.department_id || '', designation_id: e.designation_id || '',
        employment_type: e.employment_type || 'permanent',
        date_of_joining: e.date_of_joining?.split('T')[0] || '',
        probation_end_date: e.probation_end_date?.split('T')[0] || '',
        notice_period_days: e.notice_period_days || 30,
        date_of_birth: e.date_of_birth?.split('T')[0] || '',
        gender: e.gender || '', father_name: e.father_name || '',
        mother_name: e.mother_name || '', marital_status: e.marital_status || '',
        blood_group: e.blood_group || '', nationality: e.nationality || 'Indian',
        permanent_address: e.permanent_address || '', current_address: e.current_address || '',
        emergency_contact_name: e.emergency_contact_name || '',
        emergency_contact_phone: e.emergency_contact_phone || '',
        pan_number: e.pan_number || '', aadhaar_number: e.aadhaar_number || '',
        uan_number: e.uan_number || '', pf_account_number: e.pf_account_number || '',
        esi_number: e.esi_number || '',
        bank_name: e.bank_name || '', bank_account_number: e.bank_account_number || '',
        bank_ifsc: e.bank_ifsc || '',
      }));
    }
  }, [empData]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? hrEmployeesAPI.update(id, data) : hrEmployeesAPI.create(data),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Employee updated' : 'Employee created');
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      const empId = isEdit ? id : res.data?.data?.id;
      if (empId) navigate(`/hr-admin/employees/${empId}`);
      else navigate('/hr-admin/employees');
    },
    onError: e => toast.error(e.response?.data?.error || 'Save failed'),
  });

  const handleSubmit = () => {
    if (!form.name || !form.email) { toast.error('Name and email are required'); setStep(0); return; }
    saveMut.mutate(form);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg"><User className="w-5 h-5 text-blue-400" /></div>
          <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Employee' : 'Add New Employee'}</h1>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex gap-2">
        {SECTIONS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
              step === i ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* Step 0: Personal */}
      {step === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" required><input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" /></Field>
            <Field label="Employee Code"><input className={inputCls} value={form.employee_code} onChange={e => set('employee_code', e.target.value)} placeholder="Auto-generated if empty" /></Field>
            <Field label="Email Address" required><input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="employee@company.com" /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Mobile number" /></Field>
            <Field label="Date of Birth"><input className={inputCls} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></Field>
            <Field label="Gender">
              <select className={selectCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Father's Name"><input className={inputCls} value={form.father_name} onChange={e => set('father_name', e.target.value)} /></Field>
            <Field label="Mother's Name"><input className={inputCls} value={form.mother_name} onChange={e => set('mother_name', e.target.value)} /></Field>
            <Field label="Marital Status">
              <select className={selectCls} value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
                <option value="">Select</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
              </select>
            </Field>
            <Field label="Blood Group"><input className={inputCls} value={form.blood_group} onChange={e => set('blood_group', e.target.value)} placeholder="e.g. O+" /></Field>
            <div className="col-span-2">
              <Field label="Permanent Address"><textarea className={inputCls} rows={2} value={form.permanent_address} onChange={e => set('permanent_address', e.target.value)} /></Field>
            </div>
            <div className="col-span-2">
              <Field label="Current Address"><textarea className={inputCls} rows={2} value={form.current_address} onChange={e => set('current_address', e.target.value)} /></Field>
            </div>
            <Field label="Emergency Contact Name"><input className={inputCls} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></Field>
            <Field label="Emergency Contact Phone"><input className={inputCls} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></Field>
          </div>
        </div>
      )}

      {/* Step 1: Job Details */}
      {step === 1 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Job Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <select className={selectCls} value={form.department_id} onChange={e => { set('department_id', e.target.value); set('designation_id', ''); }}>
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Designation">
              <select className={selectCls} value={form.designation_id} onChange={e => set('designation_id', e.target.value)}>
                <option value="">Select Designation</option>
                {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Employment Type">
              <select className={selectCls} value={form.employment_type} onChange={e => set('employment_type', e.target.value)}>
                <option value="permanent">Permanent</option>
                <option value="probation">Probation</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </Field>
            <Field label="System Role">
              <select className={selectCls} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="viewer">Viewer</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="accounts">Accounts</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Date of Joining"><input className={inputCls} type="date" value={form.date_of_joining} onChange={e => set('date_of_joining', e.target.value)} /></Field>
            <Field label="Probation End Date"><input className={inputCls} type="date" value={form.probation_end_date} onChange={e => set('probation_end_date', e.target.value)} /></Field>
            <Field label="Notice Period (Days)"><input className={inputCls} type="number" value={form.notice_period_days} onChange={e => set('notice_period_days', e.target.value)} /></Field>
          </div>
        </div>
      )}

      {/* Step 2: Bank & Statutory */}
      {step === 2 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Bank Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name"><input className={inputCls} value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></Field>
            <Field label="IFSC Code"><input className={inputCls} value={form.bank_ifsc} onChange={e => set('bank_ifsc', e.target.value)} /></Field>
            <div className="col-span-2">
              <Field label="Account Number"><input className={inputCls} value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} /></Field>
            </div>
          </div>
          <h2 className="font-semibold text-white pt-2">Statutory Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="PAN Number"><input className={inputCls} value={form.pan_number} onChange={e => set('pan_number', e.target.value.toUpperCase())} maxLength={10} placeholder="ABCDE1234F" /></Field>
            <Field label="Aadhaar Number"><input className={inputCls} value={form.aadhaar_number} onChange={e => set('aadhaar_number', e.target.value)} maxLength={12} placeholder="12 digit" /></Field>
            <Field label="UAN Number (PF)"><input className={inputCls} value={form.uan_number} onChange={e => set('uan_number', e.target.value)} placeholder="Universal Account Number" /></Field>
            <Field label="PF Account Number"><input className={inputCls} value={form.pf_account_number} onChange={e => set('pf_account_number', e.target.value)} /></Field>
            <Field label="ESI Number"><input className={inputCls} value={form.esi_number} onChange={e => set('esi_number', e.target.value)} /></Field>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm disabled:opacity-30 transition-colors"
        >
          ← Previous
        </button>
        <div className="flex gap-3">
          {step < SECTIONS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saveMut.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saveMut.isPending ? 'Saving…' : (isEdit ? 'Update Employee' : 'Add Employee')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
