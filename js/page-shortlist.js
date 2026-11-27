/* Transfers › Sign: shortlist v2, a sortable FC 26 Transfer Hub-style table (brief docs/ui_changes/2026-11-24_shortlist-v2-table.md).
   Figma (file QeCUkHXbS34AlbGkdoliCJ) L5 section 270:11341: (a) 270:11343 LCB by Como Fit · (b) 270:12298 Attributes set ·
   (c) 271:12690 All · Veteran, header focus · (d) 271:13665 tier = Real Como. Parts in section 261:2924: Shortlist Table Row
   261:3132, Shortlist Header 265:3067 (Table Header 179:894 + Sorted Asc), Filter Strip · Position 265:3068 / · Tier 265:3105,
   Shortlist Inspector v2 266:3048, Data Cell 262:3017 (components.css .dcell), Flag 265:2996, Real Como Marker 268:3206.
   Data: <day>.director.js `shortlist` (positions[].tiers / extra, real_como_signings, needs); every count, score and value comes from
   the file. Flags: assets/flags/<nationality_iso2>.svg (xx = unknown). A = toggle "our target" (localStorage per viewer,
   fc26.targets.p1 / .p2, as v1; ids `<pos>|<lookup>` unchanged). X = the approved compare panel, on demand only.
   Layout stability: the table plate (1060 x 684) and the inspector (570 x 724) are fixed frames; filters, sort and the column set
   only change what is inside them. */
'use strict';
(function () {
  const ORDER = ['GK', 'RB', 'RCB', 'LCB', 'LB', 'LCDM', 'RCDM', 'CAM', 'RM', 'LM', 'ST'];
  const TIERS = [['starter', 'Starter'], ['best_case', 'Best case'], ['veteran', 'Veteran'], ['reserve', 'Reserve'], ['youth', 'Youth']];
  const TIER_L = Object.fromEntries(TIERS);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // short labels: table header (52 px column) and inspector cells
  const ATTR = { defensive_awareness: ['Def. aw.', 'Def. aw.'], standing_tackle: ['Stand', 'Stand'], sliding_tackle: ['Slide', 'Slide'], heading_accuracy: ['Head', 'Head'],
    strength: ['Str', 'Str'], sprint_speed: ['Sprint', 'Sprint'], interceptions: ['Intcp.', 'Intercept'], stamina: ['Stam.', 'Stamina'], short_passing: ['S. pass', 'Short pass'],
    long_passing: ['L. pass', 'Long pass'], composure: ['Comp.', 'Composure'], crossing: ['Cross', 'Crossing'], dribbling: ['Drib.', 'Dribbling'], vision: ['Vision', 'Vision'],
    ball_control: ['Ball c.', 'Ball control'], finishing: ['Fin.', 'Finishing'], acceleration: ['Accel', 'Accel'], attacking_position: ['Att. pos.', 'Att. pos.'], curve: ['Curve', 'Curve'],
    shot_power: ['Shot p.', 'Shot power'], gk_diving: ['Diving', 'Diving'], gk_handling: ['Handl.', 'Handling'], gk_kicking: ['Kicking', 'Kicking'], gk_reflexes: ['Reflex', 'Reflexes'],
    gk_positioning: ['GK pos.', 'GK pos.'], reactions: ['React.', 'Reactions'] };
  // narrow labels (< 1500 px wide, where the 13 px text floor makes the 14 px header labels wider than their columns)
  const ATTR_N = { defensive_awareness: 'Aw.', standing_tackle: 'Std', sliding_tackle: 'Sld', heading_accuracy: 'Hd', strength: 'Str', sprint_speed: 'Spr', interceptions: 'Int', stamina: 'Sta', short_passing: 'SP', long_passing: 'LP', composure: 'Com', crossing: 'Crs', dribbling: 'Dri', vision: 'Vis', ball_control: 'BC', finishing: 'Fin', acceleration: 'Acc', attacking_position: 'AP', curve: 'Crv', shot_power: 'Pow', gk_diving: 'Div', gk_handling: 'Han', gk_kicking: 'Kic', gk_reflexes: 'Ref', gk_positioning: 'Pos', reactions: 'Rea' };
  const ROLE_SHORT = { 'Ball-Playing Defender': 'BPD', Defender: 'Def', 'Deep-Lying Playmaker': 'DLP', 'Ball-Playing Keeper': 'BPK', 'Attacking Wingback': 'Att. WB', 'Inverted Wingback': 'Inv. WB', 'Box-To-Box': 'B2B', 'Advanced Forward': 'Adv. Fwd', 'Target Forward': 'Target Fwd', 'Shadow Striker': 'Shadow St.', 'Wide Playmaker': 'Wide Playm.', 'Wide Midfielder': 'Wide Mid', 'Inside Forward': 'Inside Fwd' };
  const ROLE_MID = { 'Ball-Playing Defender': 'Ball-Playing Def.', 'Deep-Lying Playmaker': 'Deep-Lying Playm.', 'Advanced Forward': 'Advanced Fwd', 'Target Forward': 'Target Fwd', 'Attacking Wingback': 'Attacking WB', 'Inverted Wingback': 'Inverted WB' };
  const PS_SHORT = { 'Long Ball Pass': 'Long Ball', 'Slide Tackle': 'Slide', 'Aerial Fortress': 'Aerial', 'Precision Header': 'Header', 'Whipped Pass': 'Whipped', 'Incisive Pass': 'Incisive', 'Pinged Pass': 'Pinged', 'Finesse Shot': 'Finesse', 'Low Driven Shot': 'Low Driven', 'Power Shot': 'Power', 'Chip Shot': 'Chip', 'Press Proven': 'Press Pr.', 'First Touch': 'First Touch', 'Quick Step': 'Quick Step', 'Long Throw': 'Long Throw', 'Cross Claimer': 'Cross Cl.', 'Rush Out': 'Rush Out', 'Far Reach': 'Far Reach' };
  const RC_WORD = { signed: ['Signed', 'Signed'], loan: ['Loan', 'Loan'], reported_target: ['Reported', 'Reported'], left_como: ['Left', 'Left Como'] };
  const SL = { pos: null, tier: 'all', set: 'ov', sort: null, focus: null, cmp: false, init: false };
  const data = () => { const dv = typeof directorFor === 'function' ? latestWith(d => { const x = directorFor(d); return x && x.shortlist ? x : null; }) : null; return dv ? dv.v.shortlist : null; };
  const posData = (D, p) => (D.positions || []).find(x => x.pos === p) || null;
  const viewer2 = () => (typeof viewer === 'function' ? viewer() : 'p1');
  const tKey = v => `fc26.targets.${v}`;
  const loadT = v => { try { const a = JSON.parse(localStorage.getItem(tKey(v)) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const saveT = (v, a) => { try { localStorage.setItem(tKey(v), JSON.stringify(a)); } catch (e) { /* */ } };
  const idOf = (pos, o) => `${pos}|${o.lookup || o.name}`;
  const targeted = id => ['p1', 'p2'].some(v => loadT(v).some(t => t.id === id));
  const mine = id => loadT(viewer2()).some(t => t.id === id);
  function toggle(r) {
    const v = viewer2(), a = loadT(v), i = a.findIndex(t => t.id === r.id), o = r.o;
    if (i >= 0) a.splice(i, 1); else a.push({ id: r.id, pos: r.pos, tier: r.tier, name: o.name, lookup: o.lookup || o.name, club: o.club_in_base_db || null, marked_by: v, at: new Date().toISOString().slice(0, 10), label: 'our target' });
    saveT(v, a);
  }
  function exportList() {   // kept for the Director hand-off (v1); no button in the v2 frames
    const all = ['p1', 'p2'].flatMap(v => loadT(v));
    const blob = new Blob([JSON.stringify({ schema: 'fc26.targets/1', kind: 'our targets (advice list, not an in-game action)', exported: new Date().toISOString(), targets: all }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fc26_our_targets.json'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const eur = v => !isNum(v) ? '–' : v >= 1e6 ? `€${(+(v / 1e6).toFixed(1)).toString()}M` : v >= 1e3 ? `€${(+(v / 1e3).toFixed(1)).toString()}K` : `€${v}`;
  const band = v => !isNum(v) ? 'muted' : v >= 70 ? 'pos' : v >= 50 ? 'warn' : 'neg';
  const score = (o, k) => { const s = (o[k] || {}).score; return isNum(s) ? s : null; };
  const short = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? `${w[0].charAt(0)}. ${w.slice(1).join(' ')}` : w[0] || ''; };
  const surname = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w.slice(1).join(' ') : w[0] || ''; };
  const flag = (o, cls = '') => { const c = String(o.nationality_iso2 || 'xx').toLowerCase().replace(/[^a-z-]/g, '') || 'xx'; return `<img class="flag ${cls}" src="assets/flags/${c}.svg" alt="${esc(o.nationality || '')}" onerror="this.onerror=null;this.src='assets/flags/xx.svg'">`; };
  const roleName = r => String(r || '').replace(/^[A-Z]{1,3}\s+/, '');
  const roleShort = r => { const m = roleName(r).match(/^(.*?)(\+*)$/); return m ? (ROLE_SHORT[m[1]] || m[1]) + m[2] : ''; };
  const roleMid = r => { const pos = String(r || '').match(/^([A-Z]{1,3})\s+/), m = roleName(r).match(/^(.*?)(\+*)$/); return m ? `${pos ? pos[1] + ' ' : ''}${ROLE_MID[m[1]] || m[1]}${m[2]}` : ''; };
  const psAll = o => [...(o.playstyles_plus || []).map(p => ({ n: p, plus: true })), ...(o.playstyles || []).filter(p => !(o.playstyles_plus || []).includes(p)).map(p => ({ n: p, plus: false }))];
  const dOf = s => { const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const rcShort = rl => { const d = dOf(rl.date), w = (RC_WORD[rl.status] || ['–'])[0]; return d ? `${w} · ${d.y >= 2026 ? MON[d.m - 1] : d.y}` : w; };
  const rcTone = rl => /^(signed|loan)$/.test(rl.status) ? 'in' : rl.status === 'reported_target' ? 'rep' : 'out';
  const feeShort = f => f == null ? null : String(f).split(/\s\(|,|;/)[0].replace(/\s+add-ons\b/, '').trim();
  const srcShort = s => String(s || '').split(/,|;|\s\(|\sand\s|\svia\s|\sciting\s/)[0].replace(/\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}$/, '').trim();
  const needPos = n => { const m = String(n.slot_role || n.need || '').match(/\b(GK|RB|RCB|LCB|LB|LCDM|RCDM|CAM|RM|LM|ST)\b/); return m ? m[1] : null; };

  // ---------- rows (model) ----------
  function allRows(D) {
    const out = [], seen = new Set();
    for (const P of D.positions || []) {
      TIERS.forEach(([k]) => ((P.tiers || {})[k] || []).forEach((o, i) => out.push({ pos: P.pos, tier: k, o, i: out.length })));
      (P.extra || []).forEach(o => out.push({ pos: P.pos, tier: TIER_L[o.tier] ? o.tier : TIER_L[o.tier_equiv] ? o.tier_equiv : 'starter', o, i: out.length, extra: true }));
    }
    out.forEach(r => { r.id = idOf(r.pos, r.o); r.key = fold(r.o.lookup || r.o.name); seen.add(r.key); });
    // Real Como: real_como_signings.options and needs options with a real-life record that are not in positions[] (Cutrone)
    const rc = D.real_como_signings || {};
    (rc.options || []).forEach(o => { const k = fold(o.lookup || o.name); if (!seen.has(k) && o.pos) { seen.add(k); out.push({ pos: o.pos, tier: TIER_L[o.tier_equiv] ? o.tier_equiv : 'starter', o, rcOnly: true, i: out.length, id: idOf(o.pos, o), key: k }); } });
    (D.needs || []).forEach(n => (n.options || []).forEach(o => { const k = fold(o.lookup || o.name), p = needPos(n); if (!seen.has(k) && o.real_life && p) { seen.add(k); out.push({ pos: p, tier: null, o, rcOnly: true, i: out.length, id: idOf(p, o), key: k }); } }));
    return out;
  }
  function viewRows(D) {
    let rs = allRows(D);
    if (SL.tier === 'rc') rs = rs.filter(r => r.o.real_life);
    else rs = rs.filter(r => !r.rcOnly && (SL.tier === 'all' || r.tier === SL.tier));
    if (SL.pos !== 'All') rs = rs.filter(r => r.pos === SL.pos);
    else { const k = new Set(); rs = rs.filter(r => (k.has(r.key) ? false : (k.add(r.key), true))); }
    const c = cols().find(x => x.k === SL.sort.k), g = c && c.get;
    if (g) {
      const dir = SL.sort.dir === 'asc' ? 1 : -1;
      rs = rs.map((r, i) => ({ r, i, v: g(r) })).sort((a, b) => {
        const na = a.v == null || a.v === '', nb = b.v == null || b.v === '';
        if (na || nb) return na === nb ? a.i - b.i : na ? 1 : -1;   // not known always last
        const d = typeof a.v === 'string' ? a.v.localeCompare(b.v) : a.v - b.v;
        return d ? d * dir : a.i - b.i;
      }).map(x => x.r);
    }
    return rs;
  }
  // key attributes: the filtered position's list; under "All" each row uses its own position's list
  const keysFor = (D, pos) => ((posData(D, pos) || {}).key_attributes || []).slice(0, 6);

  // ---------- columns (round 7, Shortlist Table Row v3 297:4643 / Header v3 297:4689: x / w = Figma px inside the 942 row;
  //            a = align; h = the header cell box [x, w] when it differs from the value column). Leon 25 Nov: Club kept, Tier dropped
  //            (the tier is the ◂ All tiers ▸ selector). ----------
  function cols() {
    const D = data() || {}, keys = SL.pos !== 'All' ? keysFor(D, SL.pos) : null;
    if (SL.set === 'at') {
      const at = [0, 1, 2, 3, 4, 5].map(i => ({ k: `a${i}`, l: keys ? (ATTR[keys[i]] || [keys[i] || ''])[0] : '', n: keys ? ATTR_N[keys[i]] : '', x: 246 + 52 * i, w: 52, a: 'c', d: 'desc',
        get: keys ? r => { const v = (r.o.key_attrs || {})[keys[i]]; return isNum(v) ? v : null; } : null }));
      return [{ k: 'name', l: 'Name', x: 68, w: 170, a: 'l', d: 'asc', h: [60, 178], get: r => surname(r.o.name) }, ...at,
        { k: 'skill', l: 'Skill', n: 'SM', x: 562, w: 56, a: 'c', d: 'desc', get: r => r.o.skill_moves ?? null },
        { k: 'wf', l: 'Weak ft', n: 'WF', x: 620, w: 58, a: 'c', d: 'desc', get: r => r.o.weak_foot ?? null },
        { k: 'roles', l: 'Roles+', x: 686, w: 118, a: 'l', d: 'asc', get: r => roleShort((r.o.roles_plus || [])[0]) || null },
        { k: 'ps', l: 'PlayStyles', x: 810, w: 124, a: 'l', d: 'desc', get: r => psAll(r.o).length || null }];
    }
    const rc = SL.tier === 'rc';
    return [{ k: 'name', l: 'Name', x: 68, w: 140, a: 'l', d: 'asc', h: [60, 57], get: r => surname(r.o.name) },
      { k: 'age', l: 'Age', x: 212, w: 30, a: 'c', d: 'asc', h: [205, 44], get: r => r.o.age_base_db ?? null },
      { k: 'pos', l: 'Pos', x: 258, w: 74, a: 'l', d: 'asc', h: [250, 41], get: r => ORDER.indexOf(r.pos) },
      { k: 'ovr', l: 'OVR / POT', n: 'OVR', x: 334, w: 76, a: 'c', d: 'desc', h: [327, 90], get: r => isNum(r.o.ovr) ? r.o.ovr * 100 + (r.o.pot || 0) : null },
      { k: 'fit', l: 'Como Fit', n: 'Fit', x: 446, w: 60, a: 'r', d: 'desc', h: [418, 84], get: r => score(r.o, 'como_fit') },
      { k: 'real', l: 'Realism', n: 'Real.', x: 518, w: 60, a: 'r', d: 'desc', h: [506, 80], get: r => score(r.o, 'realism') },
      { k: 'value', l: 'Value', x: 570, w: 76, a: 'r', d: 'desc', h: [600, 54], get: r => r.o.value_eur ?? null },
      { k: 'wage', l: 'Wage', x: 638, w: 76, a: 'r', d: 'desc', h: [667, 55], get: r => r.o.wage_eur_week ?? null },
      { k: 'contract', l: 'Contract', n: 'Contr.', x: 722, w: 72, a: 'r', d: 'asc', h: [725, 77], get: r => r.o.contract_until ?? null },
      rc ? { k: 'rc', l: 'Real Como', x: 812, w: 122, a: 'l', d: 'desc', h: [804, 100], get: r => (r.o.real_life || {}).date || null }
        : { k: 'club', l: 'Club', x: 812, w: 122, a: 'l', d: 'asc', h: [804, 48], get: r => r.o.club_in_base_db || null }];
  }
  const geo = c => `style="--x:${c.x};--w:${c.w}"`;
  const hgeo = c => `style="--x:${(c.h || [c.x])[0]};--w:${(c.h || [0, c.w])[1]}"`;
  function cellHtml(c, r, D) {
    const o = r.o, cl = `slc ${c.a}`;
    if (SL.set === 'at') {
      if (c.k === 'name') return `<span class="${cl} nm" ${geo(c)}>${esc(short(o.name))}</span>`;
      if (/^a\d$/.test(c.k)) { const k = (SL.pos !== 'All' ? keysFor(D, SL.pos) : keysFor(D, r.pos))[+c.k.slice(1)], v = (o.key_attrs || {})[k];
        return `<span class="${cl} at ${band(v)}" ${geo(c)}>${isNum(v) ? v : '–'}</span>`; }
      if (c.k === 'skill') return `<span class="${cl} t" ${geo(c)}>${o.skill_moves ?? '–'}</span>`;
      if (c.k === 'wf') return `<span class="${cl} t" ${geo(c)}>${o.weak_foot ?? '–'}</span>`;
      if (c.k === 'roles') return `<span class="${cl} c t" ${geo(c)}>${esc(roleShort((o.roles_plus || [])[0]) || '–')}</span>`;
      if (c.k === 'ps') { const ps = psAll(o); return `<span class="${cl} t" ${geo(c)}>${ps.length ? ps.slice(0, 2).map(p => esc((PS_SHORT[p.n] || p.n) + (p.plus ? '+' : ''))).join(' · ') + (ps.length > 2 ? ` <i>+${ps.length - 2}</i>` : '') : '–'}</span>`; }
      return '';
    }
    switch (c.k) {
      case 'name': return `<span class="${cl} nm" ${geo(c)}>${esc(short(o.name))}</span>`;
      case 'age': return `<span class="${cl} t" ${geo(c)}>${o.age_base_db ?? '–'}${o.ours ? '<i class="ours">ours</i>' : ''}</span>`;
      case 'pos': { const base = r.pos.replace(/^[LR](?=CB|CDM|CM)/, ''), sec = [...(o.secondary_positions || []), ...(o.positions || [])].find(x => x !== r.pos && x !== base); return `<span class="${cl} t ps" ${geo(c)}>${esc(r.pos)}${sec ? ` · ${esc(sec)}` : ''}</span>`; }
      case 'ovr': return `<span class="${cl} ovr" ${geo(c)}>${o.ovr ?? '–'} / ${o.pot ?? '–'}</span>`;
      case 'fit': { const v = score(o, 'como_fit'); return `<span class="${cl} sc ${band(v)}" ${geo(c)}>${v ?? '–'}</span>`; }
      case 'real': { const v = score(o, 'realism'); return `<span class="${cl} sc ${band(v)}" ${geo(c)}>${v ?? '–'}</span>`; }
      case 'value': return `<span class="${cl} t money" ${geo(c)}>${eur(o.value_eur)}</span>`;
      case 'wage': return `<span class="${cl} t money" ${geo(c)}>${eur(o.wage_eur_week)}</span>`;
      // round 7: the contract ends this summer = "Free" in accent teal (the year is redundant), no chip
      case 'contract': return `<span class="${cl} t${o.free_or_pre_contract ? ' free' : ' money'}" ${geo(c)}>${o.free_or_pre_contract ? 'Free' : o.contract_until ?? '–'}</span>`;
      case 'rc': { const rl = o.real_life; return `<span class="${cl} rcm ${rl ? rcTone(rl) : ''}" ${geo(c)}>${rl ? `<img src="assets/crests/COM.png" alt="">${esc(rcShort(rl))}` : '–'}</span>`; }
      case 'club': return `<span class="${cl} cl" ${geo(c)}>${esc(o.club_in_base_db || '–')}</span>`;
    }
    return '';
  }
  function rowHtml(r, D) {
    const t = targeted(r.id);
    return `<a class="slr${t ? ' tg' : ''}${r.id === SL.focus ? ' on' : ''}" href="#" data-id="${esc(r.id)}" aria-label="${esc(r.o.name)}${t ? ', our target' : ''}">${t ? '<i class="star" aria-hidden="true"></i>' : ''}${flag(r.o)}${cols().map(c => cellHtml(c, r, D)).join('')}</a>`;
  }
  function headHtml() {
    const cs = cols(), span = SL.set === 'at' && SL.pos === 'All';
    return `<div class="sl2-head" role="row">${cs.map(c => {
      if (span && /^a\d$/.test(c.k)) return c.k === 'a0' ? `<span class="slh span" style="--x:${c.x};--w:${52 * 6}">Key attributes · each player's position</span>` : '';
      const on = SL.sort.k === c.k, can = !!c.get;
      return `<button type="button" class="slh ${c.a}${on ? ' sorted' + (SL.sort.dir === 'asc' ? ' asc' : '') : ''}" ${hgeo(c)} data-sort="${c.k}" aria-label="${esc(c.l)}"${can ? '' : ' disabled'} aria-sort="${on ? (SL.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${c.n ? `<span class="lf">${esc(c.l)}</span><span class="ls">${esc(c.n)}</span>` : esc(c.l)}${on ? '<i class="arr" aria-hidden="true"></i>' : ''}</button>`;
    }).join('')}</div>`;
  }
  function filtersHtml(D) {
    const avail = ORDER.filter(p => posData(D, p));
    const pos = ['All', ...ORDER].map(p => `<a data-pos="${p}" class="${p === SL.pos ? 'on' : ''}${p === 'All' || avail.includes(p) ? '' : ' na'}" href="#" tabindex="-1" role="tab" aria-selected="${p === SL.pos}">${p}</a>`).join('');
    // round 7 Tier Selector 297:4755 (◂ All tiers ▸ at the right end of the line; A opens the option list, no ←→ trap)
    const cur = (TIER_OPTS.find(t => t[0] === SL.tier) || TIER_OPTS[0])[1];
    const list = SL.tsOpen ? `<div class="sl2-tlist" role="listbox" aria-label="Tier">${TIER_OPTS.map(([k, l]) => `<a data-topt="${k}" class="${k === SL.tier ? 'cur' : ''}" href="#" tabindex="-1" role="option" aria-selected="${k === SL.tier}"><span>${l}</span>${k === SL.tier ? '<small>current</small>' : ''}</a>`).join('')}</div>` : '';
    return `<div class="sl2-filters"><nav class="sl2-strip pos" aria-label="Position">${pos}</nav><div class="sl2-tsel${SL.tsOpen ? ' open' : ''}"><span class="k">Tier</span><button type="button" class="tsel" data-tsel="1" tabindex="-1" aria-haspopup="listbox" aria-expanded="${!!SL.tsOpen}" aria-label="Tier: ${esc(cur)}"><i class="al" aria-hidden="true"></i><b>${esc(cur)}</b><i class="ar" aria-hidden="true"></i></button>${list}</div></div>`;
  }
  const TIER_OPTS = [['all', 'All tiers'], ...TIERS, ['rc', 'Real Como']];

  // ---------- inspector = Sign Bio Card 299:4561 (FC 26 player bio; round 7, brief 2026-11-25_sign-bio §1) ----------
  const dc = (l, v, o = {}) => `<div class="dcell${o.size ? ' ' + o.size : ''}${o.cls ? ' ' + o.cls : ''}"><span class="k">${esc(l)}</span><span class="v ${o.tone || ''}">${v == null || v === '' ? '–' : v}${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</span></div>`;
  const PARTS = { como_fit: [['role', 'Role fit'], ['playstyles', 'PlayStyles'], ['nation_league', 'Nation · league'], ['age_plan', 'Age plan'], ['foot', 'Foot'], ['story', 'Story']],
    realism: [['price', 'Price'], ['wage', 'Wage'], ['contract', 'Contract'], ['club_status', 'Club status'], ['career_stage', 'Career stage'], ['interest', 'Interest']] };
  const ATTR_L = { defensive_awareness: 'Def. awareness', standing_tackle: 'Stand. tackle', sliding_tackle: 'Slide tackle', heading_accuracy: 'Heading acc.', sprint_speed: 'Sprint speed', strength: 'Strength', interceptions: 'Interceptions', short_passing: 'Short passing', long_passing: 'Long passing', ball_control: 'Ball control', attacking_position: 'Att. position', shot_power: 'Shot power', gk_positioning: 'GK positioning' };
  const attrRow = (k, v) => `<div class="asr"><span class="k">${esc(ATTR_L[k] || (ATTR[k] || [k, k])[1])}</span><b class="${band(v)}">${isNum(v) ? v : '–'}</b><i class="sbar"><i class="${band(v)}" style="width:${isNum(v) ? Math.max(0, Math.min(100, v)) : 0}%"></i></i></div>`;
  function inspector(r, D) {
    if (!r) return '<aside class="sl2-insp sb3"><p class="empty-note">No player for this filter</p></aside>';
    const o = r.o, names = String(o.legal_name_base_db || o.name).split(' '), last = names.length > 1 ? names.pop() : names[0], first = names.join(' ');
    const anyT = targeted(r.id), keys = keysFor(D, r.pos), ps = psAll(o), cf = score(o, 'como_fit'), re = score(o, 'realism');
    const kw = [r.pos, SL.tier === 'rc' ? 'REAL COMO' : r.tier ? TIER_L[r.tier].toUpperCase() : ''].filter(Boolean).join(' · ');
    const rp = (o.roles_plus || [])[0];
    return `<aside class="sl2-insp sb3" data-id="${esc(r.id)}">
      <header><span class="pf">${portrait({ name: '' }, 'L')}</span><div class="pov"><b>${o.ovr ?? '–'}</b><i>|</i><span>${esc((o.positions || [r.pos]).join(' · '))}</span></div>${first ? `<div class="fn">${esc(first.toUpperCase())}</div>` : ''}<div class="ln">${flag(o)}<b>${esc(last.toUpperCase())}</b></div><span class="kw">${esc(kw)}</span>${anyT ? '<span class="tgt"><i class="star" aria-hidden="true"></i>Our target</span>' : ''}</header>
      <div class="bio-meta">${dc('Age', o.age_base_db)}${dc('Foot', esc(o.foot || ''))}${dc('Nation', esc(o.nationality || ''))}${dc('Club', esc(o.club_in_base_db || ''), { tag: o.club_in_base_db ? 'ext.' : '' })}</div>
      <div class="bio-score">${dc('Como Fit', cf, { size: 'xl', tone: band(cf), tag: cf != null ? 'est.' : '' })}${dc('Realism', re, { size: 'xl', tone: band(re), tag: re != null ? 'est.' : '' })}<span class="why" data-why="1"><span class="gl c">Y</span>Why this score</span></div>
      <h4 class="bio-h">Key attributes · ${esc(SL.pos !== 'All' ? SL.pos : r.pos)}</h4>
      <div class="bio-attrs">${keys.map(k => attrRow(k, (o.key_attrs || {})[k])).join('') || '<p class="empty-note">Key attributes not captured</p>'}</div>
      <div class="bio-x">${dc('Skill moves', o.skill_moves)}${dc('Weak foot', o.weak_foot)}${dc('Roles+', esc(roleMid(rp)), { tag: (o.roles_plus || []).length > 1 ? `+${o.roles_plus.length - 1}` : '', cls: 'roles' })}${dc('PlayStyles', ps.length ? esc(ps.map(p => p.n + (p.plus ? '+' : '')).join(' · ')) : null, { cls: 'ps' })}</div>
      <div class="bio-m">${dc('Value', eur(o.value_eur), { tag: isNum(o.value_eur) ? 'ext.' : '' })}${dc('Wage', eur(o.wage_eur_week), { tag: isNum(o.wage_eur_week) ? 'ext.' : '' })}${dc('Clause', eur(o.release_clause_eur), { tag: isNum(o.release_clause_eur) ? 'ext.' : '' })}${dc('Contract', o.free_or_pre_contract ? 'Free' : o.contract_until, { tone: o.free_or_pre_contract ? 'teal' : '' })}</div></aside>`;
  }
  // ---------- "Why this score" popup (Why This Score Popup 299:4693 + Breakdown Row 297:4802; Y on a row, B closes) ----------
  // points = weight x score / 100; the total adds the known parts only (a missing part = "–"). Never a number the file does not hold.
  const r1 = x => Math.round(x * 10) / 10;
  function whyCol(o, k, title) {
    const s = o[k] || {}, parts = s.parts || {};
    let tot = 0, any = false;
    const rws = PARTS[k].map(([pk, pl]) => { const p = parts[pk] || {}, ok = isNum(p.weight) && isNum(p.score), pt = ok ? p.weight * p.score / 100 : null; if (ok) { tot += pt; any = true; }
      return `<div class="br"><span class="p">${esc(pl)}</span><span class="w">${isNum(p.weight) ? p.weight + '%' : '–'}</span><i class="sbar"><i class="${band(p.score)}" style="width:${isNum(p.score) ? Math.max(0, Math.min(100, p.score)) : 0}%"></i></i><b class="s ${band(p.score)}">${isNum(p.score) ? p.score : '–'}</b><span class="pt">${ok ? r1(pt).toFixed(1) : '–'}</span></div>`; }).join('');
    return `<section><h3>${esc(title)}</h3><div class="bignum ${band(s.score)}">${isNum(s.score) ? s.score : '–'}<i>est.</i></div>
      <div class="bh"><span>weight</span><span>points</span></div>${rws}
      <div class="tot"><b>Total</b><b class="${band(s.score)}">${any ? `${r1(tot).toFixed(1)} → ${isNum(s.score) ? s.score : Math.round(tot)}` : '–'}</b></div></section>`;
  }
  let WHY = null;
  function openWhy() {
    const r = RS.find(x => x.id === SL.focus); if (!r || WHY) return;
    const o = r.o, m = String(o.src_v2 || o.src || '').match(/update (\d{1,2} [A-Z][a-z]{2} \d{4})/), origin = document.activeElement;
    const el = document.createElement('div'); el.className = 'pk-modal sl-whym'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Why this score');
    el.innerHTML = `<div class="sl-why" tabindex="-1"><header><h2>WHY THIS SCORE</h2><span>${esc([short(o.name), r.pos, r.tier ? TIER_L[r.tier] : ''].filter(Boolean).join(' · '))}</span></header>
      <div class="cols">${whyCol(o, 'como_fit', 'Como Fit')}<i class="vr" aria-hidden="true"></i>${whyCol(o, 'realism', 'Realism')}</div>
      <footer><b>Points = weight × score</b><span>est. · our model${m ? ` · ext. inputs ${esc(m[1])}` : ''}</span></footer></div>`;
    el.addEventListener('click', e => { if (e.target === el) closeWhy(); });
    document.body.appendChild(el); WHY = { el, origin };
    el.querySelector('.sl-why').focus({ preventScroll: true });
    try { prompts(); } catch (e) { /* */ }
  }
  function closeWhy() {
    if (!WHY) return; const { el, origin } = WHY; el.remove(); WHY = null;
    const back = origin && origin.isConnected ? origin : rows().find(x => x.dataset.id === SL.focus);
    if (back) fx(back); else try { prompts(); } catch (e) { /* */ }
  }
  addEventListener('hashchange', () => { if (WHY) { WHY.el.remove(); WHY = null; } });
  // ---------- compare (approved Squad Compare Panel layout; X, on demand) ----------
  const fit1 = (o, key) => { const v = (o.role_fit_est || {})[key]; return isNum(v) ? v : null; };
  const refName = P => String((P.ref || {}).player || '').replace(/\s*\(.*\)\s*$/, '').trim();
  function compareHtml(P, o) {
    const n = refName(P), L = typeof squadList === 'function' ? squadList() : playerList(), op = L.find(q => fold(q.name) === fold(n)) || { name: n, at: {} };
    const sc = (((window.FC26_SQUAD || {}).squad_contracts) || []).find(x => fold(x.name) === fold(n)) || {};
    const ex = typeof extFace === 'function' ? extFace(op.id || fold(n)) : null, oPot = ex && isNum(ex.potential) ? ex.potential : null;
    const fits = ((P.ours_fit_est || {})[(P.ref || {}).player] || []), ks = P.fit_keys || [], side = /^L/.test(P.pos) ? 'left' : /^R/.test(P.pos) ? 'right' : '';
    const better = (a, b) => isNum(a) && isNum(b) && a !== b ? (a > b ? 'l' : 'r') : null;
    const cr = (label, l, r, b) => `<div class="cmp-row"><span class="${b === 'l' ? 'better' : ''}${l.t === '–' ? ' miss' : ''}">${esc(l.t)}${l.ext ? '<i>ext.</i>' : ''}</span><em>${esc(label)}</em><span class="${b === 'r' ? 'better' : ''}${r.t === '–' ? ' miss' : ''}">${esc(r.t)}${r.ext ? '<i>ext.</i>' : ''}</span></div>`;
    const footOk = ft => side ? (side === 'left' ? /left/i.test(ft) : /right/i.test(ft)) : null, oFoot = (op.at || {}).foot || '–';
    const scDate = /^(\d{4}-\d\d-\d\d)/.test(sc.src || '') ? shortDate(sc.src.slice(0, 10)) : '';
    const rows = [
      ...ks.slice(0, 2).map((k, i) => { const a = isNum(fits[i]) ? fits[i] : i === 0 && isNum((P.ref || {}).fit) ? P.ref.fit : null, b = fit1(o, k); return cr(`Fit as ${String(k).split('|')[1] || k} (est.)`, { t: isNum(a) ? a.toFixed(1) : '–' }, { t: isNum(b) ? b.toFixed(1) : '–' }, better(a, b)); }),
      cr(`Preferred foot${side ? ` (${P.pos})` : ''}`, { t: oFoot }, { t: o.foot || '–' }, side ? (footOk(oFoot) && !footOk(o.foot) ? 'l' : footOk(o.foot) && !footOk(oFoot) ? 'r' : null) : null),
      cr('Age', { t: isNum(op.age) ? String(op.age) : '–' }, { t: isNum(o.age_base_db) ? String(o.age_base_db) : '–' }, null),
      cr('OVR', { t: isNum(op.ovr) ? String(op.ovr) : '–' }, { t: isNum(o.ovr) ? String(o.ovr) : '–', ext: isNum(o.ovr) }, better(op.ovr, o.ovr)),
      cr('Potential', { t: isNum(oPot) ? String(oPot) : '–', ext: isNum(oPot) }, { t: isNum(o.pot) ? String(o.pot) : '–', ext: isNum(o.pot) }, better(oPot, o.pot)),
      cr('Match rating', { t: isNum(op.avg) ? op.avg.toFixed(1) : '–' }, { t: '–' }, null),
      cr('Contract left', { t: isNum(sc.contract_months) ? `${sc.contract_months} months` : '–' }, { t: o.contract_until ? `to ${o.contract_until}` : '–', ext: !!o.contract_until }, null),
      cr('Value', { t: eur(sc.value_eur) }, { t: eur(o.value_eur), ext: isNum(o.value_eur) }, null),
      cr('Wage / week', { t: eur(sc.wage_eur_week) }, { t: eur(o.wage_eur_week), ext: isNum(o.wage_eur_week) }, null),
    ].join('');
    const head = (nm, ovr, pos, face) => `<div class="cmp-p"><span class="o"><b>${ovr ?? '–'}</b><small>${esc(pos || '')}</small></span><span class="f">${face}</span><span class="n">${esc(nm)}</span></div>`;
    return `<aside class="sq-side sq-cmp-panel sl-cmppanel"><header class="cmp-head">${head(n || '–', op.ovr, op.pos || P.pos.replace(/^[LR](?=CB)/, ''), portrait(op, 'M'))}<h2>Player Info<br>Comparison</h2>${head(surname(o.name), o.ovr, (o.positions || [])[0], portrait({ name: '' }, 'M'))}</header>
      <div class="cmp-body fc-scroll" tabindex="-1">${rows}</div>
      <div class="cmp-src">Ours: in-game${scDate ? `; wage Squad Hub, ${esc(scDate)}` : ''} · his: ext. (23 Jun 2026)</div></aside>`;
  }

  // ---------- view ----------
  function ensureState(D) {
    const avail = ORDER.filter(p => posData(D, p));
    if (!SL.init) {   // entry (brief §4): the most urgent need, All tiers, Como Fit high -> low, the realistic starter focused
      const n0 = ((D.needs || [])[0] || {}), m = String(n0.need || n0.slot_role || '').match(/\b(GK|RB|RCB|LCB|LB|LCDM|RCDM|CAM|RM|LM|ST)\b/);
      SL.pos = m && avail.includes(m[1]) ? m[1] : 'All'; SL.tier = 'all'; SL.set = 'ov'; SL.sort = { k: 'fit', dir: 'desc' };
      const P = posData(D, SL.pos), b = P && P.best_realistic_starter; SL.focus = b ? `${SL.pos}|${b}` : null; SL.init = true;
    }
    if (SL.pos !== 'All' && !avail.includes(SL.pos)) SL.pos = 'All';
    if (!cols().some(c => c.k === SL.sort.k && c.get)) SL.sort = SL.tier === 'rc' && SL.set === 'ov' ? { k: 'rc', dir: 'desc' } : { k: 'fit', dir: 'desc' };
    if (SL.set === 'at' && !cols().some(c => c.k === SL.sort.k)) SL.sort = { k: 'name', dir: 'asc' };
  }
  let RS = [];   // the rows on show, in order
  function bodyHtml(D) {
    ensureState(D);
    RS = viewRows(D);
    if (!RS.some(r => r.id === SL.focus)) SL.focus = RS.length ? RS[0].id : null;
    const cur = RS.find(r => r.id === SL.focus) || null;
    const right = SL.cmp && cur ? compareHtml(posData(D, cur.pos) || { pos: cur.pos }, cur.o) : inspector(cur, D);
    // round 7 (S1 301:28513): the filter line, the header and the rows share the one list plate (150-1116, y 200-920)
    return `<div class="sl2-plate">${filtersHtml(D)}${headHtml()}<div class="sl2-rows fc-scroll" tabindex="-1">${RS.length ? RS.map(r => rowHtml(r, D)).join('') : '<p class="empty-note">No player for this filter</p>'}</div></div><div class="sl2-right">${right}</div>`;
  }
  window.signView = function () {
    const D = data(); if (!D) return null;
    return `<div class="sl-wrap sl2 v3 set-${SL.set}${SL.tier === 'rc' ? ' rc' : ''}" data-grid="g1">${bodyHtml(D)}</div>`;
  };
  const root = () => document.querySelector('#main .sl2');
  const rows = () => [...document.querySelectorAll('#main .sl2 .slr')];
  const sync = () => { if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); try { prompts(); } catch (e) { /* */ } };
  function keepVisible(el) {   // scroll inside the list only (never the page)
    const box = el && el.closest('.sl2-rows'); if (!box) return;
    const t = el.offsetTop - box.offsetTop, b = t + el.offsetHeight;
    if (t < box.scrollTop) box.scrollTop = t; else if (b > box.scrollTop + box.clientHeight) box.scrollTop = b - box.clientHeight;
  }
  const fx = el => { if (!el) return true; el.focus({ preventScroll: true }); keepVisible(el); sync(); return true; };
  function redraw(focusSel) {
    const w = root(), D = data(); if (!w || !D) return;
    const box = w.querySelector('.sl2-rows'), st = box ? box.scrollTop : 0;
    w.className = `sl-wrap sl2 v3 set-${SL.set}${SL.tier === 'rc' ? ' rc' : ''}`;
    w.innerHTML = bodyHtml(D);
    const nb = w.querySelector('.sl2-rows'); if (nb) nb.scrollTop = st;
    const el = focusSel && w.querySelector(focusSel);
    if (el) fx(el); else sync();
    markSel();
  }
  function redrawRight() {
    const w = root(), D = data(); if (!w || !D) return;
    const cur = RS.find(r => r.id === SL.focus) || null;
    w.querySelector('.sl2-right').innerHTML = SL.cmp && cur ? compareHtml(posData(D, cur.pos) || { pos: cur.pos }, cur.o) : inspector(cur, D);
    try { prompts(); } catch (e) { /* */ }
  }
  // Selected (V-3): the row on show keeps a white fill while the focus is in the header or the filter line
  function markSel() {
    const w = root(); if (!w) return; const a = document.activeElement;
    w.classList.toggle('hsel', !!(a && a.closest && a.closest('#main .sl2') && !a.classList.contains('slr')));
    w.querySelectorAll('.slr').forEach(r => r.classList.toggle('on', r.dataset.id === SL.focus));
  }
  function onFocusRow(el) {
    if (!el || !el.classList.contains('slr')) return;
    if (SL.focus !== el.dataset.id || SL.cmp) { SL.focus = el.dataset.id; SL.cmp = false; redrawRight(); }
    markSel();
  }
  const focusedRowSel = () => `.slr[data-id="${CSS.escape(SL.focus || '')}"]`;
  function setPos(p, keepFocusOnFilter = true) { const D = data(); if (!D || (p !== 'All' && !posData(D, p))) return; SL.pos = p; SL.cmp = false; if (SL.set === 'at') SL.sort = cols().some(c => c.k === SL.sort.k && c.get) ? SL.sort : { k: 'name', dir: 'asc' }; redraw(keepFocusOnFilter ? `.sl2-strip a[data-pos="${p}"]` : focusedRowSel()); }
  function setTier(t) { const was = SL.tier; SL.tier = t; SL.cmp = false; SL.tsOpen = false; if (SL.set === 'ov' && (t === 'rc') !== (was === 'rc')) SL.sort = t === 'rc' ? { k: 'rc', dir: 'desc' } : { k: 'fit', dir: 'desc' }; redraw('.sl2-tsel .tsel'); }
  function openTiers() { SL.tsOpen = true; redraw(`.sl2-tlist a[data-topt="${SL.tier}"]`); }
  function closeTiers() { SL.tsOpen = false; redraw('.sl2-tsel .tsel'); }
  function sortBy(k) {
    const c = cols().find(x => x.k === k); if (!c || !c.get) return;
    SL.sort = SL.sort.k === k ? { k, dir: SL.sort.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: c.d };
    redraw(`.slh[data-sort="${k}"]`);
  }
  function toggleSet() {
    const a = document.activeElement, onHead = a && a.closest && a.closest('#main .sl2-head');
    SL.set = SL.set === 'ov' ? 'at' : 'ov'; SL.cmp = false;
    SL.sort = SL.set === 'at' ? { k: 'name', dir: 'asc' } : SL.tier === 'rc' ? { k: 'rc', dir: 'desc' } : { k: 'fit', dir: 'desc' };
    if (SL.set === 'at') { const s = cols().find(c => c.k === 'a0' && c.get); if (s) SL.sort = { k: 'a0', dir: 'desc' }; }
    redraw(onHead ? '.slh.sorted' : focusedRowSel());
  }
  function toggleTarget() { const r = RS.find(x => x.id === SL.focus); if (!r) return; toggle(r); redraw(focusedRowSel()); }
  const openCmp = () => { if (!SL.focus) return; SL.cmp = true; redrawRight(); };
  document.addEventListener('focusin', e => { const t = e.target; if (!t.closest || !t.closest('#main .sl2')) return; if (t.classList.contains('slr')) onFocusRow(t); else markSel(); });
  document.addEventListener('mouseover', e => { const r = e.target.closest && e.target.closest('#main .sl2 .slr'); if (r && document.activeElement !== r && !WHY && !SL.tsOpen) r.focus({ preventScroll: true }); });
  document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('#main .sl2')) return;
    const p = e.target.closest('.sl2-strip a[data-pos]'); if (p) { e.preventDefault(); if (!p.classList.contains('na')) setPos(p.dataset.pos); return; }
    const o = e.target.closest('.sl2-tlist a[data-topt]'); if (o) { e.preventDefault(); setTier(o.dataset.topt); return; }
    if (e.target.closest('[data-tsel]')) { e.preventDefault(); if (SL.tsOpen) closeTiers(); else openTiers(); return; }
    const h = e.target.closest('.slh[data-sort]'); if (h) { e.preventDefault(); sortBy(h.dataset.sort); return; }
    const r = e.target.closest('.slr'); if (r) { e.preventDefault(); r.focus(); onFocusRow(r); toggleTarget(); return; }
    if (e.target.closest('[data-why]')) { openWhy(); }
  });
  // ---------- pad map (brief §4; Leon 25 Nov: Y by focus = Search on the filter line / header, Why this score on a row) ----------
  const posStops = () => [...document.querySelectorAll('#main .sl2-strip a:not(.na)')];
  const tsel = () => document.querySelector('#main .sl2-tsel .tsel');
  const tOpts = () => [...document.querySelectorAll('#main .sl2-tlist a[data-topt]')];
  const headStops = () => [...document.querySelectorAll('#main .sl2-head .slh:not([disabled])')];
  const rLabel = () => SL.set === 'ov' ? 'Attributes' : 'Overview';
  const near = (list, a) => { const cx = a.getBoundingClientRect().left + a.offsetWidth / 2; return list.slice().sort((p, q) => Math.abs(p.getBoundingClientRect().left + p.offsetWidth / 2 - cx) - Math.abs(q.getBoundingClientRect().left + q.offsetWidth / 2 - cx))[0]; };
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.sign = {
    z: 2,
    active: () => typeof S === 'object' && S.page === 'scouting' && !!document.querySelector('#main .sl2') && !WHY,
    prompts() {
      if (SL.cmp) return [['B', 'Close compare'], ['RS', 'Scroll']];
      if (SL.tsOpen) return [['A', 'Apply'], ['B', 'Close']];
      const a = document.activeElement;
      if (a && a.closest && a.closest('#main .sl2-head')) return [['A', 'Sort'], ['B', 'Back to rows'], ['LTRT', 'Group'], ['Y', 'Search'], ['R', rLabel()]];
      if (a && a.dataset && a.dataset.tsel) return [['A', 'Choose tier'], ['B', 'Back to rows'], ['LTRT', 'Group'], ['Y', 'Search'], ['R', rLabel()]];
      if (a && a.closest && a.closest('#main .sl2-filters')) return [['B', 'Back to rows'], ['LTRT', 'Group'], ['Y', 'Search'], ['R', rLabel()]];
      // Leon 2026-11-24 (layout-grid-and-pad-parity, Decision 2): B does nothing on a top screen, so the rows show no "B Back"
      if (a && a.classList && a.classList.contains('slr')) return [['A', mine(a.dataset.id) ? 'Unmark' : 'Mark target'], ['LTRT', 'Group'], ['X', 'Compare'], ['Y', 'Why this score'], ['R', rLabel()]];
      return [['LTRT', 'Group'], ['X', 'Compare'], ['Y', 'Search'], ['R', rLabel()]];
    },
    press(k) {
      const a = document.activeElement, rs = rows(), i = rs.indexOf(a);
      const inHead = a && a.closest && a.closest('#main .sl2-head'), inFil = a && a.closest && a.closest('#main .sl2-filters'), onSel = !!(a && a.dataset && a.dataset.tsel);
      const toRow = () => fx(rs.find(x => x.dataset.id === SL.focus) || rs[0] || null);
      if (SL.cmp) { if (k === 'B') { SL.cmp = false; redrawRight(); return toRow(); } return /^(A|X|Y|R|UP|DOWN|LEFT|RIGHT)$/.test(k); }
      if (SL.tsOpen) {   // the Tier Selector option list (Open state): ↑↓ choose, A apply, B close
        const os = tOpts(), j = os.indexOf(a);
        if (k === 'UP' || k === 'DOWN') { const n = os[Math.max(0, Math.min(os.length - 1, (j < 0 ? 0 : j) + (k === 'DOWN' ? 1 : -1)))]; return fx(n); }
        if (k === 'A') { const o = os[j] || os[0]; if (o) setTier(o.dataset.topt); return true; }
        if (k === 'B') { closeTiers(); return true; }
        return true;
      }
      if (k === 'LT' || k === 'RT') return window.PAD_HOOKS.desk.press(k);
      if (k === 'R') { toggleSet(); return true; }
      if (k === 'B') { if (inHead || inFil) return toRow(); return true; }   // rows: B does nothing (top screen)
      if (k === 'X') { if (i >= 0) { openCmp(); return true; } return true; }
      if (k === 'Y') { if (i >= 0) { onFocusRow(a); openWhy(); return true; } return false; }   // filter line / header: Search (global)
      if (k === 'A') {
        if (i >= 0) { onFocusRow(a); toggleTarget(); return true; }
        if (inHead && a.dataset.sort) { sortBy(a.dataset.sort); return true; }
        if (onSel) { openTiers(); return true; }
        return !!inFil;
      }
      if (k === 'UP') {
        if (inFil) return true;
        if (inHead) return fx(near([...document.querySelectorAll('#main .sl2-strip a.on'), tsel()].filter(Boolean), a));
        if (i === 0 || i < 0) { const h = document.querySelector('#main .slh.sorted') || headStops()[0]; return fx(h); }
        return fx(rs[i - 1]);
      }
      if (k === 'DOWN') {
        if (inFil) return fx(near(headStops(), a) || toRow());
        if (inHead) return toRow();
        if (i >= 0 && i < rs.length - 1) return fx(rs[i + 1]);
        return true;
      }
      if (k === 'LEFT' || k === 'RIGHT') {
        const d = k === 'RIGHT' ? 1 : -1;
        if (onSel) return d < 0 ? fx(document.querySelector('#main .sl2-strip a.on') || posStops().pop()) : true;
        if (inFil) {   // focus = selection on the position tabs; → past the last tab AND ← on the first tab (All) = the Tier Selector
          const st = posStops(), n = st[st.indexOf(a) + d];
          if (!n) return fx(tsel());   // round 7 follow-up: from All the Tier is one press away, without changing the position
          setPos(n.dataset.pos); return true;
        }
        if (inHead) { const st = headStops(), n = st[st.indexOf(a) + d]; return n ? fx(n) : true; }
        return i >= 0 ? true : false;   // the bio card carries no stops (FC 26 panels have no buttons)
      }
      return false;
    },
    scrollTarget: () => SL.cmp ? document.querySelector('#main .sl2-right .cmp-body') : document.querySelector('#main .sl2-rows'),
  };
  window.PAD_HOOKS.signWhy = {
    z: 6,
    active: () => !!WHY,
    prompts: () => [['B', 'Close']],
    press(k) { if (k === 'B' || k === 'Y') { closeWhy(); return true; } return true; },
  };
  window.SIGN = { get state() { return SL; }, get rows() { return RS; }, get why() { return !!WHY; }, loadT, exportList, openWhy, closeWhy, reset() { SL.init = false; SL.cmp = false; SL.tsOpen = false; if (WHY) closeWhy(); },
    focusEntry() { const r = rows().find(x => x.dataset.id === SL.focus) || rows()[0]; if (r) fx(r); markSel(); } };
})();
