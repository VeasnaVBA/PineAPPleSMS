/**
 * Reports & Printable Documents Center (Section 17)
 * Generates and prints official rosters, student directory, faculty list,
 * attendance reports, and academic rank lists with CSV & JSON export.
 */
import { ReportService } from '../services/reportService.js';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';

export const ReportsPage = {
  state: {
    activeTab: 'students', // 'students', 'teachers', 'classes', 'attendance', 'rankings'
    classes: [],
    selectedClassId: 'all',
    selectedStatus: 'all',
    activeYear: '2024–2025',
    schoolNameKm: 'សាលារៀនអន្តរជាតិ ស្មាតស្គូល',
    schoolNameEn: 'SmartSchool International Academy',
    reportData: []
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
              <button id="btn-export-csv" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs sm:text-sm font-medium transition-colors">
                ${getIcon('download', 'w-4 h-4')}
                <span>${t('reports.exportCSV')}</span>
              </button>
            ` : ''}
            ${authService.can('reports.print') ? `
              <button id="btn-print-report" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
                ${getIcon('printer', 'w-4 h-4')}
                <span>${t('reports.printReport')}</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Navigation Tabs Bar (Hidden on print) -->
        <div class="no-print p-1.5 rounded-xl border border-border bg-card shadow-sm flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'students' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="students">
            ${t('reports.studentReport')}
          </button>
          ${authService.isTeacher() ? '' : `
            <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'teachers' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="teachers">
              ${t('reports.teacherReport')}
            </button>
          `}
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'classes' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="classes">
            ${t('reports.classReport')}
          </button>
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'attendance' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="attendance">
            ${t('reports.attendanceReport')}
          </button>
          <button class="rep-tab-btn px-4 py-2 rounded-lg transition-all ${this.state.activeTab === 'rankings' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}" data-tab="rankings">
            ${t('reports.rankingReport')}
          </button>
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
          <!-- Official School Header -->
          <div class="text-center space-y-1 pb-4 border-b-2 border-border/80">
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

          <!-- Dynamic Table Content -->
          <div class="overflow-x-auto">
            <div id="rep-table-container">
              <div class="py-12 text-center text-muted-foreground text-xs">Loading report...</div>
            </div>
          </div>

          <!-- Official Signatures Footer (Visible in print) -->
          <div class="pt-8 grid grid-cols-2 gap-8 text-xs text-center">
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
    `;
  },

  bindStaticEvents() {
    // Switch tabs
    this.container.querySelectorAll('.rep-tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.state.activeTab = btn.getAttribute('data-tab');
        this.container.querySelectorAll('.rep-tab-btn').forEach(b => {
          b.className = `rep-tab-btn px-4 py-2 rounded-lg transition-all ${b === btn ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;
        });

        // Toggle filter boxes visibility depending on tab
        const classFilterBox = document.getElementById('filter-rep-class-box');
        const statusFilterBox = document.getElementById('filter-rep-status-box');

        if (this.state.activeTab === 'teachers' || this.state.activeTab === 'classes') {
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
