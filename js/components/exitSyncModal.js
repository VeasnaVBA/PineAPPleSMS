/**
 * Exit Confirmation Dialog Component
 * 
 * Intercepts Electron window close when unsynced/dirty changes exist,
 * presenting options to:
 * 1. Save to Drive & Exit (Primary)
 * 2. Exit Without Saving (Destructive/Secondary)
 * 3. Cancel (Ghost)
 */

import { Modal } from './modal.js';
import { getIcon } from './icons.js';
import { t } from '../i18n/i18n.js';
import { authService } from '../services/authService.js';
import { CloudSyncService } from '../services/cloudSyncService.js';

export class ExitSyncModal {
  static currentModal = null;
  static isOpen = false;

  /**
   * Open the Save Changes to Drive & Exit confirmation dialog
   */
  static open() {
    if (this.isOpen) return;
    this.isOpen = true;

    const title = t('cloudSync.exitModalTitle');
    const desc = t('cloudSync.exitModalDesc');

    const contentHtml = `
      <div class="flex items-start gap-3.5 py-1">
        <div class="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
          ${getIcon('cloudUpload', 'w-5 h-5')}
        </div>
        <div class="space-y-1.5 flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-foreground leading-snug">
            ${title}
          </h3>
          <p class="text-xs text-muted-foreground leading-relaxed">
            ${desc}
          </p>
        </div>
      </div>
    `;

    const footerHtml = `
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 w-full">
        <!-- Button 3: Cancel -->
        <button 
          id="btn-exit-cancel" 
          type="button" 
          class="order-3 sm:order-1 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-xs font-medium text-foreground transition-colors shadow-xs cursor-pointer">
          ${t('cloudSync.btnCancel')}
        </button>

        <!-- Button 2: Exit Without Saving -->
        <button 
          id="btn-exit-without-save" 
          type="button" 
          class="order-2 sm:order-2 px-3 py-2 rounded-md border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium transition-colors shadow-xs cursor-pointer">
          ${t('cloudSync.btnExitWithoutSaving')}
        </button>

        <!-- Button 1: Save to Drive & Exit -->
        <button 
          id="btn-exit-save-and-close" 
          type="button" 
          class="order-1 sm:order-3 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors shadow-xs cursor-pointer">
          <span class="btn-icon flex items-center">${getIcon('cloudUpload', 'w-3.5 h-3.5')}</span>
          <span class="btn-text">${t('cloudSync.btnSyncAndExit')}</span>
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: '',
      content: contentHtml,
      footer: footerHtml,
      maxWidth: 'max-w-md',
      backdropClose: false,
      preventUnsavedClose: false,
      onClose: () => {
        this.isOpen = false;
        this.currentModal = null;
      }
    });

    this.currentModal = modal;
    const modalEl = modal.element;

    const cancelBtn = modalEl.querySelector('#btn-exit-cancel');
    const exitWithoutSaveBtn = modalEl.querySelector('#btn-exit-without-save');
    const saveAndCloseBtn = modalEl.querySelector('#btn-exit-save-and-close');

    // 1. Cancel: Close modal and stay in app
    cancelBtn?.addEventListener('click', () => {
      this.close();
    });

    // 2. Exit Without Saving: Immediately force exit
    exitWithoutSaveBtn?.addEventListener('click', () => {
      this.forceExit();
    });

    // 3. Save to Drive & Exit: Sync, then force exit
    saveAndCloseBtn?.addEventListener('click', async () => {
      if (!saveAndCloseBtn) return;
      saveAndCloseBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (exitWithoutSaveBtn) exitWithoutSaveBtn.disabled = true;

      const iconSpan = saveAndCloseBtn.querySelector('.btn-icon');
      const textSpan = saveAndCloseBtn.querySelector('.btn-text');
      if (iconSpan) iconSpan.innerHTML = getIcon('loader2', 'w-3.5 h-3.5 animate-spin');
      if (textSpan) textSpan.textContent = t('cloudSync.syncing');

      try {
        const currentUser = authService.getCurrentUser();
        // Run full sync to Drive
        await CloudSyncService.pullToDrive(currentUser, { silent: false });
      } catch (err) {
        console.error('Exit sync error:', err);
      } finally {
        // Exit application regardless
        this.forceExit();
      }
    });
  }

  static close() {
    if (this.currentModal) {
      this.currentModal.close();
      this.currentModal = null;
    }
    this.isOpen = false;
  }

  static forceExit() {
    if (typeof window !== 'undefined' && window.electronAPI?.confirmExitForce) {
      window.electronAPI.confirmExitForce();
    } else {
      this.close();
    }
  }
}
