/**
 * Admin User Accounts & Permissions Management Page
 * Includes:
 * 1. User Accounts Table & Modal (Create, Edit, Disable, Delete, Classroom assignment)
 * 2. Role Permissions Management Matrix (Section 6 & 7: Checkbox grid for Director & Teacher)
 * 3. Security Audit Logs (Section 22: Activity history from IndexedDB activityLogs)
 */
import { authService } from '../services/authService.js';
import { UserService } from '../services/userService.js';
import { permissionService, MENU_KEYS } from '../services/permissionService.js';
import { db } from '../database/db.js';
import { i18n, t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { SyncService } from '../services/syncService.js';
import { AdminDataService } from '../services/adminDataService.js';
import { renderActionDropdown } from '../components/actionDropdown.js';

export const UsersPage = {
  users: [],
  classes: [],
  auditLogs: [],
  permissions: null,
  activeTab: 'tab-accounts',
  searchQuery: '',
  roleFilter: 'all',
  statusFilter: 'all',
  container: null,

  async render(container) {
    this.container = container;

    // Multi-level security: Verify role
    if (!authService.isAdmin()) {
      this.renderAccessDenied(container);
      return;
    }

    try {
      this.classes = await db.getAll('classes');
      this.users = await UserService.getAll();
      this.permissions = await permissionService.getAll();
      this.auditLogs = (await db.getAll('activityLogs')).reverse();
    } catch (err) {
      console.error('Failed to load users data:', err);
      toast.error('Failed to load user accounts or permissions.');
    }

    const currentLocale = i18n.getLocale();
    const isKm = currentLocale === 'km';

    container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12 select-none">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div class="flex items-center gap-2">
              <span class="p-2 rounded-lg bg-primary/10 text-primary">
                ${getIcon('users', 'w-5 h-5')}
              </span>
              <h1 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
                ${isKm ? 'គ្រប់គ្រងគណនី & សិទ្ធិប្រើប្រាស់' : 'Account & Permission Management'}
              </h1>
            </div>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1">
              ${isKm 
                ? 'គ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ បែងចែកបន្ទប់រៀន និងកំណត់សិទ្ធិម៉ឺនុយសម្រាប់តួនាទី Director & Teacher'
                : 'Manage user accounts, assign classrooms, and configure sidebar menu permissions for Director & Teacher.'}
            </p>
          </div>

          <!-- Action Buttons (Only on Accounts tab) -->
          <div id="users-header-actions" class="${this.activeTab === 'tab-accounts' ? 'flex' : 'hidden'} items-center gap-2 flex-wrap self-start sm:self-auto">
            <!-- Sync to Admin Sheet Button -->
            <button id="btn-users-save-sheet" 
                    type="button"
                    title="${isKm ? 'រក្សាទុកគណនី និងសិទ្ធិទាំងអស់ទៅកាន់ Google Sheet' : 'Save all user accounts and permissions to Google Sheet'}"
                    class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer">
              ${getIcon('cloudUpload', 'w-4 h-4')}
              <span>${isKm ? 'Sync ទៅ Sheet' : 'Save to Sheet'}</span>
            </button>

            <!-- Pull from Admin Sheet Button -->
            <button id="btn-users-pull-sheet" 
                    type="button"
                    title="${isKm ? 'ទាញគណនី និងសិទ្ធិពី Google Sheet' : 'Pull user accounts from Google Sheet'}"
                    class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer">
              ${getIcon('cloudDownload', 'w-4 h-4 text-primary')}
              <span>${isKm ? 'ទាញពី Sheet' : 'Pull from Sheet'}</span>
            </button>

            <!-- Reset Button (Admin Options) -->
            <button id="btn-admin-reset" 
                    type="button"
                    title="${isKm ? 'កំណត់គណនី ឬកម្មវិធីឡើងវិញ' : 'Reset default accounts or reset full app'}"
                    class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer">
              ${getIcon('rotateCcw', 'w-4 h-4 text-destructive')}
              <span>${isKm ? 'កំណត់ឡើងវិញ' : 'Reset'}</span>
            </button>

            <!-- Add User Button -->
            <button id="btn-add-user" 
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${isKm ? 'បង្កើតគណនីថ្មី' : 'Add New User'}</span>
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="p-1 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-1.5 overflow-x-auto text-xs sm:text-sm font-medium" id="users-page-tabs">
          <button data-target-tab="tab-accounts" 
                  class="tab-btn px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 cursor-pointer ${this.activeTab === 'tab-accounts' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}">
            ${getIcon('user', 'w-4 h-4')}
            <span>${isKm ? 'គណនីអ្នកប្រើប្រាស់' : 'User Accounts'}</span>
            <span class="tab-badge px-1.5 py-0.5 rounded-full ${this.activeTab === 'tab-accounts' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'} text-[10px] font-semibold">${this.users.length}</span>
          </button>

          <button data-target-tab="tab-permissions" 
                  class="tab-btn px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 cursor-pointer ${this.activeTab === 'tab-permissions' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}">
            ${getIcon('lock', 'w-4 h-4')}
            <span>${isKm ? 'ម៉ាទ្រីសសិទ្ធិប្រើប្រាស់' : 'Role Permissions Matrix'}</span>
          </button>

          <button data-target-tab="tab-logs" 
                  class="tab-btn px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 cursor-pointer ${this.activeTab === 'tab-logs' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}">
            ${getIcon('clock', 'w-4 h-4')}
            <span>${isKm ? 'កំណត់ត្រាសុវត្ថិភាព' : 'Security Audit Logs'}</span>
            <span class="tab-badge px-1.5 py-0.5 rounded-full ${this.activeTab === 'tab-logs' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'} text-[10px] font-semibold">${this.auditLogs.length}</span>
          </button>
        </div>

        <!-- TAB 1: USER ACCOUNTS -->
        <div id="tab-accounts" class="tab-content ${this.activeTab === 'tab-accounts' ? '' : 'hidden'} space-y-4">
          <!-- Filter & Search Toolbar -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
            <!-- Search input -->
            <div class="relative w-full sm:w-80">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                ${getIcon('search', 'w-4 h-4')}
              </span>
              <input type="text" 
                     id="user-search-input" 
                     value="${this.searchQuery}"
                     placeholder="${isKm ? 'ស្វែងរកតាមឈ្មោះ ឬឈ្មោះអ្នកប្រើ...' : 'Search by name or username...'}"
                     class="w-full h-9 pl-10 pr-3 py-1.5 bg-background border border-input rounded-md text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border shadow-xs" />
            </div>

            <!-- Role & Status Dropdowns -->
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <select id="user-role-filter" 
                      class="h-9 px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border shadow-xs">
                <option value="all" ${this.roleFilter === 'all' ? 'selected' : ''}>${isKm ? 'គ្រប់តួនាទី' : 'All Roles'}</option>
                <option value="ADMIN" ${this.roleFilter === 'ADMIN' ? 'selected' : ''}>Admin</option>
                <option value="DIRECTOR" ${this.roleFilter === 'DIRECTOR' ? 'selected' : ''}>Director</option>
                <option value="TEACHER" ${this.roleFilter === 'TEACHER' ? 'selected' : ''}>Teacher</option>
              </select>

              <select id="user-status-filter" 
                      class="h-9 px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border shadow-xs">
                <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>${isKm ? 'គ្រប់ស្ថានភាព' : 'All Status'}</option>
                <option value="ACTIVE" ${this.statusFilter === 'ACTIVE' ? 'selected' : ''}>${isKm ? 'សកម្ម' : 'Active'}</option>
                <option value="DISABLED" ${this.statusFilter === 'DISABLED' ? 'selected' : ''}>${isKm ? 'ត្រូវបានផ្អាក' : 'Disabled'}</option>
              </select>
            </div>
          </div>

          <!-- Users Data Table -->
          <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs sm:text-sm">
                <thead class="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th class="px-4 py-3">ID</th>
                    <th class="px-4 py-3">${isKm ? 'ឈ្មោះ & ឈ្មោះគណនី' : 'Name & Username'}</th>
                    <th class="px-4 py-3">${isKm ? 'តួនាទី' : 'Role'}</th>
                    <th class="px-4 py-3">${isKm ? 'ស្ថានភាព' : 'Status'}</th>
                    <th class="px-4 py-3">${isKm ? 'ការចូលចុងក្រោយ' : 'Last Login'}</th>
                    <th class="w-[50px] px-2 py-3 text-center">${isKm ? 'សកម្មភាព' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody id="users-table-body" class="divide-y divide-border">
                  ${this.renderTableRows()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB 2: ROLE PERMISSIONS MATRIX (Sections 6 & 7) -->
        <div id="tab-permissions" class="tab-content ${this.activeTab === 'tab-permissions' ? '' : 'hidden'} space-y-6">
          <div class="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h3 class="text-base font-semibold text-foreground tracking-tight">
                  ${isKm ? 'កំណត់សិទ្ធិម៉ឺនុយសម្រាប់តួនាទីនីមួយៗ' : 'Sidebar Menu Access Matrix'}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  ${isKm 
                    ? 'គ្រប់គ្រងម៉ឺនុយសិក្សាដែល Director និង Teacher អាចមើលឃើញ និងចូលប្រើប្រាស់បាន។ Admin ត្រូវបានកំណត់សម្រាប់តែការគ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ប៉ុណ្ណោះ។' 
                    : 'Control which academic navigation menus are accessible to Director and Teacher roles. Admin is dedicated exclusively to administrative user management.'}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button id="btn-reset-perms" type="button" class="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  ${isKm ? 'កំណត់លំនាំដើមឡើងវិញ' : 'Reset Defaults'}
                </button>
                <button id="btn-save-perms" type="button" class="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-all cursor-pointer">
                  ${getIcon('check', 'w-4 h-4')}
                  <span>${isKm ? 'រក្សាទុកការកំណត់' : 'Save Permissions'}</span>
                </button>
              </div>
            </div>

            <!-- Permission Checkbox Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs sm:text-sm">
                <thead class="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th class="px-4 py-3">${isKm ? 'ឈ្មោះម៉ឺនុយ (Navigation Menu)' : 'Navigation Menu'}</th>
                    <th class="px-4 py-3 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        ADMIN
                      </span>
                    </th>
                    <th class="px-4 py-3 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        DIRECTOR
                      </span>
                    </th>
                    <th class="px-4 py-3 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        TEACHER
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border" id="permissions-matrix-tbody">
                  ${this.renderPermissionsMatrixRows()}
                </tbody>
              </table>
            </div>

            <div class="p-3.5 rounded-lg bg-muted/40 border border-border/80 flex items-center gap-2.5 text-xs text-muted-foreground">
              ${getIcon('lock', 'w-4 h-4 text-primary flex-shrink-0')}
              <span>
                ${isKm 
                  ? 'ការផ្លាស់ប្តូរសិទ្ធិត្រូវបានរក្សាទុកក្នុង IndexedDB និងមានប្រសិទ្ធភាពភ្លាមៗចំពោះរបារចំហៀង និង Route Guard ។' 
                  : 'Permission changes persist in IndexedDB and take effect immediately across sidebar menus and client route guards.'}
              </span>
            </div>
          </div>
        </div>

        <!-- TAB 3: AUDIT LOGS (Section 22) -->
        <div id="tab-logs" class="tab-content ${this.activeTab === 'tab-logs' ? '' : 'hidden'} space-y-4">
          <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div class="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-foreground">${isKm ? 'កំណត់ត្រាសកម្មភាព និងសុវត្ថិភាព' : 'System Security & Activity Trail'}</h3>
                <p class="text-xs text-muted-foreground">${isKm ? 'តាមដានរាល់ការបង្កើតគណនី ការលុប ការប្តូរសិទ្ធិ និងការចូលប្រើប្រាស់' : 'Track account creations, status updates, permission modifications, and security events.'}</p>
              </div>
              <button id="btn-refresh-logs" class="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Refresh Logs">
                ${getIcon('rotateCw', 'w-4 h-4')}
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs sm:text-sm">
                <thead class="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th class="px-4 py-3">${isKm ? 'កាលបរិច្ឆេទ & ម៉ោង' : 'Timestamp'}</th>
                    <th class="px-4 py-3">${isKm ? 'សកម្មភាព' : 'Action'}</th>
                    <th class="px-4 py-3">${isKm ? 'ព័ត៌មានលម្អិត' : 'Event Details'}</th>
                  </tr>
                </thead>
                <tbody id="logs-table-body" class="divide-y divide-border">
                  ${this.renderAuditLogRows()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderPermissionsMatrixRows() {
    const isKm = i18n.getLocale() === 'km';
    const directorPerms = this.permissions?.DIRECTOR || {};
    const teacherPerms = this.permissions?.TEACHER || {};

    const menuLabels = {
      dashboard: isKm ? 'ផ្ទាំងព័ត៌មាន' : 'Dashboard',
      registration: isKm ? 'ចុះឈ្មោះសិស្សថ្មី' : 'Admissions & Registration',
      promotion: isKm ? 'កំណត់សិស្សឡើងថ្នាក់' : 'Yearly Promotion',
      schools: isKm ? 'គ្រប់គ្រងសាលារៀន' : 'Schools Management',
      classes: isKm ? 'គ្រប់គ្រងថ្នាក់រៀន' : 'Classes Management',
      teachers: isKm ? 'គ្រប់គ្រងគ្រូបង្រៀន' : 'Teachers Directory',
      students: isKm ? 'គ្រប់គ្រងសិស្ស' : 'Students Management',
      attendance: isKm ? 'កត់ត្រាវត្តមាន' : 'Attendance Roll-Call',
      scores: isKm ? 'ពិន្ទុ និងការវាយតម្លៃ' : 'Scores & Grading',
      reports: isKm ? 'មជ្ឈមណ្ឌលរបាយការណ៍' : 'Reports & Printouts',
      settings: isKm ? 'ការកំណត់ប្រព័ន្ធ' : 'System Settings'
    };

    const academicRows = MENU_KEYS.map(key => {
      const isDirectorChecked = directorPerms[key] !== false;
      const isTeacherChecked = Boolean(teacherPerms[key]);

      return `
        <tr class="hover:bg-muted/40 transition-colors">
          <td class="px-4 py-3.5 font-medium text-foreground flex items-center gap-2">
            ${getIcon(key, 'w-4 h-4 text-muted-foreground')}
            <span>${menuLabels[key] || key}</span>
          </td>
          <!-- Admin (Academic & school menus restricted; Settings & Users accessible) -->
          <td class="px-4 py-3.5 text-center">
            ${(key === 'settings')
              ? `<div class="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs" title="Privilege">✓</div>`
              : `<span class="text-xs text-muted-foreground font-mono" title="Academic & school menu restricted from Admin role">—</span>`
            }
          </td>
          <!-- Director Checkbox -->
          <td class="px-4 py-3.5 text-center">
            <input type="checkbox" 
                   class="perm-checkbox rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                   data-role="DIRECTOR" 
                   data-key="${key}"
                   ${isDirectorChecked ? 'checked' : ''} />
          </td>
          <!-- Teacher Checkbox -->
          <td class="px-4 py-3.5 text-center">
            <input type="checkbox" 
                   class="perm-checkbox rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                   data-role="TEACHER" 
                   data-key="${key}"
                   ${isTeacherChecked ? 'checked' : ''} />
          </td>
        </tr>
      `;
    }).join('');

    const usersRow = `
      <tr class="hover:bg-muted/40 transition-colors bg-primary/5">
        <td class="px-4 py-3.5 font-semibold text-foreground flex items-center gap-2">
          ${getIcon('users', 'w-4 h-4 text-primary')}
          <span>${isKm ? 'គ្រប់គ្រងគណនី' : 'User Accounts & Access'}</span>
        </td>
        <!-- Admin (Dedicated privilege) -->
        <td class="px-4 py-3.5 text-center">
          <div class="inline-flex items-center justify-center w-6 h-6 rounded bg-rose-500/10 text-rose-500 font-bold text-xs" title="Permanent Admin Privilege">
            ✓
          </div>
        </td>
        <!-- Director (Restricted) -->
        <td class="px-4 py-3.5 text-center">
          <span class="text-xs text-muted-foreground font-mono" title="Admin only">—</span>
        </td>
        <!-- Teacher (Restricted) -->
        <td class="px-4 py-3.5 text-center">
          <span class="text-xs text-muted-foreground font-mono" title="Admin only">—</span>
        </td>
      </tr>
    `;

    return usersRow + academicRows;
  },

  renderAuditLogRows() {
    const isKm = i18n.getLocale() === 'km';
    if (!this.auditLogs || this.auditLogs.length === 0) {
      return `
        <tr>
          <td colspan="3" class="px-4 py-8 text-center text-muted-foreground">
            ${isKm ? 'មិនទាន់មានកំណត់ត្រាសកម្មភាពនៅឡើយទេ' : 'No activity logs recorded yet.'}
          </td>
        </tr>
      `;
    }

    return this.auditLogs.slice(0, 50).map(log => {
      const dateStr = new Date(log.timestamp).toLocaleString();
      let badgeClass = 'bg-primary/10 text-primary border-primary/20';
      if (log.action.includes('DELETE')) badgeClass = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      else if (log.action.includes('CREATE')) badgeClass = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      else if (log.action.includes('PERMISSIONS')) badgeClass = 'bg-purple-500/10 text-purple-500 border-purple-500/20';

      return `
        <tr class="hover:bg-muted/40 transition-colors">
          <td class="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">${dateStr}</td>
          <td class="px-4 py-2.5 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${badgeClass}">
              ${log.action}
            </span>
          </td>
          <td class="px-4 py-2.5 text-xs text-foreground">${log.details || log.description || '—'}</td>
        </tr>
      `;
    }).join('');
  },

  renderTableRows() {
    const isKm = i18n.getLocale() === 'km';
    let filtered = [...this.users];

    // Search filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(u => 
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      );
    }

    // Role filter
    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === this.roleFilter);
    }

    // Status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(u => u.status === this.statusFilter);
    }

    if (filtered.length === 0) {
      return `
        <tr>
          <td colspan="6" class="px-4 py-12 text-center text-muted-foreground">
            <div class="flex flex-col items-center justify-center gap-2">
              ${getIcon('users', 'w-8 h-8 text-muted-foreground/50')}
              <p class="font-medium">${isKm ? 'រកមិនឃើញគណនីអ្នកប្រើប្រាស់ទេ' : 'No user accounts found'}</p>
            </div>
          </td>
        </tr>
      `;
    }

    return filtered.map(u => {
      let roleBadge = '';
      if (u.role === 'ADMIN') {
        roleBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">ADMIN</span>`;
      } else if (u.role === 'DIRECTOR') {
        roleBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">DIRECTOR</span>`;
      } else {
        roleBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">TEACHER</span>`;
      }

      const statusBadge = u.status === 'ACTIVE'
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
             <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${isKm ? 'សកម្ម' : 'Active'}
           </span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-500 border border-red-500/20">
             <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> ${isKm ? 'ផ្អាក' : 'Disabled'}
           </span>`;

      const lastLoginStr = u.lastLogin 
        ? new Date(u.lastLogin).toLocaleDateString() + ' ' + new Date(u.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '<span class="text-muted-foreground">—</span>';

      return `
        <tr class="hover:bg-muted/40 transition-colors">
          <td class="px-4 py-3 font-mono text-xs text-muted-foreground">${u.id}</td>
          <td class="px-4 py-3">
            <div class="font-semibold text-foreground">${u.displayName}</div>
            <div class="text-[11px] text-muted-foreground">@${u.username}</div>
          </td>
          <td class="px-4 py-3">${roleBadge}</td>
          <td class="px-4 py-3">${statusBadge}</td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${lastLoginStr}</td>
          <td class="w-[50px] px-2 py-2 text-center">
            ${renderActionDropdown({
              id: u.id,
              title: isKm ? 'ជម្រើសសកម្មភាព' : 'Actions',
              actions: [
                {
                  label: isKm ? 'កញ្ចប់ទិន្នន័យ' : 'Config Package',
                  icon: 'download',
                  show: (u.role === 'DIRECTOR' || u.role === 'TEACHER'),
                  onClick: async () => {
                    try {
                      if (u.role === 'DIRECTOR') {
                        await SyncService.generateDirectorPackage(u);
                        toast.success(isKm ? 'បានបង្កើតកញ្ចប់ទិន្នន័យនាយកដោយជោគជ័យ' : 'Director config package generated successfully!');
                      } else if (u.role === 'TEACHER') {
                        await SyncService.generateTeacherPackage(u);
                        toast.success(isKm ? 'បានបង្កើតកញ្ចប់ទិន្នន័យគ្រូបង្រៀនដោយជោគជ័យ' : 'Teacher config package generated successfully!');
                      }
                      await this.reload();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }
                },
                {
                  label: isKm ? 'កែប្រែគណនី' : 'Edit Account',
                  icon: 'keyRound',
                  onClick: () => this.openUserModal(u)
                },
                {
                  label: u.status === 'ACTIVE' 
                    ? (isKm ? 'ផ្អាកគណនី' : 'Disable') 
                    : (isKm ? 'បើកដំណើរការ' : 'Enable'),
                  icon: u.status === 'ACTIVE' ? 'lock' : 'check',
                  onClick: async () => {
                    try {
                      const newStatus = await UserService.toggleStatus(u.id);
                      toast.success(
                        newStatus === 'ACTIVE' 
                          ? (isKm ? 'គណនីត្រូវបានបើកដំណើរការឡើងវិញ' : 'Account activated.') 
                          : (isKm ? 'គណនីត្រូវបានផ្អាក' : 'Account disabled.')
                      );
                      await this.reload();
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }
                },
                {
                  label: isKm ? 'លុបគណនី' : 'Delete',
                  icon: 'trash2',
                  destructive: true,
                  onClick: () => this.confirmDelete(u)
                }
              ]
            })}
          </td>
        </tr>
      `;
    }).join('');
  },

  bindEvents() {
    const isKm = i18n.getLocale() === 'km';

    // Tabs navigation
    this.container.querySelectorAll('button[data-target-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target-tab');
        this.activeTab = target;

        // Toggle tab buttons
        this.container.querySelectorAll('button[data-target-tab]').forEach(b => {
          const isSelected = b.getAttribute('data-target-tab') === target;
          b.className = `tab-btn px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 cursor-pointer ${
            isSelected 
              ? 'bg-primary text-primary-foreground shadow-xs' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`;
          const badge = b.querySelector('.tab-badge');
          if (badge) {
            badge.className = `tab-badge px-1.5 py-0.5 rounded-full ${
              isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
            } text-[10px] font-semibold`;
          }
        });

        // Toggle tab panes
        this.container.querySelectorAll('.tab-content').forEach(pane => {
          pane.classList.toggle('hidden', pane.id !== target);
        });

        // Toggle action buttons container in header
        const headerActions = document.getElementById('users-header-actions');
        const isAccountsTab = target === 'tab-accounts';
        if (headerActions) {
          headerActions.classList.toggle('hidden', !isAccountsTab);
          headerActions.classList.toggle('flex', isAccountsTab);
        }
      });
    });

    // Sync to Admin Sheet Button Click
    const saveSheetBtn = document.getElementById('btn-users-save-sheet');
    saveSheetBtn?.addEventListener('click', async () => {
      saveSheetBtn.disabled = true;
      const originalHtml = saveSheetBtn.innerHTML;
      saveSheetBtn.innerHTML = `
        <div class="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>${isKm ? 'កំពុង Sync...' : 'Syncing...'}</span>
      `;
      try {
        const res = await AdminDataService.saveToGoogleSheet({ silent: false });
        if (res.success) {
          await this.reload();
        }
      } finally {
        saveSheetBtn.disabled = false;
        saveSheetBtn.innerHTML = originalHtml;
      }
    });

    // Pull from Admin Sheet Button Click
    const pullSheetBtn = document.getElementById('btn-users-pull-sheet');
    pullSheetBtn?.addEventListener('click', async () => {
      pullSheetBtn.disabled = true;
      const originalHtml = pullSheetBtn.innerHTML;
      pullSheetBtn.innerHTML = `
        <div class="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>${isKm ? 'កំពុងទាញ...' : 'Pulling...'}</span>
      `;
      try {
        const res = await AdminDataService.pullFromGoogleSheet({ silent: false });
        if (res.success) {
          await this.reload();
        }
      } finally {
        pullSheetBtn.disabled = false;
        pullSheetBtn.innerHTML = originalHtml;
      }
    });

    // Admin Reset Button Click
    const adminResetBtn = document.getElementById('btn-admin-reset');
    adminResetBtn?.addEventListener('click', () => {
      this.openAdminResetModal();
    });

    // Save permissions button
    document.getElementById('btn-save-perms')?.addEventListener('click', async () => {
      const directorPerms = {};
      const teacherPerms = {};

      this.container.querySelectorAll('.perm-checkbox').forEach(cb => {
        const role = cb.getAttribute('data-role');
        const key = cb.getAttribute('data-key');
        if (role === 'DIRECTOR') directorPerms[key] = cb.checked;
        if (role === 'TEACHER') teacherPerms[key] = cb.checked;
      });

      try {
        await permissionService.savePermissions({
          DIRECTOR: directorPerms,
          TEACHER: teacherPerms
        });
        toast.success(
          isKm 
            ? 'សិទ្ធិប្រើប្រាស់ត្រូវបានរក្សាទុកដោយជោគជ័យ! របារចំហៀងត្រូវបានធ្វើបច្ចុប្បន្នភាព។' 
            : 'Role permissions saved successfully! Dynamic sidebar updated.'
        );
      } catch (err) {
        toast.error('Failed to save permissions: ' + err.message);
      }
    });

    // Reset defaults button
    document.getElementById('btn-reset-perms')?.addEventListener('click', async () => {
      try {
        await permissionService.resetDefaults();
        this.permissions = await permissionService.getAll();
        const tbody = document.getElementById('permissions-matrix-tbody');
        if (tbody) tbody.innerHTML = this.renderPermissionsMatrixRows();
        toast.success(isKm ? 'បានកំណត់សិទ្ធិលំនាំដើមឡើងវិញ' : 'Permissions reset to defaults.');
      } catch (err) {
        toast.error(err.message);
      }
    });

    // Refresh logs button
    document.getElementById('btn-refresh-logs')?.addEventListener('click', async () => {
      this.auditLogs = (await db.getAll('activityLogs')).reverse();
      const logsBody = document.getElementById('logs-table-body');
      if (logsBody) logsBody.innerHTML = this.renderAuditLogRows();
      toast.info('Audit logs refreshed.');
    });

    // Add User button
    document.getElementById('btn-add-user')?.addEventListener('click', () => {
      this.openUserModal();
    });

    // Search input
    const searchInput = document.getElementById('user-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.refreshTable();
    });

    // Role filter
    const roleFilter = document.getElementById('user-role-filter');
    roleFilter?.addEventListener('change', (e) => {
      this.roleFilter = e.target.value;
      this.refreshTable();
    });

    // Status filter
    const statusFilter = document.getElementById('user-status-filter');
    statusFilter?.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.refreshTable();
    });

    // Table action buttons
    const tbody = document.getElementById('users-table-body');
    tbody?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const user = this.users.find(u => u.id === id);
      if (!user) return;

      if (action === 'edit') {
        this.openUserModal(user);
      } else if (action === 'export-package') {
        try {
          if (user.role === 'DIRECTOR') {
            await SyncService.generateDirectorPackage(user);
            toast.success(isKm ? 'បានបង្កើតកញ្ចប់ទិន្នន័យនាយកដោយជោគជ័យ' : 'Director config package generated successfully!');
          } else if (user.role === 'TEACHER') {
            await SyncService.generateTeacherPackage(user);
            toast.success(isKm ? 'បានបង្កើតកញ្ចប់ទិន្នន័យគ្រូបង្រៀនដោយជោគជ័យ' : 'Teacher config package generated successfully!');
          }
          await this.reload();
        } catch (err) {
          toast.error(err.message);
        }
      } else if (action === 'toggle-status') {
        try {
          const newStatus = await UserService.toggleStatus(id);
          toast.success(
            newStatus === 'ACTIVE' 
              ? (isKm ? 'គណនីត្រូវបានបើកដំណើរការឡើងវិញ' : 'Account activated.') 
              : (isKm ? 'គណនីត្រូវបានផ្អាក' : 'Account disabled.')
          );
          await this.reload();
        } catch (err) {
          toast.error(err.message);
        }
      } else if (action === 'delete') {
        this.confirmDelete(user);
      }
    });
  },

  refreshTable() {
    const tbody = document.getElementById('users-table-body');
    if (tbody) {
      tbody.innerHTML = this.renderTableRows();
    }
  },

  async reload() {
    this.users = await UserService.getAll();
    this.refreshTable();
    try {
      this.auditLogs = (await db.getAll('activityLogs')).reverse();
      const logsBody = document.getElementById('logs-table-body');
      if (logsBody) logsBody.innerHTML = this.renderAuditLogRows();
      const usersBadge = document.querySelector('button[data-target-tab="tab-accounts"] span span:last-child');
      if (usersBadge) usersBadge.textContent = this.users.length;
      const logsBadge = document.querySelector('button[data-target-tab="tab-logs"] span span:last-child');
      if (logsBadge) logsBadge.textContent = this.auditLogs.length;
    } catch (e) {
      console.warn('Error refreshing stats on reload:', e);
    }
  },

  async openUserModal(userToEdit = null) {
    const isKm = i18n.getLocale() === 'km';
    const isEdit = Boolean(userToEdit);

    const content = `
      <form id="user-form" class="space-y-4 text-xs sm:text-sm">
        <!-- Display Name -->
        <div>
          <label class="block font-semibold text-foreground mb-1">
            ${isKm ? 'ឈ្មោះពេញ' : 'Full Display Name'} *
          </label>
          <input type="text" id="modal-user-name" required
                 value="${userToEdit ? userToEdit.displayName : ''}"
                 placeholder="${isKm ? 'ឧទាហរណ៍៖ សុក សុផល' : 'e.g. Sok Sophal'}"
                 class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
        </div>

        <!-- Username -->
        <div>
          <label class="block font-semibold text-foreground mb-1">
            ${isKm ? 'ឈ្មោះគណនី' : 'Username'} *
          </label>
          <input type="text" id="modal-user-username" required
                 ${isEdit ? 'disabled' : ''}
                 value="${userToEdit ? userToEdit.username : ''}"
                 placeholder="${isKm ? 'ឧទាហរណ៍៖ teacher03' : 'e.g. teacher03'}"
                 class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs disabled:opacity-60 disabled:cursor-not-allowed" />
        </div>

        <!-- Role Selector -->
        <div>
          <label class="block font-semibold text-foreground mb-1">
            ${isKm ? 'តួនាទី' : 'Role'} *
          </label>
          <select id="modal-user-role" 
                  class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs">
            <option value="TEACHER" ${userToEdit?.role === 'TEACHER' ? 'selected' : (!isEdit ? 'selected' : '')}>Teacher</option>
            <option value="DIRECTOR" ${userToEdit?.role === 'DIRECTOR' ? 'selected' : ''}>Director</option>
            <option value="ADMIN" ${userToEdit?.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
          </select>
        </div>

        <!-- Password -->
        <div>
          <label class="block font-semibold text-foreground mb-1">
            ${isEdit ? (isKm ? 'ពាក្យសម្ងាត់ថ្មី (ទុកទទេបើមិនចង់ប្តូរ)' : 'New Password (leave blank to keep current)') : (isKm ? 'ពាក្យសម្ងាត់' : 'Password')} ${isEdit ? '' : '*'}
          </label>
          <input type="password" id="modal-user-password" 
                 ${isEdit ? '' : 'required'}
                 placeholder="••••••••"
                 class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
        </div>

        <!-- Confirm Password -->
        <div>
          <label class="block font-semibold text-foreground mb-1">
            ${isKm ? 'បញ្ជាក់ពាក្យសម្ងាត់' : 'Confirm Password'} ${isEdit ? '' : '*'}
          </label>
          <input type="password" id="modal-user-confirm-password" 
                 ${isEdit ? '' : 'required'}
                 placeholder="••••••••"
                 class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
        </div>

        <!-- Create Drive File Info -->
        ${!isEdit ? `
          <div class="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2.5 text-xs select-none">
            <span class="text-primary mt-0.5">${getIcon('fileSpreadsheet', 'w-4 h-4')}</span>
            <div class="flex-1">
              <span class="font-semibold text-foreground">
                ${isKm ? 'បង្កើតឯកសារ Google Sheet ក្នុង Drive ដោយស្វ័យប្រវត្តិ' : 'Auto-create Google Sheet in Drive'}
              </span>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                ${isKm 
                  ? 'ឯកសារ <code>SchoolWorkspace_&lt;username&gt;</code> នឹងត្រូវបានបង្កើតក្នុង Google Drive ភ្លាមៗ។'
                  : 'A <code>SchoolWorkspace_&lt;username&gt;</code> spreadsheet will be created in Google Drive immediately.'}
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Error banner in modal -->
        <div id="modal-form-error" class="hidden p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs"></div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-4 border-t border-border">
          <button type="button" id="btn-modal-cancel" 
                  class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-foreground font-medium transition-colors cursor-pointer">
            ${isKm ? 'បោះបង់' : 'Cancel'}
          </button>
          <button type="submit" id="btn-modal-save" 
                  class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all cursor-pointer">
            ${isKm ? 'រក្សាទុក' : 'Save Account'}
          </button>
        </div>
      </form>
    `;

    const modal = Modal.open({
      title: isEdit 
        ? (isKm ? 'កែប្រែគណនីអ្នកប្រើប្រាស់' : 'Edit User Account') 
        : (isKm ? 'បង្កើតគណនីអ្នកប្រើប្រាស់ថ្មី' : 'Create User Account'),
      content,
      maxWidth: 'max-w-lg'
    });

    const roleSelect = document.getElementById('modal-user-role');

    document.getElementById('btn-modal-cancel')?.addEventListener('click', () => modal.close());

    document.getElementById('user-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('modal-form-error');
      if (errBox) errBox.classList.add('hidden');

      const displayName = document.getElementById('modal-user-name')?.value || '';
      const username = document.getElementById('modal-user-username')?.value || '';
      const role = roleSelect?.value || 'TEACHER';
      const pass = document.getElementById('modal-user-password')?.value || '';
      const confirmPass = document.getElementById('modal-user-confirm-password')?.value || '';

      if (pass && pass !== confirmPass) {
        if (errBox) {
          errBox.textContent = isKm ? 'ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ' : 'Passwords do not match.';
          errBox.classList.remove('hidden');
        }
        return;
      }

      const saveBtn = document.getElementById('btn-modal-save');
      const cancelBtn = document.getElementById('btn-modal-cancel');

      try {
        if (isEdit) {
          await UserService.update(userToEdit.id, {
            displayName,
            role,
            password: pass || null
          });
          toast.success(isKm ? 'គណនីត្រូវបានកែប្រែដោយជោគជ័យ' : 'Account updated successfully.');
        } else {
          if (saveBtn) {
            saveBtn.disabled = true;
            if (cancelBtn) cancelBtn.disabled = true;
            saveBtn.innerHTML = `
              <span class="inline-flex items-center gap-1.5">
                ${getIcon('loader2', 'w-4 h-4 animate-spin')}
                <span>${isKm ? 'កំពុងបង្កើតគណនី និង Drive Sheet...' : 'Creating Account & Drive Sheet...'}</span>
              </span>
            `;
          }

          const createdUser = await UserService.create({
            displayName,
            username,
            password: pass,
            role
          });

          if (createdUser.driveFileCreated) {
            const msg = isKm 
              ? `បានបង្កើតគណនី @${username} និងឯកសារ ${createdUser.driveFileName} ក្នុង Google Drive ដោយជោគជ័យ!`
              : `Account @${username} and spreadsheet ${createdUser.driveFileName} created in Google Drive!`;
            if (createdUser.driveFileUrl) {
              toast.show({
                title: isKm ? 'បង្កើតគណនី & Drive Sheet' : 'Account & Drive Sheet Created',
                message: msg,
                type: 'success',
                duration: 9000,
                action: {
                  label: isKm ? 'បើកឯកសារ Drive' : 'Open in Drive',
                  onClick: () => {
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(createdUser.driveFileUrl);
                    } else {
                      window.open(createdUser.driveFileUrl, '_blank', 'noopener,noreferrer');
                    }
                  }
                }
              });
            } else {
              toast.success(msg, isKm ? 'ជោគជ័យ' : 'Success');
            }
          } else {
            toast.success(
              isKm ? 'បានបង្កើតគណនីថ្មីដោយជោគជ័យ' : 'Account created successfully.'
            );
          }
        }

        modal.close();
        await this.reload();
      } catch (err) {
        if (saveBtn) {
          saveBtn.disabled = false;
          if (cancelBtn) cancelBtn.disabled = false;
          saveBtn.innerHTML = isKm ? 'រក្សាទុក' : 'Save Account';
        }
        if (errBox) {
          errBox.textContent = err.message;
          errBox.classList.remove('hidden');
        }
      }
    });
  },

  confirmDelete(user) {
    const isKm = i18n.getLocale() === 'km';

    // Safeguard 1: Never allow deleting the primary Admin account
    if (user.role === 'ADMIN') {
      toast.error(
        isKm ? 'មិនអាចលុបគណនី Admin ចម្បងបានទេ។' : 'Cannot delete the primary Admin account.',
        isKm ? 'សកម្មភាពត្រូវបានហាមឃាត់' : 'Action Forbidden'
      );
      return;
    }

    const modalTitle = isKm ? 'លុបគណនី និងទិន្នន័យទាំងអស់?' : 'Permanently Delete Account & Data?';
    const warningText = isKm
      ? `សកម្មភាពនេះនឹងលុបគណនី <span class="font-bold text-foreground">@${user.username}</span> (${user.displayName || user.username}), ទិន្នន័យទាំងអស់ក្នុងម៉ាស៊ីន (Local DB) និងឯកសារ Google Sheet នៅក្នុង Google Drive ជាអចិន្ត្រៃយ៍។`
      : `This action will permanently delete user account <span class="font-bold text-foreground">@${user.username}</span> (${user.displayName || user.username}), all local database storage (Local DB), and the corresponding Google Sheet file in Google Drive.`;

    const contentHtml = `
      <div id="delete-modal-main-content" class="space-y-4">
        <div class="flex items-start gap-3 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
          <span class="p-1 rounded-md bg-destructive/20 text-destructive flex-shrink-0 mt-0.5">
            ${getIcon('alertTriangle', 'w-4 h-4')}
          </span>
          <div>
            <p class="font-semibold text-destructive mb-0.5">${isKm ? 'ការព្រមានអំពីការបាត់បង់ទិន្នន័យជាអចិន្ត្រៃយ៍' : 'Permanent Data Loss Warning'}</p>
            <p class="text-destructive/90">${warningText}</p>
          </div>
        </div>

        <div class="p-3 rounded-lg border border-border bg-card text-xs space-y-1.5">
          <div class="flex items-center justify-between text-muted-foreground">
            <span>${isKm ? 'ឈ្មោះគណនី' : 'Username'}:</span>
            <span class="font-mono font-bold text-foreground">@${user.username}</span>
          </div>
          <div class="flex items-center justify-between text-muted-foreground">
            <span>${isKm ? 'ឈ្មោះពេញ' : 'Display Name'}:</span>
            <span class="font-semibold text-foreground">${user.displayName || '—'}</span>
          </div>
          <div class="flex items-center justify-between text-muted-foreground">
            <span>${isKm ? 'តួនាទី' : 'Role'}:</span>
            <span class="font-semibold ${user.role === 'DIRECTOR' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}">${user.role}</span>
          </div>
          <div class="flex items-center justify-between text-muted-foreground">
            <span>${isKm ? 'ទិន្នន័យក្នុងម៉ាស៊ីន (Local DB)' : 'Local Database'}:</span>
            <span class="font-mono text-foreground">SchoolWorkspace_${user.id}</span>
          </div>
        </div>

        <label class="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors select-none">
          <input type="checkbox" id="delete-drive-file-cb" checked 
                 class="mt-0.5 w-4 h-4 rounded text-destructive border-input focus:ring-destructive cursor-pointer" />
          <div class="text-xs">
            <span class="font-semibold text-foreground">
              ${isKm ? 'លុបឯកសារក្នុង Google Drive ផងដែរ (Delete cloud backup file in Google Drive)' : 'Delete cloud backup file in Google Drive'}
            </span>
            <p class="text-muted-foreground mt-0.5 font-mono text-[11px]">
              SchoolWorkspace_${user.username}
            </p>
          </div>
        </label>
      </div>

      <!-- Loading / Progress Overlay -->
      <div id="delete-progress-overlay" class="hidden flex flex-col items-center justify-center py-8 text-center space-y-3">
        <div class="w-9 h-9 border-3 border-destructive border-t-transparent rounded-full animate-spin"></div>
        <p id="delete-progress-text" class="text-xs sm:text-sm font-semibold text-foreground animate-pulse">
          ${isKm ? 'កំពុងដំណើរការលុបទិន្នន័យ...' : 'Processing deletion...'}
        </p>
        <p class="text-[11px] text-muted-foreground">
          ${isKm ? 'សូមកុំបិទកម្មវិធីក្នុងអំឡុងពេលនេះ' : 'Please do not close the application during this process'}
        </p>
      </div>
    `;

    const footerHtml = `
      <div id="delete-modal-footer-buttons" class="flex items-center justify-end gap-2.5 w-full">
        <button id="btn-cancel-delete" type="button" 
                class="px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-xs sm:text-sm font-medium transition-colors shadow-xs cursor-pointer">
          ${isKm ? 'បោះបង់ (Cancel)' : 'Cancel'}
        </button>
        <button id="btn-confirm-delete" type="button" 
                class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer">
          ${getIcon('trash', 'w-4 h-4')}
          <span>${isKm ? 'លុបជាអចិន្ត្រៃយ៍' : 'Delete Permanently'}</span>
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: modalTitle,
      content: contentHtml,
      footer: footerHtml,
      maxWidth: 'max-w-md',
      backdropClose: false,
      preventUnsavedClose: false
    });

    const cancelBtn = modal.element.querySelector('#btn-cancel-delete');
    const confirmBtn = modal.element.querySelector('#btn-confirm-delete');
    const driveCheckbox = modal.element.querySelector('#delete-drive-file-cb');
    const mainContent = modal.element.querySelector('#delete-modal-main-content');
    const progressOverlay = modal.element.querySelector('#delete-progress-overlay');
    const progressText = modal.element.querySelector('#delete-progress-text');
    const footerButtons = modal.element.querySelector('#delete-modal-footer-buttons');

    cancelBtn?.addEventListener('click', () => modal.close());

    const executeDeletion = async (deleteDrive, allowFallback = false) => {
      // Switch UI to Progress Mode
      mainContent?.classList.add('hidden');
      progressOverlay?.classList.remove('hidden');
      if (footerButtons) footerButtons.classList.add('hidden');

      const onProgress = (step) => {
        if (progressText) {
          if (step === 'deletingDrive') {
            progressText.textContent = isKm ? 'កំពុងលុបឯកសារពី Google Drive...' : 'Deleting file from Google Drive...';
          } else if (step === 'deletingLocal') {
            progressText.textContent = isKm ? 'កំពុងលុបទិន្នន័យក្នុងម៉ាស៊ីន...' : 'Deleting local database...';
          }
        }
      };

      try {
        const result = await UserService.deleteUserWithData(user, {
          deleteDriveFile: deleteDrive,
          allowLocalFallback: allowFallback,
          onProgress
        });

        modal.close();

        if (result.driveDeleted) {
          toast.success(
            isKm 
              ? `គណនី @${user.username} និងទិន្នន័យទាំងអស់ (Local & Drive) ត្រូវបានលុបដោយជោគជ័យ។`
              : `User account @${user.username} and all data (Local & Drive) deleted successfully.`
          );
        } else {
          toast.success(
            isKm 
              ? `គណនី @${user.username} និងទិន្នន័យក្នុងម៉ាស៊ីនត្រូវបានលុបដោយជោគជ័យ។`
              : `User account @${user.username} and local data deleted successfully.`
          );
        }

        await this.reload();
      } catch (err) {
        modal.close();

        if (err.code === 'OFFLINE' || err.message === 'OFFLINE_DRIVE_UNREACHABLE') {
          // Offline safeguard confirmation prompt
          Modal.confirm({
            title: isKm ? 'គ្មានការតភ្ជាប់អ៊ីនធឺណិត' : 'No Internet Connection',
            message: isKm 
              ? 'មិនមានអ៊ីនធឺណិតដើម្បីលុបឯកសារក្នុង Google Drive ទេ។ តើអ្នកចង់បន្តលុបទិន្នន័យក្នុងម៉ាស៊ីនដែរឬទេ?'
              : 'Device is offline. Unable to reach Google Drive. Proceed with local deletion only?',
            destructive: true,
            confirmText: isKm ? 'លុបតែទិន្នន័យក្នុងម៉ាស៊ីន' : 'Delete Local Data Only',
            cancelText: isKm ? 'បោះបង់' : 'Cancel',
            onConfirm: async () => {
              await executeDeletion(false, true);
            }
          });
        } else {
          // Google Drive deletion failure fallback prompt
          Modal.confirm({
            title: isKm ? 'ការលុបឯកសារ Drive មិនជោគជ័យ' : 'Google Drive Deletion Failed',
            message: isKm
              ? `មិនអាចលុបឯកសារនៅលើ Google Drive បានទេ (${err.message})។ តើអ្នកចង់បន្តលុបគណនី និងទិន្នន័យក្នុងម៉ាស៊ីនដែរឬទេ?`
              : `Could not delete file from Google Drive (${err.message}). Proceed with local account and data deletion anyway?`,
            destructive: true,
            confirmText: isKm ? 'លុបតែទិន្នន័យក្នុងម៉ាស៊ីន' : 'Delete Local Data Only',
            cancelText: isKm ? 'បោះបង់' : 'Cancel',
            onConfirm: async () => {
              await executeDeletion(false, true);
            }
          });
        }
      }
    };

    confirmBtn?.addEventListener('click', async () => {
      const deleteDrive = Boolean(driveCheckbox?.checked);
      await executeDeletion(deleteDrive, false);
    });
  },

  /**
   * Admin Reset Modal:
   * Option 1: Reset Default Accounts (Restores predefined default accounts with clean empty workspaces; preserves custom accounts)
   * Option 2: Strict Full App Reset (Erases all custom accounts, deletes all Drive workspace files, keeps only default accounts with empty data)
   */
  openAdminResetModal() {
    const isKm = i18n.getLocale() === 'km';

    const contentHtml = `
      <div class="space-y-4 text-xs select-none">
        <!-- Option 1: Reset Default Accounts -->
        <div class="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-sm">
              <span class="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                ${getIcon('rotateCcw', 'w-4 h-4')}
              </span>
              <span>${isKm ? 'ជម្រើសទី ១: កំណត់ទៅកាន់ ៤ គណនីលំនាំដើម' : 'Option 1: Reset to 4 Default Accounts'}</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
              ${isKm ? '៤ គណនីកូដ' : '4 Default Accs Only'}
            </span>
          </div>

          <p class="text-muted-foreground leading-relaxed">
            ${isKm 
              ? 'កំណត់ប្រព័ន្ធឱ្យនៅសល់តែ <strong>៤ គណនីលំនាំដើម</strong> ដែលកំណត់ក្នុងកូដ (<strong>admin</strong>, <strong>director1</strong>, <strong>teacher1</strong>, <strong>king</strong>)។ រាល់គណនីបន្ថែមផ្សេងទៀត (ដូចជា <code>reaksmey</code>, <code>veasna</code>...) នឹងត្រូវលុបចេញទាំងស្រុង។ ទិន្នន័យចាស់ៗរបស់គណនីទាំងនេះនឹងត្រូវសម្អាតឱ្យនៅទទេ (No Data)។'
              : 'Resets system to ONLY the <strong>4 default accounts</strong> defined in code (<strong>admin</strong>, <strong>director1</strong>, <strong>teacher1</strong>, <strong>king</strong>). All additional custom accounts are removed, and workspaces are cleared to empty (No Data).'}
          </p>

          <div class="p-2.5 rounded-lg bg-background/80 border border-border text-[11px] text-muted-foreground flex items-center gap-2">
            <span class="text-amber-500 font-bold shrink-0">ℹ️</span>
            <span>${isKm ? 'បន្ទាប់ពី Reset ក្នុងប្រព័ន្ធនឹងមានតែ ៤ គណនីលំនាំដើមគត់ ទាំងក្នុងម៉ាស៊ីន និង Google Drive (SchoolSystem_AdminData)។' : 'After reset, exactly 4 default accounts will exist locally and in Google Drive.'}</span>
          </div>

          <div class="flex justify-end pt-1">
            <button id="btn-trigger-reset-defaults" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs">
              ${getIcon('rotateCcw', 'w-3.5 h-3.5')}
              <span>${isKm ? 'កំណត់ទៅកាន់ ៤ គណនីលំនាំដើម' : 'Reset to 4 Default Accounts'}</span>
            </button>
          </div>
        </div>

        <!-- Option 2: Strict Full App Reset -->
        <div class="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 font-bold text-destructive text-sm">
              <span class="p-1.5 rounded-lg bg-destructive/15 text-destructive">
                ${getIcon('trash2', 'w-4 h-4')}
              </span>
              <span>${isKm ? 'ជម្រើសទី ២: កំណត់កម្មវិធីឡើងវិញទាំងស្រុង (Strict Reset)' : 'Option 2: Strict Full App Reset'}</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive border border-destructive/30 whitespace-nowrap">
              ${isKm ? 'សម្អាតទាំងអស់' : 'Factory Strict'}
            </span>
          </div>

          <p class="text-muted-foreground leading-relaxed">
            ${isKm
              ? '⚠️ <strong>ការសម្អាតកម្រិតតឹងរ៉ឹង៖</strong> លុបចោលគណនីបង្កើតដោយខ្លួនឯងទាំងអស់ លុបឯកសារ Workspace ទាំងអស់ក្នុង Google Drive (<code>SchoolWorkspace_*</code>) និងលុបទិន្នន័យទាំងអស់ក្នុងម៉ាស៊ីន។ រក្សាទុកតែ ៤ គណនីកំណត់ក្នុងកូដ (admin, director1, teacher1, king) ដែលគ្មានទិន្នន័យ។'
              : '⚠️ <strong>Strict Factory Reset:</strong> Erases all custom user accounts, deletes all workspace files (<code>SchoolWorkspace_*</code>) from Google Drive, and wipes local database records. Retains ONLY the 4 default accounts set in code with empty data.'}
          </p>
          
          <div class="space-y-2 pt-2 border-t border-destructive/20">
            <label for="input-confirm-reset-app" class="block text-[11px] font-semibold text-foreground">
              ${isKm ? 'ដើម្បីបញ្ជាក់ការ Reset ទាំងស្រុង សូមវាយពាក្យ' : 'To confirm strict reset, type'} <span class="font-mono text-destructive font-bold uppercase select-all">RESET</span> ${isKm ? 'ក្នុងប្រអប់ខាងក្រោម៖' : 'below:'}
            </label>
            <div class="flex gap-2">
              <input 
                id="input-confirm-reset-app" 
                type="text" 
                placeholder="RESET"
                autocomplete="off"
                class="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-destructive" 
              />
              <button 
                id="btn-trigger-reset-app-full" 
                type="button" 
                disabled
                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-semibold text-xs opacity-50 cursor-not-allowed transition-colors shadow-xs">
                ${getIcon('trash2', 'w-3.5 h-3.5')}
                <span>${isKm ? 'Reset កម្មវិធី' : 'Strict Reset App'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: isKm ? 'ជម្រើសកំណត់ឡើងវិញរបស់ Admin (System Reset)' : 'Admin System Reset Options',
      content: contentHtml,
      maxWidth: 'max-w-lg',
      footer: `
        <button id="btn-cancel-admin-reset" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium transition-colors cursor-pointer">
          ${t('common.cancel')}
        </button>
      `
    });

    modal.element.querySelector('#btn-cancel-admin-reset')?.addEventListener('click', () => modal.close());

    // Option 1 Handler: Reset Default Accounts
    modal.element.querySelector('#btn-trigger-reset-defaults')?.addEventListener('click', () => {
      Modal.confirm({
        title: isKm ? 'បញ្ជាក់ការកំណត់ទៅកាន់ ៤ គណនីលំនាំដើម' : 'Confirm Reset to 4 Default Accounts',
        message: isKm 
          ? 'តើអ្នកប្រាកដជាចង់កំណត់ទៅកាន់ ៤ គណនីលំនាំដើម (admin, director1, teacher1, king) មែនទេ? រាល់គណនីបន្ថែមផ្សេងទៀតនឹងត្រូវលុបចេញ ហើយទិន្នន័យចាស់ៗរបស់ ៤ គណនីនេះនឹងត្រូវសម្អាតឱ្យនៅទទេ។'
          : 'Are you sure you want to reset to only the 4 default accounts (admin, director1, teacher1, king)? Extra accounts will be removed and their workspaces cleared.',
        destructive: true,
        confirmText: isKm ? 'យល់ព្រម Reset' : 'Confirm Reset',
        cancelText: isKm ? 'បោះបង់' : 'Cancel',
        onConfirm: async () => {
          modal.close();
          const loadingToast = toast.info(
            isKm ? 'កំពុងកំណត់គណនីលំនាំដើមឡើងវិញ...' : 'Resetting default accounts...',
            isKm ? 'ដំណើរការ' : 'Processing',
            0
          );
          try {
            await AdminDataService.resetDefaultAccounts({ silent: false });
            await this.reload();
          } catch (err) {
            toast.error(err.message);
          } finally {
            if (loadingToast && typeof loadingToast.close === 'function') {
              loadingToast.close();
            }
          }
        }
      });
    });

    // Option 2 Handler: Strict Full App Reset
    const inputConfirm = modal.element.querySelector('#input-confirm-reset-app');
    const resetFullBtn = modal.element.querySelector('#btn-trigger-reset-app-full');

    inputConfirm?.addEventListener('input', (e) => {
      const isMatch = e.target.value.trim().toUpperCase() === 'RESET';
      resetFullBtn.disabled = !isMatch;
      if (isMatch) {
        resetFullBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        resetFullBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    resetFullBtn?.addEventListener('click', async () => {
      modal.close();
      const loadingToast = toast.info(
        isKm ? 'កំពុងដំណើរការ Strict Reset App ទាំងក្នុង Drive និងមូលដ្ឋានទិន្នន័យ...' : 'Executing Strict Factory Reset in Drive and local storage...',
        isKm ? 'ដំណើរការ' : 'Processing',
        0
      );
      try {
        await AdminDataService.resetFullApp({ silent: false });
        await this.reload();
      } catch (err) {
        toast.error(err.message);
      } finally {
        if (loadingToast && typeof loadingToast.close === 'function') {
          loadingToast.close();
        }
      }
    });
  },

  renderAccessDenied(container) {
    const isKm = i18n.getLocale() === 'km';
    container.innerHTML = `
      <div class="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div class="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          ${getIcon('lock', 'w-8 h-8')}
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
          ${isKm ? 'គ្មានសិទ្ធិចូលប្រើប្រាស់ (Access Denied)' : 'Access Denied'}
        </h2>
        <p class="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md">
          ${isKm 
            ? 'អ្នកមិនមានសិទ្ធិចូលមើលទំព័រគ្រប់គ្រងគណនីនេះទេ។ មានតែ Administrator ប៉ុណ្ណោះដែលអាចចូលដំណើរការបាន។'
            : 'You do not have permission to access the User Accounts Management page. Only administrators are allowed.'}
        </p>
        <a href="#dashboard" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm shadow transition-all">
          ${getIcon('arrowRight', 'w-4 h-4 rotate-180')}
          <span>${isKm ? 'ត្រឡប់ទៅផ្ទាំងព័ត៌មាន (Dashboard)' : 'Back to Dashboard'}</span>
        </a>
      </div>
    `;
  }
};
