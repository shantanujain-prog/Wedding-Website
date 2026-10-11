#!/usr/bin/env node
// Print the e-invite (invite.html + data.js) to PDF with Chromium.
//
//   node invite/build.cjs           # invite/out/e-invite.pdf, with the placeholder list as the last page
//   node invite/build.cjs --final   # fails while any placeholder or layout problem is left; no placeholder page
//   node invite/build.cjs --print   # invite/out/e-invite-print.pdf: 3 mm bleed on every side, with crop
//                                   # (trim) boxes for a print shop; combine with --final for the real thing
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  ({ chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")));
}

const ROOT = path.join(__dirname, "..");
const final = process.argv.includes("--final");
const print = process.argv.includes("--print");
const OUT = path.join(__dirname, "out", print ? "e-invite-print.pdf" : "e-invite.pdf");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };

// mark the A5 trimmed page (420 x 595 pt) inside each 437 x 612 pt sheet (TrimBox), the rest being bleed
const BOXES = `
import logging, sys
logging.getLogger("pypdf").setLevel(logging.ERROR)  # Chromium's trailer size is off by a few; harmless
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
b = 8.5
w = PdfWriter(clone_from=PdfReader(sys.argv[1]))
for p in w.pages:
    x0, y0, x1, y1 = [float(v) for v in p.mediabox]
    p.bleedbox = RectangleObject([x0, y0, x1, y1])
    p.trimbox = RectangleObject([x0 + b, y0 + b, x1 - b, y1 - b])
w.write(sys.argv[1])
`;

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
  const query = [final && "final", print && "bleed"].filter(Boolean).join("&");
  await page.goto(`http://127.0.0.1:${srv.address().port}/invite/invite.html${query ? "?" + query : ""}`);
  const info = await page.evaluate(() => window.ready);
  const used = await page.evaluate(() => window.PLACEHOLDERS_USED);
  if (info.problems.length) console.warn("layout:\n  " + info.problems.join("\n  "));
  if (final && (used.length || info.problems.length)) {
    if (used.length) console.error(`--final: ${used.length} placeholder(s) still in data.js:\n` + used.map((u) => `  P${u.no} ${u.label}`).join("\n"));
    if (info.problems.length) console.error(`--final: ${info.problems.length} layout problem(s), listed above`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
  if (print) {
    const r = spawnSync("python3", ["-c", BOXES, OUT], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("could not set the trim boxes (needs python3 with pypdf)");
  }
  console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${info.pages} pages, ${used.length} placeholders${print ? ", 3 mm bleed" : ""}`);
  used.forEach((u) => console.log(`  P${u.no}  ${u.label}  — ${u.where.join(", ")}`));
  await browser.close();
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
