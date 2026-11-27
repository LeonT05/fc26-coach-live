/* Tactics v2: the FC 26 Team Management team sheet (brief docs/ui_changes/2026-11-24_tactics-v2-fc26-board.md).
   Figma (file QeCUkHXbS34AlbGkdoliCJ) section "L5 · Tactics v2" 278:28350: 5a 278:28351 slot shape · 5b 278:29003 in possession ·
   5c 278:29670 out of possession · 5d 278:30329 compare Slot 3 vs Slot 1 · 5e 278:30988 swap in progress. Parts in 274:16647:
   Pitch Card · Team Sheet 274:25406, Pitch · Perspective 275:3381 (assets/pitch_teamsheet.svg), Phase Ghost 275:3386, Phase Caption
   275:3441, Info Pair 275:3467, Role Change Row 275:3496, Team Sheet Boards 276:3384 / 276:3655 / 276:3939, Tactics Player Panel v2
   278:27196, Swap Comparison Panel v2 278:27493, Slot Compare Panel 278:27600; Bench Panel 215:1588 + Sub Tile 209:1536 (round 2).
   Kept from round 2: LT/RT slot, A pick up / A drop / B cancel, X role list (a what-if), Y Save as our plan, the what-if per slot
   until Reset, FC26SwapVerdict (js/swapverdict.js) on window.FC26_SWAP (data/swapdata.js).
   Phase views = the ROLE MODEL (kb_tactics_fabregas role behaviour), captioned "Role model · not captured": each card moves by its
   role; ghosts + dashed arrows mark the movers. FC 26 keeps one role per position in both phases, so the role line stays.
   Layout stability: board 780 x 660, bench 224 x 720 and panel 576 x 720 are fixed frames; views and slots only move cards inside. */
'use strict';
(function () {
  const SW = () => window.FC26_SWAP || null;
  const CS = () => window.FC26_CAPTURED_SETTINGS || null;
  const VERDICT = () => (window.FC26SwapVerdict && window.FC26SwapVerdict.verdict) || null;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dShort = s => { const m = String(s || '').match(/(\d{4})-(\d\d)-(\d\d)/); return m ? `${+m[3]} ${MON[+m[2] - 1]}` : ''; };
  const title = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const BASE = { LCB: 'CB', RCB: 'CB', LCDM: 'CDM', RCDM: 'CDM', LDM: 'CDM', RDM: 'CDM', LCM: 'CM', RCM: 'CM', LAM: 'CAM', RAM: 'CAM', LS: 'ST', RS: 'ST' };
  const base = p => BASE[p] || p;
  // Pitch Card top-left (Figma px) inside the 780 x 660 board, slot shape (276:3384); other formations' spots extend the same grid
  const CARD_XY = { GK: [318, 499], LCB: [168, 429], RCB: [468, 429], CB: [318, 429], LB: [18, 359], RB: [618, 359], LWB: [18, 300], RWB: [618, 300],
    LCDM: [228, 299], RCDM: [408, 299], CDM: [318, 299], LCM: [198, 240], CM: [318, 240], RCM: [438, 240], CAM: [318, 174], LAM: [198, 174], RAM: [438, 174],
    LM: [78, 79], RM: [558, 79], LW: [60, 100], RW: [576, 100], ST: [318, 31], LS: [238, 31], RS: [398, 31], CF: [318, 60] };
  const VIEWS = ['Slot shape', 'In possession', 'Out of possession', 'Compare with Slot 1'];
  const NOTES = ['Saved slot as captured', 'Role model · not captured', 'Role model · not captured', 'Differences from Slot 1'];
  const T = { slot: null, view: 0, carry: null, wi: {}, picker: null, focusPos: 'ST', focusSub: null };
  const viewerKey = n => `fc26.ourplan.${typeof viewer === 'function' ? viewer() : 'p1'}.slot${n}`;
  const loadPlan = n => { try { const v = JSON.parse(localStorage.getItem(viewerKey(n)) || 'null'); return v && v.xi ? v : null; } catch (e) { return null; } };
  const savePlan = (n, v) => { try { localStorage.setItem(viewerKey(n), JSON.stringify(v)); return true; } catch (e) { return false; } };
  const dropPlan = n => { try { localStorage.removeItem(viewerKey(n)); } catch (e) { /* */ } };
  const fmt1 = x => (x > 0 ? '+' : x < 0 ? '−' : '') + (Math.round(Math.abs(x) * 10) / 10);

  // ---------- model ----------
  function slots() {
    const D = SW(), C = CS();
    if (D && (D.slots || []).length) return D.slots.map(s => { const c = ((C || {}).slots || []).find(x => x.slot === s.slot) || {};
      return { n: s.slot, name: title(s.name), purpose: s.purpose || c.purpose, formation: s.formation || c.formation, build: c.build_up, def: c.defensive_approach, line: c.line_height, seen: c.seen,
        pos: Object.fromEntries(Object.entries(s.positions || {}).map(([p, v]) => [p, { role: v.role, focus: v.focus, starter: v.starter, key: v.key, bucket: v.bucket, nb: v.neighbours || [] }])) }; });
    return ((C || {}).slots || []).map(c => { const roles = Object.assign({}, ((C.slots || []).find(x => x.slot === (c.roles_from || c.slot)) || {}).roles || {}, c.roles || {});
      return { n: c.slot, name: title(c.name), purpose: c.purpose, formation: c.formation, build: c.build_up, def: c.defensive_approach, line: c.line_height, seen: c.seen,
        pos: Object.fromEntries(Object.entries(C.xi || {}).map(([p, nm]) => [p, { role: (roles[p] || [])[0], focus: (roles[p] || [])[1], starter: fold(nm), key: null, nb: [] }])) }; });
  }
  // a swapdata pid from a display or full name ("Álvaro Morata" -> morata: the swapdata name is the surname)
  const pidOf = name => { const D = SW(), f = fold(name); if (D && D.players) { if (D.players[f]) return f; const k = Object.keys(D.players).find(k => fold(D.players[k].name) === f) || Object.keys(D.players).find(k => { const n = fold(D.players[k].name); return n.length >= 4 && f.endsWith(n); }); if (k) return k; } return f; };
  function info(pid) {
    const D = SW(), sp = D && D.players ? D.players[pid] : null, nm = sp ? sp.name : pid;
    const L = typeof squadList === 'function' ? squadList() : playerList();
    const p = L.find(q => fold(q.name) === fold(nm) || fold(q.id || '') === pid) || { name: nm, id: pid, at: {} };
    const ex = typeof extFace === 'function' ? extFace(p.id || pid) : null;
    let ovr = sp && sp.ovr && isNum(sp.ovr.v) ? sp.ovr.v : isNum(p.ovr) ? p.ovr : null, ovrExt = false;   // swapdata = the newest Player Info read
    if (ovr == null && ex && isNum(ex.ovr_base)) { ovr = ex.ovr_base; ovrExt = true; }   // Smolčić: base-DB OVR, tagged ext. in the panel
    const natural = sp && sp.positions ? sp.positions.natural : (p.natural || [])[0] || p.pos || '';
    return { pid, sp, p, ex, name: p.name || nm, ovr, ovrExt, natural, group: GROUP(natural) };
  }
  const captured = s => Object.fromEntries(Object.entries(s.pos).map(([p, v]) => [p, v.starter]));
  const diffs = (s, xi, roles, focus) => Object.keys(s.pos).filter(p => xi[p] !== s.pos[p].starter || (roles && roles[p]) || (focus && focus[p])).length;
  function state(s) {
    const saved = loadPlan(s.n), cur = T.wi[s.n];
    const xi = cur ? cur.xi : saved ? saved.xi : captured(s), roles = cur ? cur.roles : saved ? saved.roles : {}, focus = (cur ? cur.focus : saved ? saved.focus : {}) || {};
    const same = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});
    const unsaved = !!cur && !(saved ? same(cur.xi, saved.xi) && same(cur.roles, saved.roles) && same(cur.focus, saved.focus) : diffs(s, cur.xi, cur.roles, cur.focus) === 0);
    return { xi, roles: roles || {}, focus, saved, unsaved, changes: diffs(s, xi, roles, focus), hasPlan: !!saved };
  }
  const bench = (s, xi) => { const inXI = new Set(Object.values(xi)), D = SW();
    const pool = D && D.players ? Object.keys(D.players).filter(k => D.players[k].seen_in_game !== false) : (typeof squadList === 'function' ? squadList() : playerList()).map(p => fold(p.name));
    return pool.filter(k => !inXI.has(k)).map(info).filter(x => x.natural !== '' || isNum(x.ovr)).sort((a, b) => (b.ovr || 0) - (a.ovr || 0)); };
  function oop(pid, pos) { const D = SW(), sp = D && D.players && D.players[pid]; if (sp && sp.oop && pos in sp.oop) return sp.oop[pos] === true; const i = info(pid); return !!i.natural && base(pos) !== base(i.natural) && i.natural !== pos; }
  function verdictFor(s, pos, pin, pout, xi) { const V = VERDICT(); if (!V || !SW()) return null; try { return V(s.n, pos, pin, pout, { lineup: xi }); } catch (e) { return null; } }
  const roleOf = (s, st, p) => (st && st.roles[p]) || (s.pos[p] || {}).role || '';
  const keyOf = (s, st, p) => { const sp = s.pos[p] || {}, r = st && st.roles[p]; return r && sp.bucket ? `${sp.bucket}|${r}` : sp.key; };
  const fitOf = (pid, key) => { const D = SW(), sp = D && D.players && D.players[pid]; const v = sp && sp.fit && key ? sp.fit[key] : null; return isNum(v) ? v : null; };
  function rolePlus(pid, pos, role) {
    const D = SW(), sp = D && D.players && D.players[pid]; if (!sp || !sp.role_plus || !Array.isArray(sp.role_plus.v)) return null;
    const hit = sp.role_plus.v.find(r => (r.pos === pos || r.pos === base(pos) || base(r.pos) === base(pos)) && r.role === role);
    return hit ? hit.plus || '+' : false;
  }
  function linksWith(pid, pos, s, xi) {
    const D = SW(); if (!D || !D.links) return null; const ns = ((s.pos[pos] || {}).nb || []).map(p => xi[p]).filter(x => x && x !== pid);
    let n = 0, any = false; const w = []; for (const o of ns) { const k = pid < o ? pid + '|' + o : o + '|' + pid, v = (D.links.pairs || {})[k]; if (v) { n += v[0]; any = true; if (v[0] > 0) w.push(o); } }
    return { n, any, with: w, pos: ((s.pos[pos] || {}).nb || []) };
  }
  const dirFor = () => typeof directorFor === 'function' ? latestWith(directorFor) : null;
  // likely swap (brief: from the CURRENT shortlist): the Director's XI pick when it differs, else the shortlist option at this
  // position that we can verdict (in swapdata), else the Director's alternative
  function likelySwap(s, pos, pid, xi) {
    const dv = dirFor(), v = (dv || {}).v || {}, sl = ((v.best_xi || {}).slots || []).find(x => x.pos === pos), D = SW(); if (!D || !D.players) return null;
    const ok = id => id && D.players[id] && id !== pid && !Object.values(xi).includes(id);
    if (sl && ok(pidOf(sl.player))) return { pid: pidOf(sl.player), tag: 'Director' };
    const P = ((v.shortlist || {}).positions || []).find(x => x.pos === pos);
    if (P) { const opts = [...Object.values(P.tiers || {}).flat(), ...(P.extra || [])].map(o => pidOf(o.lookup || o.name)).filter(ok);
      const ranked = opts.map(id => ({ id, v: verdictFor(s, pos, id, pid, xi) })).filter(x => x.v && isNum(x.v.score)).sort((a, b) => b.v.score - a.v.score);
      if (ranked.length) return { pid: ranked[0].id, tag: 'shortlist' }; }
    if (sl && sl.alt && ok(pidOf(sl.alt))) return { pid: pidOf(sl.alt), tag: 'Director alt.' };
    return null;
  }

  // ---------- role model (phase views) ----------
  // [dx, dy] in Figma px; s = side (-1 left, +1 right, 0 centre); "in" = towards the middle
  function phaseDelta(view, pos, role, s, xiRoles) {
    const side = /^L/.test(pos) ? -1 : /^R/.test(pos) ? 1 : 0, b = base(pos), r = String(role || '');
    if (view === 1) {   // in possession (5b 276:3655)
      if (b === 'GK') return [0, 18];
      if (/^(LB|RB|LWB|RWB)$/.test(pos)) { if (/Attacking Wingback|^Wingback/.test(r)) return [side * 15, -240]; if (/Falseback|Inverted/.test(r)) return [-side * 120, -60]; if (/Fullback/.test(r)) return [-side * 70, 40]; return [0, -40]; }
      if (b === 'CB') { let dx = 0; for (const fb of ['LB', 'RB']) { if (/Fullback/.test(xiRoles[fb] || '')) { const t = fb === 'LB' ? -1 : 1; dx += side === t ? -t * 70 : -t * 10; } } return [dx, -30]; }
      if (b === 'CDM' || b === 'CM') { if (/Box-To-Box/.test(r)) return [0, -80]; if (/Deep-Lying/.test(r)) return [-side * 10, -35]; return [-side * 10, -25]; }
      if (b === 'CAM') { if (/Shadow Striker|Box Crasher/.test(r)) return [0, -110]; return [150, -75]; }
      if (/^(LM|RM|LW|RW)$/.test(pos)) { if (/Inside Forward/.test(r)) return [-side * 90, 10]; if (/Wide Playmaker/.test(r)) return [-side * 60, 20]; if (/Winger/.test(r)) return [side * 75, -5]; return [0, -20]; }
      if (b === 'ST') return /False 9/.test(r) ? [0, 60] : [0, -12];
      return [0, 0];
    }
    if (view === 2) {   // out of possession (5c 276:3939)
      if (b === 'GK') return [0, -2];
      if (b === 'CB') return [-side * 5, -50];
      if (/^(LB|RB|LWB|RWB)$/.test(pos)) return [0, -5];
      if (b === 'CDM' || b === 'CM') return [0, -40];
      if (b === 'CAM') return [150, -115];
      if (/^(LM|RM|LW|RW)$/.test(pos)) { if (/Winger/.test(r) && !/Wide Playmaker/.test(r)) return [side * 40, 115]; if (/Wide Playmaker|Wide Midfielder/.test(r)) return [-side * 20, 115]; return [0, 0]; }
      return [0, 0];
    }
    return [0, 0];
  }
  const ghostWorthy = (pos, d) => !/^(GK|CB|CDM|CM|ST)$/.test(base(pos)) && Math.hypot(d[0], d[1]) >= 40;

  // ---------- rendering: board ----------
  function cardHtml(s, s1, pos, pid, st, xy, focusPos) {
    const i = info(pid), role = roleOf(s, st, pos), focus = focusOf(s, st, pos);
    const carried = T.carry && T.carry.kind === 'tile' && T.carry.pos === pos;
    let refused = false;
    if (T.carry && !carried) refused = (info(T.carry.pid).natural === 'GK') !== (pos === 'GK');
    const warn = !carried && oop(pid, pos);
    const b1 = s1 && s1.pos[pos], chg = T.view === 3 ? !!(s1 && s1.n !== s.n && b1 && (b1.role !== role || b1.focus !== focus))
      : T.view === 0 && !!(st && (st.xi[pos] !== (s.pos[pos] || {}).starter || st.roles[pos] || (st.focus || {})[pos]));   // round 7 T4: differs from the saved slot
    const en = isNum((i.p.at || {}).energy) ? i.p.at.energy : i.sp && i.sp.condition && isNum(i.sp.condition.energy) ? i.sp.condition.energy : null;
    const cls = ['pc', carried ? 'up' : '', refused ? 'dis' : '', warn ? 'warn' : '', chg ? 'chg' : '', T.view ? 'noa' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-pos="${pos}" data-pid="${esc(pid)}" style="--x:${xy[0]};--y:${xy[1]}" aria-label="${esc(i.name)}, ${esc(role)}, ${pos}${warn ? ', out of position' : ''}"${refused ? ' aria-disabled="true"' : ''}>
      <span class="fr"><span class="fc">${portrait(i.p, 'M')}</span>${warn ? '<i class="wn" aria-hidden="true"></i>' : ''}<em class="ps">${pos}</em><b class="ov">${i.ovr ?? '–'}</b></span>
      <span class="en">${isNum(en) ? `<i style="width:${Math.max(0, Math.min(100, en))}%"></i>` : ''}</span>
      <span class="np">${carried ? '<i class="sw" aria-hidden="true"></i>' : '<i class="ag" aria-hidden="true">A</i>'}<b>${esc(i.name)}</b></span>
      <span class="rl">${chg ? `<i class="tg">${esc([role, focus].filter(Boolean).join(' · '))}</i>` : esc(role)}</span></button>`;
  }
  function boardHtml(s, s1, st) {
    const v = T.view, xiRoles = Object.fromEntries(Object.keys(st.xi).map(p => [p, roleOf(s, st, p)]));
    let ghosts = '', arrows = '';
    const cards = Object.entries(st.xi).map(([p, pid]) => {
      const xy0 = CARD_XY[p] || [318, 240], d = v === 1 || v === 2 ? phaseDelta(v, p, xiRoles[p], s, xiRoles) : [0, 0], xy = [xy0[0] + d[0], xy0[1] + d[1]];
      if ((v === 1 || v === 2) && ghostWorthy(p, d)) {
        const gx = xy0[0] + 72, gy = xy0[1] + 31, tx = xy[0] + 72, ty = xy[1] + 31, L = Math.hypot(tx - gx, ty - gy);
        // the arrow stops where it meets the moved card (box 144 x 117 + 6 px), so it never runs through the name or role
        const bx0 = xy[0] - 6, bx1 = xy[0] + 150, by0 = xy[1] - 6, by1 = xy[1] + 123; let t0 = 0, t1 = 1;
        [[-(tx - gx), gx - bx0], [tx - gx, bx1 - gx], [-(ty - gy), gy - by0], [ty - gy, by1 - gy]].forEach(([pp, q]) => { if (pp === 0) return; const r = q / pp; if (pp < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); });
        const k = Math.max(0.1, Math.min(1, t0 > 0 ? t0 : (L - 40) / L));
        ghosts += `<circle class="gh" cx="${gx}" cy="${gy}" r="9"/>`;
        arrows += `<line class="mv" x1="${gx + (tx - gx) * 12 / L}" y1="${gy + (ty - gy) * 12 / L}" x2="${gx + (tx - gx) * k}" y2="${gy + (ty - gy) * k}" marker-end="url(#tvArr)"/>`;
      }
      return cardHtml(s, s1, p, pid, st, xy);
    }).join('');
    const ov = ghosts ? `<svg class="tv-mv" viewBox="0 0 780 660" aria-hidden="true"><defs><marker id="tvArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z"/></marker></defs>${arrows}${ghosts}</svg>` : '';
    if (v === 0 && (st.changes || st.unsaved || st.hasPlan)) return `<div class="tv-board" data-nomin><img class="tv-pitch" src="assets/pitch_teamsheet.svg" alt="">${ov}${cards}</div>${whatIfBar(s, st)}`;
    return `<div class="tv-board" data-nomin><img class="tv-pitch" src="assets/pitch_teamsheet.svg" alt="">${ov}${cards}</div>
      <div class="tv-cap"><h3>${esc(VIEWS[v])}</h3><div class="ln"><button type="button" class="tv-sw" data-view="1" tabindex="-1"><span class="gl st">R</span>Switch View</button><span class="dots">${VIEWS.map((_, k) => `<i class="${k === v ? 'on' : ''}"></i>`).join('')}</span><span class="nt">${esc(NOTES[v])}</span></div></div>`;
  }
  function subHtml(x) {
    const carried = T.carry && T.carry.kind === 'sub' && T.carry.pid === x.pid;
    const refused = T.carry && !carried && T.carry.kind === 'tile' && (x.natural === 'GK') !== (T.carry.pos === 'GK');
    const en = x.p.at && isNum(x.p.at.energy) ? x.p.at.energy : x.sp && x.sp.condition && isNum(x.sp.condition.energy) ? x.sp.condition.energy : null;
    const g = { DEF: 'def', GK: 'def', MID: 'mid', ATT: 'att' }[x.group] || 'na';
    return `<button type="button" class="sbt${carried ? ' up' : ''}${refused ? ' dis' : ''}" data-sub="${esc(x.pid)}"${refused ? ' aria-disabled="true"' : ''} aria-label="${esc(x.name)}, ${esc(x.natural || '')}, ${x.ovr ?? '–'}">
      <span class="ps ${g}">${esc(x.natural || '–')}</span><span class="fc">${portrait(x.p, 'M')}</span><span class="ov">${x.ovr ?? '–'}</span>
      <span class="en">${isNum(en) ? `<i style="width:${en}%"></i>` : ''}</span><span class="nm">${carried ? '<span class="ag">A</span>' : ''}${esc(x.name)}</span></button>`;
  }
  function benchPanel(st, s) {
    const b = bench(s, st.xi);
    return `<section class="tb-bench"><header><b>Substitutes</b><span>${b.length}</span></header><div class="tb-subs fc-scroll">${b.map(subHtml).join('') || '<p class="empty-note">Not captured</p>'}</div></section>`;
  }
  // grid brief G3: the slots are the ONE Sub-tab Bar (y 140); the slot settings strip is its band meta (x 900)
  function slotTabs(all, s, meta) {
    return GRID.stb(all.map(x => ({ label: x.name || 'Slot ' + x.n + ' · not captured', on: x.n === s.n, attrs: ` data-slot="${x.n}"` })), { label: 'Tactic slots', meta, cls: 'tb-tabs' + (T.carry ? ' dim' : '') });
  }
  // slot settings strip (Data Cells S, captured): Formation · Build-up · Def. approach · Line height · captured game date
  function settingsStrip(s, s1) {
    const C = CS(), inf = ((C || {}).field_status || {}).inferred || [], asof = C && C.as_of ? dShort(C.as_of.game) : '';
    const dif = (a, b) => s1 && s1.n !== s.n && a !== b ? 'gold' : '';
    const cell = (v, l, tone, tag) => `<span class="dcell s"><span class="k">${esc(l)}${tag ? ` <i>${esc(tag)}</i>` : ''}</span><span class="v ${tone || ''}">${v == null || v === '' ? '–' : esc(String(v))}</span></span>`;
    return `<div class="tv-set">${cell(s.formation, 'Formation', dif(s.formation, (s1 || {}).formation))}${cell(s.build, 'Build-up', dif(s.build, (s1 || {}).build))}${cell(s.def, 'Def. approach', dif(s.def, (s1 || {}).def))}${cell(s.line, 'Line height', dif(s.line, (s1 || {}).line), inf.includes('line_height') ? 'inferred' : '')}${asof ? cell(asof, 'captured (game date)') : ''}</div>`;
  }

  // ---------- rendering: panels ----------
  const pair = (l, v, o = {}) => `<div class="ip"><span class="k">${esc(l)}</span><b class="${o.tone || ''}">${v == null || v === '' ? '–' : v}</b>${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</div>`;
  const dcell = (l, v, o = {}) => `<div class="dcell"><span class="k">${esc(l)}</span><span class="v ${o.tone || ''}">${v == null || v === '' ? '–' : v}${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</span></div>`;
  const toneE = v => !isNum(v) ? 'muted' : v >= 80 ? 'pos' : v < 60 ? 'neg' : '';
  const ratings = i => { const f = i.sp && i.sp.form; if (f && Array.isArray(f.last)) return f.last.filter(x => isNum(x.r)).map(x => x.r); return ((i.p.st || {}).ratings || []).filter(x => x.counted !== false && isNum(x.rating)).map(x => x.rating); };
  function headHtml(i, posLine) {
    const parts = String(i.name).split(' '), last = parts.length > 1 ? parts.pop() : parts[0];
    const full = i.ex && i.ex.display_name ? i.ex.display_name.split(' ') : null, fn = full && full.length > 1 ? full.slice(0, -1).join(' ') : (parts.length && parts[0] !== last ? parts.join(' ') : '');
    return `<div class="tv-ph"><span class="pf">${portrait(i.p, 'L')}</span><div class="id"><div class="pov"><b>${i.ovr ?? '–'}</b><i>|</i><span>${esc(posLine)}</span>${i.ovrExt ? '<small>OVR ext.</small>' : ''}</div>${fn ? `<div class="fn">${esc(String(fn).toUpperCase())}</div>` : ''}<div class="ln">${esc(String(last).toUpperCase())}</div></div></div>`;
  }
  function playerPanel(s, pos, pid, st) {
    const i = info(pid), cond = (i.sp && i.sp.condition) || {}, at = i.p.at || {}, role = pos ? roleOf(s, st, pos) : null, focus = pos ? (s.pos[pos] || {}).focus : null;
    const key = pos ? keyOf(s, st, pos) : null, fit = fitOf(pid, key), rp = pos ? rolePlus(pid, pos, role) : null;
    const en = isNum(cond.energy) ? cond.energy : isNum(at.energy) ? at.energy : null, sh = isNum(cond.sharpness) ? cond.sharpness : isNum(at.sharpness) ? at.sharpness : null;
    const cdate = dShort(cond.as_of), rs = ratings(i), form = i.sp && i.sp.form, morale = cond.morale || at.morale || null;
    const apps = i.sp && i.sp.apps && isNum(i.sp.apps.v) ? i.sp.apps.v : isNum(i.p.apps) ? i.p.apps : null;
    const ga = isNum(i.p.goals) || isNum(i.p.assists) ? `${i.p.goals || 0} + ${i.p.assists || 0}` : null, lk = pos ? linksWith(pid, pos, s, st.xi) : null;
    const foot = (i.sp && i.sp.foot && i.sp.foot.v) || at.foot || null;
    const left = [pair('Role fit', isNum(fit) ? fit.toFixed(1) : null, { tag: isNum(fit) ? 'est.' : '' }), pair('Role+', rp == null ? null : rp ? 'Yes' : 'No', { tone: rp ? 'pos' : '', tag: rp == null ? '' : 'ext.' }),
      pair('Natural', esc(i.natural || '')), pair('Foot', esc(foot || '')), pair('Energy', en, { tone: toneE(en), tag: isNum(en) ? cdate : 'not captured' }), pair('Sharpness', sh, { tone: toneE(sh), tag: isNum(sh) ? cdate : 'not captured' })].join('');
    const right = [pair('Form', form && isNum(form.avg) ? form.avg.toFixed(2) : null, { tone: form && form.avg >= 7 ? 'pos' : form && form.avg < 6 ? 'neg' : '', tag: form && form.n ? `${form.n} rated` : 'no ratings' }),
      pair('Latest', rs.length ? rs[rs.length - 1].toFixed(1) : null, { tag: rs.length ? 'official' : '' }), pair('Apps', apps), pair('G + A', ga, { tone: ga && ga !== '0 + 0' ? 'pos' : '' }),
      pair('Links', lk && lk.any ? `${lk.n} pass${lk.n === 1 ? '' : 'es'}` : null, { tone: 'muted', tag: lk && lk.any ? 'est.' : '' }), pair('Morale', esc(morale || ''), { tone: /very happy|^happy/i.test(morale || '') ? 'pos' : /unhappy/i.test(morale || '') ? 'neg' : '', tag: morale ? cdate : '' })].join('');
    let asst = '';
    if (pos && SW()) {
      const sw = likelySwap(s, pos, pid, st.xi);
      if (sw) {
        const v = verdictFor(s, pos, sw.pid, pid, st.xi), A = info(sw.pid), fa = fitOf(sw.pid, key), fb = fit, fA = A.sp && A.sp.form, fB = form;
        const sc = v && isNum(v.score) ? v.score : null, word = sc == null ? 'n/a' : Math.abs(sc) < 2 ? 'level' : sc > 0 ? 'helps' : 'costs';
        const line = sc == null ? (v && v.warnings[0]) || '' : `${title(word)}${v.parts && isNum(v.parts.fit) ? ' on role fit' : ''}${v.warnings.length ? `; ${v.warnings[0].replace(/^(\S+) never seen in our career captures$/, '$1 has no ratings or squad read in our save yet: check Squad Hub first')}` : ''}.`;
        asst = `<div class="tv-asst"><div class="at"><b>Assistant</b><span>Likely swap ${sw.tag === 'shortlist' ? 'from the shortlist' : 'from the Director'}</span></div>
          <div class="cells">${dcell('Likely swap', esc(A.name), { tag: sw.tag })}${dcell('Verdict', sc == null ? null : fmt1(sc), { tone: word === 'helps' ? 'pos' : word === 'costs' ? 'neg' : 'muted', tag: word })}${dcell('Role fit', isNum(fa) && isNum(fb) ? `${Math.round(fa)} vs ${Math.round(fb)}` : null, { tag: 'est.' })}${dcell('Form', fA && fB && isNum(fA.avg) && isNum(fB.avg) ? `${fA.avg.toFixed(1)} vs ${fB.avg.toFixed(1)}` : null, { tone: 'muted', tag: fA && fA.n ? `${fA.n} rated` : 'no ratings' })}</div>
          ${line ? `<p class="why">${esc(line)}</p>` : ''}</div>`;
      } else asst = `<div class="tv-asst"><div class="at"><b>Assistant</b><span>No likely swap in the data for ${esc(pos)}</span></div></div>`;
    } else if (!SW()) asst = '<div class="tv-asst"><div class="at"><b>Assistant</b><span>Verdict not captured yet (swap data missing)</span></div></div>';
    const posLine = pos ? [pos, role, focus].filter(Boolean).join(' · ') : [i.natural, 'Substitute'].filter(Boolean).join(' · ');
    return `<section class="tv-panel tv-player">${headHtml(i, posLine)}<div class="dv"></div><h4 class="tv-h">Player Info</h4>
      <div class="tv-info"><div class="col">${left}</div><div class="rule"></div><div class="col">${right}</div></div><div class="dv"></div>${asst}</section>`;
  }
  function swapPanel(s, pos, pin, pout, st, applied) {
    const A = info(pin), B = info(pout), role = roleOf(s, st, pos), focus = (s.pos[pos] || {}).focus || '', key = keyOf(s, st, pos);
    const xi = Object.assign({}, st.xi), v = verdictFor(s, pos, pin, pout, xi);
    const fa = fitOf(pin, key), fb = fitOf(pout, key), num = (x, y) => isNum(x) && isNum(y) && x !== y ? (x > y ? 'l' : 'r') : null;
    const side = /^L/.test(pos) ? 'left' : /^R/.test(pos) ? 'right' : '', footOk = f => side ? (side === 'left' ? f === 'Left' : f === 'Right') : null;
    const fl = (B.sp && B.sp.foot && B.sp.foot.v) || (B.p.at || {}).foot || '–', fr = (A.sp && A.sp.foot && A.sp.foot.v) || (A.p.at || {}).foot || '–';
    const oB = oop(pout, pos), oA = oop(pin, pos), rB = ratings(B), rA = ratings(A), aB = rB.length ? rB.reduce((x, y) => x + y, 0) / rB.length : null, aA = rA.length ? rA.reduce((x, y) => x + y, 0) / rA.length : null;
    const lkB = linksWith(pout, pos, s, xi), lkA = linksWith(pin, pos, s, xi);
    const eB = (B.sp && B.sp.condition || {}).energy ?? (B.p.at || {}).energy, eA = (A.sp && A.sp.condition || {}).energy ?? (A.p.at || {}).energy;
    const row = (label, l, r, better) => { const c = (o, b) => `<span class="${b ? 'better' : ''}${o.t === '–' ? ' miss' : ''}">${esc(o.t)}${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</span>`; return `<div class="cmp-row">${c(l, better === 'l')}<em>${esc(label)}</em>${c(r, better === 'r')}</div>`; };
    const nat = x => x.natural && base(pos) === base(x.natural);
    const nb = lkB ? lkB.pos.filter(p => p !== pos).join(' ') : '';
    const rows = [
      row('Natural position', { t: B.natural || '–' }, { t: A.natural || '–' }, nat(B) && !nat(A) ? 'l' : nat(A) && !nat(B) ? 'r' : null),
      row(`Role fit · ${role}`, { t: isNum(fb) ? fb.toFixed(1) : '–', tag: isNum(fb) ? 'est.' : '' }, { t: isNum(fa) ? fa.toFixed(1) : '–', tag: isNum(fa) ? 'est.' : '' }, num(fb, fa)),
      row('Out of position', { t: oB ? 'Yes' : 'No' }, { t: oA ? 'Yes' : 'No' }, oB && !oA ? 'r' : oA && !oB ? 'l' : null),
      side ? row(`Foot (${pos} = ${side} side)`, { t: fl }, { t: fr }, footOk(fl) && !footOk(fr) ? 'l' : footOk(fr) && !footOk(fl) ? 'r' : null) : '',
      row(`Match rating (${rB.length} rated)`, { t: isNum(aB) ? aB.toFixed(1) : '–' }, { t: isNum(aA) ? aA.toFixed(1) : '–' }, rB.length >= 3 && rA.length >= 3 ? num(aB, aA) : null),
      lkB && (lkB.any || (lkA && lkA.any)) ? row(`Passes with ${nb}`, { t: String(lkB.n), tag: 'est.' }, { t: String(lkA ? lkA.n : 0), tag: 'est.' }, num(lkB.n, lkA ? lkA.n : 0)) : '',
      row('Energy', { t: isNum(eB) ? String(eB) : '–' }, { t: isNum(eA) ? String(eA) : '–' }, num(eB, eA)),
    ].join('');
    const P = (v && v.parts) || {}, cells = [];
    if (v && v.refused) cells.push(dcell('Verdict', null, { tone: 'muted', tag: 'refused' }));
    else if (v) {
      cells.push(dcell('Verdict', isNum(v.score) ? fmt1(v.score) : null, { tone: v.score > 0 ? 'pos' : v.score < 0 ? 'neg' : 'muted', tag: 'code' }));
      if (isNum(P.fit)) cells.push(dcell('Role fit', fmt1(P.fit), { tone: P.fit > 0 ? 'pos' : P.fit < 0 ? 'neg' : '', tag: 'est.' }));
      if (isNum(P.oop) && P.oop) cells.push(dcell('Out of position', fmt1(P.oop), { tone: P.oop > 0 ? 'pos' : 'neg', tag: P.oop > 0 ? "'!' off" : "'!' on" }));
      if (isNum(P.links) && P.links) cells.push(dcell('Links (verdict pts)', fmt1(P.links), { tone: P.links > 0 ? 'pos' : 'neg', tag: lkB && lkA ? `${lkB.n} → ${lkA.n} passes est.` : 'est.' }));
      if (isNum(P.plus) && P.plus && cells.length < 4) cells.push(dcell('Role+', fmt1(P.plus), { tone: P.plus > 0 ? 'pos' : 'neg', tag: 'ext.' }));
      if (isNum(P.form) && P.form && cells.length < 4) cells.push(dcell('Form', fmt1(P.form), { tone: P.form > 0 ? 'pos' : 'neg', tag: 'official' }));
    }
    const why = [];
    if (v && v.refused) why.push(v.warnings[0] || 'GK and outfield do not swap');
    else if (v) {
      if (P.oop > 0) why.push(`Natural ${base(A.natural)} removes the "!" at ${pos}`); else if (P.oop < 0) why.push(`${A.name} gets the "!" at ${pos}`);
      else if (isNum(P.fit) && P.fit) why.push(`${P.fit > 0 ? 'Better' : 'Weaker'} ${role} fit`);
      if (P.links < 0 && lkB) { const nm = lkB.with.map(o => info(o).name); why.push(`the cost is his ${lkB.n} shared passes with ${nm.length > 1 ? nm.slice(0, -1).join(', ') + ' and ' + nm[nm.length - 1] : nm[0] || 'his neighbours'}`); }
      if (v.warnings.length) why.push(v.warnings[0]);
    }
    const ch = st.changes + (applied || pin === pout ? 0 : 1);
    return `<section class="tv-panel tv-swap"><header class="sw-h"><div class="sd"><span class="o"><b>${B.ovr ?? '–'}</b><small>OUT</small></span><span class="f">${portrait(B.p, 'M')}</span></div>
        <div class="vt"><h2>${applied ? `${esc(A.name)} at ${pos}` : `Swap at ${pos}`}</h2><small>${esc([role, focus, `Slot ${s.n}`].filter(Boolean).join(' · '))}</small></div>
        <div class="sd r"><span class="f">${portrait(A.p, 'M')}</span><span class="o"><b>${A.ovr ?? '–'}</b><small>IN</small></span></div></header>
      <div class="dv"></div><div class="sw-n"><b>${esc(B.name)}</b><span>Player Info Comparison</span><b>${esc(A.name)}</b></div>
      <div class="sw-rows">${rows}</div><div class="dv"></div>
      <div class="tv-asst"><div class="at"><b>Assistant</b><span>${applied ? 'What-if on this slot' : 'Updates with the focused target'}</span></div><div class="cells">${cells.slice(0, 4).join('')}</div>${why.length ? `<p class="why">${esc(why.join('; ').replace(/^./, c => c.toUpperCase()))}.</p>` : ''}</div>
      ${applied ? '' : `<p class="vp-note">${ch} change${ch === 1 ? '' : 's'} vs saved Slot ${s.n} if you swap</p>`}</section>`;
  }
  function slotComparePanel(s, s1, st, all) {
    if (!s1 || s1.n === s.n) return `<section class="tv-panel tv-cmp"><h2 class="sc-t">${esc(String(s.name).toUpperCase())}</h2><p class="sc-s">Slot ${s.n} is the baseline · LT RT another slot</p></section>`;
    const xi1 = captured(s1), same = Object.keys(st.xi).every(p => st.xi[p] === xi1[p]);
    const ch = Object.keys(s.pos).filter(p => s1.pos[p] && ((s.pos[p].role !== s1.pos[p].role) || (s.pos[p].focus !== s1.pos[p].focus)));
    const C = CS(), inf = (((C || {}).field_status || {}).inferred || []).includes('line_height');
    const dl = isNum(s.line) && isNum(s1.line) ? s.line - s1.line : null;
    const rows = ch.map(p => { const pid = st.xi[p], i = info(pid), o = s1.pos[p], n = s.pos[p], d = isNum(fitOf(pid, n.key)) && isNum(fitOf(pid, o.key)) ? fitOf(pid, n.key) - fitOf(pid, o.key) : null;
      return { p, pid, i, o, n, d, lost: rolePlus(pid, p, o.role) && !rolePlus(pid, p, n.role) }; });
    const lost = rows.filter(r => r.lost).length, plusBefore = rows.filter(r => rolePlus(r.pid, r.p, r.o.role)).length;
    const worst = rows.filter(r => isNum(r.d)).sort((a, b) => a.d - b.d)[0];
    let opt = null; for (const r of rows) for (const b of bench(s, st.xi)) { if (base(b.natural) !== base(r.p)) continue; const v = verdictFor(s, r.p, b.pid, r.pid, st.xi); if (v && isNum(v.score) && v.score > 0 && (!opt || v.score > opt.v.score)) opt = { r, b, v }; }
    // when to use it: the next-match card's line for this slot (opponent rule), never invented
    const card = ((window.FC26_NEXT || window.FC26_NEXTMATCH || {}).card || {}), chgL = (card.changes || []).map(c => ({ seg: String(c.what || '').split(/;\s*/).find(x => new RegExp(`\\bSlot ${s.n}\\b`).test(x)), rule: c.rule })).find(x => x.seg);
    const rr = r => `<div class="rc"><b class="p">${r.p}</b><span class="nm">${esc(r.i.name)}</span><span class="o">${esc(r.o.role || '–')}<small>${esc(r.o.focus || '')}</small></span><i class="ar" aria-hidden="true"></i><span class="n">${esc(r.n.role || '–')}<small>${esc(r.n.focus || '')}</small></span><b class="d ${isNum(r.d) ? (r.d < 0 ? 'neg' : r.d > 0 ? 'pos' : '') : 'muted'}">${isNum(r.d) ? fmt1(r.d) : '–'}</b><small class="t">fit est.</small></div>`;
    return `<section class="tv-panel tv-cmp"><h2 class="sc-t">${esc(String(s.name).toUpperCase())}</h2><p class="sc-s">Slot ${s.n} · differences from Slot ${s1.n} ${esc(s1.name)}</p><div class="dv"></div>
      <div class="cells">${dcell('Line height', s.line ?? null, { tone: dl ? 'gold' : 'muted', tag: [dl ? fmt1(dl) : 'same', inf ? 'inferred' : ''].filter(Boolean).join(' · ') })}${dcell('Build-up', esc(s.build || ''), { tone: s.build !== s1.build ? 'gold' : 'muted', tag: s.build === s1.build ? 'same' : 'changed' })}${dcell('Def. approach', esc(s.def || ''), { tone: s.def !== s1.def ? 'gold' : 'muted', tag: s.def === s1.def ? 'same' : 'changed' })}${dcell('Players', same ? 'Same XI' : `${Object.keys(st.xi).filter(p => st.xi[p] !== xi1[p]).length} changed`, { tone: same ? 'muted' : 'gold' })}</div>
      <div class="dv"></div><div class="at"><b>Changed roles</b><span>${ch.length} of ${Object.keys(s.pos).length} · role and focus · fit vs Slot ${s1.n}</span></div>
      <div class="rcs">${rows.map(rr).join('') || '<p class="empty-note">Same roles and focus as Slot 1</p>'}</div><div class="dv"></div>
      <div class="tv-asst"><div class="at"><b>Assistant</b></div><div class="cells">${dcell('Role+ lost', plusBefore ? `${lost} of ${plusBefore}` : null, { tone: lost ? 'neg' : 'pos', tag: 'ext.' })}${worst ? dcell('Biggest cost', `${esc(worst.i.name)} ${fmt1(worst.d)}`, { tone: worst.d < 0 ? 'neg' : '', tag: 'est.' }) : ''}${opt ? dcell(`${opt.r.p} option`, esc(opt.b.name), { tag: fmt1(opt.v.score) }) : ''}</div>
      ${chgL ? `<p class="why">Use it: ${esc(chgL.seg)}${chgL.rule ? ` (${esc(chgL.rule)}, next-match card)` : ''}.</p>` : ''}</div></section>`;
  }
  // what-if footer (round 2): "What-if · n changes vs Slot n" + Save as our plan (while unsaved) + Reset; "Our plan" once saved
  function planFoot(s, st) {
    const ch = st.changes; if (!ch && !st.hasPlan && !st.unsaved) return '';
    return `<div class="vp-foot"><span>${st.unsaved || !st.hasPlan ? `What-if · ${ch} change${ch === 1 ? '' : 's'} vs Slot ${s.n}` : `Our plan (saved ${esc(dShort((st.saved || {}).saved) || '')}) · ${ch} change${ch === 1 ? '' : 's'} vs the game's Slot ${s.n}`}</span>${st.unsaved ? '<button type="button" class="btn pri" data-act="save">Save as our plan</button>' : ''}<button type="button" class="btn" data-act="reset">Reset</button></div>`;
  }
  function panelFor(s, s1, st, all) {
    if (T.view === 3) return slotComparePanel(s, s1, st, all);
    if (T.picker && !T.view) return pickerPanel(s, st);
    const a0 = document.activeElement; if (a0 && a0.dataset && a0.dataset.act && a0.closest && a0.closest('#main .tv-wif')) return summaryPanel(s, st);
    const a = document.activeElement, pos = a && a.dataset && a.closest && a.closest('#main .tb2') ? a.dataset.pos : null, sub = a && a.dataset && a.closest && a.closest('#main .tb2') ? a.dataset.sub : null;
    const P = sub || (!pos && T.focusSub) ? null : (pos || T.focusPos || 'ST');
    if (T.carry && (pos || sub) && !T.view) {   // 5e preview: the carried player at the focused target
      if (pos && !(T.carry.kind === 'tile' && T.carry.pos === pos)) return swapPanel(s, pos, T.carry.pid, st.xi[pos], st, false);
      if (sub && T.carry.kind === 'tile') return swapPanel(s, T.carry.pos, sub, T.carry.pid, st, false);
    }
    const sp = P && st.xi[P] ? st.xi[P] : null;
    if (P && sp && !T.carry && !T.view && sp !== (s.pos[P] || {}).starter) return swapPanel(s, P, sp, (s.pos[P] || {}).starter, st, true);   // applied what-if (player change)
    if (sub || (!pos && T.focusSub)) return playerPanel(s, null, sub || T.focusSub, st);
    const p0 = P && st.xi[P] ? P : Object.keys(st.xi).includes('ST') ? 'ST' : Object.keys(st.xi)[0];
    return playerPanel(s, p0, st.xi[p0], st);
  }
  function page() {
    const all = slots(); if (!all.length) return dataReady() ? '<div class="tile empty">No saved tactic slots captured yet: open Edit Tactic in the game once per slot.</div>' : loadingHtml();
    if (T.slot == null || !all.some(x => x.n === T.slot)) T.slot = (CS() && CS().active_slot) || all[0].n;
    const s = all.find(x => x.n === T.slot), s1 = all.find(x => x.n === 1) || all[0], st = state(s);
    return `<div class="tb2 tv2 v${T.view}${T.carry ? ' carry' : ''}">${slotTabs(all, s, settingsStrip(s, s1))}
      <div class="tv-grid" data-grid="g3"><div class="tv-left">${boardHtml(s, s1, st)}</div>${benchPanel(st, s)}<div class="tb-right">${panelFor(s, s1, st, all)}</div></div></div>`;
  }
  // ---------- redraw keeping the focus ----------
  function focusKey(el) { if (!el || !el.dataset) return null; if (el.dataset.pos) return `.pc[data-pos="${el.dataset.pos}"]`; if (el.dataset.sub) return `[data-sub="${el.dataset.sub}"]`; if (el.dataset.act) return `[data-act="${el.dataset.act}"]`; return null; }
  function redraw(want) {
    const root = document.querySelector('#main .tb2'); if (!root) return;
    const k = want || focusKey(document.activeElement), sc = root.querySelector('.tb-subs'), top = sc ? sc.scrollTop : 0;
    const w = document.createElement('div'); w.innerHTML = page(); root.replaceWith(w.firstElementChild);
    const ns = document.querySelector('#main .tb-subs'); if (ns) ns.scrollTop = top;
    const el = k && document.querySelector('#main .tb2 ' + k);
    if (el) { el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); }
    try { prompts(); } catch (e) { /* */ }
  }
  function panelOnly() { const all = slots(), s = all.find(x => x.n === T.slot), s1 = all.find(x => x.n === 1) || all[0]; if (!s) return; const r = document.querySelector('#main .tb-right'); if (r) r.innerHTML = panelFor(s, s1, state(s), all); try { prompts(); } catch (e) { /* */ } }
  // ---------- actions ----------
  const cur = () => slots().find(x => x.n === T.slot);
  function ensureWi(s) { if (!T.wi[s.n]) { const st = state(s); T.wi[s.n] = { xi: Object.assign({}, st.xi), roles: Object.assign({}, st.roles), focus: Object.assign({}, st.focus || {}) }; } return T.wi[s.n]; }
  function pick(el) {
    if (!el || el.getAttribute('aria-disabled') === 'true' || T.view) return;
    const s = cur(), st = state(s);
    if (!T.carry) { T.carry = el.dataset.pos ? { kind: 'tile', pos: el.dataset.pos, pid: st.xi[el.dataset.pos] } : { kind: 'sub', pid: el.dataset.sub }; redraw(); return; }
    const c = T.carry, w = ensureWi(s);
    if (el.dataset.pos) {
      const p = el.dataset.pos, occ = w.xi[p];
      if (c.kind === 'tile' && c.pos === p) { T.carry = null; redraw(); return; }   // put down
      if (c.kind === 'tile') { w.xi[p] = c.pid; w.xi[c.pos] = occ; } else { w.xi[p] = c.pid; }
      delete w.roles[p]; if (c.kind === 'tile') delete w.roles[c.pos];
    } else if (el.dataset.sub) {
      if (c.kind === 'sub') { T.carry = null; redraw(); return; }
      w.xi[c.pos] = el.dataset.sub; delete w.roles[c.pos];
    }
    T.carry = null; tidy(s); redraw(el.dataset.pos ? `.pc[data-pos="${el.dataset.pos}"]` : `.pc[data-pos="${c.pos}"]`);
  }
  function tidy(s) { const w = T.wi[s.n]; if (!w) return; const saved = loadPlan(s.n); if (!saved && diffs(s, w.xi, w.roles, w.focus) === 0) delete T.wi[s.n]; }
  function save() {
    const s = cur(), st = state(s); if (!st.unsaved) return;
    savePlan(s.n, { xi: st.xi, roles: st.roles, focus: st.focus || {}, saved: new Date().toISOString().slice(0, 10), base: (s.seen || ''), label: 'our plan' });
    delete T.wi[s.n]; redraw('[data-act="reset"]');
  }
  function reset() { const s = cur(), st = state(s); if (T.wi[s.n]) delete T.wi[s.n]; else if (st.hasPlan) dropPlan(s.n); T.carry = null; T.picker = null; redraw(`.pc[data-pos="${T.focusPos || 'ST'}"]`); }
  function slotStep(d) {   // per slot: its last focused card (Pad parity 288:28804); a new slot starts on the ST card
    const all = slots(), i = all.findIndex(x => x.n === T.slot); T.mem = T.mem || {};
    const k = focusKey(document.activeElement); if (k) T.mem[T.slot] = k;
    T.slot = all[(i + d + all.length) % all.length].n; T.carry = null; T.picker = null; redraw(T.mem[T.slot] || '.pc[data-pos="ST"]');
  }
  function viewStep() { T.view = (T.view + 1) % VIEWS.length; T.carry = null; T.picker = null; redraw(`.pc[data-pos="${T.focusPos || 'ST'}"]`); }
  // ---------- round 7 (brief 2026-11-25_tactics-edit; Figma T1 307:36332 · T2 307:36806 · T3 307:37322 · T4 307:37818 · T5 307:38306):
  // Role & Focus picker in the side panel (X), What-if Bar under the board, What-if Summary Panel, loading skeleton. Formation fixed. ----------
  // the FC 26 roles of a position: the role names the data holds for its bucket (house weights in swapdata, the four captured slots,
  // the players' Role+ list [ext], the role fits of the player profiles); a role without house weights = "fit not measured"
  function bucketMap() {
    const D = SW(), m = {}; ((D || {}).slots || []).forEach(sl => Object.entries(sl.positions || {}).forEach(([p, v]) => { if (v.bucket) { m[p] = v.bucket; m[base(p)] = m[base(p)] || v.bucket; } })); return m;
  }
  function roleCatalogue(bucket) {
    const D = SW(), bm = bucketMap(), roles = new Map(), add = (r, f) => { if (!r) return; const k = String(r).trim(); if (!roles.has(k)) roles.set(k, new Set()); if (f) roles.get(k).add(f); };
    // swapdata `roles` (every ROLE_MODELS role + default focus + the captured slot focuses) is the catalogue; the rest only adds names
    const cat0 = D && D.roles && D.roles[bucket];
    if (cat0) cat0.forEach(e => { add(e.role, e.focus); (e.focuses || []).forEach(f => add(e.role, f)); });
    if (D && D.weights) Object.keys(D.weights).filter(k => k.split('|')[0] === bucket).forEach(k => add(k.split('|')[1]));
    ((D || {}).slots || []).forEach(sl => Object.values(sl.positions || {}).forEach(v => { if (v.bucket === bucket) add(v.role, v.focus); }));
    Object.values((D || {}).players || {}).forEach(sp => (((sp.role_plus || {}).v) || []).forEach(r => { if (bm[r.pos] === bucket || bm[base(r.pos)] === bucket) add(r.role); }));
    const prof = [...Object.values(((window.FC26_CAREER || {}).players) || {}), ...Object.values(((window.FC26_EXTERNAL || {}).players) || {})];
    if (!cat0) prof.forEach(pl => (((pl || {}).profile || {}).role_fits || []).forEach(rf => { if (bm[rf.pos] === bucket || bm[base(rf.pos)] === bucket) add(rf.role, rf.focus); }));
    return roles;
  }
  const focusOf = (s, st, p) => (st && st.focus && st.focus[p]) || (s.pos[p] || {}).focus || '';
  function roleOptions(s, st, pos, pid) {
    const sp = s.pos[pos] || {}, b = sp.bucket || (sp.key || '').split('|')[0], cat = roleCatalogue(b), saved = sp.role, cur = roleOf(s, st, pos);
    const f0 = fitOf(pid, `${b}|${saved}`), warn = oop(pid, pos);
    const opts = [...cat.keys()].map(r => { const f = fitOf(pid, `${b}|${r}`), rp = rolePlus(pid, pos, r);
      const fx = [...(cat.get(r) || [])]; if (r === saved && sp.focus && !fx.includes(sp.focus)) fx.unshift(sp.focus); else if (r === saved && sp.focus) { fx.splice(fx.indexOf(sp.focus), 1); fx.unshift(sp.focus); }
      return { role: r, fit: f, d: isNum(f) && isNum(f0) ? f - f0 : null, saved: r === saved, current: r === cur, plus: !warn && !!rp, focuses: fx.length ? fx : [''], tag: !isNum(f) ? 'fit not measured' : r === saved ? `saved in slot ${s.n}` : warn ? 'Role+ off here (!)' : rp ? `Role${rp} (ext.)` : '' }; });
    return opts.sort((x, y) => (y.saved - x.saved) || ((isNum(y.fit) ? 1 : 0) - (isNum(x.fit) ? 1 : 0)) || ((y.fit || 0) - (x.fit || 0)) || x.role.localeCompare(y.role));
  }
  const up = s => String(s || '').toUpperCase();
  function pickerPanel(s, st) {
    const P = T.picker, pos = P.pos, pid = st.xi[pos], i = info(pid), opts = roleOptions(s, st, pos, pid), sp = s.pos[pos] || {};
    const o = opts[Math.min(P.i, opts.length - 1)] || opts[0], warn = oop(pid, pos), focusV = (o && o.focuses[P.f % o.focuses.length]) || '';
    const rows = opts.map((x, k) => `<button type="button" class="ro-row${x.current ? ' cur' : ''}${isNum(x.fit) ? '' : ' nm'}" data-ro="${k}"><i class="ck" aria-hidden="true"></i><span class="rn"><b>${esc(x.role)}${x.plus ? '<em>+</em>' : ''}</b><small>${esc(x.tag)}</small></span><span class="rf ${isNum(x.fit) ? (x.d > 0 ? 'pos' : x.d < 0 ? 'neg' : 'gold') : 'muted'}">${isNum(x.fit) ? x.fit.toFixed(1) : '–'}<i>est.</i></span><span class="rd ${isNum(x.d) ? (x.d > 0 ? 'pos' : x.d < 0 ? 'neg' : '') : ''}">${isNum(x.d) ? (x.saved ? '0' : fmt1(x.d)) : ''}</span></button>`).join('');
    const nFocus = o ? o.focuses.filter(Boolean).length : 0;
    const sel = `<button type="button" class="ro-focus${nFocus > 1 ? ' arr' : ''}" data-rof="1"><span class="k">Focus</span><span class="v">${nFocus > 1 ? '<i class="al" aria-hidden="true"></i>' : ''}<b>${esc(up(focusV) || '–')}</b>${nFocus > 1 ? '<i class="ar" aria-hidden="true"></i>' : ''}</span></button>`;
    // the assistant verdict for the focused option (role change = role fit only; the swap verdict covers player changes)
    const fNow = fitOf(pid, keyOf(s, st, pos)), sc = o && isNum(o.fit) && isNum(fNow) ? o.fit - fNow : null, rp = o ? rolePlus(pid, pos, o.role) : null, form = i.sp && i.sp.form;
    let big = null; for (const b of bench(s, st.xi)) { if ((b.natural === 'GK') !== (pos === 'GK')) continue; const v = verdictFor(s, pos, b.pid, pid, st.xi); if (v && isNum(v.score) && (!big || v.score > big.v.score)) big = { b, v }; }
    const bigFit = big ? fitOf(big.b.pid, sp.key) : null;
    const cells = [dcell('Verdict', isNum(sc) ? fmt1(sc) : null, { tone: sc > 0 ? 'pos' : sc < 0 ? 'neg' : 'muted', tag: isNum(sc) ? 'fit only' : 'fit not measured' }),
      dcell('Role fit', o && isNum(o.fit) && isNum(fNow) ? `${o.fit.toFixed(1)} vs ${fNow.toFixed(1)}` : null, { tone: sc > 0 ? 'pos' : sc < 0 ? 'neg' : '', tag: 'est.' }),
      dcell('Role+', warn ? 'off' : rp == null ? null : rp ? 'Yes' : 'No', { tone: warn ? 'gold' : rp ? 'pos' : '', tag: warn ? `! at ${pos}` : rp == null ? '' : 'ext.' }),
      dcell('Form', form && isNum(form.avg) ? `${form.avg.toFixed(1)} (${form.n})` : null, { tag: form && form.n ? 'official · same player' : 'no ratings' })];
    const natTag = warn ? `<span class="nat"><b>Natural ${esc(i.natural || '–')}</b><i>! at ${pos}</i><i>Role+ off</i></span>` : '';
    return `<section class="tv-panel tv-pick"><header class="pk3-h"><span class="pf">${portrait(i.p, 'M')}</span><div class="id"><div class="pov"><b>${i.ovr ?? '–'}</b><i>|</i><span>${pos}</span></div><div class="ln">${esc(up(i.name))}</div></div>${natTag}</header>
      <div class="dv"></div><div class="at"><b>Role · ${pos}</b><span class="r">Slot ${s.n} ${esc(s.name)}</span></div>
      <div class="ro-list">${rows || '<p class="empty-note">Roles for this position not captured yet</p>'}</div>${sel}<div class="dv"></div>
      <div class="tv-asst"><div class="at"><b>Assistant</b><span>${o ? `${esc(o.role)} at ${pos} vs ${esc(sp.role || '–')}` : ''}</span></div><div class="cells c2">${cells.join('')}</div>
      ${big && isNum(big.v.score) && (!isNum(sc) || big.v.score > sc) ? `<div class="cells big">${dcell('Bigger win', `${esc(big.b.name)} at ${pos} ${fmt1(big.v.score)}`, { tone: big.v.score > 0 ? 'pos' : 'neg', tag: [big.b.natural && base(big.b.natural) === base(pos) ? `natural ${base(big.b.natural)}` : '', isNum(bigFit) ? `${sp.role} ${bigFit.toFixed(1)} est.` : ''].filter(Boolean).join(' · ') })}</div>` : ''}</div></section>`;
  }
  // each change of the what-if vs the saved slot, with the assistant's verdict (player change = FC26SwapVerdict; role / focus = fit only)
  function changesOf(s, st) {
    const out = [];
    Object.keys(s.pos).forEach(p => {
      const sp = s.pos[p], pin = st.xi[p], pout = sp.starter;
      if (pin && pin !== pout) { const v = verdictFor(s, p, pin, pout, st.xi); out.push({ pos: p, kind: 'player', from: info(pout).name, to: info(pin).name, inPid: pin, outPid: pout, score: v && isNum(v.score) ? v.score : null }); }
      const r = st.roles[p], f = st.focus && st.focus[p];
      if ((r && r !== sp.role) || (f && f !== sp.focus)) { const pid = pin, a = fitOf(pid, keyOf(s, st, p)), b = fitOf(pid, sp.key);
        out.push({ pos: p, kind: 'role', from: [sp.role, sp.focus].filter(Boolean).join(' · '), to: [roleOf(s, st, p), focusOf(s, st, p)].filter(Boolean).join(' · '), who: info(pid).name, score: isNum(a) && isNum(b) ? a - b : null }); }
    });
    return out;
  }
  const oopCount = (s, xi) => Object.keys(s.pos).filter(p => xi[p] && oop(xi[p], p)).length;
  function whatIfBar(s, st) {
    const ch = changesOf(s, st), net = ch.filter(c => isNum(c.score)).reduce((a, c) => a + c.score, 0), any = ch.some(c => isNum(c.score));
    const saved = !st.unsaved && st.hasPlan;
    return `<div class="tv-wif${saved ? ' saved' : ''}"><b class="t">${saved ? `OUR PLAN · Saved ${esc(dShort((st.saved || {}).saved) || '')}` : 'WHAT-IF'}</b><span class="dcell s"><span class="v">${ch.length}</span><span class="k">Changes</span></span>
      <span class="dcell s"><span class="v ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'muted'}">${any ? fmt1(net) : '–'}</span><span class="k">Net verdict <i>est.</i></span></span>
      <button type="button" class="pill" data-act="reset">Reset</button>${st.unsaved ? '<button type="button" class="pill y" data-act="save"><span class="gl c">Y</span>Save as our plan</button>' : ''}</div>`;
  }
  function summaryPanel(s, st) {
    const ch = changesOf(s, st), net = ch.filter(c => isNum(c.score)).reduce((a, c) => a + c.score, 0), any = ch.some(c => isNum(c.score));
    const was = oopCount(s, captured(s)), now = oopCount(s, st.xi), wasWho = Object.keys(s.pos).filter(p => oop(s.pos[p].starter, p)).map(p => `${info(s.pos[p].starter).name} ${p}`);
    const rows = ch.map(c => `<div class="wc-row"><b class="p">${c.pos}</b><span class="ft"><span>${esc(c.kind === 'player' ? c.from : c.from)}</span><span class="to"><i class="ar" aria-hidden="true"></i>${esc(c.to)}</span></span><b class="sc ${isNum(c.score) ? (c.score > 0 ? 'pos' : c.score < 0 ? 'neg' : '') : 'muted'}">${isNum(c.score) ? fmt1(c.score) : '–'}<i>${isNum(c.score) ? 'est.' : 'not measured'}</i></b></div>`).join('');
    const copy = ch.map(c => `<div class="cp"><b>${c.pos}</b><span>${esc(c.kind === 'player' ? `${c.to} in, ${c.from} to the bench` : `${c.who}: ${c.to}`)}</span><i>${c.kind === 'player' ? 'Team Management' : 'Edit Tactic › Player Roles'}</i></div>`).join('');
    const saved = !st.unsaved && st.hasPlan;
    return `<section class="tv-panel tv-wsum"><header class="ws-h"><h2>WHAT-IF</h2><span>Slot ${s.n} ${esc(s.name)} · vs saved</span></header><div class="dv"></div>
      <div class="wc-list">${rows || '<p class="empty-note">No change vs the saved slot</p>'}</div>
      <div class="cells">${dcell('Changes', ch.length)}${dcell('Net verdict', any ? fmt1(net) : null, { tone: net > 0 ? 'pos' : net < 0 ? 'neg' : 'muted', tag: any ? `sum of ${ch.filter(c => isNum(c.score)).length} · est.` : '' })}${dcell('Out of position (!)', now, { tone: now < was ? 'pos' : now > was ? 'neg' : '', tag: was !== now ? `was ${was}${wasWho.length ? ' · ' + wasWho.join(', ') : ''}` : '' })}</div><div class="dv"></div>
      <div class="ws-copy"><b class="hh">Copy into FC 26</b>${copy}<div class="cp f">Formation stays ${esc(s.formation || '–')} (saved slot)</div></div><div class="dv"></div>
      <div class="cells">${dcell('Status', saved ? 'Our plan' : 'Unsaved', { tone: saved ? 'pos' : 'muted', tag: saved ? `saved ${dShort((st.saved || {}).saved) || ''} · Reset drops it` : 'Y saves it as our plan · Reset drops it' })}</div></section>`;
  }
  // T5 loading (no data yet): skeleton cards / slot tabs / bench, "Loading saved slots"; no prompts (PAD_HOOKS.tacticsLoading)
  function loadingHtml() {
    const xy = ['GK', 'LCB', 'RCB', 'LB', 'RB', 'LCDM', 'RCDM', 'CAM', 'LM', 'RM', 'ST'].map(p => CARD_XY[p]);
    const card = ([x, y]) => `<span class="pc sk" style="--x:${x};--y:${y}" aria-hidden="true"><span class="fr"><span class="fc">${SIL_SK}</span><i class="b1"></i></span><span class="en"></span><i class="b2"></i></span>`;
    return `<div class="tb2 tv2 tv-loading" aria-busy="true"><div class="stb-sk" data-stb><i></i><i></i><i></i><i></i></div>
      <div class="tv-grid" data-grid="g3"><div class="tv-left"><div class="tv-board"><img class="tv-pitch" src="assets/pitch_teamsheet.svg" alt="">${xy.map(card).join('')}</div></div>
      <section class="tb-bench"><header><b>Substitutes</b></header><div class="tb-subs">${[0, 1, 2, 3, 4, 5].map(() => `<span class="sbt sk" aria-hidden="true"><span class="ps"></span><span class="fc">${SIL_SK}</span><span class="en"></span></span>`).join('')}</div></section>
      <div class="tb-right"><section class="tv-panel tv-skp"><h3>Loading saved slots</h3>${[100, 76, 100, 76, 100].map(w => `<i style="width:${w * 5}px"></i>`).join('')}</section></div></div></div>`;
  }
  const SIL_SK = '<span class="pt M sil"><img class="silimg" src="assets/silhouette_fc26.png" alt="" aria-hidden="true" draggable="false"></span>';
  const dataReady = () => (typeof allDaysLoaded === 'function' ? allDaysLoaded() : true);
  function choosePicked() {
    const s = cur(), st = state(s), P = T.picker; if (!P) return; const pos = P.pos, opts = roleOptions(s, st, pos, st.xi[pos]), o = opts[Math.min(P.i, opts.length - 1)]; if (!o) return;
    const f = o.focuses[P.f % o.focuses.length] || '', w = ensureWi(s), sp = s.pos[pos] || {}; w.focus = w.focus || {};
    if (o.role === sp.role) delete w.roles[pos]; else w.roles[pos] = o.role;
    if (!f || f === sp.focus) delete w.focus[pos]; else w.focus[pos] = f;
    T.picker = null; tidy(s); redraw(`.pc[data-pos="${pos}"]`);
  }
  function openPicker(el) {
    const s = cur(), st = state(s), pos = el.dataset.pos, opts = roleOptions(s, st, pos, st.xi[pos]);
    const i = Math.max(0, opts.findIndex(o => o.current)), o = opts[i] || { focuses: [''] }, f = Math.max(0, o.focuses.indexOf(focusOf(s, st, pos)));
    T.picker = { pos, i, f, origin: pos }; panelOnly(); document.querySelectorAll('#main .pc.pk').forEach(x => x.classList.remove('pk')); el.classList.add('pk'); const r = document.querySelector(`#main .tb-right [data-ro="${i}"]`); if (r) { r.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } try { prompts(); } catch (e) { /* */ }
  }
  function closePicker() { const P = T.picker; if (!P) return; T.picker = null; document.querySelectorAll('#main .pc.pk').forEach(x => x.classList.remove('pk')); panelOnly(); const c = document.querySelector(`#main .pc[data-pos="${P.pos}"]`); if (c) { c.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } try { prompts(); } catch (e) { /* */ } }
  function pickerFocus(k) { const el = k === 'f' ? document.querySelector('#main .tb-right [data-rof]') : document.querySelector(`#main .tb-right [data-ro="${k}"]`); if (el) { el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } try { prompts(); } catch (e) { /* */ } }
  REG.tactics = Object.assign(REG.tactics || {}, {
    title: () => 'Tactics', tabs: () => [], tabParam: 'tslot',
    need: () => (typeof ensureAllDays === 'function' ? ensureAllDays() : null), ready: () => (typeof allDaysLoaded === 'function' ? allDaysLoaded() : true),
    render() { T.carry = null; T.picker = null; return page(); },
    loading: () => loadingHtml(),   // core.js shows this while the day files load (T5), never the empty note
    after(S2, root) {
      const b = root.querySelector('.tb2'); if (!b) return;
      setTimeout(() => { const a = document.activeElement; if (!a || a === document.body || !a.closest('#main')) { const st = root.querySelector('.pc[data-pos="ST"]') || root.querySelector('.pc'); if (st) { st.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } } }, 0);
    },
  });
  // focus drives the panel (FC 26 Team Management)
  document.addEventListener('focusin', e => {
    const el = e.target; if (!el.closest || !el.closest('#main .tb2')) return;
    if (el.dataset.pos) { T.focusPos = el.dataset.pos; T.focusSub = null; } else if (el.dataset.sub) { T.focusSub = el.dataset.sub; }
    if (el.closest('.tb-right')) return; if (T.picker && (el.dataset.pos || el.dataset.sub)) T.picker = null; panelOnly();
  });
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('#main .tb2 .pc, #main .tb2 .sbt'); if (el && document.activeElement !== el) el.focus({ preventScroll: true }); });
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('#main .tb2 [data-slot]'); if (t) { if (!T.carry) { T.slot = +t.dataset.slot; redraw(); } return; }
    const a = e.target.closest && e.target.closest('#main .tb2 [data-act]'); if (a) { if (a.dataset.act === 'save') save(); else reset(); return; }
    const ro = e.target.closest && e.target.closest('#main .tb-right [data-ro]'); if (ro && T.picker) { T.picker.i = +ro.dataset.ro; choosePicked(); return; }
    const rf = e.target.closest && e.target.closest('#main .tb-right [data-rof]'); if (rf && T.picker) { const s = cur(), st = state(s), o = roleOptions(s, st, T.picker.pos, st.xi[T.picker.pos])[T.picker.i]; T.picker.f = (T.picker.f + 1) % ((o || {}).focuses || ['']).length; panelOnly(); pickerFocus('f'); return; }
    const el = e.target.closest && e.target.closest('#main .tb2 .pc, #main .tb2 .sbt'); if (el) { e.preventDefault(); pick(el); return; }
    const d = e.target.closest && e.target.closest('#main .tb2 [data-view]'); if (d) viewStep();
  });
  // ---------- pad map (brief §4; Leon 24 Nov layout-grid-and-pad-parity Decision 2: B does nothing on a top screen) ----------
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.tactics = {
    z: 1,
    active: () => typeof S === 'object' && S.page === 'tactics' && !T.picker && !!document.querySelector('#main .tb2:not(.tv-loading)'),
    prompts() {
      const a = document.activeElement, s = cur(); if (!s) return null; const st = state(s);
      if (T.carry) { const same = a && a.dataset && ((a.dataset.pos && T.carry.kind === 'tile' && a.dataset.pos === T.carry.pos) || (a.dataset.sub && a.dataset.sub === T.carry.pid)); return [['A', same ? 'Put down' : 'Swap here'], ['B', 'Cancel']]; }
      if (T.view) return [['LTRT', 'Slot'], ['R', 'Switch View']];
      if (a && a.dataset && a.dataset.act) return [['A', a.dataset.act === 'save' ? 'Save as our plan' : 'Reset'], ['LTRT', 'Slot'], ...(st.unsaved ? [['Y', 'Save as our plan']] : []), ['R', 'Switch View']];
      const inBench = a && a.closest && a.closest('.tb-bench');
      return [['A', 'Pick up'], ['LTRT', 'Slot'], ...(a && a.dataset && a.dataset.pos ? [['X', 'Role & focus']] : []), ...(st.unsaved ? [['Y', 'Save as our plan']] : []), inBench ? ['RS', 'Scroll'] : ['R', 'Switch View']];
    },
    press(k) {
      const a = document.activeElement, s = cur(); if (!s) return false;
      const bar = () => [...document.querySelectorAll('#main .tv-wif [data-act]')];
      if (a && a.dataset && a.dataset.act && /^(LEFT|RIGHT)$/.test(k)) { const bs = bar(), n = bs[bs.indexOf(a) + (k === 'RIGHT' ? 1 : -1)]; if (n) { n.focus({ preventScroll: true }); FC.gamepad.syncFocus(); panelOnly(); return true; } if (k === 'RIGHT') return true; }
      if (k === 'RIGHT' && a && a.dataset && a.dataset.sub && bar().length && !T.carry) { bar()[0].focus({ preventScroll: true }); FC.gamepad.syncFocus(); panelOnly(); return true; }   // → from the subs = the What-if Bar
      // the D-pad is the global spatial map; the panel follows the new focus
      if (/^(UP|DOWN|LEFT|RIGHT)$/.test(k)) { setTimeout(() => { const f = document.activeElement; if (f && f.dataset && f.closest && f.closest('#main .tb2')) { if (f.dataset.pos) { T.focusPos = f.dataset.pos; T.focusSub = null; } else if (f.dataset.sub) T.focusSub = f.dataset.sub; } if (!(f && f.closest && f.closest('.tb-right'))) panelOnly(); }, 0); return false; }
      if (k === 'A') { if (a && a.dataset && a.dataset.act) { if (a.dataset.act === 'save') save(); else reset(); return true; } if (T.view) return true; if (a && (a.classList.contains('pc') || a.classList.contains('sbt'))) { pick(a); return true; } return false; }
      if (k === 'B') { if (T.carry) { const c = T.carry; T.carry = null; redraw(c.kind === 'tile' ? `.pc[data-pos="${c.pos}"]` : `[data-sub="${c.pid}"]`); } return true; }   // nothing else on a top screen
      if (k === 'X') { if (T.view || T.carry) return true; if (a && a.classList && a.classList.contains('pc')) { openPicker(a); return true; } return true; }
      if (k === 'Y') { if (T.carry || T.view) return true; if (state(s).unsaved) { save(); return true; } return false; }
      if (k === 'LT' || k === 'RT') { if (T.carry) return true; slotStep(k === 'RT' ? 1 : -1); return true; }
      if (k === 'R') { if (T.carry) return true; viewStep(); return true; }
      return false;
    },
    scrollTarget: () => document.querySelector('#main .tb-subs'),
  };
  // Role & Focus picker (Deep, in the side panel): ↑↓ roles, ↓ past the last role = Focus (←→), A choose, B back to the card
  window.PAD_HOOKS.tacticsPicker = {
    z: 5,
    active: () => !!T.picker && typeof S === 'object' && S.page === 'tactics',
    prompts: () => [['A', 'Choose role'], ['B', 'Back']],
    press(k) {
      const P = T.picker, s = cur(), st = state(s), opts = roleOptions(s, st, P.pos, st.xi[P.pos]), a = document.activeElement, onF = !!(a && a.dataset && a.dataset.rof);
      if (k === 'UP' || k === 'DOWN') {
        if (onF) { if (k === 'UP') { P.i = opts.length - 1; panelOnly(); pickerFocus(P.i); } return true; }
        const ni = P.i + (k === 'DOWN' ? 1 : -1); if (ni >= opts.length) { pickerFocus('f'); return true; } if (ni < 0) return true;
        P.i = ni; P.f = Math.max(0, (opts[ni].focuses || []).indexOf(opts[ni].saved ? (s.pos[P.pos] || {}).focus : (opts[ni].focuses || [])[0])); panelOnly(); pickerFocus(P.i); return true;
      }
      if (k === 'LEFT' || k === 'RIGHT') { if (onF) { const o = opts[P.i], n = (o.focuses || ['']).length; if (n > 1) { P.f = (P.f + (k === 'RIGHT' ? 1 : n - 1)) % n; panelOnly(); pickerFocus('f'); } } return true; }
      if (k === 'A') { choosePicked(); return true; }
      if (k === 'B') { closePicker(); return true; }
      return true;
    },
  };
  window.PAD_HOOKS.tacticsLoading = { z: 9, active: () => typeof S === 'object' && S.page === 'tactics' && !!document.querySelector('#main .tv-loading'), prompts: () => [], press: () => true };
  addEventListener('hashchange', () => { if (T.picker && !/page=tactics/.test(location.hash)) T.picker = null; });
  window.TB2 = { get state() { return T; }, save, reset, slotStep, viewStep, pick, loadPlan, viewerKey, openPicker, closePicker, roleOptions: pos => { const s = cur(), st = state(s); return roleOptions(s, st, pos, st.xi[pos]); }, setView(v) { T.view = v; T.carry = null; T.picker = null; redraw(); } };
})();
