// src/pages/users/UsersPage.jsx — Team / User Management
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Users, Plus, Edit2, Trash2, RotateCcw, Key,
  Mail, Phone, Briefcase, Shield, CheckCircle,
  AlertCircle, Search, X, Eye, EyeOff, UserCheck, UserX
} from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';

const ROLES = [
  { value: 'admin',           label: 'Admin',            color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'project_manager', label: 'Project Manager',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { value: 'site_engineer',   label: 'Site Engineer',    color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
  { value: 'qs_engineer',     label: 'QS Engineer',      color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  { value: 'accountant',      label: 'Accountant',       color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'hse_officer',     label: 'HSE Officer',      color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },
  { value: 'hr',              label: 'HR',               color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { value: 'it_admin',        label: 'IT Admin',         color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  { value: 'employee',        label: 'Employee',         color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4' },
  { value: 'viewer',          label: 'Viewer (Read-only)',color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
];

const DEPARTMENTS = [
  'Management', 'Civil & Structural', 'QS & Estimation', 'Electrical',
  'Plumbing & MEP', 'HSE', 'Procurement', 'HR & Admin',
  'Finance & Accounts', 'IT', 'Survey', 'Planning',
];

const AVAILABLE_MODULES = [
  'Overview', 'Planning', 'HR & Admin', 'Procurement', 'Stores',
  'Subcontractors', 'QS & Billing', 'Finance', 'DQS Tracker',
  'Quality (QA/QC)', 'HSE & Safety', 'CRM & Reports', 'Assets & IT',
  'Documents', 'Administration'
];

const roleInfo = (r) => {
  const existing = ROLES.find(x => x.value === r);
  if (existing) return existing;
  return { value: r, label: r?.replace(/_/g, ' ') || 'Unknown', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
};

const BLANK_FORM = {
  name: '', email: '', phone: '', password: '',
  role: 'site_engineer', designation: '', department: 'Civil & Structural',
  accessible_modules: []
};

function RoleBadge({ role }) {
  const r = roleInfo(role);
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap"
      style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}` }}>
      {r.label}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#fff', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)', background: '#FAFBFC' }}>
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = ['admin', 'super_admin'].includes(me?.role);

  const [search, setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [modal, setModal]       = useState(null); // 'add' | 'edit' | 'reset' | 'deactivate'
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(BLANK_FORM);
  const [showPw, setShowPw]     = useState(false);
  const [resetPw, setResetPw]   = useState('');

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Fetch users
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data.data),
    
  });

  const users = (data || []).filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.designation?.toLowerCase().includes(q);
    const matchRole   = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const active   = (data || []).filter(u => u.is_active).length;
  const inactive = (data || []).filter(u => !u.is_active).length;

  // Mutations
  const createMut = useMutation({
    mutationFn: (d) => api.post('/users', d),
    onSuccess: () => { toast.success('User created! They can now log in.'); qc.invalidateQueries(['users']); setModal(null); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to create user'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => api.put(`/users/${id}`, d),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries(['users']); setModal(null); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to update user'),
  });

  const resetMut = useMutation({
    mutationFn: ({ id, new_password }) => api.patch(`/users/${id}/reset-password`, { new_password }),
    onSuccess: () => { toast.success('Password reset successfully'); setModal(null); setResetPw(''); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to reset password'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries(['users']); setModal(null); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to deactivate user'),
  });

  const reactivateMut = useMutation({
    mutationFn: (id) => api.put(`/users/${id}`, { is_active: true }),
    onSuccess: () => { toast.success('User reactivated'); qc.invalidateQueries(['users']); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to reactivate user'),
  });

  const openAdd = () => { setForm(BLANK_FORM); setModal('add'); };
  const openEdit = (u) => {
    setSelected(u);
    setForm({ name: u.name, email: u.email, phone: u.phone || '', password: '',
               role: u.role, designation: u.designation || '', department: u.department || '',
               accessible_modules: u.accessible_modules || [] });
    setModal('edit');
  };
  const openReset = (u) => { setSelected(u); setResetPw(''); setModal('reset'); };
  const openDeactivate = (u) => { setSelected(u); setModal('deactivate'); };

  const handleCreate = () => {
    if (!form.name || !form.email || !form.password || !form.role)
      return toast.error('Name, email, password and role are required');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    createMut.mutate(form);
  };

  const handleUpdate = () => {
    updateMut.mutate({ id: selected.id, ...form });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2 uppercase italic tracking-tight text-slate-900">
            <Users className="w-5 h-5 text-blue-600" />
            Team Management
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            Add and manage your team members • PMs, engineers, accountants, HSE officers
          </p>
        </div>
        {isAdmin && (
          <DataToolbar 
            data={users} 
            fileName="Team_Members_Export" 
            onAdd={openAdd} 
            addLabel="Add Team Member" 
          />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Members',  value: (data||[]).length, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Users      },
          { label: 'Active',         value: active,            color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: UserCheck  },
          { label: 'Inactive',       value: inactive,          color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: UserX      },
          { label: 'Roles Assigned', value: [...new Set((data||[]).map(u=>u.role))].length, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: Shield },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: bg, border: `1px solid ${border}` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 italic tracking-tighter leading-none">{value}</div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="input pl-9 py-2.5 text-xs bg-white border-slate-200" placeholder="Search by name or email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input py-2.5 text-[10px] font-black uppercase tracking-widest bg-white border-slate-200" value={filterRole}
          onChange={e => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 bg-slate-50/50">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No team members discovered</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">
              {isAdmin ? 'Click "Add Team Member" to initialize personnel' : 'Modify search criteria'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Member', 'Role', 'Department', 'Contact', 'Status', 'Last Login', isAdmin ? 'Actions' : ''].filter(Boolean).map(h => (
                    <th key={h} className="px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">

                    {/* Member */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-lg shadow-blue-500/10"
                          style={{ background: `linear-gradient(135deg, ${roleInfo(u.role).color}, #7C3AED)` }}>
                          {(u.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-900 uppercase italic tracking-tight truncate">
                            {u.name}
                            {u.id === me?.id && (
                              <span className="ml-2 text-[9px] font-black px-2 py-0.5 rounded-lg bg-blue-100 text-blue-600">You</span>
                            )}
                          </div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5">
                            {u.employee_code} • {u.designation || 'Specialist'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4"><RoleBadge role={u.role} /></td>

                    {/* Department */}
                    <td className="px-5 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {u.department || '—'}
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase">
                          <Mail className="w-3 h-3 text-slate-400" />{u.email}
                        </span>
                        {u.phone && (
                          <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <Phone className="w-3 h-3" />{u.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={clsx(
                        'flex items-center gap-1.5 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg w-fit',
                        u.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                      )}>
                        {u.is_active
                          ? <><CheckCircle className="w-3 h-3" />Active</>
                          : <><AlertCircle className="w-3 h-3" />Inactive</>
                        }
                      </span>
                    </td>

                    {/* Last login */}
                    <td className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                      {u.last_login
                        ? dayjs(u.last_login).format('DD MMM YYYY')
                        : 'Never'}
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <TableActions 
                          onEdit={() => openEdit(u)}
                          onDelete={u.id !== me?.id && u.is_active ? () => deactivateMut.mutate(u.id) : null}
                          extraActions={[
                            { 
                              icon: <Key size={14} />, 
                              onClick: () => openReset(u), 
                              title: "Reset Password", 
                              className: "hover:text-amber-500 transition-all" 
                            },
                            ...(!u.is_active ? [{ 
                              icon: <RotateCcw size={14} />, 
                              onClick: () => reactivateMut.mutate(u.id), 
                              title: "Reactivate", 
                              className: "hover:text-emerald-500 transition-all" 
                            }] : [])
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ADD USER MODAL ── */}
      {modal === 'add' && (
        <Modal title="Add Team Member" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Full Name *</label>
                <input className="input text-xs font-bold uppercase p-4 rounded-2xl bg-slate-50 border-slate-200" placeholder="e.g. Ramesh Kumar" value={form.name}
                  onChange={e => setF('name', e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Email Address *</label>
                <input type="email" className="input text-xs font-bold p-4 rounded-2xl bg-slate-50 border-slate-200" placeholder="ramesh@bcimeng.in" value={form.email}
                  onChange={e => setF('email', e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Mobile</label>
                <input className="input text-xs font-bold p-4 rounded-2xl bg-slate-50 border-slate-200" placeholder="9876543210" value={form.phone}
                  onChange={e => setF('phone', e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Role *</label>
                {!ROLES.find(r => r.value === form.role) && form.role !== '' && form.role !== 'site_engineer' ? (
                  <div className="flex gap-2">
                    <input className="input flex-1 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200"
                      placeholder="Enter custom role" value={form.role} onChange={e => setF('role', e.target.value)} />
                    <button type="button" onClick={() => setF('role', 'site_engineer')} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <select className="input text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.role}
                    onChange={e => {
                      if (e.target.value === '__custom__') setF('role', 'custom_role');
                      else setF('role', e.target.value);
                    }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    <option value="__custom__">+ Add Custom Role</option>
                  </select>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Department</label>
                {!DEPARTMENTS.includes(form.department) && form.department !== '' && form.department !== 'Civil & Structural' ? (
                  <div className="flex gap-2">
                    <input className="input flex-1 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200"
                      placeholder="Enter custom department" value={form.department} onChange={e => setF('department', e.target.value)} />
                    <button type="button" onClick={() => setF('department', 'Civil & Structural')} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <select className="input text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.department}
                    onChange={e => {
                      if (e.target.value === '__custom__') setF('department', 'Custom Department');
                      else setF('department', e.target.value);
                    }}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    <option value="__custom__">+ Add Custom Department</option>
                  </select>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Designation</label>
                <input className="input text-xs font-bold uppercase p-4 rounded-2xl bg-slate-50 border-slate-200" placeholder="e.g. Senior Site Engineer" value={form.designation}
                  onChange={e => setF('designation', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Password * <span className="text-[9px] font-black text-slate-400 italic">(min 8 characters)</span></label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="input text-xs font-bold p-4 rounded-2xl bg-slate-50 border-slate-200 pr-12"
                    placeholder="Set a login password" value={form.password}
                    onChange={e => setF('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="col-span-2 mt-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block border-b border-slate-100 pb-2">Module Access Permissions</label>
                {['admin', 'super_admin'].includes(form.role) ? (
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    Administrator role has unrestricted access to all modules automatically.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {AVAILABLE_MODULES.map(m => (
                      <label key={m} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          checked={form.accessible_modules?.includes(m) || false}
                          onChange={e => {
                            if (e.target.checked) setF('accessible_modules', [...(form.accessible_modules||[]), m]);
                            else setF('accessible_modules', (form.accessible_modules||[]).filter(x => x !== m));
                          }} />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{m}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest leading-relaxed bg-blue-50 border border-blue-100 text-blue-600">
              Credentials must be unique. Personnel can reset their own password post-authentication via terminal settings.
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button className="px-6 py-3 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 rounded-2xl hover:bg-slate-200 hover:text-slate-900 transition-all" onClick={() => setModal(null)}>Cancel</button>
              <button className="px-8 py-3 bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white rounded-2xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center gap-2 italic transition-all" onClick={handleCreate}
                disabled={createMut.isPending}>
                <Plus className="w-4 h-4" />
                {createMut.isPending ? 'Authenticating...' : 'Authorize Member'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── EDIT USER MODAL ── */}
      {modal === 'edit' && selected && (
        <Modal title={`Account Configuration — ${selected.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Full Name</label>
                <input className="input text-xs font-bold uppercase p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Email</label>
                <input type="email" className="input text-xs font-bold p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.email} onChange={e => setF('email', e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Mobile</label>
                <input className="input text-xs font-bold p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.phone} onChange={e => setF('phone', e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Role *</label>
                {!ROLES.find(r => r.value === form.role) && form.role !== '' && form.role !== 'site_engineer' ? (
                  <div className="flex gap-2">
                    <input className="input flex-1 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200"
                      placeholder="Enter custom role" value={form.role} onChange={e => setF('role', e.target.value)} />
                    <button type="button" onClick={() => setF('role', 'site_engineer')} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <select className="input text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.role}
                    onChange={e => {
                      if (e.target.value === '__custom__') setF('role', 'custom_role');
                      else setF('role', e.target.value);
                    }}
                    disabled={selected?.id === me?.id && modal === 'edit'}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    <option value="__custom__">+ Add Custom Role</option>
                  </select>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Department</label>
                {!DEPARTMENTS.includes(form.department) && form.department !== '' && form.department !== 'Civil & Structural' ? (
                  <div className="flex gap-2">
                    <input className="input flex-1 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200"
                      placeholder="Enter custom department" value={form.department} onChange={e => setF('department', e.target.value)} />
                    <button type="button" onClick={() => setF('department', 'Civil & Structural')} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <select className="input text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.department}
                    onChange={e => {
                      if (e.target.value === '__custom__') setF('department', 'Custom Department');
                      else setF('department', e.target.value);
                    }}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    <option value="__custom__">+ Add Custom Department</option>
                  </select>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Designation</label>
                <input className="input text-xs font-bold uppercase p-4 rounded-2xl bg-slate-50 border-slate-200" value={form.designation} onChange={e => setF('designation', e.target.value)} />
              </div>
              <div className="col-span-2 mt-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block border-b border-slate-100 pb-2">Module Access Permissions</label>
                {['admin', 'super_admin'].includes(form.role) ? (
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    Administrator role has unrestricted access to all modules automatically.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {AVAILABLE_MODULES.map(m => (
                      <label key={m} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          checked={form.accessible_modules?.includes(m) || false}
                          onChange={e => {
                            if (e.target.checked) setF('accessible_modules', [...(form.accessible_modules||[]), m]);
                            else setF('accessible_modules', (form.accessible_modules||[]).filter(x => x !== m));
                          }} />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{m}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button className="px-6 py-3 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 rounded-2xl hover:bg-slate-200 hover:text-slate-900 transition-all" onClick={() => setModal(null)}>Cancel</button>
              <button className="px-8 py-3 bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white rounded-2xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 italic transition-all" onClick={handleUpdate}
                disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Syncing...' : 'Update Protocol'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {modal === 'reset' && selected && (
        <Modal title={`Security Reset — ${selected.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest leading-relaxed bg-amber-50 border border-amber-100 text-amber-700">
              This action will immediately invalidate the existing credentials for <strong>{selected.name}</strong> and terminate all active sessions.
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">New Password (min 8 characters)</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="input text-xs font-bold p-4 rounded-2xl bg-slate-50 border-slate-200 pr-12 focus:border-amber-500"
                  placeholder="Enter new credential" value={resetPw}
                  onChange={e => setResetPw(e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button className="px-6 py-3 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 rounded-2xl hover:bg-slate-200 hover:text-slate-900 transition-all" onClick={() => setModal(null)}>Cancel</button>
              <button className="px-8 py-3 bg-amber-600 text-[10px] font-black uppercase tracking-widest text-white rounded-2xl hover:bg-amber-500 shadow-lg shadow-amber-500/20 italic transition-all flex items-center gap-2"
                onClick={() => resetMut.mutate({ id: selected.id, new_password: resetPw })}
                disabled={resetMut.isPending || resetPw.length < 8}>
                <Key className="w-4 h-4" />
                {resetMut.isPending ? 'Updating...' : 'Commit Reset'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
