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

    await ReportViewer.open({
      reportKey: 'student_individual_plan',
      title: isKm ? 'ផែនការសិក្សារបស់សិស្ស (SEIP)' : 'Student Study Plan (SEIP)',
      alwaysFresh: true,
      defaultOrientation: 'landscape',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 4, bottom: 4, left: 6, right: 6 },
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
            </div>

            <!-- Subject Visibility Filter Button -->
            <button type="button" id="rv-plan-btn-toggle-subjects" class="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground cursor-pointer shadow-xs whitespace-nowrap active:scale-95 transition-all" title="ជ្រើសរើសមុខវិជ្ជាបង្ហាញ/លាក់">
              ${getIcon('slidersHorizontal', 'w-3.5 h-3.5 text-primary')}
              <span>មុខវិជ្ជា</span>
            </button>
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
                    <h3 class="font-bold text-sm sm:text-base text-foreground leading-tight">កំណត់ការបង្ហាញមុខវិជ្ជា (SEIP)</h3>
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
                          ${sub.nameEn ? `<div class="text-[10px] text-muted-foreground truncate">${escapeHtml(sub.nameEn)}</div>` : ''}
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
        let rowHeight = 18;
        let cellFontSize = '8px';
        let scaleFontSize = '7.5px';

        if (subCount > 13) {
          rowHeight = 13;
          cellFontSize = '7px';
          scaleFontSize = '6.5px';
        } else if (subCount > 10) {
          rowHeight = 15;
          cellFontSize = '7.5px';
          scaleFontSize = '7px';
        }

        const reportDateObj = planData.reportDate ? new Date(planData.reportDate) : new Date();
        const lunarDateText = formatKhmerLunarDate(reportDateObj) || '';
        const solarDateText = formatKhmerSolarDate(reportDateObj) || '';
        const scaleMatrix = StudentPlanService.getScoreScaleMatrix();

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
              }
              .seip-score-table th,
              .seip-score-table td {
                text-align: center !important;
                vertical-align: middle !important;
                line-height: 1.1 !important;
              }
              .seip-score-table th {
                font-size: ${cellFontSize} !important;
                padding: 1px 1px !important;
              }
              .seip-score-table td {
                height: ${rowHeight}px !important;
                font-size: ${cellFontSize} !important;
                padding: 0 1px !important;
              }
            </style>
            <!-- Top Royal Header -->
            <div class="flex justify-end pr-2 mb-0.5">
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

            <!-- Metadata Block (Simple text, ultra-compact 3 rows) -->
            <div class="text-[9px] leading-tight border border-black p-1 rounded mb-1 space-y-0.5" style="border: 1px solid #000000 !important; line-height: 1.2 !important;">
              <!-- Row 1: Student info -->
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-1">
                  <span class="font-bold">ឈ្មោះសិស្ស ៖</span>
                  <span class="font-bold underline underline-offset-2">${escapeHtml(student.khmerName || student.englishName || '—')}</span>
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
              <div class="grid grid-cols-4 gap-2 items-center">
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">សាលារៀន ៖</span>
                  <span class="truncate">${escapeHtml(school.nameKm || '—')}</span>
                </div>
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">ខេត្ត ៖</span>
                  <span>${escapeHtml(school.province || '—')}</span>
                </div>
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">ឈ្មោះគ្រូបន្ទុកថ្នាក់ ៖</span>
                  <span>${escapeHtml(teacher.name || '—')}</span>
                </div>
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <span class="font-mono">${escapeHtml(teacher.phone || '—')}</span>
                </div>
              </div>

              <!-- Row 3: Parents -->
              <div class="grid grid-cols-4 gap-2 items-center">
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">ឈ្មោះឪពុក ៖</span>
                  <span>${escapeHtml(student.fatherName || '—')}</span>
                </div>
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <span class="font-mono">${escapeHtml(student.fatherPhone || '—')}</span>
                </div>
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">ឈ្មោះម្តាយ ៖</span>
                  <span>${escapeHtml(student.motherName || '—')}</span>
                </div>
                <div class="flex items-center gap-1 col-span-1">
                  <span class="font-bold shrink-0">លេខទូរស័ព្ទ ៖</span>
                  <span class="font-mono">${escapeHtml(student.motherPhone || '—')}</span>
                </div>
              </div>
            </div>

            <!-- Score Scale Matrix (2 Columns without box: 3 in left column, 3 in right column) -->
            <div class="score-scale-text mb-1 grid grid-cols-2 gap-x-3 text-[7.5px] leading-tight" style="line-height: 1.15 !important; display: grid !important; grid-template-columns: 1fr 1fr !important; border: none !important;">
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
            <table class="seip-score-table no-shadcn w-full border-collapse text-[8.5px] leading-tight mb-1" style="border: 1px solid #000000 !important; table-layout: fixed;">
              <colgroup>
                <col style="width: 14%;">
                <col style="width: 6%;">
                ${Array(22).fill('<col style="width: 3.636%;">').join('')}
              </colgroup>
              <thead>
                <tr class="bg-gray-100 text-center font-bold" style="height: 18px; border-bottom: 1px solid #000000 !important;">
                  <th rowspan="2" class="p-0.5 text-center" style="border: 1px solid #000000 !important;">មុខវិជ្ជា</th>
                  <th rowspan="2" class="p-0.5 text-center" style="border: 1px solid #000000 !important;">កម្រិតពិន្ទុ<br>ដើមឆ្នាំ</th>
                  <th colspan="20" class="p-0.5 text-center" style="border: 1px solid #000000 !important;">
                    កម្រិតពិន្ទុនិងលទ្ធផលដើមឆ្នាំ(ខ្មៅ) និងចុងឆ្នាំ(<span style="color: #dc2626 !important;">ក្រហម</span>)
                  </th>
                  <th colspan="2" class="p-0.5 text-center" style="border: 1px solid #000000 !important;">
                    កម្រិតពិន្ទុ<br>ចុងឆ្នាំ
                  </th>
                </tr>
                <tr class="bg-gray-50 text-center font-bold text-[7.5px]" style="height: 16px; border-bottom: 1px solid #000000 !important;">
                  ${StudentPlanService.getMonths().map(m => `
                    <th class="p-0 text-center whitespace-nowrap overflow-hidden" style="border: 1px solid #000000 !important;">${m.labelKm}</th>
                    <th class="p-0 text-center whitespace-nowrap overflow-hidden" style="color: #dc2626 !important; border: 1px solid #000000 !important;">ជាក់ស្តែង</th>
                  `).join('')}
                  <th class="p-0 text-center whitespace-nowrap overflow-hidden" style="border: 1px solid #000000 !important;">ដាក់ពិន្ទុ</th>
                  <th class="p-0 text-center whitespace-nowrap overflow-hidden" style="color: #dc2626 !important; border: 1px solid #000000 !important;">ជាក់ស្តែង</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map((sub, sIdx) => `
                  <tr style="height: ${rowHeight}px !important; border-bottom: 1px solid #000000 !important;" data-subject-id="${sub.id}">
                    <td class="font-medium whitespace-nowrap overflow-hidden text-center" style="font-size: ${cellFontSize}; height: ${rowHeight}px !important; padding: 0 2px; border: 1px solid #000000 !important;">
                      ${sub.name}
                    </td>
                    <!-- Baseline -->
                    <td class="font-medium text-center" style="font-size: ${cellFontSize}; height: ${rowHeight}px !important; border: 1px solid #000000 !important;">
                      ${escapeHtml(sub.baseline || '')}
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
                    <td class="font-bold text-center" style="background-color: #fff1f2; font-size: ${cellFontSize}; color: #dc2626 !important; height: ${rowHeight}px !important; border: 1px solid #000000 !important;">
                      ${escapeHtml(sub.actualFinal || '')}
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
                <div style="height: 18px;"></div>
                <p class="border-t border-dotted border-black inline-block px-6 pt-0.5 text-gray-700 font-medium text-[7.5px]" style="border-top: 1px dotted #000000 !important;">ហត្ថលេខា និងត្រា</p>
              </div>

              <!-- Parent / Guardian -->
              <div>
                <p class="font-semibold text-[8px]">បានឃើញ និងឯកភាព</p>
                <p class="font-bold text-[8.5px]">មាតាបិតា ឬអាណាព្យាបាលសិស្ស</p>
                <div style="height: 18px;"></div>
                <p class="border-t border-dotted border-black inline-block px-6 pt-0.5 font-bold text-[8px]" style="border-top: 1px dotted #000000 !important;">${escapeHtml(student.fatherName || student.motherName || 'ហត្ថលេខា')}</p>
              </div>

              <!-- Student -->
              <div>
                <p class="text-[7.5px] leading-tight font-medium">${lunarDateText}</p>
                <p class="text-[7.5px] leading-tight font-medium">${school.province ? `${school.province} ` : ''}${solarDateText}</p>
                <p class="font-bold pt-0.5 text-[8px]">ហត្ថលេខានិងឈ្មោះសិស្ស</p>
                <div style="height: 16px;"></div>
                <p class="font-bold underline underline-offset-2 inline-block px-4 text-[8px]">${escapeHtml(student.khmerName || student.englishName)}</p>
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
