/**
 * Reusable Modal and Confirmation Dialog Component
 * Inspired by shadcn/ui
 */
import { getIcon } from './icons.js';
import { t } from '../i18n/i18n.js';

function isFormDirty(modalEl) {
  if (!modalEl) return false;

  const inputs = modalEl.querySelectorAll('input, textarea, select');
  if (inputs.length === 0) return false;

  for (const el of inputs) {
    if (el.type === 'submit' || el.type === 'button' || el.type === 'hidden') continue;

    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== el.defaultChecked) return true;
    } else if (el.type === 'file') {
      if (el.files && el.files.length > 0) return true;
    } else if (el.tagName === 'SELECT') {
      const isDirty = Array.from(el.options).some(opt => opt.selected !== opt.defaultSelected);
      if (isDirty) return true;
    } else {
      if (!el.defaultValue && el.value.trim().length > 0) return true;
      if (el.defaultValue && el.value !== el.defaultValue) return true;
    }
  }

  // Check photo preview removal or change
  const removePhotoBtn = modalEl.querySelector('#btn-remove-photo, #btn-remove-t-photo');
  if (removePhotoBtn && !removePhotoBtn.classList.contains('hidden')) {
    return true;
  }

  return false;
}

export class Modal {
  /**
   * Open a general dialog modal
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string|HTMLElement} options.content - Modal body content
   * @param {string} [options.footer=''] - Modal footer action buttons
   * @param {string} [options.maxWidth='max-w-2xl'] - Max width class
   * @param {Function} [options.onClose=null] - Callback when modal is closed
   * @param {boolean} [options.backdropClose=false] - Whether clicking outside closes modal (defaults to false to protect forms)
   * @param {boolean} [options.preventUnsavedClose=true] - Whether to confirm discard if inputs are dirty
   */
  static open({
    title,
    content,
    footer = '',
    maxWidth = 'max-w-2xl',
    onClose = null,
    backdropClose = false,
    preventUnsavedClose = true
  }) {
    const modalId = 'modal-' + Date.now();
    const modalEl = document.createElement('div');
    modalEl.id = modalId;
    // Note: avoid select-none on dialog so users can freely select text without cursor glitches
    modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in';

    modalEl.innerHTML = `
      <div class="relative w-full ${maxWidth} bg-card border border-border rounded-xl shadow-lg flex flex-col max-h-[90vh] overflow-hidden transform transition-all animate-slide-down">
        <!-- Modal Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border select-none">
          <h3 class="text-lg font-semibold tracking-tight text-foreground">${title}</h3>
          <button class="btn-close-modal p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Close">
            ${getIcon('x', 'w-4 h-4')}
          </button>
        </div>

        <!-- Modal Body -->
        <div class="flex-1 overflow-y-auto p-6 text-foreground">
          ${typeof content === 'string' ? content : ''}
        </div>

        <!-- Modal Footer -->
        ${footer ? `
          <div class="px-6 py-4 border-t border-border bg-muted/40 flex items-center justify-end gap-2.5 select-none">
            ${footer}
          </div>
        ` : ''}
      </div>
    `;

    if (typeof content !== 'string' && content instanceof HTMLElement) {
      modalEl.querySelector('.overflow-y-auto').appendChild(content);
    }

    document.body.appendChild(modalEl);

    let isSaving = false;

    // Track save/submit button actions so that legitimate form saving closes immediately without dirty confirmation
    modalEl.querySelectorAll('button[id*="save"], button[id*="submit"], button[type="submit"], .btn-save').forEach(btn => {
      btn.addEventListener('click', () => {
        isSaving = true;
        setTimeout(() => { isSaving = false; }, 4000);
      });
    });

    modalEl.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', () => {
        isSaving = true;
        setTimeout(() => { isSaving = false; }, 4000);
      });
    });

    const close = (force = false) => {
      // Check for unsaved changes unless save was executed or close is forced
      if (!force && !isSaving && preventUnsavedClose && isFormDirty(modalEl)) {
        const isKm = (typeof i18n !== 'undefined' && i18n.getLocale) ? i18n.getLocale() === 'km' : false;
        const confirmMsg = isKm
          ? 'អ្នកមានទិន្នន័យដែលមិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់បោះបង់ និងបិទផ្ទាំងនេះមែនទេ?'
          : 'You have unsaved changes in this form. Are you sure you want to discard them and close?';
        if (!window.confirm(confirmMsg)) {
          return false;
        }
      }

      document.removeEventListener('keydown', handleKeydown);
      modalEl.classList.add('opacity-0');
      setTimeout(() => {
        modalEl.remove();
        if (onClose) onClose();
      }, 150);
      return true;
    };

    const forceClose = () => close(true);

    // Close on explicit "X" header button click
    modalEl.querySelector('.btn-close-modal')?.addEventListener('click', () => close(false));

    // Outside Click / Backdrop Logic:
    // 1. If backdropClose is false (default for forms): clicking the backdrop NEVER closes the modal.
    // 2. If backdropClose is true: require BOTH mousedown AND click directly on modalEl.
    //    This guarantees selecting text inside form inputs and dragging outside will NEVER close the modal.
    let isMouseDownOnBackdrop = false;
    modalEl.addEventListener('mousedown', (e) => {
      isMouseDownOnBackdrop = (e.target === modalEl);
    });

    modalEl.addEventListener('click', (e) => {
      if (backdropClose && isMouseDownOnBackdrop && e.target === modalEl) {
        close(false);
      }
      isMouseDownOnBackdrop = false;
    });

    // Escape key listener (respects unsaved changes protection)
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        close(false);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    return {
      element: modalEl,
      close,
      forceClose
    };
  }

  /**
   * Reusable confirmation dialog
   */
  static confirm({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = null,
    cancelText = null,
    destructive = false,
    onConfirm
  }) {
    const finalConfirmText = confirmText || (destructive ? t('common.delete') : t('common.confirm'));
    const finalCancelText = cancelText || t('common.cancel');

    const contentHtml = `
      <div class="flex items-start gap-4">
        <div class="p-3 rounded-full ${destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'} flex-shrink-0">
          ${getIcon(destructive ? 'shield' : 'info', 'w-6 h-6')}
        </div>
        <div class="space-y-1">
          <p class="text-sm text-foreground font-medium">${title}</p>
          <p class="text-xs text-muted-foreground leading-relaxed">${message}</p>
        </div>
      </div>
    `;

    const footerHtml = `
      <button id="modal-cancel-btn" class="px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors shadow-sm">
        ${finalCancelText}
      </button>
      <button id="modal-confirm-btn" class="px-4 py-2 rounded-md ${destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'} text-sm font-medium shadow-sm transition-colors">
        ${finalConfirmText}
      </button>
    `;

    const modal = this.open({
      title,
      content: contentHtml,
      footer: footerHtml,
      maxWidth: 'max-w-md'
    });

    modal.element.querySelector('#modal-cancel-btn')?.addEventListener('click', () => {
      modal.close();
    });

    modal.element.querySelector('#modal-confirm-btn')?.addEventListener('click', async () => {
      modal.close();
      if (onConfirm) await onConfirm();
    });

    return modal;
  }

  /**
   * Close all active dialog modals in the document
   * @param {boolean} [force=true]
   */
  static closeAll(force = true) {
    document.querySelectorAll('[id^="modal-"]').forEach(modalEl => {
      modalEl.classList.add('opacity-0');
      setTimeout(() => {
        modalEl.remove();
      }, 100);
    });
  }
}
