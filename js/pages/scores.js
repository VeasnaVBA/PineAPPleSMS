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

import { ScoreService, EVALUATION_PERIODS } from '../services/scoreService.js';
import { ClassService } from '../services/classService.js';
import { SubjectService } from '../services/subjectService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { i18n, t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { syncStateManager } from '../services/syncStateManager.js';

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
    selectedPeriod: 'October',
    activeYear: '2024–2025',
    coefficients: {},
    rows: [],
    searchQuery: '',
    subjectExtraCol: localStorage.getItem('scores_subject_extra_col') || 'none', // 'none' | 'rank' | 'grade' | 'both'
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
            <span id="sync-status-indicator" class="text-[11px] text-muted-foreground flex items-center gap-1.5 font-khmer px-2 py-1 rounded bg-muted/40">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span id="sync-status-text">${isKm ? 'បានធ្វើសមកាលកម្ម' : 'Synced'}</span>
            </span>

            <button id="btn-save-scores" type="button" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer">
              ${getIcon('check', 'w-3.5 h-3.5')}
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'រក្សាទុក' : 'Save'}</span>
            </button>
            <button id="btn-print-scores" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium shadow-2xs transition-colors cursor-pointer">
              ${getIcon('download', 'w-3.5 h-3.5')}
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'បោះពុម្ព' : 'Print'}</span>
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
                  <div class="h-8.5 px-3 rounded-lg border border-primary/30 bg-primary/10 text-xs font-bold text-primary flex items-center gap-1.5">
                    ${getIcon('classes', 'w-3.5 h-3.5')}
                    <span>${assignedCls.name}</span>
                  </div>
                ` : `
                  <a href="#classes" class="h-8.5 px-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-700 flex items-center gap-1.5">
                    <span>${isKm ? '+ បង្កើតថ្នាក់' : '+ Add Class'}</span>
                  </a>
                `;
              })() : `
                <select id="select-score-class" class="h-8.5 px-3 pr-8 rounded-lg border border-input bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer">
                  ${classes.length === 0 ? `<option value="">${isKm ? 'គ្មានថ្នាក់រៀន' : 'No classes'}</option>` : ''}
                  ${classes.map(c => `
                    <option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Month / Period Selector Pill -->
            <div class="relative">
              <select id="select-score-period" class="h-8.5 px-3 pr-8 rounded-lg border border-input bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer">
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
            <button id="btn-coefficient-settings" type="button" class="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'កំណត់មេគុណសម្រាប់ខែនីមួយៗ ដើម្បីគណនាមធ្យមភាគ' : 'Set coefficients to calculate monthly average'}">
              <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'មេគុណ' : 'Coefficient'}</span>
              <span id="current-month-coeff-badge" class="ml-0.5 px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-primary/10 text-primary border border-primary/20" title="${isKm ? 'មេគុណខែនេះ' : 'Current month coefficient'}">${this.getCurrentPeriodCoefficient()}</span>
            </button>

            <!-- Download Template Button -->
            <button id="btn-download-template" type="button" class="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'ទាញយកឯកសារ Excel គំរូ' : 'Download Excel Template'}">
              <svg class="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'ទាញយកគំរូ' : 'Template'}</span>
            </button>

            <!-- Upload Scores Button -->
            <button id="btn-upload-scores" type="button" class="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'បញ្ចូលពិន្ទុពីឯកសារ Excel' : 'Upload from Excel'}">
              <svg class="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/></svg>
              <span>Upload</span>
            </button>
            <input type="file" id="input-file-upload-excel" accept=".xlsx,.xls,.csv" class="hidden" />

            <!-- Subject Extra Column Display Mode Toggle Button (None -> Rank -> Grade -> Both -> None) -->
            <button id="btn-toggle-subject-extra-col" 
                    type="button" 
                    class="h-8.5 px-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shadow-2xs transition-colors cursor-pointer select-none font-khmer shrink-0" 
                    title="${this.getSubjectExtraColBtnTitle()}">
              ${this.getSubjectExtraColBtnHtml()}
            </button>

            <!-- A-F Grading Guide Button -->
            <button id="btn-grade-scale-guide" type="button" class="h-8.5 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-bold font-mono shadow-2xs transition-colors cursor-pointer" title="${isKm ? 'កម្រិតនិទ្ទេស A-F' : 'Grading Scale'}">
              A-F
            </button>

            <!-- Data Actions Dropdown -->
            <div class="relative">
              <button id="btn-data-menu" type="button" class="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 shadow-2xs transition-colors cursor-pointer">
                <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'ទិន្នន័យ' : 'Data'}</span>
                <svg class="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div id="dropdown-data-menu" class="hidden absolute left-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 py-1 text-xs font-khmer">
                <button id="action-recalculate-all" type="button" class="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 cursor-pointer">
                  ${getIcon('refresh', 'w-3.5 h-3.5 text-primary')}
                  <span>${isKm ? 'គណនាពិន្ទុឡើងវិញ' : 'Recalculate All'}</span>
                </button>
                <button id="action-clear-all-scores" type="button" class="w-full text-left px-3 py-2 hover:bg-destructive/10 text-destructive flex items-center gap-2 cursor-pointer">
                  ${getIcon('trash', 'w-3.5 h-3.5')}
                  <span>${isKm ? 'លុបពិន្ទុក្នុងតារាងទាំងអស់' : 'Clear All Scores'}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Student Search Input -->
          <div class="relative w-full sm:w-64">
            <input type="text" 
                   id="input-search-student" 
                   placeholder="${isKm ? 'ស្វែងរកសិស្ស...' : 'Search student...'}" 
                   value="${this.state.searchQuery}"
                   class="w-full h-8.5 pl-8 pr-3 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary shadow-2xs" />
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              ${getIcon('search', 'w-3.5 h-3.5')}
            </span>
          </div>
        </div>

        <!-- Master Score Table Container -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden print:border-none print:shadow-none relative w-full max-w-full">
          <div class="score-table-container max-h-[72vh] overflow-auto w-full max-w-full">
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
    return (val && val > 0) ? val : (period.includes('Semester') || period.includes('Annual') ? 20 : 10);
  },

  updateCoefficientBadge() {
    const coeff = this.getCurrentPeriodCoefficient();
    const badge = document.getElementById('current-month-coeff-badge');
    if (badge) {
      badge.textContent = coeff;
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
    btn.title = this.getSubjectExtraColBtnTitle();
    btn.innerHTML = this.getSubjectExtraColBtnHtml();
  },

  async loadScores() {
    if (!this.state.selectedClassId) return;

    if (!this.state.coefficients || Object.keys(this.state.coefficients).length === 0) {
      this.state.coefficients = await ScoreService.getMonthlyCoefficients();
    }
    this.updateCoefficientBadge();

    const data = await ScoreService.getMasterScoreSheet({
      classId: this.state.selectedClassId,
      academicYear: this.state.activeYear,
      period: this.state.selectedPeriod
    });

    this.state.rows = data.rows || [];
    this.state.subjects = data.subjects || [];

    // Ensure subject ranks and grades are computed across all rows
    ScoreService.rankSubjectStudents(this.state.rows, this.state.subjects);
    ScoreService.calculateSubjectGrades(this.state.rows, this.state.subjects);

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
        ${this.state.subjects.map(() => `
          <col style="width: 46px; min-width: 46px; max-width: 46px;">
          ${showRank ? '<col style="width: 46px; min-width: 46px; max-width: 46px;">' : ''}
          ${showGrade ? '<col style="width: 46px; min-width: 46px; max-width: 46px;">' : ''}
        `).join('')}
        <col style="width: 64px; min-width: 64px; max-width: 64px;">
        <col style="width: 68px; min-width: 68px; max-width: 68px;">
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

      <!-- Subject Column Headers (Vertical Text + Category Color, with optional Rank and/or Grade column) -->
      ${this.state.subjects.map(sub => {
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
      }).join('')}

      <!-- Result Columns (Centered in the middle) -->
      <th class="score-result-th p-0 text-center font-bold font-mono text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[64px] max-w-[64px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
          <span class="font-khmer text-xs block text-center">${isKm ? 'ពិន្ទុសរុប' : 'Total'}</span>
        </div>
      </th>
      <th class="score-result-th p-0 text-center font-bold font-mono text-primary bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[68px] max-w-[68px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
          <span class="font-khmer text-xs block text-primary text-center">${isKm ? 'មធ្យមភាគ' : 'Avg'}</span>
        </div>
      </th>
      <th class="score-result-th p-0 text-center font-bold font-mono col-rank-th text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[72px] max-w-[72px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
          <span class="font-khmer text-xs block text-center">${isKm ? 'ចំណាត់ថ្នាក់' : 'Rank'}</span>
        </div>
      </th>
      <th class="score-result-th p-0 text-center font-bold col-grade-th text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[52px] max-w-[52px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-1 bg-transparent">
          <span class="font-khmer text-xs block text-center">${isKm ? 'និទ្ទេស' : 'Grade'}</span>
        </div>
      </th>

      <!-- Actions Column -->
      <th class="text-center p-0 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-khmer print:hidden" style="z-index: 10 !important; isolation: isolate !important; vertical-align: middle !important;">
        <div class="w-[40px] max-w-[40px] h-full min-h-[96px] mx-auto flex items-center justify-center text-center px-0.5 bg-transparent">
          ${isKm ? 'ផ្សេងៗ' : 'Actions'}
        </div>
      </th>
    `;
  },

  renderRows() {
    const isKm = i18n.getLocale() === 'km';
    const tbody = document.getElementById('scores-table-body');
    if (!tbody) return;

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
          <td colspan="${4 + (flatSubjects.length * (1 + extraColsPerSub)) + 5}" class="py-16 text-center text-muted-foreground">
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

          <!-- 5. Subject Score & Optional Rank/Grade Grid Cells -->
          ${flatSubjects.map((s, cIdx) => {
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
          }).join('')}

          <!-- 6. Total -->
          <td class="p-0 text-center font-bold font-mono text-foreground col-total bg-slate-50/60 dark:bg-slate-900/20">
            <div class="w-[64px] max-w-[64px] truncate text-center py-1.5 px-1">${r.total !== undefined ? r.total : 0}</div>
          </td>

          <!-- 7. Average -->
          <td class="p-0 text-center font-bold font-mono text-primary col-average bg-slate-50/60 dark:bg-slate-900/20">
            <div class="w-[68px] max-w-[68px] truncate text-center py-1.5 px-1">${(Number(r.average) || 0).toFixed(2)}</div>
          </td>

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
        const studentId = inp.getAttribute('data-student');
        const subjectId = inp.getAttribute('data-subject');
        const rowData = this.state.rows.find(row => row.studentId === studentId);
        if (rowData) {
          rowData.subjectScores[subjectId] = null;
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
      rowData.subjectScores[subjectId] = numVal;
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

    this.state.subjects.forEach(s => {
      if (subComponentIds.has(s.id)) return; // Don't double count sub-components

      const v = rowData.subjectScores[s.id];
      if (v !== null && v !== undefined && v !== '') {
        sum += Number(v);
      }
      maxTotal += s.fullScore;
    });

    rowData.total = Math.round(sum * 10) / 10;
    rowData.totalMax = maxTotal;

    const coeff = this.getCurrentPeriodCoefficient();
    const avgScore = coeff > 0 ? (sum / coeff) : sum;
    rowData.average = Math.round(avgScore * 100) / 100;

    // Use average to calculate the grade, where full average is 50.00 (< 25 is F)
    const gradeInfo = SubjectService.calculateGrade(rowData.average, 50);
    rowData.grade = gradeInfo.grade;
    rowData.gradeColor = gradeInfo.color;

    // Update individual subject grades for this row
    if (!rowData.subjectGrades) rowData.subjectGrades = {};
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

    const trEl = this.container.querySelector(`tr[data-student-id="${rowData.studentId}"]`);
    if (trEl) {
      const totEl = trEl.querySelector('.col-total div') || trEl.querySelector('.col-total');
      if (totEl) totEl.textContent = rowData.total;
      const avgEl = trEl.querySelector('.col-average div') || trEl.querySelector('.col-average');
      if (avgEl) avgEl.textContent = (Number(rowData.average) || 0).toFixed(2);
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
    const totalCols = this.state.subjects.length;

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
          const subjectId = targetInp.getAttribute('data-subject');
          const rowData = this.state.rows.find(r => r.studentId === studentId);
          if (rowData) {
            rowData.subjectScores[subjectId] = isNaN(numVal) ? null : numVal;
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
    clearTimeout(this.state.saveDebounceTimer);
    const statusText = document.getElementById('sync-status-text');
    if (statusText) {
      statusText.textContent = i18n.getLocale() === 'km' ? 'កំពុងកែប្រែ...' : 'Saving...';
    }

    this.state.saveDebounceTimer = setTimeout(async () => {
      try {
        await ScoreService.saveMasterScoreSheet({
          classId: this.state.selectedClassId,
          academicYear: this.state.activeYear,
          period: this.state.selectedPeriod,
          rows: this.state.rows,
          subjects: this.state.subjects
        });

        if (statusText) {
          statusText.textContent = i18n.getLocale() === 'km' ? 'បានធ្វើសមកាលកម្ម' : 'Synced';
        }
      } catch (err) {
        console.warn('Auto-save scores notice:', err);
      }
    }, 800);
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
    // Select Class
    document.getElementById('select-score-class')?.addEventListener('change', async (e) => {
      this.state.selectedClassId = e.target.value;
      if (authService.isTeacher() && this.state.selectedClassId) {
        await authService.setAssignedClassId(this.state.selectedClassId);
      }
      await this.loadScores();
    });

    // Select Period / Month
    document.getElementById('select-score-period')?.addEventListener('change', async (e) => {
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

    // Print button
    document.getElementById('btn-print-scores')?.addEventListener('click', () => {
      window.print();
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
      if (!confirm(isKm ? 'តើអ្នកប្រាកដជាចង់លុបពិន្ទុទាំងអស់ក្នុងខែនេះមែនទេ?' : 'Are you sure you want to clear all scores for this month?')) return;
      this.state.rows.forEach(r => {
        Object.keys(r.subjectScores).forEach(subId => {
          r.subjectScores[subId] = null;
        });
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

    // Download Excel Template Button
    document.getElementById('btn-download-template')?.addEventListener('click', () => {
      this.downloadExcelTemplate();
    });

    // Upload Scores Button
    const uploadInput = document.getElementById('input-file-upload-excel');
    document.getElementById('btn-upload-scores')?.addEventListener('click', () => {
      uploadInput?.click();
    });
    uploadInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.importScoresFromExcel(file);
      }
      uploadInput.value = '';
    });

    // A-F Grading Guide Button
    document.getElementById('btn-grade-scale-guide')?.addEventListener('click', () => {
      this.openGradingScaleModal();
    });
  },

  /**
   * Download Excel Template populated with current class roster
   */
  downloadExcelTemplate() {
    const isKm = i18n.getLocale() === 'km';
    if (!window.XLSX) {
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

    const flatSubjects = this.state.subjects;
    flatSubjects.forEach(s => {
      headers.push(`${s.name} (Max:${s.fullScore})`);
    });

    const data = [headers];

    this.state.rows.forEach((r, idx) => {
      let surname = (r.lastNameKh || '').trim();
      let givenName = (r.firstNameKh || '').trim();
      if (!surname && !givenName && r.khmerFullName) {
        const parts = r.khmerFullName.trim().split(/\s+/);
        surname = parts[0] || '';
        givenName = parts.slice(1).join(' ') || '';
      }

      const row = [
        idx + 1,
        r.studentNumber || '',
        surname,
        givenName,
        r.gender || 'Male'
      ];

      flatSubjects.forEach(s => {
        const score = r.subjectScores[s.id];
        row.push(score !== null && score !== undefined ? score : '');
      });

      data.push(row);
    });

    const ws = window.XLSX.utils.aoa_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Scores');
    window.XLSX.writeFile(wb, `Score_Template_${className}_${period}.xlsx`);

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
                const defaultExamVal = (e.id.includes('Semester') || e.id.includes('Annual')) ? 20 : 10;
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
        if (inp) inp.value = '20';
      });
      if (activeTopInput && exams.some(e => e.id === currentPeriod)) {
        activeTopInput.value = '20';
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
  }
};
