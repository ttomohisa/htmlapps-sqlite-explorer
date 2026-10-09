const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const asset = read('assets/favicon.svg');
const config = JSON.parse(read('app.config.json'));
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)=(["'])(.*?)\2/gs)].map(m => [m[1], m[3]]));
const inner = svg => svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
const decode = uri => uri.includes(';base64,') ? Buffer.from(uri.split(',')[1], 'base64').toString() : decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
const favicon = html => {
 const tag = html.match(/<link\b[^>]*rel=["']icon["'][^>]*>/);
 assert.ok(tag, 'favicon exists');
 const uri = attrs(tag[0]).href;
 if (uri === '__FAVICON_DATA_URL__') return;
 assert.equal(inner(decode(uri)), inner(asset), 'embedded favicon matches asset');
};
test('canonical icon has exact brand color and quarter-side corner radii', () => {
 const rect = attrs(asset.match(/<rect\b[^>]*>/)[0]);
 assert.equal(rect.fill.toLowerCase(), '#16624f');
 assert.equal(Number(rect.rx), Number(rect.width) / 4);
 assert.equal(Number(rect.ry ?? rect.rx), Number(rect.height) / 4);
});
const files = ["src/index.template.html", "dist/index.html", "sqlite-explorer.html"];
for (const file of files) test(`${file} keeps canonical header and favicon artwork`, () => {
 const html = read(file);
 const mark = html.match(/<div class="brand-mark"[^>]*>([\s\S]*?)<\/div>/);
 assert.ok(mark, 'brand mark exists');
 assert.equal(inner(mark[1]), inner(asset), 'header artwork matches asset');
 favicon(html);
 const assetBox = attrs(asset.match(/<svg\b[^>]*>/)[0]).viewBox;
 assert.equal(attrs(mark[1].match(/<svg\b[^>]*>/)[0]).viewBox, assetBox, 'header preserves viewBox');
});
if (config.build?.selfExtract?.enabled) test('self-extract loader keeps favicon and restores readable HTML exactly', () => {
 const html = read(config.build.selfExtract.output);
 favicon(html);
 const payload = html.match(/<script id="self-extract-payload"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/);
 assert.ok(payload);
 assert.equal(gunzipSync(Buffer.from(payload[1], 'base64')).toString(), read(config.build.output));
});
