/**
 * Reports & Printable Documents Center (Section 17)
 * Generates and prints official rosters, student directory, faculty list,
 * attendance reports, academic rank lists, and individual student study plans
 * (ផែនការសិស្សម្នាក់ៗ - MoEYS / SEIP standard template in A4 Landscape).
 */
import { ReportService } from '../services/reportService.js';
import { StudentPlanService } from '../services/studentPlanService.js';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { ReportViewer } from '../components/reportViewer.js';
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
    // Show only the "ផែនការសិស្ស" button card that opens full A4 Landscape ReportViewer!
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
              ពិនិត្យមើល កែប្រែពិន្ទុដៅ និងបោះពុម្ពតារាងផែនការសិក្សារបស់សិស្សម្នាក់ៗ (SEIP) ជាទម្រង់ក្រដាស A4 Landscape ផ្លូវការ
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
    let currentClassId = this.state.selectedClassId;
    if (!currentClassId || currentClassId === 'all') {
      if (this.state.classes.length > 0) {
        currentClassId = this.state.classes[0].id;
      }
    }

    let studentsInClass = await StudentPlanService.getClassStudents(currentClassId);
    let currentStudentId = this.state.selectedStudentId || studentsInClass[0]?.studentId || null;
    const activeYear = this.state.activeYear;
    const isKm = (localStorage.getItem('school_lang') || 'km') === 'km';
    const classes = this.state.classes;
    const isTeacher = authService.isTeacher();

    let autoSaveTimer = null;

    await ReportViewer.open({
      reportKey: 'student_individual_plan',
      title: isKm ? 'ផែនការសិក្សារបស់សិស្ស (SEIP)' : 'Student Study Plan (SEIP)',
      alwaysFresh: true,
      defaultOrientation: 'landscape',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 6, bottom: 6, left: 8, right: 8 },
      defaultFontFamily: 'Kantumruy Pro',
      defaultFontSize: 8.5,
      renderHeaderControls: (controlsContainer, viewer) => {
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
              <span id="rv-plan-save-indicator" class="text-emerald-600 dark:text-emerald-400 font-medium text-[11px] ml-1.5 whitespace-nowrap"></span>
            </div>
          `;

          controlsContainer.querySelector('#rv-plan-filter-class')?.addEventListener('change', async (e) => {
            currentClassId = e.target.value;
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

        const reportDateObj = planData.reportDate ? new Date(planData.reportDate) : new Date();
        const lunarDateText = formatKhmerLunarDate(reportDateObj) || '';
        const solarDateText = formatKhmerSolarDate(reportDateObj) || '';

        paperContainer.innerHTML = `
          <div class="student-plan-sheet font-khmer text-black leading-tight select-text" style="color: #000000 !important; width: 100%;">
            <!-- Top Royal Header -->
            <div class="flex justify-end pr-2 mb-1">
              <div class="text-center">
                <div class="font-bold text-xs leading-relaxed tracking-wide font-khmer-muol" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div class="font-bold text-[11px] leading-relaxed tracking-wider font-khmer-muol" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                <div class="text-[9px] text-gray-500 tracking-widest mt-0.5 select-none font-bold">៚៚៚</div>
              </div>
            </div>

            <!-- Main Document Title -->
            <div class="text-center my-1.5">
              <h2 class="text-sm sm:text-base font-bold tracking-tight font-khmer-muol" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">
                ផែនការសិក្សារបស់សិស្ស ឆ្នាំសិក្សា${toKhmerNumerals(planData.academicYear)}
              </h2>
            </div>

            <!-- Metadata Block -->
            <div class="text-[10px] leading-normal border border-gray-400 p-2 rounded mb-2 space-y-1.5" style="border: 1px solid #9ca3af !important;">
              <!-- Row 1: Student info -->
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-1">
                  <span class="font-bold">ឈ្មោះសិស្ស ៖</span>
                  <span class="font-bold underline underline-offset-2">${escapeHtml(student.khmerName || student.englishName)}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">ភេទ ៖</span>
                  <span>${student.gender}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">អត្តលេខ ៖</span>
                  <span class="font-mono">${student.studentId}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">ថ្នាក់ទី ៖</span>
                  <span class="font-bold">${cls.name}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold">ស្ថានភាពគ្រួសារ ៖</span>
                  <input type="text" id="rv-input-family-status" value="${escapeHtml(student.familyStatus || '')}" placeholder="ក្រីក្រ១ / មធ្យម..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none w-28">
                </div>
              </div>

              <!-- Row 2: School & Province -->
              <div class="grid grid-cols-2 gap-2 items-center">
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">សាលារៀន ៖</span>
                  <input type="text" id="rv-input-school-name" value="${escapeHtml(school.nameKm || '')}" placeholder="ឈ្មោះសាលារៀន..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ខេត្ត ៖</span>
                  <input type="text" id="rv-input-province" value="${escapeHtml(school.province || '')}" placeholder="ខេត្ត..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
              </div>

              <!-- Row 3: Father -->
              <div class="grid grid-cols-2 gap-2 items-center">
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ឈ្មោះឪពុក ៖</span>
                  <input type="text" id="rv-input-father-name" value="${escapeHtml(student.fatherName || '')}" placeholder="ឈ្មោះឪពុក..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <input type="text" id="rv-input-father-phone" value="${escapeHtml(student.fatherPhone || '')}" placeholder="លេខទូរស័ព្ទឪពុក..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
              </div>

              <!-- Row 4: Mother -->
              <div class="grid grid-cols-2 gap-2 items-center">
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ឈ្មោះម្តាយ ៖</span>
                  <input type="text" id="rv-input-mother-name" value="${escapeHtml(student.motherName || '')}" placeholder="ឈ្មោះម្តាយ..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <input type="text" id="rv-input-mother-phone" value="${escapeHtml(student.motherPhone || '')}" placeholder="លេខទូរស័ព្ទម្តាយ..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
              </div>

              <!-- Row 5: Teacher -->
              <div class="grid grid-cols-2 gap-2 items-center">
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">ឈ្មោះគ្រូបន្ទុកថ្នាក់ ៖</span>
                  <input type="text" id="rv-input-teacher-name" value="${escapeHtml(teacher.name || '')}" placeholder="ឈ្មោះគ្រូបន្ទុកថ្នាក់..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <input type="text" id="rv-input-teacher-phone" value="${escapeHtml(teacher.phone || '')}" placeholder="លេខទូរស័ព្ទគ្រូ..." class="rv-plan-cell border-b border-dashed border-gray-400 px-1 text-[10px] bg-transparent focus:outline-none flex-1">
                </div>
              </div>
            </div>

            <!-- Score Scale Matrix -->
            <table class="w-full border-collapse text-[8.5px] leading-tight mb-2" style="border: 1px solid #4b5563;">
              <tbody>
                ${StudentPlanService.getScoreScaleMatrix().map(row => `
                  <tr style="border-bottom: 1px solid #9ca3af;">
                    <td class="font-bold py-0.5 px-1.5 whitespace-nowrap bg-gray-100" style="border-right: 1px solid #9ca3af; width: 140px;">${row.scaleLabel}</td>
                    ${row.grades.map(g => `
                      <td class="py-0.5 px-1 text-center whitespace-nowrap" style="border-right: 1px solid #9ca3af;">${g.text}</td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- 24-Column Score Table -->
            <table class="w-full border-collapse text-[9px] leading-tight mb-4" style="border: 1.5px solid #000000;">
              <thead>
                <tr class="bg-gray-100 text-center font-bold" style="border-bottom: 1px solid #000000;">
                  <th rowspan="2" class="p-1 min-w-[90px] text-center" style="border-right: 1px solid #000000;">មុខវិជ្ជា</th>
                  <th rowspan="2" class="p-0.5 min-w-[40px] text-center" style="border-right: 1px solid #000000;">កម្រិតពិន្ទុ<br>ដើមឆ្នាំ</th>
                  <th colspan="20" class="p-0.5 text-center" style="border-right: 1px solid #000000;">
                    កម្រិតពិន្ទុនិងលទ្ធផលដើមឆ្នាំ(ខ្មៅ) និងចុងឆ្នាំ(<span style="color: #dc2626 !important;">ក្រហម</span>)
                  </th>
                  <th colspan="2" class="p-0.5 min-w-[70px] text-center">
                    កម្រិតពិន្ទុ<br>ចុងឆ្នាំ
                  </th>
                </tr>
                <tr class="bg-gray-50 text-center font-bold text-[8.5px]" style="border-bottom: 1.5px solid #000000;">
                  ${StudentPlanService.getMonths().map(m => `
                    <th class="p-0.5 text-center" style="border-right: 1px solid #9ca3af; min-width: 25px;">${m.labelKm}</th>
                    <th class="p-0.5 text-center" style="border-right: 1px solid #000000; min-width: 25px; color: #dc2626 !important;">ជាក់ស្តែង</th>
                  `).join('')}
                  <th class="p-0.5 text-center" style="border-right: 1px solid #9ca3af; min-width: 28px;">ដាក់ពិន្ទុ</th>
                  <th class="p-0.5 text-center" style="min-width: 28px; color: #dc2626 !important;">ជាក់ស្តែង</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map((sub, sIdx) => `
                  <tr style="border-bottom: 1px solid #9ca3af;" data-subject-id="${sub.id}">
                    <td class="p-1 font-medium whitespace-nowrap" style="border-right: 1px solid #000000;">
                      ${sub.name}
                    </td>
                    <!-- Baseline -->
                    <td class="p-0 text-center" style="border-right: 1px solid #000000;">
                      <input type="text" class="rv-plan-cell w-full text-center text-[9px] bg-transparent focus:bg-yellow-50 focus:outline-none" data-subject-id="${sub.id}" data-field="baseline" value="${escapeHtml(sub.baseline || '')}" style="height: 20px;">
                    </td>
                    <!-- 10 Months -->
                    ${sub.months.map(m => `
                      <td class="p-0 text-center" style="border-right: 1px solid #d1d5db;">
                        <input type="text" class="rv-plan-cell w-full text-center text-[9px] bg-transparent focus:bg-yellow-50 focus:outline-none" data-subject-id="${sub.id}" data-field="target" data-month-key="${m.key}" value="${escapeHtml(m.target || '')}" style="height: 20px;">
                      </td>
                      <td class="p-0 text-center" style="border-right: 1px solid #000000; background-color: #fff1f2;">
                        <input type="text" class="rv-plan-cell w-full text-center text-[9px] bg-transparent focus:bg-rose-100 focus:outline-none font-bold" data-subject-id="${sub.id}" data-field="actual" data-month-key="${m.key}" value="${escapeHtml(m.actual || '')}" style="height: 20px; color: #dc2626 !important;">
                      </td>
                    `).join('')}
                    <!-- End of year Target -->
                    <td class="p-0 text-center" style="border-right: 1px solid #d1d5db;">
                      <input type="text" class="rv-plan-cell w-full text-center text-[9px] bg-transparent focus:bg-yellow-50 focus:outline-none" data-subject-id="${sub.id}" data-field="targetFinal" value="${escapeHtml(sub.targetFinal || '')}" style="height: 20px;">
                    </td>
                    <!-- End of year Actual -->
                    <td class="p-0 text-center" style="background-color: #fff1f2;">
                      <input type="text" class="rv-plan-cell w-full text-center text-[9px] bg-transparent focus:bg-rose-100 focus:outline-none font-bold" data-subject-id="${sub.id}" data-field="actualFinal" value="${escapeHtml(sub.actualFinal || '')}" style="height: 20px; color: #dc2626 !important;">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Signatures Footer -->
            <div class="grid grid-cols-3 gap-4 text-center text-[10px] font-khmer mt-4 pt-2" style="border-top: 1px solid #9ca3af;">
              <!-- Principal -->
              <div>
                <p class="font-semibold">បានឃើញ និងឯកភាព</p>
                <p class="font-bold">នាយកសាលា</p>
                <div class="h-12"></div>
                <p class="border-t border-dotted border-gray-400 inline-block px-8 pt-0.5 text-gray-500 font-medium">ហត្ថលេខា និងត្រា</p>
              </div>

              <!-- Parent / Guardian -->
              <div>
                <p class="font-semibold">បានឃើញ និងឯកភាព</p>
                <p class="font-bold">មាតាបិតា ឬអាណាព្យាបាលសិស្ស</p>
                <div class="h-12"></div>
                <p class="border-t border-dotted border-gray-400 inline-block px-8 pt-0.5 font-bold">${escapeHtml(student.fatherName || student.motherName || 'ហត្ថលេខា')}</p>
              </div>

              <!-- Student -->
              <div>
                <p class="text-[9.5px] leading-tight font-medium">${lunarDateText}</p>
                <p class="text-[9.5px] leading-tight font-medium">${school.province ? `${school.province} ` : ''}${solarDateText}</p>
                <p class="font-bold pt-0.5">ហត្ថលេខានិងឈ្មោះសិស្ស</p>
                <div class="h-10"></div>
                <p class="font-bold underline underline-offset-2 inline-block px-4">${escapeHtml(student.khmerName || student.englishName)}</p>
              </div>
            </div>
          </div>
        `;

        // Gather and auto-save handler for inputs inside ReportViewer
        const gatherViewerPayload = () => {
          const familyStatus = paperContainer.querySelector('#rv-input-family-status')?.value || '';
          const schoolName = paperContainer.querySelector('#rv-input-school-name')?.value || '';
          const province = paperContainer.querySelector('#rv-input-province')?.value || '';
          const fatherName = paperContainer.querySelector('#rv-input-father-name')?.value || '';
          const fatherPhone = paperContainer.querySelector('#rv-input-father-phone')?.value || '';
          const motherName = paperContainer.querySelector('#rv-input-mother-name')?.value || '';
          const motherPhone = paperContainer.querySelector('#rv-input-mother-phone')?.value || '';
          const parentName = [fatherName, motherName].filter(Boolean).join(' / ');
          const parentPhone = fatherPhone || motherPhone || '';
          const teacherName = paperContainer.querySelector('#rv-input-teacher-name')?.value || '';
          const teacherPhone = paperContainer.querySelector('#rv-input-teacher-phone')?.value || '';

          const baseline = {};
          const targets = {};
          const actuals = {};
          const targetFinal = {};
          const actualFinal = {};

          paperContainer.querySelectorAll('input.rv-plan-cell').forEach(inp => {
            const sId = inp.dataset.subjectId;
            const f = inp.dataset.field;
            const v = inp.value.trim();
            if (!sId) return;

            if (f === 'baseline') baseline[sId] = v;
            else if (f === 'target') {
              const mk = inp.dataset.monthKey;
              if (!targets[sId]) targets[sId] = {};
              targets[sId][mk] = v;
            } else if (f === 'actual') {
              const mk = inp.dataset.monthKey;
              if (!actuals[sId]) actuals[sId] = {};
              actuals[sId][mk] = v;
            } else if (f === 'targetFinal') targetFinal[sId] = v;
            else if (f === 'actualFinal') actualFinal[sId] = v;
          });

          return {
            familyStatus,
            schoolName,
            province,
            fatherName,
            fatherPhone,
            motherName,
            motherPhone,
            parentName,
            parentPhone,
            teacherName,
            teacherPhone,
            baseline,
            targets,
            actuals,
            targetFinal,
            actualFinal,
            reportDate: planData?.reportDate || new Date().toISOString().split('T')[0]
          };
        };

        const triggerAutoSave = () => {
          const indicator = document.getElementById('rv-plan-save-indicator');
          if (indicator) indicator.textContent = 'កំពុងរក្សាទុក...';
          clearTimeout(autoSaveTimer);
          autoSaveTimer = setTimeout(async () => {
            try {
              const payload = gatherViewerPayload();
              await StudentPlanService.saveStudentPlan(currentClassId, currentStudentId, activeYear, payload);
              if (indicator) {
                indicator.textContent = 'បានរក្សាទុក';
                setTimeout(() => {
                  if (indicator.textContent === 'បានរក្សាទុក') indicator.textContent = '';
                }, 2000);
              }
            } catch (err) {
              console.warn('Auto save plan error:', err);
              if (indicator) indicator.textContent = 'រក្សាទុកបរាជ័យ';
            }
          }, 500);
        };

        paperContainer.querySelectorAll('input.rv-plan-cell').forEach(inp => {
          inp.addEventListener('input', triggerAutoSave);
          inp.addEventListener('change', triggerAutoSave);
        });
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
        } else if (this.state.activeTab === 'studentPlan') {
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
