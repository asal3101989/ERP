import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, X, Minus, Fingerprint, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { hrAttendanceAPI, hrMastersAPI, hrEmployeesAPI, hrEsslAPI } from '../../api/client';
import toast from 'react-hot-toast';

const STATUS_CELL = {
  present:  { bg: 'bg-emerald-700/40 hover:bg-emerald-700/60', text: 'text-emerald-300', label: 'P' },
  absent:   { bg: 'bg-red-700/40 hover:bg-red-700/60',         text: 'text-red-300',     label: 'A' },
  half_day: { bg: 'bg-amber-700/40 hover:bg-amber-700/60',     text: 'text-amber-300',   label: 'H' },
  leave:    { bg: 'bg-blue-700/40 hover:bg-blue-700/60',       text: 'text-blue-300',    label: 'L' },
  holiday:  { bg: 'bg-purple-700/40',                          text: 'text-purple-300',  label: 'HO'},
  week_off: { bg: 'bg-slate-700/40',                           text: 'text-slate-500',   label: 'WO'},
};

const NEXT_STATUS = { present: 'absent', absent: 'half_day', half_day: 'leave', leave: 'present' };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function AttendancePage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('');
  const [view, setView] = useState('summary'); // 'grid' | 'summary'

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const { data: deptData } = useQuery({ queryKey: ['hr-departments'], queryFn: () => hrMastersAPI.listDepts().then(r => r.data) });
  const { data: empData }  = useQuery({ queryKey: ['hr-employees-active'], queryFn: () => hrEmployeesAPI.list({ employment_status: 'active' }).then(r => r.data) });

  const { data: attData, isLoading } = useQuery({
    queryKey: ['hr-attendance-grid', month, year, deptFilter],
    queryFn: () => hrAttendanceAPI.list({ month, year, department_id: deptFilter || undefined }).then(r => r.data),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['hr-attendance-summary', month, year, deptFilter],
    queryFn: () => hrAttendanceAPI.summary({ month, year, department_id: deptFilter || undefined }).then(r => r.data),
  });

  const employees  = useMemo(() => {
    const emps = empData?.data || [];
    if (!deptFilter) return emps;
    return emps.filter(e => e.department_id === deptFilter);
  }, [empData, deptFilter]);

  const attMap = useMemo(() => {
    const map = {};
    (attData?.data || []).forEach(a => {
      const d = new Date(a.attendance_date).getDate();
      if (!map[a.user_id]) map[a.user_id] = {};
      map[a.user_id][d] = a;
    });
    return map;
  }, [attData]);

  const upsertMut = useMutation({
    mutationFn: (data) => hrAttendanceAPI.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-attendance-grid'] }),
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const toggleStatus = (userId, day) => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const current = attMap[userId]?.[day]?.status || null;
    const next    = current ? NEXT_STATUS[current] || 'present' : 'present';
    upsertMut.mutate({ user_id: userId, attendance_date: dateStr, status: next });
  };

  const isWeekend = (day) => new Date(year, month-1, day).getDay() === 0;

  const summary = summaryData?.data || [];

  // ── ESSL sync state ───────────────────────────────────────────────────────
  const [syncing,    setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleEsslSync = async () => {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to   = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await hrEsslAPI.sync(from, to);
      setSyncResult(r.data);
      toast.success(`ESSL sync done — ${r.data.synced} records updated`);
      qc.invalidateQueries({ queryKey: ['hr-attendance-grid'] });
      qc.invalidateQueries({ queryKey: ['hr-attendance-summary'] });
    } catch (e) {
      const msg = e.response?.data?.error || 'Sync failed';
      setSyncResult({ error: msg });
      toast.error(msg);
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg"><Calendar className="w-6 h-6 text-blue-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Attendance</h1>
            <p className="text-sm text-slate-400">Monthly attendance tracking for permanent employees</p>
          </div>
        </div>
        {/* ESSL Sync button */}
        <button
          onClick={handleEsslSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {syncing
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <Fingerprint className="w-4 h-4" />}
          {syncing ? 'Syncing from ESSL…' : 'Sync from ESSL'}
        </button>
      </div>

      {/* ESSL sync result banner */}
      {syncResult && !syncResult.error && (
        <div className="bg-violet-900/20 border border-violet-700 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-violet-400 shrink-0" />
            <div className="text-sm">
              <span className="text-white font-medium">ESSL sync complete</span>
              <span className="text-violet-300 ml-2">
                {syncResult.synced} synced · {syncResult.skipped} skipped · {syncResult.raw_swipes} raw swipes
              </span>
            </div>
          </div>
          {syncResult.not_found?.length > 0 && (
            <div className="flex items-center gap-1 text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4" />
              {syncResult.not_found.length} unmatched code(s): {syncResult.not_found.join(', ')}
            </div>
          )}
          <button onClick={() => setSyncResult(null)} className="text-slate-500 hover:text-white text-xs ml-4">✕</button>
        </div>
      )}
      {syncResult?.error && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" /> {syncResult.error}
          </div>
          <button onClick={() => setSyncResult(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center bg-slate-800 border border-slate-700 rounded-xl p-4">
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          <option value="">All Departments</option>
          {(deptData?.data || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="flex gap-1 bg-slate-700 rounded-lg p-1 ml-auto">
          <button onClick={() => setView('summary')} className={`px-3 py-1 rounded text-sm ${view==='summary' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Summary</button>
          <button onClick={() => setView('grid')}    className={`px-3 py-1 rounded text-sm ${view==='grid'    ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Grid</button>
        </div>
      </div>

      {/* Legend (grid mode) */}
      {view === 'grid' && (
        <div className="flex gap-3 flex-wrap text-xs">
          {Object.entries(STATUS_CELL).map(([k,v]) => (
            <div key={k} className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded flex items-center justify-center ${v.bg} ${v.text} text-[10px] font-bold`}>{v.label}</div>
              <span className="text-slate-400 capitalize">{k.replace('_',' ')}</span>
            </div>
          ))}
          <span className="text-slate-500 ml-2">Click cell to cycle status</span>
        </div>
      )}

      {/* Grid View */}
      {view === 'grid' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Loading attendance…</div>
          ) : (
            <table className="text-xs min-w-max">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium sticky left-0 bg-slate-800 min-w-48">Employee</th>
                  {days.map(d => (
                    <th key={d} className={`w-8 py-3 text-center font-medium ${isWeekend(d) ? 'text-slate-600' : 'text-slate-400'}`}>
                      <div>{d}</div>
                      <div className="text-[9px] text-slate-600">{['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(year,month-1,d).getDay()]}</div>
                    </th>
                  ))}
                  <th className="text-center px-2 py-3 text-slate-400 font-medium">P</th>
                  <th className="text-center px-2 py-3 text-slate-400 font-medium">A</th>
                  <th className="text-center px-2 py-3 text-slate-400 font-medium">H</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const empAtt = attMap[emp.id] || {};
                  const pCount = Object.values(empAtt).filter(a => a.status === 'present').length;
                  const aCount = Object.values(empAtt).filter(a => a.status === 'absent').length;
                  const hCount = Object.values(empAtt).filter(a => a.status === 'half_day').length;
                  return (
                    <tr key={emp.id} className="border-b border-slate-700/50 hover:bg-slate-750/30">
                      <td className="px-4 py-2 sticky left-0 bg-slate-800">
                        <div className="text-white font-medium">{emp.name}</div>
                        <div className="text-slate-500 text-[10px]">{emp.employee_code}</div>
                      </td>
                      {days.map(d => {
                        const att = empAtt[d];
                        const style = att ? STATUS_CELL[att.status] : null;
                        const isSun = isWeekend(d);
                        return (
                          <td key={d} className="w-8 p-0.5">
                            <div
                              className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                                isSun ? 'bg-slate-700/20 text-slate-700 cursor-default' :
                                style ? `${style.bg} ${style.text}` :
                                'hover:bg-slate-700 text-slate-600'
                              }`}
                              onClick={() => !isSun && toggleStatus(emp.id, d)}
                              title={att?.status || 'Not marked'}
                            >
                              {isSun ? '—' : (style?.label || '·')}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-center px-2 py-2 text-emerald-400 font-bold">{pCount}</td>
                      <td className="text-center px-2 py-2 text-red-400 font-bold">{aCount}</td>
                      <td className="text-center px-2 py-2 text-amber-400 font-bold">{hCount}</td>
                    </tr>
                  );
                })}
                {employees.length === 0 && (
                  <tr><td colSpan={daysInMonth + 4} className="text-center py-10 text-slate-500">No employees</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Summary View */}
      {view === 'summary' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Employee','Department','Present','Absent','Half Day','Leave','Total Marked'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map(s => (
                <tr key={s.user_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{s.name}</div>
                    <div className="text-slate-500 text-xs">{s.employee_code}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{s.department_name || '—'}</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold">{s.present}</td>
                  <td className="px-4 py-3 text-red-400 font-bold">{s.absent}</td>
                  <td className="px-4 py-3 text-amber-400 font-bold">{s.half_day}</td>
                  <td className="px-4 py-3 text-blue-400 font-bold">{s.on_leave}</td>
                  <td className="px-4 py-3 text-slate-300">{s.total_marked}</td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">No attendance data for {MONTHS[month-1]} {year}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
