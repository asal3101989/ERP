import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Building2, TrendingUp } from 'lucide-react';
import { analyticsAPI, projectAPI, reportAPI } from '../../api/client';
import FinanceActionBar from '../../components/finance/FinanceActionBar';

const inr = v => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const asArray = v => (Array.isArray(v) ? v : []);

function Card({ label, value, sub, accent = 'indigo' }) {
  const colors = {
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
  };

  return (
    <div className={`rounded-[1.4rem] border p-4 shadow-sm bg-white ${colors[accent] || colors.indigo}`}>
      <div className="text-[8px] font-black uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1.5 text-[1.35rem] font-black font-mono tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] opacity-60">{sub}</div>}
    </div>
  );
}

function Metric({ label, value, sub, tone = 'indigo' }) {
  const tones = {
    indigo: 'border-indigo-100 text-indigo-700 bg-indigo-50',
    emerald: 'border-emerald-100 text-emerald-700 bg-emerald-50',
    amber: 'border-amber-100 text-amber-700 bg-amber-50',
    rose: 'border-rose-100 text-rose-700 bg-rose-50',
    slate: 'border-slate-200 text-slate-700 bg-slate-50',
  };

  return (
    <div className={`rounded-2xl border p-3.5 ${tones[tone] || tones.slate}`}>
      <div className="text-[8px] font-black uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1.5 text-[1.05rem] font-black font-mono">{value}</div>
      {sub && <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] opacity-60">{sub}</div>}
    </div>
  );
}

export default function ManagementMISPage() {
  const [selectedProject, setSelectedProject] = useState('all');
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));

  const yearStart = `${reportYear}-01-01`;
  const yearEnd = `${reportYear}-12-31`;

  const execParams = useMemo(() => ({
    ...(selectedProject !== 'all' ? { project_id: selectedProject } : {}),
    date_from: yearStart,
    date_to: yearEnd,
  }), [selectedProject, yearStart, yearEnd]);

  const { data: execRes } = useQuery({
    queryKey: ['finance-mis-exec', selectedProject, reportYear],
    queryFn: () => analyticsAPI.executive(execParams).then(r => r.data).catch(() => ({ data: {} })),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['finance-mis-projects'],
    queryFn: () => projectAPI.list().then(r => asArray(r.data?.data || r.data)).catch(() => []),
  });

  const { data: projectPLRes } = useQuery({
    queryKey: ['finance-mis-pl', selectedProject],
    queryFn: () => reportAPI.projectPL(selectedProject !== 'all' ? { project_id: selectedProject } : {}).then(r => r.data).catch(() => ({ data: [] })),
  });

  const { data: profitabilityRes } = useQuery({
    queryKey: ['finance-mis-profit', selectedProject],
    queryFn: () => reportAPI.profitability(selectedProject !== 'all' ? { project_id: selectedProject } : {}).then(r => r.data).catch(() => ({ data: [] })),
  });

  const { data: gstRes } = useQuery({
    queryKey: ['finance-mis-gst', reportYear],
    queryFn: () => reportAPI.gstReport({ year: reportYear }).then(r => r.data).catch(() => ({ output: [] })),
  });

  const { data: tdsRes } = useQuery({
    queryKey: ['finance-mis-tds', reportYear],
    queryFn: () => reportAPI.tdsReport({ year: reportYear }).then(r => r.data).catch(() => ({ data: [] })),
  });

  const exec = execRes?.data || {};
  const projectPL = asArray(projectPLRes?.data || projectPLRes);
  const profitability = asArray(profitabilityRes?.data || profitabilityRes);
  const gst = asArray(gstRes?.output || gstRes?.data || gstRes);
  const tds = asArray(tdsRes?.data || tdsRes);

  const totalContract = projectPL.reduce((s, r) => s + Number(r.contract_value || 0), 0);
  const totalNetBilled = projectPL.reduce((s, r) => s + Number(r.net_billed || 0), 0);
  const totalMargin = projectPL.reduce((s, r) => s + Number(r.gross_margin || 0), 0);
  const totalRevenue = projectPL.reduce((s, r) => s + Number(r.received_from_client || r.received || 0), 0);
  const totalTDS = tds.reduce((s, r) => s + Number(r.tds_amount || 0), 0);
  const totalGST = gst.reduce((s, r) => s + Number(r.total_gst || 0), 0);

  const projectLabel = selectedProject === 'all'
    ? 'All Projects'
    : (projects.find(p => p.id === selectedProject)?.name || 'Selected Project');

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-[1500px] mx-auto bg-slate-50 min-h-screen text-[0.9rem]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <FileBarChart className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[1.05rem] md:text-[1.25rem] font-black text-slate-900 uppercase tracking-tight italic">Management MIS</h1>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.18em] mt-1">Executive financial summary for review meetings</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <Card label="Contract Value" value={inr(totalContract)} sub={projectLabel} accent="indigo" />
        <Card label="Net Billed" value={inr(totalNetBilled)} sub="RA bills certified" accent="emerald" />
        <Card label="Revenue Collected" value={inr(totalRevenue)} sub="Client receipts" accent="amber" />
        <Card label="Gross Margin" value={inr(totalMargin)} sub="Project P&L" accent="rose" />
        <Card label="GST Output" value={inr(totalGST)} sub={`FY ${reportYear}`} accent="indigo" />
        <Card label="TDS Position" value={inr(totalTDS)} sub={`FY ${reportYear}`} accent="emerald" />
      </div>

      <FinanceActionBar
        data={projectPL}
        fileName="Management_MIS"
        projectId={selectedProject}
        onProjectChange={setSelectedProject}
        projectOptions={projects}
        showSearch={false}
        showDateRange={false}
        compact
        onReset={() => {
          setSelectedProject('all');
          setReportYear(String(new Date().getFullYear()));
        }}
        extraControls={
          <select
            value={reportYear}
            onChange={e => setReportYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-[9px] font-black uppercase tracking-widest outline-none"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
        <Metric label="Executive Revenue" value={inr(exec.kpis?.total_collections || exec.global?.revenue || 0)} sub="From analytics payload" tone="indigo" />
        <Metric label="Safety Score" value={Math.round(exec.kpis?.safety_score || exec.global?.safety_score || 0)} sub="Company-wide" tone="emerald" />
        <Metric label="Quality Score" value={Math.round(exec.kpis?.quality_score || exec.global?.quality_score || 0)} sub="RFI / NCR health" tone="amber" />
        <Metric label="Active Projects" value={exec.kpis?.active_projects ?? exec.global?.project_count ?? 0} sub="Current working set" tone="rose" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-[0.8rem] text-slate-900 uppercase tracking-tight">Project P&L</h2>
              <p className="text-[9px] text-slate-500 mt-1">Margin and billing status by project</p>
            </div>
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Project', 'Contract', 'Net Billed', 'Margin', '% Billed'].map(h => (
                    <th key={h} className="px-3 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectPL.slice(0, 8).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-bold text-slate-900 text-[11px]">{p.project_name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-700 text-[11px]">{inr(p.contract_value)}</td>
                    <td className="px-3 py-2 font-mono text-slate-900 font-black text-[11px]">{inr(p.net_billed)}</td>
                    <td className={`px-3 py-2 font-mono font-black text-[11px] ${Number(p.gross_margin || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{inr(p.gross_margin)}</td>
                    <td className="px-3 py-2 text-slate-600 font-bold text-[11px]">{p.pct_billed || 0}%</td>
                  </tr>
                ))}
                {!projectPL.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                      No project profitability data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-[0.8rem] text-slate-900 uppercase tracking-tight">Financial Indicators</h2>
              <p className="text-[9px] text-slate-500 mt-1">TDS, GST and profitability snapshots</p>
            </div>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="p-3.5 space-y-2.5">
            <Metric
              label="Executive Payload"
              value={inr(exec.kpis?.total_contract_value || exec.global?.certified || totalContract)}
              sub="Live analytics summary"
              tone="slate"
            />
            <Metric
              label="GST Summary Rows"
              value={gst.length}
              sub={`FY ${reportYear}`}
              tone="indigo"
            />
            <Metric
              label="TDS Summary Rows"
              value={tds.length}
              sub={`FY ${reportYear}`}
              tone="emerald"
            />
            <Metric
              label="Profitability Rows"
              value={profitability.length}
              sub={selectedProject === 'all' ? 'All projects' : projectLabel}
              tone="amber"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
