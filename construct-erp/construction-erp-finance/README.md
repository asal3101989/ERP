# Construction ERP — Finance Module

Production-ready Finance Module for Construction ERP. Covers AP/AR, General Ledger, Budget Control, Payroll, GST, TDS, Cash Flow, and MIS Reporting.

---

## Architecture Overview

```
construction-erp-finance/
├── src/
│   ├── modules/
│   │   ├── auth/               ← JWT login, user management
│   │   ├── vendors/            ← Vendor master, bank accounts, ledger
│   │   ├── clients/            ← Client master, milestone billing, AR
│   │   ├── invoices/           ← AP/AR invoice lifecycle
│   │   ├── payments/           ← Payment processing, NEFT/RTGS, GL posting
│   │   ├── budget/             ← Project budgets, cost heads, variance alerts
│   │   ├── ledger/             ← Chart of accounts, journal entries, trial balance
│   │   ├── payroll/            ← Monthly payroll, PF/ESI/TDS, bank transfer
│   │   ├── taxation/           ← GSTR-1/2A/3B, TDS register, Form 26Q
│   │   ├── cashflow/           ← Weekly forecast, project cash flow
│   │   ├── reports/            ← Dashboard KPIs, P&L, MIS
│   │   ├── workflow/           ← Multi-level approval engine
│   │   └── notifications/      ← Email/in-app alerts
│   ├── middleware/
│   │   ├── auth.middleware.ts  ← JWT verify + RBAC
│   │   ├── error.middleware.ts ← Centralized error handling
│   │   ├── validate.middleware.ts ← Zod schema validation
│   │   └── logger.middleware.ts ← Request ID + structured logging
│   └── lib/
│       ├── prisma.ts           ← Prisma singleton
│       ├── errors.ts           ← Custom error classes
│       ├── audit.ts            ← Fire-and-forget audit log
│       ├── number-sequences.ts ← Document numbering (INV-2024-00001)
│       ├── bank-validation.ts  ← IFSC, GSTIN, PAN validation
│       └── logger.ts           ← Structured logger
├── prisma/
│   ├── schema.prisma           ← Full data model (28 models)
│   └── seed.ts                 ← Realistic construction seed data
├── frontend/src/
│   ├── App.jsx                 ← Shell + sidebar + routing
│   └── pages/
│       ├── FinanceDashboard.jsx   ← KPIs, charts, cashflow forecast
│       ├── VendorBills.jsx        ← AP list + approve/reject + pay
│       ├── ClientInvoices.jsx     ← AR list + aging table
│       ├── BudgetTracker.jsx      ← Cost head variance + alerts
│       ├── InvoiceForm.jsx        ← Create AP/AR invoice
│       └── PaymentForm.jsx        ← Record payment/receipt
└── .env.example
```

---

## Quick Start

### 1. Backend Setup

```bash
# Clone and install
cd construction-erp-finance
npm install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# Database
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed

# Dev server
npm run dev
# API: http://localhost:3001/api/v1
```

### 2. Frontend Setup

```bash
cd frontend
npm install
# Create .env: VITE_API_URL=http://localhost:3001/api/v1
npm run dev
# UI: http://localhost:5173
```

### 3. Login Credentials (seed data)

| Role           | Email                         | Password  |
|----------------|-------------------------------|-----------|
| Admin          | admin@constructerp.in         | Admin@123 |
| Accountant     | accountant@constructerp.in    | Admin@123 |
| Project Manager| pm@constructerp.in            | Admin@123 |

---

## API Reference

### Authentication
```
POST   /api/v1/auth/login           — Login
POST   /api/v1/auth/refresh         — Refresh access token
POST   /api/v1/auth/logout          — Logout
GET    /api/v1/auth/me              — Current user
POST   /api/v1/auth/users           — Create user (Admin)
GET    /api/v1/auth/users           — List users (Admin)
```

### Invoices (AP/AR)
```
GET    /api/v1/invoices             — List invoices (filterable)
POST   /api/v1/invoices             — Create invoice
GET    /api/v1/invoices/:id         — Get invoice with line items
POST   /api/v1/invoices/:id/submit  — Submit for approval
POST   /api/v1/invoices/:id/approve — Approve at current level
POST   /api/v1/invoices/:id/reject  — Reject with reason
GET    /api/v1/invoices/outstanding/ap  — Outstanding payables
GET    /api/v1/invoices/outstanding/ar  — Outstanding receivables
```

### Payments
```
GET    /api/v1/payments             — List payments
POST   /api/v1/payments             — Record payment (NEFT/RTGS/CHEQUE)
GET    /api/v1/payments/:id         — Get payment details
POST   /api/v1/payments/:id/confirm — Mark as completed (bank webhook)
POST   /api/v1/payments/:id/reverse — Reverse payment (bounce)
GET    /api/v1/payments/ap-aging    — AP aging report
```

### Budget
```
GET    /api/v1/budgets              — List budgets
POST   /api/v1/budgets              — Create project budget
GET    /api/v1/budgets/project/:id/summary — Budget vs actual summary
POST   /api/v1/budgets/:id/approve  — Approve budget
POST   /api/v1/budgets/:id/revise   — Create revision (VO, scope change)
```

### General Ledger
```
GET    /api/v1/ledger/accounts           — Chart of accounts
GET    /api/v1/ledger/trial-balance      — Trial balance
GET    /api/v1/ledger/journal-entries    — Journal entry list
POST   /api/v1/ledger/journal-entries    — Manual journal entry
POST   /api/v1/ledger/journal-entries/:id/post — Post manual JE
GET    /api/v1/ledger/project/:id/pl     — Project P&L
```

### Taxation (India)
```
GET    /api/v1/taxation/gst/gstr1/:period    — GSTR-1 (outward supplies)
GET    /api/v1/taxation/gst/gstr2a/:period   — GSTR-2A (ITC)
GET    /api/v1/taxation/gst/gstr3b/:period   — GSTR-3B summary
POST   /api/v1/taxation/gst/avail-itc/:period — Avail ITC
GET    /api/v1/taxation/tds/register/:quarter — TDS register
GET    /api/v1/taxation/tds/form26q/:quarter  — Form 26Q data
POST   /api/v1/taxation/tds/deposit          — Record TDS challan
```

### Payroll
```
POST   /api/v1/payroll/process          — Process monthly payroll
GET    /api/v1/payroll/:period/summary  — Payroll summary
POST   /api/v1/payroll/:period/approve  — Approve & initiate bank transfer
GET    /api/v1/payroll/employee/:id/:period — Employee payslip
```

### Cash Flow
```
GET    /api/v1/cashflow/position        — Current cash position
GET    /api/v1/cashflow/forecast/weekly — 12-week rolling forecast
GET    /api/v1/cashflow/project/:id     — Project cash flow
GET    /api/v1/cashflow/statement       — Cash flow statement
```

### Reports
```
GET    /api/v1/reports/dashboard             — Finance KPIs
GET    /api/v1/reports/monthly-trend         — Revenue vs expense chart
GET    /api/v1/reports/project-cost-analysis — All projects budget vs actual
GET    /api/v1/reports/trial-balance         — Trial balance
GET    /api/v1/reports/project/:id/pl        — Project P&L
GET    /api/v1/reports/cashflow/forecast     — 90-day cashflow forecast
GET    /api/v1/reports/chart-of-accounts     — Hierarchical COA
```

---

## Invoice Approval Workflow

```
DRAFT → SUBMITTED → PENDING_APPROVAL_L1 → PENDING_APPROVAL_L2 → APPROVED → PAID
                                         ↘ REJECTED (any level)
```

**Approval Rules (configurable):**
- L1: Accountant — up to ₹5 Lakh
- L2: Project Manager — up to ₹50 Lakh  
- L3: Admin — above ₹50 Lakh

**Auto-escalation:** Configurable via `approvalRules.escalationDays`

---

## GL Auto-Journal Entries

### AP (Vendor Invoice approved):
```
Dr. Expense Account      ₹XXX  (net of GST)
Dr. GST Input Tax Credit ₹XXX  (ITC eligible)
Cr. TDS Payable          ₹XXX
Cr. Accounts Payable     ₹XXX
```

### AR (Client Invoice approved):
```
Dr. Accounts Receivable  ₹XXX
Cr. Revenue              ₹XXX  (net of GST)
Cr. GST Output Tax       ₹XXX
```

---

## Indian Banking Integrations

| Use Case              | API Provider                        | Endpoint |
|-----------------------|-------------------------------------|---------|
| IFSC validation       | Razorpay IFSC (free)                | `https://ifsc.razorpay.com/{IFSC}` |
| Bank account verify   | Cashfree Payout (penny drop)        | `POST /payout/v1/validation/bankDetails` |
| NEFT/RTGS transfer    | RazorpayX Payout                    | `POST /v1/payouts` |
| NACH bulk payment     | Cashfree NACH                       | For payroll bulk transfer |

---

## Security

- **JWT** access tokens (15 min) + refresh tokens (7 days)
- **RBAC**: Admin, Accountant, Project Manager, Auditor, Read-Only
- **Rate limiting**: 500 req/15min API, 10 req/15min auth
- **Audit log**: every CRUD + workflow action with user, IP, timestamp
- **Duplicate invoice detection**: vendor + external invoice number uniqueness
- **Budget controls**: pre-posting budget availability check

---

## Scalability Improvements (Production)

1. **Redis** — JWT blacklist + approval queue + caching
2. **Bull queues** — async GL posting, payroll processing, email
3. **Webhook handlers** — bank payment confirmations (RazorpayX)
4. **S3** — invoice document attachments
5. **Elasticsearch** — full-text invoice search
6. **Multi-tenancy** — tenant isolation for SaaS deployment
