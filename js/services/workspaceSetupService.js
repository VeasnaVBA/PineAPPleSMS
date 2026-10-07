/**
 * Workspace Initial Setup Guard Service
 * Enforces mandatory initial setup for Director and Teacher accounts:
 * 1. At least 1 School record (schools) - Step 1
 * 2. At least 1 Teacher record (teachers) - Step 2
 * 3. At least 1 Classroom record (classes) - Step 3
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
    const isAdmin = currentUser?.role === 'ADMIN';

    try {
      let [schools, classes, teachers] = await Promise.all([
        db.getAll('schools').catch(() => []),
        db.getAll('classes').catch(() => []),
        db.getAll('teachers').catch(() => [])
      ]);

      const hasSchool = Array.isArray(schools) && schools.length > 0;
      const hasClass = Array.isArray(classes) && classes.length > 0;
      const hasTeacher = Array.isArray(teachers) && teachers.length > 0;

      const completedCount = (hasSchool ? 1 : 0) + (hasClass ? 1 : 0) + (hasTeacher ? 1 : 0);
      const isComplete = hasSchool && hasClass && hasTeacher;

      const missingRoutes = [];
      if (!hasSchool) missingRoutes.push('schools');
      if (!hasTeacher) missingRoutes.push('teachers');
      if (!hasClass) missingRoutes.push('classes');

      const firstIncompleteRoute = !hasSchool ? 'schools' : (!hasTeacher ? 'teachers' : (!hasClass ? 'classes' : null));

      return {
        // Admin is never locked out of navigation, but setup status accurately reflects real records
        isComplete: isAdmin ? true : isComplete,
        isAdmin,
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
        isComplete: Boolean(isAdmin),
        isAdmin: Boolean(isAdmin),
        hasSchool: false,
        hasClass: false,
        hasTeacher: false,
        completedCount: 0,
        totalRequired: 3,
        counts: { schools: 0, classes: 0, teachers: 0 },
        missingRoutes: ['schools', 'teachers', 'classes'],
        firstIncompleteRoute: 'schools'
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

