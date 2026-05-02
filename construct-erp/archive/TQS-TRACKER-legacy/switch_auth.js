const fs = require('fs');
const path = require('path');
const file = 'proc/public/auth.js';

let content = fs.readFileSync(file, 'utf8');
content = content.replace(/localStorage/g, 'sessionStorage');
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully switched to sessionStorage');
