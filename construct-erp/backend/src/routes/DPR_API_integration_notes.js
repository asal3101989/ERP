// ─── DPR API additions ────────────────────────────────────────────────────────
// Add these methods to your existing planningAPI object in src/api/client.js

/*
  planningAPI = {
    ...existingMethods,

    // DPR
    listDPRs:   (params) => api.get('/planning/dpr', { params }),
    getDPR:     (id)     => api.get(`/planning/dpr/${id}`),
    createDPR:  (data)   => api.post('/planning/dpr', data),
    updateDPR:  (id, data) => api.put(`/planning/dpr/${id}`, data),
    deleteDPR:  (id)     => api.delete(`/planning/dpr/${id}`),
    approveDPR: (id)     => api.patch(`/planning/dpr/${id}/approve`),
  };
*/

// ─── Route addition ───────────────────────────────────────────────────────────
// Add to your router (e.g. src/router/index.jsx or App.jsx):

/*
  import DPRPage from './pages/planning/DPRPage';

  // Inside your planning routes:
  { path: '/planning/dpr', element: <DPRPage /> }
*/

// ─── Quick Link addition to PlanningDashboard.jsx ─────────────────────────────
// Add this entry to the quickLinks array in PlanningDashboard.jsx:

/*
  { to: '/planning/dpr', label: 'Submit DPR', icon: FileText },
*/

// ─── Backend schema reference (Django / Express / FastAPI) ────────────────────
// The DPR document stores the following shape (JSON):
//
// {
//   id, project_id, report_date, status,          // draft | submitted | approved
//   weather,                                       // sunny | cloudy | rainy | normal
//   site_conditions,                               // Dry | Slushy | Wet | Rainy
//   rain_log,
//
//   work_items: [{ description, unit, boq_qty, planned, achieved, cumulative, remarks }],
//
//   concrete_today: [{ grade, supplier, qty }],
//
//   staff: [{ category, nos }],
//   direct_workers: [{ category, day, night }],
//   subcontractors: [{ name, work, day, night }],
//
//   plant_items: [{ item, nos }],
//
//   steel: [{ dia, receipts_today, receipts_till_date, available, consumption }],
//
//   constraints, rfi,
//   prepared_by, approved_by,
//   created_at, updated_at, created_by_id, approved_by_id, approved_at
// }
