/**
 * Authentication and Session Service
 * Handles user login, password hashing (SHA-256), session state, role checks,
 * and user workspace database lifecycle switching.
 */
import { globalDb, initUserDatabase, closeUserDatabase } from '../database/db.js';
import { seedWorkspaceBaseline } from '../database/seed.js';
import { permissionService } from './permissionService.js';
import { LocationService } from './locationService.js';
import { SchoolService } from './schoolService.js';

export async function hashPassword(plainText) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for non-subtle environments
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    hash = (hash << 5) - hash + plainText.charCodeAt(i);
    hash |= 0;
  }
  return 'simple_' + Math.abs(hash);
}

class AuthService {
  constructor() {
    this.sessionKey = 'school_current_user';
    this.listeners = [];

    // Re-notify whenever permissions change
    permissionService.subscribe(() => {
      this.notify(this.getCurrentUser());
    });
  }

  getCurrentUser() {
    try {
      const data = localStorage.getItem(this.sessionKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated() {
    return this.getCurrentUser() !== null;
  }

  isAdmin() {
    return (this.getCurrentUser()?.role || '').toUpperCase() === 'ADMIN';
  }

  isDirector() {
    return (this.getCurrentUser()?.role || '').toUpperCase() === 'DIRECTOR';
  }

  isTeacher() {
    return (this.getCurrentUser()?.role || '').toUpperCase() === 'TEACHER';
  }

  hasRole(...roles) {
    const userRole = (this.getCurrentUser()?.role || '').toUpperCase();
    const upperRoles = roles.map(r => String(r).toUpperCase());
    return userRole ? upperRoles.includes(userRole) : false;
  }

  getAssignedClassId() {
    const user = this.getCurrentUser();
    return user && (user.role || '').toUpperCase() === 'TEACHER' ? (user.classId || user.assignedClassId || null) : null;
  }

  /**
   * Determine whether the current user can access a route
   */
  canAccessRoute(routeKey) {
    const user = this.getCurrentUser();
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return permissionService.canRoleAccessRoute(role, routeKey);
  }

  /**
   * Check granular capability for active user (e.g. 'students.delete', 'scores.edit')
   */
  can(action) {
    const user = this.getCurrentUser();
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return permissionService.canRole(role, action);
  }

  /**
   * Clear in-memory caches across services on account switch
   */
  clearServiceCaches() {
    try {
      if (LocationService && typeof LocationService.clearCache === 'function') {
        LocationService.clearCache();
      }
      if (SchoolService && typeof SchoolService.clearCache === 'function') {
        SchoolService.clearCache();
      }
    } catch (e) {
      console.warn('Error clearing service caches:', e);
    }
  }

  /**
   * Login with username and password against SchoolSystem_Global.users
   * and initialize the user's isolated workspace database SchoolWorkspace_<userId>
   */
  async login(username, password) {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername || !password) {
      throw new Error('Please enter both username and password.');
    }

    // 1. Authenticate against central system database (SchoolSystem_Global)
    let allUsers = await globalDb.getAll('users');
    let user = allUsers.find(u => u.username.toLowerCase() === cleanUsername);
    let computedHash = await hashPassword(password);

    // If user not found locally or password mismatch, try syncing from Admin Google Sheet if online
    if (!user || user.passwordHash !== computedHash) {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const { AdminDataService } = await import('./adminDataService.js');
          const syncRes = await AdminDataService.pullFromGoogleSheet({ silent: true });
          if (syncRes && syncRes.success) {
            allUsers = await globalDb.getAll('users');
            user = allUsers.find(u => u.username.toLowerCase() === cleanUsername);
            computedHash = await hashPassword(password);
          }
        }
      } catch (syncErr) {
        console.warn('[Auth] Cloud fallback sync error during login:', syncErr);
      }
    }

    if (!user) {
      throw new Error('Invalid username or password.');
    }

    if (user.passwordHash !== computedHash) {
      throw new Error('Invalid username or password.');
    }

    if (user.status === 'DISABLED') {
      throw new Error('This account has been disabled. Please contact the administrator.');
    }

    // 2. Update lastLogin in SchoolSystem_Global
    user.lastLogin = new Date().toISOString();
    await globalDb.put('users', user);

    // 3. Clear existing in-memory caches before loading the new workspace
    this.clearServiceCaches();

    // 4. Initialize the user's private, isolated workspace database
    await initUserDatabase(user.id);
    await seedWorkspaceBaseline();

    // 5. Save session in localStorage
    const sessionData = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: (user.role || '').toUpperCase(),
      classId: user.classId,
      status: user.status
    };

    localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
    this.notify(sessionData);

    return sessionData;
  }

  /**
   * Update active user session object in localStorage and notify listeners
   */
  updateSessionUser(updates = {}) {
    const cur = this.getCurrentUser();
    if (!cur) return null;
    const updated = { ...cur, ...updates };
    localStorage.setItem(this.sessionKey, JSON.stringify(updated));
    this.notify(updated);
    return updated;
  }

  /**
   * Terminate user session:
   * 1. Remove session storage / localStorage auth tokens
   * 2. Close active workspace database instance
   * 3. Clear service caches
   * 4. Notify listeners to switch to login view
   */
  logout() {
    localStorage.removeItem(this.sessionKey);
    closeUserDatabase();
    this.clearServiceCaches();
    this.notify(null);
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(user) {
    this.listeners.forEach(fn => {
      try {
        fn(user);
      } catch (err) {
        console.error('Auth listener error:', err);
      }
    });
  }
}

export const authService = new AuthService();
