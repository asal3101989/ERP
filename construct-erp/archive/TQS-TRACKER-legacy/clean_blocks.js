const fs = require('fs');
let c = fs.readFileSync('proc/public/index.html', 'utf8');

// Fix KPI card empty dashes
c = c.replace(/<div class="dc-value" id="d-indents">.*?<\/div>/g, '<div class="dc-value" id="d-indents">–</div>');
c = c.replace(/<div class="dc-value" id="d-pos">.*?<\/div>/g, '<div class="dc-value" id="d-pos">–</div>');
c = c.replace(/<div class="dc-value" id="d-grns">.*?<\/div>/g, '<div class="dc-value" id="d-grns">–</div>');
c = c.replace(/<div class="dc-value" id="d-invoices">.*?<\/div>/g, '<div class="dc-value" id="d-invoices">–</div>');

// Fix missing emoji in quick actions and layout artifact
c = c.replace(/<div class="quick-icon">.*?<\/div>\s*<div>\s*<div class="quick-label">Review Approvals/g, '<div class="quick-icon">✅</div>\n          <div>\n            <div class="quick-label">Review Approvals');

// Fix "Loading activity..." label
c = c.replace(/<div class="da-label" style="color:var\(--text-3\)">Loading.*?<\/div>/g, '<div class="da-label" style="color:var(--text-3)">Loading activity…</div>');

fs.writeFileSync('proc/public/index.html', c, 'utf8');
console.log('Fixed index.html HTML blocks');
