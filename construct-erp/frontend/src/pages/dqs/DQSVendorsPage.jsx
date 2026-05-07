import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dqsVendorsAPI } from '../../api/client';
import { Users, Plus, Search, Edit2, Trash2, X, ChevronDown, ChevronUp, Building2, Phone, Mail, MapPin, CreditCard, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

const VENDOR_TYPES = ['Contractor', 'Supplier', 'Consultant', 'Sub-contractor', 'Service Provider', 'Labour Contractor', 'Other'];

const EMPTY = {
  name: '', trade_name: '', vendor_type: '', contact_person: '', phone: '', email: '',
  address: '', city: '', state: 'Karnataka', pincode: '',
  gstin: '', pan: '', trade_license: '', msme_reg: '',
  bank_name: '', bank_account: '', bank_ifsc: '', bank_branch: '', notes: '',
};

function Input({ label, value, onChange, required, upper, maxLength, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, color = 'indigo' }) {
  const colors = { indigo: 'text-indigo-600 bg-indigo-50', amber: 'text-amber-600 bg-amber-50', emerald: 'text-emerald-600 bg-emerald-50', violet: 'text-violet-600 bg-violet-50' };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors[color]} mb-3`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

function VendorModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState(vendor ? { ...vendor } : { ...EMPTY });
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Vendor name is required');
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{vendor ? 'Edit Vendor' : 'New Vendor'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Basic */}
          <div>
            <SectionHeader icon={Building2} label="Basic Details" color="indigo" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Vendor / Company Name" value={form.name} onChange={set('name')} required />
              <Input label="Trade Name / Brand" value={form.trade_name} onChange={set('trade_name')} />
              <Select label="Vendor Type" value={form.vendor_type} onChange={set('vendor_type')} options={VENDOR_TYPES} />
              <Input label="Contact Person" value={form.contact_person} onChange={set('contact_person')} />
              <Input label="Phone" value={form.phone} onChange={set('phone')} type="tel" />
              <Input label="Email" value={form.email} onChange={set('email')} type="email" />
            </div>
          </div>

          {/* Address */}
          <div>
            <SectionHeader icon={MapPin} label="Address" color="amber" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Textarea label="Address" value={form.address} onChange={set('address')} />
              </div>
              <Input label="City" value={form.city} onChange={set('city')} />
              <Input label="State" value={form.state} onChange={set('state')} />
              <Input label="Pincode" value={form.pincode} onChange={set('pincode')} maxLength={6} />
            </div>
          </div>

          {/* Tax & Compliance */}
          <div>
            <SectionHeader icon={Briefcase} label="Tax & Compliance" color="violet" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="GSTIN" value={form.gstin} onChange={set('gstin')} upper maxLength={15} />
              <Input label="PAN" value={form.pan} onChange={set('pan')} upper maxLength={10} />
              <Input label="Trade License No." value={form.trade_license} onChange={set('trade_license')} />
              <Input label="MSME Registration No." value={form.msme_reg} onChange={set('msme_reg')} />
            </div>
          </div>

          {/* Bank */}
          <div>
            <SectionHeader icon={CreditCard} label="Bank Details" color="emerald" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Bank Name" value={form.bank_name} onChange={set('bank_name')} />
              <Input label="Account Number" value={form.bank_account} onChange={set('bank_account')} />
              <Input label="IFSC Code" value={form.bank_ifsc} onChange={set('bank_ifsc')} upper maxLength={11} />
              <Input label="Branch" value={form.bank_branch} onChange={set('bank_branch')} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Textarea label="Notes" value={form.notes} onChange={set('notes')} />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700">Cancel</button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            {vendor ? 'Save Changes' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VendorCard({ vendor, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const typeColors = {
    Contractor: 'bg-blue-50 text-blue-700',
    Supplier: 'bg-green-50 text-green-700',
    Consultant: 'bg-violet-50 text-violet-700',
    'Sub-contractor': 'bg-amber-50 text-amber-700',
    'Service Provider': 'bg-cyan-50 text-cyan-700',
    'Labour Contractor': 'bg-orange-50 text-orange-700',
    Other: 'bg-slate-100 text-slate-600',
  };
  const tc = typeColors[vendor.vendor_type] || 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-800 text-sm">{vendor.name}</h3>
            {vendor.vendor_type && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tc}`}>{vendor.vendor_type}</span>
            )}
          </div>
          {vendor.trade_name && <p className="text-xs text-slate-500 mt-0.5">{vendor.trade_name}</p>}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {vendor.contact_person && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Users className="w-3 h-3" />{vendor.contact_person}
              </span>
            )}
            {vendor.phone && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="w-3 h-3" />{vendor.phone}
              </span>
            )}
            {vendor.email && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Mail className="w-3 h-3" />{vendor.email}
              </span>
            )}
            {vendor.city && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{vendor.city}{vendor.state ? `, ${vendor.state}` : ''}
              </span>
            )}
          </div>
          {(vendor.gstin || vendor.pan) && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {vendor.gstin && <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded">GSTIN: {vendor.gstin}</span>}
              {vendor.pan && <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded">PAN: {vendor.pan}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
            title="Details"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={() => onEdit(vendor)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600" title="Edit">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(vendor)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-50 px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 rounded-b-xl">
          {vendor.address && (
            <div className="md:col-span-2">
              <p className="text-slate-400 mb-0.5">Address</p>
              <p className="text-slate-700">{vendor.address}{vendor.city ? `, ${vendor.city}` : ''}{vendor.state ? `, ${vendor.state}` : ''} {vendor.pincode}</p>
            </div>
          )}
          {vendor.bank_name && (
            <div>
              <p className="text-slate-400 mb-0.5">Bank</p>
              <p className="text-slate-700">{vendor.bank_name}</p>
              {vendor.bank_branch && <p className="text-slate-500">{vendor.bank_branch}</p>}
            </div>
          )}
          {vendor.bank_account && (
            <div>
              <p className="text-slate-400 mb-0.5">Account / IFSC</p>
              <p className="text-slate-700 font-mono">{vendor.bank_account}</p>
              {vendor.bank_ifsc && <p className="text-slate-500 font-mono">{vendor.bank_ifsc}</p>}
            </div>
          )}
          {vendor.trade_license && (
            <div>
              <p className="text-slate-400 mb-0.5">Trade License</p>
              <p className="text-slate-700">{vendor.trade_license}</p>
            </div>
          )}
          {vendor.msme_reg && (
            <div>
              <p className="text-slate-400 mb-0.5">MSME Reg.</p>
              <p className="text-slate-700">{vendor.msme_reg}</p>
            </div>
          )}
          {vendor.notes && (
            <div className="md:col-span-4">
              <p className="text-slate-400 mb-0.5">Notes</p>
              <p className="text-slate-700">{vendor.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DQSVendorsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | vendor-object

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['dqs-vendors'],
    queryFn: () => dqsVendorsAPI.list().then(r => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),
    staleTime: 60000,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => modal && modal !== 'new'
      ? dqsVendorsAPI.update(modal.id, data)
      : dqsVendorsAPI.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dqs-vendors'] });
      setModal(null);
      toast.success(modal && modal !== 'new' ? 'Vendor updated' : 'Vendor added');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save vendor'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dqsVendorsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dqs-vendors'] });
      toast.success('Vendor deleted');
    },
    onError: () => toast.error('Failed to delete vendor'),
  });

  const handleDelete = (v) => {
    if (window.confirm(`Delete vendor "${v.name}"?`)) deleteMutation.mutate(v.id);
  };

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.name?.toLowerCase().includes(q) || v.contact_person?.toLowerCase().includes(q)
      || v.phone?.includes(q) || v.gstin?.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q);
    const matchType = !typeFilter || v.vendor_type === typeFilter;
    return matchSearch && matchType;
  });

  const totalByType = VENDOR_TYPES.reduce((acc, t) => {
    acc[t] = vendors.filter(v => v.vendor_type === t).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Vendor Management</h1>
            <p className="text-xs text-slate-500">DQS vendors — suppliers, contractors & consultants</p>
          </div>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Vendor
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-2xl font-bold text-indigo-700">{vendors.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Vendors</p>
        </div>
        {['Contractor','Supplier','Sub-contractor','Consultant'].map(t => (
          <div key={t} className="bg-white rounded-xl border border-slate-100 p-3 text-center">
            <p className="text-2xl font-bold text-slate-700">{totalByType[t] || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t}s</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor name, contact, GSTIN, city…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700"
        >
          <option value="">All Types</option>
          {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Vendor list */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{vendors.length === 0 ? 'No vendors yet' : 'No vendors match your search'}</p>
          {vendors.length === 0 && (
            <button onClick={() => setModal('new')} className="mt-3 text-sm text-indigo-600 hover:underline">Add your first vendor</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map(v => (
            <VendorCard key={v.id} vendor={v} onEdit={setModal} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <VendorModal
          vendor={modal !== 'new' ? modal : null}
          onClose={() => setModal(null)}
          onSave={(data) => saveMutation.mutate(data)}
        />
      )}
    </div>
  );
}
