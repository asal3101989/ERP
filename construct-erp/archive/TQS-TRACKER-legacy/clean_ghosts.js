const fs = require('fs');
const path = require('path');
const dir = 'proc/public';

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    let original = fs.readFileSync(path.join(dir, f), 'utf8');
    let content = original;
    
    // Clean any non-standard invisible garbage characters before the middle dot
    content = content.replace(/\$\{session\.name\}[^·]*·/g, '${session.name} ·');
    content = content.replace(/'Active Project'\}[^·]*·/g, '\'Active Project\'} ·');

    // Make sure we didn't miss replacing garbled unicode strings elsewhere
    content = content.replace(/Â·/g, '·');

    if (content !== original) {
        fs.writeFileSync(path.join(dir, f), content, 'utf8');
        console.log('Cleaned ghost characters in', f);
    }
});
