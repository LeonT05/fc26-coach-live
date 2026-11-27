/* Youth and development (round 3, briefs docs/ui_changes/2026-11-24_{youth-academy-decisions, desk-summer-group,
   dev-plan-verdict, projected-ovr-range, promise-tracker}.md). Figma section 245:7667: T1 246:8080, T2 246:8561, T3 246:9074,
   T4 246:9407, P1 245:7669, P2 245:7872, P3 245:8124, P4 245:8324, P5 249:9710; parts in 239:2438.
   UX-10 (Leon 2026-11-24): no text dumps. Every data point is a label / value cell built from the structured fields of
   squad_planning.js (youth_readiness, projection_age, minutes_owed, devplan_verdicts, squad_contracts) and the director file;
   the only prose is one short reason line. Verdict words are code (export), never computed here. */
'use strict';
(function () {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SQ = () => window.FC26_SQUAD || {};
  const DIR = () => (typeof directorFor === 'function' ? latestWith(directorFor) : null);
  const key = n => fold(n);
  // BL-115: one name index (the Director writes "Gori", the youth list "L. Gori")
  const canon = n => { const ix = SQ().name_index || {}; return ix[key(n)] || n; };
  const same = (a, b) => !!a && !!b && key(canon(a)) === key(canon(b));
  const findBy = (arr, n) => (arr || []).find(r => same(r.name || r.player, n)) || null;
  const ready = n => findBy(SQ().youth_readiness, n);
  const dev = n => findBy(SQ().devplan_verdicts, n);
  const owed = n => findBy(SQ().minutes_owed, n);
  // Squad Hub contracts read: exact name, else the same surname when the read carries an initial ("S. Posch" for Posch)
  const contract = n => { const C = (SQ().squad_contracts || []).filter(r => isNum(r.contract_months) || isNum(r.age)); return C.find(r => same(r.name, n)) || C.find(r => /^[A-Za-z]\.?\s/.test(r.name) && key(String(r.name).replace(/^[A-Za-z]\.?\s+/, '')) === key(n)) || null; };
  const ext = n => { const ps = (window.FC26_EXTERNAL || {}).players || {}; return ps[n] || Object.values(ps).find(r => r && (key(r.id || '') === key(n) || key(r.display_name || '') === key(n))) || null; };
  // dates: the last YYYY-MM-DD in a src string -> "24 Nov"; a session id -> its in-game date
  const dOf = s => { const m = String(s || '').match(/(\d{4})-(\d\d)-(\d\d)(?!.*\d{4}-\d\d-\d\d)/); return m ? `${+m[3]} ${MON[+m[2] - 1]}` : ''; };
  const gameDateOf = s => { const m = String(s || '').match(/(\d{4}-\d\d-\d\d_\d{6})/), g = m && ((SQ().club || {}).session_game_dates || {})[m[1]]; const d = g && g.match(/(\d{4})-(\d\d)-(\d\d)/); return d ? `${+d[3]} ${MON[+d[2] - 1]}` : ''; };
  const rng = a => Array.isArray(a) && a.length === 2 && isNum(a[0]) ? (a[0] === a[1] ? `${a[0]}–${a[1]}` : `${a[0]}–${a[1]}`) : '–';
  const eur = v => !isNum(v) ? '–' : v >= 1e6 ? `€${+(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `€${+(v / 1e3).toFixed(1)}K` : v >= 1e3 ? `€${+(v / 1e3).toFixed(2)}K` : `€${v}`;
  const dirV = () => { const d = DIR(); return d ? d.v : {}; };
  const dirDay = () => { const d = DIR(); return d ? shortDate(d.day) : ''; };
  // the Director's entries that name a player (promote, develop, watch_list, promises)
  const dirNamed = n => { const v = dirV(); return { promote: findBy(v.promote, n), develop: findBy(v.develop, n), watch: findBy(v.watch_list, n), promise: findBy(v.promises, n), morale: findBy(v.contracts_morale, n) }; };
  // display name: the youth list's OCR spelling, corrected by the Director's name_raw when he gives one ("G. Mufioz" -> "G. Muñoz")
  function display(n) {
    const c = canon(n), raw = (dirNamed(c).promote || {}).name_raw, m = String(c).match(/^([A-Z])\.\s+(.*)$/);
    return raw && m ? `${m[1]}. ${raw}` : c;
  }
  const surname = n => String(display(n)).replace(/^[A-Z]\.\s+/, '');
  const VERD = { promote_now: 'Promote now', promote_summer: 'Promote in summer', keep_developing: 'Keep developing', release_candidate: 'Release candidate' };
  const GATE = 63;   // docs/kb/kb_squad_planning.md §3 (OVR >= 65, or >= 63 with a guaranteed 20' slot)
  const matchday = () => { const s = String((((dirV().shortlist || {}).as_of) || {}).matchday || ''); const m = s.match(/(\d+)\s*of\s*(\d+)/); return m ? { n: +m[1], of: +m[2] } : null; };

  // ---------- UI parts (UX-10 label / value cells) ----------
  // row = [label, value, { tone: 'good'|'warn'|'bad'|'est', trust: 'rough'|'est.'|'ext.', src, cls, attrs, focus }]
  function cells(rows, cls = '') {
    return `<div class="kvc ${cls}">${rows.filter(Boolean).map(([l, v, o = {}]) => {
      const tag = o.focus ? 'button type="button"' : 'div', end = o.focus ? 'button' : 'div';
      return `<${tag} class="kv-r${o.focus ? ' kv-f' : ''} ${o.cls || ''}" ${o.attrs || ''}><span class="k">${esc(l)}</span><b class="v ${o.tone || ''}">${v == null || v === '' ? '–' : v}${o.trust ? `<i class="tr">${esc(o.trust)}</i>` : ''}</b>${o.src ? `<small class="s">${esc(o.src)}</small>` : '<small class="s"></small>'}</${end}>`;
    }).join('')}</div>`;
  }
  const pill = (label, glyph, attrs = '', pri = false) => pri ? `<a class="btn pri" ${attrs}>${esc(label)}</a>` : `<a class="btn yx-gl" ${attrs}><span class="gl c">${esc(glyph)}</span>${esc(label)}</a>`;
  const head = (o) => `<header>${o.face}<div>${isNum(o.ovr) || o.pos ? `<div class="dd-ovr"><b>${fmt(o.ovr)}</b><i>|</i>${esc(o.pos || '')}</div>` : ''}${o.first ? `<div class="dd-first">${esc(o.first.toUpperCase())}</div>` : ''}<div class="dd-name">${esc(String(o.last || '').toUpperCase())}</div></div><span class="dd-tag yx-kind ${o.tone || ''}">${esc(o.kind)}</span></header>`;
  const sil = () => `<span class="dd-face">${portrait({ name: '' }, 'M')}</span>`;

  // ---------- projections (brief projected-ovr-range: a range, "rough", one click deep, never on list rows) ----------
  function projCells(r, focusAttrs) {
    const pa = (r && r.projection_age) || {}, a18 = pa.at_18, a21 = pa.at_21;
    if (!a18 && !a21) return `<div class="yx-proj none"><span class="k">Projected OVR</span><b class="v est">not enough data</b><small class="s">no weeks-per-point read</small></div>`;
    const one = (lab, a) => a ? `<span class="pj"><small>${lab}</small><b>${esc(rng(a.ovr_range))}</b><i class="tr">${esc(a.trust || 'rough')}</i></span>` : '';
    return `<button type="button" class="yx-proj" ${focusAttrs || ''}><span class="k">Projected OVR</span>${one('at 18', a18)}${one('at 21', a21)}<small class="s">How it is worked out</small></button>`;
  }
  // Projection Calculation popup (L3 242:2701; T2 246:8561): every input with its source and date, the result always "rough"
  const POP = { el: null, origin: null };
  function projPopup(name, origin) {
    const r = ready(name); if (!r) return;
    closePop(true);
    const pa = r.projection_age || {}, ys = (r.src || {}).youth, ps = (r.src || {}).plan, g = r.growth_seen;
    const rows = [
      ["Today's OVR", `${fmt(r.ovr)}`, { src: `youth list · latest read ${dOf(ys)}` }],
      ['Weeks per OVR point', isNum(r.weeks_per_ovr) ? `${r.weeks_per_ovr}` : null, { src: isNum(r.weeks_per_ovr) ? `Growth tab · as of ${dOf(ps)}` : 'not read' }],
      ['Age', isNum(r.age) ? `${r.age}` : null, { src: gameDateOf(ys) ? `in-game date ${gameDateOf(ys)}` : '' }],
      ['Cap', `POT ${rng(r.pot)}`, { trust: 'rough', src: 'scout range' }],
      g && isNum(g.delta) ? ['Growth seen', `+${g.delta} in ${g.weeks} wk`, { src: 'youth list reads' }] : null,
      pa.at_18 ? ['Projected OVR at 18', rng(pa.at_18.ovr_range), { tone: 'est', trust: 'rough', src: `${pa.at_18.weeks} wk ahead` }] : null,
      pa.at_21 ? ['Projected OVR at 21', rng(pa.at_21.ovr_range), { tone: 'est', trust: 'rough', src: `${pa.at_21.weeks} wk ahead` }] : null,
      ['On pace / behind', 'after 2 Growth-tab reads', { src: 'not enough data' }],
    ];
    const el = document.createElement('div'); el.className = 'pk-modal yx-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Projected OVR');
    el.innerHTML = `<div class="yx-pop" tabindex="-1"><h2>Projected OVR · ${esc(display(name))}</h2><p class="sub">A rough range, never one number.</p>${cells(rows, 'pop')}</div>`;
    el.addEventListener('click', e => { if (e.target === el) closePop(); });
    document.body.appendChild(el); POP.el = el; POP.origin = origin || document.activeElement;
    const w = el.querySelector('.yx-pop'); w.focus({ preventScroll: true });
    document.querySelectorAll('.gp-focus').forEach(x => x.classList.remove('gp-focus'));
    try { prompts(); } catch (e) { /* */ }
  }
  function closePop(silent) {
    if (!POP.el) return; POP.el.remove(); POP.el = null;
    if (!silent) { const o = POP.origin; if (o && o.isConnected) { o.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } try { prompts(); } catch (e) { /* */ } }
  }
  addEventListener('hashchange', () => closePop(true));

  // ---------- Academy list (Leon round 3: first-team U23s owed minutes + top-3 ceilings + anyone the Director names) ----------
  function academyRows() {
    const R = SQ().youth_readiness || [], out = [];
    (SQ().minutes_owed || []).filter(m => m.owed && isNum(m.age) && m.age <= 22).sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1))
      .forEach(m => out.push({ code: 'owed', name: m.name, label: `${m.name}: play him 20'+`, meta: `first team · XP ${m.match_xp}`, icon: 'warning', m }));
    const byCeil = R.slice().sort((a, b) => ((b.pot || [])[1] || 0) - ((a.pot || [])[1] || 0) || ((b.pot || [])[0] || 0) - ((a.pot || [])[0] || 0) || (b.ovr || 0) - (a.ovr || 0));
    const top3 = byCeil.slice(0, 3).map(r => r.name);
    const v = dirV(), named = [...(v.promote || []), ...(v.watch_list || [])].map(x => x.name).filter(n => n && ready(n)).map(n => ready(n).name);
    const pick = uniq([...top3, ...named]);
    const order = r => ({ promote_now: 0, promote_summer: 1, release_candidate: 2 }[r.verdict] ?? 3);
    pick.map(ready).sort((a, b) => order(a) - order(b) || (top3.includes(a.name) ? 0 : 1) - (top3.includes(b.name) ? 0 : 1) || ((b.pot || [])[1] || 0) - ((a.pot || [])[1] || 0) || ((b.pot || [])[0] || 0) - ((a.pot || [])[0] || 0))
      .forEach(r => out.push({ code: 'youth', name: r.name, label: `${display(r.name)}: ${String(VERD[r.verdict] || r.verdict).toLowerCase()}`, meta: `${fmt(r.ovr)} · POT ${rng(r.pot)}`, icon: 'training', r, top: top3.includes(r.name) }));
    return out.map((e, i) => Object.assign(e, { i: 'a' + i, kind: e.code }));
  }
  function ceilingHead(r) {
    const R = SQ().youth_readiness || [], of = r.ceiling_of || R.length, tied = R.filter(x => x.ceiling_rank === r.ceiling_rank).length;
    if (r.ceiling_rank === of) return `Lowest ceiling of the ${of}`;
    if (r.ceiling_rank === 1) return tied > 1 ? `Joint-highest ceiling of the ${of}` : `Highest ceiling of the ${of}`;
    return `Ceiling ${r.ceiling_rank} of ${of}`;
  }
  function youthCard(r, opts = {}) {
    const dn = dirNamed(r.name), dp = dn.promote, plan = (r.src || {}).plan, ys = (r.src || {}).youth;
    const agrees = dp && !(/promot/i.test(dp.action || '') && !/^promote/.test(r.verdict));   // BL-118: the Director's line only when it agrees
    const reason = agrees ? String(dp.reason || '').replace(/^Not yet:\s*/i, '') : (dn.watch ? dn.watch.what_to_watch : '');
    const short = GATE - (r.ovr || 0);
    const depth = (r.depth || []).slice(0, 3).map(d => `${esc(d.name)} ${fmt(d.ovr)}${isNum(d.age) ? ` <i class="ag">(${d.age})</i>` : ''}`).join(', ');
    const starter = (r.starters || [])[0] || (r.depth || [])[0];
    const cmp = starter ? `href="#page=squad&sel=${encodeURIComponent(starter.name)}&cmp=${encodeURIComponent(r.name)}"` : '';
    return `<article class="dd-card yx-card">${head({ face: sil(), ovr: r.ovr, pos: r.pos, last: surname(r.name), kind: String(VERD[r.verdict] || r.verdict).toUpperCase(), tone: 'teal' })}
      <h3>${esc(ceilingHead(r))}</h3>${reason ? `<p class="yx-why">${esc(reason)}</p>` : ''}
      ${cells([
        ['OVR', `${fmt(r.ovr)}`, { src: `youth list · ${dOf(ys)}` }],
        ['Pace of growth', isNum(r.weeks_per_ovr) ? `${r.weeks_per_ovr} wk / OVR pt` : 'not read', { tone: isNum(r.weeks_per_ovr) ? '' : 'est', src: isNum(r.weeks_per_ovr) ? `Growth tab · ${dOf(plan)}` : 'read the Growth tab' }],
        ['Potential', rng(r.pot), { trust: 'rough', src: 'scout range' }],
        ['Promotion gate', short > 0 ? `${short} short of ${GATE}` : `${GATE} reached`, { tone: short > 0 ? 'warn' : 'good', src: 'kb §3' }],
        [`Depth at ${r.pos || '–'}`, depth || 'position not read', { src: 'squad status' }],
      ])}
      ${projCells(r, `data-proj="${esc(r.name)}"`)}
      <div class="dd-btns">${pill('Open Player', 'A', `href="#page=youth&n=${encodeURIComponent(r.name)}"`, true)}${cmp ? pill('Compare', 'X', cmp) : ''}</div></article>`;
  }

  // ---------- one person's structured facts (Desk cards for seniors) ----------
  function minutesOf(p) {
    const I = (window.FC26_INSIGHTS || {}).players || [], x = I.find(q => (p.id && q.pid === p.id) || key(q.name) === key(p.name));
    const o = (x && x.official) || null;
    if (o && (isNum(o.minutes) || o.apps)) return { v: isNum(o.minutes) ? o.minutes : null, est: o.minutes_trust === 'est', read: o.minutes_official_matches || 0, of: o.apps || 0, official: o.minutes_official };
    const c = ((window.FC26_CAREER || {}).players || {})[p.name] || {};
    if (isNum(c.minutes)) return { v: c.minutes, est: false, read: p.apps, of: p.apps };
    return { v: isNum(c.minutes_known) && c.minutes_known > 0 ? c.minutes_known : null, est: true, read: c.minutes_known_apps || 0, of: p.apps || 0, official: c.minutes_known };
  }
  window.minutesOf = minutesOf;
  function bestOffer(n) {
    const T = (SQ().transfers || []).filter(t => same(t.player, n));
    const acc = T.find(t => t.kind === 'negotiation_row' && /accepted/i.test(t.status || '') && isNum(t.fee_eur));
    const offers = T.filter(t => t.kind === 'offer_received' && isNum(t.fee_eur));
    const club = acc ? (offers.find(o => o.fee_eur === acc.fee_eur && o.club) || {}).club : null;
    if (acc) { const o = offers.find(x => x.fee_eur === acc.fee_eur) || {}; return { t: `${club ? club + ' · ' : ''}${eur(acc.fee_eur)}`, word: 'accepted', date: o.date }; }
    const last = offers.slice(-1)[0]; return last ? { t: `${last.club ? last.club + ' · ' : ''}${eur(last.fee_eur)}`, word: 'offer', date: last.date } : null;
  }
  const ddmm = s => { const m = String(s || '').match(/^(\d\d)\/(\d\d)/); return m ? `${+m[1]} ${MON[+m[2] - 1]}` : ''; };
  function personCells(n, kind, extra) {
    const p = (typeof squadList === 'function' ? squadList() : playerList()).find(q => same(q.name, n)) || { name: n, apps: 0 };
    const c = contract(n), ow = owed(n), mi = p.name ? minutesOf(p) : null, cd = c ? `Squad Hub · ${dOf(c.src || '') || dOf((SQ().generated || ''))}` : '';
    const scDate = c && /(\d{4}-\d\d-\d\d)_/.test(c.src || '') ? shortDate(c.src.match(/(\d{4}-\d\d-\d\d)_/)[1]) : '';
    const rows = (extra || []).filter(Boolean);
    rows.push(['Age', isNum(p.age) ? `${p.age}` : isNum((c || {}).age) ? `${c.age}` : null, {}]);
    if (kind === 'keep' || kind === 'talk') rows.push(['Morale', (p.at || {}).morale || null, { tone: /unhappy/i.test((p.at || {}).morale || '') ? 'bad' : /happy/i.test((p.at || {}).morale || '') ? 'good' : '', src: 'squad status' }]);
    rows.push(['Contract left', c && isNum(c.contract_months) ? `${c.contract_months} months` : null, { tone: c && c.contract_months <= 18 ? 'warn' : '', src: c ? `Squad Hub · ${scDate}` : 'not read' }]);
    if (kind === 'develop' || kind === 'owed') { /* plan / minutes cards: age, contract, match XP, apps only */ } else if (kind === 'sell' || kind === 'loan') rows.push(['Value · wage', c ? `${eur(c.value_eur)} · ${eur(c.wage_eur_week)} / wk` : null, { src: c ? `Squad Hub · ${scDate}` : '' }]);
    if (kind === 'sell') { const b = bestOffer(n); rows.push(['Best offer', b ? `${esc(b.t)}` : 'none read', { tone: b && b.word === 'accepted' ? 'good' : '', trust: b ? b.word : '', src: b && b.date ? `in-game offer · ${ddmm(b.date)}` : '' }]); }
    if (ow && ow.owed) rows.push(['Match XP', ow.match_xp, { tone: 'bad', src: `Development Plans · ${dOf(ow.src)}` }]);
    rows.push(['Apps · minutes', `${p.apps || 0} · ${mi && isNum(mi.v) ? mi.v : '–'}`, { trust: mi && mi.est && isNum(mi.v) ? 'est.' : '', src: mi && mi.of ? `${mi.read} of ${mi.of} read · line-ups` : 'line-ups' }]);
    if (isNum(p.avg) && kind !== 'develop') rows.push(['Avg rating', p.avg.toFixed(1), { src: `${(p.form || []).length} rated · Match Ratings` }]);
    // UX-7: a row with nothing read is dropped, except the contract (its "not read" says what to capture)
    return { p, html: cells(rows.filter(r => r[1] != null || r[0] === 'Contract left').slice(0, 7)) };
  }
  // the senior face + header for a Desk card
  function seniorHead(n, kind, tone) {
    const L = typeof squadList === 'function' ? squadList() : playerList(), p = L.find(q => same(q.name, n)) || { name: n };
    const ex = ext(p.name || n), full = (ex && ex.display_name) || p.name || n, parts = String(full).split(' ');
    const last = parts.length > 1 ? parts.slice(-1)[0] : full, first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    return { p, html: head({ face: `<span class="dd-face">${portrait(p.id ? p : { name: '' }, 'M')}</span>`, ovr: p.ovr, pos: p.pos, first, last, kind, tone }) };
  }
  const openPlayer = p => { const q = typeof playerByName === 'function' ? playerByName(p.name) : null; return q && key(q.name) === key(p.name) ? `href="${plink(q)}"` : ''; };
  const cmpHref = p => { if (typeof squadPartners !== 'function' || !p.name) return ''; const pr = squadPartners(Object.assign({}, p)); return pr.names.length ? `href="#page=squad&sel=${encodeURIComponent(p.name)}&cmp=${encodeURIComponent(pr.names.join(','))}"` : ''; };
  function seniorCard(n, o) {
    const h = seniorHead(n, o.kind, o.tone), pc = personCells(n, o.cells, o.rows), ap = openPlayer(h.p), cp = cmpHref(h.p);
    return `<article class="dd-card yx-card">${h.html}<h3>${esc(o.title)}</h3>${o.why ? `<p class="yx-why">${esc(o.why)}</p>` : ''}${pc.html}
      <div class="dd-btns">${ap ? pill('Open Player', 'A', ap, true) : ''}${cp ? pill('Compare', 'X', cp) : ''}</div></article>`;
  }
  function owedCard(m) {
    return seniorCard(m.name, { kind: 'MINUTES OWED', tone: 'warn', title: "20' or more in each of the next 2 matches", why: "If he stays under 20' a match: loan him in summer with a Starter or Important role.", cells: 'owed',
      rows: [['Development bonus', m.dev_bonus || null, { tone: /high/i.test(m.dev_bonus || '') ? 'good' : '', src: `Development Plans · ${dOf(m.src)}` }]] });
  }

  // ---------- Summer (brief desk-summer-group: promote · renew · sell · loan together; a view over the same verdicts) ----------
  function summerRows(all) {
    const md = matchday();
    if (md && md.n < 30) return { rows: [], notes: ['Summer calls start at matchday 30'] };
    const out = [], seen = new Set(), add = e => { const k = key(canon(e.name)); if (seen.has(k)) return; seen.add(k); out.push(e); };
    const R = SQ().youth_readiness || [];
    R.filter(r => /^promote/.test(r.verdict)).forEach(r => add({ code: 'promote', name: r.name, label: `${display(r.name)}: ${VERD[r.verdict].toLowerCase()}`, meta: `${fmt(r.ovr)} · gate ${GATE}`, icon: 'star', r }));
    const L = typeof squadList === 'function' ? squadList() : playerList();
    (SQ().squad_contracts || []).filter(c => isNum(c.age) && c.age >= 18 && c.age <= 22 && isNum(c.contract_months) && c.contract_months <= 18 && L.some(p => same(p.name, c.name)))
      .forEach(c => add({ code: 'renew', name: L.find(p => same(p.name, c.name)).name, label: `${L.find(p => same(p.name, c.name)).name}: renew`, meta: `${c.age} · ${c.contract_months} months left`, icon: 'star', c }));
    (all || []).filter(e => e.kind === 'sell' && e.name).forEach(e => { const p = L.find(q => same(q.name, e.name)) || {}, b = bestOffer(e.name); add({ code: 'sell', name: e.name, label: `${e.name}: sell in summer`, meta: [isNum(p.age) ? p.age : '', b ? `${b.word} ${b.t.split(' · ')[0]}` : 'no offer read'].filter(x => x !== '').join(' · '), icon: 'warning', e }); });
    (all || []).filter(e => e.kind === 'loan' && e.name && (owed(e.name) || {}).owed).forEach(e => { const p = L.find(q => same(q.name, e.name)) || {}; add({ code: 'loan', name: e.name, label: `${e.name}: loan if under 20'`, meta: `${isNum(p.age) ? p.age + ' · ' : ''}minutes owed`, icon: 'energy', e }); });
    const notes = [];
    if (!out.some(e => e.code === 'promote')) {
      const best = R.filter(r => r.projection && Array.isArray(r.projection.ovr_range)).sort((a, b) => b.projection.ovr_range[1] - a.projection.ovr_range[1] || (b.ovr || 0) - (a.ovr || 0))[0];
      const at = best ? String(best.projection.at || '').replace(/^.*\((.*)\).*$/, '$1') : '';
      notes.push(best ? `Promote: nobody reaches ${GATE} by ${at || 'the window'} (closest: ${surname(best.name)} ${best.projection.ovr_range[1]})` : 'Promote: no academy reads yet');
    }
    return { rows: out.map((e, i) => Object.assign(e, { i: 's' + i, kind: e.code })), notes };
  }
  function renewCard(e) {
    const c = e.c, ex = ext(e.name), L = typeof squadList === 'function' ? squadList() : playerList(), p = L.find(q => same(q.name, e.name)) || { name: e.name, apps: 0 };
    const h = seniorHead(e.name, 'RENEW', 'teal'), mi = minutesOf(p), scDate = /(\d{4}-\d\d-\d\d)_/.test(c.src || '') ? shortDate(c.src.match(/(\d{4}-\d\d-\d\d)_/)[1]) : '';
    const rows = [
      ['Contract left', `${c.contract_months} months`, { tone: 'warn', src: `Squad Hub · ${scDate}` }],
      ['Age', `${c.age}`, { src: 'core band 18–22' }],
      ['Potential', ex && isNum(ex.potential) ? `${ex.potential}` : null, { trust: ex && isNum(ex.potential) ? 'ext.' : '', src: 'FC 26 base database' }],
      ['Wage', `${eur(c.wage_eur_week)} / wk`, { src: `Squad Hub · ${scDate}` }],
      ['Squad role', (c.data || {}).squad_role || null, { src: 'Squad Hub' }],
      ['Senior apps', `${p.apps || 0}${isNum(mi.v) ? ` · ${mi.v} min` : ''}`, { tone: p.apps ? '' : 'warn', trust: isNum(mi.v) && mi.est ? 'est.' : '', src: 'line-ups' }],
    ];
    return `<article class="dd-card yx-card">${h.html}<h3>Renew this summer</h3>${cells(rows)}
      <div class="dd-btns">${openPlayer(h.p) ? pill('Open Player', 'A', openPlayer(h.p), true) : ''}${cmpHref(h.p) ? pill('Compare', 'X', cmpHref(h.p)) : ''}</div></article>`;
  }

  // ---------- Develop group: only the players whose code verdict is "Switch" (Leon round 2), seniors ----------
  const slotsShort = a => { const s = (a || []).map(x => String(x).match(/^Slot (\d) (.+)$/)).filter(Boolean); if (!s.length) return ''; const pos = uniq(s.map(m => m[2])); return `Slot ${uniq(s.map(m => m[1])).join(' · ')} ${pos.join('/')}`; };
  function developRows() {
    return (SQ().devplan_verdicts || []).filter(v => v.group === 'senior' && v.verdict === 'switch' && v.fastest_slot_option)
      .map((v, i) => ({ i: 'v' + i, kind: 'develop', code: 'develop', name: v.name, label: `${v.name}: switch to ${v.fastest_slot_option.plan}`, meta: `${v.fastest_slot_option.weeks} wk to ${v.fastest_slot_option.next_ovr}`, icon: 'training', v }));
  }
  function developCard(e) {
    const v = e.v, f = v.fastest_slot_option, cur = (v.options || []).find(o => o.current) || { plan: v.current_plan }, rp = (v.options || []).find(o => o.plan === f.plan && o.role_path);
    const dd = (dirNamed(v.name).develop || {}), agrees = dd.plan && dd.plan === f.plan;
    return seniorCard(v.name, { kind: 'DEVELOP', tone: 'teal', title: `Switch to ${f.plan}`, why: agrees ? dd.reason : '', cells: 'develop',
      rows: ([
        ['Plan now', `${esc(cur.plan || '–')}${isNum(cur.weeks) ? ` · ${cur.weeks} wk` : ''}`, { src: `Growth tab · ${dOf((v.src || {}).options)}` }],
        ['Switch to', `${esc(f.plan)} · ${f.weeks} wk → ${f.next_ovr}`, { tone: 'good', src: 'code verdict' }],
        ['Slot role', esc(slotsShort(f.slots)), { src: 'saved slots' }],
        rp ? ['Role+ path', esc(f.plan), { src: 'kb' }] : null,
      ]) });
  }

  // ---------- Keep group: structured card (+ the open promise, brief promise-tracker) ----------
  function keepCard(e) {
    const pr = dirNamed(e.name).promise;
    return seniorCard(e.name, { kind: pr ? 'KEEP · PROMISE' : 'KEEP', tone: 'teal', title: e.title || e.label, why: e.body && e.body !== e.title ? e.body : '', cells: 'keep', rows: pr ? promiseRows(e.name) : [] });
  }
  // ---------- generic Director card for a person (Sell / Loan / Keep): reason line + structured cells, no evidence text ----------
  function directorCard(e, TAGW) {
    if (!e.name) return null;
    if (e.kind === 'keep' || e.kind === 'talk') return keepCard(e);
    return seniorCard(e.name, { kind: TAGW, tone: e.kind === 'sell' || e.kind === 'loan' ? 'warn' : 'teal', title: e.title || e.label, why: e.body && e.body !== e.title ? e.body : '', cells: e.kind });
  }

  // ---------- promise tracker (brief promise-tracker; Director promises[{name, promise, check}], tick = code vs line-ups) ----------
  function nextFixture() { const n = window.FC26_NEXT; return n && n.opponent ? { t: `${n.opponent} ${n.venue || ''}`.trim(), date: n.date } : null; }
  function promiseState(n) {
    const pr = dirNamed(n).promise; if (!pr) return null;
    const nx = nextFixture();
    return { pr, state: nx ? 'due' : 'open', due: nx ? nx.t : '' };
  }
  function promiseCells(n) { const r = promiseRows(n); return r.length ? cells(r, 'promise') : ''; }
  function promiseRows(n) {
    const s = promiseState(n); if (!s) return [];
    return ([
      ['Promise', esc(String(s.pr.promise).replace(/\s*\([^)]*\)\s*$/, '')), { src: `player chat · est. (OCR)` }],
      ['Check', esc(s.pr.check), { src: `director file · ${dirDay()}` }],
      ['Status', s.state === 'due' ? `due vs ${esc(s.due)}` : 'open', { tone: s.state === 'due' ? 'warn' : '', src: s.state === 'due' ? 'next fixture' : '' }],
    ]);
  }

  // ---------- DEVELOP line + Dev Plan Options Panel (brief dev-plan-verdict; Profile Line 239:2530, Plan Option Row 239:2478,
  // Dev Plan Options Panel 242:2700). Picking a plan is a what-if; "Save as our plan" stores a local to-do for the game's
  // Development Plans screen (localStorage fc26.ourplans). We never edit game settings. ----------
  const PLAN_KEY = 'fc26.ourplans';
  const loadPlans = () => { try { const o = JSON.parse(localStorage.getItem(PLAN_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const savePlans = o => { try { localStorage.setItem(PLAN_KEY, JSON.stringify(o)); } catch (e) { /* */ } };
  const DP = { name: null, open: false, whatif: null };
  const ranked = v => (v.options || []).slice().sort((a, b) => ((b.slot_roles || []).length ? 1 : 0) - ((a.slot_roles || []).length ? 1 : 0) || a.weeks - b.weeks);
  const optLine = o => `${o.plan} · ${o.weeks} wk to ${o.next_ovr ?? '–'}${(o.slot_roles || []).length ? ` · ${slotsShort(o.slot_roles)}` : ''}`;
  function lineOf(v) {
    if (!v) return { kind: 'DEVELOP', text: 'Read the Growth tab (no options captured)', muted: true };
    const opts = v.options || [], cur = opts.find(o => o.current), f = v.fastest_slot_option;
    const saved = loadPlans()[key(v.name)];
    if (DP.whatif && same(DP.name, v.name)) { const o = opts.find(x => x.plan === DP.whatif); if (o) return { kind: 'DEVELOP · WHAT-IF', text: optLine(o), whatif: true }; }   // "not saved" is said by the kind word (critic V-3)
    if (saved) { const o = opts.find(x => x.plan === saved.plan); return { kind: `OUR PLAN · saved ${shortDate(saved.at)}`, text: o ? optLine(o) : saved.plan, saved: true }; }
    if (v.verdict === 'keep' && cur) return { kind: 'DEVELOP', text: `Keep ${optLine(cur)}` };
    if (v.verdict === 'switch' && f) return { kind: 'DEVELOP', text: `Switch to ${f.plan} · ${f.weeks} wk to ${f.next_ovr}${(f.slots || []).length ? ` · ${slotsShort(f.slots)}` : ''}` };
    if (v.verdict === 'no_switch_pays_off') { const ws = opts.map(o => o.weeks).filter(isNum); return { kind: 'DEVELOP', text: `No switch pays off · every plan ${Math.min(...ws)}–${Math.max(...ws)} wk` }; }
    if (v.verdict === 'no_slot_role_plan' && cur) return { kind: 'DEVELOP', text: `No slot-role plan read · ${v.current_plan} ${cur.weeks} wk to ${cur.next_ovr}` };
    if (v.verdict === 'no_slot_role_plan') return { kind: 'DEVELOP', text: `No slot-role plan read · ${v.current_plan || '–'}` };
    return { kind: 'DEVELOP', text: 'Read the Growth tab (no options captured)', muted: true };
  }
  function optionsPanel(v) {
    const opts = ranked(v), cur = opts.find(o => o.current), wi = DP.whatif && opts.find(o => o.plan === DP.whatif);
    const focusPlan = wi ? wi.plan : v.verdict === 'switch' && v.fastest_slot_option ? v.fastest_slot_option.plan : cur ? cur.plan : (opts[0] || {}).plan;
    const fo = opts.find(o => o.plan === focusPlan) || {};
    const rp = fo.role_path ? ['Role+ path', `${esc(fo.plan)} = ${esc(slotsShort(fo.slot_roles))} role`, { tone: 'teal', src: 'kb' }] : null;
    const verdictWord = v.verdict === 'switch' && v.fastest_slot_option ? `Switch to ${v.fastest_slot_option.plan}` : v.verdict === 'keep' && cur ? `Keep ${cur.plan}` : v.verdict === 'no_switch_pays_off' ? 'No switch pays off' : 'No slot-role plan';
    const foot = wi && cur && wi.plan !== cur.plan ? ['Game plan', esc(cur.plan), { src: 'in the game' }] : ['Code verdict', esc(verdictWord), { src: 'code' }];
    const save = wi && cur && wi.plan !== cur.plan;
    return `<div class="pl-panel" aria-label="Development plans"><p class="pl-cap">Plans read · Growth tab · as of ${esc(dOf((v.src || {}).options))}</p>
      ${opts.length ? opts.map(o => `<button type="button" class="po-row${wi && wi.plan === o.plan ? ' wi' : ''}" data-plan="${esc(o.plan)}"${o.plan === focusPlan ? ' data-entry' : ''}><span class="pn">${esc(o.plan)}${o.current ? '<i>current</i>' : ''}</span><span class="pw">${o.weeks} wk</span><span class="po">to ${o.next_ovr ?? '–'}</span><span class="ps${(o.slot_roles || []).length ? ' on' : ''}">${(o.slot_roles || []).length ? esc(slotsShort(o.slot_roles)) : '–'}</span></button>`).join('') : '<p class="empty-note">No plan options read · read the Growth tab in the game</p>'}
      <div class="pl-foot">${cells([rp, foot])}${save ? `<a class="btn pri yx-y pl-save" href="#" data-save="1">Save as our plan</a>` : ''}</div></div>`;
  }
  function devLine(name) {
    const v = dev(name), L = lineOf(v), open = DP.open && same(DP.name, name) && v && (v.options || []).length;
    return `<div class="pl-host${open ? ' open' : ''}" data-n="${esc(name)}"><button type="button" class="pl-line${L.muted ? ' muted' : ''}${open ? ' exp' : ''}${L.whatif ? ' wif' : ''}" data-devline="1" aria-expanded="${open ? 'true' : 'false'}"><b>${esc(L.kind)}</b><span>${esc(L.text)}</span>${L.muted ? '' : '<i class="pl-chev" aria-hidden="true"></i>'}</button>${open ? optionsPanel(v) : ''}</div>`;
  }
  function redrawLine(focusSel) {
    const h = document.querySelector('#main .pl-host'); if (!h) return;
    const n = h.dataset.n, t = document.createElement('div'); t.innerHTML = devLine(n); h.replaceWith(t.firstElementChild);
    const pg = document.querySelector('#main .page'); if (pg) pg.classList.toggle('pl-open', DP.open);
    fitLines();
    const el = focusSel && document.querySelector('#main ' + focusSel);
    if (el) { el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); }
    try { prompts(); } catch (e) { /* */ }
  }
  function openPlans(name) { const v = dev(name); if (!v || !(v.options || []).length) return false; DP.name = name; DP.open = true; redrawLine('.po-row[data-entry]'); return true; }
  function closePlans() { DP.open = false; redrawLine('.pl-line'); }
  function tryPlan(plan) { const v = dev(DP.name), cur = ((v || {}).options || []).find(o => o.current); DP.whatif = cur && cur.plan === plan ? null : plan; redrawLine(`.po-row[data-plan="${CSS.escape(plan)}"]`); }
  function savePlan() {
    if (!DP.whatif) return false;
    const o = loadPlans(); o[key(DP.name)] = { name: DP.name, plan: DP.whatif, at: new Date().toISOString().slice(0, 10), kind: 'our plan: a to-do for the Development Plans screen, not a game setting' }; savePlans(o);
    const p = DP.whatif; DP.whatif = null; redrawLine(`.po-row[data-plan="${CSS.escape(p)}"]`); return true;
  }
  // the what-if lives while the profile is open; leaving the profile drops it (unless saved)
  addEventListener('hashchange', () => {
    const h = location.hash, m = h.match(/[#&](?:id|n)=([^&]+)/), id = m ? decodeURIComponent(m[1]) : '';
    const nm = /page=youth/.test(h) ? id : /page=player/.test(h) ? ((typeof playerById === 'function' && playerById(id)) || {}).name : '';
    if (!nm || !DP.name || !same(nm, DP.name)) { DP.open = false; DP.whatif = null; DP.name = null; }
  });
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('#main .pl-host');
    if (!t) { if (DP.open && e.target.closest && e.target.closest('#main')) closePlans(); return; }
    if (e.target.closest('[data-devline]')) { e.preventDefault(); if (DP.open) closePlans(); else openPlans(t.dataset.n); return; }
    const r = e.target.closest('.po-row'); if (r) { e.preventDefault(); tryPlan(r.dataset.plan); return; }
    if (e.target.closest('[data-save]')) { e.preventDefault(); savePlan(); }
  });
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  // Pad map (brief §4): line "A Show plans · B Back · Y Search"; expanded "A Try plan · B Close · Y Save as our plan"
  window.PAD_HOOKS.devplan = {
    z: 3,
    merge: () => !DP.open,   // grid brief: the line keeps the page's LT RT Tab · X Compare slots
    active: () => typeof S === 'object' && /^(player|youth)$/.test(S.page) && !!document.querySelector('#main .pl-host') && (DP.open || !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#main .pl-host'))),
    prompts() {
      if (DP.open) { const v = dev(DP.name), cur = ((v || {}).options || []).find(o => o.current); return [['A', 'Try plan'], ['B', 'Close'], ...(DP.whatif && cur && DP.whatif !== cur.plan ? [['Y', 'Save as our plan']] : [])]; }
      const l = document.querySelector('#main .pl-line'); return l && l.classList.contains('muted') ? [['B', 'Back'], ['Y', 'Search']] : [['A', 'Show plans'], ['B', 'Back'], ['Y', 'Search']];
    },
    press(k) {
      const a = document.activeElement;
      if (!DP.open) { if (k === 'A' && a && a.matches && a.matches('.pl-line')) { if (!a.classList.contains('muted')) openPlans(a.closest('.pl-host').dataset.n); return true; } return false; }
      const rs = [...document.querySelectorAll('#main .po-row')], i = rs.indexOf(a), sv = document.querySelector('#main .pl-save');
      const fx = el => { if (el) { el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } return true; };
      if (k === 'UP') return fx(a === sv ? rs[rs.length - 1] : rs[Math.max(0, i - 1)] || rs[0]);
      if (k === 'DOWN') return fx(i >= 0 && i < rs.length - 1 ? rs[i + 1] : sv || rs[rs.length - 1]);
      if (k === 'A') { if (i >= 0) { tryPlan(rs[i].dataset.plan); return true; } if (a === sv) { savePlan(); return true; } return true; }
      if (k === 'Y') { savePlan(); return true; }
      if (k === 'B') { closePlans(); return true; }
      return true;
    },
  };

  // ---------- minimal academy profile (Leon round 3; Figma P5 249:9710): no stats tabs, the plan options and the academy card ----------
  REG.youth = {
    title: S => display(S.n || ''),
    render(S) {
      const r = ready(S.n || ''); if (!r) return `<a class="crumb" href="#page=scouting&grp=academy">${ICON.back} Academy</a><div class="tile"><p class="muted">Academy player not found.</p></div>`;
      const pa = r.projection_age || {}, ys = (r.src || {}).youth, plan = (r.src || {}).plan, dn = dirNamed(r.name);
      const row = (academyRows().find(e => same(e.name, r.name)) || {}).i;
      const dsrc = { src: `director file · ${dirDay()}` };
      const dcall = dn.promote ? esc(dn.promote.short || dn.promote.action) : dn.watch ? 'on his watch list' : 'none on him yet';
      const projRow = (lab, a) => a ? [lab, esc(rng(a.ovr_range)), { tone: 'est', trust: a.trust || 'rough', src: `${a.weeks} wk ahead`, focus: true, attrs: `data-proj="${esc(r.name)}"` }] : [lab, null, { src: 'not enough data' }];
      const short = GATE - (r.ovr || 0);
      return `<div class="yp"><a class="crumb" href="#page=scouting&grp=academy${row ? '&d=' + row : ''}">${ICON.back} Academy</a>
        <div class="yp-grid"><section class="yp-head"><div class="yp-id"><span class="yp-ph">${portrait({ name: '' }, 'L')}</span><div><div class="ovl">${fmt(r.ovr)}<span>| ${esc(r.pos || '–')}</span></div><div class="pnm">${esc(surname(r.name).toUpperCase())}</div></div></div>${devLine(r.name)}</section>
        <section class="yp-card"><h2>Academy · age ${fmt(r.age)}</h2>${cells([
          ['OVR', `${fmt(r.ovr)}`, { src: `youth list · latest read ${dOf(ys)}` }],
          ['Weeks per OVR point', isNum(r.weeks_per_ovr) ? `${r.weeks_per_ovr}` : null, { src: isNum(r.weeks_per_ovr) ? `Growth tab · as of ${dOf(plan)}` : 'not read' }],
          ['POT', rng(r.pot), { trust: 'rough', src: 'scout range' }],
          projRow('Projected OVR at 18', pa.at_18), projRow('Projected OVR at 21', pa.at_21),
          ['Academy verdict', esc(VERD[r.verdict] || r.verdict), { src: short > 0 ? `code · ${r.ovr} is below the ${GATE} gate` : 'code' }],
          ["Director's call", dcall, dsrc],
        ], 'yp-rows')}</section></div></div>`;
    },
    after(S, root) {
      const l = root.querySelector('.pl-line'); if (l && !window.__viewRender) setTimeout(() => { const a = document.activeElement; if (!a || a === document.body || !a.closest('#main')) { l.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); try { prompts(); } catch (e) { /* */ } } }, 0);
      const pg = root.closest('.page') || root; pg.classList.toggle('pl-open', DP.open);
    },
  };
  PARENT.youth = 'scouting';

  // ---------- PROMISE line (brief promise-tracker; Profile Line 239:2530 Kind PROMISE, P3 245:8124) ----------
  // The promise is the Director's structured promises[{name, promise, check}]; the state is code: "due" while a next fixture is
  // known (nextmatch.js). kept / broken need the official line-up of the following match against `check`: not exported yet
  // (BL-119), so the line never claims them. Hidden when there is no open promise.
  function promiseLine(n) {
    const s = promiseState(n); if (!s) return '';
    return `<div class="pr-host"><button type="button" class="pl-line pr-line" data-promise="${esc(n)}"><b>PROMISE</b><span>${esc(s.pr.check)}${s.state === 'due' ? ` · due vs ${esc(s.due)}` : ''}</span>${s.state === 'due' ? '<i class="pr-ic due" aria-label="due"></i>' : ''}</button></div>`;
  }
  function promisePopup(n, origin) {
    const s = promiseState(n); if (!s) return;
    const chats = ((SQ().chat_list || {})[canon(n)] || (SQ().chat_list || {})[n] || []), last = chats.slice(-1)[0];
    const nx = window.FC26_NEXT || {};
    const rows = [
      ['Promise', esc(String(s.pr.promise).replace(/\s*\([^)]*\)\s*$/, '')), { src: `director file · ${dirDay()}` }],
      last ? [`Player chat, ${ddmm(last.date)}`, `“${esc(last.text)}”`, { trust: 'est.', src: 'OCR' }] : ['Player chat', 'not captured', { src: '' }],
      ['Check', esc(s.pr.check), { src: 'code (line-up vs check)' }],
      ['Next match', s.due ? esc(`${s.due}${nx.date ? ' · ' + shortDate(nx.date) : ''}`) : null, { tone: 'warn', src: nx.source ? `${nx.source} read` : 'fixture' }],
      ['Line-up used for the tick', 'after the next match', { src: 'official line-ups' }],
    ];
    openModal(`<h2>Promise · ${esc(n)}</h2><p class="sub">Kept or broken is ticked from the official line-up.</p>${cells(rows, 'pop')}`, origin, `Promise ${n}`);
  }
  function openModal(html, origin, label) {
    closePop(true);
    const el = document.createElement('div'); el.className = 'pk-modal yx-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label || 'Details');
    el.innerHTML = `<div class="yx-pop" tabindex="-1">${html}</div>`;
    el.addEventListener('click', e => { if (e.target === el) closePop(); });
    document.body.appendChild(el); POP.el = el; POP.origin = origin || document.activeElement;
    el.querySelector('.yx-pop').focus({ preventScroll: true });
    document.querySelectorAll('.gp-focus').forEach(x => x.classList.remove('gp-focus'));
    try { prompts(); } catch (e) { /* */ }
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#main [data-promise]'); if (b) { e.preventDefault(); promisePopup(b.dataset.promise, b); } });
  // Pad: line focused "A Evidence · B Back · Y Search"; A opens the evidence popup (B closes, focus returns to the line)
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.promise = {
    z: 3,
    merge: true,
    active: () => !POP.el && !!(document.activeElement && document.activeElement.matches && document.activeElement.matches('#main .pr-line')),
    prompts: () => [['A', 'Evidence'], ['B', 'Back'], ['Y', 'Search']],
    press(k) { if (k === 'A') { promisePopup(document.activeElement.dataset.promise, document.activeElement); return true; } return false; },
  };

  // Never cut a Profile Line mid-word (brief profile-minutes rule, applied to every line): a tighter font first, then whole
  // " · " segments are dropped from the end (the kind word and the icon keep the state). Runs after each render and on resize.
  function fitLines() {
    document.querySelectorAll('#main .pl-line > span').forEach(sp => {
      if (!sp.dataset.full) sp.dataset.full = sp.textContent; else sp.textContent = sp.dataset.full;
      sp.parentNode.classList.remove('tight');
      if (sp.scrollWidth <= sp.clientWidth + 1) return;
      sp.parentNode.classList.add('tight');
      const segs = sp.dataset.full.split(' · ');
      while (sp.scrollWidth > sp.clientWidth + 1 && segs.length > 1) { segs.pop(); sp.textContent = segs.join(' · '); }
    });
  }
  window.YX_fitLines = fitLines;
  (function () {
    const mo = new MutationObserver(() => requestAnimationFrame(fitLines));
    const start = () => { const m = document.getElementById('main'); if (m) mo.observe(m, { childList: true }); };
    if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
    addEventListener('resize', () => requestAnimationFrame(fitLines));
  })();

  window.YX = { SQ, canon, same, ready, dev, owed, contract, ext, dOf, gameDateOf, rng, eur, display, surname, VERD, GATE, matchday, cells, pill, projCells, projPopup, closePop, get popOpen() { return !!POP.el; },
    academyRows, youthCard, owedCard, summerRows, renewCard, developRows, developCard, directorCard, slotsShort, dirNamed, dirDay, promiseState, promiseCells, minutesOf, nextFixture, bestOffer, promiseLine, promisePopup, devLine, lineOf, openPlans, closePlans, get dp() { return DP; } };

  // projection popup: pad map "B Close" (focus returns to the row that opened it)
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.yxPop = {
    z: 6,
    active: () => !!POP.el,
    prompts: () => [['B', 'Close']],
    press(k) { if (k === 'B' || k === 'A') { closePop(); return true; } return true; },
    scrollTarget: () => POP.el && POP.el.querySelector('.yx-pop'),
  };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-proj]'); if (b) { e.preventDefault(); projPopup(b.dataset.proj, b); } });
})();
