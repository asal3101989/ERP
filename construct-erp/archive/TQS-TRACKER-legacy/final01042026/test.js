const http = require('http');

const payload = JSON.stringify({
  id: "GRN-001",
  poId: "PO-001",
  vendorName: "Acme Corp",
  material: "Portland Cement",
  receivedQty: 100,
  unit: "Bags",
  poTotal: 50000,
  poQty: 100
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/sync/procurement-grn',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-sync-key': 'buildpro-tqs-sync-2024',
    'Content-Length': payload.length
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', e => console.error(e));
req.write(payload);
req.end();
