/* Assistant-manager swap verdict (BL-103, brief 2026-11-24_tactics-board-phase-view decision 2).
   Pure and deterministic: reads only window.FC26_SWAP (dashboard/data/swapdata.js, fccoach/swapdata.py) or the
   `data` passed in opts. No DOM, no clock, no randomness. Tests: tests/test_swapverdict.py (runs this file in node).

   FC26SwapVerdict.verdict(slotId, position, playerIn, playerOut[, opts]) ->
     {slot, position, role, in, out, score, parts{fit, oop, plus, form, links}, reasons[<=3], warnings[], src[], refused}
   - players are pids (swapdata `players` keys) or display names; playerOut defaults to the slot's starter.
   - score = playerIn minus playerOut in fit points (positive = the swap helps); null when nothing is measurable.
   - opts.lineup {POS: pid} = a what-if XI for the neighbour links (default: the slot's starters).
   Rules (RULES below, one place):
     fit   role fit (est., ROLE_MODELS weights x attributes) in minus out, 1 point = 1 point
     oop   out-of-position "!" disables Role+/Role++ (kb_fc26_mechanics §8): -OOP when only `in` is out of position,
           +OOP when only `out` is
     plus  Role+ / Role++ for this role at this position ([ext]), only when natural there: PLUS / PLUS2
     form  last official Match Ratings, (avg in - avg out) x FORM_W, only when both have >= FORM_MIN ratings;
           worded "rough" below FORM_FIRM (EV-4: >= 5 rated matches before bench/sell)
     links completed passes with the 3 neighbour positions' players [radar est.], (in - out) / LINK_DIV, capped at
           +-LINK_CAP, only when both are in the pass network (no shared minutes = no evidence, not a bad link) and
           one of them has >= LINK_MIN
     condition / cards / injury: warnings only (snapshots, see condition.as_of), never in the score
     GK <-> outfield: refused (score null), as in FC 26 Team Management. */
(function (root) {
  'use strict';
  var RULES = { OOP: 6, PLUS: 3.5, PLUS2: 6, FORM_W: 3, FORM_MIN: 3, FORM_FIRM: 5,
    LINK_MIN: 5, LINK_DIV: 5, LINK_CAP: 2, ENERGY_LOW: 60, SHARP_LOW: 60 };
  var BASE = { LCB: 'CB', RCB: 'CB', SW: 'CB', LCDM: 'CDM', RCDM: 'CDM', LDM: 'CDM', RDM: 'CDM', LCM: 'CM', RCM: 'CM',
    LAM: 'CAM', RAM: 'CAM', LS: 'ST', RS: 'ST', LF: 'CF', RF: 'CF' };
  var LOW_MORALE = { 'Unhappy': 1, 'Very Unhappy': 1 };

  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function fmt(x) { return (x > 0 ? '+' : '') + r1(x); }
  function short(p) { return p ? p.name : '?'; }
  function findPlayer(D, ref) {
    if (!ref) return null;
    var P = D.players || {};
    if (P[ref]) return ref;
    var f = fold(ref);
    if (P[f]) return f;
    for (var k in P) { if (fold(P[k].name) === f) return k; }
    return null;
  }
  function linkCount(D, a, b) {
    var k = a < b ? a + '|' + b : b + '|' + a;
    var v = ((D.links || {}).pairs || {})[k];
    return v ? v[0] : 0;
  }
  function inNetwork(D, a) {
    var P = (D.links || {}).pairs || {};
    for (var k in P) { var ab = k.split('|'); if (ab[0] === a || ab[1] === a) return true; }
    return false;
  }
  function plusFor(p, sp) {
    var v = (p && p.role_plus && p.role_plus.v) || [];
    var want = BASE[sp.pos] || sp.pos;
    for (var i = 0; i < v.length; i++) {
      var rp = v[i];
      if ((BASE[rp.pos] || rp.pos) === want && fold(rp.role) === fold(sp.role)) return rp.plus;
    }
    return null;
  }
  function addSrc(list, s) { if (s && list.indexOf(s) < 0) list.push(s); }

  function verdict(slotId, position, playerIn, playerOut, opts) {
    opts = opts || {};
    var D = opts.data || root.FC26_SWAP || null;
    var out = { slot: slotId, position: position, role: null, in: null, out: null, score: null,
      parts: { fit: null, oop: null, plus: null, form: null, links: null }, reasons: [], warnings: [], src: [],
      refused: false };
    if (!D) { out.warnings.push('no swap data (swapdata.js not loaded)'); return out; }
    var slot = null;
    for (var i = 0; i < (D.slots || []).length; i++) { if (String(D.slots[i].slot) === String(slotId)) slot = D.slots[i]; }
    var sp0 = slot && slot.positions && slot.positions[position];
    if (!sp0) { out.warnings.push('slot ' + slotId + ' / ' + position + ' not captured'); return out; }
    var sp = { pos: position, role: sp0.role, bucket: sp0.bucket, key: sp0.key, neighbours: sp0.neighbours || [] };
    out.role = sp.role;
    var idIn = findPlayer(D, playerIn), idOut = findPlayer(D, playerOut || sp0.starter);
    out.in = idIn; out.out = idOut;
    var A = idIn && D.players[idIn], B = idOut && D.players[idOut];
    if (!A) { out.warnings.push('player not in swap data: ' + playerIn); return out; }
    if (slot.src) addSrc(out.src, slot.src);

    // GK <-> outfield is refused (FC 26 does not allow it in Team Management either)
    var nat = A.positions && A.positions.natural;
    if (nat && ((nat === 'GK') !== (position === 'GK'))) {
      out.refused = true;
      out.warnings.push('swap refused: ' + (position === 'GK' ? 'outfield player in goal' : 'keeper outfield'));
      addSrc(out.src, A.positions.src);
      return out;
    }
    var parts = out.parts, lines = [];

    // 1. role fit
    var fa = A.fit ? A.fit[sp.key] : null, fb = B && B.fit ? B.fit[sp.key] : null;
    if (fa != null && fb != null) {
      parts.fit = r1(fa - fb);
      lines.push({ w: Math.abs(parts.fit), t: sp.role + ' fit ' + Math.round(fa) + ' vs ' + Math.round(fb) + ' (est.)' });
      addSrc(out.src, A.fit_src);
    } else {
      lines.push({ w: 0, t: sp.role + ' fit: ' + (fa == null ? short(A) : short(B)) + ' not measured' });
    }

    // 2. out of position "!" (+ warning)
    var oa = A.oop ? A.oop[position] : null, ob = B && B.oop ? B.oop[position] : null;
    if (oa === true) out.warnings.push('! ' + short(A) + ' out of position at ' + position + ' (Role+/++ off)');
    if (oa === true && ob === false) parts.oop = -RULES.OOP;
    else if (oa === false && ob === true) parts.oop = RULES.OOP;
    else if (oa != null && ob != null) parts.oop = 0;
    if (parts.oop) {
      lines.push({ w: Math.abs(parts.oop), t: parts.oop > 0
        ? 'Natural ' + (BASE[position] || position) + '; ' + short(B) + ' has ! here'
        : short(A) + ' has ! here; ' + short(B) + ' is natural' });
      addSrc(out.src, A.positions && A.positions.src);
    }

    // 3. Role+ / Role++ for this role, only when natural at the position
    var pa = oa === false ? plusFor(A, sp) : null, pb = ob === false ? plusFor(B, sp) : null;
    var va = pa === '++' ? RULES.PLUS2 : pa === '+' ? RULES.PLUS : 0;
    var vb = pb === '++' ? RULES.PLUS2 : pb === '+' ? RULES.PLUS : 0;
    if (va || vb) {
      parts.plus = r1(va - vb);
      if (parts.plus) {
        lines.push({ w: Math.abs(parts.plus), t: (va > vb ? short(A) : short(B)) + ' has ' + sp.role
          + (va > vb ? pa : pb) + ' [ext]' });
      }
      addSrc(out.src, (A.role_plus || {}).src);
    }

    // 4. form (official Match Ratings)
    var ga = A.form, gb = B && B.form;
    if (ga && gb && ga.n >= RULES.FORM_MIN && gb.n >= RULES.FORM_MIN) {
      parts.form = r1((ga.avg - gb.avg) * RULES.FORM_W);
      var rough = (ga.n < RULES.FORM_FIRM || gb.n < RULES.FORM_FIRM) ? ', rough' : '';
      lines.push({ w: Math.abs(parts.form), t: 'Form ' + ga.avg.toFixed(1) + ' vs ' + gb.avg.toFixed(1)
        + ' (official, n=' + ga.n + '/' + gb.n + rough + ')' });
      addSrc(out.src, ga.src);
    } else if (B) {
      lines.push({ w: 0, t: 'Form: too few ratings (n=' + (ga ? ga.n : 0) + '/' + (gb ? gb.n : 0) + ')' });
    }

    // 5. links with the neighbour positions' players (radar estimate)
    var lineup = opts.lineup || {};
    var la = 0, lb = 0, names = [];
    for (var j = 0; j < sp.neighbours.length; j++) {
      var np = sp.neighbours[j];
      var who = lineup[np] || (slot.positions[np] || {}).starter;
      if (!who || who === idIn || who === idOut) continue;
      names.push(np);
      la += linkCount(D, idIn, who);
      if (idOut) lb += linkCount(D, idOut, who);
    }
    var both = idOut && inNetwork(D, idIn) && inNetwork(D, idOut);
    if (!both && B && Math.max(la, lb) >= RULES.LINK_MIN) {
      lines.push({ w: 0, t: 'Links: ' + (inNetwork(D, idIn) ? short(B) : short(A)) + ' not in the pass network yet' });
    }
    if (both && Math.max(la, lb) >= RULES.LINK_MIN) {
      parts.links = r1(Math.max(-RULES.LINK_CAP, Math.min(RULES.LINK_CAP, (la - lb) / RULES.LINK_DIV)));
      lines.push({ w: Math.abs(parts.links), t: 'Links with ' + names.join('/') + ': ' + la + ' vs ' + lb
        + ' passes (est.)' });
      addSrc(out.src, (D.links || {}).src);
    }

    // 6. warnings only: condition, injury, cards, morale (snapshots)
    var c = A.condition;
    if (c) {
      var asof = c.as_of ? ' (as of ' + c.as_of + ')' : '';
      if (c.energy != null && c.energy < RULES.ENERGY_LOW) out.warnings.push('Low energy ' + c.energy + asof);
      if (c.sharpness != null && c.sharpness < RULES.SHARP_LOW) out.warnings.push('Low sharpness ' + c.sharpness + asof);
      if (c.morale && LOW_MORALE[c.morale]) out.warnings.push('Morale ' + c.morale + asof);
      if (c.injury) out.warnings.push('Injured: ' + c.injury + asof);
    }
    if (A.cards && A.cards.suspended) out.warnings.push('Suspended');
    if (A.seen_in_game === false) out.warnings.push(short(A) + ' never seen in our career captures');

    var any = false, sum = 0;
    for (var k in parts) { if (parts[k] != null) { any = true; sum += parts[k]; } }
    out.score = any ? r1(sum) : null;
    lines.sort(function (x, y) { return y.w - x.w; });
    out.reasons = lines.slice(0, 3).map(function (l) { return l.t; });
    return out;
  }

  var api = { verdict: verdict, RULES: RULES, fmt: fmt };
  root.FC26SwapVerdict = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
