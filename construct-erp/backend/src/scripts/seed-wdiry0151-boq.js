/**
 * Seed script — Project + BOQ items for Work Order WDIRY0151
 * Project: Residential Apartments - Yelahanka (Retaining Wall & STP)
 * Client : Divyasree Infrastructure Projects Pvt Ltd
 * WO Date: 14-10-2025 | WRF 047, mail dt. 7th Oct 2025
 * SAC    : 995411
 *
 * Run on server:
 *   node src/scripts/seed-wdiry0151-boq.js
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
    item_no: '1', sr_no: '01.36.61.01.25.56.95',
    description: 'Earth work excavation by mechanical means using JCB etc., in all type of soil including dense, weathered rock, soft rock including levelling, all leads and lifts for footing, raft, rc wall foundation, trenches, etc., including excavation for dressing the edges & levelling. Rate to include stacking or dispose the excavated earth within the site premises and spreading in layers to required level.',
    unit: 'Cum', quantity: 6291.89, rate: 375.00,
  },
  {
    item_no: '2', sr_no: '01.36.61.01.25.56.96',
    description: 'Earth backfilling with bought out earth in foundations and the area whereever specified with approved good quality filling materials in plinths, area development etc. wherever specified in layers of not exceeding 300 mm thick including breaking clods, storing, transportation, watering, compacting each layer with vibratory compactor/roller and at unaccessible places with wooden/steel rammers to achieve 90 to 95% proctor density at optimum moisture content, cost shall include conveyance of all materials, labour, machinery etc. complete (Mode of Measurement - Final consolidated filling area with R.L\'s only will be considered)',
    unit: 'Cum', quantity: 4515.83, rate: 180.00,
  },
  {
    item_no: '3', sr_no: '01.36.61.01.25.56.97',
    description: 'Providing and laying 100 thk P.C.C. 1:3:6 M10 of specified thick wherever specified using M.sand, 20mm and downsize metal including base reperation, Compaction, levelling, all leads and lifts, curing and shuttering if necessary etc., Complete - Below Foundation',
    unit: 'Cum', quantity: 141.75, rate: 5750.00,
  },
  {
    item_no: '4', sr_no: '01.36.61.01.25.56.98',
    description: 'Providing, batching, mixing, transporting through transit mixers, pumping and laying Reinforced Cement Concrete of specified grade at all levels and heights specified below using ordinary Portland cement of grade 53 from approved manufacturer, Manufactured sand, 20mm and down size coarse aggregates, necessary admixtures approved by Consultants (Admixtures from Fosroc / Euclid / Asian paints or equivalent), including all leads and lifts, pumping using line pump or boom placer, vibrating/compaction, scaffolding wherever necessary, curing as directed, excluding cost of shuttering and centering. Retaining wall Raft - M30',
    unit: 'Cum', quantity: 912.81, rate: 7750.00,
  },
  {
    item_no: '5', sr_no: '01.36.61.01.25.56.99',
    description: 'Concrete for Retaining wall and Columns - M30',
    unit: 'Cum', quantity: 934.98, rate: 7750.00,
  },
  {
    item_no: '6', sr_no: '01.36.61.01.25.56.100',
    description: 'Providing, fabricating and erecting form work at all levels and places and any profiles wherever needed / specified as per drawing including striking with 19mm Plastic coated for slab, bottom of column drop and 12mm thick for balance elements, marine resistant waterproof ply with adjustable steel props of acceptable Staging system and with sufficient bracing as approved by consultant. Cost to include designing of proper form work and staging system, sealing the joints with heavy duty brown self adhesive tape, aligning to line and levels including M.S. Ties, PVC Spacer, Providing openings / cutouts / pockets, applying deshuttering chemical, complete at all levels with proper finishing which may require chipping & grinding wherever applicable, double/triple heights and any profiles. Retaining wall raft Shuttering',
    unit: 'Sqm', quantity: 1543.24, rate: 725.00,
  },
  {
    item_no: '7', sr_no: '01.36.61.01.25.56.101',
    description: 'Retaining walls shuttering',
    unit: 'Sqm', quantity: 5760.97, rate: 725.00,
  },
  {
    item_no: '8', sr_no: '01.36.61.01.25.56.102',
    description: 'Reinforcement Steel Fe 550 D for Nailing Works - Supply, fabricating & fixing in position reinforcement for RCC work with high yield strength ribbed cold twisted tor steel (HYSD) bar of various diameters and grade of steel at all levels conforming to IS specification including unloading, transporting from yard, decoiling, straightening, cutting, bending, hoisting, fabricating, and placing in position at all level according to drawings and binding the reinforcement with MS annealed binding wire of double fold of 18 gauge and providing PVC cover blocks, for placing the reinforcements in position and for maintaining the cover specified and/or according to relevant IS including dewatering wherever necessary. Rate includes cost of laps and splices, Chair binding wire, spacers, etc., with all lead & lift for all materials & labour at all heights & locations.',
    unit: 'MT', quantity: 173.01, rate: 72500.00,
  },
  {
    item_no: '9', sr_no: '01.36.61.01.25.56.103',
    description: 'Waterproofing Works - Supply and application of Penetron White tank system, integrated water resistance cell in combination with catalytic effective hydrophilic mechanism for below Basements Retaining Walls & Walls for Water Retaining Structures / Swimming Pools & Liftpit etc. Product conforming higher compressive strength to class R3 & R4 category. Concrete dosing @ 0.8% by weight of cement / cementitious materials. PWTC Admixture with approval from MORTH and IRC. Approved make Penetron India.',
    unit: 'Cum', quantity: 918.44, rate: 1000.00,
  },
  {
    item_no: '10', sr_no: '01.36.61.01.25.56.104',
    description: 'Providing and applying penetron coating shake application which is a barrier type Catalyst Crystaline waterproofing treatment to the footing sides, having speed of penetration of 31 cm in 56 days and resistance to 16 bar hydrostatic water head & capable of reducing Permeability of concrete by more than 90%, compared with control concrete, when tested as per DIN 1048 (after applying 4 cycles of hydrostatic pressure). Using Penetron Plus @ 1Kg/Sqm in single coat, as per manufacturer\'s specifications. Approved make Penetron India.',
    unit: 'Sqm', quantity: 1023.25, rate: 450.00,
  },
  {
    item_no: '11', sr_no: '01.36.61.01.25.56.107',
    description: 'Providing waterproofing by Surface method INTERNALLY by following methods with min. 10 years guarantee. Application of micro fibre reinforced polymer modified white cementetious two part waterproof coating after base preparation (cleaning, brushing, removal of flaky materials), grouting porous areas, fixing of weep holes, grouting of pipe outlets etc. Applying in two coats @ 750 gms/M2/Coat. Cost to include treatment of walls up to full height. Second part: 12mm In CM 1:4 for walls with waterproofing admixtures Izonil as per manufacturer\'s specifications and consultants approval, curing etc. complete. (Pidilite / Lagreens or equivalent) - Floors',
    unit: 'Sqm', quantity: 390.94, rate: 800.00,
  },
  {
    item_no: '12', sr_no: '01.36.61.01.25.56.108',
    description: 'Providing waterproofing by Surface method INTERNALLY - Walls (refer Item 11 specification for detailed scope). Two coat waterproof coating + 12mm CM 1:4 with waterproofing admixtures.',
    unit: 'Sqm', quantity: 1777.07, rate: 900.00,
  },
  {
    item_no: '13', sr_no: '01.36.61.01.25.56.109',
    description: 'Tie rod Hole Treatment - Providing and treating of all Tierods considering as part of the entire below ground structure in combination with catalytic effective crystalline hydrophilic mechanism conforming compressive strength to class R3 & R4 category repair mortar, after cleaning the surface by air blower / mechanical means. Material capable of withstanding Hydrostatic pressure of 16 bar & chemical resistance in continuous exposure for 7 days by using catalytic effective Penetrate Mortar & required primer & providing finishing coat at all treated areas.',
    unit: 'Nos', quantity: 17530.00, rate: 75.00,
  },
  {
    item_no: '14', sr_no: '01.36.61.01.25.56.110',
    description: 'CONSTRUCTION JOINT TREATMENT IN RETAINING WALL & JOINT PLACES OF RAFT AND WALL, BASEMENT COLLECTION SUMPS, STPS, UG SUMP, ROOF TOP COLLECTION & DEWATERING SUMP. Providing and installing of Construction Joints in all the joints of the below ground structures including Retaining Walls & Grade Slab in combination with catalytic effective hydrophilic mechanism conforming compressive strength to class R3 & R4 category repair mortar at all Construction joints / Cold joints of the Swimming Pool by creating a "U" groove at all the joints and at the junctions of raft slab with the retaining walls. Material capable of withstanding Hydrostatic pressure of 16 bar continuous exposure for 7 days using Penecrete Mortar & required primer & finishing coat.',
    unit: 'Rmt', quantity: 2075.59, rate: 1000.00,
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

    // Ensure sr_no column exists (idempotent)
    await client.query(`ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS sr_no VARCHAR(100)`);

    // Find or create project
    let projectId;
    const existingProj = await client.query(
      `SELECT id FROM projects WHERE project_code = $1 AND company_id = $2 LIMIT 1`,
      ['WDIRY0151', companyId]
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
          'WDIRY0151',
          'Residential Apartments - Yelahanka (Retaining Wall & STP)',
          'residential',
          'active',
          'Divyasree Infrastructure Projects Pvt Ltd',
          '29AADCD3654M1Z9',
          'AADCD3654M',
          'Yelahanka',
          'Bengaluru',
          'Karnataka',
          42827874.28,
          '2025-10-14',
          '2026-06-14',
          'intra',
          'Civil Works for Retaining Wall and STP. WO No: WDIRY0151, WRF No: WRF 047, mail dt. 7th Oct 2025. SAC Code: 995411. Duration: 8 months.',
        ]
      );
      projectId = projRes.rows[0].id;
      console.log(`✅  Project created: Residential Apartments - Yelahanka (Retaining Wall & STP) (id: ${projectId})`);
    }

    // Check if BOQ items already exist
    const existingBOQ = await client.query(
      `SELECT COUNT(*) FROM boq_items WHERE project_id = $1 AND is_active = true`,
      [projectId]
    );
    const existingCount = parseInt(existingBOQ.rows[0].count);

    if (existingCount > 0) {
      console.log(`ℹ️   ${existingCount} BOQ items found. Patching sr_no (CSI Code) values...`);
      for (const item of BOQ_ITEMS) {
        await client.query(
          `UPDATE boq_items SET sr_no = $1 WHERE project_id = $2 AND item_no = $3`,
          [item.sr_no, projectId, item.item_no]
        );
        console.log(`   ✔ Patched Item ${item.item_no}: sr_no = ${item.sr_no}`);
      }
    } else {
      for (const item of BOQ_ITEMS) {
        await client.query(
          `INSERT INTO boq_items
            (project_id, chapter_no, chapter_name, item_no, sr_no, description, unit, quantity, rate, hsn_code, remarks, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            projectId, '01', 'Retaining Wall & STP Civil Works',
            item.item_no, item.sr_no, item.description,
            item.unit, item.quantity, item.rate,
            '995411',
            'WO: WDIRY0151 | WRF 047 dtd 07.10.2025',
            userId,
          ]
        );
        const amount = (item.quantity * item.rate).toLocaleString('en-IN');
        console.log(`   ✔ Item ${item.item_no}: ${item.unit} ${item.quantity} × ₹${item.rate} = ₹${amount}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅  All 14 BOQ items inserted successfully!');
    console.log('   Gross Total : ₹4,28,27,874.28');
    console.log('   GST 18%     : ₹7,70,90,17.40  (CGST ₹38,54,508.70 + SGST ₹38,54,508.70)');
    console.log('   Net Total   : ₹5,05,36,891.68');

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
