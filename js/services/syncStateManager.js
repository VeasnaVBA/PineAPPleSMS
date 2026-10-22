/**
 * Sync State Manager
 * 
 * Centralized tracker for data modifications (dirty state),
 * debounced background auto-synchronization to Google Drive (5s idle),
 * online/offline connectivity awareness, browser `beforeunload` warning,
 * and Electron window close interception.
 */

import { authService } from './authService.js';
import { getCloudSyncUrl } from '../config/cloudSync.js';
import { CloudSyncService } from './cloudSyncService.js';
import { AdminDataService } from './adminDataService.js';
import { ExitSyncModal } from '../components/exitSyncModal.js';
import { setWorkspaceMutationCallback } from '../database/db.js';

export const AUTO_SAVE_INTERVAL_KEY = 'school_auto_save_interval';
export const DEFAULT_AUTO_SAVE_INTERVAL = 1500;

export const AUTO_SAVE_PRESETS = [
  { value: 1500, labelKm: '១.៥ វិនាទី (ភ្លាមៗ - លំនាំដើម)', labelEn: '1.5 seconds (Instant - Default)' },
  { value: 3000, labelKm: '៣ វិនាទី', labelEn: '3 seconds' },
  { value: 5000, labelKm: '៥ វិនាទី', labelEn: '5 seconds' },
  { value: 10000, labelKm: '១០ វិនាទី', labelEn: '10 seconds' },
  { value: 30000, labelKm: '៣០ វិនាទី', labelEn: '30 seconds' },
  { value: 60000, labelKm: '១ នាទី', labelEn: '1 minute' },
  { value: 120000, labelKm: '២ នាទី', labelEn: '2 minutes' },
  { value: 300000, labelKm: '៥ នាទី', labelEn: '5 minutes' },
  { value: 0, labelKm: 'បិទ Auto-Save (រក្សាទុកដោយដៃ)', labelEn: 'Disable Auto-Save (Manual only)' }
];

class SyncStateManager {
  constructor() {
    this._isDirty = false;
    this._mutationCount = 0;
    this._syncedMutationCount = 0;
    this._lastSyncedTimestamp = null;
    this._autoSyncTimer = null;
    this._isAutoSyncing = false;
    this._listeners = new Set();
    this._initialized = false;
    this._notifyRaf = null;
    this.DEBOUNCE_MS = this.getAutoSyncInterval();
  }

  /**
   * Get current auto-save debounce delay in milliseconds
   */
  getAutoSyncInterval() {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(AUTO_SAVE_INTERVAL_KEY);
        if (val !== null) {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            return parsed;
          }
        }
      }
    } catch (_) {}
    return DEFAULT_AUTO_SAVE_INTERVAL;
  }

  /**
   * Set and persist auto-save interval for this client
   * @param {number|string} intervalMs - Milliseconds (e.g. 1500, 5000, 0 for off)
   */
  setAutoSyncInterval(intervalMs) {
    const parsed = parseInt(intervalMs, 10);
    const validVal = (!isNaN(parsed) && parsed >= 0) ? parsed : DEFAULT_AUTO_SAVE_INTERVAL;
    this.DEBOUNCE_MS = validVal;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTO_SAVE_INTERVAL_KEY, String(validVal));
      }
    } catch (_) {}

    if (this._autoSyncTimer) {
      clearTimeout(this._autoSyncTimer);
      this._autoSyncTimer = null;
      if (validVal > 0 && this._isDirty) {
        this.scheduleAutoSync(validVal);
      }
    }

    this.notify();
    return validVal;
  }

  /**
   * Get localized label for current auto-save interval
   */
  getIntervalLabel(locale = 'km') {
    const curVal = this.getAutoSyncInterval();
    const match = AUTO_SAVE_PRESETS.find(p => p.value === curVal);
    if (match) {
      return locale === 'km' ? match.labelKm : match.labelEn;
    }
    if (curVal === 0) return locale === 'km' ? 'បិទ Auto-Save' : 'Disabled';
    const seconds = Math.round(curVal / 1000);
    return locale === 'km' ? `${seconds} វិនាទី` : `${seconds}s`;
  }

  /**
   * Initialize lifecycle listeners (online/offline, beforeunload, Electron IPC, database mutations,
   * and global Save/Submit button & table input auto-save triggers)
   */
  init() {
    this.DEBOUNCE_MS = this.getAutoSyncInterval();
    if (this._initialized) return;
    this._initialized = true;

    // Connect central workspace database mutation listener
    setWorkspaceMutationCallback((storeName, op) => {
      this.markDirty(`${storeName}.${op}`);
    });

    if (typeof window !== 'undefined') {
      // 1. Online / Offline network listeners
      window.addEventListener('online', () => {
        this.notify();
        // If there were unsynced changes accumulated while offline, trigger auto-sync
        if (this._isDirty && !this._isAutoSyncing) {
          this.scheduleAutoSync(1000);
        }
      });

      window.addEventListener('offline', () => {
        this.notify();
      });

      // 2. Standard Web Browser Exit Fallback (beforeunload)
      window.addEventListener('beforeunload', (event) => {
        if (this._isDirty) {
          event.preventDefault();
          event.returnValue = ''; // Native browser dialog
          return '';
        }
      });

      // 3. Electron Window Close Interception Bridge
      if (window.electronAPI) {
        if (typeof window.electronAPI.onCheckUnsyncedStatus === 'function') {
          window.electronAPI.onCheckUnsyncedStatus(() => {
            const hasUnsynced = this.isDirty();
            if (typeof window.electronAPI.sendUnsyncedStatusResponse === 'function') {
              window.electronAPI.sendUnsyncedStatusResponse({ hasUnsyncedChanges: hasUnsynced });
            }
          });
        }

        if (typeof window.electronAPI.onShowExitSaveModal === 'function') {
          window.electronAPI.onShowExitSaveModal(() => {
            ExitSyncModal.open();
          });
        }
      }

      // 4. Global Save & Submit Button Click Interceptor:
      // Guarantees immediate background Google Drive sync whenever ANY save or submit button is clicked in the app
      document.addEventListener('click', (event) => {
        const target = event.target?.closest?.('button, input[type="submit"], input[type="button"], a[role="button"]');
        if (!target) return;

        // Skip anything inside login form or login screen
        if (target.closest('#login-form, #login-container, .login-page') || target.id === 'btn-login-submit') {
          return;
        }

        const btnId = (target.id || '').toLowerCase();
        const btnClass = (target.className || '').toLowerCase();
        const btnText = (target.textContent || '').trim().toLowerCase();
        const isSaveOrSubmit = 
          target.type === 'submit' ||
          btnId.includes('save') || 
          btnId.includes('submit') ||
          btnClass.includes('btn-save') || 
          btnClass.includes('save-btn') || 
          btnClass.includes('btn-submit') ||
          btnText === 'រក្សាទុក' || 
          btnText.includes('រក្សាទុក') || 
          btnText === 'save' || 
          btnText.includes('save') ||
          btnText.includes('submit');

        if (isSaveOrSubmit) {
          // Allow 150ms for local IndexedDB transaction to settle, then fire auto-sync to Drive
          setTimeout(() => {
            this.markDirty('button.click');
            this.scheduleAutoSync(200);
          }, 150);
        }
      }, true);

      // 5. Global Form Submit Interceptor
      document.addEventListener('submit', (e) => {
        if (e.target?.id === 'login-form' || e.target?.closest('#login-container, .login-page')) {
          return;
        }
        setTimeout(() => {
          this.markDirty('form.submit');
          this.scheduleAutoSync(200);
        }, 150);
      }, true);

      // 6. Global Table Input & Textbox Interceptor:
      // Catches inline changes to table cells (Scores, Attendance, Student/Teacher inline edits)
      document.addEventListener('change', (event) => {
        const target = event.target;
        if (!target) return;
        if (target.closest('#login-container, #login-form, .login-page')) {
          return;
        }
        // Exclude filter / view controls that only adjust local search/filter state, not database data
        if (
          target.id === 'filter-teacher-status' ||
          target.id === 'select-filter-field' ||
          target.id === 'select-filter-value' ||
          target.id === 'filter-class' ||
          target.id === 'filter-student-status' ||
          target.id === 'filter-academic-year' ||
          target.closest('.filter-control, [data-filter], .search-box')
        ) {
          return;
        }

        if (target.matches?.('input, select, textarea, [contenteditable="true"]')) {
          if (target.closest('table, tr, td, form, .score-cell-input, [data-row-idx], .att-cell-btn')) {
            setTimeout(() => {
              this.markDirty('input.change');
              this.scheduleAutoSync(Math.min(this.DEBOUNCE_MS || 1500, 1500));
            }, 100);
          }
        }
      }, true);
    }
  }

  /**
   * Mark local database state as having unsaved/unsynced changes
   * @param {string} [source=''] - Informative source tag (e.g. 'scores.batch', 'students.create')
   */
  markDirty(source = '') {
    this._isDirty = true;
    this._mutationCount++;
    this.notify();
    this.scheduleAutoSync(this.DEBOUNCE_MS);
  }

  /**
   * Mark state as clean / synchronized
   */
  markClean() {
    this._isDirty = false;
    this._isAutoSyncing = false;
    this._syncedMutationCount = this._mutationCount;
    this._lastSyncedTimestamp = new Date().toISOString();
    if (this._autoSyncTimer) {
      clearTimeout(this._autoSyncTimer);
      this._autoSyncTimer = null;
    }
    this.notify();
  }

  /**
   * Check whether unsynced changes currently exist
   */
  isDirty() {
    return this._isDirty;
  }

  /**
   * Returns current sync metadata
   */
  getSyncStatus() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    return {
      isDirty: this._isDirty,
      isAutoSyncing: this._isAutoSyncing,
      lastSyncedTimestamp: this._lastSyncedTimestamp,
      autoSaveInterval: this.DEBOUNCE_MS,
      isOnline
    };
  }

  /**
   * Debounced Auto-Sync Engine
   * Waits for idle interval before firing background sync to Google Drive
   */
  scheduleAutoSync(delayMs = this.DEBOUNCE_MS) {
    if (this._autoSyncTimer) {
      clearTimeout(this._autoSyncTimer);
      this._autoSyncTimer = null;
    }

    if (this.DEBOUNCE_MS === 0) {
      // Auto-save disabled by Admin; user saves manually
      return;
    }

    const waitMs = (delayMs !== undefined && delayMs !== null && delayMs >= 0) ? delayMs : this.DEBOUNCE_MS;
    if (waitMs < 0) return;

    this._autoSyncTimer = setTimeout(async () => {
      // If a sync is already running in background, re-schedule to run once it finishes
      if (this._isAutoSyncing) {
        this.scheduleAutoSync(Math.max(1000, this.DEBOUNCE_MS));
        return;
      }
      await this.triggerAutoSync();
    }, waitMs);
  }

  /**
   * Executes background sync to Google Drive
   * @param {Object} [options={}] - Options (e.g. { force: true } to sync immediately even if interval is manual)
   */
  async triggerAutoSync(options = {}) {
    const force = options?.force === true;

    // Check prerequisites
    if (!this._isDirty && !force) return;
    if (this._isAutoSyncing) return;
    if (this.DEBOUNCE_MS === 0 && !force) return;

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      this.notify();
      return;
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser || !currentUser.username) {
      return;
    }

    // Postpone if CloudSyncService is currently in flight restoring or pushing
    if (CloudSyncService.isBusy && CloudSyncService.isBusy()) {
      console.log('[SyncStateManager] Restore/push in progress, postponing auto-sync...');
      this.scheduleAutoSync(2000);
      return;
    }

    // Safety defense: if local workspace has 0 records across all primary stores on this device,
    // do NOT push empty data to Drive! Instead mark clean and pull latest data from Drive!
    try {
      const { db } = await import('../database/db.js');
      const schCount = await db.count('schools').catch(() => 0);
      const tchCount = await db.count('teachers').catch(() => 0);
      const clsCount = await db.count('classes').catch(() => 0);
      const stdCount = await db.count('students').catch(() => 0);
      if (schCount === 0 && tchCount === 0 && clsCount === 0 && stdCount === 0 && !force) {
        console.log('[SyncStateManager] Local database is empty on this client. Skipping push to protect Drive and pulling latest data...');
        this.markClean();
        await CloudSyncService.checkAndSyncOnStartup(currentUser);
        return;
      }
    } catch (_) {}

    // Capture mutation generation before starting background I/O
    const syncGen = this._mutationCount;
    this._isAutoSyncing = true;
    this.notify();

    try {
      console.log(`[SyncStateManager] Auto-syncing workspace changes to Google Drive for @${currentUser.username}...`);

      let success = false;
      if (currentUser.role === 'ADMIN') {
        const resAdmin = await AdminDataService.saveToGoogleSheet({ silent: true });
        const resWs = await CloudSyncService.pullToDrive(currentUser, { silent: true });
        success = Boolean(resAdmin?.success) || Boolean(resWs);
      } else {
        success = await CloudSyncService.pullToDrive(currentUser, { silent: true });
      }

      if (success) {
        this._lastSyncedTimestamp = new Date().toISOString();
        if (this._mutationCount === syncGen) {
          // No new mutations arrived during the sync operation
          this._isDirty = false;
          this._isAutoSyncing = false;
          this._syncedMutationCount = syncGen;
          this.notify();
          console.log(`[SyncStateManager] Auto-sync complete and state clean for @${currentUser.username}.`);
        } else {
          // New mutations were recorded while sync was in flight; schedule follow-up sync
          console.log(`[SyncStateManager] New changes arrived during sync. Re-queuing auto-sync...`);
          this._isDirty = true;
          this._isAutoSyncing = false;
          this.notify();
          this.scheduleAutoSync(this.DEBOUNCE_MS);
        }
      } else {
        this._isAutoSyncing = false;
        this.notify();
        // If sync failed (e.g. temporary server glitch), retry automatically after 4 seconds
        if (this._isDirty) {
          this.scheduleAutoSync(4000);
        }
      }
    } catch (err) {
      console.warn('[SyncStateManager] Background auto-sync failed (will retry):', err);
      this._isAutoSyncing = false;
      this.notify();
      // Retry automatically on network/request exception
      if (this._isDirty) {
        this.scheduleAutoSync(4000);
      }
    }
  }

  /**
   * Immediately marks dirty, cancels pending debounce timers, and fires an instant Google Drive sync
   */
  async syncNow(source = '') {
    this._isDirty = true;
    this._mutationCount++;
    if (this._autoSyncTimer) {
      clearTimeout(this._autoSyncTimer);
      this._autoSyncTimer = null;
    }
    this.notify();
    return await this.triggerAutoSync({ force: true });
  }

  /**
   * State observer subscription
   */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  notify() {
    const trigger = () => {
      const status = this.getSyncStatus();
      for (const listener of this._listeners) {
        try {
          listener(status);
        } catch (err) {
          console.error('Error in sync state listener:', err);
        }
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      if (this._notifyRaf) cancelAnimationFrame(this._notifyRaf);
      this._notifyRaf = requestAnimationFrame(trigger);
    } else {
      trigger();
    }
  }
}

export const syncStateManager = new SyncStateManager();
