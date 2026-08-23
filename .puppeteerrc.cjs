// Corporate network TLS interception blocks the Chromium download during
// `npm install`. Skip it — set PUPPETEER_EXECUTABLE_PATH to a local Chrome/Edge
// install, or run `npx puppeteer browsers install chrome` later when network/
// certs allow it.
module.exports = {
  skipDownload: true,
};
