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
  // Non-page files the Framer host serves at the site root.
  EXTRA_FILES: ['/robots.txt', '/sitemap.xml'],

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

};
