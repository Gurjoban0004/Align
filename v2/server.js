/**
 * ALIGN v2 — Development Server
 * Run with: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { handleHealthSync, handleGetHealthData, handleGetToken } = require('./api/health-sync.js');

const PORT = 3000;
const HOST = '0.0.0.0'; // Listen on all interfaces so iPhone on same WiFi can reach it

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
};

// Get local network IP (for iPhone webhook URL display)
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const server = http.createServer((req, res) => {
  // ─── CORS for API routes ───
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawUrl = req.url || '/';
  const urlParts = rawUrl.split('?');
  const pathname = urlParts[0];
  const queryStr = urlParts[1] || '';
  const query = {};
  queryStr.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });

  // ─── API Routes ───

  // POST /api/health-sync?token=... — receive Apple Health data
  if (pathname === '/api/health-sync' && req.method === 'POST') {
    handleHealthSync(req, res, query.token);
    return;
  }

  // GET /api/health-data — serve stored health data to the PWA
  if (pathname === '/api/health-data' && req.method === 'GET') {
    handleGetHealthData(req, res);
    return;
  }

  // GET /api/health-token — serve the current sync token
  if (pathname === '/api/health-token' && req.method === 'GET') {
    handleGetToken(req, res);
    return;
  }

  // GET /api/health-info — serve server IP + webhook URL
  if (pathname === '/api/health-info' && req.method === 'GET') {
    const { getOrCreateToken } = require('./api/health-sync.js');
    const token = getOrCreateToken();
    const ip = getLocalIP();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ ip, port: currentPort, token }));
    return;
  }

  // ─── Static File Server ───
  let cleanUrl = pathname;

  // Strip leading /v2 or /v2/ from request URL to resolve paths correctly
  if (cleanUrl.startsWith('/v2/')) {
    cleanUrl = cleanUrl.substring(3);
  } else if (cleanUrl === '/v2') {
    cleanUrl = '/';
  }

  let filePath = path.join(__dirname, cleanUrl);

  if (cleanUrl === '/' || cleanUrl === '') {
    filePath = path.join(__dirname, 'index.html');
  }

  // Security: prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const extname = String(path.extname(resolvedPath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // SPA fallback — serve index.html for unknown paths
        fs.readFile(path.join(__dirname, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(500);
            res.end('Server error');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server error: ${error.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      res.end(content, 'utf-8');
    }
  });
});

let currentPort = PORT;

function startServer(port) {
  server.listen(port, HOST, () => {
    const localIP = getLocalIP();
    console.log(`\n  ✦ Align v2 dev server`);
    console.log(`  → Local:    http://127.0.0.1:${port}/`);
    console.log(`  → Network:  http://${localIP}:${port}/`);
    console.log(`\n  📱 iPhone webhook URL:`);
    console.log(`     http://${localIP}:${port}/api/health-sync?token=<your-token>`);
    console.log(`     (Get your token from Align Settings → Apple Health)\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${currentPort} in use, trying next port...`);
    currentPort += 1;
    startServer(currentPort);
  } else {
    console.error('Server error:', err);
  }
});

startServer(currentPort);
