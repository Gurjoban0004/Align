// =============================================================
// ALIGN v2 — Simple Hash Router
// =============================================================

const routes = {};
let currentView = null;
let transitionTimeout = null;

/**
 * Register a view renderer.
 * @param {string} name - Route name (e.g., 'dashboard')
 * @param {Function} renderer - (container: HTMLElement) => void
 */
export function registerRoute(name, renderer) {
  routes[name] = renderer;
}

/**
 * Navigate to a view.
 */
export function navigate(viewName, force = false) {
  if (!routes[viewName]) {
    console.warn(`Route "${viewName}" not found`);
    viewName = 'dashboard';
  }

  const currentHash = '#' + viewName;
  if (window.location.hash === currentHash) {
    // Force re-render by resetting currentView and re-handling
    currentView = null;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = currentHash;
  }
}

/**
 * Initialize the router, listen for hash changes.
 */
export function initRouter(containerSelector, onViewChange) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error('Router: container not found:', containerSelector);
    return;
  }

  function handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const viewName = hash.split('?')[0]; // strip query params

    if (viewName === currentView) return;

    const renderer = routes[viewName] || routes['dashboard'];
    if (!renderer) return;

    // Transition out
    if (transitionTimeout) clearTimeout(transitionTimeout);
    container.style.opacity = '0';
    container.style.transform = 'translateY(6px)';

    transitionTimeout = setTimeout(() => {
      // Clear and render new view
      container.replaceChildren();
      currentView = viewName;

      try {
        renderer(container);
      } catch (e) {
        console.error(`Error rendering view "${viewName}":`, e);
        container.appendChild(document.createTextNode('Failed to load view.'));
      }

      // Transition in
      requestAnimationFrame(() => {
        container.style.transition = 'opacity 250ms ease, transform 250ms ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
      });

      // Notify app
      if (typeof onViewChange === 'function') {
        onViewChange(viewName);
      }
    }, 120);
  }

  window.addEventListener('hashchange', handleRoute);

  // Initial route
  handleRoute();
}

/**
 * Get current active route name.
 */
export function getCurrentRoute() {
  return currentView || 'dashboard';
}
