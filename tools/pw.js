// Resolve Playwright from the local project, falling back to a global install.
'use strict';
const path = require('path');
const { execSync } = require('child_process');

function load() {
  try {
    return require('playwright');
  } catch (e) {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(root, 'playwright'));
  }
}

module.exports = load();
