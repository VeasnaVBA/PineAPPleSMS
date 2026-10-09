import { i18n, t } from '../i18n/i18n.js';
import { authService } from '../services/authService.js';
import { fontService } from '../services/fontService.js';
import { WorkspaceSetupService } from '../services/workspaceSetupService.js';
import { toast } from './toast.js';
import { Modal } from './modal.js';
import { getIcon } from './icons.js';
import { APP_LOGO_BASE64 } from '../config/appLogo.js';

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
      { id: 'teachers', labelKey: 'nav.teachers', icon: 'teachers', href: '#teachers', isSetupStep: 2 },
      { id: 'classes', labelKey: 'nav.classes', icon: 'classes', href: '#classes', isSetupStep: 3 },
      { id: 'subjects', labelKey: 'nav.subjects', icon: 'bookOpen', href: '#subjects' },
      { id: 'students', labelKey: 'nav.students', icon: 'students', href: '#students' },
      { id: 'registration', labelKey: 'nav.registration', icon: 'fileCheck', href: '#registration' },
      { id: 'promotion', labelKey: 'nav.promotion', icon: 'badgeCheck', href: '#promotion' },
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
    const isAdmin = currentUser?.role === 'ADMIN';
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

    // Check initial setup status for all accounts
    const setup = await WorkspaceSetupService.getSetupStatus();

    this.container.innerHTML = `
      <div class="flex flex-col h-full bg-card border-r border-border sidebar-transition select-none">
        <!-- Sidebar Brand / Header -->
        <div class="h-16 flex items-center px-4 border-b border-border gap-3 overflow-hidden sidebar-header">
          <div class="w-9 h-9 flex items-center justify-center flex-shrink-0">
            <img src="${APP_LOGO_BASE64}" alt="App Logo" class="w-full h-full object-contain" />
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
          ${(!setup.isComplete && !isAdmin) ? `
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
            const isLocked = !isAdmin && !setup.isComplete && !WorkspaceSetupService.isSetupAllowedRoute(item.id);

            let statusBadge = '';
            if (!setup.isComplete || isAdmin) {
              if (item.id === 'schools') {
                statusBadge = setup.hasSchool 
                  ? `<span class="nav-badge text-emerald-600 dark:text-emerald-400 font-bold ml-auto text-xs" title="${isKm ? 'បានបញ្ចូលរួចរាល់' : 'Completed'}">✓</span>` 
                  : `<span class="nav-badge text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto ${fontClass}">${isKm ? 'ជំហាន ១' : 'Step 1'}</span>`;
              } else if (item.id === 'teachers' && !isAdmin) {
                statusBadge = setup.hasTeacher 
                  ? `<span class="nav-badge text-emerald-600 dark:text-emerald-400 font-bold ml-auto text-xs" title="${isKm ? 'បានបញ្ចូលរួចរាល់' : 'Completed'}">✓</span>` 
                  : `<span class="nav-badge text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto ${fontClass}">${isKm ? 'ជំហាន ២' : 'Step 2'}</span>`;
              } else if (item.id === 'classes' && !isAdmin) {
                statusBadge = setup.hasClass 
                  ? `<span class="nav-badge text-emerald-600 dark:text-emerald-400 font-bold ml-auto text-xs" title="${isKm ? 'បានបញ្ចូលរួចរាល់' : 'Completed'}">✓</span>` 
                  : `<span class="nav-badge text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto ${fontClass}">${isKm ? 'ជំហាន ៣' : 'Step 3'}</span>`;
              } else if (isLocked) {
                statusBadge = `<span class="nav-badge ml-auto text-muted-foreground opacity-60" title="${isKm ? 'ចាក់សោ (ត្រូវបំពេញសាលា គ្រូ និងថ្នាក់ជាមុន)' : 'Locked'}">${getIcon('lock', 'w-3.5 h-3.5')}</span>`;
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
                 title="${isLocked ? (isKm ? 'ម៉ឺនុយត្រូវបានចាក់សោ (ត្រូវបំពេញព័ត៌មានសាលារៀន គ្រូបង្រៀន និងថ្នាក់រៀនជាមុន)' : 'Menu locked (Please input school, teacher, and classroom info first)') : t(item.labelKey)}"
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
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentSetup = await WorkspaceSetupService.getSetupStatus();
        const nextRoute = currentSetup.firstIncompleteRoute || 'schools';
        let nextRouteName = isKm ? 'សាលារៀន' : 'School Info';
        if (nextRoute === 'teachers') nextRouteName = isKm ? 'គ្រូបង្រៀន' : 'Teacher Info';
        else if (nextRoute === 'classes') nextRouteName = isKm ? 'ថ្នាក់រៀន' : 'Classroom Info';

        // 1. Toast warning (now supported with icon and amber styling)
        toast.warning(
          isKm 
            ? 'សូមបំពេញព័ត៌មានចាំបាច់ទាំង ៣ ជាមុនសិន៖\n១. ព័ត៌មានសាលារៀន\n២. ព័ត៌មានគ្រូបង្រៀន\n៣. បញ្ជីថ្នាក់រៀន' 
            : 'Please complete the 3 required steps first:\n1. School Info\n2. Teacher Info\n3. Classroom Info',
          isKm ? 'ម៉ឺនុយត្រូវបានចាក់សោ' : 'Menu Locked'
        );

        // 2. Open informative Setup Notice Modal with direct jump button
        const contentHtml = `
          <div class="space-y-4 text-xs select-none">
            <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <span class="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                ${getIcon('lock', 'w-5 h-5')}
              </span>
              <div class="space-y-1">
                <p class="font-bold text-sm">
                  ${isKm ? 'ម៉ឺនុយនេះត្រូវបានចាក់សោបណ្តោះអាសន្ន' : 'This menu is temporarily locked'}
                </p>
                <p class="text-xs leading-relaxed text-muted-foreground">
                  ${isKm 
                    ? 'ដើម្បីដំណើរការម៉ឺនុយនេះ សូមបំពេញព័ត៌មានចាំបាច់ទាំង ៣ ជំហានខាងក្រោមជាមុនសិន៖' 
                    : 'To access this menu, please complete the 3 required setup steps below first:'}
                </p>
              </div>
            </div>

            <!-- Steps checklist -->
            <div class="space-y-2 p-3 rounded-xl border border-border bg-card">
              <!-- Step 1: School -->
              <div class="flex items-center justify-between p-2.5 rounded-lg ${currentSetup.hasSchool ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted/60 text-foreground'}">
                <div class="flex items-center gap-2.5 font-medium">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentSetup.hasSchool ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}">
                    ${currentSetup.hasSchool ? '✓' : '១'}
                  </span>
                  <span>${isKm ? 'ជំហាន ១: បញ្ចូលព័ត៌មានសាលារៀន (School)' : 'Step 1: School Information'}</span>
                </div>
                <span class="text-[11px] font-semibold">${currentSetup.hasSchool ? (isKm ? 'រួចរាល់' : 'Completed') : (isKm ? 'មិនទាន់បំពេញ' : 'Missing')}</span>
              </div>

              <!-- Step 2: Teacher -->
              <div class="flex items-center justify-between p-2.5 rounded-lg ${currentSetup.hasTeacher ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted/60 text-foreground'}">
                <div class="flex items-center gap-2.5 font-medium">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentSetup.hasTeacher ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}">
                    ${currentSetup.hasTeacher ? '✓' : '២'}
                  </span>
                  <span>${isKm ? 'ជំហាន ២: បញ្ចូលព័ត៌មានគ្រូបង្រៀន (Teacher)' : 'Step 2: Teacher Information'}</span>
                </div>
                <span class="text-[11px] font-semibold">${currentSetup.hasTeacher ? (isKm ? 'រួចរាល់' : 'Completed') : (isKm ? 'មិនទាន់បំពេញ' : 'Missing')}</span>
              </div>

              <!-- Step 3: Class -->
              <div class="flex items-center justify-between p-2.5 rounded-lg ${currentSetup.hasClass ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted/60 text-foreground'}">
                <div class="flex items-center gap-2.5 font-medium">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentSetup.hasClass ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}">
                    ${currentSetup.hasClass ? '✓' : '៣'}
                  </span>
                  <span>${isKm ? 'ជំហាន ៣: បញ្ចូលបញ្ជីថ្នាក់រៀន (Classroom)' : 'Step 3: Classroom Information'}</span>
                </div>
                <span class="text-[11px] font-semibold">${currentSetup.hasClass ? (isKm ? 'រួចរាល់' : 'Completed') : (isKm ? 'មិនទាន់បំពេញ' : 'Missing')}</span>
              </div>
            </div>
          </div>
        `;

        const setupModal = Modal.open({
          title: isKm ? 'ការរៀបចំចាំបាច់មិនទាន់បានបញ្ចប់' : 'Setup Steps Incomplete',
          content: contentHtml,
          maxWidth: 'max-w-md',
          footer: `
            <div class="flex items-center justify-between w-full">
              <button id="btn-close-setup-modal" class="px-3.5 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium cursor-pointer">
                ${t('common.cancel')}
              </button>
              <button id="btn-goto-next-setup-step" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-xs cursor-pointer">
                <span>${isKm ? `ទៅកាន់ ${nextRouteName}` : `Go to ${nextRouteName}`}</span>
                ${getIcon('arrowRight', 'w-3.5 h-3.5')}
              </button>
            </div>
          `
        });

        setupModal.element.querySelector('#btn-close-setup-modal')?.addEventListener('click', () => setupModal.close());
        setupModal.element.querySelector('#btn-goto-next-setup-step')?.addEventListener('click', () => {
          setupModal.close();
          window.location.hash = `#${nextRoute}`;
        });
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

