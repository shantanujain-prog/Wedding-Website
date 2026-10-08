#!/usr/bin/env node
// Side-by-side verification of the clone against the live site.
//
// For every route x viewport it loads the original and the clone with identical
// browser settings, lets every scroll/appear animation play out, then records:
//   - a full-page screenshot of each, plus a pixel diff (diff.png highlights
//     changed pixels in red over a dimmed copy of the clone);
//   - the layout box and key computed styles of every rendered element, and
//     the first differences between the two DOMs;
//   - for the clone, every request that left the local server, every failed
//     request and every console error.
//
// Usage: node tools/compare.js [--clone http://localhost:8080] [--out .verify]
//        [--routes /,/page,/missing] [--widths 390,810,1200,1440,1920]
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('./pw');
const { SITE } = require('./config');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const CLONE = arg('clone', 'http://localhost:8080').replace(/\/$/, '');
const OUT = path.resolve(arg('out', path.join(__dirname, '..', '.verify')));
const ROUTES = arg('routes', '/,/page,/this-page-does-not-exist').split(',');
const WIDTHS = arg('widths', '390,810,1200,1440,1920').split(',').map(Number);
const HEIGHTS = { 390: 844, 810: 1080, 1200: 800, 1440: 900, 1920: 1080 };
const MOBILE = (w) => w < 1000;

// Both pages run on an identical fake clock (Date, timers, requestAnimationFrame,
// performance.now) that only advances via runFor(), after the network has gone
// quiet. JS-driven animations therefore reach the same frame in both pages no
// matter how long the live site takes to download; CSS/WAAPI animations are
// finished (or reset, if infinite) by the screenshot's animations: 'disabled'.
const T0 = Date.parse('2026-10-08T12:00:00Z');

async function idle(page, inflight) {
  for (let quiet = 0; quiet < 3;) {
    await page.waitForTimeout(100);
    quiet = inflight.size === 0 ? quiet + 1 : 0;
  }
}

async function tick(page, inflight, ms) {
  await idle(page, inflight);
  await page.clock.runFor(ms);
  await idle(page, inflight);
}

async function settle(page, inflight) {
  await tick(page, inflight, 1000);
  await page.evaluate(() => document.fonts.ready);
  const vh = page.viewportSize().height;
  let height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += Math.round(vh / 2)) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await tick(page, inflight, 400);
    height = await page.evaluate(() => document.documentElement.scrollHeight);
  }
  await tick(page, inflight, 1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await tick(page, inflight, 4000);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await tick(page, inflight, 1000);
}

function domSnapshot() {
  const out = [];
  const keys = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor',
    'backgroundImage', 'borderRadius', 'opacity', 'transform', 'filter', 'boxShadow', 'textTransform', 'visibility', 'display'];
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 60);
    const style = {};
    for (const k of keys) style[k] = cs[k];
    let src = el.currentSrc || el.getAttribute('src') || el.getAttribute('href') || '';
    src = src.replace(/[abc]\.tile\.openstreetmap\.org/, 'tile.openstreetmap.org').replace(location.origin, '<origin>').replace(/https:\/\/rammandir\.framer\.website/, '<origin>').replace(/https:\/\/([a-z.]+)\//, '<origin>/$1/');
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className.split(' ').filter((c) => c.startsWith('framer-')).slice(0, 2).join('.') : '',
      rect: [r.x, r.y + scrollY, r.width, r.height].map((v) => Math.round(v * 100) / 100),
      text,
      src,
      style,
    });
  }
  return { count: out.length, title: document.title, fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`).sort(), nodes: out };
}

function diffDom(a, b) {
  const diffs = [];
  if (a.title !== b.title) diffs.push({ what: 'title', original: a.title, clone: b.title });
  const fa = new Set(a.fonts), fb = new Set(b.fonts);
  const missing = [...fa].filter((f) => !fb.has(f)), extra = [...fb].filter((f) => !fa.has(f));
  if (missing.length || extra.length) diffs.push({ what: 'loaded fonts', missingInClone: missing, extraInClone: extra });
  if (a.count !== b.count) diffs.push({ what: 'element count', original: a.count, clone: b.count });
  const n = Math.min(a.nodes.length, b.nodes.length);
  for (let i = 0; i < n && diffs.length < 400; i++) {
    const x = a.nodes[i], y = b.nodes[i];
    const d = {};
    if (x.tag !== y.tag || x.cls !== y.cls) { diffs.push({ what: 'structure', index: i, original: `${x.tag}.${x.cls}`, clone: `${y.tag}.${y.cls}` }); break; }
    if (x.rect.some((v, j) => Math.abs(v - y.rect[j]) > 0.05)) d.rect = [x.rect, y.rect];
    if (x.text !== y.text) d.text = [x.text, y.text];
    if (x.src !== y.src) d.src = [x.src, y.src];
    for (const k of Object.keys(x.style)) if (x.style[k] !== y.style[k]) d[k] = [x.style[k], y.style[k]];
    if (Object.keys(d).length) diffs.push({ index: i, el: `${x.tag}.${x.cls}`, text: x.text, ...d });
  }
  return diffs;
}

// Pixel diff inside the browser (canvas), so no image libraries are needed.
async function pixelDiff(browser, pngA, pngB, outFile) {
  const page = await browser.newPage();
  await page.setContent('<canvas id=c></canvas>');
  const res = await page.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const get = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = get(ia), db = get(ib);
    const c = document.getElementById('c'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const outImg = ctx.createImageData(w, h);
    let changed = 0;
    const CELL = 40, cells = new Map();
    for (let p = 0; p < da.length; p += 4) {
      const delta = Math.max(Math.abs(da[p] - db[p]), Math.abs(da[p + 1] - db[p + 1]), Math.abs(da[p + 2] - db[p + 2]));
      if (delta > 8) {
        changed++;
        outImg.data[p] = 255; outImg.data[p + 1] = 0; outImg.data[p + 2] = 0; outImg.data[p + 3] = 255;
        const px = (p / 4) % w, py = Math.floor(p / 4 / w);
        const k = `${Math.floor(px / CELL)},${Math.floor(py / CELL)}`;
        cells.set(k, (cells.get(k) || 0) + 1);
      } else {
        outImg.data[p] = db[p] * 0.3 + 178; outImg.data[p + 1] = db[p + 1] * 0.3 + 178; outImg.data[p + 2] = db[p + 2] * 0.3 + 178; outImg.data[p + 3] = 255;
      }
    }
    ctx.putImageData(outImg, 0, 0);
    // Merge changed cells into row bands for a compact report.
    const rows = new Map();
    for (const [k, v] of cells) { const [cx, cy] = k.split(',').map(Number); if (!rows.has(cy)) rows.set(cy, []); rows.get(cy).push([cx, v]); }
    const regions = [];
    for (const cy of [...rows.keys()].sort((x, y) => x - y)) {
      const xs = rows.get(cy).map(([cx]) => cx);
      const last = regions[regions.length - 1];
      const box = [Math.min(...xs) * CELL, cy * CELL, (Math.max(...xs) + 1) * CELL, (cy + 1) * CELL, rows.get(cy).reduce((s, [, v]) => s + v, 0)];
      if (last && last[3] === box[1]) { last[0] = Math.min(last[0], box[0]); last[2] = Math.max(last[2], box[2]); last[3] = box[3]; last[4] += box[4]; }
      else regions.push(box);
    }
    return { sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], changed, total: w * h, regions, cells: [...cells.keys()], png: c.toDataURL('image/png') };
  }, [`data:image/png;base64,${pngA.toString('base64')}`, `data:image/png;base64,${pngB.toString('base64')}`]);
  fs.writeFileSync(outFile, Buffer.from(res.png.split(',')[1], 'base64'));
  await page.close();
  delete res.png;
  return res;
}

async function shoot(browser, url, width, track) {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHTS[width] || 900 },
    deviceScaleFactor: 1,
    isMobile: MOBILE(width),
    hasTouch: MOBILE(width),
  });
  const page = await ctx.newPage();
  const net = { external: new Set(), failed: [], errors: [] };
  if (track) {
    page.on('request', (r) => { if (!r.url().startsWith(CLONE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) net.external.add(r.url()); });
    page.on('requestfailed', (r) => net.failed.push(`${r.failure()?.errorText} ${r.url()}`));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/this-page-does-not-exist')) net.failed.push(`${r.status()} ${r.url()}`); });
  }
  page.on('console', (m) => { if (m.type() === 'error') net.errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => net.errors.push(String(e).slice(0, 300)));
  const inflight = new Set();
  page.on('request', (r) => inflight.add(r));
  page.on('requestfinished', (r) => inflight.delete(r));
  page.on('requestfailed', (r) => inflight.delete(r));
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0 + 1000);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await settle(page, inflight);
  const dom = await page.evaluate(domSnapshot);
  const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  await ctx.close();
  return { png, dom, net: { external: [...net.external], failed: net.failed, errors: net.errors } };
}

// Properties of a DOM diff entry, used to tell clone defects from run-to-run noise.
const domKeys = (diffs) => new Set(diffs.flatMap((d) => Object.keys(d).filter((k) => !['index', 'el', 'text', 'what'].includes(k) || k === 'text').map((k) => `${d.index ?? d.what}:${k}`)));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const summary = [];
  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const name = `${route === '/' ? 'home' : route.slice(1).replace(/\W+/g, '-')}-${width}`;
      // A = live site, B = live site again (control: what varies between two
      // loads of the original), C = clone.
      const [a, b, c] = await Promise.all([
        shoot(browser, SITE + route, width, false),
        shoot(browser, SITE + route, width, false),
        shoot(browser, CLONE + route, width, true),
      ]);
      fs.writeFileSync(path.join(OUT, `${name}.original.png`), a.png);
      fs.writeFileSync(path.join(OUT, `${name}.clone.png`), c.png);
      const noise = await pixelDiff(browser, a.png, b.png, path.join(OUT, `${name}.control-diff.png`));
      const pix = await pixelDiff(browser, a.png, c.png, path.join(OUT, `${name}.diff.png`));
      const noiseCells = new Set(noise.cells);
      const excessCells = pix.cells.filter((k) => !noiseCells.has(k));
      const domNoise = diffDom(a.dom, b.dom);
      const dom = diffDom(a.dom, c.dom);
      const noiseKeys = domKeys(domNoise);
      const domExcess = dom.filter((d) => [...domKeys([d])].some((k) => !noiseKeys.has(k)));
      const row = {
        name,
        size: { original: pix.sizeA, control: noise.sizeB, clone: pix.sizeB },
        changedPixels: pix.changed,
        changedPct: +((100 * pix.changed) / pix.total).toFixed(4),
        controlChangedPixels: noise.changed,
        excessCells: excessCells.length,
        excessCellList: excessCells.slice(0, 40),
        regions: pix.regions.slice(0, 20),
        controlRegions: noise.regions.slice(0, 20),
        domDiffs: dom.length,
        controlDomDiffs: domNoise.length,
        domExcess: domExcess.length,
        external: c.net.external,
        failed: c.net.failed,
        consoleErrors: { original: a.net.errors, clone: c.net.errors },
      };
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ ...row, domExcessList: domExcess, dom, domNoise }, null, 1));
      summary.push(row);
      console.log(`${name.padEnd(32)} ${pix.sizeA.join('x')} vs ${pix.sizeB.join('x')} | clone diff ${pix.changed} px, control diff ${noise.changed} px, cells only in clone diff: ${excessCells.length} | dom diffs ${dom.length} (control ${domNoise.length}, beyond noise ${domExcess.length}) | external ${row.external.length} failed ${row.failed.length}`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  await browser.close();
})();
