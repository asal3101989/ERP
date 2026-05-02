import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Plus, Trash2, Calendar } from 'lucide-react';
import { hrMastersAPI } from '../../api/client';
import toast from 'react-hot-toast';

const TYPE_COLORS = {
  national: 'bg-red-900/30 text-red-400 border border-red-700',
  festival: 'bg-amber-900/30 text-amber-400 border border-amber-700',
  optional: 'bg-blue-900/30 text-blue-400 border border-blue-700',
};

const INDIAN_HOLIDAYS_2026 = [
  { name: 'Republic Day',         date: '2026-01-26', type: 'national' },
  { name: 'Holi',                 date: '2026-03-03', type: 'festival' },
  { name: 'Good Friday',          date: '2026-04-03', type: 'national' },
  { name: 'Ram Navami',           date: '2026-04-08', type: 'festival' },
  { name: 'Eid ul-Fitr',          date: '2026-03-31', type: 'festival' },
  { name: 'Maharashtra Day',      date: '2026-05-01', type: 'national' },
  { name: 'Independence Day',     date: '2026-08-15', type: 'national' },
  { name: 'Onam',                 date: '2026-09-07', type: 'festival' },
  { name: 'Gandhi Jayanti',       date: '2026-10-02', type: 'national' },
  { name: 'Dussehra',             date: '2026-10-20', type: 'festival' },
  { name: 'Diwali',               date: '2026-11-08', type: 'festival' },
  { name: 'Christmas',            date: '2026-12-25', type: 'national' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function HolidayCalendarPage() {
  const qc    = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ holiday_date: '', name: '', holiday_type: 'national' });

  const { data, isLoading } = useQuery({
    queryKey: ['hr-holidays', year],
    queryFn: () => hrMastersAPI.listHolidays({ year }).then(r => r.data),
  });
  const holidays = data?.data || [];

  const createMut = useMutation({
    mutationFn: (d) => hrMastersAPI.createHoliday(d),
    onSuccess: () => { toast.success('Holiday added'); qc.invalidateQueries({ queryKey: ['hr-holidays'] }); setModal(false); setForm({ holiday_date:'',name:'',holiday_type:'national'}); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => hrMastersAPI.deleteHoliday(id),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['hr-holidays'] }); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const bulkImport = async () => {
    for (const h of INDIAN_HOLIDAYS_2026) {
      try { await hrMastersAPI.createHoliday({ holiday_date: h.date, name: h.name, holiday_type: h.type }); } catch {}
    }
    toast.success('Imported default holidays');
    qc.invalidateQueries({ queryKey: ['hr-holidays'] });
  };

  // Group by month
  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    holidays: holidays.filter(h => new Date(h.holiday_date).getMonth() === i),
  })).filter(m => m.holidays.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-600/20 rounded-lg"><Star className="w-6 h-6 text-amber-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Holiday Calendar</h1>
            <p className="text-sm text-slate-400">Company holidays & non-working days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {holidays.length === 0 && (
            <button onClick={bulkImport} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
              <Calendar className="w-4 h-4" /> Import Defaults
            </button>
          )}
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Holiday
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {['national','festival','optional'].map(type => (
          <div key={type} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm capitalize mb-1">{type}</div>
            <div className="text-2xl font-bold text-white">{holidays.filter(h => h.holiday_type === type).length}</div>
          </div>
        ))}
      </div>

      {/* Calendar List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : byMonth.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="mb-3">No holidays for {year}</p>
          <button onClick={bulkImport} className="text-blue-400 hover:text-blue-300 text-sm underline">Import default Indian holidays</button>
        </div>
      ) : (
        <div className="space-y-4">
          {byMonth.map(({ month, holidays: mh }) => (
            <div key={month} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-750 border-b border-slate-700">
                <span className="font-semibold text-white">{MONTHS[month-1]} {year}</span>
                <span className="text-slate-400 text-sm ml-2">({mh.length} holiday{mh.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {mh.sort((a,b) => new Date(a.holiday_date) - new Date(b.holiday_date)).map(h => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center w-12">
                        <div className="text-2xl font-bold text-white">{new Date(h.holiday_date).getDate()}</div>
                        <div className="text-xs text-slate-500">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(h.holiday_date).getDay()]}</div>
                      </div>
                      <div>
                        <div className="text-white font-medium">{h.name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[h.holiday_type] || ''}`}>{h.holiday_type}</span>
                      </div>
                    </div>
                    <button onClick={() => window.confirm('Remove holiday?') && deleteMut.mutate(h.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
            <h2 className="font-semibold text-white mb-4">Add Holiday</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Date</label>
                <input type="date" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                  value={form.holiday_date} onChange={e => setForm(p => ({ ...p, holiday_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Holiday Name</label>
                <input className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Diwali" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Type</label>
                <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                  value={form.holiday_type} onChange={e => setForm(p => ({ ...p, holiday_type: e.target.value }))}>
                  <option value="national">National</option>
                  <option value="festival">Festival</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={() => form.holiday_date && form.name && createMut.mutate(form)} disabled={createMut.isPending}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {createMut.isPending ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
