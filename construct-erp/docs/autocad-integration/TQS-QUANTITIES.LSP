;;; ============================================================
;;; TQS-QUANTITIES.LSP
;;; AutoCAD Quantity Extraction Script
;;; TQS ERP | BCIM Engineering Pvt Ltd
;;; ============================================================
;;; HOW TO USE:
;;;   1. Open your DWG in AutoCAD
;;;   2. Type: APPLOAD → browse to this file → Load
;;;   3. Type: TQSQTY at the command prompt
;;;   4. A CSV is saved to same folder as your DWG
;;;   5. Import the CSV into TQS ERP → BOQ module
;;; ============================================================

;;; ── Utility: get layer of entity ────────────────────────────
(defun get-layer (ent)
  (cdr (assoc 8 (entget ent)))
)

;;; ── Utility: get entity type ────────────────────────────────
(defun get-type (ent)
  (cdr (assoc 0 (entget ent)))
)

;;; ── Calculate polyline length ────────────────────────────────
(defun polyline-length (ent / obj)
  (setq obj (vlax-ename->vla-object ent))
  (vlax-get obj 'Length)
)

;;; ── Calculate polyline area ──────────────────────────────────
(defun polyline-area (ent / obj)
  (setq obj (vlax-ename->vla-object ent))
  (vlax-get obj 'Area)
)

;;; ── Calculate line length ────────────────────────────────────
(defun line-length (ent / data p1 p2)
  (setq data (entget ent))
  (setq p1 (cdr (assoc 10 data)))
  (setq p2 (cdr (assoc 11 data)))
  (distance p1 p2)
)

;;; ── Calculate circle area ────────────────────────────────────
(defun circle-area (ent / data r)
  (setq data (entget ent))
  (setq r (cdr (assoc 40 data)))
  (* pi r r)
)

;;; ── Format number to 3 decimal places ───────────────────────
(defun fmt3 (num)
  (rtos num 2 3)
)

;;; ── Layer name → QS Category mapping ────────────────────────
;;; Edit these to match YOUR drawing layer naming convention
(defun layer->category (layer-name / ln)
  (setq ln (strcase layer-name)) ; uppercase for matching
  (cond
    ;; CONCRETE
    ((or (wcmatch ln "*COLUMN*") (wcmatch ln "*COL*"))   "Concrete-Columns")
    ((or (wcmatch ln "*SLAB*")   (wcmatch ln "*SLB*"))   "Concrete-Slabs")
    ((or (wcmatch ln "*BEAM*")   (wcmatch ln "*BM*"))    "Concrete-Beams")
    ((or (wcmatch ln "*FOOTING*")(wcmatch ln "*FTG*"))   "Concrete-Footings")
    ((or (wcmatch ln "*STAIR*")  (wcmatch ln "*STAIR*")) "Concrete-Stairs")
    ((wcmatch ln "*RETWALL*")                            "Concrete-RetainingWall")
    ;; REINFORCEMENT
    ((or (wcmatch ln "*REBAR*")  (wcmatch ln "*REINF*")
         (wcmatch ln "*BAR*")    (wcmatch ln "*STEEL*")) "Reinforcement")
    ((wcmatch ln "*STIRRUP*")                            "Reinforcement-Stirrups")
    ;; MASONRY
    ((or (wcmatch ln "*WALL*")   (wcmatch ln "*WL*"))    "Masonry-Walls")
    ((wcmatch ln "*BRICK*")                              "Masonry-Brickwork")
    ((wcmatch ln "*BLOCK*")                              "Masonry-Blockwork")
    ;; FINISHES
    ((or (wcmatch ln "*PLASTER*")(wcmatch ln "*PLSTR*")) "Finishes-Plastering")
    ((or (wcmatch ln "*TILE*")   (wcmatch ln "*FLR*")
         (wcmatch ln "*FLOOR*"))                         "Finishes-Flooring")
    ((or (wcmatch ln "*PAINT*")  (wcmatch ln "*PTNG*"))  "Finishes-Painting")
    ((wcmatch ln "*CEILING*")                            "Finishes-Ceiling")
    ;; OPENINGS
    ((or (wcmatch ln "*DOOR*")   (wcmatch ln "*DR*"))    "Openings-Doors")
    ((or (wcmatch ln "*WINDOW*") (wcmatch ln "*WDW*"))   "Openings-Windows")
    ;; MEP
    ((or (wcmatch ln "*PIPE*")   (wcmatch ln "*PLUMB*")) "MEP-Plumbing")
    ((or (wcmatch ln "*ELEC*")   (wcmatch ln "*CABLE*")
         (wcmatch ln "*CONDUIT*"))                       "MEP-Electrical")
    ((or (wcmatch ln "*HVAC*")   (wcmatch ln "*DUCT*"))  "MEP-HVAC")
    ;; SITE
    ((or (wcmatch ln "*ROAD*")   (wcmatch ln "*PAVE*"))  "Site-Paving")
    ((wcmatch ln "*DRAIN*")                              "Site-Drainage")
    ((wcmatch ln "*FENCE*")                              "Site-Fencing")
    ;; FALLBACK
    (T (strcat "Other-" layer-name))
  )
)

;;; ── Unit for category ────────────────────────────────────────
(defun category->unit (cat)
  (cond
    ((wcmatch cat "Concrete-*")     "m3")  ; volume — needs thickness input
    ((wcmatch cat "Reinforcement*") "m")   ; bar length
    ((wcmatch cat "Masonry-*")      "m2")  ; area
    ((wcmatch cat "Finishes-*")     "m2")
    ((wcmatch cat "Openings-*")     "No.") ; count
    ((wcmatch cat "MEP-*")          "m")   ; run length
    ((wcmatch cat "Site-*")         "m2")
    (T                              "m")
  )
)

;;; ── Main extraction function ─────────────────────────────────
(defun C:TQSQTY ( / ss i ent etype layer cat
                    results entry found
                    dwg-path csv-path f
                    total-lines total-poly total-circles
                    slab-thickness col-size)

  (princ "\n\n=== TQS ERP Quantity Extractor ===\n")
  (princ "BCIM Engineering Pvt Ltd\n")
  (princ "================================\n")

  ;; Ask for slab thickness (for volume calc)
  (setq slab-thickness
    (getreal "\nEnter typical slab thickness in mm (e.g. 150): "))
  (if (null slab-thickness) (setq slab-thickness 150))
  (setq slab-thickness (/ slab-thickness 1000.0)) ; convert to metres

  (princ (strcat "\nUsing slab thickness: "
    (fmt3 (* slab-thickness 1000)) " mm\n"))

  ;; Select all entities
  (setq ss (ssget "X"))
  (if (null ss)
    (progn (princ "\nNo entities found in drawing.") (exit))
  )

  (setq results '())
  (setq i 0)

  (princ "\nProcessing entities...\n")

  (repeat (sslength ss)
    (setq ent   (ssname ss i))
    (setq etype (get-type ent))
    (setq layer (get-layer ent))
    (setq cat   (layer->category layer))

    (cond
      ;; Lines → length
      ((= etype "LINE")
        (setq qty (/ (line-length ent) 1000.0)) ; mm → m
        (setq results (add-to-results results cat layer "Length(m)" qty))
      )

      ;; Polylines → length + area
      ((or (= etype "LWPOLYLINE") (= etype "POLYLINE"))
        (setq len  (/ (polyline-length ent) 1000.0))
        (setq area (/ (polyline-area  ent) 1000000.0)) ; mm² → m²
        (setq results (add-to-results results cat layer "Length(m)" len))
        ;; If closed polyline → also record area
        (if (> area 0.01)
          (progn
            (setq results (add-to-results results cat layer "Area(m2)" area))
            ;; Volume for concrete layers
            (if (wcmatch cat "Concrete-*")
              (setq results (add-to-results results cat layer "Volume(m3)"
                (* area slab-thickness)))
            )
          )
        )
      )

      ;; Circles → area (columns, piles)
      ((= etype "CIRCLE")
        (setq area (/ (circle-area ent) 1000000.0))
        (setq results (add-to-results results cat layer "Area(m2)" area))
        (if (wcmatch cat "Concrete-*")
          (setq results (add-to-results results cat layer "Volume(m3)"
            (* area slab-thickness)))
        )
      )

      ;; Hatches → area
      ((= etype "HATCH")
        (setq obj  (vlax-ename->vla-object ent))
        (setq area (/ (vlax-get obj 'Area) 1000000.0))
        (if (> area 0.01)
          (progn
            (setq results (add-to-results results cat layer "Area(m2)" area))
            (if (wcmatch cat "Concrete-*")
              (setq results (add-to-results results cat layer "Volume(m3)"
                (* area slab-thickness)))
            )
          )
        )
      )

      ;; Blocks (INSERT) → count
      ((= etype "INSERT")
        (setq results (add-to-results results cat layer "Count(No.)" 1.0))
      )
    )

    (setq i (1+ i))
  )

  ;; ── Write CSV ─────────────────────────────────────────────
  (setq dwg-path (getvar "DWGPREFIX"))
  (setq dwg-name (vl-filename-base (getvar "DWGNAME")))
  (setq csv-path (strcat dwg-path dwg-name "_TQS_Quantities.csv"))

  (setq f (open csv-path "w"))

  ;; Header
  (write-line "Drawing,Category,Layer,MeasureType,Quantity,Unit,Notes" f)
  (write-line (strcat
    "Drawing: " dwg-name
    ",Extracted by TQS ERP Script"
    ",Date: " (menucmd "m=$(edtime,$(getvar,DATE),DD-MON-YYYY)")
    ",,,,"
  ) f)
  (write-line ",,,,,,," f)

  ;; Data rows
  (foreach row results
    (write-line
      (strcat
        dwg-name ","
        (nth 0 row) ","   ; category
        (nth 1 row) ","   ; layer
        (nth 2 row) ","   ; measure type
        (fmt3 (nth 3 row)) ","  ; quantity
        (category->unit (nth 0 row)) ","  ; unit
        (if (wcmatch (nth 2 row) "Concrete-*")
          (strcat "Slab t=" (fmt3 (* slab-thickness 1000)) "mm assumed")
          ""
        )
      )
      f
    )
  )

  (close f)

  (princ (strcat "\n\n✅ DONE! CSV saved to:\n" csv-path))
  (princ "\n\nImport this file in TQS ERP → BOQ → Import from AutoCAD\n")
  (princ "================================\n")
  *
)

;;; ── Helper: add/accumulate quantity in results list ─────────
(defun add-to-results (results cat layer mtype qty / found new-results row)
  (setq found nil)
  (setq new-results
    (mapcar
      (function (lambda (row)
        (if (and (= (nth 0 row) cat)
                 (= (nth 1 row) layer)
                 (= (nth 2 row) mtype))
          (progn
            (setq found T)
            (list cat layer mtype (+ (nth 3 row) qty))
          )
          row
        )
      ))
      results
    )
  )
  (if (not found)
    (append new-results (list (list cat layer mtype qty)))
    new-results
  )
)

(princ "\n✅ TQS Quantity Extractor loaded. Type TQSQTY to run.\n")
(princ)
