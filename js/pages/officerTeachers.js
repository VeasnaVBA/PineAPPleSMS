/**
 * Dedicated Teacher Management Page for OFFICER Account
 * Completely separated and decoupled from TeachersPage (Director & Teacher accounts).
 * Table columns and layout fit the official MoEYS form:
 * - Photo, Civil Servant ID, Khmer Name, Latin Name, Gender, DOB, Ethnicity,
 * - National ID, Bank Account, Phone, Email, Birthplace, Current Residence,
 * - Joined Date, Permanent Appointment Date, NSSF status & number, Disability status & details,
 * - Work Status, and Action buttons (Edit, Delete, View CV).
 */

import { TeacherService } from '../services/teacherService.js';
import { OfficerTeacherFormModal } from '../components/officerTeacherFormModal.js?v=3.2.00';
import { TeacherCvTemplate } from '../components/teacherCvTemplate.js';
import { ReportViewer } from '../components/reportViewer.js';
import { photoService } from '../services/photoService.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export const OfficerTeachersPage = {
  container: null,
  cachedTeachers: null,
  state: {
    search: '',
    status: 'all',
    gender: 'all',
    nssf: 'all',
    disability: 'all',
    page: 1,
    pageSize: 15
  },

  async render(container) {
    this.container = container;
    this.state.search = '';
    this.state.status = 'all';
    this.state.gender = 'all';
    this.state.nssf = 'all';
    this.state.disability = 'all';
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
              <span class="p-2.5 rounded-xl bg-primary/10 text-primary">
                ${getIcon('teachers', 'w-6 h-6')}
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
                    ${isKm ? 'គ្រប់គ្រងគ្រូបង្រៀន និងមន្ត្រី (ការិយាល័យ)' : 'Teacher & Officer Management'}
                  </h1>
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                    OFFICER
                  </span>
                </div>
                <p class="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  ${isKm 
                    ? 'តារាងគ្រប់គ្រងទិន្នន័យមន្ត្រីរាជការ និងគ្រូបង្រៀនពេញលេញតាមបទដ្ឋាន MoEYS (ឯករាជ្យពីគណនីផ្សេងៗ)' 
                    : 'Full MoEYS HR Teacher & Staff Management Table for Officer Staff'}
                </p>
              </div>
            </div>
          </div>

          <!-- Header Actions -->
          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Export Excel Button -->
            <button id="btn-officer-export-excel" 
                    type="button"
                    class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-input bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer">
              ${getIcon('fileSpreadsheet', 'w-4 h-4 text-emerald-600')}
              <span>${isKm ? 'ទាញយក Excel' : 'Export Excel'}</span>
            </button>

            <!-- Add Teacher Button -->
            <button id="btn-officer-add-teacher" 
                    type="button"
                    class="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-all cursor-pointer">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${isKm ? 'បន្ថែមគ្រូបង្រៀនថ្មី' : 'Add New Teacher'}</span>
            </button>
          </div>
        </div>

        <!-- Summary Metric Chips -->
        <div id="officer-metrics-bar" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <!-- Dynamically loaded in loadData -->
        </div>

        <!-- Filter & Search Bar -->
        <div class="bg-card p-3.5 rounded-2xl border border-border flex flex-col lg:flex-row items-center justify-between gap-3 shadow-2xs">
          <!-- Search Input -->
          <div class="relative w-full lg:w-96">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              ${getIcon('search', 'w-4 h-4')}
            </span>
            <input type="text" 
                   id="officer-teacher-search" 
                   placeholder="${isKm ? 'ស្វែងរកតាមឈ្មោះ, អត្តលេខ, ទូរស័ព្ទ, អត្តសញ្ញាណប័ណ្ណ, ប.ស.ស....' : 'Search name, Civil ID, Phone, National ID, NSSF...'}"
                   class="w-full h-9 pl-9 pr-3 py-1.5 bg-background border border-input rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs" />
          </div>

          <!-- Filters -->
          <div class="flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <!-- Gender Filter -->
            <select id="officer-gender-filter" 
                    class="h-9 px-3 py-1.5 bg-background border border-input rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs">
              <option value="all">${isKm ? 'គ្រប់ភេទ' : 'All Genders'}</option>
              <option value="ស្រី">${isKm ? 'ស្រី' : 'Female'}</option>
              <option value="ប្រុស">${isKm ? 'ប្រុស' : 'Male'}</option>
            </select>

            <!-- Status Filter -->
            <select id="officer-status-filter" 
                    class="h-9 px-3 py-1.5 bg-background border border-input rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs">
              <option value="all">${isKm ? 'គ្រប់ស្ថានភាព' : 'All Status'}</option>
              <option value="សកម្ម">${isKm ? 'សកម្ម (Active)' : 'Active'}</option>
              <option value="ទំនេរគ្មានបៀវត្ស">${isKm ? 'ទំនេរគ្មានបៀវត្ស' : 'On Leave'}</option>
              <option value="ផ្ទេរចេញ">${isKm ? 'ផ្ទេរចេញ' : 'Transferred'}</option>
              <option value="ចូលនិវត្តន៍">${isKm ? 'ចូលនិវត្តន៍' : 'Retired'}</option>
            </select>

            <!-- NSSF Filter -->
            <select id="officer-nssf-filter" 
                    class="h-9 px-3 py-1.5 bg-background border border-input rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs">
              <option value="all">${isKm ? 'ប.ស.ស. ទាំងអស់' : 'All NSSF'}</option>
              <option value="yes">${isKm ? 'មាន ប.ស.ស.' : 'NSSF Member'}</option>
              <option value="no">${isKm ? 'គ្មាន ប.ស.ស.' : 'No NSSF'}</option>
            </select>

            <!-- Disability Filter -->
            <select id="officer-disability-filter" 
                    class="h-9 px-3 py-1.5 bg-background border border-input rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs">
              <option value="all">${isKm ? 'ពិការភាព ទាំងអស់' : 'All Disability'}</option>
              <option value="yes">${isKm ? 'មានពិការភាព' : 'Disabled'}</option>
              <option value="no">${isKm ? 'គ្មានពិការភាព' : 'Non-disabled'}</option>
            </select>
          </div>
        </div>

        <!-- Dedicated Officer Teacher Table (Full Form Columns) -->
        <div class="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div class="overflow-x-auto max-w-full">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="bg-muted/70 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th class="w-10 px-3 py-3 text-center sticky left-0 z-10 bg-muted/90 backdrop-blur-xs">#</th>
                  <th class="w-12 px-2 py-3 text-center">${isKm ? 'រូបថត' : 'Photo'}</th>
                  <th class="px-3.5 py-3 font-bold text-foreground font-khmer">${isKm ? 'លេខកូដ' : 'Code'}</th>
                  <th class="px-3.5 py-3 font-bold text-primary font-khmer">${isKm ? 'អត្តលេខមន្ត្រីរាជការ' : 'Civil Servant ID'}</th>
                  <th class="px-4 py-3">${isKm ? 'គោត្តនាម-នាម' : 'Full Name (Khmer)'}</th>
                  <th class="px-3.5 py-3">${isKm ? 'ឈ្មោះឡាតាំង' : 'Latin Name'}</th>
                  <th class="px-2.5 py-3 text-center">${isKm ? 'ភេទ' : 'Gender'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ថ្ងៃខែឆ្នាំកំណើត' : 'DOB'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ជនជាតិ' : 'Ethnicity'}</th>
                  <th class="px-3.5 py-3">${isKm ? 'អត្តសញ្ញាណប័ណ្ណ' : 'National ID'}</th>
                  <th class="px-3.5 py-3">${isKm ? 'គណនីធនាគារ' : 'Bank Account'}</th>
                  <th class="px-3.5 py-3">${isKm ? 'លេខទូរស័ព្ទ' : 'Phone'}</th>
                  <th class="px-3.5 py-3">${isKm ? 'អ៊ីមែល' : 'Email'}</th>
                  <th class="px-4 py-3">${isKm ? 'ទីកន្លែងកំណើត' : 'Birthplace'}</th>
                  <th class="px-4 py-3">${isKm ? 'អាសយដ្ឋានបច្ចុប្បន្ន' : 'Current Residence'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ថ្ងៃចូលបម្រើការងារ' : 'Joined Date'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ថ្ងៃតាំងស៊ប់' : 'Permanent Appt'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ប.ស.ស. (NSSF)' : 'NSSF'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ពិការភាព' : 'Disability'}</th>
                  <th class="px-3 py-3 text-center">${isKm ? 'ស្ថានភាព' : 'Status'}</th>
                  <th class="w-24 px-3 py-3 text-center sticky right-0 z-10 bg-muted/90 backdrop-blur-xs">${isKm ? 'សកម្មភាព' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody id="officer-teacher-table-body" class="divide-y divide-border/60">
                <!-- Dynamically loaded -->
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div id="officer-teacher-pagination" class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground bg-muted/10">
            <!-- Loaded dynamically -->
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    const isKm = i18n.getLocale() === 'km';

    // Add Teacher button
    this.container.querySelector('#btn-officer-add-teacher')?.addEventListener('click', () => {
      this.openTeacherForm(null);
    });

    // Export to Excel button
    this.container.querySelector('#btn-officer-export-excel')?.addEventListener('click', async () => {
      await this.exportToExcel();
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

    // NSSF filter
    this.container.querySelector('#officer-nssf-filter')?.addEventListener('change', (e) => {
      this.state.nssf = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    // Disability filter
    this.container.querySelector('#officer-disability-filter')?.addEventListener('change', (e) => {
      this.state.disability = e.target.value;
      this.state.page = 1;
      this.loadData();
    });
  },

  async loadData() {
    const tbody = document.getElementById('officer-teacher-table-body');
    const pagination = document.getElementById('officer-teacher-pagination');
    const metricsBar = document.getElementById('officer-metrics-bar');
    if (!tbody) return;

    const isKm = i18n.getLocale() === 'km';
    const allTeachers = this.cachedTeachers || [];

    // Render Metrics
    if (metricsBar) {
      const totalTeachers = allTeachers.length;
      const femaleCount = allTeachers.filter(t => t.gender === 'ស្រី' || t.gender === 'Female').length;
      const nssfCount = allTeachers.filter(t => t.isNssf === true || t.isNssf === 'true' || t.nssfNumber).length;
      const disabledCount = allTeachers.filter(t => t.isDisability === true || t.isDisability === 'true').length;

      metricsBar.innerHTML = `
        <div class="bg-card p-3 rounded-xl border border-border shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] text-muted-foreground font-medium ${isKm ? 'font-khmer' : ''}">${isKm ? 'ចំនួនគ្រូសរុប' : 'Total Staff'}</div>
            <div class="text-xl font-bold text-foreground mt-0.5">${totalTeachers} <span class="text-xs font-normal text-muted-foreground">${isKm ? 'នាក់' : ''}</span></div>
          </div>
          <span class="p-2 rounded-lg bg-primary/10 text-primary">${getIcon('users', 'w-5 h-5')}</span>
        </div>

        <div class="bg-card p-3 rounded-xl border border-border shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] text-muted-foreground font-medium ${isKm ? 'font-khmer' : ''}">${isKm ? 'គ្រូបង្រៀនជាស្ត្រី' : 'Female Staff'}</div>
            <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">${femaleCount} <span class="text-xs font-normal text-muted-foreground">${isKm ? 'នាក់' : ''}</span></div>
          </div>
          <span class="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">${getIcon('user', 'w-5 h-5')}</span>
        </div>

        <div class="bg-card p-3 rounded-xl border border-border shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] text-muted-foreground font-medium ${isKm ? 'font-khmer' : ''}">${isKm ? 'សមាជិក ប.ស.ស.' : 'NSSF Members'}</div>
            <div class="text-xl font-bold text-primary mt-0.5">${nssfCount} <span class="text-xs font-normal text-muted-foreground">${isKm ? 'នាក់' : ''}</span></div>
          </div>
          <span class="p-2 rounded-lg bg-primary/10 text-primary">${getIcon('award', 'w-5 h-5')}</span>
        </div>

        <div class="bg-card p-3 rounded-xl border border-border shadow-2xs flex items-center justify-between">
          <div>
            <div class="text-[11px] text-muted-foreground font-medium ${isKm ? 'font-khmer' : ''}">${isKm ? 'គ្រូមានពិការភាព' : 'With Disability'}</div>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">${disabledCount} <span class="text-xs font-normal text-muted-foreground">${isKm ? 'នាក់' : ''}</span></div>
          </div>
          <span class="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">${getIcon('heart', 'w-5 h-5')}</span>
        </div>
      `;
    }

    let teachers = [...allTeachers];

    // Filter by search
    if (this.state.search) {
      teachers = teachers.filter(t => {
        const fullNameKm = `${t.lastNameKhmer || ''} ${t.firstNameKhmer || ''}`.toLowerCase();
        const fullNameEn = `${t.lastNameLatin || ''} ${t.firstNameLatin || ''}`.toLowerCase();
        const tCode = (t.code || t.teacherId || '').toLowerCase();
        const cId = (t.civilServantId || '').toLowerCase();
        const nId = (t.nationalId || '').toLowerCase();
        const phone = (t.phone || t.phone1 || '').toLowerCase();
        const email = (t.email || '').toLowerCase();
        const bAcc = (t.bankAccount || '').toLowerCase();
        const nssf = (t.nssfNumber || '').toLowerCase();
        const birthP = (t.birthProvince || '').toLowerCase();
        const currP = (t.currentProvince || '').toLowerCase();

        return fullNameKm.includes(this.state.search) ||
               fullNameEn.includes(this.state.search) ||
               tCode.includes(this.state.search) ||
               cId.includes(this.state.search) ||
               nId.includes(this.state.search) ||
               phone.includes(this.state.search) ||
               email.includes(this.state.search) ||
               bAcc.includes(this.state.search) ||
               nssf.includes(this.state.search) ||
               birthP.includes(this.state.search) ||
               currP.includes(this.state.search);
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

    // Filter by NSSF
    if (this.state.nssf !== 'all') {
      teachers = teachers.filter(t => {
        const hasNssf = t.isNssf === true || t.isNssf === 'true' || !!t.nssfNumber;
        return this.state.nssf === 'yes' ? hasNssf : !hasNssf;
      });
    }

    // Filter by Disability
    if (this.state.disability !== 'all') {
      teachers = teachers.filter(t => {
        const hasDisability = t.isDisability === true || t.isDisability === 'true';
        return this.state.disability === 'yes' ? hasDisability : !hasDisability;
      });
    }

    const totalCount = teachers.length;
    const totalPages = Math.ceil(totalCount / this.state.pageSize) || 1;
    if (this.state.page > totalPages) this.state.page = totalPages;

    const startIndex = (this.state.page - 1) * this.state.pageSize;
    const pageItems = teachers.slice(startIndex, startIndex + this.state.pageSize);

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="21" class="px-4 py-12 text-center text-muted-foreground">
            <div class="flex flex-col items-center justify-center gap-2">
              ${getIcon('teachers', 'w-9 h-9 text-muted-foreground/40')}
              <p class="font-medium ${isKm ? 'font-khmer' : ''}">${isKm ? 'រកមិនឃើញទិន្នន័យគ្រូបង្រៀន ឬមន្ត្រីទេ' : 'No teacher or officer records found'}</p>
            </div>
          </td>
        </tr>
      `;
      if (pagination) pagination.innerHTML = `<span>${isKm ? 'សរុប៖ ០ នាក់' : 'Total: 0'}</span>`;
      return;
    }

    tbody.innerHTML = pageItems.map((t, idx) => {
      const rowNum = startIndex + idx + 1;
      const fullNameKm = `${t.lastNameKhmer || ''} ${t.firstNameKhmer || ''}`.trim() || t.khmerName || '—';
      const fullNameEn = `${t.lastNameLatin || ''} ${t.firstNameLatin || ''}`.trim() || t.englishName || '—';
      const photoSrc = t.photo || '';
      const teacherCode = t.code || t.teacherId || '—';
      const civilId = t.civilServantId || '—';
      const dobFormatted = t.dob ? formatDisplayDate(t.dob) : '—';
      const joinedFormatted = t.joinedDate ? formatDisplayDate(t.joinedDate) : '—';
      const permFormatted = t.permanentAppointmentDate ? formatDisplayDate(t.permanentAppointmentDate) : '—';
      const ethnicity = t.ethnicity || 'ខ្មែរ';

      // Birthplace compact
      const birthParts = [t.birthDistrict, t.birthProvince].filter(Boolean).join(', ') || '—';

      // Current address compact
      const currentParts = [
        t.houseNumber ? `ផ្ទះ ${t.houseNumber}` : '',
        t.group ? `ក្រុម ${t.group}` : '',
        t.street ? `ផ្លូវ ${t.street}` : '',
        t.currentVillage,
        t.currentCommune,
        t.currentDistrict,
        t.currentProvince
      ].filter(Boolean).join(', ') || '—';

      // Status badge
      const statusBadge = (t.status === 'សកម្ម' || t.status === 'Active' || !t.status)
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
             <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${isKm ? 'សកម្ម' : 'Active'}
           </span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
             ${t.status}
           </span>`;

      // NSSF badge
      const hasNssf = t.isNssf === true || t.isNssf === 'true' || !!t.nssfNumber;
      const nssfBadge = hasNssf
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20" title="${t.nssfNumber || ''}">
             ${getIcon('check', 'w-3 h-3')} ${t.nssfNumber || (isKm ? 'មាន' : 'Yes')}
           </span>`
        : `<span class="text-muted-foreground/60 text-[11px]">—</span>`;

      // Disability badge
      const hasDisability = t.isDisability === true || t.isDisability === 'true';
      const disabilityBadge = hasDisability
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" title="${t.disabilityDescription || t.disabilityType || ''}">
             ${t.disabilityType || (isKm ? 'ពិការ' : 'Yes')}
           </span>`
        : `<span class="text-muted-foreground/60 text-[11px]">—</span>`;

      return `
        <tr class="hover:bg-muted/30 transition-colors">
          <td class="w-10 px-3 py-2.5 text-center text-muted-foreground font-mono text-[11px] sticky left-0 z-10 bg-card">${rowNum}</td>
          
          <!-- Photo -->
          <td class="w-12 px-2 py-2.5 text-center">
            <div class="w-8 h-9 rounded-md bg-muted/60 border border-border mx-auto overflow-hidden flex items-center justify-center text-muted-foreground shadow-2xs">
              ${photoSrc 
                ? `<img src="${photoSrc}" class="w-full h-full object-cover" alt="${fullNameKm}" />`
                : getIcon('user', 'w-4 h-4')}
            </div>
          </td>

          <!-- Teacher Code (លេខកូដ) -->
          <td class="px-3.5 py-2.5 font-mono text-xs font-semibold text-foreground">
            ${teacherCode !== '—' ? `<span class="px-1.5 py-0.5 rounded bg-muted font-bold text-foreground border border-border/80">${teacherCode}</span>` : '—'}
          </td>

          <!-- Civil ID (អត្តលេខមន្ត្រីរាជការ) -->
          <td class="px-3.5 py-2.5 font-mono text-xs font-bold text-primary">
            ${civilId}
          </td>

          <!-- Full Name Khmer -->
          <td class="px-4 py-2.5 font-bold text-foreground font-khmer">
            ${fullNameKm}
          </td>

          <!-- Latin Name -->
          <td class="px-3.5 py-2.5 font-semibold text-muted-foreground font-mono uppercase text-[11px]">
            ${fullNameEn}
          </td>

          <!-- Gender -->
          <td class="px-2.5 py-2.5 text-center font-medium ${t.gender === 'ស្រី' || t.gender === 'Female' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}">
            ${t.gender || '—'}
          </td>

          <!-- DOB -->
          <td class="px-3 py-2.5 text-center font-mono text-[11px] text-muted-foreground">
            ${dobFormatted}
          </td>

          <!-- Ethnicity -->
          <td class="px-3 py-2.5 text-center text-xs font-medium text-foreground ${isKm ? 'font-khmer' : ''}">
            ${ethnicity}
          </td>

          <!-- National ID -->
          <td class="px-3.5 py-2.5 font-mono text-xs text-foreground">
            ${t.nationalId || '—'}
          </td>

          <!-- Bank Account -->
          <td class="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
            ${t.bankAccount || '—'}
          </td>

          <!-- Phone -->
          <td class="px-3.5 py-2.5 font-mono text-xs text-foreground">
            ${t.phone || t.phone1 || '—'}
          </td>

          <!-- Email -->
          <td class="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
            ${t.email || '—'}
          </td>

          <!-- Birthplace -->
          <td class="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[160px] font-khmer" title="${birthParts}">
            ${birthParts}
          </td>

          <!-- Current Residence -->
          <td class="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[200px] font-khmer" title="${currentParts}">
            ${currentParts}
          </td>

          <!-- Joined Date -->
          <td class="px-3 py-2.5 text-center font-mono text-[11px] text-muted-foreground">
            ${joinedFormatted}
          </td>

          <!-- Permanent Date -->
          <td class="px-3 py-2.5 text-center font-mono text-[11px] text-muted-foreground">
            ${permFormatted}
          </td>

          <!-- NSSF -->
          <td class="px-3 py-2.5 text-center">
            ${nssfBadge}
          </td>

          <!-- Disability -->
          <td class="px-3 py-2.5 text-center">
            ${disabilityBadge}
          </td>

          <!-- Status -->
          <td class="px-3 py-2.5 text-center">
            ${statusBadge}
          </td>

          <!-- Actions -->
          <td class="w-24 px-3 py-2.5 text-center sticky right-0 z-10 bg-card">
            <div class="flex items-center justify-center gap-1">
              <!-- View CV -->
              <button data-action="cv" data-id="${t.id}" class="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer" title="${isKm ? 'មើលជីវប្រវត្តិ (CV)' : 'View CV'}">
                ${getIcon('fileText', 'w-3.5 h-3.5')}
              </button>
              <!-- Edit -->
              <button data-action="edit" data-id="${t.id}" class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="${isKm ? 'កែប្រែ' : 'Edit'}">
                ${getIcon('edit', 'w-3.5 h-3.5')}
              </button>
              <!-- Delete -->
              <button data-action="delete" data-id="${t.id}" class="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" title="${isKm ? 'លុប' : 'Delete'}">
                ${getIcon('trash', 'w-3.5 h-3.5')}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row action listeners
    // CV Preview
    tbody.querySelectorAll('button[data-action="cv"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const teacher = await TeacherService.getById(id);
        if (teacher) {
          const reportTitle = isKm 
            ? `ជីវប្រវត្តិមន្ត្រីរាជការ - ${teacher.khmerName || teacher.teacherId}` 
            : `Officer CV - ${teacher.englishName || teacher.teacherId}`;

          await ReportViewer.open({
            reportKey: `officer_teacher_cv_${teacher.id}`,
            title: reportTitle,
            subtitle: isKm ? 'ព្រះរាជាណាចក្រកម្ពុជា • ក្រសួងអប់រំ យុវជន និងកីឡា' : 'Kingdom of Cambodia • MoEYS',
            orientation: 'portrait',
            renderContent: async () => await TeacherCvTemplate.render(teacher)
          });
        }
      });
    });

    // Edit
    tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const teacher = await TeacherService.getById(id);
        if (teacher) {
          this.openTeacherForm(teacher);
        }
      });
    });

    // Delete
    tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const teacher = await TeacherService.getById(id);
        if (!teacher) return;
        const fullName = `${teacher.lastNameKhmer || ''} ${teacher.firstNameKhmer || ''}`.trim() || teacher.teacherId;

        const confirmed = confirm(isKm 
          ? `តើអ្នកពិតជាចង់លុបទិន្នន័យគ្រូបង្រៀន "${fullName}" នេះមែនទេ?` 
          : `Are you sure you want to delete teacher "${fullName}"?`);
        if (confirmed) {
          try {
            await TeacherService.delete(id);
            toast.success(isKm ? 'បានលុបទិន្នន័យគ្រូបង្រៀនដោយជោគជ័យ' : 'Teacher deleted successfully');
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
          <button id="btn-officer-prev" ${this.state.page <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="cursor-pointer hover:bg-muted"'} class="px-3 py-1 rounded-lg border border-border text-xs font-medium transition-colors">
            ${isKm ? 'ទំព័រមុន' : 'Previous'}
          </button>
          <span class="px-2.5 py-1 font-bold text-foreground">${this.state.page} / ${totalPages}</span>
          <button id="btn-officer-next" ${this.state.page >= totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="cursor-pointer hover:bg-muted"'} class="px-3 py-1 rounded-lg border border-border text-xs font-medium transition-colors">
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
  },

  /**
   * Export all officer teachers to Excel (.xlsx) with all form fields
   */
  async exportToExcel() {
    const isKm = i18n.getLocale() === 'km';
    const list = this.cachedTeachers || [];
    if (list.length === 0) {
      toast.warning(isKm ? 'មិនមានទិន្នន័យដើម្បីទាញយកទេ' : 'No teacher records to export');
      return;
    }

    try {
      // Check if ExcelJS is loaded globally or load it dynamically
      let ExcelJS = window.ExcelJS;
      if (!ExcelJS) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'assets/vendor/exceljs.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load exceljs'));
          document.head.appendChild(script);
        });
        ExcelJS = window.ExcelJS;
      }

      if (!ExcelJS) {
        toast.error('Excel library is not available');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(isKm ? 'បញ្ជីគ្រូបង្រៀន-មន្ត្រី' : 'Teachers_Officers');

      // Setup Headers
      sheet.columns = [
        { header: isKm ? 'ល.រ' : 'No', key: 'no', width: 6 },
        { header: isKm ? 'លេខកូដ' : 'Code', key: 'teacherId', width: 14 },
        { header: isKm ? 'អត្តលេខមន្ត្រីរាជការ' : 'Civil Servant ID', key: 'civilServantId', width: 18 },
        { header: isKm ? 'គោត្តនាម' : 'Last Name (KM)', key: 'lastNameKhmer', width: 14 },
        { header: isKm ? 'នាមខ្លួន' : 'First Name (KM)', key: 'firstNameKhmer', width: 14 },
        { header: isKm ? 'គោត្តនាម-នាម' : 'Full Name (KM)', key: 'fullNameKm', width: 20 },
        { header: isKm ? 'ឈ្មោះឡាតាំង' : 'Latin Name', key: 'latinName', width: 20 },
        { header: isKm ? 'ភេទ' : 'Gender', key: 'gender', width: 8 },
        { header: isKm ? 'ថ្ងៃខែឆ្នាំកំណើត' : 'Date of Birth', key: 'dob', width: 15 },
        { header: isKm ? 'ជនជាតិ' : 'Ethnicity', key: 'ethnicity', width: 10 },
        { header: isKm ? 'អត្តសញ្ញាណប័ណ្ណ' : 'National ID', key: 'nationalId', width: 16 },
        { header: isKm ? 'គណនីធនាគារ' : 'Bank Account', key: 'bankAccount', width: 22 },
        { header: isKm ? 'លេខទូរស័ព្ទ' : 'Phone', key: 'phone', width: 15 },
        { header: isKm ? 'អ៊ីមែល' : 'Email', key: 'email', width: 22 },
        { header: isKm ? 'ទីកន្លែងកំណើត (ស្រុក, ខេត្ត)' : 'Birthplace', key: 'birthplace', width: 25 },
        { header: isKm ? 'អាសយដ្ឋានបច្ចុប្បន្ន' : 'Current Address', key: 'currentAddress', width: 35 },
        { header: isKm ? 'ថ្ងៃចូលបម្រើការងារ' : 'Joined Date', key: 'joinedDate', width: 16 },
        { header: isKm ? 'ថ្ងៃតាំងស៊ប់' : 'Permanent Appt Date', key: 'permanentDate', width: 16 },
        { header: isKm ? 'សមាជិក ប.ស.ស.' : 'NSSF Member', key: 'isNssf', width: 14 },
        { header: isKm ? 'លេខកាត ប.ស.ស.' : 'NSSF Number', key: 'nssfNumber', width: 16 },
        { header: isKm ? 'ពិការភាព' : 'Disability', key: 'isDisability', width: 14 },
        { header: isKm ? 'ប្រភេទពិការ' : 'Disability Type', key: 'disabilityType', width: 16 },
        { header: isKm ? 'ស្ថានភាព' : 'Status', key: 'status', width: 12 }
      ];

      // Header style
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D4536' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;

      list.forEach((t, idx) => {
        const row = sheet.addRow({
          no: idx + 1,
          teacherId: t.code || t.teacherId || '',
          civilServantId: t.civilServantId || '',
          lastNameKhmer: t.lastNameKhmer || '',
          firstNameKhmer: t.firstNameKhmer || '',
          fullNameKm: `${t.lastNameKhmer || ''} ${t.firstNameKhmer || ''}`.trim() || t.khmerName || '',
          latinName: `${t.lastNameLatin || ''} ${t.firstNameLatin || ''}`.trim() || t.englishName || '',
          gender: t.gender || '',
          dob: t.dob ? formatDisplayDate(t.dob) : '',
          ethnicity: t.ethnicity || 'ខ្មែរ',
          nationalId: t.nationalId || '',
          bankAccount: t.bankAccount || '',
          phone: t.phone || t.phone1 || '',
          email: t.email || '',
          birthplace: [t.birthDistrict, t.birthProvince].filter(Boolean).join(', '),
          currentAddress: [
            t.houseNumber ? `ផ្ទះ ${t.houseNumber}` : '',
            t.group ? `ក្រុម ${t.group}` : '',
            t.street ? `ផ្លូវ ${t.street}` : '',
            t.currentVillage,
            t.currentCommune,
            t.currentDistrict,
            t.currentProvince
          ].filter(Boolean).join(', '),
          joinedDate: t.joinedDate ? formatDisplayDate(t.joinedDate) : '',
          permanentDate: t.permanentAppointmentDate ? formatDisplayDate(t.permanentAppointmentDate) : '',
          isNssf: (t.isNssf === true || t.isNssf === 'true') ? (isKm ? 'បាទ/ចាស' : 'Yes') : (isKm ? 'ទេ' : 'No'),
          nssfNumber: t.nssfNumber || '',
          isDisability: (t.isDisability === true || t.isDisability === 'true') ? (isKm ? 'មាន' : 'Yes') : (isKm ? 'គ្មាន' : 'No'),
          disabilityType: t.disabilityType || '',
          status: t.status || 'សកម្ម'
        });

        row.alignment = { vertical: 'middle' };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MoEYS_Teachers_Officers_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(isKm ? 'បានទាញយកទិន្នន័យជា Excel ដោយជោគជ័យ' : 'Exported to Excel successfully');
    } catch (err) {
      console.error('Excel Export error:', err);
      toast.error(err.message || 'Error exporting to Excel');
    }
  },

  openTeacherForm(teacher = null) {
    const isEdit = !!teacher;
    const isKm = i18n.getLocale() === 'km';
    const drawerTitle = isEdit 
      ? (isKm ? 'កែប្រែព័ត៌មានមន្ត្រី/គ្រូបង្រៀន (ការិយាល័យ)' : 'Edit Teacher Record (Office)') 
      : (isKm ? 'បន្ថែមមន្ត្រី/គ្រូបង្រៀនថ្មី (ការិយាល័យ)' : 'Add New Teacher (Office)');

    if (window.UI?.drawer?.open) {
      window.UI.drawer.open({
        title: drawerTitle,
        render: async (container) => {
          await OfficerTeacherFormModal.open({
            teacher,
            container,
            close: () => window.UI.drawer.close(),
            onSave: async () => {
              window.UI.drawer.close();
              this.cachedTeachers = await TeacherService.getAll();
              await this.loadData();
            }
          });
        }
      });
      return;
    }

    OfficerTeacherFormModal.open({
      teacher,
      onSave: async () => {
        this.cachedTeachers = await TeacherService.getAll();
        await this.loadData();
      }
    });
  }
};
