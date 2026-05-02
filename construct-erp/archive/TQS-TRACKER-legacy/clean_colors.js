const fs = require('fs');
let c = fs.readFileSync('proc/public/login.html', 'utf8');

c = c.replace(/#E23727/g, '#C17B3A'); // main accent
c = c.replace(/#c5291b/g, '#b56d33'); // hover accent
c = c.replace(/rgba\(226, 55, 39,/g, 'rgba(193, 123, 58,'); // shadow accent

fs.writeFileSync('proc/public/login.html', c, 'utf8');
console.log('Swapped colors to softer gold/bronze');
