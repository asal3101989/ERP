# ============================================================
# DWG QUANTITY TAKEOFF — Setup Guide
# TQS ERP | BCIM Engineering Pvt Ltd
# ============================================================
# TWO METHODS:
#   A) AutoCAD LISP Script (free, runs inside AutoCAD — use today)
#   B) Autodesk APS Cloud API (browser upload, fully automatic)
# ============================================================


## ═══════════════════════════════════════════
## METHOD A — AutoCAD LISP Script (FREE, Instant)
## ═══════════════════════════════════════════

### How to use TQS-QUANTITIES.LSP

1. Open your DWG in AutoCAD (2016 or later)

2. Load the script:
   Command line → type: APPLOAD
   Browse to: TQS-QUANTITIES.LSP → click Load → Close

3. Run it:
   Command line → type: TQSQTY → press Enter

4. Enter slab thickness when prompted (e.g. 150 for 150mm)

5. AutoCAD scans ALL entities across ALL layers:
   - Lines, Polylines → lengths
   - Closed polylines, Hatches → areas
   - Circles → column/pile areas
   - Blocks (INSERT) → counts

6. CSV file is saved to same folder as your DWG:
   e.g. BLOCK-A-STRUCTURAL_TQS_Quantities.csv

7. In TQS ERP → DWG Quantities → Import CSV
   → Select your CSV → enter Work Order → Import

### Layer Naming Convention for Best Results

Name your AutoCAD layers like this for auto-classification:

  CONCRETE-COLUMN or COL      → Concrete-Columns
  CONCRETE-SLAB or SLAB       → Concrete-Slabs
  CONCRETE-BEAM or BEAM       → Concrete-Beams
  CONCRETE-FOOTING or FTG     → Concrete-Footings
  REBAR or REINF or STEEL     → Reinforcement
  WALL or WL                  → Masonry-Walls
  PLASTER or PLSTR            → Finishes-Plastering
  TILE or FLOOR or FLR        → Finishes-Flooring
  DOOR or DR                  → Openings-Doors (counted)
  WINDOW or WDW               → Openings-Windows (counted)
  PIPE or PLUMB               → MEP-Plumbing
  ELEC or CABLE               → MEP-Electrical

If your layers don't follow this, open TQS-QUANTITIES.LSP in
Notepad and edit the (layer->category) function — it's clearly
labelled in the file.


## ═══════════════════════════════════════════
## METHOD B — Autodesk APS Cloud API
## ═══════════════════════════════════════════

### Step 1: Create APS Account

1. Go to https://aps.autodesk.com
2. Sign up (free tier: 50 GB storage, generous API calls)
3. Create an App → note Client ID and Client Secret

### Step 2: Add to .env

```
APS_CLIENT_ID=your_aps_client_id
APS_CLIENT_SECRET=your_aps_client_secret
APS_BUCKET_KEY=tqs-erp-drawings
```

### Step 3: Install packages

```bash
npm install axios form-data multer
```

### Step 4: Run DB migration

```bash
sqlite3 tqs.db < dwg_schema.sql
```

### Step 5: Wire into server.js

```js
const dwgRoutes = require('./dwgRoutes');
app.use('/api/dwg', dwgRoutes);
```

### Step 6: Add route to React Router

```jsx
import DWGQuantitiesPage from './pages/DWGQuantitiesPage';
<Route path="/dwg-quantities" element={<DWGQuantitiesPage />} />
```

Add to sidebar:
```jsx
{ label: "DWG Takeoff", icon: "📐", path: "/dwg-quantities" }
```


## ═══════════════════════════════════════════
## WORKFLOW: End to End
## ═══════════════════════════════════════════

OPTION 1 (LISP — recommended to start):
  CAD team opens DWG in AutoCAD
       ↓
  Runs TQSQTY command (30 sec)
       ↓
  CSV saved next to DWG file
       ↓
  QS Engineer imports CSV in TQS ERP
       ↓
  Reviews quantities by category
       ↓
  Selects relevant items → Push to BOQ
       ↓
  BOQ populated with drawing quantities

OPTION 2 (APS — fully automatic):
  QS Engineer opens TQS ERP → DWG Takeoff
       ↓
  Drags and drops DWG file
       ↓
  APS processes in cloud (1-3 min)
       ↓
  Quantities appear automatically
       ↓
  Review → Push to BOQ


## QUANTITIES EXTRACTED

| Category          | Measure  | Unit | From Entity       |
|-------------------|----------|------|-------------------|
| Concrete-Slabs    | Area     | m2   | Closed polylines  |
| Concrete-Slabs    | Volume   | m3   | Area × thickness  |
| Concrete-Columns  | Area     | m2   | Circles           |
| Concrete-Beams    | Length   | m    | Lines/Polylines   |
| Reinforcement     | Length   | m    | Lines             |
| Masonry-Walls     | Length   | m    | Lines/Polylines   |
| Masonry-Walls     | Area     | m2   | Closed polylines  |
| Finishes-Plastering| Area    | m2   | Hatches           |
| Finishes-Flooring | Area     | m2   | Closed polylines  |
| Openings-Doors    | Count    | No.  | Block inserts     |
| Openings-Windows  | Count    | No.  | Block inserts     |
| MEP-Plumbing      | Length   | m    | Lines/Polylines   |
| MEP-Electrical    | Length   | m    | Lines             |


## IMPORTANT NOTES

1. ACCURACY depends on layer discipline. A well-layered drawing
   gives 90%+ accurate quantities. Poorly layered drawings need
   manual review.

2. CONCRETE VOLUMES are estimated as Area × slab thickness.
   For columns, you'll need to manually add height.

3. REINFORCEMENT: The script measures bar run lengths from lines.
   For actual steel weight, multiply by the bar unit weight
   (e.g. 16mm bar = 1.578 kg/m).

4. Always review extracted quantities against your Measurement
   Sheets before pushing to BOQ.
