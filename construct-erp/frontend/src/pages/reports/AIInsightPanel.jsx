// src/pages/reports/AIInsightPanel.jsx
import React, { useState, useEffect } from 'react';
import { 
  Cpu, Sparkles, TrendingUp, TrendingDown, 
  AlertCircle, CheckCircle2, Zap, 
  Terminal, BarChart3, Info
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIInsightPanel({ data }) {
  const [analyzing, setAnalyzing] = useState(true);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    // Artificial Intelligence "Auditing" Simulation
    const timer = setTimeout(() => {
      const generatedInsights = [
        { 
          id: 1, 
          type: 'positive', 
          title: 'Procurement Efficiency', 
          desc: 'Material waste index has dropped by 8.4% this quarter due to optimized inventory issue protocols.',
          icon: Sparkles
        },
        { 
          id: 2, 
          type: 'warning', 
          title: 'Zone B Overrun Risk', 
          desc: 'Projected costs for Zone B structural work are trending 12% above budget based on current RA billing speed.',
          icon: TrendingUp
        },
        { 
          id: 3, 
          type: 'critical', 
          title: 'Quality Bottleneck', 
          desc: 'High concentration of open NCRs in Structural phase. Resolution time is averaging 14 days, exceeding the 7-day target.',
          icon: AlertCircle
        },
        { 
          id: 4, 
          type: 'strategic', 
          title: 'Optimization Tip', 
          desc: 'Consolidating Vendor POs for steel across Projects X and Y could unlock a 5% volume discount.',
          icon: Zap
        }
      ];
      setInsights(generatedInsights);
      setAnalyzing(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm relative">
       {/* Background Tech Decor */}
       <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Cpu size={120} />
       </div>

       <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Cpu className={clsx("w-6 h-6 text-indigo-400", analyzing && "animate-spin")} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight leading-none italic">AI Strategic Auditor</h3>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Real-time Forensic Insights Layer</p>
             </div>
          </div>
          <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
             Active Neural Audit
          </div>
       </div>

       <div className="p-8 space-y-4">
          <AnimatePresence mode="wait">
            {analyzing ? (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center gap-4 text-center"
              >
                 <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                    <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center"><Zap className="text-indigo-400 animate-pulse" /></div>
                 </div>
                 <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic animate-pulse">Running Cross-Module Data Audit...</p>
                    <p className="text-[8px] text-slate-700 font-bold uppercase mt-1">Analyzing: Finance • Quality • Site Progress</p>
                 </div>
              </motion.div>
            ) : (
               <motion.div 
                key="content"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.map((insight, index) => (
                      <div key={insight.id} className="p-6 bg-white border border-slate-200 rounded-3xl group hover:border-indigo-500/30 transition-all shadow-sm">
                         <div className="flex items-start gap-4">
                            <div className={clsx("p-2 rounded-lg border", 
                               insight.type === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                               insight.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                               insight.type === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                               'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                            )}>
                               <insight.icon size={16} />
                            </div>
                            <div className="space-y-1">
                               <h4 className="text-[10px] font-black uppercase text-slate-900 italic tracking-tight">{insight.title}</h4>
                               <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase opacity-80 group-hover:opacity-100 transition-opacity">
                                  {insight.desc}
                               </p>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
                 
                 <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[8px] font-black text-slate-600 uppercase tracking-widest italic">
                       <Info size={10} /> Insights are based on current cross-module trends.
                    </div>
                    <button className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center gap-1 group">
                       View Comprehensive Audit <TrendingUp size={12} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
       </div>
    </div>
  );
}
