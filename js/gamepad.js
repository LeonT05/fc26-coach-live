/* Full EA FC 26 controller & spatial navigation support (W3C Gamepad API: Xbox, PlayStation DualSense/DualShock, generic XInput).
   Integrates non-invasively with shell.js, core.js, navstate.js, replay2.js, #prompts, #overlay, and .focusable.
   Exposes window.FC.gamepad / window.FC_GAMEPAD for diagnostics and automated testing. */
'use strict';

(function () {
  // Search category bar (LT/RT): ON since Leon's OK (step 6, 24 Nov; Figma Search Overlay 225:2338). shell.js openSearch draws it.
  const QS_CATEGORY_BAR = true;
  const STICK_DZ = 0.28;
  const STICK_REL = 0.18;
  const RS_DZ = 0.18;
  const TRIG_ON = 0.55;
  const TRIG_OFF = 0.35;
  const REPEAT_DELAY_MS = 270;
  const REPEAT_SLOW_MS = 115;
  const REPEAT_FAST_MS = 72;
  const PREVIEW_DEBOUNCE_MS = 90;

  const GLYPHS = {
    xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', L: 'L', R: 'R', R3: 'R3', VIEW: 'VIEW', MENU: 'MENU' },
    ps: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', L: 'L', R: 'R', R3: 'R3', VIEW: 'SHARE', MENU: 'OPT' },
  };

  const FOCUS_SEL = [
    'a[href]:not([href="#"])',
    'a[data-replay]',
    'button:not([disabled])',
    'select:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'textarea:not([disabled])',
    'summary',
    '[data-href]',
    '[data-replay]',
    '[role="button"]:not([aria-disabled="true"])',
    '[role="tab"]:not([aria-disabled="true"])',
    '.focusable:not([disabled])',
    '.xh',
    '.vcard',
    '.check li',
    '[tabindex="0"]',
  ].join(', ');

  // grid brief (audit §4 #8, no dead ends): the info rows of the Coaching / Match Centre panels and the Pre-match lines are D-pad stops
  const AUTO_TABINDEX_SEL = '.focusable, [data-href]:not(a):not(button), [data-replay]:not(a):not(button), [role="button"]:not(a):not(button), [role="tab"]:not(a):not(button), .xh, .vcard, .check li, #main .mc-pan div.mc-row, #main .mc-mom li, #main .pm ol > li';

  const origPrompts = typeof window.prompts === 'function' ? window.prompts : null;

  let _mockPads = null;
  let _rafId = 0;
  let _lastTs = 0;
  let _previewTimer = 0;
  let _toastTimer = 0;
  let _focusedEl = null;
  let _qsCategory = 'all';
  let _lastPadPromptsSig = '';

  // Per-pad previous button states: padIndex -> boolean[17]
  const _padBtns = new Map();
  // Directional repeat state
  const _dirState = { dir: null, since: 0, lastStep: 0, count: 0 };
  // Right-stick horizontal discrete flick state
  const _rsFlick = { dir: 0, lastAt: 0 };

  const state = {
    connected: false,
    padsCount: 0,
    activePadIndex: -1,
    activePadId: '',
    layout: 'xbox',
    mode: document.documentElement.dataset.input || '',
    lastAction: '',
  };

  // ---------- Page pad hooks (round-2 briefs: Squad compare / picker, Transfers Desk, Patterns, Tactics) ----------
  // A page or a page modal registers window.PAD_HOOKS[name] = { z, active(), press(name) -> handled?, prompts() -> [[key, label], ...],
  // scrollTarget() }. Names: A B X Y LT RT R UP DOWN LEFT RIGHT; prompt keys: A B X Y LTRT R RS (right stick). The highest z among
  // the active hooks wins; what it does not handle falls through to the global map (B Back, Y Search, LB/RB screens).
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  function padHook() {
    // the system modals (search overlay, replay popup, All match facts) keep their own maps
    if ((typeof ovOpen === 'function' && ovOpen()) || document.querySelector('.rp2:not(.out), .mc-pop:not([hidden])')) return null;
    let best = null;
    for (const h of Object.values(window.PAD_HOOKS)) {
      try { if (h && h.active && h.active() && (!best || (h.z || 0) > (best.z || 0))) best = h; } catch (_) { /* */ }
    }
    return best;
  }
  function hookPress(name) {
    const h = padHook();
    if (!h || !h.press) return false;
    let done = false;
    try { done = !!h.press(name); } catch (e) { if (window.__errors) window.__errors.push(String(e && e.stack || e)); }
    if (done) { try { renderPadPromptsSafe(); } catch (_) { /* */ } }
    return done;
  }
  function hookPrompts() {
    const h = padHook();
    if (!h || !h.prompts) return null;
    try { return h.prompts() || null; } catch (_) { return null; }
  }
  const HOOK_KEYS = { Enter: 'A', Escape: 'B', Backspace: 'B', x: 'X', X: 'X', y: 'Y', Y: 'Y', z: 'LT', Z: 'LT', c: 'RT', C: 'RT', r: 'R', R: 'R' };
  // Keyboard = the pad stand-in: the same hook gets Enter / Esc / X / Y / Z / C / R first (arrows reach it through spatial())
  window.addEventListener('keydown', e => {
    if (e.__gp || e.ctrlKey || e.metaKey || e.altKey || e.repeat && /^[xyzcrXYZCR]$/.test(e.key)) return;
    if (/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '') && e.key !== 'Escape') return;
    const name = HOOK_KEYS[e.key];
    if (!name || !padHook()) return;
    if (hookPress(name)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.FC_PAD_HOOK = { get: padHook, press: hookPress, prompts: hookPrompts };

  // ---------- Pad detection & glyph layout ----------
  function detectLayout(id) {
    const s = String(id || '');
    if (/xbox|xinput|045e/i.test(s)) return 'xbox';
    return /dualsense|dualshock|054c|playstation|\bps[45]\b|^\s*wireless controller\b/i.test(s) ? 'ps' : 'xbox';
  }

  function gLabel(key) {
    const map = GLYPHS[state.layout] || GLYPHS.xbox;
    return map[key] || key;
  }

  function rawPads() {
    if (_mockPads) return _mockPads;
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
    try { return Array.from(navigator.getGamepads() || []); } catch (_) { return []; }
  }

  function validPads() {
    return rawPads().filter(p => p && p.connected !== false && p.buttons && p.buttons.length >= 4);
  }

  function showPadToast(text, off) {
    if (/selftest/.test(location.hash)) return;
    let el = document.getElementById('gpToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gpToast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.classList.toggle('off', !!off);
    el.innerHTML = `<span class="gp-dot"></span><span>${typeof esc === 'function' ? esc(text) : text}</span>`;
    el.classList.add('on');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.classList.remove('on'); }, 2200);
  }

  function syncHeaderGlyphLabels() {
    const map = { LB: gLabel('LB'), RB: gLabel('RB'), LT: gLabel('LT'), RT: gLabel('RT') };
    document.querySelectorAll('button.gl[data-key]').forEach(btn => {
      const k = btn.dataset.key;
      if (map[k]) btn.textContent = map[k];
    });
    document.querySelectorAll('.rp2-tabs button.gl[data-tab]').forEach(btn => {
      btn.textContent = btn.dataset.tab === '-1' ? gLabel('LB') : gLabel('RB');
    });
  }

  function setInputMode(mode, pad) {
    const prevMode = document.documentElement.dataset.input || '';
    const prevLayout = state.layout;
    if (pad && pad.id) state.layout = detectLayout(pad.id);
    document.documentElement.dataset.padLayout = state.layout;
    if (mode) document.documentElement.dataset.input = mode;
    else delete document.documentElement.dataset.input;
    state.mode = mode || '';

    if (mode !== 'pad') {
      _lastPadPromptsSig = '';
      clearGpFocus();
    } else {
      syncHeaderGlyphLabels();
      syncFocus();
    }
    if (prevMode !== state.mode || prevLayout !== state.layout) {
      try { if (typeof window.prompts === 'function') window.prompts(); } catch (_) { /* */ }
    }
  }

  // ---------- Focus tracking, .gp-focus & controller tooltip ----------
  function clearGpFocus() {
    if (_focusedEl) { _focusedEl.classList.remove('gp-focus'); _focusedEl = null; }
    document.querySelectorAll('.gp-focus').forEach(el => el.classList.remove('gp-focus'));
  }

  // The tooltip engine lives in core.js (initTip / window.FC_TIP): pad focus opens the tip exactly like keyboard focus and hover.
  function updatePadTip(el) {
    if (!window.FC_TIP) return;
    if (!el || el === document.body) { if (!window.FC_TIP.pinned) window.FC_TIP.fromFocus(null); return; }
    window.FC_TIP.fromFocus(el);
  }

  // Pressed state (Figma "Pressed rule": the Focused look at motion/scale/press + a darker fill, motion/duration/instant).
  // :active covers the mouse; pad A and keyboard Enter / Space set .gp-press on the focused element for the press.
  let _pressTimer = 0;
  function markPressed(el) {
    if (!el || el === document.body || !el.classList) return;
    document.querySelectorAll('.gp-press').forEach(x => x.classList.remove('gp-press'));
    el.classList.add('gp-press');
    clearTimeout(_pressTimer);
    _pressTimer = setTimeout(() => el.classList.remove('gp-press'), 140);
  }

  function syncFocus() {
    const cur = document.activeElement;
    if (document.documentElement.dataset.input !== 'pad') {
      clearGpFocus();
      return;
    }
    if (_focusedEl && _focusedEl !== cur) _focusedEl.classList.remove('gp-focus');
    if (cur && cur !== document.body && cur.isConnected && !cur.closest('#prompts')) {
      cur.classList.add('gp-focus');
      _focusedEl = cur;
      updatePadTip(cur);
    } else {
      _focusedEl = null;
      updatePadTip(null);
    }
  }

  // A data-tip carrier that is not focusable itself and has no focusable ancestor would be hover-only (UX-9): it joins the
  // focus graph. (The header result bar carries its own combined tip, so its segments stay mouse-only.)
  const FOCUSABLE_ANCESTOR = 'a[href], button, select, input, textarea, summary, [tabindex], [data-href], [data-replay]';
  function enhanceFocusable(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(AUTO_TABINDEX_SEL).forEach(el => {
      if (!el.hasAttribute('tabindex') && !el.closest('#prompts') && !el.closest('#tip') && !el.closest('[data-stb]')) {
        el.setAttribute('tabindex', '0');
      }
    });
    scope.querySelectorAll('[data-tip]').forEach(el => {
      if (el.hasAttribute('tabindex') || el.closest('#prompts, #tip, #segbar, .top') || (el.parentElement && el.parentElement.closest(FOCUSABLE_ANCESTOR)) || el.matches(FOCUSABLE_ANCESTOR)) return;
      el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'note');
      el.classList.add('tipc');
    });
  }

  // ---------- Active modal / scope detection ----------
  function activeModal() {
    if (typeof ovOpen === 'function' && ovOpen()) return document.getElementById('overlay');
    const rp = document.querySelector('.rp2:not(.out)');
    if (rp) return rp;
    const mc = document.querySelector('.mc-pop:not([hidden])');
    if (mc) return mc;
    const dlg = document.querySelector('[role="dialog"]:not([hidden]):not(#overlay):not(.rp2)');
    if (dlg && visibleEl(dlg)) return dlg;
    return null;
  }

  function activeScope() {
    return activeModal() || document.getElementById('main') || document;
  }

  function visibleEl(el) {
    if (!el || !el.isConnected) return false;
    if (el.hidden || el.closest('[hidden]') || el.closest('#tip')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  function focusPool(customRoot) {
    const modal = activeModal();
    const root = customRoot || modal || document.getElementById('main') || document;
    enhanceFocusable(root);
    let list = Array.from(root.querySelectorAll(FOCUS_SEL)).filter(el => {
      if (!visibleEl(el)) return false;
      if (el.closest('#prompts') || el.closest('#gpToast')) return false;
      if (el.matches('button.gl[data-key], .rp2-tabs button.gl')) return false;
      if (el.getAttribute('tabindex') === '-1') return false;   // LT/RT tab rows and strips are triggers, not D-pad stops (Sub Tab 6:49)
      // grid brief P-1: the Sub-tab Bar, the LB RB nav, breadcrumbs and the header wordmark are NEVER D-pad stops
      if (el.closest('[data-stb], .top, .crumb')) return false;
      return true;
    });
    return list;
  }

  function preferredInitialFocus(scope) {
    const root = scope || activeScope();
    if (!root) return null;
    if (root.id === 'overlay') {
      return root.querySelector('#qsIn') || root.querySelector('#qsRes a.on, #qsRes a, button, a[href]');   // entry focus = the input
    }
    if (root.classList && root.classList.contains('rp2')) {
      const momVis = root.querySelector('.rp2-moments:not([hidden]) .mom');
      if (momVis && visibleEl(momVis)) return momVis;
      const play = root.querySelector('#rp2Play');
      if (play && visibleEl(play)) return play;
    }
    if (window.GRID && root.id === 'main') { const g = window.GRID.entryEl(root); if (g) return g; }   // entry focus per screen (Pad parity 288:28804)
    const priSelectors = [
      '.stk-panel button.stk-c',   // Matches: the first club streak cell (streaks brief §4)
      '.sl2 .slr.on',          // Transfers › Sign v2: the most urgent need's realistic starter (the row on show)
      '.pc[data-pos="ST"]',    // Tactics v2: the ST pitch card
      '.pp-card',              // Coaching › Patterns: the first card
      '.db-next',
      '.sq-row.on',
      '.board .slot.on',
      '.dd-list .cen-row.on',
      '.cen-pills .btn.pri',
      '.btn.pri',
      '.fx',
      '.mc-row.lnk-row',
    ];
    for (const sel of priSelectors) {
      const hit = root.querySelector(sel);
      if (hit && visibleEl(hit)) return hit;
    }
    const pool = focusPool(root);
    return pool[0] || null;
  }

  function ensureFocus() {
    const modal = activeModal();
    if (modal && modal.id === 'overlay') {
      syncFocus();
      return document.activeElement;
    }
    const pool = focusPool();
    if (!pool.length) return null;
    const cur = document.activeElement;
    if (cur && cur !== document.body && pool.includes(cur)) {
      syncFocus();
      return cur;
    }
    const first = preferredInitialFocus(modal || document.getElementById('main')) || pool[0];
    if (first) focusElement(first, { fromPad: document.documentElement.dataset.input === 'pad', noPreview: true });
    return first;
  }

  // ---------- Scroll visibility & live side-panel preview ----------
  function scrollIntoFocus(el) {
    if (!el || !el.isConnected) return;
    const reduced = document.documentElement.classList.contains('noanim') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    } catch (_) {
      el.scrollIntoView(false);
    }
    // Ensure focused element inside #main is never tucked behind sticky .top or fixed .prompts
    const main = document.getElementById('main');
    if (main && main.contains(el)) {
      const r = el.getBoundingClientRect();
      const topBar = document.querySelector('.top');
      const promptBar = document.querySelector('.prompts');
      const minTop = topBar ? Math.max(0, topBar.getBoundingClientRect().bottom + 8) : 12;
      const maxBot = promptBar ? Math.min(window.innerHeight, promptBar.getBoundingClientRect().top - 8) : window.innerHeight - 12;
      const scroller = main.scrollHeight > main.clientHeight + 2 ? main : (document.scrollingElement || document.documentElement);
      if (scroller && maxBot > minTop + 40) {
        if (r.bottom > maxBot) scroller.scrollTop += (r.bottom - maxBot);
        else if (r.top < minTop) scroller.scrollTop -= (minTop - r.top);
      }
    }
  }

  function scheduleLivePreview(el) {
    clearTimeout(_previewTimer);
    if (!el || !el.isConnected) return;
    const isPreviewItem = el.matches('.sq-row, .board .slot, .dd-list .cen-row, .db-steps a');
    if (!isPreviewItem) return;
    const h = el.getAttribute('href');
    if (!h || !h.startsWith('#') || h === location.hash) return;
    if (!(window.NAVSTATE && window.NAVSTATE.isViewChange(h, location.hash))) return;
    _previewTimer = setTimeout(() => {
      if (document.activeElement !== el || !el.isConnected) return;
      if (typeof window.setView === 'function') window.setView(h);
    }, PREVIEW_DEBOUNCE_MS);
  }

  function focusElement(el, opts = {}) {
    if (!el || typeof el.focus !== 'function') return false;
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    scrollIntoFocus(el);
    syncFocus();
    if (opts.fromPad && !opts.noPreview) scheduleLivePreview(el);
    try {
      if (document.documentElement.dataset.input === 'pad' && typeof window.prompts === 'function') window.prompts();
    } catch (_) { /* */ }
    return true;
  }

  // ---------- 2D Spatial Navigation Engine ----------
  function gap1D(a0, a1, b0, b1) {
    if (b0 > a1) return b0 - a1;
    if (a0 > b1) return a0 - b1;
    return 0;
  }

  function stepOverlaySearch(dir) {
    const ov = document.getElementById('overlay');
    if (!ov) return false;
    if (dir === 'left' || dir === 'right') {
      const inp = ov.querySelector('#qsIn');
      if (inp && inp.value && document.activeElement === inp) return false;
      cycleOverlayCategory(dir === 'right' ? 1 : -1);
      return true;
    }
    const links = Array.from(ov.querySelectorAll('#qsRes a')).filter(visibleEl);
    const inp0 = ov.querySelector('#qsIn');
    if (!links.length) return true;
    const curIdx = document.activeElement === inp0 ? -1 : links.findIndex(a => a.classList.contains('on'));
    if (dir === 'up' && curIdx <= 0 && inp0) {   // Figma 225:2338: entry focus = the input; ↑ from the first row goes back to it
      links.forEach(a => a.classList.remove('on')); clearGpFocus(); inp0.focus({ preventScroll: true });
      if (document.documentElement.dataset.input === 'pad') { inp0.classList.add('gp-focus'); _focusedEl = inp0; }
      return true;
    }
    const nextIdx = Math.max(0, Math.min(links.length - 1, curIdx + (dir === 'down' ? 1 : -1)));
    links.forEach((a, k) => a.classList.toggle('on', k === nextIdx));
    if (links[nextIdx]) {
      links[nextIdx].scrollIntoView({ block: 'nearest' });
      links[nextIdx].focus({ preventScroll: true });
      if (document.documentElement.dataset.input === 'pad') {
        clearGpFocus();
        links[nextIdx].classList.add('gp-focus');
        _focusedEl = links[nextIdx];
      }
    }
    return true;
  }

  function findBestSpatial(cur, pool, dir, vec) {
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const curCol = cur.closest('.mc-pan, .mc-col, .cen-left, .cen-right, .sq-side, .tm-side, .dd-right, .rp2-ctrl');

    // Optional analog vector mode (used on 2D formation pitch)
    if (vec && (Math.abs(vec[0]) > 0.01 || Math.abs(vec[1]) > 0.01)) {
      const mag = Math.hypot(vec[0], vec[1]) || 1;
      const ux = vec[0] / mag, uy = vec[1] / mag;
      let bestV = null, bestScoreV = Infinity;
      for (const el of pool) {
        if (el === cur || el.contains(cur) || cur.contains(el)) continue;
        const b = el.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - ax, dy = (b.top + b.height / 2) - ay;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) continue;
        const proj = dx * ux + dy * uy;
        if (proj <= dist * 0.38) continue; // ~68 deg half-cone
        const perp = Math.sqrt(Math.max(0, dist * dist - proj * proj));
        const score = proj + perp * 2.1;
        if (score < bestScoreV) { bestScoreV = score; bestV = el; }
      }
      if (bestV) return bestV;
    }

    // Pass 1: Non-overlapping / clear half-space with interval-gap orthogonal metric
    let best = null, bestScore = Infinity;
    for (const el of pool) {
      if (el === cur || el.contains(cur) || cur.contains(el)) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      let main = 0, orth = 0, tie = 0;
      if (dir === 'left') {
        if (!(bx < ax - 4 && b.left < a.left - 2)) continue;
        main = Math.max(0, a.left - b.right);
        orth = gap1D(a.top, a.bottom, b.top, b.bottom);
        tie = Math.abs(by - ay);
      } else if (dir === 'right') {
        if (!(bx > ax + 4 && b.right > a.right + 2)) continue;
        main = Math.max(0, b.left - a.right);
        orth = gap1D(a.top, a.bottom, b.top, b.bottom);
        tie = Math.abs(by - ay);
      } else if (dir === 'up') {
        if (!(by < ay - 4 && b.top < a.top - 2)) continue;
        main = Math.max(0, a.top - b.bottom);
        orth = gap1D(a.left, a.right, b.left, b.right);
        tie = Math.abs(bx - ax);
      } else {
        if (!(by > ay + 4 && b.bottom > a.bottom + 2)) continue;
        main = Math.max(0, b.top - a.bottom);
        orth = gap1D(a.left, a.right, b.left, b.right);
        tie = Math.abs(bx - ax);
      }
      const sameGroup = curCol && curCol === el.closest('.mc-pan, .mc-col, .cen-left, .cen-right, .sq-side, .tm-side, .dd-right, .rp2-ctrl');
      const bonus = sameGroup && (dir === 'up' || dir === 'down') ? 16 : 0;
      const score = main + orth * 2.35 + tie * 0.12 - bonus;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) return best;

    // Pass 2: Center-cone fallback for tightly packed / overlapping pitch slots or badges
    for (const el of pool) {
      if (el === cur || el.contains(cur) || cur.contains(el)) continue;
      const b = el.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - ax, dy = (b.top + b.height / 2) - ay;
      let mainC = 0, orthC = 0;
      if (dir === 'left') { mainC = -dx; orthC = Math.abs(dy); }
      else if (dir === 'right') { mainC = dx; orthC = Math.abs(dy); }
      else if (dir === 'up') { mainC = -dy; orthC = Math.abs(dx); }
      else { mainC = dy; orthC = Math.abs(dx); }
      if (mainC <= 6 || orthC > mainC * 1.85) continue;
      const score = mainC + orthC * 1.9;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function spatial(dir, opts = {}) {
    const fromPad = !!opts.fromPad;
    if (hookPress(String(dir).toUpperCase())) return true;
    if (typeof ovOpen === 'function' && ovOpen()) {
      stepOverlaySearch(dir);
      return true;
    }
    // Timeline Scrubber 179:866: with the replay timeline focused, left / right seek 5 s (hold = scrub)
    const ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains('rp2-bar') && (dir === 'left' || dir === 'right')) {
      return seekReplay(dir === 'left' ? -5 : 5);
    }

    const pool = focusPool();
    if (!pool.length) return false;

    const cur = document.activeElement;
    if (!cur || cur === document.body || !pool.includes(cur)) {
      const first = preferredInitialFocus() || pool[0];
      return focusElement(first, { fromPad, noPreview: true });
    }

    // 0. Replay popup (brief replay-close §4): D-pad up from the top-most control reaches the round Close X (last in the order)
    if (dir === 'up' && cur.closest('.rp2') && !cur.matches('.rp2-x')) {
      const above = findBestSpatial(cur, pool.filter(el => !el.matches('.rp2-x')), 'up', null);
      const x = cur.closest('.rp2').querySelector('.rp2-x');
      if (!above && x && visibleEl(x)) return focusElement(x, { fromPad, noPreview: true });
    }
    // 1. Replay Moments list: crisp linear Up/Down across moment rows
    if (cur.matches('.rp2 .mom')) {
      const moms = Array.from(cur.closest('.rp2').querySelectorAll('.rp2-moments:not([hidden]) .mom'));
      const i = moms.indexOf(cur);
      if (dir === 'down' && i >= 0 && i < moms.length - 1) return focusElement(moms[i + 1], { fromPad });
      if (dir === 'up' && i > 0) return focusElement(moms[i - 1], { fromPad });
      if (dir === 'down' && i === moms.length - 1) {
        const play = cur.closest('.rp2').querySelector('#rp2Play');
        if (play && visibleEl(play)) return focusElement(play, { fromPad });
      }
    }

    // 2. Squad Hub list <-> side panel structured navigation
    const main = document.getElementById('main');
    if (main && main.contains(cur)) {
      if (cur.matches('.sq-row')) {
        const rows = Array.from(main.querySelectorAll('.sq-row')).filter(el => !el.closest('[hidden]'));
        const idx = rows.indexOf(cur);
        if (dir === 'down' && idx >= 0 && idx < rows.length - 1) return focusElement(rows[idx + 1], { fromPad });
        if (dir === 'up') {
          if (idx > 0) return focusElement(rows[idx - 1], { fromPad });
          // P-1: a sortable header row is a stop only via the up key from row 1 (A sorts)
          const headerTarget = main.querySelector('.sq-head .th.on') || main.querySelector('.sq-head .th');
          if (headerTarget && visibleEl(headerTarget)) return focusElement(headerTarget, { fromPad, noPreview: true });
          return true;
        }
        if (dir === 'down') return true;   // the end of the list: focus stays put (no wrap)
        if (dir === 'right') {   // right never walks the column headers: it goes to the inspector (or stays)
          const side = main.querySelector('.sq-side');
          const sidePool = side ? focusPool(side) : [];
          if (sidePool.length) return focusElement(sidePool[0], { fromPad, noPreview: true });
          return true;
        }
        if (dir === 'left') return true;
      } else if (cur.matches('.sq-head .th') && dir === 'down') {
        const rowOn = main.querySelector('.sq-row.on') || main.querySelector('.sq-row');
        if (rowOn && visibleEl(rowOn)) return focusElement(rowOn, { fromPad, noPreview: true });
      } else if (cur.matches('.sq-head .th') && dir === 'up') {
        return true;
      } else if (cur.closest('.sq-side') && dir === 'left') {
        const sidePool = focusPool(cur.closest('.sq-side'));
        const hitInSide = findBestSpatial(cur, sidePool, 'left', null);
        if (hitInSide) return focusElement(hitInSide, { fromPad });
        const rowOn = main.querySelector('.sq-row.on, .sq-row');
        if (rowOn && visibleEl(rowOn)) return focusElement(rowOn, { fromPad, noPreview: true });
      }

      // 3. Transfers Director's Desk list <-> card navigation
      if (cur.matches('.dd-list .cen-row')) {
        const rows = Array.from(main.querySelectorAll('.dd-list .cen-row')).filter(visibleEl);
        const idx = rows.indexOf(cur);
        if (dir === 'down' && idx >= 0 && idx < rows.length - 1) return focusElement(rows[idx + 1], { fromPad });
        if (dir === 'up') {
          if (idx > 0) return focusElement(rows[idx - 1], { fromPad });
          return true;   // the first row: the Sub-tab Bar is not a stop
        }
        if (dir === 'down' && idx === rows.length - 1) return true;
        if (dir === 'right') {
          const rightPool = focusPool(main.querySelector('.dd-right'));
          if (rightPool.length) return focusElement(rightPool[0], { fromPad });
        }
      } else if (cur.closest('.dd-right') && dir === 'left') {
        const rightPool = focusPool(cur.closest('.dd-right'));
        const hitRight = findBestSpatial(cur, rightPool, 'left', null);
        if (hitRight) return focusElement(hitRight, { fromPad });
        const rowOn = main.querySelector('.dd-list .cen-row.on, .dd-list .cen-row');
        if (rowOn && visibleEl(rowOn)) return focusElement(rowOn, { fromPad, noPreview: true });
      }

      // 4. Tactics formation pitch <-> side panel navigation
      if (cur.matches('.board .slot')) {
        const slots = Array.from(main.querySelectorAll('.board .slot')).filter(visibleEl);
        const hitSlot = findBestSpatial(cur, slots, dir, opts.vec || null);
        if (hitSlot) return focusElement(hitSlot, { fromPad });
        if (dir === 'right') {
          const sidePool = focusPool(main.querySelector('.tm-side'));
          if (sidePool.length) return focusElement(sidePool[0], { fromPad });
        }
        if (dir === 'up') {
          const topBar = main.querySelector('.tm-topbar a, .tm-topbar button');
          if (topBar && visibleEl(topBar)) return focusElement(topBar, { fromPad });
        }
      } else if (cur.closest('.tm-side') && dir === 'left') {
        const sidePool = focusPool(cur.closest('.tm-side'));
        const hitSide = findBestSpatial(cur, sidePool, 'left', null);
        if (hitSide) return focusElement(hitSide, { fromPad });
        const slotOn = main.querySelector('.board .slot.on, .board .slot');
        if (slotOn && visibleEl(slotOn)) return focusElement(slotOn, { fromPad, noPreview: true });
      }

      // 5. Match Debrief steps <-> step body
      if (cur.matches('.db-steps a')) {
        const steps = Array.from(main.querySelectorAll('.db-steps a')).filter(visibleEl);
        const idx = steps.indexOf(cur);
        if (dir === 'down' && idx >= 0 && idx < steps.length - 1) return focusElement(steps[idx + 1], { fromPad });
        if (dir === 'down' && idx === steps.length - 1) {
          const backLink = cur.closest('.mc-pan') && cur.closest('.mc-pan').querySelector('a.lnk');
          if (backLink && visibleEl(backLink)) return focusElement(backLink, { fromPad });
        }
        if (dir === 'up' && idx > 0) return focusElement(steps[idx - 1], { fromPad });
        if (dir === 'right') {
          const panelPool = focusPool(main.querySelector('.db-panel'));
          if (panelPool.length) return focusElement(panelPool[0], { fromPad });
        }
      } else if (cur.closest('.db-panel') && dir === 'left') {
        const panelPool = focusPool(cur.closest('.db-panel'));
        const hitPanel = findBestSpatial(cur, panelPool, 'left', null);
        if (hitPanel) return focusElement(hitPanel, { fromPad });
        const stepOn = main.querySelector('.db-steps a.on, .db-steps a');
        if (stepOn && visibleEl(stepOn)) return focusElement(stepOn, { fromPad, noPreview: true });
      }
    }

    const best = findBestSpatial(cur, pool, dir, null);
    if (best) return focusElement(best, { fromPad });
    return false;
  }

  // ---------- Element Activation (Button A / Enter) ----------
  function stepSelectOption(sel, delta = 1) {
    const opts = Array.from(sel.options).filter(o => !o.disabled);
    if (!opts.length) return false;
    const curIdx = Math.max(0, opts.findIndex(o => o.value === sel.value));
    const next = opts[(curIdx + delta + opts.length) % opts.length];
    sel.value = next.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function activate(el) {
    clearTimeout(_previewTimer);
    // Search overlay: A always opens the highlighted result
    if (typeof ovOpen === 'function' && ovOpen()) {
      const ov = document.getElementById('overlay');
      if (el && el.matches && el.matches('.gp-qstabs button, .gp-qstabs a')) { el.click(); return true; }
      const target = (el && el.matches && el.matches('#qsRes a')) ? el : (ov && ov.querySelector('#qsRes a.on, #qsRes a'));
      if (target) {
        const h = target.getAttribute('href') || '';
        if (typeof closeOverlay === 'function') closeOverlay();
        if (h.startsWith('#')) {
          if (window.NAVSTATE && window.NAVSTATE.isViewChange(h, location.hash)) window.setView(h);
          else location.hash = h;
        } else {
          target.click();
        }
        return true;
      }
      return false;
    }

    // Replay popup: if nothing specific inside .rp2 is focused (or #rp2Play is focused), toggle Play/Pause
    const rp = document.querySelector('.rp2:not(.out)');
    if (rp) {
      if (!el || el === document.body || !rp.contains(el)) {
        const pb = rp.querySelector('#rp2Play');
        if (pb) { pb.click(); focusElement(pb, { fromPad: document.documentElement.dataset.input === 'pad', noPreview: true }); return true; }
      }
      if (el && rp.contains(el)) { el.click(); return true; }
    }

    if (!el || el === document.body) {
      const first = ensureFocus();
      if (!first) return false;
      el = first;
    }

    if (el.tagName === 'SELECT') return stepSelectOption(el, 1);

    // Squad Hub: pressing A on an already-selected player row opens their full Player Profile
    if (el.matches('.sq-row.on')) {
      const main = document.getElementById('main');
      const profLink = main && main.querySelector('.sq-side a[href^="#page=player"]');
      if (profLink) { profLink.click(); return true; }
    }

    // Transfers Desk: pressing A on an already-selected decision row activates or focuses its primary card button
    if (el.matches('.dd-list .cen-row.on')) {
      const main = document.getElementById('main');
      const priBtn = main && main.querySelector('.dd-card .dd-btns .btn.pri, .dd-card .dd-btns .btn');
      if (priBtn && visibleEl(priBtn)) { priBtn.click(); return true; }
    }

    if (el.matches('[data-replay]')) {
      el.click();
      return true;
    }

    if (el.matches('[data-href]') && !el.matches('a')) {
      const h = '#' + String(el.dataset.href || '').replace(/^#/, '');
      if (window.NAVSTATE && window.NAVSTATE.isViewChange(h, location.hash) && typeof window.setView === 'function') {
        window.setView(h);
      } else {
        location.hash = h;
      }
      return true;
    }

    el.click();
    return true;
  }

  // ---------- Sub-Tab & Screen Cycling (LB / RB / LT / RT) ----------
  function cycleTopScreen(dir) {
    const modal = activeModal();
    if (modal) {
      if (modal.classList.contains('rp2')) {
        const tabs = Array.from(modal.querySelectorAll('.rp2-tabs a[data-tab]'));
        if (tabs.length > 1) {
          const curIdx = Math.max(0, tabs.findIndex(a => a.classList.contains('on')));
          const next = tabs[(curIdx + dir + tabs.length) % tabs.length];
          next.click();
          setTimeout(() => {
            const target = next.dataset.tab === 'moments'
              ? modal.querySelector('.rp2-moments:not([hidden]) .mom')
              : modal.querySelector('#rp2Play');
            if (target && visibleEl(target)) focusElement(target, { fromPad: true, noPreview: true });
            try { if (typeof window.prompts === 'function') window.prompts(); } catch (_) { /* */ }
          }, 0);
        }
        return true;
      }
      if (modal.classList.contains('mc-pop')) {
        const halves = Array.from(modal.querySelectorAll('[data-half]')).filter(visibleEl);
        if (halves.length > 1) {
          const curIdx = Math.max(0, halves.findIndex(b => b.classList.contains('on')));
          const next = halves[(curIdx + dir + halves.length) % halves.length];
          next.click();
          focusElement(next, { fromPad: true, noPreview: true });
        }
        return true;
      }
      if (modal.id === 'overlay') {
        cycleOverlayCategory(dir);
        return true;
      }
      return false;
    }
    if (typeof cycleNav === 'function') {
      cycleNav(dir);
      return true;
    }
    return false;
  }

  function findPageSubTabLinks() {
    const main = document.getElementById('main');
    if (!main) return [];
    const bar = main.querySelector('.page [data-stb]');
    if (!bar || !visibleEl(bar)) return [];
    const curPage = typeof S === 'object' && S ? S.page : '';
    return Array.from(bar.querySelectorAll('a[href^="#"], button[data-tab]')).filter(el => {
      if (!visibleEl(el)) return false;
      const h = el.getAttribute('href') || '';
      if (!h.startsWith('#')) return true;
      const p = new URLSearchParams(h.slice(1)).get('page');
      return !p || !curPage || p === curPage;
    });
  }

  function cycleSubTab(dir) {
    const modal = activeModal();
    if (modal) {
      if (modal.classList.contains('rp2')) {
        if (typeof RP2 === 'object' && RP2.speedStep) { RP2.speedStep(dir); return true; }
        return false;
      }
      if (modal.id === 'overlay') {
        cycleOverlayCategory(dir);
        return true;
      }
      if (modal.classList.contains('mc-pop')) {
        return cycleTopScreen(dir);
      }
      return false;
    }

    const domTabs = findPageSubTabLinks();
    if (domTabs.length > 1) {
      const curIdx = Math.max(0, domTabs.findIndex(el => el.classList.contains('on')));
      const j = (curIdx + dir + domTabs.length) % domTabs.length, next = domTabs[j];
      const h = next.getAttribute('href');   // LT RT wrap; a sub-tab is view state with its own memory (navstate switchTab)
      if (h && h[0] === '#' && window.NAVSTATE && window.NAVSTATE.switchTab) window.NAVSTATE.switchTab(h, j); else next.click();
      return true;
    }

    if (typeof cycleTab === 'function') {
      cycleTab(dir);
      return true;
    }
    return false;
  }

  // ---------- Replay helpers ----------
  function seekReplay(deltaSec) {
    if (typeof RP2 === 'object' && RP2 && RP2.state && RP2.state.D) {
      const st = RP2.state;
      const maxT = Math.max(0, st.D.n / st.D.hz - 0.1);
      st.t = Math.max(0, Math.min(maxT, st.t + deltaSec));
      st.ring = { p1: null, p2: null };
      return true;
    }
    const rp = document.querySelector('.rp2:not(.out)');
    if (rp) {
      const btn = rp.querySelector(`[data-j="${deltaSec < 0 ? '-10' : '10'}"]`);
      if (btn) { btn.click(); return true; }
    }
    return false;
  }

  // ---------- Contextual Action (Button X / Square) ----------
  function getContextSpec() {
    if (typeof ovOpen === 'function' && ovOpen()) {
      const inp = document.querySelector('#overlay #qsIn');
      if (inp && inp.value) {
        return {
          label: 'Clear',
          run() {
            if (typeof window.qsClear === 'function') { window.qsClear(); clearGpFocus(); if (document.documentElement.dataset.input === 'pad') { inp.classList.add('gp-focus'); _focusedEl = inp; } }
            else { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
            try { window.prompts && window.prompts(); } catch (_) { /* */ } return true;
          },
        };
      }
      return null;   // Leon 24 Nov: X only clears the text; LT/RT pick the category (no "Filter")
    }

    const rp = document.querySelector('.rp2:not(.out)');
    if (rp) {
      if (typeof RP2 !== 'object' || !RP2.toggleSkip) return null;
      return {
        label: 'Skip stoppages: ' + (RP2.state && RP2.state.skip ? 'On' : 'Off'),
        run() { RP2.toggleSkip(); return true; },
      };
    }

    const mcPop = document.querySelector('.mc-pop:not([hidden])');
    if (mcPop) {
      const halves = Array.from(mcPop.querySelectorAll('[data-half]')).filter(visibleEl);
      if (halves.length > 1) {
        return {
          label: 'FT / HT',
          run() {
            const idx = Math.max(0, halves.findIndex(b => b.classList.contains('on')));
            halves[(idx + 1) % halves.length].click();
            return true;
          },
        };
      }
      return null;
    }

    const main = document.getElementById('main');
    if (!main || typeof S !== 'object' || !S) return null;

    // grid brief P-1: X = the page's context action, the same on every sibling view (Compare on Squad, Desk, Profile;
    // Role list on Tactics). Sorting is A on a header (a stop via the up key from row 1); Match Centre and Central have no X.
    if (S.page === 'player') {
      const cmpTrigger = main.querySelector('[data-cmp-open], .pf-cmp-btn, select[data-param="vs"], a[href*="ptab=compare"]');
      if (cmpTrigger && visibleEl(cmpTrigger)) {
        return {
          label: 'Compare',
          run() {
            if (cmpTrigger.tagName === 'SELECT') return stepSelectOption(cmpTrigger, 1);
            cmpTrigger.click();
            return true;
          },
        };
      }
    }

    if (S.page === 'scouting') {
      const cmpBtn = main.querySelector('.dd-card a[href*="cmp="], .dd-card button[data-cmp]');
      if (cmpBtn && visibleEl(cmpBtn)) {
        return { label: 'Compare', run() { cmpBtn.click(); return true; } };
      }
    }

    return null;
  }

  function contextAction() {
    const spec = getContextSpec();
    return spec ? !!spec.run() : false;
  }

  function pressBack() {
    if (window.FC_TIP && window.FC_TIP.pinned) { window.FC_TIP.hide(); renderPadPromptsSafe(); return true; }
    if (typeof window.goBackApp === 'function') {
      window.goBackApp();
      return true;
    }
    if (typeof window.goBack === 'function') {
      window.goBack();
      return true;
    }
    return false;
  }

  function pressY() {
    const rp = document.querySelector('.rp2:not(.out)');
    if (rp) return false;   // the replay popup's prompt bar has no Y (Figma 100:2005): X = Skip stoppages
    if (window.FC_TIP && (window.FC_TIP.pinned || window.FC_TIP.label())) {   // Figma Tooltip 179:881: Y pins / unpins
      const done = window.FC_TIP.toggle();
      renderPadPromptsSafe();
      if (done) return true;
    }
    if (typeof ovOpen === 'function' && ovOpen()) {
      if (typeof closeOverlay === 'function') closeOverlay();
      return true;
    }
    const toast = document.getElementById('pmToast');
    if (toast && !toast.hidden && visibleEl(toast)) {
      const openBtn = toast.querySelector('[data-open]');
      if (openBtn) { openBtn.click(); return true; }
    }
    if (typeof openSearch === 'function') {
      openSearch();
      return true;
    }
    return false;
  }

  function pressR3() {
    const main = document.getElementById('main');
    if (!main || typeof S !== 'object' || !S) return false;
    if (S.page === 'squad') {
      if (S.cmp && typeof window.setView === 'function') {
        window.setView(href({ ...S, cmp: null }));
        return true;
      }
      const cmpLink = main.querySelector('.sq-side a[href*="cmp="], .sq-side [data-cmp]');
      if (cmpLink) { cmpLink.click(); return true; }
    }
    if (S.page === 'hub' && typeof cenGo === 'function') {
      const n = main.querySelector('.cen-news');
      if (n) { cenGo(main, (+n.dataset.page || 0) + 1); return true; }
    }
    return false;
  }

  function flickRightStickX(dir) {
    if (activeModal()) return false;
    const main = document.getElementById('main');
    if (!main || typeof S !== 'object' || !S) return false;
    if (S.page === 'hub' && typeof cenGo === 'function') {
      const n = main.querySelector('.cen-news');
      if (n) { cenGo(main, (+n.dataset.page || 0) + dir); return true; }
    }
    if (S.page === 'match' && S.tab === 'debrief' && typeof window.setView === 'function') {
      const k = +(new URLSearchParams(location.hash.slice(1)).get('step') || 1);
      const next = Math.min(5, Math.max(1, k + dir));
      if (next !== k) { window.setView(sub({ step: next === 1 ? null : next })); return true; }
    }
    if (S.page === 'tactics') {
      const phaseBtns = Array.from(main.querySelectorAll('[data-phase], [data-mode], .tm-phase a, .tm-phase button')).filter(visibleEl);
      if (phaseBtns.length > 1) {
        const idx = Math.max(0, phaseBtns.findIndex(b => b.classList.contains('on') || b.getAttribute('aria-pressed') === 'true'));
        phaseBtns[(idx + dir + phaseBtns.length) % phaseBtns.length].click();
        return true;
      }
    }
    if (S.page === 'player') {
      const navBtns = Array.from(main.querySelectorAll('.row a.btn.sq[href^="#page=player"]')).filter(visibleEl);
      if (navBtns.length >= 2) {
        navBtns[dir < 0 ? 0 : 1].click();
        return true;
      }
    }
    return false;
  }

  // ---------- Search Overlay Controller Enhancement ----------
  const QS_CATS = [
    ['all', 'All', () => true],
    ['screens', 'Screens', i => i.k === 'Screen'],
    ['players', 'Players', i => !['Screen'].includes(i.k) && !/^Decision\b/.test(i.k) && !/^\d{1,2}\s+[A-Z][a-z]{2}$/.test(i.k) && !/#page=match\b/.test(i.h)],
    ['matches', 'Matches', i => /^#page=match\b/.test(i.h)],
    ['decisions', 'Decisions', i => /^Decision\b/.test(i.k)],
  ];

  function renderOverlayResults() {
    const ov = document.getElementById('overlay');
    if (!ov || !ov.classList.contains('on')) return;
    const inp = ov.querySelector('#qsIn'), res = ov.querySelector('#qsRes');
    if (!inp || !res || typeof searchItems !== 'function') return;
    const cat = QS_CATS.find(c => c[0] === _qsCategory) || QS_CATS[0];
    const q = typeof fold === 'function' ? fold(inp.value) : String(inp.value || '').toLowerCase();
    const limit = _qsCategory === 'all' && !q ? 14 : 40;
    const list = searchItems().filter(i => cat[2](i) && (!q || (typeof fold === 'function' ? fold(i.l + ' ' + i.k) : (i.l + ' ' + i.k).toLowerCase()).includes(q))).slice(0, limit);
    res.innerHTML = list.map((i, k) => `<a href="${i.h}" class="${k === 0 ? 'on' : ''}">${esc(i.l)}<span class="k">${esc(i.k)}</span></a>`).join('') || '<div class="empty">Nothing found</div>';
    if (document.documentElement.dataset.input === 'pad') {
      const first = res.querySelector('a.on');
      clearGpFocus();
      if (first) { first.classList.add('gp-focus'); _focusedEl = first; }
    }
  }

  function cycleOverlayCategory(dir) {
    const ov = document.getElementById('overlay');
    if (!ov || !ov.classList.contains('on')) return;
    if (!QS_CATEGORY_BAR || !ov.querySelector('.gp-qstabs')) return;
    if (typeof window.qsCycle === 'function') {   // shell.js owns the overlay (rows, counts, focus)
      const row = window.qsCycle(dir);
      if (row && document.documentElement.dataset.input === 'pad') { clearGpFocus(); row.classList.add('gp-focus'); _focusedEl = row; }
      renderPadPromptsSafe();
      return;
    }
    const idx = Math.max(0, QS_CATS.findIndex(c => c[0] === _qsCategory));
    _qsCategory = QS_CATS[(idx + dir + QS_CATS.length) % QS_CATS.length][0];
    ov.querySelectorAll('.gp-qstabs button[data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === _qsCategory));
    renderOverlayResults();
  }

  function enhanceSearchOverlay() {
    if (!QS_CATEGORY_BAR) return;
    const ov = document.getElementById('overlay');
    if (!ov || !ov.classList.contains('on')) return;
    const panel = ov.querySelector('.panel'), inp = ov.querySelector('#qsIn'), res = ov.querySelector('#qsRes');
    if (!panel || !inp || !res || panel.querySelector('.gp-qstabs')) return;
    _qsCategory = 'all';
    const bar = document.createElement('nav');
    bar.className = 'gp-qstabs';
    bar.setAttribute('aria-label', 'Search categories');
    bar.innerHTML = `<span class="gl tr">${gLabel('LT')}</span>`
      + QS_CATS.map(([k, l]) => `<button type="button" data-cat="${k}" class="${k === 'all' ? 'on' : ''}">${esc(l)}</button>`).join('')
      + `<span class="gl tr">${gLabel('RT')}</span>`;
    panel.insertBefore(bar, res);
    bar.addEventListener('click', e => {
      const b = e.target.closest('button[data-cat]');
      if (!b) return;
      _qsCategory = b.dataset.cat;
      bar.querySelectorAll('button[data-cat]').forEach(x => x.classList.toggle('on', x === b));
      renderOverlayResults();
    });
    inp.addEventListener('input', () => {
      renderOverlayResults();
      try { if (document.documentElement.dataset.input === 'pad' && typeof window.prompts === 'function') window.prompts(); } catch (_) { /* */ }
    });
    if (document.documentElement.dataset.input === 'pad') renderOverlayResults();
  }

  // ---------- EA FC 26 Dynamic Prompt Bar (#prompts, Figma 7:77 & 6:9) ----------
  function faceBtn(key, label, gpAct) {
    return `<button type="button" class="prompt" data-gp-act="${gpAct}"><span class="gl c">${esc(gLabel(key))}</span>${esc(label)}</button>`;
  }
  function pairBtn(k1, k2, cls, label, gpAct) {
    return `<button type="button" class="prompt" data-gp-act="${gpAct}"><span class="gl-pair"><span class="gl ${cls}">${esc(gLabel(k1))}</span><span class="gl ${cls}">${esc(gLabel(k2))}</span></span>${esc(label)}</button>`;
  }
  function stickBtn(key, label, gpAct, wide) {
    return `<button type="button" class="prompt" data-gp-act="${gpAct}"><span class="gl st${wide ? ' wide' : ''}">${esc(gLabel(key))}</span>${esc(label)}</button>`;
  }

  function hookPromptHtml(list, kb) {
    const KC = { A: 'Enter', B: 'Esc', X: 'X', Y: 'Y', R: 'R' };
    return list.map(([k, label, dim]) => {
      const cls = dim ? ' dim' : '';
      if (k === 'LTRT') return kb ? `<button type="button" class="prompt${cls}" data-gp-act="hook:RT"><span class="gl kc">Z</span><span class="gl kc">C</span>${esc(label)}</button>`
        : `<button type="button" class="prompt${cls}" data-gp-act="hook:RT"><span class="gl-pair"><span class="gl tr">${esc(gLabel('LT'))}</span><span class="gl tr">${esc(gLabel('RT'))}</span></span>${esc(label)}</button>`;
      if (k === 'RS') return `<button type="button" class="prompt${cls}" data-gp-act="noop"><span class="gl st">${kb ? 'R' : esc(gLabel('R'))}</span>${esc(label)}</button>`;
      if (k === 'R') return kb ? `<button type="button" class="prompt${cls}" data-gp-act="hook:R"><span class="gl kc">R</span>${esc(label)}</button>`
        : `<button type="button" class="prompt${cls}" data-gp-act="hook:R"><span class="gl st">${esc(gLabel('R'))}</span>${esc(label)}</button>`;
      return `<button type="button" class="prompt${cls}" data-gp-act="hook:${k}">${kb ? `<span class="gl kc">${KC[k] || k}</span>` : `<span class="gl c">${esc(gLabel(k))}</span>`}${esc(label)}</button>`;
    }).join('');
  }

  // ---------- Prompt Bar · Slotted (Figma 285:4552, grid brief §4): ONE renderer for pad, keyboard and the page hooks ----------
  // Fixed slots per screen LEVEL (top: A · LT RT · X · Y · R; deep: A · B · LT RT · X · Y · R), blank slot when unused,
  // glyphs = the last input device (grid.js). Meanings are fixed per page across its sibling views.
  function syncStbGlyphs() {
    document.querySelectorAll('[data-stb] .k-pad[data-gk]').forEach(g => { const t = gLabel(g.dataset.gk); if (g.textContent !== t) g.textContent = t; });
  }
  function pageSpec() {
    const lvl = window.GRID ? window.GRID.level() : 'top';
    const cur = document.activeElement, spec = { level: lvl };
    spec.A = cur && cur.matches && cur.matches('.sq-row.on') ? 'Open player' : 'Select';
    if (lvl === 'deep' && window.NAVSTATE && window.NAVSTATE.hasBackTarget()) spec.B = (typeof S === 'object' && S && S.cmp) ? 'Close compare' : 'Back';
    if (findPageSubTabLinks().length > 1) spec.LTRT = window.GRID ? window.GRID.noun() : 'Tab';
    const ctx = getContextSpec(); if (ctx) spec.X = ctx.label;
    const toast = document.getElementById('pmToast'), pin = window.FC_TIP ? window.FC_TIP.label() : '';
    spec.Y = pin || (toast && !toast.hidden && visibleEl(toast) ? 'Pre-match' : 'Search');
    if (typeof S === 'object' && S && S.page === 'hub' && document.querySelector('#main .cen-news .cen-dots')) spec.R = 'Page';
    return spec;
  }
  function promptSpec() {
    const rp = document.querySelector('.rp2:not(.out)');
    const ov = typeof ovOpen === 'function' && ovOpen();
    const mc = document.querySelector('.mc-pop:not([hidden])');
    if (rp) {   // Figma 100:1828, prompt bar 100:2005: A Pause · B Close · LT/RT Speed n× · X Skip stoppages: On / Off
      const sp = typeof RP2 === 'object' && RP2.promptSpec ? RP2.promptSpec(document.activeElement) : { a: 'Select', speed: 2, skip: true };
      return { level: 'deep', A: sp.a, B: 'Close', LTRT: `Speed ${sp.speed}×`, X: `Skip stoppages: ${sp.skip ? 'On' : 'Off'}` };
    }
    if (ov) {   // Figma 7a 225:8252: A Open · B Close · LT RT Category · X Clear (X only while there is text)
      const ctx = getContextSpec();
      return { level: 'deep', A: 'Open', B: 'Close', LTRT: QS_CATEGORY_BAR ? 'Category' : null, X: ctx ? ctx.label : null };
    }
    if (mc) {
      const ctx = getContextSpec(), pin = window.FC_TIP ? window.FC_TIP.label() : '';
      return { level: 'deep', B: 'Close', X: ctx ? ctx.label : null, Y: pin || null, R: 'Scroll' };
    }
    const hp = hookPrompts();
    if (hp) {
      const h = padHook(), base = pageSpec(), modal = (h && (h.z || 0) >= 5) || !!activeModal();
      const sp = { level: modal ? 'deep' : base.level };
      hp.forEach(([k, l]) => { const key = k === 'RS' ? 'R' : k; if (l) sp[key] = l; });
      // top screen: "B Back" is not a prompt (Decision 2); any other B (Cancel, Close compare, Back to rows) = one level down
      if (sp.B && !modal && sp.level === 'top') { if (/^back$/i.test(sp.B)) delete sp.B; else sp.level = 'deep'; }
      if (sp.LTRT && !modal && window.GRID) sp.LTRT = window.GRID.noun();   // naming rule: Tab / Group / Slot
      if (sp.level === 'deep' && !sp.B && base.B) sp.B = base.B;
      // a page-level hook that only adds a line action (Profile DEVELOP / PROMISE lines) keeps the page's other slots
      const merge = h && (typeof h.merge === 'function' ? h.merge() : h.merge);
      if (merge) ['LTRT', 'X', 'Y', 'R'].forEach(k => { if (!sp[k] && base[k]) sp[k] = base[k]; });
      return sp;
    }
    return pageSpec();
  }
  function renderPadPrompts() {
    syncStbGlyphs();
    if (window.GRID) window.GRID.renderPrompts(promptSpec(), gLabel);
  }

  function renderPadPromptsSafe() {
    try { renderPadPrompts(); } catch (e) { if (window.__errors) window.__errors.push(String(e && e.stack || e)); }
  }

  window.prompts = function () {
    syncHeaderGlyphLabels();
    renderPadPrompts();
  };
  void origPrompts; void hookPromptHtml; void faceBtn; void pairBtn; void stickBtn;

  // Upgrade global spatial & activate functions so keyboard arrow/Enter navigation shares the exact same improvements
  window.spatial = function (dir) { return spatial(dir, { fromPad: false }); };
  window.activate = activate;

  // ---------- Right-Stick Continuous Scroll & Timeline Scrub ----------
  function resolveScrollTarget(dy) {
    const hk = padHook();
    if (hk && hk.scrollTarget) { const t = hk.scrollTarget(); if (t) return t; }
    const modal = activeModal();
    if (modal) {
      if (modal.classList.contains('rp2')) {
        const momList = modal.querySelector('.rp2-moments:not([hidden]) .list');
        if (momList && momList.scrollHeight > momList.clientHeight + 2) return momList;
        return null;
      }
      if (modal.classList.contains('mc-pop')) {
        const card = modal.querySelector('.mc-card');
        if (card && card.scrollHeight > card.clientHeight + 2) return card;
      }
      if (modal.id === 'overlay') {
        const qs = modal.querySelector('#qsRes');
        if (qs && qs.scrollHeight > qs.clientHeight + 2) return qs;
      }
      return modal.scrollHeight > modal.clientHeight + 2 ? modal : null;
    }

    // Check focused element's scrollable ancestor first; fall through to #main / window once at boundary
    let el = document.activeElement;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight + 2) {
        const oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll') {
          const canMove = dy > 0 ? (el.scrollTop + el.clientHeight < el.scrollHeight - 1) : (el.scrollTop > 1);
          if (canMove) return el;
        }
      }
      el = el.parentElement;
    }

    const main = document.getElementById('main');
    if (main && main.scrollHeight > main.clientHeight + 2) {
      const canMove = dy > 0 ? (main.scrollTop + main.clientHeight < main.scrollHeight - 1) : (main.scrollTop > 1);
      if (canMove) return main;
    }
    const se = document.scrollingElement || document.documentElement;
    return se && se.scrollHeight > se.clientHeight + 2 ? se : main;
  }

  function applyRightStick(rx, ry, dt, now) {
    const mag = Math.hypot(rx, ry);
    if (mag <= RS_DZ) {
      _rsFlick.dir = 0;
      return false;
    }
    let acted = false;
    // Replay timeline continuous scrub on Right Stick X
    const rp = document.querySelector('.rp2:not(.out)');
    if (rp && Math.abs(rx) > RS_DZ && Math.abs(rx) >= Math.abs(ry) * 0.8) {
      const normX = Math.sign(rx) * Math.pow((Math.abs(rx) - RS_DZ) / (1 - RS_DZ), 1.6);
      seekReplay(normX * 26 * dt);
      acted = true;
    } else if (Math.abs(rx) >= 0.55 && Math.abs(rx) > Math.abs(ry) * 1.2) {
      const fdir = rx > 0 ? 1 : -1;
      if (_rsFlick.dir !== fdir || now - _rsFlick.lastAt >= 340) {
        _rsFlick.dir = fdir;
        _rsFlick.lastAt = now;
        if (flickRightStickX(fdir)) acted = true;
      }
    } else if (Math.abs(rx) < 0.25) {
      _rsFlick.dir = 0;
    }

    if (Math.abs(ry) > RS_DZ) {
      const normY = Math.sign(ry) * Math.pow((Math.abs(ry) - RS_DZ) / (1 - RS_DZ), 1.75);
      const dy = normY * 960 * dt;
      const scroller = resolveScrollTarget(dy);
      if (scroller && Math.abs(dy) >= 0.2) {
        scroller.scrollTop += dy;
        acted = true;
      }
    }
    return acted;
  }

  // ---------- Gamepad Polling Tick ----------
  function isButtonDown(pad, idx, prev) {
    const b = pad.buttons && pad.buttons[idx];
    if (!b) return false;
    if (idx === 6 || idx === 7) {
      const v = typeof b.value === 'number' ? b.value : (b.pressed ? 1 : 0);
      return prev ? (b.pressed || v > TRIG_OFF) : (b.pressed || v >= TRIG_ON);
    }
    return !!b.pressed || (typeof b.value === 'number' && b.value >= 0.65);
  }

  function poll(now) {
    if (typeof now !== 'number') now = performance.now();
    const dt = _lastTs ? Math.min(0.1, Math.max(0.001, (now - _lastTs) / 1000)) : (1 / 60);
    _lastTs = now;

    const pads = validPads();
    state.padsCount = pads.length;
    state.connected = pads.length > 0;
    if (!pads.length) {
      _padBtns.clear();
      _dirState.dir = null;
      return false;
    }

    let anyInput = false;
    let activePad = null;
    let combinedDir = null;
    let combinedVec = null;
    let bestRx = 0, bestRy = 0;

    // Prune disconnected indices
    const seenIdx = new Set(pads.map(p => p.index));
    for (const k of _padBtns.keys()) if (!seenIdx.has(k)) _padBtns.delete(k);

    for (const pad of pads) {
      const prev = _padBtns.get(pad.index) || new Array(17).fill(false);
      const curr = new Array(17).fill(false);
      const justPressed = [];
      for (let i = 0; i < 17; i++) {
        curr[i] = isButtonDown(pad, i, prev[i]);
        if (curr[i] && !prev[i]) justPressed.push(i);
      }
      _padBtns.set(pad.index, curr);

      const axes = pad.axes || [];
      const lx = Number.isFinite(axes[0]) ? axes[0] : 0;
      const ly = Number.isFinite(axes[1]) ? axes[1] : 0;
      const rx = Number.isFinite(axes[2]) ? axes[2] : 0;
      const ry = Number.isFinite(axes[3]) ? axes[3] : 0;

      const lMag = Math.hypot(lx, ly);
      const lThresh = _dirState.dir ? STICK_REL : STICK_DZ;
      let padDir = null;
      let padVec = null;
      if (curr[12]) padDir = 'up';
      else if (curr[13]) padDir = 'down';
      else if (curr[14]) padDir = 'left';
      else if (curr[15]) padDir = 'right';
      else if (lMag >= lThresh) {
        padDir = Math.abs(lx) >= Math.abs(ly) * 1.08 ? (lx < 0 ? 'left' : 'right') : (ly < 0 ? 'up' : 'down');
        padVec = [lx, ly];
      }

      if (justPressed.length || padDir || Math.hypot(rx, ry) > RS_DZ) {
        anyInput = true;
        activePad = pad;
      }
      if (!combinedDir && padDir) { combinedDir = padDir; combinedVec = padVec; }
      if (Math.hypot(rx, ry) > Math.hypot(bestRx, bestRy)) { bestRx = rx; bestRy = ry; }

      // Process newly pressed buttons on this pad
      if (justPressed.length) {
        state.activePadIndex = pad.index;
        state.activePadId = pad.id || '';
        if (document.documentElement.dataset.input !== 'pad' || detectLayout(pad.id) !== state.layout) {
          setInputMode('pad', pad);
        }
        for (const btn of justPressed) {
          handleButtonPress(btn);
        }
      }
    }

    if (anyInput && activePad) {
      state.activePadIndex = activePad.index;
      state.activePadId = activePad.id || '';
      if (document.documentElement.dataset.input !== 'pad' || detectLayout(activePad.id) !== state.layout) {
        setInputMode('pad', activePad);
      }
    }

    // Directional movement + auto-repeat
    if (combinedDir) {
      if (_dirState.dir !== combinedDir) {
        _dirState.dir = combinedDir;
        _dirState.since = now;
        _dirState.lastStep = now;
        _dirState.count = 1;
        state.lastAction = 'dir:' + combinedDir;
        spatial(combinedDir, { fromPad: true, vec: combinedVec });
      } else {
        const wait = _dirState.count === 1 ? REPEAT_DELAY_MS : (_dirState.count <= 5 ? REPEAT_SLOW_MS : REPEAT_FAST_MS);
        if (now - _dirState.lastStep >= wait) {
          _dirState.lastStep = now;
          _dirState.count++;
          state.lastAction = 'dir:' + combinedDir;
          spatial(combinedDir, { fromPad: true, vec: combinedVec });
        }
      }
    } else {
      _dirState.dir = null;
      _dirState.count = 0;
    }

    // Right-stick continuous scroll / scrub
    if (applyRightStick(bestRx, bestRy, dt, now)) {
      state.lastAction = 'rstick';
    }

    return anyInput;
  }

  const HOOK_BTN = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 6: 'LT', 7: 'RT', 11: 'R' };
  function handleButtonPress(btn) {
    if (HOOK_BTN[btn] && hookPress(HOOK_BTN[btn])) {
      state.lastAction = HOOK_BTN[btn];
      if (btn === 0) markPressed(document.activeElement);
      return;
    }
    switch (btn) {
      case 0: // A / Cross
        state.lastAction = 'A';
        markPressed(document.activeElement);
        activate(document.activeElement);
        break;
      case 1: // B / Circle
        state.lastAction = 'B';
        pressBack();
        break;
      case 2: // X / Square
        state.lastAction = 'X';
        contextAction();
        break;
      case 3: // Y / Triangle
        state.lastAction = 'Y';
        pressY();
        break;
      case 4: // LB / L1
        state.lastAction = 'LB';
        cycleTopScreen(-1);
        break;
      case 5: // RB / R1
        state.lastAction = 'RB';
        cycleTopScreen(1);
        break;
      case 6: // LT / L2
        state.lastAction = 'LT';
        cycleSubTab(-1);
        break;
      case 7: // RT / R2
        state.lastAction = 'RT';
        cycleSubTab(1);
        break;
      case 8: { // View / Select / Share -> toggle Viewing as (P1 <-> P2)
        state.lastAction = 'VIEW';
        const va = document.getElementById('viewAs');
        if (va) va.click();
        break;
      }
      case 9: { // Menu / Start / Options -> Play/Pause in Replay, else Search
        state.lastAction = 'MENU';
        const rp = document.querySelector('.rp2:not(.out)');
        if (rp) {
          const pb = rp.querySelector('#rp2Play');
          if (pb) pb.click();
        } else {
          pressY();
        }
        break;
      }
      case 10: { // L3 -> scroll to top & focus primary element
        state.lastAction = 'L3';
        const m = document.getElementById('main');
        if (m) m.scrollTop = 0;
        const se = document.scrollingElement || document.documentElement;
        if (se) se.scrollTop = 0;
        ensureFocus();
        break;
      }
      case 11: // R3 -> context secondary (Compare on Squad, News on Hub)
        state.lastAction = 'R3';
        pressR3();
        break;
      default:
        break;
    }
  }

  function loop(now) {
    _rafId = requestAnimationFrame(loop);
    poll(now);
  }

  // ---------- Event Wiring ----------
  addEventListener('gamepadconnected', e => {
    const pad = e.gamepad;
    state.connected = true;
    state.activePadIndex = pad ? pad.index : 0;
    state.activePadId = (pad && pad.id) || '';
    setInputMode('pad', pad);
    ensureFocus();
    const kind = detectLayout(state.activePadId) === 'ps' ? 'PlayStation' : 'Xbox / XInput';
    showPadToast(`Controller ${(pad ? pad.index : 0) + 1} connected · ${kind}`, false);
  });

  addEventListener('gamepaddisconnected', e => {
    const rem = validPads();
    state.padsCount = rem.length;
    state.connected = rem.length > 0;
    if (!rem.length && document.documentElement.dataset.input === 'pad') {
      setInputMode('', null);
      showPadToast('Controller disconnected', true);
    }
  });

  // Preserve pad mode across internal synthetic Escape events, while switching to kb on genuine keyboard presses
  addEventListener('keydown', e => {
    if (e.__gp) {
      if (state.mode === 'pad') {
        document.documentElement.dataset.input = 'pad';
        try { renderPadPrompts(); } catch (_) { /* */ }
      }
      return;
    }
    if (e.key && e.key.length) {
      state.mode = 'kb';
      clearGpFocus();
    }
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) markPressed(document.activeElement);
    // A modal keeps the keyboard focus inside (Tab / Shift+Tab wrap), as the pad's focus pool does
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const modal = activeModal();
      if (modal && !modal.classList.contains('rp2')) {
        const pool = focusPool(modal);
        if (pool.length) {
          const i = pool.indexOf(document.activeElement);
          const next = pool[(i < 0 ? 0 : i + (e.shiftKey ? -1 : 1) + pool.length) % pool.length];
          e.preventDefault();
          focusElement(next, { fromPad: false, noPreview: true });
        }
      } else if (!modal) {
        // Focus never leaves the app: Tab on the last stop wraps to the first (Shift+Tab on the first wraps to the last)
        const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
        const order = Array.from(document.querySelectorAll(TABBABLE)).filter(el => el.tabIndex >= 0 && visibleEl(el) && !el.closest('.rp2, .mc-pop, #overlay'));
        const a = document.activeElement, i = order.indexOf(a);
        const wrapTo = e.shiftKey ? (i === 0 ? order[order.length - 1] : null) : (i === order.length - 1 ? order[0] : null);
        if (order.length && (wrapTo || !a || a === document.body)) {
          e.preventDefault();
          focusElement(wrapTo || (e.shiftKey ? order[order.length - 1] : order[0]), { fromPad: false, noPreview: true });
        }
      }
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) {
      if ((e.key === 'x' || e.key === 'X') && !document.querySelector('.rp2:not(.out)')) {
        if (contextAction()) e.preventDefault();
      }
    }
  }, false);

  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') clearGpFocus();
  }, { passive: true, capture: true });

  document.addEventListener('focusin', () => {
    if (document.documentElement.dataset.input === 'pad') syncFocus();
  });

  document.addEventListener('click', e => {
    const p = e.target.closest('.prompt[data-gp-act]');
    if (!p) return;
    e.preventDefault();
    const act = p.dataset.gpAct;
    if (act.startsWith('hook:')) { const nm = act.slice(5); if (!hookPress(nm)) { if (nm === 'A') activate(document.activeElement); else if (nm === 'B') pressBack(); else if (nm === 'Y') pressY(); else if (nm === 'X') contextAction(); else if (nm === 'RT' || nm === 'LT') cycleSubTab(nm === 'RT' ? 1 : -1); else if (nm === 'R') { if (!pressR3()) flickRightStickX(1); } } return; }
    if (act === 'select') activate(document.activeElement);
    else if (act === 'back') pressBack();
    else if (act === 'context') contextAction();
    else if (act === 'y') pressY();
    else if (act === 'tabs') cycleSubTab(1);
    else if (act === 'screens') cycleTopScreen(1);
    else if (act === 'r3') pressR3();
  });

  // Keep focusability, search overlay tabs, and controller prompt bar synced on relevant DOM mutations
  let _moQueued = false;
  function isRelevantMutation(r) {
    const t = r.target && r.target.nodeType === 1 ? r.target : (r.target && r.target.parentElement);
    if (!t) return false;
    if (t.closest && t.closest('#prompts, #gpToast, #tip')) return false;
    if (r.type === 'attributes') {
      if (r.attributeName === 'hidden') return true;
      return t.id === 'overlay' || t.classList.contains('rp2') || t.classList.contains('mc-pop');
    }
    return true;
  }
  const mo = new MutationObserver(records => {
    if (_moQueued || !records.some(isRelevantMutation)) return;
    _moQueued = true;
    setTimeout(() => {
      _moQueued = false;
      const main = document.getElementById('main');
      if (main) enhanceFocusable(main);
      const openModal = activeModal();
      if (openModal) enhanceFocusable(openModal);
      const ov = document.getElementById('overlay');
      if (ov && ov.classList.contains('on')) enhanceSearchOverlay();
      if (document.documentElement.dataset.input === 'pad') {
        const modal = activeModal();
        const act = document.activeElement;
        if (modal && act && !modal.contains(act)) {
          ensureFocus();
        } else if (!modal && (!act || act === document.body || !act.isConnected || (main && !main.contains(act)))) {
          if (!document.querySelector('#main .loading') && !window.__viewRender) ensureFocus();
        } else {
          syncFocus();
        }
        try { renderPadPrompts(); } catch (_) { /* */ }
      }
    }, 0);
  });

  function start() {
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    const pads = validPads();
    if (pads.length) {
      state.connected = true;
      state.padsCount = pads.length;
      state.activePadIndex = pads[0].index;
      state.activePadId = pads[0].id || '';
      if (!document.documentElement.dataset.input) setInputMode('pad', pads[0]);
    }
    if (!_rafId) _rafId = requestAnimationFrame(loop);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  const API = {
    state,
    poll,
    spatial,
    focusPool,
    activeScope,
    activeModal,
    activate,
    contextAction,
    getContextSpec,
    cycleTopScreen,
    cycleSubTab,
    pressBack,
    pressY,
    pressR3,
    ensureFocus,
    syncFocus,
    enhance: enhanceFocusable,
    setInputMode,
    setMockPads(pads) { _mockPads = pads; },
    clearMockPads() { _mockPads = null; _padBtns.clear(); _dirState.dir = null; },
  };

  window.FC = window.FC || {};
  window.FC.gamepad = API;
  window.FC_GAMEPAD = API;
})();
