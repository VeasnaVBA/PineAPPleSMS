/**
 * School Management Module
 * Comprehensive shadcn-styled data table, search, filters, pagination,
 * Add New School, Update School, and Show School Details modals.
 *
 * Table Columns (Exact 7 Columns):
 * 1. ល.រ (No. / Row Number - display only)
 * 2. កូដសាលា (School Code - code)
 * 3. ឈ្មោះសាលា (School Name - name)
 * 4. អាសយដ្ឋានសាលា (School Address - address)
 * 5. នាយក (Director / Principal Name - director)
 * 6. លេខទូរសព្ទ (Phone Number - phone)
 * 7. ផ្សេងៗ (Notes / Remarks - notes)
 * + Actions (សកម្មភាព): Show, Update, Delete
 */
import { SchoolService } from '../services/schoolService.js';
import { authService } from '../services/authService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { renderActionDropdown } from '../components/actionDropdown.js';

export const SchoolsPage = {
  state: {
    schools: [],
    searchQuery: '',
    currentPage: 1,
    pageSize: 10
  },

  async render(container) {
    this.container = container;
    if (!this._listenerBound) {
      this._listenerBound = true;
      window.addEventListener('app:refresh-data', async () => {
        if (this.container && window.location.hash.includes('schools')) {
          await this.loadData();
          this.renderLayout();
        }
      });
    }
    await this.loadData();
    this.renderLayout();
  },

  async loadData() {
    try {
      this.state.schools = await SchoolService.getAllSchools();
    } catch (err) {
      console.error('Error loading schools:', err);
      toast.error('Failed to load schools catalog.');
      this.state.schools = [];
    }
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();
    const isAdmin = currentUser?.role === 'ADMIN';
    const isDirector = currentUser?.role === 'DIRECTOR';
    const isTeacher = currentUser?.role === 'TEACHER';
    const totalExistingSchools = this.state.schools.length;
    const isTeacherLimitReached = isTeacher && totalExistingSchools >= 1;
    const teacherTooltip = isKm 
      ? 'អ្នកបានបង្កើតព័ត៌មានសាលារួចហើយ (កំណត់ត្រឹម ១ សាលាប៉ុណ្ណោះ)។' 
      : 'You have already created your school profile (limit: 1).';
    const canCreate = isAdmin || isDirector || isTeacher || authService.can('schools.create');
    const canEdit = isAdmin || isDirector || isTeacher || authService.can('schools.edit');
    const canDelete = isAdmin || isDirector || isTeacher || authService.can('schools.delete');

    // Filter schools by search query
    const q = (this.state.searchQuery || '').trim().toLowerCase();
    const filtered = this.state.schools.filter(s => {
      if (!q) return true;
      return (
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
        (s.director && s.director.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      );
    });

    // Pagination calculations
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.state.pageSize));
    if (this.state.currentPage > totalPages) this.state.currentPage = totalPages;
    const startIndex = (this.state.currentPage - 1) * this.state.pageSize;
    const paginated = filtered.slice(startIndex, startIndex + this.state.pageSize);

    this.container.innerHTML = `
      <div class="space-y-5 animate-fade-in pb-12">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
              ${t('schools.title')}
            </h1>
            <p class="text-sm text-muted-foreground mt-1 ${isKm ? 'font-khmer' : ''}">
              ${t('schools.subtitle')}
            </p>
          </div>
          ${canCreate ? `
            <div class="flex flex-col sm:items-end gap-1.5">
              <div class="flex items-center gap-2">
                <button id="btn-add-school"
                        type="button"
                        ${isTeacherLimitReached ? 'disabled' : ''}
                        title="${isTeacherLimitReached ? teacherTooltip : ''}"
                        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm transition-colors ${
                          isTeacherLimitReached 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'hover:bg-primary/90 cursor-pointer'
                        } ${isKm ? 'font-khmer' : ''}">
                  ${getIcon('plus', 'w-4 h-4')}
                  <span>${t('schools.addSchool')}</span>
                </button>
              </div>
              ${isTeacherLimitReached ? `
                <p class="text-[11px] text-amber-600 dark:text-amber-400 font-medium ${isKm ? 'font-khmer' : ''}">
                  ${teacherTooltip}
                </p>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card shadow-xs">
          <div class="relative flex-1 sm:max-w-md">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
              ${getIcon('search', 'w-4 h-4')}
            </span>
            <input type="text"
                   id="input-school-search"
                   value="${this.state.searchQuery}"
                   placeholder="${t('schools.searchPlaceholder')}"
                   class="w-full h-10 pl-10 pr-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
          </div>

          <div class="flex items-center gap-2 text-xs text-muted-foreground select-none">
            <span class="px-2.5 py-1 rounded-md bg-muted font-medium text-foreground border border-border">
              ${totalItems} ${t('schools.totalSchools')}
            </span>
          </div>
        </div>

        <!-- Schools Data Table (Exact 7 Columns + Actions) -->
        <div class="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr class="border-b border-border bg-muted/40 text-muted-foreground font-medium select-none ${isKm ? 'font-khmer' : ''}">
                  <!-- 1. ល.រ (Row No.) -->
                  <th class="px-3 py-3 w-12 text-center">${t('schools.colNo')}</th>
                  <!-- 2. កូដសាលា (School Code) -->
                  <th class="px-3 py-3 w-28">${t('schools.colCode')}</th>
                  <!-- 3. ឈ្មោះសាលា (School Name) -->
                  <th class="px-4 py-3 min-w-[200px]">${t('schools.colName')}</th>
                  <!-- 4. អាសយដ្ឋានសាលា (School Address) -->
                  <th class="px-3 py-3 min-w-[160px]">${t('schools.colAddress')}</th>
                  <!-- 5. នាយក (Director Name) -->
                  <th class="px-3 py-3 min-w-[140px]">${t('schools.colDirector')}</th>
                  <!-- 6. លេខទូរសព្ទ (Phone Number) -->
                  <th class="px-3 py-3 min-w-[120px] font-mono">${t('schools.colPhone')}</th>
                  <!-- 7. ផ្សេងៗ (Notes / Remarks) -->
                  <th class="px-3 py-3 min-w-[140px]">${t('schools.colNotes')}</th>
                  <!-- Actions Column (Show, Update, Delete) -->
                  <th class="w-[50px] px-2 py-3 text-center">${t('schools.actions')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                ${paginated.length === 0 ? `
                  <tr>
                    <td colspan="8" class="p-12 text-center text-muted-foreground">
                      <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground mb-3">
                        ${getIcon('school', 'w-6 h-6')}
                      </div>
                      <p class="text-sm ${isKm ? 'font-khmer' : ''}">${t('schools.emptyList')}</p>
                    </td>
                  </tr>
                ` : paginated.map((school, idx) => {
                  const rowNum = startIndex + idx + 1;
                  return `
                    <tr class="hover:bg-muted/40 transition-colors group">
                      <!-- 1. ល.រ -->
                      <td class="px-3 py-3 text-center text-muted-foreground font-mono text-xs">
                        ${rowNum}
                      </td>

                      <!-- 2. កូដសាលា -->
                      <td class="px-3 py-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold bg-muted text-foreground border border-border shadow-2xs">
                          ${school.code || '—'}
                        </span>
                      </td>

                      <!-- 3. ឈ្មោះសាលា -->
                      <td class="px-4 py-3">
                        <div class="font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">
                          ${school.name}
                        </div>
                        ${school.nameEn ? `
                          <div class="text-[11px] text-muted-foreground font-normal">
                            ${school.nameEn}
                          </div>
                        ` : ''}
                      </td>

                      <!-- 4. អាសយដ្ឋានសាលា -->
                      <td class="px-3 py-3 text-muted-foreground text-xs leading-relaxed ${isKm ? 'font-khmer' : ''}">
                        ${school.address || '—'}
                      </td>

                      <!-- 5. នាយក -->
                      <td class="px-3 py-3 text-foreground font-medium text-xs ${isKm ? 'font-khmer' : ''}">
                        ${school.director || '—'}
                      </td>

                      <!-- 6. លេខទូរសព្ទ -->
                      <td class="px-3 py-3 font-mono text-xs text-foreground">
                        ${school.phone || '—'}
                      </td>

                      <!-- 7. ផ្សេងៗ -->
                      <td class="px-3 py-3 text-muted-foreground text-xs leading-relaxed max-w-xs truncate ${isKm ? 'font-khmer' : ''}" title="${school.notes || ''}">
                        ${school.notes || '—'}
                      </td>

                      <!-- Actions: Dropdown (Show, Update, Delete) -->
                      <td class="w-[50px] px-2 py-2 text-center">
                        ${renderActionDropdown({
                          id: school.id,
                          title: isKm ? 'ជម្រើសសកម្មភាព' : 'Actions',
                          actions: [
                            {
                              label: isKm ? 'ព័ត៌មានលម្អិត' : 'View Details',
                              icon: 'eye',
                              onClick: () => this.showSchoolDetailsModal(school)
                            },
                            {
                              label: isKm ? 'កែប្រែ' : 'Edit',
                              icon: 'pencil',
                              show: canEdit,
                              onClick: () => this.openSchoolModal(school)
                            },
                            {
                              label: isKm ? 'លុប' : 'Delete',
                              icon: 'trash2',
                              destructive: true,
                              show: canDelete,
                              onClick: () => this.confirmDeleteSchool(school)
                            }
                          ]
                        })}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          ${totalPages > 1 ? `
            <div class="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs select-none">
              <span class="text-muted-foreground font-medium">
                Showing ${startIndex + 1}–${Math.min(startIndex + this.state.pageSize, totalItems)} of ${totalItems}
              </span>
              <div class="flex items-center gap-1">
                <button id="btn-page-prev"
                        type="button"
                        ${this.state.currentPage === 1 ? 'disabled class="p-1.5 rounded text-muted-foreground opacity-40 cursor-not-allowed"' : 'class="p-1.5 rounded text-foreground hover:bg-accent cursor-pointer"'}
                        title="Previous">
                  ${getIcon('chevronLeft', 'w-4 h-4')}
                </button>
                <span class="px-2 font-medium text-foreground">
                  ${this.state.currentPage} / ${totalPages}
                </span>
                <button id="btn-page-next"
                        type="button"
                        ${this.state.currentPage === totalPages ? 'disabled class="p-1.5 rounded text-muted-foreground opacity-40 cursor-not-allowed"' : 'class="p-1.5 rounded text-foreground hover:bg-accent cursor-pointer"'}
                        title="Next">
                  ${getIcon('chevronRight', 'w-4 h-4')}
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    // Search input with debounce
    const searchInput = this.container.querySelector('#input-school-search');
    let debounceTimer = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.state.searchQuery = e.target.value;
        this.state.currentPage = 1;
        this.renderLayout();
      }, 200);
    });

    // 1. Add New School Trigger
    const addSchoolBtn = this.container.querySelector('#btn-add-school');
    addSchoolBtn?.addEventListener('click', (e) => {
      if (addSchoolBtn.hasAttribute('disabled') || addSchoolBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.openSchoolFormModal(null);
    });

    // 2. Show School Details Trigger (Eye icon)
    this.container.querySelectorAll('.btn-show-school').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const school = this.state.schools.find(s => s.id === id);
        if (school) this.openSchoolDetailsModal(school);
      });
    });

    // 3. Update School Trigger (Pencil icon)
    this.container.querySelectorAll('.btn-edit-school').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const school = this.state.schools.find(s => s.id === id);
        if (school) this.openSchoolFormModal(school);
      });
    });

    // 4. Delete School Trigger (Trash icon)
    this.container.querySelectorAll('.btn-delete-school').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const school = this.state.schools.find(s => s.id === id);
        if (school) this.confirmDeleteSchool(school);
      });
    });

    // Pagination buttons
    this.container.querySelector('#btn-page-prev')?.addEventListener('click', () => {
      if (this.state.currentPage > 1) {
        this.state.currentPage--;
        this.renderLayout();
      }
    });

    this.container.querySelector('#btn-page-next')?.addEventListener('click', () => {
      const totalPages = Math.ceil(this.state.schools.length / this.state.pageSize);
      if (this.state.currentPage < totalPages) {
        this.state.currentPage++;
        this.renderLayout();
      }
    });
  },

  /**
   * Add / Update School Modal Form
   * - Triggered by Add button (null) or Update button (existingSchool)
   * - Clears/pre-fills inputs
   * - Enforces exact height h-10, rounded borders, validation, and safe backdrop (backdropClose: false)
   */
  openSchoolFormModal(existingSchool = null) {
    const isEdit = !!existingSchool;
    const isKm = i18n.getLocale() === 'km';
    const title = isEdit ? t('schools.editSchool') : t('schools.addSchool');

    const content = `
      <form id="school-form" class="space-y-4 p-6 select-text">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- 1. School Code (required, unique) -->
          <div>
            <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
              ${t('schools.colCode')} <span class="text-destructive">*</span>
            </label>
            <input type="text"
                   id="form-school-code"
                   value="${existingSchool?.code || ''}"
                   placeholder="${t('schools.codePlaceholder')}"
                   class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono font-medium box-border shadow-xs" />
            <p id="err-school-code" class="text-[11px] text-destructive hidden mt-1"></p>
          </div>

          <!-- 2. School Name (required) -->
          <div>
            <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
              ${t('schools.colName')} <span class="text-destructive">*</span>
            </label>
            <input type="text"
                   id="form-school-name"
                   value="${existingSchool?.name || ''}"
                   placeholder="${t('schools.namePlaceholder')}"
                   class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
            <p id="err-school-name" class="text-[11px] text-destructive hidden mt-1"></p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- 3. Director / Principal -->
          <div>
            <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
              ${t('schools.colDirector')}
            </label>
            <input type="text"
                   id="form-school-director"
                   value="${existingSchool?.director || ''}"
                   placeholder="${t('schools.directorPlaceholder')}"
                   class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
          </div>

          <!-- 4. Phone Number -->
          <div>
            <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
              ${t('schools.colPhone')}
            </label>
            <input type="tel"
                   id="form-school-phone"
                   value="${existingSchool?.phone || ''}"
                   placeholder="${t('schools.phonePlaceholder')}"
                   class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono box-border shadow-xs" />
          </div>
        </div>

        <!-- 5. School Address -->
        <div>
          <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
            ${t('schools.colAddress')}
          </label>
          <input type="text"
                 id="form-school-address"
                 value="${existingSchool?.address || ''}"
                 placeholder="${t('schools.addressPlaceholder')}"
                 class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
        </div>

        <!-- 6. Notes / Remarks (textarea) -->
        <div>
          <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
            ${t('schools.colNotes')}
          </label>
          <textarea id="form-school-notes"
                    rows="3"
                    placeholder="${t('schools.notesPlaceholder')}"
                    class="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs resize-none ${isKm ? 'font-khmer' : ''}">${existingSchool?.notes || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <div class="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
        <button type="button" id="btn-cancel-school"
                class="px-4 py-2 rounded-md border border-border hover:bg-muted text-xs sm:text-sm font-medium text-foreground transition-colors cursor-pointer ${isKm ? 'font-khmer' : ''}">
          ${t('common.cancel')}
        </button>
        <button type="button" id="btn-save-school"
                class="px-5 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${isKm ? 'font-khmer' : ''}">
          ${getIcon('check', 'w-4 h-4')}
          <span>${t('common.save')}</span>
        </button>
      </div>
    `;

    const modal = Modal.open({
      title,
      content,
      footer,
      maxWidth: 'max-w-xl',
      backdropClose: false, // SAFE BACKDROP: NEVER close on outside click or mouseout while editing
      preventUnsavedClose: true
    });

    modal.element.querySelector('#btn-cancel-school')?.addEventListener('click', () => modal.close());

    modal.element.querySelector('#btn-save-school')?.addEventListener('click', async () => {
      const codeInput = modal.element.querySelector('#form-school-code');
      const nameInput = modal.element.querySelector('#form-school-name');
      const addressInput = modal.element.querySelector('#form-school-address');
      const directorInput = modal.element.querySelector('#form-school-director');
      const phoneInput = modal.element.querySelector('#form-school-phone');
      const notesInput = modal.element.querySelector('#form-school-notes');

      const codeErr = modal.element.querySelector('#err-school-code');
      const nameErr = modal.element.querySelector('#err-school-name');
      if (codeErr) codeErr.classList.add('hidden');
      if (nameErr) nameErr.classList.add('hidden');

      const code = codeInput?.value.trim();
      const name = nameInput?.value.trim();

      if (!code) {
        if (codeErr) {
          codeErr.textContent = t('schools.codeRequired');
          codeErr.classList.remove('hidden');
        }
        codeInput?.focus();
        return;
      }

      if (!name) {
        if (nameErr) {
          nameErr.textContent = t('schools.nameRequired');
          nameErr.classList.remove('hidden');
        }
        nameInput?.focus();
        return;
      }

      const schoolData = {
        code,
        name,
        address: addressInput?.value.trim() || '',
        director: directorInput?.value.trim() || '',
        phone: phoneInput?.value.trim() || '',
        notes: notesInput?.value.trim() || ''
      };

      try {
        if (isEdit) {
          await SchoolService.updateSchool(existingSchool.id, schoolData);
          toast.success(t('schools.updatedSuccess'));
        } else {
          const currentUser = authService.getCurrentUser();
          await SchoolService.createSchool(schoolData, currentUser);
          toast.success(t('schools.savedSuccess'));
        }
        modal.close();
        await this.loadData();
        this.renderLayout();
      } catch (err) {
        toast.error(err.message);
        if (err.message.includes('already exists') || err.message.includes('already in use')) {
          if (codeErr) {
            codeErr.textContent = t('schools.duplicateCode');
            codeErr.classList.remove('hidden');
          }
          codeInput?.focus();
        }
      }
    });
  },

  /**
   * Show School Details Modal (View-Only)
   * - Triggered by Eye icon on row
   * - Read-only card layout with badges and formatted sections
   * - Includes direct "Edit" shortcut button if user has permission
   */
  async openSchoolDetailsModal(school) {
    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();
    const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'DIRECTOR' || currentUser?.role === 'TEACHER' || authService.can('schools.edit');

    // Fetch live usage stats for linked classes and students
    let usage = { isUsed: false, studentCount: 0, classCount: 0 };
    try {
      usage = await SchoolService.checkSchoolUsage(school.id);
    } catch (_) {}

    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(isKm ? 'km-KH' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return dateStr;
      }
    };

    const content = `
      <div class="space-y-5 p-6 select-text">
        <!-- Top Hero Card -->
        <div class="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              ${getIcon('school', 'w-6 h-6')}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base sm:text-lg font-bold text-foreground tracking-tight ${isKm ? 'font-khmer' : ''}">
                  ${school.name}
                </h3>
                <span class="px-2 py-0.5 rounded font-mono text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  ${school.code}
                </span>
              </div>
              ${school.nameEn ? `
                <p class="text-xs text-muted-foreground mt-0.5">${school.nameEn}</p>
              ` : ''}
            </div>
          </div>

          <!-- Usage Stats Badges -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="px-2.5 py-1 rounded-md bg-background border border-border text-foreground font-medium flex items-center gap-1.5 shadow-2xs">
              ${getIcon('classes', 'w-3.5 h-3.5 text-muted-foreground')}
              <span>${usage.classCount} ${isKm ? 'ថ្នាក់រៀន' : 'Classes'}</span>
            </span>
            <span class="px-2.5 py-1 rounded-md bg-background border border-border text-foreground font-medium flex items-center gap-1.5 shadow-2xs">
              ${getIcon('students', 'w-3.5 h-3.5 text-muted-foreground')}
              <span>${usage.studentCount} ${isKm ? 'សិស្ស' : 'Students'}</span>
            </span>
          </div>
        </div>

        <!-- 2-Column Details Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Card 1: Administrative Details -->
          <div class="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border text-xs font-semibold text-foreground uppercase tracking-wide ${isKm ? 'font-khmer' : ''}">
              ${getIcon('user', 'w-3.5 h-3.5 text-primary')}
              <span>${isKm ? 'ព័ត៌មានរដ្ឋបាល' : 'Administrative Info'}</span>
            </div>

            <div class="space-y-2.5 text-xs">
              <div>
                <span class="text-muted-foreground block text-[11px] mb-0.5 ${isKm ? 'font-khmer' : ''}">${t('schools.colDirector')}:</span>
                <span class="text-foreground font-medium text-sm ${isKm ? 'font-khmer' : ''}">${school.director || '—'}</span>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px] mb-0.5 ${isKm ? 'font-khmer' : ''}">${t('schools.colPhone')}:</span>
                <span class="text-foreground font-mono text-sm">${school.phone || '—'}</span>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px] mb-0.5 ${isKm ? 'font-khmer' : ''}">${t('schools.colAddress')}:</span>
                <span class="text-foreground leading-relaxed ${isKm ? 'font-khmer' : ''}">${school.address || '—'}</span>
              </div>
            </div>
          </div>

          <!-- Card 2: System Metadata & Notes -->
          <div class="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border text-xs font-semibold text-foreground uppercase tracking-wide ${isKm ? 'font-khmer' : ''}">
              ${getIcon('database', 'w-3.5 h-3.5 text-primary')}
              <span>${isKm ? 'ប្រព័ន្ធ និងកំណត់សម្គាល់' : 'System & Notes'}</span>
            </div>

            <div class="space-y-2.5 text-xs">
              <div>
                <span class="text-muted-foreground block text-[11px] mb-0.5 ${isKm ? 'font-khmer' : ''}">${t('schools.colNotes')}:</span>
                <p class="text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-2 rounded-md border border-border/50 text-xs min-h-[52px] ${isKm ? 'font-khmer' : ''}">${school.notes || '—'}</p>
              </div>
              <div class="grid grid-cols-2 gap-2 pt-1 border-t border-border/60 text-[11px]">
                <div>
                  <span class="text-muted-foreground block text-[10px] ${isKm ? 'font-khmer' : ''}">${t('schools.createdAtLabel')}:</span>
                  <span class="font-mono text-muted-foreground">${formatDate(school.createdAt)}</span>
                </div>
                <div>
                  <span class="text-muted-foreground block text-[10px] ${isKm ? 'font-khmer' : ''}">${t('schools.updatedAtLabel')}:</span>
                  <span class="font-mono text-muted-foreground">${formatDate(school.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <div class="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
        <button type="button" id="btn-close-details"
                class="px-4 py-2 rounded-md border border-border hover:bg-muted text-xs sm:text-sm font-medium text-foreground transition-colors cursor-pointer ${isKm ? 'font-khmer' : ''}">
          ${t('common.close') || (isKm ? 'បិទ' : 'Close')}
        </button>
        ${canEdit ? `
          <button type="button" id="btn-details-edit"
                  class="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${isKm ? 'font-khmer' : ''}">
            ${getIcon('edit', 'w-4 h-4')}
            <span>${t('schools.updateAction')}</span>
          </button>
        ` : ''}
      </div>
    `;

    const modal = Modal.open({
      title: t('schools.schoolDetailsTitle'),
      content,
      footer,
      maxWidth: 'max-w-2xl',
      backdropClose: false, // SAFE BACKDROP
      preventUnsavedClose: false
    });

    modal.element.querySelector('#btn-close-details')?.addEventListener('click', () => modal.close());

    modal.element.querySelector('#btn-details-edit')?.addEventListener('click', () => {
      modal.close();
      this.openSchoolFormModal(school);
    });
  },

  /**
   * Confirm and delete a school record
   * If school is referenced by students/classes, prompts with a clear warning
   * and unlinks those references upon user confirmation.
   */
  async confirmDeleteSchool(school) {
    const isKm = i18n.getLocale() === 'km';

    // 1. Check if students or classes are linked to this school
    let usage = { isUsed: false, studentCount: 0, classCount: 0 };
    try {
      usage = await SchoolService.checkSchoolUsage(school.id);
    } catch (err) {
      console.warn('Could not inspect school usage:', err);
    }

    if (usage.isUsed) {
      const details = [];
      if (usage.studentCount > 0) details.push(`${usage.studentCount} ${isKm ? 'សិស្ស' : 'student(s)'}`);
      if (usage.classCount > 0) details.push(`${usage.classCount} ${isKm ? 'ថ្នាក់រៀន' : 'class(es)'}`);

      const warningMsg = isKm
        ? `សាលារៀន "${school.name}" នេះកំពុងផ្សារភ្ជាប់ជាមួយ ${details.join(' និង ')}។ តើអ្នកពិតជាចង់លុបសាលានេះមែនទេ? (ទិន្នន័យសិស្ស និងថ្នាក់រៀននឹងត្រូវបានផ្តាច់ចេញពីសាលានេះ)`
        : `School "${school.name}" is currently associated with ${details.join(' & ')}. Are you sure you want to delete this school? (Associated students and classes will have their school unlinked).`;

      Modal.confirm({
        title: isKm ? 'ការព្រមាន៖ សាលារៀនកំពុងប្រើប្រាស់' : 'Warning: School in Use',
        message: warningMsg,
        confirmText: isKm ? 'យល់ព្រមលុប' : 'Delete Anyway',
        confirmVariant: 'destructive',
        onConfirm: async () => {
          try {
            await SchoolService.deleteSchool(school.id, true);
            await SchoolService.unlinkSchoolFromReferences(school);
            toast.success(t('schools.deletedSuccess'));
            await this.loadData();
            this.renderLayout();
          } catch (err) {
            toast.error(err.message);
          }
        }
      });
      return;
    }

    // 2. Normal deletion confirmation when not in use
    const message = t('schools.deleteConfirm')
      .replace('{name}', school.name)
      .replace('{code}', school.code);

    Modal.confirm({
      title: t('schools.deleteSchool'),
      message,
      confirmText: t('common.delete'),
      confirmVariant: 'destructive',
      onConfirm: async () => {
        try {
          await SchoolService.deleteSchool(school.id, true);
          toast.success(t('schools.deletedSuccess'));
          await this.loadData();
          this.renderLayout();
        } catch (err) {
          toast.error(err.message);
        }
      }
    });
  }
};
