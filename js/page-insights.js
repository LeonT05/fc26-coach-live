// ---------- Insights batch 1 (Peti's feedback): Coaching › Patterns + the profile Stats block ----------
// Data: window.FC26_INSIGHTS (docs/schemas/insights.schema.json). Every aggregate is an `agg` {n, matches, trust, basis, sample}.
// Pitch frame: x = 0 our goal → +x attack, y = 0 our left touchline; drawn on our vertical pitch (own goal at the bottom).
(function () {
  const I = () => window.FC26_INSIGHTS || null;
  const pct = v => isNum(v) ? Math.round(v * 100) + ' %' : '–';
  const est = a => a && a.trust === 'est' ? ' est.' : a && a.trust === 'ext' ? ' (ext.)' : '';
  const small = a => a && a.sample === 'small' ? `small sample (n=${a.n})` : '';
  const sub2 = (...xs) => xs.filter(Boolean).join(' · ');
  const row = (l, s, v, cls = '') => `<div class="mc-row"><span>${esc(l)}${s ? `<small>${esc(s)}</small>` : ''}</span>${v != null && v !== '' ? `<b class="${cls}">${esc(v)}</b>` : ''}</div>`;
  const pan = (t, body, cls = 'hug') => `<section class="mc-pan ${cls}"><h2 class="cen-kick">${esc(t)}</h2>${body}</section>`;
  const nm = a => a && a.trust === 'not_measurable';
  const LANES = ['left', 'centre', 'right'], THIRDS = ['def', 'mid', 'att'], TX = { def: [0, 35], mid: [35, 70], att: [70, 105] }, LY = { left: [0, 22.7], centre: [22.7, 45.3], right: [45.3, 68] };
  const THIRD_W = { def: 'our third', mid: 'middle third', att: 'their third' };
  const oppTeam = id => { const m = matchList().find(x => x.id === id); if (!m) return ''; const t = (m.teams || []).length ? m.teams : [m.ours, m.opp]; return teamName(t.find(c => c && c !== (m.ours || 'COM')) || m.opp || ''); };
  // 3 x 3 zone pitch with counts (upright labels), optional markers
  function zonePitch(counts, opts = {}) {
    const mx = Math.max(1, ...Object.values(counts)); let s = '', ov = '';
    for (const th of THIRDS) for (const ln of LANES) { const n = counts[th + '|' + ln] || 0, [x0, x1] = TX[th], [y0, y1] = LY[ln];
      if (n) s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${opts.col || '#E8894A'}" fill-opacity="${(.12 + .5 * n / mx).toFixed(2)}"/>`;
      if (n) { const [sx, sy] = pitchPt((x0 + x1) / 2, (y0 + y1) / 2); ov += `<text x="${sx.toFixed(1)}" y="${(sy + 2.2).toFixed(1)}" text-anchor="middle" style="font:700 6px var(--font-family-ui);fill:#FDFEFF">${n}</text>`; } }
    for (const x of [35, 70]) s += `<line x1="${x}" y1="0" x2="${x}" y2="68" stroke="rgba(214,224,232,.22)" stroke-width=".4" stroke-dasharray="1.5 1.2"/>`;
    for (const y of [22.7, 45.3]) s += `<line x1="0" y1="${y}" x2="105" y2="${y}" stroke="rgba(214,224,232,.22)" stroke-width=".4" stroke-dasharray="1.5 1.2"/>`;
    (opts.marks || []).forEach(m => { s += `<circle cx="${m.x}" cy="${m.y}" r="2.2" fill="${m.col || '#FF5A4E'}" stroke="#FDFEFF" stroke-width=".5"/>`; });
    return `<div class="ins-pitch">${pitchSVG(s, { overlay: ov, noArrow: true })}</div>`;
  }
  // ---------- Patterns tab: three Pattern Pitch Cards (Figma 5a 223:7825 / 5b 223:8169, brief patterns-whole-page-scroll) ----------
  // One question per card, a headline sentence, one vertical pitch (viz.js, own goal at the bottom), two label/value rows.
  // R switches the focused card's view, A opens its drill-down (a modal list that scrolls inside), X its method note.
  const PP = { view: [0, 0, 0], modal: null };
  const dash = '–';
  const teamsOf = id => { const m = matchList().find(x => x.id === id); return m ? ((m.teams || []).length ? m.teams : [m.home_team, m.away_team]) : []; };
  const ourGoals = D => (D.matches || []).reduce((a, mm) => { const m = typeof mm === 'object' ? mm : matchList().find(x => x.id === mm); const s = m && m.score_us_them; return a + (s && isNum(s[0]) ? s[0] : 0); }, 0);
  const pctOf = (a, b) => isNum(a) && b ? `${a} of ${b}` : dash;
  // vertical pitch with screen-space overlay (pitchPt maps pitch metres to the upright view)
  function vPitch(inner, overlay) { return `<div class="pp-pitch" data-nomin>${pitchSVG(inner, { overlay, noArrow: true })}</div>`; }
  const txt = (x, y, t, cls = 'pp-n') => { const [sx, sy] = pitchPt(x, y); return `<text class="${cls}" x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(String(t))}</text>`; };
  function zoneLayer(counts, col) {
    const mx = Math.max(1, ...Object.values(counts)); let s = '', ov = '';
    for (const th of THIRDS) for (const ln of LANES) { const n = counts[th + '|' + ln], [x0, x1] = TX[th], [y0, y1] = LY[ln];
      if (n == null) continue;
      s += `<rect x="${x0 + .2}" y="${y0 + .2}" width="${x1 - x0 - .4}" height="${y1 - y0 - .4}" fill="${col}" fill-opacity="${(.15 + .75 * n / mx).toFixed(2)}"/>`;
      ov += txt((x0 + x1) / 2, (y0 + y1) / 2, n); }
    return [s, ov];
  }
  function cardShell(i, kick, views, head, subl, pitch, rows) {
    return `<article class="pp-card" tabindex="0" data-card="${i}" aria-label="${esc(kick)}: ${esc(head)}">
      <header><span class="pp-kick">${esc(kick)}</span><nav class="pp-views r2tabs" aria-label="Switch view (R)">${views.map((v, k) => `<a class="${k === PP.view[i] ? 'on' : ''}" data-view="${k}" tabindex="-1">${esc(v)}</a>`).join('')}</nav></header>
      <h3>${esc(head)}</h3><p class="pp-sub">${esc(subl)}</p>${pitch}
      <div class="pp-rows">${rows.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div></article>`;
  }
  function cardScore(D) {
    const c = D.conceded || {}, goals = c.goals || [], sm = c.summary || {}, os = c.opp_shots_by_channel || {}, ob = c.opp_box_entries_by_channel || {};
    const n = goals.length, cen = goals.filter(g => g.shot && g.shot.lane === 'centre').length, located = goals.filter(g => g.shot).length;
    const seen = isNum(sm.observed) ? sm.observed : goals.filter(g => g.observed).length;
    const subl = [n ? `${cen} of ${located} shot from the centre` : 'no goals conceded', `${D.n_matches} matches`, 'est.'].join(' · ');
    let pitch;
    if (PP.view[0] === 0) {
      const dots = goals.filter(g => g.shot).map(g => { const [sx, sy] = pitchPt(g.shot.x, g.shot.y); return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="1.5" class="pp-shot${g.observed ? ' seen' : ''}"/>`; }).join('');
      pitch = located ? vPitch('', dots) : `<div class="pp-pitch" data-nomin>${pitchSVG('', { noArrow: true })}<p class="empty-note">Not captured yet</p></div>`;
    } else {
      const cnt = ob.counts || {}; const z = {}; LANES.forEach(l => { z['def|' + l] = cnt[l] || 0; });
      const [s, ov] = zoneLayer(z, 'var(--color-rating-low)'); pitch = vPitch(s, ov);
    }
    return cardShell(0, 'WHERE THEY SCORE', ['Shots', 'Box entries'], `${n} goal${n === 1 ? '' : 's'} conceded`, subl, pitch,
      [['Build-up seen', n ? `${seen} of ${n} goals` : dash], ['Their shots from the centre', isNum((os.counts || {}).centre) ? pctOf(os.counts.centre, os.n) : dash]]);
  }
  function cardLose(D) {
    const L = D.losses || {}, gd = L.grid || {}, cells = gd.cells || {}, bt = (L.by_type || {}).counts || {};
    const z = {}; Object.entries(cells).forEach(([k, v]) => { z[k] = v.total || 0; });
    const top = Object.entries(z).sort((a, b) => b[1] - a[1])[0];
    const TW = { def: 'defence', mid: 'midfield', att: 'attack' };
    const subl = [top ? `Most in ${TW[top[0].split('|')[0]]}, ${top[0].split('|')[1]} (${top[1]})` : 'not located yet', `${D.n_matches} matches`, 'est.'].join(' · ');
    let pitch;
    if (!gd.n) pitch = `<div class="pp-pitch" data-nomin>${pitchSVG('', { noArrow: true })}<p class="empty-note">Not captured yet</p></div>`;
    else if (PP.view[1] === 0) { const [s, ov] = zoneLayer(z, 'var(--color-fog-warm)'); pitch = vPitch(s, ov); }
    else {
      const named = (L.by_player || []).filter(x => x.player).slice(0, 8), un = (L.by_player || []).filter(x => !x.player).reduce((a, x) => a + x.n, 0);
      pitch = `<div class="pp-who">${named.length ? named.map(x => `<div><span>${esc(x.player)}</span><b>${x.n}</b></div>`).join('') : ''}${un ? `<p class="empty-note">${un} of ${gd.n} losses not attributed to a player (minimap names too uncertain)</p>` : ''}</div>`;
    }
    return cardShell(1, 'WHERE WE LOSE IT', ['Zones', 'Who'], `${gd.n || 0} ball losses`, subl, pitch,
      [['Lost on the ball', isNum(bt.lost_on_ball) ? String(bt.lost_on_ball) : dash], ['Misplaced pass', isNum(bt.misplaced_pass) ? String(bt.misplaced_pass) : dash]]);
  }
  function cardProgress(D) {
    const R = D.routes || {}, ln = R.lanes || {}, tot = R.total || {}, g = l => ln[l] || {};
    const traced = LANES.reduce((a, l) => a + (g(l).goals || 0), 0), og = ourGoals(D);
    const subl = [tot.n ? `Centre: ${g('centre').box || 0} box entries, ${g('centre').goals || 0} traced goals` : 'no attacks tracked yet', `${D.n_matches} matches`, 'est.'].join(' · ');
    let pitch;
    if (!tot.n) pitch = `<div class="pp-pitch" data-nomin>${pitchSVG('', { noArrow: true })}<p class="empty-note">Not captured yet</p></div>`;
    else if (PP.view[2] === 0) {
      const mx = Math.max(1, ...LANES.map(l => g(l).chains || 0)); let s = '', ov = '';
      LANES.forEach(l => { const [y0, y1] = LY[l], n = g(l).chains || 0; s += `<rect x="52.5" y="${y0 + .2}" width="52.5" height="${y1 - y0 - .4}" fill="#fff" fill-opacity="${(.04 + .2 * n / mx).toFixed(2)}"/>`;
        ov += txt(84, (y0 + y1) / 2, n, 'pp-lane-n') + txt(79.6, (y0 + y1) / 2, 'attacks', 'pp-lane-n') + txt(75.2, (y0 + y1) / 2, `${g(l).box || 0} box`, 'pp-lane-s') + txt(71.4, (y0 + y1) / 2, `${g(l).goals || 0} goals`, 'pp-lane-s'); });
      pitch = vPitch(s, ov);
    } else {
      pitch = `<div class="pp-who">${LANES.map(l => { const inv = (g(l).involved || []).filter(x => x.player); return `<div><span>${l.charAt(0).toUpperCase() + l.slice(1)}</span><b>${inv.length ? esc(inv.map(x => `${x.player} ${x.chains}`).join(' · ')) : dash}</b></div>`; }).join('')}</div>`;
    }
    return cardShell(2, 'WHERE WE PROGRESS', ['Lanes', 'Who'], `${tot.n || 0} attacks`, subl, pitch,
      [['Box entries left · centre · right', tot.n ? LANES.map(l => g(l).box || 0).join(' · ') : dash], ['Goals traced to an attack', tot.n ? `${traced} of our ${og} · est.` : dash]]);
  }
  // ---------- drill-downs (Pattern Drill-down 223:7737: modal list, scrolls inside) ----------
  function drill(i) {
    const D = I(); if (!D) return null;
    if (i === 0) {
      const c = D.conceded || {}, goals = (c.goals || []).slice(), sm = c.summary || {};
      const rows = goals.map(g => { const t = teamsOf(g.match), sc = String(g.score || '').replace('-', '–');
        const rs = String(g.reason || 'minimap hidden').replace(/ of play before the goal$/, ''), fa = g.final_action && g.final_action !== 'unknown' ? g.final_action.replace(/_/g, ' ') : '';
        const why = g.observed ? `Seen: ${[g.channel ? `in down ${g.channel === 'centre' ? 'the centre' : 'our ' + g.channel}` : '', fa].filter(Boolean).join(', ')}` : /^build-up not seen/i.test(rs) ? rs.charAt(0).toUpperCase() + rs.slice(1) : `Not seen: ${rs}`;
        const meta = sub2(why, g.shot ? `shot ${Math.round(g.shot.dist_m)} m, ${g.shot.lane}` : '', g.shot && isNum(g.shot.xg) ? `xG ${g.shot.xg.toFixed(2)} est.` : '');
        return { t: `${Math.floor(g.minute)}' · ${t[0] || ''} ${sc} ${t[1] || ''}`.replace(/\s+/g, ' '), m: meta, v: g.observed ? 'seen' : 'not seen', h: `#page=match&id=${encodeURIComponent(g.match)}` }; });
      return { title: `Conceded · ${goals.length} goal${goals.length === 1 ? '' : 's'}`, sub: 'Shot spot from the radar · build-up from the minimap · est.', rows,
        foot: `Official score and minute · ${sm.observed ?? goals.filter(g => g.observed).length} of ${goals.length} build-ups seen${goals.length < 10 ? ' (sample small)' : ''}`,
        note: `Goals: the official score and minute. Shot spot: the radar position of the last shot (est.). Build-up: seen only when the minimap was on screen before the goal. ${(c.opp_shots_by_channel || {}).basis || ''}` };
    }
    if (i === 1) {
      const L = D.losses || {}, gd = L.grid || {}, cells = gd.cells || {}, TW = { def: 'Our third', mid: 'Middle third', att: 'Their third' };
      const rows = Object.entries(cells).sort((a, b) => (b[1].total || 0) - (a[1].total || 0)).map(([k, v]) => ({ t: `${TW[k.split('|')[0]]}, ${k.split('|')[1]}`,
        m: sub2(v.lost_on_ball ? `lost on the ball ${v.lost_on_ball}` : '', v.misplaced_pass ? `misplaced pass ${v.misplaced_pass}` : '', v.clearance_long ? `clearance ${v.clearance_long}` : '', v.unknown ? `type not seen ${v.unknown}` : ''), v: String(v.total || 0) }));
      return { title: `Ball losses · ${gd.n || 0}`, sub: 'Where the ball changed hands on the minimap · est.', rows, foot: `${gd.basis || ''}`, note: `${gd.basis || ''}. Possession lost (official, all kinds) is on the Match Centre.` };
    }
    const R = D.routes || {}, ln = R.lanes || {}, tot = R.total || {};
    const rows = [];
    LANES.forEach(l => { const g = ln[l] || {}; rows.push({ t: `${l.charAt(0).toUpperCase() + l.slice(1)} · ${g.chains || 0} attacks`, m: sub2(`${g.f3 || 0} to the final third`, `${g.box || 0} to the box`, `${g.shots || 0} shots`, `${g.goals || 0} goals`, isNum(g.median_s_half_to_box) ? `halfway to box ${g.median_s_half_to_box.toFixed(1)} s` : ''), v: String(g.chains || 0) });
      const inv = (g.involved || []).filter(x => x.player); if (inv.length) rows.push({ t: `Involved, ${l}`, m: inv.map(x => `${x.player} ${x.chains}`).join(' · '), v: '' }); });
    return { title: `Attacking routes · ${tot.n || 0} attacks`, sub: 'Chains on the minimap, lane at their furthest point · est.', rows, foot: tot.basis || '', note: `${tot.basis || ''}. A goal is traced when the attack that ended in it was on the minimap.` };
  }
  function modalOpen(html, origin) {
    modalClose(true);
    const el = document.createElement('div'); el.className = 'pk-modal pp-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = html; document.body.appendChild(el); PP.modal = { el, origin };
    el.addEventListener('click', e => { if (e.target === el) { modalClose(); return; } const r = e.target.closest('.dl-row[data-href]'); if (r) { e.preventDefault(); const h = r.dataset.href; modalClose(true); location.hash = h.slice(1); } });
    const f = el.querySelector('.dl-row') || el.querySelector('.pk-win'); if (f) { if (!f.classList.contains('dl-row')) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); if (document.documentElement.dataset.input === 'pad') f.classList.add('gp-focus'); }
    try { prompts(); } catch (e) { /* */ }
  }
  function modalClose(silent) {
    if (!PP.modal) return; const { el, origin } = PP.modal; el.remove(); PP.modal = null;
    if (!silent && origin && origin.isConnected) { origin.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); }
    try { prompts(); } catch (e) { /* */ }
  }
  function openDrill(i, origin) {
    const d = drill(i); if (!d) return;
    modalOpen(`<div class="pk-win pp-win"><h2>${esc(d.title)}</h2><p class="pp-msub">${esc(d.sub)}</p>
      <div class="pk-list fc-scroll">${d.rows.length ? d.rows.map(r => `<a class="dl-row" ${r.h ? `href="${r.h}" data-href="${r.h}"` : 'tabindex="0"'}><span class="qt"><b>${esc(r.t)}</b><small>${esc(r.m)}</small></span><span class="pk-ov">${esc(r.v)}</span></a>`).join('') : '<p class="empty-note">Nothing captured yet</p>'}</div>
      <p class="pp-foot">${esc(d.foot)}</p></div>`, origin);
  }
  function openNote(i, origin) {
    const d = drill(i); if (!d) return;
    modalOpen(`<div class="pk-win pp-win pp-note"><h2>${esc(['Where they score', 'Where we lose it', 'Where we progress'][i])} · method</h2><p class="pp-msub">${esc(d.note)}</p></div>`, origin);
  }
  const focusedCard = () => { const a = document.activeElement; return a && a.closest ? a.closest('.pp-card') : null; };
  function redrawCard(i) {
    const D = I(), old = document.querySelector(`#main .pp-card[data-card="${i}"]`); if (!D || !old) return;
    const had = document.activeElement === old, wrap = document.createElement('div'); wrap.innerHTML = [cardScore, cardLose, cardProgress][i](D);
    const nu = wrap.firstElementChild; old.replaceWith(nu); if (had) { nu.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); }
  }
  window.patternsEarly = () => { const D = I(); return D && D.early ? `Early: ${D.n_matches} matches so far · patterns fill up over ${(D.thresholds || {}).early_matches || 10} matches` : ''; };
  window.patternsView = function () {
    const D = I(); if (!D) return '<div class="pp-cards"><p class="empty-note">No insights file yet: it is written when the session is processed.</p></div>';
    return `<div class="pp-cards" data-grid="g2">${cardScore(D)}${cardLose(D)}${cardProgress(D)}</div>`;
  };
  // mouse: the view names inside a card switch it; a click on a card = A (Details)
  document.addEventListener('click', e => {
    const v = e.target.closest('#main .pp-card .pp-views a'); if (v) { const c = v.closest('.pp-card'), i = +c.dataset.card; PP.view[i] = +v.dataset.view; redrawCard(i); return; }
    const c = e.target.closest('#main .pp-card'); if (c) openDrill(+c.dataset.card, c);
  });
  // Pad map (brief §4): page = A Details · B Back · LT RT Sub-tab · X More info · R Switch View; modal = A Open match · B Close · R Scroll
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.patterns = {
    z: 1,
    active: () => typeof S === 'object' && S.page === 'findings' && !PP.modal && !!document.querySelector('#main .pp-cards'),
    prompts: () => [['A', 'Details'], ['LTRT', 'Tab'], ['X', 'More info'], ['Y', 'Search'], ['R', 'Switch View']],
    press(k) {
      const c = focusedCard() || document.querySelector('#main .pp-card'); if (!c) return false; const i = +c.dataset.card;
      if (k === 'A') { openDrill(i, c); return true; }
      if (k === 'X') { openNote(i, c); return true; }
      if (k === 'R') { PP.view[i] = (PP.view[i] + 1) % 2; c.focus({ preventScroll: true }); redrawCard(i); return true; }
      if (k === 'UP' || k === 'DOWN') return true;   // the sub-tabs are triggers (LT/RT), not D-pad targets
      if (k === 'LEFT' || k === 'RIGHT') { const cs = [...document.querySelectorAll('#main .pp-card')], j = cs.indexOf(c) + (k === 'RIGHT' ? 1 : -1); if (cs[j]) { cs[j].focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } return true; }
      return false;
    },
  };
  window.PAD_HOOKS.patternsModal = {
    z: 5,
    active: () => !!PP.modal,
    prompts: () => PP.modal && PP.modal.el.querySelector('.dl-row[data-href]') ? [['A', 'Open match'], ['B', 'Close'], ['RS', 'Scroll']] : [['B', 'Close'], ...(PP.modal && PP.modal.el.querySelector('.dl-row') ? [['RS', 'Scroll']] : [])],
    press(k) {
      const rs = [...PP.modal.el.querySelectorAll('.dl-row')], i = rs.indexOf(document.activeElement);
      if (k === 'UP' || k === 'DOWN') { const r = rs[Math.max(0, Math.min(rs.length - 1, (i < 0 ? 0 : i + (k === 'DOWN' ? 1 : -1))))]; if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest' }); if (document.documentElement.dataset.input === 'pad') { document.querySelectorAll('.gp-focus').forEach(x => x.classList.remove('gp-focus')); r.classList.add('gp-focus'); } } return true; }
      if (k === 'A') { const r = rs[i]; if (r && r.dataset.href) { const h = r.dataset.href; modalClose(true); location.hash = h.slice(1); } return true; }
      if (k === 'B') { modalClose(); return true; }
      return true;
    },
    scrollTarget: () => PP.modal && PP.modal.el.querySelector('.pk-list'),
  };
  addEventListener('hashchange', () => { if (PP.modal) modalClose(true); });
  REG.findings.after = (function (prev) { return function (S, root) { if (prev) prev.apply(this, arguments); if (S.tab === 'patterns') { const f = root.querySelector('.pp-card'); if (f && !window.__viewRender) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body || !document.activeElement.closest('#main')) { f.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } }, 0); } }; })(REG.findings.after);

  // ---------- Profile Stats block ----------
  window.insightStats = function (p, asParts) {
    const D = I(); if (!D) return '';
    const x = (D.players || []).find(q => q.pid === p.id || fold(q.name) === fold(p.name)); if (!x) return '';
    const o = x.official || {}, e = x.est || {}, gk = x.gk;
    const v = (val, f = String) => isNum(val) ? f(val) : null;
    let a = row('Apps · minutes', o.minutes_trust === 'est' ? (isNum(o.minutes_official ?? o.ga_per90_minutes) && ((o.minutes_official_matches ?? o.ga_per90_matches) || 0) > 0 ? `${o.minutes_official ?? o.ga_per90_minutes} official (${(o.minutes_official_matches ?? o.ga_per90_matches) || 0} of ${o.apps ?? '?'} matches read), the rest from line-up + substitutions` : 'minutes from line-up + substitutions (est.)') : 'official', `${o.apps ?? '–'} · ${o.minutes ?? o.minutes_est ?? '–'}${o.minutes_trust === 'est' && (o.minutes ?? o.minutes_est) != null ? ' est.' : ''}`)
      + row('Goals + assists per 90', isNum(o.ga_per90) ? sub2('derived from official goals, assists and minutes', o.ga_per90_minutes ? `${o.ga_per90_minutes} min` : '') : 'needs the Player Performance screen with goals and assists', v(o.ga_per90, n => n.toFixed(2)))
      + row('Goals · assists', (o.goals_matches ? `${o.goals_matches} match${o.goals_matches === 1 ? '' : 'es'} read` : 'not read from the game yet') + ((o.goals_inferred_matches || o.assists_inferred_matches) ? ` · ${[o.goals_inferred_matches ? 'goal' : '', o.assists_inferred_matches ? 'assist' : ''].filter(Boolean).join(' and ')} cell unreadable, filled from the team total` : ''), o.goals == null && o.assists == null ? null : `${o.goals ?? '–'} · ${o.assists ?? '–'}`)
      + (isNum(o.shots) ? row('Shots · accuracy', 'Player Performance', `${o.shots} · ${pct(o.shot_accuracy)}`) : '')
      + (isNum(o.pass_accuracy) ? row('Pass accuracy', isNum(o.passes) ? `${o.passes} passes` : '', pct(o.pass_accuracy)) : '')
      + (isNum(o.tackles) ? row('Tackles · success', '', `${o.tackles} · ${pct(o.tackle_success)}`) : '')
      + (isNum(o.avg_rating) ? row('Avg rating', sub2(`${o.ratings_n || 1} rated match${(o.ratings_n || 1) === 1 ? '' : 'es'}`, small(o)), o.avg_rating.toFixed(1)) : '');
    const sh = e.shots || {}, ch = e.chances || {}, lo = e.losses || {}, rg = e.regains || {}, at = e.assist_types || {};
    const zones = z => Object.entries(z || {}).map(([k, n]) => `${THIRD_W[k.split('|')[0]] || k} ${k.split('|')[1] || ''} ${n}`).join(' · ');
    let b = '';
    if (sh.n) b += row('Shots inside / outside the box', sub2(small(sh), sh.unlocated ? `${sh.unlocated} not located` : ''), `${sh.inside_box} / ${sh.outside_box} est.`) + (isNum(sh.median_dist_m) ? row('Median shot distance', small(sh), `${Math.round(sh.median_dist_m)} m est.`) : '');
    if (ch.n) b += row('Chances', 'shots and touches in their box', `${ch.n} est.`);
    if (lo.n) b += row('Losses by zone', sub2(zones(lo.by_zone), small(lo)), `${lo.n} est.`);
    if (rg.n) b += row('Regains by zone', sub2(zones(rg.by_zone), small(rg)), `${rg.n} est.`);
    b += row('Assist types', at.n ? Object.entries(at.counts || {}).map(([k, n]) => `${k.replace(/_/g, ' ')} ${n}`).join(' · ') : 'none seen yet (needs a goal whose build-up was on the minimap)', at.n ? `${at.n} est.` : null);
    const fl = (e.identity || {}).flagged_low_identity || {}, nfl = (fl.shots || 0) + (fl.losses || 0) + (fl.regains || 0);
    if (nfl) b += `<p class="ins-cap">${nfl} more minimap event${nfl === 1 ? '' : 's'} may be his but the name read is too uncertain, so they are not counted.</p>`;
    let g = '';
    if (gk) { const di = gk.distribution || {}, wf = gk.weak_foot || {};
      g = row('Kicks out of play', sub2(`kicks and passes of 10 m or more on the minimap`, small(di)), di.n ? `${di.out_of_play} of ${di.n}${est(di)}` : null)
        + (isNum(wf.stars) ? row('Weak foot', wf.source_url ? `external base database (${String(wf.source_url).replace(/^https?:\/\//, '').split('/')[0]}${wf.fetched ? ', fetched ' + wf.fetched : ''})` : String(wf.basis || '').replace(/^external base database \((https?:\/\/)?([^/]+)[^,]*,\s*fetched ([\d-]+)\)$/, 'external base database ($2, fetched $3)'), `${wf.stars} stars`) : '')
        + row('Which foot he used', 'not measurable: the minimap doesn’t show which foot', null); }
    if (asParts) return { game: a, minimap: b, gk: g };
    return `<div class="mc3 co-flow ins-stats">${`<div class="mc-col">${pan('STATS · FROM THE GAME', a)}</div>`}<div class="mc-col">${pan('STATS · FROM THE MINIMAP (est.)', b || '<p class="mc-foot">Nothing located for him on the minimap yet.</p>')}</div>${g ? `<div class="mc-col">${pan('GOALKEEPER', g)}</div>` : ''}</div>`;
  };
})();
