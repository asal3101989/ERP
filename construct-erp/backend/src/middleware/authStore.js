// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api/client';

// ─── Demo users — works 100% OFFLINE, no backend needed ──────────────────────
const DEMO_USERS = {
  'admin@rajinfra.com': {
    id: 'demo-001', name: 'Rajesh Sharma', email: 'admin@rajinfra.com',
    role: 'admin', designation: 'Managing Director', phone: '9876543210',
    employee_code: 'EMP001', company_id: 'co-001',
    company_name: 'Raj Infra Private Limited', company_gstin: '27AAARC1234C1Z5',
    password: 'admin123',
  },
  'pm@rajinfra.com': {
    id: 'demo-002', name: 'Suresh Patil', email: 'pm@rajinfra.com',
    role: 'project_manager', designation: 'Senior Project Manager', phone: '9876543211',
    employee_code: 'EMP002', company_id: 'co-001',
    company_name: 'Raj Infra Private Limited', company_gstin: '27AAARC1234C1Z5',
    password: 'demo123',
  },
  'site@rajinfra.com': {
    id: 'demo-003', name: 'Ramesh Kumar', email: 'site@rajinfra.com',
    role: 'site_engineer', designation: 'Site Engineer', phone: '9876543212',
    employee_code: 'EMP003', company_id: 'co-001',
    company_name: 'Raj Infra Private Limited', company_gstin: '27AAARC1234C1Z5',
    password: 'demo123',
  },
  'qs@rajinfra.com': {
    id: 'demo-004', name: 'Priya Mehta', email: 'qs@rajinfra.com',
    role: 'qs_engineer', designation: 'Quantity Surveyor', phone: '9876543213',
    employee_code: 'EMP004', company_id: 'co-001',
    company_name: 'Raj Infra Private Limited', company_gstin: '27AAARC1234C1Z5',
    password: 'demo123',
  },
  'accounts@rajinfra.com': {
    id: 'demo-005', name: 'Anand Joshi', email: 'accounts@rajinfra.com',
    role: 'accountant', designation: 'Senior Accountant', phone: '9876543214',
    employee_code: 'EMP005', company_id: 'co-001',
    company_name: 'Raj Infra Private Limited', company_gstin: '27AAARC1234C1Z5',
    password: 'demo123',
  },
  'hse@rajinfra.com': {
    id: 'demo-006', name: 'Kavita Rao', email: 'hse@rajinfra.com',
    role: 'hse_officer', designation: 'HSE Officer', phone: '9876543215',
    employee_code: 'EMP006', company_id: 'co-001',
    company_name: 'Raj Infra Private Limited', company_gstin: '27AAARC1234C1Z5',
    password: 'demo123',
  },
  'it@rajinfra.com': {
    id: 'demo-007', name: 'Kiran Desai', email: 'it@rajinfra.com',
    role: 'it_admin', designation: 'IT Administrator', phone: '9876543216',
    employee_code: 'EMP007', company_id: 'co-001',
    company_name: 'Raj Infra Private Limited', company_gstin: '27AAARC1234C1Z5',
    password: 'demo123',
  },
};

const DEMO_TOKEN = 'demo-offline-token-construct-erp-2025';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
      isDemoMode: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null });

        // ── 1. Try DEMO mode first (instant, no backend needed) ──
        const demoUser = DEMO_USERS[email.toLowerCase().trim()];
        if (demoUser && demoUser.password === password) {
          const { password: _pw, ...user } = demoUser;
          localStorage.setItem('accessToken', DEMO_TOKEN);
          localStorage.setItem('refreshToken', DEMO_TOKEN);
          set({
            user,
            accessToken: DEMO_TOKEN,
            refreshToken: DEMO_TOKEN,
            isLoading: false,
            isDemoMode: true,
          });
          return { success: true, demo: true };
        }

        // ── 2. Try real backend ──
        try {
          const { data } = await authAPI.login({ email, password });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isLoading: false,
            isDemoMode: false,
          });
          return { success: true, demo: false };
        } catch (err) {
          // ── 3. If backend unreachable, give a helpful message ──
          const isNetworkError = !err.response;
          const msg = isNetworkError
            ? 'Backend not running. Use a demo account to explore offline.'
            : (err.response?.data?.error || 'Invalid email or password.');
          set({ error: msg, isLoading: false });
          return { success: false, error: msg };
        }
      },

      logout: async () => {
        const { refreshToken, isDemoMode } = get();
        if (!isDemoMode) {
          try { await authAPI.logout({ refreshToken }); } catch (_) {}
        }
        localStorage.clear();
        set({ user: null, accessToken: null, refreshToken: null, isDemoMode: false });
      },

      fetchMe: async () => {
        const { isDemoMode } = get();
        if (isDemoMode) return; // already have user
        try {
          const { data } = await authAPI.me();
          set({ user: data });
        } catch (_) {}
      },

      // Role helpers
      isAdmin:        () => ['super_admin','admin'].includes(get().user?.role),
      isPM:           () => get().user?.role === 'project_manager',
      isSiteEngineer: () => get().user?.role === 'site_engineer',
      isQS:           () => get().user?.role === 'qs_engineer',
      isHSE:          () => get().user?.role === 'hse_officer',
      isAccountant:   () => get().user?.role === 'accountant',
      isIT:           () => get().user?.role === 'it_admin',
      hasRole:        (roles) => roles.includes(get().user?.role),
    }),
    {
      name: 'construct-erp-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isDemoMode: state.isDemoMode,
      }),
    }
  )
);

export default useAuthStore;
