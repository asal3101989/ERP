import React from 'react';
import { Download, Printer, Search, SlidersHorizontal, X } from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import toast from 'react-hot-toast';

export default function FinanceActionBar({
  data = [],
  fileName = 'finance_export',
  search,
  onSearchChange,
  projectId,
  onProjectChange,
  projectOptions = [],
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  searchPlaceholder = 'Search records',
  projectLabel = 'All Projects',
  showProject = true,
  showDateRange = true,
  showSearch = true,
  onReset,
  extraControls = null,
  compact = false,
}) {
  const handleExport = () => {
    if (!data || !data.length) {
      toast.error('No data available to export');
      return;
    }
    exportToCSV(data, fileName);
    toast.success('Export downloaded successfully');
  };

  const handlePrint = () => window.print();

  const hasFilters = Boolean(search) || Boolean(projectId && projectId !== 'all') || Boolean(startDate) || Boolean(endDate);

  return (
    <div className={`bg-white border border-slate-200 rounded-[1.5rem] p-3.5 shadow-sm ${compact ? 'space-y-2.5' : 'space-y-3'}`}>
      <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
        {showSearch && (
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search || ''}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-[11px] font-black uppercase tracking-widest outline-none focus:border-indigo-400"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 items-center">
          {showProject && (
            <select
              value={projectId || 'all'}
              onChange={e => onProjectChange?.(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-[9px] font-black uppercase tracking-widest outline-none min-w-[170px]"
            >
              <option value="all">{projectLabel}</option>
              {projectOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {showDateRange && (
            <>
              <input
                type="date"
                value={startDate || ''}
                onChange={e => onStartDateChange?.(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-[9px] font-black uppercase tracking-widest outline-none"
                title="Start date"
              />
              <input
                type="date"
                value={endDate || ''}
                onChange={e => onEndDateChange?.(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-[9px] font-black uppercase tracking-widest outline-none"
                title="End date"
              />
            </>
          )}

          {hasFilters && onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-black text-[9px] uppercase tracking-widest"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-[9px] uppercase tracking-widest shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-slate-900/10"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          {extraControls}
        </div>
      </div>
    </div>
  );
}
