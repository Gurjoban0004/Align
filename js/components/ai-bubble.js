// =============================================================
// ALIGN v2 — Floating AI Coach Bubble
// Persistent, app-aware conversational health assistant
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import { getState, getDayLog, subscribe } from '../state.js';
import { parseInput } from '../ai/parser.js';
import { sendCoachChat } from '../ai/gemini.js';
import { applyResults } from './input-bar.js';
import { navigate } from '../router.js';

let chatHistory = [];
let isOpen = false;

// Helpers to get styling and visual indicators for confirmation cards
const LOG_TYPES = {
  food: { label: 'Meal Logged', icon: 'utensils', color: 'var(--accent-coral)' },
  steps: { label: 'Steps Logged', icon: 'footprints', color: 'var(--primary)' },
  sleep: { label: 'Sleep Logged', icon: 'moon', color: 'var(--accent-lavender)' },
  water: { label: 'Water Logged', icon: 'water', color: 'var(--accent-teal)' },
  weight: { label: 'Weight Logged', icon: 'scale', color: 'var(--text-muted)' },
  workout: { label: 'Workout Logged', icon: 'dumbbell', color: 'var(--accent-sage)' },
  reading: { label: 'Reading Logged', icon: 'book', color: 'var(--accent-amber)' },
};

/**
 * Initialize and render the AI Coach floating bubble.
 * @param {HTMLElement} appRoot - App root container to inject elements into.
 */
export function initAIBubble(appRoot) {
  // Container
  const container = el('div', { class: 'ai-bubble-container', id: 'ai-bubble-root' });

  // Floating Button
  const btn = el('button', {
    class: 'ai-bubble-btn',
    'aria-label': 'Talk to AI Coach',
    onClick: () => toggleChatWindow(container),
  },
    icon(ICONS.sparkles, { size: 24, class: 'ai-btn-sparkles' }),
    icon(ICONS.x, { size: 24, class: 'ai-btn-close' })
  );

  // Chat Window
  const chatWindow = el('div', { class: 'ai-chat-window' });

  // Chat Window Header
  const header = el('div', { class: 'ai-chat-header' },
    el('div', { class: 'ai-chat-header-title' },
      icon(ICONS.sparkles, { size: 16 }),
      el('strong', {}, 'Align Coach'),
      el('span', { class: 'ai-coach-pill', id: 'ai-coach-pill' }, getCoachSubtitle())
    ),
    el('button', {
      class: 'ai-chat-collapse',
      onClick: () => toggleChatWindow(container),
    }, icon(ICONS.chevronDown, { size: 18 }))
  );
  chatWindow.appendChild(header);

  // Chat Messages Area
  const messages = el('div', { class: 'ai-chat-messages', id: 'ai-chat-msgs' },
    el('div', { class: 'chat-msg chat-msg-ai fade-in' },
      'Hey there! I\'m your Align companion. Tell me what you did (e.g. "drank 3 cups of water" or "slept 7 hours") and I\'ll log it automatically, or ask me anything about your progress!'
    )
  );
  chatWindow.appendChild(messages);

  // Input Box
  const input = el('input', {
    type: 'text',
    class: 'ai-chat-field',
    placeholder: 'Ask or tell your coach anything...',
    id: 'ai-bubble-input',
    autocomplete: 'off',
    enterkeyhint: 'send',
  });

  const sendBtn = el('button', {
    class: 'ai-chat-send',
    'aria-label': 'Send message',
    onClick: () => handleSend(input, messages),
  }, icon(ICONS.send, { size: 14 }));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend(input, messages);
    }
  });

  const inputArea = el('div', { class: 'ai-chat-input' }, input, sendBtn);
  chatWindow.appendChild(inputArea);

  container.appendChild(chatWindow);
  container.appendChild(btn);
  appRoot.appendChild(container);

  // Subscribe to profile changes to update coach personality subtitle if updated
  subscribe('profile', () => {
    const pill = document.getElementById('ai-coach-pill');
    if (pill) pill.textContent = getCoachSubtitle();
  });
}

function getCoachSubtitle() {
  const profile = getState('profile') || {};
  const personality = profile.coachPersonality || 'supportive';
  return personality.charAt(0).toUpperCase() + personality.slice(1);
}

function toggleChatWindow(container) {
  isOpen = !isOpen;
  container.classList.toggle('chat-open', isOpen);
  if (isOpen) {
    const input = document.getElementById('ai-bubble-input');
    if (input) setTimeout(() => input.focus(), 150);
    const messages = document.getElementById('ai-chat-msgs');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }
}

async function handleSend(input, messagesEl) {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  // Append user message
  messagesEl.appendChild(el('div', { class: 'chat-msg chat-msg-user fade-in' }, text));
  chatHistory.push({ role: 'user', text });
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Process through NLP parser for auto-logging
  const parseResults = parseInput(text);
  const loggableResults = parseResults.filter(r => r.type !== 'note');

  if (loggableResults.length > 0) {
    // Auto-apply log entries
    applyResults(loggableResults, () => {
      // Force refresh current view to update charts/metric rings
      const currentView = getState('activeView') || 'dashboard';
      navigate(currentView);
    });

    // Render an inline visual confirmation card for each log inside the chat log
    loggableResults.forEach((result) => {
      const logInfo = LOG_TYPES[result.type] || { label: 'Logged', icon: 'check', color: 'var(--primary)' };
      const confirmCard = el('div', { class: 'ai-chat-log-confirm fade-in' },
        el('div', { class: 'confirm-icon-wrap', style: { backgroundColor: logInfo.color } },
          icon(ICONS[logInfo.icon], { size: 14, color: '#fff' })
        ),
        el('div', { class: 'confirm-text' },
          el('strong', {}, logInfo.label),
          el('span', {}, result.summary)
        )
      );
      messagesEl.appendChild(confirmCard);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Show typing indicator
  const typing = el('div', { class: 'chat-msg chat-msg-ai fade-in', style: { opacity: '0.6' } }, '...');
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    // Fetch response from Gemini AI Coach
    const response = await sendCoachChat(text, chatHistory);
    typing.remove();

    messagesEl.appendChild(el('div', { class: 'chat-msg chat-msg-ai fade-in' }, response.text));
    chatHistory.push({ role: 'model', text: response.text });
  } catch (error) {
    typing.remove();
    messagesEl.appendChild(el('div', { class: 'chat-msg chat-msg-ai fade-in' },
      'Sorry, I had trouble reaching the coaching server. Please check your API key and connection.'
    ));
    console.error('Gemini coach chat failed:', error);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}
