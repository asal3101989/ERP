# 🏗 ConstructERP India — Full Stack v3.0

Production-ready Construction ERP tailored for Indian projects.
GST • TDS • BOCW • RERA compliant.

---

## 📁 Project Structure

```
construct-erp/
├── backend/                    Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── server.js           Express app (22 route mounts)
│   │   ├── config/
│   │   │   ├── database.js     PostgreSQL pool + transaction helpers
│   │   │   ├── migrate.js      All 40+ tables (run once)
│   │   │   └── seed.js         Indian demo data
│   │   ├── middleware/
│   │   │   └── auth.js         JWT + RBAC + project access guard
│   │   ├── controllers/
│   │   │   ├── auth.controller.js      Register / Login / Refresh
│   │   │   ├── project.controller.js   CRUD + dashboard stats
│   │   │   ├── invoice.controller.js   GST billing (CGST/SGST/IGST)
│   │   │   ├── raBill.controller.js    RA Bill + deductions
│   │   │   └── incident.controller.js  HSE incidents + CAPA
│   │   └── routes/             22 route files
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   React 18 + Tailwind CSS
│   ├── src/
│   │   ├── App.js              All 30+ routes (lazy loaded)
│   │   ├── api/client.js       Axios + auto token refresh + all API modules
│   │   ├── store/authStore.js  Zustand auth store (persisted)
│   │   ├── index.css           Tailwind + custom component classes
│   │   ├── components/
│   │   │   └── layout/Layout.jsx   Sidebar + topbar
│   │   └── pages/
│   │       ├── auth/LoginPage.jsx      Login with demo accounts
│   │       ├── Dashboard.jsx           Live metrics + charts
│   │       ├── qs/RABillPage.jsx       RA Bill with Indian deductions
│   │       ├── hse/IncidentPage.jsx    Incident reporting + HIRA
│   │       └── it/ITTicketPage.jsx     Help desk + SLA tracking
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
└── docker-compose.yml          Full stack deployment
```

---

## 🚀 Local Setup (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Step 1 — Database
```bash
createdb construct_erp
```

### Step 2 — Backend
```bash
cd backend
cp .env.example .env
# Edit .env: set DB_PASSWORD and JWT_SECRET

npm install
node src/config/migrate.js    # Creates all 40+ tables
node src/config/seed.js       # Inserts demo data
npm run dev                   # Starts on :5000
```

### Step 3 — Frontend
```bash
cd frontend
npm install
npm start                     # Starts on :3000
```

### Step 4 — Test
Open http://localhost:3000 and login:
- **Admin:** admin@rajinfra.com / admin123
- **PM:**    pm@rajinfra.com / demo123
- **Site:**  site@rajinfra.com / demo123

---

## 🐳 Docker Deployment

```bash
# Copy and configure env
cp .env.example .env
# Set: DB_PASSWORD, JWT_SECRET, FRONTEND_URL

# Build and start all services
docker-compose up -d --build

# Run migrations + seed
docker exec construct_erp_api node src/config/migrate.js
docker exec construct_erp_api node src/config/seed.js

# Check health
curl http://localhost:5000/health
```

Services:
- Frontend: http://localhost:3000
- API:      http://localhost:5000/api/v1
- Database: localhost:5432

---

## ☁ Cloud Deployment (AWS)

### Database — RDS PostgreSQL
```bash
# Create RDS instance (db.t3.medium for production)
aws rds create-db-instance \
  --db-instance-identifier construct-erp-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16 \
  --master-username postgres \
  --master-user-password YOUR_PASS \
  --allocated-storage 100 \
  --storage-type gp3 \
  --backup-retention-period 7
```

### Backend — EC2 or ECS
```bash
# EC2 Ubuntu 22.04
sudo apt update && sudo apt install -y nodejs npm postgresql-client
git clone https://your-repo/construct-erp.git
cd construct-erp/backend
npm ci --production
NODE_ENV=production pm2 start src/server.js --name construct-erp-api
pm2 save && pm2 startup
```

### Frontend — S3 + CloudFront
```bash
cd frontend
REACT_APP_API_URL=https://api.yourdomain.com/api/v1 npm run build
aws s3 sync build/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

### SSL — Let's Encrypt (Nginx)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

---

## 📊 Database Tables (40+)

### Auth & Multi-company
- `companies` — Multi-company support with GSTIN
- `users` — 11 roles (admin, PM, site engineer, QS, accountant, HSE, IT, etc.)
- `refresh_tokens` — JWT refresh token rotation
- `audit_logs` — Full audit trail

### Projects
- `projects` — With RERA, NHAI contract support
- `project_members` — Team assignments

### QS & Billing
- `boq_items` — Bill of quantities with HSN codes
- `measurements` — Digital MB (L×B×H auto-calc)
- `ra_bills` — RA bills with all deductions
- `ra_bill_items` — Line items per bill
- `material_reconciliation` — Issued vs consumed

### Finance
- `invoices` — CGST/SGST/IGST calculation
- `payments` — RTGS/NEFT/UPI/Cash/Cheque
- `budget_items` — Budget vs actual

### Procurement
- `vendors` — With GSTIN, PAN, bank details
- `purchase_orders` — With GST computation
- `grn` — Goods receipt with quality check
- `inventory` — Site-wise godown stock
- `stock_transactions` — Full audit trail

### HR & Labour
- `workers` — With BOCW number, skill type
- `attendance` — Daily muster
- `payroll` — PF (12%) + ESI (3.75%) calculation

### HSE
- `incidents` — Near miss to fatality
- `corrective_actions` — CAPA tracking
- `permits` — PTW for 7 permit types
- `safety_inspections` — Checklist-based
- `ppe_records` — Expiry tracking
- `risk_assessments` — HIRA with risk matrix

### Assets
- `assets` — Heavy machinery with QR codes
- `asset_movements` — Site-to-site transfers
- `maintenance_records` — Service history

### IT Department
- `it_assets` — Laptops, CCTV, biometric
- `it_tickets` — SLA-tracked help desk
- `software_licenses` — With expiry alerts
- `amc_contracts` — Maintenance contracts

### CRM
- `unit_bookings` — Flat bookings with RERA
- `payment_schedules` — Milestone-based

---

## 🔐 API Authentication

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rajinfra.com","password":"admin123"}'

# Use token
curl http://localhost:5000/api/v1/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🇮🇳 Indian Compliance Features

| Feature | Implementation |
|---------|---------------|
| GST (CGST/SGST/IGST) | Auto-calculated based on inter/intra state |
| HSN Code | 9954 for construction services |
| TDS Section 194C | 2% company, 1% individual |
| RA Bill Format | CPWD/PWD style with all deductions |
| Retention Money | 5%/10% configurable |
| BOCW Act | Worker registration, welfare fund tracking |
| RERA | Project registration number tracking |
| PF/ESI | 12%/0.75% + 3.25% employer |
| Material Units | Brass, Bags, MT, CUM, SQM as per Indian practice |
| Payment Modes | RTGS, NEFT, UPI, Cash, Cheque, DD |

---

## 📱 Role-Based Access

| Role | Permissions |
|------|------------|
| Super Admin | Full access |
| Admin | Company-wide access |
| Project Manager | All project modules |
| Site Engineer | DPR, Attendance, MB entry |
| QS Engineer | BOQ, MB approval, RA Bills |
| Accountant | Finance, GST, TDS |
| HSE Officer | Incidents, PTW, PPE |
| IT Admin | IT assets, tickets, licenses |
| HR | Workers, payroll |
| Vendor | Limited — view orders |
| Client | Booking, payment schedule |
