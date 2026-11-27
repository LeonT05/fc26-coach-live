/* Club and player streaks and records (brief docs/ui_changes/2026-11-24_streaks-records.md). Figma (QeCUkHXbS34AlbGkdoliCJ)
   L5 section 273:15604: M1 273:15606 Matches header panel · M2 273:16005 Run Drill-down · P6 274:16231 profile RUNS / MILESTONES ·
   C3 274:16441 Central moment under "Last 6"; parts in 273:15429 (Run Row 273:15445, Club Streaks Panel 273:15447, Run Drill-down
   273:15524, Player Streaks Block 274:3314, Data Cell L Focused 273:15424).
   Data: window.FC26_STREAKS (data/streaks.js, fccoach/streaks.py): every number, label ("≥ N" = the run began before the first
   tracked match), date and match list comes from the file; null = not captured ("–"). Nothing here computes a streak.
   Pad: a streak / record cell is a focusable Data Cell; A opens the drill-down (focus on the newest match; A opens Match Centre;
   B closes and returns focus to the cell). B does nothing else on these top screens (Leon 24 Nov, Decision 2). */
'use strict';
(function () {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const D = () => window.FC26_STREAKS || null;
  const dm = s => { const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${+m[3]} ${MON[+m[2] - 1]}` : ''; };
  const mOf = id => ((D() || {}).matches || []).find(m => m.id === id) || null;
  const dash = s => String(s || '').replace(/-/g, '–');
  // one Data Cell; o.focus = a button that opens the drill-down of `o.run` (a list of match ids)
  function cell(l, v, o = {}) {
    const tag = o.focus ? 'button' : 'div', at = o.focus ? ` type="button" data-run="${esc(o.run)}"` : '';
    return `<${tag} class="dcell ${o.size || ''} stk-c${o.focus ? ' f' : ''}"${at}><span class="k">${esc(l)}</span><span class="v ${o.tone || ''}">${v == null || v === '' ? '–' : esc(String(v))}${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</span></${tag}>`;
  }
  const kick = t => `<div class="stk-k"><i aria-hidden="true"></i>${esc(t)}</div>`;
  // run registry: data-run keys -> { title, matches, label, alive, open_start, from, to }
  const RUNS = {};
  const reg = (key, title, r) => { if (!r || !(r.matches || []).length) return null; RUNS[key] = { title, ...r }; return key; };

  // ---------- M1: Club Streaks Panel (Matches header) ----------
  function clubPanel() {
    const S = D(); if (!S || !S.club_streaks) return '';
    const cs = S.club_streaks, alive = k => cs[k] && cs[k].current && cs[k].current.status === 'alive' && cs[k].current.n > 0 ? cs[k] : null;
    const pick = (a, b) => { const A = alive(a), B = alive(b); if (A && B) return (A.current.n >= B.current.n ? a : b); return A ? a : B ? b : null; };
    // order: unbeaten, scored, away (wins before unbeaten at the same length), home, wins; a losing run is always shown
    const keys = ['unbeaten', 'scored', pick('away_wins', 'away_unbeaten'), pick('home_wins', 'home_unbeaten'), 'wins', 'clean_sheets', 'without_win', 'losses']
      .filter((k, i, a) => k && a.indexOf(k) === i && alive(k));
    const neg = keys.filter(k => /without_win|losses/.test(k)), pos = keys.filter(k => !/without_win|losses/.test(k));
    const runs = [...pos.slice(0, 5 - neg.length), ...neg].map(k => { const c = cs[k].current;
      return cell(cs[k].label, c.label, { size: 'l', tone: /without_win|losses/.test(k) ? 'neg' : 'pos', tag: 'alive', focus: !!reg(`club.${k}`, cs[k].label, c), run: `club.${k}` }); });
    const R = S.records || {}, cov = S.coverage || {}, tt = R.tracked_totals || {}, rec = [];
    const bw = cs.wins && cs.wins.best; if (bw) rec.push(cell('Best wins run', bw.label, { size: 'l', tag: `${dm(bw.from)} – ${dm(bw.to)}`, focus: !!reg('club.wins.best', 'Best wins run', bw), run: 'club.wins.best' }));
    const bwin = R.biggest_win; if (bwin) { const m = mOf((bwin.matches || [])[0]); rec.push(cell('Biggest win', dash(bwin.v), { size: 'l', tag: m ? `${m.venue === 'away' ? 'at' : 'vs'} ${teamName(m.opp)}` : '', focus: !!reg('rec.biggest_win', 'Biggest win', { matches: bwin.matches }), run: 'rec.biggest_win' })); }
    const bdef = R.biggest_defeat; if (bdef) { const m = mOf((bdef.matches || [])[0]); rec.push(cell('Biggest defeat', dash(bdef.v), { size: 'l', tone: 'neg', tag: m ? `${m.venue === 'away' ? 'at' : 'vs'} ${teamName(m.opp)}` : '', focus: !!reg('rec.biggest_defeat', 'Biggest defeat', { matches: bdef.matches }), run: 'rec.biggest_defeat' })); }
    const ms = R.most_goals_scored; if (ms) rec.push(cell('Most scored', ms.value, { size: 'l', tag: (ms.titles || []).map(t => t.replace(/\s*COM\s*$/, '').replace(/^COM\s+(\S+)\s+(\w+)$/, '$2 $1')).join(' · '), focus: !!reg('rec.most_scored', 'Most scored', { matches: ms.matches }), run: 'rec.most_scored' }));
    const b5 = (R.best_points || {})['5']; if (b5) rec.push(cell('Best 5 matches', `${b5.pts}/${b5.max}`, { size: 'l', tag: 'pts', focus: !!reg('rec.best5', 'Best 5 matches', b5), run: 'rec.best5' }));
    const md = cov.matchdays || [];
    const trk = [cell('Matches', cov.n_tracked, { tag: md.length === 2 ? `MD ${md[0]}–${md[1]}` : '' }), cell('Record', isNum(tt.w) ? `${tt.w}-${tt.d}-${tt.l}` : null, { tag: 'W-D-L' }), cell('Legend', '≥ N', { tone: 'muted', tag: 'began before tracking' })];
    return `<section class="stk-panel" aria-label="Club streaks and records"><div class="grp">${kick('CURRENT RUNS')}<div class="cells">${runs.join('') || cell('Runs', null, { tone: 'muted', tag: 'none alive' })}</div></div>
      <div class="grp">${kick('RECORDS')}<div class="cells">${rec.join('')}</div></div><div class="grp">${kick('TRACKED')}<div class="cells">${trk.join('')}</div></div></section>`;
  }

  // ---------- P6: Player Streaks Block (profile Stats tab) ----------
  function playerBlock(p) {
    const S = D(); if (!S || !S.players || !p) return '';
    const key = Object.keys(S.players).find(k => k === p.id || fold(S.players[k].name) === fold(p.name)); if (!key) return '';
    const P = S.players[key], st = P.streaks || {}, gk = /GK/.test(P.primary_pos || '');
    const RK = [['apps', 'Appearances'], ['scored', 'Scored in'], ['goal_involvement', 'G+A in'], ['potm', 'POTM run']].concat(gk || /CB|B$/.test(P.primary_pos || '') ? [['clean_sheets', 'Clean sheets']] : []);
    const runs = RK.filter(([k]) => st[k]).map(([k, l]) => { const s = st[k], c = s.current || {}, b = s.best;
      if (c.status === 'unknown') return cell(l, null, { tone: 'muted', tag: 'not tracked yet' });   // round 7 P1: muted '–' cell, never '? unknown'
      const al = c.status === 'alive' && c.n > 0, tag = al && (!b || b.n <= c.n) ? 'alive' : b ? `best ${b.label}` : '';
      const r = al ? c : b; return cell(l, al ? c.label : c.label === '-' ? null : c.label, { tone: al ? 'pos' : '', tag, focus: !!reg(`p.${key}.${k}`, `${P.name} · ${l}`, r), run: `p.${key}.${k}` }); });
    const ml = P.milestones || {}, tot = P.totals || {};
    const MK = (gk ? [['clean_sheets', 'Clean sheets']] : [['goals', 'Goals']]).concat([['apps', 'Apps'], ['potm', 'POTM']]);
    const mils = MK.filter(([k]) => ml[k]).map(([k, l]) => cell(l, (tot[k] || {}).label, { tone: 'gold', tag: isNum(ml[k].next) ? `next ${ml[k].next} · ${ml[k].to_go} to go` : '' }));
    return `<div class="stk-player pf3s"><div class="grp"><h4 class="pf3-h">Runs</h4><div class="cells">${runs.join('')}</div></div><div class="grp"><h4 class="pf3-h">Milestones</h4><div class="cells">${mils.join('')}</div></div></div>`;
  }

  // ---------- C3: Central moment (S cells under "Last 6", not focusable) ----------
  function moment(lastId) {
    const S = D(); if (!S || !lastId) return '';
    const cs = S.club_streaks || {}, seen = new Set();
    const ms = (S.moments || []).filter(x => x.scope === 'club' && x.match === lastId).filter(x => { const g = x.key.replace(/_(wins|unbeaten)$/, ''); if (/^(home|away)_/.test(x.key)) { if (seen.has(g)) return false; seen.add(g); } return true; }).slice(0, 3);
    if (!ms.length) return '';
    return `<div class="stk-moment">${ms.map(x => `<span class="dcell s"><span class="v ${x.kind === 'ended' ? '' : 'strong'}">${esc(x.label)}</span><span class="k">${esc(String((cs[x.key] || {}).label || x.key).toLowerCase())}</span><i>${esc(x.kind)}</i></span>`).join('')}</div>`;
  }

  // ---------- M2: Run Drill-down (modal host .pk-modal; focus inside, B closes back to the cell) ----------
  const DR = { el: null, origin: null };
  function status(m) { const d = m.data || {}; return d.goals_known ? 'scorers read' : d.ratings_n > 0 || d.potm_known ? 'not fully read' : 'not read'; }
  function openRun(key, origin) {
    const r = RUNS[key], S = D(); if (!r || !S) return; closeRun(true);
    const ids = (r.matches || []).slice(), list = ids.map(mOf).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const w = list.filter(m => m.result === 'W').length, dd = list.filter(m => m.result === 'D').length, l = list.filter(m => m.result === 'L').length;
    const gf = list.reduce((s, m) => s + ((m.score_us_them || [])[0] || 0), 0), ga = list.reduce((s, m) => s + ((m.score_us_them || [])[1] || 0), 0);
    const first = (S.coverage || {}).first || {}, newest = list[0], oldest = list[list.length - 1];
    const cells = [cell('Run', r.label || String(list.length), { size: 'l', tone: r.alive ? 'pos' : '', tag: r.alive ? 'alive' : r.status === 'ended' ? 'ended' : '' }),
      cell('From', dm(r.from || (oldest || {}).date)), cell('To', dm(r.to || (newest || {}).date), { tag: newest && newest.id === ((S.coverage || {}).last || {}).id ? 'latest' : '' }),
      cell('Record', `${w}-${dd}-${l}`, { tag: 'W-D-L' }), cell('Goals', `${gf}–${ga}`)].join('');
    const rows = list.map(m => `<a class="stk-row" href="#page=match&id=${encodeURIComponent(m.id)}" data-mid="${esc(m.id)}"><b class="dt">${esc(dm(m.date))}</b><span class="md">${isNum(m.matchday) ? `MD ${m.matchday} · ` : ''}${m.venue === 'away' ? 'Away' : 'Home'}</span><b class="ti">${esc(m.title)}</b><b class="rs ${m.result}">${esc(m.result || '–')}</b><span class="st">${esc(status(m))}</span></a>`).join('');
    const el = document.createElement('div'); el.className = 'pk-modal stk-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', r.title);
    el.innerHTML = `<div class="stk-win"><h2>${esc(r.title)}</h2><div class="cells">${cells}</div><div class="stk-rows fc-scroll">${rows}</div>${r.open_start ? `<p class="stk-foot"><b>${esc(r.label)}</b> began before ${esc(dm(first.date))}, first tracked match</p>` : ''}</div>`;
    el.addEventListener('click', e => { if (e.target === el) closeRun(); });
    document.body.appendChild(el); DR.el = el; DR.origin = origin || document.activeElement;
    const f = el.querySelector('.stk-row'); if (f) { f.focus(); if (document.documentElement.dataset.input === 'pad') f.classList.add('gp-focus'); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); }
    try { prompts(); } catch (e) { /* */ }
  }
  function closeRun(silent) {
    if (!DR.el) return; DR.el.remove(); DR.el = null; const o = DR.origin; DR.origin = null;
    if (!silent && o && o.isConnected) { o.focus({ preventScroll: true }); if (window.FC && FC.gamepad) FC.gamepad.syncFocus(); }
    try { prompts(); } catch (e) { /* */ }
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#main button.stk-c[data-run]'); if (b) { e.preventDefault(); openRun(b.dataset.run, b); } });
  addEventListener('hashchange', () => closeRun(true));
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.streakCells = {
    z: 3,
    active: () => !DR.el && !!(document.activeElement && document.activeElement.matches && document.activeElement.matches('#main button.stk-c[data-run]')),
    prompts: () => [['A', 'Show matches'], ['Y', 'Search']],
    press(k) { if (k === 'A') { openRun(document.activeElement.dataset.run, document.activeElement); return true; } if (k === 'B') return true; return false; },
  };
  window.PAD_HOOKS.streakRun = {
    z: 6,
    active: () => !!DR.el,
    prompts: () => [['A', 'Open match'], ['B', 'Close']],
    press(k) {
      const rs = [...DR.el.querySelectorAll('.stk-row')], i = rs.indexOf(document.activeElement);
      if (k === 'UP' || k === 'DOWN') { const r = rs[Math.max(0, Math.min(rs.length - 1, (i < 0 ? 0 : i) + (k === 'DOWN' ? 1 : -1)))]; if (r) { r.focus(); r.scrollIntoView({ block: 'nearest' }); if (document.documentElement.dataset.input === 'pad') { document.querySelectorAll('.gp-focus').forEach(x => x.classList.remove('gp-focus')); r.classList.add('gp-focus'); } } return true; }
      if (k === 'A') { const r = rs[i] || rs[0]; if (r) { const h = r.getAttribute('href'); closeRun(true); location.hash = h; } return true; }
      if (k === 'B') { closeRun(); return true; }
      return true;
    },
  };
  window.STRK = { clubPanel, playerBlock, moment, openRun, closeRun, get open() { return !!DR.el; } };
})();
