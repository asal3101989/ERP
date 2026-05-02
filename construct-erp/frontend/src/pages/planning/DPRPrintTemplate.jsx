import React from 'react';

const fmt = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  return Number.isNaN(num) ? value : num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const sumNos = (arr, key = 'nos') => (arr || []).reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);

const TH = ({ children, style = {} }) => (
  <th style={{ border: '1px solid #7a9bb5', background: '#1b3a52', color: '#e0eaf2', padding: '4px 6px', fontWeight: 700, fontSize: '9.5px', textAlign: 'center', whiteSpace: 'nowrap', ...style }}>
    {children}
  </th>
);

const TD = ({ children, style = {} }) => (
  <td style={{ border: '1px solid #b0c8dc', padding: '3px 6px', fontSize: '10px', verticalAlign: 'middle', ...style }}>
    {children}
  </td>
);

const SectionHead = ({ children }) => (
  <div style={{ background: '#1b3a52', color: '#e0eaf2', fontWeight: 700, fontSize: '10.5px', letterSpacing: '1px', padding: '4px 10px', marginTop: '10px', textTransform: 'uppercase' }}>
    {children}
  </div>
);

function mapTemplateData(dpr, project) {
  const directWorkers = dpr?.direct_workers || [];
  const subContractors = dpr?.subcontractors || [];
  const totalDirectDay = directWorkers.reduce((sum, row) => sum + (Number(row.day) || 0), 0);
  const totalDirectNight = directWorkers.reduce((sum, row) => sum + (Number(row.night) || 0), 0);
  const totalSubDay = subContractors.reduce((sum, row) => sum + (Number(row.day) || 0), 0);
  const totalSubNight = subContractors.reduce((sum, row) => sum + (Number(row.night) || 0), 0);

  return {
    client: project?.client || project?.customer_name || 'Client',
    consultant: project?.consultant || 'Consultant',
    contractor: project?.contractor || 'BCIM Engineering Pvt. Ltd.',
    projectName: project?.name || 'Project',
    employer: project?.client || project?.customer_name || '',
    consultantName: project?.consultant || '',
    contractNo: project?.contract_number || project?.code || '',
    mainContractor: project?.contractor || 'BCIM Engineering Pvt. Ltd.',
    totalDuration: project?.start_date && project?.end_date ? Math.max(0, Math.round((new Date(project.end_date) - new Date(project.start_date)) / 86400000)) : '',
    elapsed: project?.start_date ? Math.max(0, Math.round((Date.now() - new Date(project.start_date)) / 86400000)) : '',
    balance: project?.end_date ? Math.max(0, Math.round((new Date(project.end_date) - Date.now()) / 86400000)) : '',
    reportFor: dpr?.report_date || '',
    submissionDate: dpr?.created_at ? new Date(dpr.created_at).toISOString().slice(0, 10) : '',
    projectStart: project?.start_date || '',
    projectFinish: project?.end_date || '',
    rainLog: dpr?.rain_log || 'Normal Day',
    siteConditions: dpr?.site_conditions || 'Dry',
    workProgress: (dpr?.work_items || []).map((row) => ({
      description: row.description,
      unit: row.unit,
      boqQty: row.boq_qty,
      plannedToday: row.planned,
      achievedToday: row.achieved,
      plannedNextDay: row.remarks,
      cumQty: row.cumulative,
      cumPct: row.cumulative && row.boq_qty ? `${((Number(row.cumulative) / Number(row.boq_qty)) * 100).toFixed(2)}%` : '',
    })),
    staff: dpr?.staff || [],
    directWorkers,
    subContractors,
    plant: dpr?.plant_items?.map((item) => ({ description: item.item, nos: item.nos })) || [],
    materials: dpr?.steel?.map((item) => ({
      description: item.dia,
      unit: 'MT',
      diverted: '',
      receiptDay: item.receipts_today,
      receiptTillDate: item.receipts_till_date,
      availableOnSite: item.available,
      consumedDay: item.consumption,
      consumedCum: '',
    })) || [],
    concreteToday: dpr?.concrete_today || [],
    constraints: dpr?.constraints || '',
    rfi: dpr?.rfi || '',
    preparedBy: dpr?.prepared_by || '',
    approvedBy: dpr?.approved_by || '',
    distributionList: [project?.client, project?.consultant, 'BCIM'].filter(Boolean).join(' / '),
    totalWorkers: totalDirectDay + totalDirectNight + totalSubDay + totalSubNight,
  };
}

export default function DPRPrintTemplate({ dpr, project }) {
  const view = mapTemplateData(dpr, project);

  return (
    <div className="planning-dpr-print-root" style={{ background: '#eef3f8', padding: '16px' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .planning-dpr-print-root, .planning-dpr-print-root * { visibility: visible; }
          .planning-dpr-print-root { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; padding: 0 !important; }
          .planning-dpr-print-hide { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="planning-dpr-print-hide" style={{ marginBottom: '12px', textAlign: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{ background: '#1b3a52', color: '#fff', border: 'none', padding: '10px 26px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
        >
          Print / Save as PDF
        </button>
      </div>

      <div style={{ width: '794px', maxWidth: '100%', margin: '0 auto', background: '#fff', fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: '10px', color: '#111', lineHeight: 1.4, boxShadow: '0 2px 20px rgba(0,0,0,0.12)', padding: '22px 28px' }}>
        <div style={{ background: '#1b3a52', color: '#fff', textAlign: 'center', padding: '7px 0', fontSize: '14px', fontWeight: 700, letterSpacing: '3px', marginBottom: '6px' }}>
          DAILY PROGRESS REPORT
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '9.5px', gap: '12px' }}>
          <div style={{ fontWeight: 700, maxWidth: '200px' }}>{view.client}</div>
          <div style={{ fontWeight: 700, textAlign: 'center', maxWidth: '240px' }}>{view.consultant}</div>
          <div style={{ fontWeight: 700, textAlign: 'right', maxWidth: '160px' }}>{view.contractor}</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', fontSize: '10px', border: '1px solid #7a9bb5' }}>
          <tbody>
            <tr style={{ background: '#eaf2f8' }}>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700, width: '14%' }}>PROJECT</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', width: '14%' }}>Name of Work:</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700, width: '22%' }} colSpan={2}>{view.projectName}</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700, width: '16%' }}>Report For</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700, width: '16%' }}>{view.reportFor}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} />
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>Employer:</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} colSpan={2}>{view.employer}</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700 }}>Submission Date</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>{view.submissionDate}</td>
            </tr>
            <tr style={{ background: '#eaf2f8' }}>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} />
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>Consultant</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} colSpan={2}>{view.consultantName}</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700 }}>Project Start Date</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>{view.projectStart}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} />
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>Contract No.:</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} colSpan={2}>{view.contractNo}</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700 }}>Project Finish Date</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>{view.projectFinish}</td>
            </tr>
            <tr style={{ background: '#eaf2f8' }}>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} />
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>Main Contractor:</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} colSpan={2}>{view.mainContractor}</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} colSpan={2}>
                Total Duration: <b>{view.totalDuration}</b> days | Elapsed: <b>{view.elapsed}</b> Days | Balance: <b>{view.balance}</b> Days
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700 }}>Rain Log</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }} colSpan={3}>{view.rainLog}</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px', fontWeight: 700 }}>Site Conditions</td>
              <td style={{ border: '1px solid #7a9bb5', padding: '3px 8px' }}>{view.siteConditions}</td>
            </tr>
          </tbody>
        </table>

        <SectionHead>Work Progress</SectionHead>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
          <thead>
            <tr>
              <TH style={{ textAlign: 'left', width: '28%' }}>Activity Description</TH>
              <TH style={{ width: '5%' }}>Unit</TH>
              <TH style={{ width: '8%' }}>BOQ Qty</TH>
              <TH style={{ width: '8%' }}>Planned</TH>
              <TH style={{ width: '8%' }}>Achieved</TH>
              <TH style={{ width: '12%' }}>Planned Next / Remarks</TH>
              <TH style={{ width: '9%' }}>Cum. Qty</TH>
              <TH style={{ width: '8%' }}>Cum. %</TH>
            </tr>
          </thead>
          <tbody>
            {view.workProgress.map((row, i) => (
              <tr key={`${row.description}-${i}`} style={{ background: i % 2 === 0 ? '#f4f8fb' : '#fff' }}>
                <TD style={{ fontWeight: row.achievedToday ? 700 : 400 }}>{row.description}</TD>
                <TD style={{ textAlign: 'center' }}>{row.unit}</TD>
                <TD style={{ textAlign: 'right' }}>{fmt(row.boqQty)}</TD>
                <TD style={{ textAlign: 'center' }}>{fmt(row.plannedToday)}</TD>
                <TD style={{ textAlign: 'center', background: Number(row.achievedToday) > 0 ? '#d4edda' : 'inherit', fontWeight: Number(row.achievedToday) > 0 ? 700 : 400 }}>{fmt(row.achievedToday)}</TD>
                <TD style={{ textAlign: 'left' }}>{row.plannedNextDay}</TD>
                <TD style={{ textAlign: 'right' }}>{fmt(row.cumQty)}</TD>
                <TD style={{ textAlign: 'center' }}>{row.cumPct}</TD>
              </tr>
            ))}
          </tbody>
        </table>

        {!!view.concreteToday.length && (
          <>
            <SectionHead>Concrete Consumption</SectionHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
              <thead>
                <tr>
                  <TH style={{ textAlign: 'left' }}>Grade</TH>
                  <TH style={{ textAlign: 'left' }}>Supplier</TH>
                  <TH>Qty (Cum)</TH>
                </tr>
              </thead>
              <tbody>
                {view.concreteToday.filter((item) => item.qty).map((item, i) => (
                  <tr key={`${item.grade}-${i}`} style={{ background: i % 2 === 0 ? '#f4f8fb' : '#fff' }}>
                    <TD>{item.grade}</TD>
                    <TD>{item.supplier}</TD>
                    <TD style={{ textAlign: 'right' }}>{fmt(item.qty)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <SectionHead>Resources</SectionHead>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 0.8fr', gap: '6px', marginTop: '4px' }}>
          <div>
            <div style={{ background: '#2e6091', color: '#fff', fontWeight: 700, fontSize: '9.5px', padding: '3px 6px', textTransform: 'uppercase' }}>Staff</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
              <thead><tr><TH style={{ textAlign: 'left' }}>Category</TH><TH>Nos</TH></tr></thead>
              <tbody>
                {view.staff.map((row, i) => (
                  <tr key={`${row.category}-${i}`} style={{ background: i % 2 === 0 ? '#f4f8fb' : '#fff' }}>
                    <TD>{row.category}</TD>
                    <TD style={{ textAlign: 'center' }}>{fmt(row.nos)}</TD>
                  </tr>
                ))}
                <tr style={{ background: '#d0e8f5', fontWeight: 700 }}>
                  <TD>Total</TD>
                  <TD style={{ textAlign: 'center' }}>{sumNos(view.staff)}</TD>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ background: '#2e6091', color: '#fff', fontWeight: 700, fontSize: '9.5px', padding: '3px 6px', textTransform: 'uppercase' }}>Daily Labour Report</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
              <div>
                <div style={{ background: '#3d7ab5', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 5px' }}>Direct Workers</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead><tr><TH style={{ textAlign: 'left' }}>Category</TH><TH>Day</TH><TH>Night</TH></tr></thead>
                  <tbody>
                    {view.directWorkers.map((row, i) => (
                      <tr key={`${row.category}-${i}`} style={{ background: i % 2 === 0 ? '#f4f8fb' : '#fff' }}>
                        <TD>{row.category}</TD>
                        <TD style={{ textAlign: 'center' }}>{fmt(row.day)}</TD>
                        <TD style={{ textAlign: 'center' }}>{fmt(row.night)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div style={{ background: '#3d7ab5', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 5px' }}>Sub-Contractors</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead><tr><TH style={{ textAlign: 'left' }}>Name</TH><TH>Day</TH><TH>Night</TH></tr></thead>
                  <tbody>
                    {view.subContractors.map((row, i) => (
                      <tr key={`${row.name}-${i}`} style={{ background: i % 2 === 0 ? '#f4f8fb' : '#fff' }}>
                        <TD>{row.name || row.work}</TD>
                        <TD style={{ textAlign: 'center' }}>{fmt(row.day)}</TD>
                        <TD style={{ textAlign: 'center' }}>{fmt(row.night)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '6px', background: '#d0e8f5', border: '1px solid #7a9bb5', padding: '3px 6px', fontSize: '9px', fontWeight: 700 }}>
                  TOTAL WORKERS: {view.totalWorkers}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ background: '#2e6091', color: '#fff', fontWeight: 700, fontSize: '9.5px', padding: '3px 6px', textTransform: 'uppercase' }}>Plant & Machinery</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
              <thead><tr><TH style={{ textAlign: 'left' }}>Equipment</TH><TH>Nos</TH></tr></thead>
              <tbody>
                {view.plant.map((row, i) => (
                  <tr key={`${row.description}-${i}`} style={{ background: i % 2 === 0 ? '#f4f8fb' : '#fff' }}>
                    <TD>{row.description}</TD>
                    <TD style={{ textAlign: 'center' }}>{fmt(row.nos)}</TD>
                  </tr>
                ))}
                <tr style={{ background: '#d0e8f5' }}>
                  <TD style={{ fontWeight: 700 }}>Total</TD>
                  <TD style={{ textAlign: 'center', fontWeight: 700 }}>{sumNos(view.plant)}</TD>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {!!view.materials.length && (
          <>
            <SectionHead>Material</SectionHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginTop: '2px' }}>
              <thead>
                <tr>
                  <TH style={{ textAlign: 'left', width: '20%' }}>Description</TH>
                  <TH style={{ width: '8%' }}>Unit</TH>
                  <TH style={{ width: '10%' }}>Receipt (Day)</TH>
                  <TH style={{ width: '12%' }}>Receipt (Till Date)</TH>
                  <TH style={{ width: '12%' }}>Available on Site</TH>
                  <TH style={{ width: '12%' }}>Consumption (Day)</TH>
                </tr>
              </thead>
              <tbody>
                {view.materials.map((row, i) => (
                  <tr key={`${row.description}-${i}`} style={{ background: i % 2 === 0 ? '#f4f8fb' : '#fff' }}>
                    <TD>{row.description}</TD>
                    <TD style={{ textAlign: 'center' }}>{row.unit}</TD>
                    <TD style={{ textAlign: 'right' }}>{fmt(row.receiptDay)}</TD>
                    <TD style={{ textAlign: 'right' }}>{fmt(row.receiptTillDate)}</TD>
                    <TD style={{ textAlign: 'right' }}>{fmt(row.availableOnSite)}</TD>
                    <TD style={{ textAlign: 'right' }}>{fmt(row.consumedDay)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
          <div>
            <div style={{ background: '#1b3a52', color: '#fff', fontWeight: 700, fontSize: '9.5px', padding: '3px 8px', textTransform: 'uppercase' }}>Constraints</div>
            <div style={{ border: '1px solid #b0c8dc', minHeight: '36px', padding: '5px 8px', fontSize: '9.5px', background: '#f4f8fb' }}>{view.constraints}</div>
          </div>
          <div>
            <div style={{ background: '#1b3a52', color: '#fff', fontWeight: 700, fontSize: '9.5px', padding: '3px 8px', textTransform: 'uppercase' }}>RFI</div>
            <div style={{ border: '1px solid #b0c8dc', minHeight: '36px', padding: '5px 8px', fontSize: '9.5px', background: '#f4f8fb' }}>{view.rfi}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '22px', paddingTop: '8px', borderTop: '2px solid #1b3a52' }}>
          <div style={{ textAlign: 'center', minWidth: '120px', fontSize: '9.5px' }}>
            <div style={{ marginBottom: '24px', color: '#555' }}>Distribution List:</div>
            <div style={{ borderTop: '1px solid #444', paddingTop: '4px', fontWeight: 700 }}>{view.distributionList}</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '120px', fontSize: '9.5px' }}>
            <div style={{ marginBottom: '24px' }}>&nbsp;</div>
            <div style={{ borderTop: '1px solid #444', paddingTop: '4px', fontWeight: 700 }}>Prepared by: {view.preparedBy}</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '120px', fontSize: '9.5px' }}>
            <div style={{ marginBottom: '24px' }}>&nbsp;</div>
            <div style={{ borderTop: '1px solid #444', paddingTop: '4px', fontWeight: 700 }}>Approved by: {view.approvedBy}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
