# Momentum — Life & Body Coach

An offline-first Progressive Web App for one job: **balance work and personal life while going from 100 kg to a muscular, capable body — with movement like a 25-year-old.**

No accounts, no backend, no build step. Plain HTML/CSS/ES modules served by a tiny Node script, everything stored on your own device.

---

## Run it

```bash
node serve.mjs          # → http://localhost:5173
PORT=8080 node serve.mjs   # custom port
```

Any static file server works too (`npx serve`, `python -m http.server`), but the bundled
`serve.mjs` already sets the `text/javascript`, `application/manifest+json` and
`Service-Worker-Allowed` headers the PWA needs.

> **HTTPS caveat:** service workers and `navigator.clipboard` require a secure context.
> `http://localhost` is treated as secure, so local development is fine. For a real
> deployment put it behind any HTTPS host (Netlify, Vercel, GitHub Pages, nginx, …).

Open the URL, and the 5-step first-run wizard sets up your profile (weight, height, age,
work days, deep-work goal, training level).

---

## The app at a glance

| View | What it does |
|---|---|
| **Today** | Day's workout card, energy/steps/sleep check-ins, three score rings (Train · Fuel · Flow), streak + movement age, one "next action". |
| **Body** | 4-day bodyweight program (Push / Pull / Legs / Mobility), 8-week phases, an exercise **chains** system with tier upgrades, per-set logging (reps + RPE), circuit mode, rest timer, weekly history. |
| **Fuel** | Calorie/protein targets from Mifflin-St Jeor with a ~20% deficit, quick-add staples, full meal log, water tracker, **26 homemade Indian recipes** with servings → targets. |
| **Flow** | Work-day timeline, focus timer (25/50 min), shutdown ritual, weekly work-hours chart, work/life balance score. |
| **Move** | Movement Age scoring (tests → age, target = 25), baseline weekly test, daily mobility routines (hips/shoulders/spine/ankles), re-test flow with progress deltas. |
| **Progress** | Weight trend + projection, consistency heatmap, streaks, workout volume chart, JSON export/import. |
| **Coach** | Rule-based assistant that reads your real data: calories left, what to train today, why your balance score dropped, recovery advice — with one-tap action chips. |
| **Settings** | Profile & schedule (targets recalculate live), theme, install button, reminders, **vision provider**, data export/import/reset. |

### Training (bodyweight only)

- **Chains**: each exercise is a chain of tiers (e.g. *Knee Push-up → Incline Push-up → … → One-arm Push-up*).
  Hit every set clean at the top of the rep range twice in a week and the chain **levels up** automatically.
- No equipment required; optional dumbballs/towel/chair are noted per tier as "kit".
- Sessions are logged from the set rows — reps and RPE — and feed progression, streaks and the coach.

### Movement Age

Weekly tests (squat sit-back, hip rotation, shoulder reach, split-squat balance, calf raise, plank)
score 0–10 each. `Movement Age = 50 − 5 × average score`, so an average of **5 = age 25**.

### Nutrition

- BMR — Mifflin-St Jeor; target = BMR × activity × 0.8 (≈20 % deficit).
- Protein target **1.7 g/kg** to preserve/build muscle while cutting.

---

## Food photo → calories (and it's deleted right after reading)

Tap **"Snap food photo → calories"** on Today or Fuel:

1. The photo is compressed in memory to a small JPEG data URL. **It is never written to
   localStorage, IndexedDB, the service-worker cache or the DOM.**
2. The configured vision provider (or the built-in offline estimator) reads it and returns
   per-item portions → kcal + protein.
3. You confirm/adjust, the meal is logged, and **the image bytes are discarded immediately**
   — also on cancel, error or modal close. The log keeps only text (e.g. *"2 roti + 1 egg"*).

Settings → **Configure vision provider**:

| Provider | Endpoint | Notes |
|---|---|---|
| `OpenAI` | `https://api.openai.com/v1/chat/completions` (default) | Model `gpt-4o-mini`; API key stored in this browser only. |
| `Gemini` | `https://generativelanguage.googleapis.com/v1beta/models` (default) | Model `gemini-2.0-flash`. |
| `Ollama` | `http://localhost:11434` | **Fully local, nothing leaves your machine.** Model `qwen2.5vl:7b`. |
| `None` | — | Guided on-device estimator: pick visible items/quantities, confirm the kcal. |

**Local Ollama setup**

```bash
ollama pull qwen2.5vl:7b     # or any vision model you prefer
ollama serve                 # usually already running
```

If the browser blocks the request (CORS), restart Ollama with a permissive origin:

```bash
OLLAMA_ORIGINS=* ollama serve        # macOS/Linux
$env:OLLAMA_ORIGINS="*"; ollama serve  # PowerShell
```

Leave the provider on `None` and the app still works — estimation happens entirely on-device.

### Indian homemade recipes

Fuel → recipes library: dal tadka, rajma, chana masala, paneer bhurji, egg bhurji, chicken
curry, fish curry, khichdi, poha, upma, oats-idli, besan chilla, sprouts chaat, raita and more —
each with kcal/protein per serving, cook steps and "log this" with servings multiplier.
`suggestRecipes()` picks options that fit today's remaining calories/protein.

---

## Offline / PWA

- `manifest.webmanifest` + 4 icons (192/512/maskable/apple-touch) → installable, 3 app shortcuts.
- `sw.js` precaches the app shell and serves it **stale-while-revalidate**, so the app opens
  instantly offline; a version bump (`momentum-v1.0.x`) busts old caches.
- Once loaded, every view works with no network at all. Network is only used if *you*
  configure a cloud vision provider (OpenAI/Gemini).

Install: browser address-bar **Install** button, or Settings → *Install Momentum*.

---

## Data & privacy

- Everything lives in `localStorage` under the key **`momentum.v1`** — profile, weight history,
  workouts, meals, water, focus sessions, tests, coach chat, settings.
- **No analytics, no telemetry, no login, no server round-trips.**
- The only outbound requests the app can make are (a) your configured vision provider, and
  (b) `fetch` of its own static assets by the service worker.
- API keys are stored on-device in `momentum.v1` and sent only to the endpoint you typed.
- Settings → **Export JSON** for a backup, **Import backup** to restore, **Reset all data** to
  start over (or just clear site data in the browser).

---

## Project structure

```
RKS-AI/
├── index.html              # shell: sidebar, topbar, tabbar, <main id="view">
├── manifest.webmanifest    # PWA manifest (3 shortcuts, icons)
├── sw.js                   # service worker — precache + SWR (bump VERSION to ship changes)
├── serve.mjs               # dependency-free static server (PORT env)
├── icons/                  # 192, 512, maskable, apple-touch, favicon, icon.svg
├── css/app.css             # design tokens, components, responsive (640/480/1023 breakpoints)
└── js/
    ├── app.js              # boot, hash router, theme, install prompt, service-worker register
    ├── store.js            # single localStorage store, schema, targets/bmr, todayScores
    ├── utils.js            # dates, formatting, dom helpers, debounce, icons
    ├── plan.js             # 4-day program, chains/progression, routines, tests, movement age
    ├── recipes.js          # 26 Indian recipes + suggestRecipes()
    ├── vision.js           # photo pick/compress/analyse/forget, VISUAL_PORTIONS fallback
    ├── snaplog.js          # photo → estimate → confirm → delete flow
    ├── charts.js           # canvas line/bar/donut charts (no dependencies)
    ├── coach.js            # intents + responses built from live data
    ├── ui.js               # toast, modal, rings, bars, shared markup
    ├── onboarding.js       # 5-step wizard
    └── views/              # today, body, fuel, flow, move, progress, coach, settings
```

### Development notes

- ES modules, **no bundler** — edit a file, reload the page (reload twice: the service worker
  serves assets stale-while-revalidate; or bump `VERSION` in `sw.js`).
- Syntax check everything with:

  ```bash
  for f in js/*.js js/views/*.js serve.mjs sw.js; do node --check "$f"; done
  ```

- Layout was verified without horizontal overflow at 320/360/390/414/430/480/500/640/768/900/1024/1360 px.
  When adding markup: use `.row` / `.grid` / `.stack` helpers (rows wrap below 640px) and avoid
  fixed inline `min-width`s — use `min(Npx, 100%)` instead.

---

## Browser support

Evergreen Chromium/Firefox/Safari (ES2020 modules, `color-mix()`, `dvh`, service workers).
iOS Safari ≥ 16.4 for the full PWA experience.
