// ============================================================
// DWGQuantitiesPage.jsx  –  AutoCAD DWG Quantity Takeoff Module
// TQS ERP | BCIM Engineering Pvt Ltd
// Route: <Route path="/dwg-quantities" element={<DWGQuantitiesPage />} />
// ============================================================

import { useState, useEffect, useRef } from "react";

const API = "/api/dwg";

const CATEGORY_COLORS = {
  "Concrete-Columns":    "#1e40af",
  "Concrete-Slabs":      "#1d4ed8",
  "Concrete-Beams":      "#2563eb",
  "Concrete-Footings":   "#3b82f6",
  "Concrete-Stairs":     "#60a5fa",
  "Reinforcement":       "#dc2626",
  "Reinforcement-Stirrups": "#ef4444",
  "Masonry-Walls":       "#d97706",
  "Masonry-Brickwork":   "#f59e0b",
  "Finishes-Plastering": "#16a34a",
  "Finishes-Flooring":   "#22c55e",
  "Finishes-Painting":   "#4ade80",
  "Openings-Doors":      "#9333ea",
  "Openings-Windows":    "#a855f7",
  "MEP-Plumbing":        "#0891b2",
  "MEP-Electrical":      "#06b6d4",
  "Site-Paving":         "#78716c",
  "Site-Drainage":       "#57534e",
};

const getCatColor = (cat) => CATEGORY_COLORS[cat] || "#6b7280";
const getCatGroup = (cat) => cat?.split('-')[0] || 'Other';

const GROUP_ICONS = {
  Concrete: "🏗️", Reinforcement: "🔩", Masonry: "🧱",
  Finishes: "🎨", Openings: "🚪", MEP: "⚙️", Site: "🌍", Other: "📦"
};

export default function DWGQuantitiesPage() {
  const [tab, setTab]             = useState("upload"); // upload | results | history
  const [uploads, setUploads]     = useState([]);
  const [quantities, setQuantities] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // null | processing | done | failed
  const [uploadId, setUploadId]   = useState(null);
  const [dragging, setDragging]   = useState(false);
  const [file, setFile]           = useState(null);
  const [projectRef, setProjectRef] = useState("");
  const [workOrder, setWorkOrder] = useState("WDIRY0151");
  const [slabThick, setSlabThick] = useState("150");
  const [filterCat, setFilterCat] = useState("");
  const [selected, setSelected]   = useState(new Set());
  const [pushing, setPushing]     = useState(false);
  const [pushMsg, setPushMsg]     = useState("");
  const [csvFile, setCsvFile]     = useState(null);
  const pollRef                   = useRef(null);
  const fileInput                 = useRef();
  const csvInput                  = useRef();

  useEffect(() => { loadUploads(); }, []);
  useEffect(() => () => clearInterval(pollRef.current), []);

  async function loadUploads() {
    try {
      const res  = await fetch(`${API}/uploads`);
      setUploads(await res.json());
    } catch {}
  }

  async function loadQuantities(id) {
    try {
      const res  = await fetch(`${API}/quantities/${id}${filterCat ? `?category=${filterCat}` : ''}`);
      setQuantities(await res.json());
    } catch {}
  }

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      const res  = await fetch(`${API}/status/${id}`);
      const data = await res.json();
      setUploadStatus(data.status);
      if (data.status === 'done') {
        clearInterval(pollRef.current);
        setUploadId(id);
        loadQuantities(id);
        setTab("results");
        loadUploads();
      }
      if (data.status === 'failed') {
        clearInterval(pollRef.current);
      }
    }, 4000);
  }

  async function handleUpload() {
    if (!file) return;
    const form = new FormData();
    form.append('drawing', file);
    form.append('project_ref', projectRef);
    form.append('work_order', workOrder);
    form.append('slab_thickness', slabThick);
    setUploadStatus('processing');
    try {
      const res  = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.uploadId) { startPolling(data.uploadId); }
    } catch { setUploadStatus('failed'); }
  }

  async function handleCSVImport() {
    if (!csvFile) return;
    const form = new FormData();
    form.append('csv', csvFile);
    form.append('project_ref', projectRef);
    form.append('work_order', workOrder);
    try {
      const res  = await fetch(`${API}/import-csv`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.uploadId) {
        setUploadId(data.uploadId);
        loadQuantities(data.uploadId);
        setTab("results");
        loadUploads();
      }
    } catch {}
  }

  async function pushToBoq() {
    setPushing(true); setPushMsg("");
    try {
      const res  = await fetch(`${API}/push-to-boq`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id: uploadId, work_order: workOrder,
          selected_ids: selected.size > 0 ? [...selected] : undefined
        })
      });
      const data = await res.json();
      setPushMsg(`✅ ${data.pushed} items pushed to BOQ`);
    } catch { setPushMsg("❌ Failed"); }
    setPushing(false);
    setTimeout(() => setPushMsg(""), 5000);
  }

  // Group quantities by category
  const grouped = quantities.reduce((acc, row) => {
    if (filterCat && row.category !== filterCat) return acc;
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {});

  const categories = [...new Set(quantities.map(q => q.category))];

  const S = {
    page: { minHeight: "100vh", background: "#f1f5f9",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace" },
    header: { background: "#0c1a2e", color: "#e2e8f0", padding: "18px 28px",
      borderBottom: "2px solid #1e40af" },
    headerRow: { display: "flex", alignItems: "center", gap: 14 },
    icon: { width: 44, height: 44, background: "#1e40af", borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 },
    title: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: "#f8fafc" },
    sub: { fontSize: 11, color: "#64748b", marginTop: 3 },
    tabs: { display: "flex", background: "#0c1a2e", padding: "0 28px",
      borderBottom: "1px solid #1e3a5f" },
    tab: (active) => ({
      padding: "12px 20px", cursor: "pointer", fontSize: 12, fontWeight: 600,
      color: active ? "#60a5fa" : "#64748b", letterSpacing: 0.5,
      borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent",
    }),
    body: { maxWidth: 1100, margin: "0 auto", padding: "24px 20px" },
    card: { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
      overflow: "hidden", marginBottom: 20, boxShadow: "0 1px 3px #0001" },
    cardHead: { padding: "14px 20px", borderBottom: "1px solid #f1f5f9",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: "#f8fafc" },
    cardTitle: { fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: 0.3 },
    cardBody: { padding: "20px" },
    dropzone: (dragging) => ({
      border: `2px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`,
      borderRadius: 12, padding: "40px 20px", textAlign: "center",
      background: dragging ? "#eff6ff" : "#f8fafc",
      cursor: "pointer", transition: "all 0.2s", marginBottom: 16,
    }),
    dropIcon: { fontSize: 40, marginBottom: 12 },
    dropText: { fontSize: 14, fontWeight: 600, color: "#334155" },
    dropSub: { fontSize: 12, color: "#94a3b8", marginTop: 6 },
    fileChip: { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
      padding: "8px 14px", fontSize: 12, color: "#1e40af", fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 },
    row2: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" },
    input: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 14px",
      fontSize: 12, outline: "none", flex: 1, minWidth: 160,
      fontFamily: "inherit" },
    btn: (color, disabled) => ({
      background: disabled ? "#e2e8f0" : color, color: disabled ? "#94a3b8" : "#fff",
      border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, letterSpacing: 0.5,
    }),
    processingBox: { background: "#eff6ff", border: "1px solid #bfdbfe",
      borderRadius: 10, padding: 20, textAlign: "center" },
    spinner: { fontSize: 28, animation: "spin 1s linear infinite" },
    statusText: { fontSize: 14, color: "#1e40af", fontWeight: 600, marginTop: 8 },
    filterRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16,
      alignItems: "center" },
    filterChip: (active) => ({
      background: active ? "#1e40af" : "#f1f5f9",
      color: active ? "#fff" : "#475569",
      border: "1px solid " + (active ? "#1e40af" : "#e2e8f0"),
      borderRadius: 20, padding: "4px 12px", fontSize: 11,
      cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
    }),
    groupHead: (color) => ({
      background: color + "12", borderLeft: `3px solid ${color}`,
      padding: "10px 16px", display: "flex", justifyContent: "space-between",
      alignItems: "center", cursor: "pointer",
    }),
    groupTitle: (color) => ({ fontSize: 13, fontWeight: 700, color }),
    table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
    th: { background: "#f8fafc", padding: "8px 12px", textAlign: "left",
      fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0",
      fontSize: 11, letterSpacing: 0.5 },
    td: { padding: "8px 12px", borderBottom: "1px solid #f8fafc", color: "#334155" },
    qtyBadge: (unit) => ({
      background: unit === 'm3' ? "#dbeafe" : unit === 'm2' ? "#dcfce7" : "#fef3c7",
      color: unit === 'm3' ? "#1e40af" : unit === 'm2' ? "#16a34a" : "#92400e",
      borderRadius: 6, padding: "2px 8px", fontWeight: 700, fontSize: 11,
    }),
    pushBar: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
      padding: "12px 0", borderTop: "1px solid #f1f5f9", marginTop: 12 },
    histRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
      borderBottom: "1px solid #f8fafc", cursor: "pointer" },
    statusDot: (s) => ({
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: s === 'done' ? "#22c55e" : s === 'failed' ? "#ef4444" : "#f59e0b",
    }),
  };

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      <div style={S.header}>
        <div style={S.headerRow}>
          <div style={S.icon}>📐</div>
          <div>
            <div style={S.title}>DWG QUANTITY TAKEOFF</div>
            <div style={S.sub}>AutoCAD Integration · APS Cloud + LISP Script · TQS ERP</div>
          </div>
        </div>
      </div>

      <div style={S.tabs}>
        {[["upload","📤 Upload Drawing"],["results","📊 Quantities"],["history","🗂 History"]].map(([v,l]) => (
          <div key={v} style={S.tab(tab === v)} onClick={() => setTab(v)}>{l}</div>
        ))}
      </div>

      <div style={S.body}>

        {/* ── UPLOAD TAB ── */}
        {tab === "upload" && (
          <>
            {/* DWG Upload via APS */}
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>☁️ UPLOAD DWG — Autodesk APS Cloud Processing</div>
              </div>
              <div style={S.cardBody}>
                {uploadStatus === 'processing' ? (
                  <div style={S.processingBox}>
                    <div style={S.spinner}>⚙️</div>
                    <div style={S.statusText}>Processing drawing via Autodesk APS…</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                      Translating model, extracting layers and quantities. This takes 1–3 min.
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={S.dropzone(dragging)}
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); setFile(e.dataTransfer.files[0]); }}
                      onClick={() => fileInput.current.click()}
                    >
                      <input ref={fileInput} type="file" accept=".dwg,.dxf" style={{ display: "none" }}
                        onChange={e => setFile(e.target.files[0])} />
                      <div style={S.dropIcon}>📁</div>
                      <div style={S.dropText}>Drop your DWG/DXF file here or click to browse</div>
                      <div style={S.dropSub}>Max 100MB · .dwg or .dxf · Processed via Autodesk APS</div>
                    </div>

                    {file && (
                      <div style={S.fileChip}>
                        📐 {file.name} ({(file.size/1024/1024).toFixed(1)} MB)
                        <span style={{ cursor: "pointer", color: "#ef4444" }}
                          onClick={() => setFile(null)}>✕</span>
                      </div>
                    )}

                    <div style={S.row2}>
                      <input style={S.input} placeholder="Project Ref (e.g. TechRidge P3)"
                        value={projectRef} onChange={e => setProjectRef(e.target.value)} />
                      <input style={S.input} placeholder="Work Order (e.g. WDIRY0151)"
                        value={workOrder} onChange={e => setWorkOrder(e.target.value)} />
                      <input style={{ ...S.input, maxWidth: 160 }}
                        placeholder="Slab thickness (mm)" type="number"
                        value={slabThick} onChange={e => setSlabThick(e.target.value)} />
                    </div>

                    <button style={S.btn("#1e40af", !file)} onClick={handleUpload} disabled={!file}>
                      ⬆ Process with Autodesk APS
                    </button>

                    {uploadStatus === 'failed' && (
                      <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>
                        ❌ Processing failed. Check APS credentials in .env
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* CSV Import from LISP Script */}
            <div style={S.card}>
              <div style={S.cardHead}>
                <div style={S.cardTitle}>📄 IMPORT CSV — From AutoCAD LISP Script (TQS-QUANTITIES.LSP)</div>
              </div>
              <div style={S.cardBody}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.7 }}>
                  Already ran the <strong>TQS-QUANTITIES.LSP</strong> script inside AutoCAD?
                  Import the exported CSV directly here — no APS account needed.
                </div>
                <div style={S.row2}>
                  <div>
                    <input ref={csvInput} type="file" accept=".csv" style={{ display: "none" }}
                      onChange={e => setCsvFile(e.target.files[0])} />
                    <button style={S.btn("#475569", false)}
                      onClick={() => csvInput.current.click()}>
                      📂 Browse CSV
                    </button>
                    {csvFile && <span style={{ fontSize: 12, color: "#475569", marginLeft: 10 }}>
                      {csvFile.name}
                    </span>}
                  </div>
                </div>
                <div style={S.row2}>
                  <input style={S.input} placeholder="Project Ref"
                    value={projectRef} onChange={e => setProjectRef(e.target.value)} />
                  <input style={S.input} placeholder="Work Order"
                    value={workOrder} onChange={e => setWorkOrder(e.target.value)} />
                </div>
                <button style={S.btn("#16a34a", !csvFile)} onClick={handleCSVImport} disabled={!csvFile}>
                  ⬆ Import CSV Quantities
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── RESULTS TAB ── */}
        {tab === "results" && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <div style={S.cardTitle}>
                📊 EXTRACTED QUANTITIES
                {quantities.length > 0 && ` — ${quantities.length} rows`}
              </div>
            </div>
            <div style={S.cardBody}>

              {quantities.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                  <div style={{ fontSize: 40 }}>📐</div>
                  <div style={{ marginTop: 12 }}>No quantities yet. Upload a drawing first.</div>
                </div>
              ) : (
                <>
                  {/* Category filters */}
                  <div style={S.filterRow}>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>FILTER:</span>
                    <div style={S.filterChip(!filterCat)} onClick={() => setFilterCat("")}>All</div>
                    {categories.map(cat => (
                      <div key={cat} style={S.filterChip(filterCat === cat)}
                        onClick={() => setFilterCat(filterCat === cat ? "" : cat)}>
                        {GROUP_ICONS[getCatGroup(cat)] || "📦"} {cat}
                      </div>
                    ))}
                  </div>

                  {/* Grouped tables */}
                  {Object.entries(grouped).map(([cat, rows]) => {
                    const color = getCatColor(cat);
                    const group = getCatGroup(cat);
                    return (
                      <div key={cat} style={{ marginBottom: 12, borderRadius: 8,
                        overflow: "hidden", border: "1px solid #e2e8f0" }}>
                        <div style={S.groupHead(color)}>
                          <span style={S.groupTitle(color)}>
                            {GROUP_ICONS[group] || "📦"} {cat}
                          </span>
                          <span style={{ fontSize: 11, color }}>
                            {rows.length} items
                          </span>
                        </div>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              <th style={S.th}>
                                <input type="checkbox"
                                  onChange={e => {
                                    const ids = rows.map(r => r.id);
                                    setSelected(prev => {
                                      const next = new Set(prev);
                                      ids.forEach(id => e.target.checked ? next.add(id) : next.delete(id));
                                      return next;
                                    });
                                  }} />
                              </th>
                              <th style={S.th}>LAYER</th>
                              <th style={S.th}>ELEMENT</th>
                              <th style={S.th}>MEASURE</th>
                              <th style={{ ...S.th, textAlign: "right" }}>QUANTITY</th>
                              <th style={S.th}>UNIT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(row => (
                              <tr key={row.id}>
                                <td style={S.td}>
                                  <input type="checkbox" checked={selected.has(row.id)}
                                    onChange={e => setSelected(prev => {
                                      const next = new Set(prev);
                                      e.target.checked ? next.add(row.id) : next.delete(row.id);
                                      return next;
                                    })} />
                                </td>
                                <td style={S.td}>{row.layer}</td>
                                <td style={{ ...S.td, color: "#94a3b8" }}>{row.element || "—"}</td>
                                <td style={S.td}>{row.measure}</td>
                                <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>
                                  {row.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                </td>
                                <td style={S.td}>
                                  <span style={S.qtyBadge(row.unit)}>{row.unit}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}

                  {/* Push to BOQ */}
                  <div style={S.pushBar}>
                    <button style={S.btn("#1e40af", pushing || quantities.length === 0)}
                      onClick={pushToBoq} disabled={pushing}>
                      {pushing ? "Pushing…" : `📋 Push ${selected.size > 0 ? selected.size + " selected" : "All"} to BOQ`}
                    </button>
                    {pushMsg && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>{pushMsg}</span>}
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
                      {selected.size > 0 ? `${selected.size} rows selected` : "All rows will be pushed"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <div style={S.cardTitle}>🗂 UPLOAD HISTORY</div>
            </div>
            <div style={S.cardBody}>
              {uploads.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                  No uploads yet.
                </div>
              ) : uploads.map(u => (
                <div key={u.id} style={S.histRow}
                  onClick={() => { setUploadId(u.id); loadQuantities(u.id); setTab("results"); }}>
                  <div style={S.statusDot(u.status)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{u.original_name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {u.work_order} · {u.uploaded_at?.slice(0, 16)}
                    </div>
                  </div>
                  {u.qty_count > 0 && (
                    <span style={{ background: "#eff6ff", color: "#1e40af",
                      borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                      {u.qty_count} qty rows
                    </span>
                  )}
                  <span style={{ fontSize: 11, color:
                    u.status === 'done' ? "#16a34a" : u.status === 'failed' ? "#ef4444" : "#f59e0b",
                    fontWeight: 600 }}>
                    {u.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
