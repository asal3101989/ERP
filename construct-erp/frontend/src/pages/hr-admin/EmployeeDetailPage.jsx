import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, User, Calendar, CreditCard, TrendingUp, FileText, Briefcase,
  Phone, Mail, MapPin, Shield, Building2, Edit2, Upload, Trash2, Download, Plus
} from 'lucide-react';
import { hrEmployeesAPI, hrLeaveAPI, hrPayrollAPI, hrLoansAPI, hrAppraisalsAPI } from '../../api/client';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'profile',    label: 'Profile',     icon: User       },
  { id: 'leaves',     label: 'Leaves',      icon: Calendar   },
  { id: 'payroll',    label: 'Payroll',      icon: CreditCard },
  { id: 'loans',      label: 'Loans',        icon: Briefcase  },
  { id: 'appraisals', label: 'Appraisals',   icon: TrendingUp },
  { id: 'documents',  label: 'Documents',    icon: FileText   },
];

const DOC_TYPES = ['offer_letter','joining_letter','id_proof','address_proof','degree','pf_form','esic_form','other'];

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-slate-200 text-sm">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function ProfileTab({ emp, refetch }) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => navigate(`/hr-admin/employees/${emp.id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
        >
          <Edit2 className="w-4 h-4" /> Edit Profile
        </button>
      </div>

      <Section title="Personal Information">
        <InfoRow label="Date of Birth"    value={emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString('en-IN') : null} />
        <InfoRow label="Gender"           value={emp.gender} />
        <InfoRow label="Father's Name"    value={emp.father_name} />
        <InfoRow label="Mother's Name"    value={emp.mother_name} />
        <InfoRow label="Marital Status"   value={emp.marital_status} />
        <InfoRow label="Blood Group"      value={emp.blood_group} />
        <InfoRow label="Nationality"      value={emp.nationality} />
      </Section>

      <Section title="Employment Details">
        <InfoRow label="Employee Code"    value={emp.employee_code} />
        <InfoRow label="Department"       value={emp.department_name} />
        <InfoRow label="Designation"      value={emp.designation_name} />
        <InfoRow label="Grade"            value={emp.grade} />
        <InfoRow label="Employment Type"  value={emp.employment_type} />
        <InfoRow label="Date of Joining"  value={emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString('en-IN') : null} />
        <InfoRow label="Notice Period"    value={emp.notice_period_days ? `${emp.notice_period_days} days` : null} />
        <InfoRow label="Email"            value={emp.email} />
        <InfoRow label="Phone"            value={emp.phone} />
      </Section>

      <Section title="Statutory / Compliance">
        <InfoRow label="PAN Number"       value={emp.pan_number} />
        <InfoRow label="Aadhaar Number"   value={emp.aadhaar_number} />
        <InfoRow label="UAN (PF)"         value={emp.uan_number} />
        <InfoRow label="PF Account No."   value={emp.pf_account_number} />
        <InfoRow label="ESI Number"       value={emp.esi_number} />
      </Section>

      <Section title="Bank Details">
        <InfoRow label="Bank Name"        value={emp.bank_name} />
        <InfoRow label="Account Number"   value={emp.bank_account_number} />
        <InfoRow label="IFSC Code"        value={emp.bank_ifsc} />
      </Section>

      <Section title="Address">
        <div className="col-span-2">
          <InfoRow label="Permanent Address" value={emp.permanent_address} />
        </div>
        <div className="col-span-2">
          <InfoRow label="Current Address"   value={emp.current_address} />
        </div>
        <InfoRow label="Emergency Contact"  value={emp.emergency_contact_name} />
        <InfoRow label="Emergency Phone"    value={emp.emergency_contact_phone} />
      </Section>
    </div>
  );
}

function LeavesTab({ empId }) {
  const year = new Date().getFullYear();
  const { data: balData } = useQuery({
    queryKey: ['hr-leave-balances', empId, year],
    queryFn: () => hrLeaveAPI.getBalances({ user_id: empId, year }).then(r => r.data),
  });
  const { data: reqData } = useQuery({
    queryKey: ['hr-leave-requests', empId],
    queryFn: () => hrLeaveAPI.listRequests({ user_id: empId }).then(r => r.data),
  });

  const balances = balData?.data || [];
  const requests = reqData?.data || [];

  const STATUS_PILL = {
    pending:  'bg-amber-900/30 text-amber-400',
    approved: 'bg-emerald-900/30 text-emerald-400',
    rejected: 'bg-red-900/30 text-red-400',
    cancelled:'bg-slate-700 text-slate-400',
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Leave Balances — {year}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {balances.map(b => (
          <div key={b.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white text-sm">{b.leave_type_name}</span>
              <span className="text-xs text-slate-500">{b.code}</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{parseFloat(b.closing_balance).toFixed(1)}</div>
            <div className="text-xs text-slate-500 mt-1">Available</div>
            <div className="mt-2 flex gap-3 text-xs text-slate-400">
              <span>Taken: {parseFloat(b.taken).toFixed(1)}</span>
              <span>Accrued: {parseFloat(b.accrued).toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Leave History</h3>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {['Type','From','To','Days','Reason','Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-300">{r.leave_type_name}</td>
                <td className="px-4 py-3 text-slate-300">{new Date(r.from_date).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3 text-slate-300">{new Date(r.to_date).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3 text-white font-medium">{r.days}</td>
                <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{r.reason || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_PILL[r.status] || ''}`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">No leave history</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayrollTab({ empId }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['hr-payroll-emp', empId],
    queryFn: () => hrPayrollAPI.list({ user_id: empId }).then(r => r.data),
  });
  const records = data?.data || [];
  const STATUS_PILL = {
    draft:    'bg-slate-700 text-slate-300',
    approved: 'bg-blue-900/30 text-blue-400',
    paid:     'bg-emerald-900/30 text-emerald-400',
  };
  const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {['Period','Gross','Deductions','Net Pay','Status','Action'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="px-4 py-3 text-slate-300 font-medium">{MONTHS[r.month]} {r.year}</td>
              <td className="px-4 py-3 text-white">₹{parseFloat(r.gross_earnings).toLocaleString('en-IN')}</td>
              <td className="px-4 py-3 text-red-400">₹{parseFloat(r.total_deductions).toLocaleString('en-IN')}</td>
              <td className="px-4 py-3 text-emerald-400 font-bold">₹{parseFloat(r.net_pay).toLocaleString('en-IN')}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_PILL[r.status] || ''}`}>{r.status}</span>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => navigate(`/hr-admin/payroll/${r.id}/payslip`)}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <Download className="w-3 h-3" /> Payslip
                </button>
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-slate-500">No payroll records</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LoansTab({ empId }) {
  const { data } = useQuery({
    queryKey: ['hr-loans-emp', empId],
    queryFn: () => hrLoansAPI.list({ user_id: empId }).then(r => r.data),
  });
  const loans = data?.data || [];
  const STATUS_PILL = {
    pending:  'bg-amber-900/30 text-amber-400',
    approved: 'bg-blue-900/30 text-blue-400',
    rejected: 'bg-red-900/30 text-red-400',
    closed:   'bg-emerald-900/30 text-emerald-400',
  };

  return (
    <div className="space-y-3">
      {loans.map(l => (
        <div key={l.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-semibold text-white capitalize">{l.loan_type}</span>
              <span className="text-slate-400 text-sm ml-2">— {l.reason}</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_PILL[l.status] || ''}`}>{l.status}</span>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><div className="text-slate-500 text-xs">Amount</div><div className="text-white font-bold">₹{parseFloat(l.amount).toLocaleString('en-IN')}</div></div>
            <div><div className="text-slate-500 text-xs">Repaid</div><div className="text-emerald-400">₹{parseFloat(l.repaid_amount||0).toLocaleString('en-IN')}</div></div>
            <div><div className="text-slate-500 text-xs">Balance</div><div className="text-amber-400">₹{parseFloat(l.balance_amount||l.amount).toLocaleString('en-IN')}</div></div>
            <div><div className="text-slate-500 text-xs">EMI</div><div className="text-slate-300">{l.emi_amount ? `₹${parseFloat(l.emi_amount).toLocaleString('en-IN')}/mo` : '—'}</div></div>
          </div>
          {l.status === 'approved' && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Repayment Progress</span>
                <span>{l.amount > 0 ? Math.round((l.repaid_amount / l.amount) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, l.amount > 0 ? (l.repaid_amount/l.amount)*100 : 0)}%` }} />
              </div>
            </div>
          )}
        </div>
      ))}
      {loans.length === 0 && <div className="text-center py-8 text-slate-500">No loans or advances</div>}
    </div>
  );
}

function AppraisalsTab({ empId }) {
  const { data } = useQuery({
    queryKey: ['hr-appraisals-emp', empId],
    queryFn: () => hrAppraisalsAPI.list({ user_id: empId }).then(r => r.data),
  });
  const appraisals = data?.data || [];
  const RATING_COLORS = { Excellent: 'text-emerald-400', Good: 'text-blue-400', Average: 'text-amber-400', Poor: 'text-red-400' };

  return (
    <div className="space-y-3">
      {appraisals.map(a => (
        <div key={a.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-semibold text-white text-lg">{a.review_period}</span>
              <span className="text-slate-400 text-sm ml-2">{a.review_date ? new Date(a.review_date).toLocaleDateString('en-IN') : ''}</span>
            </div>
            <span className={`text-xl font-bold ${RATING_COLORS[a.overall_rating] || 'text-slate-300'}`}>
              {a.overall_rating || 'Pending'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-slate-500 text-xs">KRA Score</div><div className="text-white font-bold text-lg">{a.kra_score || '—'}/100</div></div>
            <div><div className="text-slate-500 text-xs">Increment</div><div className="text-emerald-400 font-bold">{a.increment_pct || 0}%</div></div>
            <div><div className="text-slate-500 text-xs">New CTC</div><div className="text-white">{a.new_ctc ? `₹${parseFloat(a.new_ctc).toLocaleString('en-IN')}` : '—'}</div></div>
          </div>
          {a.comments && <div className="mt-3 text-slate-400 text-sm italic">"{a.comments}"</div>}
          <div className="mt-3 text-xs text-slate-500">Reviewed by: {a.reviewer_name} | Status: {a.status}</div>
        </div>
      ))}
      {appraisals.length === 0 && <div className="text-center py-8 text-slate-500">No appraisal records</div>}
    </div>
  );
}

function DocumentsTab({ emp, refetch }) {
  const qc = useQueryClient();
  const docs = emp.documents || [];
  const fileRef = React.useRef();
  const [docType, setDocType] = useState('id_proof');
  const [docName, setDocName] = useState('');

  const uploadMut = useMutation({
    mutationFn: ({ file, type, name }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', type);
      fd.append('doc_name', name || file.name);
      return hrEmployeesAPI.uploadDocument(emp.id, fd);
    },
    onSuccess: () => { toast.success('Document uploaded'); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Upload failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (docId) => hrEmployeesAPI.deleteDocument(emp.id, docId),
    onSuccess: () => { toast.success('Document deleted'); refetch(); },
    onError: e => toast.error(e.response?.data?.error || 'Delete failed'),
  });

  return (
    <div>
      {/* Upload Area */}
      <div className="bg-slate-800/50 border border-slate-700 border-dashed rounded-xl p-6 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
              {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-slate-400 block mb-1">Document Name</label>
            <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Aadhaar Card"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={e => {
            if (e.target.files[0]) uploadMut.mutate({ file: e.target.files[0], type: docType, name: docName });
          }} />
          <button onClick={() => fileRef.current.click()}
            disabled={uploadMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors">
            <Upload className="w-4 h-4" /> {uploadMut.isPending ? 'Uploading…' : 'Upload File'}
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-2">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-white text-sm font-medium">{doc.doc_name}</div>
                <div className="text-slate-400 text-xs capitalize">{doc.doc_type?.replace(/_/g,' ')} · {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={doc.file_url} target="_blank" rel="noreferrer"
                className="p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-700">
                <Download className="w-4 h-4" />
              </a>
              <button onClick={() => { if (window.confirm('Delete this document?')) deleteMut.mutate(doc.id); }}
                className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {docs.length === 0 && <div className="text-center py-8 text-slate-500">No documents uploaded</div>}
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hr-employee-detail', id],
    queryFn: () => hrEmployeesAPI.get(id).then(r => r.data),
  });

  const emp = data?.data;

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading employee…</div>;
  if (!emp)      return <div className="text-center py-20 text-red-400">Employee not found</div>;

  const initials = emp.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/hr-admin/employees')}
          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{emp.name}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400 mt-0.5">
            <span>{emp.employee_code}</span>
            <span>·</span>
            <span>{emp.designation_name || emp.designation || 'No Designation'}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{emp.department_name || 'No Department'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm mt-1">
            {emp.email && <span className="flex items-center gap-1 text-slate-400"><Mail className="w-3 h-3" />{emp.email}</span>}
            {emp.phone && <span className="flex items-center gap-1 text-slate-400"><Phone className="w-3 h-3" />{emp.phone}</span>}
          </div>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            emp.employment_status === 'active' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700' : 'bg-red-900/30 text-red-400 border border-red-700'
          }`}>{emp.employment_status || 'active'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700 flex gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile'    && <ProfileTab emp={emp} refetch={refetch} />}
        {activeTab === 'leaves'     && <LeavesTab empId={id} />}
        {activeTab === 'payroll'    && <PayrollTab empId={id} />}
        {activeTab === 'loans'      && <LoansTab empId={id} />}
        {activeTab === 'appraisals' && <AppraisalsTab empId={id} />}
        {activeTab === 'documents'  && <DocumentsTab emp={emp} refetch={refetch} />}
      </div>
    </div>
  );
}
