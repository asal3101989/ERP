// src/pages/qs/ConsumptionNormsPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Trash2, Library, Info, ChevronRight, 
  Layers, Package, AlertCircle, Save, X
} from 'lucide-react';
import { normsAPI, projectAPI, boqAPI } from '../../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function ConsumptionNormsPage() {
  const qc = useQueryClient();
  const [activeProject, setActiveProject] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedBoqItem, setSelectedBoqItem] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(r => r.data.data),
  });

  const { data: boqItems } = useQuery({
    queryKey: ['boq', activeProject],
    queryFn: () => boqAPI.list({ project_id: activeProject }).then(r => r.data.data),
    enabled: !!activeProject,
  });

  const { data: norms, isLoading } = useQuery({
    queryKey: ['norms'],
    queryFn: () => normsAPI.list().then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => normsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['norms']);
      toast.success('Norm removed');
    },
  });

  // Group norms by BOQ item
  const groupedNorms = (norms || []).reduce((acc, n) => {
    if (!acc[n.boq_item_id]) acc[n.boq_item_id] = [];
    acc[n.boq_item_id].push(n);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Consumption Norms</h1>
          <p className="text-slate-400 mt-1">Define theoretical material ratios for Work Items.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            className="bg-slate-800/50 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20"
            value={activeProject}
            onChange={(e) => setActiveProject(e.target.value)}
          >
            <option value="">Select Project Boilerplate...</option>
            {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button 
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            Add New Mapping
          </button>
        </div>
      </div>

      {!activeProject ? (
        <div className="py-24 bg-slate-800/20 border border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center">
            <Library className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-slate-300">Library Baseline Required</h3>
            <p className="text-slate-500 max-w-sm text-center mt-2">To start mapping, choose a project above. You can define norms globally for all projects once mapped.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {boqItems?.filter(b => groupedNorms[b.id]).map(b => (
            <div key={b.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors">
              <div className="p-5 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{b.item_no}</div>
                  <h3 className="font-bold text-slate-100">{b.description}</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-500 uppercase">Unit Base</div>
                  <div className="font-mono font-bold text-slate-400">{b.unit}</div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {groupedNorms[b.id].map(n => (
                  <div key={n.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Package size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">{n.material_name}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{n.norm_quantity} {n.unit} / {b.unit}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-600 uppercase">Allowed Wastage</div>
                        <div className="text-xs font-black text-amber-500">{n.allowed_wastage_pct}%</div>
                      </div>
                      <button 
                        onClick={() => deleteMutation.mutate(n.id)}
                        className="p-2 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {boqItems?.filter(b => !groupedNorms[b.id]).length > 0 && (
             <div className="lg:col-span-2 p-8 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-600">
                <Info className="w-8 h-8 mb-2" />
                <p className="text-sm font-medium">There are {boqItems?.filter(b => !groupedNorms[b.id]).length} remaining items without mapped consumption norms.</p>
             </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
           <AddNormModal 
              boqItems={boqItems} 
              onClose={() => setShowAdd(false)} 
              onSuccess={() => { qc.invalidateQueries(['norms']); setShowAdd(false); }}
           />
        </div>
      )}
    </div>
  );
}

function AddNormModal({ boqItems, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    boq_item_id: '',
    material_name: '',
    unit: '',
    norm_quantity: '',
    allowed_wastage_pct: 5,
    recovery_rate: ''
  });

  const mutation = useMutation({
    mutationFn: (d) => normsAPI.create(d),
    onSuccess,
    onError: (e) => toast.error(e.message)
  });

  return (
    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="p-8 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-2xl font-black text-white tracking-tight">New Consumption Norm</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
          <X className="w-7 h-7" />
        </button>
      </div>

      <div className="p-8 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Target Work Item (BoQ)</label>
          <select 
            className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.boq_item_id}
            onChange={e => setFormData({...formData, boq_item_id: e.target.value})}
          >
            <option value="">Select BoQ Item...</option>
            {boqItems?.map(b => <option key={b.id} value={b.id}>{b.item_no} - {b.description}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Material Component</label>
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. OPC Cement"
              value={formData.material_name}
              onChange={e => setFormData({...formData, material_name: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Component Unit</label>
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. Bags"
              value={formData.unit}
              onChange={e => setFormData({...formData, unit: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Norm Ratio (Qty/Unit)</label>
            <input 
              type="number"
              step="0.0001"
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. 8.4"
              value={formData.norm_quantity}
              onChange={e => setFormData({...formData, norm_quantity: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Allowed Wastage %</label>
            <input 
              type="number"
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.allowed_wastage_pct}
              onChange={e => setFormData({...formData, allowed_wastage_pct: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Recovery Rate (₹ / Unit)</label>
            <input 
              type="number"
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. 450"
              value={formData.recovery_rate}
              onChange={e => setFormData({...formData, recovery_rate: e.target.value})}
            />
          </div>
        </div>
      </div>

      <div className="p-8 bg-slate-800/50 border-t border-slate-800 flex justify-end gap-3">
        <button 
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={() => mutation.mutate(formData)}
          disabled={mutation.isPending || !formData.boq_item_id || !formData.material_name}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
        >
          {mutation.isPending ? 'Saving...' : 'Save Mapping'}
          <Save className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
