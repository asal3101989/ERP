import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  FileSignature,
  Plus,
  Search,
  Filter,
  RefreshCw,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import useAuthStore from '../../store/authStore';
import { poAPI, vendorAPI, poAmendmentAPI } from '../../api/client';

const asArray = payload => {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.rows || payload?.items || [];
};

const clean = value => String(value || '').trim().toLowerCase();
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmt = value => (value ? dayjs(value).format('DD MMM YYYY') : '—');

const AMENDMENT_TYPES = ['Qty Change', 'Rate Change', 'Date Extension', 'Item Addition', 'Item Deletion', 'Cancellation'];
const STATUS_COLORS = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

function StatCard({ label, value, sub, icon: Icon, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={clsx('w-9 h-9 rounded-lg border flex items-center justify-center', tones[tone])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase mt-1">{label}</div>
      <div className="text-xs text-slate-400 mt-1.5 leading-tight">{sub}</div>
    </div>
  );
}

export default function POAmendmentLogPage() {
  const qc = useQueryClient();
  const user = useAuthStore(state => state.user);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [form, setForm] = useState({
    po_id: '',
    amendment_type: 'Qty Change',
    description: '',
    value_impact: '',
    impact_type: 'increase',
    raised_by: user?.name || '',
    amendment_date: dayjs().format('YYYY-MM-DD'),
  });

  const amendmentQuery = useQuery({
    queryKey: ['procurement-po-amendments'],
    queryFn: () => poAmendmentAPI.list().then(r => asArray(r.data)).catch(() => []),
  });
  const poQuery = useQuery({
    queryKey: ['procurement-po-amendment-pos'],
    queryFn: async () => {
      const list = asArray((await poAPI.list()).data);
      const detailed = await Promise.all(
        list.map(async po => {
          try {
            const res = await poAPI.get(po.id);
            return res.data?.data || res.data || po;
          } catch {
            return po;
          }
        })
      );
      return detailed;
    },
  });
  const vendorQuery = useQuery({
    queryKey: ['procurement-po-amendment-vendors'],
    queryFn: () => vendorAPI.list().then(r => asArray(r.data)).catch(() => []),
  });

  const createMut = useMutation({
    mutationFn: payload => poAmendmentAPI.create(payload),
    onSuccess: () => {
      toast.success('PO amendment logged');
      setShowModal(false);
      setForm({
        po_id: '',
        amendment_type: 'Qty Change',
        description: '',
        value_impact: '',
        impact_type: 'increase',
        raised_by: user?.name || '',
        amendment_date: dayjs().format('YYYY-MM-DD'),
      });
      qc.invalidateQueries({ queryKey: ['procurement-po-amendments'] });
    },
    onError: err => toast.error(err?.response?.data?.error || 'Unable to log amendment'),
  });

  const approveMut = useMutation({
    mutationFn: id => poAmendmentAPI.approve(id),
    onSuccess: () => {
      toast.success('Amendment approved');
      qc.invalidateQueries({ queryKey: ['procurement-po-amendments'] });
    },
    onError: err => toast.error(err?.response?.data?.error || 'Unable to approve'),
  });
  const rejectMut = useMutation({
    mutationFn: id => poAmendmentAPI.reject(id),
    onSuccess: () => {
      toast.success('Amendment rejected');
      qc.invalidateQueries({ queryKey: ['procurement-po-amendments'] });
    },
    onError: err => toast.error(err?.response?.data?.error || 'Unable to reject'),
  });
  const deleteMut = useMutation({
    mutationFn: id => poAmendmentAPI.delete(id),
    onSuccess: () => {
      toast.success('Amendment deleted');
      qc.invalidateQueries({ queryKey: ['procurement-po-amendments'] });
    },
    onError: err => toast.error(err?.response?.data?.error || 'Unable to delete'),
  });

  const poLookup = useMemo(() => {
    const map = new Map();
    (poQuery.data || []).forEach(po => map.set(po.id, po));
    return map;
  }, [poQuery.data]);

  const vendorLookup = useMemo(() => {
    const map = new Map();
    (vendorQuery.data || []).forEach(v => map.set(v.id, v));
    return map;
  }, [vendorQuery.data]);

  const amendments = useMemo(() => {
    return (amendmentQuery.data || []).map(row => ({
      ...row,
      status_view: row.status || 'pending',
      po: row.po_id ? poLookup.get(row.po_id) : null,
      vendor: row.vendor_id ? vendorLookup.get(row.vendor_id) : null,
      searchText: [
        row.amendment_no,
        row.amendment_type,
        row.description,
        row.raised_by,
        row.po_number,
        row.serial_no_formatted,
        row.vendor_name,
      ].map(clean).join(' '),
    }));
  }, [amendmentQuery.data, poLookup, vendorLookup]);

  const filtered = useMemo(() => {
    const q = clean(search);
    return amendments.filter(row => {
      if (filterStatus !== 'all' && row.status_view !== filterStatus) return false;
      if (filterType !== 'all' && row.amendment_type !== filterType) return false;
      if (!q) return true;
      return clean(row.searchText).includes(q);
    });
  }, [amendments, filterStatus, filterType, search]);

  const stats = useMemo(() => ({
    total: amendments.length,
    pending: amendments.filter(a => a.status_view === 'pending').length,
    approved: amendments.filter(a => a.status_view === 'approved').length,
    impact: amendments.reduce((sum, a) => sum + (a.impact_type === 'increase' ? Number(a.value_impact || 0) : a.impact_type === 'decrease' ? -Number(a.value_impact || 0) : 0), 0),
  }), [amendments]);

  const refresh = async () => {
    await Promise.all([amendmentQuery.refetch(), poQuery.refetch(), vendorQuery.refetch()]);
    toast.success('PO amendments refreshed');
  };

  const openNew = () => {
    setForm({
      po_id: '',
      amendment_type: 'Qty Change',
      description: '',
      value_impact: '',
      impact_type: 'increase',
      raised_by: user?.name || '',
      amendment_date: dayjs().format('YYYY-MM-DD'),
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.po_id || !form.amendment_type || !form.description || !form.raised_by || !form.amendment_date) {
      toast.error('Fill all required fields');
      return;
    }
    createMut.mutate(form);
  };

  const selectedPo = form.po_id ? poLookup.get(form.po_id) : null;

  return (
    <div className="p-6 md:p-7 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-indigo-500 font-semibold mb-1.5">
            <FileSignature className="w-3.5 h-3.5" />
            Procurement
          </div>
          <h1 className="text-2xl md:text-[28px] font-bold text-slate-900 leading-tight">PO Amendment Log</h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
            Real amendment ledger linked to live purchase orders and vendors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Log Amendment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Amendments" value={stats.total} sub="Live records only" icon={ClipboardList} tone="indigo" />
        <StatCard label="Pending" value={stats.pending} sub="Awaiting action" icon={CalendarDays} tone="amber" />
        <StatCard label="Approved" value={stats.approved} sub="Completed approvals" icon={CheckCircle2} tone="emerald" />
        <StatCard label="Net Impact" value={money(stats.impact)} sub="Increase minus decrease" icon={BadgeDollarSign} tone="rose" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 md:p-4 shadow-sm mb-5">
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr_0.9fr_auto] gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search PO, vendor, AMD..."
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Status</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'pending', 'approved', 'rejected'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={clsx(
                    'h-10 px-3 rounded-xl border text-sm font-medium transition-all',
                    filterStatus === status
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  )}
                >
                  {status === 'all' ? 'All' : status}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
            >
              <option value="all">All Types</option>
              {AMENDMENT_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setSearch('');
                setFilterStatus('all');
                setFilterType('all');
              }}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-medium hover:text-indigo-700 hover:border-indigo-300 transition-all"
            >
              <Filter className="w-4 h-4 inline mr-1.5" />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Amendment History</h2>
            <p className="text-xs text-slate-400 mt-0.5">Linked to real purchase orders and vendors</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {filtered.length} row{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {amendmentQuery.isLoading || poQuery.isLoading || vendorQuery.isLoading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No amendments logged yet</p>
            <p className="text-xs text-slate-400 mt-1">Create the first amendment against a live purchase order.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(a => (
              <div key={a.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={clsx('mt-1 w-3 h-3 rounded-full shrink-0', a.status_view === 'approved' ? 'bg-emerald-500' : a.status_view === 'pending' ? 'bg-amber-400' : 'bg-rose-400')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm text-indigo-700">{a.po_number || a.serial_no_formatted || 'PO'}</span>
                        <span className="text-gray-400 text-xs">—</span>
                        <span className="text-sm font-medium">{a.amendment_no}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{a.amendment_type}</span>
                        <span className={clsx('px-2 py-0.5 rounded text-xs font-medium border', STATUS_COLORS[a.status_view])}>{a.status_view}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        {a.vendor_name || a.vendor?.name || 'Vendor'} · {fmt(a.amendment_date)} · Raised by: {a.raised_by || '—'}
                      </p>
                      <div className="bg-slate-50 border-l-2 border-indigo-600 rounded px-3 py-2 text-xs text-slate-700">
                        {a.description}
                        {Number(a.value_impact || 0) !== 0 && (
                          <span className={clsx('ml-2 font-medium', a.impact_type === 'increase' ? 'text-emerald-700' : 'text-rose-600')}>
                            · Value Impact: {a.impact_type === 'increase' ? '+' : a.impact_type === 'decrease' ? '-' : ''}{money(a.value_impact)}
                          </span>
                        )}
                      </div>
                      {a.status_view === 'approved' && a.approved_by_name && (
                        <p className="text-xs text-slate-400 mt-1">Approved by {a.approved_by_name} on {fmt(a.approved_at)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowDetail(a)} className="text-xs border border-slate-200 rounded px-2 py-1 hover:bg-slate-100">Details</button>
                    {a.status_view === 'pending' && (
                      <>
                        <button onClick={() => approveMut.mutate(a.id)} className="text-xs border border-emerald-200 text-emerald-700 rounded px-2 py-1 hover:bg-emerald-50">Approve</button>
                        <button onClick={() => rejectMut.mutate(a.id)} className="text-xs border border-rose-200 text-rose-600 rounded px-2 py-1 hover:bg-rose-50">Reject</button>
                      </>
                    )}
                    <button onClick={() => deleteMut.mutate(a.id)} className="text-xs border border-slate-200 text-slate-500 rounded px-2 py-1 hover:bg-slate-50">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Log Amendment</h2>
                <p className="text-xs text-slate-400 mt-0.5">Linked to live purchase orders</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 transition-all">×</button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">PO Number *</label>
                  <select
                    value={form.po_id}
                    onChange={e => {
                      const po = poLookup.get(e.target.value);
                      setForm(prev => ({
                        ...prev,
                        po_id: e.target.value,
                        raised_by: prev.raised_by || user?.name || '',
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  >
                    <option value="">Select PO</option>
                    {(poQuery.data || []).map(po => (
                      <option key={po.id} value={po.id}>
                        {po.serial_no_formatted || po.po_number || po.poNo} · {(po.vendor_name || '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Vendor</label>
                  <input
                    value={selectedPo?.vendor_name || '—'}
                    disabled
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amendment Type *</label>
                  <select
                    value={form.amendment_type}
                    onChange={e => setForm(prev => ({ ...prev, amendment_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  >
                    {AMENDMENT_TYPES.map(type => <option key={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.amendment_date}
                    onChange={e => setForm(prev => ({ ...prev, amendment_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Value Impact (₹)</label>
                  <input
                    type="number"
                    value={form.value_impact}
                    onChange={e => setForm(prev => ({ ...prev, value_impact: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Impact Type</label>
                  <select
                    value={form.impact_type}
                    onChange={e => setForm(prev => ({ ...prev, impact_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  >
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Raised By *</label>
                  <input
                    value={form.raised_by}
                    onChange={e => setForm(prev => ({ ...prev, raised_by: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    placeholder="Logged by"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Description / Reason *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 resize-none"
                  placeholder="Describe the amendment..."
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={createMut.isPending}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-60"
              >
                {createMut.isPending ? 'Saving…' : 'Submit Amendment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-6">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{showDetail.amendment_no}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{showDetail.po_number || showDetail.serial_no_formatted}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 transition-all">×</button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              {[
                ['Vendor', showDetail.vendor_name],
                ['Type', showDetail.amendment_type],
                ['Description', showDetail.description],
                ['Value Impact', showDetail.value_impact ? `${showDetail.impact_type === 'increase' ? '+' : showDetail.impact_type === 'decrease' ? '-' : ''}${money(showDetail.value_impact)}` : 'No change'],
                ['Date', fmt(showDetail.amendment_date)],
                ['Raised By', showDetail.raised_by],
                ['Status', showDetail.status_view],
                ['Approved By', showDetail.approved_by_name || '—'],
                ['Approval Date', fmt(showDetail.approved_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-slate-500 w-28 shrink-0">{k}</span>
                  <span className="font-medium text-slate-800">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end px-5 pb-5">
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
