import { i18n, t } from '../i18n/i18n.js';
import { themeService } from '../services/themeService.js';
import { authService } from '../services/authService.js';
import { fontService } from '../services/fontService.js';
import { SettingsService } from '../services/settingsService.js';
import { StudentService } from '../services/studentService.js';
import { getIcon } from './icons.js';
import { toast } from './toast.js';
import { SearchModal } from './searchModal.js';
import { NavbarSyncButtons } from './navbar.js';
import { ThemeColorModal } from './themeColorModal.js';

export class Topbar {
  constructor(containerId, sidebar) {
    this.container = document.getElementById(containerId);
    this.sidebar = sidebar;
    this.activeYear = '2024–2025';

    i18n.subscribe(() => {
      this.render();
      this.updateNotifications();
    });
    themeService.subscribe(() => this.render());
    authService.subscribe(() => this.render());
    fontService.subscribe(() => this.render());

    window.addEventListener('app:refresh-data', async () => {
      try {
        this.activeYear = await SettingsService.getActiveAcademicYear();
        const badgeEl = document.getElementById('topbar-active-ay-badge');
        if (badgeEl) badgeEl.textContent = this.activeYear;
      } catch (_) {}
      this.updateNotifications();
    });
  }

  async init() {
    try {
      this.activeYear = await SettingsService.getActiveAcademicYear();
    } catch (e) {
      console.warn('Could not load academic year from DB:', e);
    }
    this.render();
    this.updateNotifications();
  }

  render() {
    if (!this.container) return;

    const currentLocale = i18n.getLocale();
    const currentUser = authService.getCurrentUser();
    const isDark = themeService.isDark();
    const themeIconName = isDark ? 'sun' : 'moon';
    const themeTitle = isDark 
      ? (currentLocale === 'km' ? 'ប្តូរទៅផ្ទៃភ្លឺ (Light Mode)' : 'Switch to Light Mode')
      : (currentLocale === 'km' ? 'ប្តូរទៅផ្ទៃងងឹត (Dark Mode)' : 'Switch to Dark Mode');

    this.container.innerHTML = `
      <header class="h-16 border-b border-border bg-background/95 backdrop-blur px-4 flex items-center justify-between gap-4 select-none sticky top-0 z-30">
        <!-- Left Section: Toggle Sidebar -->
        <div class="flex items-center gap-3">
          <button id="btn-toggle-sidebar" 
                  aria-label="Toggle Sidebar"
                  class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            ${getIcon('menu', 'w-5 h-5')}
          </button>
        </div>

        <!-- Right Section: Academic Year, Language, Theme, Profile -->
        <div class="flex items-center gap-2 sm:gap-3">

          <!-- Academic Year Badge (Hidden for Admin) -->
          ${currentUser?.role !== 'ADMIN' ? `
            <div class="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border text-xs font-medium">
              ${getIcon('calendar', 'w-3.5 h-3.5')}
              <span id="topbar-active-ay-badge">${this.activeYear}</span>
            </div>
          ` : ''}

          <!-- Google Drive Cloud Sync Buttons (Sync to Drive & Restore from Drive) -->
          ${currentUser ? NavbarSyncButtons.renderHtml() : ''}

          <!-- Language Switcher Direct Toggle Button -->
          <button id="btn-lang-toggle" 
                  type="button"
                  title="${currentLocale === 'km' ? 'Switch to English' : 'ប្តូរទៅភាសាខ្មែរ'}"
                  class="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-xs font-medium text-foreground transition-all duration-150 shadow-xs cursor-pointer select-none">
            ${currentLocale === 'km' ? `
              ${getIcon('flagKm', 'w-5 h-3.5 rounded-[2px] shadow-2xs shrink-0 overflow-hidden')}
              <span class="font-khmer font-semibold text-xs">ខ្មែរ</span>
            ` : `
              ${getIcon('flagEn', 'w-5 h-3.5 rounded-[2px] shadow-2xs shrink-0 overflow-hidden')}
              <span class="font-semibold text-xs">English</span>
            `}
          </button>

          <!-- Theme Direct Toggle Button (Light / Dark) -->
          <button id="btn-theme-toggle" 
                  type="button"
                  title="${themeTitle}"
                  class="p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:text-foreground transition-colors shadow-xs cursor-pointer select-none">
            ${getIcon(themeIconName, 'w-4 h-4')}
          </button>

          <!-- Theme Color Customizer Button (Palette) -->
          <button id="btn-theme-color" 
                  type="button"
                  title="${currentLocale === 'km' ? 'ប្តូរពណ៌ចម្បង / ពណ៌ប៊ូតុង' : 'Customize Primary Theme Color'}"
                  class="p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:text-foreground transition-colors shadow-xs cursor-pointer select-none">
            <span class="text-primary">${getIcon('palette', 'w-4 h-4')}</span>
          </button>

          <!-- Notifications Dropdown -->
          <div class="relative inline-block text-left" id="notifications-dropdown-wrapper">
            <button id="btn-notifications" 
                    type="button"
                    title="${t('topbar.notifications')}"
                    class="p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:text-foreground relative transition-colors shadow-xs cursor-pointer select-none">
              ${getIcon('bell', 'w-4 h-4')}
              <span id="notif-badge" class="hidden absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center shadow-xs animate-pulse"></span>
            </button>
            <div id="notifications-menu" class="hidden absolute right-0 mt-1.5 w-80 sm:w-96 rounded-xl shadow-xl bg-popover border border-border py-2 z-50 animate-slide-down text-xs overflow-hidden">
              <div class="px-3.5 py-2 border-b border-border flex items-center justify-between">
                <div class="flex items-center gap-2">
                  ${getIcon('bell', 'w-4 h-4 text-primary')}
                  <span class="font-bold text-foreground text-sm font-khmer">${t('topbar.notifications')}</span>
                </div>
                <span id="notif-header-count" class="text-[11px] text-muted-foreground font-medium"></span>
              </div>
              <div id="notif-items-list" class="max-h-80 overflow-y-auto divide-y divide-border/40 p-1">
                <!-- Loaded dynamically -->
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="h-5 w-px bg-border mx-1"></div>

          <!-- User Profile & Dropdown -->
          ${(() => {
            const user = authService.getCurrentUser();
            const userDisplayName = user ? user.displayName : t('topbar.profile');
            const userRole = user ? user.role : t('topbar.role');
            const userInitials = user ? user.displayName.slice(0, 2).toUpperCase() : 'AD';
            let roleBadgeColor = 'bg-primary/10 text-primary border-primary/20';
            if (user?.role === 'ADMIN') roleBadgeColor = 'bg-destructive/10 text-destructive border-destructive/20';
            else if (user?.role === 'DIRECTOR') roleBadgeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
            else if (user?.role === 'TEACHER') roleBadgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';

            return `
              <div class="relative inline-block text-left" id="user-dropdown-wrapper">
                <button id="btn-user-profile" 
                        class="flex items-center gap-2 pl-1 cursor-pointer select-none focus:outline-none rounded-md hover:bg-accent p-1 transition-colors">
                  <div class="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                    ${userInitials}
                  </div>
                  <div class="hidden lg:block text-left leading-tight">
                    <p class="text-xs font-semibold text-foreground truncate max-w-[120px]">${userDisplayName}</p>
                    <p class="text-[11px] text-muted-foreground">${userRole}</p>
                  </div>
                  ${getIcon('chevronDown', 'w-3 h-3 text-muted-foreground hidden lg:block')}
                </button>
                <div id="user-menu" class="hidden absolute right-0 mt-1 w-48 rounded-md shadow-md bg-popover border border-border py-1 z-50 animate-slide-down text-xs">
                  <div class="px-3 py-2 border-b border-border">
                    <p class="font-semibold text-foreground truncate">${userDisplayName}</p>
                    <p class="text-[11px] text-muted-foreground">@${user?.username || ''}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadgeColor} border">
                      ${userRole}
                    </span>
                  </div>
                  <button id="btn-topbar-logout" class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-destructive/10 text-destructive font-medium transition-colors">
                    ${getIcon('logout', 'w-3.5 h-3.5')}
                    <span>${currentLocale === 'km' ? 'ចាកចេញពីគណនី' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            `;
          })()}
        </div>
      </header>
    `;

    this.bindEvents();
    this.updateNotifications();
  }

  async updateNotifications() {
    const badge = document.getElementById('notif-badge');
    const headerCount = document.getElementById('notif-header-count');
    const listEl = document.getElementById('notif-items-list');
    if (!badge || !listEl) return;

    const isKm = i18n.getLocale() === 'km';
    let students = [];
    let configuredYears = [];
    try {
      students = await StudentService.getAll();
      configuredYears = await SettingsService.getAcademicYears();
    } catch (_) {}

    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const configuredSet = new Set((configuredYears || []).map(y => normDash(typeof y === 'string' ? y : y.name)));

    // Group unconfigured academic year students
    const unconfiguredMap = new Map();
    for (const s of students) {
      const ay = String(s.academicYear || '').trim();
      if (ay !== '' && !configuredSet.has(normDash(ay))) {
        if (!unconfiguredMap.has(ay)) {
          unconfiguredMap.set(ay, []);
        }
        unconfiguredMap.get(ay).push(s);
      }
    }

    const unconfiguredCount = unconfiguredMap.size;
    if (unconfiguredCount > 0) {
      badge.textContent = unconfiguredCount;
      badge.classList.remove('hidden');
      if (headerCount) headerCount.textContent = `${unconfiguredCount} ${isKm ? 'ការជូនដំណឹងថ្មី' : 'alerts'}`;
    } else {
      badge.classList.add('hidden');
      if (headerCount) headerCount.textContent = isKm ? 'គ្មានការជូនដំណឹងបន្ទាន់' : 'All clear';
    }

    let itemsHtml = '';

    // 1. Unconfigured Academic Year Alert Cards
    for (const [ayName, studentList] of unconfiguredMap.entries()) {
      itemsHtml += `
        <div class="p-3 hover:bg-muted/40 transition-colors space-y-2.5">
          <div class="flex items-start gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              ${getIcon('alertTriangle', 'w-4 h-4')}
            </div>
            <div class="space-y-0.5 flex-1 min-w-0">
              <p class="font-bold text-foreground leading-tight ${isKm ? 'font-khmer' : ''}">
                ${t('students.notifAyTitle', { year: ayName })}
              </p>
              <p class="text-[11px] text-muted-foreground leading-relaxed ${isKm ? 'font-khmer' : ''}">
                ${t('students.notifAyDesc', { count: studentList.length })}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
            <button type="button" 
                    class="btn-apply-notif-ay inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    data-year="${ayName}">
              ${getIcon('check', 'w-3.5 h-3.5')}
              <span class="${isKm ? 'font-khmer' : ''}">${t('students.applyAcademicYear')}</span>
            </button>
          </div>
        </div>
      `;
    }

    // 2. System Status Info Card
    itemsHtml += `
      <div class="p-3 bg-muted/20 hover:bg-muted/40 transition-colors flex items-start gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
          ${getIcon('database', 'w-4 h-4')}
        </div>
        <div class="space-y-0.5">
          <p class="font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">
            ${isKm ? 'ប្រព័ន្ធដំណើរការស្របពេល Offline' : 'Offline Mode Active'}
          </p>
          <p class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : ''}">
            ${isKm ? 'ទិន្នន័យត្រូវបានរក្សាទុកក្នុង IndexedDB ដោយសុវត្ថិភាពខ្ពស់។' : 'All data stored locally in indexedDB storage.'}
          </p>
        </div>
      </div>
    `;

    listEl.innerHTML = itemsHtml;

    // Bind Apply button events
    listEl.querySelectorAll('.btn-apply-notif-ay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const yearToApply = btn.getAttribute('data-year');
        if (!yearToApply) return;

        btn.disabled = true;
        btn.innerHTML = `<div class="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></div> <span>...</span>`;

        try {
          const createdYear = await SettingsService.createAcademicYear({ name: yearToApply });
          const studentsToFix = unconfiguredMap.get(yearToApply) || [];

          for (const s of studentsToFix) {
            await StudentService.update(s.id, { academicYear: createdYear.name });
          }

          toast.success(t('students.applyAySuccess', { year: createdYear.name, count: studentsToFix.length }));
          window.dispatchEvent(new CustomEvent('app:refresh-data'));
          await this.updateNotifications();
        } catch (err) {
          toast.error(err.message || 'Failed to apply academic year');
          btn.disabled = false;
        }
      });
    });
  }

  bindEvents() {
    // Sidebar toggle
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    toggleBtn?.addEventListener('click', () => {
      this.sidebar?.toggleCollapse();
    });

    // Language Direct Toggle Button
    const langBtn = document.getElementById('btn-lang-toggle');
    langBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentLocale = i18n.getLocale();
      const nextLocale = currentLocale === 'km' ? 'en' : 'km';
      i18n.setLocale(nextLocale);
      toast.info(nextLocale === 'km' ? 'ភាសាត្រូវបានប្តូរទៅជា ភាសាខ្មែរ 🇰🇭' : 'Language switched to English 🇬🇧');
    });

    // Direct Theme Toggle (Only 2 themes: Light & Dark)
    const themeBtn = document.getElementById('btn-theme-toggle');
    themeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextTheme = themeService.toggle();
      const isKm = i18n.getLocale() === 'km';
      if (nextTheme === 'dark') {
        toast.info(isKm ? 'បានប្តូរទៅផ្ទៃងងឹត 🌙' : 'Switched to Dark Mode 🌙');
      } else {
        toast.info(isKm ? 'បានប្តូរទៅផ្ទៃភ្លឺ ☀️' : 'Switched to Light Mode ☀️');
      }
    });

    // Theme Color Customizer Modal
    const themeColorBtn = document.getElementById('btn-theme-color');
    themeColorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      ThemeColorModal.open();
    });

    // User profile dropdown
    const userBtn = document.getElementById('btn-user-profile');
    const userMenu = document.getElementById('user-menu');
    userBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu?.classList.toggle('hidden');
      document.getElementById('notifications-menu')?.classList.add('hidden');
    });

    // Topbar logout
    const logoutBtn = document.getElementById('btn-topbar-logout');
    logoutBtn?.addEventListener('click', () => {
      authService.logout();
    });

    // Notifications menu toggle
    const notifBtn = document.getElementById('btn-notifications');
    const notifMenu = document.getElementById('notifications-menu');
    notifBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu?.classList.add('hidden');
      notifMenu?.classList.toggle('hidden');
      if (!notifMenu?.classList.contains('hidden')) {
        this.updateNotifications();
      }
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notifications-dropdown-wrapper')) {
        notifMenu?.classList.add('hidden');
      }
      if (!e.target.closest('#user-dropdown-wrapper')) {
        userMenu?.classList.add('hidden');
      }
    });

    // Topbar Google Drive Cloud Sync Buttons
    NavbarSyncButtons.bindEvents(this.container);

    // Ctrl+K keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        SearchModal.open();
      }
    });
  }
}
