/* =========================================================================
   onboarding.js — first-run wizard: body → training → schedule → targets
   ========================================================================= */

import { esc, icon, hydrateIcons, clamp, dateKey } from './utils.js';
import { toast } from './ui.js';
import { store, targets, bmr, logWeight } from './store.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let step = 0;
let draft = null;

export function showOnboarding(root) {
  step = 0;
  draft = JSON.parse(JSON.stringify(store.state.profile));
  draft.phaseStart = dateKey();
  paint(root);
}

function paint(root) {
  const tg = targets(draft);
  const total = 5;
  root.innerHTML = `
    <div class="onb">
      <div class="onb-top">
        <span class="brand-mark" style="color:var(--accent)">
          <svg viewBox="0 0 32 32" width="24" height="24"><path d="M4 24 L12 12 L18 19 L28 6" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="6" r="3.2" fill="currentColor"/></svg>
        </span>
        <div class="onb-progress"><i style="width:${((step + 1) / total) * 100}%"></i></div>
        <span class="tiny muted num">${step + 1}/${total}</span>
      </div>

      <div class="onb-body">${body(step, tg)}</div>

      <div class="onb-foot">
        <button class="btn btn-ghost" id="onb-back" ${step === 0 ? 'disabled' : ''}>Back</button>
        <button class="btn btn-primary" id="onb-next">${step === total - 1 ? 'Start my plan' : 'Continue'}</button>
      </div>
    </div>`;

  hydrateIcons(root);
  root.querySelector('#onb-back').onclick = () => { step = Math.max(0, step - 1); paint(root); };
  root.querySelector('#onb-next').onclick = () => {
    if (!validate(root)) return;
    if (step < total - 1) { step++; paint(root); }
    else finish(root);
  };
  bindInputs(root);
}

function body(i, tg) {
  switch (i) {
    case 0: return `
      <div>
        <h2>100kg → muscular.<br>Move like you're 25.</h2>
        <p class="sub">Momentum runs the whole loop: bodyweight training that progresses itself, food coaching built for Indian
          kitchens, hard work boundaries, and a movement-age scoreboard. Five questions and your plan starts.</p>
      </div>
      <div class="grid c2">
        <div class="card"><div class="list-title">🏋️ Auto-progressing bodyweight plan</div>
          <div class="list-sub" style="margin-top:4px">4 days/week, levels unlock when you earn them.</div></div>
        <div class="card"><div class="list-title">🍛 Indian recipes that fit</div>
          <div class="list-sub" style="margin-top:4px">Dal, chole, keema, fish curry — protein-accurate.</div></div>
        <div class="card"><div class="list-title">⏱ Work that stops at a time</div>
          <div class="list-sub" style="margin-top:4px">Shutdown ritual + focus blocks feed your balance score.</div></div>
        <div class="card"><div class="list-title">🧍 Movement age → 25</div>
          <div class="list-sub" style="margin-top:4px">Five tests, one number, measured every 4 weeks.</div></div>
      </div>
      <div class="field"><label>What should the coach call you?</label>
        <input class="input" data-f="name" value="${esc(draft.name)}" placeholder="First name (optional)" /></div>`;

    case 1: return `
      <div><h2>Where are you starting?</h2>
        <p class="sub">These drive your calorie and protein targets. Edit them any time in Settings.</p></div>
      <div class="form-grid">
        <div class="field"><label>Biological sex</label>
          <select class="input" data-f="sex">
            <option value="m" ${draft.sex === 'm' ? 'selected' : ''}>Male</option>
            <option value="f" ${draft.sex === 'f' ? 'selected' : ''}>Female</option>
          </select></div>
        <div class="field"><label>Age</label>
          <input class="input" type="number" data-f="age" value="${draft.age}" min="14" max="90" /></div>
        <div class="field"><label>Height (cm)</label>
          <input class="input" type="number" data-f="heightCm" value="${draft.heightCm}" min="130" max="230" /></div>
        <div class="field"><label>Current weight (kg)</label>
          <input class="input" type="number" step="0.1" data-f="weightKg" value="${draft.weightKg}" min="40" max="300" /></div>
        <div class="field"><label>Target weight (kg)</label>
          <input class="input" type="number" step="0.1" data-f="targetKg" value="${draft.targetKg}" min="45" max="250" /></div>
        <div class="field"><label>Daily activity (outside training)</label>
          <select class="input" data-f="activity">
            <option value="low" ${draft.activity === 'low' ? 'selected' : ''}>Mostly desk, few steps</option>
            <option value="mod" ${draft.activity === 'mod' ? 'selected' : ''}>Moderate, 5–8k steps</option>
            <option value="high" ${draft.activity === 'high' ? 'selected' : ''}>Active job / daily sport</option>
          </select></div>
      </div>
      <div class="card" style="background:color-mix(in srgb,var(--accent) 10%,transparent)">
        <p class="small">Equipment: <b>bodyweight only</b> — wall, floor, chair, towel, a backpack of books. Nothing to buy.</p>
      </div>`;

    case 2: return `
      <div><h2>When do you train?</h2>
        <p class="sub">Four days a week is the sweet spot for fat loss + muscle at your size. Pick the days you can defend.</p></div>
      <div class="chip-row">${DAYS.map((d, idx) => `
        <button class="chip ${draft.trainDays.includes(idx) ? 'active' : ''}" data-train="${idx}">${d}</button>`).join('')}</div>
      <div class="form-grid">
        <div class="field"><label>Experience</label>
          <select class="input" data-f="experience">
            <option value="beginner" ${draft.experience === 'beginner' ? 'selected' : ''}>Never trained seriously</option>
            <option value="intermediate" ${draft.experience === 'intermediate' ? 'selected' : ''}>Trained before, lost the habit</option>
          </select></div>
        <div class="field"><label>Step goal (daily)</label>
          <input class="input" type="number" step="500" data-f="stepGoal" value="${draft.stepGoal}" /></div>
      </div>
      <div class="card" style="background:var(--surface-2)">
        <div class="tiny muted">Days rotate A → B → C → D (Push, Pull, Legs, Athletic) in the order you picked.
          Missing a day? The plan shifts — you never "lose" a week.</div>
      </div>`;

    case 3: return `
      <div><h2>Where does work end?</h2>
        <p class="sub">The Flow score is only as honest as this window. Set the boundary you actually want — not the one you have now.</p></div>
      <div class="form-grid">
        <div class="field"><label>Wake up</label><input class="input" type="time" data-f="wake" value="${draft.wake}" /></div>
        <div class="field"><label>Sleep by</label><input class="input" type="time" data-f="sleep" value="${draft.sleep}" /></div>
        <div class="field"><label>Work starts</label><input class="input" type="time" data-f="workStart" value="${draft.workStart}" /></div>
        <div class="field"><label>Hard stop (no work after)</label><input class="input" type="time" data-f="workEnd" value="${draft.workEnd}" /></div>
      </div>
      <div class="field"><label>Work days</label>
        <div class="chip-row">${DAYS.map((d, idx) => `
          <button class="chip ${draft.workDays.includes(idx) ? 'active' : ''}" data-work="${idx}">${d}</button>`).join('')}</div>
      </div>
      <div class="card" style="background:color-mix(in srgb,var(--accent-2) 10%,transparent)">
        <p class="small">Training slots in <b>right after the hard stop</b>. That single habit fixes most missed-workout problems.</p>
      </div>`;

    case 4: return `
      <div><h2>Your targets are set</h2>
        <p class="sub">Recalculated live from the numbers you gave me. Nothing extreme — this holds muscle while the fat goes.</p></div>
      <div class="grid c3">
        <div class="card" style="text-align:center">
          <div class="stat-v">${tg.kcal.toLocaleString()}</div><div class="stat-k">kcal / day</div>
          <div class="tiny muted" style="margin-top:6px">TDEE ${tg.tdee} · deficit ${Math.max(0, tg.tdee - tg.kcal)}</div>
        </div>
        <div class="card" style="text-align:center">
          <div class="stat-v">${tg.protein}g</div><div class="stat-k">protein / day</div>
          <div class="tiny muted" style="margin-top:6px">1.7 g/kg muscle insurance</div>
        </div>
        <div class="card" style="text-align:center">
          <div class="stat-v">${draft.stepGoal.toLocaleString()}</div><div class="stat-k">steps / day</div>
          <div class="tiny muted" style="margin-top:6px">the fat-loss engine</div>
        </div>
      </div>
      <div class="stack" style="gap:8px">
        <div class="row between small"><span>BMR (you, at rest)</span><b>${bmr(draft)} kcal</b></div>
        <div class="row between small"><span>Estimated rate</span><b>≈0.5–0.7 kg / week</b></div>
        <div class="row between small"><span>To ${draft.targetKg}kg</span><b>${Math.max(1, Math.round((draft.weightKg - draft.targetKg) / 0.6))} weeks</b></div>
        <div class="row between small"><span>Movement age test</span><b>run it in Move →</b></div>
      </div>
      <div class="card" style="background:color-mix(in srgb,var(--good) 12%,transparent)">
        <p class="small">First step tomorrow: weigh in, run the baseline test, and do Day A. That's the whole plan, repeated.</p>
      </div>`;
  }
  return '';
}

function bindInputs(root) {
  root.oninput = e => {
    const f = e.target.closest('[data-f]');
    if (!f) return;
    const key = f.dataset.f;
    let v = f.value;
    if (f.type === 'number') v = Number(v);
    if (['age', 'heightCm', 'weightKg', 'targetKg', 'stepGoal'].includes(key) && (!v || Number.isNaN(v))) return;
    draft[key] = v;

    // live-recalc on the final summary
    if (step === 4) {
      const tg = targets(draft);
      const cards = root.querySelectorAll('.stat-v');
      if (cards.length === 3) {
        cards[0].textContent = tg.kcal.toLocaleString();
        cards[1].textContent = `${tg.protein}g`;
      }
      const rows = root.querySelectorAll('.row.between b');
      if (rows.length >= 3) {
        rows[0].textContent = `${bmr(draft)} kcal`;
        rows[2].textContent = `${Math.max(1, Math.round((draft.weightKg - draft.targetKg) / 0.6))} weeks`;
      }
    }
  };

  root.onclick = e => {
    const t = e.target.closest('[data-train], [data-work]');
    if (!t) return;
    const isTrain = t.hasAttribute('data-train');
    const idx = Number(isTrain ? t.dataset.train : t.dataset.work);
    const key = isTrain ? 'trainDays' : 'workDays';
    const arr = draft[key];
    const at = arr.indexOf(idx);
    if (at >= 0) arr.splice(at, 1); else arr.push(idx);
    arr.sort();
    if (isTrain && arr.length === 0) { arr.push(idx); toast('Keep at least one training day', 'warn'); }
    t.classList.toggle('active', at < 0);
  };
}

function validate(root) {
  if (step === 1) {
    const w = Number(draft.weightKg), t = Number(draft.targetKg), h = Number(draft.heightCm), a = Number(draft.age);
    if (!w || w < 40 || w > 300) { toast('Enter a weight between 40 and 300 kg', 'warn'); return false; }
    if (!t || t < 45 || t > 250) { toast('Enter a sensible target weight', 'warn'); return false; }
    if (!h || h < 130 || h > 230) { toast('Enter a height in cm', 'warn'); return false; }
    if (!a || a < 14 || a > 90) { toast('Enter an age between 14 and 90', 'warn'); return false; }
  }
  return true;
}

function finish(root) {
  store.set(s => {
    s.profile = Object.assign(s.profile, draft);
    s.onboarded = true;
    s.profile.phaseStart = dateKey();
    // seed the starting weigh-in so charts work from day one
    if (!s.weights.length) s.weights.push({ d: dateKey(), kg: Number(draft.weightKg) });
    s.coach = [];
  });
  root.innerHTML = '';
  toast(`Plan ready — ${draft.name ? draft.name + ', ' : ''}start with today's session`, 'good');
  location.hash = '#/today';
}
