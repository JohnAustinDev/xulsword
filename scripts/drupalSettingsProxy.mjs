/*global process */
import http from 'http';
import https from 'https';

// Development only: lets webapp.html be tested with the same drupalSettings
// an IBTSite page would supply. The dev server serves
// /drupalSettings/<target>.js?<query>, which forwards the query to an IBTSite
// URL and returns a script that sets window.drupalSettings to the settings
// IBTSite rendered. The target is either:
//   api - The third-party API (bibleBrowserController's /bible-browser), as
//         used by test.html and test-fixed.html iframes. Without a query, no
//         settings are set, so the web-app falls back to defaultSettings.ts.
//   ibt - An IBTSite page with a Bible Browser block, as used by a top-level
//         webapp.html to test IBT's own use of the API. Such a page needs no
//         query. If WEBAPP_IBT_URL is not set, this is the same as api.
const WEBAPP_API_URL =
  process.env.WEBAPP_API_URL || 'https://localhost:8443/bible-browser';
const WEBAPP_IBT_URL = process.env.WEBAPP_IBT_URL || '';

// GET a URL, following redirects (/bible-browser redirects to /passage).
// Certificates are not verified, since the local IBTSite's is self-signed.
function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    lib
      .get(u, { rejectUnauthorized: false }, (res) => {
        const { statusCode, headers } = res;
        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          headers.location &&
          redirects > 0
        ) {
          res.resume();
          resolve(get(new URL(headers.location, u).href, redirects - 1));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode, body }));
      })
      .on('error', reject);
  });
}

export default function drupalSettingsProxy(app) {
  app.get('/drupalSettings/:target(api|ibt).js', async (req, res) => {
    res.type('application/javascript');
    res.set('Cache-Control', 'no-store');
    const { search } = new URL(req.originalUrl, 'http://localhost');
    const ibt = req.params.target === 'ibt' && WEBAPP_IBT_URL;
    if (!search && !ibt) {
      res.send('// No query parameters, so defaultSettings.ts will be used.\n');
      return;
    }
    const url = `${ibt ? WEBAPP_IBT_URL : WEBAPP_API_URL}${search}`;
    try {
      const { statusCode, body } = await get(url);
      const m = body.match(
        /<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/,
      );
      if (statusCode !== 200 || !m) {
        throw new Error(
          `HTTP ${statusCode}${m ? '' : ', no drupalSettings in response'}`,
        );
      }
      JSON.parse(m[1]);
      res.send(
        `window.drupalSettings = ${m[1]};\n` +
          `console.log('drupalSettings from', ${JSON.stringify(url)}, window.drupalSettings);\n`,
      );
    } catch (er) {
      const msg = `drupalSettings request failed: ${url}: ${er.message}`;
      console.error(msg);
      res.send(`console.error(${JSON.stringify(msg)});\n`);
    }
  });
}
