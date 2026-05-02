// src/pages/it/LicensePage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Key, AlertTriangle, RefreshCw, Plus, X, ServerCrash, HardDrive } from 'lucide-react';
import { licenseAPI, vendorAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import dayjs from 'dayjs';

function getExpiryInfo(expiryDate) {
  if (!expiryDate) return { label: 'Perpetual', class: 'bg-slate-100 text-slate-700 font-bold border-slate-200', days: null };
  const days = dayjs(expiryDate).diff(dayjs(), 'day');
  if (days < 0)   return { label: `Expired ${Math.abs(days)}d ago`, class: 'bg-red-50 text-red-600 border border-red-200 font-black tracking-widest',    days };
  if (days <= 30) return { label: `Critical: ${days}d`,            class: 'bg-red-50 text-red-600 border border-red-200 font-black tracking-widest',    days };
  if (days <= 90) return { label: `Warning: ${days}d`,            class: 'bg-amber-50 text-amber-600 border border-amber-200 font-black tracking-widest', days };
  return { label: dayjs(expiryDate).format('D MMM YYYY'), class: 'bg-emerald-50 text-emerald-600 border border-emerald-100 font-black tracking-widest', days };
}

export default function LicensePage() {
  const [tab, setTab] = useState('licenses');
  const [showLicForm, setShowLicForm] = useState(false);
  const [showAmcForm, setShowAmcForm] = useState(false);
  const qc = useQueryClient();
  const licForm = useForm({ defaultValues: { quantity: 1, auto_renew: false } });
  const amcForm = useForm();

  const { data: licData } = useQuery({
    queryKey: ['software-licenses'],
    queryFn: () => licenseAPI.list().then(r => r.data.data).catch(() => []),
  });

  const { data: amcData } = useQuery({
    queryKey: ['amc-contracts'],
    queryFn: () => licenseAPI.listAMC().then(r => r.data.data).catch(() => []),
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorAPI.list().then(r => r.data.data).catch(() => []),
  });

  const createLicMut = useMutation({
    mutationFn: (d) => licenseAPI.create(d),
    onSuccess: () => {
      toast.success('License added!');
      licForm.reset(); setShowLicForm(false);
      qc.invalidateQueries({ queryKey: ['software-licenses'] });
    },
    onError: () => toast.error('Failed to add license'),
  });

  const createAmcMut = useMutation({
    mutationFn: (d) => licenseAPI.createAMC(d),
    onSuccess: () => {
      toast.success('AMC contract added!');
      amcForm.reset(); setShowAmcForm(false);
      qc.invalidateQueries({ queryKey: ['amc-contracts'] });
    },
    onError: () => toast.error('Failed to add AMC contract'),
  });

  const licenses = licData || [];
  const amcList = amcData || [];

  const expiringSoon = licenses.filter(l => {
    if (!l.expiry_date) return false;
    const d = dayjs(l.expiry_date).diff(dayjs(), 'day');
    return d >= 0 && d <= 90;
  });
  const expired = licenses.filter(l =>
    l.expiry_date && dayjs(l.expiry_date).diff(dayjs(), 'day') < 0
  );
  const amcExpiringSoon = amcList.filter(a => {
    const d = dayjs(a.end_date).diff(dayjs(), 'day');
    return d >= 0 && d <= 90;
  });
  const totalLicenseCost = licenses.reduce((s, l) => s + parseFloat(l.purchase_cost || 0), 0);
  const totalAmcValue = amcList.reduce((s, a) => s + parseFloat(a.amc_value || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shadow-sm">
               <Key className="w-6 h-6 text-purple-600" />
            </div>
            <div>
               <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic leading-none mb-1">Software & Agreements</h1>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">IP Inventory • Expiry Radar • Maintenance SLA</p>
            </div>
         </div>
         <button className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-widest rounded-full transition-all shadow-xl shadow-purple-600/20 flex items-center gap-2 italic" onClick={() => tab === 'amc' ? setShowAmcForm(true) : setShowLicForm(true)}>
            <Plus size={16} /> {tab === 'amc' ? 'Init AMC Contract' : 'Register IP License'}
         </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-slate-300 transition-all">
            <div className="text-4xl font-black text-slate-900 font-mono italic tracking-tighter leading-none">{licenses.length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">Software Subscriptions</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-red-300 transition-all">
            <div className="text-4xl font-black text-red-500 font-mono italic tracking-tighter leading-none">{expired.length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">System Lapses</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-amber-300 transition-all">
            <div className="text-4xl font-black text-amber-500 font-mono italic tracking-tighter leading-none">{expiringSoon.length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">Proximity Alerts (90d)</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm hover:border-blue-300 transition-all">
            <div className="text-4xl font-black text-blue-500 font-mono italic tracking-tighter leading-none">{amcList.length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 italic">Active AMC SLAs</div>
         </div>
      </div>

      {/* Alerts */}
      {(expired.length > 0 || expiringSoon.length > 0) && (
         <div className="bg-red-50 border border-red-200 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-2 text-red-600 text-xs font-black uppercase tracking-widest mb-4 italic">
               <AlertTriangle className="w-4 h-4" /> Compliance Threats Detected — Immediate Protocol Enforced
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {expired.map(l => (
                  <div key={l.id} className="bg-white border border-red-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                     <span className="text-[11px] font-black text-red-600 uppercase italic tracking-tight">{l.software_name}</span>
                     <span className="text-[9px] font-black font-mono text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl uppercase">
                        Expired {Math.abs(dayjs(l.expiry_date).diff(dayjs(), 'day'))}d ago
                     </span>
                  </div>
               ))}
               {expiringSoon.map(l => (
                  <div key={l.id} className="bg-white border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                     <span className="text-[11px] font-black text-amber-600 uppercase italic tracking-tight">{l.software_name}</span>
                     <span className="text-[9px] font-black font-mono text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl uppercase">
                        Warn {dayjs(l.expiry_date).diff(dayjs(), 'day')}d
                     </span>
                  </div>
               ))}
            </div>
         </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white border border-slate-200 rounded-[2rem] p-2 shadow-sm w-max mx-auto">
         <button
            onClick={() => setTab('licenses')}
            className={clsx('px-8 py-3 rounded-[1.75rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 italic',
               tab === 'licenses' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            )}
         >
            Software Licenses
            <span className={clsx("opacity-70 font-mono tracking-tighter ml-2", tab === 'licenses' ? "text-purple-300" : "text-slate-400")}>₹{(totalLicenseCost / 1000).toFixed(0)}K</span>
         </button>
         <button
            onClick={() => setTab('amc')}
            className={clsx('px-8 py-3 rounded-[1.75rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 italic',
               tab === 'amc' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            )}
         >
            AMC Contracts
            {amcExpiringSoon.length > 0 && <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black">{amcExpiringSoon.length}</span>}
            <span className={clsx("opacity-70 font-mono tracking-tighter ml-2", tab === 'amc' ? "text-blue-300" : "text-slate-400")}>₹{(totalAmcValue / 1000).toFixed(0)}K</span>
         </button>
      </div>

      {/* Licenses Tab */}
      {tab === 'licenses' && (
         <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm pt-4">
            {licenses.length === 0 ? (
               <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-white m-6">
                  <p className="text-slate-400 font-black uppercase text-[10px] italic tracking-[0.3em]">No registry definitions found for software IP</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                           {['Classification Vector', 'Author', 'Variant', 'Auth Qty', 'Capital Exp (₹)', 'Lifespan Vector', 'Auto-Renew Protocol', 'Audit Notes'].map(h => (
                              <th key={h} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic whitespace-nowrap">{h}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {licenses.map(l => {
                           const exp = getExpiryInfo(l.expiry_date);
                           return (
                              <tr key={l.id} className="hover:bg-slate-50/50 transition-colors group">
                                 <td className="p-6 text-[11px] font-black text-slate-900 uppercase italic whitespace-nowrap">{l.software_name}</td>
                                 <td className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{l.vendor || '—'}</td>
                                 <td className="p-6 whitespace-nowrap">
                                    <span className="bg-slate-50 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-xl uppercase text-[9px] font-black tracking-widest italic">{l.license_type || '—'}</span>
                                 </td>
                                 <td className="p-6 text-[11px] font-black text-slate-900 font-mono tracking-tighter text-center">{l.quantity}</td>
                                 <td className="p-6 font-mono text-[11px] font-black text-slate-900 whitespace-nowrap italic tracking-tighter">
                                    ₹{parseInt(l.purchase_cost || 0).toLocaleString('en-IN')}
                                 </td>
                                 <td className="p-6 whitespace-nowrap">
                                    <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] uppercase shadow-sm italic inline-block", exp.class)}>{exp.label}</span>
                                 </td>
                                 <td className="p-6 whitespace-nowrap">
                                    {l.auto_renew
                                       ? <span className="text-emerald-600 font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5"><RefreshCw size={12} /> Enabled</span>
                                       : <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Manual</span>}
                                 </td>
                                 <td className="p-6 text-[9px] font-bold text-slate-500 max-w-[220px] uppercase tracking-widest italic">
                                    <span className="truncate block opacity-70">{l.notes || '—'}</span>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </div>
      )}

      {/* AMC Tab */}
      {tab === 'amc' && (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {amcList.length === 0 && (
               <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-white">
                  <p className="text-slate-400 font-black uppercase text-[10px] italic tracking-[0.3em]">No maintenance contracts have been allocated</p>
               </div>
            )}
            {amcList.map(a => {
               const exp = getExpiryInfo(a.end_date);
               const totalDays = dayjs(a.end_date).diff(dayjs(a.start_date), 'day');
               const elapsed = dayjs().diff(dayjs(a.start_date), 'day');
               const pct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
               return (
                  <div key={a.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm flex flex-col hover:-translate-y-1 transition-transform hover:shadow-md">
                     <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex-1 min-w-0">
                           <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight mb-2 line-clamp-2">{a.equipment_description}</h3>
                           <div className="flex items-center gap-2 flex-wrap mb-3">
                              <span className={clsx("px-3 py-1 rounded-xl text-[9px] uppercase shadow-sm italic inline-block", exp.class)}>{exp.label}</span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl line-clamp-1">{a.vendor_name || '—'}</span>
                           </div>
                        </div>
                        <div className="text-right flex-shrink-0 bg-blue-50 border border-blue-100 p-4 rounded-3xl group-hover:bg-blue-100 transition-colors">
                           <div className="font-mono font-black text-blue-600 text-xl italic tracking-tighter mb-1">
                              ₹{(parseInt(a.amc_value || 0) / 1000).toFixed(0)}K
                           </div>
                           <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-center">OpEx / Yr</div>
                        </div>
                     </div>

                     <div className="space-y-4 flex-1">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic flex items-start gap-2">
                           <ServerCrash size={14} className="text-slate-400 mt-0.5" /> <span>{a.coverage}</span>
                        </div>
                        {a.contact_person && (
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic flex items-start gap-2">
                           <HardDrive size={14} className="text-slate-400 mt-0.5" /> <span>{a.contact_person} • {a.contact_phone}</span>
                        </div>
                        )}
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic flexitems-center gap-2">
                           🕒 Protocol Window: {dayjs(a.start_date).format('D MMM YY')} → {dayjs(a.end_date).format('D MMM YY')}
                        </div>
                     </div>

                     <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 italic">
                           <span className="text-slate-400">Lifespan Progression</span>
                           <span className={pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-blue-500'}>{pct.toFixed(0)}% Utilized</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                           <div
                              className={clsx('h-full rounded-full transition-all shadow-sm',
                                 pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                              )}
                              style={{ width: `${pct}%` }}
                           />
                        </div>
                     </div>
                  </div>
               );
            })}
         </div>
      )}

      {/* Add License Modal */}
      {showLicForm && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/20"><Key className="w-6 h-6 text-white" /></div>
                     <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-none mb-1">IP Software Registry</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Declare digital asset framework</p>
                     </div>
                  </div>
                  <button onClick={() => { licForm.reset(); setShowLicForm(false); }} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-all"><X className="w-6 h-6" /></button>
               </div>
               
               <form onSubmit={licForm.handleSubmit(createLicMut.mutate)} className="p-10 space-y-8 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Application Nomenclature *</label>
                        <input {...licForm.register('software_name', { required: true })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-purple-500 transition-all shadow-sm" placeholder="AUTOCAD 2024 ARCHITECTURE" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Publisher (OEM)</label>
                        <input {...licForm.register('vendor')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-purple-500 transition-all shadow-sm" placeholder="AUTODESK INC" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Licensure Tier</label>
                        <select {...licForm.register('license_type')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-purple-500 transition-all shadow-sm">
                           <option value="">Define Sector</option>
                           <option value="annual">Annual Commitment</option>
                           <option value="perpetual">Perpetual Unlock</option>
                           <option value="subscription">Cloud SaaS / Subscription</option>
                           <option value="oem">Bundled OEM</option>
                           <option value="freeware">FOSS / Freeware</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Assigned Seats</label>
                        <input type="number" {...licForm.register('quantity')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-purple-500 transition-all shadow-sm" defaultValue={1} />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Financial Obligation (₹)</label>
                        <input type="number" step="0.01" {...licForm.register('purchase_cost')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-purple-600 font-mono outline-none focus:border-purple-500 transition-all shadow-sm" placeholder="50000" />
                     </div>
                     <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Initiation Epoch</label>
                        <input type="date" {...licForm.register('purchase_date')} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-purple-500 transition-all shadow-sm" />
                     </div>
                     <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Termination Threshold</label>
                        <input type="date" {...licForm.register('expiry_date')} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-purple-500 transition-all shadow-sm" />
                     </div>
                     <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Cryptographic License Key / JWT</label>
                        <input {...licForm.register('license_key')} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase font-mono tracking-widest outline-none focus:border-purple-500 transition-all shadow-sm" placeholder="XXXX-XXXX-XXXX-XXXX" />
                     </div>
                     <div className="col-span-2 flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-2xl cursor-pointer hover:border-purple-300 transition-colors" onClick={() => document.getElementById('auto_renew').click()}>
                        <div>
                           <div className="text-xs font-black text-slate-900 uppercase italic">Enable Autonomous Renewal Sequence</div>
                           <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Permit auto debit from corporate treasury</div>
                        </div>
                        <input type="checkbox" id="auto_renew" {...licForm.register('auto_renew')} className="w-6 h-6 accent-purple-600 rounded cursor-pointer" />
                     </div>
                     <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Audit Annotation / Context</label>
                        <textarea {...licForm.register('notes')} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-purple-500 transition-all shadow-sm resize-none" rows={2} placeholder="..." />
                     </div>
                  </div>
                  <div className="flex gap-4 pt-6 border-t border-slate-100">
                     <button type="button" className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-[1.5rem] transition-all" onClick={() => { licForm.reset(); setShowLicForm(false); }}>Abort Sequence</button>
                     <button type="submit" disabled={createLicMut.isPending} className="flex-[2] py-4 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-[1.5rem] shadow-xl shadow-purple-600/20 italic disabled:opacity-50 flex items-center justify-center gap-2">
                        {createLicMut.isPending ? 'Committing Block...' : 'Publish Registration'}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Add AMC Modal */}
      {showAmcForm && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20"><AlertTriangle className="w-6 h-6 text-white" /></div>
                     <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-none mb-1">Contract Deployment Protocol</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Declare Annual Maintenance SLA</p>
                     </div>
                  </div>
                  <button onClick={() => { amcForm.reset(); setShowAmcForm(false); }} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-all"><X className="w-6 h-6" /></button>
               </div>
               
               <form onSubmit={amcForm.handleSubmit(createAmcMut.mutate)} className="p-10 space-y-8 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Asset SLA Vector *</label>
                        <input {...amcForm.register('equipment_description', { required: true })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="SERVER ROOM HVAC SYSTEM / UPS INFRASTRUCTURE" />
                     </div>
                     <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Procurement Vendor Linkage</label>
                        <select {...amcForm.register('vendor_id')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-blue-500 transition-all shadow-sm">
                           <option value="">Unlinked Sovereign Contract</option>
                           {(vendorData || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Fiscal Impact (₹ OpEx/yr) *</label>
                        <input type="number" step="0.01" {...amcForm.register('amc_value', { required: true })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-black text-blue-600 font-mono outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="120000" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Coverage Type Vector</label>
                        <input {...amcForm.register('coverage')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="COMPREHENSIVE P&L, 24X7 SLA" />
                     </div>
                     <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">SLA Kickoff Anchor *</label>
                        <input type="date" {...amcForm.register('start_date', { required: true })} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-blue-500 transition-all shadow-sm" />
                     </div>
                     <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">SLA Termination Horizon *</label>
                        <input type="date" {...amcForm.register('end_date', { required: true })} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-blue-500 transition-all shadow-sm" />
                     </div>
                     <div className="space-y-2 pt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Emergency Officer Name</label>
                        <input {...amcForm.register('contact_person')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="E.G. RAMESH KUMAR" />
                     </div>
                     <div className="space-y-2 pt-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic ml-1">Comms Uplink (Phone)</label>
                        <input {...amcForm.register('contact_phone')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-900 uppercase font-mono tracking-widest outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="+91 9XXXX XXXXX" />
                     </div>
                  </div>
                  <div className="flex gap-4 pt-6 border-t border-slate-100">
                     <button type="button" className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-[1.5rem] transition-all" onClick={() => { amcForm.reset(); setShowAmcForm(false); }}>Abort Sequence</button>
                     <button type="submit" disabled={createAmcMut.isPending} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-[1.5rem] shadow-xl shadow-blue-600/20 italic disabled:opacity-50 flex items-center justify-center gap-2">
                        {createAmcMut.isPending ? 'Committing...' : 'Commit Contract Deployment'}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}
