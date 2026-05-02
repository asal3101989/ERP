// MBCover.jsx — Measurement Book Cover Sheet
// Controlled form — no API calls. All data lifted to MeasurementBook orchestrator.

export default function MBCover({ data = {}, onChange, project = {} }) {
  const set = (key, val) => onChange?.({ ...data, [key]: val });

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white';
  const readonlyCls =
    'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-slate-50 min-h-[38px]';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block';

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header Banner */}
        <div className="rounded-t-xl overflow-hidden shadow-lg">
          <div className="bg-[#1F3864] px-8 py-6 text-center">
            <p className="text-xs tracking-[0.3em] text-blue-300 uppercase mb-1">Construction ERP</p>
            <h1 className="text-3xl font-bold text-white tracking-wide">MEASUREMENT BOOK</h1>
            <p className="text-blue-200 text-sm mt-1 italic">Running Account Bill – Civil / MEP Works</p>
          </div>
          <div className="bg-[#2E75B6] px-8 py-2 flex items-center justify-between">
            <span className="text-white text-xs font-medium tracking-widest uppercase">Project &amp; Bill Details</span>
            <span className="text-blue-200 text-xs">Form MB-01</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white shadow-lg rounded-b-xl px-8 py-6 space-y-6">

          {/* Read-only project fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <label className={labelCls}>Project Name</label>
              <div className={readonlyCls}>{project.name || '—'}</div>
            </div>
            <div>
              <label className={labelCls}>Client / Owner</label>
              <div className={readonlyCls}>{project.client_name || project.owner || '—'}</div>
            </div>
            <div>
              <label className={labelCls}>Site / Location</label>
              <div className={readonlyCls}>{project.location || project.site_address || '—'}</div>
            </div>
            <div>
              <label className={labelCls}>Work Order No.</label>
              <div className={readonlyCls}>{project.work_order_number || data.wo_number || '—'}</div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Editable bill fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <label className={labelCls}>RA Bill No. <span className="text-red-400">*</span></label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. RA-01"
                value={data.ra_bill_no || ''}
                onChange={e => set('ra_bill_no', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Invoice Ref.</label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. BCIM/2526/01"
                value={data.invoice_ref || ''}
                onChange={e => set('invoice_ref', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Bill Period From</label>
              <input
                type="date"
                className={inputCls}
                value={data.bill_period_from || ''}
                onChange={e => set('bill_period_from', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Bill Period To</label>
              <input
                type="date"
                className={inputCls}
                value={data.bill_period_to || ''}
                onChange={e => set('bill_period_to', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Date of Invoice</label>
              <input
                type="date"
                className={inputCls}
                value={data.date_of_invoice || ''}
                onChange={e => set('date_of_invoice', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Package / Description</label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Civil works for Retaining Wall"
                value={data.package_desc || ''}
                onChange={e => set('package_desc', e.target.value)}
              />
            </div>
          </div>

          {/* Signature Block */}
          <div className="pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Authorisation</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'prepared_by', label: 'Prepared By (QS)' },
                { key: 'checked_by',  label: 'Checked By' },
                { key: 'approved_by', label: 'Approved By' },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-2">
                  <label className={labelCls}>{label}</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Name"
                    value={data[key] || ''}
                    onChange={e => set(key, e.target.value)}
                  />
                  <div className="w-full h-12 border-b-2 border-slate-300" />
                  <span className="text-xs text-slate-400 text-center">Signature &amp; Date</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div className="mt-3 flex justify-between text-xs text-slate-400 px-1">
          <span>WO: {project.work_order_number || data.wo_number || '—'} · Bill: {data.ra_bill_no || '—'}</span>
          <span>Invoice: {data.invoice_ref || '—'}</span>
        </div>
      </div>
    </div>
  );
}
