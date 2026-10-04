/**
 * Attendance Management Module (Section 15)
 * Class roll-call, Present/Absent/Late/Excused status, Mark all present,
 * dynamic statistics calculation, and historical audit logs.
 */
import { AttendanceService } from '../services/attendanceService.js';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { photoService } from '../services/photoService.js';
import { authService } from '../services/authService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { getIcon } from '../components/icons.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export const AttendancePage = {
  state: {
    classes: [],
    selectedClassId: '',
    selectedDate: new Date().toISOString().split('T')[0],
    activeYear: '2024–2025',
    records: []
  },

  async render(container) {
    this.container = container;
    this.state.classes = await ClassService.getAll();
    this.state.activeYear = await SettingsService.getActiveAcademicYear();

    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
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

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">${t('attendance.title')}</h1>
            <p class="text-sm text-muted-foreground mt-1">${t('attendance.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-view-history" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs sm:text-sm font-medium transition-colors">
              ${getIcon('clock', 'w-4 h-4')}
              <span>${t('attendance.historyBtn')}</span>
            </button>
            <button id="btn-save-attendance" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
              ${getIcon('check', 'w-4 h-4')}
              <span>${t('attendance.saveAttendance')}</span>
            </button>
          </div>
        </div>

        <!-- Filter & Date Controls -->
        <div class="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <!-- Class Selector -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground font-medium">${t('attendance.class')}:</span>
              ${authService.isTeacher() ? (() => {
                const assignedCls = classes.find(c => c.id === authService.getAssignedClassId());
                return `
                  <div class="h-9 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary flex items-center gap-1.5 box-border">
                    ${getIcon('classes', 'w-3.5 h-3.5')}
                    <span>${assignedCls ? assignedCls.name : 'Assigned Class'}</span>
                  </div>
                `;
              })() : `
                <select id="select-att-class" class="h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-background text-xs sm:text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs">
                  ${classes.map(c => `
                    <option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Date Picker -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground font-medium">${t('attendance.date')}:</span>
              <input type="date" id="input-att-date" value="${this.state.selectedDate}" class="h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
            </div>
          </div>

          <!-- Quick Action: Mark All Present -->
          <button id="btn-mark-all-present" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-colors self-start sm:self-auto">
            ${getIcon('check', 'w-3.5 h-3.5')}
            <span>${t('attendance.markAllPresent')}</span>
          </button>
        </div>

        <!-- Live Summary Stats Banner -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3" id="att-summary-banner">
          <div class="p-3 rounded-lg bg-card border border-border">
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Total Learners</span>
            <p class="text-lg font-bold text-foreground mt-0.5" id="stat-att-total">0</p>
          </div>
          <div class="p-3 rounded-lg bg-card border border-border">
            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider block">${t('attendance.present')}</span>
            <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" id="stat-att-present">0</p>
          </div>
          <div class="p-3 rounded-lg bg-card border border-border">
            <span class="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold tracking-wider block">${t('attendance.absent')}</span>
            <p class="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5" id="stat-att-absent">0</p>
          </div>
          <div class="p-3 rounded-lg bg-card border border-border">
            <span class="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold tracking-wider block">${t('attendance.late')}</span>
            <p class="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5" id="stat-att-late">0</p>
          </div>
          <div class="p-3 rounded-lg bg-card border border-border col-span-2 sm:col-span-1">
            <span class="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider block">${t('attendance.attendanceRate')}</span>
            <p class="text-lg font-bold text-primary mt-0.5" id="stat-att-rate">0%</p>
          </div>
        </div>

        <!-- Attendance Sheet Table Card -->
        <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr class="border-b border-border bg-muted/40 text-muted-foreground font-medium select-none">
                  <th class="w-12 px-4 py-3 text-center">#</th>
                  <th class="px-4 py-3">${t('students.studentId')}</th>
                  <th class="px-4 py-3">${t('students.khmerName')} / ${t('students.englishName')}</th>
                  <th class="px-4 py-3">${t('common.gender')}</th>
                  <th class="px-4 py-3 text-center">${t('common.status')}</th>
                </tr>
              </thead>
              <tbody id="attendance-table-body" class="divide-y divide-border">
                <tr>
                  <td colspan="5" class="py-12 text-center text-muted-foreground">
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
      </div>
    `;

    this.bindStaticEvents();
  },

  async loadSheet() {
    this.state.records = await AttendanceService.getAttendanceSheet(
      this.state.selectedDate,
      this.state.selectedClassId,
      this.state.activeYear
    );

    this.renderRows();
    this.updateStats();
  },

  renderRows() {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;

    const records = this.state.records;

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-muted-foreground">
            <p class="text-xs">${t('attendance.emptyStudents')}</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = records.map((r, idx) => {
      const photoUrl = r.photoBlob ? photoService.getUrlForBlob(r.photoBlob) : null;

      return `
        <tr class="hover:bg-muted/30 transition-colors" data-student-id="${r.studentId}">
          <td class="px-4 py-3 text-center text-muted-foreground font-mono">
            ${idx + 1}
          </td>
          <td class="px-4 py-3 font-mono font-medium text-foreground">
            ${r.studentNumber}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-border">
                ${photoUrl 
                  ? `<img src="${photoUrl}" class="w-full h-full object-cover" />` 
                  : (r.englishName ? r.englishName.charAt(0).toUpperCase() : 'S')}
              </div>
              <div class="min-w-0">
                <p class="font-medium text-foreground truncate font-khmer">${r.khmerName || '—'}</p>
                <p class="text-[11px] text-muted-foreground truncate">${r.englishName || ''}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-muted-foreground text-xs">
            ${r.gender === 'Female' ? t('common.female') : t('common.male')}
          </td>
          <td class="px-4 py-3">
            <!-- Status Button Pills (Present, Absent, Late, Excused) -->
            <div class="flex items-center justify-center gap-1.5 select-none" data-student="${r.studentId}">
              <button type="button" class="btn-att-pill px-2.5 py-1 rounded text-xs font-medium transition-all ${r.status === 'Present' ? 'bg-emerald-500 text-white font-bold shadow-sm' : 'border border-border text-muted-foreground hover:bg-muted'}" data-status="Present">
                ${t('attendance.present')}
              </button>
              <button type="button" class="btn-att-pill px-2.5 py-1 rounded text-xs font-medium transition-all ${r.status === 'Absent' ? 'bg-rose-500 text-white font-bold shadow-sm' : 'border border-border text-muted-foreground hover:bg-muted'}" data-status="Absent">
                ${t('attendance.absent')}
              </button>
              <button type="button" class="btn-att-pill px-2.5 py-1 rounded text-xs font-medium transition-all ${r.status === 'Late' ? 'bg-amber-500 text-white font-bold shadow-sm' : 'border border-border text-muted-foreground hover:bg-muted'}" data-status="Late">
                ${t('attendance.late')}
              </button>
              <button type="button" class="btn-att-pill px-2.5 py-1 rounded text-xs font-medium transition-all ${r.status === 'Excused' ? 'bg-blue-500 text-white font-bold shadow-sm' : 'border border-border text-muted-foreground hover:bg-muted'}" data-status="Excused">
                ${t('attendance.excused')}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.bindRowEvents();
  },

  bindRowEvents() {
    this.container.querySelectorAll('.btn-att-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const studentId = pill.closest('[data-student]').getAttribute('data-student');
        const status = pill.getAttribute('data-status');

        const record = this.state.records.find(r => r.studentId === studentId);
        if (record) {
          record.status = status;
          // Update button styling in DOM
          const group = pill.closest('[data-student]');
          group.querySelectorAll('.btn-att-pill').forEach(b => {
            const bStatus = b.getAttribute('data-status');
            b.className = `btn-att-pill px-2.5 py-1 rounded text-xs font-medium transition-all ${bStatus === status ? this.getPillActiveStyle(status) : 'border border-border text-muted-foreground hover:bg-muted'}`;
          });
          this.updateStats();
        }
      });
    });
  },

  getPillActiveStyle(status) {
    if (status === 'Present') return 'bg-emerald-500 text-white font-bold shadow-sm';
    if (status === 'Absent') return 'bg-rose-500 text-white font-bold shadow-sm';
    if (status === 'Late') return 'bg-amber-500 text-white font-bold shadow-sm';
    return 'bg-blue-500 text-white font-bold shadow-sm';
  },

  updateStats() {
    const total = this.state.records.length;
    const present = this.state.records.filter(r => r.status === 'Present').length;
    const absent = this.state.records.filter(r => r.status === 'Absent').length;
    const late = this.state.records.filter(r => r.status === 'Late').length;
    const excused = this.state.records.filter(r => r.status === 'Excused').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    const elTotal = document.getElementById('stat-att-total');
    const elPresent = document.getElementById('stat-att-present');
    const elAbsent = document.getElementById('stat-att-absent');
    const elLate = document.getElementById('stat-att-late');
    const elRate = document.getElementById('stat-att-rate');

    if (elTotal) elTotal.textContent = total;
    if (elPresent) elPresent.textContent = present;
    if (elAbsent) elAbsent.textContent = absent;
    if (elLate) elLate.textContent = late;
    if (elRate) elRate.textContent = `${rate}%`;
  },

  bindStaticEvents() {
    // Change class
    document.getElementById('select-att-class')?.addEventListener('change', async (e) => {
      this.state.selectedClassId = e.target.value;
      await this.loadSheet();
    });

    // Change date
    document.getElementById('input-att-date')?.addEventListener('change', async (e) => {
      this.state.selectedDate = e.target.value;
      await this.loadSheet();
    });

    // Mark All Present
    document.getElementById('btn-mark-all-present')?.addEventListener('click', () => {
      for (const r of this.state.records) {
        r.status = 'Present';
      }
      this.renderRows();
      this.updateStats();
      toast.info('Marked all students as Present');
    });

    // Save Attendance
    document.getElementById('btn-save-attendance')?.addEventListener('click', async () => {
      if (this.state.records.length === 0) return;
      try {
        await AttendanceService.saveAttendanceSheet(this.state.records);
        const selectedCls = this.state.classes.find(c => c.id === this.state.selectedClassId);
        toast.success(t('attendance.savedSuccess', { 
          class: selectedCls?.name || '', 
          date: this.state.selectedDate 
        }));
      } catch (err) {
        toast.error(err.message);
      }
    });

    // View History Modal
    document.getElementById('btn-view-history')?.addEventListener('click', async () => {
      const history = await AttendanceService.getAttendanceHistory(this.state.selectedClassId, 20);
      this.openHistoryModal(history);
    });
  },

  openHistoryModal(history) {
    const content = `
      <div class="space-y-4 text-xs">
        <p class="text-muted-foreground">Select a past session to load or inspect roll-call:</p>
        
        ${history.length === 0 ? `
          <p class="py-6 text-center text-muted-foreground italic">${t('attendance.noHistory')}</p>
        ` : `
          <div class="divide-y divide-border border border-border rounded-lg max-h-72 overflow-y-auto">
            ${history.map(h => {
              const rate = h.total > 0 ? Math.round(((h.present + h.late) / h.total) * 100) : 0;
              return `
                <div class="p-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
                  <div>
                    <span class="font-mono font-bold text-foreground text-sm">${formatDisplayDate(h.date)}</span>
                    <p class="text-[11px] text-muted-foreground mt-0.5">
                      ${h.present} Present • ${h.absent} Absent • ${h.late} Late
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">${rate}% Attended</span>
                    <button class="btn-load-history-date px-2.5 py-1 rounded bg-muted hover:bg-card border border-border text-foreground text-xs" data-date="${h.date}">
                      Open
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    const footer = `
      <button class="btn-close-hist px-4 py-2 rounded-lg bg-card border border-border text-xs font-medium hover:bg-muted">
        Close
      </button>
    `;

    const modal = Modal.open({
      title: t('attendance.historyModalTitle'),
      content,
      footer,
      maxWidth: 'max-w-md'
    });

    modal.element.querySelector('.btn-close-hist')?.addEventListener('click', () => modal.close());

    modal.element.querySelectorAll('.btn-load-history-date').forEach(btn => {
      btn.addEventListener('click', async () => {
        const date = btn.getAttribute('data-date');
        this.state.selectedDate = date;
        const inputDate = document.getElementById('input-att-date');
        if (inputDate) inputDate.value = date;
        modal.close();
        await this.loadSheet();
      });
    });
  }
};
