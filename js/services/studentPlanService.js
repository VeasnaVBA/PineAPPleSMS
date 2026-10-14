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
    const studentScores = (allScores || []).filter(s => 
      s.studentId === studentId && 
      (!s.academicYear || !academicYear || s.academicYear === academicYear)
    );

    const saved = savedPlanRecord || {};
    const savedBaseline = saved.baseline || {};
    const savedTargets = saved.targets || {};
    const savedActuals = saved.actuals || {};
    const savedFinalTarget = saved.targetFinal || {};
    const savedFinalActual = saved.actualFinal || {};

    // Build subject rows
    const subjectRows = subjects.map(sub => {
      const subId = sub.id || sub.code || sub.name;
      const subName = sub.name || sub.nameKm || sub.nameEn || '';

      const baseline = savedBaseline[subId] ?? '';

      const months = PLAN_MONTHS.map(m => {
        const targetVal = savedTargets[subId]?.[m.key] ?? '';

        // Match actual score from database if not explicitly overridden
        let actualVal = savedActuals[subId]?.[m.key];
        let isOverridden = false;

        if (actualVal !== undefined && actualVal !== null && actualVal !== '') {
          isOverridden = true;
        } else {
          // Find matching score from scores store
          const match = studentScores.find(s => {
            const matchSub = (s.subjectId === sub.id) ||
                             (s.subjectNameKm && s.subjectNameKm.trim() === subName.trim()) ||
                             (s.subjectNameEn && sub.nameEn && s.subjectNameEn.trim() === sub.nameEn.trim());
            const matchMonth = (s.month === m.id) || 
                               (s.assessmentType === m.id) || 
                               (s.month === m.nameKm) || 
                               (s.assessmentType === m.nameKm);
            return matchSub && matchMonth;
          });

          if (match) {
            const rawScore = match.totalScore ?? match.examScore;
            actualVal = (rawScore !== null && rawScore !== undefined) ? String(rawScore) : '';
          } else {
            actualVal = '';
          }
        }

        return {
          key: m.key,
          id: m.id,
          nameKm: m.nameKm,
          labelKm: m.labelKm,
          target: targetVal,
          actual: actualVal,
          isOverridden
        };
      });

      // Compute or retrieve end-of-year target and actual
      const targetFinal = savedFinalTarget[subId] ?? '';
      let actualFinal = savedFinalActual[subId];

      if (actualFinal === undefined || actualFinal === null || actualFinal === '') {
        // Average of filled actual monthly scores
        const validScores = months
          .map(m => parseFloat(m.actual))
          .filter(n => !isNaN(n) && n > 0);
        if (validScores.length > 0) {
          const sum = validScores.reduce((acc, v) => acc + v, 0);
          actualFinal = (sum / validScores.length).toFixed(1).replace(/\.0$/, '');
        } else {
          actualFinal = '';
        }
      }

      return {
        id: subId,
        code: sub.code || '',
        name: subName,
        baseline,
        months,
        targetFinal,
        actualFinal
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
