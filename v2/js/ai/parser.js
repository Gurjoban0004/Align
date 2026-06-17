// =============================================================
// ALIGN v2 — Natural Language Input Parser
// Parses casual text into structured log entries (offline-capable)
// =============================================================

/**
 * @typedef {Object} ParseResult
 * @property {'food'|'steps'|'sleep'|'workout'|'water'|'weight'|'habit'|'reading'|'note'} type
 * @property {Object} data - Structured data for this entry
 * @property {string} summary - Human-readable confirmation text
 * @property {number} confidence - 0-1 confidence score
 */

// ─── Food Database (compact, for quick local parsing) ───
const FOOD_QUICK = {
  'chicken': { cal: 165, protein: 31, per: '100g' },
  'chicken breast': { cal: 165, protein: 31, per: '100g' },
  'chicken rice': { cal: 550, protein: 35, per: 'plate' },
  'rice': { cal: 130, protein: 2.7, per: '100g' },
  'dal': { cal: 120, protein: 9, per: 'bowl' },
  'egg': { cal: 78, protein: 6, per: '1' },
  'eggs': { cal: 156, protein: 12, per: '2' },
  'oats': { cal: 150, protein: 5, per: 'bowl' },
  'oatmeal': { cal: 150, protein: 5, per: 'bowl' },
  'banana': { cal: 105, protein: 1, per: '1' },
  'milk': { cal: 150, protein: 8, per: 'glass' },
  'paneer': { cal: 265, protein: 18, per: '100g' },
  'roti': { cal: 110, protein: 3.5, per: '1' },
  'chapati': { cal: 110, protein: 3.5, per: '1' },
  'biryani': { cal: 490, protein: 22, per: 'plate' },
  'butter chicken': { cal: 438, protein: 28, per: 'serving' },
  'rajma': { cal: 380, protein: 14, per: 'plate' },
  'chole': { cal: 320, protein: 12, per: 'serving' },
  'salmon': { cal: 312, protein: 34, per: '150g' },
  'whey': { cal: 120, protein: 24, per: 'scoop' },
  'protein shake': { cal: 120, protein: 24, per: 'scoop' },
  'yogurt': { cal: 146, protein: 20, per: '200g' },
  'greek yogurt': { cal: 146, protein: 20, per: '200g' },
  'sandwich': { cal: 340, protein: 18, per: '1' },
  'pizza': { cal: 285, protein: 12, per: 'slice' },
  'burger': { cal: 450, protein: 22, per: '1' },
  'salad': { cal: 90, protein: 3, per: 'bowl' },
  'pasta': { cal: 220, protein: 8, per: 'plate' },
  'dosa': { cal: 130, protein: 3, per: '1' },
  'idli': { cal: 80, protein: 2, per: '1' },
  'coffee': { cal: 5, protein: 0, per: 'cup' },
  'tea': { cal: 30, protein: 0, per: 'cup' },
  'juice': { cal: 112, protein: 2, per: 'glass' },
  'apple': { cal: 95, protein: 0, per: '1' },
  'almonds': { cal: 170, protein: 6, per: '30g' },
  'peanut butter': { cal: 190, protein: 7, per: '2 tbsp' },
  'bread': { cal: 80, protein: 3, per: 'slice' },
  'toast': { cal: 80, protein: 3, per: 'slice' },
  'samosa': { cal: 154, protein: 2, per: '1' },
  'poha': { cal: 250, protein: 5, per: 'plate' },
  'upma': { cal: 210, protein: 5, per: 'plate' },
  'naan': { cal: 262, protein: 9, per: '1' },
  'paratha': { cal: 200, protein: 4, per: '1' },
};

/**
 * Parse natural language input into structured log entries.
 * @param {string} text - User's natural language input
 * @returns {ParseResult[]}
 */
export function parseInput(text) {
  if (!text || text.trim().length === 0) return [];

  const lower = text.toLowerCase().trim();
  const results = [];

  // Try each parser, collect all matches
  const stepResult = parseSteps(lower);
  if (stepResult) results.push(stepResult);

  const sleepResult = parseSleep(lower);
  if (sleepResult) results.push(sleepResult);

  const waterResult = parseWater(lower);
  if (waterResult) results.push(waterResult);

  const weightResult = parseWeight(lower);
  if (weightResult) results.push(weightResult);

  const workoutResults = parseWorkout(lower);
  results.push(...workoutResults);

  const readingResult = parseReading(lower);
  if (readingResult) results.push(readingResult);

  const foodResults = parseFood(lower);
  results.push(...foodResults);

  // If nothing matched, treat as a note
  if (results.length === 0) {
    results.push({
      type: 'note',
      data: { text: text.trim() },
      summary: `Note: "${text.trim()}"`,
      confidence: 0.5,
    });
  }

  return results;
}

// ─── Steps Parser ───
function parseSteps(text) {
  // Patterns: "walked 6k", "6000 steps", "did 8k steps", "10,000 steps"
  const patterns = [
    /(?:walked|walk|did|logged|got)\s+(\d+\.?\d*)\s*k\b/i,
    /(\d+\.?\d*)\s*k\s*(?:steps|step)/i,
    /(\d[\d,]*)\s*(?:steps|step)/i,
    /(?:steps|step)\s*[:=]?\s*(\d[\d,]*)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let val = m[1].replace(/,/g, '');
      let steps = parseFloat(val);
      // "6k" → 6000
      if (steps < 100) steps = Math.round(steps * 1000);
      else steps = Math.round(steps);

      return {
        type: 'steps',
        data: { steps },
        summary: `${steps.toLocaleString()} steps logged`,
        confidence: 0.9,
      };
    }
  }
  return null;
}

// ─── Sleep Parser ───
function parseSleep(text) {
  // Patterns: "slept 7 hours", "7h sleep", "sleep 6.5 hrs", "slept 7h 30m"
  const patterns = [
    /(?:slept|sleep|sleeping)\s+(\d+\.?\d*)\s*(?:h(?:ou)?r?s?)\s*(?:(\d+)\s*m(?:in)?)?/i,
    /(\d+\.?\d*)\s*(?:h(?:ou)?r?s?)\s*(?:(\d+)\s*m(?:in)?)?\s*(?:sleep|slept)/i,
    /(?:sleep|slept)\s*[:=]?\s*(\d+\.?\d*)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let hours = parseFloat(m[1]);
      if (m[2]) hours += parseInt(m[2]) / 60;
      hours = parseFloat(hours.toFixed(1));

      return {
        type: 'sleep',
        data: { sleep: hours },
        summary: `${hours}h sleep logged`,
        confidence: 0.9,
      };
    }
  }
  return null;
}

// ─── Water Parser ───
function parseWater(text) {
  // Patterns: "drank 3 glasses", "4 cups water", "water 5", "2 liters"
  const patterns = [
    /(?:drank|drink|had)\s+(\d+)\s*(?:glass(?:es)?|cup(?:s)?)\s*(?:of\s+)?(?:water)?/i,
    /(\d+)\s*(?:glass(?:es)?|cup(?:s)?)\s*(?:of\s+)?water/i,
    /water\s*[:=]?\s*(\d+)/i,
    /(\d+\.?\d*)\s*(?:liter|litre|l)\s*(?:of\s+)?water/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let cups = parseFloat(m[1]);
      // Convert liters to cups (1L ≈ 4 cups)
      if (text.includes('liter') || text.includes('litre') || /\d\s*l\b/.test(text)) {
        cups = Math.round(cups * 4);
      }
      cups = Math.round(cups);

      return {
        type: 'water',
        data: { water: cups },
        summary: `${cups} cups of water`,
        confidence: 0.85,
      };
    }
  }
  return null;
}

// ─── Weight Parser ───
function parseWeight(text) {
  // Patterns: "weigh 78.5kg", "weight 78.5", "78.5 kg today"
  const patterns = [
    /(?:weigh|weight|scale)\s*(?:is|was|at|:)?\s*(\d+\.?\d*)\s*(?:kg|kgs|pounds?|lbs?)?/i,
    /(\d+\.?\d*)\s*(?:kg|kgs)\s*(?:today|now|weight)?/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const weight = parseFloat(m[1]);
      if (weight > 20 && weight < 300) {
        return {
          type: 'weight',
          data: { weight },
          summary: `Weight: ${weight} kg`,
          confidence: 0.9,
        };
      }
    }
  }
  return null;
}

// ─── Workout Parser ───
function parseWorkout(text) {
  const results = [];

  // Pattern: "bench 70kg 4x8", "squats 80kg 3 sets of 10"
  const exercisePatterns = [
    /(?:did|pushed|lifted|hit)?\s*(\w[\w\s]*?)\s+(\d+\.?\d*)\s*(?:kg|kgs|lbs?)\s+(?:for\s+)?(\d+)\s*[x×]\s*(\d+)/gi,
    /(\w[\w\s]*?)\s*[-:]\s*(\d+\.?\d*)\s*(?:kg|kgs)\s*,?\s*(\d+)\s*(?:sets?)\s*(?:of\s+)?(\d+)\s*(?:reps?)?/gi,
  ];

  for (const pat of exercisePatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const name = m[1].trim().replace(/^(did|pushed|hit|lifted)\s+/i, '');
      const capName = name.replace(/\b\w/g, c => c.toUpperCase());
      results.push({
        type: 'workout',
        data: {
          name: capName,
          weight: parseFloat(m[2]),
          sets: parseInt(m[3]),
          reps: parseInt(m[4]),
        },
        summary: `${capName}: ${m[2]}kg × ${m[3]}×${m[4]}`,
        confidence: 0.85,
      });
    }
  }

  // Simple: "did chest today", "leg day", "trained back"
  if (results.length === 0) {
    const splitMatch = text.match(/(?:did|trained|worked|hit)\s+(chest|back|legs?|push|pull|shoulders?|arms?|upper|lower)/i);
    if (splitMatch) {
      const split = splitMatch[1].replace(/\b\w/g, c => c.toUpperCase());
      results.push({
        type: 'workout',
        data: { splitName: split + ' Day', name: split + ' Day' },
        summary: `${split} Day workout`,
        confidence: 0.7,
      });
    }

    const dayMatch = text.match(/(push|pull|leg|chest|back|shoulder|arm|upper|lower)\s*day/i);
    if (dayMatch && results.length === 0) {
      const split = dayMatch[1].replace(/\b\w/g, c => c.toUpperCase());
      results.push({
        type: 'workout',
        data: { splitName: split + ' Day', name: split + ' Day' },
        summary: `${split} Day workout`,
        confidence: 0.7,
      });
    }
  }

  // "skipped gym", "rest day"
  if (text.match(/(?:skip|skipped|missed)\s*(?:gym|workout|training)/i) || text.match(/rest\s*day/i)) {
    results.push({
      type: 'workout',
      data: { restDay: true, name: 'Rest Day' },
      summary: 'Rest day noted',
      confidence: 0.9,
    });
  }

  return results;
}

// ─── Reading Parser ───
function parseReading(text) {
  // Patterns: "read 20 pages", "finished Atomic Habits"
  const pagePatterns = [
    /(?:read|reading)\s+(\d+)\s*(?:pages?|pg)/i,
    /(\d+)\s*(?:pages?|pg)\s*(?:read|today)/i,
  ];

  for (const pat of pagePatterns) {
    const m = text.match(pat);
    if (m) {
      const pages = parseInt(m[1]);
      return {
        type: 'reading',
        data: { pagesRead: pages },
        summary: `${pages} pages read`,
        confidence: 0.85,
      };
    }
  }

  // "finished <book>"
  const finishedMatch = text.match(/(?:finished|completed|done with)\s+(.+)/i);
  if (finishedMatch) {
    const title = finishedMatch[1].replace(/[.!?]+$/, '').trim();
    return {
      type: 'reading',
      data: { finishedBook: title },
      summary: `Finished "${title}"`,
      confidence: 0.75,
    };
  }

  return null;
}

// ─── Food Parser ───
function parseFood(text) {
  const results = [];

  // Check if text explicitly mentions food-related context
  const hasFoodContext = /(?:had|ate|eat|lunch|dinner|breakfast|snack|meal|drank|food|cooked)/i.test(text);
  if (!hasFoodContext) return results;

  // Remove step/sleep/water/weight parts to avoid false matches
  let foodText = text
    .replace(/(?:walked|walk)\s+\d+\.?\d*\s*k?\b/gi, '')
    .replace(/\d+\.?\d*\s*(?:steps?|k\s+steps?)/gi, '')
    .replace(/(?:slept|sleep)\s+\d+\.?\d*\s*h/gi, '')
    .replace(/(?:drank|drink)\s+\d+\s*(?:glass|cup|liter)/gi, '')
    .replace(/(?:weigh|weight)\s*\d+\.?\d*/gi, '')
    .trim();

  if (!foodText) return results;

  // Try to match known foods
  let totalCal = 0;
  let totalProtein = 0;
  const matchedFoods = [];

  // Sort food keys by length (longest first) to match "chicken breast" before "chicken"
  const sortedKeys = Object.keys(FOOD_QUICK).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (foodText.includes(key)) {
      const food = FOOD_QUICK[key];

      // Check for quantity multiplier: "2 eggs", "3 roti"
      const qtyMatch = foodText.match(new RegExp(`(\\d+)\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
      let qty = 1;
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1]);
        // Some foods like "eggs" already account for 2
        if (key === 'eggs' && qty > 1) qty = qty / 2;
      }

      const cal = Math.round(food.cal * qty);
      const prot = Math.round(food.protein * qty);
      totalCal += cal;
      totalProtein += prot;
      matchedFoods.push(`${qty > 1 ? qty + '× ' : ''}${key}`);

      // Remove matched food from text to avoid double-matching
      foodText = foodText.replace(new RegExp(key, 'gi'), '');
    }
  }

  if (matchedFoods.length > 0) {
    const mealName = matchedFoods.slice(0, 3).join(', ');
    results.push({
      type: 'food',
      data: {
        calories: totalCal,
        protein: totalProtein,
        meals: [{ title: mealName, calories: totalCal, protein: totalProtein }],
      },
      summary: `${mealName} — ~${totalCal} kcal, ${totalProtein}g protein`,
      confidence: 0.75,
    });
  }

  return results;
}

/**
 * Get the placeholder text for the input bar based on time of day.
 */
export function getInputPlaceholder(timePeriod) {
  const placeholders = {
    morning: 'How did you sleep? What\'s the plan today?',
    midday: 'Log anything — "had chicken rice for lunch"',
    evening: 'How was your day? What did you eat?',
    night: 'Wrap up — log sleep, meals, or notes...',
  };
  return placeholders[timePeriod] || placeholders.midday;
}
