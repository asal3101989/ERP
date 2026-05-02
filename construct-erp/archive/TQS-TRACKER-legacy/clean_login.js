const fs = require('fs');

let c = fs.readFileSync('proc/public/login.html', 'utf8');

c = c.replace(/<div class="test-accounts">[\s\S]*?<\/div>/, '');
c = c.replace(/\.test-accounts \{[\s\S]*?\}/, '');
c = c.replace(/\.test-accounts b \{[\s\S]*?\}/, '');
c = c.replace(/\/\* Auto layout note[\s\S]*?\*\//, '');

// Push login wrapper down
if (!c.includes('margin-top: 80px;')) {
    c = c.replace('max-width: 480px;', 'max-width: 480px; margin-top: 80px;');
}

fs.writeFileSync('proc/public/login.html', c, 'utf8');
console.log('Successfully cleaned login block');
