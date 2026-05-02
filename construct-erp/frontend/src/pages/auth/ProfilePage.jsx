// src/pages/auth/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  User, Lock, Building2, Save, Eye, EyeOff, Mail, Phone,
  Briefcase, Shield, Clock, CheckCircle, AlertCircle,
  Camera, Key, MapPin, Hash, FileText, Info, ChevronRight
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../api/client';

const ROLE_COLORS = {
  super_admin:    { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  admin:          { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  project_manager:{ bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  site_engineer:  { bg: '#F0FDFA', text: '#0D9488', border: '#99F6E4' },
  qs_engineer:    { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  accountant:     { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  hse_officer:    { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
  it_admin:       { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD' },
  viewer:         { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
};

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

function TabBtn({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
      style={active
        ? { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }
        : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }
      }>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: '#fff' }}>
      <div className="px-5 py-4 flex items-start gap-3"
        style={{ borderBottom: '1px solid var(--border)', background: '#FAFBFC' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <Icon className="w-4 h-4" style={{ color: '#2563EB' }} />
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isDemoMode } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [pfSeeded, setPfSeeded] = useState(false);
  const [coSeeded, setCoSeeded] = useState(false);

  // Profile form state
  const [pf, setPf] = useState({
    full_name: '', email: '', mobile: '', designation: '', department: '',
  });

  // Company form state
  const [co, setCo] = useState({
    company_name: '', company_gstin: '', company_pan: '', company_state: '',
    company_address: '', company_cin: '', company_email: '', company_phone: '',
  });

  // Password form
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  // Fetch full profile (includes company fields)
  const { data: profileData } = useQuery({
    queryKey: ['auth-profile'],
    queryFn: () => api.get('/auth/profile').then(r => r.data),
    retry: false,
  });

  // Seed profile form once from API, fallback to authStore
  useEffect(() => {
    if (pfSeeded) return;
    const src = profileData || user;
    if (!src) return;
    setPf({
      full_name:   src.full_name || src.name || '',
      email:       src.email       || '',
      mobile:      src.phone       || src.mobile || '',
      designation: src.designation || '',
      department:  src.department  || '',
    });
    setPfSeeded(true);
  }, [profileData, user, pfSeeded]);

  // Seed company form once from API, fallback to authStore
  useEffect(() => {
    if (coSeeded) return;
    const src = profileData || user;
    if (!src) return;
    setCo({
      company_name:    src.company_name    || 'BCIM Engineering Private Limited',
      company_gstin:   src.company_gstin   || '',
      company_pan:     src.company_pan     || '',
      company_state:   src.company_state   || '',
      company_address: src.company_address || '',
      company_cin:     src.company_cin     || '',
      company_email:   src.company_email   || '',
      company_phone:   src.company_phone   || '',
    });
    setCoSeeded(true);
  }, [profileData, user, coSeeded]);

  const demoToast = () => toast('You are in demo mode. Register your company first to save real data.', {
    icon: 'ℹ️', duration: 4000,
    style: { background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }
  });

  const updateMut = useMutation({
    mutationFn: (d) => {
      if (isDemoMode) return Promise.reject({ _demo: true });
      return api.put('/auth/profile', d);
    },
    onSuccess: () => toast.success('Profile updated successfully'),
    onError: (err) => {
      if (err?._demo || err?.response?.status === 401) return demoToast();
      toast.error(err?.response?.data?.error || 'Failed to update profile');
    },
  });

  const companyMut = useMutation({
    mutationFn: (d) => {
      if (isDemoMode) return Promise.reject({ _demo: true });
      return api.put('/auth/company', d);
    },
    onSuccess: () => toast.success('Company details updated successfully'),
    onError: (err) => {
      if (err?._demo || err?.response?.status === 401) return demoToast();
      toast.error(err?.response?.data?.error || 'Failed to update company details');
    },
  });

  const passwordMut = useMutation({
    mutationFn: (d) => {
      if (isDemoMode) return Promise.reject({ _demo: true });
      return api.post('/auth/change-password', d);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPw({ current_password: '', new_password: '', confirm_password: '' });
    },
    onError: (err) => {
      if (err?._demo || err?.response?.status === 401) return demoToast();
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to change password');
    },
  });

  const handlePasswordSubmit = () => {
    if (!pw.current_password) return toast.error('Enter your current password');
    if (pw.new_password.length < 8) return toast.error('New password must be at least 8 characters');
    if (pw.new_password !== pw.confirm_password) return toast.error('Passwords do not match');
    passwordMut.mutate(pw);
  };

  const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.viewer;
  const roleLabel = (user?.role || 'user').replace(/_/g, ' ');

  const pwStrength = (() => {
    const p = pw.new_password;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 2) return { label: 'Weak', color: '#EF4444', width: '30%' };
    if (score <= 3) return { label: 'Fair', color: '#F59E0B', width: '55%' };
    if (score === 4) return { label: 'Good', color: '#10B981', width: '75%' };
    return { label: 'Strong', color: '#059669', width: '100%' };
  })();

  return (
    <div className="max-w-4xl space-y-6">

      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-semibold">Demo Mode — </span>
            Changes cannot be saved. To use this ERP for your company,{' '}
            <a href="/register" className="underline font-semibold" style={{ color: '#D97706' }}>
              register BCIM Engineering
            </a>{' '}
            as a new company and log in with your real account.
          </div>
        </div>
      )}

      {/* Page heading */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Profile & Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Manage your personal account, security and company configuration
        </p>
      </div>

      {/* Profile hero card */}
      <div className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', background: '#fff' }}>

        {/* Cover bar */}
        <div className="h-20" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)' }} />

        <div className="px-6 pb-5">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
                  border: '3px solid #fff',
                }}>
                {initials}
              </div>
              <button className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#2563EB', border: '2px solid #fff' }}
                title="Change avatar (coming soon)">
                <Camera className="w-2.5 h-2.5 text-white" />
              </button>
            </div>

            <div className="flex-1 min-w-0 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{user?.name || 'User'}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{ background: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}` }}>
                  {roleLabel}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {user?.designation && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Briefcase className="w-3 h-3" />{user.designation}
                  </span>
                )}
                {user?.email && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Mail className="w-3 h-3" />{user.email}
                  </span>
                )}
              </div>
            </div>

            {/* Stats chips */}
            <div className="hidden sm:flex items-center gap-2 mb-1">
              <div className="text-center px-4 py-2 rounded-lg"
                style={{ background: '#F8FAFC', border: '1px solid var(--border)' }}>
                <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {user?.employee_code || '—'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Emp Code</div>
              </div>
              <div className="text-center px-4 py-2 rounded-lg"
                style={{ background: '#F8FAFC', border: '1px solid var(--border)' }}>
                <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {user?.company_id ? 'Active' : 'Demo'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Status</div>
              </div>
            </div>
          </div>

          {/* Company ribbon */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: '#F8FAFC', border: '1px solid var(--border)' }}>
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#2563EB' }} />
            <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
              {user?.company_name || 'BCIM Engineering Private Limited'}
            </span>
            {user?.company_gstin && (
              <>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  GSTIN: {user.company_gstin}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        <TabBtn active={tab === 'profile'}  icon={User}      label="Personal Info"     onClick={() => setTab('profile')}  />
        <TabBtn active={tab === 'password'} icon={Key}       label="Change Password"   onClick={() => setTab('password')} />
        <TabBtn active={tab === 'company'}  icon={Building2} label="Company Details"   onClick={() => setTab('company')}  />
        <TabBtn active={tab === 'signature'} icon={FileText}  label="Digital Signature" onClick={() => setTab('signature')} />
        <TabBtn active={tab === 'security'} icon={Shield}    label="Security"          onClick={() => setTab('security')} />
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === 'profile' && (
        <SectionCard title="Personal Information" subtitle="Update your name, contact details and designation" icon={User}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label="Full Name">
              <input className="input" value={pf.full_name}
                onChange={e => setPf(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Your full name" />
            </FieldGroup>

            <FieldGroup label="Mobile Number">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-dim)' }} />
                <input className="input pl-9" value={pf.mobile}
                  onChange={e => setPf(f => ({ ...f, mobile: e.target.value }))}
                  placeholder="10-digit mobile" maxLength={10} />
              </div>
            </FieldGroup>

            <FieldGroup label="Email Address">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-dim)' }} />
                <input className="input pl-9" type="email" value={pf.email}
                  onChange={e => setPf(f => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com" />
              </div>
            </FieldGroup>

            <FieldGroup label="Designation">
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-dim)' }} />
                <input className="input pl-9" value={pf.designation}
                  onChange={e => setPf(f => ({ ...f, designation: e.target.value }))}
                  placeholder="e.g. Project Manager" />
              </div>
            </FieldGroup>

            <FieldGroup label="Department">
              <input className="input" value={pf.department}
                onChange={e => setPf(f => ({ ...f, department: e.target.value }))}
                placeholder="e.g. QS & Estimation" />
            </FieldGroup>

            <FieldGroup label="Role">
              <div className="input flex items-center gap-2 cursor-not-allowed"
                style={{ background: '#F8FAFC', color: 'var(--text-muted)' }}>
                <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: roleColor.text }} />
                <span className="capitalize">{roleLabel}</span>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>Read-only</span>
              </div>
            </FieldGroup>
          </div>

          <div className="flex justify-end pt-4 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button className="btn-primary flex items-center gap-2 px-5"
              onClick={() => updateMut.mutate(pf)}
              disabled={updateMut.isPending}>
              <Save className="w-4 h-4" />
              {updateMut.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── PASSWORD TAB ── */}
      {tab === 'password' && (
        <div className="space-y-4">
          <SectionCard title="Change Password" subtitle="Use a strong password of at least 8 characters" icon={Key}>
            <div className="max-w-sm space-y-4">
              {[
                { key: 'current', field: 'current_password', label: 'Current Password' },
                { key: 'new',     field: 'new_password',     label: 'New Password'     },
                { key: 'confirm', field: 'confirm_password', label: 'Confirm New Password' },
              ].map(({ key, field, label }) => (
                <FieldGroup key={key} label={label}>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                      style={{ color: 'var(--text-dim)' }} />
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      className="input pl-9 pr-10"
                      value={pw[field]}
                      onChange={e => setPw(f => ({ ...f, [field]: e.target.value }))}
                      placeholder="••••••••"
                    />
                    <button type="button"
                      onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'var(--text-muted)' }}>
                      {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FieldGroup>
              ))}

              {/* Password strength */}
              {pwStrength && (
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    <span>Password strength</span>
                    <span style={{ color: pwStrength.color, fontWeight: 600 }}>{pwStrength.label}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: pwStrength.width, background: pwStrength.color }} />
                  </div>
                </div>
              )}

              {/* Mismatch warning */}
              {pw.new_password && pw.confirm_password && pw.new_password !== pw.confirm_password && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Passwords do not match
                </div>
              )}

              {pw.new_password && pw.confirm_password && pw.new_password === pw.confirm_password && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Passwords match
                </div>
              )}

              <div className="pt-1 flex items-center gap-3">
                <button className="btn-primary flex items-center gap-2"
                  onClick={handlePasswordSubmit}
                  disabled={passwordMut.isPending}>
                  <Key className="w-4 h-4" />
                  {passwordMut.isPending ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Tips card */}
          <div className="rounded-xl p-4 flex gap-3"
            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#2563EB' }} />
            <div className="text-xs space-y-1" style={{ color: '#1E40AF' }}>
              <p className="font-semibold">Password tips</p>
              <p>• Use at least 8 characters</p>
              <p>• Mix uppercase, lowercase, numbers and symbols</p>
              <p>• Avoid using your name or common words</p>
              <p>• Don't reuse passwords across different services</p>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPANY TAB ── */}
      {tab === 'company' && (
        <SectionCard
          title="Company Information"
          subtitle="BCIM Engineering Private Limited — statutory and contact details"
          icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldGroup label="Company Name">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: 'var(--text-dim)' }} />
                  <input className="input pl-9" value={co.company_name}
                    onChange={e => setCo(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="Registered company name" />
                </div>
              </FieldGroup>
            </div>

            <FieldGroup label="GSTIN">
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-dim)' }} />
                <input className="input pl-9 font-mono tracking-wider uppercase" value={co.company_gstin}
                  onChange={e => setCo(f => ({ ...f, company_gstin: e.target.value.toUpperCase() }))}
                  placeholder="27AAABC1234D1Z5" maxLength={15} />
              </div>
            </FieldGroup>

            <FieldGroup label="PAN">
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-dim)' }} />
                <input className="input pl-9 font-mono tracking-wider uppercase" value={co.company_pan}
                  onChange={e => setCo(f => ({ ...f, company_pan: e.target.value.toUpperCase() }))}
                  placeholder="AAABC1234D" maxLength={10} />
              </div>
            </FieldGroup>

            <FieldGroup label="CIN (optional)">
              <input className="input font-mono" value={co.company_cin}
                onChange={e => setCo(f => ({ ...f, company_cin: e.target.value }))}
                placeholder="U45200MH2020PTC123456" />
            </FieldGroup>

            <FieldGroup label="State">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--text-dim)' }} />
                <select className="input pl-9 appearance-none" value={co.company_state}
                  onChange={e => setCo(f => ({ ...f, company_state: e.target.value }))}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </FieldGroup>

            <FieldGroup label="Company Email">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-dim)' }} />
                <input className="input pl-9" type="email" value={co.company_email}
                  onChange={e => setCo(f => ({ ...f, company_email: e.target.value }))}
                  placeholder="accounts@bcimeng.in" />
              </div>
            </FieldGroup>

            <FieldGroup label="Company Phone">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: 'var(--text-dim)' }} />
                <input className="input pl-9" value={co.company_phone}
                  onChange={e => setCo(f => ({ ...f, company_phone: e.target.value }))}
                  placeholder="+91 22 1234 5678" />
              </div>
            </FieldGroup>

            <div className="sm:col-span-2">
              <FieldGroup label="Registered Address">
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-3.5 h-3.5"
                    style={{ color: 'var(--text-dim)' }} />
                  <textarea className="input pl-9 resize-none" rows={3} value={co.company_address}
                    onChange={e => setCo(f => ({ ...f, company_address: e.target.value }))}
                    placeholder="Plot No., Street, Area, City — PIN Code" />
                </div>
              </FieldGroup>
            </div>
          </div>

          {/* Compliance badges */}
          <div className="mt-4 pt-4 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--border)' }}>
            {['GST Compliant', 'TDS 194C/194J', 'BOCW Act', 'RERA Ready', 'PF/ESI'].map(tag => (
              <span key={tag} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                <CheckCircle className="w-3 h-3" />{tag}
              </span>
            ))}
          </div>

          <div className="flex justify-end pt-4 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button className="btn-primary flex items-center gap-2 px-5"
              onClick={() => companyMut.mutate(co)}
              disabled={companyMut.isPending}>
              <Save className="w-4 h-4" />
              {companyMut.isPending ? 'Saving…' : 'Save Company Details'}
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === 'security' && (
        <div className="space-y-4">
          {/* Session info */}
          <SectionCard title="Account Security" subtitle="Overview of your account access and session" icon={Shield}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Clock, label: 'Last Login',
                  value: new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
                  color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE'
                },
                {
                  icon: CheckCircle, label: 'Account Status',
                  value: 'Active & Verified',
                  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0'
                },
                {
                  icon: Shield, label: 'Auth Method',
                  value: 'Email & Password',
                  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE'
                },
              ].map(({ icon: Icon, label, value, color, bg, border }) => (
                <div key={label} className="rounded-xl p-4"
                  style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Permissions */}
          <SectionCard title="Role & Permissions" subtitle={`You are signed in as ${roleLabel}`} icon={Key}>
            <div className="space-y-2">
              {[
                { label: 'View all modules',             allowed: true  },
                { label: 'Create & edit records',        allowed: ['admin','super_admin','project_manager'].includes(user?.role) },
                { label: 'Approve RA Bills & Payments',  allowed: ['admin','super_admin'].includes(user?.role) },
                { label: 'Manage vendors & POs',         allowed: ['admin','super_admin','project_manager'].includes(user?.role) },
                { label: 'Payroll processing',           allowed: ['admin','super_admin','accountant'].includes(user?.role) },
                { label: 'HSE incident management',      allowed: ['admin','super_admin','hse_officer'].includes(user?.role) },
                { label: 'User management',              allowed: ['admin','super_admin'].includes(user?.role) },
                { label: 'Company settings',             allowed: ['admin','super_admin'].includes(user?.role) },
              ].map(({ label, allowed }) => (
                <div key={label} className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                  style={{ background: '#F8FAFC', border: '1px solid var(--border)' }}>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full`}
                    style={allowed
                      ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }
                      : { background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA' }
                    }>
                    {allowed
                      ? <><CheckCircle className="w-3 h-3" /> Allowed</>
                      : <><AlertCircle className="w-3 h-3" /> Restricted</>
                    }
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Quick actions */}
          <SectionCard title="Quick Actions" subtitle="Password and session management" icon={Lock}>
            <div className="space-y-2">
              {[
                { label: 'Change your password', desc: 'Update to a stronger password', action: () => setTab('password'), icon: Key },
                { label: 'Update personal info', desc: 'Edit your name, mobile and designation', action: () => setTab('profile'), icon: User },
                { label: 'Update company details', desc: 'GSTIN, PAN, address and more', action: () => setTab('company'), icon: Building2 },
              ].map(({ label, desc, action, icon: Icon }) => (
                <button key={label} onClick={action}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:border-blue-200"
                  style={{ background: '#F8FAFC', border: '1px solid var(--border)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#EFF6FF' }}>
                    <Icon className="w-4 h-4" style={{ color: '#2563EB' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
                </button>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── SIGNATURE TAB ── */}
      {tab === 'signature' && (
        <SectionCard title="Official Digital Signature" subtitle="Upload your formal signature to authorize documents" icon={FileText}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Your signature will be automatically attached to verified Material Requisitions, RA Bills, and official procurement documents. 
                  Please upload a clear, transparent image (PNG) or a high-contrast scan of your signature on white paper.
                </p>
                <div className="flex gap-3">
                  <label className="btn-primary cursor-pointer flex items-center gap-2 px-5">
                    <Camera className="w-4 h-4" />
                    Upload Signature
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            updateMut.mutate({ ...pf, signature_url: reader.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {user?.signature_url && (
                    <button 
                      onClick={() => updateMut.mutate({ ...pf, signature_url: null })}
                      className="px-5 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="relative group">
                <div className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50 overflow-hidden relative">
                   {user?.signature_url || pf.signature_url ? (
                     <img 
                       src={user?.signature_url || pf.signature_url} 
                       alt="Signature Preview" 
                       className="max-w-[80%] max-h-[80%] object-contain mix-blend-multiply transition-transform group-hover:scale-105"
                     />
                   ) : (
                     <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
                           <FileText className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Signature Found</p>
                     </div>
                   )}
                   <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/80 border border-slate-100 text-[10px] font-black uppercase text-slate-400">
                     <Shield className="w-3 h-3" /> Encrypted
                   </div>
                </div>
              </div>
            </div>

            {/* Signature Policy Warning */}
            <div className="rounded-xl p-4 flex gap-3 bg-emerald-50 border border-emerald-100">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
              <div className="text-xs space-y-1 text-emerald-800 leading-tight">
                <p className="font-bold uppercase tracking-tight">Security Protocol</p>
                <p>Digital signatures on ConstructERP are legally binding within the organization. By uploading your signature, you authorize the system to use it for document approvals based on your assigned role and workflow permissions.</p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
