import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/distance.js': ['distance.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/config.json': ['config.json', 'application/json'] };
createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { res.setHeader('Content-Type', `${file[1]}; charset=utf-8`); res.end(await readFile(new URL(file[0], import.meta.url))); }
  catch { res.writeHead(500); res.end('Unable to read file'); }
}).listen(3000, '127.0.0.1', () => console.log('http://localhost:3000'));
