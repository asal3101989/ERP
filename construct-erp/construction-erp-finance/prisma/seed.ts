// ============================================================
// prisma/seed.ts
// Realistic construction ERP seed data
// ============================================================
import { PrismaClient, UserRole, ProjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Construction ERP Finance Module...');

  // ── Users
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@constructerp.in' },
    update: {},
    create: {
      email: 'admin@constructerp.in',
      passwordHash,
      fullName: 'Rajesh Kumar',
      role: UserRole.ADMIN,
      department: 'Finance',
      phone: '+91-9876543210',
      employeeId: 'EMP-001',
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@constructerp.in' },
    update: {},
    create: {
      email: 'accountant@constructerp.in',
      passwordHash,
      fullName: 'Priya Sharma',
      role: UserRole.ACCOUNTANT,
      department: 'Finance',
      phone: '+91-9876543211',
      employeeId: 'EMP-002',
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@constructerp.in' },
    update: {},
    create: {
      email: 'pm@constructerp.in',
      passwordHash,
      fullName: 'Vikram Nair',
      role: UserRole.PROJECT_MANAGER,
      department: 'Projects',
      phone: '+91-9876543212',
      employeeId: 'EMP-003',
    },
  });

  // ── Chart of Accounts
  const accountsData = [
    // Assets
    { code: '1000', name: 'Assets', type: 'ASSET', subType: 'CURRENT_ASSET', isSystemAccount: true },
    { code: '1001', name: 'Cash in Hand', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1000' },
    { code: '1010', name: 'HDFC Bank Current A/C', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1000' },
    { code: '1011', name: 'SBI Bank Current A/C', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1000' },
    { code: '1002', name: 'Accounts Receivable', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1000', isSystemAccount: true },
    { code: '1020', name: 'GST Input Tax Credit', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1000' },
    { code: '1030', name: 'Advance to Vendors', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1000' },
    { code: '1100', name: 'Fixed Assets', type: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1101', name: 'Plant & Machinery', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1100' },
    { code: '1102', name: 'Office Equipment', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1100' },
    // Liabilities
    { code: '2000', name: 'Liabilities', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', isSystemAccount: true },
    { code: '2001', name: 'Accounts Payable', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2000', isSystemAccount: true },
    { code: '2010', name: 'TDS Payable', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2000' },
    { code: '2011', name: 'PF Payable', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2000' },
    { code: '2012', name: 'ESI Payable', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2000' },
    { code: '2020', name: 'GST Output Tax', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2000' },
    { code: '2030', name: 'Advance from Clients', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2000' },
    // Revenue
    { code: '4000', name: 'Revenue', type: 'REVENUE', subType: 'OPERATING_REVENUE', isSystemAccount: true },
    { code: '4001', name: 'Contract Revenue', type: 'REVENUE', subType: 'OPERATING_REVENUE', parentCode: '4000', isSystemAccount: true },
    { code: '4002', name: 'Retention Release', type: 'REVENUE', subType: 'OPERATING_REVENUE', parentCode: '4000' },
    // Expenses
    { code: '5000', name: 'Direct Costs', type: 'EXPENSE', subType: 'COST_OF_GOODS_SOLD', isSystemAccount: true },
    { code: '5001', name: 'Material Cost', type: 'EXPENSE', subType: 'COST_OF_GOODS_SOLD', parentCode: '5000', isSystemAccount: true },
    { code: '5002', name: 'Labor Cost', type: 'EXPENSE', subType: 'COST_OF_GOODS_SOLD', parentCode: '5000' },
    { code: '5003', name: 'Equipment Cost', type: 'EXPENSE', subType: 'COST_OF_GOODS_SOLD', parentCode: '5000' },
    { code: '5004', name: 'Subcontractor Cost', type: 'EXPENSE', subType: 'COST_OF_GOODS_SOLD', parentCode: '5000' },
    { code: '5005', name: 'Overhead', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', parentCode: '5000' },
    { code: '5010', name: 'Salary & Wages', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', isSystemAccount: true },
    { code: '5020', name: 'Depreciation', type: 'EXPENSE', subType: 'DEPRECIATION' },
  ];

  // Create root accounts first, then children
  const accountMap: Record<string, string> = {};
  for (const acc of accountsData.filter((a) => !a.parentCode)) {
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
        subType: acc.subType as any,
        isSystemAccount: acc.isSystemAccount || false,
      },
    });
    accountMap[acc.code] = created.id;
  }
  for (const acc of accountsData.filter((a) => a.parentCode)) {
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
        subType: acc.subType as any,
        parentId: accountMap[acc.parentCode!],
        isSystemAccount: acc.isSystemAccount || false,
      },
    });
    accountMap[acc.code] = created.id;
  }

  // ── Clients
  const client1 = await prisma.client.upsert({
    where: { clientCode: 'CLT-001' },
    update: {},
    create: {
      clientCode: 'CLT-001',
      name: 'Karnataka State Highways Department',
      contactPerson: 'Suresh Babu',
      email: 'suresh@kshd.gov.in',
      phone: '+91-80-22345678',
      address: 'Freedom Park, Bengaluru 560001',
      gstin: '29AAKCK1234A1Z5',
      panNumber: 'AAKCK1234A',
      paymentTerms: 30,
    },
  });

  const client2 = await prisma.client.upsert({
    where: { clientCode: 'CLT-002' },
    update: {},
    create: {
      clientCode: 'CLT-002',
      name: 'Prestige Estates Projects Ltd',
      contactPerson: 'Ananya Rao',
      email: 'ananya@prestigegroup.com',
      phone: '+91-80-25599000',
      address: '1, Prestige Shantiniketan, ITPL Main Rd, Bengaluru 560048',
      gstin: '29AABCP1234B1Z3',
      panNumber: 'AABCP1234B',
      paymentTerms: 45,
    },
  });

  // ── Vendors
  const vendor1 = await prisma.vendor.upsert({
    where: { vendorCode: 'VND-001' },
    update: {},
    create: {
      vendorCode: 'VND-001',
      name: 'Ultratech Cement Distributors',
      vendorType: 'MATERIAL_SUPPLIER',
      contactPerson: 'Ramesh Gowda',
      email: 'ramesh@ultratechdist.com',
      phone: '+91-9845012345',
      address: 'Peenya Industrial Area, Bengaluru 560058',
      gstin: '29AABCU1234C1Z1',
      panNumber: 'AABCU1234C',
      tdsApplicable: true,
      tdsSection: 'SEC_194Q',
      paymentTerms: 30,
      bankAccounts: {
        create: [{
          accountName: 'Ultratech Cement Distributors',
          accountNumber: '50100123456789',
          ifscCode: 'HDFC0001234',
          bankName: 'HDFC Bank',
          branch: 'Peenya Branch',
          isPrimary: true,
        }],
      },
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { vendorCode: 'VND-002' },
    update: {},
    create: {
      vendorCode: 'VND-002',
      name: 'Sri Sai Steel Fabricators',
      vendorType: 'SUBCONTRACTOR',
      contactPerson: 'Kiran Kumar',
      email: 'kiran@saissteelfab.com',
      phone: '+91-9900123456',
      address: 'Bommasandra Industrial Area, Bengaluru 560099',
      gstin: '29AABCS1234D1Z9',
      panNumber: 'AABCS1234D',
      tdsApplicable: true,
      tdsSection: 'SEC_194C',
      paymentTerms: 15,
      bankAccounts: {
        create: [{
          accountName: 'Sri Sai Steel Fabricators',
          accountNumber: '35678901234567',
          ifscCode: 'SBIN0040123',
          bankName: 'State Bank of India',
          branch: 'Bommasandra Branch',
          isPrimary: true,
        }],
      },
    },
  });

  const vendor3 = await prisma.vendor.upsert({
    where: { vendorCode: 'VND-003' },
    update: {},
    create: {
      vendorCode: 'VND-003',
      name: 'Ace Equipment Rentals Pvt Ltd',
      vendorType: 'EQUIPMENT_SUPPLIER',
      contactPerson: 'Pradeep Shetty',
      email: 'pradeep@acerentals.com',
      phone: '+91-9880567890',
      address: 'Whitefield, Bengaluru 560066',
      gstin: '29AABCA1234E1Z7',
      panNumber: 'AABCA1234E',
      tdsApplicable: true,
      tdsSection: 'SEC_194I',
      paymentTerms: 7,
    },
  });

  // ── Projects
  const project1 = await prisma.project.upsert({
    where: { projectCode: 'PROJ-2024-001' },
    update: {},
    create: {
      projectCode: 'PROJ-2024-001',
      name: 'NH-44 Highway Widening - Phase 2',
      description: '4-lane to 6-lane widening of NH-44 from Hoskote to Malur, 28km stretch',
      clientId: client1.id,
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2024-04-01'),
      endDate: new Date('2026-03-31'),
      contractValue: 4250000000,  // ₹425 Crore
      location: 'Hoskote to Malur, Karnataka',
      projectManager: pm.id,
      siteAddress: 'NH-44 Kilometer Marker 512, Hoskote, Karnataka',
      gstRegistration: '29AAKCK5678A2Z3',
    },
  });

  const project2 = await prisma.project.upsert({
    where: { projectCode: 'PROJ-2024-002' },
    update: {},
    create: {
      projectCode: 'PROJ-2024-002',
      name: 'Prestige Skyline Tower - Structural Works',
      description: 'RCC structural works for 42-storey residential tower',
      clientId: client2.id,
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2025-12-31'),
      contractValue: 180000000,   // ₹18 Crore
      location: 'Whitefield, Bengaluru',
      projectManager: pm.id,
    },
  });

  // ── Budgets
  const budget1 = await prisma.budget.create({
    data: {
      budgetNumber: 'BUD-2024-00001',
      projectId: project1.id,
      version: 1,
      status: 'APPROVED',
      totalBudget: 3800000000,   // ₹380 Crore (project cost)
      fiscalYear: 2024,
      approvedById: admin.id,
      approvedAt: new Date('2024-04-05'),
      createdById: accountant.id,
      description: 'Original budget as per BOQ Rev 3',
      lineItems: {
        create: [
          { costHead: 'MATERIAL', description: 'Bitumen, Aggregate, Cement, Steel', plannedAmount: 1520000000, actualAmount: 420000000, committedAmount: 280000000, varianceAmount: 820000000, utilizationPct: 27.63 },
          { costHead: 'LABOR', description: 'Site Labor & Supervisors', plannedAmount: 760000000, actualAmount: 198000000, committedAmount: 0, varianceAmount: 562000000, utilizationPct: 26.05 },
          { costHead: 'EQUIPMENT', description: 'Excavators, Pavers, Rollers', plannedAmount: 570000000, actualAmount: 125000000, committedAmount: 95000000, varianceAmount: 350000000, utilizationPct: 21.93 },
          { costHead: 'SUBCONTRACTOR', description: 'Earthwork & Drainage Subcontractors', plannedAmount: 665000000, actualAmount: 210000000, committedAmount: 140000000, varianceAmount: 315000000, utilizationPct: 31.58 },
          { costHead: 'OVERHEAD', description: 'Site Office, Utilities, Insurance', plannedAmount: 190000000, actualAmount: 45000000, committedAmount: 0, varianceAmount: 145000000, utilizationPct: 23.68 },
          { costHead: 'CONTINGENCY', description: '5% Contingency Reserve', plannedAmount: 95000000, actualAmount: 0, committedAmount: 0, varianceAmount: 95000000, utilizationPct: 0 },
        ],
      },
    },
  });

  // ── Approval Rules
  await prisma.approvalRule.createMany({
    data: [
      { name: 'L1 Approval - Up to 5 Lakh', entityType: 'INVOICE', level: 1, minAmount: 0, maxAmount: 500000, approverId: accountant.id, escalationDays: 2 },
      { name: 'L2 Approval - Up to 50 Lakh', entityType: 'INVOICE', level: 2, minAmount: 500001, maxAmount: 5000000, approverId: pm.id, escalationDays: 3 },
      { name: 'L3 Approval - Above 50 Lakh', entityType: 'INVOICE', level: 3, minAmount: 5000001, approverId: admin.id, escalationDays: 5 },
    ],
    skipDuplicates: true,
  });

  // ── Employees
  const employees = await prisma.employee.createMany({
    data: [
      { employeeCode: 'EMP-S001', name: 'Mohan Das', designation: 'Site Engineer', department: 'Engineering', projectId: project1.id, basicSalary: 45000, pfNumber: 'KR/KR/12345/001', panNumber: 'ABCDE1234F', bankAccountNo: '123456789012', bankIfsc: 'HDFC0001234', bankName: 'HDFC Bank', joiningDate: new Date('2023-01-15') },
      { employeeCode: 'EMP-S002', name: 'Lakshmi Devi', designation: 'Accountant', department: 'Finance', basicSalary: 35000, pfNumber: 'KR/KR/12345/002', panNumber: 'FGHIJ5678K', bankAccountNo: '234567890123', bankIfsc: 'SBIN0040123', bankName: 'SBI', joiningDate: new Date('2022-08-01') },
      { employeeCode: 'EMP-S003', name: 'Prakash Hegde', designation: 'Foreman', department: 'Site Operations', projectId: project1.id, basicSalary: 28000, pfNumber: 'KR/KR/12345/003', bankAccountNo: '345678901234', bankIfsc: 'CNRB0001234', bankName: 'Canara Bank', joiningDate: new Date('2023-04-01') },
    ],
    skipDuplicates: true,
  });

  // ── Document Sequences (pre-seed)
  await prisma.$executeRaw`
    INSERT INTO document_sequences (type, year, current_value)
    VALUES
      ('INVOICE', ${new Date().getFullYear()}, 12),
      ('PAYMENT', ${new Date().getFullYear()}, 8),
      ('JOURNAL', ${new Date().getFullYear()}, 15),
      ('BUDGET', ${new Date().getFullYear()}, 3)
    ON CONFLICT (type, year) DO NOTHING
  `;

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Login credentials:');
  console.log('  Admin:      admin@constructerp.in / Admin@123');
  console.log('  Accountant: accountant@constructerp.in / Admin@123');
  console.log('  PM:         pm@constructerp.in / Admin@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
