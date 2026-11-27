/* Peti's birthday banner. Shows on 27 November when the dashboard is viewed as P2 (fc26.viewer = p2, set by Peti's
   invite link or the "Viewing as" switch): fireworks + confetti for ~8 s on a light 2D canvas, then the loop stops.
   Once per browser session. A / Enter / B / Esc / click closes it. `?bday` in the URL forces it (preview / test).
   Brief: docs/ui_changes/2026-11-27_peti-birthday.md */
'use strict';
(function birthday() {
  const MONTH = 10, DAY = 27;                    // 27 Nov (JS months are 0-based)
  const forced = /[?&]bday\b/.test(location.search);
  const today = new Date();
  if (!forced && !(today.getMonth() === MONTH && today.getDate() === DAY)) return;
  const SEEN = 'fc26.bday.' + today.getFullYear();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let open = false, back = null;

  const isPeti = () => { try { return localStorage.getItem('fc26.viewer') === 'p2'; } catch (e) { return false; } };
  const seen = () => { try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return false; } };
  const name = () => (typeof P2 === 'function' ? P2() : 'Peti');
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function maybeShow() { if (!open && (forced || (isPeti() && !seen()))) show(); }

  function show() {
    open = true;
    try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* */ }
    back = document.activeElement;
    const kb = document.documentElement.dataset.input === 'kb';
    const el = document.createElement('div');
    el.id = 'bday'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bdayT');
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    el.innerHTML = `<canvas aria-hidden="true"></canvas><div class="bd-band">
      <div class="bd-kick">27 November · Club news</div>
      <h1 class="bd-title" id="bdayT">Happy birthday<span class="bd-name">${esc(name())}</span></h1>
      <div class="bd-sub">From Leon and the whole Como dressing room</div>
      <button type="button" class="prompt bd-go">${kb ? '<span class="gl kc">Enter</span>' : '<span class="gl c">A</span>'}Let's play</button></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', close);
    const btn = el.querySelector('.bd-go');
    btn.focus({ preventScroll: true });
    if (!reduced) fx(el.querySelector('canvas'));
  }

  function close() {
    if (!open) return;
    open = false;
    const el = document.getElementById('bday');
    if (!el) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), reduced ? 0 : 180);
    try { if (back && back.focus) back.focus({ preventScroll: true }); } catch (e) { /* */ }
  }

  // Pad / keyboard: highest z wins in gamepad.js, so A and B land here while the banner is up; everything else is swallowed
  window.PAD_HOOKS = window.PAD_HOOKS || {};
  window.PAD_HOOKS.bday = { z: 99, active: () => open, press: n => { if (n === 'A' || n === 'B') close(); return true; } };
  addEventListener('keydown', e => { if (open && /^(Enter|Escape| )$/.test(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);

  // ---------- fireworks + confetti (2D canvas, DPR capped, stops itself) ----------
  function fx(cv) {
    const ctx = cv.getContext('2d');
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    let W = 0, H = 0;
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    const C = [tok('--color-gold') || '#f3b80c', tok('--color-accent-teal') || '#1ff0e9', '#ffffff', tok('--color-button-primary') || '#4572af',
      tok('--color-marker-p2') || '#ff4d5e', tok('--color-state-positive') || '#2ad679'];
    const pick = a => a[(Math.random() * a.length) | 0];
    const rockets = [], sparks = [], confetti = [];
    const FW_END = 7000, CF_END = 5200, MAX = 900;
    let t0 = performance.now(), last = t0, nextRocket = 0, nextConf = 0;

    const launch = () => rockets.push({ x: W * (.15 + Math.random() * .7), y: H + 10, vx: (Math.random() - .5) * 60,
      vy: -(H * (.95 + Math.random() * .35)), ty: Math.random() < .35 ? H * (.7 + Math.random() * .12) : H * (.08 + Math.random() * .2), c: pick(C) });
    const burst = r => {
      const n = 60 + (Math.random() * 40 | 0), sp = (140 + Math.random() * 160) * Math.max(.8, Math.min(1.6, W / 1200)), c2 = Math.random() < .5 ? r.c : pick(C);
      for (let i = 0; i < n && sparks.length < MAX; i++) {
        const a = (i / n) * Math.PI * 2, v = sp * (.55 + Math.random() * .45);
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, d: .55 + Math.random() * .5, c: i % 3 ? r.c : c2 });
      }
    };
    const drop = (n, top) => { for (let i = 0; i < n && confetti.length < MAX; i++) confetti.push({ x: Math.random() * W, y: top ? -20 - Math.random() * H * .4 : -20,
      vy: 90 + Math.random() * 120, sw: Math.random() * Math.PI * 2, sws: 1.5 + Math.random() * 2.5, r: Math.random() * Math.PI, vr: (Math.random() - .5) * 8,
      w: 7 + Math.random() * 6, h: 4 + Math.random() * 4, c: pick(C) }); };
    drop(140, true);

    function frame(now) {
      if (!document.getElementById('bday')) return;          // closed: stop
      const dt = Math.min(.05, (now - last) / 1000), el = now - t0; last = now;
      if (el < FW_END && el >= nextRocket) { launch(); if (Math.random() < .35) launch(); nextRocket = el + 380 + Math.random() * 420; }
      if (el < CF_END && el >= nextConf) { drop(6); nextConf = el + 90; }
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 420 * dt;
        ctx.fillStyle = r.c; ctx.fillRect(r.x - 1.5, r.y - 6, 3, 10);
        if (r.y <= r.ty || r.vy >= 0) { burst(r); rockets.splice(i, 1); }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.vx *= 1 - 1.6 * dt; s.vy = s.vy * (1 - 1.6 * dt) + 140 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt / (1.1 * s.d + .5);
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, s.life * 1.4); ctx.fillStyle = s.c;
        ctx.beginPath(); ctx.arc(s.x, s.y, 3 * s.life + .8, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i]; p.sw += p.sws * dt; p.r += p.vr * dt; p.y += p.vy * dt; p.x += Math.sin(p.sw) * 40 * dt;
        if (p.y > H + 20) { confetti.splice(i, 1); continue; }
        ctx.globalAlpha = 1; ctx.fillStyle = p.c;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.cos(p.sw * 1.3)) * .8 + .2);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (el < Math.max(FW_END, CF_END) || rockets.length || sparks.length || confetti.length) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, W, H); removeEventListener('resize', size); }   // show over: the loop ends, banner stays until closed
    }
    requestAnimationFrame(frame);
  }

  // The header's "Viewing as" button is rebuilt after the career loads and on every viewer switch: check then.
  function watch() {
    const va = document.getElementById('viewAs');
    if (!va) return;
    new MutationObserver(maybeShow).observe(va, { childList: true });
    if (va.childNodes.length) maybeShow();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  window.FC_BDAY = { show: () => { if (!open) show(); }, close };
})();
