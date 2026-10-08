#!/usr/bin/env node
// Loads every route of the live site in Chromium at several viewports and
// device-pixel ratios, scrolls through each page, and records every response
// body. The result (index.json + bodies/) is the input for tools/build.js.
//
// Usage: node tools/capture.js [outDir=.capture]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('./pw');
const { SITE, ROUTES, NOT_FOUND_PROBE } = require('./config');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', '.capture'));
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

async function visit(browser, url, vp) {
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
  const urls = [...ROUTES.map((r) => SITE + r.path), SITE + NOT_FOUND_PROBE];
  for (const url of urls) for (const vp of VIEWPORTS) await visit(browser, url, vp);
  await browser.close();
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
})();
