/* =========================================================================
   views/body.js — today's session, set logger, rest timer, progression
   ========================================================================= */

import { dateKey, esc, icon, hydrateIcons, mmss, fmtDate, clamp, round, dow } from '../utils.js';
import { toast, bar, restTimer, navigate, modal, closeModal } from '../ui.js';
import {
  store, patchDaily, getDaily, isTrainDay, sessionsOn, addSession, persist
} from '../store.js';
import {
  todayPlan, resolveSession, estSessionMinutes, currentPhase, CHAINS,
  getTier, progressOf, maxLevel, evaluateProgression, PHASES, ROUTINES, sessionForDate
} from '../plan.js';

let unsubTimer = null;

export function render(root) {
  unsubTimer && unsubTimer();
  unsubTimer = null;

  const plan = todayPlan();
  const phase = currentPhase();
  const resolved = plan.resolved;
  const draft = ensureDraft(plan);
  const history = [...store.state.sessions].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 8);
  const weekCount = countWeekSessions();

  root.innerHTML = `
    <div class="stack-lg">

      <!-- Phase banner -->
      <div class="card pad-lg row between wrap" style="gap:14px">
        <div class="stack" style="gap:5px">
          <div class="eyebrow">Phase ${phase.n} · Week ${phase.weekInPhase} of ${phase.weeks}</div>
          <div class="h-hero">${esc(phase.name)}</div>
          <p class="small muted">${esc(phase.intent)}</p>
        </div>
        <div class="grid c3" style="min-width:min(280px, 100%)">
          <div class="stat"><div class="stat-v">${weekCount}</div><div class="stat-k">sessions / wk</div></div>
          <div class="stat"><div class="stat-v">${Object.keys(store.state.progress.exercises).length}</div><div class="stat-k">chains active</div></div>
          <div class="stat"><div class="stat-v">${esc(String(phase.week))}</div><div class="stat-k">total week</div></div>
        </div>
      </div>

      <!-- Today's session -->
      <div class="card pad-lg stack" id="session-card">
        <div class="row between wrap" style="gap:10px">
          <div class="row" style="gap:12px">
            <span class="avatar-ico" style="width:44px;height:44px">${icon(plan.rest ? 'stretch' : 'dumbbell')}</span>
            <div>
              <div class="h-big">${esc(plan.session.title)} ${plan.trained ? '<span class="badge good">logged</span>' : plan.rest ? '<span class="badge c2">recovery</span>' : '<span class="badge accent">due</span>'}</div>
              <div class="small muted">${esc(plan.session.focus)} · ~${estSessionMinutes(resolved)} min</div>
            </div>
          </div>
          <div class="chip-row">
            <button class="chip" data-act="swap">↻ Shift today</button>
            <button class="chip" data-act="week">Week view</button>
          </div>
        </div>

        <div class="stack" style="gap:12px">
          ${resolved.map((slot, idx) => slotHTML(slot, idx, draft)).join('')}
        </div>

        ${plan.trained ? '' : `
          <button class="btn btn-primary btn-lg btn-block" data-act="finish-session" id="finish-session">
            ${icon('check')} Finish & log session
          </button>`}
      </div>

      <!-- Weekly calendar -->
      <div class="card stack">
        <div class="sec-title"><h2>This week</h2><a href="#/progress">History →</a></div>
        <div class="row wrap" style="gap:8px">
          ${weekStrip()}
        </div>
      </div>

      <!-- History -->
      <div class="card flush">
        <div class="list">
          <div class="list-item" style="padding-top:15px">
            <div class="grow"><div class="list-title">Recent sessions</div>
            <div class="list-sub">${store.state.sessions.length} total logged</div></div>
          </div>
          ${history.length ? history.map(s => `
            <div class="list-item">
              <span class="avatar-ico">${icon('dumbbell')}</span>
              <div class="grow">
                <div class="list-title">${esc(s.name || 'Session')}</div>
                <div class="list-sub">${esc(fmtDate(s.d))} · ${s.items?.length || 0} movements · ${s.durationMin ? s.durationMin + ' min' : 'timed'}</div>
              </div>
              <span class="badge">${esc(String(s.setsTotal || (s.items || []).reduce((a, i) => a + (i.sets?.length || 0), 0)))} sets</span>
            </div>`).join('') : `
            <div class="empty">${icon('dumbbell', 'lg')}<h3>No sessions yet</h3>
            <p>Run today's plan once and your history, streak and progression start building.</p></div>`}
        </div>
      </div>
    </div>

    <div id="rest-slot"></div>`;

  hydrateIcons(root);
  bind(root, { plan, draft });
  renderRestBar(root);
}

/* ---------------- slot rendering ---------------- */
function slotHTML(slot, idx, draft) {
  if (slot.type === 'mobility') {
    const r = ROUTINES[slot.routine] || ROUTINES.evening;
    return `
      <div class="card" style="background:var(--surface-2)">
        <div class="row between wrap" style="gap:10px">
          <div class="row" style="gap:10px">
            <span class="avatar-ico">${icon('stretch')}</span>
            <div>
              <div class="list-title">${esc(r.name)} · ${r.mins} min</div>
              <div class="list-sub">${esc(r.desc)}</div>
            </div>
          </div>
          <button class="btn btn-sm" data-goto="#/move">Start</button>
        </div>
      </div>`;
  }

  if (slot.type === 'walk') {
    const steps = getDaily().steps || 0;
    const goal = store.state.profile.stepGoal;
    return `
      <div class="card" style="background:var(--surface-2)">
        <div class="row between">
          <div class="row" style="gap:10px">
            <span class="avatar-ico">${icon('steps')}</span>
            <div>
              <div class="list-title">Step target</div>
              <div class="list-sub">${steps.toLocaleString()} / ${goal.toLocaleString()} steps</div>
            </div>
          </div>
          <div style="width:120px">${bar(clamp(steps / goal * 100, 0, 100))}</div>
        </div>
      </div>`;
  }

  if (slot.type === 'finisher') {
    const tier = slot.tier;
    const key = slot.chain;
    return `
      <div class="card" style="background:var(--surface-2)" data-finisher="${key}">
        <div class="row between wrap" style="gap:10px">
          <div>
            <div class="list-title">${esc(tier.name)} — finisher</div>
            <div class="list-sub">${slot.rounds} rounds · ${slot.work}s work / ${slot.rest}s rest · ${esc(slot.chainLabel)}</div>
          </div>
          <div class="row" style="gap:8px">
            <b class="mono num" data-circuit-display style="font-size:19px;min-width:56px;text-align:right">–</b>
            <button class="btn btn-sm btn-primary" data-act="circuit">${icon('play', 'sm')} Circuit</button>
          </div>
        </div>
      </div>`;
  }

  // main movement
  const chain = CHAINS[slot.chain];
  const prog = progressOf(slot.chain);
  const d = draft.items[slot.chain];
  const allDone = d.sets.every(s => s.done);
  const nextTier = prog.level < maxLevel(slot.chain) ? getTier(slot.chain, prog.level + 1) : null;

  return `
    <div class="card" data-ex="${slot.chain}" style="${allDone ? 'border-color:color-mix(in srgb,var(--good) 40%,var(--line))' : ''}">
      <div class="row between wrap" style="gap:8px">
        <div>
          <div class="list-title">${esc(slot.tier.name)}
            <span class="badge ${allDone ? 'good' : ''}">L${prog.level + 1}</span>
          </div>
          <div class="list-sub">${slot.sets} × ${slot.reps[0]}–${slot.reps[1]}${slot.unit === 's' ? 's' : ' reps'} · rest ${slot.rest}s · target RPE ${slot.rpe}</div>
        </div>
        <div class="chip-row tiny muted">
          <span class="chip static">${esc(chain.label)}</span>
          ${nextTier ? `<span class="chip static" title="Promote after 2 clean sessions">next: ${esc(nextTier.name)}</span>` : `<span class="chip static">top tier</span>`}
        </div>
      </div>

      <details style="margin-top:8px">
        <summary class="small muted" style="cursor:pointer">Cues (${slot.tier.cues.length})</summary>
        <ul class="small muted" style="margin:7px 0 0;padding-left:18px;display:grid;gap:3px">
          ${slot.tier.cues.map(c => `<li>${esc(c)}</li>`).join('')}
        </ul>
        ${slot.tier.kit && slot.tier.kit !== 'none' ? `<div class="tiny muted-2" style="margin-top:6px">Uses: ${esc(slot.tier.kit)}</div>` : ''}
      </details>

      <div class="stack" style="gap:6px;margin-top:11px">
        ${d.sets.map((s, i) => `
          <div class="row" style="gap:8px">
            <span class="badge" style="width:34px;justify-content:center">${i + 1}</span>
            <input class="input num" data-reps="${slot.chain}" data-set="${i}" type="number" inputmode="numeric"
                   value="${s.reps}" style="width:78px;padding:8px 10px" aria-label="reps for set ${i + 1}" />
            <span class="tiny muted" style="width:38px">${slot.unit === 's' ? 'sec' : 'reps'}</span>
            <select class="input" data-rpe="${slot.chain}" data-set="${i}" style="width:96px;padding:8px 10px" aria-label="effort">
              ${[5, 6, 7, 8, 9, 10].map(v => `<option value="${v}" ${s.rpe === v ? 'selected' : ''}>RPE ${v}</option>`).join('')}
            </select>
            <button class="btn btn-sm ${s.done ? 'btn-primary' : ''}" data-done="${slot.chain}" data-set="${i}" style="margin-left:auto;min-width:74px">
              ${s.done ? icon('check', 'sm') + ' done' : 'Log set'}
            </button>
          </div>`).join('')}
      </div>

      ${allDone && !d.logged ? `
        <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="complete-ex" data-chain="${slot.chain}">
          ${icon('award')} Complete ${esc(slot.tier.name)}
        </button>` : ''}
      ${d.logged ? `<div class="tiny good" style="margin-top:9px">${icon('check', 'sm')} Logged — progression updated</div>` : ''}
    </div>`;
}

/* ---------------- draft (in-progress session) ---------------- */
function ensureDraft(plan) {
  const d = dateKey();
  let draft = store.state.draft;

  if (!draft || draft.d !== d || draft.key !== plan.session.key) {
    const items = {};
    plan.resolved.filter(s => s.type === 'main').forEach(slot => {
      const tier = slot.tier;
      const prev = draft && draft.d === d ? draft.items[slot.chain] : null;
      items[slot.chain] = {
        sets: prev ? prev.sets : Array.from({ length: slot.sets }, (_, i) => ({
          reps: Math.round((slot.reps[0] + slot.reps[1]) / 2),
          rpe: slot.rpe, done: false
        })),
        logged: prev ? prev.logged : false,
        unit: slot.unit, target: slot.reps
      };
    });
    store.state.draft = { d, key: plan.session.key, items };
    persist();
  }

  // keep set count in sync with current prescription
  plan.resolved.filter(s => s.type === 'main').forEach(slot => {
    const item = store.state.draft.items[slot.chain];
    if (!item) return;
    while (item.sets.length < slot.sets) item.sets.push({ reps: Math.round((slot.reps[0] + slot.reps[1]) / 2), rpe: slot.rpe, done: false });
    item.unit = slot.unit;
    item.target = slot.reps;
  });
  return store.state.draft;
}

function countWeekSessions() {
  const today = dateKey();
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const k = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate() + i).padStart(2, '0')}`;
    n += sessionsOn(k).length;
  }
  return n;
}

function weekStrip() {
  const today = dateKey();
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return names.map((n, i) => {
    const dt = new Date(start); dt.setDate(start.getDate() + i);
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const s = sessionForDate(k);
    const done = sessionsOn(k).length > 0;
    const isToday = k === today;
    const isTrain = isTrainDay(k);
    return `
      <div class="card" style="padding:10px;text-align:center;flex:1;min-width:74px;
        ${isToday ? 'border-color:var(--accent)' : ''}
        ${done ? 'background:color-mix(in srgb,var(--good) 12%,var(--surface))' : ''}">
        <div class="tiny muted">${n}</div>
        <div style="font-weight:700;margin-top:3px">${done ? '✓' : isTrain ? esc(s.key) : '–'}</div>
        <div class="tiny ${done ? 'good' : 'muted-2'}">${done ? 'done' : isTrain ? esc(s.title.split(' ')[0]) : 'rest'}</div>
      </div>`;
  }).join('');
}

/* ---------------- rest timer bar ---------------- */
function renderRestBar(root) {
  const slot = root.querySelector('#rest-slot');
  if (!slot) return;
  unsubTimer = restTimer.subscribe(s => {
    if (!document.body.contains(slot)) return;
    if (!s.total && !s.running) { slot.innerHTML = ''; return; }
    const html = `
      <div class="card" style="position:fixed;left:50%;transform:translateX(-50%);
        bottom:calc(${window.innerWidth < 1024 ? 'var(--tabbar-h) + 8px' : '18px'});z-index:60;
        width:min(430px,calc(100vw - 28px));box-shadow:var(--shadow);display:flex;gap:14px;align-items:center">
        <div class="mono num" style="font-size:30px;min-width:96px">${mmss(s.left)}</div>
        <div style="flex:1">
          <div class="tiny muted" style="margin-bottom:5px">${s.running ? 'Resting — breathe, shake it out' : 'Paused'}</div>
          ${bar(s.pct)}
        </div>
        <button class="btn btn-sm" data-act="rest-toggle">${s.running ? icon('pause', 'sm') : icon('play', 'sm')}</button>
        <button class="btn btn-sm btn-ghost" data-act="rest-skip">Skip</button>
      </div>`;
    if (slot.dataset.html !== html) { slot.innerHTML = html; slot.dataset.html = html; hydrateIcons(slot); }
  });
}

/* ---------------- bindings ---------------- */
function bind(root, { plan, draft }) {
  root.onclick = e => {
    const t = e.target;

    const goto = t.closest('[data-goto]');
    if (goto) return navigate(goto.dataset.goto);

    const done = t.closest('[data-done]');
    if (done) {
      const chain = done.dataset.done, i = Number(done.dataset.set);
      const item = draft.items[chain];
      const set = item.sets[i];
      set.done = !set.done;
      persist();

      if (set.done && item.sets.every(s => s.done)) {
        toast('All sets in — finish the movement below', 'good');
      } else if (set.done) {
        restTimer.start(store.state.settings.restSec || 75, 'Rest');
      }
      return rerender(root);
    }

    const comp = t.closest('[data-act="complete-ex"]');
    if (comp) {
      const chain = comp.dataset.chain;
      const item = draft.items[chain];
      const slot = plan.resolved.find(s => s.chain === chain);
      const result = evaluateProgression(chain, item.sets, item.unit);
      item.logged = true;
      persist();
      if (result?.promoted) {
        toast(`Unlocked: ${result.to.name} — you earned the next level`, 'good');
      } else if (result && result.need > 0) {
        toast(`${result.need} more clean session(s) at this level to promote`, 'warn');
      } else {
        toast('Movement logged', 'good');
      }
      return rerender(root);
    }

    const act = t.closest('[data-act]');
    if (!act) return;

    switch (act.dataset.act) {
      case 'rest-toggle': restTimer.running ? restTimer.pause() : restTimer.resume(); break;
      case 'rest-skip': restTimer.stop(); break;
      case 'circuit': runCircuit(act, plan.resolved.find(s => s.type === 'finisher')); break;
      case 'finish-session': finishSession(plan, draft); break;
      case 'swap': shiftDay(); break;
      case 'week': navigate('#/progress'); break;
    }
  };

  root.onchange = e => {
    const reps = e.target.closest('[data-reps]');
    if (reps) {
      const item = draft.items[reps.dataset.reps];
      item.sets[Number(reps.dataset.set)].reps = clamp(Number(reps.value) || 0, 0, 999);
      persist();
      return;
    }
    const rpe = e.target.closest('[data-rpe]');
    if (rpe) {
      const item = draft.items[rpe.dataset.rpe];
      item.sets[Number(rpe.dataset.set)].rpe = Number(rpe.value);
      persist();
    }
  };
}

function rerender(root) {
  // cheap targeted re-render of the session card
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/* ---------------- circuit timer ---------------- */
let circuitId = null;
function runCircuit(btn, slot) {
  if (!slot) return;
  clearInterval(circuitId);
  let phase = 'work', left = slot.work, round = 1;
  const card = btn.closest('[data-finisher]');
  const disp = card.querySelector('[data-circuit-display]');
  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); o.frequency.value = phase === 'work' ? 880 : 520;
      o.connect(ctx.destination); o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 160);
    } catch { /* audio blocked — silent is fine */ }
  };
  const paint = () => { disp.textContent = `${round}/${slot.rounds} ${mmss(left)}`; };
  beep(); paint();
  circuitId = setInterval(() => {
    left--;
    if (left <= 0) {
      if (phase === 'work') { phase = 'rest'; left = slot.rest; }
      else {
        round++;
        if (round > slot.rounds) {
          clearInterval(circuitId); circuitId = null;
          disp.textContent = 'done ✓';
          toast('Finisher complete — that\'s the session', 'good');
          return;
        }
        phase = 'work'; left = slot.work;
      }
      beep();
    }
    paint();
  }, 1000);
}

/* ---------------- finish session ---------------- */
function finishSession(plan, draft) {
  const items = plan.resolved.filter(s => s.type === 'main').map(s => ({
    chain: s.chain, name: s.tier?.name || s.chain,
    sets: (draft.items[s.chain]?.sets || []).filter(x => x.done).map(x => ({ reps: x.reps, rpe: x.rpe }))
  })).filter(x => x.sets.length);

  if (!items.length && !plan.rest) {
    return toast('Log at least one set first — or shift today', 'warn');
  }

  addSession({
    name: plan.session.title,
    focus: plan.session.focus,
    key: plan.session.key,
    items,
    setsTotal: items.reduce((a, i) => a + i.sets.length, 0),
    durationMin: estSessionMinutes(plan.resolved),
    rest: !!plan.rest
  });
  patchDaily(dateKey(), {});
  if (plan.rest) patchDaily(dateKey(), { mobilityDone: true, mobilityMin: (getDaily().mobilityMin || 0) + (plan.routine.mins || 10) });

  store.state.draft = null;
  persist();
  toast(plan.rest ? 'Recovery day logged' : `${plan.session.title} session logged — protein and sleep do the rest`, 'good');
  rerender(document.getElementById('view'));
}

function shiftDay() {
  const order = ['A', 'B', 'C', 'D'];
  const cur = store.state.profile.trainDays;
  modal({
    title: 'Shift today\'s session',
    body: `<p class="small muted">Pick a different movement day. The plan rotates by training day, so choosing another one swaps the session without losing your week.</p>
      <div class="chip-row" id="shift-row">
        ${cur.slice().sort((a, b) => a - b).map(d => `<button class="chip" data-shift="${d}">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}</button>`).join('')}
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>`
  }).root.querySelector('#shift-row').onclick = e => {
    const b = e.target.closest('[data-shift]');
    if (!b) return;
    const idx = cur.indexOf(Number(b.dataset.shift));
    closeModal();
    const key = order[idx % order.length];
    toast(`Swapped to session ${key} — track it as today's`, 'warn');
    navigate('#/body');
  };
}
