/* =========================================================================
   app.js — router, shell, theme, install, reminders
   ========================================================================= */

import { $, $$, hydrateIcons, esc, icon, dateKey, toMin, nowMin, clamp } from './utils.js';
import { store, streak } from './store.js';
import { movementAge } from './plan.js';
import { showOnboarding } from './onboarding.js';
import { toast } from './ui.js';

import * as today from './views/today.js';
import * as body from './views/body.js';
import * as fuel from './views/fuel.js';
import * as flow from './views/flow.js';
import * as move from './views/move.js';
import * as progress from './views/progress.js';
import * as coachView from './views/coach.js';
import * as settings from './views/settings.js';

const ROUTES = {
  today:    { mod: today,     title: 'Today',     nav: 'today' },
  body:     { mod: body,      title: 'Body',      nav: 'body' },
  fuel:     { mod: fuel,      title: 'Fuel',      nav: 'fuel' },
  flow:     { mod: flow,      title: 'Flow',      nav: 'flow' },
  move:     { mod: move,      title: 'Move',      nav: 'move' },
  progress: { mod: progress,  title: 'Progress',  nav: 'progress' },
  coach:    { mod: coachView, title: 'Coach',     nav: 'coach' },
  settings: { mod: settings,  title: 'Settings',  nav: 'settings' }
};

let deferredRender = false;

/* =========================================================================
   RENDERING
   ========================================================================= */
function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '') || 'today';
  return ROUTES[hash] ? hash : 'today';
}

export function render() {
  const root = $('#view');
  if (!root) return;

  // Don't stomp on a text field mid-edit — wait for blur.
  const ae = document.activeElement;
  if (ae && root.contains(ae) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) {
    deferredRender = true;
    return;
  }

  const key = currentRoute();
  const route = ROUTES[key];
  document.title = `${route.title} · Momentum`;
  $('#page-title').textContent = route.title;

  $$('.side-nav a, .tabbar a').forEach(a => a.classList.toggle('active', a.dataset.nav === route.nav));
  root.classList.toggle('wide', ['progress', 'settings', 'body'].includes(key));

  try {
    route.mod.render(root);
  } catch (err) {
    console.error('view render failed', err);
    root.innerHTML = `
      <div class="card empty" style="margin-top:30px">
        ${icon('info', 'lg')}
        <h3>This view hit a snag</h3>
        <p>${esc(err.message || String(err))}</p>
        <button class="btn btn-primary" onclick="location.hash='#/today'">Back to Today</button>
      </div>`;
    hydrateIcons(root);
  }
  updateShell();
}

const renderDebounced = (() => {
  let t;
  return () => { clearTimeout(t); t = setTimeout(render, 50); };
})();

/* =========================================================================
   SHELL (sidebar stats, clock)
   ========================================================================= */
function updateShell() {
  const st = $('#side-streak'), mage = $('#side-mage');
  if (st) st.textContent = `${streak()}d`;
  if (mage) {
    const a = movementAge();
    mage.textContent = a ? `${a}y` : '—';
  }
}

function tickClock() {
  const el = $('#top-clock');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* =========================================================================
   THEME
   ========================================================================= */
export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F2F5F9' : '#0A0C10');
  store.set(s => { s.settings.theme = theme; }, { silent: true });
  renderDebounced();
}

function initTheme() {
  const saved = store.state.settings.theme;
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F2F5F9' : '#0A0C10');
}

/* =========================================================================
   PWA INSTALL
   ========================================================================= */
let installEvent = null;
export function promptInstall() {
  if (installEvent) {
    installEvent.prompt();
    installEvent.userChoice.finally(() => { installEvent = null; syncInstallBtn(); });
  } else {
    toast('Use your browser menu → "Install app" / "Add to Home Screen"', 'warn');
  }
}
function syncInstallBtn() {
  const btn = $('#install-btn');
  if (btn) btn.hidden = !installEvent;
}

/* =========================================================================
   REMINDERS (while the app is open)
   ========================================================================= */
function scheduleReminders() {
  if (!store.state.settings.reminders) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const p = store.state.profile;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  // Hard stop nudge
  const stop = toMin(p.workEnd);
  if (stop > mins && stop - mins <= 24 * 60) {
    setTimeout(() => {
      new Notification('Hard stop 🔔', { body: 'Work ends now. Shutdown ritual, then training or mobility.' });
    }, (stop - mins) * 60000);
  }

  // Training nudge 45 min after work starts (on training days)
  const trainAt = toMin(p.workStart) + 60;
  if (p.trainDays.includes(now.getDay()) && trainAt > mins) {
    setTimeout(() => {
      new Notification('Movement window', { body: 'One session today keeps the streak and the balance score alive.' });
    }, (trainAt - mins) * 60000);
  }
}

/* =========================================================================
   BOOT
   ========================================================================= */
function boot() {
  hydrateIcons(document);
  initTheme();
  tickClock();
  setInterval(tickClock, 15000);

  window.addEventListener('hashchange', render);
  store.subscribe(renderDebounced);

  $('#theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
  $('#quick-focus')?.addEventListener('click', async () => {
    const { focusTimer } = await import('./ui.js');
    focusTimer.start((store.state.settings.focusLen || 25) * 60, 'Focus block');
    toast('Focus block started', 'good');
    location.hash = '#/flow';
  });
  $('#mobile-brand')?.addEventListener('click', () => { location.hash = '#/today'; });
  $('#install-btn')?.addEventListener('click', promptInstall);

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvent = e;
    syncInstallBtn();
  });
  window.addEventListener('appinstalled', () => { installEvent = null; syncInstallBtn(); });

  window.addEventListener('online', () => toast('Back online', 'good'));
  window.addEventListener('offline', () => toast('Offline — everything still works, all local', 'warn'));

  // first paint
  if (!location.hash) location.replace('#/today');
  render();

  if (!store.state.onboarded) showOnboarding($('#onboarding-root'));
  else scheduleReminders();

  // expose a tiny console helper for debugging
  window.momentum = { store, render, setTheme };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
