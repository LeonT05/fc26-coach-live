/* Shell behaviour: 6-tab IA (docs/ux_feature_review.md §1.3), FC26 header + prompt bar (clickable glyphs),
   controller-ready spatial focus model, search overlay, sub-tab underline slide, "Viewing as" switch.
   Loaded after the page modules and before app.js; overrides the shell functions declared in core.js. */
'use strict';

// ---------- IA: 6 top tabs ----------
PAGES.length = 0;
[['hub', 'Central'], ['matches', 'Matches'], ['findings', 'Coaching'], ['squad', 'Squad'], ['tactics', 'Tactics'], ['scouting', 'Transfers']].forEach(p => PAGES.push(p));
Object.assign(PARENT, { duo: 'findings', coach: 'findings' });
const GROUPS = {
  findings: [['findings', 'Findings', {}], ['duo', 'Together', {}], ['coach', 'Debrief', {}]],
  // Transfers renders its own Director's Desk · Academy tabs (Leon 23 Nov: no Inbox, Director first)
};
// coach&tab=director belongs to Transfers
navIndex = function (page) {
  let pg = page === 'coach' && S.tab === 'director' ? 'scouting' : (PARENT[page] || page);
  return PAGES.findIndex(x => x[0] === pg);
};
function groupOf(S) { if (S.page === 'coach') return S.tab === 'director' ? 'scouting' : 'findings'; if (S.page === 'duo') return 'findings'; return GROUPS[S.page] ? S.page : null; }
function groupTabs(S) {
  const g = groupOf(S); if (!g || !GROUPS[g] || S.page === 'findings') return '';   // Coaching renders its own tab row
  const cur = S.page === 'coach' ? (S.tab === 'director' ? 'coach-director' : 'coach') : S.page;
  return `<nav class="stabs grp"><span class="gl lt">LT</span>${GROUPS[g].map(([p, l, extra]) => { const key = p === 'coach' && extra.tab ? 'coach-director' : p; return `<a href="${href({ page: p, ...extra })}" class="${key === cur ? 'on' : ''}">${esc(l)}</a>`; }).join('')}<span class="gl lt">RT</span></nav>`;
}
['findings', 'duo', 'coach', 'scouting'].forEach(k => {
  const pg = REG[k]; if (!pg || pg.__grouped) return;
  const r = pg.render; pg.render = S => groupTabs(S) + r(S); pg.__grouped = true;
});

// ---------- header ----------
function viewer() { try { return localStorage.getItem('fc26.viewer') === 'p2' ? 'p2' : 'p1'; } catch (e) { return 'p1'; } }
function buildNav() {
  $('#tabs').innerHTML = PAGES.map(([k, l], i) => `<a href="#page=${k}" data-p="${k}" data-i="${i}">${esc(l)}</a>`).join('');
}
// Header club progress (Figma Club Progress Bar 211:1573, brief career-security-header): the game's own club progress bar,
// 4 segments 103/19/29/46 px, green = career.board_confidence (a pixel estimate of the in-game bar, so NO number is shown).
// Not captured: grey track at 60 % and "–" after the club name. Not focusable, no tooltip (UX-9). The last 6 results live on Central.
const CLUB_SEGS = [103, 19, 29, 46];
function clubProgress() { const c = (typeof car === 'function' && car()) || window.FC26_CAREER || {}; const v = c.board_confidence; return isNum(v) && v >= 0 && v <= 100 ? v : null; }
function buildHeader() {
  $('#brandClub').textContent = clubName();
  const v = clubProgress(), tot = CLUB_SEGS.reduce((a, b) => a + b, 0);
  let left = v == null ? 0 : v / 100 * tot;
  const sb = $('#segbar');
  sb.innerHTML = CLUB_SEGS.map(w => { const f = Math.max(0, Math.min(w, left)); left -= w; return `<i style="--w:${w}"><b style="width:${(f / w * 100).toFixed(1)}%"></b></i>`; }).join('');
  sb.classList.toggle('nc', v == null);
  sb.removeAttribute('tabindex'); delete sb.dataset.tip; sb.setAttribute('aria-hidden', 'true');
  $('#brandClub').dataset.nc = v == null ? '1' : '';
  const v2 = viewer();
  $('#viewAs').innerHTML = `<span class="dot ${v2}"></span>${esc(v2 === 'p2' ? P2() : P1())}`;
  $('#viewAs').dataset.tip = 'Viewing as — click to switch between ' + esc(P1()) + ' and ' + esc(P2());
  if (!window.__viewAsSync) { window.__viewAsSync = true; addEventListener('storage', e => { if (e.key === 'fc26.viewer') { buildHeader(); render(); } }); }
}

// ---------- prompt bar (FC26 hint bar, clickable) ----------
function prompts() {
  const rp = document.querySelector('.rp2:not(.out)');
  const modal = rp || document.querySelector('.mc-pop:not([hidden])');
  const pin = window.FC_TIP ? FC_TIP.label() : '';   // Y pins the focused element's tip (Figma Tooltip 179:881)
  const KC = { A: 'Enter', B: 'Esc', Y: 'Y', X: 'X' }, kb = document.documentElement.dataset.input === 'kb';
  const glyph = g => kb ? `<span class="gl kc">${KC[g] || g}</span>` : `<span class="gl c">${g}</span>`;
  if (rp && typeof RP2 === 'object' && RP2.promptSpec) {
    // Replay popup (Figma 100:1828 prompt bar 100:2005): A Pause · B Close · LT/RT Speed n× · X Skip stoppages: On/Off
    const sp = RP2.promptSpec(document.activeElement);
    $('#prompts').innerHTML = `<button type="button" class="prompt" data-act="select">${glyph('A')}${esc(sp.a)}</button>`
      + `<button type="button" class="prompt" data-act="back">${glyph('B')}Close</button>`
      + `<button type="button" class="prompt" data-act="speed">${kb ? '<span class="gl kc">Z</span><span class="gl kc">C</span>' : '<span class="gl-pair"><span class="gl tr">LT</span><span class="gl tr">RT</span></span>'}Speed ${sp.speed}×</button>`
      + `<button type="button" class="prompt" data-act="skip">${glyph('X')}Skip stoppages: ${sp.skip ? 'On' : 'Off'}</button>`;
    return;
  }
  const P = modal ? [['A', 'Select', 'select'], ['B', 'Close', 'back']] : [['A', 'Select', 'select'], ...(PARENT[S.page] || S.page === 'prematch' || ovOpen() || S.cmp || (window.NAVSTATE && NAVSTATE.canBack()) ? [['B', S.cmp ? 'Close compare' : 'Back', 'back']] : []), pin ? ['Y', pin, 'pin'] : ['Y', 'Search', 'search']];
  if (modal && pin) P.push(['Y', pin, 'pin']);
  // Like the game: controller glyphs by default; after a keyboard key press the prompts switch to PC keycaps
  // (research §19 hint_bar__keyboard_keycaps).
  $('#prompts').innerHTML = P.map(([g, l, act]) => `<button type="button" class="prompt" data-act="${act}">${glyph(g)}${l}</button>`).join('');
  // QA SH-7: Leon plays on keyboard/mouse: the screen and tab keys are always discoverable as keycaps
  const tabs = REG[S.page] && REG[S.page].tabs && REG[S.page].tabs(S).length > 1;
  $('#prompts').insertAdjacentHTML('beforeend', `<span class="prompt kchint"><span class="gl kc">Q</span><span class="gl kc">E</span>Screens</span>${tabs ? '<span class="prompt kchint"><span class="gl kc">Z</span><span class="gl kc">C</span>Tabs</span>' : ''}`);
}
addEventListener('keydown', e => { if (e.key && e.key.length && document.documentElement.dataset.input !== 'kb') { document.documentElement.dataset.input = 'kb'; try { prompts(); } catch (_) {} } }, true);
function doAct(act) {
  if (act === 'select') { const a = document.activeElement; if (a && a !== document.body) activate(a); }
  else if (act === 'back') goBack();
  else if (act === 'search') openSearch();
  else if (act === 'pin') { if (window.FC_TIP) FC_TIP.toggle(); }
  else if (act === 'speed') { if (typeof RP2 === 'object' && RP2.speedStep) RP2.speedStep(1, true); }
  else if (act === 'skip') { if (typeof RP2 === 'object' && RP2.toggleSkip) RP2.toggleSkip(); }
}
function goBack() {
  if (ovOpen()) return closeOverlay();
  if (window.goBackApp) return goBackApp();
  if (PARENT[S.page]) nav({ page: PARENT[S.page] }); else if (history.length > 1) history.back();
}
function activate(el) {
  if (el.matches('[data-href]') && !el.matches('a')) { location.hash = el.dataset.href.replace(/^#/, ''); return; }
  el.click();
}

// ---------- focus model (spatial; controller-ready) ----------
const FOCUSABLE = 'a[href], button:not([disabled]), select, input, [data-href], .xh, .vcard, [tabindex="0"]';
function visibleEl(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
function focusPool() {
  const root = ovOpen() ? $('#overlay') : document;
  return $$(FOCUSABLE, root).filter(el => visibleEl(el) && !el.closest('[hidden]') && !el.closest('#tip'));
}
function spatial(dir) {
  const pool = focusPool(); if (!pool.length) return;
  const cur = document.activeElement;
  if (!cur || cur === document.body || !pool.includes(cur)) { const first = $('#main .page') ? focusPool().find(e => e.closest('#main')) : pool[0]; (first || pool[0]).focus(); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const el of pool) {
    if (el === cur || el.contains(cur) || cur.contains(el)) continue;
    const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    let main, orth;
    if (dir === 'left') { if (b.right > a.left + 2) continue; main = -dx; orth = Math.abs(dy); }
    else if (dir === 'right') { if (b.left < a.right - 2) continue; main = dx; orth = Math.abs(dy); }
    else if (dir === 'up') { if (b.bottom > a.top + 2) continue; main = -dy; orth = Math.abs(dx); }
    else { if (b.top < a.bottom - 2) continue; main = dy; orth = Math.abs(dx); }
    const s = main + orth * 2.2;
    if (s < bs) { bs = s; best = el; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
}
function makeFocusable(root) {
  $$('[data-href]:not(a), .xh, .vcard', root).forEach(el => { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0'); });
}

// ---------- overlay: search / quick jump ----------
function ovOpen() { const o = $('#overlay'); return o && o.classList.contains('on'); }
let _ovReturn = null;
function openOverlay(html) {
  const o = $('#overlay'); _ovReturn = document.activeElement;
  o.innerHTML = `<div class="panel"><button type="button" class="ov-x" data-close="1" aria-label="Close">${ICON.close}</button>${html}</div>`;
  o.classList.add('on'); prompts();
}
function closeOverlay() {
  const o = $('#overlay'); o.classList.remove('on'); o.innerHTML = ''; prompts();
  if (_ovReturn && _ovReturn.isConnected) _ovReturn.focus({ preventScroll: true });
}
// Search overlay (Figma Search Overlay 225:2338, brief controller-support): LT/RT categories with counts (Leon: ON),
// two-line rows (face for players, kind in the meta line), word-start matching. Entry focus = the input; ↓ into the results.
function qsGameDate(s) { const m = String(s || '').match(/^(\d{1,2})\s+([A-Za-z]{3})/); return m ? `${+m[1]} ${m[2]}` : ''; }
function searchItems() {
  // QA SH-8: every player (squad status + youth), the Director's decisions, the sub-screens, full opponent names
  const it = [['#page=hub', 'Central'], ['#page=matches', 'Matches'], ['#page=findings', 'Coaching'], ['#page=findings&tab=duo', 'Coaching · Together'], ['#page=findings&tab=team', 'Coaching · Team'],
    ['#page=squad', 'Squad'], ['#page=tactics', 'Tactics'], ['#page=scouting', "Transfers · Director's Desk"], ['#page=scouting&tab=academy', 'Transfers · Academy'], ['#page=prematch', 'Pre-match']].map(([h, l]) => ({ h, l, k: 'Screen', t: 'screens', m: 'Screen' }));
  const seen = new Set();
  (typeof squadList === 'function' ? squadList() : playerList()).forEach(p => {
    seen.add(fold(p.name)); const pos = (p.natural && p.natural.length ? p.natural.slice(0, 2).join('/') : p.pos) || '';
    it.push({ h: playerByName(p.name) && fold(playerByName(p.name).name) === fold(p.name) ? plink(p) : '#page=squad&sel=' + encodeURIComponent(p.name), l: p.name, k: (p.pos || 'Player') + (p.ovr ? ' · ' + p.ovr : ''), t: 'players', p,
      m: ['Player', pos, isNum(p.ovr) ? p.ovr : isNum(p.age) ? p.age + ' y' : ''].filter(Boolean).join(' · ') });
  });
  (((window.FC26_SQUAD || {}).youth) || []).forEach(y => { if (!seen.has(fold(y.name))) it.push({ h: '#page=youth&n=' + encodeURIComponent(y.name), l: y.name, k: `Academy · ${y.pos || ''}${y.ovr ? ' · ' + y.ovr : ''}`, t: 'players', p: { name: y.name }, m: ['Academy', y.pos, y.ovr].filter(Boolean).join(' · ') }); });
  const dv = typeof directorFor === 'function' ? latestWith(directorFor) : null;
  (typeof deskDecisions === 'function' ? deskDecisions() : []).forEach((e, i) => it.push({ h: '#page=scouting&d=' + i, l: e.label, k: 'Decision · ' + e.tag, t: 'decisions', m: 'Decision · Director' + (dv ? ', ' + shortDate(dv.day) : '') }));
  matchList().slice().reverse().forEach(m => {
    const tm = m.teams || [m.ours, m.opp], sc = String(m.title || '').match(/(\d+)\s*[–-]\s*(\d+)/);
    const l = tm[0] && tm[1] && sc ? `${teamName(tm[0])} ${sc[1]}–${sc[2]} ${teamName(tm[1])}` : m.title;
    it.push({ h: '#page=match&id=' + encodeURIComponent(m.id), l, k: shortDate(m.date), t: 'matches', s: m.title, m: ['Match', qsGameDate(m.date) || shortDate(m.day), m.competition].filter(Boolean).join(' · ') });
  });
  return it;
}
const QS_CATS = [['all', 'All'], ['screens', 'Screens'], ['players', 'Players'], ['matches', 'Matches'], ['decisions', 'Decisions']];
const QS = { cat: 'all', all: [] };
function qsHit(i, q) { if (!q) return true; const w = `${i.l} ${i.s || ''}`.split(/[\s·:,()&/–-]+/).map(fold); return w.some(x => x && x.startsWith(q)) || fold(i.l).startsWith(q); }
function qsRow(i) {
  return `<a href="${i.h}" class="qsr${i.p ? ' face' : ''}">${i.p ? `<span class="qf">${portrait(i.p, 'S')}</span>` : ''}<span class="qt"><b>${esc(i.l)}</b><small>${esc(i.m || i.k)}</small></span></a>`;
}
function qsDraw() {
  const inp = $('#qsIn'), res = $('#qsRes'), bar = $('#overlay .gp-qstabs'); if (!inp || !res) return;
  const q = fold(inp.value.trim()), hits = QS.all.filter(i => qsHit(i, q)), n = k => k === 'all' ? hits.length : hits.filter(i => i.t === k).length;
  if (bar) bar.querySelectorAll('a[data-cat]').forEach(b => { b.classList.toggle('on', b.dataset.cat === QS.cat); b.querySelector('i').textContent = q ? ' ' + n(b.dataset.cat) : ''; });
  const list = hits.filter(i => QS.cat === 'all' || i.t === QS.cat).slice(0, q ? 40 : 14);
  const name = (QS_CATS.find(c => c[0] === QS.cat) || ['', ''])[1].toLowerCase();
  res.innerHTML = list.map(qsRow).join('') || `<div class="empty">${q ? `No ${QS.cat === 'all' ? 'results' : esc(name)} match “${esc(inp.value.trim())}”` : 'Nothing in this group'}</div>`;
  if (bar && typeof placeUlines === 'function') placeUlines($('#overlay'));
}
function qsFocusRow(j) {
  const as = $$('#qsRes a'); as.forEach((a, k) => a.classList.toggle('on', k === j));
  if (j < 0 || !as[j]) { const inp = $('#qsIn'); if (inp) inp.focus({ preventScroll: true }); return null; }
  as[j].scrollIntoView({ block: 'nearest' }); as[j].focus({ preventScroll: true }); return as[j];
}
// LT / RT (Z / C): previous / next category; focus stays where it was (input) or moves to the first row of the new group
window.qsCycle = dir => {
  const i = QS_CATS.findIndex(c => c[0] === QS.cat), inInput = document.activeElement === $('#qsIn') && !$('#qsRes a.on');
  QS.cat = QS_CATS[(i + dir + QS_CATS.length) % QS_CATS.length][0]; qsDraw();
  return inInput ? null : qsFocusRow(0);
};
window.qsClear = () => { const inp = $('#qsIn'); if (!inp) return; inp.value = ''; qsDraw(); inp.focus(); try { prompts(); } catch (e) { /* */ } };
function openSearch() {
  openOverlay(`<div class="qs-in"><span class="qs-ic" aria-hidden="true"></span><input id="qsIn" placeholder="Search players, matches, screens" autocomplete="off" aria-label="Search"></div>
    <nav class="gp-qstabs stabs" aria-label="Search categories"><span class="gl lt">LT</span>${QS_CATS.map(([k, l]) => `<a data-cat="${k}" role="tab" tabindex="-1">${l}<i></i></a>`).join('')}<span class="gl lt">RT</span></nav>
    <div class="qsres" id="qsRes"></div>`);
  QS.all = searchItems(); QS.cat = 'all';
  const inp = $('#qsIn'), ov = $('#overlay');
  inp.addEventListener('input', () => { qsDraw(); try { prompts(); } catch (e) { /* */ } });
  ov.querySelector('.gp-qstabs').addEventListener('click', e => { const b = e.target.closest('a[data-cat]'); if (b) { QS.cat = b.dataset.cat; qsDraw(); } });
  if (!ov.__qsKeys) {
    ov.__qsKeys = true;
    ov.addEventListener('keydown', e => {
      if (!ov.classList.contains('on') || !$('#qsIn')) return;
      const inp2 = $('#qsIn'), as = $$('#qsRes a'), ae = document.activeElement, i = as.indexOf(ae);
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { stop(); qsFocusRow(e.key === 'ArrowDown' ? Math.min(as.length - 1, i + 1) : i - 1); try { prompts(); } catch (er) { /* */ } }
      else if (e.key === 'Enter') { stop(); const a = as[i] || as[0]; if (a) { closeOverlay(); location.hash = a.getAttribute('href').slice(1); } }
      else if (ae !== inp2 && /^[zZcC]$/.test(e.key)) { stop(); window.qsCycle(/[zZ]/.test(e.key) ? -1 : 1); }
      else if (ae !== inp2 && /^[xX]$/.test(e.key) && inp2.value) { stop(); window.qsClear(); }
    }, true);
  }
  qsDraw(); inp.focus();
}

// ---------- sub-tab underline slide ----------
const _uline = {};
function placeUlines(root) {
  $$('.stabs', root).forEach((nv, idx) => {
    const on = $('a.on', nv); if (!on) return;
    let u = $('.uline', nv); if (!u) { u = document.createElement('i'); u.className = 'uline'; nv.appendChild(u); }
    const key = (nv.classList.contains('grp') ? 'grp' : 'tabs') + idx;
    const w = Math.max(28, on.offsetWidth * .45), x = on.offsetLeft + (on.offsetWidth - w) / 2;
    const prev = _uline[key];
    u.style.width = w + 'px';
    if (prev && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      u.style.transition = 'none'; u.style.transform = `translateX(${prev}px)`; void u.offsetWidth; u.style.transition = '';
    }
    requestAnimationFrame(() => { u.style.transform = `translateX(${x}px)`; });
    _uline[key] = x;
  });
}

// ---------- wiring ----------
(function wireShell() {
  // after every render: focusability, underline, page-name, direction of travel
  const mo = new MutationObserver(() => { const pg = $('#main .page'); if (!pg || pg.__shellDone) return; pg.__shellDone = true; makeFocusable(pg); placeUlines(pg); });
  document.addEventListener('DOMContentLoaded', () => mo.observe($('#main'), { childList: true }));
  if (document.readyState !== 'loading') mo.observe($('#main'), { childList: true });
  document.addEventListener('click', e => {
    const p = e.target.closest('.prompt[data-act]'); if (p) { doAct(p.dataset.act); return; }
    const g = e.target.closest('button.gl[data-key]'); if (g) { const k = g.dataset.key; if (k === 'LB') cycleNav(-1); else if (k === 'RB') cycleNav(1); else if (k === 'LT') cycleTab(-1); else if (k === 'RT') cycleTab(1); return; }
    if (e.target.closest('#viewAs')) { try { localStorage.setItem('fc26.viewer', viewer() === 'p1' ? 'p2' : 'p1'); } catch (er) { /* ignore */ } buildHeader(); render(); return; }
    if (e.target === $('#overlay') || e.target.closest('.ov-x')) { closeOverlay(); return; }
    const qa = e.target.closest('#qsRes a'); if (qa) closeOverlay();
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const inField = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
    if (e.key === 'Escape') { if (ovOpen()) { e.preventDefault(); closeOverlay(); e.stopImmediatePropagation(); } return; }
    if (inField) return;
    if (ovOpen() && !/Arrow|Enter|Tab/.test(e.key)) return;
    if ((e.key === 'y' || e.key === 'Y') && window.FC_TIP && (FC_TIP.pinned || FC_TIP.label()) && FC_TIP.toggle()) { e.preventDefault(); return; }   // Y pins the focused tip
    if (e.key === '/' || e.key === 'y' || e.key === 'Y') { e.preventDefault(); openSearch(); return; }
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key] && !(S.page === 'match' && S.tab === 'replay' && /Left|Right/.test(e.key) && !document.querySelector('.rp2:not(.out)'))) { e.preventDefault(); spatial(map[e.key]); return; }
    if (e.key === 'Enter' && document.activeElement && document.activeElement.matches('[data-href]:not(a), .xh, .vcard')) { e.preventDefault(); activate(document.activeElement); }
  }, true);
})();

// header title: "Home" for the top-level tabs (like the game's Home → Central/Squad/...), screen name for deep pages
const DEEP_TITLES = { match: 'Match Centre', player: 'Player Profile', youth: 'Player Profile' };
// Header title = the area name (UX rule): the header tab's name, or the deep page's own name. Only the hub says Home (as the game).
const AREA_TITLES = { hub: 'Central', matches: 'Matches', findings: 'Coaching', duo: 'Coaching', squad: 'Squad', tactics: 'Tactics', scouting: 'Transfers', prematch: 'Pre-match' };
function areaTitle() { if (DEEP_TITLES[S.page]) return DEEP_TITLES[S.page]; if (S.page === 'coach') return S.tab === 'director' ? 'Transfers' : 'Coaching'; return AREA_TITLES[S.page] || 'Home'; }
(function titleSync() {
  const mo = new MutationObserver(() => { const pn = $('#pageName'); if (pn) pn.textContent = areaTitle(); });
  const start = () => mo.observe($('#main'), { childList: true });
  if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
})();

// ---------- generic components (match Figma: Confidence Badge, Freshness Stamp, Rating Ring, Portrait) ----------
const SIL = '<img class="silimg" src="assets/silhouette_fc26.png" alt="" aria-hidden="true" draggable="false">';  // the real FC 26 unknown-player cutout (Figma Portrait 9:101, nodes 217:1857-1859; Leon 2026-11-24)
// Leon 2026-11-23: no A-D letter grades. Shaky values say so in words ("est."); D-grade values are hidden by the pages.
function qBadge(grade, tip) { const g = String(grade || '').toUpperCase(); return g === 'C' ? `<span class="est">minimap estimate</span>` : ''; }
function freshStamp(dateStr, o = {}) {
  if (!dateStr) return '<span class="fresh none">not captured</span>';
  const d = parseDate(dateStr), txt = d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : dateStr;
  return `<span class="fresh ${o.stale ? 'stale' : ''}" data-tip="Read from the game on ${esc(txt)}${o.stale ? ' — older than the last session' : ''}">as of ${esc(txt)}${o.stale ? ' · stale' : ''}</span>`;
}
function ratingBand(r) { return !isNum(r) ? 'None' : r >= 7.5 ? 'Hi' : r >= 6.5 ? 'Mid' : r >= 6 ? 'Six' : 'Low'; }
function ratingRing(r, size = 'L', o = {}) { const b = o.low ? 'None' : ratingBand(r); const v = isNum(r) ? Math.max(0, Math.min(100, r * 10)) : 0; return `<span class="rr ${size} ${b}" style="--v:${v.toFixed(0)}">${isNum(r) ? r.toFixed(1) : '–'}</span>`; }
// Portrait: transparent PNG cut-out (data/faces/<id>.png) or the game-style silhouette. (Old note: JPEG crop (soft-masked) → silhouette.
// Small (180 px) cut-outs are used at S/M; at L they get a soft edge (class "soft"). Metadata: window.FC26_EXTERNAL.players.
function extFace(id) {
  const ps = (window.FC26_EXTERNAL || {}).players; if (!ps) return null;
  const list = Array.isArray(ps) ? ps : Object.values(ps);
  return list.find(x => x && (x.id === id || fold(x.name || '') === id)) || null;
}
function portrait(p, size = 'M') {
  // Leon 2026-11-23: ONLY the transparent PNG cut-outs (data/faces/<id>.png). Never the old in-game JPEG crops
  // (<id>.jpg / .ext.jpg). No PNG (youth) -> silhouette. No backdrop, except the big L header portrait (as the game).
  const id = p && (p.id || fold(p.name || ''));
  const ex = id ? extFace(id) : null;
  const png = ex && ex.face_png && !/^https?:/.test(ex.face_png) && /\.png$/i.test(ex.face_png) ? 'data/' + ex.face_png : (p && p.face && (/\.png$/i.test(p.face) || /^blob:/i.test(p.face)) ? p.face : (id ? `data/faces/${id}.png` : ''));
  if (!png) return `<span class="pt ${size} sil">${SIL}</span>`;
  const src = typeof resolveAsset === 'function' ? resolveAsset(png) : png;
  if (window.FC26_ENCRYPTED && !/^(?:blob:|data:)/i.test(src)) {
    return `<span class="pt ${size} sil">${SIL}</span>`;
  }
  const fk = String(png).split('/').pop().split('?')[0], fs = ptScaleOf(fk);   // precomputed alpha geometry first (file:// safe)
  return `<span class="pt ${size} cut"><img src="${esc(src)}" alt="" loading="lazy" data-f="${esc(fk)}" onerror="ptFallback(this)"${fs ? ` style="--fs:${fs}"` : ` onload="ptNorm(this)"${PT_NORM.has(src) ? ` style="--fs:${PT_NORM.get(src)}"` : ''}`}></span>`;
}
// round 7 (brief tactics-edit §1): one head size in every face box. The 512 px in-game cut-outs and the 180 px ext. ones are framed
// differently, so each cut-out is scaled by its alpha bounding box: the head width (alpha row at 22 % of the bbox height) is brought
// to 52 % of the box (the median of the 28 PNGs), clamped to 0.85-1.15. Measured once per image (canvas); where the browser
// blocks reading the pixels (file:// in a normal Chrome) the scale stays 1.
const PT_NORM = new Map();
// dashboard/data/faces_bbox.js (fccoach/faces_bbox.py): {faces: {file: [x0, y0, x1, y1, w, h]}, head_w: {file: px}} measured
// offline, so the scale also works where a browser blocks canvas reads (file://); canvas (ptNorm) is only the fallback
function ptScaleOf(file) {
  const B = window.FC26_FACES_BBOX; if (!B || !file) return null;
  const bb = (B.faces || {})[file], hw = (B.head_w || {})[file]; if (!bb || !hw || !bb[4]) return null;
  const r = hw / bb[4]; if (!(r > 0.2)) return null;
  return Math.round(Math.max(0.85, Math.min(1.15, 0.52 / r)) * 100) / 100;
}
function ptNorm(img) {
  const src = img.getAttribute('src'); if (!src) return;
  if (PT_NORM.has(src)) { img.style.setProperty('--fs', PT_NORM.get(src)); return; }
  let k = 1;
  try {
    const n = 96, c = document.createElement('canvas'); c.width = n; c.height = n; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data, A = (x, y) => d[(y * n + x) * 4 + 3] > 128;
    let top = -1; for (let y = 0; y < n && top < 0; y++) for (let x = 0; x < n; x++) if (A(x, y)) { top = y; break; }
    if (top >= 0) { const y = Math.min(n - 1, Math.round(top + 0.22 * (n - top))); let l = -1, r = -1; for (let x = 0; x < n; x++) if (A(x, y)) { if (l < 0) l = x; r = x; }
      const hw = l >= 0 ? (r - l + 1) / n : 0; if (hw > 0.2) k = Math.max(0.85, Math.min(1.15, 0.52 / hw)); }
  } catch (e) { k = 1; }
  k = Math.round(k * 100) / 100; PT_NORM.set(src, k); img.style.setProperty('--fs', k);
}
function ptFallback(img) { const box = img.parentNode; box.classList.remove('cut'); box.classList.add('sil'); box.innerHTML = SIL; }
// rows across the app use the S portrait
avatar = function (p) { return portrait(p, 'S'); };
ring = function (r, cls) { return ratingRing(r, /sm/.test(cls || '') ? 'S' : 'L'); };
