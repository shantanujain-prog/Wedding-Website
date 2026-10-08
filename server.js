#!/usr/bin/env node
// Zero-dependency server for the self-hosted copy of rammandir.framer.website.
//
//   node server.js            -> http://localhost:8080
//   PORT=3000 node server.js  -> http://localhost:3000
//
// Mirrored files keep their original absolute URLs, with the external origin
// replaced by a placeholder; it is swapped for the origin the page is served
// from, so the site behaves the same on localhost, a LAN IP or a domain.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, 'site');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST; // unset: listen on all interfaces

const manifest = JSON.parse(fs.readFileSync(path.join(SITE, 'manifest.json'), 'utf8'));
const TOKEN = manifest.originToken;
const isText = (type) => /^(text\/|application\/(javascript|json))/.test(type);

// Index query variants by path so an unseen size can fall back to a near one.
const exact = new Map();
const byPath = new Map();
for (const [key, [file, type, altFile, altType]] of Object.entries(manifest.assets)) {
  // altFile: the version the image CDN sends to browsers that don't accept AVIF.
  const entry = { file, type, altFile, altType };
  exact.set(key, entry);
  exact.set(normalize(key), entry);
  const q = key.indexOf('?');
  const base = q < 0 ? key : key.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : key.slice(q + 1));
  if (!byPath.has(base)) byPath.set(base, []);
  byPath.get(base).push({ ...entry, scale: Number(params.get('scale-down-to')) || Infinity });
}

function normalize(key) {
  const q = key.indexOf('?');
  let p = q < 0 ? key : key.slice(0, q);
  try { p = decodeURIComponent(p); } catch {}
  const params = new URLSearchParams(q < 0 ? '' : key.slice(q + 1));
  params.sort();
  const s = params.toString();
  return s ? `${p}?${s}` : p;
}

// Framer image URLs carry ?scale-down-to=N (max side in px). For a size that
// was not captured, serve the smallest captured size >= N, else the largest.
function nearest(key) {
  const q = key.indexOf('?');
  const base = q < 0 ? key : key.slice(0, q);
  const list = byPath.get(base) || byPath.get(normalize(base));
  if (!list) return null;
  const want = Number(new URLSearchParams(q < 0 ? '' : key.slice(q + 1)).get('scale-down-to')) || Infinity;
  const sorted = [...list].sort((a, b) => a.scale - b.scale);
  return sorted.find((v) => v.scale >= want) || sorted[sorted.length - 1];
}

const cache = new Map();
function body(file, type, origin) {
  const k = `${file}\0${origin}`;
  if (!cache.has(k)) {
    let buf = fs.readFileSync(path.join(SITE, file));
    if (isText(type)) buf = Buffer.from(buf.toString('utf8').split(TOKEN).join(origin), 'utf8');
    cache.set(k, buf);
  }
  return cache.get(k);
}

function send(req, res, status, file, type, headers) {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const buf = body(file, type, `${proto}://${host}`);
  res.writeHead(status, {
    'content-type': type,
    'content-length': buf.length,
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(req.method === 'HEAD' ? undefined : buf);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    return res.end();
  }
  const q = req.url.indexOf('?');
  const pathname = q < 0 ? req.url : req.url.slice(0, q);
  const search = q < 0 ? '' : req.url.slice(q);

  // Pages, matched like the Framer host: query ignored, trailing slash redirected.
  if (pathname.length > 1 && pathname.endsWith('/') && manifest.routes[pathname.slice(0, -1)]) {
    res.writeHead(308, { location: pathname.slice(0, -1) + search });
    return res.end();
  }
  const route = manifest.routes[pathname];
  if (route) {
    return send(req, res, 200, route.file, 'text/html', {
      'cache-control': 'public, max-age=0, must-revalidate',
      'server-timing': `route;desc="id=${route.routeId}&locale=default"`,
    });
  }

  // Mirrored assets.
  const key = pathname.slice(1) + search;
  const asset = exact.get(key) || exact.get(normalize(key)) || nearest(key);
  if (asset) {
    const headers = { 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' };
    if (asset.altFile) {
      headers.vary = 'Accept';
      if (!String(req.headers.accept || '').includes('image/avif')) {
        return send(req, res, 200, asset.altFile, asset.altType, headers);
      }
    }
    return send(req, res, 200, asset.file, asset.type, headers);
  }

  send(req, res, 404, manifest.notFound, 'text/html; charset=utf-8', {
    'cache-control': 'public, max-age=0, must-revalidate',
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Ram Mandir site running at http://localhost:${PORT}/`);
});
