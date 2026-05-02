const fs = require('fs');
const path = require('path');
const dir = 'proc/public';

const replacements = [
    { bad: /Ã¢â€žÂ¢/g, good: '™' },
    { bad: /Ã¢Å“â€œ/g, good: '✓' },
    { bad: /Ã¢Å¡Â /g, good: '⚠️' },
    { bad: /Ã¢â€ â€/g, good: '›' },
    { bad: /Ã¢â€šÂ¹/g, good: '₹' },
    { bad: /Ã¢â€ â€™/g, good: '→' },
    { bad: /Ã¢â‚¬Â¦/g, good: '…' },
    { bad: /Ã¢â‚¬â€œ/g, good: '—' },
    { bad: /Ã¢â‚¬â€ /g, good: '—' },
    { bad: /Ã‚Â·/g, good: '·' },
    { bad: /â ⬝/g, good: '—' },
    { bad: /Â·/g, good: '·' },
    { bad: /â€º/g, good: '›' },
    { bad: /â€”/g, good: '—' },
    { bad: /â€“/g, good: '–' },
    { bad: /Ã¢/g, good: '' },
    { bad: /Â/g, good: '' },
    { bad: /â€/g, good: '' },
    { bad: /Ã/g, good: '' }
];

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    let original = content;
    
    replacements.forEach(r => {
        content = content.replace(r.bad, r.good);
    });

    if (content !== original) {
        fs.writeFileSync(path.join(dir, f), content, 'utf8');
        console.log('Cleaned', f);
    }
});
