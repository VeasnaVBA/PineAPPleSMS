/**
 * User Management Service
 * Manages user accounts, creation, updates, status toggling, and last-admin protections.
 * Operates specifically on the central SchoolSystem_Global database.
 */
import { globalDb, deleteWorkspaceDatabase, db } from '../database/db.js';
import { hashPassword } from './authService.js';
import { CloudSyncService } from './cloudSyncService.js';
import { AdminDataService } from './adminDataService.js';

export const UserService = {
  /**
   * Get all users from SchoolSystem_Global
   */
  async getAll() {
    const users = await globalDb.getAll('users');
    return users.map(u => {
      const { passwordHash, ...safeUser } = u;
      return safeUser;
    });
  },

  /**
   * Get a user by ID from SchoolSystem_Global
   */
  async getById(id) {
    const user = await globalDb.get('users', id);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  },

  /**
   * Get raw user with password hash (internal use only)
   */
  async _getRawById(id) {
    return await globalDb.get('users', id);
  },

  /**
   * Check if username already exists
   */
  async usernameExists(username, excludeId = null) {
    const cleanUsername = (username || '').trim().toLowerCase();
    const users = await globalDb.getAll('users');
    const match = users.find(u => u.username.toLowerCase() === cleanUsername);
    if (!match) return false;
    if (excludeId && match.id === excludeId) return false;
    return true;
  },

  /**
   * Count active Admin accounts
   */
  async countActiveAdmins() {
    const users = await globalDb.getAll('users');
    return users.filter(u => u.role === 'ADMIN' && u.status === 'ACTIVE').length;
  },

  /**
   * Create a new user account in SchoolSystem_Global
   */
  async create({ displayName, username, password, role, classId = null }) {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername) throw new Error('Username is required.');
    if (!password || password.length < 4) throw new Error('Password must be at least 4 characters long.');
    const cleanRole = (role || '').trim().toUpperCase();
    if (!['ADMIN', 'DIRECTOR', 'TEACHER'].includes(cleanRole)) throw new Error('Invalid account role.');

    const exists = await this.usernameExists(cleanUsername);
    if (exists) {
      throw new Error(`Username "${cleanUsername}" is already taken.`);
    }

    const id = 'USR' + String(Date.now()).slice(-6);
    const passwordHash = await hashPassword(password);

    const newUser = {
      id,
      username: cleanUsername,
      password: password.trim(),
      passwordHash,
      displayName: displayName.trim(),
      role: cleanRole,
      classId: cleanRole === 'TEACHER' ? classId : null,
      status: 'ACTIVE',
      permissions: cleanRole === 'ADMIN' ? null : {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null
    };

    await globalDb.put('users', newUser);

    // Auto-sync admin database changes to Google Drive
    AdminDataService.queueAutoSync();

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  },

  /**
   * Update an existing user account
   */
  async update(id, { displayName, role, classId = undefined, password = null } = {}) {
    const user = await this._getRawById(id);
    if (!user) throw new Error('User not found.');

    if (displayName) user.displayName = displayName.trim();
    if (role && ['ADMIN', 'DIRECTOR', 'TEACHER'].includes(role)) {
      // If changing role from ADMIN, verify last admin protection
      if (user.role === 'ADMIN' && role !== 'ADMIN') {
        const activeAdmins = await this.countActiveAdmins();
        if (activeAdmins <= 1) {
          throw new Error('Cannot change the role of the last active Admin account.');
        }
      }
      user.role = role;
    }

    if (user.role === 'TEACHER') {
      const finalClassId = (classId !== undefined && classId !== null && classId !== '')
        ? classId
        : (classId === '' || classId === null ? null : (user.classId || user.assignedClassId || null));
      user.classId = finalClassId;
    } else {
      user.classId = null;
    }

    if (password && password.trim()) {
      if (password.trim().length < 4) {
        throw new Error('Password must be at least 4 characters long.');
      }
      user.password = password.trim();
      user.passwordHash = await hashPassword(password.trim());
    }

    user.updatedAt = new Date().toISOString();
    await globalDb.put('users', user);

    // Auto-sync admin database changes to Google Drive
    AdminDataService.queueAutoSync();

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },

  /**
   * Toggle Active / Disabled account status with Last Admin protection
   */
  async toggleStatus(id) {
    const user = await this._getRawById(id);
    if (!user) throw new Error('User not found.');

    const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

    if (newStatus === 'DISABLED' && user.role === 'ADMIN') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new Error('Cannot disable the last active Admin account.');
      }
    }

    user.status = newStatus;
    user.updatedAt = new Date().toISOString();
    await globalDb.put('users', user);

    // Auto-sync admin database changes to Google Drive
    AdminDataService.queueAutoSync();

    return newStatus;
  },

  /**
   * Delete user account with Last Admin protection
   */
  async delete(id) {
    const user = await this._getRawById(id);
    if (!user) throw new Error('User not found.');

    if (user.role === 'ADMIN') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new Error('Cannot delete the last active Admin account.');
      }
    }

    await globalDb.delete('users', id);

    // Auto-sync admin database changes to Google Drive
    AdminDataService.queueAutoSync();

    return true;
  },

  /**
   * Cascading hard-deletion of user account:
   * 1. Google Drive spreadsheet file (`SchoolWorkspace_<username>`)
   * 2. Physical IndexedDB database (`SchoolWorkspace_<userId>`)
   * 3. Global user record (`SchoolSystem_Global.users`)
   *
   * @param {Object} targetUser - The user object to delete
   * @param {Object} [options={}]
   * @param {boolean} [options.deleteDriveFile=true] - Whether to delete Google Drive backup
   * @param {boolean} [options.allowLocalFallback=false] - If true, proceed with local delete if Drive is unreachable
   * @param {Function} [options.onProgress=null] - Progress callback with step string ('deletingDrive' | 'deletingLocal')
   * @returns {Promise<{success: boolean, driveDeleted: boolean, localDeleted: boolean, userDeleted: boolean}>}
   */
  async deleteUserWithData(targetUser, options = {}) {
    if (!targetUser) throw new Error('Target user is required.');

    // Safeguard 1: Never allow deleting the primary Admin account
    if (targetUser.role === 'ADMIN') {
      throw new Error('Cannot delete the primary Admin account.');
    }

    const {
      deleteDriveFile = true,
      allowLocalFallback = false,
      onProgress = null
    } = options;

    let driveDeleted = false;
    let driveError = null;

    // Step A — Remote Google Drive File Deletion
    if (deleteDriveFile) {
      if (typeof onProgress === 'function') {
        onProgress('deletingDrive');
      }

      if (!CloudSyncService.isOnline()) {
        if (!allowLocalFallback) {
          const err = new Error('OFFLINE_DRIVE_UNREACHABLE');
          err.code = 'OFFLINE';
          throw err;
        }
      } else {
        try {
          await CloudSyncService.deleteUserDriveFile(targetUser.username);
          driveDeleted = true;
        } catch (err) {
          console.warn('[CloudSync] Remote Google Drive file deletion warning:', err);
          driveError = err;
          if (!allowLocalFallback) {
            throw err;
          }
        }
      }
    }

    // Step B — Local IndexedDB Database Drop
    if (typeof onProgress === 'function') {
      onProgress('deletingLocal');
    }

    await deleteWorkspaceDatabase(targetUser.id, targetUser.username);

    // Step C — Remove User Record from Global Database
    await globalDb.delete('users', targetUser.id);

    // Auto-sync admin database changes to Google Drive
    AdminDataService.queueAutoSync();

    // Optional audit log recording
    try {
      await db.add('activityLogs', {
        id: 'log_' + Date.now(),
        action: 'DELETE_USER_CASCADING',
        timestamp: new Date().toISOString(),
        details: `Deleted user @${targetUser.username} (${targetUser.role}) with isolated database and ${driveDeleted ? 'Drive cloud file' : 'local data only'}.`
      });
    } catch (_) {}

    return {
      success: true,
      driveDeleted,
      driveError,
      localDeleted: true,
      userDeleted: true
    };
  }
};
