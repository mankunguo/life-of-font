import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = process.argv.includes('--dist') ? path.join(project, 'dist') : project;
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT || 5174);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const filename = path.resolve(root, relative);
    if (filename !== root && !filename.startsWith(root + path.sep)) { response.writeHead(403); response.end('Forbidden'); return; }
    // Development-only reference font manifest. A production build never contains those files.
    if ((await stat(filename)).isDirectory()) { response.writeHead(301, { Location: url.pathname.replace(/\/$/, '') + '/index.html' }); response.end(); return; }
    const bytes = await readFile(filename);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Life of Font\nLocal: http://127.0.0.1:${port}\nServing: ${root}`));
server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Try npm run dev -- --port ${port + 1}` : error.message); process.exitCode = 1; });
