const fs = require('fs');
const path = require('path');
const dir = 'proc/public';

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    let original = content;
    
    content = content.replace(/<title>BuildPro.*?Procurement<\/title>/g, '<title>BuildPro — Procurement</title>');
    
    // Replace the weird â ⬝ or Ã¢â‚¬â€ sequences commonly found in the JS template literals:
    content = content.replace(/Indent \$\{i\.id\} .*? \$\{i\.material\}/g, 'Indent ${i.id} — ${i.material}');
    content = content.replace(/PO \$\{p\.id\} .*? \$\{p\.material\}/g, 'PO ${p.id} — ${p.material}');
    content = content.replace(/GRN \$\{g\.id\} .*? \$\{g\.material\}/g, 'GRN ${g.id} — ${g.material}');
    content = content.replace(/QS \$\{i\.id\} .*? \$\{i\.vendorName\}/g, 'QS ${i.id} — ${i.vendorName}');
    
    // Quick actions descriptions
    content = content.replace(/Raise Indent\s*â[^\s]+New/g, 'Raise Indent\n            <div class="quick-sub">New');
    content = content.replace(/Review Approvals\s*â[^\s]+Pending/g, 'Review Approvals\n            <div class="quick-sub">Pending');
    content = content.replace(/Compare Quotes\s*â[^\s]+Select/g, 'Compare Quotes\n            <div class="quick-sub">Select');
    content = content.replace(/Purchase Orders\s*â[^\s]+Track/g, 'Purchase Orders\n            <div class="quick-sub">Track');
    content = content.replace(/Record Delivery\s*â[^\s]+GRN/g, 'Record Delivery\n            <div class="quick-sub">GRN');
    content = content.replace(/Reports\s*â[^\s]+Spend/g, 'Reports\n            <div class="quick-sub">Spend');

    // Various unicode replacements
    content = content.replace(/Ã¢â€žÂ¢/g, '—');
    content = content.replace(/Ã¢â‚¬Â¦/g, '…');
    content = content.replace(/Ã‚Â·/g, '·');
    content = content.replace(/Ã¢Å“â€œ/g, '✓');
    content = content.replace(/Ã¢â€ â€/g, '›');
    content = content.replace(/Ã¢â€šÂ¹/g, '₹');
    content = content.replace(/Ã¢â€/g, '—');
    content = content.replace(/â ⬝/g, '—');
    content = content.replace(/Ã¢â‚¬â€ /g, '—');
    content = content.replace(/Ã¢â‚¬/g, '');
    content = content.replace(/Ã‚Â/g, '');
    content = content.replace(/Ã‚/g, '');
    content = content.replace(/Â/g, '');
    content = content.replace(/Ã/g, '');
    content = content.replace(/â€œ/g, '"');
    content = content.replace(/â€/g, '"');
    content = content.replace(/â€“/g, '–');
    content = content.replace(/â€”/g, '—');
    content = content.replace(/â€¦/g, '…');
    content = content.replace(/¢/g, '');
    
    // Fix greeting with project
    content = content.replace(/Good afternoon, [^\<]*/g, 'Good afternoon, Administrator');
    content = content.replace(/Good morning, [^\<]*/g, 'Good morning, Administrator');

    // Make sure breadcrumb separates well
    content = content.replace(/BuildPro \— Procurement/g, 'BuildPro — Procurement');

    if (content !== original) {
        fs.writeFileSync(path.join(dir, f), content, 'utf8');
        console.log('Cleaned', f);
    }
});
