/* Layout grid per page type + pad parity with EA FC 26.
   Brief docs/ui_changes/2026-11-24_layout-grid-and-pad-parity.md (Decision 2 + 3), Figma L4 · Grids v2 286:26367.
   - ONE Sub-tab Bar (Figma "Sub-tab Bar · LT RT" 285:4457): x 150, y 140, h 42, LT … RT around the tabs, the page meta line
     at x >= 900. Tabs are triggers only (tabindex -1, never D-pad stops). G6 pages put their section title in the same band.
   - ONE Prompt Bar with fixed slots per screen LEVEL (Figma "Prompt Bar · Slotted" 285:4552):
     Top (the 6 top screens, no B): A · LT RT · X · Y · R. Deep (deep pages, sub-views, popups): A · B · LT RT · X · Y · R.
     An unused button leaves its slot blank (Decision 3). Glyphs = the last input device; first load = Pad when a pad is
     connected, else Keyboard (Enter, Esc, Z C, X, Y, R).
   - Entry focus per screen (Pad parity frame 288:28804). Frames G1–G6 live in grid.css. */
'use strict';
(function () {
  const TOP = ['hub', 'matches', 'findings', 'squad', 'tactics', 'scouting'];
  // LT RT naming rule (brief §4): "Tab" for tabs and presets, "Group" on the Desk, "Slot" on Tactics
  const NOUN = { scouting: 'Group', tactics: 'Slot' };
  const page = () => (typeof S === 'object' && S ? S.page : '');
  const drill = () => typeof S === 'object' && S && S.page === 'findings' && !!(S.rule || S.match);
  // screen level: deep pages, the Coaching drill-down and the Squad compare are one level down (B shows)
  function level() {
    if (typeof S !== 'object' || !S) return 'top';
    if (!TOP.includes(S.page) || drill() || S.cmp || (S.page === 'squad' && S.mk)) return 'deep';   // round 7: Squad compare picking (mk) is Deep too
    return 'top';
  }
  const isTop = () => level() === 'top';

  function glyphMode() {
    const i = document.documentElement.dataset.input;
    if (i === 'pad') return 'pad';
    if (i === 'kb') return 'kb';
    const G = window.FC_GAMEPAD; return G && G.state && G.state.connected ? 'pad' : 'kb';
  }
  function syncGlyphMode() { const m = glyphMode(); if (document.documentElement.dataset.glyphs !== m) document.documentElement.dataset.glyphs = m; return m; }

  // ---------- Sub-tab Bar · LT RT (canonical) ----------
  // items: [{ label, href, on, n, attrs }]; o: { meta (html), right (html), label, cls }
  function stb(items, o = {}) {
    const trig = (k, kc) => `<span class="gl lt k-pad" data-gk="${k}" aria-hidden="true">${k}</span><span class="gl kc k-kb" aria-hidden="true">${kc}</span>`;
    const tabs = items.map(it => `<a${it.href ? ` href="${it.href}"` : ''} class="${it.on ? 'on' : ''}" tabindex="-1" role="tab" aria-selected="${it.on ? 'true' : 'false'}"${it.attrs || ''}>${esc(it.label)}${it.n != null ? `<i class="stb-n">${esc(String(it.n))}</i>` : ''}</a>`).join('');
    return `<nav class="stb${o.cls ? ' ' + o.cls : ''}" data-stb aria-label="${esc(o.label || 'Tabs')}" role="tablist"><div class="stb-tabs">${trig('LT', 'Z')}${tabs}${trig('RT', 'C')}</div>`
      + `${o.meta ? `<span class="stb-meta">${o.meta}</span>` : ''}${o.right ? `<span class="stb-right">${o.right}</span>` : ''}</nav>`;
  }
  // G6 (and G5 when it has a title): the section title sits in the sub-tab band
  function bandTitle(title, o = {}) {
    return `<nav class="stb stb-title" data-stb aria-label="${esc(title)}"><h1 class="stb-h">${esc(title)}</h1>${o.meta ? `<span class="stb-meta">${o.meta}</span>` : ''}</nav>`;
  }

  // ---------- Prompt Bar · Slotted ----------
  const SLOTS = { top: ['A', 'LTRT', 'X', 'Y', 'R'], deep: ['A', 'B', 'LTRT', 'X', 'Y', 'R'] };
  const KC = { A: 'Enter', B: 'Esc', X: 'X', Y: 'Y', R: 'R' };
  const ACT = { A: 'hook:A', B: 'hook:B', LTRT: 'hook:RT', X: 'hook:X', Y: 'hook:Y', R: 'hook:R' };
  function glyphHtml(k, mode, L) {
    if (mode === 'kb') return k === 'LTRT' ? '<span class="gl kc">Z</span><span class="gl kc">C</span>' : `<span class="gl kc">${KC[k] || k}</span>`;
    if (k === 'LTRT') return `<span class="gl-pair"><span class="gl tr">${esc(L('LT'))}</span><span class="gl tr">${esc(L('RT'))}</span></span>`;
    if (k === 'R') return `<span class="gl st">${esc(L('R'))}</span>`;
    return `<span class="gl c">${esc(L(k))}</span>`;
  }
  // spec: { level: 'top' | 'deep', A, B, LTRT, X, Y, R } (labels; null / '' = blank slot)
  function renderPrompts(spec, L) {
    const box = document.getElementById('prompts'); if (!box) return;
    const mode = syncGlyphMode(), lbl = L || (k => k);
    const lvl = spec && spec.level === 'deep' ? 'deep' : 'top';
    const html = `<div class="pslots lvl-${lvl}" data-level="${lvl}">` + SLOTS[lvl].map(k => {
      const v = spec ? spec[k] : null;
      return `<span class="pslot s-${k}">${v ? `<button type="button" class="prompt" data-gp-act="${ACT[k]}" data-slot="${k}">${glyphHtml(k, mode, lbl)}<span class="pl">${esc(v)}</span></button>` : ''}</span>`;
    }).join('') + '</div>';
    if (box.__sig === html && box.firstElementChild) return;
    const keep = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset.slot : null;
    box.__sig = html; box.innerHTML = html;
    if (keep) { const b = box.querySelector(`[data-slot="${keep}"]`); if (b) b.focus({ preventScroll: true }); }   // never drop a keyboard-focused prompt
  }

  // ---------- entry focus per screen (Pad parity frame 288:28804) ----------
  const vis = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const first = (root, sels) => { for (const s of sels) { const l = [...root.querySelectorAll(s)].filter(vis); if (l.length) return l[0]; } return null; };
  const ENTRY = {
    hub: r => first(r, ['.cen-card1 a, .cen-card1 button, .cen-card1 [data-href], .cen-card1 [tabindex="0"]', '.cen-pills .btn.pri', '.btn.pri']),
    matches: r => first(r, ['.g6-zone a.tile.fx', 'a.tile.fx', '.stk-panel button.stk-c']),
    findings: r => first(r, ['.fd2 .fdr.cur[data-id]', '.fd2 .fdr[data-id]', '.fd2 .fsel:not([disabled])', '.pp-card', '.gz-col1 .co-deb a.mc-row', '.gz-col1 .mc-row', '[data-grid] .mc-row', '[data-grid] a[href]']),
    squad: r => first(r, ['.dp-c:not(.empty)', '.sq-row.on', '.sq-row']),
    tactics: r => first(r, ['.pc[data-pos="ST"]', '.pc']),
    scouting: r => { if (r.querySelector('.sl2') && window.SIGN) { const s = window.SIGN.state; const el = s && s.focus ? r.querySelector(`.slr[data-id="${CSS.escape(s.focus)}"]`) : null; return el || first(r, ['.slr']); } return first(r, ['.dd-list .cen-row.on', '.dd-list .cen-row', '.yx-row', '[data-grid] a[href]']); },
    match: r => S && S.tab === 'debrief' ? first(r, ['.db-steps a.on', '.db-steps a']) : first(r, ['[data-grid] > :first-child a[href]:not([href="#"]), [data-grid] > :first-child [data-replay], [data-grid] > :first-child .mc-row', '[data-grid] a[href]:not([href="#"])']),
    player: r => first(r, ['.pf-body a.dcell', '.pf-season a.dcell', '.pf-id .yx-dev, .pf-id [class*="dev"][tabindex], .pf-id a, .pf-id button, .pf-id [tabindex="0"]', '.pf-season [tabindex="0"]', '.pf-body a, .pf-body [tabindex="0"], .pf-body select']),
    youth: r => first(r, ['.yx-dev', 'a[href]', '[tabindex="0"]']),
    prematch: r => first(r, ['.pm ol > li', '.pm a[href]']),
  };
  function entryEl(root) {
    root = root || document.getElementById('main'); if (!root) return null;
    const G0 = window.FC_GAMEPAD; if (G0 && G0.enhance) G0.enhance(root);   // rows that are D-pad stops get their tabindex first
    const f = ENTRY[page()];
    let el = null; try { el = f ? f(root) : null; } catch (_) { el = null; }
    if (el) return el;
    const G = window.FC_GAMEPAD; const pool = G && G.focusPool ? G.focusPool(root) : [];
    return pool[0] || null;
  }

  window.GRID = { TOP, NOUN, level, isTop, drill, glyphMode, syncGlyphMode, stb, bandTitle, renderPrompts, entryEl, noun: pg => (!pg && page() === 'squad' && S.mk ? 'List' : NOUN[pg || page()] || 'Tab') };   // round 7: LT RT = List while comparing
})();
