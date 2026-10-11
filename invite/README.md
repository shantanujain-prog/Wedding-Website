# E-invite (PDF)

A 10-page A5 (148 × 210 mm) e-invite in the wedding website's palette and motifs:
cover, the six functions at a glance, one page per function (Mehndi, Dev Darshan,
Haldi, Sangeet, Reception, Shaadi), a closing page, and a last page listing the
details still to supply. Output: `invite/out/e-invite.pdf` for sharing and screens
(fonts embedded, background edge to edge), and `invite/out/e-invite-print.pdf` for a
print shop (the same pages with 3 mm bleed and crop boxes).

Each function page has its subtitle, date and time, theme colours, dress code, a
venue block (address and map link) and directions from Bhopal and from Vidisha.

## Placeholders

Details that were not supplied print as red, dashed **PLACEHOLDER Pn** boxes, and the
last page lists every one with the pages it appears on. Fill them in `data.js`
(replace `PH("…")` with the text; for map links a URL, or a list of them for the two
residences) and build again:

```sh
node invite/build.cjs                   # draft, with the placeholder list as the last page
node invite/build.cjs --final           # refuses to build while a placeholder or a layout problem is left; no list page
node invite/build.cjs --print --final   # the print-shop file, with 3 mm bleed (needs python3 with pypdf)
```

Every build checks that text stays inside the gold frame and clear of the footer, and
lists anything that does not (for example, a much longer address than expected).

The same page also lists what to **confirm** before printing (`CONFIRM` in `data.js`,
plus two lists made from the data): the travel lines under "From out of town", taken
from the website's "How to Reach"; the route sentences, written from the venue
address; two subtitles kept exactly as supplied ("…where love glooms.", "Two of us &
all you join us…"); and whether the "Groom" / "Bride" dress code is for the couple or
for guests.

## Files

| File | What it is |
| --- | --- |
| `data.js` | All text and the placeholders |
| `invite.html`, `invite.js` | Page layout (CSS in millimetres) and the page builder; `?bleed` adds the print bleed |
| `build.cjs` | Prints the pages to PDF with Chromium (Playwright) |
| `prep_art.py` | Cuts the couple illustrations from the invitations; makes the cover, closing and monogram artwork |
| `assets/` | Generated artwork and the Mangalam shlok; fonts and ornaments come from `../video/assets/` |
