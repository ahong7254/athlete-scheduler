// PROTOTYPE · THROWAWAY — practice/game start conflicts: what should the warning look like?
// Three variants on the real scheduler page, switchable with ?variant=A|B|C and the floating bar (← / → keys).
// The page PROTOTYPE_practice_start_conflict.html is a generated copy of athlete_schedule_v6_AH.html with this
// script appended; regenerate it after changing the real page:
//   sed 's#</body>#<script src="PROTOTYPE_practice_start_conflict.js"></script>\n</body>#' athlete_schedule_v6_AH.html > PROTOTYPE_practice_start_conflict.html
// Not for production: the page shell and switcher get thrown away; only the conflict-detection function is worth keeping.

// ─────────────────────────────────────────────────────────────────────
// PURE: find clock conflicts in a laid-out day (liftable into layoutDay / assembleRow)
// ─────────────────────────────────────────────────────────────────────
function clockConflicts(row, c) {
  const out = [];
  const day = row.tl.slice(1);
  const check = (type, setAt, what) => {
    const i = day.findIndex(b => b.type === type);
    if (i < 0 || setAt == null) return;
    const blk = day[i], late = blk.start - setAt;
    if (late <= 0.01) return;
    // What pushed it: the last non-commute, non-free block before it
    let j = i - 1; while (j >= 0 && ['Commute', 'Free Time'].includes(day[j].type)) j--;
    const prev = day[j];
    const prevEnd = prev ? prev.start + prev.dur : row.wake;
    const travel = blk.start - prevEnd;
    const base = !prev ? `the day starts at ${fmtT(row.wake)}`
      : prev.type === 'Morning Routine' ? `the day starts at ${fmtT(row.wake)} (plus the morning routine)`
      : prev.type === 'Classes' ? `school ends at ${fmtT(prevEnd)}`
      : `${prev.label.replace(/\s*\(.*$/, '')} ends at ${fmtT(prevEnd)}`;
    const cause = travel >= 0.05 ? `${base} and getting there takes ${fmtD(travel)}` : base;
    out.push({ what, setAt, actual: blk.start, late, cause,
               fix: !prev || prev.type === 'Morning Routine' ? `wake up by ${fmtT(setAt - (blk.start - row.wake))}` : `start ${what.toLowerCase()} at ${fmtT(blk.start)}` });
  };
  check('Practice', c.practiceStart[row.dt], 'Practice');
  check('Game', c.gameStart?.[row.dt], 'Game');
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Shared: correct labels to the real start time (the fix all variants share)
// ─────────────────────────────────────────────────────────────────────
const _compute = compute;
compute = function () {
  _compute();
  sched.forEach(r => {
    r.conflicts = clockConflicts(r, cfg);
    r.tl.forEach(b => { if (b.type === 'Practice') b.label = b.label.replace(/starts [0-9:]+ [AP]M/, `starts ${fmtT(b.start)}`); });
  });
};

const VARIANTS = { A: 'Mark it on the timeline', B: 'Callout in the day panel', C: 'Week-level conflict list' };
const variant = (() => { const v = new URLSearchParams(location.search).get('variant'); return VARIANTS[v] ? v : 'A'; })();

// ── Variant A: the timeline shows it — ghost marker at the set time, hatched late block, short tag
const _renderGrid = renderGrid;
renderGrid = function () {
  _renderGrid();
  if (variant !== 'A') return;
  document.querySelectorAll('#day-grid .day-row').forEach((el, i) => {
    const r = sched[i]; if (!r.conflicts?.length) return;
    const track = el.querySelector('.t-track');
    r.conflicts.forEach(cf => {
      track.insertAdjacentHTML('beforeend', `<div title="${cf.what} set for ${fmtT(cf.setAt)}" style="position:absolute;top:0;bottom:0;left:${toX(cf.setAt)}%;width:0;border-left:2px dashed #b03a2e"></div>
        <div style="position:absolute;top:-1px;left:${toX(cf.setAt)}%;transform:translateX(-50%);font-size:9px;color:#b03a2e;background:#fffaf2;padding:0 2px;border-radius:2px">set ${fmtT(cf.setAt)}</div>`);
      const blk = [...track.querySelectorAll('.tblk')].find(b => (b.dataset.tip || '').startsWith(cf.what));
      if (blk) { blk.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(176,58,46,.35) 4px 6px)'; blk.style.outline = '1.5px solid #b03a2e';
        blk.dataset.tip = `${cf.what} set for ${fmtT(cf.setAt)} but starts ${fmtT(cf.actual)} (${fmtD(cf.late)} late) — ${cf.cause}.`; }
      el.querySelector('.d-tag').insertAdjacentHTML('beforeend', `<div style="color:#b03a2e;font-weight:600">⚠ ${cf.what.toLowerCase()} ${fmtD(cf.late)} late</div>`);
    });
  });
};

// ── Variant B: the day panel explains it, with suggested fixes (stubs)
const _renderDetail = renderDetail;
renderDetail = function () {
  _renderDetail();
  if (variant !== 'B' || selDay === null) return;
  const r = sched[selDay]; const det = document.querySelector('#detail .det'); if (!det) return;
  r.conflicts.forEach(cf => {
    det.querySelector('.det-hdr').insertAdjacentHTML('afterend', `<div style="display:flex;gap:12px;align-items:flex-start;background:#fbe8e1;border-left:3px solid #b03a2e;border-radius:8px;padding:10px 12px;margin-bottom:12px">
      <div style="font-size:18px">⏰</div><div style="flex:1;font-size:13px;color:#7a2418">
      <b>${cf.what} is set for ${fmtT(cf.setAt)}, but ${cf.cause}.</b> It's planned at ${fmtT(cf.actual)} instead (${fmtD(cf.late)} later), and everything after it shifts too.
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-save" onclick="alert('Prototype: not wired. Would set the ${cf.what.toLowerCase()} time to ${fmtT(cf.actual)}.')">Use ${fmtT(cf.actual)} as the ${cf.what.toLowerCase()} time</button>
        <button class="btn-save" onclick="alert('Prototype: not wired. Would ${cf.fix}.')">${cf.fix[0].toUpperCase() + cf.fix.slice(1)}</button>
        <button class="btn-save" onclick="this.closest('div[style]').parentElement.parentElement.remove()">Keep as is</button></div></div></div>`);
    det.querySelectorAll('.tl-item').forEach(it => { if (it.querySelector('.tl-label')?.textContent.startsWith(cf.what))
      it.querySelector('.tl-time').insertAdjacentHTML('beforeend', `<div style="color:#b03a2e;font-size:10px">set for ${fmtT(cf.setAt)}</div>`); });
  });
};

// ── Variant C: one list for the whole week, above everything; click to open the day
const _renderSummary = renderSummary;
renderSummary = function () {
  _renderSummary();
  document.getElementById('proto-conflicts')?.remove();
  if (variant !== 'C') return;
  const items = sched.flatMap((r, i) => (r.conflicts || []).map(cf => ({ r, i, cf })));
  if (!items.length) return;
  document.getElementById('sum-grid').insertAdjacentHTML('beforebegin', `<div id="proto-conflicts" style="background:#fff6e6;border:0.5px solid #a8770f60;border-left:3px solid #a8770f;border-radius:10px;padding:12px 16px;margin-bottom:18px">
    <div style="font-size:13px;font-weight:600;color:#6b4a08;margin-bottom:4px">⏰ ${items.length} clock conflict${items.length > 1 ? 's' : ''} this week — some settings can't happen at the time you set</div>
    ${items.map(({ r, i, cf }) => `<div style="font-size:12px;color:#6b4a08;padding:2px 0;cursor:pointer" onclick="selDayFn(${i})">
      • <b>${r.dayName}</b>: ${cf.what.toLowerCase()} set for ${fmtT(cf.setAt)}, planned ${fmtT(cf.actual)} — ${cf.cause}. <u>Open day</u></div>`).join('')}
    <div style="font-size:11px;color:#957a60;margin-top:4px">Change the time in Practice / Game &amp; Sport, or the wake-up time in Schedule.</div></div>`);
};

// ── Floating switcher (prototype only)
(function switcher() {
  const keys = Object.keys(VARIANTS);
  const go = d => { const i = (keys.indexOf(variant) + d + keys.length) % keys.length; const u = new URL(location.href); u.searchParams.set('variant', keys[i]); location.replace(u.href); };
  document.body.insertAdjacentHTML('beforeend', `<div id="proto-switcher" style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;align-items:center;gap:10px;background:#1f1a16;color:#fff;border-radius:999px;padding:6px 10px;box-shadow:0 6px 24px rgba(0,0,0,.35);font:13px 'Segoe UI',sans-serif">
    <button id="proto-prev" style="background:none;border:0;color:#fff;font-size:16px;cursor:pointer">←</button>
    <span><b>${variant}</b> (${VARIANTS[variant]}) · PROTOTYPE</span>
    <button id="proto-next" style="background:none;border:0;color:#fff;font-size:16px;cursor:pointer">→</button></div>`);
  document.getElementById('proto-prev').onclick = () => go(-1);
  document.getElementById('proto-next').onclick = () => go(1);
  document.addEventListener('keydown', e => { if (e.target.closest('input,textarea,select,[contenteditable]')) return;
    if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
})();

// ── Demo week with two conflicts: Saturday practice before the weekend wake-up, Tuesday practice before school ends
cfg.practiceStart.practice_weekend = 7.25;     // 7:15 AM
cfg.wake.practice_weekend = 8.75;              // but the weekend wake-up is 8:45 AM
cfg.practiceStart.practice_weekday = 15.0;     // 3:00 PM, school (plus commute) ends later
cfg.gameDay = null;
refresh();
selDayFn(5);                                   // open Saturday so variant B is visible straight away
