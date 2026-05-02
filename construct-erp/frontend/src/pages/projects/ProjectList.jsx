// src/pages/projects/ProjectList.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Search, MapPin, Activity, Hammer,
  AlertTriangle, Users, ArrowRight, TrendingUp, Briefcase,
  CheckCircle2, Clock, Filter
} from 'lucide-react';
import { projectAPI } from '../../api/client';
import { clsx } from 'clsx';
import DataToolbar from '../../components/common/DataToolbar';
import TableActions from '../../components/common/TableActions';
import toast from 'react-hot-toast';

const STATUS = {
  active:    { label: 'Active',    color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-500',     bar: 'bg-blue-500',    left: 'border-l-blue-500' },
  delayed:   { label: 'Delayed',   color: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500',      bar: 'bg-red-500',     left: 'border-l-red-500' },
  planning:  { label: 'Planning',  color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  left: 'border-l-indigo-500' },
  on_hold:   { label: 'On Hold',   color: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400',   bar: 'bg-slate-400',   left: 'border-l-slate-300' },
  completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', left: 'border-l-emerald-500' },
};

const inr = (v) => {
  const n = parseFloat(v || 0);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const STATUS_TABS = ['all', 'active', 'planning', 'delayed', 'on_hold', 'completed'];

export default function ProjectList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search, statusFilter],
    queryFn: () =>
      projectAPI.list({ search, status: statusFilter !== 'all' ? statusFilter : undefined })
        .then(r => {
          const d = r.data;
          if (Array.isArray(d)) return d;
          if (d && Array.isArray(d.data)) return d.data;
          return [];
        }),
  });

  const projects = data || [];

  const deleteMut = useMutation({
    mutationFn: (id) => projectAPI.delete(id),
    onSuccess: () => {
      toast.success('Project deleted');
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: () => toast.error('Cannot delete — linked assets exist.'),
  });

  // KPI summary derived from all loaded projects
  const allProjects = data || [];
  const kpis = {
    total:       allProjects.length,
    active:      allProjects.filter(p => p.status === 'active').length,
    completed:   allProjects.filter(p => p.status === 'completed').length,
    totalValue:  allProjects.reduce((s, p) => s + parseFloat(p.contract_value || 0), 0),
  };

  const tabCounts = STATUS_TABS.reduce((acc, s) => {
    acc[s] = s === 'all' ? allProjects.length : allProjects.filter(p => p.status === s).length;
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-[#f4f6f9]">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Project Portfolio</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">All Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">{kpis.total} projects across all regions</p>
        </div>
        <div className="flex items-center gap-3">
          <DataToolbar data={projects} fileName="Projects_Export" />
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Projects',  value: kpis.total,             icon: Briefcase,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active',          value: kpis.active,            icon: Activity,     color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Completed',       value: kpis.completed,         icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Value',     value: inr(kpis.totalValue),   icon: TrendingUp,   color: 'text-amber-600',  bg: 'bg-amber-50', isText: true },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', k.bg)}>
              <k.icon className={clsx('w-5 h-5', k.color)} />
            </div>
            <div>
              <div className={clsx('text-xl font-bold', k.isText ? k.color : 'text-slate-900')}>{k.value}</div>
              <div className="text-xs text-slate-400">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl mb-6 p-3 flex flex-col md:flex-row items-start md:items-center gap-3 shadow-sm">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
            placeholder="Search by name, code, city…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
          {STATUS_TABS.map(s => {
            const sc = STATUS[s];
            const count = tabCounts[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  statusFilter === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                )}
              >
                {s === 'all' ? 'All' : (sc?.label || s)}
                {count > 0 && (
                  <span className={clsx(
                    'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                    statusFilter === s ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  )}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Project Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-56 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3 mx-auto">
            <Search className="w-7 h-7 text-slate-300" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No Projects Found</h3>
          <p className="text-sm text-slate-400">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnimatePresence>
            {projects.map((proj, idx) => {
              const sc = STATUS[proj.status] || STATUS.active;
              const overrun = parseFloat(proj.total_spent || 0) > parseFloat(proj.contract_value || 0);
              const progress = parseFloat(proj.progress_pct || 0);

              return (
                <motion.div
                  key={proj.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, delay: idx * 0.04 }}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className={clsx(
                    'bg-white rounded-xl border border-slate-200 border-l-4 overflow-hidden shadow-sm hover:shadow-md hover:border-l-4 cursor-pointer transition-all duration-200 group',
                    sc.left
                  )}
                >
                  <div className="p-5">
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight truncate">
                          {proj.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{proj.city || 'India'}</span>
                          <span>·</span>
                          <span className="capitalize">{proj.type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border',
                          sc.color
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', sc.dot)} />
                          {sc.label}
                        </span>
                        <TableActions
                          disableEdit
                          onDelete={() => deleteMut.mutate(proj.id)}
                          recordName={proj.name}
                        />
                      </div>
                    </div>

                    {/* Financials */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">Contract Value</div>
                        <div className="text-base font-bold text-slate-900 font-mono">{inr(proj.contract_value)}</div>
                      </div>
                      <div className={clsx('rounded-lg p-3 border', overrun ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100')}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Spent</div>
                          {overrun && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                        <div className={clsx('text-base font-bold font-mono', overrun ? 'text-red-600' : 'text-slate-900')}>
                          {inr(proj.total_spent)}
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-slate-400 font-medium">Progress</span>
                        <span className={clsx('text-xs font-bold', progress >= 90 ? 'text-emerald-600' : 'text-indigo-600')}>
                          {Number(progress).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={clsx('h-full rounded-full', sc.bar)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between group-hover:bg-indigo-50/40 transition-colors">
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> {proj.worker_count || 0} workers
                      </span>
                      {proj.pm_name && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span>PM: {proj.pm_name}</span>
                        </>
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
