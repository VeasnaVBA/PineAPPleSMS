import { db } from '../database/db.js';
import { ClassService } from './classService.js';
import { SubjectService } from './subjectService.js';
import { authService } from './authService.js';

export const ScoreService = {
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
