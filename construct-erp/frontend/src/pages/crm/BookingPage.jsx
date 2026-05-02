import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, IndianRupee, Calendar, User, KeySquare, X, Receipt } from 'lucide-react';
import { bookingAPI, projectAPI } from '../../api/client';
import dayjs from 'dayjs';
import { clsx } from 'clsx';
import DataToolbar from '../../components/common/DataToolbar';

const STATUS_BADGE = { 
  booked: 'bg-blue-50 text-blue-600 border border-blue-200', 
  allotted: 'bg-emerald-50 text-emerald-600 border border-emerald-200', 
  cancelled: 'bg-red-50 text-red-600 border border-red-200', 
  registered: 'bg-purple-50 text-purple-600 border border-purple-200' 
};

const fmt = v => `₹${(v / 100000).toFixed(2)}L`;

export default function BookingPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const [form, setForm] = useState({ project_id: '', client_name: '', client_mobile: '', client_email: '', unit_number: '', floor: '', area_sqft: '', sale_rate: '', booking_date: dayjs().format('YYYY-MM-DD'), booking_amount: '' });

  const { data: rawBookingsRes } = useQuery({ queryKey: ['bookings'], queryFn: () => bookingAPI.list().then(r => r.data) });
  const { data: projectsRes } = useQuery({ queryKey: ['projects-simple'], queryFn: () => projectAPI.list().then(r => r.data) });

  const rawBookings = Array.isArray(rawBookingsRes) ? rawBookingsRes : (Array.isArray(rawBookingsRes?.data) ? rawBookingsRes.data : []);
  const projects = Array.isArray(projectsRes) ? projectsRes : (Array.isArray(projectsRes?.data) ? projectsRes.data : []);

  const bookings = rawBookings.map(b => ({ ...b, project_name: b.project_name ?? b.project ?? '—' }));

  const createMut = useMutation({
    mutationFn: (d) => bookingAPI.create(d),
    onSuccess: () => { toast.success('Booking created'); qc.invalidateQueries(['bookings']); setShowModal(false); },
    onError: () => toast.error('Failed to create booking'),
  });

  const filtered = bookings.filter(b => filterProject === 'all' || b.project_name === filterProject);
  const projectNames = [...new Set(bookings.map(b => b.project_name))];

  const totalValue = filtered.reduce((s, b) => s + (Number(b.total_value) || 0), 0);
  const totalReceived = filtered.reduce((s, b) => s + (Number(b.received_amount) || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center border border-slate-200 shadow-sm">
             <KeySquare className="w-6 h-6 text-indigo-600" />
           </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Client Bookings</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Unit reservations — payment schedules — RERA compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowModal(true)} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2 italic">
            <Plus size={16} /> New Booking
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-3xl font-black text-indigo-600 font-mono tracking-tighter italic">{filtered.length}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Total Bookings</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter italic">{fmt(totalValue)}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Total Sale Value</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-sm">
          <div className="text-3xl font-black text-emerald-600 font-mono tracking-tighter italic">{fmt(totalReceived)}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Amount Received</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 text-center shadow-md">
          <div className="text-3xl font-black text-amber-400 font-mono tracking-tighter italic">{fmt(totalValue - totalReceived)}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Balance Receivable</div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-4 flex flex-col md:flex-row items-center gap-4 shadow-sm">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="w-full md:w-auto bg-slate-50 border border-slate-200 py-3.5 px-6 rounded-2xl text-[10px] font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none italic min-w-[250px]">
          <option value="all">All Enterprise Projects</option>
          {projectNames.map(n => <option key={n}>{n}</option>)}
        </select>
        <div className="ml-auto w-full md:w-auto">
           <DataToolbar data={filtered} fileName="Bookings_Export" hideAdd />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Booking #', 'Client Profile', 'Project / Unit', 'Area (sqft)', 'Total Value', 'Received', 'Balance', 'Date', 'Status'].map((h, i) => (
                   <th key={i} className={clsx("py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic whitespace-nowrap", h === 'Area (sqft)' || h === 'Total Value' || h === 'Received' || h === 'Balance' ? 'text-right' : '')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(b => {
                const pct = b.total_value ? Math.round((b.received_amount / b.total_value) * 100) : 0;
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelected(b)}>
                    <td className="py-5 px-6 pl-8 font-mono text-indigo-600 font-black tracking-tight text-sm italic">{b.booking_number}</td>
                    <td className="py-5 px-6">
                      <div className="text-slate-900 font-black uppercase text-sm tracking-tight italic">{b.client_name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{b.client_mobile}</div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="text-slate-900 font-black uppercase text-xs tracking-tight">{b.project_name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Unit {b.unit_number} <span className="mx-1">•</span> {b.floor} Floor</div>
                    </td>
                    <td className="py-5 px-6 text-right font-mono font-bold text-slate-500">{Number(b.area_sqft).toLocaleString()}</td>
                    <td className="py-5 px-6 text-right font-mono font-black text-slate-900 text-base tracking-tighter italic">{fmt(b.total_value)}</td>
                    <td className="py-5 px-6 text-right w-40">
                      <div className="font-mono font-black text-emerald-600 tracking-tighter italic bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 inline-block">{fmt(b.received_amount)}</div>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-2 overflow-hidden shadow-inner flex justify-end">
                        <div className={clsx("h-1 rounded-full", pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right font-mono font-black text-amber-500 text-sm tracking-tighter italic">{fmt(b.balance)}</td>
                    <td className="py-5 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{dayjs(b.booking_date).format('DD MMM YYYY')}</td>
                    <td className="py-5 px-6 pr-8">
                       <span className={clsx("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest italic shadow-sm whitespace-nowrap", STATUS_BADGE[b.status] || 'bg-slate-50 text-slate-500 border border-slate-200')}>{b.status}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                   <td colSpan={9} className="py-24 text-center">
                      <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl mx-auto flex items-center justify-center mb-6"><KeySquare className="w-10 h-10 text-slate-300" /></div>
                      <span className="font-black text-slate-400 uppercase tracking-[0.3em] italic block">No active bookings</span>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal with Payment Schedule */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-[3.5rem] w-full max-w-2xl overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] scale-150 rotate-12 pointer-events-none"><Receipt size={100} /></div>
              <div className="relative z-10">
                <h2 className="text-xl font-black text-indigo-600 uppercase tracking-tight italic flex items-center gap-3">{selected.booking_number}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{selected.client_name} — {selected.project_name} Unit {selected.unit_number}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm relative z-10"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-3 gap-5">
                <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-5 text-center shadow-inner">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Sale Value</div>
                  <div className="text-xl text-slate-900 font-black font-mono tracking-tighter italic">{fmt(selected.total_value)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-5 text-center shadow-inner">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Received</div>
                  <div className="text-xl text-emerald-600 font-black font-mono tracking-tighter italic">{fmt(selected.received_amount)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-5 text-center shadow-inner">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Balance</div>
                  <div className="text-xl text-amber-500 font-black font-mono tracking-tighter italic">{fmt(selected.balance)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5 text-sm bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                <div className="flex flex-col gap-1">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Area Profile</span> 
                   <span className="text-slate-900 font-bold font-mono tracking-tight">{selected.area_sqft} sqft @ ₹{selected.sale_rate}/sqft</span>
                </div>
                <div className="flex flex-col gap-1">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">RERA Registration</span> 
                   <span className="text-slate-900 font-bold font-mono tracking-tight">{selected.rera_number || '—'}</span>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4 italic border-b border-slate-100 pb-2">Fiscal Payment Schedule</h3>
                <div className="space-y-3">
                  {[]?.length > 0 ? [].map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm"><Calendar size={16} /></div>
                        <div>
                          <div className="text-slate-900 font-black uppercase tracking-tight text-xs italic">{s.milestone}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{dayjs(s.due_date).format('DD MMM YYYY')}</div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col gap-2 items-end">
                        <div className="text-slate-900 font-black font-mono shadow-sm bg-white px-3 py-1 rounded-lg border border-slate-200">{fmt(s.amount)}</div>
                        <span className={clsx("px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest italic", s.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : s.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-500 border border-slate-200')}>{s.status}</span>
                      </div>
                    </div>
                  )) : (
                     <div className="text-center p-8 bg-slate-50 border border-slate-100 rounded-2xl">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] italic">No installment plan mapped yet.</span>
                     </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-[3.5rem] w-full max-w-2xl overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-200 text-indigo-600 shadow-sm"><KeySquare size={20} /></div>
                 New Client Booking
              </h2>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Project Assignment *</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all appearance-none italic" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Select organizational project target</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Client Full Name *</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all italic" placeholder="Enter name" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Client Contact #</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-slate-900 uppercase tracking-widest outline-none focus:border-indigo-400 shadow-sm transition-all" placeholder="Enter mobile" value={form.client_mobile} onChange={e => setForm(f => ({ ...f, client_mobile: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Unit Configuration</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="A-801" value={form.unit_number} onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Floor Layer</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-mono font-black text-slate-900 uppercase outline-none focus:border-indigo-400 shadow-sm transition-all text-center" placeholder="8th" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Saleable Area (sqft)</label>
                  <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all text-center" value={form.area_sqft} onChange={e => setForm(f => ({ ...f, area_sqft: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Unit Price (₹/sqft)</label>
                  <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-mono font-black text-emerald-600 outline-none focus:border-indigo-400 shadow-sm transition-all text-center" value={form.sale_rate} onChange={e => setForm(f => ({ ...f, sale_rate: e.target.value }))} />
                </div>
                {form.area_sqft && form.sale_rate && (
                  <div className="col-span-2 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-sm flex justify-between items-center shadow-inner">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest italic">Computed Total Sale Value</span>
                    <span className="text-2xl font-black font-mono text-indigo-600 tracking-tighter italic shadow-sm bg-white rounded-xl px-4 py-1">{fmt(form.area_sqft * form.sale_rate)}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Date of Booking</label>
                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 shadow-sm transition-all uppercase" value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Initial Token Amount (₹)</label>
                  <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-mono font-black text-indigo-600 outline-none focus:border-indigo-400 shadow-sm transition-all" value={form.booking_amount} onChange={e => setForm(f => ({ ...f, booking_amount: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-sm italic" onClick={() => setShowModal(false)}>Discard Form</button>
                <button className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30 italic" onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.project_id || !form.client_name}>
                  {createMut.isPending ? 'Committing...' : 'Finalize Reservation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
