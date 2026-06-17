// =============================================================
// ALIGN v2 — SVG Charts Engine
// Inline SVG charts — no external dependencies
// Sparklines, Line, Bar, Donut, Scatter
// =============================================================

import { elNS } from '../dom.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * Create a sparkline (compact 7-day inline chart).
 * @param {number[]} values - Data points (last 7 days)
 * @param {Object} opts
 */
export function sparkline(values, opts = {}) {
  const {
    width = 80,
    height = 28,
    color = 'var(--primary)',
    fillOpacity = 0.15,
    strokeWidth = 1.5,
  } = opts;

  const data = values.filter(v => v !== null && v !== undefined);
  if (data.length < 2) {
    return elNS('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Fill area
  const fillD = pathD + ` L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;

  const svg = elNS('svg', {
    width: String(width),
    height: String(height),
    viewBox: `0 0 ${width} ${height}`,
    class: 'sparkline-svg',
  });

  svg.appendChild(elNS('path', {
    d: fillD,
    fill: color,
    opacity: String(fillOpacity),
  }));

  svg.appendChild(elNS('path', {
    d: pathD,
    fill: 'none',
    stroke: color,
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));

  // End dot
  const last = points[points.length - 1];
  svg.appendChild(elNS('circle', {
    cx: String(last.x.toFixed(1)),
    cy: String(last.y.toFixed(1)),
    r: '2.5',
    fill: color,
  }));

  return svg;
}

/**
 * Create a 30-day line chart.
 * @param {Array<{date: string, value: number}>} data
 * @param {Object} opts
 */
export function lineChart(data, opts = {}) {
  const {
    width = 320,
    height = 180,
    color = 'var(--primary)',
    targetValue = null,
    targetColor = 'var(--text-subtle)',
    label = 'Line chart',
    fillArea = false,
    gradientId = 'lcGrad' + Math.random().toString(36).slice(2, 6),
  } = opts;

  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const values = data.map(d => d.value);
  const min = Math.min(...values, targetValue ?? Infinity) * 0.95;
  const max = Math.max(...values, targetValue ?? -Infinity) * 1.05;
  const range = max - min || 1;

  const svg = elNS('svg', {
    width: '100%',
    height: String(height),
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': label,
    class: 'chart-svg',
  });

  svg.appendChild(elNS('title', {}, label));

  // Grid lines
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = pad.top + (i / gridSteps) * h;
    const val = max - (i / gridSteps) * range;
    svg.appendChild(elNS('line', {
      x1: String(pad.left), y1: String(y.toFixed(1)),
      x2: String(width - pad.right), y2: String(y.toFixed(1)),
      stroke: 'var(--hairline-soft)', 'stroke-width': '0.5',
    }));
    svg.appendChild(elNS('text', {
      x: String(pad.left - 4), y: String((y + 3).toFixed(1)),
      'text-anchor': 'end',
      fill: 'var(--text-subtle)',
      'font-size': '9',
      'font-family': 'var(--font-mono)',
    }, String(Math.round(val))));
  }

  // Target line
  if (targetValue !== null) {
    const ty = pad.top + (1 - (targetValue - min) / range) * h;
    svg.appendChild(elNS('line', {
      x1: String(pad.left), y1: String(ty.toFixed(1)),
      x2: String(width - pad.right), y2: String(ty.toFixed(1)),
      stroke: targetColor,
      'stroke-width': '1',
      'stroke-dasharray': '4 3',
      opacity: '0.6',
    }));
  }

  // Data points
  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(1, data.length - 1)) * w;
    const y = pad.top + (1 - (d.value - min) / range) * h;
    return { x, y, date: d.date, value: d.value };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Fill area
  if (fillArea && points.length > 1) {
    const fillD = pathD + ` L${points[points.length - 1].x.toFixed(1)},${(pad.top + h).toFixed(1)} L${points[0].x.toFixed(1)},${(pad.top + h).toFixed(1)} Z`;
    svg.appendChild(elNS('path', {
      d: fillD, fill: color, opacity: '0.08',
    }));
  }

  // Line
  svg.appendChild(elNS('path', {
    d: pathD,
    fill: 'none',
    stroke: color,
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));

  // Data dots (interactive)
  points.forEach((p) => {
    const dot = elNS('circle', {
      cx: String(p.x.toFixed(1)),
      cy: String(p.y.toFixed(1)),
      r: '3',
      fill: color,
      class: 'chart-dot',
      'data-date': p.date,
      'data-value': String(p.value),
    });
    svg.appendChild(dot);
  });

  // X-axis labels (show first, middle, last)
  if (data.length > 2) {
    [0, Math.floor(data.length / 2), data.length - 1].forEach(i => {
      const p = points[i];
      const dateStr = data[i].date.slice(5); // MM-DD
      svg.appendChild(elNS('text', {
        x: String(p.x.toFixed(1)),
        y: String(height - 4),
        'text-anchor': 'middle',
        fill: 'var(--text-subtle)',
        'font-size': '8',
        'font-family': 'var(--font-mono)',
      }, dateStr));
    });
  }

  // "Not enough data" label
  if (data.length < 7) {
    svg.appendChild(elNS('text', {
      x: String(width / 2), y: String(height - 4),
      'text-anchor': 'middle',
      fill: 'var(--text-muted)',
      'font-size': '9',
    }, 'Not enough data for full trend'));
  }

  return svg;
}

/**
 * Create a bar chart.
 * @param {Array<{label: string, value: number}>} data
 * @param {Object} opts
 */
export function barChart(data, opts = {}) {
  const {
    width = 320,
    height = 180,
    color = 'var(--primary)',
    targetValue = null,
    targetColor = 'var(--text-subtle)',
    label = 'Bar chart',
    bandMin = null,
    bandMax = null,
    bandColor = 'var(--success)',
  } = opts;

  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const values = data.map(d => d.value);
  const max = Math.max(...values, targetValue ?? 0, bandMax ?? 0) * 1.1;

  const svg = elNS('svg', {
    width: '100%',
    height: String(height),
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': label,
    class: 'chart-svg',
  });

  svg.appendChild(elNS('title', {}, label));

  // Reference band (e.g., optimal sleep range)
  if (bandMin !== null && bandMax !== null) {
    const y1 = pad.top + (1 - bandMax / max) * h;
    const y2 = pad.top + (1 - bandMin / max) * h;
    svg.appendChild(elNS('rect', {
      x: String(pad.left), y: String(y1.toFixed(1)),
      width: String(w), height: String((y2 - y1).toFixed(1)),
      fill: bandColor, opacity: '0.08',
      rx: '2',
    }));
  }

  // Target line
  if (targetValue !== null) {
    const ty = pad.top + (1 - targetValue / max) * h;
    svg.appendChild(elNS('line', {
      x1: String(pad.left), y1: String(ty.toFixed(1)),
      x2: String(width - pad.right), y2: String(ty.toFixed(1)),
      stroke: targetColor,
      'stroke-width': '1',
      'stroke-dasharray': '4 3',
      opacity: '0.6',
    }));
  }

  // Bars
  const barWidth = Math.max(4, (w / data.length) * 0.65);
  const gap = w / data.length;

  data.forEach((d, i) => {
    const barH = (d.value / max) * h;
    const x = pad.left + i * gap + (gap - barWidth) / 2;
    const y = pad.top + h - barH;

    svg.appendChild(elNS('rect', {
      x: String(x.toFixed(1)),
      y: String(y.toFixed(1)),
      width: String(barWidth.toFixed(1)),
      height: String(barH.toFixed(1)),
      rx: '2',
      fill: color,
      opacity: '0.85',
      class: 'chart-bar',
      'data-label': d.label,
      'data-value': String(d.value),
    }));
  });

  // X-axis labels (sparse)
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  data.forEach((d, i) => {
    if (i % labelEvery !== 0 && i !== data.length - 1) return;
    const x = pad.left + i * gap + gap / 2;
    svg.appendChild(elNS('text', {
      x: String(x.toFixed(1)),
      y: String(height - 4),
      'text-anchor': 'middle',
      fill: 'var(--text-subtle)',
      'font-size': '8',
      'font-family': 'var(--font-mono)',
    }, d.label.length > 5 ? d.label.slice(-5) : d.label));
  });

  return svg;
}

/**
 * Create a donut chart (macro breakdown).
 * @param {Array<{label: string, value: number, color: string}>} segments
 * @param {Object} opts
 */
export function donutChart(segments, opts = {}) {
  const {
    size = 140,
    strokeWidth = 22,
    label = 'Donut chart',
    centerLabel = '',
    centerSub = '',
  } = opts;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;

  const svg = elNS('svg', {
    width: String(size),
    height: String(size),
    viewBox: `0 0 ${size} ${size}`,
    role: 'img',
    'aria-label': label,
    class: 'donut-svg',
  });

  svg.appendChild(elNS('title', {}, label));

  // Track
  svg.appendChild(elNS('circle', {
    cx: String(cx), cy: String(cy), r: String(radius),
    fill: 'none',
    stroke: 'var(--surface-soft)',
    'stroke-width': String(strokeWidth),
  }));

  // Segments
  let offset = 0;
  segments.forEach((seg) => {
    const pct = seg.value / total;
    const dashLength = pct * circumference;
    const dashGap = circumference - dashLength;

    svg.appendChild(elNS('circle', {
      cx: String(cx), cy: String(cy), r: String(radius),
      fill: 'none',
      stroke: seg.color,
      'stroke-width': String(strokeWidth),
      'stroke-dasharray': `${dashLength.toFixed(2)} ${dashGap.toFixed(2)}`,
      'stroke-dashoffset': String((-offset + circumference * 0.25).toFixed(2)),
      'stroke-linecap': 'round',
      class: 'donut-segment',
    }));

    offset += dashLength;
  });

  // Center text
  if (centerLabel) {
    svg.appendChild(elNS('text', {
      x: String(cx), y: centerSub ? String(cy - 4) : String(cy + 4),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: 'var(--ink)',
      'font-size': '18',
      'font-weight': '700',
      'font-family': 'var(--font-body)',
    }, centerLabel));
  }

  if (centerSub) {
    svg.appendChild(elNS('text', {
      x: String(cx), y: String(cy + 14),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: 'var(--text-muted)',
      'font-size': '9',
      'font-family': 'var(--font-body)',
    }, centerSub));
  }

  return svg;
}

/**
 * Create a calendar heatmap (90-day habit grid).
 * @param {string[]} completions - Array of YYYY-MM-DD strings
 * @param {Object} opts
 */
export function calendarHeatmap(completions, opts = {}) {
  const {
    days = 90,
    cellSize = 10,
    gap = 2,
    emptyColor = 'var(--surface-soft)',
    fillColor = 'var(--success)',
    fullColor = 'var(--primary)',
    layout = 'grid',
  } = opts;

  const completionSet = new Set(completions);
  const today = new Date();

  if (layout === 'calendar') {
    const headerHeight = 16;
    const width = 7 * (cellSize + gap) + gap;

    const oldestDate = new Date(today);
    oldestDate.setDate(today.getDate() - (days - 1));
    const startSunday = new Date(oldestDate);
    startSunday.setDate(oldestDate.getDate() - oldestDate.getDay());
    startSunday.setHours(0, 0, 0, 0);

    const diffTodayMs = today.getTime() - startSunday.getTime();
    const diffTodayDays = Math.floor(diffTodayMs / (24 * 60 * 60 * 1000));
    const totalRows = Math.floor(diffTodayDays / 7) + 1;

    const height = headerHeight + totalRows * (cellSize + gap) + gap;

    const svg = elNS('svg', {
      width: String(width),
      height: String(height),
      viewBox: `0 0 ${width} ${height}`,
      class: 'heatmap-svg calendar-layout',
    });

    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    weekdays.forEach((dayLabel, col) => {
      const x = gap + col * (cellSize + gap) + cellSize / 2;
      const text = elNS('text', {
        x: String(x),
        y: '10',
        'text-anchor': 'middle',
        fill: 'var(--text-muted)',
        style: {
          fontFamily: 'var(--font-sans)',
          fontSize: '8px',
          fontWeight: '600',
        },
      }, dayLabel);
      svg.appendChild(text);
    });

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const isCompleted = completionSet.has(dateStr);

      let isStreak = false;
      if (isCompleted) {
        const next = new Date(date);
        next.setDate(date.getDate() + 1);
        const nextStr = next.toISOString().split('T')[0];
        const prev = new Date(date);
        prev.setDate(date.getDate() - 1);
        const prevStr = prev.toISOString().split('T')[0];
        isStreak = completionSet.has(nextStr) || completionSet.has(prevStr);
      }

      const col = date.getDay();
      const diffMs = date.getTime() - startSunday.getTime();
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const row = Math.floor(diffDays / 7);

      const x = gap + col * (cellSize + gap);
      const y = headerHeight + gap + row * (cellSize + gap);

      const isToday = dateStr === today.toISOString().split('T')[0];

      const rect = elNS('rect', {
        x: String(x),
        y: String(y),
        width: String(cellSize),
        height: String(cellSize),
        rx: '2',
        fill: isCompleted ? (isStreak ? fullColor : fillColor) : emptyColor,
        stroke: isToday ? 'var(--primary)' : 'none',
        'stroke-width': isToday ? '1.5' : '0',
        opacity: isCompleted ? '1' : '0.6',
        class: 'heatmap-cell',
        'data-date': dateStr,
        'data-completed': isCompleted ? 'true' : 'false',
      });

      svg.appendChild(rect);
    }

    return svg;
  }

  if (layout === 'strip') {
    const width = days * (cellSize + gap) - gap;
    const height = cellSize;

    const svg = elNS('svg', {
      width: '100%',
      height: String(height),
      viewBox: `0 0 ${width} ${height}`,
      class: 'heatmap-svg strip-layout',
      style: { maxWidth: '100%' },
    });

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const index = days - 1 - i;

      const isCompleted = completionSet.has(dateStr);

      let isStreak = false;
      if (isCompleted) {
        const next = new Date(date);
        next.setDate(date.getDate() + 1);
        const nextStr = next.toISOString().split('T')[0];
        const prev = new Date(date);
        prev.setDate(date.getDate() - 1);
        const prevStr = prev.toISOString().split('T')[0];
        isStreak = completionSet.has(nextStr) || completionSet.has(prevStr);
      }

      const x = index * (cellSize + gap);
      const y = 0;

      const rect = elNS('rect', {
        x: String(x), y: String(y),
        width: String(cellSize), height: String(cellSize),
        rx: '2',
        fill: isCompleted ? (isStreak ? fullColor : fillColor) : emptyColor,
        opacity: isCompleted ? '1' : '0.5',
        class: 'heatmap-cell',
        'data-date': dateStr,
        'data-completed': isCompleted ? 'true' : 'false',
      });

      svg.appendChild(rect);
    }

    return svg;
  }

  const cols = Math.ceil(days / 7);
  const width = cols * (cellSize + gap) + gap;
  const height = 7 * (cellSize + gap) + gap;

  const svg = elNS('svg', {
    width: String(width),
    height: String(height),
    viewBox: `0 0 ${width} ${height}`,
    class: 'heatmap-svg',
  });

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const col = Math.floor((days - 1 - i) / 7);
    const row = date.getDay();

    const isCompleted = completionSet.has(dateStr);

    let isStreak = false;
    if (isCompleted) {
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const nextStr = next.toISOString().split('T')[0];
      const prev = new Date(date);
      prev.setDate(date.getDate() - 1);
      const prevStr = prev.toISOString().split('T')[0];
      isStreak = completionSet.has(nextStr) || completionSet.has(prevStr);
    }

    const x = gap + col * (cellSize + gap);
    const y = gap + row * (cellSize + gap);

    const rect = elNS('rect', {
      x: String(x), y: String(y),
      width: String(cellSize), height: String(cellSize),
      rx: '2',
      fill: isCompleted ? (isStreak ? fullColor : fillColor) : emptyColor,
      opacity: isCompleted ? '1' : '0.5',
      class: 'heatmap-cell',
      'data-date': dateStr,
      'data-completed': isCompleted ? 'true' : 'false',
    });

    svg.appendChild(rect);
  }

  return svg;
}

/**
 * Create a dual-line chart (e.g., calories + protein).
 */
export function dualLineChart(data, opts = {}) {
  const {
    width = 320,
    height = 180,
    line1Key = 'value1',
    line2Key = 'value2',
    color1 = 'var(--accent-coral)',
    color2 = 'var(--primary)',
    target1 = null,
    target2 = null,
    label = 'Dual line chart',
  } = opts;

  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const allVals = data.flatMap(d => [d[line1Key] || 0, d[line2Key] || 0]);
  if (target1 !== null) allVals.push(target1);
  if (target2 !== null) allVals.push(target2);

  const min = 0;
  const max = Math.max(...allVals) * 1.1 || 1;

  const svg = elNS('svg', {
    width: '100%',
    height: String(height),
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': label,
    class: 'chart-svg',
  });

  svg.appendChild(elNS('title', {}, label));

  // Target lines
  [{ val: target1, color: color1 }, { val: target2, color: color2 }].forEach(({ val, color }) => {
    if (val !== null) {
      const ty = pad.top + (1 - val / max) * h;
      svg.appendChild(elNS('line', {
        x1: String(pad.left), y1: String(ty.toFixed(1)),
        x2: String(width - pad.right), y2: String(ty.toFixed(1)),
        stroke: color, 'stroke-width': '1',
        'stroke-dasharray': '4 3', opacity: '0.4',
      }));
    }
  });

  // Draw lines
  [{ key: line1Key, color: color1 }, { key: line2Key, color: color2 }].forEach(({ key, color }) => {
    const points = data.map((d, i) => {
      const x = pad.left + (i / Math.max(1, data.length - 1)) * w;
      const y = pad.top + (1 - (d[key] || 0) / max) * h;
      return { x, y };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    svg.appendChild(elNS('path', {
      d: pathD, fill: 'none', stroke: color,
      'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
  });

  // X-axis labels
  if (data.length > 2) {
    [0, Math.floor(data.length / 2), data.length - 1].forEach(i => {
      const x = pad.left + (i / Math.max(1, data.length - 1)) * w;
      svg.appendChild(elNS('text', {
        x: String(x.toFixed(1)), y: String(height - 4),
        'text-anchor': 'middle', fill: 'var(--text-subtle)',
        'font-size': '8', 'font-family': 'var(--font-mono)',
      }, (data[i].date || '').slice(5)));
    });
  }

  return svg;
}
