/* Us (duo career profile), Findings ledger drill-down, Scouting / youth / transfers */
'use strict';

// ---------------- Duo (career) ----------------
function duoAgg() {
  const rows = matchList().map(r => ({ r, m: matchData(r.id) })).filter(x => x.m);
  const w = x => (x.m.kpis || {}).real_minutes || 1;
  const A = { rows, h: { p1: {}, p2: {} }, heat: { p1: {}, p2: {} }, ctl: { p1: [], p2: [] }, act: { p1: {}, p2: {} }, press: { p1: { ep: 0, won: 0, eng: 0 }, p2: { ep: 0, won: 0, eng: 0 } }, byPlayer: { p1: {}, p2: {} } };
  ['p1', 'p2'].forEach(mk => {
    ['switches_per_min', 'd_ball_us', 'd_ball_them', 'avg_x', 'avg_y'].forEach(k => { A.h[mk][k] = wavg(rows, x => ((x.m.humans || {})[mk] || {})[k], w); });
    rows.forEach(x => {
      const h = (x.m.humans || {})[mk] || {};
      A.heat[mk].us = addHeat(A.heat[mk].us, h.heat_us, w(x)); A.heat[mk].them = addHeat(A.heat[mk].them, h.heat_them, w(x));
      (x.m.players || []).forEach(p => { const c = p['ctrl_' + mk] || 0; if (c > 0) A.byPlayer[mk][p.name] = (A.byPlayer[mk][p.name] || 0) + c * (p.minutes || 0); });
      const cc = ctlFor(x.m, mk);
      if (cc && cc.ctl) A.ctl[mk].push({ r: x.r, c: cc.ctl });
      if (cc && cc.act) {
        const act = cc.act;
        ['pass_direction', 'pass_power', 'pass_height', 'by_kind'].forEach(g => {
          A.act[mk][g] = A.act[mk][g] || {};
          Object.entries(act[g] || {}).forEach(([k, v]) => { const o = A.act[mk][g][k] = A.act[mk][g][k] || { n: 0, kept: 0 }; o.n += v.n || 0; o.kept += (v.kept || 0) * (v.n || 0); });
        });
        const pr = act.pressing || {}; A.press[mk].ep += pr.episodes || 0; A.press[mk].won += (pr.won_share || 0) * (pr.episodes || 0); A.press[mk].eng += (pr.engaged_share || 0) * (pr.episodes || 0);
      }
    });
  });
  return A;
}
REG.duo = {
  title: () => P1() + ' & ' + P2(),
  need: () => ensureAllDays(), ready: () => allDaysLoaded(),
  render() {
    const A = duoAgg(), rows = A.rows;
    if (!rows.length) return '<div class="tile empty">No match data yet.</div>';
    const mgr = (mk, name) => { const h = A.h[mk]; return `<section class="tile"><div class="mgr ${mk}"><div class="badge"><span>${esc(initials(name))}</span></div><div><div class="lbl">${mk === 'p1' ? 'Player 1 · blue marker' : 'Player 2 · red marker'}</div><div class="nm">${esc(name)}</div></div></div>
      <div class="stats" style="margin-top:14px">${statBox(h.switches_per_min, 'Switches / min', { d: 1, cls: mk })}${statBox(h.d_ball_us, 'To ball · our ball', { d: 1, suf: 'm', cls: mk })}${statBox(h.d_ball_them, 'To ball · their ball', { d: 1, suf: 'm', cls: mk })}${statBox(h.avg_x, 'Avg depth', { suf: 'm', cls: mk, tip: 'Average x from our goal' })}</div></section>`; };
    const heat = (mk) => tile(`${esc(mk === 'p1' ? P1() : P2())} · where you play`, `<div class="grid g2" style="gap:10px"><div><div class="pitchwrap">${pitchSVG(heatCells(A.heat[mk].us, `var(--${mk})`), { noArrow: true })}</div><div class="small muted">We have the ball</div></div><div><div class="pitchwrap">${pitchSVG(heatCells(A.heat[mk].them, `var(--${mk})`), { noArrow: true })}</div><div class="small muted">They have the ball</div></div></div>`);
    const labels = rows.map(x => x.r.opp);
    const trend = (title, f, tgt, tip) => tile(`${title} ${info(tip)}`, lineChart({ labels, h: 120, min: 0, max: Math.max(.5, ...rows.map(f).filter(isNum)) * 1.1, band: [tgt.lo || 0, tgt.hi != null ? tgt.hi : 1], grid: [.25], valueLabels: true, fmt: v => pct(v), legend: false,
      series: [{ name: title, color: '#6cb6ff', values: rows.map(f), area: true }] }));
    const fav = mk => { const e = Object.entries(A.byPlayer[mk]).sort((a, b) => b[1] - a[1]).slice(0, 6); const tot = sum(e, x => x[1]) || 1; return hbars(e.map(([n, v]) => { const p = playerByName(n); return { label: `${p ? avatar(p) : ''} ${p ? `<a href="${plink(p)}">${esc(n)}</a>` : esc(n)}`, v: v / tot, color: `var(--${mk})` }; }), { max: e.length ? e[0][1] / tot : 1, fmtv: v => pct(v) }); };
    const ctlTrend = mk => A.ctl[mk].length ? lineChart({ labels: A.ctl[mk].map(x => x.r.opp), h: 130, min: 0, max: .7, grid: [.15, .35], valueLabels: true, fmt: v => pct(v),
      series: [{ name: 'Sprint (RT) defending', color: '#ff5468', values: A.ctl[mk].map(x => x.c.sprint_frac_defence) }, { name: 'Jockey (LT) defending', color: '#3ee08f', values: A.ctl[mk].map(x => x.c.lt_frac_defence) }, { name: 'Sprint w/o jockey', color: '#ffd23d', values: A.ctl[mk].map(x => x.c.sprint_no_jockey_frac_defence), dash: true }] }) : `<p class="muted">No controller log for ${esc(mk === 'p1' ? P1() : P2())} yet.</p>`;
    const passProf = mk => {
      const g = A.act[mk]; if (!g.pass_direction) return '';
      const dist = o => { const e = Object.entries(o || {}).filter(([k]) => k !== 'none' && k !== 'unknown'); const tot = sum(e, x => x[1].n) || 1; return hbars(e.sort((a, b) => b[1].n - a[1].n).map(([k, v]) => ({ label: esc(k), v: v.n / tot, sub: `${v.n} · kept ${pct(v.kept / (v.n || 1))}`, color: `var(--${mk})` })), { max: 1, fmtv: v => pct(v) }); };
      const pr = A.press[mk];
      return `<div class="grid g3" style="margin-top:14px"><div><div class="lbl">Pass direction</div>${dist(g.pass_direction)}</div><div><div class="lbl">Power</div>${dist(g.pass_power)}<div class="lbl" style="margin-top:10px">Height</div>${dist(g.pass_height)}</div>
        <div><div class="lbl">Pressing</div><div class="stats">${statBox(pr.ep, 'Episodes')}${statBox(pr.ep ? pr.won / pr.ep * 100 : null, 'Won ball', { suf: '%', cls: pr.ep && pr.won / pr.ep >= .3 ? 'g' : 'b' })}${statBox(pr.ep ? pr.eng / pr.ep * 100 : null, 'Engaged', { suf: '%' })}</div></div></div>`;
    };
    const L = ledger();
    const lf = L ? (L.season || []).filter(f => f.who === 'me' || f.who === 'duo').sort((a, b) => b.severity - a.severity) : [];
    return `<div class="ptitle"><h1><small>Co-op profile · ${rows.length} matches</small>${esc(P1())} &amp; ${esc(P2())}</h1></div>
      <div class="grid g2">${mgr('p1', P1())}${mgr('p2', P2())}</div>
      <div class="grid g2" style="margin-top:16px">${heat('p1')}${heat('p2')}</div>
      <div class="grid g4" style="margin-top:16px">
        ${trend('Same zone defending', x => (x.m.coop || {}).def_too_close_together_frac, TARGETS.def_close, 'Within 10 m of each other while defending. Green band = target (≤15%).')}
        ${trend('Double press', x => (x.m.coop || {}).def_double_press_frac, TARGETS.double_press, 'Both within ~6 m of the carrier. Target <5%.')}
        ${trend('Crowding in attack', x => (x.m.coop || {}).att_too_close_together_frac, TARGETS.att_close, 'Within 8 m of each other while attacking. Target ≤15%.')}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${tile(`${esc(P1())}'s controller`, ctlTrend('p1') + passProf('p1'), {})}
        ${tile(`${esc(P2())}'s controller`, ctlTrend('p2') + passProf('p2'), {})}
      </div>
      <div class="grid g3" style="margin-top:16px">
        ${tile(`${esc(P1())} plays as`, fav('p1') || '<p class="muted">–</p>')}
        ${tile(`${esc(P2())} plays as`, fav('p2') || '<p class="muted">–</p>')}
        ${tile('Our season findings', lf.length ? `<div class="xl">${lf.map(f => `<a class="mini" href="#page=findings&rule=${encodeURIComponent(f.rule)}">${sevDots(f.severity)}${whoChip(f.who)}<span style="flex:1;font-size:13px">${esc(f.title)}</span>${trendChip(f.trend)}</a>`).join('')}</div>` : '<p class="muted">No ledger yet.</p>', { right: '<a href="#page=findings">Ledger</a>' })}
      </div>`;
  },
};

// ---------------- Findings ledger ----------------
function ruleOf(id) { return ((ledger() || {}).rules || []).find(r => r.id === id) || {}; }
function ruleValue(id, v) {
  const r = ruleOf(id);
  if (!isNum(v)) return '–';
  return r.fmt === 'pct' ? pct(v) : r.fmt === 's' ? fmt(v, 2) + ' s' : r.fmt === 'm' ? fmt(v, 1) + ' m' : fmt(v, v < 10 ? 2 : 1);
}
function ruleTarget(id) { const r = ruleOf(id); if (!isNum(r.thr)) return ''; return (r.dir === 'high_bad' ? '≤ ' : '≥ ') + ruleValue(id, r.thr); }
function perMatch(rule) {
  const L = ledger() || {};
  return matchList().map(m => { const lm = (L.matches || {})[m.id]; const f = lm && (lm.findings || []).find(x => x.rule === rule); return { m, f }; }).filter(x => x.f);
}
function noteDetail(n) {
  const d = n.detail || '';
  if (d[0] !== '{') return d;
  try { const o = JSON.parse(d), pp = o.previous_possession || {}; return [pp.team && `before: ${pp.team === 'us' ? 'we' : 'they'} lost it in the ${pp.lost_in_third} third`, isNum(o.players_behind_ball) && `${o.players_behind_ball} behind the ball`].filter(Boolean).join(' · '); } catch (e) { return ''; }
}
REG.findings = {
  title: () => 'Findings',
  render(S) {
    const L = ledger();
    if (!L) return '<div class="tile empty">No findings ledger yet (data/ledger.js).</div>';
    const lvl = S.lvl === 'overall' ? 'overall' : 'season';
    const list = (L[lvl] || []).slice().sort((a, b) => (b.flagged - a.flagged) || (b.severity - a.severity) || (b.weight - a.weight));
    const rule = S.rule || (list[0] && list[0].rule);
    const groups = [['me', P1()], ['duo', P1() + ' + ' + P2()], ['team', 'Team']];
    const row = f => {
      const pmv = perMatch(f.rule), r = ruleOf(f.rule);
      return `<a class="item ${f.rule === rule ? 'sel' : ''}" href="${sub({ rule: f.rule, match: null })}" style="grid-template-columns:auto minmax(0,1fr) auto">${sevDots(f.severity)}
        <span><span style="${f.flagged ? '' : 'color:var(--muted)'}">${esc(f.title)}</span><div class="meta">${esc(ruleValue(f.rule, f.value))} · target ${esc(ruleTarget(f.rule))}${f.recurrence ? ` · flagged in ${f.recurrence[0]} of ${f.recurrence[1]} matches` : ''}${f.enough_data === false ? ' · little data' : ''}</div></span>
        <span class="row" style="gap:8px;flex-wrap:nowrap">${sparkBars(pmv.map(x => ({ v: x.f.value, bad: x.f.flagged, t: x.m.opp + ' ' + ruleValue(f.rule, x.f.value) })), { w: 56, h: 22, thr: r.thr })}${trendChip(f.trend)}</span></a>`;
    };
    const left = tile(`${lvl === 'season' ? 'Season ' + esc(seasonLabel()) : 'All-time'} <span class="spacer"></span><span class="seg"><a href="${sub({ lvl: null })}" class="${lvl === 'season' ? 'on' : ''}">Season</a><a href="${sub({ lvl: 'overall' })}" class="${lvl === 'overall' ? 'on' : ''}">All-time</a></span>`,
      groups.map(([k, l]) => { const fs = list.filter(f => f.who === k); return fs.length ? `<div class="lbl" style="margin:10px 0 4px;display:flex;gap:8px;align-items:center">${whoChip(k)}</div>${fs.map(row).join('')}` : ''; }).join('')
      + `<p class="note">${esc(L.principle || '')}</p>`);

    // detail
    const f = list.find(x => x.rule === rule) || {}, r = ruleOf(rule);
    const pmv = perMatch(rule);
    const sess = Object.entries(L.sessions || {}).sort().map(([d, fs]) => ({ d, f: fs.find(x => x.rule === rule) })).filter(x => x.f);
    const mx = Math.max(r.thr || 0, ...pmv.map(x => x.f.value).filter(isNum), ...sess.map(x => x.f.value).filter(isNum)) * 1.15 || 1;
    const bars = (items, lab, hrefF, selId) => `<div class="chart" style="height:150px;display:flex;align-items:flex-end;gap:8px;padding:0 4px 22px;border-bottom:1px solid var(--line)">
      ${isNum(r.thr) ? `<span style="position:absolute;left:0;right:0;bottom:${22 + r.thr / mx * 120}px;border-top:2px dashed var(--good)" data-tip="Target ${esc(ruleTarget(rule))}"></span>` : ''}
      ${items.map(x => `<a href="${hrefF(x)}" style="flex:1;max-width:80px;position:relative;height:${Math.max(3, (x.f.value || 0) / mx * 120)}px;background:${x.f.flagged ? 'linear-gradient(180deg,#ff5468,#a8233a)' : 'linear-gradient(180deg,#6cb6ff,#1d5fe0)'};${selId && selId === x.id ? 'outline:2px solid #fff;' : ''}" class="fill" data-tip="<b>${esc(lab(x))}</b><br>${esc(ruleValue(rule, x.f.value))}${x.f.flagged ? ' · flagged' : ''}${isNum(x.f.weight) ? ' · weight ' + fmt(x.f.weight, 1) : ''}">
        <span class="ov ink" style="top:-14px;left:50%;transform:translateX(-50%)">${esc(ruleValue(rule, x.f.value))}</span><span class="ov" style="bottom:-16px;left:50%;transform:translateX(-50%)">${esc(lab(x))}</span></a>`).join('')}</div>`;
    let detail = tile(`${esc(f.title || r.title || rule)} <span class="spacer"></span>${trendChip(f.trend)}`,
      `<div class="row" style="margin-bottom:12px">${whoChip(f.who || r.who)}<span class="chip"><span>${esc(f.area || r.area || '')}</span></span>${sevDots(f.severity || 0)}</div>
       <div class="stats">${statBox(ruleValue(rule, f.value), lvl === 'season' ? 'Season' : 'All-time', { cls: f.flagged ? 'b' : 'g' })}${statBox(ruleTarget(rule), 'Target')}${statBox(f.recurrence ? f.recurrence[0] + ' of ' + f.recurrence[1] : '–', 'Matches flagged')}${statBox(isNum(f.weight) ? f.weight : null, 'Sample', { d: 1 })}</div>
       ${f.text ? `<p class="small ink2" style="margin:12px 0 0">${esc(f.text)}</p>` : ''}
       ${(f.advice || r.advice) ? `<p class="fixline"><b>Fix:</b> ${esc(f.advice || r.advice)}</p>` : ''}
       ${sess.length > 1 ? `<div class="lbl" style="margin:18px 0 26px">Per session</div>${bars(sess.map(x => ({ ...x, id: x.d })), x => shortDate(x.d), x => sub({ match: null }))}` : ''}
       <div class="lbl" style="margin:18px 0 26px">Per match <span class="muted" style="letter-spacing:0;text-transform:none;font-family:var(--fb)">· click a bar for its possessions</span></div>
       ${pmv.length ? bars(pmv.map(x => ({ ...x, id: x.m.id })), x => x.m.opp, x => sub({ match: x.m.id }), S.match) : '<p class="muted">No per-match values.</p>'}`);
    // possessions
    const mid = S.match;
    if (mid && matchRef(mid)) {
      const ref = matchRef(mid);
      const notes = ((L.possessions || {})[mid] || []);
      const forRule = notes.filter(n => n.rule === rule), other = notes.filter(n => n.rule !== rule);
      const mf = (((L.matches || {})[mid] || {}).findings || []).find(x => x.rule === rule);
      const nrow = n => `<div class="item" style="cursor:default"><span class="min">${minLabel(n.minute)}</span><span><i class="dot ${n.team === 'them' ? 'them' : 'us'}"></i> <b>${esc(n.kind)}</b><div class="meta">${esc(noteDetail(n))}${n.outcome ? ' · ' + esc(n.outcome) : ''}</div></span>
        <span class="row" style="gap:10px;flex-wrap:nowrap">${n.chain != null ? `<a class="lnk" href="#page=match&id=${encodeURIComponent(mid)}&tab=attacks&chain=${n.chain}&fteam=${n.team || 'us'}">path</a>` : ''}<a class="lnk" href="#page=match&id=${encodeURIComponent(mid)}&tab=replay&t=${Math.max(0, n.minute - .4).toFixed(1)}">${ICON.film} watch</a></span></div>`;
      detail += tile(`${resChip(resultOf(ref))} ${esc(ref.title)} · possessions <span class="spacer"></span><a href="#page=match&id=${encodeURIComponent(mid)}">Match centre</a>`,
        `${mf ? `<p class="small ink2" style="margin:0 0 10px">This match: <b>${esc(ruleValue(rule, mf.value))}</b> ${mf.flagged ? '<span class="bad">flagged</span>' : '<span class="good">ok</span>'} (target ${esc(ruleTarget(rule))})</p>` : ''}
         ${forRule.length ? `<div class="lbl" style="margin-bottom:4px">Linked to this rule (${forRule.length})</div><div class="list" style="max-height:340px">${forRule.map(nrow).join('')}</div>` : `<p class="muted small">No possession notes are tied to this rule${(r.who || f.who) === 'me' ? ' (controller-level rule - watch the replay)' : ''}.</p>`}
         ${other.length ? `<div class="xi" style="margin-top:8px"><div class="xh"><span class="tx lnk">Other key possessions (${other.length})</span>${ICON.car}</div><div class="xb"><div class="list" style="max-height:360px">${other.map(nrow).join('')}</div></div></div>` : ''}`);
    }
    return `<div class="ptitle"><h1><small>Findings · Season / Session / Match / Possession</small>Findings</h1></div>
      <div class="grid g-side2">${left}<div class="stack">${detail}</div></div>`;
  },
};

// ---------------- Scouting, youth academy & transfers ----------------
const eur = v => !isNum(v) ? '–' : v >= 1e6 ? '€' + fmt(v / 1e6, v >= 1e7 ? 0 : 1) + 'M' : v >= 1e3 ? '€' + fmt(v / 1e3, 0) + 'K' : '€' + v;
const qual = q => q ? `<span class="nowrap" data-tip="OCR quality: ${esc(q)}" style="color:${q === 'high' ? 'var(--good)' : q === 'medium' ? 'var(--warn)' : 'var(--bad)'};font:700 10px var(--fh);letter-spacing:.1em;text-transform:uppercase">${esc(q)}</span>` : '';
const potRange = (lo, hi) => isNum(lo) || isNum(hi) ? `<span class="nowrap"><b class="${atCls(lo)}">${fmt(lo)}</b><span class="muted">–</span><b class="${atCls(hi)}">${fmt(hi)}</b></span>` : '–';
function potBar(ovr, lo, hi) {
  if (!isNum(lo) && !isNum(hi)) return '';
  const L = 40, H = 99, X = v => clamp((v - L) / (H - L) * 100, 0, 100);
  return `<div style="position:relative;height:8px;background:rgba(255,255,255,.06);min-width:110px" data-tip="OVR ${fmt(ovr)} · potential ${fmt(lo)}–${fmt(hi)}">
    ${isNum(ovr) ? `<i class="fill" style="position:absolute;left:0;top:0;bottom:0;width:${X(ovr)}%;background:linear-gradient(90deg,#1d5fe0,#6cb6ff)"></i>` : ''}
    <i style="position:absolute;top:-2px;bottom:-2px;left:${X(lo || hi)}%;width:${Math.max(1, X(hi || lo) - X(lo || hi))}%;background:rgba(62,224,143,.45);border:1px solid var(--good)"></i></div>`;
}
REG.scouting = {
  title: () => 'Scouting',
  tabs: () => ['academy', 'scouting', 'transfers', 'inbox'],
  render(S) {
    const Q = window.FC26_SQUAD;
    const tab = ['academy', 'scouting', 'transfers', 'inbox'].includes(S.tab) ? S.tab : 'academy';
    const tabs = `<nav class="stabs" style="margin-top:0"><span class="gl lt">LT</span>${[['academy', 'Youth academy'], ['scouting', 'Scout reports'], ['transfers', 'Transfers'], ['inbox', 'Inbox']].map(([k, l]) => `<a href="${sub({ tab: k === 'academy' ? null : k })}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}<span class="gl lt">RT</span></nav>`;
    const head = `<div class="ptitle"><h1><small>${esc(clubName())} · Academy &amp; recruitment</small>Youth &amp; Scouting</h1><span class="spacer"></span>${Q ? clubCtx(Q) : ''}</div>`;
    if (!Q) return head + tabs + `<div class="tile empty">No squad-planning data yet. It appears here once <code>data/squad_planning.js</code> is generated (python -m fccoach.career_screens).</div>`;
    const body = { academy: scAcademy, scouting: scReports, transfers: scTransfers, inbox: scInbox }[tab](Q);
    const miss = (Q.missing || []).length ? `<div class="xi" style="margin-top:16px"><div class="xh"><span class="tx muted small">Not captured yet (${Q.missing.length})</span>${ICON.car}</div><div class="xb"><ul class="small muted" style="margin:0;padding-left:18px">${Q.missing.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : '';
    return head + tabs + body + miss;
  },
};
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function clubCtx(Q) {
  const c = Q.club || {}, bits = [];
  const lp = c.league_position && (c.league_position.position ?? c.league_position);
  // league position: no KPI tile (banned pattern); it is plain text in the Central matchday line
  const b = c.budget || {};
  if (isNum(b.total_eur)) bits.push(statBox(eur(b.total_eur), 'Total budget' + (b.week ? ` · week ${b.week}` : '')));
  if (isNum(b.current_budget_eur)) bits.push(statBox(eur(b.current_budget_eur), 'Current budget', { cls: 'g', tip: (b.notes || []).join('; ') }));
  if (isNum(b.spent_this_season_eur)) bits.push(statBox(eur(b.spent_this_season_eur), 'Spent this season', { cls: 'b' }));
  return bits.length ? `<div class="stats" style="min-width:min(560px,100%)">${bits.join('')}</div>` : '';
}
function scAcademy(Q) {
  const ys = (Q.youth || []).slice().sort((a, b) => (b.pot_hi || 0) - (a.pot_hi || 0));
  const tbl = ys.length ? `<div class="tscroll"><table class="dt" id="ytbl" data-sortable><thead><tr><th data-sort="str">Pos</th><th data-sort="str">Name</th><th data-sort class="n">Age</th><th data-sort class="n">OVR</th><th data-sort class="n">POT</th><th>Growth room</th><th data-sort="str">Plan</th><th data-sort class="n">ETA wks</th><th>Data</th></tr></thead><tbody>
    ${ys.map(y => { const d = y.data || {}; return `<tr><td data-v="${esc(y.pos || '')}">${posBadge(y.pos)}</td><td class="stick"><div class="pl"><span class="av">${esc(initials(y.name))}</span><div><b>${esc(y.name)}</b><small>${esc([d.foot && d.foot + ' foot', d.height_cm && d.height_cm + ' cm', (d.positions || []).join(' ')].filter(Boolean).join(' · '))}</small></div></div></td>
      <td class="n">${fmt(y.age)}</td><td class="n" data-v="${y.ovr ?? ''}"><b class="${atCls(y.ovr)}">${fmt(y.ovr)}</b></td><td class="n" data-v="${y.pot_hi ?? ''}">${potRange(y.pot_lo, y.pot_hi)}</td><td>${potBar(y.ovr, y.pot_lo, y.pot_hi)}</td>
      <td>${esc(y.plan || '–')}</td><td class="n">${fmt(d.eta_weeks)}</td><td>${qual(y.quality)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No Youth Squad screen captured yet.</p>';
  const dp = (Q.dev_plans || []);
  const dev = dp.length ? tile(`Development plans <span class="sub">${dp.length}</span>`, `<div class="xl list" style="max-height:760px">${dp.map(p => { const d = p.data || {}; return xItem(`${posBadge(p.pos)}<span class="tx"><b>${esc(p.name)}</b> <span class="muted small">${esc(p.group || '')}</span></span><span class="chip"><span>${esc(p.plan || '–')}</span></span>`,
    `<div class="row small">${[['OVR', d.ovr], ['Age', d.age], ['Form', d.form], ['Match XP', d.match_xp], ['Dev bonus', d.dev_bonus]].filter(x => x[1] != null).map(([k, v]) => `<span class="chip"><span>${k} ${esc(v)}</span></span>`).join('')}</div>
     ${(d.options || []).length ? `<table class="dt" style="margin-top:8px"><thead><tr><th>Plan</th><th class="n">Level-up wks</th><th class="n">Next OVR</th><th>Role growth</th></tr></thead><tbody>${d.options.map(o => `<tr><td>${esc(o.plan)}</td><td class="n">${fmt(o.level_up_weeks)}</td><td class="n">${fmt(o.next_ovr)}</td><td>${esc(Array.isArray(o.role_growth) ? o.role_growth.join(', ') : o.role_growth || '')}</td></tr>`).join('')}</tbody></table>` : ''}`); }).join('')}</div>`) : '';
  const top = ys.slice(0, 3);
  return `${top.length ? `<div class="grid g3" style="margin-bottom:16px">${top.map(y => tile('', `<div class="row"><span class="av lg">${esc(initials(y.name))}</span><div style="flex:1"><div class="lbl">Top prospect</div><div class="mid">${esc(y.name)}</div><div class="row small" style="margin-top:4px">${posBadge(y.pos)}<span>${fmt(y.age)} yrs</span></div></div>
    <div style="text-align:right"><div class="lbl">POT</div><div class="mid">${potRange(y.pot_lo, y.pot_hi)}</div><div class="small muted">OVR ${fmt(y.ovr)}</div></div></div><div style="margin-top:10px">${potBar(y.ovr, y.pot_lo, y.pot_hi)}</div>`)).join('')}</div>` : ''}
    <div class="grid g-side">${tile(`Youth squad <span class="sub">${ys.length}</span>`, tbl, { cls: 'flat' })}${dev || tile('Development plans', '<p class="muted">None captured.</p>')}</div>`;
}
function scReports(Q) {
  const sc = Q.scouting || {};
  const card = r => { const d = r.data || {}; return `<div class="tile" style="padding:14px"><div class="row" style="align-items:flex-start"><span class="av">${esc(initials(r.name))}</span><div style="flex:1;min-width:0"><div class="nm" style="font-weight:600">${esc(r.name || '?')}</div><div class="row small" style="gap:6px;margin-top:3px">${posBadge(r.pos)}${isNum(r.age) ? `<span>${r.age} yrs</span>` : ''}${r.location ? `<span class="muted">${esc(r.location)}</span>` : ''}</div></div>${qual(r.quality)}</div>
    <div class="row" style="margin-top:10px;justify-content:space-between"><div><div class="lbl">OVR</div><b class="mid">${potRange(r.ovr_lo, r.ovr_hi)}</b></div><div style="text-align:right"><div class="lbl">POT</div><b class="mid">${potRange(r.pot_lo, r.pot_hi)}</b></div></div>
    <div style="margin-top:8px">${potBar(r.ovr_lo ?? r.ovr_hi, r.pot_lo, r.pot_hi)}</div>${r.scout ? `<p class="note">Scout: ${esc(r.scout)}</p>` : ''}
    ${d.attributes ? `<div class="row small" style="margin-top:6px;gap:4px">${Object.entries(d.attributes).slice(0, 6).map(([k, v]) => `<span class="chip"><span>${esc(k.slice(0, 3).toUpperCase())} <b class="${atCls(v)}">${esc(v)}</b></span></span>`).join('')}</div>` : ''}</div>`; };
  const yr = sc.youth_reports || [], sr = sc.senior_reports || [], scouts = sc.scouts || [];
  return `${tile(`Youth scout reports <span class="sub">${yr.length}</span>`, yr.length ? `<div class="grid g3">${yr.map(card).join('')}</div>` : '<p class="muted">None captured.</p>')}
    <div class="grid g2" style="margin-top:16px">${tile(`Senior scout reports <span class="sub">${sr.length}</span>`, sr.length ? `<div class="grid g2">${sr.map(card).join('')}</div>` : '<p class="muted">None captured.</p>')}
    ${tile(`Scout network <span class="sub">${scouts.length}</span>`, scouts.length ? scouts.map(s => { const d = s.data || {}; return `<div class="mini"><span class="av">${esc(initials(s.name))}</span><div style="flex:1"><div class="nm">${esc(s.name)}</div><div class="sub">${esc([s.location, d.duration, d.status, d.returning && 'back ' + d.returning].filter(Boolean).join(' · '))}</div>${(d.targets || []).length ? `<div class="row" style="gap:4px;margin-top:4px">${d.targets.map(t => `<span class="chip"><span>${esc(typeof t === 'string' ? t : JSON.stringify(t))}</span></span>`).join('')}</div>` : ''}</div><b>${isNum(d.mission_cost_eur) ? eur(d.mission_cost_eur) : ''}</b></div>`; }).join('') : '<p class="muted">None captured.</p>')}</div>`;
}
function scTransfers(Q) {
  const tr = Q.transfers || [];
  const st = s => { const x = String(s || '').toLowerCase(); return x ? `<span class="verdict ${/accept|done|complete|sold/.test(x) ? 'start' : /reject|declin|cancel/.test(x) ? 'drop' : 'develop'}">${esc(s)}</span>` : '–'; };
  return tile(`Transfer activity <span class="sub">${tr.length}</span>`, tr.length ? `<div class="tscroll"><table class="dt" id="trtbl" data-sortable><thead><tr><th data-sort="str">Date</th><th data-sort="str">Type</th><th data-sort="str">Player</th><th data-sort="str">Club</th><th data-sort class="n">Fee</th><th data-sort="str">Status</th><th>Data</th></tr></thead><tbody>
    ${tr.map(t => { const p = playerByName(t.player); return `<tr><td>${esc(t.date || '')}</td><td><span class="chip"><span>${esc((t.type || t.kind || '').replace(/_/g, ' '))}</span></span></td><td class="stick">${p ? `<a href="${plink(p)}" class="pl">${avatar(p)}<b>${esc(t.player)}</b></a>` : `<b>${esc(t.player || '–')}</b>`}</td>
      <td>${esc(t.club || '–')}</td><td class="n" data-v="${t.fee_eur ?? ''}">${isNum(t.fee_eur) ? eur(t.fee_eur) : esc(t.value_text || '–')}</td><td data-v="${esc(t.status || '')}">${st(t.status)}</td><td>${qual(t.quality)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No transfer screens captured yet.</p>', { cls: 'flat' })
    + ((Q.squad_status || []).length ? `<div style="margin-top:16px">${tile('Squad status (latest Player Info)', `<div class="tscroll"><table class="dt"><thead><tr><th>Player</th><th class="n">OVR</th><th>Pos</th><th class="n">Age</th><th>Morale</th><th class="n">Sharp</th><th class="n">Energy</th></tr></thead><tbody>${Q.squad_status.map(s => { const p = playerByName(s.name); return `<tr><td>${p ? `<a class="pl" href="${plink(p)}">${avatar(p)}<b>${esc(s.name)}</b></a>` : esc(s.name)}</td><td class="n"><b class="${atCls(s.ovr)}">${fmt(s.ovr)}</b></td><td>${(s.positions || []).map(posBadge).join(' ')}</td><td class="n">${fmt(s.age)}</td><td>${moraleChip(s.morale)}</td><td class="n">${fmt(s.sharpness)}</td><td class="n">${fmt(s.energy)}</td></tr>`; }).join('')}</tbody></table></div>`, { cls: 'flat' })}</div>` : '');
}
function scInbox(Q) {
  const ib = Q.inbox || {};
  const em = ib.emails || [], no = ib.notifications || [], ch = ib.chats || [];
  return `<div class="grid g-side">${tile(`Emails <span class="sub">${em.length}</span>`, em.length ? `<div class="xl">${em.map(e => xItem(`<span class="chip"><span>${esc(e.date || '')}</span></span><span class="tx"><b>${esc(e.subject || '(no subject)')}</b> <span class="muted small">${esc(e.sender || '')}</span></span>`, e.body ? `<p class="small ink2" style="margin:0;white-space:pre-wrap">${esc(e.body)}</p>` : '')).join('')}</div>` : '<p class="muted">None captured.</p>')}
    <div class="stack">${tile(`Notifications <span class="sub">${no.length}</span>`, no.length ? no.map(n => `<div class="mini"><span class="chip"><span>${esc(n.category || 'note')}</span></span><div style="flex:1;font-size:13px">${esc(n.subject || n.body || '')}</div></div>`).join('') : '<p class="muted">None.</p>')}
    ${tile(`Player chats <span class="sub">${ch.length}</span>`, ch.length ? ch.map(c => { const p = playerByName(c.player); return `<div class="mini">${avatar(p || { name: c.player })}<div style="flex:1"><div class="nm">${esc(c.player || '')} <span class="muted small">${esc(c.date || '')}</span></div><div class="sub">${esc(c.body || c.subject || '')}</div></div></div>`; }).join('') : '<p class="muted">None.</p>')}</div></div>`;
}
