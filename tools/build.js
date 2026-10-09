#!/usr/bin/env node
// Builds the self-hosted mirror in ./site from a capture made by tools/capture.js.
//
//  1. Takes every response the live site produced in the capture.
//  2. Scans every HTML/JS/CSS/JSON file for further URLs on the mirrored hosts
//     (srcset candidates, every @font-face subset, favicons, og:image, search
//     index, the Leaflet assets, unused default images, ...) and downloads them.
//  3. Fetches the on-demand image sizes requested by the WebGL "waving image"
//     component. Map tiles are NOT fetched here: OpenStreetMap forbids bulk
//     downloading, so only the tiles a browser loaded while capture.js used
//     the live map are kept (server.js sends other tiles to OpenStreetMap).
//  4. Rewrites https://<mirrored host>/... to <origin>/<host>/... in all text
//     files, strips Framer's analytics beacon and on-page editor bar, and writes
//     site/manifest.json, which server.js uses to answer requests.
//
//  5. Adds the site's own additions from custom/ (loader, background music
//     and mute button) to the pages, unless --pristine is given.
//
// Usage: NODE_USE_ENV_PROXY=1 node tools/build.js [captureDir=.capture] [outDir=site] [--pristine] [--cached]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SITE, ROUTES, NOT_FOUND_PROBE, EXTRA_FILES, MIRROR_HOSTS, ORIGIN_TOKEN } = require('./config');

const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PRISTINE = process.argv.includes('--pristine');
// --cached: reuse the last fetched images instead of asking the CDN again
// (quick rebuilds when only custom/ changed).
const CACHED = process.argv.includes('--cached');
const CAP = path.resolve(ARGS[0] || path.join(ROOT, '.capture'));
const OUT = path.resolve(ARGS[1] || path.join(ROOT, 'site'));
const CUSTOM = path.join(ROOT, 'custom');

const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
// Accept header of a browser without AVIF support (Safari before 16).
const WEBP_ACCEPT = 'image/webp,image/png,image/svg+xml,image/*;q=0.8,video/*;q=0.8,*/*;q=0.5';

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const capIndex = JSON.parse(fs.readFileSync(path.join(CAP, 'index.json'), 'utf8'));

// ---------------------------------------------------------------------------
// URL <-> key <-> file mapping

// Canonical key for a mirrored URL: "<host><path>?<query>", or null when the
// URL is not on a mirrored host.
function keyOf(u) {
  let url;
  try { url = new URL(u); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  let host = url.hostname;
  if (/^[abc]\.tile\.openstreetmap\.org$/.test(host)) host = 'tile.openstreetmap.org';
  if (!MIRROR_HOSTS.includes(host)) return null;
  return host + url.pathname + url.search;
}

function remoteOf(key) {
  if (key.startsWith('tile.openstreetmap.org/')) return 'https://a.' + key;
  return 'https://' + key;
}

// File name for a key; safe on Windows/macOS/Linux. Query variants get a
// readable suffix plus a hash so they never collide.
function fileOf(key) {
  const q = key.indexOf('?');
  let p = q < 0 ? key : key.slice(0, q);
  const query = q < 0 ? '' : key.slice(q + 1);
  if (p.endsWith('/')) p += 'index';
  p = p.split('/').map((seg) => seg.replace(/[:*?"<>|\\]/g, '_')).join('/');
  if (query) p += '~' + query.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) + '.' + sha1(query).slice(0, 8);
  return p;
}

function sniffType(buf, headerType, key) {
  const head = buf.subarray(0, 4).toString('latin1');
  if (head === 'wOF2') return 'font/woff2';
  if (head === 'wOFF') return 'font/woff';
  const t = (headerType || '').split(';')[0].trim();
  if (t && t !== 'application/octet-stream' && t !== 'text/html') return headerType.trim();
  const ext = path.extname(key.split('?')[0]).toLowerCase();
  return {
    '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
    '.svg': 'image/svg+xml', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
  }[ext] || t || 'application/octet-stream';
}

const isText = (type) => /^(text\/|application\/(javascript|json))/.test(type);

// ---------------------------------------------------------------------------
// Asset store

const assets = new Map(); // key -> { body: Buffer, type }
const failed = new Map(); // key -> reason

// md5 of the "Access blocked" PNG that OpenStreetMap returns (with HTTP 200)
// to clients that break its tile usage policy; never store it as a tile.
const OSM_BLOCKED_MD5 = 'c069a15b2cc2d6b6f527ad09eb93c61a';

for (const [u, meta] of Object.entries(capIndex)) {
  const key = keyOf(u);
  if (!key || meta.status !== 200) continue;
  const body = fs.readFileSync(path.join(CAP, 'bodies', meta.hash));
  if (key.startsWith('tile.openstreetmap.org/') && crypto.createHash('md5').update(body).digest('hex') === OSM_BLOCKED_MD5) continue;
  assets.set(key, { body, type: sniffType(body, meta.type, key) });
}

function acceptFor(key) {
  if (/^(images\.unsplash\.com|tile\.openstreetmap\.org)\//.test(key)) return IMAGE_ACCEPT;
  if (/\.(png|jpe?g|webp|avif|gif|svg|ico)(\?|$)/i.test(key)) return IMAGE_ACCEPT;
  if (/\.css(\?|$)|^fonts\.googleapis\.com\/css/.test(key)) return 'text/css,*/*;q=0.1';
  return '*/*';
}

// Downloads are cached in <captureDir>/downloads so re-running the build does
// not re-fetch hundreds of map tiles. refreshImages() bypasses the cache.
const DL = path.join(CAP, 'downloads');
fs.mkdirSync(DL, { recursive: true });

// Bodies served to browsers that do not accept AVIF, for images where the CDN
// answers Chromium with AVIF: key -> { body, type }.
const webpAssets = new Map();

async function download(key, { fresh = false, accept = null, store = assets } = {}) {
  if (store.has(key) || failed.has(key)) return;
  const cached = path.join(DL, sha1(accept ? `${key}#${accept}` : key));
  if (!fresh && fs.existsSync(cached + '.type')) {
    const body = fs.readFileSync(cached);
    store.set(key, { body, type: fs.readFileSync(cached + '.type', 'utf8') });
    return;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(remoteOf(key), {
        headers: {
          'user-agent': CHROME_UA,
          accept: accept || acceptFor(key),
          referer: SITE + '/',
        },
      });
      if (res.status !== 200) { failed.set(key, `HTTP ${res.status}`); return; }
      const body = Buffer.from(await res.arrayBuffer());
      const type = sniffType(body, res.headers.get('content-type'), key);
      store.set(key, { body, type });
      fs.writeFileSync(cached, body);
      fs.writeFileSync(cached + '.type', type);
      return;
    } catch (e) {
      if (attempt === 3) failed.set(key, String(e.cause || e));
      else await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

// Framer's image CDN serves WebP for a new size first and switches to AVIF once
// it has encoded one, so a captured body can be stale. Re-fetch every Framer
// image until a full pass returns the same bytes the store already holds.
async function refreshImages() {
  const keys = [...assets.keys()].filter((k) => k.startsWith('framerusercontent.com/images/'));
  for (let pass = 1; pass <= 4; pass++) {
    const before = new Map(keys.map((k) => [k, assets.get(k)]));
    for (const k of keys) assets.delete(k);
    await downloadAll(keys, 8, { fresh: !CACHED });
    if (CACHED) return;
    const changed = keys.filter((k) => {
      const a = before.get(k), b = assets.get(k);
      if (!b) { assets.set(k, a); return false; }
      return !a || !a.body.equals(b.body);
    });
    console.log(`  image refresh pass ${pass}: ${changed.length} of ${keys.length} changed`);
    if (!changed.length) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function downloadAll(keys, concurrency = 8, opts = {}) {
  const store = opts.store || assets;
  const queue = [...new Set(keys)].filter((k) => !store.has(k) && !failed.has(k));
  let done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      await download(queue.shift(), opts);
      if (++done % 50 === 0) console.log(`  downloaded ${done}`);
    }
  }));
  return done;
}

// ---------------------------------------------------------------------------
// URL discovery in text files

const HOST_RE = '(?:framerusercontent\\.com|fonts\\.gstatic\\.com|fonts\\.googleapis\\.com|images\\.unsplash\\.com|unpkg\\.com|[abc]\\.tile\\.openstreetmap\\.org)';
const ABS_URL_RE = new RegExp(`https://${HOST_RE}/[^\\s"'\`<>()\\\\]*`, 'g');

function discover(key, text, type) {
  const found = [];
  const decoded = type.startsWith('text/html') ? text.replace(/&amp;/g, '&') : text;
  for (const m of decoded.match(ABS_URL_RE) || []) {
    if (m.includes('{') || m.includes('$')) continue; // template, not a concrete URL
    const k = keyOf(m.replace(/[.,;]+$/, ''));
    if (k && !k.split('?')[0].endsWith('/')) found.push(k);
  }
  if (type.startsWith('text/css')) {
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (/^(data:|#)/.test(m[1])) continue;
      const k = keyOf(new URL(m[1], remoteOf(key)).href);
      if (k) found.push(k);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Rewriting

function rewrite(text) {
  return text
    .replace(/https:\/\/(?:\{s\}|[abc])\.tile\.openstreetmap\.org/g, `${ORIGIN_TOKEN}/tile.openstreetmap.org`)
    .replace(/https:\/\/(framerusercontent\.com|fonts\.gstatic\.com|fonts\.googleapis\.com|images\.unsplash\.com|unpkg\.com)/g, `${ORIGIN_TOKEN}/$1`)
    .replace(/https:\/\/rammandir\.framer\.website/g, ORIGIN_TOKEN);
}

function mustReplace(text, pattern, replacement, what) {
  const out = text.replace(pattern, replacement);
  if (out === text) throw new Error(`patch not applied: ${what}`);
  return out;
}

// Framer's analytics beacon and its on-page editor bar (only shown to Framer
// users signed in to the project) both talk to framer.com; neither renders
// anything for visitors, so they are removed.
function patchHtml(html) {
  html = mustReplace(html, /\s*<script async src="https:\/\/events\.framer\.com\/script[^"]*"[^>]*><\/script>/, '', 'analytics script');
  html = mustReplace(html, /\s*<script>try\{if\(localStorage\.getItem\("__framer_force_showing_editorbar_since"\)\)[\s\S]*?<\/script>/, '', 'editor bar preload');
  return html;
}

// Additions that are not part of the Framer site: the loader, background
// music and mute button, and the "How to Reach" section (sources in custom/). The song files get a content
// hash in their name, since the server lets browsers cache assets for a year.
function customizations() {
  const read = (f) => fs.readFileSync(path.join(CUSTOM, f), 'utf8');
  const songs = {};
  for (const [ext, type] of [['webm', 'audio/webm'], ['mp3', 'audio/mpeg']]) {
    const body = fs.readFileSync(path.join(CUSTOM, `wedding-song.${ext}`));
    const key = `custom/wedding-song.${sha1(body).slice(0, 8)}.${ext}`;
    songs[ext] = { key, body, type };
  }
  const script = read('loader.js').split('__WL_SONG_WEBM__').join('/' + songs.webm.key).split('__WL_SONG_MP3__').join('/' + songs.mp3.key);
  if (script.includes('__WL_SONG_')) throw new Error('unreplaced song placeholder in custom/loader.js');
  return {
    songs: Object.values(songs),
    apply(html) {
      html = mustReplace(html, /(<meta name="viewport"[^>]*>)/, `$1\n<style id="wl-loader-css">\n${read('loader.css')}\n${read('reach.css')}</style>`, 'loader styles');
      html = mustReplace(html, /(<body[^>]*>)/, `$1\n${read('loader.html')}<script>\n${script}</script>`, 'loader markup');
      html = mustReplace(html, /(<script data-framer-appear-animation=)/, `<script>\n${read('appear-recorder.js')}</script>$1`, 'appear recorder');
      // "How to Reach" starts outside Framer's #main and is moved under the
      // RSVP card by reach.js once React has hydrated the page.
      html = mustReplace(html, /(<\/body>)/, `${read('reach.html')}<script>\n${read('reach.js')}</script>\n$1`, 'how to reach section');
      // "Son of" under the groom's name, laid out like the bride's "Daughter of".
      // Smaller timeline card text on phones (the event details are longer than the template's).
      html = mustReplace(html, /(<\/head>)/, `<style id="timeline-mobile">\n${read('timeline-mobile.css')}</style>\n$1`, 'timeline mobile styles');
      html = mustReplace(html, /(<\/body>)/, `<script id="son-of">\n${read('son-of.js')}</script>\n$1`, 'son of line');
      return html;
    },
  };
}

function patchModule(key, js) {
  if (/\/script_main\.[^/]+\.mjs$/.test(key)) {
    js = mustReplace(js, /EditorBar:[a-zA-Z_$]+===void 0\?void 0:\(\(\)=>\{[\s\S]*?\}\)\(\),adaptLayoutToTextDirection:/, 'EditorBar:void 0,adaptLayoutToTextDirection:', 'editor bar loader');
  }
  return js;
}

// ---------------------------------------------------------------------------
// On-demand image sizes

// The waving-image component requests "<image>?scale-down-to=N" with
// N = clamp(ceil(canvasWidth * min(dpr, 2)), 160, 1024), so N depends on the
// viewer's screen. Its canvases are at most 154px wide at any breakpoint, so
// every N from 160 to 320 is fetched exactly; above that a ladder is fetched
// and server.js serves the nearest size at or above the one requested.
function scaleLadderKeys() {
  const bases = new Set();
  for (const key of assets.keys()) {
    const m = key.match(/^(framerusercontent\.com\/images\/[^?]+)\?scale-down-to=\d+$/);
    if (m) bases.add(m[1]);
  }
  const keys = [];
  for (const base of bases) {
    for (let n = 160; n <= 1024; n += n < 320 ? 1 : 8) keys.push(`${base}?scale-down-to=${n}`);
    keys.push(base);
  }
  return keys;
}

// ---------------------------------------------------------------------------

async function main() {
  const pages = [
    ...ROUTES.map((r) => ({ url: SITE + r.path, file: r.file })),
    { url: SITE + NOT_FOUND_PROBE, file: '404.html' },
  ];
  const pageHtml = new Map();
  for (const p of pages) {
    const meta = capIndex[p.url];
    if (!meta) throw new Error(`page not captured: ${p.url}`);
    pageHtml.set(p.file, fs.readFileSync(path.join(CAP, 'bodies', meta.hash), 'utf8'));
  }

  // Crawl references until closed.
  console.log(`captured assets: ${assets.size}`);
  const scanned = new Set();
  let pending = [];
  for (const html of pageHtml.values()) pending.push(...discover('', html, 'text/html'));
  for (let round = 1; ; round++) {
    for (const [key, a] of assets) {
      if (scanned.has(key) || !isText(a.type)) continue;
      scanned.add(key);
      pending.push(...discover(key, a.body.toString('utf8'), a.type));
    }
    const todo = [...new Set(pending)].filter((k) => !assets.has(k) && !failed.has(k));
    pending = [];
    if (!todo.length) break;
    console.log(`round ${round}: fetching ${todo.length} referenced files`);
    await downloadAll(todo);
  }

  // Leaflet builds these two icon URLs from marker-icon.png at runtime.
  const extra = ['unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', 'unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'];
  console.log('fetching leaflet icons and on-demand image sizes');
  await downloadAll([...extra, ...scaleLadderKeys()]);
  const tiles = [...assets.keys()].filter((k) => k.startsWith('tile.openstreetmap.org/'));
  console.log(`map tiles captured by the browser: ${tiles.length}`);

  // Headers of the pages and extra files (Last-Modified, Content-Type), and
  // the extra files themselves (robots.txt, sitemap.xml).
  const live = {};
  for (const p of [...ROUTES.map((r) => r.path), ...EXTRA_FILES]) {
    const res = await fetch(SITE + p, { headers: { 'user-agent': CHROME_UA } });
    if (res.status !== 200) throw new Error(`${p}: HTTP ${res.status}`);
    live[p] = { type: res.headers.get('content-type'), lastModified: res.headers.get('last-modified'), body: Buffer.from(await res.arrayBuffer()) };
  }
  console.log('refreshing Framer images');
  await refreshImages();
  // The CDN can answer a browser without AVIF support with different bytes
  // (another format, or for some URLs a scaled copy), so fetch every image
  // again with such an Accept header and keep the answer when it differs.
  const imageKeys = [...assets.keys()].filter((k) => k.startsWith('framerusercontent.com/images/'));
  console.log(`fetching non-AVIF versions of ${imageKeys.length} images`);
  await downloadAll(imageKeys, 8, { fresh: !CACHED, accept: WEBP_ACCEPT, store: webpAssets });

  // Write the site.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = { originToken: ORIGIN_TOKEN, routes: {}, files: {}, notFound: '404.html', assets: {} };

  const custom = PRISTINE ? null : customizations();
  for (const [file, html] of pageHtml) {
    let out = file === '404.html' ? rewrite(html) : rewrite(patchHtml(html));
    // Inserted after rewrite(): custom/ files already use the origin token.
    if (custom && file !== '404.html') out = custom.apply(out);
    fs.writeFileSync(path.join(OUT, file), out);
  }
  if (custom) {
    for (const song of custom.songs) {
      fs.mkdirSync(path.dirname(path.join(OUT, song.key)), { recursive: true });
      fs.writeFileSync(path.join(OUT, song.key), song.body);
      manifest.assets[song.key] = [song.key, song.type];
    }
  }
  for (const r of ROUTES) manifest.routes[r.path] = { file: r.file, type: live[r.path].type, lastModified: live[r.path].lastModified, routeId: r.routeId };
  for (const p of EXTRA_FILES) {
    const file = p.slice(1);
    fs.writeFileSync(path.join(OUT, file), rewrite(live[p].body.toString('utf8')));
    manifest.files[p] = { file, type: live[p].type, lastModified: live[p].lastModified };
  }

  for (const key of [...assets.keys()].sort()) {
    const a = assets.get(key);
    const file = fileOf(key);
    let body = a.body;
    if (isText(a.type)) {
      let text = body.toString('utf8');
      if (a.type.includes('javascript')) text = patchModule(key, text);
      body = Buffer.from(rewrite(text), 'utf8');
    }
    fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
    fs.writeFileSync(path.join(OUT, file), body);
    manifest.assets[key] = [file, a.type];
    const alt = webpAssets.get(key);
    if (alt && !alt.body.equals(a.body)) {
      fs.writeFileSync(path.join(OUT, file + '.noavif'), alt.body);
      manifest.assets[key].push(file + '.noavif', alt.type);
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));

  // Report.
  const bytes = [...assets.values()].reduce((n, a) => n + a.body.length, 0);
  console.log(`\nwrote ${assets.size} assets (${(bytes / 1e6).toFixed(1)} MB) + ${pageHtml.size} pages to ${OUT}`);
  if (failed.size) {
    console.log(`${failed.size} referenced URLs could not be fetched (not used by the rendered site unless listed by verify):`);
    for (const [k, why] of failed) console.log(`  ${why}  ${k}`);
  }

  // Anything still pointing at a third-party origin that the browser would load?
  const leftovers = new Set();
  for (const f of [...pageHtml.keys()].map((p) => path.join(OUT, p)).concat(
    Object.values(manifest.assets).filter(([, t]) => isText(t)).map(([f]) => path.join(OUT, f)))) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/https?:\/\/(framerusercontent\.com|fonts\.gstatic\.com|fonts\.googleapis\.com|images\.unsplash\.com|unpkg\.com|[a-z{}]+\.tile\.openstreetmap\.org|events\.framer\.com|framer\.com\/edit|app\.framerstatic\.com|rammandir\.framer\.website)/g)) {
      leftovers.add(`${path.relative(OUT, f)}: ${m[0]}`);
    }
  }
  if (leftovers.size) {
    console.log('\nremaining external references:');
    for (const l of leftovers) console.log('  ' + l);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
