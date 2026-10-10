const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const targets = process.argv.slice(2);
if (!targets.length) targets.push('src/index.template.html', 'sqlite-explorer.html', 'dist/index.html', 'dist/index.self-extract.html');
for (const target of targets) {
  let html = fs.readFileSync(path.resolve(root, target), 'utf8');
  const payload = html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/);
  if (payload) html = gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64')).toString('utf8');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const has = (selector, pattern) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .some(match => match[1].trim() === selector && pattern.test(match[2]));
  // CSS contracts supplement native 319x252 reproduction; they do not emulate layout.
  test(`${target}: modal locks background without replacing the fitting dialog shell`, () => {
    assert(has('html:has(dialog[open])', /overflow\s*:\s*hidden/));
    assert(has('dialog', /max-height:min\(760px,calc\(100dvh - 28px\)\)/));
    assert(has('.dialog-body', /max-height:calc\(100dvh - 102px\)/));
  });
  test(`${target}: long overview names and narrow grid tracks can shrink`, () => {
    assert(has('.view-head>div:first-child', /min-width:0/));
    assert(has('.view-head h2,.view-head p', /overflow-wrap:anywhere/));
    assert(has('.grid-2,.query-layout', /grid-template-columns:minmax\(0,1fr\)/));
    assert(has('.scale-head,.scale-row', /grid-template-columns:minmax\(0,1fr\) 64px 28px 32px 24px/));
  });
  test(`${target}: narrow or short Columns panel is viewport bounded and scrollable`, () => {
    assert.match(css, /@media\(max-width:820px\),\(max-height:480px\)/);
    assert(has('.columns-popover', /position:fixed/));
    assert(has('.columns-popover', /width:min\(300px,calc\(100vw - 24px\)\)/));
    assert(has('.columns-popover', /min\(320px,calc\(100dvh - var\(--header-height\) - 88px - env\(safe-area-inset-bottom\)\)\)/));
    assert(has('.columns-popover', /overflow:auto/));
    assert(has('.columns-popover', /max-height:max\(0px,min\(320px,calc\(100dvh/), 'extremely short height cannot invalidate the maximum');
    assert(has('.column-check span', /overflow-wrap:anywhere/));
  });
  test(`${target}: existing local-processing badge remains a shield before the label`, () => {
    const badge = html.match(/<div class="local-badge">([\s\S]*?)<\/div>/)?.[1];
    assert(badge);
    assert.match(badge, /M12 3 5 6v5c0 4\.6 2\.8 8 7 10 4\.2-2 7-5\.4 7-10V6z/);
    assert.match(badge, /m9 12 2 2 4-5/);
    assert(badge.indexOf('<svg') < badge.indexOf('data-i18n="localBadge"'));
  });
  function sortHarness(column) {
    const body = html.slice(html.indexOf('    function bindInteractiveTable(){'), html.indexOf('    function populateAnalyzeSelect(){'));
    assert(body.startsWith('    function bindInteractiveTable(){'));
    const document = { activeElement: null };
    const state = { sortColumn: '', sortDir: '', page: 8 };
    let buttons;
    const make = () => ({ dataset: { sortColumn: column }, focus() { document.activeElement = this; } });
    const context = { document, state, $$: selector => selector.includes('[data-sort-column]') ? buttons : [], renderTableData() {
      buttons = [make()]; document.activeElement = null; context.bindInteractiveTable();
    } };
    buttons = [make()]; vm.createContext(context); vm.runInContext(body, context); context.bindInteractiveTable();
    return { document, state, button: () => buttons[0] };
  }
  test(`${target}: actual sort handler retains focused header through asc/desc/source order`, () => {
    const h = sortHarness('column"[]# with spaces');
    for (const dir of ['asc', 'desc', '']) {
      const before = h.button(); before.focus(); before.onclick();
      assert.equal(h.state.sortDir, dir); assert.equal(h.state.page, 0);
      assert.notEqual(h.button(), before);
      assert.equal(h.document.activeElement, h.button(), 'replacement header keeps keyboard focus');
    }
  });
  test(`${target}: sort does not steal focus if the old header was not focused`, () => {
    const h = sortHarness('other'); h.button().onclick(); assert.equal(h.document.activeElement, null);
  });
  function menuHarness() {
    const start = html.indexOf('    function setupColumnsMenu(){');
    assert(start >= 0, 'Columns needs a dismissal lifecycle');
    const end = html.indexOf('    function renderColumnMenu(', start);
    const events = { document: {}, window: {} };
    const summary = { focus() { document.activeElement = this; } };
    const inside = {};
    const menu = { open: true, contains: node => node === inside || node === summary,
      querySelector: selector => selector === 'summary' ? summary : null };
    const document = { activeElement: inside, modalOpen: false, querySelector: selector => { assert.equal(selector, 'dialog[open]'); return document.modalOpen ? {} : null; }, addEventListener: (type, fn) => events.document[type] = fn };
    const window = { addEventListener: (type, fn) => events.window[type] = fn };
    const context = { document, window, $: selector => { assert.equal(selector, '#columnsMenu'); return menu; } };
    vm.createContext(context); vm.runInContext(html.slice(start, end) + '\nsetupColumnsMenu();', context);
    return { document, events, menu, summary, inside };
  }
  test(`${target}: Escape closes Columns and restores its summary; ordinary keys do not`, () => {
    const h = menuHarness(); let prevented = 0;
    h.events.document.keydown({ key: 'Tab', preventDefault() { prevented++; } }); assert(h.menu.open);
    h.events.document.keydown({ key: 'Escape', preventDefault() { prevented++; } });
    assert.equal(h.menu.open, false); assert.equal(h.document.activeElement, h.summary); assert.equal(prevented, 1);
    h.document.activeElement = h.inside;
    h.events.document.keydown({ key: 'Escape', preventDefault() { prevented++; } });
    assert.equal(h.document.activeElement, h.inside); assert.equal(prevented, 1);
  });
  test(`${target}: Escape belongs to an open native modal, not the underlying Columns menu`, () => {
    const h = menuHarness(); h.document.modalOpen = true; let prevented = false;
    h.events.document.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
    assert.equal(h.menu.open, true); assert.equal(h.document.activeElement, h.inside); assert.equal(prevented, false);
  });
  test(`${target}: outside click and resize close Columns without stealing focus`, () => {
    const h = menuHarness(); h.events.document.pointerdown({ target: h.inside }); assert(h.menu.open);
    h.events.document.pointerdown({ target: {} }); assert.equal(h.menu.open, false); assert.equal(h.document.activeElement, h.inside);
    h.menu.open = true; h.events.window.resize(); assert.equal(h.menu.open, false); assert.equal(h.document.activeElement, h.inside);
    assert.match(html, /\n    setupColumnsMenu\(\);/,'menu lifecycle is initialized');
  });
  function inspectorHarness() {
    const start = html.indexOf("$('#closeCellDialog').onclick=");
    const end = html.indexOf("    $('#chooseFile').onclick=", start);
    assert(start >= 0 && end > start, 'existing inspector bindings exist');
    const elements = new Map(), revoked = [], state = { cellBlobUrl: 'blob:synthetic-cell' };
    const rect = { left: 210, right: 970, top: 15.5, bottom: 284.5 };
    const $ = selector => {
      if (!elements.has(selector)) {
        const listeners = {};
        elements.set(selector, {
          open: true, closeCalls: 0, listeners,
          getBoundingClientRect: () => rect,
          addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
          dispatch(type, event) { for (const handler of listeners[type] || []) handler(event); },
          close() { this.open = false; this.closeCalls++; this.dispatch('close', {}); }
        });
      }
      return elements.get(selector);
    };
    vm.runInNewContext(html.slice(start, end), { $, state, URL: { revokeObjectURL: value => revoked.push(value) } });
    return { $, state, revoked, rect };
  }
  for (const name of ['Cell', 'Record']) {
    const selector = `#${name.toLowerCase()}Dialog`;
    test(`${target}: ${name} actual backdrop handler closes outside every edge after reopening`, () => {
      const h = inspectorHarness(), dialog = h.$(selector);
      for (const [clientX, clientY] of [[209,150],[971,150],[500,14],[500,286]]) {
        dialog.open = true;
        const before = dialog.closeCalls;
        dialog.dispatch('click', { target: dialog, clientX, clientY });
        assert.equal(dialog.closeCalls, before + 1, 'outside backdrop invokes native close');
        assert.equal(dialog.open, false);
      }
      if (name === 'Cell') {
        assert.deepEqual(h.revoked, ['blob:synthetic-cell'], 'existing close cleanup retires the preview URL once');
        assert.equal(h.state.cellBlobUrl, null);
      } else {
        assert.deepEqual(h.revoked, [], 'Record dismissal does not own the Cell preview URL');
      }
    });
    test(`${target}: ${name} inside, boundary and child keyboard clicks never dismiss`, () => {
      const h = inspectorHarness(), dialog = h.$(selector);
      for (const [clientX, clientY] of [[500,150],[210,15.5],[970,284.5]])
        dialog.dispatch('click', { target: dialog, clientX, clientY });
      dialog.dispatch('click', { target: {}, clientX: 0, clientY: 0, detail: 0 });
      assert.equal(dialog.closeCalls, 0);
      assert.equal(dialog.open, true);
      assert.deepEqual(h.revoked, []);
    });
    test(`${target}: ${name} existing Close button still invokes native close and scoped cleanup`, () => {
      const h = inspectorHarness(), dialog = h.$(selector);
      h.$(`#close${name}Dialog`).onclick();
      assert.equal(dialog.closeCalls, 1);
      assert.deepEqual(h.revoked, name === 'Cell' ? ['blob:synthetic-cell'] : []);
    });
  }
}
