/* FC26 Coach - Career Hub core: helpers, data loading, router, shared UI widgets.
   Plain scripts sharing globals (works from file:// - no modules, no fetch). */
'use strict';

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isNum = v => typeof v === 'number' && isFinite(v);
const fmt = (v, d = 0) => isNum(v) ? v.toFixed(d) : '–';
const pct = (v, d = 0) => isNum(v) ? (v * 100).toFixed(d) + '%' : '–';
const sum = (a, f = x => x) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const avg = (a, f = x => x) => { const v = a.map(f).filter(isNum); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const wavg = (a, f, w) => { let s = 0, n = 0; a.forEach(x => { const v = f(x), ww = w(x); if (isNum(v) && isNum(ww) && ww > 0) { s += v * ww; n += ww; } }); return n ? s / n : null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const minLabel = m => isNum(m) ? Math.floor(m) + "'" : '–';
const uniq = a => Array.from(new Set(a));
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const json = o => esc(JSON.stringify(o));
const initials = n => String(n || '?').split(/[\s.-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- error banner ----------
function showError(msg) {
  const e = $('#err'); if (!e) return;
  e.hidden = false;
  const box = $('#errtxt');
  box.textContent += (box.textContent ? '\n' : '') + msg;
  window.__errors = (window.__errors || []).concat(msg);
}
window.addEventListener('error', e => showError('JS error: ' + e.message + (e.filename ? ` (${String(e.filename).split('/').pop()}:${e.lineno})` : '')));
window.addEventListener('unhandledrejection', e => showError('JS error: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));

// ---------- script loading ----------
const _loaded = {};
function resolveAsset(p) {
  if (!p) return p;
  return (window.FC26_FACE_URLS && window.FC26_FACE_URLS[p]) || (window.FC26_WEB && window.FC26_WEB.faceUrl && window.FC26_WEB.faceUrl(p)) || p;
}
function loadScript(src) {
  const bust = /[?&]t=/.test(src);
  if (!bust && _loaded[src]) return _loaded[src];
  const p = (window.FC26_ENCRYPTED && window.FC26_WEB && typeof window.FC26_WEB.loadScript === 'function')
    ? (bust ? window.FC26_WEB.loadScript(src, { bust: true }) : window.FC26_WEB.loadScript(src))
    : new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = () => res(true);
        s.onerror = () => { s.remove(); rej(new Error('Could not load ' + src)); };
        document.head.appendChild(s);
      });
  return bust ? p : (_loaded[src] = p);
}
const tryLoad = src => loadScript(src).catch(() => false);

// ---------- data access ----------
const G = () => window;
function dayList() { return uniq((window.FC26_INDEX || []).map(d => d.day).filter(d => d && !/\./.test(d))).sort(); }
function car() { return window.FC26_CAREER || null; }
function ledger() { return window.FC26_LEDGER || null; }
function dayData(d) { return (window.FC26_DAYS || {})[d]; }
function coachFor(d) { return (window.FC26_COACH || {})[d]; }
function directorFor(d) { return (window.FC26_DIRECTOR || {})[d]; }
async function ensureDay(d) {
  if (!d || dayData(d)) return dayData(d);
  try { await loadScript(`data/${d}.js`); } catch (e) { showError(e.message); }
  return dayData(d);
}
let _allDays = null;
function ensureAllDays() { return _allDays || (_allDays = Promise.all(dayList().map(ensureDay))); }
function allDaysLoaded() { return dayList().every(d => dayData(d)); }
function latestWith(getter) { const ds = dayList(); for (let i = ds.length - 1; i >= 0; i--) { const v = getter(ds[i]); if (v) return { day: ds[i], v }; } return null; }

function people() {
  for (const d of dayList().slice().reverse()) { const dd = dayData(d); if (dd && dd.people) return dd.people; }
  return { me: 'Leon', friend: 'Peti' };
}
const P1 = () => people().me || 'Leon';
const P2 = () => people().friend || 'Peti';
const clubName = () => (car() && car().club) || 'Como';

// season label 2025/26 from the first match date (season starts in July)
function seasonLabel() {
  const ms = matchList();
  const d = ms.length ? parseDate(ms[0].date) : null;
  if (d) { const y = d.getFullYear(), s = d.getMonth() >= 6 ? y : y - 1; return `${s}/${String((s + 1) % 100).padStart(2, '0')}`; }
  return (car() && car().season) || '';
}
function parseDate(s) { const t = Date.parse(s || ''); return isNaN(t) ? null : new Date(t); }
function shortDate(s) { const d = parseDate(s); return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : (s || ''); }

// matches (career-level list, chronological, shadow-deduped)
let _mlist = null, _mlistAll = null, _mlistSig = '';
function teamsFromTitle(m) {
  const t = String((m && m.title) || '').trim();
  const mm = t.match(/^\s*([A-Za-z?]{2,5})\s+(\d+)\s*[-–:]\s*(\d+)\s+([A-Za-z?]{2,5})\s*$/);
  let home = '', away = '';
  if (mm) { home = mm[1].toUpperCase(); away = mm[4].toUpperCase(); }
  else {
    const mv = t.match(/^\s*([A-Za-z?]{2,5})\s+(?:v|vs\.?|[-–])\s+([A-Za-z?]{2,5})\s*$/i);
    if (mv) { home = mv[1].toUpperCase(); away = mv[2].toUpperCase(); }
    else if (Array.isArray(m && m.teams) && m.teams.length >= 2) {
      home = String(m.teams[0] || '?').toUpperCase();
      away = String(m.teams[1] || '?').toUpperCase();
    }
  }
  if (!home && !away) {
    const oc = m && m.opp_code ? String(m.opp_code).toUpperCase() : '?';
    home = m && m.our_side === 'away' ? oc : 'COM';
    away = m && m.our_side === 'away' ? 'COM' : oc;
  }
  const oursRaw = m && m.our_side === 'away' ? away : home;
  const oppRaw = m && m.our_side === 'away' ? home : away;
  const ours = (!oursRaw || oursRaw === '?') ? 'COM' : oursRaw;
  const opp = (!oppRaw || oppRaw === 'NULL') ? '?' : oppRaw;
  return { home: home || '?', away: away || '?', ours, opp };
}
function _matchRank(m) {
  const s = m.score_us_them || [];
  const scored = isNum(s[0]) && isNum(s[1]) ? 1 : 0;
  const goals = scored ? (s[0] + s[1]) : -1;
  const knownOpp = m.opp && m.opp !== '?' ? 1 : 0;
  const ftN = Object.keys(m.official_ft || {}).length;
  const tr = m.has_tracks ? 1 : 0;
  return scored * 100000 + knownOpp * 10000 + Math.max(0, goals) * 500 + tr * 100 + ftN * 2 + (m._k || 0);
}
function _sameFixture(a, b) {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  const da = String(a.date || '').trim(), db = String(b.date || '').trim();
  if (!da || !db || da !== db) return false;
  if (a.opp === b.opp) return true;
  if (a.opp === '?' || b.opp === '?') return true;
  return false;
}
function matchList() {
  const c = car();
  const rawArr = c && Array.isArray(c.matches) ? c.matches : [];
  const sig = `${rawArr.length}|${rawArr.map(x => `${x.id}:${x.title}:${(x.score_us_them || []).join('-')}`).join(',')}|${(window.FC26_INDEX || []).length}`;
  if (_mlist && _mlistSig === sig) return _mlist;
  let ms = rawArr.slice();
  if (!ms.length) (window.FC26_INDEX || []).forEach(d => (d.matches || []).forEach((t, i) => ms.push({ day: d.day, id: d.day + '#' + i, title: t })));
  ms = ms.map((m, k) => {
    const tf = teamsFromTitle(m);
    const s = m.score_us_them || [];
    const hasScore = isNum(s[0]) && isNum(s[1]);
    const hScore = m.our_side === 'away' ? s[1] : s[0];
    const aScore = m.our_side === 'away' ? s[0] : s[1];
    const cleanTitle = hasScore && tf.home !== '?' && tf.away !== '?'
      ? `${tf.home} ${hScore}–${aScore} ${tf.away}`
      : (tf.opp !== '?' ? `${tf.home === '?' ? 'COM' : tf.home} vs ${tf.away === '?' ? tf.opp : tf.away}` : 'COM vs TBC');
    return { ...m, _k: k, ...tf, displayTitle: cleanTitle };
  });
  ms.sort((a, b) => ((parseDate(a.date) || 0) - (parseDate(b.date) || 0)) || String(a.day || '').localeCompare(String(b.day || '')) || a._k - b._k);
  _mlistAll = ms;
  const dedup = [];
  for (const m of ms) {
    const idx = dedup.findIndex(x => _sameFixture(x, m));
    if (idx < 0) dedup.push(m);
    else if (_matchRank(m) >= _matchRank(dedup[idx])) dedup[idx] = m;
  }
  _mlistSig = sig;
  return (_mlist = dedup);
}
const TEAM_NAMES = { COM: 'Como', LEC: 'Lecce', CAG: 'Cagliari', ATA: 'Atalanta', BOL: 'Bologna', CRE: 'Cremonese', FIO: 'Fiorentina', GEN: 'Genoa', VER: 'Hellas Verona', HVE: 'Hellas Verona',
  INT: 'Inter', JUV: 'Juventus', LAZ: 'Lazio', MIL: 'AC Milan', NAP: 'Napoli', PAR: 'Parma', PIS: 'Pisa', ROM: 'AS Roma', ROMA: 'AS Roma', SAS: 'Sassuolo', TOR: 'Torino', UDI: 'Udinese', TBC: 'Opponent TBC', '?': 'Opponent TBC' };
// Club names follow the game (FC 26 uses e.g. "Lombardia FC" for Inter); fallback: our short list.
const crestOf = c => (window.FC26_CRESTS || {})[String(c || '').toUpperCase() === 'HVE' ? 'VER' : String(c || '').toUpperCase() === 'ROMA' ? 'ROM' : String(c || '').toUpperCase()];
const teamName = c => {
  const u = String(c || '').trim().toUpperCase();
  if (!u || u === '?' || u === 'NULL' || u === 'TBC') return 'Opponent TBC';
  const k = crestOf(u);
  return k ? k.short : (TEAM_NAMES[u] || c);
};
// Crest image (FC 26 art, cached in assets/crests) with the old lettered badge as the fallback when the file is missing.
const badge = (code, ours, cls = '') => { const raw = (!code || code === '?' || code === 'null') ? 'TBC' : String(code); const k = crestOf(raw), txt = esc(raw.slice(0, 3).toUpperCase());
  return k ? `<span class="badge crest ${cls}" data-code="${txt}" title="${esc(k.name)}"><img src="${k.src}" alt="${esc(k.short)}" onerror="var b=this.parentNode;b.classList.remove('crest');${ours ? "b.classList.add('ours');" : ''}b.textContent=b.dataset.code"></span>`
    : `<span class="badge ${ours ? 'ours' : ''} ${cls}">${txt}</span>`; };
function matchRef(id) { const ml = matchList(); return ml.find(m => m.id === id) || (_mlistAll || []).find(m => m.id === id); }
function matchData(id) { const r = matchRef(id); const dd = r && dayData(r.day); return dd ? dd.matches.find(m => m.id === id) : null; }
function resultOf(m) { const s = m.score_us_them; if (!s || !isNum(s[0])) return m.result || null; return m.result || (s[0] > s[1] ? 'W' : s[0] < s[1] ? 'L' : 'D'); }
function ft(m, k) { const o = m.official_ft || {}; return o[k] || null; }
function xgOf(m) { const o = ft(m, 'Expected Goals'); if (o && isNum(o[0])) return o; return m.xg_model || null; }

// players (career + squad merged)
let _plist = null;
const VALID_POS = new Set(['GK', 'RB', 'LB', 'CB', 'LCB', 'RCB', 'SW', 'RWB', 'LWB', 'CDM', 'LDM', 'RDM', 'LCDM', 'RCDM', 'CM', 'LCM', 'RCM', 'CAM', 'LAM', 'RAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST', 'LS', 'RS', 'LF', 'RF']);
const cleanPos = p => { const x = String(p || '').toUpperCase().replace(/\d+$/, '').trim(); return VALID_POS.has(x) ? x : ''; };
function normPos(p) {
  const x = cleanPos(p);
  if (/^[LRC]?CB$/.test(x)) return 'CB';
  if (/^(?:C|L|R|LC|RC)?DM$/.test(x)) return 'CDM';
  if (/^[LRC]?CM$/.test(x)) return 'CM';
  if (/^(?:C|L|R|LC|RC)?AM$/.test(x)) return 'CAM';
  if (/^(?:ST|CF|LS|RS)$/.test(x)) return 'ST';
  return x;
}
const GROUP = p => {
  const x = String(p || '').toUpperCase();
  if (x === 'GK') return 'GK';
  if (/^(CB|LCB|RCB|LB|RB|LWB|RWB|SW)$/.test(x)) return 'DEF';
  if (/^(CDM|LDM|RDM|LCDM|RCDM|CM|LCM|RCM|CM2|CAM|LAM|RAM|LM|RM)$/.test(x)) return 'MID';
  if (/^(LW|RW|LF|RF|CF|ST|LS|RS)$/.test(x)) return 'ATT';
  return 'UNK';
};
const GROUP_ORDER = { GK: 0, DEF: 1, MID: 2, ATT: 3, UNK: 4 };
const FOLD_ALIAS = { cavlina: 'eavlina', eavlina: 'cavlina', sergiroberto: 'roberto', roberto: 'sergiroberto' };
function playerList() {
  if (_plist) return _plist;
  const c = car() || {}, P = c.players || {}, SQ = c.squad || {};
  const names = uniq([...Object.keys(P), ...Object.keys(SQ)]);
  _plist = names.map(name => {
    const st = P[name] || {};
    const at = st.attributes || SQ[name] || {};
    const nat = (at.positions || []).map(cleanPos).filter(Boolean);
    const played = (st.positions || []).map(cleanPos).filter(Boolean);
    const pos = nat[0] || played[0] || '';
    return {
      name, id: st.id || at.id || fold(name), st, at, face: st.face ? resolveAsset('data/' + st.face) : null,
      pos, group: GROUP(pos), nat, played,
      ovr: isNum(at.ovr) ? at.ovr : null, age: isNum(at.age) ? at.age : null,
      apps: st.apps || 0, minutes: st.minutes || 0, goals: st.goals || 0, assists: st.assists || 0, potm: st.potm || 0,
      avg: isNum(st.avg_rating) ? st.avg_rating : null, form: st.form || [], ours: isNum(st.ours_avg) ? st.ours_avg : null,
    };
  });
  return _plist;
}
function playerById(id) {
  const f = fold(id), alt = FOLD_ALIAS[f];
  return playerList().find(p => p.id === id || fold(p.id) === f || (alt && fold(p.id) === alt))
    || playerList().find(p => fold(p.name) === f || (alt && fold(p.name) === alt));
}
function playerByName(n) {
  const f = fold(n), alt = FOLD_ALIAS[f];
  return playerList().find(p => fold(p.name) === f || (alt && fold(p.name) === alt))
    || playerList().find(p => f && (fold(p.name).includes(f) || f.includes(fold(p.name))));
}
const ATTRS = [['pace', 'PAC'], ['shooting', 'SHO'], ['passing', 'PAS'], ['dribbling', 'DRI'], ['defending', 'DEF'], ['physical', 'PHY']];

// ---------- colour scales ----------
function rtCls(r) { if (!isNum(r)) return 'na'; return r >= 8 ? 'r9' : r >= 7.5 ? 'r8' : r >= 7 ? 'r7' : r >= 6.5 ? 'r6' : r >= 6 ? 'r5' : 'r4'; }
function atCls(v) { if (!isNum(v)) return ''; return v >= 90 ? 'a5' : v >= 80 ? 'a4' : v >= 70 ? 'a3' : v >= 60 ? 'a2' : v >= 50 ? 'a1' : 'a0'; }
function rtColor(r) { return { r4: '#ff5468', r5: '#ff9a3d', r6: '#ffd23d', r7: '#b8e34a', r8: '#3ee08f', r9: '#2fd0ff', na: '#7d8db3' }[rtCls(r)]; }
const rtPill = (r, d = 1) => `<span class="rt ${rtCls(r)}">${isNum(r) ? r.toFixed(d) : '–'}</span>`;

// ---------- icons (hand-drawn simple SVG) ----------
const ICON = {
  hub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  squad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-1 2-2.5 3-4 3S9 5 8 3z"/></svg>',
  matches: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  findings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M7 10h6M10 7v6"/></svg>',
  tactics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="16" r="1.6"/><path d="M9 9l6 6M15 7h3v3"/></svg>',
  coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  duo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M12 20c0-3 2-5 4-5 3 0 6 2 6 5"/></svg>',
  scouting: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/><path d="M11 15h2M5 11l2-6h2M19 11l-2-6h-2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 4l-8 8 8 8"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 4l8 8-8 8"/></svg>',
  car: '<svg class="car" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 4l8 8-8 8"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 4l-8 8 8 8"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  film: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>',
};
// FC-style form arrow: rotation from up (0) to down (180)
function formArrow(form, avgv) {
  const f = (form || []).filter(isNum);
  if (!f.length) return '';
  const base = isNum(avgv) ? avgv : avg(f), last = f[f.length - 1], prev = f.length > 1 ? avg(f.slice(0, -1)) : base;
  const d = f.length > 1 ? last - prev : (last - 6.8);
  const [rot, col, lab] = d >= 0.6 ? [0, '#3ee08f', 'Excellent'] : d >= 0.2 ? [45, '#b8e34a', 'Good'] : d > -0.2 ? [90, '#ffd23d', 'Steady'] : d > -0.6 ? [135, '#ff9a3d', 'Dipping'] : [180, '#ff5468', 'Poor'];
  return `<svg class="arrow" viewBox="0 0 24 24" data-tip="Form: <b>${lab}</b> (last ${fmt(last, 1)} vs ${fmt(prev, 1)})"><g transform="rotate(${rot} 12 12)"><path d="M12 3l7 8h-4.5v10h-5V11H5z" fill="${col}"/></g></svg>`;
}

// ---------- shared UI snippets ----------
function avatar(p, cls = '') {
  const n = p ? p.name : '?';
  if (p && p.face) return `<span class="av face ${cls}"><img src="${esc(resolveAsset(p.face))}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('face');this.parentNode.textContent='${esc(initials(n))}'"></span>`;
  return `<span class="av ${cls}">${esc(initials(n))}</span>`;
}
const posBadge = pos => pos ? `<span class="pos ${GROUP(pos)}">${esc(String(pos).replace(/2$/, ''))}</span>` : '<span class="pos UNK">–</span>';
const resChip = (r, lg) => r ? `<span class="res ${r} ${lg ? 'lg' : ''}"><span>${r}</span></span>` : '';
var ring = (r, cls = "") => `<span class="rring ${rtCls(r)} ${cls}">${isNum(r) ? r.toFixed(1) : "–"}</span>`;
const info = t => `<button class="info" type="button" data-tip="${esc(t)}" aria-label="info">i</button>`;
const plink = p => p ? `#page=player&id=${encodeURIComponent(p.id)}` : '#page=squad';
function whoKey(who) {
  const w = String(who || '').toLowerCase();
  if (w === 'duo') return 'duo';
  if (w === 'team' || !w) return 'team';
  if (w === 'me' || w === 'p1' || w.includes(P1().toLowerCase()) || w.includes('blue')) return 'p1';
  if (w === 'friend' || w === 'p2' || w.includes(P2().toLowerCase()) || w.includes('red')) return 'p2';
  return 'other';
}
function whoChip(who) {
  const k = whoKey(who);
  const lab = { p1: P1(), p2: P2(), duo: P1() + ' + ' + P2(), team: 'Team' }[k] || who;
  const dots = { p1: '<i class="dot p1"></i>', p2: '<i class="dot p2"></i>', duo: '<i class="dot p1"></i><i class="dot p2"></i>', team: '<i class="dot us"></i>' }[k] || '';
  return `<span class="chip ${k}"><span class="row" style="gap:5px">${dots}${esc(lab)}</span></span>`;
}
function prioChip(p) { const n = p || 3; return `<span class="prio p${n}">${['', 'Fix now', 'Next', 'Later'][n] || 'Note'}</span>`; }
const TREND = {
  new: ['New', 'warn'], recurring: ['Recurring', 'bad'], improving: ['Improving', 'good'], worsening: ['Worsening', 'bad'],
  resolved: ['Resolved', 'good'], regressed: ['Regressed', 'bad'], stable: ['Stable', ''], watch: ['Watch', 'warn'], baseline: ['Baseline', ''],
};
function trendChip(t) {
  if (!t) return '';
  const [l, c] = TREND[t] || [t, ''];
  const col = { good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)' }[c] || 'var(--muted)';
  return `<span class="chip" style="border-color:${col};color:${col}"><span>${esc(l)}</span></span>`;
}
function sevDots(s) { let h = ''; for (let i = 1; i <= 3; i++) h += `<i style="display:inline-block;width:7px;height:12px;margin-right:2px;transform:skewX(-14deg);background:${i <= s ? (s >= 3 ? 'var(--bad)' : s === 2 ? 'var(--warn)' : 'var(--acc2)') : 'rgba(255,255,255,.1)'}"></i>`; return `<span class="nowrap" data-tip="Severity ${s}/3">${h}</span>`; }

// expandable item (one line, click to open)
function xItem(head, body, open) {
  return `<div class="xi ${open ? 'open' : ''}"><div class="xh">${head}${body ? ICON.car : ''}</div>${body ? `<div class="xb">${body}</div>` : ''}</div>`;
}
// evidence text: highlight [tags]
const evHtml = t => esc(t).replace(/\[([a-z]+)\]/gi, '<span class="tag2" style="font:700 10px var(--fh);letter-spacing:.08em;color:var(--acc2)">$1</span>');

function tile(title, body, o = {}) {
  return `<section class="tile ${o.cls || ''}" ${o.attrs || ''}>${title ? `<h2 class="h">${title}${o.right ? `<span class="spacer"></span>${o.right}` : ''}</h2>` : ''}${body}</section>`;
}
function statBox(v, label, o = {}) {
  const cnt = isNum(v) ? `data-count="${v}" data-dec="${o.d || 0}"` : '';
  return `<div class="stat ${o.cls || ''}" ${o.tip ? `data-tip="${esc(o.tip)}"` : ''}><div class="v"><span ${cnt}>${isNum(v) ? v.toFixed(o.d || 0) : esc(v ?? '–')}</span>${o.suf ? `<small>${o.suf}</small>` : ''}</div><div class="l">${label}</div></div>`;
}
// meter with optional target band [lo, hi] in value units, max scale
function meter(label, v, o = {}) {
  const max = o.max || 1, w = isNum(v) ? clamp(v / max * 100, 0, 100) : 0;
  let cls = '';
  if (o.target && isNum(v)) {
    const t = o.target;
    const okLo = t.lo == null || v >= t.lo, okHi = t.hi == null || v <= t.hi;
    const badLo = t.badLo != null && v < t.badLo, badHi = t.badHi != null && v > t.badHi;
    cls = okLo && okHi ? 'isok' : (badLo || badHi) ? 'isbad' : 'iswarn';
  }
  let band = '';
  if (o.target) {
    const lo = o.target.lo != null ? o.target.lo : 0, hi = o.target.hi != null ? o.target.hi : max;
    band = `<span class="band" style="left:${clamp(lo / max * 100, 0, 100)}%;width:${clamp((hi - lo) / max * 100, 0, 100)}%" data-tip="Target ${o.fmtv ? o.fmtv(lo) : lo}–${o.fmtv ? o.fmtv(hi) : hi}"></span>`;
  }
  const val = o.fmtv ? o.fmtv(v) : pct(v);
  return `<div class="meter ${cls}"><span class="ml">${label}${o.tip ? info(o.tip) : ''}</span><span class="mv">${val}</span>
    <div class="track">${band}<i class="fill" style="width:${w}%"></i></div>${o.hint ? `<span class="hint">${o.hint}</span>` : ''}</div>`;
}
// FC-style centred comparison row
function vsRow(label, a, b, o = {}) {
  const d = o.d || 0, A = isNum(a) ? a : null, B = isNum(b) ? b : null, mx = Math.max(A || 0, B || 0, o.max || 0) || 1;
  const wa = A != null ? A / (o.pct ? 100 : mx) * 100 : 0, wb = B != null ? B / (o.pct ? 100 : mx) * 100 : 0;
  const win = A != null && B != null && (o.lowBetter ? A < B : A > B);
  return `<div class="vsrow ${win ? 'win' : ''}" ${o.tip ? `data-tip="${esc(o.tip)}"` : ''}><span class="a">${A != null ? A.toFixed(d) : '–'}</span>
    <div class="mid2"><div class="t">${label}${o.flag ? ' <span class="flag" data-tip="Looks like an OCR misread of the stat screen">?</span>' : ''}${o.sub ? `<span class="rad">${o.sub}</span>` : ''}</div>
    <div class="vsbar"><span><i class="fill" style="width:${clamp(wa, 0, 100)}%;transform-origin:right center"></i></span><span><i class="fill" style="width:${clamp(wb, 0, 100)}%"></i></span></div></div>
    <span class="b">${B != null ? B.toFixed(d) : '–'}</span></div>`;
}

// ---------- coach-KB targets (used where the data contract has no explicit target) ----------
const TARGETS = {
  possession: { lo: 58, hi: 65 }, width_in: { lo: 54, hi: 64, badLo: 48 }, width_gain: { lo: 10 },
  rest_defence: { lo: 5, hi: 7 }, ball_recovery: { hi: 7 }, att_third_regain: { lo: .25, badLo: .15 },
  tackles_won: { lo: .35, badLo: .25 }, def_close: { hi: .15, badHi: .25 },
  att_close: { hi: .15, badHi: .25 }, double_press: { hi: .05, badHi: .12 }, nobody_close: { hi: .15, badHi: .25 },
  sprint_def: { hi: .35 }, sprint_nojockey: { hi: .25 }, lt_def: { lo: .15 }, dist_apart: { lo: 15, hi: 30 },
};

// ---------- router ----------
const PAGES = [
  ['hub', 'Hub'], ['squad', 'Squad'], ['matches', 'Matches'], ['findings', 'Findings'],
  ['tactics', 'Tactics'], ['coach', 'Staff'], ['duo', 'Us'], ['scouting', 'Academy'],
];
const PARENT = { player: 'squad', match: 'matches' };
const REG = {};
let S = { page: 'hub' };
let _prevKey = '', _prevNav = 0, _renderTok = 0, _leave = null;

function parseHash() {
  const p = new URLSearchParams(location.hash.slice(1)), o = {};
  p.forEach((v, k) => { o[k] = v; });
  if (!o.page || !REG[o.page]) o.page = 'hub';
  return o;
}
function href(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '' && v !== false) p.set(k, v); });
  return '#' + p.toString();
}
function nav(params) { const h = href(params); if (h === location.hash) render(); else location.hash = h; }
function patch(p) { nav({ ...S, ...p }); }
// silent hash update (no render, no history entry) - for replay time etc.
function setHashQuiet(p) {
  Object.assign(S, p);
  const h = href(S);
  try { history.replaceState(null, '', location.href.split('#')[0] + h); } catch (e) { /* ignore */ }
}
const sub = (p) => href({ ...S, ...p });

function navIndex(page) { const pg = PARENT[page] || page; return PAGES.findIndex(x => x[0] === pg); }

async function render() {
  const tok = ++_renderTok;
  S = parseHash();
  const pg = REG[S.page];
  if (_leave) { try { _leave(); } catch (e) { showError(e.message); } _leave = null; }
  const ni = navIndex(S.page);
  $$('#tabs a[data-p]').forEach(a => a.classList.toggle('on', +a.dataset.i === ni));
  const main = $('#main');
  // grid brief: a sub-tab (tab / preset / grp / ptab …) is VIEW state, so only a ROUTE change plays the page slide
  const key = window.NAVSTATE ? NAVSTATE.routeOf(location.hash) : S.page + '|' + (S.id || '') + '|' + (S.tab || '') + '|' + (S.day || '');
  const changed = key !== _prevKey && !window.__viewRender;
  try {
    if (pg.need) {
      const need = pg.need(S);
      if (need && typeof need.then === 'function') {
        if (!pg.ready || !pg.ready(S)) {
          // round 7 (tactics-edit T5): a page may draw its own loading state (skeleton, no prompts of the previous page)
          main.innerHTML = pg.loading ? `<div class="page gx" data-g="g3"><span class="loading" style="display:none"></span>${pg.loading(S)}</div>` : '<div class="loading"><div>Loading data<i></i></div></div>';
          main.classList.toggle('gxm', !!pg.loading);
          try { if (typeof prompts === 'function') prompts(); } catch (e) { /* */ }
        }
        await need;
        if (tok !== _renderTok) return;
      }
    }
    const html = pg.render(S);
    const dx = ni > _prevNav ? 26 : ni < _prevNav ? -26 : 0;
    const fa = document.activeElement, fd = !changed && fa && main.contains(fa) && window.NAVSTATE ? NAVSTATE.descOf(fa) : null;   // same route re-render: keep the focus
    const gm = /data-grid="(g\d)"/.exec(html);   // grid page (G1-G6, grid.css): one fixed frame, zones scroll inside
    main.innerHTML = `<div class="page ${changed ? 'enter' : ''}${gm ? ' gx' : ''}"${gm ? ` data-g="${gm[1]}"` : ''} style="--dx:${dx || 14}px">${html}</div>`;
    main.classList.toggle('gxm', !!gm);
    if (changed) { const t = $('.tabs a.on'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    if (changed) { window.scrollTo(0, 0); main.scrollTop = 0; }
    _prevKey = key; _prevNav = ni;
    enhance(main, changed);
    if (pg.after) pg.after(S, main.firstElementChild);
    _leave = pg.leave || null;
    document.title = ((typeof areaTitle === 'function' ? areaTitle() : (pg.title ? pg.title(S) : '')) || 'Central') + ' · FC Coach';   // QA SH-4
    const pn = $('#pageName'); if (pn) pn.textContent = S.page === 'hub' ? 'Central' : (PAGES[ni] ? (PAGES[ni][1] === 'Us' ? 'Co-op' : PAGES[ni][1]) : 'Home');
    prompts(pg.prompts ? pg.prompts(S) : null);
    if (fd && !main.contains(document.activeElement)) { const el = NAVSTATE.findDesc(fd); if (el) { el.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); } }
    document.dispatchEvent(new CustomEvent('fc:rendered', { detail: { routeChanged: changed, page: S.page } }));
  } catch (e) {
    main.innerHTML = `<div class="tile"><h2 class="h">Something went wrong</h2><p class="muted">${esc(e.message)}</p></div>`;
    showError('Render error on ' + S.page + ': ' + (e.stack || e.message));
  }
}
function footHints() {
  return `<div class="foot"><span><span class="kbd">Q</span><span class="kbd">E</span> switch screens</span><span><span class="kbd">Z</span><span class="kbd">C</span> switch tabs</span><span><span class="kbd">Esc</span> back</span><span><span class="kbd">Space</span> play / pause replay</span></div>`;
}

// ---------- enhancements after render ----------
function enhance(root, animate) {
  // stagger tiles
  $$('.tile', root).forEach((t, i) => t.style.setProperty('--i', Math.min(i, 14)));
  if (!animate) $$('.tile', root).forEach(t => { t.style.animation = 'none'; });
  if (!animate) $$('.fill', root).forEach(t => { t.style.animation = 'none'; });
  // count-ups
  $$('[data-count]', root).forEach(el => countUp(el, animate));
  // sortable tables
  $$('table[data-sortable]', root).forEach(initSort);
}
function countUp(el, animate) {
  const to = +el.dataset.count, d = +el.dataset.dec || 0;
  if (!animate || !isFinite(to) || document.documentElement.classList.contains('noanim') || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to.toFixed(d); return; }
  const t0 = performance.now(), dur = 900; let done = false;
  const step = now => {
    if (done) return;
    const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = (to * e).toFixed(d);
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else done = true;
  };
  requestAnimationFrame(step);
  setTimeout(() => { done = true; el.textContent = to.toFixed(d); }, dur + 80);
}
const SORTS = {};
function initSort(tbl) {
  const id = tbl.id;
  const ths = $$('th', tbl.tHead);
  ths.forEach((th, i) => {
    if (!th.hasAttribute('data-sort')) return;
    th.addEventListener('click', () => {
      const cur = SORTS[id];
      const dir = cur && cur[0] === i ? -cur[1] : (th.dataset.sort === 'str' ? 1 : -1);
      SORTS[id] = [i, dir]; applySort(tbl);
    });
  });
  if (!SORTS[id] && tbl.dataset.default) { const [i, d] = tbl.dataset.default.split(':').map(Number); SORTS[id] = [i, d]; }
  if (SORTS[id]) applySort(tbl);
}
function applySort(tbl) {
  const [i, dir] = SORTS[tbl.id]; const th = tbl.tHead.rows[0].cells[i]; if (!th) return;
  const str = th.dataset.sort === 'str';
  $$('th', tbl.tHead).forEach(h => h.classList.remove('sorted', 'asc'));
  th.classList.add('sorted'); if (dir > 0) th.classList.add('asc');
  const tb = tbl.tBodies[0], rows = Array.from(tb.rows);
  const val = r => { const c = r.cells[i]; const v = c ? (c.dataset.v ?? c.textContent.trim()) : ''; return str ? String(v) : (v === '' || v === '–' || isNaN(+v) ? null : +v); };
  rows.sort((a, b) => { const x = val(a), y = val(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (str ? x.localeCompare(y) : x - y) * dir; });
  rows.forEach(r => { Array.from(r.cells).forEach((c, k) => c.classList.toggle('scol', k === i)); tb.appendChild(r); });
}

// ---------- tooltip (Figma Tooltip 179:881, docs/ui_changes/2026-11-24_focus_states.md §4) ----------
// One tip for mouse, keyboard and pad: it opens on hover AND when its carrier (the element with data-tip, or a focused element
// that contains one) gets pad/keyboard focus. Y pins / unpins it (State=Pinned); B / Esc / Y close a pinned tip. No information
// is hover-only: every carrier is focusable (gamepad.js enhanceFocusable gives orphan carriers tabindex 0).
function tipCarrierOf(el) {
  if (!el || el === document.body || !el.closest || el.closest('#prompts, #tip')) return null;
  if (el.hasAttribute('data-tip') && el.dataset.tip) return el;
  const inner = el.querySelector && el.querySelector('[data-tip]');
  return inner && inner.dataset.tip ? inner : null;
}
function initTip() {
  const tip = $('#tip');
  const T = { carrier: null, anchor: null, via: '', pinned: false, x: 0, y: 0 };
  const padOrKb = () => /^(pad|kb)$/.test(document.documentElement.dataset.input || '');
  const foot = () => {
    const kc = document.documentElement.dataset.input === 'kb';
    return `<div class="tipf"><span class="gl ${kc ? 'kc' : 'c'}">Y</span>${T.pinned ? 'Unpin' : 'Pin'}</div>`;
  };
  const place = () => {
    if (!T.carrier) return;
    const r = tip.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    let L, Tp;
    if (T.via === 'hover') {
      L = T.x + 14; Tp = T.y + 16;
      if (L + r.width > W - 8) L = Math.max(8, T.x - r.width - 10);
      if (Tp + r.height > H - 8) Tp = Math.max(8, T.y - r.height - 12);
    } else {
      const a = (T.anchor && T.anchor.isConnected ? T.anchor : T.carrier).getBoundingClientRect();
      const pb = document.querySelector('.prompts'), maxB = Math.min(H - 10, (pb ? pb.getBoundingClientRect().top : H) - 6);
      L = Math.min(Math.max(12, a.left + (a.width - r.width) / 2), Math.max(12, W - r.width - 12));
      Tp = a.bottom + 10; if (Tp + r.height > maxB) Tp = Math.max(10, a.top - r.height - 10);
    }
    tip.style.left = Math.round(L) + 'px'; tip.style.top = Math.round(Tp) + 'px';
  };
  const draw = () => {
    tip.innerHTML = `<div class="tipb">${T.carrier.dataset.tip}</div>${T.via === 'hover' && !T.pinned ? '' : foot()}`;
    tip.classList.add('on'); tip.classList.toggle('pinned', T.pinned);
    if (T.via !== 'hover') tip.dataset.gpTip = '1'; else delete tip.dataset.gpTip;
    place();
  };
  const show = (carrier, via, anchor) => { T.carrier = carrier; T.via = via; T.anchor = anchor || carrier; draw(); };
  const hide = () => { T.carrier = null; T.anchor = null; T.pinned = false; tip.classList.remove('on', 'pinned'); delete tip.dataset.gpTip; };
  const refreshPrompts = () => { try { if (typeof window.prompts === 'function') window.prompts(); } catch (e) { /* */ } };
  // focus-driven (pad / keyboard): called by focusin here and by gamepad.js syncFocus
  const fromFocus = el => {
    const c = tipCarrierOf(el);
    if (T.pinned && T.carrier && T.carrier.isConnected && (!c || c === T.carrier)) return;   // a pinned tip stays until Y / B
    if (c && (padOrKb() || (el.matches && el.matches(':focus-visible')))) { T.pinned = false; show(c, 'focus', el); }
    else if (T.carrier && T.via !== 'hover') hide();
  };
  const toggle = () => {
    let c = T.carrier;
    if (!c || !c.isConnected) { const a = document.activeElement; c = tipCarrierOf(a); if (!c) return false; T.carrier = c; T.anchor = a; }
    if (T.pinned) { hide(); refreshPrompts(); return true; }
    T.pinned = true; if (T.via === 'hover' || !T.via) T.via = 'focus'; draw(); refreshPrompts(); return true;
  };
  const focusedCarrier = () => tipCarrierOf(document.activeElement);
  window.FC_TIP = {
    fromFocus, toggle, hide,
    get pinned() { return T.pinned && !!T.carrier && T.carrier.isConnected; },
    get open() { return !!T.carrier && tip.classList.contains('on'); },
    // the prompt bar's Y label: Pin / Unpin when the focused element carries a tip
    label() { if (this.pinned) return 'Unpin'; return focusedCarrier() ? 'Pin' : ''; },
  };
  document.addEventListener('focusin', e => { fromFocus(e.target); if (!(e.target.closest && e.target.closest('#prompts'))) refreshPrompts(); });   // never rebuild the bar under a focused prompt
  document.addEventListener('focusout', () => setTimeout(() => {
    const a = document.activeElement;
    if (!a || a === document.body) { if (T.carrier && T.via !== 'hover' && !T.pinned) hide(); refreshPrompts(); }
  }, 0));
  document.addEventListener('mouseover', e => {
    if (T.pinned) return;
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && el.dataset.tip) { T.x = e.clientX; T.y = e.clientY; if (T.carrier !== el || T.via !== 'hover') show(el, 'hover'); else place(); }
    else if (T.carrier && T.via === 'hover') { hide(); const a = document.activeElement; if (a && a !== document.body) fromFocus(a); }
  });
  document.addEventListener('mousemove', e => { if (T.carrier && T.via === 'hover' && !T.pinned) { T.x = e.clientX; T.y = e.clientY; place(); } });
  document.addEventListener('scroll', () => { if (!T.carrier) return; if (T.via === 'hover' && !T.pinned) hide(); else requestAnimationFrame(place); }, true);
  addEventListener('resize', () => { if (T.carrier) place(); });
  // B / Esc closes a pinned tip first (window capture runs before the page's Esc = back)
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && T.pinned) { e.preventDefault(); e.stopImmediatePropagation(); hide(); refreshPrompts(); }
  }, true);
  // the "i" buttons: A / click pins the tip (it stays until Y, B or another click)
  document.addEventListener('click', e => {
    const el = e.target.closest('.info');
    if (!el) return;
    e.preventDefault();
    if (T.pinned && T.carrier === el) { hide(); refreshPrompts(); return; }
    T.carrier = el; T.anchor = el; T.via = 'focus'; T.pinned = true; draw(); refreshPrompts();
  });
  // a re-render can remove the carrier: never leave a tip floating over a stale element
  new MutationObserver(() => { if (T.carrier && !T.carrier.isConnected) { hide(); refreshPrompts(); } }).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
}

// ---------- global click handling ----------
function initClicks() {
  document.addEventListener('click', e => {
    const xh = e.target.closest('.xh');
    if (xh && !e.target.closest('a,button:not(.xh)')) { xh.parentNode.classList.toggle('open'); return; }
    const vc = e.target.closest('.vcard');
    if (vc && !e.target.closest('a')) { vc.classList.toggle('open'); return; }
    const row = e.target.closest('[data-href]');
    if (row && !e.target.closest('a,button,input,select')) { const h = '#' + row.dataset.href.replace(/^#/, ''); if (window.NAVSTATE && NAVSTATE.isViewChange(h, location.hash)) setView(h); else location.hash = h; return; }
    const k = e.target.closest('#tabs .key');
    if (k) { cycleNav(+k.dataset.d); return; }
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('select[data-param]');
    if (s) patch({ [s.dataset.param]: s.value || null, ...(s.dataset.reset ? Object.fromEntries(s.dataset.reset.split(',').map(k => [k, null])) : {}) });
  });
}
// LB RB wrap around the top screens; returning to a screen restores its last tab, row and scroll for the session (grid brief)
function cycleNav(d) {
  const i = (navIndex(S.page) + d + PAGES.length) % PAGES.length, pg = PAGES[i][0];
  const last = window.NAVSTATE && NAVSTATE.lastHash ? NAVSTATE.lastHash(pg) : null;
  if (last && window.NAVSTATE.setPending) NAVSTATE.setPending('restore');
  const h = last || href({ page: pg });
  if (h === location.hash) render(); else location.hash = h;
}
// LT RT (Z C): the Sub-tab Bar on show (wraps); a sub-tab is view state with its own focus + scroll memory
function cycleTab(d) {
  const bar = document.querySelector('#main [data-stb]'), as = bar ? [...bar.querySelectorAll('a[href^="#"]')] : [];
  if (as.length > 1) { const cur = Math.max(0, as.findIndex(a => a.classList.contains('on'))), j = (cur + d + as.length) % as.length;
    if (window.NAVSTATE && NAVSTATE.switchTab) NAVSTATE.switchTab(as[j].getAttribute('href'), j); else location.hash = as[j].getAttribute('href').slice(1); return; }
  const pg = REG[S.page];
  if (!pg || !pg.tabs) return;
  const tabs = pg.tabs(S); if (!tabs.length) return;
  const key = pg.tabParam || 'tab', cur = Math.max(0, tabs.indexOf(S[key] || tabs[0]));
  patch({ [key]: tabs[(cur + d + tabs.length) % tabs.length], step: null, rule: null, match: null });   // a new tab drops the previous tab's view state (QA N-9)
}
function initKeys() {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'q') cycleNav(-1);
    else if (k === 'e') cycleNav(1);
    else if (k === 'z') cycleTab(-1);
    else if (k === 'c') cycleTab(1);
    else if (k === 'escape' || k === 'backspace') { if (document.querySelector('.rp2, .mc-pop:not([hidden]), .overlay.on')) return; if (window.NAVSTATE ? NAVSTATE.hasBackTarget() : (PARENT[S.page] || S.page === 'prematch' || S.cmp)) { e.preventDefault(); (window.goBackApp || (() => nav({ page: PARENT[S.page] })))(); } }
    else return;
  });
}
function buildNav() {
  $('#tabs').innerHTML = PAGES.map(([k, l], i) => `<a href="#page=${k}" data-p="${k}" data-i="${i}">${l === 'Us' ? esc(P1()) + ' &amp; ' + esc(P2()) : l}</a>`).join('');
}
function buildHeader() {
  const ms = matchList();
  const w = ms.filter(m => resultOf(m) === 'W').length, d = ms.filter(m => resultOf(m) === 'D').length, l = ms.filter(m => resultOf(m) === 'L').length;
  $('#brandClub').textContent = clubName();
  $('#recbox').textContent = ms.length ? `${w}-${d}-${l} · ${w * 3 + d} pts` : '';
  const seg = ms.slice(-10).map(m => `<i class="${resultOf(m) || ''}" data-tip="${esc(m.title)}"></i>`);
  while (seg.length < 10) seg.push('<i></i>');
  $('#segbar').innerHTML = seg.join('');
}
// FC-style button prompt bar (keyboard equivalents in small text)
function prompts(extra) {
  const P = [['<span class="gl">LB</span><span class="gl">RB</span>', 'Screens', 'Q / E'], ['<span class="gl">LT</span><span class="gl">RT</span>', 'Tabs', 'Z / C', 'hide-m']];
  if (PARENT[S.page] || S.page === 'prematch') P.unshift(['<span class="gl c">B</span>', 'Back', 'Esc']);
  P.unshift(['<span class="gl c">A</span>', 'Select', 'click']);
  (extra || []).forEach(x => P.push(x));
  $('#prompts').innerHTML = P.map(([g, l, k, c]) => `<span class="p ${c || ''}">${g}${l}${k ? ` <small>${k}</small>` : ''}</span>`).join('');
}

// Loss reaction (kpis.loss_reaction, ledger rule loss_reaction_ok): plain text with its sample, never a meter.
// both_high_at_loss is context only (severity 0) and is not shown as a target anywhere.
function lossReactionRow(k, label = 'Reaction after a loss') {
  const lr = k && k.loss_reaction; if (!lr) return '';
  if (lr.share == null || !isNum(lr.n)) return `<div class="srow"><span>${esc(label)}</span><b class="muted">not measurable${lr.reason ? ' · ' + esc(lr.reason) : ''}</b></div>`;
  const ok = Math.round(lr.share * lr.n);
  return `<div class="srow"><span>${esc(label)}</span><b>${ok} of ${lr.n} losses · 1 match</b></div>`
    + (isNum(lr.press_n) || isNum(lr.cover_n) ? `<div class="srow"><span class="muted">press · cover</span><b class="muted">${isNum(lr.press_n) ? lr.press_n + '/' + lr.n : '–'} · ${isNum(lr.cover_n) ? lr.cover_n + '/' + lr.n : '–'}</b></div>` : '');
}
// Facts gate (dashboard/data/<day>.facts.js -> window.FC26_FACTS[day]): every number has a trust level.
// blocked = never shown (say "not measurable yet" + reason); rough = shown with its `words`; firm/context = shown normally.
// No facts file loaded -> null (callers keep their old behaviour).
function factsDay(day) { return (window.FC26_FACTS || {})[day] || null; }
function factOf(matchId, path) { const F = factsDay(String(matchId || '').split('#')[0]); return F ? ((F.facts || []).find(f => f.match === matchId && f.path === path) || { trust: 'missing' }) : null; }
// Plain-language reasons for blocked facts (copy guide: short, no jargon). The full technical reason stays in facts.js.
function plainReason(r) {
  const s = String(r || '')
    .replace(/^[A-Z]\d+ open:\s*/, '')
    .replace(/^D\d+\b[:\s]*/, '')
    .replace(/\(?\s*(?:quality\s+)?grade\s+[A-D]\b\s*[:\-–]?\s*/gi, '')
    .replace(/\)\s*$/, '')
    .trim();
  if (/markers? seen/i.test(s)) return 'minimap markers not seen often enough to tell you apart';
  if (/marker|flicker|jumps|switches/i.test(s)) return 'minimap markers too unstable: next session\u2019s custom radar colours should fix this';
  if (/markers? seen .*defending|both markers/i.test(s)) return 'minimap markers not seen often enough to tell you apart';
  let m = s.match(/radar gap: ([\d.]+) s/i) || s.match(/minimap hidden for ([\d.]+) s/i); if (m) return `build-up not seen (minimap hidden ${Math.round(+m[1])} s)`;
  m = s.match(/last spell ended ([\d.]+) s before/i); if (m) return `build-up not seen (minimap lost ${Math.round(+m[1])} s before)`;
  return s.length > 70 ? s.slice(0, 67) + '…' : s;
}
// facts gate across every tracked match for one path: {blocked, why} | {rough, words} | null (no facts loaded)
function gateAll(path) {
  const fs = matchList().map(m => factOf(m.id, path)).filter(f => f && f.trust !== 'missing'); if (!fs.length) return null;
  if (fs.every(f => f.trust === 'blocked')) return { blocked: true, why: plainReason(fs[0].blocked_because) };
  const r = fs.find(f => f.trust === 'rough'); return { blocked: false, rough: !!r, words: r ? r.words : '' };
}
const gateNote = g => `<p class="muted gate-note">Not measurable yet: ${esc(g.why || 'blocked by the data check')}</p>`;
// ONE trust label helper (QA R2-3): " est." only when the fact is rough; firm/context unmarked; blocked handled by callers
function estTag(f) { return f && f.trust === 'rough' ? ' est.' : ''; }
function estOfAll(fs) { fs = (fs || []).filter(f => f && f.trust !== 'missing' && f.trust !== 'blocked'); return fs.length && fs.every(f => f.trust === 'rough') ? ' est.' : ''; }

// F-2: one player source. playerList() fills OVR / positions / morale from the latest squad-status capture (exact names).
(function () {
  const orig = playerList; let done = null;
  playerList = function () {
    const L = orig(), Q = window.FC26_SQUAD; if (!Q || done === L) return L;
    const by = new Map(((Q.squad_status) || []).filter(r => r.name).map(r => [fold(r.name), r]));
    for (const p of L) { const r = by.get(fold(p.name)); if (!r) continue; if (!isNum(p.ovr) && isNum(r.ovr)) p.ovr = r.ovr;
      if (!p.pos && r.positions && r.positions[0]) p.pos = r.positions[0]; if (r.positions && r.positions.length) { const np = r.positions.map(cleanPos).filter(Boolean); if (np.length) p.natural = np; }
      p.at = p.at || {}; for (const k of ['morale', 'sharpness', 'energy']) if (r[k] != null && p.at[k] == null) p.at[k] = r[k];
      if (!isNum(p.age) && isNum(r.age)) p.age = r.age; }
    // age gap-fill (compare Age fix): dev-plan / transfer captures, then the FC 26 base database (fills gaps only)
    const ageOf = new Map(); ((Q.dev_plans) || []).concat((Q.transfers) || []).forEach(r => { const n = r && (r.name || r.player), a = r && r.data && r.data.age; if (n && isNum(a) && !ageOf.has(fold(n))) ageOf.set(fold(n), a); });
    const EX = (window.FC26_EXTERNAL || {}).players || {}; Object.entries(EX).forEach(([k, v]) => { if (v && isNum(v.age)) { if (!ageOf.has(fold(k))) ageOf.set(fold(k), v.age); if (v.id && !ageOf.has(fold(v.id))) ageOf.set(fold(v.id), v.age); } });
    for (const p of L) if (!isNum(p.age)) { const a = ageOf.get(fold(p.name)) ?? ageOf.get(fold(p.id || '')); if (isNum(a)) p.age = a; }
    done = L; return L; };
})();
// raw source tags ("[official] …", "[radar, 2 matches]", "[inbox, 8 Feb]") never reach the screen
function untag(t) {
  const raw = String(t || '');
  const addExt = /\[ext\b/i.test(raw) && !/ext\.|base database/i.test(raw);
  let out = raw
    .replace(/\s*per\s*\[coach\]\s*[A-Z]\d+\b/gi, ' per coach plan')
    .replace(/\[(?:official|squad|kb|coach|devplan|transfer|scout|youth|chat)\]/gi, '')
    .replace(/\[(?:radar|ctrl|ext|inbox|official)(?:[,\s]+([^\]]+))?\]/gi, (_, sub) => sub ? `(${sub.trim()})` : '')
    .replace(/\[[a-z]+(?:[,\s]+[^\]]+)?\]/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/;\s*(?=\S)/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (addExt && out) out = out.replace(/\.$/, '') + ' (ext.)';
  return out;
}
// live captured settings (tactic slots read from Team Sheets / Edit Tactic) with offline fallback to the saved 4-slot Fàbregas setup
const DEFAULT_CAPTURED_SETTINGS = {
  active_slot: 1,
  vision: { value: 'High Pressing' },
  common: { tactic: 'COMO DEFAULT', preset: 'High Pressing' },
  xi: { GK: 'Butez', RB: 'Smolčić', RCB: 'Da Cunha', LCB: 'Diego Carlos', LB: 'Valle', RCDM: 'Caqueret', LCDM: 'Perrone', RM: 'Diao', CAM: 'Paz', LM: 'Baturina', ST: 'Douvikas' },
  slots: [
    { slot: 1, name: 'COMO Default', purpose: 'Standard', formation: '4-2-3-1 Wide', build_up: 'Short Passing', defensive_approach: 'High', line_height: 65,
      roles: { GK: ['Ball-Playing Keeper', 'Build-Up'], RB: ['Fullback', 'Balanced'], RCB: ['Ball-Playing Defender', 'Build-Up'], LCB: ['Defender', 'Defend'], LB: ['Wingback', 'Support'], RCDM: ['Deep-Lying Playmaker', 'Defend'], LCDM: ['Holding', 'Defend'], RM: ['Winger', 'Balanced'], CAM: ['Playmaker', 'Roaming'], LM: ['Inside Forward', 'Attack'], ST: ['Advanced Forward', 'Attack'] } },
    { slot: 2, name: 'COUNTER GUARD', purpose: 'Counter Guard', formation: '4-2-3-1 Wide', build_up: 'Short Passing', defensive_approach: 'High', line_height: 61, roles_from: 1,
      roles: { RB: ['Fullback', 'Defend'], CAM: ['Playmaker', 'Build-Up'], LM: ['Wide Midfielder', 'Support'] } },
    { slot: 3, name: 'LOW BLOCK BREAKER', purpose: 'Low-Block Breaker', formation: '4-2-3-1 Wide', build_up: 'Short Passing', defensive_approach: 'High', line_height: 72, roles_from: 1,
      roles: { GK: ['Sweeper Keeper', 'Build-Up'], RB: ['Wingback', 'Support'], LB: ['Fullback', 'Balanced'], RM: ['Wide Playmaker', 'Build-Up'], CAM: ['Shadow Striker', 'Attack'] } },
    { slot: 4, name: 'PROTECT LEAD', purpose: 'Protect Lead', formation: '4-2-3-1 Wide', build_up: 'Counter', defensive_approach: 'High', line_height: 61, roles_from: 1,
      roles: { RB: ['Fullback', 'Defend'], LB: ['Fullback', 'Defend'], RCDM: ['Holding', 'Defend'], RM: ['Wide Midfielder', 'Support'], CAM: ['Playmaker', 'Balanced'], LM: ['Wide Midfielder', 'Support'] } },
  ],
  notes: ['All 4 slots keep the High Pressing Tactical Vision (Line ≥ 61)', 'RCB Da Cunha carries the out-of-position (!) mark in all slots'],
};
function capturedSettings(c) {
  return window.FC26_SETTINGS || window.FC26_CAPTURED_SETTINGS
    || (window.FC26_SQUAD && window.FC26_SQUAD.captured_settings)
    || (window.FC26_NEXT && window.FC26_NEXT.captured_settings)
    || (c && (c.captured_settings || (c.tactics && c.tactics.captured_settings)))
    || DEFAULT_CAPTURED_SETTINGS;
}
function expandCapturedSlots(cs) {
  if (!cs || !Array.isArray(cs.slots)) return [];
  const common = cs.common || {}, xi = cs.xi || {}, byNum = new Map();
  cs.slots.forEach(s => { if (s && s.slot != null) byNum.set(s.slot, s); });
  const rolesOf = (s, seen = new Set()) => {
    if (!s || seen.has(s.slot)) return {};
    seen.add(s.slot);
    const base = (s.roles_from != null && byNum.has(s.roles_from)) ? Object.assign({}, rolesOf(byNum.get(s.roles_from), seen))
      : (s.base != null && byNum.has(s.base)) ? Object.assign({}, rolesOf(byNum.get(s.base), seen)) : {};
    (s.roles_drop || s.drop || []).forEach(k => delete base[k]);
    Object.entries(s.roles || {}).forEach(([k, v]) => { base[k] = v; });
    return base;
  };
  const s1Map = rolesOf(byNum.get(1) || cs.slots[0]);
  return cs.slots.map(s => {
    const rmap = rolesOf(s), pmap = Object.assign({}, xi, s.players || {});
    const roles = Object.entries(rmap).map(([pos, rf]) => {
      const role = Array.isArray(rf) ? rf[0] : (rf && rf.role) || '';
      const focus = Array.isArray(rf) ? rf[1] : (rf && rf.focus) || '';
      const b1 = s1Map[pos], r1 = Array.isArray(b1) ? b1[0] : (b1 && b1.role) || '', f1 = Array.isArray(b1) ? b1[1] : (b1 && b1.focus) || '';
      const changed = s.slot !== 1 && (role !== r1 || focus !== f1);
      return { pos, player: pmap[pos] || '', role, focus, changed, baseRole: r1, baseFocus: f1 };
    });
    return Object.assign({}, common, s, { roles });
  });
}
function syncSlotText(txt, cs) {
  let s = String(txt || '');
  const slots = expandCapturedSlots(cs);
  if (!slots.length) return s;
  const m = s.match(/\bslot\s*([1-4])\b/i);
  if (!m) return s;
  const sl = slots.find(x => x.slot === +m[1]);
  if (!sl) return s;
  const sum = [sl.formation, sl.build_up, sl.defensive_approach ? (isNum(sl.line_height) ? `${sl.defensive_approach} ${sl.line_height}` : sl.defensive_approach) : (isNum(sl.line_height) ? `Line ${sl.line_height}` : '')].filter(Boolean).join(', ');
  if (sum) {
    s = s.replace(/\(\s*\d-\d(?:-\d){1,2}[^)]*(?:Deep|Balanced|High|Aggressive)\s*\d+[^)]*\)/i, `(${sum})`);
    s = s.replace(/:\s*\d-\d(?:-\d){1,2},\s*[^.]*?(?:Deep|Balanced|High|Aggressive)\s*\d+\.(?:\s*It breaks High Pressing;[^.]*\.)?/i, `: ${sum}.`);
  }
  return s;
}
// a coach target's display name when no page map knows its id: the official stat name from `metric`
// ("official.FT.Ball Recovery Time (Seconds)" -> "Ball Recovery Time"), else the id in plain words
function targetLabel(t) {
  const m = /^official\.[A-Z0-9]+\.([^/(]+?)\s*(\(|$)/.exec((t && t.metric) || '');
  if (m) return m[1].trim();
  const w = String((t && t.id) || '').replace(/_/g, ' ');
  return w.charAt(0).toUpperCase() + w.slice(1);
}
