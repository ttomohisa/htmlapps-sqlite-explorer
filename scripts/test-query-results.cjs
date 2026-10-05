const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Execute the real application functions with synthetic data and small UI/IO
// doubles. No browser, real database, or network connection is used here.
const sourcePath = process.env.SQLITE_TEST_HTML || path.join(__dirname, '../src/index.template.html');
const source = fs.readFileSync(sourcePath, 'utf8');
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
    });
    return elements.get(id);
  };
  const sandbox = { document: { querySelector: $, querySelectorAll: () => [] }, Uint8Array, Intl, performance,
    console: { error() {} }, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end) +
    '\nglobalThis.api = { state, tableHtml, exportRows, resetFile, openFile, runSql, tr };', sandbox);
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
