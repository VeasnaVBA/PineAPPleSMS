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
import { ExitSyncModal } from '../components/exitSyncModal.js';

class SyncStateManager {
  constructor() {
    this._isDirty = false;
    this._lastSyncedTimestamp = null;
    this._autoSyncTimer = null;
    this._isAutoSyncing = false;
    this._listeners = new Set();
    this._initialized = false;
    this.DEBOUNCE_MS = 5000; // 5 seconds of user inactivity
  }

  /**
   * Initialize lifecycle listeners (online/offline, beforeunload, Electron IPC)
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    // 1. Online / Offline network listeners
    if (typeof window !== 'undefined') {
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
    }

    this._autoSyncTimer = setTimeout(async () => {
      await this.triggerAutoSync();
    }, delayMs);
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

      // Run silent background sync (no modal, no popup toasts)
      const success = await CloudSyncService.pullToDrive(currentUser, { silent: true });

      if (success) {
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
