import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Plus, Edit2, Star } from 'lucide-react';
import { hrAppraisalsAPI, hrEmployeesAPI } from '../../api/client';
import toast from 'react-hot-toast';

const RATING_COLORS = {
  Excellent: 'bg-emerald-900/30 text-emerald-400 border border-emerald-700',
  Good:      'bg-blue-900/30   text-blue-400   border border-blue-700',
  Average:   'bg-amber-900/30  text-amber-400  border border-amber-700',
  Poor:      'bg-red-900/30    text-red-400    border border-red-700',
};
const STATUS_PILL = {
  draft:        'bg-slate-700 text-slate-300',
  submitted:    'bg-blue-900/30 text-blue-400',
  acknowledged: 'bg-emerald-900/30 text-emerald-400',
};
const fmt = (v) => v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—';

function AppraisalModal({ appraisal, employees, onClose, onSave }) {
  const [f, setF] = useState({
    user_id:         appraisal?.user_id || '',
    review_period:   appraisal?.review_period || `${new Date().getFullYear()-1}-${new Date().getFullYear()}`,
    review_date:     appraisal?.review_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    kra_score:       appraisal?.kra_score || '',
    overall_rating:  appraisal?.overall_rating || '',
    increment_pct:   appraisal?.increment_pct || 0,
    increment_amount:appraisal?.increment_amount || 0,
    new_ctc:         appraisal?.new_ctc || '',
    comments:        appraisal?.comments || '',
    status:          appraisal?.status || 'draft',
  });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const inp = "w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-white text-lg mb-4">{appraisal ? 'Edit' : 'New'} Performance Review</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Employee</label>
            <select className={inp} value={f.user_id} onChange={e => s('user_id', e.target.value)}>
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Review Period</label>
              <input className={inp} value={f.review_period} onChange={e => s('review_period', e.target.value)} placeholder="e.g. 2025-2026" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Review Date</label>
              <input type="date" className={inp} value={f.review_date} onChange={e => s('review_date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">KRA Score (0–100)</label>
              <input type="number" min="0" max="100" className={inp} value={f.kra_score} onChange={e => s('kra_score', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Overall Rating</label>
              <select className={inp} value={f.overall_rating} onChange={e => s('overall_rating', e.target.value)}>
                <option value="">Select</option>
                {['Excellent','Good','Average','Poor'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Increment %</label>
              <input type="number" className={inp} value={f.increment_pct} onChange={e => s('increment_pct', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Increment Amount ₹</label>
              <input type="number" className={inp} value={f.increment_amount} onChange={e => s('increment_amount', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">New Annual CTC ₹</label>
              <input type="number" className={inp} value={f.new_ctc} onChange={e => s('new_ctc', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Comments / Feedback</label>
            <textarea className={inp} rows={3} value={f.comments} onChange={e => s('comments', e.target.value)} placeholder="Performance summary, achievements, areas of improvement…" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Status</label>
            <select className={inp} value={f.status} onChange={e => s('status', e.target.value)}>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted to Employee</option>
              <option value="acknowledged">Acknowledged by Employee</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
          <button onClick={() => f.user_id && onSave(f)}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
            Save Review
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppraisalPage() {
  const qc = useQueryClient();
  const [modal,  setModal]  = useState(null);
  const [period, setPeriod] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hr-appraisals', period],
    queryFn: () => hrAppraisalsAPI.list({ review_period: period || undefined }).then(r => r.data),
  });
  const { data: empData } = useQuery({
    queryKey: ['hr-employees-active'],
    queryFn: () => hrEmployeesAPI.list({ employment_status: 'active' }).then(r => r.data),
  });

  const appraisals = data?.data || [];
  const employees  = empData?.data || [];

  // Extract unique periods
  const periods = [...new Set(appraisals.map(a => a.review_period).filter(Boolean))];

  const saveMut = useMutation({
    mutationFn: (d) => modal?.id ? hrAppraisalsAPI.update(modal.id, d) : hrAppraisalsAPI.create(d),
    onSuccess: () => { toast.success('Review saved'); refetch(); setModal(null); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  // Summary stats
  const ratingCounts = appraisals.reduce((acc, a) => {
    if (a.overall_rating) acc[a.overall_rating] = (acc[a.overall_rating] || 0) + 1;
    return acc;
  }, {});
  const avgScore = appraisals.length
    ? (appraisals.reduce((s, a) => s + parseFloat(a.kra_score || 0), 0) / appraisals.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-600/20 rounded-lg"><TrendingUp className="w-6 h-6 text-violet-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Performance Appraisals</h1>
            <p className="text-sm text-slate-400">Annual reviews, KRA scoring & increment management</p>
          </div>
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Review
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Total Reviews</div>
          <div className="text-2xl font-bold text-white">{appraisals.length}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Avg KRA Score</div>
          <div className="text-2xl font-bold text-blue-400">{avgScore}</div>
        </div>
        {['Excellent','Good','Average','Poor'].map(r => (
          <div key={r} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">{r}</div>
            <div className={`text-2xl font-bold ${RATING_COLORS[r]?.includes('emerald') ? 'text-emerald-400' : RATING_COLORS[r]?.includes('blue') ? 'text-blue-400' : RATING_COLORS[r]?.includes('amber') ? 'text-amber-400' : 'text-red-400'}`}>
              {ratingCounts[r] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Filter by period */}
      <div className="flex items-center gap-3">
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          <option value="">All Periods</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-slate-500 text-sm">{appraisals.length} review{appraisals.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Appraisal Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {appraisals.map(a => (
            <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-semibold text-white text-lg">{a.employee_name}</div>
                    <div className="text-slate-400 text-sm">{a.employee_code} · {a.department_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_PILL[a.status] || ''}`}>{a.status}</span>
                  {a.overall_rating && (
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${RATING_COLORS[a.overall_rating] || ''}`}>
                      {a.overall_rating}
                    </span>
                  )}
                  <button onClick={() => setModal(a)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                <div>
                  <div className="text-slate-500 text-xs mb-1">Review Period</div>
                  <div className="text-slate-300 font-medium">{a.review_period || '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">KRA Score</div>
                  <div className="flex items-center gap-2">
                    <div className="text-white font-bold text-lg">{a.kra_score || '—'}<span className="text-slate-500 text-sm">/100</span></div>
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Increment %</div>
                  <div className="text-emerald-400 font-bold">{a.increment_pct || 0}%</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Increment Amount</div>
                  <div className="text-emerald-400">{fmt(a.increment_amount)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">New CTC</div>
                  <div className="text-white font-medium">{fmt(a.new_ctc)}</div>
                </div>
              </div>

              {/* KRA Score Bar */}
              {a.kra_score && (
                <div className="mt-4">
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        parseFloat(a.kra_score) >= 80 ? 'bg-emerald-500' :
                        parseFloat(a.kra_score) >= 60 ? 'bg-blue-500' :
                        parseFloat(a.kra_score) >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, parseFloat(a.kra_score))}%` }}
                    />
                  </div>
                </div>
              )}

              {a.comments && (
                <div className="mt-3 text-slate-400 text-sm italic bg-slate-700/30 rounded-lg px-3 py-2">
                  "{a.comments}"
                </div>
              )}

              <div className="mt-3 text-xs text-slate-500">
                Reviewed by: {a.reviewer_name || '—'} ·
                {a.review_date ? ` ${new Date(a.review_date).toLocaleDateString('en-IN')}` : ''}
              </div>
            </div>
          ))}

          {appraisals.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No appraisals yet. Create the first performance review.</p>
            </div>
          )}
        </div>
      )}

      {modal !== null && (
        <AppraisalModal
          appraisal={modal?.id ? modal : null}
          employees={employees}
          onClose={() => setModal(null)}
          onSave={(d) => saveMut.mutate(d)}
        />
      )}
    </div>
  );
}
