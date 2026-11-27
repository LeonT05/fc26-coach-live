// ---------- Pre-match glance (L5, approved Figma frames 135:3009 / 135:3040). Second screen, readable at 2 m, <= 6 lines ----------
// Reads window.FC26_NEXT (data/nextmatch.js, written by code during a session) + the latest coach file through the facts gate.
(function () {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const dt = s => { const d = parseDate(s); return d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` : ''; };
  const hm = s => { const d = parseDate(s); return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''; };
  const L = (n, text, sub, cls = '') => `<li class="${cls}"><b>${n}</b><span>${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></li>`;
  function coachLines(c) {
    const first = id => ((c.sections || []).find(s => s.id === id) || { items: [] }).items[0];
    const lead = it => it ? (it.short || String(it.text).split(':')[0]) : '';
    const p1 = first('p1'), p2 = first('p2'); const tg = (c.next_match_targets || []).slice(0, 2);
    const mid = (matchList().slice(-1)[0] || {}).id;
    const tStr = tg.map(t => { const lab = { rt_defending: 'RT', lt_defending: 'LT', tackles_won: 'Tackles Won', width: 'Width', width_ratio: 'Width ratio' }[t.id] || t.short || targetLabel(t);
      const f = t.id === 'loss_reaction' ? factOf(mid, 'ledger:loss_reaction_ok') : null; if (f && f.trust === 'blocked') return '';
      return `${lab} ${t.op === '<=' ? '≤' : '≥'} ${t.unit === 'share' ? Math.round(t.value * 100) + ' %' : t.unit === 'ratio' ? t.value + '×' : t.value + (t.unit ? ' ' + t.unit : '')}`; }).filter(Boolean).join(' · ');
    return { p1: p1 ? `${P1()}: ${lead(p1).replace(/^./, ch => ch.toLowerCase())}` : '', p2: p2 ? `${P2()}: ${lead(p2).replace(/^./, ch => ch.toLowerCase())}` : '', targets: tStr ? 'Targets: ' + tStr : '' };
  }
  function renderPrematch() {
    const N = window.FC26_NEXT, lc = latestWith(coachFor), c = lc ? lc.v : {}, cl = coachLines(c), card = N && N.card;
    const cs = typeof capturedSettings === 'function' ? capturedSettings(c) : null;
    const sync = s => cs && typeof syncSlotText === 'function' ? syncSlotText(s, cs) : s;
    const slots = cs && typeof expandCapturedSlots === 'function' ? expandCapturedSlots(cs) : [];
    const s1 = slots.find(x => x.slot === ((cs && cs.active_slot) || 1)) || slots[0];
    const head = `<header class="pm-head"><span class="ring">fc</span><b>PRE-MATCH</b><span>updates by itself${N && N.detected_at ? ` · detected ${hm(N.detected_at)} from the ${N.source === 'prematch' ? 'pre-match screen' : 'hub NEXT FIXTURE card'}` : ' · waiting for the pre-match or hub NEXT FIXTURE screen'}</span></header>`;
    const habit = cl.p1 ? cl.p1 : '', peti = cl.p2 || `${P2()}: no habit yet (controller not logged)`;
    if (!N || !card) {
      const t = Object.assign({}, c.tactics || {}, s1 ? { formation: s1.formation || (c.tactics || {}).formation, build_up: s1.build_up || (c.tactics || {}).build_up, defensive_approach: s1.defensive_approach || (c.tactics || {}).defensive_approach, line_height: isNum(s1.line_height) ? s1.line_height : (c.tactics || {}).line_height } : {});
      const def = (N && N.prematch_default) || c.prematch_default;
      const lines = (def && def.length ? def.slice(0, 4).map(sync) : [t.formation ? `Standing plan: ${[t.formation, t.build_up, t.defensive_approach, isNum(t.line_height) ? 'Line ' + t.line_height : ''].filter(Boolean).join(', ')}` : '', habit, ((c.sections || []).find(s => s.id === 'duo') || { items: [] }).items.map(it => it.short || '')[0] || '', cl.targets]).filter(Boolean);
      return `${GRID.bandTitle('Next match · glance')}<div class="pm" data-grid="g6">${head}<h1>NEXT MATCH</h1><p class="pm-warn">Opponent not seen yet: open the hub NEXT FIXTURE card in the game</p><ol>${lines.slice(0, 6).map((x, i) => L(i + 1, x)).join('')}</ol></div>`;
    }
    const lp = N.league_pos || {}, us = clubName(), venue = N.venue === 'away' ? 'Away' : 'Home';
    const home = N.venue === 'away' ? N.code : 'COM', away = N.venue === 'away' ? 'COM' : N.code;
    const meta = [venue, N.comp, N.matchday ? 'MD ' + N.matchday : '', dt(N.date), N.kickoff, isNum(lp.them) && isNum(lp.us) ? `${N.opponent} ${ord(lp.them)}, we ${ord(lp.us)}` : ''].filter(Boolean).join(' · ');
    const ch = card.changes || [], g = card.glance || [];
    const l1 = sync(g[0] || (ch[0] && ch[0].what) || `Slot ${card.slot}`);
    const l2 = sync(g[1] || (ch[0] && sync(ch[0].what) !== l1 ? ch[0].what : '') || '');
    const l2sub = ch.find(x => sync(x.what) !== l1 && sync(x.what) !== l2);
    const stale = N.stale || (card.date && N.date && card.date !== N.date);
    const lines = [L(1, l1, [N.tier ? `tier ${N.tier}: ${N.tier_why || ''}` : '', card.words ? card.words.replace(/^\(|\)$/g, '') : ''].filter(Boolean).join(' · '), stale ? 'dim' : ''),
      l2 ? L(2, l2, l2sub ? sync(l2sub.what) : '', stale ? 'dim' : '') : '', habit ? L(0, habit) : '', L(0, peti, '', cl.p2 ? '' : 'dim'), cl.targets ? L(0, cl.targets) : ''].filter(Boolean);
    let k = 0; const numbered = lines.slice(0, 6).map(x => x.replace(/<b>\d+<\/b>/, () => `<b>${++k}</b>`));
    return `${GRID.bandTitle(`${N.opponent || 'Next match'} (next match) · glance`)}<div class="pm" data-grid="g6">${head}<div class="pm-fix"><span class="cr">${badge(home, home === 'COM')}${badge(away, away === 'COM')}</span><div><h1>${N.venue === 'away' ? esc(N.opponent.toUpperCase()) + ' v ' + esc(us.toUpperCase()) : esc(us.toUpperCase()) + ' v ' + esc(N.opponent.toUpperCase())}</h1><p>${esc(meta)}</p></div></div>
      ${stale ? `<p class="pm-warn">This card is from ${esc(dt(card.date) || 'an earlier session')}: may be out of date</p>` : ''}<ol>${numbered.join('')}</ol></div>`;
  }
  REG.prematch = { title: () => 'Pre-match', render: renderPrematch };
  // QA SH-1: the poll NEVER navigates away from what you are doing.
  // - the first poll after load only records the current detected_at (no action on load);
  // - only a detected_at that is NEW since load and 0 <= age < 10 min counts (a future timestamp = clock skew = ignored);
  // - it shows a corner toast "New pre-match plan · Roma (H) · (A) Open"; it opens by itself only on Central after 30 s idle.
  let last = null, primed = false, lastInput = Date.now();
  ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  function toast(N) {
    if (document.querySelector('.rp2, .mc-pop:not([hidden]), .overlay.on')) return;
    let t = document.getElementById('pmToast');
    if (!t) { t = document.createElement('div'); t.id = 'pmToast'; t.className = 'pm-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    const v = N.venue === 'away' ? 'A' : 'H';
    t.innerHTML = `<b>New pre-match plan</b><span>${esc(N.opponent || '')} (${v})</span><button type="button" class="btn" data-open><span class="gl kc">P</span>Open</button><button type="button" class="pm-x" aria-label="Dismiss"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
    t.hidden = false;
    t.querySelector('[data-open]').onclick = () => { t.hidden = true; location.hash = '#page=prematch'; };
    t.querySelector('.pm-x').onclick = () => { t.hidden = true; };
    if (!window.__pmKey) { window.__pmKey = true; addEventListener('keydown', e => { const tt = document.getElementById('pmToast'); if (tt && !tt.hidden && getComputedStyle(tt).display !== 'none' && !document.querySelector('.rp2, .mc-pop:not([hidden]), .overlay.on') && (e.key === 'p' || e.key === 'P') && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) { tt.hidden = true; location.hash = '#page=prematch'; } }); }
  }
  function poll() {
    if (document.hidden) return;
    const onDone = () => {
      const N = window.FC26_NEXT; const at = N && N.detected_at;
      if (!primed) { primed = true; last = at || null; return; }
      if (!at || at === last) return; last = at;
      const age = Date.now() - (parseDate(at) || 0); if (!(age >= 0 && age < 10 * 60 * 1000)) return;
      if (/page=prematch/.test(location.hash)) { if (typeof window.render === 'function') window.render(); return; }
      const busy = document.querySelector('.rp2, .mc-pop:not([hidden]), .overlay.on');
      const onHub = (typeof S === 'object' && S.page === 'hub');
      if (onHub && !busy && Date.now() - lastInput >= 30000) location.hash = '#page=prematch'; else if (!busy) toast(N);
    };
    if (window.FC26_ENCRYPTED && window.FC26_WEB && window.FC26_WEB.loadScript) {
      window.FC26_WEB.loadScript('data/nextmatch.js', { bust: true }).then(onDone, onDone);
      return;
    }
    const s = document.createElement('script'); s.src = 'data/nextmatch.js?t=' + Date.now();
    s.onload = s.onerror = () => { s.remove(); onDone(); };
    document.head.appendChild(s);
  }
  if (!/selftest/.test(location.hash)) { poll(); if (!window.FC26_ENCRYPTED) setInterval(poll, 5000); }
  if (/^#prematch\b/.test(location.hash)) location.hash = '#page=prematch';
})();
