// src/App.js
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';
import ErrorBoundary from './components/common/ErrorBoundary';
import { LanguageProvider } from './context/LanguageContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime:          1000 * 60 * 10,  // 10 min — serve cached data without refetch
      gcTime:             1000 * 60 * 30,  // 30 min — keep unused data in memory (was cacheTime in v4)
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

// Only login is truly critical — everything else lazy-loads
import LoginPage    from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

const Dashboard   = lazy(() => import('./pages/Dashboard'));
const ProfilePage = lazy(() => import('./pages/auth/ProfilePage'));
const NotFound    = lazy(() => import('./pages/NotFound'));

// Lazy load less critical pages
const ProjectList         = lazy(() => import('./pages/projects/ProjectList'));
const ProjectDetail       = lazy(() => import('./pages/projects/ProjectDetail'));
const ProjectCreate       = lazy(() => import('./pages/projects/ProjectCreate'));
const BOQPage             = lazy(() => import('./pages/qs/BOQPage'));
const MeasurementPage     = lazy(() => import('./pages/qs/MeasurementPage'));
const MeasurementBookPage = lazy(() =>
  import('./pages/qs/mb/MeasurementBook').then(m => ({ default: m.MeasurementBookPage }))
);
const RABillPage           = lazy(() => import('./pages/qs/RABillPage'));
const RABillNewPage        = lazy(() => import('./pages/qs/RABillNewPage'));
const RABillDetail         = lazy(() => import('./pages/qs/RABillDetail'));
const RetentionReleasePage = lazy(() => import('./pages/qs/RetentionReleasePage'));
const MaterialReconPage   = lazy(() => import('./pages/qs/MaterialReconPage'));
const VariationPage       = lazy(() => import('./pages/qs/VariationPage'));
const ConsumptionNormsPage = lazy(() => import('./pages/qs/ConsumptionNormsPage'));
const GSTPage             = lazy(() => import('./pages/finance/GSTPage'));
const TDSPage             = lazy(() => import('./pages/finance/TDSPage'));
const BudgetPage          = lazy(() => import('./pages/finance/BudgetPage'));
const PaymentsPage        = lazy(() => import('./pages/finance/PaymentsPage'));
const FinanceHubPage      = lazy(() => import('./pages/finance/FinanceHubPage'));
const AccountsDashboard   = lazy(() => import('./pages/dashboards/AccountsDashboard'));
const CustomerStatementsPage = lazy(() => import('./pages/finance/CustomerStatementsPage'));
const BankReconciliationPage = lazy(() => import('./pages/finance/BankReconciliationPage'));
const PaymentRunPage         = lazy(() => import('./pages/finance/PaymentRunPage'));
const ChequeTrackerPage      = lazy(() => import('./pages/finance/ChequeTrackerPage'));
const ControlDashboardPage   = lazy(() => import('./pages/finance/ControlDashboardPage'));
const ManagementMISPage      = lazy(() => import('./pages/finance/ManagementMISPage'));
const VendorList          = lazy(() => import('./pages/procurement/VendorList'));
const LiveRateCheckerPage = lazy(() => import('./pages/procurement/LiveRateCheckerPage'));
const POAmendmentLogPage  = lazy(() => import('./pages/procurement/POAmendmentLogPage'));
const VendorPerformancePage = lazy(() => import('./pages/procurement/VendorPerformancePage'));
const RateContractPage    = lazy(() => import('./pages/procurement/RateContractPage'));
const VendorPaymentsPage  = lazy(() => import('./pages/procurement/VendorPaymentsPage'));
const POPage              = lazy(() => import('./pages/procurement/POPage'));
const GRNPage             = lazy(() => import('./pages/stores/GRNPage'));
const InventoryPage       = lazy(() => import('./pages/procurement/InventoryPage'));
const QuotationPage       = lazy(() => import('./pages/procurement/QuotationPage'));
const QuotationEntryPage  = lazy(() => import('./pages/procurement/QuotationEntryPage'));
const ComparativeStatementPage = lazy(() => import('./pages/procurement/ComparativeStatementPage'));
const WorkOrderPage         = lazy(() => import('./pages/procurement/WorkOrderPage'));
const TenderRegisterPage          = lazy(() => import('./pages/tender-mgmt/TenderRegisterPage'));
const TenderMgmtDetailPage        = lazy(() => import('./pages/tender-mgmt/TenderDetailPage'));
const TenderIssuancePage          = lazy(() => import('./pages/tender-mgmt/TenderIssuancePage'));
const TenderIssuanceDetailPage    = lazy(() => import('./pages/tender-mgmt/TenderIssuanceDetailPage'));
const WorkerList          = lazy(() => import('./pages/hr/WorkerList'));
const AttendancePage      = lazy(() => import('./pages/hr/AttendancePage'));
const PayrollPage         = lazy(() => import('./pages/hr/PayrollPage'));
const DPRPage             = lazy(() => import('./pages/site/DPRPage'));
const DPRCreate           = lazy(() => import('./pages/site/DPRCreate'));
const HSEDashboard        = lazy(() => import('./pages/hse/HSEDashboard'));
const IncidentPage        = lazy(() => import('./pages/hse/IncidentPage'));
const PermitPage          = lazy(() => import('./pages/hse/PermitPage'));
const PPEPage             = lazy(() => import('./pages/hse/PPEPage'));
const QAQCDashboard       = lazy(() => import('./pages/quality/QAQCDashboard'));
const RFIPage             = lazy(() => import('./pages/quality/RFIPage'));
const NCRPage             = lazy(() => import('./pages/quality/NCRPage'));
const LabTestPage         = lazy(() => import('./pages/quality/LabTestPage'));
const DocumentControlPage = lazy(() => import('./pages/quality/DocumentControlPage'));
const ChecklistTemplatePage = lazy(() => import('./pages/quality/ChecklistTemplatePage'));
const SnagListPage          = lazy(() => import('./pages/quality/SnagListPage'));
const AssetPage             = lazy(() => import('./pages/assets/AssetPage'));
const PlanningDashboard     = lazy(() => import('./pages/planning/PlanningDashboard'));
const PlanningDPRPage       = lazy(() => import('./pages/planning/DPRPage'));
const ActivitiesPage        = lazy(() => import('./pages/planning/ActivitiesPage'));
const MilestonePage         = lazy(() => import('./pages/planning/MilestonePage'));
const LookAheadPage         = lazy(() => import('./pages/planning/LookAheadPage'));
const ProgressDashboard     = lazy(() => import('./pages/planning/ProgressDashboard'));
const DelayAnalysisPage     = lazy(() => import('./pages/planning/DelayAnalysisPage'));
const ITAssetPage         = lazy(() => import('./pages/it/ITAssetPage'));
const ITTicketPage        = lazy(() => import('./pages/it/ITTicketPage'));
const LicensePage         = lazy(() => import('./pages/it/LicensePage'));
const MRSPage                   = lazy(() => import('./pages/stores/MRSPage'));
const IssuePage                 = lazy(() => import('./pages/stores/IssuePage'));
const StoreLedgerPage           = lazy(() => import('./pages/stores/StoreLedgerPage'));
// StockReportPage merged into StoreLedgerPage as "Monthly Movement" tab
// GRNVerificationPage and GRNPrintPage merged into GRNPage
const VendorInvoicePage   = lazy(() => import('./pages/finance/VendorInvoicePage'));
const BillBookingPage     = lazy(() => import('./pages/finance/BillBookingPage'));
const ReportsPage         = lazy(() => import('./pages/reports/ReportsPage'));
const Project360Page      = lazy(() => import('./pages/reports/Project360Page'));
const BillsTrackerPage    = lazy(() => import('./pages/bills/BillsTrackerPage'));
const UsersPage           = lazy(() => import('./pages/users/UsersPage'));
const MRSVerificationPage = lazy(() => import('./pages/stores/MRSVerificationPage'));
const POVerificationPage = lazy(() => import('./pages/procurement/POVerificationPage'));
const GRNVerificationPage = lazy(() => import('./pages/procurement/GRNVerificationPage'));
const MINVerificationPage = lazy(() => import('./pages/stores/MINVerificationPage'));
const SubcontractorMBPage  = lazy(() => import('./pages/subcontractor/SubcontractorMBPage'));
const SubBillPage          = lazy(() => import('./pages/subcontractor/SubBillPage'));
const SubcontractorHubPage = lazy(() => import('./pages/subcontractor/SubcontractorHubPage'));
const QSReportsPage        = lazy(() => import('./pages/qs/ReportsPage'));
const BillingReportsPage    = lazy(() => import('./pages/billing/BillingReportsPage'));
const DocumentsPage             = lazy(() => import('./pages/documents/DocumentsPage'));
const FinanceIntelligencePage   = lazy(() => import('./pages/finance/FinanceIntelligencePage'));
const DQSDashboardPage      = lazy(() => import('./pages/dqs/DQSDashboardPage'));

const DQSBillsPage          = lazy(() => import('./pages/dqs/DQSBillsPage'));
const DQSBillDetailPage     = lazy(() => import('./pages/dqs/DQSBillDetailPage'));
const DQSPaymentCertPrint   = lazy(() => import('./pages/dqs/DQSPaymentCertPrint'));
const DQSMaterialTrackerPage = lazy(() => import('./pages/dqs/DQSMaterialTrackerPage'));
const DQSReportsPage        = lazy(() => import('./pages/dqs/DQSReportsPage'));
const DQSAnalyticsPage      = lazy(() => import('./pages/dqs/DQSAnalyticsPage'));
const DQSTransmittalPage    = lazy(() => import('./pages/dqs/DQSTransmittalPage'));
const QSRABillPrint         = lazy(() => import('./pages/dqs/QSRABillPrint'));
const QAQCReportsPage       = lazy(() => import('./pages/quality/QAQCReportsPage'));
const DrawingRegisterPage   = lazy(() => import('./pages/quality/DrawingRegisterPage'));
const SubmittalsPage        = lazy(() => import('./pages/quality/SubmittalsPage'));
const MeetingsPage          = lazy(() => import('./pages/common/MeetingsPage'));
const ERPChatPage           = lazy(() => import('./pages/ERPChat'));

// Route guard — blocks access until token is verified with backend
const ProtectedRoute = ({ children }) => {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

// Initializer — runs once on mount, verifies stored token against backend
function AuthInitializer({ children }) {
  const { user, initialize, logout } = useAuthStore();
  const IDLE_TIMEOUT = 60 * 60 * 1000; // 60 minutes

  useEffect(() => {
    initialize();

    // Idle Timeout Logic
    let idleTimer;
    const resetTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (useAuthStore.getState().user) {
          logout();
          window.location.href = '/login?reason=session_expired';
        }
      }, IDLE_TIMEOUT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => document.addEventListener(name, resetTimer));
    resetTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach(name => document.removeEventListener(name, resetTimer));
    };
  }, [initialize, logout]);

  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
    <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitializer>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
              
              {/* Public Verification Links */}
              <Route path="/verify/mrs/:id" element={<MRSVerificationPage />} />
              <Route path="/verify/po/:id" element={<POVerificationPage />} />
              <Route path="/verify/grn/:id" element={<GRNVerificationPage />} />
              <Route path="/verify/min/:id" element={<MINVerificationPage />} />

              {/* Print pages — ProtectedRoute but NO Layout sidebar */}
              <Route path="/dqs/bills/:id/payment-cert"    element={<ProtectedRoute><DQSPaymentCertPrint /></ProtectedRoute>} />
              <Route path="/dqs/bills/:id/ra-abstract"      element={<ProtectedRoute><QSRABillPrint /></ProtectedRoute>} />

              {/* Private — All ERP module routes now under ProtectedRoute */}
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                {/* Projects */}
                <Route path="projects" element={<ProjectList />} />
                <Route path="projects/new" element={<ProjectCreate />} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                <Route path="meetings" element={<MeetingsPage />} />
                {/* QS */}
                <Route path="qs/boq" element={<BOQPage />} />
                <Route path="qs/measurements" element={<MeasurementPage />} />
                <Route path="qs/measurements/book" element={<MeasurementBookPage />} />
                <Route path="qs/ra-bills" element={<RABillPage />} />
                <Route path="qs/ra-bills/new" element={<RABillNewPage />} />
                <Route path="qs/ra-bills/:id" element={<RABillDetail />} />
                <Route path="qs/retention-releases" element={<RetentionReleasePage />} />
                <Route path="qs/material-recon" element={<MaterialReconPage />} />
                <Route path="qs/variations" element={<VariationPage />} />
                <Route path="qs/norms" element={<ConsumptionNormsPage />} />
                <Route path="qs/reports" element={<QSReportsPage />} />

                {/* Finance */}
                <Route path="finance" element={<FinanceHubPage />} />
                <Route path="finance/payables" element={<Navigate to="/finance/invoices" replace />} />
                <Route path="finance/receivables" element={<Navigate to="/finance/customer-statements" replace />} />
                <Route path="finance/tax-compliance" element={<Navigate to="/finance/gst" replace />} />
                <Route path="finance/reports" element={<Navigate to="/finance/billing-reports" replace />} />
                <Route path="finance/accounts-dashboard" element={<AccountsDashboard />} />
                <Route path="finance/customer-statements" element={<CustomerStatementsPage />} />
                <Route path="finance/bank-reconciliation" element={<BankReconciliationPage />} />
                <Route path="finance/payment-run" element={<PaymentRunPage />} />
                <Route path="finance/cheque-tracker" element={<ChequeTrackerPage />} />
                <Route path="finance/control-dashboard" element={<ControlDashboardPage />} />
                <Route path="finance/management-mis" element={<ManagementMISPage />} />
                <Route path="finance/gst" element={<GSTPage />} />
                <Route path="finance/tds" element={<TDSPage />} />
                <Route path="finance/budget" element={<BudgetPage />} />
                <Route path="finance/payments" element={<PaymentsPage />} />
                <Route path="finance/invoices" element={<VendorInvoicePage />} />
                <Route path="finance/invoices/booking" element={<BillBookingPage />} />
                <Route path="finance/billing-reports"  element={<BillingReportsPage />} />
                <Route path="finance/intelligence"     element={<FinanceIntelligencePage />} />

                {/* Procurement */}
                <Route path="procurement/vendors" element={<VendorList />} />
                <Route path="procurement/live-rate-checker" element={<LiveRateCheckerPage />} />
                <Route path="procurement/po-amendments" element={<POAmendmentLogPage />} />
                <Route path="procurement/vendor-performance" element={<VendorPerformancePage />} />
                <Route path="procurement/rate-contracts" element={<RateContractPage />} />
                <Route path="procurement/vendor-payments" element={<VendorPaymentsPage />} />
                <Route path="procurement/quotations" element={<QuotationPage />} />
                <Route path="procurement/quotations/entry/:id" element={<QuotationEntryPage />} />
                <Route path="procurement/quotations/comparison/:id" element={<ComparativeStatementPage />} />
                <Route path="procurement/po" element={<POPage />} />
                <Route path="stores/grn" element={<GRNPage />} />
                <Route path="procurement/inventory" element={<InventoryPage />} />
                <Route path="procurement/work-orders" element={<WorkOrderPage />} />
                <Route path="tender-management" element={<TenderRegisterPage />} />
                <Route path="tender-management/issue" element={<TenderIssuancePage />} />
                <Route path="tender-management/issue/:id" element={<TenderIssuanceDetailPage />} />
                <Route path="tender-management/:id" element={<TenderMgmtDetailPage />} />
                <Route path="subcontractor/hub" element={<SubcontractorHubPage />} />
                <Route path="subcontractor/measurements" element={<SubcontractorMBPage />} />
                <Route path="subcontractor/bills" element={<SubBillPage />} />

                {/* HR */}
                <Route path="hr/workers" element={<WorkerList />} />
                <Route path="hr/attendance" element={<AttendancePage />} />
                <Route path="hr/payroll" element={<PayrollPage />} />

                {/* Site */}
                <Route path="site/dpr" element={<DPRPage />} />
                <Route path="site/dpr/new" element={<DPRCreate />} />

                {/* Planning & Execution */}
                <Route path="planning"                element={<PlanningDashboard />} />
                <Route path="planning/dpr"            element={<PlanningDPRPage />} />
                <Route path="planning/activities"     element={<ActivitiesPage />} />
                <Route path="planning/milestones"     element={<MilestonePage />} />
                <Route path="planning/look-ahead"     element={<LookAheadPage />} />
                <Route path="planning/progress"       element={<ProgressDashboard />} />
                <Route path="planning/delays"         element={<DelayAnalysisPage />} />

                {/* HSE */}
                <Route path="hse" element={<HSEDashboard />} />
                <Route path="hse/incidents" element={<IncidentPage />} />
                <Route path="hse/permits" element={<PermitPage />} />
                <Route path="hse/ppe" element={<PPEPage />} />

                {/* Assets */}
                <Route path="assets" element={<AssetPage />} />

                {/* IT */}
                <Route path="it/assets" element={<ITAssetPage />} />
                <Route path="it/tickets" element={<ITTicketPage />} />
                <Route path="it/licenses" element={<LicensePage />} />

                {/* Stores */}
                <Route path="stores/mrs"              element={<MRSPage />} />
                <Route path="stores/issue"            element={<IssuePage />} />
                <Route path="stores/ledger"           element={<StoreLedgerPage />} />
                {/* grn-verification and grn-print merged into stores/grn */}
                {/* stock-report merged into stores/ledger Monthly Movement tab */}

                {/* QA/QC & Compliance */}
                <Route path="quality" element={<QAQCDashboard />} />
                <Route path="quality/reports" element={<QAQCReportsPage />} />
                <Route path="quality/drawings" element={<DrawingRegisterPage />} />
                <Route path="quality/submittals" element={<SubmittalsPage />} />
                <Route path="quality/rfi" element={<RFIPage />} />
                <Route path="quality/ncr" element={<NCRPage />} />
                <Route path="quality/lab-tests" element={<LabTestPage />} />
                <Route path="quality/documents" element={<DocumentControlPage />} />
                <Route path="quality/templates" element={<ChecklistTemplatePage />} />
                <Route path="quality/snags"     element={<SnagListPage />} />

                {/* Documents Repository */}
                <Route path="documents" element={<DocumentsPage />} />

                {/* DQS Invoice Tracker */}
                <Route path="dqs"                  element={<DQSDashboardPage />} />
                <Route path="bills/tracker"         element={<BillsTrackerPage />} />
                <Route path="dqs/bills"            element={<DQSBillsPage />} />
                <Route path="dqs/bills/:id"            element={<DQSBillDetailPage />} />
                <Route path="dqs/material-tracker" element={<DQSMaterialTrackerPage />} />
                <Route path="dqs/reports"          element={<DQSReportsPage />} />
                <Route path="dqs/analytics"        element={<DQSAnalyticsPage />} />
                <Route path="dqs/transmittal"      element={<DQSTransmittalPage />} />

                {/* Reports & Strategic Analytics */}
                <Route path="reports" element={<ReportsPage />} />
                <Route path="reports/360" element={<Project360Page />} />

                {/* ERP Chat */}
                <Route path="chat" element={<ERPChatPage />} />

                {/* Team Management */}
                <Route path="users" element={<UsersPage />} />


                {/* Profile */}
                <Route path="profile" element={<ProfilePage />} />

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthInitializer>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#000' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
    </LanguageProvider>
    </ErrorBoundary>
  );
}
