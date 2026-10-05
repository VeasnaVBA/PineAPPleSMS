/**
 * Workspace Initial Setup Guard Service
 * Enforces mandatory initial setup for Director and Teacher accounts:
 * 1. At least 1 School record (schools)
 * 2. At least 1 Classroom record (classes)
 * 3. At least 1 Teacher record (teachers)
 * 
 * If any of these 3 are missing, all other sidebar menus remain locked.
 */
import { db } from '../database/db.js';
import { authService } from './authService.js';
import { SettingsService } from './settingsService.js';

export const WorkspaceSetupService = {
  /**
   * Broadcast setup status change event to update UI in real-time
   */
  notifySetupChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workspace:setup-updated'));
      window.dispatchEvent(new CustomEvent('app:refresh-data'));
    }
  },

  /**
   * Check whether the active user's workspace has completed the 3 mandatory setup steps.
   */
  async getSetupStatus() {
    const currentUser = authService.getCurrentUser();
    
    // Master Admin is exempt as Admin manages global users and system settings
    if (!currentUser || currentUser.role === 'ADMIN') {
      return {
        isComplete: true,
        hasSchool: true,
        hasClass: true,
        hasTeacher: true,
        completedCount: 3,
        totalRequired: 3,
        counts: { schools: 1, classes: 1, teachers: 1 },
        missingRoutes: [],
        firstIncompleteRoute: null
      };
    }

    try {
      let [schools, classes, teachers] = await Promise.all([
        db.getAll('schools').catch(() => []),
        db.getAll('classes').catch(() => []),
        db.getAll('teachers').catch(() => [])
      ]);

      // Fallback check for schools in settings store if IndexedDB schools store is empty
      if (!schools || schools.length === 0) {
        try {
          const fallbackSchools = await SettingsService.get('schools_catalog');
          if (Array.isArray(fallbackSchools) && fallbackSchools.length > 0) {
            schools = fallbackSchools;
          }
        } catch (_) {}
      }

      const hasSchool = Array.isArray(schools) && schools.length > 0;
      const hasClass = Array.isArray(classes) && classes.length > 0;
      const hasTeacher = Array.isArray(teachers) && teachers.length > 0;

      const completedCount = (hasSchool ? 1 : 0) + (hasClass ? 1 : 0) + (hasTeacher ? 1 : 0);
      const isComplete = hasSchool && hasClass && hasTeacher;

      const missingRoutes = [];
      if (!hasSchool) missingRoutes.push('schools');
      if (!hasClass) missingRoutes.push('classes');
      if (!hasTeacher) missingRoutes.push('teachers');

      const firstIncompleteRoute = !hasSchool ? 'schools' : (!hasClass ? 'classes' : (!hasTeacher ? 'teachers' : null));

      return {
        isComplete,
        hasSchool,
        hasClass,
        hasTeacher,
        completedCount,
        totalRequired: 3,
        counts: {
          schools: schools ? schools.length : 0,
          classes: classes ? classes.length : 0,
          teachers: teachers ? teachers.length : 0
        },
        missingRoutes,
        firstIncompleteRoute
      };
    } catch (err) {
      console.warn('WorkspaceSetupService check error:', err);
      return {
        isComplete: true,
        hasSchool: true,
        hasClass: true,
        hasTeacher: true,
        completedCount: 3,
        totalRequired: 3,
        counts: { schools: 0, classes: 0, teachers: 0 },
        missingRoutes: [],
        firstIncompleteRoute: null
      };
    }
  },

  /**
   * Returns true if the route is part of the initial setup workflow or basic settings
   */
  isSetupAllowedRoute(routeId) {
    return ['schools', 'classes', 'teachers', 'settings', 'download-data'].includes(routeId);
  }
};
