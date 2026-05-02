import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { hrMastersAPI } from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

function DeptModal({ dept, onClose, onSave }) {
  const [name, setName] = useState(dept?.name || '');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
        <h2 className="font-semibold text-white mb-4">{dept ? 'Edit Department' : 'Add Department'}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Department Name</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Finance" autoFocus />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
          <button onClick={() => name && onSave({ name })} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}

function DesigModal({ desig, departments, onClose, onSave }) {
  const [name, setName]     = useState(desig?.name || '');
  const [deptId, setDeptId] = useState(desig?.department_id || '');
  const [grade, setGrade]   = useState(desig?.grade || '');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
        <h2 className="font-semibold text-white mb-4">{desig ? 'Edit Designation' : 'Add Designation'}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Designation Name</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Site Engineer" autoFocus />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Department</label>
            <select className={inputCls} value={deptId} onChange={e => setDeptId(e.target.value)}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Grade (optional)</label>
            <input className={inputCls} value={grade} onChange={e => setGrade(e.target.value)} placeholder="e.g. A1, B2" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
          <button onClick={() => name && onSave({ name, department_id: deptId, grade })} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentPage() {
  const qc = useQueryClient();
  const [deptModal,  setDeptModal]  = useState(null); // null | 'new' | dept object
  const [desigModal, setDesigModal] = useState(null);
  const [expanded,   setExpanded]   = useState({});

  const { data: deptData }  = useQuery({ queryKey: ['hr-departments'],  queryFn: () => hrMastersAPI.listDepts().then(r => r.data) });
  const { data: desigData } = useQuery({ queryKey: ['hr-designations'], queryFn: () => hrMastersAPI.listDesigs().then(r => r.data) });

  const departments  = deptData?.data  || [];
  const designations = desigData?.data || [];

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['hr-departments'] });
    qc.invalidateQueries({ queryKey: ['hr-designations'] });
  };

  const saveDeptMut = useMutation({
    mutationFn: (data) => deptModal?.id ? hrMastersAPI.updateDept(deptModal.id, data) : hrMastersAPI.createDept(data),
    onSuccess: () => { toast.success('Saved'); inv(); setDeptModal(null); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const delDeptMut = useMutation({
    mutationFn: (id) => hrMastersAPI.deleteDept(id),
    onSuccess: () => { toast.success('Deleted'); inv(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const saveDesigMut = useMutation({
    mutationFn: (data) => desigModal?.id ? hrMastersAPI.updateDesig(desigModal.id, data) : hrMastersAPI.createDesig(data),
    onSuccess: () => { toast.success('Saved'); inv(); setDesigModal(null); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const delDesigMut = useMutation({
    mutationFn: (id) => hrMastersAPI.deleteDesig(id),
    onSuccess: () => { toast.success('Deleted'); inv(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const deptDesigs = (deptId) => designations.filter(d => d.department_id === deptId);
  const unassigned = designations.filter(d => !d.department_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg"><Building2 className="w-6 h-6 text-blue-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Departments & Designations</h1>
            <p className="text-sm text-slate-400">Manage organization structure</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDesigModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Designation
          </button>
          <button onClick={() => setDeptModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Department
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Total Departments</div>
          <div className="text-3xl font-bold text-blue-400">{departments.length}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Total Designations</div>
          <div className="text-3xl font-bold text-purple-400">{designations.length}</div>
        </div>
      </div>

      {/* Department Tree */}
      <div className="space-y-2">
        {departments.map(dept => {
          const desigs = deptDesigs(dept.id);
          const isOpen = expanded[dept.id];
          return (
            <div key={dept.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-750"
                onClick={() => toggle(dept.id)}>
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-white">{dept.name}</span>
                  <span className="text-slate-500 text-sm">({desigs.length} designation{desigs.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDesigModal({ department_id: dept.id })}
                    className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-700 transition-colors" title="Add designation">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeptModal(dept)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => window.confirm('Delete department?') && delDeptMut.mutate(dept.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-slate-700 divide-y divide-slate-700/50">
                  {desigs.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2.5 pl-12 hover:bg-slate-700/30">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300 text-sm">{d.name}</span>
                        {d.grade && <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{d.grade}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDesigModal(d)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => window.confirm('Delete?') && delDesigMut.mutate(d.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  {desigs.length === 0 && (
                    <div className="px-12 py-3 text-slate-500 text-sm italic">No designations yet</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {departments.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No departments yet. Add your first department.</p>
          </div>
        )}
      </div>

      {/* Unassigned Designations */}
      {unassigned.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Unassigned Designations</h3>
          <div className="space-y-1">
            {unassigned.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 px-3 hover:bg-slate-700/30 rounded-lg">
                <span className="text-slate-300 text-sm">{d.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setDesigModal(d)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => window.confirm('Delete?') && delDesigMut.mutate(d.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {deptModal && (
        <DeptModal
          dept={deptModal === 'new' ? null : deptModal}
          onClose={() => setDeptModal(null)}
          onSave={(data) => saveDeptMut.mutate(data)}
        />
      )}
      {desigModal && (
        <DesigModal
          desig={desigModal === 'new' ? null : (typeof desigModal === 'object' && desigModal.name ? desigModal : { department_id: desigModal?.department_id || '' })}
          departments={departments}
          onClose={() => setDesigModal(null)}
          onSave={(data) => saveDesigMut.mutate(data)}
        />
      )}
    </div>
  );
}
