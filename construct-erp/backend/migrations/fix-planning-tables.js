// Planning & Execution Module — Database Migration
// Creates all tables needed for the Planning module
// Run: node fix-planning-tables.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'construct_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. project_activities ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_activities (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

        activity_code    VARCHAR(50)  NOT NULL,
        activity_name    VARCHAR(200) NOT NULL,
        description      TEXT,
        location         VARCHAR(200),
        activity_type    VARCHAR(30)  CHECK (activity_type IN (
                           'structural','finishing','civil','mechanical',
                           'electrical','landscaping','testing','commissioning','other'
                         )),

        -- Baseline (original planned schedule)
        baseline_start_date  DATE NOT NULL,
        baseline_end_date    DATE NOT NULL,
        baseline_duration    INT  NOT NULL,   -- days

        -- Actuals
        actual_start_date    DATE,
        actual_end_date      DATE,

        -- Progress
        progress_pct         NUMERIC(5,2) DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
        status               VARCHAR(20)  DEFAULT 'planned' CHECK (status IN (
                               'planned','in_progress','delayed','completed','cancelled'
                             )),

        -- Critical path
        is_critical_path     BOOLEAN  DEFAULT false,
        slack_days           INT      DEFAULT 0,

        -- BOQ linkage (optional)
        boq_item_id          UUID REFERENCES boq_items(id) ON DELETE SET NULL,
        planned_quantity     NUMERIC(12,3),
        actual_quantity      NUMERIC(12,3),
        measurement_unit     VARCHAR(20),

        -- Assignment
        assigned_to          UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at           TIMESTAMPTZ DEFAULT NOW(),
        updated_at           TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ project_activities');

    // ── 2. project_milestones ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_milestones (
        id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

        milestone_code          VARCHAR(50)  NOT NULL,
        milestone_name          VARCHAR(200) NOT NULL,
        description             TEXT,
        milestone_type          VARCHAR(30)  CHECK (milestone_type IN (
                                  'foundation','structural','finishing','inspection',
                                  'certification','handover','payment','testing','other'
                                )),

        target_date             DATE NOT NULL,
        actual_date             DATE,
        is_achieved             BOOLEAN DEFAULT false,
        deviation_days          INT,           -- positive = late, negative = early

        affects_payment_release BOOLEAN DEFAULT false,
        related_activity_id     UUID REFERENCES project_activities(id) ON DELETE SET NULL,

        remarks                 TEXT,
        verified_by             UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        updated_at              TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ project_milestones');

    // ── 3. look_ahead_plans ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS look_ahead_plans (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

        plan_week_start       DATE NOT NULL,
        plan_week_end         DATE NOT NULL,   -- typically start + 13 days (2 weeks)

        planned_activities    JSONB DEFAULT '[]',
        planned_manpower      INT,
        planned_materials     JSONB DEFAULT '[]',
        planned_equipment     JSONB DEFAULT '[]',

        potential_risks       TEXT,
        mitigation_measures   TEXT,
        dependencies          TEXT,

        status                VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
                                'draft','approved','in_execution','completed'
                              )),

        planned_by            UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_by           UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at           TIMESTAMPTZ,

        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE (project_id, plan_week_start)
      )
    `);
    console.log('  ✓ look_ahead_plans');

    // ── 4. progress_tracking ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress_tracking (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        activity_id           UUID REFERENCES project_activities(id) ON DELETE CASCADE,

        tracking_date         DATE NOT NULL,

        planned_progress_pct  NUMERIC(5,2),
        actual_progress_pct   NUMERIC(5,2),

        planned_qty           NUMERIC(12,3),
        actual_qty            NUMERIC(12,3),

        planned_manpower      INT,
        actual_manpower       INT,

        remarks               TEXT,
        tracked_by            UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ progress_tracking');

    // ── 5. scurve_data ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS scurve_data (
        id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id                UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

        reporting_date            DATE NOT NULL,

        baseline_progress_pct     NUMERIC(5,2),
        actual_progress_pct       NUMERIC(5,2),
        forecast_progress_pct     NUMERIC(5,2),
        forecast_completion_date  DATE,

        schedule_variance_days    INT,   -- positive = behind, negative = ahead

        created_at                TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE (project_id, reporting_date)
      )
    `);
    console.log('  ✓ scurve_data');

    // ── 6. delay_analysis ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS delay_analysis (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        activity_id         UUID REFERENCES project_activities(id) ON DELETE SET NULL,

        analysis_date       DATE NOT NULL DEFAULT CURRENT_DATE,
        delay_days          INT  NOT NULL,

        delay_category      VARCHAR(50) CHECK (delay_category IN (
                              'material_supply','manpower_shortage','equipment_breakdown',
                              'weather','design_change','client_approval',
                              'inspection_failure','safety_incident','regulatory',
                              'subcontractor','other'
                            )),

        root_cause          TEXT,
        impact_on_project   VARCHAR(20) DEFAULT 'minor' CHECK (impact_on_project IN (
                              'no_impact','minor','major','critical'
                            )),

        mitigation_plan     TEXT,
        responsible_party   VARCHAR(100),
        is_resolved         BOOLEAN DEFAULT false,

        analyzed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ delay_analysis');

    // ── Indexes ───────────────────────────────────────────────────────────────
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_activities_project    ON project_activities(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activities_status     ON project_activities(status)`,
      `CREATE INDEX IF NOT EXISTS idx_activities_dates      ON project_activities(baseline_start_date, baseline_end_date)`,
      `CREATE INDEX IF NOT EXISTS idx_milestones_project    ON project_milestones(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_milestones_date       ON project_milestones(target_date)`,
      `CREATE INDEX IF NOT EXISTS idx_lookahead_project     ON look_ahead_plans(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lookahead_week        ON look_ahead_plans(plan_week_start)`,
      `CREATE INDEX IF NOT EXISTS idx_progress_activity     ON progress_tracking(activity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_progress_date         ON progress_tracking(tracking_date)`,
      `CREATE INDEX IF NOT EXISTS idx_scurve_project_date   ON scurve_data(project_id, reporting_date)`,
      `CREATE INDEX IF NOT EXISTS idx_delay_project         ON delay_analysis(project_id)`,
    ];

    for (const sql of indexes) {
      await client.query(sql);
    }
    console.log('  ✓ All indexes created');

    await client.query('COMMIT');
    console.log('\n✅ Planning & Execution tables created successfully.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
