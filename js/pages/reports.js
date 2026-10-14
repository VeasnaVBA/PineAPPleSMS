/**
 * Reports & Printable Documents Center (Section 17)
 * Generates and prints official rosters, student directory, faculty list,
 * attendance reports, academic rank lists, and individual student study plans
 * (ផែនការសិស្សម្នាក់ៗ - MoEYS / SEIP standard template).
 */
import { ReportService } from '../services/reportService.js';
import { StudentPlanService } from '../services/studentPlanService.js';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
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
    // Student Plan state
    studentsInClass: [],
    selectedStudentId: null,
    studentPlanData: null,
    planSaveDebounceTimer: null
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
          <div class="flex items-center gap-2">
            ${authService.can('reports.export') ? `
              <button id="btn-export-csv" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs sm:text-sm font-medium transition-colors cursor-pointer">
                ${getIcon('download', 'w-4 h-4')}
                <span>${t('reports.exportCSV')}</span>
              </button>
            ` : ''}
            ${authService.can('reports.print') ? `
              <button id="btn-print-report" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors cursor-pointer">
                ${getIcon('printer', 'w-4 h-4')}
                <span>${t('reports.printReport')}</span>
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

            <!-- Student Selector for Student Plan Tab -->
            <div class="flex items-center gap-2 hidden" id="filter-rep-student-box">
              <span class="text-muted-foreground">${t('reports.filterStudent') || 'ជ្រើសរើសសិស្ស៖'}</span>
              <div class="flex items-center gap-1">
                <button id="btn-prev-student" type="button" class="h-9 w-9 flex items-center justify-center rounded-md border border-input bg-card hover:bg-muted text-foreground transition-colors cursor-pointer" title="${t('reports.prevStudent') || 'សិស្សមុន'}">
                  ${getIcon('chevronLeft', 'w-4 h-4')}
                </button>
                <select id="select-rep-student" class="h-9 px-2.5 py-1.5 pr-8 rounded-md border border-input bg-card text-foreground box-border shadow-xs max-w-[200px] sm:max-w-[240px]">
                  <option value="">កំពុងផ្ទុក...</option>
                </select>
                <button id="btn-next-student" type="button" class="h-9 w-9 flex items-center justify-center rounded-md border border-input bg-card hover:bg-muted text-foreground transition-colors cursor-pointer" title="${t('reports.nextStudent') || 'សិស្សបន្ទាប់'}">
                  ${getIcon('chevronRight', 'w-4 h-4')}
                </button>
              </div>
              <span id="plan-sync-status" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium ml-1"></span>
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

    // Handle Student Individual Study Plan Tab
    if (tab === 'studentPlan') {
      if (stdHeader) stdHeader.classList.add('hidden');
      if (stdFooter) stdFooter.classList.add('hidden');

      // Make sure a valid class is selected
      let classId = this.state.selectedClassId;
      if (!classId || classId === 'all') {
        if (this.state.classes.length > 0) {
          classId = this.state.classes[0].id;
          this.state.selectedClassId = classId;
          const selectClassEl = document.getElementById('select-rep-class');
          if (selectClassEl) selectClassEl.value = classId;
        }
      }

      await this.updateStudentSelector();

      if (!this.state.selectedStudentId) {
        if (counterBox) counterBox.textContent = '0 records';
        if (tableBox) {
          tableBox.innerHTML = `
            <div class="py-16 text-center text-xs text-muted-foreground font-khmer">
              មិនមានសិស្សក្នុងថ្នាក់នេះនៅឡើយទេ។ សូមជ្រើសរើសថ្នាក់ផ្សេង ឬបញ្ចូលសិស្សក្នុងថ្នាក់នេះ។
            </div>
          `;
        }
        return;
      }

      const planData = await StudentPlanService.getStudentPlan(
        this.state.selectedClassId,
        this.state.selectedStudentId,
        this.state.activeYear
      );
      this.state.studentPlanData = planData;
      this.renderStudentPlanReport(planData);
      return;
    }

    // Standard Reports tabs
    if (stdHeader) stdHeader.classList.remove('hidden');
    if (stdFooter) stdFooter.classList.remove('hidden');

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

  async updateStudentSelector() {
    const studentBox = document.getElementById('filter-rep-student-box');
    const studentSelect = document.getElementById('select-rep-student');
    const counterBox = document.getElementById('rep-record-counter');

    if (this.state.activeTab !== 'studentPlan') {
      studentBox?.classList.add('hidden');
      return;
    }

    studentBox?.classList.remove('hidden');

    let classId = this.state.selectedClassId;
    if (!classId || classId === 'all') {
      if (this.state.classes.length > 0) {
        classId = this.state.classes[0].id;
        this.state.selectedClassId = classId;
      }
    }

    this.state.studentsInClass = await StudentPlanService.getClassStudents(classId);

    if (!this.state.selectedStudentId || !this.state.studentsInClass.some(s => s.studentId === this.state.selectedStudentId)) {
      this.state.selectedStudentId = this.state.studentsInClass[0]?.studentId || null;
    }

    if (studentSelect) {
      if (this.state.studentsInClass.length === 0) {
        studentSelect.innerHTML = `<option value="">${t('classes.emptyList') || 'មិនមានសិស្ស'}</option>`;
      } else {
        studentSelect.innerHTML = this.state.studentsInClass.map((s, idx) => `
          <option value="${s.studentId}" ${this.state.selectedStudentId === s.studentId ? 'selected' : ''}>
            ${idx + 1}. ${s.khmerName || s.englishName} (${s.studentId})
          </option>
        `).join('');
      }
    }

    const currIdx = this.state.studentsInClass.findIndex(s => s.studentId === this.state.selectedStudentId);
    if (counterBox) {
      if (this.state.studentsInClass.length > 0) {
        counterBox.textContent = `សិស្សទី ${currIdx >= 0 ? currIdx + 1 : 1} នៃ ${this.state.studentsInClass.length} នាក់`;
      } else {
        counterBox.textContent = `0 records`;
      }
    }
  },

  renderStudentPlanReport(planData) {
    const tableBox = document.getElementById('rep-table-container');
    if (!tableBox) return;

    if (!planData || !planData.student) {
      tableBox.innerHTML = `
        <div class="py-16 text-center text-xs text-muted-foreground font-khmer">
          ${t('reports.emptyReport')}
        </div>
      `;
      return;
    }

    const student = planData.student;
    const cls = planData.class;
    const school = planData.school;
    const teacher = planData.teacher;
    const subjects = planData.subjects || [];

    const reportDateObj = planData.reportDate ? new Date(planData.reportDate) : new Date();
    const lunarDateText = formatKhmerLunarDate(reportDateObj) || '';
    const solarDateText = formatKhmerSolarDate(reportDateObj) || '';

    tableBox.innerHTML = `
      <div class="student-plan-document font-khmer space-y-4">
        <!-- Top Royal Header -->
        <div class="flex justify-end pr-2">
          <div class="text-center">
            <div class="font-bold text-sm leading-relaxed tracking-wide text-foreground" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">ព្រះរាជាណាចក្រកម្ពុជា</div>
            <div class="font-bold text-xs leading-relaxed tracking-wider text-foreground" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
            <div class="text-[10px] text-muted-foreground tracking-widest mt-0.5 select-none font-bold">៚៚៚</div>
          </div>
        </div>

        <!-- Main Document Title -->
        <div class="text-center my-2">
          <h2 class="text-base sm:text-lg font-bold text-foreground tracking-tight" style="font-family: 'Khmer OS Muol Light', 'Moul', cursive, sans-serif;">
            ផែនការសិក្សារបស់សិស្ស ឆ្នាំសិក្សា${toKhmerNumerals(planData.academicYear)} (${cls.educationLevelText ? cls.educationLevelText + ' ' : ''}ថ្នាក់ទី${toKhmerNumerals(cls.name)})
          </h2>
        </div>

        <!-- 4-Row Student Metadata Block matching Image 1 -->
        <div class="text-xs leading-relaxed border border-border/70 rounded-lg p-3 bg-muted/15 space-y-2">
          <!-- Row 1: Student info -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-center">
            <div class="flex items-center gap-1.5 md:col-span-1">
              <span class="font-bold text-foreground shrink-0">ឈ្មោះសិស្ស ៖</span>
              <span class="font-bold text-primary truncate underline underline-offset-4">${student.khmerName || student.englishName}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">ភេទ ៖</span>
              <span class="font-medium">${student.gender}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">អត្តលេខ ៖</span>
              <span class="font-mono font-medium">${student.studentId}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">ថ្នាក់ទី ៖</span>
              <span class="font-bold">${cls.name}</span>
            </div>
            <div class="flex items-center gap-1.5 md:col-span-1">
              <span class="font-bold text-foreground shrink-0">ស្ថានភាពគ្រួសារ ៖</span>
              <input type="text" id="meta-family-status" value="${escapeHtml(student.familyStatus || '')}" placeholder="ក្រីក្រ១ / មធ្យម..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
          </div>

          <!-- Row 2: School & Province -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">សាលារៀន ៖</span>
              <input type="text" id="meta-school-name" value="${escapeHtml(school.nameKm || '')}" placeholder="ឈ្មោះសាលារៀន..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">ខេត្ត ៖</span>
              <input type="text" id="meta-province" value="${escapeHtml(school.province || '')}" placeholder="ខេត្ត..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
          </div>

          <!-- Row 3: Father & Phone -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">ឈ្មោះឪពុក ៖</span>
              <input type="text" id="meta-father-name" value="${escapeHtml(student.fatherName || '')}" placeholder="ឈ្មោះឪពុក..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">លេខទូរស័ព្ទ ៖</span>
              <input type="text" id="meta-father-phone" value="${escapeHtml(student.fatherPhone || '')}" placeholder="លេខទូរស័ព្ទឪពុក..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
          </div>

          <!-- Row 4: Mother & Phone -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">ឈ្មោះម្តាយ ៖</span>
              <input type="text" id="meta-mother-name" value="${escapeHtml(student.motherName || '')}" placeholder="ឈ្មោះម្តាយ..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">លេខទូរស័ព្ទ ៖</span>
              <input type="text" id="meta-mother-phone" value="${escapeHtml(student.motherPhone || '')}" placeholder="លេខទូរស័ព្ទម្តាយ..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
          </div>

          <!-- Row 5: Homeroom Teacher & Phone -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">ឈ្មោះគ្រូបន្ទុកថ្នាក់ ៖</span>
              <input type="text" id="meta-teacher-name" value="${escapeHtml(teacher.name || '')}" placeholder="ឈ្មោះគ្រូបន្ទុកថ្នាក់..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-foreground shrink-0">លេខទូរស័ព្ទ ៖</span>
              <input type="text" id="meta-teacher-phone" value="${escapeHtml(teacher.phone || '')}" placeholder="លេខទូរស័ព្ទគ្រូ..." class="student-plan-input border-b border-dashed border-border px-1 py-0.5 text-xs bg-transparent focus:border-primary focus:outline-none flex-1">
            </div>
          </div>
        </div>

        <!-- 6-Row Score Scale Reference Matrix matching Image 1 -->
        <div class="overflow-x-auto my-3 border border-border/80 rounded-md">
          <table class="scale-table w-full border-collapse text-[10.5px] leading-tight">
            <tbody>
              ${StudentPlanService.getScoreScaleMatrix().map((row, rIdx) => `
                <tr class="${rIdx % 2 === 0 ? 'bg-muted/30' : 'bg-card'} border-b border-border/60 last:border-b-0 hover:bg-muted/40">
                  <td class="font-bold py-1 px-2 border-r border-border/70 text-foreground whitespace-nowrap min-w-[170px]">${row.scaleLabel}</td>
                  ${row.grades.map(g => `
                    <td class="py-1 px-1.5 border-r border-border/70 last:border-r-0 text-center whitespace-nowrap">${g.text}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile Swipe Helper Indicator -->
        <div class="sm:hidden no-print flex items-center justify-between text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg my-2 select-none">
          <span class="flex items-center gap-1 font-khmer">
            ${getIcon('chevronLeft', 'w-3.5 h-3.5')}
            <span>អូសទៅឆ្វេង/ស្តាំដើម្បីមើលគ្រប់ខែ (Swipe table)</span>
          </span>
          ${getIcon('chevronRight', 'w-3.5 h-3.5')}
        </div>

        <!-- 24-Column Main Score Plan Table matching Image 1 & 2 -->
        <div class="overflow-x-auto my-3 border border-border rounded-lg shadow-2xs">
          <table class="student-plan-table w-full border-collapse text-xs">
            <thead>
              <tr class="bg-muted/70 font-semibold text-foreground text-center border-b border-border">
                <th rowspan="2" class="p-2 border-r border-border min-w-[130px] text-center font-bold">មុខវិជ្ជា</th>
                <th rowspan="2" class="p-1 border-r border-border min-w-[55px] text-center font-bold">កម្រិតពិន្ទុ<br>ដើមឆ្នាំ</th>
                <th colspan="20" class="p-1 border-r border-border font-bold text-center">
                  កម្រិតពិន្ទុនិងលទ្ធផលដើមឆ្នាំ(ខ្មៅ) និងចុងឆ្នាំ(<span class="text-rose-600 font-bold">ក្រហម</span>)
                </th>
                <th colspan="2" class="p-1 min-w-[90px] font-bold text-center">
                  កម្រិតពិន្ទុ<br>ចុងឆ្នាំ
                </th>
              </tr>
              <tr class="bg-muted/50 font-semibold text-foreground text-center text-[11px] border-b-2 border-border">
                <!-- 10 Months -->
                ${StudentPlanService.getMonths().map(m => `
                  <th class="p-1 border-r border-border/60 min-w-[34px] text-center font-bold" title="${m.nameKm}">${m.labelKm}</th>
                  <th class="p-1 border-r border-border min-w-[34px] text-center font-bold text-rose-600">ជាក់ស្តែង</th>
                `).join('')}
                <!-- End of Year -->
                <th class="p-1 border-r border-border/60 min-w-[38px] text-center font-bold">ដាក់ពិន្ទុ</th>
                <th class="p-1 min-w-[38px] text-center font-bold text-rose-600">ជាក់ស្តែង</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/70">
              ${subjects.map((sub, sIdx) => `
                <tr class="${sIdx % 2 === 0 ? 'bg-card' : 'bg-muted/10'} hover:bg-muted/30 transition-colors" data-subject-id="${sub.id}">
                  <td class="p-1.5 border-r border-border font-medium text-foreground whitespace-nowrap">
                    ${sub.name}
                  </td>
                  <!-- Baseline -->
                  <td class="p-0 border-r border-border text-center">
                    <input type="text" class="plan-cell-input student-plan-input w-full h-8 text-center text-xs bg-transparent focus:bg-primary/10 focus:outline-none" data-subject-id="${sub.id}" data-field="baseline" value="${escapeHtml(sub.baseline || '')}">
                  </td>
                  <!-- 10 Months -->
                  ${sub.months.map(m => `
                    <!-- Target (Black) -->
                    <td class="p-0 border-r border-border/50 text-center">
                      <input type="text" class="plan-cell-input student-plan-input w-full h-8 text-center text-xs bg-transparent focus:bg-primary/10 focus:outline-none font-medium" data-subject-id="${sub.id}" data-field="target" data-month-key="${m.key}" value="${escapeHtml(m.target || '')}">
                    </td>
                    <!-- Actual (Red) -->
                    <td class="p-0 border-r border-border text-center bg-rose-50/25 dark:bg-rose-950/10">
                      <input type="text" class="plan-cell-input student-plan-input w-full h-8 text-center text-xs bg-transparent focus:bg-rose-100/50 dark:focus:bg-rose-900/30 focus:outline-none font-bold text-rose-600" data-subject-id="${sub.id}" data-field="actual" data-month-key="${m.key}" value="${escapeHtml(m.actual || '')}">
                    </td>
                  `).join('')}
                  <!-- End of Year Target -->
                  <td class="p-0 border-r border-border/50 text-center">
                    <input type="text" class="plan-cell-input student-plan-input w-full h-8 text-center text-xs bg-transparent focus:bg-primary/10 focus:outline-none font-medium" data-subject-id="${sub.id}" data-field="targetFinal" value="${escapeHtml(sub.targetFinal || '')}">
                  </td>
                  <!-- End of Year Actual -->
                  <td class="p-0 text-center bg-rose-50/25 dark:bg-rose-950/10">
                    <input type="text" class="plan-cell-input student-plan-input w-full h-8 text-center text-xs bg-transparent focus:bg-rose-100/50 dark:focus:bg-rose-900/30 focus:outline-none font-bold text-rose-600" data-subject-id="${sub.id}" data-field="actualFinal" value="${escapeHtml(sub.actualFinal || '')}">
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Signatures Footer matching Image 2 -->
        <div class="mt-8 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-center font-khmer">
          <!-- Principal -->
          <div class="space-y-1">
            <p class="font-semibold text-foreground">បានឃើញ និងឯកភាព</p>
            <p class="font-bold text-foreground">នាយកសាលា</p>
            <div class="h-16"></div>
            <p class="border-t border-dotted border-border inline-block px-8 pt-1 text-muted-foreground font-medium">ហត្ថលេខា និងត្រា</p>
          </div>

          <!-- Parent / Guardian -->
          <div class="space-y-1">
            <p class="font-semibold text-foreground">បានឃើញ និងឯកភាព</p>
            <p class="font-bold text-foreground">មាតាបិតា ឬអាណាព្យាបាលសិស្ស</p>
            <div class="h-16"></div>
            <p class="border-t border-dotted border-border inline-block px-8 pt-1 text-foreground font-semibold">${student.fatherName || student.motherName || student.parentName || 'ហត្ថលេខា'}</p>
          </div>

          <!-- Student Signature with Lunar and Solar date -->
          <div class="space-y-0.5">
            <p class="text-[11px] leading-relaxed text-foreground font-medium">
              ${lunarDateText}
            </p>
            <p class="text-[11px] leading-relaxed text-foreground font-medium">
              ${school.province ? `${school.province} ` : ''}${solarDateText}
            </p>
            <p class="font-bold text-foreground pt-1">ហត្ថលេខានិងឈ្មោះសិស្ស</p>
            <div class="h-14"></div>
            <p class="font-bold text-primary underline underline-offset-4 inline-block px-4">${student.khmerName || student.englishName}</p>
          </div>
        </div>
      </div>
    `;

    this.bindPlanInputEvents();
  },

  gatherPlanPayload() {
    const container = document.getElementById('rep-table-container');
    if (!container) return {};

    const familyStatus = container.querySelector('#meta-family-status')?.value || '';
    const schoolName = container.querySelector('#meta-school-name')?.value || '';
    const province = container.querySelector('#meta-province')?.value || '';
    const fatherName = container.querySelector('#meta-father-name')?.value || '';
    const fatherPhone = container.querySelector('#meta-father-phone')?.value || '';
    const motherName = container.querySelector('#meta-mother-name')?.value || '';
    const motherPhone = container.querySelector('#meta-mother-phone')?.value || '';
    const parentName = [fatherName, motherName].filter(Boolean).join(' / ');
    const parentPhone = fatherPhone || motherPhone || '';
    const teacherName = container.querySelector('#meta-teacher-name')?.value || '';
    const teacherPhone = container.querySelector('#meta-teacher-phone')?.value || '';

    const baseline = {};
    const targets = {};
    const actuals = {};
    const targetFinal = {};
    const actualFinal = {};

    container.querySelectorAll('.plan-cell-input').forEach(input => {
      const subId = input.dataset.subjectId;
      const field = input.dataset.field;
      const val = input.value.trim();

      if (!subId) return;

      if (field === 'baseline') {
        baseline[subId] = val;
      } else if (field === 'target') {
        const mKey = input.dataset.monthKey;
        if (!targets[subId]) targets[subId] = {};
        targets[subId][mKey] = val;
      } else if (field === 'actual') {
        const mKey = input.dataset.monthKey;
        if (!actuals[subId]) actuals[subId] = {};
        actuals[subId][mKey] = val;
      } else if (field === 'targetFinal') {
        targetFinal[subId] = val;
      } else if (field === 'actualFinal') {
        actualFinal[subId] = val;
      }
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
      reportDate: this.state.studentPlanData?.reportDate || new Date().toISOString().split('T')[0]
    };
  },

  bindPlanInputEvents() {
    const container = document.getElementById('rep-table-container');
    if (!container) return;

    const triggerAutoSave = () => {
      const statusEl = document.getElementById('plan-sync-status');
      if (statusEl) statusEl.textContent = 'កំពុងរក្សាទុក...';

      clearTimeout(this.state.planSaveDebounceTimer);
      this.state.planSaveDebounceTimer = setTimeout(async () => {
        try {
          const payload = this.gatherPlanPayload();
          await StudentPlanService.saveStudentPlan(
            this.state.selectedClassId,
            this.state.selectedStudentId,
            this.state.activeYear,
            payload
          );
          if (statusEl) {
            statusEl.textContent = 'បានរក្សាទុក';
            setTimeout(() => {
              if (statusEl && statusEl.textContent === 'បានរក្សាទុក') {
                statusEl.textContent = '';
              }
            }, 2500);
          }
        } catch (err) {
          console.warn('Auto save plan error:', err);
          if (statusEl) statusEl.textContent = 'រក្សាទុកបរាជ័យ';
        }
      }, 500);
    };

    container.querySelectorAll('input.student-plan-input').forEach(input => {
      input.addEventListener('input', triggerAutoSave);
      input.addEventListener('change', triggerAutoSave);
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
        const studentFilterBox = document.getElementById('filter-rep-student-box');

        if (this.state.activeTab === 'teachers' || this.state.activeTab === 'classes') {
          classFilterBox?.classList.add('hidden');
          statusFilterBox?.classList.add('hidden');
          studentFilterBox?.classList.add('hidden');
        } else if (this.state.activeTab === 'studentPlan') {
          classFilterBox?.classList.remove('hidden');
          statusFilterBox?.classList.add('hidden');
          studentFilterBox?.classList.remove('hidden');
          // If 'all' was selected, switch to first class
          if (this.state.selectedClassId === 'all' && this.state.classes.length > 0) {
            this.state.selectedClassId = this.state.classes[0].id;
            const selectCls = document.getElementById('select-rep-class');
            if (selectCls) selectCls.value = this.state.selectedClassId;
          }
        } else {
          classFilterBox?.classList.remove('hidden');
          studentFilterBox?.classList.add('hidden');
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
      if (this.state.activeTab === 'studentPlan') {
        this.state.selectedStudentId = null;
      }
      await this.loadReportData();
    });

    // Filter student (for student plan tab)
    document.getElementById('select-rep-student')?.addEventListener('change', async (e) => {
      this.state.selectedStudentId = e.target.value;
      await this.loadReportData();
    });

    // Prev / Next Student Buttons
    document.getElementById('btn-prev-student')?.addEventListener('click', async () => {
      const list = this.state.studentsInClass;
      if (!list || list.length === 0) return;
      const currIdx = list.findIndex(s => s.studentId === this.state.selectedStudentId);
      if (currIdx > 0) {
        this.state.selectedStudentId = list[currIdx - 1].studentId;
        const sel = document.getElementById('select-rep-student');
        if (sel) sel.value = this.state.selectedStudentId;
        await this.loadReportData();
      }
    });

    document.getElementById('btn-next-student')?.addEventListener('click', async () => {
      const list = this.state.studentsInClass;
      if (!list || list.length === 0) return;
      const currIdx = list.findIndex(s => s.studentId === this.state.selectedStudentId);
      if (currIdx >= 0 && currIdx < list.length - 1) {
        this.state.selectedStudentId = list[currIdx + 1].studentId;
        const sel = document.getElementById('select-rep-student');
        if (sel) sel.value = this.state.selectedStudentId;
        await this.loadReportData();
      }
    });

    // Filter status
    document.getElementById('select-rep-status')?.addEventListener('change', async (e) => {
      this.state.selectedStatus = e.target.value;
      await this.loadReportData();
    });

    // Print
    document.getElementById('btn-print-report')?.addEventListener('click', () => {
      if (this.state.activeTab === 'studentPlan') {
        document.body.classList.add('print-student-plan');
        window.addEventListener('afterprint', () => {
          document.body.classList.remove('print-student-plan');
        }, { once: true });
        setTimeout(() => {
          document.body.classList.remove('print-student-plan');
        }, 8000);
      }
      window.print();
    });

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      if (this.state.activeTab === 'studentPlan') {
        if (!this.state.studentPlanData) {
          toast.error('No student plan data to export');
          return;
        }
        const plan = this.state.studentPlanData;
        const student = plan.student || {};
        const cls = plan.class || {};
        const months = StudentPlanService.getMonths();

        const headers = [
          { key: 'no', label: '#' },
          { key: 'subject', label: 'មុខវិជ្ជា' },
          { key: 'baseline', label: 'កម្រិតពិន្ទុដើមឆ្នាំ' },
          ...months.flatMap(m => [
            { key: `${m.key}_target`, label: `${m.labelKm} ដាក់ពិន្ទុ` },
            { key: `${m.key}_actual`, label: `${m.labelKm} ជាក់ស្តែង` }
          ]),
          { key: 'final_target', label: 'កម្រិតពិន្ទុចុងឆ្នាំ ដាក់ពិន្ទុ' },
          { key: 'final_actual', label: 'កម្រិតពិន្ទុចុងឆ្នាំ ជាក់ស្តែង' }
        ];

        const payload = this.gatherPlanPayload();
        const rows = (plan.subjects || []).map((sub, idx) => {
          const row = {
            no: idx + 1,
            subject: sub.name,
            baseline: payload.baseline?.[sub.id] ?? sub.baseline ?? '',
            final_target: payload.targetFinal?.[sub.id] ?? sub.targetFinal ?? '',
            final_actual: payload.actualFinal?.[sub.id] ?? sub.actualFinal ?? ''
          };
          months.forEach(m => {
            row[`${m.key}_target`] = payload.targets?.[sub.id]?.[m.key] ?? sub.months.find(x => x.key === m.key)?.target ?? '';
            row[`${m.key}_actual`] = payload.actuals?.[sub.id]?.[m.key] ?? sub.months.find(x => x.key === m.key)?.actual ?? '';
          });
          return row;
        });

        const filename = `PhanKarSiss_${student.khmerName || student.studentId}_${cls.name}_${new Date().toISOString().split('T')[0]}`;
        ReportService.exportToCSV(filename, headers, rows);
        toast.success('CSV report generated and downloaded');
        return;
      }

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
