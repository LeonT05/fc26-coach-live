/* Fixtures list and Match Centre (summary, flow, attacks, players, duo). Replay lives in replay.js */
'use strict';

REG.matches = {
  title: () => 'Matches',
  render() {
    const ms = matchList().slice().reverse();
    const T = seasonTotals(matchList());
    const rows = ms.map(m => {
      const rawS = m.score_us_them || [], s = [isNum(rawS[0]) ? rawS[0] : '–', isNum(rawS[1]) ? rawS[1] : '–'];
      const home = m.our_side !== 'away', xg = xgOf(m), po = ft(m, 'Possession %'), sh = ft(m, 'Shots');
      const oppLabel = teamName(m.opp);
      const us = `<span class="tmn">${esc(clubName())}</span>${badge(m.ours || 'COM', 1, 'sm')}`, th = `${badge(m.opp, 0, 'sm')}<span class="tmn">${esc(oppLabel)}</span>`, us2 = `${badge(m.ours || 'COM', 1, 'sm')}<span class="tmn">${esc(clubName())}</span>`, th2 = `<span class="tmn">${esc(oppLabel)}</span>${badge(m.opp, 0, 'sm')}`;
      const sc = home ? `${us}<span>${s[0]}</span><span class="muted">–</span><span>${s[1]}</span>${th}` : `${th2}<span>${s[1]}</span><span class="muted">–</span><span>${s[0]}</span>${us2}`;
      return `<a class="tile hov fx" href="#page=match&id=${encodeURIComponent(m.id)}">
        <div class="when"><b>${esc(shortDate(m.date))}</b>${esc(m.competition || 'Serie A')} · ${home ? 'Home' : 'Away'}</div>
        <div class="row" style="gap:14px"><div class="sc">${sc}</div>${resChip(resultOf(m), 1)}</div>
        <div class="kp"><div><span class="lbl">xG</span><b>${xg ? (home ? [xg[0], xg[1]] : [xg[1], xg[0]]).map(v => fmt(v, 1)).join('–') : '–'}</b></div><div><span class="lbl">Poss</span><b>${po ? (home ? po : [po[1], po[0]]).join('–') : '–'}</b></div>
          <div><span class="lbl">Shots</span><b>${sh ? (home ? sh : [sh[1], sh[0]]).join('–') : '–'}</b></div><div><span class="lbl">POTM</span><b>${esc(m.potm || '–')}</b></div>
          <div class="muted small" style="align-self:center">${esc(m.difficulty || '')}<br>${esc(m.weather || '')}</div></div></a>`;
    }).join('');
    // streaks brief (Figma M1 273:15606): the compact Club Streaks Panel replaces the header; the list stays
    const sp = window.STRK ? STRK.clubPanel() : '';
    // grid brief G6: the section title sits in the band (y 140); streaks + tiles scroll inside ONE content zone (y 200-920)
    if (sp) return `${GRID.bandTitle('Matches', { meta: esc(`Serie A ${seasonLabel()}`) })}<div class="g6z" data-grid="g6">${sp}<div class="stack">${rows || '<div class="tile empty">No matches recorded yet.</div>'}</div></div>`;
    return `<div class="ptitle keep"><h1><small>Serie A ${esc(seasonLabel())}</small>Results</h1><span class="spacer"></span>
      <div class="stats" style="min-width:min(520px,100%)">${statBox(T.p, 'Played')}${statBox(T.pts, 'Points', { cls: 'g' })}${statBox(T.gf, 'Scored', { cls: 'us' })}${statBox(T.ga, 'Conceded', { cls: 'them' })}${statBox(T.xgn ? T.xgf - T.xga : null, 'xG diff', { d: 1 })}</div></div>
      <div class="stack">${rows || '<div class="tile empty">No matches recorded yet.</div>'}</div>`;
  },
  // pad entry (Pad parity 288:28804): the first match tile; B in Match Centre returns to the opened tile (navstate memory)
};

// ---------------- match centre ----------------
const MTABS = [['summary', 'Summary'], ['flow', 'Flow'], ['replay', 'Replay'], ['attacks', 'Attacks & Shots'], ['players', 'Players'], ['duo', 'Duo']];
const ourCode = m => m.teams ? m.teams[m.our_side === 'home' ? 0 : 1] : 'US';
const oppCode = m => m.teams ? m.teams[m.our_side === 'home' ? 1 : 0] : 'THEM';
// opens the replay popup at that minute (replay_v2); falls back to the old Replay tab via the href
const watchLink = (mn, label = 'watch') => `<a class="lnk" href="${sub({ tab: 'replay', t: Math.max(0, mn).toFixed(1), chain: null })}" data-replay="${esc(S.id || '')}@m${Math.max(0, mn).toFixed(2)}">${ICON.film} ${label}</a>`;

REG.match = {
  title: S => { const r = matchRef(S.id); return r ? r.title : 'Match'; },
  tabs: () => MTABS.map(t => t[0]),
  need: S => { const r = matchRef(S.id) || matchList()[matchList().length - 1]; return r ? ensureDay(r.day) : null; },
  ready: S => { const r = matchRef(S.id); return r && dayData(r.day); },
  render(S) {
    const ref = matchRef(S.id) || matchList()[matchList().length - 1];
    if (!ref) return '<div class="tile empty">No matches yet.</div>';
    if (S.id !== ref.id) S.id = ref.id;
    const m = matchData(ref.id);
    if (!m) return `<div class="tile empty">No data for ${esc(ref.title)} yet.</div>`;
    const tab = MTABS.some(t => t[0] === S.tab) ? S.tab : 'summary';
    const ms = matchList(), k = ms.findIndex(x => x.id === ref.id);
    const prev = ms[k - 1], next = ms[k + 1];
    const s = m.score_us_them || [0, 0], home = m.our_side === 'home';
    const meta = m.meta || {};
    const hc = m.teams ? m.teams[0] : '', ac = m.teams ? m.teams[1] : '';
    const hs = home ? s[0] : s[1], as = home ? s[1] : s[0];
    const head = `<div class="row" style="margin-bottom:10px"><a class="crumb" href="#page=matches">${ICON.back} Fixtures</a></div>
      <div class="mtop"><div><h1>Match Centre</h1><div class="meta">${esc([meta.date, meta.referee && 'Referee: ' + meta.referee].filter(Boolean).join(' | '))}<br>${esc([meta.difficulty, meta.half_length_min && meta.half_length_min + ' minutes', meta.weather].filter(Boolean).join(' | '))}</div></div>
        <span class="spacer"></span>
        <div class="scorebox"><span class="clk">FT</span><span>${esc(teamName(hc))}</span>${badge(hc, home, 'sm')}<span class="s">${hs} - ${as}</span>${badge(ac, !home, 'sm')}<span>${esc(teamName(ac))}</span>${resChip(resultOf(ref))}</div>
        <div class="navs">${prev ? `<a class="btn sq" href="#page=match&id=${encodeURIComponent(prev.id)}&tab=${tab}" data-tip="${esc(prev.title)}">${ICON.left}</a>` : ''}${next ? `<a class="btn sq" href="#page=match&id=${encodeURIComponent(next.id)}&tab=${tab}" data-tip="${esc(next.title)}">${ICON.right}</a>` : ''}</div></div>
      <nav class="stabs"><span class="gl">LT</span>${MTABS.map(([t, l]) => `<a href="${href({ page: 'match', id: ref.id, tab: t })}" class="${t === tab ? 'on' : ''}">${l}</a>`).join('')}<span class="gl">RT</span></nav>`;
    const fn = { summary: mSummary, flow: mFlow, replay: mReplay, attacks: mAttacks, players: mPlayers, duo: mDuo }[tab];
    return head + `<div class="tabbody">${fn(m, S, ref)}</div>`;
  },
  after(S, root) { if ((S.tab || 'summary') === 'replay') { const m = matchData((matchRef(S.id) || {}).id); if (m) Replay.init(m, S); } },
  leave() { Replay.stop(); },
};

// ---- summary ----
const STAT_ORDER = ['Possession %', 'Shots', 'Expected Goals', 'Shot Accuracy', 'Passes', 'Passes Attempted', 'Pass Accuracy %', 'Pass Accuracy', 'Dribble Success Rate', 'Tackles', 'Tackles Won', 'Interceptions', 'Ball Recovery Time (Seconds)', 'Saves', 'Fouls Comitted', 'Fouls Committed', 'Corners', 'Offsides', 'Free Kicks', 'Yellow Cards', 'Red Cards'];
function mSummary(m, S) {
  const snap = S.snap === 'HT' ? 'HT' : 'FT';
  const off = (m.official || {})[snap] || {};
  const k = m.kpis || {}, mt = m.metrics || {}, xg = mt.xg || {};
  const home = m.our_side === 'home';
  const LR = v => v ? (home ? [v[0], v[1]] : [v[1], v[0]]) : [null, null];   // FC convention: home left (green), away right (cyan)
  const hc = m.teams ? m.teams[0] : '', ac = m.teams ? m.teams[1] : '';
  const keys = Object.keys(off).filter(x => x !== 'Possession %').sort((a, b) => { const ia = STAT_ORDER.indexOf(a), ib = STAT_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  const seen = new Set();
  const radar = { 'Shots': mt.shots ? [mt.shots.filter(x => x.team === 'us').length, mt.shots.filter(x => x.team === 'them').length] : null, 'Expected Goals': isNum(xg.us) ? [xg.us, xg.them] : null };
  const rows = keys.filter(kk => { const n = kk.replace(/ %$/, '').replace('Comitted', 'Committed').replace('Passes Attempted', 'Passes'); if (seen.has(n)) return false; seen.add(n); return true; }).map(kk => {
    const [a, b] = LR(off[kk]), d = kk === 'Expected Goals' ? 1 : 0, rv = radar[kk] && LR(radar[kk]);
    return `<div class="mf"><span class="a">${isNum(a) ? a.toFixed(d) : '–'}</span><span class="t">${esc(kk.replace(/ \(Seconds\)/, ' (s)').replace('Comitted', 'Committed'))}${rv ? `<span class="rad">radar ${fmt(rv[0], d)} – ${fmt(rv[1], d)}</span>` : ''}</span><span class="b">${isNum(b) ? b.toFixed(d) : '–'}</span></div>`;
  }).join('');
  const po = LR(off['Possession %'] || (isNum(k.possession) ? [Math.round(k.possession * 100), 100 - Math.round(k.possession * 100)] : null));
  const pl = isNum(po[0]) ? po[0] / 100 : .5;
  const trap = factsPitch();  // the game's Match Facts possession pitch (perspective, end shading in team colours)
  const facts = tile(`Match Facts <span class="spacer"></span><span class="seg"><a href="${sub({ snap: null })}" class="${snap === 'FT' ? 'on' : ''}">Full time</a><a href="${sub({ snap: 'HT' })}" class="${snap === 'HT' ? 'on' : ''}">Half time</a></span>`,
    `<div class="possx"><div class="tmb">${badge(hc, home)}${esc(hc)}</div><div style="display:flex;align-items:center;gap:18px"><span class="pn us">${fmt(po[0])}</span><span style="font-size:17px">Possession %</span><span class="pn them">${fmt(po[1])}</span></div><div class="tmb">${badge(ac, !home)}${esc(ac)}</div></div>
     ${trap}${rows || '<p class="muted">No Match Facts screen captured.</p>'}
     <p class="note">Official in-game stats (OCR; impossible values dropped). Grey = our radar estimate.</p>`, { cls: 'plain' });
  const gstrip = tile('Timeline', goalStrip(m), {});
  const ft2 = mt.field_tilt || {}, pp = mt.ppda || {}, pr = mt.progressive || {}, lb = mt.line_breaks || {};
  // UX review S3: only the 3 metrics tied to plan targets, as the game's stat-row text (no number tiles - banned pattern)
  const krow = (label, v, tip) => `<div class="srow"${tip ? ` data-tip="${esc(tip)}"` : ''}><span>${label}</span><b>${v}</b></div>`;
  const kpi = tile('Key metrics', `<div class="tset2 wide">
    ${krow('Box entries · for / against', `${fmt(k.box_us)} / ${fmt(k.box_them)}`, 'Possessions that reached the box')}
    ${krow('Rest defence when we lose it', `${fmt(k.rest_defence, 1)} <small>target 5–7</small>`, 'Outfielders behind the ball when we lose it')}
    ${krow('Regains · turnovers', `${fmt(k.regains)} / ${fmt(k.turnovers)}`)}</div>
    <p class="note">Minimap estimate · ${fmt(k.real_minutes, 1)} real minutes tracked, minimap visible ${pct(((mt.validation || {}).radar_visible_share))} of the time.</p>`);
  const gm = (m.goal_moments || []).map(g => {
    const b = g.build_up || {}, pp2 = g.previous_possession || {}, a = g.after_60s || {};
    const dk = Object.keys(g).find(x => /_dist_to_ball$/.test(x)), gk = Object.keys(g).find(x => /_goal_side$/.test(x));
    const facts2 = [b.start_third && `from ${b.start_third} third, ${b.lane || ''}${b.counter ? ' (counter)' : ''}, ${fmt(b.dur, 1)} s`,
      pp2.team && `${pp2.team === 'us' ? 'we' : 'they'} lost it in ${pp2.lost_in_third} third`,
      isNum(g.players_behind_ball) && `${g.players_behind_ball} behind ball`,
      dk && isNum(g[dk]) && `${P1()} ${fmt(g[dk], 1)} m from ball${gk ? (g[gk] ? ', goal-side' : ', not goal-side') : ''}`,
      isNum(a.possession) && `next 60 s: ${pct(a.possession)} poss`].filter(Boolean);
    return xItem(`<span class="min" style="font:700 15px var(--fh);width:34px">${minLabel(g.minute)}</span><i class="dot ${g.team}"></i><b>${esc(g.score)}</b><span class="tx muted">${esc(facts2[0] || '')}</span>${watchLink(g.minute - 1.2)}`,
      `<div class="ev">${facts2.map(esc).join(' · ')}</div>`);
  }).join('');
  const goals = tile('Goals', gm ? `<div class="xl">${gm}</div>` : '<p class="muted">No goals.</p>');
  const rts = (m.ratings || []).slice().sort((a, b) => b.rating - a.rating).slice(0, 5);
  const top = tile('Top rated', rts.length ? rts.map(r => { const p = playerByName(r.name) || { name: r.name, id: fold(r.name) }; return `<a class="mini" href="${plink(p)}">${avatar(p)}<div style="flex:1"><div class="nm">${esc(r.name)}${r.potm ? ' <span class="chip acc"><span>POTM</span></span>' : ''}</div><div class="sub">${posBadge(r.pos)} ${r.goals ? r.goals + ' G ' : ''}${r.assists ? r.assists + ' A' : ''}</div></div>${rtPill(r.rating)}</a>`; }).join('')
    : '<p class="muted">No Player Performance screen captured for this match.</p>', { right: `<a href="${sub({ tab: 'players' })}">All</a>` });
  const L = ledger(), lf = L && L.matches && L.matches[m.id] ? L.matches[m.id].findings.filter(f => f.flagged).sort((a, b) => b.severity - a.severity) : [];
  const auto = (m.findings || []).slice().sort((a, b) => (b.severity || 0) - (a.severity || 0));
  const find = tile('Findings', (lf.length ? `<div class="xl">${lf.map(f => `<a class="mini" href="#page=findings&rule=${encodeURIComponent(f.rule)}&match=${encodeURIComponent(m.id)}">${sevDots(f.severity)}${whoChip(f.who)}<span style="flex:1;font-size:13px">${esc(f.title)}</span><b class="nowrap">${esc(ruleValue(f.rule, f.value))}</b></a>`).join('')}</div>` : '')
    + (auto.length ? `<div class="xi" style="margin-top:8px"><div class="xh"><span class="tx lnk">Automatic match notes (${auto.length})</span>${ICON.car}</div><div class="xb xl">${auto.map(f => xItem(`${sevDots(f.severity || 0)}${whoChip(f.who)}<span class="tx">${esc(f.title)}</span>`, `<div class="ev">${esc(f.evidence)}</div>${f.advice ? `<p class="small" style="margin:6px 0 0">${esc(f.advice)}</p>` : ''}`)).join('')}</div></div>` : ''), { right: `<a href="#page=findings&match=${encodeURIComponent(m.id)}">Drill down</a>` });
  return `<div class="grid g2">${facts}<div class="stack">${gstrip}${kpi}${goals}</div></div><div class="grid g2" style="margin-top:18px">${top}${find}</div>`;
}

// ---- flow ----
const STATE_COLS = [['real_min', 'Real min', v => fmt(v, 1)], ['possession', 'Poss', v => pct(v)], ['territory', 'Territory', v => isNum(v) ? (v > 0 ? '+' : '') + fmt(v, 2) : '–'],
  ['box_entries_us_per_min', 'Box/min us', v => fmt(v, 2)], ['box_entries_them_per_min', 'Box/min them', v => fmt(v, 2)], ['my_sprint', 'P1 sprint', v => pct(v)], ['my_jockey', 'P1 jockey', v => pct(v)]];
function stateTable(obj, keys, id) {
  const rows = (keys || Object.keys(obj || {})).filter(k => obj && obj[k]);
  if (!rows.length) return '<p class="muted">No data.</p>';
  return `<div class="tscroll"><table class="dt" id="${id}"><thead><tr><th></th>${STATE_COLS.map(c => `<th class="n">${c[1].replace('P1', esc(P1()))}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(k => `<tr><td><b>${esc(k)}</b></td>${STATE_COLS.map(c => `<td class="n">${c[2](obj[k][c[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const chainDesc = c => `${c.counter ? 'Counter' : 'Attack'} from ${c.start_third} third, ${c.lane}`;
const chainNums = c => `${fmt(c.dur, 1)} s · ${c.progress >= 0 ? '+' : ''}${fmt(c.progress, 0)} m`;
const outTag = o => `<span class="tag ${o === 'shot' ? 'shot' : o === 'goal' ? 'goal' : ''}">${esc(o)}</span>`;
function mFlow(m, S) {
  const w = S.win && /^[\d.]+-[\d.]+$/.test(S.win) ? S.win.split('-').map(Number) : null;
  const inWin = x => !w || (x.minute >= w[0] && x.minute < w[1]);
  const bin = w && (m.momentum || []).find(b => b.from === w[0]);
  const rows = [];
  (m.chains || []).forEach((c, i) => { if (inWin(c) && (c.f3 || c.box || c.shot)) rows.push({ minute: c.minute, kind: 'chain', i, c }); });
  (m.goals || []).forEach(g => { if (inWin(g)) rows.push({ minute: g.minute, kind: 'goal', g }); });
  (m.events || []).forEach(e => { if (inWin(e)) rows.push({ minute: e.minute, kind: 'event', e }); });
  rows.sort((a, b) => a.minute - b.minute);
  const list = rows.map(r => {
    if (r.kind === 'goal') return `<a class="item" href="${sub({ tab: 'replay', t: Math.max(0, r.minute - 1.2).toFixed(1) })}" data-replay="${esc(S.id || '')}@m${Math.max(0, r.minute - .6).toFixed(2)}"><span class="min">${minLabel(r.minute)}</span><span><b>Goal ${r.g.team === 'us' ? esc(ourCode(m)) : esc(oppCode(m))}</b> ${esc(r.g.score)}</span><span class="tag goal">goal</span></a>`;
    if (r.kind === 'event') return `<div class="item" style="cursor:default"><span class="min">${minLabel(r.minute)}</span><span class="muted">${esc(r.e.type)} · ${esc(r.e.name)}</span><span></span></div>`;
    const c = r.c;
    return `<a class="item" href="${sub({ tab: 'attacks', chain: r.i })}"><span class="min">${minLabel(c.minute)}</span><span><i class="dot ${c.team}"></i> ${chainDesc(c)}<div class="meta">${chainNums(c)}</div></span>${outTag(c.outcome)}</a>`;
  }).join('');
  const thirds = m.thirds || {};
  return `<div class="stack">
    ${tile(`Momentum <span class="spacer"></span>${w ? `<span class="chip acc"><span>${w[0]}–${w[1]}'</span></span><a href="${sub({ win: null })}">Clear</a>` : '<span class="sub">click a window</span>'}`,
      momentumChart(m, 220, { axis: true, pad: 26, win: w, hrefFor: b => sub({ win: w && w[0] === b.from ? null : `${b.from}-${b.to}` }) })
      + `<div class="legend"><span><i class="sw" style="background:var(--us)"></i>${esc(ourCode(m))} on top</span><span><i class="sw" style="background:var(--them)"></i>${esc(oppCode(m))} on top</span><span>grey = radar hidden</span></div>`
      + (bin ? `<div class="stats" style="margin-top:12px">${statBox(isNum(bin.possession) ? bin.possession * 100 : null, 'Possession', { suf: '%' })}${statBox(bin.territory, 'Territory', { d: 2 })}${statBox(`${bin.box_us}–${bin.box_them}`, 'Box entries')}${statBox(`${bin.shots_us}–${bin.shots_them}`, 'Shots')}
        <a class="stat" href="${sub({ tab: 'replay', t: w[0] })}"><div class="v">${ICON.play.replace('<svg', '<svg width="22" height="22"')}</div><div class="l">Watch window</div></a></div>` : ''))}
    <div class="grid g2">
      ${tile(w ? `Moments ${w[0]}–${w[1]}'` : 'Key moments', `<div class="list">${list || '<p class="muted">Nothing in this window.</p>'}</div>`)}
      <div class="stack">${tile(`By game state ${info(`Does our play change when leading or trailing? Sprint/Jockey = share of ${P1()}'s time holding RT / LT.`)}`, stateTable(m.game_state, ['leading', 'drawing', 'trailing'], 'gs'))}
      ${tile('By period', stateTable(m.periods, null, 'per'))}</div>
    </div>
    ${tile('Where the ball is won and lost', `<div class="tscroll"><table class="dt"><thead><tr><th>Third</th><th class="n">Time</th><th class="n">Our poss.</th><th class="n">Lost</th><th class="n">Won</th><th class="n">${esc(P1())} passes kept</th></tr></thead><tbody>
      ${['def', 'mid', 'att'].filter(k => thirds[k]).map(k => { const t = thirds[k], p = (t.my_actions || {}).pass; return `<tr><td><b>${k}</b></td><td class="n">${pct(t.time_share)}</td><td class="n">${pct(t.our_possession_share)}</td><td class="n bad">${t.turnovers}</td><td class="n good">${t.regains}</td><td class="n">${p ? pct(p.kept) + ` <span class="muted small">of ${p.n}</span>` : '–'}</td></tr>`; }).join('')}
    </tbody></table></div>`)}
  </div>`;
}

// ---- attacks & shots ----
const AF = [['fteam', 'team', ['all', 'us', 'them']], ['fout', 'outcome', ['all', 'shot', 'box', 'final third', 'lost/reset']], ['fthird', 'start', ['all', 'def', 'mid', 'att']], ['flane', 'lane', ['all', 'left', 'centre', 'right']], ['fctr', 'counter', ['all', 'yes', 'no']]];
function pathD(path) { return path && path.length ? 'M' + path.map(p => (+p[0]).toFixed(1) + ',' + (+p[1]).toFixed(1)).join('L') : ''; }
function mAttacks(m, S) {
  const F = { fteam: S.fteam || 'us', fout: S.fout || 'all', fthird: S.fthird || 'all', flane: S.flane || 'all', fctr: S.fctr || 'all' };
  const all = (m.chains || []).map((c, i) => ({ ...c, i }));
  const sel = S.chain != null && all[+S.chain] ? all[+S.chain] : null;
  const pass = c => (F.fteam === 'all' || c.team === F.fteam) && (F.fout === 'all' || c.outcome === F.fout) && (F.fthird === 'all' || c.start_third === F.fthird) && (F.flane === 'all' || c.lane === F.flane) && (F.fctr === 'all' || (F.fctr === 'yes') === !!c.counter);
  if (sel && !pass(sel)) Object.keys(F).forEach(k => { F[k] = k === 'fteam' ? sel.team : 'all'; });
  const list = all.filter(pass), n = list.length || 1;
  const notes = {}; ((ledger() || {}).possessions || {})[m.id] && ledger().possessions[m.id].forEach(x => { if (x.chain != null) notes[x.chain] = x; });
  const filt = AF.map(([k, l, opts]) => `<label><span class="lbl">${l}</span><span class="seg">${opts.map(o => `<a href="${sub({ [k]: o === (k === 'fteam' ? 'us' : 'all') ? null : o, chain: null })}" class="${F[k] === o ? 'on' : ''}">${o}</a>`).join('')}</span></label>`).join('');
  const faint = list.filter(c => !sel || c.i !== sel.i).map(c => `<path d="${pathD(c.path)}" fill="none" stroke="var(--${c.team})" stroke-width=".5" stroke-opacity="${sel ? .12 : .4}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  let hi = '';
  if (sel && sel.path && sel.path.length) {
    const p0 = sel.path[0];
    hi = `<path d="${pathD(sel.path)}" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrW)" class="drawpath"/>
      <circle cx="${p0[0]}" cy="${p0[1]}" r="1.4" fill="var(--${sel.team})" stroke="#fff" stroke-width=".4"/>`;
  }
  const defs = `<defs><marker id="arrW" viewBox="0 0 6 6" refX="4" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0L6,3L0,6z" fill="#fff"/></marker></defs>`;
  const rows = list.map(c => `<a class="item ${sel && sel.i === c.i ? 'sel' : ''}" href="${sub({ chain: sel && sel.i === c.i ? null : c.i })}"><span class="min">${minLabel(c.minute)}</span>
    <span><i class="dot ${c.team}"></i> ${esc(chainDesc(c))}<div class="meta">${chainNums(c)} · directness ${fmt(c.directness, 2)}${notes[c.i] ? ` · <span style="color:var(--warn)">${esc(notes[c.i].kind)}</span>` : ''}</div></span>${outTag(c.outcome)}</a>`).join('');
  const sh = ((m.metrics || {}).shots || []).filter(x => isNum(x.x));
  const shots = sh.map(x => { const r = 0.9 + 3.2 * Math.sqrt(Math.max(0.01, x.xg || 0)), goal = x.outcome === 'goal';
    return `<a href="${sub({ tab: 'replay', t: Math.max(0, x.minute - .6).toFixed(1), chain: null })}"><circle cx="${x.x}" cy="${x.y}" r="${r.toFixed(2)}" fill="var(--${x.team})" fill-opacity="${goal ? .95 : .22}" stroke="${goal ? '#fff' : `var(--${x.team})`}" stroke-width=".35"><title>${minLabel(x.minute)} ${x.team === 'us' ? 'us' : 'them'} · xG ${fmt(x.xg, 2)} · ${esc(x.outcome || '')}${x.shooter ? ' · ' + esc(x.shooter) : ''}${x.inferred ? ' · inferred' : ''} (click to watch)</title></circle></a>`; }).join('');
  const xg = (m.metrics || {}).xg || {};
  return `<div class="filters">${filt}</div>
    <div class="grid g-side">
      <div class="stack">
        ${tile(sel ? `${minLabel(sel.minute)} · ${esc(chainDesc(sel))} <span class="spacer"></span>${watchLink(sel.minute - .4)}` : 'Possession paths', `<div class="pitchwrap">${pitchSVG(defs + faint + hi)}</div>
          ${sel ? `<div class="row small" style="margin-top:10px">${outTag(sel.outcome)}<span>${chainNums(sel)}</span>${notes[sel.i] ? `<span class="chip" style="border-color:var(--warn);color:var(--warn)"><span>${esc(notes[sel.i].kind)}</span></span><span class="muted">${esc(notes[sel.i].detail)}</span>` : ''}</div>` : '<p class="note">Click a possession in the list to draw it. Their attacks run right to left.</p>'}`)}
        <div class="grid g2">
          ${tile(`${list.length} possessions`, meter('Reach final third', sum(list, c => c.f3 ? 1 : 0) / n) + meter('Reach the box', sum(list, c => c.box ? 1 : 0) / n) + meter('End in a shot', sum(list, c => c.shot ? 1 : 0) / n)
            + `<p class="note">Counters ${sum(list, c => c.counter ? 1 : 0)} · avg ${fmt(sum(list, c => c.dur) / n, 1)} s · avg +${fmt(sum(list, c => c.progress) / n, 0)} m</p>`)}
          ${tile(`Shot map ${info('Circle size = xG (our model), filled = goal. Radar misses shots during replays, so official totals can be higher. Click a shot to watch it.')}`, sh.length ? `<div class="pitchwrap">${pitchSVG(shots, { noArrow: true })}</div><div class="row small" style="justify-content:space-between;margin-top:8px"><span><i class="dot us"></i> xG ${fmt(xg.us, 2)} (${sh.filter(x => x.team === 'us').length})</span><span>(${sh.filter(x => x.team === 'them').length}) ${fmt(xg.them, 2)} xG <i class="dot them"></i></span></div>` : '<p class="muted">No shots located.</p>')}
        </div>
      </div>
      ${tile('Possessions', `<div class="list" style="max-height:860px">${rows || '<p class="muted">No possessions match.</p>'}</div>`)}
    </div>`;
}

// ---- players ----
function passNetwork(m, focus) {
  const pos = {}; (m.players || []).forEach(p => { if (isNum(p.avg_x)) pos[p.name] = p; });
  const pair = {};
  (m.pass_links || []).forEach(l => { if (!pos[l.from] || !pos[l.to]) return; const k = [l.from, l.to].sort().join('|'); pair[k] = (pair[k] || 0) + l.n; });
  const mx = Math.max(1, ...Object.values(pair));
  let s = '';
  Object.entries(pair).sort((a, b) => a[1] - b[1]).forEach(([k, n]) => {
    const [a, b] = k.split('|'), A = pos[a], B = pos[b], on = !focus || a === focus || b === focus;
    s += `<line x1="${A.avg_x}" y1="${A.avg_y}" x2="${B.avg_x}" y2="${B.avg_y}" stroke="${on && focus ? '#fff' : '#6cb6ff'}" stroke-width="${(0.3 + 1.8 * n / mx).toFixed(2)}" stroke-opacity="${on ? (focus ? .85 : .55) : .07}" stroke-linecap="round"><title>${esc(a)} ↔ ${esc(b)}: ${n} passes</title></line>`;
  });
  const mt = Math.max(1, ...Object.values(pos).map(p => p.touches || 0)); let ov = '';
  Object.values(pos).forEach(p => {
    const r = 1.4 + 1.8 * Math.sqrt((p.touches || 0) / mt), dim = focus && focus !== p.name && !pair[[focus, p.name].sort().join('|')];
    // discs live in pitch space (rotated with the pitch); labels go in the unrotated overlay so they are always upright
    s += `<a href="${sub({ player: focus === p.name ? null : p.name })}"><g opacity="${dim ? .35 : 1}"><circle cx="${p.avg_x}" cy="${p.avg_y}" r="${r.toFixed(2)}" fill="${focus === p.name ? '#fff' : '#2f6fe8'}" stroke="#cfe0ff" stroke-width=".35"/><title>${esc(p.name)}: ${p.touches} touches</title></g></a>`;
    const [sx, sy] = pitchPt(p.avg_x, p.avg_y);
    ov += `<g opacity="${dim ? .35 : 1}" style="pointer-events:none"><text x="${sx.toFixed(1)}" y="${(sy + .7).toFixed(1)}" text-anchor="middle" style="font:700 1.9px var(--fh);fill:${focus === p.name ? '#06101f' : '#fff'}">${esc(String(p.label || '').replace(/2$/, ''))}</text>
      <text x="${sx.toFixed(1)}" y="${(sy - r - .8).toFixed(1)}" text-anchor="middle" style="font-size:2.3px;fill:#dfe8ff">${esc(p.name)}</text></g>`;
  });
  return pitchSVG(s, { overlay: ov });
}
function mPlayers(m, S) {
  const mt = m.metrics || {}, ours = {}; (mt.ratings || []).forEach(r => { if (r.name) ours[r.name] = r; });
  const rows = (m.players || []).map(p => ({ ...p, rating: p.official ? p.official.rating : null, pos: (p.official && p.official.pos) || p.label }));
  (m.ratings || []).forEach(r => { if (!rows.some(p => p.name === r.name)) rows.push({ name: r.name, pos: r.pos, rating: r.rating, official: r, radarless: true }); });
  const byRt = rows.slice().sort((a, b) => (b.rating ?? (ours[b.name] || {}).score ?? 0) - (a.rating ?? (ours[a.name] || {}).score ?? 0));
  const sel = rows.find(r => r.name === S.player) || byRt.find(r => r.official && r.official.potm) || byRt[0];
  if (!sel) return '<div class="tile empty">No players for this match.</div>';
  const xt = (mt.xt || {}).by_player || {}, pr = (mt.progressive || {}).by_player || {}, xg = mt.xg_by_player || {};
  const o = sel.official || {}, det = o.detail || {}, pl = playerByName(sel.name) || { name: sel.name, id: fold(sel.name) };
  const nmParts = String(sel.name).split(' ');
  // left: header + ratings list
  const list = `<div class="phd"><div class="o"><b>${fmt(pl.ovr)}</b><span>OVR</span></div><div class="ph">${portrait(pl, 'M')}</div>
      <div class="nm">${nmParts.length > 1 ? esc(nmParts.slice(0, -1).join(' ')) + '<b>' + esc(nmParts[nmParts.length - 1]) + '</b>' : '<b>' + esc(sel.name) + '</b>'}</div>${ring(sel.rating ?? (ours[sel.name] || {}).score)}</div>
    <div class="tile plain flat" style="border-radius:0 0 10px 10px;padding:4px 8px 8px"><div class="tscroll"><table class="dt" id="perf" data-sortable data-default="2:-1"><thead><tr><th data-sort="str">POS</th><th data-sort="str">Name</th><th data-sort class="n">RR</th><th data-sort class="n">G</th><th data-sort class="n">AST</th></tr></thead><tbody>
      ${rows.map(p => { const r = p.rating ?? null, oo = p.official || {}; return `<tr class="click ${p.name === sel.name ? 'sel' : ''}" data-href="${sub({ player: p.name })}"><td>${esc(String(p.pos || '').replace(/2$/, ''))}</td><td>${oo.potm ? '<i class="ico star"></i> ' : ''}${esc(p.name)}</td>
        <td class="n" data-v="${r ?? ''}">${isNum(r) ? `<span class="rt ${rtCls(r)}">${fmt(r, 1)}</span>` : `<span class="muted" data-tip="No official rating - our radar rating">${fmt((ours[p.name] || {}).score, 1)}</span>`}</td><td class="n">${oo.goals ?? '–'}</td><td class="n">${oo.assists ?? '–'}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  // middle: position
  const mid = `<div><div style="font:600 18px var(--fb)">Total Rating: ${fmt(sel.rating, 1)}</div>${o.potm ? '<div style="font:600 17px var(--fb);margin-bottom:8px"><i class="ico star"></i> Player of the Match</div>' : '<div class="muted" style="margin-bottom:8px">' + esc(sel.pos || '') + '</div>'}
    ${sel.heat ? `<div class="pitchwrap">${pitchSVG(heatCells(sel.heat, '#2fbf6a') + (isNum(sel.avg_x) ? `<circle cx="${sel.avg_x}" cy="${sel.avg_y}" r="1.6" fill="#0B0D12" stroke="#fff" stroke-width=".45"><title>Average position</title></circle>` : ''))}</div>` : '<div class="tile plain empty">No radar track for this player.</div>'}
    <div class="heavy" style="text-align:center;font-size:17px;margin-top:8px">Overall position</div>
    ${sel.radarless ? '' : `<div class="stats" style="margin-top:14px">${statBox(sel.touches, 'Touches')}${statBox(sel.passes, 'Passes')}${statBox(sel.regains, 'Won')}${statBox(sel.losses, 'Lost', { cls: 'b' })}
      ${statBox(xt[sel.name] ? xt[sel.name].total : null, 'xT', { d: 2 })}${statBox(pr[sel.name] ? (pr[sel.name].passes || 0) + (pr[sel.name].carries || 0) : null, 'Progressive')}</div>
      <div style="margin-top:12px"><div class="row small" style="justify-content:space-between"><span style="color:var(--p1)">${esc(P1())} ${pct(sel.ctrl_p1)}</span><span class="muted">control</span><span style="color:var(--p2)">${pct(sel.ctrl_p2)} ${esc(P2())}</span></div>
      <div class="split" style="margin-top:5px"><i class="p1" style="flex:${sel.ctrl_p1 || 0}"></i><i class="ai" style="flex:${Math.max(0, 1 - (sel.ctrl_p1 || 0) - (sel.ctrl_p2 || 0))}"></i><i class="p2" style="flex:${sel.ctrl_p2 || 0}"></i></div></div>`}</div>`;
  // right: stat list player vs team
  const dk = Object.keys(det);
  const right = `<div class="statlist"><div class="sr hd"><span><a class="lnk" href="${plink(pl)}">Open profile <i class="chev" aria-hidden="true"></i></a></span><span>${avatar(pl)}</span><span>${badge(ourCode(m), 1, 'sm')}</span></div>
    ${dk.length ? dk.map(kk => { const v = det[kk] || []; return `<div class="sr"><span>${esc(kk.replace('Minutes Played', 'Minutes Played vs Team Average').replace(/^Distance (Covered|Sprinted)$/, 'Distance $1 (km)'))}</span><span>${fmt(v[0], v[0] % 1 ? 1 : 0)}</span><span>${fmt(v[1], v[1] % 1 ? 1 : 0)}</span></div>`; }).join('')
      : '<p class="muted">No Player Performance detail page captured for this player.</p>'}
    ${isNum(xg[sel.name]) ? `<div class="sr"><span>xG (radar model)</span><span>${fmt(xg[sel.name], 2)}</span><span>${fmt(mt.xg && mt.xg.us, 2)}</span></div>` : ''}</div>`;
  const perf = `<div class="perf"><div>${list}</div>${mid}${right}</div>`;
  // pass network + radar table
  const radarRows = rows.filter(p => !p.radarless).map(p => `<tr class="click ${p.name === sel.name ? 'sel' : ''}" data-href="${sub({ player: p.name })}"><td>${esc(p.name)}</td><td class="n">${fmt(p.minutes, 1)}</td><td class="n">${fmt(p.touches)}</td><td class="n">${fmt(p.passes)}</td><td class="n">${fmt(p.received)}</td><td class="n">${fmt(p.losses)}</td><td class="n">${fmt(p.regains)}</td><td class="n">${xt[p.name] ? fmt(xt[p.name].total, 2) : '–'}</td><td class="n">${fmt(p.distance_m)}</td><td class="n" style="color:var(--p1)">${pct(p.ctrl_p1)}</td><td class="n" style="color:var(--p2)">${pct(p.ctrl_p2)}</td></tr>`).join('');
  return `${perf}<div class="grid g2" style="margin-top:22px">
    ${tile(`Pass network ${info('Average positions from radar; line width = passes between the pair; dot size = touches. Click a player.')}`, `<div class="pitchwrap">${passNetwork(m, sel.name)}</div>`)}
    ${tile('Radar data', `<div class="tscroll"><table class="dt" id="radtbl" data-sortable data-default="2:-1"><thead><tr><th data-sort="str">Player</th><th data-sort class="n">Real min</th><th data-sort class="n">Touch</th><th data-sort class="n">Pass</th><th data-sort class="n">Recv</th><th data-sort class="n">Lost</th><th data-sort class="n">Won</th><th data-sort class="n">xT</th><th data-sort class="n">Dist m</th><th data-sort class="n">${esc(P1())}</th><th data-sort class="n">${esc(P2())}</th></tr></thead><tbody>${radarRows}</tbody></table></div>
      <p class="note">Radar counts cover tracked time only (${fmt((m.kpis || {}).real_minutes, 1)} real min).</p>`, { cls: 'flat' })}</div>`;
}

// ---- duo (per match) ----
function ctlFor(m, marker) {
  const C = m.controllers || {}, A = m.actions || {};
  const slot = Object.keys(C).find(s => C[s] && C[s].marker === marker);
  return slot != null ? { ctl: C[slot], act: A[slot] } : null;
}
function actionsBlock(act, ctl, who) {
  if (!act && !ctl) return `<p class="muted">${esc(who)}'s controller isn't captured for this match.</p>`;
  const dist = (o, order) => { const e = Object.entries(o || {}).filter(([k]) => !order || order.includes(k)); const tot = sum(e, x => x[1].n) || 1; return e.sort((a, b) => b[1].n - a[1].n).map(([k, v]) => ({ label: esc(k), v: v.n / tot, sub: `${v.n} · kept ${pct(v.kept)}` })); };
  const press = (act || {}).pressing || {};
  let html = '<div class="grid g3">';
  if (act) {
    html += `<div><div class="lbl" style="margin-bottom:4px">Pass direction</div>${hbars(dist(act.pass_direction, ['forward', 'lateral', 'back']), { max: 1, fmtv: v => pct(v) })}
      <div class="lbl" style="margin:12px 0 4px">Power (button hold)</div>${hbars(dist(act.pass_power), { max: 1, fmtv: v => pct(v) })}
      <div class="lbl" style="margin:12px 0 4px">Height</div>${hbars(dist(act.pass_height), { max: 1, fmtv: v => pct(v) })}
      <p class="note">Forward share ${pct(act.forward_share)} · aim matched ball travel ${pct(act.aim_vs_actual)}.</p></div>`;
    const acts = (act.actions || []).filter(a => isNum(a.x));
    const dots = acts.map(a => `<circle cx="${a.x}" cy="${a.y}" r="${a.kind === 'shot' ? 1.3 : .9}" fill="${a.kind === 'shot' ? '#ffd23d' : a.kept ? '#3ee08f' : '#ff5468'}" fill-opacity=".85" stroke="#06101f" stroke-width=".15"><title>${esc(a.kind)} · ${esc(a.power || '')} ${esc(a.height || '')} · ${esc(a.direction || '')} · ${a.kept ? 'kept' : 'lost'}${isNum(a.travel_m) ? ' · ' + fmt(a.travel_m, 0) + ' m' : ''}</title></circle>`).join('');
    html += `<div><div class="lbl" style="margin-bottom:6px">Action map (${acts.length})</div><div class="pitchwrap">${pitchSVG(dots)}</div>
      <div class="legend"><span><i class="dot" style="background:#3ee08f"></i>kept</span><span><i class="dot" style="background:#ff5468"></i>lost</span><span><i class="dot" style="background:#ffd23d"></i>shot</span></div>
      <div class="lbl" style="margin:12px 0 4px">By kind</div>${hbars(Object.entries(act.by_kind || {}).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => ({ label: esc(k), v: v.n, sub: `kept ${pct(v.kept)}` })))}</div>`;
    html += `<div><div class="lbl" style="margin-bottom:4px">Pressing episodes</div><div class="stats">${statBox(press.episodes, 'Episodes')}${statBox(isNum(press.won_share) ? press.won_share * 100 : null, 'Won', { suf: '%', cls: press.won_share >= .3 ? 'g' : 'b' })}
      ${statBox(isNum(press.engaged_share) ? press.engaged_share * 100 : null, 'Engaged', { suf: '%' })}${statBox(press.avg_closing_speed, 'Closing m/s', { d: 1 })}</div>
      ${press.sprint_heavy ? meter(`Sprint-heavy presses (${press.sprint_heavy.n}) won`, press.sprint_heavy.won_share) : ''}${press.jockey_used ? meter(`Presses with jockey (${press.jockey_used.n}) won`, press.jockey_used.won_share) : ''}
      ${meter('Presses in own half', press.own_half_share)}
      ${act.shots ? `<p class="note">${act.shots.n} shots, ${act.shots.inside_box} inside the box, avg ${fmt(act.shots.avg_dist_m, 0)} m out, B held ${fmt(act.shots.power_s, 2)} s.</p>` : ''}</div>`;
  }
  html += '</div>';
  if (ctl) {
    const tk = Object.entries(ctl.tackles || {});
    const ppm = Object.entries(ctl.presses_per_min || {}).slice(0, 8);
    html += `<hr class="sep"><div class="grid g3"><div><div class="lbl" style="margin-bottom:4px">Defending inputs</div>${meter('Sprint (RT) held', ctl.sprint_frac_defence, { target: TARGETS.sprint_def, tip: 'Coach target ≤35% of defending time' })}${meter('Jockey (LT) held', ctl.lt_frac_defence, { target: TARGETS.lt_def, tip: 'Target ≥15%' })}${meter('Sprint without jockey', ctl.sprint_no_jockey_frac_defence, { target: TARGETS.sprint_nojockey, tip: 'Target ≤25% - sprint-chasing gets you beaten' })}</div>
      <div><div class="lbl" style="margin-bottom:4px">Tackles</div>${hbars(tk.map(([k, v]) => ({ label: esc(k), v: v.n, sub: `won ${pct(v.won_rate)}` })))}
        ${ctl.skill_moves ? `<p class="note">${ctl.skill_moves.n} skill moves, ball kept ${pct(ctl.skill_moves.kept_rate)} · ${fmt(ctl.rs_switches_def)} RS switches defending · ${fmt(ctl.spam_bursts)} mash bursts.</p>` : ''}</div>
      <div><div class="lbl" style="margin-bottom:4px">Buttons per real minute</div>${hbars(ppm.map(([b, v]) => ({ label: `<span class="kbd">${esc(b)}</span>`, v })), { d: 1 })}</div></div>`;
  }
  return html;
}
function mDuo(m) {
  const H = m.humans || {}, a = H.p1 || {}, b = H.p2 || {}, co = m.coop || {}, k = m.kpis || {};
  const heatPair = (mk, h, name) => `<div><div class="row" style="margin-bottom:6px">${whoChip(mk)}</div><div class="grid g2" style="gap:10px">
    <div><div class="pitchwrap">${pitchSVG(heatCells(h.heat_us, `var(--${mk})`), { noArrow: true })}</div><div class="small muted">We have the ball</div></div>
    <div><div class="pitchwrap">${pitchSVG(heatCells(h.heat_them, `var(--${mk})`), { noArrow: true })}</div><div class="small muted">They have the ball</div></div></div></div>`;
  const cmp = (l, f, d = 1, u = '', tip = '') => { const A = f(a), B = f(b), mx = Math.max(A || 0, B || 0) || 1; return `<div class="cmp" ${tip ? `data-tip="${esc(tip)}"` : ''}><span class="a">${fmt(A, d)}${u}</span><div><div class="t">${l}</div><div class="bars"><span><i class="fill" style="width:${(A || 0) / mx * 100}%;transform-origin:right"></i></span><span><i class="fill" style="width:${(B || 0) / mx * 100}%"></i></span></div></div><span class="b">${fmt(B, d)}${u}</span></div>`; };
  const p1 = ctlFor(m, 'p1'), p2 = ctlFor(m, 'p2');
  return `<div class="stack">
    ${tile('Where you play', `<div class="grid g2">${heatPair('p1', a)}${heatPair('p2', b)}</div><p class="note">Positions of the player each of you controls. Attacking left to right.</p>`)}
    <div class="grid g2">
      ${tile('Side by side', cmp('Switches / real min', h => h.switches_per_min) + cmp('Distance to ball, our ball', h => h.d_ball_us, 1, ' m', 'Close = involved in build-up') + cmp('Distance to ball, their ball', h => h.d_ball_them, 1, ' m', 'Close = engaging') + cmp('Avg position from own goal', h => h.avg_x, 0, ' m'))}
      ${tile('Playing together', meter('Same zone when defending (<10 m)', co.def_too_close_together_frac, { target: TARGETS.def_close }) + meter('Both pressing the carrier', co.def_double_press_frac, { target: TARGETS.double_press, max: .4 })
        + meter('Neither near the ball (defending)', co.def_nobody_close_frac, { target: TARGETS.nobody_close }) + meter('Crowding in attack (<8 m)', co.att_too_close_together_frac, { target: TARGETS.att_close })
        + lossReactionRow(k) + meter('Median distance apart', co.dist_between_median, { max: 40, target: TARGETS.dist_apart, fmtv: v => fmt(v, 1) + ' m' }))}
    </div>
    ${tile(`Controller habits · ${esc(P1())}`, actionsBlock(p1 && p1.act, p1 && p1.ctl, P1()), {})}
    ${tile(`Controller habits · ${esc(P2())}`, actionsBlock(p2 && p2.act, p2 && p2.ctl, P2()), {})}
  </div>`;
}
