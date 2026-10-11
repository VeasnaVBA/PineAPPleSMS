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

export const AttendancePage = {
  state: {
    classes: [],
    selectedClassId: '',
    selectedMonth: '',
    activeYear: '2024–2025',
    searchQuery: '',
    sheet: null,
    autoSaveTimer: null,
    isSaving: false
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
  },

  renderLayout() {
    const classes = this.state.classes;
    const months = ATTENDANCE_MONTHS;

    this.container.innerHTML = `
      <div class="space-y-4 animate-fade-in pb-12">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-khmer">${t('attendance.title')}</h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-0.5 font-khmer">${t('attendance.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Typing Legend -->
            <div class="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-khmer">
              <span class="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
                <kbd class="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 font-mono text-[11px]">ច</kbd>
                <span>ឬ</span>
                <kbd class="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 font-mono text-[11px]">P</kbd>
                <span>= ច្បាប់</span>
              </span>
              <span class="text-border">|</span>
              <span class="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-300">
                <kbd class="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 font-mono text-[11px]">អ</kbd>
                <span>ឬ</span>
                <kbd class="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 font-mono text-[11px]">A</kbd>
                <span>= ឥតច្បាប់</span>
              </span>
            </div>

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

        <!-- Filter & Month Controls -->
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
              <span class="text-xs text-muted-foreground font-medium font-khmer whitespace-nowrap">ខែសិក្សា:</span>
              <select id="select-att-month" class="h-9 min-w-[165px] px-3 py-1.5 pr-8 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs font-khmer">
                <option value="" ${!this.state.selectedMonth ? 'selected' : ''}>— ជ្រើសរើសខែ —</option>
                ${months.map(m => `
                  <option value="${m.id}" ${this.state.selectedMonth === m.id ? 'selected' : ''}>ខែ${m.nameKm} (${m.nameEn})</option>
                `).join('')}
              </select>
            </div>

            <!-- Academic Year Badge -->
            <div class="h-9 px-3 rounded-md border border-border bg-muted/40 text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
              ${getIcon('calendar', 'w-3.5 h-3.5 text-primary')}
              <span>ឆ្នាំសិក្សា: <strong class="text-foreground font-mono">${this.state.activeYear}</strong></span>
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
        <div class="score-table-container rounded-xl border border-border bg-card shadow-sm" id="att-table-wrapper">
          <table class="score-table" id="attendance-grid-table">
            <thead id="attendance-table-head"></thead>
            <tbody id="attendance-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    this.bindStaticEvents();
  },

  async loadSheet() {
    const thead = document.getElementById('attendance-table-head');
    const tbody = document.getElementById('attendance-table-body');
    if (!thead || !tbody) return;

    if (!this.state.selectedClassId) {
      this.state.sheet = null;
      thead.innerHTML = '';
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="py-16 text-center text-muted-foreground font-khmer">
            សូមជ្រើសរើសថ្នាក់រៀនជាមុនសិន
          </td>
        </tr>
      `;
      this.updateStats();
      return;
    }

    if (!this.state.selectedMonth) {
      this.state.sheet = null;
      thead.innerHTML = '';
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="py-16 text-center text-muted-foreground">
            <div class="flex flex-col items-center justify-center gap-2">
              <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                ${getIcon('calendar', 'w-5 h-5')}
              </div>
              <p class="text-sm font-semibold text-foreground font-khmer">សូមជ្រើសរើសខែសិក្សាជាមុនសិន</p>
              <p class="text-xs text-muted-foreground font-khmer">ជ្រើសរើសខែនៅខាងលើ ដើម្បីបង្ហាញតារាងវត្តមានប្រចាំខែ</p>
            </div>
          </td>
        </tr>
      `;
      this.updateStats();
      return;
    }

    this.state.sheet = await AttendanceService.getMonthlyAttendanceSheet({
      classId: this.state.selectedClassId,
      academicYear: this.state.activeYear,
      month: this.state.selectedMonth
    });

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
    const thead = document.getElementById('attendance-table-head');
    const tbody = document.getElementById('attendance-table-body');
    if (!thead || !tbody || !this.state.sheet) return;

    const { daysInMonth } = this.state.sheet;
    const rows = this.getFilteredRows();

    // Build Day Header Columns (1..daysInMonth)
    let dayHeadersHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
      dayHeadersHtml += `
        <th class="text-center font-mono text-[11px] font-bold" style="width: 34px; min-width: 34px; max-width: 34px; height: 42px;">
          <div class="flex items-center justify-center h-full w-full">${d}</div>
        </th>
      `;
    }

    thead.innerHTML = `
      <tr style="height: 42px;">
        <th class="att-sticky-col-1 text-center font-khmer text-[11px] font-bold">
          <div class="flex items-center justify-center h-full px-1">ល.រ</div>
        </th>
        <th class="att-sticky-col-2 text-center font-khmer text-[11px] font-bold">
          <div class="flex items-center justify-center h-full px-1.5">អត្តលេខ</div>
        </th>
        <th class="att-sticky-col-3 text-center font-khmer text-[11px] font-bold">
          <div class="flex items-center justify-center h-full px-2">គោត្តនាម និងនាម</div>
        </th>
        <th class="att-sticky-col-4 text-center font-khmer text-[11px] font-bold">
          <div class="flex items-center justify-center h-full px-1">ភេទ</div>
        </th>
        <th class="att-col-perm-th text-center font-khmer text-[11px] font-bold" style="width: 54px; min-width: 54px; max-width: 54px;">
          <div class="flex items-center justify-center h-full px-1">ច្បាប់</div>
        </th>
        <th class="att-col-absent-th text-center font-khmer text-[11px] font-bold" style="width: 62px; min-width: 62px; max-width: 62px;">
          <div class="flex items-center justify-center h-full px-1">ឥតច្បាប់</div>
        </th>
        <th class="att-col-total-th text-center font-khmer text-[11px] font-bold" style="width: 54px; min-width: 54px; max-width: 54px;">
          <div class="flex items-center justify-center h-full px-1">សរុប</div>
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
        ? 'text-pink-600 dark:text-pink-400 font-semibold'
        : 'text-sky-700 dark:text-sky-400 font-medium';

      let dayCellsHtml = '';
      for (let d = 1; d <= daysInMonth; d++) {
        const cellObj = row.days[d] || { status: 'Present', mark: '' };
        const markVal = cellObj.mark || '';
        const statusColorClass = cellObj.status === 'Excused'
          ? 'text-sky-700 dark:text-sky-300 bg-sky-500/10 font-bold'
          : cellObj.status === 'Absent'
            ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 font-bold'
            : 'text-foreground';

        dayCellsHtml += `
          <td class="score-cell-td ${statusColorClass}" style="width: 34px; min-width: 34px; max-width: 34px;">
            <input
              type="text"
              maxlength="3"
              value="${markVal.replace(/"/g, '&quot;')}"
              data-student-id="${row.studentId}"
              data-day="${d}"
              data-row-idx="${rowIdx}"
              data-col-idx="${d + 2}"
              placeholder=""
              title="ថ្ងៃទី ${d} (វាយ ច/P = ច្បាប់, អ/A = ឥតច្បាប់)"
              class="score-cell-input att-day-input font-khmer"
            />
          </td>
        `;
      }

      return `
        <tr data-student-row="${row.studentId}">
          <!-- 1. No (ល.រ) -->
          <td class="att-sticky-col-1 text-center font-mono text-xs text-muted-foreground" style="padding: 0 4px !important; height: 32px;">
            ${rowIdx + 1}
          </td>
          <!-- 2. Student ID (អត្តលេខ) -->
          <td class="att-sticky-col-2 text-center font-mono text-xs font-medium text-foreground" style="padding: 0 6px !important; height: 32px;">
            <div class="truncate">${row.studentNumber || '—'}</div>
          </td>
          <!-- 3. Student Khmer Last Name + First Name (គោត្តនាម និងនាម) -->
          <td class="att-sticky-col-3 text-left font-khmer text-xs font-semibold text-foreground" style="padding: 0 8px !important; height: 32px;">
            <div class="truncate" title="${row.khmerFullName}">${row.khmerFullName}</div>
          </td>
          <!-- 4. Gender (ភេទ) -->
          <td class="att-sticky-col-4 text-center font-khmer text-xs ${genderClass}" style="padding: 0 4px !important; height: 32px;">
            ${genderLabel}
          </td>
          <!-- 5. Permission (ច្បាប់) -->
          <td class="score-cell-td bg-sky-500/5" style="width: 54px; min-width: 54px; max-width: 54px;">
            <input
              type="text"
              inputmode="numeric"
              value="${row.permission || 0}"
              data-student-id="${row.studentId}"
              data-summary-field="permission"
              data-row-idx="${rowIdx}"
              data-col-idx="1"
              class="score-cell-input att-summary-input font-mono font-bold text-sky-700 dark:text-sky-300"
            />
          </td>
          <!-- 6. Absent (ឥតច្បាប់) -->
          <td class="score-cell-td bg-rose-500/5" style="width: 62px; min-width: 62px; max-width: 62px;">
            <input
              type="text"
              inputmode="numeric"
              value="${row.absent || 0}"
              data-student-id="${row.studentId}"
              data-summary-field="absent"
              data-row-idx="${rowIdx}"
              data-col-idx="2"
              class="score-cell-input att-summary-input font-mono font-bold text-rose-600 dark:text-rose-400"
            />
          </td>
          <!-- 7. Total (សរុប) -->
          <td
            class="score-cell-td att-col-total-td bg-violet-500/5 font-mono text-xs font-bold text-violet-700 dark:text-violet-300"
            data-total-cell="${row.studentId}"
            style="width: 54px; min-width: 54px; max-width: 54px;"
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

  bindGridEvents() {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody || !this.state.sheet) return;

    // Select input text on focus for fast overwriting
    tbody.querySelectorAll('input.score-cell-input').forEach(inp => {
      inp.addEventListener('focus', () => {
        inp.select();
      });

      // Arrow key & Enter navigation across cells
      inp.addEventListener('keydown', (e) => {
        const rowIdx = parseInt(inp.getAttribute('data-row-idx'), 10);
        const colIdx = parseInt(inp.getAttribute('data-col-idx'), 10);
        let targetRow = rowIdx;
        let targetCol = colIdx;

        if (e.key === 'ArrowRight') {
          targetCol = colIdx + 1;
        } else if (e.key === 'ArrowLeft') {
          targetCol = colIdx - 1;
        } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
          targetRow = rowIdx + 1;
        } else if (e.key === 'ArrowUp') {
          targetRow = rowIdx - 1;
        } else {
          return;
        }

        const nextInput = tbody.querySelector(
          `input[data-row-idx="${targetRow}"][data-col-idx="${targetCol}"]`
        );
        if (nextInput) {
          e.preventDefault();
          nextInput.focus();
          nextInput.select();
        }
      });
    });

    // Day cell input handler
    tbody.querySelectorAll('input.att-day-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const studentId = inp.getAttribute('data-student-id');
        const day = parseInt(inp.getAttribute('data-day'), 10);
        const row = this.state.sheet.rows.find(r => r.studentId === studentId);
        if (!row) return;

        const { status, mark } = classifyAttendanceMark(inp.value);
        row.days[day] = { status, mark };

        // Update cell visual style
        const td = inp.closest('td');
        if (td) {
          td.classList.remove(
            'text-sky-700', 'dark:text-sky-300', 'bg-sky-500/10',
            'text-rose-600', 'dark:text-rose-400', 'bg-rose-500/10',
            'text-foreground', 'font-bold'
          );
          if (status === 'Excused') {
            td.classList.add('text-sky-700', 'dark:text-sky-300', 'bg-sky-500/10', 'font-bold');
          } else if (status === 'Absent') {
            td.classList.add('text-rose-600', 'dark:text-rose-400', 'bg-rose-500/10', 'font-bold');
          } else {
            td.classList.add('text-foreground');
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

        // Update summary cells in DOM
        const tr = inp.closest('tr');
        if (tr) {
          const permInput = tr.querySelector('input[data-summary-field="permission"]');
          const absInput = tr.querySelector('input[data-summary-field="absent"]');
          const totalTd = tr.querySelector(`[data-total-cell="${studentId}"]`);
          if (permInput) permInput.value = row.permission;
          if (absInput) absInput.value = row.absent;
          if (totalTd) totalTd.textContent = row.total;
        }

        this.updateStats();
        this.scheduleAutoSave();
      });
    });

    // Summary cell (ច្បាប់ / ឥតច្បាប់) direct input handler
    tbody.querySelectorAll('input.att-summary-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const studentId = inp.getAttribute('data-student-id');
        const field = inp.getAttribute('data-summary-field');
        const row = this.state.sheet.rows.find(r => r.studentId === studentId);
        if (!row) return;

        const cleanNum = Math.max(0, parseInt(String(inp.value).replace(/[^\d]/g, ''), 10) || 0);
        row[field] = cleanNum;
        row.total = (parseInt(row.permission, 10) || 0) + (parseInt(row.absent, 10) || 0);

        const tr = inp.closest('tr');
        if (tr) {
          const totalTd = tr.querySelector(`[data-total-cell="${studentId}"]`);
          if (totalTd) totalTd.textContent = row.total;
        }

        this.updateStats();
        this.scheduleAutoSave();
      });
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
        toast.success(`បានរក្សាទុកវត្តមាន ${selectedCls?.name || ''} (${monthObj ? 'ខែ' + monthObj.nameKm : ''}) ដោយជោគជ័យ`);
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
    if (!this.state.sheet || !this.state.selectedMonth) {
      toast.warning('សូមជ្រើសរើសខែសិក្សាជាមុនសិន មុនពេលនាំចេញ Excel');
      return;
    }

    const { daysInMonth, rows, academicYear } = this.state.sheet;
    const selectedCls = this.state.classes.find(c => c.id === this.state.selectedClassId);
    const monthObj = ATTENDANCE_MONTHS.find(m => m.id === this.state.selectedMonth);
    const className = selectedCls?.name || '';
    const monthLabel = monthObj ? `ខែ${monthObj.nameKm}` : this.state.selectedMonth;

    let dayHeaderCells = '';
    for (let d = 1; d <= daysInMonth; d++) {
      dayHeaderCells += `<th style="border:1px solid #94a3b8; background:#f1f5f9; text-align:center; width:28px;">${d}</th>`;
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
              តារាងវត្តមានសិស្សប្រចាំ${monthLabel} — ថ្នាក់ ${className} (ឆ្នាំសិក្សា ${academicYear})
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
    a.download = `Attendance_${className}_${this.state.selectedMonth}_${academicYear}.xls`;
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

    // Search Student
    document.getElementById('input-att-search')?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value || '';
      if (this.state.sheet) {
        this.renderTable();
      }
    });

    // Save Attendance Button
    document.getElementById('btn-save-attendance')?.addEventListener('click', async () => {
      if (!this.state.selectedMonth) {
        toast.warning('សូមជ្រើសរើសខែសិក្សាជាមុនសិន');
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
