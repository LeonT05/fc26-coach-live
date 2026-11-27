/* Hub (home) */
'use strict';

function seasonTotals(ms) {
  const T = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, xgf: 0, xga: 0, xgn: 0, poss: [], shf: 0, sha: 0, shn: 0 };
  ms.forEach(m => {
    const r = resultOf(m), s = m.score_us_them || [];
    if (r === 'W' || r === 'D' || r === 'L') T.p++;
    if (r === 'W') T.w++; else if (r === 'D') T.d++; else if (r === 'L') T.l++;
    if (isNum(s[0]) && isNum(s[1])) { T.gf += s[0]; T.ga += s[1]; if (s[1] === 0) T.cs++; }
    const xg = xgOf(m); if (xg && isNum(xg[0])) { T.xgf += xg[0]; T.xga += xg[1] || 0; T.xgn++; }
    const po = ft(m, 'Possession %'); if (po && isNum(po[0])) T.poss.push(po[0]);
    const sh = ft(m, 'Shots'); if (sh && isNum(sh[0])) { T.shf += sh[0]; T.sha += sh[1]; T.shn++; }
  });
  if (!T.p) T.p = ms.length;
  T.pts = T.w * 3 + T.d;
  T.possAvg = avg(T.poss);
  return T;
}

function coachPlanTile() {
  const lc = latestWith(coachFor);
  if (!lc) return tile('Next match', '<p class="muted">No plan yet. It appears after the next session is processed.</p>', { cls: 'hero glow' });
  const c = lc.v, t = c.tactics || {};
  const steps = (c.next_match || []).map(x => typeof x === 'string' ? x : (x.text || JSON.stringify(x)));
  const kv = [['Formation', t.formation], ['Build-up', t.build_up], ['Defence', t.defensive_approach], ['Line', t.line_height]].filter(x => x[1] != null);
  const first = steps.slice(0, 4), rest = steps.slice(4);
  const li = s => { const i = s.indexOf(':'); return i > 0 && i < 40 ? `<li><span><b>${esc(s.slice(0, i))}</b>${esc(s.slice(i))}</span></li>` : `<li><span>${esc(s)}</span></li>`; };
  return tile(`Next match plan <span class="sub">from ${esc(shortDate(lc.day))} report</span>`,
    `<div class="tset">${kv.map(([k, v]) => `<div class="kv"><div class="lbl">${k}</div><b>${esc(v)}</b></div>`).join('')}</div>
     <ol class="plan">${first.map(li).join('')}</ol>
     ${rest.length ? `<div class="xi"><div class="xh"><span class="tx lnk">+ ${rest.length} more steps</span>${ICON.car}</div><div class="xb"><ol class="plan" start="${first.length + 1}" style="counter-reset:s ${first.length}">${rest.map(li).join('')}</ol></div></div>` : ''}`,
    { cls: 'hero glow', right: `<a href="#page=tactics">Board</a>` });
}

function lastMatchTile(ms) {
  const m = ms[ms.length - 1];
  if (!m) return tile('Last match', '<p class="muted">No matches yet.</p>');
  const s = m.score_us_them || ['–', '–'], home = m.our_side !== 'away';
  const us = `<span class="tm us">${esc(m.ours || 'COM')}</span>`, them = `<span class="tm">${esc(m.opp)}</span>`;
  const sc = home ? `${us}<span>${s[0]}</span><span class="dash">–</span><span>${s[1]}</span>${them}` : `${them}<span>${s[1]}</span><span class="dash">–</span><span>${s[0]}</span>${us}`;
  const xg = xgOf(m), po = ft(m, 'Possession %');
  return `<a class="tile hov" href="#page=match&id=${encodeURIComponent(m.id)}"><h2 class="h">Last result<span class="spacer"></span><span class="sub">${esc(shortDate(m.date))} · ${home ? 'Home' : 'Away'}</span></h2>
    <div class="row" style="justify-content:space-between"><div class="scoreline">${sc}</div>${resChip(resultOf(m), 1)}</div>
    <div class="stats" style="margin-top:16px">${statBox(xg && xg[0], 'xG for', { d: 1, cls: 'us' })}${statBox(xg && xg[1], 'xG against', { d: 1, cls: 'them' })}${statBox(po && po[0], 'Possession', { suf: '%' })}</div>
    <div class="row small muted" style="margin-top:12px">${m.potm ? `<span class="chip acc"><span>POTM · ${esc(m.potm)}</span></span>` : ''}<span>${esc(m.difficulty || '')}</span><span>${esc(m.weather || '')}</span><span class="spacer"></span><span class="lnk">Match Centre <i class="chev" aria-hidden="true"></i></span></div></a>`;
}

function seasonTile(ms) {
  const T = seasonTotals(ms);
  const strip = ms.slice(-10).map(m => `<a href="#page=match&id=${encodeURIComponent(m.id)}" data-tip="${esc(m.title)} · ${esc(shortDate(m.date))}">${resChip(resultOf(m))}<span>${esc(m.opp)}</span></a>`).join('');
  return tile(`Season ${esc(seasonLabel())}`,
    `<div class="row" style="gap:18px;align-items:flex-end;margin-bottom:14px">
      <div><div class="big" data-count="${T.pts}">${T.pts}</div><div class="lbl">Points</div></div>
      <div><div class="mid">${T.w}-${T.d}-${T.l}</div><div class="lbl">W-D-L</div></div>
      <div><div class="mid">${T.p ? fmt(T.pts / T.p, 2) : '–'}</div><div class="lbl">PPG</div></div></div>
     <div class="stats">${statBox(T.gf, 'Goals for', { cls: 'us' })}${statBox(T.ga, 'Goals against', { cls: 'them' })}
       ${statBox(T.xgn ? T.xgf : null, 'xG for', { d: 1, cls: 'us', tip: 'Official Match Facts xG where captured, else our radar model' })}${statBox(T.xgn ? T.xga : null, 'xG against', { d: 1, cls: 'them' })}
       ${statBox(T.possAvg, 'Avg possession', { suf: '%' })}${statBox(T.cs, 'Clean sheets', { cls: 'g' })}</div>
     <div class="lbl" style="margin:14px 0 8px">Form</div><div class="strip">${strip || '<span class="muted">–</span>'}</div>`,
    { right: `<a href="#page=matches">Fixtures</a>` });
}

function formChartTile(ms) {
  const items = ms.map(m => { const xg = xgOf(m) || [], s = m.score_us_them || []; return { a: xg[0], b: xg[1], ga: s[0], gb: s[1], label: m.title, short: m.opp, res: resultOf(m), href: '#page=match&id=' + encodeURIComponent(m.id) }; });
  const tr = (car() && car().team_trend) || [];
  const poss = lineChart({ labels: tr.map(t => (matchRef(t.match) || {}).opp || t.title), series: [{ name: 'Possession %', color: 'var(--acc2)', values: tr.map(t => t.possession), area: true }, { name: 'Pass accuracy %', color: '#b8e34a', values: tr.map(t => t.pass_acc), dash: true }], h: 120, min: 30, max: 100, grid: [50, 75], valueLabels: true, fmt: v => fmt(v, 0) });
  return tile('Season form', `${mirrorChart(items, { h: 200 })}<hr class="sep"><div class="lbl" style="margin-bottom:6px">Possession trend</div>${poss}`, { cls: 'span2', right: info('Bars: expected goals per match (official Match Facts when captured, otherwise our radar model). Rings: actual goals. Click a result to open the match.') });
}

function performersTile() {
  const ps = playerList().filter(p => p.apps > 0 && isNum(p.avg));
  const n = matchList().length, minApps = Math.max(1, Math.ceil(n * 0.3));
  const top = ps.filter(p => p.apps >= minApps).sort((a, b) => b.avg - a.avg).slice(0, 3);
  const scorer = playerList().filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const potm = playerList().filter(p => p.potm > 0).sort((a, b) => b.potm - a.potm)[0];
  const row = (p, right, sub) => `<a class="mini" href="${plink(p)}">${avatar(p)}<div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}</div><div class="sub">${sub}</div></div>${right}</a>`;
  return tile('Top performers',
    top.map((p, i) => row(p, `${formArrow(p.form, p.avg)}${rtPill(p.avg, 2)}`, `${posBadge(p.played[0] || p.pos)} <span style="margin-left:6px">${p.apps} apps · ${p.goals} G · ${p.assists} A</span>`)).join('') +
    `<hr class="sep"><div class="grid g2" style="gap:10px">
      ${scorer ? `<a class="stat us" href="${plink(scorer)}"><div class="v">${scorer.goals}<small>${esc(scorer.name)}</small></div><div class="l">Top scorer</div></a>` : ''}
      ${potm ? `<a class="stat g" href="${plink(potm)}"><div class="v">${potm.potm}<small>${esc(potm.name)}</small></div><div class="l">Most POTM</div></a>` : ''}</div>`,
    { right: `<a href="#page=squad">Squad</a>` });
}

function alertsTile() {
  const lc = latestWith(coachFor);
  if (!lc) return '';
  const items = [];
  (lc.v.sections || []).forEach(sec => (sec.items || []).forEach(it => items.push({ ...it, sec: sec.title })));
  items.sort((a, b) => (a.priority || 3) - (b.priority || 3));
  const show = items.filter(i => i.priority === 1).concat(items.filter(i => i.priority === 2)).slice(0, 4);
  return tile(`Fix now <span class="sub">${items.filter(i => i.priority === 1).length} urgent</span>`,
    `<div class="xl">${show.map(it => xItem(`${prioChip(it.priority)}${whoChip(it.who)}<span class="tx">${esc(it.text)}</span>`, it.evidence ? `<div class="ev">${evHtml(it.evidence)}</div>` : '')).join('')}</div>`,
    { right: `<a href="#page=coach">Report</a>` });
}

function ledgerTile() {
  const L = ledger();
  if (!L || !(L.season || []).length) return '';
  const fs = L.season.filter(f => f.flagged).sort((a, b) => (b.severity - a.severity) || (b.weight - a.weight)).slice(0, 5);
  return tile('Season findings',
    `<div class="xl">${fs.map(f => `<a class="mini" href="#page=findings&rule=${encodeURIComponent(f.rule)}">${sevDots(f.severity)}<div style="flex:1;min-width:0"><div class="nm" style="font-size:13px">${esc(f.title)}</div><div class="sub">${esc(ruleValue(f.rule, f.value))} · ${f.recurrence ? `flagged in ${f.recurrence[0]} of ${f.recurrence[1]} matches` : ''}</div></div>${trendChip(f.trend)}</a>`).join('') || '<p class="muted">Nothing flagged. </p>'}</div>`,
    { right: `<a href="#page=findings">All</a>` });
}

function duoPulseTile() {
  const lm = matchList().slice().reverse().map(m => matchData(m.id)).find(Boolean);
  if (!lm) return '';
  const co = lm.coop || {}, k = lm.kpis || {};
  return tile(`${esc(P1())} &amp; ${esc(P2())} pulse <span class="sub">last match</span>`,
    meter('Same zone when defending', co.def_too_close_together_frac, { target: TARGETS.def_close, tip: 'Both humans within 10 m of each other while defending. Coach target ≤15%.' }) +
    meter('Both pressing the carrier', co.def_double_press_frac, { target: TARGETS.double_press, max: .4, tip: 'Both within ~6 m of the ball. Target <5%.' }) +
    lossReactionRow(k) +
    meter('Crowding in attack', co.att_too_close_together_frac, { target: TARGETS.att_close, tip: 'Within 8 m of each other while attacking. Target ≤15%.' }),
    { right: `<a href="#page=duo">Profile</a>` });
}

const HUB_IC = {
  plan: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="5" width="18" height="23" rx="2"/><path d="M12 5v-1h8v1M11 13l3 3 6-6M11 21h10"/></svg>',
  board: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="24" height="20" rx="2"/><path d="M16 6v20M4 12h4v8H4M28 12h-4v8h4"/><circle cx="16" cy="16" r="3"/></svg>',
  match: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="11"/><path d="M16 10l5 4-2 6h-6l-2-6z"/></svg>',
  find: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="14" cy="14" r="8"/><path d="M20 20l7 7"/></svg>',
  duo: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="12" height="9" rx="4"/><rect x="17" y="11" width="12" height="9" rx="4"/><path d="M7 15h4M9 13v4"/></svg>',
};
function hubFixture(ms) {
  const m = ms[ms.length - 1];
  const Q = window.FC26_SQUAD, nf = Q && Q.club && Q.club.next_fixture;
  if (!m) return '<div class="tile empty">No matches yet.</div>';
  const s = m.score_us_them || ['–', '–'];
  const d = parseDate(m.date);
  const dayTxt = d ? `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${d.toLocaleDateString('en-GB', { month: 'short' })} ${String(d.getDate()).padStart(2, '0')}` : (m.date || '');
  const nfTxt = nf ? (typeof nf === 'string' ? nf : (nf.text || nf.opponent || '')) : '';
  const lc = latestWith(coachFor);
  return `<div class="dayhead">${esc(dayTxt)}</div>
    <div class="mday">${ms.length} matches tracked${(() => { const lp = Q && Q.club && Q.club.league_position; const n = lp && (lp.position ?? lp); return isNum(n) ? ` · ${esc(clubName())} ${ordinal(n)} in Serie A` : ''; })()}${nfTxt ? ` · next: ${esc(nfTxt)}` : ''}</div>
    <div class="row muted" style="gap:12px;margin-bottom:6px"><b style="color:#d6d9dc;font-size:18px">Serie A</b><span>Last result</span>${resChip(resultOf(m))}</div>
    <div class="fixture"><div class="badges">${badge(m.ours || 'COM', 1)}<span class="vl"></span>${badge(m.opp)}</div>
      <div class="lines"><div>${esc(clubName())} <span>${s[0]}</span></div><div>${esc(teamName(m.opp))} <span>${s[1]}</span></div></div></div>
    <a class="btn" href="#page=match&id=${encodeURIComponent(m.id)}" style="margin-bottom:22px">Match Centre</a>
    <nav class="menu">
      <a href="#page=coach" class="on">${HUB_IC.plan}Matchday Plan<span class="r">${esc(lc && lc.v.tactics ? lc.v.tactics.formation || '' : '')}</span></a>
      <a href="#page=tactics">${HUB_IC.board}Team Management<span class="r">Team Sheet &amp; roles</span></a>
      <a href="#page=match&id=${encodeURIComponent(m.id)}&tab=replay">${HUB_IC.match}Watch Last Match<span class="r">minimap replay</span></a>
      <a href="#page=findings">${HUB_IC.find}Findings<span class="r">${((ledger() || {}).season || []).filter(f => f.flagged).length} flagged</span></a>
      <a href="#page=duo">${HUB_IC.duo}Together<span class="r">duo habits</span></a>
    </nav>`;
}
function hubNews() {
  const lc = latestWith(coachFor);
  if (!lc) return tile('Assistant Coach', '<p class="muted">No coach report yet.</p>');
  const c = lc.v, t = c.tactics || {};
  const steps = (c.next_match || []).map(x => typeof x === 'string' ? x : (x.text || ''));
  const li = s => { const i = s.indexOf(':'); return i > 0 && i < 40 ? `<li><span><b>${esc(s.slice(0, i))}</b>${esc(s.slice(i))}</span></li>` : `<li><span>${esc(s)}</span></li>`; };
  return `<section class="tile plain newscard"><span class="tagn">New</span>
    <div class="row" style="gap:12px"><span class="mono">fc</span><div><b style="font-size:18px">FC Coach</b><div class="muted small">${esc(shortDate(lc.day))} report</div></div></div>
    <div class="heavy" style="margin:22px 0 0;font-size:18px;color:#c9cdd2">Next match plan</div>
    <div class="bigcode">${esc((t.formation || '').split(' ')[0] || 'PLAN')}</div>
    <div class="tset2">${[['Build-Up Style', t.build_up], ['Defensive Approach', t.defensive_approach], ['Line Height', t.line_height], ['Style', (t.formation || '').split(' ').slice(1).join(' ')]].filter(x => x[1] != null && x[1] !== '').map(([k, v]) => `<div class="srow"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <p class="ink2" style="margin:4px 0 10px;font-size:16px">${esc(c.headline || '')}</p>
    <div class="xi"><div class="xh"><span class="tx lnk">Show the ${steps.length}-step plan</span>${ICON.car}</div><div class="xb"><ol class="plan">${steps.map(li).join('')}</ol></div></div>
    <div class="row" style="margin-top:10px"><a class="lnk" href="#page=coach">Full report</a><span class="spacer"></span><a class="lnk" href="#page=tactics">Team Management</a></div></section>`;
}
function hubRecord(ms) {
  const rows = ms.slice(-4).reverse().map(m => `<tr data-href="#page=match&id=${encodeURIComponent(m.id)}" style="cursor:pointer"><td style="width:34px">${resChip(resultOf(m))}</td><td><span class="row" style="gap:10px;flex-wrap:nowrap">${badge(m.opp, 0, 'sm')}${esc(teamName(m.opp))}</span></td><td class="n">${(m.score_us_them || []).join('–')}</td></tr>`).join('');
  return `<section class="tile feat"><h2 class="h">Results</h2><div class="subt">Serie A ${esc(seasonLabel())}</div>
    <table class="standings"><thead><tr><th></th><th>Opponent</th><th style="text-align:right">Score</th></tr></thead><tbody>${rows}</tbody></table>
    <a class="lnk" href="#page=matches" style="display:inline-block;margin-top:12px">All fixtures</a></section>`;
}
function hubXgRing(ms) {
  const T = seasonTotals(ms);
  const tot = (T.xgf + T.xga) || 1, C = 2 * Math.PI * 92, a = T.xgf / tot * C;
  return `<section class="tile feat"><h2 class="h">Season Overview</h2><div class="subt">${T.w} W · ${T.d} D · ${T.l} L · ${T.pts} pts</div>
    <div class="donut"><svg viewBox="0 0 210 210"><circle cx="105" cy="105" r="92" fill="none" stroke="#ef4f43" stroke-width="5"/><circle cx="105" cy="105" r="92" fill="none" stroke="#30e57c" stroke-width="5" stroke-dasharray="${a} ${C}"/></svg>
      <div class="in"><b>TOTAL xG</b><div class="bn" data-count="${T.xgf + T.xga}" data-dec="1">${fmt(T.xgf + T.xga, 1)}</div><span>${T.p} matches</span></div></div>
    <div class="duet"><div><div class="lb g">xG For</div><div class="vb">${fmt(T.xgf, 1)}</div></div><div><div class="lb r">xG Against</div><div class="vb">${fmt(T.xga, 1)}</div></div></div>
    <div class="duet" style="margin-top:10px"><div><div class="lb g">Goals For</div><div class="vb">${T.gf}</div></div><div><div class="lb r">Goals Against</div><div class="vb">${T.ga}</div></div></div></section>`;
}
function hubForm(ms) {
  const items = ms.map(m => { const xg = xgOf(m) || [], s = m.score_us_them || []; return { a: xg[0], b: xg[1], ga: s[0], gb: s[1], label: m.title, short: m.opp, res: resultOf(m), href: '#page=match&id=' + encodeURIComponent(m.id) }; });
  const T = seasonTotals(ms);
  return `<section class="tile feat"><h2 class="h">Form Guide</h2><div class="subt">avg possession ${fmt(T.possAvg, 0)}% · ${T.cs} clean sheet${T.cs === 1 ? '' : 's'}</div>
    <div style="text-align:left">${mirrorChart(items, { h: 190 })}</div></section>`;
}
function hubPerformers() {
  const ps = playerList().filter(p => p.apps > 0 && isNum(p.avg));
  const n = matchList().length, minApps = Math.max(1, Math.ceil(n * 0.3));
  const top = ps.filter(p => p.apps >= minApps).sort((a, b) => b.avg - a.avg).slice(0, 4);
  return tile('Top Performers', `<div class="subs">${top.map(p => subTile(p, `<span class="rt ${rtCls(p.avg)}" style="min-width:0;font-size:20px">${fmt(p.avg, 1)}</span>`)).join('')}</div>`, { right: '<a href="#page=squad">Squad</a>' });
}
// Team-management style headshot tile (hub, tactics subs)
function subTile(p, right, energy) {
  const a = p.at || {}, dl = Math.max(0, ...ATTRS.map(([k]) => a[k + '_delta'] || 0));
  const face = portrait(p, 'M');
  const e = isNum(energy) ? energy : (isNum(a.sharpness) ? a.sharpness : null);
  return `<a class="sub1" href="${plink(p)}"><span class="pp">${posBadge(p.played[0] || p.pos)}</span><span class="fc">${face}</span>
    <span class="ov2">${right || `${dl ? `<i>+${dl}</i>` : ''}${fmt(p.ovr)}`}</span>
    <span class="eb">${isNum(e) ? `<span class="ebar" data-tip="Sharpness ${e}"><i class="fill" style="width:${e}%"></i></span>` : ''}</span><span class="nm">${esc(p.name)}</span></a>`;
}

REG.hub = {
  title: () => 'Hub',
  render() {
    const ms = matchList();
    return `<div class="grid g-hub" style="align-items:start">
        <div>${hubFixture(ms)}</div>
        <div>${hubNews()}</div>
      </div>
      <div class="carousel" style="margin-top:26px">${hubRecord(ms)}${hubXgRing(ms)}${hubForm(ms)}</div>
      <div class="grid g2" style="margin-top:18px">${hubPerformers()}${alertsTile()}</div>
      <div class="grid g2" style="margin-top:18px">${ledgerTile()}${duoPulseTile()}</div>`;
  },
};
