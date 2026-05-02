// src/pages/hr-admin/ESSLSyncPage.jsx
// Fetch attendance from ESSL Biometric via Microsoft SQL Server
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Fingerprint, Server, CheckCircle, XCircle, RefreshCw,
  Settings, Eye, Download, AlertTriangle, Clock, Users, Wifi, WifiOff
} from 'lucide-react';
import { hrEsslAPI } from '../../api/client';
import toast from 'react-hot-toast';

const inp = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500';
const today = new Date().toISOString().split('T')[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

// ── Status badge helper ───────────────────────────────────────────────────────
const STATUS_COLOR = {
  present:  'bg-emerald-900/30 text-emerald-400 border border-emerald-700',
  half_day: 'bg-amber-900/30   text-amber-400   border border-amber-700',
  absent:   'bg-red-900/30     text-red-400     border border-red-700',
};

// ── Connection Settings Panel ─────────────────────────────────────────────────
function ConnectionSettings({ existing, onSaved }) {
  const [f, setF] = useState({
    host:     existing?.host     || '',
    port:     existing?.port     || 1433,
    database: existing?.database || '',
    username: existing?.username || '',
    password: '',
    instance: existing?.instance || '',
    domain:   existing?.domain   || '',
  });
  const [testing,  setTesting]  = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleTest = async () => {
    if (!f.host || !f.database || !f.username || !f.password)
      return toast.error('Fill host, database, username, password first');
    setTesting(true); setTestResult(null);
    try {
      const r = await hrEsslAPI.testConnection(f);
      setTestResult({ ok: true, ...r.data });
      toast.success('Connection successful!');
    } catch (e) {
      setTestResult({ ok: false, error: e.response?.data?.error || e.message });
    } finally { setTesting(false); }
  };

  const handleSave = async () => {
    if (!f.host || !f.database || !f.username || !f.password)
      return toast.error('Fill all required fields');
    setSaving(true);
    try {
      await hrEsslAPI.saveConfig(f);
      toast.success('Connection settings saved');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Server className="w-5 h-5 text-blue-400" />
        <h2 className="text-white font-semibold">ESSL SQL Server Connection</h2>
      </div>

      <div className="bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3 text-sm text-amber-300 space-y-1">
        <p className="font-medium text-amber-200">📌 How ESSL stores data in SQL Server:</p>
        <p>• Table <strong>USERINFO</strong> — employee master (USERID, BADGENUMBER = Emp Code, NAME)</p>
        <p>• Table <strong>CHECKINOUT</strong> — swipe logs (CHECKTIME, CHECKTYPE: I=In / O=Out)</p>
        <p>• Ensure the SQL Server is reachable from this server and credentials have SELECT permission.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">SQL Server Host / IP <span className="text-red-400">*</span></label>
          <input className={inp} value={f.host} onChange={e => s('host', e.target.value)} placeholder="192.168.1.100 or server-name" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Port</label>
          <input type="number" className={inp} value={f.port} onChange={e => s('port', e.target.value)} placeholder="1433" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Database Name <span className="text-red-400">*</span></label>
          <input className={inp} value={f.database} onChange={e => s('database', e.target.value)} placeholder="iclock  or  biotime  or  ESSL" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">SQL Login Username <span className="text-red-400">*</span></label>
          <input className={inp} value={f.username} onChange={e => s('username', e.target.value)} placeholder="sa" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Password <span className="text-red-400">*</span></label>
          <input type="password" className={inp} value={f.password} onChange={e => s('password', e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Instance Name <span className="text-slate-500">(optional)</span></label>
          <input className={inp} value={f.instance} onChange={e => s('instance', e.target.value)} placeholder="SQLEXPRESS" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Windows Domain <span className="text-slate-500">(optional)</span></label>
          <input className={inp} value={f.domain} onChange={e => s('domain', e.target.value)} placeholder="WORKGROUP" />
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`rounded-lg px-4 py-3 text-sm ${testResult.ok ? 'bg-emerald-900/20 border border-emerald-700' : 'bg-red-900/20 border border-red-700'}`}>
          {testResult.ok ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <CheckCircle className="w-4 h-4" /> Connected to {testResult.database}
              </div>
              {testResult.tables?.length > 0 && (
                <div className="text-emerald-300 text-xs space-y-1">
                  {testResult.tables.map(t => (
                    <div key={t}>• <strong>{t}</strong> — {testResult.counts?.[t]?.toLocaleString()} records</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-4 h-4" />
              <span>{testResult.error}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={handleTest} disabled={testing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">
          {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          Test Connection
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ── Sync Panel ────────────────────────────────────────────────────────────────
function SyncPanel({ lastSync }) {
  const [from,    setFrom]    = useState(firstOfMonth);
  const [to,      setTo]      = useState(today);
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState('idle'); // idle | previewing | syncing | done

  const handlePreview = async () => {
    setLoading(true); setPreview(null); setStep('previewing');
    try {
      const r = await hrEsslAPI.preview(from, to);
      setPreview(r.data);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Preview failed');
      setStep('idle');
    } finally { setLoading(false); }
  };

  const handleSync = async () => {
    setLoading(true); setResult(null); setStep('syncing');
    try {
      const r = await hrEsslAPI.sync(from, to);
      setResult(r.data);
      setStep('done');
      toast.success(`Synced ${r.data.synced} attendance records`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Sync failed');
      setStep('idle');
    } finally { setLoading(false); }
  };

  const reset = () => { setPreview(null); setResult(null); setStep('idle'); };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-400" />
          <h2 className="text-white font-semibold">Fetch Attendance from ESSL</h2>
        </div>
        {lastSync && (
          <span className="text-xs text-slate-400">Last sync: {new Date(lastSync).toLocaleString('en-IN')}</span>
        )}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-xs text-slate-400 block mb-1">From Date</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">To Date</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
        </div>
        <div className="flex items-end gap-2 pb-0.5">
          {/* Quick range buttons */}
          {[
            { label: 'Today',     f: today,          t: today },
            { label: 'This Week', f: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0]; })(), t: today },
            { label: 'This Month', f: firstOfMonth,  t: today },
          ].map(q => (
            <button key={q.label} onClick={() => { setFrom(q.f); setTo(q.t); }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg">
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={handlePreview} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">
          {loading && step === 'previewing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Preview Swipes
        </button>
        <button onClick={handleSync} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">
          {loading && step === 'syncing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Sync to Attendance
        </button>
        {(preview || result) && (
          <button onClick={reset} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">
            Clear
          </button>
        )}
      </div>

      {/* Preview table */}
      {preview && (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">
            Showing <span className="text-white font-medium">{preview.total}</span> raw swipe records from ESSL
            {preview.total === 200 && <span className="text-amber-400"> (limited to 200 — run Sync to process all)</span>}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-700/60">
                  <th className="px-3 py-2 text-left text-slate-300">Emp Code</th>
                  <th className="px-3 py-2 text-left text-slate-300">Name</th>
                  <th className="px-3 py-2 text-left text-slate-300">Swipe Time</th>
                  <th className="px-3 py-2 text-left text-slate-300">Type</th>
                  <th className="px-3 py-2 text-left text-slate-300">Device</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.map((r, i) => (
                  <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-3 py-2 text-white font-mono">{r.emp_code}</td>
                    <td className="px-3 py-2 text-slate-300">{r.emp_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-300">{r.swipe_time || '—'}</td>
                    <td className="px-3 py-2">
                      {(() => {
                        const d = String(r.direction || r.check_type || '').trim().toLowerCase();
                        const isIn = d === 'in' || d === 'i' || d === '0';
                        return (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${isIn ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                            {isIn ? '▶ IN' : '◀ OUT'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.device_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sync result */}
      {result && step === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle className="w-5 h-5" /> Sync Complete
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Raw Swipes"    value={result.raw_swipes}    color="text-white" />
            <StatCard label="Days Processed" value={result.employee_days} color="text-blue-400" />
            <StatCard label="Synced"         value={result.synced}        color="text-emerald-400" />
            <StatCard label="Skipped"        value={result.skipped}       color="text-amber-400" />
          </div>
          {result.table_used && (
            <p className="text-xs text-slate-500">Source table: <span className="text-slate-300">{result.table_used}</span></p>
          )}
          {result.not_found?.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3">
              <p className="text-amber-300 text-sm font-medium mb-1">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                {result.not_found.length} ESSL employee code(s) not found in ERP:
              </p>
              <p className="text-amber-400 text-xs font-mono">{result.not_found.join(', ')}</p>
              <p className="text-amber-500 text-xs mt-1">
                Ensure these employee codes match exactly in HR → Employees.
              </p>
            </div>
          )}
          {result.errors?.length > 0 && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
              <p className="text-red-400 text-sm font-medium mb-1">{result.errors.length} DB errors:</p>
              {result.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-red-300 text-xs">{e.emp} / {e.date}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value ?? '—'}</div>
      <div className="text-slate-400 text-xs mt-1">{label}</div>
    </div>
  );
}

// ── Unmatched employees panel ─────────────────────────────────────────────────
function UnmatchedPanel() {
  const [show, setShow] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await hrEsslAPI.unmatched();
      setData(r.data);
      setShow(true);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load');
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          <h2 className="text-white font-semibold">Unmatched ESSL Employees</h2>
          <span className="text-xs text-slate-400">— ESSL employees whose codes don't exist in ERP</span>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          Check
        </button>
      </div>

      {show && data && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-slate-400">
            <span className="text-white font-medium">{data.total}</span> unmatched of {data.essl_total} ESSL employees
          </p>
          {data.data.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4" /> All ESSL employees are matched in ERP
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-700/60">
                    <th className="px-3 py-2 text-left text-slate-300">ESSL Emp Code</th>
                    <th className="px-3 py-2 text-left text-slate-300">ESSL Name</th>
                    <th className="px-3 py-2 text-left text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((e, i) => (
                    <tr key={i} className="border-t border-slate-700/50">
                      <td className="px-3 py-2 text-amber-400 font-mono">{e.emp_code}</td>
                      <td className="px-3 py-2 text-slate-300">{e.emp_name}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">
                        Add this emp code to the employee in HR → Employees
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ESSLSyncPage() {
  const qc = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);

  const { data: cfgData, refetch } = useQuery({
    queryKey: ['essl-config'],
    queryFn: () => hrEsslAPI.getConfig().then(r => r.data.data),
  });

  const cfg = cfgData;
  const isConfigured = !!cfg?.host;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-600/20 rounded-lg">
            <Fingerprint className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">ESSL Biometric Sync</h1>
            <p className="text-sm text-slate-400">Pull attendance data from ESSL device via Microsoft SQL Server</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Wifi className="w-4 h-4" />
              <span>Configured: <strong>{cfg.host}</strong> / {cfg.database}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <WifiOff className="w-4 h-4" /> Not configured
            </div>
          )}
          <button onClick={() => setShowSettings(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
            <Settings className="w-4 h-4" />
            {showSettings ? 'Hide Settings' : 'Connection Settings'}
          </button>
        </div>
      </div>

      {/* Connection settings (collapsible) */}
      {(showSettings || !isConfigured) && (
        <ConnectionSettings
          existing={cfg}
          onSaved={() => { refetch(); setShowSettings(false); }}
        />
      )}

      {/* Sync panel — only if configured */}
      {isConfigured ? (
        <>
          <SyncPanel lastSync={cfg.last_sync} />
          <UnmatchedPanel />
        </>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <Fingerprint className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">Configure the SQL Server connection above to start syncing attendance.</p>
        </div>
      )}
    </div>
  );
}
