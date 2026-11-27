/* Boot: load data files via <script> injection (file:// safe), then route.
   Order: index.js, career.js, ledger.js -> latest day file -> coach / director per day, squad_planning.js. All optional. */
'use strict';
(async function boot() {
  if (/noanim/.test(location.hash)) document.documentElement.classList.add('noanim');
  await tryLoad('data/index.js');
  await Promise.all([tryLoad('data/career.js'), tryLoad('data/ledger.js'), tryLoad('data/external_players.js')]);
  const days = dayList();
  if (days.length) await ensureDay(days[days.length - 1]);
  await Promise.all([
    ...days.map(d => tryLoad(`data/${d}.coach.js`)),
    ...days.map(d => tryLoad(`data/${d}.director.js`)),
    ...days.map(d => tryLoad(`data/${d}.facts.js`)),   // facts gate (trust levels); optional
    tryLoad('data/squad_planning.js'),
    tryLoad('data/captured_settings.js'),
    tryLoad('data/swapdata.js'),
    tryLoad('data/faces_bbox.js'),   // face cut-out alpha geometry (FC26_FACES_BBOX, shell.js ptNorm; fccoach/faces_bbox.py); optional   // assistant swap verdict data (FC26_SWAP, js/swapverdict.js); optional
    tryLoad('data/nextmatch.js'),
    tryLoad('data/insights.js'),   // insights batch 1 (Patterns, profile Stats); optional
    tryLoad('data/streaks.js'),    // club / player streaks and records (FC26_STREAKS, js/streaks-ui.js); optional
  ]);
  if (!car() && !days.length) {
    $('#main').innerHTML = '<div class="tile empty">No data yet. Record a session and run <code>python -m fccoach.export</code>.</div>';
    return;
  }
  buildNav(); buildHeader(); initTip(); initClicks(); initKeys();
  window.addEventListener('hashchange', render);
  await render();
  window.__ready = true;
  if (/openSearch/.test(location.hash) && typeof openSearch === 'function') openSearch();   // screenshot/test hook
  // replay test hooks: #replay=<matchId>@<s> opens the popup; #replaycheck also runs the 3 s smoothness self-check
  { const mm = location.hash.match(/replay(check|raf)?=([^&@]+)@([\d.]+)/); if (mm && typeof RP2 === 'object') { const id = decodeURIComponent(mm[2]); ensureDay(id.split('#')[0]).then(() => { const m = matchData(id); if (m) RP2.open(m, +mm[3]).then(() => { if (mm[1]) setTimeout(() => RP2[mm[1] === 'raf' ? 'realCheck' : 'selfCheck'](r => { const o = document.createElement('pre'); o.id = 'rpcheck'; o.textContent = JSON.stringify(r); document.body.appendChild(o); console.log('RPCHECK ' + JSON.stringify(r)); }), 400); }); }); } }
  if (/selftest/.test(location.hash)) tryLoad('js/selftest.js');
})().catch(e => showError('Boot failed: ' + (e.stack || e.message)));
