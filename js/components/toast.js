/**
 * Toast notifications inspired by shadcn/ui
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
    this.container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4';
    document.body.appendChild(this.container);
  }

  show({ message, title = '', type = 'info', duration = 3500, action = null }) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border bg-card text-card-foreground backdrop-blur-md transition-all duration-200 transform translate-y-2 opacity-0 animate-slide-down ${this.getTypeStyles(type)}`;

    let iconSvg = '';
    if (type === 'success') iconSvg = getIcon('check', 'w-5 h-5 text-emerald-500');
    else if (type === 'error') iconSvg = getIcon('x', 'w-5 h-5 text-destructive');
    else iconSvg = getIcon('bell', 'w-5 h-5 text-primary');

    toast.innerHTML = `
      <div class="flex-shrink-0 mt-0.5">${iconSvg}</div>
      <div class="flex-1 min-w-0">
        ${title ? `<h5 class="text-sm font-semibold tracking-tight text-foreground leading-tight">${title}</h5>` : ''}
        <p class="text-xs text-muted-foreground leading-relaxed mt-0.5">${message}</p>
        ${action && action.label ? `
          <button type="button" class="toast-action-btn mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer">
            ${action.label}
          </button>
        ` : ''}
      </div>
      <button class="toast-close text-muted-foreground hover:text-foreground ml-2 p-1 rounded-md hover:bg-accent transition-colors">
        ${getIcon('x', 'w-3.5 h-3.5')}
      </button>
    `;

    this.container.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    const closeBtn = toast.querySelector('.toast-close');
    const actionBtn = toast.querySelector('.toast-action-btn');
    const dismiss = () => {
      toast.classList.add('opacity-0', 'translate-x-full');
      setTimeout(() => toast.remove(), 250);
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
        return 'border-emerald-500/30';
      case 'error':
        return 'border-destructive/40';
      default:
        return 'border-border';
    }
  }

  success(message, title = 'Success') {
    this.show({ message, title, type: 'success' });
  }

  error(message, title = 'Error') {
    this.show({ message, title, type: 'error' });
  }

  info(message, title = 'Notification') {
    this.show({ message, title, type: 'info' });
  }
}

export const toast = new ToastManager();
