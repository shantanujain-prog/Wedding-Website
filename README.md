# Wedding website (self-hosted copy of rammandir.framer.website)

A self-hosted, offline copy of the Framer site published at
https://rammandir.framer.website/. It is the site's own published output (HTML,
Framer runtime modules, fonts, images, map tiles), served from this folder,
with no requests to framer.website, Framer's CDNs, Google Fonts, unpkg or
Unsplash. The only exception is the map: zooming or panning it beyond the
stored views loads tiles from OpenStreetMap, as the live site does (see below).

## Run it

Requires Node.js 18 or newer. There are no dependencies to install.

```sh
npm start            # or: node server.js
```

Open http://localhost:8080/ (the second page is http://localhost:8080/page).
Use `PORT=3000 npm start` for another port, and `OFFLINE=1 npm start` to make
sure nothing is ever loaded from the internet. The server listens on all
interfaces, so a phone on the same network can open `http://<your-ip>:8080/`.

## What's in here

| Path | What it is |
| --- | --- |
| `server.js` | Zero-dependency Node server for `site/` |
| `site/index.html`, `site/page.html`, `site/404.html` | Pages for `/`, `/page` and unknown URLs |
| `site/robots.txt`, `site/sitemap.xml` | Served at the site root, as on the Framer host |
| `site/<host>/...` | Mirrored files, one folder per original host (`framerusercontent.com`, `fonts.gstatic.com`, ...) |
| `site/manifest.json` | URL → file/content-type table used by the server |
| `tools/` | Capture, build and verification scripts (only needed to refresh or re-verify the copy) |

How the server answers requests:

- Routing copies the Framer host: `/` and `/page` (percent-decoded, query
  ignored) serve the pages with the same `Server-Timing` route header,
  `/page/` redirects to `/page` (308), other methods get 405, and unknown
  paths get the 404 page, or a bare "Not found" for file-like names such as
  `/favicon.ico` or `*.png`.
- Mirrored files keep their original absolute URLs, with the external origin
  replaced by a placeholder that the server swaps for the origin you browse
  from. Framer's runtime parses image URLs with `new URL()`, so they must stay
  absolute.
- Framer image URLs carry size variants (`?scale-down-to=512`); every variant
  the site requests is stored. If a screen asks for a size that was never
  stored, the next larger stored size is served.
- The image CDN answers with AVIF or WebP depending on the browser's `Accept`
  header. Both versions are stored and the server makes the same choice.

## Differences from the live site

These are deliberate and have no visible effect:

- Framer's analytics beacon (`events.framer.com`) is removed.
- Framer's on-page editor bar loader is disabled. It only appears for people
  signed in to the Framer project, and it requires framer.com.
- `<link rel="canonical">`, `og:url`, `og:image` and `twitter:image` point at
  the local origin instead of rammandir.framer.website.

These are limits of an offline copy:

- **Map tiles:** the map draws OpenStreetMap tiles, a live third-party
  service whose usage policy forbids bulk downloading. The clone stores the 76
  tiles a browser loads while using the live map normally: both venue
  locations at their default zoom (14), one step out (13), two steps in
  (15, 16) and a short drag. Those views work offline. For any other tile (further zoom, or
  panning away) the server redirects the browser to `tile.openstreetmap.org`,
  so with internet the map behaves exactly like the live one. Offline, or with
  `OFFLINE=1`, those areas stay grey.
- **External links:** the Google Maps directions link, the RSVP WhatsApp
  (`wa.me`) link and the "Made in Framer" badge link still point to those
  services, as they do on the live site. Opening them needs internet access.

## How it was verified

`tools/compare.js` loads each route at 390, 810, 1200, 1440 and 1920 px wide,
once on the live site, once more on the live site as a control, and once on the
clone. All three run on the same frozen, manually advanced clock, so
script-driven animations end on the same frame. It then compares full-page
screenshots, the box and computed styles of every element, and the clone's
network traffic. Results of the last run:

- Page heights, element boxes and computed styles match on every route and
  width. Any remaining difference also occurs between two loads of the live
  site.
- The 404 page is pixel-identical at every width.
- The remaining pixel differences are the continuously animated birds, bells
  and rotating gallery, plus occasional text anti-aliasing. These vary just as
  much between two loads of the live site. In repeated 1440 px runs, the best
  clone/live pair differed by 279 of 17.6 million pixels, and the best
  live/live pair by 344.
- The clone made no external requests and had no failed requests.

Further checks, live against clone:

- hover, focus and cursor states, and keyboard Tab order;
- head and meta tags, anchors, history and scroll behaviour;
- scroll-linked and appear animations, and smooth scrolling;
- the RSVP form and its WhatsApp link, and the bell sound;
- every step of the map at three sizes;
- image selection at 24 widths and DPR 1/2/3;
- image bytes for AVIF and non-AVIF browsers;
- the server's responses for redirects, 404s and HTTP methods.

## Refreshing the copy after re-publishing in Framer

Requires Playwright with Chromium (`npm install && npx playwright install chromium`).

```sh
node tools/capture.js        # load every route at 7 viewport/DPR combinations and use the map; save all responses to .capture/
node tools/build.js          # rebuild site/ from .capture/ (fetches anything referenced but not yet loaded)
node tools/compare.js        # screenshot + DOM + network diff against the live site, into .verify/
```

If a proxy is required for outbound HTTPS, run `build.js` with
`NODE_USE_ENV_PROXY=1` (Node 22.21+), so Node's `fetch` uses `HTTPS_PROXY`.
New pages added in Framer must be added to `ROUTES` in `tools/config.js`
(route IDs are in the router table in `site/framerusercontent.com/sites/*/script_main.*.mjs`).
