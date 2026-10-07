/**
 * Scores & Grading Management Module
 * Comprehensive Master Gradebook with:
 * - Period Selection: Month (Jan to Dec), First Test, Semester 1, Semester 1 Exam, Semester 2, Semester 2 Exam, Annual
 * - Table Columns: No, Student ID, Student Name (khmer firstname + khmer last name), Gender, and All Subjects from Subject module
 * - Instant Dynamic Calculations: Total, Average (%), Letter Grade (A-F), and Class Dynamic Rank
 * - Instant Search Filter, Print preview, and persistence in IndexedDB
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

export const ScoresPage = {
  state: {
    classes: [],
    subjects: [],
    periods: EVALUATION_PERIODS,
    selectedClassId: '',
    selectedPeriod: 'October',
    activeYear: '2024–2025',
    rows: [],
    searchQuery: ''
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
    } else if (this.state.classes.length > 0 && !this.state.selectedClassId) {
      this.state.selectedClassId = this.state.classes[0].id;
    }

    this.renderLayout();
    await this.loadScores();
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';
    const classes = this.state.classes;
    const months = this.state.periods.filter(p => p.group === 'month');
    const exams = this.state.periods.filter(p => p.group === 'exam');

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-16 select-none print:p-0">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
              ${isKm ? 'តារាងពិន្ទុ និងចំណាត់ថ្នាក់សិស្ស' : 'Student Score Table & Ranking'}
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1 ${isKm ? 'font-khmer' : ''}">
              ${isKm 
                ? 'បញ្ចូល និងតាមដានពិន្ទុគ្រប់មុខវិជ្ជា គណនាមធ្យមភាគ និងចំណាត់ថ្នាក់ស្វ័យប្រវត្តិតាមខែ ឬឆមាស' 
                : 'Comprehensive master gradebook across all subjects with real-time GPA and rank calculation.'}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-print-scores" type="button" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer">
              ${getIcon('download', 'w-4 h-4')}
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'បោះពុម្ពតារាង' : 'Print Table'}</span>
            </button>
            <button id="btn-save-scores" type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer">
              ${getIcon('check', 'w-4 h-4')}
              <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'រក្សាទុកពិន្ទុ' : 'Save Scores'}</span>
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
            <!-- Class Selection -->
            <div>
              <label class="block text-[11px] text-muted-foreground font-medium mb-1 ${isKm ? 'font-khmer' : ''}">
                ${isKm ? 'ថ្នាក់រៀន' : 'Classroom'}
              </label>
              ${authService.isTeacher() && classes.length <= 1 ? (() => {
                const assignedCls = classes.find(c => c.id === this.state.selectedClassId) || 
                                    classes.find(c => c.id === authService.getAssignedClassId()) || 
                                    classes[0];
                return assignedCls ? `
                  <div class="h-9 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary flex items-center gap-1.5 box-border">
                    ${getIcon('classes', 'w-3.5 h-3.5')}
                    <span>${assignedCls.name}</span>
                  </div>
                ` : `
                  <a href="#classes" class="h-9 px-3 py-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5 box-border hover:bg-amber-500/20 transition-colors">
                    ${getIcon('plus', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'មិនទាន់មានថ្នាក់ (ចុចបង្កើតថ្នាក់)' : 'No Classroom (Click to create)'}</span>
                  </a>
                `;
              })() : `
                <select id="select-score-class" class="w-full h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-ring box-border shadow-xs cursor-pointer">
                  ${classes.length === 0 ? `<option value="">${isKm ? 'មិនទាន់មានថ្នាក់រៀន' : 'No classes available'}</option>` : ''}
                  ${classes.map(c => `
                    <option value="${c.id}" ${this.state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Month / Period Selection (Jan to Dec, Semester 1/2, First Test, Annual) -->
            <div>
              <label class="block text-[11px] text-muted-foreground font-medium mb-1 ${isKm ? 'font-khmer' : ''}">
                ${isKm ? 'ខែ / សម័យប្រឡង' : 'Month / Evaluation Period'}
              </label>
              <select id="select-score-period" class="w-full h-9 px-3 py-1.5 pr-8 rounded-md border border-input bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-ring box-border shadow-xs cursor-pointer">
                <optgroup label="${isKm ? 'ខែ (Months: Jan - Dec)' : 'Months (Jan - Dec)'}">
                  ${months.map(m => `
                    <option value="${m.id}" ${this.state.selectedPeriod === m.id ? 'selected' : ''}>
                      ${isKm ? `${m.nameKm} (${m.nameEn})` : m.nameEn}
                    </option>
                  `).join('')}
                </optgroup>
                <optgroup label="${isKm ? 'តេស្ត និងការប្រឡងឆមាស (Exams & Terms)' : 'Assessments & Semesters'}">
                  ${exams.map(e => `
                    <option value="${e.id}" ${this.state.selectedPeriod === e.id ? 'selected' : ''}>
                      ${isKm ? e.nameKm : e.nameEn}
                    </option>
                  `).join('')}
                </optgroup>
              </select>
            </div>

            <!-- Student Search Filter -->
            <div>
              <label class="block text-[11px] text-muted-foreground font-medium mb-1 ${isKm ? 'font-khmer' : ''}">
                ${isKm ? 'ស្វែងរកសិស្ស (ឈ្មោះ / អត្តលេខ)' : 'Search Student'}
              </label>
              <div class="relative">
                <input type="text" 
                       id="input-search-student" 
                       placeholder="${isKm ? 'ស្វែងរកតាមឈ្មោះ ឬអត្តលេខ...' : 'Filter by name or ID...'}" 
                       value="${this.state.searchQuery}"
                       class="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary shadow-xs" />
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ${getIcon('search', 'w-3.5 h-3.5')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Live Score Summary Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden" id="score-summary-banner">
          <div class="p-3.5 rounded-xl bg-card border border-border shadow-2xs">
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block ${isKm ? 'font-khmer' : ''}">${isKm ? 'ចំនួនសិស្សសរុប' : 'Enrolled Students'}</span>
            <p class="text-xl font-bold text-foreground mt-1" id="stat-total-students">0</p>
          </div>
          <div class="p-3.5 rounded-xl bg-card border border-border shadow-2xs">
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block ${isKm ? 'font-khmer' : ''}">${isKm ? 'មធ្យមភាគថ្នាក់' : 'Class Average'}</span>
            <p class="text-xl font-bold text-foreground mt-1" id="stat-class-average">0%</p>
          </div>
          <div class="p-3.5 rounded-xl bg-card border border-border shadow-2xs">
            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider block ${isKm ? 'font-khmer' : ''}">${isKm ? 'ពិន្ទុខ្ពស់បំផុត' : 'Highest Score'}</span>
            <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1" id="stat-highest-mark">0</p>
          </div>
          <div class="p-3.5 rounded-xl bg-card border border-border shadow-2xs">
            <span class="text-[10px] text-primary uppercase font-bold tracking-wider block ${isKm ? 'font-khmer' : ''}">${isKm ? 'អត្រាជាប់' : 'Pass Rate'}</span>
            <p class="text-xl font-bold text-primary mt-1" id="stat-pass-rate">0%</p>
          </div>
        </div>

        <!-- Score Table Card -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden print:border-none print:shadow-none">
          <div class="overflow-x-auto relative max-h-[70vh]">
            <table class="w-full text-left border-collapse text-xs select-text">
              <thead class="sticky top-0 z-20 bg-muted/90 backdrop-blur border-b border-border text-muted-foreground font-semibold">
                <tr id="scores-table-header-row">
                  <!-- Dynamically populated with No, ID, Name, Gender, Subjects, Total, Average, Grade, Rank -->
                </tr>
              </thead>
              <tbody id="scores-table-body" class="divide-y divide-border/60">
                <tr>
                  <td colspan="20" class="py-12 text-center text-muted-foreground">
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
    if (!this.state.selectedClassId) return;

    const data = await ScoreService.getMasterScoreSheet({
      classId: this.state.selectedClassId,
      academicYear: this.state.activeYear,
      period: this.state.selectedPeriod
    });

    this.state.rows = data.rows || [];
    this.state.subjects = data.subjects || [];

    this.renderHeader();
    this.renderRows();
    this.updateSummaryStats();
  },

  renderHeader() {
    const isKm = i18n.getLocale() === 'km';
    const headerRow = document.getElementById('scores-table-header-row');
    if (!headerRow) return;

    const subjects = this.state.subjects;

    headerRow.innerHTML = `
      <th class="w-12 px-3 py-3 text-center sticky left-0 bg-muted z-30 border-r border-border/60 shadow-2xs">#</th>
      <th class="px-3 py-3 font-mono sticky left-12 bg-muted z-30 border-r border-border/60 min-w-[90px] shadow-2xs">${isKm ? 'អត្តលេខ' : 'Student ID'}</th>
      <th class="px-4 py-3 sticky left-[138px] bg-muted z-30 border-r border-border/60 min-w-[170px] shadow-sm">
        <span class="${isKm ? 'font-khmer' : ''}">${isKm ? 'គោត្តនាម-នាម' : 'Student Name'}</span>
      </th>
      <th class="px-3 py-3 text-center min-w-[65px] border-r border-border/60">${isKm ? 'ភេទ' : 'Gender'}</th>
      
      ${subjects.map(s => `
        <th class="px-2 py-2 text-center min-w-[85px] border-r border-border/40 hover:bg-muted/70 transition-colors">
          <div class="font-bold text-foreground text-xs font-khmer truncate max-w-[110px] mx-auto" title="${s.name} (${s.nameEn || ''})">
            ${s.name}
          </div>
          <div class="text-[10px] text-muted-foreground font-mono mt-0.5">
            Max: ${s.fullScore}
          </div>
        </th>
      `).join('')}

      <th class="px-3 py-3 text-center font-bold text-foreground min-w-[70px] bg-muted/80 border-r border-border/60">${isKm ? 'សរុប' : 'Total'}</th>
      <th class="px-3 py-3 text-center font-bold text-primary min-w-[70px] bg-muted/80 border-r border-border/60">${isKm ? 'មធ្យម' : 'Avg %'}</th>
      <th class="px-3 py-3 text-center font-bold min-w-[65px] bg-muted/80 border-r border-border/60">${isKm ? 'និទ្ទេស' : 'Grade'}</th>
      <th class="px-3 py-3 text-center font-bold text-amber-600 dark:text-amber-400 min-w-[60px] bg-muted/80 border-r border-border/60">${isKm ? 'ចំណាត់' : 'Rank'}</th>
      <th class="px-3 py-3 text-center min-w-[55px] bg-muted/80 print:hidden">${isKm ? 'ផ្សេងៗ' : 'Actions'}</th>
    `;
  },

  renderRows() {
    const isKm = i18n.getLocale() === 'km';
    const tbody = document.getElementById('scores-table-body');
    if (!tbody) return;

    let rows = this.state.rows;
    const query = (this.state.searchQuery || '').trim().toLowerCase();
    if (query) {
      rows = rows.filter(r => 
        (r.studentNumber && r.studentNumber.toLowerCase().includes(query)) ||
        (r.khmerFullName && r.khmerFullName.toLowerCase().includes(query)) ||
        (r.englishName && r.englishName.toLowerCase().includes(query))
      );
    }

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${5 + this.state.subjects.length + 5}" class="py-12 text-center text-muted-foreground">
            <p class="text-xs ${isKm ? 'font-khmer' : ''}">${isKm ? 'មិនមានសិស្សក្នុងថ្នាក់នេះទេ' : 'No students found in this class'}</p>
          </td>
        </tr>
      `;
      return;
    }

    const subjects = this.state.subjects;

    tbody.innerHTML = rows.map((r, idx) => {
      const isFemale = r.gender === 'Female' || r.gender === 'ស្រី';
      const genderLabel = isKm ? (isFemale ? 'ស្រី' : 'ប្រុស') : (isFemale ? 'F' : 'M');
      const genderBadge = isFemale 
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' 
        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';

      return `
        <tr class="hover:bg-muted/20 transition-colors" data-student-id="${r.studentId}">
          <!-- No -->
          <td class="w-12 px-3 py-2 text-center font-mono text-muted-foreground sticky left-0 bg-card z-10 border-r border-border/60 shadow-2xs">
            ${idx + 1}
          </td>

          <!-- Student ID -->
          <td class="px-3 py-2 font-mono font-medium text-foreground sticky left-12 bg-card z-10 border-r border-border/60 shadow-2xs">
            ${r.studentNumber || '—'}
          </td>

          <!-- Student Name (khmer firstname + khmer last name) -->
          <td class="px-4 py-2 sticky left-[138px] bg-card z-10 border-r border-border/60 shadow-sm min-w-[170px]">
            <p class="font-bold text-foreground font-khmer text-xs leading-tight truncate">
              ${r.khmerFullName || '—'}
            </p>
            ${r.englishName ? `
              <p class="text-[10px] text-muted-foreground truncate leading-tight font-sans">
                ${r.englishName}
              </p>
            ` : ''}
          </td>

          <!-- Gender -->
          <td class="px-3 py-2 text-center border-r border-border/60">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${genderBadge}">
              ${genderLabel}
            </span>
          </td>

          <!-- All Subjects Inputs -->
          ${subjects.map(s => {
            const currentScore = r.subjectScores[s.id];
            const displayVal = (currentScore !== null && currentScore !== undefined) ? currentScore : '';
            return `
              <td class="px-1.5 py-1.5 text-center border-r border-border/30">
                <input type="number" 
                       min="0" 
                       max="${s.fullScore}" 
                       step="any"
                       class="input-subject-score w-16 h-8 px-1 py-1 rounded border border-input bg-background text-foreground font-mono font-semibold text-center text-xs focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-2xs" 
                       data-student="${r.studentId}" 
                       data-subject="${s.id}" 
                       data-max="${s.fullScore}" 
                       value="${displayVal}" 
                       placeholder="—" />
              </td>
            `;
          }).join('')}

          <!-- Total Score -->
          <td class="px-3 py-2 text-center font-bold font-mono text-foreground col-total bg-muted/10 border-r border-border/60">
            ${r.total}
          </td>

          <!-- Percentage / Average -->
          <td class="px-3 py-2 text-center font-bold font-mono text-primary col-average bg-muted/10 border-r border-border/60">
            ${r.average}%
          </td>

          <!-- Grade Badge -->
          <td class="px-3 py-2 text-center bg-muted/10 border-r border-border/60">
            <span class="col-grade inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${this.getGradeBadgeClasses(r.grade)}">
              ${r.grade}
            </span>
          </td>

          <!-- Rank -->
          <td class="px-3 py-2 text-center font-extrabold font-mono text-amber-600 dark:text-amber-400 col-rank bg-muted/10 border-r border-border/60">
            #${r.rank}
          </td>

          <!-- Actions -->
          <td class="px-2 py-2 text-center bg-muted/10 print:hidden">
            <button type="button" 
                    class="btn-student-transcript p-1.5 rounded hover:bg-primary/10 text-primary transition-colors cursor-pointer" 
                    title="${isKm ? 'មើលព្រឹត្តិបត្រពិន្ទុ' : 'View Transcript'}"
                    data-student="${r.studentId}" 
                    data-name="${r.khmerFullName}">
              ${getIcon('fileText', 'w-4 h-4')}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.bindRowEvents();
  },

  bindRowEvents() {
    const inputs = this.container.querySelectorAll('.input-subject-score');

    inputs.forEach(inp => {
      inp.addEventListener('input', () => {
        const studentId = inp.getAttribute('data-student');
        const subjectId = inp.getAttribute('data-subject');
        const maxScore = Number(inp.getAttribute('data-max')) || 100;

        let enteredVal = inp.value.trim();
        let numVal = enteredVal === '' ? null : Math.max(0, Number(enteredVal));

        // Validate max score warning
        if (numVal !== null && numVal > maxScore) {
          inp.classList.add('border-destructive', 'text-destructive', 'bg-destructive/10');
        } else {
          inp.classList.remove('border-destructive', 'text-destructive', 'bg-destructive/10');
        }

        const rowData = this.state.rows.find(r => r.studentId === studentId);
        if (rowData) {
          rowData.subjectScores[subjectId] = numVal;

          // Recalculate row total and average
          let sum = 0;
          let maxTotal = 0;
          this.state.subjects.forEach(s => {
            const v = rowData.subjectScores[s.id];
            if (v !== null && v !== undefined) {
              sum += Number(v);
            }
            maxTotal += s.fullScore;
          });

          rowData.total = Math.round(sum * 10) / 10;
          rowData.totalMax = maxTotal;
          const avgPct = maxTotal > 0 ? (sum / maxTotal) * 100 : 0;
          rowData.average = Math.round(avgPct * 10) / 10;
          const gradeInfo = SubjectService.calculateGrade(sum, maxTotal);
          rowData.grade = gradeInfo.grade;
          rowData.gradeColor = gradeInfo.color;

          // Recalculate ranks across all rows
          ScoreService.rankStudents(this.state.rows);

          // Update this row's display
          const trEl = inp.closest('tr');
          if (trEl) {
            trEl.querySelector('.col-total').textContent = rowData.total;
            trEl.querySelector('.col-average').textContent = `${rowData.average}%`;
            const gradeEl = trEl.querySelector('.col-grade');
            gradeEl.textContent = rowData.grade;
            gradeEl.className = `col-grade inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${this.getGradeBadgeClasses(rowData.grade)}`;
          }

          // Update ranks across entire table
          this.updateRanksInDOM();
          this.updateSummaryStats();
        }
      });

      // Keyboard navigation (Enter / Arrow keys)
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          const tr = inp.closest('tr');
          const nextTr = tr?.nextElementSibling;
          if (nextTr) {
            const sameSubInp = nextTr.querySelector(`input[data-subject="${inp.getAttribute('data-subject')}"]`);
            sameSubInp?.focus();
            sameSubInp?.select();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const tr = inp.closest('tr');
          const prevTr = tr?.previousElementSibling;
          if (prevTr) {
            const sameSubInp = prevTr.querySelector(`input[data-subject="${inp.getAttribute('data-subject')}"]`);
            sameSubInp?.focus();
            sameSubInp?.select();
          }
        }
      });
    });

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

  updateRanksInDOM() {
    this.container.querySelectorAll('tr[data-student-id]').forEach(tr => {
      const studentId = tr.getAttribute('data-student-id');
      const rowData = this.state.rows.find(r => r.studentId === studentId);
      if (rowData) {
        const rankEl = tr.querySelector('.col-rank');
        if (rankEl) rankEl.textContent = `#${rowData.rank}`;
      }
    });
  },

  updateSummaryStats() {
    const rows = this.state.rows;
    const totalEl = document.getElementById('stat-total-students');
    const avgEl = document.getElementById('stat-class-average');
    const highEl = document.getElementById('stat-highest-mark');
    const passEl = document.getElementById('stat-pass-rate');

    if (totalEl) totalEl.textContent = rows.length;
    if (rows.length === 0) {
      if (avgEl) avgEl.textContent = '0%';
      if (highEl) highEl.textContent = '0';
      if (passEl) passEl.textContent = '0%';
      return;
    }

    let sumPct = 0;
    let highest = 0;
    let passedCount = 0;

    for (const r of rows) {
      sumPct += (r.average || 0);
      if (r.total > highest) highest = r.total;
      if (r.average >= 50) passedCount++;
    }

    const classAveragePct = (sumPct / rows.length).toFixed(1);
    const passRate = Math.round((passedCount / rows.length) * 100);

    if (avgEl) avgEl.textContent = `${classAveragePct}%`;
    if (highEl) highEl.textContent = `${highest}`;
    if (passEl) passEl.textContent = `${passRate}% (${passedCount} នាក់)`;
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
      await this.loadScores();
    });

    // Search filter
    document.getElementById('input-search-student')?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value;
      this.renderRows();
    });

    // Save Scores
    document.getElementById('btn-save-scores')?.addEventListener('click', async () => {
      if (this.state.rows.length === 0) return;
      const saveBtn = document.getElementById('btn-save-scores');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div> <span>...</span>`;
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
            : `Scores for ${cls?.name || ''} (${this.state.selectedPeriod}) saved successfully!`,
          isKm ? 'ជោគជ័យ' : 'Success'
        );
      } catch (err) {
        toast.error(err.message || 'Failed to save scores');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `${getIcon('check', 'w-4 h-4')} <span>${i18n.getLocale() === 'km' ? 'រក្សាទុកពិន្ទុ' : 'Save Scores'}</span>`;
        }
      }
    });

    // Print button
    document.getElementById('btn-print-scores')?.addEventListener('click', () => {
      window.print();
    });
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
  }
};
