/* =========================================================================
   utils.js — DOM, dates, math, icons, formatting
   ========================================================================= */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const round = (v, d = 0) => { const m = 10 ** d; return Math.round(v * m) / m; };
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const sum = arr => arr.reduce((a, b) => a + b, 0);
export const avg = arr => (arr.length ? sum(arr) / arr.length : 0);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const debounce = (fn, ms = 200) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/* ---------- Dates ---------- */
export const pad2 = n => String(n).padStart(2, '0');

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = keyToDate(key); d.setDate(d.getDate() + n); return dateKey(d);
}
export function daysBetween(a, b) {
  return Math.round((keyToDate(b) - keyToDate(a)) / 86400000);
}
/** 0 = Sunday … 6 = Saturday */
export const dow = key => keyToDate(key).getDay();

export function fmtDate(key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return keyToDate(key).toLocaleDateString(undefined, opts);
}
export function timeStr(hhmm) { return hhmm || ''; }

export function toMin(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function toHHMM(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
export function fmtClock(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
export function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

export function relDay(key) {
  const t = dateKey();
  if (key === t) return 'Today';
  if (key === addDays(t, -1)) return 'Yesterday';
  if (key === addDays(t, 1)) return 'Tomorrow';
  return fmtDate(key);
}

export function mmss(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
}

/* ---------- Weight / units ---------- */
export const kgToLb = kg => kg * 2.20462;
export const lbToKg = lb => lb / 2.20462;

/* ---------- Icons (inline SVG, 24px grid) ---------- */
const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  home: I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>'),
  dumbbell: I('<path d="M4 9v6M7 7v10M17 7v10M20 9v6"/><path d="M7 12h10"/>'),
  flame: I('<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.7.7-3.1 1.6-4.2C9.4 9.6 10 11 11 11c0-3 1-6 1-8Z"/>'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  stretch: I('<circle cx="12" cy="5" r="2"/><path d="M12 8v5m0 0-3.5 6M12 13l3.5 6M8 10.5l4-1 4 1"/>'),
  chart: I('<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16l3.5-4.5 3 2.5L20 7"/>'),
  chat: I('<path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4.5 20l1.3-4.4A7.5 7.5 0 1 1 20 12Z"/>'),
  gear: I('<circle cx="12" cy="12" r="3.1"/><path d="M12 3.5v2M12 18.5v2M4.9 7.8l1.7 1M17.4 15.2l1.7 1M4.9 16.2l1.7-1M17.4 8.8l1.7-1"/>'),
  timer: I('<path d="M9.5 2.5h5"/><circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.2 1.5"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/>'),
  moon: I('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>'),
  check: I('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  chevronR: I('<path d="M9 5l7 7-7 7"/>'),
  play: I('<path d="M7 4.5 19 12 7 19.5Z" fill="currentColor" stroke="none"/>'),
  pause: I('<path d="M8.5 5v14M15.5 5v14" stroke-width="2.6"/>'),
  stop: I('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>'),
  skip: I('<path d="M6 5.5 15 12l-9 6.5Z" fill="currentColor" stroke="none"/><path d="M18 5v14" stroke-width="2.4"/>'),
  water: I('<path d="M12 3.2s5.5 5.4 5.5 9.6a5.5 5.5 0 1 1-11 0C6.5 8.6 12 3.2 12 3.2Z"/>'),
  scale: I('<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M8.5 10.5a4.5 4.5 0 0 1 7 0"/><path d="M12 12.5 13.7 10"/>'),
  target: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  bolt: I('<path d="M13.5 2.5 5 13.5h5.5L9.5 21.5 19 10.5h-5.8Z"/>'),
  food: I('<path d="M6 3v7a2.5 2.5 0 0 0 5 0V3"/><path d="M8.5 10.5V21"/><path d="M17.5 3c-1.6 1.3-2.5 3.2-2.5 5.5s.9 4 2.5 4.5V21"/>'),
  steps: I('<path d="M7 4.5c1.7 0 2.6 1.5 2.6 3.4 0 1.6-.7 2.6-.7 4 0 1.2-.9 1.9-2 1.9s-2-.7-2-1.9c0-1.4-.7-2.4-.7-4C4.2 6 5.3 4.5 7 4.5Z"/><path d="M17 9c1.7 0 2.6 1.5 2.6 3.4 0 1.6-.7 2.6-.7 4 0 1.2-.9 1.9-2 1.9s-2-.7-2-1.9c0-1.4-.7-2.4-.7-4C14.2 11.5 15.3 10 17 10Z"/>'),
  heart: I('<path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 3.1C19.5 15.4 12 20 12 20Z"/>'),
  brain: I('<path d="M9.5 4.5A2.7 2.7 0 0 0 6.8 7.2a2.6 2.6 0 0 0-1.6 4.4 2.7 2.7 0 0 0 1.3 4.4 2.6 2.6 0 0 0 3 3V4.5Z"/><path d="M14.5 4.5A2.7 2.7 0 0 1 17.2 7.2a2.6 2.6 0 0 1 1.6 4.4 2.7 2.7 0 0 1-1.3 4.4 2.6 2.6 0 0 1-3 3V4.5Z"/>'),
  download: I('<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/>'),
  upload: I('<path d="M12 15.5v-11"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4.5 19.5h15"/>'),
  trash: I('<path d="M4.5 6.5h15"/><path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7"/><path d="M6.5 6.5 7.4 20h9.2l.9-13.5"/>'),
  refresh: I('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>'),
  info: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none"/>'),
  calendar: I('<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/>'),
  flame2: I('<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.7.7-3.1 1.6-4.2C9.4 9.6 10 11 11 11c0-3 1-6 1-8Z"/>'),
  award: I('<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.8-1.3 6.7 4.8-2.6 4.8 2.6-1.3-6.7"/>'),
  list: I('<path d="M8 6.5h12M8 12h12M8 17.5h12"/><circle cx="4.2" cy="6.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.2" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.2" cy="17.5" r="1.1" fill="currentColor" stroke="none"/>'),
  arrowUp: I('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>'),
  arrowDown: I('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>'),
  edit: I('<path d="M4.5 19.5h4l10-10-4-4-10 10Z"/><path d="m14.5 5.5 4 4"/>'),
  eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>')
};

export function hydrateIcons(root = document) {
  $$('[data-ico]', root).forEach(el => {
    const name = el.dataset.ico;
    if (ICONS[name] && !el.firstChild) el.innerHTML = ICONS[name];
  });
}
export function icon(name, cls = '') {
  return `<span class="ico ${cls}">${ICONS[name] || ''}</span>`;
}

/* ---------- Small canvas helper ---------- */
export function setupCanvas(canvas, height) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.parentElement.clientWidth || 320;
  const h = height || canvas.clientHeight || 160;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Tiny markdown: **bold** and line bullets → HTML (input is escaped first). */
export function md(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|\n)(•|-) /g, '$1▸ ')
    .replace(/\n/g, '<br>');
}
