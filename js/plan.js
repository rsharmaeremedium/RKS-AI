/* =========================================================================
   plan.js — training program, progression, mobility routines, movement age
   Bodyweight only: wall, floor, chair, towel, backpack (household).
   ========================================================================= */

import { dateKey, dow, clamp, round, addDays, avg } from './utils.js';
import { store, getDaily, patchDaily, isTrainDay } from './store.js';

/* =========================================================================
   1. EXERCISE CHAINS — each chain is a ladder of increasingly hard versions
   ========================================================================= */

export const CHAINS = {
  pushHorizontal: {
    label: 'Horizontal push',
    kind: 'push',
    tiers: [
      { id: 'wall-pushup', name: 'Wall Push-up', sets: 3, reps: [10, 15], rest: 60, kit: 'wall',
        cues: ['Hands at chest height, shoulder width', 'Body in one straight line', 'Lower for 2s, press for 1s'] },
      { id: 'incline-pushup', name: 'Incline Push-up', sets: 3, reps: [8, 14], rest: 70, kit: 'chair/table',
        cues: ['Hands on chair edge or counter', 'Ribs down, glutes tight', 'Chest touches the edge'] },
      { id: 'knee-pushup', name: 'Knee Push-up', sets: 3, reps: [8, 12], rest: 75, kit: 'floor',
        cues: ['Hips forward so knees–shoulders line up', 'Elbows ~45° not flared', 'Full lockout at top'] },
      { id: 'pushup', name: 'Push-up', sets: 4, reps: [8, 15], rest: 90, kit: 'floor',
        cues: ['Hands under shoulders', 'Squeeze glutes, brace abs', 'Chest to fist height'] },
      { id: 'decline-pushup', name: 'Decline Push-up', sets: 4, reps: [8, 12], rest: 90, kit: 'chair',
        cues: ['Feet on chair, hands on floor', 'Do not let hips sag', 'Target upper chest'] },
      { id: 'archer-pushup', name: 'Archer Push-up', sets: 4, reps: [6, 10], rest: 105, kit: 'floor',
        cues: ['Wide hands, shift weight to one side', 'Straight arm side stays extended', 'Alternate each rep'] }
    ]
  },

  pushVertical: {
    label: 'Vertical push (shoulders)',
    kind: 'push',
    tiers: [
      { id: 'wall-pike', name: 'Wall Pike Press', sets: 3, reps: [8, 12], rest: 60, kit: 'wall',
        cues: ['Hips high, forming an inverted V', 'Press head toward wall', 'Keep elbows forward'] },
      { id: 'pike-pushup', name: 'Pike Push-up', sets: 3, reps: [6, 12], rest: 75, kit: 'floor',
        cues: ['Hands and feet close, hips above head', 'Lower crown of head to floor', 'Drive back up tall'] },
      { id: 'elevated-pike', name: 'Elevated Pike Push-up', sets: 4, reps: [6, 10], rest: 90, kit: 'chair',
        cues: ['Feet on chair, hips stacked over shoulders', 'Elbows track forward', 'Head between hands'] },
      { id: 'wall-hspu', name: 'Wall Handstand Push-up', sets: 4, reps: [3, 8], rest: 120, kit: 'wall',
        cues: ['Kick up with control, heels on wall', 'Full ROM, head to floor', 'Bail out safely if needed'] }
    ]
  },

  pull: {
    label: 'Pull (back & biceps)',
    kind: 'pull',
    tiers: [
      { id: 'superman', name: 'Superman Hold', sets: 3, reps: [10, 15], rest: 60, kit: 'floor',
        cues: ['Lift chest and thighs together', 'Squeeze mid-back, not lower-back pinching', 'Hold 2s at top'] },
      { id: 'reverse-snowangel', name: 'Reverse Snow Angel', sets: 3, reps: [10, 14], rest: 60, kit: 'floor',
        cues: ['Face down, arms sweep floor to hips', 'Keep forehead down, thumbs up', 'Move slow and controlled'] },
      { id: 'backpack-row', name: 'Backpack Row', sets: 4, reps: [10, 15], rest: 75, kit: 'backpack (books)',
        cues: ['Hinge at hips, flat back', 'Pull elbows past ribs', 'Squeeze shoulder blades 1s'] },
      { id: 'towel-row', name: 'Towel Door Row', sets: 4, reps: [8, 12], rest: 90, kit: 'towel + door',
        cues: ['Loop towel around a solid door handle', 'Lean back, body straight', 'Pull chest to handle'] },
      { id: 'pullup', name: 'Pull-up / Negative', sets: 4, reps: [4, 10], rest: 120, kit: 'bar (optional)',
        cues: ['Dead hang start, no swinging', 'Drive elbows to ribs', 'No bar? do 5s negatives off a table'] }
    ]
  },

  squat: {
    label: 'Squat pattern',
    kind: 'legs',
    tiers: [
      { id: 'box-squat', name: 'Sit-to-Stand (box)', sets: 3, reps: [10, 15], rest: 60, kit: 'chair',
        cues: ['Sit back to chair, light touch', 'Knees track over toes', 'Stand tall, squeeze glutes'] },
      { id: 'air-squat', name: 'Bodyweight Squat', sets: 3, reps: [12, 20], rest: 75, kit: 'none',
        cues: ['Feet shoulder width, toes out 15°', 'Break at hips and knees together', 'Depth below parallel if mobile'] },
      { id: 'pause-squat', name: 'Pause Squat', sets: 4, reps: [10, 15], rest: 90, kit: 'none',
        cues: ['2s pause at the bottom', 'No bounce — stay tight', 'Chest tall out of the hole'] },
      { id: 'bulgarian', name: 'Bulgarian Split Squat', sets: 4, reps: [8, 12], rest: 90, kit: 'chair',
        cues: ['Rear foot on chair, front shin vertical', 'Drop straight down', 'Front leg does the work'] },
      { id: 'shrimp-squat', name: 'Shrimp Squat', sets: 4, reps: [5, 10], rest: 105, kit: 'none',
        cues: ['Hold rear foot behind you', 'Knee kisses the floor', 'Keep chest over hips'] }
    ]
  },

  hinge: {
    label: 'Hinge / posterior chain',
    kind: 'legs',
    tiers: [
      { id: 'good-morning', name: 'Good Morning (bodyweight)', sets: 3, reps: [10, 15], rest: 60, kit: 'none',
        cues: ['Hands behind head, soft knees', 'Push hips back, flat spine', 'Feel hamstrings load'] },
      { id: 'slrdl', name: 'Single-leg RDL', sets: 3, reps: [8, 12], rest: 75, kit: 'none',
        cues: ['Kickstand foot for balance', 'Hips square, back flat', 'Reach long through the free leg'] },
      { id: 'backpack-rdl', name: 'Backpack RDL', sets: 4, reps: [10, 15], rest: 90, kit: 'backpack',
        cues: ['Load close to legs', 'Hips back, shins vertical', 'Stand by squeezing glutes'] },
      { id: 'nordic-negative', name: 'Nordic Curl Negative', sets: 3, reps: [4, 8], rest: 105, kit: 'towel/partner',
        cues: ['Anchor heels, body tall', 'Lower as slowly as possible (5s)', 'Push back up with hands'] }
    ]
  },

  lunge: {
    label: 'Lunge / single leg',
    kind: 'legs',
    tiers: [
      { id: 'split-stance', name: 'Static Split Stance', sets: 3, reps: [8, 12], rest: 60, kit: 'none',
        cues: ['Long stance, both knees bend', 'Torso upright', 'Push through front heel'] },
      { id: 'reverse-lunge', name: 'Reverse Lunge', sets: 3, reps: [10, 16], rest: 75, kit: 'none',
        cues: ['Step back, knee kisses floor', 'Front knee stays over ankle', 'Alternate legs'] },
      { id: 'walking-lunge', name: 'Walking Lunge', sets: 3, reps: [12, 20], rest: 90, kit: 'space',
        cues: ['Smooth, long steps', 'No wobble at the bottom', 'Control the descent'] },
      { id: 'jump-lunge', name: 'Jump Lunge (low impact option)', sets: 3, reps: [6, 12], rest: 90, kit: 'none',
        cues: ['Land soft, knees bent', 'Swap legs in the air', 'Knee hurting? go back to walking lunge'] }
    ]
  },

  coreBrace: {
    label: 'Core — anti-extension',
    kind: 'core',
    tiers: [
      { id: 'incline-plank', name: 'Incline Plank', sets: 3, reps: [25, 45], unit: 's', rest: 45, kit: 'counter',
        cues: ['Forearms on counter', 'Ribs down, glutes tight', 'Nothing sags or pikes'] },
      { id: 'plank', name: 'Plank', sets: 3, reps: [30, 60], unit: 's', rest: 60, kit: 'floor',
        cues: ['Elbows under shoulders', 'Tuck tailbone, squeeze glutes', 'Breathe shallow but steady'] },
      { id: 'long-lever-plank', name: 'Long-lever Plank', sets: 3, reps: [20, 45], unit: 's', rest: 60, kit: 'floor',
        cues: ['Elbows further forward than shoulders', 'Do not let hips rise', 'Feel the abs tremble'] },
      { id: 'hollow-hold', name: 'Hollow Body Hold', sets: 3, reps: [15, 40], unit: 's', rest: 75, kit: 'floor',
        cues: ['Low back glued to floor', 'Arms and legs long', 'Lower back lifts? raise legs'] }
    ]
  },

  coreRotate: {
    label: 'Core — rotation & anti-rotation',
    kind: 'core',
    tiers: [
      { id: 'dead-bug', name: 'Dead Bug', sets: 3, reps: [8, 14], rest: 45, kit: 'floor',
        cues: ['Low back pressed down', 'Opposite arm and leg reach', 'Slow — no rushing'] },
      { id: 'bird-dog', name: 'Bird Dog', sets: 3, reps: [8, 12], rest: 45, kit: 'floor',
        cues: ['Quadruped, spine neutral', 'Extend without rocking hips', 'Hold 2s'] },
      { id: 'side-plank', name: 'Side Plank', sets: 3, reps: [20, 45], unit: 's', rest: 45, kit: 'floor',
        cues: ['Elbow under shoulder', 'Hips high, body stacked', 'Both sides'] },
      { id: 'slow-climber', name: 'Slow Mountain Climber', sets: 3, reps: [10, 18], rest: 60, kit: 'floor',
        cues: ['Plank position, hips still', 'Knee to chest, 1s each', 'No bouncing'] }
    ]
  },

  conditioning: {
    label: 'Low-impact conditioning',
    kind: 'cardio',
    tiers: [
      { id: 'march', name: 'March in Place', sets: 3, reps: [45, 60], unit: 's', rest: 30, kit: 'none',
        cues: ['Knees to hip height', 'Arms swinging', 'Nasal breathing'] },
      { id: 'step-back', name: 'Step-back Tap', sets: 3, reps: [40, 60], unit: 's', rest: 30, kit: 'none',
        cues: ['Tap one foot back, alternate', 'Stay light on the feet', 'Squeeze glutes each rep'] },
      { id: 'squat-reach', name: 'Squat to Reach', sets: 3, reps: [45, 60], unit: 's', rest: 35, kit: 'none',
        cues: ['Squat, then reach overhead', 'Full body, steady rhythm', 'Talk-test pace'] },
      { id: 'shadow-box', name: 'Shadow Boxing', sets: 3, reps: [45, 60], unit: 's', rest: 30, kit: 'none',
        cues: ['Jab–cross, rotate the hips', 'Guard up', 'Exhale on every punch'] },
      { id: 'sprawl', name: 'Sprawl / Burpee-no-pushup', sets: 3, reps: [30, 50], unit: 's', rest: 45, kit: 'none',
        cues: ['Hands down, step or hop back', 'Stand tall and reach', 'Knees soft on landing'] }
    ]
  },

  arms: {
    label: 'Arms — accessories',
    kind: 'push',
    tiers: [
      { id: 'bench-dip', name: 'Chair Dip', sets: 3, reps: [8, 15], rest: 60, kit: 'chair',
        cues: ['Hips close to the chair', 'Elbows go back, not out', 'Shoulders shrugging? reduce range'] },
      { id: 'floor-dip', name: 'Floor Dip (feet elevated)', sets: 3, reps: [8, 12], rest: 75, kit: 'chair',
        cues: ['Heels on chair, hands on floor', 'Lock out hard at the top', 'Control the descent'] },
      { id: 'diamond-pushup', name: 'Diamond Push-up', sets: 3, reps: [6, 12], rest: 75, kit: 'floor',
        cues: ['Hands form a diamond under chest', 'Elbows graze ribs', 'Knees if needed — keep form'] },
      { id: 'tempo-pushup', name: 'Tempo Push-up (4-0-1)', sets: 4, reps: [6, 10], rest: 90, kit: 'floor',
        cues: ['4s lowering phase', 'No pause at bottom', 'Explosive press up'] }
    ]
  },

  neckPosture: {
    label: 'Posture & shoulder health',
    kind: 'prep',
    tiers: [
      { id: 'chin-tuck', name: 'Chin Tuck', sets: 2, reps: [10, 15], rest: 30, kit: 'none',
        cues: ['Make a double chin', 'Hold 3s, feel the back of the neck', 'Glide, do not tilt'] },
      { id: 'wall-slide', name: 'Wall Slide', sets: 3, reps: [8, 12], rest: 45, kit: 'wall',
        cues: ['Back of head, shoulders, tailbone on wall', 'Arms slide up keeping contact', 'Exhale at the top'] },
      { id: 'band-pullapart', name: 'Towel Pull-apart', sets: 3, reps: [10, 15], rest: 45, kit: 'towel',
        cues: ['Hold towel shoulder width', 'Pull apart, shoulder blades squeeze', 'Slow return'] }
    ]
  }
};

export function getTier(chainId, level = 0) {
  const chain = CHAINS[chainId];
  if (!chain) return null;
  return chain.tiers[clamp(level, 0, chain.tiers.length - 1)];
}
export function maxLevel(chainId) { return (CHAINS[chainId]?.tiers.length || 1) - 1; }

/** Read the saved progression state for a chain. */
export function progressOf(chainId) {
  return store.state.progress.exercises[chainId] || { level: 0, topReps: 0, good: 0 };
}
export function saveProgress(chainId, patch) {
  store.set(s => {
    s.progress.exercises[chainId] = Object.assign({ level: 0, topReps: 0, good: 0 }, s.progress.exercises[chainId], patch);
  });
}

/** Given logged sets, decide whether the lifter earned the next tier. */
export function evaluateProgression(chainId, sets, unit) {
  const p = progressOf(chainId);
  const tier = getTier(chainId, p.level);
  if (!tier) return null;
  const vals = sets.map(s => s.reps || 0);
  const best = Math.max(...vals);
  const targetTop = tier.reps[1];
  const achieved = unit === 's' ? best >= targetTop : best >= targetTop;
  const hard = sets.some(s => (s.rpe || 7) >= 9);

  if (achieved && !hard) {
    const good = p.good + 1;
    if (good >= 2 && p.level < maxLevel(chainId)) {
      saveProgress(chainId, { level: p.level + 1, topReps: 0, good: 0 });
      return { promoted: true, to: getTier(chainId, p.level + 1) };
    }
    saveProgress(chainId, { topReps: Math.max(p.topReps, best), good });
    return { promoted: false, good, need: 2 - good };
  }
  saveProgress(chainId, { topReps: Math.max(p.topReps, best), good: achieved ? p.good : 0 });
  return null;
}

/* =========================================================================
   2. PHASES + SESSION BLUEPRINTS
   ========================================================================= */

export const PHASES = [
  { n: 1, name: 'Foundation', weeks: 8, intent: 'Move well, build the habit, lose the first 4–6 kg. RPE 6–7.', setsMul: 1, repRange: [8, 14], restMul: 1 },
  { n: 2, name: 'Build', weeks: 8, intent: 'Muscle growth on harder variations. RPE 7–9, tighter rest.', setsMul: 1.25, repRange: [10, 15], restMul: 0.85 },
  { n: 3, name: 'Athletic', weeks: 8, intent: 'Speed, power, control — move like 25 again.', setsMul: 1.15, repRange: [6, 12], restMul: 0.8 }
];

export function currentPhase(p = store.state.profile) {
  const days = Math.max(0, Math.round((new Date(dateKey()) - new Date(p.phaseStart)) / 86400000));
  const week = Math.floor(days / 7) + 1;
  let acc = 0;
  for (const ph of PHASES) { acc += ph.weeks; if (week <= acc) return { ...ph, week, weekInPhase: week - (acc - ph.weeks) }; }
  const last = PHASES[PHASES.length - 1];
  return { ...last, week, weekInPhase: ((week - 1) % last.weeks) + 1, maintenance: true };
}

const warmup = [
  { name: 'March + arm circles', dur: 60, cue: 'Get the joints moving, easy breathing' },
  { name: 'Cat–cow', dur: 45, cue: 'Slow spine waves, exhale into the round' },
  { name: 'World’s greatest stretch', dur: 60, cue: 'Lunge, elbow to instep, rotate to ceiling' },
  { name: 'Glute bridge × 10', dur: 45, cue: 'Squeeze 2s at the top, ribs down' },
  { name: 'Scapular push-ups × 8', dur: 40, cue: 'Arms locked, shoulder blades only' }
];

/** Session blueprints. Slots reference chains so progression applies automatically. */
export const SESSIONS = {
  A: {
    key: 'A', title: 'Push', focus: 'Chest · Shoulders · Triceps',
    slots: [
      { type: 'main', chain: 'pushHorizontal' },
      { type: 'main', chain: 'pushVertical' },
      { type: 'main', chain: 'arms' },
      { type: 'main', chain: 'coreBrace' },
      { type: 'finisher', chain: 'conditioning', rounds: 3, work: 40, rest: 20 }
    ]
  },
  B: {
    key: 'B', title: 'Pull + Posture', focus: 'Back · Biceps · Posterior core',
    slots: [
      { type: 'main', chain: 'pull' },
      { type: 'main', chain: 'hinge' },
      { type: 'main', chain: 'neckPosture' },
      { type: 'main', chain: 'coreRotate' },
      { type: 'finisher', chain: 'conditioning', rounds: 3, work: 40, rest: 20 }
    ]
  },
  C: {
    key: 'C', title: 'Legs', focus: 'Quads · Glutes · Hamstrings · Calves',
    slots: [
      { type: 'main', chain: 'squat' },
      { type: 'main', chain: 'lunge' },
      { type: 'main', chain: 'hinge' },
      { type: 'main', chain: 'coreBrace' },
      { type: 'finisher', chain: 'conditioning', rounds: 3, work: 45, rest: 20 }
    ]
  },
  D: {
    key: 'D', title: 'Athletic + Mobility', focus: 'Full body · Balance · Speed · Range',
    slots: [
      { type: 'main', chain: 'conditioning' },
      { type: 'main', chain: 'pushHorizontal' },
      { type: 'main', chain: 'squat' },
      { type: 'main', chain: 'coreRotate' },
      { type: 'mobility', routine: 'athletic' }
    ]
  },
  R: {
    key: 'R', title: 'Recovery', focus: 'Mobility · Steps · Nervous-system downshift',
    slots: [
      { type: 'mobility', routine: 'evening' },
      { type: 'walk', targetSteps: true }
    ]
  }
};

/** Which session runs on a given date, honouring the profile's training days. */
export function sessionForDate(d = dateKey()) {
  const p = store.state.profile;
  if (!isTrainDay(d)) return { ...SESSIONS.R, rest: true };
  const ordered = [...p.trainDays].sort((a, b) => a - b);
  const idx = ordered.indexOf(dow(d));
  const plan = ['A', 'B', 'C', 'D'];
  const key = plan[idx % plan.length];
  return { ...SESSIONS[key], rest: false };
}

/** Resolve a blueprint into concrete exercises using current progression. */
export function resolveSession(session) {
  const phase = currentPhase();
  const out = [];
  for (const slot of session.slots) {
    if (slot.type === 'main' || slot.type === 'finisher') {
      const chain = CHAINS[slot.chain];
      if (!chain) continue;
      const level = progressOf(slot.chain).level;
      const tier = getTier(slot.chain, level);
      if (slot.type === 'finisher') {
        out.push({ ...slot, chainLabel: chain.label, tier });
      } else {
        const sets = Math.max(2, Math.round(tier.sets * phase.setsMul));
        const reps = [
          Math.max(6, Math.round(tier.reps[0] * (phase.n >= 2 ? 1.1 : 1))),
          Math.round(tier.reps[1] * (phase.n >= 3 ? 0.85 : 1))
        ];
        out.push({
          ...slot, chainLabel: chain.label, tier,
          sets, reps, unit: tier.unit || 'reps',
          rest: Math.round(tier.rest * phase.restMul),
          rpe: phase.n === 1 ? 7 : 8
        });
      }
    } else {
      out.push(slot);
    }
  }
  return out;
}

/* =========================================================================
   3. MOBILITY ROUTINES — "movement like a 25 year old"
   ========================================================================= */

export const ROUTINES = {
  morning: {
    id: 'morning', name: 'Morning Loosen-up', mins: 10, when: 'Before work',
    desc: 'Wake up the spine, hips and ankles so the day starts fluid, not stiff.',
    items: [
      { name: 'Neck CARs', dur: 45, cue: 'Slow circles, chin to chest then around — no grinding' },
      { name: 'Shoulder CARs', dur: 50, cue: 'Big slow circles, ears away from shoulders' },
      { name: 'Thoracic rotation', dur: 60, cue: 'Hands behind head, rotate one elbow to the ceiling' },
      { name: 'Cat–cow', dur: 50, cue: 'Segment the spine — move one vertebra at a time' },
      { name: 'Hip flexor rock', dur: 60, cue: 'Half-kneel, tuck tailbone, lean gently forward' },
      { name: 'Ankle rocks', dur: 50, cue: 'Knee over toes, heel glued down, 12 reps each' },
      { name: 'Deep squat hold', dur: 75, cue: 'Heels down, elbows inside knees, tall chest' },
      { name: 'Box breathing', dur: 90, cue: 'In 4 · hold 4 · out 4 · hold 4 — set the day' }
    ]
  },
  desk: {
    id: 'desk', name: 'Desk Reset', mins: 5, when: 'Every 60–90 min of work',
    desc: 'Undo sitting in five minutes — hips, upper back, neck, eyes.',
    items: [
      { name: 'Chin tucks × 10', dur: 45, cue: 'Slide the head back, 3s hold — fixes forward head' },
      { name: 'Standing thoracic opener', dur: 55, cue: 'Hands on hips, elbow circles to the ceiling' },
      { name: 'Hip flexor stretch', dur: 60, cue: 'Rear knee down or standing tailbone tuck' },
      { name: 'Doorway pec stretch', dur: 50, cue: 'Arm on frame, step through — open the chest' },
      { name: 'Calf raises × 15', dur: 45, cue: 'Slow up, slow down — pump blood back' },
      { name: '20-20-20 eye reset', dur: 40, cue: 'Look 20 ft away for 20s — protects focus too' }
    ]
  },
  evening: {
    id: 'evening', name: 'Evening Wind-down', mins: 10, when: 'After work, before bed',
    desc: 'Downshift the nervous system, unlock hips and hamstrings, sleep deeper.',
    items: [
      { name: '90/90 hip switch', dur: 75, cue: 'Sit tall, switch knees side to side — no hands if possible' },
      { name: 'Half-kneeling hamstring', dur: 70, cue: 'Hinge with a flat back, feel the back of the thigh' },
      { name: 'Pigeon / glute stretch', dur: 75, cue: 'Each side — breathe into the tightness' },
      { name: 'Child’s pose + reach', dur: 60, cue: 'Walk hands left and right to open the lats' },
      { name: 'Supine twist', dur: 70, cue: 'Knees drop to one side, shoulders stay down' },
      { name: 'Legs-up-the-wall', dur: 90, cue: 'Slow nasal breathing — this is the sleep signal' },
      { name: 'Diaphragm breathing', dur: 90, cue: 'Hand on belly, 4s in · 6s out' }
    ]
  },
  athletic: {
    id: 'athletic', name: 'Athletic Prep', mins: 8, when: 'Warm-up before training',
    desc: 'Dynamic range + activation so every rep builds athleticism, not wear.',
    items: [
      { name: 'March + high knees', dur: 50, cue: 'Easy first, then raise the knees' },
      { name: 'Leg swings (each side)', dur: 60, cue: 'Front-back then side-to-side, controlled' },
      { name: 'Lateral lunge', dur: 60, cue: 'Sit into one hip, other leg long' },
      { name: 'Inchworm', dur: 60, cue: 'Walk out to plank, push hips up, walk back' },
      { name: 'Spiderman lunge + rotate', dur: 70, cue: 'Foot by hand, rotate the top arm open' },
      { name: 'Squat to stand', dur: 60, cue: 'Grab toes, drop hips, then lift the chest' },
      { name: 'Jump-landing practice', dur: 60, cue: 'Quiet landings, knees over toes — 6 reps' }
    ]
  }
};

export function routineForToday(d = dateKey()) {
  if (isTrainDay(d)) return ROUTINES.athletic;
  const h = new Date().getHours();
  if (h < 12) return ROUTINES.morning;
  if (h < 18) return ROUTINES.desk;
  return ROUTINES.evening;
}

export function logMobility(routineId, minutes) {
  patchDaily(dateKey(), { mobilityDone: true, mobilityMin: (getDaily().mobilityMin || 0) + Math.round(minutes) });
  store.set(s => {
    const existing = s.madeRecipes.find(r => r.d === dateKey() && r.id === `mob:${routineId}`);
    if (!existing) s.madeRecipes.push({ d: dateKey(), id: `mob:${routineId}`, servings: 1 });
  });
}

/* =========================================================================
   4. MOVEMENT AGE — the "25 again" scoreboard
   ========================================================================= */

export const TESTS = [
  { id: 'squat', name: 'Deep Squat Hold', unit: 'sec', hint: 'Sit in your deepest squat, heels down, chest tall. Time how long you hold comfortably.',
    thresholds: [10, 25, 45, 70], scale: 'Hold time (seconds)' },
  { id: 'ankle', name: 'Ankle Knee-to-Wall', unit: 'cm', hint: 'Foot 10cm from wall, toes down. Without the heel lifting, how far can the knee travel?',
    thresholds: [6, 9, 11, 13], scale: 'Distance (cm)' },
  { id: 'toe', name: 'Toe Touch / Hinge', unit: 'cm', hint: 'Feet straight, knees soft. Where do your fingertips reach relative to the floor? (− = short of floor, + = flat palm)',
    thresholds: [-8, -3, 0, 3], scale: 'Reach vs floor (cm)' },
  { id: 'plank', name: 'Core Hold', unit: 'sec', hint: 'Perfect plank — ribs down, glutes tight. Time to first form break.',
    thresholds: [20, 45, 75, 110], scale: 'Hold time (seconds)' },
  { id: 'shoulder', name: 'Shoulder Overhead + Reach', unit: 'cm', hint: 'Back to wall, slide arms up. Distance between fingertips at full reach.',
    thresholds: [14, 9, 5, 2], scale: 'Gap between hands (cm)', invert: true }
];

/** Convert a raw test value into a 0–5 score. */
export function scoreTest(test, raw) {
  if (raw === '' || raw === null || isNaN(raw)) return 0;
  const v = Number(raw);
  const t = test.thresholds;
  if (test.invert) {
    if (v <= t[3]) return 5;
    if (v <= t[2]) return 4;
    if (v <= t[1]) return 3;
    if (v <= t[0]) return 2;
    return v <= t[0] + 10 ? 1 : 0;
  }
  if (v >= t[3]) return 5;
  if (v >= t[2]) return 4;
  if (v >= t[1]) return 3;
  if (v >= t[0]) return 2;
  return 1;
}

export function latestTest() {
  const t = [...store.state.tests].sort((a, b) => a.d.localeCompare(b.d));
  return t[t.length - 1] || null;
}

/** avg score 5 → 25 years, 0 → 50 years. */
export function movementAge(test = latestTest()) {
  if (!test) return null;
  const scores = TESTS.map(t => scoreTest(t, test[t.id]));
  const a = avg(scores);
  return Math.round(clamp(50 - a * 5, 25, 50));
}

export function movementScores(test = latestTest()) {
  if (!test) return null;
  return TESTS.map(t => ({ test: t, raw: test[t.id], score: scoreTest(t, test[t.id]) }));
}

export function saveTest(values) {
  store.set(s => {
    s.tests = s.tests.filter(t => t.d !== dateKey());
    s.tests.push({ d: dateKey(), ...values });
    s.tests.sort((a, b) => a.d.localeCompare(a.d));
  });
}

/* =========================================================================
   5. TODAY'S PLAN (used by Today, Coach, Body)
   ========================================================================= */

export function todayPlan(d = dateKey()) {
  const session = sessionForDate(d);
  const resolved = resolveSession(session);
  const routine = routineForToday(d);
  const daily = getDaily(d, false) || {};
  const done = store.state.sessions.some(x => x.d === d);

  return {
    date: d,
    session, resolved, routine,
    trained: done,
    mobilityDone: !!daily.mobilityDone,
    rest: !!session.rest
  };
}

export function estSessionMinutes(resolved) {
  const mains = resolved.filter(r => r.type === 'main');
  const sets = mains.reduce((a, r) => a + (r.sets || 0), 0);
  const perSet = 45;                         // work + rest
  const warm = 5, mobility = resolved.some(r => r.type === 'mobility') ? 8 : 0;
  return Math.round((sets * perSet) / 60 + warm + mobility);
}
