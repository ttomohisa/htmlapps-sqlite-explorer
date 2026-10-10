const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Execute the real application functions with synthetic data and small UI/IO
// doubles. No browser, real database, or network connection is used here.
const sourcePath = process.env.SQLITE_TEST_HTML || path.join(__dirname, '../src/index.template.html');
let source = fs.readFileSync(sourcePath, 'utf8');
if (source.includes('id="self-extract-payload"')) {
  const payload = source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
  assert.ok(payload, 'Self-extract payload must exist');
  const restored = require('node:zlib').gunzipSync(Buffer.from(payload[1], 'base64'));
  assert.deepEqual(restored, fs.readFileSync(path.join(__dirname, '../dist/index.html')), 'Restored HTML must match readable build byte-for-byte');
  source = restored.toString('utf8');
}
const start = source.indexOf('    const T = {');
const end = source.indexOf("    $('#dataTableSelect').onchange=");
assert.ok(start >= 0 && end > start, 'Application function boundaries must exist');

test('application functions match the source template', () => {
  const template = fs.readFileSync(path.join(__dirname, '../src/index.template.html'), 'utf8');
  const templateStart = template.indexOf('    const T = {');
  const templateEnd = template.indexOf("    $('#dataTableSelect').onchange=");
  assert.equal(source.slice(start, end), template.slice(templateStart, templateEnd));
});

function harness(lang = 'en') {
  const elements = new Map();
  const downloads = [];
  const notices = [];
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', innerHTML: '', textContent: '', disabled: true, hidden: false,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute(name, value) { this[name] = value; },
    });
    return elements.get(id);
  };
  const sandbox = { document: { querySelector: $, querySelectorAll: () => [], documentElement: {}, addEventListener() {} },
    window: { addEventListener() {} }, localStorage: { setItem() {} }, Uint8Array, Intl, performance,
    console: { error() {} }, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end) +
    '\nglobalThis.api = { state, tableHtml, exportRows, resetFile, openFile, runSql, tr, applyLanguage };', sandbox);
  const bindingsEnd = source.indexOf("    $('#brandName').textContent=", end);
  assert.ok(bindingsEnd > end, 'Event-binding boundary must exist');
  vm.runInContext(source.slice(end, bindingsEnd), sandbox);
  sandbox.nextFrame = () => Promise.resolve();
  sandbox.ensureSql = async () => sandbox.api.state.SQL;
  sandbox.inspectDatabase = async () => {};
  sandbox.switchView = view => { sandbox.api.state.currentView = view; };
  sandbox.objectRows = () => [{ detail: 'SCAN fictional_items' }];
  sandbox.download = (name, mime, text) => downloads.push({ name, mime, text });
  sandbox.toast = text => notices.push(text);
  sandbox.api.state.lang = lang;
  return { ...sandbox.api, $, sandbox, downloads, notices };
}

function seedPreviousQuery(h) {
  let closes = 0;
  h.state.db = { close() { closes++; } };
  h.state.file = { name: 'previous.sqlite' };
  h.state.queryPage = 2;
  h.$('#queryPagination').hidden = false;
  h.$('#queryJsonWarning').hidden = false;
  h.$('#queryExportHint').hidden = false;
  h.state.lastQuery = { columns: ['item'], rows: [['fictional-old-value']] };
  h.$('#queryResults').innerHTML = 'fictional-old-value';
  h.$('#queryRows').textContent = '1 row';
  h.$('#queryTime').textContent = '2 ms';
  h.$('#queryPlan').innerHTML = 'old plan';
  h.$('#exportQueryCsv').disabled = false;
  h.$('#exportQueryJson').disabled = false;
  return () => closes;
}

function assertNoCachedQuery(h) {
  assertPagerCleared(h);
  assert.equal(h.state.lastQuery, null);
  assert.equal(h.$('#queryRows').textContent, '—');
  assert.equal(h.$('#queryTime').textContent, '—');
  assert.equal(h.$('#exportQueryCsv').disabled, true);
  assert.equal(h.$('#exportQueryJson').disabled, true);
  assert.doesNotMatch(h.$('#queryResults').innerHTML, /fictional-old-value/);
  assert.doesNotMatch(h.$('#queryPlan').innerHTML, /old plan/);
  h.exportRows('query-result', 'csv', h.state.lastQuery);
  h.exportRows('query-result', 'json', h.state.lastQuery);
  assert.equal(h.downloads.length, 0);
}

function syntheticFile(arrayBuffer) {
  const header = Uint8Array.from('SQLite format 3\0', c => c.charCodeAt(0));
  return { name: 'fictional.sqlite', size: header.length,
    arrayBuffer: arrayBuffer || (async () => header.buffer) };
}

function cellValues(html) {
  return [...html.matchAll(/<td>(?:<button[^>]*>)?<span[^>]*>(.*?)<\/span>/g)].map(m => m[1]);
}

test('distinct names retain positional values and CSV order', () => {
  const h = harness();
  const data = { columns: ['first', 'second'], rows: [[11, 22]] };
  assert.deepEqual(cellValues(h.tableHtml(data.columns, data.rows)), ['11', '22']);
  h.exportRows('query-result', 'csv', data);
  assert.equal(h.downloads[0].text, '\uFEFFfirst,second\r\n11,22');
});

test('duplicate query names keep each value and NULL aligned with CSV', () => {
  const h = harness();
  const data = { columns: ['id', 'id', 'id'], rows: [[11, 22, null], [null, 33, 44]] };
  assert.deepEqual(cellValues(h.tableHtml(data.columns, data.rows)), ['11', '22', 'NULL', 'NULL', '33', '44']);
  h.exportRows('query-result', 'csv', data);
  assert.equal(h.downloads[0].text, '\uFEFFid,id,id\r\n11,22,\r\n,33,44');
});

test('table visibility preserves original cell indexes, sorting, and row actions', () => {
  const h = harness();
  const html = h.tableHtml(['first', 'second', 'third'], [[11, 22, null]], {
    visibleColumns: new Set(['third', 'second']), interactive: true,
    recordActions: true, sortColumn: 'second', sortDir: 'desc',
  });
  assert.deepEqual(cellValues(html), ['22', 'NULL']);
  assert.match(html, /data-cell-col="1"/);
  assert.match(html, /data-cell-col="2"/);
  assert.doesNotMatch(html, /data-cell-col="0"/);
  assert.match(html, /data-sort-column="second">second<span class="sort-mark">▼/);
  assert.match(html, /data-record-row="0"/);
});

test('name-based visibility keeps all matching duplicate columns in original order', () => {
  const h = harness();
  const html = h.tableHtml(['id', 'hidden', 'id'], [[11, 99, 22]], {
    visibleColumns: new Set(['id']), interactive: true,
  });
  assert.deepEqual(cellValues(html), ['11', '22']);
  assert.match(html, /data-cell-col="0"/);
  assert.match(html, /data-cell-col="2"/);
});

for (const lang of ['en', 'ja']) test(`reset clears previous query, metrics, plan and exports (${lang})`, () => {
  const h = harness(lang);
  const closes = seedPreviousQuery(h);
  h.resetFile();
  h.resetFile();
  assert.equal(closes(), 1);
  assert.equal(h.state.db, null);
  assert.equal(h.state.file, null);
  assertNoCachedQuery(h);
  assert.ok(h.$('#queryResults').innerHTML.includes(h.tr('noResults')));
  assert.ok(h.$('#queryPlan').innerHTML.includes(h.tr('planEmpty')));
  assert.match(h.$('#queryResults').innerHTML, /data-i18n="noResults"/);
  assert.match(h.$('#queryPlan').innerHTML, /data-i18n="planEmpty"/);
  assert.equal(h.$('#workspace').hidden, true);
  assert.equal(h.$('#dropzone').hidden, false);
});

test('replacement clears old query before file reading finishes', async () => {
  const h = harness();
  const closes = seedPreviousQuery(h);
  let release;
  const bytes = new Promise(resolve => { release = resolve; });
  h.state.SQL = { Database: function () { this.close = () => {}; } };
  const file = syntheticFile(() => bytes);
  const opened = h.openFile(file);
  assertNoCachedQuery(h);
  assert.equal(closes(), 1);
  release(await syntheticFile().arrayBuffer());
  await opened;
  assertNoCachedQuery(h);
  assert.equal(h.state.file, file);
  assert.equal(h.$('#workspace').hidden, false);
  assert.equal(h.$('#loadingOverlay').hidden, true);
});

for (const failure of ['file read', 'invalid header', 'engine load', 'database open', 'database inspection']) {
  test(`failed replacement leaves no previous query or exports: ${failure}`, async () => {
    const h = harness();
    const closes = seedPreviousQuery(h);
    h.state.SQL = { Database: function () { this.close = () => {}; } };
    let file = syntheticFile();
    if (failure === 'file read') file = syntheticFile(async () => { throw new Error('File read failed'); });
    if (failure === 'invalid header') file = syntheticFile(async () => new Uint8Array(0).buffer);
    if (failure === 'engine load') h.sandbox.ensureSql = async () => { throw new Error('Engine unavailable'); };
    if (failure === 'database open') h.state.SQL.Database = function () { throw new Error('Invalid fictional database'); };
    if (failure === 'database inspection') h.sandbox.inspectDatabase = async () => { throw new Error('Inspection failed'); };
    await h.openFile(file);
    assertNoCachedQuery(h);
    assert.equal(closes(), 1);
    assert.equal(h.state.db, null);
    assert.equal(h.state.file, null);
    assert.equal(h.$('#workspace').hidden, true);
    assert.equal(h.$('#dropzone').hidden, false);
    assert.equal(h.$('#loadingOverlay').hidden, true);
    assert.equal(h.notices.length, 1);
  });
}

test('ordinary query error clears the previous result, plan, metrics and export cache', () => {
  const h = harness();
  seedPreviousQuery(h);
  h.state.db.exec = () => { throw new Error('no such table: fictional_missing'); };
  h.$('#queryEditor').value = 'SELECT * FROM fictional_missing';
  h.runSql();
  assertNoCachedQuery(h);
  assert.match(h.$('#queryResults').innerHTML, /no such table: fictional_missing/);
  assert.equal(h.$('#queryPlan').innerHTML, '');
});

test('successful query updates duplicate result cells, count, timing, plan and CSV', () => {
  const h = harness();
  const result = { columns: ['id', 'id'], values: [[11, 22]] };
  h.state.db = { exec: () => [result] };
  h.$('#queryEditor').value = 'SELECT 11 AS id, 22 AS id';
  h.runSql();
  assert.deepEqual(cellValues(h.$('#queryResults').innerHTML), ['11', '22']);
  assert.equal(h.$('#queryRows').textContent, '1 rows');
  assert.match(h.$('#queryTime').textContent, /^\d+\.\d ms$/);
  assert.match(h.$('#queryPlan').innerHTML, /SCAN fictional_items/);
  assert.equal(h.$('#exportQueryCsv').disabled, false);
  h.exportRows('query-result', 'csv', h.state.lastQuery);
  assert.equal(h.downloads[0].text, '\uFEFFid,id\r\n11,22');
});

test('empty table data can render and export its known column headers', () => {
  const h = harness();
  // execRows (table browsing) obtains column names before stepping any rows.
  const data = { columns: ['id'], rows: [] };
  assert.match(h.tableHtml(data.columns, data.rows), /<th>id<\/th>/);
  assert.deepEqual(cellValues(h.tableHtml(data.columns, data.rows)), []);
  h.exportRows('empty-table', 'csv', data);
  assert.equal(h.downloads[0].text, '\uFEFFid');
});

test('zero-row SQL result disables exports and replaces old rows', () => {
  const h = harness();
  seedPreviousQuery(h);
  h.state.db.exec = () => [];
  // sql.js exec returns [] when a SELECT steps no rows.
  h.$('#queryEditor').value = 'SELECT 1 AS id WHERE 0';
  h.runSql();
  assert.equal(h.$('#queryRows').textContent, '0 rows');
  assert.equal(h.$('#exportQueryCsv').disabled, true);
  assert.equal(h.$('#exportQueryJson').disabled, true);
  assert.doesNotMatch(h.$('#queryResults').innerHTML, /fictional-old-value/);
  h.exportRows('query-result', 'csv', h.state.lastQuery);
  assert.equal(h.downloads.length, 0);
});

function runSyntheticQuery(h, count, columns = ['n']) {
  const rows = Array.from({ length: count }, (_, i) => columns.map((_, c) => i + 1 + c));
  let calls = 0;
  h.state.db = { exec() { calls++; return count ? [{ columns, values: rows }] : []; }, close() {} };
  h.$('#queryEditor').value = 'SELECT n FROM fictional_items';
  h.runSql();
  return { rows, calls: () => calls };
}

function assertPagerCleared(h) {
  assert.equal(h.state.queryPage, 0);
  assert.equal(h.$('#queryPagination').hidden, true);
  assert.equal(h.$('#queryPageInfo').textContent, '');
  assert.equal(h.$('#queryPrevPage').disabled, true);
  assert.equal(h.$('#queryNextPage').disabled, true);
  assert.equal(h.$('#queryExportHint').hidden, true);
  assert.equal(h.$('#queryJsonWarning').hidden, true);
}

test('SQL pager and export notices have native, localized, accessible markup', () => {
  assert.match(source, /id="queryPagination"[^>]*hidden/);
  assert.match(source, /#queryPagination\[hidden\]\{display:none\}/);
  assert.match(source, /id="queryPageInfo"[^>]*role="status"/);
  for (const [id, key] of [['queryPrevPage', 'previous'], ['queryNextPage', 'next']]) {
    assert.match(source, new RegExp(`<button[^>]*id="${id}"[^>]*type="button"[^>]*data-i18n="${key}"[^>]*disabled`));
  }
  assert.match(source, /id="exportQueryJson"[^>]*aria-describedby="queryJsonWarning"/);
  assert.match(source, /id="queryJsonWarning"[^>]*data-i18n="duplicateQueryColumns"[^>]*hidden/);
  assert.match(source, /id="queryExportHint"[^>]*data-i18n="queryExportAll"[^>]*hidden/);
});

for (const count of [0, 1, 99, 100, 101, 205]) test(`SQL result pager handles ${count} rows`, () => {
  const h = harness();
  runSyntheticQuery(h, count);
  assert.equal(cellValues(h.$('#queryResults').innerHTML).length, Math.min(count, 100));
  assert.equal(h.state.queryPage, 0);
  assert.equal(h.state.lastQuery.rows.length, count);
  assert.equal(h.$('#queryPagination').hidden, count === 0);
  assert.equal(h.$('#queryPageInfo').textContent, count ? `1–${Math.min(count, 100)} / ${count}` : '');
  assert.equal(h.$('#queryPrevPage').disabled, true);
  assert.equal(h.$('#queryNextPage').disabled, count <= 100);
  assert.equal(h.$('#queryExportHint').hidden, count === 0);
});

test('205 cached rows page 100/100/5 without new SQL or table state changes', () => {
  const h = harness();
  h.state.page = 7;
  h.state.pageSize = 25;
  const query = runSyntheticQuery(h, 205);
  h.state.db.prepare = () => { throw new Error('Pagination must not prepare SQL'); };
  h.sandbox.objectRows = () => { throw new Error('Pagination must not refresh the plan'); };
  const timing = h.$('#queryTime').textContent;
  const plan = h.$('#queryPlan').innerHTML;
  const seen = [...cellValues(h.$('#queryResults').innerHTML)];
  assert.equal(seen.length, 100);
  h.$('#queryNextPage').onclick();
  assert.equal(h.$('#queryPageInfo').textContent, '101–200 / 205');
  seen.push(...cellValues(h.$('#queryResults').innerHTML));
  h.$('#queryNextPage').onclick();
  assert.equal(h.$('#queryPageInfo').textContent, '201–205 / 205');
  assert.equal(h.$('#queryNextPage').disabled, true);
  seen.push(...cellValues(h.$('#queryResults').innerHTML));
  assert.deepEqual(seen, Array.from({ length: 205 }, (_, i) => String(i + 1)));
  h.$('#queryNextPage').onclick();
  assert.equal(h.state.queryPage, 2);
  h.$('#queryPrevPage').onclick();
  assert.equal(h.$('#queryPageInfo').textContent, '101–200 / 205');
  h.$('#queryPrevPage').onclick();
  h.$('#queryPrevPage').onclick();
  assert.equal(h.state.queryPage, 0);
  assert.equal(h.$('#queryPrevPage').disabled, true);
  assert.equal(query.calls(), 1);
  assert.equal(h.$('#queryRows').textContent, '205 rows');
  assert.equal(h.$('#queryTime').textContent, timing);
  assert.equal(h.$('#queryPlan').innerHTML, plan);
  assert.equal(h.state.page, 7);
  assert.equal(h.state.pageSize, 25);
});

test('CSV and JSON controls export all rows while viewing the second SQL page', () => {
  const h = harness();
  runSyntheticQuery(h, 205);
  assert.equal(typeof h.$('#queryNextPage').onclick, 'function');
  h.$('#queryNextPage').onclick();
  h.$('#exportQueryCsv').onclick();
  h.$('#exportQueryJson').onclick();
  assert.equal(h.downloads[0].text, '\uFEFFn\r\n' + Array.from({ length: 205 }, (_, i) => i + 1).join('\r\n'));
  assert.deepEqual(JSON.parse(h.downloads[1].text), Array.from({ length: 205 }, (_, i) => ({ n: i + 1 })));
});

test('each successful query starts on page one, including short and repeated results', () => {
  const h = harness();
  for (const count of [205, 205, 1, 100, 0]) {
    h.state.queryPage = 2;
    runSyntheticQuery(h, count);
    assert.equal(h.state.queryPage, 0);
    assert.equal(h.$('#queryPageInfo').textContent, count ? `1–${Math.min(100, count)} / ${count}` : '');
  }
});

test('query execution invalidates the previous page before accessing SQLite', () => {
  const h = harness();
  seedPreviousQuery(h);
  h.state.queryPage = 2;
  h.state.db.exec = () => { assertNoCachedQuery(h); assertPagerCleared(h); return []; };
  h.$('#queryEditor').value = 'SELECT 1 WHERE 0';
  h.runSql();
  assert.equal(h.$('#queryRows').textContent, '0 rows');
});

for (const kind of ['ordinary error', 'blocked SQL', 'reset']) test(`${kind} clears the SQL pager and retained pager callbacks stay inert`, () => {
  const h = harness();
  runSyntheticQuery(h, 205);
  assert.equal(typeof h.$('#queryNextPage').onclick, 'function');
  const next = h.$('#queryNextPage').onclick;
  next();
  if (kind === 'reset') h.resetFile();
  else {
    h.$('#queryEditor').value = kind === 'blocked SQL' ? 'DELETE FROM fictional_items' : 'SELECT missing';
    h.state.db.exec = () => { throw new Error('missing'); };
    h.runSql();
  }
  assertPagerCleared(h);
  const before = h.$('#queryResults').innerHTML;
  next();
  h.$('#queryPrevPage').onclick();
  assertPagerCleared(h);
  assert.equal(h.$('#queryResults').innerHTML, before);
});

for (const lang of ['en', 'ja']) test(`duplicate names disable JSON with an actionable explanation (${lang})`, () => {
  const h = harness(lang);
  h.state.db = { exec: () => [{ columns: ['id', 'id', 'id_2'], values: [[11, 22, null]] }] };
  h.$('#queryEditor').value = 'SELECT 11 AS id, 22 AS id, NULL AS id_2';
  h.runSql();
  assert.equal(h.$('#exportQueryJson').disabled, true);
  assert.equal(h.$('#exportQueryCsv').disabled, false);
  assert.equal(h.$('#queryJsonWarning').hidden, false);
  assert.match(h.$('#queryJsonWarning').textContent, /AS/);
  assert.match(h.$('#queryJsonWarning').textContent, /CSV/);
  assert.equal(h.$('#queryJsonWarning').textContent, h.tr('duplicateQueryColumns'));
  if (lang === 'ja') assert.match(h.$('#queryJsonWarning').textContent, /列名/);
  else assert.match(h.$('#queryJsonWarning').textContent, /duplicate column names/i);
  assert.deepEqual(cellValues(h.$('#queryResults').innerHTML), ['11', '22', 'NULL']);
  h.$('#exportQueryCsv').onclick();
  assert.equal(h.downloads[0].text, '\uFEFFid,id,id_2\r\n11,22,');
  h.$('#exportQueryJson').onclick();
  assert.equal(h.downloads.length, 1);
  assert.equal(h.notices.at(-1), h.tr('duplicateQueryColumns'));
  runSyntheticQuery(h, 1, ['id', 'ID', 'id_2']);
  assert.equal(h.$('#exportQueryJson').disabled, false);
  assert.equal(h.$('#queryJsonWarning').hidden, true);
});

for (const columns of [['id', 'id'], ['', ''], ['__proto__', '__proto__'], ['<script>', '<script>']]) test(`direct JSON handler rejects duplicate names ${JSON.stringify(columns)}`, () => {
  const h = harness();
  h.exportRows('query-result', 'json', { columns, rows: [[11, 22]] });
  assert.equal(h.downloads.length, 0);
  assert.equal(h.notices.at(-1), h.tr('duplicateQueryColumns'));
});

test('unique JSON names preserve the object-array schema and all existing value formats', () => {
  const h = harness();
  const columns = ['id', 'ID', 'id_2', '', '__proto__', 'constructor', '<script>'];
  const row = [11, 22, null, 'line\nbreak "quoted"', new Uint8Array([1, 2]), 'value', 0];
  h.exportRows('query-result', 'json', { columns, rows: [row] });
  assert.deepEqual(JSON.parse(h.downloads[0].text), [Object.fromEntries(columns.map((name, i) => [name, i === 4 ? '<BLOB 2 bytes>' : row[i]]))]);
});

test('language changes refresh SQL messages while retaining cached data, page, timing, and plan', () => {
  const h = harness();
  const query = runSyntheticQuery(h, 205, ['id', 'id']);
  assert.equal(typeof h.$('#queryNextPage').onclick, 'function');
  h.$('#queryNextPage').onclick();
  for (const name of ['renderOverview', 'renderRelations', 'renderHealth', 'populateErdFocus']) h.sandbox[name] = () => {};
  const cached = h.state.lastQuery, timing = h.$('#queryTime').textContent, plan = h.$('#queryPlan').innerHTML;
  for (const lang of ['ja', 'en']) {
    h.applyLanguage(lang);
    assert.equal(h.state.lastQuery, cached);
    assert.equal(h.state.queryPage, 1);
    assert.equal(h.$('#queryPageInfo').textContent, '101–200 / 205');
    assert.equal(h.$('#queryJsonWarning').textContent, h.tr('duplicateQueryColumns'));
    assert.equal(h.$('#queryExportHint').textContent, h.tr('queryExportAll'));
    assert.equal(h.$('#queryTime').textContent, timing);
    assert.equal(h.$('#queryPlan').innerHTML, plan);
  }
  assert.equal(query.calls(), 1);
});

test('large result range uses exact total counts rather than compact rounded notation', () => {
  const h = harness();
  runSyntheticQuery(h, 100001);
  assert.equal(h.$('#queryPageInfo').textContent, '1–100 / 100,001');
});
