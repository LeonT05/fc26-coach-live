/* Replay popup v2 (level 3 panel): FC26 Sim Match look on the 10 Hz replay_v2 data, with the old 4 Hz frames as
   fallback. Renderer contract (pipeline, fccoach/replay.py publish/decode):
   - decode once into typed arrays; a track exists only between born and died (sample indices, inclusive);
   - Catmull-Rom through the knots but never across a flag-0 (unknown) sample: short holes (<= 15 m) ease with an
     alpha dip, longer ones cross-fade; predicted (2) is drawn as a ghost, merged (3) as stacked discs;
   - the ball snaps to the owner disc while owned (state 2) and fades when unknown (0);
   - the Leon / Peti rings follow humans.p1 / p2; a switch slides the ring over 150 ms (never shown as motion);
   - scene 1-2 runs are holes (dimmed, never interpolated across, skippable); events t are seconds since t0;
   - names when present, else the slot label.
   Smoothed files (P.smooth, fccoach/replay_smooth.py, 2026-11-24): bridged gaps are flag 2 + tracks[].approx and are drawn
   slightly transparent (never as ghosts); gaps left as flag 0 hold + cross-fade over >= 0.4 s (never invented motion);
   the ball follows ball.render (physics-filled passes, lofted arcs = bigger ball + ground shadow, approx = transparent).
   The clock is time-based (rAF timestamps, frame drops never step the replay).
   Debug: window.__rp exposes per-frame disc positions; #replaycheck runs the 3 s smoothness self-check. */
'use strict';

const RP2 = (() => {
  const HOLE_EASE_M = 15, RING_SLIDE_MS = 150, FADE_N = 4, EDGE_N = 4, APPROX_A = .3, GHOST_A = .55;   // FADE_N samples = 0.4 s at 10 Hz
  const COL = { us: '#C9CED6', usText: '#15131D', gk: '#E8D27A', them: '#F08A3C', themText: '#1B1206', p1: '#3D8BFF', p2: '#FF4D5E', ball: '#FFFFFF' };
  const cache = {};

  // ---------- decode ----------
  const b64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const i16 = (u, o) => { const v = u[o] | (u[o + 1] << 8); return v & 0x8000 ? v - 0x10000 : v; };
  function decPath(u, k, off, unit) {
    const xy = new Float32Array(2 * k); let x = i16(u, off), y = i16(u, off + 2); off += 4; xy[0] = x * unit; xy[1] = y * unit;
    for (let i = 1; i < k; i++) {
      const b = u[off];
      if (b === 0x80) { x = i16(u, off + 1); y = i16(u, off + 3); off += 5; }
      else { x += b > 127 ? b - 256 : b; const c = u[off + 1]; y += c > 127 ? c - 256 : c; off += 2; }
      xy[2 * i] = x * unit; xy[2 * i + 1] = y * unit;
    }
    return [xy, off];
  }
  function decFlags(u, k, off) { const f = new Uint8Array(k); for (let i = 0; i < k; i++) f[i] = (u[off + (i >> 2)] >> ((i & 3) * 2)) & 3; return [f, off + ((k + 3) >> 2)]; }
  function decode(P) {
    const unit = P.pos_unit, pos = b64(P.pos), fl = b64(P.flags); let po = 0, fo = 0;
    const tracks = P.tracks.map((t, id) => {
      const k = t.died - t.born + 1; let xy, f; [xy, po] = decPath(pos, k, po, unit); [f, fo] = decFlags(fl, k, fo);
      const prev = new Int32Array(k), next = new Int32Array(k); let last = -1;
      for (let i = 0; i < k; i++) { if (f[i]) last = i; prev[i] = last; }
      last = -1; for (let i = k - 1; i >= 0; i--) { if (f[i]) last = i; next[i] = last; }
      const ap = new Uint8Array(k); for (const r of (t.approx || [])) for (let i = Math.max(0, r[0] - t.born); i <= Math.min(k - 1, r[1] - t.born); i++) ap[i] = 1;
      // a gap shorter than FADE_N samples still cross-fades over FADE_N (cut[i] = sample before the gap, else -1)
      const cut = new Int32Array(k).fill(-1);
      if (P.smooth) for (let i = 1; i < k; i++) if (!f[i] && f[i - 1]) { let b = i; while (b < k && !f[b]) b++; if (b < k) for (let q = b; q < Math.min(k, i - 1 + FADE_N); q++) cut[q] = i - 1; }
      return { id, team: t.team, slot: t.slot, name: t.name, names: t.names || null, half: t.half || 0, born: t.born, died: t.died, k, xy, f, prev, next, ap, cut, gk: /GK/.test(t.slot || '') };
    });
    const bpos = decPath(b64(P.ball.pos), P.n, 0, unit)[0];
    const R = P.ball.render; let br = null;
    if (R && R.pos) { const ap = new Uint8Array(P.n); for (const r of (R.approx || [])) for (let i = r[0]; i <= Math.min(P.n - 1, r[1]); i++) ap[i] = 1;
      br = { pos: decPath(b64(R.pos), P.n, 0, unit)[0], st: decFlags(b64(R.state), P.n, 0)[0], ap, arcs: R.arcs || [] }; }
    const ru16 = s => { const u = b64(s); return new Int16Array(u.buffer, u.byteOffset, u.length >> 1); };
    const byStart = []; // sample -> tracks alive (bucketed per 100 samples for speed)
    for (const t of tracks) for (let b = Math.floor(t.born / 100); b <= Math.floor(t.died / 100); b++) (byStart[b] = byStart[b] || []).push(t);
    return { hz: P.hz, n: P.n, smooth: !!P.smooth, br, tracks, buckets: byStart, ball: bpos, bstate: b64(P.ball.state), bowner: ru16(P.ball.owner),
      p1: ru16(P.humans.p1), p2: ru16(P.humans.p2), scene: b64(P.scene), minute: ru16(P.minute),
      events: P.events || [], chains: P.chains || [], quality: P.quality || {}, id: P.id };
  }

  // ---------- sampling ----------
  const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return .5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); };
  const smooth = u => u * u * (3 - 2 * u);
  // -> list of draws [{x, y, a, ghost, merged}] for track tk at fractional sample s
  function trackAt(tk, s, sm) {
    const i0 = Math.floor(s); if (i0 < tk.born || i0 > tk.died) return null;
    const j = i0 - tk.born, u = s - i0, k = tk.k, xy = tk.xy, f = tk.f;
    const j1 = Math.min(j + 1, k - 1);
    if (f[j] && f[j1]) {
      const jm = j > 0 && f[j - 1] ? j - 1 : j, jp = j1 + 1 < k && f[j1 + 1] ? j1 + 1 : j1;
      const ap = tk.ap[j] + (tk.ap[j1] - tk.ap[j]) * u;   // bridged (approx) samples: slightly transparent, blended in
      // ghost (coasting) and approx are blended between the two samples, and a track fades in / out over EDGE_N samples
      // at birth / death, so no disc ever pops (a flag change used to switch alpha 1 -> .45 in one frame)
      const g0 = f[j] === 2 && !tk.ap[j] ? 1 : 0, g1 = f[j1] === 2 && !tk.ap[j1] ? 1 : 0, sj = j + u;
      const edge = Math.min(1, sj / EDGE_N, (k - 1 - sj) / EDGE_N);
      const d = { x: cr(xy[2 * jm], xy[2 * j], xy[2 * j1], xy[2 * jp], u), y: cr(xy[2 * jm + 1], xy[2 * j + 1], xy[2 * j1 + 1], xy[2 * jp + 1], u), a: (1 - APPROX_A * ap) * edge, ghost: g0 + (g1 - g0) * u, merged: f[j] === 3, approx: ap > .5 };
      const c = tk.cut[j];   // just after a short unknown gap: finish the >= 0.4 s cross-fade from the held position
      if (c >= 0) { const w = Math.min(1, (j + u - c) / FADE_N); d.a *= w; d.hole = true; return [{ x: xy[2 * c], y: xy[2 * c + 1], a: 1 - w, ghost: false, hole: true, held: true }, d]; }   // same part order as inside the gap
      return [d];
    }
    // hole (flag 0 at j or j+1): never interpolate across it as motion
    const a = f[j] ? j : tk.prev[j], b = f[j1] ? j1 : tk.next[j1];
    const sj = j + u, gh = q => q >= 0 && f[q] === 2 && !tk.ap[q] ? 1 : 0;   // a held disc keeps its ghost look (no alpha pop)
    if (a < 0 && b < 0) return null;
    if (a < 0) { const d = (b - sj) / (0.5 * 10); return [{ x: xy[2 * b], y: xy[2 * b + 1], a: Math.max(0, 1 - d), ghost: gh(b) }]; }
    if (b < 0) { const d = (sj - a) / (0.5 * 10); return [{ x: xy[2 * a], y: xy[2 * a + 1], a: Math.max(0, 1 - d), ghost: gh(a) }]; }
    const L = Math.max(1e-6, b - a), w = Math.min(1, Math.max(0, (sj - a) / L));
    const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], dist = Math.hypot(bx - ax, by - ay);
    // ease only when the implied speed is a real running speed (<= 9 m/s); otherwise cross-fade, never a fast glide
    if (sm) { const W = Math.max(L, FADE_N), v = Math.min(1, (sj - a) / W); return [{ x: ax, y: ay, a: 1 - v, ghost: gh(a), hole: true, held: true }, { x: bx, y: by, a: Math.min(v, (sj - a) / L), ghost: gh(b), hole: true }]; }   // hold + fade ("not seen")
    if (dist <= HOLE_EASE_M && dist / (L / 10) <= 9) { const e = smooth(w); return [{ x: ax + (bx - ax) * e, y: ay + (by - ay) * e, a: 1 - .65 * Math.sin(Math.PI * w), ghost: false, hole: true }]; }
    return [{ x: ax, y: ay, a: 1 - w, ghost: false, hole: true }, { x: bx, y: by, a: w, ghost: false, hole: true }];
  }
  function alive(D, s) { const b = D.buckets[Math.floor(s / 100)] || []; return b.filter(t => s >= t.born && s <= t.died); }

  // ---------- pitch (FC26 Sim Match: dark navy, mowing stripes) ----------
  const PAD = 3; // metres of run-off drawn around the pitch so discs on the touchline are never cut
  // Sim Match takes the COMPETITION's colours (FC26). Serie A is derived from our Serie A scorebug capture
  // (docs/ux_review/refs/radar/fc26_scorebug_seriea_x2.png: navy #0E1E5F / #03205D, logo azure #15B3F9 -> #094096, white).
  // Leon 23 Nov: "it should look like our UI" - bluish-grey charcoal with our green accent, no competition theme.
  const RP_THEMES = { ours: { pitch: '#1A2029', stripe: 'rgba(214,224,232,.03)', line: 'rgba(214,224,232,.42)' } };
  const compOf = () => 'ours';
  let THEME = RP_THEMES.ours;
  function pitchCanvas(w, h, dpr) {
    const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr; const g = c.getContext('2d'); g.scale(dpr, dpr);
    const sx = w / (105 + 2 * PAD), sy = h / (68 + 2 * PAD);
    g.fillStyle = '#151A22'; g.fillRect(0, 0, w, h);
    g.translate(PAD * sx, PAD * sy); const pw = 105 * sx, ph = 68 * sy;
    g.fillStyle = THEME.pitch; g.fillRect(0, 0, pw, ph);
    for (let i = 0; i < 12; i++) if (i % 2) { g.fillStyle = THEME.stripe; g.fillRect(i * pw / 12, 0, pw / 12, ph); }
    g.strokeStyle = THEME.line; g.lineWidth = 2;
    const R = (x, y, ww, hh) => g.strokeRect(x * sx, y * sy, ww * sx, hh * sy);
    R(0, 0, 105, 68); g.beginPath(); g.moveTo(52.5 * sx, 0); g.lineTo(52.5 * sx, ph); g.stroke();
    g.beginPath(); g.ellipse(52.5 * sx, 34 * sy, 9.15 * sx, 9.15 * sy, 0, 0, 2 * Math.PI); g.stroke();
    R(0, 13.84, 16.5, 40.32); R(88.5, 13.84, 16.5, 40.32); R(0, 24.84, 5.5, 18.32); R(99.5, 24.84, 5.5, 18.32);
    g.beginPath(); g.ellipse(11 * sx, 34 * sy, 9.15 * sx, 9.15 * sy, 0, -.93, .93); g.stroke();
    g.beginPath(); g.ellipse(94 * sx, 34 * sy, 9.15 * sx, 9.15 * sy, 0, Math.PI - .93, Math.PI + .93); g.stroke();
    return c;
  }

  // ---------- popup ----------
  let ST = null;
  async function load(m) {
    const v2 = m.replay_v2;
    if (v2 && v2.file) {
      if (!cache[v2.key]) { try { await loadScript('data/' + v2.file); } catch (e) { /* fall back */ } const P = (window.FC26_REPLAY || {})[v2.key]; if (P) cache[v2.key] = decode(P); }
      if (cache[v2.key]) return { kind: 'v2', D: cache[v2.key] };
    }
    return (m.replay && (m.replay.frames || []).length) ? { kind: 'v1' } : null;
  }
  function teamsOf(m) {
    if (Array.isArray(m.teams) && m.teams[0] && m.teams[0] !== '?') return m.teams;
    const tf = typeof teamsFromTitle === 'function' ? teamsFromTitle(m) : { home: 'COM', away: m.opp || 'TBC' };
    return [tf.home, tf.away];
  }
  const POS_ORDER = ['GK', 'LWB', 'LB', 'LCB', 'CB', 'RCB', 'RB', 'RWB', 'LDM', 'CDM', 'RDM', 'LCM', 'CM', 'RCM', 'LM', 'RM', 'LAM', 'CAM', 'RAM', 'LW', 'RW', 'LF', 'CF', 'RF', 'LS', 'ST', 'RS'];
  const posOf = s => String(s || '').replace(/^opp_/, '').replace(/\d+$/, '');
  // names[] spans (pipeline fix 23 Nov): who a track is, and in which slot, for a sample range; top-level name/slot = fallback
  const spanAt = (tk, s) => { if (tk.names) for (const sp of tk.names) if (sp && s >= sp.from && s <= sp.to) return sp; return null; };
  const nameAt = (tk, s) => { const sp = spanAt(tk, s); return sp ? sp.name : (tk.names ? null : tk.name); };
  const slotAt = (tk, s) => { const sp = spanAt(tk, s); return sp ? sp.slot : tk.slot; };
  const POS_WORD = { GK: 'Goalkeeper', LB: 'Left back', LWB: 'Left wing-back', LCB: 'Left centre-back', CB: 'Centre-back', RCB: 'Right centre-back', RB: 'Right back', RWB: 'Right wing-back',
    CDM: 'Defensive mid', LDM: 'Defensive mid', RDM: 'Defensive mid', LCM: 'Centre mid', CM: 'Centre mid', RCM: 'Centre mid', CAM: 'Attacking mid', LM: 'Left mid', RM: 'Right mid', LW: 'Left wing', RW: 'Right wing', LS: 'Striker', RS: 'Striker', ST: 'Striker' };
  // the XI for a sample window [a, b]: per player, the longest span inside the window (ours); per slot for the opponent
  function lineup(D, team, a, b) {
    const acc = new Map();
    for (const t of D.tracks) { if (t.team !== team || t.died < a || t.born > b) continue;
      const spans = t.names ? t.names.filter(Boolean) : [{ from: t.born, to: t.died, name: t.name, slot: t.slot }];
      for (const sp of spans) { const lo = Math.max(a, sp.from), hi = Math.min(b, sp.to); if (hi < lo) continue; const pos = posOf(sp.slot || ''); if (!pos) continue;
        const key = team === 'us' ? (sp.name || pos) : String(sp.slot || pos); const r = acc.get(key) || { name: team === 'us' ? (sp.name || pos) : (POS_WORD[pos] || pos), slots: new Map(), len: 0 };
        r.len += hi - lo; r.slots.set(pos, (r.slots.get(pos) || 0) + hi - lo); acc.set(key, r); } }
    const rows = [...acc.values()].sort((x, y) => y.len - x.len).slice(0, 11).map(r => ({ name: r.name, pos: [...r.slots.entries()].sort((x, y) => y[1] - x[1])[0][0] }));
    return rows.sort((x, y) => { const ia = POS_ORDER.indexOf(x.pos), ib = POS_ORDER.indexOf(y.pos); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  }
  // Who is ON THE PITCH at minute mn: the replay file names each slot track with the final lineup, so before a sub the
  // track belongs to the player who went off. Day-file substitutions[] (+ players[].label) give the swap and his position.
  let SUBS = [], LABEL = {}, ST_KEYS = null, OPP_NUM = {};
  function rosterFor(m) { SUBS = (m.substitutions || []).filter(x => x.on && x.off && isNum(x.minute)); LABEL = {}; (m.players || []).forEach(p => { if (p.name && p.label) LABEL[p.name] = String(p.label).replace(/2$/, ''); }); }
  function whoAt(name, mn) { if (!name || !isNum(mn)) return name; const on = SUBS.find(x => x.on === name); if (on && mn < on.minute) return on.off; const off = SUBS.find(x => x.off === name); if (off && mn >= off.minute) return off.on; return name; }
  const subPhase = mn => SUBS.filter(x => isNum(mn) && mn >= x.minute).length;
  const kitDot = c => `<i class="kit" style="background:${c}"></i>`;
  function momentsList(m, D) {
    const ev = D.events.filter(e => e.kind === 'goal' || (e.kind === 'shot' && e.observed && (e.xg || 0) >= .15 && !/goal/i.test(e.outcome || ''))).slice(0, 40);
    let gi = -1;
    return ev.map((e, i) => { const us = e.team === 'us', mn = isNum(e.minute) ? Math.floor(e.minute) + '\'' : '';
      const fg = e.kind === 'goal' && typeof factOf === 'function' ? factOf(m.id, `goal_moments[${++gi}]`) : null, blocked = fg && fg.trust === 'blocked';   // facts gate
      const who = e.player || (e.kind === 'goal' ? 'Goal' : 'Shot'), sub = e.kind === 'goal' ? (e.score || '') + (blocked ? ' · build-up not seen' : '') : `xG ${fmt(e.xg, 2)}${e.outcome ? ' · ' + e.outcome : ''}`;
      const icon = e.kind === 'goal' ? '<i class="ico ball"></i>' : '<i class="shotring"></i>';
      return `<button class="mom ${us ? 'home' : 'away'}" data-t="${Math.max(0, e.t - (e.kind === 'goal' ? 8 : 4)).toFixed(1)}"><span class="side l">${us ? `<b>${esc(who)}</b><small>${esc(sub)}</small>` : ''}</span>${us ? icon : ''}<span class="min">${mn}</span>${us ? '' : icon}<span class="side r">${us ? '' : `<b>${esc(who)}</b><small>${esc(sub)}</small>`}</span></button>`; }).join('');
  }
  async function open(m, tStart, origin) {
    const L = await load(m);
    if (!L) { openOverlay(`<div class="rp2-empty">No replay data for this match.</div>`); return; }
    if (L.kind === 'v1') { location.hash = sub({ page: 'match', id: m.id, tab: 'replay' }); return; }
    const D = L.D, [hc, ac] = teamsOf(m), home = m.our_side !== 'away';
    let pauseAt = null;
    if (typeof tStart === 'string' && tStart[0] === 'g') { const gs = D.events.filter(e => e.kind === 'goal'), g = gs[+tStart.slice(1)]; if (g) { tStart = Math.max(0, g.t - 15); pauseAt = g.t + 1.5; } else tStart = 0; }
    if (typeof tStart === 'string' && tStart[0] === 'm') { const mn = +tStart.slice(1) * 100; let i = 0; while (i < D.n && !(D.minute[i] >= mn)) i++; tStart = Math.max(0, i / D.hz - 3); }
    const ourCodeTxt = esc(typeof ourCode === 'function' ? ourCode(m) : 'COM'), oppCodeTxt = esc(typeof oppCode === 'function' ? oppCode(m) : '');
    rosterFor(m);
    const sampleOfMinute = mn => { let i = 0; while (i < D.n && !(D.minute[i] >= mn * 100)) i++; return i; };
    const cuts = [...new Set(SUBS.map(x => x.minute))].sort((x, y) => x - y).map(sampleOfMinute);
    const halfCut = sampleOfMinute(45);
    const winOf = (s0, team) => { const c = team === 'us' ? cuts : [halfCut]; let a = 0, b = D.n - 1; for (const x of c) { if (x <= s0) a = x; else { b = x - 1; break; } } return [a, b]; };
    const keyHtml = (team, s0) => { const [a, b] = winOf(s0, team); return lineup(D, team, a, b).map(r => `<li><i class="disc ${team}${r.pos === 'GK' ? ' gk' : ''}">${esc(String(r.pos).replace(/\d+$/, '').slice(0, 4))}</i><span>${esc(r.name)}</span></li>`).join(''); };
    const s0 = Math.min(D.n - 1, Math.max(0, Math.round((tStart || 0) * D.hz)));
    ST_KEYS = { keyHtml, phase: winOf(s0, 'us')[0] + ':' + winOf(s0, 'them')[0], winOf };
    const comp = compOf(m); THEME = RP_THEMES[comp]; const el = document.createElement('div'); el.className = 'rp2'; el.dataset.comp = comp; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Replay');
    el.innerHTML = `<div class="rp2-dim"></div><div class="rp2-win">
      <button type="button" class="rp2-x" data-close="1" aria-label="Close replay" title="Close (Esc)">${ICON.close}</button>
      <header class="rp2-head"><span class="tm">${esc(teamName(hc))}</span>${kitDot(home ? COL.us : COL.them)}${badge(hc, home, 'sm')}<span class="sc" id="rp2Score">0 : 0</span>${badge(ac, !home, 'sm')}${kitDot(home ? COL.them : COL.us)}<span class="tm">${esc(teamName(ac))}</span><span class="clk" id="rp2Clock">0:00</span></header>
      <aside class="rp2-keys ${home ? 'l' : 'r'}"><h4>${ourCodeTxt}</h4><ul id="rp2KeysUs">${keyHtml('us', s0)}</ul><div class="hum"><span><i class="ring p1"></i>${esc(P1())}</span><span><i class="ring p2"></i>${esc(P2())}</span></div></aside>
      <div class="rp2-stage"><canvas id="rp2Cv"></canvas><div class="rp2-hole" id="rp2Hole">Minimap hidden</div><div class="rp2-dir ${home ? '' : 'left'}">${home ? `${ourCodeTxt} <i class="chev"></i>` : `<i class="chev" style="transform:rotate(180deg)"></i> ${ourCodeTxt}`}</div></div>
      <aside class="rp2-keys ${home ? 'r' : 'l'}"><h4>${oppCodeTxt}</h4><ul id="rp2KeysThem">${keyHtml('them', s0)}</ul></aside>
      <div class="rp2-bar" tabindex="0" role="slider" aria-label="Replay timeline (left / right: 5 s)" aria-valuemin="0" aria-valuemax="${Math.round(D.n / D.hz)}" aria-valuenow="0"><canvas id="rp2Tl"></canvas><div class="rp2-head-mk" id="rp2Mk"></div></div>
      <div class="rp2-ctrl"><button class="btn pri" id="rp2Play">Pause</button><button class="btn" data-j="-10">Back 10 s</button><button class="btn" data-j="10">Forward 10 s</button></div>
      <section class="rp2-moments" hidden><div class="list">${momentsList(m, D)}</div></section>
      <nav class="rp2-tabs stabs" role="tablist"><button class="gl lt" data-tab="-1">LB</button><a class="on" data-tab="pitch" role="tab" tabindex="0" aria-selected="true">Pitch</a><a data-tab="moments" role="tab" tabindex="0" aria-selected="false">Moments</a><button class="gl lt" data-tab="1">RB</button></nav>
    </div>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
    const cv = el.querySelector('#rp2Cv'), tl = el.querySelector('#rp2Tl');
    ST = { origin: origin || document.activeElement, m, D, el, cv, tl, t: Math.max(0, +tStart || 0), speed: 2, playing: true, skip: true, pauseAt, mirror: !home, ring: { p1: null, p2: null }, last: performance.now(), raf: 0, log: null };
    setTimeout(() => { try { prompts(); } catch (e) { /* */ } }, 0);   // the prompt bar shows the popup's own actions (B Close)
    layout(); drawTimeline();
    el.querySelector('#rp2Play').onclick = togglePlay;
    el.querySelectorAll('[data-j]').forEach(b => b.onclick = () => seek(ST.t + +b.dataset.j));
    el.querySelectorAll('.mom').forEach(b => b.onclick = () => { seek(+b.dataset.t); tab('pitch'); });
    const tab = name => { const mo = name === 'moments'; el.querySelector('.rp2-moments').hidden = !mo; el.querySelector('.rp2-stage').hidden = mo; el.querySelectorAll('.rp2-tabs a').forEach(a => { a.classList.toggle('on', a.dataset.tab === name); a.setAttribute('aria-selected', a.dataset.tab === name ? 'true' : 'false'); }); };
    el.querySelectorAll('.rp2-tabs [data-tab]').forEach(x => x.onclick = () => { const v = x.dataset.tab; tab(v === '-1' || v === '1' ? (el.querySelector('.rp2-moments').hidden ? 'moments' : 'pitch') : v); });
    el.querySelectorAll('.rp2-tabs a[data-tab]').forEach(x => x.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); x.click(); } });
    el.querySelector('.rp2-dim').onclick = close;
    const xBtn = el.querySelector('.rp2-x'); if (xBtn) xBtn.onclick = close;
    tl.onpointerdown = e => { const r = tl.getBoundingClientRect(); const go = ev => seek((ev.clientX - r.left) / r.width * D.n / D.hz); go(e); tl.onpointermove = ev => ev.buttons && go(ev); };
    // Keyboard = the pad stand-in (prompt bar keycaps): Enter = A, Esc = B, Z / C = LT / RT speed, X = skip stoppages,
    // Q / E = LB / RB tabs, Space = play / pause, arrows move the focus (left / right seek while the timeline is focused).
    ST.onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key, ae = document.activeElement, inPop = !!(ae && ae !== el && el.contains(ae));
      const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (k === 'Escape' || k === 'Backspace' || k === 'b' || k === 'B') { stop(); close(); }
      else if (k === ' ') { stop(); togglePlay(); }
      else if (/^[zZcC]$/.test(k)) { stop(); speedStep(/[zZ]/.test(k) ? -1 : 1); }
      else if (k === 'x' || k === 'X') { stop(); toggleSkip(); }
      else if (/^[qQeE]$/.test(k)) { stop(); tab(el.querySelector('.rp2-moments').hidden ? 'moments' : 'pitch'); refreshPrompts(); }
      else if (k === 'ArrowLeft' || k === 'ArrowRight') { if (!inPop || ae.classList.contains('rp2-bar')) { stop(); seek(ST.t + (k === 'ArrowLeft' ? -1 : 1) * (inPop ? 5 : 10)); } }
      else if (k === 'Tab') { const f = [...el.querySelectorAll('button:not(.gl), a[href], [tabindex="0"]')].filter(x => x.offsetParent && !x.closest('[hidden]')); if (f.length) { const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } }
      else if (k.length === 1) { stop(); }   // the page's letter keys (Y search, P pre-match ...) never act behind the popup
    };
    addEventListener('keydown', ST.onKey, true); addEventListener('resize', layout);
    ST.raf = requestAnimationFrame(loop);
    setTimeout(() => { const f = el.querySelector('#rp2Play'); if (f) f.focus({ preventScroll: true }); }, 30);
  }
  addEventListener('hashchange', () => { if (ST && !/replay/.test(location.hash)) close(); });
  function close() { if (!ST) return; setTimeout(() => { try { prompts(); } catch (e) { /* */ } }, 0); if (/[&#]tab=replay/.test(location.hash)) { try { history.replaceState(null, '', location.href.split('#')[0] + location.hash.replace(/&tab=replay/, '').replace(/&t=[\d.]+/, '')); } catch (e) { /* */ } } const el = ST.el, origin = ST.origin; setTimeout(() => { try { origin && origin.focus && origin.focus(); } catch (e) { /* gone */ } }, 0); cancelAnimationFrame(ST.raf); removeEventListener('keydown', ST.onKey, true); removeEventListener('resize', layout); el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 360); ST = null; }
  function seek(t) { if (!ST) return; ST.t = Math.max(0, Math.min(ST.D.n / ST.D.hz - .1, t)); ST.ring = { p1: null, p2: null }; }
  // prompt-bar actions (Figma 100:1828, prompt bar 100:2005): A Pause / Play, LT / RT Speed n×, X Skip stoppages: On / Off
  const SPEEDS = [1, 2, 4, 8];
  const refreshPrompts = () => setTimeout(() => { try { prompts(); } catch (e) { /* */ } }, 0);
  function togglePlay() { if (!ST) return; ST.playing = !ST.playing; ST.pauseAt = null; const pb = ST.el.querySelector('#rp2Play'); if (pb) pb.textContent = ST.playing ? 'Pause' : 'Play'; refreshPrompts(); }
  function speedStep(dir, wrap) { if (!ST) return; let i = SPEEDS.indexOf(ST.speed) + (dir < 0 ? -1 : 1); if (wrap) i = (i + SPEEDS.length) % SPEEDS.length; ST.speed = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i))]; refreshPrompts(); }
  function toggleSkip() { if (!ST) return; ST.skip = !ST.skip; refreshPrompts(); }
  function promptSpec(ae) {
    if (!ST) return { a: 'Select', speed: 2, skip: true };
    const onPlay = !ae || ae === document.body || ae.id === 'rp2Play' || !ST.el.contains(ae) || ae.classList.contains('rp2-bar');
    // Figma 6a 224:6561: with the round Close X focused, A closes too ("A Close · B Close")
    const onX = !!(ae && ae.classList && ae.classList.contains('rp2-x'));
    return { a: onX ? 'Close' : onPlay ? (ST.playing ? 'Pause' : 'Play') : 'Select', speed: ST.speed, skip: ST.skip };
  }
  function layout() {
    if (!ST) return; const dpr = Math.min(2, devicePixelRatio || 1), stage = ST.cv.parentElement, bar = ST.tl.parentElement, win = stage.closest('.rp2-win');
    stage.style.width = bar.style.width = ''; const box = stage.getBoundingClientRect(), k = (68 + 2 * PAD) / (105 + 2 * PAD);
    // fit the window between the header and the prompt strip: shrink the pitch (not the rest) when the viewport is short
    let w = Math.max(200, box.width), h = w * k; const mh = parseFloat(getComputedStyle(win).maxHeight), cs = getComputedStyle(win),
      rest = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 3 * parseFloat(cs.rowGap) + (stage.offsetHeight - ST.cv.offsetHeight) + 26 + ['.rp2-head', '.rp2-ctrl'].reduce((a, q) => a + ((win.querySelector(q) || {}).offsetHeight || 0), 0);
    if (mh && innerWidth > 900 && rest + h > mh) { h = Math.max(200 * k, mh - rest - 2); w = h / k; stage.style.width = bar.style.width = w + 'px'; } ST.W = w; ST.H = h; ST.cv.width = w * dpr; ST.cv.height = h * dpr; ST.cv.style.height = h + 'px'; ST.dpr = dpr; ST.pitch = pitchCanvas(w, h, dpr);
    const tb = ST.tl.parentElement.getBoundingClientRect(); ST.tl.width = tb.width * dpr; ST.tl.height = 26 * dpr; ST.tl.style.height = '26px'; drawTimeline();
  }
  function drawTimeline() {
    const { D, tl } = ST, g = tl.getContext('2d'), w = tl.width, h = tl.height, N = D.n;
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, h * .42, w, h * .16);
    for (let x = 0; x < w; x++) { const s = D.scene[Math.floor(x / w * N)]; if (s === 1 || s === 2) { g.fillStyle = 'rgba(160,170,182,.35)'; g.fillRect(x, h * .38, 1, h * .24); } else if (s === 3) { g.fillStyle = 'rgba(160,160,170,.35)'; g.fillRect(x, h * .38, 1, h * .24); } }
    for (const e of D.events) { const x = e.t * D.hz / N * w; if (e.kind === 'goal') { g.fillStyle = e.team === 'us' ? '#1CE471' : COL.them; g.fillRect(x - 1.5, 0, 3, h); } else if (e.kind === 'shot' && e.observed) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - .5, h * .25, 1.5, h * .5); } }
  }
  function frameAt(t) {
    // pure state at time t (seconds since t0): used by the renderer and the self-check
    const { D } = ST, s = Math.min(D.n - 1.001, Math.max(0, t * D.hz)), i0 = Math.floor(s);
    const discs = []; const posById = new Map();
    for (const tk of alive(D, s)) { const ds = trackAt(tk, s, D.smooth); if (!ds) continue; const si = Math.round(s); ds.forEach((d, n) => { d.id = tk.id; d.team = tk.team; d.slot = slotAt(tk, si); d.name = nameAt(tk, si); d.gk = /GK/.test(d.slot || ''); d.part = n; discs.push(d); }); posById.set(tk.id, ds.find(x => !x.held) || ds[ds.length - 1]); }
    let ball = null; const st = D.bstate[i0], own = D.bowner[i0];
    if (D.br) ball = ballAt(D, s, i0, posById);
    else if (st === 2 && own >= 0 && posById.has(own)) { const p = posById.get(own); ball = { x: p.x + .9, y: p.y - .9, a: 1 }; }
    else if (st === 0 || st === 2) ball = null;   // unknown, or "owned" with no known owner: no stray dot
    else { const u = s - i0, i1 = Math.min(i0 + 1, D.n - 1), im = Math.max(0, i0 - 1), ip = Math.min(D.n - 1, i1 + 1), B = D.ball;
      ball = { x: cr(B[2 * im], B[2 * i0], B[2 * i1], B[2 * ip], u), y: cr(B[2 * im + 1], B[2 * i0 + 1], B[2 * i1 + 1], B[2 * ip + 1], u), a: 1 }; }
    if (ST && ST.mirror) {   // away match: the home side (left in the header and keys) attacks right, so we attack left
      const fl = o => { if (o && isNum(o.x)) { o.x = 105 - o.x; o.y = 68 - o.y; } };
      discs.forEach(fl); if (ball) fl(ball); posById.forEach(v => { if (!discs.includes(v)) fl(v); });
    }
    return { s, i0, discs, posById, ball, scene: D.scene[i0], minute: D.minute[i0], hp1: D.p1[i0], hp2: D.p2[i0] };
  }
  // smoothed ball (ball.render): owned on both sides -> on the carrier's disc; otherwise Catmull-Rom on the physics path
  let ARC_I = 0;
  function ballAt(D, s, i0, posById) {
    const B = D.br, i1 = Math.min(i0 + 1, D.n - 1), s0 = B.st[i0], s1 = B.st[i1], u = s - i0, own = D.bowner[i0];
    if (!s0) return null;
    if (s0 === 2 && (s1 === 2 || !s1)) { const p = posById.get(own); return p ? { x: p.x + .9, y: p.y - .9, a: 1, z: 0 } : null; }
    if (!s1) return { x: B.pos[2 * i0], y: B.pos[2 * i0 + 1], a: 1 - u, z: 0 };
    const P = B.pos, im = i0 > 0 && B.st[i0 - 1] ? i0 - 1 : i0, ip = i1 + 1 < D.n && B.st[i1 + 1] ? i1 + 1 : i1;
    const ap = B.ap[i0] + (B.ap[i1] - B.ap[i0]) * u;
    let z = 0; const A = B.arcs;
    if (A.length) { if (ARC_I >= A.length || A[ARC_I][0] > s) ARC_I = 0; while (ARC_I < A.length - 1 && A[ARC_I][1] < s) ARC_I++;
      const r = A[ARC_I]; if (s >= r[0] && s <= r[1]) { const w = (s - r[0]) / Math.max(1, r[1] - r[0]); z = 4 * r[2] * w * (1 - w); } }
    return { x: cr(P[2 * im], P[2 * i0], P[2 * i1], P[2 * ip], u), y: cr(P[2 * im + 1], P[2 * i0 + 1], P[2 * i1 + 1], P[2 * ip + 1], u), a: 1 - APPROX_A * ap, z };
  }
  function ringTo(key, target, now) {
    const R = ST.ring[key];
    if (!target) { ST.ring[key] = null; return null; }
    if (!R) { ST.ring[key] = { x: target.x, y: target.y, id: target.id, from: null }; return ST.ring[key]; }
    if (R.id !== target.id) { R.from = { x: R.x, y: R.y, t: now }; R.id = target.id; }
    if (R.from) { const u = Math.min(1, (now - R.from.t) / RING_SLIDE_MS), e = smooth(u); R.x = R.from.x + (target.x - R.from.x) * e; R.y = R.from.y + (target.y - R.from.y) * e; if (u >= 1) R.from = null; }
    else { R.x = target.x; R.y = target.y; }
    return R;
  }
  function loop(now) {
    if (!ST) return; ST.raf = requestAnimationFrame(loop);
    const dt = ST.fixedDt || Math.min(.25, Math.max(0, (now - ST.last) / 1000)); ST.last = now;   // time-based: a dropped frame advances by its real duration
    if (ST.playing) { ST.t += dt * ST.speed; if (ST.skip) { const i = Math.floor(ST.t * ST.D.hz); const sc = ST.D.scene[i]; if (sc === 1 || sc === 2 || sc === 3) { let j = i; while (j < ST.D.n - 1 && ST.D.scene[j] !== 0) j++; if (j > i) { ST.t = j / ST.D.hz; ST.ring = { p1: null, p2: null }; } } } }
    if (ST.t >= ST.D.n / ST.D.hz - .1) { ST.t = ST.D.n / ST.D.hz - .1; ST.playing = false; }
    if (ST.pauseAt != null && ST.playing && ST.t >= ST.pauseAt) { ST.t = ST.pauseAt; ST.pauseAt = null; ST.playing = false; const pb = ST.el.querySelector('#rp2Play'); if (pb) pb.textContent = 'Play'; refreshPrompts(); }   // stop on the goal
    draw(now);
  }
  function draw(now) {
    const { cv, W, H, dpr } = ST, g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(ST.pitch, 0, 0, W, H);
    const F = frameAt(ST.t), sx = W / (105 + 2 * PAD), sy = H / (68 + 2 * PAD), r = Math.max(1.7 * sx, 10.5), ox = PAD * sx, oy = PAD * sy;
    g.translate(ox, oy);
    const hole = F.scene === 1 || F.scene === 2; ST.el.querySelector('#rp2Hole').classList.toggle('on', hole);
    const dim = hole ? .35 : 1;
    const log = window.__rp && window.__rp.rec ? [] : null;
    g.textAlign = 'center'; g.textBaseline = 'middle'; const fs0 = Math.max(10, 1.3 * sx), fit = r * 1.8;
    for (const d of F.discs) {
      const x = d.x * sx, y = d.y * sy, a = d.a * dim * (1 - GHOST_A * (+d.ghost || 0)); if (a <= .01) continue;
      g.globalAlpha = a;
      if (d.merged) { g.fillStyle = d.team === 'us' ? COL.us : COL.them; g.beginPath(); g.arc(x + r * .35, y - r * .35, r, 0, 7); g.fill(); }
      g.fillStyle = d.team === 'us' ? (d.gk ? COL.gk : COL.us) : (d.gk ? '#F6C35A' : COL.them); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (log) log.push([d.id, d.part || 0, +d.x.toFixed(3), +d.y.toFixed(3), +d.a.toFixed(3), d.hole ? 1 : 0]);
    }
    // labels on top, after every disc; a label whose box would overlap an earlier one is nudged (the disc never moves)
    const placed = [];
    for (const d of F.discs) { const a = d.a * dim * (1 - GHOST_A * (+d.ghost || 0)); if (a <= .3 || d.part) continue;
      const mnow = F.minute >= 0 ? F.minute / 100 : null;
      const lab = posOf(d.slot || '').slice(0, 3); if (!lab) continue; let x = d.x * sx, y = d.y * sy + .5;
      for (let k = 0; k < 3; k++) { const hit = placed.find(p => Math.abs(p[0] - x) < r * 1.5 && Math.abs(p[1] - y) < r * .9); if (!hit) break; y += (y >= hit[1] ? 1 : -1) * r * .95; }
      placed.push([x, y]); g.globalAlpha = a; g.fillStyle = d.team === 'us' ? COL.usText : COL.themText;
      // text never overflows its disc: shrink to fit (never below 10 px); if it still does not fit, it gets a plate like a nudged label
      g.font = `800 ${fs0}px Figtree, sans-serif`; let tw = g.measureText(lab).width;
      if (tw > fit) { g.font = `800 ${Math.max(10, fs0 * fit / tw)}px Figtree, sans-serif`; tw = g.measureText(lab).width; }
      if (Math.abs(y - (d.y * sy + .5)) > 1 || tw > fit) { g.fillStyle = 'rgba(12,15,21,.88)'; { const pw = Math.max(tw + 6, 26), ph = Math.max(r * .9, 15); g.fillRect(x - pw / 2, y - ph / 2, pw, ph); } g.fillStyle = '#fff'; }
      g.fillText(lab, x, y); }
    g.globalAlpha = 1;
    for (const [key, hid] of [['p1', F.hp1], ['p2', F.hp2]]) { const p = hid >= 0 ? F.posById.get(hid) : null; const R = ringTo(key, p ? { x: p.x, y: p.y, id: hid } : null, now); if (!R) continue;
      g.globalAlpha = dim; g.strokeStyle = COL[key]; g.lineWidth = .32 * sx; g.shadowColor = COL[key]; g.shadowBlur = 8; g.beginPath(); g.arc(R.x * sx, R.y * sy, 1.9 * sx, 0, 7); g.stroke(); g.shadowBlur = 0; }
    if (F.ball) { const z = F.ball.z || 0, bx = F.ball.x * sx, by = F.ball.y * sy;
      if (z > .05) { g.globalAlpha = F.ball.a * dim * .35; g.fillStyle = '#000'; g.beginPath(); g.ellipse(bx, by, .62 * sx, .4 * sx, 0, 0, 7); g.fill(); }   // lofted: shadow on the grass, ball lifted and a little bigger
      g.globalAlpha = F.ball.a * dim; g.fillStyle = COL.ball; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.beginPath(); g.arc(bx, by - z * .45 * sy, .62 * sx * (1 + z / 12), 0, 7); g.fill(); g.stroke(); }
    g.globalAlpha = 1; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mn = F.minute >= 0 ? F.minute / 100 : null;
    if (ST_KEYS) { const si = F.i0 || 0, ph = ST_KEYS.winOf(si, 'us')[0] + ':' + ST_KEYS.winOf(si, 'them')[0]; if (ph !== ST_KEYS.phase) { ST_KEYS.phase = ph; const u = ST.el.querySelector('#rp2KeysUs'), t = ST.el.querySelector('#rp2KeysThem'); if (u) u.innerHTML = ST_KEYS.keyHtml('us', si); if (t) t.innerHTML = ST_KEYS.keyHtml('them', si); } }
    ST.el.querySelector('#rp2Clock').textContent = mn == null ? '–' : `${Math.floor(mn)}:${String(Math.floor((mn % 1) * 60)).padStart(2, '0')}`;
    let sc = [0, 0]; for (const e of ST.D.events) if (e.kind === 'goal' && e.t <= ST.t) { if (e.team === 'us') sc[0]++; else sc[1]++; }
    const home = ST.m.our_side !== 'away'; ST.el.querySelector('#rp2Score').textContent = home ? `${sc[0]} : ${sc[1]}` : `${sc[1]} : ${sc[0]}`;
    ST.el.querySelector('#rp2Mk').style.left = (ST.t * ST.D.hz / ST.D.n * 100) + '%';
    if (((now | 0) & 15) === 0) { const bar = ST.el.querySelector('.rp2-bar'); if (bar) bar.setAttribute('aria-valuenow', String(Math.round(ST.t))); }
    if (log) window.__rp.frames.push({ ts: now, t: ST.t, scene: F.scene, discs: log });
  }
  // self-check: 3 s at 1x, 60 fps rAF; reports max per-frame step of fully visible discs, swaps, hole behaviour
  function selfCheck(done) {
    // 180 rendered frames = 3 s at 60 fps and 1x speed (the clock advances exactly 1/60 s per frame so the check is
    // independent of how fast the host paints); timestamps are the real rAF timestamps
    window.__rp = { rec: true, frames: [] }; ST.speed = 1; ST.playing = true; ST.skip = false; ST.fixedDt = 1 / 60;
    // hosts that throttle rAF (headless, background tab): after 1.5 s drive the same loop()/draw() path with 16.7 ms steps
    setTimeout(() => { if (window.__rp.rec && window.__rp.frames.length < 181) { window.__rp.synthetic = true; let ts = performance.now(); while (window.__rp.frames.length < 181) { ts += 1000 / 60; cancelAnimationFrame(ST.raf); loop(ts); } } }, 1500);
    (function wait() { if (window.__rp.frames.length < 181) return requestAnimationFrame(wait); ST.fixedDt = 0;
      const fr = window.__rp.frames; window.__rp.rec = false; let maxStep = 0, steps = [], holeMax = 0, holeFades = 0, n = 0, swaps = 0, dts = [];
      for (let i = 1; i < fr.length; i++) { dts.push(fr[i].ts - fr[i - 1].ts); const prev = new Map(fr[i - 1].discs.filter(d => d[1] === 0).map(d => [d[0], d]));
        const cur = fr[i].discs.filter(d => d[1] === 0);
        for (const d of cur) { const p = prev.get(d[0]); if (!p) continue; const st = Math.hypot(d[2] - p[2], d[3] - p[3]); if (d[5] || p[5]) { if (Math.min(d[4], p[4]) > .2) holeMax = Math.max(holeMax, st); else holeFades++; continue; } if (d[4] > .95 && p[4] > .95) { steps.push(st); maxStep = Math.max(maxStep, st); n++; } }
        // swap test: a disc whose nearest previous disc of the same team is a different track
        for (const d of cur) { let best = null, bd = 1e9; for (const p of fr[i - 1].discs) { if (p[1]) continue; const dd = Math.hypot(d[2] - p[2], d[3] - p[3]); if (dd < bd) { bd = dd; best = p; } } if (best && best[0] !== d[0] && bd < .05 && prev.has(d[0]) && Math.hypot(d[2] - prev.get(d[0])[2], d[3] - prev.get(d[0])[3]) > .5) swaps++; } }
      steps.sort((a, b) => a - b); dts.sort((a, b) => a - b);
      const q = p => steps.length ? steps[Math.min(steps.length - 1, Math.floor(p * steps.length))] : 0;
      done({ synthetic_timestamps: !!window.__rp.synthetic, frames: fr.length, fps: dts.length ? +(1000 / dts[dts.length >> 1]).toFixed(1) : 0, disc_steps: n, step_p50_m: +q(.5).toFixed(3), step_p99_m: +q(.99).toFixed(3), step_max_m: +maxStep.toFixed(3), over_035: steps.filter(s => s > .35).length, swaps, hole_visible_step_max_m: +holeMax.toFixed(3), hole_fade_frames: holeFades, t_from: +fr[0].t.toFixed(2), t_to: +fr[fr.length - 1].t.toFixed(2) });
    })();
  }
  function realCheck(done) {
    window.__rp = { rec: true, frames: [] }; ST.speed = 1; ST.playing = true; ST.skip = false; ST.fixedDt = 0; const t0 = performance.now();
    (function wait(now) { if ((now || performance.now()) - t0 < 3000) return requestAnimationFrame(wait);
      const fr = window.__rp.frames; window.__rp.rec = false; const dts = [], steps = []; let swaps = 0, holeMax = 0;
      for (let i = 1; i < fr.length; i++) { dts.push(fr[i].ts - fr[i - 1].ts); const prev = new Map(fr[i - 1].discs.filter(d => d[1] === 0).map(d => [d[0], d]));
        for (const d of fr[i].discs) { if (d[1]) continue; const p = prev.get(d[0]); if (!p) continue; const st = Math.hypot(d[2] - p[2], d[3] - p[3]);
          if (d[5] || p[5]) { if (Math.min(d[4], p[4]) > .2) holeMax = Math.max(holeMax, st); continue; } if (d[4] > .95 && p[4] > .95) steps.push(st); } }
      dts.sort((a, b) => a - b); steps.sort((a, b) => a - b); const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0;
      const r = { mode: 'real-rAF', frames: fr.length, frame_ms_p50: +q(dts, .5).toFixed(2), frame_ms_p95: +q(dts, .95).toFixed(2), frame_ms_max: +(dts[dts.length - 1] || 0).toFixed(2), step_p50_m: +q(steps, .5).toFixed(3), step_p99_m: +q(steps, .99).toFixed(3), step_max_m: +(steps[steps.length - 1] || 0).toFixed(3), over_035: steps.filter(s => s > .35).length, hole_visible_step_max_m: +holeMax.toFixed(3), frame_times_ms: dts.map(x => +x.toFixed(1)) };
      console.log('RPCHECK-REAL ' + JSON.stringify(r)); done(r); })();
  }
  return { open, close, decode, trackAt, frameAt: t => frameAt(t), selfCheck, realCheck, togglePlay, speedStep, toggleSkip, promptSpec, get state() { return ST; } };
})();

// open the popup from anywhere: data-replay="<matchId>@<seconds>" (Moments rows, goal links, the old Replay tab)
document.addEventListener('click', e => { const a = e.target.closest('[data-replay]'); if (!a) return; e.preventDefault(); const [id, t] = a.dataset.replay.split('@'); ensureDay(id.split('#')[0]).then(() => { const m = matchData(id); if (m) RP2.open(m, /^[mg]/.test(t || '') ? t : (+t || 0), a); }); });
