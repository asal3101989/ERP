// src/pages/auth/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Building2, Lock, Mail, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const DEMO_ACCOUNTS = [
  { role: 'Admin',           email: 'admin@rajinfra.com',    password: 'admin123', color: 'text-amber-400' },
  { role: 'Project Manager', email: 'pm@rajinfra.com',       password: 'demo123',  color: 'text-blue-400' },
  { role: 'Site Engineer',   email: 'site@rajinfra.com',     password: 'demo123',  color: 'text-green-400' },
  { role: 'QS Engineer',     email: 'qs@rajinfra.com',       password: 'demo123',  color: 'text-purple-400' },
  { role: 'Accountant',      email: 'accounts@rajinfra.com', password: 'demo123',  color: 'text-teal-400' },
  { role: 'HSE Officer',     email: 'hse@rajinfra.com',      password: 'demo123',  color: 'text-red-400' },
  { role: 'IT Admin',        email: 'it@rajinfra.com',       password: 'demo123',  color: 'text-cyan-400' },
];

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [lastError, setLastError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLastError('');
    const result = await login(data.email, data.password);
    if (result.success) {
      if (result.demo) {
        toast.success('🎯 Demo mode — exploring offline!', { duration: 3000 });
      } else {
        toast.success('Welcome back!');
      }
      navigate('/dashboard');
    } else {
      setLastError(result.error);
      toast.error(result.error);
    }
  };

  const fillAndLogin = async (acc) => {
    setValue('email', acc.email);
    setValue('password', acc.password);
    setLastError('');
    const result = await login(acc.email, acc.password);
    if (result.success) {
      toast.success(`Logged in as ${acc.role} 🎯`, { duration: 2000 });
      navigate('/dashboard');
    }
  };

  const isNetworkError = lastError.includes('Backend not running') || lastError.includes('offline');

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      {/* Bg glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-4 shadow-lg shadow-amber-900/30">
            <Building2 className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">ConstructERP India</h1>
          <p className="text-slate-500 mt-1 text-sm">Construction Management Platform v3.0</p>
        </div>

        {/* Offline demo banner */}
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3">
          <WifiOff className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-bold text-green-400">✅ Demo Mode Available — No Backend Needed</div>
            <div className="text-xs text-green-300/70 mt-0.5">
              Click any demo account below to instantly explore the full ERP offline.
            </div>
          </div>
        </div>

        {/* Login card */}
        <div className="card-lg shadow-2xl mb-4">
          <h2 className="text-sm font-semibold text-slate-400 mb-5 uppercase tracking-wider">Sign in to your account</h2>

          {/* Network error hint */}
          {isNetworkError && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
              <div className="font-semibold mb-1">⚡ Quick fix — use a demo account:</div>
              <div>Click any button below to log in instantly without a backend server.</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="admin@rajinfra.com"
                  className="input-field pl-10"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="flex items-center gap-1 text-red-400 text-xs mt-1">
                  <AlertCircle className="w-3 h-3" />{errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="admin123"
                  className="input-field pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-red-400 text-xs mt-1">
                  <AlertCircle className="w-3 h-3" />{errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-2.5 text-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo accounts — one-click login */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <WifiOff className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs font-bold text-green-400 uppercase tracking-wider">
              Demo Accounts — Click to Login Instantly
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.role}
                onClick={() => fillAndLogin(acc)}
                disabled={isLoading}
                className="text-left px-3 py-2.5 bg-slate-800 rounded-lg border border-slate-700 hover:border-amber-500/60 hover:bg-slate-750 transition-all group disabled:opacity-50"
              >
                <div className={`text-xs font-bold group-hover:text-amber-400 transition-colors ${acc.color}`}>
                  {acc.role}
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5">{acc.email}</div>
                <div className="text-xs text-slate-700 mt-0.5">{acc.password}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-600 text-center">
            All demo accounts work offline — no internet or server required
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-5">
          🇮🇳 Built for Indian Construction Industry • GST + TDS + BOCW Compliant
        </p>
      </div>
    </div>
  );
}
