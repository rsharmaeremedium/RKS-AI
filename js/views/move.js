/* =========================================================================
   views/move.js — Movement Age (target 25), guided routines, retests
   ========================================================================= */

import { dateKey, esc, icon, hydrateIcons, mmss, fmtDate, clamp, round, avg } from '../utils.js';
import { toast, bar, modal, closeModal, navigate, animateRings } from '../ui.js';
import { store } from '../store.js';
import {
  ROUTINES, TESTS, scoreTest, movementAge, movementScores, latestTest, saveTest, routineForToday, logMobility
} from '../plan.js';

let player = null;      // { routine, idx, left, running, tick }
let unsubRender = null;

export function render(root) {
  stopPlayer(false);
  const routine = ROUTINES[playerRoutineId()] || routineForToday();
  const test = latestTest();
  const age = movementAge(test);
  const scores = movementScores(test);
  const history = [...store.state.tests].sort((a, b) => a.d.localeCompare(a.d));

  root.innerHTML = `
    <div class="stack-lg">
      <!-- Movement Age hero -->
      ${age ? ageHero(age, scores, history) : ageEmpty()}

      <!-- Today's routine -->
      <div class="card pad-lg stack" id="routine-card">
        <div class="row between wrap" style="gap:10px">
          <div class="row" style="gap:12px">
            <span class="avatar-ico" style="width:44px;height:44px">${icon('stretch')}</span>
            <div>
              <div class="h-big">${esc(routine.name)}</div>
              <div class="small muted">${esc(routine.when)} · ${routine.mins} min · ${routine.items.length} movements</div>
            </div>
          </div>
          <div class="chip-row">
            <button class="btn btn-primary" id="p-start">${icon('play')} Start</button>
            <button class="btn" data-act="pick-routine">Change routine</button>
          </div>
        </div>

        <div id="player-box" hidden>
          <div class="card" style="background:color-mix(in srgb,var(--accent-2) 10%,transparent);text-align:center;padding:18px">
            <div class="eyebrow" id="p-count">Movement 1 of ${routine.items.length}</div>
            <div class="h-big" id="p-name" style="margin:6px 0">${esc(routine.items[0].name)}</div>
            <div class="timer-face" id="p-time" style="font-size:46px">0:00</div>
            <p class="small accent-2" id="p-cue" style="max-width:420px;margin:6px auto 12px">${esc(routine.items[0].cue)}</p>
            <div style="max-width:420px;margin:0 auto 12px"><div id="p-bar"></div></div>
            <div class="row" style="justify-content:center">
              <button class="btn" id="p-prev" aria-label="Previous">${icon('skip')}</button>
              <button class="btn btn-primary" id="p-toggle" style="min-width:110px">${icon('pause')} Pause</button>
              <button class="btn" id="p-next" aria-label="Next">${icon('skip')}</button>
              <button class="btn btn-ghost" id="p-end">Finish</button>
            </div>
          </div>
        </div>

        <div class="list" style="border:1px solid var(--line);border-radius:14px;overflow:hidden">
          ${routine.items.map((it, i) => `
            <div class="list-item" data-item="${i}">
              <span class="badge" style="width:32px;justify-content:center">${i + 1}</span>
              <div class="grow">
                <div class="list-title">${esc(it.name)}</div>
                <div class="list-sub">${esc(it.cue)}</div>
              </div>
              <span class="tiny muted num">${it.dur}s</span>
            </div>`).join('')}
        </div>
        <p class="tiny muted">${esc(routine.desc)}</p>
      </div>

      <!-- Routine library -->
      <div class="grid c4">
        ${Object.values(ROUTINES).map(r => `
          <button class="card" data-routine="${r.id}" style="text-align:left;cursor:pointer;display:grid;gap:5px;
            ${r.id === routine.id ? 'border-color:var(--accent)' : ''}">
            <div class="row between"><span class="badge c2">${r.mins} min</span></div>
            <div style="font-weight:680;font-size:14.5px">${esc(r.name)}</div>
            <div class="tiny muted">${esc(r.when)}</div>
          </button>`).join('')}
      </div>

      <!-- Tests -->
      <div class="card stack">
        <div class="sec-title">
          <h2>The five tests</h2>
          <a href="#" data-act="run-test">${test ? 'Retest' : 'Run baseline'}</a>
        </div>
        <p class="small muted">Squat · ankle range · hinge · core · shoulders. Five numbers, one movement age — retest every 4 weeks.</p>
        ${scores ? `
          <div class="list" style="border:1px solid var(--line);border-radius:14px;overflow:hidden">
            ${scores.map(({ test: t, raw, score }) => `
              <div class="list-item">
                <span class="badge ${score >= 4 ? 'good' : score >= 3 ? 'accent' : 'warn'}" style="width:34px;justify-content:center">${score}</span>
                <div class="grow">
                  <div class="list-title">${esc(t.name)}</div>
                  <div class="list-sub">${esc(t.scale)}${raw !== '' && raw != null ? ` · recorded ${esc(String(raw))}${t.unit === 'cm' ? 'cm' : t.unit === 'sec' ? 's' : ''}` : ''}</div>
                </div>
                <div style="width:96px">${bar(score * 20, score >= 4 ? '' : 'c3')}</div>
              </div>`).join('')}
          </div>
          <div class="grid c3">
            <div class="stat"><div class="stat-v">${age}</div><div class="stat-k">movement age</div></div>
            <div class="stat"><div class="stat-v">${esc(fmtDate(test.d))}</div><div class="stat-k">last test</div></div>
            <div class="stat"><div class="stat-v">${avg(scores.map(s => s.score)).toFixed(1)}/5</div><div class="stat-k">avg score</div></div>
          </div>
          <button class="btn btn-block" data-act="run-test">${icon('refresh')} Retest now</button>
        ` : `
          <div class="grid c3">
            ${TESTS.map(t => `<div class="card" style="padding:12px">
              <div class="list-title" style="font-size:13.5px">${esc(t.name)}</div>
              <div class="tiny muted" style="margin-top:3px">${esc(t.scale)}</div>
            </div>`).join('')}
          </div>
          <button class="btn btn-primary btn-block btn-lg" data-act="run-test">${icon('target')} Run the baseline — 6 minutes</button>
        `}
      </div>

      ${history.length > 1 ? `
        <div class="card stack">
          <div class="sec-title"><h2>Movement age trend</h2></div>
          <canvas id="age-trend" style="width:100%"></canvas>
          <div class="tiny muted">Target line: 25. Every retest under the last one is real, measurable youth.</div>
        </div>` : ''}
    </div>`;

  hydrateIcons(root);
  animateRings(root);
  bind(root, routine);
  if (history.length > 1) drawTrend(root, history);
}

/* ---------------- hero ---------------- */
function ageHero(age, scores, history) {
  const prev = history.length > 1 ? movementAge(history[history.length - 2]) : null;
  const delta = prev != null ? age - prev : null;
  const to25 = Math.max(0, age - 25);
  const pct = clamp(((50 - age) / 25) * 100, 0, 100);

  return `
    <div class="card pad-lg stack">
      <div class="row between wrap" style="gap:16px">
        <div class="row" style="gap:18px">
          <div class="ring" data-pct="${Math.round(pct)}" style="width:120px;height:120px">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle class="ring-bg" cx="60" cy="60" r="55"></circle>
              <circle class="ring-fg" cx="60" cy="60" r="55" stroke="var(--accent)"></circle>
            </svg>
            <div class="ring-center">
              <div class="ring-val">${age}</div>
              <div class="ring-lab">age</div>
            </div>
          </div>
          <div class="stack" style="gap:5px">
            <div class="eyebrow">Movement age</div>
            <div class="h-hero">${age <= 28 ? 'You move like a 25-year-old' : `${to25} year${to25 === 1 ? '' : 's'} from 25`}</div>
            <p class="small muted" style="max-width:430px">
              Scored from five physical tests, not feelings. ${delta != null
                ? `<b class="${delta < 0 ? 'good' : 'warn'}">${delta < 0 ? `${Math.abs(delta)} years younger` : `${delta} years older`}</b> than your last test.`
                : 'Retest every 4 weeks to see the trend.'}
            </p>
          </div>
        </div>
        <div class="chip-row">
          <span class="chip static">${icon('check', 'sm')} baseline <b>done</b></span>
          <span class="chip static">${icon('calendar', 'sm')} ${esc(fmtDate(latestTest().d))}</span>
        </div>
      </div>
      ${bar(pct)}
      <div class="tiny muted">Progress to movement age 25 — driven by range, control, and every kilo you lose.</div>
    </div>`;
}

function ageEmpty() {
  return `
    <div class="card pad-lg stack" style="text-align:center;gap:12px">
      <div class="avatar-ico" style="width:60px;height:60px;margin:4px auto 0;border-radius:18px">${icon('target', 'lg')}</div>
      <div>
        <div class="h-hero">How old do you move?</div>
        <p class="small muted" style="max-width:440px;margin:6px auto 0">
          Five tests — deep squat, ankle range, hinge, core, shoulders — turn into one number.
          Your goal: <b class="accent">25</b>. Everything in Move trains toward it.
        </p>
      </div>
      <button class="btn btn-primary btn-lg" data-act="run-test" style="justify-self:center">${icon('play')} Run baseline test (6 min)</button>
    </div>`;
}

/* ---------------- guided player ---------------- */
function playerRoutineId() { return player?.routine.id || null; }

function stopPlayer(log = true) {
  if (player?.tick) clearInterval(player.tick);
  if (player && log && player.idx >= player.routine.items.length - 1 && player.left <= 0) return;
  player = null;
}

function startPlayer(routine) {
  const total = routine.items.reduce((a, i) => a + i.dur, 0);
  player = { routine, idx: 0, left: routine.items[0].dur, running: true, elapsed: 0, total, tick: null };
  paintPlayer();
  player.tick = setInterval(() => {
    if (!player || !player.running) return;
    player.left--;
    player.elapsed++;
    if (player.left <= 0) {
      if (player.idx >= player.routine.items.length - 1) return finishPlayer();
      player.idx++;
      player.left = player.routine.items[player.idx].dur;
      beep();
    }
    paintPlayer();
  }, 1000);
  beep();
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); o.frequency.value = 740;
    o.connect(ctx.destination); o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 140);
  } catch { /* silent */ }
}

function paintPlayer() {
  const box = document.getElementById('player-box');
  if (!box || !player) return;
  box.hidden = false;
  const it = player.routine.items[player.idx];
  box.querySelector('#p-count').textContent = `Movement ${player.idx + 1} of ${player.routine.items.length}`;
  box.querySelector('#p-name').textContent = it.name;
  box.querySelector('#p-time').textContent = mmss(player.left);
  box.querySelector('#p-cue').textContent = it.cue;
  const remainTotal = player.routine.items.slice(player.idx).reduce((a, x, i) => a + (i === 0 ? player.left : x.dur), 0);
  box.querySelector('#p-bar').innerHTML = bar((player.elapsed / Math.max(1, player.total)) * 100, 'c2');
  box.querySelector('#p-toggle').innerHTML = player.running
    ? `${icon('pause')} Pause` : `${icon('play')} Resume`;
  box.querySelector('#p-start')?.setAttribute && null;
  hydrateIcons(box);
}

function finishPlayer() {
  const r = player.routine;
  if (player.tick) clearInterval(player.tick);
  const mins = Math.max(1, Math.round(r.mins));
  logMobility(r.id, mins);
  player = null;
  toast(`${r.name} complete — mobility logged, movement age owes you one`, 'good');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/* ---------------- tests modal ---------------- */
function openTestModal() {
  const prev = latestTest();
  const m = modal({
    title: prev ? 'Retest your movement' : 'Baseline movement test',
    body: `
      <p class="small muted">Warm up for 2 minutes first (march + arm circles). Record honestly — a flattering number only delays your real one.</p>
      ${TESTS.map(t => `
        <div class="card" style="padding:13px">
          <div class="row between">
            <div style="font-weight:650">${esc(t.name)}</div>
            <span class="tiny muted">${esc(t.unit)}</span>
          </div>
          <div class="tiny muted" style="margin:4px 0 8px">${esc(t.hint)}</div>
          <div class="row">
            <input class="input num" type="number" inputmode="decimal" data-test="${t.id}"
                   placeholder="${esc(t.scale)}" value="${prev && prev[t.id] != null ? esc(String(prev[t.id])) : ''}" />
            <span class="tiny muted" style="min-width:96px">0–5 → age pts</span>
          </div>
        </div>`).join('')}
      <div class="card" style="background:color-mix(in srgb,var(--accent) 10%,transparent)">
        <p class="tiny">Scoring: thresholds convert each result to 0–5, averaged into a movement age from 50 down to 25.</p>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="t-save">${icon('check')} Calculate movement age</button>`
  });
  hydrateIcons(m.root);
  m.root.querySelector('#t-save').onclick = () => {
    const values = {};
    for (const t of TESTS) {
      const el = m.root.querySelector(`[data-test="${t.id}"]`);
      const v = el.value === '' ? null : Number(el.value);
      if (v === null || Number.isNaN(v)) return toast(`Fill in: ${t.name}`, 'warn');
      values[t.id] = v;
    }
    saveTest(values);
    const age = movementAge();
    closeModal();
    toast(`Movement age: ${age}${age === 25 ? ' — you made it' : ` — ${Math.max(0, age - 25)} from your goal`}`, age <= 30 ? 'good' : '');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

/* ---------------- routine picker ---------------- */
function openRoutinePicker() {
  const m = modal({
    title: 'Pick a routine',
    body: `<div class="stack" style="gap:9px">
      ${Object.values(ROUTINES).map(r => `
        <button class="card" data-pick="${r.id}" style="text-align:left;cursor:pointer">
          <div class="row between"><b>${esc(r.name)}</b><span class="badge c2">${r.mins} min</span></div>
          <div class="tiny muted" style="margin-top:4px">${esc(r.when)} — ${esc(r.desc)}</div>
        </button>`).join('')}
    </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>`
  });
  m.root.querySelector('.modal-body').onclick = e => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    localStorage.setItem('momentum.routine', b.dataset.pick);
    closeModal();
    toast('Routine selected', 'good');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

/* ---------------- trend ---------------- */
function drawTrend(root, history) {
  const canvas = root.querySelector('#age-trend');
  if (!canvas) return;
  import('../charts.js').then(({ lineChart }) => {
    const series = history.map(t => ({ d: t.d, kg: movementAge(t) }));
    lineChart(canvas, { series, goal: 25, height: 180, label: 'y' });
  });
}

/* ---------------- bindings ---------------- */
function bind(root, routine) {
  root.onclick = e => {
    const t = e.target;

    const rt = t.closest('[data-routine]');
    if (rt) {
      localStorage.setItem('momentum.routine', rt.dataset.routine);
      stopPlayer(false);
      return window.dispatchEvent(new HashChangeEvent('hashchange'));
    }

    const act = t.closest('[data-act]');
    if (act) {
      e.preventDefault();
      if (act.dataset.act === 'run-test') return openTestModal();
      if (act.dataset.act === 'pick-routine') return openRoutinePicker();
    }

    if (t.closest('#p-start')) return startPlayer(routine);
    if (t.closest('#p-toggle')) {
      if (!player) return;
      player.running = !player.running;
      return paintPlayer();
    }
    if (t.closest('#p-next')) {
      if (!player) return;
      if (player.idx >= routine.items.length - 1) return finishPlayer();
      player.idx++; player.left = routine.items[player.idx].dur;
      return paintPlayer();
    }
    if (t.closest('#p-prev')) {
      if (!player) return;
      player.idx = Math.max(0, player.idx - 1);
      player.left = routine.items[player.idx].dur;
      return paintPlayer();
    }
    if (t.closest('#p-end')) {
      if (player) { clearInterval(player.tick); player = null; }
      document.getElementById('player-box').hidden = true;
      const box = document.getElementById('p-start');
      if (box) box.innerHTML = `${icon('play')} Start`;
      hydrateIcons(root);
      return toast('Routine stopped — no guilt, run it later today');
    }
  };
}
