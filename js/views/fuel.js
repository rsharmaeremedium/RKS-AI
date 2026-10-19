/* =========================================================================
   views/fuel.js — calorie/protein logging, Indian recipes, snap-a-photo
   ========================================================================= */

import { dateKey, esc, icon, hydrateIcons, round, clamp, fmtDate, uid } from '../utils.js';
import { toast, modal, closeModal, bar, navigate, confirmDialog } from '../ui.js';
import {
  store, targets, dayNutrition, logMeal, removeMeal, addWater, waterML,
  patchDaily, getDaily
} from '../store.js';
import {
  RECIPES, RECIPE_TAGS, recipesByTag, suggestRecipes, recipeById, logRecipe, macroSummary
} from '../recipes.js';
import { openSnapLog } from '../snaplog.js';
import { hasVisionConfig } from '../vision.js';

let tab = 'log';
let tag = 'all';

const QUICK = [
  { name: '1 phulka', kcal: 105, protein: 4, slot: 'meal' },
  { name: '1 cup cooked rice', kcal: 200, protein: 4, slot: 'meal' },
  { name: '1 cup dal', kcal: 180, protein: 8, slot: 'meal' },
  { name: '1 egg', kcal: 78, protein: 6, slot: 'breakfast' },
  { name: '1 banana', kcal: 105, protein: 1, slot: 'snack' },
  { name: '1 glass milk', kcal: 150, protein: 8, slot: 'snack' },
  { name: 'Whey scoop', kcal: 120, protein: 24, slot: 'snack' },
  { name: '1 cup curd', kcal: 150, protein: 8, slot: 'snack' },
  { name: '100g chicken', kcal: 165, protein: 31, slot: 'meal' },
  { name: '1 bowl sabzi', kcal: 140, protein: 4, slot: 'meal' }
];

export function render(root) {
  const tg = targets();
  const nutr = dayNutrition();
  const kcalPct = clamp((nutr.kcal / tg.kcal) * 100, 0, 100);
  const proPct = clamp((nutr.protein / tg.protein) * 100, 0, 100);
  const waterPct = clamp((waterML() / store.state.profile.waterGoal) * 100, 0, 100);

  root.innerHTML = `
    <div class="stack-lg">
      <!-- Header -->
      <div class="row between wrap" style="gap:10px">
        <div>
          <div class="eyebrow">${tg.losing ? 'Deficit for fat loss · high protein for muscle' : 'Slight surplus for muscle'}</div>
          <div class="h-hero">Fuel — ${tg.kcal.toLocaleString()} kcal</div>
        </div>
        <div class="seg" id="fuel-seg" style="width:min(340px,100%)">
          <button data-tab="log" class="${tab === 'log' ? 'active' : ''}">Log</button>
          <button data-tab="recipes" class="${tab === 'recipes' ? 'active' : ''}">Recipes</button>
          <button data-tab="photo" class="${tab === 'photo' ? 'active' : ''}">Photo</button>
        </div>
      </div>

      <!-- Today's budget -->
      <div class="grid c3">
        <div class="card stack" style="gap:8px">
          <div class="row between"><span class="stat-k">Calories</span><span class="tiny muted">${Math.max(0, tg.kcal - nutr.kcal)} left</span></div>
          <div class="stat-v num">${nutr.kcal}<span class="muted" style="font-size:15px"> / ${tg.kcal}</span></div>
          ${bar(kcalPct, kcalPct > 105 ? 'c3' : '')}
          <div class="tiny muted">TDEE ${tg.tdee} · target −${Math.max(0, tg.tdee - tg.kcal)} kcal</div>
        </div>
        <div class="card stack" style="gap:8px">
          <div class="row between"><span class="stat-k">Protein</span><span class="tiny muted">${Math.max(0, tg.protein - nutr.protein)}g left</span></div>
          <div class="stat-v num">${nutr.protein}g<span class="muted" style="font-size:15px"> / ${tg.protein}g</span></div>
          ${bar(proPct)}
          <div class="tiny muted">1.7 g/kg — protects muscle in a deficit</div>
        </div>
        <div class="card stack" style="gap:8px">
          <div class="row between"><span class="stat-k">Water</span><span class="tiny muted">${round(waterML() / 1000, 1)}L</span></div>
          <div class="stat-v num">${waterML()}<span class="muted" style="font-size:15px"> / ${store.state.profile.waterGoal}ml</span></div>
          ${bar(waterPct, 'c2')}
          <div class="chip-row" style="margin-top:2px">
            <button class="chip" data-water="250">+250</button>
            <button class="chip" data-water="500">+500</button>
          </div>
        </div>
      </div>

      <div id="fuel-body">${tab === 'log' ? logHTML(nutr, tg) : tab === 'recipes' ? recipesHTML() : photoHTML()}</div>
    </div>`;

  hydrateIcons(root);
  bind(root);
}

/* =========================================================================
   TAB: LOG
   ========================================================================= */
function logHTML(nutr, tg) {
  return `
    <div class="stack-lg">
      <div class="card stack">
        <div class="sec-title"><h2>Quick add</h2><a href="#" data-act="custom">+ Custom entry</a></div>
        <div class="chip-row">
          ${QUICK.map((q, i) => `<button class="chip" data-quick="${i}">${esc(q.name)} · <b>${q.kcal}</b></button>`).join('')}
        </div>
      </div>

      <div class="card flush">
        <div class="list">
          <div class="list-item" style="padding-top:15px">
            <div class="grow">
              <div class="list-title">Today's meals</div>
              <div class="list-sub">${nutr.count} item${nutr.count === 1 ? '' : 's'} · ${nutr.kcal} kcal · ${nutr.protein}g protein</div>
            </div>
            <button class="btn btn-sm btn-primary" data-act="custom">${icon('plus', 'sm')} Add</button>
          </div>
          ${nutr.rows.length ? nutr.rows.slice().reverse().map(m => `
            <div class="list-item">
              <span class="avatar-ico">${icon(m.fromPhoto ? 'eye' : m.fromRecipe ? 'food' : 'flame')}</span>
              <div class="grow">
                <div class="list-title">${esc(m.name)}</div>
                <div class="list-sub">${esc(m.slot || 'meal')}${m.fromPhoto ? ' · from photo (deleted)' : ''}</div>
              </div>
              <div class="num" style="text-align:right">
                <div style="font-weight:700">${m.kcal} kcal</div>
                <div class="tiny muted">${m.protein}g protein</div>
              </div>
              <button class="icon-btn" data-del="${m.id}" aria-label="Delete">${icon('trash', 'sm')}</button>
            </div>`).join('') : `
            <div class="empty">${icon('flame', 'lg')}<h3>Nothing logged yet</h3>
              <p>Snap a photo, tap a quick add, or open recipes matched to your remaining budget.</p></div>`}
        </div>
      </div>

      ${weekBars()}
    </div>`;
}

function weekBars() {
  const days = [];
  const tg = targets();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const rows = store.state.meals.filter(m => m.d === key);
    days.push({
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      v: rows.reduce((a, r) => a + r.kcal, 0),
      max: tg.kcal,
      color: rows.reduce((a, r) => a + r.kcal, 0) > tg.kcal * 1.08 ? 'var(--warn)' : undefined
    });
  }
  return `
    <div class="card stack">
      <div class="sec-title"><h2>Last 7 days vs target</h2></div>
      <canvas id="week-kcal" style="width:100%"></canvas>
      <div class="tiny muted">Grey = your ${tg.kcal} kcal target. Consistency across the week beats a perfect day.</div>
    </div>
    <script type="application/json" id="week-data">${JSON.stringify(days)}</script>`;
}

/* =========================================================================
   TAB: RECIPES
   ========================================================================= */
function recipesHTML() {
  const { suggestions, leftKcal, leftProtein } = suggestRecipes(3);
  const list = recipesByTag(tag);

  return `
    <div class="stack-lg">
      <div class="card stack">
        <div class="sec-title">
          <h2>${icon('bolt', 'sm')} Matched to your remaining ${leftKcal} kcal / ${leftProtein}g protein</h2>
        </div>
        <div class="grid c3">
          ${suggestions.map(({ r }) => `
            <button class="card" data-recipe="${r.id}" style="text-align:left;cursor:pointer;display:grid;gap:6px">
              <div class="row between">
                <span class="badge ${r.veg ? 'good' : 'c3'}">${r.veg ? 'Veg' : 'Non-veg'}</span>
                <span class="tiny muted">${r.time} min</span>
              </div>
              <div style="font-weight:680;font-size:15px">${esc(r.name)}</div>
              <div class="tiny muted"><b class="accent">${r.protein}g protein</b> · ${r.kcal} kcal</div>
            </button>`).join('')}
        </div>
      </div>

      <div class="card stack">
        <div class="sec-title"><h2>Indian homemade recipe book</h2><span class="tiny muted">${RECIPES.length} recipes</span></div>
        <div class="chip-row">
          ${RECIPE_TAGS.map(t => `<button class="chip ${tag === t.id ? 'active' : ''}" data-tag="${t.id}">${esc(t.label)}</button>`).join('')}
        </div>

        <div class="list" style="border:1px solid var(--line);border-radius:14px;overflow:hidden">
          ${list.map(r => `
            <button class="list-item" data-recipe="${r.id}">
              <span class="avatar-ico">${icon('food')}</span>
              <div class="grow">
                <div class="list-title">${esc(r.name)}</div>
                <div class="list-sub">${r.time} min · ${r.tags.slice(0, 3).map(esc).join(' · ')}</div>
              </div>
              <div class="num" style="text-align:right">
                <div style="font-weight:700">${r.protein}g</div>
                <div class="tiny muted">${r.kcal} kcal</div>
              </div>
              <span class="badge ${r.veg ? 'good' : 'c3'}">${r.veg ? 'V' : 'N'}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;
}

function openRecipe(id) {
  const r = recipeById(id);
  if (!r) return;
  const m = modal({
    title: r.name,
    body: `
      <div class="chip-row">
        <span class="badge ${r.veg ? 'good' : 'c3'}">${r.veg ? 'Vegetarian' : 'Non-veg'}</span>
        <span class="badge">${r.time} min</span>
        <span class="badge accent">${r.protein}g protein</span>
        <span class="badge">${r.kcal} kcal</span>
        <span class="badge">serves ${r.servings}</span>
      </div>

      <div class="grid c4" style="gap:8px">
        ${[['kcal', r.kcal], ['protein', r.protein + 'g'], ['carbs', r.carbs + 'g'], ['fat', r.fat + 'g']]
          .map(([k, v]) => `<div class="card" style="padding:10px;text-align:center">
            <div class="num" style="font-weight:750;font-size:17px">${v}</div>
            <div class="tiny muted">${k}</div></div>`).join('')}
      </div>

      <div>
        <div class="sec-title"><h2>Ingredients</h2></div>
        <ul class="small" style="margin:6px 0 0;padding-left:18px;display:grid;gap:4px">
          ${r.ing.map(i => `<li>${esc(i)}</li>`).join('')}
        </ul>
      </div>

      <div>
        <div class="sec-title"><h2>Method</h2></div>
        <ol class="small" style="margin:6px 0 0;padding-left:18px;display:grid;gap:5px">
          ${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}
        </ol>
      </div>

      <div class="card" style="background:color-mix(in srgb,var(--accent) 10%,transparent)">
        <div class="row" style="gap:9px;align-items:flex-start">
          ${icon('bolt', 'sm')}
          <p class="small"><b>Coach tip:</b> ${esc(r.tip)}</p>
        </div>
      </div>

      <div class="field">
        <label>Servings to log</label>
        <div class="row">
          <button class="btn btn-sm" data-serv="-">−</button>
          <b class="num" id="serv-n" style="min-width:24px;text-align:center">1</b>
          <button class="btn btn-sm" data-serv="+">+</button>
          <span class="tiny muted" id="serv-sum" style="margin-left:8px">${macroSummary(r)}</span>
        </div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Close</button>
             <button class="btn btn-primary" id="log-recipe">${icon('plus')} Add to today's log</button>`
  });

  hydrateIcons(m.root);
  let n = 1;
  m.root.onclick = e => {
    const s = e.target.closest('[data-serv]');
    if (s) {
      n = clamp(n + (s.dataset.serv === '+' ? 1 : -1), 1, 6);
      m.root.querySelector('#serv-n').textContent = n;
      m.root.querySelector('#serv-sum').textContent =
        `${round(r.kcal * n)} kcal · ${r.protein * n}g protein`;
    }
  };
  m.root.querySelector('#log-recipe').onclick = () => {
    logRecipe(r, n);
    closeModal();
    toast(`${r.name} ×${n} logged`, 'good');
  };
}

/* =========================================================================
   TAB: PHOTO
   ========================================================================= */
function photoHTML() {
  const configured = hasVisionConfig();
  return `
    <div class="stack-lg">
      <div class="card pad-lg stack" style="text-align:center;gap:16px">
        <div class="avatar-ico" style="width:66px;height:66px;margin:6px auto 0;border-radius:20px">${icon('eye', 'lg')}</div>
        <div>
          <div class="h-big">Snap a pic → get calories</div>
          <p class="small muted" style="max-width:440px;margin:6px auto 0">
            Point the camera at your plate. Momentum estimates items, portions, kcal and protein,
            you confirm, it goes into today's log — <b class="good">then the photo is deleted from memory.</b>
          </p>
        </div>
        <div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary btn-lg" data-act="snap">${icon('eye')} Take / choose photo</button>
          <button class="btn" data-act="vision-settings">Vision provider settings</button>
        </div>
        <div class="grid c3 tiny muted" style="text-align:left;margin-top:4px">
          <div class="card" style="padding:11px"><b class="good">1. Read</b><br>Image is compressed in memory only.</div>
          <div class="card" style="padding:11px"><b class="good">2. Estimate</b><br>Sent only if you configured a provider.</div>
          <div class="card" style="padding:11px"><b class="good">3. Deleted</b><br>Object URL revoked, buffers nulled, no storage.</div>
        </div>
      </div>

      <div class="card stack">
        <div class="sec-title"><h2>Provider status</h2></div>
        <div class="list" style="border:1px solid var(--line);border-radius:14px;overflow:hidden">
          <div class="list-item">
            <span class="avatar-ico">${icon(configured ? 'check' : 'info')}</span>
            <div class="grow">
              <div class="list-title">${configured ? esc(store.state.vision.provider) + ' configured' : 'No vision provider'}</div>
              <div class="list-sub">${configured
                ? `Model ${esc(store.state.vision.model || 'default')} · photos are analysed and deleted`
                : 'Photos use the guided visual estimator (fully offline), then are deleted.'}</div>
            </div>
            <button class="btn btn-sm" data-act="vision-settings">${configured ? 'Change' : 'Set up'}</button>
          </div>
          <div class="list-item">
            <span class="avatar-ico">${icon('trash')}</span>
            <div class="grow">
              <div class="list-title">Storage guarantee</div>
              <div class="list-sub">No image bytes are ever written to localStorage, IndexedDB or the cache.</div>
            </div>
            <span class="badge good">enforced</span>
          </div>
        </div>
      </div>

      <div class="card stack">
        <div class="sec-title"><h2>Photos logged today</h2></div>
        ${store.state.meals.filter(m => m.d === dateKey() && m.fromPhoto).length
          ? store.state.meals.filter(m => m.d === dateKey() && m.fromPhoto).map(m => `
            <div class="row between small" style="padding:7px 0;border-bottom:1px solid var(--line)">
              <span>${esc(m.name)}</span>
              <span class="num muted">${m.kcal} kcal · ${m.protein}g <span class="good">· image gone</span></span>
            </div>`).join('')
          : `<p class="small muted">No photo meals yet today.</p>`}
      </div>
    </div>`;
}

/* =========================================================================
   BINDINGS
   ========================================================================= */
function bind(root) {
  root.querySelector('#fuel-seg').onclick = e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    render(root);
  };

  root.onclick = e => {
    const t = e.target;

    const water = t.closest('[data-water]');
    if (water) { addWater(Number(water.dataset.water)); return; }

    const q = t.closest('[data-quick]');
    if (q) {
      const item = QUICK[Number(q.dataset.quick)];
      logMeal({ name: item.name, kcal: item.kcal, protein: item.protein, slot: item.slot });
      toast(`${item.name} — ${item.kcal} kcal`, 'good');
      return;
    }

    const del = t.closest('[data-del]');
    if (del) { removeMeal(del.dataset.del); toast('Entry removed'); return; }

    const tg = t.closest('[data-tag]');
    if (tg) { tag = tg.dataset.tag; render(root); return; }

    const rec = t.closest('[data-recipe]');
    if (rec) { openRecipe(rec.dataset.recipe); return; }

    const act = t.closest('[data-act]');
    if (!act) return;
    e.preventDefault();
    switch (act.dataset.act) {
      case 'custom': openCustomEntry(); break;
      case 'snap': openSnapLog(); break;
      case 'vision-settings': import('./settings.js').then(m => m.openVisionSettings()); break;
    }
  };

  // draw week bars
  const dataEl = root.querySelector('#week-data');
  const canvas = root.querySelector('#week-kcal');
  if (dataEl && canvas) {
    import('../charts.js').then(({ barChart }) => {
      barChart(canvas, { values: JSON.parse(dataEl.textContent), height: 150 });
    });
  }
}

function openCustomEntry() {
  const m = modal({
    title: 'Add food entry',
    body: `
      <div class="field"><label>What did you eat?</label>
        <input class="input" id="c-name" placeholder="e.g. Dal rice + salad" /></div>
      <div class="form-grid">
        <div class="field"><label>Calories</label>
          <input class="input num" id="c-kcal" type="number" inputmode="numeric" placeholder="450" /></div>
        <div class="field"><label>Protein (g)</label>
          <input class="input num" id="c-pro" type="number" inputmode="numeric" placeholder="25" /></div>
      </div>
      <div class="field"><label>Meal</label>
        <select class="input" id="c-slot">
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack" selected>Snack</option>
        </select></div>
      <div class="chip-row" id="c-presets">
        ${RECIPES.slice(0, 6).map(r => `<button class="chip" data-preset="${r.id}">${esc(r.name.split(' ')[0])} ${r.kcal}</button>`).join('')}
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="c-save">${icon('plus')} Add entry</button>`
  });
  hydrateIcons(m.root);

  m.root.querySelector('#c-presets').onclick = e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const r = recipeById(b.dataset.preset);
    m.root.querySelector('#c-name').value = r.name;
    m.root.querySelector('#c-kcal').value = r.kcal;
    m.root.querySelector('#c-pro').value = r.protein;
  };

  m.root.querySelector('#c-save').onclick = () => {
    const name = m.root.querySelector('#c-name').value.trim();
    const kcal = Number(m.root.querySelector('#c-kcal').value);
    const protein = Number(m.root.querySelector('#c-pro').value) || 0;
    const slot = m.root.querySelector('#c-slot').value;
    if (!name) return toast('Give the entry a name', 'warn');
    if (!kcal || kcal <= 0) return toast('Enter the calories', 'warn');
    logMeal({ name, kcal: Math.round(kcal), protein: Math.round(protein), slot });
    closeModal();
    toast(`${name} added`, 'good');
  };
}
