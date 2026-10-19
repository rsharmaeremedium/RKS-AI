/* =========================================================================
   recipes.js — Indian homemade recipes built for fat loss + strength.
   Nutrition is per serving (typical home measurements, minimal oil).
   ========================================================================= */

import { dateKey, round } from './utils.js';
import { store, targets, dayNutrition } from './store.js';

export const RECIPES = [
  /* ---------------- Breakfast ---------------- */
  {
    id: 'egg-bhurji', name: 'Egg Bhurji with Phulka', veg: false, time: 15, servings: 1,
    tags: ['breakfast', 'high-protein', 'muscle', 'quick'], kcal: 320, protein: 24, carbs: 32, fat: 11,
    ing: ['3 whole eggs (or 2 eggs + 3 whites)', '1 small onion, finely chopped', '1 tomato', 'Green chilli, turmeric, salt', '1 tsp mustard oil or ghee', '1 phulka / 1 roti'],
    steps: ['Whisk eggs with turmeric and salt.', 'Sauté onion and chilli 2 min, add tomato, cook till soft.', 'Pour eggs, scramble on low heat — stop while still glossy.', 'Serve with 1 hot phulka.'],
    tip: 'Add 1 handful of grated paneer or spinach for extra volume at almost no calories.'
  },
  {
    id: 'moong-chilla', name: 'Moong Dal Chilla with Mint Chutney', veg: true, time: 25, servings: 2,
    tags: ['breakfast', 'high-protein', 'fat-loss', 'vegetarian'], kcal: 240, protein: 14, carbs: 34, fat: 5,
    ing: ['1 cup yellow moong dal (soaked 2 hrs)', '1 onion + 1 green chilli', 'Ginger, cumin, salt', '1 tbsp oil for the pan', 'Mint-coriander chutney to serve'],
    steps: ['Blend dal with ginger and chilli into a thick batter.', 'Stir in onion, cumin and salt.', 'Spread thin on a hot tawa, 1 tsp oil, cook both sides.', 'Serve 2 chillas with chutney.'],
    tip: 'Highest-protein vegetarian breakfast in Indian kitchens — beats poha and upma by 2×.'
  },
  {
    id: 'besan-chilla', name: 'Besan Veg Chilla', veg: true, time: 20, servings: 2,
    tags: ['breakfast', 'fat-loss', 'vegetarian', 'quick'], kcal: 210, protein: 10, carbs: 30, fat: 6,
    ing: ['1 cup besan', 'Onion, tomato, capsicum (finely chopped)', 'Ajwain, turmeric, chilli, salt', '1 tsp oil per chilla'],
    steps: ['Mix besan with water into a pouring batter.', 'Fold in the vegetables and spices.', 'Cook on medium heat, 1 tsp oil per chilla, 2 min a side.', 'Serve with curd or chutney.'],
    tip: 'Ajwain helps digestion when you are eating more protein than usual.'
  },
  {
    id: 'oats-banana', name: 'Oats–Banana Protein Porridge', veg: true, time: 10, servings: 1,
    tags: ['breakfast', 'muscle', 'quick', 'vegetarian'], kcal: 380, protein: 22, carbs: 58, fat: 8,
    ing: ['40g rolled oats', '250ml milk (toned)', '1 banana, sliced', '1 tbsp peanut butter', 'Cinnamon + 1 tsp jaggery (optional)'],
    steps: ['Simmer oats in milk 5 min.', 'Top with banana, peanut butter, cinnamon.', 'Eat warm — peanut butter stirred in last keeps it creamy.'],
    tip: 'Stir in a scoop of whey after cooking (not while boiling) to keep it smooth.'
  },
  {
    id: 'poha-peanut', name: 'Poha with Peanuts & Sprouts', veg: true, time: 18, servings: 2,
    tags: ['breakfast', 'fat-loss', 'vegetarian'], kcal: 260, protein: 9, carbs: 46, fat: 6,
    ing: ['1.5 cups thick poha (rinsed)', '1/2 cup sprouts', '2 tbsp roasted peanuts', 'Onion, curry leaves, mustard seeds, turmeric', '1 tsp oil', 'Lemon + coriander'],
    steps: ['Temper mustard seeds, curry leaves, onion.', 'Add sprouts, cook 3 min.', 'Add rinsed poha + turmeric, steam covered 4 min.', 'Finish with peanuts, lemon and coriander.'],
    tip: 'Sprouts turn everyday poha into a protein dish — 9g instead of the usual 5g.'
  },
  {
    id: 'idli-sambar', name: 'Idli Sambar (3 idlis)', veg: true, time: 20, servings: 2,
    tags: ['breakfast', 'fat-loss', 'vegetarian', 'south-indian'], kcal: 300, protein: 11, carbs: 58, fat: 4,
    ing: ['3 steamed idlis', '1 cup sambar with vegetables', 'Coconut chutney: 2 tbsp grated coconut + curd', 'Curry leaves, mustard seeds'],
    steps: ['Steam idlis fresh if possible — reheated idlis harden.', 'Sambar: simmer toor dal + mixed veg + sambar masala.', 'Temper in 1 tsp ghee, pour over.', 'Chutney: blend coconut with curd instead of coconut flesh for fewer calories.'],
    tip: 'Steaming beats frying by ~150 kcal — keep the vada off the plate.'
  },
  {
    id: 'ragi-porridge', name: 'Ragi Porridge with Nuts', veg: true, time: 12, servings: 1,
    tags: ['breakfast', 'vegetarian', 'bones', 'quick'], kcal: 320, protein: 12, carbs: 54, fat: 8,
    ing: ['4 tbsp ragi flour', '300ml water or milk', '1 tsp jaggery or dates', '1 tbsp chopped almonds + walnuts', 'Cardamom'],
    steps: ['Whisk ragi into cold liquid, then heat on low.', 'Stir 6 min till it thickens and turns glossy.', 'Add jaggery and cardamom.', 'Top with nuts.'],
    tip: 'Calcium-rich — useful while you are cutting bodyweight fast.'
  },

  /* ---------------- Main course ---------------- */
  {
    id: 'dal-tadka-brown-rice', name: 'Dal Tadka with Brown Rice', veg: true, time: 35, servings: 2,
    tags: ['lunch', 'dinner', 'vegetarian', 'muscle'], kcal: 430, protein: 18, carbs: 72, fat: 7,
    ing: ['1 cup toor dal / masoor dal', '1 cup cooked brown rice', 'Tomato, garlic, cumin, hing', '1 tsp ghee for tadka', 'Turmeric, red chilli, coriander'],
    steps: ['Pressure-cook dal with turmeric (3 whistles).', 'Blend partially for a creamy texture.', 'Temper garlic + cumin in 1 tsp ghee, add tomato, pour over dal.', 'Serve with measured brown rice.'],
    tip: 'Measure rice dry — 60g per person is the portion that keeps the deficit honest.'
  },
  {
    id: 'rajma', name: 'Rajma Masala with Jeera Rice', veg: true, time: 45, servings: 3,
    tags: ['lunch', 'dinner', 'vegetarian', 'high-protein', 'meal-prep'], kcal: 420, protein: 17, carbs: 70, fat: 8,
    ing: ['1.5 cups soaked rajma', 'Onion-tomato-ginger-garlic masala', 'Garam masala, kasuri methi', '2 tsp oil total', '1 cup cooked rice per serving'],
    steps: ['Pressure-cook rajma till completely soft.', 'Brown the onion, add ginger-garlic, then tomato and spices.', 'Add rajma with its water, simmer 15 min.', 'Crush kasuri methi on top just before serving.'],
    tip: 'Batch-cook 4 days of rajma — proteins from beans stay cheap and filling.'
  },
  {
    id: 'chole', name: 'Chickpea Chole (Chana Masala)', veg: true, time: 45, servings: 3,
    tags: ['lunch', 'dinner', 'vegetarian', 'high-protein', 'meal-prep'], kcal: 400, protein: 16, carbs: 62, fat: 9,
    ing: ['2 cups soaked chickpeas', 'Tea bag (for colour), anardana', 'Onion-tomato masala, chana masala powder', '2 tsp oil', 'Ginger juliennes for garnish'],
    steps: ['Pressure-cook chickpeas with tea bag + salt.', 'Cook onion-tomato masala with chana masala 8 min.', 'Combine, simmer 15 min till thick.', 'Finish with ginger and coriander.'],
    tip: 'Fibre keeps you full for hours — ideal on training days between meals.'
  },
  {
    id: 'palak-paneer', name: 'Palak Paneer (light oil)', veg: true, time: 30, servings: 2,
    tags: ['lunch', 'dinner', 'vegetarian', 'high-protein', 'muscle'], kcal: 340, protein: 20, carbs: 16, fat: 22,
    ing: ['150g paneer, cubed', '2 bunches spinach (blanched)', 'Onion, garlic, green chilli', '1.5 tsp oil', 'Garam masala, cream 1 tbsp (optional)'],
    steps: ['Blanch spinach 2 min, blend smooth with chilli.', 'Sauté onion + garlic in 1.5 tsp oil.', 'Add puree, simmer 8 min, season.', 'Add paneer cubes, warm through, finish with garam masala.'],
    tip: 'Paneer is calorie-dense — weigh it once so portions stay consistent.'
  },
  {
    id: 'paneer-tikka', name: 'Stovetop Paneer Tikka', veg: true, time: 25, servings: 2,
    tags: ['dinner', 'vegetarian', 'high-protein', 'muscle', 'quick'], kcal: 300, protein: 21, carbs: 14, fat: 18,
    ing: ['180g paneer, cubed', '3 tbsp thick curd', 'Ginger-garlic paste, red chilli, garam masala', '1 onion + capsicum petals', '1 tsp mustard oil'],
    steps: ['Marinate paneer in curd + spices 15 min.', 'Thread onto a skewer with onion and capsicum.', 'Roast on a hot tawa / air-fryer 200°C for 12 min, turning once.', 'Squeeze lemon, serve with onion rings.'],
    tip: 'Air-fryer version needs zero oil — drops it to ~260 kcal.'
  },
  {
    id: 'chicken-curry', name: 'Home-style Chicken Curry (less oil)', veg: false, time: 45, servings: 3,
    tags: ['dinner', 'high-protein', 'muscle', 'non-veg', 'meal-prep'], kcal: 350, protein: 34, carbs: 14, fat: 16,
    ing: ['500g chicken on bone (or boneless)', 'Onion-tomato-ginger-garlic paste', 'Bay leaf, cloves, garam masala', '1.5 tbsp oil total', 'Coriander'],
    steps: ['Brown onions slowly — this is where the flavour is.', 'Add ginger-garlic, then tomato and powdered spices, cook till oil separates.', 'Add chicken, sear 5 min.', 'Add 1 cup water, cover, simmer 20 min; finish with garam masala.'],
    tip: 'Skinless thigh stays juicy at 16g fat/100g — breast dries out in home curry.'
  },
  {
    id: 'chicken-keema', name: 'Chicken Keema with Peas', veg: false, time: 30, servings: 3,
    tags: ['lunch', 'dinner', 'high-protein', 'muscle', 'non-veg'], kcal: 320, protein: 30, carbs: 16, fat: 14,
    ing: ['500g chicken mince (keema)', '1/2 cup peas', 'Onion, tomato, ginger-garlic', '1 tbsp oil, garam masala, green chilli'],
    steps: ['Cook mince on high till it stops releasing water.', 'Set aside, sauté onion-tomato-ginger-garlic.', 'Return keema, add peas and 1/2 cup water, cook 12 min.', 'Finish with garam masala and coriander.'],
    tip: 'Eat with 2 phulkas or 100g rice — keema delivers protein without extra carbs.'
  },
  {
    id: 'fish-curry', name: 'Bangda Fish Curry', veg: false, time: 35, servings: 3,
    tags: ['dinner', 'high-protein', 'muscle', 'non-veg', 'omega-3'], kcal: 330, protein: 32, carbs: 14, fat: 17,
    ing: ['6 pieces bangda / mackerel', 'Coconut (3 tbsp) or kokum', 'Onion, garlic, red chilli, coriander seeds', '1 tbsp oil, turmeric, tamarind'],
    steps: ['Grind coconut + spices into a fine masala.', 'Sauté onion, add masala, cook 6 min.', 'Add water and kokum, bring to a boil.', 'Slide in fish, cook 6 min only — never boil hard after this.'],
    tip: 'Oily fish gives omega-3s that help recovery and joint comfort while cutting.'
  },
  {
    id: 'soya-curry', name: 'Soya Chunk Curry', veg: true, time: 30, servings: 3,
    tags: ['lunch', 'dinner', 'vegetarian', 'high-protein', 'budget', 'meal-prep'], kcal: 310, protein: 28, carbs: 24, fat: 10,
    ing: ['1 cup soya chunks', 'Onion-tomato masala', 'Curd 2 tbsp', '1 tbsp oil, garam masala, kasuri methi'],
    steps: ['Boil soya 5 min, squeeze water hard, rinse cold.', 'Sauté masala, add curd, cook till glossy.', 'Add soya + 1/2 cup water, simmer 10 min.', 'Finish with kasuri methi.'],
    tip: 'Squeezing the water out is everything — it makes soya taste like meat, not sponge.'
  },
  {
    id: 'egg-curry', name: 'Egg Curry (2 eggs per serving)', veg: false, time: 25, servings: 2,
    tags: ['dinner', 'high-protein', 'muscle', 'non-veg', 'quick'], kcal: 340, protein: 22, carbs: 22, fat: 18,
    ing: ['4 eggs, boiled and slit', 'Onion-tomato masala', '1 tbsp oil, ginger-garlic, garam masala', 'Curry leaves'],
    steps: ['Boil eggs 9 min, peel, score lightly.', 'Cook onion-tomato masala till thick.', 'Add 1 cup water, simmer, add eggs.', 'Simmer 5 min so the eggs drink the masala.'],
    tip: 'Two eggs plus one phulka = a 340 kcal strength-supporting dinner.'
  },
  {
    id: 'sprouts-usal', name: 'Sprouted Moong Usal', veg: true, time: 20, servings: 2,
    tags: ['lunch', 'dinner', 'vegetarian', 'high-protein', 'fat-loss', 'quick'], kcal: 250, protein: 16, carbs: 34, fat: 5,
    ing: ['2 cups sprouted moong', 'Onion, tomato, green chilli', 'Mustard seeds, curry leaves, turmeric', '1 tsp oil, lemon'],
    steps: ['Steam sprouts 5 min (keeps the crunch).', 'Temper mustard seeds and curry leaves in 1 tsp oil.', 'Add onion-tomato, then sprouts, toss 3 min.', 'Lemon and coriander to finish.'],
    tip: 'Sprouting nearly doubles the usable protein and B-vitamins of the dal.'
  },

  /* ---------------- Snacks ---------------- */
  {
    id: 'sprouts-chaat', name: 'Sprouts Chaat', veg: true, time: 8, servings: 1,
    tags: ['snack', 'fat-loss', 'high-protein', 'vegetarian', 'quick'], kcal: 180, protein: 12, carbs: 26, fat: 3,
    ing: ['1 cup mixed sprouts', 'Onion, tomato, cucumber', 'Chaat masala, lemon, coriander', '1 tsp sev (optional)'],
    steps: ['Rinse sprouts, optionally steam 3 min.', 'Chop everything, toss with lemon and chaat masala.', 'Top with 1 tsp sev and eat immediately.'],
    tip: 'The 4pm killer — replaces biscuits without touching your deficit.'
  },
  {
    id: 'roasted-chana', name: 'Roasted Chana + Buttermilk', veg: true, time: 5, servings: 1,
    tags: ['snack', 'fat-loss', 'vegetarian', 'quick', 'budget'], kcal: 170, protein: 10, carbs: 26, fat: 3,
    ing: ['40g roasted chana (bhuna chana)', '1 glass chaas / buttermilk', 'Black salt, roasted cumin'],
    steps: ['Measure chana into a small bowl.', 'Blend curd with water, cumin and black salt.', 'Eat together — fibre + protein + hydration.'],
    tip: 'Keep a jar at your desk; unplanned snacks then become planned ones.'
  },
  {
    id: 'curd-seeds', name: 'Curd Bowl with Seeds & Fruit', veg: true, time: 5, servings: 1,
    tags: ['snack', 'breakfast', 'fat-loss', 'vegetarian', 'quick'], kcal: 210, protein: 14, carbs: 24, fat: 7,
    ing: ['200g thick curd / hung curd', '1 tbsp mixed seeds (flax, pumpkin, sunflower)', '1/2 cup papaya or berries', 'Pinch of cardamom'],
    steps: ['Whisk curd till smooth.', 'Top with fruit and seeds.', 'Eat chilled.'],
    tip: 'Curd before bed supports overnight protein — useful in a deficit.'
  },
  {
    id: 'protein-lassi', name: 'High-Protein Sweet Lassi', veg: true, time: 5, servings: 1,
    tags: ['snack', 'muscle', 'vegetarian', 'quick'], kcal: 240, protein: 22, carbs: 26, fat: 5,
    ing: ['200g curd', '1 scoop whey (or 30g milk powder)', '1/2 cup cold water', 'Cardamom, 1 tsp jaggery'],
    steps: ['Blend curd, whey, water and jaggery till frothy.', 'Add cardamom, blend 5 seconds.', 'Drink within 30 min of training.'],
    tip: 'Whey in lassi tastes like the real thing and hits 22g protein for 240 kcal.'
  },
  {
    id: 'makhana', name: 'Roasted Makhana Crunch', veg: true, time: 8, servings: 2,
    tags: ['snack', 'fat-loss', 'vegetarian', 'quick'], kcal: 150, protein: 5, carbs: 28, fat: 3,
    ing: ['30g makhana', '1/2 tsp ghee', 'Rock salt, pepper, turmeric'],
    steps: ['Dry-roast makhana on low till crisp (6 min).', 'Toss with ghee and spices.', 'Cool completely — they stay crunchy.'],
    tip: 'Chip-crisp for 150 kcal per portion — the easiest swap in the book.'
  },
  {
    id: 'peanut-roti', name: 'Peanut Butter Phulka Roll', veg: true, time: 12, servings: 1,
    tags: ['snack', 'muscle', 'vegetarian', 'quick'], kcal: 300, protein: 12, carbs: 36, fat: 12,
    ing: ['1 hot phulka', '1 tbsp natural peanut butter', '1 banana, sliced (optional)'],
    steps: ['Spread peanut butter on the hot phulka.', 'Add banana, roll up.', 'Eat warm.'],
    tip: 'Good post-workout option if dinner is 2+ hours away.'
  },
  {
    id: 'chicken-salad-plate', name: 'Chicken Plate with Cucumber–Onion Salad', veg: false, time: 15, servings: 1,
    tags: ['lunch', 'dinner', 'high-protein', 'muscle', 'non-veg', 'fat-loss', 'quick'], kcal: 330, protein: 38, carbs: 18, fat: 11,
    ing: ['150g chicken breast', 'Lemon, pepper, garlic, 1 tsp oil', 'Cucumber, onion, tomato', '1 tsp mustard or curd dressing'],
    steps: ['Marinate chicken in lemon, garlic, pepper 10 min.', 'Pan-sear 5 min a side, rest 3 min before slicing.', 'Toss the salad with lemon and salt.', 'Plate together, add a spoon of curd on top.'],
    tip: '38g protein for 330 kcal — the single best dinner for your goal.'
  },
  {
    id: 'dal-veg-soup', name: 'Clear Dal–Veg Soup', veg: true, time: 25, servings: 2,
    tags: ['snack', 'fat-loss', 'vegetarian', 'quick'], kcal: 140, protein: 8, carbs: 22, fat: 2,
    ing: ['1/2 cup masoor dal', 'Mixed vegetables (carrot, beans, cabbage)', 'Ginger, garlic, pepper, lemon', 'No oil or 1/2 tsp'],
    steps: ['Pressure-cook dal with vegetables.', 'Blend half, return, thin with water.', 'Season with pepper and lemon.'],
    tip: 'Drink a glass before dinner — it cuts how much you eat by roughly 10%.'
  }
];

export function recipeById(id) { return RECIPES.find(r => r.id === id); }

export function recipesByTag(tag) {
  if (!tag || tag === 'all') return RECIPES;
  if (tag === 'vegetarian') return RECIPES.filter(r => r.veg);
  if (tag === 'non-veg') return RECIPES.filter(r => !r.veg);
  return RECIPES.filter(r => r.tags.includes(tag));
}

export const RECIPE_TAGS = [
  { id: 'all', label: 'All' },
  { id: 'high-protein', label: 'High protein' },
  { id: 'fat-loss', label: 'Fat loss' },
  { id: 'muscle', label: 'Muscle gain' },
  { id: 'quick', label: 'Under 20 min' },
  { id: 'vegetarian', label: 'Veg' },
  { id: 'non-veg', label: 'Non-veg' },
  { id: 'meal-prep', label: 'Meal prep' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' }
];

/** Score recipes by how well they fit today's remaining budget. */
export function suggestRecipes(limit = 4) {
  const tg = targets();
  const used = dayNutrition();
  const leftKcal = Math.max(0, tg.kcal - used.kcal);
  const leftProtein = Math.max(0, tg.protein - used.protein);

  const recent = store.state.madeRecipes
    .filter(m => m.id.startsWith('mob:') === false)
    .slice(-6).map(m => m.id);

  const scored = RECIPES.map(r => {
    const fitsKcal = r.kcal <= leftKcal ? 1 : Math.max(0, 1 - (r.kcal - leftKcal) / Math.max(200, leftKcal));
    const coversProtein = leftProtein <= 0 ? 0.7 : Math.min(1, r.protein / leftProtein);
    const variety = recent.includes(r.id) ? 0.65 : 1;
    const efficient = Math.min(1, r.protein / (r.kcal / 100));      // protein per 100 kcal
    const score = (fitsKcal * 0.35 + coversProtein * 0.4 + efficient * 0.15 + variety * 0.1);
    return { r, score, leftKcal, leftProtein };
  }).sort((a, b) => b.score - a.score);

  return { suggestions: scored.slice(0, limit), leftKcal, leftProtein, targets: tg, used };
}

export function logRecipe(recipe, servings = 1) {
  store.set(s => {
    s.meals.push({
      d: dateKey(), slot: 'meal', id: Math.random().toString(36).slice(2, 9),
      name: `${recipe.name}${servings > 1 ? ` ×${servings}` : ''}`,
      kcal: Math.round(recipe.kcal * servings),
      protein: Math.round(recipe.protein * servings),
      fromRecipe: recipe.id
    });
    s.madeRecipes.push({ d: dateKey(), id: recipe.id, servings });
  });
}

export function macroSummary(recipe) {
  return `${round(recipe.kcal)} kcal · ${recipe.protein}g protein · ${recipe.carbs}g carbs · ${recipe.fat}g fat`;
}
