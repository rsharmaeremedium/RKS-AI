/* =========================================================================
   charts.js — dependency-free canvas charts
   ========================================================================= */

import { setupCanvas, cssVar, clamp, round, keyToDate, dateKey, addDays } from './utils.js';

/* ---------------- line / trend chart ---------------- */
/**
 * series: [{d, kg}] sorted asc
 * goal: target value (drawn as a dashed line)
 * projection: [{d, kg}] optional dotted forecast
 */
export function lineChart(canvas, { series, goal, projection = [], height = 200, label = 'kg' }) {
  const { ctx, w, h } = setupCanvas(canvas, height);
  if (!series.length) return;

  const padL = 34, padR = 12, padT = 14, padB = 22;
  const all = [...series, ...projection, ...(goal != null ? [{ kg: goal }] : [])];
  let min = Math.min(...all.map(p => p.kg));
  let max = Math.max(...all.map(p => p.kg));
  if (max - min < 4) { const c = (max + min) / 2; min = c - 3; max = c + 3; }
  min -= 1; max += 1;

  const t0 = keyToDate(series[0].d).getTime();
  const t1 = keyToDate((projection.length ? projection[projection.length - 1].d : series[series.length - 1].d)).getTime();
  const span = Math.max(1, t1 - t0);

  const X = d => padL + ((keyToDate(d).getTime() - t0) / span) * (w - padL - padR);
  const Y = v => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);

  const muted = cssVar('--muted-2');
  const line = cssVar('--accent');
  const grid = cssVar('--ring-track');
  const goalCol = cssVar('--warn');

  // horizontal gridlines
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.font = '11px system-ui';
  ctx.fillStyle = muted;
  for (let i = 0; i <= 3; i++) {
    const v = min + ((max - min) * i) / 3;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(`${round(v, 0)}${label}`, 4, y + 3.5);
  }

  // goal line
  if (goal != null) {
    ctx.strokeStyle = goalCol;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(padL, Y(goal)); ctx.lineTo(w - padR, Y(goal)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = goalCol;
    ctx.fillText(`goal ${goal}kg`, w - padR - 76, Y(goal) - 5);
  }

  // actual line
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  series.forEach((p, i) => { const x = X(p.d), y = Y(p.kg); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();

  // area fill
  const last = series[series.length - 1];
  ctx.lineTo(X(last.d), h - padB);
  ctx.lineTo(X(series[0].d), h - padB);
  ctx.closePath();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = line;
  ctx.fill();
  ctx.globalAlpha = 1;

  // dots
  ctx.fillStyle = line;
  series.forEach(p => { ctx.beginPath(); ctx.arc(X(p.d), Y(p.kg), 2.6, 0, Math.PI * 2); ctx.fill(); });

  // projection
  if (projection.length) {
    ctx.strokeStyle = cssVar('--accent-2');
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    projection.forEach((p, i) => { const x = X(p.d), y = Y(p.kg); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // x labels (first / last)
  ctx.fillStyle = muted;
  ctx.fillText(new Date(t0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), padL, h - 6);
  const lab = new Date(t1).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  ctx.fillText(lab, w - padR - ctx.measureText(lab).width, h - 6);
}

/* ---------------- bar chart ---------------- */
/** values: [{label, v, max?}] */
export function barChart(canvas, { values, height = 150, suffix = '', color = null }) {
  const { ctx, w, h } = setupCanvas(canvas, height);
  if (!values.length) return;
  const max = Math.max(...values.map(v => v.max ?? v.v), 1);
  const padB = 20, padT = 8;
  const bw = (w - 8) / values.length;
  const barW = Math.min(34, bw * 0.55);
  const fill = color || cssVar('--accent');
  const track = cssVar('--ring-track');
  const muted = cssVar('--muted-2');

  values.forEach((val, i) => {
    const x = 4 + i * bw + (bw - barW) / 2;
    const bh = ((h - padT - padB) * val.v) / max;
    const y = h - padB - bh;

    ctx.fillStyle = track;
    roundRect(ctx, x, padT, barW, h - padT - padB, 6);
    ctx.fill();

    ctx.fillStyle = val.dim ? track : (val.color || fill);
    roundRect(ctx, x, y, barW, Math.max(3, bh), 6);
    ctx.fill();

    if (val.v > 0) {
      ctx.fillStyle = muted;
      ctx.font = '10.5px system-ui';
      const t = `${val.v}${suffix}`;
      ctx.fillText(t, x + (barW - ctx.measureText(t).width) / 2, Math.max(10, y - 4));
    }
    ctx.fillStyle = muted;
    ctx.font = '11px system-ui';
    ctx.fillText(val.label, x + (barW - ctx.measureText(val.label).width) / 2, h - 6);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- sparkline ---------------- */
export function spark(canvas, values, { height = 46, color = null } = {}) {
  const { ctx, w, h } = setupCanvas(canvas, height);
  if (values.length < 2) return;
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const X = i => 2 + (i / (values.length - 1)) * (w - 4);
  const Y = v => 4 + (1 - (v - min) / span) * (h - 10);

  ctx.strokeStyle = color || cssVar('--accent');
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  values.forEach((v, i) => { i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); });
  ctx.stroke();
}

/* ---------------- projection helper ---------------- */
/** Extrapolate the trend to the goal weight using the observed rate. */
export function projectWeight(trend, perWeek, targetKg, maxDays = 420) {
  if (!trend.length) return [];
  const last = trend[trend.length - 1];
  if (perWeek <= 0.02 || last.kg <= targetKg) return [];
  const daysToGoal = Math.ceil(((last.kg - targetKg) / perWeek) * 7);
  if (daysToGoal > maxDays) return [];
  const out = [{ d: last.d, kg: last.kg }];
  const steps = Math.min(24, Math.max(4, Math.ceil(daysToGoal / 14)));
  for (let i = 1; i <= steps; i++) {
    const dayOffset = Math.round((daysToGoal * i) / steps);
    const d = new Date(keyToDate(last.d).getTime() + dayOffset * 86400000);
    out.push({ d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, kg: round(last.kg - (perWeek * dayOffset) / 7, 1) });
  }
  return out;
}
