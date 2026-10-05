import { i18n, t } from '../i18n/i18n.js';
import { authService } from '../services/authService.js';
import { fontService } from '../services/fontService.js';
import { WorkspaceSetupService } from '../services/workspaceSetupService.js';
import { toast } from './toast.js';
import { getIcon } from './icons.js';

export class Sidebar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    this.activeRoute = 'dashboard';

    // Subscribe to language change, auth change, font appearance/scale, and data refresh
    i18n.subscribe(() => this.render());
    authService.subscribe(() => this.render());
    fontService.subscribe(() => this.render());
    window.addEventListener('app:refresh-data', () => this.render());
    window.addEventListener('workspace:setup-updated', () => this.render());
  }

  async init(initialRoute = 'dashboard') {
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === 'ADMIN') {
      this.activeRoute = (initialRoute === 'settings' || initialRoute === 'download-data') ? initialRoute : 'users';
    } else {
      this.activeRoute = initialRoute;
    }
    await this.render();
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
      this.container.style.width = 'var(--sidebar-collapsed-width, 4.5rem)';
      if (contentArea) {
        contentArea.classList.add('sidebar-collapsed');
        contentArea.style.marginLeft = 'var(--sidebar-collapsed-width, 4.5rem)';
      }
    } else {
      this.container.classList.remove('collapsed');
      this.container.style.width = 'var(--sidebar-width, 16.5rem)';
      if (contentArea) {
        contentArea.classList.remove('sidebar-collapsed');
        contentArea.style.marginLeft = 'var(--sidebar-width, 16.5rem)';
      }
    }

    // Toggle label visibility
    const labels = this.container.querySelectorAll('.nav-label, .nav-badge, .setup-progress-card');
    labels.forEach(el => {
      el.style.display = this.isCollapsed ? 'none' : '';
    });

    const headerDetails = this.container.querySelector('.header-details');
    if (headerDetails) {
      headerDetails.style.display = this.isCollapsed ? 'none' : 'block';
    }
  }

  async render() {
    if (!this.container) return;

    const allNavItems = [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', href: '#dashboard' },
      { id: 'schools', labelKey: 'nav.schools', icon: 'school', href: '#schools', isSetupStep: 1 },
      { id: 'classes', labelKey: 'nav.classes', icon: 'classes', href: '#classes', isSetupStep: 2 },
      { id: 'teachers', labelKey: 'nav.teachers', icon: 'teachers', href: '#teachers', isSetupStep: 3 },
      { id: 'students', labelKey: 'nav.students', icon: 'students', href: '#students' },
      { id: 'registration', labelKey: 'nav.registration', icon: 'fileCheck', href: '#registration' },
      { id: 'promotion', labelKey: 'nav.promotion', icon: 'graduationCap', href: '#promotion' },
      { id: 'attendance', labelKey: 'nav.attendance', icon: 'attendance', href: '#attendance' },
      { id: 'scores', labelKey: 'nav.scores', icon: 'scores', href: '#scores' },
      { id: 'reports', labelKey: 'nav.reports', icon: 'reports', href: '#reports' },
      { id: 'users', labelKey: 'nav.users', icon: 'users', href: '#users' },
      { id: 'download-data', labelKey: 'nav.downloadData', icon: 'downloadCloud', href: '#download-data' },
      { id: 'settings', labelKey: 'nav.settings', icon: 'settings', href: '#settings' }
    ];

    // Filter items based on current user permissions
    const navItems = allNavItems.filter(item => authService.canAccessRoute(item.id));

    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();
    const fontClass = isKm ? 'font-khmer' : 'font-sans';

    // Role color scheme
    let roleBadgeColor = 'bg-primary/10 text-primary border-primary/20';
    if (currentUser?.role === 'ADMIN') {
      roleBadgeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    } else if (currentUser?.role === 'DIRECTOR') {
      roleBadgeColor = 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    } else if (currentUser?.role === 'TEACHER') {
      roleBadgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }

    // Check initial setup status for non-admin accounts
    const setup = await WorkspaceSetupService.getSetupStatus();

    this.container.innerHTML = `
      <div class="flex flex-col h-full bg-card border-r border-border sidebar-transition select-none">
        <!-- Sidebar Brand / Header -->
        <div class="h-16 flex items-center px-4 border-b border-border gap-3 overflow-hidden sidebar-header">
          <div class="w-10 h-10 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
            ${getIcon('school', 'w-5 h-5')}
          </div>
          <div class="header-details flex-1 min-w-0 transition-opacity duration-200">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-base tracking-tight truncate text-foreground ${fontClass}">${t('app.name')}</span>
              <span class="text-[0.6875rem] uppercase font-semibold px-1.5 py-0.5 rounded-sm ${roleBadgeColor} border">
                ${currentUser ? currentUser.role : t('app.badge')}
              </span>
            </div>
            <p class="text-xs text-muted-foreground truncate leading-tight mt-0.5 ${fontClass}">${t('app.tagline')}</p>
          </div>
        </div>

        <!-- Navigation Menu -->
        <div class="flex-1 overflow-y-auto py-4 px-3 space-y-1 sidebar-nav">
          ${!setup.isComplete ? `
            <!-- Setup Progress Banner -->
            <div class="setup-progress-card mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div class="flex items-center justify-between font-bold text-amber-700 dark:text-amber-300 ${fontClass}">
                <span>${isKm ? 'ការរៀបចំចាំបាច់' : 'Required Setup'}</span>
                <span class="font-mono text-[11px] bg-amber-500/20 px-1.5 py-0.5 rounded">${setup.completedCount}/3</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div class="h-full bg-amber-500 transition-all duration-300" style="width: ${(setup.completedCount / 3) * 100}%"></div>
              </div>
              <p class="text-[11px] text-muted-foreground leading-tight ${fontClass}">
                ${isKm ? 'សូមបញ្ចូលព័ត៌មានទាំង ៣ ដើម្បីដំណើរការម៉ឺនុយផ្សេងទៀត៖' : 'Please complete 3 steps to unlock all menus:'}
              </p>
            </div>
          ` : ''}

          ${navItems.map(item => {
            const isActive = this.activeRoute === item.id;
            const isLocked = !setup.isComplete && !WorkspaceSetupService.isSetupAllowedRoute(item.id);

            let statusBadge = '';
            if (!setup.isComplete) {
              if (item.id === 'schools') {
                statusBadge = setup.hasSchool 
                  ? `<span class="nav-badge text-emerald-600 dark:text-emerald-400 font-bold ml-auto text-xs" title="${isKm ? 'បានបញ្ចូលរួចរាល់' : 'Completed'}">✓</span>` 
                  : `<span class="nav-badge text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto ${fontClass}">${isKm ? 'ជំហាន ១' : 'Step 1'}</span>`;
              } else if (item.id === 'classes') {
                statusBadge = setup.hasClass 
                  ? `<span class="nav-badge text-emerald-600 dark:text-emerald-400 font-bold ml-auto text-xs" title="${isKm ? 'បានបញ្ចូលរួចរាល់' : 'Completed'}">✓</span>` 
                  : `<span class="nav-badge text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto ${fontClass}">${isKm ? 'ជំហាន ២' : 'Step 2'}</span>`;
              } else if (item.id === 'teachers') {
                statusBadge = setup.hasTeacher 
                  ? `<span class="nav-badge text-emerald-600 dark:text-emerald-400 font-bold ml-auto text-xs" title="${isKm ? 'បានបញ្ចូលរួចរាល់' : 'Completed'}">✓</span>` 
                  : `<span class="nav-badge text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto ${fontClass}">${isKm ? 'ជំហាន ៣' : 'Step 3'}</span>`;
              } else if (isLocked) {
                statusBadge = `<span class="nav-badge ml-auto text-muted-foreground opacity-60" title="${isKm ? 'ចាក់សោ (ត្រូវបំពេញសាលា ថ្នាក់ និងគ្រូជាមុន)' : 'Locked'}">${getIcon('lock', 'w-3.5 h-3.5')}</span>`;
              }
            }

            let linkClasses = 'nav-link flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 group relative ';
            if (isLocked) {
              linkClasses += 'opacity-40 cursor-not-allowed text-muted-foreground hover:bg-transparent';
            } else if (isActive) {
              linkClasses += 'bg-accent text-accent-foreground font-medium';
            } else {
              linkClasses += 'text-muted-foreground hover:text-foreground hover:bg-accent/60';
            }

            return `
              <a href="${isLocked ? 'javascript:void(0)' : item.href}" 
                 data-route="${item.id}"
                 data-locked="${isLocked ? 'true' : 'false'}"
                 title="${isLocked ? (isKm ? 'ម៉ឺនុយត្រូវបានចាក់សោ (ត្រូវបំពេញព័ត៌មានសាលារៀន ថ្នាក់រៀន និងគ្រូបង្រៀនជាមុន)' : 'Menu locked (Please input school, classroom, and teacher info first)') : t(item.labelKey)}"
                 class="${linkClasses}">
                <div class="flex-shrink-0 flex items-center justify-center w-5 h-5">
                  ${getIcon(item.icon, 'w-4 h-4')}
                </div>
                <span class="nav-label truncate tracking-wide ${fontClass} text-sm leading-normal flex-1">
                  ${t(item.labelKey)}
                </span>
                ${statusBadge}
                ${isActive ? `<span class="active-indicator absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary hidden"></span>` : ''}
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Intercept click on locked links
    this.container.querySelectorAll('.nav-link[data-locked="true"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toast.warning(
          isKm 
            ? 'សូមបំពេញព័ត៌មានចាំបាច់ទាំង ៣ ជាមុនសិន៖\n១. ព័ត៌មានសាលារៀន\n២. បញ្ជីថ្នាក់រៀន\n៣. ព័ត៌មានគ្រូបង្រៀន' 
            : 'Please complete the 3 required steps first:\n1. School Info\n2. Classroom Info\n3. Teacher Info',
          isKm ? 'ម៉ឺនុយត្រូវបានចាក់សោ' : 'Menu Locked'
        );
      });
    });

    this.applyCollapsedState();
  }

  updateActiveLinks() {
    if (!this.container) return;
    const links = this.container.querySelectorAll('.nav-link');
    links.forEach(link => {
      const route = link.getAttribute('data-route');
      const isLocked = link.getAttribute('data-locked') === 'true';
      const isActive = route === this.activeRoute;
      
      if (isLocked) {
        link.className = 'nav-link flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 group relative opacity-40 cursor-not-allowed text-muted-foreground hover:bg-transparent';
      } else if (isActive) {
        link.className = 'nav-link flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 group relative bg-accent text-accent-foreground font-medium';
      } else {
        link.className = 'nav-link flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 group relative text-muted-foreground hover:text-foreground hover:bg-accent/60';
      }
    });
  }
}

