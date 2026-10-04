/**
 * Unified shadcn/ui-inspired Action Dropdown Menu for Data Tables
 * Offline-first, Accessible, Lightweight Vanilla JS
 */

import { getIcon } from './icons.js';

// Map to hold action definitions for rendered dropdown triggers
const dropdownActionMap = new Map();

// Active floating dropdown DOM reference and cleanup callbacks
let activeDropdown = null;
let activeTrigger = null;
let activeCleanup = null;

/**
 * Renders the Three-Dots (`...`) trigger button HTML string for table rows.
 * 
 * @param {Object} options
 * @param {string|number} options.id - Record ID
 * @param {Array<Object>} options.actions - Array of action items
 * @param {string} [options.buttonClass=''] - Additional CSS classes for trigger
 * @param {string} [options.title='Actions'] - Tooltip title
 * @returns {string} HTML string of trigger button
 */
export function renderActionDropdown({ id, actions = [], buttonClass = '', title = 'Actions' }) {
  const validActions = actions.filter(a => a && a.show !== false);
  const dropdownKey = `dropdown_${id}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Store actions in map
  dropdownActionMap.set(dropdownKey, { id, actions: validActions });

  return `
    <div class="relative inline-flex items-center justify-center">
      <button type="button"
              class="action-dropdown-trigger h-7 w-7 p-0 rounded-md border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all duration-150 shadow-2xs hover:shadow-xs active:scale-95 focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer select-none ${buttonClass}"
              data-dropdown-key="${dropdownKey}"
              data-id="${id}"
              title="${title}"
              aria-label="${title}"
              aria-haspopup="menu"
              aria-expanded="false">
        ${getIcon('moreHorizontal', 'w-3.5 h-3.5')}
      </button>
    </div>
  `;
}

/**
 * Manually opens a dropdown menu anchored to a given trigger element with custom actions.
 */
export function openActionDropdown(triggerEl, { id, actions = [] }) {
  if (!triggerEl || !actions || actions.length === 0) return;

  // If already open on the same trigger, close and return
  if (activeTrigger === triggerEl) {
    closeActiveDropdown();
    return;
  }

  // Close any currently open dropdown
  closeActiveDropdown();

  // Create floating menu attached directly to body to avoid table overflow clipping
  const menu = document.createElement('div');
  menu.id = 'active-action-dropdown-menu';
  menu.className = 'fixed z-[9999] w-[145px] max-w-[160px] rounded-lg border border-border/80 bg-card/95 backdrop-blur-md p-1 text-card-foreground shadow-lg shadow-black/10 dark:shadow-black/60 font-sans select-none focus:outline-none transition-opacity duration-100 opacity-0';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('tabindex', '-1');

  // Build menu items HTML
  menu.innerHTML = actions.map((act, index) => {
    if (act.separator) {
      return `<div class="h-px bg-border/60 my-0.5" role="separator"></div>`;
    }

    const isDestructive = !!act.destructive;
    const isDisabled = !!act.disabled;
    
    let itemStyle = 'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] font-medium font-khmer transition-colors cursor-pointer select-none text-foreground hover:bg-accent hover:text-accent-foreground';
    let iconStyle = 'w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0';

    if (isDestructive) {
      itemStyle = 'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] font-medium font-khmer transition-colors cursor-pointer select-none text-destructive hover:bg-destructive/10 hover:text-destructive mt-0.5 pt-1.5 border-t border-border/60';
      iconStyle = 'w-3.5 h-3.5 text-destructive group-hover:text-destructive transition-colors shrink-0';
    }

    if (isDisabled) {
      itemStyle += ' opacity-40 pointer-events-none cursor-not-allowed';
    }

    const iconHtml = act.icon ? `
      <span class="shrink-0 flex items-center justify-center">
        ${getIcon(act.icon, iconStyle)}
      </span>
    ` : '';

    return `
      <button type="button"
              class="action-dropdown-item ${itemStyle}"
              data-item-index="${index}"
              role="menuitem"
              ${isDisabled ? 'disabled' : ''}>
        ${iconHtml}
        <span class="truncate flex-1 text-left">${act.label || ''}</span>
      </button>
    `;
  }).join('');

  document.body.appendChild(menu);
  activeDropdown = menu;
  activeTrigger = triggerEl;
  
  // Highlight active trigger button
  triggerEl.setAttribute('aria-expanded', 'true');
  triggerEl.classList.add('bg-primary/10', 'text-primary', 'border-primary/40', 'ring-1', 'ring-primary/30');

  // Compute position immediately and on animation frame
  positionDropdown(triggerEl, menu);
  requestAnimationFrame(() => {
    positionDropdown(triggerEl, menu);
    menu.classList.remove('opacity-0');
    menu.classList.add('opacity-100');
  });

  // Bind click handlers to menu items
  menu.querySelectorAll('.action-dropdown-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-item-index'), 10);
      const action = actions[idx];
      closeActiveDropdown();
      if (action && typeof action.onClick === 'function' && !action.disabled) {
        action.onClick(id, e);
      }
    });
  });

  // Global listeners for closing
  const handlePointerDown = (e) => {
    if (!menu.contains(e.target) && !triggerEl.contains(e.target)) {
      closeActiveDropdown();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeActiveDropdown();
      triggerEl.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNextItem(menu, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNextItem(menu, -1);
    }
  };

  const handleScrollOrResize = (e) => {
    if (e && e.target && menu.contains(e.target)) return;
    closeActiveDropdown();
  };

  window.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('scroll', handleScrollOrResize, true);
  window.addEventListener('resize', handleScrollOrResize, true);

  activeCleanup = () => {
    window.removeEventListener('pointerdown', handlePointerDown, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('scroll', handleScrollOrResize, true);
    window.removeEventListener('resize', handleScrollOrResize, true);
  };
}

/**
 * Positions the floating dropdown menu relative to the trigger element,
 * auto-flipping upwards if there isn't enough space below.
 */
function positionDropdown(triggerEl, menuEl) {
  const triggerRect = triggerEl.getBoundingClientRect();
  const menuWidth = menuEl.offsetWidth || 145;
  const menuHeight = menuEl.offsetHeight || 120;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 6;

  // Horizontal position: Right align with trigger button (aligning right edges)
  let left = triggerRect.right - menuWidth;
  if (left + menuWidth > viewportWidth - margin) {
    left = viewportWidth - menuWidth - margin;
  }
  if (left < margin) {
    left = Math.max(margin, triggerRect.left);
  }

  // Vertical position: Check if space below exists
  const spaceBelow = viewportHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;

  let top;
  if (spaceBelow >= menuHeight + margin || spaceBelow >= spaceAbove) {
    top = triggerRect.bottom + 4;
  } else {
    top = triggerRect.top - menuHeight - 4;
  }

  top = Math.max(margin, Math.min(top, viewportHeight - menuHeight - margin));

  menuEl.style.top = `${Math.round(top)}px`;
  menuEl.style.left = `${Math.round(left)}px`;
}

/**
 * Navigates focus up/down in dropdown
 */
function focusNextItem(menuEl, direction) {
  const items = Array.from(menuEl.querySelectorAll('.action-dropdown-item:not([disabled])'));
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement);
  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) nextIndex = items.length - 1;
  if (nextIndex >= items.length) nextIndex = 0;
  items[nextIndex]?.focus();
}

/**
 * Closes the currently active dropdown menu
 */
export function closeActiveDropdown() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  if (activeTrigger) {
    activeTrigger.setAttribute('aria-expanded', 'false');
    activeTrigger.classList.remove('bg-primary/10', 'text-primary', 'border-primary/40', 'ring-1', 'ring-primary/30');
    activeTrigger = null;
  }
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
}

// Global delegated click listener for any `.action-dropdown-trigger`
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.action-dropdown-trigger');
    if (!trigger) return;
    
    e.preventDefault();
    e.stopPropagation();

    const key = trigger.getAttribute('data-dropdown-key');
    if (key && dropdownActionMap.has(key)) {
      const data = dropdownActionMap.get(key);
      openActionDropdown(trigger, data);
    }
  });
}
