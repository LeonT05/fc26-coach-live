// ---------- Transfers (L5, approved Figma frame 116:2464) · QA pass 1 fixes TR-1…10, AC-1…5 ----------
// Director's Desk (all decisions) and Academy (the same Desk component, filtered to academy decisions). No Inbox, no Staff
// Room, no game-screen copies (R0). One decision per player (chat notes become evidence of that decision).
(function () {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SRC = { transfer: 'in-game offer', squad: 'squad status', official: 'Match Ratings', coach: 'coach file', youth: 'academy', kb: 'knowledge base', chat: 'player chat', inbox: 'player chat', scout: 'scout report', devplan: 'development plan' };
  const TAG = { sell: ['SELL', 'warn', 'cross'], loan: ['LOAN', 'warn', 'tactics'], keep: ['KEEP', 'neu', 'check'], buy: ['BUY', 'pos', 'scout'], develop: ['DEVELOP', 'pos', 'training'], promote: ['PROMOTE', 'pos', 'star'], wait: ['NOT YET', 'neu', 'star'], talk: ['TALK', 'neu', 'morale'] };
  const cap = s => { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  const youthList = () => (((window.FC26_SQUAD || {}).youth) || []);
  const isYouth = name => youthList().some(y => fold(y.name) === fold(name));
  // strict identity: exact folded name; "A. Perrone" is never the senior "Perrone" (QA TR-2)
  function person(name) {
    if (!name) return null; const f = fold(name);
    const y = youthList().find(r => fold(r.name) === f);
    if (y) return { name: y.name, id: f, youth: true, ovr: y.ovr, pos: y.pos, age: y.age, pot: isNum(y.pot_lo) ? `${y.pot_lo}-${y.pot_hi}` : '', full: y.name, career: false };
    const p = (typeof squadList === 'function' ? squadList() : playerList()).find(r => fold(r.name) === f);
    const exAll = (window.FC26_EXTERNAL || {}).players || {}; const ex = exAll[name] || Object.values(exAll).find(r => fold(r.id || '') === f);
    if (!p && !ex) return null;
    const o = Object.assign({ name, id: (ex && ex.id) || f }, p || {}); o.full = (ex && ex.display_name) || o.name; o.career = !!playerByName(name) && fold(playerByName(name).name) === f; return o;
  }
  const noGame = t => String(t || '').replace(/(?:IMPORTANT|URGENT|NEW)\s+chat[:,]?\s*/g, 'chat: ').replace(/chat:\s*Morale\s+/g, 'morale ').replace(/^chat:\s*/, '').trim();
  function decisions(d) {
    const out = [], byName = new Map();
    const add = e => { if (e.name) { const k = fold(e.name); if (byName.has(k)) { byName.get(k).extra.push(e); return; } byName.set(k, e); } e.extra = e.extra || []; out.push(e); };
    (d.sell_or_loan || []).forEach(x => { const a = /sell/i.test(x.action) ? 'sell' : /loan/i.test(x.action) ? 'loan' : 'keep'; add({ kind: a, name: x.name, label: x.short || `${cap(a)} ${x.name}`, title: x.title || x.short || x.reason, body: x.body || x.reason, x }); });
    (d.buy_or_scout || []).forEach(x => add({ kind: 'buy', label: x.short || `Buy: ${x.role || x.profile}`, title: x.title || x.profile || x.role, body: x.body || x.why, x }));
    (d.promote || []).forEach(x => { const wait = /^not yet/i.test(x.reason || ''); add({ kind: wait ? 'wait' : 'promote', name: x.name, label: x.short || `${wait ? 'Not yet: promote' : 'Promote'} ${x.name}`, title: x.title || x.short || x.to_role, body: x.body || x.reason, x }); });
    // d.develop: the Develop group is the code's "Switch" verdicts (js/page-youth.js); the Director's develop lines show on the profile only when they agree
    const promised = n => (d.promises || []).some(q => fold(q.name) === fold(n));
    (d.contracts_morale || []).forEach(x => add({ kind: 'talk', name: x.name, label: x.short || (promised(x.name) ? `${x.name}: promise` : `Talk to ${x.name}`), title: x.title || x.short || `Talk to ${x.name}`, body: x.body || x.note, x }));
    out.forEach(e => { e.label = noGame(e.label); e.title = noGame(e.title); e.body = noGame(e.body); const t = TAG[e.kind] || TAG.keep; e.tag = t[0]; e.tone = t[1]; e.icon = t[2]; e.academy = !!(e.name && isYouth(e.name)); });
    // Keep rows (T4 246:9407): the morale face only with a read Happy / Very Happy, a neutral icon otherwise (critic K-1)
    out.forEach(e => { if (/^(keep|talk)$/.test(e.kind) && e.name) { const p = (typeof squadList === 'function' ? squadList() : []).find(q => fold(q.name) === fold(e.name)); e.icon = p && /happy/i.test((p.at || {}).morale || '') && !/unhappy/i.test(p.at.morale) ? 'morale' : 'tactics'; } });
    return out;
  }
  window.deskDecisions = () => { const dv = latestWith(directorFor); return dv ? decisions(dv.v) : []; };
  function evidence(ev, p) {
    return String(ev || '').split(/;\s*(?=\[)/).map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^\[([a-z]+)(?:\s+(\d\d)\/(\d\d))?\]\s*(.*)$/i); if (!m) return { t: s, src: '' };
      const src = SRC[m[1].toLowerCase()] || m[1]; return { t: cap(noGame(m[4])), src: m[2] ? `${src} · as of ${+m[2]} ${MON[+m[3] - 1]}` : src };
    }).filter(r => r.t && !(p && /^(?:[A-Z]{1,3}(?:\/[A-Z]{1,3})*,\s*)?OVR\s*\d+\.?$/i.test(r.t)) && !(p && new RegExp(`^${p.pos || '#'},?\\s*OVR\\s*${p.ovr}\\.?$`, 'i').test(r.t))).slice(0, 5);
  }
  // UX-10 (Leon 2026-11-24): no evidence text rows. A person's card = the Director's one reason line + label / value cells built
  // from structured data (js/page-youth.js YX.directorCard); a card without a person (buy) shows its evidence as cells
  // (source label left, value right, date as a small grey tag).
  function card(e) {
    const yx = window.YX && e.name ? YX.directorCard(e, e.tag) : null; if (yx) return yx;
    const x = e.x, ev = evidence(x.evidence || (e.kind === 'buy' ? x.budget_hint : ''), null);
    const rows = ev.map(r => { const m = String(r.src || '').match(/^(.*?)(?: · as of (.*))?$/); return [cap(m[1] || 'Director'), esc(r.t), { src: m[2] ? 'as of ' + m[2] : '' }]; });
    const btns = e.kind === 'buy' && x.role ? (() => { const POS = ['GK', 'RB', 'LB', 'CB', 'LCB', 'RCB', 'RWB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST', 'CF'], txt = `${x.role || ''} ${x.profile || ''} ${e.label || ''}`;
      const found = [...new Set((txt.match(/\b(?:GK|RB|LB|LCB|RCB|CB|RWB|LWB|CDM|CM|CAM|RM|LM|RW|LW|ST|CF)s?\b/g) || []).map(t => t.replace(/s$/, '')).map(t => t === 'LCB' || t === 'RCB' ? 'CB' : t))].concat(/striker/i.test(txt) ? ['ST'] : []).filter((v, i, a) => POS.includes(v) && a.indexOf(v) === i);
      const all = (typeof squadList === 'function' ? squadList() : []).filter(q => (q.natural && q.natural.length) || q.pos);
      return found.slice(0, 2).map(pos => { const nat = all.filter(q => (q.natural || [q.pos]).includes(pos) || (pos === 'CB' && (q.natural || [q.pos]).some(v => /^[LR]?CB$/.test(v)))).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
        return nat.length > 1 ? `<a class="btn yx-gl" href="#page=squad&sel=${encodeURIComponent(nat[0].name)}&cmp=${encodeURIComponent(nat.slice(1, 4).map(q => q.name).join(','))}"><span class="gl c">X</span>Compare our ${esc(pos)}s</a>` : `<span class="dd-none">${nat.length ? `No other natural ${esc(pos)} in the squad (only ${esc(nat[0].name)})` : `No natural ${esc(pos)} in the squad`}</span>`; }).join(''); })() : '';
    return `<article class="dd-card yx-card">
      <header><span class="dd-ic">${cenIco(e.icon)}</span><div><div class="dd-name">${esc(String(x.role || e.label).toUpperCase())}</div></div><span class="dd-tag ${e.tone} k-${e.kind}">${e.tag}</span></header>
      <h3>${esc(cap(e.title))}</h3>${e.body && e.body !== e.title ? `<p class="yx-why">${esc(cap(e.body))}</p>` : ''}
      ${rows.length && window.YX ? YX.cells(rows) : ''}
      ${btns ? `<div class="dd-btns">${btns}</div>` : ''}
    </article>`;
  }
  // ---------- Director's Desk as LT/RT groups (brief transfers-decision-view; Figma 3a 221:6959 / 3b 221:7214, Desk Tabs 221:2105) ----------
  // Sell · Keep · Sign · Develop · Academy · Summer (Leon's later Decision: Summer = a view over the same verdicts: sell / loan now,
  // promote and renew once those verdicts exist). Focus (pad, keyboard) or mouse hover on a row updates the inspector at once.
  const GRP = [['sell', 'Sell'], ['keep', 'Keep'], ['sign', 'Sign'], ['develop', 'Develop'], ['academy', 'Academy'], ['summer', 'Summer']];
  // Round 3 (briefs youth-academy-decisions, desk-summer-group, dev-plan-verdict): Develop, Academy and Summer are code lists
  // (js/page-youth.js): Develop = senior "Switch" verdicts only; Academy = first-team U23s owed minutes + the top-3 ceilings +
  // anyone the Director names; Summer = promote · renew · sell · loan together (a view over the same verdicts, EV-6).
  function inGroup(e, g) {
    if (e.academy) return false;
    return g === 'sell' ? /^(sell|loan)$/.test(e.kind) : g === 'keep' ? /^(keep|talk)$/.test(e.kind) : g === 'sign' ? e.kind === 'buy' : false;
  }
  function rows(g, all) {
    const Y = window.YX;
    if (g === 'develop') return Y ? Y.developRows() : [];
    if (g === 'academy') return Y ? Y.academyRows() : [];
    if (g === 'summer') return Y ? Y.summerRows(all).rows : [];
    return all.filter(e => inGroup(e, g));
  }
  function codeCard(e) {
    const Y = window.YX; if (!Y || !e.code) return null;
    if (e.code === 'youth' || e.code === 'promote') return Y.youthCard(e.r);
    if (e.code === 'owed') return Y.owedCard(e.m);
    if (e.code === 'renew') return Y.renewCard(e);
    if (e.code === 'develop') return Y.developCard(e);
    if (e.code === 'sell' || e.code === 'loan') return card(e.e);
    return null;
  }
  function rowMeta(e) {
    if (e.meta != null) return e.meta;
    if (/^(keep|talk)$/.test(e.kind) && e.name) {   // structured meta: age · morale word · last rating vs opponent
      const p = (typeof squadList === 'function' ? squadList() : []).find(q => fold(q.name) === fold(e.name)); if (!p) return '';
      const r = ((p.st || {}).ratings || []).slice(-1)[0], ref = r && typeof matchRef === 'function' ? matchRef(r.match) : null;
      const ps = window.YX ? YX.promiseState(e.name) : null; if (ps) return [(p.at || {}).morale || '', `promise ${ps.state}`].filter(Boolean).join(' · ');
      return [isNum(p.age) ? p.age : '', (p.at || {}).morale || '', r && isNum(r.rating) ? `${r.rating.toFixed(1)}${ref && ref.opp ? ' vs ' + ref.opp : ''}` : ''].filter(x => x !== '').join(' · ');
    }
    const x = e.x || {}, m = String(x.reason || '').match(/(\d+)\s*w(?:ee)?k?s?\s*->\s*(\d+)\s*OVR/i);
    if (e.kind === 'develop' && m) return `${m[2]} OVR in ${m[1]} wk`;
    return e.kind === 'wait' ? 'not yet' : '';
  }
  function deskState(S) {
    const dv = latestWith(directorFor); if (!dv) return null;
    const all = decisions(dv.v).map((e, i) => Object.assign(e, { i }));
    let g = GRP.some(x => x[0] === S.grp) ? S.grp : S.tab === 'academy' ? 'academy' : null;
    if (!g && S.d != null && /^\d+$/.test(S.d) && all[+S.d]) g = (GRP.find(([k]) => inGroup(all[+S.d], k)) || GRP[0])[0];
    if (!g) g = (GRP.find(([k]) => rows(k, all).length) || GRP[0])[0];
    const ds = rows(g, all);
    return { dv, all, g, ds, k: ds.find(e => String(e.i) === String(S.d)) || ds[0] || null };
  }
  function desk(S) {
    const st = deskState(S); if (!st) return '<div class="tile empty">No Director file yet.</div>';
    const { dv, all, g, ds, k } = st;
    // grid brief: the six groups share ONE G1 frame (grid.css); the stamp moves into the band (page meta, x 900)
    const stampTxt = g === 'develop' || g === 'academy' ? `Code verdicts · ${shortDate(String((window.FC26_SQUAD || {}).generated || '').slice(0, 10))} export` : g === 'sign' ? `Shortlist · ${shortDate(dv.day)} session` : `Director's Desk · ${shortDate(dv.day)}`;
    const tabs = GRID.stb(GRP.map(([key, l]) => ({ label: l, href: sub({ grp: key, tab: null, d: null }), on: g === key })), { label: "Director's Desk groups", meta: esc(stampTxt) });
    if (g === 'sign' && typeof window.signView === 'function') { const sv = window.signView(S); if (sv) return tabs + sv; }   // shortlist by position (page-shortlist.js)
    const notes = g === 'summer' && window.YX ? YX.summerRows(all).notes : [];
    const empty = g === 'academy' ? 'No academy decisions this window' : g === 'develop' ? 'No plan switch pays off today' : 'Nothing in this group today';
    const rowsHtml = ds.map(e => `<a class="cen-row ${e === k ? 'on' : ''}" href="${sub({ grp: g, tab: null, d: e.i })}" data-i="${e.i}">${cenIco(e.icon)}<span class="l">${esc(g === 'develop' && !e.code ? String(e.label).replace(/^Develop\s+/, '') : e.label)}</span><span class="m">${esc(rowMeta(e))}</span></a>`).join('');
    return tabs + `<div class="dd" data-grid="g1">
      <nav class="dd-list fc-scroll">${rowsHtml}${notes.map(n => `<p class="empty-note yx-note">${esc(n)}</p>`).join('')}${!ds.length && !notes.length ? `<p class="empty-note">${esc(empty)}</p>` : ''}</nav>
      <div class="dd-right">${ds.map(e => `<div class="dd-pane" data-i="${e.i}"${e === k ? '' : ' hidden'}>${codeCard(e) || card(e)}</div>`).join('')}</div></div>`;
  }
  // inspector follows the focused / hovered row without a re-render (the URL keeps d= for Back and reload)
  function showPane(root, row) {
    if (!row || !row.dataset.i) return;
    root.querySelectorAll('.dd-list .cen-row').forEach(r => r.classList.toggle('on', r === row));
    root.querySelectorAll('.dd-pane').forEach(p => { p.hidden = p.dataset.i !== row.dataset.i; });
    const h = row.getAttribute('href'); if (h && h !== location.hash) { try { history.replaceState(history.state, '', location.href.split('#')[0] + h); } catch (e) { /* */ } }
    try { S = parseHash(); } catch (e) { /* */ }
  }
  REG.scouting.title = () => 'Transfers';
  REG.scouting.tabs = () => GRP.map(x => x[0]); REG.scouting.tabParam = 'grp';
  REG.scouting.render = function (S) { return desk(S); };
  REG.scouting.after = function (S, root) {
    if (root.querySelector('.sl-wrap') && window.SIGN) return;   // entry focus + memory per group: navstate / grid.js
    const on = root.querySelector('.dd-list .cen-row.on');
    if (on && !window.__viewRender && !window.NAVSTATE) { const box = root.querySelector('.dd-list'); if (box) { requestAnimationFrame(() => { const r = on.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop; if (r < box.scrollTop || r + on.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, r - box.clientHeight / 2); }); } }
    const list = root.querySelector('.dd-list'); if (!list) return;
    list.addEventListener('focusin', e => showPane(root, e.target.closest('.cen-row')));
    list.addEventListener('mouseover', e => { const r = e.target.closest('.cen-row'); if (r && !r.classList.contains('on')) showPane(root, r); });
  };
  const paneBtns = () => { const p = document.querySelector('#main .dd-pane:not([hidden])'); return p ? [...p.querySelectorAll('.dd-btns .btn')] : []; };
  // the inspector's D-pad stops: the focusable projection row (A = how it is worked out), then the pills
  const paneStops = () => { const p = document.querySelector('#main .dd-pane:not([hidden])'); return p ? [...p.querySelectorAll('button.yx-proj, .dd-btns .btn')] : []; };
  // Pad map (brief §4): A Open Player · B Back · LT RT Group · X Compare · Y Search
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.desk = {
    z: 1,
    active: () => typeof S === 'object' && S.page === 'scouting' && !!document.querySelector('#main .dd'),
    prompts() {
      const b = paneBtns(), a = document.activeElement, onRow = a && a.closest && a.closest('.dd-list');
      const pri = b.find(x => x.classList.contains('pri')) || b[0];
      if (a && a.matches && a.matches('button.yx-proj')) return [['A', 'How it is worked out'], ['LTRT', 'Group'], ...(b.some(x => /cmp=/.test(x.getAttribute('href') || '')) ? [['X', 'Compare']] : []), ['Y', 'Search']];
      const btnText = el => [...el.childNodes].filter(n => !(n.classList && n.classList.contains('gl'))).map(n => n.textContent).join('').trim();   // without the glyph ("XCompare")
      const aLabel = !onRow ? 'Select' : pri ? btnText(pri) : 'Select';
      const cmp = b.find(x => /cmp=/.test(x.getAttribute('href') || ''));
      return [['A', aLabel], ['LTRT', 'Group'], ...(cmp ? [['X', 'Compare']] : []), ['Y', 'Search']];
    },
    press(k) {
      if ((k === 'UP' || k === 'DOWN') && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('.dd-pane'))) { setTimeout(() => { const f = document.activeElement, root = document.querySelector('#main .page'); if (f && f.closest && f.closest('.dd-list') && root) showPane(root, f.closest('.cen-row')); }, 0); return false; }
      const ae = document.activeElement, fx = el => { el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); return true; };
      if (k === 'RIGHT' && ae && ae.closest && ae.closest('.dd-list')) { const b = paneStops()[0]; return b ? fx(b) : true; }
      if ((k === 'UP' || k === 'DOWN') && ae && ae.closest && ae.closest('.dd-pane')) { const st = paneStops(), pj = st.find(x => x.matches('button.yx-proj')), b = paneBtns(); if (k === 'DOWN' && ae === pj && b[0]) return fx(b[0]); if (k === 'UP' && b.includes(ae) && pj) return fx(pj); return true; }
      if (k === 'LEFT' && ae && ae.closest && ae.closest('.dd-pane')) { const b = paneBtns(), i = b.indexOf(ae); if (i > 0) return fx(b[i - 1]); const on = document.querySelector('#main .dd-list .cen-row.on'); return on ? fx(on) : false; }
      if (k === 'RIGHT' && ae && ae.closest && ae.closest('.dd-pane')) { const b = paneBtns(), i = b.indexOf(ae); return i >= 0 && b[i + 1] ? fx(b[i + 1]) : true; }
      if (k === 'LT' || k === 'RT') { const st = deskState(S), i = GRP.findIndex(x => x[0] === st.g), j = (i + (k === 'RT' ? 1 : -1) + GRP.length) % GRP.length; NAVSTATE.switchTab(sub({ grp: GRP[j][0], tab: null, d: null }), j); return true; }   // per-group memory (row + scroll)
      if (k === 'X') { const c = paneBtns().find(x => /cmp=/.test(x.getAttribute('href') || '')); if (c) { c.click(); return true; } return true; }
      if (k === 'A') { const a = document.activeElement; if (a && a.closest && a.closest('.dd-list .cen-row')) { const b = paneBtns(); const pri = b.find(x => x.classList.contains('pri')) || b[0]; if (pri) { pri.click(); return true; } return true; } return false; }
      return false;
    },
    scrollTarget: () => document.querySelector('#main .dd-list'),
  };
})();
