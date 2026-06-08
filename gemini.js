// Simple XOR encryption/decryption using a static salt to prevent raw text XSS extraction
function encryptKey(key) {
  const salt = [103, 117, 114, 106, 111, 98, 97, 110, 115, 105, 110, 103, 104, 95, 97, 103];
  const encoded = btoa(key.split('').map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ salt[i % salt.length])
  ).join(''));
  return encoded;
}

function decryptKey(stored) {
  if (!stored) return '';
  const salt = [103, 117, 114, 106, 111, 98, 97, 110, 115, 105, 110, 103, 104, 95, 97, 103];
  try {
    const decoded = atob(stored);
    return decoded.split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ salt[i % salt.length])
    ).join('');
  } catch (e) {
    console.error("Failed to decrypt key:", e);
    return '';
  }
}

// Helper to check if API key exists
export function getGeminiKey() {
  // Try retrieving obfuscated key first
  const storedObf = localStorage.getItem('gemini_api_key_obf');
  if (storedObf) {
    return decryptKey(storedObf);
  }
  // Migration fallback: if raw key exists, encrypt it and remove the raw key
  const rawKey = localStorage.getItem('gemini_api_key');
  if (rawKey) {
    saveGeminiKey(rawKey);
    localStorage.removeItem('gemini_api_key');
    return rawKey;
  }
  return '';
}

export function saveGeminiKey(key) {
  if (key) {
    localStorage.setItem('gemini_api_key_obf', encryptKey(key.trim()));
    localStorage.removeItem('gemini_api_key'); // Clean up old raw key
  } else {
    localStorage.removeItem('gemini_api_key_obf');
    localStorage.removeItem('gemini_api_key');
  }
}


// Selectable AI Coach Personality Guidelines
const PERSONALITY_PROMPTS = {
  elite: `You are an elite, evidence-driven health and performance coach. Critique should be direct, precise, and objective. Highlight recovery stats, progressive overload, and efficiency. Focus entirely on actionable, decision-based insights. Do not sugarcoat, use empty motivational phrases, or congratulate for trivial achievements. Keep descriptions extremely concise.`,
  supportive: `You are a warm, supportive, and empathetic health mentor. Focus on positive reinforcement, incremental progress, and self-compassion. Keep critiques encouraging and constructive, highlighting what went well. Offer suggestions that feel accessible, realistic, and positive for building lasting habit loops.`,
  hardcore: `You are a hardcore, highly intense fitness coach. Keep the tone aggressive, high-energy, and direct. Push limits and demand accountability. Highlight missed targets and urge them to step up, with zero excuses. Keep tomorrow's priorities focused on discipline and effort.`,
  mindfulness: `You are a wellness and balance coach. Focus on recovery, sleep hygiene, nervous system balance, and mindful eating. Critique should evaluate stress factors, sleep debt, and active recovery, warning against burnout. Priorities should emphasize restorative actions, hydration, and mental space.`
};

function getCoachPersonality() {
  return localStorage.getItem('lt_coach_personality') || 'elite';
}

// Holistic Daily Review call to Gemini
export async function getDailyReview(dailyData, previousLogs = []) {
  const apiKey = getGeminiKey();
  const personality = getCoachPersonality();
  const personalityInstruction = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.elite;
  
  if (!apiKey) {
    return getMockReview(dailyData);
  }

  const prompt = `
    ${personalityInstruction}
    
    Instructions:
    Analyze the user's health logs for today and compare them to their past context / 7-day trends.
    Do NOT repeat data back to the user. Find patterns, identify opportunities, and focus on decisions, not observations.
    Do NOT use emojis in your response. Keep all statements concise, direct, and evidence-driven.

    TODAY'S LOGS:
    ${JSON.stringify(dailyData, null, 2)}

    PAST HISTORY CONTEXT (Recent Logs):
    ${JSON.stringify(previousLogs, null, 2)}

    Return your output strictly as a JSON object matching this schema:
    {
      "score": 85, // Integer 0-100 representing overall fitness adherence/quality for today
      "recoveryNeed": "Low" | "Medium" | "High", // Recovery assessment category based on sleep, active burn, and workout intensity
      "actionableRecommendation": "One key, decision-focused, highly specific coaching recommendation for tomorrow.",
      "wins": ["Concise string detailing what went well today", "Another concise win"],
      "missedOpportunities": ["Concise string detailing what could have improved the day", "Another missed opportunity"],
      "tomorrowPriorities": ["Concise priority 1", "Concise priority 2", "Concise priority 3 (maximum 3 items)"]
    }
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error("Empty response received from Gemini API");
    }

    return JSON.parse(resultText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    const mock = getMockReview(dailyData);
    mock.actionableRecommendation = `[AI Offline Fallback] ${mock.actionableRecommendation}`;
    return mock;
  }
}

// Local rules-based engine for offline/no-key usage
export function getMockReview(data) {
  const steps = data.steps || 0;
  const sleep = data.sleep || 0;
  const water = data.water || 0;
  const cals = data.calories || 0;
  const protein = data.protein || 0;
  const targetCals = data.calorieGoal || 2000;
  const targetProtein = 150;
  const workoutCount = data.workouts ? data.workouts.length : 0;
  
  const personality = getCoachPersonality();
  
  // Calculate score (0 to 100)
  let score = 70; // Base score
  let wins = [];
  let missedOpportunities = [];
  let tomorrowPriorities = [];

  // Workouts
  if (workoutCount > 0) {
    score += 10;
    wins.push(`Executed ${workoutCount} logged exercise splits.`);
  } else {
    missedOpportunities.push("Active recovery/rest day, no strength exercises logged.");
  }

  // Steps
  if (steps >= 10000) {
    score += 10;
    wins.push(`Hit step target with ${steps.toLocaleString()} steps.`);
  } else if (steps >= 7000) {
    score += 5;
    wins.push(`Maintained baseline movement of ${steps.toLocaleString()} steps.`);
    missedOpportunities.push(`Step count (${steps.toLocaleString()}) was slightly below the 10k target.`);
  } else if (steps > 0) {
    score -= 10;
    missedOpportunities.push(`Sedentary day with only ${steps.toLocaleString()} steps logged.`);
  } else {
    score -= 15;
    missedOpportunities.push("No steps logged today.");
  }

  // Sleep
  if (sleep >= 7 && sleep <= 9) {
    score += 10;
    wins.push(`Optimal rest with ${sleep} hours of sleep.`);
  } else if (sleep > 0) {
    score -= 10;
    missedOpportunities.push(`Short sleep duration at ${sleep} hours.`);
  } else {
    score -= 15;
    missedOpportunities.push("No sleep data logged today.");
  }

  // Water
  if (water >= 8) {
    score += 5;
    wins.push(`Optimal hydration with ${water} cups of water.`);
  } else if (water > 0) {
    missedOpportunities.push(`Water intake (${water} cups) was below 8 cups target.`);
  } else {
    score -= 5;
    missedOpportunities.push("No water logged today.");
  }

  // Nutrition (Calories)
  if (cals > 0) {
    const diff = Math.abs(cals - targetCals);
    if (diff <= 200) {
      score += 10;
      wins.push("Calorie intake was within targeted energy boundaries.");
    } else if (cals > targetCals + 200) {
      score -= 10;
      missedOpportunities.push(`Calorie surplus (+${cals - targetCals} kcal above target).`);
    } else {
      score -= 5;
      missedOpportunities.push(`Calorie deficit (-${targetCals - cals} kcal below target).`);
    }
  } else {
    score -= 10;
    missedOpportunities.push("No nutritional calories logged today.");
  }

  // Nutrition (Protein)
  if (protein > 0) {
    if (protein >= targetProtein) {
      score += 5;
      wins.push(`Hit high protein synthesis threshold (${protein}g).`);
    } else if (protein >= 100) {
      wins.push(`Logged moderate protein intake of ${protein}g.`);
      missedOpportunities.push(`Protein (${protein}g) was below the 150g target.`);
    } else {
      score -= 5;
      missedOpportunities.push(`Low protein intake of ${protein}g.`);
    }
  }

  // Final score clamping
  score = Math.max(0, Math.min(100, score));

  // Recovery Need Assessment
  let recoveryNeed = "Medium";
  if (sleep < 6 || (workoutCount > 0 && steps > 12000)) {
    recoveryNeed = "High";
  } else if (sleep >= 7.5 && workoutCount === 0 && steps < 8000) {
    recoveryNeed = "Low";
  }

  // Build priorities and recommendation based on personality
  let recommendation = "";
  if (personality === 'supportive') {
    recommendation = "You did a great job showing up today! Focus on getting in a warm stretch tonight and prioritizing a light walk tomorrow.";
    if (sleep < 7) tomorrowPriorities.push("Set a warm, relaxing bedtime routine");
    if (water < 8) tomorrowPriorities.push("Keep a supportive water bottle nearby");
    if (protein < 120) tomorrowPriorities.push("Add one cozy protein snack");
  } else if (personality === 'hardcore') {
    recommendation = "Zero excuses. If you missed targets, double down tomorrow. Load the bar, hit your steps early, and log every gram.";
    if (sleep < 7) tomorrowPriorities.push("Shut off screens and sleep 8 hrs");
    if (steps < 10000) tomorrowPriorities.push("Get 5,000 steps before noon");
    if (protein < targetProtein) tomorrowPriorities.push("Hit your protein goal of 150g");
  } else if (personality === 'mindfulness') {
    recommendation = "Tune into your body's recovery signals. Balance active movement with deep breathing and quality rest cycles.";
    if (sleep < 7) tomorrowPriorities.push("Practice 5-min bedtime breathing");
    if (water < 8) tomorrowPriorities.push("Sip herbal tea or warm water");
    if (workoutCount > 0) tomorrowPriorities.push("Schedule a restorative yoga block");
  } else {
    // elite
    recommendation = "Optimize recovery and fuel metrics. Ensure training splits are matched with structural protein support.";
    if (sleep < 7) tomorrowPriorities.push("Execute 8-hour sleep protocol");
    if (steps < 10000) tomorrowPriorities.push("Increase NEAT walk volume tomorrow");
    if (protein < targetProtein) tomorrowPriorities.push("Optimize protein to 1.6g-2g/kg");
  }

  // Fallbacks if priorities empty
  if (tomorrowPriorities.length === 0) {
    tomorrowPriorities.push("Aim for 10k steps");
    tomorrowPriorities.push("Log all hydration");
    tomorrowPriorities.push("Execute daily training");
  }
  tomorrowPriorities = tomorrowPriorities.slice(0, 3);

  return {
    score,
    recoveryNeed,
    actionableRecommendation: recommendation,
    wins: wins.length > 0 ? wins : ["Tracked active progress in the database."],
    missedOpportunities: missedOpportunities.length > 0 ? missedOpportunities : ["No notable deficits identified."],
    tomorrowPriorities
  };
}

// AI Meal Log / Recipe Analyzer call
export async function analyzeMeal(mealDescription) {
  const apiKey = getGeminiKey();
  
  if (!apiKey) {
    return getMockMealAnalysis(mealDescription);
  }

  const prompt = `
    You are an elite, practical health and nutrition coach.
    Analyze the following food log / meal description and estimate the nutritional macros.
    If ingredients or quantities are given in grams, perform the exact calculations.
    If quantities are not specified, make a highly realistic, practical estimate.
    If there is uncertainty, calculate a reasonable average but provide a range in the explanation text.
    Do NOT use emojis. Keep the analysis concise, evidence-driven, and coach-like.

    MEAL DESCRIPTION:
    "${mealDescription}"

    Return your output strictly as a JSON object matching this schema:
    {
      "mealTitle": "Concise name of the meal (e.g., 'Protein Oats with Banana')",
      "calories": 450, // Total estimated calories (integer)
      "protein": 30, // Total estimated protein in grams (integer)
      "carbs": 40, // Total estimated carbohydrates in grams (integer)
      "fat": 12, // Total estimated fat in grams (integer)
      "explanation": "A short 1-2 sentence description explaining major calorie/macro sources, including ranges if uncertainty exists (e.g. 'Estimated calories: 420-480. Salmon supplies protein and fats, jasmine rice supplies carbs.')"
    }
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error("Empty response received from Gemini API");
    }

    return JSON.parse(resultText);
  } catch (error) {
    console.error("Gemini API Meal Analysis Error:", error);
    const mockResult = getMockMealAnalysis(mealDescription);
    mockResult.explanation = `[AI Offline Fallback] ${mockResult.explanation}`;
    return mockResult;
  }
}

// Rules-based offline meal macro parser with keyword proximity matching
export function getMockMealAnalysis(text) {
  const lower = text.toLowerCase();
  
  // Mock database of popular items with macros per gram
  const db = [
    { key: "chicken", name: "Chicken Breast", calG: 1.65, protG: 0.31, carbG: 0, fatG: 0.036 },
    { key: "salmon", name: "Grilled Salmon", calG: 2.08, protG: 0.22, carbG: 0, fatG: 0.13 },
    { key: "beef", name: "Lean Beef", calG: 2.50, protG: 0.26, carbG: 0, fatG: 0.15 },
    { key: "rice", name: "Jasmine Rice", calG: 1.30, protG: 0.027, carbG: 0.28, fatG: 0.003 },
    { key: "oat", name: "Oatmeal", calG: 3.79, protG: 0.13, carbG: 0.67, fatG: 0.065 },
    { key: "egg", name: "Boiled Eggs", calG: 1.55, protG: 0.13, carbG: 0.01, fatG: 0.11 },
    { key: "whey", name: "Whey Protein", calG: 4.00, protG: 0.80, carbG: 0.06, fatG: 0.06 },
    { key: "milk", name: "Milk", calG: 0.50, protG: 0.033, carbG: 0.05, fatG: 0.015 },
    { key: "banana", name: "Banana", calG: 0.89, protG: 0.011, carbG: 0.23, fatG: 0.003 },
    { key: "almond", name: "Almonds", calG: 5.79, protG: 0.21, carbG: 0.22, fatG: 0.49 },
    { key: "oil", name: "Olive Oil", calG: 8.84, protG: 0, carbG: 0, fatG: 1.00 },
    { key: "butter", name: "Butter", calG: 7.17, protG: 0.009, carbG: 0.001, fatG: 0.81 }
  ];

  // Try to parse weight followed by gram word, e.g. "150g" or "150 grams"
  const gramRegex = /(\d+)\s*(?:g|grams|gram)\b/g;
  let matches = [];
  let match;
  while ((match = gramRegex.exec(lower)) !== null) {
    matches.push({
      val: parseInt(match[1]),
      index: match.index
    });
  }

  let totalCal = 0;
  let totalProt = 0;
  let totalCarb = 0;
  let totalFat = 0;
  let parsedIngredients = [];

  if (matches.length > 0) {
    matches.forEach(m => {
      // Find which ingredient is closest in string context
      const start = Math.max(0, m.index - 25);
      const end = Math.min(lower.length, m.index + 25);
      const slice = lower.substring(start, end);
      const matchPosInSlice = m.index - start;
      
      let bestItem = null;
      let minDistance = 999;
      
      for (let item of db) {
        let idx = slice.indexOf(item.key);
        while (idx !== -1) {
          const dist = Math.abs(idx - matchPosInSlice);
          if (dist < minDistance) {
            minDistance = dist;
            bestItem = item;
          }
          idx = slice.indexOf(item.key, idx + 1);
        }
      }
      
      if (bestItem) {
        const cal = Math.round(m.val * bestItem.calG);
        const prot = Math.round(m.val * bestItem.protG);
        const carb = Math.round(m.val * bestItem.carbG);
        const fat = Math.round(m.val * bestItem.fatG);
        
        totalCal += cal;
        totalProt += prot;
        totalCarb += carb;
        totalFat += fat;
        parsedIngredients.push(`${m.val}g ${bestItem.name}`);
      } else {
        // General default gram estimations
        totalCal += Math.round(m.val * 1.5);
        totalProt += Math.round(m.val * 0.05);
        totalCarb += Math.round(m.val * 0.15);
        totalFat += Math.round(m.val * 0.03);
        parsedIngredients.push(`${m.val}g general food`);
      }
    });
  } else {
    // Portions fallback if no grams are specified
    db.forEach(item => {
      if (lower.includes(item.key)) {
        const portion = 100;
        totalCal += Math.round(portion * item.calG);
        totalProt += Math.round(portion * item.protG);
        totalCarb += Math.round(portion * item.carbG);
        totalFat += Math.round(portion * item.fatG);
        parsedIngredients.push(`Standard ${item.name}`);
      }
    });
  }

  if (totalCal === 0) {
    totalCal = 350;
    totalProt = 15;
    totalCarb = 45;
    totalFat = 10;
    parsedIngredients.push("custom nutrition mix");
  }

  let mealTitle = "Analyzed Meal";
  if (parsedIngredients.length > 0) {
    mealTitle = parsedIngredients.slice(0, 2).join(" & ");
  }
  
  mealTitle = mealTitle.replace(/\b\w/g, c => c.toUpperCase());

  return {
    mealTitle,
    calories: totalCal,
    protein: totalProt,
    carbs: totalCarb,
    fat: totalFat,
    explanation: `Calculated from ingredients: ${parsedIngredients.join(', ')}. Standard offline estimates applied.`
  };
}

// Interactive Chat with Coach Gemini
export async function sendCoachChatMessage(userMessage, chatHistory, todayLog, trends) {
  const apiKey = getGeminiKey();
  const personality = getCoachPersonality();
  const personalityInstruction = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.elite;

  // Compile slim context
  const slimContext = {
    today: {
      steps: todayLog.steps || 0,
      workouts: (todayLog.workouts || []).map(w => w.name || w.splitName || "Workout"),
      calories: todayLog.calories || 0,
      protein: todayLog.protein || 0,
      sleep: todayLog.sleep || 0,
      water: todayLog.water || 0
    },
    weeklyAverages: {
      avgSteps: trends.avgSteps7d ? Math.round(trends.avgSteps7d) : 0,
      avgSleep: trends.avgSleep7d ? parseFloat(trends.avgSleep7d.toFixed(1)) : 0,
      avgCalories: trends.avgCalories7d ? Math.round(trends.avgCalories7d) : 0,
      weightChange: trends.weightChange7d ? parseFloat(trends.weightChange7d.toFixed(1)) : 0
    }
  };

  if (!apiKey) {
    return getMockChatMessage(userMessage, slimContext);
  }

  // System Prompt for Chat
  const systemPrompt = `
    ${personalityInstruction}

    You are in a direct live chat conversation with the user.
    Keep your answers concise, direct, helpful, and matching your designated personality.
    Do NOT use emojis in your response. Do NOT repeat instructions.
    
    Here is the user's active logs context for today and their 7-day average trends:
    ${JSON.stringify(slimContext, null, 2)}
  `;

  // Build messages array for Gemini API (chat history)
  const recentHistory = chatHistory.slice(-8); // Limit history window
  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }]
    },
    {
      role: 'model',
      parts: [{ text: "Understood. I will coach you based on this context and style. How can I help you today?" }]
    }
  ];

  recentHistory.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  });

  // Append new user message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error("Empty response received from Gemini API");
    }

    return resultText;
  } catch (error) {
    console.error("Gemini Chat API Error:", error);
    return `[AI Offline Fallback] ${getMockChatMessage(userMessage, slimContext)}`;
  }
}

// Rules-based mock response generator for offline chat
export function getMockChatMessage(message, context) {
  const lower = message.toLowerCase();
  const personality = getCoachPersonality();

  let prefix = "";
  if (personality === 'supportive') {
    prefix = "Keep going, step by step! ";
  } else if (personality === 'hardcore') {
    prefix = "Listen up! No excuses. ";
  } else if (personality === 'mindfulness') {
    prefix = "Be mindful of your body's signals. ";
  } else {
    prefix = "Reviewing metrics: ";
  }

  if (lower.includes("step")) {
    return `${prefix}Your steps today: ${context.today.steps}. Your 7-day average steps is ${context.weeklyAverages.avgSteps}. Make sure you meet your daily goal of 10,000 steps.`;
  }
  if (lower.includes("workout") || lower.includes("training") || lower.includes("gym") || lower.includes("lift")) {
    const workouts = context.today.workouts.length > 0 ? context.today.workouts.join(", ") : "no workouts";
    return `${prefix}Logged workouts today: ${workouts}. Stay consistent on your strength routine to preserve fat-free mass.`;
  }
  if (lower.includes("eat") || lower.includes("diet") || lower.includes("calorie") || lower.includes("kcal") || lower.includes("food") || lower.includes("protein")) {
    return `${prefix}Logged intake today: ${context.today.calories} kcal, ${context.today.protein}g protein. Averages this week: ${context.weeklyAverages.avgCalories} kcal. Adjust portions according to your deficit/surplus needs.`;
  }
  if (lower.includes("sleep") || lower.includes("rest")) {
    return `${prefix}Logged sleep today: ${context.today.sleep} hours. Averages this week: ${context.weeklyAverages.avgSleep} hours. Aim for 7 to 9 hours of quality sleep to recover optimally.`;
  }
  if (lower.includes("weight") || lower.includes("scale")) {
    return `${prefix}Your 7-day weight shift is ${context.weeklyAverages.weightChange}kg. Monitor trends over 2-3 weeks before adjusting caloric boundaries.`;
  }

  // Generic fallback messages based on coach personality
  if (personality === 'supportive') {
    return "I hear you, and we're in this together. Every small habit is a win. Focus on staying consistent and being kind to yourself as you build these routines.";
  } else if (personality === 'hardcore') {
    return "Discipline beats motivation. Get your head down, hit your workouts, stop making excuses, and get the job done today!";
  } else if (personality === 'mindfulness') {
    return "Listen to your breath and prioritize recovery. Burnout happens when we push too hard without restorative sleep and stress management.";
  } else {
    return "Optimize your health vectors. Focus on progressive overload in your splits, precision in macro tracking, and consistent daily movement targets.";
  }
}

