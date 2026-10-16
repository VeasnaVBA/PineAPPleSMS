/**
 * Scores & Grading Management Module
 * Comprehensive Master Gradebook with:
 * - Design matching Cambodian MoEYS official master score sheet:
 *   - Category groups (Khmer, Math, Science, Social Studies, PE/Arts/Health, Languages/ICT, Results)
 *   - Vertical column headers with weight/coefficient indicators
 *   - Separate Surname (គោត្តនាម) and Given Name (នាម) columns
 *   - Distinct Gender styling (ស្រី in pink, ប្រុស in blue)
 *   - Rounded pill-like input boxes
 * - Excel-like Multi-Selection & Grid Interaction:
 *   - Mouse click-and-drag range selection
 *   - Shift + Click to extend selection
 *   - Shift + Arrow keys to expand selection
 *   - Delete / Backspace key multi-delete on selected cells
 *   - Floating "Delete Selected" action bar
 *   - Multi-cell Copy & Paste from Excel / Google Sheets
 *   - Enter (down), Tab (right), Arrow keys navigation
 * - Direct Template Download & Excel Upload
 * - Instant Dynamic Calculations & Background Auto-Sync
 */

import { ScoreService, EVALUATION_PERIODS, isStudentActive } from '../services/scoreService.js';
import { ClassService } from '../services/classService.js';
import { SubjectService } from '../services/subjectService.js';
import { SettingsService } from '../services/settingsService.js';
import { SchoolService } from '../services/schoolService.js';
import { authService } from '../services/authService.js';
import { db } from '../database/db.js';
import { Modal } from '../components/modal.js';
import { ReportViewer } from '../components/reportViewer.js';
import { toast } from '../components/toast.js';
import { i18n, t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { syncStateManager } from '../services/syncStateManager.js';
import { formatKhmerLunarDate } from '../utils/khmerLunar.js';
import { formatDisplayDate, toKhmerNumerals, formatKhmerSolarDate } from '../utils/dateUtils.js';

// Category Definitions matching Cambodian Primary / Secondary Score Sheets
// Category Definitions matching Cambodian Primary / Secondary Score Sheets
const CATEGORY_DEFS = {
  khmer: {
    titleKm: 'ភាសាខ្មែរ',
    titleEn: 'Khmer Literature',
    headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    subHeaderClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    cellBgClass: 'bg-white dark:bg-slate-900'
  },
  math: {
    titleKm: 'គណិតវិទ្យា',
    titleEn: 'Mathematics',
    headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    subHeaderClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    cellBgClass: 'bg-white dark:bg-slate-900'
  },
  science: {
    titleKm: 'វិទ្យាសាស្ត្រ',
    titleEn: 'Sciences',
    headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    subHeaderClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    cellBgClass: 'bg-white dark:bg-slate-900'
  },
  social: {
    titleKm: 'សិក្សាសង្គម',
    titleEn: 'Social Studies',
    headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    subHeaderClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    cellBgClass: 'bg-white dark:bg-slate-900'
  },
  health_arts: {
    titleKm: 'អប់រំកាយ/សុខភាព សិល្បៈ',
    titleEn: 'PE, Health & Arts',
    headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    subHeaderClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    cellBgClass: 'bg-white dark:bg-slate-900'
  },
  languages_ict: {
    titleKm: 'ស្វ័យសិក្សា / បរទេស / ICT',
    titleEn: 'Languages & ICT',
    headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    subHeaderClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    cellBgClass: 'bg-white dark:bg-slate-900'
  },
  other: {
    titleKm: 'មុខវិជ្ជាផ្សេងៗ',
    titleEn: 'Other Subjects',
    headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    subHeaderClass: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
    cellBgClass: 'bg-white dark:bg-slate-900'
  }
};

function getSubjectCategoryKey(subject) {
  const text = ((subject.name || '') + ' ' + (subject.nameEn || '') + ' ' + (subject.code || '')).toLowerCase();
  if (text.includes('តែងសេច') || text.includes('សរសេរតាមអាន') || text.includes('ខ្មែរ') || text.includes('អត្ថបទ') || text.includes('វេយ្យាករណ៍') || text.includes('khmer') || text.includes('essay') || text.includes('dictation')) {
    return 'khmer';
  }
  if (text.includes('គណិត') || text.includes('ចំនួន') || text.includes('ធរណី') || text.includes('ពិជគណិត') || text.includes('ស្ថិតិ') || text.includes('រង្វាស់') || text.includes('math') || text.includes('algebra') || text.includes('geometry')) {
    return 'math';
  }
  if (text.includes('វិទ្យាសាស្ត្រ') || text.includes('រូបវិទ្យា') || text.includes('គីមី') || text.includes('ជីវវិទ្យា') || text.includes('ផែនដី') || text.includes('science') || text.includes('physics') || text.includes('chem') || text.includes('bio')) {
    return 'science';
  }
  if (text.includes('សង្គម') || text.includes('ប្រវត្តិ') || text.includes('ភូមិ') || text.includes('សីលធម៌') || text.includes('ពលរដ្ឋ') || text.includes('សេដ្ឋកិច្ច') || text.includes('social') || text.includes('history') || text.includes('geography') || text.includes('civic') || text.includes('econ')) {
    return 'social';
  }
  if (text.includes('កាយ') || text.includes('សុខភាព') || text.includes('សិល្បៈ') || text.includes('គេហវិជ្ជា') || text.includes('កសិកម្ម') || text.includes('បំណិន') || text.includes('pe') || text.includes('art') || text.includes('health') || text.includes('home') || text.includes('agri')) {
    return 'health_arts';
  }
  if (text.includes('បរទេស') || text.includes('អង់គ្លេស') || text.includes('បារាំង') || text.includes('ព័ត៌មានវិទ្យា') || text.includes('កុំព្យូទ័រ') || text.includes('ស្វ័យសិក្សា') || text.includes('english') || text.includes('french') || text.includes('ict') || text.includes('computer')) {
    return 'languages_ict';
  }
  return 'other';
}

export const ScoresPage = {
  state: {
    classes: [],
    subjects: [],
    groupedSubjects: [],
    periods: EVALUATION_PERIODS,
    selectedClassId: '',
    selectedPeriod: '',
    activeYear: '2024–2025',
    coefficients: {},
    rows: [],
    searchQuery: '',
    subjectExtraCol: localStorage.getItem('scores_subject_extra_col') || 'none', // 'none' | 'rank' | 'grade' | 'both'
    semesterMonths: [null, null, null, null, null, null],
    _monthAveragesCache: {},
    _semesterExamAveragesCache: new Map(),
    isAutoSaving: false,
    saveDebounceTimer: null
  },

  // Excel-like Grid Multi-Selection State
  selection: {
    isSelecting: false,
    startRow: null,
    startCol: null,
    endRow: null,
    endCol: null,
    selectedCoords: new Set() // Set of "row,col"
  },

  async render(container) {
    if (this._isRendering) return;
    this._isRendering = true;
    try {
      this.container = container;
      this.state.selectedPeriod = '';
      this.state.rows = [];
      this.state.classes = await ClassService.getAll();
      this.state.activeYear = await SettingsService.getActiveAcademicYear();
      this.state.coefficients = await ScoreService.getMonthlyCoefficients();

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
      await this.loadScores();
    } finally {
      this._isRendering = false;
    }
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';
    const classes = this.state.classes;
    const months = this.state.periods.filter(p => p.group === 'month');
    const exams = this.state.periods.filter(p => p.group === 'exam');

    this.container.innerHTML = `
      <div class="space-y-4 animate-fade-in pb-20 select-none print:p-0 w-full max-w-full overflow-hidden">
        <!-- Top Header: Back/Title + Pill Badges -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
          <div class="flex items-center gap-3 flex-wrap">
            <a href="#dashboard" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted cursor-pointer" title="${isKm ? 'ត្រឡប់ក្រោយ' : 'Go back'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
              <span class="font-bold text-foreground text-sm sm:text-base ${isKm ? 'font-khmer' : ''}">
                ${isKm ? 'ពិន្ទុខែ' : 'Monthly Scores'}
              </span>
            </a>

            <!-- Pill Badges (Total, Female, Male) matching the design -->
            <div class="flex items-center gap-2 flex-wrap">
              <span id="badge-total-students" class="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-khmer">
                ${isKm ? 'សិស្សសរុប' : 'Total'} <span class="font-bold font-mono ml-1" id="stat-count-total">0</span>
              </span>
              <span id="badge-female-students" class="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-khmer">
                ${isKm ? 'ស្រី' : 'Female'} <span class="font-bold font-mono ml-1" id="stat-count-female">0</span>
              </span>
              <span id="badge-male-students" class="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-900 font-khmer">
                ${isKm ? 'ប្រុស' : 'Male'} <span class="font-bold font-mono ml-1" id="stat-count-male">0</span>
              </span>
            </div>
          </div>

          <!-- Top Action Buttons -->
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <button id="btn-honor-roll-top5" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'តារាងកិត្តិយស (សិស្សពូកែទាំង ៥ ប្រចាំខែ)' : 'Top 5 Monthly Honor Roll'}">
              <svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
              </svg>
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'តារាងកិត្តិយស' : 'Honor Roll'}</span>
            </button>
            <button id="btn-result-2row-table" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'តារាងលទ្ធផល ២ ជួរ' : '2 Row Table'}">
              ${getIcon('table', 'w-3.5 h-3.5 text-primary')}
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'តារាងលទ្ធផល' : '2 Row Table'}</span>
            </button>
            <button id="btn-save-scores" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer">
              ${getIcon('check', 'w-3.5 h-3.5')}
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'រក្សាទុក' : 'Save'}</span>
            </button>
          </div>
        </div>

        <!-- Filter & Toolbar (Matching screenshot: Class, Month, Template, Upload, A-F, Data menu, Search) -->
        <div class="p-2.5 sm:p-3 rounded-xl border border-border bg-card shadow-2xs flex flex-wrap items-center justify-between gap-2.5 print:hidden w-full max-w-full">
          <div class="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <!-- Class Selector Pill -->
            <div class="relative">
              ${authService.isTeacher() && classes.length <= 1 ? (() => {
                const assignedCls = classes.find(c => c.id === this.state.selectedClassId) || classes[0];
                return assignedCls ? `
                  <div class="score-toolbar-item score-assigned-class-badge h-9 px-3 rounded-lg border border-primary/30 bg-primary/10 text-xs font-bold text-primary flex items-center gap-1.5">
                    ${getIcon('classes', 'w-3.5 h-3.5')}
                    <span>${assignedCls.name}</span>
                  </div>
                ` : `
                  <a href="#classes" class="score-toolbar-item h-9 px-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-700 flex items-center gap-1.5">
                    <span>${isKm ? '+ បង្កើតថ្នាក់' : '+ Add Class'}</span>
                  </a>
                `;
              })() : `
                <select id="select-score-class" class="score-toolbar-item h-9 px-3 pr-8 rounded-lg border border-input bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer">
                  ${classes.length === 0 ? `<option value="">${isKm ? 'គ្មានថ្នាក់រៀន' : 'No classes'}</option>` : ''}
                  ${classes.map(c => `
                    <option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Month / Period Selector Pill -->
            <div class="relative">
              <select id="select-score-period" class="score-toolbar-item h-9 px-3 pr-8 rounded-lg border border-input bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer">
                <option value="" ${!this.state.selectedPeriod ? 'selected' : ''}>${isKm ? '— ជ្រើសរើសខែ —' : '— Select Month —'}</option>
                <optgroup label="${isKm ? 'ខែសិក្សា' : 'Months'}">
                  ${months.map(m => `
                    <option value="${m.id}" ${this.state.selectedPeriod === m.id ? 'selected' : ''}>
                      ${isKm ? m.nameKm : m.nameEn}
                    </option>
                  `).join('')}
                </optgroup>
                <optgroup label="${isKm ? 'ការប្រឡង និងឆមាស' : 'Exams'}">
                  ${exams.map(e => `
                    <option value="${e.id}" ${this.state.selectedPeriod === e.id ? 'selected' : ''}>
                      ${isKm ? e.nameKm : e.nameEn}
                    </option>
                  `).join('')}
                </optgroup>
              </select>
            </div>

            <!-- Coefficient Settings Button -->
            <button id="btn-coefficient-settings" type="button" class="score-toolbar-item h-9 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'កំណត់មេគុណសម្រាប់ខែនីមួយៗ ដើម្បីគណនាមធ្យមភាគ' : 'Set coefficients to calculate monthly average'}">
              <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'មេគុណ' : 'Coefficient'}</span>
              <span id="current-month-coeff-badge" class="ml-0.5 px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-primary/10 text-primary border border-primary/20" title="${isKm ? 'មេគុណខែនេះ' : 'Current month coefficient'}">${this.state.selectedPeriod ? this.getCurrentPeriodCoefficient() : '—'}</span>
            </button>

            <!-- Export Formatted Excel Button -->
            <button id="btn-export-scores-excel" type="button" class="score-toolbar-item h-9 px-3 rounded-lg border border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'ទាញយកតារាងពិន្ទុជាឯកសារ Excel ដែលមានទម្រង់ស្អាត' : 'Export formatted scores to Excel'}">
              <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'នាំចេញ Excel' : 'Export Excel'}</span>
            </button>

            <!-- Subject Extra Column Display Mode Toggle Button (None -> Rank -> Grade -> Both -> None) -->
            <button id="btn-toggle-subject-extra-col" 
                    type="button" 
                    class="score-toolbar-item h-9 px-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shadow-2xs transition-colors cursor-pointer select-none font-khmer shrink-0 ${(!this.state.selectedPeriod || this.isSemesterPeriod() || this.isAnnualPeriod()) ? 'hidden' : ''}" 
                    title="${this.getSubjectExtraColBtnTitle()}">
              ${this.getSubjectExtraColBtnHtml()}
            </button>

            <!-- A-F Grading Guide Button -->
            <button id="btn-grade-scale-guide" type="button" class="score-toolbar-item h-9 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-bold font-mono shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'កម្រិតនិទ្ទេស A-F' : 'Grading Scale'}">
              A-F
            </button>
          </div>

          <!-- Student Search Input -->
          <div class="relative w-full sm:w-64">
            <input type="text" 
                   id="input-search-student" 
                   placeholder="${isKm ? 'ស្វែងរកសិស្ស...' : 'Search student...'}" 
                   value="${this.state.searchQuery}"
                   class="score-toolbar-item w-full h-9 pl-8 pr-3 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary shadow-2xs" />
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              ${getIcon('search', 'w-3.5 h-3.5')}
            </span>
          </div>
        </div>

        <!-- Master Score Table Container -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden print:border-none print:shadow-none relative w-full max-w-full">
          <!-- Empty state shown before user chooses a month/period -->
          <div id="score-empty-period-state" class="py-20 px-4 text-center ${this.state.selectedPeriod ? 'hidden' : ''}">
            <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 shadow-2xs">
              ${getIcon('calendar', 'w-6 h-6')}
            </div>
            <h3 class="text-sm font-bold text-foreground ${isKm ? 'font-khmer' : ''} mb-1">
              ${isKm ? 'សូមជ្រើសរើសខែ ឬឆមាសជាមុនសិន' : 'Please select a month or period first'}
            </h3>
            <p class="text-xs text-muted-foreground ${isKm ? 'font-khmer' : ''} max-w-md mx-auto">
              ${isKm ? 'សូមជ្រើសរើសខែសិក្សា ឬឆមាសនៅក្នុងប្រអប់ខាងលើ ដើម្បីបង្ហាញតារាងពិន្ទុសិស្ស' : 'Choose a month or semester from the dropdown above to display the score table'}
            </p>
          </div>

          <!-- Advisory Message Banner for Semester Exam 1 and 2 -->
          <div id="score-semester-exam-banner" class="${(!this.state.selectedPeriod || !this.isSemesterExamPeriod()) ? 'hidden' : ''} px-4 py-3 bg-amber-500/10 dark:bg-amber-950/25 border-b border-amber-500/20 flex items-start sm:items-center gap-3 print:hidden">
            <span class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              ${getIcon('alertTriangle', 'w-4 h-4')}
            </span>
            <p class="text-xs font-semibold text-amber-900 dark:text-amber-200 leading-relaxed font-khmer">
              ${isKm 
                ? 'មុនបញ្ចូលពិន្ទុ សូមពិនិត្យមើលសៀវភៅសិក្ខាគារិកសិស្សរបស់ថ្នាក់អ្នក ជាមុនសិន។ ត្រូវប្រាកដថា ពិន្ទុមុខវិជ្ជាដែលអ្នកបញ្ចូល ដូចទៅនឹងមុខវិជ្ជាក្នុងសៀវភៅសិក្ខាគារិក។' 
                : 'Before entering scores, please check your class student record book first. Make sure that the subject scores you enter match the subjects in the student record book.'}
            </p>
          </div>

          <div id="master-score-table-wrapper" class="score-table-container max-h-[72vh] overflow-auto w-full max-w-full ${!this.state.selectedPeriod ? 'hidden' : ''}">
            <table class="score-table no-shadcn text-left text-xs border-separate" id="master-score-table">
              <colgroup id="score-table-colgroup"></colgroup>
              <thead>
                <tr id="score-table-header-row" class="border-b border-border">
                  <!-- Populated dynamically -->
                </tr>
              </thead>
              <tbody id="scores-table-body" class="divide-y divide-border/40">
                <tr>
                  <td colspan="30" class="py-16 text-center text-muted-foreground">
                    <div class="flex items-center justify-center gap-2">
                      <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                      <span>${t('common.loading')}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Floating Multi-Delete Bar (Appears when 2 or more cells are selected) -->
        <div id="score-floating-actions" class="score-floating-action-bar hidden">
          <span class="font-khmer text-xs">
            ${isKm ? 'បានជ្រើស' : 'Selected'}: <strong id="floating-selection-count" class="font-mono text-amber-300">0</strong> ${isKm ? 'ប្រអប់' : 'cells'}
          </span>
          <div class="h-3.5 w-px bg-slate-600"></div>
          <button id="btn-floating-delete" type="button" class="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            <span>${isKm ? 'លុបពិន្ទុដែលបានជ្រើស' : 'Delete Selected'}</span>
          </button>
          <button id="btn-floating-cancel" type="button" class="px-2 py-1 rounded-full text-slate-300 hover:text-white text-xs cursor-pointer">
            ✕
          </button>
        </div>
      </div>
    `;

    this.bindStaticEvents();
  },

  getCurrentPeriodCoefficient() {
    const period = this.state.selectedPeriod || 'October';
    const map = this.state.coefficients || ScoreService.getCachedMonthlyCoefficients();
    const val = Number(map[period]);
    return (val && val > 0) ? val : (period === 'Annual' ? 2 : (period.includes('Semester') ? 20 : 10));
  },

  updateCoefficientBadge() {
    const badge = document.getElementById('current-month-coeff-badge');
    if (badge) {
      badge.textContent = this.state.selectedPeriod ? this.getCurrentPeriodCoefficient() : '—';
    }
  },

  getSubjectExtraColBtnTitle() {
    const isKm = i18n.getLocale() === 'km';
    const mode = this.state.subjectExtraCol || 'none';
    if (mode === 'none') {
      return isKm ? 'កំពុងលាក់ចំណាត់ថ្នាក់ និងនិទ្ទេស។ ចុចដើម្បីបង្ហាញចំណាត់ថ្នាក់មុខវិជ្ជា' : 'Currently hiding rank & grade. Click to show subject rank';
    } else if (mode === 'rank') {
      return isKm ? 'កំពុងបង្ហាញចំណាត់ថ្នាក់មុខវិជ្ជា។ ចុចដើម្បីបង្ហាញនិទ្ទេសមុខវិជ្ជា' : 'Currently showing subject rank. Click to show subject grade';
    } else if (mode === 'grade') {
      return isKm ? 'កំពុងបង្ហាញនិទ្ទេសមុខវិជ្ជា។ ចុចដើម្បីបង្ហាញទាំងពីរ (ច.ថ & និទ្ទេស)' : 'Currently showing subject grade. Click to show both rank and grade';
    } else if (mode === 'both') {
      return isKm ? 'កំពុងបង្ហាញទាំងពីរ។ ចុចដើម្បីលាក់ទាំងពីរ (ត្រឡប់ទៅពិន្ទុសុទ្ធ)' : 'Currently showing both. Click to hide both (scores only)';
    }
    return '';
  },

  getSubjectExtraColBtnHtml() {
    const isKm = i18n.getLocale() === 'km';
    const mode = this.state.subjectExtraCol || 'none';

    let label = isKm ? 'បង្ហាញ : លាក់' : 'Show : None';
    if (mode === 'rank') {
      label = isKm ? 'បង្ហាញ : ចំណាត់ថ្នាក់' : 'Show : Rank';
    } else if (mode === 'grade') {
      label = isKm ? 'បង្ហាញ : និទ្ទេស' : 'Show : Grade';
    } else if (mode === 'both') {
      label = isKm ? 'បង្ហាញ : ទាំងពីរ' : 'Show : Both';
    }

    return `<span class="font-khmer font-bold text-xs whitespace-nowrap leading-none">${label}</span>`;
  },

  updateSubjectExtraColBtn() {
    const btn = document.getElementById('btn-toggle-subject-extra-col');
    if (!btn) return;
    if (!this.state.selectedPeriod || this.isSemesterPeriod() || this.isAnnualPeriod()) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    btn.title = this.getSubjectExtraColBtnTitle();
    btn.innerHTML = this.getSubjectExtraColBtnHtml();
  },

  isSemesterPeriod(period = this.state.selectedPeriod) {
    return ScoreService.isSemesterPeriod(period);
  },

  isAnnualPeriod(period = this.state.selectedPeriod) {
    return ScoreService.isAnnualPeriod(period);
  },

  isSemesterExamPeriod(period = this.state.selectedPeriod) {
    return ScoreService.isSemesterExamPeriod(period);
  },

  getSemesterStorageKey(semester = this.state.selectedPeriod) {
    const clsId = this.state.selectedClassId || 'default';
    const yr = this.state.activeYear || 'default';
    return `semester_months_${clsId}_${semester}_${yr}`;
  },

  loadSemesterMonths() {
    const key = this.getSemesterStorageKey();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 6) {
          this.state.semesterMonths = parsed;
          return;
        }
      }
    } catch (_) {}

    // Sensible defaults
    if (this.state.selectedPeriod === 'Semester 1') {
      this.state.semesterMonths = ['October', 'November', 'December', 'January', 'February', null];
    } else if (this.state.selectedPeriod === 'Semester 2') {
      this.state.semesterMonths = ['March', 'April', 'May', 'June', 'July', null];
    } else {
      this.state.semesterMonths = [null, null, null, null, null, null];
    }
  },

  async saveSemesterMonths() {
    const key = this.getSemesterStorageKey();
    try {
      localStorage.setItem(key, JSON.stringify(this.state.semesterMonths));
      await SettingsService.set(key, this.state.semesterMonths);
    } catch (_) {}
  },

  async prefetchSemesterMonthlyAverages() {
    this.state._monthAveragesCache = {}; // Always clear cache to guarantee fresh live scores from DB!
    const clsId = this.state.selectedClassId;
    const yr = this.state.activeYear;
    if (!clsId) return;

    for (let i = 0; i < 6; i++) {
      const mId = this.state.semesterMonths[i];
      if (mId) {
        const map = await ScoreService.getStudentAveragesForMonth(clsId, yr, mId);
        this.state._monthAveragesCache[mId] = map;
      }
    }
  },

  async prefetchSemesterExamAverages() {
    const clsId = this.state.selectedClassId;
    const yr = this.state.activeYear;
    const period = this.state.selectedPeriod;
    if (!clsId || !this.isSemesterPeriod(period)) return;

    const examPeriod = ScoreService.getCorrespondingExamPeriod(period);
    if (examPeriod) {
      this.state._semesterExamAveragesCache = await ScoreService.getStudentAveragesForExam(clsId, yr, examPeriod);
    } else {
      this.state._semesterExamAveragesCache = new Map();
    }
  },

  populateSemesterMonthScores() {
    if (!this.isSemesterPeriod()) return;
    const cache = this.state._monthAveragesCache || {};
    const examCache = this.state._semesterExamAveragesCache || new Map();

    this.state.rows.forEach(r => {
      if (!r.monthScores) r.monthScores = {};
      for (let mIdx = 0; mIdx < 6; mIdx++) {
        const mId = this.state.semesterMonths[mIdx];
        if (mId) {
          // Always populate from the latest fresh monthly average!
          const avgVal = cache[mId]?.get(r.studentId) ?? (r.studentNumber ? cache[mId]?.get(r.studentNumber) : null);
          r.monthScores[mIdx] = (avgVal !== undefined && avgVal !== null) ? Number(avgVal) : null;
        } else {
          r.monthScores[mIdx] = null;
        }
      }

      // Populate semester exam average from auto-fetched exam averages
      const examVal = examCache.get(r.studentId) ?? (r.studentNumber ? examCache.get(r.studentNumber) : null);
      r.semesterExamAvg = (examVal !== undefined && examVal !== null && !isNaN(Number(examVal))) ? Number(examVal) : null;

      this.recalculateRowData(r);
    });
    ScoreService.rankStudents(this.state.rows);
  },

  getMonthName(monthId) {
    if (!monthId) return '';
    const isKm = i18n.getLocale() === 'km';
    const mObj = (this.state.periods || EVALUATION_PERIODS).find(p => p.id === monthId);
    if (mObj) return isKm ? mObj.nameKm : mObj.nameEn;
    return monthId;
  },

  async loadScores() {
    if (!this.state.selectedClassId) return;

    if (!this.state.coefficients || Object.keys(this.state.coefficients).length === 0) {
      this.state.coefficients = await ScoreService.getMonthlyCoefficients();
    }
    this.updateCoefficientBadge();
    this.updateSubjectExtraColBtn();

    const hasPeriod = Boolean(this.state.selectedPeriod);
    const isSemester = this.isSemesterPeriod();
    const isAnnual = this.isAnnualPeriod();
    const isSemesterExam = this.isSemesterExamPeriod();

    document.getElementById('score-empty-period-state')?.classList.toggle('hidden', hasPeriod);
    document.getElementById('master-score-table-wrapper')?.classList.toggle('hidden', !hasPeriod);
    document.getElementById('score-semester-exam-banner')?.classList.toggle('hidden', !hasPeriod || !isSemesterExam);

    if (!hasPeriod) {
      this.state.rows = [];
      this.updateSummaryStats();
      return;
    }

    if (isSemester) {
      this.loadSemesterMonths();
      await this.prefetchSemesterMonthlyAverages();
      await this.prefetchSemesterExamAverages();
    }

    const data = await ScoreService.getMasterScoreSheet({
      classId: this.state.selectedClassId,
      academicYear: this.state.activeYear,
      period: this.state.selectedPeriod
    });

    this.state.rows = data.rows || [];
    this.state.subjects = data.subjects || [];

    if (isSemester) {
      this.populateSemesterMonthScores();
      this.triggerDebouncedAutoSave();
    } else if (isAnnual) {
      this.triggerDebouncedAutoSave();
    }

    // Ensure subject ranks and grades are computed across all rows (only when subjects are shown)
    if (!isSemester && !isAnnual) {
      ScoreService.rankSubjectStudents(this.state.rows, this.state.subjects);
      ScoreService.calculateSubjectGrades(this.state.rows, this.state.subjects);
    }

    // Group subjects into MoEYS standard categories
    this.organizeGroupedSubjects();

    this.renderHeader();
    this.renderRows();
    this.updateSummaryStats();
  },

  organizeGroupedSubjects() {
    const rawSubjects = this.state.subjects;
    const groupsMap = {};

    Object.keys(CATEGORY_DEFS).forEach(k => {
      groupsMap[k] = {
        key: k,
        ...CATEGORY_DEFS[k],
        subjects: []
      };
    });

    rawSubjects.forEach(sub => {
      const catKey = getSubjectCategoryKey(sub);
      if (groupsMap[catKey]) {
        groupsMap[catKey].subjects.push(sub);
      } else {
        groupsMap.other.subjects.push(sub);
      }
    });

    // Keep only categories that have at least 1 subject in this class
    this.state.groupedSubjects = Object.values(groupsMap).filter(g => g.subjects.length > 0);
  },

  renderHeader() {
    const isKm = i18n.getLocale() === 'km';
    const headerRow = document.getElementById('score-table-header-row');
    const colgroup = document.getElementById('score-table-colgroup');
    if (!headerRow) return;

    const groups = this.state.groupedSubjects;
    const isSemester = this.isSemesterPeriod();
    const isAnnual = this.isAnnualPeriod();
    const currentMonthCoeff = this.getCurrentPeriodCoefficient();
    const mode = this.state.subjectExtraCol || 'none'; // 'none' | 'rank' | 'grade' | 'both'
    const showRank = mode === 'rank' || mode === 'both';
    const showGrade = mode === 'grade' || mode === 'both';

    // Fixed Column Widths via Colgroup
    if (colgroup) {
      colgroup.innerHTML = `
        <col style="width: 42px; min-width: 42px; max-width: 42px;">
        <col style="width: 94px; min-width: 94px; max-width: 94px;">
        <col style="width: 94px; min-width: 94px; max-width: 94px;">
        <col style="width: 64px; min-width: 64px; max-width: 64px;">
        ${isSemester ? `
          <col style="width: 52px; min-width: 52px; max-width: 52px;">
          <col style="width: 52px; min-width: 52px; max-width: 52px;">
          <col style="width: 52px; min-width: 52px; max-width: 52px;">
          <col style="width: 52px; min-width: 52px; max-width: 52px;">
          <col style="width: 52px; min-width: 52px; max-width: 52px;">
          <col style="width: 52px; min-width: 52px; max-width: 52px;">
        ` : (isAnnual ? `
          <col style="width: 90px; min-width: 90px; max-width: 90px;">
          <col style="width: 90px; min-width: 90px; max-width: 90px;">
        ` : this.state.subjects.map(() => `
          <col style="width: 46px; min-width: 46px; max-width: 46px;">
          ${showRank ? '<col style="width: 46px; min-width: 46px; max-width: 46px;">' : ''}
          ${showGrade ? '<col style="width: 46px; min-width: 46px; max-width: 46px;">' : ''}
        `).join(''))}
        ${isSemester ? `
          <col style="width: 82px; min-width: 82px; max-width: 82px;">
          <col style="width: 82px; min-width: 82px; max-width: 82px;">
          <col style="width: 82px; min-width: 82px; max-width: 82px;">
        ` : `
          <col style="width: 64px; min-width: 64px; max-width: 64px;">
          <col style="width: 68px; min-width: 68px; max-width: 68px;">
        `}
        <col style="width: 72px; min-width: 72px; max-width: 72px;">
        <col style="width: 52px; min-width: 52px; max-width: 52px;">
        <col style="width: 40px; min-width: 40px; max-width: 40px;">
      `;
    }

    // Single Clean Header Row
    headerRow.innerHTML = `
      <!-- Sticky Student Info Header Columns (Locked on X and Y with highest z-index) -->
      <th class="score-sticky-col-1 p-0 text-center font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 ${isKm ? 'font-khmer text-xs' : 'font-mono text-xs'}" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
        <div class="w-full h-full min-h-[96px] whitespace-nowrap flex items-center justify-center text-center bg-transparent">${isKm ? 'ល.រ' : 'No.'}</div>
      </th>
      <th class="score-sticky-col-2 p-0 text-left font-bold font-khmer text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
        <div class="w-full h-full min-h-[96px] whitespace-nowrap flex items-center justify-start text-left px-2 text-xs bg-transparent">${isKm ? 'គោត្តនាម' : 'Surname'}</div>
      </th>
      <th class="score-sticky-col-3 p-0 text-left font-bold font-khmer text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
        <div class="w-full h-full min-h-[96px] whitespace-nowrap flex items-center justify-start text-left px-2 text-xs bg-transparent">${isKm ? 'នាម' : 'Name'}</div>
      </th>
      <th class="score-sticky-col-4 p-0 text-center font-bold font-khmer text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800" style="z-index: 50 !important; transform: translateZ(0) !important; vertical-align: middle !important;">
        <div class="w-full h-full min-h-[96px] whitespace-nowrap flex items-center justify-center text-center px-1 text-xs bg-transparent">${isKm ? 'ភេទ' : 'Sex'}</div>
      </th>

      <!-- 6 Month Column Headers (Semester), 2 Semester Avg Headers (Annual), OR Subject Column Headers -->
      ${isSemester ? this.renderSemesterMonthHeadersHtml() : (isAnnual ? this.renderAnnualHeadersHtml() : this.state.subjects.map(sub => {
        const catKey = getSubjectCategoryKey(sub);
        const subHeaderClass = CATEGORY_DEFS[catKey]?.subHeaderClass || 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100';
        const isCalc = SubjectService.isCalculatedSubject(sub);
        const titleTip = `${sub.name} (Max: ${sub.fullScore})${isCalc ? ` [${isKm ? 'បូកសរុបពី' : 'Sum of'}: ${sub.sumOfCourses}]` : ''}`;
        return `
          <th class="score-subject-th p-0 ${isCalc ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800' : subHeaderClass}" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;" title="${titleTip}">
            <div class="w-[46px] max-w-[46px] h-full min-h-[96px] mx-auto flex items-center justify-center py-2 relative bg-transparent">
              ${isCalc ? `<span class="absolute top-1 right-1 text-[9px] font-mono font-extrabold text-rose-700 dark:text-rose-300 bg-rose-200/80 dark:bg-rose-900/80 rounded px-0.5 leading-none shadow-2xs" title="${isKm ? 'បូកសរុបស្វ័យប្រវត្តិ' : 'Auto-calculated'}">∑</span>` : ''}
              <div class="score-vertical-title font-khmer ${isCalc ? 'text-rose-900 dark:text-rose-200 font-bold' : 'text-slate-800 dark:text-slate-100 font-bold'}" title="${sub.name}">
                ${sub.name}
              </div>
            </div>
          </th>
          ${showRank ? `
            <th class="score-subject-th p-0 col-sub-rank-th border-l border-border/40 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;" title="${isKm ? 'ចំណាត់ថ្នាក់ ' + sub.name : 'Rank (' + sub.name + ')'}">
              <div class="w-[46px] max-w-[46px] h-full min-h-[96px] mx-auto flex items-center justify-center py-2 relative bg-transparent">
                <div class="score-vertical-title font-khmer font-bold text-[10px] text-amber-800 dark:text-amber-300" title="${isKm ? 'ចំណាត់ថ្នាក់ ' + sub.name : 'Rank (' + sub.name + ')'}">
                  ${isKm ? 'ចំណាត់ថ្នាក់' : 'Rank'}
                </div>
              </div>
            </th>
          ` : ''}
          ${showGrade ? `
            <th class="score-subject-th p-0 col-sub-grade-th border-l border-border/40 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;" title="${isKm ? 'និទ្ទេស ' + sub.name : 'Grade (' + sub.name + ')'}">
              <div class="w-[46px] max-w-[46px] h-full min-h-[96px] mx-auto flex items-center justify-center py-2 relative bg-transparent">
                <div class="score-vertical-title font-khmer font-bold text-[10px] text-sky-800 dark:text-sky-300" title="${isKm ? 'និទ្ទេស ' + sub.name : 'Grade (' + sub.name + ')'}">
                  ${isKm ? 'និទ្ទេស' : 'Grade'}
                </div>
              </div>
            </th>
          ` : ''}
        `;
      }).join(''))}

      <!-- Result Columns (Centered in the middle) -->
      ${isSemester ? `
        <th class="score-result-th p-0 text-center font-bold font-mono col-semester-month-avg-th text-emerald-700 dark:text-emerald-300 bg-slate-100 dark:bg-slate-800 select-none" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;" title="${isKm ? 'មធ្យមភាគខែប្រចាំឆមាស (ផលបូកពិន្ទុខែ ÷ ចំនួនខែដែលបានជ្រើសរើស)' : 'Semester Monthly Average'}">
          <div class="w-[82px] max-w-[82px] h-full min-h-[96px] mx-auto flex flex-col items-center justify-center text-center px-1 bg-transparent font-khmer text-[11px] font-bold leading-snug">
            <span>${isKm ? 'មធ្យមភាគខែ' : 'Monthly'}</span>
            <span>${isKm ? 'ប្រចាំឆមាស' : 'Average'}</span>
          </div>
        </th>
        <th class="score-result-th p-0 text-center font-bold font-mono col-semester-exam-avg-th text-blue-700 dark:text-blue-300 bg-slate-100 dark:bg-slate-800 select-none" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;" title="${isKm ? 'មធ្យមភាគប្រឡងឆមាស (ទាញយកពីតារាងប្រឡងឆមាស)' : 'Semester Exam Average (Auto-fetched)'}">
          <div class="w-[82px] max-w-[82px] h-full min-h-[96px] mx-auto flex flex-col items-center justify-center text-center px-1 bg-transparent font-khmer text-[11px] font-bold leading-snug">
            <span>${isKm ? 'មធ្យមភាគ' : 'Exam'}</span>
            <span>${isKm ? 'ប្រឡងឆមាស' : 'Average'}</span>
          </div>
        </th>
        <th class="score-result-th p-0 text-center font-bold font-mono col-semester-overall-avg-th text-primary bg-slate-100 dark:bg-slate-800 select-none" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;" title="${isKm ? 'មធ្យមភាគប្រចាំឆមាស = (មធ្យមភាគខែប្រចាំឆមាស + មធ្យមភាគប្រឡងឆមាស) ÷ ២' : 'Semester Average = (Monthly Avg + Exam Avg) / 2'}">
          <div class="w-[82px] max-w-[82px] h-full min-h-[96px] mx-auto flex flex-col items-center justify-center text-center px-1 bg-transparent font-khmer text-[11px] font-bold leading-snug">
            <span>${isKm ? 'មធ្យមភាគ' : 'Semester'}</span>
            <span>${isKm ? 'ប្រចាំឆមាស' : 'Average'}</span>
          </div>
        </th>
      ` : `
        <th class="score-result-th p-0 text-center font-bold font-mono col-total-th text-emerald-700 dark:text-emerald-300 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-[64px] max-w-[64px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
            <span class="font-khmer text-xs font-bold block text-emerald-700 dark:text-emerald-300 text-center">${isKm ? 'ពិន្ទុសរុប' : 'Total'}</span>
          </div>
        </th>
        <th class="score-result-th p-0 text-center font-bold font-mono col-average-th text-primary bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
          <div class="w-[68px] max-w-[68px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
            <span class="font-khmer text-xs font-bold block text-primary text-center">${isKm ? 'មធ្យមភាគ' : 'Avg'}</span>
          </div>
        </th>
      `}
      <th class="score-result-th p-0 text-center font-bold font-mono col-rank-th text-orange-700 dark:text-orange-300 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[72px] max-w-[72px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
          <span class="font-khmer text-xs font-bold block text-orange-700 dark:text-orange-300 text-center">${isKm ? 'ចំណាត់ថ្នាក់' : 'Rank'}</span>
        </div>
      </th>
      <th class="score-result-th p-0 text-center font-bold col-grade-th text-sky-700 dark:text-sky-300 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[52px] max-w-[52px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
          <span class="font-khmer text-xs font-bold block text-sky-700 dark:text-sky-300 text-center">${isKm ? 'និទ្ទេស' : 'Grade'}</span>
        </div>
      </th>

      <!-- Actions Column -->
      <th class="score-result-th text-center p-0 col-actions-th bg-slate-100 dark:bg-slate-800 text-xs font-bold text-violet-700 dark:text-violet-300 font-khmer print:hidden" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[40px] max-w-[40px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-0.5 bg-transparent">
          <span class="font-khmer text-xs font-bold block text-violet-700 dark:text-violet-300 text-center">${isKm ? 'ផ្សេងៗ' : 'Actions'}</span>
        </div>
      </th>
    `;

    // Attach click handlers to month column headers for Semester 1 & 2
    if (isSemester) {
      headerRow.querySelectorAll('.score-semester-month-th').forEach(th => {
        th.addEventListener('click', (e) => {
          e.stopPropagation();
          const colIdx = parseInt(th.getAttribute('data-month-col'), 10);
          this.openMonthSelectorPopover(colIdx, th);
        });
      });
    }
  },

  renderAnnualHeadersHtml() {
    const isKm = i18n.getLocale() === 'km';
    return `
      <th class="score-annual-th p-0 bg-sky-50/90 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200 border-r border-border/40 select-none"
          style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;"
          title="${isKm ? 'មធ្យមភាគប្រចាំឆមាសទី១' : 'Semester 1 Average'}">
        <div class="w-[90px] max-w-[90px] h-full min-h-[96px] mx-auto flex flex-col items-center justify-center text-center px-1 py-1.5 relative bg-transparent font-khmer text-[11px] font-bold leading-snug text-sky-950 dark:text-sky-100">
          <span class="block whitespace-nowrap">${isKm ? 'មធ្យមភាគ' : 'Semester 1'}</span>
          <span class="block whitespace-nowrap">${isKm ? 'ប្រចាំឆមាសទី១' : 'Average'}</span>
        </div>
      </th>
      <th class="score-annual-th p-0 bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border-r border-border/40 select-none"
          style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;"
          title="${isKm ? 'មធ្យមភាគប្រចាំឆមាសទី២' : 'Semester 2 Average'}">
        <div class="w-[90px] max-w-[90px] h-full min-h-[96px] mx-auto flex flex-col items-center justify-center text-center px-1 py-1.5 relative bg-transparent font-khmer text-[11px] font-bold leading-snug text-indigo-950 dark:text-indigo-100">
          <span class="block whitespace-nowrap">${isKm ? 'មធ្យមភាគ' : 'Semester 2'}</span>
          <span class="block whitespace-nowrap">${isKm ? 'ប្រចាំឆមាសទី២' : 'Average'}</span>
        </div>
      </th>
    `;
  },

  renderSemesterMonthHeadersHtml() {
    const isKm = i18n.getLocale() === 'km';
    const months = this.state.semesterMonths || [];
    
    let html = '';
    for (let i = 0; i < 6; i++) {
      const monthId = months[i];
      const monthName = this.getMonthName(monthId);
      const colNumText = isKm ? `ខែ${toKhmerNumerals(i + 1)}` : `M${i + 1}`;
      
      html += `
        <th class="score-semester-month-th p-0 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border-r border-border/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer select-none group"
            data-month-col="${i}"
            style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;"
            title="${monthName ? (isKm ? `ខែ${monthName} (ចុចដើម្បីផ្លាស់ប្តូរ)` : `${monthName} (Click to change)`) : (isKm ? 'ចុចដើម្បីជ្រើសរើសខែ' : 'Click to select month')}">
          <div class="w-[52px] max-w-[52px] h-full min-h-[96px] mx-auto flex flex-col items-center justify-between py-1.5 relative bg-transparent">
            <!-- Top Month Index Pill -->
            <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-200/90 dark:bg-amber-900/90 text-amber-950 dark:text-amber-100 leading-none shadow-2xs">
              ${colNumText}
            </span>

            <!-- Center Vertical Month Name -->
            <div class="score-vertical-title font-khmer text-xs leading-tight ${monthName ? 'text-amber-950 dark:text-amber-100 font-bold' : 'text-amber-700/60 dark:text-amber-400/60 font-medium'}">
              ${monthName || (isKm ? '+ ជ្រើសរើស' : '+ Select')}
            </div>

            <!-- Bottom Indicator Chevron -->
            <div class="text-[9px] text-amber-700 dark:text-amber-400 group-hover:translate-y-0.5 transition-transform flex items-center justify-center">
              ${getIcon('chevronDown', 'w-3 h-3')}
            </div>
          </div>
        </th>
      `;
    }
    return html;
  },

  openMonthSelectorPopover(colIdx, triggerEl) {
    document.getElementById('popover-semester-month-picker')?.remove();

    const isKm = i18n.getLocale() === 'km';
    const currentMonthId = (this.state.semesterMonths || [])[colIdx] || '';
    const otherChosenMonths = (this.state.semesterMonths || []).filter((m, i) => i !== colIdx && !!m);

    // 12 months in academic order
    const academicMonths = [
      { id: 'October', nameKm: 'តុលា', nameEn: 'October' },
      { id: 'November', nameKm: 'វិច្ឆិកា', nameEn: 'November' },
      { id: 'December', nameKm: 'ធ្នូ', nameEn: 'December' },
      { id: 'January', nameKm: 'មករា', nameEn: 'January' },
      { id: 'February', nameKm: 'កុម្ភៈ', nameEn: 'February' },
      { id: 'March', nameKm: 'មីនា', nameEn: 'March' },
      { id: 'April', nameKm: 'មេសា', nameEn: 'April' },
      { id: 'May', nameKm: 'ឧសភា', nameEn: 'May' },
      { id: 'June', nameKm: 'មិថុនា', nameEn: 'June' },
      { id: 'July', nameKm: 'កក្កដា', nameEn: 'July' },
      { id: 'August', nameKm: 'សីហា', nameEn: 'August' },
      { id: 'September', nameKm: 'កញ្ញា', nameEn: 'September' }
    ];

    const rect = triggerEl.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'popover-semester-month-picker';
    popover.className = 'fixed z-[99999] w-64 bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-2.5 font-khmer select-none animate-in fade-in zoom-in-95';

    // Position popover safely within screen
    let top = rect.bottom + 4;
    let left = rect.left;
    const popoverWidth = 256;
    if (left + popoverWidth > window.innerWidth - 10) {
      left = window.innerWidth - popoverWidth - 10;
    }
    if (left < 10) left = 10;
    if (top + 340 > window.innerHeight - 10) {
      top = Math.max(10, rect.top - 340);
    }
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    const colNumStr = isKm ? toKhmerNumerals(colIdx + 1) : (colIdx + 1);

    popover.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-border">
        <div class="flex items-center gap-1.5 font-bold text-xs text-foreground">
          ${getIcon('calendar', 'w-3.5 h-3.5 text-primary')}
          <span>${isKm ? `ជ្រើសរើសខែទី ${colNumStr}` : `Select Month ${colNumStr}`}</span>
        </div>
        <button type="button" class="btn-close-month-popover p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
          ${getIcon('x', 'w-3.5 h-3.5')}
        </button>
      </div>

      <!-- Option to clear (None) -->
      <button type="button" 
              data-month-action="clear" 
              class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-between transition-colors mb-1.5 cursor-pointer">
        <span>${isKm ? '— គ្មាន / សម្អាតជួរឈរនេះ —' : '— None / Clear Column —'}</span>
        ${!currentMonthId ? `<span class="text-xs font-bold text-rose-600 dark:text-rose-400">✓</span>` : ''}
      </button>

      <!-- Month options -->
      <div class="max-h-56 overflow-y-auto space-y-1 pr-0.5">
        ${academicMonths.map(m => {
          const isSelected = m.id === currentMonthId;
          const isChosenElsewhere = otherChosenMonths.includes(m.id);

          if (isChosenElsewhere) {
            return `
              <div class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground/40 bg-muted/20 flex items-center justify-between cursor-not-allowed select-none" title="${isKm ? 'ខែនេះបានជ្រើសរើសរួចហើយក្នុងឆមាសនេះ' : 'Already chosen in this semester'}">
                <span class="font-medium">${isKm ? m.nameKm : m.nameEn}</span>
                <span class="text-[10px] font-mono italic text-muted-foreground/60">${isKm ? 'បានជ្រើសរួច' : 'Chosen'}</span>
              </div>
            `;
          }

          return `
            <button type="button" 
                    data-month-select="${m.id}" 
                    class="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs' 
                        : 'hover:bg-muted text-foreground'
                    }">
              <span>${isKm ? m.nameKm : m.nameEn}</span>
              ${isSelected ? `<span class="text-xs font-bold">✓</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;

    document.body.appendChild(popover);

    // Event listeners
    const closePopover = () => {
      popover.remove();
      window.removeEventListener('click', outsideClickHandler);
      window.removeEventListener('keydown', escapeHandler);
    };

    const outsideClickHandler = (e) => {
      if (!popover.contains(e.target) && !triggerEl.contains(e.target)) {
        closePopover();
      }
    };

    const escapeHandler = (e) => {
      if (e.key === 'Escape') closePopover();
    };

    setTimeout(() => {
      window.addEventListener('click', outsideClickHandler);
      window.addEventListener('keydown', escapeHandler);
    }, 10);

    popover.querySelector('.btn-close-month-popover')?.addEventListener('click', closePopover);

    // Clear column
    popover.querySelector('[data-month-action="clear"]')?.addEventListener('click', async () => {
      closePopover();
      await this.applyMonthSelection(colIdx, null);
    });

    // Select month
    popover.querySelectorAll('[data-month-select]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selectedId = btn.getAttribute('data-month-select');
        closePopover();
        await this.applyMonthSelection(colIdx, selectedId);
      });
    });
  },

  async applyMonthSelection(colIdx, monthId) {
    const isKm = i18n.getLocale() === 'km';
    this.state.semesterMonths = this.state.semesterMonths || [null, null, null, null, null, null];
    this.state.semesterMonths[colIdx] = monthId || null;
    await this.saveSemesterMonths();

    if (monthId) {
      toast.info(isKm ? `កំពុងទាញយកពិន្ទុមធ្យមភាគខែ...` : `Fetching monthly averages...`);
      if (!this.state._monthAveragesCache) this.state._monthAveragesCache = {};
      const avgMap = await ScoreService.getStudentAveragesForMonth(
        this.state.selectedClassId,
        this.state.activeYear,
        monthId
      );
      this.state._monthAveragesCache[monthId] = avgMap;

      // Populate month column for each student
      this.state.rows.forEach(r => {
        if (!r.monthScores) r.monthScores = {};
        const avgVal = avgMap.get(r.studentId);
        r.monthScores[colIdx] = (avgVal !== undefined && avgVal !== null) ? avgVal : null;
        this.recalculateRowData(r);
      });

      const mName = this.getMonthName(monthId);
      toast.success(
        isKm 
          ? `បានជ្រើសរើសខែ ${mName} សម្រាប់ជួរឈរទី ${colIdx + 1} និងទាញយកមធ្យមភាគដោយជោគជ័យ!` 
          : `Selected ${mName} for month column ${colIdx + 1} successfully!`,
        isKm ? 'ជោគជ័យ' : 'Success'
      );
    } else {
      // Cleared column
      this.state.rows.forEach(r => {
        if (!r.monthScores) r.monthScores = {};
        r.monthScores[colIdx] = null;
        this.recalculateRowData(r);
      });
      toast.success(
        isKm ? `បានសម្អាតជួរឈរខែទី ${colIdx + 1} រួចរាល់` : `Cleared month column ${colIdx + 1}`,
        isKm ? 'សម្អាតរួចរាល់' : 'Cleared'
      );
    }

    ScoreService.rankStudents(this.state.rows);
    this.renderHeader();
    this.renderRows();
    this.updateSummaryStats();
    this.triggerDebouncedAutoSave();
  },

  renderRows() {
    const isKm = i18n.getLocale() === 'km';
    const tbody = document.getElementById('scores-table-body');
    if (!tbody) return;

    const isSemester = this.isSemesterPeriod();
    const isAnnual = this.isAnnualPeriod();
    const mode = this.state.subjectExtraCol || 'none'; // 'none' | 'rank' | 'grade' | 'both'
    const showRank = mode === 'rank' || mode === 'both';
    const showGrade = mode === 'grade' || mode === 'both';
    const extraColsPerSub = (showRank ? 1 : 0) + (showGrade ? 1 : 0);

    let rows = this.state.rows;
    const query = (this.state.searchQuery || '').trim().toLowerCase();
    if (query) {
      rows = rows.filter(r => 
        (r.studentNumber && r.studentNumber.toLowerCase().includes(query)) ||
        (r.khmerFullName && r.khmerFullName.toLowerCase().includes(query)) ||
        (r.lastNameKh && r.lastNameKh.toLowerCase().includes(query)) ||
        (r.firstNameKh && r.firstNameKh.toLowerCase().includes(query)) ||
        (r.englishName && r.englishName.toLowerCase().includes(query))
      );
    }

    const flatSubjects = this.state.subjects;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${4 + (isSemester ? 6 : (isAnnual ? 2 : (flatSubjects.length * (1 + extraColsPerSub)))) + (isSemester ? 6 : 5)}" class="py-16 text-center text-muted-foreground">
            <p class="text-xs ${isKm ? 'font-khmer' : ''}">
              ${isKm ? 'មិនមានសិស្សក្នុងថ្នាក់នេះទេ' : 'No students found in this class'}
            </p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map((r, rIdx) => {
      // Split Names into Surname (គោត្តនាម) and Given Name (នាម)
      let surname = (r.lastNameKh || '').trim();
      let givenName = (r.firstNameKh || '').trim();
      if (!surname && !givenName && r.khmerFullName) {
        const parts = r.khmerFullName.trim().split(/\s+/);
        surname = parts[0] || '';
        givenName = parts.slice(1).join(' ') || '';
      }

      // Gender styling: ស្រី in pink, ប្រុស in blue (clean text matching screenshot)
      const isFemale = r.gender === 'Female' || r.gender === 'ស្រី';
      const isMale = r.gender === 'Male' || r.gender === 'ប្រុស';
      const genderText = isFemale ? 'ស្រី' : (isMale ? 'ប្រុស' : (r.gender || '—'));
      const genderColor = isFemale 
        ? 'text-rose-600 dark:text-rose-400 font-bold' 
        : (isMale ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-muted-foreground');

      const sem1Val = r.annualScores ? r.annualScores.sem1 : null;
      const sem2Val = r.annualScores ? r.annualScores.sem2 : null;
      const sem1Display = (sem1Val !== null && sem1Val !== undefined && sem1Val !== '') ? Number(sem1Val).toFixed(2) : '';
      const sem2Display = (sem2Val !== null && sem2Val !== undefined && sem2Val !== '') ? Number(sem2Val).toFixed(2) : '';

      return `
        <tr class="hover:bg-muted/15 transition-colors group" data-student-id="${r.studentId}" data-row-idx="${rIdx}">
          <!-- 1. No (Centered) -->
          <td class="score-sticky-col-1 p-0 text-center font-mono font-medium text-muted-foreground" style="z-index: 30 !important; transform: translateZ(0) !important;">
            <div class="w-full whitespace-nowrap text-center py-1.5 bg-transparent">${rIdx + 1}</div>
          </td>

          <!-- 2. Surname (គោត្តនាម) - Left-aligned -->
          <td class="score-sticky-col-2 p-0 text-left font-khmer font-semibold text-foreground" style="z-index: 30 !important; transform: translateZ(0) !important;" title="${surname}">
            <div class="w-full whitespace-nowrap text-left py-1.5 px-2 text-xs bg-transparent">${surname || '—'}</div>
          </td>

          <!-- 3. Given Name (នាម) - Left-aligned -->
          <td class="score-sticky-col-3 p-0 text-left font-khmer font-semibold text-foreground" style="z-index: 30 !important; transform: translateZ(0) !important;" title="${givenName}">
            <div class="w-full whitespace-nowrap text-left py-1.5 px-2 text-xs bg-transparent">${givenName || '—'}</div>
          </td>

          <!-- 4. Gender (ភេទ) - Centered -->
          <td class="score-sticky-col-4 p-0 text-center font-khmer text-xs ${genderColor}" style="z-index: 30 !important; transform: translateZ(0) !important;">
            <div class="w-full whitespace-nowrap text-center py-1.5 px-1 bg-transparent">${genderText}</div>
          </td>

          <!-- 6 Month Grid Cells (Semester), 2 Semester Avg Cells (Annual), OR Subject Cells -->
          ${isSemester ? Array.from({ length: 6 }).map((_, mIdx) => {
            const mId = (this.state.semesterMonths || [])[mIdx];
            const mName = this.getMonthName(mId);
            const val = r.monthScores ? r.monthScores[mIdx] : null;
            const displayVal = (val !== null && val !== undefined && val !== '') ? Number(val).toFixed(2) : '';
            return `
              <td class="score-cell-td bg-amber-50/40 dark:bg-amber-950/20 p-0 text-center border-r border-b border-border/40 select-none cursor-default" 
                  data-row="${rIdx}" 
                  data-col="${mIdx}" 
                  data-month-col="${mIdx}">
                <div class="w-[52px] max-w-[52px] h-full min-h-[34px] flex items-center justify-center font-mono font-bold text-amber-950 dark:text-amber-200 text-xs select-none py-1.5 px-0.5 truncate"
                     title="${mName ? (isKm ? `ពិន្ទុមធ្យមភាគខែ ${mName} (ទាញយកស្វ័យប្រវត្តិ)` : `Month avg: ${mName} (Auto-fetched)`) : (isKm ? 'សូមជ្រើសរើសខែនៅខាងលើ' : 'Select month in header')}">
                  ${displayVal ? displayVal : (mName ? '<span class="text-amber-900/40 dark:text-amber-300/40 font-normal">—</span>' : '')}
                </div>
              </td>
            `;
          }).join('') : (isAnnual ? `
            <td class="score-cell-td bg-sky-50/40 dark:bg-sky-950/20 p-0 text-center border-r border-b border-border/40 select-none cursor-default" data-row="${rIdx}" data-col="0">
              <div class="w-[90px] max-w-[90px] h-full min-h-[34px] flex items-center justify-center font-mono font-bold text-sky-950 dark:text-sky-200 text-xs select-none py-1.5 px-1 truncate"
                   title="${isKm ? 'ពិន្ទុមធ្យមភាគឆមាសទី១ (ទាញយកស្វ័យប្រវត្តិ)' : 'Semester 1 Average (Auto-calculated)'}">
                ${sem1Display || '<span class="text-sky-900/40 dark:text-sky-300/40 font-normal">—</span>'}
              </div>
            </td>
            <td class="score-cell-td bg-indigo-50/40 dark:bg-indigo-950/20 p-0 text-center border-r border-b border-border/40 select-none cursor-default" data-row="${rIdx}" data-col="1">
              <div class="w-[90px] max-w-[90px] h-full min-h-[34px] flex items-center justify-center font-mono font-bold text-indigo-950 dark:text-indigo-200 text-xs select-none py-1.5 px-1 truncate"
                   title="${isKm ? 'ពិន្ទុមធ្យមភាគឆមាសទី២ (ទាញយកស្វ័យប្រវត្តិ)' : 'Semester 2 Average (Auto-calculated)'}">
                ${sem2Display || '<span class="text-indigo-900/40 dark:text-indigo-300/40 font-normal">—</span>'}
              </div>
            </td>
          ` : flatSubjects.map((s, cIdx) => {
            const currentScore = r.subjectScores[s.id];
            const displayVal = (currentScore !== null && currentScore !== undefined) ? currentScore : '';
            const isCalc = SubjectService.isCalculatedSubject(s);
            const cellBg = isCalc ? 'bg-rose-50/90 dark:bg-rose-950/30' : 'bg-white dark:bg-slate-900';
            const subRank = r.subjectRanks ? r.subjectRanks[s.id] : null;
            const displayRank = (subRank !== null && subRank !== undefined) ? subRank : '—';
            const subGrade = r.subjectGrades ? r.subjectGrades[s.id] : null;
            const displayGrade = (subGrade !== null && subGrade !== undefined) ? subGrade : '—';

            return `
              <td class="score-cell-td ${cellBg} p-0 text-center border-r border-b border-border/40" data-row="${rIdx}" data-col="${cIdx}" data-calculated-cell="${isCalc ? 'true' : 'false'}">
                <div class="w-[46px] max-w-[46px] h-full flex items-center justify-center">
                  <input type="text"
                         inputmode="${isCalc ? 'none' : 'decimal'}"
                         autocomplete="off"
                         ${isCalc ? 'readonly disabled tabindex="-1"' : ''}
                         class="score-cell-input text-center ${isCalc ? 'font-bold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/40 cursor-not-allowed select-none' : ''}"
                         data-row="${rIdx}"
                         data-col="${cIdx}"
                         data-student="${r.studentId}"
                         data-subject="${s.id}"
                         data-max="${s.fullScore}"
                         ${isCalc ? 'data-calculated="true"' : ''}
                         value="${displayVal}"
                         title="${isCalc ? (isKm ? 'ពិន្ទុបូកសរុបដោយស្វ័យប្រវត្តិពី៖ ' + s.sumOfCourses : 'Auto-calculated sum from: ' + s.sumOfCourses) : ''}"
                         placeholder="" />
                </div>
              </td>
              ${showRank ? `
                <td class="score-cell-td p-0 text-center font-bold font-mono text-xs col-sub-rank select-none" data-student="${r.studentId}" data-subject="${s.id}" title="${isKm ? 'ចំណាត់ថ្នាក់ ' + s.name : 'Rank (' + s.name + ')'}">
                  <div class="w-[46px] max-w-[46px] h-full flex items-center justify-center text-center px-0.5 truncate font-bold font-mono text-xs">
                    ${displayRank}
                  </div>
                </td>
              ` : ''}
              ${showGrade ? `
                <td class="score-cell-td p-0 text-center col-sub-grade select-none" data-student="${r.studentId}" data-subject="${s.id}" title="${isKm ? 'និទ្ទេស ' + s.name : 'Grade (' + s.name + ')'}">
                  <div class="w-[46px] max-w-[46px] h-full flex items-center justify-center text-center px-0.5">
                    ${displayGrade !== '—'
                      ? `<span class="col-sub-grade-badge inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${this.getGradeBadgeClasses(displayGrade)}">${displayGrade}</span>`
                      : `<span class="text-sky-700/60 dark:text-sky-300/60 font-bold font-mono text-xs">—</span>`
                    }
                  </div>
                </td>
              ` : ''}
            `;
          }).join(''))}

          ${isSemester ? `
            <!-- មធ្យមភាគខែប្រចាំឆមាស -->
            <td class="p-0 text-center font-bold font-mono text-emerald-700 dark:text-emerald-300 col-semester-month-avg col-total bg-slate-50/60 dark:bg-slate-900/20">
              <div class="w-[82px] max-w-[82px] truncate text-center py-1.5 px-1">${r.semesterMonthAvg !== undefined && r.semesterMonthAvg !== null ? Number(r.semesterMonthAvg).toFixed(2) : (r.total !== undefined ? (Number(r.total) || 0).toFixed(2) : '0.00')}</div>
            </td>

            <!-- មធ្យមភាគប្រឡងឆមាស -->
            <td class="p-0 text-center font-bold font-mono text-blue-700 dark:text-blue-300 col-semester-exam-avg bg-slate-50/60 dark:bg-slate-900/20">
              <div class="w-[82px] max-w-[82px] truncate text-center py-1.5 px-1" title="${isKm ? 'ទាញយកស្វ័យប្រវត្តពីការប្រឡងឆមាស' : 'Auto-fetched from Semester Exam'}">${(r.semesterExamAvg !== undefined && r.semesterExamAvg !== null) ? Number(r.semesterExamAvg).toFixed(2) : '<span class="text-muted-foreground/50 font-normal">—</span>'}</div>
            </td>

            <!-- មធ្យមភាគប្រចាំឆមាស -->
            <td class="p-0 text-center font-bold font-mono text-primary col-semester-overall-avg col-average bg-slate-50/60 dark:bg-slate-900/20">
              <div class="w-[82px] max-w-[82px] truncate text-center py-1.5 px-1">${r.semesterOverallAvg !== undefined && r.semesterOverallAvg !== null ? Number(r.semesterOverallAvg).toFixed(2) : (Number(r.average) || 0).toFixed(2)}</div>
            </td>
          ` : `
            <!-- 6. Total -->
            <td class="p-0 text-center font-bold font-mono text-foreground col-total bg-slate-50/60 dark:bg-slate-900/20">
              <div class="w-[64px] max-w-[64px] truncate text-center py-1.5 px-1">${r.total !== undefined ? (isAnnual ? (Number(r.total) || 0).toFixed(2) : r.total) : (isAnnual ? '0.00' : 0)}</div>
            </td>

            <!-- 7. Average -->
            <td class="p-0 text-center font-bold font-mono text-primary col-average bg-slate-50/60 dark:bg-slate-900/20">
              <div class="w-[68px] max-w-[68px] truncate text-center py-1.5 px-1">${(Number(r.average) || 0).toFixed(2)}</div>
            </td>
          `}

          <!-- 8. Rank -->
          <td class="p-0 text-center font-bold font-mono col-rank">
            <div class="w-[72px] max-w-[72px] h-full flex items-center justify-center py-1 text-xs">
              ${r.rank || 1}
            </div>
          </td>

          <!-- 9. Grade -->
          <td class="p-0 text-center col-grade-cell">
            <div class="w-[52px] max-w-[52px] h-full flex items-center justify-center py-1 text-xs">
              <span class="col-grade inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${this.getGradeBadgeClasses(r.grade)}">
                ${r.grade || 'F'}
              </span>
            </div>
          </td>

          <!-- 10. Actions -->
          <td class="p-0 text-center border-b border-border/40 print:hidden">
            <div class="w-[40px] max-w-[40px] flex items-center justify-center py-1">
              <button type="button" 
                      class="btn-student-transcript p-1 rounded hover:bg-primary/10 text-primary transition-colors cursor-pointer" 
                      title="${isKm ? 'មើលព្រឹត្តិបត្រពិន្ទុ' : 'View Transcript'}"
                      data-student="${r.studentId}" 
                      data-name="${r.khmerFullName || (surname + ' ' + givenName)}">
                ${getIcon('fileText', 'w-3.5 h-3.5')}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.bindGridInteractionEvents();
  },

  /**
   * Bind Excel-like Multi-Selection & Grid Interaction Events
   */
  bindGridInteractionEvents() {
    const tableContainer = this.container.querySelector('.score-table-container');
    const inputs = this.container.querySelectorAll('.score-cell-input');
    if (!tableContainer) return;

    // 1. Mouse Drag Range Selection
    inputs.forEach(inp => {
      inp.addEventListener('mousedown', (e) => {
        const r = parseInt(inp.getAttribute('data-row'), 10);
        const c = parseInt(inp.getAttribute('data-col'), 10);

        if (e.shiftKey && this.selection.startRow !== null) {
          // Extend range from anchor
          this.selection.endRow = r;
          this.selection.endCol = c;
          this.updateSelectionVisuals();
        } else if (e.ctrlKey || e.metaKey) {
          // Add cell to selection
          const coordKey = `${r},${c}`;
          if (this.selection.selectedCoords.has(coordKey)) {
            this.selection.selectedCoords.delete(coordKey);
          } else {
            this.selection.selectedCoords.add(coordKey);
          }
          this.updateSelectionVisuals();
        } else {
          // Start fresh selection
          this.selection.isSelecting = true;
          this.selection.startRow = r;
          this.selection.startCol = c;
          this.selection.endRow = r;
          this.selection.endCol = c;
          this.updateSelectionRange(r, c, r, c);
        }
      });

      inp.addEventListener('mouseenter', () => {
        if (this.selection.isSelecting) {
          const r = parseInt(inp.getAttribute('data-row'), 10);
          const c = parseInt(inp.getAttribute('data-col'), 10);
          this.selection.endRow = r;
          this.selection.endCol = c;
          this.updateSelectionRange(
            this.selection.startRow,
            this.selection.startCol,
            r,
            c
          );
        }
      });

      // Auto-select text on focus for fast typing
      inp.addEventListener('focus', () => {
        inp.select();
        const r = parseInt(inp.getAttribute('data-row'), 10);
        const c = parseInt(inp.getAttribute('data-col'), 10);
        if (!this.selection.isSelecting && this.selection.selectedCoords.size <= 1) {
          this.selection.startRow = r;
          this.selection.startCol = c;
          this.selection.endRow = r;
          this.selection.endCol = c;
          this.updateSelectionRange(r, c, r, c);
        }
        tableContainer.querySelectorAll('tbody tr.is-active-row').forEach(other => {
          other.classList.remove('is-active-row');
        });
        const rowEl = inp.closest('tr');
        if (rowEl) rowEl.classList.add('is-active-row');
      });

      // Live Calculation on Typing
      inp.addEventListener('input', () => {
        this.handleCellInput(inp);
      });

      // Keyboard Navigation (Excel-like Arrows, Enter, Tab)
      inp.addEventListener('keydown', (e) => {
        this.handleCellKeydown(e, inp);
      });

      // Excel Multi-cell Paste Support
      inp.addEventListener('paste', (e) => {
        this.handleCellPaste(e, inp);
      });
    });

    // Row click activation (e.g. clicking student name, gender, or row background)
    tableContainer.querySelectorAll('tbody tr[data-row-idx]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (!e.target.closest('.score-cell-input')) {
          tableContainer.querySelectorAll('tbody tr.is-active-row').forEach(other => {
            if (other !== tr) other.classList.remove('is-active-row');
          });
          tr.classList.add('is-active-row');
        }
      });
    });

    // Global mouseup to finalize drag selection
    const handleGlobalMouseUp = () => {
      if (this.selection.isSelecting) {
        this.selection.isSelecting = false;
      }
    };
    window.removeEventListener('mouseup', this._globalMouseUpHandler);
    this._globalMouseUpHandler = handleGlobalMouseUp;
    window.addEventListener('mouseup', this._globalMouseUpHandler);

    // Dismiss lingering single-cell selection outline when user scrolls table horizontally or vertically
    const handleTableScroll = () => {
      if (this.selection.selectedCoords.size === 1 && !this.selection.isSelecting) {
        this.selection.selectedCoords.clear();
        this.updateSelectionVisuals();
      }
    };
    tableContainer.removeEventListener('scroll', this._tableScrollHandler);
    this._tableScrollHandler = handleTableScroll;
    tableContainer.addEventListener('scroll', this._tableScrollHandler, { passive: true });

    // Transcript modal buttons
    this.container.querySelectorAll('.btn-student-transcript').forEach(btn => {
      btn.addEventListener('click', async () => {
        const studentId = btn.getAttribute('data-student');
        const studentName = btn.getAttribute('data-name');
        const history = await ScoreService.getStudentTranscript(studentId, this.state.activeYear);
        this.openTranscriptModal(studentName, history);
      });
    });
  },

  /**
   * Update internal selection range coordinates
   */
  updateSelectionRange(r1, c1, r2, c2) {
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);

    this.selection.selectedCoords.clear();
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        this.selection.selectedCoords.add(`${r},${c}`);
      }
    }

    this.updateSelectionVisuals();
  },

  /**
   * Update visual highlight classes in DOM
   */
  updateSelectionVisuals() {
    const allCells = this.container.querySelectorAll('.score-cell-td');
    const activeCoord = `${this.selection.endRow},${this.selection.endCol}`;
    const selectedCount = this.selection.selectedCoords.size;

    allCells.forEach(cell => {
      const r = cell.getAttribute('data-row');
      const c = cell.getAttribute('data-col');
      const coord = `${r},${c}`;

      if (this.selection.selectedCoords.has(coord)) {
        cell.classList.add('is-selected');
        if (coord === activeCoord) {
          cell.classList.add('is-active-cell');
        } else {
          cell.classList.remove('is-active-cell');
        }
      } else {
        cell.classList.remove('is-selected', 'is-active-cell');
      }
    });

    // Update active row highlight on student row
    const activeRowIdx = this.selection.selectedCoords.size > 0 ? this.selection.endRow : null;
    this.container.querySelectorAll('tbody tr[data-row-idx]').forEach(tr => {
      const idx = parseInt(tr.getAttribute('data-row-idx'), 10);
      if (activeRowIdx !== null && idx === activeRowIdx) {
        tr.classList.add('is-active-row');
      } else {
        tr.classList.remove('is-active-row');
      }
    });

    // Update Floating Multi-Delete Bar
    const floatingBar = document.getElementById('score-floating-actions');
    const countEl = document.getElementById('floating-selection-count');
    if (floatingBar && countEl) {
      if (selectedCount > 1) {
        countEl.textContent = selectedCount;
        floatingBar.classList.remove('hidden');
      } else {
        floatingBar.classList.add('hidden');
      }
    }
  },

  /**
   * Clear all selected cells (Multi-Delete)
   */
  deleteSelectedCells() {
    const selectedCount = this.selection.selectedCoords.size;
    if (selectedCount === 0) return;

    const affectedStudents = new Set();

    this.selection.selectedCoords.forEach(coord => {
      const [rStr, cStr] = coord.split(',');
      const inp = this.container.querySelector(`.score-cell-input[data-row="${rStr}"][data-col="${cStr}"]`);
      if (inp) {
        if (inp.getAttribute('data-calculated') === 'true') return; // Skip calculated cells
        inp.value = '';
        inp.classList.remove('border-destructive', 'text-destructive', 'bg-destructive/10');
        const monthColStr = inp.getAttribute('data-month-col');
        const studentId = inp.getAttribute('data-student');
        const subjectId = inp.getAttribute('data-subject');
        const rowData = this.state.rows.find(row => row.studentId === studentId);
        if (rowData) {
          if (monthColStr !== null) {
            const mIdx = parseInt(monthColStr, 10);
            if (rowData.monthScores) rowData.monthScores[mIdx] = null;
          } else if (subjectId) {
            rowData.subjectScores[subjectId] = null;
          }
          affectedStudents.add(rowData);
        }
      }
    });

    // Recalculate each affected student row
    affectedStudents.forEach(rowData => {
      this.recalculateRowData(rowData);
    });

    // Recalculate ranks across all rows
    ScoreService.rankStudents(this.state.rows);
    this.updateRanksInDOM();
    this.updateSummaryStats();

    // Trigger debounced auto-save & sync
    this.triggerDebouncedAutoSave();

    // Show brief feedback toast
    const isKm = i18n.getLocale() === 'km';
    toast.success(
      isKm ? `បានលុបពិន្ទុ ${selectedCount} ប្រអប់ដោយជោគជ័យ!` : `Cleared ${selectedCount} score cells!`,
      isKm ? 'លុបរួចរាល់' : 'Cleared'
    );

    // Keep active single cell selected
    this.selection.selectedCoords.clear();
    if (this.selection.endRow !== null && this.selection.endCol !== null) {
      this.selection.selectedCoords.add(`${this.selection.endRow},${this.selection.endCol}`);
    }
    this.updateSelectionVisuals();
  },

  /**
   * Handle single cell input change
   */
  handleCellInput(inp) {
    if (inp.getAttribute('data-calculated') === 'true') {
      return;
    }

    const studentId = inp.getAttribute('data-student');
    const monthColStr = inp.getAttribute('data-month-col');
    const subjectId = inp.getAttribute('data-subject');
    const maxScore = Number(inp.getAttribute('data-max')) || 100;

    let enteredVal = inp.value.trim();
    let numVal = enteredVal === '' ? null : Math.max(0, Number(enteredVal));
    if (enteredVal !== '' && isNaN(numVal)) {
      numVal = null;
    }

    if (numVal !== null && numVal > maxScore) {
      inp.classList.add('border-destructive', 'text-destructive', 'bg-destructive/10');
    } else {
      inp.classList.remove('border-destructive', 'text-destructive', 'bg-destructive/10');
    }

    const rowData = this.state.rows.find(r => r.studentId === studentId);
    if (rowData) {
      if (monthColStr !== null) {
        const mIdx = parseInt(monthColStr, 10);
        if (!rowData.monthScores) rowData.monthScores = {};
        rowData.monthScores[mIdx] = numVal;
      } else if (subjectId) {
        rowData.subjectScores[subjectId] = numVal;
      }
      this.recalculateRowData(rowData);
      ScoreService.rankStudents(this.state.rows);
      this.updateRanksInDOM();
      this.updateSummaryStats();
      this.triggerDebouncedAutoSave();
    }
  },

  /**
   * Recalculate total, average, grade for a student row and update DOM
   */
  recalculateRowData(rowData) {
    // 1. Recalculate any composite / sum subjects live
    this.state.subjects.forEach(s => {
      if (SubjectService.isCalculatedSubject(s)) {
        const compVal = SubjectService.calculateCompositeScore(s, this.state.subjects, rowData.subjectScores);
        rowData.subjectScores[s.id] = compVal;

        // Update disabled cell input in DOM immediately
        const compInp = this.container.querySelector(`input[data-student="${rowData.studentId}"][data-subject="${s.id}"]`);
        if (compInp) {
          compInp.value = compVal !== null && compVal !== undefined ? compVal : '';
        }
      }
    });

    // 2. Identify sub-component subjects to prevent double counting in grand total
    const subComponentIds = new Set();
    this.state.subjects.forEach(s => {
      if (SubjectService.isCalculatedSubject(s)) {
        const subCodes = SubjectService.getSumSubCourseCodes(s);
        this.state.subjects.forEach(other => {
          if (other.id !== s.id && (
            subCodes.includes(String(other.code || '').toUpperCase()) ||
            subCodes.includes(String(other.id || '').toUpperCase())
          )) {
            subComponentIds.add(other.id);
          }
        });
      }
    });

    // 3. Compute grand total and totalMax
    let sum = 0;
    let maxTotal = 0;
    let avgScore = 0;

    if (this.isSemesterPeriod()) {
      let monthlySum = 0;
      let countWithScore = 0;
      const chosenMonths = (this.state.semesterMonths || []).filter(Boolean);
      const chosenCount = chosenMonths.length;

      for (let mIdx = 0; mIdx < 6; mIdx++) {
        const mId = (this.state.semesterMonths || [])[mIdx];
        if (mId && rowData.monthScores) {
          const mv = rowData.monthScores[mIdx];
          if (mv !== null && mv !== undefined && mv !== '') {
            monthlySum += Number(mv);
            countWithScore++;
          }
        }
      }

      // Column 1: មធ្យមភាគខែប្រចាំឆមាស
      // Calculated from the monthly scores divided by number of chosen months in this table
      const divisor = chosenCount > 0 ? chosenCount : (countWithScore > 0 ? countWithScore : 1);
      const monthAvg = Math.round((monthlySum / divisor) * 100) / 100;
      rowData.semesterMonthAvg = monthAvg;
      rowData.total = monthAvg;
      rowData.totalMax = 50;

      // Column 2: មធ្យមភាគប្រឡងឆមាស (auto-fetched from Semester 1/2 Exam average)
      let examAvg = null;
      if (rowData.semesterExamAvg !== undefined && rowData.semesterExamAvg !== null && rowData.semesterExamAvg !== '') {
        examAvg = Number(rowData.semesterExamAvg);
      } else {
        const examCache = this.state._semesterExamAveragesCache;
        if (examCache && examCache.has(rowData.studentId)) {
          const cv = examCache.get(rowData.studentId);
          if (cv !== undefined && cv !== null && !isNaN(Number(cv))) {
            examAvg = Number(cv);
            rowData.semesterExamAvg = examAvg;
          }
        } else if (examCache && rowData.studentNumber && examCache.has(rowData.studentNumber)) {
          const cv = examCache.get(rowData.studentNumber);
          if (cv !== undefined && cv !== null && !isNaN(Number(cv))) {
            examAvg = Number(cv);
            rowData.semesterExamAvg = examAvg;
          }
        }
      }

      // Column 3: មធ្យមភាគប្រចាំឆមាស = (មធ្យមភាគខែប្រចាំឆមាស + មធ្យមភាគប្រឡងឆមាស) / 2
      let overallAvg = 0;
      if (examAvg !== null && !isNaN(examAvg)) {
        overallAvg = Math.round(((monthAvg + examAvg) / 2) * 100) / 100;
      } else {
        overallAvg = monthAvg;
      }
      rowData.semesterOverallAvg = overallAvg;
      rowData.total = overallAvg;
      sum = overallAvg;
      avgScore = overallAvg;
    } else if (this.isAnnualPeriod()) {
      const s1 = rowData.annualScores?.sem1;
      const s2 = rowData.annualScores?.sem2;
      let annSum = 0;
      if (s1 !== null && s1 !== undefined && s1 !== '') annSum += Number(s1);
      if (s2 !== null && s2 !== undefined && s2 !== '') annSum += Number(s2);
      sum = annSum;
      rowData.total = Math.round(sum * 100) / 100;
      rowData.totalMax = 100;
    } else {
      let examSum = 0;
      this.state.subjects.forEach(s => {
        if (subComponentIds.has(s.id)) return; // Don't double count sub-components

        const v = rowData.subjectScores[s.id];
        if (v !== null && v !== undefined && v !== '') {
          examSum += Number(v);
        }
        maxTotal += s.fullScore;
      });
      sum = examSum;
      rowData.total = Math.round(sum * 10) / 10;
      rowData.totalMax = maxTotal;
    }

    if (!this.isSemesterPeriod()) {
      if (this.isAnnualPeriod()) {
        const s1 = rowData.annualScores?.sem1;
        const s2 = rowData.annualScores?.sem2;
        const count = ((s1 !== null && s1 !== undefined && s1 !== '') ? 1 : 0) +
                      ((s2 !== null && s2 !== undefined && s2 !== '') ? 1 : 0);
        if (count === 2) {
          const coeff = this.getCurrentPeriodCoefficient() || 2;
          avgScore = sum / coeff;
        } else if (count === 1) {
          avgScore = (s1 !== null && s1 !== undefined && s1 !== '') ? Number(s1) : Number(s2);
        } else {
          avgScore = 0;
        }
      } else {
        const coeff = this.getCurrentPeriodCoefficient();
        avgScore = coeff > 0 ? (sum / coeff) : sum;
      }
    }
    rowData.average = Math.round(avgScore * 100) / 100;

    // Use overall semester average in semester periods (or general average) to calculate the grade, where full average is 50.00 (< 25 is F)
    const targetScoreForGrade = this.isSemesterPeriod() ? rowData.semesterOverallAvg : rowData.average;
    const gradeInfo = SubjectService.calculateGrade(targetScoreForGrade, 50);
    rowData.grade = gradeInfo.grade;
    rowData.gradeColor = gradeInfo.color;

    // Update individual subject grades for this row (only when subjects are shown)
    if (!rowData.subjectGrades) rowData.subjectGrades = {};
    if (!this.isSemesterPeriod() && !this.isAnnualPeriod()) {
      this.state.subjects.forEach(s => {
        const v = rowData.subjectScores[s.id];
        if (v !== null && v !== undefined && v !== '') {
          const max = Number(s.fullScore) > 0 
            ? Number(s.fullScore) 
            : (Number(s.maxScore) > 0 ? Number(s.maxScore) : 100);
          rowData.subjectGrades[s.id] = SubjectService.calculateGrade(Number(v), max).grade;
        } else {
          rowData.subjectGrades[s.id] = null;
        }
      });
    }

    const trEl = this.container.querySelector(`tr[data-student-id="${rowData.studentId}"]`);
    if (trEl) {
      if (this.isSemesterPeriod()) {
        const mAvgEl = trEl.querySelector('.col-semester-month-avg div') || trEl.querySelector('.col-semester-month-avg');
        if (mAvgEl) mAvgEl.textContent = (Number(rowData.semesterMonthAvg) || 0).toFixed(2);

        const eAvgEl = trEl.querySelector('.col-semester-exam-avg div') || trEl.querySelector('.col-semester-exam-avg');
        if (eAvgEl) {
          if (rowData.semesterExamAvg !== null && rowData.semesterExamAvg !== undefined) {
            eAvgEl.textContent = Number(rowData.semesterExamAvg).toFixed(2);
          } else {
            eAvgEl.innerHTML = '<span class="text-muted-foreground/50 font-normal">—</span>';
          }
        }

        const oAvgEl = trEl.querySelector('.col-semester-overall-avg div') || trEl.querySelector('.col-semester-overall-avg');
        if (oAvgEl) oAvgEl.textContent = (Number(rowData.semesterOverallAvg) || 0).toFixed(2);
      } else {
        const totEl = trEl.querySelector('.col-total div') || trEl.querySelector('.col-total');
        if (totEl) {
          totEl.textContent = (this.isAnnualPeriod()) ? (Number(rowData.total) || 0).toFixed(2) : rowData.total;
        }
        const avgEl = trEl.querySelector('.col-average div') || trEl.querySelector('.col-average');
        if (avgEl) avgEl.textContent = (Number(rowData.average) || 0).toFixed(2);
      }
      const gradeEl = trEl.querySelector('.col-grade');
      if (gradeEl) {
        gradeEl.textContent = rowData.grade;
        gradeEl.className = `col-grade inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${this.getGradeBadgeClasses(rowData.grade)}`;
      }
    }
  },

  /**
   * Handle keyboard navigation (Excel shortcuts, Delete key, Tab, Enter)
   */
  handleCellKeydown(e, inp) {
    const curR = parseInt(inp.getAttribute('data-row'), 10);
    const curC = parseInt(inp.getAttribute('data-col'), 10);
    const totalRows = this.state.rows.length;
    const totalCols = this.isSemesterPeriod() ? 6 : (this.isAnnualPeriod() ? 2 : this.state.subjects.length);

    // 1. Delete / Backspace key multi-delete
    if (e.key === 'Delete' || (e.key === 'Backspace' && (this.selection.selectedCoords.size > 1 || (inp.selectionStart === 0 && inp.selectionEnd === inp.value.length)))) {
      if (this.selection.selectedCoords.size > 1) {
        e.preventDefault();
        this.deleteSelectedCells();
        return;
      }
      if (e.key === 'Delete') {
        if (inp.getAttribute('data-calculated') === 'true') {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        if (inp.value !== '') {
          inp.value = '';
          this.handleCellInput(inp);
        }
        return;
      }
    }

    // 2. Select All (Ctrl+A / Cmd+A)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      this.selection.selectedCoords.clear();
      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
          this.selection.selectedCoords.add(`${r},${c}`);
        }
      }
      this.updateSelectionVisuals();
      return;
    }

    // 3. Arrow Keys with Shift (Expand Selection like Excel)
    if (e.shiftKey && (e.key.startsWith('Arrow') || e.key === 'Tab' || e.key === 'Enter')) {
      e.preventDefault();
      let nextR = this.selection.endRow !== null ? this.selection.endRow : curR;
      let nextC = this.selection.endCol !== null ? this.selection.endCol : curC;

      if (e.key === 'ArrowDown') nextR = Math.min(totalRows - 1, nextR + 1);
      else if (e.key === 'ArrowUp') nextR = Math.max(0, nextR - 1);
      else if (e.key === 'ArrowRight') nextC = Math.min(totalCols - 1, nextC + 1);
      else if (e.key === 'ArrowLeft') nextC = Math.max(0, nextC - 1);

      this.selection.endRow = nextR;
      this.selection.endCol = nextC;
      this.updateSelectionRange(
        this.selection.startRow,
        this.selection.startCol,
        nextR,
        nextC
      );
      return;
    }

    // 4. Standard Navigation: Enter (Down), Tab (Right), Arrow Keys
    let targetR = curR;
    let targetC = curC;
    let shouldNavigate = false;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      targetR = Math.min(totalRows - 1, curR + 1);
      shouldNavigate = true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetR = Math.max(0, curR - 1);
      shouldNavigate = true;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Tab: Move left
        if (curC > 0) {
          targetC = curC - 1;
        } else if (curR > 0) {
          targetR = curR - 1;
          targetC = totalCols - 1;
        }
      } else {
        // Tab: Move right
        if (curC + 1 < totalCols) {
          targetC = curC + 1;
        } else if (curR + 1 < totalRows) {
          targetR = curR + 1;
          targetC = 0;
        }
      }
      shouldNavigate = true;
    } else if (e.key === 'ArrowRight' && inp.selectionEnd === inp.value.length) {
      if (curC + 1 < totalCols) {
        targetC = curC + 1;
        shouldNavigate = true;
      }
    } else if (e.key === 'ArrowLeft' && inp.selectionStart === 0) {
      if (curC > 0) {
        targetC = curC - 1;
        shouldNavigate = true;
      }
    }

    if (shouldNavigate && (targetR !== curR || targetC !== curC)) {
      const nextInp = this.container.querySelector(`.score-cell-input[data-row="${targetR}"][data-col="${targetC}"]`);
      if (nextInp) {
        nextInp.focus();
        nextInp.select();
      }
    }
  },

  /**
   * Handle pasting table values directly from Excel or Google Sheets
   */
  handleCellPaste(e, inp) {
    const text = (e.clipboardData || window.clipboardData)?.getData('text');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;

    e.preventDefault();
    const curR = parseInt(inp.getAttribute('data-row'), 10);
    const curC = parseInt(inp.getAttribute('data-col'), 10);

    const lines = text.trim().split(/\r?\n/).map(line => line.split('\t'));
    let pastedCount = 0;
    const affectedStudents = new Set();

    lines.forEach((line, rOffset) => {
      line.forEach((cellVal, cOffset) => {
        const targetR = curR + rOffset;
        const targetC = curC + cOffset;
        const targetInp = this.container.querySelector(`.score-cell-input[data-row="${targetR}"][data-col="${targetC}"]`);
        if (targetInp) {
          if (targetInp.getAttribute('data-calculated') === 'true') return; // Skip calculated cells
          const cleanVal = cellVal.trim();
          const numVal = cleanVal === '' ? null : Math.max(0, Number(cleanVal));
          targetInp.value = cleanVal;

          const studentId = targetInp.getAttribute('data-student');
          const monthColStr = targetInp.getAttribute('data-month-col');
          const subjectId = targetInp.getAttribute('data-subject');
          const rowData = this.state.rows.find(r => r.studentId === studentId);
          if (rowData) {
            const parsedVal = isNaN(numVal) ? null : numVal;
            if (monthColStr !== null) {
              const mIdx = parseInt(monthColStr, 10);
              if (!rowData.monthScores) rowData.monthScores = {};
              rowData.monthScores[mIdx] = parsedVal;
            } else if (subjectId) {
              rowData.subjectScores[subjectId] = parsedVal;
            }
            affectedStudents.add(rowData);
            pastedCount++;
          }
        }
      });
    });

    affectedStudents.forEach(rowData => {
      this.recalculateRowData(rowData);
    });

    ScoreService.rankStudents(this.state.rows);
    this.updateRanksInDOM();
    this.updateSummaryStats();
    this.triggerDebouncedAutoSave();

    const isKm = i18n.getLocale() === 'km';
    toast.success(
      isKm ? `បានបិទភ្ជាប់ពិន្ទុ ${pastedCount} ប្រអប់ដោយជោគជ័យ!` : `Pasted ${pastedCount} score cells!`,
      isKm ? 'ជោគជ័យ' : 'Success'
    );
  },

  /**
   * Auto-save scores to IndexedDB & trigger silent Drive sync
   */
  triggerDebouncedAutoSave() {
    if (!this.state.selectedPeriod) return;
    clearTimeout(this.state.saveDebounceTimer);
    const statusText = document.getElementById('sync-status-text');
    if (statusText) {
      statusText.textContent = i18n.getLocale() === 'km' ? 'កំពុងកែប្រែ...' : 'Saving...';
    }

    this.state.saveDebounceTimer = setTimeout(async () => {
      if (!this.state.selectedPeriod) return;
      if (this.state.isSaving) {
        this.triggerDebouncedAutoSave();
        return;
      }
      this.state.isSaving = true;
      try {
        await ScoreService.saveMasterScoreSheet({
          classId: this.state.selectedClassId,
          academicYear: this.state.activeYear,
          period: this.state.selectedPeriod,
          rows: this.state.rows,
          subjects: this.state.subjects
        });

        if (statusText) {
          statusText.textContent = i18n.getLocale() === 'km' ? 'បានរក្សាទុក' : 'Saved';
        }
      } catch (err) {
        console.warn('Auto-save scores notice:', err);
      } finally {
        this.state.isSaving = false;
      }
    }, 600);
  },

  updateRanksInDOM() {
    ScoreService.rankSubjectStudents(this.state.rows, this.state.subjects);
    ScoreService.calculateSubjectGrades(this.state.rows, this.state.subjects);

    this.container.querySelectorAll('tr[data-student-id]').forEach(tr => {
      const studentId = tr.getAttribute('data-student-id');
      const rowData = this.state.rows.find(r => r.studentId === studentId);
      if (rowData) {
        // Overall rank
        const rankEl = tr.querySelector('.col-rank div') || tr.querySelector('.col-rank');
        if (rankEl) rankEl.textContent = rowData.rank || 1;

        // Individual subject ranks & grades
        this.state.subjects.forEach(sub => {
          const subRankEl = tr.querySelector(`.col-sub-rank[data-subject="${sub.id}"] div`) || 
                            tr.querySelector(`.col-sub-rank[data-subject="${sub.id}"]`);
          if (subRankEl) {
            const rk = rowData.subjectRanks ? rowData.subjectRanks[sub.id] : null;
            subRankEl.textContent = (rk !== null && rk !== undefined) ? rk : '—';
          }

          const subGradeDiv = tr.querySelector(`.col-sub-grade[data-subject="${sub.id}"] div`) ||
                              tr.querySelector(`.col-sub-grade[data-subject="${sub.id}"]`);
          if (subGradeDiv) {
            const gd = rowData.subjectGrades ? rowData.subjectGrades[sub.id] : null;
            if (gd) {
              subGradeDiv.innerHTML = `<span class="col-sub-grade-badge inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${this.getGradeBadgeClasses(gd)}">${gd}</span>`;
            } else {
              subGradeDiv.innerHTML = `<span class="text-sky-700/60 dark:text-sky-300/60 font-bold font-mono text-xs">—</span>`;
            }
          }
        });
      }
    });
  },

  updateSummaryStats() {
    const rows = this.state.rows;
    const totalEl = document.getElementById('stat-count-total');
    const femaleEl = document.getElementById('stat-count-female');
    const maleEl = document.getElementById('stat-count-male');

    let femaleCount = 0;
    let maleCount = 0;

    for (const r of rows) {
      const isFemale = r.gender === 'Female' || r.gender === 'ស្រី';
      if (isFemale) femaleCount++;
      else maleCount++;
    }

    if (totalEl) totalEl.textContent = rows.length;
    if (femaleEl) femaleEl.textContent = femaleCount;
    if (maleEl) maleEl.textContent = maleCount;
  },

  getGradeBadgeClasses(grade) {
    switch (grade) {
      case 'A': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      case 'B': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30';
      case 'C': return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30';
      case 'D': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      case 'E': return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30';
      default:  return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
    }
  },

  bindStaticEvents() {
    // Helper to flush pending save immediately
    const flushPendingSave = async () => {
      if (this.state.saveDebounceTimer) {
        clearTimeout(this.state.saveDebounceTimer);
        this.state.saveDebounceTimer = null;
        if (!this.state.selectedPeriod) return;
        try {
          await ScoreService.saveMasterScoreSheet({
            classId: this.state.selectedClassId,
            academicYear: this.state.activeYear,
            period: this.state.selectedPeriod,
            rows: this.state.rows,
            subjects: this.state.subjects
          });
        } catch (_) {}
      }
    };

    // Select Class
    document.getElementById('select-score-class')?.addEventListener('change', async (e) => {
      await flushPendingSave();
      this.state.selectedClassId = e.target.value;
      if (authService.isTeacher() && this.state.selectedClassId) {
        await authService.setAssignedClassId(this.state.selectedClassId);
      }
      await this.loadScores();
    });

    // Select Period / Month
    document.getElementById('select-score-period')?.addEventListener('change', async (e) => {
      await flushPendingSave();
      this.state.selectedPeriod = e.target.value;
      this.updateCoefficientBadge();
      await this.loadScores();
    });

    // Coefficient Settings Button
    document.getElementById('btn-coefficient-settings')?.addEventListener('click', () => {
      this.openCoefficientModal();
    });

    // Search filter
    document.getElementById('input-search-student')?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      this.renderRows();
    });

    // Toggle Subject Extra Column Mode Button: none -> rank -> grade -> both -> none
    document.getElementById('btn-toggle-subject-extra-col')?.addEventListener('click', () => {
      const cycle = {
        'none': 'rank',
        'rank': 'grade',
        'grade': 'both',
        'both': 'none'
      };
      const currentMode = this.state.subjectExtraCol || 'none';
      const nextMode = cycle[currentMode] || 'none';

      this.state.subjectExtraCol = nextMode;
      localStorage.setItem('scores_subject_extra_col', nextMode);
      this.updateSubjectExtraColBtn();
      this.renderHeader();
      this.renderRows();
    });

    // Save Scores Button
    document.getElementById('btn-save-scores')?.addEventListener('click', async () => {
      if (!this.state.selectedPeriod) {
        toast.info(i18n.getLocale() === 'km' ? 'សូមជ្រើសរើសខែជាមុនសិន' : 'Please select a month first');
        return;
      }
      if (this.state.rows.length === 0) return;
      const saveBtn = document.getElementById('btn-save-scores');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<div class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>`;
      }

      try {
        await ScoreService.saveMasterScoreSheet({
          classId: this.state.selectedClassId,
          academicYear: this.state.activeYear,
          period: this.state.selectedPeriod,
          rows: this.state.rows,
          subjects: this.state.subjects
        });

        // Trigger Google Drive cloud sync immediately in background
        syncStateManager.triggerAutoSync().catch(() => {});

        const isKm = i18n.getLocale() === 'km';
        const cls = this.state.classes.find(c => c.id === this.state.selectedClassId);
        toast.success(
          isKm 
            ? `បានរក្សាទុកពិន្ទុថ្នាក់ ${cls?.name || ''} សម្រាប់ ${this.state.selectedPeriod} ដោយជោគជ័យ!`
            : `Scores saved successfully!`,
          isKm ? 'ជោគជ័យ' : 'Success'
        );
      } catch (err) {
        toast.error(err.message || 'Failed to save scores');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${getIcon('check', 'w-3.5 h-3.5')} <span>${i18n.getLocale() === 'km' ? 'រក្សាទុក' : 'Save'}</span>`;
        }
      }
    });

    // Top 5 Honor Roll Modal button
    document.getElementById('btn-honor-roll-top5')?.addEventListener('click', () => {
      this.openHonorRollTop5Modal();
    });

    // 2-Row Result Table Modal buttons
    document.getElementById('btn-result-2row-table')?.addEventListener('click', () => {
      this.openResultTable2RowModal();
    });
    document.getElementById('action-open-result-2row')?.addEventListener('click', () => {
      document.getElementById('dropdown-data-menu')?.classList.add('hidden');
      this.openResultTable2RowModal();
    });

    // Floating Multi-Delete Action Bar Buttons
    document.getElementById('btn-floating-delete')?.addEventListener('click', () => {
      this.deleteSelectedCells();
    });
    document.getElementById('btn-floating-cancel')?.addEventListener('click', () => {
      this.selection.selectedCoords.clear();
      this.updateSelectionVisuals();
    });

    // Data Menu Dropdown Toggle
    const dataMenuBtn = document.getElementById('btn-data-menu');
    const dataMenuDropdown = document.getElementById('dropdown-data-menu');
    dataMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dataMenuDropdown?.classList.toggle('hidden');
    });
    window.addEventListener('click', () => {
      dataMenuDropdown?.classList.add('hidden');
    });

    // Action: Recalculate All
    document.getElementById('action-recalculate-all')?.addEventListener('click', () => {
      if (!this.state.selectedPeriod) {
        toast.info(i18n.getLocale() === 'km' ? 'សូមជ្រើសរើសខែជាមុនសិន' : 'Please select a month first');
        return;
      }
      this.state.rows.forEach(r => this.recalculateRowData(r));
      ScoreService.rankStudents(this.state.rows);
      this.updateRanksInDOM();
      this.updateSummaryStats();
      this.triggerDebouncedAutoSave();
      toast.success(i18n.getLocale() === 'km' ? 'បានគណនាឡើងវិញគ្រប់សិស្ស' : 'Recalculated all student scores');
    });

    // Action: Clear All Scores
    document.getElementById('action-clear-all-scores')?.addEventListener('click', () => {
      const isKm = i18n.getLocale() === 'km';
      if (!this.state.selectedPeriod) {
        toast.info(isKm ? 'សូមជ្រើសរើសខែជាមុនសិន' : 'Please select a month first');
        return;
      }
      if (!confirm(isKm ? 'តើអ្នកប្រាកដជាចង់លុបពិន្ទុទាំងអស់ក្នុងខែនេះមែនទេ?' : 'Are you sure you want to clear all scores for this month?')) return;
      this.state.rows.forEach(r => {
        Object.keys(r.subjectScores).forEach(subId => {
          r.subjectScores[subId] = null;
        });
        if (r.monthScores) {
          for (let i = 0; i < 6; i++) r.monthScores[i] = null;
        }
        this.recalculateRowData(r);
      });
      ScoreService.rankStudents(this.state.rows);
      ScoreService.rankSubjectStudents(this.state.rows, this.state.subjects);
      ScoreService.calculateSubjectGrades(this.state.rows, this.state.subjects);
      this.renderRows();
      this.updateSummaryStats();
      this.triggerDebouncedAutoSave();
      toast.success(isKm ? 'បានសម្អាតពិន្ទុទាំងអស់' : 'Cleared all scores');
    });

    // Export Formatted Excel Button & Data Menu Action
    document.getElementById('btn-export-scores-excel')?.addEventListener('click', () => {
      this.exportScoresToExcel();
    });
    document.getElementById('action-export-scores-excel')?.addEventListener('click', () => {
      document.getElementById('dropdown-data-menu')?.classList.add('hidden');
      this.exportScoresToExcel();
    });

    // A-F Grading Guide Button
    document.getElementById('btn-grade-scale-guide')?.addEventListener('click', () => {
      this.openGradingScaleModal();
    });
  },

  getExcelGradeStyle(grade) {
    switch (grade) {
      case 'A': return { fill: 'FFD1FAE5', text: 'FF065F46' }; // Emerald
      case 'B': return { fill: 'FFDBEAFE', text: 'FF1E40AF' }; // Blue
      case 'C': return { fill: 'FFE0E7FF', text: 'FF3730A3' }; // Indigo
      case 'D': return { fill: 'FFFEF3C7', text: 'FF92400E' }; // Amber
      case 'E': return { fill: 'FFFFEDD5', text: 'FF9A3412' }; // Orange
      case 'F': return { fill: 'FFFFE4E6', text: 'FF9F1239' }; // Rose
      default:  return { fill: 'FFF8FAFC', text: 'FF64748B' }; // Slate
    }
  },

  async saveExcelWorkbook(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  },

  /**
   * Export full formatted Score Sheet to Excel (.xlsx) preserving UI table layout & styling
   */
  async exportScoresToExcel() {
    const isKm = i18n.getLocale() === 'km';
    if (!this.state.selectedPeriod) {
      toast.info(isKm ? 'សូមជ្រើសរើសខែជាមុនសិន' : 'Please select a month first');
      return;
    }
    const ExcelJS = window.ExcelJS || globalThis.ExcelJS;
    if (!ExcelJS) {
      toast.error(isKm ? 'មិនអាចហៅប្រើបណ្ណាល័យ Excel បានទេ' : 'ExcelJS library is not loaded');
      return;
    }

    try {
      const cls = this.state.classes.find(c => c.id === this.state.selectedClassId);
      const className = cls?.name || 'Class';
      const period = this.state.selectedPeriod;
      const periodName = this.getMonthName(period) || period;
      const academicYear = this.state.activeYear || '';
      const coeff = this.getCurrentPeriodCoefficient();
      const isSemester = this.isSemesterPeriod();
      const isAnnual = this.isAnnualPeriod();
      const mode = this.state.subjectExtraCol || 'none';
      const showRank = !isSemester && !isAnnual && (mode === 'rank' || mode === 'both');
      const showGrade = !isSemester && !isAnnual && (mode === 'grade' || mode === 'both');

      // Filter rows if search query is active
      let rows = this.state.rows || [];
      const query = (this.state.searchQuery || '').trim().toLowerCase();
      if (query) {
        rows = rows.filter(r =>
          (r.studentNumber && r.studentNumber.toLowerCase().includes(query)) ||
          (r.khmerFullName && r.khmerFullName.toLowerCase().includes(query)) ||
          (r.lastNameKh && r.lastNameKh.toLowerCase().includes(query)) ||
          (r.firstNameKh && r.firstNameKh.toLowerCase().includes(query)) ||
          (r.englishName && r.englishName.toLowerCase().includes(query))
        );
      }

      // Build column metadata matching the exact UI table structure
      const colMeta = [
        { key: 'no', header: isKm ? 'ល.រ' : 'No.', width: 6, type: 'no' },
        { key: 'surname', header: isKm ? 'គោត្តនាម' : 'Surname', width: 15, type: 'surname' },
        { key: 'givenName', header: isKm ? 'នាម' : 'Name', width: 15, type: 'givenName' },
        { key: 'gender', header: isKm ? 'ភេទ' : 'Sex', width: 9, type: 'gender' }
      ];

      if (isSemester) {
        for (let i = 0; i < 6; i++) {
          const mId = (this.state.semesterMonths || [])[i];
          const mName = this.getMonthName(mId);
          const label = mName ? mName : (isKm ? `ខែទី${toKhmerNumerals(i + 1)}` : `Month ${i + 1}`);
          colMeta.push({
            key: `month_${i}`,
            header: label,
            width: 9,
            type: 'sem_month',
            monthIdx: i,
            vertical: true
          });
        }
      } else if (isAnnual) {
        colMeta.push(
          {
            key: 'sem1',
            header: isKm ? 'មធ្យមភាគ\nប្រចាំឆមាសទី១' : 'Semester 1\nAverage',
            width: 15,
            type: 'annual_sem1',
            vertical: false
          },
          {
            key: 'sem2',
            header: isKm ? 'មធ្យមភាគ\nប្រចាំឆមាសទី២' : 'Semester 2\nAverage',
            width: 15,
            type: 'annual_sem2',
            vertical: false
          }
        );
      } else {
        (this.state.subjects || []).forEach(sub => {
          const isCalc = SubjectService.isCalculatedSubject(sub);
          colMeta.push({
            key: `sub_${sub.id}`,
            header: sub.name,
            width: 7.5,
            type: 'subject',
            subject: sub,
            isCalc,
            vertical: true
          });
          if (showRank) {
            colMeta.push({
              key: `sub_rank_${sub.id}`,
              header: isKm ? 'ចំណាត់ថ្នាក់' : 'Rank',
              width: 6.5,
              type: 'subject_rank',
              subject: sub,
              vertical: true
            });
          }
          if (showGrade) {
            colMeta.push({
              key: `sub_grade_${sub.id}`,
              header: isKm ? 'និទ្ទេស' : 'Grade',
              width: 6.5,
              type: 'subject_grade',
              subject: sub,
              vertical: true
            });
          }
        });
      }

      if (isSemester) {
        colMeta.push(
          { key: 'semester_month_avg', header: isKm ? 'មធ្យមភាគខែ\nប្រចាំឆមាស' : 'Monthly\nAverage', width: 14, type: 'sem_month_avg' },
          { key: 'semester_exam_avg', header: isKm ? 'មធ្យមភាគ\nប្រឡងឆមាស' : 'Exam\nAverage', width: 14, type: 'sem_exam_avg' },
          { key: 'semester_overall_avg', header: isKm ? 'មធ្យមភាគ\nប្រចាំឆមាស' : 'Semester\nAverage', width: 14, type: 'sem_overall_avg' },
          { key: 'rank', header: isKm ? 'ចំណាត់ថ្នាក់' : 'Rank', width: 11, type: 'rank' },
          { key: 'grade', header: isKm ? 'និទ្ទេស' : 'Grade', width: 9, type: 'grade' }
        );
      } else {
        colMeta.push(
          { key: 'total', header: isKm ? 'ពិន្ទុសរុប' : 'Total', width: 11, type: 'total' },
          { key: 'average', header: isKm ? 'មធ្យមភាគ' : 'Avg', width: 11, type: 'average' },
          { key: 'rank', header: isKm ? 'ចំណាត់ថ្នាក់' : 'Rank', width: 11, type: 'rank' },
          { key: 'grade', header: isKm ? 'និទ្ទេស' : 'Grade', width: 9, type: 'grade' }
        );
      }

      const totalCols = colMeta.length;

      // Count gender stats
      let femaleCount = 0;
      let maleCount = 0;
      rows.forEach(r => {
        if (r.gender === 'Female' || r.gender === 'ស្រី') femaleCount++;
        else maleCount++;
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PineAPPleSMS';
      workbook.created = new Date();
      workbook.modified = new Date();

      const safeSheetName = (isKm ? `ពិន្ទុ_${className}_${periodName}` : `Scores_${className}_${period}`)
        .replace(/[\\/?*[\]:]/g, '_')
        .slice(0, 31);

      const ws = workbook.addWorksheet(safeSheetName, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        views: [{ state: 'frozen', xSplit: 4, ySplit: 3, showGridLines: true }]
      });

      ws.columns = colMeta.map(c => ({ key: c.key, width: c.width }));

      // Row 1: Title Banner
      const isExamPeriod = period === 'Semester 1 Exam' || period === 'Semester 2 Exam' || period === 'First Test';
      const titleText = isKm
        ? `តារាងពិន្ទុ${isAnnual ? 'ប្រចាំឆ្នាំ' : (isSemester ? 'ប្រចាំ' + periodName : (isExamPeriod ? periodName : 'ប្រចាំខែ ' + periodName))} - ថ្នាក់ទី ${className} (${academicYear})`
        : `Score Sheet (${periodName}) - Class ${className} (${academicYear})`;
      const titleRow = ws.addRow([titleText]);
      titleRow.height = 28;
      ws.mergeCells(1, 1, 1, totalCols);
      const titleCell = titleRow.getCell(1);
      titleCell.font = { name: 'Khmer OS Muol Light', size: 12, bold: false, color: { argb: 'FF0F172A' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Row 2: Summary Info Bar
      const statsText = isKm
        ? `សិស្សសរុប៖ ${rows.length} នាក់   |   ស្រី៖ ${femaleCount} នាក់   |   ប្រុស៖ ${maleCount} នាក់   |   មេគុណ៖ ${coeff}`
        : `Total Students: ${rows.length}   |   Female: ${femaleCount}   |   Male: ${maleCount}   |   Coefficient: ${coeff}`;
      const statsRow = ws.addRow([statsText]);
      statsRow.height = 22;
      ws.mergeCells(2, 1, 2, totalCols);
      const statsCell = statsRow.getCell(1);
      statsCell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF475569' } };
      statsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      statsCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Row 3: Table Column Headers
      const headerRow = ws.addRow(colMeta.map(c => c.header));
      headerRow.height = isAnnual ? 42 : 90;

      colMeta.forEach((c, idx) => {
        const cell = headerRow.getCell(idx + 1);
        let bgArgb = 'FFF1F5F9';
        let fgArgb = 'FF1E293B';
        let fontSize = 10.5;

        if (c.type === 'sem_month') {
          bgArgb = 'FFFEF3C7'; // Amber-100
          fgArgb = 'FF78350F'; // Amber-900
        } else if (c.type === 'annual_sem1') {
          bgArgb = 'FFE0F2FE'; // Sky-100
          fgArgb = 'FF0C4A6E'; // Sky-900
        } else if (c.type === 'annual_sem2') {
          bgArgb = 'FFE0E7FF'; // Indigo-100
          fgArgb = 'FF1E1B4B'; // Indigo-950
        } else if (c.type === 'subject') {
          bgArgb = c.isCalc ? 'FFFFE4E6' : 'FFF1F5F9'; // Rose-100 for composite sum subjects
          fgArgb = c.isCalc ? 'FF881337' : 'FF1E293B';
          fontSize = 10;
        } else if (c.type === 'subject_rank') {
          bgArgb = 'FFFEF3C7';
          fgArgb = 'FF92400E';
          fontSize = 9.5;
        } else if (c.type === 'subject_grade') {
          bgArgb = 'FFE0F2FE';
          fgArgb = 'FF075985';
          fontSize = 9.5;
        } else if (c.type === 'total') {
          fgArgb = 'FF047857'; // Emerald-700
        } else if (c.type === 'average') {
          fgArgb = 'FFE11D48'; // Primary Rose-600
        } else if (c.type === 'rank') {
          fgArgb = 'FFC2410C'; // Orange-700
        } else if (c.type === 'grade') {
          fgArgb = 'FF0369A1'; // Sky-700
        }

        cell.font = {
          name: 'Khmer OS Siemreap',
          size: fontSize,
          bold: true,
          color: { argb: fgArgb }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgArgb }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: (c.type === 'surname' || c.type === 'givenName') ? 'left' : 'center',
          wrapText: !c.vertical,
          textRotation: c.vertical ? 90 : 0
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: c.type === 'gender'
            ? { style: 'medium', color: { argb: 'FF94A3B8' } }
            : { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Row 4+: Student Data Rows
      rows.forEach((r, rIdx) => {
        let surname = (r.lastNameKh || '').trim();
        let givenName = (r.firstNameKh || '').trim();
        if (!surname && !givenName && r.khmerFullName) {
          const parts = r.khmerFullName.trim().split(/\s+/);
          surname = parts[0] || '';
          givenName = parts.slice(1).join(' ') || '';
        }

        const isFemale = r.gender === 'Female' || r.gender === 'ស្រី';
        const isMale = r.gender === 'Male' || r.gender === 'ប្រុស';
        const genderText = isFemale ? 'ស្រី' : (isMale ? 'ប្រុស' : (r.gender || '—'));

        const rowValues = colMeta.map(c => {
          switch (c.type) {
            case 'no': return rIdx + 1;
            case 'surname': return surname || '—';
            case 'givenName': return givenName || '—';
            case 'gender': return genderText;
            case 'sem_month': {
              const mv = r.monthScores ? r.monthScores[c.monthIdx] : null;
              return (mv !== null && mv !== undefined && mv !== '') ? Number(Number(mv).toFixed(2)) : '—';
            }
            case 'annual_sem1': {
              const s1 = r.annualScores?.sem1;
              return (s1 !== null && s1 !== undefined && s1 !== '') ? Number(Number(s1).toFixed(2)) : '—';
            }
            case 'annual_sem2': {
              const s2 = r.annualScores?.sem2;
              return (s2 !== null && s2 !== undefined && s2 !== '') ? Number(Number(s2).toFixed(2)) : '—';
            }
            case 'subject': {
              const sv = r.subjectScores ? r.subjectScores[c.subject.id] : null;
              return (sv !== null && sv !== undefined && sv !== '') ? Number(sv) : '';
            }
            case 'subject_rank': {
              const sr = r.subjectRanks ? r.subjectRanks[c.subject.id] : null;
              return (sr !== null && sr !== undefined && sr !== '') ? Number(sr) : '—';
            }
            case 'subject_grade': {
              const sg = r.subjectGrades ? r.subjectGrades[c.subject.id] : null;
              return sg || '—';
            }
            case 'sem_month_avg': {
              const v = r.semesterMonthAvg !== undefined && r.semesterMonthAvg !== null ? Number(r.semesterMonthAvg) : (Number(r.total) || 0);
              return Number(v.toFixed(2));
            }
            case 'sem_exam_avg': {
              if (r.semesterExamAvg !== undefined && r.semesterExamAvg !== null) {
                return Number(Number(r.semesterExamAvg).toFixed(2));
              }
              return '—';
            }
            case 'sem_overall_avg': {
              const v = r.semesterOverallAvg !== undefined && r.semesterOverallAvg !== null ? Number(r.semesterOverallAvg) : (Number(r.average) || 0);
              return Number(v.toFixed(2));
            }
            case 'total': {
              const tot = Number(r.total) || 0;
              return (isSemester || isAnnual) ? Number(tot.toFixed(2)) : tot;
            }
            case 'average': {
              return Number((Number(r.average) || 0).toFixed(2));
            }
            case 'rank': {
              return r.rank || 1;
            }
            case 'grade': {
              return r.grade || 'F';
            }
            default: return '';
          }
        });

        const excelRow = ws.addRow(rowValues);
        excelRow.height = 23;
        const isEven = rIdx % 2 === 1;

        colMeta.forEach((c, idx) => {
          const cell = excelRow.getCell(idx + 1);
          const val = rowValues[idx];

          let bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
          let fgArgb = 'FF0F172A';
          let isBold = false;
          let alignH = 'center';
          let numFmt = undefined;

          if (c.type === 'no') {
            fgArgb = 'FF64748B';
          } else if (c.type === 'surname' || c.type === 'givenName') {
            alignH = 'left';
            isBold = true;
          } else if (c.type === 'gender') {
            isBold = true;
            fgArgb = isFemale ? 'FFE11D48' : (isMale ? 'FF0284C7' : 'FF64748B');
          } else if (c.type === 'sem_month') {
            bgArgb = 'FFFFFBEB';
            fgArgb = typeof val === 'number' ? 'FF78350F' : 'FF94A3B8';
            isBold = typeof val === 'number';
            if (typeof val === 'number') numFmt = '0.00';
          } else if (c.type === 'annual_sem1') {
            bgArgb = 'FFF0F9FF';
            fgArgb = typeof val === 'number' ? 'FF0C4A6E' : 'FF94A3B8';
            isBold = typeof val === 'number';
            if (typeof val === 'number') numFmt = '0.00';
          } else if (c.type === 'annual_sem2') {
            bgArgb = 'FFEEF2FF';
            fgArgb = typeof val === 'number' ? 'FF1E1B4B' : 'FF94A3B8';
            isBold = typeof val === 'number';
            if (typeof val === 'number') numFmt = '0.00';
          } else if (c.type === 'subject') {
            if (c.isCalc) {
              bgArgb = 'FFFFF1F2';
              fgArgb = 'FFBE123C';
              isBold = true;
            }
          } else if (c.type === 'subject_rank') {
            bgArgb = 'FFFFFBEB';
            fgArgb = 'FF92400E';
            isBold = true;
          } else if (c.type === 'subject_grade') {
            const gStyle = this.getExcelGradeStyle(val);
            bgArgb = gStyle.fill;
            fgArgb = gStyle.text;
            isBold = true;
          } else if (c.type === 'sem_month_avg') {
            bgArgb = 'FFF1F5F9';
            fgArgb = 'FF047857';
            isBold = true;
            numFmt = '0.00';
          } else if (c.type === 'sem_exam_avg') {
            bgArgb = 'FFF1F5F9';
            fgArgb = 'FF1D4ED8';
            isBold = true;
            if (typeof val === 'number') numFmt = '0.00';
          } else if (c.type === 'sem_overall_avg') {
            bgArgb = 'FFF1F5F9';
            fgArgb = 'FF1D4ED8';
            isBold = true;
            numFmt = '0.00';
          } else if (c.type === 'total') {
            bgArgb = 'FFF1F5F9';
            isBold = true;
            numFmt = (isSemester || isAnnual) ? '0.00' : '0.##';
          } else if (c.type === 'average') {
            bgArgb = 'FFF1F5F9';
            fgArgb = 'FF1D4ED8';
            isBold = true;
            numFmt = '0.00';
          } else if (c.type === 'rank') {
            isBold = true;
            if (Number(val) <= 3) fgArgb = 'FFB45309';
          } else if (c.type === 'grade') {
            const gStyle = this.getExcelGradeStyle(val);
            bgArgb = gStyle.fill;
            fgArgb = gStyle.text;
            isBold = true;
          }

          cell.font = {
            name: 'Khmer OS Siemreap',
            size: 10.5,
            bold: isBold,
            color: { argb: fgArgb }
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgArgb }
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: alignH
          };
          if (numFmt && typeof val === 'number') {
            cell.numFmt = numFmt;
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: c.type === 'gender'
              ? { style: 'medium', color: { argb: 'FF94A3B8' } }
              : { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });
      });

      const filename = `Scores_${className}_${period}_${academicYear}.xlsx`.replace(/\s+/g, '_');
      await this.saveExcelWorkbook(workbook, filename);

      toast.success(
        isKm ? `បាននាំចេញតារាងពិន្ទុថ្នាក់ ${className} ជា Excel រួចរាល់!` : `Exported formatted Excel for ${className}!`,
        isKm ? 'ជោគជ័យ' : 'Success'
      );
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error((isKm ? 'បរាជ័យក្នុងការនាំចេញ Excel៖ ' : 'Failed to export Excel: ') + err.message);
    }
  },

  /**
   * Download Excel Template populated with current class roster (Formatted with ExcelJS)
   */
  async downloadExcelTemplate() {
    const isKm = i18n.getLocale() === 'km';
    if (!this.state.selectedPeriod) {
      toast.info(isKm ? 'សូមជ្រើសរើសខែជាមុនសិន' : 'Please select a month first');
      return;
    }
    const ExcelJS = window.ExcelJS || globalThis.ExcelJS;
    if (!ExcelJS && !window.XLSX) {
      toast.error('Excel library is not loaded');
      return;
    }

    const cls = this.state.classes.find(c => c.id === this.state.selectedClassId);
    const className = cls?.name || 'Class';
    const period = this.state.selectedPeriod;

    const headers = [
      isKm ? 'ល.រ' : 'No',
      isKm ? 'អត្តលេខ' : 'Student ID',
      isKm ? 'គោត្តនាម' : 'LastName',
      isKm ? 'នាម' : 'FirstName',
      isKm ? 'ភេទ' : 'Gender'
    ];

    if (this.isSemesterPeriod()) {
      for (let i = 0; i < 6; i++) {
        const mId = this.state.semesterMonths[i];
        const mName = this.getMonthName(mId);
        headers.push(mName ? (isKm ? `ខែ${mName}` : mName) : (isKm ? `ខែទី${toKhmerNumerals(i + 1)}` : `Month ${i + 1}`));
      }
    } else if (this.isAnnualPeriod()) {
      headers.push(
        isKm ? 'មធ្យមភាគប្រចាំឆមាសទី១' : 'Semester 1 Average',
        isKm ? 'មធ្យមភាគប្រចាំឆមាសទី២' : 'Semester 2 Average'
      );
    } else {
      const flatSubjects = this.state.subjects;
      flatSubjects.forEach(s => {
        headers.push(`${s.name} (Max:${s.fullScore})`);
      });
    }

    const rowsData = [];
    this.state.rows.forEach((r, idx) => {
      let surname = (r.lastNameKh || '').trim();
      let givenName = (r.firstNameKh || '').trim();
      if (!surname && !givenName && r.khmerFullName) {
        const parts = r.khmerFullName.trim().split(/\s+/);
        surname = parts[0] || '';
        givenName = parts.slice(1).join(' ') || '';
      }

      const isFemale = r.gender === 'Female' || r.gender === 'ស្រី';
      const isMale = r.gender === 'Male' || r.gender === 'ប្រុស';
      const genderText = isFemale ? 'ស្រី' : (isMale ? 'ប្រុស' : (r.gender || 'Male'));

      const row = [
        idx + 1,
        r.studentNumber || '',
        surname,
        givenName,
        genderText
      ];

      if (this.isSemesterPeriod()) {
        for (let i = 0; i < 6; i++) {
          const val = r.monthScores ? r.monthScores[i] : '';
          row.push((val !== null && val !== undefined && val !== '') ? Number(Number(val).toFixed(2)) : '');
        }
      } else if (this.isAnnualPeriod()) {
        const s1 = r.annualScores?.sem1;
        const s2 = r.annualScores?.sem2;
        row.push(
          (s1 !== null && s1 !== undefined && s1 !== '') ? Number(Number(s1).toFixed(2)) : '',
          (s2 !== null && s2 !== undefined && s2 !== '') ? Number(Number(s2).toFixed(2)) : ''
        );
      } else {
        this.state.subjects.forEach(s => {
          const score = r.subjectScores[s.id];
          row.push(score !== null && score !== undefined ? Number(score) : '');
        });
      }

      rowsData.push({ row, isFemale, isMale });
    });

    if (ExcelJS) {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Scores', {
        views: [{ state: 'frozen', xSplit: 5, ySplit: 1, showGridLines: true }]
      });

      const headerRow = ws.addRow(headers);
      headerRow.height = this.isAnnualPeriod() ? 36 : 78;
      headerRow.eachCell((cell, colNumber) => {
        const isScoreCol = colNumber > 5;
        cell.font = {
          name: 'Khmer OS Siemreap',
          size: 10.5,
          bold: true,
          color: { argb: 'FF1E293B' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isScoreCol ? 'FFE0F2FE' : 'FFF1F5F9' }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colNumber === 3 || colNumber === 4) ? 'left' : 'center',
          wrapText: true,
          textRotation: (isScoreCol && !this.isAnnualPeriod()) ? 90 : 0
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      rowsData.forEach(({ row, isFemale, isMale }, idx) => {
        const r = ws.addRow(row);
        r.height = 22;
        const isEven = idx % 2 === 1;
        r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = {
            name: 'Khmer OS Siemreap',
            size: 10.5,
            bold: colNumber >= 3 && colNumber <= 5,
            color: {
              argb: colNumber === 5
                ? (isFemale ? 'FFE11D48' : (isMale ? 'FF0284C7' : 'FF0F172A'))
                : 'FF0F172A'
            }
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: (colNumber === 3 || colNumber === 4) ? 'left' : 'center'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });
      });

      ws.columns.forEach((col, i) => {
        if (i === 0) col.width = 6;
        else if (i === 1) col.width = 12;
        else if (i === 2 || i === 3) col.width = 15;
        else if (i === 4) col.width = 9;
        else col.width = this.isAnnualPeriod() ? 18 : 9;
      });

      await this.saveExcelWorkbook(workbook, `Score_Template_${className}_${period}.xlsx`);
    } else {
      const data = [headers, ...rowsData.map(d => d.row)];
      const ws = window.XLSX.utils.aoa_to_sheet(data);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Scores');
      window.XLSX.writeFile(wb, `Score_Template_${className}_${period}.xlsx`);
    }

    toast.success(
      isKm ? `បានទាញយកឯកសារ Excel គំរូថ្នាក់ ${className}!` : `Downloaded template for ${className}!`,
      isKm ? 'ជោគជ័យ' : 'Success'
    );
  },

  /**
   * Import Scores from Excel file
   */
  importScoresFromExcel(file) {
    const isKm = i18n.getLocale() === 'km';
    if (!window.XLSX) {
      toast.error('Excel library is not loaded');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length < 2) {
          throw new Error('File does not contain valid score rows');
        }

        const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
        let importedCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const stdIdVal = String(row[1] || '').trim();
          const surnameVal = String(row[2] || '').trim();
          const givenNameVal = String(row[3] || '').trim();

          const targetStudent = this.state.rows.find(r => 
            (stdIdVal && r.studentNumber && r.studentNumber.toLowerCase() === stdIdVal.toLowerCase()) ||
            (surnameVal && givenNameVal && r.lastNameKh === surnameVal && r.firstNameKh === givenNameVal) ||
            (surnameVal && givenNameVal && (r.khmerFullName || '').includes(surnameVal) && (r.khmerFullName || '').includes(givenNameVal))
          );

          if (targetStudent) {
            if (this.isSemesterPeriod()) {
              if (!targetStudent.monthScores) targetStudent.monthScores = {};
              for (let mIdx = 0; mIdx < 6; mIdx++) {
                const mId = this.state.semesterMonths[mIdx];
                const mName = (this.getMonthName(mId) || '').toLowerCase();
                const colIdx = headerRow.findIndex((h, idx) => {
                  if (idx < 5) return false;
                  return (mName && h.includes(mName)) || h.includes(`month ${mIdx + 1}`) || h.includes(`ខែទី${toKhmerNumerals(mIdx + 1)}`) || (idx === 5 + mIdx);
                });
                if (colIdx !== -1 && row[colIdx] !== undefined && row[colIdx] !== '') {
                  const val = Number(row[colIdx]);
                  if (!isNaN(val)) {
                    targetStudent.monthScores[mIdx] = Math.max(0, val);
                  }
                }
              }
            } else {
              this.state.subjects.forEach(sub => {
                const subName = (sub.name || '').toLowerCase();
                const colIdx = headerRow.findIndex(h => h.includes(subName) || (sub.nameEn && h.includes(sub.nameEn.toLowerCase())));
                if (colIdx !== -1 && row[colIdx] !== undefined && row[colIdx] !== '') {
                  const val = Number(row[colIdx]);
                  if (!isNaN(val)) {
                    targetStudent.subjectScores[sub.id] = Math.max(0, val);
                  }
                }
              });
            }
            this.recalculateRowData(targetStudent);
            importedCount++;
          }
        }

        ScoreService.rankStudents(this.state.rows);
        ScoreService.rankSubjectStudents(this.state.rows, this.state.subjects);
        ScoreService.calculateSubjectGrades(this.state.rows, this.state.subjects);
        this.renderRows();
        this.updateSummaryStats();
        this.triggerDebouncedAutoSave();

        toast.success(
          isKm ? `បានបញ្ចូលពិន្ទុសិស្ស ${importedCount} នាក់ពី Excel ដោយជោគជ័យ!` : `Imported scores for ${importedCount} students!`,
          isKm ? 'ជោគជ័យ' : 'Success'
        );
      } catch (err) {
        toast.error('Failed to import Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  /**
   * Grading Scale (A-F) Guide Modal
   */
  openGradingScaleModal() {
    const isKm = i18n.getLocale() === 'km';
    const summary = SubjectService.getGradingScaleSummary(50);

    const scoreRanges = {
      'A': '42.50 – 50.00',
      'B': '40.00 – 42.49',
      'C': '35.00 – 39.99',
      'D': '30.00 – 34.99',
      'E': '25.00 – 29.99',
      'F': '< 25.00'
    };

    const content = `
      <div class="space-y-3 text-xs select-none">
        <p class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">
          ${isKm 
            ? 'ស្តង់ដារក្រសួងអប់រំ យុវជន និងកីឡា សម្រាប់ការវាយតម្លៃនិទ្ទេសសិស្ស (A ដល់ F) គិតតាមមធ្យមភាគពេញ 50.00 (ក្រោម 25.00 ធ្លាក់)៖' 
            : 'Standard Ministry of Education grading scale (A to F) calculated from average score out of full 50.00 (< 25.00 is Fail):'}
        </p>

        <div class="rounded-lg border border-border overflow-hidden">
          <table class="w-full text-left text-xs font-khmer">
            <thead class="bg-muted text-muted-foreground font-bold">
              <tr>
                <th class="p-2.5 text-center">និទ្ទេស</th>
                <th class="p-2.5">អត្ថន័យ</th>
                <th class="p-2.5 text-center font-mono">មធ្យមភាគ (ពេញ 50)</th>
                <th class="p-2.5 text-center font-mono">ភាគរយ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              ${summary.map(item => `
                <tr class="hover:bg-muted/30">
                  <td class="p-2.5 text-center font-bold">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold ${this.getGradeBadgeClasses(item.grade)}">
                      ${item.grade}
                    </span>
                  </td>
                  <td class="p-2.5 font-semibold text-foreground">
                    ${item.labelKm} <span class="text-muted-foreground font-normal">(${item.labelEn})</span>
                  </td>
                  <td class="p-2.5 text-center font-mono font-bold text-foreground">
                    ${scoreRanges[item.grade] || '—'}
                  </td>
                  <td class="p-2.5 text-center font-mono font-bold text-primary">
                    ${item.percentRange}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="p-2.5 rounded-lg bg-primary/5 border border-primary/15 text-muted-foreground ${isKm ? 'font-khmer' : ''}">
          <p class="text-[11px] leading-relaxed">
            ${isKm
              ? '💡 <strong>ចំណាំសម្រាប់និទ្ទេសតាមមុខវិជ្ជានីមួយៗ៖</strong> និទ្ទេសត្រូវគណនាផ្អែកលើពិន្ទុពេញនៃមុខវិជ្ជានោះ (ឧ. តែងសេចក្តី ពិន្ទុពេញ 60 និទ្ទេស F គឺ < 30 ពិន្ទុ, មុខវិជ្ជាពិន្ទុពេញ 50 និទ្ទេស F គឺ < 25 ពិន្ទុ, មុខវិជ្ជាពិន្ទុពេញ 100 និទ្ទេស F គឺ < 50 ពិន្ទុ)។'
              : '💡 <strong>Note for individual subject grades:</strong> Subject grades are calculated based on each subject\'s own max score (e.g. Essay max score 60 → grade F is < 30, max score 50 → grade F is < 25, max score 100 → grade F is < 50).'}
          </p>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: isKm ? 'កម្រិតនិទ្ទេស (A - F)' : 'Grading Scale (A - F)',
      content,
      footer: `
        <button id="btn-close-grade-guide" type="button" class="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold cursor-pointer">
          ${isKm ? 'យល់ព្រម' : 'Got it'}
        </button>
      `,
      maxWidth: 'max-w-lg'
    });

    modal.element.querySelector('#btn-close-grade-guide')?.addEventListener('click', () => modal.close());
  },

  /**
   * Student Academic Transcript Modal
   */
  openTranscriptModal(studentName, history) {
    const isKm = i18n.getLocale() === 'km';
    const content = `
      <div class="space-y-4 text-xs select-none">
        <div class="flex items-center justify-between pb-2 border-b border-border">
          <p class="text-xs text-muted-foreground ${isKm ? 'font-khmer' : ''}">
            ${isKm ? 'សិស្ស៖' : 'Student:'} <strong class="text-foreground text-sm font-khmer">${studentName}</strong>
          </p>
          <span class="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-semibold">
            ${history.length} ${isKm ? 'កំណត់ត្រាពិន្ទុ' : 'score records'}
          </span>
        </div>

        ${history.length === 0 ? `
          <p class="py-8 text-center text-muted-foreground italic ${isKm ? 'font-khmer' : ''}">
            ${isKm ? 'មិនទាន់មានពិន្ទុសម្រាប់សិស្សនេះនៅឡើយទេ។' : 'No recorded scores for this student.'}
          </p>
        ` : `
          <div class="max-h-80 overflow-y-auto divide-y divide-border border border-border rounded-lg">
            ${history.map(sc => `
              <div class="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-foreground font-khmer">${sc.subjectNameKm || sc.subjectNameEn || sc.subjectId}</span>
                    <span class="text-[10px] text-muted-foreground">(${sc.month || sc.assessmentType}, ${sc.academicYear})</span>
                  </div>
                  <p class="text-[11px] text-muted-foreground mt-0.5">
                    ${isKm ? 'ពិន្ទុទទួលបាន៖' : 'Score:'} <strong class="text-foreground font-mono">${sc.totalScore ?? sc.examScore}</strong> / ${sc.fullScore || 100}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-right">
                    <span class="text-[11px] font-mono font-bold text-primary block">${sc.percentage || 0}%</span>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-xs font-bold ${this.getGradeBadgeClasses(sc.grade)}">
                    ${sc.grade}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    const footer = `
      <button id="btn-print-transcript" type="button" class="px-3.5 py-1.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium cursor-pointer">
        ${getIcon('download', 'w-3.5 h-3.5 inline mr-1')} ${isKm ? 'បោះពុម្ព' : 'Print'}
      </button>
      <button id="btn-close-transcript" type="button" class="px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold cursor-pointer">
        ${isKm ? 'បិទ' : 'Close'}
      </button>
    `;

    const modal = Modal.open({
      title: `${isKm ? 'ព្រឹត្តិបត្រពិន្ទុសិស្ស' : 'Academic Transcript'}: ${studentName}`,
      content,
      footer,
      maxWidth: 'max-w-lg'
    });

    modal.element.querySelector('#btn-close-transcript')?.addEventListener('click', () => modal.close());
    modal.element.querySelector('#btn-print-transcript')?.addEventListener('click', () => window.print());
  },

  /**
   * Monthly Coefficients Configuration Modal
   */
  async openCoefficientModal() {
    const isKm = i18n.getLocale() === 'km';
    if (!this.state.coefficients || Object.keys(this.state.coefficients).length === 0) {
      this.state.coefficients = await ScoreService.getMonthlyCoefficients();
    }

    const periods = ScoreService.getEvaluationPeriods();
    const months = periods.filter(p => p.group === 'month');
    const exams = periods.filter(p => p.group === 'exam');
    const currentPeriod = this.state.selectedPeriod || 'October';
    const activePeriodObj = periods.find(p => p.id === currentPeriod) || months[0];
    const currentVal = this.getCurrentPeriodCoefficient();

    const content = `
      <div class="space-y-4 text-xs select-none">
        <!-- Active Month Highlight Banner -->
        <div class="p-3.5 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground font-khmer">
                ${isKm ? 'ខែកំពុងជ្រើសរើស' : 'Active Period'}
              </span>
              <span class="font-bold text-sm text-foreground font-khmer">
                ${isKm ? activePeriodObj.nameKm : activePeriodObj.nameEn}
              </span>
            </div>
            <p class="text-[11px] text-muted-foreground mt-1 font-khmer">
              ${isKm 
                ? 'រូបមន្តគណនា៖ <strong>មធ្យមភាគ = ពិន្ទុសរុប ÷ មេគុណ</strong>' 
                : 'Calculation formula: <strong>Average = Total Score ÷ Coefficient</strong>'}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <label for="active-month-coeff-input" class="text-xs font-semibold text-foreground whitespace-nowrap font-khmer">
              ${isKm ? 'មេគុណខែនេះ៖' : 'Coefficient:'}
            </label>
            <input type="number" step="0.1" min="0.1" id="active-month-coeff-input" 
                   value="${currentVal}" 
                   class="w-24 h-9 px-2 text-center font-mono font-bold text-sm rounded-lg border border-primary bg-background text-foreground shadow-xs focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
        </div>

        <!-- Full monthly & exams coefficient grid -->
        <div class="space-y-3 pt-1">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
            <span class="font-bold text-xs text-foreground flex items-center gap-1.5 font-khmer">
              <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${isKm ? 'កំណត់មេគុណតាមខែនីមួយៗ' : 'Set coefficients for all periods'}
            </span>
            <div class="flex items-center gap-1.5">
              <button type="button" id="btn-quick-set-months-10" class="text-[10px] px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-khmer" title="Set all monthly evaluations to 10">
                ${isKm ? 'គ្រប់ខែ = 10' : 'All Months = 10'}
              </button>
              <button type="button" id="btn-quick-set-exams-20" class="text-[10px] px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-khmer" title="Set all semester/annual exams to 20">
                ${isKm ? 'ឆមាស/ប្រចាំឆ្នាំ = 20' : 'Exams = 20'}
              </button>
            </div>
          </div>

          <!-- Monthly periods grid -->
          <div class="space-y-1.5">
            <span class="text-[11px] font-semibold text-muted-foreground font-khmer block">
              ${isKm ? '១. ពិន្ទុប្រចាំខែ (Months)' : '1. Monthly Periods'}
            </span>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              ${months.map(m => {
                const val = this.state.coefficients[m.id] !== undefined ? this.state.coefficients[m.id] : 10;
                const isActive = m.id === currentPeriod;
                return `
                  <div class="p-2 rounded-lg border ${isActive ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card'} flex items-center justify-between gap-1 shadow-2xs">
                    <span class="text-xs font-semibold text-foreground truncate font-khmer" title="${isKm ? m.nameKm : m.nameEn}">
                      ${isKm ? m.nameKm : m.nameEn}
                    </span>
                    <input type="number" step="0.1" min="0.1" 
                           data-period-id="${m.id}" 
                           class="coeff-period-input w-16 h-7 px-1 text-center font-mono font-bold text-xs rounded border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none" 
                           value="${val}" />
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Exam & Semester periods grid -->
          <div class="space-y-1.5 pt-2">
            <span class="text-[11px] font-semibold text-muted-foreground font-khmer block">
              ${isKm ? '២. ការប្រឡង និងឆមាស (Exams & Semesters)' : '2. Exams & Semesters'}
            </span>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              ${exams.map(e => {
                const defaultExamVal = e.id === 'Annual' ? 2 : (e.id.includes('Semester') ? 20 : 10);
                const val = this.state.coefficients[e.id] !== undefined ? this.state.coefficients[e.id] : defaultExamVal;
                const isActive = e.id === currentPeriod;
                return `
                  <div class="p-2 rounded-lg border ${isActive ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card'} flex items-center justify-between gap-1 shadow-2xs">
                    <span class="text-xs font-semibold text-foreground truncate font-khmer" title="${isKm ? e.nameKm : e.nameEn}">
                      ${isKm ? e.nameKm : e.nameEn}
                    </span>
                    <input type="number" step="0.1" min="0.1" 
                           data-period-id="${e.id}" 
                           class="coeff-period-input w-16 h-7 px-1 text-center font-mono font-bold text-xs rounded border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none" 
                           value="${val}" />
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: isKm ? 'កំណត់មេគុណតាមខែ (Coefficients)' : 'Monthly Coefficient Settings',
      content,
      footer: `
        <div class="flex items-center justify-between w-full">
          <button id="btn-cancel-coeff" type="button" class="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium cursor-pointer font-khmer">
            ${isKm ? 'បោះបង់' : 'Cancel'}
          </button>
          <button id="btn-save-coeff" type="button" class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer font-khmer">
            ${getIcon('check', 'w-3.5 h-3.5')}
            <span>${isKm ? 'រក្សាទុក & គណនាឡើងវិញ' : 'Save & Recalculate'}</span>
          </button>
        </div>
      `,
      maxWidth: 'max-w-2xl'
    });

    const activeTopInput = modal.element.querySelector('#active-month-coeff-input');
    const matchingGridInput = modal.element.querySelector(`.coeff-period-input[data-period-id="${currentPeriod}"]`);

    // Sync active top input with grid input
    if (activeTopInput && matchingGridInput) {
      activeTopInput.addEventListener('input', () => {
        matchingGridInput.value = activeTopInput.value;
      });
      matchingGridInput.addEventListener('input', () => {
        activeTopInput.value = matchingGridInput.value;
      });
    }

    // Quick set buttons
    modal.element.querySelector('#btn-quick-set-months-10')?.addEventListener('click', () => {
      months.forEach(m => {
        const inp = modal.element.querySelector(`.coeff-period-input[data-period-id="${m.id}"]`);
        if (inp) inp.value = '10';
      });
      if (activeTopInput && months.some(m => m.id === currentPeriod)) {
        activeTopInput.value = '10';
      }
    });

    modal.element.querySelector('#btn-quick-set-exams-20')?.addEventListener('click', () => {
      exams.forEach(e => {
        const inp = modal.element.querySelector(`.coeff-period-input[data-period-id="${e.id}"]`);
        if (inp) inp.value = e.id === 'Annual' ? '2' : '20';
      });
      if (activeTopInput && exams.some(e => e.id === currentPeriod)) {
        activeTopInput.value = currentPeriod === 'Annual' ? '2' : '20';
      }
    });

    // Close button
    modal.element.querySelector('#btn-cancel-coeff')?.addEventListener('click', () => modal.close());

    // Save button
    modal.element.querySelector('#btn-save-coeff')?.addEventListener('click', async () => {
      const newMap = { ...(this.state.coefficients || {}) };
      modal.element.querySelectorAll('.coeff-period-input').forEach(inp => {
        const pId = inp.getAttribute('data-period-id');
        const num = parseFloat(inp.value);
        if (pId && !isNaN(num) && num > 0) {
          newMap[pId] = num;
        }
      });

      if (activeTopInput) {
        const activeNum = parseFloat(activeTopInput.value);
        if (!isNaN(activeNum) && activeNum > 0) {
          newMap[currentPeriod] = activeNum;
        }
      }

      await ScoreService.saveMonthlyCoefficients(newMap);
      this.state.coefficients = newMap;

      // Update UI components
      this.updateCoefficientBadge();
      this.renderHeader();

      // Recalculate all rows
      this.state.rows.forEach(r => this.recalculateRowData(r));
      ScoreService.rankStudents(this.state.rows);
      this.updateRanksInDOM();
      this.updateSummaryStats();
      this.triggerDebouncedAutoSave();

      modal.close();

      const newCoeff = this.getCurrentPeriodCoefficient();
      toast.success(
        isKm 
          ? `បានរក្សាទុកមេគុណ (${newCoeff}) និងគណនាមធ្យមភាគឡើងវិញដោយជោគជ័យ!` 
          : `Saved coefficient (${newCoeff}) and recalculated averages successfully!`,
        isKm ? 'ជោគជ័យ' : 'Success'
      );
    });
  },

  /**
   * Open 2-Row / Dual-Column Score Result Table (តារាងលទ្ធផលប្រចាំខែ) in ReportViewer
   * Layout matches Cambodian MoEYS dual-table standard:
   * Columns: ល.រ | អត្តលេខ | គោត្តនាម និងនាម | ភេទ | មធ្យមភាគ | ចំណាត់ថ្នាក់ | និទ្ទេស | អវត្តមាន (មានច្បាប់ | ឥតច្បាប់ | សរុប)
   * Students sorted by Rank #1 on top and subsequent ranks in ascending order.
   */
  async openResultTable2RowModal() {
    const isKm = i18n.getLocale() === 'km';
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();
    const currentUser = authService.getCurrentUser();

    let classes = [];
    try {
      classes = await ClassService.getAll();
    } catch (_) {}
    if (!classes || classes.length === 0) {
      classes = this.state?.classes || [];
    }

    let academicYears = [];
    try {
      academicYears = await SettingsService.getAcademicYears() || [];
    } catch (_) {}
    if (!academicYears || academicYears.length === 0) {
      academicYears = [{ id: 'ay-1', name: '2025–2026' }, { id: 'ay-2', name: '2024–2025' }];
    }

    let allSchools = [];
    let schoolName = '';
    let schoolProvince = 'សៀមរាប';

    try {
      allSchools = await SchoolService.getAllSchools();
    } catch (_) {}
    if (!allSchools || allSchools.length === 0) {
      allSchools = [
        { name: isKm ? 'សាលាបឋមសិក្សា វត្តបូព៌' : 'Wat Bo Primary School', province: 'សៀមរាប' },
        { name: isKm ? 'អនុវិទ្យាល័យ ហ៊ុន សែន ស្វាយធំ' : 'Hun Sen Svay Thom Secondary School', province: 'សៀមរាប' }
      ];
    }

    const defaultSchoolName = currentUser?.school || (allSchools[0]?.name) || (isKm ? 'សាលាបឋមសិក្សា វត្តបូព៌' : 'Wat Bo Primary School');
    const matchedSchool = allSchools.find(s => s.name === defaultSchoolName);
    schoolName = defaultSchoolName;
    schoolProvince = matchedSchool?.province || currentUser?.province || 'សៀមរាប';

    let selectedClassId = this.state.selectedClassId || (isTeacher ? (teacherClassId || classes[0]?.id) : (classes[0]?.id || ''));
    let selectedYear = this.state.activeYear || (typeof academicYears[0] === 'string' ? academicYears[0] : (academicYears[0]?.name || '2024–2025'));
    let selectedPeriod = this.state.selectedPeriod || 'October';
    let selectedReportDate = new Date();
    let currentClassName = '';
    let headerBgColor = localStorage.getItem('score_result_2row_header_bg') || '#0045ff';

    const getContrastTextColor = (hexColor) => {
      if (!hexColor || hexColor === 'transparent') return '#000000';
      const clean = String(hexColor).replace('#', '').trim();
      if (clean.length === 3) {
        const r = parseInt(clean[0] + clean[0], 16);
        const g = parseInt(clean[1] + clean[1], 16);
        const b = parseInt(clean[2] + clean[2], 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 155 ? '#000000' : '#ffffff';
      }
      if (clean.length >= 6) {
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
          return yiq >= 155 ? '#000000' : '#ffffff';
        }
      }
      return '#ffffff';
    };

    const periods = ScoreService.getEvaluationPeriods();
    const months = periods.filter(p => p.group === 'month');
    const exams = periods.filter(p => p.group === 'exam');

    const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

    const getPeriodDisplayName = (pId) => {
      const pObj = periods.find(p => p.id === pId);
      if (pObj) return isKm ? pObj.nameKm : pObj.nameEn;
      return pId;
    };

    const getResultReportTitle = (pId) => {
      const pName = getPeriodDisplayName(pId) || '.........................';
      if (!isKm) return `${pName} Result Table`;
      if (pId === 'Annual') return 'តារាងលទ្ធផលប្រចាំឆ្នាំ';
      if (pId === 'Semester 1' || pId === 'Semester 2') return `តារាងលទ្ធផលប្រចាំ${pName}`;
      if (pId === 'Semester 1 Exam' || pId === 'Semester 2 Exam' || pId === 'First Test') return `តារាងលទ្ធផល${pName}`;
      return `តារាងលទ្ធផលប្រចាំខែ ${pName}`;
    };

    await ReportViewer.open({
      reportKey: 'score_result_table_2row',
      title: isKm ? 'តារាងលទ្ធផល' : '2-Row Result Table',
      alwaysFresh: true,
      defaultOrientation: 'portrait',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 8, bottom: 8, left: 8, right: 8 },
      defaultFontFamily: 'Khmer OS Siemreap',
      defaultFontSize: 8.5,
      renderHeaderControls: (controlsContainer, viewer) => {
        const schoolOptsHtml = (allSchools || []).map(s => {
          const isSel = s.name === schoolName;
          return `<option value="${escapeHtml(s.name)}" ${isSel ? 'selected' : ''}>${escapeHtml(s.name)}</option>`;
        }).join('');

        const classOptionsHtml = isTeacher && teacherClassId
          ? `<option value="${selectedClassId}">${escapeHtml(classes.find(c => String(c.id).trim() === String(selectedClassId).trim())?.name || selectedClassId)}</option>`
          : classes.map(c => `<option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

        controlsContainer.className = 'flex items-center gap-2 sm:gap-3 flex-wrap font-khmer';
        controlsContainer.innerHTML = `
          <!-- School Filter -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'សាលារៀន:' : 'School:'}</span>
            <select id="rv-result-filter-school" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate max-w-[150px] sm:max-w-[180px] cursor-pointer box-border">
              ${schoolOptsHtml || `<option value="${escapeHtml(schoolName)}">${escapeHtml(schoolName || 'វិទ្យាល័យ')}</option>`}
            </select>
          </div>

          <!-- Class Filter -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ថ្នាក់រៀន:' : 'Class:'}</span>
            <select id="rv-result-filter-class" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate cursor-pointer box-border">
              ${classOptionsHtml}
            </select>
          </div>

          <!-- Academic Year Trigger & Popover -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ឆ្នាំសិក្សា:' : 'Year:'}</span>
            <div id="rv-result-year-group" class="relative">
              <button type="button" 
                      id="rv-btn-result-year-trigger" 
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[110px] max-w-[160px] box-border" 
                      title="${isKm ? 'ជ្រើសរើស ឬបន្ថែមឆ្នាំសិក្សា' : 'Select Academic Year'}">
                <span id="rv-result-year-text" class="truncate">${selectedYear}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-result-year-chevron')}
              </button>
              <div id="rv-popover-result-year-menu" class="hidden absolute top-9 left-0 z-50 w-72 p-2.5 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2 font-khmer select-none box-border animate-slide-down">
                <div class="flex items-center gap-1.5 border-b border-border pb-1.5 w-full box-border">
                  <input type="text" id="rv-input-result-new-year" placeholder="${isKm ? 'បញ្ចូលឆ្នាំថ្មី... (2025–2026)' : 'New year (2025–2026)...'}" class="flex-1 min-w-0 h-8 px-2.5 bg-background border border-input rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border" />
                  <button type="button" id="rv-btn-result-add-year" class="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors flex-shrink-0 cursor-pointer whitespace-nowrap">${getIcon('plus', 'w-3.5 h-3.5')}<span>${isKm ? 'បន្ថែម' : 'Add'}</span></button>
                </div>
                <div class="max-h-48 overflow-y-auto divide-y divide-border/20 rounded-md border border-border/40 bg-background/50 p-0.5 space-y-0.5" id="rv-result-year-list"></div>
              </div>
            </div>
          </div>

          <!-- Evaluation Period Selector (Data Source & Title Month) -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ពិន្ទុខែ:' : 'Scores:'}</span>
            <select id="rv-result-filter-period" class="h-8 py-0 leading-[30px] px-2 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs cursor-pointer box-border" title="${isKm ? 'ជ្រើសរើសសម័យប្រឡងដើម្បីទាញយកពិន្ទុ' : 'Select score period'}">
              <optgroup label="${isKm ? 'ខែសិក្សា' : 'Months'}">
                ${months.map(m => `<option value="${m.id}" ${m.id === selectedPeriod ? 'selected' : ''}>${isKm ? m.nameKm : m.nameEn}</option>`).join('')}
              </optgroup>
              <optgroup label="${isKm ? 'ការប្រឡង និងឆមាស' : 'Exams'}">
                ${exams.map(e => `<option value="${e.id}" ${e.id === selectedPeriod ? 'selected' : ''}>${isKm ? e.nameKm : e.nameEn}</option>`).join('')}
              </optgroup>
            </select>
          </div>

          <!-- Date Picker Popover -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'កាលបរិច្ឆេទ:' : 'Date:'}</span>
            <div id="rv-result-date-container" class="relative">
              <button type="button" 
                      id="rv-result-btn-date-trigger" 
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[125px] max-w-[170px] box-border" 
                      title="${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ (ចន្ទគតិ & សុរិយគតិ)' : 'Select Date'}">
                <span class="flex items-center gap-1.5 truncate">
                  ${getIcon('calendar', 'w-3.5 h-3.5 text-primary flex-shrink-0')}
                  <span id="rv-result-date-trigger-text" class="truncate">${formatDisplayDate(selectedReportDate.toISOString().split('T')[0])}</span>
                </span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-result-date-chevron')}
              </button>

              <div id="rv-result-popover-date-menu" 
                   class="hidden absolute right-0 top-[calc(100%+4px)] z-[80] w-80 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-3 font-khmer select-none animate-slide-down box-border">
                <div class="flex items-center justify-between border-b border-border/50 pb-2">
                  <span class="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    ${getIcon('calendar', 'w-4 h-4 text-primary')}
                    <span>${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ' : 'Select Date'}</span>
                  </span>
                  <button type="button" 
                          id="rv-result-btn-date-today" 
                          class="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                    ${isKm ? 'ថ្ងៃនេះ' : 'Today'}
                  </button>
                </div>

                <div class="space-y-1">
                  <label class="text-[11px] text-muted-foreground">${isKm ? 'កាលបរិច្ឆេទសុរិយគតិ:' : 'Solar Date:'}</label>
                  <input type="date" 
                         id="rv-result-input-report-date" 
                         value="${selectedReportDate.toISOString().split('T')[0]}"
                         class="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border cursor-pointer" />
                </div>

                <div class="space-y-2 pt-1">
                  <div class="p-2.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-primary font-semibold">
                      <span>${isKm ? 'ចន្ទគតិ' : 'Khmer Lunar Date'}</span>
                      ${getIcon('moon', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-result-preview-lunar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${formatKhmerLunarDate(selectedReportDate)}
                    </p>
                  </div>
                  <div class="p-2.5 rounded-lg border border-border/60 bg-muted/30 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                      <span>${isKm ? 'សុរិយគតិ' : 'Khmer Solar Date'}</span>
                      ${getIcon('sun', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-result-preview-solar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(selectedReportDate)}
                    </p>
                  </div>
                </div>

                <button type="button" 
                        id="rv-result-btn-date-apply" 
                        class="w-full h-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer">
                  ${getIcon('check', 'w-3.5 h-3.5')}
                  <span>${isKm ? 'យល់ព្រម (Apply)' : 'Apply'}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Header Color Tool Popover -->
          <div class="relative flex items-center font-khmer" id="rv-result-header-color-container">
            <button type="button"
                    id="rv-result-btn-header-color"
                    class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer select-none box-border"
                    title="${isKm ? 'ប្តូរពណ៌ក្បាលតារាង' : 'Change Table Header Color'}">
              <span id="rv-result-header-color-dot" class="w-3.5 h-3.5 rounded-full border border-black/20 flex-shrink-0" style="background-color: ${escapeHtml(headerBgColor)};"></span>
              <span class="whitespace-nowrap">${isKm ? 'ពណ៌ក្បាលតារាង' : 'Header Color'}</span>
              ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-result-header-color-chevron')}
            </button>

            <div id="rv-result-popover-header-color"
                 class="hidden absolute right-0 top-[calc(100%+4px)] z-[80] w-64 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2.5 font-khmer select-none animate-slide-down box-border">
              <div class="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span class="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  ${getIcon('paintBucket', 'w-3.5 h-3.5 text-primary')}
                  <span>${isKm ? 'ពណ៌ក្បាលតារាង' : 'Table Header Color'}</span>
                </span>
                <button type="button"
                        id="rv-result-btn-header-color-reset"
                        class="px-2 py-0.5 rounded text-[11px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  ${isKm ? 'ដើមវិញ' : 'Reset'}
                </button>
              </div>

              <div class="space-y-1">
                <div class="text-[10px] text-muted-foreground font-medium">${isKm ? 'ជ្រើសរើសពណ៌ (Presets):' : 'Color Presets:'}</div>
                <div class="grid grid-cols-4 gap-1.5">
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #0045ff;" data-color="#0045ff" title="Royal Blue">Blue</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #0284c7;" data-color="#0284c7" title="Sky Blue">Sky</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #059669;" data-color="#059669" title="Emerald">Green</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #0f766e;" data-color="#0f766e" title="Teal">Teal</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #7c3aed;" data-color="#7c3aed" title="Purple">Purple</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #e11d48;" data-color="#e11d48" title="Rose">Rose</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #d97706;" data-color="#d97706" title="Amber">Amber</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-white cursor-pointer" style="background-color: #1e293b;" data-color="#1e293b" title="Dark Slate">Dark</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-slate-800 cursor-pointer" style="background-color: #dbeafe;" data-color="#dbeafe" title="Soft Blue">Soft Blue</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-slate-800 cursor-pointer" style="background-color: #dcfce7;" data-color="#dcfce7" title="Soft Green">Soft Grn</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-slate-800 cursor-pointer" style="background-color: #e2e8f0;" data-color="#e2e8f0" title="Light Gray">Gray</button>
                  <button type="button" class="rv-result-header-color-swatch h-7 rounded border border-border flex items-center justify-center hover:ring-2 hover:ring-primary text-[10px] font-bold text-slate-800 cursor-pointer" style="background-color: #ffffff;" data-color="#ffffff" title="White">White</button>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-border/60">
                <span class="text-xs text-muted-foreground">${isKm ? 'ពណ៌ផ្ទាល់ខ្លួន:' : 'Custom Color:'}</span>
                <input type="color" id="rv-result-input-header-color" value="${escapeHtml(headerBgColor)}" class="w-8 h-7 rounded border border-border p-0.5 cursor-pointer bg-transparent" />
              </div>
            </div>
          </div>

          <!-- Export Excel Button -->
          <button type="button" 
                  id="rv-btn-result-export-excel" 
                  class="h-8 py-0 leading-[30px] px-3 rounded-md border border-input bg-card hover:bg-muted text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors flex items-center gap-1.5 font-khmer shadow-xs cursor-pointer select-none box-border"
                  title="${isKm ? 'ទាញយកតារាងលទ្ធផលជា Excel' : 'Export Result Table to Excel'}">
            ${getIcon('fileSpreadsheet', 'w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400')}
            <span>Excel</span>
          </button>
        `;

        // School select binding
        const schoolSelect = controlsContainer.querySelector('#rv-result-filter-school');
        schoolSelect?.addEventListener('change', async (e) => {
          schoolName = e.target.value;
          const matched = allSchools.find(s => s.name === schoolName);
          if (matched && matched.province) {
            schoolProvince = matched.province;
          }
          if (viewer) await viewer.refreshContent(false);
        });

        // Class select binding
        const classSelect = controlsContainer.querySelector('#rv-result-filter-class');
        classSelect?.addEventListener('change', async (e) => {
          selectedClassId = e.target.value;
          if (viewer) await viewer.refreshContent(false);
        });

        // Period select binding
        const periodSelect = controlsContainer.querySelector('#rv-result-filter-period');
        periodSelect?.addEventListener('change', async (e) => {
          selectedPeriod = e.target.value;
          if (viewer) await viewer.refreshContent(false);
        });

        // Academic Year Popover
        const yearTriggerBtn = controlsContainer.querySelector('#rv-btn-result-year-trigger');
        const yearTriggerText = controlsContainer.querySelector('#rv-result-year-text');
        const yearChevron = controlsContainer.querySelector('.rv-result-year-chevron');
        const yearMenu = controlsContainer.querySelector('#rv-popover-result-year-menu');
        const yearListEl = controlsContainer.querySelector('#rv-result-year-list');
        const yearInputEl = controlsContainer.querySelector('#rv-input-result-new-year');
        const yearAddBtn = controlsContainer.querySelector('#rv-btn-result-add-year');

        const renderYearList = () => {
          if (!yearListEl) return;
          yearListEl.innerHTML = academicYears.map(y => {
            const yName = typeof y === 'string' ? y : (y.name || y.id || '');
            const isSelected = String(selectedYear).trim().toLowerCase() === String(yName).trim().toLowerCase();
            return `
              <div class="rv-year-item flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent text-xs group cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}" data-year="${escapeHtml(yName)}">
                <span class="truncate flex-1">${escapeHtml(yName)}</span>
              </div>
            `;
          }).join('');
        };
        renderYearList();

        yearTriggerBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = yearMenu?.classList.contains('hidden');
          if (isHidden) {
            yearMenu?.classList.remove('hidden');
            yearChevron?.classList.add('rotate-180');
          } else {
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
          }
        });

        yearListEl?.addEventListener('click', async (e) => {
          const item = e.target.closest('.rv-year-item');
          if (item && item.dataset.year) {
            selectedYear = item.dataset.year;
            if (yearTriggerText) yearTriggerText.textContent = selectedYear;
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            renderYearList();
            if (viewer) await viewer.refreshContent(false);
          }
        });

        yearAddBtn?.addEventListener('click', async () => {
          const val = (yearInputEl?.value || '').trim();
          if (!val) return;
          try {
            const created = await SettingsService.createAcademicYear({ name: val });
            academicYears = await SettingsService.getAcademicYears() || [];
            selectedYear = created?.name || val;
            if (yearInputEl) yearInputEl.value = '';
            if (yearTriggerText) yearTriggerText.textContent = selectedYear;
            renderYearList();
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            if (viewer) await viewer.refreshContent(false);
            toast.success(isKm ? 'បានបន្ថែមឆ្នាំសិក្សាដោយជោគជ័យ' : 'Academic year added');
          } catch (err) {
            toast.error(err.message || String(err));
          }
        });

        // Date Picker Popover
        const dateBtn = controlsContainer.querySelector('#rv-result-btn-date-trigger');
        const dateMenu = controlsContainer.querySelector('#rv-result-popover-date-menu');
        const dateChevron = controlsContainer.querySelector('.rv-result-date-chevron');
        const dateInput = controlsContainer.querySelector('#rv-result-input-report-date');
        const dateText = controlsContainer.querySelector('#rv-result-date-trigger-text');
        const previewLunar = controlsContainer.querySelector('#rv-result-preview-lunar-text');
        const previewSolar = controlsContainer.querySelector('#rv-result-preview-solar-text');
        const todayBtn = controlsContainer.querySelector('#rv-result-btn-date-today');
        const applyBtn = controlsContainer.querySelector('#rv-result-btn-date-apply');

        const updateDateDisplay = (d) => {
          if (!d) return;
          if (dateText) dateText.textContent = formatDisplayDate(d.toISOString().split('T')[0]);
          if (previewLunar) previewLunar.textContent = formatKhmerLunarDate(d);
          if (previewSolar) previewSolar.textContent = `${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(d)}`;
          if (dateInput) dateInput.value = d.toISOString().split('T')[0];
        };

        dateBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = dateMenu?.classList.contains('hidden');
          if (isHidden) {
            dateMenu?.classList.remove('hidden');
            dateChevron?.classList.add('rotate-180');
          } else {
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          }
        });

        dateInput?.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val) {
            selectedReportDate = new Date(val);
            updateDateDisplay(selectedReportDate);
          }
        });

        todayBtn?.addEventListener('click', () => {
          selectedReportDate = new Date();
          updateDateDisplay(selectedReportDate);
        });

        applyBtn?.addEventListener('click', async () => {
          dateMenu?.classList.add('hidden');
          dateChevron?.classList.remove('rotate-180');
          const docLunar = viewer?.overlay?.querySelector('#score-result-lunar-date');
          const docSolar = viewer?.overlay?.querySelector('#score-result-solar-date');
          if (docLunar) docLunar.textContent = formatKhmerLunarDate(selectedReportDate);
          if (docSolar) docSolar.textContent = `${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(selectedReportDate)}`;
          viewer?.saveStateForUndo?.();
          toast.success(isKm ? 'បានកំណត់កាលបរិច្ឆេទដោយជោគជ័យ' : 'Date applied successfully');
        });

        // Header Color Popover & Live Application
        const headerColorBtn = controlsContainer.querySelector('#rv-result-btn-header-color');
        const headerColorMenu = controlsContainer.querySelector('#rv-result-popover-header-color');
        const headerColorChevron = controlsContainer.querySelector('.rv-result-header-color-chevron');
        const headerColorDot = controlsContainer.querySelector('#rv-result-header-color-dot');
        const headerColorInput = controlsContainer.querySelector('#rv-result-input-header-color');
        const headerColorResetBtn = controlsContainer.querySelector('#rv-result-btn-header-color-reset');

        const applyHeaderColorToReport = (newColor) => {
          if (!newColor) return;
          headerBgColor = newColor;
          try {
            localStorage.setItem('score_result_2row_header_bg', headerBgColor);
          } catch (_) {}
          if (viewer) {
            viewer.savedHeaderBgColor = headerBgColor;
          }
          if (headerColorDot) headerColorDot.style.backgroundColor = headerBgColor;
          if (headerColorInput) headerColorInput.value = headerBgColor;

          const fgColor = getContrastTextColor(headerBgColor);
          const tables = viewer?.overlay?.querySelectorAll('#score-result-left-table, #score-result-right-table') || [];
          tables.forEach(tbl => {
            tbl.querySelectorAll('thead tr').forEach(tr => {
              tr.style.setProperty('background-color', headerBgColor, 'important');
              tr.style.setProperty('color', fgColor, 'important');
            });
            tbl.querySelectorAll('thead th').forEach(th => {
              if (th.dataset.subHeader === 'true') return;
              th.style.setProperty('background-color', headerBgColor, 'important');
              th.style.setProperty('color', fgColor, 'important');
              th.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
              th.style.setProperty('print-color-adjust', 'exact', 'important');
            });
          });
          viewer?.saveStateForUndo?.();
          viewer?.autoSaveIfEnabled?.();
        };

        headerColorBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = headerColorMenu?.classList.contains('hidden');
          if (isHidden) {
            headerColorMenu?.classList.remove('hidden');
            headerColorChevron?.classList.add('rotate-180');
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          } else {
            headerColorMenu?.classList.add('hidden');
            headerColorChevron?.classList.remove('rotate-180');
          }
        });

        controlsContainer.querySelectorAll('.rv-result-header-color-swatch').forEach(sw => {
          sw.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const c = sw.dataset.color;
            if (c) applyHeaderColorToReport(c);
          });
        });

        headerColorInput?.addEventListener('input', (e) => {
          applyHeaderColorToReport(e.target.value);
        });

        headerColorResetBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          applyHeaderColorToReport('#0045ff');
        });

        // Click outside dismiss
        document.addEventListener('click', (e) => {
          if (!controlsContainer.contains(e.target)) {
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
            headerColorMenu?.classList.add('hidden');
            headerColorChevron?.classList.remove('rotate-180');
          }
        });
      },
      renderContent: async (contentContainer, viewer) => {
        contentContainer.innerHTML = `
          <div class="py-12 flex items-center justify-center gap-2 text-muted-foreground text-xs font-khmer">
            <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <span>${isKm ? 'កំពុងទាញយកទិន្នន័យពិន្ទុ និងអវត្តមាន...' : 'Loading score data...'}</span>
          </div>
        `;

        // 1. Fetch Class Details
        const foundClass = classes.find(c => String(c.id).trim() === String(selectedClassId).trim());
        currentClassName = foundClass ? (foundClass.name || foundClass.grade || '—') : (selectedClassId || '—');
        const periodDisplayName = getPeriodDisplayName(selectedPeriod) || '.........................';
        const reportTitleText = getResultReportTitle(selectedPeriod);

        // 2. Fetch Master Score Sheet Data
        const scoreData = await ScoreService.getMasterScoreSheet({
          classId: selectedClassId,
          academicYear: selectedYear,
          period: selectedPeriod
        });

        // 3. Filter Active Students Only (Excludes Inactive & Dropout Students)
        let activeRows = (scoreData.rows || []).filter(isStudentActive);

        // 4. Ensure Student Ranks are calculated
        ScoreService.rankStudents(activeRows);

        // 5. SORT BY RANK ASCENDING: Rank #1 is at top, then next rank in ascending order
        activeRows.sort((a, b) => {
          const rA = Number(a.rank) || 9999;
          const rB = Number(b.rank) || 9999;
          if (rA !== rB) return rA - rB;
          const tA = Number(a.total) || 0;
          const tB = Number(b.total) || 0;
          if (tA !== tB) return tB - tA;
          return (a.khmerFullName || '').localeCompare(b.khmerFullName || '', 'km');
        });

        // 6. Fetch Attendance Records to Compute Absences (អវត្តមាន: មានច្បាប់, ឥតច្បាប់, សរុប)
        let allAtt = [];
        try {
          allAtt = await db.getAll('attendance');
        } catch (_) {}

        const MONTH_NUM_MAP = {
          'January': 1, 'February': 2, 'March': 3, 'April': 4,
          'May': 5, 'June': 6, 'July': 7, 'August': 8,
          'September': 9, 'October': 10, 'November': 11, 'December': 12
        };
        const targetMonthNum = MONTH_NUM_MAP[selectedPeriod];

        const attMap = new Map();
        allAtt.forEach(att => {
          if (att.classId !== selectedClassId) return;
          if (targetMonthNum) {
            if (!att.date) return;
            const d = new Date(att.date);
            if (d.getMonth() + 1 !== targetMonthNum) return;
          }
          const current = attMap.get(att.studentId) || { excused: 0, unexcused: 0, total: 0 };
          const st = String(att.status || '').trim();
          if (st === 'Excused' || st === 'មានច្បាប់') {
            current.excused++;
            current.total++;
          } else if (st === 'Absent' || st === 'ឥតច្បាប់') {
            current.unexcused++;
            current.total++;
          }
          attMap.set(att.studentId, current);
        });

        // 7. Bind Excel Export Handler for Header Controls
        const btnExcel = viewer?.overlay?.querySelector('#rv-btn-result-export-excel');
        if (btnExcel) {
          btnExcel.onclick = async () => {
            const ExcelJS = window.ExcelJS || globalThis.ExcelJS;
            const exportHeaders = ['ល.រ', 'អត្តលេខ', 'គោត្តនាម និងនាម', 'ភេទ', 'មធ្យមភាគ', 'ចំណាត់ថ្នាក់', 'និទ្ទេស', 'ច្បាប់', 'ឥតច្បាប់', 'អវត្តមានសរុប'];

            if (ExcelJS) {
              const wb = new ExcelJS.Workbook();
              const ws = wb.addWorksheet(isKm ? 'តារាងលទ្ធផល' : 'Result Table', {
                pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
                views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
              });

              const r1 = ws.addRow([reportTitleText]);
              r1.height = 26;
              ws.mergeCells(1, 1, 1, exportHeaders.length);
              r1.getCell(1).font = { name: 'Khmer OS Muol Light', size: 12, bold: false, color: { argb: 'FF0F172A' } };
              r1.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

              const r2 = ws.addRow([`សាលារៀន: ${schoolName} / ${schoolProvince}   |   ថ្នាក់ទី: ${currentClassName}   |   ឆ្នាំសិក្សា: ${selectedYear}`]);
              r2.height = 22;
              ws.mergeCells(2, 1, 2, exportHeaders.length);
              r2.getCell(1).font = { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF475569' } };
              r2.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

              ws.addRow([]);

              const hRow = ws.addRow(exportHeaders);
              hRow.height = 30;
              const curHeaderHex = (localStorage.getItem('score_result_2row_header_bg') || headerBgColor || '#0045ff').replace('#', '').toUpperCase();
              const curHeaderBgArgb = curHeaderHex.length === 6 ? `FF${curHeaderHex}` : 'FF0045FF';
              const curHeaderFgArgb = getContrastTextColor(`#${curHeaderHex}`) === '#000000' ? 'FF0F172A' : 'FFFFFFFF';
              hRow.eachCell((cell, colNum) => {
                let cellBgArgb = curHeaderBgArgb;
                let cellFgArgb = curHeaderFgArgb;
                if (colNum === 8) {
                  cellBgArgb = 'FF0284C7';
                  cellFgArgb = 'FFFFFFFF';
                } else if (colNum === 9) {
                  cellBgArgb = 'FFE11D48';
                  cellFgArgb = 'FFFFFFFF';
                } else if (colNum === 10) {
                  cellBgArgb = 'FF7C3AED';
                  cellFgArgb = 'FFFFFFFF';
                }
                cell.font = { name: 'Khmer OS Siemreap', size: 11, bold: true, color: { argb: cellFgArgb } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellBgArgb } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                  top: { style: 'medium', color: { argb: 'FF94A3B8' } },
                  bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
                  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                  right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
              });

              activeRows.forEach((r, idx) => {
                const att = attMap.get(r.studentId) || { excused: 0, unexcused: 0, total: 0 };
                const isFemale = r.gender === 'Female' || r.gender === 'ស្រី';
                const rowVals = [
                  idx + 1,
                  r.studentNumber || r.studentId || '',
                  r.khmerFullName || `${r.lastNameKh || ''} ${r.firstNameKh || ''}`.trim() || '',
                  isFemale ? 'ស្រី' : 'ប្រុស',
                  Number((Number(r.average) || 0).toFixed(2)),
                  r.rank || (idx + 1),
                  r.grade || 'F',
                  att.excused || 0,
                  att.unexcused || 0,
                  att.total || 0
                ];
                const dRow = ws.addRow(rowVals);
                dRow.height = 23;
                const isEven = idx % 2 === 1;
                dRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
                  let bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
                  let fgArgb = 'FF0F172A';
                  let isBold = colNum >= 3;

                  if (colNum === 4) {
                    fgArgb = isFemale ? 'FFE11D48' : 'FF0284C7';
                  } else if (colNum === 5) {
                    fgArgb = 'FF1D4ED8';
                    cell.numFmt = '0.00';
                  } else if (colNum === 6) {
                    fgArgb = 'FFDC2626';
                  } else if (colNum === 7) {
                    const gStyle = this.getExcelGradeStyle(rowVals[6]);
                    bgArgb = gStyle.fill;
                    fgArgb = gStyle.text;
                  } else if (colNum === 8) {
                    fgArgb = 'FF0284C7';
                  } else if (colNum === 9) {
                    fgArgb = 'FFE11D48';
                  } else if (colNum === 10) {
                    fgArgb = 'FF7C3AED';
                  }

                  cell.font = { name: 'Khmer OS Siemreap', size: 10.5, bold: isBold, color: { argb: fgArgb } };
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                  cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'left' : 'center' };
                  cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                  };
                });
              });

              const colWidths = [7, 13, 24, 9, 12, 12, 10, 10, 10, 13];
              ws.columns.forEach((col, i) => {
                col.width = colWidths[i] || 12;
              });

              await this.saveExcelWorkbook(wb, `Result_Table_${currentClassName}_${selectedPeriod}.xlsx`);
            } else {
              const exportData = activeRows.map((r, idx) => {
                const att = attMap.get(r.studentId) || { excused: 0, unexcused: 0, total: 0 };
                return [
                  idx + 1,
                  r.studentNumber || r.studentId || '',
                  r.khmerFullName || `${r.lastNameKh || ''} ${r.firstNameKh || ''}`.trim() || '',
                  (r.gender === 'Female' || r.gender === 'ស្រី') ? 'ស្រី' : 'ប្រុស',
                  Number(r.average || 0).toFixed(2),
                  r.rank || (idx + 1),
                  r.grade || '',
                  att.excused || 0,
                  att.unexcused || 0,
                  att.total || 0
                ];
              });

              const ws = XLSX.utils.aoa_to_sheet([
                [reportTitleText],
                [`សាលារៀន: ${schoolName} / ${schoolProvince}`],
                [`ថ្នាក់ទី: ${currentClassName} | ឆ្នាំសិក្សា: ${selectedYear}`],
                [],
                exportHeaders,
                ...exportData
              ]);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, isKm ? 'តារាងលទ្ធផល' : 'Result Table');
              XLSX.writeFile(wb, `Result_Table_${currentClassName}_${selectedPeriod}.xlsx`);
            }
            toast.success(isKm ? 'បានទាញយក Excel ដោយជោគជ័យ' : 'Excel exported successfully');
          };
        }

        // 8. Row HTML Builder (Columns: ល.រ, អត្តលេខ, គោត្តនាម និងនាម, ភេទ, មធ្យមភាគ, ចំណាត់ថ្នាក់, និទ្ទេស, មានច្បាប់, ឥតច្បាប់, សរុប)
        const buildRow = (r, idx) => {
          const rowNum = idx + 1;
          const studentCode = r.studentNumber || r.studentId || '';
          const fullName = r.khmerFullName || `${r.lastNameKh || ''} ${r.firstNameKh || ''}`.trim() || '—';
          const isFemale = r.gender === 'Female' || r.gender === 'ស្រី';
          const genderText = isFemale ? 'ស្រី' : 'ប្រុស';
          const avgNum = typeof r.average === 'number' ? r.average : Number(r.average || 0);
          const avgText = avgNum.toFixed(2);
          const rankText = (r.rank !== undefined && r.rank !== null && r.rank !== '') ? r.rank : (idx + 1);
          const gradeText = r.grade || '—';
          const att = attMap.get(r.studentId) || { excused: 0, unexcused: 0, total: 0 };
          const excusedText = Number(att.excused || 0);
          const unexcusedText = Number(att.unexcused || 0);
          const totalAbsText = Number(att.total || 0);

          return `
            <tr class="score-sheet-row hover:bg-muted/30 border-b border-border/50 text-[8px]" data-student-id="${r.studentId}">
              <td class="px-0.5 py-1 text-center font-mono font-medium border border-black select-none whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important;">${rowNum}</td>
              <td class="px-0.5 py-1 text-center font-mono border border-black select-none whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important;">${studentCode}</td>
              <td class="px-1 py-1 text-left font-khmer border border-black truncate" style="border: 1px solid #000000 !important; padding: 2.5px 2px !important; vertical-align: middle !important;" title="${fullName}">${fullName}</td>
              <td class="px-0.5 py-1 text-center font-khmer border border-black whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important;">${genderText}</td>
              <td class="px-0.5 py-1 text-center font-mono font-bold border border-black whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important;">${avgText}</td>
              <td class="px-0.5 py-1 text-center font-mono font-bold border border-black whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important; color: #dc2626 !important;">${rankText}</td>
              <td class="px-0.5 py-1 text-center font-bold border border-black whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important;">${gradeText}</td>
              <td class="px-0.5 py-1 text-center font-mono font-bold border border-black whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important; color: #0284c7 !important;">${excusedText}</td>
              <td class="px-0.5 py-1 text-center font-mono font-bold border border-black whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important; color: #e11d48 !important;">${unexcusedText}</td>
              <td class="px-0.5 py-1 text-center font-mono font-bold border border-black whitespace-nowrap" style="border: 1px solid #000000 !important; padding: 2.5px 1px !important; vertical-align: middle !important; color: #7c3aed !important;">${totalAbsText}</td>
            </tr>
          `;
        };

        // 9. Split into Dual Columns (Left Table & Right Table side-by-side)
        const halfCount = Math.max(1, Math.ceil(activeRows.length / 2));
        const leftStudents = activeRows.slice(0, halfCount);
        const rightStudents = activeRows.slice(halfCount);

        const leftRowsHtml = leftStudents.length === 0 ? `
          <tr class="border-b border-border/50">
            <td colspan="10" class="py-6 text-center text-muted-foreground italic border border-black text-[9px]" style="border: 1px solid #000000 !important; padding: 6px !important;">
              ${isKm ? 'គ្មានទិន្នន័យសិស្សទេ' : 'No student data'}
            </td>
          </tr>
        ` : leftStudents.map((r, idx) => buildRow(r, idx)).join('');

        const rightRowsHtml = rightStudents.map((r, idx) => buildRow(r, halfCount + idx)).join('');

        // 10. Two-Level Table Header Matching User Specification (Compact Height & Customizable Header Color)
        const activeHeaderBg = localStorage.getItem('score_result_2row_header_bg') || viewer?.savedHeaderBgColor || headerBgColor || '#0045ff';
        headerBgColor = activeHeaderBg;
        const activeHeaderFg = getContrastTextColor(activeHeaderBg);
        const theadHtml = `
          <tr style="height: 13px !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 7.5px !important; line-height: 1.05 !important;">
            <th rowspan="2" class="text-center whitespace-nowrap" style="height: 25px !important; width: 5% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;">ល.រ</th>
            <th rowspan="2" class="text-center whitespace-nowrap" style="height: 25px !important; width: 7.5% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;">អត្តលេខ</th>
            <th rowspan="2" class="text-center whitespace-nowrap" style="height: 25px !important; width: 23% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;">គោត្តនាម និងនាម</th>
            <th rowspan="2" class="text-center whitespace-nowrap" style="height: 25px !important; width: 5.5% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;">ភេទ</th>
            <th rowspan="2" class="text-center whitespace-nowrap" style="height: 25px !important; width: 12% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;">មធ្យមភាគ</th>
            <th rowspan="2" class="text-center whitespace-nowrap" style="height: 25px !important; width: 6.5% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;" title="${isKm ? 'ចំណាត់ថ្នាក់' : 'Rank'}">ចំ.</th>
            <th rowspan="2" class="text-center whitespace-nowrap" style="height: 25px !important; width: 9.5% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;">និទ្ទេស</th>
            <th colspan="3" class="text-center whitespace-nowrap" style="height: 13px !important; width: 31% !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; border: 1px solid #000000 !important; padding: 1px 0.5px !important; line-height: 1.05 !important; vertical-align: middle !important;">អវត្តមាន</th>
          </tr>
          <tr style="height: 12px !important; background-color: ${activeHeaderBg} !important; color: ${activeHeaderFg} !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 7px !important; line-height: 1.0 !important;">
            <th data-sub-header="true" class="text-center whitespace-nowrap" style="height: 12px !important; width: 10.5% !important; background-color: #0284c7 !important; color: #ffffff !important; border: 1px solid #000000 !important; padding: 0.5px 0.5px !important; line-height: 1.0 !important; vertical-align: middle !important;">ច្បាប់</th>
            <th data-sub-header="true" class="text-center whitespace-nowrap" style="height: 12px !important; width: 10.5% !important; background-color: #e11d48 !important; color: #ffffff !important; border: 1px solid #000000 !important; padding: 0.5px 0.5px !important; line-height: 1.0 !important; vertical-align: middle !important;">ឥតច្បាប់</th>
            <th data-sub-header="true" class="text-center whitespace-nowrap" style="height: 12px !important; width: 10% !important; background-color: #7c3aed !important; color: #ffffff !important; border: 1px solid #000000 !important; padding: 0.5px 0.5px !important; line-height: 1.0 !important; vertical-align: middle !important;">សរុប</th>
          </tr>
        `;

        // 11. Merge into saved template if exists
        if (viewer && (viewer.savedHtmlContent || viewer.savedHtml)) {
          try {
            const staging = document.createElement('div');
            staging.innerHTML = viewer.savedHtmlContent || viewer.savedHtml;

            const leftTable = staging.querySelector('#score-result-left-table');
            const rightTable = staging.querySelector('#score-result-right-table');

            if (leftTable && rightTable) {
              const leftThead = leftTable.querySelector('thead');
              if (leftThead) leftThead.innerHTML = theadHtml;
              const rightThead = rightTable.querySelector('thead');
              if (rightThead) rightThead.innerHTML = theadHtml;

              const leftTbody = leftTable.querySelector('tbody');
              const rightTbody = rightTable.querySelector('tbody');
              if (leftTbody) leftTbody.innerHTML = leftRowsHtml;
              if (rightTbody) rightTbody.innerHTML = rightRowsHtml;

              const periodLabel = staging.querySelector('#score-result-period-label');
              if (periodLabel) {
                const parentH2 = periodLabel.closest('h2');
                if (parentH2) {
                  Array.from(parentH2.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
                  });
                }
                periodLabel.textContent = reportTitleText;
              }
              const classLabel = staging.querySelector('#score-result-class-label');
              if (classLabel) classLabel.textContent = currentClassName;
              const yearLabel = staging.querySelector('#score-result-year-label');
              if (yearLabel) yearLabel.textContent = selectedYear;

              contentContainer.innerHTML = staging.innerHTML;
              return;
            }
          } catch (e) {
            console.warn('Error merging saved result template:', e);
          }
        }

        // 12. Full Paper Sheet Document Layout
        contentContainer.innerHTML = `
          <div class="moeys-report-document score-sheet-container max-w-full mx-auto space-y-2 text-[9px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9px !important; box-sizing: border-box !important; width: 100% !important;">
            <!-- Top Header Section -->
            <div class="flex items-start justify-between font-khmer select-none leading-tight text-[10px]" style="font-size: 10px !important;">
              <!-- Top Left: School Name -->
              <div class="text-left space-y-0.5">
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;"><span class="report-nudge-box" style="display: inline-block; position: relative; left: 0px; top: 15px;">${schoolName}</span></p>
              </div>

              <!-- Top Right: Royal Motto -->
              <div class="text-center space-y-0.5">
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;">ព្រះរាជាណាចក្រកម្ពុជា</p>
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
                <div class="flex justify-center text-muted-foreground font-serif pt-0.5" style="font-size: 9px !important;">~ ~ ~ 🙞 🙞 🙞 ~ ~ ~</div>
              </div>
            </div>

            <!-- Center Title Section -->
            <div class="text-center space-y-1 pt-1 pb-1 font-khmer text-[10px]">
              <h2 id="score-result-title-heading" class="font-khmer-muol text-foreground" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 12px !important; font-weight: 400 !important; letter-spacing: normal !important; line-height: 2.0 !important; text-decoration: none !important;">
                <span id="score-result-period-label" contenteditable="true" spellcheck="false" class="font-khmer-muol outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 cursor-text" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-weight: 400 !important; line-height: 2.0 !important;" title="${isKm ? 'ចុចទីនេះដើម្បីកែប្រែ' : 'Click to edit'}">${escapeHtml(reportTitleText)}</span>
              </h2>
              
              <!-- Meta Row: Class & Academic Year -->
              <div class="flex items-center justify-center flex-wrap gap-x-6 gap-y-1 text-[9.5px] font-khmer text-foreground pt-0.5" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif;">
                <div class="whitespace-nowrap">
                  <span>ថ្នាក់ទី៖ </span>
                  <span id="score-result-class-label" class="font-bold">${currentClassName}</span>
                </div>
                <div class="whitespace-nowrap">
                  <span>ឆ្នាំសិក្សា៖ </span>
                  <span id="score-result-year-label" class="font-bold">${selectedYear}</span>
                </div>
              </div>
            </div>

            <!-- Dual-Column Side-by-Side Table Layout -->
            <div class="score-sheet-dual-grid grid grid-cols-2 gap-2 w-full max-w-full box-border">
              <!-- Left Table (Column 1) -->
              <div class="w-full max-w-full min-w-0 box-border">
                <table id="score-result-left-table" class="score-result-2row-table moeys-table border-collapse text-[8px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 8px !important; width: 100% !important; table-layout: fixed !important; border: 1px solid #000000 !important;">
                  <thead>${theadHtml}</thead>
                  <tbody style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 8px !important;">${leftRowsHtml}</tbody>
                </table>
              </div>

              <!-- Right Table (Column 2) -->
              <div class="w-full max-w-full min-w-0 box-border">
                <table id="score-result-right-table" class="score-result-2row-table moeys-table border-collapse text-[8px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 8px !important; width: 100% !important; table-layout: fixed !important; border: 1px solid #000000 !important;">
                  <thead>${theadHtml}</thead>
                  <tbody style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 8.5px !important;">${rightRowsHtml}</tbody>
                </table>
              </div>
            </div>

            <!-- Footer Signatures & Date Block -->
            <div class="mt-5 pt-2 grid grid-cols-2 gap-8 font-khmer text-[9.5px] text-center select-none" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important;">
              <!-- Bottom Left: Principal Approval -->
              <div class="flex flex-col items-center justify-between min-h-[95px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important;">
                <div class="space-y-1" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important;">
                  <p class="font-normal" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important; color: #000000 !important;">បានឃើញ និងឯកភាព</p>
                  <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 9.5px !important; line-height: 1.8; color: #000000 !important;">នាយក</p>
                </div>
                <div class="h-10 w-36 mx-auto"></div>
              </div>

              <!-- Bottom Right: Class Teacher Signature -->
              <div class="flex flex-col items-center justify-between min-h-[95px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important;">
                <div class="space-y-0.5" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important;">
                  <p id="score-result-lunar-date" class="font-normal text-foreground text-[9.5px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important; color: #000000 !important;">${formatKhmerLunarDate(selectedReportDate)}</p>
                  <p id="score-result-solar-date" class="font-medium text-foreground text-[9.5px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important; font-weight: 500 !important; color: #000000 !important;">${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(selectedReportDate)}</p>
                  <p class="font-bold pt-1 text-foreground" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 9.5px !important; font-weight: 700 !important; color: #000000 !important;"><b>គ្រូបន្ទុកថ្នាក់</b></p>
                </div>
                <div class="h-10 w-36 mx-auto"></div>
              </div>
            </div>
          </div>
        `;
      }
    });
  },

  /**
   * Open Top 5 Monthly Honor Roll (តារាងកិត្តិយស) in ReportViewer
   * Matches traditional Cambodian school Honor Roll poster/certificate design:
   * - Ornate red corner flourishes & border frame
   * - School crest + Khmer & English school names (top-left) and Royal Motto (top-right)
   * - Curved 3D-outlined "តារាងកិត្តិយស" title + Month, Academic Year, and Class subtitles
   * - 3-tier pyramid of Top 5 ranked students (1 top-center, 2 mid-left, 3 mid-right, 5 bottom-left, 4 bottom-right)
   * - Sky-blue portrait frames (click-to-upload student photo) + ornate blue/gold Khmer name plaques
   * - Khmer Lunar + Solar dates & Principal / Class Teacher signature blocks
   */
  async openHonorRollTop5Modal() {
    const isKm = i18n.getLocale() === 'km';
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();
    const currentUser = authService.getCurrentUser();

    let classes = [];
    try {
      classes = await ClassService.getAll();
    } catch (_) {}
    if (!classes || classes.length === 0) {
      classes = this.state?.classes || [];
    }

    let academicYears = [];
    try {
      academicYears = await SettingsService.getAcademicYears() || [];
    } catch (_) {}
    if (!academicYears || academicYears.length === 0) {
      academicYears = [{ id: 'ay-1', name: '2025–2026' }, { id: 'ay-2', name: '2024–2025' }];
    }

    let allSchools = [];
    let schoolName = '';
    let schoolProvince = 'ភ្នំពេញ';

    try {
      allSchools = await SchoolService.getAllSchools();
    } catch (_) {}
    if (!allSchools || allSchools.length === 0) {
      allSchools = [
        { name: isKm ? 'សាលាបឋមសិក្សា វត្តបូព៌' : 'Wat Bo Primary School', province: 'សៀមរាប' },
        { name: isKm ? 'អនុវិទ្យាល័យ ហ៊ុន សែន ស្វាយធំ' : 'Hun Sen Svay Thom Secondary School', province: 'សៀមរាប' }
      ];
    }

    const defaultSchoolName = currentUser?.school || (allSchools[0]?.name) || (isKm ? 'សាលារៀន អេស អេ អាយ' : 'SAI School');
    const matchedSchool = allSchools.find(s => s.name === defaultSchoolName);
    schoolName = defaultSchoolName;
    schoolProvince = matchedSchool?.province || currentUser?.province || 'ភ្នំពេញ';

    let schoolEnglishName = localStorage.getItem('honor_roll_school_en') || 'SAI School';
    let schoolLogoDataUrl = localStorage.getItem('honor_roll_school_logo') || '';

    let selectedClassId = this.state.selectedClassId || (isTeacher ? (teacherClassId || classes[0]?.id) : (classes[0]?.id || ''));
    let selectedYear = this.state.activeYear || (typeof academicYears[0] === 'string' ? academicYears[0] : (academicYears[0]?.name || '2025–2026'));
    let selectedPeriod = this.state.selectedPeriod || 'November';
    let selectedReportDate = new Date();
    let currentClassName = '';

    const periods = ScoreService.getEvaluationPeriods();
    const months = periods.filter(p => p.group === 'month');
    const exams = periods.filter(p => p.group === 'exam');

    const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

    const getPeriodDisplayName = (pId) => {
      const pObj = periods.find(p => p.id === pId);
      if (pObj) return isKm ? pObj.nameKm : pObj.nameEn;
      return pId;
    };

    const getHonorRollPeriodSubtitle = (pId) => {
      const pName = getPeriodDisplayName(pId) || 'វិច្ឆិកា';
      if (!isKm) return `For ${pName}`;
      if (pId === 'Annual') return 'ប្រចាំឆ្នាំ';
      if (pId === 'Semester 1' || pId === 'Semester 2') return `ប្រចាំ${pName}`;
      if (pId === 'Semester 1 Exam' || pId === 'Semester 2 Exam' || pId === 'First Test') return `ប្រចាំ${pName}`;
      return `ប្រចាំខែ ${pName}`;
    };

    // Helper to compress/resize uploaded image to a clean data URL
    const readAndResizeImage = (file, maxW = 420, maxH = 520) => new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, 0.9));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Default School Emblem SVG (scalloped maroon/gold/teal crest matching Cambodian school emblem)
    const getDefaultSchoolCrestSvg = (size = 64) => `
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
        <defs>
          <radialGradient id="hrCrestGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="78%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
          </radialGradient>
        </defs>
        <!-- Outer Scalloped Burgundy Border -->
        <path d="M60,4 C66,4 70,9 76,8 C82,7 87,13 92,14 C97,15 100,22 105,25 C110,28 110,35 113,40 C116,45 114,52 116,58 C116,64 113,70 113,76 C113,82 108,87 106,92 C104,97 97,100 93,104 C89,108 82,109 77,112 C72,115 65,114 60,116 C55,114 48,115 43,112 C38,109 31,108 27,104 C23,100 16,97 14,92 C12,87 7,82 7,76 C7,70 4,64 4,58 C6,52 4,45 7,40 C10,35 10,28 15,25 C20,22 23,15 28,14 C33,13 38,7 44,8 C50,9 54,4 60,4 Z" fill="#7a1c1c" stroke="#581111" stroke-width="1.5"/>
        <!-- Inner White Circle & Gold Ring -->
        <circle cx="60" cy="60" r="46" fill="url(#hrCrestGrad)" stroke="#d4af37" stroke-width="2.2"/>
        <circle cx="60" cy="60" r="37" fill="none" stroke="#7a1c1c" stroke-width="1" stroke-dasharray="2,2"/>
        <!-- Center Temple / Globe / Open Book Emblem -->
        <path d="M60,26 L75,38 L45,38 Z" fill="#0d7a52"/>
        <rect x="49" y="38" width="22" height="15" rx="1.5" fill="none" stroke="#0d7a52" stroke-width="2"/>
        <circle cx="60" cy="45.5" r="5.5" fill="none" stroke="#0d7a52" stroke-width="1.4"/>
        <!-- Open Book Rays -->
        <path d="M40,62 Q60,55 60,66 Q60,55 80,62 L77,69 Q60,62 60,71 Q60,62 43,69 Z" fill="#7a1c1c"/>
        <!-- Supportive Hands / Wreath -->
        <path d="M35,64 C35,78 47,86 60,88 C73,86 85,78 85,64" fill="none" stroke="#b91c1c" stroke-width="3" stroke-linecap="round"/>
        <text x="60" y="99" text-anchor="middle" font-family="Georgia, serif" font-size="9.5" font-weight="bold" fill="#7a1c1c">SAI</text>
      </svg>
    `;

    // Student Uniform Avatar SVG when a student doesn't have an uploaded photo yet
    const getStudentUniformSvg = (gender) => {
      const isFemale = gender === 'Female' || gender === 'ស្រី';
      if (isFemale) {
        return `
          <svg viewBox="0 0 120 140" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
            <rect width="120" height="140" fill="#0095ff"/>
            <!-- Shoulders & White School Blouse -->
            <path d="M16,140 C16,108 34,98 60,98 C86,98 104,108 104,140 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
            <!-- Sailor / Lotus Collar & Criss-Cross Tie -->
            <path d="M34,102 L60,124 L86,102 L78,97 L60,114 L42,97 Z" fill="#1e3a8a" opacity="0.85"/>
            <path d="M53,115 L67,115 L64,136 L56,136 Z" fill="#991b1b"/>
            <!-- Neck -->
            <rect x="51" y="80" width="18" height="20" rx="6" fill="#f3c6a5"/>
            <!-- Hair Behind -->
            <path d="M33,55 C30,74 34,92 40,98 L80,98 C86,92 90,74 87,55 Z" fill="#1e293b"/>
            <!-- Ears -->
            <circle cx="36" cy="60" r="5" fill="#eab692"/>
            <circle cx="84" cy="60" r="5" fill="#eab692"/>
            <!-- Face -->
            <ellipse cx="60" cy="58" rx="23" ry="26" fill="#f7cfa0"/>
            <!-- Hair Top -->
            <path d="M37,52 C37,32 48,26 60,26 C72,26 83,32 83,52 C77,40 68,36 60,36 C52,36 43,40 37,52 Z" fill="#1e293b"/>
            <!-- Eyes & Smile -->
            <circle cx="51" cy="57" r="2.3" fill="#1e293b"/>
            <circle cx="69" cy="57" r="2.3" fill="#1e293b"/>
            <path d="M46,51 Q51,48 55,51" fill="none" stroke="#1e293b" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M65,51 Q69,48 74,51" fill="none" stroke="#1e293b" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M54,70 Q60,74 66,70" fill="none" stroke="#b45309" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        `;
      }
      return `
        <svg viewBox="0 0 120 140" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
          <rect width="120" height="140" fill="#0095ff"/>
          <!-- Shoulders & White School Shirt -->
          <path d="M14,140 C14,106 33,96 60,96 C87,96 106,106 106,140 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
          <!-- Shirt Collar & School Tie/Lanyard -->
          <path d="M44,95 L60,118 L76,95" fill="none" stroke="#1e3a8a" stroke-width="2.2"/>
          <path d="M43,94 L56,112 L48,118 L38,100 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
          <path d="M77,94 L64,112 L72,118 L82,100 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
          <path d="M56,112 L64,112 L66,140 L54,140 Z" fill="#7f1d1d"/>
          <!-- Neck -->
          <rect x="50" y="79" width="20" height="20" rx="6" fill="#f3c6a5"/>
          <!-- Ears -->
          <circle cx="35" cy="59" r="5.5" fill="#eab692"/>
          <circle cx="85" cy="59" r="5.5" fill="#eab692"/>
          <!-- Face -->
          <ellipse cx="60" cy="57" rx="24" ry="27" fill="#f7cfa0"/>
          <!-- Boy Short Neat Hair -->
          <path d="M35,51 C34,30 46,24 60,24 C74,24 86,30 85,51 C81,39 72,34 60,35 C48,34 39,39 35,51 Z" fill="#1e293b"/>
          <!-- Eyes & Smile -->
          <circle cx="50.5" cy="56.5" r="2.4" fill="#1e293b"/>
          <circle cx="69.5" cy="56.5" r="2.4" fill="#1e293b"/>
          <path d="M45,50 Q50.5,47.5 55,50" fill="none" stroke="#1e293b" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M65,50 Q69.5,47.5 75,50" fill="none" stroke="#1e293b" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M54,70 Q60,73.5 66,70" fill="none" stroke="#b45309" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      `;
    };

    // Traditional Khmer Red Ornate Corner Flourish SVG (ក្បាច់ជ្រុងក្រហម)
    const getRedCornerOrnamentSvg = (position) => {
      let transform = '';
      if (position === 'tr') transform = 'scale(-1, 1)';
      else if (position === 'bl') transform = 'scale(1, -1)';
      else if (position === 'br') transform = 'scale(-1, -1)';
      return `
        <svg viewBox="0 0 110 110" width="76" height="76" xmlns="http://www.w3.org/2000/svg" style="transform: ${transform}; display: block; pointer-events: none;">
          <g fill="#dc1e28">
            <!-- Outer Corner Spine -->
            <path d="M0,0 L110,0 L102,5.5 L5.5,5.5 L5.5,102 L0,110 Z"/>
            <!-- Corner Medallion & Traditional Khmer Kanok Flourishes -->
            <path d="M5,5 C24,5 38,12 46,24 C34,20 22,22 16,32 C28,28 42,33 48,46 C35,41 24,44 19,54 C28,50 38,54 42,64 C30,60 20,64 15,74 C22,71 29,74 31,82 C21,79 13,84 8,96 L5,96 Z"/>
            <path d="M5,5 C5,24 12,38 24,46 C20,34 22,22 32,16 C28,28 33,42 46,48 C41,35 44,24 54,19 C50,28 54,38 64,42 C60,30 64,20 74,15 C71,22 74,29 82,31 C79,21 84,13 96,8 L96,5 Z"/>
            <!-- Inner Accent Dots & Scroll -->
            <circle cx="34" cy="34" r="3.2" fill="#ffffff"/>
            <circle cx="21" cy="21" r="2.5" fill="#ffffff"/>
            <circle cx="48" cy="20" r="2" fill="#dc1e28"/>
            <circle cx="20" cy="48" r="2" fill="#dc1e28"/>
          </g>
        </svg>
      `;
    };

    // Ornate Blue & Gold Name Plaque SVG + Label (ស្លាកឈ្មោះសិស្សពូកែ)
    const renderStudentHonorCard = (stu, rankNum, slotIdx) => {
      const rankKh = toKhmerNumerals(rankNum);
      const fullName = stu?.khmerFullName || stu?.englishName || 'ឈ្មោះសិស្ស';
      const studentId = stu?.studentId || '';
      const savedCustomPhoto = studentId
        ? (localStorage.getItem(`honor_roll_photo_${studentId}`) || stu?.photo || '')
        : (localStorage.getItem(`honor_roll_slot_photo_${slotIdx}`) || '');

      return `
        <div class="honor-roll-student-card flex flex-col items-center select-none" data-slot-index="${slotIdx}" data-student-id="${escapeHtml(studentId)}" style="position: relative; width: 178px;">
          <!-- Portrait Frame with Sky-Blue Backdrop -->
          <div class="honor-roll-photo-frame group relative"
               data-slot-index="${slotIdx}"
               data-student-id="${escapeHtml(studentId)}"
               title="${isKm ? 'ចុចដើម្បីជ្រើសរើស ឬប្តូររូបថតសិស្ស' : 'Click to upload student photo'}"
               style="width: 100px; height: 118px; background: linear-gradient(180deg, #0088ff 0%, #00a2ff 100%); border: 2px solid #ffffff; outline: 1px solid #cbd5e1; box-shadow: 0 3px 8px rgba(15, 23, 42, 0.16); overflow: hidden; cursor: pointer; position: relative; z-index: 1;">
            ${savedCustomPhoto
              ? `<img src="${savedCustomPhoto}" alt="${escapeHtml(fullName)}" class="honor-roll-student-img" style="width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block;" />`
              : `<div class="honor-roll-student-placeholder" style="width: 100%; height: 100%;">${getStudentUniformSvg(stu?.gender)}</div>`
            }
            <!-- Hover Upload Overlay (Hidden in print) -->
            <div class="print:hidden opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                 style="position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ffffff; font-size: 9px; text-align: center; padding: 4px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 2px;">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>${isKm ? 'ប្តូររូបថត' : 'Photo'}</span>
            </div>
          </div>

          <!-- Ornate Blue & Gold Khmer Name Plaque -->
          <div class="honor-roll-name-plaque" style="position: relative; z-index: 2; margin-top: -5px; width: 176px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 220 40" width="176" height="32" xmlns="http://www.w3.org/2000/svg" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.22));">
              <defs>
                <linearGradient id="hrPlaqueBlue_${slotIdx}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#0f5ec9"/>
                  <stop offset="50%" stop-color="#0a459e"/>
                  <stop offset="100%" stop-color="#062966"/>
                </linearGradient>
                <linearGradient id="hrPlaqueGold_${slotIdx}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#d4af37"/>
                  <stop offset="50%" stop-color="#f3e5ab"/>
                  <stop offset="100%" stop-color="#aa7c11"/>
                </linearGradient>
              </defs>
              <!-- Outer Gold Hexagonal Bevel -->
              <polygon points="16,2 204,2 218,20 204,38 16,38 2,20" fill="url(#hrPlaqueGold_${slotIdx})" stroke="#6b4c08" stroke-width="1"/>
              <!-- Inner Royal Blue Plaque -->
              <polygon points="19,5 201,5 213,20 201,35 19,35 7,20" fill="url(#hrPlaqueBlue_${slotIdx})" stroke="#38bdf8" stroke-width="0.6" stroke-opacity="0.5"/>
              <!-- Left & Right Gold Filigree Wing Ornaments -->
              <path d="M10,20 L18,11 L23,20 L18,29 Z" fill="url(#hrPlaqueGold_${slotIdx})" opacity="0.9"/>
              <path d="M210,20 L202,11 L197,20 L202,29 Z" fill="url(#hrPlaqueGold_${slotIdx})" opacity="0.9"/>
              <circle cx="17" cy="20" r="2.2" fill="#062966"/>
              <circle cx="203" cy="20" r="2.2" fill="#062966"/>
            </svg>
            <div contenteditable="true"
                 spellcheck="false"
                 class="honor-roll-student-name font-khmer-muol outline-none focus:ring-1 focus:ring-amber-300 rounded px-1 cursor-text text-center truncate"
                 style="position: relative; z-index: 3; max-width: 146px; font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', 'Khmer OS Siemreap', sans-serif !important; font-size: 10.5px !important; line-height: 1.5 !important; color: #ffffff !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 2px #041e42 !important; white-space: nowrap;">${rankKh} ${escapeHtml(fullName)}</div>
          </div>
        </div>
      `;
    };

    await ReportViewer.open({
      reportKey: 'score_honor_roll_top5',
      title: isKm ? 'តារាងកិត្តិយស (Top 5)' : 'Top 5 Monthly Honor Roll',
      alwaysFresh: true,
      defaultOrientation: 'portrait',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 6, bottom: 6, left: 6, right: 6 },
      defaultFontFamily: 'Khmer OS Siemreap',
      defaultFontSize: 10,
      renderHeaderControls: (controlsContainer, viewer) => {
        const schoolOptsHtml = (allSchools || []).map(s => {
          const isSel = s.name === schoolName;
          return `<option value="${escapeHtml(s.name)}" ${isSel ? 'selected' : ''}>${escapeHtml(s.name)}</option>`;
        }).join('');

        const classOptionsHtml = isTeacher && teacherClassId
          ? `<option value="${selectedClassId}">${escapeHtml(classes.find(c => String(c.id).trim() === String(selectedClassId).trim())?.name || selectedClassId)}</option>`
          : classes.map(c => `<option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

        controlsContainer.className = 'flex items-center gap-2 sm:gap-3 flex-wrap font-khmer';
        controlsContainer.innerHTML = `
          <!-- School Filter -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'សាលារៀន:' : 'School:'}</span>
            <select id="rv-honor-filter-school" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate max-w-[150px] sm:max-w-[180px] cursor-pointer box-border">
              ${schoolOptsHtml || `<option value="${escapeHtml(schoolName)}">${escapeHtml(schoolName || 'សាលារៀន')}</option>`}
            </select>
          </div>

          <!-- Class Filter -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ថ្នាក់រៀន:' : 'Class:'}</span>
            <select id="rv-honor-filter-class" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate cursor-pointer box-border">
              ${classOptionsHtml}
            </select>
          </div>

          <!-- Academic Year Trigger & Popover -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ឆ្នាំសិក្សា:' : 'Year:'}</span>
            <div id="rv-honor-year-group" class="relative">
              <button type="button"
                      id="rv-btn-result-year-trigger"
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[110px] max-w-[160px] box-border"
                      title="${isKm ? 'ជ្រើសរើស ឬបន្ថែមឆ្នាំសិក្សា' : 'Select Academic Year'}">
                <span id="rv-result-year-text" class="truncate">${selectedYear}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-result-year-chevron')}
              </button>
              <div id="rv-popover-result-year-menu" class="hidden absolute top-9 left-0 z-50 w-72 p-2.5 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2 font-khmer select-none box-border animate-slide-down">
                <div class="flex items-center gap-1.5 border-b border-border pb-1.5 w-full box-border">
                  <input type="text" id="rv-input-result-new-year" placeholder="${isKm ? 'បញ្ចូលឆ្នាំថ្មី... (2025–2026)' : 'New year (2025–2026)...'}" class="flex-1 min-w-0 h-8 px-2.5 bg-background border border-input rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border" />
                  <button type="button" id="rv-btn-result-add-year" class="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors flex-shrink-0 cursor-pointer whitespace-nowrap">${getIcon('plus', 'w-3.5 h-3.5')}<span>${isKm ? 'បន្ថែម' : 'Add'}</span></button>
                </div>
                <div class="max-h-48 overflow-y-auto divide-y divide-border/20 rounded-md border border-border/40 bg-background/50 p-0.5 space-y-0.5" id="rv-result-year-list"></div>
              </div>
            </div>
          </div>

          <!-- Evaluation Period Selector -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ប្រចាំខែ:' : 'Month:'}</span>
            <select id="rv-honor-filter-period" class="h-8 py-0 leading-[30px] px-2 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs cursor-pointer box-border" title="${isKm ? 'ជ្រើសរើសខែ ដើម្បីទាញយកសិស្សពូកែទាំង ៥' : 'Select month for Top 5'}">
              <optgroup label="${isKm ? 'ខែសិក្សា' : 'Months'}">
                ${months.map(m => `<option value="${m.id}" ${m.id === selectedPeriod ? 'selected' : ''}>${isKm ? m.nameKm : m.nameEn}</option>`).join('')}
              </optgroup>
              <optgroup label="${isKm ? 'ការប្រឡង និងឆមាស' : 'Exams'}">
                ${exams.map(e => `<option value="${e.id}" ${e.id === selectedPeriod ? 'selected' : ''}>${isKm ? e.nameKm : e.nameEn}</option>`).join('')}
              </optgroup>
            </select>
          </div>

          <!-- Date Picker Popover -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'កាលបរិច្ឆេទ:' : 'Date:'}</span>
            <div id="rv-result-date-container" class="relative">
              <button type="button"
                      id="rv-result-btn-date-trigger"
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[125px] max-w-[170px] box-border"
                      title="${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ (ចន្ទគតិ & សុរិយគតិ)' : 'Select Date'}">
                <span class="flex items-center gap-1.5 truncate">
                  ${getIcon('calendar', 'w-3.5 h-3.5 text-primary flex-shrink-0')}
                  <span id="rv-result-date-trigger-text" class="truncate">${formatDisplayDate(selectedReportDate.toISOString().split('T')[0])}</span>
                </span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-result-date-chevron')}
              </button>

              <div id="rv-result-popover-date-menu"
                   class="hidden absolute right-0 top-[calc(100%+4px)] z-[80] w-80 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-3 font-khmer select-none animate-slide-down box-border">
                <div class="flex items-center justify-between border-b border-border/50 pb-2">
                  <span class="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    ${getIcon('calendar', 'w-4 h-4 text-primary')}
                    <span>${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ' : 'Select Date'}</span>
                  </span>
                  <button type="button"
                          id="rv-result-btn-date-today"
                          class="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                    ${isKm ? 'ថ្ងៃនេះ' : 'Today'}
                  </button>
                </div>

                <div class="space-y-1">
                  <label class="text-[11px] text-muted-foreground">${isKm ? 'កាលបរិច្ឆេទសុរិយគតិ:' : 'Solar Date:'}</label>
                  <input type="date"
                         id="rv-result-input-report-date"
                         value="${selectedReportDate.toISOString().split('T')[0]}"
                         class="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border cursor-pointer" />
                </div>

                <div class="space-y-2 pt-1">
                  <div class="p-2.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-primary font-semibold">
                      <span>${isKm ? 'ចន្ទគតិ' : 'Khmer Lunar Date'}</span>
                      ${getIcon('moon', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-result-preview-lunar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${formatKhmerLunarDate(selectedReportDate)}
                    </p>
                  </div>
                  <div class="p-2.5 rounded-lg border border-border/60 bg-muted/30 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                      <span>${isKm ? 'សុរិយគតិ' : 'Khmer Solar Date'}</span>
                      ${getIcon('sun', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-result-preview-solar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${schoolProvince || 'ភ្នំពេញ'} ${formatKhmerSolarDate(selectedReportDate)}
                    </p>
                  </div>
                </div>

                <button type="button"
                        id="rv-result-btn-date-apply"
                        class="w-full h-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer">
                  ${getIcon('check', 'w-3.5 h-3.5')}
                  <span>${isKm ? 'យល់ព្រម (Apply)' : 'Apply'}</span>
                </button>
              </div>
            </div>
          </div>
        `;

        // School select binding
        const schoolSelect = controlsContainer.querySelector('#rv-honor-filter-school');
        schoolSelect?.addEventListener('change', async (e) => {
          schoolName = e.target.value;
          const matched = allSchools.find(s => s.name === schoolName);
          if (matched && matched.province) {
            schoolProvince = matched.province;
          }
          if (viewer) await viewer.refreshContent(false);
        });

        // Class select binding
        const classSelect = controlsContainer.querySelector('#rv-honor-filter-class');
        classSelect?.addEventListener('change', async (e) => {
          selectedClassId = e.target.value;
          if (viewer) await viewer.refreshContent(false);
        });

        // Period select binding
        const periodSelect = controlsContainer.querySelector('#rv-honor-filter-period');
        periodSelect?.addEventListener('change', async (e) => {
          selectedPeriod = e.target.value;
          if (viewer) await viewer.refreshContent(false);
        });

        // Academic Year Popover
        const yearTriggerBtn = controlsContainer.querySelector('#rv-btn-result-year-trigger');
        const yearTriggerText = controlsContainer.querySelector('#rv-result-year-text');
        const yearChevron = controlsContainer.querySelector('.rv-result-year-chevron');
        const yearMenu = controlsContainer.querySelector('#rv-popover-result-year-menu');
        const yearListEl = controlsContainer.querySelector('#rv-result-year-list');
        const yearInputEl = controlsContainer.querySelector('#rv-input-result-new-year');
        const yearAddBtn = controlsContainer.querySelector('#rv-btn-result-add-year');

        const renderYearList = () => {
          if (!yearListEl) return;
          yearListEl.innerHTML = academicYears.map(y => {
            const yName = typeof y === 'string' ? y : (y.name || y.id || '');
            const isSelected = String(selectedYear).trim().toLowerCase() === String(yName).trim().toLowerCase();
            return `
              <div class="rv-year-item flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent text-xs group cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}" data-year="${escapeHtml(yName)}">
                <span class="truncate flex-1">${escapeHtml(yName)}</span>
              </div>
            `;
          }).join('');
        };
        renderYearList();

        yearTriggerBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = yearMenu?.classList.contains('hidden');
          if (isHidden) {
            yearMenu?.classList.remove('hidden');
            yearChevron?.classList.add('rotate-180');
          } else {
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
          }
        });

        yearListEl?.addEventListener('click', async (e) => {
          const item = e.target.closest('.rv-year-item');
          if (item && item.dataset.year) {
            selectedYear = item.dataset.year;
            if (yearTriggerText) yearTriggerText.textContent = selectedYear;
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            renderYearList();
            if (viewer) await viewer.refreshContent(false);
          }
        });

        yearAddBtn?.addEventListener('click', async () => {
          const val = (yearInputEl?.value || '').trim();
          if (!val) return;
          try {
            const created = await SettingsService.createAcademicYear({ name: val });
            academicYears = await SettingsService.getAcademicYears() || [];
            selectedYear = created?.name || val;
            if (yearInputEl) yearInputEl.value = '';
            if (yearTriggerText) yearTriggerText.textContent = selectedYear;
            renderYearList();
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            if (viewer) await viewer.refreshContent(false);
            toast.success(isKm ? 'បានបន្ថែមឆ្នាំសិក្សាដោយជោគជ័យ' : 'Academic year added');
          } catch (err) {
            toast.error(err.message || String(err));
          }
        });

        // Date Picker Popover
        const dateBtn = controlsContainer.querySelector('#rv-result-btn-date-trigger');
        const dateMenu = controlsContainer.querySelector('#rv-result-popover-date-menu');
        const dateChevron = controlsContainer.querySelector('.rv-result-date-chevron');
        const dateInput = controlsContainer.querySelector('#rv-result-input-report-date');
        const dateText = controlsContainer.querySelector('#rv-result-date-trigger-text');
        const previewLunar = controlsContainer.querySelector('#rv-result-preview-lunar-text');
        const previewSolar = controlsContainer.querySelector('#rv-result-preview-solar-text');
        const todayBtn = controlsContainer.querySelector('#rv-result-btn-date-today');
        const applyBtn = controlsContainer.querySelector('#rv-result-btn-date-apply');

        const updateDateDisplay = (d) => {
          if (!d) return;
          if (dateText) dateText.textContent = formatDisplayDate(d.toISOString().split('T')[0]);
          if (previewLunar) previewLunar.textContent = formatKhmerLunarDate(d);
          if (previewSolar) previewSolar.textContent = `${schoolProvince || 'ភ្នំពេញ'} ${formatKhmerSolarDate(d)}`;
          if (dateInput) dateInput.value = d.toISOString().split('T')[0];
        };

        dateBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = dateMenu?.classList.contains('hidden');
          if (isHidden) {
            dateMenu?.classList.remove('hidden');
            dateChevron?.classList.add('rotate-180');
          } else {
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          }
        });

        dateInput?.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val) {
            selectedReportDate = new Date(val);
            updateDateDisplay(selectedReportDate);
          }
        });

        todayBtn?.addEventListener('click', () => {
          selectedReportDate = new Date();
          updateDateDisplay(selectedReportDate);
        });

        applyBtn?.addEventListener('click', async () => {
          dateMenu?.classList.add('hidden');
          dateChevron?.classList.remove('rotate-180');
          const docLunar = viewer?.overlay?.querySelector('#honor-roll-lunar-date');
          const docSolar = viewer?.overlay?.querySelector('#honor-roll-solar-date');
          if (docLunar) docLunar.textContent = formatKhmerLunarDate(selectedReportDate);
          if (docSolar) docSolar.textContent = `${schoolProvince || 'ភ្នំពេញ'} ${formatKhmerSolarDate(selectedReportDate)}`;
          viewer?.saveStateForUndo?.();
          toast.success(isKm ? 'បានកំណត់កាលបរិច្ឆេទដោយជោគជ័យ' : 'Date applied successfully');
        });
      },
      renderContent: async (contentContainer, viewer) => {
        const clsObj = classes.find(c => String(c.id).trim() === String(selectedClassId).trim()) || classes[0];
        currentClassName = clsObj?.name || '—';

        const data = await ScoreService.getMasterScoreSheet({
          classId: selectedClassId,
          academicYear: selectedYear,
          period: selectedPeriod
        });
        let rows = data.rows || [];

        // If Semester or Annual period is selected, compute averages dynamically
        const isSemester = ScoreService.isSemesterPeriod(selectedPeriod);
        const isAnnual = ScoreService.isAnnualPeriod(selectedPeriod);

        if (isSemester) {
          const semKey = `semester_months_${selectedClassId || 'default'}_${selectedPeriod}_${selectedYear || 'default'}`;
          let semMonths = selectedPeriod === 'Semester 1'
            ? ['October', 'November', 'December', 'January', 'February', null]
            : ['March', 'April', 'May', 'June', 'July', null];
          try {
            const raw = localStorage.getItem(semKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length === 6) semMonths = parsed;
            }
          } catch (_) {}

          const monthMaps = {};
          for (let i = 0; i < 6; i++) {
            const mId = semMonths[i];
            if (mId) {
              monthMaps[i] = await ScoreService.getStudentAveragesForMonth(selectedClassId, selectedYear, mId);
            }
          }

          const examPeriod = ScoreService.getCorrespondingExamPeriod(selectedPeriod);
          const examMap = examPeriod ? await ScoreService.getStudentAveragesForExam(selectedClassId, selectedYear, examPeriod) : new Map();
          const chosenCount = (Array.isArray(semMonths) ? semMonths.filter(Boolean).length : 0) || 1;

          rows.forEach(r => {
            if (!r.monthScores) r.monthScores = {};
            let mSum = 0;
            let mCount = 0;
            for (let i = 0; i < 6; i++) {
              const mId = semMonths[i];
              if (mId && monthMaps[i]) {
                const val = monthMaps[i].get ? monthMaps[i].get(r.studentId) : monthMaps[i][r.studentId];
                if (val !== undefined && val !== null && !isNaN(Number(val))) {
                  r.monthScores[i] = Number(val);
                  mSum += Number(val);
                  mCount++;
                }
              }
            }

            const divisor = chosenCount > 0 ? chosenCount : (mCount > 0 ? mCount : 1);
            const mAvg = Math.round((mSum / divisor) * 100) / 100;
            r.semesterMonthAvg = mAvg;
            r.total = mAvg;

            const examVal = examMap.get ? (examMap.get(r.studentId) ?? (r.studentNumber ? examMap.get(r.studentNumber) : null)) : null;
            r.semesterExamAvg = (examVal !== undefined && examVal !== null && !isNaN(Number(examVal))) ? Number(examVal) : null;

            if (r.semesterExamAvg !== null) {
              r.semesterOverallAvg = Math.round(((mAvg + r.semesterExamAvg) / 2) * 100) / 100;
            } else {
              r.semesterOverallAvg = mAvg;
            }
            r.average = r.semesterOverallAvg;
            r.grade = SubjectService.calculateGrade(r.average, 50).grade;
          });
          ScoreService.rankStudents(rows);
        } else if (isAnnual) {
          rows.forEach(r => {
            const s1 = Number(r.annualScores?.sem1) || 0;
            const s2 = Number(r.annualScores?.sem2) || 0;
            const count = (r.annualScores?.sem1 !== null && r.annualScores?.sem1 !== undefined ? 1 : 0) +
                          (r.annualScores?.sem2 !== null && r.annualScores?.sem2 !== undefined ? 1 : 0);
            r.total = Math.round((s1 + s2) * 100) / 100;
            r.average = count > 0 ? Math.round(((s1 + s2) / 2) * 100) / 100 : 0;
            r.grade = SubjectService.calculateGrade(r.average, 50).grade;
          });
          ScoreService.rankStudents(rows);
        }

        // Sort by Rank #1 -> #5 ascending (tie-breaking by average desc, then name)
        const sortedRows = [...rows].sort((a, b) => {
          const rankA = Number(a.rank) || 9999;
          const rankB = Number(b.rank) || 9999;
          if (rankA !== rankB) return rankA - rankB;
          const avgDiff = (Number(b.average) || 0) - (Number(a.average) || 0);
          if (Math.abs(avgDiff) > 0.0001) return avgDiff;
          return (a.khmerFullName || '').localeCompare(b.khmerFullName || '', 'km');
        });

        // Pick Top 5 students (pad with placeholders if fewer than 5 students exist)
        const top5 = [];
        for (let i = 0; i < 5; i++) {
          if (sortedRows[i]) {
            top5.push(sortedRows[i]);
          } else {
            top5.push({
              studentId: '',
              khmerFullName: `សិស្សចំណាត់ថ្នាក់លេខ ${toKhmerNumerals(i + 1)}`,
              gender: i % 2 === 1 ? 'Female' : 'Male',
              rank: i + 1,
              photo: ''
            });
          }
        }

        const periodSubtitleText = getHonorRollPeriodSubtitle(selectedPeriod);
        const khmerYearText = `ឆ្នាំសិក្សា ${toKhmerNumerals(selectedYear).replace(/[–-]/g, ' - ')}`;
        const khmerClassText = `ថ្នាក់ទី ${toKhmerNumerals(currentClassName)}`;

        contentContainer.innerHTML = `
          <style>
            .honor-roll-outline-navy {
              font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important;
              color: #0f296b !important;
              -webkit-text-stroke: 3.5px #ffffff;
              paint-order: stroke fill;
              filter: drop-shadow(0px 0px 1.2px #0f296b) drop-shadow(0px 1.5px 1.5px rgba(15, 41, 107, 0.75));
              line-height: 1.9 !important;
            }
            .honor-roll-outline-teal {
              font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important;
              color: #0b6e4f !important;
              -webkit-text-stroke: 3.2px #ffffff;
              paint-order: stroke fill;
              filter: drop-shadow(0px 0px 1.2px #064e3b) drop-shadow(0px 1.5px 1.5px rgba(6, 78, 59, 0.75));
              line-height: 1.85 !important;
            }
          </style>

          <!-- Hidden File Input for Click-to-Upload Student Photos -->
          <input type="file" id="honor-roll-photo-file-input" accept="image/*" class="hidden print:hidden" style="display: none !important;" />

          <div class="moeys-report-document honor-roll-document mx-auto"
               style="width: 100% !important; min-height: 281mm !important; height: 281mm !important; position: relative !important; box-sizing: border-box !important; background: #ffffff !important; padding: 13mm 14mm 11mm 14mm !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; overflow: hidden !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif;">

            <!-- Red Ornate Border Line & 4 Traditional Khmer Corner Flourishes -->
            <div style="position: absolute; inset: 4mm; border: 2px solid #dc1e28; pointer-events: none; z-index: 1;"></div>
            <div style="position: absolute; top: 2.2mm; left: 2.2mm; z-index: 2; pointer-events: none;">${getRedCornerOrnamentSvg('tl')}</div>
            <div style="position: absolute; top: 2.2mm; right: 2.2mm; z-index: 2; pointer-events: none;">${getRedCornerOrnamentSvg('tr')}</div>
            <div style="position: absolute; bottom: 2.2mm; left: 2.2mm; z-index: 2; pointer-events: none;">${getRedCornerOrnamentSvg('bl')}</div>
            <div style="position: absolute; bottom: 2.2mm; right: 2.2mm; z-index: 2; pointer-events: none;">${getRedCornerOrnamentSvg('br')}</div>

            <!-- 1. TOP HEADER + ARCHED TITLE BLOCK -->
            <div style="position: relative; z-index: 5;">
              <div class="flex items-start justify-between">
                <!-- Top-Left: Only Khmer School Name -->
                <div class="text-center" style="min-width: 175px; padding-top: 18px;">
                  <div id="honor-roll-school-kh"
                       contenteditable="true"
                       spellcheck="false"
                       class="font-khmer-muol outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 cursor-text"
                       style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 11.5px !important; color: #5c1916 !important; line-height: 1.85 !important;">${escapeHtml(schoolName)}</div>
                </div>

                <!-- Top-Right: Kingdom of Cambodia Motto -->
                <div class="text-center" style="min-width: 210px; padding-top: 2px;">
                  <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 12.5px !important; color: #0f296b !important; line-height: 1.85 !important;">ព្រះរាជាណាចក្រកម្ពុជា</p>
                  <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 11.5px !important; color: #0f296b !important; line-height: 1.85 !important;">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
                  <div style="color: #0f296b !important; font-size: 9px !important; margin-top: 1px;">~ ~ ~ 🙞 🙞 🙞 ~ ~ ~</div>
                </div>
              </div>

              <!-- Center Arched "តារាងកិត្តិយស" + Month / Year / Class Subtitles -->
              <div class="text-center" style="margin-top: 2px;">
                <!-- Arched SVG Title: តារាងកិត្តិយស -->
                <div style="display: flex; justify-content: center; margin-bottom: -8px;">
                  <svg viewBox="0 0 420 76" width="335" height="62" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
                    <defs>
                      <path id="hrTitleArcPath" d="M 28,64 Q 210,16 392,64" />
                    </defs>
                    <!-- Outer Navy Stroke -->
                    <text font-family="'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif" font-size="28" fill="none" stroke="#0f296b" stroke-width="7.5" stroke-linejoin="round">
                      <textPath href="#hrTitleArcPath" startOffset="50%" text-anchor="middle">តារាងកិត្តិយស</textPath>
                    </text>
                    <!-- Middle Crisp White Outline -->
                    <text font-family="'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif" font-size="28" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="round">
                      <textPath href="#hrTitleArcPath" startOffset="50%" text-anchor="middle">តារាងកិត្តិយស</textPath>
                    </text>
                    <!-- Inner Royal Navy Fill -->
                    <text font-family="'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif" font-size="28" fill="#0f296b">
                      <textPath href="#hrTitleArcPath" startOffset="50%" text-anchor="middle">តារាងកិត្តិយស</textPath>
                    </text>
                  </svg>
                </div>

                <!-- Subtitle 1: ប្រចាំខែ ... -->
                <div>
                  <span id="honor-roll-period-label"
                        contenteditable="true"
                        spellcheck="false"
                        class="honor-roll-outline-navy outline-none focus:ring-1 focus:ring-primary/40 rounded px-1.5 cursor-text inline-block"
                        style="font-size: 14px !important;">${escapeHtml(periodSubtitleText)}</span>
                </div>

                <!-- Subtitle 2: ឆ្នាំសិក្សា ... -->
                <div style="margin-top: 1px;">
                  <span id="honor-roll-year-label"
                        contenteditable="true"
                        spellcheck="false"
                        class="honor-roll-outline-teal outline-none focus:ring-1 focus:ring-primary/40 rounded px-1.5 cursor-text inline-block"
                        style="font-size: 13.5px !important;">${escapeHtml(khmerYearText)}</span>
                </div>

                <!-- Subtitle 3: ថ្នាក់ទី ... -->
                <div style="margin-top: 1px;">
                  <span id="honor-roll-class-label"
                        contenteditable="true"
                        spellcheck="false"
                        class="honor-roll-outline-teal outline-none focus:ring-1 focus:ring-primary/40 rounded px-1.5 cursor-text inline-block"
                        style="font-size: 13.5px !important;">${escapeHtml(khmerClassText)}</span>
                </div>
              </div>
            </div>

            <!-- 2. TOP 5 STUDENTS PYRAMID / DIAMOND LAYOUT -->
            <div style="position: relative; z-index: 5; display: flex; flex-direction: column; justify-content: center; gap: 6px; margin-top: 2px; margin-bottom: 4px;">
              <!-- Row 1 (Top Center): Rank ១ -->
              <div style="display: flex; justify-content: center; width: 100%;">
                ${renderStudentHonorCard(top5[0], top5[0]?.rank || 1, 0)}
              </div>

              <!-- Row 2 (Middle Left & Right): Rank ២ (left) & Rank ៣ (right) -->
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 470px; margin: -12px auto 0 auto;">
                ${renderStudentHonorCard(top5[1], top5[1]?.rank || 2, 1)}
                ${renderStudentHonorCard(top5[2], top5[2]?.rank || 3, 2)}
              </div>

              <!-- Row 3 (Bottom Wide Left & Right): Rank ៥ (left) & Rank ៤ (right) matching reference image -->
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 565px; margin: 4px auto 0 auto;">
                ${renderStudentHonorCard(top5[4], top5[4]?.rank || 5, 4)}
                ${renderStudentHonorCard(top5[3], top5[3]?.rank || 4, 3)}
              </div>
            </div>

            <!-- 3. FOOTER DATES & SIGNATURES -->
            <div style="position: relative; z-index: 5; width: 100%; margin-top: 2px;">
              <!-- Lunar & Solar Date Block (Right Half) -->
              <div class="text-center" style="width: 60%; margin-left: auto; margin-bottom: 4px;">
                <p id="honor-roll-lunar-date"
                   contenteditable="true"
                   spellcheck="false"
                   class="font-khmer-muol outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 cursor-text"
                   style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 9.5px !important; color: #1e293b !important; line-height: 1.8 !important;">${formatKhmerLunarDate(selectedReportDate)}</p>
                <p id="honor-roll-solar-date"
                   contenteditable="true"
                   spellcheck="false"
                   class="font-khmer-muol outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 cursor-text"
                   style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 9.5px !important; color: #1e293b !important; line-height: 1.8 !important;">${escapeHtml(schoolProvince || 'ភ្នំពេញ')} ${formatKhmerSolarDate(selectedReportDate)}</p>
              </div>

              <!-- Principal (Left) & Class Teacher (Right) Signature Blocks -->
              <div class="grid grid-cols-2 gap-8 text-center" style="padding: 0 18px;">
                <!-- Bottom-Left: Principal -->
                <div class="flex flex-col items-center">
                  <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 10px !important; color: #0f296b !important; line-height: 1.8 !important;">បានឃើញ និងឯកភាព</p>
                  <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 10px !important; color: #0f296b !important; line-height: 1.8 !important;">នាយកសាលា</p>
                  <div style="height: 52px;"></div>
                </div>

                <!-- Bottom-Right: Class Teacher -->
                <div class="flex flex-col items-center">
                  <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif !important; font-size: 10px !important; color: #0f296b !important; line-height: 1.8 !important;">គ្រូបន្ទុកថ្នាក់</p>
                  <div style="height: 52px;"></div>
                </div>
              </div>
            </div>
          </div>
        `;

        // Bind Click-to-Upload Student Photo on all 5 Portrait Frames
        const photoFileInput = contentContainer.querySelector('#honor-roll-photo-file-input');
        let activePhotoTarget = null;

        contentContainer.querySelectorAll('.honor-roll-photo-frame').forEach(frame => {
          frame.addEventListener('click', (e) => {
            e.stopPropagation();
            activePhotoTarget = frame;
            if (photoFileInput) {
              photoFileInput.value = '';
              photoFileInput.click();
            }
          });
        });

        photoFileInput?.addEventListener('change', async (e) => {
          const file = e.target.files?.[0];
          if (!file || !activePhotoTarget) return;
          try {
            const dataUrl = await readAndResizeImage(file, 420, 520);
            const stuId = activePhotoTarget.getAttribute('data-student-id');
            const slotIdx = activePhotoTarget.getAttribute('data-slot-index');

            // Update DOM portrait immediately
            const existingImg = activePhotoTarget.querySelector('.honor-roll-student-img');
            const placeholderEl = activePhotoTarget.querySelector('.honor-roll-student-placeholder');
            if (existingImg) {
              existingImg.src = dataUrl;
            } else if (placeholderEl) {
              placeholderEl.outerHTML = `<img src="${dataUrl}" alt="Student" class="honor-roll-student-img" style="width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block;" />`;
            }

            // Persist photo to IndexedDB student record + localStorage
            if (stuId) {
              try { localStorage.setItem(`honor_roll_photo_${stuId}`, dataUrl); } catch (_) {}
              try {
                const stuRecord = await db.get('students', stuId);
                if (stuRecord) {
                  stuRecord.photo = dataUrl;
                  await db.put('students', stuRecord);
                }
              } catch (_) {}
            } else if (slotIdx !== null) {
              try { localStorage.setItem(`honor_roll_slot_photo_${slotIdx}`, dataUrl); } catch (_) {}
            }

            viewer?.saveStateForUndo?.();
            toast.success(isKm ? 'បានប្តូររូបថតសិស្សដោយជោគជ័យ' : 'Student photo updated');
          } catch (err) {
            toast.error(isKm ? 'មិនអាចបញ្ចូលរូបថតបានទេ' : 'Failed to load photo');
          }
        });
      }
    });
  }
};
