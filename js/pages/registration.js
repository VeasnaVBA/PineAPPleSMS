/**
 * Student Registration & Transfer Verification Module (ការចុះឈ្មោះ / ផ្ទៀងផ្ទាត់ពាក្យសុំចូលរៀន)
 * Director / Admin Staging Area for incoming transfer & new student applicants.
 * High-performance, paginated, responsive, 100% 29-field parity.
 */
import { RegistrationService } from '../services/registrationService.js';
import { ClassService } from '../services/classService.js';
import { StudentExcelService } from '../services/studentExcelService.js';
import { photoService } from '../services/photoService.js';
import { StudentFormModal } from '../components/studentFormModal.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { renderActionDropdown } from '../components/actionDropdown.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export const RegistrationPage = {
  state: {
    filterStatus: 'ALL',
    filterGrade: 'ALL',
    searchQuery: '',
    page: 1,
    pageSize: 25,
    selectedIds: new Set(),
    classes: [],
    classesMap: new Map(),
    isLoading: false
  },

  cachedApplicants: [],

  async render(container) {
    this.container = container;
    this.state.selectedIds.clear();
    this.state.page = 1;
    await this.loadData(true);
    this.renderLayout();
  },

  async loadData(forceRefresh = false) {
    if (forceRefresh || !this.cachedApplicants || this.cachedApplicants.length === 0) {
      this.state.isLoading = true;
      try {
        const [classes, applicants] = await Promise.all([
          ClassService.getAll(),
          RegistrationService.getAll({ status: 'ALL' })
        ]);
        this.state.classes = classes || [];
        this.state.classesMap = new Map(this.state.classes.map(c => [c.id, c.name]));
        this.cachedApplicants = applicants || [];
      } catch (err) {
        console.error('Error loading registration applicants:', err);
        toast.error({ message: 'Error loading registration list: ' + err.message });
      } finally {
        this.state.isLoading = false;
      }
    }
  },

  getFilteredApplicants() {
    let list = [...(this.cachedApplicants || [])];

    // 1. Status Filter
    if (this.state.filterStatus && this.state.filterStatus !== 'ALL') {
      list = list.filter(a => a.verificationStatus === this.state.filterStatus);
    }

    // 2. Grade Filter
    if (this.state.filterGrade && this.state.filterGrade !== 'ALL') {
      const g = String(this.state.filterGrade).toLowerCase();
      list = list.filter(a => {
        const target = String(a.targetGrade || '').toLowerCase();
        return target.includes(g);
      });
    }

    // 3. Search Query
    if (this.state.searchQuery && this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.trim().toLowerCase();
      list = list.filter(a => {
        return (
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.englishName && a.englishName.toLowerCase().includes(q)) ||
          (a.tempStudentId && a.tempStudentId.toLowerCase().includes(q)) ||
          (a.studentId && a.studentId.toLowerCase().includes(q)) ||
          (a.lastYearSchool && a.lastYearSchool.toLowerCase().includes(q)) ||
          (a.studentPhone && a.studentPhone.includes(q)) ||
          (a.fatherName && a.fatherName.toLowerCase().includes(q)) ||
          (a.motherName && a.motherName.toLowerCase().includes(q))
        );
      });
    }

    return list;
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';
    const all = this.cachedApplicants || [];
    const pendingCount = all.filter(a => a.verificationStatus === 'PENDING').length;
    const verifiedCount = all.filter(a => a.verificationStatus === 'VERIFIED').length;
    const rejectedCount = all.filter(a => a.verificationStatus === 'REJECTED').length;
    const totalCount = all.length;

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-16">
        <!-- Top Title & Action Bar -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
              ${t('registration.title')}
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-0.5 ${isKm ? 'font-khmer' : ''}">
              ${t('registration.subtitle')}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <!-- Import Excel/JSON -->
            <button id="btn-import-queue"
                    class="h-10 inline-flex items-center gap-2 px-3.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent text-xs sm:text-sm font-medium transition-colors shadow-xs cursor-pointer">
              ${getIcon('upload', 'w-4 h-4 text-purple-500')}
              <span class="${isKm ? 'font-khmer' : ''}">${t('registration.importBtn')}</span>
            </button>

            <!-- Add Single Applicant (29-field modal) -->
            <button id="btn-add-applicant"
                    class="h-10 inline-flex items-center gap-2 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-medium transition-colors shadow-xs cursor-pointer">
              ${getIcon('userPlus', 'w-4 h-4')}
              <span class="${isKm ? 'font-khmer' : ''}">${t('registration.addApplicantBtn')}</span>
            </button>
          </div>
        </div>

        <!-- Filter Chips, Search Bar & Bulk Actions -->
        <div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-4">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <!-- Filter Tabs -->
            <div class="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/50 text-xs">
              <button class="btn-filter-status px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${this.state.filterStatus === 'ALL' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}" data-status="ALL">
                ${t('registration.tabAll')} (<span id="cnt-total">${totalCount}</span>)
              </button>
              <button class="btn-filter-status px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${this.state.filterStatus === 'PENDING' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}" data-status="PENDING">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                ${t('registration.tabPending')} (<span id="cnt-pending">${pendingCount}</span>)
              </button>
              <button class="btn-filter-status px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${this.state.filterStatus === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}" data-status="VERIFIED">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                ${t('registration.tabVerified')} (<span id="cnt-verified">${verifiedCount}</span>)
              </button>
              <button class="btn-filter-status px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${this.state.filterStatus === 'REJECTED' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}" data-status="REJECTED">
                <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                ${t('registration.tabRejected')} (<span id="cnt-rejected">${rejectedCount}</span>)
              </button>
            </div>

            <!-- Search and Grade Filter -->
            <div class="flex flex-wrap items-center gap-2.5 flex-1 lg:max-w-md">
              <div class="relative flex-1 min-w-[200px]">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  ${getIcon('search', 'w-4 h-4')}
                </div>
                <input type="text"
                       id="input-search-queue"
                       value="${this.escapeHtml(this.state.searchQuery)}"
                       placeholder="${t('registration.searchPlaceholder')}"
                       class="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-foreground text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/60 transition-all ${isKm ? 'font-khmer text-xs' : ''}">
              </div>

              <!-- Grade filter dropdown -->
              <select id="select-grade-filter"
                      class="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer">
                <option value="ALL">${t('registration.gradeFilterAll')}</option>
                ${[7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map(g => `
                  <option value="${g}" ${this.state.filterGrade === String(g) ? 'selected' : ''}>${isKm ? `ថ្នាក់ទី ${g}` : `Grade ${g}`}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Bulk Selection Actions Toolbar -->
          <div id="bulk-toolbar" class="${this.state.selectedIds.size > 0 ? '' : 'hidden'} flex flex-wrap items-center justify-between gap-3 p-2.5 bg-primary/5 border border-primary/20 rounded-lg animate-slide-down">
            <div class="flex items-center gap-2 text-xs font-semibold text-primary">
              <span id="bulk-count-badge" class="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">
                ${this.state.selectedIds.size}
              </span>
              <span id="bulk-count-label">${isKm ? `បានជ្រើសរើស ${this.state.selectedIds.size} នាក់` : `${this.state.selectedIds.size} applicants selected`}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button id="btn-bulk-assign-class"
                      class="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-purple-600 text-white hover:bg-purple-700 text-xs font-medium transition-colors shadow-xs cursor-pointer">
                ${getIcon('users', 'w-3.5 h-3.5') || getIcon('userCheck', 'w-3.5 h-3.5')}
                <span id="bulk-assign-class-label">${t('registration.btnBulkAssignClass').replace('{count}', this.state.selectedIds.size)}</span>
              </button>
              <button id="btn-bulk-enroll"
                      class="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium transition-colors shadow-xs cursor-pointer">
                ${getIcon('badgeCheck', 'w-3.5 h-3.5')}
                <span id="bulk-enroll-label">${t('registration.bulkEnrollBtn').replace('{count}', this.state.selectedIds.size)}</span>
              </button>
              <button id="btn-bulk-delete"
                      class="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium transition-colors cursor-pointer">
                ${getIcon('trash', 'w-3.5 h-3.5')}
                <span id="bulk-delete-label">${t('registration.bulkDeleteBtn').replace('{count}', this.state.selectedIds.size)}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- High-Detail 29-Field Admissions Staging Table -->
        <div class="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div class="overflow-x-auto max-w-full">
            <table class="admissions-table w-full text-left text-xs border-collapse whitespace-nowrap min-w-[1900px]">
              <thead class="sticky top-0 z-20 bg-muted/90 border-b border-border text-muted-foreground font-semibold select-none">
                <tr class="border-b border-border bg-muted/50 text-muted-foreground font-semibold select-none">
                  <!-- 1. Checkbox -->
                  <th class="w-10 px-3 py-3 text-center">
                    <input type="checkbox" 
                           id="check-select-all" 
                           class="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer">
                  </th>
                  <!-- 2. ល.រ -->
                  <th class="w-12 px-3 py-3 text-center">${t('registration.tableNo')}</th>
                  <!-- 3. រូបថត -->
                  <th class="w-14 px-3 py-3 text-center">${t('students.photo')}</th>
                  <!-- 4. អត្តលេខ -->
                  <th class="px-3 py-3 min-w-[110px]">${t('students.studentId')}</th>
                  <!-- 5. គោត្តនាម និងនាម -->
                  <th class="px-3 py-3 min-w-[150px]">${isKm ? 'គោត្តនាម និងនាម' : 'Khmer Full Name'}</th>
                  <!-- 6. ឈ្មោះឡាតាំង -->
                  <th class="px-3 py-3 min-w-[140px]">${isKm ? 'ឈ្មោះឡាតាំង' : 'Latin Full Name'}</th>
                  <!-- 7. ភេទ -->
                  <th class="w-16 px-3 py-3 text-center">${t('registration.tableGender')}</th>
                  <!-- 8. ថ្ងៃខែឆ្នាំកំណើត -->
                  <th class="px-3 py-3 min-w-[120px] text-center">${t('registration.tableDob')}</th>
                  <!-- 9. ទីកន្លែងកំណើត -->
                  <th class="px-3 py-3 min-w-[180px]">${isKm ? 'ទីកន្លែងកំណើត' : 'Place of Birth'}</th>
                  <!-- 10. អាសយដ្ឋានបច្ចុប្បន្ន -->
                  <th class="px-3 py-3 min-w-[180px]">${isKm ? 'អាសយដ្ឋានបច្ចុប្បន្ន' : 'Current Address'}</th>
                  <!-- 11. ឪពុក -->
                  <th class="px-3 py-3 min-w-[160px]">${isKm ? 'ឪពុក' : 'Father'}</th>
                  <!-- 12. ម្តាយ -->
                  <th class="px-3 py-3 min-w-[160px]">${isKm ? 'ម្តាយ' : 'Mother'}</th>
                  <!-- 13. អាណាព្យាបាល -->
                  <th class="px-3 py-3 min-w-[160px]">${t('students.guardianName') || (isKm ? 'អាណាព្យាបាល' : 'Guardian')}</th>
                  <!-- 14. សាលាចាស់ -->
                  <th class="px-3 py-3 min-w-[160px]">${t('students.lastYearSchool') || (isKm ? 'សាលាចាស់' : 'Last School')}</th>
                  <!-- 15. សាលារៀន -->
                  <th class="px-3 py-3 min-w-[160px]">${t('students.school') || (isKm ? 'សាលារៀន' : 'School')}</th>
                  <!-- 16. ថ្នាក់ទី -->
                  <th class="px-3 py-3 min-w-[110px] text-center">${t('registration.targetClassLabel') || (isKm ? 'ថ្នាក់ទី' : 'Target Class')}</th>
                  <!-- 17. ឆ្នាំសិក្សា -->
                  <th class="px-3 py-3 min-w-[110px] text-center">${t('students.academicYear')}</th>
                  <!-- 18. ផ្ទៀងផ្ទាត់ឯកសាររឹង -->
                  <th class="px-3 py-3 min-w-[220px]">${isKm ? 'ផ្ទៀងផ្ទាត់ឯកសាររឹង' : 'Hard-Copy Verification'}</th>
                  <!-- 19. ស្ថានភាព -->
                  <th class="w-32 px-3 py-3 text-center">${t('registration.tableStatus')}</th>
                  <!-- 20. សកម្មភាព (sticky right) -->
                  <th class="sticky-action-col sticky right-0 z-30 bg-muted px-2 py-3 w-[50px] text-center">${t('registration.tableActions')}</th>
                </tr>
              </thead>
              <tbody id="registration-table-body" class="divide-y divide-border/60 text-foreground">
                <!-- Rows rendered via renderTableRows() -->
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div id="registration-pagination-footer" class="p-3 sm:p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground select-none bg-muted/10">
            <div id="reg-pagination-info">Showing...</div>
            <div class="flex items-center gap-3 sm:gap-4">
              <div class="flex items-center gap-1.5">
                <span>${t('students.rowsPerPage') || 'Rows per page:'}</span>
                <select id="select-reg-page-size" class="h-8 px-2 py-1 pr-6 rounded-md border border-input bg-card text-foreground box-border shadow-xs cursor-pointer">
                  <option value="10" ${this.state.pageSize === 10 ? 'selected' : ''}>10</option>
                  <option value="25" ${this.state.pageSize === 25 ? 'selected' : ''}>25</option>
                  <option value="50" ${this.state.pageSize === 50 ? 'selected' : ''}>50</option>
                  <option value="100" ${this.state.pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
              </div>
              <div id="reg-pagination-nav" class="flex items-center gap-1"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindStaticEvents();
    this.renderTableRows();
  },

  renderTableRows() {
    const tbody = document.getElementById('registration-table-body');
    if (!tbody) return;

    const isKm = i18n.getLocale() === 'km';
    const filtered = this.getFilteredApplicants();
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.state.pageSize));

    // Clamp current page
    if (this.state.page > totalPages) {
      this.state.page = totalPages;
    }
    if (this.state.page < 1) {
      this.state.page = 1;
    }

    const startIndex = (this.state.page - 1) * this.state.pageSize;
    const endIndex = Math.min(startIndex + this.state.pageSize, totalItems);
    const pageItems = filtered.slice(startIndex, endIndex);

    // Sync select-all checkbox
    const selectAllCheck = document.getElementById('check-select-all');
    if (selectAllCheck) {
      const allPageSelected = pageItems.length > 0 && pageItems.every(a => this.state.selectedIds.has(a.id));
      selectAllCheck.checked = allPageSelected;
    }

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="20" class="py-12 text-center text-muted-foreground">
            <div class="max-w-xs mx-auto space-y-2">
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                ${getIcon('search', 'w-5 h-5')}
              </div>
              <p class="text-xs font-medium">${t('students.emptyList')}</p>
            </div>
          </td>
        </tr>
      `;
      this.renderPaginationControls(0, 0, 0, 1);
      return;
    }

    tbody.innerHTML = pageItems.map((app, idx) => {
      const globalIndex = startIndex + idx + 1;
      const isSelected = this.state.selectedIds.has(app.id);
      const docs = app.documentsChecked || {};
      const isVerified = app.verificationStatus === 'VERIFIED';
      const isRejected = app.verificationStatus === 'REJECTED';
      const isEnrolled = app.verificationStatus === 'ENROLLED';
      const isMale = (app.gender || '').toLowerCase() === 'male';

      // Photo resolution
      let photoSrc = null;
      if (app.photoBlob) {
        photoSrc = photoService.getUrlForBlob(app.photoBlob);
      } else if (app.photo && app.photo.startsWith('data:')) {
        photoSrc = app.photo;
      }

      // Class Name resolution
      const assignedClassName = this.state.classesMap.get(app.assignedClassId || app.classId) || app.targetGrade || '-';

      // Summaries
      const birthSummary = [app.birthVillage, app.birthCommune, app.birthDistrict, app.birthProvince].filter(Boolean).join(', ') || '-';
      const currentSummary = [app.currentVillage, app.currentCommune, app.currentDistrict, app.currentProvince].filter(Boolean).join(', ') || '-';

      // Status badge
      let statusBadge = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          ${t('registration.statusPending')}
        </span>
      `;
      if (isVerified) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            ${t('registration.statusVerified')}
          </span>
        `;
      } else if (isRejected) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            ${t('registration.statusRejected')}
          </span>
        `;
      } else if (isEnrolled) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            ${t('registration.statusEnrolled') || 'Enrolled'}
          </span>
        `;
      }

      const displayId = app.studentId || app.tempStudentId || app.id.slice(0, 8);
      const khmerFullName = [app.lastNameKh, app.firstNameKh].filter(Boolean).join(' ') || app.khmerName || app.nameKhmer || app.name || '-';
      const latinFullName = [app.lastNameLatin, app.firstNameLatin].filter(Boolean).join(' ') || app.englishName || app.nameLatin || '-';
      const guardianDisplay = app.guardianName || app.guardian || '-';

      return `
        <tr class="hover:bg-accent/40 transition-colors group ${isSelected ? 'bg-primary/5' : ''}" data-id="${app.id}">
          <!-- 1. Checkbox -->
          <td class="py-2.5 px-3 text-center">
            <input type="checkbox"
                   class="check-row rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                   data-id="${app.id}"
                   ${isSelected ? 'checked' : ''}>
          </td>
          <!-- 2. Row # -->
          <td class="py-2.5 px-2 text-center text-muted-foreground font-mono text-[11px]">
            ${globalIndex}
          </td>
          <!-- 3. Photo -->
          <td class="py-2.5 px-2 text-center">
            <div class="w-8 h-8 rounded-md overflow-hidden bg-muted flex items-center justify-center mx-auto border border-border/80 flex-shrink-0">
              ${photoSrc ? `
                <img src="${photoSrc}" alt="Avatar" class="w-full h-full object-cover" />
              ` : `
                <span class="font-bold text-[11px] ${isMale ? 'text-blue-600' : 'text-pink-600'}">
                  ${(app.firstNameKh || app.name || 'S').charAt(0).toUpperCase()}
                </span>
              `}
            </div>
          </td>
          <!-- 4. Student ID -->
          <td class="py-2.5 px-3 font-mono text-[11px] font-semibold text-foreground whitespace-nowrap">
            ${this.escapeHtml(displayId)}
          </td>
          <!-- 5. Khmer Name -->
          <td class="py-2.5 px-3 font-khmer text-xs font-semibold text-foreground whitespace-nowrap min-w-[140px]">
            ${this.escapeHtml(khmerFullName)}
          </td>
          <!-- 6. Latin Name -->
          <td class="py-2.5 px-3 font-mono text-[11px] uppercase text-muted-foreground whitespace-nowrap min-w-[130px]">
            ${this.escapeHtml(latinFullName)}
          </td>
          <!-- 7. Gender -->
          <td class="py-2.5 px-3 text-center whitespace-nowrap">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${isMale ? 'bg-blue-500/10 text-blue-600' : 'bg-pink-500/10 text-pink-600'}">
              ${isMale ? (isKm ? 'ប្រុស' : 'M') : (isKm ? 'ស្រី' : 'F')}
            </span>
          </td>
          <!-- 8. Date of Birth -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap font-mono min-w-[110px]">
            ${formatDisplayDate(app.dob || app.dateOfBirth) || '-'}
          </td>
          <!-- 9. Place of Birth -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap min-w-[160px] ${isKm ? 'font-khmer' : ''}" title="${this.escapeHtml(birthSummary)}">
            ${this.escapeHtml(birthSummary)}
          </td>
          <!-- 10. Current Address -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap min-w-[160px] ${isKm ? 'font-khmer' : ''}" title="${this.escapeHtml(currentSummary)}">
            ${this.escapeHtml(currentSummary)}
          </td>
          <!-- 11. Father -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap min-w-[140px] ${isKm ? 'font-khmer' : ''}">
            <div class="font-medium text-foreground">${this.escapeHtml(app.fatherName || '-')}</div>
            ${app.fatherPhone ? `<div class="text-[10px] text-muted-foreground font-mono">${this.escapeHtml(app.fatherPhone)}</div>` : ''}
          </td>
          <!-- 12. Mother -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap min-w-[140px] ${isKm ? 'font-khmer' : ''}">
            <div class="font-medium text-foreground">${this.escapeHtml(app.motherName || '-')}</div>
            ${app.motherPhone ? `<div class="text-[10px] text-muted-foreground font-mono">${this.escapeHtml(app.motherPhone)}</div>` : ''}
          </td>
          <!-- 13. Guardian -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap min-w-[140px] ${isKm ? 'font-khmer' : ''}">
            <div class="font-medium text-foreground">${this.escapeHtml(guardianDisplay)}</div>
            ${app.guardianPhone ? `<div class="text-[10px] text-muted-foreground font-mono">${this.escapeHtml(app.guardianPhone)}</div>` : ''}
          </td>
          <!-- 14. Last Year School -->
          <td class="py-2.5 px-3 text-xs text-foreground whitespace-nowrap min-w-[140px] ${isKm ? 'font-khmer' : ''}" title="${this.escapeHtml(app.lastYearSchool || '-')}">
            ${this.escapeHtml(app.lastYearSchool || '-')}
          </td>
          <!-- 15. Current/Target School -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap min-w-[140px] ${isKm ? 'font-khmer' : ''}" title="${this.escapeHtml(app.school || '-')}">
            ${this.escapeHtml(app.school || '-')}
          </td>
          <!-- 16. Target Class -->
          <td class="py-2.5 px-3 text-xs font-medium text-foreground whitespace-nowrap min-w-[110px]">
            <span class="px-2 py-0.5 rounded bg-muted/80 border border-border text-[11px]">
              ${this.escapeHtml(assignedClassName)}
            </span>
          </td>
          <!-- 17. Academic Year -->
          <td class="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap font-mono min-w-[100px]">
            ${app.academicYear || '-'}
          </td>
          <!-- 18. Document Checklist Badges -->
          <td class="py-2.5 px-4 whitespace-nowrap min-w-[220px]">
            <div class="flex items-center gap-1.5 flex-nowrap">
              <span title="${t('registration.docHardcopyForm')}" 
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${docs.hardcopyForm ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground/60'}">
                ${docs.hardcopyForm ? getIcon('check', 'w-3 h-3 text-emerald-500') : '<span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>'}
                ${isKm ? 'ពាក្យសុំ' : 'Form'}
              </span>
              <span title="${t('registration.docBirthCertificate')}" 
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${docs.birthCertificate ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground/60'}">
                ${docs.birthCertificate ? getIcon('check', 'w-3 h-3 text-emerald-500') : '<span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>'}
                ${isKm ? 'សំបុត្រកំណើត' : 'Birth'}
              </span>
              <span title="${t('registration.docTransferLetter')}" 
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${docs.transferLetter ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground/60'}">
                ${docs.transferLetter ? getIcon('check', 'w-3 h-3 text-emerald-500') : '<span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>'}
                ${isKm ? 'លិខិតផ្ទេរ' : 'Transfer'}
              </span>
              <span title="${t('registration.docTranscripts')}" 
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${docs.transcripts ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground/60'}">
                ${docs.transcripts ? getIcon('check', 'w-3 h-3 text-emerald-500') : '<span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>'}
                ${isKm ? 'ព្រឹត្តិបត្រ' : 'Record'}
              </span>
            </div>
          </td>
          <!-- 19. Status -->
          <td class="py-2.5 px-3 text-center whitespace-nowrap min-w-[120px]">
            ${statusBadge}
          </td>
          <!-- 20. Actions (sticky right) -->
          <td class="sticky-action-col sticky right-0 z-20 bg-card py-2 px-2 text-center whitespace-nowrap w-[50px]">
            ${renderActionDropdown({
              id: app.id,
              title: isKm ? 'ជម្រើសសកម្មភាព' : 'Actions',
              actions: [
                {
                  label: isKm ? 'ផ្ទៀងផ្ទាត់' : 'Verify',
                  icon: 'fileCheck',
                  onClick: () => this.openVerificationModal(app.id)
                },
                {
                  label: isKm ? 'កែប្រែ' : 'Edit',
                  icon: 'pencil',
                  onClick: () => this.openVerificationModal(app.id)
                },
                {
                  label: isKm ? 'អនុម័តចូលរៀន' : 'Approve',
                  icon: 'userCheck',
                  show: isVerified,
                  onClick: () => this.openVerificationModal(app.id)
                },
                {
                  label: isKm ? 'លុប' : 'Delete',
                  icon: 'trash2',
                  destructive: true,
                  onClick: () => {
                    Modal.confirm({
                      title: t('registration.deleteConfirmTitle'),
                      message: t('registration.deleteConfirmDesc').replace('{name}', app.name || 'this applicant'),
                      confirmText: t('common.delete'),
                      type: 'danger',
                      onConfirm: async () => {
                        await RegistrationService.delete(app.id);
                        this.state.selectedIds.delete(app.id);
                        this.cachedApplicants = this.cachedApplicants.filter(a => a.id !== app.id);
                        toast.success({ message: 'Deleted applicant record successfully.' });
                        this.updateHeaderCounts();
                        this.updateBulkToolbar();
                        this.renderTableRows();
                      }
                    });
                  }
                }
              ]
            })}
          </td>
        </tr>
      `;
    }).join('');

    // Bind row actions in tbody
    this.bindRowEvents(tbody);
    this.renderPaginationControls(startIndex + 1, endIndex, totalItems, totalPages);
  },

  renderPaginationControls(start, end, total, totalPages) {
    const infoEl = document.getElementById('reg-pagination-info');
    const navEl = document.getElementById('reg-pagination-nav');
    if (infoEl) {
      infoEl.textContent = total > 0 ? `Showing ${start} to ${end} of ${total} applicants` : 'No applicants found';
    }

    if (!navEl) return;

    if (totalPages <= 1) {
      navEl.innerHTML = '';
      return;
    }

    const curPage = this.state.page;

    navEl.innerHTML = `
      <button class="btn-reg-page h-8 px-2.5 rounded-md border border-input bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              data-page="${curPage - 1}"
              ${curPage <= 1 ? 'disabled' : ''}>
        ${getIcon('chevronLeft', 'w-3.5 h-3.5')}
      </button>

      <span class="px-2 font-mono text-xs text-foreground font-semibold">
        ${curPage} / ${totalPages}
      </span>

      <button class="btn-reg-page h-8 px-2.5 rounded-md border border-input bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              data-page="${curPage + 1}"
              ${curPage >= totalPages ? 'disabled' : ''}>
        ${getIcon('chevronRight', 'w-3.5 h-3.5')}
      </button>
    `;

    navEl.querySelectorAll('.btn-reg-page').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page'), 10);
        if (p >= 1 && p <= totalPages) {
          this.state.page = p;
          this.renderTableRows();
        }
      });
    });
  },

  bindStaticEvents() {
    // 1. Filter tabs
    this.container.querySelectorAll('.btn-filter-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const newStatus = btn.getAttribute('data-status');
        if (this.state.filterStatus === newStatus) return;

        this.state.filterStatus = newStatus;
        this.state.page = 1;

        // Update tab styles
        this.container.querySelectorAll('.btn-filter-status').forEach(b => {
          const s = b.getAttribute('data-status');
          b.className = `btn-filter-status px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${s === newStatus ? (s === 'PENDING' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-xs' : s === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs' : s === 'REJECTED' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold shadow-xs' : 'bg-card text-foreground shadow-xs') : 'text-muted-foreground hover:text-foreground'}`;
        });

        this.renderTableRows();
      });
    });

    // 2. Search queue input with 150ms debounce
    const searchInput = this.container.querySelector('#input-search-queue');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.state.page = 1;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this.renderTableRows();
        }, 150);
      });
    }

    // 3. Grade filter dropdown
    const gradeSelect = this.container.querySelector('#select-grade-filter');
    if (gradeSelect) {
      gradeSelect.addEventListener('change', (e) => {
        this.state.filterGrade = e.target.value;
        this.state.page = 1;
        this.renderTableRows();
      });
    }

    // 4. Page size dropdown
    const pageSizeSelect = this.container.querySelector('#select-reg-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.state.pageSize = parseInt(e.target.value, 10) || 25;
        this.state.page = 1;
        this.renderTableRows();
      });
    }

    // 5. Select all checkbox
    const selectAllCheck = this.container.querySelector('#check-select-all');
    if (selectAllCheck) {
      selectAllCheck.addEventListener('change', (e) => {
        const filtered = this.getFilteredApplicants();
        const startIndex = (this.state.page - 1) * this.state.pageSize;
        const pageItems = filtered.slice(startIndex, startIndex + this.state.pageSize);

        if (e.target.checked) {
          pageItems.forEach(a => this.state.selectedIds.add(a.id));
        } else {
          pageItems.forEach(a => this.state.selectedIds.delete(a.id));
        }

        this.updateBulkToolbar();
        this.renderTableRows();
      });
    }

    // 6. Bulk Assign Classroom button
    const bulkAssignBtn = this.container.querySelector('#btn-bulk-assign-class');
    if (bulkAssignBtn) {
      bulkAssignBtn.addEventListener('click', () => this.openClassDistributionModal());
    }

    // 7. Bulk Enroll button
    const bulkEnrollBtn = this.container.querySelector('#btn-bulk-enroll');
    if (bulkEnrollBtn) {
      bulkEnrollBtn.addEventListener('click', () => this.openBulkEnrollModal());
    }

    // 8. Bulk Delete button
    const bulkDeleteBtn = this.container.querySelector('#btn-bulk-delete');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => this.handleBulkDelete());
    }

    // 9. Add single applicant button
    const addBtn = this.container.querySelector('#btn-add-applicant');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddApplicantModal());
    }

    // 10. Import button
    const importBtn = this.container.querySelector('#btn-import-queue');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.openImportModal());
    }
  },

  bindRowEvents(tbody) {
    const isKm = i18n.getLocale() === 'km';

    // 1. Row Checkboxes
    tbody.querySelectorAll('.check-row').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = cb.getAttribute('data-id');
        const row = cb.closest('tr');
        if (e.target.checked) {
          this.state.selectedIds.add(id);
          row?.classList.add('bg-primary/5');
        } else {
          this.state.selectedIds.delete(id);
          row?.classList.remove('bg-primary/5');
        }
        this.updateBulkToolbar();
      });
    });

    // 2. Verify/Edit Applicant button
    tbody.querySelectorAll('.btn-verify-applicant').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openVerificationModal(id);
      });
    });

    // 3. Quick Enroll button
    tbody.querySelectorAll('.btn-quick-enroll').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openVerificationModal(id);
      });
    });

    // 4. Delete applicant button
    tbody.querySelectorAll('.btn-delete-applicant').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const applicant = this.cachedApplicants.find(a => a.id === id);
        if (!applicant) return;

        Modal.confirm({
          title: t('registration.deleteConfirmTitle'),
          message: t('registration.deleteConfirmDesc').replace('{name}', applicant.name || 'this applicant'),
          confirmText: t('common.delete'),
          type: 'danger',
          onConfirm: async () => {
            await RegistrationService.delete(id);
            this.state.selectedIds.delete(id);
            this.cachedApplicants = this.cachedApplicants.filter(a => a.id !== id);
            toast.success({ message: 'Deleted applicant record successfully.' });
            this.updateHeaderCounts();
            this.updateBulkToolbar();
            this.renderTableRows();
          }
        });
      });
    });
  },

  updateBulkToolbar() {
    const count = this.state.selectedIds.size;
    const toolbar = document.getElementById('bulk-toolbar');
    const badge = document.getElementById('bulk-count-badge');
    const label = document.getElementById('bulk-count-label');
    const assignLabel = document.getElementById('bulk-assign-class-label');
    const enrollLabel = document.getElementById('bulk-enroll-label');
    const deleteLabel = document.getElementById('bulk-delete-label');
    const isKm = i18n.getLocale() === 'km';

    if (!toolbar) return;

    if (count > 0) {
      toolbar.classList.remove('hidden');
      if (badge) badge.textContent = String(count);
      if (label) label.textContent = isKm ? `បានជ្រើសរើស ${count} នាក់` : `${count} applicants selected`;
      if (assignLabel) assignLabel.textContent = t('registration.btnBulkAssignClass').replace('{count}', count);
      if (enrollLabel) enrollLabel.textContent = t('registration.bulkEnrollBtn').replace('{count}', count);
      if (deleteLabel) deleteLabel.textContent = t('registration.bulkDeleteBtn').replace('{count}', count);
    } else {
      toolbar.classList.add('hidden');
    }
  },

  updateHeaderCounts() {
    const all = this.cachedApplicants || [];
    const pendingCount = all.filter(a => a.verificationStatus === 'PENDING').length;
    const verifiedCount = all.filter(a => a.verificationStatus === 'VERIFIED').length;
    const rejectedCount = all.filter(a => a.verificationStatus === 'REJECTED').length;

    const totalEl = document.getElementById('cnt-total');
    const pendingEl = document.getElementById('cnt-pending');
    const verifiedEl = document.getElementById('cnt-verified');
    const rejectedEl = document.getElementById('cnt-rejected');

    if (totalEl) totalEl.textContent = String(all.length);
    if (pendingEl) pendingEl.textContent = String(pendingCount);
    if (verifiedEl) verifiedEl.textContent = String(verifiedCount);
    if (rejectedEl) rejectedEl.textContent = String(rejectedCount);
  },

  /**
   * Unified 29-Field Verification Modal (ADMISSION_VERIFICATION mode)
   */
  async openVerificationModal(applicantId) {
    const applicant = this.cachedApplicants.find(a => a.id === applicantId) || await RegistrationService.getById(applicantId);
    if (!applicant) {
      toast.error({ message: 'Applicant not found' });
      return;
    }

    await StudentFormModal.open({
      mode: 'ADMISSION_VERIFICATION',
      student: applicant,
      onSave: async (applicantData, modal) => {
        const updated = await RegistrationService.update(applicant.id, applicantData);
        toast.success({ message: t('registration.verifySuccessToast') || 'Applicant verified and saved.' });
        
        // Update in-memory cache
        const idx = this.cachedApplicants.findIndex(a => a.id === applicant.id);
        if (idx !== -1) {
          this.cachedApplicants[idx] = updated;
        }

        modal.close();
        this.updateHeaderCounts();
        this.renderTableRows();
      },
      onEnroll: async (applicantData, modal) => {
        // Save first with all 29 fields
        await RegistrationService.update(applicant.id, applicantData);

        // Then push 1-to-1 into official students store
        const enrolled = await RegistrationService.enrollApplicant(applicant.id, {
          studentId: applicantData.studentId,
          classId: applicantData.classId
        });

        toast.success({ 
          message: t('registration.enrollSuccessToast').replace('{name}', enrolled.khmerName || enrolled.studentId) 
        });

        // Remove from staging cache
        this.cachedApplicants = this.cachedApplicants.filter(a => a.id !== applicant.id);
        this.state.selectedIds.delete(applicant.id);

        modal.close();
        this.updateHeaderCounts();
        this.updateBulkToolbar();
        this.renderTableRows();
      }
    });
  },

  /**
   * Add Single Applicant Modal (via 29-field StudentFormModal)
   */
  async openAddApplicantModal() {
    const nextTempId = await RegistrationService.generateTempId();

    await StudentFormModal.open({
      mode: 'ADMISSION_VERIFICATION',
      student: {
        tempStudentId: nextTempId,
        studentId: nextTempId,
        gender: 'Male',
        verificationStatus: 'PENDING',
        documentsChecked: {
          hardcopyForm: false,
          birthCertificate: false,
          transferLetter: false,
          transcripts: false
        }
      },
      onSave: async (applicantData, modal) => {
        const created = await RegistrationService.create(applicantData);
        toast.success({ message: 'Applicant added to registration queue.' });
        
        this.cachedApplicants.unshift(created);
        modal.close();
        this.updateHeaderCounts();
        this.renderTableRows();
      },
      onEnroll: async (applicantData, modal) => {
        const created = await RegistrationService.create(applicantData);
        const enrolled = await RegistrationService.enrollApplicant(created.id, {
          studentId: applicantData.studentId,
          classId: applicantData.classId
        });
        toast.success({ 
          message: t('registration.enrollSuccessToast').replace('{name}', enrolled.khmerName || enrolled.studentId) 
        });
        modal.close();
        this.updateHeaderCounts();
        this.renderTableRows();
      }
    });
  },

  /**
   * Import Modal (Excel/JSON)
   */
  openImportModal() {
    const isKm = i18n.getLocale() === 'km';
    let parsedRows = [];

    const modalContent = `
      <div class="space-y-4">
        <div class="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-foreground">
          <p class="font-bold text-purple-700 dark:text-purple-400 ${isKm ? 'font-khmer' : ''}">${t('registration.importModalTitle')}</p>
          <p class="text-muted-foreground mt-1 ${isKm ? 'font-khmer' : ''}">${t('registration.importModalDesc')}</p>
        </div>

        <!-- Drag and drop zone -->
        <div id="drop-zone" class="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-8 text-center transition-all bg-muted/20 hover:bg-accent/30 cursor-pointer flex flex-col items-center justify-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center pointer-events-none">
            ${getIcon('fileSpreadsheet', 'w-6 h-6')}
          </div>
          <div class="space-y-1 pointer-events-none">
            <p class="text-xs sm:text-sm font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">
              ${t('registration.dragDropFile')}
            </p>
            <p class="text-[11px] text-muted-foreground">Supported formats: .xlsx, .xls, .json</p>
          </div>
        </div>
        <input type="file" id="file-import-input" accept=".xlsx, .xls, .json" class="hidden">

        <!-- Preview Container -->
        <div id="import-preview-wrapper" class="hidden space-y-3">
          <div class="flex items-center justify-between">
            <h5 id="import-preview-count" class="text-xs font-bold text-foreground"></h5>
            <span class="text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">Ready to import</span>
          </div>
          <div class="max-h-56 overflow-y-auto border border-border rounded-lg">
            <table class="w-full text-left text-xs">
              <thead class="bg-muted/80 text-muted-foreground text-[11px] border-b border-border font-semibold uppercase">
                <tr>
                  <th class="p-2">#</th>
                  <th class="p-2">Name</th>
                  <th class="p-2">Gender</th>
                  <th class="p-2">DOB</th>
                  <th class="p-2">From School</th>
                  <th class="p-2">Grade</th>
                </tr>
              </thead>
              <tbody id="import-preview-tbody" class="divide-y divide-border/60"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <div class="flex items-center justify-end w-full gap-2">
        <button id="btn-import-cancel" class="h-10 px-4 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors cursor-pointer">
          ${t('common.cancel')}
        </button>
        <button id="btn-import-submit" disabled class="h-10 inline-flex items-center gap-1.5 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none text-xs font-semibold transition-colors shadow-xs cursor-pointer">
          ${getIcon('upload', 'w-4 h-4')}
          <span>${t('registration.importBtn')}</span>
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: t('registration.importModalTitle'),
      content: modalContent,
      footer: footer,
      maxWidth: 'max-w-2xl'
    });

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-import-input');
    const previewWrapper = document.getElementById('import-preview-wrapper');
    const previewTbody = document.getElementById('import-preview-tbody');
    const previewCount = document.getElementById('import-preview-count');
    const submitBtn = document.getElementById('btn-import-submit');
    let isImporting = false;

    dropZone?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-primary', 'bg-primary/5');
      if (e.dataTransfer.files?.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) {
        handleFile(e.target.files[0]);
        fileInput.value = '';
      }
    });

    const handleFile = async (file) => {
      try {
        if (!file) return;

        if (file.name.endsWith('.json')) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          parsedRows = Array.isArray(parsed) ? parsed : (parsed.students || parsed.applicants || parsed.data || []);
        } else {
          const data = await file.arrayBuffer();
          const XLSX = StudentExcelService.getXLSX();
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            toast.error({ message: 'Workbook contains no sheets.' });
            return;
          }
          const ws = workbook.Sheets[firstSheetName];

          // Auto-detect header row index
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          let headerRowIdx = 0;
          for (let r = 0; r < Math.min(5, aoa.length); r++) {
            const rowText = (aoa[r] || []).join(' ').toLowerCase();
            if (
              rowText.includes('ឈ្មោះ') ||
              rowText.includes('ភេទ') ||
              rowText.includes('ត្រកូល') ||
              rowText.includes('name') ||
              rowText.includes('gender') ||
              rowText.includes('student') ||
              rowText.includes('ល.រ') ||
              rowText.includes('no')
            ) {
              headerRowIdx = r;
              break;
            }
          }

          parsedRows = XLSX.utils.sheet_to_json(ws, { range: headerRowIdx, defval: '' });
        }

        if (!parsedRows || parsedRows.length === 0) {
          toast.error({ message: 'No rows found in file.' });
          return;
        }

        // Filter valid data rows
        const validRows = parsedRows.filter(r => {
          const norm = RegistrationService.normalizeApplicant(r);
          return norm && (norm.name || norm.lastNameKh || norm.firstNameKh || norm.lastNameLatin || norm.firstNameLatin);
        });

        if (validRows.length === 0) {
          toast.error({ message: 'No valid applicant data rows found in file. Please check column headers.' });
          return;
        }

        parsedRows = validRows;

        // Render preview table
        previewWrapper?.classList.remove('hidden');
        if (previewCount) {
          previewCount.textContent = t('registration.previewTitle').replace('{count}', parsedRows.length);
        }
        if (previewTbody) {
          previewTbody.innerHTML = parsedRows.slice(0, 10).map((row, idx) => {
            const norm = RegistrationService.normalizeApplicant(row);
            return `
              <tr>
                <td class="p-2 font-mono text-muted-foreground">${idx + 1}</td>
                <td class="p-2 font-semibold text-foreground">${norm.name || '-'}</td>
                <td class="p-2">${norm.gender}</td>
                <td class="p-2 font-mono">${norm.dob || '-'}</td>
                <td class="p-2 truncate max-w-[120px]">${norm.lastYearSchool || '-'}</td>
                <td class="p-2">${norm.targetGrade || '-'}</td>
              </tr>
            `;
          }).join('') + (parsedRows.length > 10 ? `<tr><td colspan="6" class="p-2 text-center text-muted-foreground font-mono">... and ${parsedRows.length - 10} more rows</td></tr>` : '');
        }

        if (submitBtn) submitBtn.disabled = false;
      } catch (err) {
        console.error('File parsing error:', err);
        toast.error({ message: 'Failed to read file: ' + err.message });
      }
    };

    document.getElementById('btn-import-cancel')?.addEventListener('click', () => modal.forceClose());

    submitBtn?.addEventListener('click', async () => {
      if (isImporting) return;
      isImporting = true;
      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>⏳ ${t('common.processing') || 'Importing...'}</span>`;
        
        const result = await RegistrationService.importApplicants(parsedRows);
        toast.success({ message: `Imported ${result.imported} applicants into registration queue successfully!` });
        
        modal.forceClose();
        
        await this.loadData(true);
        this.updateHeaderCounts();
        this.renderTableRows();
      } catch (err) {
        console.error('Import error:', err);
        toast.error({ message: 'Import error: ' + err.message });
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${getIcon('upload', 'w-4 h-4')} <span>${t('registration.importBtn')}</span>`;
        isImporting = false;
      }
    });
  },

  /**
   * Class Assignment & Balanced Distribution Modal
   * Supports single-class assignment and alphabetical round-robin auto-distribution across 2+ target classes
   */
  async openClassDistributionModal(presetIds = null) {
    const selectedIds = presetIds || Array.from(this.state.selectedIds);
    if (!selectedIds || selectedIds.length === 0) {
      toast.error({ message: t('common.noSelection') || 'Please select at least one student.' });
      return;
    }

    const applicants = this.cachedApplicants.filter(a => selectedIds.includes(a.id));
    if (!applicants.length) {
      toast.error({ message: 'No matching applicants found.' });
      return;
    }

    const classes = this.state.classes || [];
    const isKm = i18n.getLocale() === 'km';

    if (classes.length === 0) {
      toast.error({ message: 'No classrooms found in the system. Please create a classroom first.' });
      return;
    }

    // Sort applicants alphabetically by first name
    const sortedApplicants = RegistrationService.sortAlphabetically(applicants);

    // Initial selected classes set
    const selectedClassSet = new Set();
    const commonClassId = applicants.find(a => a.assignedClassId)?.assignedClassId;
    if (commonClassId && classes.some(c => c.id === commonClassId)) {
      selectedClassSet.add(commonClassId);
    } else if (classes.length > 0) {
      selectedClassSet.add(classes[0].id);
    }

    // Manual overrides map (studentId -> classId)
    const manualOverrides = new Map();
    // Track auto assigned map for quick lookup
    const autoMap = new Map();

    const unverifiedCount = sortedApplicants.filter(a => a.verificationStatus !== 'VERIFIED').length;

    const modalContent = `
      <div class="space-y-4 text-xs">
        <!-- Unverified warning if applicable -->
        ${unverifiedCount > 0 ? `
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
            ${getIcon('alertTriangle', 'w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500')}
            <div>
              <p class="font-bold">${t('registration.unverifiedWarningInDistribution')}</p>
              <p class="text-[11px] opacity-80 mt-0.5">
                ${isKm ? `មានសិស្សចំនួន ${unverifiedCount} នាក់ក្នុងចំណោម ${sortedApplicants.length} នាក់មិនទាន់ផ្ទៀងផ្ទាត់ឯកសារ។` : `${unverifiedCount} of ${sortedApplicants.length} applicants are unverified.`}
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Class Multi-Select Header Card -->
        <div class="bg-muted/40 border border-border rounded-xl p-3.5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="font-bold text-foreground flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              <span class="w-2 h-2 rounded-full bg-primary"></span>
              <span>${t('registration.selectClassesPrompt')}</span>
            </label>
            <div class="flex items-center gap-2">
              <span id="dist-class-count-badge" class="text-[11px] font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                ${t('registration.selectedClassesCount').replace('{count}', selectedClassSet.size)}
              </span>
              <button type="button" id="btn-dist-select-all" class="text-[11px] font-medium text-primary hover:underline cursor-pointer">
                ${isKm ? 'ជ្រើសទាំងអស់' : 'Select All'}
              </button>
              <span class="text-muted-foreground/40">|</span>
              <button type="button" id="btn-dist-clear-all" class="text-[11px] font-medium text-muted-foreground hover:text-destructive hover:underline cursor-pointer">
                ${isKm ? 'សម្អាត' : 'Clear'}
              </button>
            </div>
          </div>

          <!-- Class Tag Picker Chips -->
          <div id="dist-class-chips-container" class="flex flex-wrap gap-2 pt-1 max-h-40 overflow-y-auto">
            ${classes.map(cls => {
              const isSelected = selectedClassSet.has(cls.id);
              return `
                <button type="button"
                        class="btn-dist-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-card text-foreground border-border hover:bg-muted'
                        }"
                        data-class-id="${cls.id}">
                  <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-muted-foreground/60'}"></span>
                  <span>${this.escapeHtml(cls.name)}</span>
                  <span class="text-[10px] opacity-75 font-mono">(${cls.academicYear || '2024–2025'})</span>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Distribution Mode Info Card -->
          <div id="dist-mode-banner" class="p-2.5 rounded-lg bg-card border border-border/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span id="dist-mode-badge" class="px-2 py-0.5 rounded-md font-bold text-[11px] bg-purple-500/10 text-purple-600 dark:text-purple-400 whitespace-nowrap">
                ${selectedClassSet.size > 1 ? t('registration.distributionModeAuto') : t('registration.distributionModeSingle')}
              </span>
              <span id="dist-mode-hint" class="text-muted-foreground text-[11px]">
                ${t('registration.alphabeticalBalancedHint')}
              </span>
            </div>
          </div>
        </div>

        <!-- Real-Time Distribution Summary Cards -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="font-bold text-foreground text-xs ${isKm ? 'font-khmer' : ''}">
              ${t('registration.summaryDistribution')}
            </span>
          </div>
          <div id="dist-summary-cards" class="flex flex-wrap gap-2 min-h-[36px] items-center">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Interactive Preview & Manual Override Table -->
        <div class="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
          <div class="p-2.5 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <span class="font-semibold text-foreground text-xs">
              ${isKm ? `បញ្ជីសិស្សដែលត្រូវចាត់ថ្នាក់ (${sortedApplicants.length} នាក់)` : `Student Assignment List (${sortedApplicants.length})`}
            </span>
            <span class="text-[11px] text-muted-foreground font-mono">
              ${isKm ? 'តម្រៀបតាមអក្ខរក្រម (A-Z / ក-អ) ដោយស្វ័យប្រវត្តិ' : 'Auto-sorted alphabetically (A-Z / ក-អ)'}
            </span>
          </div>
          <div class="max-h-64 overflow-y-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="sticky top-0 z-10 bg-muted/95 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th class="py-2.5 px-3 w-10 text-center">#</th>
                  <th class="py-2.5 px-3">${t('registration.tableName')}</th>
                  <th class="py-2.5 px-3 w-16 text-center">${t('registration.tableGender')}</th>
                  <th class="py-2.5 px-3 min-w-[180px]">${t('registration.tableColAssignedClass')}</th>
                  <th class="py-2.5 px-3 w-28 text-center">${t('registration.tableStatus')}</th>
                </tr>
              </thead>
              <tbody id="dist-preview-tbody" class="divide-y divide-border text-foreground">
                <!-- Rows rendered via recalcAndRender() -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
        <div class="text-[11px] text-muted-foreground">
          <span id="dist-footer-count" class="font-bold text-foreground">${sortedApplicants.length}</span> ${isKm ? 'សិស្សត្រូវបានជ្រើសរើស' : 'applicants selected'}
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-cancel-dist" type="button" class="h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors cursor-pointer">
            ${t('common.cancel')}
          </button>
          <button id="btn-save-class-only" type="button" class="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-semibold transition-colors cursor-pointer">
            ${getIcon('save', 'w-3.5 h-3.5')}
            <span>${t('registration.btnSaveClassOnly')}</span>
          </button>
          <button id="btn-assign-enroll-now" type="button" class="h-9 inline-flex items-center gap-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer">
            ${getIcon('badgeCheck', 'w-4 h-4')}
            <span>${t('registration.btnAssignAndEnrollNow')}</span>
          </button>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: t('registration.distributeModalTitle'),
      content: modalContent,
      footer: footer,
      maxWidth: 'max-w-4xl'
    });

    const recalcAndRender = (refreshTable = true) => {
      const chosenClasses = classes.filter(c => selectedClassSet.has(c.id));
      const countBadge = document.getElementById('dist-class-count-badge');
      const modeBadge = document.getElementById('dist-mode-badge');
      const modeHint = document.getElementById('dist-mode-hint');
      const summaryContainer = document.getElementById('dist-summary-cards');
      const previewTbody = document.getElementById('dist-preview-tbody');
      const saveBtn = document.getElementById('btn-save-class-only');
      const enrollBtn = document.getElementById('btn-assign-enroll-now');

      if (countBadge) {
        countBadge.textContent = t('registration.selectedClassesCount').replace('{count}', chosenClasses.length);
      }

      // 1. Update Mode Indicators
      if (chosenClasses.length === 0) {
        if (modeBadge) {
          modeBadge.className = 'px-2 py-0.5 rounded-md font-bold text-[11px] bg-rose-500/10 text-rose-600 dark:text-rose-400 whitespace-nowrap';
          modeBadge.textContent = t('registration.noClassSelectedError');
        }
        if (modeHint) {
          modeHint.textContent = isKm ? 'សូមចុចជ្រើសរើសថ្នាក់រៀនខាងលើដើម្បីបន្ត' : 'Please select classroom(s) above';
        }
        if (saveBtn) saveBtn.disabled = true;
        if (enrollBtn) enrollBtn.disabled = true;
      } else if (chosenClasses.length === 1) {
        if (modeBadge) {
          modeBadge.className = 'px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 whitespace-nowrap';
          modeBadge.textContent = `${t('registration.distributionModeSingle')}: ${chosenClasses[0].name}`;
        }
        if (modeHint) {
          modeHint.textContent = isKm ? 'សិស្សទាំងអស់នឹងត្រូវចាត់ចូលថ្នាក់តែមួយនេះ។' : 'All students are directly assigned to this single classroom.';
        }
        if (saveBtn) saveBtn.disabled = false;
        if (enrollBtn) enrollBtn.disabled = false;
      } else {
        if (modeBadge) {
          modeBadge.className = 'px-2 py-0.5 rounded-md font-bold text-[11px] bg-purple-500/10 text-purple-600 dark:text-purple-400 whitespace-nowrap';
          modeBadge.textContent = `${t('registration.distributionModeAuto')} (${chosenClasses.length} ថ្នាក់)`;
        }
        if (modeHint) {
          modeHint.textContent = t('registration.alphabeticalBalancedHint');
        }
        if (saveBtn) saveBtn.disabled = false;
        if (enrollBtn) enrollBtn.disabled = false;
      }

      // 2. Compute Auto Round-Robin Assignments
      autoMap.clear();
      if (chosenClasses.length > 0) {
        sortedApplicants.forEach((student, idx) => {
          const target = chosenClasses[idx % chosenClasses.length];
          autoMap.set(student.id, target.id);
        });
      }

      // 3. Compute Summary Statistics
      const statsMap = new Map();
      classes.forEach(c => {
        statsMap.set(c.id, { name: c.name, total: 0, female: 0, male: 0 });
      });

      sortedApplicants.forEach(student => {
        const effectiveClassId = manualOverrides.get(student.id) || autoMap.get(student.id);
        if (effectiveClassId && statsMap.has(effectiveClassId)) {
          const st = statsMap.get(effectiveClassId);
          st.total++;
          const isFem = (student.gender || '').toLowerCase().includes('female') || (student.gender || '').includes('ស្រី');
          if (isFem) st.female++;
          else st.male++;
        }
      });

      // Render Summary Badges
      if (summaryContainer) {
        if (chosenClasses.length === 0) {
          summaryContainer.innerHTML = `<span class="text-muted-foreground text-xs italic">${t('registration.noClassSelectedError')}</span>`;
        } else {
          // Display active classes + any classes with overrides
          const activeClassesToShow = classes.filter(c => selectedClassSet.has(c.id) || statsMap.get(c.id).total > 0);
          summaryContainer.innerHTML = activeClassesToShow.map(cls => {
            const st = statsMap.get(cls.id);
            return `
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card shadow-xs text-xs">
                <span class="font-bold text-foreground">${this.escapeHtml(st.name)}:</span>
                <span class="font-bold text-primary">${st.total} ${isKm ? 'នាក់' : ''}</span>
                <span class="text-[10px] text-pink-600 dark:text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded font-semibold">${t('registration.femaleCount')}: ${st.female}</span>
                <span class="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-semibold">${t('registration.maleCount')}: ${st.male}</span>
              </div>
            `;
          }).join('');
        }
      }

      // 4. Render Table Body (if requested)
      if (refreshTable && previewTbody) {
        previewTbody.innerHTML = sortedApplicants.map((student, idx) => {
          const effectiveClassId = manualOverrides.get(student.id) || autoMap.get(student.id) || '';
          const khmerFullName = [student.lastNameKh, student.firstNameKh].filter(Boolean).join(' ') || student.name || '-';
          const latinFullName = [student.lastNameLatin, student.firstNameLatin].filter(Boolean).join(' ') || student.englishName || '';
          const isMale = !((student.gender || '').toLowerCase().includes('female') || (student.gender || '').includes('ស្រី'));
          const isVerified = student.verificationStatus === 'VERIFIED';

          return `
            <tr class="hover:bg-accent/30 transition-colors">
              <td class="py-2 px-3 text-center font-mono text-[11px] text-muted-foreground">${idx + 1}</td>
              <td class="py-2 px-3">
                <div class="font-semibold text-foreground">${this.escapeHtml(khmerFullName)}</div>
                ${latinFullName ? `<div class="text-[10px] font-mono text-muted-foreground uppercase">${this.escapeHtml(latinFullName)}</div>` : ''}
              </td>
              <td class="py-2 px-3 text-center">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${isMale ? 'bg-blue-500/10 text-blue-600' : 'bg-pink-500/10 text-pink-600'}">
                  ${isMale ? (isKm ? 'ប្រុស' : 'M') : (isKm ? 'ស្រី' : 'F')}
                </span>
              </td>
              <td class="py-2 px-3">
                <select class="dist-row-select h-8 px-2 rounded-md border border-border bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 cursor-pointer w-full max-w-[200px]"
                        data-student-id="${student.id}">
                  <option value="">-- ${t('registration.selectClassPlaceholder')} --</option>
                  ${classes.map(cls => `
                    <option value="${cls.id}" ${cls.id === effectiveClassId ? 'selected' : ''}>
                      ${cls.name} (${cls.academicYear || '2024–2025'})
                    </option>
                  `).join('')}
                </select>
              </td>
              <td class="py-2 px-3 text-center">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  isVerified ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }">
                  <span class="w-1.5 h-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                  ${isVerified ? t('registration.statusVerified') : t('registration.statusPending')}
                </span>
              </td>
            </tr>
          `;
        }).join('');

        // Bind interactive dropdown changes in preview table
        previewTbody.querySelectorAll('.dist-row-select').forEach(select => {
          select.addEventListener('change', (e) => {
            const sid = select.getAttribute('data-student-id');
            const val = e.target.value;
            if (val) {
              manualOverrides.set(sid, val);
            } else {
              manualOverrides.delete(sid);
            }
            recalcAndRender(false);
          });
        });
      }
    };

    // Initial render
    recalcAndRender(true);

    // Bind Class Chip click toggles
    document.querySelectorAll('.btn-dist-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cid = chip.getAttribute('data-class-id');
        if (selectedClassSet.has(cid)) {
          selectedClassSet.delete(cid);
          chip.className = 'btn-dist-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none bg-card text-foreground border-border hover:bg-muted';
        } else {
          selectedClassSet.add(cid);
          chip.className = 'btn-dist-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none bg-primary text-primary-foreground border-primary shadow-xs';
        }
        manualOverrides.clear();
        recalcAndRender(true);
      });
    });

    // Select All Classes
    document.getElementById('btn-dist-select-all')?.addEventListener('click', () => {
      classes.forEach(c => selectedClassSet.add(c.id));
      document.querySelectorAll('.btn-dist-chip').forEach(chip => {
        chip.className = 'btn-dist-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none bg-primary text-primary-foreground border-primary shadow-xs';
      });
      manualOverrides.clear();
      recalcAndRender(true);
    });

    // Clear All Classes
    document.getElementById('btn-dist-clear-all')?.addEventListener('click', () => {
      selectedClassSet.clear();
      document.querySelectorAll('.btn-dist-chip').forEach(chip => {
        chip.className = 'btn-dist-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none bg-card text-foreground border-border hover:bg-muted';
      });
      manualOverrides.clear();
      recalcAndRender(true);
    });

    document.getElementById('btn-cancel-dist')?.addEventListener('click', () => modal.forceClose());

    // Action 1: Save Class Assignment to Staging Queue
    document.getElementById('btn-save-class-only')?.addEventListener('click', async () => {
      const assignments = sortedApplicants.map(a => {
        const assignedClassId = manualOverrides.get(a.id) || autoMap.get(a.id);
        return { id: a.id, assignedClassId };
      });

      if (assignments.some(a => !a.assignedClassId)) {
        toast.error({ message: t('registration.classRequiredError') });
        return;
      }

      try {
        await RegistrationService.batchAssignClasses(assignments);
        // Update local cache
        assignments.forEach(item => {
          const cached = this.cachedApplicants.find(a => a.id === item.id);
          if (cached) cached.assignedClassId = item.assignedClassId;
        });

        toast.success({ message: t('registration.assignClassSuccessToast').replace('{count}', assignments.length) });
        modal.forceClose();
        this.renderTableRows();
      } catch (err) {
        console.error('Batch assign error:', err);
        toast.error({ message: 'Error saving class assignments: ' + err.message });
      }
    });

    // Action 2: Assign and Enroll into Active School
    document.getElementById('btn-assign-enroll-now')?.addEventListener('click', async () => {
      const classAssignments = {};
      for (const a of sortedApplicants) {
        const assignedClassId = manualOverrides.get(a.id) || autoMap.get(a.id);
        if (!assignedClassId) {
          toast.error({ message: t('registration.classRequiredError') });
          return;
        }
        classAssignments[a.id] = assignedClassId;
      }

      // Check for unverified students
      const unverified = sortedApplicants.filter(a => a.verificationStatus !== 'VERIFIED');
      if (unverified.length > 0) {
        // Auto-verify as part of the Director's explicit enrollment command
        for (const unv of unverified) {
          await RegistrationService.verifyApplicant(unv.id, {
            documentsChecked: {
              hardcopyForm: true,
              birthCertificate: true,
              transferLetter: true,
              transcripts: true
            }
          });
        }
      }

      const enrollBtn = document.getElementById('btn-assign-enroll-now');
      if (enrollBtn) {
        enrollBtn.disabled = true;
        enrollBtn.innerHTML = `<span>⏳ ${t('common.processing') || 'Enrolling...'}</span>`;
      }

      try {
        const applicantIds = sortedApplicants.map(a => a.id);
        const result = await RegistrationService.bulkEnrollApplicants(applicantIds, { classAssignments });

        if (result.enrolled.length > 0) {
          toast.success({ message: t('registration.assignAndEnrollSuccessToast').replace('{count}', result.enrolled.length) });
        }
        if (result.failed.length > 0) {
          toast.error({ message: `Failed to enroll ${result.failed.length} students: ${result.failed[0]?.reason}` });
        }

        this.cachedApplicants = this.cachedApplicants.filter(a => !applicantIds.includes(a.id));
        applicantIds.forEach(id => this.state.selectedIds.delete(id));

        modal.forceClose();
        this.updateHeaderCounts();
        this.updateBulkToolbar();
        this.renderTableRows();
      } catch (err) {
        console.error('Enrollment error:', err);
        toast.error({ message: 'Error enrolling students: ' + err.message });
        if (enrollBtn) {
          enrollBtn.disabled = false;
          enrollBtn.innerHTML = `${getIcon('badgeCheck', 'w-4 h-4')} <span>${t('registration.btnAssignAndEnrollNow')}</span>`;
        }
      }
    });
  },

  /**
   * Bulk Enroll Modal
   */
  async openBulkEnrollModal() {
    const selectedIds = Array.from(this.state.selectedIds);
    const applicants = this.cachedApplicants.filter(a => selectedIds.includes(a.id));
    const classes = this.state.classes || [];
    const isKm = i18n.getLocale() === 'km';

    const modalContent = `
      <div class="space-y-4">
        <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
          <p class="font-bold text-emerald-700 dark:text-emerald-400">
            ${isKm ? `អនុម័ត និងបញ្ចូលសិស្សចំនួន ${applicants.length} នាក់ទៅក្នុងសាលាផ្លូវការ` : `Enroll ${applicants.length} verified applicants into school`}
          </p>
          <p class="text-muted-foreground mt-1">
            ${isKm ? 'ប្រព័ន្ធនឹងបង្កើតអត្តលេខផ្លូវការដោយស្វ័យប្រវត្តិសម្រាប់សិស្សដែលមិនទាន់មានអត្តលេខ។' : 'System will auto-generate official Student IDs for applicants without one.'}
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-foreground mb-1.5 ${isKm ? 'font-khmer' : ''}">
            ${t('registration.targetClassLabel')} (Default for unassigned) <span class="text-destructive">*</span>
          </label>
          <select id="bulk-assign-class" class="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/20 cursor-pointer">
            <option value="">${t('registration.selectClassPlaceholder')}</option>
            ${classes.map(cls => `
              <option value="${cls.id}">${cls.name} (${cls.academicYear || '2024–2025'})</option>
            `).join('')}
          </select>
        </div>

        <div class="max-h-48 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-muted/20">
          ${applicants.map((a, i) => `
            <div class="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-accent/40">
              <span class="font-semibold text-foreground">${i + 1}. ${a.name}</span>
              <span class="text-muted-foreground font-mono text-[11px]">${a.tempStudentId || a.studentId}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const footer = `
      <div class="flex items-center justify-end gap-2">
        <button id="btn-cancel-bulk" class="h-10 px-4 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors cursor-pointer">
          ${t('common.cancel')}
        </button>
        <button id="btn-confirm-bulk-enroll" class="h-10 inline-flex items-center gap-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer">
          ${getIcon('badgeCheck', 'w-4 h-4')}
          <span>${t('registration.btnApproveAndEnroll')}</span>
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: t('registration.bulkEnrollBtn').replace('{count}', applicants.length),
      content: modalContent,
      footer: footer,
      maxWidth: 'max-w-md'
    });

    document.getElementById('btn-cancel-bulk')?.addEventListener('click', () => modal.forceClose());
    document.getElementById('btn-confirm-bulk-enroll')?.addEventListener('click', async () => {
      const defaultClassId = document.getElementById('bulk-assign-class')?.value || null;
      if (!defaultClassId) {
        toast.error({ message: t('registration.classRequiredError') });
        return;
      }

      const confirmBtn = document.getElementById('btn-confirm-bulk-enroll');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span>⏳ ${t('common.processing') || 'Enrolling...'}</span>`;
      }

      try {
        const result = await RegistrationService.bulkEnrollApplicants(selectedIds, { defaultClassId });
        if (result.enrolled.length > 0) {
          toast.success({ message: t('registration.bulkEnrollSuccessToast').replace('{count}', result.enrolled.length) });
        }
        if (result.failed.length > 0) {
          toast.error({ message: `Failed to enroll ${result.failed.length} students: ${result.failed[0]?.reason}` });
        }

        this.cachedApplicants = this.cachedApplicants.filter(a => !selectedIds.includes(a.id));
        this.state.selectedIds.clear();
        modal.forceClose();
        this.updateHeaderCounts();
        this.updateBulkToolbar();
        this.renderTableRows();
      } catch (err) {
        console.error('Bulk enroll error:', err);
        toast.error({ message: 'Error enrolling students: ' + err.message });
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `${getIcon('badgeCheck', 'w-4 h-4')} <span>${t('registration.btnApproveAndEnroll')}</span>`;
        }
      }
    });
  },

  /**
   * Bulk Delete
   */
  handleBulkDelete() {
    const selectedIds = Array.from(this.state.selectedIds);
    Modal.confirm({
      title: t('registration.deleteConfirmTitle'),
      message: `Are you sure you want to delete ${selectedIds.length} applicants from registration staging?`,
      confirmText: t('common.delete'),
      type: 'danger',
      onConfirm: async () => {
        for (const id of selectedIds) {
          await RegistrationService.delete(id);
        }
        this.cachedApplicants = this.cachedApplicants.filter(a => !selectedIds.includes(a.id));
        this.state.selectedIds.clear();
        toast.success({ message: 'Deleted selected applicants successfully.' });
        this.updateHeaderCounts();
        this.updateBulkToolbar();
        this.renderTableRows();
      }
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
