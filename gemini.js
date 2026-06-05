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


// Holistic Daily Review call to Gemini
export async function getDailyReview(dailyData, previousLogs = []) {
  const apiKey = getGeminiKey();
  
  if (!apiKey) {
    // Return mock response if no key is stored
    return getMockReview(dailyData);
  }

  const prompt = `
    You are an elite, thoughtful AI Fitness & Health Coach. 
    Analyze this user's health logs for today and provide a holistic rating, score (1-10), direct critique, and structured recommendations for tomorrow.

    In your analysis, pay close attention to the "trends" property which holds their 7-day moving averages (calories, steps, sleep, weight change).
    Use these trends to offer insights into their consistency, progressive overload, recovery deficits, or calorie trends, rather than analyzing today in isolation.

    TODAY'S LOGS:
    ${JSON.stringify(dailyData, null, 2)}

    PAST HISTORY CONTEXT (Recent Logs):
    ${JSON.stringify(previousLogs, null, 2)}

    Instructions for analysis:
    - Assess if the calorie and protein intake was appropriate for today's workout split and their 7-day calorie trend.
    - Evaluate sleep quality (today vs their 7-day sleep average - warn them if they are building up a sleep debt).
    - Rate their daily steps and active movement against their 7-day average and step targets.
    - Check their weight trend: guide them on whether their calorie trend is aligning with their weight gain or loss trajectory.
    - Suggest specific adjustments for tomorrow (e.g. adjust weights, plan rest/active recovery, modify macro distribution).

    Return your output strictly as a JSON object matching this schema:
    {
      "rating": "A short 1-3 word rating (e.g., 'Optimal Recovery', 'High Performance', 'Accumulated Fatigue', 'Consistent Movement')",
      "score": 8, // Integer 1-10 representing overall fitness adherence/quality for today
      "critique": "A brief, highly encouraging, yet professional critique paragraph analyzing how they did (markdown supported). Use a warm, literary, editorial tone. Refer to their weekly averages and trends directly.",
      "recommendation": "A bulleted markdown list of 3-4 specific, actionable goals for tomorrow (markdown supported)."
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
    // Return fallback with error notice
    return {
      rating: "API Error",
      score: 5,
      critique: `Could not connect to Gemini API: ${error.message}. Showing local rules engine review instead:\n\n${getMockReview(dailyData).critique}`,
      recommendation: getMockReview(dailyData).recommendation
    };
  }
}

// Local rules-based engine for offline/no-key usage
function getMockReview(data) {
  const steps = data.steps || 0;
  const sleep = data.sleep || 0;
  const water = data.water || 0;
  const cals = data.calories || 0;
  const protein = data.protein || 0;
  const targetCals = data.calorieGoal || 2000;
  const workoutCount = data.workouts ? data.workouts.length : 0;
  
  let score = 7;
  let rating = "Good Balance";
  let critiqueParts = [];
  let recs = [];

  // Inject 7-day moving averages analysis if available
  if (data.trends) {
    const t = data.trends;
    if (t.avgSleep7d > 0 && t.avgSleep7d < 7) {
      score -= 1;
      critiqueParts.push(`Your 7-day average sleep of ${t.avgSleep7d.toFixed(1)} hrs indicates a build-up of sleep debt.`);
      recs.push("Prioritize a full 8 hours of sleep tonight to pay down recovery debt.");
    }
    if (t.avgSteps7d > 0 && t.avgSteps7d < 8000) {
      critiqueParts.push(`Weekly walking volume is running low at an average of ${Math.round(t.avgSteps7d).toLocaleString()} steps.`);
    }
    if (t.weightChange7d && Math.abs(t.weightChange7d) >= 0.1) {
      const sign = t.weightChange7d > 0 ? '+' : '';
      critiqueParts.push(`Your body weight trended at ${sign}${t.weightChange7d.toFixed(1)}kg over the past 7 days.`);
    }
  }


  // Workout analysis
  if (workoutCount > 0) {
    critiqueParts.push(`Great job logging a workout split today. You executed ${workoutCount} exercises, signaling a solid focus on muscle load.`);
    recs.push("Continue sticking to your current workout split for muscle consistency.");
  } else {
    critiqueParts.push("Today was a rest day. Active recovery is crucial for rebuilding muscle fibers and restoring energy stores.");
    recs.push("Focus on gentle mobility or stretching tomorrow to prep for your next lift.");
  }

  // Nutrition analysis
  if (cals > 0) {
    const diff = Math.abs(cals - targetCals);
    if (diff < 200) {
      score += 1;
      critiqueParts.push("Your calorie intake was spot on today, aligning closely with your target calorie limit.");
    } else if (cals > targetCals + 200) {
      score -= 1;
      critiqueParts.push(`Your calories (${cals} kcal) exceeded your target limit (${targetCals} kcal). Ensure these extra calories are fueled by quality protein and carbs.`);
      recs.push("Tomorrow, aim to reduce processed sugars and control snack portions.");
    } else {
      critiqueParts.push(`Your calories (${cals} kcal) were significantly below your target (${targetCals} kcal). Ensure you aren't under-fueling, especially on workout days.`);
      recs.push("Plan a healthy snack between meals tomorrow to hit your base metabolic requirements.");
    }
  } else {
    critiqueParts.push("No nutrition or calorie logs recorded for today. Tracking meals helps keep calorie balances transparent.");
    recs.push("Log your first meal tomorrow as soon as you eat to build the habit.");
  }

  if (protein > 0) {
    if (protein >= 100) {
      score += 1;
      critiqueParts.push(`Excellent protein intake (${protein}g) which will facilitate optimal protein synthesis and muscle recovery.`);
    } else {
      critiqueParts.push(`Your protein intake (${protein}g) is a bit low. Muscles need adequate amino acids, especially on active training days.`);
      recs.push("Incorporate a lean protein source (egg whites, chicken breast, tofu, or whey) with your post-workout meal tomorrow.");
    }
  }

  // Steps analysis
  if (steps >= 10000) {
    score += 1;
    critiqueParts.push(`Fantastic walking volume with ${steps.toLocaleString()} steps today! This level of NEAT (non-exercise activity thermogenesis) keeps cardiovascular health high.`);
  } else if (steps >= 7000) {
    critiqueParts.push(`You completed ${steps.toLocaleString()} steps. Good baseline movement, but there is room to grow.`);
    recs.push("Take a brief 10-minute walk after lunch or dinner tomorrow to hit 10k steps.");
  } else if (steps > 0) {
    score -= 1;
    critiqueParts.push(`Step count was low today at ${steps.toLocaleString()} steps. High sedentary time can slow metabolic rates.`);
    recs.push("Park further away or stand up for 5 minutes every hour tomorrow.");
  }

  // Sleep analysis
  if (sleep >= 7 && sleep <= 9) {
    score += 1;
    critiqueParts.push(`Logged ${sleep} hours of sleep. Excellent. Growth hormone release peaks during deep sleep cycles.`);
  } else if (sleep > 0) {
    score -= 1;
    critiqueParts.push(`Sleep was short at ${sleep} hours. Inadequate sleep elevates cortisol, which increases water retention and impairs recovery.`);
    recs.push("Set a screen-free wind-down routine 30 minutes before bed tonight.");
  }

  // Water analysis
  if (water >= 8) {
    critiqueParts.push("Hydration level is optimal. Keeping cells hydrated keeps energy production high.");
  } else if (water > 0) {
    critiqueParts.push(`You logged ${water} cups of water. Hydration is vital for joint lubrication and nutrient delivery.`);
    recs.push("Keep a filled water bottle on your desk tomorrow and take regular sips.");
  }

  // Adjust score boundaries
  score = Math.max(1, Math.min(10, score));
  
  if (score >= 9) rating = "High Adherence";
  else if (score >= 7) rating = "Balanced Day";
  else if (score >= 5) rating = "Moderate Adherence";
  else rating = "Rest & Reset Needed";

  // Default recommendations fallback if array empty
  if (recs.length === 0) {
    recs = [
      "Log your workouts and nutrition daily to unlock custom fitness coaching.",
      "Aim for at least 8,000 steps and 8 cups of water tomorrow.",
      "Get 7-8 hours of high-quality sleep tonight."
    ];
  }

  return {
    rating,
    score,
    critique: critiqueParts.join(' '),
    recommendation: recs.map(r => `- ${r}`).join('\n')
  };
}
