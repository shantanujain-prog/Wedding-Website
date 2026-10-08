#!/usr/bin/env node
// Loads every route of the live site in Chromium at several viewports and
// device-pixel ratios, scrolls through each page, and records every response
// body. It also uses the location map the way a visitor would (each location
// button, one or two zoom steps), which is how the map tiles for the clone are
// obtained: OpenStreetMap forbids bulk tile downloads, so only tiles a browser
// loads during normal use are kept. The result (index.json + bodies/) is the
// input for tools/build.js.
//
// Usage: node tools/capture.js [outDir=.capture] [--map-only]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('./pw');
const { SITE, ROUTES, NOT_FOUND_PROBE } = require('./config');

const args = process.argv.slice(2);
const MAP_ONLY = args.includes('--map-only');
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', '.capture'));
const VIEWPORTS = [
  { w: 390, h: 844, dpr: 3, mobile: true },
  { w: 390, h: 844, dpr: 2, mobile: true },
  { w: 810, h: 1080, dpr: 2, mobile: true },
  { w: 1200, h: 800, dpr: 1 },
  { w: 1440, h: 900, dpr: 2 },
  { w: 1920, h: 1080, dpr: 1 },
  { w: 2560, h: 1440, dpr: 2 },
];

fs.mkdirSync(path.join(OUT, 'bodies'), { recursive: true });
const indexFile = path.join(OUT, 'index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};

async function settleTiles(page) {
  await page.waitForTimeout(600);
  await page.waitForFunction(() => [...document.querySelectorAll('img.leaflet-tile')].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

// Visit every view of the map a visitor can reach with a few clicks: each
// location at its default zoom, one zoom step out and two in.
async function mapJourney(page) {
  // The map component only builds the Leaflet map once it nears the viewport.
  const map = page.locator('.leaflet-container').first();
  const vh = page.viewportSize().height;
  for (let y = 0; !(await map.count()); y += Math.round(vh / 2)) {
    if (y > (await page.evaluate(() => document.documentElement.scrollHeight))) return;
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(300);
  }
  await map.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.leaflet-container img.leaflet-tile'), null, { timeout: 20000 }).catch(() => {});
  await settleTiles(page);
  const buttons = page.locator('button').filter({ hasText: /^\s*Location/ });
  const count = await buttons.count();
  const visible = [];
  for (let i = 0; i < count; i++) if (await buttons.nth(i).isVisible()) visible.push(buttons.nth(i));
  const zoomIn = page.locator('.leaflet-control-zoom-in').first();
  const zoomOut = page.locator('.leaflet-control-zoom-out').first();
  for (const button of visible.length ? visible : [null]) {
    if (button) { await button.click(); await settleTiles(page); }
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // enables zooming
    await settleTiles(page);
    for (const step of [zoomIn, zoomIn, zoomOut, zoomOut, zoomOut]) {
      if (await step.isVisible()) { await step.click(); await settleTiles(page); }
    }
    // Back to the default zoom and a short drag, as a visitor looking around.
    if (button) { await button.click(); await settleTiles(page); }
    const b = await map.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 80, b.y + b.height / 2 + 48, { steps: 8 });
    await page.mouse.up();
    await settleTiles(page);
  }
}

async function visit(browser, url, vp, { mapOnly = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
    isMobile: !!vp.mobile,
    hasTouch: !!vp.mobile,
  });
  const page = await ctx.newPage();
  const pending = [];
  page.on('response', (res) => {
    pending.push((async () => {
      const u = res.url();
      if (!/^https?:/.test(u)) return;
      const status = res.status();
      if (status >= 300 && status < 400) return;
      try {
        const body = await res.body();
        const hash = crypto.createHash('sha1').update(u).digest('hex');
        fs.writeFileSync(path.join(OUT, 'bodies', hash), body);
        index[u] = { hash, status, type: res.headers()['content-type'] || '', size: body.length };
      } catch (e) {
        // Body unavailable (e.g. aborted preload); it will be fetched by build.js if referenced.
      }
    })());
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);
  if (mapOnly) {
    await mapJourney(page);
    await Promise.all(pending);
    await ctx.close();
    const tiles = Object.keys(index).filter((u) => u.includes('tile.openstreetmap.org')).length;
    console.log(`${url} @${vp.w}x${vp.h}: map journey done, ${tiles} tiles captured so far`);
    return;
  }
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height + vp.h; y += Math.round(vp.h / 3)) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await Promise.all(pending);
  await ctx.close();
  console.log(`${url} @${vp.w}x${vp.h} dpr${vp.dpr}: page height ${height}, ${Object.keys(index).length} urls`);
}

(async () => {
  const browser = await chromium.launch();
  if (!MAP_ONLY) {
    const urls = [...ROUTES.map((r) => SITE + r.path), SITE + NOT_FOUND_PROBE];
    for (const url of urls) for (const vp of VIEWPORTS) await visit(browser, url, vp);
  }
  // Map journeys at the two map sizes the site uses (665x320 and 343x320,
  // plus the 526x439 frame at large desktop widths).
  for (const vp of [VIEWPORTS[3], VIEWPORTS[5], VIEWPORTS[0]]) await visit(browser, SITE + '/', vp, { mapOnly: true });
  await browser.close();
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
})();
