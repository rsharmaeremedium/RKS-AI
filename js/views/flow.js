/* =========================================================================
   views/flow.js — work window, focus timer, shutdown ritual, balance score
   ========================================================================= */

import { dateKey, esc, icon, hydrateIcons, toMin, toHHMM, nowMin, round, clamp, fmtDate, mmss, dow, sum } from '../utils.js';
import { toast, bar, focusTimer, modal, closeModal, navigate, confirmDialog } from '../ui.js';
import {
  store, patchDaily, getDaily, isWorkDay, weekStats, todayScores, dayNutrition, targets
} from '../store.js';
import { ROUTINES, todayPlan } from '../plan.js';

const SHUTDOWN_STEPS = [
  'Write tomorrow\'s top 3 (one must be training)',
  'Close every tab and chat — inbox zero is enough',
  'Check the calendar: is tomorrow\'s workout blocked?',
  'Say the line: "Work is done" — physically stand up'
];

let unsubFocus = null;

export function render(root) {
  unsubFocus && unsubFocus();

  const p = store.state.profile;
  const daily = getDaily(dateKey(), false) || {};
  const wk = weekStats();
  const scores = todayScores();
  const isWork = isWorkDay(dateKey());
  const now = nowMin();
  const workMin = daily.workMin || (isWork ? Math.max(0, now - toMin(p.workStart)) : 0);
  const targetWork = toMin(p.workEnd) - toMin(p.workStart);
  const overBy = Math.round((workMin - targetWork) / 6) / 10;

  root.innerHTML = `
    <div class="stack-lg">
      <!-- Header -->
      <div class="row between wrap" style="gap:12px">
        <div>
          <div class="eyebrow">${esc(fmtDate(dateKey(), { weekday: 'long', day: 'numeric', month: 'short' }))} · ${isWork ? 'Work day' : 'Off day'}</div>
          <div class="h-hero">Flow — balance ${wk.balance}<span class="muted" style="font-size:17px">/100</span></div>
        </div>
        <div class="chip-row">
          <span class="chip static">${icon('clock', 'sm')} window <b>${p.workStart}–${p.workEnd}</b></span>
          <span class="chip static">${icon('check', 'sm')} shutdowns <b>${wk.shutdowns}/wk</b></span>
        </div>
      </div>

      <!-- Day timeline -->
      <div class="card stack">
        <div class="sec-title">
          <h2>Today's timeline</h2>
          <a href="#" data-act="add-block">+ Add block</a>
        </div>
        ${timelineHTML(p)}
        <div class="row between tiny muted">
          <span>Work so far: <b class="num">${round(workMin / 60, 1)}h</b> of ${round(targetWork / 60, 1)}h window</span>
          <span class="${overBy > 1 ? 'danger' : overBy > 0 ? 'warn' : 'good'}">
            ${overBy > 0 ? `${overBy}h past stop` : `${Math.abs(overBy)}h inside window`}
          </span>
        </div>
        ${isWork ? bar(clamp((workMin / targetWork) * 100, 0, 140), overBy > 1 ? 'c3' : '') : ''}
      </div>

      <!-- Focus timer + shutdown -->
      <div class="grid c2">
        <div class="card pad-lg stack" style="text-align:center">
          <div class="sec-title" style="text-align:left"><h2>Focus block</h2></div>
          <div class="timer-ring" style="width:180px;height:180px">
            <svg viewBox="0 0 180 180" width="180" height="180">
              <circle class="ring-bg" cx="90" cy="90" r="82"></circle>
              <circle class="ring-fg" id="focus-fg" cx="90" cy="90" r="82"
                stroke-dasharray="0 515"></circle>
            </svg>
            <div>
              <div class="timer-face" id="focus-face" style="font-size:38px">${mmss((store.state.settings.focusLen || 25) * 60)}</div>
              <div class="tiny muted" id="focus-label">ready</div>
            </div>
          </div>
          <div class="chip-row" style="justify-content:center" id="focus-presets">
            ${[15, 25, 50].map(m => `<button class="chip" data-focus-min="${m}">${m} min</button>`).join('')}
          </div>
          <div class="row" style="justify-content:center">
            <button class="btn btn-primary" id="focus-toggle">${icon('play')} Start</button>
            <button class="btn btn-ghost" id="focus-reset">${icon('refresh')} Reset</button>
          </div>
          <p class="tiny muted">Deep work gets counted as personal fuel too — ${sum(store.state.focus.map(f => f.minutes))} min logged all-time.</p>
        </div>

        <div class="card pad-lg stack">
          <div class="sec-title"><h2>Shutdown ritual</h2>
            <span class="badge ${daily.shutdown ? 'good' : ''}">${daily.shutdown ? 'done' : 'pending'}</span>
          </div>
          <p class="small muted">The boundary that makes training possible. Four steps, then work stops existing.</p>
          <div class="list" style="border:1px solid var(--line);border-radius:14px;overflow:hidden" id="shutdown-list">
            ${SHUTDOWN_STEPS.map((s, i) => `
              <button class="list-item" data-step="${i}">
                <span class="avatar-ico" style="width:30px;height:30px;border-radius:9px">${daily.shutdown ? icon('check', 'sm') : i + 1}</span>
                <span class="grow small">${esc(s)}</span>
              </button>`).join('')}
          </div>
          <button class="btn ${daily.shutdown ? '' : 'btn-primary'} btn-block" id="shutdown-go" ${daily.shutdown ? 'disabled' : ''}>
            ${daily.shutdown ? '✅ Work closed for today' : icon('moon') + ' Run shutdown at ' + p.workEnd}
          </button>
        </div>
      </div>

      <!-- Week -->
      <div class="grid c2">
        <div class="card stack">
          <div class="sec-title"><h2>Work hours this week</h2>
            <span class="tiny muted">target ${round(wk.targetWork / 60, 0)}h</span></div>
          <canvas id="week-work" style="width:100%"></canvas>
          <div class="tiny muted">Bars in amber ran past the window. Overwork is the #1 killer of a training week.</div>
        </div>

        <div class="card stack">
          <div class="sec-title"><h2>This week's numbers</h2></div>
          <div class="grid c2">
            <div class="stat"><div class="stat-v">${round(sum(wk.workMin) / 60, 1)}h</div><div class="stat-k">worked</div></div>
            <div class="stat"><div class="stat-v">${round(wk.focus / 60, 1)}h</div><div class="stat-k">deep focus</div></div>
            <div class="stat"><div class="stat-v">${wk.workouts}</div><div class="stat-k">sessions</div></div>
            <div class="stat"><div class="stat-v">${round(wk.mobility / 60, 1)}h</div><div class="stat-k">mobility</div></div>
          </div>
          <div class="stack" style="gap:7px">
            <div class="row between tiny"><span>Balance score</span><b>${wk.balance}/100</b></div>
            ${bar(wk.balance, wk.balance < 50 ? 'c3' : '')}
            <div class="row between tiny"><span>Strong days</span><b>${wk.balanceDays}/7</b></div>
            ${bar((wk.balanceDays / 7) * 100)}
          </div>
          <div class="card" style="background:color-mix(in srgb,var(--accent-2) 10%,transparent)">
            <p class="small">${esc(insight(wk, p))}</p>
          </div>
        </div>
      </div>

      <!-- Personal blocks -->
      <div class="card flush">
        <div class="list">
          <div class="list-item" style="padding-top:15px">
            <div class="grow">
              <div class="list-title">Logged blocks</div>
              <div class="list-sub">Training, deep work, family, walk — whatever you protected</div>
            </div>
            <button class="btn btn-sm" data-act="add-block">${icon('plus', 'sm')} Block</button>
          </div>
          ${blocksTodayHTML()}
        </div>
      </div>
    </div>`;

  hydrateIcons(root);
  bind(root);
  startFocusUI(root);
  drawWeek(root);
}

/* ---------------- timeline ---------------- */
function timelineHTML(p) {
  const wake = toMin(p.wake), sleep = toMin(p.sleep) || 1440;
  const start = Math.min(wake, toMin(p.workStart) - 60);
  const end = Math.max(sleep + 60, toMin(p.workEnd) + 120);
  const span = Math.max(60, end - start);
  const pos = m => clamp(((m - start) / span) * 100, 0, 100);

  const segs = [];
  segs.push({ type: 'work', s: toMin(p.workStart), e: toMin(p.workEnd), label: 'Work' });

  store.state.blocks.filter(b => b.d === dateKey()).forEach(b => {
    segs.push({ type: b.type, s: toMin(b.start), e: toMin(b.end), label: b.label || b.type });
  });
  store.state.focus.filter(f => f.d === dateKey()).forEach(f => {
    const t = new Date(f.ts);
    const s = t.getHours() * 60 + t.getMinutes();
    segs.push({ type: 'deep', s, e: s + f.minutes, label: 'Focus' });
  });
  const plan = todayPlan();
  if (!plan.rest) {
    segs.push({ type: 'train', s: toMin(p.workEnd) + 15, e: toMin(p.workEnd) + 75, label: plan.session.title });
  }

  const nowP = pos(nowMin());
  return `
    <div class="timeline">
      <div class="tl-track">
        ${segs.map(s => `
          <div class="tl-seg ${s.type}" style="left:${pos(s.s)}%;width:${Math.max(2, pos(s.e) - pos(s.s))}%">
            ${pos(s.e) - pos(s.s) > 9 ? esc(s.label) : ''}
          </div>`).join('')}
        <div class="tl-seg now" style="left:${nowP}%;width:2px;background:var(--text);outline:none">
        </div>
      </div>
      <div class="tl-axis">
        <span>${toHHMM(start)}</span>
        <span>now ${toHHMM(nowMin())}</span>
        <span>${toHHMM(end)}</span>
      </div>
      <div class="chip-row tiny">
        <span class="chip static"><i style="width:9px;height:9px;border-radius:3px;background:color-mix(in srgb,var(--accent-2) 60%,transparent);display:inline-block"></i> Work</span>
        <span class="chip static"><i style="width:9px;height:9px;border-radius:3px;background:color-mix(in srgb,var(--accent) 70%,transparent);display:inline-block"></i> Deep</span>
        <span class="chip static"><i style="width:9px;height:9px;border-radius:3px;background:color-mix(in srgb,var(--accent-3) 70%,transparent);display:inline-block"></i> Training</span>
        <span class="chip static"><i style="width:9px;height:9px;border-radius:3px;background:color-mix(in srgb,var(--good) 60%,transparent);display:inline-block"></i> Personal</span>
      </div>
    </div>`;
}

function blocksTodayHTML() {
  const rows = store.state.blocks.filter(b => b.d === dateKey()).slice().reverse();
  if (!rows.length) return `
    <div class="empty">${icon('clock', 'lg')}<h3>No blocks protected yet</h3>
      <p>Block training first, then one personal block. They are appointments, not leftovers.</p></div>`;
  return rows.map(b => `
    <div class="list-item">
      <span class="avatar-ico">${icon(b.type === 'train' ? 'dumbbell' : b.type === 'deep' ? 'brain' : b.type === 'personal' ? 'heart' : 'clock')}</span>
      <div class="grow">
        <div class="list-title">${esc(b.label || b.type)}</div>
        <div class="list-sub">${b.start} – ${b.end} · ${b.type}</div>
      </div>
      <button class="icon-btn" data-del-block="${b.id}" aria-label="Remove">${icon('trash', 'sm')}</button>
    </div>`).join('');
}

function insight(wk, p) {
  const h = round(sum(wk.workMin) / 60, 1);
  const w = wk.workouts;
  if (wk.overRatio > 1.25) return `You're ${Math.round((wk.overRatio - 1) * 100)}% over your work window. Cut one recurring meeting or set a hard stop — ${w} session${w === 1 ? '' : 's'} this week won't survive that pace.`;
  if (w < 3) return `${h}h worked is fine, but only ${w} sessions landed. Protect the training slot first — it's the thing everything else depends on.`;
  if (wk.shutdowns < 3) return `Strong training week (${w} sessions) but only ${wk.shutdowns} shutdowns. Without the closing ritual the work bleeds into recovery and sleep.`;
  return `Healthy week: ${h}h work, ${w} sessions, ${wk.shutdowns} shutdowns. This is the pattern that gets you to 82kg without burning out.`;
}

/* ---------------- focus timer UI ---------------- */
function startFocusUI(root) {
  const face = root.querySelector('#focus-face');
  const fg = root.querySelector('#focus-fg');
  const label = root.querySelector('#focus-label');
  const toggle = root.querySelector('#focus-toggle');
  const reset = root.querySelector('#focus-reset');
  if (!face) return;

  const C = 2 * Math.PI * 82;

  unsubFocus = focusTimer.subscribe(s => {
    if (!document.body.contains(face)) return;
    face.textContent = mmss(s.left || (store.state.settings.focusLen || 25) * 60);
    fg.setAttribute('stroke-dasharray', `${((s.pct || 100) / 100) * C} ${C}`);
    label.textContent = s.running ? (s.label || 'focusing') : s.left ? 'paused' : 'ready';
    toggle.innerHTML = s.running
      ? `${icon('pause')} Pause`
      : s.left ? `${icon('play')} Resume` : `${icon('play')} Start`;
    hydrateIcons(toggle);
  });

  toggle.onclick = () => {
    const s = focusTimer.get();
    if (s.running) focusTimer.pause();
    else if (s.left) focusTimer.resume();
    else {
      focusTimer.start((store.state.settings.focusLen || 25) * 60, 'Focus block');
      toast('Focus block started — nothing else matters for now', 'good');
    }
  };
  reset.onclick = () => { focusTimer.stop(); toast('Timer reset'); };

  root.querySelector('#focus-presets').onclick = e => {
    const b = e.target.closest('[data-focus-min]');
    if (!b) return;
    const m = Number(b.dataset.focusMin);
    store.set(s => { s.settings.focusLen = m; });
    focusTimer.stop();
    face.textContent = mmss(m * 60);
    root.querySelectorAll('[data-focus-min]').forEach(x => x.classList.toggle('active', x === b));
  };
  const active = root.querySelector(`[data-focus-min="${store.state.settings.focusLen || 25}"]`);
  active && active.classList.add('active');
}

/* ---------------- week chart ---------------- */
function drawWeek(root) {
  const canvas = root.querySelector('#week-work');
  if (!canvas) return;
  const wk = weekStats();
  const p = store.state.profile;
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const values = wk.days.map((d, i) => {
    const v = round(wk.workMin[i] / 60, 1);
    const limit = toMin(p.workEnd) - toMin(p.workStart);
    return {
      label: names[i], v, max: Math.max(limit / 60, ...wk.workMin.map(x => x / 60)),
      color: wk.workMin[i] > limit * 1.15 ? 'var(--warn)' : undefined
    };
  });
  import('../charts.js').then(({ barChart }) => barChart(canvas, { values, height: 160, suffix: 'h' }));
}

/* ---------------- bindings ---------------- */
function bind(root) {
  root.onclick = async e => {
    const t = e.target;

    const step = t.closest('[data-step]');
    if (step) return completeShutdown();

    const del = t.closest('[data-del-block]');
    if (del) {
      store.set(s => { s.blocks = s.blocks.filter(b => b.id !== del.dataset.delBlock); });
      return toast('Block removed');
    }

    if (t.closest('#shutdown-go')) return completeShutdown();

    const act = t.closest('[data-act]');
    if (!act) return;
    e.preventDefault();
    if (act.dataset.act === 'add-block') openBlockModal();
  };
}

function completeShutdown() {
  const daily = getDaily(dateKey(), false) || {};
  if (daily.shutdown) return;
  const d = new Date();
  patchDaily(dateKey(), {
    shutdown: true,
    workMin: daily.workMin || Math.max(0, d.getHours() * 60 + d.getMinutes() - toMin(store.state.profile.workStart))
  });
  toast('Work is closed. The evening — and tomorrow\'s training — just got easier.', 'good');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function openBlockModal() {
  const p = store.state.profile;
  const m = modal({
    title: 'Protect a block',
    body: `
      <div class="field"><label>What is it?</label>
        <input class="input" id="b-label" placeholder="e.g. Evening walk with family" /></div>
      <div class="field"><label>Type</label>
        <select class="input" id="b-type">
          <option value="personal">Personal / family</option>
          <option value="train">Training</option>
          <option value="deep">Deep work</option>
          <option value="work">Work</option>
        </select></div>
      <div class="form-grid">
        <div class="field"><label>Start</label><input class="input" id="b-start" type="time" value="${p.workEnd}" /></div>
        <div class="field"><label>End</label><input class="input" id="b-end" type="time" value="${toHHMM(toMin(p.workEnd) + 45)}" /></div>
      </div>
      <p class="tiny muted">Blocks appear on today's timeline and feed the Flow score.</p>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="b-save">${icon('check')} Protect it</button>`
  });
  hydrateIcons(m.root);
  m.root.querySelector('#b-save').onclick = () => {
    const label = m.root.querySelector('#b-label').value.trim() || 'Block';
    const type = m.root.querySelector('#b-type').value;
    const start = m.root.querySelector('#b-start').value;
    const end = m.root.querySelector('#b-end').value;
    if (toMin(end) <= toMin(start)) return toast('End must be after start', 'warn');

    store.set(s => {
      s.blocks.push({ id: Math.random().toString(36).slice(2, 9), d: dateKey(), label, type, start, end });
      if (type === 'train') s.blocks.sort((a, b) => 0);
    });
    if (type === 'train') patchDaily(dateKey(), { mobilityDone: true });
    closeModal();
    toast(`${label} protected — treat it like a client meeting`, 'good');
  };
}
