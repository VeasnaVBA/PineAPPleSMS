/**
 * Admin Download Data Module (ទាញយកទិន្នន័យពី Drive)
 * Strictly accessible to ADMIN accounts.
 * 
 * Capabilities:
 * 1. Fetches all active user workspace spreadsheets from Google Drive (LIST_ALL_WORKSPACE_FILES).
 * 2. Displays list/cards of users with their spreadsheet metadata & last sync timestamp.
 * 3. Downloads that user's workspace data (PUSH_TO_APP).
 * 4. Flexible Download Options:
 *    - Download Both Formats (Excel .xlsx + JSON Backup .json)
 *    - Download Excel Only (.xlsx)
 *    - Download JSON Backup Only (.json)
 * 5. Visual Guide on how to use & import downloaded files back into the application:
 *    - Excel (.xlsx) ➔ Students Page (#students) "Import Excel"
 *    - JSON (.json) ➔ Settings Page (#settings) "Backup & Restore"
 * 6. Download destination selection:
 *    - Electron: Native directory picker via window.electronAPI.selectDirectory & saveFilesToDirectory.
 *    - Browser: Standard automatic downloads.
 */

import { authService } from '../services/authService.js';
import { CloudSyncService } from '../services/cloudSyncService.js';
import { getCloudSyncUrl } from '../config/cloudSync.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { formatDisplayDate } from '../utils/dateUtils.js';
import { i18n, t } from '../i18n/i18n.js';

export const DownloadDataPage = {
  container: null,
  files: [],
  isLoading: false,
  isDownloading: false,
  downloadingMode: null, // 'both', 'excel', 'json'
  selectedUsername: null,
  selectedFile: null,
  searchQuery: '',
  destinationDirectory: null,

  async render(container) {
    this.container = container;

    // 1. Multi-level RBAC Security Check: Strictly ADMIN
    if (!authService.isAdmin()) {
      this.renderAccessDenied(container);
      return;
    }

    // Load saved destination directory preference for Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.destinationDirectory = localStorage.getItem('download_data_dest_dir') || null;
    }

    this.renderSkeleton();
    await this.fetchDriveFiles();
  },

  renderAccessDenied(container) {
    const isKm = i18n.getLocale() === 'km';
    container.innerHTML = `
      <div class="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div class="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          ${getIcon('lock', 'w-8 h-8')}
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
          ${isKm ? 'គ្មានសិទ្ធិចូលប្រើប្រាស់' : 'Access Denied'}
        </h2>
        <p class="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md">
          ${isKm 
            ? 'ទំព័រនេះត្រូវបានកំណត់សម្រាប់តែគណនី Admin ប៉ុណ្ណោះ។'
            : 'This page is strictly reserved for Admin accounts only.'}
        </p>
        <a href="#users" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm shadow transition-all">
          ${getIcon('arrowRight', 'w-4 h-4 rotate-180')}
          <span>${isKm ? 'ត្រឡប់ទៅការគ្រប់គ្រងគណនី' : 'Back to User Accounts'}</span>
        </a>
      </div>
    `;
  },

  renderSkeleton() {
    if (!this.container) return;
    const isKm = i18n.getLocale() === 'km';

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12 select-none">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div class="flex items-center gap-2.5">
              <span class="p-2 rounded-lg bg-primary/10 text-primary">
                ${getIcon('downloadCloud', 'w-5 h-5')}
              </span>
              <h1 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
                ${t('downloadData.title')}
              </h1>
            </div>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1">
              ${t('downloadData.subtitle')}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-config-endpoint" 
                    type="button" 
                    class="h-10 inline-flex items-center gap-2 px-3.5 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors cursor-pointer shadow-2xs">
              ${getIcon('settings', 'w-4 h-4')}
              <span>${t('downloadData.btnConfigEndpoint')}</span>
            </button>
            <button id="btn-refresh-files" 
                    type="button" 
                    class="h-10 inline-flex items-center gap-2 px-4 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs transition-colors cursor-pointer">
              ${getIcon('rotateCw', 'w-4 h-4')}
              <span>${t('downloadData.btnRefresh')}</span>
            </button>
          </div>
        </div>

        <!-- Scanning State Indicator -->
        <div class="p-12 rounded-xl border border-border bg-card/60 flex flex-col items-center justify-center text-center space-y-3">
          <div class="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin"></div>
          <p class="text-sm font-medium text-foreground ${isKm ? 'font-khmer' : ''}">
            ${t('downloadData.driveScanning')}
          </p>
          <p class="text-xs text-muted-foreground">
            Connecting to Google Apps Script Web App...
          </p>
        </div>
      </div>
    `;

    this.bindSkeletonEvents();
  },

  bindSkeletonEvents() {
    if (!this.container) return;
    const configBtn = this.container.querySelector('#btn-config-endpoint');
    const refreshBtn = this.container.querySelector('#btn-refresh-files');

    configBtn?.addEventListener('click', () => {
      CloudSyncService.openConfigModal(() => this.fetchDriveFiles());
    });

    refreshBtn?.addEventListener('click', () => {
      this.fetchDriveFiles();
    });
  },

  async fetchDriveFiles() {
    this.isLoading = true;
    try {
      const endpoint = getCloudSyncUrl();
      if (!endpoint) {
        this.renderNoConfigState();
        return;
      }

      const files = await CloudSyncService.listAllWorkspaceFiles();
      this.files = Array.isArray(files) ? files : [];

      // Auto-select first user if available and none selected yet
      if (this.files.length > 0) {
        const stillExists = this.files.find(f => f.username === this.selectedUsername);
        if (!stillExists) {
          this.selectedUsername = this.files[0].username;
          this.selectedFile = this.files[0];
        } else {
          this.selectedFile = stillExists;
        }
      } else {
        this.selectedUsername = null;
        this.selectedFile = null;
      }

      this.renderMainContent();
    } catch (err) {
      console.error('Error fetching drive workspace files:', err);
      this.renderErrorState(err.message);
    } finally {
      this.isLoading = false;
    }
  },

  renderNoConfigState() {
    if (!this.container) return;
    const isKm = i18n.getLocale() === 'km';

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12 select-none">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div class="flex items-center gap-2.5">
              <span class="p-2 rounded-lg bg-primary/10 text-primary">
                ${getIcon('downloadCloud', 'w-5 h-5')}
              </span>
              <h1 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
                ${t('downloadData.title')}
              </h1>
            </div>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1">
              ${t('downloadData.subtitle')}
            </p>
          </div>
        </div>

        <div class="p-8 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-4">
          <div class="p-3 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
            ${getIcon('cloud', 'w-8 h-8')}
          </div>
          <div>
            <h3 class="text-base font-bold text-foreground">Google Apps Script Web App URL Required</h3>
            <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              To query and download user workspace data from Google Drive, please configure your deployed Google Apps Script Web App endpoint URL.
            </p>
          </div>
          <button id="btn-open-config-initial" 
                  type="button" 
                  class="h-10 px-5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors shadow-sm cursor-pointer">
            ${t('downloadData.btnConfigEndpoint')}
          </button>
        </div>
      </div>
    `;

    const btn = this.container.querySelector('#btn-open-config-initial');
    btn?.addEventListener('click', () => {
      CloudSyncService.openConfigModal(() => this.fetchDriveFiles());
    });
  },

  renderErrorState(errorMessage) {
    if (!this.container) return;
    const isKm = i18n.getLocale() === 'km';

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12 select-none">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div class="flex items-center gap-2.5">
              <span class="p-2 rounded-lg bg-primary/10 text-primary">
                ${getIcon('downloadCloud', 'w-5 h-5')}
              </span>
              <h1 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
                ${t('downloadData.title')}
              </h1>
            </div>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1">
              ${t('downloadData.subtitle')}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-config-endpoint" 
                    type="button" 
                    class="h-10 inline-flex items-center gap-2 px-3.5 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors cursor-pointer shadow-2xs">
              ${getIcon('settings', 'w-4 h-4')}
              <span>${t('downloadData.btnConfigEndpoint')}</span>
            </button>
            <button id="btn-refresh-files" 
                    type="button" 
                    class="h-10 inline-flex items-center gap-2 px-4 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs transition-colors cursor-pointer">
              ${getIcon('rotateCw', 'w-4 h-4')}
              <span>${t('downloadData.btnRefresh')}</span>
            </button>
          </div>
        </div>

        <div class="p-6 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive space-y-3">
          <div class="flex items-center gap-2 font-bold text-sm">
            ${getIcon('x', 'w-5 h-5')}
            <span>Failed to fetch user files from Google Drive</span>
          </div>
          <p class="text-xs text-foreground/90 font-mono bg-background/50 p-3 rounded-lg border border-destructive/20 break-all">
            ${errorMessage}
          </p>
          <div class="pt-2 flex items-center gap-3">
            <button id="btn-retry-fetch" 
                    type="button" 
                    class="h-9 px-4 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold transition-colors cursor-pointer">
              Try Again
            </button>
            <button id="btn-open-troubleshoot" 
                    type="button" 
                    class="h-9 px-3.5 rounded-md border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer">
              View Deployment Checklist
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindSkeletonEvents();
    this.container.querySelector('#btn-retry-fetch')?.addEventListener('click', () => this.fetchDriveFiles());
    this.container.querySelector('#btn-open-troubleshoot')?.addEventListener('click', () => {
      CloudSyncService.showErrorModal(errorMessage);
    });
  },

  renderMainContent() {
    if (!this.container) return;
    const isKm = i18n.getLocale() === 'km';
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

    // Filter files based on search query
    const query = (this.searchQuery || '').toLowerCase().trim();
    const filteredFiles = this.files.filter(f => {
      if (!query) return true;
      const uname = (f.username || '').toLowerCase();
      const fname = (f.fileName || f.name || '').toLowerCase();
      return uname.includes(query) || fname.includes(query);
    });

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12 select-none">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div class="flex items-center gap-2.5">
              <span class="p-2 rounded-lg bg-primary/10 text-primary">
                ${getIcon('downloadCloud', 'w-5 h-5')}
              </span>
              <h1 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
                ${t('downloadData.title')}
              </h1>
            </div>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1">
              ${t('downloadData.subtitle')}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-config-endpoint" 
                    type="button" 
                    class="h-10 inline-flex items-center gap-2 px-3.5 rounded-md border border-input bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors cursor-pointer shadow-2xs">
              ${getIcon('settings', 'w-4 h-4')}
              <span>${t('downloadData.btnConfigEndpoint')}</span>
            </button>
            <button id="btn-refresh-files" 
                    type="button" 
                    class="h-10 inline-flex items-center gap-2 px-4 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs transition-colors cursor-pointer">
              ${getIcon('rotateCw', 'w-4 h-4')}
              <span>${t('downloadData.btnRefresh')}</span>
            </button>
          </div>
        </div>

        <!-- Drive Connection Status Bar -->
        <div class="p-3.5 rounded-xl border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span class="font-medium text-foreground">Google Apps Script Cloud Sync:</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${t('downloadData.driveScanComplete')}</span>
          </div>

          <div class="flex items-center gap-4 text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <span>${t('downloadData.totalDriveUsers')}:</span>
              <span class="font-bold text-foreground px-2 py-0.5 rounded-full bg-muted text-[11px]">${this.files.length}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span>Environment:</span>
              <span class="font-semibold text-primary uppercase text-[11px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                ${isElectron ? 'Electron Desktop' : 'Web Browser'}
              </span>
            </div>
          </div>
        </div>

        ${this.files.length === 0 ? `
          <!-- No User Files Found in Drive Card -->
          <div class="p-8 rounded-xl border border-border bg-card/50 flex flex-col items-center justify-center text-center space-y-4 max-w-2xl mx-auto my-8">
            <div class="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
              ${getIcon('folderDown', 'w-7 h-7')}
            </div>
            <div>
              <h3 class="text-base font-bold text-foreground ${isKm ? 'font-khmer' : ''}">
                ${t('downloadData.noFilesFoundTitle')}
              </h3>
              <p class="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                ${t('downloadData.noFilesFoundDesc')}
              </p>
            </div>
            <div class="p-3.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground text-left max-w-md space-y-1">
              <p class="font-semibold text-foreground">💡 How to sync data to Drive:</p>
              <p>1. Log in with a Teacher or Director account.</p>
              <p>2. In the topbar or settings, click <strong>"Sync to Google Drive"</strong>.</p>
              <p>3. Once pushed, the spreadsheet <code class="font-mono text-primary font-bold">SchoolWorkspace_&lt;username&gt;</code> will appear here automatically.</p>
            </div>
            <button id="btn-empty-refresh" 
                    type="button" 
                    class="h-10 px-5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs transition-colors cursor-pointer">
              ${t('downloadData.btnRefresh')}
            </button>
          </div>
        ` : `
          <!-- Main 2-Column Responsive Workspace Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <!-- Left Column: User Files List & Search (5 Cols) -->
            <div class="lg:col-span-5 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-bold text-foreground flex items-center gap-2 ${isKm ? 'font-khmer' : ''}">
                  ${getIcon('users', 'w-4 h-4 text-primary')}
                  <span>${t('downloadData.selectUserFile')}</span>
                </h3>
                <span class="text-[11px] text-muted-foreground">
                  ${filteredFiles.length} / ${this.files.length}
                </span>
              </div>

              <!-- Search Bar -->
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  ${getIcon('search', 'w-3.5 h-3.5')}
                </span>
                <input id="input-search-users" 
                       type="text" 
                       value="${this.searchQuery}"
                       placeholder="${t('downloadData.searchPlaceholder')}"
                       class="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <!-- User Cards Scrollable Container -->
              <div class="space-y-2 max-h-[580px] overflow-y-auto pr-1" id="user-files-list">
                ${filteredFiles.map(file => {
                  const isSelected = file.username === this.selectedUsername;
                  const formattedDate = this.formatFileDate(file.updatedAt || file.modifiedTime || file.lastUpdated);
                  
                  return `
                    <div data-username="${file.username}" 
                         class="user-file-card p-3.5 rounded-xl border transition-all cursor-pointer ${
                           isSelected 
                             ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30' 
                             : 'border-border bg-card hover:bg-accent/50 hover:border-muted-foreground/30'
                         }">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }">
                            ${getIcon('user', 'w-4 h-4')}
                          </div>
                          <div class="min-w-0">
                            <p class="font-bold text-xs text-foreground truncate font-mono">
                              ${file.username}
                            </p>
                            <p class="text-[11px] text-muted-foreground truncate">
                              ${file.fileName || `SchoolWorkspace_${file.username}`}
                            </p>
                          </div>
                        </div>

                        ${isSelected ? `
                          <span class="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shrink-0">
                            Selected
                          </span>
                        ` : ''}
                      </div>

                      <div class="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                        <div class="flex items-center gap-1">
                          ${getIcon('clock', 'w-3 h-3')}
                          <span>${formattedDate}</span>
                        </div>
                        ${file.spreadsheetUrl ? `
                          <a href="${file.spreadsheetUrl}" 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             class="text-primary hover:underline flex items-center gap-1"
                             onclick="event.stopPropagation()">
                            <span>Open in Sheets</span>
                            ${getIcon('arrowRight', 'w-2.5 h-2.5 -rotate-45')}
                          </a>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Right Column: Selected File Details & Download Center (7 Cols) -->
            <div class="lg:col-span-7 space-y-5">
              ${this.selectedFile ? `
                <div class="p-6 rounded-xl border border-border bg-card shadow-xs space-y-6">
                  
                  <!-- Selected User Summary Header -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shadow-2xs">
                        ${getIcon('database', 'w-6 h-6')}
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <h2 class="text-base font-bold text-foreground font-mono">
                            ${this.selectedFile.username}
                          </h2>
                          <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-muted text-muted-foreground border border-border">
                            Active Drive File
                          </span>
                        </div>
                        <p class="text-xs text-muted-foreground mt-0.5 font-mono">
                          ${this.selectedFile.fileName || `SchoolWorkspace_${this.selectedFile.username}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Metadata Grid -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div class="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                      <span class="text-muted-foreground">${t('downloadData.lastSync')}</span>
                      <p class="font-medium text-foreground flex items-center gap-1.5">
                        ${getIcon('calendar', 'w-3.5 h-3.5 text-primary')}
                        <span>${this.formatFileDate(this.selectedFile.updatedAt || this.selectedFile.modifiedTime || this.selectedFile.lastUpdated)}</span>
                      </p>
                    </div>

                    <div class="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                      <span class="text-muted-foreground">${t('downloadData.spreadsheetId')}</span>
                      <p class="font-mono text-foreground font-medium truncate" title="${this.selectedFile.id || this.selectedFile.spreadsheetId || '—'}">
                        ${this.selectedFile.id || this.selectedFile.spreadsheetId || '—'}
                      </p>
                    </div>
                  </div>

                  <!-- Export Formats Showcase -->
                  <div class="space-y-3">
                    <h4 class="text-xs font-bold text-foreground uppercase tracking-wider text-muted-foreground">
                      Available Formats & Modules
                    </h4>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <!-- 1. Excel Card -->
                      <div class="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <span class="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              ${getIcon('fileSpreadsheet', 'w-4 h-4')}
                            </span>
                            <span class="font-bold text-xs text-foreground">Excel (.xlsx)</span>
                          </div>
                          <span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            6 Tabs
                          </span>
                        </div>
                        <p class="text-[11px] text-muted-foreground leading-relaxed">
                          ${t('downloadData.excelDesc')}
                        </p>
                        <div class="flex flex-wrap gap-1 pt-1">
                          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono">students</span>
                          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono">schools</span>
                          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono">classes</span>
                          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono">teachers</span>
                          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono">attendance</span>
                          <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono">scores</span>
                        </div>
                      </div>

                      <!-- 2. JSON Backup Card -->
                      <div class="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <span class="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              ${getIcon('fileJson', 'w-4 h-4')}
                            </span>
                            <span class="font-bold text-xs text-foreground">JSON Backup (.json)</span>
                          </div>
                          <span class="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            Full Snapshot
                          </span>
                        </div>
                        <p class="text-[11px] text-muted-foreground leading-relaxed">
                          ${t('downloadData.jsonDesc')}
                        </p>
                        <div class="pt-1 flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          ${getIcon('check', 'w-3 h-3')}
                          <span>Database restore compatible</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Destination Selection (Electron vs Browser) -->
                  ${isElectron ? `
                    <div class="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2.5 text-xs">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-foreground flex items-center gap-1.5">
                          ${getIcon('folder', 'w-3.5 h-3.5 text-primary')}
                          <span>${t('downloadData.savedToFolder')}</span>
                        </span>
                        <button id="btn-change-folder" 
                                type="button" 
                                class="text-primary hover:underline text-xs font-semibold cursor-pointer">
                          ${t('downloadData.changeFolder')}
                        </button>
                      </div>

                      <div class="p-2 rounded-lg bg-background border border-input font-mono text-[11px] text-foreground truncate flex items-center justify-between gap-2">
                        <span class="truncate" id="dest-folder-display">
                          ${this.destinationDirectory || 'Default: Downloads Folder'}
                        </span>
                        ${this.destinationDirectory ? `
                          <button id="btn-open-dest-folder" 
                                  type="button" 
                                  class="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted" 
                                  title="${t('downloadData.openFolder')}">
                            ${getIcon('arrowRight', 'w-3 h-3')}
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  ` : `
                    <div class="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-2">
                      <span class="text-primary shrink-0">${getIcon('download', 'w-4 h-4')}</span>
                      <span>${t('downloadData.browserDownloadTip')}</span>
                    </div>
                  `}

                  <!-- Action Buttons (Both, Excel Only, JSON Only) -->
                  <div class="space-y-2 pt-1">
                    <!-- Primary: Both Formats -->
                    <button id="btn-download-both" 
                            type="button" 
                            ${this.isDownloading ? 'disabled' : ''}
                            class="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer">
                      ${this.isDownloading && this.downloadingMode === 'both'
                        ? `<div class="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div><span>${t('downloadData.downloading')}</span>` 
                        : `${getIcon('downloadCloud', 'w-5 h-5')}<span>${t('downloadData.downloadBothFormats')}</span>`}
                    </button>

                    <!-- Secondary: Excel Only & JSON Only -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button id="btn-download-excel-only" 
                              type="button" 
                              ${this.isDownloading ? 'disabled' : ''}
                              class="h-10 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        ${this.isDownloading && this.downloadingMode === 'excel'
                          ? `<div class="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></div><span>Loading...</span>`
                          : `${getIcon('fileSpreadsheet', 'w-4 h-4')}<span>${t('downloadData.downloadExcelOnly')}</span>`}
                      </button>

                      <button id="btn-download-json-only" 
                              type="button" 
                              ${this.isDownloading ? 'disabled' : ''}
                              class="h-10 px-3 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        ${this.isDownloading && this.downloadingMode === 'json'
                          ? `<div class="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div><span>Loading...</span>`
                          : `${getIcon('fileJson', 'w-4 h-4')}<span>${t('downloadData.downloadJsonOnly')}</span>`}
                      </button>
                    </div>
                  </div>

                </div>

                <!-- Comprehensive Usage & In-App Import Guide Card -->
                <div class="p-5 rounded-xl border border-border bg-card/60 shadow-2xs space-y-4">
                  <div class="flex items-center gap-2 text-foreground font-bold text-xs ${isKm ? 'font-khmer' : ''}">
                    <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('clipboardList', 'w-4 h-4')}</span>
                    <span>${t('downloadData.usageGuideTitle')}</span>
                  </div>

                  <div class="space-y-3 text-xs leading-relaxed">
                    <!-- Excel Guide -->
                    <div class="p-3 rounded-lg bg-background border border-border space-y-1.5">
                      <div class="flex items-center gap-2 font-semibold text-foreground">
                        <span class="text-emerald-600 dark:text-emerald-400">${getIcon('fileSpreadsheet', 'w-3.5 h-3.5')}</span>
                        <span>${t('downloadData.excelUsageTitle')}</span>
                      </div>
                      <p class="text-muted-foreground text-[11.5px]">
                        ${t('downloadData.excelUsageDesc')}
                      </p>
                      <div class="pt-1 flex items-center gap-1.5 text-[11px] text-primary font-medium">
                        <span>Path:</span>
                        <a href="#students" class="underline hover:text-primary/80 font-mono">#students ➔ នាំចូល Excel</a>
                      </div>
                    </div>

                    <!-- JSON Guide -->
                    <div class="p-3 rounded-lg bg-background border border-border space-y-1.5">
                      <div class="flex items-center gap-2 font-semibold text-foreground">
                        <span class="text-blue-600 dark:text-blue-400">${getIcon('fileJson', 'w-3.5 h-3.5')}</span>
                        <span>${t('downloadData.jsonUsageTitle')}</span>
                      </div>
                      <p class="text-muted-foreground text-[11.5px]">
                        ${t('downloadData.jsonUsageDesc')}
                      </p>
                      <div class="pt-1 flex items-center gap-1.5 text-[11px] text-primary font-medium">
                        <span>Path:</span>
                        <a href="#settings" class="underline hover:text-primary/80 font-mono">#settings ➔ Backup & Restore ➔ ស្ដារទិន្នន័យឡើងវិញ</a>
                      </div>
                    </div>
                  </div>
                </div>

              ` : `
                <!-- No Selected User Placeholder -->
                <div class="p-12 rounded-xl border border-dashed border-border bg-card/40 flex flex-col items-center justify-center text-center space-y-3">
                  <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    ${getIcon('user', 'w-6 h-6')}
                  </div>
                  <p class="text-xs text-muted-foreground max-w-xs">
                    ${t('downloadData.selectUserPrompt')}
                  </p>
                </div>
              `}
            </div>

          </div>
        `}
      </div>
    `;

    this.bindMainEvents();
  },

  bindMainEvents() {
    if (!this.container) return;

    this.bindSkeletonEvents();

    // Empty state refresh button
    this.container.querySelector('#btn-empty-refresh')?.addEventListener('click', () => {
      this.fetchDriveFiles();
    });

    // Search filter input
    const searchInput = this.container.querySelector('#input-search-users');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderMainContent();
      const updatedInput = this.container.querySelector('#input-search-users');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(updatedInput.value.length, updatedInput.value.length);
      }
    });

    // Card selection clicks
    const cards = this.container.querySelectorAll('.user-file-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const username = card.getAttribute('data-username');
        if (!username) return;
        this.selectedUsername = username;
        this.selectedFile = this.files.find(f => f.username === username) || null;
        this.renderMainContent();
      });
    });

    // Electron folder picker
    const changeFolderBtn = this.container.querySelector('#btn-change-folder');
    changeFolderBtn?.addEventListener('click', async () => {
      await this.selectDestinationFolder();
    });

    // Open destination folder in explorer
    const openFolderBtn = this.container.querySelector('#btn-open-dest-folder');
    openFolderBtn?.addEventListener('click', async () => {
      if (this.destinationDirectory && window.electronAPI?.openFolder) {
        await window.electronAPI.openFolder(this.destinationDirectory);
      }
    });

    // Download Both Button
    const downloadBothBtn = this.container.querySelector('#btn-download-both');
    downloadBothBtn?.addEventListener('click', async () => {
      if (this.isDownloading || !this.selectedUsername) return;
      await this.executeDownload('both');
    });

    // Download Excel Only Button
    const downloadExcelBtn = this.container.querySelector('#btn-download-excel-only');
    downloadExcelBtn?.addEventListener('click', async () => {
      if (this.isDownloading || !this.selectedUsername) return;
      await this.executeDownload('excel');
    });

    // Download JSON Only Button
    const downloadJsonBtn = this.container.querySelector('#btn-download-json-only');
    downloadJsonBtn?.addEventListener('click', async () => {
      if (this.isDownloading || !this.selectedUsername) return;
      await this.executeDownload('json');
    });
  },

  async selectDestinationFolder() {
    if (!window.electronAPI?.selectDirectory) return;
    try {
      const res = await window.electronAPI.selectDirectory({
        title: t('downloadData.directoryPicker'),
        defaultPath: this.destinationDirectory || undefined
      });

      if (!res.canceled && res.selectedDirectory) {
        this.destinationDirectory = res.selectedDirectory;
        localStorage.setItem('download_data_dest_dir', res.selectedDirectory);
        this.renderMainContent();
        toast.success(`Destination folder updated: ${res.selectedDirectory}`);
      }
    } catch (err) {
      console.error('Directory picker error:', err);
      toast.error('Failed to select destination directory: ' + err.message);
    }
  },

  /**
   * Main download execution with mode selection:
   * @param {'both'|'excel'|'json'} mode - Selected format mode
   */
  async executeDownload(mode = 'both') {
    if (!this.selectedUsername) return;

    this.isDownloading = true;
    this.downloadingMode = mode;
    this.renderMainContent();

    const username = this.selectedUsername;
    const timestamp = this.getFormattedTimestamp();
    const excelFilename = `SchoolWorkspace_${username}_${timestamp}.xlsx`;
    const jsonFilename = `SchoolWorkspace_${username}_${timestamp}.json`;

    try {
      // 1. Fetch full payload from Google Drive
      const response = await CloudSyncService.fetchUserWorkspaceData(username);
      if (!response) {
        throw new Error(`No data response returned for user "${username}".`);
      }

      let rawData = response.data || response.tables || response;
      if (rawData.data && typeof rawData.data === 'object' && !Array.isArray(rawData.data)) {
        rawData = rawData.data;
      }

      const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.saveFilesToDirectory);

      // Prepare files to save based on requested mode
      let excelBuffer = null;
      let jsonString = null;
      const filesToSave = [];

      if (mode === 'both' || mode === 'excel') {
        excelBuffer = await this.generateMultiTabExcel(username, rawData);
        if (isElectron) {
          const excelBase64 = this.arrayBufferToBase64(excelBuffer);
          filesToSave.push({ filename: excelFilename, content: excelBase64, isBase64: true });
        }
      }

      if (mode === 'both' || mode === 'json') {
        const jsonBackupPayload = {
          app: 'PineAPPleSMS Management System',
          version: '1.0.0',
          username,
          exportedAt: new Date().toISOString(),
          tables: {
            students: Array.isArray(rawData.students) ? rawData.students : [],
            schools: Array.isArray(rawData.schools) ? rawData.schools : [],
            classes: Array.isArray(rawData.classes) ? rawData.classes : [],
            teachers: Array.isArray(rawData.teachers) ? rawData.teachers : [],
            attendance: Array.isArray(rawData.attendance) ? rawData.attendance : [],
            scores: Array.isArray(rawData.scores) ? rawData.scores : []
          }
        };
        jsonString = JSON.stringify(jsonBackupPayload, null, 2);
        if (isElectron) {
          filesToSave.push({ filename: jsonFilename, content: jsonString, isBase64: false });
        }
      }

      // 2. Save files in Electron or trigger Browser downloads
      if (isElectron) {
        let targetDir = this.destinationDirectory;
        if (!targetDir && window.electronAPI?.selectDirectory) {
          const dirPrompt = await window.electronAPI.selectDirectory({
            title: t('downloadData.directoryPicker')
          });
          if (!dirPrompt.canceled && dirPrompt.selectedDirectory) {
            targetDir = dirPrompt.selectedDirectory;
            this.destinationDirectory = targetDir;
            localStorage.setItem('download_data_dest_dir', targetDir);
          }
        }

        const saveRes = await window.electronAPI.saveFilesToDirectory({
          directoryPath: targetDir,
          files: filesToSave
        });

        if (!saveRes || !saveRes.success) {
          throw new Error(saveRes?.error || 'Failed to write files to disk.');
        }

        const finalDir = saveRes.directoryPath || targetDir;
        let successMsg = t('downloadData.downloadSuccess', { username });
        if (mode === 'excel') successMsg = t('downloadData.downloadSuccessExcel', { username });
        if (mode === 'json') successMsg = t('downloadData.downloadSuccessJson', { username });

        toast.show({
          title: t('downloadData.title'),
          message: `${successMsg}\n📁 ${finalDir}`,
          type: 'success',
          duration: 10000,
          action: {
            label: t('downloadData.openFolder'),
            onClick: () => {
              if (window.electronAPI?.openFolder && finalDir) {
                window.electronAPI.openFolder(finalDir);
              }
            }
          }
        });
      } else {
        // Browser Downloads
        if (mode === 'both') {
          const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          this.downloadBlob(excelBlob, excelFilename);

          setTimeout(() => {
            const jsonBlob = new Blob([jsonString], { type: 'application/json' });
            this.downloadBlob(jsonBlob, jsonFilename);
          }, 800);

          toast.success(t('downloadData.downloadSuccess', { username }), t('downloadData.title'));
        } else if (mode === 'excel') {
          const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          this.downloadBlob(excelBlob, excelFilename);
          toast.success(t('downloadData.downloadSuccessExcel', { username }), t('downloadData.title'));
        } else if (mode === 'json') {
          const jsonBlob = new Blob([jsonString], { type: 'application/json' });
          this.downloadBlob(jsonBlob, jsonFilename);
          toast.success(t('downloadData.downloadSuccessJson', { username }), t('downloadData.title'));
        }
      }

    } catch (err) {
      console.error('Download execution error:', err);
      toast.error(err.message, t('downloadData.title'));
    } finally {
      this.isDownloading = false;
      this.downloadingMode = null;
      this.renderMainContent();
    }
  },

  /**
   * Generate multi-tab workbook with ExcelJS formatted in Khmer OS Siemreap
   */
  async generateMultiTabExcel(username, rawData) {
    const ExcelJS = (typeof window !== 'undefined' && window.ExcelJS) || globalThis.ExcelJS;
    if (!ExcelJS) {
      throw new Error('ExcelJS library is not available.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PineAPPleSMS Management System';
    workbook.lastModifiedBy = 'Administrator';
    workbook.created = new Date();
    workbook.modified = new Date();

    const createStyledWorksheet = (sheetName, headers, rows, centerCols = new Set()) => {
      const ws = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }]
      });

      // 1. Header Row (30pt height, Khmer OS Siemreap 11.5pt Bold, Solid Blue fill #1E40AF, White text)
      const headerRow = ws.addRow(headers);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.font = {
          name: 'Khmer OS Siemreap',
          size: 11.5,
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E40AF' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      });

      // 2. Data Rows (24pt height, Khmer OS Siemreap 11pt, zebra striping #F8FAFC / #FFFFFF, thin border #E2E8F0)
      rows.forEach((rowData, idx) => {
        const row = ws.addRow(rowData);
        row.height = 24;
        const isEven = idx % 2 === 1;
        const rowFill = isEven ? {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        } : {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' }
        };

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = {
            name: 'Khmer OS Siemreap',
            size: 11,
            color: { argb: 'FF0F172A' }
          };
          cell.fill = rowFill;
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          const isCentered = centerCols.has(colNumber);
          cell.alignment = {
            vertical: 'middle',
            horizontal: isCentered ? 'center' : 'left',
            wrapText: false
          };
        });
      });

      // 3. Auto column widths
      ws.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const val = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
          if (val.length > maxLength) maxLength = val.length;
        });
        column.width = Math.min(Math.max(maxLength + 4, 12), 48);
      });

      return ws;
    };

    // 1. Students tab (All 29 standard columns)
    const studentHeaders = [
      'ស្ថានភាព (Status)', 'ល.រ (No.)', 'រូបថត (Photo)', 'អត្តលេខ (Student ID)',
      'ត្រកូលនាម (Khmer Last Name)', 'ខ្លួនត្រកូល (Khmer First Name)', 'ឡាតាំងនាម (Latin Last Name)', 'ខ្លួនឡាតាំង (Latin First Name)',
      'ភេទ (Gender)', 'ថ្ងៃខែឆ្នាំកំណើត (Date of Birth)', 'ភូមិកំណើត (Birth Village)', 'ឃុំកំណើត (Birth Commune)',
      'ស្រុកកំណើត (Birth District)', 'ខេត្តកំណើត (Birth Province)', 'ភូមិបច្ចុប្បន្ន (Current Village)',
      'ឃុំបច្ចុប្បន្ន (Current Commune)', 'ស្រុកបច្ចុប្បន្ន (Current District)', 'ខេត្តបច្ចុប្បន្ន (Current Province)',
      'ឆ្នាំសិក្សា (Academic Year)', 'សាលាចាស់ (Last Year School)', 'សាលារៀន (School)', 'ថ្នាក់លេខ (Class)',
      'ទូរសព្ទសិស្ស (Student Phone)', 'ឈ្មោះឪពុក (Father Name)', 'មុខរបរឪពុក (Father Job)', 'ទូរសព្ទឪពុក (Father Phone)',
      'ឈ្មោះម្តាយ (Mother Name)', 'មុខរបរម្តាយ (Mother Job)', 'ទូរសព្ទម្តាយ (Mother Phone)', 'ផ្សេងៗ (Notes)'
    ];
    const studentRows = (rawData.students || []).map((s, idx) => [
      s.status || 'Active',
      idx + 1,
      s.photo ? '(Photo attached)' : '',
      s.studentId || s.id || '',
      s.lastNameKh || '',
      s.firstNameKh || '',
      s.lastNameLatin || '',
      s.firstNameLatin || '',
      s.gender || '',
      formatDisplayDate(s.dateOfBirth) || '',
      s.birthVillage || '',
      s.birthCommune || '',
      s.birthDistrict || '',
      s.birthProvince || '',
      s.currentVillage || '',
      s.currentCommune || '',
      s.currentDistrict || '',
      s.currentProvince || '',
      s.academicYear || '',
      s.lastYearSchool || '',
      s.school || '',
      s.classId || s.className || '',
      s.studentPhone || '',
      s.fatherName || '',
      s.fatherOccupation || '',
      s.fatherPhone || '',
      s.motherName || '',
      s.motherOccupation || '',
      s.motherPhone || '',
      s.notes || ''
    ]);
    createStyledWorksheet('students', studentHeaders, studentRows, new Set([1, 2, 4, 9, 10, 19, 22]));

    // 2. Schools tab
    const schoolHeaders = [
      'ល.រ (No.)', 'កូដសាលា (School Code)', 'ឈ្មោះសាលា (School Name Kh)',
      'ឈ្មោះជាឡាតាំង (School Name En)', 'អាសយដ្ឋាន (Address)', 'នាយកសាលា (Director)',
      'លេខទូរសព្ទ (Phone)', 'ផ្សេងៗ (Notes)'
    ];
    const schoolRows = (rawData.schools || []).map((sch, idx) => [
      idx + 1,
      sch.code || sch.id || '',
      sch.name || '',
      sch.nameEn || '',
      sch.address || '',
      sch.director || '',
      sch.phone || '',
      sch.notes || ''
    ]);
    createStyledWorksheet('schools', schoolHeaders, schoolRows, new Set([1, 2, 7]));

    // 3. Classes tab
    const classHeaders = [
      'ល.រ (No.)', 'កូដថ្នាក់ (Class ID)', 'ឈ្មោះថ្នាក់ (Class Name)',
      'កម្រិត/ថ្នាក់ទី (Grade)', 'បន្ទប់ (Room)', 'ឆ្នាំសិក្សា (Academic Year)', 'អត្តលេខគ្រូ (Teacher ID)'
    ];
    const classRows = (rawData.classes || []).map((cls, idx) => [
      idx + 1,
      cls.id || '',
      cls.name || '',
      cls.grade || '',
      cls.room || '',
      cls.academicYear || '',
      cls.teacherId || ''
    ]);
    createStyledWorksheet('classes', classHeaders, classRows, new Set([1, 2, 4, 5, 6, 7]));

    // 4. Teachers tab (Official 44-Field MoEYS Structure)
    const teacherHeaders = [
      'ស្ថានភាព (Status)', 'ល.រ (No.)', 'រូបថត (Photo)', 'លេខសម្គាល់គ្រូ (Teacher ID)',
      'អត្តលេខមន្ត្រីរាជការ (Civil Servant ID)', 'លេខអត្តសញ្ញាណប័ណ្ណ (National ID)',
      'ត្រកូល (Khmer Surname)', 'នាមខ្លួន (Khmer First Name)', 'ត្រកូលឡាតាំង (Latin Surname)', 'នាមខ្លួនឡាតាំង (Latin First Name)',
      'ភេទ (Gender)', 'ថ្ងៃខែឆ្នាំកំណើត (Date of Birth)', 'អាយុ (Age)',
      'ថ្ងៃចូលបម្រើការងារ (Date Joined Service)', 'ថ្ងៃចូលនិវត្តន៍ (Retirement Date)',
      'ភូមិកំណើត (Birth Village)', 'ឃុំកំណើត (Birth Commune)', 'ស្រុកកំណើត (Birth District)', 'ខេត្តកំណើត (Birth Province)',
      'ភូមិបច្ចុប្បន្ន (Current Village)', 'ឃុំបច្ចុប្បន្ន (Current Commune)', 'ស្រុកបច្ចុប្បន្ន (Current District)', 'ខេត្តបច្ចុប្បន្ន (Current Province)',
      'ស្ថានភាពការងារ (Work Status)', 'ក្របខណ្ឌ (Framework)', 'ឋាន្តរស័ក្តិ និងថ្នាក់ (Rank & Grade)',
      'មុខតំណែង (Position)', 'កម្រិតបណ្តុះបណ្តាល (Training Level)',
      'ឯកទេសទី១ (Specialization 1)', 'ឯកទេសទី២ (Specialization 2)',
      'បំណែងចែកភារកិច្ច (Task Assignment)', 'ភារកិច្ចបន្ថែម (Additional Duties)',
      'សញ្ញាបត្រចុងក្រោយ (Highest Degree)', 'ឯកទេសសញ្ញាបត្រ (Degree Major)',
      'មុខវិជ្ជាទី១ (Subject 1)', 'ម៉ោង/សប្តាហ៍ទី១ (Hours 1)',
      'មុខវិជ្ជាទី២ (Subject 2)', 'ម៉ោង/សប្តាហ៍ទី២ (Hours 2)',
      'មុខវិជ្ជាទី៣ (Subject 3)', 'ម៉ោង/សប្តាហ៍ទី៣ (Hours 3)',
      'លេខទូរសព្ទទី១ (Phone 1)', 'លេខទូរសព្ទទី២ (Phone 2)', 'តេឡេក្រាម (Telegram)', 'អ៊ីមែល (Email)', 'ផ្សេងៗ (Notes)'
    ];
    const teacherRows = (rawData.teachers || []).map((t, idx) => [
      t.status || 'Active',
      idx + 1,
      t.photoBlob || t.photo ? '(Photo attached)' : '',
      t.teacherId || t.id || '',
      t.civilServantId || '',
      t.nationalId || '',
      t.lastNameKhmer || t.lastNameKh || '',
      t.firstNameKhmer || t.firstNameKh || '',
      t.lastNameLatin || '',
      t.firstNameLatin || '',
      t.gender || '',
      formatDisplayDate(t.dob || t.dateOfBirth) || '',
      t.age !== undefined && t.age !== '' ? t.age : '',
      formatDisplayDate(t.joinedDate) || '',
      formatDisplayDate(t.retirementDate) || '',
      t.birthVillage || '',
      t.birthCommune || '',
      t.birthDistrict || '',
      t.birthProvince || '',
      t.currentVillage || '',
      t.currentCommune || '',
      t.currentDistrict || '',
      t.currentProvince || '',
      t.workStatus || '',
      t.framework || '',
      t.rankAndGrade || '',
      t.position || '',
      t.trainingLevel || '',
      t.specialization1 || '',
      t.specialization2 || '',
      t.taskAssignment || '',
      t.additionalDuties || '',
      t.highestDegree || '',
      t.highestDegreeMajor || '',
      t.subject1 || t.subject || '',
      t.hoursPerWeek1 !== undefined ? t.hoursPerWeek1 : '',
      t.subject2 || '',
      t.hoursPerWeek2 !== undefined ? t.hoursPerWeek2 : '',
      t.subject3 || '',
      t.hoursPerWeek3 !== undefined ? t.hoursPerWeek3 : '',
      t.phone1 || t.phone || '',
      t.phone2 || '',
      t.telegram || '',
      t.email || '',
      t.notes || ''
    ]);
    createStyledWorksheet('teachers', teacherHeaders, teacherRows, new Set([1, 2, 4, 5, 6, 11, 12, 13, 14, 15, 36, 38, 40]));

    // 5. Attendance tab
    const attendanceHeaders = [
      'ល.រ (No.)', 'កូដសម្គាល់ (ID)', 'អត្តលេខសិស្ស (Student ID)',
      'ថ្នាក់ (Class ID)', 'កាលបរិច្ឆេទ (Date)', 'វេន (Session)', 'ស្ថានភាព (Status)', 'មូលហេតុ (Reason)'
    ];
    const attendanceRows = (rawData.attendance || []).map((att, idx) => [
      idx + 1,
      att.id || '',
      att.studentId || '',
      att.classId || '',
      att.date || '',
      att.session || '',
      att.status || '',
      att.reason || ''
    ]);
    createStyledWorksheet('attendance', attendanceHeaders, attendanceRows, new Set([1, 2, 3, 4, 5, 6, 7]));

    // 6. Scores tab
    const scoreHeaders = [
      'ល.រ (No.)', 'កូដសម្គាល់ (ID)', 'អត្តលេខសិស្ស (Student ID)',
      'មុខវិជ្ជា (Subject ID)', 'ថ្នាក់ (Class ID)', 'ខែ (Month)', 'ឆមាស (Semester)',
      'ឆ្នាំសិក្សា (Academic Year)', 'ពិន្ទុ (Score)', 'ប្រភេទប្រឡង (Exam Type)'
    ];
    const scoreRows = (rawData.scores || []).map((scr, idx) => [
      idx + 1,
      scr.id || '',
      scr.studentId || '',
      scr.subjectId || '',
      scr.classId || '',
      scr.month || '',
      scr.semester || '',
      scr.academicYear || '',
      scr.score !== undefined && scr.score !== null ? scr.score : '',
      scr.examType || ''
    ]);
    createStyledWorksheet('scores', scoreHeaders, scoreRows, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));

    return await workbook.xlsx.writeBuffer();
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 60000);
  },

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },

  getFormattedTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}${min}${ss}`;
  },

  formatFileDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch {
      return dateStr;
    }
  }
};
