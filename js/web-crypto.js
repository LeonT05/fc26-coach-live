/* FC26 Coach - Client-side AES-256-GCM loader for Private Encrypted Web Hosting.
   Complete no-op on local file:// builds (`window.FC26_ENCRYPTED` is only set in `dist/web/index.html`). */
'use strict';
(function initWebCrypto() {
  if (!window.FC26_ENCRYPTED) return;

  const KEY_STORAGE = 'fc26.webkey';
  const VIEWER_STORAGE = 'fc26.viewer';
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  window.FC26_FACE_URLS = window.FC26_FACE_URLS || {};

  function b64UrlToBytes(s) {
    const clean = String(s || '').trim().replace(/^.*[#?&]key=([A-Za-z0-9_-]+).*$/, '$1').replace(/[^A-Za-z0-9_-]/g, '');
    if (clean.length < 40) throw new Error('Invalid access key length');
    const b64 = clean.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((clean.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { clean, bytes: out };
  }

  function harvestUrlParams() {
    try {
      const u = new URL(location.href);
      const v = u.searchParams.get('v') || u.searchParams.get('viewer');
      if (v === 'p1' || v === 'p2') {
        try { localStorage.setItem(VIEWER_STORAGE, v); } catch (e) {}
        u.searchParams.delete('v');
        u.searchParams.delete('viewer');
      }
      let hash = u.hash.replace(/^#/, '');
      let foundKey = null;
      if (hash) {
        const parts = hash.split('&').filter(Boolean);
        const kept = [];
        for (const p of parts) {
          if (p.startsWith('key=')) {
            foundKey = decodeURIComponent(p.slice(4));
          } else {
            kept.push(p);
          }
        }
        if (foundKey) {
          try { localStorage.setItem(KEY_STORAGE, foundKey); } catch (e) {}
          u.hash = kept.length ? '#' + kept.join('&') : '#page=hub';
        }
      }
      if (v || foundKey) {
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
      return foundKey;
    } catch (e) {
      return null;
    }
  }

  async function gunzipBytes(u8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Browser lacks DecompressionStream support (use modern Chrome, Edge, Safari, or Firefox)');
    }
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(u8);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function decryptEnvelope(cryptoKey, buf, aadStr) {
    const all = new Uint8Array(buf);
    if (all.byteLength < 29) throw new Error('Encrypted payload truncated');
    const iv = all.subarray(0, 12);
    const ct = all.subarray(12);
    const plain = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(aadStr) },
      cryptoKey,
      ct
    ));
    const flag = plain[0];
    const body = plain.subarray(1);
    return flag === 1 ? await gunzipBytes(body) : body;
  }

  let _cryptoKey = null;
  let _manifest = null;
  let _readyPromise = null;

  function promptForKey(errMsg) {
    return new Promise(resolve => {
      const main = document.getElementById('main');
      if (!main) return resolve('');
      main.innerHTML = `
        <div style="max-width:480px;margin:80px auto;padding:32px;background:rgba(20,26,36,0.92);border:1px solid rgba(255,255,255,0.12);border-radius:14px;color:#eef3f8;font-family:inherit">
          <h2 style="margin:0 0 8px;font-size:22px;font-weight:700">FC Coach · Private Career Hub</h2>
          <p style="margin:0 0 18px;color:#9fb0c3;font-size:15px;line-height:1.45">
            All match data and portraits on this site are encrypted end-to-end (AES-256-GCM). Open your invite link once, or paste your access key below.
          </p>
          ${errMsg ? `<div style="margin:0 0 14px;padding:10px 12px;border-radius:8px;background:rgba(255,84,104,0.14);border:1px solid rgba(255,84,104,0.45);color:#ffb3bc;font-size:14px">${errMsg.replace(/[<>&]/g, '')}</div>` : ''}
          <form id="fcKeyForm" style="display:flex;gap:10px;flex-wrap:wrap">
            <input id="fcKeyInput" type="password" autocomplete="off" placeholder="Paste invite link or 43-char key"
              style="flex:1;min-width:220px;padding:10px 14px;border-radius:9px;border:1px solid rgba(255,255,255,0.2);background:#0e131b;color:#fff;font-size:15px">
            <button type="submit"
              style="padding:10px 20px;border-radius:9px;border:0;background:#18c29c;color:#081318;font-weight:700;font-size:15px;cursor:pointer">
              Unlock
            </button>
          </form>
        </div>`;
      const form = document.getElementById('fcKeyForm');
      const inp = document.getElementById('fcKeyInput');
      if (inp) inp.focus();
      form.onsubmit = ev => {
        ev.preventDefault();
        resolve((inp && inp.value) || '');
      };
    });
  }

  async function unlockAndLoadManifest() {
    let candidate = harvestUrlParams();
    if (!candidate) {
      try { candidate = localStorage.getItem(KEY_STORAGE) || ''; } catch (e) { candidate = ''; }
    }
    let lastErr = '';
    while (true) {
      if (!candidate) {
        candidate = await promptForKey(lastErr);
      }
      try {
        const { clean, bytes } = b64UrlToBytes(candidate);
        const ck = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['decrypt']);
        const res = await fetch('enc/manifest.bin?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not fetch encrypted manifest (' + res.status + ')');
        const raw = await decryptEnvelope(ck, await res.arrayBuffer(), 'fc26-manifest-v1');
        const man = JSON.parse(dec.decode(raw));
        try { localStorage.setItem(KEY_STORAGE, clean); } catch (e) {}
        _cryptoKey = ck;
        _manifest = man;
        await preloadFaces(man);
        return man;
      } catch (e) {
        try { localStorage.removeItem(KEY_STORAGE); } catch (err) {}
        candidate = '';
        lastErr = 'Could not unlock with that key (' + (e && e.message ? e.message : 'decryption failed') + ').';
      }
    }
  }

  async function preloadFaces(man) {
    const files = (man && man.files) || {};
    const entries = Object.entries(files).filter(([k]) => k.startsWith('data/faces/') && k.endsWith('.png'));
    await Promise.all(entries.map(async ([rel, meta]) => {
      if (window.FC26_FACE_URLS[rel]) return;
      try {
        const r = await fetch(meta.f + '?v=' + encodeURIComponent(meta.h || '1'));
        if (!r.ok) return;
        const bytes = await decryptEnvelope(_cryptoKey, await r.arrayBuffer(), rel);
        window.FC26_FACE_URLS[rel] = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      } catch (e) { /* fallback silhouette handles missing face */ }
    }));
  }

  function ready() {
    return _readyPromise || (_readyPromise = unlockAndLoadManifest());
  }

  async function refreshManifestIfNeeded() {
    if (!_cryptoKey) return ready();
    const res = await fetch('enc/manifest.bin?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return _manifest;
    const raw = await decryptEnvelope(_cryptoKey, await res.arrayBuffer(), 'fc26-manifest-v1');
    _manifest = JSON.parse(dec.decode(raw));
    return _manifest;
  }

  const _hashLoaded = {};

  async function loadEncryptedScript(src, opts) {
    await ready();
    const cleanSrc = String(src || '').split('?')[0].replace(/^\.\//, '');
    const bust = Boolean((opts && opts.bust) || /\?t=/.test(String(src || '')));
    if (bust) {
      await refreshManifestIfNeeded();
    }
    const meta = ((_manifest && _manifest.files) || {})[cleanSrc];
    if (!meta) throw new Error('Not in encrypted bundle: ' + cleanSrc);
    if (bust && _hashLoaded[cleanSrc] === meta.h) {
      return true; // unchanged on server: skip re-download
    }
    const r = await fetch(meta.f + '?v=' + encodeURIComponent(meta.h || '1'),
                          bust ? { cache: 'no-cache' } : { cache: 'force-cache' });
    if (!r.ok) throw new Error('Could not fetch ' + cleanSrc + ' (' + r.status + ')');
    const bytes = await decryptEnvelope(_cryptoKey, await r.arrayBuffer(), cleanSrc);
    const code = dec.decode(bytes);
    (0, eval)(code + '\n//# sourceURL=' + cleanSrc);
    _hashLoaded[cleanSrc] = meta.h;
    return true;
  }

  window.FC26_WEB = {
    ready,
    loadScript: loadEncryptedScript,
    faceUrl: p => window.FC26_FACE_URLS[String(p || '').replace(/^\.\//, '')] || null,
    lock: () => { try { localStorage.removeItem(KEY_STORAGE); } catch (e) {} location.reload(); },
  };
})();
