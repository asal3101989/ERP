// src/pages/auth/RegisterPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, User, Mail, Lock, Phone, Eye, EyeOff,
  AlertCircle, CheckCircle, ArrowRight, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Chandigarh','Puducherry',
  'Andaman & Nicobar Islands','Lakshadweep',
];

const STEPS = ['Company Info', 'Admin Account', 'Review & Submit'];

function FieldErr({ msg }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#DC2626' }}>
      <AlertCircle className="w-3 h-3" />{msg}
    </p>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    company_name: 'BCIM Engineering Private Limited',
    company_gstin: '', company_pan: '', company_state: 'Maharashtra',
    company_address: '', company_phone: '',
    name: '', email: '', phone: '', password: '',
    confirm_password: '', designation: '',
  });

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.company_name.trim()) e.company_name = 'Company name is required';
      if (form.company_gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.company_gstin))
        e.company_gstin = 'Invalid GSTIN format (e.g. 27AABCS1234C1Z5)';
      if (!form.company_state) e.company_state = 'State is required';
    }
    if (step === 1) {
      if (!form.name.trim()) e.name = 'Full name is required';
      if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email is required';
      if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile';
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
      else if (!passwordRegex.test(form.password)) e.password = 'Must include: Upper, Lower, Number & Special Char';
      if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const submit = async () => {
    setLoading(true);
    try {
      const payload = {
        company_name:    form.company_name,
        company_gstin:   form.company_gstin,
        company_pan:     form.company_pan,
        company_state:   form.company_state,
        company_address: form.company_address,
        company_phone:   form.company_phone,
        name:            form.name,
        email:           form.email,
        phone:           form.phone,
        password:        form.password,
        designation:     form.designation,
        role:            'admin',
      };
      await api.post('/auth/register', payload);
      toast.success('Company registered! Please sign in.');
      navigate('/login');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const ReviewRow = ({ label, value }) => (
    <div className="flex items-start justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-xs font-semibold text-right max-w-[60%]" style={{ color: 'var(--text)' }}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: '#F1F5F9' }}>

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] flex-shrink-0 px-10 py-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1E3A8A 0%, #1D4ED8 50%, #2563EB 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #60A5FA, transparent)', filter: 'blur(40px)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg p-1">
              <img src="/bcim-logo.png" alt="BCIM" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-base font-black text-white tracking-wide">BCIM ENGINEERING</div>
              <div className="text-xs text-blue-200 font-medium">PRIVATE LIMITED</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 leading-snug">
            Register your<br />company workspace.
          </h2>
          <p className="text-sm text-blue-100 leading-relaxed mb-10 opacity-90">
            One-time setup. Once registered, you can invite your entire team — PMs, engineers, accountants, HSE officers.
          </p>

          <div className="space-y-4">
            {[
              { n: '1', t: 'Enter company details', d: 'Name, GSTIN, PAN, state' },
              { n: '2', t: 'Create admin account',  d: 'Your personal login credentials' },
              { n: '3', t: 'Start using the ERP',   d: 'Add team, projects & data' },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-900"
                  style={{ background: 'rgba(255,255,255,0.9)' }}>{s.n}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{s.t}</div>
                  <div className="text-xs text-blue-100 opacity-80">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
          <span className="text-xs text-blue-100 opacity-80">GST · TDS · BOCW · RERA compliant · Made in India 🇮🇳</span>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow p-1"
              style={{ border: '1px solid #E2E8F0' }}>
              <img src="/bcim-logo.png" alt="BCIM" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-black text-sm tracking-wide" style={{ color: '#1D3461' }}>BCIM ENGINEERING</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>PRIVATE LIMITED</div>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Register Company</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={i < step
                      ? { background: '#16A34A', color: '#fff' }
                      : i === step
                      ? { background: '#2563EB', color: '#fff' }
                      : { background: '#E2E8F0', color: '#94A3B8' }
                    }>
                    {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block"
                    style={{ color: i === step ? '#2563EB' : i < step ? '#16A34A' : 'var(--text-dim)' }}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px" style={{ background: i < step ? '#BBF7D0' : '#E2E8F0' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Form card */}
          <div className="rounded-xl p-6 mb-4 space-y-4"
            style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)' }}>

            {/* Step 0 — Company */}
            {step === 0 && (
              <>
                <div>
                  <label className="label">Company Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-dim)' }} />
                    <input className="input pl-9" placeholder="BCIM Engineering Private Limited"
                      value={form.company_name} onChange={e => set('company_name', e.target.value)} />
                  </div>
                  <FieldErr msg={errors.company_name} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">GSTIN</label>
                    <input className="input font-mono text-xs tracking-wider uppercase"
                      placeholder="27AABCS1234C1Z5" maxLength={15}
                      value={form.company_gstin}
                      onChange={e => set('company_gstin', e.target.value.toUpperCase())} />
                    <FieldErr msg={errors.company_gstin} />
                  </div>
                  <div>
                    <label className="label">PAN</label>
                    <input className="input font-mono uppercase"
                      placeholder="AABCS1234C" maxLength={10}
                      value={form.company_pan}
                      onChange={e => set('company_pan', e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">State *</label>
                    <select className="input" value={form.company_state}
                      onChange={e => set('company_state', e.target.value)}>
                      <option value="">Select state</option>
                      {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <FieldErr msg={errors.company_state} />
                  </div>
                  <div>
                    <label className="label">Company Phone</label>
                    <input className="input" placeholder="022-12345678"
                      value={form.company_phone}
                      onChange={e => set('company_phone', e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="label">Registered Address</label>
                  <textarea className="input resize-none" rows={2}
                    placeholder="Plot No., Street, Area, City — PIN Code"
                    value={form.company_address}
                    onChange={e => set('company_address', e.target.value)} />
                </div>
              </>
            )}

            {/* Step 1 — Admin account */}
            {step === 1 && (
              <>
                <div className="p-3 rounded-lg text-xs" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF' }}>
                  This creates your <strong>Admin account</strong> — you can add team members after login from the User Management section.
                </div>

                <div>
                  <label className="label">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-dim)' }} />
                    <input className="input pl-9" placeholder="Your full name"
                      value={form.name} onChange={e => set('name', e.target.value)} />
                  </div>
                  <FieldErr msg={errors.name} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-dim)' }} />
                      <input type="email" className="input pl-9" placeholder="you@bcimeng.in"
                        value={form.email} onChange={e => set('email', e.target.value)} />
                    </div>
                    <FieldErr msg={errors.email} />
                  </div>
                  <div>
                    <label className="label">Mobile</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-dim)' }} />
                      <input className="input pl-9" placeholder="9876543210" maxLength={10}
                        value={form.phone} onChange={e => set('phone', e.target.value)} />
                    </div>
                    <FieldErr msg={errors.phone} />
                  </div>
                </div>

                <div>
                  <label className="label">Designation</label>
                  <input className="input" placeholder="e.g. Managing Director / Project Director"
                    value={form.designation} onChange={e => set('designation', e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-dim)' }} />
                      <input type={showPw ? 'text' : 'password'} className="input pl-9 pr-9"
                        placeholder="Min 8 characters"
                        value={form.password} onChange={e => set('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}>
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <FieldErr msg={errors.password} />
                  </div>
                  <div>
                    <label className="label">Confirm Password *</label>
                    <input type="password" className="input" placeholder="Repeat password"
                      value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} />
                    <FieldErr msg={errors.confirm_password} />
                  </div>
                </div>
              </>
            )}

            {/* Step 2 — Review */}
            {step === 2 && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Company Details</p>
                  <div className="rounded-lg px-3" style={{ background: '#F8FAFC', border: '1px solid var(--border)' }}>
                    <ReviewRow label="Company Name" value={form.company_name} />
                    <ReviewRow label="GSTIN" value={form.company_gstin} />
                    <ReviewRow label="PAN" value={form.company_pan} />
                    <ReviewRow label="State" value={form.company_state} />
                    <ReviewRow label="Address" value={form.company_address} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Admin Account</p>
                  <div className="rounded-lg px-3" style={{ background: '#F8FAFC', border: '1px solid var(--border)' }}>
                    <ReviewRow label="Name" value={form.name} />
                    <ReviewRow label="Email" value={form.email} />
                    <ReviewRow label="Mobile" value={form.phone} />
                    <ReviewRow label="Designation" value={form.designation} />
                    <ReviewRow label="Role" value="Admin (Super User)" />
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg text-xs"
                  style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Everything looks good. Clicking <strong>Register</strong> will create your company workspace. You can add team members immediately after login.</span>
                </div>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {step > 0
              ? <button onClick={back} className="btn-secondary px-5">← Back</button>
              : <Link to="/login" className="btn-secondary px-5">← Sign In</Link>
            }
            {step < 2
              ? <button onClick={next} className="btn-primary px-6 flex items-center gap-2">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              : <button onClick={submit} disabled={loading} className="btn-primary px-6 flex items-center gap-2">
                  {loading ? 'Registering…' : <><CheckCircle className="w-4 h-4" /> Register Company</>}
                </button>
            }
          </div>

          <p className="text-center text-xs mt-5" style={{ color: 'var(--text-dim)' }}>
            Already registered?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
