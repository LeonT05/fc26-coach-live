// ---------- Match Centre › Debrief (QA CT-G1/F1): the 5-step debrief of THAT match, L3 "Debrief Step Panel" design ----------
// #page=match&id=<id>&tab=debrief[&step=1..5]. Every number through the facts gate. Replaces the session Staff Room.
(function () {
  const STEPS = ['Result', 'Plan check', 'Habits', 'Together', 'Next plan'];
  const pct = v => isNum(v) ? Math.round(v * 100) + ' %' : '–';
  const row = (l, sub, v, cls = '') => `<div class="mc-row"><span>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>${v != null ? `<b class="${cls}">${esc(v)}</b>` : ''}</div>`;
  const ctrls = m => { const c = m.controllers; return Array.isArray(c) ? c : Object.values(c || {}); };
  function gated(m, path, v, fmtv) { const f = factOf(m.id, path); if (f && f.trust === 'blocked') return { v: 'not measurable yet', sub: plainReason(f.blocked_because), cls: 'muted' }; return { v: fmtv(f && isNum(f.value) ? f.value : v), sub: f && f.trust === 'rough' ? f.words || '' : '' }; }
  function stepBody(m, k) {
    const s = m.score_us_them || [], away = m.our_side === 'away', o = (m.official_ft && !m.official_ft.FT ? m.official_ft : ((m.official_ft || m.official || {}).FT)) || {}, home = (a) => away ? [a[1], a[0]] : a;
    const lc = latestWith(coachFor), c = lc ? lc.v : {}, T = {}; (c.next_match_targets || []).forEach(t => T[t.id] = t);
    const H = teamName(away ? m.opp : (m.ours || 'COM')), A = teamName(away ? (m.ours || 'COM') : m.opp);
    if (k === 1) {
      const r = resultOf(m), g = m.goal_moments || m.goals || [];
      const f = (lab, key) => o[key] ? row(lab, `${H} – ${A}`, home(o[key]).map(x => x == null ? '–' : x).join(' – ')) : '';
      return `<p class="db-lead ${r || ''}">${{ W: 'Won', D: 'Drew', L: 'Lost' }[r] || ''} ${esc(H)} ${home(s).join('–')} ${esc(A)}</p>` + f('Possession %', 'Possession %') + f('Expected Goals', 'Expected Goals') + f('Shots', 'Shots')
        + row('Goals', `${g.filter((x, i) => { const fg = factOf(m.id, `goal_moments[${i}]`); return !fg || fg.trust !== 'blocked'; }).length} of ${g.length} seen on the minimap`, null)
        + g.map((x, i) => { const fg = factOf(m.id, `goal_moments[${i}]`), seen = fg ? fg.trust !== 'blocked' : (x.moment_observed || x.observed); if (!seen) return '';
            return `<div class="mc-row"><span>${Math.floor(x.minute)}' · ${esc(teamName(x.team === 'us' ? (m.ours || 'COM') : m.opp))} ${esc(x.score || '')}<small>seen on the minimap</small></span><a class="lnk" href="#" data-replay="${esc(m.id)}@g${i}">watch build-up</a></div>`; }).join('');
    }
    if (k === 2) {
      const pc = m.plan_check;
      if (!pc) { const t = c.tactics || {}; return row('No plan existed before this match', 'so nothing can be checked here. The current plan will be checked after your next match:', null) + row(t.formation || 'Current plan', [t.build_up, t.defensive_approach, isNum(t.line_height) ? 'Line ' + t.line_height : ''].filter(Boolean).join(' · '), null) + ((c.next_match_targets || []).slice(0, 3).map(x => row(x.short || ({ rt_defending: 'RT while defending', lt_defending: 'LT while defending', tackles_won: 'Tackles Won', width: 'Width with the ball' })[x.id] || x.id, `target ${x.op === '<=' ? '≤' : '≥'} ${x.unit === 'share' ? pct(x.value) : x.value + (x.unit ? ' ' + x.unit : '')}`, null)).join('')) + `<a class="btn" href="#page=prematch">Pre-match glance</a>`; }
      return (pc.items || []).map(it => row(it.short || it.text, it.why || '', it.result || '–', it.result === 'kept' ? 'g' : it.result === 'missed' ? 'o' : 'muted')).join('') || row('Plan check', '', `${pc.kept || 0} of ${pc.n || 0} kept`);
    }
    if (k === 3) {
      const c1 = ctrls(m).find(x => x.marker === 'p1'), c2 = ctrls(m).find(x => x.marker === 'p2'); let out = '';
      if (c1) for (const [lab, path, key, tid, op] of [['RT while defending', 'ledger:sprint_chasing', 'sprint_frac_defence', 'rt_defending', '≤'], ['LT while defending', 'ledger:jockey_low', 'lt_frac_defence', 'lt_defending', '≥']]) {
        const g = gated(m, path, c1[key], pct), t = T[tid]; const ok = t && isNum(c1[key]) ? (t.op === '<=' ? c1[key] <= t.value : c1[key] >= t.value) : null;
        out += row(`${P1()} · ${lab}`, [t ? `target ${op} ${pct(t.value)}` : '', 'this match', g.sub].filter(Boolean).join(' · '), g.v, g.cls || (ok == null ? '' : ok ? 'g' : 'o')); }
      else out += row(P1(), 'controller not logged in this match', null);
      const p2row = c2 ? row(`${P2()} · RT while defending`, 'this match', pct(c2.sprint_frac_defence)) : row(P2(), `controller isn’t logged yet: run the small logger on ${P2()}’s PC, or turn on Input Overlay in the game`, null);
      return (typeof viewer === 'function' && viewer() === 'p2') ? p2row + out : out + p2row;   // Viewing as: the viewer's habits first
    }
    if (k === 4) {
      const lr = (m.kpis || {}).loss_reaction, g = factOf(m.id, 'ledger:loss_reaction_ok'); let out = '';
      if (g && g.trust === 'blocked') out += row('Reaction after a loss', plainReason(g.blocked_because), 'not measurable yet', 'muted');
      else if (lr && lr.share != null) out += row('Reaction after a loss', `press ${lr.press_n}/${lr.n} · cover ${lr.cover_n}/${lr.n} · this match`, `${Math.round(lr.share * lr.n)} of ${lr.n} losses`);
      const tw = o['Tackles Won'], tk = o['Tackles']; if (tw && tk && tk[0]) out += row(`${teamName(m.ours || 'COM')} · Tackles Won`, `official Match Facts · this match · target ≥ ${T.tackles_won ? pct(T.tackles_won.value) : '25 %'}`, `${tw[0]} of ${tk[0]} (${Math.round(tw[0] / tk[0] * 100)} %)`, T.tackles_won && tw[0] / tk[0] < T.tackles_won.value ? 'o' : 'g');
      ((c.duo || {}).rules || []).forEach(r => { const i = r.indexOf(':'); out += row(i > 8 ? r.slice(0, i) : r, i > 8 ? r.slice(i + 1).trim() : '', null); });
      return out;
    }
    const t = c.tactics || {}, first = id => ((c.sections || []).find(x => x.id === id) || { items: [] }).items;
    return row('Formation', [t.build_up, t.defensive_approach, isNum(t.line_height) ? 'Line ' + t.line_height : ''].filter(Boolean).join(' · '), t.formation || '–')
      + first('p1').slice(0, 1).concat(first('duo').slice(0, 1), first('team').slice(0, 1)).map(it => { const i = String(it.text).indexOf(':'); return row(it.short || (i > 8 ? it.text.slice(0, i) : it.text), i > 8 ? it.text.slice(i + 1).trim() : '', null); }).join('')
      + `<a class="btn" href="#page=prematch">Pre-match glance</a>`;
  }
  function debrief(m, S) {
    const k = Math.min(5, Math.max(1, +S.step || 1));
    const left = `<section class="mc-pan hug"><h2 class="cen-kick">DEBRIEF · ${esc(teamName(m.teams ? m.teams[0] : ''))} ${(m.our_side === 'away' ? (m.score_us_them || []).slice().reverse() : (m.score_us_them || [])).join('–')} ${esc(teamName(m.teams ? m.teams[1] : ''))}</h2>
      <nav class="db-steps">${STEPS.map((s, i) => `<a href="${sub({ step: i ? i + 1 : null })}" class="${k === i + 1 ? 'on' : ''}"><b>${i + 1}</b>${esc(s)}</a>`).join('')}</nav>
      <a class="lnk" href="${href({ page: 'match', id: m.id })}">Back to Match Facts</a></section>`;
    const right = `<section class="mc-pan db-panel gz-span2"><h2 class="cen-kick">${k} · ${esc(STEPS[k - 1].toUpperCase())}</h2><div class="db-body">${stepBody(m, k)}</div>
      <div class="db-foot"><span class="cen-dots">${STEPS.map((_, i) => `<i class="d ${i + 1 === k ? 'on' : ''}"></i>`).join('')}</span>${k < 5 ? `<a class="btn pri db-next" href="${sub({ step: k + 1 })}">Next step</a>` : `<a class="btn pri db-next" href="${href({ page: 'match', id: m.id })}">Done</a>`}</div></section>`;
    return `${window.mcBar ? window.mcBar(m, S) : ''}<div class="db" data-grid="g2">${left}${right}</div>`;
  }
  const prev = REG.match.render;
  REG.match.render = function (S) {
    if (S.tab !== 'debrief') return prev.call(this, S);
    const m = matchData(S.id); if (!m) return '<div class="tile empty">Match not found. <a class="lnk" href="#page=matches">All matches</a></div>';
    if (!m.opp && Array.isArray(m.teams)) { const away = m.our_side === 'away'; m.ours = m.teams[away ? 1 : 0]; m.opp = m.teams[away ? 0 : 1]; }
    return debrief(m, S);
  };
  const prevAfter = REG.match.after;
  REG.match.after = function (S, root) { if (prevAfter) prevAfter.call(this, S, root); if (S.tab !== 'debrief') return;
    // entry focus = step 1 and the focus memory per tab come from navstate / grid.js (Pad parity 288:28804)
    const d = root.querySelector('[data-back]'); if (d) d.addEventListener('click', e => { e.preventDefault(); (window.goBackApp || (() => history.back()))(); }); };
  // step is view state (no history spam), R / arrows page the steps
  if (window.NAVSTATE) NAVSTATE.VIEW.add('step');
  addEventListener('keydown', e => {
    if (S.page !== 'match' || S.tab !== 'debrief' || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '') || document.querySelector('.rp2, .overlay.on')) return;
    // R pages the steps (the arrows are the D-pad stand-in: spatial, as with the pad)
    const k = +(new URLSearchParams(location.hash.slice(1)).get('step') || 1), d = e.key === 'r' || e.key === 'R' || (e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('db-next') && k < 5) ? 1 : 0;   // reads the URL, so rapid presses queue
    if (!d) return; const n = Math.min(5, Math.max(1, k + d)); if (n !== k) { e.preventDefault(); setView(sub({ step: n === 1 ? null : n })); }
  });
  // retire the session Staff Room and the old duo page: route them to their new homes (QA P-1, CT-G1, CT-I2)
  const lastMatchId = () => { const ms = matchList(); return ms.length ? ms[ms.length - 1].id : null; };
  addEventListener('hashchange', redirectOld, true);
  function redirectOld() {
    const p = new URLSearchParams(location.hash.slice(1)), pg = p.get('page');
    if (pg === 'coach') { const id = lastMatchId(); location.replace(p.get('tab') === 'director' ? '#page=scouting' : id ? `#page=match&id=${encodeURIComponent(id)}&tab=debrief` : '#page=findings'); }
    else if (pg === 'duo') location.replace('#page=findings&tab=duo');
  }
  redirectOld();
})();
