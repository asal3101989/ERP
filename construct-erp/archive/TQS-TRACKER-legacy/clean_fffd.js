const fs = require('fs');
const files = fs.readdirSync('proc/public').filter(f => f.endsWith('.html'));
files.forEach(f => {
    let content = fs.readFileSync('proc/public/' + f, 'utf8');
    let original = content;
    // Remove the unknown replacement character \ufffd
    content = content.replace(/\uFFFD/g, ''); 
    if (content !== original) {
        fs.writeFileSync('proc/public/' + f, content, 'utf8');
        console.log('Removed U+FFFD from', f);
    }
});
