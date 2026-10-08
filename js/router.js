/**
 * Client-side Hash Router
 * Handles navigation without page reloads, compatible with browser & Electron
 * Enforces route-level RBAC permissions (ADMIN, DIRECTOR, TEACHER)
 */
import { DashboardPage } from './pages/dashboard.js';
import { StudentsPage } from './pages/students.js';
import { TeachersPage } from './pages/teachers.js';
import { ClassesPage } from './pages/classes.js';
import { AttendancePage } from './pages/attendance.js';
import { ScoresPage } from './pages/scores.js';
import { ReportsPage } from './pages/reports.js';
import { SettingsPage } from './pages/settings.js';
import { UsersPage } from './pages/users.js';
import { SchoolsPage } from './pages/schools.js';
import { RegistrationPage } from './pages/registration.js';
import { PromotionPage } from './pages/promotion.js';
import { SubjectsPage } from './pages/subjects.js';
import { DownloadDataPage } from './pages/downloadData.js';
import { authService } from './services/authService.js';
import { WorkspaceSetupService } from './services/workspaceSetupService.js';
import { getIcon } from './components/icons.js';
import { i18n } from './i18n/i18n.js';

const routes = {
  dashboard: DashboardPage,
  registration: RegistrationPage,
  promotion: PromotionPage,
  schools: SchoolsPage,
  classes: ClassesPage,
  teachers: TeachersPage,
  subjects: SubjectsPage,
  students: StudentsPage,
  attendance: AttendancePage,
  scores: ScoresPage,
  reports: ReportsPage,
  settings: SettingsPage,
  users: UsersPage,
  'download-data': DownloadDataPage
};

export class Router {
  constructor(contentContainerId, sidebar) {
    this.container = document.getElementById(contentContainerId);
    this.sidebar = sidebar;
    this.currentRoute = 'dashboard';
    this._refreshDebounce = null;

    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Re-render active route when language changes so translated text updates
    i18n.subscribe(() => {
      this.loadRoute(this.currentRoute, true);
    });

    // Debounced refresh when data changes in background, avoiding jarring flickers
    window.addEventListener('app:refresh-data', (e) => {
      const source = e.detail?.source || '';

      // 1. Never reload if active page is scores - scores page manages its own live grid
      if (this.currentRoute === 'scores') {
        return;
      }

      // 2. Never reload if user is actively focusing/typing in any input, textarea, or editable element
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      if (this._refreshDebounce) clearTimeout(this._refreshDebounce);
      this._refreshDebounce = setTimeout(() => {
        // Only refresh if no modal is currently open to avoid disrupting user interaction
        if (!document.querySelector('.dialog-overlay, [role="dialog"], #theme-color-modal-overlay')) {
          this.loadRoute(this.currentRoute, true);
        }
      }, 350);
    });
  }

  init() {
    this.handleRoute();
  }

  async handleRoute() {
    const rawHash = window.location.hash.replace('#', '').trim();
    const currentUser = authService.getCurrentUser();
    const defaultRoute = currentUser?.role === 'ADMIN' ? 'users' : 'dashboard';
    let route = routes[rawHash] ? rawHash : defaultRoute;

    // Automatic redirect if user does not have permission to access this route
    if (currentUser && !authService.canAccessRoute(route)) {
      window.location.hash = `#${defaultRoute}`;
      return;
    }

    // Check mandatory initial setup for Director & Teacher accounts
    if (currentUser && currentUser.role !== 'ADMIN') {
      const setup = await WorkspaceSetupService.getSetupStatus();
      if (!setup.isComplete && !WorkspaceSetupService.isSetupAllowedRoute(route)) {
        const target = setup.firstIncompleteRoute || 'schools';
        window.location.hash = `#${target}`;
        return;
      }
    }

    if (!window.location.hash || !routes[rawHash]) {
      window.location.hash = `#${route}`;
      return;
    }
    this.loadRoute(route);
  }

  async loadRoute(routeKey, force = false) {
    const currentUser = authService.getCurrentUser();
    const defaultRoute = currentUser?.role === 'ADMIN' ? 'users' : 'dashboard';

    // Automatic redirect if user does not have permission to access this route
    if (currentUser && !authService.canAccessRoute(routeKey)) {
      window.location.hash = `#${defaultRoute}`;
      return;
    }

    // Check mandatory initial setup for Director & Teacher accounts
    if (currentUser && currentUser.role !== 'ADMIN') {
      const setup = await WorkspaceSetupService.getSetupStatus();
      if (!setup.isComplete && !WorkspaceSetupService.isSetupAllowedRoute(routeKey)) {
        const target = setup.firstIncompleteRoute || 'schools';
        window.location.hash = `#${target}`;
        return;
      }
    }

    const defaultFallback = currentUser?.role === 'ADMIN' ? routes.users : routes.dashboard;
    const page = routes[routeKey] || defaultFallback;

    // Prevent jarring re-render/blink if clicking on the already active tab
    if (!force && this.currentRoute === routeKey && this.container?.children?.length > 0) {
      this.sidebar?.setActive(routeKey);
      return;
    }

    this.currentRoute = routeKey;
    this.sidebar?.setActive(routeKey);

    if (!this.container) return;

    // Enforce Route-level Permission Guard
    if (!authService.canAccessRoute(routeKey)) {
      const isKm = i18n.getLocale() === 'km';
      const backHref = currentUser?.role === 'ADMIN' ? '#users' : '#dashboard';
      const backLabel = currentUser?.role === 'ADMIN'
        ? (isKm ? 'ត្រឡប់ទៅការគ្រប់គ្រងគណនី' : 'Back to User Accounts')
        : (isKm ? 'ត្រឡប់ទៅផ្ទាំងព័ត៌មាន' : 'Back to Dashboard');

      this.container.innerHTML = `
        <div class="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div class="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            ${getIcon('lock', 'w-8 h-8')}
          </div>
          <h2 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
            ${isKm ? 'គ្មានសិទ្ធិចូលប្រើប្រាស់' : 'Access Denied'}
          </h2>
          <p class="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md">
            ${isKm 
              ? 'អ្នកមិនមានសិទ្ធិចូលមើលទំព័រនេះទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ។'
              : 'You do not have permission to access this page. Please contact your system administrator.'}
          </p>
          <a href="${backHref}" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm shadow transition-all">
            ${getIcon('arrowRight', 'w-4 h-4 rotate-180')}
            <span>${backLabel}</span>
          </a>
        </div>
      `;
      return;
    }

    try {
      await page.render(this.container);
    } catch (err) {
      console.error(`Error rendering page [${routeKey}]:`, err);
      this.container.innerHTML = `
        <div class="p-6 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <h4 class="font-bold">Error loading view</h4>
          <p class="mt-1">${err.message}</p>
        </div>
      `;
    }
  }
}
