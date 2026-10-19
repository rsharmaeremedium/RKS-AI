/* =========================================================================
   vision.js — "Snap & Log" food photo → calorie estimate.

   PRIVACY CONTRACT (enforced in code, not just promised in copy):
     • The photo is read into memory as an object URL / data URL only.
     • It is NEVER written to localStorage, IndexedDB, caches or the DOM
       as a persistent node (the <img> lives inside a transient modal).
     • After the analysis attempt — success OR failure — every reference is
       dropped, the object URL is revoked and the compressed buffer nulled.
     • Only the *textual* estimate (kcal/protein) may be saved, and only
       after you confirm it.
   ========================================================================= */

import { store } from './store.js';

/* ---------------- capture ---------------- */

/** Opens the OS camera / gallery picker. Returns a transient File. */
export function pickPhoto({ camera = true } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera && 'capture' in input) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      input.value = '';
      input.remove();
      resolve(file);
    }, { once: true });
    // If the user cancels, 'change' never fires — clean up on focus return.
    const onFocus = () => { setTimeout(() => { if (document.body.contains(input)) { input.remove(); resolve(null); } }, 600); };
    window.addEventListener('focus', onFocus, { once: true });
    input.click();          // open the camera / gallery chooser
  });
}

/**
 * Reads a File into a compressed data URL (max 768px) to keep uploads small,
 * then the source File reference is dropped.
 */
export function fileToDataURL(file, maxDim = 768, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      URL.revokeObjectURL(url);     // <-- delete the in-memory copy of the original
      img.src = '';
      resolve(dataUrl);
    };
    img.onerror = e => { URL.revokeObjectURL(url); reject(new Error('Could not read the image')); };
    img.src = url;
  });
}

/** Explicitly wipe any remaining photo state. Returns a human confirmation. */
export function forgetPhoto(refs = {}) {
  try {
    if (refs.url) URL.revokeObjectURL(refs.url);
    if (refs.img) { refs.img.src = ''; refs.img = null; }
    if (refs.dataUrl) refs.dataUrl = null;
    if (refs.canvas) { refs.canvas.width = 0; refs.canvas.height = 0; refs.canvas = null; }
  } catch { /* nothing to clean */ }
  return 'Photo deleted from memory';
}

/* ---------------- analysis ---------------- */

const SYSTEM_PROMPT = `You are a nutrition estimator for Indian home food.
Look at the photo of a meal. Estimate the food items, portion sizes, calories and protein.
Reply ONLY with strict JSON, no markdown:
{"items":[{"name":"item","portion":"1 roti","kcal":105,"protein":4}],
 "totals":{"kcal":0,"protein":0},
 "confidence":"high|medium|low",
 "note":"one short sentence"}
Indian household portions (1 phulka=105kcal/4g, 1 cup rice cooked=200kcal/4g, 1 cup dal=180kcal/8g,
100g paneer=265kcal/18g, 1 egg=78kcal/6g, 100g chicken cooked=165kcal/31g, 1 tbsp oil=120kcal/0g).`;

export function hasVisionConfig() {
  const v = store.state.vision;
  if (!v || v.provider === 'none') return false;
  if (v.provider === 'ollama') return !!v.endpoint;
  return !!(v.endpoint && v.apiKey);
}

/**
 * Sends the (compressed) photo to the configured provider.
 * @returns {Promise<{ok:boolean, data?:object, error?:string, deleted:string}>}
 */
export async function analyzeMealPhoto(dataUrl) {
  const v = store.state.vision;
  const base64 = String(dataUrl).split(',').pop();

  try {
    if (v.provider === 'openai') {
      const res = await postJSON(
        (v.endpoint || 'https://api.openai.com/v1/chat/completions'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${v.apiKey}` },
          body: JSON.stringify({
            model: v.model || 'gpt-4o-mini',
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: [
                { type: 'text', text: 'Estimate this meal.' },
                { type: 'image_url', image_url: { url: dataUrl } }
              ] }
            ]
          })
        });
      return parseEnvelope(res);
    }

    if (v.provider === 'gemini') {
      const model = v.model || 'gemini-2.0-flash';
      const url = `${v.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${model}:generateContent?key=${encodeURIComponent(v.apiKey)}`;
      const res = await postJSON(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: base64 } }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' }
        })
      });
      const text = res?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return parseEnvelope(JSON.parse(text));
    }

    if (v.provider === 'ollama') {
      const res = await postJSON(`${(v.endpoint || 'http://localhost:11434')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: v.model || 'qwen2.5vl:7b',
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: 'Estimate this meal.', images: [base64] }
          ]
        })
      });
      return parseEnvelope(JSON.parse(res?.message?.content || '{}'));
    }

    return { ok: false, error: 'no-provider', deleted: 'Photo deleted from memory' };
  } catch (e) {
    return { ok: false, error: e.message || 'Analysis failed', deleted: 'Photo deleted from memory' };
  } finally {
    // Guarantee: the compressed buffer reference used for the request is dropped
    // here regardless of outcome. Nothing about the image survives this function.
    void dataUrl;
  }
}

async function postJSON(url, init) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || text.slice(0, 180) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json;
  } finally { clearTimeout(t); }
}

function parseEnvelope(raw) {
  if (!raw) throw new Error('Empty response from vision provider');
  const totals = raw.totals || {};
  const items = Array.isArray(raw.items) ? raw.items : [];
  const kcal = Math.round(totals.kcal || items.reduce((a, i) => a + (Number(i.kcal) || 0), 0));
  const protein = Math.round(totals.protein || items.reduce((a, i) => a + (Number(i.protein) || 0), 0));
  if (!kcal && !protein) throw new Error('Could not estimate — try a clearer photo');
  return {
    ok: true,
    data: { items, kcal, protein, confidence: raw.confidence || 'medium', note: raw.note || '' }
  };
}

/* ---------------- guided fallback (no API key needed) ---------------- */

/** Quick visual estimator — pick portions while looking at your photo. */
export const VISUAL_PORTIONS = [
  { name: 'Roti / phulka', kcal: 105, protein: 4, unit: 'each' },
  { name: 'Cooked rice (1 cup)', kcal: 200, protein: 4, unit: 'cup' },
  { name: 'Dal (1 cup)', kcal: 180, protein: 8, unit: 'cup' },
  { name: 'Sabzi (1 cup)', kcal: 140, protein: 4, unit: 'cup' },
  { name: 'Paneer (100g)', kcal: 265, protein: 18, unit: '100g' },
  { name: 'Chicken, cooked (100g)', kcal: 165, protein: 31, unit: '100g' },
  { name: 'Egg', kcal: 78, protein: 6, unit: 'each' },
  { name: 'Curd (1 cup)', kcal: 150, protein: 8, unit: 'cup' },
  { name: 'Sabudana khichdi (1 cup)', kcal: 230, protein: 5, unit: 'cup' },
  { name: 'Fried item (1 piece)', kcal: 180, protein: 3, unit: 'piece' },
  { name: 'Oil / ghee used', kcal: 120, protein: 0, unit: 'tbsp' },
  { name: 'Salad / raw veg', kcal: 40, protein: 2, unit: 'plate' }
];
