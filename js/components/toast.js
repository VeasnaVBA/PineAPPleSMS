/**
 * Toast notifications inspired by Sonner (Emil Kowalski) & shadcn/ui
 * High-craft micro-interactions: spring entry, soft blur, tactile dismiss, and stacking physics.
 */
import { getIcon } from './icons.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('toast-container')) {
      this.container = document.getElementById('toast-container');
      return;
    }
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-3';
    document.body.appendChild(this.container);
  }

  show({ message, title = '', type = 'info', duration = 3500, action = null }) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border bg-card/95 text-card-foreground backdrop-blur-xl animate-toast transition-all duration-150 transform hover:shadow-2xl ${this.getTypeStyles(type)}`;
    toast.style.boxShadow = '0 10px 28px -6px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)';

    let iconSvg = '';
    if (type === 'success') iconSvg = `<span class="p-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">${getIcon('check', 'w-4 h-4')}</span>`;
    else if (type === 'error') iconSvg = `<span class="p-1 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">${getIcon('x', 'w-4 h-4')}</span>`;
    else if (type === 'warning') iconSvg = `<span class="p-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">${getIcon('alertTriangle', 'w-4 h-4')}</span>`;
    else iconSvg = `<span class="p-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">${getIcon('bell', 'w-4 h-4')}</span>`;

    toast.innerHTML = `
      <div class="flex-shrink-0 mt-0.5">${iconSvg}</div>
      <div class="flex-1 min-w-0 pr-1">
        ${title ? `<h5 class="text-xs font-bold tracking-tight text-foreground leading-snug">${title}</h5>` : ''}
        <p class="text-xs text-muted-foreground leading-relaxed mt-0.5">${message}</p>
        ${action && action.label ? `
          <button type="button" class="toast-action-btn mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs cursor-pointer">
            ${action.label}
          </button>
        ` : ''}
      </div>
      <button class="toast-close text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer flex-shrink-0 -mr-1 -mt-1">
        ${getIcon('x', 'w-3.5 h-3.5')}
      </button>
    `;

    this.container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const actionBtn = toast.querySelector('.toast-action-btn');
    const dismiss = () => {
      toast.classList.remove('animate-toast');
      toast.classList.add('animate-toast-exit');
      setTimeout(() => toast.remove(), 140);
    };

    closeBtn?.addEventListener('click', dismiss);
    actionBtn?.addEventListener('click', () => {
      try {
        if (typeof action.onClick === 'function') action.onClick();
      } catch (err) {
        console.error('Toast action error:', err);
      }
      dismiss();
    });

    const effectiveDuration = action && duration === 3500 ? 10000 : duration;
    if (effectiveDuration > 0) {
      setTimeout(dismiss, effectiveDuration);
    }
  }

  getTypeStyles(type) {
    switch (type) {
      case 'success':
        return 'border-emerald-500/25';
      case 'error':
        return 'border-destructive/30';
      case 'warning':
        return 'border-amber-500/30';
      default:
        return 'border-border/80';
    }
  }

  success(message, title = 'Success') {
    this.show({ message, title, type: 'success' });
  }

  error(message, title = 'Error') {
    this.show({ message, title, type: 'error' });
  }

  warning(message, title = 'Warning') {
    this.show({ message, title, type: 'warning' });
  }

  info(message, title = 'Notification') {
    this.show({ message, title, type: 'info' });
  }
}

export const toast = new ToastManager();
