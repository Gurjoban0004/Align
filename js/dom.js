// =============================================================
// ALIGN v2 — Safe DOM Builder
// XSS-compliant element creation (no innerHTML anywhere)
// =============================================================

/**
 * Create an HTML element safely.
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes, classes, event listeners
 * @param {...(string|number|HTMLElement|SVGElement)} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined || val === false) continue;

    if (key.startsWith('on') && typeof val === 'function') {
      element.addEventListener(key.substring(2).toLowerCase(), val);
    } else if (key === 'class' || key === 'className') {
      element.className = val;
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(element.style, val);
    } else if (key === 'dataset' && typeof val === 'object') {
      for (const [dk, dv] of Object.entries(val)) {
        element.dataset[dk] = dv;
      }
    } else if (key === 'ref' && typeof val === 'function') {
      // Ref callback for storing element references
      val(element);
    } else {
      element.setAttribute(key, val);
    }
  }

  appendChildren(element, children);
  return element;
}

/**
 * Create an SVG namespaced element.
 */
export function elNS(tag, attrs = {}, ...children) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined) continue;
    if (key === 'style' && typeof val === 'object') {
      Object.assign(element.style, val);
    } else {
      element.setAttribute(key, val);
    }
  }

  appendChildren(element, children);
  return element;
}

/**
 * Safely append children — text nodes for strings, direct append for elements.
 */
function appendChildren(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;

    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else if (Array.isArray(child)) {
      appendChildren(parent, child);
    }
  }
}

// =============================================================
// SVG Icon System — Lucide-style stroke icons
// =============================================================

/** Lucide-style icon path dictionary */
export const ICONS = {
  // Navigation
  home:        'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  dumbbell:    'M14.4 14.4L9.6 9.6 M18 6l-1.4 1.4 M6 18l1.4-1.4 M6 6l1.4 1.4 M18 18l-1.4-1.4 M6.3 12.3l5.4-5.4 M12.3 18.3l5.4-5.4',
  check:       'M20 6L9 17l-5-5',
  checkSquare: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  book:        'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V5a2 2 0 0 1 2-2h14v18H6.5A2.5 2.5 0 0 1 4 19.5z',
  settings:    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',

  // Metrics
  footprints:  'M4 16v-2.38C4 11.5 5.88 9.85 6 7.07l.08-1.57A1.65 1.65 0 0 1 7.72 4h.08a1.65 1.65 0 0 1 1.64 1.5l.08 1.57C9.65 9.85 11.5 11.5 11.5 13.62V16M12.5 16v-2.38c0-2.12 1.88-3.77 2-6.55l.08-1.57A1.65 1.65 0 0 1 16.22 4h.08a1.65 1.65 0 0 1 1.64 1.5l.08 1.57c.13 2.78 2 4.43 2 6.55V16',
  water:       'M12 2.5s6 6.42 6 11.1A6 6 0 0 1 6 13.6C6 8.92 12 2.5 12 2.5z',
  moon:        'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  flame:       'M8.5 14.5A4.5 4.5 0 0 0 12 22a6 6 0 0 0 6-6c0-4-3-6-3-9-2 1-3 3-3 5-2-1-3.5-3-3-6-3 3-4.5 6-4.5 8.5z',
  scale:       'M12 3v17M8 7l4-4 4 4 M3 21h18',
  utensils:    'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  heart:       'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  activity:    'M22 12h-4l-3 9L9 3l-3 9H2',
  target:      'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',

  // Actions
  plus:        'M12 5v14M5 12h14',
  minus:       'M5 12h14',
  x:           'M18 6L6 18M6 6l12 12',
  search:      'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  send:        'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  mic:         'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8',
  edit:        'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:       'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',

  // UI
  chevronRight:'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp:   'M18 15l-6-6-6 6',
  arrowUp:     'M12 19V5M5 12l7-7 7 7',
  arrowDown:   'M12 5v14M19 12l-7 7-7-7',
  sparkles:    'M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z',
  brain:       'M12 2a5 5 0 0 0-5 5c0 .7.1 1.4.4 2A5 5 0 0 0 4 14c0 2.2 1.4 4 3.4 4.7A3.5 3.5 0 0 0 11 22h2a3.5 3.5 0 0 0 3.6-3.3C18.6 18 20 16.2 20 14a5 5 0 0 0-3.4-4.7c.2-.7.4-1.3.4-2a5 5 0 0 0-5-5z M12 2v20',
  sun:         'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  star:        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  film:        'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M7 3v18 M17 3v18 M3 8h4 M3 16h4 M17 8h4 M17 16h4',
  user:        'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logIn:       'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
  logOut:      'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  zap:         'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  trendingUp:  'M23 6l-9.5 9.5-5-5L1 18',
  trendingDown:'M23 18l-9.5-9.5-5 5L1 6',
  calendar:    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z M16 2v4 M8 2v4 M3 10h18',
  clock:       'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  info:        'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01',
  alertCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01',
};

/**
 * Create an SVG icon from a path string.
 * @param {string} pathD - SVG path data (use ICONS.xxx)
 * @param {Object} [opts] - { size, class, strokeWidth }
 * @returns {SVGElement}
 */
export function icon(pathD, opts = {}) {
  const size = opts.size || 18;
  const sw = opts.strokeWidth || '2';

  const svg = elNS('svg', {
    viewBox: '0 0 24 24',
    width: String(size),
    height: String(size),
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': sw,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    ...(opts.class ? { class: opts.class } : {}),
  });

  // Support multi-path icons (space between M commands = multiple paths)
  const paths = pathD.split(/(?=M)/g).filter(Boolean);

  for (const p of paths) {
    // Check if it's a circle (starts with special circle syntax)
    const circleMatch = p.match(/^M(\d+\.?\d*)\s+(\d+\.?\d*)m(-?\d+\.?\d*)\s+0a(\d+\.?\d*)/);
    if (circleMatch) {
      // It's a fake circle encoded as path — just use the path
      svg.appendChild(elNS('path', { d: p.trim() }));
    } else {
      svg.appendChild(elNS('path', { d: p.trim() }));
    }
  }

  return svg;
}

/**
 * Create a filled circle SVG element.
 */
export function dot(color, size = 8) {
  return elNS('svg', { width: String(size), height: String(size), viewBox: `0 0 ${size} ${size}` },
    elNS('circle', { cx: String(size / 2), cy: String(size / 2), r: String(size / 2), fill: color })
  );
}
