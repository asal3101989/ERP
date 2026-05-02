import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Package } from 'lucide-react';
import { projectAPI } from '../../api/client';
import api from '../../api/client';
import dayjs from 'dayjs';



const fmt = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

export default function InventoryAssetPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('stock');
  const [showGRN, setShowGRN] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const [form, setForm] = useState({ project_id: '', vendor_name: '', po_number: '', material_name: '', quantity: '', unit: 'Bag', rate: '', received_date: dayjs().format('YYYY-MM-DD'), vehicle_number: '', remarks: '' });

  const { data: projects = [] } = useQuery({ queryKey: ['projects-simple'], queryFn: () => projectAPI.list().then(r => r.data.data ?? r.data ?? []) });
  const { data: rawInventory } = useQuery({ queryKey: ['inventory'], queryFn: () => api.get('/inventory').then(r => r.data?.data ?? r.data ?? []) });
  const { data: rawGRN } = useQuery({ queryKey: ['grn'], queryFn: () => api.get('/grn').then(r => r.data?.data ?? r.data ?? []) });

  const inventory = (Array.isArray(rawInventory) ? rawInventory : []).map(i => ({ ...i, project_name: i.project_name ?? i.project ?? '—' }));
  const grns = (Array.isArray(rawGRN) ? rawGRN : []).map(g => ({ ...g, project_name: g.project_name ?? g.project ?? '—' }));

  const createGRN = useMutation({
    mutationFn: (d) => api.post('/grn', d),
    onSuccess: () => { toast.success('GRN recorded'); qc.invalidateQueries(['grn', 'inventory']); setShowGRN(false); },
    onError: () => toast.error('Failed to record GRN'),
  });

  const filteredInv = inventory.filter(i => filterProject === 'all' || i.project_name === filterProject);
  const filteredGRN = grns.filter(g => filterProject === 'all' || g.project_name === filterProject);

  const projectNames = [...new Set(inventory.map(i => i.project_name))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Site Stock & GRN</h1>
          <p className="text-gray-400 text-sm mt-0.5">Godown-wise inventory — Goods Receipt Notes — material movement</p>
        </div>
        <button onClick={() => setShowGRN(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Record GRN
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {['stock', 'grn'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'stock' ? 'Stock Position' : 'GRN Register'}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="input text-sm w-52">
          <option value="all">All Projects</option>
          {projectNames.map(n => <option key={n}>{n}</option>)}
        </select>
      </div>

      {tab === 'stock' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-400">
                <th className="text-left p-3 pl-4">Material</th>
                <th className="text-left p-3">Site</th>
                <th className="text-left p-3">Unit</th>
                <th className="text-right p-3">Opening</th>
                <th className="text-right p-3">Received</th>
                <th className="text-right p-3">Issued</th>
                <th className="text-right p-3">Closing</th>
                <th className="text-right p-3">Value</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInv.map(i => {
                const isLow = i.closing_qty <= i.reorder_level;
                const isOut = i.closing_qty === 0;
                return (
                  <tr key={i.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="p-3 pl-4">
                      <div className="text-white">{i.material_name}</div>
                      <div className="text-xs text-gray-500">{i.material_code}</div>
                    </td>
                    <td className="p-3 text-gray-300">{i.project_name}</td>
                    <td className="p-3 text-gray-400">{i.unit}</td>
                    <td className="p-3 text-right text-gray-400">{i.opening_qty}</td>
                    <td className="p-3 text-right text-green-400">{i.received_qty}</td>
                    <td className="p-3 text-right text-red-400">{i.issued_qty}</td>
                    <td className={`p-3 text-right font-semibold ${isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-white'}`}>{i.closing_qty}</td>
                    <td className="p-3 text-right text-white">{fmt(i.closing_qty * i.rate)}</td>
                    <td className="p-3">
                      {isOut ? <span className="badge badge-red">Out of Stock</span>
                        : isLow ? <span className="badge badge-yellow">Reorder</span>
                        : <span className="badge badge-green">OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'grn' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-400">
                <th className="text-left p-3 pl-4">GRN #</th>
                <th className="text-left p-3">PO #</th>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Material</th>
                <th className="text-left p-3">Site</th>
                <th className="text-right p-3">Qty</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredGRN.map(g => (
                <tr key={g.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="p-3 pl-4 font-mono text-blue-300">{g.grn_number}</td>
                  <td className="p-3 font-mono text-xs text-gray-400">{g.po_number}</td>
                  <td className="p-3 text-gray-300">{g.vendor_name}</td>
                  <td className="p-3 text-white">{g.material_name}</td>
                  <td className="p-3 text-gray-300">{g.project_name}</td>
                  <td className="p-3 text-right text-white">{g.quantity} {g.unit}</td>
                  <td className="p-3 text-right text-white">{fmt(g.amount)}</td>
                  <td className="p-3 text-gray-400">{dayjs(g.received_date).format('DD/MM/YY')}</td>
                  <td className="p-3">
                    {g.verified ? <span className="badge badge-green">Verified</span> : <span className="badge badge-yellow">Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GRN Modal */}
      {showGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#1a1f2e] rounded-xl w-full max-w-md border border-white/10 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Record GRN</h2>
              <button onClick={() => setShowGRN(false)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Project / Site</label>
                  <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Select project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Vendor Name</label>
                  <input className="input" value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">PO Number</label>
                  <input className="input" value={form.po_number} onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Material Name</label>
                  <input className="input" value={form.material_name} onChange={e => setForm(f => ({ ...f, material_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" className="input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Rate (₹)</label>
                  <input type="number" className="input" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Received Date</label>
                  <input type="date" className="input" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Vehicle Number</label>
                  <input className="input" value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} />
                </div>
                {form.quantity && form.rate && (
                  <div className="col-span-2 bg-blue-500/10 rounded-lg p-3 text-sm">
                    <span className="text-gray-400">Total Amount: </span>
                    <span className="text-white font-semibold">{fmt(form.quantity * form.rate)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button className="btn-secondary" onClick={() => setShowGRN(false)}>Cancel</button>
                <button className="btn-primary" onClick={() => createGRN.mutate(form)} disabled={createGRN.isPending}>
                  {createGRN.isPending ? 'Saving...' : 'Record GRN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
