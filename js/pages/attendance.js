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
import { SchoolService } from '../services/schoolService.js';
import { authService } from '../services/authService.js';
import { i18n, t } from '../i18n/i18n.js';
import { toast } from '../components/toast.js';
import { getIcon } from '../components/icons.js';
import { Modal } from '../components/modal.js';
import { ReportViewer } from '../components/reportViewer.js';
import { syncStateManager } from '../services/syncStateManager.js';
import {
  getMonthKhmerCalendarMap,
  getKhmerLunarDayInfo,
  toKhmerNumeral
} from '../utils/khmerLunarCalendar.js';

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
    khmerCal: null,
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

            <button id="btn-att-report" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer font-khmer">
              ${getIcon('fileText', 'w-4 h-4')}
              <span>របាយការណ៍វត្តមាន</span>
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

        <!-- Khmer Lunar Calendar & Holidays Banner (shown when Month & Year are selected) -->
        <div id="att-khmer-holidays-banner" class="hidden p-3 rounded-xl border border-border bg-card shadow-2xs font-khmer"></div>

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
    const holidayBanner = document.getElementById('att-khmer-holidays-banner');
    const hasMonthAndYear = Boolean(
      this.state.selectedClassId && this.state.selectedMonth && this.state.selectedYear
    );

    emptyState?.classList.toggle('hidden', hasMonthAndYear);
    wrapper?.classList.toggle('hidden', !hasMonthAndYear);
    holidayBanner?.classList.toggle('hidden', !hasMonthAndYear);

    if (!hasMonthAndYear) {
      this.state.sheet = null;
      this.state.khmerCal = null;
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

    this.state.khmerCal = getMonthKhmerCalendarMap(
      this.state.sheet.yearNum,
      this.state.sheet.monthNum,
      this.state.sheet.daysInMonth
    );

    if (this.state.selectedDayCol && this.state.selectedDayCol > this.state.sheet.daysInMonth) {
      this.state.selectedDayCol = null;
    }

    this.renderKhmerHolidaysBanner();
    this.renderTable();
    this.updateStats();
  },

  renderKhmerHolidaysBanner() {
    const banner = document.getElementById('att-khmer-holidays-banner');
    if (!banner || !this.state.khmerCal || !this.state.sheet) return;

    const { holidaysList, lunarYearHeaderKm } = this.state.khmerCal;
    const holidaysPillsHtml = holidaysList.length === 0
      ? `<span class="text-xs text-muted-foreground">មិនមានថ្ងៃបុណ្យ ឬថ្ងៃឈប់សម្រាកផ្លូវការក្នុងខែនេះទេ</span>`
      : holidaysList.map(h => `
          <button
            type="button"
            data-holiday-day="${h.day}"
            title="ចុចដើម្បីទៅកាន់ជួរឈរថ្ងៃទី ${h.day} (${h.lunarMedium})"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <span class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-bold">ថ្ងៃទី ${h.day}</span>
            <span class="font-semibold">${h.holidayTitleKm}</span>
            <span class="text-[10px] text-rose-600/80 dark:text-rose-300/80">(${h.lunarMedium})</span>
          </button>
        `).join('');

    banner.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-border/60">
        <div class="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <span>☸ ចន្ទគតិខ្មែរ៖</span>
          <span>${lunarYearHeaderKm}</span>
        </div>
        <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span class="inline-flex items-center gap-1">
            <span class="w-2.5 h-2.5 rounded-xs bg-rose-500/25 border border-rose-500 inline-block"></span>
            <span>ថ្ងៃបុណ្យជាតិ/ចន្ទគតិ</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="text-amber-600 dark:text-amber-400 font-bold">☸</span>
            <span>ថ្ងៃសីល</span>
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-semibold text-foreground shrink-0">ថ្ងៃឈប់សម្រាក និងបុណ្យជាតិ៖</span>
        ${holidaysPillsHtml}
      </div>
    `;

    banner.querySelectorAll('[data-holiday-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.getAttribute('data-holiday-day'), 10);
        if (!day) return;
        this.setSelectedDayCol(day);
        const th = document.querySelector(`th.att-day-th[data-day-col="${day}"]`);
        if (th) {
          th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      });
    });
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
    const khmerCal = this.state.khmerCal || getMonthKhmerCalendarMap(yearNum, monthNum, daysInMonth);
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

    // 2. Build Day Header Columns (1..daysInMonth) with Khmer Lunar Date & Holiday Indicator
    const isKm = i18n.getLocale() === 'km';
    const dayNames = isKm ? DAY_NAMES_KM : DAY_NAMES_EN;
    let dayHeadersHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeekIdx = new Date(yearNum, monthNum - 1, d).getDay();
      const dayName = dayNames[dayOfWeekIdx];
      const isSunday = dayOfWeekIdx === 0;
      const isSelectedCol = this.state.selectedDayCol === d;
      const dayInfo = khmerCal.daysMap[d];
      const isHoliday = Boolean(dayInfo?.isHoliday);
      const isHolyDay = Boolean(dayInfo?.isHolyDay);
      const lunarShort = dayInfo ? dayInfo.lunarShort : '';
      const headerTooltip = dayInfo
        ? `ថ្ងៃទី ${d} (${dayInfo.lunarFull})${isHoliday ? `\n🎉 ថ្ងៃបុណ្យ៖ ${dayInfo.holidayTitleKm}` : ''}${isHolyDay ? '\n☸ ថ្ងៃសីល' : ''}`
        : `ថ្ងៃទី ${d}`;

      dayHeadersHtml += `
        <th
          data-day-col="${d}"
          title="${headerTooltip}"
          class="att-scroll-th att-day-th ${isHoliday ? 'is-holiday-col' : ''} ${isSelectedCol ? 'is-selected-col' : ''} p-0 text-center font-mono"
          style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;"
        >
          <div class="w-full h-[52px] mx-auto flex flex-col items-center justify-center text-center bg-transparent" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 52px; line-height: 1.05; gap: 1px;">
            <span class="font-bold font-mono ${(isSunday || isHoliday) ? 'text-rose-600 dark:text-rose-400' : ''}" style="font-size: 11px; font-weight: 700; line-height: 1; display: block;">
              ${d}${isHolyDay ? '<span class="text-amber-600 dark:text-amber-400 ml-0.5" style="font-size:8px;">☸</span>' : ''}
            </span>
            <span class="${isKm ? 'font-khmer' : 'font-mono'} ${(isSunday || isHoliday) ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}" style="font-size: 9px; font-weight: 600; line-height: 1.05; display: block; white-space: nowrap;">${dayName}</span>
            <span class="font-khmer ${isHoliday ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-amber-700/90 dark:text-amber-400/90'}" style="font-size: 8.5px; line-height: 1; display: block; white-space: nowrap;">${lunarShort}</span>
          </div>
        </th>
      `;
    }

    thead.innerHTML = `
      <tr class="border-b border-border">
        <th class="att-sticky-col-1 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[52px] whitespace-nowrap flex items-center justify-center text-center bg-transparent">ល.រ</div>
        </th>
        <th class="att-sticky-col-2 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[52px] whitespace-nowrap flex items-center justify-center text-center px-1 bg-transparent">អត្តលេខ</div>
        </th>
        <th class="att-sticky-col-3 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[52px] whitespace-nowrap flex items-center justify-center text-center px-1 bg-transparent">គោត្តនាម និងនាម</div>
        </th>
        <th class="att-sticky-col-4 p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
          <div class="w-full h-[52px] whitespace-nowrap flex items-center justify-center text-center px-1 bg-transparent">ភេទ</div>
        </th>
        <th class="att-scroll-th att-col-perm-th p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-full h-[52px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
            <span>ច្បាប់</span>
          </div>
        </th>
        <th class="att-scroll-th att-col-absent-th p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-full h-[52px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
            <span>ឥតច្បាប់</span>
          </div>
        </th>
        <th class="att-scroll-th att-col-total-th p-0 text-center font-khmer text-[11px] font-bold" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-full h-[52px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
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
        const dayInfo = khmerCal.daysMap[d];
        const isHoliday = Boolean(dayInfo?.isHoliday);
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
        const holidayInfoText = dayInfo
          ? ` — ${dayInfo.lunarMedium}${isHoliday ? ` (${dayInfo.holidayTitleKm})` : ''}`
          : '';

        dayCellsHtml += `
          <td class="score-cell-td att-day-td ${isHoliday ? 'is-holiday-day' : ''} ${statusCellClass}">
            <select
              data-student-id="${row.studentId}"
              data-day="${d}"
              data-row-idx="${rowIdx}"
              data-col-idx="${d}"
              title="ថ្ងៃទី ${d} (${dayName}${holidayInfoText}) (P = ច្បាប់, A = ឥតច្បាប់, ទទេ = វត្តមាន)"
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
    const khmerCal = this.state.khmerCal || getMonthKhmerCalendarMap(yearNum, monthNum, daysInMonth);
    const isKm = i18n.getLocale() === 'km';
    const dayNames = isKm ? DAY_NAMES_KM : DAY_NAMES_EN;
    const defaultDay = this.state.selectedDayCol || 1;

    let optionsHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dayName = dayNames[new Date(yearNum, monthNum - 1, d).getDay()];
      const dayInfo = khmerCal.daysMap[d];
      const lunarExtra = dayInfo
        ? ` — ${dayInfo.lunarMedium}${dayInfo.isHoliday ? ` (${dayInfo.holidayTitleKm})` : ''}`
        : '';
      optionsHtml += `<option value="${d}" ${d === defaultDay ? 'selected' : ''}>ថ្ងៃទី ${d} (${dayName}${lunarExtra})</option>`;
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
      if (this.state.isSaving) {
        this.scheduleAutoSave();
        return;
      }
      await this.saveSheet({ silent: true });
    }, 600);
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
        syncStateManager.triggerAutoSync().catch(() => {});
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
    const khmerCal = this.state.khmerCal || getMonthKhmerCalendarMap(yearNum, monthNum, daysInMonth);
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
      const dayInfo = khmerCal.daysMap[d];
      const isHoliday = Boolean(dayInfo?.isHoliday);
      const isSunday = dayOfWeekIdx === 0;
      const dayColor = (isSunday || isHoliday) ? 'color:#e11d48;' : '';
      const bgStyle = isHoliday ? 'background:#ffe4e6;' : 'background:#f1f5f9;';
      const lunarShort = dayInfo ? `<br><span style="font-size:7.5pt; color:#b45309;">${dayInfo.lunarShort}</span>` : '';
      dayHeaderCells += `<th style="border:1px solid #94a3b8; ${bgStyle} text-align:center; width:36px; ${dayColor}">${d}<br><span style="font-size:8pt; font-weight:normal;">${dayName}</span>${lunarShort}</th>`;
    }

    const bodyRowsHtml = rows.map((r, i) => {
      const isFemale = r.gender === 'Female' || r.gender === 'ស្រី' || r.gender === 'F';
      let dayCells = '';
      for (let d = 1; d <= daysInMonth; d++) {
        const mk = r.days[d]?.mark || '';
        const isHoliday = Boolean(khmerCal.daysMap[d]?.isHoliday);
        const cellBg = isHoliday && !mk ? 'background:#fff1f2;' : '';
        dayCells += `<td style="border:1px solid #cbd5e1; text-align:center; ${cellBg}">${mk}</td>`;
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
              តារាងវត្តមានសិស្សប្រចាំ${monthLabel} ឆ្នាំ ${yearNum} (${khmerCal.lunarYearHeaderKm}) — ថ្នាក់ ${className}
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

  openReportMenuPopover(triggerBtn) {
    const existing = document.getElementById('att-report-menu-popover');
    if (existing) {
      existing.remove();
      return;
    }

    const rect = triggerBtn.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'att-report-menu-popover';
    popover.className = 'fixed z-[9999] w-72 rounded-xl border border-border bg-card shadow-xl p-1.5 animate-fade-in font-khmer select-none';

    const topPos = Math.min(rect.bottom + 6, window.innerHeight - 150);
    const leftPos = Math.max(8, Math.min(rect.right - 288, window.innerWidth - 296));
    popover.style.top = `${topPos}px`;
    popover.style.left = `${leftPos}px`;

    popover.innerHTML = `
      <button type="button" id="btn-opt-report-single" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
        <span class="flex items-center gap-2">
          ${getIcon('calendar', 'w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0')}
          <span>របាយការណ៍វត្តមានប្រចាំខែនីមួយៗ</span>
        </span>
        <span class="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold shrink-0">១ ខែ</span>
      </button>
      <div class="my-1 border-t border-border/60"></div>
      <button type="button" id="btn-opt-report-multi" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
        <span class="flex items-center gap-2">
          ${getIcon('plus', 'w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0')}
          <span>របាយការណ៍បូកសរុប (ខែ + ខែ)</span>
        </span>
        <span class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px] font-bold shrink-0">ខែ + ខែ</span>
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

    popover.querySelector('#btn-opt-report-single')?.addEventListener('click', () => {
      popover.remove();
      document.removeEventListener('mousedown', closePopover);
      this.openAttendanceReportViewer('single');
    });

    popover.querySelector('#btn-opt-report-multi')?.addEventListener('click', () => {
      popover.remove();
      document.removeEventListener('mousedown', closePopover);
      this.openAttendanceReportViewer('multi');
    });
  },

  async openAttendanceReportViewer(initialMode = 'single') {
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();
    const currentUser = authService.getCurrentUser();

    let classes = this.state.classes || [];
    if (classes.length === 0) {
      try {
        classes = await ClassService.getAll();
      } catch (_) {}
    }

    let allSchools = [];
    try {
      allSchools = await SchoolService.getAllSchools();
    } catch (_) {}
    if (!allSchools || allSchools.length === 0) {
      allSchools = [
        { name: 'សាលាបឋមសិក្សា វត្តបូព៌', province: 'សៀមរាប' }
      ];
    }

    const schoolName = currentUser?.school || allSchools[0]?.name || 'សាលាបឋមសិក្សា វត្តបូព៌';
    const availableYears = this.getAvailableYears();
    const defaultMonthId = this.state.selectedMonth || ATTENDANCE_MONTHS[new Date().getMonth()]?.id || 'January';
    const defaultMonthIdx = Math.max(0, ATTENDANCE_MONTHS.findIndex(m => m.id === defaultMonthId));
    const secondMonthId = ATTENDANCE_MONTHS[(defaultMonthIdx + 1) % ATTENDANCE_MONTHS.length]?.id || 'February';

    let reportMode = initialMode === 'multi' ? 'multi' : 'single';
    let selectedClassId = this.state.selectedClassId || (isTeacher ? (teacherClassId || classes[0]?.id) : (classes[0]?.id || ''));
    let selectedYear = String(this.state.selectedYear || new Date().getFullYear());
    let singleMonth = defaultMonthId;
    let multiMonths = [defaultMonthId, secondMonthId];
    let latestReportData = null;

    const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);

    const today = new Date();
    const todayInfo = getKhmerLunarDayInfo(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const khmerSolarMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const solarDateStr = `ថ្ងៃទី${toKhmerNumeral(String(today.getDate()).padStart(2, '0'))} ខែ${khmerSolarMonths[today.getMonth()]} ឆ្នាំ${toKhmerNumeral(today.getFullYear())}`;

    await ReportViewer.open({
      reportKey: 'attendance_monthly_report',
      title: 'របាយការណ៍វត្តមានសិស្ស',
      alwaysFresh: true,
      defaultOrientation: reportMode === 'multi' ? 'landscape' : 'portrait',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 10, bottom: 10, left: 10, right: 10 },
      defaultFontFamily: 'Khmer OS Siemreap',
      defaultFontSize: 9.5,
      renderHeaderControls: (controlsContainer, viewer) => {
        const renderToolbar = () => {
          const classOptionsHtml = isTeacher && teacherClassId
            ? `<option value="${selectedClassId}">${escapeHtml(classes.find(c => String(c.id).trim() === String(selectedClassId).trim())?.name || selectedClassId)}</option>`
            : classes.map(c => `<option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

          const yearOptionsHtml = availableYears.map(y => `
            <option value="${y}" ${String(selectedYear) === String(y) ? 'selected' : ''}>ឆ្នាំ ${y}</option>
          `).join('');

          const singleMonthSelectHtml = `
            <div class="flex items-center gap-1.5 text-xs font-khmer">
              <span class="text-muted-foreground whitespace-nowrap">ខែ:</span>
              <select id="rv-att-single-month" class="h-8 py-0 px-2.5 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs cursor-pointer font-khmer">
                ${ATTENDANCE_MONTHS.map(m => `
                  <option value="${m.id}" ${m.id === singleMonth ? 'selected' : ''}>ខែ${m.nameKm} (${m.nameEn})</option>
                `).join('')}
              </select>
            </div>
          `;

          const multiMonthSlotsHtml = multiMonths.map((mId, slotIdx) => `
            <div class="inline-flex items-center gap-1">
              ${slotIdx > 0 ? `<span class="text-xs font-bold text-violet-600 dark:text-violet-400 px-0.5">+</span>` : ''}
              <div class="inline-flex items-center rounded-md border border-violet-500/40 bg-violet-500/10 overflow-hidden">
                <select data-month-slot="${slotIdx}" class="rv-att-multi-slot h-8 py-0 pl-2 pr-6 bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer font-khmer">
                  ${ATTENDANCE_MONTHS.map(m => `
                    <option value="${m.id}" ${m.id === mId ? 'selected' : ''}>ខែ${m.nameKm}</option>
                  `).join('')}
                </select>
                ${multiMonths.length > 2 ? `
                  <button type="button" data-remove-slot="${slotIdx}" title="ដកខែនេះចេញ" class="px-1.5 h-8 text-rose-600 hover:bg-rose-500/20 text-xs font-bold cursor-pointer">×</button>
                ` : ''}
              </div>
            </div>
          `).join('');

          const multiMonthControlsHtml = `
            <div class="flex items-center gap-1.5 flex-wrap font-khmer">
              <div class="flex items-center gap-1 flex-wrap">
                ${multiMonthSlotsHtml}
              </div>
              <button type="button" id="rv-btn-add-month-slot" title="បន្ថែមខែមួយទៀត (+ ខែ)" class="h-8 px-2.5 rounded-md border border-dashed border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors">
                ${getIcon('plus', 'w-3.5 h-3.5')}
                <span>បន្ថែមខែ</span>
              </button>
              <div class="relative" id="rv-quick-months-wrap">
                <button type="button" id="rv-btn-quick-months" class="h-8 px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1 cursor-pointer">
                  <span>ជ្រើសរើសរហ័ស</span>
                  ${getIcon('chevronDown', 'w-3.5 h-3.5')}
                </button>
                <div id="rv-popover-quick-months" class="hidden absolute left-0 top-9 z-[90] w-72 p-3 rounded-xl border border-border bg-card shadow-xl space-y-2.5 font-khmer">
                  <div class="text-xs font-bold text-foreground border-b border-border/60 pb-1.5">ជ្រើសរើសខែសម្រាប់បូកសរុប (ខែ + ខែ)</div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <button type="button" data-preset="sem1" class="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-[11px] font-semibold cursor-pointer">ឆមាសទី១ (វិច្ឆិកា–កុម្ភៈ)</button>
                    <button type="button" data-preset="sem2" class="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold cursor-pointer">ឆមាសទី២ (មីនា–មិថុនា)</button>
                    <button type="button" data-preset="all" class="px-2 py-1 rounded bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300 text-[11px] font-semibold cursor-pointer">គ្រប់ខែទាំង ១២</button>
                  </div>
                  <div class="grid grid-cols-3 gap-1.5 pt-1">
                    ${ATTENDANCE_MONTHS.map(m => {
                      const checked = multiMonths.includes(m.id);
                      return `
                        <label class="flex items-center gap-1.5 px-2 py-1 rounded border ${checked ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold' : 'border-border bg-background text-foreground'} text-[11px] cursor-pointer">
                          <input type="checkbox" value="${m.id}" class="rv-chk-month accent-violet-600" ${checked ? 'checked' : ''} />
                          <span>ខែ${m.nameKm}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
            </div>
          `;

          controlsContainer.className = 'flex items-center gap-2 sm:gap-2.5 flex-wrap font-khmer';
          controlsContainer.innerHTML = `
            <!-- Report Mode Toggle: Single Month vs Month + Month -->
            <div class="inline-flex items-center p-0.5 rounded-lg border border-border bg-muted/60 text-xs font-khmer">
              <button type="button" id="rv-mode-single" class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${reportMode === 'single' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}">
                ប្រចាំខែនីមួយៗ
              </button>
              <button type="button" id="rv-mode-multi" class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${reportMode === 'multi' ? 'bg-violet-600 text-white shadow-2xs' : 'text-muted-foreground hover:text-foreground'}">
                ខែ + ខែ
              </button>
            </div>

            <!-- Class Selector -->
            <div class="flex items-center gap-1.5 text-xs font-khmer">
              <span class="text-muted-foreground whitespace-nowrap">ថ្នាក់:</span>
              <select id="rv-att-class" class="h-8 py-0 px-2.5 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs cursor-pointer">
                ${classOptionsHtml}
              </select>
            </div>

            <!-- Year Selector -->
            <div class="flex items-center gap-1.5 text-xs font-khmer">
              <span class="text-muted-foreground whitespace-nowrap">ឆ្នាំ:</span>
              <select id="rv-att-year" class="h-8 py-0 px-2.5 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs cursor-pointer font-khmer">
                ${yearOptionsHtml}
              </select>
            </div>

            <!-- Month or Month + Month Selector -->
            ${reportMode === 'single' ? singleMonthSelectHtml : multiMonthControlsHtml}

            <!-- Export Report Excel -->
            <button type="button" id="rv-btn-att-report-excel" class="h-8 px-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer font-khmer">
              ${getIcon('download', 'w-3.5 h-3.5')}
              <span>នាំចេញ Excel</span>
            </button>
          `;

          // Bind Mode Toggle
          controlsContainer.querySelector('#rv-mode-single')?.addEventListener('click', async () => {
            if (reportMode === 'single') return;
            reportMode = 'single';
            renderToolbar();
            if (viewer) await viewer.refreshContent(false);
          });

          controlsContainer.querySelector('#rv-mode-multi')?.addEventListener('click', async () => {
            if (reportMode === 'multi') return;
            reportMode = 'multi';
            if (!Array.isArray(multiMonths) || multiMonths.length < 2) {
              const idx = Math.max(0, ATTENDANCE_MONTHS.findIndex(m => m.id === singleMonth));
              const nextId = ATTENDANCE_MONTHS[(idx + 1) % ATTENDANCE_MONTHS.length]?.id || 'February';
              multiMonths = [singleMonth, nextId];
            }
            renderToolbar();
            if (viewer) await viewer.refreshContent(false);
          });

          // Bind Class
          controlsContainer.querySelector('#rv-att-class')?.addEventListener('change', async (e) => {
            selectedClassId = e.target.value;
            if (viewer) await viewer.refreshContent(false);
          });

          // Bind Year
          controlsContainer.querySelector('#rv-att-year')?.addEventListener('change', async (e) => {
            selectedYear = e.target.value;
            if (viewer) await viewer.refreshContent(false);
          });

          // Bind Single Month
          controlsContainer.querySelector('#rv-att-single-month')?.addEventListener('change', async (e) => {
            singleMonth = e.target.value;
            if (viewer) await viewer.refreshContent(false);
          });

          // Bind Multi Month Slots
          controlsContainer.querySelectorAll('.rv-att-multi-slot').forEach(sel => {
            sel.addEventListener('change', async (e) => {
              const slotIdx = parseInt(sel.getAttribute('data-month-slot'), 10);
              if (!isNaN(slotIdx) && multiMonths[slotIdx] !== undefined) {
                multiMonths[slotIdx] = e.target.value;
                renderToolbar();
                if (viewer) await viewer.refreshContent(false);
              }
            });
          });

          // Bind Remove Month Slot
          controlsContainer.querySelectorAll('[data-remove-slot]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const slotIdx = parseInt(btn.getAttribute('data-remove-slot'), 10);
              if (multiMonths.length > 2 && !isNaN(slotIdx)) {
                multiMonths.splice(slotIdx, 1);
                renderToolbar();
                if (viewer) await viewer.refreshContent(false);
              }
            });
          });

          // Bind Add Month Slot (+ បន្ថែមខែ)
          controlsContainer.querySelector('#rv-btn-add-month-slot')?.addEventListener('click', async () => {
            const unusedMonth = ATTENDANCE_MONTHS.find(m => !multiMonths.includes(m.id))
              || ATTENDANCE_MONTHS[multiMonths.length % ATTENDANCE_MONTHS.length];
            if (unusedMonth) {
              multiMonths.push(unusedMonth.id);
              renderToolbar();
              if (viewer) await viewer.refreshContent(false);
            }
          });

          // Bind Quick Months Popover
          const quickBtn = controlsContainer.querySelector('#rv-btn-quick-months');
          const quickPopover = controlsContainer.querySelector('#rv-popover-quick-months');
          quickBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            quickPopover?.classList.toggle('hidden');
          });

          controlsContainer.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const preset = btn.getAttribute('data-preset');
              if (preset === 'sem1') {
                multiMonths = ['November', 'December', 'January', 'February'];
              } else if (preset === 'sem2') {
                multiMonths = ['March', 'April', 'May', 'June'];
              } else if (preset === 'all') {
                multiMonths = ATTENDANCE_MONTHS.map(m => m.id);
              }
              renderToolbar();
              if (viewer) await viewer.refreshContent(false);
            });
          });

          controlsContainer.querySelectorAll('.rv-chk-month').forEach(chk => {
            chk.addEventListener('change', async () => {
              const checkedIds = Array.from(controlsContainer.querySelectorAll('.rv-chk-month:checked'))
                .map(el => el.value);
              if (checkedIds.length < 2) {
                toast.warning('សូមជ្រើសរើសយ៉ាងតិច ២ ខែ សម្រាប់របាយការណ៍ ខែ + ខែ');
                chk.checked = true;
                return;
              }
              multiMonths = checkedIds;
              renderToolbar();
              const pop = controlsContainer.querySelector('#rv-popover-quick-months');
              pop?.classList.remove('hidden');
              if (viewer) await viewer.refreshContent(false);
            });
          });

          // Bind Excel Export
          controlsContainer.querySelector('#rv-btn-att-report-excel')?.addEventListener('click', () => {
            if (!latestReportData) return;
            const clsObj = classes.find(c => String(c.id).trim() === String(selectedClassId).trim());
            this.exportAttendanceReportExcel(latestReportData, {
              reportMode,
              className: clsObj?.name || '',
              schoolName,
              selectedYear,
              academicYear: this.state.activeYear
            });
          });
        };

        renderToolbar();
      },
      renderContent: async (contentContainer) => {
        contentContainer.innerHTML = `
          <div class="py-12 flex items-center justify-center gap-2 text-muted-foreground text-xs font-khmer">
            <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <span>កំពុងរៀបចំរបាយការណ៍វត្តមាន...</span>
          </div>
        `;

        const monthsToQuery = reportMode === 'single' ? [singleMonth] : multiMonths;
        const reportData = await AttendanceService.getMultiMonthAttendanceReport({
          classId: selectedClassId,
          academicYear: this.state.activeYear,
          year: selectedYear,
          months: monthsToQuery
        });
        latestReportData = reportData;

        const clsObj = classes.find(c => String(c.id).trim() === String(selectedClassId).trim());
        const className = clsObj?.name || '—';
        const { months, rows, summary } = reportData;

        const isSingle = reportMode === 'single' || months.length === 1;
        const monthsTitleKm = months.map(m => `ខែ${m.monthNameKm}`).join(' + ');
        const reportTitleKm = isSingle
          ? `របាយការណ៍វត្តមានសិស្សប្រចាំ${monthsTitleKm} ឆ្នាំ ${selectedYear}`
          : `របាយការណ៍បូកសរុបវត្តមានសិស្សប្រចាំ${monthsTitleKm} ឆ្នាំ ${selectedYear}`;

        // Build Table Header
        const monthGroupHeadersHtml = months.map(m => `
          <th colspan="3" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #e0f2fe !important; color: #0f172a !important; padding: 4px 2px !important; vertical-align: middle !important;">
            ខែ${escapeHtml(m.monthNameKm)}
          </th>
        `).join('');

        const totalGroupHeaderHtml = !isSingle ? `
          <th colspan="3" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #ede9fe !important; color: #4c1d95 !important; padding: 4px 2px !important; vertical-align: middle !important;">
            សរុបរួម (${months.map(m => m.monthNameKm).join(' + ')})
          </th>
        ` : `
          <th rowspan="2" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f1f5f9 !important; color: #0f172a !important; padding: 4px 4px !important; vertical-align: middle !important; width: 14%;">
            ផ្សេងៗ
          </th>
        `;

        const subHeadersPerMonthHtml = months.map(() => `
          <th data-sub-header="true" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f0f9ff !important; color: #0369a1 !important; padding: 3px 2px !important; vertical-align: middle !important;">ច្បាប់</th>
          <th data-sub-header="true" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #fff1f2 !important; color: #be123c !important; padding: 3px 2px !important; vertical-align: middle !important;">ឥតច្បាប់</th>
          <th data-sub-header="true" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f5f3ff !important; color: #6d28d9 !important; padding: 3px 2px !important; vertical-align: middle !important;">សរុប</th>
        `).join('');

        const subHeadersGrandTotalHtml = !isSingle ? `
          <th data-sub-header="true" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #e0f2fe !important; color: #0369a1 !important; padding: 3px 2px !important; vertical-align: middle !important;">ច្បាប់</th>
          <th data-sub-header="true" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #ffe4e6 !important; color: #be123c !important; padding: 3px 2px !important; vertical-align: middle !important;">ឥតច្បាប់</th>
          <th data-sub-header="true" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #ede9fe !important; color: #5b21b6 !important; padding: 3px 2px !important; vertical-align: middle !important;">សរុប</th>
        ` : '';

        const totalColumnsCount = 4 + (months.length * 3) + (isSingle ? 1 : 3);

        const bodyRowsHtml = rows.length === 0 ? `
          <tr>
            <td colspan="${totalColumnsCount}" class="text-center font-khmer py-6 text-muted-foreground" style="border: 1px solid #000000 !important; padding: 10px !important;">
              មិនមានទិន្នន័យសិស្សក្នុងថ្នាក់នេះទេ
            </td>
          </tr>
        ` : rows.map((r, idx) => {
          const isFemale = r.gender === 'Female' || r.gender === 'ស្រី' || r.gender === 'F';
          const genderLabel = isFemale ? 'ស្រី' : 'ប្រុស';

          const perMonthCellsHtml = r.monthly.map(m => `
            <td class="text-center font-mono" style="border: 1px solid #000000 !important; padding: 3px 2px !important; color: #0369a1; font-weight: ${(m.permission ?? 0) > 0 ? '700' : '400'};">${m.permission ?? 0}</td>
            <td class="text-center font-mono" style="border: 1px solid #000000 !important; padding: 3px 2px !important; color: #be123c; font-weight: ${(m.absent ?? 0) > 0 ? '700' : '400'};">${m.absent ?? 0}</td>
            <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; padding: 3px 2px !important; color: #6d28d9;">${m.total ?? 0}</td>
          `).join('');

          const endCellsHtml = !isSingle ? `
            <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #f8fafc !important; padding: 3px 2px !important; color: #0369a1;">${r.totalPermission ?? 0}</td>
            <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #f8fafc !important; padding: 3px 2px !important; color: #be123c;">${r.totalAbsent ?? 0}</td>
            <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #f5f3ff !important; padding: 3px 2px !important; color: #5b21b6;">${r.grandTotal ?? 0}</td>
          ` : `
            <td class="text-center font-khmer" style="border: 1px solid #000000 !important; padding: 3px 4px !important;"></td>
          `;

          return `
            <tr>
              <td class="text-center font-mono" style="border: 1px solid #000000 !important; padding: 3px 2px !important;">${idx + 1}</td>
              <td class="text-center font-mono" style="border: 1px solid #000000 !important; padding: 3px 3px !important;">${escapeHtml(r.studentNumber || '—')}</td>
              <td class="text-left font-khmer font-semibold" style="border: 1px solid #000000 !important; padding: 3px 5px !important; white-space: nowrap;">${escapeHtml(r.khmerFullName)}</td>
              <td class="text-center font-khmer" style="border: 1px solid #000000 !important; padding: 3px 2px !important; font-weight: 600; color: ${isFemale ? '#be123c' : '#0369a1'};">${genderLabel}</td>
              ${perMonthCellsHtml}
              ${endCellsHtml}
            </tr>
          `;
        }).join('');

        // Footer Summary Row (សរុបរួម)
        const footerMonthTotalsHtml = summary.monthTotals.map(mt => `
          <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #f0f9ff !important; padding: 4px 2px !important; color: #0369a1;">${mt.permission ?? 0}</td>
          <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #fff1f2 !important; padding: 4px 2px !important; color: #be123c;">${mt.absent ?? 0}</td>
          <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #f5f3ff !important; padding: 4px 2px !important; color: #6d28d9;">${mt.total ?? 0}</td>
        `).join('');

        const footerGrandTotalHtml = !isSingle ? `
          <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #e0f2fe !important; padding: 4px 2px !important; color: #0369a1;">${summary.grandTotals?.permission ?? 0}</td>
          <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #ffe4e6 !important; padding: 4px 2px !important; color: #be123c;">${summary.grandTotals?.absent ?? 0}</td>
          <td class="text-center font-mono font-bold" style="border: 1px solid #000000 !important; background-color: #ede9fe !important; padding: 4px 2px !important; color: #4c1d95;">${summary.grandTotals?.total ?? 0}</td>
        ` : `
          <td style="border: 1px solid #000000 !important; background-color: #f1f5f9 !important;"></td>
        `;

        const tableFontSize = months.length >= 4 ? '8px' : months.length >= 2 ? '9px' : '10px';

        contentContainer.innerHTML = `
          <div class="moeys-report-document max-w-full mx-auto space-y-2.5" style="font-family: 'Khmer OS Siemreap', 'Kantumruy Pro', sans-serif; font-size: ${tableFontSize}; color: #000000; width: 100%; box-sizing: border-box;">
            <!-- Top Official MoEYS Header -->
            <div class="flex items-start justify-between font-khmer leading-tight" style="font-size: 10.5px;">
              <div class="text-left space-y-0.5 pt-2">
                <p style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive; font-size: 10.5px; line-height: 1.8;">${escapeHtml(schoolName)}</p>
                <p class="font-khmer font-semibold">ថ្នាក់ទី៖ ${escapeHtml(className)}</p>
              </div>
              <div class="text-center space-y-0.5">
                <p style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive; font-size: 10.5px; line-height: 1.8;">ព្រះរាជាណាចក្រកម្ពុជា</p>
                <p style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive; font-size: 10.5px; line-height: 1.8;">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
                <div class="text-center font-serif" style="font-size: 9px;">~ ~ ~ 🙞 🙞 🙞 ~ ~ ~</div>
              </div>
            </div>

            <!-- Title & Summary Meta -->
            <div class="text-center space-y-1 pt-1 pb-1 font-khmer">
              <h2 contenteditable="true" spellcheck="false" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive; font-size: 12.5px; line-height: 1.9; font-weight: normal;">
                ${escapeHtml(reportTitleKm)}
              </h2>
              <div class="flex items-center justify-center flex-wrap gap-x-5 gap-y-1 text-[10px] font-khmer">
                <span>ឆ្នាំសិក្សា៖ <b>${escapeHtml(this.state.activeYear)}</b></span>
                <span>សិស្សសរុប៖ <b>${summary.totalStudents} នាក់</b> (ស្រី <b>${summary.femaleStudents} នាក់</b>)</span>
                <span>ច្បាប់សរុប៖ <b style="color:#0369a1;">${summary.grandTotals.permission} ដង</b></span>
                <span>ឥតច្បាប់សរុប៖ <b style="color:#be123c;">${summary.grandTotals.absent} ដង</b></span>
                <span>អវត្តមានសរុប៖ <b style="color:#5b21b6;">${summary.grandTotals.total} ដង</b></span>
              </div>
            </div>

            <!-- Main Attendance Report Table -->
            <div class="w-full overflow-x-auto">
              <table class="moeys-table border-collapse w-full" style="width: 100% !important; border-collapse: collapse !important; border: 1px solid #000000 !important; font-family: 'Khmer OS Siemreap', 'Kantumruy Pro', sans-serif; font-size: ${tableFontSize};">
                <thead>
                  <tr>
                    <th rowspan="2" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f1f5f9 !important; padding: 4px 2px !important; vertical-align: middle !important; width: 34px;">ល.រ</th>
                    <th rowspan="2" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f1f5f9 !important; padding: 4px 3px !important; vertical-align: middle !important; width: 68px;">អត្តលេខ</th>
                    <th rowspan="2" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f1f5f9 !important; padding: 4px 5px !important; vertical-align: middle !important;">គោត្តនាម និងនាម</th>
                    <th rowspan="2" class="text-center font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f1f5f9 !important; padding: 4px 2px !important; vertical-align: middle !important; width: 42px;">ភេទ</th>
                    ${monthGroupHeadersHtml}
                    ${totalGroupHeaderHtml}
                  </tr>
                  <tr>
                    ${subHeadersPerMonthHtml}
                    ${subHeadersGrandTotalHtml}
                  </tr>
                </thead>
                <tbody>
                  ${bodyRowsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="4" class="text-right font-khmer font-bold" style="border: 1px solid #000000 !important; background-color: #f1f5f9 !important; padding: 4px 6px !important;">
                      សរុបរួម (${summary.totalStudents} នាក់ / ស្រី ${summary.femaleStudents} នាក់)៖
                    </td>
                    ${footerMonthTotalsHtml}
                    ${footerGrandTotalHtml}
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Signatures Footer -->
            <div class="mt-4 pt-2 grid grid-cols-2 gap-8 font-khmer text-[10px] text-center">
              <div class="flex flex-col items-center justify-between min-h-[85px]">
                <div class="space-y-1">
                  <p>បានឃើញ និងឯកភាព</p>
                  <p style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive; line-height: 1.8;">នាយកសាលា</p>
                </div>
                <div class="h-10 w-36 mx-auto"></div>
              </div>
              <div class="flex flex-col items-center justify-between min-h-[85px]">
                <div class="space-y-0.5">
                  <p contenteditable="true" spellcheck="false">${escapeHtml(todayInfo.lunarFull)}</p>
                  <p contenteditable="true" spellcheck="false">${escapeHtml(schoolName)}, ${escapeHtml(solarDateStr)}</p>
                  <p class="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
                </div>
                <div class="h-10 w-36 mx-auto"></div>
              </div>
            </div>
          </div>
        `;
      }
    });
  },

  exportAttendanceReportExcel(reportData, { reportMode, className, schoolName, selectedYear, academicYear }) {
    const { months, rows, summary } = reportData;
    const isSingle = reportMode === 'single' || months.length === 1;
    const monthsTitleKm = months.map(m => `ខែ${m.monthNameKm}`).join(' + ');
    const titleText = isSingle
      ? `របាយការណ៍វត្តមានសិស្សប្រចាំ${monthsTitleKm} ឆ្នាំ ${selectedYear} — ថ្នាក់ ${className}`
      : `របាយការណ៍បូកសរុបវត្តមានសិស្សប្រចាំ${monthsTitleKm} ឆ្នាំ ${selectedYear} — ថ្នាក់ ${className}`;

    const totalCols = 4 + (months.length * 3) + (isSingle ? 1 : 3);

    const monthHeaderCells = months.map(m => `
      <th colspan="3" style="border:1px solid #64748b; background:#e0f2fe; color:#0f172a; text-align:center;">ខែ${m.monthNameKm}</th>
    `).join('');

    const endGroupHeader = !isSingle
      ? `<th colspan="3" style="border:1px solid #64748b; background:#ede9fe; color:#4c1d95; text-align:center;">សរុបរួម (${months.map(m => m.monthNameKm).join(' + ')})</th>`
      : `<th rowspan="2" style="border:1px solid #64748b; background:#f1f5f9; text-align:center;">ផ្សេងៗ</th>`;

    const subHeaderCells = months.map(() => `
      <th style="border:1px solid #64748b; background:#f0f9ff; color:#0369a1; text-align:center;">ច្បាប់</th>
      <th style="border:1px solid #64748b; background:#fff1f2; color:#be123c; text-align:center;">ឥតច្បាប់</th>
      <th style="border:1px solid #64748b; background:#f5f3ff; color:#6d28d9; text-align:center;">សរុប</th>
    `).join('') + (!isSingle ? `
      <th style="border:1px solid #64748b; background:#e0f2fe; color:#0369a1; text-align:center;">ច្បាប់</th>
      <th style="border:1px solid #64748b; background:#ffe4e6; color:#be123c; text-align:center;">ឥតច្បាប់</th>
      <th style="border:1px solid #64748b; background:#ede9fe; color:#4c1d95; text-align:center;">សរុប</th>
    ` : '');

    const bodyRowsHtml = rows.map((r, i) => {
      const isFemale = r.gender === 'Female' || r.gender === 'ស្រី' || r.gender === 'F';
      const monthCells = r.monthly.map(m => `
        <td style="border:1px solid #cbd5e1; text-align:center; color:#0369a1; font-weight:bold;">${m.permission ?? 0}</td>
        <td style="border:1px solid #cbd5e1; text-align:center; color:#be123c; font-weight:bold;">${m.absent ?? 0}</td>
        <td style="border:1px solid #cbd5e1; text-align:center; color:#6d28d9; font-weight:bold;">${m.total ?? 0}</td>
      `).join('');
      const endCells = !isSingle ? `
        <td style="border:1px solid #cbd5e1; background:#f8fafc; text-align:center; color:#0369a1; font-weight:bold;">${r.totalPermission ?? 0}</td>
        <td style="border:1px solid #cbd5e1; background:#f8fafc; text-align:center; color:#be123c; font-weight:bold;">${r.totalAbsent ?? 0}</td>
        <td style="border:1px solid #cbd5e1; background:#f5f3ff; text-align:center; color:#4c1d95; font-weight:bold;">${r.grandTotal ?? 0}</td>
      ` : `<td style="border:1px solid #cbd5e1;"></td>`;

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; text-align:center;">${i + 1}</td>
          <td style="border:1px solid #cbd5e1; text-align:center; mso-number-format:'\\@';">${r.studentNumber || ''}</td>
          <td style="border:1px solid #cbd5e1; text-align:left;">${r.khmerFullName || ''}</td>
          <td style="border:1px solid #cbd5e1; text-align:center;">${isFemale ? 'ស្រី' : 'ប្រុស'}</td>
          ${monthCells}
          ${endCells}
        </tr>
      `;
    }).join('');

    const footerMonthCells = summary.monthTotals.map(mt => `
      <td style="border:1px solid #64748b; background:#f0f9ff; text-align:center; font-weight:bold; color:#0369a1;">${mt.permission ?? 0}</td>
      <td style="border:1px solid #64748b; background:#fff1f2; text-align:center; font-weight:bold; color:#be123c;">${mt.absent ?? 0}</td>
      <td style="border:1px solid #64748b; background:#f5f3ff; text-align:center; font-weight:bold; color:#6d28d9;">${mt.total ?? 0}</td>
    `).join('');

    const footerEndCells = !isSingle ? `
      <td style="border:1px solid #64748b; background:#e0f2fe; text-align:center; font-weight:bold; color:#0369a1;">${summary.grandTotals?.permission ?? 0}</td>
      <td style="border:1px solid #64748b; background:#ffe4e6; text-align:center; font-weight:bold; color:#be123c;">${summary.grandTotals?.absent ?? 0}</td>
      <td style="border:1px solid #64748b; background:#ede9fe; text-align:center; font-weight:bold; color:#4c1d95;">${summary.grandTotals?.total ?? 0}</td>
    ` : `<td style="border:1px solid #64748b; background:#f1f5f9;"></td>`;

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
            <th colspan="${totalCols}" style="font-size:13pt; font-weight:bold; text-align:center; padding:8px;">
              ${titleText}
            </th>
          </tr>
          <tr>
            <th colspan="${totalCols}" style="font-size:10pt; text-align:center; padding:4px;">
              សាលារៀន៖ ${schoolName} | ឆ្នាំសិក្សា៖ ${academicYear} | សិស្សសរុប៖ ${summary.totalStudents} នាក់ (ស្រី ${summary.femaleStudents} នាក់)
            </th>
          </tr>
          <tr>
            <th rowspan="2" style="border:1px solid #64748b; background:#f1f5f9; text-align:center;">ល.រ</th>
            <th rowspan="2" style="border:1px solid #64748b; background:#f1f5f9; text-align:center;">អត្តលេខ</th>
            <th rowspan="2" style="border:1px solid #64748b; background:#f1f5f9; text-align:center;">គោត្តនាម និងនាម</th>
            <th rowspan="2" style="border:1px solid #64748b; background:#f1f5f9; text-align:center;">ភេទ</th>
            ${monthHeaderCells}
            ${endGroupHeader}
          </tr>
          <tr>
            ${subHeaderCells}
          </tr>
          ${bodyRowsHtml}
          <tr>
            <td colspan="4" style="border:1px solid #64748b; background:#f1f5f9; text-align:right; font-weight:bold;">
              សរុបរួម (${summary.totalStudents} នាក់ / ស្រី ${summary.femaleStudents} នាក់)៖
            </td>
            ${footerMonthCells}
            ${footerEndCells}
          </tr>
        </table>
      </body>
      </html>
    `;

    const fileSuffix = isSingle ? months[0].monthId : months.map(m => m.monthId.slice(0, 3)).join('_plus_');
    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Report_${className}_${fileSuffix}_${selectedYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('បានទាញយករបាយការណ៍វត្តមានជា Excel ដោយជោគជ័យ');
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

    // Attendance Report Menu Button (2 options: Single Month / Month + Month)
    const reportBtn = document.getElementById('btn-att-report');
    reportBtn?.addEventListener('click', () => {
      this.openReportMenuPopover(reportBtn);
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
