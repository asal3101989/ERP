// src/pages/auth/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight,
  ClipboardList, FileText, Package, Users, HardHat, ShieldCheck,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const MODULES = [
  { icon: ClipboardList, label: 'Project & BOQ Management'     },
  { icon: FileText,      label: 'RA Bills & QS Certification'  },
  { icon: Package,       label: 'Procurement & Store Control'  },
  { icon: Users,         label: 'HR, Payroll & Attendance'     },
  { icon: HardHat,       label: 'Site Execution & Quality'     },
  { icon: ShieldCheck,   label: 'Compliance & Reporting'       },
];

export default function LoginPage() {
  const [showPass, setShowPass]   = useState(false);
  const [lastError, setLastError] = useState('');
  const { login, isLoading }      = useAuthStore();
  const navigate                  = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setLastError('');
    const result = await login(data.email, data.password);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      setLastError(result.error || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', -apple-system, sans-serif;
          background: #fff;
        }

        /* ═══ LEFT PANEL ═══ */
        .lp-left {
          display: none;
          flex: 0 0 52%;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          background: #0a2057;
        }
        @media (min-width: 1024px) { .lp-left { display: flex; } }

        /* Subtle geometric pattern overlay */
        .lp-pattern {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        /* Diagonal accent band */
        .lp-diagonal {
          position: absolute;
          top: -10%; right: -8%;
          width: 55%; height: 130%;
          background: linear-gradient(180deg, #0d2d6e 0%, #0a2057 100%);
          transform: skewX(-8deg);
          opacity: 0.5;
        }
        /* Bottom blue-to-dark gradient */
        .lp-left-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(160deg, #0e2b6e 0%, #071540 100%);
          opacity: 0.6;
        }
        /* Top gold accent line */
        .lp-gold-bar {
          position: absolute; top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, #c9a227, #e8c547, #c9a227);
        }
        /* Left-edge vertical accent */
        .lp-left-edge {
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, #c9a227, #e8c547 50%, #c9a227);
        }

        .lp-left-inner {
          position: relative; z-index: 10;
          display: flex; flex-direction: column;
          height: 100%; padding: 44px 52px;
        }

        /* Top logo */
        .lp-brand {
          display: flex; align-items: center; gap: 14px;
          padding-bottom: 36px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 44px;
        }
        .lp-logo-box {
          width: 52px; height: 52px; border-radius: 10px;
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          padding: 5px; flex-shrink: 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .lp-logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .lp-brand-text-top {
          font-size: 15px; font-weight: 800;
          color: #fff; letter-spacing: 0.04em; line-height: 1.2;
        }
        .lp-brand-text-sub {
          font-size: 10px; color: #c9a227;
          font-weight: 600; letter-spacing: 0.12em;
          margin-top: 3px; text-transform: uppercase;
        }

        /* Headline */
        .lp-headline {
          font-size: 30px; font-weight: 800;
          color: #fff; line-height: 1.25;
          letter-spacing: -0.02em;
          margin-bottom: 12px;
        }
        .lp-headline-accent { color: #e8c547; }
        .lp-tagline {
          font-size: 13px; color: #7fa3d1;
          line-height: 1.7; margin-bottom: 44px;
          max-width: 380px;
        }

        /* Module list */
        .lp-module-title {
          font-size: 10px; font-weight: 700;
          color: #4a7ab5; letter-spacing: 0.12em;
          text-transform: uppercase; margin-bottom: 16px;
        }
        .lp-modules { display: flex; flex-direction: column; gap: 10px; }
        .lp-module-row {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          transition: background 0.2s;
        }
        .lp-module-row:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(201,162,39,0.25);
        }
        .lp-module-icon {
          width: 30px; height: 30px; border-radius: 7px;
          background: rgba(201,162,39,0.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lp-module-name {
          font-size: 12.5px; font-weight: 500; color: #b8cfe8;
        }
        .lp-module-dot {
          margin-left: auto; width: 6px; height: 6px;
          border-radius: 50%; background: rgba(201,162,39,0.4); flex-shrink: 0;
        }

        /* Bottom compliance */
        .lp-left-footer {
          margin-top: auto; padding-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .lp-compliance-row {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .lp-badge {
          padding: 3px 10px;
          background: rgba(201,162,39,0.1);
          border: 1px solid rgba(201,162,39,0.2);
          border-radius: 20px;
          font-size: 10px; font-weight: 600;
          color: #c9a227; letter-spacing: 0.05em;
        }

        /* ═══ RIGHT PANEL ═══ */
        .lp-right {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 32px;
          background: #f8fafd;
          position: relative;
        }
        /* Top navy accent bar on right */
        .lp-right-top-bar {
          position: absolute; top: 0; left: 0; right: 0;
          height: 4px;
          background: #0a2057;
        }
        @media (min-width: 1024px) { .lp-right-top-bar { display: none; } }

        .lp-form-wrap {
          width: 100%; max-width: 420px;
        }

        /* Mobile brand */
        .lp-mobile-brand {
          display: flex; align-items: center; gap: 12px; margin-bottom: 36px;
        }
        @media (min-width: 1024px) { .lp-mobile-brand { display: none; } }

        /* Welcome block */
        .lp-welcome {
          margin-bottom: 32px;
        }
        .lp-welcome-label {
          display: inline-flex; align-items: center; gap: 6px;
          background: #eef3fb; border: 1px solid #c7d8f5;
          border-radius: 20px; padding: 4px 12px; margin-bottom: 14px;
        }
        .lp-welcome-dot { width: 6px; height: 6px; border-radius: 50%; background: #0a2057; }
        .lp-welcome-tag { font-size: 11px; font-weight: 700; color: #0a2057; letter-spacing: 0.07em; }
        .lp-welcome h2 {
          font-size: 26px; font-weight: 800; color: #0a2057;
          letter-spacing: -0.02em; line-height: 1.2; margin-bottom: 6px;
        }
        .lp-welcome p { font-size: 13px; color: #64748b; }

        /* Form card */
        .lp-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 32px 28px;
          box-shadow: 0 4px 24px rgba(10,32,87,0.07), 0 1px 4px rgba(10,32,87,0.05);
        }

        /* Label */
        .lp-label {
          display: block;
          font-size: 11px; font-weight: 700;
          color: #64748b; margin-bottom: 8px;
          text-transform: uppercase; letter-spacing: 0.08em;
        }

        /* Input */
        .lp-input-wrap { position: relative; }
        .lp-icon-box {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          width: 22px; height: 22px; border-radius: 6px;
          background: #eef3fb;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .lp-input {
          width: 100%;
          padding: 13px 16px 13px 48px;
          background: #f8fafd;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          color: #0f172a; font-size: 14px;
          outline: none; font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .lp-input::placeholder { color: #94a3b8; }
        .lp-input:focus {
          border-color: #0a2057;
          box-shadow: 0 0 0 3px rgba(10,32,87,0.08);
          background: #fff;
        }
        .lp-eye-btn {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #94a3b8; padding: 4px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          transition: color 0.2s;
        }
        .lp-eye-btn:hover { color: #0a2057; }

        /* Error text */
        .lp-field-error {
          display: flex; align-items: center; gap: 4px;
          margin-top: 6px; font-size: 12px; color: #ef4444;
        }

        /* Error banner */
        .lp-error-banner {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-radius: 10px; margin-bottom: 20px;
          background: #fef2f2; border: 1px solid #fecaca;
          color: #dc2626; font-size: 13px;
        }

        /* Submit button */
        .lp-btn {
          width: 100%; padding: 14px 0;
          background: #0a2057;
          border: none; border-radius: 10px;
          color: #fff; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(10,32,87,0.3);
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          letter-spacing: 0.02em;
        }
        .lp-btn:hover:not(:disabled) {
          background: #0d2a6e;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(10,32,87,0.35);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }
        .lp-btn:disabled { opacity: 0.65; cursor: wait; }

        /* Spinner */
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        .lp-spinner {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: lp-spin 0.75s linear infinite; flex-shrink: 0;
        }

        /* Divider */
        .lp-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 22px 0;
        }
        .lp-divider hr {
          flex: 1; border: none; border-top: 1px solid #e2e8f0;
        }
        .lp-divider span {
          font-size: 11px; color: #94a3b8; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap;
        }

        /* Footer */
        .lp-footer { text-align: center; margin-top: 24px; }
        .lp-footer-note { font-size: 12px; color: #94a3b8; margin-bottom: 12px; }
        .lp-footer-badges { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
        .lp-footer-badge {
          padding: 3px 10px;
          background: #f1f5f9; border: 1px solid #e2e8f0;
          border-radius: 20px; font-size: 10px;
          font-weight: 600; color: #64748b;
        }
        .lp-version {
          position: absolute; bottom: 16px; right: 20px;
          font-size: 10px; color: #cbd5e1; letter-spacing: 0.05em;
        }
      `}</style>

      <div className="lp-root">

        {/* ══════════ LEFT — Navy Brand Panel ══════════ */}
        <div className="lp-left">
          <div className="lp-pattern" />
          <div className="lp-left-gradient" />
          <div className="lp-diagonal" />
          <div className="lp-gold-bar" />
          <div className="lp-left-edge" />

          <div className="lp-left-inner">

            {/* Brand */}
            <div className="lp-brand">
              <div className="lp-logo-box">
                <img src="/bcim-logo.png" alt="BCIM" />
              </div>
              <div>
                <div className="lp-brand-text-top">BCIM ENGINEERING</div>
                <div className="lp-brand-text-sub">Private Limited</div>
              </div>
            </div>

            {/* Headline */}
            <div className="lp-headline">
              Enterprise ERP for<br />
              <span className="lp-headline-accent">Construction Industry</span>
            </div>
            <p className="lp-tagline">
              A fully integrated management platform purpose-built for construction companies —
              covering projects, billing, procurement, HR and statutory compliance.
            </p>

            {/* Modules */}
            <div className="lp-module-title">Integrated Modules</div>
            <div className="lp-modules">
              {MODULES.map(({ icon: Icon, label }) => (
                <div className="lp-module-row" key={label}>
                  <div className="lp-module-icon">
                    <Icon style={{ width: 14, height: 14, color: '#c9a227' }} />
                  </div>
                  <span className="lp-module-name">{label}</span>
                  <div className="lp-module-dot" />
                </div>
              ))}
            </div>


          </div>
        </div>

        {/* ══════════ RIGHT — Login Form ══════════ */}
        <div className="lp-right">
          <div className="lp-right-top-bar" />

          <div className="lp-form-wrap">

            {/* Mobile brand */}
            <div className="lp-mobile-brand">
              <div style={{
                width: 46, height: 46, borderRadius: 10,
                background: '#0a2057', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 6,
              }}>
                <img src="/bcim-logo.png" alt="BCIM" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0a2057' }}>BCIM ENGINEERING</div>
                <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.08em', marginTop: 2 }}>PRIVATE LIMITED</div>
              </div>
            </div>

            {/* Welcome */}
            <div className="lp-welcome">
              <div className="lp-welcome-label">
                <span className="lp-welcome-dot" />
                <span className="lp-welcome-tag">ERP PORTAL</span>
              </div>
              <h2>Welcome Back</h2>
              <p>Sign in with your credentials to access the system</p>
            </div>

            {/* Error */}
            {lastError && (
              <div className="lp-error-banner">
                <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
                <span>{lastError}</span>
              </div>
            )}

            {/* Card */}
            <div className="lp-card">
              <form onSubmit={handleSubmit(onSubmit)} noValidate>

                {/* Email */}
                <div style={{ marginBottom: 18 }}>
                  <label className="lp-label">Email Address</label>
                  <div className="lp-input-wrap">
                    <div className="lp-icon-box">
                      <Mail style={{ width: 13, height: 13, color: '#0a2057' }} />
                    </div>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="yourname@bcimengineering.in"
                      autoComplete="email"
                      autoFocus
                      className="lp-input"
                    />
                  </div>
                  {errors.email && (
                    <p className="lp-field-error">
                      <AlertCircle style={{ width: 12, height: 12 }} /> {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div style={{ marginBottom: 8 }}>
                  <label className="lp-label">Password</label>
                  <div className="lp-input-wrap">
                    <div className="lp-icon-box">
                      <Lock style={{ width: 13, height: 13, color: '#0a2057' }} />
                    </div>
                    <input
                      {...register('password')}
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="lp-input"
                      style={{ paddingRight: 44 }}
                    />
                    <button type="button" className="lp-eye-btn" onClick={() => setShowPass(v => !v)}>
                      {showPass
                        ? <EyeOff style={{ width: 16, height: 16 }} />
                        : <Eye    style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="lp-field-error">
                      <AlertCircle style={{ width: 12, height: 12 }} /> {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="lp-divider">
                  <hr /><span>secure login</span><hr />
                </div>

                {/* Submit */}
                <button type="submit" disabled={isLoading} className="lp-btn">
                  {isLoading ? (
                    <><span className="lp-spinner" /> Authenticating…</>
                  ) : (
                    <>Sign In to Portal <ArrowRight style={{ width: 16, height: 16 }} /></>
                  )}
                </button>

              </form>
            </div>

            {/* Footer */}
            <div className="lp-footer">
              <p className="lp-footer-note">Contact your system administrator for access</p>
            </div>

          </div>

          <div className="lp-version">BCIM Construct ERP · v2.0</div>
        </div>

      </div>
    </>
  );
}
