// src/pages/hr-admin/HRImportPage.jsx
// Import employees & attendance from Greythr CSV exports
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Users, Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react';
import { hrImportAPI } from '../../api/client';
import toast from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const TABS = [
  { id: 'employees',  label: 'Staff / Employees',  icon: Users },
  { id: 'attendance', label: 'Attendance',          icon: Clock },
];

// ── sample CSV download links ────────────────────────────────────────────────
const EMPLOYEE_SAMPLE = `Employee Code,Employee Name,Email,Mobile,Department,Designation,Date of Joining,Date of Birth,Gender,PAN,UAN,Bank Account No,IFSC Code,Bank Name,Employment Type,Status,CTC
EMP001,Ravi Kumar,ravi@company.com,9876543210,Engineering,Site Engineer,01-04-2023,15-06-1990,male,ABCDE1234F,100234567890,123456789012,SBIN0001234,SBI,permanent,active,600000
EMP002,Priya Sharma,priya@company.com,9876543211,HR,HR Manager,15-06-2022,20-09-1988,female,XYZAB5678G,100234567891,987654321098,HDFC0002345,HDFC Bank,permanent,active,720000`;

const ATTENDANCE_WIDE_SAMPLE = `Employee Code,Employee Name,01,02,03,04,05,06,07,08,09,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31
EMP001,Ravi Kumar,P,P,P,P,P,WO,WO,P,P,P,P,P,WO,WO,P,P,P,P,P,WO,WO,P,P,P,P,P,WO,WO,P,P,P
EMP002,Priya Sharma,P,P,A,P,P,WO,WO,P,P,P,P,H,WO,WO,P,P,P,P,P,WO,WO,P,P,P,P,P,WO,WO,P,P,P`;

function downloadSample(content, filename) {
  const blob = new URL(`data:text/csv;charset=utf-8,${encodeURIComponent(content)}`);
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Dropzone component ────────────────────────────────────────────────────────
function FileDropzone({ onFile, file, accept = '.csv' }) {
  const onDrop = useCallback(accepted => { if (accepted[0]) onFile(accepted[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-blue-400 bg-blue-900/20' : 'border-slate-600 hover:border-slate-400 bg-slate-800/50'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
      {file ? (
        <div>
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium">
            <FileText className="w-4 h-4" /> {file.name}
          </div>
          <p className="text-slate-500 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB · Click or drag to replace</p>
        </div>
      ) : (
        <div>
          <p className="text-white font-medium">Drop your Greythr CSV here</p>
          <p className="text-slate-400 text-sm mt-1">or click to browse — CSV files only, max 10 MB</p>
        </div>
      )}
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────────
function PreviewTable({ data }) {
  if (!data) return null;
  const cols = data.columns.slice(0, 8); // show max 8 cols in preview
  const extra = data.columns.length - 8;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <span className="text-white font-medium text-sm">Preview — {data.total} rows detected</span>
        {extra > 0 && <span className="text-slate-400 text-xs">+{extra} more columns not shown</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-700/50">
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-left text-slate-300 font-medium whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.preview.map((row, i) => (
              <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                {cols.map(c => (
                  <td key={c} className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[120px] truncate">{row[c] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Result summary ────────────────────────────────────────────────────────────
function ResultSummary({ result }) {
  const [showErrors, setShowErrors] = useState(false);
  if (!result) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {result.created !== undefined && (
          <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{result.created}</div>
            <div className="text-emerald-300 text-xs mt-1">Created</div>
          </div>
        )}
        {result.inserted !== undefined && (
          <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{result.inserted}</div>
            <div className="text-emerald-300 text-xs mt-1">Inserted</div>
          </div>
        )}
        <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{result.updated}</div>
          <div className="text-blue-300 text-xs mt-1">Updated</div>
        </div>
        <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{result.skipped}</div>
          <div className="text-amber-300 text-xs mt-1">Skipped</div>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{result.errors?.length || 0}</div>
          <div className="text-red-300 text-xs mt-1">Errors</div>
        </div>
      </div>

      {result.format && (
        <div className="text-xs text-slate-400 bg-slate-700/30 rounded-lg px-3 py-2">
          Detected format: <span className="text-white font-medium">{result.format}</span>
        </div>
      )}

      {result.errors?.length > 0 && (
        <div className="bg-red-900/10 border border-red-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowErrors(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-red-400 text-sm font-medium hover:bg-red-900/10"
          >
            <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> {result.errors.length} row error(s)</span>
            {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showErrors && (
            <div className="border-t border-red-800 max-h-48 overflow-y-auto">
              {result.errors.map((e, i) => (
                <div key={i} className="px-4 py-2 text-xs text-red-300 border-b border-red-900/40">
                  <span className="text-red-400 font-medium">Row {e.row}:</span> {e.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Employee Import Tab ───────────────────────────────────────────────────────
function EmployeeImportTab() {
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [mode,    setMode]    = useState('create');
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState('upload'); // upload | preview | done

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const r = await hrImportAPI.previewEmployees(file);
      setPreview(r.data);
      setStep('preview');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to parse CSV');
    } finally { setLoading(false); }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const r = await hrImportAPI.importEmployees(file, mode);
      setResult(r.data);
      setStep('done');
      const { created = 0, updated = 0 } = r.data;
      toast.success(`Import done — ${created} created, ${updated} updated`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally { setLoading(false); }
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setStep('upload'); };

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4 text-sm text-blue-300 space-y-1">
        <p className="font-medium text-blue-200">How to export from Greythr:</p>
        <p>1. Greythr → <strong>HR</strong> → <strong>Employee</strong> → <strong>Export</strong> → Download CSV</p>
        <p>2. Upload the CSV below. We auto-map all standard Greythr columns.</p>
        <p>3. <strong>Create mode</strong> → new employees are created (default password = employee code).</p>
        <p>4. <strong>Update mode</strong> → only updates profiles for existing employees.</p>
      </div>

      {/* Sample download */}
      <button onClick={() => downloadSample(EMPLOYEE_SAMPLE, 'greythr-employee-sample.csv')}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
        <Download className="w-3.5 h-3.5" /> Download sample CSV format
      </button>

      {/* File drop */}
      <FileDropzone file={file} onFile={f => { setFile(f); setPreview(null); setResult(null); setStep('upload'); }} />

      {/* Mode selector */}
      <div className="flex items-center gap-4">
        <span className="text-slate-400 text-sm">Import mode:</span>
        {[['create', 'Create new + update existing'], ['update', 'Update existing only']].map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)}
              className="accent-blue-500" />
            <span className="text-sm text-slate-300">{label}</span>
          </label>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {step === 'upload' && (
          <button onClick={handlePreview} disabled={!file || loading}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Preview CSV
          </button>
        )}
        {step === 'preview' && (
          <>
            <button onClick={handleImport} disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {preview?.total} Employees
            </button>
            <button onClick={reset} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
              Cancel
            </button>
          </>
        )}
        {step === 'done' && (
          <button onClick={reset}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Import Another File
          </button>
        )}
      </div>

      {/* Preview */}
      {step === 'preview' && preview && <PreviewTable data={preview} />}

      {/* Result */}
      {step === 'done' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle className="w-5 h-5" /> Import Complete
          </div>
          <ResultSummary result={result} />
        </div>
      )}
    </div>
  );
}

// ── Attendance Import Tab ─────────────────────────────────────────────────────
function AttendanceImportTab() {
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [month,   setMonth]   = useState(currentMonth);
  const [year,    setYear]    = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState('upload');

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const r = await hrImportAPI.previewAttendance(file);
      setPreview(r.data);
      setStep('preview');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to parse CSV');
    } finally { setLoading(false); }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const r = await hrImportAPI.importAttendance(file, month, year);
      setResult(r.data);
      setStep('done');
      const { inserted = 0, updated = 0 } = r.data;
      toast.success(`Import done — ${inserted} inserted, ${updated} updated`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally { setLoading(false); }
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setStep('upload'); };

  // detect if wide format from preview columns
  const isWide = preview?.columns?.some(c => /^(0?[1-9]|[12]\d|3[01])$/.test(c.trim()));

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4 text-sm text-blue-300 space-y-1">
        <p className="font-medium text-blue-200">How to export attendance from Greythr:</p>
        <p>1. Greythr → <strong>Attendance</strong> → <strong>Reports</strong> → <strong>Monthly Attendance Summary</strong> → Export CSV</p>
        <p>2. We support both Greythr formats:</p>
        <p className="ml-3">• <strong>Wide format</strong> — one row per employee, columns = days (01, 02 … 31)</p>
        <p className="ml-3">• <strong>Long format</strong> — one row per employee per date</p>
        <p>3. Status codes mapped automatically: P=Present, A=Absent, H=Half Day, WO=Week Off, L/PL/CL/SL=Leave, HO=Holiday</p>
      </div>

      {/* Sample download */}
      <button onClick={() => downloadSample(ATTENDANCE_WIDE_SAMPLE, 'greythr-attendance-sample.csv')}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
        <Download className="w-3.5 h-3.5" /> Download sample CSV format (wide)
      </button>

      {/* File drop */}
      <FileDropzone file={file} onFile={f => { setFile(f); setPreview(null); setResult(null); setStep('upload'); }} />

      {/* Month/Year — only relevant for wide format */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm">Attendance month:</span>
        <select value={month} onChange={e => setMonth(+e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-slate-500 text-xs">(used for wide/grid format only)</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {step === 'upload' && (
          <button onClick={handlePreview} disabled={!file || loading}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Preview CSV
          </button>
        )}
        {step === 'preview' && (
          <>
            <button onClick={handleImport} disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {preview?.total} Rows
            </button>
            <button onClick={reset} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
              Cancel
            </button>
          </>
        )}
        {step === 'done' && (
          <button onClick={reset}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Import Another File
          </button>
        )}
      </div>

      {/* Format badge after preview */}
      {step === 'preview' && preview && (
        <div className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-medium ${
          isWide ? 'bg-violet-900/30 text-violet-300 border border-violet-700' : 'bg-teal-900/30 text-teal-300 border border-teal-700'
        }`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          Detected: {isWide ? 'Wide format (monthly grid)' : 'Long format (daily rows)'}
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && preview && <PreviewTable data={preview} />}

      {/* Result */}
      {step === 'done' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle className="w-5 h-5" /> Import Complete
          </div>
          <ResultSummary result={result} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HRImportPage() {
  const [activeTab, setActiveTab] = useState('employees');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 rounded-lg"><Upload className="w-6 h-6 text-blue-400" /></div>
        <div>
          <h1 className="text-2xl font-bold text-white">Import from Greythr</h1>
          <p className="text-sm text-slate-400">Upload Greythr CSV exports to sync employees & attendance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        {activeTab === 'employees'  && <EmployeeImportTab />}
        {activeTab === 'attendance' && <AttendanceImportTab />}
      </div>
    </div>
  );
}
