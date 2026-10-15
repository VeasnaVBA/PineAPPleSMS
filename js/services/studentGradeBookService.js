/**
 * Student Grade Book Service (សៀវភៅសិក្ខាគារិក)
 * Fetches and computes student academic results for Semester 1, Semester 2, and Annual evaluation,
 * including subject scores, subject class ranks, semester exam averages, internal monthly averages,
 * overall semester averages, and annual attendance (excused / unexcused absences).
 */

import { db } from '../database/db.js';
import { SubjectService } from './subjectService.js';
import { normalizeStudentRecord } from './studentService.js';
import { isStudentActive } from './scoreService.js';

export function toKhmerNumerals(num) {
  if (num === undefined || num === null || num === '') return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, d => khmerDigits[d]);
}

export function formatTwoDigits(num) {
  const n = parseInt(num, 10);
  if (isNaN(n) || n <= 0) return '00';
  return n < 10 ? `0${n}` : String(n);
}

export function formatScoreNumber(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (isNaN(num)) return '';
  if (Math.floor(num) === num) return String(num);
  return num.toFixed(2);
}

export const StudentGradeBookService = {
  /**
   * Get active students for a class
   */
  async getClassStudents(classId) {
    if (!classId) return [];
    const rawStudents = await db.getAll('students');
    return (rawStudents || [])
      .map(normalizeStudentRecord)
      .filter(s => s.classId === classId && isStudentActive(s))
      .sort((a, b) => (a.khmerName || '').localeCompare(b.khmerName || '', 'km'));
  },

  /**
   * Resolve subjects for the grade book
   */
  async getGradeBookSubjects(targetClass) {
    try {
      const dbSubjects = await SubjectService.getAll();
      if (Array.isArray(dbSubjects) && dbSubjects.length > 0) {
        const activeSubjects = dbSubjects.filter(s => s.status !== 'Inactive');
        if (activeSubjects.length > 0) {
          return activeSubjects;
        }
      }
    } catch (err) {
      console.warn('Failed to load subjects for grade book:', err);
    }

    // Default fallback subjects
    return [
      { id: 'sub_essay', name: 'តែងសេចក្តី', code: 'SUB-102' },
      { id: 'sub_dictation', name: 'សរសេរតាមអាន', code: 'SUB-101' },
      { id: 'sub_morals', name: 'សីលធម៌-ពលរដ្ឋវិជ្ជា', code: 'SUB-110' },
      { id: 'sub_history', name: 'ប្រវត្តិវិជ្ជា', code: 'SUB-108' },
      { id: 'sub_geography', name: 'ភូមិវិជ្ជា', code: 'SUB-112' },
      { id: 'sub_math', name: 'គណិតវិទ្យា', code: 'SUB-104' },
      { id: 'sub_physics', name: 'រូបវិទ្យា', code: 'SUB-105' },
      { id: 'sub_chemistry', name: 'គីមីវិទ្យា', code: 'SUB-106' },
      { id: 'sub_biology', name: 'ជីវវិទ្យា', code: 'SUB-107' },
      { id: 'sub_earth_science', name: 'ផែនដីវិទ្យា', code: 'SUB-111' },
      { id: 'sub_english', name: 'ភាសាអង់គ្លេស', code: 'SUB-109' },
      { id: 'sub_home_economics', name: 'គេហវិជ្ជា', code: 'SUB-113' },
      { id: 'sub_technology', name: 'បច្ចេកវិជ្ជា', code: 'SUB-114' },
      { id: 'sub_pe', name: 'អប់រំកាយ', code: 'SUB-115' },
      { id: 'sub_agriculture', name: 'កសិកម្ម', code: 'SUB-116' },
      { id: 'sub_life_skills', name: 'បំណិនជីវិត', code: 'SUB-117' }
    ];
  },

  /**
   * Fetch complete grade book data structure for a student in a class
   */
  async getStudentGradeBook({ classId, studentId, academicYear }) {
    const [classes, rawStudents, allScores, allAttendance] = await Promise.all([
      db.getAll('classes'),
      db.getAll('students'),
      db.getAll('scores').catch(() => []),
      db.getAll('attendance').catch(() => [])
    ]);

    const targetClass = (classes || []).find(c => c.id === classId) || { id: classId, name: '—' };
    const classStudents = (rawStudents || [])
      .map(normalizeStudentRecord)
      .filter(s => s.classId === classId && isStudentActive(s))
      .sort((a, b) => (a.khmerName || '').localeCompare(b.khmerName || '', 'km'));

    const currentStudent = classStudents.find(s => s.studentId === studentId || s.id === studentId) || classStudents[0] || null;
    const subjects = await this.getGradeBookSubjects(targetClass);

    // Filter relevant scores for this class & year
    const classScores = (allScores || []).filter(sc => {
      const matchClass = sc.classId === classId;
      const matchYear = !academicYear || !sc.academicYear || sc.academicYear === academicYear;
      return matchClass && matchYear;
    });

    // Score maps:
    // sem1ExamScores: Map(studentId_subjectId -> score)
    // sem2ExamScores: Map(studentId_subjectId -> score)
    // sem1MonthScores: Map(studentId -> array of monthly avgs)
    // sem2MonthScores: Map(studentId -> array of monthly avgs)
    const sem1ExamMap = new Map();
    const sem2ExamMap = new Map();
    const monthlyScoreMap = new Map(); // studentId_month_subjectId -> score

    const SEM1_EXAM_KEYS = ['Semester 1 Exam', 'Semester 1', 'ប្រឡងឆមាសទី១', 'ឆមាសទី១', 'ឆមាស១'];
    const SEM2_EXAM_KEYS = ['Semester 2 Exam', 'Semester 2', 'ប្រឡងឆមាសទី២', 'ឆមាសទី២', 'ឆមាស២'];

    const SEM1_MONTHS = ['October', 'November', 'December', 'January', 'February'];
    const SEM2_MONTHS = ['March', 'April', 'May', 'June', 'July'];

    classScores.forEach(sc => {
      const sId = sc.studentId;
      const subId = sc.subjectId;
      const period = String(sc.month || sc.assessmentType || '').trim();
      const val = Number(sc.totalScore ?? sc.examScore);
      if (isNaN(val)) return;

      if (SEM1_EXAM_KEYS.includes(period)) {
        sem1ExamMap.set(`${sId}_${subId}`, val);
      } else if (SEM2_EXAM_KEYS.includes(period)) {
        sem2ExamMap.set(`${sId}_${subId}`, val);
      } else {
        monthlyScoreMap.set(`${sId}_${period}_${subId}`, val);
      }
    });

    // Helper to calculate student's average monthly score across subjects
    const getStudentMonthlyAverage = (stuId, months) => {
      let sum = 0;
      let count = 0;
      months.forEach(m => {
        let mSubTotal = 0;
        let mSubCount = 0;
        subjects.forEach(sub => {
          const val = monthlyScoreMap.get(`${stuId}_${m}_${sub.id}`);
          if (val !== undefined && val !== null) {
            mSubTotal += val;
            mSubCount++;
          }
        });
        if (mSubCount > 0) {
          sum += (mSubTotal / mSubCount);
          count++;
        }
      });
      return count > 0 ? (sum / count) : null;
    };

    // Calculate subject-level scores and class rankings for all students
    // subjectRankings: subId -> { sem1Ranks: Map(stuId -> rank), sem2Ranks: Map(stuId -> rank), annualRanks: Map(stuId -> rank) }
    const subjectDataByStudent = new Map(); // stuId -> Map(subId -> { sem1, sem2, annual })
    classStudents.forEach(stu => {
      const subMap = new Map();
      subjects.forEach(sub => {
        const s1 = sem1ExamMap.get(`${stu.id}_${sub.id}`) ?? null;
        const s2 = sem2ExamMap.get(`${stu.id}_${sub.id}`) ?? null;
        let ann = null;
        if (s1 !== null && s2 !== null) {
          ann = Math.round(((s1 + s2) / 2) * 100) / 100;
        } else if (s1 !== null) {
          ann = s1;
        } else if (s2 !== null) {
          ann = s2;
        }
        subMap.set(sub.id, { sem1: s1, sem2: s2, annual: ann });
      });
      subjectDataByStudent.set(stu.id, subMap);
    });

    // Compute ranks for each subject across the class
    const subjectRanks = new Map();
    subjects.forEach(sub => {
      const rankListSem1 = classStudents
        .map(stu => ({ stuId: stu.id, score: subjectDataByStudent.get(stu.id)?.get(sub.id)?.sem1 }))
        .filter(x => x.score !== null && x.score !== undefined)
        .sort((a, b) => b.score - a.score);

      const rankListSem2 = classStudents
        .map(stu => ({ stuId: stu.id, score: subjectDataByStudent.get(stu.id)?.get(sub.id)?.sem2 }))
        .filter(x => x.score !== null && x.score !== undefined)
        .sort((a, b) => b.score - a.score);

      const rankListAnnual = classStudents
        .map(stu => ({ stuId: stu.id, score: subjectDataByStudent.get(stu.id)?.get(sub.id)?.annual }))
        .filter(x => x.score !== null && x.score !== undefined)
        .sort((a, b) => b.score - a.score);

      const mapRanks = (list) => {
        const m = new Map();
        let currentRank = 1;
        for (let i = 0; i < list.length; i++) {
          if (i > 0 && list[i].score < list[i - 1].score) {
            currentRank = i + 1;
          }
          m.set(list[i].stuId, currentRank);
        }
        return m;
      };

      subjectRanks.set(sub.id, {
        sem1: mapRanks(rankListSem1),
        sem2: mapRanks(rankListSem2),
        annual: mapRanks(rankListAnnual)
      });
    });

    // Compute overall student summary statistics across class (for ranks in rows 18 and 20)
    const studentSummaries = classStudents.map(stu => {
      const subMap = subjectDataByStudent.get(stu.id);
      let sem1ExamTotal = 0;
      let sem1ExamCount = 0;
      let sem2ExamTotal = 0;
      let sem2ExamCount = 0;
      let annualExamTotal = 0;
      let annualExamCount = 0;

      subjects.forEach(sub => {
        const s = subMap.get(sub.id);
        if (s?.sem1 !== null && s?.sem1 !== undefined) {
          sem1ExamTotal += s.sem1;
          sem1ExamCount++;
        }
        if (s?.sem2 !== null && s?.sem2 !== undefined) {
          sem2ExamTotal += s.sem2;
          sem2ExamCount++;
        }
        if (s?.annual !== null && s?.annual !== undefined) {
          annualExamTotal += s.annual;
          annualExamCount++;
        }
      });

      const sem1ExamAvg = sem1ExamCount > 0 ? (sem1ExamTotal / sem1ExamCount) : null;
      const sem2ExamAvg = sem2ExamCount > 0 ? (sem2ExamTotal / sem2ExamCount) : null;
      const annualExamAvg = annualExamCount > 0 ? (annualExamTotal / annualExamCount) : null;

      const sem1InternalAvg = getStudentMonthlyAverage(stu.id, SEM1_MONTHS);
      const sem2InternalAvg = getStudentMonthlyAverage(stu.id, SEM2_MONTHS);
      let annualInternalAvg = null;
      if (sem1InternalAvg !== null && sem2InternalAvg !== null) {
        annualInternalAvg = (sem1InternalAvg + sem2InternalAvg) / 2;
      } else {
        annualInternalAvg = sem1InternalAvg ?? sem2InternalAvg;
      }

      // Overall Semester Average = (Internal + Exam) / 2
      const calcOverall = (internal, exam) => {
        if (internal !== null && exam !== null) return (internal + exam) / 2;
        return internal ?? exam;
      };

      const sem1Overall = calcOverall(sem1InternalAvg, sem1ExamAvg);
      const sem2Overall = calcOverall(sem2InternalAvg, sem2ExamAvg);
      let annualOverall = null;
      if (sem1Overall !== null && sem2Overall !== null) {
        annualOverall = (sem1Overall + sem2Overall) / 2;
      } else {
        annualOverall = sem1Overall ?? sem2Overall;
      }

      return {
        stuId: stu.id,
        sem1ExamTotal: sem1ExamCount > 0 ? sem1ExamTotal : null,
        sem2ExamTotal: sem2ExamCount > 0 ? sem2ExamTotal : null,
        annualExamTotal: annualExamCount > 0 ? annualExamTotal : null,
        sem1ExamAvg,
        sem2ExamAvg,
        annualExamAvg,
        sem1InternalAvg,
        sem2InternalAvg,
        annualInternalAvg,
        sem1Overall,
        sem2Overall,
        annualOverall
      };
    });

    const rankMetric = (metricKey) => {
      const list = studentSummaries
        .map(s => ({ stuId: s.stuId, val: s[metricKey] }))
        .filter(x => x.val !== null && x.val !== undefined)
        .sort((a, b) => b.val - a.val);

      const m = new Map();
      let rank = 1;
      for (let i = 0; i < list.length; i++) {
        if (i > 0 && list[i].val < list[i - 1].val) {
          rank = i + 1;
        }
        m.set(list[i].stuId, rank);
      }
      return m;
    };

    const sem1ExamAvgRanks = rankMetric('sem1ExamAvg');
    const sem2ExamAvgRanks = rankMetric('sem2ExamAvg');
    const annualExamAvgRanks = rankMetric('annualExamAvg');

    const sem1OverallRanks = rankMetric('sem1Overall');
    const sem2OverallRanks = rankMetric('sem2Overall');
    const annualOverallRanks = rankMetric('annualOverall');

    // Build current student's subject list
    const currentStuId = currentStudent?.id || '';
    const currentSubScores = subjectDataByStudent.get(currentStuId) || new Map();
    const currentSummary = studentSummaries.find(s => s.stuId === currentStuId) || {};

    const subjectRows = subjects.map((sub, idx) => {
      const scores = currentSubScores.get(sub.id) || { sem1: null, sem2: null, annual: null };
      const ranks = subjectRanks.get(sub.id) || { sem1: new Map(), sem2: new Map(), annual: new Map() };

      const s1 = scores.sem1;
      const s2 = scores.sem2;
      const ann = scores.annual;

      let remark = '';
      if (ann !== null && ann !== undefined) {
        const gradeInfo = SubjectService.calculateGrade(ann, 50);
        remark = gradeInfo?.labelKm || '';
      }

      return {
        index: idx + 1,
        indexKm: toKhmerNumerals(idx + 1),
        id: sub.id,
        name: sub.name || sub.nameKm || '',
        sem1Score: s1,
        sem1Rank: s1 !== null ? (ranks.sem1.get(currentStuId) || '') : '',
        sem2Score: s2,
        sem2Rank: s2 !== null ? (ranks.sem2.get(currentStuId) || '') : '',
        annualScore: ann,
        annualRank: ann !== null ? (ranks.annual.get(currentStuId) || '') : '',
        remark
      };
    });

    // Summary Rows
    const nextIdx = subjects.length + 1;
    let examAvgRemark = '';
    if (currentSummary.annualExamAvg !== null && currentSummary.annualExamAvg !== undefined) {
      examAvgRemark = SubjectService.calculateGrade(currentSummary.annualExamAvg, 50)?.labelKm || '';
    }

    let overallAvgRemark = '';
    if (currentSummary.annualOverall !== null && currentSummary.annualOverall !== undefined) {
      overallAvgRemark = SubjectService.calculateGrade(currentSummary.annualOverall, 50)?.labelKm || '';
    }

    const summaryRows = {
      examTotal: {
        index: nextIdx,
        indexKm: toKhmerNumerals(nextIdx),
        name: 'សរុបពិន្ទុរួមប្រឡងឆមាស',
        sem1: currentSummary.sem1ExamTotal,
        sem2: currentSummary.sem2ExamTotal,
        annual: currentSummary.annualExamTotal
      },
      examAvg: {
        index: nextIdx + 1,
        indexKm: toKhmerNumerals(nextIdx + 1),
        name: 'មធ្យមភាគពិន្ទុរួមប្រឡងឆមាស',
        sem1: currentSummary.sem1ExamAvg,
        sem1Rank: currentSummary.sem1ExamAvg !== null ? (sem1ExamAvgRanks.get(currentStuId) || '') : '',
        sem2: currentSummary.sem2ExamAvg,
        sem2Rank: currentSummary.sem2ExamAvg !== null ? (sem2ExamAvgRanks.get(currentStuId) || '') : '',
        annual: currentSummary.annualExamAvg,
        annualRank: currentSummary.annualExamAvg !== null ? (annualExamAvgRanks.get(currentStuId) || '') : '',
        remark: examAvgRemark
      },
      internalAvg: {
        index: nextIdx + 2,
        indexKm: toKhmerNumerals(nextIdx + 2),
        name: 'មធ្យមភាគពិន្ទុផ្ទៃក្នុងប្រចាំឆមាស',
        sem1: currentSummary.sem1InternalAvg,
        sem2: currentSummary.sem2InternalAvg,
        annual: currentSummary.annualInternalAvg
      },
      overallAvg: {
        index: nextIdx + 3,
        indexKm: toKhmerNumerals(nextIdx + 3),
        name: 'មធ្យមភាគប្រចាំឆមាស',
        sem1: currentSummary.sem1Overall,
        sem1Rank: currentSummary.sem1Overall !== null ? (sem1OverallRanks.get(currentStuId) || '') : '',
        sem2: currentSummary.sem2Overall,
        sem2Rank: currentSummary.sem2Overall !== null ? (sem2OverallRanks.get(currentStuId) || '') : '',
        annual: currentSummary.annualOverall,
        annualRank: currentSummary.annualOverall !== null ? (annualOverallRanks.get(currentStuId) || '') : '',
        remark: overallAvgRemark
      }
    };

    // Calculate Attendance Statistics
    // Sem 1 months: 10, 11, 12, 1, 2
    // Sem 2 months: 3, 4, 5, 6, 7, 8, 9
    let excusedSem1 = 0;
    let unexcusedSem1 = 0;
    let excusedSem2 = 0;
    let unexcusedSem2 = 0;

    (allAttendance || []).forEach(att => {
      if (att.studentId !== currentStuId && att.studentId !== currentStudent?.studentId) return;
      if (att.classId && att.classId !== classId) return;

      let monthNum = 0;
      if (att.date) {
        const d = new Date(att.date);
        if (!isNaN(d.getTime())) {
          monthNum = d.getMonth() + 1;
        }
      } else if (att.month) {
        const MONTH_MAP = {
          'January': 1, 'February': 2, 'March': 3, 'April': 4,
          'May': 5, 'June': 6, 'July': 7, 'August': 8,
          'September': 9, 'October': 10, 'November': 11, 'December': 12
        };
        monthNum = MONTH_MAP[att.month] || 0;
      }

      const isSem1 = [10, 11, 12, 1, 2].includes(monthNum);
      const isSem2 = [3, 4, 5, 6, 7, 8, 9].includes(monthNum);

      const status = String(att.status || '').trim();
      const isExcused = status === 'Excused' || status === 'មានច្បាប់';
      const isUnexcused = status === 'Absent' || status === 'ឥតច្បាប់';

      if (isSem1) {
        if (isExcused) excusedSem1++;
        if (isUnexcused) unexcusedSem1++;
      } else if (isSem2) {
        if (isExcused) excusedSem2++;
        if (isUnexcused) unexcusedSem2++;
      } else {
        // Fallback: divide or count into sem 1
        if (isExcused) excusedSem1++;
        if (isUnexcused) unexcusedSem1++;
      }
    });

    const attendanceStats = {
      excusedSem1,
      unexcusedSem1,
      excusedSem2,
      unexcusedSem2,
      excusedYear: excusedSem1 + excusedSem2,
      unexcusedYear: unexcusedSem1 + unexcusedSem2
    };

    return {
      student: currentStudent,
      className: targetClass.name || targetClass.grade || '—',
      academicYear: academicYear || targetClass.academicYear || new Date().getFullYear(),
      classStudents,
      subjects: subjectRows,
      summary: summaryRows,
      attendance: attendanceStats
    };
  }
};
