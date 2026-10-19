/* =========================================================================
   views/progress.js — weight trend, projections, heatmap, personal bests
   ========================================================================= */

import { dateKey, esc, icon, hydrateIcons, fmtDate, round, addDays, clamp, sum } from '../utils.js';
import { toast, bar, modal, closeModal, navigate, confirmDialog } from '../ui.js';
import {
  store, weightSeries, trendSeries, weightStats, logWeight, latestWeight,
  heatmap, streak, dayScore, targets, exportJSON, importJSON
} from '../store.js';
import { movementAge, latestTest, currentPhase, getTier, progressOf, CHAINS } from '../plan.js';

export function render(root) {
  const series = weightSeries();
  const trend = trendSeries(4);
  const ws = weightStats();
  const hm = heatmap(91);
  const mage = movementAge();
  const st = streak();
  const p = store.state.profile;
  const projection = series.length >= 3 && ws.perWeek > 0.05
    ? project(trend, ws.perWeek, p.targetKg) : [];

  root.innerHTML = `
    <div class="stack-lg">
      <!-- Header -->
      <div class="row between wrap" style="gap:12px">
        <div>
          <div class="eyebrow">From ${esc(String(ws.start))}kg → target ${esc(String(p.targetKg))}kg</div>
          <div class="h-hero">${ws.lost > 0 ? `${ws.lost} kg down` : 'Trend starting'}</div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-primary" data-act="log-weight">${icon('scale')} Log weight</button>
          <button class="btn" data-act="export">${icon('download')} Export</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid c4">
        <div class="card"><div class="stat"><div class="stat-v">${esc(String(ws.now))}<span class="muted" style="font-size:15px">kg</span></div><div class="stat-k">current</div>
          <div class="stat-d ${ws.lost > 0 ? 'good' : 'muted'}">${ws.lost > 0 ? `▼ ${ws.lost} kg total` : 'no change yet'}</div></div></div>
        <div class="card"><div class="stat"><div class="stat-v">${ws.perWeek > 0 ? ws.perWeek : '—'}<span class="muted" style="font-size:15px">${ws.perWeek > 0 ? 'kg/wk' : ''}</span></div><div class="stat-k">rate</div>
          <div class="stat-d muted">${ws.perWeek > 0 ? (ws.perWeek > 1 ? 'faster than target — hold protein' : 'on target for muscle retention') : 'needs 3+ weigh-ins'}</div></div></div>
        <div class="card"><div class="stat"><div class="stat-v">${ws.toGo}<span class="muted" style="font-size:15px">kg</span></div><div class="stat-k">to goal</div>
          <div class="stat-d muted">${ws.weeksLeft ? `≈ ${ws.weeksLeft} weeks` : 'trend forming'}</div></div></div>
        <div class="card"><div class="stat"><div class="stat-v">${st}<span class="muted" style="font-size:15px">d</span></div><div class="stat-k">streak</div>
          <div class="stat-d ${st > 0 ? 'good' : 'muted'}">${st > 0 ? 'keep it alive' : 'start today'}</div></div></div>
      </div>

      <!-- Weight chart -->
      <div class="card stack">
        <div class="sec-title">
          <h2>Weight trend ${projection.length ? '· projected' : ''}</h2>
          <span class="tiny muted">${store.state.weights.length} weigh-ins</span>
        </div>
        ${series.length ? `<canvas id="w-chart" style="width:100%"></canvas>` : `
          <div class="empty">${icon('scale', 'lg')}<h3>No weigh-ins yet</h3>
            <p>Log first thing in the morning. Daily numbers, weekly verdicts.</p>
            <button class="btn btn-primary" data-act="log-weight">Log today's weight</button></div>`}
        ${projection.length ? `
          <div class="row between tiny muted">
            <span class="accent-2">Projected to hit ${esc(String(p.targetKg))}kg in ${round(daysTo(projection), 0)} days</span>
            <span>dashed = projection</span>
          </div>` : ''}
      </div>

      <!-- Heatmap -->
      <div class="card stack">
        <div class="sec-title"><h2>Last 90 days of consistency</h2>
          <span class="tiny muted">${hm.filter(d => d.score >= 60).length} strong days</span></div>
        <div class="heat">
          ${hm.map(d => `<i class="${level(d.score)}" title="${esc(fmtDate(d.d))} · ${d.score}/100"></i>`).join('')}
        </div>
        <div class="row" style="gap:6px;align-items:center">
          <span class="tiny muted">less</span>
          <i style="width:12px;height:12px;border-radius:3px;background:var(--ring-track)"></i>
          <i style="width:12px;height:12px;border-radius:3px;background:color-mix(in srgb,var(--accent) 30%,var(--ring-track))"></i>
          <i style="width:12px;height:12px;border-radius:3px;background:color-mix(in srgb,var(--accent) 55%,var(--ring-track))"></i>
          <i style="width:12px;height:12px;border-radius:3px;background:color-mix(in srgb,var(--accent) 80%,var(--ring-track))"></i>
          <i style="width:12px;height:12px;border-radius:3px;background:var(--accent)"></i>
          <span class="tiny muted">more</span>
        </div>
      </div>

      <div class="grid c2">
        <!-- Personal bests -->
        <div class="card stack">
          <div class="sec-title"><h2>Progression</h2></div>
          ${Object.keys(store.state.progress.exercises).length ? `
            <div class="list" style="border:1px solid var(--line);border-radius:14px;overflow:hidden">
              ${Object.entries(store.state.progress.exercises).map(([chainId, pr]) => {
                const tier = getTier(chainId, pr.level);
                const label = CHAINS[chainId]?.label || chainId;
                return `
                  <div class="list-item">
                    <span class="avatar-ico">${icon('arrowUp')}</span>
                    <div class="grow">
                      <div class="list-title">${esc(tier ? tier.name : chainId)}</div>
                      <div class="list-sub">${esc(label)} · level ${pr.level + 1}${pr.good ? ` · ${pr.good}/2 to promote` : ''}</div>
                    </div>
                    <span class="badge accent">L${pr.level + 1}</span>
                  </div>`;
              }).join('')}
            </div>` : `
            <div class="empty">${icon('dumbbell', 'lg')}<h3>No progression yet</h3>
              <p>Complete exercises in Body and levels unlock automatically.</p></div>`}
          ${mage ? `
            <div class="row between" style="border-top:1px solid var(--line);padding-top:12px">
              <span class="small muted">Movement age</span>
              <span><b class="num">${mage}</b> <span class="tiny muted">/ goal 25</span></span>
            </div>` : ''}
        </div>

        <!-- Session history -->
        <div class="card stack">
          <div class="sec-title"><h2>Training volume</h2><span class="tiny muted">${store.state.sessions.length} sessions</span></div>
          <canvas id="sess-chart" style="width:100%"></canvas>
          ${lastSetsStats()}
        </div>
      </div>

      <!-- Data -->
      <div class="card stack">
        <div class="sec-title"><h2>Your data</h2><span class="badge good">local only</span></div>
        <p class="small muted">Everything lives in this browser. Export to back up or move devices — the file never leaves your hands.</p>
        <div class="chip-row">
          <button class="chip" data-act="export">${icon('download', 'sm')} Export JSON</button>
          <button class="chip" data-act="import">${icon('upload', 'sm')} Import backup</button>
          <button class="chip" data-act="reset">${icon('trash', 'sm')} Reset everything</button>
        </div>
      </div>
    </div>`;

  hydrateIcons(root);
  bind(root);
  drawCharts(root, trend, projection, p);
}

/* ---------------- helpers ---------------- */
function level(score) {
  if (score >= 85) return 'l4';
  if (score >= 70) return 'l3';
  if (score >= 55) return 'l2';
  if (score >= 40) return 'l1';
  return '';
}

function daysTo(projection) {
  const a = new Date(projection[0].d), b = new Date(projection[projection.length - 1].d);
  return (b - a) / 86400000;
}

function project(trend, perWeek, targetKg) {
  if (!trend.length || perWeek <= 0.02) return [];
  const last = trend[trend.length - 1];
  if (last.kg <= targetKg) return [];
  const daysToGoal = Math.ceil(((last.kg - targetKg) / perWeek) * 7);
  if (daysToGoal > 500) return [];
  const out = [{ d: last.d, kg: last.kg }];
  const steps = Math.min(20, Math.max(4, Math.ceil(daysToGoal / 14)));
  for (let i = 1; i <= steps; i++) {
    const off = Math.round((daysToGoal * i) / steps);
    const d = new Date(new Date(last.d).getTime() + off * 86400000);
    out.push({
      d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      kg: round(last.kg - (perWeek * off) / 7, 1)
    });
  }
  return out;
}

function lastSetsStats() {
  const s = [...store.state.sessions].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 7);
  if (!s.length) return `<p class="tiny muted">Sessions appear here after your first log.</p>`;
  const sets = sum(s.map(x => x.setsTotal || 0));
  return `
    <div class="grid c3">
      <div class="stat"><div class="stat-v">${s.length}</div><div class="stat-k">last 7 logged</div></div>
      <div class="stat"><div class="stat-v">${sets}</div><div class="stat-k">sets total</div></div>
      <div class="stat"><div class="stat-v">${Math.round(sets / Math.max(1, s.length))}</div><div class="stat-k">sets / session</div></div>
    </div>`;
}

function drawCharts(root, trend, projection, p) {
  const wCanvas = root.querySelector('#w-chart');
  if (wCanvas && trend.length) {
    import('../charts.js').then(({ lineChart }) =>
      lineChart(wCanvas, { series: trend, goal: p.targetKg, projection, height: 220 }));
  }
  const sCanvas = root.querySelector('#sess-chart');
  if (sCanvas) {
    import('../charts.js').then(({ barChart }) => {
      const values = [];
      for (let i = 6; i >= 0; i--) {
        const d = addDays(dateKey(), -i);
        const n = store.state.sessions.filter(x => x.d === d).length;
        values.push({ label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(d).getDay()], v: n, max: 1, color: n ? 'var(--accent-3)' : undefined, dim: !n });
      }
      barChart(sCanvas, { values, height: 140 });
    });
  }
}

/* ---------------- bindings ---------------- */
function bind(root) {
  root.onclick = async e => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    e.preventDefault();

    switch (act.dataset.act) {
      case 'log-weight': {
        const m = modal({
          title: 'Log weight',
          body: `<div class="field"><label>Today (kg)</label>
              <input class="input num" id="pw" type="number" step="0.1" value="${esc(String(latestWeight()))}" /></div>
            <p class="small muted">Same time, same scale, minimal clothing — then ignore the daily noise.</p>`,
          footer: `<button class="btn btn-ghost" data-close>Cancel</button>
                   <button class="btn btn-primary" id="pw-ok">Save</button>`
        });
        m.root.querySelector('#pw-ok').onclick = () => {
          const v = Number(m.root.querySelector('#pw').value);
          if (!v || v < 30 || v > 300) return toast('Enter 30–300 kg', 'warn');
          logWeight(v);
          closeModal();
          toast(`Logged ${v} kg`, 'good');
        };
        break;
      }
      case 'export': {
        const blob = new Blob([exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `momentum-backup-${dateKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast('Backup downloaded', 'good');
        break;
      }
      case 'import': {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json';
        input.onchange = () => {
          const f = input.files[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = async () => {
            try {
              importJSON(r.result);
              toast('Backup restored', 'good');
            } catch { toast('That file is not a Momentum backup', 'warn'); }
          };
          r.readAsText(f);
        };
        input.click();
        break;
      }
      case 'reset': {
        const ok = await confirmDialog(
          'This deletes every weigh-in, session, meal, test and setting from this browser. Export a backup first if you might want it.',
          { ok: 'Delete everything', danger: true });
        if (!ok) return;
        localStorage.removeItem('momentum.v1');
        store.reset();
        location.hash = '#/today';
        toast('Everything reset', 'warn');
        break;
      }
    }
  };
}
