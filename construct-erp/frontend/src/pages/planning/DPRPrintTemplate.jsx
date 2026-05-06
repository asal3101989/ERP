import React from 'react';
import dayjs from 'dayjs';
import bcimLogo from '../../assets/bcim-logo.png';

const fmt = (value, digits = 2) => {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString('en-IN', { maximumFractionDigits: digits });
};

const pct = (qty, total) => {
  const q = Number(qty) || 0;
  const t = Number(total) || 0;
  if (!q || !t) return '';
  return `${((q / t) * 100).toFixed(2)}%`;
};

const sum = (rows, key) => (rows || []).reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);

const SHEET_WIDTH = 1122;
const SHEET_INNER_WIDTH = 1102;
const A4_SCALE = 0.64;

const cell = {
  border: '1px solid #8db3cf',
  padding: '1px 3px',
  fontSize: '6.8px',
  lineHeight: 1,
  verticalAlign: 'middle',
};

const TH = ({ children, style = {}, ...props }) => (
  <th {...props} style={{ ...cell, background: '#d9eaf7', color: '#111827', fontWeight: 700, textAlign: 'center', ...style }}>
    {children}
  </th>
);

const TD = ({ children, style = {}, ...props }) => (
  <td {...props} style={{ ...cell, ...style }}>{children}</td>
);

const Section = ({ children, style = {} }) => (
  <tr>
    <td colSpan={19} style={{ ...cell, background: '#b9d7eb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', ...style }}>
      {children}
    </td>
  </tr>
);

const normalize = (value) => String(value || '').trim();

function toView(dpr, project) {
  const staff = dpr?.staff || [];
  const directWorkers = dpr?.direct_workers || [];
  const subcontractors = dpr?.subcontractors || [];
  const plant = dpr?.plant_items || [];
  const steel = dpr?.steel || [];

  const start = project?.start_date ? dayjs(project.start_date) : null;
  const finish = project?.end_date ? dayjs(project.end_date) : null;
  const report = dpr?.report_date ? dayjs(dpr.report_date) : dayjs();
  const totalDuration = start && finish ? Math.max(0, finish.diff(start, 'day') + 1) : '';
  const elapsed = start ? Math.max(0, report.diff(start, 'day') + 1) : '';
  const balance = finish ? Math.max(0, finish.diff(report, 'day')) : '';

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
    consultant: project?.consultant || 'Divyasree Infrastructure Projects Pvt Ltd',
    reportDate: report.format('DD-MM-YYYY'),
    projectStart: start ? start.format('DD-MM-YYYY') : '',
    projectFinish: finish ? finish.format('DD-MM-YYYY') : '',
    totalDuration,
    elapsed,
    balance,
    rainLog: dpr?.rain_log || dpr?.site_conditions || 'Normal',
    weather: dpr?.weather || '',
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
    distribution: [project?.client || 'Divyasree', project?.consultant, 'BCIM'].filter(Boolean),
    photos: dpr?.site_photos || [],
  };
}

function PadRows({ count, cols }) {
  return Array.from({ length: count }).map((_, idx) => (
    <tr key={`pad-${idx}`}>
      {Array.from({ length: cols }).map((__, col) => <TD key={col}>&nbsp;</TD>)}
    </tr>
  ));
}

export default function DPRPrintTemplate({ dpr, project }) {
  const view = toView(dpr, project);
  const workRows = view.workRows.slice(0, 11);
  const staffRows = view.staff.slice(0, 6);
  const directRows = view.directWorkers.slice(0, 6);
  const subRows = view.subcontractors.slice(0, 6);
  const plantRows = view.plant.filter(row => Number(row.nos) || normalize(row.item)).slice(0, 6);
  const materialRows = view.materialRows.slice(0, 6);

  return (
    <div className="planning-dpr-print-root" style={{ background: '#eef3f8', padding: 16 }}>
      <style>{`
        .planning-dpr-a4-page {
          width: 297mm;
          height: 210mm;
          margin: 0 auto;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 2px 20px rgba(15,23,42,0.14);
        }
        .planning-dpr-scale-box {
          width: ${SHEET_WIDTH * A4_SCALE}px;
          height: auto;
          transform: scale(${A4_SCALE});
          transform-origin: top left;
        }
        .planning-dpr-sheet {
          width: ${SHEET_WIDTH}px;
          min-width: ${SHEET_WIDTH}px;
          background: #fff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          padding: 6px;
        }
        @media print {
          body * { visibility: hidden; }
          html, body { width: 297mm; height: 210mm; margin: 0 !important; padding: 0 !important; overflow: hidden; }
          .planning-dpr-print-root, .planning-dpr-print-root * { visibility: visible; }
          .planning-dpr-print-root { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; padding: 0 !important; }
          .planning-dpr-a4-page { width: 297mm; height: 210mm; margin: 0; box-shadow: none; overflow: hidden; }
          .planning-dpr-print-hide { display: none !important; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>

      <div className="planning-dpr-print-hide" style={{ marginBottom: 12, textAlign: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '9px 24px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="planning-dpr-a4-page">
      <div className="planning-dpr-scale-box">
      <div className="planning-dpr-sheet">
        <table style={{ width: SHEET_INNER_WIDTH, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 38 }} />
            <col style={{ width: 38 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 62 }} />
            <col style={{ width: 62 }} />
            <col style={{ width: 62 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 58 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 46 }} />
          </colgroup>
          <tbody>
            <tr>
              <TD colSpan={5} style={{ border: 'none', height: 22 }}>
                <img src={bcimLogo} alt="BCIM" style={{ maxHeight: 18, maxWidth: 118, objectFit: 'contain' }} />
              </TD>
              <TD colSpan={9} style={{ border: 'none', fontSize: 12, textAlign: 'center', fontWeight: 800, letterSpacing: '0.6px' }}>
                DAILY PROGRESS REPORT
              </TD>
              <TD colSpan={5} style={{ border: 'none', textAlign: 'right', fontSize: 10, fontWeight: 700 }}>
                BCIM Engineering Pvt. Ltd.
              </TD>
            </tr>

            <tr>
              <TD colSpan={5} style={{ border: 'none', fontWeight: 700 }}>{view.employer}</TD>
              <TD colSpan={9} style={{ border: 'none' }}>&nbsp;</TD>
              <TD colSpan={5} style={{ border: 'none', textAlign: 'right', fontWeight: 700 }}>{view.mainContractor}</TD>
            </tr>

            <tr>
              <TD rowSpan={5} style={{ background: '#d9eaf7', fontWeight: 800, textAlign: 'center' }}>PROJECT</TD>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Name of Work:</TD>
              <TD colSpan={8} style={{ fontWeight: 700 }}>{view.projectName}</TD>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Report for</TD>
              <TD colSpan={4} style={{ fontWeight: 700 }}>{view.reportDate}</TD>
            </tr>
            <tr>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Employer:</TD>
              <TD colSpan={8}>{view.employer}</TD>
              <TD colSpan={3}>&nbsp;</TD>
              <TD colSpan={4}>&nbsp;</TD>
            </tr>
            <tr>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Contract No.:</TD>
              <TD colSpan={8}>{view.contractNo}</TD>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Project Start Date</TD>
              <TD colSpan={4}>{view.projectStart}</TD>
            </tr>
            <tr>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Main Contractor:</TD>
              <TD colSpan={8}>{view.mainContractor}</TD>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Project Finish Date</TD>
              <TD colSpan={4}>{view.projectFinish}</TD>
            </tr>
            <tr>
              <TD colSpan={3} style={{ fontWeight: 700 }}>Total Duration</TD>
              <TD colSpan={2} style={{ textAlign: 'center' }}>{fmt(view.totalDuration, 0)} days</TD>
              <TD colSpan={2} style={{ fontWeight: 700, textAlign: 'right' }}>Elapsed:</TD>
              <TD colSpan={2} style={{ textAlign: 'center' }}>{fmt(view.elapsed, 0)} Days</TD>
              <TD colSpan={2} style={{ fontWeight: 700, textAlign: 'right' }}>Balance:</TD>
              <TD colSpan={2} style={{ textAlign: 'center' }}>{fmt(view.balance, 0)} Days</TD>
              <TD colSpan={4}>{view.weather}</TD>
            </tr>
            <tr>
              <TD colSpan={19} style={{ fontWeight: 700 }}>Rain Log: {view.rainLog}</TD>
            </tr>

            <Section>Work Progress</Section>
            <tr>
              <TH rowSpan={2}>Work Progress</TH>
              <TH colSpan={7} rowSpan={2} style={{ textAlign: 'left' }}>Activity Description</TH>
              <TH rowSpan={2}>Unit</TH>
              <TH rowSpan={2}>BOQ Qty</TH>
              <TH colSpan={4}>For the Day</TH>
              <TH colSpan={5}>Cum. Achieved Till Date</TH>
            </tr>
            <tr>
              <TH colSpan={2}>Planned</TH>
              <TH colSpan={2}>Achieved</TH>
              <TH colSpan={3}>Qty</TH>
              <TH colSpan={2}>%</TH>
            </tr>
            {workRows.map((row, i) => (
              <tr key={`${row.description}-${i}`}>
                <TD>&nbsp;</TD>
                <TD colSpan={7} style={{ fontWeight: normalize(row.achieved) ? 700 : 400 }}>{row.description}</TD>
                <TD style={{ textAlign: 'center' }}>{row.unit}</TD>
                <TD style={{ textAlign: 'right' }}>{fmt(row.boq_qty)}</TD>
                <TD colSpan={2} style={{ textAlign: 'center' }}>{fmt(row.planned)}</TD>
                <TD colSpan={2} style={{ textAlign: 'center', fontWeight: normalize(row.achieved) ? 700 : 400 }}>{fmt(row.achieved)}</TD>
                <TD colSpan={3} style={{ textAlign: 'right' }}>{fmt(row.cumulative)}</TD>
                <TD colSpan={2} style={{ textAlign: 'center' }}>{pct(row.cumulative, row.boq_qty)}</TD>
              </tr>
            ))}
            <PadRows count={Math.max(0, 11 - workRows.length)} cols={19} />

            <Section>Resources</Section>
            <tr>
              <TH>Resources</TH>
              <TH colSpan={4}>Staff</TH>
              <TH colSpan={7}>Daily Labour Report</TH>
              <TH colSpan={7}>Subcontractors</TH>
            </tr>
            <tr>
              <TH>&nbsp;</TH>
              <TH colSpan={3}>Category</TH>
              <TH>Nos</TH>
              <TH colSpan={3}>Direct Workers</TH>
              <TH>Day</TH>
              <TH>Night</TH>
              <TH colSpan={2}>Total</TH>
              <TH colSpan={3}>Name</TH>
              <TH>Day</TH>
              <TH>Night</TH>
              <TH colSpan={2}>Total</TH>
            </tr>
            {Array.from({ length: 6 }).map((_, i) => {
              const st = staffRows[i] || {};
              const dw = directRows[i] || {};
              const sc = subRows[i] || {};
              return (
                <tr key={`resource-${i}`}>
                  <TD>&nbsp;</TD>
                  <TD colSpan={3}>{st.category}</TD>
                  <TD style={{ textAlign: 'center' }}>{fmt(st.nos, 0)}</TD>
                  <TD colSpan={3}>{dw.category}</TD>
                  <TD style={{ textAlign: 'center' }}>{fmt(dw.day, 0)}</TD>
                  <TD style={{ textAlign: 'center' }}>{fmt(dw.night, 0)}</TD>
                  <TD colSpan={2} style={{ textAlign: 'center' }}>{fmt((Number(dw.day) || 0) + (Number(dw.night) || 0), 0)}</TD>
                  <TD colSpan={3}>{sc.name || sc.work}</TD>
                  <TD style={{ textAlign: 'center' }}>{fmt(sc.day, 0)}</TD>
                  <TD style={{ textAlign: 'center' }}>{fmt(sc.night, 0)}</TD>
                  <TD colSpan={2} style={{ textAlign: 'center' }}>{fmt((Number(sc.day) || 0) + (Number(sc.night) || 0), 0)}</TD>
                </tr>
              );
            })}
            <tr>
              <TD>&nbsp;</TD>
              <TD colSpan={3} style={{ fontWeight: 800 }}>Total</TD>
              <TD style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.totalStaff, 0)}</TD>
              <TD colSpan={3} style={{ fontWeight: 800 }}>Total</TD>
              <TD style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.directDay, 0)}</TD>
              <TD style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.directNight, 0)}</TD>
              <TD colSpan={2} style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.directDay + view.directNight, 0)}</TD>
              <TD colSpan={3} style={{ fontWeight: 800 }}>Total</TD>
              <TD style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.subDay, 0)}</TD>
              <TD style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.subNight, 0)}</TD>
              <TD colSpan={2} style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.subDay + view.subNight, 0)}</TD>
            </tr>

            <tr>
              <TH colSpan={6}>Plant & Machinery</TH>
              <TH colSpan={13}>Material</TH>
            </tr>
            <tr>
              <TH colSpan={4}>Equipment</TH>
              <TH colSpan={2}>Nos</TH>
              <TH colSpan={3}>Description</TH>
              <TH>Unit</TH>
              <TH colSpan={2}>Receipts For Day</TH>
              <TH colSpan={2}>Receipts Till Date</TH>
              <TH colSpan={2}>Available On Site</TH>
              <TH colSpan={3}>Consumption For The Day</TH>
            </tr>
            {Array.from({ length: 6 }).map((_, i) => {
              const pl = plantRows[i] || {};
              const mt = materialRows[i] || {};
              return (
                <tr key={`plant-material-${i}`}>
                  <TD colSpan={4}>{pl.item}</TD>
                  <TD colSpan={2} style={{ textAlign: 'center' }}>{fmt(pl.nos, 0)}</TD>
                  <TD colSpan={3}>{mt.dia}</TD>
                  <TD style={{ textAlign: 'center' }}>{mt.dia ? 'MT' : ''}</TD>
                  <TD colSpan={2} style={{ textAlign: 'right' }}>{fmt(mt.receipts_today)}</TD>
                  <TD colSpan={2} style={{ textAlign: 'right' }}>{fmt(mt.receipts_till_date)}</TD>
                  <TD colSpan={2} style={{ textAlign: 'right' }}>{fmt(mt.available)}</TD>
                  <TD colSpan={3} style={{ textAlign: 'right' }}>{fmt(mt.consumption)}</TD>
                </tr>
              );
            })}
            <tr>
              <TD colSpan={4} style={{ fontWeight: 800 }}>Total</TD>
              <TD colSpan={2} style={{ textAlign: 'center', fontWeight: 800 }}>{fmt(view.plantTotal, 0)}</TD>
              <TD colSpan={3} style={{ fontWeight: 800 }}>Total</TD>
              <TD style={{ textAlign: 'center', fontWeight: 800 }}>MT</TD>
              <TD colSpan={2} style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(view.steelReceiptDay)}</TD>
              <TD colSpan={2} style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(view.steelReceiptTill)}</TD>
              <TD colSpan={2} style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(view.steelAvailable)}</TD>
              <TD colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(view.steelConsumption)}</TD>
            </tr>

            <tr>
              <TD colSpan={2} style={{ fontWeight: 800 }}>Constraints</TD>
              <TD colSpan={8}>{view.constraints || '\u00a0'}</TD>
              <TD colSpan={2} style={{ fontWeight: 800 }}>RFI</TD>
              <TD colSpan={7}>{view.rfi || '\u00a0'}</TD>
            </tr>

            {view.photos.length > 0 && (
              <>
                <Section>Photos</Section>
                <tr>
                  {view.photos.slice(0, 3).map((photo, idx) => (
                    <TD key={idx} colSpan={idx === 2 ? 7 : 6} style={{ textAlign: 'center', height: 58 }}>
                      <img src={photo} alt={`Site ${idx + 1}`} style={{ maxHeight: 52, maxWidth: '100%', objectFit: 'cover' }} />
                    </TD>
                  ))}
                </tr>
              </>
            )}

            <tr>
              <TD colSpan={10}>&nbsp;</TD>
              <TD colSpan={3} style={{ fontWeight: 800 }}>Distribution List:</TD>
              <TD colSpan={3} style={{ fontWeight: 800 }}>Prepared by:</TD>
              <TD colSpan={3} style={{ fontWeight: 800 }}>Approved by:</TD>
            </tr>
            <tr>
              <TD colSpan={10}>&nbsp;</TD>
              <TD colSpan={3}>{view.distribution[0] || 'Divyasree'}</TD>
              <TD colSpan={3} rowSpan={2}>{view.preparedBy}</TD>
              <TD colSpan={3} rowSpan={2}>{view.approvedBy}</TD>
            </tr>
            <tr>
              <TD colSpan={10}>&nbsp;</TD>
              <TD colSpan={3}>{view.distribution[1] || 'BCIM'}</TD>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>
    </div>
  );
}
