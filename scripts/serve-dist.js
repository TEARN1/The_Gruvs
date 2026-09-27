const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, '..', 'dist', req.url === '/' ? 'index.html' : req.url);
  // Remove query params or hash
  filePath = filePath.split('?')[0].split('#')[0];
  
  const extname = path.extname(filePath);
  let contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routing
        fs.readFile(path.join(__dirname, '..', 'dist', 'index.html'), (errIndex, contentIndex) => {
          if (errIndex) {
            res.writeHead(500);
            res.end('Error: Could not load index.html');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(contentIndex, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const PORT = 8081;
server.listen(PORT, () => {
  console.log(`E2E Static Server running on port ${PORT}`);
});
