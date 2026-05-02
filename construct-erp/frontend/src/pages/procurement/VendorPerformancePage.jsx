import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Star,
  TrendingUp,
  Truck,
  ShieldCheck,
  Wallet,
  BadgeAlert,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { vendorAPI, poAPI, grnAPI, invoiceAPI } from '../../api/client';

const asArray = payload => {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.rows || payload?.items || [];
};

const clean = value => String(value || '').trim().toLowerCase();
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const TAG_COLORS = {
  Preferred: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Active: 'bg-blue-50 text-blue-700 border-blue-200',
  Watchlist: 'bg-amber-50 text-amber-700 border-amber-200',
  Critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

function ScoreBar({ value }) {
  const color = value >= 80 ? '#15803d' : value >= 60 ? '#d97706' : '#dc2626';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div style={{ width: `${value}%`, background: color, height: '100%', borderRadius: '9999px' }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{value}%</span>
    </div>
  );
}

function Ring({ score }) {
  const color = score >= 80 ? '#15803d' : score >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: 14 }}>
      {score}%
    </div>
  );
}

export default function VendorPerformancePage() {
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('All');
  const [sortBy, setSortBy] = useState('overall');
  const [selected, setSelected] = useState(null);

  const vendorQuery = useQuery({
    queryKey: ['procurement-vendor-performance-vendors'],
    queryFn: () => vendorAPI.list().then(r => asArray(r.data)).catch(() => []),
  });
  const poQuery = useQuery({
    queryKey: ['procurement-vendor-performance-pos'],
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
  const grnQuery = useQuery({
    queryKey: ['procurement-vendor-performance-grns'],
    queryFn: async () => {
      const list = asArray((await grnAPI.list()).data);
      const detailed = await Promise.all(
        list.map(async grn => {
          try {
            const res = await grnAPI.get(grn.id);
            return res.data?.data || res.data || grn;
          } catch {
            return grn;
          }
        })
      );
      return detailed;
    },
  });
  const invoiceQuery = useQuery({
    queryKey: ['procurement-vendor-performance-invoices'],
    queryFn: () => invoiceAPI.list().then(r => asArray(r.data)).catch(() => []),
  });

  const refresh = async () => {
    await Promise.all([vendorQuery.refetch(), poQuery.refetch(), grnQuery.refetch(), invoiceQuery.refetch()]);
    toast.success('Vendor performance refreshed');
  };

  const vendors = vendorQuery.data || [];
  const pos = poQuery.data || [];
  const grns = grnQuery.data || [];
  const invoices = invoiceQuery.data || [];

  const performance = useMemo(() => {
    const poByVendor = new Map();
    pos.forEach(po => {
      const key = po.vendor_id;
      if (!key) return;
      if (!poByVendor.has(key)) poByVendor.set(key, []);
      poByVendor.get(key).push(po);
    });

    const grnByVendor = new Map();
    grns.forEach(grn => {
      const key = grn.vendor_id || grn.po?.vendor_id || grn.po_vendor_id;
      if (!key) return;
      if (!grnByVendor.has(key)) grnByVendor.set(key, []);
      grnByVendor.get(key).push(grn);
    });

    const invoiceByVendor = new Map();
    invoices.forEach(inv => {
      const key = inv.vendor_id;
      if (!key) return;
      if (!invoiceByVendor.has(key)) invoiceByVendor.set(key, []);
      invoiceByVendor.get(key).push(inv);
    });

    return vendors.map(vendor => {
      const vendorPos = poByVendor.get(vendor.id) || [];
      const vendorGrns = grnByVendor.get(vendor.id) || [];
      const vendorInvoices = invoiceByVendor.get(vendor.id) || [];

      const onTime = vendorGrns.filter(grn => {
        const po = vendorPos.find(p => p.id === grn.po_id);
        if (!po?.delivery_date || !grn.grn_date) return false;
        const due = new Date(po.delivery_date).getTime();
        const received = new Date(grn.grn_date).getTime();
        if (Number.isNaN(due) || Number.isNaN(received)) return false;
        return received <= due + 24 * 60 * 60 * 1000;
      }).length;

      const approvedGrns = vendorGrns.filter(grn => (grn.quality_status || grn.status) === 'approved').length;
      const delayedGrns = vendorGrns.filter(grn => {
        const po = vendorPos.find(p => p.id === grn.po_id);
        if (!po?.delivery_date || !grn.grn_date) return false;
        const due = new Date(po.delivery_date).getTime();
        const received = new Date(grn.grn_date).getTime();
        return !Number.isNaN(due) && !Number.isNaN(received) && received > due + 24 * 60 * 60 * 1000;
      }).length;

      const delivery = vendorGrns.length ? Math.round((onTime / vendorGrns.length) * 100) : (vendorPos.length ? 75 : 0);
      const quality = vendorGrns.length ? Math.round((approvedGrns / Math.max(vendorGrns.length, 1)) * 100) : (vendorPos.length ? 80 : 0);

      const priceRatios = vendorInvoices
        .map(inv => {
          const po = vendorPos.find(p => p.id === inv.po_id);
          const poTotal = Number(po?.grand_total || po?.total_amount || po?.sub_total || 0);
          const invTotal = Number(inv.net_amount ?? inv.total_amount ?? 0);
          if (!poTotal || !invTotal) return null;
          return Math.abs(invTotal - poTotal) / poTotal;
        })
        .filter(v => v != null);
      const pricing = priceRatios.length ? Math.max(40, Math.round(100 - (priceRatios.reduce((s, v) => s + v, 0) / priceRatios.length) * 100)) : (vendorPos.length ? 70 : 0);

      const overall = Math.round((delivery + quality + pricing) / 3);
      const tag = overall >= 85 ? 'Preferred' : overall >= 70 ? 'Active' : overall >= 50 ? 'Watchlist' : 'Critical';

      return {
        id: vendor.id,
        vendor: vendor.name,
        vendorCode: vendor.vendor_code,
        vendorType: vendor.vendor_type || 'vendor',
        projectCount: new Set(vendorPos.map(p => p.project_id).filter(Boolean)).size,
        poCount: vendorPos.length,
        grnCount: vendorGrns.length,
        invoiceCount: vendorInvoices.length,
        onTimeCount: onTime,
        delayedCount: delayedGrns,
        delivery,
        quality,
        pricing,
        overall,
        tag,
        remarks:
          overall >= 85 ? 'Strong performer across delivery, quality and pricing.' :
          overall >= 70 ? 'Solid vendor with minor follow-up needs.' :
          overall >= 50 ? 'Monitor for delivery or billing issues.' :
          'Needs urgent review and escalation.',
        lastRated:
          [...vendorInvoices, ...vendorGrns, ...vendorPos]
            .map(r => r.updated_at || r.created_at || r.grn_date || r.po_date)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null,
      };
    });
  }, [vendors, pos, grns, invoices]);

  const filtered = useMemo(() => {
    const q = clean(search);
    return [...performance]
      .filter(v => {
        const matchTag = filterTag === 'All' || v.tag === filterTag;
        const matchSearch = !q || [
          v.vendor,
          v.vendorCode,
          v.vendorType,
          v.tag,
          v.remarks,
        ].some(value => clean(value).includes(q));
        return matchTag && matchSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'overall') return b.overall - a.overall;
        if (sortBy === 'delivery') return b.delivery - a.delivery;
        if (sortBy === 'quality') return b.quality - a.quality;
        if (sortBy === 'pricing') return b.pricing - a.pricing;
        return 0;
      });
  }, [performance, filterTag, search, sortBy]);

  const avgScore = performance.length ? Math.round(performance.reduce((s, v) => s + v.overall, 0) / performance.length) : 0;

  return (
    <div className="p-6 md:p-7 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-indigo-500 font-semibold mb-1.5">
            <Users className="w-3.5 h-3.5" />
            Procurement
          </div>
          <h1 className="text-2xl md:text-[28px] font-bold text-slate-900 leading-tight">Vendor Performance</h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
            Live vendor rating based on purchase orders, GRNs and invoice records already in the ERP.
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
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Vendors Rated', val: performance.length, sub: 'Loaded from vendor master', icon: Users, tone: 'indigo' },
          { label: 'Average Score', val: `${avgScore}%`, sub: 'Across all live vendors', icon: Star, tone: 'emerald' },
          { label: 'Preferred', val: performance.filter(v => v.tag === 'Preferred').length, sub: 'High-performing vendors', icon: ShieldCheck, tone: 'amber' },
          { label: 'Watch/Critical', val: performance.filter(v => ['Watchlist', 'Critical'].includes(v.tag)).length, sub: 'Needs follow-up', icon: BadgeAlert, tone: 'rose' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={clsx('w-9 h-9 rounded-lg border flex items-center justify-center', s.tone === 'indigo' && 'bg-indigo-50 text-indigo-600 border-indigo-100', s.tone === 'emerald' && 'bg-emerald-50 text-emerald-600 border-emerald-100', s.tone === 'amber' && 'bg-amber-50 text-amber-600 border-amber-100', s.tone === 'rose' && 'bg-rose-50 text-rose-600 border-rose-100')}>
                <s.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.val}</div>
            <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase mt-1">{s.label}</div>
            <div className="text-xs text-slate-400 mt-1.5 leading-tight">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 md:p-4 shadow-sm mb-5">
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr_auto] gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor, code, tag..."
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Tag</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['All', 'Preferred', 'Active', 'Watchlist', 'Critical'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(tag)}
                  className={clsx(
                    'h-10 px-3 rounded-xl border text-sm font-medium transition-all',
                    filterTag === tag
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setSearch('');
                setFilterTag('All');
                setSortBy('overall');
              }}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-medium hover:text-indigo-700 hover:border-indigo-300 transition-all"
            >
              <Filter className="w-4 h-4 inline mr-1.5" />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.55fr_0.9fr] gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Vendor Scoreboard</h2>
              <p className="text-xs text-slate-400 mt-0.5">Computed from live procurement and stores data</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none"
              >
                <option value="overall">Sort: Overall</option>
                <option value="delivery">Sort: Delivery</option>
                <option value="quality">Sort: Quality</option>
                <option value="pricing">Sort: Pricing</option>
              </select>
            </div>
          </div>

          {(vendorQuery.isLoading || poQuery.isLoading || grnQuery.isLoading || invoiceQuery.isLoading) ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-14 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">No vendor performance rows</p>
              <p className="text-xs text-slate-400 mt-1">Add vendors, purchase orders and GRNs to start generating scores.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <th className="text-left font-semibold px-4 py-3">Vendor</th>
                    <th className="text-left font-semibold px-4 py-3">Delivery</th>
                    <th className="text-left font-semibold px-4 py-3">Quality</th>
                    <th className="text-left font-semibold px-4 py-3">Pricing</th>
                    <th className="text-left font-semibold px-4 py-3">Overall</th>
                    <th className="text-left font-semibold px-4 py-3">Tag</th>
                    <th className="text-right font-semibold px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-semibold text-slate-900">{v.vendor}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{v.vendorCode || '—'} · {v.vendorType}</div>
                      </td>
                      <td className="px-4 py-3 align-top"><ScoreBar value={v.delivery} /></td>
                      <td className="px-4 py-3 align-top"><ScoreBar value={v.quality} /></td>
                      <td className="px-4 py-3 align-top"><ScoreBar value={v.pricing} /></td>
                      <td className="px-4 py-3 align-top"><Ring score={v.overall} /></td>
                      <td className="px-4 py-3 align-top">
                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', TAG_COLORS[v.tag])}>
                          {v.tag}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          onClick={() => setSelected(v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900">What this uses</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-500 leading-relaxed">
              <li>• Purchase orders for delivery and pricing context.</li>
              <li>• GRN approvals and timing for service/quality checks.</li>
              <li>• Invoice records for price consistency checks.</li>
              <li>• Vendor master for identification and grouping.</li>
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <BadgeAlert className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Scoring rule</h3>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">
              Delivery score is based on GRN timing against PO delivery date. Quality score is based on GRN approval status. Pricing score is based on invoice value versus PO value.
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-6">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{selected.vendor}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selected.vendorType} · {selected.vendorCode || '—'}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 transition-all">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <Ring score={selected.overall} />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-[0.18em] font-semibold">Overall Score</div>
                  <div className="text-sm font-semibold text-slate-900">{selected.remarks}</div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1"><span className="text-xs text-slate-500">Delivery</span><span className="text-xs font-semibold text-slate-700">{selected.delivery}%</span></div>
                  <ScoreBar value={selected.delivery} />
                </div>
                <div>
                  <div className="flex justify-between mb-1"><span className="text-xs text-slate-500">Quality</span><span className="text-xs font-semibold text-slate-700">{selected.quality}%</span></div>
                  <ScoreBar value={selected.quality} />
                </div>
                <div>
                  <div className="flex justify-between mb-1"><span className="text-xs text-slate-500">Pricing</span><span className="text-xs font-semibold text-slate-700">{selected.pricing}%</span></div>
                  <ScoreBar value={selected.pricing} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">POs</div>
                  <div className="text-slate-900 font-semibold mt-1">{selected.poCount}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">GRNs</div>
                  <div className="text-slate-900 font-semibold mt-1">{selected.grnCount}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">Invoices</div>
                  <div className="text-slate-900 font-semibold mt-1">{selected.invoiceCount}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">On Time</div>
                  <div className="text-slate-900 font-semibold mt-1">{selected.onTimeCount}</div>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
