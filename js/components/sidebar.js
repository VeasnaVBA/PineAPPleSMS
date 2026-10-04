/**
 * Sidebar Navigation Component
 * Responsive, collapsible, remembers state in localStorage, supports i18n,
 * and dynamically filters menus based on user role (ADMIN, DIRECTOR, TEACHER).
 */
import { i18n, t } from '../i18n/i18n.js';
import { authService } from '../services/authService.js';
import { getIcon } from './icons.js';

export class Sidebar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    this.activeRoute = 'dashboard';

    // Subscribe to language change and auth change to re-render dynamically
    i18n.subscribe(() => this.render());
    authService.subscribe(() => this.render());
  }

  init(initialRoute = 'dashboard') {
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === 'ADMIN') {
      this.activeRoute = (initialRoute === 'settings' || initialRoute === 'download-data') ? initialRoute : 'users';
    } else {
      this.activeRoute = initialRoute;
    }
    this.render();
    this.applyCollapsedState();
  }

  setActive(route) {
    this.activeRoute = route;
    this.updateActiveLinks();
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem('sidebar_collapsed', this.isCollapsed ? 'true' : 'false');
    this.applyCollapsedState();
  }

  applyCollapsedState() {
    if (!this.container) return;
    const contentArea = document.getElementById('main-content-wrapper');

    if (this.isCollapsed) {
      this.container.classList.add('collapsed');
      this.container.style.width = '72px';
      if (contentArea) contentArea.style.marginLeft = '72px';
    } else {
      this.container.classList.remove('collapsed');
      this.container.style.width = '260px';
      if (contentArea) contentArea.style.marginLeft = '260px';
    }

    // Toggle label visibility
    const labels = this.container.querySelectorAll('.nav-label');
    labels.forEach(el => {
      el.style.display = this.isCollapsed ? 'none' : 'inline-block';
    });

    const headerDetails = this.container.querySelector('.header-details');
    if (headerDetails) {
      headerDetails.style.display = this.isCollapsed ? 'none' : 'block';
    }
  }

  render() {
    if (!this.container) return;

    const allNavItems = [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', href: '#dashboard' },
      { id: 'registration', labelKey: 'nav.registration', icon: 'fileCheck', href: '#registration' },
      { id: 'promotion', labelKey: 'nav.promotion', icon: 'graduationCap', href: '#promotion' },
      { id: 'students', labelKey: 'nav.students', icon: 'students', href: '#students' },
      { id: 'teachers', labelKey: 'nav.teachers', icon: 'teachers', href: '#teachers' },
      { id: 'classes', labelKey: 'nav.classes', icon: 'classes', href: '#classes' },
      { id: 'attendance', labelKey: 'nav.attendance', icon: 'attendance', href: '#attendance' },
      { id: 'scores', labelKey: 'nav.scores', icon: 'scores', href: '#scores' },
      { id: 'schools', labelKey: 'nav.schools', icon: 'school', href: '#schools' },
      { id: 'reports', labelKey: 'nav.reports', icon: 'reports', href: '#reports' },
      { id: 'users', labelKey: 'nav.users', icon: 'users', href: '#users' },
      { id: 'download-data', labelKey: 'nav.downloadData', icon: 'downloadCloud', href: '#download-data' },
      { id: 'settings', labelKey: 'nav.settings', icon: 'settings', href: '#settings' }
    ];

    // Filter items based on current user permissions
    const navItems = allNavItems.filter(item => authService.canAccessRoute(item.id));

    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();

    // Role color scheme
    let roleBadgeColor = 'bg-primary/10 text-primary border-primary/20';
    if (currentUser?.role === 'ADMIN') {
      roleBadgeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    } else if (currentUser?.role === 'DIRECTOR') {
      roleBadgeColor = 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    } else if (currentUser?.role === 'TEACHER') {
      roleBadgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }

    this.container.innerHTML = `
      <div class="flex flex-col h-full bg-card border-r border-border sidebar-transition select-none">
        <!-- Sidebar Brand / Header -->
        <div class="h-16 flex items-center px-4 border-b border-border gap-3 overflow-hidden sidebar-header">
          <div class="w-10 h-10 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
            ${getIcon('school', 'w-5 h-5')}
          </div>
          <div class="header-details flex-1 min-w-0 transition-opacity duration-200">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-base tracking-tight truncate text-foreground">${t('app.name')}</span>
              <span class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-sm ${roleBadgeColor} border">
                ${currentUser ? currentUser.role : t('app.badge')}
              </span>
            </div>
            <p class="text-xs text-muted-foreground truncate leading-none mt-0.5">${t('app.tagline')}</p>
          </div>
        </div>

        <!-- Navigation Menu -->
        <div class="flex-1 overflow-y-auto py-4 px-3 space-y-1 sidebar-nav">
          ${navItems.map(item => {
            const isActive = this.activeRoute === item.id;
            const activeClasses = isActive
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60';

            return `
              <a href="${item.href}" 
                 data-route="${item.id}"
                 title="${t(item.labelKey)}"
                 class="nav-link flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 group relative ${activeClasses}">
                <div class="flex-shrink-0 flex items-center justify-center w-5 h-5">
                  ${getIcon(item.icon, 'w-4 h-4')}
                </div>
                <span class="nav-label truncate tracking-wide ${isKm ? 'font-khmer text-[13.5px]' : ''}">
                  ${t(item.labelKey)}
                </span>
                ${isActive ? `<span class="active-indicator absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary hidden"></span>` : ''}
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.applyCollapsedState();
  }

  updateActiveLinks() {
    if (!this.container) return;
    const links = this.container.querySelectorAll('.nav-link');
    links.forEach(link => {
      const route = link.getAttribute('data-route');
      const isActive = route === this.activeRoute;
      if (isActive) {
        link.className = 'nav-link flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 group relative bg-accent text-accent-foreground font-medium';
      } else {
        link.className = 'nav-link flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 group relative text-muted-foreground hover:text-foreground hover:bg-accent/60';
      }
    });
  }
}
