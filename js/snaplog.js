/* =========================================================================
   snaplog.js — "Snap a pic of your meal → get calories → photo is deleted"

   Flow:  pick → compress → read → estimate → CONFIRM → log → delete.
   The image is displayed only inside a transient modal and is wiped when:
     • the analysis finishes (auto path), or
     • the modal is closed for any reason (manual / cancel path).
   ========================================================================= */

import { esc, icon, hydrateIcons, clamp, round } from './utils.js';
import { toast, modal, closeModal, bar } from './ui.js';
import { logMeal, targets, dayNutrition } from './store.js';
import { pickPhoto, fileToDataURL, analyzeMealPhoto, hasVisionConfig, forgetPhoto, VISUAL_PORTIONS } from './vision.js';

/**
 * @param {File|null} file  Pass a file to skip the OS picker (drag-drop / tests).
 */
export async function openSnapLog(file = null) {
  const chosen = file || await pickPhoto({ camera: true });
  if (!chosen) return;

  let dataUrl;
  try {
    dataUrl = await fileToDataURL(chosen);
  } catch (e) {
    toast(e.message || 'Could not read that photo', 'warn');
    return;
  }

  const refs = { dataUrl };
  const m = modal({
    title: 'Reading your meal…',
    dismissable: false,
    body: `
      <div class="stack" id="snap-stage">
        <div class="row" style="gap:14px;align-items:flex-start">
          <img id="snap-preview" src="${dataUrl}" alt="Meal photo being analysed"
               style="width:132px;height:132px;object-fit:cover;border-radius:14px;border:1px solid var(--line)" />
          <div class="stack" style="gap:6px">
            <div class="badge accent">Analysing</div>
            <p class="small muted" id="snap-status">
              ${hasVisionConfig()
                ? 'Sending to your vision provider, then deleting the image from memory…'
                : 'No vision provider configured — you\'ll estimate portions visually, then the photo is deleted.'}
            </p>
          </div>
        </div>
        <div class="bar"><i style="width:35%;animation:none"></i></div>
      </div>`,
    footer: `<button class="btn btn-ghost" id="snap-cancel">Cancel</button>`,
    onClose: () => { forgetPhoto(refs); }
  });
  hydrateIcons(m.root);
  m.root.querySelector('#snap-cancel').onclick = () => {
    forgetPhoto(refs);
    closeModal();
    toast('Photo deleted from memory');
  };

  // ---------- auto path ----------
  if (hasVisionConfig()) {
    const statusEl = m.root.querySelector('#snap-status');
    const result = await analyzeMealPhoto(dataUrl);

    // DELETE NOW — the picture has been read; no need to keep any of it.
    const preview = m.root.querySelector('#snap-preview');
    if (preview) { preview.src = ''; preview.remove(); }
    forgetPhoto(refs);

    if (result.ok) {
      renderConfirm(m, result.data, { deleted: true });
      return;
    }
    if (statusEl) {
      statusEl.innerHTML = `<span class="danger">${esc(result.error || 'Analysis failed')}</span>`;
    }
    toast('Vision provider failed — falling back to visual estimate', 'warn');
  }

  // ---------- guided path (also fallback) ----------
  renderManual(m, refs);
}

/* ---------------- confirmation of an AI estimate ---------------- */
function renderConfirm(m, data, { deleted }) {
  const tg = targets();
  const used = dayNutrition();
  const after = round(used.kcal + data.kcal);
  const conf = { high: 'good', medium: 'warn', low: 'danger' }[data.confidence] || '';

  m.root.querySelector('.modal-head h3').textContent = 'Confirm your meal';
  m.root.querySelector('.modal-body').innerHTML = `
    <div class="row between">
      <span class="badge ${conf}">${esc(data.confidence)} confidence</span>
      <span class="badge good">${icon('trash', 'sm')} photo deleted</span>
    </div>
    ${data.note ? `<p class="small muted">${esc(data.note)}</p>` : ''}
    <div class="list card flush">
      ${(data.items || []).map(i => `
        <div class="list-item">
          <span class="avatar-ico">${icon('food')}</span>
          <div class="grow">
            <div class="list-title">${esc(i.name)}</div>
            <div class="list-sub">${esc(i.portion || '')}</div>
          </div>
          <div class="num" style="text-align:right">
            <div style="font-weight:700">${round(i.kcal)} kcal</div>
            <div class="tiny muted">${round(i.protein)}g protein</div>
          </div>
        </div>`).join('')}
    </div>

    <div class="grid c3">
      <div class="card"><div class="stat"><div class="stat-v">${data.kcal}</div><div class="stat-k">kcal</div></div></div>
      <div class="card"><div class="stat"><div class="stat-v">${data.protein}g</div><div class="stat-k">protein</div></div></div>
      <div class="card"><div class="stat"><div class="stat-v">${after}</div><div class="stat-k">of ${tg.kcal}</div></div></div>
    </div>

    <div class="stack" style="gap:6px">
      <div class="row between tiny muted"><span>Today after logging</span><span>${used.protein + data.protein}g / ${tg.protein}g protein</span></div>
      ${bar(clamp(after / tg.kcal * 100, 0, 100), after > tg.kcal * 1.1 ? 'c3' : '')}
    </div>

    <div class="field">
      <label>Adjust name if needed</label>
      <input class="input" id="cf-name" value="${esc((data.items || []).map(i => i.name).join(', ').slice(0, 60) || 'Meal photo')}" />
    </div>`;

  m.root.querySelector('.modal-foot').innerHTML = `
    <button class="btn btn-ghost" id="cf-retry">Re-estimate</button>
    <button class="btn btn-primary" id="cf-save">${icon('check')} Log meal</button>`;
  hydrateIcons(m.root);

  m.root.querySelector('#cf-retry').onclick = () => openSnapLog();
  m.root.querySelector('#cf-save').onclick = () => {
    logMeal({
      slot: 'meal',
      name: m.root.querySelector('#cf-name').value.trim() || 'Meal photo',
      kcal: data.kcal, protein: data.protein, fromPhoto: true
    });
    forgetPhoto();
    closeModal();
    toast(`Logged ${data.kcal} kcal · ${data.protein}g protein — photo deleted`, 'good');
  };
}

/* ---------------- guided visual estimator ---------------- */
function renderManual(m, refs) {
  const picked = new Map();          // name -> {item, qty}
  const status = m.root.querySelector('#snap-status');
  if (status) status.innerHTML = 'No vision key set — estimate by eye. The photo is deleted the moment you finish or cancel.';

  m.root.querySelector('.modal-head h3').textContent = 'Estimate by eye';
  const body = m.root.querySelector('.modal-body');
  body.innerHTML = `
    <div class="row" style="gap:14px;align-items:flex-start">
      <img id="snap-preview" src="${refs.dataUrl}" alt="Your meal"
           style="width:118px;height:118px;object-fit:cover;border-radius:14px;border:1px solid var(--line)" />
      <p class="small muted" style="flex:1">Tap what's on the plate and how much. Quantities are yours to judge —
        the picture stays only until you finish, then it's wiped from memory.</p>
    </div>
    <div id="snap-rows" class="list card flush"></div>
    <div class="row between">
      <span class="small muted">Total</span>
      <span><b class="num" id="snap-total">0 kcal</b> <span class="small muted" id="snap-prot">· 0g protein</span></span>
    </div>
    <div class="field">
      <label>Name this meal</label>
      <input class="input" id="snap-name" placeholder="e.g. Dal rice + salad" />
    </div>`;
  m.root.querySelector('.modal-foot').innerHTML = `
    <button class="btn btn-ghost" id="mn-cancel">Cancel</button>
    <button class="btn btn-primary" id="mn-save" disabled>${icon('check')} Log meal</button>`;
  hydrateIcons(m.root);

  const rows = body.querySelector('#snap-rows');
  rows.innerHTML = VISUAL_PORTIONS.map((p, i) => `
    <div class="list-item" data-i="${i}">
      <div class="grow">
        <div class="list-title">${esc(p.name)}</div>
        <div class="list-sub">${p.kcal} kcal / ${esc(p.unit)} · ${p.protein}g protein</div>
      </div>
      <div class="row" style="gap:6px">
        <button class="btn btn-sm" data-dec aria-label="less">−</button>
        <b class="num" data-qty style="min-width:18px;text-align:center">0</b>
        <button class="btn btn-sm" data-inc aria-label="more">+</button>
      </div>
    </div>`).join('');

  const refresh = () => {
    let kcal = 0, protein = 0;
    picked.forEach(v => { kcal += v.item.kcal * v.qty; protein += v.item.protein * v.qty; });
    body.querySelector('#snap-total').textContent = `${kcal} kcal`;
    body.querySelector('#snap-prot').textContent = `· ${protein}g protein`;
    m.root.querySelector('#mn-save').disabled = kcal <= 0;
  };

  rows.onclick = e => {
    const row = e.target.closest('[data-i]');
    if (!row) return;
    const item = VISUAL_PORTIONS[Number(row.dataset.i)];
    const cur = picked.get(item.name);
    const qty = cur ? cur.qty : 0;
    if (e.target.closest('[data-inc]')) {
      const n = qty + 1;
      picked.set(item.name, { item, qty: n });
      row.querySelector('[data-qty]').textContent = n;
    } else if (e.target.closest('[data-dec]')) {
      const n = Math.max(0, qty - 1);
      if (n === 0) { picked.delete(item.name); row.querySelector('[data-qty]').textContent = '0'; }
      else { picked.set(item.name, { item, qty: n }); row.querySelector('[data-qty]').textContent = n; }
    } else return;
    refresh();
  };

  const cleanup = () => {
    const img = m.root.querySelector('#snap-preview');
    if (img) { img.src = ''; }
    forgetPhoto(refs);
    toast('Photo deleted from memory');
  };
  m.root.querySelector('#mn-cancel').onclick = () => { cleanup(); closeModal(); };
  m.root.querySelector('#mn-save').onclick = () => {
    let kcal = 0, protein = 0, parts = [];
    picked.forEach(v => { kcal += v.item.kcal * v.qty; protein += v.item.protein * v.qty; parts.push(`${v.qty}× ${v.item.name}`); });
    if (kcal <= 0) return;
    logMeal({
      slot: 'meal',
      name: (body.querySelector('#snap-name').value || parts.join(', ')).slice(0, 70),
      kcal: Math.round(kcal), protein: Math.round(protein), fromPhoto: true
    });
    cleanup();
    closeModal();
    toast(`Logged ${Math.round(kcal)} kcal · ${Math.round(protein)}g protein`, 'good');
  };
  refresh();
}
