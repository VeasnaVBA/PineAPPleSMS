/**
 * System Settings & Disaster Recovery Module (Sections 21, 22, 23, 28)
 * Manages Themes, Languages, Academic Years, Full JSON Backup & Safe Restore,
 * Automatic Backup Reminders, Storage Diagnostics, and Danger Zone.
 */
import { t, i18n } from '../i18n/i18n.js';
import { themeService, PRESET_PRIMARY_COLORS } from '../services/themeService.js';
import { fontService, ENGLISH_FONTS, KHMER_FONTS, FONT_SIZES } from '../services/fontService.js';
import { authService } from '../services/authService.js';
import { SettingsService } from '../services/settingsService.js';
import { BackupService } from '../services/backupService.js';
import { SyncService } from '../services/syncService.js';
import { Modal } from '../components/modal.js';
import { ThemeColorModal } from '../components/themeColorModal.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { CloudSyncService } from '../services/cloudSyncService.js';
import { AdminDataService } from '../services/adminDataService.js';
import { db } from '../database/db.js';
import { getCloudSyncUrl, setCloudSyncUrl, getWorkspaceSpreadsheetName, GOOGLE_APPS_SCRIPT_BACKEND_CODE, ADMIN_SPREADSHEET_NAME } from '../config/cloudSync.js';

export const SettingsPage = {
  async render(container) {
    this.container = container;
    const currentUser = authService.getCurrentUser();
    const currentTheme = themeService.getTheme();
    const currentColor = themeService.getPrimaryColor() ? themeService.getPrimaryColor().toLowerCase() : null;
    const currentLocale = i18n.getLocale();
    const currentEnFont = fontService.getEnglishFont();
    const currentKmFont = fontService.getKhmerFont();
    const currentFontSize = fontService.getFontSize();
    const dbInfo = await SettingsService.getDatabaseInfo();
    const academicYears = await SettingsService.getAcademicYears();
    const activeYear = await SettingsService.getActiveAcademicYear();
    const autoBackup = BackupService.getAutoBackupInterval();

    container.innerHTML = `
      <div class="space-y-6 max-w-4xl animate-fade-in pb-16 select-none">
        <!-- Header -->
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">${t('settings.title')}</h1>
          <p class="text-sm text-muted-foreground mt-1">${t('settings.subtitle')}</p>
        </div>

        <!-- User Accounts & Security Card (Admin Only) -->
        ${authService.isAdmin() ? `
          <div class="p-6 rounded-xl border border-primary/25 bg-primary/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <div class="p-3 rounded-xl bg-primary text-primary-foreground shadow-sm">
                ${getIcon('users', 'w-6 h-6')}
              </div>
              <div>
                <h3 class="text-base font-semibold text-foreground">${currentLocale === 'km' ? 'គ្រប់គ្រងគណនី និងសិទ្ធិអ្នកប្រើប្រាស់' : 'User Accounts & Security'}</h3>
                <p class="text-xs text-muted-foreground mt-0.5">${currentLocale === 'km' ? 'បង្កើត គ្រប់គ្រងគណនី Director, Teacher និងបែងចែកបន្ទប់រៀន' : 'Create & manage Admin, Director, and Teacher accounts and classroom assignments'}</p>
              </div>
            </div>
            <a href="#users" class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm shadow-sm transition-all whitespace-nowrap">
              <span>${currentLocale === 'km' ? 'ចូលទៅគ្រប់គ្រងគណនី' : 'Manage User Accounts'}</span>
              ${getIcon('arrowRight', 'w-4 h-4')}
            </a>
          </div>
        ` : ''}

        <!-- 1. Appearance / Theme Section -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-5">
          <div>
            <h3 class="text-base font-semibold text-foreground tracking-tight">${t('settings.appearance')}</h3>
            <p class="text-xs text-muted-foreground">${t('settings.appearanceDesc')}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <!-- Light -->
            <button data-theme-choice="light" class="theme-choice-btn flex items-center justify-between p-4 rounded-lg border text-left transition-all ${currentTheme === 'light' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  ${getIcon('sun', 'w-5 h-5')}
                </div>
                <div>
                  <p class="text-sm font-medium text-foreground">${t('settings.themeLight')}</p>
                  <p class="text-xs text-muted-foreground">Standard day theme</p>
                </div>
              </div>
              <span class="check-icon ${currentTheme === 'light' ? 'text-primary' : 'hidden'}">${getIcon('check', 'w-4 h-4')}</span>
            </button>

            <!-- Dark -->
            <button data-theme-choice="dark" class="theme-choice-btn flex items-center justify-between p-4 rounded-lg border text-left transition-all ${currentTheme === 'dark' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  ${getIcon('moon', 'w-5 h-5')}
                </div>
                <div>
                  <p class="text-sm font-medium text-foreground">${t('settings.themeDark')}</p>
                  <p class="text-xs text-muted-foreground">Obsidian night theme</p>
                </div>
              </div>
              <span class="check-icon ${currentTheme === 'dark' ? 'text-primary' : 'hidden'}">${getIcon('check', 'w-4 h-4')}</span>
            </button>

            <!-- System -->
            <button data-theme-choice="system" class="theme-choice-btn flex items-center justify-between p-4 rounded-lg border text-left transition-all ${currentTheme === 'system' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  ${getIcon('laptop', 'w-5 h-5')}
                </div>
                <div>
                  <p class="text-sm font-medium text-foreground">${t('settings.themeSystem')}</p>
                  <p class="text-xs text-muted-foreground">OS synchronized</p>
                </div>
              </div>
              <span class="check-icon ${currentTheme === 'system' ? 'text-primary' : 'hidden'}">${getIcon('check', 'w-4 h-4')}</span>
            </button>
          </div>

          <!-- Primary Theme Color Customizer -->
          <div class="pt-4 border-t border-border/60 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-semibold text-foreground tracking-tight">${t('theme.colorTitle')}</h4>
                <p class="text-[11px] text-muted-foreground">${t('theme.colorSubtitle')}</p>
              </div>
              <button id="btn-open-theme-color-modal" type="button" class="btn-primary px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer">
                ${getIcon('palette', 'w-3.5 h-3.5')}
                <span>${t('theme.openPicker')}</span>
              </button>
            </div>
            
            <div class="flex items-center gap-2 flex-wrap pt-1">
              ${PRESET_PRIMARY_COLORS.map(c => {
                const isSelected = (!currentColor && c.id === 'default') || (currentColor === c.hex.toLowerCase());
                return `
                  <button type="button"
                          class="settings-color-swatch w-9 h-9 rounded-lg flex items-center justify-center transition-all shadow-xs cursor-pointer border ${isSelected ? 'ring-2 ring-offset-2 ring-primary ring-offset-background scale-105 border-foreground' : 'border-border/60 hover:scale-105'}"
                          data-hex="${c.hex}"
                          title="${currentLocale === 'km' ? c.nameKm : c.name}"
                          style="background-color: ${c.hex};">
                    ${isSelected ? `<span class="text-white drop-shadow-md">${getIcon('check', 'w-3.5 h-3.5')}</span>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Typography / Font Settings Card -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
                ${getIcon('type', 'w-5 h-5')}
              </div>
              <div>
                <h3 class="text-base font-semibold text-foreground tracking-tight">${t('settings.typography')}</h3>
                <p class="text-xs text-muted-foreground">${t('settings.typographyDesc')}</p>
              </div>
            </div>
            <span class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
              Offline-ready
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <!-- English Font Selector -->
            <div class="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              <div>
                <label for="select-font-en" class="block text-xs font-semibold text-foreground">${t('settings.englishFont')}</label>
                <p class="text-[11px] text-muted-foreground mt-0.5">${t('settings.englishFontDesc')}</p>
              </div>
              <select id="select-font-en" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-none transition-colors box-border shadow-xs">
                ${Object.keys(ENGLISH_FONTS).map(key => `
                  <option value="${key}" ${currentEnFont === key ? 'selected' : ''}>${ENGLISH_FONTS[key].label} ${key === 'Inter' ? '(Default)' : ''}</option>
                `).join('')}
              </select>
              <!-- Live Preview English -->
              <div class="p-3 rounded-md bg-background border border-border/80 space-y-1">
                <span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">${t('settings.previewEn')}</span>
                <p id="preview-font-en" class="text-sm text-foreground leading-relaxed truncate" style="font-family: ${fontService.getEnglishStack(currentEnFont)};">
                  The quick brown fox jumps over the lazy dog. 0123456789
                </p>
              </div>
            </div>

            <!-- Khmer Font Selector -->
            <div class="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              <div>
                <label for="select-font-km" class="block text-xs font-semibold text-foreground">${t('settings.khmerFont')}</label>
                <p class="text-[11px] text-muted-foreground mt-0.5">${t('settings.khmerFontDesc')}</p>
              </div>
              <select id="select-font-km" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-none transition-colors box-border shadow-xs">
                ${Object.keys(KHMER_FONTS).map(key => `
                  <option value="${key}" ${currentKmFont === key ? 'selected' : ''}>${KHMER_FONTS[key].label} ${key === 'Kantumruy Pro' ? '(Default)' : ''}</option>
                `).join('')}
              </select>
              <!-- Live Preview Khmer -->
              <div class="p-3 rounded-md bg-background border border-border/80 space-y-1">
                <span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">${t('settings.previewKm')}</span>
                <p id="preview-font-km" class="text-sm text-foreground leading-relaxed truncate" style="font-family: ${fontService.getKhmerStack(currentKmFont)};">
                  ប្រព័ន្ធគ្រប់គ្រងសាលារៀន ស្មាតស្គូល ២០២៤–២០២៥ (០១២៣៤៥៦៧៨៩)
                </p>
              </div>
            </div>
          </div>

          <!-- Global Font Size / Root Scaling Section -->
          <div class="pt-3 border-t border-border space-y-3">
            <div>
              <div class="flex items-center justify-between">
                <label class="block text-xs font-semibold text-foreground">${t('settings.fontSize')}</label>
                <span id="font-size-badge" class="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-primary/10 text-primary border border-primary/20">
                  ${FONT_SIZES[currentFontSize]?.size || '16px'} (${FONT_SIZES[currentFontSize]?.percent || '100%'})
                </span>
              </div>
              <p class="text-[11px] text-muted-foreground mt-0.5">${t('settings.fontSizeDesc')}</p>
            </div>

            <!-- Segmented Font Size Radio/Buttons matching shadcn/ui -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              ${Object.keys(FONT_SIZES).map(key => {
                const opt = FONT_SIZES[key];
                const isSelected = currentFontSize === key;
                return `
                  <button type="button"
                    data-font-size-choice="${key}"
                    class="font-size-choice-btn flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary text-primary font-semibold'
                        : 'border-border hover:bg-muted/50 text-foreground'
                    }">
                    <span class="text-xs ${isSelected ? 'font-bold' : 'font-medium'}">
                      ${currentLocale === 'km' ? opt.labelKm : opt.labelEn}
                    </span>
                    <span class="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      ${opt.size} (${opt.percent})
                    </span>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Real-time Live Scaled Preview Box -->
            <div class="p-4 rounded-lg bg-background border border-border/80 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  ${currentLocale === 'km' ? 'គំរូអក្សរផ្ទាល់ពេលផ្លាស់ប្តូរទំហំ (Live Preview)' : 'Live Typography Scaling Preview'}
                </span>
                <span class="text-[10px] text-muted-foreground font-mono" id="preview-current-scale-label">
                  Root: ${FONT_SIZES[currentFontSize]?.size || '16px'}
                </span>
              </div>
              <div id="font-size-live-preview" class="space-y-1.5 transition-all duration-150">
                <p id="live-preview-en" class="text-foreground leading-normal font-sans" style="font-size: ${FONT_SIZES[currentFontSize]?.size || '16px'}; font-family: ${fontService.getEnglishStack(currentEnFont)};">
                  ${t('settings.fontSizePreviewEn')}
                </p>
                <p id="live-preview-km" class="text-foreground leading-relaxed font-khmer" style="font-size: ${FONT_SIZES[currentFontSize]?.size || '16px'}; font-family: ${fontService.getKhmerStack(currentKmFont)};">
                  ${t('settings.fontSizePreviewKm')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Language Selection -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div>
            <h3 class="text-base font-semibold text-foreground tracking-tight">${t('settings.languageTitle')}</h3>
            <p class="text-xs text-muted-foreground">${t('settings.languageDesc')}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <!-- Khmer -->
            <button data-lang-choice="km" class="lang-choice-btn flex items-center justify-between p-4 rounded-lg border text-left transition-all ${currentLocale === 'km' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  ខ្មែរ
                </div>
                <div>
                  <p class="text-sm font-semibold font-khmer text-foreground">ភាសាខ្មែរ (Khmer)</p>
                  <p class="text-xs text-muted-foreground">Local national language</p>
                </div>
              </div>
              <span class="check-icon ${currentLocale === 'km' ? 'text-primary' : 'hidden'}">${getIcon('check', 'w-4 h-4')}</span>
            </button>

            <!-- English -->
            <button data-lang-choice="en" class="lang-choice-btn flex items-center justify-between p-4 rounded-lg border text-left transition-all ${currentLocale === 'en' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  EN
                </div>
                <div>
                  <p class="text-sm font-semibold text-foreground">English</p>
                  <p class="text-xs text-muted-foreground">International format</p>
                </div>
              </div>
              <span class="check-icon ${currentLocale === 'en' ? 'text-primary' : 'hidden'}">${getIcon('check', 'w-4 h-4')}</span>
            </button>
          </div>
        </div>

        <!-- 3. Academic Year Management -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-foreground tracking-tight">${t('settings.academicYearTitle')}</h3>
              <p class="text-xs text-muted-foreground">${t('settings.academicYearDesc')}</p>
            </div>
            <button id="btn-add-ay" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors self-start sm:self-auto">
              ${getIcon('plus', 'w-3.5 h-3.5')}
              <span>${t('settings.addAcademicYear')}</span>
            </button>
          </div>

          <div class="space-y-2 pt-1">
            ${academicYears.map(ay => {
              const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
              const isActive = (ay.isActive === true) || (normDash(ay.name) === normDash(activeYear)) || (ay.id === activeYear);
              const canDelete = academicYears.length > 1;

              return `
                <div class="p-3.5 rounded-lg border border-border flex items-center justify-between ${isActive ? 'bg-primary/5 border-primary/40' : 'bg-card'}">
                  <div class="flex items-center gap-3">
                    <span class="text-primary">${getIcon('calendar', 'w-4 h-4')}</span>
                    <div>
                      <p class="text-sm font-bold text-foreground font-mono">${ay.name}</p>
                      <span class="text-[11px] text-muted-foreground">${ay.startDate ? `${ay.startDate} to ${ay.endDate}` : 'Full Session'}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    ${isActive ? `
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ${currentLocale === 'km' ? 'សកម្ម' : 'Active'}
                      </span>
                    ` : `
                      <button type="button" class="btn-set-active-ay px-3 py-1 rounded text-xs font-medium border border-border hover:bg-muted text-foreground transition-colors cursor-pointer" data-id="${ay.id || ''}" data-year="${ay.name}">
                        ${currentLocale === 'km' ? 'កំណត់ជាសកម្ម' : 'Set Active'}
                      </button>
                    `}
                    ${canDelete ? `
                      <button type="button" class="btn-delete-ay p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" data-id="${ay.id || ay.name}" data-name="${ay.name}" title="${t('settings.removeAcademicYear')}">
                        ${getIcon('trash', 'w-4 h-4')}
                      </button>
                    ` : `
                      <button type="button" class="p-1.5 rounded-md text-muted-foreground/30 cursor-not-allowed" disabled title="${currentLocale === 'km' ? 'ត្រូវមានឆ្នាំសិក្សាយ៉ាងហោចណាស់ ១ ក្នុងប្រព័ន្ធ' : 'At least one academic year must remain in the system'}">
                        ${getIcon('trash', 'w-4 h-4')}
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Offline Data Synchronization & Distribution Hub -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-md bg-primary/10 text-primary">
                  ${getIcon('rotateCw', 'w-4 h-4')}
                </div>
                <h3 class="text-base font-semibold text-foreground tracking-tight">${t('sync.title')}</h3>
              </div>
              <p class="text-xs text-muted-foreground mt-1">${t('sync.subtitle')}</p>
            </div>
            <button id="btn-settings-open-sync" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-colors self-start sm:self-auto cursor-pointer">
              ${getIcon('rotateCw', 'w-3.5 h-3.5')}
              <span>${t('sync.btnLabel')}</span>
            </button>
          </div>

          <div class="p-4 rounded-lg bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-foreground">${currentLocale === 'km' ? 'តួនាទីបច្ចុប្បន្ន' : 'Current Role'}:</span>
                <span class="px-2 py-0.5 rounded-full font-semibold ${currentUser?.role === 'ADMIN' ? 'bg-destructive/10 text-destructive border border-destructive/20' : currentUser?.role === 'DIRECTOR' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'}">${currentUser?.role || 'Guest'}</span>
              </div>
              ${currentUser?.role === 'TEACHER' ? `
                <p class="text-muted-foreground">${t('sync.assignedClass')}: <span class="font-bold text-foreground">${currentUser.classId || currentUser.assignedClassId || 'Not Assigned'}</span></p>
              ` : ''}
              ${currentUser?.role === 'DIRECTOR' ? `
                <p class="text-muted-foreground">${currentLocale === 'km' ? 'ស្ថានីយ៍មេគ្រប់គ្រងសាលារៀន (Director Master Node)' : 'Director Master School Node'}</p>
              ` : ''}
              ${currentUser?.role === 'ADMIN' ? `
                <p class="text-muted-foreground">${currentLocale === 'km' ? 'បង្កើតកញ្ចប់ទិន្នន័យ (.schoolpkg) តាមរយៈទំព័រ គ្រប់គ្រងគណនី (Users)' : 'Generate config packages via the User Accounts management tab'}</p>
              ` : ''}
            </div>

            ${currentUser?.role === 'TEACHER' && (currentUser.classId || currentUser.assignedClassId) ? `
              <button id="btn-settings-export-return" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent text-foreground font-medium text-xs shadow-xs transition-colors cursor-pointer">
                ${getIcon('download', 'w-3.5 h-3.5 text-primary')}
                <span>${t('sync.exportReturnPkg')}</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Admin Central Data Sheet (Master Cloud Sync for Settings, Accounts, Passwords & Roles) -->
        <div class="p-6 rounded-xl border border-primary/30 bg-primary/5 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-md bg-primary text-primary-foreground shadow-xs">
                  ${getIcon('fileSpreadsheet', 'w-4 h-4')}
                </div>
                <h3 class="text-base font-semibold text-foreground tracking-tight">${t('cloudSync.adminDataTitle')}</h3>
              </div>
              <p class="text-xs text-muted-foreground mt-1">${t('cloudSync.adminDataDesc')}</p>
            </div>

            <div class="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              ${AdminDataService.getSpreadsheetUrl() ? `
                <a href="${AdminDataService.getSpreadsheetUrl()}" target="_blank" rel="noopener noreferrer" 
                   class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold shadow-xs transition-colors cursor-pointer">
                  ${getIcon('fileSpreadsheet', 'w-3.5 h-3.5')}
                  <span>${t('cloudSync.openAdminSheet')}</span>
                </a>
              ` : ''}
            </div>
          </div>

          <div class="p-4 rounded-lg bg-card/80 border border-border/80 space-y-3.5 text-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground font-medium">${t('cloudSync.adminTargetSpreadsheet')}:</span>
                <span class="font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">${ADMIN_SPREADSHEET_NAME}</span>
              </div>
              <div class="text-[11px] text-muted-foreground">
                <span>${t('cloudSync.lastSynced')}: </span>
                <span class="font-medium text-foreground font-mono">${AdminDataService.getLastSyncTimestamp() ? new Date(AdminDataService.getLastSyncTimestamp()).toLocaleString() : (currentLocale === 'km' ? 'មិនទាន់ Sync' : 'Never')}</span>
              </div>
            </div>

            <!-- Action buttons for Admin Sheet Sync -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p class="text-[11px] text-muted-foreground leading-relaxed">
                ${currentLocale === 'km' 
                  ? 'ធ្វើសមកាលកម្មការកំណត់ទាំងអស់ (URL, Theme, Font Size, Color) និងគណនីទាំងអស់ (Admin, Director, Teachers, Passwords, Roles) ជាមួយ Google Drive ភ្លាមៗ។'
                  : 'Sync all admin preferences (URL, theme, font size, colors) and all user accounts (Admin, Director, Teachers, passwords, roles) with Google Drive immediately.'}
              </p>

              <div class="flex items-center gap-2 shrink-0">
                <button 
                  id="btn-settings-save-admin-data" 
                  type="button" 
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap">
                  <span class="btn-save-admin-icon flex items-center">${getIcon('cloudUpload', 'w-3.5 h-3.5')}</span>
                  <span class="btn-save-admin-label">${t('cloudSync.saveAdminToSheet')}</span>
                </button>

                <button 
                  id="btn-settings-pull-admin-data" 
                  type="button" 
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap">
                  <span class="btn-pull-admin-icon flex items-center">${getIcon('cloudDownload', 'w-3.5 h-3.5 text-primary')}</span>
                  <span class="btn-pull-admin-label">${t('cloudSync.pullAdminFromSheet')}</span>
                </button>
              </div>
            </div>

            <div id="settings-admin-cloud-feedback" class="hidden p-2.5 rounded-md text-xs"></div>
          </div>
        </div>

        <!-- Google Drive & Google Sheets User Workspace Cloud Sync Settings -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  ${getIcon('cloudUpload', 'w-4 h-4')}
                </div>
                <h3 class="text-base font-semibold text-foreground tracking-tight">${currentLocale === 'km' ? 'ការធ្វើសមកាលកម្ម Google Drive & Google Sheets' : 'Google Drive & Google Sheets Cloud Sync'}</h3>
              </div>
              <p class="text-xs text-muted-foreground mt-1">${currentLocale === 'km' ? 'ភ្ជាប់ទៅកាន់ Google Apps Script Web App ដើម្បីទាញ និងបញ្ជូនទិន្នន័យពី/ទៅ Google Sheets' : 'Connect to Google Apps Script Web App to push and pull data to/from Google Sheets'}</p>
            </div>

            <button id="btn-settings-view-script" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors shadow-xs cursor-pointer self-start sm:self-auto">
              ${getIcon('fileSpreadsheet', 'w-3.5 h-3.5 text-primary')}
              <span>${currentLocale === 'km' ? 'កូដ Apps Script' : 'Apps Script Code'}</span>
            </button>
          </div>

          <div class="p-4 rounded-lg bg-muted/40 border border-border/70 space-y-3 text-xs">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="text-muted-foreground font-medium">${currentLocale === 'km' ? 'ឯកសារ Google Sheets ក្នុង Drive' : 'Google Drive Spreadsheet'}:</span>
              <span class="font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">${getWorkspaceSpreadsheetName(currentUser?.username)}</span>
            </div>

            <div class="space-y-1.5">
              <label for="settings-cloud-url" class="block font-medium text-foreground">
                ${t('cloudSync.endpointUrl')}
              </label>
              <div class="flex flex-col sm:flex-row gap-2">
                <input 
                  id="settings-cloud-url" 
                  type="url" 
                  value="${getCloudSyncUrl()}"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  class="flex-1 px-3 py-2 rounded-md border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div class="flex gap-2">
                  <button id="btn-settings-save-cloud-url" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap">
                    ${getIcon('save', 'w-3.5 h-3.5')}
                    <span>${t('cloudSync.saveConfig')}</span>
                  </button>
                  <button id="btn-settings-test-cloud-url" type="button" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-medium shadow-xs transition-colors cursor-pointer whitespace-nowrap">
                    ${getIcon('rotateCw', 'w-3.5 h-3.5')}
                    <span id="btn-settings-test-text">${t('cloudSync.testConnection')}</span>
                  </button>
                </div>
              </div>
              <p class="text-[11px] text-muted-foreground">${currentLocale === 'km' ? 'បញ្ចូល URL នៃ Web App ដែលបាន Deploy ជា "Execute as: Me" និង "Who has access: Anyone"' : 'Enter Web App URL deployed as "Execute as: Me" and "Who has access: Anyone"'}</p>
            </div>

            <!-- Manual Cloud Actions (Save to Drive & Restore from Drive) -->
            <div class="pt-3 border-t border-border/70 space-y-3">
              <!-- Save to Google Drive Row -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p class="font-semibold text-foreground text-xs">${t('cloudSync.saveToDrive')}</p>
                  <p class="text-[11px] text-muted-foreground mt-0.5">${t('cloudSync.saveToDriveTooltip')}</p>
                </div>
                <button 
                  id="btn-settings-save-to-drive" 
                  type="button" 
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap">
                  <span class="btn-save-icon flex items-center">${getIcon('cloudUpload', 'w-4 h-4 text-primary')}</span>
                  <span class="btn-save-label">${t('cloudSync.saveToDrive')}</span>
                </button>
              </div>

              <!-- Restore from Google Drive Row -->
              <div class="pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p class="font-semibold text-foreground text-xs">${t('cloudSync.restoreFromDrive')}</p>
                  <p class="text-[11px] text-muted-foreground mt-0.5">${t('cloudSync.restoreFromDriveTooltip')}</p>
                </div>
                <button 
                  id="btn-settings-restore-from-drive" 
                  type="button" 
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap">
                  <span class="btn-restore-icon flex items-center">${getIcon('cloudDownload', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}</span>
                  <span class="btn-restore-label">${t('cloudSync.restoreFromDrive')}</span>
                </button>
              </div>
            </div>

            <div id="settings-cloud-feedback" class="hidden p-2.5 rounded-md text-xs"></div>
          </div>
        </div>

        <!-- 4. JSON Backup & Disaster Recovery (Sections 21, 22, 23) -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-5">
          <div>
            <h3 class="text-base font-semibold text-foreground tracking-tight">${t('settings.backupTitle')}</h3>
            <p class="text-xs text-muted-foreground mt-0.5">${t('settings.backupDesc')}</p>
          </div>

          <!-- Backup & Restore Buttons -->
          <div class="flex items-center gap-3 flex-wrap pt-1">
            <button id="btn-export-full-db" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
              ${getIcon('download', 'w-4 h-4')}
              <span>${t('settings.exportFullDb')}</span>
            </button>

            <button id="btn-trigger-restore" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/70 text-xs sm:text-sm font-medium transition-colors">
              ${getIcon('upload', 'w-4 h-4')}
              <span>${t('settings.restoreDb')}</span>
            </button>
            <input type="file" id="restore-file-input" accept=".json" class="hidden" />
          </div>

          <!-- Automatic Backup Reminder Selector -->
          <div class="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold text-foreground">${t('settings.autoBackupTitle')}</p>
              <p class="text-[11px] text-muted-foreground">${t('settings.autoBackupDesc')}</p>
            </div>
            <select id="select-auto-backup" class="h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-card text-xs text-foreground focus:ring-1 focus:ring-ring box-border shadow-xs">
              <option value="off" ${autoBackup === 'off' ? 'selected' : ''}>${t('settings.autoBackupOff')}</option>
              <option value="daily" ${autoBackup === 'daily' ? 'selected' : ''}>${t('settings.autoBackupDaily')}</option>
              <option value="weekly" ${autoBackup === 'weekly' ? 'selected' : ''}>${t('settings.autoBackupWeekly')}</option>
            </select>
          </div>
        </div>

        <!-- 5. Database Diagnostics & Danger Zone (Section 28) -->
        <div class="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-foreground tracking-tight">${t('settings.databaseInfo')}</h3>
              <p class="text-xs text-muted-foreground">${t('settings.databaseInfoDesc')}</p>
            </div>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              IndexedDB Storage
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div class="p-3 rounded-lg bg-muted/40 border border-border/60">
              <span class="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">${t('settings.studentsCount')}</span>
              <p class="text-xl font-bold text-foreground mt-1">${dbInfo.counts.students}</p>
            </div>
            <div class="p-3 rounded-lg bg-muted/40 border border-border/60">
              <span class="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">${t('settings.teachersCount')}</span>
              <p class="text-xl font-bold text-foreground mt-1">${dbInfo.counts.teachers}</p>
            </div>
            <div class="p-3 rounded-lg bg-muted/40 border border-border/60">
              <span class="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">${t('settings.classesCount')}</span>
              <p class="text-xl font-bold text-foreground mt-1">${dbInfo.counts.classes}</p>
            </div>
            <div class="p-3 rounded-lg bg-muted/40 border border-border/60">
              <span class="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">Attendance Logs</span>
              <p class="text-xl font-bold text-foreground mt-1">${dbInfo.counts.attendance}</p>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="mt-6 pt-5 border-t border-destructive/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-destructive/5 p-4 rounded-lg border border-destructive/20">
            <div>
              <h4 class="text-xs font-bold text-destructive uppercase tracking-wider">${t('settings.dangerZone')}</h4>
              <p class="text-xs text-muted-foreground mt-0.5">${t('settings.dangerZoneDesc')}</p>
            </div>
            <button id="btn-clear-db" class="px-3.5 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold shadow hover:bg-destructive/90 transition-colors self-start sm:self-auto">
              ${t('settings.clearDbBtn')}
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    const currentLocale = i18n.getLocale();

    // Theme choices
    container.querySelectorAll('.theme-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme-choice');
        themeService.setTheme(theme);
        AdminDataService.queueAutoSync();
        this.render(container);
        toast.success(`Theme updated to ${theme}`);
      });
    });

    // Theme Color Swatches & Modal Trigger inside Settings
    container.querySelector('#btn-open-theme-color-modal')?.addEventListener('click', () => {
      ThemeColorModal.open();
    });

    container.querySelectorAll('.settings-color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-hex');
        themeService.setPrimaryColor(hex);
        AdminDataService.queueAutoSync();
        this.render(container);
        toast.success(currentLocale === 'km' ? 'បានផ្លាស់ប្តូរពណ៌ចម្បងដោយជោគជ័យ' : 'Theme color updated');
      });
    });

    // Language choices
    container.querySelectorAll('.lang-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang-choice');
        i18n.setLocale(lang);
        AdminDataService.queueAutoSync();
        this.render(container);
        toast.success(lang === 'km' ? 'ភាសាត្រូវបានផ្លាស់ប្តូរទៅ ភាសាខ្មែរ' : 'Language changed to English');
      });
    });

    // English Font selector
    const selectFontEn = container.querySelector('#select-font-en');
    const previewFontEn = container.querySelector('#preview-font-en');
    selectFontEn?.addEventListener('change', (e) => {
      const selected = e.target.value;
      fontService.setEnglishFont(selected);
      AdminDataService.queueAutoSync();
      if (previewFontEn) {
        previewFontEn.style.fontFamily = fontService.getEnglishStack(selected);
      }
      toast.success(t('settings.fontSavedSuccess'));
    });

    // Khmer Font selector
    const selectFontKm = container.querySelector('#select-font-km');
    const previewFontKm = container.querySelector('#preview-font-km');
    const livePreviewKm = container.querySelector('#live-preview-km');
    const livePreviewEn = container.querySelector('#live-preview-en');
    selectFontKm?.addEventListener('change', (e) => {
      const selected = e.target.value;
      fontService.setKhmerFont(selected);
      AdminDataService.queueAutoSync();
      if (previewFontKm) {
        previewFontKm.style.fontFamily = fontService.getKhmerStack(selected);
      }
      if (livePreviewKm) {
        livePreviewKm.style.fontFamily = fontService.getKhmerStack(selected);
      }
      toast.success(t('settings.fontSavedSuccess'));
    });

    selectFontEn?.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (livePreviewEn) {
        livePreviewEn.style.fontFamily = fontService.getEnglishStack(selected);
      }
    });

    // Font Size selector choices
    container.querySelectorAll('.font-size-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sizeKey = btn.getAttribute('data-font-size-choice');
        if (!FONT_SIZES[sizeKey]) return;

        fontService.setFontSize(sizeKey);
        AdminDataService.queueAutoSync();

        // Update active button styles
        container.querySelectorAll('.font-size-choice-btn').forEach(b => {
          const isCurrent = b.getAttribute('data-font-size-choice') === sizeKey;
          if (isCurrent) {
            b.className = 'font-size-choice-btn flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all border-primary bg-primary/5 ring-1 ring-primary text-primary font-semibold';
            const spanTitle = b.querySelector('span:first-child');
            if (spanTitle) spanTitle.className = 'text-xs font-bold';
          } else {
            b.className = 'font-size-choice-btn flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all border-border hover:bg-muted/50 text-foreground';
            const spanTitle = b.querySelector('span:first-child');
            if (spanTitle) spanTitle.className = 'text-xs font-medium';
          }
        });

        // Update badge and preview text
        const badge = container.querySelector('#font-size-badge');
        if (badge) {
          badge.textContent = `${FONT_SIZES[sizeKey].size} (${FONT_SIZES[sizeKey].percent})`;
        }

        const scaleLabel = container.querySelector('#preview-current-scale-label');
        if (scaleLabel) {
          scaleLabel.textContent = `Root: ${FONT_SIZES[sizeKey].size}`;
        }

        if (livePreviewEn) {
          livePreviewEn.style.fontSize = FONT_SIZES[sizeKey].size;
        }
        if (livePreviewKm) {
          livePreviewKm.style.fontSize = FONT_SIZES[sizeKey].size;
        }

        toast.success(`${t('settings.fontSizeSavedSuccess')} (${FONT_SIZES[sizeKey].size})`);
      });
    });

    // Set Active Academic Year
    container.querySelectorAll('.btn-set-active-ay').forEach(btn => {
      btn.addEventListener('click', async () => {
        const year = btn.getAttribute('data-year') || btn.getAttribute('data-id');
        if (!year) return;
        try {
          await SettingsService.setActiveAcademicYear(year);
          AdminDataService.queueAutoSync();
          toast.success(currentLocale === 'km' ? `បានកំណត់ឆ្នាំសិក្សា ${year} ជាឆ្នាំសកម្ម` : `Active academic year set to ${year}`);
          window.dispatchEvent(new CustomEvent('app:refresh-data'));
          await this.render(container);
        } catch (err) {
          toast.error(err.message);
        }
      });
    });

    // Delete Academic Year
    container.querySelectorAll('.btn-delete-ay').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (!id && !name) return;

        const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
        let studentCount = 0;
        try {
          const allStudents = await db.getAll('students');
          studentCount = (allStudents || []).filter(s => s.academicYear && normDash(s.academicYear) === normDash(name)).length;
        } catch {
          studentCount = 0;
        }

        const modal = Modal.open({
          title: t('settings.removeAcademicYear'),
          content: `
            <div class="space-y-3.5 text-xs">
              <p class="text-foreground leading-relaxed text-sm">
                ${t('settings.deleteYearConfirm').replace('{year}', name || id)}
              </p>
              
              <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-2 text-xs leading-relaxed">
                <div class="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                  ${getIcon('alertTriangle', 'w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0')}
                  <span>${currentLocale === 'km' ? 'ការជូនដំណឹងអំពីទិន្នន័យសិស្ស' : 'Student Records Notice'}</span>
                </div>
                <p class="text-xs leading-relaxed">
                  ${currentLocale === 'km' 
                    ? (studentCount > 0 
                        ? `🛡️ <strong>ទិន្នន័យសិស្សនឹងមិនត្រូវបានលុបឡើយ</strong>។ បច្ចុប្បន្នមានសិស្សចំនួន <strong>${studentCount} នាក់</strong> ស្ថិតក្នុងឆ្នាំសិក្សានេះ។ សិស្សទាំងអស់នឹងនៅតែមានវត្តមានក្នុងបញ្ជីសិស្សដដែល ប៉ុន្តែពួកគេនឹងមិនមានកម្រិតឆ្នាំសិក្សានេះនៅក្នុងការកំណត់ (Settings) ទៀតទេ។`
                        : `🛡️ <strong>ទិន្នន័យសិស្សនឹងមិនត្រូវបានលុបឡើយ</strong>។ មិនមានសិស្សស្ថិតក្នុងឆ្នាំសិក្សានេះទេ។`)
                    : (studentCount > 0
                        ? `🛡️ <strong>Student records will NOT be deleted</strong>. There are currently <strong>${studentCount} student(s)</strong> set in this academic year. All student profiles, classes, and scores will remain completely safe in the database, but they will no longer have this academic year configured in Settings.`
                        : `🛡️ <strong>Student records will NOT be deleted</strong>. There are no students currently assigned to this academic year.`)}
                </p>
              </div>
            </div>
          `,
          footer: `
            <button id="btn-cancel-del-ay" class="px-3.5 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium transition-colors cursor-pointer">
              ${t('common.cancel')}
            </button>
            <button id="btn-confirm-del-ay" class="px-3.5 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold shadow-xs transition-colors cursor-pointer">
              ${t('common.delete')}
            </button>
          `,
          maxWidth: 'max-w-md'
        });

        modal.element.querySelector('#btn-cancel-del-ay')?.addEventListener('click', () => modal.close());
        modal.element.querySelector('#btn-confirm-del-ay')?.addEventListener('click', async () => {
          modal.close();
          try {
            const success = await SettingsService.deleteAcademicYear(id || name);
            if (success) {
              AdminDataService.queueAutoSync();
              toast.success(t('settings.deleteYearSuccess').replace('{year}', name || id));
              window.dispatchEvent(new CustomEvent('app:refresh-data'));
              await this.render(container);
            } else {
              toast.error(currentLocale === 'km' ? 'មិនអាចលុបឆ្នាំសិក្សាបានទេ' : 'Failed to delete academic year.');
            }
          } catch (err) {
            toast.error(err.message);
          }
        });
      });
    });

    // Add Academic Year Modal
    container.querySelector('#btn-add-ay')?.addEventListener('click', () => {
      this.openAddYearModal(container);
    });

    // Synchronization Hub Modal
    container.querySelector('#btn-settings-open-sync')?.addEventListener('click', () => {
      SyncService.openSyncModal();
    });

    // Export Teacher Return Package
    container.querySelector('#btn-settings-export-return')?.addEventListener('click', async () => {
      try {
        await SyncService.generateTeacherReturnPackage();
      } catch (err) {
        toast.error(err.message, 'Export Error');
      }
    });

    // Save Admin Central Data to Sheet
    const saveAdminBtn = container.querySelector('#btn-settings-save-admin-data');
    const adminFeedback = container.querySelector('#settings-admin-cloud-feedback');
    saveAdminBtn?.addEventListener('click', async () => {
      const iconSpan = saveAdminBtn.querySelector('.btn-save-admin-icon');
      const labelSpan = saveAdminBtn.querySelector('.btn-save-admin-label');

      saveAdminBtn.disabled = true;
      if (iconSpan) iconSpan.innerHTML = getIcon('loader2', 'w-3.5 h-3.5 animate-spin');
      if (labelSpan) labelSpan.textContent = t('cloudSync.saving');

      try {
        const res = await AdminDataService.saveToGoogleSheet({ silent: false });
        if (res.success) {
          await this.render(container);
        }
      } finally {
        saveAdminBtn.disabled = false;
        if (iconSpan) iconSpan.innerHTML = getIcon('cloudUpload', 'w-3.5 h-3.5');
        if (labelSpan) labelSpan.textContent = t('cloudSync.saveAdminToSheet');
      }
    });

    // Pull Admin Central Data from Sheet
    const pullAdminBtn = container.querySelector('#btn-settings-pull-admin-data');
    pullAdminBtn?.addEventListener('click', async () => {
      const iconSpan = pullAdminBtn.querySelector('.btn-pull-admin-icon');
      const labelSpan = pullAdminBtn.querySelector('.btn-pull-admin-label');

      pullAdminBtn.disabled = true;
      if (iconSpan) iconSpan.innerHTML = getIcon('loader2', 'w-3.5 h-3.5 text-primary animate-spin');
      if (labelSpan) labelSpan.textContent = t('cloudSync.restoring');

      try {
        const res = await AdminDataService.pullFromGoogleSheet({ silent: false });
        if (res.success) {
          await this.render(container);
        }
      } finally {
        pullAdminBtn.disabled = false;
        if (iconSpan) iconSpan.innerHTML = getIcon('cloudDownload', 'w-3.5 h-3.5 text-primary');
        if (labelSpan) labelSpan.textContent = t('cloudSync.pullAdminFromSheet');
      }
    });

    // Save Google Script Web App URL
    const cloudUrlInput = container.querySelector('#settings-cloud-url');
    const cloudFeedback = container.querySelector('#settings-cloud-feedback');
    container.querySelector('#btn-settings-save-cloud-url')?.addEventListener('click', async () => {
      const url = cloudUrlInput?.value?.trim() || '';
      setCloudSyncUrl(url);
      toast.success(currentLocale === 'km' ? 'បានរក្សាទុកអាសយដ្ឋាន Web App ដោយជោគជ័យ' : 'Google Script Web App URL saved successfully.');
      try {
        await AdminDataService.saveToGoogleSheet({ silent: true });
      } catch (e) {
        console.warn('Auto sync on URL save error:', e);
      }
    });

    // Test Google Script Web App Connection
    const testBtn = container.querySelector('#btn-settings-test-cloud-url');
    const testText = container.querySelector('#btn-settings-test-text');
    testBtn?.addEventListener('click', async () => {
      const url = cloudUrlInput?.value?.trim() || '';
      if (!url) {
        if (cloudFeedback) {
          cloudFeedback.className = 'p-2.5 rounded-md text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20';
          cloudFeedback.textContent = t('cloudSync.configRequired');
          cloudFeedback.classList.remove('hidden');
        }
        return;
      }

      testBtn.disabled = true;
      if (testText) testText.textContent = t('cloudSync.testing');
      if (cloudFeedback) {
        cloudFeedback.className = 'p-2.5 rounded-md text-xs bg-muted text-muted-foreground border border-border';
        cloudFeedback.textContent = t('cloudSync.testing');
        cloudFeedback.classList.remove('hidden');
      }

      const res = await CloudSyncService.testConnection(url);
      testBtn.disabled = false;
      if (testText) testText.textContent = t('cloudSync.testConnection');

      if (cloudFeedback) {
        if (res.success) {
          cloudFeedback.className = 'p-2.5 rounded-md text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
          cloudFeedback.textContent = res.message;
        } else {
          cloudFeedback.className = 'p-2.5 rounded-md text-xs bg-destructive/10 text-destructive border border-destructive/20';
          cloudFeedback.textContent = `${t('cloudSync.testFailed')} ${res.message}`;
        }
      }
    });

    // Save to Google Drive in Settings Page
    const saveDriveBtn = container.querySelector('#btn-settings-save-to-drive');
    saveDriveBtn?.addEventListener('click', async () => {
      const iconSpan = saveDriveBtn.querySelector('.btn-save-icon');
      const labelSpan = saveDriveBtn.querySelector('.btn-save-label');

      saveDriveBtn.disabled = true;
      if (iconSpan) iconSpan.innerHTML = getIcon('loader2', 'w-4 h-4 text-primary animate-spin');
      if (labelSpan) labelSpan.textContent = t('cloudSync.saving');

      try {
        const currentUser = authService.getCurrentUser();
        await CloudSyncService.pullToDrive(currentUser, { silent: false });
      } finally {
        saveDriveBtn.disabled = false;
        if (iconSpan) iconSpan.innerHTML = getIcon('cloudUpload', 'w-4 h-4 text-primary');
        if (labelSpan) labelSpan.textContent = t('cloudSync.saveToDrive');
      }
    });

    // Restore from Google Drive in Settings Page
    const restoreDriveBtn = container.querySelector('#btn-settings-restore-from-drive');
    restoreDriveBtn?.addEventListener('click', async () => {
      const iconSpan = restoreDriveBtn.querySelector('.btn-restore-icon');
      const labelSpan = restoreDriveBtn.querySelector('.btn-restore-label');

      restoreDriveBtn.disabled = true;
      if (iconSpan) iconSpan.innerHTML = getIcon('loader2', 'w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin');
      if (labelSpan) labelSpan.textContent = t('cloudSync.restoring');

      try {
        const currentUser = authService.getCurrentUser();
        await CloudSyncService.pushToApp(currentUser);
      } finally {
        restoreDriveBtn.disabled = false;
        if (iconSpan) iconSpan.innerHTML = getIcon('cloudDownload', 'w-4 h-4 text-emerald-600 dark:text-emerald-400');
        if (labelSpan) labelSpan.textContent = t('cloudSync.restoreFromDrive');
      }
    });

    // View Google Apps Script Backend Code Modal
    container.querySelector('#btn-settings-view-script')?.addEventListener('click', () => {
      Modal.open({
        title: currentLocale === 'km' ? 'កូដ Google Apps Script Web App' : 'Google Apps Script Backend Code',
        content: `
          <div class="space-y-3 text-xs">
            <p class="text-muted-foreground leading-relaxed">
              ${currentLocale === 'km' 
                ? 'ចម្លងកូដនេះទៅដាក់ក្នុង <strong>script.google.com</strong> &gt; <strong>Code.gs</strong> រួចចុច <strong>Deploy &gt; New deployment &gt; Web app</strong> (Execute as: Me, Who has access: Anyone)៖' 
                : 'Copy this code into your Google Apps Script project (<strong>Code.gs</strong>) and deploy as a Web App (Execute as: Me, Who has access: Anyone):'}
            </p>
            <div class="relative">
              <pre class="p-3.5 rounded-lg bg-muted border border-border text-[11px] font-mono overflow-x-auto max-h-72 select-all">${GOOGLE_APPS_SCRIPT_BACKEND_CODE.trim()}</pre>
            </div>
          </div>
        `,
        maxWidth: 'max-w-2xl',
        footer: `
          <button id="btn-copy-script" class="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors cursor-pointer">
            ${currentLocale === 'km' ? 'ចម្លងកូដ' : 'Copy Code'}
          </button>
        `
      });

      document.getElementById('btn-copy-script')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_BACKEND_CODE.trim());
          toast.success(currentLocale === 'km' ? 'បានចម្លងកូដទៅ Clipboard' : 'Script code copied to clipboard!');
        } catch (_) {
          toast.info('Please select and copy the code manually.');
        }
      });
    });

    // Export Full Database
    container.querySelector('#btn-export-full-db')?.addEventListener('click', async () => {
      try {
        toast.info('Packaging complete database snapshot...');
        const jsonString = await BackupService.exportFullDatabase();
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `SchoolManagement_Backup_${dateStr}.json`;
        BackupService.downloadJSON(jsonString, filename);
        toast.success('Database backup created and downloaded successfully.');
      } catch (err) {
        toast.error(err.message, 'Backup Error');
      }
    });

    // Trigger Restore File Input
    const fileInput = container.querySelector('#restore-file-input');
    container.querySelector('#btn-trigger-restore')?.addEventListener('click', () => {
      fileInput?.click();
    });

    // File selected for restore
    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const validation = BackupService.validateBackupFile(text);
        this.openRestoreConfirmModal(validation);
      } catch (err) {
        toast.error(err.message, 'Validation Failed');
      }
      fileInput.value = '';
    });

    // Auto-backup interval
    container.querySelector('#select-auto-backup')?.addEventListener('change', (e) => {
      BackupService.setAutoBackupInterval(e.target.value);
      toast.info(`Auto-backup reminder set to: ${e.target.value}`);
    });

    // Clear Database (Danger Zone)
    container.querySelector('#btn-clear-db')?.addEventListener('click', () => {
      this.openClearDbModal(container);
    });
  },

  /**
   * Safe Restore Confirmation Modal (Section 22)
   */
  openRestoreConfirmModal(validation) {
    const { counts, exportedAt, version, data } = validation;

    const content = `
      <div class="space-y-4 text-xs">
        <div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200">
          <p class="font-semibold">Important Restore Notice:</p>
          <p class="mt-0.5 text-[11px] leading-relaxed">
            Restoring this backup will replace current records. A safety snapshot of your current database will automatically be generated and downloaded before restore begins.
          </p>
        </div>

        <div class="space-y-2 pt-1">
          <p class="font-bold text-foreground">Backup Contents & Diagnostics:</p>
          <div class="grid grid-cols-2 gap-2 text-muted-foreground p-3 rounded-lg border border-border bg-muted/40">
            <div>Exported: <strong class="text-foreground">${exportedAt}</strong></div>
            <div>Schema Version: <strong class="text-foreground">v${version}</strong></div>
            <div>Students: <strong class="text-foreground">${counts.students}</strong></div>
            <div>Teachers: <strong class="text-foreground">${counts.teachers}</strong></div>
            <div>Classes: <strong class="text-foreground">${counts.classes}</strong></div>
            <div>Academic Sessions: <strong class="text-foreground">${counts.academicYears}</strong></div>
            <div>Attendance Logs: <strong class="text-foreground">${counts.attendance}</strong></div>
            <div>Scores & Grades: <strong class="text-foreground">${counts.scores}</strong></div>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button id="btn-cancel-restore" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium">
        Cancel
      </button>
      <button id="btn-confirm-restore" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm">
        Create Safety Snapshot & Restore
      </button>
    `;

    const modal = Modal.open({
      title: 'Confirm Database Restore',
      content,
      footer,
      maxWidth: 'max-w-md'
    });

    modal.element.querySelector('#btn-cancel-restore')?.addEventListener('click', () => modal.close());

    modal.element.querySelector('#btn-confirm-restore')?.addEventListener('click', async () => {
      try {
        toast.info('Generating safety backup snapshot...');
        await BackupService.createSafetyBackup();

        toast.info('Restoring database tables...');
        await BackupService.restoreDatabase(data);

        modal.close();
        toast.success('Database restored successfully from backup!');
        await this.render(this.container);
      } catch (err) {
        toast.error(err.message, 'Restore Failed');
      }
    });
  },

  /**
   * Clear Database Confirmation Modal with typing check
   */
  openClearDbModal(container) {
    const content = `
      <div class="space-y-4 text-xs">
        <p class="text-destructive font-semibold">Warning: This action will permanently erase all local school records.</p>
        <p class="text-muted-foreground">${t('settings.confirmClearPrompt')}</p>
        <input type="text" id="input-confirm-delete" placeholder="DELETE" class="w-full px-3 py-2 rounded-md border border-destructive/50 bg-card text-foreground font-mono focus:ring-1 focus:ring-destructive" />
      </div>
    `;

    const footer = `
      <button id="btn-cancel-clear" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium">
        Cancel
      </button>
      <button id="btn-confirm-clear" disabled class="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium shadow opacity-50 cursor-not-allowed transition-all">
        Permanently Clear Database
      </button>
    `;

    const modal = Modal.open({
      title: 'Clear Database Confirmation',
      content,
      footer,
      maxWidth: 'max-w-sm'
    });

    const input = modal.element.querySelector('#input-confirm-delete');
    const confirmBtn = modal.element.querySelector('#btn-confirm-clear');

    input?.addEventListener('input', (e) => {
      const match = e.target.value.trim() === 'DELETE';
      confirmBtn.disabled = !match;
      if (match) {
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    modal.element.querySelector('#btn-cancel-clear')?.addEventListener('click', () => modal.close());

    confirmBtn?.addEventListener('click', async () => {
      await BackupService.clearFullDatabase(true);
      modal.close();
      toast.success('Database has been reset and re-seeded with initial defaults.');
      await this.render(container);
    });
  },

  openAddYearModal(container) {
    const currentLocale = i18n.getLocale();
    const content = `
      <form id="ay-form" class="space-y-4 text-xs sm:text-sm">
        <div>
          <label class="block text-xs font-medium text-foreground mb-1">
            ${currentLocale === 'km' ? 'ឈ្មោះឆ្នាំសិក្សា' : 'Academic Year Name'} <span class="text-destructive">*</span>
          </label>
          <input type="text" id="form-ay-name" required placeholder="${t('settings.createYearPlaceholder')}" class="w-full px-3 py-2 rounded-md border border-input bg-card text-foreground font-mono focus:ring-1 focus:ring-ring" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-foreground mb-1">${currentLocale === 'km' ? 'កាលបរិច្ឆេទចាប់ផ្តើម' : 'Start Date'}</label>
            <input type="date" id="form-ay-start" class="w-full px-3 py-2 rounded-md border border-input bg-card text-foreground focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label class="block text-xs font-medium text-foreground mb-1">${currentLocale === 'km' ? 'កាលបរិច្ឆេទបញ្ចប់' : 'End Date'}</label>
            <input type="date" id="form-ay-end" class="w-full px-3 py-2 rounded-md border border-input bg-card text-foreground focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button id="btn-cancel-ay" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors cursor-pointer">
        ${t('common.cancel')}
      </button>
      <button id="btn-save-ay" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-medium shadow-sm transition-colors cursor-pointer">
        ${t('common.save')}
      </button>
    `;

    const modal = Modal.open({
      title: t('settings.addAcademicYear'),
      content,
      footer,
      maxWidth: 'max-w-sm'
    });

    modal.element.querySelector('#btn-cancel-ay')?.addEventListener('click', () => modal.close());

    modal.element.querySelector('#btn-save-ay')?.addEventListener('click', async () => {
      const name = modal.element.querySelector('#form-ay-name')?.value.trim();
      if (!name) return;
      const startDate = modal.element.querySelector('#form-ay-start')?.value;
      const endDate = modal.element.querySelector('#form-ay-end')?.value;

      try {
        await SettingsService.createAcademicYear({ name, startDate, endDate });
        AdminDataService.queueAutoSync();
        toast.success(currentLocale === 'km' ? `បានបង្កើតឆ្នាំសិក្សា "${name}" ដោយជោគជ័យ` : `Academic year "${name}" created successfully`);
        modal.close();
        window.dispatchEvent(new CustomEvent('app:refresh-data'));
        await this.render(container);
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
