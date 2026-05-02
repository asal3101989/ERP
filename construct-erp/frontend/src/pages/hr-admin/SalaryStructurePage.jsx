import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart2, Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { hrSalaryAPI } from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

const DEFAULT_COMPONENTS = [
  { component_name: 'Basic',              component_type: 'earning',    calc_type: 'fixed',         amount: 0,   pct: 0,  is_taxable: true  },
  { component_name: 'HRA',               component_type: 'earning',    calc_type: 'pct_of_basic',  amount: 0,   pct: 40, is_taxable: false },
  { component_name: 'Conveyance',        component_type: 'earning',    calc_type: 'fixed',         amount: 1600,pct: 0,  is_taxable: false },
  { component_name: 'Medical Allowance', component_type: 'earning',    calc_type: 'fixed',         amount: 1250,pct: 0,  is_taxable: false },
  { component_name: 'Special Allowance', component_type: 'earning',    calc_type: 'fixed',         amount: 0,   pct: 0,  is_taxable: true  },
  { component_name: 'PF Employee',       component_type: 'statutory',  calc_type: 'pct_of_basic',  amount: 0,   pct: 12, is_taxable: false },
  { component_name: 'ESI Employee',      component_type: 'statutory',  calc_type: 'pct_of_gross',  amount: 0,   pct: 0.75, is_taxable: false },
  { component_name: 'Professional Tax',  component_type: 'statutory',  calc_type: 'fixed',         amount: 200, pct: 0,  is_taxable: false },
  { component_name: 'TDS',               component_type: 'deduction',  calc_type: 'fixed',         amount: 0,   pct: 0,  is_taxable: false },
];

function StructureModal({ structure, onClose, onSave }) {
  const [name, setName] = useState(structure?.name || '');
  const [components, setComponents] = useState(
    structure?.components?.length ? structure.components : DEFAULT_COMPONENTS.map(c => ({ ...c }))
  );

  const updateComp = (i, k, v) => {
    setComponents(prev => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  };
  const addComp = () => setComponents(prev => [...prev, { component_name: '', component_type: 'earning', calc_type: 'fixed', amount: 0, pct: 0, is_taxable: true }]);
  const removeComp = (i) => setComponents(prev => prev.filter((_, idx) => idx !== i));

  const TYPE_COLOR = { earning: 'text-emerald-400', deduction: 'text-red-400', statutory: 'text-amber-400' };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-white text-lg mb-4">{structure ? 'Edit' : 'New'} Salary Structure</h2>
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1">Structure Name</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Staff Grade A" />
        </div>

        <h3 className="text-sm font-semibold text-slate-400 mb-2">Components</h3>
        <div className="space-y-2 mb-4">
          {components.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center text-sm">
              <input className="col-span-3 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-xs" value={c.component_name} onChange={e => updateComp(i,'component_name',e.target.value)} placeholder="Component Name" />
              <select className="col-span-2 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs" value={c.component_type} onChange={e => updateComp(i,'component_type',e.target.value)}>
                <option value="earning">Earning</option>
                <option value="deduction">Deduction</option>
                <option value="statutory">Statutory</option>
              </select>
              <select className="col-span-2 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs" value={c.calc_type} onChange={e => updateComp(i,'calc_type',e.target.value)}>
                <option value="fixed">Fixed ₹</option>
                <option value="pct_of_basic">% of Basic</option>
                <option value="pct_of_gross">% of Gross</option>
              </select>
              {c.calc_type === 'fixed' ? (
                <input className="col-span-2 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-xs" type="number" value={c.amount} onChange={e => updateComp(i,'amount',e.target.value)} placeholder="Amount ₹" />
              ) : (
                <input className="col-span-2 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-xs" type="number" value={c.pct} onChange={e => updateComp(i,'pct',e.target.value)} placeholder="%" />
              )}
              <label className="col-span-2 flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={c.is_taxable} onChange={e => updateComp(i,'is_taxable',e.target.checked)} className="rounded" />
                Taxable
              </label>
              <button onClick={() => removeComp(i)} className="col-span-1 text-slate-500 hover:text-red-400 transition-colors flex justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addComp} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-4">
          <Plus className="w-4 h-4" /> Add Component
        </button>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
          <button onClick={() => name && onSave({ name, components })} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">Save Structure</button>
        </div>
      </div>
    </div>
  );
}

export default function SalaryStructurePage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [expanded, setExpanded] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['hr-salary-structures'],
    queryFn: () => hrSalaryAPI.listStructures().then(r => r.data),
  });
  const structures = data?.data || [];

  const saveMut = useMutation({
    mutationFn: (d) => modal?.id ? hrSalaryAPI.updateStructure(modal.id, d) : hrSalaryAPI.createStructure(d),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['hr-salary-structures'] }); setModal(null); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const TYPE_COLOR = { earning: 'text-emerald-400', deduction: 'text-red-400', statutory: 'text-amber-400' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg"><BarChart2 className="w-6 h-6 text-blue-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Salary Structures</h1>
            <p className="text-sm text-slate-400">Define CTC components for different employee grades</p>
          </div>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Structure
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {structures.map(s => (
            <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-750" onClick={() => toggle(s.id)}>
                <div className="flex items-center gap-3">
                  {expanded[s.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-semibold text-white">{s.name}</span>
                  <span className="text-slate-500 text-sm">({(s.components||[]).length} components)</span>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setModal(s)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {expanded[s.id] && s.components && (
                <div className="border-t border-slate-700 p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {['Component','Type','Calculation','Taxable'].map(h => (
                          <th key={h} className="text-left py-2 text-slate-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.components.map((c, i) => (
                        <tr key={i} className="border-b border-slate-700/30">
                          <td className="py-2 text-slate-200">{c.component_name}</td>
                          <td className={`py-2 capitalize font-medium ${TYPE_COLOR[c.component_type] || 'text-slate-400'}`}>{c.component_type}</td>
                          <td className="py-2 text-slate-400">
                            {c.calc_type === 'fixed' ? `₹${parseFloat(c.amount).toLocaleString('en-IN')} fixed` :
                             c.calc_type === 'pct_of_basic' ? `${c.pct}% of Basic` :
                             `${c.pct}% of Gross`}
                          </td>
                          <td className="py-2">{c.is_taxable ? <span className="text-red-400">Yes</span> : <span className="text-emerald-400">No</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {structures.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No salary structures yet. Create your first structure.</p>
            </div>
          )}
        </div>
      )}

      {modal !== null && (
        <StructureModal
          structure={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(d) => saveMut.mutate(d)}
        />
      )}
    </div>
  );
}
