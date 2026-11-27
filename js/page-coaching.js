// ---------- Coaching (L5 panel mosaic) · QA pass 1 + re-check 1 ----------
// Coach-file content only (v1 and v2 files: short / text / refs), every number through the facts gate with a basis label.
// Tabs: Leon · Peti · Together · Team · Patterns · Findings. Findings = the round-8 list (page-findings.js); the old drill-down
// rule → match → possessions → watch stays reachable for the deep links (#page=findings&rule=…&match=…) from Central / Matches.
(function () {
  const pct = v => isNum(v) ? Math.round(v * 100) + ' %' : '–';
  const pan = (title, body, cls = '') => `<section class="mc-pan ${cls}"><h2 class="cen-kick">${esc(title)}</h2>${body}</section>`;
  const row = (l, sub, v, cls = '', href = '', lead = '') => `<${href ? `a href="${href}"` : 'div'} class="mc-row${href ? ' lnk-row' : ''}"><span>${lead}${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>${v != null ? `<b class="${cls}">${esc(v)}</b>` : ''}${href ? '<i class="chev" aria-hidden="true"></i>' : ''}</${href ? 'a' : 'div'}>`;
  const split = t => { const s = String(t || ''), i = s.indexOf(':'); return i > 8 ? [s.slice(0, i), s.slice(i + 1).trim()] : [s, '']; };
  const items = (c, id) => ((c.sections || []).find(s => s.id === id) || { items: [] }).items;
  // title = short (or the lead clause); sub-line = the evidence after the colon only (QA N-11), never the whole text again
  // round 8 (Leon answer 3): a focus item with a row in the findings list links there (A opens Findings with that row focused)
  const itemRows = list => list.length ? list.map(it => { const [t, d] = split(it.text), fl = typeof findingLink === 'function' ? findingLink(latestWith(coachFor), it.id) : null;
    return row(it.short || t, d || (it.short && it.short !== it.text ? it.text : ''), null, '', fl || ''); }).join('') : '<p class="mc-foot">Nothing from the coach for this one.</p>';
  const L = () => (typeof ledger === 'function' ? ledger() : null) || {};
  const ruleDef = id => (L().rules || []).find(r => r.id === id) || {};
  // QA N-2/N-3: each rule's own format and unit
  const fmtRule = (id, v) => { if (!isNum(v)) return '–'; const d = ruleDef(id); return d.fmt === 'pct' ? pct(v) : d.fmt === 's' ? `${v.toFixed(2)} s` : d.fmt === 'm' ? `${Math.round(v)} m` : fmt(v, 1); };
  const unitOf = id => ruleDef(id).unit || '';
  const lastMatch = () => { const ms = matchList(); return ms[ms.length - 1]; };
  const TARGET_RULE = { rt_defending: 'sprint_chasing', lt_defending: 'jockey_low', loss_reaction: 'loss_reaction_ok', width: 'width_in_poss', tackles_won: null };
  const TL = { rt_defending: 'RT while defending', lt_defending: 'LT while defending', tackles_won: 'Tackles Won', width: 'Width with the ball', loss_reaction: 'Reaction after a loss' };
  // share -> %, ratio -> 1.15×, otherwise keep the decimals the coach wrote (8 s, 1.5 m)
  const tval = (t, v) => t.unit === 'share' ? pct(v) : t.unit === 'ratio' ? (isNum(v) ? fmt(v, 2) + '×' : v)
    : (isNum(v) ? fmt(v, Number.isInteger(v) ? 0 : 1) : v) + (t.unit ? ' ' + t.unit : '');
  // QA CT-D4 / A11: EVERY target through the facts gate; the big value is the LAST match (labelled), the season values follow
  function targetRows(c, who) {
    const lm = lastMatch(), opp = lm ? teamName(lm.opp || (lm.teams || [])[1]) : '';
    return (c.next_match_targets || []).filter(t => who.includes(t.who)).map(t => {
      const goal = `target ${t.op === '<=' ? '≤' : '≥'} ${tval(t, t.value)}`, was = Array.isArray(t.was) ? t.was : [], last = was[was.length - 1];
      const path = TARGET_RULE[t.id] ? 'ledger:' + TARGET_RULE[t.id] : null, f = path && lm ? factOf(lm.id, path) : null;
      if (f && f.trust === 'blocked') return row(t.short || TL[t.id] || targetLabel(t), `${goal} · ${plainReason(f.blocked_because)}`, 'not measurable yet', 'muted');
      const ok = isNum(last) ? (t.op === '<=' ? last <= t.value : last >= t.value) : null;
      const sub = [goal, `last match${opp ? ' (' + opp + ')' : ''}`, was.length > 1 ? `matches: ${was.map(v => tval(t, v)).join(' / ')}` : '', f && f.trust === 'rough' && f.words ? f.words : ''].filter(Boolean).join(' · ');
      return row(t.short || TL[t.id] || targetLabel(t), sub, isNum(last) ? tval(t, last) + estTag(f) : '–', ok == null ? '' : ok ? 'g' : 'o');
    }).join('') || (who.includes('team') ? '<p class="mc-foot">No targets for this one.</p>'
      : (c.next_match_targets || []).some(t => t.who === 'team') ? `<p class="mc-foot">No personal targets this time: the <a href="${sub({ tab: 'team' })}">team targets</a> apply to you both.</p>` : '<p class="mc-foot">No targets for this one.</p>');
  }
  // per-rule facts across the matches that measured it
  function ruleStats(id) {
    const ms = matchList(), per = ms.map(m => { const fnd = ((L().matches || {})[m.id] || { findings: [] }).findings.find(x => x.rule === id); return { m, fnd, f: factOf(m.id, 'ledger:' + id) }; }).filter(x => x.fnd);
    const counted = per.filter(x => x.fnd.enough_data && !(x.f && x.f.trust === 'blocked')), flagged = counted.filter(x => x.fnd.flagged).length;
    const blocked = per.length && per.every(x => x.f && x.f.trust === 'blocked'), rough = per.find(x => x.f && x.f.trust === 'rough');
    return { per, counted, flagged, blocked, rough, reason: blocked ? plainReason(per[per.length - 1].f.blocked_because) : '' };
  }
  const groupOf = r => r.who === 'me' || r.who === 'p1' ? 'me' : r.who === 'duo' ? 'duo' : 'team';   // QA N-4: by who
  function ledgerRows(filter) {
    return (L().season || []).filter(filter).map(r => {
      const st = ruleStats(r.rule), href = sub({ tab: 'findings', rule: r.rule, match: null });
      if (st.blocked) return row(r.title, st.reason, 'not measurable yet', 'muted', href);
      const below = st.per.length - st.counted.length;
      const sample = st.counted.length ? `flagged in ${st.flagged} of ${st.counted.length} match${st.counted.length === 1 ? '' : 'es'}${below ? ` (${below} below the minimum sample)` : ''}` : 'not enough data yet';
      return row(r.title, [unitOf(r.rule), sample, `${st.per.length} match${st.per.length === 1 ? '' : 'es'} pooled`, st.rough && st.rough.f.words ? st.rough.f.words : ''].filter(Boolean).join(' · '), fmtRule(r.rule, r.value) + estOfAll(st.counted.map(x => x.f)), r.flagged ? 'o' : 'g', href);
    }).join('') || '<p class="mc-foot">No ledger rules yet.</p>';
  }
  // QA N-1: the drill-down inside Coaching › Findings: rule → match → possessions → watch
  function ruleDetail(S) {
    const id = S.rule, d = ruleDef(id), st = ruleStats(id), season = (L().season || []).find(r => r.rule === id) || {};
    const head = pan((d.title || season.title || id).toUpperCase(), (st.blocked ? row('Season', st.reason, 'not measurable yet', 'muted') : row('Season', [unitOf(id), `${st.per.length} matches pooled`].join(' · '), fmtRule(id, season.value) + estOfAll(st.counted.map(x => x.f)), season.flagged ? 'o' : 'g'))
      + (d.advice ? `<p class="mc-foot db-note">${esc(d.advice)}</p>` : '') + `<a class="lnk" href="${sub({ rule: null, match: null })}">All rules</a>`, 'hug');
    const mrows = st.per.map(x => { const t = x.f && x.f.trust, h = sub({ match: x.m.id });
      return t === 'blocked' ? row(x.m.title, plainReason(x.f.blocked_because), 'not measurable yet', 'muted', h)
        : row(x.m.title, [x.fnd.enough_data ? (x.fnd.flagged ? 'flagged' : 'on target') : 'below the minimum sample', t === 'rough' && x.f.words ? x.f.words : ''].filter(Boolean).join(' · '), fmtRule(id, x.fnd.value) + estTag(x.f), x.fnd.flagged ? 'o' : 'g', h); }).join('') || '<p class="mc-foot">No match measured this rule.</p>';
    const mid = S.match || (st.per[0] && st.per[0].m.id), poss = ((L().possessions || {})[mid] || []).filter(p => p.rule === id);
    const prow = poss.map(p => `<div class="mc-row"><span>${Math.floor(p.minute)}' · ${esc(p.kind || '')}<small>${esc(p.detail || '')}</small></span><a class="lnk" href="#" data-replay="${esc(mid)}@m${Math.max(0, p.minute - .3).toFixed(1)}">watch</a></div>`).join('');
    return `<div class="mc3 co-flow" data-grid="g2"><div class="mc-col">${head}</div><div class="mc-col">${pan('PER MATCH', mrows, 'hug')}</div>
      <div class="mc-col">${pan(`POSSESSIONS · ${esc((matchList().find(m => m.id === mid) || {}).title || '')}`, st.blocked ? '<p class="mc-foot">Hidden while this rule is not measurable.</p>' : prow || `<p class="mc-foot">No single moments are listed for this rule in this match.</p><a class="lnk" href="${href({ page: 'match', id: mid })}">Open this match in Match Centre</a>`, 'hug')}</div></div>`;
  }
  // QA N-6: Season progress = progress: per-rule values per session (honest with 1 session) + results vs xG per match
  function progressPanel() {
    const ses = L().sessions || {}, days = Object.keys(ses).sort();
    const trend = days.length < 2 ? `<p class="mc-foot db-note">1 session so far: the trend per rule appears from the next session.</p>`
      : (L().season || []).filter(r => !ruleStats(r.rule).blocked).map(r => { const vals = days.map(d => (ses[d].find(x => x.rule === r.rule) || {}).value); return row(r.title, days.map(shortDate).join(' → '), vals.map(v => fmtRule(r.rule, v)).join(' → '), ''); }).join('');
    const res = matchList().map(m => { const md = matchData(m.id) || m, s = md.score_us_them || m.score_us_them || [], away = md.our_side === 'away', of = ((md.official_ft || md.official || {}).FT || {})['Expected Goals'], xg = of && isNum(of[0]) ? of : xgOf(md);
      const h = away ? [s[1], s[0]] : s, hx = xg ? (away ? [xg[1], xg[0]] : xg) : null;
      return row(m.title || '', hx ? `xG ${hx.map(v => fmt(v, 1)).join('–')} (home first)` : 'xG not captured', { W: 'Won', D: 'Drew', L: 'Lost' }[resultOf(md)] || '', resultOf(md) === 'W' ? 'g' : resultOf(md) === 'L' ? 'o' : ''); }).join('');
    return pan('SEASON PROGRESS', row('Results and xG', `${matchList().length} matches`, null) + res + trend, 'hug');
  }
  function matchRules(mid) {   // every rule for ONE match, gated, each row opens the rule detail for that match
    const m = matchList().find(x => x.id === mid) || {}, fnd = ((L().matches || {})[mid] || { findings: [] }).findings;
    const rows = fnd.map(x => { const f = factOf(mid, 'ledger:' + x.rule), h = sub({ rule: x.rule, match: mid });
      return f && f.trust === 'blocked' ? row(x.title, plainReason(f.blocked_because), 'not measurable yet', 'muted', h)
        : row(x.title, [unitOf(x.rule), x.enough_data ? (x.flagged ? 'flagged' : 'on target') : 'below the minimum sample', f && f.trust === 'rough' && f.words ? f.words : ''].filter(Boolean).join(' · '), fmtRule(x.rule, x.value) + estTag(f), x.flagged ? 'o' : 'g', h); }).join('');
    return `<div class="mc3 co-flow" data-grid="g2"><div class="mc-col">${pan(`FINDINGS · ${esc(m.title || mid)}`, (rows || '<p class="mc-foot">No findings for this match.</p>') + `<a class="lnk" href="${sub({ match: null })}">All matches</a>`, 'hug')}</div></div>`;
  }
  function view(tab, c, S) {
    if (tab === 'patterns') return typeof patternsView === 'function' ? patternsView() : '';
    if (tab === 'findings' && S.match && !S.rule) return matchRules(S.match);
    if (tab === 'findings' && !S.rule && typeof findingsView === 'function') return findingsView(latestWith(coachFor), S);   // round 8: the findings list (page-findings.js)
    if (tab === 'findings') return S.rule ? ruleDetail(S) : `<div class="mc3 co-flow" data-grid="g2">${['me', 'team', 'duo'].map(w => `<div class="mc-col">${pan(w === 'me' ? `${P1().toUpperCase()} · RULES` : w === 'duo' ? 'TOGETHER · RULES' : 'TEAM · RULES', ledgerRows(r => groupOf(r) === w), 'hug')}</div>`).join('')}</div>`;
    if (tab === 'p1' || tab === 'p2') {
      const who = tab === 'p1' ? P1() : P2(), list = items(c, tab), gaps = items(c, 'data').filter(it => new RegExp(who, 'i').test(it.text) && !/controller/i.test(it.text));
      if (tab === 'p2' && !list.length) return `<div class="mc3 co-flow" data-grid="g2"><div class="mc-col">${pan(`HABITS · ${who.toUpperCase()}`, row('Controller not logged yet', `Without ${who}’s pad inputs the coach can’t judge his RT/LT habits. What the minimap alone can say about him is in Together.`, null) + (gaps.length ? itemRows(gaps) : ''), 'hug')}</div>
        <div class="mc-col">${pan('WHAT UNLOCKS MORE', row(`${who}’s controller isn’t logged yet`, `Run the small logger on ${who}’s PC, or turn on Input Overlay in the game.`, null) + row('Custom radar colours', 'marker colours that the minimap can tell apart: co-op rules become measurable', null), 'hug')}</div>
        <div class="mc-col">${pan('TARGETS FOR THE NEXT MATCH', targetRows(c, ['p2', 'peti']), 'hug')}</div></div>`;
      return `<div class="mc3 co-flow" data-grid="g2"><div class="mc-col">${pan(`HABITS · ${who.toUpperCase()}`, itemRows(list), 'hug')}</div>
        <div class="mc-col">${pan('TARGETS FOR THE NEXT MATCH', targetRows(c, tab === 'p1' ? ['me', 'p1'] : ['p2', 'peti']), 'hug')}</div>
        <div class="mc-col">${pan('KEEP DOING', itemRows(items(c, 'keep')), 'hug')}${gaps.length ? pan('DATA GAPS', itemRows(gaps), 'hug') : ''}</div></div>`;
    }
    if (tab === 'duo') {
      const d = c.duo || {}, roles = [d.p1_role && row(P1(), String(d.p1_role).replace(new RegExp('^' + P1() + ':\\s*'), ''), null, '', '', '<i class="dot p1"></i> '), d.p2_role && row(P2(), String(d.p2_role).replace(new RegExp('^' + P2() + ':\\s*'), ''), null, '', '', '<i class="dot p2"></i> ')].filter(Boolean).join('');
      const rules = (d.rules || []).map(r => { const [t, x] = split(r); return row(t, x, null); }).join('');
      const extra = items(c, 'duo').filter(it => !(d.rules || []).some(r => split(r)[0].slice(0, 20) === (it.short || '').slice(0, 20)));
      return `<div class="mc3 co-flow" data-grid="g2"><div class="mc-col">${pan('DUO RULES', rules || '<p class="mc-foot">No duo rules.</p>', 'hug')}</div>
        <div class="mc-col">${pan('WHO DEFENDS', roles || '<p class="mc-foot">No roles in the coach file.</p>', 'hug')}${extra.length ? pan('TOGETHER · COACH', itemRows(extra), 'hug') : ''}</div>
        <div class="mc-col">${pan('TOGETHER · RULES', ledgerRows(r => groupOf(r) === 'duo'), 'hug')}</div></div>`;
    }
    return `<div class="mc3 co-flow" data-grid="g2"><div class="mc-col">${pan('TEAM & SHAPE', itemRows(items(c, 'team')), 'hug')}<p class="mc-foot">Settings and instructions: <a class="lnk" href="#page=tactics">Tactics</a></p></div>
      <div class="mc-col">${pan('TEAM TARGETS', targetRows(c, ['team']), 'hug')}</div>
      <div class="mc-col">${progressPanel()}</div></div>`;
  }
  const lastDebrief = () => { const m = lastMatch(); return m ? `#page=match&id=${encodeURIComponent(m.id)}&tab=debrief` : '#page=matches'; };
  // Decision 2: "Last match debrief" is the first row of column 1 on the player tabs (A opens Match Centre › Debrief; B returns here)
  function debriefRow() {
    const m = lastMatch(); if (!m) return '';
    return `<section class="mc-pan hug co-deb">${row('Last match debrief', [m.title || '', '5 steps'].filter(Boolean).join(' · '), null, '', lastDebrief())}</section>`;
  }
  REG.findings.title = () => 'Coaching';
  REG.findings.tabs = () => ['p1', 'p2', 'duo', 'team', 'patterns', 'findings'];
  REG.findings.render = function (S) {
    const lc = latestWith(coachFor); if (!lc) return '<div class="tile empty">No coach file yet.</div>';
    const def = (typeof viewer === 'function' && viewer() === 'p2') ? 'p2' : 'p1';
    const tab = S.rule || S.match || S.view === 'ledger' ? 'findings' : ['p1', 'p2', 'duo', 'team', 'patterns', 'findings'].includes(S.tab) ? S.tab : def;
    // grid brief: ONE Sub-tab Bar with the 6 real tabs (LT RT switch only tabs); the session line is the band meta (x 900)
    const meta = tab === 'patterns' ? ((typeof patternsEarly === 'function' && patternsEarly()) || shortDate(lc.day) + ' session')
      : tab === 'findings' && !S.rule && !S.match && typeof findingsMeta === 'function' ? findingsMeta(lc) : `${shortDate(lc.day)} session`;
    const tabs = GRID.stb([['p1', P1()], ['p2', P2()], ['duo', 'Together'], ['team', 'Team'], ['patterns', 'Patterns'], ['findings', 'Findings']].map(([k, l]) => ({ label: l, href: sub({ tab: k === def ? null : k, rule: null, match: null, f: null }), on: tab === k })), { label: 'Coaching tabs', meta: esc(meta) });
    let body = view(tab, lc.v, S);
    if (['p1', 'p2', 'duo', 'team'].includes(tab)) body = body.replace('<div class="mc-col">', `<div class="mc-col gz-col1">${debriefRow()}`);
    return tabs + body;
  };
})();
