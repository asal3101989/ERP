/**
 * Seed script — Bulk insert vendors from exported CSV
 * Source: Vendor_Register_2026-05-05.csv (39 vendors)
 *
 * Run on server:
 *   node src/scripts/seed-vendors.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     process.env.DB_PORT     || 5432,
        database: process.env.DB_NAME     || 'constructerp',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }
);

// Truncate phone to 15 chars (DB column limit)
const ph = s => (s || '').substring(0, 15).trim();

const VENDORS = [
  { code: 'VEN-36931',  name: 'A.M. Steel Furniture',                      gstin: '29BSMPM4754J1Z1', pan: 'BSMPM4754J', type: 'material_supplier', contact: 'Mohammed Nizamuddin Khan', phone: '72040 51255',  city: 'Bangalore' },
  { code: 'VEN-38862',  name: 'ACE AQUATECH',                               gstin: '29DREPS9934M1ZP', pan: 'DREPS9934M', type: 'material_supplier', contact: 'Murali',                   phone: '98453 01082',  city: 'Bangalore' },
  { code: 'VEN-38883',  name: 'Anjaneya Brick Industry',                    gstin: '29ADAPR6088G1Z4', pan: '',          type: 'material_supplier', contact: 'P JAGANNATHA RAJU',        phone: '94811 91575',  city: 'Bangalore' },
  { code: 'VEN-38904',  name: 'Ashok Steel and Cements',                    gstin: '29BBHPG8863L1ZX', pan: '',          type: 'material_supplier', contact: 'Gopal',                    phone: '99800 23652',  city: 'Bangalore' },
  { code: 'VEN-38925',  name: 'Bahulya Buildcast Pvt Ltd',                  gstin: '',               pan: 'AFLPF6564N', type: 'material_supplier', contact: 'Praveen',                  phone: '90362 36269',  city: 'Bangalore' },
  { code: 'VEN-38946',  name: 'Bhuwalka and Sons Pvt Ltd',                  gstin: '29AACCB4494J1ZA', pan: '',          type: 'material_supplier', contact: 'Lokesh Kumar',             phone: '98440 34806',  city: 'Bangalore' },
  { code: 'VEN-38977',  name: 'Bureau Veritas India Private Limited',       gstin: '29DREPS9934M1ZP', pan: 'DREPS9934M', type: 'material_supplier', contact: 'Rakesh',                   phone: '6366069596',   city: 'Bangalore' },
  { code: 'VEN-39019',  name: 'Chiranth Agencies',                         gstin: '29AACFC4867F1ZB', pan: '',          type: 'material_supplier', contact: 'Satyanarayana',            phone: '94481 26763',  city: 'Bangalore' },
  { code: 'VEN-38998',  name: 'CS Waterproofing Solutions Private Limited', gstin: '29AAGCC9162J1Z6', pan: 'AAGCC9162J', type: 'material_supplier', contact: 'Shankar',                  phone: '98863 27440',  city: 'Bangalore' },
  { code: 'VEN-390210', name: 'Dsqaure Tech Implex Pvt Ltd',               gstin: '27AACCD9878J1ZY', pan: '',          type: 'material_supplier', contact: 'Shashikumara',             phone: '91680 09339',  city: 'Pune' },
  { code: 'VEN-390511', name: 'Electro Optics Private Limited',             gstin: '33AAACE1973F1ZZ', pan: '',          type: 'material_supplier', contact: 'Chandra Mohan',            phone: '94441 00817',  city: 'Chennai' },
  { code: 'VEN-390712', name: 'Eternity Infotech',                         gstin: '29AXKPR4291D1Z2', pan: '',          type: 'material_supplier', contact: 'Deekshith',                phone: '98440 00180',  city: 'Bangalore' },
  { code: 'VEN-390913', name: 'Evergreen Engineering',                      gstin: '29BRWPM0822L1Z4', pan: '',          type: 'material_supplier', contact: 'Fakhruddin',               phone: '8618090668',   city: 'Bangalore' },
  { code: 'VEN-391114', name: 'Faczo Tech Pvt Ltd',                        gstin: '',               pan: '',          type: 'material_supplier', contact: 'Yash',                     phone: '70197 89150',  city: 'Bangalore' },
  { code: 'VEN-391215', name: 'Goodwill Hardware Mart',                    gstin: '29BABPS1094Q1ZY', pan: '',          type: 'material_supplier', contact: 'Taha',                     phone: '98869 09427',  city: 'Bangalore' },
  { code: 'VEN-391416', name: 'Habibur Rahaman',                           gstin: '',               pan: 'AYIPR1452R', type: 'material_supplier', contact: 'Habibur',                  phone: '93115 97637',  city: 'Dakshin Dinajpur' },
  { code: 'VEN-391617', name: 'Inderjeet International',                   gstin: '29AGZPS7462B1ZM', pan: '',          type: 'material_supplier', contact: 'Vikram',                   phone: '98860 42957',  city: 'Bangalore' },
  { code: 'VEN-391818', name: 'Innovios Digital PVT LTD',                  gstin: '',               pan: '',          type: 'material_supplier', contact: 'Mr. Harish Kumar',         phone: '7892855085',   city: 'Bangalore' },
  { code: 'VEN-392019', name: 'M/S AARGEE STEEL INC',                      gstin: '29ABTPG6516F1ZD', pan: '',          type: 'material_supplier', contact: 'Pankaj',                   phone: '99005 48183',  city: 'Bangalore' },
  { code: 'VEN-392220', name: 'M/s Habibur Rahaman',                       gstin: '',               pan: 'AYIPR1452R', type: 'material_supplier', contact: 'Habibur',                  phone: '93115 97637',  city: 'Dakshin Dinajpur' },
  { code: 'VEN-392622', name: 'Maharani Constrcutions',                    gstin: '29BSOPJ4948M1ZS', pan: 'BSOPJ4948M', type: 'material_supplier', contact: 'Mr. Joseph',               phone: '93428 85996',  city: 'Bangalore' },
  { code: 'VEN-392421', name: 'MD Faruk Civil Contractor',                 gstin: '',               pan: 'AFLPF6564N', type: 'material_supplier', contact: 'MD Faruk',                 phone: '75698 53661',  city: 'Chatra' },
  { code: 'VEN-392823', name: 'Mysore Plywood suppliers',                  gstin: '29AABPL4092Q1Z2', pan: '',          type: 'material_supplier', contact: 'Mr. Deepak Jain',          phone: '98440 31211',  city: 'Bangalore' },
  { code: 'VEN-393024', name: 'Network detective Agency private Limited',   gstin: '29AACCN3772D1ZG', pan: 'AACCN3772D', type: 'material_supplier', contact: 'Mr. Subhash / Kushalapp', phone: '96064 88908',  city: 'Bangalore' },
  { code: 'VEN-393225', name: 'Pc Infra Steel',                            gstin: '29AEHPA7172E1ZL', pan: '',          type: 'material_supplier', contact: 'Mr. Pratik Agarwal',       phone: '99864 86555',  city: 'Bangalore' },
  { code: 'VEN-393426', name: 'Power Tools and Tackles',                   gstin: '29AABFP0217F1ZN', pan: '',          type: 'material_supplier', contact: 'Mr. Venkat',               phone: '95916 37906',  city: 'Bangalore' },
  { code: 'VEN-393627', name: 'Pragathi Road Lines',                       gstin: '33ACUPB4172E1ZS', pan: 'ACUPB4172E', type: 'material_supplier', contact: 'Sukkur Basha',             phone: '9444176011',   city: 'Chennai' },
  { code: 'VEN-393828', name: 'Royal electricals',                         gstin: '29AKVPA0583B1Z7', pan: '',          type: 'material_supplier', contact: 'Mr. Prakash',              phone: '99165 55362',  city: 'Bangalore' },
  { code: 'VEN-394029', name: 'S.G.S Forklift & Crane service',            gstin: '29ANEPJ2640J1ZY', pan: 'ANEPJ2640J', type: 'material_supplier', contact: 'Mr. Jayaram',              phone: '98801 57676',  city: 'Bangalore' },
  { code: 'VEN-394230', name: 'S.N Enterprises',                           gstin: '',               pan: '',          type: 'material_supplier', contact: 'Mr. Suhas',                phone: '95020 78282',  city: 'Bangalore' },
  { code: 'VEN-395235', name: 'Sahyadri enterprises',                      gstin: '29AQQPM8892G1ZU', pan: '',          type: 'material_supplier', contact: 'Mr. Janardhan Raju',       phone: '98450 91331',  city: 'Bangalore' },
  { code: 'VEN-394431', name: 'SCP Concrete',                              gstin: '29AFDFS4494Q1ZY', pan: '',          type: 'material_supplier', contact: 'Mr. Krishna',              phone: '94490 30232',  city: 'Bangalore' },
  { code: 'VEN-394632', name: 'SM Stone Crusher',                          gstin: '29ACTFS2317K1ZI', pan: '',          type: 'material_supplier', contact: 'Mr. Gajendra Babu',        phone: '98457 51142',  city: 'Bangalore' },
  { code: 'VEN-395336', name: 'Sobha Limited',                             gstin: '',               pan: '',          type: 'material_supplier', contact: 'Ms. Swarna',               phone: '99000 29353',  city: 'Bangalore' },
  { code: 'VEN-394833', name: 'SRI JALADURGA ENTERPRISES',                 gstin: '',               pan: '',          type: 'material_supplier', contact: 'Mr. Prasad',               phone: '98440 19102',  city: 'Bangalore' },
  { code: 'VEN-395637', name: 'Subhash Earth Excavation works',            gstin: '29CMOPS4991Q1ZJ', pan: 'CMOPS4991Q', type: 'material_supplier', contact: 'Mr. Bhawa Singh',          phone: '99018 02132',  city: 'Bangalore' },
  { code: 'VEN-395034', name: 'SV Enterprises',                            gstin: '29ACIPP7229C1ZF', pan: '',          type: 'material_supplier', contact: 'Mr Praveen',               phone: '99005 43776',  city: 'Bangalore' },
  { code: 'VEN-395838', name: 'Trinity press',                             gstin: '29AERPJ8121N1ZS', pan: 'CMOPS4991Q', type: 'material_supplier', contact: 'Mr. V John',               phone: '92431 32818',  city: 'Bangalore' },
  { code: 'VEN-396039', name: 'Vishwakarma wood & Interior works',         gstin: '',               pan: '',          type: 'material_supplier', contact: '',                         phone: '98450 26946',  city: 'Bangalore' },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const companyRes = await client.query(`SELECT id FROM companies LIMIT 1`);
    if (!companyRes.rows.length) {
      console.error('❌  No company found in database.');
      process.exit(1);
    }
    const companyId = companyRes.rows[0].id;

    let inserted = 0, skipped = 0;

    for (const v of VENDORS) {
      const res = await client.query(
        `INSERT INTO vendors
           (company_id, vendor_code, name, gstin, pan, vendor_type,
            contact_person, phone, city, state, credit_days, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (vendor_code) DO NOTHING
         RETURNING id`,
        [
          companyId,
          v.code,
          v.name,
          v.gstin || null,
          v.pan   || null,
          v.type,
          v.contact || null,
          ph(v.phone),
          v.city || null,
          'Karnataka',
          30,
          true,
        ]
      );
      if (res.rowCount > 0) {
        console.log(`   ✔ ${v.code}  ${v.name}`);
        inserted++;
      } else {
        console.log(`   ⏭  ${v.code}  ${v.name}  (already exists)`);
        skipped++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅  Done! ${inserted} inserted, ${skipped} skipped.`);
    console.log(`   Total vendors in batch: ${VENDORS.length}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
