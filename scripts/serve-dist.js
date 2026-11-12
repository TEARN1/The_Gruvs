const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const compressible = new Set([
  'text/html; charset=utf-8',
  'text/javascript; charset=utf-8',
  'text/css; charset=utf-8',
  'application/json; charset=utf-8',
  'image/svg+xml',
  'application/xml; charset=utf-8',
  'text/plain; charset=utf-8',
]);

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0].split('#')[0];
  let filePath = path.join(__dirname, '..', 'dist', cleanUrl === '/' ? 'index.html' : cleanUrl);
  
  const serveFile = (targetPath, isFallback = false) => {
    fs.stat(targetPath, (statErr, stats) => {
      if (statErr || !stats.isFile()) {
        if (!isFallback) {
          serveFile(path.join(__dirname, '..', 'dist', 'index.html'), true);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
        return;
      }

      const extname = path.extname(targetPath).toLowerCase();
      const contentType = mimeTypes[extname] || 'application/octet-stream';
      const acceptEncoding = req.headers['accept-encoding'] || '';

      // Cache-Control headers
      const headers = {
        'Content-Type': contentType,
      };

      if (cleanUrl.startsWith('/_expo/static/') || cleanUrl.startsWith('/assets/')) {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      } else {
        headers['Cache-Control'] = 'public, max-age=3600, must-revalidate';
      }

      const stream = fs.createReadStream(targetPath);

      if (compressible.has(contentType) && stats.size > 1024) {
        if (/\bgzip\b/.test(acceptEncoding)) {
          headers['Content-Encoding'] = 'gzip';
          res.writeHead(200, headers);
          stream.pipe(zlib.createGzip({ level: 6 })).pipe(res);
          return;
        } else if (/\bdeflate\b/.test(acceptEncoding)) {
          headers['Content-Encoding'] = 'deflate';
          res.writeHead(200, headers);
          stream.pipe(zlib.createDeflate()).pipe(res);
          return;
        }
      }

      headers['Content-Length'] = stats.size;
      res.writeHead(200, headers);
      stream.pipe(res);
    });
  };

  serveFile(filePath);
});

const PORT = 8081;
server.listen(PORT, () => {
  console.log(`E2E Static Server with Gzip & Caching running on port ${PORT}`);
});
