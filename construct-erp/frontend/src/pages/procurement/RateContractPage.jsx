import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  Landmark,
  Search,
  Filter,
  RefreshCw,
  BadgeIndianRupee,
  ClipboardList,
  TrendingUp,
  Building2,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { poAPI, projectAPI, quotationAPI } from '../../api/client';

const asArray = payload => {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.rows || payload?.items || payload?.po || payload?.quotations || [];
};

const clean = value => String(value || '').trim().toLowerCase();
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmt = value => (value ? dayjs(value).format('DD MMM YYYY') : '—');

const extractItems = record => {
  const nested = [
    record?.items,
    record?.po_items,
    record?.line_items,
    record?.quotation_items,
    record?.quote_items,
  ].find(Array.isArray);
  if (nested?.length) return nested;
  if (record?.material_name || record?.description || record?.item_name || record?.rate || record?.unit_rate || record?.quoted_rate) {
    return [record];
  }
  if (Array.isArray(record?.vendors)) {
    return record.vendors.flatMap(v => (Array.isArray(v?.items) ? v.items : []).map(item => ({
      ...item,
      vendor_name: v.vendor_name || v.name || v.vendor?.name,
    })));
  }
  return [];
};

const toRows = (records, sourceType, projectLookup) => {
  return (records || []).flatMap(record => {
    const items = extractItems(record);
    return items.map((item, index) => {
      const material = item?.material_name || item?.description || item?.name || item?.item_name || 'Unnamed material';
      const qty = Number(item?.quantity || item?.qty || 0);
      const rate = Number(item?.rate || item?.unit_rate || item?.basic_rate || item?.quoted_rate || 0);
      const projectId = record?.project_id || record?.project?.id || '';
      const projectName = record?.project_name || record?.project?.name || projectLookup.get(projectId) || '—';
      const vendorName = record?.vendor_name || record?.vendor?.name || '—';
      const docNo = record?.serial_no_formatted || record?.po_number || record?.quotation_number || record?.quote_number || record?.reference_no || record?.serial_no || record?.mrs_number || record?.id || '—';
      const sourceDate = record?.po_date || record?.quotation_date || record?.created_at || record?.updated_at || null;
      const searchableText = [material, vendorName, projectName, docNo, item?.remarks, record?.notes].map(clean).join(' ');
      return {
        id: `${sourceType}-${record?.id || 'row'}-${index}`,
        sourceType,
        sourceLabel: sourceType === 'po' ? 'Purchase Order' : 'Quotation',
        projectId,
        projectName,
        vendorName,
        docNo,
        sourceDate,
        material,
        qty,
        unit: item?.unit || item?.uom || 'Nos',
        rate,
        total: qty * rate,
        note: item?.remarks || record?.notes || '',
        searchableText,
      };
    });
  });
};

function StatCard({ label, value, sub, icon: Icon, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
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

export default function RateContractPage() {
  const [projectId, setProjectId] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');

  const projectQuery = useQuery({
    queryKey: ['procurement-rate-contract-projects'],
    queryFn: () => projectAPI.list().then(r => asArray(r.data)).catch(() => []),
  });
  const poQuery = useQuery({
    queryKey: ['procurement-rate-contract-pos'],
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
  const quoteQuery = useQuery({
    queryKey: ['procurement-rate-contract-quotations'],
    queryFn: async () => {
      const list = asArray((await quotationAPI.list()).data);
      const mrsIds = [...new Set(list.map(q => q?.mrs_id).filter(Boolean))];
      const detailed = await Promise.all(
        mrsIds.map(async mrsId => {
          try {
            const res = await quotationAPI.getCS(mrsId);
            return res.data?.data || res.data || null;
          } catch {
            return null;
          }
        })
      );
      return detailed.filter(Boolean);
    },
  });

  const refresh = async () => {
    await Promise.all([projectQuery.refetch(), poQuery.refetch(), quoteQuery.refetch()]);
    toast.success('Rate references refreshed');
  };

  const projects = projectQuery.data || [];
  const pos = poQuery.data || [];
  const quotations = quoteQuery.data || [];

  const projectLookup = useMemo(() => {
    const map = new Map();
    projects.forEach(p => {
      if (!p?.id) return;
      map.set(p.id, p.project_code ? `${p.name} (${p.project_code})` : (p.name || '—'));
    });
    return map;
  }, [projects]);

  const rateRows = useMemo(() => {
    const rows = [
      ...toRows(pos, 'po', projectLookup),
      ...toRows(quotations, 'quotation', projectLookup),
    ];
    rows.sort((a, b) => {
      const aTime = a.sourceDate ? new Date(a.sourceDate).getTime() : 0;
      const bTime = b.sourceDate ? new Date(b.sourceDate).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.rate - a.rate;
    });
    return rows;
  }, [pos, quotations, projectLookup]);

  const filtered = useMemo(() => {
    const q = clean(search);
    return rateRows.filter(row => {
      if (projectId !== 'all' && row.projectId !== projectId) return false;
      if (sourceFilter !== 'all' && row.sourceType !== sourceFilter) return false;
      if (!q) return true;
      return clean(row.searchableText).includes(q);
    });
  }, [rateRows, projectId, sourceFilter, search]);

  const uniqueMaterials = new Set(filtered.map(row => clean(row.material)).filter(Boolean)).size;
  const uniqueVendors = new Set(filtered.map(row => clean(row.vendorName)).filter(Boolean)).size;
  const avgRate = filtered.length ? filtered.reduce((sum, row) => sum + Number(row.rate || 0), 0) / filtered.length : 0;
  const latest = filtered[0];

  return (
    <div className="p-6 md:p-7 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-indigo-500 font-semibold mb-1.5">
            <Landmark className="w-3.5 h-3.5" />
            Procurement
          </div>
          <h1 className="text-2xl md:text-[28px] font-bold text-slate-900 leading-tight">Rate Contracts</h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
            Live rate references built from purchase orders and quotation comparisons already recorded in the ERP.
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
        <StatCard label="Materials" value={uniqueMaterials} sub="Distinct live rate items" icon={ClipboardList} tone="indigo" />
        <StatCard label="Vendors" value={uniqueVendors} sub="Unique vendors in scope" icon={Building2} tone="emerald" />
        <StatCard label="Average Rate" value={filtered.length ? money(avgRate) : '—'} sub="Arithmetic mean of filtered rows" icon={BadgeIndianRupee} tone="amber" />
        <StatCard label="Source Rows" value={filtered.length} sub="PO and quotation rows" icon={TrendingUp} tone="cyan" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 md:p-4 shadow-sm mb-5">
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.1fr_0.8fr_auto] gap-3 items-center">
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
            >
              <option value="all">All Projects</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.project_code ? `${project.name} (${project.project_code})` : project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Search Material / Vendor</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Steel, cement, shuttering, vendor..."
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Source</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                ['all', 'All'],
                ['po', 'PO'],
                ['quotation', 'Quotation'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSourceFilter(key)}
                  className={clsx(
                    'h-10 px-3 rounded-xl border text-sm font-medium transition-all',
                    sourceFilter === key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setProjectId('all');
                setSourceFilter('all');
                setSearch('');
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
              <h2 className="text-sm font-bold text-slate-900">Live Rate Register</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest PO and quotation line items, sorted by date</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {filtered.length} row{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          {(projectQuery.isLoading || poQuery.isLoading || quoteQuery.isLoading) ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-14 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">No rate references found</p>
              <p className="text-xs text-slate-400 mt-1">Create purchase orders or quotation comparisons to populate this register.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <th className="text-left font-semibold px-4 py-3">Material</th>
                    <th className="text-left font-semibold px-4 py-3">Rate</th>
                    <th className="text-left font-semibold px-4 py-3">Vendor / Source</th>
                    <th className="text-left font-semibold px-4 py-3">Project</th>
                    <th className="text-left font-semibold px-4 py-3">Document / Date</th>
                    <th className="text-right font-semibold px-4 py-3">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-semibold text-slate-900 leading-tight">{row.material}</div>
                        {row.note ? <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">{row.note}</div> : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-bold text-indigo-600">{money(row.rate)}</div>
                        <div className="text-[11px] text-slate-400">{row.sourceLabel}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-medium text-slate-700">{row.vendorName}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[170px]">{row.sourceType === 'po' ? 'Purchase Order' : 'Quotation'}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm text-slate-700 truncate max-w-[190px]">{row.projectName}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-mono text-slate-700 truncate max-w-[170px]">{row.docNo}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Landmark className="w-3 h-3" />
                          {fmt(row.sourceDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="text-sm font-semibold text-slate-700">{row.qty || 0} {row.unit}</div>
                        <div className="text-[11px] text-slate-400">{money(row.total)}</div>
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
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Best Suggested Rate</h3>
                <p className="text-xs text-slate-400">Latest filtered rate with source context</p>
              </div>
            </div>
            {latest ? (
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-emerald-50 border border-indigo-100 p-4">
                <div className="text-xs text-slate-400 uppercase tracking-[0.18em] font-semibold">Recommended</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{money(latest.rate)}</div>
                <div className="text-sm text-slate-600 mt-2 leading-tight">{latest.material}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/80 border border-slate-100">
                    <div className="text-slate-400 uppercase tracking-[0.18em] text-[10px] font-semibold">Vendor</div>
                    <div className="text-slate-800 font-medium mt-1">{latest.vendorName}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 border border-slate-100">
                    <div className="text-slate-400 uppercase tracking-[0.18em] text-[10px] font-semibold">Project</div>
                    <div className="text-slate-800 font-medium mt-1">{latest.projectName}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 border border-slate-100">
                    <div className="text-slate-400 uppercase tracking-[0.18em] text-[10px] font-semibold">Document</div>
                    <div className="text-slate-800 font-medium mt-1">{latest.docNo}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 border border-slate-100">
                    <div className="text-slate-400 uppercase tracking-[0.18em] text-[10px] font-semibold">Date</div>
                    <div className="text-slate-800 font-medium mt-1">{fmt(latest.sourceDate)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                No live rate available for the current filter.
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">How it works</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-500 leading-relaxed">
              <li>• Pulls live PO item rates from actual purchase orders.</li>
              <li>• Pulls live quotation comparison rates from MRS comparisons.</li>
              <li>• Filters by project, source and material/vendor search.</li>
              <li>• No mock rate contracts remain in this page.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
