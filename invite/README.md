# E-invite (PDF)

A 10-page A5 (148 × 210 mm) e-invite in the wedding website's palette and motifs:
cover, the six functions at a glance, one page per function (Mehndi, Dev Darshan,
Haldi, Sangeet, Reception, Shaadi), a closing page, and a last page listing the
details still to supply. Output: `invite/out/e-invite.pdf` (fonts embedded, prints
edge to edge; on screen it reads as one page per scroll).

Each function page has its subtitle, date and time, theme colours, dress code, a
venue block (address and map link) and directions from Bhopal and from Vidisha.

## Placeholders

Details that were not supplied print as red, dashed **PLACEHOLDER Pn** boxes, and the
last page lists every one with the pages it appears on. Fill them in `data.js`
(replace `PH("…")` with the text, or a URL for map links) and build again:

```sh
node invite/build.cjs           # draft, with the placeholder list as the last page
node invite/build.cjs --final   # refuses to build while a placeholder is left; no list page
```

The travel lines under "Arriving from out of town" (Raja Bhoj Airport, Vidisha
Railway Station, private vehicles on arrival) are taken from the website's
"How to Reach"; the placeholder page asks to confirm them.

## Files

| File | What it is |
| --- | --- |
| `data.js` | All text and the placeholders |
| `invite.html`, `invite.js` | Page layout (CSS in millimetres) and the page builder |
| `build.cjs` | Prints the pages to PDF with Chromium (Playwright) |
| `prep_art.py` | Cuts the couple illustrations from the invitations; makes the cover, closing and monogram artwork |
| `assets/` | Generated artwork and the Mangalam shlok; fonts and ornaments come from `../video/assets/` |
