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
    this._lastSyncedTimestamp = null;
    this._autoSyncTimer = null;
    this._isAutoSyncing = false;
    this._listeners = new Set();
    this._initialized = false;
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
   * Initialize lifecycle listeners (online/offline, beforeunload, Electron IPC, database mutations)
   */
  init() {
    this.DEBOUNCE_MS = this.getAutoSyncInterval();
    if (this._initialized) return;
    this._initialized = true;

    // Connect central workspace database mutation listener
    setWorkspaceMutationCallback((storeName, op) => {
      this.markDirty(`${storeName}.${op}`);
    });

    // 1. Online / Offline network listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('workspace:data-mutation', (e) => {
        const { storeName, operation } = e.detail || {};
        this.markDirty(`${storeName || 'workspace'}.${operation || 'change'}`);
      });

      window.addEventListener('online', () => {
        this.notify();
        // If there were unsynced changes accumulated while offline, trigger auto-sync
        if (this._isDirty && !this._isAutoSyncing) {
          this.scheduleAutoSync(1500); // 1.5s after coming online
        }
      });

      window.addEventListener('offline', () => {
        this.notify();
      });

      // 2. Standard Web Browser Exit Fallback (beforeunload)
      window.addEventListener('beforeunload', (event) => {
        if (this._isDirty) {
          event.preventDefault();
          event.returnValue = ''; // Native browser "Leave site? Changes may not be saved" dialog
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
    }
  }

  /**
   * Mark local database state as having unsaved/unsynced changes
   * @param {string} [source=''] - Informative source tag (e.g. 'students.create')
   */
  markDirty(source = '') {
    this._isDirty = true;
    this.notify();
    this.scheduleAutoSync(this.DEBOUNCE_MS);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:refresh-data', { detail: { source } }));
    }
  }

  /**
   * Mark state as clean / synchronized
   */
  markClean() {
    this._isDirty = false;
    this._isAutoSyncing = false;
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
    if (waitMs <= 0) return;

    this._autoSyncTimer = setTimeout(async () => {
      await this.triggerAutoSync();
    }, waitMs);
  }

  /**
   * Executes the silent background sync
   */
  async triggerAutoSync() {
    // Check prerequisites
    if (!this._isDirty) return;
    if (this._isAutoSyncing) return;

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      // Keep dirty until online event fires
      this.notify();
      return;
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      // No endpoint configured yet; wait for user configuration
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser || !currentUser.username) {
      return;
    }

    try {
      this._isAutoSyncing = true;
      this.notify();

      console.log(`[SyncStateManager] Auto-syncing workspace changes to Google Drive for @${currentUser.username}...`);

      let success = false;
      if (currentUser.role === 'ADMIN') {
        const res = await AdminDataService.saveToGoogleSheet({ silent: true });
        success = Boolean(res?.success);
      } else {
        success = await CloudSyncService.pullToDrive(currentUser, { silent: true });
      }

      if (success) {
        console.log(`[SyncStateManager] Workspace auto-sync completed successfully for @${currentUser.username}.`);
        this.markClean();
      } else {
        this._isAutoSyncing = false;
        this.notify();
      }
    } catch (err) {
      console.warn('Background auto-sync failed (will retry on next modification):', err);
      this._isAutoSyncing = false;
      this.notify();
    }
  }

  /**
   * State observer subscription
   */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  notify() {
    const status = this.getSyncStatus();
    for (const listener of this._listeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in sync state listener:', err);
      }
    }
  }
}

export const syncStateManager = new SyncStateManager();
