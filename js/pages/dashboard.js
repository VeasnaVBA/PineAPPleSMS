/**
 * Dashboard Page
 * Real-time statistics calculated directly from IndexedDB
 */
import { StudentService } from '../services/studentService.js';
import { TeacherService } from '../services/teacherService.js';
import { ClassService } from '../services/classService.js';
import { AttendanceService } from '../services/attendanceService.js';
import { SettingsService } from '../services/settingsService.js';
import { t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';

export const DashboardPage = {
  async render(container) {
    container.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">${t('dashboard.title')}</h1>
            <p class="text-sm text-muted-foreground mt-1">${t('dashboard.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2 self-start sm:self-auto">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              ${t('dashboard.offlineReady')}
            </span>
          </div>
        </div>

        <!-- Metric Stat Cards (Calculated from IndexedDB) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-stats-grid">
          <!-- Students Card -->
          <div class="p-5 rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:border-border/80 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">${t('dashboard.totalStudents')}</span>
              <div class="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                ${getIcon('students', 'w-5 h-5')}
              </div>
            </div>
            <div class="mt-3">
              <h3 class="text-3xl font-bold tracking-tight" id="stat-total-students">--</h3>
              <div class="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span class="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                  <span id="stat-active-students">--</span> ${t('common.active')}
                </span>
                <span>•</span>
                <span id="stat-inactive-students">--</span> ${t('common.inactive')}
              </div>
            </div>
          </div>

          <!-- Teachers Card -->
          <div class="p-5 rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:border-border/80 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">${t('dashboard.totalTeachers')}</span>
              <div class="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                ${getIcon('teachers', 'w-5 h-5')}
              </div>
            </div>
            <div class="mt-3">
              <h3 class="text-3xl font-bold tracking-tight" id="stat-total-teachers">--</h3>
              <p class="text-xs text-muted-foreground mt-2">${t('settings.teachersCount')}</p>
            </div>
          </div>

          <!-- Classes Card -->
          <div class="p-5 rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:border-border/80 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">${t('dashboard.totalClasses')}</span>
              <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                ${getIcon('classes', 'w-5 h-5')}
              </div>
            </div>
            <div class="mt-3">
              <h3 class="text-3xl font-bold tracking-tight" id="stat-total-classes">--</h3>
              <p class="text-xs text-muted-foreground mt-2">${t('settings.classesCount')}</p>
            </div>
          </div>

          <!-- Attendance Card -->
          <div class="p-5 rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:border-border/80 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">${t('dashboard.todayAttendance')}</span>
              <div class="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                ${getIcon('attendance', 'w-5 h-5')}
              </div>
            </div>
            <div class="mt-3">
              <div class="flex items-baseline gap-2">
                <h3 class="text-3xl font-bold tracking-tight" id="stat-attendance-rate">--%</h3>
              </div>
              <p class="text-xs text-muted-foreground mt-2" id="stat-attendance-details">Calculating roll-call...</p>
            </div>
          </div>
        </div>

        <!-- Quick Actions & Recent Activity Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Quick Actions -->
          <div class="lg:col-span-1 p-5 rounded-xl border border-border bg-card shadow-sm">
            <h4 class="text-base font-semibold text-foreground tracking-tight mb-4">${t('dashboard.quickActions')}</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              <a href="#students" class="flex items-center gap-3 p-3 rounded-lg border border-border/80 hover:bg-muted/70 transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  ${getIcon('plus', 'w-5 h-5')}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground group-hover:text-primary transition-colors">${t('dashboard.addStudent')}</p>
                  <p class="text-xs text-muted-foreground truncate">Register new learner</p>
                </div>
              </a>

              <a href="#attendance" class="flex items-center gap-3 p-3 rounded-lg border border-border/80 hover:bg-muted/70 transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  ${getIcon('attendance', 'w-5 h-5')}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground group-hover:text-primary transition-colors">${t('dashboard.takeAttendance')}</p>
                  <p class="text-xs text-muted-foreground truncate">Record daily roll-call</p>
                </div>
              </a>

              <a href="#scores" class="flex items-center gap-3 p-3 rounded-lg border border-border/80 hover:bg-muted/70 transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  ${getIcon('scores', 'w-5 h-5')}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground group-hover:text-primary transition-colors">${t('dashboard.enterScores')}</p>
                  <p class="text-xs text-muted-foreground truncate">Input monthly marks</p>
                </div>
              </a>

              <a href="#reports" class="flex items-center gap-3 p-3 rounded-lg border border-border/80 hover:bg-muted/70 transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  ${getIcon('reports', 'w-5 h-5')}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground group-hover:text-primary transition-colors">${t('dashboard.viewReports')}</p>
                  <p class="text-xs text-muted-foreground truncate">Print & export rosters</p>
                </div>
              </a>
            </div>
          </div>

          <!-- Recent Activity Feed -->
          <div class="lg:col-span-2 p-5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-base font-semibold text-foreground tracking-tight">${t('dashboard.recentActivity')}</h4>
                <span class="text-xs text-muted-foreground">IndexedDB Audit Log</span>
              </div>

              <div id="activity-logs-container" class="space-y-3">
                <div class="text-xs text-muted-foreground py-4 text-center">Loading activity...</div>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Database Engine: <strong>IndexedDB (Offline Native)</strong></span>
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                System Healthy
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load dynamic data from DB
    await this.loadStats();
    await this.loadActivityLogs();
  },

  async loadStats() {
    try {
      const studentStats = await StudentService.getStats();
      const teacherCount = await TeacherService.count();
      const classCount = await ClassService.count();
      const attStats = await AttendanceService.getTodayStats();

      // Update Students
      const elTotalStudents = document.getElementById('stat-total-students');
      const elActiveStudents = document.getElementById('stat-active-students');
      const elInactiveStudents = document.getElementById('stat-inactive-students');
      if (elTotalStudents) elTotalStudents.textContent = studentStats.total;
      if (elActiveStudents) elActiveStudents.textContent = studentStats.active;
      if (elInactiveStudents) elInactiveStudents.textContent = studentStats.inactive + studentStats.graduated;

      // Update Teachers
      const elTotalTeachers = document.getElementById('stat-total-teachers');
      if (elTotalTeachers) elTotalTeachers.textContent = teacherCount;

      // Update Classes
      const elTotalClasses = document.getElementById('stat-total-classes');
      if (elTotalClasses) elTotalClasses.textContent = classCount;

      // Update Attendance
      const elAttRate = document.getElementById('stat-attendance-rate');
      const elAttDetails = document.getElementById('stat-attendance-details');
      if (elAttRate) elAttRate.textContent = `${attStats.percentage}%`;
      if (elAttDetails) {
        elAttDetails.textContent = `${attStats.present} Present, ${attStats.absent} Absent, ${attStats.late} Late`;
      }
    } catch (err) {
      console.error('Failed to compute dashboard stats:', err);
    }
  },

  async loadActivityLogs() {
    try {
      const logs = await SettingsService.getActivityLogs(5);
      const container = document.getElementById('activity-logs-container');
      if (!container) return;

      if (!logs || logs.length === 0) {
        container.innerHTML = `<p class="text-xs text-muted-foreground py-2">${t('dashboard.noRecentActivity')}</p>`;
        return;
      }

      container.innerHTML = logs.map(log => {
        const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/50">
            <div class="mt-0.5 w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs">
              ${getIcon('clock', 'w-3.5 h-3.5')}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-foreground">${log.description}</p>
              <span class="text-[11px] text-muted-foreground">${timeStr}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    }
  }
};
