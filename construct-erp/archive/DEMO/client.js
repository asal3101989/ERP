// src/api/client.js
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';
const DEMO_TOKEN = 'demo-offline-token-construct-erp-2025';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
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

    // Skip refresh for demo token
    const token = localStorage.getItem('accessToken');
    if (token === DEMO_TOKEN) {
      return Promise.reject(error);
    }

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
      if (!refreshToken || refreshToken === DEMO_TOKEN) {
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

export const boqAPI = {
  list:    (params) => api.get('/boq', { params }),
  summary: (pid)    => api.get(`/boq/summary/${pid}`),
  create:  (data)   => api.post('/boq', data),
  update:  (id, d)  => api.put(`/boq/${id}`, d),
  delete:  (id)     => api.delete(`/boq/${id}`),
};

export const measurementAPI = {
  list:    (params)   => api.get('/measurements', { params }),
  create:  (data)     => api.post('/measurements', data),
  approve: (id, data) => api.patch(`/measurements/${id}/approve`, data),
};

export const raBillAPI = {
  list:    (params)   => api.get('/ra-bills', { params }),
  get:     (id)       => api.get(`/ra-bills/${id}`),
  create:  (data)     => api.post('/ra-bills', data),
  approve: (id, data) => api.patch(`/ra-bills/${id}/approve`, data),
};

export const invoiceAPI = {
  list:       (params) => api.get('/invoices', { params }),
  get:        (id)     => api.get(`/invoices/${id}`),
  create:     (data)   => api.post('/invoices', data),
  gstSummary: (params) => api.get('/invoices/gst-summary', { params }),
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
  compare: (params) => api.get('/vendors/compare', { params }),
};

export const poAPI = {
  list:    (params)   => api.get('/purchase-orders', { params }),
  get:     (id)       => api.get(`/purchase-orders/${id}`),
  create:  (data)     => api.post('/purchase-orders', data),
  receive: (id, data) => api.patch(`/purchase-orders/${id}/receive`, data),
};

export const grnAPI = {
  list:   (params) => api.get('/grn', { params }),
  create: (data)   => api.post('/grn', data),
};

export const inventoryAPI = {
  list:      (params) => api.get('/inventory', { params }),
  issue:     (data)   => api.post('/inventory/issue', data),
  transfer:  (data)   => api.post('/inventory/transfer', data),
  lowStock:  (params) => api.get('/inventory/low-stock', { params }),
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

export const ppeAPI = {
  list:   (params) => api.get('/ppe', { params }),
  issue:  (data)   => api.post('/ppe', data),
  expiry: (params) => api.get('/ppe/expiring', { params }),
};

export const assetAPI = {
  list:        (params) => api.get('/assets', { params }),
  get:         (id)     => api.get(`/assets/${id}`),
  create:      (data)   => api.post('/assets', data),
  update:      (id, d)  => api.put(`/assets/${id}`, d),
  transfer:    (data)   => api.post('/assets/transfer', data),
  maintenance: (data)   => api.post('/assets/maintenance', data),
};

export const itAssetAPI = {
  list:   (params) => api.get('/it-assets', { params }),
  create: (data)   => api.post('/it-assets', data),
  update: (id, d)  => api.put(`/it-assets/${id}`, d),
};

export const itTicketAPI = {
  list:    (params)   => api.get('/it-tickets', { params }),
  get:     (id)       => api.get(`/it-tickets/${id}`),
  create:  (data)     => api.post('/it-tickets', data),
  update:  (id, data) => api.patch(`/it-tickets/${id}`, data),
  resolve: (id, data) => api.patch(`/it-tickets/${id}/resolve`, data),
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
  laborReport:   (params) => api.get('/reports/labor', { params }),
  stockReport:   (params) => api.get('/reports/stock', { params }),
  boqActual:     (params) => api.get('/reports/boq-actual', { params }),
};

export const uploadAPI = {
  upload: (formData) => api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default api;
