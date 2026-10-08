// Shared settings for the capture/build/compare tools.
'use strict';

module.exports = {
  SITE: 'https://rammandir.framer.website',

  // Routes from the Framer router table in script_main.*.mjs. routeId is
  // echoed in the Server-Timing header, as the Framer host does.
  ROUTES: [
    { path: '/', file: 'index.html', routeId: 'augiA20Il' },
    { path: '/page', file: 'page.html', routeId: 'Bw06UtcCP' },
  ],
  NOT_FOUND_PROBE: '/this-page-does-not-exist',

  // Hosts whose files are self-hosted under /<host>/... in the clone.
  // The a/b/c OpenStreetMap tile subdomains are folded into one directory.
  MIRROR_HOSTS: [
    'framerusercontent.com',
    'fonts.gstatic.com',
    'fonts.googleapis.com',
    'images.unsplash.com',
    'unpkg.com',
    'tile.openstreetmap.org',
  ],

  // Placeholder written into mirrored text files in place of the external
  // origin; server.js swaps it for the origin the page is being served from,
  // so every URL stays absolute exactly as on the live site.
  ORIGIN_TOKEN: '__CLONE_ORIGIN__',

  // Venue marker of the Leaflet map (from the map component's props) and the
  // largest map container seen across breakpoints, used to pre-fetch tiles.
  MAP: { lat: 19.2183, lng: 72.9781, zooms: [11, 12, 13, 14, 15, 16, 17, 18], width: 700, height: 460 },
};
