/* =========================================================================
   store.js — local persistence, defaults, selectors, metrics
   Everything lives in localStorage. Nothing ever leaves the device unless
   you explicitly configure a vision provider for food photos.
   ========================================================================= */

import { dateKey, addDays, dow, clamp, round, toMin, nowMin, avg, sum } from './utils.js';

const KEY = 'momentum.v1';

export const defaultState = () => ({
  version: 1,
  onboarded: false,
  createdAt: dateKey(),

  profile: {
    name: '',
    sex: 'm',
    age: 32,
    heightCm: 175,
    weightKg: 100,
    targetKg: 82,
    waistCm: 0,
    activity: 'mod',            // low | mod | high
    experience: 'beginner',     // beginner | intermediate
    equipment: 'bodyweight',
    injuries: [],
    unit: 'kg',

    wake: '06:30',
    sleep: '23:00',
    workStart: '09:30',
    workEnd: '18:30',
    workDays: [1, 2, 3, 4, 5],
    trainDays: [1, 3, 5, 6],    // Mon/Wed/Fri/Sat
    stepGoal: 8000,
    waterGoal: 3000,
    phaseStart: dateKey()
  },

  // per-exercise progression state: { [exId]: { tier, topReps, last } }
  progress: { exercises: {} },

  weights: [],                  // [{ d, kg }]
  tests: [],                    // movement-age test entries
  sessions: [],                 // training sessions
  meals: [],                    // [{ d, slot, name, kcal, protein }]
  water: {},                    // { [d]: ml }
  daily: {},                    // { [d]: check-ins }
  blocks: [],                   // [{ d, start, end, type, label }]
  focus: [],                    // [{ d, ts, minutes, label }]
  coach: [],                    // [{ ts, role, text }]
  madeRecipes: [],              // [{ d, id, servings }]

  vision: { provider: 'none', endpoint: '', apiKey: '', model: '' },

  settings: { theme: 'dark', restSec: 75, reminders: false }
});

export const store = {
  state: load(),
  subs: new Set(),

  get() { return this.state; },

  set(mutator, { save = true, silent = false } = {}) {
    const draft = this.state;
    mutator(draft);
    if (save) persist(draft);
    if (!silent) this.emit();
  },

  replace(next) {
    this.state = Object.assign(defaultState(), next);
    persist(this.state);
    this.emit();
  },

  reset() {
    this.state = defaultState();
    persist(this.state);
    this.emit();
  },

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  emit() { this.subs.forEach(fn => { try { fn(this.state); } catch (e) { console.error(e); } }); }
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      profile: Object.assign(defaultState().profile, parsed.profile || {}),
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
      vision: Object.assign(defaultState().vision, parsed.vision || {})
    });
  } catch (e) {
    console.warn('state load failed', e);
    return defaultState();
  }
}

export function persist(state = store.state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('state save failed', e); }
}

export function exportJSON() {
  return JSON.stringify(store.state, null, 2);
}
export function importJSON(text) {
  const parsed = JSON.parse(text);      // throws on bad input
  store.replace(parsed);
}

/* =========================================================================
   Daily helpers
   ========================================================================= */

export function getDaily(d = dateKey(), create = true) {
  const s = store.state;
  if (!s.daily[d] && create) {
    s.daily[d] = { steps: 0, sleepH: 0, energy: 0, focusMin: 0, workMin: 0, personalMin: 0, mobilityMin: 0, mobilityDone: false, shutdown: false, notes: '' };
  }
  return s.daily[d] || null;
}

export function patchDaily(d, patch) {
  store.set(s => {
    const cur = s.daily[d] || {};
    s.daily[d] = Object.assign(
      { steps: 0, sleepH: 0, energy: 0, focusMin: 0, workMin: 0, personalMin: 0, mobilityMin: 0, mobilityDone: false, shutdown: false, notes: '' },
      cur, patch
    );
  });
}

/** True when a session is scheduled on this weekday. */
export function isTrainDay(d = dateKey()) {
  return store.state.profile.trainDays.includes(dow(d));
}
export function isWorkDay(d = dateKey()) {
  return store.state.profile.workDays.includes(dow(d));
}

/* =========================================================================
   Nutrition targets (Mifflin-St Jeor + activity + goal deficit)
   ========================================================================= */

export function bmr(p = store.state.profile) {
  const w = p.weightKg, h = p.heightCm, a = p.age;
  const base = p.sex === 'f' ? (10 * w + 6.25 * h - 5 * a - 161) : (10 * w + 6.25 * h - 5 * a + 5);
  return Math.round(base);
}

const MULT = { low: 1.3, mod: 1.5, high: 1.7 };

export function targets(p = store.state.profile) {
  const tdee = Math.round(bmr(p) * (MULT[p.activity] || 1.5));
  const losing = p.weightKg - p.targetKg > 0.5;

  // ~0.6% bodyweight/week loss ≈ 500–650 kcal deficit at 100kg, floor-limited.
  let kcal = losing ? Math.round(tdee - clamp(p.weightKg * 5.5, 400, 750)) : Math.round(tdee + 250);
  kcal = Math.max(kcal, p.sex === 'f' ? 1400 : 1600);

  const protein = Math.round(p.weightKg * 1.7);           // 1.7 g/kg — muscle retention in a deficit
  const fat = Math.round(kcal * 0.25 / 9);
  const carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return { tdee, kcal, protein, fat, carbs, losing };
}

export function dayNutrition(d = dateKey()) {
  const rows = store.state.meals.filter(m => m.d === d);
  return {
    kcal: Math.round(sum(rows.map(r => r.kcal))),
    protein: Math.round(sum(rows.map(r => r.protein))),
    count: rows.length,
    rows
  };
}

export function waterML(d = dateKey()) { return store.state.water[d] || 0; }
export function addWater(ml, d = dateKey()) {
  store.set(s => { s.water[d] = Math.max(0, (s.water[d] || 0) + ml); });
}

/* =========================================================================
   Weight stats
   ========================================================================= */

export function weightSeries() {
  return [...store.state.weights].sort((a, b) => a.d.localeCompare(b.d));
}

export function latestWeight() {
  const s = store.state;
  const w = weightSeries();
  if (w.length) return w[w.length - 1].kg;
  return s.profile.weightKg;
}

/** Moving-average trend (smooths daily water noise). */
export function trendSeries(window = 5) {
  const w = weightSeries();
  return w.map((pt, i) => {
    const slice = w.slice(Math.max(0, i - window + 1), i + 1);
    return { d: pt.d, kg: round(avg(slice.map(x => x.kg)), 1) };
  });
}

export function weightStats() {
  const s = store.state;
  const w = weightSeries();
  const start = w.length ? w[0].kg : s.profile.weightKg;
  const now = latestWeight();
  const lost = round(start - now, 1);

  // rate over last 21 days (kg/week) from the trend
  const trend = trendSeries(4);
  let perWeek = 0;
  if (trend.length >= 2) {
    const recent = trend.filter(p => daysAgo(p.d) <= 21);
    const arr = recent.length >= 2 ? recent : trend.slice(-2);
    const span = Math.max(1, daysAgo(arr[0].d) - daysAgo(arr[arr.length - 1].d));
    perWeek = round(((arr[0].kg - arr[arr.length - 1].kg) / Math.abs(span)) * 7, 2);
  }

  const toGo = round(Math.max(0, now - s.profile.targetKg), 1);
  const weeksLeft = perWeek > 0.05 ? Math.ceil(toGo / perWeek) : null;

  return { start, now, lost, perWeek, toGo, weeksLeft, count: w.length };
}

function daysAgo(key) {
  const t = dateKey();
  return Math.round((new Date(t) - new Date(key)) / 86400000);
}

/* =========================================================================
   Session / meal quick access
   ========================================================================= */

export function sessionsOn(d) { return store.state.sessions.filter(x => x.d === d); }
export function lastSession() {
  const s = [...store.state.sessions].sort((a, b) => b.d.localeCompare(a.d));
  return s[0] || null;
}
export function mealsOn(d) { return store.state.meals.filter(m => m.d === d); }

export function logMeal(entry) {
  store.set(s => { s.meals.push({ d: dateKey(), slot: 'snack', protein: 0, ...entry }); });
}
export function removeMeal(id) {
  store.set(s => { s.meals = s.meals.filter(m => m.id !== id); });
}
export function addSession(session) {
  store.set(s => { s.sessions.push({ d: dateKey(), id: Math.random().toString(36).slice(2, 9), ...session }); });
}
export function logWeight(kg, d = dateKey()) {
  store.set(s => {
    s.weights = s.weights.filter(w => w.d !== d);
    s.weights.push({ d, kg: round(kg, 1) });
    s.weights.sort((a, b) => a.d.localeCompare(b.d));
    s.profile.weightKg = round(kg, 1);
  });
}

/* =========================================================================
   TODAY SCORES — the three rings
   ========================================================================= */

export function todayScores(d = dateKey()) {
  const p = store.state.profile;
  const daily = getDaily(d, false) || {};
  const nutr = dayNutrition(d);
  const tg = targets(p);
  const trained = sessionsOn(d).length > 0;
  const scheduled = isTrainDay(d);

  /* --- TRAIN: movement done today --- */
  const stepRatio = clamp((daily.steps || 0) / p.stepGoal, 0, 1);
  const mobilityScore = daily.mobilityDone ? 1 : clamp((daily.mobilityMin || 0) / 10, 0, 0.85);
  let train;
  if (scheduled) train = (trained ? 0.6 : 0) + stepRatio * 0.3 + mobilityScore * 0.1;
  else train = stepRatio * 0.65 + (daily.mobilityDone ? 0.35 : 0);
  if (trained && !daily.mobilityDone) train = Math.max(train, 0.7);

  /* --- FUEL: protein first, calories second, water third --- */
  const proRatio = clamp(nutr.protein / tg.protein, 0, 1.15);
  const over = Math.max(0, nutr.kcal - tg.kcal) / tg.kcal;
  const kcalAdherence = nutr.count === 0 ? 0 : clamp(1 - over * 2.2, 0, 1);
  const waterRatio = clamp(waterML(d) / p.waterGoal, 0, 1);
  const fuel = proRatio * 0.55 + kcalAdherence * 0.3 + waterRatio * 0.15;

  /* --- FLOW: work stays inside its window, life gets its share --- */
  const workMin = daily.workMin || workMinutesSoFar(d);
  const targetWork = (toMin(p.workEnd) - toMin(p.workStart)) * (isWorkDay(d) ? 1 : 0);
  const overflow = targetWork > 0 ? Math.max(0, workMin - targetWork - 30) / 180 : 0;
  const windowScore = targetWork === 0 ? (workMin <= 60 ? 1 : 0.6) : clamp(1 - overflow, 0, 1);
  const shutdownScore = isWorkDay(d) ? (daily.shutdown ? 1 : 0) : 1;
  const lifeScore = clamp((daily.focusMin || 0) / 45, 0, 1) * 0.5 + (daily.personalMin >= 30 ? 0.5 : 0);
  const sleepScore = daily.sleepH ? clamp((daily.sleepH - 5.5) / 2, 0, 1) : 0.5;
  const flow = windowScore * 0.35 + shutdownScore * 0.25 + lifeScore * 0.2 + sleepScore * 0.2;

  const pct = v => Math.round(clamp(v, 0, 1) * 100);
  return {
    train: pct(train), fuel: pct(fuel), flow: pct(flow),
    detail: {
      scheduled, trained, stepRatio, mobilityScore,
      kcal: nutr.kcal, kcalTarget: tg.kcal, protein: nutr.protein, proteinTarget: tg.protein,
      water: waterML(d), waterTarget: p.waterGoal, workMin, targetWork
    }
  };
}

function workMinutesSoFar(d) {
  if (d !== dateKey()) {
    const day = store.state.daily[d];
    return day ? (day.workMin || 0) : 0;
  }
  const p = store.state.profile;
  const start = toMin(p.workStart);
  const elapsed = Math.max(0, nowMin() - start);
  const blocks = store.state.blocks.filter(b => b.d === d && (b.type === 'work' || b.type === 'deep'));
  const logged = sum(blocks.map(b => toMin(b.end) - toMin(b.start)));
  return Math.max(logged, Math.min(elapsed, 16 * 60));
}

/* =========================================================================
   STREAK + adherence
   ========================================================================= */

export function dayScore(d) {
  const s = todayScores(d);
  const daily = getDaily(d, false) || {};
  const trained = sessionsOn(d).length > 0;
  const moved = (daily.steps || 0) >= (store.state.profile.stepGoal * 0.7) || daily.mobilityDone;
  return Math.round(s.train * 0.35 + s.fuel * 0.3 + s.flow * 0.2 + ((trained || moved) ? 0.15 : 0));
}

export function streak() {
  let n = 0;
  let d = dateKey();
  const startedToday = sessionsOn(d).length > 0 || (getDaily(d, false)?.steps || 0) > 0;
  if (!startedToday) d = addDays(d, -1);          // today can still be pending
  for (let i = 0; i < 400; i++) {
    if (dayScore(d) >= 60) { n++; d = addDays(d, -1); } else break;
  }
  return n;
}

export function heatmap(days = 91) {
  const out = [];
  const today = dateKey();
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({ d, score: dayScore(d) });
  }
  return out;
}

/* =========================================================================
   WEEK AGGREGATES (Flow view)
   ========================================================================= */

export function weekStats(d = dateKey()) {
  const p = store.state.profile;
  const dowIdx = dow(d);
  const monday = addDays(d, -((dowIdx + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const workMin = days.map(x => {
    const day = store.state.daily[x];
    if (day && day.workMin) return day.workMin;
    const blocks = store.state.blocks.filter(b => b.d === x && (b.type === 'work' || b.type === 'deep'));
    return sum(blocks.map(b => toMin(b.end) - toMin(b.start)));
  });

  const workouts = sum(days.map(x => sessionsOn(x).length));
  const mobility = sum(days.map(x => (store.state.daily[x]?.mobilityMin) || 0));
  const focus = sum(days.map(x => (store.state.daily[x]?.focusMin) || 0));
  const shutdowns = days.filter(x => !store.state.daily[x] ? false : store.state.daily[x].shutdown).length;
  const balanceDays = days.filter(x => dayScore(x) >= 60).length;

  const targetWork = days.filter(x => isWorkDay(x)).reduce((a, x) => a + (toMin(p.workEnd) - toMin(p.workStart)), 0);
  const overRatio = targetWork ? sum(workMin) / targetWork : 1;

  const balance = Math.round(clamp(
    100 - Math.max(0, overRatio - 1) * 90 - (7 - balanceDays) * 5 + Math.min(6, workouts * 1.5), 0, 100));

  return { days, workMin, workouts, mobility, focus, shutdowns, balance, targetWork, overRatio, balanceDays };
}
