// backend/src/config/seed.js
// Run: node src/config/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { pool } = require('./database');

async function seed() {
  const client = await pool.connect();
  console.log('🌱 Seeding database with Indian construction sample data...');

  try {
    await client.query('BEGIN');

    // ─── Company ─────────────────────────────────────
    const companyId = uuid();
    await client.query(
      `INSERT INTO companies (id, name, gstin, pan, cin, address, city, state, pincode, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [companyId, 'Raj Infra Private Limited', '27AAARC1234C1Z5', 'AAARC1234C',
       'U45200MH2015PTC268901', 'Plot 42, Nagar Road', 'Pune', 'Maharashtra', '411014',
       '9876543210', 'info@rajinfra.com']
    );

    // ─── Users ───────────────────────────────────────
    const pass = await bcrypt.hash('demo123', 12);
    const adminPass = await bcrypt.hash('admin123', 12);

    const users = [
      { id: uuid(), code: 'EMP001', name: 'Rajesh Sharma', email: 'admin@rajinfra.com',     phone: '9876543210', role: 'admin',          designation: 'Managing Director',     hash: adminPass },
      { id: uuid(), code: 'EMP002', name: 'Suresh Patil',  email: 'pm@rajinfra.com',         phone: '9876543211', role: 'project_manager', designation: 'Senior Project Manager', hash: pass },
      { id: uuid(), code: 'EMP003', name: 'Ramesh Kumar',  email: 'site@rajinfra.com',       phone: '9876543212', role: 'site_engineer',   designation: 'Site Engineer',          hash: pass },
      { id: uuid(), code: 'EMP004', name: 'Priya Mehta',   email: 'qs@rajinfra.com',         phone: '9876543213', role: 'qs_engineer',     designation: 'Quantity Surveyor',      hash: pass },
      { id: uuid(), code: 'EMP005', name: 'Anand Joshi',   email: 'accounts@rajinfra.com',   phone: '9876543214', role: 'accountant',      designation: 'Senior Accountant',      hash: pass },
      { id: uuid(), code: 'EMP006', name: 'Kavita Rao',    email: 'hse@rajinfra.com',        phone: '9876543215', role: 'hse_officer',     designation: 'HSE Officer',            hash: pass },
      { id: uuid(), code: 'EMP007', name: 'Kiran Desai',   email: 'it@rajinfra.com',         phone: '9876543216', role: 'it_admin',        designation: 'IT Administrator',       hash: pass },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id,company_id,employee_code,name,email,phone,password_hash,role,designation,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) ON CONFLICT (email) DO NOTHING`,
        [u.id, companyId, u.code, u.name, u.email, u.phone, u.hash, u.role, u.designation]
      );
    }

    const [adminId, pmId, seId, qsId] = users.map(u => u.id);

    // ─── Projects ────────────────────────────────────
    const projects = [
      {
        id: uuid(), code: 'PRJ-001',
        name: 'Skyline Heights', type: 'residential',
        client: 'Skyline Developers Pvt Ltd', gstin: '27AABCS1234C1Z5', pan: 'AABCS1234C',
        location: 'Baner Road, Baner', city: 'Pune', state: 'Maharashtra',
        rera: 'P52100054321', value: 85000000, start: '2023-03-01', end: '2025-12-31',
        gst_type: 'intra', status: 'active', pct: 60,
      },
      {
        id: uuid(), code: 'PRJ-002',
        name: 'NH-48 Highway Package', type: 'infrastructure',
        client: 'NHAI Mumbai Region', gstin: '07AAACN0025C1ZV', pan: 'AAACN0025C',
        location: 'Nashik–Mumbai NH-48', city: 'Nashik', state: 'Maharashtra',
        rera: null, value: 120000000, start: '2024-01-01', end: '2025-03-31',
        gst_type: 'intra', status: 'delayed', pct: 77,
      },
      {
        id: uuid(), code: 'PRJ-003',
        name: 'Kohinoor IT Park', type: 'commercial',
        client: 'Kohinoor Realty Ltd', gstin: '36AABCK5678D1Z8', pan: 'AABCK5678D',
        location: 'HITEC City, Madhapur', city: 'Hyderabad', state: 'Telangana',
        rera: null, value: 62000000, start: '2024-10-01', end: '2026-09-30',
        gst_type: 'inter', status: 'active', pct: 22,
      },
      {
        id: uuid(), code: 'PRJ-004',
        name: 'Green Valley Villas', type: 'residential',
        client: 'Green Valley Developers', gstin: '27AABCG9012E1Z2', pan: 'AABCG9012E',
        location: 'Lonavala, Pune District', city: 'Lonavala', state: 'Maharashtra',
        rera: 'P52100098765', value: 48000000, start: '2023-06-01', end: '2025-06-30',
        gst_type: 'intra', status: 'active', pct: 96,
      },
    ];

    for (const p of projects) {
      await client.query(
        `INSERT INTO projects (id,company_id,project_code,name,type,client_name,client_gstin,client_pan,
           location,city,state,rera_number,contract_value,start_date,end_date,
           project_manager_id,site_engineer_id,qs_engineer_id,gst_type,status,progress_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT DO NOTHING`,
        [p.id, companyId, p.code, p.name, p.type, p.client, p.gstin, p.pan,
         p.location, p.city, p.state, p.rera, p.value, p.start, p.end,
         pmId, seId, qsId, p.gst_type, p.status, p.pct]
      );
    }

    const [proj1Id, proj2Id] = projects.map(p => p.id);

    // ─── BOQ Items ───────────────────────────────────
    const boqItems = [
      { proj: proj1Id, ch: '1', chName: 'Earth Work',    no: '1.1', desc: 'Excavation in ordinary soil for foundation (up to 3m deep)', unit: 'CUM', qty: 1420, rate: 580 },
      { proj: proj1Id, ch: '2', chName: 'RCC Works',     no: '2.1', desc: 'PCC M10 grade (1:3:6) — 75mm thick blinding in foundation', unit: 'CUM', qty: 280, rate: 4200 },
      { proj: proj1Id, ch: '2', chName: 'RCC Works',     no: '2.2', desc: 'RCC M25 grade — Raft foundation (with HYSD bars)', unit: 'CUM', qty: 1850, rate: 9800 },
      { proj: proj1Id, ch: '2', chName: 'RCC Works',     no: '2.3', desc: 'RCC M30 grade — Columns, beams, slabs (Floors 1–18) incl. centering, shuttering, curing', unit: 'CUM', qty: 3420, rate: 11200, hsn: '9954' },
      { proj: proj1Id, ch: '2', chName: 'RCC Works',     no: '2.4', desc: 'TMT Fe-500D bars — Providing, bending & placing (all diameters 8–25mm)', unit: 'MT', qty: 480, rate: 71500, hsn: '7214' },
      { proj: proj1Id, ch: '3', chName: 'Masonry Works', no: '3.1', desc: '230mm AAC block wall with CM 1:6 (Floors 1–18) incl. chicken mesh at jambs', unit: 'SQM', qty: 6200, rate: 920 },
      { proj: proj1Id, ch: '3', chName: 'Masonry Works', no: '3.2', desc: '115mm brick wall partition with CM 1:4', unit: 'SQM', qty: 2800, rate: 640 },
      { proj: proj1Id, ch: '4', chName: 'Plaster & Finishes', no: '4.1', desc: '12mm CM 1:6 internal plaster (two coat) incl. chicken mesh at junctions', unit: 'SQM', qty: 18400, rate: 280 },
      { proj: proj1Id, ch: '4', chName: 'Plaster & Finishes', no: '4.2', desc: 'Ceramic floor tiles 600×600mm (vitrified) with CM 1:4 base', unit: 'SQM', qty: 8200, rate: 1400 },
    ];

    for (const b of boqItems) {
      await client.query(
        `INSERT INTO boq_items (project_id,chapter_no,chapter_name,item_no,description,unit,quantity,rate,hsn_code,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
        [b.proj, b.ch, b.chName, b.no, b.desc, b.unit, b.qty, b.rate, b.hsn || '9954', qsId]
      );
    }

    // ─── Vendors ─────────────────────────────────────
    const vendors = [
      { name: 'Shinde Construction Pvt Ltd', gstin: '27AAASC1234D1Z8', pan: 'AAASC1234D', type: 'subcontractor', city: 'Pune', phone: '9823451234' },
      { name: 'ACC Cement Ltd', gstin: '27AAACC4567E1Z4', pan: 'AAACC4567E', type: 'material_supplier', city: 'Mumbai', phone: '9823451235' },
      { name: 'TATA Steel Ltd', gstin: '21AAACT1234F1Z2', pan: 'AAACT1234F', type: 'material_supplier', city: 'Jamshedpur', phone: '9823451236' },
      { name: 'Kumar Labour Contractor', gstin: null, pan: 'CCCEK5678F', type: 'labour_contractor', city: 'Pune', phone: '9823451237' },
      { name: 'Raj Traders (Building Materials)', gstin: '27AAATR7890G1Z1', pan: 'AAATR7890G', type: 'material_supplier', city: 'Nashik', phone: '9823451238' },
    ];

    const vendorIds = [];
    for (const v of vendors) {
      const id = uuid();
      vendorIds.push(id);
      const code = `VEN-${String(vendorIds.length).padStart(3,'0')}`;
      await client.query(
        `INSERT INTO vendors (id,company_id,vendor_code,name,gstin,pan,vendor_type,phone,city,state,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Maharashtra',true) ON CONFLICT DO NOTHING`,
        [id, companyId, code, v.name, v.gstin, v.pan, v.type, v.phone, v.city]
      );
    }

    // ─── Workers ─────────────────────────────────────
    const workers = [
      { name: 'Raju Yadav', skill: 'mason', gang: 'Raju Gang', rate: 850, bocw: 'MH48291', origin: 'Bihar' },
      { name: 'Suresh Carpenter', skill: 'carpenter', gang: 'Suresh Gang', rate: 900, bocw: 'MH48302', origin: 'Maharashtra' },
      { name: 'Mohan Singh', skill: 'bar_bender', gang: 'Mohan Gang', rate: 780, bocw: 'MH48318', origin: 'Uttar Pradesh' },
      { name: 'Ramesh Helper', skill: 'helper', gang: null, rate: 600, bocw: 'MH48325', origin: 'Rajasthan' },
      { name: 'Prakash Mason', skill: 'mason', gang: 'Raju Gang', rate: 800, bocw: 'MH48330', origin: 'Bihar' },
    ];

    for (const w of workers) {
      const code = `WRK-${String(Math.floor(Math.random()*9000)+1000)}`;
      await client.query(
        `INSERT INTO workers (project_id,worker_code,name,skill_type,gang_name,contractor_id,bocw_number,daily_rate,state_of_origin,is_active,joined_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'2023-03-01') ON CONFLICT DO NOTHING`,
        [proj1Id, code, w.name, w.skill, w.gang, vendorIds[3], w.bocw, w.rate, w.origin]
      );
    }

    // ─── Inventory ───────────────────────────────────
    const materials = [
      { name: 'OPC Cement 53 Grade', code: 'CEM-001', hsn: '2523', unit: 'Bags', opening: 900, closing: 620, min: 500 },
      { name: 'TMT Steel Fe-500D', code: 'STL-001', hsn: '7214', unit: 'MT', opening: 6.2, closing: 18.4, min: 15 },
      { name: 'AAC Blocks 200mm', code: 'BLK-001', hsn: '6810', unit: 'Nos', opening: 5200, closing: 800, min: 2000 },
      { name: 'River Sand (M-Sand)', code: 'SND-001', hsn: '2505', unit: 'Brass', opening: 40, closing: 28, min: 20 },
      { name: '20mm Metal Aggregate', code: 'AGG-001', hsn: '2517', unit: 'Brass', opening: 18, closing: 32, min: 25 },
    ];

    for (const m of materials) {
      await client.query(
        `INSERT INTO inventory (project_id,material_name,material_code,hsn_code,unit,site_location,opening_stock,closing_stock,minimum_level)
         VALUES ($1,$2,$3,$4,$5,'main',$6,$7,$8)
         ON CONFLICT (project_id,material_name,site_location) DO UPDATE
         SET closing_stock = EXCLUDED.closing_stock`,
        [proj1Id, m.name, m.code, m.hsn, m.unit, m.opening, m.closing, m.min]
      );
    }

    // ─── IT Assets ───────────────────────────────────
    const itAssets = [
      { tag: 'IT-L001', type: 'laptop',    brand: 'Dell', model: 'Latitude 5540', sn: 'DLLT-5540-94821', cost: 85000, warranty: '2026-01-15', user: users[1].id, loc: 'HO Pune' },
      { tag: 'IT-L002', type: 'laptop',    brand: 'HP', model: 'EliteBook 840', sn: 'HP840-G9-20381', cost: 78000, warranty: '2025-03-20', user: users[2].id, loc: 'Skyline Site' },
      { tag: 'IT-B001', type: 'biometric', brand: 'eSSL', model: 'X990', sn: 'ESSL-X990-48210', cost: 12000, warranty: '2026-06-10', user: null, loc: 'Skyline Site Gate' },
      { tag: 'IT-C001', type: 'cctv',      brand: 'Hikvision', model: 'DS-2CD 4MP', sn: 'HIK-2CD-91821', cost: 8500, warranty: '2026-10-05', user: null, loc: 'NH-48 Site' },
      { tag: 'IT-R001', type: 'router',    brand: 'Cisco', model: 'RV345', sn: 'CIS-RV345-20811', cost: 18000, warranty: '2024-01-15', user: null, loc: 'HO Server Room' },
    ];

    for (const a of itAssets) {
      await client.query(
        `INSERT INTO it_assets (company_id,asset_tag,asset_type,brand,model,serial_number,purchase_cost,warranty_expiry,assigned_to,location_description,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'in_use') ON CONFLICT DO NOTHING`,
        [companyId, a.tag, a.type, a.brand, a.model, a.sn, a.cost, a.warranty, a.user, a.loc]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed data inserted successfully!');
    console.log('\n📋 Demo Login Credentials:');
    console.log('  Admin:           admin@rajinfra.com  / admin123');
    console.log('  Project Manager: pm@rajinfra.com     / demo123');
    console.log('  Site Engineer:   site@rajinfra.com   / demo123');
    console.log('  QS Engineer:     qs@rajinfra.com     / demo123');
    console.log('  Accountant:      accounts@rajinfra.com / demo123');
    console.log('  HSE Officer:     hse@rajinfra.com    / demo123');
    console.log('  IT Admin:        it@rajinfra.com     / demo123');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
