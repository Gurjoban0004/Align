// =============================================================
// ALIGN v2 — Living Dashboard
// Time-aware narrative interface that morphs throughout the day
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import {
  getState, getDayLog, computeDailyScore,
  getGreeting, getWeeklyTrends, getActiveBurn,
} from '../state.js';
import { createMetricRing } from '../components/metric-ring.js';
import { createInputBar } from '../components/input-bar.js';
import { sparkline, lineChart, barChart, donutChart } from '../components/charts.js';
import { getDailyReview, sendCoachChat } from '../ai/gemini.js';

/**
 * Render the dashboard view into the container.
 */
export function renderDashboard(container) {
  const dateStr = getState('dateStr');
  const timePeriod = getState('timePeriod');
  const day = getDayLog(dateStr);
  const profile = getState('profile') || {};
  const habits = getState('habits') || [];
  const trends = getWeeklyTrends(dateStr);
  const score = computeDailyScore(day);

  const page = el('div', { class: 'dashboard-page view-enter' });

  // ─── Mobile Header ───
  const mobileHeader = el('div', { class: 'mobile-header' },
    el('div', { class: 'mobile-header-left' },
      el('strong', { class: 'mobile-greeting' }, getGreeting()),
      el('span', { class: 'mobile-date' }, formatLongDate(dateStr))
    ),
    el('div', { class: 'mobile-header-right' },
      createMiniScoreRing(score)
    )
  );
  page.appendChild(mobileHeader);

  // ─── Weekly Calendar Strip ───
  page.appendChild(createWeekStrip(dateStr));

  // ─── Narrative Section (time-aware) ───
  const narrative = createNarrativeSection(timePeriod, day, profile, trends, score);
  page.appendChild(narrative);

  // ─── Metrics Grid ───
  const metricsGrid = createMetricsGrid(day, profile);
  page.appendChild(metricsGrid);

  // ─── Insight Cards (static for now — Phase 3 will make these dynamic) ───
  const insightSection = createInsightSection(day, profile, trends);
  if (insightSection) page.appendChild(insightSection);

  // ─── AI Review Panel ───
  const reviewContainer = el('div', { id: 'ai-review-container' });
  page.appendChild(reviewContainer);
  loadAIReview(reviewContainer);

  // ─── Coach Chat ───
  page.appendChild(createCoachChat());

  // ─── Today's Activity Feed ───
  const feed = createActivityFeed(day);
  if (feed) page.appendChild(feed);

  // ─── Conversational Input Bar ───
  const inputBar = createInputBar(() => {
    // Re-render dashboard on log applied
    container.replaceChildren();
    renderDashboard(container);
  });
  page.appendChild(inputBar);

  container.appendChild(page);
}

// ─── Narrative Section ───

function createNarrativeSection(timePeriod, day, profile, trends, score) {
  const section = el('section', { class: 'narrative-section' });

  const headline = getNarrativeHeadline(timePeriod, day, profile, score);
  const body = getNarrativeBody(timePeriod, day, profile, trends);

  section.appendChild(el('p', { class: 'narrative-headline' }, headline));

  if (body) {
    section.appendChild(el('p', { class: 'narrative-body' }, body));
  }

  return section;
}

function getNarrativeHeadline(period, day, profile, score) {
  const workouts = day.workouts || [];
  const hasWorkout = workouts.length > 0 && !workouts[0]?.restDay;

  switch (period) {
    case 'morning': {
      if (day.sleep > 0) {
        const quality = day.sleep >= 7.5 ? 'solid' : day.sleep >= 6 ? 'decent' : 'short';
        return `You got ${day.sleep}h of ${quality} sleep. Let's make today count.`;
      }
      return 'Good morning. Log your sleep to start your day right.';
    }
    case 'midday': {
      if (day.steps > 5000 || day.calories > 0 || hasWorkout) {
        const parts = [];
        if (hasWorkout) parts.push(`workout done`);
        if (day.steps > 0) parts.push(`${day.steps.toLocaleString()} steps`);
        if (day.calories > 0) parts.push(`${day.calories} kcal logged`);
        return `Day in motion — ${parts.join(', ')}.`;
      }
      return 'Your day is underway. What have you been up to?';
    }
    case 'evening': {
      if (score >= 70) {
        return `Strong day forming — you're at ${score}/100.`;
      } else if (score >= 40) {
        return `Decent progress — sitting at ${score}/100. Still time to close gaps.`;
      }
      return `Your daily score is ${score}/100. A few entries could lift it.`;
    }
    case 'night': {
      if (score >= 80) {
        return `Excellent day — ${score}/100. Well executed.`;
      } else if (score >= 50) {
        return `Today scored ${score}/100. Some wins, some gaps. Review below.`;
      }
      return `Today's score: ${score}/100. Tomorrow is a reset.`;
    }
    default:
      return 'Welcome back to Align.';
  }
}

function getNarrativeBody(period, day, profile, trends) {
  // Add contextual details based on what's interesting
  const parts = [];

  if (period === 'morning' && trends.latestWeight) {
    const dir = trends.weightChange > 0 ? 'up' : trends.weightChange < 0 ? 'down' : 'flat';
    if (trends.weightChange !== 0) {
      parts.push(`Weight is trending ${dir} ${Math.abs(trends.weightChange)}kg this week.`);
    }
  }

  if (period === 'midday' || period === 'evening') {
    const proteinGoal = profile.targetProtein || 150;
    if (day.protein > 0 && day.protein < proteinGoal * 0.5) {
      parts.push(`Protein at ${day.protein}g — you'll want to front-load the rest of the day.`);
    }
  }

  if (period === 'evening' || period === 'night') {
    const stepGoal = profile.targetSteps || 10000;
    if (day.steps > 0 && day.steps < stepGoal * 0.7) {
      const remaining = stepGoal - day.steps;
      parts.push(`${remaining.toLocaleString()} steps to hit your daily target.`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

// ─── Mini Score Ring (mobile header) ───

function createMiniScoreRing(score) {
  const color = score >= 70 ? 'var(--success)' :
                score >= 40 ? 'var(--accent-amber)' :
                'var(--error)';

  return el('div', { class: 'mini-score' },
    createMetricRing({
      value: score,
      max: 100,
      color,
      size: 52,
      strokeWidth: 5,
      label: String(score),
      trackColor: 'var(--surface-soft)',
    })
  );
}

// ─── Weekly Calendar Strip ───

function createWeekStrip(selectedDate) {
  const strip = el('div', { class: 'week-strip' });
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const selected = new Date(selectedDate + 'T12:00:00');

  // Show 7 days centered around today
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const logs = getState('logs') || {};
  const habits = getState('habits') || [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const isToday = dStr === todayStr;
    const isSelected = dStr === selectedDate;
    const dayLog = logs[dStr];

    // Completion dots
    const dotCount = 3;
    let filledDots = 0;
    if (dayLog) {
      if (dayLog.steps > 5000) filledDots++;
      if (dayLog.sleep > 5) filledDots++;
      if ((dayLog.habitsCompleted || []).length > 0) filledDots++;
    }

    const dayBtn = el('button', {
      class: `week-day-btn${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`,
      onClick: () => {
        document.dispatchEvent(new CustomEvent('align:dateChange', { detail: { date: dStr } }));
      },
      dataset: { date: dStr },
    },
      el('span', { class: 'week-day-name' }, dayNames[i]),
      el('span', { class: 'week-day-number' }, String(d.getDate())),
      el('div', { class: 'week-day-dots' },
        ...Array.from({ length: dotCount }, (_, j) =>
          el('span', { class: `week-dot${j < filledDots ? ' filled' : ''}` })
        )
      )
    );

    strip.appendChild(dayBtn);
  }

  return el('div', { class: 'week-strip-container' }, strip);
}

// ─── Metrics Grid ───

function createMetricsGrid(day, profile) {
  const stepGoal = profile.targetSteps || 10000;
  const calGoal = profile.targetCalories || 2000;
  const waterGoal = profile.targetWater || 8;
  const sleepGoal = profile.targetSleep || 8;
  const proteinGoal = profile.targetProtein || 150;

  // Collect 7-day spark data
  const dateStr = getState('dateStr');
  const logs = getState('logs') || {};
  const sparkSteps = [], sparkCal = [], sparkProtein = [], sparkWater = [], sparkSleep = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dLog = logs[key] || {};
    sparkSteps.push(dLog.steps || 0);
    sparkCal.push(Math.max(0, (dLog.calories || 0) - getActiveBurn(dLog)));
    sparkProtein.push(dLog.protein || 0);
    sparkWater.push(dLog.water || 0);
    sparkSleep.push(dLog.sleep || 0);
  }

  const grid = el('div', { class: 'metrics-grid stagger' });

  // Steps
  grid.appendChild(createMetricCard({
    label: 'Steps',
    value: day.steps || 0,
    max: stepGoal,
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v),
    suffix: `/ ${stepGoal >= 1000 ? (stepGoal / 1000) + 'k' : stepGoal}`,
    color: 'var(--accent-teal)',
    iconName: 'footprints',
    sparkData: sparkSteps,
  }));

  // Calories
  const netCal = Math.max(0, (day.calories || 0) - getActiveBurn(day));
  grid.appendChild(createMetricCard({
    label: 'Net Calories',
    value: netCal,
    max: calGoal,
    format: (v) => v.toLocaleString(),
    suffix: `/ ${calGoal.toLocaleString()} kcal`,
    color: 'var(--accent-coral)',
    iconName: 'flame',
    sparkData: sparkCal,
  }));

  // Protein
  grid.appendChild(createMetricCard({
    label: 'Protein',
    value: day.protein || 0,
    max: proteinGoal,
    format: (v) => `${v}g`,
    suffix: `/ ${proteinGoal}g`,
    color: 'var(--primary)',
    iconName: 'target',
    sparkData: sparkProtein,
  }));

  // Water
  grid.appendChild(createMetricCard({
    label: 'Water',
    value: day.water || 0,
    max: waterGoal,
    format: (v) => String(v),
    suffix: `/ ${waterGoal} cups`,
    color: 'var(--accent-lavender)',
    iconName: 'water',
    sparkData: sparkWater,
  }));

  // Sleep
  grid.appendChild(createMetricCard({
    label: 'Sleep',
    value: day.sleep || 0,
    max: sleepGoal,
    format: (v) => v > 0 ? `${v}h` : '—',
    suffix: v => v > 0 ? `/ ${sleepGoal}h` : 'Not logged',
    color: 'var(--accent-amber)',
    iconName: 'moon',
    sparkData: sparkSleep,
  }));

  // Habits
  const habitsCompleted = (day.habitsCompleted || []).length;
  const habitsTotal = (getState('habits') || []).length || 1;
  grid.appendChild(createMetricCard({
    label: 'Habits',
    value: habitsCompleted,
    max: habitsTotal,
    format: (v) => `${v}/${habitsTotal}`,
    suffix: 'completed',
    color: 'var(--accent-sage)',
    iconName: 'checkSquare',
  }));

  return el('section', { class: 'metrics-section' },
    el('div', { class: 'section-header' },
      el('h3', {}, 'Today\'s Pulse')
    ),
    grid
  );
}

function createMetricCard({ label, value, max, format, suffix, color, iconName, sparkData }) {
  const percent = Math.min(100, Math.round((value / (max || 1)) * 100));
  const formattedValue = typeof format === 'function' ? format(value) : String(value);
  const suffixText = typeof suffix === 'function' ? suffix(value) : suffix;

  const ring = createMetricRing({
    value,
    max,
    color,
    size: 56,
    strokeWidth: 5,
    trackColor: 'var(--surface-soft)',
  });

  const card = el('div', { class: 'metric-card' },
    el('div', { class: 'metric-card-top' },
      el('div', { class: 'metric-card-icon', style: { color } },
        icon(ICONS[iconName], { size: 16 })
      ),
      el('span', { class: 'metric-card-label' }, label)
    ),
    el('div', { class: 'metric-card-body' },
      ring,
      el('div', { class: 'metric-card-text' },
        el('strong', { class: 'metric-value' }, formattedValue),
        el('span', { class: 'metric-suffix' }, suffixText)
      )
    )
  );

  // Sparkline (7-day)
  if (sparkData && sparkData.length > 1) {
    card.appendChild(el('div', { style: { marginTop: '8px' } },
      sparkline(sparkData, { width: 100, height: 24, color })
    ));
  }

  return card;
}

// ─── Insight Section ───

function createInsightSection(day, profile, trends) {
  const insights = generateStaticInsights(day, profile, trends);
  if (insights.length === 0) return null;

  const section = el('section', { class: 'insight-section' },
    el('div', { class: 'section-header' },
      el('div', { class: 'section-header-label' },
        icon(ICONS.sparkles, { size: 16 }),
        el('h4', {}, 'Insights')
      )
    )
  );

  const list = el('div', { class: 'insight-list stagger' });
  insights.forEach((insight) => {
    const priorityClass = insight.priority === 'urgent' ? 'insight-urgent' :
                          insight.priority === 'timely' ? 'insight-timely' : 'insight-curious';

    const card = el('div', { class: `insight-card ${priorityClass}` },
      el('p', { class: 'insight-text' }, insight.text),
      insight.action ? el('button', {
        class: 'insight-action',
        onClick: insight.action,
      }, insight.actionLabel || 'Take action') : null
    );
    list.appendChild(card);
  });

  section.appendChild(list);
  return section;
}

function generateStaticInsights(day, profile, trends) {
  const insights = [];

  // Sleep not logged
  if (!day.sleep || day.sleep === 0) {
    insights.push({
      text: 'You haven\'t logged sleep yet. Sleep data powers your recovery insights.',
      priority: 'timely',
      actionLabel: 'Log now',
      action: () => {
        const input = document.getElementById('align-input');
        if (input) { input.focus(); input.placeholder = 'How many hours did you sleep?'; }
      },
    });
  }

  // Protein deficit
  const protGoal = profile.targetProtein || 150;
  if (day.protein > 0 && day.protein < protGoal * 0.5 && getState('timePeriod') !== 'morning') {
    insights.push({
      text: `Protein at ${day.protein}g (${Math.round((day.protein / protGoal) * 100)}% of target). Front-load protein in your next meal.`,
      priority: 'timely',
    });
  }

  // Sleep debt detection
  if (trends.avgSleep > 0 && trends.avgSleep < 6.5) {
    insights.push({
      text: `Your 7-day sleep average is ${trends.avgSleep}h — accumulating sleep debt impacts recovery and focus.`,
      priority: 'urgent',
    });
  }

  // Weight trend
  if (trends.weightChange !== 0 && trends.latestWeight) {
    const dir = trends.weightChange > 0 ? 'gained' : 'lost';
    insights.push({
      text: `You've ${dir} ${Math.abs(trends.weightChange)}kg this week. Current: ${trends.latestWeight.toFixed(1)}kg.`,
      priority: 'curious',
    });
  }

  return insights.slice(0, 3); // Max 3 insights
}

// ─── Activity Feed ───

function createActivityFeed(day) {
  const entries = [];

  if (day.workouts && day.workouts.length > 0) {
    day.workouts.forEach((w) => {
      const name = w.splitName || w.name || 'Workout';
      const detail = w.weight ? `${w.weight}kg × ${w.sets}×${w.reps}` : '';
      entries.push({ icon: 'dumbbell', text: name, detail, time: 'Today' });
    });
  }

  if (day.meals && day.meals.length > 0) {
    day.meals.forEach((m) => {
      entries.push({
        icon: 'utensils',
        text: m.title || 'Meal',
        detail: `${m.calories || 0} kcal`,
        time: 'Today',
      });
    });
  }

  if (day.pagesRead > 0) {
    entries.push({ icon: 'book', text: `Read ${day.pagesRead} pages`, detail: '', time: 'Today' });
  }

  if (entries.length === 0) return null;

  const section = el('section', { class: 'feed-section' },
    el('div', { class: 'section-header' },
      el('h4', {}, 'Activity')
    )
  );

  const list = el('div', { class: 'feed-list' });
  entries.forEach((entry) => {
    list.appendChild(el('div', { class: 'feed-item' },
      el('div', { class: 'feed-item-icon' }, icon(ICONS[entry.icon], { size: 16 })),
      el('div', { class: 'feed-item-content' },
        el('span', { class: 'feed-item-text' }, entry.text),
        entry.detail ? el('span', { class: 'feed-item-detail' }, entry.detail) : null
      )
    ));
  });

  section.appendChild(list);
  return section;
}

// ─── Helpers ───

function formatLongDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = date.getDate();
  const suffix = [1, 21, 31].includes(day) ? 'st' : [2, 22].includes(day) ? 'nd' : [3, 23].includes(day) ? 'rd' : 'th';
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${day}${suffix}`;
}

// ─── AI Review Panel ───

async function loadAIReview(container) {
  // Show skeleton
  container.replaceChildren(
    el('div', { class: 'ai-review-panel' },
      el('div', { class: 'skeleton skeleton-heading' }),
      el('div', { class: 'skeleton skeleton-text' }),
      el('div', { class: 'skeleton skeleton-text', style: { width: '45%' } })
    )
  );

  try {
    const review = await getDailyReview();
    renderReviewPanel(container, review);
  } catch (e) {
    console.error('AI review failed:', e);
    container.replaceChildren(
      el('div', { class: 'ai-review-panel fade-in' },
        el('p', { class: 'ai-review-critique' }, 'Unable to generate review. Log more data to unlock insights.')
      )
    );
  }
}

function renderReviewPanel(container, review) {
  const sourceClass = review.source === 'gemini' ? 'gemini' : '';

  const panel = el('div', { class: 'ai-review-panel fade-in' },
    // Header
    el('div', { class: 'ai-review-header' },
      el('div', { class: 'ai-review-title' },
        icon(ICONS.brain, { size: 18 }),
        el('span', {}, 'Daily Review')
      ),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { class: `ai-source-badge ${sourceClass}` }, review.source || 'rules'),
        el('button', {
          class: 'insight-action',
          onClick: () => {
            const reviewContainer = document.getElementById('ai-review-container');
            if (reviewContainer) loadAIReview(reviewContainer);
          },
        }, '↻ Refresh')
      )
    ),
    // Score + Headline
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' } },
      createMetricRing({
        value: review.score || 0,
        max: 100,
        color: review.score >= 70 ? 'var(--success)' : review.score >= 40 ? 'var(--accent-amber)' : 'var(--error)',
        size: 52,
        strokeWidth: 5,
        label: String(review.score || 0),
        trackColor: 'var(--surface-soft)',
      }),
      el('div', {},
        el('p', { class: 'ai-review-headline' }, review.headline || 'Review pending'),
        el('span', { class: 'caption', style: { color: review.recoveryNeed === 'high' ? 'var(--error)' : 'var(--text-muted)' } },
          `Recovery: ${review.recoveryNeed || 'unknown'}`
        )
      )
    ),
    // Critique
    el('p', { class: 'ai-review-critique' }, review.critique || '')
  );

  // Wins
  if (review.wins && review.wins.length > 0) {
    const winsSection = el('div', { class: 'ai-review-section' },
      el('div', { class: 'ai-review-section-title' }, '✦ Wins')
    );
    const list = el('div', { class: 'ai-review-list' });
    review.wins.forEach(w => {
      list.appendChild(el('div', { class: 'ai-review-list-item' },
        icon(ICONS.check, { size: 14, class: '', strokeWidth: '2.5' }),
        el('span', {}, w)
      ));
    });
    winsSection.appendChild(list);
    panel.appendChild(winsSection);
  }

  // Missed Opportunities
  if (review.missedOpportunities && review.missedOpportunities.length > 0) {
    const missedSection = el('div', { class: 'ai-review-section' },
      el('div', { class: 'ai-review-section-title' }, '⚡ Opportunities')
    );
    const list = el('div', { class: 'ai-review-list' });
    review.missedOpportunities.forEach(m => {
      list.appendChild(el('div', { class: 'ai-review-list-item' },
        icon(ICONS.arrowUp, { size: 14 }),
        el('span', {}, m)
      ));
    });
    missedSection.appendChild(list);
    panel.appendChild(missedSection);
  }

  // Tomorrow's Priorities
  if (review.tomorrowPriorities && review.tomorrowPriorities.length > 0) {
    const prioSection = el('div', { class: 'ai-review-section' },
      el('div', { class: 'ai-review-section-title' }, '🎯 Tomorrow')
    );
    const list = el('div', { class: 'ai-review-list' });
    review.tomorrowPriorities.forEach(p => {
      list.appendChild(el('div', { class: 'ai-review-list-item' },
        icon(ICONS.target, { size: 14 }),
        el('span', {}, p)
      ));
    });
    prioSection.appendChild(list);
    panel.appendChild(prioSection);
  }

  container.replaceChildren(panel);
}

// ─── Coach Chat ───

function createCoachChat() {
  const chatHistory = [];

  const chat = el('div', { class: 'coach-chat' });

  // Header
  chat.appendChild(el('div', { class: 'coach-chat-header' },
    icon(ICONS.sparkles, { size: 16 }),
    el('span', {}, 'Ask your Coach')
  ));

  // Messages
  const messages = el('div', { class: 'coach-chat-messages', id: 'coach-messages' },
    el('div', { class: 'chat-msg chat-msg-ai' },
      'Hey! Ask me anything about your health data. Try "How am I doing?" or "How\'s my protein?"'
    )
  );
  chat.appendChild(messages);

  // Input
  const input = el('input', {
    class: 'coach-chat-field',
    type: 'text',
    placeholder: 'Ask your coach…',
    id: 'coach-input',
  });

  const sendBtn = el('button', {
    class: 'coach-chat-send',
    onClick: () => handleSend(),
  }, icon(ICONS.send, { size: 14 }));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  chat.appendChild(el('div', { class: 'coach-chat-input' }, input, sendBtn));

  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    // Add user message
    chatHistory.push({ role: 'user', text });
    messages.appendChild(el('div', { class: 'chat-msg chat-msg-user fade-in' }, text));

    // Typing indicator
    const typing = el('div', { class: 'chat-msg chat-msg-ai fade-in', style: { opacity: '0.6' } }, '...');
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    try {
      const response = await sendCoachChat(text, chatHistory);
      chatHistory.push({ role: 'model', text: response.text });
      typing.remove();
      const aiMsg = el('div', { class: 'chat-msg chat-msg-ai fade-in' }, response.text);
      messages.appendChild(aiMsg);
    } catch (e) {
      typing.remove();
      messages.appendChild(el('div', { class: 'chat-msg chat-msg-ai fade-in' },
        'Sorry, I couldn\'t process that. Try again.'
      ));
    }

    messages.scrollTop = messages.scrollHeight;
  }

  return chat;
}

