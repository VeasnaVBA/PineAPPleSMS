/**
 * Student Grade Book Service (សៀវភៅសិក្ខាគារិក)
 * Fetches and computes student academic results for Semester 1, Semester 2, and Annual evaluation,
 * including subject scores, subject class ranks, semester exam averages, internal monthly averages,
 * overall semester averages, and annual attendance (excused / unexcused absences).
 */

import { db } from '../database/db.js';
import { SubjectService } from './subjectService.js';
import { SchoolService } from './schoolService.js';
import { SettingsService } from './settingsService.js';
import { normalizeStudentRecord } from './studentService.js';
import { ScoreService, isStudentActive } from './scoreService.js';

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

/**
 * 4 Khmer Grades: ល្អ, ល្អបង្គួរ, មធ្យម, ខ្សោយ
 * If subject full score is 100, < 50 is ខ្សោយ
 */
export function calculateKhmerGrade(score, fullScore = 50) {
  if (score === null || score === undefined || score === '') return '';
  const s = Number(score);
  if (isNaN(s)) return '';
  const fs = Number(fullScore) > 0 ? Number(fullScore) : 50;
  const percentage = Math.max(0, (s / fs) * 100);

  if (percentage >= 70) return 'ល្អ';
  if (percentage >= 60) return 'ល្អបង្គួរ';
  if (percentage >= 50) return 'មធ្យម';
  return 'ខ្សោយ';
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
  /**
   * Get list of hidden subject IDs for grade book
   */
  async getHiddenSubjectIds(classId) {
    if (!classId) return [];
    try {
      const rec = await db.get('report_settings', `student_gradebook_hidden_subjects_${classId}`);
      if (rec && rec.value) {
        const parsed = typeof rec.value === 'string' ? JSON.parse(rec.value) : rec.value;
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem(`student_gradebook_hidden_subjects_${classId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  },

  /**
   * Save hidden subject IDs for grade book
   */
  async saveHiddenSubjectIds(classId, hiddenIds) {
    if (!classId) return [];
    const key = `student_gradebook_hidden_subjects_${classId}`;
    const payload = Array.isArray(hiddenIds) ? hiddenIds : [];
    try {
      await db.put('report_settings', {
        id: key,
        key: key,
        type: 'gradebook_hidden_subjects',
        value: JSON.stringify(payload),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to save gradebook hidden subjects to DB:', err);
    }
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (_) {}
    return payload;
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
    const [
      classes, rawStudents, allAttendance, schoolCatalog,
      sem1ExamSheet, sem2ExamSheet, sem1Sheet, sem2Sheet
    ] = await Promise.all([
      db.getAll('classes'),
      db.getAll('students'),
      db.getAll('attendance').catch(() => []),
      SchoolService.getAllSchools().catch(() => []),
      ScoreService.getMasterScoreSheet({ classId, academicYear, period: 'Semester 1 Exam' }).catch(() => ({ rows: [] })),
      ScoreService.getMasterScoreSheet({ classId, academicYear, period: 'Semester 2 Exam' }).catch(() => ({ rows: [] })),
      ScoreService.getMasterScoreSheet({ classId, academicYear, period: 'Semester 1' }).catch(() => ({ rows: [] })),
      ScoreService.getMasterScoreSheet({ classId, academicYear, period: 'Semester 2' }).catch(() => ({ rows: [] }))
    ]);

    const targetClass = (classes || []).find(c => c.id === classId) || { id: classId, name: '—' };
    const classStudents = (rawStudents || [])
      .map(normalizeStudentRecord)
      .filter(s => s.classId === classId && isStudentActive(s))
      .sort((a, b) => (a.khmerName || '').localeCompare(b.khmerName || '', 'km'));

    const currentStudent = classStudents.find(s => s.studentId === studentId || s.id === studentId) || classStudents[0] || null;
    const curStuId = currentStudent?.id || '';
    const currentAltId = currentStudent?.studentId || '';

    const allAvailableSubjects = await this.getGradeBookSubjects(targetClass);
    const hiddenSubjectIds = await this.getHiddenSubjectIds(classId);
    const hiddenSet = new Set(hiddenSubjectIds);
    let subjects = allAvailableSubjects.filter(sub => {
      const sId = sub.id || sub.code || sub.name;
      return !hiddenSet.has(sId) && !hiddenSet.has(sub.id) && !hiddenSet.has(sub.code);
    });
    // Fallback if all subjects were hidden: show all
    if (subjects.length === 0) {
      subjects = allAvailableSubjects;
    }

    let matchedSchool = null;
    const allSchools = Array.isArray(schoolCatalog) ? schoolCatalog : [];
    if (targetClass.schoolId) {
      matchedSchool = allSchools.find(s => s.id === targetClass.schoolId);
    }
    if (!matchedSchool && allSchools.length > 0) {
      matchedSchool = allSchools[0];
    }
    const schoolNameKm = matchedSchool?.name || matchedSchool?.nameKm || (await SettingsService.get('school_name_km')) || '';

    // Index rows by studentId / studentNumber for fast exact lookup
    const makeRowMap = (sheet) => {
      const m = new Map();
      (sheet?.rows || []).forEach(r => {
        if (r.studentId) m.set(String(r.studentId), r);
        if (r.studentNumber) m.set(String(r.studentNumber), r);
        if (r.id) m.set(String(r.id), r);
      });
      return m;
    };
    const sem1ExamRowsMap = makeRowMap(sem1ExamSheet);
    const sem2ExamRowsMap = makeRowMap(sem2ExamSheet);
    const sem1RowsMap = makeRowMap(sem1Sheet);
    const sem2RowsMap = makeRowMap(sem2Sheet);

    const findSheetRow = (map, stu) => {
      if (!map || !stu) return null;
      if (stu.id && map.has(String(stu.id))) return map.get(String(stu.id));
      if (stu.studentId && map.has(String(stu.studentId))) return map.get(String(stu.studentId));
      if (stu._id && map.has(String(stu._id))) return map.get(String(stu._id));
      return null;
    };

    // Calculate student summaries across class for the 4 bottom summary rows
    const allStudentsSummary = classStudents.map(stu => {
      const s1Exam = findSheetRow(sem1ExamRowsMap, stu);
      const s2Exam = findSheetRow(sem2ExamRowsMap, stu);
      const s1SheetRow = findSheetRow(sem1RowsMap, stu);
      const s2SheetRow = findSheetRow(sem2RowsMap, stu);

      // Row 1: ពិន្ទុសរុប is get from ពិន្ទុសរុប in semester exam 1 or 2
      const sem1ExamTotal = (s1Exam && s1Exam.total !== null && s1Exam.total !== undefined && !isNaN(Number(s1Exam.total)))
        ? Number(s1Exam.total)
        : null;
      const sem2ExamTotal = (s2Exam && s2Exam.total !== null && s2Exam.total !== undefined && !isNaN(Number(s2Exam.total)))
        ? Number(s2Exam.total)
        : null;
      let annualExamTotal = null;
      if (sem1ExamTotal !== null && sem2ExamTotal !== null) {
        annualExamTotal = Math.round(((sem1ExamTotal + sem2ExamTotal) / 2) * 100) / 100;
      } else {
        annualExamTotal = sem1ExamTotal ?? sem2ExamTotal ?? null;
      }

      // Row 2: មធ្យមភាគប្រឡងឆមាស is get from មធ្យមភាគ in semester exam 1 or 2
      const sem1ExamAvg = (s1Exam && s1Exam.average !== null && s1Exam.average !== undefined && !isNaN(Number(s1Exam.average)))
        ? Number(s1Exam.average)
        : null;
      const sem1ExamRank = s1Exam?.rank || '';

      const sem2ExamAvg = (s2Exam && s2Exam.average !== null && s2Exam.average !== undefined && !isNaN(Number(s2Exam.average)))
        ? Number(s2Exam.average)
        : null;
      const sem2ExamRank = s2Exam?.rank || '';

      let annualExamAvg = null;
      if (sem1ExamAvg !== null && sem2ExamAvg !== null) {
        annualExamAvg = Math.round(((sem1ExamAvg + sem2ExamAvg) / 2) * 100) / 100;
      } else {
        annualExamAvg = sem1ExamAvg ?? sem2ExamAvg ?? null;
      }

      // Row 3: មធ្យមភាគខែប្រចាំឆមាស is get from the មធ្យមភាគខែប្រចាំឆមាស in semester 1 or 2
      const sem1MonthAvg = (s1SheetRow && s1SheetRow.semesterMonthAvg !== null && s1SheetRow.semesterMonthAvg !== undefined && !isNaN(Number(s1SheetRow.semesterMonthAvg)))
        ? Number(s1SheetRow.semesterMonthAvg)
        : null;
      const sem2MonthAvg = (s2SheetRow && s2SheetRow.semesterMonthAvg !== null && s2SheetRow.semesterMonthAvg !== undefined && !isNaN(Number(s2SheetRow.semesterMonthAvg)))
        ? Number(s2SheetRow.semesterMonthAvg)
        : null;

      let annualMonthAvg = null;
      if (sem1MonthAvg !== null && sem2MonthAvg !== null) {
        annualMonthAvg = Math.round(((sem1MonthAvg + sem2MonthAvg) / 2) * 100) / 100;
      } else {
        annualMonthAvg = sem1MonthAvg ?? sem2MonthAvg ?? null;
      }

      // Row 4: មធ្យមភាគប្រចាំឆមាស is get from column មធ្យមភាគប្រចាំឆមាស in semester 1 or 2
      const sem1Overall = (s1SheetRow && s1SheetRow.semesterOverallAvg !== null && s1SheetRow.semesterOverallAvg !== undefined && !isNaN(Number(s1SheetRow.semesterOverallAvg)))
        ? Number(s1SheetRow.semesterOverallAvg)
        : null;
      const sem1OverallRank = s1SheetRow?.rank || '';

      const sem2Overall = (s2SheetRow && s2SheetRow.semesterOverallAvg !== null && s2SheetRow.semesterOverallAvg !== undefined && !isNaN(Number(s2SheetRow.semesterOverallAvg)))
        ? Number(s2SheetRow.semesterOverallAvg)
        : null;
      const sem2OverallRank = s2SheetRow?.rank || '';

      let annualOverall = null;
      if (sem1Overall !== null && sem2Overall !== null) {
        annualOverall = Math.round(((sem1Overall + sem2Overall) / 2) * 100) / 100;
      } else {
        annualOverall = sem1Overall ?? sem2Overall ?? null;
      }

      return {
        stuId: stu.id,
        studentId: stu.studentId,
        sem1ExamTotal,
        sem2ExamTotal,
        annualExamTotal,
        sem1ExamAvg,
        sem1ExamRank,
        sem2ExamAvg,
        sem2ExamRank,
        annualExamAvg,
        sem1MonthAvg,
        sem2MonthAvg,
        annualMonthAvg,
        sem1Overall,
        sem1OverallRank,
        sem2Overall,
        sem2OverallRank,
        annualOverall
      };
    });

    // Helper for class rank across list of students
    const rankList = (list, key) => {
      const valid = list
        .map(x => ({ id: x.stuId, altId: x.studentId, val: x[key] }))
        .filter(x => x.val !== null && x.val !== undefined && !isNaN(x.val))
        .sort((a, b) => b.val - a.val);
      const m = new Map();
      let r = 1;
      for (let i = 0; i < valid.length; i++) {
        if (i > 0 && valid[i].val < valid[i - 1].val) {
          r = i + 1;
        }
        m.set(valid[i].id, r);
        if (valid[i].altId) m.set(valid[i].altId, r);
      }
      return m;
    };
    const annualExamRanks = rankList(allStudentsSummary, 'annualExamAvg');
    const annualOverallRanks = rankList(allStudentsSummary, 'annualOverall');

    // Subject annual ranking across class
    const subjectAnnualRanks = new Map();
    subjects.forEach(sub => {
      const list = classStudents
        .map(stu => {
          const s1Exam = findSheetRow(sem1ExamRowsMap, stu);
          const s2Exam = findSheetRow(sem2ExamRowsMap, stu);
          const s1 = (s1Exam?.subjectScores?.[sub.id] !== undefined && s1Exam?.subjectScores?.[sub.id] !== null)
            ? Number(s1Exam.subjectScores[sub.id])
            : null;
          const s2 = (s2Exam?.subjectScores?.[sub.id] !== undefined && s2Exam?.subjectScores?.[sub.id] !== null)
            ? Number(s2Exam.subjectScores[sub.id])
            : null;
          let ann = null;
          if (s1 !== null && s2 !== null) ann = Math.round(((s1 + s2) / 2) * 100) / 100;
          else ann = s1 ?? s2 ?? null;
          return { id: stu.id, altId: stu.studentId, score: ann };
        })
        .filter(x => x.score !== null && x.score !== undefined && !isNaN(x.score))
        .sort((a, b) => b.score - a.score);

      const m = new Map();
      let r = 1;
      for (let i = 0; i < list.length; i++) {
        if (i > 0 && list[i].score < list[i - 1].score) {
          r = i + 1;
        }
        m.set(list[i].id, r);
        if (list[i].altId) m.set(list[i].altId, r);
      }
      subjectAnnualRanks.set(sub.id, m);
    });

    // Subject rows for current student
    const curS1Exam = findSheetRow(sem1ExamRowsMap, currentStudent);
    const curS2Exam = findSheetRow(sem2ExamRowsMap, currentStudent);

    const subjectRows = subjects.map((sub, idx) => {
      const s1 = (curS1Exam?.subjectScores?.[sub.id] !== undefined && curS1Exam?.subjectScores?.[sub.id] !== null)
        ? Number(curS1Exam.subjectScores[sub.id])
        : null;
      const sem1Rank = curS1Exam?.subjectRanks?.[sub.id] || '';

      const s2 = (curS2Exam?.subjectScores?.[sub.id] !== undefined && curS2Exam?.subjectScores?.[sub.id] !== null)
        ? Number(curS2Exam.subjectScores[sub.id])
        : null;
      const sem2Rank = curS2Exam?.subjectRanks?.[sub.id] || '';

      let ann = null;
      if (s1 !== null && s2 !== null) {
        ann = Math.round(((s1 + s2) / 2) * 100) / 100;
      } else {
        ann = s1 ?? s2 ?? null;
      }
      const annualRank = ann !== null ? (subjectAnnualRanks.get(sub.id)?.get(curStuId) || subjectAnnualRanks.get(sub.id)?.get(currentAltId) || '') : '';

      const fullScore = SubjectService.getSubjectFullScore(sub, targetClass?.name || 'G7');
      const remark = ann !== null ? calculateKhmerGrade(ann, fullScore) : '';

      return {
        index: idx + 1,
        indexKm: toKhmerNumerals(idx + 1),
        id: sub.id,
        name: sub.name || sub.nameKm || '',
        fullScore,
        sem1Score: s1,
        sem1Rank,
        sem2Score: s2,
        sem2Rank,
        annualScore: ann,
        annualRank,
        remark
      };
    });

    // Summary Rows for current student
    const currentSummary = allStudentsSummary.find(s => s.stuId === curStuId || (currentAltId && s.studentId === currentAltId)) || {};
    const nextIdx = subjects.length + 1;

    let examAvgRemark = '';
    if (currentSummary.annualExamAvg !== null && currentSummary.annualExamAvg !== undefined) {
      examAvgRemark = calculateKhmerGrade(currentSummary.annualExamAvg, 50);
    }

    let overallAvgRemark = '';
    if (currentSummary.annualOverall !== null && currentSummary.annualOverall !== undefined) {
      overallAvgRemark = calculateKhmerGrade(currentSummary.annualOverall, 50);
    }

    const summaryRows = {
      examTotal: {
        index: nextIdx,
        indexKm: toKhmerNumerals(nextIdx),
        name: 'ពិន្ទុសរុប',
        sem1: currentSummary.sem1ExamTotal ?? null,
        sem2: currentSummary.sem2ExamTotal ?? null,
        annual: currentSummary.annualExamTotal ?? null
      },
      examAvg: {
        index: nextIdx + 1,
        indexKm: toKhmerNumerals(nextIdx + 1),
        name: 'មធ្យមភាគប្រឡងឆមាស',
        sem1: currentSummary.sem1ExamAvg ?? null,
        sem1Rank: currentSummary.sem1ExamRank || '',
        sem2: currentSummary.sem2ExamAvg ?? null,
        sem2Rank: currentSummary.sem2ExamRank || '',
        annual: currentSummary.annualExamAvg ?? null,
        annualRank: annualExamRanks.get(curStuId) || annualExamRanks.get(currentAltId) || '',
        remark: examAvgRemark
      },
      internalAvg: {
        index: nextIdx + 2,
        indexKm: toKhmerNumerals(nextIdx + 2),
        name: 'មធ្យមភាគខែប្រចាំឆមាស',
        sem1: currentSummary.sem1MonthAvg ?? null,
        sem2: currentSummary.sem2MonthAvg ?? null,
        annual: currentSummary.annualMonthAvg ?? null
      },
      overallAvg: {
        index: nextIdx + 3,
        indexKm: toKhmerNumerals(nextIdx + 3),
        name: 'មធ្យមភាគប្រចាំឆមាស',
        sem1: currentSummary.sem1Overall ?? null,
        sem1Rank: currentSummary.sem1OverallRank || '',
        sem2: currentSummary.sem2Overall ?? null,
        sem2Rank: currentSummary.sem2OverallRank || '',
        annual: currentSummary.annualOverall ?? null,
        annualRank: annualOverallRanks.get(curStuId) || annualOverallRanks.get(currentAltId) || '',
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

    const sem1Eval = currentSummary.sem1Overall !== null && currentSummary.sem1Overall !== undefined
      ? (SubjectService.calculateGrade(currentSummary.sem1Overall, 50)?.labelKm || '')
      : '';
    const sem2Eval = currentSummary.sem2Overall !== null && currentSummary.sem2Overall !== undefined
      ? (SubjectService.calculateGrade(currentSummary.sem2Overall, 50)?.labelKm || '')
      : '';
    const annualEval = currentSummary.annualOverall !== null && currentSummary.annualOverall !== undefined
      ? (SubjectService.calculateGrade(currentSummary.annualOverall, 50)?.labelKm || '')
      : '';

    const graduationResult = currentSummary.annualOverall !== null && currentSummary.annualOverall !== undefined
      ? (currentSummary.annualOverall >= 25 ? 'ជាប់' : 'ធ្លាក់')
      : '';

    const isFemale = (s) => {
      const g = String(s?.gender || '').trim().toLowerCase();
      return g === 'female' || g === 'f' || g === 'ស្រី' || g.includes('female') || g.includes('ស្រី');
    };
    const femaleStudents = classStudents.filter(isFemale).length;

    return {
      student: currentStudent,
      className: targetClass.name || targetClass.grade || '—',
      academicYear: academicYear || targetClass.academicYear || new Date().getFullYear(),
      schoolName: schoolNameKm,
      totalStudents: classStudents.length,
      femaleStudents: femaleStudents,
      classStudents,
      allAvailableSubjects,
      hiddenSubjectIds,
      subjects: subjectRows,
      summary: summaryRows,
      attendance: attendanceStats,
      evaluation: {
        sem1: sem1Eval,
        sem2: sem2Eval,
        annual: annualEval
      },
      graduationResult
    };
  }
};
