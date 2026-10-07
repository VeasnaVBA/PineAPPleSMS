/**
 * Admin Central Data Service
 * 
 * Synchronizes all administrative settings, system appearance configurations,
 * all user accounts (usernames, passwords/hashes, roles, statuses, classroom assignments),
 * and permission matrices to a single dedicated Google Spreadsheet:
 * "SchoolSystem_AdminData".
 * 
 * This solves Vercel / multi-device deployment issues where localStorage
 * and client-side IndexedDB are isolated per browser.
 */

import { globalDb, db, deleteWorkspaceDatabase } from '../database/db.js';
import { hashPassword, authService } from './authService.js';
import { themeService } from './themeService.js';
import { fontService } from './fontService.js';
import { i18n, t } from '../i18n/i18n.js';
import { SettingsService } from './settingsService.js';
import { BackupService } from './backupService.js';
import { permissionService } from './permissionService.js';
import { CloudSyncService } from './cloudSyncService.js';
import { 
  getCloudSyncUrl, 
  setCloudSyncUrl,
  ADMIN_SPREADSHEET_NAME,
  ADMIN_DATA_LAST_SYNC_KEY,
  ADMIN_DATA_SPREADSHEET_URL_KEY
} from '../config/cloudSync.js';
import { DEFAULT_USERS } from '../config/defaultUsers.js';
import { seedWorkspaceBaseline } from '../database/seed.js';
import { toast } from '../components/toast.js';

export const AdminDataService = {
  /**
   * Get the last known Admin Data spreadsheet URL
   */
  getSpreadsheetUrl() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(ADMIN_DATA_SPREADSHEET_URL_KEY) || '';
      }
    } catch (_) {}
    return '';
  },

  /**
   * Get timestamp of the last successful Admin Data sync
   */
  getLastSyncTimestamp() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(ADMIN_DATA_LAST_SYNC_KEY) || null;
      }
    } catch (_) {}
    return null;
  },

  /**
   * Gather all admin configuration, all user accounts, and permissions
   */
  async collectAdminDataPayload() {
    // 1. Settings
    const scriptUrl = getCloudSyncUrl();
    const theme = themeService.getTheme();
    const primaryColor = themeService.getPrimaryColor() || '';
    const fontSize = fontService.getFontSize();
    const fontEn = fontService.getEnglishFont();
    const fontKm = fontService.getKhmerFont();
    const locale = i18n.getLocale();
    const activeAcademicYear = await SettingsService.getActiveAcademicYear();
    const autoBackup = BackupService.getAutoBackupInterval();
    
    let schoolNameEn = 'SmartSchool Management';
    let schoolNameKm = 'ប្រព័ន្ធគ្រប់គ្រងសាលារៀន ស្មាតស្គូល';
    try {
      schoolNameEn = (await db.get('settings', 'school_name_en'))?.value || schoolNameEn;
      schoolNameKm = (await db.get('settings', 'school_name_km'))?.value || schoolNameKm;
    } catch (_) {}

    const settings = {
      scriptUrl,
      theme,
      primaryColor,
      fontSize,
      fontEn,
      fontKm,
      locale,
      activeAcademicYear,
      autoBackup,
      schoolNameEn,
      schoolNameKm,
      lastUpdated: new Date().toISOString()
    };

    // 2. All Users from globalDb
    let users = [];
    try {
      users = await globalDb.getAll('users');
    } catch (e) {
      console.warn('Error reading users for admin data export:', e);
    }

    const cleanUsers = users.map(u => ({
      id: u.id || '',
      username: u.username || '',
      password: u.password || '', // If available in plain
      passwordHash: u.passwordHash || '',
      displayName: u.displayName || u.username || '',
      role: (u.role || 'TEACHER').toUpperCase(),
      status: (u.status || 'ACTIVE').toUpperCase(),
      permissions: u.permissions || {},
      createdAt: u.createdAt || new Date().toISOString(),
      updatedAt: u.updatedAt || new Date().toISOString()
    }));

    // 3. Permissions Matrix
    let permissions = {};
    try {
      permissions = await permissionService.getAll();
    } catch (e) {
      console.warn('Error reading permissions for admin data export:', e);
    }

    return {
      settings,
      users: cleanUsers,
      permissions
    };
  },

  /**
   * Save Admin Central Data to Google Spreadsheet (SchoolSystem_AdminData)
   * @param {Object} [options={}]
   * @param {boolean} [options.silent=false]
   */
  async saveToGoogleSheet(options = {}) {
    const isSilent = options.silent === true;
    const currentLocale = i18n.getLocale();

    if (!CloudSyncService.isOnline()) {
      if (!isSilent) toast.error(t('cloudSync.offlineError'), t('cloudSync.errorTitle'));
      return { success: false, error: 'OFFLINE' };
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      if (!isSilent) CloudSyncService.openConfigModal(() => this.saveToGoogleSheet(options));
      return { success: false, error: 'NO_ENDPOINT' };
    }

    try {
      const payloadData = await this.collectAdminDataPayload();
      const payload = {
        action: 'SAVE_ADMIN_DATA',
        data: payloadData
      };

      const result = await CloudSyncService.dispatchGoogleScriptRequest(endpoint, payload, 45000);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to save admin data to Google Sheets.');
      }

      // Record spreadsheet URL and last sync
      if (result.spreadsheetUrl && typeof localStorage !== 'undefined') {
        localStorage.setItem(ADMIN_DATA_SPREADSHEET_URL_KEY, result.spreadsheetUrl);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ADMIN_DATA_LAST_SYNC_KEY, new Date().toISOString());
      }

      if (!isSilent) {
        const counts = result.counts || { settings: 0, users: payloadData.users.length };
        const msg = currentLocale === 'km'
          ? `បានរក្សាទុកទិន្នន័យ Admin ទៅ Google Sheet (${ADMIN_SPREADSHEET_NAME}) ដោយជោគជ័យ! (${counts.users || payloadData.users.length} គណនី, ការកំណត់ទូទៅ, និងសិទ្ធិ)`
          : `Admin data saved to Google Sheet (${ADMIN_SPREADSHEET_NAME}) successfully! (${counts.users || payloadData.users.length} accounts, settings, & permissions)`;

        if (result.spreadsheetUrl) {
          toast.show({
            title: currentLocale === 'km' ? 'រក្សាទុកទិន្នន័យ Admin' : 'Admin Cloud Sync',
            message: msg,
            type: 'success',
            duration: 10000,
            action: {
              label: t('cloudSync.openSheet'),
              onClick: () => {
                if (window.electronAPI?.openExternal) {
                  window.electronAPI.openExternal(result.spreadsheetUrl);
                } else {
                  window.open(result.spreadsheetUrl, '_blank', 'noopener,noreferrer');
                }
              }
            }
          });
        } else {
          toast.success(msg, currentLocale === 'km' ? 'រក្សាទុកទិន្នន័យ Admin' : 'Admin Cloud Sync');
        }
      }

      return {
        success: true,
        spreadsheetUrl: result.spreadsheetUrl,
        counts: result.counts
      };
    } catch (err) {
      console.error('saveToGoogleSheet error:', err);
      if (!isSilent) {
        CloudSyncService.showErrorModal(err.message);
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Pull Admin Central Data from Google Spreadsheet (SchoolSystem_AdminData) and apply locally
   * @param {Object} [options={}]
   * @param {boolean} [options.silent=false]
   */
  async pullFromGoogleSheet(options = {}) {
    const isSilent = options.silent === true;
    const currentLocale = i18n.getLocale();

    if (!CloudSyncService.isOnline()) {
      if (!isSilent) toast.error(t('cloudSync.offlineError'), t('cloudSync.errorTitle'));
      return { success: false, error: 'OFFLINE' };
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      if (!isSilent) CloudSyncService.openConfigModal(() => this.pullFromGoogleSheet(options));
      return { success: false, error: 'NO_ENDPOINT' };
    }

    try {
      const payload = {
        action: 'GET_ADMIN_DATA'
      };

      const result = await CloudSyncService.dispatchGoogleScriptRequest(endpoint, payload, 45000);

      if (!result || result.success === false) {
        throw new Error(result?.error || 'Failed to fetch admin data from Google Sheets.');
      }

      if (result.found === false) {
        const notFoundMsg = currentLocale === 'km'
          ? `មិនទាន់មានឯកសារ ${ADMIN_SPREADSHEET_NAME} នៅលើ Google Drive នោះទេ។ សូមចុច "រក្សាទុកទិន្នន័យ Admin" ជាមុនសិន។`
          : `Admin spreadsheet "${ADMIN_SPREADSHEET_NAME}" not found on Google Drive yet. Please click "Save Admin Data" first.`;
        if (!isSilent) toast.error(notFoundMsg, 'Admin Data Not Found');
        return { success: false, found: false, error: 'NOT_FOUND' };
      }

      const incoming = result.data || {};
      const appliedStats = await this.applyIncomingAdminData(incoming);

      if (result.spreadsheetUrl && typeof localStorage !== 'undefined') {
        localStorage.setItem(ADMIN_DATA_SPREADSHEET_URL_KEY, result.spreadsheetUrl);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ADMIN_DATA_LAST_SYNC_KEY, new Date().toISOString());
      }

      if (!isSilent) {
        const successMsg = currentLocale === 'km'
          ? `បានទាញ និងធ្វើបច្ចុប្បន្នភាពទិន្នន័យ Admin ពី Google Sheet ដោយជោគជ័យ! (${appliedStats.usersCount} គណនី, ការកំណត់រូបរាង & សិទ្ធិ)`
          : `Admin data pulled and updated successfully! (${appliedStats.usersCount} accounts, appearance settings, and permissions)`;
        toast.success(successMsg, currentLocale === 'km' ? 'ទាញទិន្នន័យ Admin' : 'Admin Data Pulled');
      }

      return {
        success: true,
        found: true,
        stats: appliedStats,
        spreadsheetUrl: result.spreadsheetUrl
      };
    } catch (err) {
      console.error('pullFromGoogleSheet error:', err);
      if (!isSilent) {
        CloudSyncService.showErrorModal(err.message);
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Apply incoming settings, users, and permissions into local system
   */
  async applyIncomingAdminData(incomingData) {
    const settings = incomingData.settings || {};
    const users = incomingData.users || [];
    const permissions = incomingData.permissions || {};

    let usersCount = 0;
    let settingsUpdated = 0;

    // 1. Apply Appearance / App Settings
    if (settings && typeof settings === 'object') {
      if (settings.theme && (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system')) {
        themeService.setTheme(settings.theme);
        settingsUpdated++;
      }
      if (settings.primaryColor !== undefined) {
        themeService.setPrimaryColor(settings.primaryColor || null);
        settingsUpdated++;
      }
      if (settings.fontSize) {
        fontService.setFontSize(settings.fontSize);
        settingsUpdated++;
      }
      if (settings.fontEn) {
        fontService.setEnglishFont(settings.fontEn);
        settingsUpdated++;
      }
      if (settings.fontKm) {
        fontService.setKhmerFont(settings.fontKm);
        settingsUpdated++;
      }
      if (settings.locale && (settings.locale === 'km' || settings.locale === 'en')) {
        i18n.setLocale(settings.locale);
        settingsUpdated++;
      }
      if (settings.activeAcademicYear) {
        try {
          await SettingsService.setActiveAcademicYear(settings.activeAcademicYear);
        } catch (_) {}
      }
      if (settings.scriptUrl && settings.scriptUrl.startsWith('http')) {
        setCloudSyncUrl(settings.scriptUrl);
      }
    }

    // 2. Apply User Accounts into globalDb and prune locally deleted accounts
    if (Array.isArray(users) && users.length > 0) {
      await globalDb.open();
      const validCloudUserIds = new Set();
      const validCloudUsernames = new Set();

      for (const u of users) {
        const cleanUsername = (u.username || '').trim().toLowerCase();
        if (!cleanUsername) continue;

        let passwordHash = u.passwordHash;
        if (!passwordHash && u.password) {
          passwordHash = await hashPassword(String(u.password).trim());
        }

        const userRecord = {
          id: u.id || ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5)),
          username: cleanUsername,
          password: u.password ? String(u.password).trim() : '',
          passwordHash: passwordHash || '',
          displayName: u.displayName || cleanUsername,
          role: (u.role || 'TEACHER').trim().toUpperCase(),
          status: (u.status || 'ACTIVE').trim().toUpperCase(),
          permissions: typeof u.permissions === 'object' ? u.permissions : {},
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString(),
          lastLogin: u.lastLogin || null
        };

        // If no passwordHash at all, generate default seed hash
        if (!userRecord.passwordHash) {
          userRecord.passwordHash = await hashPassword(userRecord.password || '123123');
        }

        await globalDb.put('users', userRecord);
        validCloudUserIds.add(userRecord.id);
        validCloudUsernames.add(userRecord.username);
        usersCount++;
      }

      // Check and delete local users/databases that no longer exist in the cloud sheet
      try {
        const localUsers = await globalDb.getAll('users');
        for (const localU of localUsers) {
          const localUname = (localU.username || '').trim().toLowerCase();
          if (localU.role !== 'ADMIN' && !validCloudUserIds.has(localU.id) && !validCloudUsernames.has(localUname)) {
            console.log(`[AdminData] Purging orphaned local account: @${localU.username} (${localU.id})`);
            await globalDb.delete('users', localU.id);
            await deleteWorkspaceDatabase(localU.id, localU.username);
          }
        }
      } catch (pruneErr) {
        console.warn('Error during local orphaned user prune:', pruneErr);
      }
    }

    // 3. Apply Permissions
    if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
      try {
        await permissionService.savePermissions(permissions, { syncToCloud: false });
      } catch (e) {
        console.warn('Could not save incoming permissions:', e);
      }
    }

    // 4. Purge all in-memory and browser caches
    try {
      await authService.clearAllCaches();
    } catch (_) {}

    // 4. Dispatch refresh events
    window.dispatchEvent(new CustomEvent('app:refresh-data', {
      detail: {
        adminSync: true,
        timestamp: Date.now(),
        usersCount,
        settingsUpdated
      }
    }));

    return {
      usersCount,
      settingsUpdated
    };
  },

  /**
   * Automatically triggered when an Admin logs in:
   * 1. Checks if SchoolSystem_AdminData exists in Google Drive.
   * 2. If it does not exist, Google Apps Script automatically creates it with all default data.
   * 3. If it already exists, pulls latest updates and synchronizes any local changes.
   */
  async syncOnAdminLogin() {
    if (!CloudSyncService.isOnline()) return;
    const url = getCloudSyncUrl();
    if (!url || !url.startsWith('http')) return;

    try {
      console.log('[AdminDataService] Admin logged in. Ensuring SchoolSystem_AdminData is synced with Google Drive...');
      // 1. Pull existing admin sheet if available
      const pullRes = await this.pullFromGoogleSheet({ silent: true });
      // 2. If newly created or pulled, sync current state back so all accounts & settings match perfectly
      await this.saveToGoogleSheet({ silent: true });
      console.log('[AdminDataService] SchoolSystem_AdminData verification and sync complete.');
    } catch (err) {
      console.warn('[AdminDataService] syncOnAdminLogin notice:', err);
    }
  },

  /**
   * Debounced Auto-Sync for every admin change (creating/updating users, permissions, settings)
   */
  _autoSyncTimer: null,
  queueAutoSync() {
    if (this._autoSyncTimer) {
      clearTimeout(this._autoSyncTimer);
    }
    this._autoSyncTimer = setTimeout(async () => {
      try {
        if (CloudSyncService.isOnline()) {
          console.log('[AdminDataService] Auto-syncing admin changes to Google Drive (SchoolSystem_AdminData)...');
          await this.saveToGoogleSheet({ silent: true });
        }
      } catch (e) {
        console.warn('[AdminDataService] Auto-sync background notice:', e);
      }
    }, 800);
  },

  /**
   * Fast check & sync on application bootstrap or login page mount
   * If user is on a new device (e.g. Vercel deployment), ensures local database
   * has latest users and settings without blocking UI.
   */
  async checkAndSyncOnStartup() {
    if (!CloudSyncService.isOnline()) return;
    const url = getCloudSyncUrl();
    if (!url || !url.startsWith('http')) return;

    try {
      // Background silent pull
      await this.pullFromGoogleSheet({ silent: true });
      console.log('[AdminDataService] Startup cloud sync completed successfully.');
    } catch (err) {
      console.warn('[AdminDataService] Startup cloud sync warning:', err);
    }
  },

  /**
   * Reset Default Accounts (Option 1):
   * Restores predefined default accounts defined in code (admin, director1, teacher1, king).
   * - If deleted or altered, recreates/updates with default credentials & roles.
   * - Clears their workspace data ("no data" - clean empty workspace).
   * - Remote Drive workspace spreadsheets for these default accounts are deleted/reset.
   * - Custom accounts created by admin are PRESERVED safely.
   * - Syncs the restored default accounts to SchoolSystem_AdminData in Google Drive.
   */
  async resetDefaultAccounts(options = {}) {
    const isSilent = options.silent === true;
    const currentLocale = i18n.getLocale();
    const isKm = currentLocale === 'km';

    try {
      console.log('[AdminDataService] Resetting default predefined accounts...');

      // 1. Process each predefined default user
      for (const defUser of DEFAULT_USERS) {
        const cleanUsername = (defUser.username || '').trim().toLowerCase();
        if (!cleanUsername) continue;

        // Hash default password
        const passwordHash = await hashPassword(defUser.password);

        // Retrieve existing record if present to keep id if possible, otherwise use defUser.id
        const existingUsers = await globalDb.getAll('users');
        const match = existingUsers.find(u => (u.username || '').toLowerCase() === cleanUsername);

        const restoredRecord = {
          id: match?.id || defUser.id || ('usr_' + cleanUsername),
          username: cleanUsername,
          password: defUser.password,
          passwordHash,
          displayName: defUser.displayName || cleanUsername,
          role: (defUser.role || 'TEACHER').toUpperCase(),
          status: 'ACTIVE',
          classId: null,
          permissions: defUser.permissions || null,
          createdAt: match?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: null
        };

        // Write restored record to globalDb
        await globalDb.put('users', restoredRecord);

        // Delete local workspace database for this account so it has "no data"
        await deleteWorkspaceDatabase(restoredRecord.id, cleanUsername);

        // If online and account has a workspace in Drive (e.g., director1, teacher1, king), delete its Drive file
        if (CloudSyncService.isOnline() && cleanUsername !== 'admin') {
          try {
            await CloudSyncService.deleteUserDriveFile(cleanUsername);
            console.log(`[AdminDataService] Deleted Drive file for default user @${cleanUsername}`);
          } catch (driveErr) {
            console.log(`[AdminDataService] Drive file delete note for @${cleanUsername}:`, driveErr.message);
          }
        }
      }

      // 2. Clear caches
      try {
        await authService.clearAllCaches();
      } catch (_) {}

      // 3. Sync restored user records to SchoolSystem_AdminData in Google Sheets
      if (CloudSyncService.isOnline()) {
        try {
          await this.saveToGoogleSheet({ silent: true });
        } catch (syncErr) {
          console.warn('[AdminDataService] Cloud sync after default reset warning:', syncErr);
        }
      }

      // 4. Dispatch data refresh
      window.dispatchEvent(new CustomEvent('app:refresh-data', {
        detail: {
          adminSync: true,
          defaultAccountsReset: true,
          timestamp: Date.now()
        }
      }));

      if (!isSilent) {
        toast.success(
          isKm
            ? `បានកំណត់គណនីលំនាំដើម (${DEFAULT_USERS.length} គណនី) ឡើងវិញដោយជោគជ័យ! ទិន្នន័យចាស់ត្រូវបានសម្អាត។`
            : `Default accounts (${DEFAULT_USERS.length}) reset successfully with clean data!`,
          isKm ? 'កំណត់គណនីលំនាំដើម' : 'Reset Default Accounts'
        );
      }

      return { success: true, count: DEFAULT_USERS.length };
    } catch (err) {
      console.error('resetDefaultAccounts error:', err);
      if (!isSilent) {
        toast.error(err.message, isKm ? 'បរាជ័យ' : 'Reset Error');
      }
      throw err;
    }
  },

  /**
   * Reset App Full - Strict Factory Reset (Option 2):
   * Very strict reset:
   * - Deletes ALL SchoolWorkspace_* spreadsheets from Google Drive.
   * - Drops ALL local workspace IndexedDB databases.
   * - Erases ALL custom user accounts.
   * - Keeps ONLY the default accounts set in code (admin, director1, teacher1, king) with clean data.
   * - Resets SchoolSystem_AdminData in Google Drive to default seed state.
   */
  async resetFullApp(options = {}) {
    const isSilent = options.silent === true;
    const currentLocale = i18n.getLocale();
    const isKm = currentLocale === 'km';

    try {
      console.log('[AdminDataService] Performing STRICT FULL APP RESET...');

      // 1. Remote Google Drive Full Reset (if online)
      let remoteResetResult = null;
      if (CloudSyncService.isOnline()) {
        const scriptUrl = getCloudSyncUrl();
        if (scriptUrl) {
          try {
            remoteResetResult = await CloudSyncService.resetAppFull(60000);
            console.log('[AdminDataService] Remote Drive reset succeeded:', remoteResetResult);
          } catch (remoteErr) {
            console.warn('[AdminDataService] Remote reset note:', remoteErr);
          }
        }
      }

      // 2. Local IndexedDB Wipe:
      // 2a. Gather all existing user records to delete their isolated databases
      let existingUsers = [];
      try {
        existingUsers = await globalDb.getAll('users');
      } catch (_) {}

      for (const u of existingUsers) {
        try {
          await deleteWorkspaceDatabase(u.id, u.username);
        } catch (_) {}
      }

      // 2b. If browser supports indexedDB.databases(), drop any remaining SchoolWorkspace_* databases
      if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
        try {
          const dbs = await indexedDB.databases();
          for (const dbInfo of dbs) {
            if (dbInfo.name && dbInfo.name.startsWith('SchoolWorkspace_')) {
              try {
                indexedDB.deleteDatabase(dbInfo.name);
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // 2c. Clear global users store completely
      try {
        await globalDb.clear('users');
      } catch (_) {}

      // 2d. Seed ONLY the default predefined users
      for (const defUser of DEFAULT_USERS) {
        const cleanUsername = (defUser.username || '').trim().toLowerCase();
        const passwordHash = await hashPassword(defUser.password);
        const userRecord = {
          id: defUser.id || ('usr_' + cleanUsername),
          username: cleanUsername,
          password: defUser.password,
          passwordHash,
          displayName: defUser.displayName || cleanUsername,
          role: (defUser.role || 'TEACHER').toUpperCase(),
          status: 'ACTIVE',
          classId: null,
          permissions: defUser.permissions || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: null
        };
        await globalDb.put('users', userRecord);
      }

      // 2e. Clear all in-memory and browser caches
      try {
        await authService.clearAllCaches();
      } catch (_) {}

      // 2f. Reseed baseline configuration in active workspace
      try {
        await seedWorkspaceBaseline();
      } catch (_) {}

      // 3. Dispatch global refresh
      window.dispatchEvent(new CustomEvent('app:refresh-data', {
        detail: {
          adminSync: true,
          fullAppReset: true,
          timestamp: Date.now()
        }
      }));

      if (!isSilent) {
        toast.success(
          isKm
            ? 'កម្មវិធីត្រូវបានកំណត់ឡើងវិញទាំងស្រុងដោយជោគជ័យ! រាល់គណនីបង្កើតដោយខ្លួនឯង និងឯកសារ Drive ត្រូវបានលុប។ នៅសល់តែគណនីលំនាំដើម។'
            : 'App has been strictly reset! All custom accounts and Drive workspace files erased. Default accounts retained.',
          isKm ? 'កំណត់កម្មវិធីឡើងវិញ' : 'Strict App Reset'
        );
      }

      return {
        success: true,
        deletedDriveFiles: remoteResetResult?.deletedFilesCount ?? 0
      };
    } catch (err) {
      console.error('resetFullApp error:', err);
      if (!isSilent) {
        toast.error(err.message, isKm ? 'បរាជ័យ' : 'Reset Error');
      }
      throw err;
    }
  }
};
