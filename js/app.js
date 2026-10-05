/**
 * Main Application Bootstrapper
 * Coordinates theme, database initialization, authentication lifecycle,
 * and authenticated application shell.
 */
import { themeService } from './services/themeService.js';
import { fontService } from './services/fontService.js';
import { i18n } from './i18n/i18n.js';
import { authService } from './services/authService.js';
import { permissionService } from './services/permissionService.js';
import { db } from './database/db.js';
import { seedInitialData } from './database/seed.js';
import { WorkspaceSetupService } from './services/workspaceSetupService.js';
import { Sidebar } from './components/sidebar.js';
import { Topbar } from './components/topbar.js';
import { Router } from './router.js';
import { LoginPage } from './pages/login.js';
import { syncStateManager } from './services/syncStateManager.js';
import { AdminDataService } from './services/adminDataService.js';

class SchoolApp {
  constructor() {
    this.sidebar = null;
    this.topbar = null;
    this.router = null;
    this.loginPage = null;
  }

  async init() {
    console.log('Initializing SmartSchool Management System...');

    // 1. Initialize Theme, Typography/Fonts, Language, and Sync State Manager
    themeService.init();
    fontService.init();
    i18n.init();
    syncStateManager.init();

    // 2. Initialize System Database and Default Administrator
    try {
      await db.open();
      await seedInitialData();
      await permissionService.load();
      
      // Background pull of latest admin data (settings, users, passwords) from Google Sheet
      AdminDataService.checkAndSyncOnStartup().catch(e => {
        console.warn('Initial admin data sync notice:', e);
      });
    } catch (err) {
      console.error('Failed to initialize local IndexedDB:', err);
    }

    // 3. Listen to Auth changes
    authService.subscribe((user) => {
      if (user) {
        this.showAppShell();
      } else {
        // Reset Shell components on logout so fresh ones are mounted on next login
        this.sidebar = null;
        this.topbar = null;
        this.router = null;
        this.showLogin();
      }
    });

    // 4. Check session
    if (authService.isAuthenticated()) {
      this.showAppShell();
    } else {
      this.showLogin();
    }

    console.log('SmartSchool Application ready.');
  }

  showLogin() {
    const appShell = document.getElementById('app');
    const loginContainer = document.getElementById('login-container');

    if (appShell) appShell.classList.add('hidden');
    if (loginContainer) {
      loginContainer.classList.remove('hidden');
      this.loginPage = new LoginPage('login-container', () => {
        this.showAppShell();
      });
      this.loginPage.render();
    }
  }

  async showAppShell() {
    const appShell = document.getElementById('app');
    const loginContainer = document.getElementById('login-container');

    if (loginContainer) loginContainer.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');

    const currentUser = authService.getCurrentUser();
    const defaultRoute = currentUser?.role === 'ADMIN' ? 'users' : 'dashboard';

    // Role-based route guard on shell mount:
    const currentHash = window.location.hash.replace('#', '').trim();
    if (currentUser?.role === 'ADMIN') {
      if (currentHash !== 'users' && currentHash !== 'settings' && currentHash !== 'download-data') {
        window.location.hash = '#users';
      }
    } else if (currentUser) {
      const setup = await WorkspaceSetupService.getSetupStatus();
      if (!setup.isComplete && !WorkspaceSetupService.isSetupAllowedRoute(currentHash)) {
        window.location.hash = '#' + (setup.firstIncompleteRoute || 'schools');
      } else if (currentHash && !authService.canAccessRoute(currentHash)) {
        window.location.hash = `#${defaultRoute}`;
      }
    }

    if (!this.sidebar) {
      const initialRoute = window.location.hash.replace('#', '').trim() || defaultRoute;
      this.sidebar = new Sidebar('sidebar-container');
      this.sidebar.init(initialRoute);

      this.topbar = new Topbar('topbar-container', this.sidebar);
      this.topbar.init();

      this.router = new Router('page-content-container', this.sidebar);
      this.router.init();
      window.router = this.router;
    } else {
      window.router = this.router;
      this.sidebar.render();
      this.topbar?.render();
      this.router?.handleRoute();
    }
  }
}

// Bootstrap on DOM ready or immediately if already loaded
function bootstrap() {
  const app = new SchoolApp();
  app.init().catch(err => {
    console.error('Fatal initialization error:', err);
    // Fallback: force show login page on error so screen is never blank
    app.showLogin();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

