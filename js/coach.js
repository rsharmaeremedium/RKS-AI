/* =========================================================================
   coach.js — the assistant.
   Rule-based, fully offline, and it answers from YOUR data: real calorie
   gaps, real streaks, real work hours, real progression state.
   ========================================================================= */

import { dateKey, esc, round, fmtDate, nowMin, toMin, toHHMM, clamp, addDays, dow } from './utils.js';
import {
  store, targets, dayNutrition, todayScores, streak, weightStats, weekStats,
  isTrainDay, patchDaily, logWeight, addWater, getDaily, sessionsOn, waterML, latestWeight
} from './store.js';
import {
  todayPlan, estSessionMinutes, movementAge, ROUTINES, currentPhase, getTier, progressOf, resolveSession
} from './plan.js';
import { suggestRecipes, recipeById } from './recipes.js';

const clean = s => String(s || '').toLowerCase().replace(/[^\w\s./:%-]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (t, ...words) => words.some(w => t.includes(w));

/* =========================================================================
   DAILY BRIEFING (shown on Today)
   ========================================================================= */

export function briefing() {
  const now = new Date();
  const h = now.getHours();
  const plan = todayPlan();
  const tg = targets();
  const nutr = dayNutrition();
  const scores = todayScores();
  const st = streak();
  const kcalLeft = Math.max(0, tg.kcal - nutr.kcal);
  const proteinLeft = Math.max(0, tg.protein - nutr.protein);
  const ws = weightStats();
  const p = store.state.profile;

  const hours = [];
  const greeting = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Winding down';

  // opening line
  let head = `${greeting}${p.name ? `, ${p.name.split(' ')[0]}` : ''}.`;
  if (st >= 3) head += ` ${st}-day streak alive — protect it.`;
  else if (st === 0) head += ' Fresh week energy: win the first rep of the day.';

  // training
  if (!plan.rest && !plan.trained) {
    const mins = estSessionMinutes(plan.resolved);
    hours.push(`**Body** — ${plan.session.title} day (${plan.session.focus}). About ${mins} min. Do it before the workday hardens up, or right after shutdown.`);
  } else if (plan.trained) {
    hours.push(`**Body** — session logged. Recovery is where the muscle shows up: protein + sleep tonight.`);
  } else {
    hours.push(`**Body** — recovery day. ${plan.routine.name} (${plan.routine.mins} min) plus your step goal. Easy wins.`);
  }

  // fuel
  if (nutr.count === 0) hours.push(`**Fuel** — nothing logged yet. Target today: **${tg.kcal} kcal** and **${tg.protein}g protein**. Front-load protein at breakfast.`);
  else if (proteinLeft > 40) hours.push(`**Fuel** — ${kcalLeft} kcal and **${proteinLeft}g protein** left. That's a chicken-and-veg sized gap, not a snack-sized one.`);
  else if (proteinLeft > 0) hours.push(`**Fuel** — close. ${kcalLeft} kcal, ${proteinLeft}g protein remaining — one high-protein option finishes it.`);
  else if (nutr.kcal > tg.kcal * 1.05) hours.push(`**Fuel** — over by ${nutr.kcal - tg.kcal} kcal. Not a disaster: walk 2,500 steps and reset tomorrow. No compensating.`);
  else hours.push(`**Fuel** — protein target hit (${nutr.protein}/${tg.protein}g). Calories at ${nutr.kcal}/${tg.kcal}.`);

  // flow
  const daily = getDaily(dateKey(), false) || {};
  const isWork = isTrainDay(dateKey()) ? store.state.profile.workDays.includes(dow(dateKey())) : false;
  const workMin = daily.workMin || Math.max(0, nowMin() - toMin(p.workStart));
  const targetWork = (toMin(p.workEnd) - toMin(p.workStart)) * (isWork ? 1 : 0);
  if (daily.shutdown) hours.push(`**Flow** — shutdown done ✅. Tonight belongs to ${plan.routine.name.toLowerCase()} and sleep.`);
  else if (h >= 18 && isWork && workMin > targetWork) hours.push(`**Flow** — ${round((workMin - targetWork) / 60, 1)}h past your window. Run the shutdown ritual now; the work will still be there tomorrow.`);
  else if (h < 12 && isWork) hours.push(`**Flow** — hard stop at **${p.workEnd}**. Put the workout in the calendar now, before meetings eat it.`);
  else if (!isWork) hours.push(`**Flow** — non-training day. Protect 30 minutes of something that isn't a screen.`);

  // movement
  const mage = movementAge();
  if (!mage) hours.push(`**Move** — no baseline test yet. 5 minutes, once, and your Movement Age unlocks.`);
  else if (mage > 30) hours.push(`**Move** — movement age **${mage}**. Trending toward 25 needs the daily ${plan.routine.name.toLowerCase()}, not hero sessions.`);

  return { head, lines: hours, scores, plan, tg, nutr, kcalLeft, proteinLeft, streak: st, ws };
}

/* =========================================================================
   QUICK REPLIES
   ========================================================================= */

export const CHIPS = [
  "What's my plan today?",
  'How many calories left?',
  'What should I eat tonight?',
  "I skipped my workout",
  'Log my weight',
  "I'm exhausted",
  "How's my work-life balance?",
  '5-min reset',
  'Am I making progress?'
];

/* =========================================================================
   INTENT ENGINE
   ========================================================================= */

export function respond(raw) {
  const text = clean(raw);
  const plan = todayPlan();
  const tg = targets();
  const nutr = dayNutrition();
  const scores = todayScores();
  const ws = weightStats();
  const wk = weekStats();
  const st = streak();
  const p = store.state.profile;
  const kcalLeft = Math.max(0, tg.kcal - nutr.kcal);
  const proLeft = Math.max(0, tg.protein - nutr.protein);

  /* ---- weight logging: "98.4", "98.4 kg", "weight 98.4" ---- */
  const wMatch = text.match(/(\d{2,3}(?:[.,]\d)?)\s*(kg|kilo|weight)?/) ;
  if (has(text, 'log', 'weight', 'weigh') && wMatch && Number(wMatch[1]) >= 30 && Number(wMatch[1]) <= 300) {
    const kg = Number(wMatch[1].replace(',', '.'));
    logWeight(kg);
    const s2 = weightStats();
    const dir = kg <= ws.now ? 'down' : 'up';
    return reply(
      `Logged **${kg} kg**.\n\nTrend: **${s2.lost > 0 ? s2.lost + ' kg down' : 'holding'}** from ${s2.start} kg · ${s2.perWeek > 0 ? s2.perWeek + ' kg/week' : 'rate still building'}${s2.toGo > 0 ? ` · ${s2.toGo} kg to ${p.targetKg} kg` : ' · goal reached'}.\n` +
      `${dir === 'up' ? 'Daily swings are water, sodium and food volume — judge only the 7-day trend.' : 'Good. Keep protein high and steps honest, and the trend keeps doing the work.'}`,
      { kind: 'good' }
    );
  }

  /* ---- water ---- */
  const waterMatch = text.match(/(\d{1,2}(?:[.,]\d)?)\s*(l|litre|liter|ltr)\b/) || text.match(/(\d{3,4})\s*ml\b/);
  if (has(text, 'water') && waterMatch) {
    const v = Number(waterMatch[1]);
    const ml = v < 10 ? Math.round(v * 1000) : Math.round(v);
    addWater(ml);
    return reply(`Added **${ml >= 1000 ? round(ml / 1000, 1) + 'L' : ml + 'ml'}**. Today: ${round(waterML() / 1000, 1)}L of ${round(p.waterGoal / 1000, 1)}L.`, { kind: 'good' });
  }

  /* ---- greeting ---- */
  if (/^(hi|hey|hello|yo|namaste|good (morning|evening))\b/.test(text)) {
    const b = briefing();
    return reply(`${b.head}\n\n${b.lines.map(l => `• ${l.replace(/\*\*/g, '')}`).join('\n')}\n\nAsk me anything — "what should I eat", "start my workout", "log 98.5 kg".`);
  }

  /* ---- today's plan ---- */
  if (has(text, 'plan today', 'today', "what should i do", 'schedule', 'workout today', 'training')) {
    const mins = estSessionMinutes(plan.resolved);
    const moves = plan.resolved.filter(r => r.type === 'main').slice(0, 5)
      .map(r => `${r.tier ? r.tier.name : r.chain || 'Block'}${r.unit === 's' ? ` — ${r.reps[0]}–${r.reps[1]}s` : ` — ${r.sets}×${r.reps[0]}–${r.reps[1]}`}`);
    return reply(
      `**${plan.rest ? 'Recovery day' : plan.session.title + ' day'}** — ${plan.session.focus}\n` +
      (moves.length ? `\n${moves.map(m => `• ${m}`).join('\n')}` : '') +
      `\n\n${plan.rest ? `Walk to ${p.stepGoal.toLocaleString()} steps + ${plan.routine.name}.` : `~${mins} min total, warm-up included.`}` +
      (plan.trained ? `\nAlready logged today ✅` : ''),
      { actions: [{ label: plan.trained ? 'View log' : 'Start session', hash: '#/body' }] }
    );
  }

  /* ---- calories / protein remaining ---- */
  if (has(text, 'calorie', 'calories left', 'kcal', 'how much can i eat', 'budget', 'macros', 'protein left')) {
    return reply(
      `**${kcalLeft} kcal** left today (target ${tg.kcal}, logged ${nutr.kcal}).\n` +
      `**${proLeft}g protein** left of ${tg.protein}g.\n\n` +
      `TDEE estimate ${tg.tdee} kcal → deficit chosen for ~${round(Math.max(0, (ws.perWeek || 0.5)) || 0.5, 1)} kg/week. ` +
      `Never drop below ${(p.sex === 'f' ? 1400 : 1600).toLocaleString()} kcal — muscle is the thing we're here to keep.`,
      { actions: [{ label: 'Log food', hash: '#/fuel' }, ...suggestAction(proLeft)] }
    );
  }

  /* ---- what should I eat ---- */
  if (has(text, 'what should i eat', 'dinner idea', 'recipe', 'hungry', 'eat tonight', 'meal idea', 'breakfast idea', 'lunch idea')) {
    const { suggestions, leftKcal, leftProtein } = suggestRecipes(3);
    const list = suggestions.map(({ r }) =>
      `• **${r.name}** — ${r.kcal} kcal, ${r.protein}g protein, ${r.time} min${r.veg ? ' · veg' : ''}`
    ).join('\n');
    return reply(
      `Budget left: **${leftKcal} kcal / ${leftProtein}g protein**.\n\n${list}\n\nAdd any straight to today's log from the Fuel tab.`,
      { actions: [{ label: 'Open recipes', hash: '#/fuel' }] }
    );
  }

  /* ---- party / junk eaten ---- */
  if (has(text, 'ate pizza', 'ate biryani', 'junk', 'party', 'drank beer', 'alcohol', 'cheat meal', 'ate out', 'swiggy', 'zomato')) {
    return reply(
      `Logged mentally? Good — that's the skill. One meal doesn't move the trend; two weeks of guilt does.\n\n` +
      `Do this: keep the rest of today protein-strict (${proLeft}g left), walk 2,000 extra steps, and make the next meal a clean one. ` +
      `No skipping tomorrow's session to "make up for it" — training is how you spend calories, not punish them.`,
      { actions: [{ label: 'Log it', hash: '#/fuel' }] }
    );
  }

  /* ---- missed workout ---- */
  if (has(text, 'skip', 'missed', 'didn\'t train', 'did not train', 'no workout', 'skipped')) {
    const recent = sessionsOn(dateKey()).length + sessionsOn(addDays(dateKey(), -1)).length + sessionsOn(addDays(dateKey(), -2)).length;
    return reply(
      `${recent === 0 ? 'One miss is data, not a verdict.' : 'Noticed. You\'ve been light this week.'}\n\n` +
      `The rule at 100 kg: **never miss twice**. Options, pick one:\n` +
      `• 20-minute stripped version — 2 sets per movement, ${round(estSessionMinutes(plan.resolved) * 0.5)} min\n` +
      `• Push it to tomorrow and take today as recovery + 8k steps\n` +
      `• 10-minute mobility now so the habit has a rep today\n\n` +
      `Momentum beats intensity every single week.`,
      { actions: [{ label: 'Do the short version', hash: '#/body' }, { label: 'Mobility instead', hash: '#/move' }] }
    );
  }

  /* ---- exhausted / tired / stress ---- */
  if (has(text, 'exhaust', 'tired', 'no energy', 'stressed', 'stress', 'burnt out', 'burned out', 'sleepy')) {
    const sleep = getDaily(dateKey(), false)?.sleepH || 0;
    const hard = sessionsOn(dateKey()).length > 0;
    return reply(
      `Check the cause before pushing:\n` +
      `• Sleep last night: **${sleep ? sleep + 'h' : 'not logged'}** — under 7h and intensity isn't happening today.\n` +
      `• Energy check-in: ${getDaily(dateKey(), false)?.energy ? getDaily().energy + '/5' : 'not set'}.\n\n` +
      `If you're drained, downgrade rather than quit: **${hard ? 'walk 20 min + evening mobility' : 'the 5-min Desk Reset and a 10-min walk'}**, protein on target, in bed within your ${p.sleep} window. ` +
      `Recovery days are part of the program, not a break from it.`,
      { actions: [{ label: 'Desk reset', hash: '#/move' }] }
    );
  }

  /* ---- exhausted flow / work-life ---- */
  if (has(text, 'work-life', 'balance', 'overworked', 'too much work', 'late night', 'working late', 'boundary')) {
    const over = round((wk.overRatio - 1) * 100);
    return reply(
      `This week: **${Math.round(sum(wk.workMin) / 60)}h worked** vs a ${Math.round(wk.targetWork / 60)}h window (${over > 0 ? over + '% over' : 'inside the window'}). ` +
      `Shutdown ritual run ${wk.shutdowns}/work days. Balance score: **${wk.balance}/100**.\n\n` +
      `The three levers that actually work at your job:\n` +
      `• **Hard stop alarm** at ${p.workEnd} — train right after, no negotiation.\n` +
      `• One 50-min deep block before email opens.\n` +
      `• A non-negotiable personal block on the calendar — treat it like a client meeting.\n\n` +
      `Missed training because of work is the single biggest leak in your transformation.`,
      { actions: [{ label: 'Open Flow', hash: '#/flow' }] }
    );
  }

  /* ---- sleep ---- */
  if (has(text, 'sleep', 'insomnia', 'cant sleep', 'bedtime', 'wake up')) {
    const d = getDaily(dateKey(), false);
    return reply(
      `Last night: **${d?.sleepH ? d.sleepH + 'h' : 'not logged'}**. Target 7.5–8h — that's where growth hormone and appetite hormones behave.\n\n` +
      `Sleep window: ${p.wake} → ${p.sleep}. Evening routine that works: ${ROUTINES.evening.name} at 21:30, screens down at ${toHHMM(toMin(p.sleep) - 45)}, room cool and dark. ` +
      `Under 6h of sleep makes the deficit 2–3× harder to hold — this is training too.`,
      { actions: [{ label: 'Evening routine', hash: '#/move' }] }
    );
  }

  /* ---- mobility / stiff / pain ---- */
  if (has(text, 'stiff', 'tight', 'mobility', 'back pain', 'shoulder pain', 'knee pain', 'flexible', 'stretch', 'joint')) {
    const isPain = has(text, 'pain', 'injury', 'hurt');
    return reply(
      `${isPain ? "**Pain is not a training input.** Sharp, shooting or joint-line pain needs a physio, not an app — pull back to pain-free range until you've been checked.\n\n" : ''}` +
      `Stiffness responds to frequency, not force. ${ROUTINES.desk.name} every 90 minutes beats one heroic stretch a week.\n\n` +
      `Movement Age target: 25. Test the 5 markers in Move, then run the daily routine and re-test in 4 weeks.`,
      { actions: [{ label: 'Run routine', hash: '#/move' }] }
    );
  }

  /* ---- progress ---- */
  if (has(text, 'progress', 'how am i doing', 'results', 'doing well', 'trend', 'weight loss')) {
    const mage = movementAge();
    return reply(
      `**Weight** — ${ws.start} → ${ws.now} kg (${ws.lost > 0 ? ws.lost + ' kg lost' : 'no change yet'}), ${ws.perWeek > 0 ? ws.perWeek + ' kg/week' : 'building trend'}. ` +
      `${ws.toGo > 0 ? `${ws.toGo} kg to your ${p.targetKg} kg goal${ws.weeksLeft ? ` ≈ ${ws.weeksLeft} weeks at this pace` : ''}.` : 'Goal reached — now hold it.'}\n` +
      `**Training** — ${store.state.sessions.length} sessions logged, progression level: ${Object.keys(store.state.progress.exercises).length || 0} chains active.\n` +
      `**Streak** — ${st} day${st === 1 ? '' : 's'}.\n` +
      `**Balance** — ${wk.balance}/100 this week.\n` +
      `${mage ? `**Movement age** — ${mage}.` : '**Movement age** — run the baseline test.'}\n\n` +
      `${ws.count < 3 ? 'Weigh daily, judge weekly. The first kg or two is water noise.' : 'Data is consistent — the plan is working. Change nothing that\'s working.'}`,
      { actions: [{ label: 'See charts', hash: '#/progress' }] }
    );
  }

  /* ---- motivation ---- */
  if (has(text, 'motivat', 'give up', 'quit', 'hopeless', 'not working', 'hate myself', 'body image')) {
    return reply(
      `You went from considering it to logging ${store.state.sessions.length} sessions. That's the whole game.\n\n` +
      `You don't need motivation at 100 kg — you need **the next small rep**: protein at breakfast, 8k steps, one session. ` +
      `Motivation follows evidence you can see, and you're collecting it.\n\n` +
      `Two rules: never miss twice, and never negotiate with a single meal.`,
      { actions: [{ label: 'Do today\'s session', hash: '#/body' }] }
    );
  }

  /* ---- movement age ---- */
  if (has(text, 'movement age', 'how old', '25', 'young again', 'agility')) {
    const mage = movementAge();
    return reply(
      mage
        ? `Your movement age is **${mage}**. Every point is a repeatable physical test: squat hold, ankle range, hinge, core, shoulder.\n\nThe path to 25 is boring and effective: daily ${ROUTINES.morning.name}, full-depth squat practice, thoracic rotation, and losing bodyweight — every kg above goal costs you range.`
        : `No baseline yet. Five tests, about 6 minutes, and you'll know exactly where you stand against 25. Retest every 4 weeks.`,
      { actions: [{ label: mage ? 'Open Move' : 'Run baseline test', hash: '#/move' }] }
    );
  }

  /* ---- start something ---- */
  if (has(text, 'start workout', 'start training', 'begin session', 'start my workout')) {
    return reply(plan.rest
      ? "Today's recovery — but if you want to move, the Athletic + Mobility flow is right there."
      : `${plan.session.title} is queued with your current progression levels. Warm-up first, rest timer will hold your pace.`,
      { actions: [{ label: 'Go', hash: '#/body' }] });
  }
  if (has(text, 'start mobility', 'start routine', '5-min reset', '5 min reset', 'desk reset')) {
    return reply(`${ROUTINES.desk.name} — 5 minutes, no equipment. Every hour you sit, this pays it back.`, { actions: [{ label: 'Start timer', hash: '#/move' }] });
  }

  /* ---- what can you do ---- */
  if (has(text, 'help', 'what can you do', 'commands', 'menu')) {
    return reply(
      `I read your actual data. Try:\n` +
      `• "What's my plan today?"\n• "How many calories left?"\n• "What should I eat tonight?"\n` +
      `• "Log 98.4 kg"\n• "I skipped my workout"\n• "How's my work-life balance?"\n` +
      `• "I'm exhausted"\n• "Am I making progress?"\n• "Give me a 5-min reset"`
    );
  }

  /* ---- fallback ---- */
  return reply(
    `I didn't match that one — I'm offline and rule-based, so I work best with the daily questions.\n\n` +
    `Try: **"what's my plan today"**, **"calories left"**, **"what should I eat"**, **"log 98.5 kg"**, **"how's my balance"**.`,
    { chips: CHIPS.slice(0, 4) }
  );
}

/* ---------------- helpers ---------------- */

function suggestAction(proLeft) {
  return proLeft > 25 ? [{ label: 'High-protein recipes', hash: '#/fuel' }] : [];
}

function reply(text, { actions = [], chips = [], kind = 'coach' } = {}) {
  return { text, actions, chips, kind };
}

function sum(a) { return a.reduce((x, y) => x + y, 0); }

/* =========================================================================
   CHAT PERSISTENCE
   ========================================================================= */

export function pushMessage(role, text, extra = {}) {
  store.set(s => {
    s.coach.push({ ts: Date.now(), role, text, actions: extra.actions || [], chips: extra.chips || [] });
    if (s.coach.length > 200) s.coach = s.coach.slice(-200);
  });
}
export function chatHistory() { return store.state.coach.slice(-60); }
export function clearChat() { store.set(s => { s.coach = []; }); }
