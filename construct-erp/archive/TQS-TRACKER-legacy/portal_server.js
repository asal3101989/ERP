const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3003;

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'portal.html' : decodeURIComponent(req.url));
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;      
        case '.jpg': contentType = 'image/jpg'; break;
        case '.webp': contentType = 'image/webp'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const ip = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
    console.log(`========================================`);
    console.log(`  BCIM HUB running at http://localhost:${PORT}`);
    console.log(`  Network access:  http://${ip}:${PORT}`);
    console.log(`========================================`);
});
