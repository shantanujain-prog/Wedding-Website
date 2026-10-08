#!/usr/bin/env node
// Zero-dependency server for the self-hosted copy of rammandir.framer.website.
//
//   node server.js            -> http://localhost:8080
//   PORT=3000 node server.js  -> http://localhost:3000
//   OFFLINE=1 node server.js  -> never send the browser to OpenStreetMap
//
// Mirrored files keep their original absolute URLs, with the external origin
// replaced by a placeholder; it is swapped for the origin the page is served
// from, so the site behaves the same on localhost, a LAN IP or a domain.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = path.join(__dirname, 'site');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST; // unset: listen on all interfaces
const OFFLINE = /^(1|true|yes)$/i.test(process.env.OFFLINE || '');

// The Framer host answers missing paths with these extensions with a bare
// "Not found" instead of its 404 page.
const BARE_404 = /\.(png|jpe?g|svg|ico|js|css|txt|json|pdf|php|aspx|env|bak|gz)$/i;

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

function send(req, res, status, file, type, headers, { etag = false } = {}) {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const buf = body(file, type, `${proto}://${host}`);
  if (etag) {
    headers = { ...headers, etag: `"${crypto.createHash('md5').update(buf).digest('hex')}"` };
    if (req.headers['if-none-match'] === headers.etag) {
      res.writeHead(304, headers);
      return res.end();
    }
  }
  res.writeHead(status, {
    'content-type': type,
    'content-length': buf.length,
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(req.method === 'HEAD' ? undefined : buf);
}

function sendText(req, res, status, type, text, headers = {}) {
  const buf = Buffer.from(text, 'utf8');
  res.writeHead(status, { 'content-type': type, 'content-length': buf.length, ...headers });
  res.end(req.method === 'HEAD' ? undefined : buf);
}

const PAGE_CACHE = 'public, max-age=0, must-revalidate';

function notFound(req, res, pathname) {
  if (BARE_404.test(pathname)) return sendText(req, res, 404, 'text/html; charset=utf-8', 'Not found\n', { 'cache-control': PAGE_CACHE });
  send(req, res, 404, manifest.notFound, 'text/html; charset=utf-8', { 'cache-control': PAGE_CACHE });
}

const server = http.createServer((req, res) => {
  const q = req.url.indexOf('?');
  const rawPath = q < 0 ? req.url : req.url.slice(0, q);
  const search = q < 0 ? '' : req.url.slice(q);
  let pathname = rawPath;
  try { pathname = decodeURIComponent(rawPath); } catch {}

  // Pages, matched like the Framer host: path percent-decoded, query ignored,
  // trailing slash redirected, other methods refused.
  const page = manifest.routes[pathname] || manifest.files[pathname];
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (page) return sendText(req, res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed', { allow: 'GET, HEAD' });
    return notFound(req, res, pathname);
  }
  if (pathname.length > 1 && pathname.endsWith('/') && manifest.routes[pathname.slice(0, -1)]) {
    const location = pathname.slice(0, -1) + search;
    return sendText(req, res, 308, 'text/html; charset=utf-8', `<a href="${location}">Permanent Redirect</a>.\n\n`, { location });
  }
  if (page) {
    const headers = { 'cache-control': PAGE_CACHE, 'last-modified': page.lastModified };
    if (page.routeId) headers['server-timing'] = `route;desc="id=${page.routeId}&locale=default"`;
    return send(req, res, 200, page.file, page.type, headers, { etag: true });
  }

  // Mirrored assets.
  const key = rawPath.slice(1) + search;
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

  // Map tiles that were not stored (another zoom level or area than the views
  // the site shows) are loaded from OpenStreetMap, as on the live site.
  const tile = rawPath.match(/^\/tile\.openstreetmap\.org\/(\d+\/\d+\/\d+\.png)$/);
  if (tile && !OFFLINE) {
    res.writeHead(302, { location: `https://tile.openstreetmap.org/${tile[1]}`, 'cache-control': 'no-store' });
    return res.end();
  }

  notFound(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Ram Mandir site running at http://localhost:${PORT}/`);
});
