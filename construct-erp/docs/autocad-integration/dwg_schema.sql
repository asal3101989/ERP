-- ============================================================
-- dwg_schema.sql  –  DWG Quantities Tables for TQS ERP
-- sqlite3 tqs.db < dwg_schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS dwg_uploads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  project_ref   TEXT,
  work_order    TEXT,
  status        TEXT DEFAULT 'processing', -- processing | done | failed
  qty_count     INTEGER DEFAULT 0,
  error         TEXT,
  uploaded_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dwg_quantities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id     INTEGER REFERENCES dwg_uploads(id),
  drawing_name  TEXT,
  category      TEXT NOT NULL,   -- Concrete-Slabs, Masonry-Walls etc.
  layer         TEXT,
  element       TEXT,            -- entity type
  measure       TEXT NOT NULL,   -- Length | Area | Volume | Count
  quantity      REAL NOT NULL,
  unit          TEXT NOT NULL,   -- m | m2 | m3 | No.
  project_ref   TEXT,
  pushed_to_boq INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dwg_qty_upload   ON dwg_quantities(upload_id);
CREATE INDEX IF NOT EXISTS idx_dwg_qty_category ON dwg_quantities(category);
CREATE INDEX IF NOT EXISTS idx_dwg_qty_project  ON dwg_quantities(project_ref);
