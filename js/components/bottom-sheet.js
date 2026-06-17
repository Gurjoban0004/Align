// =============================================================
// ALIGN v2 — Bottom Sheet (Modal) Component
// Drag-to-dismiss modal system for forms and dialogs
// =============================================================

import { el, icon, ICONS } from '../dom.js';

let activeSheet = null;
let overlay = null;

/**
 * Show a bottom sheet modal.
 * @param {Object} opts
 * @param {string} opts.title - Sheet title
 * @param {Function} opts.render - (contentContainer) => void
 * @param {Function} [opts.onClose] - Close callback
 * @returns {{ close: Function }}
 */
export function showBottomSheet(opts) {
  const { title, render, onClose } = opts;

  // Close existing
  if (activeSheet) closeSheet();

  // Overlay
  overlay = el('div', {
    class: 'sheet-overlay',
    onClick: () => closeSheet(),
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('sheet-overlay-visible'));

  // Sheet
  const sheet = el('div', { class: 'bottom-sheet', id: 'active-sheet' });

  // Handle
  const handle = el('div', { class: 'sheet-handle' },
    el('div', { class: 'sheet-handle-bar' })
  );
  sheet.appendChild(handle);

  // Drag-to-dismiss pointer events on handle
  let isDragging = false;
  let startY = 0;

  handle.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startY = e.clientY;
    sheet.style.transition = 'none';
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dY = e.clientY - startY;
    if (dY > 0) {
      sheet.style.transform = `translateY(${dY}px)`;
    }
  });

  const handleDragEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    handle.releasePointerCapture(e.pointerId);
    const dY = e.clientY - startY;
    if (dY > 80) {
      closeSheet();
    } else {
      sheet.style.transition = '';
      sheet.style.transform = '';
    }
  };

  handle.addEventListener('pointerup', handleDragEnd);
  handle.addEventListener('pointercancel', handleDragEnd);

  // Header
  const header = el('div', { class: 'sheet-header' },
    el('h3', { class: 'sheet-title' }, title),
    el('button', {
      class: 'sheet-close-btn',
      'aria-label': 'Close',
      onClick: () => closeSheet(),
    }, icon(ICONS.x, { size: 20 }))
  );
  sheet.appendChild(header);

  // Content
  const content = el('div', { class: 'sheet-content' });
  if (typeof render === 'function') {
    render(content);
  }
  sheet.appendChild(content);

  document.body.appendChild(sheet);

  // Non-jumping scroll lock (critical for iOS Safari PWA)
  const currentScrollY = window.scrollY;
  document.body.dataset.scrollY = String(currentScrollY);
  document.body.style.position = 'fixed';
  document.body.style.top = `-${currentScrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  document.body.classList.add('sheet-open');

  requestAnimationFrame(() => {
    sheet.classList.add('sheet-visible');
  });

  activeSheet = sheet;

  function closeSheet() {
    if (sheet) {
      sheet.classList.remove('sheet-visible');
      sheet.classList.add('sheet-exit');
    }
    if (overlay) {
      overlay.classList.remove('sheet-overlay-visible');
    }

    // Unlock scroll
    const savedScrollY = parseInt(document.body.dataset.scrollY || '0');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    delete document.body.dataset.scrollY;
    document.body.classList.remove('sheet-open');
    window.scrollTo(0, savedScrollY);

    setTimeout(() => {
      if (sheet && sheet.parentNode) sheet.remove();
      if (overlay && overlay.parentNode) overlay.remove();
      activeSheet = null;
      overlay = null;
      if (typeof onClose === 'function') onClose();
    }, 300);
  }

  return { close: closeSheet };
}

/**
 * Create a form group inside a sheet.
 */
export function formGroup(labelText, inputEl) {
  return el('div', { class: 'form-group' },
    el('label', { class: 'form-label' }, labelText),
    inputEl
  );
}

/**
 * Create a text input for forms.
 */
export function formInput(opts = {}) {
  return el('input', {
    type: opts.type || 'text',
    class: 'form-input',
    placeholder: opts.placeholder || '',
    value: opts.value || '',
    id: opts.id || '',
    min: opts.min,
    max: opts.max,
    step: opts.step,
    inputmode: opts.inputmode,
  });
}

/**
 * Create a select dropdown for forms.
 */
export function formSelect(opts = {}) {
  const select = el('select', { class: 'form-input', id: opts.id || '' });
  (opts.options || []).forEach((opt) => {
    const option = el('option', { value: opt.value }, opt.label);
    if (opt.value === opts.selected) option.selected = true;
    select.appendChild(option);
  });
  return select;
}
