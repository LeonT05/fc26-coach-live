// ---------- Central (L5) · approved Figma frame 90:1106 + "News Card · Central" set 97:1906 ----------
// Left column: in-game date (as of), LAST MATCH fixture with the result as coloured text, Matchday Plan / Match Centre,
// three task rows. Right: one news card, paged with R (plan · last match · Director). Only what we add.
const CEN_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], CEN_MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const cenMon = i => CEN_MON[i].charAt(0) + CEN_MON[i].slice(1).toLowerCase();
const CEN_IC_COL = { energy: '#2AD679', check: '#2AD679', warning: '#F3B80C', duo: '#E9EDF2', tactics: '#C9D3D8', film: '#E9EDF2', ball: '#FFFFFF', scout: '#C9D3D8' };
const cenIco = n => `<span class="cen-ic" style="--ic:url(assets/icons/${n}.svg);--c:${CEN_IC_COL[n] || '#E9EDF2'}"></span>`;
const cenSplit = t => { const s = String(t || ''), i = s.indexOf(':'); return i > 8 ? [s.slice(0, i), s.slice(i + 1).trim()] : [s, '']; };
const cenCap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function cenGameDate() {
  const lp = ((window.FC26_SQUAD || {}).club || {}).league_position || {};
  const d = parseDate(lp.game_date); if (!d) return null;
  return { head: `${CEN_DAYS[d.getUTCDay()]}, ${CEN_MON[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`, asof: `${d.getUTCDate()} ${cenMon(d.getUTCMonth())}`, pos: lp.position ?? null };
}
function cenSides(m) {
  const rawS = m.score_us_them || [], s = [isNum(rawS[0]) ? rawS[0] : '–', isNum(rawS[1]) ? rawS[1] : '–'], away = m.our_side === 'away';
  return { away, home: away ? [m.opp || 'TBC', s[1]] : [m.ours || 'COM', s[0]], awy: away ? [m.ours || 'COM', s[0]] : [m.opp || 'TBC', s[1]], r: resultOf(m) };
}
const CEN_RES = { W: 'Won', D: 'Drew', L: 'Lost' };
function cenRow(href, icon, label, meta, attrs = '') { return `<a class="cen-row" href="${href}" ${attrs}>${cenIco(icon)}<span class="l">${esc(label)}</span><span class="m">${esc(meta)}</span></a>`; }
// Last 6 (moved from the header, brief career-security-header; Figma 222:6033): coloured result letters, oldest left, no boxes.
function cenForm(ms) {
  const last = ms.slice(-6).map(resultOf).filter(r => CEN_RES[r]);
  return last.length ? `<div class="cen-form"><span class="k">Last 6</span><span class="rs">${last.map(r => `<b class="${r}">${r}</b>`).join('')}</span></div>` : '';
}
// grid brief G5 (Figma 288:28481): three cards of 525 × 585, centred at y 200. Card 1 = the matchday and its tasks, card 2 = the
// last match (A opens Match Centre; B there returns focus here), card 3 = the news card (R pages it).
function centralCards(ms) {
  const m = ms[ms.length - 1], gd = cenGameDate();
  const dir = latestWith(directorFor), sell = dir && (dir.v.sell_or_loan || [])[0];
  let c1 = `<div class="cen-date">${esc(gd ? gd.head : '')}</div>
    <div class="cen-sub">Matchday${gd && isNum(gd.pos) ? ` · ${esc(clubName())} ${ordinal(gd.pos)} in Serie A` : ''}</div>
    <div class="cen-stamp">${gd ? `in-game date and table position · as of ${esc(gd.asof)}` : 'in-game date not captured'}</div>`;
  if (!m) return [c1 + '<p class="muted">No matches yet.</p>', ''];
  const { away, home, awy, r } = cenSides(m);
  c1 += `<div class="cen-pills"><a class="btn pri" href="#page=prematch">Pre-match plan</a></div>
    <nav class="cen-rows">
      ${cenRow(`#page=match&id=${encodeURIComponent(m.id)}&tab=debrief`, 'tactics', `Debrief: ${teamName(home[0])} ${home[1]}–${awy[1]} ${teamName(awy[0])}`, '5 steps')}
      ${cenRow('#page=match&id=' + encodeURIComponent(m.id), 'film', 'Watch Last Match', 'minimap replay', (matchData(m.id) || m).replay_v2 || (matchData(m.id) || m).replay ? `data-replay="${esc(m.id)}@0"` : '')}
      ${sell ? cenDirRow(sell) : ''}
    </nav>`;
  const c2 = `<div class="cen-kick">LAST MATCH</div>
    <div class="cen-fix"><span class="b">${badge(home[0], !away)}</span><span class="vl"></span><span class="b">${badge(awy[0], away)}</span>
      <span class="lines"><span>${esc(teamName(home[0]))} <i>${esc(home[1])}</i></span><span>${esc(teamName(awy[0]))} <i>${esc(awy[1])}</i></span></span>
      ${CEN_RES[r] ? `<b class="cen-res ${r}">${CEN_RES[r]}</b>` : ''}</div>
    ${cenForm(ms)}${window.STRK ? STRK.moment(m.id) : ''}
    <div class="cen-stamp">${away ? 'Away' : 'Home'} · Serie A · recorded ${esc(shortDate(m.day))}</div>
    <div class="cen-pills"><a class="btn" href="#page=match&id=${encodeURIComponent(m.id)}">Match Centre</a></div>`;
  return [c1, c2];
}
function centralLeft(ms) {
  const m = ms[ms.length - 1], gd = cenGameDate();
  const dir = latestWith(directorFor), sell = dir && (dir.v.sell_or_loan || [])[0];
  let out = `<div class="cen-date">${esc(gd ? gd.head : '')}</div>
    <div class="cen-sub">Matchday${gd && isNum(gd.pos) ? ` · ${esc(clubName())} ${ordinal(gd.pos)} in Serie A` : ''}</div>
    <div class="cen-stamp">${gd ? `in-game date and table position · as of ${esc(gd.asof)}` : 'in-game date not captured'}</div>`;
  if (!m) return out + '<p class="muted">No matches yet.</p>';
  const { away, home, awy, r } = cenSides(m);
  out += `<div class="cen-kick">LAST MATCH</div>
    <div class="cen-fix"><span class="b">${badge(home[0], !away)}</span><span class="vl"></span><span class="b">${badge(awy[0], away)}</span>
      <span class="lines"><span>${esc(teamName(home[0]))} <i>${esc(home[1])}</i></span><span>${esc(teamName(awy[0]))} <i>${esc(awy[1])}</i></span></span>
      ${CEN_RES[r] ? `<b class="cen-res ${r}">${CEN_RES[r]}</b>` : ''}</div>
    ${cenForm(ms)}${window.STRK ? STRK.moment(m.id) : ''}
    <div class="cen-stamp">${away ? 'Away' : 'Home'} · Serie A · recorded ${esc(shortDate(m.day))}</div>
    <div class="cen-pills"><a class="btn pri" href="#page=prematch">Pre-match plan</a><a class="btn" href="#page=match&id=${encodeURIComponent(m.id)}">Match Centre</a></div>
    <nav class="cen-rows">
      ${cenRow(`#page=match&id=${encodeURIComponent(m.id)}&tab=debrief`, 'tactics', `Debrief: ${teamName(home[0])} ${home[1]}–${awy[1]} ${teamName(awy[0])}`, '5 steps')}
      ${cenRow('#page=match&id=' + encodeURIComponent(m.id), 'film', 'Watch Last Match', 'minimap replay', (matchData(m.id) || m).replay_v2 || (matchData(m.id) || m).replay ? `data-replay="${esc(m.id)}@0"` : '')}
      ${sell ? cenDirRow(sell) : ''}
    </nav>`;
  return out;
}
// Director alert row (brief profile-minutes-central-alert section 4, Figma C2 250:9855): the Director's `short` when it is <= 40 chars
// AND the row label stays <= 32 visible characters (23 px in the 425 px label column); otherwise action + name ("Director: sell
// Kempf?"). Never cut mid-word (the label never ellipsises); the offer we read goes to the meta as data. No Director item: no row.
function cenDirRow(x) {
  const full = x.short && x.short.length <= 40 ? `Director: ${x.short}` : '';
  const act = String(x.action || 'sell').split(/\s+/)[0].toLowerCase();
  const label = full && full.length <= 32 ? full : `Director: ${act} ${x.name}?`;
  const b = window.YX && x.name ? YX.bestOffer(x.name) : null;
  const meta = b ? `${b.t.split(' · ')[0]} · ${b.word}` : '';
  return cenRow('#page=scouting&grp=sell', 'warning', label, meta, 'data-dir-alert="1"');
}
function cenCard(src, date, kick, body, isNew) {
  return `<article class="cen-card">${isNew ? '<span class="tagn">New</span>' : ''}
    <header><span class="mono">fc</span><span><b>${esc(src)}</b><small>${esc(date)}</small></span></header>
    <div class="cen-ck">${esc(kick)}</div>${body}</article>`;
}
const cenLines = rows => `<ul class="cen-lines">${rows.filter(Boolean).map(([ic, t, d]) => `<li>${cenIco(ic)}<span><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ''}</span></li>`).join('')}</ul>`;
function centralNews(ms, start = 0) {
  const pages = [], m = ms[ms.length - 1];
  const lc = latestWith(coachFor);
  if (lc) {
    const c = lc.v, first = id => ((c.sections || []).find(x => x.id === id) || { items: [] }).items[0];
    const pick = [['energy', first('p1')], ['duo', first('duo')], ['tactics', first('team')]].filter(x => x[1]).map(([ic, it]) => { const [t, d] = cenSplit(it.text); return [ic, it.short || t, cenCap(d)]; }); // `short` (<= 40 chars, copy editor) wins, else the lead clause
    pages.push(cenCard('FC Coach', `report · ${shortDate(lc.day)} session`, 'NEXT MATCH PLAN',
      `<div class="cen-big g">${esc(((c.tactics || {}).formation || 'Plan').toUpperCase())}</div>${cenLines(pick)}<div class="cen-foot">${(c.next_match || []).length}-step plan and targets in <a class="lnk" href="#page=prematch">Pre-match</a></div>`, true));
  }
  if (m) { const md = matchData(m.id) || m;   // QA report 3: page 2 no longer repeats the left column's last match: it previews the Debrief of that match
    const vPick = (typeof viewer === 'function' && viewer() === 'p2') ? 'p2' : 'p1';
    const ctArr = Array.isArray(md.controllers) ? md.controllers : Object.values(md.controllers || {});
    const ct = ctArr.find(c => c.marker === vPick) || ctArr.find(c => c.marker === 'p1');
    const o = (md.official_ft && !md.official_ft.FT ? md.official_ft : ((md.official_ft || md.official || {}).FT)) || {}, tw = o['Tackles Won'], tk = o['Tackles'];
    const fRt = factOf(m.id, 'ledger:sprint_chasing'), whoLbl = ct && ct.marker === 'p2' ? P2() : P1();
    const rtTxt = !ct || !isNum(ct.sprint_frac_defence) ? null : fRt && fRt.trust === 'blocked' ? null : `${whoLbl}: RT ${Math.round(ct.sprint_frac_defence * 100)}% while defending`;
    pages.push(cenCard('FC Coach', `debrief · ${shortDate(m.day)} session`, 'DEBRIEF',
      `<div class="cen-big">5 STEPS READY</div>${cenLines([[m.plan_check ? 'check' : 'tactics', 'Plan check', m.plan_check ? `${m.plan_check.kept || 0} of ${m.plan_check.n || 0} kept` : 'no plan yet for this match'],
        rtTxt ? ['energy', rtTxt, `this match · target ≤ 35%${fRt && fRt.trust === 'rough' && fRt.words ? ' · ' + fRt.words : ''}`] : null,
        tw && tk && tk[0] ? ['ball', `Tackles Won ${tw[0]} of ${tk[0]}`, `official Match Facts · ${teamName(m.ours || clubName())} · this match`] : null])}
       <div class="cen-foot"><a class="lnk" href="#page=match&id=${encodeURIComponent(m.id)}&tab=debrief">Open the Debrief</a></div>`, false));
  }
  const dr = latestWith(directorFor), sell = dr && (dr.v.sell_or_loan || [])[0];
  if (sell) {
    const p = playerByName(sell.name), tm = String(sell.evidence || '').match(/\[transfer(?:\s+(\d\d)\/(\d\d))?\]\s*([^;]*)/);
    const asof = tm && tm[1] ? `In-game offer · as of ${+tm[1]} ${cenMon(+tm[2] - 1)}` : 'In-game transfer desk';
    const offer = tm ? tm[3].split(',')[0].trim() : '';
    const [hl, why] = cenSplit(dr.v.headline);
    pages.push(cenCard('Director', `squad review · ${shortDate(dr.day)}`, 'DIRECTOR',
      `<div class="cen-face">${portrait(p || { name: sell.name }, 'L')}</div>
       <div class="cen-big">${esc(String(sell.action || 'sell').toUpperCase())}<br>${esc(String(sell.name).toUpperCase())}?</div>
       <div class="cen-sub2 warn">${esc(sell.short || cenSplit(sell.reason)[0])}</div>
       ${cenLines([offer ? ['scout', offer, asof] : null, why ? ['warning', cenCap(why), hl] : null])}
       <div class="cen-foot"><a class="lnk" href="#page=scouting">All decisions in Transfers › Director</a></div>`, false));
  }
  if (!pages.length) return '';
  const k = Math.min(Math.max(0, start | 0), pages.length - 1);
  return `<div class="cen-news" data-page="${k}">${pages.map((x, i) => `<div class="cen-pg${i === k ? ' on' : ''}">${x}</div>`).join('')}
    ${pages.length > 1 ? `<div class="cen-dots"><span class="gl">R</span>${pages.map((_, i) => `<button class="d${i === k ? ' on' : ''}" data-go="${i}" aria-label="Page ${i + 1}"></button>`).join('')}</div>` : ''}</div>`;
}
function cenGo(root, i) {
  const n = root.querySelector('.cen-news'); if (!n) return; const pg = n.querySelectorAll('.cen-pg'), k = ((i % pg.length) + pg.length) % pg.length;
  n.dataset.page = k; pg.forEach((x, j) => x.classList.toggle('on', j === k)); const ds = n.querySelectorAll('.cen-dots .d'); ds.forEach((x, j) => x.classList.toggle('on', j === k)); if (document.activeElement && document.activeElement.classList.contains('d')) ds[k].focus();
}
REG.hub = {
  title: () => 'Hub',
  render(S) {
    const ms = matchList(), [c1, c2] = centralCards(ms);
    return `<div class="central" data-grid="g5"><div class="cen-c cen-card1 cen-left">${c1}</div><div class="cen-c cen-card2 cen-left">${c2}</div><div class="cen-c cen-card3 cen-right">${centralNews(ms, ((S && +S.card) || 1) - 1)}</div></div>`;
  },
  after(S, root) {
    root.addEventListener('click', e => { const d = e.target.closest('.cen-dots .d'); if (d) cenGo(root, +d.dataset.go); });
    if (window.__cenKey) removeEventListener('keydown', window.__cenKey);
    window.__cenKey = e => {
      if (!document.body.contains(root) || document.querySelector('.rp2, .overlay.on')) return;
      if ((e.key === 'r' || e.key === 'R') && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) { const n = root.querySelector('.cen-news'); if (n) cenGo(root, +n.dataset.page + (e.shiftKey ? -1 : 1)); }
    };
    addEventListener('keydown', window.__cenKey);
    if (window.__cenArrows) removeEventListener('keydown', window.__cenArrows, true);
    if (window.__cenLR) removeEventListener('keydown', window.__cenLR, true);
    root.querySelectorAll('.cen-pg.on .cen-card, .cen-card').forEach(c => c.setAttribute('tabindex', '0'));
    if (window.GRID) return;
    window.__cenArrows = e => { if (S.page !== 'hub' || !/^Arrow(Up|Down)$/.test(e.key) || document.querySelector('.rp2, .overlay.on')) return;
      const list = [...root.querySelectorAll('.cen-pills a, .cen-rows a')], a = document.activeElement, i = list.indexOf(a);
      if (i < 0 && a && a !== document.body && !root.contains(a)) return;
      const n = e.key === 'ArrowDown' ? (i < 0 ? 0 : i + (i < 1 && list[1] && list[1].closest('.cen-pills') ? 2 : 1)) : (i <= 0 ? -1 : i - 1);
      if (n >= list.length) { e.preventDefault(); e.stopImmediatePropagation(); return; } if (n < 0) return; e.preventDefault(); e.stopImmediatePropagation(); list[n].focus(); };
    addEventListener('keydown', window.__cenArrows, true);
    root.querySelectorAll('.cen-pg.on .cen-card, .cen-card').forEach(c => c.setAttribute('tabindex', '0'));
    if (window.__cenLR) removeEventListener('keydown', window.__cenLR, true);
    window.__cenLR = e => { if (S.page !== 'hub' || !/^Arrow(Left|Right)$/.test(e.key)) return; const a = document.activeElement; if (e.key === 'ArrowRight' && a && a.closest('.cen-left')) { const c = root.querySelector('.cen-pg.on .cen-card'); if (c) { e.preventDefault(); e.stopImmediatePropagation(); c.focus(); } } else if (e.key === 'ArrowLeft' && a && a.closest('.cen-right')) { const r = root.querySelector('.cen-rows a, .cen-pills a'); if (r) { e.preventDefault(); e.stopImmediatePropagation(); r.focus(); } } };
    addEventListener('keydown', window.__cenLR, true);
  },
};
