// src/pages/reports/DepartmentalReportView.jsx
import React from 'react';
import { 
  TrendingUp, TrendingDown, Users, Package, 
  ShieldCheck, AlertTriangle, DollarSign, 
  Clock, BarChart3, Activity, PieChart,
  HardHat, Warehouse, ShoppingCart, 
  ArrowUpRight, ArrowDownRight, Globe
} from 'lucide-react';
import { clsx } from 'clsx';

const inr = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN')}`;

export default function DepartmentalReportView({ type, data }) {
  // ── MOCK DATA GENERATOR FOR VISUALS ──
  const getDepartmentalKPIs = () => {
    switch (type) {
      case 'hr':
        return [
          { label: 'Workforce Strength', val: '482', sub: '320 Skilled · 162 Helper', icon: Users, color: 'text-blue-500' },
          { label: 'Attendance (Current)', val: '94.2%', sub: 'Avg last 7 days', icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Monthly Wage Liability', val: inr(4820000), sub: 'Due in 4 days', icon: DollarSign, color: 'text-indigo-500' },
          { label: 'OT Burn Rate', val: '12.4%', sub: 'Trend: +2.1% (Zone B)', icon: Activity, color: 'text-amber-500' }
        ];
      case 'procurement':
        return [
          { label: 'Total PO Commitment', val: inr(124000000), sub: 'Active POs: 48', icon: ShoppingCart, color: 'text-indigo-500' },
          { label: 'Vendor Compliance', val: '88%', sub: 'Lead-time adherence', icon: ShieldCheck, color: 'text-emerald-500' },
          { label: 'Savings vs Budget', val: inr(840000), sub: 'Negotiation wins (Q2)', icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Critical Deliveries', val: '05', sub: 'High risk items', icon: AlertTriangle, color: 'text-red-500' }
        ];
      case 'stores':
        return [
          { label: 'Closing Stock Value', val: inr(8420000), sub: 'Pan-Site Godowns', icon: Warehouse, color: 'text-amber-500' },
          { label: 'Stock Ageing (>90d)', val: 'INR 1.2L', sub: 'Dead-stock risk', icon: Clock, color: 'text-red-400' },
          { label: 'MIN Frequency', val: '14/day', sub: 'Avg material issues', icon: Activity, color: 'text-blue-500' },
          { label: 'Reorder Alerts', val: '08', sub: 'Below safety levels', icon: AlertCircle, color: 'text-orange-500' }
        ];
      case 'quality':
        return [
          { label: 'ITP Pass Rate', val: '98.4%', sub: 'Certified work', icon: ShieldCheck, color: 'text-emerald-500' },
          { label: 'Open NCRs', val: '12', sub: 'Severity: Medium', icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Resolution Speed', val: '4.2 days', sub: 'Trend: Optimizing', icon: TrendingUp, color: 'text-indigo-500' },
          { label: 'Lab Test Compliance', val: '100%', sub: 'ISO standards met', icon: Activity, color: 'text-blue-500' }
        ];
      case 'hse':
        return [
           { label: 'Safe Man-Hours', val: '24,800', sub: 'Last Incident: 142 days', icon: ShieldCheck, color: 'text-emerald-500' },
           { label: 'Permit Compliance', val: '96%', sub: 'PTW Audit Score', icon: ClipboardCheck, color: 'text-blue-500' },
           { label: 'Near Misses (30d)', val: '02', sub: 'Zone B Excavation', icon: AlertCircle, color: 'text-amber-500' },
           { label: 'PPE Compliance', val: '99%', sub: 'Field Audit (Q1)', icon: HardHat, color: 'text-indigo-500' }
        ];
      case 'finance':
        return [
           { label: 'Cumulative Revenue', val: inr(284000000), sub: 'Project Order Book', icon: DollarSign, color: 'text-indigo-500' },
           { label: 'Realized Margin', val: '18.4%', sub: 'Avg Gross Profit', icon: TrendingUp, color: 'text-emerald-500' },
           { label: 'GST Liability (Cash)', val: inr(1240000), sub: 'Due: 20th Apr', icon: Activity, color: 'text-red-400' },
           { label: 'Total Spend (YTD)', val: inr(156000000), sub: 'Budget Utilization: 62%', icon: Wallet, color: 'text-blue-500' }
        ];
      default:
        return [];
    }
  };

  const kpis = getDepartmentalKPIs();

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
       {/* Departmental KPI Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((k, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-4 hover:border-indigo-500/20 transition-all group shadow-sm">
               <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100", k.color)}>
                  <k.icon size={24} />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{k.label}</p>
                  <h4 className="text-3xl font-black text-slate-900 italic tracking-tighter">{k.val}</h4>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tight">{k.sub}</p>
               </div>
            </div>
          ))}
       </div>

       {/* Secondary Data Layer: Interactive Trends */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[3rem] p-10 space-y-8 relative overflow-hidden shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight leading-none italic">Forensic Trend Analysis</h3>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Cross-Module Data Correlation</p>
                  </div>
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[9px] font-black text-emerald-500 uppercase italic tracking-widest">Live Feed active</span>
                </div>
             </div>

             <div className="h-[300px] flex items-end justify-between gap-4 px-4 pb-4">
                {[45, 60, 55, 80, 75, 95, 90, 85, 70, 75, 80, 100].map((v, i) => (
                  <div key={i} className="flex-1 group relative">
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 text-white text-[8px] font-black px-2 py-1 rounded-md mb-2">
                        {v}%
                     </div>
                     <div 
                       className="w-full bg-indigo-500/10 border-t-2 border-indigo-500/40 rounded-t-lg transition-all hover:bg-indigo-600 hover:scale-105" 
                       style={{ height: `${v}%` }} 
                     />
                  </div>
                ))}
             </div>
             
             <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest px-8">
                {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].map(m => <span key={m}>{m}</span>)}
             </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[3rem] p-10 space-y-8 flex flex-col justify-between overflow-hidden relative shadow-sm">
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <PieChart size={120} />
             </div>
             <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 italic">Operating Efficiency</h3>
                <div className="space-y-6">
                   {[
                     { label: 'Strategic Alignment', val: 92, color: 'bg-emerald-500' },
                     { label: 'Cost Optimized', val: 78, color: 'bg-indigo-500' },
                     { label: 'Time Adherence', val: 84, color: 'bg-amber-500' }
                   ].map((item, i) => (
                     <div key={i} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-slate-900 uppercase italic">
                           <span>{item.label}</span>
                           <span>{item.val}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                           <div className={clsx("h-full transition-all duration-1000", item.color)} style={{ width: `${item.val}%` }} />
                        </div>
                     </div>
                   ))}
                </div>
             </div>

             <button className="w-full py-4 bg-slate-50 border border-slate-200 text-[10px] font-black uppercase text-slate-700 hover:bg-slate-100 transition-all rounded-2xl tracking-widest flex items-center justify-center gap-2 italic uppercase">
                Download Analysis Pack <ChevronRight size={14} />
             </button>
          </div>
       </div>
    </div>
  );
}

// ── LOCAL HELPER COMPONENTS ──
function CheckCircle2(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg> }
function AlertCircle(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg> }
function ChevronRight(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg> }
function ClipboardCheck(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg> }
function Wallet(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg> }
