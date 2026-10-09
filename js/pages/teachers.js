import { TeacherService } from '../services/teacherService.js';
import { ExcelExportService } from '../services/excelExportService.js';
import { TeacherFormModal } from '../components/teacherFormModal.js';
import { TeacherCvTemplate } from '../components/teacherCvTemplate.js';
import { ReportViewer } from '../components/reportViewer.js';
import { photoService } from '../services/photoService.js';
import { authService } from '../services/authService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { renderActionDropdown } from '../components/actionDropdown.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export const TeachersPage = {
  container: null,
  cachedTeachers: null,
  state: {
    search: '',
    status: 'all',
    framework: 'all',
    subject: 'all',
    filterField: '',
    filterValue: 'all',
    sortBy: 'teacherId',
    sortDir: 'asc',
    page: 1,
    pageSize: 10,
    userTeacherCount: 0
  },

  async render(container) {
    this.container = container;
    this.state.search = '';
    this.state.status = 'all';
    this.state.framework = 'all';
    this.state.subject = 'all';
    this.state.filterField = '';
    this.state.filterValue = 'all';
    this.state.page = 1;

    const currentUser = authService.getCurrentUser();
    const countPromise = (currentUser && currentUser.role === 'TEACHER')
      ? TeacherService.countByUserId(currentUser.id)
      : Promise.resolve(0);

    const [userCount, allTeachers] = await Promise.all([
      countPromise,
      TeacherService.getAll()
    ]);

    this.state.userTeacherCount = userCount;
    this.cachedTeachers = allTeachers;

    this.renderLayout();
    this.populateFilterValuesDropdown();
    await this.loadData();

    // Listen for data refresh events (e.g. Cloud Sync restore or cross-tab updates)
    if (!this._refreshListenerBound) {
      this._refreshListenerBound = true;
      window.addEventListener('app:refresh-data', async () => {
        this.cachedTeachers = await TeacherService.getAll();
        if (this.container && document.body.contains(this.container)) {
          await this.loadData();
          this.populateFilterValuesDropdown();
        }
      });
    }
  },

  renderLayout() {
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    const isLimitReached = isTeacher && this.state.userTeacherCount >= 1;
    const isKm = i18n.getLocale() === 'km';

    this.container.innerHTML = `
      <div class="space-y-5 pb-12">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
              ${t('teachers.title')}
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1">
              ${t('teachers.subtitle')}
            </p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Hidden File Inputs -->
            <input type="file" id="teacherExcelInput" accept=".xlsx, .xls" class="hidden" />
            <input type="file" id="teacherJsonInput" accept=".json" class="hidden" />

            <!-- Excel Dropdown (Export & Import) -->
            <div class="relative inline-block text-left" id="excel-dropdown-wrapper">
              <button id="btn-excel-dropdown" 
                      type="button" 
                      class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/70 text-xs sm:text-sm font-medium transition-colors shadow-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer select-none">
                ${getIcon('fileSpreadsheet', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
                <span>${t('teachers.excel')}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground ml-0.5')}
              </button>
              <div id="excel-dropdown-menu" class="hidden absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-52 rounded-lg border border-border bg-card/95 backdrop-blur-md text-foreground shadow-lg shadow-black/10 dark:shadow-black/60 z-50 p-1 text-xs sm:text-sm animate-in fade-in-0 zoom-in-95">
                <button id="btn-export-excel" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                  ${getIcon('download', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
                  <span>${t('teachers.exportExcel')}</span>
                </button>
                <button id="btn-import-excel" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                  ${getIcon('upload', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
                  <span>${t('teachers.importExcel')}</span>
                </button>
              </div>
            </div>

            <!-- JSON Dropdown (Export & Import) -->
            <div class="relative inline-block text-left" id="json-dropdown-wrapper">
              <button id="btn-json-dropdown" 
                      type="button" 
                      class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/70 text-xs sm:text-sm font-medium transition-colors shadow-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer select-none">
                ${getIcon('fileCode', 'w-4 h-4 text-blue-600 dark:text-blue-400')}
                <span>${t('teachers.json')}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground ml-0.5')}
              </button>
              <div id="json-dropdown-menu" class="hidden absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-50 rounded-lg border border-border bg-card/95 backdrop-blur-md text-foreground shadow-lg shadow-black/10 dark:shadow-black/60 z-50 p-1 text-xs sm:text-sm animate-in fade-in-0 zoom-in-95">
                <button id="btn-export-json" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                  ${getIcon('download', 'w-4 h-4 text-blue-600 dark:text-blue-400')}
                  <span>${t('teachers.exportJson')}</span>
                </button>
                <button id="btn-import-json" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                  ${getIcon('upload', 'w-4 h-4 text-blue-600 dark:text-blue-400')}
                  <span>${t('teachers.importJson')}</span>
                </button>
              </div>
            </div>

            <!-- Add Teacher Button -->
            <button id="btn-add-teacher" 
                    ${isLimitReached ? 'disabled aria-disabled="true"' : ''}
                    title="${isLimitReached ? t('teachers.profileLimitTooltip') : t('teachers.addTeacher')}"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-sm transition-all ${
                      isLimitReached
                        ? 'bg-muted text-muted-foreground border border-border opacity-50 cursor-not-allowed pointer-events-none'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                    }">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${t('teachers.addTeacher')}</span>
            </button>
          </div>
        </div>

        <!-- Teacher Limit Notice Banner (shown only when teacher role has reached limit: 1) -->
        ${isLimitReached ? `
          <div class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              ${getIcon('shield', 'w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0')}
              <span>${t('teachers.profileLimitNotice')}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              1 / 1 Profile
            </span>
          </div>
        ` : ''}

        <!-- Filter & Search Toolbar -->
        <div class="p-3 sm:p-4 rounded-xl border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 w-full box-border">
          <!-- Left: Search & Two-Step Drill-Down Filter -->
          <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <!-- Search Bar -->
            <div class="relative w-full sm:w-auto sm:min-w-[140px] sm:max-w-[200px]">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                ${getIcon('search', 'w-4 h-4')}
              </span>
              <input type="text" 
                     id="teacher-search-input" 
                     value="${this.state.search}"
                     placeholder="${t('teachers.searchPlaceholder')}"
                     class="w-full h-10 pl-9 pr-3 py-2 bg-background border border-input rounded-md text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs transition-all leading-relaxed" />
            </div>

            <!-- Two-Step Drill-down Filter Group -->
            <div class="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
              <!-- 1. Filter By Field Dropdown -->
              <div class="relative flex-1 sm:flex-initial min-w-[125px] sm:w-36">
                <select id="select-filter-field" 
                        class="w-full h-10 px-2.5 py-2 pr-7 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs leading-relaxed truncate">
                  <option value="">${t('students.filterSelectField') || (isKm ? 'ជ្រើសរើសលក្ខខណ្ឌ...' : 'Filter by field...')}</option>
                  <option value="position" ${this.state.filterField === 'position' ? 'selected' : ''}>${isKm ? 'មុខតំណែង' : 'Position'}</option>
                  <option value="framework" ${this.state.filterField === 'framework' ? 'selected' : ''}>${isKm ? 'ក្របខណ្ឌ' : 'Framework'}</option>
                  <option value="workStatus" ${this.state.filterField === 'workStatus' ? 'selected' : ''}>${isKm ? 'ស្ថានភាពការងារ' : 'Work Status'}</option>
                  <option value="subject" ${this.state.filterField === 'subject' ? 'selected' : ''}>${isKm ? 'មុខវិជ្ជាបង្រៀន' : 'Teaching Subject'}</option>
                  <option value="trainingLevel" ${this.state.filterField === 'trainingLevel' ? 'selected' : ''}>${isKm ? 'កម្រិតបណ្តុះបណ្តាល' : 'Training Level'}</option>
                  <option value="highestDegree" ${this.state.filterField === 'highestDegree' ? 'selected' : ''}>${isKm ? 'សញ្ញាបត្រចុងក្រោយ' : 'Degree'}</option>
                  <option value="gender" ${this.state.filterField === 'gender' ? 'selected' : ''}>${isKm ? 'ភេទ' : 'Gender'}</option>
                  <option value="village" ${this.state.filterField === 'village' ? 'selected' : ''}>${isKm ? 'ភូមិ' : 'Village'}</option>
                  <option value="commune" ${this.state.filterField === 'commune' ? 'selected' : ''}>${isKm ? 'ឃុំ/សង្កាត់' : 'Commune'}</option>
                  <option value="district" ${this.state.filterField === 'district' ? 'selected' : ''}>${isKm ? 'ក្រុង/ស្រុក/ខណ្ឌ' : 'District'}</option>
                  <option value="province" ${this.state.filterField === 'province' ? 'selected' : ''}>${isKm ? 'រាជធានី/ខេត្ត' : 'Province'}</option>
                </select>
              </div>

              <!-- 2. Select Specific Value Dropdown -->
              <div class="relative flex-1 sm:flex-initial min-w-[130px] sm:w-40">
                <select id="select-filter-value" 
                        ${!this.state.filterField ? 'disabled' : ''}
                        class="w-full h-10 px-2.5 py-2 pr-7 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed truncate">
                  <option value="all">${t('students.filterSelectValue') || (isKm ? 'ជ្រើសរើសតម្លៃ...' : 'Select value...')}</option>
                </select>
              </div>

              <!-- Clear Drilldown Filter Button -->
              <button id="btn-clear-drilldown-filter" 
                      type="button" 
                      title="${t('students.filterClear') || (isKm ? 'សម្អាត' : 'Clear')}"
                      class="${!this.state.filterField ? 'hidden' : ''} h-10 px-2 sm:px-2.5 rounded-md border border-border bg-card hover:bg-muted text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-xs flex items-center gap-1 shrink-0 cursor-pointer select-none">
                ${getIcon('x', 'w-3.5 h-3.5')}
                <span class="hidden sm:inline font-normal">${t('students.filterClear') || (isKm ? 'សម្អាត' : 'Clear')}</span>
              </button>
            </div>
          </div>

          <!-- Right: Status filter -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <span class="text-xs text-muted-foreground whitespace-nowrap font-medium">${t('common.status')}:</span>
            <select id="filter-teacher-status" class="h-10 px-3 py-2 pr-8 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs">
              <option value="all">${t('common.all')}</option>
              <option value="Active" ${this.state.status === 'Active' ? 'selected' : ''}>${isKm ? 'សកម្ម' : 'Active'}</option>
              <option value="On Leave" ${this.state.status === 'On Leave' ? 'selected' : ''}>${isKm ? 'ទំនេរគ្មានបៀវត្ស' : 'On Leave'}</option>
              <option value="Transferred" ${this.state.status === 'Transferred' ? 'selected' : ''}>${isKm ? 'ផ្ទេរចេញ' : 'Transferred'}</option>
              <option value="Retired" ${this.state.status === 'Retired' ? 'selected' : ''}>${isKm ? 'ចូលនិវត្តន៍' : 'Retired'}</option>
              <option value="Inactive" ${this.state.status === 'Inactive' ? 'selected' : ''}>${isKm ? 'អសកម្ម' : 'Inactive'}</option>
            </select>
          </div>
        </div>

        <!-- Teachers Table Card with all 44 MoEYS Columns -->
        <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div class="overflow-x-auto max-w-full">
            <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr class="border-b border-border bg-muted/50 text-muted-foreground font-semibold select-none">
                  <!-- 1. ស្ថានភាព -->
                  <th class="px-3 py-3 text-center">${isKm ? 'ស្ថានភាព' : 'Status'}</th>
                  <!-- 2. ល.រ -->
                  <th class="px-3 py-3 text-center">${isKm ? 'ល.រ' : '#'}</th>
                  <!-- 3. រូបភាព -->
                  <th class="px-3 py-3 text-center">${isKm ? 'រូបថត' : 'Photo'}</th>
                  <!-- 4. លេខសម្គាល់ -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="teacherId">
                    <div class="flex items-center gap-1">
                      <span>${isKm ? 'លេខសម្គាល់' : 'Teacher ID'}</span>
                      <span class="sort-icon">${this.getSortIcon('teacherId')}</span>
                    </div>
                  </th>
                  <!-- 5. អត្តលេខមន្ត្រីរាជការ -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="civilServantId">
                    <div class="flex items-center gap-1">
                      <span>${isKm ? 'អត្តលេខមន្ត្រីរាជការ' : 'Civil Servant ID'}</span>
                      <span class="sort-icon">${this.getSortIcon('civilServantId')}</span>
                    </div>
                  </th>
                  <!-- 6. លេខអត្តសញ្ញាណប័ណ្ណ -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="nationalId">
                    <div class="flex items-center gap-1">
                      <span>${isKm ? 'លេខអត្តសញ្ញាណប័ណ្ណ' : 'National ID'}</span>
                      <span class="sort-icon">${this.getSortIcon('nationalId')}</span>
                    </div>
                  </th>
                  <!-- លេខគណនីធនាគារ -->
                  <th class="px-3 py-3">${isKm ? 'លេខគណនីធនាគារ' : 'Bank Account'}</th>
                  <!-- 7. ត្រកូល -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="lastNameKhmer">
                    <div class="flex items-center gap-1">
                      <span>${isKm ? 'ត្រកូល' : 'Khmer Surname'}</span>
                      <span class="sort-icon">${this.getSortIcon('lastNameKhmer')}</span>
                    </div>
                  </th>
                  <!-- 8. នាមខ្លួន -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="firstNameKhmer">
                    <div class="flex items-center gap-1">
                      <span>${isKm ? 'នាមខ្លួន' : 'Khmer First Name'}</span>
                      <span class="sort-icon">${this.getSortIcon('firstNameKhmer')}</span>
                    </div>
                  </th>
                  <!-- 9. ត្រកូលឡាតាំង -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="lastNameLatin">
                    <div class="flex items-center gap-1">
                      <span>${isKm ? 'ត្រកូលឡាតាំង' : 'Latin Surname'}</span>
                      <span class="sort-icon">${this.getSortIcon('lastNameLatin')}</span>
                    </div>
                  </th>
                  <!-- 10. នាមខ្លួនឡាតាំង -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="firstNameLatin">
                    <div class="flex items-center gap-1">
                      <span>${isKm ? 'នាមខ្លួនឡាតាំង' : 'Latin First Name'}</span>
                      <span class="sort-icon">${this.getSortIcon('firstNameLatin')}</span>
                    </div>
                  </th>
                  <!-- 11. ភេទ -->
                  <th class="px-3 py-3 text-center cursor-pointer hover:text-foreground transition-colors" data-sort="gender">
                    <div class="flex items-center justify-center gap-1">
                      <span>${isKm ? 'ភេទ' : 'Gender'}</span>
                      <span class="sort-icon">${this.getSortIcon('gender')}</span>
                    </div>
                  </th>
                  <!-- 12. ថ្ងៃខែឆ្នាំកំណើត -->
                  <th class="px-3 py-3 text-center cursor-pointer hover:text-foreground transition-colors" data-sort="dob">
                    <div class="flex items-center justify-center gap-1">
                      <span>${isKm ? 'ថ្ងៃខែឆ្នាំកំណើត' : 'Date of Birth'}</span>
                      <span class="sort-icon">${this.getSortIcon('dob')}</span>
                    </div>
                  </th>
                  <!-- 13. អាយុ -->
                  <th class="px-3 py-3 text-center cursor-pointer hover:text-foreground transition-colors" data-sort="age">
                    <div class="flex items-center justify-center gap-1">
                      <span>${isKm ? 'អាយុ' : 'Age'}</span>
                      <span class="sort-icon">${this.getSortIcon('age')}</span>
                    </div>
                  </th>
                  <!-- 14. ថ្ងៃខែឆ្នាំចូលបម្រើការងារ -->
                  <th class="px-3 py-3 text-center cursor-pointer hover:text-foreground transition-colors" data-sort="joinedDate">
                    <div class="flex items-center justify-center gap-1">
                      <span>${isKm ? 'ថ្ងៃចូលបម្រើការងារ' : 'Date Joined'}</span>
                      <span class="sort-icon">${this.getSortIcon('joinedDate')}</span>
                    </div>
                  </th>
                  <!-- ថ្ងៃតាំងស៊ប់ក្នុងក្របខណ្ឌ -->
                  <th class="px-3 py-3 text-center">${isKm ? 'ថ្ងៃតាំងស៊ប់' : 'Permanent Date'}</th>
                  <!-- 15. ថ្ងៃខែឆ្នាំចូលនិវត្តន៍ -->
                  <th class="px-3 py-3 text-center cursor-pointer hover:text-foreground transition-colors" data-sort="retirementDate">
                    <div class="flex items-center justify-center gap-1">
                      <span>${isKm ? 'ថ្ងៃចូលនិវត្តន៍' : 'Retirement Date'}</span>
                      <span class="sort-icon">${this.getSortIcon('retirementDate')}</span>
                    </div>
                  </th>
                  <!-- ស្ថានភាពគ្រួសារ -->
                  <th class="px-3 py-3 text-center cursor-pointer hover:text-foreground transition-colors" data-sort="maritalStatus">
                    <div class="flex items-center justify-center gap-1">
                      <span>${isKm ? 'ស្ថានភាពគ្រួសារ' : 'Marital Status'}</span>
                      <span class="sort-icon">${this.getSortIcon('maritalStatus')}</span>
                    </div>
                  </th>
                  <!-- ឈ្មោះប្តី/ប្រពន្ធ -->
                  <th class="px-3 py-3">${isKm ? 'ឈ្មោះប្តី/ប្រពន្ធ' : 'Spouse Name'}</th>
                  <!-- ចំនួនកូន -->
                  <th class="px-3 py-3 text-center">${isKm ? 'ចំនួនកូន' : 'Children'}</th>
                  <!-- 16. ភូមិកំណើត -->
                  <th class="px-3 py-3">${isKm ? 'ភូមិកំណើត' : 'Birth Village'}</th>
                  <!-- 17. ឃុំកំណើត -->
                  <th class="px-3 py-3">${isKm ? 'ឃុំកំណើត' : 'Birth Commune'}</th>
                  <!-- 18. ស្រុកកំណើត -->
                  <th class="px-3 py-3">${isKm ? 'ស្រុកកំណើត' : 'Birth District'}</th>
                  <!-- 19. ខេត្តកំណើត -->
                  <th class="px-3 py-3">${isKm ? 'ខេត្តកំណើត' : 'Birth Province'}</th>
                  <!-- 20. ភូមិបច្ចុប្បន្ន -->
                  <th class="px-3 py-3">${isKm ? 'ភូមិបច្ចុប្បន្ន' : 'Current Village'}</th>
                  <!-- 21. ឃុំបច្ចុប្បន្ន -->
                  <th class="px-3 py-3">${isKm ? 'ឃុំបច្ចុប្បន្ន' : 'Current Commune'}</th>
                  <!-- 22. ស្រុកបច្ចុប្បន្ន -->
                  <th class="px-3 py-3">${isKm ? 'ស្រុកបច្ចុប្បន្ន' : 'Current District'}</th>
                  <!-- 23. ខេត្តបច្ចុប្បន្ន -->
                  <th class="px-3 py-3">${isKm ? 'ខេត្តបច្ចុប្បន្ន' : 'Current Province'}</th>
                  <!-- 24. ស្ថានភាពការងារ -->
                  <th class="px-3 py-3">${isKm ? 'ស្ថានភាពការងារ' : 'Work Status'}</th>
                  <!-- 25. ក្របខណ្ឌ -->
                  <th class="px-3 py-3">${isKm ? 'ក្របខណ្ឌ' : 'Framework'}</th>
                  <!-- 26. ឋានន្តរស័ក្តិ និងថ្នាក់ -->
                  <th class="px-3 py-3">${isKm ? 'ឋានន្តរស័ក្តិ និងថ្នាក់' : 'Rank & Grade'}</th>
                  <!-- 27. មុខតំណែង -->
                  <th class="px-3 py-3">${isKm ? 'មុខតំណែង' : 'Position'}</th>
                  <!-- 28. កម្រិតបណ្តុះបណ្តាល -->
                  <th class="px-3 py-3">${isKm ? 'កម្រិតបណ្តុះបណ្តាល' : 'Training Level'}</th>
                  <!-- 29. ឯកទេសទី១ -->
                  <th class="px-3 py-3">${isKm ? 'ឯកទេសទី១' : 'Specialization 1'}</th>
                  <!-- 30. ឯកទេសទី២ -->
                  <th class="px-3 py-3">${isKm ? 'ឯកទេសទី២' : 'Specialization 2'}</th>
                  <!-- 31. បំណែងចែកភារកិច្ច -->
                  <th class="px-3 py-3">${isKm ? 'បំណែងចែកភារកិច្ច' : 'Task Assignment'}</th>
                  <!-- 32. ភារកិច្ចបន្ថែម -->
                  <th class="px-3 py-3">${isKm ? 'ភារកិច្ចបន្ថែម' : 'Additional Duties'}</th>
                  <!-- 33. សញ្ញាបត្រចុងក្រោយ -->
                  <th class="px-3 py-3">${isKm ? 'សញ្ញាបត្រចុងក្រោយ' : 'Highest Degree'}</th>
                  <!-- 34. ឯកទេសសញ្ញាបត្រចុងក្រោយ -->
                  <th class="px-3 py-3">${isKm ? 'ឯកទេសសញ្ញាបត្រ' : 'Degree Major'}</th>
                  <!-- កម្រិតវប្បធម៌ទូទៅ -->
                  <th class="px-3 py-3">${isKm ? 'កម្រិតវប្បធម៌ទូទៅ' : 'General Education'}</th>
                  <!-- គ្រឹះស្ថានសិក្សាទូទៅ -->
                  <th class="px-3 py-3">${isKm ? 'សាលារៀនទូទៅ' : 'Gen Ed School'}</th>
                  <!-- សញ្ញាបត្រទូទៅ -->
                  <th class="px-3 py-3">${isKm ? 'សញ្ញាបត្រទូទៅ' : 'Gen Ed Degree'}</th>
                  <!-- 35. មុខវិជ្ជាទី១ -->
                  <th class="px-3 py-3">${isKm ? 'មុខវិជ្ជាទី១' : 'Subject 1'}</th>
                  <!-- 36. ម៉ោងទី១/សប្តាហ៍ -->
                  <th class="px-3 py-3 text-center">${isKm ? 'ម៉ោងទី១' : 'Hours 1'}</th>
                  <!-- 37. មុខវិជ្ជាទី២ -->
                  <th class="px-3 py-3">${isKm ? 'មុខវិជ្ជាទី២' : 'Subject 2'}</th>
                  <!-- 38. ម៉ោងទី២/សប្តាហ៍ -->
                  <th class="px-3 py-3 text-center">${isKm ? 'ម៉ោងទី២' : 'Hours 2'}</th>
                  <!-- 39. មុខវិជ្ជាទី៣ -->
                  <th class="px-3 py-3">${isKm ? 'មុខវិជ្ជាទី៣' : 'Subject 3'}</th>
                  <!-- 40. ម៉ោងទី៣/សប្តាហ៍ -->
                  <th class="px-3 py-3 text-center">${isKm ? 'ម៉ោងទី៣' : 'Hours 3'}</th>
                  <!-- 41. លេខទូរសព្ទទី១ -->
                  <th class="px-3 py-3">${isKm ? 'លេខទូរសព្ទទី១' : 'Phone 1'}</th>
                  <!-- 42. លេខទូរសព្ទទី២ -->
                  <th class="px-3 py-3">${isKm ? 'លេខទូរសព្ទទី២' : 'Phone 2'}</th>
                  <!-- 43. តេឡេក្រាម -->
                  <th class="px-3 py-3">${isKm ? 'តេឡេក្រាម' : 'Telegram'}</th>
                  <!-- 44. អ៊ីមែល -->
                  <th class="px-3 py-3">${isKm ? 'អ៊ីមែល' : 'Email'}</th>
                  <!-- 45. ផ្សេងៗ -->
                  <th class="px-3 py-3">${isKm ? 'ផ្សេងៗ' : 'Notes'}</th>
                  <!-- 46. សកម្មភាព (Sticky Right) -->
                  <th class="w-[50px] px-2 py-3 text-center sticky right-0 bg-muted z-30">${isKm ? 'សកម្មភាព' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody id="teacher-table-body" class="divide-y divide-border">
                <tr>
                  <td colspan="54" class="py-12 text-center text-muted-foreground">
                    <div class="flex items-center justify-center gap-2">
                      <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                      <span>${t('common.loading')}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div id="pagination-footer" class="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground select-none">
            <div id="teacher-page-info">Showing records...</div>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <span>${isKm ? 'ចំនួនជួរដេកក្នុងមួយទំព័រ៖' : 'Rows per page:'}</span>
                <select id="select-teacher-page-size" class="h-8 px-2 py-1 pr-6 rounded-md border border-input bg-card text-foreground box-border shadow-xs">
                  <option value="10" ${this.state.pageSize === 10 ? 'selected' : ''}>10</option>
                  <option value="25" ${this.state.pageSize === 25 ? 'selected' : ''}>25</option>
                  <option value="50" ${this.state.pageSize === 50 ? 'selected' : ''}>50</option>
                </select>
              </div>
              <div id="teacher-page-nav" class="flex items-center gap-1"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindStaticEvents();
  },

  getUniqueValuesForField(teachers, fieldKey) {
    if (!teachers || !fieldKey) return [];
    const isKm = i18n.getLocale() === 'km';
    const set = new Set();

    if (fieldKey === 'village') {
      teachers.forEach(t => {
        if (t.currentVillage?.trim()) set.add(t.currentVillage.trim());
        if (t.birthVillage?.trim()) set.add(t.birthVillage.trim());
      });
    } else if (fieldKey === 'commune') {
      teachers.forEach(t => {
        if (t.currentCommune?.trim()) set.add(t.currentCommune.trim());
        if (t.birthCommune?.trim()) set.add(t.birthCommune.trim());
      });
    } else if (fieldKey === 'district') {
      teachers.forEach(t => {
        if (t.currentDistrict?.trim()) set.add(t.currentDistrict.trim());
        if (t.birthDistrict?.trim()) set.add(t.birthDistrict.trim());
      });
    } else if (fieldKey === 'province') {
      teachers.forEach(t => {
        if (t.currentProvince?.trim()) set.add(t.currentProvince.trim());
        if (t.birthProvince?.trim()) set.add(t.birthProvince.trim());
      });
    } else if (fieldKey === 'subject') {
      teachers.forEach(t => {
        if (t.subject1?.trim()) set.add(t.subject1.trim());
        if (t.subject2?.trim()) set.add(t.subject2.trim());
        if (t.subject3?.trim()) set.add(t.subject3.trim());
        if (t.subject?.trim()) set.add(t.subject.trim());
      });
    } else if (fieldKey === 'specialization') {
      teachers.forEach(t => {
        if (t.specialization1?.trim()) set.add(t.specialization1.trim());
        if (t.specialization2?.trim()) set.add(t.specialization2.trim());
      });
    } else if (fieldKey === 'gender') {
      teachers.forEach(t => {
        if (t.gender?.trim()) set.add(t.gender.trim());
      });
    } else {
      teachers.forEach(t => {
        const val = t[fieldKey];
        if (val && typeof val === 'string' && val.trim() !== '') {
          set.add(val.trim());
        }
      });
    }

    const items = Array.from(set).map(val => {
      let label = val;
      if (fieldKey === 'gender') {
        if (val.toLowerCase() === 'female' || val === 'ស្រី') label = t('common.female');
        else if (val.toLowerCase() === 'male' || val === 'ប្រុស') label = t('common.male');
      }
      return { value: val, label };
    });

    return items.sort((a, b) =>
      a.label.localeCompare(b.label, ['km', 'en'], { numeric: true, sensitivity: 'base' })
    );
  },

  populateFilterValuesDropdown() {
    const valueSelect = document.getElementById('select-filter-value');
    const clearBtn = document.getElementById('btn-clear-drilldown-filter');
    if (!valueSelect) return;

    if (!this.state.filterField) {
      valueSelect.disabled = true;
      valueSelect.innerHTML = `<option value="all">${t('students.filterSelectValue') || 'ជ្រើសរើសតម្លៃ...'}</option>`;
      clearBtn?.classList.add('hidden');
      return;
    }

    valueSelect.disabled = false;
    clearBtn?.classList.remove('hidden');

    const uniqueOptions = this.getUniqueValuesForField(this.cachedTeachers || [], this.state.filterField);

    let html = `<option value="all">${t('students.filterAllValues') || 'ទាំងអស់'} (${uniqueOptions.length})</option>`;
    uniqueOptions.forEach(opt => {
      const isSelected = this.state.filterValue === opt.value;
      html += `<option value="${opt.value}" ${isSelected ? 'selected' : ''}>${opt.label}</option>`;
    });

    valueSelect.innerHTML = html;
  },

  getSortIcon(col) {
    if (this.state.sortBy !== col) return '↕';
    return this.state.sortDir === 'asc' ? '↑' : '↓';
  },

  async loadData(forceRefresh = false) {
    if (!this.cachedTeachers || forceRefresh) {
      this.cachedTeachers = await TeacherService.getAll();
    }

    const result = await TeacherService.query({
      search: this.state.search,
      status: this.state.status,
      framework: this.state.framework,
      subject: this.state.subject,
      filterField: this.state.filterField,
      filterValue: this.state.filterValue,
      sortBy: this.state.sortBy,
      sortDir: this.state.sortDir,
      page: this.state.page,
      pageSize: this.state.pageSize
    });

    this.renderTableRows(result.data, result.page, result.pageSize);
    this.renderPagination(result);
  },

  renderTableRows(teachers, page = 1, pageSize = 10) {
    const tbody = document.getElementById('teacher-table-body');
    if (!tbody) return;
    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();
    const isTeacherRole = currentUser?.role === 'TEACHER';
    const canDelete = authService.can('teachers.delete') && !isTeacherRole;

    if (!teachers || teachers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="54" class="py-12 text-center text-muted-foreground">
            <div class="max-w-xs mx-auto space-y-2">
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                ${getIcon('search', 'w-5 h-5')}
              </div>
              <p class="text-xs font-medium">${t('teachers.emptyList')}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = teachers.map((tchr, idx) => {
      const rowNo = (page - 1) * pageSize + idx + 1;
      const photoUrl = tchr.photoBlob ? photoService.getUrlForBlob(tchr.photoBlob) : (tchr.photo && tchr.photo.startsWith('data:') ? tchr.photo : null);
      const initialLetter = tchr.firstNameLatin ? tchr.firstNameLatin.charAt(0).toUpperCase() : (tchr.firstNameKhmer ? tchr.firstNameKhmer.charAt(0) : 'T');

      // Status Badge Style matching students.js
      let statusBadgeClasses = 'bg-muted text-muted-foreground';
      if (tchr.status === 'Active') {
        statusBadgeClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      } else if (tchr.status === 'Inactive') {
        statusBadgeClasses = 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20';
      } else if (tchr.status === 'On Leave' || tchr.status === 'Transferred') {
        statusBadgeClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      } else if (tchr.status === 'Retired') {
        statusBadgeClasses = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      }

      const statusLabel = isKm 
        ? (tchr.status === 'Active' ? 'សកម្ម' : (tchr.status === 'On Leave' ? 'ទំនេរ' : (tchr.status === 'Transferred' ? 'ផ្ទេរចេញ' : (tchr.status === 'Retired' ? 'ចូលនិវត្តន៍' : 'អសកម្ម')))) 
        : tchr.status;

      const statusBadge = `
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClasses}">
          ${statusLabel}
        </span>
      `;

      const photoBadge = `
        <div class="w-8 h-8 rounded-full overflow-hidden mx-auto flex-shrink-0 bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-border">
          ${photoUrl 
            ? `<img src="${photoUrl}" alt="${tchr.englishName || ''}" class="w-full h-full object-cover" />` 
            : initialLetter}
        </div>
      `;

      // Row Actions
      const actions = [
        {
          label: isKm ? 'មើលព័ត៌មានលម្អិត' : 'View Profile',
          icon: 'user',
          onClick: async () => {
            const teacher = await TeacherService.getById(tchr.id);
            if (teacher) this.openTeacherProfileModal(teacher);
          }
        },
        {
          label: isKm ? 'បោះពុម្ពជីវប្រវត្តិមន្ត្រីរាជការ (MoEYS CV)' : 'Print MoEYS Profile / CV',
          icon: 'fileText',
          onClick: async () => {
            const teacher = await TeacherService.getById(tchr.id);
            if (teacher) this.openTeacherCvReport(teacher);
          }
        },
        {
          label: isKm ? 'កែប្រែ' : 'Edit',
          icon: 'pencil',
          onClick: async () => {
            const teacher = await TeacherService.getById(tchr.id);
            if (teacher) {
              await TeacherFormModal.open({
                teacher,
                onSave: async () => {
                  await this.refreshData();
                }
              });
            }
          }
        }
      ];

      // Add delete option only for privileged roles (Director/Admin)
      if (canDelete) {
        actions.push({
          label: isKm ? 'លុប' : 'Delete',
          icon: 'trash2',
          destructive: true,
          onClick: async () => {
            const teacher = await TeacherService.getById(tchr.id);
            if (!teacher) return;
            Modal.confirm({
              title: t('common.delete'),
              message: t('teachers.confirmDelete', { name: `${teacher.khmerName || teacher.lastNameKhmer} (${teacher.englishName || teacher.lastNameLatin})` }),
              destructive: true,
              onConfirm: async () => {
                await TeacherService.delete(tchr.id);
                toast.success(t('teachers.deletedSuccess'));
                await this.refreshData();
              }
            });
          }
        });
      }

      const formatVal = (v) => v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : '—';

      return `
        <tr class="hover:bg-muted/40 transition-colors" data-teacher-id="${tchr.id}">
          <!-- 1. ស្ថានភាព -->
          <td class="px-3 py-2.5 text-center">
            ${statusBadge}
          </td>
          <!-- 2. ល.រ -->
          <td class="px-3 py-2.5 text-center font-mono text-muted-foreground font-medium">
            ${rowNo}
          </td>
          <!-- 3. រូបភាព -->
          <td class="px-3 py-2.5 text-center">
            ${photoBadge}
          </td>
          <!-- 4. លេខសម្គាល់ -->
          <td class="px-3 py-2.5 font-mono font-semibold text-foreground">
            ${formatVal(tchr.teacherId)}
          </td>
          <!-- 5. អត្តលេខមន្ត្រីរាជការ -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">
            ${formatVal(tchr.civilServantId)}
          </td>
          <!-- 6. លេខអត្តសញ្ញាណប័ណ្ណ -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">
            ${formatVal(tchr.nationalId)}
          </td>
          <!-- លេខគណនីធនាគារ -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">
            ${formatVal(tchr.bankAccount)}
          </td>
          <!-- 7. ត្រកូល -->
          <td class="px-3 py-2.5 font-khmer text-foreground">
            ${formatVal(tchr.lastNameKhmer || tchr.lastNameKh)}
          </td>
          <!-- 8. នាមខ្លួន -->
          <td class="px-3 py-2.5 font-khmer text-foreground">
            ${formatVal(tchr.firstNameKhmer || tchr.firstNameKh)}
          </td>
          <!-- 9. ត្រកូលឡាតាំង -->
          <td class="px-3 py-2.5 text-foreground font-medium uppercase">
            ${formatVal(tchr.lastNameLatin)}
          </td>
          <!-- 10. នាមខ្លួនឡាតាំង -->
          <td class="px-3 py-2.5 text-foreground font-medium">
            ${formatVal(tchr.firstNameLatin)}
          </td>
          <!-- 11. ភេទ -->
          <td class="px-3 py-2.5 text-center">
            ${tchr.gender === 'Female' || tchr.gender === 'ស្រី' ? (isKm ? 'ស្រី' : 'Female') : (isKm ? 'ប្រុស' : 'Male')}
          </td>
          <!-- 12. ថ្ងៃខែឆ្នាំកំណើត -->
          <td class="px-3 py-2.5 text-center font-mono text-muted-foreground">
            ${formatDisplayDate(tchr.dob || tchr.dateOfBirth) || '—'}
          </td>
          <!-- 13. អាយុ -->
          <td class="px-3 py-2.5 text-center font-mono font-bold text-primary">
            ${formatVal(tchr.age)}
          </td>
          <!-- 14. ថ្ងៃខែឆ្នាំចូលបម្រើការងារ -->
          <td class="px-3 py-2.5 text-center font-mono text-muted-foreground">
            ${formatDisplayDate(tchr.joinedDate) || '—'}
          </td>
          <!-- ថ្ងៃតាំងស៊ប់ក្នុងក្របខណ្ឌ -->
          <td class="px-3 py-2.5 text-center font-mono text-muted-foreground">
            ${formatDisplayDate(tchr.permanentAppointmentDate) || '—'}
          </td>
          <!-- 15. ថ្ងៃខែឆ្នាំចូលនិវត្តន៍ -->
          <td class="px-3 py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
            ${formatDisplayDate(tchr.retirementDate) || '—'}
          </td>
          <!-- ស្ថានភាពគ្រួសារ -->
          <td class="px-3 py-2.5 text-center font-medium">
            ${tchr.maritalStatus === 'Married' ? (isKm ? 'រៀបការរួច' : 'Married') : 
              (tchr.maritalStatus === 'Divorced' ? (isKm ? 'លែងលះ' : 'Divorced') : 
              (tchr.maritalStatus === 'Widowed' ? (isKm ? 'ពោះម៉ាយ/មេម៉ាយ' : 'Widowed') : 
              (isKm ? 'នៅលីវ' : 'Single')))}
          </td>
          <!-- ឈ្មោះប្តី/ប្រពន្ធ -->
          <td class="px-3 py-2.5 text-foreground">${formatVal(tchr.spouseName)}</td>
          <!-- ចំនួនកូន -->
          <td class="px-3 py-2.5 text-center font-medium">${formatVal(tchr.childrenCount)}</td>
          <!-- 16. ភូមិកំណើត -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.birthVillage)}</td>
          <!-- 17. ឃុំកំណើត -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.birthCommune)}</td>
          <!-- 18. ស្រុកកំណើត -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.birthDistrict)}</td>
          <!-- 19. ខេត្តកំណើត -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.birthProvince)}</td>
          <!-- 20. ភូមិបច្ចុប្បន្ន -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.currentVillage)}</td>
          <!-- 21. ឃុំបច្ចុប្បន្ន -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.currentCommune)}</td>
          <!-- 22. ស្រុកបច្ចុប្បន្ន -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.currentDistrict)}</td>
          <!-- 23. ខេត្តបច្ចុប្បន្ន -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.currentProvince)}</td>
          <!-- 24. ស្ថានភាពការងារ -->
          <td class="px-3 py-2.5 text-foreground font-medium">${formatVal(tchr.workStatus)}</td>
          <!-- 25. ក្របខណ្ឌ -->
          <td class="px-3 py-2.5 text-foreground font-medium">${formatVal(tchr.framework)}</td>
          <!-- 26. ឋានន្តរស័ក្តិ និងថ្នាក់ -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.rankAndGrade)}</td>
          <!-- 27. មុខតំណែង -->
          <td class="px-3 py-2.5 text-foreground font-medium">${formatVal(tchr.position)}</td>
          <!-- 28. កម្រិតបណ្តុះបណ្តាល -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.trainingLevel)}</td>
          <!-- 29. ឯកទេសទី១ -->
          <td class="px-3 py-2.5 text-primary font-medium">${formatVal(tchr.specialization1)}</td>
          <!-- 30. ឯកទេសទី២ -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.specialization2)}</td>
          <!-- 31. បំណែងចែកភារកិច្ច -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.taskAssignment)}</td>
          <!-- 32. ភារកិច្ចបន្ថែម -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.additionalDuties)}</td>
          <!-- 33. សញ្ញាបត្រចុងក្រោយ -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.highestDegree)}</td>
          <!-- 34. ឯកទេសសញ្ញាបត្រចុងក្រោយ -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.highestDegreeMajor)}</td>
          <!-- កម្រិតវប្បធម៌ទូទៅ -->
          <td class="px-3 py-2.5 text-foreground">${formatVal(tchr.generalEducationLevel)}</td>
          <!-- សាលារៀនទូទៅ -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.generalEducationSchool)}</td>
          <!-- សញ្ញាបត្រទូទៅ -->
          <td class="px-3 py-2.5 text-muted-foreground">${formatVal(tchr.generalEducationDegree)}</td>
          <!-- 35. មុខវិជ្ជាទី១ -->
          <td class="px-3 py-2.5 text-primary font-medium">${formatVal(tchr.subject1 || tchr.subject)}</td>
          <!-- 36. ម៉ោងទី១/សប្តាហ៍ -->
          <td class="px-3 py-2.5 text-center font-mono">${formatVal(tchr.hoursPerWeek1)}</td>
          <!-- 37. មុខវិជ្ជាទី២ -->
          <td class="px-3 py-2.5 text-foreground">${formatVal(tchr.subject2)}</td>
          <!-- 38. ម៉ោងទី២/សប្តាហ៍ -->
          <td class="px-3 py-2.5 text-center font-mono">${formatVal(tchr.hoursPerWeek2)}</td>
          <!-- 39. មុខវិជ្ជាទី៣ -->
          <td class="px-3 py-2.5 text-foreground">${formatVal(tchr.subject3)}</td>
          <!-- 40. ម៉ោងទី៣/សប្តាហ៍ -->
          <td class="px-3 py-2.5 text-center font-mono">${formatVal(tchr.hoursPerWeek3)}</td>
          <!-- 41. លេខទូរសព្ទទី១ -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">${formatVal(tchr.phone1 || tchr.phone)}</td>
          <!-- 42. លេខទូរសព្ទទី២ -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">${formatVal(tchr.phone2)}</td>
          <!-- 43. តេឡេក្រាម -->
          <td class="px-3 py-2.5 text-foreground">${formatVal(tchr.telegram)}</td>
          <!-- 44. អ៊ីមែល -->
          <td class="px-3 py-2.5 text-foreground">${formatVal(tchr.email)}</td>
          <!-- 45. ផ្សេងៗ -->
          <td class="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate" title="${tchr.notes || ''}">${formatVal(tchr.notes)}</td>
          <!-- 46. សកម្មភាព (Sticky Right) -->
          <td class="w-[50px] px-2 py-2.5 text-center sticky right-0 bg-card/95 backdrop-blur z-10">
            ${renderActionDropdown({
              id: tchr.id,
              title: isKm ? 'ជម្រើសសកម្មភាព' : 'Actions',
              actions
            })}
          </td>
        </tr>
      `;
    }).join('');
  },

  renderPagination({ total, page, pageSize, totalPages }) {
    const infoEl = document.getElementById('teacher-page-info');
    const navEl = document.getElementById('teacher-page-nav');
    if (!infoEl || !navEl) return;

    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    const isKm = i18n.getLocale() === 'km';
    infoEl.textContent = isKm 
      ? `បង្ហាញពី ${start} ដល់ ${end} នៃគ្រូបង្រៀនសរុប ${total} នាក់`
      : `Showing ${start} to ${end} of ${total} faculty members`;

    let navHtml = `
      <button id="btn-t-prev" class="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer" ${page <= 1 ? 'disabled' : ''}>
        ${getIcon('chevronLeft', 'w-3.5 h-3.5')}
      </button>
      <span class="px-3 text-xs font-semibold text-foreground">${page} / ${totalPages}</span>
      <button id="btn-t-next" class="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer" ${page >= totalPages ? 'disabled' : ''}>
        ${getIcon('chevronRight', 'w-3.5 h-3.5')}
      </button>
    `;
    navEl.innerHTML = navHtml;

    document.getElementById('btn-t-prev')?.addEventListener('click', () => {
      if (this.state.page > 1) {
        this.state.page--;
        this.loadData();
      }
    });
    document.getElementById('btn-t-next')?.addEventListener('click', () => {
      if (this.state.page < totalPages) {
        this.state.page++;
        this.loadData();
      }
    });
  },

  bindStaticEvents() {
    let searchTimeout = null;
    document.getElementById('teacher-search-input')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.state.search = e.target.value;
        this.state.page = 1;
        this.loadData();
      }, 250);
    });

    // Two-step Drill-down Filter: Field Dropdown
    document.getElementById('select-filter-field')?.addEventListener('change', (e) => {
      this.state.filterField = e.target.value;
      this.state.filterValue = 'all';
      this.state.page = 1;
      this.populateFilterValuesDropdown();
      this.loadData();
    });

    // Two-step Drill-down Filter: Value Dropdown
    document.getElementById('select-filter-value')?.addEventListener('change', (e) => {
      this.state.filterValue = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    // Two-step Drill-down Filter: Clear Button
    document.getElementById('btn-clear-drilldown-filter')?.addEventListener('click', () => {
      this.state.filterField = '';
      this.state.filterValue = 'all';
      this.state.page = 1;
      const fieldSelect = document.getElementById('select-filter-field');
      if (fieldSelect) fieldSelect.value = '';
      this.populateFilterValuesDropdown();
      this.loadData();
    });

    document.getElementById('filter-teacher-status')?.addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    document.getElementById('select-teacher-page-size')?.addEventListener('change', (e) => {
      this.state.pageSize = Number(e.target.value);
      this.state.page = 1;
      this.loadData();
    });

    document.getElementById('btn-add-teacher')?.addEventListener('click', async (e) => {
      const currentUser = authService.getCurrentUser();
      if (currentUser?.role === 'TEACHER' && this.state.userTeacherCount >= 1) {
        e.preventDefault();
        toast.warning(t('teachers.limitReachedToast'));
        return;
      }
      await TeacherFormModal.open({
        teacher: null,
        onSave: async () => {
          await this.refreshData();
        }
      });
    });

    this.container.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (this.state.sortBy === col) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortBy = col;
          this.state.sortDir = 'asc';
        }
        this.loadData();
      });
    });

    // --- Excel & JSON Dropdowns Behavior ---
    const excelBtn = document.getElementById('btn-excel-dropdown');
    const excelMenu = document.getElementById('excel-dropdown-menu');
    const jsonBtn = document.getElementById('btn-json-dropdown');
    const jsonMenu = document.getElementById('json-dropdown-menu');

    excelBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      jsonMenu?.classList.add('hidden');
      excelMenu?.classList.toggle('hidden');
    });

    jsonBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      excelMenu?.classList.add('hidden');
      jsonMenu?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (excelMenu && !excelMenu.contains(e.target) && !excelBtn?.contains(e.target)) {
        excelMenu.classList.add('hidden');
      }
      if (jsonMenu && !jsonMenu.contains(e.target) && !jsonBtn?.contains(e.target)) {
        jsonMenu.classList.add('hidden');
      }
    });

    // Excel Dropdown Actions
    document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
      excelMenu?.classList.add('hidden');
      await this.handleExportExcel();
    });

    document.getElementById('btn-import-excel')?.addEventListener('click', () => {
      excelMenu?.classList.add('hidden');
      this.openExcelImportModal();
    });

    // JSON Dropdown Actions
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      jsonMenu?.classList.add('hidden');
      this.handleExportJSON();
    });

    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      jsonMenu?.classList.add('hidden');
      this.openJsonImportModal();
    });

    // Hidden File Input Listeners
    document.getElementById('teacherExcelInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.openExcelImportModal(e.target.files[0]);
      }
      e.target.value = '';
    });

    document.getElementById('teacherJsonInput')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.openJsonImportModal(e.target.files[0]);
      }
      e.target.value = '';
    });
  },

  getActiveFilters() {
    return {
      search: this.state.search,
      status: this.state.status,
      framework: this.state.framework,
      subject: this.state.subject,
      filterField: this.state.filterField,
      filterValue: this.state.filterValue
    };
  },

  async handleExportExcel() {
    const isKm = i18n.getLocale() === 'km';
    try {
      toast.info(isKm ? 'កំពុងរៀបចំនាំចេញជា Excel...' : 'Preparing Excel export...');
      const list = this.cachedTeachers || await TeacherService.getAll();
      const { filename, count } = await ExcelExportService.exportTeachersToExcel(list, {
        activeFilters: this.getActiveFilters(),
        lang: isKm ? 'km' : 'en'
      });
      toast.success(isKm 
        ? `បាននាំចេញ ${count} នាក់ជាឯកសារ ${filename} ដោយជោគជ័យ!` 
        : `Successfully exported ${count} teachers to ${filename}!`);
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error(err.message || (isKm ? 'បរាជ័យក្នុងការនាំចេញជា Excel' : 'Export to Excel failed.'));
    }
  },

  handleExportJSON() {
    const isKm = i18n.getLocale() === 'km';
    try {
      const list = this.cachedTeachers || [];
      const { filename, count } = ExcelExportService.exportTeachersToJSON(list, {
        activeFilters: this.getActiveFilters()
      });
      toast.success(isKm 
        ? `បានទាញយកទិន្នន័យ JSON ${count} នាក់ (${filename}) ដោយជោគជ័យ!` 
        : `Successfully downloaded JSON backup of ${count} teachers (${filename})!`);
    } catch (err) {
      console.error('JSON export error:', err);
      toast.error(err.message || (isKm ? 'បរាជ័យក្នុងការនាំចេញជា JSON' : 'Export to JSON failed.'));
    }
  },

  /**
   * Open Excel Import Modal with 44-column parser, preview, duplicate check, and template download
   */
  openExcelImportModal(initialFile = null) {
    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    const isLimitReached = isTeacher && this.state.userTeacherCount >= 1;

    let parsedResult = null;

    const content = `
      <div class="space-y-4 text-xs sm:text-sm">
        ${isLimitReached ? `
          <div class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
            ${getIcon('shield', 'w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0')}
            <span>${t('teachers.roleRestrictionWarning')}</span>
          </div>
        ` : ''}

        <!-- Top Guide & Template Download Bar -->
        <div class="p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="text-xs text-muted-foreground">
            <span class="font-bold text-foreground block">${isKm ? 'ទម្រង់ឯកសារ Excel (.xlsx) ៤៤ ជួរឈរផ្លូវការ' : 'Official MoEYS 44-Column Excel Template'}</span>
            <span>${isKm ? 'ប្រព័ន្ធនឹងបំពេញ អាយុ និងថ្ងៃចូលនិវត្តន៍ដោយស្វ័យប្រវត្តិតាមថ្ងៃខែឆ្នាំកំណើត។' : 'System auto-computes Age and Retirement Date (DOB + 60 Years).'}</span>
          </div>
          <button id="btn-download-sample-template" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card hover:bg-muted text-primary border border-primary/30 text-xs font-semibold shrink-0 cursor-pointer shadow-2xs">
            ${getIcon('fileSpreadsheet', 'w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400')}
            <span>${t('teachers.downloadTemplate')}</span>
          </button>
        </div>

        <!-- Drag & Drop Upload Zone -->
        <div id="drop-zone-teacher-excel" class="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40">
          <input type="file" id="excel-modal-file-input" accept=".xlsx, .xls" class="hidden" />
          <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            ${getIcon('upload', 'w-6 h-6')}
          </div>
          <p class="font-semibold text-foreground text-xs sm:text-sm">
            ${t('teachers.importDropzoneHint')}
          </p>
          <p id="teacher-excel-file-label" class="text-xs text-muted-foreground mt-1 font-mono">
            ${initialFile ? `${initialFile.name} (${(initialFile.size / 1024).toFixed(1)} KB)` : (isKm ? 'មិនទាន់ជ្រើសរើសឯកសារ' : 'No file chosen')}
          </p>
        </div>

        <!-- Duplicate Handling Strategy Options -->
        <div class="p-3 rounded-lg border border-border bg-card space-y-2">
          <span class="font-semibold text-foreground block text-xs">${t('teachers.importDuplicateStrategy')}:</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label class="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer">
              <input type="radio" name="teacherDuplicateStrategy" value="skip" checked class="text-primary focus:ring-primary h-3.5 w-3.5" />
              <div>
                <span class="font-medium text-foreground block">${t('teachers.skipDuplicates')}</span>
                <span class="text-[11px] text-muted-foreground">${isKm ? 'រំលងមិនបញ្ចូលទិន្នន័យដែលស្ទួន' : 'Do not overwrite existing records'}</span>
              </div>
            </label>
            <label class="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer">
              <input type="radio" name="teacherDuplicateStrategy" value="overwrite" class="text-primary focus:ring-primary h-3.5 w-3.5" />
              <div>
                <span class="font-medium text-foreground block">${t('teachers.overwriteDuplicates')}</span>
                <span class="text-[11px] text-muted-foreground">${isKm ? 'កែប្រែទិន្នន័យចាស់តាមឯកសារថ្មី' : 'Update existing records with new data'}</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Error / Warning Box -->
        <div id="teacher-excel-error-box" class="hidden p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1"></div>

        <!-- Preview Section -->
        <div id="teacher-excel-preview-container" class="hidden space-y-2">
          <div class="flex items-center justify-between">
            <h4 id="teacher-excel-preview-summary" class="font-bold text-foreground text-xs sm:text-sm"></h4>
            <span class="text-[11px] text-muted-foreground">${isKm ? 'បង្ហាញគំរូអតិបរមា ១០ នាក់' : 'Previewing up to 10 rows'}</span>
          </div>
          <div class="max-h-60 overflow-x-auto overflow-y-auto border border-border rounded-lg bg-card text-xs">
            <table class="w-full text-left border-collapse whitespace-nowrap">
              <thead class="bg-muted text-muted-foreground font-semibold sticky top-0 z-10">
                <tr class="border-b border-border">
                  <th class="px-2.5 py-2 text-center">#</th>
                  <th class="px-2.5 py-2">${isKm ? 'លេខសម្គាល់' : 'Teacher ID'}</th>
                  <th class="px-2.5 py-2">${isKm ? 'អត្តលេខមន្ត្រី' : 'Civil ID'}</th>
                  <th class="px-2.5 py-2">${isKm ? 'គោត្តនាម-នាម' : 'Khmer Name'}</th>
                  <th class="px-2.5 py-2">${isKm ? 'ឈ្មោះឡាតាំង' : 'Latin Name'}</th>
                  <th class="px-2.5 py-2 text-center">${isKm ? 'ភេទ' : 'Gender'}</th>
                  <th class="px-2.5 py-2 text-center">${isKm ? 'ថ្ងៃកំណើត' : 'DOB'}</th>
                  <th class="px-2.5 py-2 text-center text-primary font-bold">${isKm ? 'អាយុ (Auto)' : 'Age'}</th>
                  <th class="px-2.5 py-2 text-center text-amber-600 font-bold">${isKm ? 'ចូលនិវត្តន៍ (Auto)' : 'Retirement'}</th>
                  <th class="px-2.5 py-2">${isKm ? 'មុខតំណែង' : 'Position'}</th>
                  <th class="px-2.5 py-2 text-center">${isKm ? 'ស្ថានភាព' : 'Status'}</th>
                </tr>
              </thead>
              <tbody id="teacher-excel-preview-tbody" class="divide-y divide-border"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <div class="flex items-center justify-between w-full">
        <button id="btn-cancel-excel-import" type="button" class="h-9 px-4 rounded-md border border-border hover:bg-muted text-xs font-medium cursor-pointer">
          ${t('common.cancel')}
        </button>
        <button id="btn-confirm-excel-import" type="button" disabled class="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium cursor-pointer opacity-50 cursor-not-allowed shadow-xs transition-all">
          ${t('teachers.confirmImport', { count: 0 })}
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: t('teachers.importModalTitle'),
      content,
      footer,
      maxWidth: 'max-w-3xl'
    });

    const dropZone = modal.element.querySelector('#drop-zone-teacher-excel');
    const fileInput = modal.element.querySelector('#excel-modal-file-input');
    const fileLabel = modal.element.querySelector('#teacher-excel-file-label');
    const previewContainer = modal.element.querySelector('#teacher-excel-preview-container');
    const previewSummary = modal.element.querySelector('#teacher-excel-preview-summary');
    const previewTbody = modal.element.querySelector('#teacher-excel-preview-tbody');
    const confirmBtn = modal.element.querySelector('#btn-confirm-excel-import');
    const cancelBtn = modal.element.querySelector('#btn-cancel-excel-import');
    const errorBox = modal.element.querySelector('#teacher-excel-error-box');

    // Download Sample Template
    modal.element.querySelector('#btn-download-sample-template')?.addEventListener('click', async () => {
      try {
        await ExcelExportService.downloadSampleTemplate(isKm ? 'km' : 'en');
        toast.info(isKm ? 'បានទាញយកទម្រង់គំរូ Excel' : 'Sample template downloaded.');
      } catch (err) {
        toast.error(err.message);
      }
    });

    // File picker trigger
    dropZone?.addEventListener('click', () => fileInput?.click());

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-primary/5');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
      }
    });

    const processFile = async (file) => {
      if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.innerHTML = '';
      }

      fileLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      try {
        const buffer = await file.arrayBuffer();
        parsedResult = await ExcelExportService.parseTeacherExcelFile(buffer);

        if (parsedResult.totalRows === 0) {
          throw new Error('No teacher records found in spreadsheet.');
        }

        // Role restriction validation
        if (isTeacher && this.state.userTeacherCount >= 1) {
          throw new Error(t('teachers.roleRestrictionWarning'));
        }
        if (isTeacher && parsedResult.validRows.length > 1) {
          throw new Error(t('teachers.bulkImportRestricted'));
        }

        previewSummary.textContent = isKm 
          ? `បានវិភាគឃើញទិន្នន័យគ្រូបង្រៀន ${parsedResult.validRows.length} នាក់` 
          : `Parsed ${parsedResult.validRows.length} teacher records`;

        const previewRows = parsedResult.validRows.slice(0, 10);
        previewTbody.innerHTML = previewRows.map(r => `
          <tr class="hover:bg-muted/40 ${r.isExistingDuplicate ? 'bg-amber-500/5' : ''}">
            <td class="px-2.5 py-1.5 font-mono text-center">${r.rowNum}</td>
            <td class="px-2.5 py-1.5 font-mono font-medium text-foreground">
              ${r.teacherId || '—'}
              ${r.isExistingDuplicate ? `<span class="ml-1 px-1 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-600 font-sans">ស្ទួន</span>` : ''}
            </td>
            <td class="px-2.5 py-1.5 font-mono text-muted-foreground">${r.civilServantId || '—'}</td>
            <td class="px-2.5 py-1.5 font-khmer font-medium text-foreground">${r.lastNameKhmer || ''} ${r.firstNameKhmer || ''}</td>
            <td class="px-2.5 py-1.5 uppercase text-muted-foreground">${r.lastNameLatin || ''} ${r.firstNameLatin || ''}</td>
            <td class="px-2.5 py-1.5 text-center">${r.gender === 'Female' || r.gender === 'ស្រី' ? (isKm ? 'ស្រី' : 'Female') : (isKm ? 'ប្រុស' : 'Male')}</td>
            <td class="px-2.5 py-1.5 font-mono text-center">${formatDisplayDate(r.dob) || '—'}</td>
            <td class="px-2.5 py-1.5 font-mono text-center font-bold text-primary">${r.age !== '' ? `${r.age}` : '—'}</td>
            <td class="px-2.5 py-1.5 font-mono text-center font-bold text-amber-600 dark:text-amber-400">${formatDisplayDate(r.retirementDate) || '—'}</td>
            <td class="px-2.5 py-1.5">${r.position || '—'}</td>
            <td class="px-2.5 py-1.5 text-center">
              <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${r.status || 'Active'}</span>
            </td>
          </tr>
        `).join('');

        previewContainer.classList.remove('hidden');

        // Validation notice for duplicate rows or missing rows
        if (parsedResult.duplicateRows && parsedResult.duplicateRows.length > 0 && errorBox) {
          errorBox.innerHTML = `
            <p class="font-bold text-amber-600 dark:text-amber-400">
              ${isKm ? `ចំណាំ៖ រកឃើញទិន្នន័យស្ទួនចំនួន ${parsedResult.duplicateRows.length} កំណត់ត្រា។ សូមជ្រើសរើសវិធីសាស្ត្រខាងលើ។` : `Notice: Found ${parsedResult.duplicateRows.length} duplicate records.`}
            </p>
          `;
          errorBox.classList.remove('hidden');
        }

        if (parsedResult.missingIdentifierRows && parsedResult.missingIdentifierRows.length > 0 && errorBox) {
          const missingMsg = `
            <p class="font-bold text-destructive">
              ${isKm ? `បដិសេធ៖ ${parsedResult.missingIdentifierRows.length} ជួរដេកខ្វះលេខសម្គាល់ ឬឈ្មោះ និងត្រូវបានច្រានចោល។` : `Rejected: ${parsedResult.missingIdentifierRows.length} rows missing ID and Name.`}
            </p>
          `;
          errorBox.innerHTML += missingMsg;
          errorBox.classList.remove('hidden');
        }

        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        confirmBtn.textContent = isKm 
          ? `បញ្ជាក់ការនាំចូល (${parsedResult.validRows.length} នាក់)` 
          : `Confirm Import (${parsedResult.validRows.length})`;
      } catch (err) {
        console.error('Excel parse error:', err);
        if (errorBox) {
          errorBox.textContent = err.message || 'Failed to parse Excel file.';
          errorBox.classList.remove('hidden');
        }
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    };

    if (initialFile) {
      processFile(initialFile);
    }

    cancelBtn?.addEventListener('click', () => modal.close());

    confirmBtn?.addEventListener('click', async () => {
      if (!parsedResult || parsedResult.validRows.length === 0) return;

      const duplicateStrategy = modal.element.querySelector('input[name="teacherDuplicateStrategy"]:checked')?.value || 'skip';
      const overwriteDuplicates = duplicateStrategy === 'overwrite';

      confirmBtn.disabled = true;
      confirmBtn.textContent = isKm ? 'កំពុងនាំចូល...' : 'Importing...';

      try {
        const result = await ExcelExportService.commitTeacherImport(parsedResult.validRows, { overwriteDuplicates });
        modal.close();
        await this.refreshData();
        this.showImportSummaryModal(result);
        toast.success(isKm 
          ? `បាននាំចូលជោគជ័យ ${result.importedCount + result.updatedCount} នាក់!` 
          : `Imported ${result.importedCount + result.updatedCount} teachers successfully!`);
      } catch (err) {
        console.error('Commit import error:', err);
        toast.error(err.message || 'Import commit failed.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = isKm ? 'បញ្ជាក់ការនាំចូល' : 'Confirm Import';
      }
    });
  },

  /**
   * Open JSON Import Modal
   */
  openJsonImportModal(initialFile = null) {
    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    const isLimitReached = isTeacher && this.state.userTeacherCount >= 1;

    let parsedResult = null;

    const content = `
      <div class="space-y-4 text-xs sm:text-sm">
        ${isLimitReached ? `
          <div class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
            ${getIcon('shield', 'w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0')}
            <span>${t('teachers.roleRestrictionWarning')}</span>
          </div>
        ` : ''}

        <!-- Drag & Drop Upload Zone -->
        <div id="drop-zone-teacher-json" class="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40">
          <input type="file" id="json-modal-file-input" accept=".json" class="hidden" />
          <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            ${getIcon('fileCode', 'w-6 h-6')}
          </div>
          <p class="font-semibold text-foreground text-xs sm:text-sm">
            ${t('teachers.importJsonDropzoneHint')}
          </p>
          <p id="teacher-json-file-label" class="text-xs text-muted-foreground mt-1 font-mono">
            ${initialFile ? `${initialFile.name} (${(initialFile.size / 1024).toFixed(1)} KB)` : (isKm ? 'មិនទាន់ជ្រើសរើសឯកសារ' : 'No file chosen')}
          </p>
        </div>

        <!-- Duplicate Handling Strategy Options -->
        <div class="p-3 rounded-lg border border-border bg-card space-y-2">
          <span class="font-semibold text-foreground block text-xs">${t('teachers.importDuplicateStrategy')}:</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label class="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer">
              <input type="radio" name="teacherJsonDuplicateStrategy" value="skip" checked class="text-primary focus:ring-primary h-3.5 w-3.5" />
              <div>
                <span class="font-medium text-foreground block">${t('teachers.skipDuplicates')}</span>
                <span class="text-[11px] text-muted-foreground">${isKm ? 'រំលងមិនបញ្ចូលទិន្នន័យដែលស្ទួន' : 'Do not overwrite existing records'}</span>
              </div>
            </label>
            <label class="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer">
              <input type="radio" name="teacherJsonDuplicateStrategy" value="overwrite" class="text-primary focus:ring-primary h-3.5 w-3.5" />
              <div>
                <span class="font-medium text-foreground block">${t('teachers.overwriteDuplicates')}</span>
                <span class="text-[11px] text-muted-foreground">${isKm ? 'កែប្រែទិន្នន័យចាស់តាមឯកសារថ្មី' : 'Update existing records with new data'}</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Error Box -->
        <div id="teacher-json-error-box" class="hidden p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1"></div>

        <!-- Preview Section -->
        <div id="teacher-json-preview-container" class="hidden space-y-2">
          <h4 id="teacher-json-preview-summary" class="font-bold text-foreground text-xs sm:text-sm"></h4>
          <div class="max-h-56 overflow-x-auto overflow-y-auto border border-border rounded-lg bg-card text-xs">
            <table class="w-full text-left border-collapse whitespace-nowrap">
              <thead class="bg-muted text-muted-foreground font-semibold sticky top-0 z-10">
                <tr class="border-b border-border">
                  <th class="px-2.5 py-2 text-center">#</th>
                  <th class="px-2.5 py-2">${isKm ? 'លេខសម្គាល់' : 'Teacher ID'}</th>
                  <th class="px-2.5 py-2">${isKm ? 'គោត្តនាម-នាម' : 'Khmer Name'}</th>
                  <th class="px-2.5 py-2 text-center">${isKm ? 'ភេទ' : 'Gender'}</th>
                  <th class="px-2.5 py-2 text-center">${isKm ? 'ថ្ងៃកំណើត' : 'DOB'}</th>
                  <th class="px-2.5 py-2 text-center text-primary font-bold">${isKm ? 'អាយុ' : 'Age'}</th>
                  <th class="px-2.5 py-2 text-center text-amber-600 font-bold">${isKm ? 'ចូលនិវត្តន៍' : 'Retirement'}</th>
                  <th class="px-2.5 py-2">${isKm ? 'មុខតំណែង' : 'Position'}</th>
                </tr>
              </thead>
              <tbody id="teacher-json-preview-tbody" class="divide-y divide-border"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <div class="flex items-center justify-between w-full">
        <button id="btn-cancel-json-import" type="button" class="h-9 px-4 rounded-md border border-border hover:bg-muted text-xs font-medium cursor-pointer">
          ${t('common.cancel')}
        </button>
        <button id="btn-confirm-json-import" type="button" disabled class="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium cursor-pointer opacity-50 cursor-not-allowed shadow-xs transition-all">
          ${t('teachers.confirmImport', { count: 0 })}
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: t('teachers.importJsonModalTitle'),
      content,
      footer,
      maxWidth: 'max-w-2xl'
    });

    const dropZone = modal.element.querySelector('#drop-zone-teacher-json');
    const fileInput = modal.element.querySelector('#json-modal-file-input');
    const fileLabel = modal.element.querySelector('#teacher-json-file-label');
    const previewContainer = modal.element.querySelector('#teacher-json-preview-container');
    const previewSummary = modal.element.querySelector('#teacher-json-preview-summary');
    const previewTbody = modal.element.querySelector('#teacher-json-preview-tbody');
    const confirmBtn = modal.element.querySelector('#btn-confirm-json-import');
    const cancelBtn = modal.element.querySelector('#btn-cancel-json-import');
    const errorBox = modal.element.querySelector('#teacher-json-error-box');

    dropZone?.addEventListener('click', () => fileInput?.click());

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-primary/5');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processJsonFile(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processJsonFile(e.target.files[0]);
      }
    });

    const processJsonFile = async (file) => {
      if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.innerHTML = '';
      }

      fileLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      try {
        const text = await file.text();
        parsedResult = await ExcelExportService.parseTeacherJSONFile(text);

        if (parsedResult.totalRows === 0) {
          throw new Error('No teacher records found in JSON.');
        }

        if (isTeacher && this.state.userTeacherCount >= 1) {
          throw new Error(t('teachers.roleRestrictionWarning'));
        }
        if (isTeacher && parsedResult.validRows.length > 1) {
          throw new Error(t('teachers.bulkImportRestricted'));
        }

        previewSummary.textContent = isKm 
          ? `បានវិភាគឃើញទិន្នន័យគ្រូបង្រៀន ${parsedResult.validRows.length} នាក់` 
          : `Parsed ${parsedResult.validRows.length} teacher records`;

        const previewRows = parsedResult.validRows.slice(0, 10);
        previewTbody.innerHTML = previewRows.map(r => `
          <tr class="hover:bg-muted/40 ${r.isExistingDuplicate ? 'bg-amber-500/5' : ''}">
            <td class="px-2.5 py-1.5 font-mono text-center">${r.rowNum}</td>
            <td class="px-2.5 py-1.5 font-mono font-medium text-foreground">
              ${r.teacherId || r.civilServantId || '—'}
              ${r.isExistingDuplicate ? `<span class="ml-1 px-1 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-600 font-sans">ស្ទួន</span>` : ''}
            </td>
            <td class="px-2.5 py-1.5 font-khmer font-medium text-foreground">${r.khmerName || `${r.lastNameKhmer || ''} ${r.firstNameKhmer || ''}`.trim() || '—'}</td>
            <td class="px-2.5 py-1.5 text-center">${r.gender === 'Female' || r.gender === 'ស្រី' ? (isKm ? 'ស្រី' : 'Female') : (isKm ? 'ប្រុស' : 'Male')}</td>
            <td class="px-2.5 py-1.5 font-mono text-center">${formatDisplayDate(r.dob || r.dateOfBirth) || '—'}</td>
            <td class="px-2.5 py-1.5 font-mono text-center font-bold text-primary">${r.age !== '' ? `${r.age}` : '—'}</td>
            <td class="px-2.5 py-1.5 font-mono text-center font-bold text-amber-600 dark:text-amber-400">${formatDisplayDate(r.retirementDate) || '—'}</td>
            <td class="px-2.5 py-1.5">${r.position || '—'}</td>
          </tr>
        `).join('');

        previewContainer.classList.remove('hidden');

        if (parsedResult.duplicateRows && parsedResult.duplicateRows.length > 0 && errorBox) {
          errorBox.innerHTML = `
            <p class="font-bold text-amber-600 dark:text-amber-400">
              ${isKm ? `ចំណាំ៖ រកឃើញទិន្នន័យស្ទួនចំនួន ${parsedResult.duplicateRows.length} កំណត់ត្រា។` : `Notice: Found ${parsedResult.duplicateRows.length} duplicate records.`}
            </p>
          `;
          errorBox.classList.remove('hidden');
        }

        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        confirmBtn.textContent = isKm 
          ? `បញ្ជាក់ការនាំចូល (${parsedResult.validRows.length} នាក់)` 
          : `Confirm Import (${parsedResult.validRows.length})`;
      } catch (err) {
        console.error('JSON parse error:', err);
        if (errorBox) {
          errorBox.textContent = err.message || 'Failed to parse JSON file.';
          errorBox.classList.remove('hidden');
        }
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    };

    if (initialFile) {
      processJsonFile(initialFile);
    }

    cancelBtn?.addEventListener('click', () => modal.close());

    confirmBtn?.addEventListener('click', async () => {
      if (!parsedResult || parsedResult.validRows.length === 0) return;

      const duplicateStrategy = modal.element.querySelector('input[name="teacherJsonDuplicateStrategy"]:checked')?.value || 'skip';
      const overwriteDuplicates = duplicateStrategy === 'overwrite';

      confirmBtn.disabled = true;
      confirmBtn.textContent = isKm ? 'កំពុងនាំចូល...' : 'Importing...';

      try {
        const result = await ExcelExportService.commitTeacherImport(parsedResult.validRows, { overwriteDuplicates });
        modal.close();
        await this.refreshData();
        this.showImportSummaryModal(result);
        toast.success(isKm 
          ? `បាននាំចូលជោគជ័យ ${result.importedCount + result.updatedCount} នាក់!` 
          : `Imported ${result.importedCount + result.updatedCount} teachers successfully!`);
      } catch (err) {
        console.error('Commit JSON import error:', err);
        toast.error(err.message || 'JSON import commit failed.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = isKm ? 'បញ្ជាក់ការនាំចូល' : 'Confirm Import';
      }
    });
  },

  /**
   * Post-Import Summary Modal
   */
  showImportSummaryModal(summaryResult) {
    if (!summaryResult) return;
    const isKm = i18n.getLocale() === 'km';

    const content = `
      <div class="space-y-4 text-xs sm:text-sm">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div class="p-3 rounded-xl bg-muted/40 border border-border">
            <span class="text-[11px] text-muted-foreground block font-medium">${t('teachers.totalProcessed')}</span>
            <span class="text-xl font-bold font-mono text-foreground">${summaryResult.totalRecords}</span>
          </div>
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span class="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">${t('teachers.importedCount')}</span>
            <span class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">${summaryResult.importedCount}</span>
          </div>
          <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <span class="text-[11px] text-blue-600 dark:text-blue-400 block font-medium">${t('teachers.updatedCount')}</span>
            <span class="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">${summaryResult.updatedCount || 0}</span>
          </div>
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <span class="text-[11px] text-amber-600 dark:text-amber-400 block font-medium">${t('teachers.skippedCount')}</span>
            <span class="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">${summaryResult.skippedCount || 0}</span>
          </div>
        </div>

        ${summaryResult.skippedRecords && summaryResult.skippedRecords.length > 0 ? `
          <div class="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1 text-xs">
            <span class="font-bold text-amber-700 dark:text-amber-300 block">${isKm ? 'បញ្ជីទិន្នន័យដែលបានរំលង (ស្ទួន)' : 'Skipped Duplicate Records'}:</span>
            <ul class="list-disc list-inside text-muted-foreground space-y-0.5">
              ${summaryResult.skippedRecords.slice(0, 5).map(r => `<li>${r.teacherId || '—'} - ${r.name || 'Row ' + r.rowNum}</li>`).join('')}
              ${summaryResult.skippedRecords.length > 5 ? `<li>...និង ${summaryResult.skippedRecords.length - 5} ទៀត</li>` : ''}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    const footer = `
      <div class="flex justify-end w-full">
        <button class="btn-close-summary h-9 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold cursor-pointer">
          ${t('common.close')}
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: t('teachers.importSummaryTitle'),
      content,
      footer,
      maxWidth: 'max-w-md'
    });

    modal.element.querySelector('.btn-close-summary')?.addEventListener('click', () => modal.close());
  },

  async refreshData() {
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role === 'TEACHER') {
      this.state.userTeacherCount = await TeacherService.countByUserId(currentUser.id);
    }
    this.cachedTeachers = await TeacherService.getAll();
    this.populateFilterValuesDropdown();
    await this.loadData();
  },

  /**
   * Open MoEYS 2-Page Curriculum Vitae Report in Global ReportViewer
   */
  async openTeacherCvReport(teacher) {
    if (!teacher) return;
    const isKm = i18n.getLocale() === 'km';
    const reportTitle = isKm 
      ? `ជីវប្រវត្តិមន្ត្រីរាជការ - ${teacher.khmerName || teacher.lastNameKhmer}`
      : `Teacher CV - ${teacher.englishName || teacher.teacherId}`;

    await ReportViewer.open({
      reportKey: `teacher_cv_${teacher.id}`,
      title: reportTitle,
      defaultOrientation: 'portrait',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 10, bottom: 10, left: 10, right: 10 },
      renderContent: async (paperContainer) => {
        paperContainer.innerHTML = await TeacherCvTemplate.render(teacher);
      }
    });
  },

  /**
   * Official MoEYS 44-Field Teacher Profile Modal Viewer
   */
  openTeacherProfileModal(teacher) {
    const isKm = i18n.getLocale() === 'km';
    const photoUrl = teacher.photoBlob ? photoService.getUrlForBlob(teacher.photoBlob) : (teacher.photo && teacher.photo.startsWith('data:') ? teacher.photo : null);

    const formatField = (val) => val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : '—';

    // Status styling
    let statusLabel = teacher.status || 'Active';
    if (isKm) {
      if (teacher.status === 'Active') statusLabel = 'សកម្ម';
      if (teacher.status === 'On Leave') statusLabel = 'ទំនេរគ្មានបៀវត្ស';
      if (teacher.status === 'Transferred') statusLabel = 'ផ្ទេរចេញ';
      if (teacher.status === 'Retired') statusLabel = 'ចូលនិវត្តន៍';
      if (teacher.status === 'Inactive') statusLabel = 'អសកម្ម';
    }

    const content = `
      <div id="teacher-profile-print-area" class="space-y-6 text-xs sm:text-sm">
        
        <!-- Header Banner Card -->
        <div class="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-border flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div class="w-24 h-28 rounded-xl overflow-hidden bg-card border-2 border-primary/20 shadow-md flex items-center justify-center font-bold text-2xl text-primary flex-shrink-0">
            ${photoUrl 
              ? `<img src="${photoUrl}" class="w-full h-full object-cover" />` 
              : `<span class="text-muted-foreground">${getIcon('user', 'w-10 h-10')}</span>`}
          </div>
          <div class="space-y-1.5 flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-primary text-primary-foreground shadow-2xs">${teacher.teacherId || 'TCH-000'}</span>
              ${teacher.civilServantId ? `<span class="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-muted text-muted-foreground border border-border">អត្តលេខ៖ ${teacher.civilServantId}</span>` : ''}
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">${statusLabel}</span>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold font-khmer text-foreground truncate">
              ${teacher.khmerName || `${teacher.lastNameKhmer || ''} ${teacher.firstNameKhmer || ''}`.trim() || '—'}
            </h2>
            <p class="text-xs sm:text-sm text-muted-foreground uppercase font-semibold tracking-wider">
              ${teacher.englishName || `${teacher.lastNameLatin || ''} ${teacher.firstNameLatin || ''}`.trim() || '—'}
            </p>
            <p class="text-xs text-primary font-medium">
              ${teacher.position || 'គ្រូបង្រៀន'} • ${teacher.framework || 'ក្របខណ្ឌឧត្តម'}
            </p>
          </div>
        </div>

        <!-- ផ្នែកទី ១: ព័ត៌មានអត្តសញ្ញាណ និងផ្ទាល់ខ្លួន -->
        <div class="p-4 rounded-xl border border-border bg-card space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-border font-bold text-foreground">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('user', 'w-3.5 h-3.5')}</span>
            <span>${isKm ? 'ផ្នែកទី ១: ព័ត៌មានអត្តសញ្ញាណ និងផ្ទាល់ខ្លួន' : 'Section 1: Identity & Personal Information'}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.civilServantId')}</span>
              <p class="font-mono font-medium text-foreground">${formatField(teacher.civilServantId)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.nationalId')}</span>
              <p class="font-mono font-medium text-foreground">${formatField(teacher.nationalId)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'លេខគណនីធនាគារ' : 'Bank Account'}</span>
              <p class="font-mono font-medium text-foreground">${formatField(teacher.bankAccount)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('common.gender')}</span>
              <p class="font-medium text-foreground">${teacher.gender === 'Female' || teacher.gender === 'ស្រី' ? (isKm ? 'ស្រី' : 'Female') : (isKm ? 'ប្រុស' : 'Male')}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.dob')}</span>
              <p class="font-mono font-medium text-foreground">${formatDisplayDate(teacher.dob || teacher.dateOfBirth) || '—'}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.age')}</span>
              <p class="font-mono font-bold text-primary">${formatField(teacher.age)} ឆ្នាំ</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.joinedDate')}</span>
              <p class="font-mono font-medium text-foreground">${formatDisplayDate(teacher.joinedDate) || '—'}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'ថ្ងៃតាំងស៊ប់ក្នុងក្របខណ្ឌ' : 'Permanent Date'}</span>
              <p class="font-mono font-medium text-foreground">${formatDisplayDate(teacher.permanentAppointmentDate) || '—'}</p>
            </div>
            <div class="sm:col-span-2">
              <span class="text-muted-foreground block text-[11px]">${t('teachers.retirementDate')}</span>
              <p class="font-mono font-bold text-amber-600 dark:text-amber-400">${formatDisplayDate(teacher.retirementDate) || '—'}</p>
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ២: ទីកន្លែងកំណើត និងអាសយដ្ឋានបច្ចុប្បន្ន -->
        <div class="p-4 rounded-xl border border-border bg-card space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-border font-bold text-foreground">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('school', 'w-3.5 h-3.5')}</span>
            <span>${isKm ? 'ផ្នែកទី ២: ទីកន្លែងកំណើត និងអាសយដ្ឋានបច្ចុប្បន្ន' : 'Section 2: Birthplace & Current Address'}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
              <span class="text-primary font-bold block text-[11px] uppercase">${isKm ? 'ទីកន្លែងកំណើត' : 'Place of Birth'}</span>
              <p class="text-foreground leading-relaxed">
                ${[teacher.birthVillage ? `ភូមិ${teacher.birthVillage}` : '', teacher.birthCommune ? `ឃុំ/សង្កាត់${teacher.birthCommune}` : '', teacher.birthDistrict ? `ស្រុក/ខណ្ឌ${teacher.birthDistrict}` : '', teacher.birthProvince ? `ខេត្ត/រាជធានី${teacher.birthProvince}` : ''].filter(Boolean).join(' ') || '—'}
              </p>
            </div>
            <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
              <span class="text-primary font-bold block text-[11px] uppercase">${isKm ? 'អាសយដ្ឋានបច្ចុប្បន្ន' : 'Current Residence'}</span>
              <p class="text-foreground leading-relaxed">
                ${[teacher.currentVillage ? `ភូមិ${teacher.currentVillage}` : '', teacher.currentCommune ? `ឃុំ/សង្កាត់${teacher.currentCommune}` : '', teacher.currentDistrict ? `ស្រុក/ខណ្ឌ${teacher.currentDistrict}` : '', teacher.currentProvince ? `ខេត្ត/រាជធានី${teacher.currentProvince}` : ''].filter(Boolean).join(' ') || (teacher.address || '—')}
              </p>
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ៣: ក្របខណ្ឌ មុខតំណែង និងកម្រិតបណ្តុះបណ្តាល -->
        <div class="p-4 rounded-xl border border-border bg-card space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-border font-bold text-foreground">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('graduationCap', 'w-3.5 h-3.5')}</span>
            <span>${isKm ? 'ផ្នែកទី ៣: ក្របខណ្ឌ មុខតំណែង និងកម្រិតបណ្តុះបណ្តាល' : 'Section 3: Civil Service & Qualifications'}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.workStatus')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.workStatus)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.framework')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.framework)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.rankAndGrade')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.rankAndGrade)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.position')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.position)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.trainingLevel')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.trainingLevel)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.specialization1')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.specialization1)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.specialization2')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.specialization2)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.highestDegree')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.highestDegree)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.highestDegreeMajor')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.highestDegreeMajor)}</p>
            </div>
            <div class="sm:col-span-3">
              <span class="text-muted-foreground block text-[11px]">${t('teachers.taskAssignment')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.taskAssignment)}</p>
            </div>
            ${teacher.additionalDuties ? `
              <div class="sm:col-span-3">
                <span class="text-muted-foreground block text-[11px]">${t('teachers.additionalDuties')}</span>
                <p class="font-medium text-foreground">${formatField(teacher.additionalDuties)}</p>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ផ្នែកទី ៤: បន្ទុកបង្រៀន និងម៉ោងបង្រៀនប្រចាំសប្តាហ៍ -->
        <div class="p-4 rounded-xl border border-border bg-card space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-border font-bold text-foreground">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('clipboardList', 'w-3.5 h-3.5')}</span>
            <span>${isKm ? 'ផ្នែកទី ៤: បន្ទុកបង្រៀន និងម៉ោងបង្រៀនប្រចាំសប្តាហ៍' : 'Section 4: Teaching Subjects & Weekly Load'}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div class="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
              <span class="font-bold text-primary block">${isKm ? 'មុខវិជ្ជាទី១ (ចម្បង)' : 'Subject 1'}</span>
              <p class="font-medium text-foreground">${formatField(teacher.subject1 || teacher.subject)}</p>
              <p class="text-[11px] text-muted-foreground font-mono">ម៉ោងបង្រៀន៖ <span class="font-bold text-foreground">${formatField(teacher.hoursPerWeek1)} ម៉ោង/សប្តាហ៍</span></p>
            </div>
            <div class="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
              <span class="font-bold text-foreground block">${isKm ? 'មុខវិជ្ជាទី២' : 'Subject 2'}</span>
              <p class="font-medium text-foreground">${formatField(teacher.subject2)}</p>
              <p class="text-[11px] text-muted-foreground font-mono">ម៉ោងបង្រៀន៖ <span class="font-bold text-foreground">${formatField(teacher.hoursPerWeek2)} ម៉ោង/សប្តាហ៍</span></p>
            </div>
            <div class="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
              <span class="font-bold text-foreground block">${isKm ? 'មុខវិជ្ជាទី៣' : 'Subject 3'}</span>
              <p class="font-medium text-foreground">${formatField(teacher.subject3)}</p>
              <p class="text-[11px] text-muted-foreground font-mono">ម៉ោងបង្រៀន៖ <span class="font-bold text-foreground">${formatField(teacher.hoursPerWeek3)} ម៉ោង/សប្តាហ៍</span></p>
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ៥: ព័ត៌មានទំនាក់ទំនង និងផ្សេងៗ -->
        <div class="p-4 rounded-xl border border-border bg-card space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-border font-bold text-foreground">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('contact2', 'w-3.5 h-3.5')}</span>
            <span>${isKm ? 'ផ្នែកទី ៥: ព័ត៌មានទំនាក់ទំនង និងផ្សេងៗ' : 'Section 5: Contact Information & Notes'}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.phone1')}</span>
              <p class="font-mono font-medium text-foreground">${formatField(teacher.phone1 || teacher.phone)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.phone2')}</span>
              <p class="font-mono font-medium text-foreground">${formatField(teacher.phone2)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.telegram')}</span>
              <p class="font-medium text-foreground">${formatField(teacher.telegram)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${t('teachers.email')}</span>
              <p class="font-medium text-foreground truncate" title="${teacher.email || ''}">${formatField(teacher.email)}</p>
            </div>
            ${teacher.notes ? `
              <div class="col-span-2 sm:col-span-4 p-2.5 rounded bg-muted/30 border border-border text-xs">
                <span class="text-muted-foreground block text-[11px] font-semibold">${t('teachers.notes')}</span>
                <p class="text-foreground mt-0.5 leading-relaxed whitespace-pre-line">${teacher.notes}</p>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ផ្នែកទី ៦: ព័ត៌មានគ្រួសារ -->
        <div class="p-4 rounded-xl border border-border bg-card space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-border font-bold text-foreground">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('users', 'w-3.5 h-3.5')}</span>
            <span>${isKm ? 'ផ្នែកទី ៦: ព័ត៌មានគ្រួសារ' : 'Section 6: Family Details'}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'ស្ថានភាពគ្រួសារ' : 'Marital Status'}</span>
              <p class="font-medium text-foreground">
                ${teacher.maritalStatus === 'Married' ? (isKm ? 'រៀបការរួច (Married)' : 'Married') : 
                  (teacher.maritalStatus === 'Divorced' ? (isKm ? 'លែងលះ (Divorced)' : 'Divorced') : 
                  (teacher.maritalStatus === 'Widowed' ? (isKm ? 'ពោះម៉ាយ/មេម៉ាយ (Widowed)' : 'Widowed') : 
                  (isKm ? 'នៅលីវ (Single)' : 'Single')))}
              </p>
            </div>
            ${teacher.maritalStatus !== 'Single' && (teacher.spouseName || teacher.maritalStatus === 'Married') ? `
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'ឈ្មោះប្តី/ប្រពន្ធ' : 'Spouse Name'}</span>
              <p class="font-medium text-foreground">${formatField(teacher.spouseName)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'ថ្ងៃខែឆ្នាំកំណើតប្តី/ប្រពន្ធ' : 'Spouse DOB'}</span>
              <p class="font-mono font-medium text-foreground">${formatDisplayDate(teacher.spouseDob) || '—'}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'មុខរបរប្តី/ប្រពន្ធ' : 'Spouse Job'}</span>
              <p class="font-medium text-foreground">${formatField(teacher.spouseJob)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'អាសយដ្ឋានប្តី/ប្រពន្ធ' : 'Spouse Address'}</span>
              <p class="font-medium text-foreground">${formatField(teacher.spouseAddress)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'លេខទូរសព្ទប្តី/ប្រពន្ធ' : 'Spouse Phone'}</span>
              <p class="font-mono font-medium text-foreground">${formatField(teacher.spousePhone)}</p>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">${isKm ? 'ចំនួនកូនក្នុងបន្ទុក' : 'Children Count'}</span>
              <p class="font-medium text-foreground">${formatField(teacher.childrenCount)}</p>
            </div>
            ` : ''}
          </div>
        </div>

      </div>
    `;

    const footer = `
      <div class="flex items-center justify-between w-full flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <button id="btn-print-teacher-profile" class="h-10 px-3.5 rounded-md border border-border hover:bg-muted text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer">
            ${getIcon('download', 'w-4 h-4')}
            <span>${isKm ? 'បោះពុម្ពប័ណ្ណព័ត៌មាន' : 'Print Profile'}</span>
          </button>
          <button id="btn-open-cv-report" class="h-10 px-3.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
            ${getIcon('fileText', 'w-4 h-4')}
            <span>${isKm ? 'បោះពុម្ពជីវប្រវត្តិ (MoEYS CV)' : 'Print MoEYS CV'}</span>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-edit-from-profile" class="h-10 px-4 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer">
            ${getIcon('pencil', 'w-3.5 h-3.5')}
            <span>${isKm ? 'កែប្រែ' : 'Edit'}</span>
          </button>
          <button class="btn-close-t-profile h-10 px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-medium cursor-pointer">
            ${t('common.close')}
          </button>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: t('teachers.teacherProfile'),
      content,
      footer,
      maxWidth: 'max-w-3xl'
    });

    modal.element.querySelector('.btn-close-t-profile')?.addEventListener('click', () => modal.close());
    
    modal.element.querySelector('#btn-print-teacher-profile')?.addEventListener('click', () => {
      window.print();
    });

    modal.element.querySelector('#btn-open-cv-report')?.addEventListener('click', () => {
      modal.close();
      this.openTeacherCvReport(teacher);
    });

    modal.element.querySelector('#btn-edit-from-profile')?.addEventListener('click', async () => {
      modal.close();
      await TeacherFormModal.open({
        teacher,
        onSave: async () => {
          await this.refreshData();
        }
      });
    });
  }
};
