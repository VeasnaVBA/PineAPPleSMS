import { db } from '../database/db.js';
import { ClassService } from './classService.js';
import { SubjectService } from './subjectService.js';
import { authService } from './authService.js';
import { syncStateManager } from './syncStateManager.js';

export const EVALUATION_PERIODS = [
  // Months Jan to Dec
  { id: 'January', nameKm: 'មករា', nameEn: 'January', group: 'month' },
  { id: 'February', nameKm: 'កុម្ភៈ', nameEn: 'February', group: 'month' },
  { id: 'March', nameKm: 'មីនា', nameEn: 'March', group: 'month' },
  { id: 'April', nameKm: 'មេសា', nameEn: 'April', group: 'month' },
  { id: 'May', nameKm: 'ឧសភា', nameEn: 'May', group: 'month' },
  { id: 'June', nameKm: 'មិថុនា', nameEn: 'June', group: 'month' },
  { id: 'July', nameKm: 'កក្កដា', nameEn: 'July', group: 'month' },
  { id: 'August', nameKm: 'សីហា', nameEn: 'August', group: 'month' },
  { id: 'September', nameKm: 'កញ្ញា', nameEn: 'September', group: 'month' },
  { id: 'October', nameKm: 'តុលា', nameEn: 'October', group: 'month' },
  { id: 'November', nameKm: 'វិច្ឆិកា', nameEn: 'November', group: 'month' },
  { id: 'December', nameKm: 'ធ្នូ', nameEn: 'December', group: 'month' },
  // Assessments requested by user
  { id: 'First Test', nameKm: 'តេស្តដើមឆ្នាំ', nameEn: 'First Test', group: 'exam' },
  { id: 'Semester 1', nameKm: 'ឆមាសទី១', nameEn: 'Semester 1', group: 'exam' },
  { id: 'Semester 1 Exam', nameKm: 'ប្រឡងឆមាសទី១', nameEn: 'Semester 1 Exam', group: 'exam' },
  { id: 'Semester 2', nameKm: 'ឆមាសទី២', nameEn: 'Semester 2', group: 'exam' },
  { id: 'Semester 2 Exam', nameKm: 'ប្រឡងឆមាសទី២', nameEn: 'Semester 2 Exam', group: 'exam' },
  { id: 'Annual', nameKm: 'ប្រចាំឆ្នាំ', nameEn: 'Annual', group: 'exam' }
];

export const ScoreService = {
  getEvaluationPeriods() {
    return EVALUATION_PERIODS;
  },

  async getSubjects() {
    try {
      const list = await SubjectService.getAll();
      if (Array.isArray(list) && list.length > 0) {
        return list.map(s => ({
          id: s.id,
          code: s.code,
          nameEn: s.nameEn || s.name,
          nameKm: s.name,
          maxScore: s.maxScore || 100,
          scoreByGrade: s.scoreByGrade || {}
        }));
      }
    } catch (_) {}

    return [
      { id: 'sub-khmer', nameEn: 'Khmer Literature', nameKm: 'ភាសាខ្មែរ', maxScore: 100 },
      { id: 'sub-math', nameEn: 'Mathematics', nameKm: 'គណិតវិទ្យា', maxScore: 100 },
      { id: 'sub-science', nameEn: 'Science & Physics', nameKm: 'រូបវិទ្យា និងវិទ្យាសាស្ត្រ', maxScore: 50 },
      { id: 'sub-social', nameEn: 'Social Studies & History', nameKm: 'ប្រវត្តិវិទ្យា និងសង្គម', maxScore: 50 },
      { id: 'sub-english', nameEn: 'English Language', nameKm: 'ភាសាអង់គ្លេស', maxScore: 50 },
      { id: 'sub-pe', nameEn: 'Physical Education & Arts', nameKm: 'អប់រំកាយ និងសិល្បៈ', maxScore: 50 }
    ];
  },

  getMonths() {
    return [
      'October', 'November', 'December', 'January', 
      'February', 'March', 'April', 'May', 'June', 'July'
    ];
  },

  /**
   * Determine letter grade based on calculated percentage / full score
   */
  calculateGrade(scoreOrPercentage, fullScore = 100) {
    return SubjectService.calculateGrade(scoreOrPercentage, fullScore);
  },

  /**
   * Calculate rank for students based on total marks
   */
  rankStudents(studentRows) {
    const sorted = [...studentRows].sort((a, b) => (b.total || 0) - (a.total || 0));
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].total < sorted[i - 1].total) {
        currentRank = i + 1;
      }
      sorted[i].rank = currentRank;
    }
    return studentRows;
  },

  /**
   * Master Score Sheet across all subjects for a class and evaluation period
   */
  async getMasterScoreSheet({ classId, academicYear, period = 'October' }) {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        classId = teacherClassId;
      }
    }

    const students = await ClassService.getEnrolledStudents(classId);
    const activeStudents = students.filter(s => s.status === 'Active' || s.status === 'Inactive');

    let className = '7A';
    try {
      const cls = await ClassService.getById(classId);
      if (cls && cls.name) className = cls.name;
    } catch (_) {}

    const subjects = await SubjectService.getAll();
    const subjectsWithMeta = subjects.map(sub => {
      const fullScore = SubjectService.getSubjectFullScore(sub, className);
      return {
        ...sub,
        fullScore
      };
    });

    const allScores = await db.getAll('scores');
    const existingScores = allScores.filter(s => 
      s.classId === classId && 
      s.academicYear === academicYear && 
      (s.month === period || s.assessmentType === period)
    );

    const scoreMap = new Map();
    existingScores.forEach(s => {
      scoreMap.set(`${s.studentId}_${s.subjectId}`, s);
    });

    const rows = activeStudents.map(stu => {
      // User requirement: Student Name (khmer firstname + khmer last name)
      let fullNameKh = '';
      if (stu.firstNameKh || stu.lastNameKh) {
        fullNameKh = `${stu.firstNameKh || ''} ${stu.lastNameKh || ''}`.trim();
      } else {
        fullNameKh = stu.khmerName || stu.fullName || stu.name || '—';
      }

      const subjectScores = {};
      let total = 0;
      let totalMax = 0;

      // 1. First pass: load existing raw scores
      subjectsWithMeta.forEach(sub => {
        const scRecord = scoreMap.get(`${stu.id}_${sub.id}`);
        const val = scRecord !== undefined && scRecord !== null 
          ? (Number(scRecord.totalScore ?? scRecord.examScore) || 0) 
          : null;
        subjectScores[sub.id] = val;
      });

      // 2. Second pass: compute composite / sum subjects live
      subjectsWithMeta.forEach(sub => {
        if (SubjectService.isCalculatedSubject(sub)) {
          const compVal = SubjectService.calculateCompositeScore(sub, subjectsWithMeta, subjectScores);
          subjectScores[sub.id] = compVal;
        }
      });

      // 3. Identify sub-components to prevent double-counting in grand total
      const subComponentIds = new Set();
      subjectsWithMeta.forEach(sub => {
        if (SubjectService.isCalculatedSubject(sub)) {
          const subCodes = SubjectService.getSumSubCourseCodes(sub);
          subjectsWithMeta.forEach(other => {
            if (other.id !== sub.id && (
              subCodes.includes(String(other.code || '').toUpperCase()) ||
              subCodes.includes(String(other.id || '').toUpperCase())
            )) {
              subComponentIds.add(other.id);
            }
          });
        }
      });

      // 4. Calculate total & totalMax
      subjectsWithMeta.forEach(sub => {
        if (subComponentIds.has(sub.id)) return; // Exclude sub-components from grand total

        const val = subjectScores[sub.id];
        if (val !== null && val !== undefined) {
          total += Number(val);
        }
        totalMax += sub.fullScore;
      });

      const average = totalMax > 0 ? ((total / totalMax) * 100) : 0;
      const gradeInfo = SubjectService.calculateGrade(total, totalMax);

      return {
        studentId: stu.id,
        studentNumber: stu.studentId,
        firstNameKh: stu.firstNameKh || '',
        lastNameKh: stu.lastNameKh || '',
        khmerFullName: fullNameKh,
        englishName: stu.englishName || '',
        gender: stu.gender || 'Male',
        classId,
        className,
        academicYear,
        period,
        subjectScores,
        total,
        totalMax,
        average: Math.round(average * 10) / 10,
        grade: gradeInfo.grade,
        gradeColor: gradeInfo.color,
        rank: 1
      };
    });

    this.rankStudents(rows);
    return {
      rows,
      subjects: subjectsWithMeta,
      className
    };
  },

  /**
   * Save Master Score Sheet across all subjects
   */
  async saveMasterScoreSheet({ classId, academicYear, period, rows, subjects }) {
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();
    if (isTeacher && teacherClassId && classId !== teacherClassId) {
      throw new Error('Access denied: Cannot record scores for another classroom.');
    }

    let className = '7A';
    try {
      const cls = await ClassService.getById(classId);
      if (cls && cls.name) className = cls.name;
    } catch (_) {}

    for (const row of rows) {
      for (const sub of subjects) {
        const val = row.subjectScores[sub.id];
        if (val !== null && val !== undefined && val !== '') {
          const numVal = Math.max(0, Number(val) || 0);
          const fullScore = SubjectService.getSubjectFullScore(sub, className);
          const gradeInfo = SubjectService.calculateGrade(numVal, fullScore);
          const id = `sc-${academicYear}-${classId}-${sub.id}-${period}-${row.studentId}`;
          const record = {
            id,
            studentId: row.studentId,
            classId: isTeacher && teacherClassId ? teacherClassId : classId,
            academicYear,
            subjectId: sub.id,
            subjectNameKm: sub.name,
            subjectNameEn: sub.nameEn || sub.name,
            month: period,
            assessmentType: period,
            assignmentScore: 0,
            examScore: numVal,
            totalScore: numVal,
            fullScore,
            percentage: fullScore > 0 ? Math.min(100, Math.round((numVal / fullScore) * 100)) : 0,
            grade: gradeInfo.grade,
            notes: '',
            updatedAt: new Date().toISOString()
          };
          await db.put('scores', record);
        }
      }
    }
    syncStateManager.markDirty('scores.saveMasterScoreSheet');
    return true;
  },

  /**
   * Get score sheet for a class, subject, month, and assessment type.
   * Merges enrolled students with existing score entries.
   */
  async getScoreSheet({ classId, subjectId, academicYear, month, assessmentType = 'Monthly Exam' }) {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        classId = teacherClassId;
      }
    }

    const students = await ClassService.getEnrolledStudents(classId);
    const activeStudents = students.filter(s => s.status === 'Active' || s.status === 'Inactive');

    // Fetch class info to detect grade level (e.g. '7A' -> 'G7')
    let className = '7A';
    try {
      const cls = await ClassService.getById(classId);
      if (cls && cls.name) className = cls.name;
    } catch (_) {}

    // Fetch subject info to determine full score for this grade level
    let fullScore = 100;
    try {
      const subject = await SubjectService.getById(subjectId);
      if (subject) {
        fullScore = SubjectService.getSubjectFullScore(subject, className);
      }
    } catch (_) {}

    const allScores = await db.getAll('scores');
    const existingScores = allScores.filter(s => 
      s.classId === classId && 
      s.subjectId === subjectId && 
      s.academicYear === academicYear && 
      s.month === month && 
      s.assessmentType === assessmentType
    );

    const scoreMap = new Map(existingScores.map(s => [s.studentId, s]));

    const rows = activeStudents.map(stu => {
      const existing = scoreMap.get(stu.id);
      const assignmentScore = existing ? Number(existing.assignmentScore) || 0 : 0;
      const examScore = existing ? Number(existing.examScore) || 0 : 0;
      const total = assignmentScore + examScore;
      const percentage = fullScore > 0 ? Math.min(100, Math.round((total / fullScore) * 100)) : 0;
      const gradeInfo = SubjectService.calculateGrade(total, fullScore);

      return {
        studentId: stu.id,
        studentNumber: stu.studentId,
        khmerName: stu.khmerName,
        englishName: stu.englishName,
        gender: stu.gender,
        classId,
        className,
        subjectId,
        fullScore,
        academicYear,
        month,
        assessmentType,
        assignmentScore,
        examScore,
        total,
        percentage,
        grade: gradeInfo.grade,
        gradeLabelKm: gradeInfo.labelKm,
        gradeLabelEn: gradeInfo.labelEn,
        gradeColor: gradeInfo.color,
        rank: 1,
        notes: existing ? existing.notes || '' : ''
      };
    });

    return this.rankStudents(rows);
  },

  /**
   * Save a score sheet for a class
   */
  async saveScoreSheet(scores) {
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    for (const sc of scores) {
      if (isTeacher && teacherClassId && sc.classId !== teacherClassId) {
        throw new Error('Access denied: Cannot record scores for another classroom.');
      }
      const id = `sc-${sc.academicYear}-${sc.classId}-${sc.subjectId}-${sc.month}-${sc.studentId}`;
      const record = {
        id,
        studentId: sc.studentId,
        classId: isTeacher && teacherClassId ? teacherClassId : sc.classId,
        academicYear: sc.academicYear,
        subjectId: sc.subjectId,
        month: sc.month,
        assessmentType: sc.assessmentType,
        assignmentScore: Number(sc.assignmentScore) || 0,
        examScore: Number(sc.examScore) || 0,
        totalScore: Number(sc.total) || 0,
        fullScore: Number(sc.fullScore) || 100,
        percentage: Number(sc.percentage) || 0,
        grade: sc.grade || 'F',
        notes: sc.notes || '',
        updatedAt: new Date().toISOString()
      };
      await db.put('scores', record);
    }
    syncStateManager.markDirty('scores.saveScoreSheet');
    return true;
  },

  /**
   * Fetch a student's full academic transcript across all subjects
   */
  async getStudentTranscript(studentId, academicYear) {
    const all = await db.getAll('scores');
    return all.filter(s => s.studentId === studentId && s.academicYear === academicYear);
  }
};
