// =============================================================
// ALIGN v2 — Main Application Controller
// =============================================================

import { initState, getState, setState, subscribe, detectTimePeriod } from './state.js';
import { registerRoute, initRouter, navigate } from './router.js';
import { renderBottomNav, renderTopNav, updateNavActive } from './components/nav.js';
import { renderDashboard } from './views/dashboard.js';
import { renderFitness } from './views/fitness.js';
import { renderHabits } from './views/habits.js';
import { renderMedia } from './views/media.js';
import { renderSettings } from './views/settings.js';
import { initKeyboardShortcuts } from './components/command-palette.js';
import { auth, onAuthStateChanged } from './firebase-config.js';
import { el } from './dom.js';
import { initAIBubble } from './components/ai-bubble.js';
import { syncHealthData } from './ai/health-sync.js';
import { initCloudSync } from './cloud-sync.js';


// ─── Initialize ───

function init() {
  // 1. Init state from localStorage
  initState();

  // 1b. Initialize cloud synchronization
  initCloudSync();

  // 2. Apply time period to document
  const timePeriod = getState('timePeriod');
  document.documentElement.setAttribute('data-time-period', timePeriod);

  // 3. Check for PWA standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    document.body.classList.add('pwa-standalone');
  }

  // 4. Register views
  registerRoute('dashboard', renderDashboard);
  registerRoute('fitness', renderFitness);
  registerRoute('habits', renderHabits);
  registerRoute('media', renderMedia);
  registerRoute('settings', renderSettings);

  // 5. Render navigation
  const appRoot = document.getElementById('app-root');
  renderTopNav(appRoot);
  renderBottomNav(appRoot);

  // 5b. Render AI Coach bubble
  initAIBubble(appRoot);


  // 6. Init router
  initRouter('#view-container', (viewName) => {
    setState('activeView', viewName);
    updateNavActive(viewName);
  });

  // 7. Date change listener
  document.addEventListener('align:dateChange', (e) => {
    setState('dateStr', e.detail.date);
    const activeView = getState('activeView') || 'dashboard';
    navigate(activeView);
  });

  // 8. Update time period every minute
  setInterval(() => {
    const newPeriod = detectTimePeriod();
    if (newPeriod !== getState('timePeriod')) {
      setState('timePeriod', newPeriod);
      document.documentElement.setAttribute('data-time-period', newPeriod);
      if (getState('activeView') === 'dashboard') {
        navigate('dashboard');
      }
    }
  }, 60000);

  // 9. Firebase auth listener
  if (auth) {
    onAuthStateChanged(auth, (user) => {
      setState('user', user || null);
    });
  }

  // 10. Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Align SW registered:', reg.scope))
      .catch((err) => console.warn('SW registration failed:', err));
  }

  // 11. Keyboard shortcuts + command palette
  initKeyboardShortcuts();

  // 11b. Touch swipe tab navigation
  initSwipeNavigation();


  // 12. Offline/online status banner
  const offlineBanner = el('div', { class: 'offline-banner', id: 'offline-banner' }, '⚡ Offline — changes queued');
  document.body.appendChild(offlineBanner);

  window.addEventListener('offline', () => offlineBanner.classList.add('visible'));
  window.addEventListener('online', () => {
    offlineBanner.classList.remove('visible');
  });
  if (!navigator.onLine) offlineBanner.classList.add('visible');

  // 13. Device ID for conflict resolution
  if (!localStorage.getItem('align_device_id')) {
    localStorage.setItem('align_device_id', crypto.randomUUID());
  }

  // 15. Silent Apple Health sync on startup — runs in background, never blocks UI
  setTimeout(() => {
    syncHealthData(true).then(synced => {
      if (synced) {
        console.log('[Align] Apple Health data synced silently on startup');
        // Re-render dashboard if it's active to show fresh data
        if (getState('activeView') === 'dashboard') {
          navigate('dashboard');
        }
      }
    });
  }, 1500); // wait 1.5s after app boot so it doesn't compete with rendering

  // 14. PWA install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const lastDismiss = localStorage.getItem('align_install_dismissed');
    if (lastDismiss) {
      const daysSince = (Date.now() - parseInt(lastDismiss)) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) return;
    }
    deferredPrompt = e;
    showInstallBanner(deferredPrompt);
  });

  console.log(`%c✦ Align v2 initialized — ${timePeriod} mode`, 'color: #cc785c; font-weight: bold;');
}

function showInstallBanner(prompt) {
  const banner = el('div', {
    class: 'install-banner fade-in',
    style: {
      position: 'fixed',
      bottom: 'calc(var(--nav-height-mobile) + var(--safe-bottom) + 8px)',
      left: '16px',
      right: '16px',
      padding: '12px 16px',
      background: 'var(--surface-card)',
      border: '1px solid var(--hairline)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: '100',
      fontSize: 'var(--text-sm)',
    },
  },
    el('span', { style: { fontWeight: '600', color: 'var(--ink)' } }, '📱 Add Align to Home Screen'),
    el('div', { style: { display: 'flex', gap: '8px' } },
      el('button', {
        class: 'btn btn-primary',
        style: { height: '32px', fontSize: 'var(--text-xs)', padding: '0 12px' },
        onClick: async () => {
          prompt.prompt();
          await prompt.userChoice;
          banner.remove();
        },
      }, 'Install'),
      el('button', {
        style: { color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px', fontSize: 'var(--text-xs)' },
        onClick: () => {
          localStorage.setItem('align_install_dismissed', String(Date.now()));
          banner.remove();
        },
      }, 'Later')
    )
  );
  document.body.appendChild(banner);
}

function initSwipeNavigation() {
  const container = document.getElementById('view-container');
  if (!container) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  const tabs = ['dashboard', 'fitness', 'habits', 'media', 'settings'];

  container.addEventListener('touchstart', (e) => {
    // Check if swipe is from a protected zone (modals, chats, charts)
    if (
      e.target.closest('.bottom-sheet') || 
      e.target.closest('.sheet-overlay') ||
      e.target.closest('.ai-chat-window') ||
      e.target.closest('.ai-bubble-btn') ||
      e.target.closest('.chart-container') ||
      e.target.closest('svg') ||
      e.target.closest('.week-strip') ||
      e.target.closest('input') ||
      e.target.closest('textarea') ||
      e.target.closest('.coach-chat')
    ) {
      return;
    }

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (startTime === 0) return;

    const touch = e.changedTouches[0];
    const dX = touch.clientX - startX;
    const dY = touch.clientY - startY;
    const duration = Date.now() - startTime;

    // Reset touch tracker
    startTime = 0;

    // Swipe checks
    if (duration < 350 && Math.abs(dX) > 80 && Math.abs(dY) < 50) {
      const current = getState('activeView') || 'dashboard';
      const index = tabs.indexOf(current);
      if (index === -1) return;

      if (dX < 0 && index < tabs.length - 1) {
        // Swipe Left -> Go Next (Fitness, Habits, Media, Settings)
        navigate(tabs[index + 1]);
      } else if (dX > 0 && index > 0) {
        // Swipe Right -> Go Prev (Dashboard, Fitness, Habits, Media)
        navigate(tabs[index - 1]);
      }
    }
  }, { passive: true });
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', init);

