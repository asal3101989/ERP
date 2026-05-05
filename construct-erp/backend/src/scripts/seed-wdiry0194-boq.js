/**
 * Seed script — Project + BOQ items for Work Order WDIRY0194
 * Project: Residential Apartments - Yelahanka (Divyasree)
 *
 * Run on server:
 *   node src/scripts/seed-wdiry0194-boq.js
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

const BOQ_ITEMS = [
  {
    item_no: '1', sr_no: '01.36.61.01.25.56.141',
    description: 'Excavation in all types of soil except rocks not exceeding 1.5 m depth including dressing for camber & disposing the excess earth & spreading in layers of 250mm within the site to the required levels wherever specified',
    unit: 'Cum', quantity: 571.35, rate: 550.00,
  },
  {
    item_no: '2', sr_no: '01.36.61.01.25.56.142',
    description: 'Providing & laying 250thk GSB consisting of morum, crushed stone & gravel mixed in proportion as specified including preparation of subgrade after trimming to required level. Rate is inclusive of lead, lift, Compaction etc as per site requirement',
    unit: 'Cum', quantity: 147.75, rate: 3250.00,
  },
  {
    item_no: '3', sr_no: '01.36.61.01.25.56.143',
    description: 'WMM 150mm thick providing & laying of wet mixed macadam in 1 layer of 150mm thickness as per morth table 100-12 to make the existing road slope towards proposed drain including watering & compacting by virbartory roller to achieve 98% proctor density',
    unit: 'Cum', quantity: 88.65, rate: 2400.00,
  },
  {
    item_no: '4', sr_no: '01.36.61.01.25.56.144',
    description: 'DBM 80MM thk Providing and laying 80mm consolidating thickness dense bituminous macadam using 20mm and 12mm size metal mixed with 60/70 grade hot bitumen at 56.00kg/cum metal mix from central hot mix plant and laid by paver and consolidated with vibrator',
    unit: 'Sqm', quantity: 591.00, rate: 825.00,
  },
  {
    item_no: '5', sr_no: '01.36.61.01.25.56.145',
    description: 'Providing and laying of 40mm compacted thick asphalt concrete over the prepared bituminuos macadam with aggregates as per MORTH specifications',
    unit: 'Sqm', quantity: 591.00, rate: 400.00,
  },
  {
    item_no: '6', sr_no: '01.36.61.01.25.56.146',
    description: 'Storm water Drain Outside Main Gate - Providing and laying P.C.C. 1:3:6 M10 of specified thick wherever specified using M.sand, 20mm and downsize metal including base reperation, Compaction, levelling, all leads and lifts, curing and shuttering if necessary etc., Complete',
    unit: 'Cum', quantity: 9.45, rate: 6150.00,
  },
  {
    item_no: '7', sr_no: '01.36.61.01.25.56.147',
    description: 'Providing & laying Storm water drain Raft, wall concrete - M25 grade',
    unit: 'Cum', quantity: 52.20, rate: 7600.00,
  },
  {
    item_no: '8', sr_no: '01.36.61.01.25.56.148',
    description: 'Providing & Fixing Storm water drain Raft, wall Shuttering',
    unit: 'Sqm', quantity: 409.29, rate: 895.50,
  },
  {
    item_no: '9', sr_no: '01.36.61.01.25.56.149',
    description: 'Providing, Supplying, Fabricating & fixing in position reinforcement for RCC work with high yield strength ribbed cold twisted tor steel (HSD) bar of various diameters and grade of steel as specified in drawing to IS specification including cutting, providing, supplying & bending, hoisting, fabricating and placing in position according to drawings and binding the reinforcement with galvanised annealed binding wire of double fold of 18 gauge and providing PVC cover blocks for placing the reinforcements in position and for maintaining the cover specified or according to relevant IS.',
    unit: 'MT', quantity: 3.65, rate: 73000.00,
  },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get company and admin user
    const companyRes = await client.query(`SELECT id FROM companies LIMIT 1`);
    if (!companyRes.rows.length) {
      console.error('❌  No company found in database.');
      process.exit(1);
    }
    const companyId = companyRes.rows[0].id;

    const userRes = await client.query(
      `SELECT id FROM users WHERE company_id = $1 AND role IN ('super_admin','admin') LIMIT 1`,
      [companyId]
    );
    const userId = userRes.rows[0]?.id || null;

    // Find or create project
    let projectId;
    const existingProj = await client.query(
      `SELECT id FROM projects WHERE project_code = $1 AND company_id = $2 LIMIT 1`,
      ['WDIRY0194', companyId]
    );

    if (existingProj.rows.length) {
      projectId = existingProj.rows[0].id;
      console.log(`✅  Project already exists (id: ${projectId})`);
    } else {
      const projRes = await client.query(
        `INSERT INTO projects
          (company_id, project_code, name, type, status, client_name, client_gstin, client_pan,
           location, city, state, contract_value, start_date, end_date, gst_type, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          companyId,
          'WDIRY0194',
          'Residential Apartments - Yelahanka',
          'residential',
          'active',
          'Divyasree Infrastructure Projects Pvt Ltd',
          '29AADCD3654M1Z9',
          'AADCD3654M',
          'Yelahanka',
          'Bengaluru',
          'Karnataka',
          2819263.70,
          '2026-01-23',
          '2027-01-22',
          'intra',
          'Main entry Gate Road work & storm water drain civil work. WO No: WDIRY0194, WRF No: WRF 092 dtd 28.11.2025. SAC Code: 995411.',
        ]
      );
      projectId = projRes.rows[0].id;
      console.log(`✅  Project created: Residential Apartments - Yelahanka (id: ${projectId})`);
    }

    // Ensure sr_no column exists (idempotent)
    await client.query(`ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS sr_no VARCHAR(100)`);

    // Check if BOQ items already exist
    const existingBOQ = await client.query(
      `SELECT COUNT(*) FROM boq_items WHERE project_id = $1 AND is_active = true`,
      [projectId]
    );
    const existingCount = parseInt(existingBOQ.rows[0].count);

    if (existingCount > 0) {
      // Items exist — just patch sr_no values
      console.log(`ℹ️   ${existingCount} BOQ items found. Patching sr_no (CSI Code) values...`);
      for (const item of BOQ_ITEMS) {
        await client.query(
          `UPDATE boq_items SET sr_no = $1 WHERE project_id = $2 AND item_no = $3`,
          [item.sr_no, projectId, item.item_no]
        );
        console.log(`   ✔ Patched Item ${item.item_no}: sr_no = ${item.sr_no}`);
      }
    } else {
      // Fresh insert
      for (const item of BOQ_ITEMS) {
        await client.query(
          `INSERT INTO boq_items
            (project_id, chapter_no, chapter_name, item_no, sr_no, description, unit, quantity, rate, hsn_code, remarks, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            projectId, '01', 'Road Work & Storm Water Drain',
            item.item_no, item.sr_no, item.description,
            item.unit, item.quantity, item.rate,
            '995411',
            'WO: WDIRY0194 | WRF 092 dtd 28.11.2025',
            userId,
          ]
        );
        const amount = (item.quantity * item.rate).toLocaleString('en-IN');
        console.log(`   ✔ Item ${item.item_no}: ${item.unit} ${item.quantity} × ₹${item.rate} = ₹${amount}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅  Done! CSI Codes (sr_no) are now set for all 9 BOQ items.');
    console.log('   Gross Total : ₹28,19,263.70');
    console.log('   GST 18%     : ₹5,07,467.48  (CGST ₹2,53,733.74 + SGST ₹2,53,733.74)');
    console.log('   Net Total   : ₹33,26,731.18');

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
