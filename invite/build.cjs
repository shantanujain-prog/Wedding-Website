#!/usr/bin/env node
// Print the e-invite (invite.html + data.js) to PDF with Chromium.
//
//   node invite/build.cjs           # invite/out/e-invite.pdf, with the placeholder list as the last page
//   node invite/build.cjs --final   # fails while any placeholder is left; no placeholder page
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  ({ chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")));
}

const ROOT = path.join(__dirname, "..");
const final = process.argv.includes("--final");
const OUT = path.join(__dirname, "out", "e-invite.pdf");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };

(async () => {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => { console.error("page error:", e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${srv.address().port}/invite/invite.html${final ? "?final" : ""}`);
  const info = await page.evaluate(() => window.ready);
  const used = await page.evaluate(() => window.PLACEHOLDERS_USED);
  if (info.problems.length) console.warn("layout:\n  " + info.problems.join("\n  "));
  if (final && used.length) {
    console.error(`--final: ${used.length} placeholder(s) still in data.js:\n` + used.map((u) => `  P${u.no} ${u.label}`).join("\n"));
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
  console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${info.pages} pages, ${used.length} placeholders`);
  used.forEach((u) => console.log(`  P${u.no}  ${u.label}  — ${u.where.join(", ")}`));
  await browser.close();
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
