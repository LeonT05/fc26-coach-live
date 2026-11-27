/* Squad › "Depth by age" (replaces the Attributes preset). Brief docs/ui_changes/2026-11-24_squad-depth-by-age.md;
   Figma S1 246:9800 (Squad Depth Panel 243:2655, Depth Reason Panel 243:2909, Depth Cell 240:2470, Depth Position 240:2492).
   One row per slot position of our saved slots (captured_settings.js xi): Starter · Cover (natural) · Next up (academy) ·
   Watch (30+, contract <= 18 months, or a Director sell verdict).
   The export has no depth_by_age block yet (BL-117 c), so the rows are put together here from the export's own fields, with
   ONE stated rule set (critic D-3):
   - natural positions = the in-game reads: squad_status.positions ∪ squad_contracts.pos; the wing pairs count as one
     (RM ≈ RW, LM ≈ LW), the centre pairs share their naturals (RCB/LCB = CB, RCDM/LCDM = CDM);
   - thin = fewer than 2 naturals per slot place now ("thin · n"), or after the Director's sell verdicts ("thin in summer");
   - next up = the academy player at that position nearest the gate (OVR, then POT top); a pair gets two different players;
   - watch = the natural most at risk: a sell verdict, then contract months, then age 30+; a pair gets two different players. */
'use strict';
(function () {
  const ORDER = ['GK', 'RB', 'RCB', 'LCB', 'LB', 'RCDM', 'LCDM', 'RM', 'CAM', 'LM', 'ST'];
  const BASE = { RCB: 'CB', LCB: 'CB', RCDM: 'CDM', LCDM: 'CDM' };
  const WING = { RM: ['RM', 'RW'], LM: ['LM', 'LW'], RW: ['RM', 'RW'], LW: ['LM', 'LW'] };
  const fits = (pos, list) => { const b = BASE[pos] || pos, ok = WING[b] || [b]; return (list || []).some(x => ok.includes(String(x).toUpperCase())); };
  const PAIR = { RCB: 'LCB', LCB: 'RCB', RCDM: 'LCDM', LCDM: 'RCDM' };
  const Y = () => window.YX;
  function model() {
    const SQ = (window.FC26_SQUAD || {}), CS = window.FC26_CAPTURED_SETTINGS || {}, xi = CS.xi || {};
    const L = (typeof squadList === 'function' ? squadList() : playerList()).filter(p => !p.youth);
    const dv = typeof directorFor === 'function' ? latestWith(directorFor) : null, D = dv ? dv.v : {};
    const sells = new Set((D.sell_or_loan || []).filter(x => /sell/i.test(x.action || '')).map(x => fold(x.name)));
    const people = L.map(p => {
      const st = (SQ.squad_status || []).find(r => fold(r.name) === fold(p.name)), c = Y() ? Y().contract(p.name) : null;
      const nat = uniq([...((st && st.positions) || []), ...(c && c.pos ? [c.pos] : [])].map(x => String(x).toUpperCase()));
      return { p, name: p.name, nat, age: isNum(p.age) ? p.age : c && isNum(c.age) ? c.age : null, months: c && isNum(c.contract_months) ? c.contract_months : null, c, sell: sells.has(fold(p.name)), ovr: p.ovr };
    });
    const byName = n => people.find(q => fold(q.name) === fold(n)) || people.find(q => { const a = fold(q.name), b = fold(n); return a.length > 3 && b.length > 3 && (a.slice(0, 4) === b.slice(0, 4)); });
    const youth = (SQ.youth_readiness || []).slice();
    const usedY = new Set(), usedW = new Set(), usedC = new Set(), rows = [];
    for (const pos of ORDER) {
      const bxi = ((D.best_xi || {}).slots || []).find(s => s.pos === pos);
      const st = byName(xi[pos] || '') || (bxi ? byName(bxi.player) : null);
      const nats = people.filter(q => fits(pos, q.nat));
      const places = PAIR[pos] ? 2 : 1, nNow = nats.length, nAfter = nats.filter(q => !q.sell).length;
      const thin = nNow < 2 * places ? 'now' : nAfter < 2 * places ? 'summer' : '';
      // cover: a natural who is not this or the pair's starter and not already the pair's cover; players who stay first
      const pairSt = PAIR[pos] ? byName(xi[PAIR[pos]] || '') : null;
      const cov = nats.filter(q => (!st || q.name !== st.name) && (!pairSt || q.name !== pairSt.name) && !usedC.has(q.name))
        .sort((a, b) => (a.sell ? 1 : 0) - (b.sell ? 1 : 0) || (b.ovr || 0) - (a.ovr || 0))[0] || null;
      if (cov && PAIR[pos]) usedC.add(cov.name);
      const yb = BASE[pos] || pos, yok = WING[yb] || [yb];
      const ny = youth.filter(r => yok.includes(String(r.pos || '').toUpperCase()) && !usedY.has(r.name)).sort((a, b) => (b.ovr || 0) - (a.ovr || 0) || ((b.pot || [])[1] || 0) - ((a.pot || [])[1] || 0))[0] || null;
      if (ny) usedY.add(ny.name);
      const risk = q => q.sell ? 0 : isNum(q.months) && q.months <= 18 ? 1 : isNum(q.age) && q.age >= 30 ? 2 : 9;
      const cand = nats.filter(q => risk(q) < 9 && !usedW.has(q.name)).sort((a, b) => {
        const own = q => (st && q.name === st.name) || (cov && q.name === cov.name) ? 0 : 1;
        return own(a) - own(b) || risk(a) - risk(b) || (a.months ?? 99) - (b.months ?? 99) || (b.age || 0) - (a.age || 0); });
      const w = cand[0] || null; if (w) usedW.add(w.name);
      rows.push({ pos, st, cov, ny, w, nNow, nAfter, thin, places, nats });
    }
    return { rows, D, dv, SQ };
  }
  const ageMo = q => [isNum(q.age) ? `${q.age} y` : '', isNum(q.months) ? `${q.months} mo` : 'not read'].filter(Boolean).join(' · ');
  const watchMeta = q => q.sell ? `${Y() && (Y().bestOffer(q.name) || {}).word === 'accepted' ? 'sale agreed' : 'sell verdict'} · ${isNum(q.months) ? q.months + ' mo' : 'contract not read'}`
    : isNum(q.months) && q.months <= 18 ? `${q.age <= 22 ? 'renew' : 'ends'} · ${q.months} mo` : `30+ · ${isNum(q.months) ? q.months + ' mo' : 'contract not read'}`;
  function cell(kind, r, q) {
    if (!q) return `<span class="dp-c empty"><b>–</b><small>nobody</small></span>`;
    const isY = kind === 'ny', name = isY ? (Y() ? Y().display(q.name) : q.name) : q.name;
    const meta = isY ? `${fmt(q.ovr)} · POT ${Y() ? Y().rng(q.pot) : '–'}` : kind === 'w' ? watchMeta(q) : kind === 'st' && !fits(r.pos, q.nat) ? `${isNum(q.age) ? q.age + ' y · ' : ''}${(q.nat[0] || '–')} natural` : (q.nat.length || isNum(q.months) ? ageMo(q) : 'position not read');
    return `<a class="dp-c" href="${isY ? `#page=youth&n=${encodeURIComponent(q.name)}` : (q.p && playerByName(q.p.name) ? plink(playerByName(q.p.name)) : '#')}" data-pos="${r.pos}" data-k="${kind}" data-n="${esc(q.name)}"><b>${esc(name)}</b><small>${esc(meta)}</small></a>`;
  }
  function reason(M, r, k, n) {
    const Yx = Y(), base = BASE[r.pos] || r.pos, q = k === 'ny' ? null : r.nats.find(x => x.name === n) || [r.st, r.cov, r.w].find(x => x && x.name === n);
    const all = M.rows.filter(x => (BASE[x.pos] || x.pos) === base);
    const ny = uniq(all.map(x => x.ny).filter(Boolean)).map(y => `${Yx ? Yx.surname(y.name) : y.name} ${y.ovr}`).join(' · ');
    const o30 = r.nats.filter(x => isNum(x.age) && x.age >= 30), o30a = o30.filter(x => !x.sell);
    const buy = ((M.D.buy_or_scout || [])).find(b => new RegExp(`\\b(${r.pos}|${base})\\b`).test(`${b.role || ''} ${b.short || ''}`));
    const y = k === 'ny' && Yx ? Yx.ready(n) : null;
    const rows = [
      [`Natural ${base}s now${r.nAfter !== r.nNow ? ' · after the sale' : ''}`, `${r.nNow}${r.nAfter !== r.nNow ? ' · ' + r.nAfter : ''}`, { tone: r.thin ? 'bad' : '', src: 'in-game positions' }],
      [`Ages 30+ among them`, `${o30.length} of ${r.nNow}${r.nAfter !== r.nNow ? ` · ${o30a.length} of ${r.nAfter} after the sale` : ''}`, { tone: o30.length * 2 > r.nNow ? 'warn' : '', src: 'squad status' }],
      ['Next up', ny || 'nobody at this position', { src: 'academy' }],
      q ? [`Contract (${q.name})`, isNum(q.months) ? `${q.months} months${q.sell ? (Yx && (Yx.bestOffer(q.name) || {}).word === 'accepted' ? ' · sale agreed' : ' · sell verdict') : ''}` : 'not read', { tone: q.sell || (isNum(q.months) && q.months <= 18) ? 'warn' : '', src: isNum(q.months) ? 'Squad Hub' : 'capture Squad Hub contracts' }] : null,
      y ? ['Projected OVR at 18', y.projection_age && y.projection_age.at_18 ? Yx.rng(y.projection_age.at_18.ovr_range) : null, { tone: 'est', trust: 'rough', src: 'academy' }] : null,
      buy ? [`Director, ${M.dv ? shortDate(M.dv.day) : ''}`, esc(buy.short || buy.role || ''), { src: 'director file' }] : null,
    ];
    const kindW = `${r.pos}${r.thin ? ' · THIN' : ''}`;
    return `<aside class="dp-why"><b class="dp-kind${r.thin ? ' thin' : ''}">${esc(kindW)}</b><h3>${esc(k === 'ny' ? (Yx ? Yx.display(n) : n) : n)}</h3>${Yx ? Yx.cells(rows) : ''}
      <p class="dp-src">Positions and ages: squad status · contracts: Squad Hub${(M.SQ.squad_contracts || [])[0] ? ` · as of ${esc(Yx ? Yx.dOf(String(((M.SQ.squad_contracts || []).find(c => c.src) || {}).src || '').replace(/^(\d{4}-\d\d-\d\d)_.*$/, '$1')) : '')}` : ''} · POT: scout range (rough)</p></aside>`;
  }
  window.depthView = function (S, gridStyle) {
    const M = model(); if (!M.rows.length) return '<p class="empty-note">No saved slots captured yet</p>';
    const f = (S.dc || '').split('|'), fr = M.rows.find(r => r.pos === f[0]) || M.rows[0];
    const fk = f[1] || 'st', fn = f[2] || (fr.st ? fr.st.name : '');
    const body = M.rows.map(r => `<div class="dp-r${r.thin ? ' thin' : ''}"><span class="dp-p"><b>${r.pos}</b><small>${r.thin === 'now' ? `thin · ${r.nNow}` : r.thin === 'summer' ? 'thin in summer' : `${r.nNow} naturals`}</small>${r.thin ? '<i class="dp-warn" aria-label="thin"></i>' : ''}</span>${cell('st', r, r.st)}${cell('cov', r, r.cov)}${cell('ny', r, r.ny)}${cell('w', r, r.w)}</div>`).join('');
    return `<div class="dp-wrap" data-grid="g1"><section class="dp-table"><div class="dp-h"><span>Position</span><span>Starter</span><span>Cover (natural)</span><span>Next up · academy</span><span>Watch: 30+ / contract</span></div><div class="dp-body fc-scroll">${body}</div></section>
      <div class="dp-side">${reason(M, fr, fk, fn)}</div></div>`;
  };
  function focusCell(el) {
    if (!el) return; el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus();
    const M = model(), r = M.rows.find(x => x.pos === el.dataset.pos); if (!r) return;
    const side = document.querySelector('#main .dp-side'); if (side) side.innerHTML = reason(M, r, el.dataset.k, el.dataset.n);
    try { history.replaceState(history.state, '', location.href.split('#')[0] + sub({ dc: `${el.dataset.pos}|${el.dataset.k}|${el.dataset.n}` })); S = parseHash(); } catch (e) { /* */ }
    try { prompts(); } catch (e) { /* */ }
  }
  document.addEventListener('focusin', e => { const c = e.target.closest && e.target.closest('#main .dp-c:not(.empty)'); if (c) { const M = model(), r = M.rows.find(x => x.pos === c.dataset.pos), side = document.querySelector('#main .dp-side'); if (r && side) side.innerHTML = reason(M, r, c.dataset.k, c.dataset.n); } });
  document.addEventListener('mouseover', e => { const c = e.target.closest && e.target.closest('#main .dp-c:not(.empty)'); if (c && document.activeElement !== c) focusCell(c); });
  const COLS = ['st', 'cov', 'ny', 'w'];
  // Pad map (brief §4): LT/RT preset; D-pad grid (empty cells skipped); A Open Player; Y Compare with the row's starter; B Back
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.depth = {
    z: 2,
    active: () => typeof S === 'object' && S.page === 'squad' && !!document.querySelector('#main .dp-wrap'),
    prompts: () => [['A', 'Open player'], ['LTRT', 'Tab'], ['X', 'Compare'], ['Y', 'Search']],
    press(k) {
      const a = document.activeElement, cells = [...document.querySelectorAll('#main .dp-c:not(.empty)')];
      if (!/^(UP|DOWN|LEFT|RIGHT|X)$/.test(k)) return false;
      if (!a || !a.classList || !a.classList.contains('dp-c')) { if (k === 'X') return true; focusCell(document.querySelector('#main .dp-c:not(.empty)')); return true; }
      if (k === 'X') { const r = model().rows.find(x => x.pos === a.dataset.pos); if (r && r.st && a.dataset.n !== r.st.name) window.setView(href({ page: 'squad', preset: 'depth', sel: r.st.name, cmp: a.dataset.n })); return true; }
      const ri = ORDER.indexOf(a.dataset.pos), ci = COLS.indexOf(a.dataset.k), at = (r, c) => cells.find(x => x.dataset.pos === ORDER[r] && x.dataset.k === COLS[c]);
      if (k === 'LEFT' || k === 'RIGHT') { const d = k === 'RIGHT' ? 1 : -1; for (let c = ci + d; c >= 0 && c < COLS.length; c += d) { const t = at(ri, c); if (t) { focusCell(t); return true; } } return true; }
      const d = k === 'DOWN' ? 1 : -1; for (let r = ri + d; r >= 0 && r < ORDER.length; r += d) { const t = at(r, ci) || COLS.map((_, c) => at(r, c)).filter(Boolean).sort((x, y) => Math.abs(COLS.indexOf(x.dataset.k) - ci) - Math.abs(COLS.indexOf(y.dataset.k) - ci))[0]; if (t) { focusCell(t); return true; } }
      return true;
    },
    scrollTarget: () => document.querySelector('#main .dp-body'),
  };
  window.depthFocusEntry = function () { const S0 = (typeof S === 'object' ? S.dc : '') || '', f = S0.split('|'); const el = [...document.querySelectorAll('#main .dp-c:not(.empty)')].find(x => x.dataset.pos === f[0] && x.dataset.k === f[1] && x.dataset.n === f[2]) || document.querySelector('#main .dp-c:not(.empty)'); if (el) { el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } };
})();
