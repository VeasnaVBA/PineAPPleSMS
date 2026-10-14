/**
 * Student Individual Study Plan Service (ផែនការសិស្សម្នាក់ៗ)
 * Based on official MoEYS / SEIP Cambodia standard template:
 * "ផែនការសិក្សារបស់សិស្ស ឆ្នាំសិក្សា... (ថ្នាក់ទី...)"
 *
 * Persists baseline levels, monthly target scores, actual exam evaluations,
 * and family/guardian metadata in the `report_settings` IndexedDB store
 * (auto-mirrored to Google Drive).
 */

import { db } from '../database/db.js';
import { SubjectService } from './subjectService.js';
import { SettingsService } from './settingsService.js';
import { SchoolService } from './schoolService.js';
import { authService } from './authService.js';
import { normalizeStudentRecord } from './studentService.js';
import { isStudentActive } from './scoreService.js';

export const PLAN_MONTHS = [
  { key: 'm1', id: 'October', nameKm: 'តុលា', labelKm: 'ខែ១' },
  { key: 'm2', id: 'November', nameKm: 'វិច្ឆិកា', labelKm: 'ខែ២' },
  { key: 'm3', id: 'December', nameKm: 'ធ្នូ', labelKm: 'ខែ៣' },
  { key: 'm4', id: 'January', nameKm: 'មករា', labelKm: 'ខែ៤' },
  { key: 'm5', id: 'February', nameKm: 'កុម្ភៈ', labelKm: 'ខែ៥' },
  { key: 'm6', id: 'March', nameKm: 'មីនា', labelKm: 'ខែ៦' },
  { key: 'm7', id: 'April', nameKm: 'មេសា', labelKm: 'ខែ៧' },
  { key: 'm8', id: 'May', nameKm: 'ឧសភា', labelKm: 'ខែ៨' },
  { key: 'm9', id: 'June', nameKm: 'មិថុនា', labelKm: 'ខែ៩' },
  { key: 'm10', id: 'July', nameKm: 'កក្កដា', labelKm: 'ខែ១០' }
];

export const ALL_EVALUATION_PERIODS = [
  { id: 'October', nameKm: 'តុលា', nameEn: 'October', group: 'month' },
  { id: 'November', nameKm: 'វិច្ឆិកា', nameEn: 'November', group: 'month' },
  { id: 'December', nameKm: 'ធ្នូ', nameEn: 'December', group: 'month' },
  { id: 'January', nameKm: 'មករា', nameEn: 'January', group: 'month' },
  { id: 'February', nameKm: 'កុម្ភៈ', nameEn: 'February', group: 'month' },
  { id: 'March', nameKm: 'មីនា', nameEn: 'March', group: 'month' },
  { id: 'April', nameKm: 'មេសា', nameEn: 'April', group: 'month' },
  { id: 'May', nameKm: 'ឧសភា', nameEn: 'May', group: 'month' },
  { id: 'June', nameKm: 'មិថុនា', nameEn: 'June', group: 'month' },
  { id: 'July', nameKm: 'កក្កដា', nameEn: 'July', group: 'month' },
  { id: 'August', nameKm: 'សីហា', nameEn: 'August', group: 'month' },
  { id: 'September', nameKm: 'កញ្ញា', nameEn: 'September', group: 'month' },
  { id: 'First Test', nameKm: 'តេស្តដើមឆ្នាំ', nameEn: 'First Test', group: 'exam' },
  { id: 'Semester 1 Exam', nameKm: 'ឆមាសទី១', nameEn: 'Semester 1 Exam', group: 'exam' },
  { id: 'Semester 2 Exam', nameKm: 'ឆមាសទី២', nameEn: 'Semester 2 Exam', group: 'exam' }
];

export const GRADE_ORDER = ['F', 'E', 'D', 'C', 'B', 'A'];

export function getUpperGrade(grade) {
  if (!grade) return 'E';
  const clean = String(grade).trim().toUpperCase();
  const idx = GRADE_ORDER.indexOf(clean);
  if (idx === -1) return 'E';
  if (idx < GRADE_ORDER.length - 1) {
    return GRADE_ORDER[idx + 1];
  }
  return 'A';
}

export const DEFAULT_PLAN_SUBJECTS = [
  { id: 'sub_reading_speed', name: 'ល្បឿនអំណាន', nameEn: 'Reading Speed', code: 'SUB-READ' },
  { id: 'sub_khmer_lit', name: 'ភាសាខ្មែរ', nameEn: 'Khmer Literature', code: 'SUB-103' },
  { id: 'sub_math', name: 'គណិតវិទ្យា', nameEn: 'Mathematics', code: 'SUB-104' },
  { id: 'sub_physics', name: 'រូបវិទ្យា', nameEn: 'Physics', code: 'SUB-105' },
  { id: 'sub_chemistry', name: 'គីមីវិទ្យា', nameEn: 'Chemistry', code: 'SUB-106' },
  { id: 'sub_biology', name: 'ជីវវិទ្យា', nameEn: 'Biology', code: 'SUB-107' },
  { id: 'sub_history', name: 'ប្រវត្តិវិទ្យា', nameEn: 'History', code: 'SUB-108' },
  { id: 'sub_morals', name: 'សីល-ពលរដ្ឋ', nameEn: 'Moral & Civics', code: 'SUB-110' },
  { id: 'sub_earth_science', name: 'ផែនដីវិទ្យា', nameEn: 'Earth Science', code: 'SUB-111' },
  { id: 'sub_geography', name: 'ភូមិវិទ្យា', nameEn: 'Geography', code: 'SUB-112' },
  { id: 'sub_foreign_lang', name: 'ភាសាបរទេស', nameEn: 'Foreign Language', code: 'SUB-LANG' }
];

export const SCORE_SCALE_MATRIX = [
  {
    range: 'ពិន្ទុ ០០ដល់១៥០',
    scaleLabel: 'កម្រិតពិន្ទុ(ពិន្ទុ ០០ដល់១៥០)៖',
    grades: [
      { grade: 'F', text: 'F ក្រោម ៧៥ពិន្ទុ' },
      { grade: 'E', text: 'E ពី ៧៥-៨៩ពិន្ទុ' },
      { grade: 'D', text: 'D ពី ៩០-១០៤ពិន្ទុ' },
      { grade: 'C', text: 'C ពី ១០៥-១១៩ពិន្ទុ' },
      { grade: 'B', text: 'B ពី ១២០-១៣៤ពិន្ទុ' },
      { grade: 'A', text: 'A ពី ១៣៥-១៥០ពិន្ទុ' }
    ]
  },
  {
    range: 'ពិន្ទុ ០០ដល់១០០',
    scaleLabel: 'កម្រិតពិន្ទុ(ពិន្ទុ ០០ដល់១០០)៖',
    grades: [
      { grade: 'F', text: 'F ក្រោម ៥០ពិន្ទុ' },
      { grade: 'E', text: 'E ពី ៥១-៦០ពិន្ទុ' },
      { grade: 'D', text: 'D ពី ៦១-៧០ពិន្ទុ' },
      { grade: 'C', text: 'C ពី ៧១-៧៩ពិន្ទុ' },
      { grade: 'B', text: 'B ពី ៨០-៨៩ពិន្ទុ' },
      { grade: 'A', text: 'A ពី ៩០-១០០ពិន្ទុ' }
    ]
  },
  {
    range: 'ពិន្ទុ ០០ដល់៥០',
    scaleLabel: 'កម្រិតពិន្ទុ(ពិន្ទុ ០០ដល់៥០)៖',
    grades: [
      { grade: 'F', text: 'F ក្រោម ២៥ពិន្ទុ' },
      { grade: 'E', text: 'E ពី ២៥-២៩ពិន្ទុ' },
      { grade: 'D', text: 'D ពី ៣០-៣៤ពិន្ទុ' },
      { grade: 'C', text: 'C ពី ៣៥-៣៩ពិន្ទុ' },
      { grade: 'B', text: 'B ពី ៤០-៤៤ពិន្ទុ' },
      { grade: 'A', text: 'A ពី ៤៥-៥០ពិន្ទុ' }
    ]
  },
  {
    range: 'ពិន្ទុ ០០ដល់៣៥',
    scaleLabel: 'កម្រិតពិន្ទុ(ពិន្ទុ ០០ដល់៣៥)៖',
    grades: [
      { grade: 'F', text: 'F ក្រោម ១៤ពិន្ទុ' },
      { grade: 'E', text: 'E ពី ១៤-២១ពិន្ទុ' },
      { grade: 'D', text: 'D ពី ២២-២៦ពិន្ទុ' },
      { grade: 'C', text: 'C ពី ២៧-២៩ពិន្ទុ' },
      { grade: 'B', text: 'B ពី ៣០-៣៣ពិន្ទុ' },
      { grade: 'A', text: 'A ពី ៣៤-៣៥ពិន្ទុ' }
    ]
  },
  {
    range: 'ពិន្ទុ ០០ដល់៣០',
    scaleLabel: 'កម្រិតពិន្ទុ(ពិន្ទុ ០០ដល់៣០)៖',
    grades: [
      { grade: 'F', text: 'F ក្រោម ១៤ពិន្ទុ' },
      { grade: 'E', text: 'E ពី ១៤-២១ពិន្ទុ' },
      { grade: 'D', text: 'D ពី ២២-២៤ពិន្ទុ' },
      { grade: 'C', text: 'C ពី ២៥-២៩ពិន្ទុ' },
      { grade: 'B', text: 'B ពី ៣០-៣២ពិន្ទុ' },
      { grade: 'A', text: 'A ពី ៣៣-៣៧ពិន្ទុ' }
    ]
  },
  {
    range: 'ពិន្ទុ ០០ដល់២៥',
    scaleLabel: 'កម្រិតពិន្ទុ(ពិន្ទុ ០០ដល់២៥)៖',
    grades: [
      { grade: 'F', text: 'F ក្រោម ១៣ពិន្ទុ' },
      { grade: 'E', text: 'E ពី ១៣-១៤ពិន្ទុ' },
      { grade: 'D', text: 'D ពី ១៥-១៦ពិន្ទុ' },
      { grade: 'C', text: 'C ពី ១៧-១៩ពិន្ទុ' },
      { grade: 'B', text: 'B ពី ២០-២២ពិន្ទុ' },
      { grade: 'A', text: 'A ពី ២៣-២៥ពិន្ទុ' }
    ]
  }
];

export const StudentPlanService = {
  getMonths() {
    return PLAN_MONTHS;
  },

  getScoreScaleMatrix() {
    return SCORE_SCALE_MATRIX;
  },

  getAvailablePeriods() {
    return ALL_EVALUATION_PERIODS;
  },

  /**
   * Get column period configuration mapping for a class
   * e.g. { m1: 'January', m2: 'February', ... }
   */
  async getColumnPeriods(classId) {
    let mapping = {};
    try {
      const rec = await db.get('report_settings', `student_plan_col_periods_${classId}`);
      if (rec && rec.value) {
        mapping = typeof rec.value === 'string' ? JSON.parse(rec.value) : rec.value;
      }
    } catch (_) {}
    try {
      const local = localStorage.getItem(`student_plan_col_periods_${classId}`) || localStorage.getItem('student_plan_col_periods');
      if (local) {
        mapping = { ...JSON.parse(local), ...mapping };
      }
    } catch (_) {}
    return mapping || {};
  },

  /**
   * Save column period configuration mapping for a class
   */
  async setColumnPeriod(classId, colKey, periodId) {
    if (!colKey) return;
    const current = await this.getColumnPeriods(classId);
    if (periodId) {
      current[colKey] = periodId;
    } else {
      delete current[colKey];
    }
    try {
      localStorage.setItem(`student_plan_col_periods_${classId}`, JSON.stringify(current));
      localStorage.setItem('student_plan_col_periods', JSON.stringify(current));
      await db.put('report_settings', {
        key: `student_plan_col_periods_${classId}`,
        value: JSON.stringify(current),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to save column period mapping:', err);
    }
    return current;
  },

  getEducationLevelText(className) {
    const match = String(className || '').match(/\d+/);
    if (!match) return '';
    const g = parseInt(match[0], 10);
    if (g >= 10) return 'ទុតិយភូមិ';
    if (g >= 7) return 'បឋមភូមិ';
    return 'បឋមសិក្សា';
  },

  /**
   * Resolve active curriculum subjects for the plan table
   */
  async resolvePlanSubjects(classRecord) {
    try {
      const dbSubjects = await SubjectService.getAll();
      if (Array.isArray(dbSubjects) && dbSubjects.length > 0) {
        const activeSubjects = dbSubjects.filter(s => s.status !== 'Inactive');
        
        // Ensure reading speed (ល្បឿនអំណាន) is included at top as per MoEYS SEIP template
        const hasReading = activeSubjects.some(s => 
          (s.name && s.name.includes('អំណាន')) || (s.nameEn && s.nameEn.toLowerCase().includes('reading'))
        );
        
        const list = [...activeSubjects];
        if (!hasReading) {
          list.unshift({
            id: 'sub_reading_speed',
            name: 'ល្បឿនអំណាន',
            nameEn: 'Reading Speed',
            code: 'SUB-READ'
          });
        }
        return list;
      }
    } catch (err) {
      console.warn('Failed to load subjects from SubjectService, using default template:', err);
    }
    return DEFAULT_PLAN_SUBJECTS;
  },

  /**
   * Get list of hidden subject IDs for a class
   * If not configured by user yet, default to showing only the first 10 subjects
   */
  async getHiddenSubjectIds(classId, allSubjects = null) {
    if (!classId) return [];
    try {
      const rec = await db.get('report_settings', `student_plan_hidden_subjects_${classId}`);
      if (rec && rec.value) {
        const parsed = typeof rec.value === 'string' ? JSON.parse(rec.value) : rec.value;
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    try {
      const local = localStorage.getItem(`student_plan_hidden_subjects_${classId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}

    // Default configuration: Show first 10 subjects, hide subjects at index >= 10
    if (Array.isArray(allSubjects) && allSubjects.length > 10) {
      return allSubjects.slice(10).map(s => s.id || s.code || s.name);
    }
    return [];
  },

  /**
   * Save list of hidden subject IDs for a class
   */
  async setHiddenSubjectIds(classId, hiddenIds) {
    if (!classId) return;
    const cleanIds = Array.isArray(hiddenIds) ? hiddenIds : [];
    try {
      localStorage.setItem(`student_plan_hidden_subjects_${classId}`, JSON.stringify(cleanIds));
      await db.put('report_settings', {
        key: `student_plan_hidden_subjects_${classId}`,
        value: JSON.stringify(cleanIds),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to save hidden subject IDs:', err);
    }
  },

  /**
   * Get all active students for a class
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
   * Fetch complete plan data structure for a student
   */
  async getStudentPlan(classId, studentId, academicYear) {
    const [classes, rawStudents, allScores, schoolCatalog, savedPlanRecord] = await Promise.all([
      db.getAll('classes'),
      db.getAll('students'),
      db.getAll('scores'),
      SchoolService.getAllSchools().catch(() => []),
      this.loadSavedPlanRecord(academicYear, classId, studentId)
    ]);

    const targetClass = (classes || []).find(c => c.id === classId) || { id: classId, name: '—' };
    const rawStudent = (rawStudents || []).find(s => s.studentId === studentId || s.id === studentId);
    const student = rawStudent ? normalizeStudentRecord(rawStudent) : null;

    let teacher = { name: '', phone: '' };
    if (targetClass.teacherId) {
      try {
        const tRecord = await db.get('teachers', targetClass.teacherId);
        if (tRecord) {
          teacher = {
            name: tRecord.khmerName || tRecord.name || '',
            phone: tRecord.phone || ''
          };
        }
      } catch (_) {}
    }

    // Strictly resolve school from 'schools' table
    const allSchools = Array.isArray(schoolCatalog) ? schoolCatalog : [];
    let matchedSchool = null;
    if (targetClass.schoolId) {
      matchedSchool = allSchools.find(s => s.id === targetClass.schoolId);
    }
    if (!matchedSchool && student?.schoolId) {
      matchedSchool = allSchools.find(s => s.id === student.schoolId);
    }
    if (!matchedSchool && student?.school) {
      matchedSchool = allSchools.find(s => s.id === student.school || s.name === student.school);
    }
    const currentUser = authService.getCurrentUser();
    if (!matchedSchool && currentUser?.school) {
      matchedSchool = allSchools.find(s => s.id === currentUser.school || s.name === currentUser.school);
    }
    if (!matchedSchool && allSchools.length > 0) {
      matchedSchool = allSchools[0];
    }

    const schoolTableName = matchedSchool ? (matchedSchool.name || matchedSchool.nameKm || '') : '';
    const schoolTableProvince = matchedSchool?.province || 
                                (matchedSchool?.address ? matchedSchool.address.split(',').pop().trim() : '') || 
                                student?.birthProvince || 
                                student?.currentProvince || 
                                '';

    const schoolKm = schoolTableName || (await SettingsService.get('school_name_km')) || 'សាលារៀន';
    const schoolEn = (matchedSchool?.nameEn) || (await SettingsService.get('school_name_en')) || 'School';
    const province = schoolTableProvince || (await SettingsService.get('school_province')) || '';

    const allSubjects = await this.resolvePlanSubjects(targetClass);
    const hiddenSubjectIds = await this.getHiddenSubjectIds(classId, allSubjects);
    const subjects = allSubjects.filter(sub => {
      const sId = sub.id || sub.code || sub.name;
      return !hiddenSubjectIds.includes(sId) && !hiddenSubjectIds.includes(sub.id) && !hiddenSubjectIds.includes(sub.code);
    });

    // Filter scores belonging to this student for this academic year
    const studentIdSet = new Set([studentId, rawStudent?.id, rawStudent?.studentId].filter(Boolean));
    const normYear = (y) => String(y || '').replace(/[–—−]/g, '-').trim();
    const activeYearNorm = normYear(academicYear);

    const studentScores = (allScores || []).filter(s => {
      const matchStd = studentIdSet.has(s.studentId);
      const matchYr = !activeYearNorm || !s.academicYear || normYear(s.academicYear) === activeYearNorm;
      return matchStd && matchYr;
    });

    const saved = savedPlanRecord || {};
    const savedBaseline = saved.baseline || {};
    const savedTargets = saved.targets || {};
    const savedActuals = saved.actuals || {};
    const savedFinalTarget = saved.targetFinal || {};
    const savedFinalActual = saved.actualFinal || {};

    const matchSubject = (targetSub, sc) => {
      if (!sc || !targetSub) return false;
      const scSubId = sc.subjectId !== undefined ? String(sc.subjectId).trim() : '';
      const targetSubId = targetSub.id !== undefined ? String(targetSub.id).trim() : '';
      const targetCode = targetSub.code !== undefined ? String(targetSub.code).trim() : '';
      const scCode = sc.subjectCode !== undefined ? String(sc.subjectCode).trim() : '';

      if (scSubId && targetSubId && scSubId === targetSubId) return true;
      if (scCode && targetCode && scCode === targetCode) return true;
      if (scSubId && targetCode && scSubId === targetCode) return true;
      if (scCode && targetSubId && scCode === targetSubId) return true;

      const scNameKm = (sc.subjectNameKm || sc.subjectName || '').trim();
      const targetName = (targetSub.name || targetSub.nameKm || '').trim();
      if (scNameKm && targetName && scNameKm.toLowerCase() === targetName.toLowerCase()) return true;

      const scNameEn = (sc.subjectNameEn || '').trim().toLowerCase();
      const targetNameEn = (targetSub.nameEn || '').trim().toLowerCase();
      if (scNameEn && targetNameEn && scNameEn === targetNameEn) return true;

      return false;
    };

    const isFirstTestPeriod = (sc) => {
      if (!sc) return false;
      const m = String(sc.month || '').trim().toLowerCase();
      const a = String(sc.assessmentType || '').trim().toLowerCase();
      return m === 'first test' || a === 'first test' ||
             m === 'តេស្តដើមឆ្នាំ' || a === 'តេស្តដើមឆ្នាំ' ||
             m.includes('ដើមឆ្នាំ') || a.includes('ដើមឆ្នាំ') ||
             m === 'first_test' || a === 'first_test';
    };

    const getScoreValue = (sc) => {
      if (!sc) return '';
      const val = sc.totalScore ?? sc.examScore ?? sc.score ?? sc.assignmentScore;
      return (val !== null && val !== undefined && String(val).trim() !== '') ? String(val).trim() : '';
    };

    const colPeriods = await this.getColumnPeriods(classId);

    const configuredPlanMonths = PLAN_MONTHS.map(m => {
      const activePeriodId = colPeriods ? colPeriods[m.key] : null;
      const isChosen = Boolean(activePeriodId);
      const periodInfo = isChosen ? (ALL_EVALUATION_PERIODS.find(p => p.id === activePeriodId || p.nameKm === activePeriodId) || {
        id: activePeriodId,
        nameKm: activePeriodId
      }) : null;
      const periodNameKm = isChosen ? (periodInfo.nameKm || activePeriodId) : '';
      const headerLabel = isChosen ? `${m.labelKm}\n(${periodNameKm})` : m.labelKm;
      return {
        key: m.key,
        id: activePeriodId,
        isChosen,
        periodNameKm,
        nameKm: isChosen ? periodInfo.nameKm : (m.nameKm || m.labelKm),
        labelKm: m.labelKm,
        headerLabel
      };
    });

    const matchPeriodScore = (sc, targetSub, targetPeriodId) => {
      if (!sc || !targetSub || !targetPeriodId) return false;
      if (!matchSubject(targetSub, sc)) return false;

      const pNorm = String(targetPeriodId).trim().toLowerCase();
      const m = String(sc.month || '').trim().toLowerCase();
      const a = String(sc.assessmentType || '').trim().toLowerCase();

      if (m === pNorm || a === pNorm) return true;

      const ep = ALL_EVALUATION_PERIODS.find(p => 
        p.id.toLowerCase() === pNorm || 
        p.nameKm.toLowerCase() === pNorm || 
        (p.nameEn && p.nameEn.toLowerCase() === pNorm)
      );
      if (ep) {
        if (m === ep.id.toLowerCase() || a === ep.id.toLowerCase()) return true;
        if (m === ep.nameKm.toLowerCase() || a === ep.nameKm.toLowerCase()) return true;
        if (ep.nameEn && (m === ep.nameEn.toLowerCase() || a === ep.nameEn.toLowerCase())) return true;
      }

      if (pNorm.includes('semester 1') || pNorm.includes('ឆមាសទី១') || pNorm.includes('ឆមាស១')) {
        if (m.includes('semester 1') || a.includes('semester 1') || m.includes('ឆមាសទី១') || a.includes('ឆមាសទី១') || m.includes('ឆមាស១') || a.includes('ឆមាស១')) {
          return true;
        }
      }

      if (pNorm.includes('semester 2') || pNorm.includes('ឆមាសទី២') || pNorm.includes('ឆមាស២')) {
        if (m.includes('semester 2') || a.includes('semester 2') || m.includes('ឆមាសទី២') || a.includes('ឆមាសទី២') || m.includes('ឆមាស២') || a.includes('ឆមាស២')) {
          return true;
        }
      }

      return false;
    };

    const isSemester1Score = (sc, targetSub) => {
      if (!sc || !matchSubject(targetSub, sc)) return false;
      const m = String(sc.month || '').trim().toLowerCase();
      const a = String(sc.assessmentType || '').trim().toLowerCase();
      return m.includes('semester 1') || a.includes('semester 1') ||
             m.includes('semester1') || a.includes('semester1') ||
             m.includes('ឆមាសទី១') || a.includes('ឆមាសទី១') ||
             m.includes('ឆមាស១') || a.includes('ឆមាស១');
    };

    const isSemester2Score = (sc, targetSub) => {
      if (!sc || !matchSubject(targetSub, sc)) return false;
      const m = String(sc.month || '').trim().toLowerCase();
      const a = String(sc.assessmentType || '').trim().toLowerCase();
      return m.includes('semester 2') || a.includes('semester 2') ||
             m.includes('semester2') || a.includes('semester2') ||
             m.includes('ឆមាសទី២') || a.includes('ឆមាសទី២') ||
             m.includes('ឆមាស២') || a.includes('ឆមាស២');
    };

    const extractGrade = (sc, subItem) => {
      if (!sc) return 'F';
      if (sc.grade && /^[A-F]$/i.test(String(sc.grade).trim())) {
        return String(sc.grade).trim().toUpperCase();
      }
      const raw = getScoreValue(sc);
      if (raw !== '') {
        const num = Number(raw) || 0;
        const fullScore = sc.fullScore || SubjectService.getSubjectFullScore(subItem, targetClass?.name || 'G7') || subItem.fullScore || 50;
        return SubjectService.calculateGrade(num, fullScore).grade || 'F';
      }
      return 'F';
    };

    // Build subject rows
    const subjectRows = subjects.map(sub => {
      const subId = sub.id || sub.code || sub.name;
      const subName = sub.name || sub.nameKm || sub.nameEn || '';

      // Baseline: Beginning of year score (First Test)
      let baselineScore = '0';
      let baselineGrade = 'F';

      let customBaseline = savedBaseline[subId];
      if (customBaseline !== undefined && customBaseline !== null && String(customBaseline).trim() !== '') {
        const strVal = String(customBaseline).trim();
        const parts = strVal.split(/[,/ ]+/);
        if (parts.length >= 2 && /[A-F]$/i.test(parts[parts.length - 1])) {
          baselineGrade = parts[parts.length - 1].toUpperCase();
          baselineScore = parts.slice(0, -1).join(' ').trim() || '0';
        } else if (/[A-F]$/i.test(strVal)) {
          baselineGrade = strVal.toUpperCase();
          baselineScore = '0';
        } else {
          baselineScore = strVal;
          const num = Number(strVal) || 0;
          const fullScore = SubjectService.getSubjectFullScore(sub, targetClass?.name || 'G7') || sub.fullScore || 50;
          baselineGrade = SubjectService.calculateGrade(num, fullScore).grade;
        }
      } else {
        const firstTestMatch = studentScores.find(s => isFirstTestPeriod(s) && matchSubject(sub, s));
        if (firstTestMatch) {
          const rawScore = getScoreValue(firstTestMatch);
          if (rawScore !== '') {
            baselineScore = rawScore;
            const num = Number(rawScore) || 0;
            const fullScore = firstTestMatch.fullScore || SubjectService.getSubjectFullScore(sub, targetClass?.name || 'G7') || sub.fullScore || 50;
            baselineGrade = firstTestMatch.grade || SubjectService.calculateGrade(num, fullScore).grade;
          } else {
            baselineScore = '0';
            baselineGrade = 'F';
          }
        } else {
          baselineScore = '0';
          baselineGrade = 'F';
        }
      }

      const baseline = `${baselineScore} , ${baselineGrade}`;

      // Dynamic Target Chaining:
      // If user hasn't chosen a month for a column, don't show any value (target: '', actual: '').
      // Month 1 target is 1 grade higher than baselineGrade (e.g. F -> E).
      // Month 2 target is obtained from Month 1 actual grade (ជាក់ស្តែង) and uppered 1 step.
      // Subsequent months chain from the immediate previous month's actual grade.
      const months = [];
      for (let colIdx = 0; colIdx < configuredPlanMonths.length; colIdx++) {
        const m = configuredPlanMonths[colIdx];

        if (!m.isChosen || !m.id) {
          months.push({
            key: m.key,
            id: null,
            isChosen: false,
            nameKm: m.nameKm,
            labelKm: m.labelKm,
            headerLabel: m.headerLabel,
            target: '',
            actual: ''
          });
          continue;
        }

        // Actual grade from scores store for this column's period
        let actualGrade = '';
        if (m.id) {
          const match = studentScores.find(s => matchPeriodScore(s, sub, m.id));
          if (match) {
            actualGrade = extractGrade(match, sub);
          } else {
            actualGrade = 'F';
          }
        }

        const manualActual = savedActuals[subId]?.[m.key];
        if (manualActual !== undefined && manualActual !== null && String(manualActual).trim() !== '') {
          actualGrade = String(manualActual).trim().toUpperCase();
        }

        // Don't let column ជាក់ស្តែង empty: if user has not input score yet but choose month already, show grade F
        if (!actualGrade) {
          actualGrade = 'F';
        }

        // Target grade calculation:
        let targetGrade = '';
        if (colIdx === 0) {
          targetGrade = getUpperGrade(baselineGrade);
        } else {
          // Month 2 (and onwards) gets grade from previous month's actual (ជាក់ស្តែង) and uppers it
          const prevCol = months[colIdx - 1];
          const prevActual = prevCol?.actual;
          if (prevActual) {
            targetGrade = getUpperGrade(prevActual);
          } else {
            targetGrade = '';
          }
        }

        const manualTarget = savedTargets[subId]?.[m.key];
        if (manualTarget !== undefined && manualTarget !== null && String(manualTarget).trim() !== '') {
          targetGrade = String(manualTarget).trim().toUpperCase();
        }

        months.push({
          key: m.key,
          id: m.id,
          isChosen: true,
          periodNameKm: m.periodNameKm,
          nameKm: m.nameKm,
          labelKm: m.labelKm,
          headerLabel: m.headerLabel,
          target: targetGrade,
          actual: actualGrade
        });
      }

      // 1. Target Final & Actual Final in កម្រិតពិន្ទុចុងឆ្នាំ:
      // Do not show any value in កម្រិតពិន្ទុចុងឆ្នាំ when columns starting from ខែ១ are not selected yet
      const chosenMonths = months.filter(m => m.isChosen);
      let targetFinal = '';
      let actualFinalScore = '';
      let actualFinalGrade = '';
      let actualFinalText = '';

      if (chosenMonths.length > 0) {
        // Target Final: Get grade from the last month teacher chose (e.g. month 7 or 8) and upper it 1 grade.
        const lastChosenMonth = chosenMonths[chosenMonths.length - 1];
        const baseGrade = lastChosenMonth.actual || lastChosenMonth.target;
        if (baseGrade) {
          targetFinal = getUpperGrade(baseGrade);
        }

        const manualTargetFinal = savedFinalTarget[subId];
        if (manualTargetFinal !== undefined && manualTargetFinal !== null && String(manualTargetFinal).trim() !== '') {
          targetFinal = String(manualTargetFinal).trim().toUpperCase();
        }

        // Actual Final: Score in semester exam 1 + score in semester exam 2 / 2, with grade formatted as "score , grade" (e.g. "25 , E")
        const s1Match = studentScores.find(s => isSemester1Score(s, sub));
        const s2Match = studentScores.find(s => isSemester2Score(s, sub));

        const s1Raw = s1Match ? getScoreValue(s1Match) : '';
        const s2Raw = s2Match ? getScoreValue(s2Match) : '';

        const s1Num = s1Raw !== '' ? Number(s1Raw) : null;
        const s2Num = s2Raw !== '' ? Number(s2Raw) : null;

        if (s1Num !== null && s2Num !== null) {
          const avg = (s1Num + s2Num) / 2;
          actualFinalScore = Number.isInteger(avg) ? String(avg) : String(Math.round(avg * 10) / 10);
        } else if (s1Num !== null && s2Num === null) {
          actualFinalScore = Number.isInteger(s1Num) ? String(s1Num) : String(Math.round(s1Num * 10) / 10);
        } else if (s1Num === null && s2Num !== null) {
          actualFinalScore = Number.isInteger(s2Num) ? String(s2Num) : String(Math.round(s2Num * 10) / 10);
        } else {
          actualFinalScore = '0';
        }

        const fullScore = s2Match?.fullScore || s1Match?.fullScore || SubjectService.getSubjectFullScore(sub, targetClass?.name || 'G7') || sub.fullScore || 50;
        actualFinalGrade = SubjectService.calculateGrade(Number(actualFinalScore) || 0, fullScore).grade || 'F';
        actualFinalText = `${actualFinalScore} , ${actualFinalGrade}`;

        const manualActualFinal = savedFinalActual[subId];
        if (manualActualFinal !== undefined && manualActualFinal !== null && String(manualActualFinal).trim() !== '') {
          const strVal = String(manualActualFinal).trim();
          const parts = strVal.split(/[,/ ]+/);
          if (parts.length >= 2 && /[A-F]$/i.test(parts[parts.length - 1])) {
            actualFinalGrade = parts[parts.length - 1].toUpperCase();
            actualFinalScore = parts.slice(0, -1).join(' ').trim() || actualFinalScore;
            actualFinalText = `${actualFinalScore} , ${actualFinalGrade}`;
          } else if (/[A-F]$/i.test(strVal)) {
            actualFinalGrade = strVal.toUpperCase();
            actualFinalText = actualFinalScore ? `${actualFinalScore} , ${actualFinalGrade}` : actualFinalGrade;
          } else {
            actualFinalScore = strVal;
            const fullScore = SubjectService.getSubjectFullScore(sub, targetClass?.name || 'G7') || sub.fullScore || 50;
            actualFinalGrade = SubjectService.calculateGrade(Number(strVal) || 0, fullScore).grade || 'F';
            actualFinalText = `${actualFinalScore} , ${actualFinalGrade}`;
          }
        }
      }

      return {
        id: subId,
        code: sub.code || '',
        name: subName,
        baseline,
        baselineScore,
        baselineGrade,
        months,
        targetFinal,
        actualFinal: actualFinalText,
        actualFinalScore,
        actualFinalGrade
      };
    });

    const fatherName = saved.fatherName || student?.fatherName || '';
    const fatherPhone = saved.fatherPhone || student?.fatherPhone || student?.parentPhone || '';
    const motherName = saved.motherName || student?.motherName || '';
    const motherPhone = saved.motherPhone || student?.motherPhone || '';
    const parentName = saved.parentName ||
                       [fatherName, motherName].filter(Boolean).join(' / ') ||
                       student?.guardian ||
                       '';
    const parentPhone = saved.parentPhone ||
                        fatherPhone ||
                        motherPhone ||
                        '';
    const teacherName = saved.teacherName || teacher.name || '';
    const teacherPhone = saved.teacherPhone || teacher.phone || '';
    const familyStatus = saved.familyStatus || student?.familyStatus || student?.notes || '';
    // School name strictly from school table
    let schoolNameFinal = schoolTableName;
    if (!schoolNameFinal) {
      schoolNameFinal = (saved.schoolName && !saved.schoolName.includes('PineAPPleSMS')) 
        ? saved.schoolName 
        : (schoolKm || 'សាលារៀន');
    }
    const provinceFinal = schoolTableProvince || saved.province || province;

    return {
      class: {
        id: targetClass.id,
        name: targetClass.name,
        grade: targetClass.grade || targetClass.name,
        educationLevelText: this.getEducationLevelText(targetClass.name)
      },
      student: {
        id: student?.id || studentId,
        studentId: student?.studentId || studentId,
        khmerName: student?.khmerName || '',
        englishName: student?.englishName || '',
        gender: (student?.gender === 'Female' || student?.gender === 'ស្រី' || student?.gender === 'F') ? 'ស្រី' : 'ប្រុស',
        familyStatus,
        fatherName,
        fatherPhone,
        motherName,
        motherPhone,
        parentName,
        parentPhone
      },
      teacher: {
        name: teacherName,
        phone: teacherPhone
      },
      school: {
        nameKm: schoolNameFinal,
        nameEn: schoolEn,
        province: provinceFinal
      },
      academicYear: academicYear || targetClass.academicYear || '2023–2024',
      months: configuredPlanMonths,
      subjects: subjectRows,
      allAvailableSubjects: allSubjects,
      hiddenSubjectIds: hiddenSubjectIds,
      reportDate: saved.reportDate || new Date().toISOString().split('T')[0]
    };
  },

  /**
   * Load saved plan record from DB or localStorage
   */
  async loadSavedPlanRecord(academicYear, classId, studentId) {
    const planKey = `student_plan_${academicYear}_${classId}_${studentId}`;
    try {
      const record = await db.get('report_settings', planKey);
      if (record) {
        if (record.value && typeof record.value === 'string') {
          try {
            return JSON.parse(record.value);
          } catch (_) {}
        }
        return record;
      }
    } catch (err) {
      console.warn('Failed to query report_settings store:', err);
    }

    try {
      const rawLocal = localStorage.getItem(planKey);
      if (rawLocal) return JSON.parse(rawLocal);
    } catch (_) {}

    return null;
  },

  /**
   * Save student plan changes to IndexedDB and localStorage
   */
  async saveStudentPlan(classId, studentId, academicYear, planPayload) {
    if (!classId || !studentId) return;
    const planKey = `student_plan_${academicYear}_${classId}_${studentId}`;

    const record = {
      id: planKey,
      key: planKey,
      type: 'student_plan',
      description: `Student plan for ${studentId} (${classId})`,
      value: JSON.stringify(planPayload),
      updatedAt: new Date().toISOString(),
      ...planPayload
    };

    try {
      await db.put('report_settings', record);
    } catch (err) {
      console.warn('Error saving plan to report_settings store:', err);
    }

    try {
      localStorage.setItem(planKey, JSON.stringify(record));
    } catch (_) {}

    return record;
  }
};
