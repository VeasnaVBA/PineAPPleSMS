/**
 * Cloud Sync Service
 * Facilitates bidirectional synchronization with Google Drive & Google Sheets
 * via a deployed Google Apps Script Web App endpoint.
 * 
 * Account-Isolation & Naming Specification:
 * - File Name format: SchoolWorkspace_<username>
 * - Tabs: students, schools, classes, teachers, attendance, scores, academicYears, subjects, groups, report_settings, registration_queue, settings
 */

import { db, setSuppressWorkspaceMutation } from '../database/db.js';
import { authService } from './authService.js';
import { normalizeStudentRecord } from './studentService.js';
import { normalizeTeacherRecord } from './teacherService.js';
import { toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { 
  getCloudSyncUrl, 
  setCloudSyncUrl, 
  getWorkspaceSpreadsheetName,
  CLOUD_SYNC_SHEET_NAMES 
} from '../config/cloudSync.js';
import { StudentsPage } from '../pages/students.js';
import { syncStateManager } from './syncStateManager.js';

export const CloudSyncService = {
  /**
   * Check if device is connected to the internet
   */
  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  /**
   * Helper: Dispatch POST request to Google Apps Script Web App handling CORS redirects.
   * Note: 'text/plain;charset=utf-8' is used to avoid CORS preflight OPTIONS blocking by browsers.
   */
  async dispatchGoogleScriptRequest(endpoint, payload, timeoutMs = 45000) {
    if (!endpoint || !endpoint.startsWith('http')) {
      throw new Error('Please configure a valid Google Apps Script Web App URL starting with https://');
    }

    if (endpoint.endsWith('/dev')) {
      throw new Error('Your URL ends in "/dev". The dev URL requires active Google Workspace login and blocks API requests. Please deploy a new Web App version and use the URL ending in "/exec".');
    }

    // 1. Electron Native IPC Bridge (Bypasses Chromium renderer file:// CORS blocks)
    if (typeof window !== 'undefined' && window.electronAPI?.cloudSyncRequest) {
      try {
        const res = await window.electronAPI.cloudSyncRequest({ endpoint, payload, timeoutMs });
        if (!res || !res.success) {
          throw new Error(res?.error || 'Failed to communicate with Google Apps Script.');
        }
        return res.data;
      } catch (ipcErr) {
        throw ipcErr;
      }
    }

    // 2. Browser Fetch (for standard browser / local server mode)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          throw new Error('Google Script 403 (បានបដិសេធការចូលប្រើប្រាស់): Web App មិនទាន់ត្រូវបានកំណត់ជា "Anyone" (អ្នកណាក៏ដោយ) នោះទេ។ សូមកំណត់ "Who has access" ទៅជា "Anyone" នៅក្នុង Google Apps Script Deployment។');
        }
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        // If response is HTML or non-JSON (e.g. Google Login redirect or permission denied page)
        if (text.includes('Google Accounts') || text.includes('Service Login') || text.includes('Sign in')) {
          throw new Error('Google Script permission error: Web App is not set to "Anyone". Please redeploy as "Execute as: Me" and "Who has access: Anyone".');
        }
        throw new Error(`Invalid response received from Google Apps Script: ${text.slice(0, 150)}...`);
      }

      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Connection timed out after 45 seconds. Please check your internet connection or Google Script status.');
      }
      if (err.message === 'Failed to fetch') {
        throw new Error('Failed to fetch: Connection blocked or rejected by Google Script. Please ensure your Web App is deployed with "Who has access: Anyone" and ends in "/exec".');
      }
      throw err;
    }
  },

  /**
   * 1. Pull Data to Drive (Export local IndexedDB to Google Sheets)
   * @param {Object} [user=null] - Active user account
   * @param {Object} [options={}] - Options (e.g. { silent: true } for background auto-sync)
   */
  async pullToDrive(user = null, options = {}) {
    const isSilent = options?.silent === true;

    // 1. Safeguard: Check internet connection
    if (!this.isOnline()) {
      if (!isSilent) toast.error(t('cloudSync.offlineError'), t('cloudSync.errorTitle'));
      return false;
    }

    // 2. Identify active user
    const currentUser = user || authService.getCurrentUser();
    if (!currentUser || !currentUser.username) {
      if (!isSilent) toast.error('No active logged-in user account found.', t('cloudSync.errorTitle'));
      return false;
    }

    // 3. Check endpoint URL
    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      if (!isSilent) this.openConfigModal(() => this.pullToDrive(currentUser, options));
      return false;
    }

    try {
      // 4. Read all stores from active user's isolated IndexedDB
      const rawStudents = await db.getAll('students');
      const students = rawStudents.map(s => {
        const norm = normalizeStudentRecord(s);
        // Exclude raw heavy local blobs if any, retain clean strings
        const clean = { ...norm };
        delete clean.photoBlob;
        return clean;
      });

      const rawSchools = await db.getAll('schools');
      const schools = rawSchools.map(sch => ({
        id: sch.id || '',
        code: sch.code || '',
        name: sch.name || '',
        nameEn: sch.nameEn || '',
        address: sch.address || '',
        director: sch.director || '',
        phone: sch.phone || '',
        notes: sch.notes || ''
      }));

      const classes = await db.getAll('classes');
      const rawTeachers = await db.getAll('teachers');
      const teachers = rawTeachers.map(t => {
        const norm = normalizeTeacherRecord(t);
        const clean = { ...norm };
        delete clean.photoBlob;
        return clean;
      });
      const attendance = await db.getAll('attendance');
      const scores = await db.getAll('scores');
      const academicYears = await db.getAll('academicYears');
      const subjects = await db.getAll('subjects');
      const groups = await db.getAll('groups');
      const report_settings = await db.getAll('report_settings');
      const rawRegs = await db.getAll('registration_queue');
      const registration_queue = rawRegs.map(r => {
        const clean = { ...r };
        delete clean.photoBlob;
        return clean;
      });
      const settings = await db.getAll('settings');

      // 5. Construct payload matching specification
      const payload = {
        action: 'PULL_TO_DRIVE',
        username: currentUser.username,
        data: {
          students,
          schools,
          classes,
          teachers,
          attendance,
          scores,
          academicYears,
          subjects,
          groups,
          report_settings,
          registration_queue,
          settings
        }
      };

      const result = await this.dispatchGoogleScriptRequest(endpoint, payload);

      if (!result || !result.success) {
        throw new Error(result?.error || 'Unknown error occurred while syncing to Google Drive.');
      }

      // Mark state as clean
      syncStateManager.markClean();

      // 6. Success toast with direct link to open Google Sheets (if not silent)
      if (!isSilent) {
        const counts = result.counts || {
          students: students.length,
          schools: schools.length,
          classes: classes.length,
          teachers: teachers.length,
          attendance: attendance.length,
          scores: scores.length,
          academicYears: academicYears.length,
          subjects: subjects.length,
          groups: groups.length,
          report_settings: report_settings.length,
          registration_queue: registration_queue.length
        };

        const summaryText = t('cloudSync.syncSummary', counts);

        if (result.spreadsheetUrl) {
          toast.show({
            title: t('cloudSync.syncToDrive'),
            message: `${t('cloudSync.successPull')}\n${summaryText}`,
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
          toast.success(`${t('cloudSync.successPull')} ${summaryText}`, t('cloudSync.syncToDrive'));
        }
      }

      return true;
    } catch (err) {
      console.error('pullToDrive error:', err);
      if (!isSilent) {
        this.showErrorModal(err.message);
      }
      return false;
    }
  },

  /**
   * 2. Push Data to App (Restore from Google Drive into local IndexedDB)
   * @param {Object} [user=null] - Active user account
   * @param {Object} [options={}] - Options (e.g. { force: true } to force restore immediately without confirmation modal)
   */
  async pushToApp(user = null, options = {}) {
    // 1. Safeguard: Check internet connection
    if (!this.isOnline()) {
      toast.error(t('cloudSync.offlineError'), t('cloudSync.errorTitle'));
      return false;
    }

    // 2. Identify active user
    const currentUser = user || authService.getCurrentUser();
    if (!currentUser || !currentUser.username) {
      toast.error('No active logged-in user account found.', t('cloudSync.errorTitle'));
      return false;
    }

    // 3. Check endpoint URL
    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      this.openConfigModal(() => this.pushToApp(currentUser, options));
      return false;
    }

    const isForce = options?.force === true;

    try {
      const payload = {
        action: 'PUSH_TO_APP',
        username: currentUser.username
      };

      const timeoutMs = isForce ? 60000 : 45000;
      const result = await this.dispatchGoogleScriptRequest(endpoint, payload, timeoutMs);

      if (!result || result.success === false) {
        throw new Error(result?.error || 'Failed to retrieve data from Google Drive.');
      }

      // 4. If not found in Google Drive
      if (result.found === false) {
        toast.error(
          t('cloudSync.notFound', { username: currentUser.username }),
          t('cloudSync.restoreFromDrive')
        );
        return false;
      }

      const incomingData = result.data || {};

      // 5. If force option is active, apply immediately without confirmation prompt
      if (isForce) {
        await this.applyRestoredData(incomingData, currentUser, { silent: false });
        return true;
      }

      // Otherwise show confirmation dialog before merging
      const expectedFileName = result.fileName || getWorkspaceSpreadsheetName(currentUser.username);

      Modal.confirm({
        title: t('cloudSync.confirmRestoreTitle'),
        message: t('cloudSync.confirmRestoreMsg', { fileName: expectedFileName }),
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        onConfirm: async () => {
          await this.applyRestoredData(incomingData, currentUser);
        }
      });

      return true;
    } catch (err) {
      console.error('pushToApp error:', err);
      this.showErrorModal(err.message);
      return false;
    }
  },

  /**
   * Populate incoming sheets into active user's IndexedDB without full page reload
   */
  async applyRestoredData(data, currentUser, options = {}) {
    const isSilent = options?.silent === true;
    setSuppressWorkspaceMutation(true);
    try {
      if (!data || typeof data !== 'object') return;
      // 1. Ensure active workspace DB is opened (zero contamination of other accounts)
      await db.open();

      let studentCount = 0;
      let schoolCount = 0;
      let classCount = 0;
      let teacherCount = 0;
      let attendanceCount = 0;
      let scoreCount = 0;
      let academicYearCount = 0;
      let subjectCount = 0;
      let groupCount = 0;
      let reportSettingCount = 0;
      let registrationCount = 0;
      let settingCount = 0;

      // 1. Students (Sync exact state from Drive sheet)
      if (Array.isArray(data.students)) {
        await db.clear('students');
        for (const item of data.students) {
          if (!item.id && !item.studentId) continue;
          let dob = item.dateOfBirth;
          if (dob && typeof dob === 'string' && dob.includes('T')) {
            dob = dob.split('T')[0];
          }
          const cleanItem = normalizeStudentRecord({
            ...item,
            id: item.id ? String(item.id).trim() : `std-${item.studentId || Date.now()}`,
            studentId: item.studentId ? String(item.studentId).trim() : '',
            dateOfBirth: dob || ''
          });
          await db.put('students', cleanItem);
          studentCount++;
        }
      }

      // 2. Schools
      if (Array.isArray(data.schools)) {
        await db.clear('schools');
        for (const item of data.schools) {
          if (!item.id && !item.code && !item.name) continue;
          const cleanItem = {
            id: item.id ? String(item.id).trim() : `sch-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            code: item.code || '',
            name: item.name || '',
            nameEn: item.nameEn || '',
            address: item.address || '',
            director: item.director || '',
            phone: item.phone ? String(item.phone) : '',
            notes: item.notes || '',
            updatedAt: new Date().toISOString()
          };
          await db.put('schools', cleanItem);
          schoolCount++;
        }
      }

      // 3. Classes
      if (Array.isArray(data.classes)) {
        await db.clear('classes');
        for (const item of data.classes) {
          if (!item.id && !item.name) continue;
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : `cls-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
          };
          await db.put('classes', cleanItem);
          classCount++;
        }
      }

      // 4. Teachers
      if (Array.isArray(data.teachers)) {
        await db.clear('teachers');
        for (const item of data.teachers) {
          if (!item.id && !item.teacherId && !item.khmerName && !item.lastNameKhmer) continue;
          const cleanItem = normalizeTeacherRecord(item);
          await db.put('teachers', cleanItem);
          teacherCount++;
        }
      }

      // 5. Attendance
      if (Array.isArray(data.attendance)) {
        await db.clear('attendance');
        for (const item of data.attendance) {
          if (!item.id && !item.date) continue;
          let attDate = item.date;
          if (attDate && typeof attDate === 'string' && attDate.includes('T')) {
            attDate = attDate.split('T')[0];
          }
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : `att-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            date: attDate || ''
          };
          await db.put('attendance', cleanItem);
          attendanceCount++;
        }
      }

      // 6. Scores
      if (Array.isArray(data.scores)) {
        await db.clear('scores');
        for (const item of data.scores) {
          if (!item.id && !item.studentId) continue;
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : `scr-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            studentId: item.studentId ? String(item.studentId).trim() : '',
            score: item.score !== undefined && item.score !== '' ? Number(item.score) : null
          };
          await db.put('scores', cleanItem);
          scoreCount++;
        }
      }

      // 7. Academic Years (Director module: Academic Years & Promotions)
      if (Array.isArray(data.academicYears)) {
        for (const item of data.academicYears) {
          if (!item.id && !item.name) continue;
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : `ay-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: item.name ? String(item.name).trim() : '',
            isActive: item.isActive === true || item.isActive === 'true' || item.isActive === 1
          };
          await db.put('academicYears', cleanItem);
          academicYearCount++;
        }
      }

      // 8. Subjects (Director module: Curriculum Subjects)
      if (Array.isArray(data.subjects)) {
        for (const item of data.subjects) {
          if (!item.id && !item.name && !item.code) continue;
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : `sub-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            code: item.code ? String(item.code).trim() : '',
            name: item.name ? String(item.name).trim() : ''
          };
          await db.put('subjects', cleanItem);
          subjectCount++;
        }
      }

      // 9. Groups (Director / Teacher module: Student groups)
      if (Array.isArray(data.groups)) {
        for (const item of data.groups) {
          if (!item.id && !item.name && !item.classId) continue;
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : `grp-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
          };
          await db.put('groups', cleanItem);
          groupCount++;
        }
      }

      // 10. Report Settings (Director module: Report card layouts & signatures)
      if (Array.isArray(data.report_settings)) {
        for (const item of data.report_settings) {
          if (!item.id && !item.key && !item.type) continue;
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : (item.key ? String(item.key).trim() : `rs-${Date.now()}`)
          };
          await db.put('report_settings', cleanItem);
          reportSettingCount++;
        }
      }

      // 11. Registration Queue (Director module: New Student Admissions / Staging)
      if (Array.isArray(data.registration_queue)) {
        for (const item of data.registration_queue) {
          if (!item.id && !item.tempStudentId && !item.name && !item.khmerName) continue;
          const cleanItem = {
            ...item,
            id: item.id ? String(item.id).trim() : `reg-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
          };
          await db.put('registration_queue', cleanItem);
          registrationCount++;
        }
      }

      // 12. Settings (User Workspace preferences)
      if (Array.isArray(data.settings)) {
        for (const item of data.settings) {
          if (!item.key) continue;
          const cleanItem = {
            key: String(item.key).trim(),
            value: item.value !== undefined ? item.value : ''
          };
          await db.put('settings', cleanItem);
          settingCount++;
        }
      }

      // 2. Auto-assign classroom for teacher if available
      if (currentUser && (currentUser.role || '').toUpperCase() === 'TEACHER' && Array.isArray(data.classes) && data.classes.length > 0) {
        let targetClassId = null;
        if (Array.isArray(data.students) && data.students.length > 0) {
          const classCounts = {};
          data.students.forEach(s => {
            if (s.classId) classCounts[s.classId] = (classCounts[s.classId] || 0) + 1;
          });
          const bestClass = Object.keys(classCounts).sort((a, b) => classCounts[b] - classCounts[a])[0];
          if (bestClass) targetClassId = bestClass;
        }
        if (!targetClassId && data.classes[0]?.id) {
          targetClassId = data.classes[0].id;
        }
        if (targetClassId) {
          await authService.setAssignedClassId(targetClassId);
        }
      }

      // 3. Clear all in-memory service caches, CacheStorage, and student page cache
      try {
        await authService.clearAllCaches();
      } catch (_) {}
      if (StudentsPage) {
        StudentsPage.cachedStudents = null;
      }

      // 4. Dispatch data refresh event across the window
      window.dispatchEvent(new CustomEvent('app:refresh-data', {
        detail: {
          timestamp: Date.now(),
          counts: { 
            studentCount, 
            schoolCount, 
            classCount, 
            teacherCount, 
            attendanceCount, 
            scoreCount,
            academicYearCount,
            subjectCount,
            groupCount,
            reportSettingCount,
            registrationCount,
            settingCount
          }
        }
      }));

      // Mark sync state clean
      syncStateManager.markClean();

      // 5. Trigger active view refresh immediately without full page reload
      if (window.router?.handleRoute) {
        await window.router.handleRoute();
      } else if (typeof window !== 'undefined' && window.location) {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }

      // 6. Success notification
      if (!isSilent && (studentCount > 0 || schoolCount > 0 || classCount > 0 || scoreCount > 0)) {
        toast.success(
          `${t('cloudSync.successRestore')} (${studentCount} students, ${schoolCount} schools, ${classCount} classes, ${scoreCount} scores)`,
          t('cloudSync.restoreFromDrive')
        );
      }
    } catch (err) {
      console.error('applyRestoredData error:', err);
      if (!isSilent) {
        toast.error('Failed to write data into local database: ' + err.message, t('cloudSync.errorTitle'));
      }
    } finally {
      setSuppressWorkspaceMutation(false);
      syncStateManager.markClean();
    }
  },

  /**
   * Auto-pull and restore user workspace data from Google Drive when logging in
   * Ensures mobile phones or fresh browsers get all data saved from PC automatically.
   * @param {Object} currentUser - Logged in user session data
   * @param {Object} [options={}] - Options (e.g. { silent: false })
   */
  async restoreOnLogin(currentUser, options = {}) {
    if (!this.isOnline()) return false;
    const cleanUsername = currentUser?.username;
    if (!cleanUsername) return false;

    const endpoint = getCloudSyncUrl();
    if (!endpoint) return false;

    try {
      const payload = {
        action: 'PUSH_TO_APP',
        username: cleanUsername
      };

      const result = await this.dispatchGoogleScriptRequest(endpoint, payload, 50000);
      if (result && result.success && result.found) {
        if (result.isNewlyCreated) {
          try {
            await this.pullToDrive(currentUser, { silent: true });
          } catch (_) {}
          if (!options?.silent) {
            toast.info(
              `Created new Google Drive sheet: SchoolWorkspace_${cleanUsername}`,
              t('cloudSync.driveSync') || 'Google Drive'
            );
          }
          return true;
        }

        if (result.data) {
          await this.applyRestoredData(result.data, currentUser, { silent: options?.silent ?? false });
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('[CloudSync] restoreOnLogin error:', err);
      return false;
    }
  },

  /**
   * Auto-sync check on app startup for active session
   * If local database is empty or device has 0 students, automatically pulls latest data from Google Drive.
   */
  async checkAndSyncOnStartup(user = authService.getCurrentUser()) {
    if (!this.isOnline()) return false;
    const currentUser = user || authService.getCurrentUser();
    if (!currentUser || !currentUser.username) return false;

    const endpoint = getCloudSyncUrl();
    if (!endpoint) return false;

    try {
      await db.open();
      const localStudentsCount = await db.count('students');
      const isLocalEmpty = localStudentsCount === 0;

      const payload = {
        action: 'PUSH_TO_APP',
        username: currentUser.username
      };

      const result = await this.dispatchGoogleScriptRequest(endpoint, payload, 30000);
      if (result && result.success && result.found) {
        if (result.isNewlyCreated) {
          try {
            await this.pullToDrive(currentUser, { silent: true });
          } catch (_) {}
          return true;
        }

        if (result.data) {
          await this.applyRestoredData(result.data, currentUser, { silent: !isLocalEmpty });
          return true;
        }
      }
    } catch (err) {
      console.warn('[CloudSync] checkAndSyncOnStartup error:', err);
    }
    return false;
  },

  /**
   * Quick connection test
   */
  async testConnection(endpointUrl) {
    if (!this.isOnline()) {
      return { success: false, message: t('cloudSync.offlineError') };
    }
    const targetUrl = (endpointUrl || getCloudSyncUrl()).trim();
    if (!targetUrl) {
      return { success: false, message: t('cloudSync.configRequired') };
    }

    try {
      const result = await this.dispatchGoogleScriptRequest(targetUrl, {
        action: 'PUSH_TO_APP',
        username: '__ping_test__'
      }, 20000);

      if (result && typeof result === 'object') {
        return { success: true, message: t('cloudSync.testSuccess') };
      }
      return { success: false, message: 'Unexpected response from Google Script' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  /**
   * Display user-friendly alert modal for permission errors or network issues
   */
  showErrorModal(errorMessage) {
    const isAccessOrFetchError = 
      errorMessage.includes('Failed to fetch') || 
      errorMessage.includes('permission') || 
      errorMessage.includes('Anyone') || 
      errorMessage.includes('Sign in') ||
      errorMessage.includes('/dev');

    const contentHtml = `
      <div class="space-y-4">
        <div class="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed flex items-start gap-3">
          <span class="p-1 rounded bg-destructive/20 shrink-0 mt-0.5">
            ${getIcon('x', 'w-4 h-4 text-destructive')}
          </span>
          <div>
            <p class="font-semibold text-sm">${t('cloudSync.errorTitle')}</p>
            <p class="mt-1">${errorMessage}</p>
          </div>
        </div>

        ${isAccessOrFetchError ? `
          <div class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-foreground text-xs space-y-2.5">
            <p class="font-semibold text-amber-600 dark:text-amber-400">Google Apps Script Deployment Checklist:</p>
            <ol class="list-decimal pl-4 space-y-1.5 text-muted-foreground leading-normal">
              <li>Open your script at <a href="https://script.google.com" target="_blank" class="text-primary underline">script.google.com</a>.</li>
              <li>Click <strong>Deploy &gt; Manage deployments</strong> (or <strong>New deployment</strong>).</li>
              <li>Select <strong>Web app</strong>.</li>
              <li>Set <em>Execute as</em>: <strong>Me</strong>.</li>
              <li>Set <em>Who has access</em>: <strong class="text-foreground">Anyone</strong> <span class="text-amber-600 dark:text-amber-400 font-medium">(Crucial: if set to 'Only myself', requests are blocked with 'Failed to fetch')</span>.</li>
              <li>Ensure your URL ends in <strong class="font-mono text-foreground">/exec</strong> (not <span class="font-mono line-through">/dev</span>).</li>
              <li>If running in Electron desktop app, restart the application so the native network bridge is active.</li>
            </ol>
          </div>
        ` : ''}
      </div>
    `;

    Modal.open({
      title: t('cloudSync.errorTitle'),
      content: contentHtml,
      maxWidth: 'max-w-lg',
      footer: `
        <button class="btn-close-modal px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors cursor-pointer">
          ${t('common.cancel')}
        </button>
      `
    });
  },

  /**
   * Modal to configure or update the Google Script Web App URL
   */
  openConfigModal(onSavedCallback = null) {
    const currentUrl = getCloudSyncUrl();
    const currentUser = authService.getCurrentUser();
    const workspaceName = getWorkspaceSpreadsheetName(currentUser?.username);

    const contentHtml = `
      <div class="space-y-4 text-xs">
        <div class="space-y-1">
          <p class="text-sm font-semibold text-foreground">${t('cloudSync.configPromptTitle')}</p>
          <p class="text-muted-foreground leading-relaxed">${t('cloudSync.configPromptDesc')}</p>
        </div>

        <!-- Target File Indicator -->
        <div class="p-3 rounded-lg bg-muted/50 border border-border flex items-center justify-between">
          <span class="text-muted-foreground">Target Google Drive File:</span>
          <span class="font-mono font-bold text-primary">${workspaceName}</span>
        </div>

        <!-- URL Input -->
        <div class="space-y-1.5">
          <label for="cfg-cloud-url" class="block font-medium text-foreground">
            ${t('cloudSync.endpointUrl')} <span class="text-destructive">*</span>
          </label>
          <input 
            id="cfg-cloud-url" 
            type="url" 
            value="${currentUrl}"
            placeholder="https://script.google.com/macros/s/.../exec"
            class="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono" 
          />
        </div>

        <!-- Test Connection Result Feedback -->
        <div id="cfg-test-feedback" class="hidden p-2.5 rounded-md text-xs"></div>
      </div>
    `;

    const footerHtml = `
      <div class="flex items-center justify-between w-full">
        <button id="btn-cfg-test" type="button" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors cursor-pointer">
          ${getIcon('rotateCw', 'w-3.5 h-3.5')}
          <span id="btn-cfg-test-text">${t('cloudSync.testConnection')}</span>
        </button>

        <div class="flex items-center gap-2">
          <button id="btn-cfg-cancel" type="button" class="px-3.5 py-2 rounded-md border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer">
            ${t('common.cancel')}
          </button>
          <button id="btn-cfg-save" type="button" class="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors cursor-pointer">
            ${t('cloudSync.saveConfig')}
          </button>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: t('cloudSync.configPromptTitle'),
      content: contentHtml,
      footer: footerHtml,
      maxWidth: 'max-w-lg'
    });

    const urlInput = modal.element.querySelector('#cfg-cloud-url');
    const testBtn = modal.element.querySelector('#btn-cfg-test');
    const testBtnText = modal.element.querySelector('#btn-cfg-test-text');
    const testFeedback = modal.element.querySelector('#cfg-test-feedback');
    const saveBtn = modal.element.querySelector('#btn-cfg-save');
    const cancelBtn = modal.element.querySelector('#btn-cfg-cancel');

    cancelBtn?.addEventListener('click', () => modal.close());

    // Test Connection Click
    testBtn?.addEventListener('click', async () => {
      const url = urlInput?.value?.trim();
      if (!url) {
        testFeedback.className = 'p-2.5 rounded-md text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20';
        testFeedback.textContent = t('cloudSync.configRequired');
        testFeedback.classList.remove('hidden');
        return;
      }

      testBtn.disabled = true;
      testBtnText.textContent = t('cloudSync.testing');
      testFeedback.className = 'p-2.5 rounded-md text-xs bg-muted text-muted-foreground border border-border';
      testFeedback.textContent = t('cloudSync.testing');
      testFeedback.classList.remove('hidden');

      const res = await this.testConnection(url);

      testBtn.disabled = false;
      testBtnText.textContent = t('cloudSync.testConnection');

      if (res.success) {
        testFeedback.className = 'p-2.5 rounded-md text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
        testFeedback.textContent = res.message;
      } else {
        testFeedback.className = 'p-2.5 rounded-md text-xs bg-destructive/10 text-destructive border border-destructive/20';
        testFeedback.textContent = `${t('cloudSync.testFailed')} ${res.message}`;
      }
    });

    // Save Click
    saveBtn?.addEventListener('click', () => {
      const url = urlInput?.value?.trim() || '';
      setCloudSyncUrl(url);
      modal.close();
      toast.success('Google Script Web App URL updated successfully.');
      if (typeof onSavedCallback === 'function') {
        onSavedCallback(url);
      }
    });
  },

  /**
   * Delete remote Google Drive spreadsheet file for a specific user
   * @param {string} username - Target user username
   * @param {number} [timeoutMs=30000] - Request timeout
   */
  async deleteUserDriveFile(username, timeoutMs = 30000) {
    if (!this.isOnline()) {
      throw new Error('Device is offline. Cannot reach Google Drive.');
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      throw new Error('Google Apps Script Web App URL is not configured.');
    }

    const cleanUsername = (username || '').trim();
    if (!cleanUsername) {
      throw new Error('Username is required to delete Google Drive file.');
    }

    const payload = {
      action: 'DELETE_USER_DRIVE_FILE',
      username: cleanUsername
    };

    console.log('[CloudSync] Dispatching DELETE_USER_DRIVE_FILE for:', cleanUsername, 'Endpoint:', endpoint);
    const response = await this.dispatchGoogleScriptRequest(endpoint, payload, timeoutMs);
    console.log('[CloudSync] DELETE_USER_DRIVE_FILE response:', response);

    if (!response || response.success === false) {
      throw new Error(response?.error || 'Failed to delete file from Google Drive.');
    }

    if (response.deletedCount === 0) {
      console.log(`[CloudSync] Note: Google Drive reported 0 files deleted for "SchoolWorkspace_${cleanUsername}" (already absent or removed).`);
    }

    return response;
  },

  /**
   * Automatically creates a new user workspace spreadsheet in Google Drive: SchoolWorkspace_<username>
   * with all structured sheets and headers immediately (without waiting for user to login or sync).
   *
   * @param {string} username - Target username
   * @param {number} [timeoutMs=45000]
   * @returns {Promise<{success: boolean, created?: boolean, fileName?: string, spreadsheetUrl?: string, error?: string}>}
   */
  async createUserDriveFile(username, timeoutMs = 45000) {
    if (!this.isOnline()) {
      return { success: false, error: 'OFFLINE' };
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      return { success: false, error: 'NO_ENDPOINT' };
    }

    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername) {
      throw new Error('Username is required to create Google Drive file.');
    }

    const fileName = `SchoolWorkspace_${cleanUsername}`;
    console.log('[CloudSync] Initializing Google Drive workspace spreadsheet for @' + cleanUsername + '...');

    const emptyWorkspaceData = {
      students: [],
      schools: [],
      classes: [],
      teachers: [],
      attendance: [],
      scores: [],
      academicYears: [],
      subjects: [],
      groups: [],
      report_settings: [],
      registration_queue: [],
      settings: []
    };

    // Strategy 1: PULL_TO_DRIVE initializes the spreadsheet with all structured sheets & headers immediately
    try {
      const pullPayload = {
        action: 'PULL_TO_DRIVE',
        username: cleanUsername,
        fileName: fileName,
        data: emptyWorkspaceData
      };
      const pullRes = await this.dispatchGoogleScriptRequest(endpoint, pullPayload, timeoutMs);
      if (pullRes && pullRes.success) {
        console.log(`[CloudSync] Workspace created on Google Drive via PULL_TO_DRIVE: ${fileName} -> ${pullRes.spreadsheetUrl}`);
        return {
          success: true,
          created: true,
          fileName: pullRes.fileName || fileName,
          spreadsheetUrl: pullRes.spreadsheetUrl || null
        };
      }
    } catch (pullErr) {
      console.warn('[CloudSync] PULL_TO_DRIVE workspace creation note:', pullErr.message);
    }

    // Strategy 2: CREATE_USER_WORKSPACE fallback for updated Google Apps Script backends
    try {
      const createPayload = {
        action: 'CREATE_USER_WORKSPACE',
        username: cleanUsername,
        fileName: fileName
      };
      const createRes = await this.dispatchGoogleScriptRequest(endpoint, createPayload, timeoutMs);
      if (createRes && createRes.success) {
        console.log(`[CloudSync] Workspace created via CREATE_USER_WORKSPACE: ${fileName} -> ${createRes.spreadsheetUrl}`);
        return {
          success: true,
          created: true,
          fileName: createRes.fileName || fileName,
          spreadsheetUrl: createRes.spreadsheetUrl || null
        };
      }
    } catch (createErr) {
      console.warn('[CloudSync] CREATE_USER_WORKSPACE fallback note:', createErr.message);
    }

    // Strategy 3: PUSH_TO_APP fallback
    try {
      const pushPayload = {
        action: 'PUSH_TO_APP',
        username: cleanUsername,
        fileName: fileName
      };
      const pushRes = await this.dispatchGoogleScriptRequest(endpoint, pushPayload, timeoutMs);
      if (pushRes && pushRes.success) {
        return {
          success: true,
          created: true,
          fileName: pushRes.fileName || fileName,
          spreadsheetUrl: pushRes.spreadsheetUrl || null
        };
      }
    } catch (pushErr) {
      console.warn('[CloudSync] PUSH_TO_APP fallback note:', pushErr.message);
    }

    return { success: false, error: 'Could not create workspace file in Google Drive.' };
  },

  /**
   * Fetch list of all active user workspace files from Google Drive
   */
  async listAllWorkspaceFiles(timeoutMs = 45000) {
    if (!this.isOnline()) {
      throw new Error(t('cloudSync.offlineError') || 'Device is offline. Please check your internet connection.');
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      throw new Error('Google Apps Script Web App URL is not configured.');
    }

    const payload = {
      action: 'LIST_ALL_WORKSPACE_FILES'
    };

    const response = await this.dispatchGoogleScriptRequest(endpoint, payload, timeoutMs);

    if (!response || response.success === false) {
      throw new Error(response?.error || 'Failed to list workspace files from Google Drive.');
    }

    return response.files || [];
  },

  /**
   * Fetch full workspace data payload for a specific username from Google Drive
   * @param {string} username - Target username (e.g. 'teacher1', 'director1')
   */
  async fetchUserWorkspaceData(username, timeoutMs = 60000) {
    if (!this.isOnline()) {
      throw new Error(t('cloudSync.offlineError') || 'Device is offline. Please check your internet connection.');
    }

    const cleanUsername = (username || '').trim();
    if (!cleanUsername) {
      throw new Error('Username is required to fetch workspace data.');
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      throw new Error('Google Apps Script Web App URL is not configured.');
    }

    const payload = {
      action: 'PUSH_TO_APP',
      username: cleanUsername
    };

    const response = await this.dispatchGoogleScriptRequest(endpoint, payload, timeoutMs);

    if (!response || response.success === false) {
      throw new Error(response?.error || `Failed to fetch data for user "${cleanUsername}" from Google Drive.`);
    }

    if (response.found === false) {
      throw new Error(`No workspace spreadsheet found on Google Drive for user "${cleanUsername}".`);
    }

    return response;
  },

  /**
   * Trigger Strict Full App Reset on Google Apps Script Backend
   * Deletes all SchoolWorkspace_* files from Drive and resets SchoolSystem_AdminData
   */
  async resetAppFull(timeoutMs = 60000) {
    if (!this.isOnline()) {
      throw new Error(t('cloudSync.offlineError') || 'Device is offline. Please check your internet connection.');
    }

    const endpoint = getCloudSyncUrl();
    if (!endpoint) {
      throw new Error('Google Apps Script Web App URL is not configured.');
    }

    const payload = {
      action: 'RESET_APP_FULL'
    };

    console.log('[CloudSync] Dispatching RESET_APP_FULL to Google Apps Script...');
    const response = await this.dispatchGoogleScriptRequest(endpoint, payload, timeoutMs);

    if (!response || response.success === false) {
      throw new Error(response?.error || 'Failed to perform full app reset on Google Drive.');
    }

    return response;
  }
};
