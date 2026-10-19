/* =========================================================================
   views/settings.js — profile, schedule, appearance, vision, data
   ========================================================================= */

import { esc, icon, hydrateIcons, clamp, round } from '../utils.js';
import { toast, modal, closeModal, confirmDialog, bar } from '../ui.js';
import { store, targets, bmr, exportJSON, importJSON } from '../store.js';
import { currentPhase } from '../plan.js';
import { hasVisionConfig } from '../vision.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function render(root) {
  const p = store.state.profile;
  const s = store.state.settings;
  const tg = targets();

  root.innerHTML = `
    <div class="stack-lg">
      <div>
        <div class="eyebrow">Everything stays in this browser</div>
        <div class="h-hero">Settings</div>
      </div>

      <!-- Profile -->
      <div class="card stack">
        <div class="sec-title"><h2>Profile</h2></div>
        <div class="form-grid">
          ${textField('Name', 'name', p.name, 'text', 'Your name')}
          <div class="field"><label>Biological sex (for BMR math)</label>
            <select class="input" data-p="sex">
              <option value="m" ${p.sex === 'm' ? 'selected' : ''}>Male</option>
              <option value="f" ${p.sex === 'f' ? 'selected' : ''}>Female</option>
            </select></div>
          ${numberField('Age', 'age', p.age, 'yrs')}
          ${numberField('Height', 'heightCm', p.heightCm, 'cm')}
          ${numberField('Current weight', 'weightKg', p.weightKg, 'kg', '0.1')}
          ${numberField('Target weight', 'targetKg', p.targetKg, 'kg', '0.1')}
          <div class="field"><label>Activity (outside training)</label>
            <select class="input" data-p="activity">
              <option value="low" ${p.activity === 'low' ? 'selected' : ''}>Mostly desk, no steps</option>
              <option value="mod" ${p.activity === 'mod' ? 'selected' : ''}>Moderate — 5–8k steps</option>
              <option value="high" ${p.activity === 'high' ? 'selected' : ''}>Active job or daily sport</option>
            </select></div>
          <div class="field"><label>Training experience</label>
            <select class="input" data-p="experience">
              <option value="beginner" ${p.experience === 'beginner' ? 'selected' : ''}>Beginner</option>
              <option value="intermediate" ${p.experience === 'intermediate' ? 'selected' : ''}>Trained before</option>
            </select></div>
        </div>
        <div class="card" style="background:var(--surface-2)">
          <div class="row between tiny">
            <span>Calculated targets — BMR ${bmr()} kcal · TDEE ${tg.tdee} kcal</span>
            <span><b>${tg.kcal.toLocaleString()} kcal</b> · <b>${tg.protein}g protein</b></span>
          </div>
        </div>
      </div>

      <!-- Schedule -->
      <div class="card stack">
        <div class="sec-title"><h2>Work & life schedule</h2><span class="badge c2">powers Flow</span></div>
        <div class="form-grid">
          ${timeField('Wake up', 'wake', p.wake)}
          ${timeField('Sleep by', 'sleep', p.sleep)}
          ${timeField('Work starts', 'workStart', p.workStart)}
          ${timeField('Hard stop', 'workEnd', p.workEnd)}
        </div>
        <div class="field">
          <label>Work days</label>
          <div class="chip-row">${dayChips('workDays', p.workDays)}</div>
        </div>
        <div class="field">
          <label>Training days</label>
          <div class="chip-row">${dayChips('trainDays', p.trainDays)}</div>
        </div>
        <p class="tiny muted">Training days map to sessions A → B → C → D in order, cycling each week.</p>
      </div>

      <!-- Goals -->
      <div class="card stack">
        <div class="sec-title"><h2>Daily targets</h2></div>
        <div class="form-grid">
          ${numberField('Step goal', 'stepGoal', p.stepGoal, 'steps', '500')}
          ${numberField('Water goal', 'waterGoal', p.waterGoal, 'ml', '250')}
        </div>
      </div>

      <!-- Appearance -->
      <div class="card stack">
        <div class="sec-title"><h2>Appearance & timers</h2></div>
        <div class="form-grid">
          <div class="field"><label>Theme</label>
            <div class="seg">
              <button data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">Dark</button>
              <button data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">Light</button>
            </div></div>
          ${numberField('Rest timer (sec)', 'restSec', s.restSec, 'sec', '5', 'settings')}
          ${numberField('Default focus block (min)', 'focusLen', s.focusLen || 25, 'min', '5', 'settings')}
        </div>
        <div class="row between">
          <div>
            <div class="list-title">Install as an app</div>
            <div class="list-sub">Works offline once installed — add to home screen.</div>
          </div>
          <button class="btn btn-sm" data-act="install">Install</button>
        </div>
        <div class="row between">
          <div>
            <div class="list-title">Reminders</div>
            <div class="list-sub">Browser notifications for hard stop & workout time.</div>
          </div>
          <label class="switch"><input type="checkbox" data-act="notif" ${s.reminders ? 'checked' : ''} /><span></span></label>
        </div>
      </div>

      <!-- Vision -->
      <div class="card stack">
        <div class="sec-title"><h2>Food photo analysis</h2>
          <span class="badge ${hasVisionConfig() ? 'good' : ''}">${hasVisionConfig() ? 'configured' : 'offline mode'}</span></div>
        <p class="small muted">
          Snap-a-pic calorie reading needs a vision model. Configure one below — or stay keyless and use the guided estimator.
          <b class="good">Either way the photo is deleted after reading.</b>
        </p>
        <button class="btn" data-act="vision">${icon('eye')} Configure vision provider</button>
      </div>

      <!-- Data -->
      <div class="card stack">
        <div class="sec-title"><h2>Data</h2><span class="badge good">localStorage only</span></div>
        <div class="chip-row">
          <button class="chip" data-act="export">${icon('download', 'sm')} Export JSON</button>
          <button class="chip" data-act="import">${icon('upload', 'sm')} Import backup</button>
          <button class="chip" data-act="reset">${icon('trash', 'sm')} Reset all data</button>
        </div>
        <p class="tiny muted">
          Momentum sends nothing anywhere: no analytics, no accounts, no telemetry. Food photos are transmitted only to the
          provider <b>you</b> configure, and only the compressed image for that one request.
        </p>
      </div>

      <div class="card stack">
        <div class="sec-title"><h2>About</h2><span class="badge">v1.0.0</span></div>
        <p class="small muted">
          Phase ${currentPhase().n} · ${currentPhase().name}. A personal PWA for the 100kg → muscular transformation:
          bodyweight training with auto-progression, Indian food coaching, hard work boundaries, and a Movement Age aimed at 25.
        </p>
        <p class="tiny muted-2">
          Health disclaimer: general fitness guidance only — not medical advice. Sharp or joint-line pain, dizziness, or
          chest symptoms mean stop and see a professional.
        </p>
      </div>
    </div>`;

  hydrateIcons(root);
  bind(root);
}

/* ---------------- field helpers ---------------- */
function textField(label, key, val, type = 'text', ph = '') {
  return `<div class="field"><label>${label}</label>
    <input class="input" data-p="${key}" type="${type}" value="${esc(String(val ?? ''))}" placeholder="${esc(ph)}" /></div>`;
}
function numberField(label, key, val, suffix, step = '1', group = 'p') {
  return `<div class="field"><label>${label} (${suffix})</label>
    <input class="input num" ${group === 'settings' ? `data-s="${key}"` : `data-p="${key}"`}
      type="number" step="${step}" value="${esc(String(val ?? ''))}" /></div>`;
}
function timeField(label, key, val) {
  return `<div class="field"><label>${label}</label>
    <input class="input" data-p="${key}" type="time" value="${esc(val)}" /></div>`;
}
function dayChips(group, selected) {
  return DAYS.map((d, i) => `
    <button class="chip ${selected.includes(i) ? 'active' : ''}" data-days="${group}" data-day="${i}">${d}</button>`).join('');
}

/* ---------------- bindings ---------------- */
function bind(root) {
  root.onchange = e => {
    const p = e.target.closest('[data-p]');
    if (p) {
      const key = p.dataset.p;
      let v = p.value;
      if (p.type === 'number') v = Number(v);
      if (['age', 'heightCm', 'weightKg', 'targetKg', 'stepGoal', 'waterGoal'].includes(key)) {
        v = Number(v);
        if (Number.isNaN(v) || v <= 0) return toast('Enter a valid number', 'warn');
      }
      store.set(s => { s.profile[key] = v; });
      if (['weightKg', 'heightCm', 'age', 'activity'].includes(key)) toast('Targets recalculated', 'good');
      return;
    }
    const se = e.target.closest('[data-s]');
    if (se) {
      const key = se.dataset.s;
      store.set(s => { s.settings[key] = Number(se.value); });
      return;
    }
    if (e.target.matches('[data-act="notif"]')) toggleNotifications(e.target.checked);
  };

  root.onclick = async e => {
    const day = e.target.closest('[data-days]');
    if (day) {
      const group = day.dataset.days;
      const i = Number(day.dataset.day);
      store.set(s => {
        const arr = s.profile[group];
        const idx = arr.indexOf(i);
        if (idx >= 0) arr.splice(idx, 1); else arr.push(i);
        s.profile[group].sort();
      });
      if (group === 'trainDays' && store.state.profile.trainDays.length === 0) {
        store.set(s => { s.profile.trainDays = [i]; });
        toast('Keep at least one training day', 'warn');
      }
      return;
    }

    const th = e.target.closest('button[data-theme]');   // must not match <html data-theme> above us
    if (th) { import('../app.js').then(m => m.setTheme(th.dataset.theme)); return; }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    e.preventDefault();

    switch (act.dataset.act) {
      case 'vision': openVisionSettings(); break;
      case 'install': import('../app.js').then(m => m.promptInstall()); break;
      case 'export': {
        const blob = new Blob([exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `momentum-backup.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast('Backup downloaded', 'good');
        break;
      }
      case 'import': {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json';
        input.onchange = () => {
          const f = input.files[0]; if (!f) return;
          const r = new FileReader();
          r.onload = () => {
            try { importJSON(r.result); toast('Backup restored', 'good'); }
            catch { toast('Not a Momentum backup file', 'warn'); }
          };
          r.readAsText(f);
        };
        input.click();
        break;
      }
      case 'reset': {
        const ok = await confirmDialog('Delete all data in this browser? Export a backup first if unsure.', { ok: 'Delete everything', danger: true });
        if (!ok) return;
        store.reset();
        toast('All data deleted', 'warn');
        break;
      }
    }
  };
}

function toggleNotifications(on) {
  if (!on) { store.set(s => { s.settings.reminders = false; }); return; }
  if (!('Notification' in window)) { toast('This browser has no notification support', 'warn'); return; }
  Notification.requestPermission().then(perm => {
    if (perm === 'granted') {
      store.set(s => { s.settings.reminders = true; });
      new Notification('Momentum reminders on', { body: 'You\'ll get a nudge for the hard stop and training windows.' });
      toast('Reminders enabled', 'good');
    } else toast('Permission denied — reminders stay off', 'warn');
  });
}

/* =========================================================================
   VISION PROVIDER SETTINGS (also opened from Fuel → Photo)
   ========================================================================= */
export function openVisionSettings() {
  const v = store.state.vision;
  const m = modal({
    title: 'Vision provider (food photos)',
    body: `
      <p class="small muted">
        Momentum sends <b>only the compressed photo of your meal</b> to this endpoint, reads the estimate, and
        <b class="good">deletes it from memory immediately</b>. Nothing is stored on this device.
      </p>
      <div class="field"><label>Provider</label>
        <select class="input" id="v-prov">
          <option value="none" ${v.provider === 'none' ? 'selected' : ''}>None — guided visual estimator (offline)</option>
          <option value="openai" ${v.provider === 'openai' ? 'selected' : ''}>OpenAI-compatible (GPT-4o vision)</option>
          <option value="gemini" ${v.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
          <option value="ollama" ${v.provider === 'ollama' ? 'selected' : ''}>Local Ollama (100% offline)</option>
        </select></div>
      <div class="field"><label>Endpoint (optional — sensible defaults apply)</label>
        <input class="input" id="v-end" value="${esc(v.endpoint)}" placeholder="https://api.openai.com/v1/chat/completions" /></div>
      <div class="field"><label>API key${v.provider === 'ollama' ? ' (not needed locally)' : ''}</label>
        <input class="input" id="v-key" type="password" value="${esc(v.apiKey)}" placeholder="sk-…" /></div>
      <div class="field"><label>Model</label>
        <input class="input" id="v-model" value="${esc(v.model)}" placeholder="gpt-4o-mini | gemini-2.0-flash | qwen2.5vl:7b" /></div>
      <div class="card" style="background:var(--surface-2)">
        <div class="tiny muted">
          Endpoint defaults — OpenAI: <span class="mono">https://api.openai.com/v1/chat/completions</span> ·
          Gemini: <span class="mono">https://generativelanguage.googleapis.com/v1beta/models</span> ·
          Ollama: <span class="mono">http://localhost:11434</span>
        </div>
      </div>
      <p class="tiny muted-2">Tip: a local Ollama vision model keeps the whole loop on your machine.</p>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="v-save">${icon('check')} Save</button>`
  });
  hydrateIcons(m.root);

  m.root.querySelector('#v-save').onclick = () => {
    const provider = m.root.querySelector('#v-prov').value;
    const endpoint = m.root.querySelector('#v-end').value.trim();
    const apiKey = m.root.querySelector('#v-key').value.trim();
    const model = m.root.querySelector('#v-model').value.trim();
    store.set(s => { s.vision = { provider, endpoint, apiKey, model }; });
    closeModal();
    toast(provider === 'none' ? 'Using the offline visual estimator' : 'Vision provider saved — key kept in this browser only', 'good');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}
