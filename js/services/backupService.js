import { db } from '../database/db.js';
import { seedInitialData } from '../database/seed.js';
import { SettingsService } from './settingsService.js';
import { WorkspaceSetupService } from './workspaceSetupService.js';

export const BackupService = {
  /**
   * Export all database stores into a single timestamped JSON string
   */
  async exportFullDatabase() {
    const stores = [
      'students',
      'teachers',
      'classes',
      'groups',
      'academicYears',
      'attendance',
      'scores',
      'subjects',
      'settings',
      'schools',
      'report_settings',
      'registration_queue'
    ];

    const backupData = {
      app: 'SmartSchool Management System',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tables: {}
    };

    for (const storeName of stores) {
      const items = await db.getAll(storeName);
      
      // If items contain Blobs (e.g. photos in students or teachers),
      // convert them to Base64 data URLs for backup export portability
      const serializableItems = await Promise.all(items.map(async (item) => {
        const copy = { ...item };
        if (copy.photoBlob instanceof Blob) {
          copy.photoBase64 = await this.blobToBase64(copy.photoBlob);
          delete copy.photoBlob;
        }
        return copy;
      }));

      backupData.tables[storeName] = serializableItems;
    }

    return JSON.stringify(backupData, null, 2);
  },

  /**
   * Helper to download JSON backup file to user's computer
   */
  downloadJSON(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(link => link?.remove?.());
    URL.revokeObjectURL(url);
  },

  /**
   * Validate uploaded backup file and extract preview metadata
   */
  validateBackupFile(fileContent) {
    let parsed;
    try {
      parsed = JSON.parse(fileContent);
    } catch (e) {
      throw new Error('Invalid JSON file format.');
    }

    if (!parsed.tables || typeof parsed.tables !== 'object') {
      throw new Error('Incompatible backup file: missing database tables schema.');
    }

    const students = parsed.tables.students || [];
    const teachers = parsed.tables.teachers || [];
    const classes = parsed.tables.classes || [];
    const academicYears = parsed.tables.academicYears || [];
    const attendance = parsed.tables.attendance || [];
    const scores = parsed.tables.scores || [];

    return {
      isValid: true,
      exportedAt: parsed.exportedAt || 'Unknown',
      version: parsed.version || '1.0.0',
      counts: {
        students: students.length,
        teachers: teachers.length,
        classes: classes.length,
        academicYears: academicYears.length,
        attendance: attendance.length,
        scores: scores.length
      },
      data: parsed
    };
  },

  /**
   * Automatically generate a safety backup download of current data before restoring
   */
  async createSafetyBackup() {
    const json = await this.exportFullDatabase();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `SchoolManagement_SafetyBackup_${dateStr}.json`;
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 100);
  },

  /**
   * Restore full database from validated backup data
   */
  async restoreDatabase(backupPayload) {
    const tables = backupPayload.tables;
    if (!tables) throw new Error('No tables found in backup payload.');

    // Step 1: Clear existing tables
    const storeNames = Object.keys(tables);
    for (const store of storeNames) {
      await db.clear(store);
    }

    // Step 2: Restore all records
    for (const store of storeNames) {
      const rows = tables[store] || [];
      for (const row of rows) {
        // If row has photoBase64, restore it back to binary Blob
        if (row.photoBase64) {
          row.photoBlob = await this.base64ToBlob(row.photoBase64);
          delete row.photoBase64;
        }
        await db.put(store, row);
      }
    }

    return true;
  },

  /**
   * Clear all records in database with option to re-seed initial defaults
   */
  async clearFullDatabase(reseed = true) {
    const stores = [
      'students',
      'teachers',
      'classes',
      'groups',
      'academicYears',
      'attendance',
      'scores',
      'subjects',
      'settings',
      'activityLogs',
      'schools',
      'report_settings',
      'registration_queue'
    ];

    for (const store of stores) {
      await db.clear(store);
    }

    if (reseed) {
      await seedInitialData();
    }

    try {
      await SettingsService.delete('schools_catalog');
      await SettingsService.delete('schools_initialized');
    } catch (_) {}

    WorkspaceSetupService.notifySetupChange();

    return true;
  },

  // Auto-backup preferences
  getAutoBackupInterval() {
    return localStorage.getItem('school_auto_backup') || 'off'; // 'off', 'daily', 'weekly'
  },

  setAutoBackupInterval(val) {
    localStorage.setItem('school_auto_backup', val);
  },

  // Helpers for Blob <-> Base64
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async base64ToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }
};
