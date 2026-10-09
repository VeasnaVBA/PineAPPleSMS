/**
 * Top Navbar Cloud Sync Component
 * 
 * Provides responsive buttons for:
 * 1. "Sync to Drive" (Exports active user's IndexedDB stores to Google Sheets)
 * 2. "Restore from Drive" (Retrieves data from Google Drive and restores into local IndexedDB)
 * 
 * Styled according to shadcn secondary/outline style (h-9, responsive, dark/light theme aware).
 */

import { getIcon } from './icons.js';
import { i18n, t } from '../i18n/i18n.js';
import { CloudSyncService } from '../services/cloudSyncService.js';
import { AdminDataService } from '../services/adminDataService.js';
import { authService } from '../services/authService.js';
import { syncStateManager } from '../services/syncStateManager.js';

export class NavbarSyncButtons {
  static isSyncing = false;
  static isRestoring = false;
  static unsubscribe = null;

  /**
   * Generates badge HTML according to current syncStateManager status
   */
  static renderBadgeHtml() {
    const status = syncStateManager.getSyncStatus();

    if (!status.isOnline) {
      return `
        <div id="topbar-sync-status-badge" class="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border select-none" title="${t('cloudSync.offlineWaiting')}">
          <span class="w-1.5 h-1.5 rounded-full bg-muted-foreground"></span>
          <span>${t('cloudSync.offlineWaiting')}</span>
        </div>
      `;
    }

    if (status.isAutoSyncing) {
      return `
        <div id="topbar-sync-status-badge" class="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 select-none animate-pulse" title="${t('cloudSync.autoSyncing')}">
          ${getIcon('loader2', 'w-3 h-3 animate-spin')}
          <span>${t('cloudSync.autoSyncing')}</span>
        </div>
      `;
    }

    if (status.isDirty) {
      return `
        <div id="topbar-sync-status-badge" class="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 select-none" title="${t('cloudSync.unsyncedChanges')}">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span>${t('cloudSync.unsyncedChanges')}</span>
        </div>
      `;
    }

    // Default: Clean / Synced
    return `
      <div id="topbar-sync-status-badge" class="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 select-none" title="${t('cloudSync.syncedToDrive')}">
        ${getIcon('check', 'w-3 h-3 text-emerald-600 dark:text-emerald-400')}
        <span>${t('cloudSync.syncedToDrive')}</span>
      </div>
    `;
  }

  /**
   * Generates HTML markup for the Top Navbar Sync button group
   */
  static renderHtml() {
    const isSyncActive = this.isSyncing;
    const isRestoreActive = this.isRestoring;
    const currentUser = authService.getCurrentUser();
    const isAdmin = currentUser?.role === 'ADMIN';
    const isKm = i18n.getLocale() === 'km';

    const saveTooltip = isAdmin
      ? (isKm ? 'រក្សាទុកគណនីអ្នកប្រើប្រាស់ និងសិទ្ធិទៅ Google Sheet ក្នុង Drive' : 'Save user accounts and permissions to Google Sheet in Drive')
      : t('cloudSync.saveToDriveTooltip');

    const restoreTooltip = isAdmin
      ? (isKm ? 'ទាញគណនីបង្ខំពី Google Sheet ក្នុង Drive (Force Get User Acc)' : 'Force get user accounts and permissions from Google Sheet in Drive')
      : (isKm ? 'ទាញទិន្នន័យបង្ខំពី Google Sheet ក្នុង Drive សម្រាប់គណនីនេះ (Force Get Data)' : 'Force get data from Google Sheet in Drive for this user account');

    const restoreLabelText = isAdmin
      ? (isKm ? 'ទាញគណនី' : 'Get User Acc')
      : (isKm ? 'ទាញទិន្នន័យ' : 'Get Data');

    const restoreLoadingText = isAdmin
      ? (isKm ? 'កំពុងទាញគណនី...' : 'Getting Accounts...')
      : (isKm ? 'កំពុងទាញយក...' : 'Getting Data...');

    return `
      <div id="topbar-cloud-sync-group" class="flex items-center gap-1.5 sm:gap-2">
        <!-- Live Sync Status Badge -->
        ${this.renderBadgeHtml()}

        <!-- Button: Save to Drive -->
        <button 
          id="btn-cloud-sync-to-drive"
          type="button"
          title="${saveTooltip}"
          ${isSyncActive ? 'disabled' : ''}
          class="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-xs cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed group shrink-0">
          <span class="btn-icon text-primary group-hover:scale-110 transition-transform flex items-center justify-center">
            ${isSyncActive ? getIcon('loader2', 'w-4 h-4 text-primary animate-spin') : getIcon('cloudUpload', 'w-4 h-4 text-primary')}
          </span>
        </button>

        <!-- Button: Get Data from Drive for User Account -->
        <button 
          id="btn-cloud-restore-from-drive"
          type="button"
          title="${restoreTooltip}"
          ${isRestoreActive ? 'disabled' : ''}
          class="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-xs cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed group shrink-0">
          <span class="btn-icon text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform flex items-center justify-center">
            ${isRestoreActive ? getIcon('loader2', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin') : getIcon('cloudDownload', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
          </span>
        </button>
      </div>
    `;
  }

  /**
   * Dynamically update badge without re-rendering entire topbar
   */
  static updateBadge(parentElement = document) {
    const group = parentElement.querySelector('#topbar-cloud-sync-group');
    if (!group) return;
    const oldBadge = group.querySelector('#topbar-sync-status-badge');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.renderBadgeHtml().trim();
    const newBadge = tempDiv.firstElementChild;
    if (oldBadge && newBadge) {
      oldBadge.replaceWith(newBadge);
    } else if (!oldBadge && newBadge) {
      group.prepend(newBadge);
    }
  }

  /**
   * Bind event listeners to the buttons
   */
  static bindEvents(parentElement = document) {
    const syncBtn = parentElement.querySelector('#btn-cloud-sync-to-drive');
    const restoreBtn = parentElement.querySelector('#btn-cloud-restore-from-drive');

    // Subscribe to real-time sync state updates
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.unsubscribe = syncStateManager.subscribe(() => {
      this.updateBadge(parentElement);
    });

    syncBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (this.isSyncing || this.isRestoring) return;

      this.setSyncLoading(true, parentElement);
      try {
        const currentUser = authService.getCurrentUser();
        if (currentUser?.role === 'ADMIN') {
          await AdminDataService.saveToGoogleSheet({ silent: false });
        } else {
          await CloudSyncService.pullToDrive(currentUser);
        }
      } finally {
        this.setSyncLoading(false, parentElement);
      }
    });

    restoreBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (this.isSyncing || this.isRestoring) return;

      this.setRestoreLoading(true, parentElement);
      const isKm = i18n.getLocale() === 'km';
      const currentUser = authService.getCurrentUser();
      const isAdmin = currentUser?.role === 'ADMIN';

      try {
        if (isAdmin) {
          const res = await AdminDataService.pullFromGoogleSheet({ silent: false, force: true });
          if (res?.success) {
            window.dispatchEvent(new CustomEvent('app:refresh-data'));
            window.dispatchEvent(new CustomEvent('users:reload'));
          }
        } else {
          await CloudSyncService.pushToApp(currentUser, { force: true });
        }
      } finally {
        this.setRestoreLoading(false, parentElement);
      }
    });
  }

  /**
   * Set loading spinner state for Sync to Drive button
   */
  static setSyncLoading(isLoading, parentElement = document) {
    this.isSyncing = isLoading;
    const syncBtn = parentElement.querySelector('#btn-cloud-sync-to-drive');
    const restoreBtn = parentElement.querySelector('#btn-cloud-restore-from-drive');
    if (!syncBtn) return;

    syncBtn.disabled = isLoading;
    if (restoreBtn) restoreBtn.disabled = isLoading;

    const iconSpan = syncBtn.querySelector('.btn-icon');
    if (iconSpan) {
      iconSpan.innerHTML = isLoading 
        ? getIcon('loader2', 'w-4 h-4 text-primary animate-spin') 
        : getIcon('cloudUpload', 'w-4 h-4 text-primary');
    }
  }

  /**
   * Set loading spinner state for Restore from Drive button
   */
  static setRestoreLoading(isLoading, parentElement = document) {
    this.isRestoring = isLoading;
    const syncBtn = parentElement.querySelector('#btn-cloud-sync-to-drive');
    const restoreBtn = parentElement.querySelector('#btn-cloud-restore-from-drive');
    if (!restoreBtn) return;

    restoreBtn.disabled = isLoading;
    if (syncBtn) syncBtn.disabled = isLoading;

    const iconSpan = restoreBtn.querySelector('.btn-icon');
    if (iconSpan) {
      iconSpan.innerHTML = isLoading 
        ? getIcon('loader2', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin') 
        : getIcon('cloudDownload', 'w-4 h-4 text-emerald-600 dark:text-emerald-400');
    }
  }
}
