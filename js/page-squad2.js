// ---------- Squad (L5) · Figma round 2: 2a 219:6736 (compare), 2b 219:7095 (picker), 7b 225:8547 (list, X = Compare) ----------
// Brief docs/ui_changes/2026-11-24_squad-panel-profile-compare.md. Table panel 850 (Squad Row 232:2362, Table Header 179:894,
// Scrollbar 210:1542) + side panel 603 (profile, or Squad Compare Panel 219:2049 = FC 26 "Player Info Comparison").
// The compare picker is a modal list (Compare Picker 219:2050) with LT/RT groups. Pad map in PAD_HOOKS.squad / .squadPicker.
(function () {
  const band = v => !isNum(v) ? 'na' : v >= 70 ? 'g' : v >= 50 ? 'y' : 'r';   // Squad Row: attr/high ≥ 70, attr/mid 50–69, attr/poor < 50
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const asOf = () => { const lp = ((window.FC26_SQUAD || {}).club || {}).league_position || {}; const d = parseDate(lp.game_date); return d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` : ''; };
  const hasMoney = () => (((window.FC26_SQUAD || {}).squad_status) || []).some(r => r.data && (r.data.value || r.data.wage || r.data.contract));
  // Round 3 (brief squad-depth-by-age, Leon 2026-11-24): "Depth by age" REPLACES the Attributes preset (attributes stay in the
  // side panel and on the Player Profile). It is the default preset, in the Attributes slot. View: js/page-depth.js.
  const PRESETS = () => [['status', 'Status'], ['stats', 'Stats'], ['depth', 'Depth by age'], ...(hasMoney() ? [['financial', 'Financial']] : [])];
  const GK_ATTRS = [['diving', 'DIV'], ['handling', 'HAN'], ['kicking', 'KIC'], ['reflexes', 'REF'], ['speed', 'SPD'], ['positioning', 'POS']];
  const ATTR_NAMES = { pace: 'Pace', shooting: 'Shooting', passing: 'Passing', dribbling: 'Dribbling', defending: 'Defending', physical: 'Physical' };
  // merged list: career players + every squad-status capture (exact name match; latest capture fills OVR/positions/morale)
  function squadList() {
    const base = playerList().map(p => Object.assign({}, p, { at: Object.assign({}, p.at || {}) }));
    const byName = new Map(base.map(p => [fold(p.name), p]));
    for (const r of (((window.FC26_SQUAD || {}).squad_status) || [])) {
      if (!r.name) continue; let p = byName.get(fold(r.name));
      if (!p) { p = { name: r.name, id: fold(r.name), pos: (r.positions || [])[0] || '', played: r.positions || [], apps: 0, minutes: 0, goals: 0, assists: 0, at: {}, group: 'UNK', noProfile: true }; base.push(p); byName.set(fold(r.name), p); }
      if (!isNum(p.ovr) && isNum(r.ovr)) p.ovr = r.ovr;
      if (!p.pos && r.positions && r.positions[0]) p.pos = r.positions[0];
      if (r.positions && r.positions.length) p.natural = r.positions.slice();
      if (p.group === 'UNK' && p.pos) p.group = GROUP(p.pos);
      for (const k of ['morale', 'sharpness', 'energy']) if (r[k] != null && p.at[k] == null) p.at[k] = r[k];
      if (!isNum(p.age) && isNum(r.age)) p.age = r.age;
    }
    return base;
  }
  const natOf = q => ((q.natural && q.natural.length ? q.natural : q.nat) || []).map(normPos).filter(Boolean);
  // compare partners: same NATURAL position first (squad-status positions), position family only as a labelled fallback
  function partners(p, n = 2) {
    if (!p) return { names: [], fallback: false, pos: '', none: true };
    const mine = natOf(p), main = mine[0] || normPos(p.pos);
    const L = squadList().filter(q => fold(q.name) !== fold(p.name));
    const same = main ? L.filter(q => natOf(q).includes(main)).sort((a, b) => (b.ovr || 0) - (a.ovr || 0)) : [];
    if (same.length) return { names: same.slice(0, n).map(q => q.name), fallback: false, pos: main };
    const line = L.filter(q => q.group === p.group).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    if (line.length) return { names: line.slice(0, n).map(q => q.name), fallback: true, pos: p.group || main };
    return { names: L.slice(0, n).map(q => q.name), fallback: true, pos: 'Squad', none: !L.length };
  }
  window.squadPartners = partners;
  // the Director's verdict for a player (one home: the Desk)
  function verdict(p) {
    if (typeof deskDecisions !== 'function') return null;
    const ds = deskDecisions(); const i = ds.findIndex(e => e.name && fold(e.name) === fold(p.name)); return i < 0 ? null : { i, e: ds[i] };
  }
  // the Director's best XI line ("Best XI · RCB Ball-Playing Defender"), from <day>.director.js best_xi
  function bestXi(p) {
    const dv = typeof directorFor === 'function' ? latestWith(directorFor) : null, slots = (((dv || {}).v || {}).best_xi || {}).slots || [];
    const s = slots.find(x => fold(x.player || '') === fold(p.name)); if (s) return `Best XI · ${s.pos} ${String(s.reason || '').split(/\s*\(/)[0]}`.trim();
    const a = slots.find(x => fold(x.alt || '') === fold(p.name)); return a ? `Best XI alternative at ${a.pos}` : '';
  }
  const extOf = p => { const ps = (window.FC26_EXTERNAL || {}).players || {}; return ps[p.name] || Object.values(ps).find(r => r && fold(r.id || '') === fold(p.id || p.name)) || null; };
  const COLS = {
    status: [['ovr', 'OVR', p => p.ovr], ['energy', 'Energy', p => p.at.energy], ['sharpness', 'Sharpness', p => p.at.sharpness], ['morale', 'Morale', p => p.at.morale, 'wide']],
    stats: [['ovr', 'OVR', p => p.ovr], ['apps', 'Apps', p => p.apps], ['minutes', 'Min', p => { const c = ((window.FC26_CAREER || {}).players || {})[p.name] || {}; return c.minutes || c.minutes_known || p.minutes || null; }], ['goals', 'G', p => p.goals], ['assists', 'A', p => p.assists], ['avg', 'Avg rt', p => isNum(p.avg) ? p.avg.toFixed(1) : null]],
    attributes: [['ovr', 'OVR', p => p.ovr], ...ATTRS.map(([k, l]) => [k, l, p => p.at[k], 'band'])],
    financial: [['ovr', 'OVR', p => p.ovr]],
  };
  const stamp = () => `<div class="sq-stamp3"><b>In-game values</b>${asOf() ? `<span>as of ${esc(asOf())}</span>` : '<span>date not captured</span>'}</div>`;
  const dc = (l, v, o = {}) => `<${o.href ? `a href="${o.href}" data-dir="1"` : 'div'} class="dcell${o.cls ? ' ' + o.cls : ''}"><span class="k">${esc(l)}</span><span class="v ${o.tone || ''}">${v == null || v === '' ? '–' : v}${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</span></${o.href ? 'a' : 'div'}>`;
  const miss = (l, tag) => `<div class="dcell miss"><span class="k">${esc(l)}</span><span class="v muted">–<i>${esc(tag || 'not captured')}</i></span></div>`;
  const dirV = () => { const dv = typeof directorFor === 'function' ? latestWith(directorFor) : null; return (dv || {}).v || {}; };
  // Director cells (round 7, brief squad-compare §1): Contract from contracts_morale (+ squad_contracts months), Best XI from best_xi
  function directorCells(p) {
    const D = dirV(), cm = (D.contracts_morale || []).find(x => fold(x.name || '') === fold(p.name)), sc = (((window.FC26_SQUAD || {}).squad_contracts) || []).find(x => fold(x.name || '') === fold(p.name)) || {};
    const slots = ((D.best_xi || {}).slots || []), s = slots.find(x => fold(x.player || '') === fold(p.name)), a = slots.find(x => fold(x.alt || '') === fold(p.name));
    const out = [], keep = '#page=scouting&grp=keep';
    if (cm) {
      const verb = (String(cm.note || '').match(/^(Renew|Sell|Loan|Release|Keep|Let)\b/) || [])[1] || null;
      const months = isNum(sc.contract_months) ? sc.contract_months : +((String(cm.note || '').match(/(\d+) months left/) || [])[1]) || null;
      const tag = [months ? `${months} months left` : '', /opens talks/.test(cm.note || '') ? 'when he opens talks' : ''].filter(Boolean).join(' · ');
      out.push(dc('Contract', esc(verb || 'Talk'), { tone: 'gold', tag, href: keep }));
    }
    if (s) out.push(dc('Best XI', esc(s.pos), { tag: s.alt ? `alt. ${s.alt}` : '', href: keep }));
    else if (a) out.push(dc('Best XI', 'Alt.', { tag: `at ${a.pos} behind ${a.player}`, href: keep }));
    return out;
  }
  // ---------- Player Info (Squad Side Panel v3 · Player Info 300:4732; frame Q1 304:35102) ----------
  function sidePanel(p) {
    const a = p.at || {}, parts = String(p.name).trim().split(' '), last = parts.length > 1 ? parts.pop() : parts[0];
    const sc = (((window.FC26_SQUAD || {}).squad_contracts) || []).find(x => fold(x.name || '') === fold(p.name)) || {};
    const first = parts.length && parts[0] !== last ? parts.join(' ') : ((sc.data || {}).first_name || '');
    const gk = p.pos === 'GK';
    const summ = (gk ? GK_ATTRS : ATTRS).map(([k, l]) => { const v = a[k], d = a[k + '_delta']; return `<div class="sm"><span>${l}</span><b class="${band(v)}">${isNum(v) ? v : '–'}${isNum(d) && d > 0 ? `<i class="up">+${d}</i>` : ''}</b></div>`; }).join('');
    const cond = [['Energy', a.energy], ['Sharpness', a.sharpness], ['Morale', a.morale]].map(([l, v]) => v == null || v === '' ? miss(l) : dc(l, esc(String(v)), { tone: l === 'Morale' ? (/happy/i.test(v) && !/unhappy/i.test(v) ? 'pos' : /unhappy/i.test(v) ? 'neg' : '') : isNum(v) && v >= 80 ? '' : isNum(v) && v < 60 ? 'neg' : '' })).join('');
    const detailMissing = !gk && (!isNum(a.acceleration) || (a.ext_fields || []).includes('acceleration'));
    const dirs = directorCells(p);
    return `<aside class="sq-side sl2-insp sb3 sq3" aria-label="Player Info">
      <header><span class="pf">${portrait(p, 'L')}</span><div class="pov"><b>${fmt(p.ovr)}</b><i>|</i><span>${esc(p.pos || '')}</span></div>${first ? `<div class="fn">${esc(String(first).toUpperCase())}</div>` : ''}<div class="ln"><b>${esc(last.toUpperCase())}</b></div></header>
      <div class="sq3-meta">${dc('Age', isNum(p.age) ? p.age : null)}${dc('Height', isNum(a.height) ? `${a.height} cm` : null)}${dc('Foot', esc(a.foot || ''))}</div>
      <h4 class="bio-h">Summary</h4><div class="sq3-sum">${summ}</div>
      <div class="sq3-sec"><h4 class="bio-h">Condition</h4><div class="sq3-cells">${cond}</div>
      ${detailMissing ? `<div class="sq3-cells">${miss('Detailed attributes', 'not captured · Player Info › Attributes')}</div>` : ''}</div>
      ${dirs.length ? `<div class="sq3-sec dir"><h4 class="bio-h">Director</h4><div class="sq3-dir">${dirs.join('')}</div></div>` : ''}
      ${stamp()}</aside>`;
  }
  // ---------- Player Info Comparison (Squad Compare Panel v3 300:5029: Preview / Compared; frames Q2 304:35469, Q3 304:35856) ----------
  function potential(p) {
    if (p.youth && isNum(p.pot_hi)) return { v: p.pot_hi, ext: false };
    const ex = extOf(p); return ex && isNum(ex.potential) ? { v: ex.potential, ext: true } : { v: null, ext: false };
  }
  const SWP = () => window.FC26_SWAP || null;
  const swPid = n => { const D = SWP(); if (!D || !D.players) return null; const f = fold(n); if (D.players[f]) return f; return Object.keys(D.players).find(k => fold(D.players[k].name) === f) || null; };
  const BASE = { LCB: 'CB', RCB: 'CB', LCDM: 'CDM', RCDM: 'CDM', LCM: 'CM', RCM: 'CM', LS: 'ST', RS: 'ST', LW: 'LM', RW: 'RM' };
  // the marked player's role in Slot 1 (his own position there, else the first slot position of his natural position)
  function roleKey(p) {
    const D = SWP(), s1 = D && (D.slots || []).find(x => x.slot === 1) || (D && (D.slots || [])[0]); if (!s1) return null;
    const pid = swPid(p.name), ps = Object.entries(s1.positions || {}), nat = natOf(p)[0] || normPos(p.pos || '');
    const hit = ps.find(([, v]) => v.starter === pid) || ps.find(([q]) => (BASE[q] || q) === (BASE[nat] || nat)) || null;
    return hit ? { pos: hit[0], key: hit[1].key, role: hit[1].role } : null;
  }
  function cmpSide(p, rk) {
    if (!p) return null;
    if (p.shortlist) { const o = p.sl, f = rk && o.role_fit_est ? o.role_fit_est[rk.key] : null;
      return { name: p.short, pos: (o.positions || [p.pos]).join(' · '), age: o.age_base_db, foot: o.foot, fit: isNum(f) ? f : null, form: null, ga: null, at: {}, energy: null, sharp: null, ext: true }; }
    const D = SWP(), sp = D && D.players ? D.players[swPid(p.name)] : null, f = sp && sp.fit && rk ? sp.fit[rk.key] : null, a = p.at || {};
    const has = p.st && Object.keys(p.st).length;
    return { name: p.name, pos: [...new Set([normPos(p.pos || ''), ...natOf(p)].filter(Boolean))].join(' · '), age: p.age, foot: a.foot, fit: isNum(f) ? f : null,
      form: sp && sp.form && isNum(sp.form.avg) ? { avg: sp.form.avg, n: sp.form.n } : null, ga: has ? [p.goals || 0, p.assists || 0] : null, at: a, energy: a.energy, sharp: a.sharpness };
  }
  function cmpRows(Lp, Rp, rk) {
    const L = cmpSide(Lp, rk), R = cmpSide(Rp, rk);
    const row = (label, lt, rt, lv, rv, cmp = true) => {
      const lb = cmp && isNum(lv) && isNum(rv) && lt !== rt && lv > rv, rb = cmp && isNum(lv) && isNum(rv) && lt !== rt && rv > lv;   // better only when the shown values differ
      const c = (t, b) => `<span class="${b ? 'better' : ''}${t === '–' ? ' miss' : ''}">${esc(t)}</span>`;
      return `<div class="cmp-row">${c(lt, lb)}<em>${esc(label)}</em>${c(rt, rb)}</div>`;
    };
    const t = (o, f) => { if (!o) return '–'; const v = f(o); return v == null || v === '' ? '–' : String(v); };
    const formOk = L && R && L.form && R.form && L.form.n >= 3 && R.form.n >= 3;
    const rows = [
      row('Name', t(L, o => o.name), t(R, o => o.name), null, null, false),
      row('Position', t(L, o => o.pos), t(R, o => o.pos), null, null, false),
      row('Age', t(L, o => isNum(o.age) ? o.age : null), t(R, o => isNum(o.age) ? o.age : null), null, null, false),
      row('Foot', t(L, o => o.foot), t(R, o => o.foot), null, null, false),
      ...(rk ? [row(`Role fit · ${rk.role}`, t(L, o => isNum(o.fit) ? Math.round(o.fit) : null), t(R, o => isNum(o.fit) ? Math.round(o.fit) : null), L && L.fit, R && R.fit)] : []),
      row('Form (official)', t(L, o => o.form ? `${o.form.avg.toFixed(1)} (${o.form.n})` : null), t(R, o => o.form ? `${o.form.avg.toFixed(1)} (${o.form.n})` : null), formOk ? Math.round(L.form.avg * 10) / 10 : null, formOk ? Math.round(R.form.avg * 10) / 10 : null),
      row('Goals + assists', t(L, o => o.ga ? `${o.ga[0]} + ${o.ga[1]}` : null), t(R, o => o.ga ? `${o.ga[0]} + ${o.ga[1]}` : null), L && L.ga ? L.ga[0] + L.ga[1] : null, R && R.ga ? R.ga[0] + R.ga[1] : null),
      ...ATTRS.map(([k, l]) => row(l, t(L, o => isNum(o.at[k]) ? o.at[k] : null), t(R, o => isNum(o.at[k]) ? o.at[k] : null), L && L.at[k], R && R.at[k])),
      row('Energy', t(L, o => isNum(o.energy) ? o.energy : null), t(R, o => isNum(o.energy) ? o.energy : null), L && L.energy, R && R.energy),
      row('Sharpness', t(L, o => isNum(o.sharp) ? o.sharp : null), t(R, o => isNum(o.sharp) ? o.sharp : null), L && L.sharp, R && R.sharp),
    ];
    return rows.join('');
  }
  function compareView(L, R, locked) {
    const rk = roleKey(L), ext = R && R.shortlist;
    const side = (p, cls) => p ? `<div class="c3p ${cls}"><span class="f">${portrait(p.shortlist ? { name: '' } : p, 'L')}</span><b class="o">${fmt(p.ovr)}</b></div>` : `<div class="c3p ${cls} none"><b class="o">–</b></div>`;
    return `<aside class="sq-side sq-cmp-panel sq-cmp3"><header class="c3h">${side(L, 'l')}<span class="c3t${locked ? ' on' : ''}">${locked ? 'COMPARING' : 'PREVIEW · A COMPARE'}</span>${side(R, 'r')}</header>
      <h2 class="c3n">Player Info Comparison</h2>
      <div class="cmp-body fc-scroll" tabindex="-1">${cmpRows(L, R, rk)}</div>
      ${ext ? '<div class="cmp-src">his values: ext. = FC 26 base database (23 Jun 2026) · fit est.</div>' : ''}</aside>`;
  }
  function youthAsPlayer(name) {
    const y = (((window.FC26_SQUAD || {}).youth) || []).find(r => fold(r.name) === fold(name)); if (!y) return null;
    return { name: y.name, id: fold(y.name), pos: y.pos || '', ovr: isNum(y.ovr) ? y.ovr : null, age: isNum(y.age) ? y.age : null, at: {}, st: null, youth: true, pot_hi: y.pot_hi, form: [] };
  }
  // ---------- shortlist list while comparing (LT/RT: Squad ⇄ Shortlist · <marked player's position>; Leon 25 Nov) ----------
  const SL_POS = { CB: ['LCB', 'RCB'], CDM: ['LCDM', 'RCDM'], CM: ['LCDM', 'RCDM', 'CAM'], LW: ['LM'], RW: ['RM'], LWB: ['LB'], RWB: ['RB'], CF: ['ST'] };
  function slData() { const dv = typeof directorFor === 'function' ? latestWith(d => { const x = directorFor(d); return x && x.shortlist ? x : null; }) : null; return dv ? dv.v.shortlist : null; }
  function slPosFor(p) {
    const D = slData(); if (!D || !p) return null; const has = q => (D.positions || []).some(x => x.pos === q);
    const nat = natOf(p)[0] || normPos(p.pos || ''); const cand = [nat, ...(SL_POS[nat] || [])];
    return cand.find(has) || null;
  }
  function slRows(pos) {
    const D = slData(), P = D && (D.positions || []).find(x => x.pos === pos); if (!P) return [];
    const opts = [...Object.values(P.tiers || {}).flat(), ...(P.extra || [])], seen = new Set();
    const sn = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? `${w[0].charAt(0)}. ${w.slice(1).join(' ')}` : w[0] || ''; };
    return opts.filter(o => { const k = fold(o.lookup || o.name); if (seen.has(k)) return false; seen.add(k); return true; })
      .map(o => ({ name: o.name, short: sn(o.name), id: '', pos, ovr: o.ovr, age: o.age_base_db, at: { foot: o.foot }, sl: o, shortlist: true, fit: ((o.como_fit || {}).score) }))
      .sort((a, b) => (b.fit || 0) - (a.fit || 0));
  }
  const markOf = all => S.mk ? all.find(p => fold(p.name) === fold(S.mk)) || null : null;
  // ---------- table (Squad Table Panel; Squad Row v3 298:4612: Default / Focused / Selected / Marked / Marked Focused) ----------
  function tableView(S, pre) {
    const all = squadList(), cols = COLS[pre] || COLS.attributes, mk = markOf(all), slMode = !!(mk && S.cl === 'sl'), slPos = mk ? slPosFor(mk) : null;
    const sk = S.sort || 'ovr', firstAsc = sk === 'pos' || sk === 'name', dir = S.dir ? (S.dir === 'asc' ? 1 : -1) : (firstAsc ? 1 : -1);
    const posKey = p => (GROUP_ORDER[p.group] ?? 9) * 1000 + (99 - (p.ovr || 0));
    const val = (p, k) => k === 'name' ? p.name : k === 'pos' ? posKey(p) : (cols.find(c => c[0] === k) || [0, 0, x => x[k]])[2](p);
    const ps = slMode ? slRows(slPos) : all.slice().sort((a, b) => { const x = val(a, sk), y = val(b, sk);
      if (typeof x === 'string' || typeof y === 'string') return dir * String(x || '').localeCompare(String(y || ''));
      const nx = isNum(x), ny = isNum(y); if (nx !== ny) return nx ? -1 : 1;   // unknown always last
      return dir * ((x || 0) - (y || 0)) || ((b.ovr || 0) - (a.ovr || 0)); });
    const sel = ps.find(p => fold(p.name) === fold(S.sel || '')) || ps[0];
    const second = S.cmp && mk ? (S.cl === 'sl' ? slRows(slPos) : all).find(p => fold(p.name) === fold(String(S.cmp).split(',')[0])) || all.find(p => fold(p.name) === fold(String(S.cmp).split(',')[0])) || slRows(slPos).find(p => fold(p.name) === fold(String(S.cmp).split(',')[0])) || youthAsPlayer(String(S.cmp).split(',')[0]) : null;
    const th = (k, l, cls = '') => { if (slMode) return `<span class="th ${cls}">${l}</span>`; const on = sk === k; const nd = on ? (dir === 1 ? 'desc' : 'asc') : null; return `<a class="th ${cls} ${on ? 'on' : ''}" href="${sub({ sort: k, dir: nd && ((nd === 'asc') !== (k === 'pos' || k === 'name')) ? nd : null })}">${l}${on ? `<i class="tri ${dir === 1 ? 'up' : ''}"></i>` : ''}</a>`; };
    const cell = (p, c) => { const v = p.shortlist ? (c[0] === 'ovr' ? p.ovr : null) : c[2](p); return `<span class="n ${c[3] === 'band' ? band(v) : ''} ${c[0] === 'ovr' ? 'ovr' : ''} ${c[3] === 'wide' ? 'wide' : ''} ${c[0] === 'morale' && /happy/i.test(v || '') && !/unhappy/i.test(v || '') ? 'g' : ''}${c[0] === sk && !slMode ? ' scol' : ''}">${v == null || v === '' ? '–' : esc(String(v))}</span>`; };
    // Squad Row v3 columns: POS 60 · face 68 (56 px face box) · name · OVR 64 · values 62 each (MORALE 110)
    const grid = pre === 'status' ? 'grid-template-columns: calc(72 * var(--px)) calc(82 * var(--px)) minmax(0, 1fr) calc(64 * var(--px)) calc(108 * var(--px)) calc(80 * var(--px)) calc(68 * var(--px))'
      : `grid-template-columns: calc(72 * var(--px)) calc(82 * var(--px)) minmax(0, 1fr) ${cols.map((c, i) => c[3] === 'wide' ? 'calc(110 * var(--px))' : i === 0 ? 'calc(64 * var(--px))' : i === 1 ? 'calc(74 * var(--px))' : 'calc(62 * var(--px))').join(' ')}`;
    const isMk = p => mk && !p.shortlist && fold(p.name) === fold(mk.name), isSecond = p => second && fold(p.name) === fold(second.name);
    const rows = ps.map(p => `<a class="sq-row ${p === sel ? 'on' : ''}${isMk(p) || isSecond(p) ? ' mk' : ''}" style="${grid}" href="${sub({ sel: p.name })}" data-name="${esc(p.name)}"${p.shortlist ? ' data-sl="1"' : ''}>
      <span class="pos">${isMk(p) || isSecond(p) ? '<i class="swp" aria-hidden="true"></i>' : ''}${esc(p.pos || '–')}</span><span class="fc">${portrait(p.shortlist ? { name: '' } : p, 'S')}</span><span class="nm">${esc(p.shortlist ? p.short : p.name)}</span>${cols.map(c => cell(p, c)).join('')}</a>`).join('');
    let right = '';
    if (sel) right = mk ? compareView(mk, second || (fold(sel.name) !== fold(mk.name) || sel.shortlist ? sel : null), !!second) : sidePanel(sel);
    return `<div class="sq2 v3 pre-${pre}${mk ? ' cmp3' : ''}" data-grid="g1"><section class="sq-table"><div class="sq-head" style="${grid}">${th('pos', 'Pos')}<span></span>${th('name', 'Name')}${cols.map(c => th(c[0], c[1], 'n')).join('')}</div>
      <div class="sq-body fc-scroll">${rows || '<p class="empty-note">No shortlist players for this position</p>'}</div></section>${right}</div>`;
  }
  // the round-2 picker is retired for squad players (brief squad-compare §1); kept as a stub so old callers do not break
  const PK = { open: false };
  window.SQ_PICKER = { open() { /* retired */ }, close() { /* */ }, get state() { return PK; } };
  // ---------- page ----------
  REG.squad.tabs = () => PRESETS().map(p => p[0]); REG.squad.tabParam = 'preset';
  // Grid brief Decision 2: Squad opens on Status (the first tab); the three presets share ONE G1 frame (grid.css)
  REG.squad.render = function (S) {
    const P = PRESETS(), pre = P.some(x => x[0] === S.preset) ? S.preset : 'status';
    if (S.cmp && !S.mk && S.sel) S.mk = S.sel;   // old "&cmp=" links (Desk, Academy): the selected player is the marked one
    const all = squadList(), mk = markOf(all);
    if (mk) {   // comparing: the Sub-tab Bar becomes the list switch (Squad ⇄ Shortlist · <pos>)
      const sp = slPosFor(mk), second = S.cmp ? String(S.cmp).split(',')[0] : '';
      const tabs = GRID.stb([{ label: 'Squad', href: sub({ cl: null, sel: mk.name }), on: S.cl !== 'sl' }, ...(sp ? [{ label: `Shortlist · ${sp}`, href: sub({ cl: 'sl', sel: (slRows(sp)[0] || {}).name || null }), on: S.cl === 'sl' }] : [])],
        { label: 'Compare list', meta: esc(second ? `Compare · ${mk.name} vs ${second.split(' ').slice(-1)[0]}` : `Compare ${mk.name} with … · pick a player`) });
      return tabs + tableView(S, pre === 'depth' ? 'status' : pre);
    }
    const tabs = GRID.stb(P.map(([k, l]) => ({ label: l, href: sub({ preset: k === 'status' ? null : k, sort: null, dir: null, dc: null, cmp: null, mk: null, cl: null }), on: pre === k })),
      { label: 'Squad views', meta: esc(`Squad status · ${asOf() ? 'as of ' + asOf() : 'date not captured'}`) });
    if (pre === 'depth' && typeof window.depthView === 'function') return tabs + window.depthView(S);
    return tabs + tableView(S, pre === 'depth' ? 'stats' : pre);
  };
  const focusedRow = () => { const a = document.activeElement; return a && a.matches && a.matches('#main .sq-row') ? a : null; };
  const go = (h, focusName) => { (window.setView || (x => { location.hash = x.slice(1); }))(h); setTimeout(() => { const r = (focusName && [...document.querySelectorAll('#main .sq-row')].find(x => fold(x.dataset.name) === fold(focusName))) || document.querySelector('#main .sq-row.on'); if (r) { r.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } try { prompts(); } catch (e) { /* */ } }, 40); };
  const dirCells = () => [...document.querySelectorAll('#main .sq3-dir [data-dir]')];
  // Pad map (brief squad-compare §4). List (Top): A Open player · LT RT Tab · X Compare · Y Search; → = Director cells.
  // Picking (Deep): ↑↓ preview · A Compare · B Cancel · LT RT List · R Scroll. Compared (Deep): A Replace 2nd · B Close · LT RT List ·
  // X New compare · R Scroll.
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.squad = {
    z: 1,
    active: () => typeof S === 'object' && S.page === 'squad' && !!document.querySelector('#main .sq2'),
    prompts() {
      const a = document.activeElement;
      if (S.mk && S.cmp) return [['A', 'Replace 2nd'], ['B', 'Close'], ['LTRT', 'List'], ['X', 'New compare'], ['RS', 'Scroll']];
      if (S.mk) return [['A', 'Compare'], ['B', 'Cancel'], ['LTRT', 'List'], ['RS', 'Scroll']];
      if (a && a.dataset && a.dataset.dir) return [['A', 'Open in Transfers'], ['B', 'Back to the row'], ['LTRT', 'Tab'], ['Y', 'Search']];
      return [['A', a && a.matches && a.matches('.sq-row.on') ? 'Open player' : 'Select'], ['LTRT', 'Tab'], ['X', 'Compare'], ['Y', 'Search']];
    },
    press(k) {
      const a = document.activeElement, row = focusedRow(), onDir = !!(a && a.dataset && a.dataset.dir);
      if (onDir) {
        const ds = dirCells(), i = ds.indexOf(a);
        if (k === 'B' || (k === 'LEFT' && i === 0)) { const r = document.querySelector('#main .sq-row.on'); if (r) { r.focus({ preventScroll: true }); FC.gamepad.syncFocus(); } return true; }
        if (k === 'LEFT' || k === 'RIGHT') { const n = ds[i + (k === 'RIGHT' ? 1 : -1)]; if (n) { n.focus({ preventScroll: true }); FC.gamepad.syncFocus(); } return true; }
        if (k === 'UP' || k === 'DOWN') return true;
        if (k === 'A') { location.hash = a.getAttribute('href').slice(1); return true; }
        return false;
      }
      if (S.mk) {
        if (k === 'B') { go(sub({ mk: null, cmp: null, cl: null, sel: S.mk }), S.mk); return true; }
        if (k === 'LT' || k === 'RT') { const all = squadList(), mk = markOf(all), sp = mk && slPosFor(mk); if (!sp) return true; const toSl = S.cl !== 'sl'; const first = toSl ? (slRows(sp)[0] || {}).name : mk.name; go(sub({ cl: toSl ? 'sl' : null, sel: first || null }), first); return true; }
        if (k === 'A') { if (!row) return true; if (fold(row.dataset.name) === fold(S.mk) && !row.dataset.sl) return true; go(sub({ cmp: row.dataset.name, sel: row.dataset.name }), row.dataset.name); return true; }
        if (k === 'X') { if (S.cmp && row && !row.dataset.sl) { go(sub({ mk: row.dataset.name, cmp: null, cl: null, sel: row.dataset.name }), row.dataset.name); } return true; }
        if (k === 'Y' || k === 'R') return k === 'Y';
        if (k === 'RIGHT' || k === 'LEFT') return true;
        return false;
      }
      if (k === 'X') { if (!row) return false; go(sub({ mk: row.dataset.name, cmp: null, cl: null, sel: row.dataset.name }), row.dataset.name); return true; }
      if (k === 'RIGHT' && row) { const d = dirCells()[0]; if (d) { d.focus({ preventScroll: true }); FC.gamepad.syncFocus(); return true; } return true; }
      if (k === 'A') { if (row && row.matches('.sq-row.on')) { const p = playerByName(row.dataset.name); if (p && fold(p.name) === fold(row.dataset.name)) { location.hash = plink(p).slice(1); return true; } } return false; }
      return false;
    },
    scrollTarget: () => S.mk ? document.querySelector('#main .cmp-body') : document.querySelector('#main .sq-body'),
  };
  REG.squad.after = function (S, root) {
    if (root.querySelector('.dp-wrap')) return;   // entry focus + memory: navstate / grid.js
    if (S.cmp && S.mk && !/[&#]mk=/.test(location.hash) && typeof setHashQuiet === 'function') setHashQuiet({ mk: S.mk });
    const on = root.querySelector('.sq-row.on');
    if (on && !window.__viewRender && !window.NAVSTATE) { const box = root.querySelector('.sq-body'); if (box) { requestAnimationFrame(() => { const r = on.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop; if (r < box.scrollTop || r + on.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, r - box.clientHeight / 2); }); } }
  };
  // Selected (white row) while the focus is in the side panel's Director cells
  document.addEventListener('focusin', e => { const q = document.querySelector('#main .sq2'); if (q) q.classList.toggle('psel', !!(e.target.closest && e.target.closest('#main .sq3-dir'))); });
  window.SQ3 = { roleKey, slPosFor, slRows };
  window.squadList = squadList;
})();
