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
import { Modal } from './modal.js';
import { AdminDataService } from '../services/adminDataService.js';

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
                <div id="user-menu" class="hidden absolute right-0 mt-1 w-56 rounded-md shadow-md bg-popover border border-border py-1 z-50 animate-slide-down text-xs">
                  <div class="px-3 py-2 border-b border-border">
                    <p class="font-semibold text-foreground truncate">${userDisplayName}</p>
                    <p class="text-[11px] text-muted-foreground">@${user?.username || ''}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadgeColor} border">
                      ${userRole}
                    </span>
                  </div>
                  <!-- Sync User Accounts from Drive -->
                  <button id="btn-topbar-sync-user-accounts" 
                          type="button" 
                          title="${currentLocale === 'km' ? 'ទាញគណនីអ្នកប្រើប្រាស់ និងសិទ្ធិពី Google Sheet ក្នុង Drive' : 'Sync user accounts and permissions from Google Sheet in Drive'}" 
                          class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent text-foreground font-medium transition-colors border-b border-border/40 cursor-pointer">
                    ${getIcon('users', 'w-3.5 h-3.5 text-primary shrink-0')}
                    <span>${t('topbar.syncUserAcc')}</span>
                  </button>
                  ${user?.role === 'TEACHER' ? `
                    <button id="btn-topbar-clear-teacher-students" 
                            type="button" 
                            title="${currentLocale === 'km' ? 'លុបទិន្នន័យសិស្សទាំងអស់' : 'Delete All Students'}" 
                            class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium transition-colors border-b border-border/40 cursor-pointer">
                      ${getIcon('trash', 'w-3.5 h-3.5 shrink-0')}
                      <span>${currentLocale === 'km' ? 'សិស្ស' : 'Student'}</span>
                    </button>
                  ` : ''}
                  <button id="btn-topbar-logout" type="button" class="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-destructive/10 text-destructive font-medium transition-colors cursor-pointer">
                    ${getIcon('logout', 'w-3.5 h-3.5 shrink-0')}
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

    // Teacher student clear action
    const clearTeacherStudentsBtn = document.getElementById('btn-topbar-clear-teacher-students');
    clearTeacherStudentsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu?.classList.add('hidden');
      this.openTeacherDeleteStudentsModal();
    });

    // Sync User Accounts from Drive (in profile menu)
    const syncUserAccBtn = document.getElementById('btn-topbar-sync-user-accounts');
    syncUserAccBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      userMenu?.classList.add('hidden');
      syncUserAccBtn.disabled = true;
      try {
        const res = await AdminDataService.pullFromGoogleSheet({ silent: false });
        if (res?.success) {
          window.dispatchEvent(new CustomEvent('app:refresh-data'));
          window.dispatchEvent(new CustomEvent('users:reload'));
        }
      } finally {
        syncUserAccBtn.disabled = false;
      }
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

  /**
   * Password-protected dialog allowing teachers to wipe all student records in their workspace
   */
  openTeacherDeleteStudentsModal() {
    const isKm = i18n.getLocale() === 'km';
    
    const contentHtml = `
      <div class="space-y-4 text-xs select-none">
        <div class="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <div class="shrink-0 mt-0.5">
            ${getIcon('alertTriangle', 'w-5 h-5 text-rose-600 dark:text-rose-400')}
          </div>
          <div class="space-y-1 leading-relaxed">
            <p class="font-bold text-sm ${isKm ? 'font-khmer' : ''}">
              ${isKm ? 'តើអ្នកពិតជាចង់លុបទិន្នន័យសិស្សទាំងអស់មែនទេ?' : 'Permanently Delete All Student Records?'}
            </p>
            <p class="text-[11px] opacity-90 ${isKm ? 'font-khmer' : ''}">
              ${isKm 
                ? 'សកម្មភាពនេះនឹងលុបបញ្ជីសិស្សទាំងអស់ រួមទាំងពិន្ទុ និងវត្តមាននៅក្នុងគណនីរបស់អ្នកចោលជាអចិន្ត្រៃយ៍។ ព័ត៌មានសាលារៀន និងថ្នាក់រៀននឹងនៅរក្សាទុកដដែល។' 
                : 'This action will wipe all student records, scores, and attendance in your account. School and classroom records will remain intact.'}
            </p>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="block font-medium text-foreground ${isKm ? 'font-khmer' : ''}">
            ${isKm ? 'សូមបញ្ចូលពាក្យសម្ងាត់គណនីរបស់អ្នកដើម្បីបញ្ជាក់៖' : 'Enter your account password to confirm:'}
          </label>
          <div class="relative">
            <input type="password" 
                   id="input-teacher-del-pwd" 
                   autocomplete="current-password"
                   placeholder="${isKm ? 'ពាក្យសម្ងាត់គណនី' : 'Account password'}"
                   class="w-full px-3 py-2 pr-10 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-destructive transition-all" />
            <button type="button" 
                    id="btn-toggle-del-pwd" 
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="${isKm ? 'បង្ហាញ/លាក់ពាក្យសម្ងាត់' : 'Show/Hide password'}">
              ${getIcon('eye', 'w-4 h-4')}
            </button>
          </div>
          <p id="teacher-del-pwd-error" class="hidden text-[11px] text-destructive font-medium mt-1"></p>
        </div>
      </div>
    `;

    const footerHtml = `
      <button id="btn-cancel-teacher-del" type="button" class="px-3.5 py-1.5 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors cursor-pointer select-none">
        ${isKm ? 'បោះបង់' : 'Cancel'}
      </button>
      <button id="btn-confirm-teacher-del" type="button" class="px-3.5 py-1.5 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer select-none">
        ${getIcon('trash', 'w-3.5 h-3.5')}
        <span>${isKm ? 'លុបទិន្នន័យសិស្សទាំងអស់' : 'Delete All Students'}</span>
      </button>
    `;

    const modal = Modal.open({
      title: isKm ? 'លុបទិន្នន័យសិស្សក្នុងគណនី' : 'Delete Account Student Data',
      content: contentHtml,
      footer: footerHtml,
      maxWidth: 'max-w-md',
      preventUnsavedClose: false
    });

    const modalEl = modal.element;
    const pwdInput = modalEl.querySelector('#input-teacher-del-pwd');
    const pwdToggleBtn = modalEl.querySelector('#btn-toggle-del-pwd');
    const errEl = modalEl.querySelector('#teacher-del-pwd-error');
    const cancelBtn = modalEl.querySelector('#btn-cancel-teacher-del');
    const confirmBtn = modalEl.querySelector('#btn-confirm-teacher-del');

    setTimeout(() => pwdInput?.focus(), 100);

    let isShowingPassword = false;
    pwdToggleBtn?.addEventListener('click', () => {
      isShowingPassword = !isShowingPassword;
      if (pwdInput) {
        pwdInput.type = isShowingPassword ? 'text' : 'password';
      }
      if (pwdToggleBtn) {
        pwdToggleBtn.innerHTML = isShowingPassword ? getIcon('eyeOff', 'w-4 h-4') : getIcon('eye', 'w-4 h-4');
      }
    });

    const showError = (msg) => {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      pwdInput?.classList.add('border-destructive', 'focus:ring-destructive');
      pwdInput?.focus();
    };

    const clearError = () => {
      if (!errEl) return;
      errEl.textContent = '';
      errEl.classList.add('hidden');
      pwdInput?.classList.remove('border-destructive');
    };

    pwdInput?.addEventListener('input', clearError);

    const handleConfirm = async () => {
      clearError();
      const enteredPwd = (pwdInput?.value || '').trim();
      if (!enteredPwd) {
        showError(isKm ? 'សូមបញ្ចូលពាក្យសម្ងាត់របស់អ្នក' : 'Please enter your password');
        return;
      }

      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<div class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> <span>${isKm ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Verifying...'}</span>`;
      }

      try {
        const isValid = await authService.verifyCurrentPassword(enteredPwd);
        if (!isValid) {
          showError(isKm ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ សូមព្យាយាមម្តងទៀត' : 'Incorrect password. Please try again.');
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `${getIcon('trash', 'w-3.5 h-3.5')} <span>${isKm ? 'លុបទិន្នន័យសិស្សទាំងអស់' : 'Delete All Students'}</span>`;
          }
          return;
        }

        // Proceed to clear student data
        if (confirmBtn) {
          confirmBtn.innerHTML = `<div class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> <span>${isKm ? 'កំពុងលុបទិន្នន័យ...' : 'Deleting...'}</span>`;
        }
        await StudentService.clearAllStudentData();

        modal.forceClose();
        toast.success(
          isKm ? 'បានលុបទិន្នន័យសិស្សទាំងអស់ដោយជោគជ័យ' : 'All student records have been deleted successfully',
          isKm ? 'ជោគជ័យ' : 'Success'
        );
      } catch (err) {
        showError(err.message || (isKm ? 'ការផ្ទៀងផ្ទាត់បរាជ័យ' : 'Verification failed'));
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `${getIcon('trash', 'w-3.5 h-3.5')} <span>${isKm ? 'លុបទិន្នន័យសិស្សទាំងអស់' : 'Delete All Students'}</span>`;
        }
      }
    };

    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', () => modal.close());

    pwdInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    });
  }
}
