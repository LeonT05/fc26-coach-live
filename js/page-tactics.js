/* Tactics board + Staff (coach report & director) */
'use strict';

const POS_XY = {
  GK: [50, 91], LB: [13, 71], LCB: [35, 77], CB: [50, 78], RCB: [65, 77], RB: [87, 71], LWB: [10, 58], RWB: [90, 58],
  LCDM: [36, 60], LDM: [36, 60], CDM: [50, 62], RCDM: [64, 60], RDM: [64, 60], LCM: [30, 48], CM: [50, 49], RCM: [70, 48],
  LM: [12, 37], RM: [88, 37], LAM: [30, 33], CAM: [50, 35], RAM: [70, 33], LW: [16, 21], RW: [84, 21], LF: [35, 16], CF: [50, 18], RF: [65, 16],
  LS: [38, 12], ST: [50, 12], RS: [62, 12],
};
function vPitch() {
  // vertical pitch 68 x 105, our goal at bottom
  const L = 'fill="none" stroke="rgba(215,255,238,.35)" stroke-width=".35"';
  let st = ''; for (let i = 0; i < 10; i++) if (i % 2) st += `<rect x="0" y="${i * 10.5}" width="68" height="10.5" fill="rgba(255,255,255,.03)"/>`;
  return `<svg class="pv" viewBox="-2 -2 72 109" preserveAspectRatio="none"><defs><linearGradient id="pvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f3d2f"/><stop offset="1" stop-color="#0a2a21"/></linearGradient></defs>
    <rect x="-2" y="-2" width="72" height="109" fill="url(#pvg)"/>${st}
    <rect ${L} x="0" y="0" width="68" height="105"/><line ${L} x1="0" y1="52.5" x2="68" y2="52.5"/><circle ${L} cx="34" cy="52.5" r="9.15"/>
    <rect ${L} x="13.84" y="0" width="40.32" height="16.5"/><rect ${L} x="13.84" y="88.5" width="40.32" height="16.5"/>
    <rect ${L} x="24.84" y="0" width="18.32" height="5.5"/><rect ${L} x="24.84" y="99.5" width="18.32" height="5.5"/></svg>`;
}
function latestMatchCtl() {
  // control shares per player name from the most recent loaded match
  const lm = matchList().slice().reverse().map(m => matchData(m.id)).find(Boolean);
  const o = {}; if (lm) (lm.players || []).forEach(p => { o[fold(p.name)] = p; });
  return o;
}
function boardSlots(src, c, d) {
  if (src === 'director' && d && d.best_xi && (d.best_xi.slots || []).length) return d.best_xi.slots.map(s => ({ pos: s.pos, player: s.player, role: s.role || '', focus: s.focus || '', reason: s.reason, alt: s.alt }));
  return ((c && c.tactics && c.tactics.roles) || []).map(r => ({ pos: r.pos, player: r.player, role: r.role, focus: r.focus }));
}

REG.tactics = {
  title: () => 'Tactics', tabs: () => ['player', 'settings', 'shape', 'bench'], tabParam: 'ptab',
  need: () => ensureAllDays(), ready: () => allDaysLoaded(),
  render(S) {
    const days = dayList().filter(d => coachFor(d) || directorFor(d));
    const day = days.includes(S.day) ? S.day : days[days.length - 1];
    const c = day && coachFor(day), d = day && directorFor(day);
    const src = S.src === 'director' && d ? 'director' : (c ? 'coach' : (d ? 'director' : 'coach'));
    const t = (c && c.tactics) || {};
    const slots = boardSlots(src, c, d);
    const ctl = latestMatchCtl();
    const used = {};
    const selPos = S.slot || (slots[0] && slots[slots.length - 1].pos);
    // perspective mapping: vertical-pitch % -> trapezoid %
    const PX = (x, y) => 50 + (x - 50) * (0.70 + 0.30 * y / 100), PY = y => 3 + y * 0.93;
    const slotHtml = slots.map(s2 => {
      const key = String(s2.pos || '').toUpperCase();
      let [x, y] = POS_XY[key] || POS_XY[key.replace(/^(L|R)/, '')] || [50, 50];
      used[key] = (used[key] || 0) + 1; if (used[key] > 1) x += (used[key] - 1) * 14;
      const p = playerByName(s2.player) || { name: s2.player || '?', id: fold(s2.player), face: null, ovr: null, at: {} };
      const a = p.at || {}, dl = Math.max(0, ...ATTRS.map(([k]) => a[k + '_delta'] || 0));
      const cp = ctl[fold(s2.player)], c1 = cp ? cp.ctrl_p1 || 0 : 0, c2 = cp ? cp.ctrl_p2 || 0 : 0;
      const face = portrait(p, 'M');
      const mor = a.morale ? (/happy/i.test(a.morale) ? 'var(--good)' : /content/i.test(a.morale) ? 'var(--warn)' : 'var(--bad)') : null;
      return `<a class="slot ${selPos === s2.pos ? 'on' : ''}" href="${sub({ slot: s2.pos })}" style="left:${PX(x, y)}%;top:${PY(y)}%">
        <span class="hs"><span class="ic">${mor ? `<i style="background:${mor}" data-tip="Morale: ${esc(a.morale)}"></i>` : ''}${isNum(a.sharpness) ? `<i style="background:var(--good);border-radius:2px;transform:rotate(45deg) scale(.8)" data-tip="Sharpness ${a.sharpness}"></i>` : ''}</span>
          <span class="fc">${face}</span><span class="o">${dl ? `<i>+${dl}</i>` : ''}${isNum(p.ovr) ? p.ovr : ''}</span></span>
        <span class="eb" data-tip="Last match control: ${esc(P1())} ${pct(c1)}, ${esc(P2())} ${pct(c2)}">${cp ? `<i style="flex:${c1};background:var(--p1)"></i><i style="flex:${Math.max(0, 1 - c1 - c2)};background:#30e57c"></i><i style="flex:${c2};background:var(--p2)"></i>` : `<i style="flex:1;background:${isNum(a.sharpness) ? '#30e57c' : 'rgba(255,255,255,.2)'}"></i>`}</span>
        <span class="pn" data-tip="${esc(String(s2.pos).replace(/2$/, ''))}${s2.role ? ' · ' + esc(s2.role) + (s2.focus ? ' (' + esc(s2.focus) + ')' : '') : ''}">${esc(p.name)}</span></a>`;
    }).join('');
    const sel = slots.find(s2 => s2.pos === selPos);
    const selP = sel && (playerByName(sel.player) || null);
    const verdict = sel && c && (c.players || []).find(x => fold(x.name) === fold(sel.player));
    const detail = selP ? pinfoPanel(selP, sel, `<a class="btn sq" href="${plink(selP)}" data-tip="Open profile">${ICON.right}</a>`).replace(/<div class="sect">Player Info<\/div>[\s\S]*?(?=<\/section>\s*$)/, '')
      + ((sel.reason || verdict) ? tile('Staff view', `${sel.reason ? `<p class="small ink2" style="margin:0 0 8px">${esc(untag(sel.reason))}</p>` : ''}${sel.alt ? `<p class="small muted">Alternative: <b>${esc(Array.isArray(sel.alt) ? sel.alt.join(', ') : sel.alt)}</b></p>` : ''}${verdict ? `<div class="row"><span class="verdict ${verdictCls(verdict.verdict)}">${esc(verdict.verdict)}</span></div><p class="small muted">${esc(untag(verdict.reason))}</p>` : ''}`) : '')
      : (sel ? tile(esc(sel.player), '<p class="muted">Not in the squad data yet.</p>') : '');
    const srcSeg = `<span class="seg">${c ? `<a href="${sub({ src: null, slot: null })}" class="${src === 'coach' ? 'on' : ''}">Coach plan</a>` : ''}${d ? `<a href="${sub({ src: 'director', slot: null })}" class="${src === 'director' ? 'on' : ''}">Best XI</a>` : ''}</span>`;
    const formation = src === 'director' && d && d.best_xi ? d.best_xi.formation : t.formation;
    const trap = `<svg class="pv" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon points="15,3 85,3 100,96 0,96" fill="#20242d" stroke="rgba(235,240,245,.55)" stroke-width=".35" vector-effect="non-scaling-stroke"/>
      <g fill="none" stroke="rgba(235,240,245,.4)" stroke-width="1" vector-effect="non-scaling-stroke">
        <line x1="7.6" y1="49.5" x2="92.4" y2="49.5"/><ellipse cx="50" cy="49.5" rx="11" ry="5.5"/>
        <polyline points="35,3 34,14 66,14 65,3"/><polyline points="43,3 42.8,7 57.2,7 57,3"/>
        <polyline points="30,96 31,83 69,83 70,96"/><polyline points="41,96 41.3,90 58.7,90 59,96"/></g></svg>`;
    const inXI = new Set(slots.map(s2 => fold(s2.player)));
    const subsP = (typeof squadList === 'function' ? squadList() : playerList()).filter(p => !inXI.has(fold(p.name))).sort((x, y) => (y.ovr || 0) - (x.ovr || 0));
    const board = `<div class="tm-wrap"><div class="board">${trap}${slotHtml}</div>
      <div class="board-cap"><b>${esc(formation || 'Formation')}</b><span>${src === 'director' ? 'Director of Football best XI' : 'Assistant coach plan'}</span></div></div>`;
    const subsT = tile(`Substitutes <span class="spacer"></span><span class="sub">Squad ${(typeof squadList === 'function' ? squadList() : playerList()).length}</span>`, `<div class="subs">${subsP.map(p => subTile(p)).join('')}</div>`, { cls: 'plain' });
    const lh = t.line_height;
    const settings = tile('Team settings', `<div class="tset">${[['Formation', t.formation], ['Build-up', t.build_up], ['Defensive approach', t.defensive_approach]].filter(x => x[1]).map(([k, v]) => `<div class="kv"><div class="lbl">${k}</div><b>${esc(v)}</b></div>`).join('')}</div>
      ${isNum(lh) ? `<div class="setting"><div class="sv"><span class="lbl">Line height</span><b>${lh}</b></div><div class="sl"><i class="fill" style="width:${lh}%"></i></div></div>` : ''}
      ${(t.instructions || []).length ? `<div class="lbl" style="margin:12px 0 4px">Instructions</div><div class="xl">${t.instructions.map(i => { const txt = typeof i === 'string' ? i : (i.text || ''), head = typeof i === 'object' && i.short ? i.short : txt; return `<div class="ins-row"><b>${esc(head)}</b>${head !== txt ? `<small>${esc(txt)}</small>` : ''}</div>`; }).join('')}</div>` : ''}`,
      { right: c ? `<span class="sub">${esc(shortDate(day))} report</span>` : '' });

    // shape vs targets
    const ms = matchList().map(r => ({ r, m: matchData(r.id) })).filter(x => x.m && x.m.shape);
    const sh = x => (x.m.shape.us || {});
    const last = ms[ms.length - 1];
    let shape = '';
    if (last) {
      const s = sh(last), wi = (s.in_poss || {}).width, wo = (s.out_poss || {}).width, li = (s.in_poss || {}).line, lo = (s.out_poss || {}).line, le = (s.in_poss || {}).length, lo2 = (s.out_poss || {}).length;
      const gain = wi && wo ? wi.mean - wo.mean : null;
      // QA R2-2: every number through the facts file, last match, rounded like Coaching, with its basis and est. when rough
      const mid = last.r.id, opp = teamName(last.r.opp || ((last.m.teams || [])[1]));
      const one = (label, path, v, unit, extra) => { const f = factOf(mid, path); if (f && f.trust === 'blocked') return `<div class="mc-row"><span>${esc(label)}<small>${esc(plainReason(f.blocked_because))}</small></span><b class="muted">not measurable yet</b></div>`;
        const val = isNum(f && f.value) ? f.value : v; if (!isNum(val)) return '';
        return `<div class="mc-row"><span>${esc(label)}<small>${esc([`last match (${opp})`, extra || '', f && f.trust === 'rough' && f.words ? f.words : ''].filter(Boolean).join(' · '))}</small></span><b>${unit === 'm' ? Math.round(val) + ' m' : unit === '+m' ? (val >= 0 ? '+' : '') + Math.round(val) + ' m' : fmt(val, 1)}${estTag(f)}</b></div>`; };
      const perMatch = ms.map(x => { const w = ((sh(x).in_poss || {}).width || {}).mean; return isNum(w) ? `${teamName(x.r.opp)} ${Math.round(w)} m` : ''; }).filter(Boolean).join(' · ');
      shape = tile('Team shape vs targets',
        one('Width with the ball', 'ledger:width_in_poss', wi && wi.mean, 'm', `target ≥ ${(((latestWith(coachFor) || {}).v || {}).next_match_targets || []).find(t => t.id === 'width') ? ((latestWith(coachFor).v.next_match_targets).find(t => t.id === 'width').value) : 50} m`)
        + one('Width gain (with vs without ball)', 'shape.us.width_in_minus_out', gain, '+m')
        + one('Back line without the ball', 'ledger:line_height_out', lo && lo.mean, 'm', 'metres from our goal')
        + one('Team length without the ball', 'shape.us.out_poss.length', lo2 && lo2.mean, 'm', 'lower = more compact')
        + one('Players behind the ball at a loss', 'ledger:rest_defence', (last.m.kpis || {}).rest_defence, 'n')
        + (perMatch ? `<p class="mc-foot">Width with the ball per match: ${esc(perMatch)}${estOfAll(ms.map(x => factOf(x.r.id, 'ledger:width_in_poss')))}</p>` : ''));
    }
    const changes = d && (d.tactics_changes || []).length ? tile('Director: tactical changes', `<div class="xl">${d.tactics_changes.map(x => xItem(`<span class="tx"><b>${esc(x.what)}</b></span>`, `<p class="small" style="margin:0 0 6px">${esc(untag(x.why || ''))}</p>${x.evidence ? `<div class="ev">${evHtml(x.evidence)}</div>` : ''}`)).join('')}</div>`) : '';
    const daySel = days.length > 1 ? `<select class="sel" data-param="day" data-reset="slot">${days.map(x => `<option value="${x}" ${x === day ? 'selected' : ''}>${x}</option>`).join('')}</select>` : '';
    // No page scroll (QA F-6): the board fills the left; the right is ONE panel with tabs (Player · Settings · Shape · Bench
    // [· Director]) whose body scrolls inside the panel only. The tab is view state (&ptab=…).
    const TABS = [['player', 'Player', detail], ['settings', 'Settings', settings], ['shape', 'Shape', shape], ['bench', 'Bench', subsT], ['director', 'Director', changes]].filter(x => x[2]);
    const pt = TABS.some(x => x[0] === S.ptab) ? S.ptab : 'player';
    const side = `<section class="tm-side"><nav class="sq-tabs tm-tabs">${TABS.map(([k, l]) => `<a href="${sub({ ptab: k === 'player' ? null : k })}" class="${pt === k ? 'on' : ''}">${l}</a>`).join('')}<span class="spacer"></span>${srcSeg}${daySel}</nav>
      <div class="tm-body">${(TABS.find(x => x[0] === pt) || TABS[0] || [0, 0, ''])[2]}</div></section>`;
    return `<div class="tm-grid">${slots.length ? `<div class="tm-left">${board}</div>` : tile('Line-up', '<p class="muted">No line-up in the coach file yet.</p>')}${side}</div>`;
  },
};

// ---------------- Staff: coach report + director ----------------
const VERDICT_CLS = v => verdictCls(v);
function loadChecks(day) { try { return JSON.parse(localStorage.getItem('fc26.check.' + day) || '{}'); } catch (e) { return {}; } }
function saveChecks(day, o) { try { localStorage.setItem('fc26.check.' + day, JSON.stringify(o)); } catch (e) { /* ignore */ } }

function coachReport(c, day) {
  if (!c) return `<div class="tile empty">No debrief for ${esc(day || 'this day')} yet. It appears after the session is processed.</div>`;
  const items = [];
  (c.sections || []).forEach(sec => (sec.items || []).forEach(it => items.push({ ...it, sec: sec.title })));
  const n1 = items.filter(i => i.priority === 1).length;
  const head = `<section class="tile glow"><div class="row" style="align-items:flex-start"><div style="flex:1;min-width:240px"><div class="lbl" style="margin-bottom:8px">Assistant report · ${esc(shortDate(day))}</div><p class="headline">${esc(untag(c.headline || 'Coaching notes'))}</p></div></div>
      <p class="subline">${n1 ? `${n1} to fix now · ` : ''}${items.length} points · ${(c.players || []).length} player calls</p>
      ${c.summary ? `<div class="xi" style="margin-top:10px"><div class="xh"><span class="tx lnk">Read summary</span>${ICON.car}</div><div class="xb"><p style="margin:0;color:var(--ink2)">${esc(untag(c.summary))}</p></div></div>` : ''}</section>`;
  const secs = (c.sections || []).map(sec => tile(esc(sec.title), `<div class="xl">${(sec.items || []).slice().sort((a, b) => (a.priority || 3) - (b.priority || 3)).map(it => xItem(`${prioChip(it.priority)}${whoChip(it.who)}<span class="tx">${esc(untag(it.text))}</span>`, it.evidence ? `<div class="ev">${evHtml(it.evidence)}</div>` : '')).join('')}</div>`)).join('');
  const duo = c.duo || {};
  const duoT = (duo.p1_role || duo.rules) ? tile('Duo plan', `<div class="duocols"><div><b class="p1t">${esc(P1())}</b><p>${esc(untag(duo.p1_role || ''))}</p></div><div><b class="p2t">${esc(P2())}</b><p>${esc(untag(duo.p2_role || ''))}</p></div></div>
    ${(duo.rules || []).length ? `<div class="lbl" style="margin:14px 0 4px">Rules</div><ol class="plan">${duo.rules.map(r => { const rc = untag(r), k = rc.indexOf(':'); return `<li><span>${k > 0 && k < 30 ? `<b>${esc(rc.slice(0, k))}</b>${esc(rc.slice(k))}` : esc(rc)}</span></li>`; }).join('')}</ol>` : ''}`) : '';
  const chk = loadChecks(day);
  const next = (c.next_match || []).length ? tile(`Next match checklist ${info('Tick items off before/after kick-off. Saved in this browser only.')}`, `<ul class="check" data-day="${esc(day)}">${c.next_match.map((x, i) => { const s = untag(typeof x === 'string' ? x : x.text || JSON.stringify(x)); const k = s.indexOf(':'); return `<li class="${chk[i] ? 'done' : ''}" data-ck="${i}"><span class="bx"></span><span>${k > 0 && k < 40 ? `<b style="color:#fff">${esc(s.slice(0, k))}</b>${esc(s.slice(k))}` : esc(s)}</span></li>`; }).join('')}</ul>`) : '';
  const pl = (c.players || []).length ? tile('Player decisions', `<div class="vcards">${c.players.map(p => { const pp = playerByName(p.name) || { name: p.name }; return `<div class="vcard">${avatar(pp)}<div class="row" style="gap:8px;justify-content:space-between"><a href="${plink(playerByName(p.name))}"><b>${esc(p.name)}</b></a><span class="verdict ${VERDICT_CLS(p.verdict)}">${esc(p.verdict)}</span></div><div class="why">${evHtml(p.reason)}</div></div>`; }).join('')}</div><p class="note">Click a card for the reasoning.</p>`) : '';
  return `${head}<div class="grid g2" style="margin-top:16px">${next}${duoT}</div><div class="grid g2" style="margin-top:16px">${secs}</div><div style="margin-top:16px">${pl}</div>`;
}

function directorView(d, day) {
  if (!d) return `<div class="tile empty">No Director of Football report for ${esc(day || 'this day')} yet (<code>data/&lt;day&gt;.director.js</code>).</div>`;
  const card = (title, list, f) => (list || []).length ? tile(`${title} <span class="sub">${list.length}</span>`, `<div class="vcards">${list.map(f).join('')}</div>`) : '';
  const nm = n => { const p = playerByName(n); return p ? `<a href="${plink(p)}"><b>${esc(n)}</b></a>` : `<b>${esc(n || '')}</b>`; };
  const av = n => avatar(playerByName(n) || { name: n || '?' });
  const xi = d.best_xi || {};
  return `<section class="tile glow"><div class="lbl" style="margin-bottom:8px">Director of Football · ${esc(shortDate(day))}</div><p class="headline">${esc(untag(d.headline || 'Squad recommendations'))}</p></section>
    <div class="grid g2" style="margin-top:16px">
      ${(xi.slots || []).length ? tile(`Best XI · ${esc(xi.formation || '')}`, `<div class="xl">${xi.slots.map(s => xItem(`${posBadge(s.pos)}${av(s.player)}<span class="tx">${esc(s.player)}${s.alt ? ` <span class="muted small">alt ${esc(Array.isArray(s.alt) ? s.alt.join(', ') : s.alt)}</span>` : ''}</span>`, s.reason ? `<div class="ev">${evHtml(s.reason)}</div>` : '')).join('')}</div>
        ${(d.bench || []).length ? `<div class="lbl" style="margin:12px 0 6px">Bench</div><div class="row">${d.bench.map(b => `<span class="chip"><span>${esc(typeof b === 'string' ? b : b.name || b.player)}</span></span>`).join('')}</div>` : ''}`, { right: `<a href="#page=tactics&src=director">Board</a>` }) : ''}
      <div class="stack">
        ${card('Promote', d.promote, x => `<div class="vcard">${av(x.name)}<div class="row" style="justify-content:space-between">${nm(x.name)}<span class="verdict start">${esc([x.from, x.to_role].filter(Boolean).join(' to ') || 'promote')}</span></div><div class="why">${esc(untag(x.reason || ''))}${x.evidence ? `<div class="ev">${evHtml(x.evidence)}</div>` : ''}</div></div>`)}
        ${card('Develop', d.develop, x => `<div class="vcard">${av(x.name)}<div class="row" style="justify-content:space-between">${nm(x.name)}<span class="verdict develop">${esc(x.target_role || 'develop')}</span></div><div class="why"><b>${esc(x.plan || '')}</b> ${esc(untag(x.reason || ''))}</div></div>`)}
        ${card('Sell or loan', d.sell_or_loan, x => `<div class="vcard">${av(x.name)}<div class="row" style="justify-content:space-between">${nm(x.name)}<span class="verdict drop">${esc(x.action || 'sell')}</span></div><div class="why">${esc(untag(x.reason || ''))}${x.evidence ? `<div class="ev">${evHtml(x.evidence)}</div>` : ''}</div></div>`)}
      </div>
    </div>
    <div class="grid g3" style="margin-top:16px">
      ${(d.buy_or_scout || []).length ? tile('Buy / scout', `<div class="xl">${d.buy_or_scout.map(x => xItem(`<span class="verdict keep">${esc(x.role || 'target')}</span><span class="tx">${esc(x.profile || '')}</span>`, `<p class="small" style="margin:0">${esc(untag(x.why || ''))}</p>${x.budget_hint ? `<p class="small muted">Budget: ${esc(untag(x.budget_hint))}</p>` : ''}${(x.scout_targets || []).length ? `<div class="row">${x.scout_targets.map(s => `<span class="chip"><span>${esc(typeof s === 'string' ? s : s.name || JSON.stringify(s))}</span></span>`).join('')}</div>` : ''}`)).join('')}</div>`) : ''}
      ${(d.contracts_morale || []).length ? tile('Contracts & morale', d.contracts_morale.map(x => `<div class="mini">${av(x.name)}<div style="flex:1"><div class="nm">${nm(x.name)}</div><div class="sub">${esc(untag(x.note || ''))}</div></div></div>`).join('')) : ''}
      ${(d.watch_list || []).length ? tile('Watch list', d.watch_list.map(x => `<div class="mini">${av(x.name)}<div style="flex:1"><div class="nm">${nm(x.name)}</div><div class="sub">${esc(untag(x.what_to_watch || ''))}</div></div></div>`).join('')) : ''}
    </div>
    ${(d.confidence_notes || []).length ? `<div style="margin-top:16px">${tile('Confidence notes', `<ul class="small muted" style="margin:0;padding-left:18px">${d.confidence_notes.map(x => `<li>${esc(untag(x))}</li>`).join('')}</ul>`)}</div>` : ''}`;
}

REG.coach = {
  title: () => 'Staff',
  tabs: () => ['report', 'director'],
  render(S) {
    const days = dayList().filter(d => coachFor(d) || directorFor(d));
    const day = days.includes(S.day) ? S.day : days[days.length - 1];
    const tab = S.tab === 'director' ? 'director' : 'report';
    const daySel = days.length > 1 ? `<select class="sel" data-param="day">${days.map(x => `<option value="${x}" ${x === day ? 'selected' : ''}>${x}</option>`).join('')}</select>` : '';
    return `<div class="ptitle"><h1><small>Backroom staff · ${esc(day ? shortDate(day) : '')}</small>Staff Room</h1><span class="spacer"></span>${daySel}</div>
      <nav class="stabs" style="margin-top:0"><span class="gl lt">LT</span><a href="${sub({ tab: null })}" class="${tab === 'report' ? 'on' : ''}">Assistant coach</a><a href="${sub({ tab: 'director' })}" class="${tab === 'director' ? 'on' : ''}">Director of Football</a><span class="gl lt">RT</span></nav>
      ${tab === 'report' ? coachReport(day && coachFor(day), day) : directorView(day && directorFor(day), day)}`;
  },
  after(S, root) {
    root.addEventListener('click', e => {
      const li = e.target.closest('.check li'); if (!li) return;
      const day = li.parentNode.dataset.day, o = loadChecks(day), i = li.dataset.ck;
      o[i] = !o[i]; saveChecks(day, o); li.classList.toggle('done', !!o[i]);
    });
  },
};
