// =============================================================
// ALIGN v2 — Toast Notification System
// =============================================================

import { el, icon, ICONS } from '../dom.js';

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = el('div', { class: 'toast-container', id: 'toast-container' });
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {Object} [opts]
 * @param {'info'|'success'|'warning'|'error'} [opts.type='info']
 * @param {number} [opts.duration=3000]
 * @param {string} [opts.action] - Action button label
 * @param {Function} [opts.onAction] - Action callback
 */
export function showToast(message, opts = {}) {
  const {
    type = 'info',
    duration = 3000,
    action,
    onAction,
  } = opts;

  const container = ensureContainer();

  const iconMap = {
    info: ICONS.info,
    success: ICONS.check,
    warning: ICONS.alertCircle,
    error: ICONS.x,
  };

  const toast = el('div', { class: `toast toast-${type}` },
    el('div', { class: 'toast-content' },
      icon(iconMap[type] || ICONS.info, { size: 16 }),
      el('span', { class: 'toast-message' }, message)
    )
  );

  if (action && onAction) {
    const actionBtn = el('button', {
      class: 'toast-action',
      onClick: () => {
        onAction();
        dismissToast(toast);
      },
    }, action);
    toast.appendChild(actionBtn);
  }

  // Close button
  const closeBtn = el('button', {
    class: 'toast-close',
    'aria-label': 'Dismiss',
    onClick: () => dismissToast(toast),
  }, icon(ICONS.x, { size: 14 }));
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }

  return toast;
}

function dismissToast(toast) {
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-exit');
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 300);
}
