// src/api/client.js
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor: auto refresh token ────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── API modules ──────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data) => api.post('/auth/login', data),
  register:       (data) => api.post('/auth/register', data),
  logout:         (data) => api.post('/auth/logout', data),
  refresh:        (data) => api.post('/auth/refresh', data),
  me:             ()     => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const projectAPI = {
  list:      (params) => api.get('/projects', { params }),
  get:       (id)     => api.get(`/projects/${id}`),
  dashboard: (id)     => api.get(`/projects/${id}/dashboard`),
  create:    (data)   => api.post('/projects', data),
  update:    (id, d)  => api.put(`/projects/${id}`, d),
  delete:    (id)     => api.delete(`/projects/${id}`),
};

export const meetingsAPI = {
  list:      (params) => api.get('/meetings', { params }),
  create:    (data)   => api.post('/meetings', data),
  close:     (id)     => api.patch(`/meetings/${id}/close`),
};

export const subcontractorAPI = {
  // Dashboard
  getDashboard:      (params) => api.get('/subcontractors/dashboard', { params }),
  // Work Orders
  listWorkOrders:    (params) => api.get('/subcontractors/work-orders', { params }),
  getWorkOrder:      (id)     => api.get(`/subcontractors/work-orders/${id}`),
  createWorkOrder:   (data)   => api.post('/subcontractors/work-orders', data),
  updateWorkOrder:   (id, d)  => api.patch(`/subcontractors/work-orders/${id}`, d),
  importWOPreview:   (file)   => { const fd = new FormData(); fd.append('file', file); return api.post('/subcontractors/work-orders/import/preview', fd, { headers: { 'Content-Type': undefined } }); },
  importWOConfirm:   (data)   => api.post('/subcontractors/work-orders/import/confirm', data),
  // Measurements
  getMeasurements:   (params) => api.get('/subcontractors/measurements', { params }),
  recordMeasurement: (data)   => api.post('/subcontractors/measurements', data),
  // Bills
  createBill:        (data)   => api.post('/subcontractors/bills', data),
  listBills:         (params) => api.get('/subcontractors/bills', { params }),
  getBill:           (id)     => api.get(`/subcontractors/bills/${id}`),
  updateBill:        (id, d)  => api.patch(`/subcontractors/bills/${id}`, d),
};

export const boqAPI = {
  list:    (params) => api.get('/boq', { params }),
  summary: (pid)    => api.get(`/boq/summary/${pid}`),
  create:  (data)   => api.post('/boq', data),
  update:  (id, d)  => api.put(`/boq/${id}`, d),
  delete:  (id)     => api.delete(`/boq/${id}`),
  import:  (data)   => api.post('/boq/import', data, { headers: { 'Content-Type': undefined } }),
};

export const measurementAPI = {
  list:    (params)   => api.get('/measurements', { params }),
  create:  (data)     => api.post('/measurements', data),
  approve: (id, data) => api.patch(`/measurements/${id}/approve`, data),
  import:  (data)     => api.post('/measurements/import', data, { headers: { 'Content-Type': undefined } }),
};

export const raBillAPI = {
  list:          (params) => api.get('/ra-bills', { params }),
  get:           (id)     => api.get(`/ra-bills/${id}`),
  create:        (data)   => api.post('/ra-bills', data),
  verify:        (id)     => api.patch(`/ra-bills/${id}/verify`),
  approve:       (id, d)  => api.patch(`/ra-bills/${id}/approve`, d),
  reject:        (id, d)  => api.patch(`/ra-bills/${id}/reject`, d),
  pay:           (id, d)  => api.patch(`/ra-bills/${id}/pay`, d),
  delete:        (id)     => api.delete(`/ra-bills/${id}`),
  getPrevStats:  (params) => api.get('/ra-bills/previous-stats', { params }),
};

export const retentionAPI = {
  list:    (params) => api.get('/retention-releases', { params }),
  summary: (params) => api.get('/retention-releases/summary', { params }),
  get:     (id)     => api.get(`/retention-releases/${id}`),
  create:  (data)   => api.post('/retention-releases', data),
  approve: (id)     => api.patch(`/retention-releases/${id}/approve`),
  reject:  (id, d)  => api.patch(`/retention-releases/${id}/reject`, d),
  release: (id, d)  => api.patch(`/retention-releases/${id}/release`, d),
  remove:  (id)     => api.delete(`/retention-releases/${id}`),
};

export const invoiceAPI = {
  list:       (params)  => api.get('/invoices', { params }),
  get:        (id)      => api.get(`/invoices/${id}`),
  create:     (data)    => api.post('/invoices', data),
  verify:     (id)      => api.patch(`/invoices/${id}/verify`),
  authorize:  (id)      => api.patch(`/invoices/${id}/authorize`),
  reject:     (id)      => api.patch(`/invoices/${id}/reject`),
  gstSummary: (params)  => api.get('/invoices/gst-summary', { params }),
  markPaid:   (id, d)   => api.patch(`/invoices/${id}/mark-paid`, d),
};

export const paymentAPI = {
  list:   (params) => api.get('/payments', { params }),
  create: (data)   => api.post('/payments', data),
  tds:    (params) => api.get('/payments/tds-report', { params }),
};

export const vendorAPI = {
  list:    (params) => api.get('/vendors', { params }),
  get:     (id)     => api.get(`/vendors/${id}`),
  create:  (data)   => api.post('/vendors', data),
  update:  (id, d)  => api.put(`/vendors/${id}`, d),
  delete:  (id)     => api.delete(`/vendors/${id}`),
  import:  (data)   => api.post('/vendors/import', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  compare: (params) => api.get('/vendors/compare', { params }),
  liveCheck: (params) => api.get('/vendors/live-check', { params }),
};

export const poAPI = {
  list:      (params)        => api.get('/purchase-orders', { params }),
  get:       (id)            => api.get(`/purchase-orders/${id}`),
  create:    (data)          => api.post('/purchase-orders', data),
  approve:   (id, stage, data) => api.patch(`/purchase-orders/${id}/${stage}`, data),
  receive:   (id, data)      => api.patch(`/purchase-orders/${id}/receive`, data),
  renumber:  (id, display)   => api.patch(`/purchase-orders/${id}/renumber`, { po_number_display: display }),
  importPreview: (file) => { const fd = new FormData(); fd.append('file', file); return api.post('/purchase-orders/import/preview', fd, { headers: { 'Content-Type': undefined } }); },
  importConfirm: (data) => api.post('/purchase-orders/import/confirm', data),
};

export const poAmendmentAPI = {
  list:   (params) => api.get('/procurement/po-amendments', { params }),
  create: (data)   => api.post('/procurement/po-amendments', data),
  approve:(id)     => api.patch(`/procurement/po-amendments/${id}/approve`),
  reject: (id)     => api.patch(`/procurement/po-amendments/${id}/reject`),
  delete: (id)     => api.delete(`/procurement/po-amendments/${id}`),
};

export const grnAPI = {
  list:    (params)   => api.get('/grn', { params }),
  get:     (id)       => api.get(`/grn/${id}`),
  create:  (data)     => api.post('/grn', data),
  update:  (id, data) => api.put(`/grn/${id}`, data),
  delete:  (id)       => api.delete(`/grn/${id}`),
  approve: (id, stage) => api.patch(`/grn/${id}/${stage}`),
};

export const inventoryAPI = {
  list:          (params) => api.get('/inventory', { params }),
  create:        (data)   => api.post('/inventory', data),
  categories:    ()       => api.get('/inventory/categories'),
  itemsLookup:   ()       => api.get('/inventory/items-lookup'),
  monthlyReport: (params) => api.get('/inventory/monthly-report', { params }),
  valuation:     (params) => api.get('/inventory/valuation', { params }),
  ledger:        (inventory_id) => api.get('/inventory/ledger', { params: { inventory_id } }),
  issue:         (data)   => api.post('/inventory/issue', data),
  transfer:      (data)   => api.post('/inventory/transfer', data),
  lowStock:      (params) => api.get('/inventory/low-stock', { params }),
  getBatches:    (id)     => api.get(`/inventory/${id}/batches`),
  update:        (id, data) => api.patch(`/inventory/${id}`, data),
  importPreview: (file)   => { const fd = new FormData(); fd.append('file', file); return api.post('/inventory/import/preview', fd, { headers: { 'Content-Type': undefined } }); },
  importData:    (file, project_id, site_location, overwrite) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', project_id);
    fd.append('site_location', site_location || 'main');
    fd.append('overwrite', overwrite ? 'true' : 'false');
    return api.post('/inventory/import', fd, { headers: { 'Content-Type': undefined } });
  },
};

export const workerAPI = {
  list:   (params) => api.get('/workers', { params }),
  get:    (id)     => api.get(`/workers/${id}`),
  create: (data)   => api.post('/workers', data),
  update: (id, d)  => api.put(`/workers/${id}`, d),
};

export const attendanceAPI = {
  list:     (params) => api.get('/attendance', { params }),
  bulkMark: (data)   => api.post('/attendance/bulk', data),
  summary:  (params) => api.get('/attendance/summary', { params }),
};

export const payrollAPI = {
  list:     (params) => api.get('/payroll', { params }),
  generate: (data)   => api.post('/payroll/generate', data),
  pay:      (id)     => api.patch(`/payroll/${id}/pay`),
};

export const dprAPI = {
  list:   (params) => api.get('/dpr', { params }),
  get:    (id)     => api.get(`/dpr/${id}`),
  create: (data)   => api.post('/dpr', data),
};

export const planningAPI = {
  // DPR
  listDPRs:       (p)     => api.get('/planning/dpr', { params: p }),
  getDPR:         (id)    => api.get(`/planning/dpr/${id}`),
  createDPR:      (d)     => api.post('/planning/dpr', d),
  updateDPR:      (id, d) => api.put(`/planning/dpr/${id}`, d),
  deleteDPR:      (id)    => api.delete(`/planning/dpr/${id}`),
  approveDPR:     (id)    => api.patch(`/planning/dpr/${id}/approve`),
  importDPR:      (file, projectId, overwrite = true) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', projectId);
    fd.append('overwrite', overwrite ? 'true' : 'false');
    return api.post('/planning/dpr/import', fd, { headers: { 'Content-Type': undefined } });
  },

  // Activities
  listActivities:  (p)     => api.get('/planning/activities', { params: p }),
  getActivity:     (id)    => api.get(`/planning/activities/${id}`),
  createActivity:  (d)     => api.post('/planning/activities', d),
  updateActivity:  (id, d) => api.put(`/planning/activities/${id}`, d),
  deleteActivity:  (id)    => api.delete(`/planning/activities/${id}`),
  updateProgress:  (id, d) => api.patch(`/planning/activities/${id}/progress`, d),

  // Milestones
  listMilestones:  (p)     => api.get('/planning/milestones', { params: p }),
  createMilestone: (d)     => api.post('/planning/milestones', d),
  updateMilestone: (id, d) => api.put(`/planning/milestones/${id}`, d),
  achieveMilestone:(id, d) => api.patch(`/planning/milestones/${id}/achieve`, d),

  // Look-Ahead Plans
  getLookAhead:    (p)     => api.get('/planning/look-ahead', { params: p }),
  saveLookAhead:   (d)     => api.post('/planning/look-ahead', d),
  approveLookAhead:(id)    => api.patch(`/planning/look-ahead/${id}/approve`),

  // Progress Tracking
  listProgress:    (p)     => api.get('/planning/progress', { params: p }),
  recordProgress:  (d)     => api.post('/planning/progress', d),

  // S-Curve
  getScurve:       (p)     => api.get('/planning/scurve', { params: p }),
  snapshotScurve:  (d)     => api.post('/planning/scurve/snapshot', d),

  // Delay Analysis
  listDelays:      (p)     => api.get('/planning/delays', { params: p }),
  logDelay:        (d)     => api.post('/planning/delays', d),
  updateDelay:     (id, d) => api.put(`/planning/delays/${id}`, d),

  // Dashboard
  getDashboard:    (p)     => api.get('/planning/dashboard', { params: p }),
};

export const snagAPI = {
  list:      (p)     => api.get('/snags', { params: p }),
  get:       (id)    => api.get(`/snags/${id}`),
  create:    (d)     => api.post('/snags', d),
  update:    (id, d) => api.put(`/snags/${id}`, d),
  setStatus: (id, d) => api.patch(`/snags/${id}/status`, d),
  qaSignOff: (id, d) => api.patch(`/snags/${id}/qa-signoff`, d),
  remove:    (id)    => api.delete(`/snags/${id}`),
  getStats:  (p)     => api.get('/snags/stats', { params: p }),
};

export const incidentAPI = {
  list:            (params) => api.get('/incidents', { params }),
  get:             (id)     => api.get(`/incidents/${id}`),
  create:          (data)   => api.post('/incidents', data),
  addCapa:         (id, d)  => api.post(`/incidents/${id}/capa`, d),
  safetyDashboard: (params) => api.get('/incidents/safety-dashboard', { params }),
};

export const permitAPI = {
  list:   (params) => api.get('/permits', { params }),
  get:    (id)     => api.get(`/permits/${id}`),
  create: (data)   => api.post('/permits', data),
  close:  (id)     => api.patch(`/permits/${id}/close`),
};

export const materialReconAPI = {
  list:    (params) => api.get('/material-recon', { params }),
  audit:   (projectId) => api.get(`/material-recon/audit/${projectId}`),
  summary: (projectId) => api.get(`/material-recon/summary/${projectId}`),
  create:  (data)   => api.post('/material-recon', data),
};

export const variationAPI = {
  list:          (params) => api.get('/variations', { params }),
  get:           (id)     => api.get(`/variations/${id}`),
  create:        (data)   => api.post('/variations', data),
  approve:       (id)     => api.patch(`/variations/${id}/approve`),
  approvedItems: (params) => api.get('/variations/approved-items', { params }),
};

export const normsAPI = {
  list:   (params) => api.get('/norms', { params }),
  create: (data)   => api.post('/norms', data),
  delete: (id)     => api.delete(`/norms/${id}`),
};

export const ppeAPI = {
  list:   (params) => api.get('/ppe', { params }),
  issue:  (data)   => api.post('/ppe', data),
  return: (id)     => api.patch(`/ppe/${id}/return`),
  expiry: (params) => api.get('/ppe/expiring', { params }),
};

export const assetAPI = {
  list:        (params) => api.get('/assets', { params }),
  get:         (id)     => api.get(`/assets/${id}`),
  create:      (data)   => api.post('/assets', data),
  update:      (id, d)  => api.put(`/assets/${id}`, d),
  logFuel:     (data)   => api.post('/assets/logs/fuel', data),
  logUsage:    (data)   => api.post('/assets/logs/usage', data),
  transfer:    (data)   => api.post('/assets/transfer', data),
  maintenance: (data)   => api.post('/assets/maintenance', data),
};

export const itAssetAPI = {
  list:   (params) => api.get('/it-assets', { params }),
  create: (data)   => api.post('/it-assets', data),
  update: (id, d)  => api.put(`/it-assets/${id}`, d),
  import: (rows)   => api.post('/it-assets/import', { rows }),
};

export const itTicketAPI = {
  list:    (params)   => api.get('/it-tickets', { params }),
  get:     (id)       => api.get(`/it-tickets/${id}`),
  create:  (data)     => api.post('/it-tickets', data),
  update:  (id, data) => api.patch(`/it-tickets/${id}`, data),
  resolve: (id, data) => api.patch(`/it-tickets/${id}/resolve`, data),
};

export const licenseAPI = {
  list:      (params) => api.get('/licenses', { params }),
  create:    (data)   => api.post('/licenses', data),
  update:    (id, d)  => api.put(`/licenses/${id}`, d),
  remove:    (id)     => api.delete(`/licenses/${id}`),
  listAMC:   (params) => api.get('/licenses/amc', { params }),
  createAMC: (data)   => api.post('/licenses/amc', data),
};

export const budgetAPI = {
  list:   (params) => api.get('/budget', { params }),
  create: (data)   => api.post('/budget', data),
  update: (id, d)  => api.put(`/budget/${id}`, d),
  delete: (id)     => api.delete(`/budget/${id}`),
};
export const qualityAPI = {
  // Checklists
  listChecklists: (params) => api.get('/quality/checklists', { params }),
  createChecklist: (data)   => api.post('/quality/checklists', data),
  
  // RFI
  listRFI:           (params) => api.get('/quality/rfi', { params }),
  createRFI:         (data)   => api.post('/quality/rfi', data),
  inspectRFI:        (id, d)  => api.patch(`/quality/rfi/${id}/inspect`, d),
  signRFI:           (id, d)  => api.patch(`/quality/rfi/${id}/sign`, d),
  updateRFIAttachments: (id, attachments) => api.patch(`/quality/rfi/${id}/attachments`, { attachments }),

  // NCR
  listNCR:           (params) => api.get('/quality/ncr', { params }),
  createNCR:         (data)   => api.post('/quality/ncr', data),
  saveRCA:           (id, d)  => api.patch(`/quality/ncr/${id}/rca`, d),
  verifyNCR:         (id, d)  => api.patch(`/quality/ncr/${id}/verify`, d),
  updateNCRAttachments: (id, attachments) => api.patch(`/quality/ncr/${id}/attachments`, { attachments }),

  // Drawings
  listDrawings:   (params) => api.get('/quality/drawings', { params }),
  createDrawing:  (data)   => api.post('/quality/drawings', data),

  // Submittals
  listSubmittals: (params) => api.get('/quality/submittals', { params }),
  createSubmittal: (data)  => api.post('/quality/submittals', data),
  updateSubmittalStatus: (id, data) => api.patch(`/quality/submittals/${id}/status`, data),
  
  // Lab Tests
  listLabTests:   (params) => api.get('/quality/lab-tests', { params }),
  createLabTest:  (data)   => api.post('/quality/lab-tests', data),
  updateLabTestAttachments: (id, attachments) => api.patch(`/quality/lab-tests/${id}/attachments`, { attachments }),
};

export const mrsAPI = {
  list:    (params) => api.get('/stores/mrs', { params }),
  get:     (id)     => api.get(`/stores/mrs/${id}`),
  create:  (data)   => api.post('/stores/mrs', data),
  approve: (id, stage, data) => api.patch(`/stores/mrs/${id}/${stage}`, data),
  reject:  (id, data) => api.patch(`/stores/mrs/${id}/reject`, data),
};

export const minAPI = {
  list:      (params) => api.get('/stores/min', { params }),
  get:       (id)     => api.get(`/stores/min/${id}`),
  create:    (data)   => api.post('/stores/min', data),
  authorize: (id)     => api.patch(`/stores/min/${id}/authorize`),
  receive:   (id, data) => api.patch(`/stores/min/${id}/receive`, data),
};

export const bookingAPI = {
  list:            (params) => api.get('/bookings', { params }),
  get:             (id)     => api.get(`/bookings/${id}`),
  create:          (data)   => api.post('/bookings', data),
  schedulePayment: (data)   => api.post('/bookings/payment-schedule', data),
};

export const reportAPI = {
  profitability: (params) => api.get('/reports/profitability', { params }),
  gstReport:     (params) => api.get('/reports/gst', { params }),
  tdsReport:     (params) => api.get('/reports/tds', { params }),
  vendorLedger:  (params) => api.get('/reports/vendor-ledger', { params }),
  laborReport:   (params) => api.get('/reports/labor', { params }),
  stockReport:   (params) => api.get('/reports/stock', { params }),
  boqActual:     (params) => api.get('/reports/boq-actual', { params }),
  safetyReport:  (params) => api.get('/reports/safety', { params }),
  projectPL:     (params) => api.get('/reports/project-pl', { params }),
};

export const uploadAPI = {
  upload: (formData) => api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const indentAPI = {
  list:     (params) => api.get('/indents', { params }),
  get:      (id)     => api.get(`/indents/${id}`),
  create:   (data)   => api.post('/indents', data),
  submit:   (id)     => api.patch(`/indents/${id}/submit`),
  approve:  (id, data) => api.patch(`/indents/${id}/approve`, data),
  reject:   (id, data) => api.patch(`/indents/${id}/reject`, data),
  escalate: (id, data) => api.patch(`/indents/${id}/escalate`, data),
};

export const quotationAPI = {
  list:       (params)  => api.get('/quotations', { params }),
  getCS:      (mrsId)   => api.get(`/quotations/comparison/${mrsId}`),
  create:     (data)    => api.post('/quotations', data),
  verifyCS:   (mrsId)   => api.patch(`/quotations/comparison/${mrsId}/verify`),
  checkCS:    (mrsId)   => api.patch(`/quotations/comparison/${mrsId}/check`),
  approveCS:  (mrsId, data) => api.patch(`/quotations/comparison/${mrsId}/approve`, data),
};

export const analyticsAPI = {
  global:     ()        => api.get('/analytics/global'),
  executive:  (params)  => api.get('/analytics/executive', { params }),
  project360: (id)      => api.get(`/analytics/project-360/${id}`),
};

export const documentsAPI = {
  list:    (params)   => api.get('/documents', { params }),
  modules: ()         => api.get('/documents/modules'),
  upload:  (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete:  (id)       => api.delete(`/documents/${id}`),
};

export const dqsBillsAPI = {
  list:         (params)   => api.get('/dqs/bills', { params }),
  get:          (id)       => api.get(`/dqs/bills/${id}`),
  create:       (data)     => api.post('/dqs/bills', data),
  importExcel:  (fd)       => api.post('/dqs/bills/import-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:       (id, d)    => api.put(`/dqs/bills/${id}`, d),
  updateStores: (id, d)    => api.patch(`/dqs/bills/${id}/stores`, d),
  updateDocumentControl: (id, d) => api.patch(`/dqs/bills/${id}/document-control`, d),
  updateQS:     (id, d)    => api.patch(`/dqs/bills/${id}/qs`, d),
  updateAccounts:(id, d)   => api.patch(`/dqs/bills/${id}/accounts`, d),
  updateProcurement:(id, d)=> api.patch(`/dqs/bills/${id}/procurement`, d),
  updatePayment:(id, d)    => api.patch(`/dqs/bills/${id}/payment`, d),
  uploadFile:   (id, fd)   => api.post(`/dqs/bills/${id}/files`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  syncFileToOneDrive: (id, fid) => api.post(`/dqs/bills/${id}/files/${fid}/sync-onedrive`),
  deleteFile:   (id, fid)  => api.delete(`/dqs/bills/${id}/files/${fid}`),
  delete:       (id)       => api.delete(`/dqs/bills/${id}`),
  // ── Cross-module lookups ──
  lookupPOs:        (params)   => api.get('/dqs/bills/lookup/pos',        { params }),
  lookupGRNs:       (params)   => api.get('/dqs/bills/lookup/grns',       { params }),
  lookupPOBalance:  (po_id)    => api.get('/dqs/bills/lookup/po-balance',  { params: { po_id } }),
  // ── RA Bill Summary + Payment Certificate ──
  getRASummary:       (id)    => api.get(`/dqs/bills/${id}/ra-summary`),
  generatePaymentCert:(id)    => api.post(`/dqs/bills/${id}/payment-certificate`),
  signPaymentCert:    (id, d) => api.patch(`/dqs/bills/${id}/payment-certificate/sign`, d),
  // ── Vendor Ledger + AP Aging ──
  getVendorLedger: (params) => api.get('/dqs/bills/vendor-ledger', { params }),
  getAPAging:      (params) => api.get('/dqs/bills/ap-aging',      { params }),
  updateMeta:      (id, d)  => api.patch(`/dqs/bills/${id}/meta`, d),
};

export const dqsTrackerAPI = {
  list:      (params) => api.get('/dqs/material-tracker', { params }),
  lifecycle: (params) => api.get('/dqs/material-tracker/lifecycle', { params }),
  create: (data)   => api.post('/dqs/material-tracker', data),
  update: (id, d)  => api.put(`/dqs/material-tracker/${id}`, d),
  delete: (id)     => api.delete(`/dqs/material-tracker/${id}`),
};

export const dqsTransmittalAPI = {
  list:         (params) => api.get('/dqs/transmittals', { params }),
  get:          (id)     => api.get(`/dqs/transmittals/${id}`),
  create:       (data)   => api.post('/dqs/transmittals', data),
  submit:       (id)     => api.patch(`/dqs/transmittals/${id}/submit`),
  receive:      (id, d)  => api.patch(`/dqs/transmittals/${id}/receive`, d),
  delete:       (id)     => api.delete(`/dqs/transmittals/${id}`),
  lookupBills:  (params) => api.get('/dqs/transmittals/lookup/bills', { params }),
};

// ─── HR & Admin API ───────────────────────────────────────────────────────────
export const hrMastersAPI = {
  // Departments
  listDepts:    (params) => api.get('/hr-admin/masters/departments', { params }),
  createDept:   (data)   => api.post('/hr-admin/masters/departments', data),
  updateDept:   (id, d)  => api.put(`/hr-admin/masters/departments/${id}`, d),
  deleteDept:   (id)     => api.delete(`/hr-admin/masters/departments/${id}`),
  // Designations
  listDesigs:   (params) => api.get('/hr-admin/masters/designations', { params }),
  createDesig:  (data)   => api.post('/hr-admin/masters/designations', data),
  updateDesig:  (id, d)  => api.put(`/hr-admin/masters/designations/${id}`, d),
  deleteDesig:  (id)     => api.delete(`/hr-admin/masters/designations/${id}`),
  // Leave Types
  listLeaveTypes:   (params) => api.get('/hr-admin/masters/leave-types', { params }),
  createLeaveType:  (data)   => api.post('/hr-admin/masters/leave-types', data),
  updateLeaveType:  (id, d)  => api.put(`/hr-admin/masters/leave-types/${id}`, d),
  deleteLeaveType:  (id)     => api.delete(`/hr-admin/masters/leave-types/${id}`),
  // Holidays
  listHolidays:   (params) => api.get('/hr-admin/masters/holidays', { params }),
  createHoliday:  (data)   => api.post('/hr-admin/masters/holidays', data),
  updateHoliday:  (id, d)  => api.put(`/hr-admin/masters/holidays/${id}`, d),
  deleteHoliday:  (id)     => api.delete(`/hr-admin/masters/holidays/${id}`),
};

export const hrEmployeesAPI = {
  list:           (params)  => api.get('/hr-admin/employees', { params }),
  get:            (id)      => api.get(`/hr-admin/employees/${id}`),
  create:         (data)    => api.post('/hr-admin/employees', data),
  update:         (id, d)   => api.put(`/hr-admin/employees/${id}`, d),
  updateStatus:   (id, d)   => api.patch(`/hr-admin/employees/${id}/status`, d),
  uploadDocument: (id, fd)  => api.post(`/hr-admin/employees/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteDocument: (id, did) => api.delete(`/hr-admin/employees/${id}/documents/${did}`),
};

export const hrLeaveAPI = {
  getBalances:   (params) => api.get('/hr-admin/leave/balances', { params }),
  updateBalance: (id, d)  => api.put(`/hr-admin/leave/balances/${id}`, d),
  listRequests:  (params) => api.get('/hr-admin/leave/requests', { params }),
  submitRequest: (data)   => api.post('/hr-admin/leave/requests', data),
  approve:       (id)     => api.patch(`/hr-admin/leave/requests/${id}/approve`),
  reject:        (id, d)  => api.patch(`/hr-admin/leave/requests/${id}/reject`, d),
  cancel:        (id)     => api.patch(`/hr-admin/leave/requests/${id}/cancel`),
};

export const hrAttendanceAPI = {
  list:    (params) => api.get('/hr-admin/attendance', { params }),
  summary: (params) => api.get('/hr-admin/attendance/summary', { params }),
  bulk:    (data)   => api.post('/hr-admin/attendance/bulk', data),
  upsert:  (data)   => api.post('/hr-admin/attendance', data),
  update:  (id, d)  => api.put(`/hr-admin/attendance/${id}`, d),
};

export const hrSalaryAPI = {
  listStructures:     (params) => api.get('/hr-admin/salary/structures', { params }),
  createStructure:    (data)   => api.post('/hr-admin/salary/structures', data),
  updateStructure:    (id, d)  => api.put(`/hr-admin/salary/structures/${id}`, d),
  listEmpSalaries:    (params) => api.get('/hr-admin/salary/employee-salaries', { params }),
  getCurrentSalary:   (uid)    => api.get(`/hr-admin/salary/employee-salaries/${uid}/current`),
  assignSalary:       (data)   => api.post('/hr-admin/salary/employee-salaries', data),
};

export const hrPayrollAPI = {
  list:          (params) => api.get('/hr-admin/payroll', { params }),
  get:           (id)     => api.get(`/hr-admin/payroll/${id}`),
  getPayslip:    (id)     => api.get(`/hr-admin/payroll/${id}/payslip`),
  run:           (data)   => api.post('/hr-admin/payroll/run', data),
  update:        (id, d)  => api.put(`/hr-admin/payroll/${id}`, d),
  approve:       (id)     => api.patch(`/hr-admin/payroll/${id}/approve`),
  bulkPay:       (data)   => api.post('/hr-admin/payroll/bulk-pay', data),
  pfEcr:         (params) => api.get('/hr-admin/payroll/reports/pf-ecr', { params }),
  esiReturn:     (params) => api.get('/hr-admin/payroll/reports/esi-return', { params }),
  headcount:     ()       => api.get('/hr-admin/payroll/reports/headcount'),
};

export const hrLoansAPI = {
  list:    (params) => api.get('/hr-admin/loans', { params }),
  create:  (data)   => api.post('/hr-admin/loans', data),
  approve: (id, d)  => api.patch(`/hr-admin/loans/${id}/approve`, d),
  reject:  (id)     => api.patch(`/hr-admin/loans/${id}/reject`),
  repay:   (id, d)  => api.patch(`/hr-admin/loans/${id}/repay`, d),
};

export const hrExpensesAPI = {
  list:    (params) => api.get('/hr-admin/expenses', { params }),
  create:  (fd)     => api.post('/hr-admin/expenses', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approve: (id)     => api.patch(`/hr-admin/expenses/${id}/approve`),
  reject:  (id)     => api.patch(`/hr-admin/expenses/${id}/reject`),
  pay:     (id, d)  => api.patch(`/hr-admin/expenses/${id}/pay`, d),
};

export const hrAppraisalsAPI = {
  list:        (params) => api.get('/hr-admin/appraisals', { params }),
  get:         (id)     => api.get(`/hr-admin/appraisals/${id}`),
  create:      (data)   => api.post('/hr-admin/appraisals', data),
  update:      (id, d)  => api.put(`/hr-admin/appraisals/${id}`, d),
  acknowledge: (id)     => api.patch(`/hr-admin/appraisals/${id}/acknowledge`),
};

export const hrEsslAPI = {
  getConfig:      ()           => api.get('/hr-admin/essl/config'),
  saveConfig:     (data)       => api.post('/hr-admin/essl/config', data),
  testConnection: (data)       => api.post('/hr-admin/essl/test-connection', data),
  preview:        (from, to)   => api.get('/hr-admin/essl/preview', { params: { from, to } }),
  sync:           (from, to)   => api.post('/hr-admin/essl/sync', { from, to }),
  unmatched:      ()           => api.get('/hr-admin/essl/unmatched'),
};

const multipart = { headers: { 'Content-Type': undefined } };
export const hrImportAPI = {
  previewEmployees: (file)       => { const fd = new FormData(); fd.append('file', file); return api.post('/hr-admin/import/preview-employees', fd, multipart); },
  previewAttendance:(file)       => { const fd = new FormData(); fd.append('file', file); return api.post('/hr-admin/import/preview-attendance', fd, multipart); },
  importEmployees:  (file, mode) => { const fd = new FormData(); fd.append('file', file); fd.append('mode', mode); return api.post('/hr-admin/import/employees', fd, multipart); },
  importAttendance: (file, month, year) => { const fd = new FormData(); fd.append('file', file); fd.append('month', month); fd.append('year', year); return api.post('/hr-admin/import/attendance', fd, multipart); },
};

export const notificationsAPI = {
  list: () => api.get('/notifications'),
};

// ─── Tender Management ────────────────────────────────────────────────────────
export const tenderAPI = {
  list:           (p)       => api.get('/tenders', { params: p }),
  stats:          ()        => api.get('/tenders/stats'),
  get:            (id)      => api.get(`/tenders/${id}`),
  create:         (d)       => api.post('/tenders', d),
  update:         (id, d)   => api.put(`/tenders/${id}`, d),
  remove:         (id)      => api.delete(`/tenders/${id}`),
  publish:        (id)      => api.patch(`/tenders/${id}/publish`),
  openBids:       (id)      => api.patch(`/tenders/${id}/open-bids`),
  evaluate:       (id)      => api.patch(`/tenders/${id}/evaluate`),
  award:          (id, d)   => api.patch(`/tenders/${id}/award`, d),
  cancel:         (id, d)   => api.patch(`/tenders/${id}/cancel`, d),
  listVendors:    (id)      => api.get(`/tenders/${id}/vendors`),
  inviteVendors:  (id, d)   => api.post(`/tenders/${id}/vendors`, d),
  removeVendor:   (id, vid) => api.delete(`/tenders/${id}/vendors/${vid}`),
  listScopeItems: (id)      => api.get(`/tenders/${id}/scope-items`),
  addScopeItem:   (id, d)   => api.post(`/tenders/${id}/scope-items`, d),
  updateScopeItem:(id,iid,d)=> api.put(`/tenders/${id}/scope-items/${iid}`, d),
  removeScopeItem:(id, iid) => api.delete(`/tenders/${id}/scope-items/${iid}`),
  listDocs:       (id)      => api.get(`/tenders/${id}/documents`),
  uploadDocs:     (id, fd)  => api.post(`/tenders/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeDoc:      (id, did) => api.delete(`/tenders/${id}/documents/${did}`),
  listBids:       (id)      => api.get(`/tenders/${id}/bids`),
  getBidComparison:(id)     => api.get(`/tenders/${id}/bids/comparison`),
  submitBid:      (id, d)   => api.post(`/tenders/${id}/bids`, d),
  updateBid:      (id,bid,d)=> api.put(`/tenders/${id}/bids/${bid}`, d),
  shortlistBid:   (id, bid) => api.patch(`/tenders/${id}/bids/${bid}/shortlist`),
  rejectBid:      (id,bid,d)=> api.patch(`/tenders/${id}/bids/${bid}/reject`, d),
};

export const bidOpportunityAPI = {
  list:           (p)       => api.get('/bid-opportunities', { params: p }),
  stats:          ()        => api.get('/bid-opportunities/stats'),
  get:            (id)      => api.get(`/bid-opportunities/${id}`),
  create:         (d)       => api.post('/bid-opportunities', d),
  update:         (id, d)   => api.put(`/bid-opportunities/${id}`, d),
  remove:         (id)      => api.delete(`/bid-opportunities/${id}`),
  transition:     (id, d)   => api.patch(`/bid-opportunities/${id}/status`, d),
  uploadDocs:     (id, fd)  => api.post(`/bid-opportunities/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeDoc:      (id, did) => api.delete(`/bid-opportunities/${id}/documents/${did}`),
  listCostItems:  (id)      => api.get(`/bid-opportunities/${id}/cost-items`),
  saveCostItems:  (id, d)   => api.post(`/bid-opportunities/${id}/cost-items`, d),
  updateCostItem: (id,iid,d)=> api.put(`/bid-opportunities/${id}/cost-items/${iid}`, d),
  removeCostItem: (id, iid) => api.delete(`/bid-opportunities/${id}/cost-items/${iid}`),
};

export default api;
