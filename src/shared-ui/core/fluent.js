import {
  Listbox,
  Tablist, TablistTemplate, TablistStyles
} from '../vendor/fluent.js';

// Upstream 3.1.3 queues descendant connection work that may run after an
// entire template has been replaced. An unattached root has no getElementById.
// Keep the official template/behavior, but discard that obsolete work.
class WorkspaceTablist extends Tablist {
  setTabs(options) { if (this.isConnected) super.setTabs(options); }
  changeTab(previous, next) { if (this.isConnected) super.changeTab(previous, next); }
}
WorkspaceTablist.define({ name: 'tm-tablist', template: TablistTemplate, styles: TablistStyles });

// Fluent Dropdown discovers its listbox by the official fluent-listbox tag,
// so keep that tag and guard the queued callback on its shared prototype. A
// rerender can disconnect slotted options before FAST delivers old slot work.
Listbox.prototype.optionsChanged = function optionsChanged(_previous, next) {
  if (!this.isConnected || !next) return;
  next.forEach((option, index) => {
    const internals = option?.elementInternals;
    if (!internals) return;
    internals.ariaPosInSet = String(index + 1);
    internals.ariaSetSize = String(next.length);
  });
};

// UI-only behavior. No host, data, credential or persistence access belongs here.
const reduceMotion = () => {
  const preference = document.documentElement.dataset.motion || 'system';
  return preference === 'reduce'
    || (preference !== 'full' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};
let lastView = '';
let pendingNavigation = false;
let settingsSection = '';

export function syncFluentMotion(preference = 'system') {
  const motion = preference === 'on' || preference === 'reduce'
    ? 'reduce'
    : preference === 'off' || preference === 'full'
      ? 'full'
      : 'system';
  document.documentElement.dataset.motion = motion;
}

export function animateNavigation() {
  pendingNavigation = true;
}

function enter(element, kind = 'fade', delay = 0) {
  if (!element || reduceMotion() || typeof element.animate !== 'function') return;
  const frames = kind === 'fade'
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }];
  element.animate(frames, { duration: kind === 'fade' ? 150 : 200, delay, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)' });
}

function configureTabs(root) {
  root.querySelectorAll('tm-tablist').forEach((list, listIndex) => {
    const tabs = [...list.querySelectorAll('fluent-tab')];
    tabs.forEach((tab, index) => {
      tab.id ||= `${list.id || `view-tabs-${listIndex}`}-${index}`;
    });
    const active = tabs.find((tab) => tab.classList.contains('active')) || tabs[0];
    if (active) list.activeid = active.id;
    tabs.forEach((tab) => { tab.tabIndex = tab === active ? 0 : -1; });
  });
}

function settingsNavigation(root) {
  const layout = root.querySelector('.settings-layout');
  if (!layout || layout.querySelector('.settings-section-nav')) return;
  const sections = [...layout.querySelectorAll('.settings-form, .settings-info-panel, .settings-boundary-panel, .desktop-settings-group')];
  const nav = document.createElement('nav');
  nav.className = 'settings-section-nav';
  nav.setAttribute('aria-label', document.getElementById('pageTitle').textContent);
  const body = document.createElement('div');
  body.className = 'settings-sections';
  sections.forEach((section, index) => {
    section.id = `settings-section-${section.dataset.desktopGroup || index}`;
    const link = document.createElement('a');
    link.href = `#${section.id}`;
    link.id = `nav-${section.id}`;
    link.textContent = section.querySelector('h2')?.textContent || '';
    link.className = 'settings-section-link';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      settingsSection = section.id;
      body.querySelectorAll(':scope > section, :scope > form').forEach((item) => { item.hidden = item !== section; });
      nav.querySelectorAll('a').forEach((item) => item.toggleAttribute('aria-current', item === link));
      link.setAttribute('aria-current', 'location');
      section.querySelector('h2')?.focus({ preventScroll: true });
    });
    nav.append(link);
    // Retain the desktop settings boundary for delegated changes and patch reads.
    if (section.dataset.desktopGroup) section.setAttribute('data-desktop-settings', '');
    const title = section.querySelector('h2');
    if (title) title.tabIndex = -1;
    body.append(section);
  });
  layout.replaceChildren(nav, body);
  const selected = sections.find((section) => section.id === settingsSection) || sections[0];
  sections.forEach((section) => { section.hidden = section !== selected; });
  nav.querySelector(`[href="#${selected?.id}"]`)?.setAttribute('aria-current', 'location');
}

export function finishFluentRender(root, view) {
  configureTabs(document);
  settingsNavigation(root);
  // Use Fluent status badges and message bars while leaving domain charts and
  // data rows as semantic lists, tables, and custom visualizations.
  root.querySelectorAll('.badge:not(fluent-badge)').forEach((badge) => {
    const fluentBadge = document.createElement('fluent-badge');
    fluentBadge.appearance = 'tint';
    fluentBadge.shape = 'rounded';
    fluentBadge.size = 'small';
    fluentBadge.color = badge.classList.contains('bad') || badge.classList.contains('critical')
      ? 'danger'
      : badge.classList.contains('warn')
        ? 'warning'
        : badge.classList.contains('ok')
          ? 'success'
          : 'subtle';
    fluentBadge.className = badge.className;
    fluentBadge.style.cssText = badge.style.cssText;
    fluentBadge.append(...badge.childNodes);
    badge.replaceWith(fluentBadge);
  });
  root.querySelectorAll('.notice').forEach((notice) => {
    if (notice.tagName === 'FLUENT-MESSAGE-BAR') return;
    const message = document.createElement('fluent-message-bar');
    message.intent = notice.classList.contains('warn') ? 'warning' : notice.classList.contains('bad') ? 'error' : 'info';
    message.className = notice.className;
    message.classList.remove('muted', 'tiny');
    message.style.cssText = notice.style.cssText;
    message.setAttribute('role', notice.getAttribute('role') || 'status');
    message.append(...notice.childNodes);
    notice.replaceWith(message);
  });
  root.setAttribute('aria-busy', String(Boolean(root.querySelector('.loading-stack'))));
  if (view !== lastView || pendingNavigation) {
    enter(root);
    if (!lastView) [...root.querySelectorAll('.panel')].slice(0, 5).forEach((panel, index) => enter(panel, 'enter', index * 20));
    lastView = view;
    pendingNavigation = false;
  }
}

export function setupFluentInteractions() {
  const mobile = window.matchMedia('(max-width: 860px)');
  const syncNav = () => {
    const open = document.getElementById('app').classList.contains('nav-open');
    document.getElementById('navigationPane')?.toggleAttribute('inert', mobile.matches && !open);
  };
  mobile.addEventListener('change', syncNav);
  syncNav();
  document.addEventListener('keydown', (event) => {
    const tab = event.target.closest('fluent-tab');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = [...tab.closest('tm-tablist').querySelectorAll('fluent-tab:not([disabled])')];
      const index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      const target = tabs[next];
      const data = Object.entries(target.dataset);
      target.click();
      // Application renders replace the list synchronously; focus the new tab.
      queueMicrotask(() => {
        const candidates = [...document.querySelectorAll('fluent-tab')];
        candidates.find((item) => data.every(([key, value]) => item.dataset[key] === value))?.focus();
      });
    }
    if (event.key === 'Tab' && document.getElementById('app').classList.contains('nav-open')) {
      const targets = [...document.querySelectorAll('#navigationPane a[href], #navigationPane fluent-button:not([disabled])')].filter((item) => item.getClientRects().length);
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  document.addEventListener('toggle', (event) => {
    if (event.target.tagName === 'DETAILS' && event.target.open) enter(event.target.querySelector('.usage-row-detail, .device-detail-body'), 'enter');
  }, true);
}
