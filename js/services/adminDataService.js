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

import { globalDb, db } from '../database/db.js';
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
      classId: u.classId || '',
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

    // 2. Apply User Accounts into globalDb
    if (Array.isArray(users) && users.length > 0) {
      await globalDb.open();
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
          passwordHash: passwordHash || '',
          displayName: u.displayName || cleanUsername,
          role: (u.role || 'TEACHER').trim().toUpperCase(),
          status: (u.status || 'ACTIVE').trim().toUpperCase(),
          classId: u.classId || null,
          permissions: typeof u.permissions === 'object' ? u.permissions : {},
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString(),
          lastLogin: u.lastLogin || null
        };

        // If no passwordHash at all, generate default seed hash
        if (!userRecord.passwordHash) {
          userRecord.passwordHash = await hashPassword('123123');
        }

        await globalDb.put('users', userRecord);
        usersCount++;
      }
    }

    // 3. Apply Permissions
    if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
      try {
        await permissionService.savePermissions(permissions);
      } catch (e) {
        console.warn('Could not save incoming permissions:', e);
      }
    }

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
  }
};
