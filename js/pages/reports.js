/**
 * Reports & Printable Documents Center (Section 17)
 * Generates and prints official rosters, student directory, faculty list,
 * attendance reports, academic rank lists, and individual student study plans
 * (ផែនការសិស្សម្នាក់ៗ - MoEYS / SEIP standard template in A4 Landscape).
 */
import { ReportService } from '../services/reportService.js';
import { StudentPlanService } from '../services/studentPlanService.js?v=3.0.84';
import { StudentGradeBookService, formatTwoDigits, formatScoreNumber } from '../services/studentGradeBookService.js?v=3.0.84';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { ReportViewer } from '../components/reportViewer.js?v=3.0.84';
import { formatKhmerLunarDate, formatKhmerSolarDate, toKhmerNumerals } from '../utils/khmerLunar.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const ReportsPage = {
  state: {
    activeTab: 'students', // 'students', 'teachers', 'classes', 'attendance', 'rankings', 'studentPlan'
    classes: [],
    selectedClassId: 'all',
    selectedStatus: 'all',
    activeYear: '2024–2025',
    schoolNameKm: 'សាលារៀនអន្តរជាតិ ស្មាតស្គូល',
    schoolNameEn: 'SmartSchool International Academy',
    reportData: [],
    currentHeaders: [],
    studentsInClass: [],
    selectedStudentId: null
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
      this.state.activeTab = 'studentPlan';
    }

    const hash = window.location.hash || '';
    if (hash.includes('tab=')) {
      const match = hash.match(/tab=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        this.state.activeTab = match[1];
      }
    }

    const nameKm = await SettingsService.get('school_name_km');
    const nameEn = await SettingsService.get('school_name_en');
    if (nameKm) this.state.schoolNameKm = nameKm;
    if (nameEn) this.state.schoolNameEn = nameEn;

    this.renderLayout();
    await this.loadReportData();
  },

  renderLayout() {
    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-16">
        <!-- Page Header (Hidden on print) -->
        <div class="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">${t('reports.title')}</h1>
            <p class="text-sm text-muted-foreground mt-1">${t('reports.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2" id="rep-top-actions">
            ${authService.can('reports.export') ? `
              <button id="btn-export-csv" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs sm:text-sm font-medium transition-colors cursor-pointer">
                ${getIcon('download', 'w-4 h-4')}
                <span>${t('reports.exportCSV')}</span>
              </button>
            ` : ''}
            ${authService.can('reports.print') ? `
              <button id="btn-print-report" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors cursor-pointer">
                ${getIcon('printer', 'w-4 h-4')}
                <span id="btn-print-report-text">${t('reports.printReport')}</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Navigation Tabs Bar (Hidden on print) -->
        <div class="no-print p-1.5 rounded-xl border border-border bg-card shadow-sm flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'studentPlan' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="studentPlan">
            ${t('reports.studentPlanReport') || 'ផែនការសិស្សម្នាក់ៗ'}
          </button>
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'studentGradeBook' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="studentGradeBook">
            សៀវភៅសិក្ខាគារិក
          </button>
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'students' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="students">
            ${t('reports.studentReport')}
          </button>
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'rankings' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="rankings">
            ${t('reports.rankingReport')}
          </button>
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'attendance' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="attendance">
            ${t('reports.attendanceReport')}
          </button>
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'classes' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="classes">
            ${t('reports.classReport')}
          </button>
          ${authService.isTeacher() ? '' : `
            <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'teachers' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="teachers">
              ${t('reports.teacherReport')}
            </button>
          `}
        </div>

        <!-- Secondary Filter Controls (Hidden on print) -->
        <div class="no-print p-3.5 rounded-lg border border-border/80 bg-card/60 flex items-center justify-between gap-4 text-xs" id="rep-filters-box">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-2" id="filter-rep-class-box">
              <span class="text-muted-foreground">${t('reports.filterClass')}</span>
              ${authService.isTeacher() && this.state.classes.length <= 1 ? (() => {
                const assignedCls = this.state.classes.find(c => c.id === this.state.selectedClassId) || 
                                    this.state.classes.find(c => c.id === authService.getAssignedClassId()) || 
                                    this.state.classes[0];
                return assignedCls ? `
                  <div class="h-9 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary flex items-center box-border">
                    ${assignedCls.name}
                  </div>
                ` : `
                  <div class="h-9 px-3 py-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-center box-border">
                    ${t('classes.emptyList')}
                  </div>
                `;
              })() : `
                <select id="select-rep-class" class="h-9 px-2.5 py-1.5 pr-8 rounded-md border border-input bg-card text-foreground box-border shadow-xs">
                  ${authService.isTeacher() ? '' : `<option value="all">${t('common.all')}</option>`}
                  ${this.state.classes.map(c => `
                    <option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Status Filter -->
            <div class="flex items-center gap-2" id="filter-rep-status-box">
              <span class="text-muted-foreground">${t('reports.filterStatus')}</span>
              <select id="select-rep-status" class="h-9 px-2.5 py-1.5 pr-8 rounded-md border border-input bg-card text-foreground box-border shadow-xs">
                <option value="all">${t('common.all')}</option>
                <option value="Active">${t('common.active')}</option>
                <option value="Inactive">${t('common.inactive')}</option>
                <option value="Graduated">${t('common.graduated')}</option>
              </select>
            </div>
          </div>
          <span class="text-muted-foreground" id="rep-record-counter">0 records</span>
        </div>

        <!-- Printable Document Area -->
        <div id="printable-report-area" class="p-6 sm:p-8 rounded-xl border border-border bg-card shadow-sm space-y-6">
          <!-- Generic School Header (Hidden on studentPlan) -->
          <div id="rep-standard-header" class="text-center space-y-1 pb-4 border-b-2 border-border/80">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-1">
              ${getIcon('classes', 'w-6 h-6')}
            </div>
            <h2 class="text-lg sm:text-xl font-bold font-khmer text-foreground tracking-tight">${this.state.schoolNameKm}</h2>
            <h3 class="text-xs sm:text-sm font-semibold tracking-wider text-muted-foreground uppercase">${this.state.schoolNameEn}</h3>
            <div class="pt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground font-mono">
              <span>${t('reports.academicYearLabel')} <strong>${this.state.activeYear}</strong></span>
              <span>•</span>
              <span id="rep-title-badge" class="font-bold text-foreground">REPORT TITLE</span>
              <span>•</span>
              <span>${t('reports.generatedDate')} ${new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <!-- Dynamic Container Content -->
          <div id="rep-table-container">
            <div class="py-12 text-center text-muted-foreground text-xs">Loading report...</div>
          </div>

          <!-- Generic Official Signatures Footer (Hidden on studentPlan) -->
          <div id="rep-standard-footer" class="pt-8 grid grid-cols-2 gap-8 text-xs text-center">
            <div>
              <p class="font-medium text-muted-foreground">Prepared by Academic Secretary</p>
              <div class="h-16"></div>
              <p class="border-t border-border inline-block px-8 font-semibold text-foreground pt-1">School Registrar</p>
            </div>
            <div>
              <p class="font-medium text-muted-foreground">${t('reports.certifiedBy')}</p>
              <div class="h-16"></div>
              <p class="border-t border-border inline-block px-8 font-semibold text-foreground pt-1">School Principal</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindStaticEvents();
  },

  async loadReportData() {
    const tab = this.state.activeTab;
    const titleBadge = document.getElementById('rep-title-badge');
    const tableBox = document.getElementById('rep-table-container');
    const counterBox = document.getElementById('rep-record-counter');
    const stdHeader = document.getElementById('rep-standard-header');
    const stdFooter = document.getElementById('rep-standard-footer');
    const filtersBox = document.getElementById('rep-filters-box');
    const exportCsvBtn = document.getElementById('btn-export-csv');
    const topActions = document.getElementById('rep-top-actions');

    // Handle Student Individual Study Plan Tab:
    if (tab === 'studentPlan') {
      if (stdHeader) stdHeader.classList.add('hidden');
      if (stdFooter) stdFooter.classList.add('hidden');
      if (filtersBox) filtersBox.classList.add('hidden');
      if (topActions) topActions.classList.add('hidden');

      if (counterBox) counterBox.textContent = '';

      if (tableBox) {
        tableBox.innerHTML = `
          <div class="py-12 sm:py-16 px-4 flex flex-col items-center justify-center text-center">
            <div class="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-5 shadow-xs border border-primary/20">
              ${getIcon('clipboardList', 'w-10 h-10')}
            </div>
            <h2 class="text-xl sm:text-2xl font-bold font-khmer text-foreground mb-2">
              ${t('reports.studentPlanReport') || 'ផែនការសិស្សម្នាក់ៗ'}
            </h2>
            <p class="text-xs sm:text-sm text-muted-foreground font-khmer max-w-md mb-8 leading-relaxed">
              ពិនិត្យមើល កែប្រែពិន្ទុដៅ និងបោះពុម្ពតារាងផែនការសិក្សារបស់សិស្សម្នាក់ៗ ជាទម្រង់ក្រដាស A4 Landscape ផ្លូវការ
            </p>
            <button id="btn-open-student-plan-modal" type="button" class="inline-flex items-center gap-3 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm sm:text-base shadow-lg hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
              ${getIcon('printer', 'w-5 h-5')}
              <span>ផែនការសិស្ស</span>
            </button>
          </div>
        `;

        document.getElementById('btn-open-student-plan-modal')?.addEventListener('click', () => {
          this.openStudentPlanViewer();
        });
      }
      return;
    }

    // Handle Student Grade Book Tab:
    if (tab === 'studentGradeBook') {
      if (stdHeader) stdHeader.classList.add('hidden');
      if (stdFooter) stdFooter.classList.add('hidden');
      if (filtersBox) filtersBox.classList.add('hidden');
      if (topActions) topActions.classList.add('hidden');

      if (counterBox) counterBox.textContent = '';

      if (tableBox) {
        tableBox.innerHTML = `
          <div class="py-12 sm:py-16 px-4 flex flex-col items-center justify-center text-center">
            <div class="w-20 h-20 rounded-3xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-5 shadow-xs border border-blue-600/20">
              ${getIcon('bookOpen', 'w-10 h-10')}
            </div>
            <h2 class="text-xl sm:text-2xl font-bold font-khmer text-foreground mb-2">
              សៀវភៅសិក្ខាគារិក
            </h2>
            <p class="text-xs sm:text-sm text-muted-foreground font-khmer max-w-md mb-8 leading-relaxed">
              ពិនិត្យមើល និងបោះពុម្ពសៀវភៅសិក្ខាគារិក លទ្ធផលនៃការសិក្សា និងចំនួនអវត្តមានក្នុងមួយឆ្នាំរបស់សិស្សម្នាក់ៗ ជាទម្រង់ក្រដាស A4 Landscape ផ្លូវការ
            </p>
            <button id="btn-open-student-gradebook-modal" type="button" class="inline-flex items-center gap-3 px-8 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm sm:text-base shadow-lg hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
              ${getIcon('printer', 'w-5 h-5')}
              <span>សៀវភៅសិក្ខាគារិក</span>
            </button>
          </div>
        `;

        document.getElementById('btn-open-student-gradebook-modal')?.addEventListener('click', () => {
          this.openStudentGradeBookViewer();
        });
      }
      return;
    }

    // Standard Reports tabs
    if (stdHeader) stdHeader.classList.remove('hidden');
    if (stdFooter) stdFooter.classList.remove('hidden');
    if (filtersBox) filtersBox.classList.remove('hidden');
    if (topActions) topActions.classList.remove('hidden');
    if (exportCsvBtn) exportCsvBtn.classList.remove('hidden');

    let rows = [];
    let headers = [];

    if (tab === 'students') {
      if (titleBadge) titleBadge.textContent = 'OFFICIAL STUDENT DIRECTORY';
      rows = await ReportService.getStudentReport(this.state.selectedClassId, this.state.selectedStatus);
      headers = [
        { key: 'no', label: '#' },
        { key: 'studentId', label: t('students.studentId') },
        { key: 'khmerName', label: t('students.khmerName') },
        { key: 'englishName', label: t('students.englishName') },
        { key: 'gender', label: t('common.gender') },
        { key: 'className', label: t('common.class') },
        { key: 'status', label: t('common.status') },
        { key: 'parentPhone', label: t('students.parentPhone') },
        { key: 'birthplace', label: 'Birthplace' }
      ];
    } else if (tab === 'teachers') {
      if (titleBadge) titleBadge.textContent = 'FACULTY & TEACHING STAFF ROSTER';
      rows = await ReportService.getTeacherReport();
      headers = [
        { key: 'no', label: '#' },
        { key: 'teacherId', label: t('teachers.teacherId') },
        { key: 'khmerName', label: t('teachers.khmerName') },
        { key: 'englishName', label: t('teachers.englishName') },
        { key: 'gender', label: t('common.gender') },
        { key: 'subject', label: t('common.subject') },
        { key: 'position', label: t('teachers.position') },
        { key: 'phone', label: t('common.phone') },
        { key: 'status', label: t('common.status') }
      ];
    } else if (tab === 'classes') {
      if (titleBadge) titleBadge.textContent = 'CLASS DIRECTORY & ROSTERS';
      rows = await ReportService.getClassReport();
      headers = [
        { key: 'no', label: '#' },
        { key: 'className', label: t('classes.className') },
        { key: 'room', label: t('classes.room') },
        { key: 'homeroomTeacher', label: t('classes.homeroomTeacher') },
        { key: 'enrolledCount', label: 'Enrolled' },
        { key: 'activeCount', label: 'Active Learners' },
        { key: 'status', label: t('common.status') }
      ];
    } else if (tab === 'attendance') {
      if (titleBadge) titleBadge.textContent = 'ATTENDANCE SUMMARY LEDGER';
      rows = await ReportService.getAttendanceReport(this.state.selectedClassId);
      headers = [
        { key: 'no', label: '#' },
        { key: 'date', label: t('common.date') },
        { key: 'className', label: t('common.class') },
        { key: 'total', label: 'Total' },
        { key: 'present', label: t('attendance.present') },
        { key: 'absent', label: t('attendance.absent') },
        { key: 'late', label: t('attendance.late') },
        { key: 'attendanceRate', label: t('attendance.attendanceRate') }
      ];
    } else if (tab === 'rankings') {
      if (titleBadge) titleBadge.textContent = 'HONOR ROLL & STUDENT RANKINGS';
      const targetClassId = this.state.selectedClassId === 'all' ? (this.state.classes[0]?.id || '') : this.state.selectedClassId;
      rows = await ReportService.getRankingReport(targetClassId);
      headers = [
        { key: 'rank', label: t('scores.rank') },
        { key: 'studentId', label: t('students.studentId') },
        { key: 'khmerName', label: t('students.khmerName') },
        { key: 'englishName', label: t('students.englishName') },
        { key: 'gender', label: t('common.gender') },
        { key: 'totalScore', label: t('scores.totalScore') },
        { key: 'average', label: 'Average' },
        { key: 'grade', label: t('scores.grade') }
      ];
    }

    this.state.reportData = rows;
    this.state.currentHeaders = headers;

    if (counterBox) counterBox.textContent = `${rows.length} records`;

    if (!tableBox) return;

    if (rows.length === 0) {
      tableBox.innerHTML = `<p class="py-12 text-center text-xs text-muted-foreground">${t('reports.emptyReport')}</p>`;
      return;
    }

    tableBox.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b-2 border-border bg-muted/40 font-semibold text-foreground">
              ${headers.map(h => `<th class="px-3 py-2.5">${h.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            ${rows.map(row => `
              <tr class="hover:bg-muted/30">
                ${headers.map(h => {
                  const val = row[h.key] ?? '—';
                  const isRank = h.key === 'rank';
                  const isGrade = h.key === 'grade';
                  return `
                    <td class="px-3 py-2 ${isRank ? 'font-bold text-primary font-mono' : ''} ${isGrade ? 'font-bold' : ''}">
                      ${val}
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Opens the full A4 Landscape Report Viewer for Student Individual Study Plan
   */
  async openStudentPlanViewer() {
    if (typeof window !== 'undefined') {
      window.toggleSeipBaselineMode = function(e) {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }

        const currentMode = localStorage.getItem('seip_baseline_mode') || 'both';
        // Cycle: score -> grade -> both -> score ...
        let nextMode = 'score';
        if (currentMode === 'score') {
          nextMode = 'grade';
        } else if (currentMode === 'grade') {
          nextMode = 'both';
        } else {
          nextMode = 'score';
        }

        localStorage.setItem('seip_baseline_mode', nextMode);

        const cells = document.querySelectorAll('.seip-baseline-cell');
        cells.forEach(cell => {
          const score = cell.dataset.score !== undefined ? cell.dataset.score : '0';
          const grade = cell.dataset.grade || 'F';
          const redGrade = `<span style="color: #dc2626 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${grade}</span>`;

          if (nextMode === 'score') {
            cell.innerHTML = score;
          } else if (nextMode === 'grade') {
            cell.innerHTML = redGrade;
          } else {
            cell.innerHTML = `${score} , ${redGrade}`;
          }
        });

        toast.success(
          nextMode === 'score' ? '1. បង្ហាញតែពិន្ទុ (Score only)' :
          nextMode === 'grade' ? '2. បង្ហាញតែកម្រិត (Grade only)' :
          '3. បង្ហាញពិន្ទុ និងកម្រិត (Score and Grade)'
        );
      };

      window.openSeipBaselineMenu = window.toggleSeipBaselineMode;

      if (!window._seipBaselineHeaderHandlerAttached) {
        window._seipBaselineHeaderHandlerAttached = true;
        document.addEventListener('click', (e) => {
          const header = e.target.closest('#th-baseline-header');
          if (header) {
            window.toggleSeipBaselineMode(e);
          }
        });
      }

      window.toggleSeipFinalActualMode = function(e) {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }

        const currentMode = localStorage.getItem('seip_final_actual_mode') || 'both';
        // Cycle: score -> grade -> both -> score ...
        let nextMode = 'score';
        if (currentMode === 'score') {
          nextMode = 'grade';
        } else if (currentMode === 'grade') {
          nextMode = 'both';
        } else {
          nextMode = 'score';
        }

        localStorage.setItem('seip_final_actual_mode', nextMode);

        const cells = document.querySelectorAll('.seip-final-actual-cell');
        cells.forEach(cell => {
          const score = cell.dataset.score !== undefined ? cell.dataset.score : '';
          const grade = cell.dataset.grade || '';
          if (!score && !grade) {
            cell.innerHTML = '';
            return;
          }

          const redGrade = grade ? `<span style="color: #dc2626 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${grade}</span>` : '';

          if (nextMode === 'score') {
            cell.innerHTML = score;
          } else if (nextMode === 'grade') {
            cell.innerHTML = redGrade;
          } else {
            cell.innerHTML = (score && redGrade) ? `${score} , ${redGrade}` : (score || redGrade);
          }
        });

        toast.success(
          nextMode === 'score' ? 'កម្រិតពិន្ទុចុងឆ្នាំ (ជាក់ស្តែង): ១. បង្ហាញតែពិន្ទុ (Score only)' :
          nextMode === 'grade' ? 'កម្រិតពិន្ទុចុងឆ្នាំ (ជាក់ស្តែង): ២. បង្ហាញតែកម្រិត (Grade only)' :
          'កម្រិតពិន្ទុចុងឆ្នាំ (ជាក់ស្តែង): ៣. បង្ហាញពិន្ទុ និងកម្រិត (Score and Grade)'
        );
      };

      if (!window._seipFinalActualHeaderHandlerAttached) {
        window._seipFinalActualHeaderHandlerAttached = true;
        document.addEventListener('click', (e) => {
          const header = e.target.closest('#th-final-actual-header, #th-final-actual-sub-header');
          if (header) {
            window.toggleSeipFinalActualMode(e);
          }
        });
      }
    }
    let currentClassId = this.state.selectedClassId;
    if (!currentClassId || currentClassId === 'all') {
      if (this.state.classes.length > 0) {
        currentClassId = this.state.classes[0].id;
      }
    }

    let activePlanViewer = null;
    let activePlanClassId = currentClassId;

    if (typeof window !== 'undefined') {
      window.openSeipMonthPicker = async function(e, colKey, defaultLabel) {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        if (!colKey) return;

        // Clean up previous picker if any
        document.getElementById('modal-seip-period-picker')?.remove();

        const periods = StudentPlanService.getAvailablePeriods();
        const currentMapping = await StudentPlanService.getColumnPeriods(activePlanClassId);
        const currentPeriodId = currentMapping[colKey] || '';

        const modalEl = document.createElement('div');
        modalEl.id = 'modal-seip-period-picker';
        modalEl.className = 'fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-fade-in font-khmer select-none';

        const monthPeriods = periods.filter(p => p.group === 'month');
        const examPeriods = periods.filter(p => p.group === 'exam');

        modalEl.innerHTML = `
          <div class="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col text-foreground animate-scale-in">
            <!-- Header -->
            <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-bold text-sm sm:text-base text-foreground leading-tight">ជ្រើសរើសខែ ឬការប្រឡង (${escapeHtml(defaultLabel || colKey)})</h3>
                  <p class="text-[11px] text-muted-foreground mt-0.5">ជ្រើសរើសដើម្បីទាញយកពិន្ទុ/និទ្ទេសជាក់ស្តែងសម្រាប់ជួរឈរនេះ</p>
                </div>
              </div>
              <button type="button" id="btn-close-period-modal" class="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors">
                ${getIcon('x', 'w-4 h-4')}
              </button>
            </div>

            <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <!-- Monthly Tests -->
              <div>
                <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>ពិន្ទុប្រចាំខែ (Monthly Tests)</span>
                </div>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  ${monthPeriods.map(p => {
                    const isSelected = Boolean(currentPeriodId && (currentPeriodId === p.id || currentPeriodId === p.nameKm));
                    return `
                      <button type="button" class="btn-period-select px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 ${isSelected ? 'bg-primary text-primary-foreground font-bold border-primary shadow-sm' : 'bg-card border-border hover:bg-muted hover:border-primary/50 text-foreground'}" data-period-id="${escapeHtml(p.id)}" data-period-name="${escapeHtml(p.nameKm)}">
                        <span>${escapeHtml(p.nameKm)}</span>
                        <span class="text-[9.5px] opacity-75">${escapeHtml(p.nameEn)}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Semester Exams & Tests -->
              <div>
                <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>ការប្រឡងឆមាស និងតេស្ត (Exams & Assessments)</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  ${examPeriods.map(p => {
                    const isSelected = currentPeriodId && (currentPeriodId === p.id || currentPeriodId === p.nameKm);
                    return `
                      <button type="button" class="btn-period-select px-3 py-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 ${isSelected ? 'bg-primary text-primary-foreground font-bold border-primary shadow-sm' : 'bg-card border-border hover:bg-muted hover:border-primary/50 text-foreground'}" data-period-id="${escapeHtml(p.id)}" data-period-name="${escapeHtml(p.nameKm)}">
                        <span class="font-bold">${escapeHtml(p.nameKm)}</span>
                        <span class="text-[9.5px] opacity-75">${escapeHtml(p.nameEn)}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
              <button type="button" id="btn-reset-period" class="px-3.5 py-1.5 rounded-xl border border-input bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                កំណត់ដូចដើម (${escapeHtml(defaultLabel || colKey)})
              </button>
              <button type="button" id="btn-cancel-period-modal" class="px-4 py-1.5 rounded-xl border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors">
                បិទ
              </button>
            </div>
          </div>
        `;

        document.body.appendChild(modalEl);

        const closeModal = () => modalEl.remove();
        modalEl.querySelector('#btn-close-period-modal')?.addEventListener('click', closeModal);
        modalEl.querySelector('#btn-cancel-period-modal')?.addEventListener('click', closeModal);
        modalEl.addEventListener('click', (ev) => {
          if (ev.target === modalEl) closeModal();
        });

        modalEl.querySelectorAll('.btn-period-select').forEach(btn => {
          btn.addEventListener('click', async () => {
            const periodId = btn.dataset.periodId;
            const periodName = btn.dataset.periodName;
            await StudentPlanService.setColumnPeriod(activePlanClassId, colKey, periodId);
            closeModal();
            toast.success(`បានកំណត់ ${periodName} សម្រាប់ជួរ ${defaultLabel || colKey}`);
            if (activePlanViewer) {
              await activePlanViewer.refreshContent(true);
            }
          });
        });

        modalEl.querySelector('#btn-reset-period')?.addEventListener('click', async () => {
          await StudentPlanService.setColumnPeriod(activePlanClassId, colKey, null);
          closeModal();
          toast.success(`បានកំណត់ ${defaultLabel || colKey} មកដូចដើមវិញ`);
          if (activePlanViewer) {
            await activePlanViewer.refreshContent(true);
          }
        });
      };

      if (!window._seipMonthHeaderHandlerAttached) {
        window._seipMonthHeaderHandlerAttached = true;
        document.addEventListener('click', (e) => {
          const header = e.target.closest('.seip-month-col-header');
          if (header) {
            const colKey = header.dataset.monthKey;
            const colLabel = header.dataset.monthLabel || '';
            window.openSeipMonthPicker(e, colKey, colLabel);
          }
        });
      }
    }

    let studentsInClass = await StudentPlanService.getClassStudents(currentClassId);
    let currentStudentId = this.state.selectedStudentId || studentsInClass[0]?.studentId || null;
    const activeYear = this.state.activeYear;
    const isKm = (localStorage.getItem('school_lang') || 'km') === 'km';
    const classes = this.state.classes;
    const isTeacher = authService.isTeacher();

    await ReportViewer.open({
      reportKey: 'student_individual_plan',
      title: isKm ? 'ផែនការសិក្សារបស់សិស្ស' : 'Student Study Plan',
      alwaysFresh: true,
      defaultOrientation: 'landscape',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 4, bottom: 4, left: 6, right: 6 },
      defaultFontFamily: 'Kantumruy Pro',
      defaultFontSize: 8.5,
      onClose: () => document.getElementById('seip-baseline-menu')?.remove(),
      renderHeaderControls: (controlsContainer, viewer) => {
        activePlanViewer = viewer;
        const updateControls = () => {
          const currIdx = studentsInClass.findIndex(s => s.studentId === currentStudentId);
          controlsContainer.className = 'flex items-center gap-2 sm:gap-3 flex-wrap font-khmer text-xs';
          controlsContainer.innerHTML = `
            <!-- Class Filter -->
            <div class="flex items-center gap-1.5">
              <span class="text-muted-foreground whitespace-nowrap">${t('reports.filterClass') || 'ថ្នាក់រៀន:'}</span>
              ${isTeacher && classes.length <= 1 ? `
                <span class="font-semibold px-2 py-1 rounded bg-primary/10 text-primary">${classes[0]?.name || ''}</span>
              ` : `
                <select id="rv-plan-filter-class" class="h-8 py-0 px-2 rounded-md border border-input bg-card text-xs text-foreground cursor-pointer shadow-xs">
                  ${classes.map(c => `<option value="${c.id}" ${c.id === currentClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                </select>
              `}
            </div>

            <!-- Student Filter with Prev/Next -->
            <div class="flex items-center gap-1">
              <span class="text-muted-foreground whitespace-nowrap">${t('reports.filterStudent') || 'សិស្ស:'}</span>
              <button type="button" id="rv-plan-btn-prev" class="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-card hover:bg-muted text-foreground cursor-pointer shadow-xs disabled:opacity-40" ${currIdx <= 0 ? 'disabled' : ''} title="សិស្សមុន">
                ${getIcon('chevronLeft', 'w-3.5 h-3.5')}
              </button>
              <select id="rv-plan-filter-student" class="h-8 py-0 px-2 rounded-md border border-input bg-card text-xs text-foreground cursor-pointer shadow-xs max-w-[170px] sm:max-w-[210px]">
                ${studentsInClass.map((s, idx) => `
                  <option value="${s.studentId}" ${s.studentId === currentStudentId ? 'selected' : ''}>
                    ${idx + 1}. ${escapeHtml(s.khmerName || s.englishName)} (${s.studentId})
                  </option>
                `).join('')}
              </select>
              <button type="button" id="rv-plan-btn-next" class="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-card hover:bg-muted text-foreground cursor-pointer shadow-xs disabled:opacity-40" ${currIdx >= studentsInClass.length - 1 ? 'disabled' : ''} title="សិស្សបន្ទាប់">
                ${getIcon('chevronRight', 'w-3.5 h-3.5')}
              </button>
              <span class="text-muted-foreground text-[11px] whitespace-nowrap ml-1">
                (${currIdx >= 0 ? currIdx + 1 : 0}/${studentsInClass.length})
              </span>
            </div>

            <!-- Subject Visibility Filter Button -->
            <button type="button" id="rv-plan-btn-toggle-subjects" class="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer shadow-xs whitespace-nowrap active:scale-95 transition-all" title="ជ្រើសរើសមុខវិជ្ជាបង្ហាញ/លាក់">
              ${getIcon('slidersHorizontal', 'w-3.5 h-3.5 text-primary')}
              <span>មុខវិជ្ជា</span>
            </button>
          `;

          controlsContainer.querySelector('#rv-plan-filter-class')?.addEventListener('change', async (e) => {
            currentClassId = e.target.value;
            activePlanClassId = currentClassId;
            studentsInClass = await StudentPlanService.getClassStudents(currentClassId);
            currentStudentId = studentsInClass[0]?.studentId || null;
            updateControls();
            await viewer.refreshContent(true);
          });

          controlsContainer.querySelector('#rv-plan-filter-student')?.addEventListener('change', async (e) => {
            currentStudentId = e.target.value;
            updateControls();
            await viewer.refreshContent(true);
          });

          controlsContainer.querySelector('#rv-plan-btn-prev')?.addEventListener('click', async () => {
            const idx = studentsInClass.findIndex(s => s.studentId === currentStudentId);
            if (idx > 0) {
              currentStudentId = studentsInClass[idx - 1].studentId;
              updateControls();
              await viewer.refreshContent(true);
            }
          });

          controlsContainer.querySelector('#rv-plan-btn-next')?.addEventListener('click', async () => {
            const idx = studentsInClass.findIndex(s => s.studentId === currentStudentId);
            if (idx >= 0 && idx < studentsInClass.length - 1) {
              currentStudentId = studentsInClass[idx + 1].studentId;
              updateControls();
              await viewer.refreshContent(true);
            }
          });

          controlsContainer.querySelector('#rv-plan-btn-toggle-subjects')?.addEventListener('click', async () => {
            await openSubjectSelectionModal();
          });
        };

        const openSubjectSelectionModal = async () => {
          const targetClass = classes.find(c => c.id === currentClassId);
          const allSubs = await StudentPlanService.resolvePlanSubjects(targetClass);
          const hiddenList = await StudentPlanService.getHiddenSubjectIds(currentClassId, allSubs);
          const hiddenSet = new Set(hiddenList);

          // Remove any previous modal instance
          document.getElementById('modal-rv-plan-subjects')?.remove();

          const modalEl = document.createElement('div');
          modalEl.id = 'modal-rv-plan-subjects';
          modalEl.className = 'fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-fade-in font-khmer select-none';

          modalEl.innerHTML = `
            <div class="w-full max-w-md sm:max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-foreground animate-scale-in">
              <!-- Header -->
              <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    ${getIcon('slidersHorizontal', 'w-4 h-4')}
                  </div>
                  <div>
                    <h3 class="font-bold text-sm sm:text-base text-foreground leading-tight">កំណត់ការបង្ហាញមុខវិជ្ជា</h3>
                    <p class="text-[11px] text-muted-foreground mt-0.5">ជ្រើសរើសមុខវិជ្ជាដែលត្រូវបង្ហាញក្នុងតារាងផែនការ</p>
                  </div>
                </div>
                <button type="button" id="btn-close-sub-modal" class="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors">
                  ${getIcon('x', 'w-4 h-4')}
                </button>
              </div>

              <!-- Quick action bar -->
              <div class="px-4 py-2.5 border-b border-border/80 bg-muted/10 flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-1.5">
                  <button type="button" id="btn-select-all-subs" class="px-2.5 py-1 rounded-md border border-input bg-card hover:bg-muted font-medium text-[11px] transition-colors cursor-pointer shadow-xs">
                    ជ្រើសទាំងអស់
                  </button>
                  <button type="button" id="btn-deselect-all-subs" class="px-2.5 py-1 rounded-md border border-input bg-card hover:bg-muted font-medium text-[11px] transition-colors cursor-pointer shadow-xs">
                    ដោះទាំងអស់
                  </button>
                </div>
                <span id="sub-modal-selected-counter" class="text-xs text-muted-foreground font-medium"></span>
              </div>

              <!-- Subject Checkboxes List -->
              <div class="p-3 sm:p-4 overflow-y-auto flex-1 space-y-1.5 divide-y divide-border/40" id="sub-modal-list">
                ${allSubs.map((sub, idx) => {
                  const sId = sub.id || sub.code || sub.name;
                  const isChecked = !hiddenSet.has(sId) && !hiddenSet.has(sub.id) && !hiddenSet.has(sub.code);
                  return `
                    <label class="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors select-none group border border-transparent hover:border-border/40">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <input type="checkbox" class="sub-checkbox w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary" data-subject-id="${escapeHtml(sId)}" ${isChecked ? 'checked' : ''}>
                        <div class="min-w-0">
                          <div class="font-semibold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            ${idx + 1}. ${escapeHtml(sub.name || sub.nameKm || '')}
                          </div>
                        </div>
                      </div>
                      <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        ${escapeHtml(sub.code || 'SUB')}
                      </span>
                    </label>
                  `;
                }).join('')}
              </div>

              <!-- Footer -->
              <div class="px-5 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
                <button type="button" id="btn-cancel-sub-modal" class="px-4 py-2 rounded-xl border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors">
                  បោះបង់
                </button>
                <button type="button" id="btn-save-sub-modal" class="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 cursor-pointer transition-colors shadow-sm">
                  រក្សាទុក & អនុវត្ត
                </button>
              </div>
            </div>
          `;

          document.body.appendChild(modalEl);

          const updateCounter = () => {
            const total = modalEl.querySelectorAll('.sub-checkbox').length;
            const checked = modalEl.querySelectorAll('.sub-checkbox:checked').length;
            const counterEl = modalEl.querySelector('#sub-modal-selected-counter');
            if (counterEl) {
              counterEl.textContent = `បានជ្រើសរើស: ${checked} / ${total}`;
            }
          };

          updateCounter();

          modalEl.querySelectorAll('.sub-checkbox').forEach(cb => {
            cb.addEventListener('change', updateCounter);
          });

          modalEl.querySelector('#btn-select-all-subs')?.addEventListener('click', () => {
            modalEl.querySelectorAll('.sub-checkbox').forEach(cb => cb.checked = true);
            updateCounter();
          });

          modalEl.querySelector('#btn-deselect-all-subs')?.addEventListener('click', () => {
            modalEl.querySelectorAll('.sub-checkbox').forEach(cb => cb.checked = false);
            updateCounter();
          });

          const closeModal = () => modalEl.remove();
          modalEl.querySelector('#btn-close-sub-modal')?.addEventListener('click', closeModal);
          modalEl.querySelector('#btn-cancel-sub-modal')?.addEventListener('click', closeModal);
          modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) closeModal();
          });

          modalEl.querySelector('#btn-save-sub-modal')?.addEventListener('click', async () => {
            const newHiddenIds = [];
            modalEl.querySelectorAll('.sub-checkbox').forEach(cb => {
              if (!cb.checked) {
                newHiddenIds.push(cb.dataset.subjectId);
              }
            });

            await StudentPlanService.setHiddenSubjectIds(currentClassId, newHiddenIds);
            closeModal();
            toast.success('បានរក្សាទុកការកំណត់មុខវិជ្ជាជោគជ័យ');
            await viewer.refreshContent(true);
          });
        };

        updateControls();
      },
      renderContent: async (paperContainer, viewer) => {
        if (!currentStudentId) {
          paperContainer.innerHTML = `
            <div class="py-24 text-center text-xs text-muted-foreground font-khmer">
              មិនមានទិន្នន័យសិស្សក្នុងថ្នាក់នេះទេ។
            </div>
          `;
          return;
        }

        const planData = await StudentPlanService.getStudentPlan(currentClassId, currentStudentId, activeYear);
        const student = planData.student;
        const cls = planData.class;
        const school = planData.school;
        const teacher = planData.teacher;
        const subjects = planData.subjects || [];
        const subCount = subjects.length;

        // Dynamic height scaling to fit in exactly 1 single A4 Landscape page:
        // Default is 10 subjects. If user chooses more than 10, make table height shorter!
        let rowHeight = 14;
        let cellFontSize = '9px';
        let scaleFontSize = '7.5px';

        if (subCount > 13) {
          rowHeight = 12;
          cellFontSize = '7.5px';
          scaleFontSize = '6.5px';
        } else if (subCount > 10) {
          rowHeight = 13;
          cellFontSize = '8px';
          scaleFontSize = '7px';
        }

        const reportDateObj = planData.reportDate ? new Date(planData.reportDate) : new Date();
        const lunarDateText = formatKhmerLunarDate(reportDateObj) || '';
        const solarDateText = formatKhmerSolarDate(reportDateObj) || '';
        const scaleMatrix = StudentPlanService.getScoreScaleMatrix();
        const schoolDisplayName = (school.nameKm && school.nameKm !== '—') 
          ? school.nameKm 
          : (this.state.schoolNameKm || 'សាលារៀន');

        // Clean up any lingering baseline popover
        document.getElementById('seip-baseline-menu')?.remove();
        let currentBaselineMode = localStorage.getItem('seip_baseline_mode') || 'both';
        let currentFinalActualMode = localStorage.getItem('seip_final_actual_mode') || 'both';

        const renderBaselineHtml = (subItem, mode = currentBaselineMode) => {
          const score = escapeHtml(subItem.baselineScore !== undefined && subItem.baselineScore !== null ? String(subItem.baselineScore) : '0');
          const grade = escapeHtml(subItem.baselineGrade || 'F');
          const redGradeHtml = `<span style="color: #dc2626 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${grade}</span>`;

          if (mode === 'score') {
            return score;
          }
          if (mode === 'grade') {
            return redGradeHtml;
          }
          return `${score} , ${redGradeHtml}`;
        };

        const renderFinalActualHtml = (subItem, mode = currentFinalActualMode) => {
          const score = escapeHtml(subItem.actualFinalScore !== undefined && subItem.actualFinalScore !== null ? String(subItem.actualFinalScore) : '');
          const grade = escapeHtml(subItem.actualFinalGrade || '');
          if (!score && !grade) return '';

          const redGradeHtml = grade ? `<span style="color: #dc2626 !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${grade}</span>` : '';

          if (mode === 'score') {
            return score || '';
          }
          if (mode === 'grade') {
            return redGradeHtml || '';
          }
          if (score && redGradeHtml) {
            return `${score} , ${redGradeHtml}`;
          }
          return score || redGradeHtml || '';
        };

        paperContainer.innerHTML = `
          <div class="report-explicit-page student-plan-sheet font-khmer text-black leading-tight select-text" style="color: #000000 !important; width: 100%;">
            <style>
              .student-plan-sheet {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .score-scale-text {
                font-size: ${scaleFontSize} !important;
                line-height: 1.15 !important;
              }
              table.seip-score-table,
              table.seip-score-table thead,
              table.seip-score-table tbody,
              table.seip-score-table tr,
              table.seip-score-table th,
              table.seip-score-table td,
              .seip-score-table,
              .seip-score-table th,
              .seip-score-table td {
                border: 1px solid #000000 !important;
                border-top: 1px solid #000000 !important;
                border-bottom: 1px solid #000000 !important;
                border-left: 1px solid #000000 !important;
                border-right: 1px solid #000000 !important;
                border-color: #000000 !important;
              }
              .seip-score-table {
                border-collapse: collapse !important;
                margin-bottom: 4px !important;
                table-layout: fixed !important;
                width: 100% !important;
              }
              .seip-score-table tr {
                height: ${rowHeight}px !important;
                max-height: ${rowHeight}px !important;
              }
              .seip-score-table th,
              .seip-score-table td {
                text-align: center !important;
                vertical-align: middle !important;
                line-height: 1 !important;
              }
              .seip-score-table th {
                font-size: ${cellFontSize} !important;
                padding: 1px 1px !important;
              }
              .seip-score-table td {
                height: ${rowHeight}px !important;
                max-height: ${rowHeight}px !important;
                font-size: ${cellFontSize} !important;
                padding: 0 1px !important;
              }
              table.seip-score-table,
              table.seip-score-table *,
              .seip-score-table,
              .seip-score-table th,
              .seip-score-table td {
                -webkit-user-modify: read-only !important;
              }
            </style>
            <!-- Top Header Section (School Name & Royal Motto) -->
            <div class="flex items-start justify-between font-khmer select-none leading-tight pr-2 mb-0.5">
              <!-- Top Left: School Name -->
              <div class="text-left space-y-0.5 pt-0.5">
                <p class="font-bold text-xs leading-relaxed tracking-wide font-khmer-muol" style="font-family: 'Khmer OS Muol Light', 'Khmer OS Moul Light', 'Moul', cursive, sans-serif;">
                  <span class="report-nudge-box outline-none" contenteditable="true" spellcheck="false" style="display: inline-block; position: relative; left: 0px; top: 20px;">${escapeHtml(schoolDisplayName)}</span>
                </p>
              </div>

              <!-- Top Right: Royal Motto -->
              <div class="text-center">
                <div class="font-bold text-xs leading-relaxed tracking-wide font-khmer-muol" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div class="font-bold text-[10.5px] leading-relaxed tracking-wider font-khmer-muol" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                <div class="text-[8px] text-gray-500 tracking-widest mt-0.5 select-none font-bold">៚៚៚</div>
              </div>
            </div>

            <!-- Main Document Title -->
            <div class="text-center my-0.5">
              <h2 class="text-sm sm:text-base font-bold tracking-tight font-khmer-muol" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">
                ផែនការសិក្សារបស់សិស្ស ឆ្នាំសិក្សា${toKhmerNumerals(planData.academicYear)}
              </h2>
            </div>

            <!-- Metadata Block (Simple text, borderless, compact text centered) -->
            <div class="text-[9px] leading-tight mb-1 space-y-0.5 text-center" style="border: none !important; padding: 0 !important; line-height: 1.25 !important;">
              <!-- Row 1: Student info -->
              <div class="flex items-center justify-center gap-x-5 flex-wrap">
                <div class="flex items-center gap-1">
                  <span class="font-bold">ឈ្មោះសិស្ស ៖</span>
                  <span class="font-bold font-khmer-muol text-blue-700 text-[9.5px]" style="font-family: 'Khmer OS Muol Light', 'Khmer OS Moul Light', 'Moul', cursive, sans-serif; color: #1d4ed8 !important; text-decoration: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${escapeHtml(student.khmerName || student.englishName || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">ភេទ ៖</span>
                  <span>${escapeHtml(student.gender || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">អត្តលេខ ៖</span>
                  <span class="font-mono">${escapeHtml(student.studentId || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">ថ្នាក់ទី ៖</span>
                  <span class="font-bold">${escapeHtml(cls.name || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">ស្ថានភាពគ្រួសារ ៖</span>
                  <span>${escapeHtml(student.familyStatus || '—')}</span>
                </div>
              </div>

              <!-- Row 2: School & Homeroom Teacher -->
              <div class="flex items-center justify-center gap-x-5 flex-wrap">
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">សាលារៀន ៖</span>
                  <span>${escapeHtml(schoolDisplayName)}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ខេត្ត ៖</span>
                  <span>${escapeHtml(school.province || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ឈ្មោះគ្រូបន្ទុកថ្នាក់ ៖</span>
                  <span>${escapeHtml(teacher.name || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <span class="font-mono">${escapeHtml(teacher.phone || '—')}</span>
                </div>
              </div>

              <!-- Row 3: Parents -->
              <div class="flex items-center justify-center gap-x-5 flex-wrap">
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ឈ្មោះឪពុក ៖</span>
                  <span>${escapeHtml(student.fatherName || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <span class="font-mono">${escapeHtml(student.fatherPhone || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ឈ្មោះម្តាយ ៖</span>
                  <span>${escapeHtml(student.motherName || '—')}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <span class="font-mono">${escapeHtml(student.motherPhone || '—')}</span>
                </div>
              </div>
            </div>

            <!-- Score Scale Matrix (2 Columns without box: 3 in left column, 3 in right column, indented 4 tabs) -->
            <div class="score-scale-text mb-1 grid grid-cols-2 gap-x-3 text-[7.5px] leading-tight pl-16" style="line-height: 1.15 !important; display: grid !important; grid-template-columns: 1fr 1fr !important; border: none !important; padding-left: 4rem !important;">
              <div class="space-y-0.5">
                ${scaleMatrix.slice(0, 3).map(row => `
                  <div class="flex items-baseline gap-1 flex-wrap">
                    <span class="font-bold shrink-0 text-black">${escapeHtml(row.scaleLabel)}</span>
                    <span class="text-gray-900">${escapeHtml(row.grades.map(g => g.text).join(', '))}</span>
                  </div>
                `).join('')}
              </div>
              <div class="space-y-0.5">
                ${scaleMatrix.slice(3, 6).map(row => `
                  <div class="flex items-baseline gap-1 flex-wrap">
                    <span class="font-bold shrink-0 text-black">${escapeHtml(row.scaleLabel)}</span>
                    <span class="text-gray-900">${escapeHtml(row.grades.map(g => g.text).join(', '))}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 24-Column Score Table (Fixed layout, equal-width score columns, uniform 1px black border, centered data) -->
            <table contenteditable="false" class="seip-score-table no-shadcn w-full border-collapse text-[8.5px] leading-tight mb-1 select-none" style="border: 1px solid #000000 !important; table-layout: fixed; -webkit-user-modify: read-only !important;">
              <colgroup>
                <col style="width: 14%;">
                <col style="width: 6%;">
                ${Array(22).fill('<col style="width: 3.636%;">').join('')}
              </colgroup>
              <thead>
                <tr class="bg-gray-100 text-center font-bold" style="height: 18px; border-bottom: 1px solid #000000 !important;">
                  <th rowspan="2" class="p-0.5 text-center" style="border: 1px solid #000000 !important;">មុខវិជ្ជា</th>
                  <th rowspan="2" id="th-baseline-header" onclick="window.toggleSeipBaselineMode && window.toggleSeipBaselineMode(event)" class="p-0.5 text-center cursor-pointer select-none hover:bg-gray-200 transition-colors" style="border: 1px solid #000000 !important; cursor: pointer !important;" title="ចុចដើម្បីប្តូររបៀបបង្ហាញ (Click to toggle: Score -> Grade -> Both)">
                    កម្រិតពិន្ទុ<br>ដើមឆ្នាំ
                  </th>
                  <th colspan="20" class="p-0.5 text-center" style="border: 1px solid #000000 !important;">
                    កម្រិតពិន្ទុនិងលទ្ធផលដើមឆ្នាំ(ខ្មៅ) និងចុងឆ្នាំ(<span style="color: #dc2626 !important;">ក្រហម</span>)
                  </th>
                  <th colspan="2" id="th-final-actual-header" onclick="window.toggleSeipFinalActualMode && window.toggleSeipFinalActualMode(event)" class="p-0.5 text-center cursor-pointer select-none hover:bg-gray-200 transition-colors" style="color: #dc2626 !important; border: 1px solid #000000 !important; cursor: pointer !important;" title="ចុចដើម្បីប្តូររបៀបបង្ហាញក្នុងជួរជាក់ស្តែង (Click to toggle: Score -> Grade -> Both)">
                    កម្រិតពិន្ទុ<br>ចុងឆ្នាំ
                  </th>
                </tr>
                <tr class="bg-gray-50 text-center font-bold text-[7.5px]" style="min-height: 18px; border-bottom: 1px solid #000000 !important;">
                  ${(planData.months || StudentPlanService.getMonths()).map(m => {
                    const periodName = m.periodNameKm || (m.isChosen ? m.nameKm : '');
                    const headerHtml = periodName
                      ? `<div class="leading-none py-0.5"><span class="block">${escapeHtml(m.labelKm)}</span><span class="block text-[6.5px] font-semibold mt-0.5">(${escapeHtml(periodName)})</span></div>`
                      : `<div class="leading-none py-0.5"><span class="block">${escapeHtml(m.labelKm)}</span></div>`;
                    return `
                      <th data-month-key="${m.key}" data-month-label="${m.labelKm}" onclick="window.openSeipMonthPicker && window.openSeipMonthPicker(event, '${m.key}', '${m.labelKm}')" class="seip-month-col-header p-0 text-center whitespace-nowrap overflow-hidden cursor-pointer hover:bg-gray-200 select-none transition-colors" style="border: 1px solid #000000 !important; cursor: pointer !important; vertical-align: middle !important;" title="ចុចដើម្បីជ្រើសរើសខែ ឬការប្រឡង">
                        ${headerHtml}
                      </th>
                      <th class="p-0 text-center whitespace-nowrap overflow-hidden" style="color: #dc2626 !important; border: 1px solid #000000 !important; vertical-align: middle !important;">ជាក់ស្តែង</th>
                    `;
                  }).join('')}
                  <th class="p-0 text-center whitespace-nowrap overflow-hidden" style="border: 1px solid #000000 !important; vertical-align: middle !important;">ដាក់ពិន្ទុ</th>
                  <th id="th-final-actual-sub-header" onclick="window.toggleSeipFinalActualMode && window.toggleSeipFinalActualMode(event)" class="p-0 text-center whitespace-nowrap overflow-hidden cursor-pointer hover:bg-gray-200 transition-colors" style="color: #dc2626 !important; border: 1px solid #000000 !important; vertical-align: middle !important; cursor: pointer !important;" title="ចុចដើម្បីប្តូររបៀបបង្ហាញ (Click to toggle: Score -> Grade -> Both)">ជាក់ស្តែង</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map((sub, sIdx) => `
                  <tr style="height: ${rowHeight}px !important; border-bottom: 1px solid #000000 !important;" data-subject-id="${sub.id}">
                    <td class="font-medium whitespace-nowrap overflow-hidden text-center" style="font-size: ${cellFontSize}; height: ${rowHeight}px !important; padding: 0 2px; border: 1px solid #000000 !important;">
                      ${sub.name}
                    </td>
                    <!-- Baseline -->
                    <td class="seip-baseline-cell font-medium text-center" data-subject-id="${sub.id}" data-score="${escapeHtml(sub.baselineScore !== undefined && sub.baselineScore !== null ? String(sub.baselineScore) : '0')}" data-grade="${escapeHtml(sub.baselineGrade || 'F')}" style="font-size: ${cellFontSize}; height: ${rowHeight}px !important; border: 1px solid #000000 !important;">
                      ${renderBaselineHtml(sub, currentBaselineMode)}
                    </td>
                    <!-- 10 Months -->
                    ${sub.months.map(m => `
                      <td class="font-medium text-center" style="font-size: ${cellFontSize}; height: ${rowHeight}px !important; border: 1px solid #000000 !important;">
                        ${escapeHtml(m.target || '')}
                      </td>
                      <td class="font-bold text-center" style="background-color: #fff1f2; font-size: ${cellFontSize}; color: #dc2626 !important; height: ${rowHeight}px !important; border: 1px solid #000000 !important;">
                        ${escapeHtml(m.actual || '')}
                      </td>
                    `).join('')}
                    <!-- End of year Target -->
                    <td class="font-medium text-center" style="font-size: ${cellFontSize}; height: ${rowHeight}px !important; border: 1px solid #000000 !important;">
                      ${escapeHtml(sub.targetFinal || '')}
                    </td>
                    <!-- End of year Actual -->
                    <td class="seip-final-actual-cell font-medium text-center" data-subject-id="${sub.id}" data-score="${escapeHtml(sub.actualFinalScore !== undefined && sub.actualFinalScore !== null ? String(sub.actualFinalScore) : '')}" data-grade="${escapeHtml(sub.actualFinalGrade || '')}" style="background-color: #fff1f2; font-size: ${cellFontSize}; height: ${rowHeight}px !important; border: 1px solid #000000 !important;">
                      ${renderFinalActualHtml(sub, currentFinalActualMode)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Signatures Footer -->
            <div class="grid grid-cols-3 gap-2 text-center text-[9px] font-khmer mt-2" style="line-height: 1.2;">
              <!-- Principal -->
              <div>
                <p class="font-semibold text-[8px]">បានឃើញ និងឯកភាព</p>
                <p class="font-bold text-[8.5px]">នាយកសាលា</p>
                <div style="height: 24px;"></div>
              </div>

              <!-- Parent / Guardian -->
              <div>
                <p class="font-semibold text-[8px]">បានឃើញ និងឯកភាព</p>
                <p class="font-bold text-[8.5px]">មាតាបិតា ឬអាណាព្យាបាលសិស្ស</p>
                <div style="height: 24px;"></div>
              </div>

              <!-- Student -->
              <div>
                <p class="text-[7.5px] leading-tight font-medium">${lunarDateText}</p>
                <p class="text-[7.5px] leading-tight font-medium">${school.province ? `${school.province} ` : ''}${solarDateText}</p>
                <p class="font-bold pt-0.5 text-[8px]">ហត្ថលេខានិងឈ្មោះសិស្ស</p>
                <div style="height: 16px;"></div>
                <p class="font-bold font-khmer-muol text-blue-700 text-[8.5px] report-nudge-box outline-none inline-block px-4" contenteditable="true" spellcheck="false" style="font-family: 'Khmer OS Muol Light', 'Khmer OS Moul Light', 'Moul', cursive, sans-serif; color: #1d4ed8 !important; text-decoration: none !important; display: inline-block; position: relative; left: 2rem; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${escapeHtml(student.khmerName || student.englishName)}</p>
              </div>
            </div>
          </div>
        `;
      }
    });
  },

  /**
   * Opens the full A4 Portrait Report Viewer for Student Grade Book (សៀវភៅសិក្ខាគារិក)
   */
  async openStudentGradeBookViewer() {
    let currentClassId = this.state.selectedClassId;
    if (!currentClassId || currentClassId === 'all') {
      const assignedId = authService.getAssignedClassId();
      if (assignedId && this.state.classes.some(c => c.id === assignedId)) {
        currentClassId = assignedId;
      } else {
        currentClassId = this.state.classes[0]?.id || null;
      }
    }

    let studentsInClass = await StudentGradeBookService.getClassStudents(currentClassId);
    let currentStudentId = this.state.selectedStudentId || studentsInClass[0]?.studentId || null;
    const activeYear = this.state.activeYear;
    const isKm = (localStorage.getItem('school_lang') || 'km') === 'km';
    const classes = this.state.classes;
    const isTeacher = authService.isTeacher();

    await ReportViewer.open({
      reportKey: 'student_grade_book',
      title: isKm ? 'សៀវភៅសិក្ខាគារិក' : 'Student Grade Book',
      alwaysFresh: true,
      forceOrientation: 'landscape',
      defaultOrientation: 'landscape',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 4, bottom: 4, left: 5, right: 5 },
      defaultFontFamily: 'Kantumruy Pro',
      defaultFontSize: 8.5,
      renderHeaderControls: (controlsContainer, viewer) => {
        const updateControls = () => {
          const currIdx = studentsInClass.findIndex(s => s.studentId === currentStudentId || s.id === currentStudentId);
          controlsContainer.className = 'flex items-center gap-2 sm:gap-3 flex-wrap font-khmer text-xs';
          controlsContainer.innerHTML = `
            <!-- Class Filter -->
            <div class="flex items-center gap-1.5">
              <span class="text-muted-foreground whitespace-nowrap">${t('reports.filterClass') || 'ថ្នាក់រៀន:'}</span>
              ${isTeacher && classes.length <= 1 ? `
                <span class="font-semibold px-2 py-1 rounded bg-primary/10 text-primary">${classes[0]?.name || ''}</span>
              ` : `
                <select id="rv-gb-filter-class" class="h-8 py-0 px-2 rounded-md border border-input bg-card text-xs text-foreground cursor-pointer shadow-xs">
                  ${classes.map(c => `<option value="${c.id}" ${c.id === currentClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                </select>
              `}
            </div>

            <!-- Student Filter with Prev/Next -->
            <div class="flex items-center gap-1">
              <span class="text-muted-foreground whitespace-nowrap">${t('reports.filterStudent') || 'សិស្ស:'}</span>
              <button type="button" id="rv-gb-btn-prev" class="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-card hover:bg-muted text-foreground cursor-pointer shadow-xs disabled:opacity-40" ${currIdx <= 0 ? 'disabled' : ''} title="សិស្សមុន">
                ${getIcon('chevronLeft', 'w-3.5 h-3.5')}
              </button>
              <select id="rv-gb-filter-student" class="h-8 py-0 px-2 rounded-md border border-input bg-card text-xs text-foreground cursor-pointer shadow-xs max-w-[170px] sm:max-w-[210px]">
                ${studentsInClass.map((s, idx) => `
                  <option value="${s.studentId}" ${s.studentId === currentStudentId ? 'selected' : ''}>
                    ${idx + 1}. ${escapeHtml(s.khmerName || s.englishName)} (${s.studentId})
                  </option>
                `).join('')}
              </select>
              <button type="button" id="rv-gb-btn-next" class="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-card hover:bg-muted text-foreground cursor-pointer shadow-xs disabled:opacity-40" ${currIdx >= studentsInClass.length - 1 ? 'disabled' : ''} title="សិស្សបន្ទាប់">
                ${getIcon('chevronRight', 'w-3.5 h-3.5')}
              </button>
              <span class="text-muted-foreground text-[11px] whitespace-nowrap ml-1">
                (${currIdx >= 0 ? currIdx + 1 : 0}/${studentsInClass.length})
              </span>
            </div>

            <!-- Subject Visibility Filter Button -->
            <button type="button" id="rv-gb-btn-toggle-subjects" class="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer shadow-xs whitespace-nowrap active:scale-95 transition-all" title="ជ្រើសរើសមុខវិជ្ជាបង្ហាញ/លាក់">
              ${getIcon('slidersHorizontal', 'w-3.5 h-3.5 text-blue-600')}
              <span>មុខវិជ្ជា</span>
            </button>
          `;

          controlsContainer.querySelector('#rv-gb-filter-class')?.addEventListener('change', async (e) => {
            currentClassId = e.target.value;
            studentsInClass = await StudentGradeBookService.getClassStudents(currentClassId);
            currentStudentId = studentsInClass[0]?.studentId || null;
            updateControls();
            await viewer.refreshContent(true);
          });

          controlsContainer.querySelector('#rv-gb-filter-student')?.addEventListener('change', async (e) => {
            currentStudentId = e.target.value;
            updateControls();
            await viewer.refreshContent(true);
          });

          controlsContainer.querySelector('#rv-gb-btn-prev')?.addEventListener('click', async () => {
            const idx = studentsInClass.findIndex(s => s.studentId === currentStudentId || s.id === currentStudentId);
            if (idx > 0) {
              currentStudentId = studentsInClass[idx - 1].studentId;
              updateControls();
              await viewer.refreshContent(true);
            }
          });

          controlsContainer.querySelector('#rv-gb-btn-next')?.addEventListener('click', async () => {
            const idx = studentsInClass.findIndex(s => s.studentId === currentStudentId || s.id === currentStudentId);
            if (idx >= 0 && idx < studentsInClass.length - 1) {
              currentStudentId = studentsInClass[idx + 1].studentId;
              updateControls();
              await viewer.refreshContent(true);
            }
          });

          controlsContainer.querySelector('#rv-gb-btn-toggle-subjects')?.addEventListener('click', async () => {
            await openGradeBookSubjectSelectionModal();
          });
        };

        const openGradeBookSubjectSelectionModal = async () => {
          const targetClass = classes.find(c => c.id === currentClassId) || { id: currentClassId, name: '—' };
          const allSubs = await StudentGradeBookService.getGradeBookSubjects(targetClass);
          const hiddenList = await StudentGradeBookService.getHiddenSubjectIds(currentClassId);
          const hiddenSet = new Set(hiddenList);

          document.getElementById('modal-rv-gb-subjects')?.remove();

          const modalEl = document.createElement('div');
          modalEl.id = 'modal-rv-gb-subjects';
          modalEl.className = 'fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-fade-in font-khmer select-none';

          modalEl.innerHTML = `
            <div class="w-full max-w-md sm:max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-foreground animate-scale-in">
              <!-- Header -->
              <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center">
                    ${getIcon('slidersHorizontal', 'w-4 h-4')}
                  </div>
                  <div>
                    <h3 class="font-bold text-sm sm:text-base text-foreground leading-tight">កំណត់ការបង្ហាញមុខវិជ្ជា</h3>
                    <p class="text-[11px] text-muted-foreground mt-0.5">ជ្រើសរើសមុខវិជ្ជាដែលត្រូវបង្ហាញក្នុងសៀវភៅសិក្ខាគារិក</p>
                  </div>
                </div>
                <button type="button" id="btn-close-gb-sub-modal" class="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors">
                  ${getIcon('x', 'w-4 h-4')}
                </button>
              </div>

              <!-- Quick action bar -->
              <div class="px-4 py-2.5 border-b border-border/80 bg-muted/10 flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-1.5">
                  <button type="button" id="btn-select-all-gb-subs" class="px-2.5 py-1 rounded-md border border-input bg-card hover:bg-muted font-medium text-[11px] transition-colors cursor-pointer shadow-xs">
                    ជ្រើសទាំងអស់
                  </button>
                  <button type="button" id="btn-deselect-all-gb-subs" class="px-2.5 py-1 rounded-md border border-input bg-card hover:bg-muted font-medium text-[11px] transition-colors cursor-pointer shadow-xs">
                    ដោះទាំងអស់
                  </button>
                </div>
                <span id="gb-sub-modal-selected-counter" class="text-xs text-muted-foreground font-medium"></span>
              </div>

              <!-- Subject Checkboxes List -->
              <div class="p-3 sm:p-4 overflow-y-auto flex-1 space-y-1.5 divide-y divide-border/40" id="gb-sub-modal-list">
                ${allSubs.map((sub, idx) => {
                  const sId = sub.id || sub.code || sub.name;
                  const isChecked = !hiddenSet.has(sId) && !hiddenSet.has(sub.id) && !hiddenSet.has(sub.code);
                  return `
                    <label class="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors select-none group border border-transparent hover:border-border/40">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <input type="checkbox" class="gb-sub-checkbox w-4 h-4 rounded text-blue-600 focus:ring-blue-600 cursor-pointer accent-blue-600" data-subject-id="${escapeHtml(sId)}" ${isChecked ? 'checked' : ''}>
                        <div class="min-w-0">
                          <div class="font-semibold text-xs sm:text-sm text-foreground truncate group-hover:text-blue-600 transition-colors">
                            ${idx + 1}. ${escapeHtml(sub.name || sub.nameKm || '')}
                          </div>
                        </div>
                      </div>
                      <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        ${escapeHtml(sub.code || 'SUB')}
                      </span>
                    </label>
                  `;
                }).join('')}
              </div>

              <!-- Footer -->
              <div class="px-5 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
                <button type="button" id="btn-cancel-gb-sub-modal" class="px-4 py-2 rounded-xl border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors">
                  បោះបង់
                </button>
                <button type="button" id="btn-save-gb-sub-modal" class="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer transition-colors shadow-sm">
                  រក្សាទុក & អនុវត្ត
                </button>
              </div>
            </div>
          `;

          document.body.appendChild(modalEl);

          const updateCounter = () => {
            const total = modalEl.querySelectorAll('.gb-sub-checkbox').length;
            const checked = modalEl.querySelectorAll('.gb-sub-checkbox:checked').length;
            const counterEl = modalEl.querySelector('#gb-sub-modal-selected-counter');
            if (counterEl) {
              counterEl.textContent = `បានជ្រើស ${checked}/${total} មុខវិជ្ជា`;
            }
          };
          updateCounter();

          modalEl.querySelectorAll('.gb-sub-checkbox').forEach(cb => {
            cb.addEventListener('change', updateCounter);
          });

          modalEl.querySelector('#btn-select-all-gb-subs')?.addEventListener('click', () => {
            modalEl.querySelectorAll('.gb-sub-checkbox').forEach(cb => { cb.checked = true; });
            updateCounter();
          });

          modalEl.querySelector('#btn-deselect-all-gb-subs')?.addEventListener('click', () => {
            modalEl.querySelectorAll('.gb-sub-checkbox').forEach(cb => { cb.checked = false; });
            updateCounter();
          });

          const closeModal = () => modalEl.remove();

          modalEl.querySelector('#btn-close-gb-sub-modal')?.addEventListener('click', closeModal);
          modalEl.querySelector('#btn-cancel-gb-sub-modal')?.addEventListener('click', closeModal);
          modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) closeModal();
          });

          modalEl.querySelector('#btn-save-gb-sub-modal')?.addEventListener('click', async () => {
            const checkedBoxes = modalEl.querySelectorAll('.gb-sub-checkbox:checked');
            if (checkedBoxes.length === 0) {
              toast.error('សូមជ្រើសរើសយ៉ាងហោចណាស់ ១ មុខវិជ្ជា');
              return;
            }

            const newHidden = [];
            modalEl.querySelectorAll('.gb-sub-checkbox:not(:checked)').forEach(cb => {
              const sId = cb.getAttribute('data-subject-id');
              if (sId) newHidden.push(sId);
            });

            await StudentGradeBookService.saveHiddenSubjectIds(currentClassId, newHidden);
            closeModal();
            toast.success('បានរក្សាទុកការកំណត់មុខវិជ្ជាជោគជ័យ');
            await viewer.refreshContent(true);
          });
        };

        updateControls();
      },
      renderContent: async (contentContainer, viewer) => {
        contentContainer.innerHTML = `
          <div class="py-12 flex items-center justify-center gap-2 text-muted-foreground text-xs font-khmer">
            <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <span>កំពុងទាញយកទិន្នន័យសៀវភៅសិក្ខាគារិក...</span>
          </div>
        `;

        const data = await StudentGradeBookService.getStudentGradeBook({
          classId: currentClassId,
          studentId: currentStudentId,
          academicYear: activeYear
        });

        if (!data || !data.student) {
          contentContainer.innerHTML = `
            <div class="p-8 text-center text-muted-foreground text-xs font-khmer">
              មិនមានទិន្នន័យសិស្សសម្រាប់ថ្នាក់នេះឡើយ។
            </div>
          `;
          return;
        }

        const student = data.student;
        const studentName = student.khmerName || student.fullName || student.englishName || '—';
        const className = data.className || '—';
        const academicYear = data.academicYear || '—';

        let genderKm = 'ប្រុស';
        if (student.gender) {
          const g = String(student.gender).trim().toLowerCase();
          genderKm = (g === 'female' || g === 'f' || g === 'ស្រី' || g.includes('female') || g.includes('ស្រី')) ? 'ស្រី' : 'ប្រុស';
        }

        const subjects = data.subjects || [];
        const summary = data.summary || {};
        const att = data.attendance || {};
        const evalData = data.evaluation || {};
        const subCount = subjects.length;

        // Total body rows = selected subjects + 4 official summary rows
        const tbodyRowsCount = subCount + 4;

        // Exact available height for table body inside A4 landscape page box:
        // A4 height = 210mm. Page top/bottom pad = 4mm x 2 = 8mm -> 202mm.
        // Box border + pad = 6.8mm -> 195.2mm inner height.
        // Left Page: Top line (6.5mm) + Banner 1 (5.5mm) + thead 2 rows (13mm) = 25mm.
        // Right Page: 10 items (9 data rows + Section ង box) fit ~10.2mm max per item.
        const calculatedRowHeightMm = Math.max(7.0, Math.min(10.2, Number((168 / tbodyRowsCount).toFixed(2))));

        const cellFontSize = '9px';
        const nameFontSize = '9px';
        const bannerPadding = '2px 4px';
        const bannerFontSize = '9.5px';

        contentContainer.innerHTML = `
          <div class="report-explicit-page gradebook-landscape-spread bg-white text-black font-khmer mx-auto select-none box-border" style="width: 100%; height: 100%; max-width: 100%; font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', sans-serif;">
            <style>
              .gradebook-landscape-spread {
                width: 100% !important;
                height: 100% !important;
                box-sizing: border-box !important;
              }
              .gradebook-spread-row {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                gap: 4mm !important;
                width: 100% !important;
                height: 100% !important;
                box-sizing: border-box !important;
                background-color: #ffffff !important;
                align-items: stretch !important;
              }
              .gradebook-page-box {
                flex: 0 0 calc(50% - 2mm) !important;
                width: calc(50% - 2mm) !important;
                max-width: calc(50% - 2mm) !important;
                height: 100% !important;
                max-height: 100% !important;
                border: 1.5px solid #1e3a8a !important;
                padding: 2.5mm 3mm !important;
                background-color: #ffffff !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .gradebook-table,
              .gradebook-table thead,
              .gradebook-table tbody,
              .gradebook-table tr,
              .gradebook-table th,
              .gradebook-table td {
                border-color: #1e3a8a !important;
              }
              .gradebook-table {
                width: 100% !important;
                border-collapse: collapse !important;
                border: 1px solid #1e3a8a !important;
                font-size: ${cellFontSize} !important;
                line-height: 1.1 !important;
                table-layout: fixed !important;
                box-sizing: border-box !important;
              }
              .gradebook-table thead tr {
                height: 6.5mm !important;
                border-bottom: 1px solid #1e3a8a !important;
              }
              .gradebook-table thead th {
                height: 6.5mm !important;
                background-color: #dbeafe !important;
                color: #1e3a8a !important;
                font-weight: bold !important;
                font-size: ${cellFontSize} !important;
                border: 1px solid #1e3a8a !important;
                border-bottom: 1px solid #1e3a8a !important;
                text-align: center !important;
                vertical-align: middle !important;
                padding: 1px 2px !important;
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .gradebook-table tr.gb-tbody-row,
              .gradebook-table tbody tr {
                height: ${calculatedRowHeightMm}mm !important;
                max-height: ${calculatedRowHeightMm}mm !important;
                border-bottom: 1px solid #1e3a8a !important;
                border-color: #1e3a8a !important;
              }
              .gradebook-table tbody td {
                height: ${calculatedRowHeightMm}mm !important;
                max-height: ${calculatedRowHeightMm}mm !important;
                border: 1px solid #1e3a8a !important;
                border-top: 1px solid #1e3a8a !important;
                border-bottom: 1px solid #1e3a8a !important;
                border-left: 1px solid #1e3a8a !important;
                border-right: 1px solid #1e3a8a !important;
                text-align: center !important;
                vertical-align: middle !important;
                padding: 0 2px !important;
                font-size: ${cellFontSize} !important;
                line-height: 1.1 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                white-space: nowrap !important;
                text-overflow: ellipsis !important;
              }
              .gradebook-banner {
                background-color: #1e3a8a !important;
                color: #ffffff !important;
                text-align: center !important;
                font-weight: bold !important;
                font-size: ${bannerFontSize} !important;
                padding: ${bannerPadding} !important;
                letter-spacing: 0.2px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 0;
                }
                html, body {
                  width: 297mm !important;
                  height: 210mm !important;
                  max-height: 210mm !important;
                  overflow: hidden !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .report-explicit-page,
                .gradebook-landscape-spread,
                .a4-sheet-page,
                .report-viewer-sheet {
                  width: 297mm !important;
                  max-width: 297mm !important;
                  height: 210mm !important;
                  max-height: 210mm !important;
                  min-height: 210mm !important;
                  padding: 4mm 5mm !important;
                  margin: 0 !important;
                  box-sizing: border-box !important;
                  overflow: hidden !important;
                  page-break-before: avoid !important;
                  page-break-after: avoid !important;
                  page-break-inside: avoid !important;
                  break-before: avoid !important;
                  break-after: avoid !important;
                  break-inside: avoid !important;
                }
                .gradebook-spread-row {
                  display: flex !important;
                  flex-direction: row !important;
                  flex-wrap: nowrap !important;
                  gap: 4mm !important;
                  width: 100% !important;
                  height: 100% !important;
                  max-height: 100% !important;
                  box-sizing: border-box !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .gradebook-page-box {
                  flex: 0 0 calc(50% - 2mm) !important;
                  width: calc(50% - 2mm) !important;
                  max-width: calc(50% - 2mm) !important;
                  height: 100% !important;
                  max-height: 100% !important;
                  border: 1.5px solid #1e3a8a !important;
                  padding: 2.5mm 3mm !important;
                  box-sizing: border-box !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .gradebook-table,
                .gradebook-table thead,
                .gradebook-table tbody,
                .gradebook-table tr,
                .gradebook-table th,
                .gradebook-table td {
                  border-color: #1e3a8a !important;
                }
                .gradebook-table thead th {
                  background-color: #dbeafe !important;
                  color: #1e3a8a !important;
                  border: 1px solid #1e3a8a !important;
                }
                .gradebook-table tbody td {
                  border: 1px solid #1e3a8a !important;
                }
                .gradebook-banner {
                  background-color: #1e3a8a !important;
                  color: #ffffff !important;
                }
              }
            </style>

            <div class="gradebook-spread-row">
              <!-- ================= LEFT PAGE: Section 1 (Score Table) ================= -->
              <div class="gradebook-page-box">
                <div class="flex flex-col justify-between h-full">
                  <div>
                    <!-- Top Header: Student Name, Gender, Class, Academic Year -->
                    <div class="flex items-center justify-between font-bold text-[9px] mb-1 px-0.5 text-black whitespace-nowrap" style="min-height: 5mm;">
                      <div>
                        <span>ឈ្មោះសិស្ស៖ </span>
                        <span class="font-khmer-muol text-[#1e3a8a] text-[9.5px]" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">${escapeHtml(studentName)}</span>
                        <span class="ml-2">ភេទ៖ </span>
                        <span class="font-bold text-[#1e3a8a]" contenteditable="true" spellcheck="false">${escapeHtml(genderKm)}</span>
                      </div>
                      <div class="text-center">
                        <span>ថ្នាក់ទី៖ </span>
                        <span class="font-bold text-[#1e3a8a]" contenteditable="true" spellcheck="false">${escapeHtml(className)}</span>
                      </div>
                      <div class="text-right">
                        <span>ឆ្នាំសិក្សា៖ </span>
                        <span class="font-bold text-[#1e3a8a]" contenteditable="true" spellcheck="false">${escapeHtml(academicYear)}</span>
                      </div>
                    </div>

                    <!-- Section 1 Banner -->
                    <div class="gradebook-banner mb-0">
                      ១ / លទ្ធផលនៃការសិក្សា
                    </div>

                    <!-- Main Score Table -->
                    <table class="gradebook-table no-shadcn">
                      <thead>
                        <tr style="height: 6.5mm !important;">
                          <th rowspan="2" style="width: 22px;">ល.រ</th>
                          <th rowspan="2" style="width: 104px;">មុខវិជ្ជា</th>
                          <th colspan="2">ឆមាស១</th>
                          <th colspan="2">ឆមាស២</th>
                          <th colspan="2">ប្រចាំឆ្នាំ</th>
                          <th rowspan="2" style="width: 80px;">មូលវិចារ ហត្ថលេខា<br>និងឈ្មោះគ្រូ</th>
                        </tr>
                        <tr style="height: 6.5mm !important;">
                          <th style="width: 32px;">ម.ភាគ</th>
                          <th style="width: 38px;">ចំណាត់ថ្នាក់</th>
                          <th style="width: 32px;">ម.ភាគ</th>
                          <th style="width: 38px;">ចំណាត់ថ្នាក់</th>
                          <th style="width: 32px;">ម.ភាគ</th>
                          <th style="width: 38px;">ចំណាត់ថ្នាក់</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${subjects.map(s => `
                          <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                            <td style="font-size: ${cellFontSize};">${s.indexKm}</td>
                            <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500; font-size: ${nameFontSize};">${escapeHtml(s.name)}</td>
                            <td class="font-mono">${formatScoreNumber(s.sem1Score)}</td>
                            <td class="font-mono font-semibold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${s.sem1Rank || ''}</td>
                            <td class="font-mono">${formatScoreNumber(s.sem2Score)}</td>
                            <td class="font-mono font-semibold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${s.sem2Rank || ''}</td>
                            <td class="font-mono">${formatScoreNumber(s.annualScore)}</td>
                            <td class="font-mono font-semibold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${s.annualRank || ''}</td>
                            <td style="font-size: ${cellFontSize}; font-weight: 500;">${escapeHtml(s.remark || '')}</td>
                          </tr>
                        `).join('')}

                        <!-- Row 17: សរុបពិន្ទុរួមប្រឡងឆមាស -->
                        <tr class="gb-tbody-row" style="background-color: #f8fafc; font-weight: 600; height: ${calculatedRowHeightMm}mm !important;">
                          <td style="font-size: ${cellFontSize};">${summary.examTotal?.indexKm || ''}</td>
                          <td style="text-align: left !important; padding-left: 5px !important; font-size: ${nameFontSize};">${summary.examTotal?.name || 'សរុបពិន្ទុរួមប្រឡងឆមាស'}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.examTotal?.sem1)}</td>
                          <td></td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.examTotal?.sem2)}</td>
                          <td></td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.examTotal?.annual)}</td>
                          <td></td>
                          <td></td>
                        </tr>

                        <!-- Row 18: មធ្យមភាគពិន្ទុរួមប្រឡងឆមាស -->
                        <tr class="gb-tbody-row" style="background-color: #f8fafc; font-weight: 600; height: ${calculatedRowHeightMm}mm !important;">
                          <td style="font-size: ${cellFontSize};">${summary.examAvg?.indexKm || ''}</td>
                          <td style="text-align: left !important; padding-left: 5px !important; font-size: ${nameFontSize};">${summary.examAvg?.name || 'មធ្យមភាគពិន្ទុរួមប្រឡងឆមាស'}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.examAvg?.sem1)}</td>
                          <td class="font-mono font-bold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${summary.examAvg?.sem1Rank || ''}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.examAvg?.sem2)}</td>
                          <td class="font-mono font-bold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${summary.examAvg?.sem2Rank || ''}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.examAvg?.annual)}</td>
                          <td class="font-mono font-bold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${summary.examAvg?.annualRank || ''}</td>
                          <td style="font-size: ${cellFontSize}; font-weight: 600; color: #1e3a8a;">${escapeHtml(summary.examAvg?.remark || '')}</td>
                        </tr>

                        <!-- Row 19: មធ្យមភាគពិន្ទុផ្ទៃក្នុងប្រចាំឆមាស -->
                        <tr class="gb-tbody-row" style="background-color: #f8fafc; font-weight: 600; height: ${calculatedRowHeightMm}mm !important;">
                          <td style="font-size: ${cellFontSize};">${summary.internalAvg?.indexKm || ''}</td>
                          <td style="text-align: left !important; padding-left: 5px !important; font-size: ${nameFontSize};">${summary.internalAvg?.name || 'មធ្យមភាគពិន្ទុផ្ទៃក្នុងប្រចាំឆមាស'}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.internalAvg?.sem1)}</td>
                          <td></td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.internalAvg?.sem2)}</td>
                          <td></td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.internalAvg?.annual)}</td>
                          <td></td>
                          <td></td>
                        </tr>

                        <!-- Row 20: មធ្យមភាគប្រចាំឆមាស -->
                        <tr class="gb-tbody-row" style="background-color: #f8fafc; font-weight: 600; height: ${calculatedRowHeightMm}mm !important;">
                          <td style="font-size: ${cellFontSize};">${summary.overallAvg?.indexKm || ''}</td>
                          <td style="text-align: left !important; padding-left: 5px !important; font-size: ${nameFontSize};">${summary.overallAvg?.name || 'មធ្យមភាគប្រចាំឆមាស'}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.overallAvg?.sem1)}</td>
                          <td class="font-mono font-bold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${summary.overallAvg?.sem1Rank || ''}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.overallAvg?.sem2)}</td>
                          <td class="font-mono font-bold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${summary.overallAvg?.sem2Rank || ''}</td>
                          <td class="font-mono font-bold">${formatScoreNumber(summary.overallAvg?.annual)}</td>
                          <td class="font-mono font-bold text-red-600" style="color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${summary.overallAvg?.annualRank || ''}</td>
                          <td style="font-size: ${cellFontSize}; font-weight: 600; color: #1e3a8a;">${escapeHtml(summary.overallAvg?.remark || '')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- ================= RIGHT PAGE: Sections ខ, គ, ឃ, ង, ច ================= -->
              <div class="gradebook-page-box">
                <div class="flex flex-col h-full gap-1">
                  <!-- Top Line: School Name & Student Count in Class -->
                  <div class="flex items-center justify-between text-[9px] font-bold mb-0.5 px-0.5 text-black" style="min-height: 5mm;">
                    <div>
                      <span>សាលា ៖ </span>
                      <span class="text-[#1e3a8a] font-semibold" contenteditable="true" spellcheck="false">${escapeHtml(data.schoolName || '')}</span>
                    </div>
                    <div class="whitespace-nowrap">
                      <span>ចំនួនសិស្សសរុបក្នុងថ្នាក់ ៖ </span>
                      <span class="font-mono font-bold text-[#1e3a8a]" contenteditable="true" spellcheck="false">${escapeHtml(data.totalStudents !== undefined && data.totalStudents !== null ? String(data.totalStudents) : '')}</span>
                      <span> នាក់ (ស្រី </span>
                      <span class="font-mono font-bold text-[#1e3a8a]" contenteditable="true" spellcheck="false">${escapeHtml(data.femaleStudents !== undefined && data.femaleStudents !== null ? String(data.femaleStudents) : '')}</span>
                      <span> នាក់)</span>
                    </div>
                  </div>

                  <!-- Section ខ Banner -->
                  <div class="gradebook-banner mb-0">
                    ខ / ចំនួនអវត្តមានក្នុងឆ្នាំសិក្សា
                  </div>
                  <!-- Section ខ Table -->
                  <table class="gradebook-table no-shadcn mb-1">
                    <thead>
                      <tr style="height: 6.5mm !important;">
                        <th style="width: 34%;">អវត្តមាន</th>
                        <th>ឆមាសទី១</th>
                        <th>ឆមាសទី២</th>
                        <th>ប្រចាំឆ្នាំ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">-មានច្បាប់</td>
                        <td class="font-mono font-medium">${formatTwoDigits(att.excusedSem1)}</td>
                        <td class="font-mono font-medium">${formatTwoDigits(att.excusedSem2)}</td>
                        <td class="font-mono font-medium">${formatTwoDigits(att.excusedYear)}</td>
                      </tr>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">-ឥតច្បាប់</td>
                        <td class="font-mono font-medium">${formatTwoDigits(att.unexcusedSem1)}</td>
                        <td class="font-mono font-medium">${formatTwoDigits(att.unexcusedSem2)}</td>
                        <td class="font-mono font-medium">${formatTwoDigits(att.unexcusedYear)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Section គ Banner -->
                  <div class="gradebook-banner mb-0">
                    គ / ការវាយតម្លៃ
                  </div>
                  <!-- Section គ Table -->
                  <table class="gradebook-table no-shadcn mb-1">
                    <thead>
                      <tr style="height: 6.5mm !important;">
                        <th style="width: 34%;">ផ្នែកទាំង៤</th>
                        <th>ឆមាសទី១</th>
                        <th>ឆមាសទី២</th>
                        <th>ប្រចាំឆ្នាំ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">១- ការសិក្សា</td>
                        <td contenteditable="true" spellcheck="false" class="font-semibold text-blue-900">${escapeHtml(evalData.sem1 || '')}</td>
                        <td contenteditable="true" spellcheck="false" class="font-semibold text-blue-900">${escapeHtml(evalData.sem2 || '')}</td>
                        <td contenteditable="true" spellcheck="false" class="font-semibold text-blue-900">${escapeHtml(evalData.annual || '')}</td>
                      </tr>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">២- សីលធម៌រស់នៅ</td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                      </tr>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">៣- ពលកម្ម-បង្កបង្កើនផល</td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                      </tr>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">៤- សុខភាព-អនាម័យ</td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Section ឃ Banner -->
                  <div class="gradebook-banner mb-0">
                    ឃ / ការសរសើរ
                  </div>
                  <!-- Section ឃ Table -->
                  <table class="gradebook-table no-shadcn mb-1">
                    <thead>
                      <tr style="height: 6.5mm !important;">
                        <th style="width: 34%;">បានទទួលការសរសើរ</th>
                        <th>ឆមាសទី១</th>
                        <th>ឆមាសទី២</th>
                        <th>ប្រចាំឆ្នាំ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">-ប័ណ្ណសរសើរចំនួន</td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                      </tr>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">-លិខិតសរសើរ</td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                      </tr>
                      <tr class="gb-tbody-row" style="height: ${calculatedRowHeightMm}mm !important;">
                        <td style="text-align: left !important; padding-left: 5px !important; font-weight: 500;">-សេចក្តីបណ្ណលើកទឹកចិត្ត</td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                        <td contenteditable="true" spellcheck="false"></td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Section ង Banner -->
                  <div class="gradebook-banner mb-0">
                    ង / លទ្ធផលនៃការប្រឡងបញ្ចប់ភូមិសិក្សា (ជាប់ ឬ ធ្លាក់)
                  </div>
                  <div class="border border-[#1e3a8a] py-0.5 px-2 text-center text-[9px] font-bold bg-[#f8fafc] mb-1 flex items-center justify-center gap-2" style="height: ${calculatedRowHeightMm}mm; box-sizing: border-box;">
                    <span class="text-muted-foreground text-[9px]">លទ្ធផល ៖</span>
                    <span class="text-blue-900 font-bold text-[9px]" contenteditable="true" spellcheck="false">${data.graduationResult || ''}</span>
                  </div>

                  <!-- Section ច: មូលវិចារ -->
                  <div class="border border-[#1e3a8a] flex-1 flex flex-col min-h-0">
                    <div class="gradebook-banner mb-0">
                      ច / មូលវិចារ
                    </div>
                    <div class="grid grid-cols-2 divide-x divide-[#1e3a8a] text-[9px] flex-1 min-h-0">
                      <!-- Left: នាយកសាលា -->
                      <div class="p-1.5 flex flex-col justify-between text-center h-full">
                        <p class="font-bold text-foreground text-[9px]">នាយកសាលា</p>
                        <div class="flex-1"></div>
                        <p class="text-[8px] text-muted-foreground pb-0.5">ថ្ងៃទី &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ខែ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ឆ្នាំ២០</p>
                      </div>
                      <!-- Right: គ្រូទទួលបន្ទុកថ្នាក់ -->
                      <div class="p-1.5 flex flex-col justify-between text-center h-full">
                        <p class="font-bold text-foreground text-[9px]">គ្រូទទួលបន្ទុកថ្នាក់</p>
                        <div class="flex-1"></div>
                        <p class="text-[8px] text-muted-foreground pb-0.5">ថ្ងៃទី &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ខែ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ឆ្នាំ២០</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });
  },

  bindStaticEvents() {
    // Switch tabs
    this.container.querySelectorAll('.rep-tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.state.activeTab = btn.getAttribute('data-tab');
        this.container.querySelectorAll('.rep-tab-btn').forEach(b => {
          b.className = `rep-tab-btn px-4 py-2 rounded-lg transition-all ${b === btn ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;
        });

        const classFilterBox = document.getElementById('filter-rep-class-box');
        const statusFilterBox = document.getElementById('filter-rep-status-box');

        if (this.state.activeTab === 'teachers' || this.state.activeTab === 'classes') {
          classFilterBox?.classList.add('hidden');
          statusFilterBox?.classList.add('hidden');
        } else if (this.state.activeTab === 'studentPlan' || this.state.activeTab === 'studentGradeBook') {
          classFilterBox?.classList.add('hidden');
          statusFilterBox?.classList.add('hidden');
        } else {
          classFilterBox?.classList.remove('hidden');
          if (this.state.activeTab === 'students') statusFilterBox?.classList.remove('hidden');
          else statusFilterBox?.classList.add('hidden');
        }

        await this.loadReportData();
      });
    });

    // Filter class
    document.getElementById('select-rep-class')?.addEventListener('change', async (e) => {
      this.state.selectedClassId = e.target.value;
      if (authService.isTeacher() && this.state.selectedClassId && this.state.selectedClassId !== 'all') {
        await authService.setAssignedClassId(this.state.selectedClassId);
      }
      await this.loadReportData();
    });

    // Filter status
    document.getElementById('select-rep-status')?.addEventListener('change', async (e) => {
      this.state.selectedStatus = e.target.value;
      await this.loadReportData();
    });

    // Print
    document.getElementById('btn-print-report')?.addEventListener('click', () => {
      if (this.state.activeTab === 'studentPlan') {
        this.openStudentPlanViewer();
        return;
      }
      if (this.state.activeTab === 'studentGradeBook') {
        this.openStudentGradeBookViewer();
        return;
      }
      window.print();
    });

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      if (!this.state.reportData || this.state.reportData.length === 0) {
        toast.error('No data to export');
        return;
      }
      const filename = `SchoolReport_${this.state.activeTab}_${new Date().toISOString().split('T')[0]}`;
      ReportService.exportToCSV(filename, this.state.currentHeaders, this.state.reportData);
      toast.success('CSV report generated and downloaded');
    });
  }
};
