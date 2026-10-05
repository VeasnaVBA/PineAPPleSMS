/**
 * Centralized Permission Service
 * Manages role-based sidebar menus and granular capabilities.
 * Persists customized settings in IndexedDB (settings store).
 */
import { db } from '../database/db.js';

export const MENU_KEYS = [
  'dashboard',
  'registration',
  'promotion',
  'schools',
  'classes',
  'teachers',
  'subjects',
  'students',
  'attendance',
  'scores',
  'reports',
  'settings'
];

export const GRANULAR_PERMISSIONS = [
  'schools.view',
  'schools.create',
  'schools.edit',
  'schools.delete',
  'registration.view',
  'registration.import',
  'registration.verify',
  'registration.approve',
  'registration.delete',
  'promotion.view',
  'promotion.execute',
  'students.view',
  'students.create',
  'students.edit',
  'students.delete',
  'teachers.view',
  'teachers.create',
  'teachers.edit',
  'teachers.delete',
  'classes.view',
  'classes.create',
  'classes.edit',
  'classes.delete',
  'subjects.view',
  'subjects.create',
  'subjects.edit',
  'subjects.delete',
  'attendance.view',
  'attendance.create',
  'attendance.edit',
  'attendance.delete',
  'scores.view',
  'scores.create',
  'scores.edit',
  'scores.delete',
  'reports.view',
  'reports.export',
  'reports.print'
];

export const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: {
    dashboard: false,
    schools: false,
    registration: false,
    promotion: false,
    students: false,
    teachers: false,
    classes: false,
    subjects: false,
    attendance: false,
    scores: false,
    reports: false,
    settings: true,
    users: true,
    'download-data': true
  },
  DIRECTOR: {
    dashboard: true,
    schools: true,
    registration: true,
    promotion: true,
    students: true,
    teachers: true,
    classes: true,
    subjects: true,
    attendance: true,
    scores: true,
    reports: true,
    settings: true,
    users: false,
    'download-data': false
  },
  TEACHER: {
    dashboard: true,
    schools: true,
    registration: false,
    promotion: false,
    students: true,
    teachers: true,
    classes: true,
    subjects: true,
    attendance: true,
    scores: true,
    reports: true,
    settings: false,
    users: false,
    'download-data': false
  }
};

class PermissionService {
  constructor() {
    this.customPermissions = null;
    this.listeners = [];
  }

  /**
   * Load stored permissions from database
   */
  async load() {
    try {
      const record = await db.get('settings', 'role_permissions');
      if (record && record.value) {
        this.customPermissions = record.value;
        if (this.customPermissions.TEACHER) {
          if (this.customPermissions.TEACHER.schools === undefined) this.customPermissions.TEACHER.schools = true;
          if (this.customPermissions.TEACHER.teachers === undefined) this.customPermissions.TEACHER.teachers = true;
        }
        if (this.customPermissions.DIRECTOR) {
          if (this.customPermissions.DIRECTOR.schools === undefined) this.customPermissions.DIRECTOR.schools = true;
          if (this.customPermissions.DIRECTOR.teachers === undefined) this.customPermissions.DIRECTOR.teachers = true;
        }
      } else {
        this.customPermissions = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
      }
    } catch (err) {
      console.warn('Could not load permissions from DB, using defaults:', err);
      this.customPermissions = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    }
    return this.customPermissions;
  }

  /**
   * Get all permissions for both DIRECTOR and TEACHER
   */
  async getAll() {
    if (!this.customPermissions) {
      await this.load();
    }
    return {
      DIRECTOR: { ...DEFAULT_ROLE_PERMISSIONS.DIRECTOR, ...(this.customPermissions?.DIRECTOR || {}) },
      TEACHER: { ...DEFAULT_ROLE_PERMISSIONS.TEACHER, ...(this.customPermissions?.TEACHER || {}) }
    };
  }

  /**
   * Get permissions for a specific role
   */
  async getForRole(role) {
    if (role === 'ADMIN') {
      const adminPerms = {};
      MENU_KEYS.forEach(k => { adminPerms[k] = false; });
      adminPerms['settings'] = true;
      adminPerms['users'] = true;
      return adminPerms;
    }
    const all = await this.getAll();
    return all[role] || {};
  }

  /**
   * Synchronous check using in-memory cache
   */
  canRoleAccessRoute(role, routeKey) {
    // Admin has access strictly to User Accounts, System Settings, and Download Data
    if (role === 'ADMIN') {
      return routeKey === 'users' || routeKey === 'settings' || routeKey === 'download-data';
    }

    // Only Admin can access users and download data management
    if (routeKey === 'users' || routeKey === 'download-data') {
      return false;
    }

    // Registration queue and Promotion are strictly for DIRECTOR; forbidden for TEACHER and ADMIN
    if (routeKey === 'registration' || routeKey === 'promotion') {
      return role === 'DIRECTOR';
    }

    // Teachers and Directors always have access to Schools module
    if ((role === 'TEACHER' || role === 'DIRECTOR') && routeKey === 'schools') {
      return true;
    }

    const rolePerms = {
      ...(DEFAULT_ROLE_PERMISSIONS[role] || {}),
      ...(this.customPermissions?.[role] || {})
    };
    // Ensure Teachers have access to classes module unless explicitly forbidden
    if (role === 'TEACHER' && routeKey === 'classes') {
      return rolePerms[routeKey] !== undefined ? Boolean(rolePerms[routeKey]) : true;
    }
    return Boolean(rolePerms[routeKey]);
  }

  /**
   * Granular capability check (e.g. 'students.delete', 'reports.export')
   */
  canRole(role, action) {
    if (!role) return false;
    if (role === 'ADMIN') {
      // Admin has administrative user/permission and settings capabilities strictly
      const [moduleName] = action.split('.');
      if (moduleName && moduleName !== 'users' && moduleName !== 'settings') {
        return false;
      }
      return true;
    }

    // Allow schools module management for both TEACHER and DIRECTOR
    if (action.startsWith('schools.')) {
      return true;
    }

    // Check parent module first (e.g. 'students' from 'students.create')
    const [moduleName] = action.split('.');
    if (moduleName && !this.canRoleAccessRoute(role, moduleName)) {
      return false;
    }

    // Role-specific granular rules
    if (role === 'TEACHER') {
      // Teachers cannot delete records in other academic modules
      if (action.endsWith('.delete')) return false;
      // Teachers can view, create, and edit their single classroom, but cannot delete
      if (action === 'classes.create' || action === 'classes.edit' || action === 'classes.view') return true;
      if (action.startsWith('classes.')) return false;
      // Teachers can create and edit their single teacher profile, but not delete
      if (action === 'teachers.create' || action === 'teachers.edit' || action === 'teachers.view') return true;
      if (action.startsWith('teachers.')) return false;
    }

    return true;
  }

  /**
   * Save customized permissions for a role or all roles
   */
  async savePermissions(allPermissions, options = {}) {
    this.customPermissions = JSON.parse(JSON.stringify(allPermissions));
    await db.put('settings', {
      key: 'role_permissions',
      value: this.customPermissions,
      updatedAt: new Date().toISOString()
    });

    try {
      await db.put('activityLogs', {
        id: 'log-' + Date.now(),
        action: 'CHANGE_PERMISSIONS',
        details: 'Updated role sidebar menu permissions for Director and Teacher',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Could not write to activityLogs:', e);
    }

    if (options.syncToCloud !== false) {
      import('./adminDataService.js').then(({ AdminDataService }) => {
        AdminDataService.queueAutoSync();
      }).catch(() => {});
    }

    this.notify();
    return this.customPermissions;
  }

  /**
   * Reset permissions to factory defaults
   */
  async resetDefaults() {
    return await this.savePermissions(DEFAULT_ROLE_PERMISSIONS);
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => {
      try {
        fn(this.customPermissions);
      } catch (err) {
        console.error('Permission listener error:', err);
      }
    });
  }
}

export const permissionService = new PermissionService();
