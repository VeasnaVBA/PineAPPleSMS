/**
 * Dedicated Teacher Management Page for OFFICER Account
 * Completely separated and decoupled from TeachersPage (Director & Teacher accounts).
 * Any table columns, rows, filters, or controls changed here will NEVER affect Director or Teacher accounts.
 */

import { TeacherService } from '../services/teacherService.js';
import { OfficerTeacherFormModal } from '../components/officerTeacherFormModal.js';
import { photoService } from '../services/photoService.js';
import { authService } from '../services/authService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { renderActionDropdown } from '../components/actionDropdown.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export const OfficerTeachersPage = {
  container: null,
  cachedTeachers: null,
  state: {
    search: '',
    status: 'all',
    gender: 'all',
    page: 1,
    pageSize: 15
  },

  async render(container) {
    this.container = container;
    this.state.search = '';
    this.state.status = 'all';
    this.state.gender = 'all';
    this.state.page = 1;

    this.cachedTeachers = await TeacherService.getAll();

    this.renderLayout();
    await this.loadData();

    // Listen for data refresh
    if (!this._refreshListenerBound) {
      this._refreshListenerBound = true;
      window.addEventListener('app:refresh-data', async () => {
        this.cachedTeachers = await TeacherService.getAll();
        if (this.container && document.body.contains(this.container)) {
          await this.loadData();
        }
      });
    }
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';

    this.container.innerHTML = `
      <div class="space-y-5 pb-12 select-none animate-fade-in">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div class="flex items-center gap-2">
              <span class="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                ${getIcon('teachers', 'w-5 h-5')}
              </span>
              <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
                ${isKm ? 'គ្រប់គ្រងគ្រូបង្រៀន (ការិយាល័យ)' : 'Teacher Management (Office)'}
              </h1>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                OFFICER
              </span>
            </div>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1">
              ${isKm 
                ? 'តារាងគ្រប់គ្រងបុគ្គលិក និងគ្រូបង្រៀនសម្រាប់ផ្នែកការិយាល័យ (ឯករាជ្យពីគណនីផ្សេងៗ)' 
                : 'Dedicated Teacher & Staff management table for Office Staff.'}
            </p>
          </div>

          <!-- Header Actions -->
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Add Teacher Button -->
            <button id="btn-officer-add-teacher" 
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${isKm ? 'បន្ថែមគ្រូបង្រៀនថ្មី' : 'Add New Teacher'}</span>
            </button>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="bg-card p-3 rounded-xl border border-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <!-- Search Input -->
          <div class="relative w-full sm:w-80">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              ${getIcon('search', 'w-4 h-4')}
            </span>
            <input type="text" 
                   id="officer-teacher-search" 
                   placeholder="${isKm ? 'ស្វែងរកតាមឈ្មោះ ឬអត្តលេខ...' : 'Search teacher by name, ID...'}"
                   class="w-full h-9 pl-9 pr-3 py-1.5 bg-background border border-input rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-xs" />
          </div>

          <!-- Filters -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <!-- Gender Filter -->
            <select id="officer-gender-filter" 
                    class="h-9 px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-xs">
              <option value="all">${isKm ? 'គ្រប់ភេទ' : 'All Genders'}</option>
              <option value="ស្រី">${isKm ? 'ស្រី' : 'Female'}</option>
              <option value="ប្រុស">${isKm ? 'ប្រុស' : 'Male'}</option>
            </select>

            <!-- Status Filter -->
            <select id="officer-status-filter" 
                    class="h-9 px-3 py-1.5 pr-8 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-xs">
              <option value="all">${isKm ? 'គ្រប់ស្ថានភាព' : 'All Status'}</option>
              <option value="សកម្ម">${isKm ? 'សកម្ម (Active)' : 'Active'}</option>
              <option value="ទំនេរគ្មានបៀវត្ស">${isKm ? 'ទំនេរគ្មានបៀវត្ស' : 'On Leave'}</option>
              <option value="ផ្ទេរចេញ">${isKm ? 'ផ្ទេរចេញ' : 'Transferred'}</option>
              <option value="ចូលនិវត្តន៍">${isKm ? 'ចូលនិវត្តន៍' : 'Retired'}</option>
            </select>
          </div>
        </div>

        <!-- Dedicated Officer Teacher Table -->
        <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th class="w-12 px-3 py-3 text-center">#</th>
                  <th class="w-14 px-3 py-3 text-center">${isKm ? 'រូបថត' : 'Photo'}</th>
                  <th class="px-4 py-3">${isKm ? 'លេខសម្គាល់' : 'Teacher ID'}</th>
                  <th class="px-4 py-3">${isKm ? 'គោត្តនាម-នាម' : 'Full Name (Khmer)'}</th>
                  <th class="px-4 py-3">${isKm ? 'ឈ្មោះឡាតាំង' : 'Latin Name'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ភេទ' : 'Gender'}</th>
                  <th class="px-4 py-3">${isKm ? 'លេខទូរស័ព្ទ' : 'Phone'}</th>
                  <th class="px-4 py-3">${isKm ? 'មុខតំណែង / ឯកទេស' : 'Position / Subject'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ស្ថានភាព' : 'Status'}</th>
                  <th class="w-20 px-3 py-3 text-center">${isKm ? 'សកម្មភាព' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody id="officer-teacher-table-body" class="divide-y divide-border">
                <!-- Dynamically loaded -->
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div id="officer-teacher-pagination" class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <!-- Loaded dynamically -->
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    // Add Teacher button
    this.container.querySelector('#btn-officer-add-teacher')?.addEventListener('click', () => {
      OfficerTeacherFormModal.open({
        onSave: async () => {
          this.cachedTeachers = await TeacherService.getAll();
          await this.loadData();
        }
      });
    });

    // Search input
    const searchInput = this.container.querySelector('#officer-teacher-search');
    searchInput?.addEventListener('input', (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.loadData();
    });

    // Gender filter
    this.container.querySelector('#officer-gender-filter')?.addEventListener('change', (e) => {
      this.state.gender = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    // Status filter
    this.container.querySelector('#officer-status-filter')?.addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.loadData();
    });
  },

  async loadData() {
    const tbody = document.getElementById('officer-teacher-table-body');
    const pagination = document.getElementById('officer-teacher-pagination');
    if (!tbody) return;

    const isKm = i18n.getLocale() === 'km';
    let teachers = this.cachedTeachers || [];

    // Filter by search
    if (this.state.search) {
      teachers = teachers.filter(t => {
        const fullNameKm = `${t.lastNameKhmer || ''} ${t.firstNameKhmer || ''}`.toLowerCase();
        const fullNameEn = `${t.lastNameLatin || ''} ${t.firstNameLatin || ''}`.toLowerCase();
        const tId = (t.teacherId || '').toLowerCase();
        const cId = (t.civilServantId || '').toLowerCase();
        const phone = (t.phone || '').toLowerCase();
        return fullNameKm.includes(this.state.search) ||
               fullNameEn.includes(this.state.search) ||
               tId.includes(this.state.search) ||
               cId.includes(this.state.search) ||
               phone.includes(this.state.search);
      });
    }

    // Filter by gender
    if (this.state.gender !== 'all') {
      teachers = teachers.filter(t => t.gender === this.state.gender || (this.state.gender === 'ស្រី' && t.gender === 'Female') || (this.state.gender === 'ប្រុស' && t.gender === 'Male'));
    }

    // Filter by status
    if (this.state.status !== 'all') {
      teachers = teachers.filter(t => t.status === this.state.status);
    }

    const totalCount = teachers.length;
    const totalPages = Math.ceil(totalCount / this.state.pageSize) || 1;
    if (this.state.page > totalPages) this.state.page = totalPages;

    const startIndex = (this.state.page - 1) * this.state.pageSize;
    const pageItems = teachers.slice(startIndex, startIndex + this.state.pageSize);

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="px-4 py-12 text-center text-muted-foreground">
            <div class="flex flex-col items-center justify-center gap-2">
              ${getIcon('teachers', 'w-8 h-8 text-muted-foreground/40')}
              <p class="font-medium">${isKm ? 'រកមិនឃើញទិន្នន័យគ្រូបង្រៀនទេ' : 'No teacher records found'}</p>
            </div>
          </td>
        </tr>
      `;
      if (pagination) pagination.innerHTML = `<span>${isKm ? 'សរុប៖ ០ នាក់' : 'Total: 0'}</span>`;
      return;
    }

    tbody.innerHTML = pageItems.map((t, idx) => {
      const rowNum = startIndex + idx + 1;
      const fullNameKm = `${t.lastNameKhmer || ''} ${t.firstNameKhmer || ''}`.trim() || '—';
      const fullNameEn = `${t.lastNameLatin || ''} ${t.firstNameLatin || ''}`.trim() || '—';
      const photoSrc = t.photo || '';

      const statusBadge = (t.status === 'សកម្ម' || t.status === 'Active' || !t.status)
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
             <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${isKm ? 'សកម្ម' : 'Active'}
           </span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
             ${t.status}
           </span>`;

      return `
        <tr class="hover:bg-muted/40 transition-colors">
          <td class="px-3 py-3 text-center text-muted-foreground font-mono text-xs">${rowNum}</td>
          <td class="px-3 py-3 text-center">
            <div class="w-8 h-10 rounded bg-muted/60 border border-border mx-auto overflow-hidden flex items-center justify-center text-muted-foreground">
              ${photoSrc 
                ? `<img src="${photoSrc}" class="w-full h-full object-cover" alt="${fullNameKm}" />`
                : getIcon('user', 'w-4 h-4')}
            </div>
          </td>
          <td class="px-4 py-3 font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">${t.teacherId || '—'}</td>
          <td class="px-4 py-3 font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">${fullNameKm}</td>
          <td class="px-4 py-3 font-medium text-muted-foreground">${fullNameEn}</td>
          <td class="px-3 py-3 text-center">${t.gender || '—'}</td>
          <td class="px-4 py-3 font-mono text-xs text-muted-foreground">${t.phone || '—'}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-foreground">${t.position || t.subject1 || '—'}</div>
            ${t.subject1 && t.position ? `<div class="text-[11px] text-muted-foreground">${t.subject1}</div>` : ''}
          </td>
          <td class="px-3 py-3 text-center">${statusBadge}</td>
          <td class="px-3 py-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button data-action="edit" data-id="${t.id}" class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="${isKm ? 'កែប្រែ' : 'Edit'}">
                ${getIcon('edit', 'w-3.5 h-3.5')}
              </button>
              <button data-action="delete" data-id="${t.id}" class="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" title="${isKm ? 'លុប' : 'Delete'}">
                ${getIcon('trash', 'w-3.5 h-3.5')}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row action listeners
    tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const teacher = await TeacherService.getById(id);
        if (teacher) {
          OfficerTeacherFormModal.open({
            teacher,
            onSave: async () => {
              this.cachedTeachers = await TeacherService.getAll();
              await this.loadData();
            }
          });
        }
      });
    });

    tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const teacher = await TeacherService.getById(id);
        if (!teacher) return;
        const fullName = `${teacher.lastNameKhmer || ''} ${teacher.firstNameKhmer || ''}`.trim() || teacher.teacherId;

        const confirmed = confirm(isKm 
          ? `តើអ្នកពិតជាចង់លុបគ្រូបង្រៀន "${fullName}" នេះមែនទេ?` 
          : `Are you sure you want to delete teacher "${fullName}"?`);
        if (confirmed) {
          try {
            await TeacherService.delete(id);
            toast.success(isKm ? 'បានលុបគ្រូបង្រៀនដោយជោគជ័យ' : 'Teacher deleted successfully');
            this.cachedTeachers = await TeacherService.getAll();
            await this.loadData();
          } catch (err) {
            toast.error(err.message || 'Error deleting teacher');
          }
        }
      });
    });

    // Pagination bar
    if (pagination) {
      pagination.innerHTML = `
        <div>
          <span>${isKm ? `បង្ហាញពី ${startIndex + 1} ដល់ ${Math.min(startIndex + this.state.pageSize, totalCount)} នៃ ${totalCount} នាក់` : `Showing ${startIndex + 1} to ${Math.min(startIndex + this.state.pageSize, totalCount)} of ${totalCount}`}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button id="btn-officer-prev" ${this.state.page <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="cursor-pointer hover:bg-muted"'} class="px-2.5 py-1 rounded border border-border text-xs font-medium">
            ${isKm ? 'ទំព័រមុន' : 'Previous'}
          </button>
          <span class="px-2 py-1 font-semibold">${this.state.page} / ${totalPages}</span>
          <button id="btn-officer-next" ${this.state.page >= totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="cursor-pointer hover:bg-muted"'} class="px-2.5 py-1 rounded border border-border text-xs font-medium">
            ${isKm ? 'ទំព័របន្ទាប់' : 'Next'}
          </button>
        </div>
      `;

      pagination.querySelector('#btn-officer-prev')?.addEventListener('click', () => {
        if (this.state.page > 1) {
          this.state.page--;
          this.loadData();
        }
      });

      pagination.querySelector('#btn-officer-next')?.addEventListener('click', () => {
        if (this.state.page < totalPages) {
          this.state.page++;
          this.loadData();
        }
      });
    }
  }
};
