import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, sw, manifestText] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('sw.js', 'utf8'),
  readFile('manifest.webmanifest', 'utf8'),
]);

const manifest = JSON.parse(manifestText);
assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
assert.match(html, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
assert.equal(manifest.start_url, './');
assert.equal(manifest.display, 'standalone');
assert.match(sw, /\.\/index\.html/);
assert.match(sw, /request\.mode==="navigate"/);
assert.match(sw, /request\.destination==="image"/);
assert.match(sw, /caches\.match\("\.\/index\.html"\)/);

console.log('OFFLINE_SHELL_OK');
