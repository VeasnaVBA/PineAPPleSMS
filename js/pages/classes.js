/**
 * Class Management Module
 * Lists classes with assigned homeroom teachers, room numbers,
 * active academic year, enrolled student rosters, and full CRUD.
 */
import { ClassService } from '../services/classService.js';
import { TeacherService } from '../services/teacherService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { renderActionDropdown } from '../components/actionDropdown.js';

export const ClassesPage = {
  state: {
    classes: [],
    teachers: [],
    activeYear: '2024–2025',
    userClassCount: 0,
    isLimitReached: false
  },

  async render(container) {
    this.container = container;
    await this.loadData();
    this.renderLayout();
  },

  async loadData() {
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role === 'TEACHER') {
      this.state.userClassCount = await ClassService.countByTeacher(currentUser);
      this.state.isLimitReached = this.state.userClassCount >= 1;
    } else {
      this.state.userClassCount = 0;
      this.state.isLimitReached = false;
    }

    this.state.classes = await ClassService.getClassesWithDetails();
    this.state.teachers = await TeacherService.getAll();
    this.state.activeYear = await SettingsService.getActiveAcademicYear();
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';
    const classes = this.state.classes;
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    const isLimitReached = this.state.isLimitReached;

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">${t('classes.title')}</h1>
            <p class="text-sm text-muted-foreground mt-1">${t('classes.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2">
            ${!isTeacher ? `
              <a href="#promotion"
                 class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer">
                ${getIcon('graduationCap', 'w-4 h-4 text-purple-600 dark:text-purple-400')}
                <span>${t('nav.promotion')}</span>
              </a>
            ` : ''}
            <button id="btn-add-class"
                    ${isLimitReached ? 'disabled aria-disabled="true"' : ''}
                    title="${isLimitReached ? t('classes.classLimitTooltip') : t('classes.addClass')}"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-sm transition-all ${
                      isLimitReached
                        ? 'bg-muted text-muted-foreground border border-border opacity-50 cursor-not-allowed pointer-events-none'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                    }">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${t('classes.addClass')}</span>
            </button>
          </div>
        </div>

        <!-- Teacher Classroom Limit Notice Banner (shown only when Teacher has reached 1 classroom limit) -->
        ${isLimitReached ? `
          <div class="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              ${getIcon('shield', 'w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0')}
              <span>${t('classes.classLimitNotice')}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              1 / 1
            </span>
          </div>
        ` : ''}

        <!-- Class Cards Grid -->
        ${classes.length === 0 ? `
          <div class="p-12 text-center rounded-xl border border-dashed border-border bg-card">
            <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground mb-3">
              ${getIcon('classes', 'w-6 h-6')}
            </div>
            <p class="text-sm text-muted-foreground">${t('classes.emptyList')}</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            ${classes.map(cls => {
              const teacherName = cls.teacherNameKhmer 
                ? (cls.teacherNameEnglish ? `${cls.teacherNameKhmer} (${cls.teacherNameEnglish})` : cls.teacherNameKhmer) 
                : (cls.teacherNameEnglish || t('classes.noTeacher'));

              return `
                <div class="p-5 rounded-xl border border-border bg-card shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between group">
                  <div>
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                          ${getIcon('classes', 'w-5 h-5')}
                        </div>
                        <div>
                          <h3 class="font-bold text-base text-foreground tracking-tight">${cls.name}</h3>
                          <span class="text-xs text-muted-foreground font-mono">Room: ${cls.room || '—'}</span>
                        </div>
                      </div>
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ${cls.status || 'Active'}
                      </span>
                    </div>

                    <div class="mt-4 pt-3 border-t border-border/60 space-y-2 text-xs">
                      <div class="flex items-center justify-between">
                        <span class="text-muted-foreground">${t('classes.homeroomTeacher')}:</span>
                        <span class="font-medium text-foreground truncate max-w-[170px]" title="${teacherName}">${teacherName}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-muted-foreground">${t('common.academicYear')}:</span>
                        <span class="font-medium text-foreground">${cls.academicYear || this.state.activeYear}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-muted-foreground">${t('classes.enrolledStudents')}:</span>
                        <span class="font-bold text-primary">${cls.studentCount} students (${cls.activeStudentCount} active)</span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-5 pt-3 border-t border-border flex items-center justify-between">
                    <button class="btn-view-roster inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer" data-id="${cls.id}" data-name="${cls.name}">
                      ${getIcon('students', 'w-3.5 h-3.5')}
                      <span>${t('classes.viewStudents')}</span>
                    </button>
                    ${renderActionDropdown({
                      id: cls.id,
                      title: isKm ? 'ជម្រើសសកម្មភាព' : 'Actions',
                      actions: [
                        {
                          label: isKm ? 'បញ្ជីសិស្ស' : 'View Roster',
                          icon: 'students',
                          onClick: async () => {
                            const students = await ClassService.getEnrolledStudents(cls.id);
                            this.openRosterModal(cls.name, students);
                          }
                        },
                        {
                          label: isKm ? 'កែប្រែ' : 'Edit',
                          icon: 'pencil',
                          onClick: async () => {
                            try {
                              const targetCls = await ClassService.getById(cls.id);
                              if (targetCls) this.openClassFormModal(targetCls);
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }
                        },
                        {
                          label: isKm ? 'លុប' : 'Delete',
                          icon: 'trash2',
                          destructive: true,
                          show: !isTeacher,
                          onClick: () => {
                            Modal.confirm({
                              title: t('common.delete'),
                              message: t('classes.confirmDelete', { name: cls.name }),
                              destructive: true,
                              onConfirm: async () => {
                                try {
                                  await ClassService.delete(cls.id);
                                  toast.success(t('classes.deletedSuccess'));
                                  await this.loadData();
                                  this.renderLayout();
                                } catch (err) {
                                  toast.error(err.message);
                                }
                              }
                            });
                          }
                        }
                      ]
                    })}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    // Add Class button with limit guard
    document.getElementById('btn-add-class')?.addEventListener('click', (e) => {
      if (this.state.isLimitReached) {
        e.preventDefault();
        e.stopPropagation();
        toast.error(t('classes.limitReachedToast'));
        return;
      }
      this.openClassFormModal();
    });

    // View Student Roster
    this.container.querySelectorAll('.btn-view-roster').forEach(btn => {
      btn.addEventListener('click', async () => {
        const classId = btn.getAttribute('data-id');
        const className = btn.getAttribute('data-name');
        const students = await ClassService.getEnrolledStudents(classId);
        this.openRosterModal(className, students);
      });
    });

    // Edit Class
    this.container.querySelectorAll('.btn-edit-class').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const cls = await ClassService.getById(id);
          if (cls) this.openClassFormModal(cls);
        } catch (err) {
          toast.error(err.message);
        }
      });
    });

    // Delete Class (Directors / Admins only)
    this.container.querySelectorAll('.btn-delete-class').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');

        Modal.confirm({
          title: t('common.delete'),
          message: t('classes.confirmDelete', { name }),
          destructive: true,
          onConfirm: async () => {
            try {
              await ClassService.delete(id);
              toast.success(t('classes.deletedSuccess'));
              await this.loadData();
              this.renderLayout();
            } catch (err) {
              toast.error(err.message);
            }
          }
        });
      });
    });
  },

  /**
   * Add / Edit Class Modal
   */
  async openClassFormModal(existingClass = null) {
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';

    // Prevent Teacher bypass if 1-class limit is reached
    if (!existingClass && isTeacher && this.state.isLimitReached) {
      toast.error(t('classes.limitReachedToast'));
      return;
    }

    const isEdit = !!existingClass;
    const title = isEdit ? t('classes.editClass') : t('classes.addClass');
    const isKm = i18n.getLocale() === 'km';

    // Always fetch latest teacher records and academic years directly from Settings
    const [teachers, settingsAcademicYears, activeYear] = await Promise.all([
      TeacherService.getAll(),
      SettingsService.getAcademicYears(),
      SettingsService.getActiveAcademicYear()
    ]);
    this.state.teachers = teachers;
    this.state.activeYear = activeYear;

    const academicYearsList = (settingsAcademicYears || [])
      .map(y => (typeof y === 'string' ? y : y?.name))
      .filter(Boolean);

    if (academicYearsList.length === 0 && activeYear) {
      academicYearsList.push(activeYear);
    } else if (academicYearsList.length === 0) {
      academicYearsList.push('2024–2025');
    }

    const currentClsYear = existingClass?.academicYear || activeYear || academicYearsList[0];

    const content = `
      <form id="class-form" class="space-y-4 text-xs sm:text-sm">
        <div>
          <label class="block text-xs font-medium text-foreground mb-1">${t('classes.className')} <span class="text-destructive">*</span></label>
          <input type="text" id="form-cls-name" required value="${existingClass?.name || ''}" placeholder="e.g. Grade 3A" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium box-border shadow-xs" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-foreground mb-1">${t('classes.homeroomTeacher')}</label>
            <select id="form-cls-teacher" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs">
              <option value="">${t('classes.noTeacher')}</option>
              ${teachers.map(tchr => {
                const nameLabel = isKm
                  ? (tchr.khmerName || tchr.englishName || tchr.teacherId || 'Teacher')
                  : (tchr.englishName || tchr.khmerName || tchr.teacherId || 'Teacher');
                const isSelected = existingClass 
                  ? (existingClass.teacherId === tchr.id || existingClass.teacherId === tchr.teacherId)
                  : (isTeacher && (tchr.userId === currentUser?.id || tchr.accountId === currentUser?.id));
                return `<option value="${tchr.id}" ${isSelected ? 'selected' : ''}>${nameLabel}</option>`;
              }).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-foreground mb-1">${t('classes.room')}</label>
            <input type="text" id="form-cls-room" value="${existingClass?.room || ''}" placeholder="e.g. Room 204" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
          </div>

          <div>
            <label class="block text-xs font-medium text-foreground mb-1">${t('common.academicYear')} <span class="text-destructive">*</span></label>
            <select id="form-cls-year" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs cursor-pointer">
              ${academicYearsList.map(yr => `
                <option value="${yr}" ${yr === currentClsYear ? 'selected' : ''}>${yr}</option>
              `).join('')}
              ${!academicYearsList.includes(currentClsYear) && currentClsYear ? `
                <option value="${currentClsYear}" selected>${currentClsYear}</option>
              ` : ''}
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-foreground mb-1">${t('common.status')}</label>
            <select id="form-cls-status" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs">
              <option value="Active" ${existingClass?.status === 'Active' ? 'selected' : ''}>${t('common.active')}</option>
              <option value="Inactive" ${existingClass?.status === 'Inactive' ? 'selected' : ''}>${t('common.inactive')}</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button id="btn-cancel-cls" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors">
        ${t('common.cancel')}
      </button>
      <button id="btn-save-cls" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-medium shadow-sm transition-colors">
        ${t('common.save')}
      </button>
    `;

    const modal = Modal.open({
      title,
      content,
      footer,
      maxWidth: 'max-w-md'
    });

    modal.element.querySelector('#btn-cancel-cls')?.addEventListener('click', () => modal.close());

    modal.element.querySelector('#btn-save-cls')?.addEventListener('click', async () => {
      const name = modal.element.querySelector('#form-cls-name')?.value.trim();
      if (!name) {
        toast.error(t('classes.nameRequired'));
        return;
      }

      const data = {
        name,
        teacherId: modal.element.querySelector('#form-cls-teacher')?.value,
        room: modal.element.querySelector('#form-cls-room')?.value.trim(),
        academicYear: modal.element.querySelector('#form-cls-year')?.value,
        status: modal.element.querySelector('#form-cls-status')?.value
      };

      try {
        if (isEdit) {
          await ClassService.update(existingClass.id, data);
          toast.success(t('classes.updatedSuccess'));
        } else {
          await ClassService.create(data);
          toast.success(t('classes.savedSuccess'));
        }
        modal.close();
        await this.loadData();
        this.renderLayout();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  /**
   * View Class Student Roster Modal
   */
  openRosterModal(className, students) {
    const content = `
      <div class="space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-border">
          <p class="text-xs text-muted-foreground">Class Roster: <strong class="text-foreground">${className}</strong></p>
          <span class="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-semibold">${students.length} students</span>
        </div>

        ${students.length === 0 ? `
          <p class="text-xs text-muted-foreground py-8 text-center">${t('classes.noStudentsInClass')}</p>
        ` : `
          <div class="max-h-80 overflow-y-auto divide-y divide-border">
            ${students.map((s, idx) => `
              <div class="py-2.5 flex items-center justify-between text-xs">
                <div class="flex items-center gap-3">
                  <span class="w-5 text-muted-foreground font-mono text-right">${idx + 1}.</span>
                  <div>
                    <p class="font-medium text-foreground font-khmer">${s.khmerName || '—'}</p>
                    <p class="text-[11px] text-muted-foreground">${s.englishName || ''} (${s.studentId})</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[11px] text-muted-foreground">${s.gender}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-medium ${s.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}">${s.status}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    const footer = `
      <button onclick="window.print()" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium">
        ${getIcon('download', 'w-3.5 h-3.5 inline mr-1')} Print Roster
      </button>
      <button class="btn-close-roster px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
        Close
      </button>
    `;

    const modal = Modal.open({
      title: `${t('classes.classDetails')}: ${className}`,
      content,
      footer,
      maxWidth: 'max-w-md'
    });

    modal.element.querySelector('.btn-close-roster')?.addEventListener('click', () => modal.close());
  }
};
