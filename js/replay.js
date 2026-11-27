/* Radar replay: canvas renderer with rAF interpolation between 4 Hz frames.
   frame = [minute|null, ball|null, p1|null, p2|null, us[[x,y]..], them[[x,y]..]] in 0.1 m ints. */
'use strict';

function mReplay(m, S) {
  const rp = m.replay || {};
  if (!(rp.frames || []).length) return tile('Replay', '<p class="muted">No replay frames for this match.</p>');
  const goals = (m.goals || []).map((g, i) => `<button data-rpj="${(g.minute - 1.2).toFixed(2)}"><i class="dot ${g.team}"></i>${minLabel(g.minute)} ${esc(g.score)}</button>`).join('');
  const shots = ((m.metrics || {}).shots || []).filter(s => isNum(s.minute)).map(s => `<button data-rpj="${(s.minute - .5).toFixed(2)}" data-tip="${esc(s.outcome || '')}${s.shooter ? ' · ' + esc(s.shooter) : ''} · xG ${fmt(s.xg, 2)}"><i class="dot ${s.team}"></i>${minLabel(s.minute)} <span class="muted">${fmt(s.xg, 2)}</span></button>`).join('');
  const notes = (((ledger() || {}).possessions || {})[m.id] || []).filter(n => isNum(n.minute));
  const nt = notes.map(n => `<button data-rpj="${(n.minute - .4).toFixed(2)}" data-tip="${esc(n.detail && n.detail[0] === '{' ? '' : n.detail)}"><i class="dot ${n.team === 'them' ? 'them' : 'us'}"></i>${minLabel(n.minute)} <span class="muted">${esc(n.kind)}</span></button>`).join('');
  const sp = Replay.speed();
  return `<div class="grid g-side">
    <section class="tile flat" style="padding:14px">
      <div class="rp-stage" id="rpStage"><canvas id="rpCv"></canvas>
        <div class="rp-hud"><div class="sb"><span class="clk" id="rpClock">0'</span><span>${esc(m.teams ? m.teams[0] : '')}</span>${badge(m.teams ? m.teams[0] : '', m.our_side === 'home', 'sm')}<span id="rpScore">0 - 0</span>${badge(m.teams ? m.teams[1] : '', m.our_side !== 'home', 'sm')}<span>${esc(m.teams ? m.teams[1] : '')}</span></div></div>
        <div class="rp-hidden hide" id="rpHidden">Radar hidden · replay or menu</div></div>
      <div class="tl" id="rpTl"><canvas id="rpTlc"></canvas><div class="head" id="rpHead"></div><div class="tl-prev" id="rpPrev"><canvas id="rpPc" width="420" height="272"></canvas><span id="rpPt"></span></div></div>
      <div class="ctrls">
        <button class="btn pri" id="rpPlay" title="Play / pause (Space)"><span id="rpPlayI">${ICON.play}</span></button>
        <button class="btn" data-rps="-40" title="Back 10 s (Left arrow)"><span>-10s</span></button><button class="btn" data-rps="40" title="Forward 10 s (Right arrow)"><span>+10s</span></button>
        <div class="seg" id="rpSpeed">${[1, 4, 16].map(s => `<button data-rpv="${s}" class="${s === sp ? 'on' : ''}">${s}×</button>`).join('')}</div>
        <label><input type="checkbox" id="rpSkip" ${Replay.opt('skip') ? 'checked' : ''}> skip hidden</label>
        <label><input type="checkbox" id="rpTrail" ${Replay.opt('trail') ? 'checked' : ''}> ball trail</label>
        <label>heat <select class="sel" id="rpHeat">${[['', 'off'], ['ball', 'ball'], ['p1', P1()], ['p2', P2()], ['us', 'our team'], ['them', 'opponent']].map(([v, l]) => `<option value="${v}" ${Replay.opt('heat') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <span class="spacer"></span><span class="small muted" id="rpReal"></span>
      </div>
    </section>
    <div class="stack">
      ${tile('Jump to', `${goals ? `<div class="lbl" style="margin-bottom:6px">Goals</div><div class="jump">${goals}</div>` : ''}
        ${shots ? `<div class="lbl" style="margin:12px 0 6px">Shots (radar xG)</div><div class="jump">${shots}</div>` : ''}
        ${nt ? `<div class="lbl" style="margin:12px 0 6px">Possession notes</div><div class="jump" style="max-height:220px;overflow:auto">${nt}</div>` : ''}`)}
      ${tile('Legend', `<div class="legend" style="margin:0"><span><i class="dot" style="background:#f4f7fb;border:2px solid #2a63c9"></i>${esc(ourCode(m))}</span><span><i class="dot" style="background:#ff9f2e"></i>${esc(oppCode(m))}</span><span><i class="dot" style="background:#ffe066"></i>ball</span>
        <span><i class="dot" style="background:none;border:2px solid var(--p1)"></i>${esc(P1())}</span><span><i class="dot" style="background:none;border:2px solid var(--p2)"></i>${esc(P2())}</span></div>
        <p class="note">Positions interpolated between 4 Hz radar frames. Timeline: bright = radar visible, ticks = goals (tall) and shots. Hover the timeline to preview, drag to scrub. <span class="kbd">Space</span> play · <span class="kbd">Left</span><span class="kbd">Right</span> 10 s.</p>`)}
    </div></div>`;
}

const Replay = (() => {
  const O = { speed: 4, skip: true, trail: true, heat: '' };
  try { Object.assign(O, JSON.parse(localStorage.getItem('fc26.replay') || '{}')); } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem('fc26.replay', JSON.stringify(O)); } catch (e) { /* ignore */ } };
  let R = null;

  const vis = f => !!(f && f[4] && f[4].length >= 3);
  function prep(m) {
    const F = m.replay.frames, n = F.length;
    const nextVis = new Int32Array(n + 1); nextVis[n] = -1;
    for (let i = n - 1; i >= 0; i--) nextVis[i] = vis(F[i]) ? i : nextVis[i + 1];
    const mins = new Float32Array(n); let last = NaN;
    for (let i = 0; i < n; i++) { if (F[i] && isNum(F[i][0])) last = F[i][0]; mins[i] = last; }
    let nx = NaN; for (let i = n - 1; i >= 0; i--) { if (isNaN(mins[i])) mins[i] = nx; else nx = isNaN(nx) ? mins[i] : nx; }
    for (let i = 0; i < n; i++) if (isNaN(mins[i])) mins[i] = 0;
    return { F, n, nextVis, mins, hz: m.replay.hz || 4 };
  }
  function frameAtMinute(mn) {
    for (let i = 0; i < R.n; i++) if (R.mins[i] >= mn) { const v = R.nextVis[i]; return v >= 0 ? v : i; }
    return Math.max(0, R.nextVis[0]);
  }
  // nearest-neighbour matching of icon lists between consecutive frames
  const mcache = new Map();
  function matchIdx(i, side) {
    const key = i * 2 + side; if (mcache.has(key)) return mcache.get(key);
    const a = (R.F[i] || [])[4 + side] || [], b = (R.F[i + 1] || [])[4 + side] || [];
    const res = new Array(a.length).fill(-1), used = new Array(b.length).fill(false), pairs = [];
    for (let x = 0; x < a.length; x++) for (let y = 0; y < b.length; y++) { if (!a[x] || !b[y]) continue; const d = Math.hypot(a[x][0] - b[y][0], a[x][1] - b[y][1]); if (d < 110) pairs.push([d, x, y]); }
    pairs.sort((p, q) => p[0] - q[0]);
    pairs.forEach(([, x, y]) => { if (res[x] < 0 && !used[y]) { res[x] = y; used[y] = true; } });
    if (mcache.size > 4000) mcache.clear();
    mcache.set(key, res); return res;
  }
  const lerp = (a, b, t) => (!a ? null : !b || Math.hypot(a[0] - b[0], a[1] - b[1]) > 150 ? (t < .5 || !b ? a : b) : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);

  function colors() { return { us: '#f4f7fb', usS: '#2a63c9', them: '#ff9f2e', themS: '#4a2a00', p1: cssv('--p1'), p2: cssv('--p2') }; }

  // pitch (cached offscreen) - world box -2..107 x -2..70 m
  function pitchCanvas(w, h, dpr, heat) {
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = w / 109, X = v => (v + 2) * s;
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0e3a2d'); g.addColorStop(1, '#0a2c22');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) if (i % 2) { x.fillStyle = 'rgba(255,255,255,.028)'; x.fillRect(X(i * 105 / 12), X(0), 105 / 12 * s, 68 * s); }
    if (heat) {
      x.save(); x.filter = `blur(${Math.max(4, s * 2.2)}px)`;
      const { grid, gw, gh, mx, col } = heat;
      for (let r = 0; r < gh; r++) for (let q = 0; q < gw; q++) { const v = grid[r * gw + q]; if (!v) continue; x.globalAlpha = Math.min(.85, Math.pow(v / mx, .55) * .85); x.fillStyle = col; x.fillRect(X(q * 105 / gw), X(r * 68 / gh), 105 / gw * s + 1, 68 / gh * s + 1); }
      x.restore(); x.globalAlpha = 1;
    }
    x.strokeStyle = 'rgba(215,255,238,.42)'; x.lineWidth = Math.max(1, s * .14);
    const L = (a, b, c2, d) => { x.beginPath(); x.moveTo(X(a), X(b)); x.lineTo(X(c2), X(d)); x.stroke(); };
    x.strokeRect(X(0), X(0), 105 * s, 68 * s); L(52.5, 0, 52.5, 68);
    x.beginPath(); x.arc(X(52.5), X(34), 9.15 * s, 0, 7); x.stroke();
    x.strokeRect(X(0), X(13.84), 16.5 * s, 40.32 * s); x.strokeRect(X(88.5), X(13.84), 16.5 * s, 40.32 * s);
    x.strokeRect(X(0), X(24.84), 5.5 * s, 18.32 * s); x.strokeRect(X(99.5), X(24.84), 5.5 * s, 18.32 * s);
    x.beginPath(); x.arc(X(11), X(34), 9.15 * s, -0.93, 0.93); x.stroke(); x.beginPath(); x.arc(X(94), X(34), 9.15 * s, Math.PI - 0.93, Math.PI + 0.93); x.stroke();
    x.fillStyle = 'rgba(215,255,238,.5)'; x.fillRect(X(-1.2), X(30.34), 1.2 * s, 7.32 * s); x.fillRect(X(105), X(30.34), 1.2 * s, 7.32 * s);
    return c;
  }
  function heatGrid(kind) {
    const gw = 42, gh = 27, grid = new Float32Array(gw * gh);
    const add = p => { if (!p) return; const q = clamp(Math.floor(p[0] / 1050 * gw), 0, gw - 1), r = clamp(Math.floor(p[1] / 680 * gh), 0, gh - 1); grid[r * gw + q]++; };
    R.F.forEach(f => {
      if (!vis(f)) return;
      if (kind === 'ball') add(f[1]); else if (kind === 'p1') add(f[2]); else if (kind === 'p2') add(f[3]);
      else if (kind === 'us') (f[4] || []).forEach(add); else if (kind === 'them') (f[5] || []).forEach(add);
    });
    let mx = 0; grid.forEach(v => { if (v > mx) mx = v; });
    const C = colors();
    return { grid, gw, gh, mx: mx || 1, col: { ball: '#ffffff', p1: C.p1, p2: C.p2, us: C.us, them: C.them }[kind] };
  }

  function draw(ctx, w, pos, o = {}) {
    const s = w / 109, X = v => (v / 10 + 2) * s;
    const i = clamp(Math.floor(pos), 0, R.n - 1), t = o.static ? 0 : pos - i;
    const f = R.F[i], g = vis(R.F[i + 1]) ? R.F[i + 1] : null;
    ctx.drawImage(o.pitch, 0, 0, w, o.h);
    if (!vis(f)) return false;
    const C = R.C, rad = Math.max(3.2, s * .95);
    // trail
    if (O.trail && !o.static) {
      const pts = [];
      for (let k = Math.max(0, i - 14); k <= i; k++) { const b = R.F[k] && R.F[k][1]; if (b) pts.push(b); else pts.length = 0; }
      const cur = lerp(f[1], g && g[1], t); if (cur) pts.push(cur);
      ctx.lineCap = 'round';
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 300) continue;
        ctx.globalAlpha = 0.08 + 0.6 * k / pts.length; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.2, s * (.15 + .3 * k / pts.length));
        ctx.beginPath(); ctx.moveTo(X(a[0]), X(a[1])); ctx.lineTo(X(b[0]), X(b[1])); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const team = (side, fill, stroke) => {
      const A = f[4 + side] || [], B = g ? (g[4 + side] || []) : [], mi = g && !o.static ? matchIdx(i, side) : null;
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, s * .22);
      A.forEach((p, k) => {
        if (!p) return;
        const q = mi && mi[k] >= 0 ? lerp(p, B[mi[k]], t) : p;
        ctx.beginPath(); ctx.arc(X(q[0]), X(q[1]), rad, 0, 7); ctx.fill(); ctx.stroke();
      });
    };
    team(1, C.them, C.themS);
    team(0, C.us, C.usS);
    const ring = (p, col, label) => {
      if (!p) return;
      const x = X(p[0]), y = X(p[1]);
      ctx.beginPath(); ctx.arc(x, y, rad * 2, 0, 7); ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, s * .45); ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
      if (!o.static && label) {
        ctx.font = `700 ${Math.max(10, s * 1.5)}px Bahnschrift, sans-serif`; ctx.textAlign = 'center';
        const tw = ctx.measureText(label).width + 8, th = Math.max(13, s * 1.9);
        ctx.fillStyle = col; ctx.fillRect(x - tw / 2, y - rad * 2 - th - 3, tw, th);
        ctx.fillStyle = '#06101f'; ctx.fillText(label, x, y - rad * 2 - 6);
      }
    };
    ring(lerp(f[2], g && g[2], t), C.p1, R.n1);
    ring(lerp(f[3], g && g[3], t), C.p2, R.n2);
    const b = lerp(f[1], g && g[1], t);
    if (b) { const x = X(b[0]), y = X(b[1]); ctx.beginPath(); ctx.arc(x, y, Math.max(3, rad * .72), 0, 7); ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 1.2; ctx.strokeStyle = '#06101f'; ctx.stroke(); }
    return true;
  }

  function layout() {
    const cv = $('#rpCv'); if (!cv || !R) return;
    const dpr = window.devicePixelRatio || 1, w = cv.parentNode.clientWidth || 800, h = Math.round(w * 72 / 109);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    R.ctx = cv.getContext('2d'); R.w = w; R.h = h; R.dpr = dpr;
    R.pitch = pitchCanvas(w, h, dpr, O.heat ? heatGrid(O.heat) : null);
    R.pitchSm = pitchCanvas(210, 136, 2, null);
    drawTimeline();
  }
  function drawTimeline() {
    const c = $('#rpTlc'); if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 800, h = 34;
    c.width = Math.round(w * dpr); c.height = h * dpr;
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = i => i / Math.max(1, R.n - 1) * w;
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, 12, w, 10);
    let st = -1;
    for (let i = 0; i <= R.n; i++) {
      const v = i < R.n && vis(R.F[i]);
      if (v && st < 0) st = i;
      if (!v && st >= 0) { const gr = x.createLinearGradient(0, 12, 0, 22); gr.addColorStop(0, '#3e8cff'); gr.addColorStop(1, '#1d4fb8'); x.fillStyle = gr; x.fillRect(X(st), 12, Math.max(1, X(i) - X(st)), 10); st = -1; }
    }
    (((R.m.metrics || {}).shots) || []).forEach(s2 => { if (!isNum(s2.minute)) return; const i = frameAtMinute(s2.minute); x.fillStyle = s2.team === 'us' ? '#cfe0ff' : '#ffd08a'; x.fillRect(X(i) - .75, s2.team === 'us' ? 6 : 22, 1.5, 6); });
    (R.m.goals || []).forEach(gl => { const i = frameAtMinute(gl.minute - .3); x.fillStyle = gl.team === 'us' ? cssv('--us') : cssv('--them'); x.fillRect(X(i) - 1.5, 0, 3, h); x.beginPath(); x.arc(X(i), 4, 4, 0, 7); x.fill(); });
    x.fillStyle = 'rgba(255,255,255,.35)'; x.font = '600 10px Bahnschrift, sans-serif'; x.textAlign = 'center';
    [0, 45, 90].forEach(mn => { const i = frameAtMinute(mn); x.fillText(mn === 45 ? 'HT' : mn + "'", clamp(X(i), 10, w - 12), 33); });
  }
  function hud() {
    if (!R) return;
    const i = clamp(Math.floor(R.pos), 0, R.n - 1), t = R.pos - i;
    const mn = R.mins[i] + (i + 1 < R.n ? (R.mins[i + 1] - R.mins[i]) * t : 0);
    const gs = (R.m.goals || []).filter(g2 => g2.minute <= mn + .05);
    const us = gs.filter(g2 => g2.team === 'us').length, th = gs.length - us;
    const home = R.m.our_side === 'home';
    const cl = $('#rpClock'); if (!cl) return;
    cl.textContent = Math.floor(mn) + "'";
    $('#rpScore').textContent = home ? `${us} – ${th}` : `${th} – ${us}`;
    const secs = R.pos / R.hz;
    $('#rpReal').textContent = `real ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')} / ${Math.floor(R.n / R.hz / 60)}:${String(Math.floor(R.n / R.hz % 60)).padStart(2, '0')}`;
    $('#rpHead').style.left = (R.pos / Math.max(1, R.n - 1) * 100) + '%';
    $('#rpPlayI').innerHTML = R.playing ? ICON.pause : ICON.play;
    R.mn = mn;
    const now = performance.now();
    if (!R.playing || now - (R.lastHash || 0) > 1000) { R.lastHash = now; setHashQuiet({ t: mn.toFixed(1) }); }
  }
  function frame() {
    if (!R || !R.ctx) return;
    R.ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const ok = draw(R.ctx, R.w, R.pos, { pitch: R.pitch, h: R.h });
    $('#rpHidden').classList.toggle('hide', ok);
    hud();
  }
  function tick(now) {
    if (!R || !R.playing) return;
    const dt = clamp((now - R.last) / 1000, 0, 0.1); R.last = now;
    R.pos += dt * R.hz * O.speed;
    if (O.skip) {
      const i = Math.floor(R.pos);
      if (i < R.n && !vis(R.F[i])) { const nv = R.nextVis[i]; R.pos = nv >= 0 ? nv : R.n - 1; }
    }
    if (R.pos >= R.n - 1) { R.pos = R.n - 1; R.playing = false; }
    frame();
    if (R.playing) R.raf = requestAnimationFrame(tick);
  }
  function play(on) {
    if (!R) return;
    R.playing = on == null ? !R.playing : on;
    cancelAnimationFrame(R.raf);
    if (R.playing) { if (R.pos >= R.n - 2) R.pos = Math.max(0, R.nextVis[0]); R.last = performance.now(); R.raf = requestAnimationFrame(tick); }
    frame();
  }
  function seek(pos, keepPlaying) {
    R.pos = clamp(pos, 0, R.n - 1);
    if (!vis(R.F[Math.floor(R.pos)])) { const nv = R.nextVis[Math.floor(R.pos)]; if (nv >= 0 && O.skip) R.pos = nv; }
    if (!keepPlaying) frame(); else frame();
  }
  function preview(e) {
    const tl = $('#rpTl'), pv = $('#rpPrev'); if (!tl || !pv) return;
    const r = tl.getBoundingClientRect(), k = clamp((e.clientX - r.left) / r.width, 0, 1), i = Math.round(k * (R.n - 1));
    const vi = vis(R.F[i]) ? i : (R.nextVis[i] >= 0 ? R.nextVis[i] : i);
    const pc = $('#rpPc'), x = pc.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0);
    const ok = draw(x, 210, vi, { pitch: R.pitchSm, h: 136, static: true });
    if (!ok) { x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, 0, 210, 136); }
    $('#rpPt').textContent = `${Math.floor(R.mins[i])}'${ok ? '' : ' · hidden'}`;
    pv.style.display = 'block';
    pv.style.left = clamp(e.clientX - r.left - 105, 0, r.width - 212) + 'px';
    return i;
  }
  function onKey(e) {
    if (!R || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); play(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seek(R.pos + 40); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(R.pos - 40); }
  }
  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { layout(); frame(); }, 120); };

  function init(m, S) {
    stop();
    R = { m, ...prep(m), pos: 0, playing: false, C: colors(), n1: P1(), n2: P2() };
    R.pos = S.t != null && isFinite(+S.t) ? frameAtMinute(+S.t) : Math.max(0, R.nextVis[0]);
    layout(); frame();
    const root = $('.tabbody');
    root.addEventListener('click', e => {
      const b = e.target.closest('#rpPlay'); if (b) return play();
      const j = e.target.closest('[data-rpj]'); if (j) { seek(frameAtMinute(+j.dataset.rpj)); return play(true); }
      const s = e.target.closest('[data-rps]'); if (s) return seek(R.pos + +s.dataset.rps);
      const v = e.target.closest('[data-rpv]'); if (v) { O.speed = +v.dataset.rpv; save(); $$('#rpSpeed button').forEach(x => x.classList.toggle('on', x === v)); }
    });
    root.addEventListener('change', e => {
      if (e.target.id === 'rpSkip') { O.skip = e.target.checked; save(); }
      if (e.target.id === 'rpTrail') { O.trail = e.target.checked; save(); frame(); }
      if (e.target.id === 'rpHeat') { O.heat = e.target.value; save(); layout(); frame(); }
    });
    const tl = $('#rpTl'); let drag = false, was = false;
    tl.addEventListener('pointerdown', e => { drag = true; was = R.playing; R.playing = false; tl.setPointerCapture(e.pointerId); const i = preview(e); seek(i); });
    tl.addEventListener('pointermove', e => { const i = preview(e); if (drag) seek(i); });
    tl.addEventListener('pointerup', e => { drag = false; if (was) play(true); });
    tl.addEventListener('pointerleave', () => { if (!drag) $('#rpPrev').style.display = 'none'; });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.__replay = R;
  }
  function stop() {
    if (R) { R.playing = false; cancelAnimationFrame(R.raf); }
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    R = null; mcache.clear();
  }
  return { init, stop, speed: () => O.speed, opt: k => O[k], play, seek, state: () => R };
})();
