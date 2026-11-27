/* Charts & pitch drawings (SVG strings). Pitch coordinates: metres, 105 x 68, our goal at x=0. */
'use strict';
const PW = 105, PH = 68;

function pitchLines() {
  const L = 'class="pitch-line"';
  let stripes = '';
  for (let i = 0; i < 10; i++) if (i % 2) stripes += `<rect x="${i * 10.5}" y="0" width="10.5" height="${PH}" fill="rgba(255,255,255,.025)"/>`;
  return `<rect class="pitch-bg" x="0" y="0" width="${PW}" height="${PH}"/>${stripes}
  <rect ${L} x="0" y="0" width="${PW}" height="${PH}"/>
  <line ${L} x1="52.5" y1="0" x2="52.5" y2="${PH}"/>
  <circle ${L} cx="52.5" cy="34" r="9.15"/><circle cx="52.5" cy="34" r=".5" fill="var(--pitch-line)"/>
  <rect ${L} x="0" y="13.84" width="16.5" height="40.32"/><rect ${L} x="88.5" y="13.84" width="16.5" height="40.32"/>
  <rect ${L} x="0" y="24.84" width="5.5" height="18.32"/><rect ${L} x="99.5" y="24.84" width="5.5" height="18.32"/>
  <path ${L} d="M16.5 26.7 A9.15 9.15 0 0 1 16.5 41.3"/><path ${L} d="M88.5 26.7 A9.15 9.15 0 0 0 88.5 41.3"/>
  <path ${L} d="M0 1 A1 1 0 0 0 1 0 M104 0 A1 1 0 0 0 105 1 M105 67 A1 1 0 0 0 104 68 M1 68 A1 1 0 0 0 0 67"/>
  <circle cx="11" cy="34" r=".4" fill="var(--pitch-line)"/><circle cx="94" cy="34" r=".4" fill="var(--pitch-line)"/>
  <rect x="-1.2" y="30.34" width="1.2" height="7.32" fill="var(--pitch-line)"/><rect x="105" y="30.34" width="1.2" height="7.32" fill="var(--pitch-line)"/>`;
}
// FC 26 orientation rule (Leon, level-1 gate): position / heat / tactics pitches are VERTICAL, own goal at the bottom,
// attack up (the game's Player Performance and tactics boards). Data stays normalised "we attack left->right" (x along
// the length); the vertical view rotates it: X' = y, Y' = 105 - x. Pass {horizontal:true} only for radar-style views.
function pitchSVG(inner, o = {}) {
  if (o.horizontal) {
    const arrow = o.noArrow ? '' : `<text x="52.5" y="${PH + 4.3}" text-anchor="middle" style="font-size:2.4px;fill:var(--muted);letter-spacing:.3px">ATTACKING</text><path d="M60.5 69.1 L63.3 70.4 L60.5 71.7 Z" fill="var(--muted)"/>`;
    return `<svg viewBox="-1.5 -1 ${PW + 3} ${PH + (o.noArrow ? 2 : 6)}" ${o.attrs || ''}>${pitchLines()}${inner}${o.overlay || ''}${arrow}</svg>`;
  }
  const lab = o.noArrow ? '' : `<text x="1.6" y="3.6" style="font-size:2.6px;font-weight:700;fill:var(--color-text-label-on-smoke);letter-spacing:.2px">ATTACK</text><path d="M13.2 3.6 L14.6 1 L16 3.6 Z" fill="var(--color-text-label-on-smoke)"/>`;
  return `<svg class="v" viewBox="-1.5 -2 ${PH + 3} ${PW + 4}" ${o.attrs || ''}><g transform="matrix(0,-1,1,0,0,${PW})">${pitchLines()}${inner}</g>${o.overlay || ''}${lab}</svg>`;
}
// screen point of a pitch point (x along the attack, y across) on the vertical pitch: text drawn there stays upright
function pitchPt(x, y, horizontal) { return horizontal ? [x, y] : [y, PW - x];
}
// heat grid -> blurred cells. heat: rows x cols of shares.
let _hid = 0;
function heatCells(heat, color, o = {}) {
  if (!heat || !heat.length || !heat[0]) return '';
  const rows = heat.length, cols = heat[0].length, cw = PW / cols, ch = PH / rows;
  const mx = o.max || Math.max(...heat.flat().filter(isNum)) || 1;
  const id = 'hb' + (++_hid);
  let s = `<defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${o.blur ?? 1.8}"/></filter></defs><g filter="url(#${id})">`;
  heat.forEach((r, i) => r.forEach((v, j) => {
    if (v > 0) s += `<rect x="${(j * cw).toFixed(2)}" y="${(i * ch).toFixed(2)}" width="${(cw + .05).toFixed(2)}" height="${(ch + .05).toFixed(2)}" fill="${color}" fill-opacity="${Math.min(.95, Math.pow(v / mx, .6) * .95).toFixed(2)}"/>`;
  }));
  return s + '</g>';
}
function addHeat(a, b, w = 1) {
  if (!b) return a;
  if (!a) return b.map(r => r.map(v => (v || 0) * w));
  return a.map((r, i) => r.map((v, j) => v + ((b[i] || [])[j] || 0) * w));
}

// generic line chart: series [{name,color,values[],dash,area}], labels[]; HTML overlay for text
function lineChart(o) {
  const H = o.h || 160, W = 1000, pl = 0, n = o.labels.length;
  const all = o.series.flatMap(s => s.values).filter(isNum);
  let lo = o.min != null ? o.min : Math.min(...all), hi = o.max != null ? o.max : Math.max(...all);
  if (!all.length) return '<div class="empty">No data yet</div>';
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const top = 14, bot = 26, X = i => n <= 1 ? W / 2 : 30 + i * (W - 60) / (n - 1), XP = i => X(i) / W * 100;
  const Y = v => top + (1 - (v - lo) / (hi - lo)) * (H - top - bot);
  let s = '', ov = '';
  (o.grid || []).forEach(g => { s += `<line x1="0" x2="${W}" y1="${Y(g)}" y2="${Y(g)}" stroke="rgba(140,175,240,.12)" vector-effect="non-scaling-stroke"/>`; ov += `<span class="ov" style="left:0;top:${Y(g) - 8}px">${o.fmt ? o.fmt(g) : g}</span>`; });
  if (o.band) s += `<rect x="0" width="${W}" y="${Y(o.band[1])}" height="${Y(o.band[0]) - Y(o.band[1])}" fill="rgba(62,224,143,.08)"/>`;
  o.series.forEach(se => {
    const pts = se.values.map((v, i) => isNum(v) ? [X(i), Y(v)] : null);
    const segs = []; let cur = [];
    pts.forEach(p => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
    if (cur.length) segs.push(cur);
    segs.forEach(sg => {
      if (se.area && sg.length > 1) s += `<path d="M${sg[0][0]},${H - bot}L${sg.map(p => p.join(',')).join('L')}L${sg[sg.length - 1][0]},${H - bot}Z" fill="${se.color}" fill-opacity=".12"/>`;
      if (sg.length > 1) s += `<path d="M${sg.map(p => p.join(',')).join('L')}" fill="none" stroke="${se.color}" stroke-width="2.4" ${se.dash ? 'stroke-dasharray="6 5"' : ''} vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    });
    se.values.forEach((v, i) => {
      if (!isNum(v)) return;
      ov += `<span class="ov ov-dot" style="left:${XP(i)}%;top:${Y(v)}px;transform:translate(-50%,-50%);background:${se.color};${se.dash ? 'width:8px;height:8px' : ''}" data-tip="<b>${esc(o.labels[i])}</b><br>${esc(se.name)}: ${o.fmt ? o.fmt(v) : fmt(v, 1)}"></span>`;
      if (o.valueLabels && !se.dash) ov += `<span class="ov ink" style="left:${XP(i)}%;top:${Y(v) - 13}px;transform:translateX(-50%)">${o.fmt ? o.fmt(v) : fmt(v, 1)}</span>`;
    });
  });
  o.labels.forEach((l, i) => { if (n < 16 || i % Math.ceil(n / 12) === 0) ov += `<span class="ov" style="left:${XP(i)}%;top:${H - 12}px;transform:translateX(-50%)">${l}</span>`; });
  const legend = o.legend === false ? '' : `<div class="legend">${o.series.map(se => `<span><i class="sw" style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
  return `<div class="chart" style="height:${H}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${s}</svg>${ov}</div>${legend}`;
}

// mirrored bars (for, against) per match with goal markers
function mirrorChart(items, o = {}) {
  const H = o.h || 190, W = 1000, n = items.length;
  if (!n) return '<div class="empty">No matches yet</div>';
  const mid = H / 2 - 8, amp = mid - 16;
  const mx = Math.max(1, ...items.flatMap(it => [it.a, it.b, it.ga, it.gb].filter(isNum)));
  const bw = Math.min(70, (W - 40) / n * 0.55), X = i => 20 + (i + .5) * (W - 40) / n, XP = i => X(i) / W * 100;
  let s = `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="rgba(140,175,240,.3)" vector-effect="non-scaling-stroke"/>`, ov = '';
  items.forEach((it, i) => {
    const ha = isNum(it.a) ? it.a / mx * amp : 0, hb = isNum(it.b) ? it.b / mx * amp : 0;
    s += `<rect x="${X(i) - bw / 2}" y="${mid - ha}" width="${bw}" height="${ha}" fill="url(#gUs)"/>`;
    s += `<rect x="${X(i) - bw / 2}" y="${mid + 1}" width="${bw}" height="${hb}" fill="url(#gThem)"/>`;
    s += `<rect class="chart-hit" x="${X(i) - (W - 40) / n / 2}" y="0" width="${(W - 40) / n}" height="${H}"></rect>`;
    if (isNum(it.ga)) ov += `<span class="ov ov-dot ring" style="left:${XP(i)}%;top:${mid - it.ga / mx * amp}px;transform:translate(-50%,-50%)" data-tip="<b>${esc(it.label)}</b><br>Goals ${it.ga}–${it.gb} · xG ${fmt(it.a, 1)}–${fmt(it.b, 1)}"></span>`;
    if (isNum(it.gb)) ov += `<span class="ov ov-dot" style="background:#ffe2b0;left:${XP(i)}%;top:${mid + it.gb / mx * amp}px;transform:translate(-50%,-50%)" data-tip="<b>${esc(it.label)}</b><br>Goals ${it.ga}–${it.gb} · xG ${fmt(it.a, 1)}–${fmt(it.b, 1)}"></span>`;
    ov += `<a class="ov" href="${it.href}" style="pointer-events:auto;left:${XP(i)}%;top:${H - 10}px;transform:translate(-50%,-50%);display:flex;gap:4px;align-items:center;color:var(--ink2)">${resChip(it.res)}${n <= 12 ? esc(it.short) : ''}</a>`;
  });
  return `<div class="chart" style="height:${H}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">
    <defs><linearGradient id="gUs" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#139a52"/><stop offset="1" stop-color="#30e57c"/></linearGradient>
    <linearGradient id="gThem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f7f95"/><stop offset="1" stop-color="#30d5f2"/></linearGradient></defs>${s}</svg>${ov}</div>
    <div class="legend"><span><i class="sw" style="background:var(--us)"></i>xG for (up)</span><span><i class="sw" style="background:var(--them)"></i>xG against (down)</span><span><i class="dot ring"></i>goals</span></div>`;
}

// spider / radar chart. axes [{label}], series [{values (0..max), color, name}]
function spider(axes, series, o = {}) {
  const R = 100, cx = 130, cy = 120, n = axes.length, max = o.max || 100;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = clamp(v / max, 0, 1) * R; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  let s = '';
  [.25, .5, .75, 1].forEach(k => { s += `<polygon points="${axes.map((_, i) => pt(i, max * k).join(',')).join(' ')}" fill="${k === 1 ? 'rgba(255,255,255,.03)' : 'none'}" stroke="rgba(140,175,240,${k === 1 ? .35 : .14})"/>`; });
  axes.forEach((a, i) => { const [x, y] = pt(i, max); s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(140,175,240,.14)"/>`; });
  series.forEach((se, k) => {
    const pts = se.values.map((v, i) => pt(i, isNum(v) ? v : 0).join(',')).join(' ');
    s += `<polygon points="${pts}" fill="${se.color}" fill-opacity="${k ? .12 : .28}" stroke="${se.color}" stroke-width="2" ${se.dash ? 'stroke-dasharray="5 4"' : ''} class="spider-poly"/>`;
    se.values.forEach((v, i) => { if (isNum(v)) { const [x, y] = pt(i, v); s += `<circle cx="${x}" cy="${y}" r="3" fill="${se.color}" data-tip="${esc(se.name)} ${esc(axes[i].label)}: ${fmt(se.raw ? se.raw[i] : v, se.d || 0)}"></circle>`; } });
  });
  axes.forEach((a, i) => {
    const [x, y] = pt(i, max * 1.2);
    const v0 = series[0] && (series[0].raw || series[0].values)[i];
    s += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" style="font:700 11px var(--fh);fill:var(--ink2);letter-spacing:.08em">${esc(a.label)}</text>`;
    if (isNum(v0) && o.showVal) s += `<text x="${x}" y="${y + 13}" text-anchor="middle" style="font:700 12px var(--fh);fill:#fff">${fmt(v0, o.d || 0)}</text>`;
  });
  return `<svg viewBox="0 0 260 245" style="width:100%;max-width:${o.w || 340}px;display:block;margin:0 auto">${s}</svg>`;
}

// small bar sparkline (values with threshold), returns inline SVG
function sparkBars(vals, o = {}) {
  const W = o.w || 90, H = o.h || 26, n = vals.length || 1, bw = Math.max(3, W / n - 3);
  const nums = vals.map(v => isNum(v && v.v) ? v.v : null);
  const hi = Math.max(o.max || 0, ...nums.filter(isNum), o.thr || 0) || 1;
  let s = '';
  vals.forEach((v, i) => {
    if (!v || !isNum(v.v)) return;
    const h = Math.max(2, v.v / hi * (H - 2));
    s += `<rect x="${i * (W / n) + 1}" y="${H - h}" width="${bw}" height="${h}" fill="${v.bad ? 'var(--bad)' : 'var(--acc2)'}" opacity="${v.bad ? .95 : .7}"${v.t ? ` data-tip="${esc(v.t)}"` : ''}></rect>`;
  });
  if (isNum(o.thr)) s += `<line x1="0" x2="${W}" y1="${H - o.thr / hi * (H - 2)}" y2="${H - o.thr / hi * (H - 2)}" stroke="var(--good)" stroke-dasharray="2 2"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;overflow:visible">${s}</svg>`;
}

// rating form strip (chips)
function formStrip(form, n = 5) {
  const f = (form || []).slice(-n);
  if (!f.length) return '<span class="muted">–</span>';
  return `<span class="row" style="gap:2px;flex-wrap:nowrap">${f.map(r => `<span class="rt ${rtCls(r)}" style="min-width:26px;padding:2px 3px;font-size:11px">${fmt(r, 1)}</span>`).join('')}</span>`;
}

// momentum chart (per match)
function momentumChart(m, h, o = {}) {
  const W = 1000, mid = h / 2, X = mn => clamp(mn, 0, 95) / 95 * W, XP = mn => clamp(mn, 0, 95) / 95 * 100, amp = mid - (o.pad || 6);
  const bins = m.momentum || [];
  const mx = Math.max(0.15, ...bins.map(b => Math.abs(b.momentum || 0)));
  let s = `<line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="rgba(140,175,240,.3)" vector-effect="non-scaling-stroke"/>`, ov = '';
  if (o.axis) {
    s += `<line x1="${X(45)}" y1="0" x2="${X(45)}" y2="${h}" stroke="rgba(140,175,240,.25)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>`;
    [0, 15, 30, 45, 60, 75, 90].forEach(t => { ov += `<span class="ov" style="left:${XP(t)}%;top:${h - 8}px;transform:translate(${t ? '-50%' : '0'},-50%)">${t}'</span>`; });
  }
  bins.forEach(b => {
    const v = b.momentum || 0, bh = Math.max(1.5, Math.abs(v) / mx * amp), x0 = X(b.from) + 3, w = Math.max(2, X(b.to) - X(b.from) - 6);
    const sel = o.win && o.win[0] === b.from;
    if (b.momentum != null) s += `<rect x="${x0}" y="${v >= 0 ? mid - bh : mid}" width="${w}" height="${bh}" fill="url(#${v >= 0 ? 'mUs' : 'mThem'})" ${o.win && !sel ? 'fill-opacity=".35"' : ''}/>`;
    else s += `<rect x="${x0}" y="${mid - 2}" width="${w}" height="4" fill="rgba(255,255,255,.08)"/>`;
    const tip = b.momentum == null ? `${b.from}–${b.to}': no radar data (replays / menus)`
      : `${b.from}–${b.to}': momentum ${v >= 0 ? '+' : ''}${fmt(v, 2)} · possession ${pct(b.possession)} · box ${b.box_us}–${b.box_them} · shots ${b.shots_us}–${b.shots_them}`;
    if (o.hrefFor) ov += `<a class="ov" href="${o.hrefFor(b)}" style="pointer-events:auto;left:${XP(b.from)}%;top:0;width:${XP(b.to) - XP(b.from)}%;height:${h - (o.axis ? 18 : 0)}px" data-tip="${esc(tip)}"></a>`;
    else s += `<rect class="chart-hit" x="${X(b.from)}" y="0" width="${X(b.to) - X(b.from)}" height="${h}" data-tip="${esc(tip)}"></rect>`;
    if (sel) s += `<rect x="${X(b.from)}" y="1" width="${X(b.to) - X(b.from)}" height="${h - 2}" fill="none" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  });
  const top = 8, bot = h - (o.axis ? 24 : 8);
  (m.goals || []).forEach(g => {
    const up = g.team === 'us', y = up ? top : bot;
    s += `<line x1="${X(g.minute)}" y1="${y}" x2="${X(g.minute)}" y2="${mid}" stroke="#fff" stroke-opacity=".6" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    ov += `<span class="ov ov-dot ${up ? 'us' : 'them'}" style="left:${XP(g.minute)}%;top:${y}px;transform:translate(-50%,-50%);border-color:#fff" data-tip="${minLabel(g.minute)} goal, ${esc(g.score)}"></span>`;
    if (o.axis) ov += `<span class="ov ink" style="left:${XP(g.minute) + .9}%;top:${y}px;transform:translateY(-50%)">${esc(g.score)}</span>`;
  });
  return `<div class="chart" style="height:${h}px"><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">
    <defs><linearGradient id="mUs" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#139a52"/><stop offset="1" stop-color="#30e57c"/></linearGradient>
    <linearGradient id="mThem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f7f95"/><stop offset="1" stop-color="#30d5f2"/></linearGradient></defs>${s}</svg>${ov}</div>`;
}

// goal timeline strip (0-90')
function goalStrip(m, h = 56) {
  const mid = h / 2, XP = mn => clamp(mn, 0, 95) / 95 * 100;
  let ov = `<span style="position:absolute;left:0;right:0;top:${mid}px;height:2px;background:rgba(140,175,240,.25)"></span>
    <span style="position:absolute;left:${XP(45)}%;top:${mid - 7}px;height:16px;width:2px;background:rgba(140,175,240,.4)"></span>`;
  ov += `<span class="ov" style="left:0;top:${h - 6}px">0'</span><span class="ov" style="left:${XP(45)}%;top:${h - 6}px;transform:translateX(-50%)">HT</span><span class="ov" style="left:${XP(90)}%;top:${h - 6}px;transform:translateX(-50%)">90'</span>`;
  (m.goals || []).forEach(g => {
    const up = g.team === 'us', y = up ? mid - 14 : mid + 14, x = XP(g.minute);
    ov += `<span style="position:absolute;left:${x}%;top:${up ? y : mid}px;height:14px;width:2px;background:var(--${up ? 'us' : 'them'})"></span>`;
    ov += `<span class="ov ov-dot ${up ? 'us' : 'them'}" style="left:${x}%;top:${y}px;transform:translate(-50%,-50%)" data-tip="${minLabel(g.minute)}, ${esc(g.score)}${g.scorer ? ' · ' + esc(g.scorer) : ''}"></span>`;
    ov += `<span class="ov ink2" style="left:${x}%;top:${up ? y - 13 : y + 13}px;transform:translate(-50%,-50%)">${minLabel(g.minute)}</span>`;
  });
  (m.events || []).forEach(e => {
    if (!/card/.test(e.type || '')) return;
    ov += `<span class="ov" style="left:${XP(e.minute)}%;top:${mid}px;transform:translate(-50%,-50%);width:7px;height:10px;background:${/red/.test(e.type) ? 'var(--bad)' : 'var(--warn)'};pointer-events:auto" data-tip="${minLabel(e.minute)} ${esc(e.type)} · ${esc(e.name)}"></span>`;
  });
  return `<div class="chart" style="height:${h}px">${ov}</div>`;
}

// horizontal bars list: items [{label, v, sub, color}]
function hbars(items, o = {}) {
  const mx = o.max || Math.max(1e-9, ...items.map(i => i.v).filter(isNum));
  return items.map(it => `<div class="meter"><span class="ml">${it.label}</span><span class="mv">${o.fmtv ? o.fmtv(it.v, it) : fmt(it.v, o.d || 0)}${it.sub ? ` <span class="muted small" style="font-family:var(--fb);font-weight:400">${it.sub}</span>` : ''}</span>
    <div class="track"><i class="fill" style="width:${clamp((it.v || 0) / mx * 100, 0, 100)}%;${it.color ? 'background:' + it.color : ''}"></i></div></div>`).join('');
}

// Match Facts possession pitch, drawn like the game's overlay (components/match_facts_panel.png): a horizontal
// perspective pitch (top edge ~53 % of the bottom), thin white lines (~85 %), NO surface fill, and a soft gradient
// at each end in the team's Match Facts colour (home green left, away cyan right) fading out by ~a quarter of the length.
function factsPitch(o = {}) {
  const W = 680, H = 98, top = .53, P = (x, y) => { const k = top + (1 - top) * (y / 68); return [W / 2 + (x - 52.5) / 105 * W * k, y / 68 * H]; };
  const pt = (x, y) => P(x, y).map(v => v.toFixed(1)).join(' ');
  const poly = pts => 'M' + pts.map(([x, y]) => pt(x, y)).join(' L') + ' Z';
  const line = pts => 'M' + pts.map(([x, y]) => pt(x, y)).join(' L');
  const arc = (cx, cy, r, a0, a1, n = 24) => line(Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }));
  const L = [poly([[0, 0], [105, 0], [105, 68], [0, 68]]), line([[52.5, 0], [52.5, 68]]), arc(52.5, 34, 9.15, 0, 2 * Math.PI, 40),
    poly([[0, 13.84], [16.5, 13.84], [16.5, 54.16], [0, 54.16]]), poly([[105, 13.84], [88.5, 13.84], [88.5, 54.16], [105, 54.16]]),
    poly([[0, 24.84], [5.5, 24.84], [5.5, 43.16], [0, 43.16]]), poly([[105, 24.84], [99.5, 24.84], [99.5, 43.16], [105, 43.16]]),
    arc(11, 34, 9.15, -.93, .93), arc(94, 34, 9.15, Math.PI - .93, Math.PI + .93),
    arc(0, 0, 1.2, 0, Math.PI / 2, 6), arc(105, 0, 1.2, Math.PI / 2, Math.PI, 6), arc(105, 68, 1.2, Math.PI, 1.5 * Math.PI, 6), arc(0, 68, 1.2, 1.5 * Math.PI, 2 * Math.PI, 6)].join(' ');
  const hc = o.home || 'var(--color-facts-home)', ac = o.away || 'var(--color-facts-away)', id = 'fp' + (++_hid);
  const end = (x0, x1) => poly([[x0, 0], [x1, 0], [x1, 68], [x0, 68]]);
  const [lx0] = P(0, 68), [lx1] = P(26, 68), [rx0] = P(79, 68), [rx1] = P(105, 68);
  return `<svg class="factspitch" viewBox="-4 -4 ${W + 8} ${H + 8}" role="img" aria-label="Pitch"><defs>
    <linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="${lx0.toFixed(1)}" x2="${lx1.toFixed(1)}" y1="0" y2="0"><stop offset="0" stop-color="${hc}" stop-opacity=".42"/><stop offset="1" stop-color="${hc}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="${rx1.toFixed(1)}" x2="${rx0.toFixed(1)}" y1="0" y2="0"><stop offset="0" stop-color="${ac}" stop-opacity=".42"/><stop offset="1" stop-color="${ac}" stop-opacity="0"/></linearGradient></defs>
    <path d="${end(0, 26)}" fill="url(#${id}l)"/><path d="${end(79, 105)}" fill="url(#${id}r)"/>
    <path d="${L}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="${P(11, 34)[0].toFixed(1)}" cy="${P(11, 34)[1].toFixed(1)}" r="1.8" fill="rgba(255,255,255,.85)"/><circle cx="${P(94, 34)[0].toFixed(1)}" cy="${P(94, 34)[1].toFixed(1)}" r="1.8" fill="rgba(255,255,255,.85)"/></svg>`;
}
