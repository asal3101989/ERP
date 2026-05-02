// ============================================================
// apsService.js  –  Autodesk Platform Services (APS) Integration
// DWG Upload → Model Derivative → Quantity Extraction
// TQS ERP | BCIM Engineering Pvt Ltd
// ============================================================
// npm install axios form-data
// ============================================================

require('dotenv').config();
const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');
const path     = require('path');

const APS_BASE      = 'https://developer.api.autodesk.com';
const CLIENT_ID     = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const BUCKET_KEY    = process.env.APS_BUCKET_KEY || 'tqs-erp-drawings';

// ─── Step 1: Get 2-legged OAuth token ────────────────────────
async function getToken() {
  const res = await axios.post(
    `${APS_BASE}/authentication/v2/token`,
    new URLSearchParams({
      grant_type:    'client_credentials',
      scope:         'data:read data:write data:create bucket:create bucket:read',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

// ─── Step 2: Ensure bucket exists ────────────────────────────
async function ensureBucket(token) {
  try {
    await axios.get(`${APS_BASE}/oss/v2/buckets/${BUCKET_KEY}/details`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (e) {
    if (e.response?.status === 404) {
      await axios.post(`${APS_BASE}/oss/v2/buckets`, {
        bucketKey: BUCKET_KEY, policyKey: 'persistent'
      }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    }
  }
}

// ─── Step 3: Upload DWG file ──────────────────────────────────
async function uploadDWG(token, filePath, objectKey) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize   = fs.statSync(filePath).size;

  const res = await axios.put(
    `${APS_BASE}/oss/v2/buckets/${BUCKET_KEY}/objects/${objectKey}`,
    fileBuffer,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileSize,
      },
      maxBodyLength: Infinity,
    }
  );
  return res.data.objectId; // urn
}

// ─── Step 4: Trigger Model Derivative translation ─────────────
async function translateModel(token, urn) {
  const encodedUrn = Buffer.from(urn).toString('base64').replace(/=/g, '');

  const res = await axios.post(
    `${APS_BASE}/modelderivative/v2/designdata/job`,
    {
      input:  { urn: encodedUrn },
      output: {
        formats: [
          { type: 'svf2', views: ['2d', '3d'] },
          { type: 'obj' }
        ]
      }
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return encodedUrn;
}

// ─── Step 5: Poll translation status ─────────────────────────
async function pollTranslation(token, encodedUrn, maxWaitMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await axios.get(
      `${APS_BASE}/modelderivative/v2/designdata/${encodedUrn}/manifest`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const status = res.data.status;
    const progress = res.data.progress || '';
    console.log(`[APS] Translation: ${status} ${progress}`);

    if (status === 'success') return res.data;
    if (status === 'failed')  throw new Error('APS translation failed');

    await new Promise(r => setTimeout(r, 5000)); // wait 5s
  }
  throw new Error('APS translation timed out');
}

// ─── Step 6: Extract metadata (layers, properties) ───────────
async function extractMetadata(token, encodedUrn) {
  // Get model GUID
  const guidRes = await axios.get(
    `${APS_BASE}/modelderivative/v2/designdata/${encodedUrn}/metadata`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const guid = guidRes.data.data?.metadata?.[0]?.guid;
  if (!guid) throw new Error('No model GUID found');

  // Get all object properties
  const propsRes = await axios.get(
    `${APS_BASE}/modelderivative/v2/designdata/${encodedUrn}/metadata/${guid}/properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return propsRes.data.data?.collection || [];
}

// ─── Step 7: Parse properties → QS quantities ─────────────────
function parseQuantities(collection, drawingName) {
  const quantities = [];

  for (const obj of collection) {
    const props    = obj.properties || {};
    const name     = obj.name || '';
    const objType  = (props['Entity Type'] || props['Object type'] || name).toString();

    // Extract geometry properties
    const layer  = props['Layer']  || props['layer']  || 'Unknown';
    const length = parseFloat(props['Length'] || props['length'] || 0);
    const area   = parseFloat(props['Area']   || props['area']   || 0);
    const volume = parseFloat(props['Volume'] || props['volume'] || 0);
    const count  = 1;

    // Classify by layer name
    const category = classifyLayer(layer);

    if (length > 0) {
      quantities.push({
        drawing:    drawingName,
        category,
        layer,
        element:    objType,
        measure:    'Length',
        quantity:   +(length / 1000).toFixed(3), // mm → m
        unit:       'm',
      });
    }
    if (area > 0) {
      quantities.push({
        drawing:    drawingName,
        category,
        layer,
        element:    objType,
        measure:    'Area',
        quantity:   +(area / 1e6).toFixed(3), // mm² → m²
        unit:       'm2',
      });
    }
    if (volume > 0) {
      quantities.push({
        drawing:    drawingName,
        category,
        layer,
        element:    objType,
        measure:    'Volume',
        quantity:   +(volume / 1e9).toFixed(3), // mm³ → m³
        unit:       'm3',
      });
    }
  }

  // Group and sum by category + layer + measure
  return aggregateQuantities(quantities);
}

function classifyLayer(layer = '') {
  const l = layer.toUpperCase();
  if (l.match(/COL|COLUMN/))          return 'Concrete-Columns';
  if (l.match(/SLAB|SLB/))            return 'Concrete-Slabs';
  if (l.match(/BEAM|BM/))             return 'Concrete-Beams';
  if (l.match(/FOOTING|FTG/))         return 'Concrete-Footings';
  if (l.match(/STAIR/))               return 'Concrete-Stairs';
  if (l.match(/REBAR|REINF|BAR|STEEL/))return 'Reinforcement';
  if (l.match(/STIRRUP/))             return 'Reinforcement-Stirrups';
  if (l.match(/WALL|WL/))             return 'Masonry-Walls';
  if (l.match(/BRICK/))               return 'Masonry-Brickwork';
  if (l.match(/PLASTER|PLSTR/))       return 'Finishes-Plastering';
  if (l.match(/TILE|FLOOR|FLR/))      return 'Finishes-Flooring';
  if (l.match(/PAINT/))               return 'Finishes-Painting';
  if (l.match(/DOOR|DR/))             return 'Openings-Doors';
  if (l.match(/WINDOW|WDW/))          return 'Openings-Windows';
  if (l.match(/PIPE|PLUMB/))          return 'MEP-Plumbing';
  if (l.match(/ELEC|CABLE|CONDUIT/))  return 'MEP-Electrical';
  if (l.match(/ROAD|PAVE/))           return 'Site-Paving';
  if (l.match(/DRAIN/))               return 'Site-Drainage';
  return `Other-${layer}`;
}

function aggregateQuantities(items) {
  const map = {};
  for (const item of items) {
    const key = `${item.category}||${item.layer}||${item.measure}||${item.unit}`;
    if (!map[key]) map[key] = { ...item, quantity: 0 };
    map[key].quantity = +(map[key].quantity + item.quantity).toFixed(3);
  }
  return Object.values(map).sort((a, b) => a.category.localeCompare(b.category));
}

// ─── Main: Full pipeline ──────────────────────────────────────
async function processDWG(filePath) {
  const objectKey  = path.basename(filePath).replace(/\s/g, '_');
  const drawingName = path.basename(filePath, path.extname(filePath));

  console.log(`[APS] Processing: ${objectKey}`);

  const token = await getToken();
  console.log('[APS] Token acquired');

  await ensureBucket(token);
  console.log('[APS] Bucket ready');

  const urn = await uploadDWG(token, filePath, objectKey);
  console.log('[APS] File uploaded');

  const encodedUrn = await translateModel(token, urn);
  console.log('[APS] Translation started');

  await pollTranslation(token, encodedUrn);
  console.log('[APS] Translation complete');

  const collection = await extractMetadata(token, encodedUrn);
  console.log(`[APS] Extracted ${collection.length} objects`);

  const quantities = parseQuantities(collection, drawingName);
  console.log(`[APS] Parsed ${quantities.length} quantity rows`);

  return { drawingName, quantities, processedAt: new Date().toISOString() };
}

module.exports = { processDWG, classifyLayer, aggregateQuantities };
