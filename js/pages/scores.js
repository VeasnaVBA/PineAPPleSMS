/**
 * Scores & Grading Management Module (Section 16)
 * Supports Academic Year, Class, Student, Subject, Month, Exam, Assignment.
 * Instant client-side calculations: Total = Assignment + Exam, Percentage, Grade (A-F), and Class Rank.
 * Includes student historical score card transcript modal.
 */
import { ScoreService } from '../services/scoreService.js';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { authService } from '../services/authService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';

export const ScoresPage = {
  state: {
    classes: [],
    subjects: [],
    months: [],
    selectedClassId: '',
    selectedSubjectId: 'sub-math',
    selectedMonth: 'October',
    selectedAssessment: 'Monthly Exam',
    activeYear: '2024–2025',
    scores: []
  },

  async render(container) {
    this.container = container;
    this.state.classes = await ClassService.getAll();
    this.state.subjects = ScoreService.getSubjects();
    this.state.months = ScoreService.getMonths();
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
    await this.loadScores();
  },

  renderLayout() {
    const classes = this.state.classes;
    const subjects = this.state.subjects;
    const months = this.state.months;

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">${t('scores.title')}</h1>
            <p class="text-sm text-muted-foreground mt-1">${t('scores.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-save-scores" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
              ${getIcon('check', 'w-4 h-4')}
              <span>${t('scores.saveScores')}</span>
            </button>
          </div>
        </div>

        <!-- Filter & Assessment Controls -->
        <div class="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
            <!-- Class -->
            <div>
              <label class="block text-[11px] text-muted-foreground font-medium mb-1">${t('scores.selectClass')}</label>
              ${authService.isTeacher() ? (() => {
                const assignedCls = classes.find(c => c.id === authService.getAssignedClassId());
                return `
                  <div class="h-9 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary flex items-center gap-1.5 box-border">
                    ${getIcon('classes', 'w-3.5 h-3.5')}
                    <span>${assignedCls ? assignedCls.name : 'Assigned Class'}</span>
                  </div>
                `;
              })() : `
                <select id="select-score-class" class="w-full h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-ring box-border shadow-xs">
                  ${classes.map(c => `
                    <option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Subject -->
            <div>
              <label class="block text-[11px] text-muted-foreground font-medium mb-1">${t('scores.selectSubject')}</label>
              <select id="select-score-subject" class="w-full h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-ring box-border shadow-xs">
                ${subjects.map(s => `
                  <option value="${s.id}" ${this.state.selectedSubjectId === s.id ? 'selected' : ''}>${s.nameEn} (${s.nameKm})</option>
                `).join('')}
              </select>
            </div>

            <!-- Month -->
            <div>
              <label class="block text-[11px] text-muted-foreground font-medium mb-1">${t('scores.selectMonth')}</label>
              <select id="select-score-month" class="w-full h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-ring box-border shadow-xs">
                ${months.map(m => `
                  <option value="${m}" ${this.state.selectedMonth === m ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
            </div>

            <!-- Assessment Type -->
            <div>
              <label class="block text-[11px] text-muted-foreground font-medium mb-1">${t('scores.assessmentType')}</label>
              <select id="select-score-type" class="w-full h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-ring box-border shadow-xs">
                <option value="Monthly Exam" ${this.state.selectedAssessment === 'Monthly Exam' ? 'selected' : ''}>Monthly Exam</option>
                <option value="Mid-Term Test" ${this.state.selectedAssessment === 'Mid-Term Test' ? 'selected' : ''}>Mid-Term Test</option>
                <option value="Final Semester" ${this.state.selectedAssessment === 'Final Semester' ? 'selected' : ''}>Final Semester</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Live Score Summary Cards -->
        <div class="grid grid-cols-3 gap-4" id="score-summary-banner">
          <div class="p-3.5 rounded-xl bg-card border border-border">
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">${t('scores.classAverage')}</span>
            <p class="text-xl font-bold text-foreground mt-1" id="stat-class-average">0.0</p>
          </div>
          <div class="p-3.5 rounded-xl bg-card border border-border">
            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider block">${t('scores.highestMark')}</span>
            <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1" id="stat-highest-mark">0 / 100</p>
          </div>
          <div class="p-3.5 rounded-xl bg-card border border-border">
            <span class="text-[10px] text-primary uppercase font-bold tracking-wider block">${t('scores.passRate')}</span>
            <p class="text-xl font-bold text-primary mt-1" id="stat-pass-rate">0%</p>
          </div>
        </div>

        <!-- Score Entry Table Card -->
        <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr class="border-b border-border bg-muted/40 text-muted-foreground font-medium select-none">
                  <th class="w-10 px-4 py-3 text-center">#</th>
                  <th class="px-4 py-3">${t('students.studentId')}</th>
                  <th class="px-4 py-3">${t('students.khmerName')} / ${t('students.englishName')}</th>
                  <th class="px-4 py-3 w-28">${t('scores.assignmentScore')}</th>
                  <th class="px-4 py-3 w-28">${t('scores.examScore')}</th>
                  <th class="px-4 py-3 w-20 text-center">${t('scores.totalScore')}</th>
                  <th class="px-4 py-3 w-20 text-center">${t('scores.percentage')}</th>
                  <th class="px-4 py-3 w-20 text-center">${t('scores.grade')}</th>
                  <th class="px-4 py-3 w-16 text-center">${t('scores.rank')}</th>
                  <th class="px-4 py-3 text-right">${t('common.actions')}</th>
                </tr>
              </thead>
              <tbody id="scores-table-body" class="divide-y divide-border">
                <tr>
                  <td colspan="10" class="py-12 text-center text-muted-foreground">
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

  async loadScores() {
    this.state.scores = await ScoreService.getScoreSheet({
      classId: this.state.selectedClassId,
      subjectId: this.state.selectedSubjectId,
      academicYear: this.state.activeYear,
      month: this.state.selectedMonth,
      assessmentType: this.state.selectedAssessment
    });

    this.renderRows();
    this.updateSummaryStats();
  },

  renderRows() {
    const tbody = document.getElementById('scores-table-body');
    if (!tbody) return;

    const scores = this.state.scores;

    if (scores.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="py-12 text-center text-muted-foreground">
            <p class="text-xs">${t('scores.emptyClass')}</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = scores.map((sc, idx) => {
      let gradeBadge = 'bg-muted text-muted-foreground';
      if (sc.grade === 'A') gradeBadge = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold';
      else if (sc.grade === 'B') gradeBadge = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold';
      else if (sc.grade === 'C') gradeBadge = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold';
      else if (sc.grade === 'D') gradeBadge = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold';
      else if (sc.grade === 'E') gradeBadge = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-bold';
      else if (sc.grade === 'F') gradeBadge = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold';

      return `
        <tr class="hover:bg-muted/30 transition-colors" data-student-id="${sc.studentId}">
          <td class="px-4 py-3 text-center text-muted-foreground font-mono">
            ${idx + 1}
          </td>
          <td class="px-4 py-3 font-mono font-medium text-foreground">
            ${sc.studentNumber}
          </td>
          <td class="px-4 py-3">
            <p class="font-medium text-foreground font-khmer truncate">${sc.khmerName || '—'}</p>
            <p class="text-[11px] text-muted-foreground truncate">${sc.englishName || ''}</p>
          </td>
          <td class="px-4 py-3">
            <input type="number" min="0" max="40" 
                   class="input-assignment w-20 h-8 px-2 py-1 rounded border border-input bg-card text-foreground font-mono text-center focus:ring-1 focus:ring-ring box-border shadow-xs" 
                   value="${sc.assignmentScore}" 
                   data-student="${sc.studentId}" />
          </td>
          <td class="px-4 py-3">
            <input type="number" min="0" max="60" 
                   class="input-exam w-20 h-8 px-2 py-1 rounded border border-input bg-card text-foreground font-mono text-center focus:ring-1 focus:ring-ring box-border shadow-xs" 
                   value="${sc.examScore}" 
                   data-student="${sc.studentId}" />
          </td>
          <td class="px-4 py-3 text-center font-bold text-foreground col-total">
            ${sc.total}
          </td>
          <td class="px-4 py-3 text-center font-mono col-percentage">
            ${sc.percentage}%
          </td>
          <td class="px-4 py-3 text-center">
            <span class="col-grade inline-flex items-center px-2 py-0.5 rounded-full text-xs ${gradeBadge}">
              ${sc.grade}
            </span>
          </td>
          <td class="px-4 py-3 text-center font-bold text-primary col-rank">
            #${sc.rank}
          </td>
          <td class="px-4 py-3 text-right">
            <button class="btn-student-transcript text-xs text-primary hover:underline" data-student="${sc.studentId}" data-name="${sc.khmerName || sc.englishName}">
              ${t('scores.viewHistory')}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.bindRowEvents();
  },

  bindRowEvents() {
    // Dynamic recalculations on input
    const onScoreInput = (e) => {
      const row = e.target.closest('tr');
      const studentId = row.getAttribute('data-student-id');
      const assignInput = row.querySelector('.input-assignment');
      const examInput = row.querySelector('.input-exam');

      let assignVal = Math.min(40, Math.max(0, Number(assignInput.value) || 0));
      let examVal = Math.min(60, Math.max(0, Number(examInput.value) || 0));

      const sc = this.state.scores.find(s => s.studentId === studentId);
      if (sc) {
        sc.assignmentScore = assignVal;
        sc.examScore = examVal;
        sc.total = assignVal + examVal;
        sc.percentage = Math.min(100, Math.round((sc.total / 100) * 100));
        const gradeInfo = ScoreService.calculateGrade(sc.percentage);
        sc.grade = gradeInfo.grade;
        sc.gradeColor = gradeInfo.color;

        // Recalculate ranks across all students
        ScoreService.rankStudents(this.state.scores);

        // Update DOM for this row
        row.querySelector('.col-total').textContent = sc.total;
        row.querySelector('.col-percentage').textContent = `${sc.percentage}%`;
        const gradeEl = row.querySelector('.col-grade');
        gradeEl.textContent = sc.grade;
        gradeEl.className = `col-grade inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${this.getGradeBadgeClasses(sc.grade)}`;

        // Update all ranks in table
        this.updateRanksInDOM();
        this.updateSummaryStats();
      }
    };

    this.container.querySelectorAll('.input-assignment, .input-exam').forEach(inp => {
      inp.addEventListener('input', onScoreInput);
    });

    // Student transcript history
    this.container.querySelectorAll('.btn-student-transcript').forEach(btn => {
      btn.addEventListener('click', async () => {
        const studentId = btn.getAttribute('data-student');
        const studentName = btn.getAttribute('data-name');
        const history = await ScoreService.getStudentScoreHistory(studentId);
        this.openTranscriptModal(studentName, history);
      });
    });
  },

  getGradeBadgeClasses(grade) {
    switch (grade) {
      case 'A': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'B': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'C': return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
      case 'D': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'E': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20';
      default:  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
    }
  },

  updateRanksInDOM() {
    this.container.querySelectorAll('tr[data-student-id]').forEach(row => {
      const studentId = row.getAttribute('data-student-id');
      const sc = this.state.scores.find(s => s.studentId === studentId);
      if (sc) {
        row.querySelector('.col-rank').textContent = `#${sc.rank}`;
      }
    });
  },

  updateSummaryStats() {
    const scores = this.state.scores;
    if (scores.length === 0) return;

    let sum = 0;
    let highest = 0;
    let passCount = 0;

    for (const sc of scores) {
      sum += (sc.total || 0);
      if (sc.total > highest) highest = sc.total;
      if (sc.total >= 50) passCount++;
    }

    const average = (sum / scores.length).toFixed(1);
    const passRate = Math.round((passCount / scores.length) * 100);

    const elAvg = document.getElementById('stat-class-average');
    const elHigh = document.getElementById('stat-highest-mark');
    const elPass = document.getElementById('stat-pass-rate');

    if (elAvg) elAvg.textContent = `${average} / 100`;
    if (elHigh) elHigh.textContent = `${highest} / 100`;
    if (elPass) elPass.textContent = `${passRate}% (${passCount} passed)`;
  },

  bindStaticEvents() {
    // Select Class
    document.getElementById('select-score-class')?.addEventListener('change', async (e) => {
      this.state.selectedClassId = e.target.value;
      await this.loadScores();
    });

    // Select Subject
    document.getElementById('select-score-subject')?.addEventListener('change', async (e) => {
      this.state.selectedSubjectId = e.target.value;
      await this.loadScores();
    });

    // Select Month
    document.getElementById('select-score-month')?.addEventListener('change', async (e) => {
      this.state.selectedMonth = e.target.value;
      await this.loadScores();
    });

    // Select Assessment Type
    document.getElementById('select-score-type')?.addEventListener('change', async (e) => {
      this.state.selectedAssessment = e.target.value;
      await this.loadScores();
    });

    // Save Scores button
    document.getElementById('btn-save-scores')?.addEventListener('click', async () => {
      if (this.state.scores.length === 0) return;
      try {
        await ScoreService.saveScoreSheet(this.state.scores);
        const cls = this.state.classes.find(c => c.id === this.state.selectedClassId);
        const sub = this.state.subjects.find(s => s.id === this.state.selectedSubjectId);
        toast.success(t('scores.savedSuccess', { 
          class: cls?.name || '', 
          subject: sub?.nameEn || '' 
        }));
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  /**
   * Student Academic Transcript Modal
   */
  openTranscriptModal(studentName, history) {
    const content = `
      <div class="space-y-4 text-xs">
        <div class="flex items-center justify-between pb-2 border-b border-border">
          <p class="text-xs text-muted-foreground">Student: <strong class="text-foreground text-sm font-khmer">${studentName}</strong></p>
          <span class="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-semibold">${history.length} score entries</span>
        </div>

        ${history.length === 0 ? `
          <p class="py-8 text-center text-muted-foreground italic">${t('scores.noScoresRecorded')}</p>
        ` : `
          <div class="max-h-80 overflow-y-auto divide-y divide-border border border-border rounded-lg">
            ${history.map(sc => `
              <div class="p-3 flex items-center justify-between hover:bg-muted/30">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-foreground">${sc.subjectNameEn}</span>
                    <span class="text-[10px] text-muted-foreground">(${sc.month}, ${sc.academicYear})</span>
                  </div>
                  <p class="text-[11px] text-muted-foreground mt-0.5">
                    Assignment: ${sc.assignmentScore} • Exam: ${sc.examScore}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-right">
                    <span class="font-bold text-sm text-foreground">${sc.total} / 100</span>
                    <span class="text-[10px] text-muted-foreground block">${sc.percentage}% • Rank #${sc.rank || 1}</span>
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
      <button onclick="window.print()" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-medium">
        ${getIcon('download', 'w-3.5 h-3.5 inline mr-1')} Print Transcript
      </button>
      <button class="btn-close-transcript px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
        Close
      </button>
    `;

    const modal = Modal.open({
      title: `${t('scores.scoreHistoryTitle')}: ${studentName}`,
      content,
      footer,
      maxWidth: 'max-w-lg'
    });

    modal.element.querySelector('.btn-close-transcript')?.addEventListener('click', () => modal.close());
  }
};
