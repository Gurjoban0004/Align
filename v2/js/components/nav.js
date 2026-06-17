// =============================================================
// ALIGN v2 — Navigation Components
// Mobile bottom tab bar + Desktop top nav
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import { getState } from '../state.js';
import { navigate, getCurrentRoute } from '../router.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home',     icon: 'home' },
  { id: 'fitness',   label: 'Fitness',  icon: 'dumbbell' },
  { id: 'habits',    label: 'Habits',   icon: 'checkSquare' },
  { id: 'media',     label: 'Media',    icon: 'book' },
  { id: 'settings',  label: 'Settings', icon: 'settings' },
];

/**
 * Render the mobile bottom tab bar.
 */
export function renderBottomNav(container) {
  const nav = el('nav', { class: 'bottom-nav', id: 'mobile-nav' });

  NAV_ITEMS.forEach((item) => {
    const isActive = getCurrentRoute() === item.id;
    const btn = el('a', {
      class: `bottom-nav-item${isActive ? ' active' : ''}`,
      href: `#${item.id}`,
      dataset: { view: item.id },
      id: `nav-${item.id}`,
      'aria-label': item.label,
      onClick: (e) => {
        e.preventDefault();
        navigate(item.id);
      },
    },
      icon(ICONS[item.icon], { size: 22 }),
      el('span', {}, item.label)
    );
    nav.appendChild(btn);
  });

  container.appendChild(nav);
}

/**
 * Render the desktop top navigation bar.
 */
export function renderTopNav(container) {
  const header = el('header', { class: 'top-nav', id: 'desktop-nav' });
  const navInner = el('div', { class: 'nav-container' });

  // Brand
  const brand = el('a', {
    class: 'brand',
    href: '#dashboard',
    onClick: (e) => { e.preventDefault(); navigate('dashboard'); },
  },
    el('div', { class: 'brand-icon' },
      el('img', { src: './logo.svg', alt: 'Align', width: '28', height: '28' })
    ),
    el('span', {}, 'Align')
  );
  navInner.appendChild(brand);

  // Desktop menu
  const menu = el('div', { class: 'desktop-menu' });

  NAV_ITEMS.forEach((item) => {
    const isActive = getCurrentRoute() === item.id;
    const link = el('a', {
      class: `nav-link${isActive ? ' active' : ''}`,
      href: `#${item.id}`,
      dataset: { view: item.id },
      onClick: (e) => {
        e.preventDefault();
        navigate(item.id);
      },
    }, item.label);
    menu.appendChild(link);
  });

  navInner.appendChild(menu);
  header.appendChild(navInner);
  container.appendChild(header);
}

/**
 * Update active states on navigation change.
 */
export function updateNavActive(viewName) {
  // Mobile
  document.querySelectorAll('.bottom-nav-item').forEach((btn) => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle('active', isActive);
  });

  // Desktop
  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.dataset.view === viewName;
    link.classList.toggle('active', isActive);
  });
}
