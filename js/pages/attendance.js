/**
 * Monthly Attendance Management Module (Section 15)
 * Excel-style monthly attendance grid with columns:
 * No (ល.រ), Student ID (អត្តលេខ), Khmer Full Name (គោត្តនាម និងនាម), Gender (ភេទ),
 * Permission (ច្បាប់), Absent (ឥតច្បាប់), Total (សរុប), and Days of Selected Month (1..N).
 */
import {
  AttendanceService,
  ATTENDANCE_MONTHS,
  classifyAttendanceMark
} from '../services/attendanceService.js';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { i18n, t } from '../i18n/i18n.js';
import { toast } from '../components/toast.js';
import { getIcon } from '../components/icons.js';
import { Modal } from '../components/modal.js';

const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_KM = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហ', 'សុក្រ', 'សៅរ៍'];

export const AttendancePage = {
  state: {
    classes: [],
    selectedClassId: '',
    selectedMonth: '',
    selectedYear: '',
    activeYear: '2024–2025',
    searchQuery: '',
    selectedDayCol: null,
    sheet: null,
    autoSaveTimer: null,
    isSaving: false
  },

  getAvailableYears() {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set();
    for (let y = currentYear - 3; y <= currentYear + 4; y++) {
      yearsSet.add(String(y));
    }
    const matches = String(this.state.activeYear || '').match(/\d{4}/g);
    if (matches) {
      matches.forEach(m => yearsSet.add(m));
    }
    return Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
  },

  async render(container) {
    this.container = container;
    this.state.classes = await ClassService.getAll();
    this.state.activeYear = await SettingsService.getActiveAcademicYear();

    if (authService.isTeacher()) {
      let teacherClassId = authService.getAssignedClassId();
      if (!teacherClassId && this.state.classes.length > 0) {
        teacherClassId = this.state.classes[0].id;
        authService.setAssignedClassId(teacherClassId);
      }
      if (teacherClassId) {
        this.state.selectedClassId = teacherClassId;
      }
    } else if (this.state.classes.length > 0 && !this.state.selectedClassId) {
      this.state.selectedClassId = this.state.classes[0].id;
    }

    this.renderLayout();
    await this.loadSheet();

    if (!this._cloudRefreshBound) {
      this._cloudRefreshBound = true;
      window.addEventListener('app:refresh-data', async (e) => {
        // Only react to full cloud sync completions while on the attendance page
        if (!e.detail?.counts || !document.getElementById('attendance-grid-table')) return;
        const freshClasses = await ClassService.getAll();
        const prevIds = (this.state.classes || []).map(c => c.id).join(',');
        const nextIds = (freshClasses || []).map(c => c.id).join(',');
        this.state.classes = freshClasses;
        if (!this.state.selectedClassId && freshClasses.length > 0) {
          this.state.selectedClassId = authService.isTeacher()
            ? (authService.getAssignedClassId() || freshClasses[0].id)
            : freshClasses[0].id;
        }
        if (prevIds !== nextIds) {
          const selectCls = document.getElementById('select-att-class');
          if (selectCls) {
            selectCls.innerHTML = freshClasses.length === 0
              ? `<option value="">${t('classes.emptyList')}</option>`
              : freshClasses.map(c => `<option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
          }
        }
        if (this.state.selectedClassId && this.state.selectedMonth && this.state.selectedYear) {
          await this.loadSheet();
        }
      });
    }
  },

  renderLayout() {
    const classes = this.state.classes;
    const months = ATTENDANCE_MONTHS;
    const years = this.getAvailableYears();

    this.container.innerHTML = `
      <div class="space-y-4 animate-fade-in pb-12 select-none w-full max-w-full overflow-hidden">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-khmer">${t('attendance.title')}</h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-0.5 font-khmer">${t('attendance.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Legend -->
            <div class="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-khmer">
              <span class="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
                <kbd class="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 font-mono text-[11px]">P</kbd>
                <span>= ច្បាប់</span>
              </span>
              <span class="text-border">|</span>
              <span class="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-300">
                <kbd class="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 font-mono text-[11px]">A</kbd>
                <span>= ឥតច្បាប់</span>
              </span>
            </div>

            <button id="btn-clear-att-menu" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-700 dark:text-rose-300 transition-colors cursor-pointer font-khmer">
              ${getIcon('trash', 'w-4 h-4')}
              <span>សម្អាត</span>
              ${getIcon('chevronDown', 'w-3.5 h-3.5')}
            </button>

            <button id="btn-export-att-excel" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer">
              ${getIcon('download', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
              <span>នាំចេញ Excel</span>
            </button>

            <button id="btn-save-attendance" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors cursor-pointer">
              ${getIcon('check', 'w-4 h-4')}
              <span id="btn-save-att-label">${t('attendance.saveAttendance')}</span>
            </button>
          </div>
        </div>

        <!-- Filter, Month & Year Controls -->
        <div class="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Class Selector -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground font-medium font-khmer whitespace-nowrap">${t('attendance.class')}:</span>
              ${authService.isTeacher() && classes.length <= 1 ? (() => {
                const assignedCls = classes.find(c => c.id === this.state.selectedClassId) ||
                                    classes.find(c => c.id === authService.getAssignedClassId()) ||
                                    classes[0];
                return assignedCls ? `
                  <div class="h-9 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary flex items-center gap-1.5 box-border">
                    ${getIcon('classes', 'w-3.5 h-3.5')}
                    <span>${assignedCls.name}</span>
                  </div>
                ` : `
                  <a href="#classes" class="h-9 px-3 py-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5 box-border hover:bg-amber-500/20 transition-colors">
                    ${getIcon('plus', 'w-3.5 h-3.5')}
                    <span>${t('classes.emptyList')}</span>
                  </a>
                `;
              })() : `
                <select id="select-att-class" class="h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-background text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs">
                  ${classes.length === 0 ? `<option value="">${t('classes.emptyList')}</option>` : ''}
                  ${classes.map(c => `
                    <option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Month Selector -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground font-medium font-khmer whitespace-nowrap">ខែ:</span>
              <select id="select-att-month" class="h-9 min-w-[155px] px-3 py-1.5 pr-8 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs font-khmer">
                <option value="" ${!this.state.selectedMonth ? 'selected' : ''}>— ជ្រើសរើសខែ —</option>
                ${months.map(m => `
                  <option value="${m.id}" ${this.state.selectedMonth === m.id ? 'selected' : ''}>ខែ${m.nameKm} (${m.nameEn})</option>
                `).join('')}
              </select>
            </div>

            <!-- Year Selector -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground font-medium font-khmer whitespace-nowrap">ឆ្នាំ:</span>
              <select id="select-att-year" class="h-9 min-w-[135px] px-3 py-1.5 pr-8 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs font-khmer">
                <option value="" ${!this.state.selectedYear ? 'selected' : ''}>— ជ្រើសរើសឆ្នាំ —</option>
                ${years.map(y => `
                  <option value="${y}" ${String(this.state.selectedYear) === String(y) ? 'selected' : ''}>ឆ្នាំ ${y}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Search Student Input -->
          <div class="relative w-full lg:w-64">
            <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground">
              ${getIcon('search', 'w-3.5 h-3.5')}
            </span>
            <input
              type="text"
              id="input-att-search"
              value="${this.state.searchQuery}"
              placeholder="ស្វែងរកឈ្មោះ ឬ អត្តលេខសិស្ស..."
              class="h-9 w-full pl-8 pr-3 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <!-- Live Monthly Summary Banner -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3" id="att-summary-banner">
          <div class="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
            <div>
              <span class="text-[11px] text-muted-foreground font-khmer font-semibold block">សិស្សសរុប</span>
              <p class="text-lg font-bold text-foreground mt-0.5 font-mono" id="stat-att-total">0 នាក់</p>
            </div>
            <span class="text-xs font-khmer font-medium px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400" id="stat-att-female">ស្រី 0 នាក់</span>
          </div>
          <div class="p-3 rounded-lg bg-card border border-border">
            <span class="text-[11px] text-sky-700 dark:text-sky-400 font-khmer font-semibold block">ច្បាប់សរុប (ខែនេះ)</span>
            <p class="text-lg font-bold text-sky-700 dark:text-sky-400 mt-0.5 font-mono" id="stat-att-perm">0 ដង</p>
          </div>
          <div class="p-3 rounded-lg bg-card border border-border">
            <span class="text-[11px] text-rose-600 dark:text-rose-400 font-khmer font-semibold block">ឥតច្បាប់សរុប (ខែនេះ)</span>
            <p class="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5 font-mono" id="stat-att-absent">0 ដង</p>
          </div>
          <div class="p-3 rounded-lg bg-card border border-border">
            <span class="text-[11px] text-violet-700 dark:text-violet-400 font-khmer font-semibold block">សរុបអវត្តមាន (ខែនេះ)</span>
            <p class="text-lg font-bold text-violet-700 dark:text-violet-400 mt-0.5 font-mono" id="stat-att-sum">0 ដង</p>
          </div>
        </div>

        <!-- Monthly Attendance Grid Container -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden relative w-full max-w-full">
          <!-- Empty state shown before user chooses both Month and Year -->
          <div id="att-empty-month-state" class="py-20 px-4 text-center ${(this.state.selectedMonth && this.state.selectedYear) ? 'hidden' : ''}">
            <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 shadow-2xs">
              ${getIcon('calendar', 'w-6 h-6')}
            </div>
            <h3 id="att-empty-title" class="text-sm font-bold text-foreground font-khmer mb-1">
              សូមជ្រើសរើសខែ និងឆ្នាំជាមុនសិន
            </h3>
            <p id="att-empty-desc" class="text-xs text-muted-foreground font-khmer max-w-md mx-auto">
              ជ្រើសរើសខែ និងឆ្នាំនៅខាងលើ ដើម្បីបង្ហាញតារាងវត្តមានប្រចាំខែ
            </p>
          </div>

          <div id="att-table-wrapper" class="score-table-container max-h-[72vh] overflow-auto w-full max-w-full ${!(this.state.selectedMonth && this.state.selectedYear) ? 'hidden' : ''}">
            <table class="score-table no-shadcn text-left text-xs border-separate" id="attendance-grid-table">
              <colgroup id="attendance-table-colgroup"></colgroup>
              <thead id="attendance-table-head"></thead>
              <tbody id="attendance-table-body" class="divide-y divide-border/40"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindStaticEvents();
  },

  async loadSheet() {
    const emptyState = document.getElementById('att-empty-month-state');
    const emptyTitle = document.getElementById('att-empty-title');
    const emptyDesc = document.getElementById('att-empty-desc');
    const wrapper = document.getElementById('att-table-wrapper');
    const hasMonthAndYear = Boolean(
      this.state.selectedClassId && this.state.selectedMonth && this.state.selectedYear
    );

    emptyState?.classList.toggle('hidden', hasMonthAndYear);
    wrapper?.classList.toggle('hidden', !hasMonthAndYear);

    if (!hasMonthAndYear) {
      this.state.sheet = null;
      this.state.selectedDayCol = null;
      if (emptyTitle && emptyDesc) {
        if (this.state.selectedMonth && !this.state.selectedYear) {
          emptyTitle.textContent = 'សូមជ្រើសរើសឆ្នាំជាមុនសិន';
          emptyDesc.textContent = 'សូមជ្រើសរើសឆ្នាំនៅប្រអប់ខាងលើ ដើម្បីបង្ហាញតារាងវត្តមាន';
        } else if (!this.state.selectedMonth && this.state.selectedYear) {
          emptyTitle.textContent = 'សូមជ្រើសរើសខែជាមុនសិន';
          emptyDesc.textContent = 'សូមជ្រើសរើសខែនៅប្រអប់ខាងលើ ដើម្បីបង្ហាញតារាងវត្តមាន';
        } else {
          emptyTitle.textContent = 'សូមជ្រើសរើសខែ និងឆ្នាំជាមុនសិន';
          emptyDesc.textContent = 'ជ្រើសរើសខែ និងឆ្នាំនៅខាងលើ ដើម្បីបង្ហាញតារាងវត្តមានប្រចាំខែ';
        }
      }
      this.updateStats();
      return;
    }

    this.state.sheet = await AttendanceService.getMonthlyAttendanceSheet({
      classId: this.state.selectedClassId,
      academicYear: this.state.activeYear,
      month: this.state.selectedMonth,
      year: this.state.selectedYear
    });

    if (this.state.selectedDayCol && this.state.selectedDayCol > this.state.sheet.daysInMonth) {
      this.state.selectedDayCol = null;
    }

    this.renderTable();
    this.updateStats();
  },

  getFilteredRows() {
    if (!this.state.sheet || !Array.isArray(this.state.sheet.rows)) return [];
    const q = (this.state.searchQuery || '').trim().toLowerCase();
    if (!q) return this.state.sheet.rows;
    return this.state.sheet.rows.filter(r => {
      const fullKm = (r.khmerFullName || '').toLowerCase();
      const code = (r.studentNumber || '').toLowerCase();
      const en = (r.englishName || '').toLowerCase();
      return fullKm.includes(q) || code.includes(q) || en.includes(q);
    });
  },

  renderTable() {
    const colgroup = document.getElementById('attendance-table-colgroup');
    const thead = document.getElementById('attendance-table-head');
    const tbody = document.getElementById('attendance-table-body');
    if (!thead || !tbody || !this.state.sheet) return;

    const { daysInMonth, yearNum, monthNum } = this.state.sheet;
    const rows = this.getFilteredRows();

    // 1. Fixed Column Widths via Colgroup (responsive CSS classes match .att-sticky-col-1..4 on desktop & mobile)
    if (colgroup) {
      let dayColsHtml = '';
      for (let d = 1; d <= daysInMonth; d++) {
        dayColsHtml += `<col class="att-col-day">`;
      }
      colgroup.innerHTML = `
        <col class="att-col-1">
        <col class="att-col-2">
        <col class="att-col-3">
        <col class="att-col-4">
        <col class="att-col-perm">
        <col class="att-col-absent">
        <col class="att-col-total">
        ${dayColsHtml}
      `;
    }

    // 2. Build Day Header Columns (1..daysInMonth) with z-index: 10 so they scroll cleanly under sticky left columns
    const isKm = i18n.getLocale() === 'km';
    const dayNames = isKm ? DAY_NAMES_KM : DAY_NAMES_EN;
    let dayHeadersHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeekIdx = new Date(yearNum, monthNum - 1, d).getDay();
      const dayName = dayNames[dayOfWeekIdx];
      const isSunday = dayOfWeekIdx === 0;
      const isSelectedCol = this.state.selectedDayCol === d;
      dayHeadersHtml += `
        <th data-day-col="${d}" title="ចុចដើម្បីជ្រើសរើសជួរឈរថ្ងៃទី ${d}" class="att-scroll-th att-day-th ${isSelectedCol ? 'is-selected-col' : ''} p-0 text-center font-mono" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] mx-auto flex flex-col items-center justify-center text-center bg-transparent" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 42px; line-height: 1.1; gap: 2px;">
            <span class="font-bold font-mono ${isSunday ? 'text-rose-600 dark:text-rose-400' : ''}" style="font-size: 11px; font-weight: 700; line-height: 1; display: block;">${d}</span>
            <span class="${isKm ? 'font-khmer' : 'font-mono'} ${isSunday ? 'text-rose-500 dark:text-rose-400' : 'text-muted-foreground'}" style="font-size: 9px; font-weight: 600; line-height: 1.1; display: block; white-space: nowrap;">${dayName}</span>
          </div>
        </th>
      `;
    }

    thead.innerHTML = `
      <tr class="border-b border-border">
        <th class="att-sticky-col-1 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] whitespace-nowrap flex items-center justify-center text-center bg-transparent">ល.រ</div>
        </th>
        <th class="att-sticky-col-2 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] whitespace-nowrap flex items-center justify-center text-center px-1 bg-transparent">អត្តលេខ</div>
        </th>
        <th class="att-sticky-col-3 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] whitespace-nowrap flex items-center justify-center text-center px-1 bg-transparent">គោត្តនាម និងនាម</div>
        </th>
        <th class="att-sticky-col-4 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] whitespace-nowrap flex items-center justify-center text-center px-1 bg-transparent">ភេទ</div>
        </th>
        <th class="att-scroll-th att-col-perm-th p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
            <span>ច្បាប់</span>
          </div>
        </th>
        <th class="att-scroll-th att-col-absent-th p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
            <span>ឥតច្បាប់</span>
          </div>
        </th>
        <th class="att-scroll-th att-col-total-th p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-full h-[42px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
            <span>សរុប</span>
          </div>
        </th>
        ${dayHeadersHtml}
      </tr>
    `;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${7 + daysInMonth}" class="py-12 text-center text-muted-foreground font-khmer text-xs">
            ${t('attendance.emptyStudents')}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map((row, rowIdx) => {
      const isFemale = row.gender === 'Female' || row.gender === 'ស្រី' || row.gender === 'F';
      const genderLabel = isFemale ? 'ស្រី' : 'ប្រុស';
      const genderClass = isFemale
        ? 'text-rose-600 dark:text-rose-400 font-bold'
        : 'text-sky-600 dark:text-sky-400 font-bold';

      let dayCellsHtml = '';
      for (let d = 1; d <= daysInMonth; d++) {
        const dayName = dayNames[new Date(yearNum, monthNum - 1, d).getDay()];
        const cellObj = row.days[d] || { status: 'Present', mark: '' };
        const markVal = cellObj.status === 'Excused'
          ? 'P'
          : cellObj.status === 'Absent'
            ? 'A'
            : '';
        const statusCellClass = cellObj.status === 'Excused'
          ? 'is-excused'
          : cellObj.status === 'Absent'
            ? 'is-absent'
            : '';

        dayCellsHtml += `
          <td class="score-cell-td att-day-td ${statusCellClass}">
            <select
              data-student-id="${row.studentId}"
              data-day="${d}"
              data-row-idx="${rowIdx}"
              data-col-idx="${d}"
              title="ថ្ងៃទី ${d} (${dayName}) (P = ច្បាប់, A = ឥតច្បាប់, ទទេ = វត្តមាន)"
              class="score-cell-input att-day-select no-shadcn font-mono font-bold"
            >
              <option value="" ${markVal === '' ? 'selected' : ''}></option>
              <option value="P" ${markVal === 'P' ? 'selected' : ''}>P</option>
              <option value="A" ${markVal === 'A' ? 'selected' : ''}>A</option>
            </select>
          </td>
        `;
      }

      return `
        <tr class="hover:bg-muted/15 transition-colors group" data-student-row="${row.studentId}">
          <!-- 1. No (ល.រ) -->
          <td class="att-sticky-col-1 p-0 text-center font-mono text-xs font-medium text-muted-foreground" style="z-index: 30 !important; transform: translateZ(0) !important;">
            <div class="w-full whitespace-nowrap text-center py-1.5 bg-transparent">${rowIdx + 1}</div>
          </td>
          <!-- 2. Student ID (អត្តលេខ) -->
          <td class="att-sticky-col-2 p-0 text-center font-mono text-xs font-medium text-foreground" style="z-index: 30 !important; transform: translateZ(0) !important;" title="${row.studentNumber || ''}">
            <div class="w-full whitespace-nowrap truncate text-center py-1.5 px-1 bg-transparent">${row.studentNumber || '—'}</div>
          </td>
          <!-- 3. Student Khmer Last Name + First Name (គោត្តនាម និងនាម) -->
          <td class="att-sticky-col-3 p-0 text-left font-khmer text-xs font-semibold text-foreground" style="z-index: 30 !important; transform: translateZ(0) !important;" title="${row.khmerFullName}">
            <div class="w-full whitespace-nowrap truncate text-left py-1.5 px-1.5 bg-transparent">${row.khmerFullName}</div>
          </td>
          <!-- 4. Gender (ភេទ) -->
          <td class="att-sticky-col-4 p-0 text-center font-khmer text-xs ${genderClass}" style="z-index: 30 !important; transform: translateZ(0) !important;">
            <div class="w-full whitespace-nowrap text-center py-1.5 px-0.5 bg-transparent">${genderLabel}</div>
          </td>
          <!-- 5. Permission (ច្បាប់) - Read-only auto-calculated -->
          <td
            class="score-cell-td att-col-perm-td font-mono text-xs font-bold text-sky-700 dark:text-sky-300 select-none"
            data-perm-cell="${row.studentId}"
          >
            ${row.permission || 0}
          </td>
          <!-- 6. Absent (ឥតច្បាប់) - Read-only auto-calculated -->
          <td
            class="score-cell-td att-col-absent-td font-mono text-xs font-bold text-rose-600 dark:text-rose-400 select-none"
            data-absent-cell="${row.studentId}"
          >
            ${row.absent || 0}
          </td>
          <!-- 7. Total (សរុប) - Read-only auto-calculated -->
          <td
            class="score-cell-td att-col-total-td font-mono text-xs font-bold text-violet-700 dark:text-violet-300 select-none"
            data-total-cell="${row.studentId}"
          >
            ${row.total || 0}
          </td>
          <!-- 8..N. Days of Month (1..daysInMonth) -->
          ${dayCellsHtml}
        </tr>
      `;
    }).join('');

    this.bindGridEvents();
  },

  setSelectedDayCol(dayNum) {
    const d = parseInt(dayNum, 10);
    if (!d || isNaN(d)) return;
    this.state.selectedDayCol = d;
    const thead = document.getElementById('attendance-table-head');
    if (thead) {
      thead.querySelectorAll('th.att-day-th').forEach(th => {
        const colDay = parseInt(th.getAttribute('data-day-col'), 10);
        th.classList.toggle('is-selected-col', colDay === d);
      });
    }
  },

  bindGridEvents() {
    const thead = document.getElementById('attendance-table-head');
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody || !this.state.sheet) return;

    if (thead) {
      thead.querySelectorAll('th.att-day-th').forEach(th => {
        th.addEventListener('click', () => {
          const day = parseInt(th.getAttribute('data-day-col'), 10);
          this.setSelectedDayCol(day);
        });
      });
    }

    const applyCellChange = (sel) => {
      const studentId = sel.getAttribute('data-student-id');
      const day = parseInt(sel.getAttribute('data-day'), 10);
      this.setSelectedDayCol(day);
      const row = this.state.sheet.rows.find(r => r.studentId === studentId);
      if (!row) return;

      const { status, mark } = classifyAttendanceMark(sel.value);
      row.days[day] = { status, mark };

      // Update cell visual style
      const td = sel.closest('td');
      if (td) {
        td.classList.remove('is-excused', 'is-absent');
        if (status === 'Excused') {
          td.classList.add('is-excused');
        } else if (status === 'Absent') {
          td.classList.add('is-absent');
        }
      }

      // Recalculate permission, absent, and total from all days in the month
      let permCount = 0;
      let absCount = 0;
      for (let d = 1; d <= this.state.sheet.daysInMonth; d++) {
        const st = row.days[d]?.status;
        if (st === 'Excused') permCount++;
        else if (st === 'Absent') absCount++;
      }
      row.permission = permCount;
      row.absent = absCount;
      row.total = permCount + absCount;

      // Update read-only summary cells in DOM
      const tr = sel.closest('tr');
      if (tr) {
        const permTd = tr.querySelector(`[data-perm-cell="${studentId}"]`);
        const absTd = tr.querySelector(`[data-absent-cell="${studentId}"]`);
        const totalTd = tr.querySelector(`[data-total-cell="${studentId}"]`);
        if (permTd) permTd.textContent = row.permission;
        if (absTd) absTd.textContent = row.absent;
        if (totalTd) totalTd.textContent = row.total;
      }

      this.updateStats();
      this.scheduleAutoSave();
    };

    tbody.querySelectorAll('select.att-day-select').forEach(sel => {
      sel.addEventListener('focus', () => {
        const day = parseInt(sel.getAttribute('data-day'), 10);
        this.setSelectedDayCol(day);
      });

      sel.addEventListener('change', () => {
        applyCellChange(sel);
      });

      // Keyboard navigation & quick P / A / Delete shortcuts
      sel.addEventListener('keydown', (e) => {
        const keyUpper = (e.key || '').toUpperCase();
        if (keyUpper === 'P') {
          e.preventDefault();
          sel.value = 'P';
          applyCellChange(sel);
          return;
        }
        if (keyUpper === 'A') {
          e.preventDefault();
          sel.value = 'A';
          applyCellChange(sel);
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          sel.value = '';
          applyCellChange(sel);
          return;
        }

        const rowIdx = parseInt(sel.getAttribute('data-row-idx'), 10);
        const colIdx = parseInt(sel.getAttribute('data-col-idx'), 10);
        let targetRow = rowIdx;
        let targetCol = colIdx;

        if (e.key === 'ArrowRight') {
          targetCol = colIdx + 1;
        } else if (e.key === 'ArrowLeft') {
          targetCol = colIdx - 1;
        } else if (e.key === 'ArrowDown') {
          targetRow = rowIdx + 1;
        } else if (e.key === 'ArrowUp') {
          targetRow = rowIdx - 1;
        } else {
          return;
        }

        const nextSelect = tbody.querySelector(
          `select[data-row-idx="${targetRow}"][data-col-idx="${targetCol}"]`
        );
        if (nextSelect) {
          e.preventDefault();
          nextSelect.focus();
        }
      });
    });
  },

  openClearMenuPopover(triggerBtn) {
    if (!this.state.sheet || !this.state.selectedMonth || !this.state.selectedYear) {
      toast.warning('សូមជ្រើសរើសខែ និងឆ្នាំជាមុនសិន');
      return;
    }

    const existing = document.getElementById('att-clear-menu-popover');
    if (existing) {
      existing.remove();
      return;
    }

    const rect = triggerBtn.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'att-clear-menu-popover';
    popover.className = 'fixed z-[9999] w-64 rounded-xl border border-border bg-card shadow-xl p-1.5 animate-fade-in font-khmer select-none';

    const topPos = Math.min(rect.bottom + 6, window.innerHeight - 140);
    const leftPos = Math.max(8, Math.min(rect.right - 256, window.innerWidth - 264));
    popover.style.top = `${topPos}px`;
    popover.style.left = `${leftPos}px`;

    const selectedDayBadge = this.state.selectedDayCol
      ? `<span class="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px] font-bold">ថ្ងៃទី ${this.state.selectedDayCol}</span>`
      : `<span class="text-[10px] text-muted-foreground">ជ្រើសរើសថ្ងៃ</span>`;

    popover.innerHTML = `
      <button type="button" id="btn-opt-clear-col" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
        <span class="flex items-center gap-2">
          ${getIcon('columns', 'w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0')}
          <span>សម្អាតជួរឈរដែលបានជ្រើសរើស</span>
        </span>
        ${selectedDayBadge}
      </button>
      <div class="my-1 border-t border-border/60"></div>
      <button type="button" id="btn-opt-clear-all" class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer">
        ${getIcon('trash', 'w-4 h-4 shrink-0')}
        <span>សម្អាតតារាងទាំងមូល</span>
      </button>
    `;

    document.body.appendChild(popover);

    const closePopover = (e) => {
      if (!popover.contains(e.target) && !triggerBtn.contains(e.target)) {
        popover.remove();
        document.removeEventListener('mousedown', closePopover);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', closePopover);
    }, 0);

    popover.querySelector('#btn-opt-clear-col')?.addEventListener('click', () => {
      popover.remove();
      document.removeEventListener('mousedown', closePopover);
      this.promptClearSelectedColumn();
    });

    popover.querySelector('#btn-opt-clear-all')?.addEventListener('click', () => {
      popover.remove();
      document.removeEventListener('mousedown', closePopover);
      this.promptClearEntireTable();
    });
  },

  promptClearSelectedColumn() {
    if (!this.state.sheet) return;
    const { daysInMonth, yearNum, monthNum } = this.state.sheet;
    const isKm = i18n.getLocale() === 'km';
    const dayNames = isKm ? DAY_NAMES_KM : DAY_NAMES_EN;
    const defaultDay = this.state.selectedDayCol || 1;

    let optionsHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dayName = dayNames[new Date(yearNum, monthNum - 1, d).getDay()];
      optionsHtml += `<option value="${d}" ${d === defaultDay ? 'selected' : ''}>ថ្ងៃទី ${d} (${dayName})</option>`;
    }

    const modal = Modal.open({
      title: 'សម្អាតជួរឈរដែលបានជ្រើសរើស',
      maxWidth: 'max-w-md',
      preventUnsavedClose: false,
      backdropClose: true,
      content: `
        <div class="space-y-3 font-khmer">
          <p class="text-xs text-muted-foreground leading-relaxed">
            សូមជ្រើសរើសជួរឈរថ្ងៃដែលអ្នកចង់សម្អាតទិន្នន័យវត្តមាន (P/A) របស់សិស្សទាំងអស់៖
          </p>
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1.5">ជួរឈរថ្ងៃទី៖</label>
            <select id="modal-select-clear-day" class="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-khmer">
              ${optionsHtml}
            </select>
          </div>
        </div>
      `,
      footer: `
        <button type="button" id="btn-cancel-clear-col" class="px-4 py-2 rounded-md border border-input bg-background hover:bg-accent text-xs font-medium font-khmer cursor-pointer">
          បោះបង់
        </button>
        <button type="button" id="btn-confirm-clear-col" class="px-4 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium font-khmer shadow-sm cursor-pointer">
          សម្អាតជួរឈរនេះ
        </button>
      `
    });

    modal.element.querySelector('#btn-cancel-clear-col')?.addEventListener('click', () => {
      modal.forceClose();
    });

    modal.element.querySelector('#btn-confirm-clear-col')?.addEventListener('click', async () => {
      const selectEl = modal.element.querySelector('#modal-select-clear-day');
      const dayToClear = parseInt(selectEl?.value, 10);
      modal.forceClose();
      if (!dayToClear || !this.state.sheet) return;

      this.state.selectedDayCol = dayToClear;
      for (const row of this.state.sheet.rows) {
        row.days[dayToClear] = { status: 'Present', mark: '' };
        let permCount = 0;
        let absCount = 0;
        for (let d = 1; d <= this.state.sheet.daysInMonth; d++) {
          const st = row.days[d]?.status;
          if (st === 'Excused') permCount++;
          else if (st === 'Absent') absCount++;
        }
        row.permission = permCount;
        row.absent = absCount;
        row.total = permCount + absCount;
      }

      this.renderTable();
      this.updateStats();
      await this.saveSheet({ silent: true });
      toast.success(`បានសម្អាតវត្តមានជួរឈរថ្ងៃទី ${dayToClear} រួចរាល់`);
    });
  },

  promptClearEntireTable() {
    if (!this.state.sheet) return;
    const monthObj = ATTENDANCE_MONTHS.find(m => m.id === this.state.selectedMonth);
    const monthLabel = monthObj ? `ខែ${monthObj.nameKm}` : this.state.selectedMonth;

    Modal.confirm({
      title: 'សម្អាតតារាងទាំងមូល',
      message: `តើអ្នកពិតជាចង់សម្អាតទិន្នន័យវត្តមានទាំងអស់ក្នុងតារាងប្រចាំ${monthLabel} ឆ្នាំ ${this.state.selectedYear} មែនទេ?`,
      confirmText: 'សម្អាតទាំងអស់',
      cancelText: 'បោះបង់',
      destructive: true,
      onConfirm: async () => {
        if (!this.state.sheet) return;
        const { daysInMonth } = this.state.sheet;
        for (const row of this.state.sheet.rows) {
          for (let d = 1; d <= daysInMonth; d++) {
            row.days[d] = { status: 'Present', mark: '' };
          }
          row.permission = 0;
          row.absent = 0;
          row.total = 0;
        }
        this.renderTable();
        this.updateStats();
        await this.saveSheet({ silent: true });
        toast.success(`បានសម្អាតតារាងវត្តមានប្រចាំ${monthLabel} ឆ្នាំ ${this.state.selectedYear} ទាំងមូលរួចរាល់`);
      }
    });
  },

  scheduleAutoSave() {
    if (this.state.autoSaveTimer) {
      clearTimeout(this.state.autoSaveTimer);
    }
    this.state.autoSaveTimer = setTimeout(async () => {
      await this.saveSheet({ silent: true });
    }, 650);
  },

  async saveSheet({ silent = false } = {}) {
    if (!this.state.sheet || this.state.isSaving) return;
    this.state.isSaving = true;
    const saveLabel = document.getElementById('btn-save-att-label');
    if (saveLabel && !silent) {
      saveLabel.textContent = 'កំពុងរក្សាទុក...';
    }

    try {
      await AttendanceService.saveMonthlyAttendanceSheet(this.state.sheet);
      if (!silent) {
        const selectedCls = this.state.classes.find(c => c.id === this.state.selectedClassId);
        const monthObj = ATTENDANCE_MONTHS.find(m => m.id === this.state.selectedMonth);
        toast.success(`បានរក្សាទុកវត្តមាន ${selectedCls?.name || ''} (${monthObj ? 'ខែ' + monthObj.nameKm : ''} ${this.state.selectedYear}) ដោយជោគជ័យ`);
      }
    } catch (err) {
      if (!silent) {
        toast.error(err.message || 'បរាជ័យក្នុងការរក្សាទុកវត្តមាន');
      }
    } finally {
      this.state.isSaving = false;
      if (saveLabel) {
        saveLabel.textContent = t('attendance.saveAttendance');
      }
    }
  },

  updateStats() {
    const elTotal = document.getElementById('stat-att-total');
    const elFemale = document.getElementById('stat-att-female');
    const elPerm = document.getElementById('stat-att-perm');
    const elAbsent = document.getElementById('stat-att-absent');
    const elSum = document.getElementById('stat-att-sum');

    const rows = this.state.sheet?.rows || [];
    const totalStudents = rows.length;
    const femaleStudents = rows.filter(
      r => r.gender === 'Female' || r.gender === 'ស្រី' || r.gender === 'F'
    ).length;

    let sumPerm = 0;
    let sumAbsent = 0;
    for (const r of rows) {
      sumPerm += parseInt(r.permission, 10) || 0;
      sumAbsent += parseInt(r.absent, 10) || 0;
    }
    const sumTotal = sumPerm + sumAbsent;

    if (elTotal) elTotal.textContent = `${totalStudents} នាក់`;
    if (elFemale) elFemale.textContent = `ស្រី ${femaleStudents} នាក់`;
    if (elPerm) elPerm.textContent = `${sumPerm} ដង`;
    if (elAbsent) elAbsent.textContent = `${sumAbsent} ដង`;
    if (elSum) elSum.textContent = `${sumTotal} ដង`;
  },

  exportExcel() {
    if (!this.state.sheet || !this.state.selectedMonth || !this.state.selectedYear) {
      toast.warning('សូមជ្រើសរើសខែ និងឆ្នាំជាមុនសិន មុនពេលនាំចេញ Excel');
      return;
    }

    const { daysInMonth, rows, yearNum, monthNum } = this.state.sheet;
    const selectedCls = this.state.classes.find(c => c.id === this.state.selectedClassId);
    const monthObj = ATTENDANCE_MONTHS.find(m => m.id === this.state.selectedMonth);
    const className = selectedCls?.name || '';
    const monthLabel = monthObj ? `ខែ${monthObj.nameKm}` : this.state.selectedMonth;

    const isKm = i18n.getLocale() === 'km';
    const dayNames = isKm ? DAY_NAMES_KM : DAY_NAMES_EN;
    let dayHeaderCells = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeekIdx = new Date(yearNum, monthNum - 1, d).getDay();
      const dayName = dayNames[dayOfWeekIdx];
      const dayColor = dayOfWeekIdx === 0 ? 'color:#e11d48;' : '';
      dayHeaderCells += `<th style="border:1px solid #94a3b8; background:#f1f5f9; text-align:center; width:36px; ${dayColor}">${d}<br><span style="font-size:8pt; font-weight:normal;">${dayName}</span></th>`;
    }

    const bodyRowsHtml = rows.map((r, i) => {
      const isFemale = r.gender === 'Female' || r.gender === 'ស្រី' || r.gender === 'F';
      let dayCells = '';
      for (let d = 1; d <= daysInMonth; d++) {
        const mk = r.days[d]?.mark || '';
        dayCells += `<td style="border:1px solid #cbd5e1; text-align:center;">${mk}</td>`;
      }
      return `
        <tr>
          <td style="border:1px solid #cbd5e1; text-align:center;">${i + 1}</td>
          <td style="border:1px solid #cbd5e1; text-align:center; mso-number-format:'\\@';">${r.studentNumber || ''}</td>
          <td style="border:1px solid #cbd5e1; text-align:left;">${r.khmerFullName || ''}</td>
          <td style="border:1px solid #cbd5e1; text-align:center;">${isFemale ? 'ស្រី' : 'ប្រុស'}</td>
          <td style="border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#0369a1;">${r.permission || 0}</td>
          <td style="border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#be123c;">${r.absent || 0}</td>
          <td style="border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#6d28d9;">${r.total || 0}</td>
          ${dayCells}
        </tr>
      `;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', sans-serif; font-size: 11pt; }
          th, td { padding: 4px 6px; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <th colspan="${7 + daysInMonth}" style="font-size:14pt; font-weight:bold; text-align:center; padding:8px;">
              តារាងវត្តមានសិស្សប្រចាំ${monthLabel} ឆ្នាំ ${yearNum} — ថ្នាក់ ${className}
            </th>
          </tr>
          <tr>
            <th style="border:1px solid #94a3b8; background:#f1f5f9; text-align:center;">ល.រ</th>
            <th style="border:1px solid #94a3b8; background:#f1f5f9; text-align:center;">អត្តលេខ</th>
            <th style="border:1px solid #94a3b8; background:#f1f5f9; text-align:center;">គោត្តនាម និងនាម</th>
            <th style="border:1px solid #94a3b8; background:#f1f5f9; text-align:center;">ភេទ</th>
            <th style="border:1px solid #94a3b8; background:#e0f2fe; color:#0369a1; text-align:center;">ច្បាប់</th>
            <th style="border:1px solid #94a3b8; background:#ffe4e6; color:#be123c; text-align:center;">ឥតច្បាប់</th>
            <th style="border:1px solid #94a3b8; background:#ede9fe; color:#6d28d9; text-align:center;">សរុប</th>
            ${dayHeaderCells}
          </tr>
          ${bodyRowsHtml}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${className}_${this.state.selectedMonth}_${yearNum}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  bindStaticEvents() {
    // Change Class
    document.getElementById('select-att-class')?.addEventListener('change', async (e) => {
      this.state.selectedClassId = e.target.value;
      if (authService.isTeacher() && this.state.selectedClassId) {
        await authService.setAssignedClassId(this.state.selectedClassId);
      }
      await this.loadSheet();
    });

    // Change Month
    document.getElementById('select-att-month')?.addEventListener('change', async (e) => {
      this.state.selectedMonth = e.target.value;
      await this.loadSheet();
    });

    // Change Year
    document.getElementById('select-att-year')?.addEventListener('change', async (e) => {
      this.state.selectedYear = e.target.value;
      await this.loadSheet();
    });

    // Search Student
    document.getElementById('input-att-search')?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value || '';
      if (this.state.sheet) {
        this.renderTable();
      }
    });

    // Clear Attendance Menu Button (2 options: Clear Selected Column / Clear Entire Table)
    const clearBtn = document.getElementById('btn-clear-att-menu');
    clearBtn?.addEventListener('click', () => {
      this.openClearMenuPopover(clearBtn);
    });

    // Save Attendance Button
    document.getElementById('btn-save-attendance')?.addEventListener('click', async () => {
      if (!this.state.selectedMonth || !this.state.selectedYear) {
        toast.warning('សូមជ្រើសរើសខែ និងឆ្នាំជាមុនសិន');
        return;
      }
      await this.saveSheet({ silent: false });
    });

    // Export Excel Button
    document.getElementById('btn-export-att-excel')?.addEventListener('click', () => {
      this.exportExcel();
    });
  }
};
