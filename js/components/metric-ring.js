// =============================================================
// ALIGN v2 — Metric Ring Component
// Animated SVG circular progress ring
// =============================================================

import { elNS } from '../dom.js';

/**
 * Create an animated circular progress ring.
 * @param {Object} opts
 * @param {number} opts.value - Current value
 * @param {number} opts.max - Maximum value
 * @param {string} opts.color - Stroke color
 * @param {number} [opts.size=120] - Diameter in px
 * @param {number} [opts.strokeWidth=10] - Stroke width
 * @param {string} [opts.trackColor] - Track (background) color
 * @param {string} [opts.label] - Center label text
 * @param {string} [opts.sublabel] - Small text below label
 * @param {boolean} [opts.animate=true] - Whether to animate
 * @returns {SVGElement}
 */
export function createMetricRing(opts) {
  const {
    value = 0,
    max = 100,
    color = 'var(--primary)',
    size = 120,
    strokeWidth = 10,
    trackColor = 'var(--surface-soft)',
    label,
    sublabel,
    animate = true,
  } = opts;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(1, Math.max(0, value / (max || 1)));
  const offset = circumference * (1 - percent);
  const center = size / 2;

  const svg = elNS('svg', {
    width: String(size),
    height: String(size),
    viewBox: `0 0 ${size} ${size}`,
    class: 'metric-ring',
  });

  // Track circle (background)
  svg.appendChild(elNS('circle', {
    cx: String(center),
    cy: String(center),
    r: String(radius),
    fill: 'none',
    stroke: trackColor,
    'stroke-width': String(strokeWidth),
  }));

  // Progress arc
  const arc = elNS('circle', {
    cx: String(center),
    cy: String(center),
    r: String(radius),
    fill: 'none',
    stroke: color,
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'round',
    'stroke-dasharray': String(circumference),
    'stroke-dashoffset': animate ? String(circumference) : String(offset),
    transform: `rotate(-90 ${center} ${center})`,
    style: `transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);`,
  });
  svg.appendChild(arc);

  // Center label
  if (label !== undefined) {
    const labelEl = elNS('text', {
      x: String(center),
      y: sublabel ? String(center - 4) : String(center),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: 'var(--ink)',
      'font-family': 'var(--font-body)',
      'font-size': String(Math.round(size * 0.22)),
      'font-weight': '700',
    });
    labelEl.textContent = String(label);
    svg.appendChild(labelEl);
  }

  if (sublabel) {
    const subEl = elNS('text', {
      x: String(center),
      y: String(center + Math.round(size * 0.14)),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: 'var(--text-muted)',
      'font-family': 'var(--font-body)',
      'font-size': String(Math.round(size * 0.09)),
      'font-weight': '600',
      'text-transform': 'uppercase',
      'letter-spacing': '0.05em',
    });
    subEl.textContent = sublabel;
    svg.appendChild(subEl);
  }

  // Animate on next frame
  if (animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arc.setAttribute('stroke-dashoffset', String(offset));
      });
    });
  }

  return svg;
}

/**
 * Create a small inline progress bar.
 */
export function createProgressBar(opts) {
  const {
    value = 0,
    max = 100,
    color = 'var(--primary)',
    height = 6,
  } = opts;

  const percent = Math.min(100, Math.max(0, (value / (max || 1)) * 100));

  const container = document.createElement('div');
  container.className = 'progress-bar';
  container.style.cssText = `height:${height}px; background:var(--surface-soft); border-radius:${height}px; overflow:hidden;`;

  const fill = document.createElement('div');
  fill.className = 'progress-bar-fill';
  fill.style.cssText = `height:100%; width:0%; background:${color}; border-radius:${height}px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1);`;

  container.appendChild(fill);

  // Animate
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.width = percent + '%';
    });
  });

  return container;
}
