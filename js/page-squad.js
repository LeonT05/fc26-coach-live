/* Squad table / cards and Player profile */
'use strict';

function pcard(p, sm) {
  const a = p.at || {}, o = p.ovr;
  const tier = !isNum(o) ? 't0' : o >= 80 ? 't80' : o >= 75 ? 't75' : o >= 70 ? 't70' : 't0';
  const face = `<div class="face img">${portrait(p, 'L')}</div>`;  // one Portrait spec everywhere (L1 gate)
  return `<div class="pcard ${tier} ${sm ? 'sm' : ''}"><div class="ovr"><b>${isNum(o) ? o : '–'}</b><span>${esc((p.nat[0] || p.pos || '').replace(/2$/, '') || '–')}</span></div>${face}
    <div class="nm">${esc(p.name)}</div>
    <div class="attrs">${ATTRS.map(([k, l]) => `<span><b>${isNum(a[k]) ? a[k] : '–'}</b><i>${l}</i></span>`).join('')}</div></div>`;
}

function squadAvgAttrs(group) {
  const all = playerList().filter(p => isNum((p.at || {}).pace) || isNum((p.at || {}).diving));
  const ps = group ? all.filter(p => p.group === group) : all;
  const src = ps.length ? ps : all;
  const o = {};
  ATTRS.forEach(([k]) => { o[k] = avg(src, p => p.at[k]); });
  [['diving', 'DIV'], ['handling', 'HAN'], ['kicking', 'KIC'], ['reflexes', 'REF'], ['speed', 'SPD'], ['positioning', 'POS']].forEach(([k]) => { o[k] = avg(src, p => p.at[k]); });
  o.ovr = avg(src, p => p.ovr);
  return o;
}
function squadAvgPer10() {
  const ps = playerList().filter(p => (p.st.radar_minutes || 0) >= 3 && p.st.radar_per10);
  const o = {}; ['touches', 'passes', 'losses', 'regains'].forEach(k => { o[k] = avg(ps, p => p.st.radar_per10[k]); });
  return o;
}

const GRPS = [['all', 'All'], ['GK', 'GK'], ['DEF', 'Defenders'], ['MID', 'Midfield'], ['ATT', 'Attack']];
REG.squad = {
  title: () => 'Squad',
  render(S) {
    const grp = S.grp || 'all', view = S.view || 'table';
    const all = playerList();
    const ps = all.filter(p => grp === 'all' || p.group === grp);
    const filt = `<div class="seg">${GRPS.map(([k, l]) => `<a href="${sub({ grp: k === 'all' ? null : k })}" class="${grp === k ? 'on' : ''}">${l} <span class="muted">${k === 'all' ? all.length : all.filter(p => p.group === k).length}</span></a>`).join('')}</div>`;
    const vsel = `<div class="seg"><a href="${sub({ view: null })}" class="${view === 'table' ? 'on' : ''}">Table</a><a href="${sub({ view: 'cards' })}" class="${view === 'cards' ? 'on' : ''}">Cards</a></div>`;
    const ovrAvg = avg(all, p => p.ovr), ageAvg = avg(all, p => p.age);
    const head = `<div class="ptitle"><h1><small>${esc(clubName())} · First team</small>Squad</h1><span class="spacer"></span></div>
      <p class="subline">${all.length} players · avg OVR ${fmt(ovrAvg, 1)} · avg age ${fmt(ageAvg, 1)} · ${fmt(sum(all, p => p.goals))} goals</p>
      <div class="filters">${filt}<span class="spacer"></span>${vsel}</div>`;
    if (view === 'cards') {
      const sorted = ps.slice().sort((a, b) => (GROUP_ORDER[a.group] - GROUP_ORDER[b.group]) || ((b.ovr || 0) - (a.ovr || 0)));
      return head + `<div class="cards">${sorted.map(p => `<a href="${plink(p)}">${pcard(p, true)}<div class="cap">${formArrow(p.form, p.avg)}${isNum(p.avg) ? rtPill(p.avg) : ''}<span>${p.apps} apps · ${p.goals} G</span></div></a>`).join('')}</div>`;
    }
    const cols = [['Pos', 'str'], ['Player', 'str'], ['Age'], ['OVR'], ['Apps'], ['Min'], ['G'], ['A'], ['POTM'], ['Avg Rt'], ['Form', null], ['', null],
      ...ATTRS.map(([, l]) => [l]), ['Radar Rt'], ['Morale', 'str'], ['Sharp']];
    const body = ps.map(p => {
      const a = p.at;
      return `<tr class="click" data-href="${plink(p)}">
        <td data-v="${GROUP_ORDER[p.group]}${esc(p.pos)}">${posBadge(p.pos)}</td>
        <td class="stick" data-v="${esc(p.name)}"><div class="pl">${avatar(p)}<div><b>${esc(p.name)}</b><small>${esc([(p.nat.length ? p.nat.join(' ') : p.played.join(' ')), cleanRole(a.role)].filter(Boolean).join(' · '))}</small></div></div></td>
        <td class="n">${fmt(p.age)}</td><td class="n" data-v="${p.ovr ?? ''}"><b class="${atCls(p.ovr)}">${fmt(p.ovr)}</b></td>
        <td class="n">${p.apps}</td><td class="n" data-v="${p.minutes}">${p.minutes || '–'}</td><td class="n">${p.goals || '–'}</td><td class="n">${p.assists || '–'}</td><td class="n">${p.potm || '–'}</td>
        <td class="c" data-v="${p.avg ?? ''}">${rtPill(p.avg, 2)}</td><td>${formStrip(p.form)}</td><td>${formArrow(p.form, p.avg)}</td>
        ${ATTRS.map(([k]) => `<td class="n" data-v="${a[k] ?? ''}"><span class="${atCls(a[k])}">${fmt(a[k])}</span>${isNum(a[k + '_delta']) && a[k + '_delta'] ? `<span class="delta ${a[k + '_delta'] < 0 ? 'neg' : ''}">${a[k + '_delta'] > 0 ? '+' : ''}${a[k + '_delta']}</span>` : ''}</td>`).join('')}
        <td class="c" data-v="${p.ours ?? ''}" data-tip="Our radar-based rating (validated on few matches)">${isNum(p.ours) ? `<span class="muted" style="font-family:var(--fh);font-size:14px">${fmt(p.ours, 1)}</span>` : '–'}</td>
        <td data-v="${esc(a.morale || '')}">${moraleChip(a.morale)}</td><td class="n">${fmt(a.sharpness)}</td></tr>`;
    }).join('');
    return head + tile('', `<div class="tscroll"><table class="dt" id="sqtbl" data-sortable data-default="3:-1"><thead><tr>${cols.map(([l, t]) => `<th ${t !== null ? `data-sort="${t || 'num'}"` : ''} class="${t === 'str' || t === null ? '' : 'n'}">${l}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="note">OVR / attributes: latest Player Info screen (green +n = in-game boost). Avg Rt: official match ratings. Click a player for the full profile.</p>`, { cls: 'flat' });
  },
};
function cleanRole(r) { r = String(r || '').replace(/\.\.+$/, '').trim(); return r.length < 4 || /^[a-z]/.test(r) ? '' : r; }
function moraleChip(m) {
  if (!m) return '<span class="muted">–</span>';
  const c = /very happy|happy/i.test(m) ? 'var(--good)' : /content|okay/i.test(m) ? 'var(--acc2)' : /unhappy|very/i.test(m) ? 'var(--bad)' : 'var(--warn)';
  return `<span class="nowrap" style="color:${c};font:600 14px var(--fb)">${esc(m)}</span>`;
}

// ---- player profile ----
function samePlayer(a, b) {
  const fa = fold(a), fb = fold(b);
  if (!fa || !fb) return false;
  return fa === fb || (typeof FOLD_ALIAS === 'object' && FOLD_ALIAS[fa] === fb);
}
function playerMatches(p) {
  const out = [];
  matchList().forEach(ref => {
    const md = matchData(ref.id); if (!md) return;
    const pl = (md.players || []).find(x => x.id === p.id || samePlayer(x.name, p.name));
    const mt = md.metrics || {};
    const rt = (p.st.ratings || []).find(r => r.match === ref.id);
    const ours = (mt.ratings || []).find(r => samePlayer(r.name, p.name));
    if (!pl && !rt) return;
    out.push({ ref, md, pl, rt, ours, xt: ((mt.xt || {}).by_player || {})[p.name], prog: ((mt.progressive || {}).by_player || {})[p.name], xg: (mt.xg_by_player || {})[p.name] });
  });
  return out;
}
function staffLines(p) {
  const out = [];
  const lc = latestWith(coachFor);
  if (lc) {
    const v = (lc.v.players || []).find(x => samePlayer(x.name, p.name));
    if (v) out.push({ who: 'Coach', verdict: v.verdict, text: v.reason });
    const r = ((lc.v.tactics || {}).roles || []).find(x => samePlayer(x.player, p.name));
    if (r) out.push({ who: 'Tactics', verdict: r.pos, text: `${r.role} · ${r.focus}` });
  }
  const ld = latestWith(directorFor);
  if (ld) {
    const d = ld.v, hit = x => x && samePlayer(x.name || x.player, p.name);
    const xi = ((d.best_xi || {}).slots || []).find(s => samePlayer(s.player, p.name));
    if (xi) out.push({ who: 'Director', verdict: 'Best XI ' + xi.pos, text: xi.reason || '' });
    else if ((d.bench || []).some(b => samePlayer(typeof b === 'string' ? b : b.name || b.player, p.name))) out.push({ who: 'Director', verdict: 'Bench', text: '' });
    [['promote', 'Promote', x => `${x.from ? x.from + ' to ' : ''}${x.to_role || ''}. ${x.reason || ''}`], ['develop', 'Develop', x => `${x.plan || ''} ${x.target_role ? '(' + x.target_role + ')' : ''} ${x.reason || ''}`],
      ['sell_or_loan', 'Sell / loan', x => `${x.action || ''}: ${x.reason || ''}`], ['contracts_morale', 'Morale', x => x.note || ''], ['watch_list', 'Watch', x => x.what_to_watch || '']]
      .forEach(([k, l, f]) => (d[k] || []).filter(hit).forEach(x => out.push({ who: 'Director', verdict: l, text: f(x) })));
  }
  return out;
}
function verdictCls(v) { const s = String(v || '').toLowerCase(); return /start|best|promote/.test(s) ? 'start' : /keep|bench|tactics|^[a-z]{1,4}$/.test(s) ? 'keep' : /develop|watch|test/.test(s) ? 'develop' : /elsewhere|move|morale/.test(s) ? 'move' : /sell|loan|drop|release/.test(s) ? 'drop' : 'keep'; }

function bioFacts(p) {
  const h = (p.st.history || []), last = {};
  h.forEach(e => Object.entries(e).forEach(([k, v]) => { if (v != null && v !== '') last[k] = v; }));
  const a = p.at;
  return {
    height: a.height || last.height, weight: a.weight || last.weight, foot: a.foot || last.foot, accel: a.acceleration_type || last.acceleration_type,
    morale: a.morale || last.morale, sharpness: a.sharpness ?? last.sharpness, energy: a.energy ?? last.energy,
    positions: uniq([...(p.nat || []), ...((last.positions) || [])]),
  };
}

REG.player = {
  tabParam: 'ptab',
  title: S => { const p = playerById(S.id); return p ? p.name : 'Player'; },
  need: () => ensureAllDays(), ready: () => allDaysLoaded(),
  render(S) {
    const p = playerById(S.id);
    if (!p) return `<a class="crumb" href="#page=squad">${ICON.back} Squad</a><div class="tile"><p class="muted">Player not found.</p></div>`;
    const st = p.st, a = p.at, bio = bioFacts(p), pm = playerMatches(p);
    const list = playerList();
    const idx = list.slice().sort((x, y) => (GROUP_ORDER[x.group] - GROUP_ORDER[y.group]) || ((y.ovr || 0) - (x.ovr || 0)));
    const k = idx.findIndex(x => x.id === p.id), prev = idx[(k - 1 + idx.length) % idx.length], next = idx[(k + 1) % idx.length];

    // header: FC-style Player Info panel + season panel
    // QA SQ-20: no raw data tags ([official] …) and no doubled role text in the verdict rows
    const clean = t => String(t || '').replace(/\[[a-z]+(?:\s+\d\d\/\d\d)?\]\s*/gi, '').replace(/;\s*/g, ' · ').replace(/^(.{6,60}?) \((?:[A-Z]{2,4} )?[^)]*\)/, '$1').trim();
    const dIdx = (typeof deskDecisions === 'function' ? deskDecisions() : []).findIndex(e => e.name && fold(e.name) === fold(p.name));
    const staff = staffLines(p).map(x => Object.assign({}, x, { text: clean(x.text), verdict: clean(x.verdict) })).filter(x => x.who === 'Director').slice(0, 1).map(x => Object.assign(x, { href: dIdx >= 0 ? '#page=scouting&d=' + dIdx : '#page=scouting' }));
    const lc0 = latestWith(coachFor), roleRow = lc0 && ((lc0.v.tactics || {}).roles || []).find(x => fold(x.player) === fold(p.name));
    const pinfo = pinfoPanel(p, roleRow);
    // grid brief G4 (Figma 287:28294): the tabs sit on the standard Sub-tab Bar (y 140, Decision 3); the breadcrumb is the band
    // meta (not focusable: B returns to the opener row); previous / next player = right stick (mouse: the two buttons)
    const pfRight = `<a class="btn sq pf-pn" href="${plink(prev)}" tabindex="-1" data-tip="${esc(prev.name)}" aria-label="Previous player">${ICON.left}</a><a class="btn sq pf-pn" href="${plink(next)}" tabindex="-1" data-tip="${esc(next.name)}" aria-label="Next player">${ICON.right}</a>`;
    const head = `<div class="pf-g4" data-grid="g4">
        ${pinfoHead(p, `${staff.length ? `<div class="xl">${staff.map(s => xItem(`<span class="lbl" style="width:66px">${esc(s.who)}</span><span class="verdict ${verdictCls(s.verdict)}">${esc(s.verdict)}</span><span class="tx ink2">${esc(s.text)}</span>`, s.text ? `<div class="ev">${evHtml(s.text)}</div>` : '')).join('')}</div>` : ''}`) || pinfo.replace(/<div class="sect">Player Info<\/div>[\s\S]*$/, '</section>')}
        <section class="tile pf-season">
          <h2 class="h">Season ${esc(seasonLabel())}</h2>${pf3Season(p)}
        </section>`;

    // attributes + compare
    const vsId = S.vs || 'avg', sqa = squadAvgAttrs(p.group);
    const vp = vsId === 'avg' ? null : playerById(vsId);
    const B = vp ? vp.at : sqa, bName = vp ? vp.name : 'Squad avg';
    const hasAttr = ATTRS.some(([k2]) => isNum(a[k2]));
    const cmpSel = `<select class="sel" data-param="vs"><option value="avg">vs Squad average</option>${list.filter(x => x.id !== p.id && isNum(x.at.pace)).map(x => `<option value="${esc(x.id)}" ${vsId === x.id ? 'selected' : ''}>vs ${esc(x.name)}</option>`).join('')}</select>`;
    const attrRows = ATTRS.map(([k2, l]) => {
      const v = a[k2], b = B[k2], dl = a[k2 + '_delta'];
      return `<div class="meter"><span class="ml"><b style="font:700 13px var(--fh);letter-spacing:.1em;width:34px">${l}</b><span class="muted small">${esc(bName)} ${fmt(b)}</span></span>
        <span class="mv"><span class="${atCls(v)}">${fmt(v)}</span>${isNum(dl) && dl ? `<span class="delta ${dl < 0 ? 'neg' : ''}">${dl > 0 ? '+' : ''}${dl}</span>` : ''}
        ${isNum(v) && isNum(b) ? `<span class="small ${v - b >= 0 ? 'good' : 'bad'}" style="margin-left:6px">${v - b >= 0 ? '+' : ''}${fmt(v - b)}</span>` : ''}</span>
        <div class="track">${isNum(b) ? `<span class="mark" style="left:${b}%;background:#fff;opacity:.7"></span>` : ''}<i class="fill" style="width:${isNum(v) ? v : 0}%;background:${rtColor(5 + (v || 0) / 30)}"></i></div></div>`;
    }).join('');
    const attrTile = tile('Attributes', hasAttr ? `<div class="grid g2" style="align-items:center">
        <div>${spider(ATTRS.map(([, l]) => ({ label: l })), [{ name: p.name, color: '#4d8dff', values: ATTRS.map(([k2]) => a[k2]) }, { name: bName, color: '#ffab3d', values: ATTRS.map(([k2]) => B[k2]), dash: true }], { showVal: true })}
          <div class="legend" style="justify-content:center"><span><i class="sw" style="background:#4d8dff"></i>${esc(p.name)}</span><span><i class="sw" style="background:#ffab3d"></i>${esc(bName)}</span></div></div>
        <div>${attrRows}</div></div>` : '<p class="muted">No Player Info screen captured yet - open his Player Info in-game.</p>', { right: hasAttr ? cmpSel : '' });

    // rating timeline
    const rts = st.ratings || [];
    const labels = rts.map(r => (matchRef(r.match) || {}).opp || r.title);
    const oursBy = {}; pm.forEach(x => { if (x.ours) oursBy[x.ref.id] = x.ours.score; });
    const rtTile = tile('Rating timeline', rts.length ? lineChart({ labels, h: 170, min: 5, max: 10, grid: [6, 7, 8, 9], valueLabels: true, fmt: v => fmt(v, 1), band: [7, 10],
      series: [{ name: 'Official rating', color: '#4d8dff', values: rts.map(r => r.rating), area: true }].concat((gateAll('metrics.our_ratings') || {}).blocked ? [] : [{ name: 'Radar rating', color: '#ffab3d', values: rts.map(r => oursBy[r.match]), dash: true }]) })
      + `<div class="row" style="margin-top:10px"><span class="lbl">Last 5</span>${formStrip(p.form)}${formArrow(p.form, p.avg)}</div>` : '<p class="muted">No rated matches yet.</p>');

    // match log
    const DET = [['Goals', 'G'], ['Assists', 'A'], ['Shots', 'Sh'], ['Passes', 'Pas'], ['Pass Accuracy', 'Pas%'], ['Dribbles', 'Dri'], ['Dribble Success Rate', 'Dri%'], ['Tackles', 'Tkl'], ['Tackle Success Rate', 'Tkl%'], ['Possession Won', 'Won'], ['Possession Lost', 'Lost'], ['Distance Covered', 'Dist km'], ['Distance Sprinted', 'Spr km'], ['Minutes Played', 'Min']];
    const RADAR_OK = !(gateAll('players[].counts') || {}).blocked && !(gateAll('metrics.xg_model') || {}).blocked;   // QA SQ-21: blocked per-player radar metrics are hidden
    const logRows = pm.map(x => {
      const det = (x.rt && x.rt.detail) || {};
      return `<tr class="click" data-href="#page=match&id=${encodeURIComponent(x.ref.id)}">
        <td data-v="${x.ref._k}">${resChip(resultOf(x.ref))} <span style="margin-left:6px">${esc(x.ref.title)}</span></td><td>${posBadge((x.rt && x.rt.pos) || (x.pl && x.pl.label))}</td>
        <td class="c" data-v="${x.rt ? x.rt.rating : ''}">${rtPill(x.rt && x.rt.rating)}</td>
        ${DET.map(([kk]) => { const v = det[kk]; const pv = Array.isArray(v) ? v[0] : null; return `<td class="n" data-v="${pv ?? ''}" ${Array.isArray(v) ? `data-tip="${esc(kk)}: ${fmt(v[0], v[0] % 1 ? 1 : 0)} (team ${fmt(v[1], v[1] % 1 ? 1 : 0)})"` : ''}>${isNum(pv) ? fmt(pv, pv % 1 ? 1 : 0) : '<span class="muted">–</span>'}</td>`; }).join('')}
        ${RADAR_OK ? `<td class="n">${x.xt ? fmt(x.xt.total, 2) : '–'}</td><td class="n">${x.prog ? (x.prog.passes || 0) + (x.prog.carries || 0) : '–'}</td><td class="n">${isNum(x.xg) ? fmt(x.xg, 2) : '–'}</td>` : ''}</tr>`;
    }).join('');
    const logTile = tile('Match log', pm.length ? `<div class="tscroll"><table class="dt" id="plog" data-sortable><thead><tr><th data-sort="num">Match</th><th>Pos</th><th data-sort class="c">Rt</th>
      ${DET.map(([kk, l]) => `<th data-sort class="n" data-tip="${esc(kk)}">${l}</th>`).join('')}${RADAR_OK ? `<th data-sort class="n" data-tip="Expected threat added (radar)">xT</th><th data-sort class="n" data-tip="Progressive passes + carries (radar)">Prog</th><th data-sort class="n" data-tip="xG from our shot model">xG</th>` : ''}</tr></thead><tbody>${logRows}</tbody></table></div>
      <p class="note">Official Player Performance detail where captured. Hover a value for the team figure.</p>` : '<p class="muted">No matches yet.</p>', { cls: 'flat' });

    // per-10 radar & control
    const gCounts = gateAll('players[].counts') || {}, gCoop = gateAll('ledger:duo_same_zone') || {};
    const per = st.radar_per10 || {}, spa = squadAvgPer10();
    const perItems = [['touches', 'Touches'], ['passes', 'Passes'], ['regains', 'Ball won'], ['losses', 'Ball lost']].map(([kk, l]) => ({ k: kk, l, v: per[kk], b: spa[kk] }));
    const mx = Math.max(1, ...perItems.flatMap(x => [x.v, x.b]).filter(isNum));
    const perTile = gCounts.blocked ? '' : tile(`Per 10 radar minutes ${info(`From ${fmt(st.radar_minutes, 1)} tracked real minutes. White tick = squad average.`)}`,
      Object.keys(per).length ? perItems.map(x => `<div class="meter ${x.k === 'losses' ? (x.v > x.b ? 'isbad' : 'isok') : (x.v >= x.b ? 'isok' : '')}"><span class="ml">${x.l}</span><span class="mv">${fmt(x.v, 1)} <span class="muted small">avg ${fmt(x.b, 1)}</span></span>
        <div class="track"><span class="mark" style="left:${(x.b || 0) / mx * 100}%;background:#fff"></span><i class="fill" style="width:${(x.v || 0) / mx * 100}%"></i></div></div>`).join('')
      + (() => { const xt = sum(pm, x => x.xt && x.xt.total), pr = sum(pm, x => x.prog && ((x.prog.passes || 0) + (x.prog.carries || 0))), xg = sum(pm, x => x.xg); return `<div class="stats" style="margin-top:12px">${statBox(xt, 'xT added', { d: 2 })}${statBox(pr, 'Progressive')}${statBox(xg, 'xG', { d: 2 })}</div>`; })()
      : '<p class="muted">Not tracked on radar yet.</p>');

    const mins = pm.filter(x => x.pl), cw = x => x.pl.minutes || 0;
    const c1 = wavg(mins, x => x.pl.ctrl_p1, cw), c2 = wavg(mins, x => x.pl.ctrl_p2, cw);
    const ctlTile = gCoop.blocked ? '' : tile('Who controls him', isNum(c1) ? `<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="mid" style="color:var(--p1)">${pct(c1)}</span><span class="lbl">AI ${pct(1 - c1 - (c2 || 0))}</span><span class="mid" style="color:var(--p2)">${pct(c2)}</span></div>
      <div class="split" style="height:12px"><i class="p1 fill" style="flex:${c1}"></i><i class="ai" style="flex:${Math.max(0, 1 - c1 - (c2 || 0))}"></i><i class="p2" style="flex:${c2 || 0}"></i></div>
      <div class="row small" style="justify-content:space-between;margin-top:8px"><span><i class="dot p1"></i> ${esc(P1())}</span><span>${esc(P2())} <i class="dot p2"></i></span></div>
      <p class="note">Share of his tracked minutes under each human's marker (minute-weighted over ${mins.length} match${mins.length === 1 ? '' : 'es'}).</p>` : '<p class="muted">No radar control data.</p>');

    // heatmap
    const hm = S.m && mins.find(x => x.ref.id === S.m);
    let heat = null; (hm ? [hm] : mins).forEach(x => { heat = addHeat(heat, x.pl.heat, hm ? 1 : (x.pl.minutes || 1)); });
    const avgPos = hm ? [hm.pl.avg_x, hm.pl.avg_y] : [wavg(mins, x => x.pl.avg_x, cw), wavg(mins, x => x.pl.avg_y, cw)];
    const heatTile = gCounts.blocked ? '' : tile('Heatmap', mins.length ? `<div class="seg" style="margin-bottom:10px"><a href="${sub({ m: null })}" class="${!hm ? 'on' : ''}">Season</a>${mins.map(x => `<a href="${sub({ m: x.ref.id })}" class="${hm === x ? 'on' : ''}">${esc(x.ref.opp)}</a>`).join('')}</div>
      <div class="pitchwrap">${pitchSVG(heatCells(heat, '#3e8cff') + (isNum(avgPos[0]) ? `<circle cx="${avgPos[0]}" cy="${avgPos[1]}" r="1.5" fill="#0B0D12" stroke="#fff" stroke-width=".45" data-tip="Average position"></circle>` : ''))}</div>` : '<p class="muted">No radar track yet.</p>');

    // dressing room & condition
    const chats = st.chats || [];
    const hist = (st.history || []).filter(h => isNum(h.sharpness));
    const dd = []; hist.forEach(h => { const l = dd[dd.length - 1]; if (!l || l.sharpness !== h.sharpness || l.morale !== h.morale) dd.push(h); });
    const roomTile = tile('Dressing room', (chats.length ? chats.map(c => `<div class="mini"><span class="chip"><span>${esc(c.date || '')}</span></span><div style="flex:1;font-size:13px;color:var(--ink2)">&ldquo;${esc(c.text)}&rdquo;</div></div>`).join('') : '<p class="muted small">No player chats captured.</p>')
      + (dd.length > 1 ? `<hr class="sep"><div class="lbl" style="margin-bottom:4px">Sharpness &amp; morale trend</div>${lineChart({ labels: dd.map((h, i) => String(i + 1)), series: [{ name: 'Sharpness', color: '#3ee08f', values: dd.map(h => h.sharpness), area: true }], h: 100, min: 50, max: 100, legend: false, valueLabels: true })}
        <div class="row small" style="gap:4px">${dd.map(h => moraleChip(h.morale)).join('<i class="chev" aria-hidden="true"></i>')}</div>` : ''));

    // QA profile r2: no page scroll. Header row (cutout card + season card), then ONE tabbed panel whose body scrolls inside.
    const ins = typeof insightStats === 'function' ? insightStats(p, true) : null;
    const miss = [gCounts.blocked ? ['Per-player radar numbers, heatmap', gCounts.why] : null, gCoop.blocked ? ['Who controls him (Leon / Peti / AI)', gCoop.why] : null, (gateAll('metrics.our_ratings') || {}).blocked ? ['Our radar rating', (gateAll('metrics.our_ratings') || {}).why] : null].filter(Boolean);
    const missNote = miss.length ? `<p class="gate-note" style="margin-top:12px"><b>Not measurable yet:</b> ${miss.map(([l, w]) => `${esc(l)} (${esc(w)})`).join(' · ')}</p>` : '';
    const inner = h => h.replace(/^\s*<section class="tile[^"]*">\s*<h2 class="h">[\s\S]*?<\/h2>/, '').replace(/<\/section>\s*$/, '');
    const TABS = [
      ins && ['stats', 'Stats', `${pf3Stats(p)}${window.STRK ? STRK.playerBlock(p) : ''}${pf3Stamp()}`],
      ins && ['minimap', 'Minimap', `<div class="pf-cols">${ins.minimap}</div>${missNote}`],
      ins && ins.gk && ['gk', 'Goalkeeper', `<div class="pf-cols">${ins.gk}</div>`],
      ['attributes', 'Attributes', inner(attrTile)],
      ['ratings', 'Ratings', inner(rtTile)],
      ['matches', 'Matches', inner(logTile)],
      (perTile || heatTile || ctlTile) && ['radar', 'Radar', `<div class="grid g3">${perTile}${heatTile}${ctlTile}</div>`],
    ].filter(Boolean);
    REG.player.tabs = () => TABS.map(t => t[0]);
    const pt = TABS.some(t => t[0] === S.ptab) ? S.ptab : TABS[0][0];
    const bar = GRID.stb(TABS.map(([k, l]) => ({ label: l, href: sub({ ptab: k === TABS[0][0] ? null : k }), on: pt === k })), { label: 'Profile tabs', meta: `Squad › ${esc(p.name)}`, right: pfRight });
    return `${bar}${head.replace('class="tile pinfo', 'class="tile pinfo pf-id')}
      <section class="pf-panel"><div class="pf-body">${(TABS.find(t => t[0] === pt) || TABS[0])[2]}${pt !== 'minimap' && !ins ? missNote : ''}</div></section></div>`;
  },
};

// FC-style "Player Info" panel (player profile header, Team Management side panel)
function pinfoHead(p, extra) {   // F-4: the header card: cutout, name, OVR, positions, age, the Director verdict (linked to the Desk)
  const ds = typeof deskDecisions === 'function' ? deskDecisions() : [], i = ds.findIndex(e => e.name && fold(e.name) === fold(p.name)), v = i >= 0 ? ds[i] : null;
  const pos = (p.natural || p.played || [p.pos]).filter(Boolean).join(' · ');
  if (window.YX) {   // round 3 (P1 245:7669): first name thin caps, SURNAME heavy, the DEVELOP line (+ PROMISE line) under the header
    const ex = YX.ext(p.name), full = (ex && ex.display_name) || p.name, parts = String(full).split(' '), last = parts.length > 1 ? parts.slice(-1)[0] : full, first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    return `<section class="tile pinfo pf-head"><div class="phead"><div class="ph">${portrait(p, 'L')}</div><div style="flex:1;min-width:0"><div class="ovl">${fmt(p.ovr)}<span>| ${esc(pos || '–')}</span></div>${first ? `<div class="pfn">${esc(first.toUpperCase())}</div>` : ''}<div class="pnm">${esc(last)}</div></div></div>
      ${YX.dev(p.name) && (YX.dev(p.name).options || []).length ? YX.devLine(p.name) : pf3Develop(p)}${typeof YX.promiseLine === 'function' ? YX.promiseLine(p.name) : ''}</section>`;
  }
  return `<section class="tile pinfo"><div class="phead"><div class="ph">${portrait(p, 'L')}</div><div style="flex:1;min-width:0"><div class="ovl">${fmt(p.ovr)}<span>| ${esc(pos || '–')}</span></div><div class="pnm">${esc(p.name)}</div>
    <div class="small muted" style="margin-top:6px">${[isNum(p.age) ? 'Age ' + p.age : '', (p.at || {}).morale ? 'Morale ' + esc(p.at.morale) : ''].filter(Boolean).join(' · ')}</div></div></div>
    ${v ? `<a class="sq-verdict" href="#page=scouting&d=${i}"><b>${esc(v.tag)}</b><span>${esc(v.label)}</span><i class="chev" aria-hidden="true"></i></a>` : extra ? `<div class="pf-staff">${extra}</div>` : ''}</section>`;
}
function pinfoPanel(p, roleRow, extra) {
  const a = p.at || {}, bio = bioFacts(p);
  const kvv = (k, v, cls) => `<div class="kv2"><span class="k">${k}</span><span class="v ${cls || ''}">${v ?? '–'}</span></div>`;
  const av2 = k => { const v = a[k], d = a[k + '_delta']; return isNum(v) ? `<span style="color:${v >= 70 ? '#fff' : v >= 60 ? 'var(--orange)' : 'var(--bad)'}">${v}</span>${d ? `<span class="delta ${d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${d}</span>` : ''}` : '–'; };
  const posTxt = (bio.positions.length ? bio.positions : p.played).map(x => String(x).replace(/2$/, '')).join(' · ');
  return `<section class="tile plain pinfo">
      <div class="phead"><div class="ph">${portrait(p, 'L')}</div>
        <div style="flex:1;min-width:0"><div class="ovl">${fmt(p.ovr)}<span>| ${esc(posTxt || '–')}</span></div><div class="pnm">${esc(p.name)}</div></div>${extra || ''}</div>
      <div class="sect">Player Info</div>
      <div class="kvgrid"><div>
        ${kvv('Energy', isNum(bio.energy) ? `<i class="ico energy"></i> ${bio.energy}%` : null)}${kvv('Sharpness', isNum(bio.sharpness) ? `<i class="ico sharpness"></i> ${bio.sharpness}` : null)}
        ${kvv('Morale', bio.morale ? moraleChip(bio.morale) : null)}${kvv('Foot', esc(bio.foot || '–'))}${kvv('Acceleration', esc(bio.accel || '–'))}
        ${kvv('Role', esc(roleRow && roleRow.role ? roleRow.role : (cleanRole(a.role) || '–')))}${kvv('Focus', esc(roleRow && roleRow.focus ? roleRow.focus : '–'))}${kvv('Height', bio.height ? bio.height + ' cm' : null)}
      </div><div>
        ${kvv('Age', fmt(p.age))}${ATTRS.map(([k]) => kvv(k[0].toUpperCase() + k.slice(1), av2(k))).join('')}${kvv('Played', esc(p.played.join(' / ') || '–'))}
      </div></div></section>`;
}

// ---------- Player Profile round 7 (brief 2026-11-25_profile-cells; Figma P1 305:36120): label / value cells, no sublines (UX-10),
// one rating definition (EV-6: the counted official average, as the season card), muted "–" cells for what is not tracked ----------
const pf3dc = (l, v, o = {}) => `<${o.href ? `a href="${o.href}"` : 'div'} class="dcell${o.size ? ' ' + o.size : ''}${o.cls ? ' ' + o.cls : ''}"><span class="k">${esc(l)}</span><span class="v ${o.tone || ''}">${v == null || v === '' ? '–' : v}${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</span></${o.href ? 'a' : 'div'}>`;
const pf3Miss = (l, tag) => pf3dc(l, '–', { tone: 'muted', tag: tag || 'not captured', cls: 'miss' });
const pf3Band = r => !isNum(r) ? 'muted' : r >= 7 ? 'pos' : r >= 6 ? 'warn' : 'neg';
const pf3Pct = (x, hi = .5, lo = .3) => isNum(x) ? { t: `${Math.round(x * 100)}%`, tone: x >= hi ? 'pos' : x < lo ? 'neg' : 'warn' } : { t: null, tone: '' };
function pf3Counted(p) { return ((p.st || {}).ratings || []).filter(r => r.counted !== false && isNum(r.rating)); }
function pf3Season(p) {
  const mi = typeof minutesOf === 'function' ? minutesOf(p) : null, rs = pf3Counted(p);
  const n = rs.length || (p.form || []).length;
  const form = rs.slice(-3).map(r => pf3dc((matchRef(r.match) || {}).title || r.match, r.rating.toFixed(1), { tone: pf3Band(r.rating), tag: 'official', cls: 's3' })).join('');
  return `<div class="pf3-cells pf3-season">${pf3dc('Apps', p.apps, { size: 'l', href: sub({ ptab: 'matches' }) })}${pf3dc('Minutes', mi && isNum(mi.v) ? mi.v : null, { size: 'l', tag: mi && mi.est && isNum(mi.v) ? 'est.' : '' })}${pf3dc('Goals', p.goals, { size: 'l', tone: p.goals ? 'pos' : '' })}${pf3dc('Assists', p.assists, { size: 'l', tone: p.assists ? 'pos' : '' })}${pf3dc('POTM', p.potm, { size: 'l' })}${pf3dc('Avg rating', isNum(p.avg) ? p.avg.toFixed(1) : null, { size: 'l', tone: pf3Band(p.avg), tag: n ? `${n} rated` : '', href: sub({ ptab: 'ratings' }) })}</div>
    <div class="pf3-form"><h4 class="pf3-h">Form</h4><div class="pf3-cells">${form || pf3Miss('Last matches', 'no rated match yet')}</div></div>`;
}
const pf3Esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function pf3Develop(p) {
  const dv = typeof directorFor === 'function' ? latestWith(directorFor) : null, d = (((dv || {}).v || {}).develop || []).find(x => samePlayer(x.name, p.name));
  let cell = '';
  if (d) {
    const v = String(d.short || d.plan || '').replace(new RegExp(`\\s+for\\s+${pf3Esc(p.name)}(\\s+first)?$`, 'i'), '').trim();
    const alt = (String(d.plan || '').replace(/\s*\(.*\)\s*$/, '').split(/\s+or\s+/).slice(1)[0] || '').trim();
    cell = pf3dc('Develop', esc(v), { tone: 'gold', tag: ['Director', alt ? `or ${alt}` : ''].filter(Boolean).join(' · '), href: '#page=scouting&grp=develop', cls: 'dev' });
  }
  return `<div class="pf3-dev">${cell}${pf3Miss('Dev plan in game')}</div>`;
}
function pf3Stats(p) {
  const D = window.FC26_INSIGHTS, x = D && (D.players || []).find(q => q.pid === p.id || fold(q.name) === fold(p.name)), o = (x || {}).official || {};
  const rs = pf3Counted(p), n = rs.length || (p.form || []).length, sa = pf3Pct(o.shot_accuracy), pa = pf3Pct(o.pass_accuracy), ts = pf3Pct(o.tackle_success);
  const play = [
    pf3dc('Apps', o.apps ?? p.apps, { tag: 'lineup + substitutions', href: sub({ ptab: 'matches' }) }),
    pf3dc('Minutes', o.minutes ?? o.minutes_est, { tag: o.minutes_trust === 'est' ? 'est.' : '' }),
    isNum(o.minutes_official) ? pf3dc('Official minutes', o.minutes_official, { tag: `${o.minutes_official_matches || 0} of ${o.apps ?? '–'} matches read` }) : pf3Miss('Official minutes'),
    pf3dc('G + A per 90', isNum(o.ga_per90) ? o.ga_per90.toFixed(2) : null, { tone: isNum(o.ga_per90) && o.ga_per90 > 0 ? 'pos' : '', tag: o.ga_per90_minutes ? `${o.ga_per90_minutes} official min` : '' }),
    pf3dc('Goals', o.goals, { tone: o.goals ? 'pos' : '', tag: o.goals_matches ? `${o.goals_matches} matches read` : '' }),
    pf3dc('Assists', o.assists, { tone: o.assists ? 'pos' : '' })].join('');
  const perf = [
    isNum(o.shots) ? pf3dc('Shots', o.shots, { tag: o.detail_matches ? `${o.detail_matches} matches read` : '' }) : pf3Miss('Shots'),
    pf3dc('Shot accuracy', sa.t, { tone: sa.tone }), pf3dc('Pass accuracy', pa.t, { tone: pa.tone, tag: isNum(o.passes) ? `${o.passes} passes` : '' }),
    isNum(o.tackles) ? pf3dc('Tackles', o.tackles) : pf3Miss('Tackles'), pf3dc('Tackles won', ts.t, { tone: ts.tone, tag: isNum(o.tackles) ? `n = ${o.tackles}` : '' }),
    pf3dc('Avg rating', isNum(p.avg) ? p.avg.toFixed(1) : null, { tone: pf3Band(p.avg), tag: n ? `${n} rated` : '', href: sub({ ptab: 'ratings' }) })].join('');
  return `<div class="pf3-tab"><section><h4 class="pf3-h">Playing time</h4><div class="pf3-cells g3">${play}</div></section><i class="pf3-vr" aria-hidden="true"></i><section><h4 class="pf3-h">Player Performance · official</h4><div class="pf3-cells g3">${perf}</div></section></div>`;
}
function pf3Stamp() {
  const lp = ((window.FC26_SQUAD || {}).club || {}).league_position || {}, d = parseDate(lp.game_date), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `<div class="sq-stamp3 pf3-stamp"><b>In-game values</b><span>${d ? `as of ${d.getUTCDate()} ${M[d.getUTCMonth()]}` : 'date not captured'}</span></div>`;
}
// Profile pad map (round 7, brief profile-cells §4, Deep): B Back · LT RT Tab · X Compare · Y Search (+ A Open on a drill-down cell).
// X = the approved Squad compare: Squad opens with this player Marked (pick a second player there).
window.PAD_HOOKS = window.PAD_HOOKS || {};
window.PAD_HOOKS.profile = {
  z: 1,
  active: () => typeof S === 'object' && S.page === 'player' && !!document.querySelector('#main .pf-panel'),
  prompts() {
    const a = document.activeElement, cell = !!(a && a.matches && a.matches('#main a.dcell'));
    return [...(cell ? [['A', 'Open']] : []), ['B', 'Back'], ['LTRT', 'Tab'], ['X', 'Compare'], ['Y', 'Search']];
  },
  press(k) {
    const a = document.activeElement;
    if (k === 'X') { const p = playerById(S.id); if (!p) return true; location.hash = `page=squad&mk=${encodeURIComponent(p.name)}&sel=${encodeURIComponent(p.name)}`; return true; }
    if (k === 'A' && a && a.matches && a.matches('#main a.dcell')) { const h = a.getAttribute('href'); if (window.NAVSTATE && NAVSTATE.isViewChange(h, location.hash) && typeof window.setView === 'function') window.setView(h); else location.hash = h.slice(1); return true; }
    return false;
  },
};
