/* =========================================================================
   ui.js — toasts, modals, rings, navigation, shared timers
   ========================================================================= */

import { $, $$, clamp, esc, mmss, icon, hydrateIcons, hydrateIcons as hi } from './utils.js';

/* ---------------- navigation ---------------- */
export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

/* ---------------- toast ---------------- */
export function toast(message, kind = '') {
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'good' ? 'check' : kind === 'warn' ? 'info' : 'bolt', 'sm')}<span>${esc(message)}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

/* ---------------- modal ---------------- */
let activeModal = null;

export function modal({ title, body = '', footer = '', wide = false, onClose = null, dismissable = true }) {
  closeModal();
  const root = $('#modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'width:min(720px,100%)' : ''}">
      <div class="modal-head">
        <h3 style="font-size:16.5px">${esc(title)}</h3>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.appendChild(backdrop);
  hydrateIcons(backdrop);

  const close = () => { backdrop.remove(); activeModal = null; onClose && onClose(); };
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop && dismissable) close();
    if (e.target.closest('[data-close]')) close();
  });
  const onKey = e => {
    if (e.key === 'Escape' && dismissable && activeModal) { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  activeModal = { close, root: backdrop };
  const first = backdrop.querySelector('input, textarea, select, button:not([data-close])');
  if (first) setTimeout(() => first.focus(), 60);
  return { close, root: backdrop };
}

export function closeModal() { activeModal && activeModal.close(); }

export function confirmDialog(message, { ok = 'Confirm', cancel = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    const m = modal({
      title: 'Are you sure?',
      body: `<p class="muted">${esc(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-cancel>${esc(cancel)}</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button>`,
      onClose: () => resolve(false)
    });
    m.root.querySelector('[data-cancel]').onclick = () => m.close();
    m.root.querySelector('[data-ok]').onclick = () => { m.root.remove(); activeModal = null; resolve(true); };
  });
}

/* ---------------- components ---------------- */
export function ring(pct, { label = '', value = '', color = 'var(--accent)', size = 116 } = {}) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const dash = `${(clamp(pct, 0, 100) / 100) * c} ${c}`;
  return `
    <div class="ring" style="width:${size}px;height:${size}px" data-ring="${label}">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}"></circle>
        <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}"
          stroke="${color}" stroke-dasharray="0 ${c}"></circle>
      </svg>
      <div class="ring-center">
        <div class="ring-val">${value || `${pct}%`}</div>
        <div class="ring-lab">${esc(label)}</div>
      </div>
    </div>`;
}

/** Animate rings after insertion into the DOM. */
export function animateRings(root) {
  $$('.ring .ring-fg', root).forEach(circle => {
    const ringEl = circle.closest('.ring');
    const svg = circle.ownerSVGElement;
    const size = Number(svg.getAttribute('width')) || 116;
    const r = (size - 10) / 2;
    const c = 2 * Math.PI * r;
    const pct = Number(ringEl.dataset.pct ?? 0);
    const value = `${(clamp(pct, 0, 100) / 100) * c} ${c}`;
    // rAF gives the sweep its transition; the timeout is a safety net for
    // background/occluded tabs where rAF is throttled and would leave the ring at 0.
    requestAnimationFrame(() => circle.setAttribute('stroke-dasharray', value));
    setTimeout(() => {
      if (document.body.contains(circle)) circle.setAttribute('stroke-dasharray', value);
    }, 500);
  });
}

/** Build a ring with data-pct so animateRings can pick it up. */
export function ringPct(pct, opts = {}) {
  const html = ring(pct, opts);
  return html.replace('data-ring=', `data-pct="${clamp(pct, 0, 100)}" data-ring=`);
}

export function bar(pct, cls = '') {
  return `<div class="bar ${cls}"><i style="width:${clamp(pct, 0, 100)}%"></i></div>`;
}

export function emptyState(iconName, title, sub, action = '') {
  return `<div class="empty">${icon(iconName, 'lg')}<h3>${esc(title)}</h3><p>${esc(sub)}</p>${action}</div>`;
}

/* =========================================================================
   TIMER ENGINE — one focus timer shared by Flow view + topbar
   ========================================================================= */

function createTimer({ onTick = () => {}, onComplete = () => {} } = {}) {
  let left = 0, total = 0, running = false, id = null, label = '';
  const subs = new Set();

  const emit = () => subs.forEach(f => f(snapshot()));
  const snapshot = () => ({ left, total, running, pct: total ? (left / total) * 100 : 100, label });

  function tick() {
    left = Math.max(0, left - 1);
    onTick(left);
    emit();
    if (left === 0) {
      stop(false);
      onComplete(label);
    }
  }

  return {
    start(seconds, timerLabel = '') {
      clearInterval(id);
      left = seconds; total = seconds; label = timerLabel; running = true;
      id = setInterval(tick, 1000);
      emit();
    },
    pause() { running = false; clearInterval(id); emit(); },
    resume() { if (left > 0 && !running) { running = true; id = setInterval(tick, 1000); emit(); } },
    stop(reset = true) { clearInterval(id); running = false; if (reset) { left = 0; total = 0; } emit(); },
    subscribe(fn) { subs.add(fn); fn(snapshot()); return () => subs.delete(fn); },
    get: snapshot
  };
}

/** Focus / work-session timer (Pomodoro-style, logs minutes when done). */
export const focusTimer = createTimer({
  onComplete: label => {
    import('./store.js').then(({ patchDaily, store }) => {
      const mins = Math.round((store.state.settings.focusLen || 25));
      patchDaily(new Date().toISOString().slice(0, 10), { focusMin: 0 });
      store.set(s => {
        const d = new Date().toISOString().slice(0, 10);
        s.focus.push({ d, ts: Date.now(), minutes: mins, label: label || 'Focus block' });
        const day = s.daily[d] || {};
        s.daily[d] = Object.assign({ focusMin: 0 }, day, { focusMin: (day.focusMin || 0) + mins });
      });
      toast('Focus block logged — nice boundary work', 'good');
    });
  }
});

/** Generic rest / countdown timer used by Body and Move. */
export const restTimer = createTimer({
  onComplete: () => toast('Rest done — next set', 'warn')
});

export { mmss, esc, clamp, icon, hydrateIcons as hydrate, $, $$ };
