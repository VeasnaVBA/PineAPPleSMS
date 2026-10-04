import { db } from '../database/db.js';
import { ClassService } from './classService.js';
import { authService } from './authService.js';

export const ScoreService = {
  getSubjects() {
    return [
      { id: 'sub-khmer', nameEn: 'Khmer Literature', nameKm: 'ភាសាខ្មែរ', maxScore: 100 },
      { id: 'sub-math', nameEn: 'Mathematics', nameKm: 'គណិតវិទ្យា', maxScore: 100 },
      { id: 'sub-science', nameEn: 'Science & Physics', nameKm: 'រូបវិទ្យា និងវិទ្យាសាស្ត្រ', maxScore: 100 },
      { id: 'sub-social', nameEn: 'Social Studies & History', nameKm: 'ប្រវត្តិវិទ្យា និងសង្គម', maxScore: 100 },
      { id: 'sub-english', nameEn: 'English Language', nameKm: 'ភាសាអង់គ្លេស', maxScore: 100 },
      { id: 'sub-pe', nameEn: 'Physical Education & Arts', nameKm: 'អប់រំកាយ និងសិល្បៈ', maxScore: 100 }
    ];
  },

  getMonths() {
    return [
      'October', 'November', 'December', 'January', 
      'February', 'March', 'April', 'May', 'June', 'July'
    ];
  },

  /**
   * Determine letter grade based on calculated percentage
   */
  calculateGrade(percentage) {
    if (percentage >= 90) return { grade: 'A', label: 'Excellent', color: 'emerald' };
    if (percentage >= 80) return { grade: 'B', label: 'Very Good', color: 'blue' };
    if (percentage >= 70) return { grade: 'C', label: 'Good', color: 'indigo' };
    if (percentage >= 60) return { grade: 'D', label: 'Satisfactory', color: 'amber' };
    if (percentage >= 50) return { grade: 'E', label: 'Passing', color: 'orange' };
    return { grade: 'F', label: 'Needs Improvement', color: 'rose' };
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
      const percentage = Math.min(100, Math.round((total / 100) * 100));
      const gradeInfo = this.calculateGrade(percentage);

      return {
        studentId: stu.id,
        studentNumber: stu.studentId,
        khmerName: stu.khmerName,
        englishName: stu.englishName,
        gender: stu.gender,
        classId,
        subjectId,
        academicYear,
        month,
        assessmentType,
        assignmentScore,
        examScore,
        total,
        percentage,
        grade: gradeInfo.grade,
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
