/* =========================================================================
   views/today.js — dashboard: briefing, rings, next action, check-ins
   ========================================================================= */

import { dateKey, esc, md, icon, hydrateIcons, fmtDate, nowMin, toMin, round, clamp } from '../utils.js';
import { ringPct, animateRings, bar, toast, modal, navigate, closeModal } from '../ui.js';
import {
  store, todayScores, targets, dayNutrition, patchDaily, getDaily, streak,
  waterML, addWater, latestWeight, sessionsOn, isTrainDay, logWeight, weightStats
} from '../store.js';
import { todayPlan, estSessionMinutes, movementAge, routineForToday } from '../plan.js';
import { briefing } from '../coach.js';
import { openSnapLog } from '../snaplog.js';

export function render(root) {
  const b = briefing();
  const p = store.state.profile;
  const scores = b.scores;
  const plan = b.plan;
  const daily = getDaily(dateKey(), false) || {};
  const mage = movementAge();
  const ws = weightStats();
  const stepPct = Math.round(clamp((daily.steps || 0) / p.stepGoal, 0, 1) * 100);
  const isWork = p.workDays.includes(new Date().getDay());
  const workMin = daily.workMin || (isWork ? Math.max(0, nowMin() - toMin(p.workStart)) : 0);

  root.innerHTML = `
    <div class="stack-lg">

      <!-- Header -->
      <div class="row between wrap">
        <div>
          <div class="eyebrow">${esc(fmtDate(dateKey(), { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
          <div class="h-hero">${esc(b.head)}</div>
        </div>
        <div class="chip-row">
          <span class="chip static">${icon('flame', 'sm')} <b>${b.streak}d</b>&nbsp;streak</span>
          ${mage ? `<span class="chip static">${icon('stretch', 'sm')} age&nbsp;<b>${mage}</b></span>` : ''}
          <span class="chip static">${icon('scale', 'sm')} <b>${esc(String(latestWeight()))}</b>kg</span>
        </div>
      </div>

      <!-- Rings -->
      <div class="card pad-lg stack">
        <div class="rings">
          ${ringPct(scores.train, { label: 'Train', color: 'var(--accent-3)', value: `${scores.train}%` })}
          ${ringPct(scores.fuel, { label: 'Fuel', color: 'var(--accent)', value: `${scores.fuel}%` })}
          ${ringPct(scores.flow, { label: 'Flow', color: 'var(--accent-2)', value: `${scores.flow}%` })}
        </div>
        <div class="grid c3 tiny muted" style="text-align:center">
          <div>${plan.trained ? 'Session logged' : plan.rest ? 'Recovery day' : `${esc(plan.session.title)} pending`} · ${esc(String((daily.steps || 0).toLocaleString()))} steps</div>
          <div>${b.nutr.kcal} / ${b.tg.kcal} kcal · ${b.nutr.protein}/${b.tg.protein}g pro</div>
          <div>${Math.round(workMin / 6) / 10}h work${isWork ? ` · stops ${p.workEnd}` : ' · free day'}</div>
        </div>
      </div>

      <!-- Next action -->
      <div class="card pad-lg" id="next-action">${nextActionHTML({ plan, b, daily, isWork, mage })}</div>

      <!-- Coach briefing -->
      <div class="card stack">
        <div class="sec-title">
          <h2>${icon('brain', 'sm')} Coach briefing</h2>
          <a href="#/coach" data-nav-link>Open coach →</a>
        </div>
        <p class="small" style="line-height:1.65">${md(b.lines.join('\n'))}</p>
        <div class="chip-row">
          <button class="chip" data-ask="What's my plan today?">Plan today</button>
          <button class="chip" data-ask="How many calories left?">Calories left</button>
          <button class="chip" data-ask="What should I eat tonight?">What to eat</button>
        </div>
      </div>

      <!-- Check-ins -->
      <div class="grid c2">
        <div class="card stack">
          <div class="sec-title"><h2>Body check-in</h2></div>

          <div class="field">
            <label>Energy today</label>
            <div class="chip-row" id="energy-row">
              ${[1, 2, 3, 4, 5].map(v => `
                <button class="chip ${(daily.energy || 0) === v ? 'active' : ''}" data-energy="${v}">${v} ${['', 'flat', 'low', 'ok', 'good', 'sharp'][v]}</button>`).join('')}
            </div>
          </div>

          <div class="row between wrap" style="gap:8px">
            <div class="field" style="flex:1;min-width:140px">
              <label>Sleep (hours)</label>
              <div class="row">
                <button class="btn btn-sm" data-sleep="-0.5">−</button>
                <b class="num" style="min-width:52px;text-align:center">${daily.sleepH || 0}h</b>
                <button class="btn btn-sm" data-sleep="0.5">+</button>
              </div>
            </div>
            <div class="field" style="flex:1;min-width:140px">
              <label>Steps</label>
              <div class="row">
                <button class="btn btn-sm" data-steps="500">+500</button>
                <b class="num" style="min-width:52px;text-align:center">${stepPct}%</b>
                <button class="btn btn-sm" data-steps="1500">+1.5k</button>
              </div>
            </div>
          </div>

          <div class="field">
            <label>Water</label>
            <div class="chip-row">
              <button class="chip" data-water="250">${icon('water', 'sm')} +250ml</button>
              <button class="chip" data-water="500">+500ml</button>
              <button class="chip" data-water="750">+750ml</button>
              <span class="chip static">${round(waterML() / 1000, 1)}L / ${round(p.waterGoal / 1000, 1)}L</span>
            </div>
          </div>
        </div>

        <div class="card stack">
          <div class="sec-title"><h2>Quick actions</h2></div>
          <div class="grid" style="gap:9px">
            <button class="btn btn-block" data-act="snap">${icon('eye')} Snap food photo → calories</button>
            <button class="btn btn-block" data-act="focus">${icon('timer')} Start 25-min focus block</button>
            <button class="btn btn-block" data-act="mobility">${icon('stretch')} ${esc(plan.routine.name)} (${plan.routine.mins} min)</button>
            <button class="btn btn-block" data-act="weight">${icon('scale')} Log weight</button>
          </div>
          <div class="row between tiny muted" style="border-top:1px solid var(--line);padding-top:10px">
            <span>Photo privacy</span>
            <span class="good">Read → estimate → deleted</span>
          </div>
          <div class="row between tiny muted">
            <span>Trend</span>
            <span class="num">${ws.lost > 0 ? `${ws.lost} kg lost` : 'starting'} · ${ws.perWeek > 0 ? `${ws.perWeek} kg/wk` : 'no data yet'}</span>
          </div>
        </div>
      </div>

    </div>`;

  hydrateIcons(root);
  root.querySelectorAll('.ring[data-pct]');
  animateRings(root);
  bind(root, { plan, b });
}

/* ---------------- next action ---------------- */
function nextActionHTML({ plan, b, daily, isWork, mage }) {
  const h = new Date().getHours();
  const p = store.state.profile;

  if (isWork && !daily.shutdown && h >= toMin(p.workEnd) / 60) {
    return cta('clock', 'Hard stop reached', `Shut down work, then ${plan.rest ? 'the evening routine' : 'recovery'}. Boundary first — it protects tomorrow's training.`, 'Run shutdown ritual', 'shutdown', 'Switch to Flow', '#/flow');
  }
  if (!plan.rest && !plan.trained) {
    return cta('dumbbell', `${plan.session.title} — today's main event`, `${plan.session.focus}. ~${estSessionMinutes(plan.resolved)} min, warm-up included. Your current progression level is loaded automatically.`, 'Start session', 'start-workout', 'See exercises', '#/body');
  }
  if (plan.trained && !daily.mobilityDone) {
    return cta('stretch', 'Session done — now the range work', `${plan.routine.name}, ${plan.routine.mins} min: ${plan.routine.desc}`, 'Start routine', 'mobility', 'Open Move', '#/move');
  }
  if (b.proteinLeft > 30) {
    return cta('flame', `${b.proteinLeft}g protein still open`, `${b.kcalLeft} kcal left in the day. A high-protein dinner closes it without touching the deficit.`, 'Snap or log dinner', 'snap', 'See recipes', '#/fuel');
  }
  if (!mage) {
    return cta('target', 'Unlock your Movement Age', 'Five simple tests, about 6 minutes. This is the scoreboard for “move like 25”.', 'Run baseline test', 'baseline', 'Open Move', '#/move');
  }
  return cta('check', 'You are on plan', `Rings: train ${b.scores.train} · fuel ${b.scores.fuel} · flow ${b.scores.flow}. Keep the streak alive — steps and sleep are the only things left today.`, 'Close the rings', 'start-workout', 'Open Body', '#/body');
}

function cta(ic, title, sub, label, act, label2, hash2) {
  return `
    <div class="row between wrap" style="gap:14px">
      <div class="row" style="gap:14px;align-items:flex-start;flex:1;min-width:min(240px,100%)">
        <span class="avatar-ico" style="width:44px;height:44px">${icon(ic)}</span>
        <div class="stack" style="gap:4px">
          <div class="h-big">${esc(title)}</div>
          <p class="small muted">${esc(sub)}</p>
        </div>
      </div>
      <div class="chip-row">
        <button class="btn btn-primary" data-act="${act}">${esc(label)}</button>
        <button class="btn" data-goto="${hash2}">${esc(label2)}</button>
      </div>
    </div>`;
}

/* ---------------- bindings ---------------- */
function bind(root, ctx) {
  root.onclick = e => {
    const t = e.target;

    const ask = t.closest('[data-ask]');
    if (ask) {
      sessionStorage.setItem('momentum.pendingAsk', ask.dataset.ask);
      navigate('#/coach');
      return;
    }
    const goto = t.closest('[data-goto]');
    if (goto) return navigate(goto.dataset.goto);

    const en = t.closest('[data-energy]');
    if (en) return patchDaily(dateKey(), { energy: Number(en.dataset.energy) });

    const sl = t.closest('[data-sleep]');
    if (sl) {
      const cur = getDaily().sleepH || 0;
      return patchDaily(dateKey(), { sleepH: clamp(round(cur + Number(sl.dataset.sleep), 1), 0, 14) });
    }
    const st = t.closest('[data-steps]');
    if (st) {
      const cur = getDaily().steps || 0;
      return patchDaily(dateKey(), { steps: cur + Number(st.dataset.steps) });
    }
    const wa = t.closest('[data-water]');
    if (wa) return addWater(Number(wa.dataset.water));

    const act = t.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'snap': openSnapLog(); break;
      case 'focus': {
        import('../ui.js').then(({ focusTimer }) => {
          focusTimer.start((store.state.settings.focusLen || 25) * 60, 'Focus block');
          toast('25-minute focus block running — protect it', 'good');
          navigate('#/flow');
        });
        break;
      }
      case 'mobility': navigate('#/move'); break;
      case 'baseline': navigate('#/move'); break;
      case 'start-workout': navigate('#/body'); break;
      case 'weight': openWeightModal(); break;
      case 'shutdown': {
        patchDaily(dateKey(), { shutdown: true });
        const d = getDaily();
        patchDaily(dateKey(), { workMin: d.workMin || Math.max(0, nowMin() - toMin(store.state.profile.workStart)) });
        toast('Shutdown complete — work is closed for today', 'good');
        navigate('#/flow');
        break;
      }
    }
  };
}

function openWeightModal() {
  const ws = weightStats();
  const m = modal({
    title: 'Log today\'s weight',
    body: `
      <div class="field">
        <label>Weight (kg)</label>
        <input class="input num" id="w-in" type="number" step="0.1" inputmode="decimal" value="${esc(String(ws.now))}" />
      </div>
      <p class="small muted">Weigh first thing, after the bathroom, before food — then the trend line stays clean.</p>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="w-save">${icon('check')} Save</button>`
  });
  hydrateIcons(m.root);
  m.root.querySelector('#w-save').onclick = () => {
    const v = Number(m.root.querySelector('#w-in').value);
    if (!v || v < 30 || v > 300) return toast('Enter a weight between 30 and 300 kg', 'warn');
    logWeight(v);
    closeModal();
    toast(`Logged ${v} kg`, 'good');
  };
}
