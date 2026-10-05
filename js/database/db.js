/**
 * IndexedDB Database Layer for School Management System
 * 
 * Architecture:
 * 1. System Database (SchoolSystem_Global):
 *    - Contains ONLY: `users` store
 *    - Shared globally solely for authentication and user account management by ADMIN.
 * 
 * 2. User Workspace Databases (SchoolWorkspace_<userId>):
 *    - Dynamically opened when a specific user logs in.
 *    - Holds all private data stores:
 *      - `students` (29 columns)
 *      - `classes`
 *      - `schools`
 *      - `teachers`
 *      - `attendance`
 *      - `scores`
 *      - `groups`
 *      - `academicYears`
 *      - `subjects`
 *      - `settings`
 *      - `report_settings`
 *      - `activityLogs`
 *    - Provides 100% data isolation per user account.
 */

export const GLOBAL_DB_NAME = 'SchoolSystem_Global';
export const GLOBAL_DB_VERSION = 1;
export const WORKSPACE_DB_VERSION = 7;
export const LEGACY_DB_NAME = 'SchoolManagementDB';

/**
 * System/Global Database Manager (Users Only)
 */
class GlobalDatabase {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async open() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(GLOBAL_DB_NAME, GLOBAL_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
          userStore.createIndex('role', 'role', { unique: false });
          userStore.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        // Check and migrate legacy users if present
        await this._migrateLegacyUsersIfNeeded();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Global IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  async _migrateLegacyUsersIfNeeded() {
    try {
      if (typeof indexedDB === 'undefined') return;
      const count = await this.count('users');
      if (count > 0) return; // Already has users

      // Attempt to inspect legacy SchoolManagementDB
      const legacyReq = indexedDB.open(LEGACY_DB_NAME);
      legacyReq.onsuccess = (e) => {
        const legacyDb = e.target.result;
        if (legacyDb.objectStoreNames.contains('users')) {
          const tx = legacyDb.transaction('users', 'readonly');
          const store = tx.objectStore('users');
          const getReq = store.getAll();
          getReq.onsuccess = async () => {
            const users = getReq.result || [];
            for (const u of users) {
              try {
                await this.put('users', u);
              } catch (_) {}
            }
            legacyDb.close();
          };
          getReq.onerror = () => legacyDb.close();
        } else {
          legacyDb.close();
        }
      };
      legacyReq.onerror = () => {};
    } catch (_) {}
  }

  async getAll(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async add(storeName, item) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  async queryByIndex(storeName, indexName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

/**
 * Isolated User Workspace Database Manager
 */
class WorkspaceDatabase {
  constructor(userId) {
    this.userId = userId;
    this.dbName = `SchoolWorkspace_${userId}`;
    this.db = null;
    this.initPromise = null;
  }

  async open() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, WORKSPACE_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Students (29 columns support)
        if (!db.objectStoreNames.contains('students')) {
          const studentStore = db.createObjectStore('students', { keyPath: 'id' });
          studentStore.createIndex('studentId', 'studentId', { unique: true });
          studentStore.createIndex('academicYear', 'academicYear', { unique: false });
          studentStore.createIndex('classId', 'classId', { unique: false });
          studentStore.createIndex('status', 'status', { unique: false });
          studentStore.createIndex('khmerName', 'khmerName', { unique: false });
          studentStore.createIndex('englishName', 'englishName', { unique: false });
        }

        // 2. Teachers
        if (!db.objectStoreNames.contains('teachers')) {
          const teacherStore = db.createObjectStore('teachers', { keyPath: 'id' });
          teacherStore.createIndex('teacherId', 'teacherId', { unique: true });
          teacherStore.createIndex('status', 'status', { unique: false });
          teacherStore.createIndex('khmerName', 'khmerName', { unique: false });
          teacherStore.createIndex('englishName', 'englishName', { unique: false });
        }

        // 3. Classes
        if (!db.objectStoreNames.contains('classes')) {
          const classStore = db.createObjectStore('classes', { keyPath: 'id' });
          classStore.createIndex('name', 'name', { unique: false });
          classStore.createIndex('academicYear', 'academicYear', { unique: false });
        }

        // 4. Groups
        if (!db.objectStoreNames.contains('groups')) {
          const groupStore = db.createObjectStore('groups', { keyPath: 'id' });
          groupStore.createIndex('classId', 'classId', { unique: false });
          groupStore.createIndex('academicYear', 'academicYear', { unique: false });
        }

        // 5. Academic Years
        if (!db.objectStoreNames.contains('academicYears')) {
          const yearStore = db.createObjectStore('academicYears', { keyPath: 'id' });
          yearStore.createIndex('name', 'name', { unique: true });
          yearStore.createIndex('isActive', 'isActive', { unique: false });
        }

        // 6. Attendance
        if (!db.objectStoreNames.contains('attendance')) {
          const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' });
          attendanceStore.createIndex('date', 'date', { unique: false });
          attendanceStore.createIndex('classId', 'classId', { unique: false });
          attendanceStore.createIndex('studentId', 'studentId', { unique: false });
          attendanceStore.createIndex('academicYear', 'academicYear', { unique: false });
        }

        // 7. Scores
        if (!db.objectStoreNames.contains('scores')) {
          const scoreStore = db.createObjectStore('scores', { keyPath: 'id' });
          scoreStore.createIndex('studentId', 'studentId', { unique: false });
          scoreStore.createIndex('classId', 'classId', { unique: false });
          scoreStore.createIndex('academicYear', 'academicYear', { unique: false });
          scoreStore.createIndex('subjectId', 'subjectId', { unique: false });
        }

        // 8. Subjects
        if (!db.objectStoreNames.contains('subjects')) {
          const subjectStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subjectStore.createIndex('name', 'name', { unique: false });
          subjectStore.createIndex('code', 'code', { unique: true });
        }

        // 9. Settings (Private user preferences, active year, etc.)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 10. Activity Logs
        if (!db.objectStoreNames.contains('activityLogs')) {
          const logStore = db.createObjectStore('activityLogs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 11. Schools
        if (!db.objectStoreNames.contains('schools')) {
          const schoolStore = db.createObjectStore('schools', { keyPath: 'id' });
          schoolStore.createIndex('code', 'code', { unique: true });
          schoolStore.createIndex('name', 'name', { unique: false });
        }

        // 12. Report Settings / Presets
        if (!db.objectStoreNames.contains('report_settings')) {
          db.createObjectStore('report_settings', { keyPath: 'id' });
        }

        // 13. Registration Queue (Admissions & Transfer Staging)
        if (!db.objectStoreNames.contains('registration_queue')) {
          const regStore = db.createObjectStore('registration_queue', { keyPath: 'id' });
          regStore.createIndex('tempStudentId', 'tempStudentId', { unique: false });
          regStore.createIndex('verificationStatus', 'verificationStatus', { unique: false });
          regStore.createIndex('targetGrade', 'targetGrade', { unique: false });
          regStore.createIndex('name', 'name', { unique: false });
          regStore.createIndex('importedAt', 'importedAt', { unique: false });
        }

        // 14. Courses (Curriculum Subjects & Max Scores G7-G12)
        if (!db.objectStoreNames.contains('courses')) {
          const courseStore = db.createObjectStore('courses', { keyPath: 'id' });
          courseStore.createIndex('courseId', 'courseId', { unique: false });
          courseStore.createIndex('name', 'name', { unique: false });
          courseStore.createIndex('category', 'category', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error(`Workspace IndexedDB open error (${this.dbName}):`, event.target.error);
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  async getAll(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async add(storeName, item) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  async queryByIndex(storeName, indexName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Global database instance (Auth and Users only)
export const globalDb = new GlobalDatabase();

// Currently active user workspace instance
let currentDbInstance = null;
let currentActiveUserId = null;

/**
 * Initialize and open the isolated workspace database for a specific user.
 * Closes previous database instance to prevent memory leaks and locks.
 */
export async function initUserDatabase(userId) {
  if (!userId) {
    throw new Error('User ID is required to initialize user workspace.');
  }

  if (currentDbInstance && currentActiveUserId === userId) {
    return currentDbInstance;
  }

  if (currentDbInstance) {
    currentDbInstance.close();
    currentDbInstance = null;
    currentActiveUserId = null;
  }

  currentActiveUserId = userId;
  currentDbInstance = new WorkspaceDatabase(userId);
  await currentDbInstance.open();

  console.log(`[IndexedDB] Active workspace initialized: SchoolWorkspace_${userId}`);
  return currentDbInstance;
}

/**
 * Closes active workspace database session (called on logout)
 */
export function closeUserDatabase() {
  if (currentDbInstance) {
    currentDbInstance.close();
    currentDbInstance = null;
  }
  currentActiveUserId = null;
}

/**
 * Closes and completely deletes the physical IndexedDB workspace database for a given userId / username
 * @param {string} userId - Target user ID (e.g. USR123456)
 * @param {string} [username=null] - Optional target username (e.g. teacher1)
 * @returns {Promise<Array<{dbName: string, success: boolean, error?: any}>>}
 */
export async function deleteWorkspaceDatabase(userId, username = null) {
  // If this database is currently open in memory, close it first
  if (currentActiveUserId === userId || (currentDbInstance && currentDbInstance.userId === userId)) {
    closeUserDatabase();
  }

  const dbsToDelete = new Set();
  if (userId) dbsToDelete.add(`SchoolWorkspace_${userId}`);
  if (username) dbsToDelete.add(`SchoolWorkspace_${username}`);

  const results = [];
  for (const dbName of dbsToDelete) {
    try {
      const res = await new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') {
          resolve({ dbName, success: false, error: 'indexedDB not available' });
          return;
        }

        const deleteRequest = indexedDB.deleteDatabase(dbName);

        deleteRequest.onsuccess = () => {
          console.log(`[IndexedDB] Database ${dbName} deleted completely.`);
          resolve({ dbName, success: true });
        };

        deleteRequest.onerror = (event) => {
          console.warn(`[IndexedDB] Error deleting database ${dbName}:`, event.target?.error);
          resolve({ dbName, success: false, error: event.target?.error });
        };

        deleteRequest.onblocked = () => {
          console.warn(`[IndexedDB] Database ${dbName} deletion was blocked by active connections.`);
          resolve({ dbName, success: true, blocked: true });
        };
      });
      results.push(res);
    } catch (err) {
      console.warn(`[IndexedDB] Exception deleting database ${dbName}:`, err);
      results.push({ dbName, success: false, error: err });
    }
  }

  return results;
}

/**
 * Returns the currently active workspace database instance.
 * If not initialized but a user is logged in in localStorage, auto-initializes it.
 */
export function getActiveDb() {
  if (currentDbInstance) {
    return currentDbInstance;
  }

  // Auto-recovery from localStorage session if available
  try {
    if (typeof localStorage !== 'undefined') {
      const rawUser = localStorage.getItem('school_current_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed && parsed.id) {
          currentActiveUserId = parsed.id;
          currentDbInstance = new WorkspaceDatabase(parsed.id);
          return currentDbInstance;
        }
      }
    }
  } catch (_) {}

  // Fallback temporary instance for unauthenticated workspace operations (e.g. before login)
  currentActiveUserId = 'guest';
  currentDbInstance = new WorkspaceDatabase('guest');
  return currentDbInstance;
}

/**
 * Universal Proxy Database Object (`db`)
 * 
 * Provides seamless backwards compatibility with all existing service modules
 * (studentService, classService, schoolService, etc.).
 * Automatically routes calls:
 * - If `storeName === 'users'` -> delegated to `globalDb`
 * - Any other store -> delegated to `getActiveDb()` (the logged-in user's isolated workspace)
 */
export const db = {
  open: async () => {
    await globalDb.open();
    const active = getActiveDb();
    return await active.open();
  },

  getAll: async (storeName) => {
    if (storeName === 'users') {
      return await globalDb.getAll('users');
    }
    const active = getActiveDb();
    return await active.getAll(storeName);
  },

  get: async (storeName, key) => {
    if (storeName === 'users') {
      return await globalDb.get('users', key);
    }
    const active = getActiveDb();
    return await active.get(storeName, key);
  },

  add: async (storeName, item) => {
    if (storeName === 'users') {
      return await globalDb.add('users', item);
    }
    const active = getActiveDb();
    return await active.add(storeName, item);
  },

  put: async (storeName, item) => {
    if (storeName === 'users') {
      return await globalDb.put('users', item);
    }
    const active = getActiveDb();
    return await active.put(storeName, item);
  },

  delete: async (storeName, key) => {
    if (storeName === 'users') {
      return await globalDb.delete('users', key);
    }
    const active = getActiveDb();
    return await active.delete(storeName, key);
  },

  count: async (storeName) => {
    if (storeName === 'users') {
      return await globalDb.count('users');
    }
    const active = getActiveDb();
    return await active.count(storeName);
  },

  queryByIndex: async (storeName, indexName, value) => {
    if (storeName === 'users') {
      return await globalDb.queryByIndex('users', indexName, value);
    }
    const active = getActiveDb();
    return await active.queryByIndex(storeName, indexName, value);
  },

  clear: async (storeName) => {
    if (storeName === 'users') {
      return await globalDb.clear('users');
    }
    const active = getActiveDb();
    return await active.clear(storeName);
  },

  getInfo: () => {
    return {
      globalDb: GLOBAL_DB_NAME,
      activeWorkspace: currentActiveUserId ? `SchoolWorkspace_${currentActiveUserId}` : 'None',
      stores: [
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
      ]
    };
  }
};
