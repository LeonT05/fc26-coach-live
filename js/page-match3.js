// ---------- Match Centre v3 A (approved Figma frame 124:2761): a mosaic of panels on the T5 grid ----------
// Left: MATCH (scorebox + menu + footer) over LEON & PETI · THIS MATCH. Middle: MATCH FACTS (6 key facts + All match facts popup).
// Right: KEY MOMENTS over DEBRIEF. The older detail tabs stay reachable with &tab=… (flow, attacks, players, duo).
(function () {
  const oldRender = REG.match.render, oldAfter = REG.match.after;
  const KEY = ['Possession %', 'Shots', 'Expected Goals', 'Passes', 'Pass Accuracy %', 'Tackles Won'];
  const SKIP = new Set(['Passes Attempted', 'Pass Accuracy']);
  const pct = v => isNum(v) ? Math.round(v * 100) + ' %' : '–';
  const ctrls = m => { const c = m.controllers; return Array.isArray(c) ? c : Object.values(c || {}); };
  const pan = (title, body, cls = '') => `<section class="mc-pan ${cls}"><h2 class="cen-kick">${esc(title)}</h2>${body}</section>`;
  // day-file match objects carry teams[home, away] + our_side; career rows carry ours/opp. Normalise once.
  function norm(m, id) { if (!m.opp && Array.isArray(m.teams)) { const away = m.our_side === 'away'; m.ours = m.teams[away ? 1 : 0]; m.opp = m.teams[away ? 0 : 1]; }
    if (!m.official_ft && m.official) m.official_ft = m.official; if (!m.day && id) m.day = String(id).split('#')[0]; return m; }
  function sides(m) {
    const rawS = m.score_us_them || [], s = [isNum(rawS[0]) ? rawS[0] : '–', isNum(rawS[1]) ? rawS[1] : '–'], away = m.our_side === 'away';
    const H = away ? (m.opp || 'TBC') : (m.ours || 'COM'), A = away ? (m.ours || 'COM') : (m.opp || 'TBC');
    return { away, H, A, hs: away ? s[1] : s[0], as: away ? s[0] : s[1] };
  }
  const ord = (m, v) => !v ? [null, null] : (m.our_side === 'away' ? [v[1], v[0]] : [v[0], v[1]]);   // official arrays are [us, them] -> home first
  const num = v => v == null ? '–' : (Number.isInteger(v) ? v : fmt(v, 1));
  function factRows(m, keys, half = 'FT') {
    const o = (m.official_ft || {})[half] || {}; return keys.filter(k => o[k] && (factOf(m.id, `official.${half}.${k}`) || {}).trust !== 'blocked').map(k => { const [h, a] = ord(m, o[k]); return `<div class="mc-fr"><b class="h">${num(h)}</b><span>${esc(k === 'Ball Recovery Time (Seconds)' ? 'Ball Recovery Time (s)' : k)}</span><b class="a">${num(a)}</b></div>`; }).join('');
  }
  function teamsHead(m) { const { H, A } = sides(m); return `<div class="mc-teams"><span>${badge(H, H === (m.ours || 'COM'))}<b>${esc(H)}</b></span><span><b>${esc(A)}</b>${badge(A, A === (m.ours || 'COM'))}</span></div>`; }
  function leftPanels(m) {
    const { H, A, hs, as, away } = sides(m);
    const sb = `<div class="mc-sb"><b>FT</b><span>${esc(teamName(H))}</span>${badge(H, !away)}<b class="sc">${esc(hs)} - ${esc(as)}</b>${badge(A, away)}<span>${esc(teamName(A))}</span></div>`;
    const menu = `<nav class="mc-menu"><a class="on" href="#">MATCH FACTS</a><a href="#page=match&id=${encodeURIComponent(m.id)}&tab=debrief">DEBRIEF</a><a href="#" ${m.replay_v2 || m.replay ? `data-replay="${esc(m.id)}@m1"` : ''}>WATCH REPLAY</a></nav>`;
    const meta = m.meta || {}; const foot = `<p class="mc-foot">${away ? 'Away' : 'Home'} · Serie A${meta.date ? ' · ' + esc(shortDate(meta.date)) + ' (in-game)' : ''} · recorded ${esc(shortDate(m.day))}</p>`;
    const k = m.kpis || {}, c1 = ctrls(m).find(c => c.marker === 'p1'), c2 = ctrls(m).find(c => c.marker === 'p2');
    const lc = latestWith(coachFor), T = {}; ((lc && lc.v.next_match_targets) || []).forEach(t => T[t.id] = t);
    const row = (l, sub, v, cls = '') => `<div class="mc-row"><span>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><b class="${cls}">${esc(v)}</b></div>`;
    const gate = (path, v, fmtv) => { const f = factOf(m.id, path); if (!f) return { v: fmtv(v), sub: '' }; if (f.trust === 'blocked') return { blocked: true, v: 'not measurable yet', sub: plainReason(f.blocked_because) }; return { v: fmtv(isNum(f.value) ? f.value : v), sub: f.trust === 'rough' ? (f.words || '') : '' }; };
    const lr = k.loss_reaction; let rows = ''; const lrg = factOf(m.id, 'ledger:loss_reaction_ok');
    if (lrg && lrg.trust === 'blocked') rows += row('Reaction after a loss', plainReason(lrg.blocked_because), 'not measurable yet', 'muted');
    else if (lr) rows += lr.share == null || !isNum(lr.n) ? row('Reaction after a loss', plainReason(lr.reason), 'not measurable yet', 'muted') : row('Reaction after a loss', `press ${lr.press_n}/${lr.n} · cover ${lr.cover_n}/${lr.n} · 1 match`, `${Math.round(lr.share * lr.n)} of ${lr.n} losses`);
    const tgt = (id, v) => { const t = T[id]; if (!t || !isNum(v)) return ''; const ok = t.op === '<=' ? v <= t.value : v >= t.value; return ok ? 'g' : 'o'; };
    if (c1) { for (const [lab, path, key, tid, op] of [['RT while defending', 'ledger:sprint_chasing', 'sprint_frac_defence', 'rt_defending', '≤'], ['LT while defending', 'ledger:jockey_low', 'lt_frac_defence', 'lt_defending', '≥']]) {
        const g = gate(path, c1[key], pct); const sub = [T[tid] ? `target ${op} ${pct(T[tid].value)}` : '', g.sub].filter(Boolean).join(' · ');
        rows += row(`${P1()} · ${lab}`, sub, g.v, g.blocked ? 'muted' : tgt(tid, c1[key])); } }
    rows += c2 ? row(`${P2()} · RT while defending`, '', pct(c2.sprint_frac_defence)) : row(P2(), '', 'controller not logged', 'muted');
    return `<div class="mc-col">${pan('MATCH · FT', sb + menu + foot, 'hug')}${pan(`${P1().toUpperCase()} & ${P2().toUpperCase()} · THIS MATCH`, rows, 'grow')}</div>`;
  }
  function moments(m) {
    const g = m.goal_moments || m.goals || [], { H, A } = sides(m), n = 6;
    const li = g.slice(0, n).map((x, i) => { const team = x.team === 'us' ? (m.ours || 'COM') : m.opp, fg = factOf(m.id, `goal_moments[${i}]`);
      const seen = fg ? fg.trust !== 'blocked' && fg.trust !== 'missing' : (x.moment_observed || x.observed);
      const sub = fg && fg.trust === 'blocked' ? plainReason(fg.blocked_because) : seen ? 'seen on the minimap' + (fg && fg.trust === 'rough' && fg.words ? ' ' + fg.words : '') : (x.note ? x.note.replace(/^build-up not seen: minimap hidden for (\d+(?:\.\d+)?) s of play before the goal$/, 'build-up not seen (minimap hidden $1 s)') : 'build-up not seen');
      return `<li><span><b>${Math.floor(x.minute)}' · ${esc(teamName(team))} ${esc(x.score)}</b><small>${esc(sub)}</small></span>${seen ? `<a class="lnk" href="#" data-replay="${esc(m.id)}@g${i}">watch build-up</a>` : '<i>–</i>'}</li>`; }).join('');
    return pan(`KEY MOMENTS · ${g.length} GOAL${g.length === 1 ? '' : 'S'}`, `<ul class="mc-mom">${li}</ul>${g.length > n ? `<p class="mc-foot">+${g.length - n} more in Watch Replay › Moments</p>` : ''}`, 'kmom');
  }
  function debrief(m) {
    const { hs, as, away } = sides(m), r = resultOf(m), us = away ? as : hs, them = away ? hs : as;
    const c1 = ctrls(m).find(c => c.marker === 'p1'), o = (m.official_ft || {}).FT || {}, tw = o['Tackles Won'], tk = o['Tackles'];
    const pc = m.plan_check; const steps = [['1 · Result', `${teamName(m.ours || 'COM')} ${({ W: 'won', D: 'drew', L: 'lost' })[r] || ''} ${us}–${them} ${away ? 'away' : 'at home'}`], ['2 · Plan check', pc ? `${pc.kept || 0} of ${pc.n || 0} kept` : 'no plan yet'],
      ['3 · Habits', c1 ? `${P1()}: RT ${pct(c1.sprint_frac_defence)}` : 'not logged'], ['4 · Together', tw && tk && tk[0] ? `Tackles Won ${Math.round(tw[0] / tk[0] * 100)} %` : '–'], ['5 · Next plan', ((latestWith(coachFor) || {}).v || {}).tactics ? latestWith(coachFor).v.tactics.formation : '–']];
    return pan('DEBRIEF · 5 STEPS', `<ol class="mc-steps">${steps.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol><a class="btn pri" href="#page=match&id=${encodeURIComponent(m.id)}&tab=debrief">Start Debrief</a>`, 'deb');
  }
  // grid brief: Facts and Debrief are the two tabs of ONE Sub-tab Bar (view state, no slide); the band meta names the match
  window.mcBar = function (m, S) {
    norm(m, S.id); const { H, A, hs, as } = sides(m), meta = m.meta || {}, d = meta.date || m.date;
    const title = `${teamName(H)} ${hs}–${as} ${teamName(A)}${d ? ' · ' + shortDate(d) : ''}`;
    return GRID.stb([{ label: 'Facts', href: href({ page: 'match', id: S.id }), on: S.tab !== 'debrief' }, { label: 'Debrief', href: href({ page: 'match', id: S.id, tab: 'debrief' }), on: S.tab === 'debrief' }], { label: 'Match Centre tabs', meta: esc(title) });
  };
  function popup(m) {
    const o = m.official_ft || {}, halves = ['FT', 'HT'].filter(h => o[h]);
    const all = h => Object.keys(o[h] || {}).filter(k => !SKIP.has(k));
    return `<div class="mc-pop" hidden role="dialog" aria-label="All match facts"><div class="mc-dim" data-close></div><div class="mc-card"><button type="button" class="mc-x" data-close aria-label="Close (B)">×</button>
      <header>${teamsHead(m)}<div class="mc-ttl"><b>ALL MATCH FACTS</b><span class="mc-half">${halves.map((h, i) => `<button data-half="${h}" class="${i ? '' : 'on'}">${h === 'FT' ? 'Full Time' : 'Half Time'}</button>`).join('')}</span></div></header>
      ${halves.map((h, i) => { const ks = all(h), mid = Math.ceil(ks.length / 2); return `<div class="mc-cols" data-h="${h}" ${i ? 'hidden' : ''}><div>${factRows(m, ks.slice(0, mid), h)}</div><div>${factRows(m, ks.slice(mid), h)}</div></div>`; }).join('')}
      <p class="mc-foot">Official numbers from the game's Match Facts screen (${esc(shortDate(m.day))} session). B or Esc closes.</p></div></div>`;
  }
  REG.match.render = function (S) {
    if (S.tab && !['facts', 'debrief', 'replay'].includes(S.tab)) {   // QA O3/MC7/MC11: Summary/Flow/Attacks/Players/Duo are retired
      const to = S.tab === 'duo' ? '#page=findings&tab=duo' : href({ page: 'match', id: S.id });
      try { history.replaceState(null, '', location.href.split('#')[0] + to); } catch (e) { /* */ }
      if (S.tab === 'duo') { setTimeout(render, 0); return ''; }
      S = parseHash(); }
    if (!S.id) { const ms = matchList(); if (ms.length) { S.id = ms[ms.length - 1].id; try { history.replaceState(null, '', location.href.split('#')[0] + href({ ...S })); } catch (e) { /* */ } } }
    const m0 = matchData(S.id); if (!m0) return `<div class="mc-pan hug" style="max-width:calc(700 * var(--px))"><h2 class="cen-kick">MATCH NOT FOUND</h2><p class="mc-foot">This link points to a match that isn’t in the data.</p><a class="btn pri" href="#page=matches">All matches</a></div>`; const m = norm(m0, S.id);
    const facts = pan('MATCH FACTS · FT', teamsHead(m) + `<div class="mc-facts">${factRows(m, KEY)}</div><button class="btn mc-all" type="button">All match facts</button>`, 'facts');
    return `${window.mcBar(m, S)}<div class="mc3" data-grid="g2">${leftPanels(m)}${facts}<div class="mc-col">${moments(m)}${debrief(m)}</div></div>${popup(m)}`;
  };
  REG.match.tabs = () => ['facts', 'debrief'];   // Z/C never drop into the retired analysis tabs
  REG.match.after = function (S, root) {
    if (S.tab === 'replay' && typeof RP2 === 'object' && !document.querySelector('.rp2')) { const m = matchData(S.id); if (m) setTimeout(() => RP2.open(m, isNum(+S.t) && S.t !== undefined ? 'm' + (+S.t) : 0, null), 0); }
    if (oldAfter) try { oldAfter.call(this, S, root); } catch (e) { /* old tab hooks */ }
    const pop = root.querySelector('.mc-pop'); if (!pop) return; const btn = root.querySelector('.mc-all');
    const stripAllParam = () => {
      const raw = location.hash.replace(/^#/, '');
      if (!/(?:^|&)all=/.test(raw)) return;
      const p = new URLSearchParams(raw);
      p.delete('all');
      delete S.all;
      const nextHash = '#' + p.toString();
      try { history.replaceState(history.state, '', location.href.split('#')[0] + nextHash); } catch (e) { /* */ }
    };
    const setAllParam = () => {
      const p = new URLSearchParams(location.hash.replace(/^#/, ''));
      p.set('all', '1');
      S.all = '1';
      try { history.replaceState(history.state, '', location.href.split('#')[0] + '#' + p.toString()); } catch (e) { /* */ }
    };
    const close = () => {
      pop.hidden = true;
      stripAllParam();
      btn && btn.focus();
      try { prompts(); } catch (e) { /* */ }
    };
    if (pop.parentNode !== document.body) { document.querySelectorAll('body > .mc-pop').forEach(x => x.remove()); document.body.appendChild(pop); }
    btn && btn.addEventListener('click', () => { pop.hidden = false; setAllParam(); setTimeout(() => { try { prompts(); } catch (e) { /* */ } }, 0); const f = pop.querySelector('[data-half].on'); f && f.focus(); });
    pop.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); const h = e.target.closest('[data-half]'); if (h) { pop.querySelectorAll('[data-half]').forEach(x => x.classList.toggle('on', x === h)); pop.querySelectorAll('.mc-cols').forEach(c => c.hidden = c.dataset.h !== h.dataset.half); } });
    if (window.__mcKey) removeEventListener('keydown', window.__mcKey, true);
    window.__mcKey = e => { if (!pop.hidden && (e.key === 'Escape' || e.key === 'b' || e.key === 'B' || e.key === 'Backspace')) { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    addEventListener('keydown', window.__mcKey, true);
    if (S.all) { pop.hidden = false; setTimeout(() => { try { prompts(); } catch (e) { /* */ } }, 0); }
    root.querySelectorAll('.mc-menu a[href="#"]:not([data-replay])').forEach(a => a.addEventListener('click', e => e.preventDefault()));
  };
})();
