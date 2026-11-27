/* Coaching › Findings v2: a sortable FC 26 findings list with a detail card and an Evidence popup (UI round 8, Leon OK 25 Nov).
   Brief docs/ui_changes/2026-11-25_coaching-findings-list.md, critique docs/ui_reference/levels/5_pages/round8_critique.md.
   Figma (file QeCUkHXbS34AlbGkdoliCJ): Screens 319:38396 (F1 319:38397 entry · F2 319:40440 hunch · F3 321:39794 1366 · F4 320:39090
   option list · F5 320:39304 Evidence · F6 321:40159 empty · F7 321:40523 loading); parts in 316:5056: Finding Row 316:5201,
   Findings Header 316:5221, Confidence Tag 316:5087, Who Mark 316:5101, Evidence Row 316:5236, Filter Selector 318:5173,
   Filter Option 318:5187, Finding Detail Card 317:5077, Evidence Popup 317:5145.
   Data: the coach file `findings[]` (docs/coaching_v2.md §6.1, schema coach_v2 $defs/finding). Coach files without `findings`
   (every file before 25 Nov, Leon answer 2): the ledger rules become the rows, tag from their trust and sample, every number from
   the ledger (data/ledger.js) and the facts gate; nothing is invented. Evidence = the facts behind `refs` (facts sheet), ledger rules
   expanded per match with their replay moments (ledger.possessions), the pooled value against the check.
   Pad (brief §4): entry = row 1 of the current sort (Confidence high -> low, Leon answer 1); ↑↓ rows; ↑ from row 1 = header
   (Who · Confidence · Sample, A sorts); ↑ = filter line (Area · Who · Confidence, A opens the option list); X = Filter from any row
   (the Area list opens, ←→ walks the three lists); A on a row = Evidence (A Watch, B back to the row); Y = Search; LT RT = tabs. */
'use strict';
(function () {
  const AREAS = [['tactics', 'Tactics'], ['duo', 'Duo'], ['habits', 'Habits'], ['shooting', 'Shooting'], ['passing', 'Passing'], ['defending', 'Defending'],
    ['set_pieces', 'Set pieces'], ['style', 'Style'], ['squad', 'Squad'], ['opponent', 'Opponent'], ['capture', 'Capture']];
  const AREA_L = Object.fromEntries(AREAS);
  const TAGS = [['solid', 'Solid'], ['likely', 'Likely'], ['hunch', 'Hunch']];
  const TAG_L = Object.fromEntries(TAGS), TAG_R = { solid: 3, likely: 2, hunch: 1 };
  const KIND_R = { p1: 0, p2: 1, duo: 2, team: 3, player: 4 };
  // ledger fallback: the rule's area in the findings vocabulary and its key-number label (row: <= 10 characters, copy guide §6)
  const RULE_AREA = { sprint_chasing: 'habits', jockey_low: 'habits', press_won: 'habits', pass_kept: 'passing', forward_passes: 'passing', shot_power: 'shooting',
    duo_same_zone: 'duo', duo_double_press: 'duo', loss_reaction_ok: 'duo', duo_both_high: 'duo', rest_defence: 'defending', own_third_losses: 'defending',
    width_in_poss: 'style', line_height_out: 'tactics', regains_high: 'defending' };
  const RULE_KEY = { sprint_chasing: 'RT held', jockey_low: 'LT held', press_won: 'won', pass_kept: 'kept', forward_passes: 'forward', shot_power: 'B held',
    duo_same_zone: 'same zone', duo_double_press: 'both press', loss_reaction_ok: 'reacted', duo_both_high: 'both high', rest_defence: 'behind',
    own_third_losses: 'per 10 min', width_in_poss: 'width', line_height_out: 'from goal', regains_high: 'their 3rd' };
  const SRC_L = { '[official]': 'official', '[radar]': 'radar', '[ctrl]': 'controller', '[p2-ctrl]': 'pad', '[squad]': 'squad', '[3d]': '3D view' };
  const COLS = { who: 'asc', tag: 'desc', n: 'desc' };
  const F = { sort: { k: 'tag', dir: 'desc' }, area: 'all', who: 'all', tag: 'all', focus: null, open: null, origin: null, lastF: null, key: null, loading: {} };
  let RS = [], ALL = [], M = null, EV = null;

  // ---------- helpers ----------
  const L = () => (typeof ledger === 'function' ? ledger() : null) || {};
  const ruleDef = id => (L().rules || []).find(r => r.id === id) || null;
  const num = v => String(+(+v).toFixed(2));
  const SYM = { '%': ' %', s: ' s', m: ' m', 'm/s': ' m/s', min: ' min' };
  const WORDLESS = /^(count|rating|ovr|text|xg|xG|share|ratio|pts|of \d+|%|s|m|m\/s|min|×|x|)$/;
  function fmtVal(v, u) {
    if (!isNum(v)) return v == null || v === '' ? '–' : String(v);
    u = String(u || '');
    if (u === 'share') return Math.round(v * 100) + ' %';
    if (u === 'ratio' || u === '×' || u === 'x') return num(v) + '×';
    if (u === 'rating') return v.toFixed(1);
    if (/^of \d+$/.test(u) || u === 'pts') return `${num(v)} ${u}`;
    return num(v) + (SYM[u] || '');
  }
  const wordUnit = u => (u && !WORDLESS.test(String(u)) ? String(u) : '');
  const SING = { matches: 'match', losses: 'loss', passes: 'pass', presses: 'press' };
  const unitOf = (n, u) => (n === 1 ? (SING[u] || String(u || '').replace(/([^s])s$/, '$1')) : String(u || ''));
  const kindOf = who => { const w = fold(String(who || '')); if (!w) return 'team'; if (w === fold(P1()) || w === 'me' || w === 'p1' || w === 'leon') return 'p1'; if (w === fold(P2()) || w === 'p2' || w === 'peti') return 'p2';
    if (w === 'duo' || w === 'together' || w === 'both' || (w.includes(fold(P1())) && w.includes(fold(P2())))) return 'duo'; if (w === 'team' || w === 'us') return 'team'; return 'player'; };
  const whoName = r => r.kind === 'p1' ? P1() : r.kind === 'p2' ? P2() : r.kind === 'duo' ? 'Duo' : r.kind === 'team' ? 'Team' : String(r.who || '');
  const WHO_OPTS = () => [['all', 'Everyone'], ['p1', P1()], ['p2', P2()], ['duo', 'Duo'], ['team', 'Team'], ['player', 'Players']];
  const narrow = () => innerWidth < 1500;
  // facts by id across every loaded day (cached per facts object)
  let FX = null, FXsig = '';
  function factById(id) {
    const all = window.FC26_FACTS || {}, sig = Object.keys(all).map(d => d + ':' + ((all[d] || {}).facts || []).length).join('|');
    if (!FX || sig !== FXsig) { FX = new Map(); FXsig = sig; Object.values(all).forEach(D => ((D && D.facts) || []).forEach(f => { if (f && f.id) FX.set(f.id, f); })); }
    return FX.get(id) || null;
  }
  const dayFacts = day => (((window.FC26_FACTS || {})[day] || {}).facts) || [];
  const dayMatches = day => matchList().filter(m => String(m.id).split('#')[0] === day);
  const matchName = mid => { const r = typeof matchRef === 'function' ? matchRef(mid) : null; const f = dayFacts(String(mid).split('#')[0]).find(x => x.match === mid && x.match_name); return f ? f.match_name : r ? r.title : String(mid); };
  const isLedger = metric => !!ruleDef(String(metric || '').replace(/^ledger:/, ''));
  function fmtRuleV(id, v) { const d = ruleDef(id) || {}; if (!isNum(v)) return '–'; return d.fmt === 'pct' ? Math.round(v * 100) + ' %' : d.fmt === 's' ? `${v.toFixed(2)} s` : d.fmt === 'm' ? `${Math.round(v)} m` : fmt(v, 1); }
  function factLabel(f) {
    const p = String(f.path || '');
    if (/^ledger:/.test(p)) { const d = ruleDef(p.slice(7)); return d ? d.title : p.slice(7).replace(/_/g, ' '); }
    const o = /^official\.[A-Z0-9]+\.([^/(]+?)\s*(\(|$|\.)/.exec(p); if (o) return o[1].trim();
    const seg = p.replace(/\[\d+\]/g, '').split('.').filter(Boolean).pop() || p;
    const w = seg.replace(/_/g, ' '); return w.charAt(0).toUpperCase() + w.slice(1);
  }
  function factValue(f) {
    if (!f) return '–';
    if (f.trust === 'blocked') return 'not measurable';
    const v = f.value, u = f.unit;
    if (Array.isArray(v)) return v.map(x => (u === 'share' ? Math.round(x * 100) : isNum(x) ? num(x) : x)).join('–') + (u === 'share' ? ' %' : SYM[u] || '');
    if (u === 'xG') return isNum(v) ? v.toFixed(2) : String(v);
    if (u === 'text') { const s = String(v == null ? '' : v); return s.length > 22 ? s.slice(0, 21) + '…' : s; }
    return fmtVal(v, u);
  }
  // ---------- check metrics (next_match_targets vocabulary): a ledger rule, an official path (".0" us / ".1" them), a digest path
  //            (kpis.*, controller_me.*, controller_friend.*) or a ratio "A / B"; values from the facts gate, formatted by the facts' unit
  const TOK = { sprint_frac_attack: 'RT held, attacking', sprint_frac_defence: 'RT held, defending', sprint_frac: 'RT held', lt_frac_defence: 'LT held, defending',
    lt_frac_attack: 'LT held, attacking', lt_frac: 'LT held', box_us: 'Our box entries', box_them: 'Their box entries', 'Expected Goals': 'xG', Shots: 'shots' };
  const parts = m => String(m || '').split(/\s+\/\s+/).map(s => s.trim()).filter(Boolean);
  const offOf = p => /^(official\.[A-Z0-9]+\..+?)(?:\.([01]))?$/.exec(p);
  function pathValue(p, mid) {
    const rule = p.replace(/^ledger:/, '');
    if (ruleDef(rule)) {
      const f = factOf(mid, 'ledger:' + rule); if (f && f.trust === 'blocked') return null;
      const x = (((L().matches || {})[mid] || {}).findings || []).find(y => y.rule === rule); return x && isNum(x.value) ? x.value : null;
    }
    const o = offOf(p), f = factOf(mid, o ? o[1] : p) || null, g = f && f.trust !== 'missing' ? f : (o ? factOf(mid, p) : null);
    if (!g || g.trust === 'blocked' || g.trust === 'missing') return null;
    const i = o && o[2] != null && g.path !== p ? +o[2] : 0;
    return Array.isArray(g.value) ? (isNum(g.value[i]) ? g.value[i] : null) : isNum(g.value) ? g.value : null;
  }
  function metricValue(metric, mid) {
    const ps = parts(metric); if (ps.length === 2) { const a = pathValue(ps[0], mid), b = pathValue(ps[1], mid); return isNum(a) && isNum(b) && b ? a / b : null; }
    return pathValue(ps[0] || '', mid);
  }
  function unitOfMetric(metric) {   // the facts' unit for this path (share -> %)
    const ps = parts(metric); if (ps.length !== 1) return 'ratio';
    const p = ps[0], rule = p.replace(/^ledger:/, ''); if (ruleDef(rule)) return 'rule';
    const o = offOf(p), base = o ? o[1] : p, f = dayFacts(M ? M.day : '').find(x => x.path === base || x.path === p);
    return f ? f.unit : '';
  }
  function partLabel(p) {
    const rule = p.replace(/^ledger:/, '');
    if (ruleDef(rule)) { const k = RULE_KEY[rule]; return k ? k.charAt(0).toUpperCase() + k.slice(1) : ruleDef(rule).title; }
    const o = offOf(p);
    if (o) { const n = /^official\.[A-Z0-9]+\.([^(]+?)\s*(\(|$)/.exec(o[1]); const s = n ? n[1].trim() : o[1]; return { s, them: o[2] === '1' }; }
    const seg = p.replace(/^dg:[^:]+:/, '').split('.').filter(Boolean).pop() || p;
    if (TOK[seg]) return TOK[seg];
    const w = seg.replace(/_/g, ' '); return w.charAt(0).toUpperCase() + w.slice(1);
  }
  function metricLabel(metric) {
    const ps = parts(metric), L0 = ps.map(partLabel);
    const txt = x => typeof x === 'string' ? x : `${x.them ? 'Their ' : ''}${x.them ? (TOK[x.s] || x.s) : x.s}`;
    if (L0.length === 2) {
      if (typeof L0[0] === 'object' && typeof L0[1] === 'object' && L0[0].them === L0[1].them) { const a = TOK[L0[0].s] || L0[0].s, b = TOK[L0[1].s] || L0[1].s; return `${L0[0].them ? 'Their ' : ''}${a} per ${String(b).replace(/s$/, '')}`; }
      if (/box entries/i.test(txt(L0[0])) && /box entries/i.test(txt(L0[1]))) return 'Box entries, us / them';
      return `${txt(L0[0])} / ${txt(L0[1])}`;
    }
    return L0.length ? txt(L0[0]) : '';
  }
  function metricFmt(metric, v) {
    if (Array.isArray(v)) return v.map(x => metricFmt(metric, x)).join('–');
    if (!isNum(v)) return String(v);
    const rule = String(metric || '').replace(/^ledger:/, ''); if (ruleDef(rule)) return fmtRuleV(rule, v);
    const u = unitOfMetric(metric);
    if (u === 'share') return Math.round(v * 100) + ' %';
    if (u === 'ratio') return v.toFixed(2);
    return num(v) + (SYM[u] || '');
  }
  const rangeFmt = (metric, a, b) => { const fa = metricFmt(metric, a), fb = metricFmt(metric, b), u = / (%|s|m)$/.exec(fb);
    return `${u && fa.endsWith(u[0]) ? fa.slice(0, -u[0].length) : fa}–${fb}`; };
  const opSym = op => op === '<=' ? '≤' : op === '>=' ? '≥' : '';
  function checkText(c) {
    if (!c) return '';
    if (c.op === 'between' && Array.isArray(c.value)) return `${metricLabel(c.metric)} ${rangeFmt(c.metric, c.value[0], c.value[1])}`;
    return `${metricLabel(c.metric)} ${opSym(c.op)} ${metricFmt(c.metric, c.value)}`;
  }
  const onTarget = (c, v) => !c || !isNum(v) ? null : c.op === '<=' ? v <= c.value : c.op === '>=' ? v >= c.value : Array.isArray(c.value) ? v >= c.value[0] && v <= c.value[1] : null;
  function srcFamilies(facts, refs) {
    const s = [];
    facts.forEach(f => { const l = SRC_L[f.label] || ''; if (l && !s.includes(l)) s.push(l); if (/minimap/.test(f.words || '') && (l === 'controller' || l === 'pad') && !s.includes('minimap')) s.push('minimap'); });
    (refs || []).forEach(r => { if (/^i\./.test(r) && !s.includes('insights')) s.push('insights'); if (/^dg:.*official/.test(r) && !s.includes('official')) s.push('official'); if (/^style:/.test(r) && !s.includes('style')) s.push('style'); });
    return s.slice(0, 3).join(' + ') || 'coach';
  }

  // ---------- model ----------
  function normCoach(f, i) {
    const nums = (f.numbers || []).slice(0, 4).map(x => { const fx = /^d[0-9a-f]{5,}$/.test(x.ref || '') ? factById(x.ref) : null;
      return { l: String(x.label || ''), v: fmtVal(x.value, x.unit), w: wordUnit(x.unit), rough: !!(fx && fx.trust === 'rough') }; });
    const facts = (f.refs || []).concat((f.numbers || []).map(x => x.ref)).map(r => /^d[0-9a-f]{5,}$/.test(r || '') ? factById(r) : null).filter(Boolean);
    const uniq = [...new Map(facts.map(x => [x.id, x])).values()];
    return { id: String(f.id), i, src: 'coach', area: AREA_L[f.area] ? f.area : 'capture', who: f.who, kind: kindOf(f.who), title: String(f.title || ''), tag: TAG_L[f.tag] ? f.tag : 'hunch',
      n: { value: f.n && isNum(f.n.value) ? f.n.value : null, unit: (f.n && f.n.unit) || '' }, nums, action: f.action || '', check: f.check || null, refs: f.refs || [], focus: !!f.focus && f.tag !== 'hunch',
      facts: uniq, srcText: srcFamilies(uniq, f.refs), rough: uniq.length > 0 && uniq.every(x => x.trust === 'rough'), f };
  }
  // Leon answer 2 (25 Nov): old coach files -> the ledger rules as findings rows; tag from trust + sample; numbers from the ledger only
  function ledgerRows(c, day) {
    const Ld = L(), ms = matchList(), sess = ((Ld.sessions || {})[day] || []);
    const tgtRules = new Set(((c && c.next_match_targets) || []).map(t => ({ rt_defending: 'sprint_chasing', lt_defending: 'jockey_low', loss_reaction: 'loss_reaction_ok', width: 'width_in_poss' })[t.id]).filter(Boolean));
    return (Ld.season || []).map((r, i) => {
      const id = r.rule, d = ruleDef(id) || {};
      const per = ms.map(m => { const fnd = (((Ld.matches || {})[m.id] || {}).findings || []).find(x => x.rule === id); return fnd ? { m, fnd, f: factOf(m.id, 'ledger:' + id) } : null; }).filter(Boolean);
      const counted = per.filter(x => x.fnd.enough_data && !(x.f && x.f.trust === 'blocked')), flagged = counted.filter(x => x.fnd.flagged).length;
      const blocked = per.length > 0 && per.every(x => x.f && x.f.trust === 'blocked');
      const firm = counted.some(x => x.f && x.f.trust === 'firm'), rough = counted.length > 0 && counted.every(x => x.f && x.f.trust === 'rough');
      const tag = blocked || counted.length < 2 ? 'hunch' : firm ? 'solid' : 'likely';
      const s = sess.find(x => x.rule === id), lastC = counted[counted.length - 1];
      const nums = blocked ? [{ l: 'not meas.', v: '–', w: '', rough: false, muted: true }] : [
        { l: RULE_KEY[id] || 'season', v: fmtRuleV(id, r.value), w: '', rough },
        s && isNum(s.value) ? { l: `${shortDate(day)} session`, v: fmtRuleV(id, s.value), w: '', rough: false } : null,
        { l: 'Flagged', v: `${flagged} of ${counted.length}`, w: 'matches', rough: false },
        lastC ? { l: `Last match · ${matchName(lastC.m.id)}`, v: fmtRuleV(id, lastC.fnd.value), w: '', rough: !!(lastC.f && lastC.f.trust === 'rough') } : null].filter(Boolean);
      if (!blocked && nums[0]) nums[0].full = 'Season, pooled';
      const facts = per.map(x => x.f).filter(f => f && f.id);
      return { id: 'L-' + id, rule: id, i, src: 'ledger', area: RULE_AREA[id] || (r.who === 'duo' ? 'duo' : r.who === 'me' ? 'habits' : 'defending'), who: r.who === 'me' ? P1() : r.who === 'duo' ? 'duo' : 'team',
        kind: r.who === 'me' ? 'p1' : r.who === 'duo' ? 'duo' : 'team', title: String(r.title || d.title || id), tag, n: { value: counted.length, unit: 'matches' }, nums,
        action: blocked ? '' : (d.advice || r.advice || ''), check: blocked || !isNum(d.thr) ? null : { metric: id, op: d.dir === 'high_bad' ? '<=' : '>=', value: d.thr },
        refs: facts.map(f => f.id), focus: !blocked && tgtRules.has(id) && tag !== 'hunch', facts, blocked, why: blocked ? plainReason((per[per.length - 1].f || {}).blocked_because) : '',
        srcText: blocked ? 'ledger' : ['ledger', ...srcFamilies(facts, []).split(' + ').filter(x => x !== 'coach')].slice(0, 3).join(' + '), rough };
    });
  }
  function model(lc) {
    const c = lc.v, key = lc.day + '|' + (c.findings ? c.findings.length : 'L') + '|' + ((L().generated) || '') + '|' + FXsig;
    if (M && M.key === key && M.c === c) return M;
    const coach = Array.isArray(c.findings) && c.findings.length > 0;
    ALL = coach ? c.findings.map(normCoach) : ledgerRows(c, lc.day);
    M = { key, c, day: lc.day, src: coach ? 'coach' : 'ledger', rows: ALL };
    return M;
  }
  // ---------- sort + filter ----------
  const uRank = r => /^match/.test(r.n.unit) ? 1 : 0;
  const nCmp = (a, b) => (uRank(a) - uRank(b)) || ((a.n.value || 0) - (b.n.value || 0));
  const whoCmp = (a, b) => (KIND_R[a.kind] - KIND_R[b.kind]) || whoName(a).localeCompare(whoName(b));
  function sorted(rows) {
    const k = F.sort.k, s = F.sort.dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      let d = k === 'who' ? whoCmp(a, b) * s : k === 'n' ? nCmp(a, b) * s : (TAG_R[a.tag] - TAG_R[b.tag]) * s;
      if (!d && k !== 'tag') d = TAG_R[b.tag] - TAG_R[a.tag];
      if (!d) d = -nCmp(a, b);   // ties: sample, matches first, high -> low (brief §1)
      return d || a.i - b.i;
    });
  }
  const pass = (r, o = {}) => { const a = o.area ?? F.area, w = o.who ?? F.who, t = o.tag ?? F.tag; return (a === 'all' || r.area === a) && (w === 'all' || r.kind === w) && (t === 'all' || r.tag === t); };
  const optsOf = key => key === 'area' ? [['all', 'All areas'], ...AREAS] : key === 'who' ? WHO_OPTS() : [['all', 'All tags'], ...TAGS];
  const curLabel = key => (optsOf(key).find(o => o[0] === F[key]) || optsOf(key)[0])[1];

  // ---------- html ----------
  const mark = r => {
    if (r.kind === 'p1' || r.kind === 'p2') return `<span class="fd-mk"><i class="fd-dot ${r.kind}"></i></span>`;
    if (r.kind === 'duo') return '<span class="fd-mk duo"><i class="fd-dot p1"></i><i class="fd-dot p2"></i></span>';
    if (r.kind === 'team') return '<span class="fd-mk"><img class="fd-crest" src="assets/crests/COM.png" alt=""></span>';
    const p = typeof playerByName === 'function' ? playerByName(r.who) : null;
    return `<span class="fd-mk pl">${portrait(p || { name: '' }, 'S')}</span>`;
  };
  const tagHtml = (t, cls = '') => `<span class="fd-tag ${t}${cls ? ' ' + cls : ''}"><b>${esc(TAG_L[t])}</b><i></i><i></i><i></i></span>`;
  const sampleUnit = r => unitOf(r.n.value, r.n.unit);
  function rowHtml(r) {
    const k = r.nums[0] || { v: '–', l: '' };
    return `<a class="fdr${r.id === F.focus ? ' cur' : ''}" href="#" data-id="${esc(r.id)}" aria-label="${esc(`${whoName(r)} · ${AREA_L[r.area]}: ${r.title}, ${TAG_L[r.tag]}${r.focus ? ', in focus' : ''}`)}">`
      + `${r.focus ? '<i class="fd-inf" aria-hidden="true"></i>' : ''}${mark(r)}<b class="fd-wn">${esc(whoName(r))}</b><small class="fd-wa">${esc(AREA_L[r.area])}</small>`
      + `<span class="fd-t"><span>${esc(r.title)}</span></span>${tagHtml(r.tag)}`
      + `<b class="fd-n">${isNum(r.n.value) ? num(r.n.value) : '–'}</b><small class="fd-nu">${esc(sampleUnit(r))}</small>`
      + `<b class="fd-k${k.muted ? ' muted' : ''}">${esc(k.v)}</b><small class="fd-kl">${esc(k.l)}</small></a>`;
  }
  function headHtml(dis) {
    const n = narrow(), cell = (k, l, ls, cls) => { const on = F.sort.k === k, asc = on && F.sort.dir !== COLS[k];
      return `<button type="button" class="fdh ${cls}${on ? ' sorted' + (asc ? ' asc' : '') : ''}" data-fsort="${k}"${dis ? ' disabled tabindex="-1"' : ''} aria-label="Sort by ${esc(l)}" aria-sort="${on ? (F.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(n && ls ? ls : l)}${on ? '<i class="arr" aria-hidden="true"></i>' : ''}</button>`; };
    return `<div class="fd-head" role="row">${cell('who', 'Who', '', 'h-who')}<span class="fdh h-t">Finding</span>${cell('tag', 'Confidence', 'Conf.', 'h-tag')}${cell('n', 'Sample', '', 'h-n')}<span class="fdh h-k">${n ? 'Key' : 'Key number'}</span></div>`;
  }
  function filtersHtml(dis) {
    const sel = (key, i) => {
      const open = F.open === key, list = open ? `<div class="fd-flist" role="listbox" aria-label="${esc(key)}">${optsOf(key).map(([v, l]) => {
        const c = ALL.filter(r => pass(r, { [key]: v })).length;
        return `<a href="#" tabindex="-1" role="option" data-fopt="${esc(v)}" class="${v === F[key] ? 'cur' : ''}${c ? '' : ' zero'}" aria-selected="${v === F[key]}"><span>${esc(l)}</span><small>${c}</small></a>`; }).join('')}</div>` : '';
      return `<div class="fd-fsel s${i}${open ? ' open' : ''}"><button type="button" class="fsel" data-fsel="${key}" tabindex="-1" aria-haspopup="listbox" aria-expanded="${open}"${dis ? ' disabled' : ''} aria-label="${esc(curLabel(key))}"><i class="al" aria-hidden="true"></i><b>${esc(curLabel(key))}</b><i class="ar" aria-hidden="true"></i></button>${list}</div>`;
    };
    return `<div class="fd-filters">${sel('area', 0)}${sel('who', 1)}${sel('tag', 2)}${dis ? '' : `<span class="fd-count">${RS.length} of ${ALL.length}</span>`}</div>`;
  }
  const dc = (l, v, o = {}) => `<div class="dcell${o.cls ? ' ' + o.cls : ''}"><span class="k">${esc(l)}</span><span class="v ${o.tone || ''}">${v == null || v === '' ? '–' : esc(v)}${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</span></div>`;
  function sampleExtra(r) {   // "1 match · Napoli": the one match the facts name (data, not a guess)
    if (r.n.value !== 1 || !/^match/.test(r.n.unit)) return '';
    const names = [...new Set(r.facts.filter(f => f.match).map(f => f.match_name).filter(Boolean))];
    return names.length === 1 ? ' · ' + names[0] : '';
  }
  function checkCells(r) {
    const c = r.check; if (!c) return '';
    const ms = dayMatches(M.day).map(m => ({ m, v: metricValue(c.metric, m.id) })).filter(x => isNum(x.v));
    const last = ms[ms.length - 1], ok = last ? onTarget(c, last.v) : null, vs = ms.map(x => x.v);
    const range = vs.length > 1 ? rangeFmt(c.metric, Math.min(...vs), Math.max(...vs)) : '';
    return `<div class="fd-chk">${dc('Check', checkText(c))}${last ? `<i class="vr"></i>${dc(narrow() && last.m.opp && last.m.opp !== '?' ? `Last · ${last.m.opp}` : `Last match · ${matchName(last.m.id)}`, metricFmt(c.metric, last.v), { tone: ok == null ? '' : ok ? 'pos' : 'neg' })}` : ''}${range ? `<i class="vr rgv"></i>${dc('Range today', range, { cls: 'rg' })}` : ''}</div>`;
  }
  function cardHtml(r) {
    if (!r) return '';
    const nums = r.nums.map(x => dc(x.full || x.l, x.v, { tone: x.muted ? 'muted' : '', tag: [x.w, x.rough ? 'rough' : ''].filter(Boolean).join(' · ') })).join('');
    const why = r.blocked ? dc('Why', r.why, { tone: 'muted', cls: 'why' }) : '';
    const next = r.action || r.check ? `<div class="fd-next"><h4>${r.action ? 'Next match' : 'Watch next match'}</h4>${r.action ? `<p class="fd-act">${esc(r.action)}</p>` : ''}${checkCells(r)}</div>` : '';
    const nf = r.facts.length;
    return `<aside class="fd-card" data-id="${esc(r.id)}">${mark(r)}<span class="fd-kick">${esc(AREA_L[r.area])} · ${esc(whoName(r))}</span>${r.focus ? '<span class="fd-foc">IN FOCUS · NEXT MATCH</span>' : ''}
      <h3 class="fd-ct"><span>${esc(r.title)}</span></h3><i class="fd-dv d1"></i>
      <span class="fd-lb l-c">Confidence</span>${tagHtml(r.tag, 'big')}
      <span class="fd-lb l-n">Sample</span><span class="fd-bn"><b>${isNum(r.n.value) ? num(r.n.value) : '–'}</b><small>${esc(sampleUnit(r) + sampleExtra(r))}</small></span>
      <span class="fd-evh" data-ev="1"><span class="gl c">A</span>Evidence</span><i class="fd-dv d2"></i>
      <h4 class="fd-kh">Key numbers</h4><div class="fd-nums">${nums}${why}</div><i class="fd-dv d3"></i>${next}
      <div class="dcell s fd-src"><span class="v">${esc(r.srcText)}</span><span class="k">${esc(r.src === 'ledger' ? `${r.rule} · ${nf} fact${nf === 1 ? '' : 's'}` : `${r.id} · ${nf} fact${nf === 1 ? '' : 's'}`)}</span>${r.rough ? '<i>rough</i>' : ''}</div></aside>`;
  }
  function emptyNote() {
    const parts = [F.area !== 'all' ? curLabel('area') : '', F.who !== 'all' ? curLabel('who') : '', F.tag !== 'all' ? curLabel('tag') : ''].filter(Boolean);
    return `<p class="empty-note fd-empty">No finding for ${esc(parts.join(' · ') || 'this filter')} in the ${esc(shortDate(M.day))} session</p>`;
  }
  function bodyHtml() {
    RS = sorted(ALL.filter(r => pass(r)));
    if (!RS.some(r => r.id === F.focus)) F.focus = RS.length ? RS[0].id : null;
    const cur = RS.find(r => r.id === F.focus) || null;
    return `<div class="fd-plate">${filtersHtml(false)}${headHtml()}<div class="fd-rows fc-scroll" tabindex="-1">${RS.length ? RS.map(rowHtml).join('') : emptyNote()}</div></div><div class="fd-right">${cardHtml(cur)}</div>`;
  }
  // F7 loading: plain dim placeholders, no who marks, no tags, no prompts
  function loadingHtml() {
    const bar = (c) => `<i class="sk ${c}"></i>`;
    const rows = Array.from({ length: 9 }, () => `<div class="fdr sk-row">${bar('m')}${bar('w1')}${bar('w2')}${bar('t1')}${bar('t2')}${bar('g1')}${bar('g2')}${bar('n')}${bar('k')}</div>`).join('');
    return `<div class="fd2 loading-v" data-grid="g1"><div class="fd-plate">${filtersHtml(true)}${headHtml(true)}<div class="fd-rows">${rows}</div></div><div class="fd-right"><aside class="fd-card sk-card">${['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12'].map(bar).join('')}</aside></div></div>`;
  }
  const loading = () => !!document.querySelector('#main .fd2.loading-v');

  // ---------- public (page-coaching.js) ----------
  window.findingsView = function (lc, S) {
    if (window.NAVSTATE && NAVSTATE.VIEW && NAVSTATE.VIEW.add) NAVSTATE.VIEW.add('f');   // the focus-item jump is view state
    const day = lc.day;
    if (!(window.FC26_FACTS || {})[day] && !F.loading[day]) {   // facts sheet not here yet (e.g. rewritten during a session): load it, show F7
      F.loading[day] = tryLoad(`data/${day}.facts.js?t=${Date.now()}`).then(() => { F.loading[day] = 'done';
        if (!document.querySelector('#main .fd2.loading-v')) return;
        Promise.resolve(render()).then(() => { const a = document.activeElement, mn = document.getElementById('main'); if (!(a && mn && mn.contains(a)) && window.NAVSTATE) NAVSTATE.entryFocus(); sync(); }); });
      return loadingHtml();
    }
    if (F.loading[day] && F.loading[day] !== 'done' && !(window.FC26_FACTS || {})[day]) return loadingHtml();
    model(lc);
    if (S && S.f && S.f !== F.lastF) {   // Leon answer 3: a focus item opens Findings with its row focused
      F.lastF = S.f; const hit = ALL.find(r => r.id === S.f);
      if (hit) { if (!pass(hit)) { F.area = 'all'; F.who = 'all'; F.tag = 'all'; } F.focus = hit.id; }
    }
    F.open = null;
    return `<div class="fd2" data-grid="g1">${bodyHtml()}</div>`;
  };
  window.findingsMeta = function (lc) {
    const c = lc.v, coach = Array.isArray(c.findings) && c.findings.length > 0;
    if (!(window.FC26_FACTS || {})[lc.day] && F.loading[lc.day] !== 'done') return `${shortDate(lc.day)} session`;
    const m = model(lc), nf = m.rows.filter(r => r.focus).length;
    return `${shortDate(lc.day)} session · ${m.rows.length} ${coach ? 'findings' : 'ledger rules'}${nf ? ` · ${nf} in focus` : ''}`;
  };
  // a section item (focus) -> its row in the list, or null (old files: the items have no findings row)
  window.findingLink = function (lc, id) {
    if (!id || !lc || !Array.isArray(lc.v.findings) || !lc.v.findings.length) return null;
    const f = lc.v.findings.find(x => x.id === id) || lc.v.findings.find(x => (x.refs || []).includes(id));
    return f ? sub({ tab: 'findings', f: f.id, rule: null, match: null }) : null;
  };

  // ---------- live behaviour ----------
  const root = () => document.querySelector('#main .fd2:not(.loading-v)');
  const rows = () => [...document.querySelectorAll('#main .fd2 .fdr[data-id]')];
  const sync = () => { if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); try { prompts(); } catch (e) { /* */ } };
  function keepVisible(el, boxSel) {
    const box = el && el.closest(boxSel || '.fd-rows'); if (!box) return;
    const t = el.offsetTop - box.offsetTop, b = t + el.offsetHeight;
    if (t < box.scrollTop) box.scrollTop = t; else if (b > box.scrollTop + box.clientHeight) box.scrollTop = b - box.clientHeight;
  }
  const fx = el => { if (!el) return true; el.focus({ preventScroll: true }); keepVisible(el); sync(); return true; };
  function markSel() {
    const w = root(); if (!w) return; const a = document.activeElement;
    w.classList.toggle('hsel', !!(a && a.closest && a.closest('#main .fd2') && !a.classList.contains('fdr')));
    w.querySelectorAll('.fdr[data-id]').forEach(r => r.classList.toggle('cur', r.dataset.id === F.focus));
  }
  function redraw(focusSel) {
    const w = root(); if (!w || !M) return;
    const box = w.querySelector('.fd-rows'), st = box ? box.scrollTop : 0;
    w.innerHTML = bodyHtml(); fitCard();
    const nb = w.querySelector('.fd-rows'); if (nb) nb.scrollTop = st;
    const el = focusSel && w.querySelector(focusSel);
    markSel();
    if (el) fx(el); else sync();
  }
  function redrawRight() { const w = root(); if (!w) return; w.querySelector('.fd-right').innerHTML = cardHtml(RS.find(r => r.id === F.focus) || null); fitCard(); }
  // labels longer than the 2 × 2 Data Cells (copy budget 40 characters): the key numbers become label | value lines; a check row
  // wider than the card drops its Range cell (the Evidence popup still lists every match)
  const over = el => [...el.querySelectorAll('.dcell > .k, .dcell > .v')].some(e => e.scrollWidth > e.clientWidth);
  function fitCard() {
    const c = document.querySelector('#main .fd2 .fd-card'); if (!c) return;
    if (window.enforceMinTextNow) window.enforceMinTextNow();   // measure with the text floor applied (15 px at 1920)
    const g = c.querySelector('.fd-nums'); if (g && !g.querySelector('.why') && over(g)) g.classList.add('rows');
    const k = c.querySelector('.fd-chk'); if (k && (k.scrollWidth > k.clientWidth || over(k))) k.classList.add('nr');
  }
  document.addEventListener('fc:rendered', () => { if (document.querySelector('#main .fd2 .fd-card')) fitCard(); });
  function onFocusRow(el) {
    if (!el || !el.classList.contains('fdr') || !el.dataset.id) return;
    if (F.focus !== el.dataset.id) { F.focus = el.dataset.id; redrawRight(); }
    keepVisible(el); markSel();
  }
  const rowSel = id => `.fdr[data-id="${CSS.escape(id || '')}"]`;
  const selSel = key => `.fd-fsel [data-fsel="${key}"]`;
  function sortBy(k) {
    if (!COLS[k]) return;
    F.sort = F.sort.k === k ? { k, dir: F.sort.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: COLS[k] };
    redraw(`.fdh[data-fsort="${k}"]`);
  }
  function openList(key, origin) {
    if (F.open !== key && F.open == null) F.origin = origin;
    F.open = key;
    redraw(`.fd-flist a[data-fopt="${CSS.escape(F[key])}"]`);
  }
  // after A / B in an option list: back to the row it came from (X) or to the selector (A on the selector). The row may be filtered
  // out: then the first row; an empty result keeps the focus on the selector (F6)
  function backTarget(key) {
    const o = F.origin; F.open = null; F.origin = null;
    RS = sorted(ALL.filter(r => pass(r)));
    if (o && o !== '@sel' && RS.length) return rowSel(RS.some(r => r.id === o) ? o : RS[0].id);
    return selSel(key);
  }
  function apply(key, v) { F[key] = v; redraw(backTarget(key)); }
  function closeList() { const k = F.open; redraw(backTarget(k)); }

  // ---------- Evidence popup (Evidence Popup 317:5145, Evidence Row 316:5236; host .pk-modal, scrim 60 %) ----------
  function moments(rule, mid) { return (((L().possessions || {})[mid]) || []).filter(p => rule && p.rule === rule).map(p => ({ mid, minute: p.minute })); }
  function evidenceOf(r) {
    const out = [], seen = new Set(); let pool = null;
    const add = (f, label) => { if (!f || seen.has(f.id)) return; seen.add(f.id); const rule = /^ledger:/.test(f.path || '') ? f.path.slice(7) : null;
      out.push({ id: f.id, match: label || f.match_name || matchName(f.match), fact: factLabel(f), value: factValue(f), trust: f.trust === 'firm' || f.trust === 'rough' ? f.trust : '', muted: f.trust === 'blocked', mom: f.trust === 'blocked' ? [] : moments(rule, f.match) }); };
    if (r.src === 'ledger') {
      const ms = matchList();
      ms.forEach(m => { const fnd = (((L().matches || {})[m.id] || {}).findings || []).find(x => x.rule === r.rule); if (!fnd) return;
        const f = factOf(m.id, 'ledger:' + r.rule), bl = f && f.trust === 'blocked';
        out.push({ id: (f && f.id) || m.id, match: (f && f.match_name) || m.title, fact: factLabel({ path: 'ledger:' + r.rule }), value: bl ? 'not measurable' : fmtRuleV(r.rule, fnd.value), trust: !bl && f && (f.trust === 'firm' || f.trust === 'rough') ? f.trust : '', muted: bl, mom: bl ? [] : moments(r.rule, m.id) }); });
      const s = (L().season || []).find(x => x.rule === r.rule);
      if (s && !r.blocked) pool = { text: `Pooled · ${r.n.value} matches`, value: fmtRuleV(r.rule, s.value), raw: s.value, trust: r.rough ? 'rough' : '' };
    } else {
      const refs = [...new Set(r.refs.concat((r.f.numbers || []).map(x => x.ref)))], inRefs = new Set(r.refs);
      refs.forEach(ref => {
        if (/^d[0-9a-f]{5,}$/.test(ref)) {
          const f = factById(ref); if (!f) return;
          if (f.match) add(f);
          else if (/^ledger:/.test(f.path || '') && (inRefs.has(ref) || (r.check && f.path === 'ledger:' + String(r.check.metric).replace(/^ledger:/, '')))) {
            dayFacts(M.day).filter(g => g.match && g.path === f.path).forEach(g => add(g));
            const want = r.check ? 'ledger:' + String(r.check.metric).replace(/^ledger:/, '') : null;   // the pooled line = the check's own fact, else the first
            if (!pool || (want && f.path === want && pool.path !== want) || (f.level === 'session' && pool.path === f.path && pool.level !== 'session')) pool = { level: f.level, text: `Pooled · ${dayFacts(M.day).filter(g => g.match && g.path === f.path).length} matches${isNum(f.n) ? ` · ${num(+f.n.toFixed(1))} ${f.n_unit || ''}` : ''}`, value: factValue(f), raw: f.value, trust: f.trust, path: f.path };
          } else add(f, f.level === 'season' ? 'Season' : `${shortDate(M.day)} session`);
        } else if (/^dg:/.test(ref)) {
          const mm = /^dg:([^:]+):(.+)$/.exec(ref); if (!mm || seen.has(ref)) return; seen.add(ref);
          const n = (r.f.numbers || []).find(x => x.ref === ref);
          out.push({ id: ref, match: matchName(mm[1]), fact: n ? n.label : factLabel({ path: mm[2] }), value: n ? fmtVal(n.value, n.unit) : '–', trust: '', mom: [] });
        }
      });
    }
    if (pool && r.check) { const v = Array.isArray(pool.raw) ? pool.raw[0] : pool.raw; const c = r.check, same = r.src === 'ledger' || !pool.path || pool.path === 'ledger:' + String(c.metric).replace(/^ledger:/, '');
      if (same) { pool.ok = onTarget(c, v); pool.check = `check ${c.op === 'between' && Array.isArray(c.value) ? rangeFmt(c.metric, c.value[0], c.value[1]) : opSym(c.op) + ' ' + metricFmt(c.metric, c.value)}`; } }
    return { rows: out, pool };
  }
  const momText = n => n ? `${n} moment${n === 1 ? '' : 's'}` : '–';
  function evHtml(r, E) {
    const ids = r.src === 'ledger' ? E.rows.map(x => x.id).filter(x => /^d[0-9a-f]+$/.test(x)) : r.facts.map(f => f.id);
    const rowsH = E.rows.map((x, i) => `<a class="fd-er${x.mom.length ? ' w' : ''}" href="#" data-i="${i}"><span class="m">${esc(x.match)}</span><span class="f">${esc(x.fact)}</span><b class="v${x.muted ? ' muted' : ''}">${esc(x.value)}</b><i class="tg">${esc(x.trust || '')}</i><span class="mo">${esc(momText(x.mom.length))}</span></a>`).join('');
    const P = E.pool;
    return `<div class="fd-ev" tabindex="-1"><header><h2>EVIDENCE</h2><span>${esc([whoName(r), AREA_L[r.area], TAG_L[r.tag], isNum(r.n.value) ? `${num(r.n.value)} ${sampleUnit(r)}` : ''].filter(Boolean).join(' · '))}</span></header>
      <p class="fd-evt">${esc(r.title)}</p>
      <div class="fd-evhd"><span class="m">Match</span><span class="f">Fact</span><span class="v">Value</span><span class="mo">Replay</span></div>
      <div class="fd-evr fc-scroll">${rowsH || '<p class="empty-note">No facts listed for this finding</p>'}</div>
      ${P ? `<div class="fd-pool"><span>${esc(P.text + (P.check && narrow() ? ' · ' + P.check : ''))}</span><b class="${P.ok == null ? '' : P.ok ? 'pos' : 'neg'}">${esc(P.value)}</b><i>${esc(P.trust === 'firm' ? 'firm' : P.trust === 'rough' ? 'rough' : '')}</i>${P.check && !narrow() ? `<span class="ck">${esc(P.check)}</span>` : ''}</div>` : '<div class="fd-pool"></div>'}
      <footer class="fd-evsrc"><span class="v">${esc(r.srcText)}</span><span class="k">${esc(ids.length ? `facts ${ids.slice(0, 6).join(' · ')}${ids.length > 6 ? ` +${ids.length - 6}` : ''}` : r.refs.filter(x => !/^x:/.test(x)).slice(0, 6).join(' · '))}</span></footer></div>`;
  }
  function openEv() {
    const r = RS.find(x => x.id === F.focus); if (!r || EV) return;
    const E = evidenceOf(r), origin = document.activeElement;
    const el = document.createElement('div'); el.className = 'pk-modal fd-evm'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Evidence');
    el.innerHTML = evHtml(r, E);
    el.addEventListener('click', e => { if (e.target === el) { closeEv(); return; } const a = e.target.closest('.fd-er'); if (a) { e.preventDefault(); a.focus(); watch(a); } });
    el.addEventListener('mouseover', e => { const a = e.target.closest('.fd-er'); if (a && document.activeElement !== a) a.focus({ preventScroll: true }); });
    document.body.appendChild(el); EV = { el, origin, E, r };
    const first = el.querySelector('.fd-er'); (first || el.querySelector('.fd-ev')).focus({ preventScroll: true });
    sync();
  }
  function closeEv() {
    if (!EV) return; const { el, origin } = EV; el.remove(); EV = null;
    const back = origin && origin.isConnected ? origin : rows().find(x => x.dataset.id === F.focus);
    if (back) fx(back); else sync();
  }
  function watch(a) {
    if (!EV || !a) return false; const x = EV.E.rows[+a.dataset.i]; if (!x || !x.mom.length) return false;
    const mo = x.mom[0], mid = mo.mid;
    ensureDay(String(mid).split('#')[0]).then(() => { const m = matchData(mid); if (m && typeof RP2 === 'object') RP2.open(m, 'm' + Math.max(0, mo.minute - 0.3).toFixed(1), a); });
    return true;
  }
  addEventListener('hashchange', () => { if (EV) { EV.el.remove(); EV = null; } F.open = null; });

  // ---------- mouse ----------
  document.addEventListener('focusin', e => { const t = e.target; if (!t.closest || !t.closest('#main .fd2')) return; if (t.classList.contains('fdr')) onFocusRow(t); else markSel(); });
  document.addEventListener('mouseover', e => { const r = e.target.closest && e.target.closest('#main .fd2 .fdr[data-id]'); if (r && document.activeElement !== r && !EV && !F.open) r.focus({ preventScroll: true }); });
  document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('#main .fd2')) return;
    const o = e.target.closest('.fd-flist a[data-fopt]'); if (o) { e.preventDefault(); apply(F.open, o.dataset.fopt); return; }
    const s = e.target.closest('[data-fsel]'); if (s) { e.preventDefault(); if (s.disabled) return; if (F.open === s.dataset.fsel) closeList(); else openList(s.dataset.fsel, F.open ? F.origin : '@sel'); return; }
    if (F.open) { e.preventDefault(); closeList(); return; }
    const h = e.target.closest('.fdh[data-fsort]'); if (h) { e.preventDefault(); sortBy(h.dataset.fsort); return; }
    const r = e.target.closest('.fdr[data-id]'); if (r) { e.preventDefault(); r.focus(); onFocusRow(r); return; }
    if (e.target.closest('[data-ev]')) { e.preventDefault(); openEv(); }
  });
  document.addEventListener('dblclick', e => { const r = e.target.closest && e.target.closest('#main .fd2 .fdr[data-id]'); if (r) { e.preventDefault(); onFocusRow(r); openEv(); } });

  // ---------- pad map (brief §4) ----------
  const selBtns = () => [...document.querySelectorAll('#main .fd2 .fd-fsel .fsel')];
  const headStops = () => [...document.querySelectorAll('#main .fd2 .fd-head .fdh[data-fsort]')];
  const optEls = () => [...document.querySelectorAll('#main .fd2 .fd-flist a[data-fopt]')];
  const near = (list, a) => { const cx = a.getBoundingClientRect().left + a.offsetWidth / 2; return list.slice().sort((p, q) => Math.abs(p.getBoundingClientRect().left + p.offsetWidth / 2 - cx) - Math.abs(q.getBoundingClientRect().left + q.offsetWidth / 2 - cx))[0]; };
  const KEYS = ['area', 'who', 'tag'];
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.findings = {
    z: 2,
    active: () => typeof S === 'object' && S.page === 'findings' && !!document.querySelector('#main .fd2') && !EV,
    prompts() {
      if (loading()) return [];
      if (F.open) return [['A', 'Apply'], ['B', 'Close']];
      const a = document.activeElement;
      if (a && a.closest && a.closest('#main .fd-head')) return [['A', 'Sort'], ['B', 'Back to rows'], ['LTRT', 'Tab'], ['Y', 'Search']];
      if (a && a.dataset && a.dataset.fsel) return RS.length ? [['A', 'Choose'], ['B', 'Back to rows'], ['LTRT', 'Tab'], ['Y', 'Search']] : [['A', 'Choose'], ['LTRT', 'Tab'], ['Y', 'Search']];
      return [['A', 'Evidence'], ['LTRT', 'Tab'], ['X', 'Filter'], ['Y', 'Search']];
    },
    press(k) {
      if (loading()) return /^(A|B|X|R|UP|DOWN|LEFT|RIGHT)$/.test(k);
      const a = document.activeElement, rs = rows(), i = rs.indexOf(a);
      const inHead = !!(a && a.closest && a.closest('#main .fd-head')), sel = a && a.dataset && a.dataset.fsel ? a.dataset.fsel : null;
      const toRow = () => fx(rs.find(x => x.dataset.id === F.focus) || rs[0] || null);
      if (F.open) {   // the option list (Filter Option): ↑↓ choose, ←→ the neighbouring list, A apply, B / X close
        const os = optEls(), j = os.indexOf(a);
        if (k === 'UP' || k === 'DOWN') return fx(os[Math.max(0, Math.min(os.length - 1, (j < 0 ? 0 : j) + (k === 'DOWN' ? 1 : -1)))]);
        if (k === 'LEFT' || k === 'RIGHT') { const n = KEYS[KEYS.indexOf(F.open) + (k === 'RIGHT' ? 1 : -1)]; if (n) openList(n); return true; }
        if (k === 'A') { const o = os[j] || os[0]; if (o) apply(F.open, o.dataset.fopt); return true; }
        if (k === 'B' || k === 'X') { closeList(); return true; }
        return true;
      }
      if (k === 'LT' || k === 'RT') return false;   // Coaching sub-tabs (global map)
      if (k === 'X') { openList('area', i >= 0 ? a.dataset.id : '@sel'); return true; }   // X = Filter, one press from any row
      if (k === 'Y') return false;                  // Search (global)
      if (k === 'B') { if ((inHead || sel) && rs.length) return toRow(); return true; }   // rows: B does nothing (top screen)
      if (k === 'A') {
        if (i >= 0) { onFocusRow(a); openEv(); return true; }
        if (inHead && a.dataset.fsort) { sortBy(a.dataset.fsort); return true; }
        if (sel) { openList(sel, '@sel'); return true; }
        return true;
      }
      if (k === 'UP') {
        if (sel) return true;
        if (inHead) return fx(near(selBtns(), a));
        if (i <= 0) return fx(document.querySelector('#main .fd2 .fdh.sorted') || headStops()[0]);
        return fx(rs[i - 1]);
      }
      if (k === 'DOWN') {
        if (sel) return fx(near(headStops(), a));
        if (inHead) return rs.length ? toRow() : true;
        if (i >= 0 && i < rs.length - 1) return fx(rs[i + 1]);
        return true;
      }
      if (k === 'LEFT' || k === 'RIGHT') {
        const d = k === 'RIGHT' ? 1 : -1;
        if (sel) { const b = selBtns(), n = b[b.indexOf(a) + d]; return n ? fx(n) : true; }
        if (inHead) { const st = headStops(), n = st[st.indexOf(a) + d]; return n ? fx(n) : true; }
        return true;   // the detail card carries no stops (Sign Bio Card rule)
      }
      return false;
    },
    scrollTarget: () => document.querySelector('#main .fd2 .fd-rows'),
  };
  window.PAD_HOOKS.findingsEv = {
    z: 6,
    active: () => !!EV,
    prompts() { const a = document.activeElement, x = EV && a && a.classList && a.classList.contains('fd-er') ? EV.E.rows[+a.dataset.i] : null; return x && x.mom.length ? [['A', 'Watch'], ['B', 'Close']] : [['B', 'Close']]; },
    press(k) {
      if (!EV) return false;
      const rs = [...EV.el.querySelectorAll('.fd-er')], a = document.activeElement, i = rs.indexOf(a);
      if (k === 'B') { closeEv(); return true; }
      if (k === 'UP' || k === 'DOWN') { const n = rs[Math.max(0, Math.min(rs.length - 1, (i < 0 ? 0 : i) + (k === 'DOWN' ? 1 : -1)))]; if (n) { n.focus({ preventScroll: true }); keepVisible(n, '.fd-evr'); sync(); } return true; }
      if (k === 'A') { if (i >= 0) watch(a); return true; }
      return true;
    },
    scrollTarget: () => EV && EV.el.querySelector('.fd-evr'),
  };
  window.FINDINGS = { get state() { return F; }, get rows() { return RS; }, get all() { return ALL; }, get ev() { return EV; }, openEv, closeEv, openList, closeList,
    reset() { F.sort = { k: 'tag', dir: 'desc' }; F.area = F.who = F.tag = 'all'; F.focus = null; F.open = null; F.lastF = null; if (EV) closeEv(); M = null; } };
})();
