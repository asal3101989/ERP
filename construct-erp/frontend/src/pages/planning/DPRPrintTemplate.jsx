import React from 'react';
import dayjs from 'dayjs';
import bcimLogo from '../../assets/bcim-logo.png';

const C = {
  bg: '#0d1117',
  panel: '#161b22',
  border: '#21262d',
  accent: '#f0883e',
  accentSoft: 'rgba(240,136,62,0.12)',
  blue: '#58a6ff',
  green: '#3fb950',
  red: '#f85149',
  yellow: '#d29922',
  text: '#e6edf3',
  muted: '#8b949e',
  mutedDark: '#30363d',
};

const PRINT_SCALE = 0.78;

const normalize = value => String(value || '').trim();

const fmt = (value, digits = 2) => {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString('en-IN', { maximumFractionDigits: digits });
};

const sum = (rows, key) => (rows || []).reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);

const pct = (qty, total) => {
  const q = Number(qty) || 0;
  const t = Number(total) || 0;
  if (!q || !t) return '';
  return `${((q / t) * 100).toFixed(1)}%`;
};

function toView(dpr, project) {
  const staff = dpr?.staff || [];
  const directWorkers = dpr?.direct_workers || [];
  const subcontractors = dpr?.subcontractors || [];
  const plant = dpr?.plant_items || [];
  const steel = dpr?.steel || [];
  const start = project?.start_date ? dayjs(project.start_date) : null;
  const finish = project?.end_date ? dayjs(project.end_date) : null;
  const report = dpr?.report_date ? dayjs(dpr.report_date) : dayjs();
  const totalDuration = start && finish ? Math.max(0, finish.diff(start, 'day') + 1) : 0;
  const elapsed = start ? Math.max(0, report.diff(start, 'day') + 1) : 0;
  const balance = finish ? Math.max(0, finish.diff(report, 'day')) : 0;
  const workRows = (dpr?.work_items || []).filter(row => normalize(row.description));
  const materialRows = steel.filter(row =>
    normalize(row.dia) ||
    normalize(row.receipts_today) ||
    normalize(row.receipts_till_date) ||
    normalize(row.available) ||
    normalize(row.consumption)
  );

  return {
    projectName: project?.name || dpr?.project_name || '',
    employer: project?.client || project?.customer_name || 'Divyasree Infrastructure Projects Pvt Ltd',
    contractNo: project?.contract_number || project?.code || '',
    mainContractor: project?.contractor || 'BCIM Engineering Pvt Ltd',
    reportDate: report.format('DD-MM-YYYY'),
    projectStart: start ? start.format('DD-MM-YYYY') : '',
    projectFinish: finish ? finish.format('DD-MM-YYYY') : '',
    totalDuration,
    elapsed,
    balance,
    rainLog: dpr?.rain_log || dpr?.site_conditions || 'Normal',
    weather: dpr?.weather || dpr?.site_conditions || 'Normal',
    workRows,
    staff,
    directWorkers,
    subcontractors,
    plant,
    materialRows,
    totalStaff: sum(staff, 'nos'),
    directDay: sum(directWorkers, 'day'),
    directNight: sum(directWorkers, 'night'),
    subDay: sum(subcontractors, 'day'),
    subNight: sum(subcontractors, 'night'),
    plantTotal: sum(plant, 'nos'),
    steelReceiptDay: sum(steel, 'receipts_today'),
    steelReceiptTill: sum(steel, 'receipts_till_date'),
    steelAvailable: sum(steel, 'available'),
    steelConsumption: sum(steel, 'consumption'),
    constraints: dpr?.constraints || '',
    rfi: dpr?.rfi || '',
    preparedBy: dpr?.prepared_by || dpr?.submitted_by_name || '',
    approvedBy: dpr?.approved_by || '',
  };
}

function Tag({ children, color = C.accent }) {
  return <span className="dpr-tag" style={{ color, borderColor: `${color}66`, background: `${color}22` }}>{children}</span>;
}

function KPI({ label, value, unit, color = C.accent, sub }) {
  return (
    <div className="dpr-kpi" style={{ borderLeftColor: color }}>
      <span className="dpr-kpi-label">{label}</span>
      <span className="dpr-kpi-value" style={{ color }}>
        {value || 0}<small>{unit}</small>
      </span>
      {sub && <span className="dpr-kpi-sub">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, badge }) {
  return (
    <div className="dpr-section-title">
      <span />
      <h2>{title}</h2>
      {badge && <Tag>{badge}</Tag>}
    </div>
  );
}

function DataTable({ columns, rows, emptyText = 'No data' }) {
  return (
    <table className="dpr-data-table">
      <thead>
        <tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="dpr-empty">{emptyText}</td>
          </tr>
        )}
        {rows.map((row, idx) => (
          <tr key={row.key || idx}>
            {columns.map(col => (
              <td key={col.key} className={col.align === 'right' ? 'right' : ''}>
                {col.render ? col.render(row, idx) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DPRPrintTemplate({ dpr, project }) {
  const view = toView(dpr, project);
  const workRows = view.workRows.slice(0, 8);
  const labourRows = view.directWorkers.slice(0, 4);
  const subRows = view.subcontractors.slice(0, 4);
  const plantRows = view.plant.filter(row => Number(row.nos) || normalize(row.item)).slice(0, 4);
  const materialRows = view.materialRows.slice(0, 4);
  const totalLabour = view.directDay + view.directNight + view.subDay + view.subNight;
  const totalAchieved = sum(workRows, 'achieved');

  return (
    <div className="planning-dpr-print-root">
      <style>{`
        .planning-dpr-print-root {
          background: #eef3f8;
          padding: 16px;
          font-family: Arial, Helvetica, sans-serif;
        }
        .planning-dpr-print-hide {
          margin-bottom: 12px;
          text-align: center;
        }
        .planning-dpr-print-hide button {
          background: #0f172a;
          color: #fff;
          border: none;
          padding: 9px 24px;
          border-radius: 6px;
          font-weight: 700;
          cursor: pointer;
        }
        .dpr-template-page {
          width: 297mm;
          height: 210mm;
          margin: 0 auto;
          background: ${C.bg};
          color: ${C.text};
          box-shadow: 0 2px 20px rgba(15,23,42,0.18);
          overflow: hidden;
        }
        .dpr-template-inner {
          width: ${100 / PRINT_SCALE}%;
          height: ${100 / PRINT_SCALE}%;
          transform: scale(${PRINT_SCALE});
          transform-origin: top left;
          background: ${C.bg};
        }
        .dpr-topbar {
          height: 38px;
          padding: 0 14px;
          background: ${C.panel};
          border-bottom: 1px solid ${C.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .dpr-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .dpr-brand img {
          height: 20px;
          width: auto;
          object-fit: contain;
          background: #fff;
          border-radius: 4px;
          padding: 2px;
        }
        .dpr-brand-title {
          color: ${C.accent};
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          white-space: nowrap;
        }
        .dpr-subtitle {
          color: ${C.muted};
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dpr-tag {
          display: inline-block;
          padding: 2px 8px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .8px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .dpr-content {
          padding: 10px 14px 12px;
        }
        .dpr-kpis {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }
        .dpr-kpi {
          background: ${C.panel};
          border: 1px solid ${C.border};
          border-left: 3px solid ${C.accent};
          border-radius: 6px;
          padding: 7px 10px;
          min-height: 54px;
        }
        .dpr-kpi-label {
          display: block;
          color: ${C.muted};
          font-size: 8px;
          letter-spacing: .8px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .dpr-kpi-value {
          display: block;
          font-size: 18px;
          font-weight: 800;
          line-height: 1;
        }
        .dpr-kpi-value small {
          color: ${C.muted};
          font-size: 9px;
          font-weight: 400;
          margin-left: 4px;
        }
        .dpr-kpi-sub {
          display: block;
          color: ${C.muted};
          font-size: 8px;
          margin-top: 2px;
        }
        .dpr-grid {
          display: grid;
          grid-template-columns: .82fr 2.18fr;
          gap: 8px;
          margin-bottom: 8px;
        }
        .dpr-panel {
          background: ${C.panel};
          border: 1px solid ${C.border};
          border-radius: 7px;
          padding: 9px;
          overflow: hidden;
        }
        .dpr-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .dpr-section-title > span {
          width: 3px;
          height: 14px;
          border-radius: 2px;
          background: ${C.accent};
        }
        .dpr-section-title h2 {
          margin: 0;
          color: ${C.text};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .8px;
          text-transform: uppercase;
        }
        .dpr-info {
          display: grid;
          grid-template-columns: 86px 1fr;
          gap: 4px 8px;
          font-size: 8px;
        }
        .dpr-info dt {
          color: ${C.muted};
          text-transform: uppercase;
          letter-spacing: .5px;
          font-weight: 700;
        }
        .dpr-info dd {
          margin: 0;
          color: ${C.text};
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .dpr-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }
        .dpr-data-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 8px;
        }
        .dpr-data-table th {
          background: ${C.bg};
          color: ${C.muted};
          padding: 3px 5px;
          border-bottom: 1px solid ${C.border};
          text-align: left;
          font-weight: 800;
          letter-spacing: .35px;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }
        .dpr-data-table td {
          border-bottom: 1px solid ${C.mutedDark};
          color: ${C.text};
          padding: 3px 5px;
          vertical-align: middle;
          overflow-wrap: anywhere;
        }
        .dpr-data-table td.right,
        .dpr-data-table th.right {
          text-align: right;
        }
        .dpr-empty {
          color: ${C.muted} !important;
          text-align: center;
          padding: 12px !important;
        }
        .dpr-footer-notes {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .dpr-note-box {
          min-height: 38px;
          background: ${C.bg};
          border: 1px solid ${C.border};
          border-radius: 6px;
          padding: 6px;
          font-size: 8px;
          color: ${C.text};
        }
        .dpr-note-box strong {
          display: block;
          color: ${C.accent};
          font-size: 8px;
          letter-spacing: .7px;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        @media print {
          body * { visibility: hidden !important; }
          html, body { width: 297mm; min-height: 210mm; margin: 0 !important; padding: 0 !important; background: ${C.bg} !important; }
          .planning-dpr-print-root, .planning-dpr-print-root * { visibility: visible !important; }
          .planning-dpr-print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; background: ${C.bg} !important; }
          .planning-dpr-print-hide { display: none !important; }
          .dpr-template-page { width: 297mm; height: 210mm; margin: 0; box-shadow: none; }
          .dpr-template-inner { width: ${100 / PRINT_SCALE}%; height: ${100 / PRINT_SCALE}%; transform: scale(${PRINT_SCALE}); transform-origin: top left; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>

      <div className="planning-dpr-print-hide">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="dpr-template-page">
      <div className="dpr-template-inner">
        <div className="dpr-topbar">
          <div className="dpr-brand">
            <img src={bcimLogo} alt="BCIM" />
            <span className="dpr-brand-title">DPR ERP</span>
            <span className="dpr-subtitle">Daily Progress Report System</span>
          </div>
          <Tag color={C.green}>BCIM Engineering Pvt. Ltd.</Tag>
        </div>

        <div className="dpr-content">
          <div className="dpr-kpis">
            <KPI label="Elapsed Days" value={fmt(view.elapsed, 0)} color={C.blue} sub={`of ${fmt(view.totalDuration, 0) || '-'} total`} />
            <KPI label="Balance Days" value={fmt(view.balance, 0)} color={view.balance < 10 ? C.red : C.green} />
            <KPI label="Today's Labour" value={fmt(totalLabour, 0)} unit="workers" color={C.accent} />
            <KPI label="Work Achieved" value={fmt(totalAchieved)} unit="qty" color={C.yellow} />
            <KPI label="Steel Consumed" value={fmt(view.steelConsumption)} unit="MT" color={C.green} />
          </div>

          <div className="dpr-grid">
            <section className="dpr-panel">
              <SectionHeader title="Project Information" badge="DPR" />
              <dl className="dpr-info">
                <dt>Project</dt><dd>{view.projectName || '-'}</dd>
                <dt>Employer</dt><dd>{view.employer || '-'}</dd>
                <dt>Contract No.</dt><dd>{view.contractNo || '-'}</dd>
                <dt>Contractor</dt><dd>{view.mainContractor || '-'}</dd>
                <dt>Report Date</dt><dd>{view.reportDate}</dd>
                <dt>Start Date</dt><dd>{view.projectStart || '-'}</dd>
                <dt>Finish Date</dt><dd>{view.projectFinish || '-'}</dd>
                <dt>Weather</dt><dd>{view.weather || '-'}</dd>
                <dt>Rain Log</dt><dd>{view.rainLog || '-'}</dd>
              </dl>
            </section>

            <section className="dpr-panel">
              <SectionHeader title="Work Progress" badge="Activities" />
              <DataTable
                columns={[
                  { key: 'idx', label: '#', render: (_, idx) => idx + 1 },
                  { key: 'description', label: 'Activity Description' },
                  { key: 'unit', label: 'Unit', render: row => <Tag color={C.blue}>{row.unit || '-'}</Tag> },
                  { key: 'boq_qty', label: 'BOQ Qty', align: 'right', render: row => fmt(row.boq_qty) },
                  { key: 'planned', label: 'Planned', align: 'right', render: row => fmt(row.planned) },
                  { key: 'achieved', label: 'Achieved', align: 'right', render: row => fmt(row.achieved) },
                  { key: 'cumulative', label: 'Cum Qty', align: 'right', render: row => fmt(row.cumulative) },
                  { key: 'progress', label: 'Cum %', align: 'right', render: row => pct(row.cumulative, row.boq_qty) },
                ]}
                rows={workRows}
                emptyText="No work progress rows"
              />
            </section>
          </div>

          <div className="dpr-two-col">
            <section className="dpr-panel">
              <SectionHeader title="Daily Labour Register" badge="Workforce" />
              <DataTable
                columns={[
                  { key: 'category', label: 'Direct Workers' },
                  { key: 'day', label: 'Day', align: 'right', render: row => fmt(row.day, 0) },
                  { key: 'night', label: 'Night', align: 'right', render: row => fmt(row.night, 0) },
                  { key: 'total', label: 'Total', align: 'right', render: row => fmt((Number(row.day) || 0) + (Number(row.night) || 0), 0) },
                ]}
                rows={labourRows}
                emptyText="No direct labour rows"
              />
            </section>

            <section className="dpr-panel">
              <SectionHeader title="Subcontractors" badge="SC" />
              <DataTable
                columns={[
                  { key: 'name', label: 'Name / Work', render: row => row.name || row.work || '-' },
                  { key: 'day', label: 'Day', align: 'right', render: row => fmt(row.day, 0) },
                  { key: 'night', label: 'Night', align: 'right', render: row => fmt(row.night, 0) },
                  { key: 'total', label: 'Total', align: 'right', render: row => fmt((Number(row.day) || 0) + (Number(row.night) || 0), 0) },
                ]}
                rows={subRows}
                emptyText="No subcontractor rows"
              />
            </section>
          </div>

          <div className="dpr-two-col">
            <section className="dpr-panel">
              <SectionHeader title="Plant & Machinery" badge="Equipment" />
              <DataTable
                columns={[
                  { key: 'item', label: 'Equipment' },
                  { key: 'nos', label: 'Nos', align: 'right', render: row => fmt(row.nos, 0) },
                ]}
                rows={plantRows}
                emptyText="No plant rows"
              />
            </section>

            <section className="dpr-panel">
              <SectionHeader title="Material Reconciliation" badge="Steel" />
              <DataTable
                columns={[
                  { key: 'dia', label: 'Material', render: row => row.dia || '-' },
                  { key: 'receipts_today', label: 'Receipt', align: 'right', render: row => fmt(row.receipts_today) },
                  { key: 'receipts_till_date', label: 'Till Date', align: 'right', render: row => fmt(row.receipts_till_date) },
                  { key: 'available', label: 'Stock', align: 'right', render: row => fmt(row.available) },
                  { key: 'consumption', label: 'Consumed', align: 'right', render: row => fmt(row.consumption) },
                ]}
                rows={materialRows}
                emptyText="No material rows"
              />
            </section>
          </div>

          <div className="dpr-footer-notes">
            <div className="dpr-note-box"><strong>Constraints</strong>{view.constraints || '-'}</div>
            <div className="dpr-note-box"><strong>RFI / Open Items</strong>{view.rfi || '-'}</div>
            <div className="dpr-note-box"><strong>Prepared / Approved</strong>{view.preparedBy || '-'} / {view.approvedBy || '-'}</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
