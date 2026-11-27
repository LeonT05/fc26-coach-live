// ---------- Navigation model (QA P-5 / SH-5; brief 2026-11-24_layout-grid-and-pad-parity): ROUTE vs VIEW STATE ----------
// ROUTE = page + id + day (+ anything not listed below): a real navigation. It pushes a history entry, plays the page slide
//         and starts at the entry focus; Back (pop) and LB RB return restore the focus and scroll that route had.
// VIEW STATE = selection / sort / preset / open decision / card page / compare / phase AND every sub-tab (tab, preset, grp,
//         ptab, slot): history.replaceState (no new entry), no slide, the frame never moves. A sub-tab switch (LT RT, Z C, a
//         click on the Sub-tab Bar) keeps a memory per sub-tab: its last URL, focused item and inner scroll (Pad parity 288:28804).
// Back (B / Esc) = closes the top popup / overlay / compare first; on the six top screens it then does NOTHING (Decision 2);
//         on a deep page or a drill-down it goes one level up: history.back() to the opener (focus restored) or the logical parent.
(function () {
  const VIEW = new Set([
    'sel', 'sort', 'dir', 'd', 'df', 'dc', 'card', 'preset', 'all', 'grp', 'view', 'tab',
    'cmp', 'cmpgrp', 'cgrp', 'cavg',
    'step', 'ptab', 'slot', 'tslot', 'tphase', 'src', 'vs', 'm', 'snap', 'win', 'chain', 'phase', 'mode',
    'player', 'fteam', 'fout', 'fthird', 'flane', 'fctr', 'lvl',
    ...((window.NAVSTATE && window.NAVSTATE.VIEW) ? window.NAVSTATE.VIEW : []),
  ]);
  const routeOf = h => {
    const p = new URLSearchParams(String(h || '').replace(/^#/, ''));
    VIEW.forEach(k => p.delete(k));
    if (!p.get('page')) p.set('page', 'hub');
    p.sort();
    return p.toString();
  };
  const normHash = h => {
    const p = new URLSearchParams(String(h || '').replace(/^#/, ''));
    if (!p.get('page')) p.set('page', 'hub');
    p.sort();
    return p.toString();
  };
  const pageOf = h => new URLSearchParams(String(h || '').replace(/^#/, '')).get('page') || 'hub';
  const TOP = ['hub', 'matches', 'findings', 'squad', 'tactics', 'scouting'];

  let depth = 0;                 // app-internal history entries we pushed (Back uses history.back() while > 0)
  let curHash = location.hash;
  const stack = [routeOf(location.hash)];
  const MEM = new Map();         // route|active sub-tab -> { hash, scroll: [[key, top]], focus: desc, main }
  const LAST = {};               // top page -> its last hash (LB RB return restores its last tab, row and scroll)
  let pending = null;            // what to do after the next route render: 'restore' | 'entry'

  const mainEl = () => document.getElementById('main');

  function activeDialog() {
    const rp = document.querySelector('.rp2:not(.out)');
    if (rp) return rp;
    const mc = document.querySelector('.mc-pop:not([hidden])');
    if (mc) return mc;
    const dlg = document.querySelector('[role="dialog"]:not([hidden]):not(#overlay):not(.rp2)');
    if (dlg && dlg.offsetParent !== null) return dlg;
    const pop = document.querySelector('.modal.on, .popup.on, .popover.on');
    return pop || null;
  }

  function logicalParentHash() {
    if (typeof S !== 'object' || !S) return null;
    if (S.page === 'findings' && S.rule && S.match) return href({ page: 'findings', tab: 'findings', rule: S.rule });
    if (S.page === 'findings' && (S.rule || S.match)) return href({ page: 'findings', tab: 'findings' });
    const parent = (typeof PARENT === 'object' && PARENT[S.page]) || (S.page === 'prematch' ? 'hub' : S.page === 'youth' ? 'scouting' : null);
    return parent ? (LAST[parent] || href({ page: parent })) : null;
  }
  const onTopScreen = () => typeof S === 'object' && S && TOP.includes(S.page) && !(S.page === 'findings' && (S.rule || S.match)) && !S.cmp;

  function hasBackTarget() {
    if (typeof ovOpen === 'function' && ovOpen()) return true;
    if (activeDialog()) return true;
    if (typeof S === 'object' && S && S.cmp) return true;
    if (onTopScreen()) return false;
    if (depth > 0) return true;
    return !!logicalParentHash();
  }

  // ---------- focus + scroll memory ----------
  const SKIPCLS = /^(gp-focus|gp-press|on|sel|focus|hov|open|tipc)$/;
  function descOf(el) {
    const main = mainEl();
    if (!main || !el || el === document.body || !main.contains(el)) return null;
    const cls = [...el.classList].filter(c => !SKIPCLS.test(c))[0] || '';
    const sel = el.tagName.toLowerCase() + (cls ? '.' + CSS.escape(cls) : '');
    const data = {};
    for (const k of ['name', 'i', 'id', 'n', 'pos', 'k', 'sub', 'slot', 'card', 'view', 'sort', 'tier', 'tg', 'act', 'half', 'replay', 'add', 'href', 'cmp', 'step']) if (el.dataset[k] != null) data[k] = el.dataset[k];
    return { sel, idx: [...main.querySelectorAll(sel)].indexOf(el), href: el.getAttribute('href'), data, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48) };
  }
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && !el.closest('[hidden]'); };
  function findDesc(d) {
    const main = mainEl(); if (!main || !d) return null;
    const G = window.FC_GAMEPAD; if (G && G.enhance) G.enhance(main);   // rows that are D-pad stops get their tabindex first
    const same = [...main.querySelectorAll(d.sel)].filter(e => shown(e) && !e.closest('[data-stb]'));   // a sub-tab is never a focus target
    const keys = Object.keys(d.data || {});
    let hit = keys.length ? same.find(e => keys.every(k => e.dataset[k] === d.data[k])) : null;
    if (!hit && d.href && d.href.length > 1 && d.href[0] === '#') hit = same.find(e => (e.getAttribute('href') || '')[0] === '#' && normHash(e.getAttribute('href')) === normHash(d.href));
    if (!hit && d.text) hit = same.find(e => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48) === d.text);
    if (!hit && d.idx >= 0 && same.length) hit = same[Math.min(d.idx, same.length - 1)];
    return hit || null;
  }
  const selOf = el => { const cls = [...el.classList].filter(c => !SKIPCLS.test(c))[0] || ''; return el.tagName.toLowerCase() + (cls ? '.' + CSS.escape(cls) : ''); };
  function scrollers() { const main = mainEl(); return main ? [...main.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollTop > 0) : []; }
  function keyed(L) { const n = {}; return L.map(e => { const s = selOf(e); n[s] = (n[s] || 0) + 1; return [s + '@' + (n[s] - 1), e]; }); }
  function collectScroll() { return keyed(scrollers()).filter(([, e]) => e.scrollTop > 0).map(([k, e]) => [k, e.scrollTop]); }
  function applyScroll(list) {
    const K = keyed(scrollers()), byKey = new Map(K);
    K.forEach(([, e]) => { if (e.scrollTop) e.scrollTop = 0; });
    (list || []).forEach(([k, v]) => { const e = byKey.get(k); if (e) e.scrollTop = v; });
  }
  // the active sub-tab of the page on show (index in the Sub-tab Bar; Tactics keeps its own per-slot memory)
  function activeTabIdx() { const main = mainEl(); const bar = main && main.querySelector('[data-stb]'); if (!bar) return -1; return [...bar.querySelectorAll('a')].findIndex(a => a.classList.contains('on')); }
  const memKey = (h, idx) => routeOf(h) + '|' + (idx == null ? activeTabIdx() : idx);
  function saveMem(h) {
    const main = mainEl(); if (!main || !main.querySelector('.page')) return;
    let a = document.activeElement; if (!(a && main.contains(a))) a = null;
    // G1 (Pad parity: "per tab / group: row + scroll"): focus in the inspector is remembered as the list row on show
    const insp = a && a.closest('[data-grid="g1"] > :last-child');
    if (insp) { const on = insp.parentElement.querySelector('.sq-row.on, .cen-row.on, .slr.on, .fdr.cur'); if (on) a = on; }
    MEM.set(memKey(h), { hash: h, scroll: collectScroll(), focus: a ? descOf(a) : null, main: main.scrollTop });
    const pg = pageOf(h); if (TOP.includes(pg)) LAST[pg] = h;
  }
  function focusEl(el) {
    if (!el || typeof el.focus !== 'function') return false;
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    if (window.FC && window.FC.gamepad && typeof window.FC.gamepad.syncFocus === 'function') window.FC.gamepad.syncFocus();
    return true;
  }
  function entryFocus() {
    if (document.querySelector('.overlay.on, .rp2:not(.out), .mc-pop:not([hidden]), .pk-modal')) return;
    const el = window.GRID ? window.GRID.entryEl() : null;
    if (el) focusEl(el);
  }
  function restoreMem(m) {
    if (!m) return false;
    const main = mainEl(); if (main) main.scrollTop = m.main || 0;
    applyScroll(m.scroll);
    const el = m.focus ? findDesc(m.focus) : null;
    if (!(el && focusEl(el) && document.activeElement === el)) entryFocus();
    applyScroll(m.scroll);
    // late layout (line fitting, lazy faces) can change a scroller's height in the next frame: apply once more, never against the user
    const again = () => { const K = new Map(keyed(scrollers())); (m.scroll || []).forEach(([k, v]) => { const e = K.get(k); if (e && e.scrollTop !== v && Math.abs(e.scrollTop - v) <= 12) e.scrollTop = v; }); };
    requestAnimationFrame(() => requestAnimationFrame(again));
    return true;
  }

  window.NAVSTATE = {
    routeOf,
    VIEW,
    isViewChange: (a, b) => routeOf(a) === routeOf(b),
    canBack: () => depth > 0,
    hasBackTarget,
    activeDialog,
    onTopScreen,
    switchTab,
    lastHash: pg => LAST[pg] || null,
    mem: MEM,
    descOf, findDesc, entryFocus,
    setPending: v => { pending = v; },
    get depth() { return depth; },
  };
  window.FC = window.FC || {};
  window.FC.navstate = window.NAVSTATE;

  // view-state links & selects: replace instead of push, preserving scroll and focus; a Sub-tab Bar tab = a sub-tab switch
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest('a[href^="#"]'); if (!a || a.target) return;
    const h = a.getAttribute('href'); if (!h || h === '#') return;
    if (routeOf(h) === routeOf(location.hash) && h !== location.hash) {
      e.preventDefault();
      const bar = a.closest('[data-stb]');
      if (bar) switchTab(h, [...bar.querySelectorAll('a')].indexOf(a)); else setView(h);
    }
  }, true);

  document.addEventListener('change', e => {
    const s = e.target && e.target.closest ? e.target.closest('select[data-param]') : null;
    if (!s || typeof S !== 'object' || typeof href !== 'function') return;
    const next = Object.assign({}, S, {
      [s.dataset.param]: s.value || null,
      ...(s.dataset.reset ? Object.fromEntries(s.dataset.reset.split(',').map(k => [k, null])) : {}),
    });
    const h = href(next);
    if (routeOf(h) === routeOf(location.hash) && h !== location.hash) {
      e.stopImmediatePropagation();
      setView(h);
    }
  }, true);

  // LT RT / Z C / a click on the Sub-tab Bar: the target tab's own memory (URL, focus, scroll) or its entry focus
  function switchTab(h, idx) {
    if (!String(h || '').startsWith('#')) h = '#' + String(h || '');
    const m = idx != null && idx >= 0 ? MEM.get(memKey(h, idx)) : null;
    return setView(m && routeOf(m.hash) === routeOf(h) ? m.hash : h, { tab: true });
  }

  function setView(h, opts = {}) {
    if (!String(h || '').startsWith('#')) h = '#' + String(h || '');
    const before = location.hash, idx0 = activeTabIdx();
    const sc = collectScroll(), main0 = mainEl() ? mainEl().scrollTop : 0;
    const a0 = document.activeElement, fdesc = a0 && mainEl() && mainEl().contains(a0) ? descOf(a0) : null;
    if (idx0 >= 0 || opts.tab) saveMem(before);
    try { history.replaceState(history.state, '', location.href.split('#')[0] + h); } catch (err) { location.replace(h); return Promise.resolve(); }
    curHash = h; window.__viewRender = true;
    return Promise.resolve(render()).then(() => {
      window.__viewRender = false;
      const idx1 = activeTabIdx();
      if (TOP.includes(pageOf(h))) LAST[pageOf(h)] = location.hash;
      if (idx1 !== idx0) {   // another sub-tab: its own memory, or its entry focus (scroll at the top)
        const m = MEM.get(memKey(location.hash, idx1));
        if (m && normHash(m.hash) === normHash(location.hash)) restoreMem(m);
        else { applyScroll([]); entryFocus(); }
      } else {               // same sub-tab (selection, sort, compare …): nothing moves
        const main = mainEl(); if (main) main.scrollTop = main0;
        applyScroll(sc);
        const cur = document.activeElement;
        if (!(cur && cur !== document.body && cur.isConnected && mainEl() && mainEl().contains(cur))) {
          const el = fdesc ? findDesc(fdesc) : null; if (el) focusEl(el); else entryFocus();
          applyScroll(sc);
        }
      }
      try { if (typeof prompts === 'function') prompts(); } catch (_) { /* */ }
    });
  }
  window.setView = setView;

  // real route change: push (default hash behaviour); remember where we were; after the render restore (Back, LB RB return)
  addEventListener('hashchange', () => {
    if (!/page=match\b/.test(location.hash)) document.querySelectorAll('body > .mc-pop').forEach(x => x.remove());
    const prev = curHash; curHash = location.hash;
    if (routeOf(prev) === routeOf(curHash)) return;
    saveMem(prev);
    const r = routeOf(curHash);
    const pop = stack.length > 1 && stack[stack.length - 2] === r;
    if (pop) stack.pop(); else stack.push(r);
    depth = stack.length - 1;
    if (!pending) pending = pop ? 'restore' : 'entry';
  }, true);

  // after every render of a new route: the slide plays once; focus = memory (pop / LB RB return) or the entry focus
  document.addEventListener('fc:rendered', e => {
    if (!e.detail || !e.detail.routeChanged || window.__viewRender) return;
    if (window.enforceMinTextNow) window.enforceMinTextNow();
    const mode = pending || 'entry'; pending = null;
    const pg = pageOf(location.hash); if (TOP.includes(pg)) LAST[pg] = location.hash;
    const main = mainEl(); if (main) main.scrollTop = 0;
    const m = mode === 'restore' ? MEM.get(memKey(location.hash)) : null;
    if (m && normHash(m.hash) === normHash(location.hash)) restoreMem(m);
    else { const a = document.activeElement; if (!(a && a !== document.body && main && main.contains(a))) entryFocus(); }
    try { if (typeof prompts === 'function') prompts(); } catch (_) { /* */ }
  });

  // Back: close the innermost modal / overlay / compare first; nothing on a top screen; one level up on a deep page
  window.goBackApp = function () {
    if (typeof ovOpen === 'function' && ovOpen()) return closeOverlay();
    if (typeof RP2 === 'object' && RP2 && RP2.state && typeof RP2.close === 'function') {
      RP2.close();
      return;
    }
    const dlg = activeDialog();
    if (dlg) {
      const closeBtn = dlg.querySelector('[data-close], .mc-x, .rp2-x, .rp2-close, .close');
      if (closeBtn) { closeBtn.click(); return; }
      const prevInput = document.documentElement.dataset.input;
      const ev1 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      const ev2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      ev1.__gp = true; ev2.__gp = true;
      dispatchEvent(ev1); document.dispatchEvent(ev2);
      if (prevInput === 'pad') {
        document.documentElement.dataset.input = 'pad';
        try { if (typeof prompts === 'function') prompts(); } catch (_) { /* */ }
      }
      return;
    }
    const openPop = document.querySelector('details.pop[open], details.info-pop[open], [data-popover].on');
    if (openPop) {
      if (openPop.tagName === 'DETAILS') openPop.open = false;
      else openPop.classList.remove('on');
      return;
    }
    if (typeof S === 'object' && S && S.cmp) { setView(href({ ...S, cmp: null, cmpgrp: null })); return; }
    if (onTopScreen()) return;                       // Decision 2: B does nothing on a top screen
    if (depth > 0) { history.back(); return; }        // the opener (its focus and scroll come back on the pop)
    const parentHref = logicalParentHash();
    if (parentHref) {
      saveMem(location.hash);
      pending = 'restore';
      try { history.replaceState(null, '', location.href.split('#')[0] + parentHref); } catch (e) { /* */ }
      curHash = parentHref;
      stack[0] = routeOf(parentHref);
      Promise.resolve(render());
    }
  };
})();

// Minimum effective text size: the stage scales with the window, text never goes below the floor (15 / 14 / 13 px).
(function () {
  const floor = () => innerWidth >= 1800 ? 15 : innerWidth >= 1500 ? 14 : 13;
  let queued = false;
  function enforce() { queued = false; const min = floor();
    for (const root of [document.querySelector('.top'), document.getElementById('main'), document.querySelector('.prompts'), ...document.querySelectorAll('body > .mc-pop, .rp2, #overlay, #pmToast')]) {
      if (!root) continue;
      for (const el of root.querySelectorAll('*')) {
        if (el.dataset.fs0 !== undefined) { el.style.removeProperty('font-size'); delete el.dataset.fs0; }
        if (el.closest('[data-nomin]')) continue;   // drawings sized in SVG user units (Patterns pitch, Tactics board)
        let has = false; for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { has = true; break; }
        if (!has) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs && fs < min) { el.dataset.fs0 = ''; el.style.setProperty('font-size', min + 'px', 'important'); } } } }
  // Grid brief §8: the floor is applied BEFORE the first paint of a new view (a microtask), so no text grows after it is shown
  // (that late grow was the 3-4 px layout shift per Desk group and the profile's form line). The replay popup keeps the 30 ms
  // throttle (it redraws every frame). setTimeout, not rAF: rAF can be paused in background tabs.
  const q = () => { if (queued) return; queued = true; if (document.querySelector('.rp2:not(.out)')) setTimeout(enforce, 30); else queueMicrotask(enforce); };
  window.enforceMinText = q;
  window.enforceMinTextNow = () => { queued = true; enforce(); };
  document.addEventListener('fc:rendered', () => { queued = true; enforce(); });
  addEventListener('resize', q);
  new MutationObserver(q).observe(document.documentElement, { childList: true, subtree: true });
})();
