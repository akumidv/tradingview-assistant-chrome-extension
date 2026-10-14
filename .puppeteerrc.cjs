// Puppeteer's browser download for the tv-browser-test skill: Chrome for Testing (branded Chrome
// 137+ ignores --load-extension) goes into the git-ignored _aitna/.browser, not ~/.cache.
const { join } = require('node:path');

module.exports = {
  cacheDirectory: join(__dirname, '_aitna', '.browser'),
  chrome: { skipDownload: false },
  'chrome-headless-shell': { skipDownload: true },
  firefox: { skipDownload: true },
};
