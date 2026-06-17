// =============================================================
// ALIGN v2 — Gemini AI Coach
// Structured coaching with personality, weekly/monthly reviews,
// and rules-engine fallback
// =============================================================

import { getState, setState, getDayLog, getWeeklyTrends, computeDailyScore, getActiveBurn, getGeminiKey } from '../state.js';

// ─── Coach Personalities ───

const PERSONALITIES = {
  elite: 'You are an elite performance coach. Be direct, data-driven, and demanding. Call out weaknesses bluntly. Use short punchy sentences. Think like a world-class athletic coach.',
  supportive: 'You are a warm, encouraging wellness coach. Celebrate every small win. Be empathetic about setbacks. Use an uplifting tone. Think like a supportive friend who happens to be a health expert.',
  hardcore: 'You are a no-excuses drill sergeant coach. Be brutally honest. Use military-style motivation. Zero tolerance for mediocrity. If targets are missed, say so clearly.',
  mindfulness: 'You are a mindful wellness guide. Focus on balance, sustainability, and mental health. Encourage self-compassion. Relate health metrics to overall wellbeing, not just numbers.',
};

// ─── Structured Output Schema ───

const DAILY_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number', description: 'Daily score 0-100' },
    recoveryNeed: { type: 'string', enum: ['low', 'moderate', 'high'] },
    headline: { type: 'string', description: 'One-line summary of the day' },
    critique: { type: 'string', description: '1-2 sentence honest critique' },
    wins: { type: 'array', items: { type: 'string' }, description: 'List of things done well' },
    missedOpportunities: { type: 'array', items: { type: 'string' }, description: 'What could be improved' },
    tomorrowPriorities: { type: 'array', items: { type: 'string' }, description: 'Top 3 focus areas for tomorrow' },
    source: { type: 'string', enum: ['gemini', 'rules-engine'] },
  },
};

const WEEKLY_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    weeklyScore: { type: 'number' },
    positiveTrends: { type: 'array', items: { type: 'string' } },
    negativeTrends: { type: 'array', items: { type: 'string' } },
    mostImprovedBehaviour: { type: 'string' },
    mostNeglectedBehaviour: { type: 'string' },
    focusAreasNextWeek: { type: 'array', items: { type: 'string' } },
    source: { type: 'string' },
  },
};

// ─── Public API ───

/**
 * Generate a daily AI review.
 * Uses cached version if available; calls Gemini or falls back to rules engine.
 */
export async function getDailyReview(forceRefresh = false) {
  const dateStr = getState('dateStr');
  const day = getDayLog(dateStr);

  // Check cache
  if (!forceRefresh && day.aiReview && day.aiReview.score !== undefined) {
    return day.aiReview;
  }

  const apiKey = getGeminiKey();
  if (apiKey) {
    try {
      const review = await callGeminiDailyReview(apiKey, dateStr);
      if (review && typeof review.score === 'number') {
        review.source = 'gemini';
        cacheReview(dateStr, review);
        return review;
      }
    } catch (e) {
      console.warn('Gemini daily review failed, using rules engine:', e.message);
    }
  }

  // Fallback: rules engine
  const review = generateRulesReview(dateStr);
  review.source = 'rules-engine';
  cacheReview(dateStr, review);
  return review;
}

/**
 * Generate a weekly review.
 */
export async function getWeeklyReview() {
  const apiKey = getGeminiKey();
  const dateStr = getState('dateStr');

  if (apiKey) {
    try {
      return await callGeminiWeeklyReview(apiKey, dateStr);
    } catch (e) {
      console.warn('Gemini weekly review failed:', e.message);
    }
  }

  return generateRulesWeeklyReview(dateStr);
}

/**
 * Generate a monthly review.
 */
export async function getMonthlyReview() {
  const apiKey = getGeminiKey();
  const dateStr = getState('dateStr');

  if (apiKey) {
    try {
      return await callGeminiMonthlyReview(apiKey, dateStr);
    } catch (e) {
      console.warn('Gemini monthly review failed:', e.message);
    }
  }

  return generateRulesMonthlyReview(dateStr);
}

/**
 * Send a chat message to the AI coach.
 * @param {string} message - User message
 * @param {Array} history - Previous messages [{role, text}]
 * @returns {{text: string, source: string}}
 */
export async function sendCoachChat(message, history = []) {
  const apiKey = getGeminiKey();
  const dateStr = getState('dateStr');
  const day = getDayLog(dateStr);
  const profile = getState('profile') || {};
  const trends = getWeeklyTrends(dateStr);
  const personality = PERSONALITIES[profile.coachPersonality || 'supportive'];

  if (apiKey) {
    try {
      const systemPrompt = `${personality}

You are the AI coach for "Align", a personal health tracking app. Today's data:
- Steps: ${day.steps || 0} / ${profile.targetSteps || 10000}
- Calories: ${day.calories || 0} / ${profile.targetCalories || 2000}
- Protein: ${day.protein || 0}g / ${profile.targetProtein || 150}g
- Water: ${day.water || 0} / ${profile.targetWater || 8} cups
- Sleep: ${day.sleep || 0}h / ${profile.targetSleep || 8}h
- Workouts today: ${(day.workouts || []).length}
- 7-day avg steps: ${trends.avgSteps}, sleep: ${trends.avgSleep}h

User name: ${profile.name || 'User'}

Respond naturally and helpfully. Keep responses concise (2-4 sentences). Be specific to their data.`;

      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I\'m your Align coach. How can I help?' }] },
      ];

      // Add conversation history (last 8)
      const recentHistory = history.slice(-8);
      for (const msg of recentHistory) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }

      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await callGeminiAPI(apiKey, contents);
      return { text: response, source: 'gemini' };
    } catch (e) {
      console.warn('Coach chat failed:', e.message);
    }
  }

  // Fallback
  return { text: generateRulesChatResponse(message, day, profile), source: 'rules-engine' };
}

// ─── Gemini API Calls ───

async function callGeminiAPI(apiKey, contents, jsonMode = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  if (jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  if (jsonMode) {
    return JSON.parse(text);
  }
  return text;
}

async function callGeminiDailyReview(apiKey, dateStr) {
  const profile = getState('profile') || {};
  const personality = PERSONALITIES[profile.coachPersonality || 'supportive'];
  const logsContext = buildMultiDayContext(dateStr, 7);

  const prompt = `${personality}

You are the AI coach for "Align" health tracker. Analyze this user's data and generate a daily review.

User Profile:
- Name: ${profile.name || 'User'}
- Target: ${profile.targetCalories || 2000} kcal, ${profile.targetProtein || 150}g protein, ${profile.targetSteps || 10000} steps, ${profile.targetWater || 8} cups water, ${profile.targetSleep || 8}h sleep

${logsContext}

Return a JSON object with these EXACT fields:
- score: number 0-100 (overall daily score)
- recoveryNeed: "low" | "moderate" | "high"
- headline: string (one punchy sentence about today)
- critique: string (1-2 sentence honest critique)
- wins: string[] (2-3 things done well)
- missedOpportunities: string[] (1-3 things to improve)
- tomorrowPriorities: string[] (top 3 priorities)`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  return await callGeminiAPI(apiKey, contents, true);
}

async function callGeminiWeeklyReview(apiKey, dateStr) {
  const profile = getState('profile') || {};
  const personality = PERSONALITIES[profile.coachPersonality || 'supportive'];
  const logsContext = buildMultiDayContext(dateStr, 7);

  const prompt = `${personality}

Analyze this user's 7-day data and generate a weekly review.

${logsContext}

Return a JSON object with:
- weeklyScore: number 0-100
- positiveTrends: string[] (2-3 positive trends)
- negativeTrends: string[] (1-3 negative trends)
- mostImprovedBehaviour: string
- mostNeglectedBehaviour: string
- focusAreasNextWeek: string[] (3 focus areas)`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const result = await callGeminiAPI(apiKey, contents, true);
  result.source = 'gemini';
  return result;
}

async function callGeminiMonthlyReview(apiKey, dateStr) {
  const profile = getState('profile') || {};
  const personality = PERSONALITIES[profile.coachPersonality || 'supportive'];
  const logsContext = buildMultiDayContext(dateStr, 30);

  const prompt = `${personality}

Analyze this user's 30-day data and generate a comprehensive monthly review.

${logsContext}

Return a JSON object with:
- monthlyScore: number 0-100
- overallAssessment: string (3-4 sentence overview)
- strongestArea: string
- weakestArea: string
- keyCorrelations: string[] (patterns you notice, e.g. "sleep quality drops after late workouts")
- strategicRecommendations: string[] (3-5 strategic suggestions for next month)`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const result = await callGeminiAPI(apiKey, contents, true);
  result.source = 'gemini';
  return result;
}

// ─── Multi-Day Context Builder ───

function buildMultiDayContext(baseDateStr, numDays) {
  const logs = getState('logs') || {};
  const baseDate = new Date(baseDateStr + 'T12:00:00');
  const lines = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const day = logs[key];

    if (!day) {
      lines.push(`${key}: No data logged`);
      continue;
    }

    const parts = [];
    if (day.steps > 0) parts.push(`${day.steps} steps`);
    if (day.calories > 0) parts.push(`${day.calories} kcal`);
    if (day.protein > 0) parts.push(`${day.protein}g protein`);
    if (day.water > 0) parts.push(`${day.water} cups water`);
    if (day.sleep > 0) parts.push(`${day.sleep}h sleep`);
    if (day.weight > 0) parts.push(`${day.weight}kg`);
    if (day.workouts?.length > 0) parts.push(`${day.workouts.length} exercises`);
    if (day.habitsCompleted?.length > 0) parts.push(`${day.habitsCompleted.length} habits`);

    const label = i === 0 ? `${key} (TODAY)` : key;
    lines.push(`${label}: ${parts.length > 0 ? parts.join(', ') : 'Minimal data'}`);
  }

  return `Daily Logs (last ${numDays} days):\n${lines.join('\n')}`;
}

// ─── Rules Engine Fallback ───

function generateRulesReview(dateStr) {
  const day = getDayLog(dateStr);
  const profile = getState('profile') || {};
  const trends = getWeeklyTrends(dateStr);
  const score = computeDailyScore(day);

  const wins = [];
  const missed = [];
  const priorities = [];

  const stepGoal = profile.targetSteps || 10000;
  const calGoal = profile.targetCalories || 2000;
  const waterGoal = profile.targetWater || 8;
  const sleepGoal = profile.targetSleep || 8;
  const proteinGoal = profile.targetProtein || 150;

  // Steps
  if (day.steps >= stepGoal) wins.push(`Hit step goal: ${day.steps.toLocaleString()} steps`);
  else if (day.steps > 0) missed.push(`Steps at ${Math.round((day.steps / stepGoal) * 100)}% of target`);
  else priorities.push('Get moving — log some steps');

  // Sleep
  if (day.sleep >= sleepGoal) wins.push(`Solid sleep: ${day.sleep}h`);
  else if (day.sleep >= 6) missed.push(`Sleep was ${day.sleep}h — aim for ${sleepGoal}h`);
  else if (day.sleep > 0) missed.push(`Only ${day.sleep}h sleep — recovery will suffer`);
  else priorities.push('Log your sleep');

  // Protein
  if (day.protein >= proteinGoal) wins.push(`Protein goal hit: ${day.protein}g`);
  else if (day.protein > 0) missed.push(`Protein at ${day.protein}g of ${proteinGoal}g target`);

  // Water
  if (day.water >= waterGoal) wins.push(`Hydration on point: ${day.water} cups`);
  else if (day.water > 0) missed.push(`Water at ${day.water}/${waterGoal} cups`);

  // Workouts
  if (day.workouts?.length > 0) wins.push('Training session logged');

  // Recovery need
  let recoveryNeed = 'low';
  if (day.sleep < 6 || (trends.avgSleep > 0 && trends.avgSleep < 6.5)) recoveryNeed = 'high';
  else if (day.sleep < 7) recoveryNeed = 'moderate';

  // Headline
  let headline;
  if (score >= 80) headline = 'Excellent execution today.';
  else if (score >= 60) headline = 'Solid day with room to push further.';
  else if (score >= 40) headline = 'Decent effort — a few gaps to address.';
  else if (score > 0) headline = 'Light day — tomorrow is an opportunity.';
  else headline = 'No data logged yet. Start tracking to get insights.';

  // Critique
  const critique = missed.length > 0
    ? `Main gap: ${missed[0].toLowerCase()}.`
    : wins.length > 0
      ? 'Strong day across the board — maintain this consistency.'
      : 'Start logging data to unlock your daily review.';

  // Tomorrow priorities
  if (priorities.length === 0) {
    if (day.sleep < sleepGoal) priorities.push(`Target ${sleepGoal}h sleep tonight`);
    if (day.protein < proteinGoal) priorities.push('Front-load protein at breakfast');
    if (day.steps < stepGoal) priorities.push('Plan a walk or active commute');
  }
  while (priorities.length < 3) priorities.push('Maintain current habits');

  return {
    score,
    recoveryNeed,
    headline,
    critique,
    wins: wins.slice(0, 3),
    missedOpportunities: missed.slice(0, 3),
    tomorrowPriorities: priorities.slice(0, 3),
  };
}

function generateRulesWeeklyReview(dateStr) {
  const trends = getWeeklyTrends(dateStr);
  const profile = getState('profile') || {};

  const positiveTrends = [];
  const negativeTrends = [];

  if (trends.avgSteps >= (profile.targetSteps || 10000) * 0.8) positiveTrends.push('Consistent step count');
  else negativeTrends.push('Step count below target most days');

  if (trends.avgSleep >= 7) positiveTrends.push('Good sleep consistency');
  else negativeTrends.push('Sleep averaging below 7h');

  if (trends.weightChange < 0 && profile.goalWeight < (profile.currentWeight || 100)) {
    positiveTrends.push('Weight trending in right direction');
  }

  return {
    weeklyScore: Math.round((trends.avgSteps / (profile.targetSteps || 10000)) * 30 + (trends.avgSleep / 8) * 30 + 40),
    positiveTrends: positiveTrends.length > 0 ? positiveTrends : ['Keep logging consistently'],
    negativeTrends: negativeTrends.length > 0 ? negativeTrends : ['No major concerns'],
    mostImprovedBehaviour: positiveTrends[0] || 'Consistency',
    mostNeglectedBehaviour: negativeTrends[0] || 'None critical',
    focusAreasNextWeek: ['Maintain sleep schedule', 'Hit protein daily', 'Stay active'],
    source: 'rules-engine',
  };
}

function generateRulesMonthlyReview(dateStr) {
  return {
    monthlyScore: 65,
    overallAssessment: 'You\'ve been logging consistently this month. Focus on building more data to unlock deeper patterns.',
    strongestArea: 'Consistency of logging',
    weakestArea: 'Need more days of data for meaningful analysis',
    keyCorrelations: ['Log at least 14 days of data for correlation analysis'],
    strategicRecommendations: [
      'Set a daily logging reminder',
      'Focus on one metric improvement at a time',
      'Review your targets monthly',
    ],
    source: 'rules-engine',
  };
}

function generateRulesChatResponse(message, day, profile) {
  const lower = message.toLowerCase();

  if (lower.includes('sleep')) {
    return day.sleep > 0
      ? `You got ${day.sleep}h of sleep. ${day.sleep >= 7 ? 'That\'s solid!' : 'Try to aim for 7-8h for optimal recovery.'}`
      : 'You haven\'t logged sleep yet today. Try the input bar to log it.';
  }

  if (lower.includes('protein') || lower.includes('food') || lower.includes('eat')) {
    return day.protein > 0
      ? `You've had ${day.protein}g protein so far (${Math.round((day.protein / (profile.targetProtein || 150)) * 100)}% of target). ${day.protein < (profile.targetProtein || 150) ? 'Try adding a protein-rich meal.' : 'Great job hitting your goal!'}`
      : 'No meals logged yet. Type something like "had chicken rice" in the input bar.';
  }

  if (lower.includes('steps') || lower.includes('walk')) {
    return day.steps > 0
      ? `You're at ${day.steps.toLocaleString()} steps. ${day.steps >= (profile.targetSteps || 10000) ? 'Target hit!' : `${((profile.targetSteps || 10000) - day.steps).toLocaleString()} to go.`}`
      : 'No steps logged yet today.';
  }

  if (lower.includes('how') && (lower.includes('doing') || lower.includes('day'))) {
    const score = computeDailyScore(day);
    return `Your daily score is ${score}/100. ${score >= 70 ? 'You\'re having a great day!' : score >= 40 ? 'Decent progress — keep pushing.' : 'There\'s room to improve. What can you log next?'}`;
  }

  return 'I can help with sleep, nutrition, steps, and workout questions. Try asking "How am I doing today?" or "How\'s my protein?". For full AI coaching, add your Gemini API key in Settings.';
}

// ─── Helpers ───

function cacheReview(dateStr, review) {
  const logs = getState('logs') || {};
  if (logs[dateStr]) {
    logs[dateStr].aiReview = review;
    setState('logs', { ...logs });
  }
}
