'use strict';
// Native Chromium checks run only in the existing unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const PHONE_WIDTH = 820;
const HELP = "#helpButton", LANGUAGE = "#languageButton", CLOSE = "#closeHelpButton";
const artifacts = path.resolve('test-results/mobile-layout');

function isPhone(width, height) { return width <= PHONE_WIDTH; }
async function checkActions(page, width, height, label) {
  const nav = page.locator('#mobileNav');
  assert.equal(await nav.locator('button').count(), 5, label + ': functional actions retained');
  assert.equal(await nav.isVisible(), isPhone(width, height), label + ': functional bar breakpoint');
  if (isPhone(width, height)) {
    const box = await nav.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, label + ': action bar stays inside viewport');
  }
}
async function exerciseActions(page, width, height, label) {
  const buffer = require('node:zlib').gunzipSync(Buffer.from('H4sIAAAAAAACA+3XMQrCQBAF0F0VrEStLDOlATsvYJRFglF03cKUMa4YiAkkC2LpYTyed3AlEEEQrOU//sDMMBeY7SZIjKZjXpwjQ2PWY5yzCRGrNNgbt9X6mH/SeR1378wGAAAAAAAAAL4JeXvgOPzGTbRPdXnNzEmbJK6bxkwKTwlS3jQQVK9pmBzIXykxF5LW0l96MqSFCEeU5fbnV2Kn3Oo3fzAbAAAAAAAAAPgHfd5kbpDHUUpGl4aK/PIEN/Dx8AAgAAA=', 'base64'));
  await page.locator('#fileInput').setInputFiles({name:'synthetic.sqlite', mimeType:'application/x-sqlite3', buffer});
  await page.locator('#workspace').waitFor();
  if (isPhone(width, height)) {
    await page.locator('#mobileNav [data-view="query"]').click();
    assert.equal(await page.locator('#view-query').isVisible(), true, label + ': SQL destination');
    await page.locator('#mobileNav [data-view="overview"]').click();
  }
  await checkActions(page, width, height, label);
}

async function checkDataRegressions(browser) {
  const { DatabaseSync } = require('node:sqlite');
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sqlite-explorer-'));
  const writeDatabase = (name, sql) => {
    const file = path.join(dir, name);
    const db = new DatabaseSync(file);
    try { db.exec(sql); } finally { db.close(); }
    return file;
  };
  const first = writeDatabase('first.sqlite', `
    CREATE TABLE alpha(id INTEGER PRIMARY KEY, label TEXT, generated AS (label || '-generated'));
    INSERT INTO alpha VALUES(9007199254740992,'first'),(9007199254740993,'second');
    CREATE TABLE beta(label TEXT);
    INSERT INTO beta VALUES('beta-only');
    CREATE TABLE sqliteX(x);
    CREATE TABLE parent(a,b,PRIMARY KEY(a,b)) WITHOUT ROWID;
    CREATE TABLE child(a,b,FOREIGN KEY(a,b) REFERENCES parent);
    INSERT INTO parent VALUES(1,1),(1,2);
    INSERT INTO child VALUES(1,2);
    CREATE VIEW wide_view AS WITH RECURSIVE seq(n) AS
      (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<205) SELECT n FROM seq;
  `);
  const second = writeDatabase('second.sqlite', 'CREATE TABLE gamma(label TEXT)');
  const wal = fs.readFileSync(second);
  wal[18] = wal[19] = 2; // WAL format marker in an already checkpointed main database.
  const context = await browser.newContext({viewport:{width:393,height:740}, locale:'en'});
  const page = await context.newPage();
  const at = selector => page.locator(selector);
  const go = view => at(`#mobileNav [data-view="${view}"]`).click();
  const load = async file => {
    await at('#fileInput').setInputFiles(file);
    await at('#workspace').waitFor();
  };
  const run = async sql => {
    await at('#queryEditor').fill(sql);
    await at('#runQuery').click();
    return at('#queryResults').innerText();
  };
  const download = async selector => {
    const pending = page.waitForEvent('download');
    await at(selector).click();
    return fs.readFileSync(await (await pending).path(), 'utf8').replace(/^\uFEFF/, '');
  };
  try {
    await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
    await load(first);
    assert.equal(await at('#walNotice').isVisible(), false);
    await go('tables');
    assert.equal(await at('#dataToolbar').isVisible(), false);
    await at('#dataTableSelect').selectOption('sqliteX');
    await at('#dataTableSelect').selectOption('alpha');
    assert.match(await at('#dataContainer').innerText(), /second-generated/);
    await go('analyze');
    await at('#analyzeTableSelect').selectOption('beta');
    await go('tables');
    assert.equal(await at('#dataTitle').innerText(), 'alpha');
    assert.match(await download('#exportTableCsv'), /9007199254740993,second,second-generated/);
    await at('#dataTableSelect').selectOption('wide_view');
    await at('#nextPage').click();
    assert.match(await at('#pageInfo').innerText(), /101–200/);
    await at('#rowFilterInput').fill('205');
    await page.waitForFunction(() => document.querySelector('#dataContainer tbody')?.innerText.trim() === '205');
    await at('#dataTableSelect').selectOption('child');
    await at('[data-record-row]').first().click();
    assert.equal(await at('#recordDialog [data-related-index]').count(), 1);
    await at('#recordDialog [data-related-index]').click();
    assert.equal(await at('#dataTitle').innerText(), 'parent');
    assert.equal(await at('#dataContainer tbody tr').count(), 1);
    assert.deepEqual(await at('#dataContainer tbody .cell-button').allTextContents(), ['1', '2']);
    await go('query');
    assert.match(await run('PRAGMA user_version(123)'), /blocked/i);
    assert.match(await run('PRAGMA user_version'), /\b0\b/);
    assert.match(await run('SELECT 9007199254740993 AS [update]'), /9007199254740993/);
    assert.deepEqual(JSON.parse(await download('#exportQueryJson')), [{update:'9007199254740993'}]);
    await at('#replaceFileMobile').click();
    await load(second);
    await go('tables');
    assert.equal(await at('#dataContainer tbody tr').count(), 0);
    assert.equal(await at('#exportTableCsv').isEnabled(), false);
    await at('#replaceFileMobile').click();
    await load({name:'wal.sqlite', mimeType:'application/x-sqlite3', buffer:wal});
    await go('query');
    assert.match(await at('#walNotice').innerText(), /WAL mode/);
    await at('#languageButton').click();
    assert.match(await at('#walNotice').innerText(), /WALモード/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS SQLite data and SQL regressions at mobile width');
  } finally {
    await context.close();
    fs.rmSync(dir, { recursive:true, force:true });
  }
}

async function main() {
  fs.mkdirSync(artifacts, {recursive:true});
  const browser = await chromium.launch();
  try {
    const cases = [];
    for (const language of ['ja', 'en']) {
      for (const [width, height] of [[1360,900], [PHONE_WIDTH + 1,568], [PHONE_WIDTH,568], [320,568], [393,252]]) cases.push({file:'dist/index.html', language, width, height});
    }
    // Also load the compressed and root download variants, without duplicating the full matrix.
    cases.push({file:'dist/index.self-extract.html', language:'en', width:360, height:640});
    cases.push({file:'sqlite-explorer.html', language:'ja', width:1360, height:900});
    for (const {file, language, width, height} of cases) {
      const context = await browser.newContext({viewport:{width,height}, locale:language, reducedMotion:'reduce'});
      const page = await context.newPage();
      const errors = [], requests = [];
      const label = `${file} ${language} ${width}x${height}`;
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      try {
        await page.goto(pathToFileURL(path.resolve(file)).href);
        await page.locator(HELP).waitFor();
        if (await page.locator('html').getAttribute('lang') !== language) await page.locator(LANGUAGE).click();
        assert.equal((await page.locator('[data-i18n="localBadge"]').textContent()).trim(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label + ': privacy wording');
        assert.equal(await page.locator('body > footer').isVisible(), !isPhone(width, height), label + ': informational footer breakpoint');
        const badge = page.locator('.local-badge');
        assert.equal(await badge.isVisible(), !isPhone(width, height), label + ': local-processing badge visibility');
        if (await badge.isVisible()) {
          const box = await badge.boundingBox(), text = await page.locator('[data-i18n="localBadge"]').boundingBox();
          assert.ok(box && text && box.x >= 0 && box.x + box.width <= width + 1 && text.x >= box.x && text.x + text.width <= box.x + box.width + 1, label + ': local-processing badge fits');
        }
        const titleGeometry = await page.locator('#brandName').evaluate(el => { const r = el.getBoundingClientRect(); return { width:r.width, height:r.height, font:getComputedStyle(el).fontFamily, language:el.lang }; });
        await page.locator(LANGUAGE).click();
        assert.deepEqual(await page.locator('#brandName').evaluate(el => { const r = el.getBoundingClientRect(); return { width:r.width, height:r.height, font:getComputedStyle(el).fontFamily, language:el.lang }; }), titleGeometry, label + ': brand rendering across languages');
        await page.locator(LANGUAGE).click();
        await exerciseActions(page, width, height, label);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');
        // Responsive changes must not leave the informational footer in a stale state.
        await page.setViewportSize({width:PHONE_WIDTH + 1, height});
        assert.equal(await page.locator('body > footer').isVisible(), !isPhone(PHONE_WIDTH + 1, height), label + ': wider resize');
        await page.setViewportSize({width:PHONE_WIDTH, height});
        assert.equal(await page.locator('body > footer').isVisible(), false, label + ': phone resize');
        await page.setViewportSize({width,height});
        // Capture the actual viewport after resize, not a stitched full-page image of fixed controls.
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await checkActions(page, width, height, label);
        if (file === 'dist/index.html' && [1360,320].includes(width)) {
          // Let the existing non-interactive loaded toast clear before evidence captures.
          await page.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0');
          await page.screenshot({path:path.join(artifacts, `${language}-${width}.png`)});
        }

        await page.locator(HELP).click();
        const body = page.locator('#helpDialog .dialog-body');
        await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
        const finalItem = page.locator('#helpDialog .dialog-body p:visible, #helpDialog .dialog-body li:visible').last();
        const end = await finalItem.evaluate(el => { const r = el.getBoundingClientRect(), b = el.closest('.dialog-body').getBoundingClientRect(), d = el.closest('dialog').getBoundingClientRect(); return {top:r.top,bottom:r.bottom,clipTop:Math.max(0,b.top,d.top),clipBottom:Math.min(innerHeight,b.bottom,d.bottom)}; });
        assert.ok(end.top >= end.clipTop - 1 && end.bottom <= end.clipBottom + 1, label + ': final Help guidance reachable ' + JSON.stringify(end));
        assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
        const header = await page.locator('#helpDialog .dialog-head, #helpDialog .dialog-header').boundingBox();
        assert.ok(header && header.y >= 0 && header.y + header.height <= height, label + ': Help header visible');
        const beforeScroll = await page.evaluate(() => scrollY);
        await page.mouse.move(2, Math.floor(height / 2));
        await page.mouse.wheel(0,400);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': modal background locked');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape closes Help');
        await page.locator(HELP).click();
        await page.locator('#helpDialog').locator(CLOSE).first().click();
        assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Help reopens and closes');
        assert.deepEqual(errors, [], label + ': console errors');
        assert.deepEqual(requests, [], label + ': no external runtime requests');
        console.log('PASS ' + label);
      } catch (error) {
        await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(() => {});
        throw new Error(label + ': ' + error.message, {cause:error});
      } finally { await context.close(); }
    }
    await checkDataRegressions(browser);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
