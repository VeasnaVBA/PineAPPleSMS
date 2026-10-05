/**
 * Subject Management Service
 * Manages school curriculum subjects, max scores per grade level (G7-G12), and weekly credit hours.
 * Includes Grade Detection from Classroom Names (e.g. 7A -> G7) and MoEYS Standard Grading Scale (A-F).
 * Persists data in the isolated user workspace IndexedDB (`subjects` store).
 */

import { db } from '../database/db.js';
import { SettingsService } from './settingsService.js';
import { syncStateManager } from './syncStateManager.js';

export const GRADES = ['G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

export const DEFAULT_SUBJECTS = [
  {
    id: 'sub_dictation',
    code: 'SUB-101',
    name: 'សរសេរតាមអាន',
    nameEn: 'Dictation',
    creditHours: 2,
    maxScore: 40,
    scoreByGrade: { G7: 40, G8: 40, G9: 40, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_essay',
    code: 'SUB-102',
    name: 'តែងសេចក្តី',
    nameEn: 'Essay Writing',
    creditHours: 2,
    maxScore: 60,
    scoreByGrade: { G7: 60, G8: 60, G9: 60, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_khmer_lit',
    code: 'SUB-103',
    name: 'ភាសាខ្មែរ',
    nameEn: 'Khmer Literature',
    creditHours: 4,
    maxScore: 100,
    scoreByGrade: { G7: 100, G8: 100, G9: 100, G10: 100, G11: 100, G12: 100 },
    notes: 'មុខវិជ្ជាស្នូល'
  },
  {
    id: 'sub_math',
    code: 'SUB-104',
    name: 'គណិតវិទ្យា',
    nameEn: 'Mathematics',
    creditHours: 6,
    maxScore: 100,
    scoreByGrade: { G7: 100, G8: 100, G9: 100, G10: 100, G11: 100, G12: 100 },
    notes: 'មុខវិជ្ជាស្នូល'
  },
  {
    id: 'sub_physics',
    code: 'SUB-105',
    name: 'រូបវិទ្យា',
    nameEn: 'Physics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 35, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_chemistry',
    code: 'SUB-106',
    name: 'គីមីវិទ្យា',
    nameEn: 'Chemistry',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 25, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_biology',
    code: 'SUB-107',
    name: 'ជីវវិទ្យា',
    nameEn: 'Biology',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 35, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_history',
    code: 'SUB-108',
    name: 'ប្រវត្តិវិទ្យា',
    nameEn: 'History',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 33, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_geography',
    code: 'SUB-109',
    name: 'ភូមិវិទ្យា',
    nameEn: 'Geography',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 33, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_morals',
    code: 'SUB-110',
    name: 'សីលធម៌-ពលរដ្ឋវិទ្យា',
    nameEn: 'Moral & Civics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 34, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_earth_science',
    code: 'SUB-111',
    name: 'ផែនដីវិទ្យា',
    nameEn: 'Earth Science',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 35, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_ict',
    code: 'SUB-112',
    name: 'ព័ត៌មានវិទ្យា',
    nameEn: 'Information Technology',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_foreign_lang',
    code: 'SUB-113',
    name: 'ភាសាបរទេស (អង់គ្លេស)',
    nameEn: 'English Language',
    creditHours: 4,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_pe',
    code: 'SUB-114',
    name: 'អប់រំកាយ និងកីឡា',
    nameEn: 'Physical Education',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_life_skills',
    code: 'SUB-115',
    name: 'បំណិនជីវិត',
    nameEn: 'Life Skills',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_arts',
    code: 'SUB-116',
    name: 'សិល្បៈ',
    nameEn: 'Arts & Music',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_economics',
    code: 'SUB-117',
    name: 'សេដ្ឋកិច្ច',
    nameEn: 'Economics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_home_ec',
    code: 'SUB-118',
    name: 'គេហវិជ្ជា',
    nameEn: 'Home Economics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  },
  {
    id: 'sub_agriculture',
    code: 'SUB-119',
    name: 'កសិកម្ម',
    nameEn: 'Agriculture',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 50, G11: 50, G12: 50 },
    notes: ''
  }
];

export const SubjectService = {
  /**
   * Extract Grade code (G7 - G12) from Classroom Name or Grade string
   * Examples: '7A' -> 'G7', '8-1' -> 'G8', 'ថ្នាក់ទី ៩ក' -> 'G9', '12A1' -> 'G12'
   */
  extractGradeFromClassName(className) {
    if (!className) return 'G7';
    const str = String(className).trim();

    // Convert Khmer numerals to Western Arabic digits
    const khmerNumMap = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };
    const normalized = str.replace(/[០-៩]/g, d => khmerNumMap[d] || d);

    // Direct check G7-G12
    const gMatch = normalized.match(/G\s*(1[0-2]|[7-9])/i);
    if (gMatch) return `G${gMatch[1]}`;

    // Match leading or isolated numbers 7, 8, 9, 10, 11, 12
    const numMatch = normalized.match(/(?:grade|ថ្នាក់ទី|ថ្នាក់)?\s*(1[0-2]|[7-9])/i);
    if (numMatch) return `G${numMatch[1]}`;

    return 'G7';
  },

  /**
   * Get subject full score for a specific classroom or grade level
   */
  getSubjectFullScore(subject, classNameOrGrade = 'G7') {
    if (!subject) return 100;
    const gradeKey = classNameOrGrade.startsWith('G') 
      ? classNameOrGrade 
      : this.extractGradeFromClassName(classNameOrGrade);

    if (subject.scoreByGrade && subject.scoreByGrade[gradeKey] !== undefined) {
      const val = Number(subject.scoreByGrade[gradeKey]);
      return !isNaN(val) && val >= 0 ? val : (subject.maxScore || 100);
    }
    return Number(subject.maxScore) > 0 ? Number(subject.maxScore) : 100;
  },

  /**
   * Calculate Letter Grade (A, B, C, D, E, F) and details based on score and full score
   * Formula:
   *  A: >= 85% of full score (ល្អប្រសើរ)
   *  B: >= 80% and < 85% of full score (ល្អណាស់)
   *  C: >= 70% and < 80% of full score (ល្អ)
   *  D: >= 60% and < 70% of full score (ល្អបង្គួរ)
   *  E: >= 50% and < 60% of full score (មធ្យម)
   *  F: < 50% of full score (< S/2) (ធ្លាក់ / ខ្សោយ)
   */
  calculateGrade(score, fullScore = 100) {
    const s = Number(score) || 0;
    const fs = Number(fullScore) > 0 ? Number(fullScore) : 100;
    const percentage = Math.max(0, (s / fs) * 100);

    if (percentage >= 85) {
      return { grade: 'A', labelKm: 'ល្អប្រសើរ', labelEn: 'Excellent', color: 'emerald', percentage };
    }
    if (percentage >= 80) {
      return { grade: 'B', labelKm: 'ល្អណាស់', labelEn: 'Very Good', color: 'blue', percentage };
    }
    if (percentage >= 70) {
      return { grade: 'C', labelKm: 'ល្អ', labelEn: 'Good', color: 'indigo', percentage };
    }
    if (percentage >= 60) {
      return { grade: 'D', labelKm: 'ល្អបង្គួរ', labelEn: 'Fair / Satisfactory', color: 'amber', percentage };
    }
    if (percentage >= 50) {
      return { grade: 'E', labelKm: 'មធ្យម', labelEn: 'Passing / Average', color: 'orange', percentage };
    }
    return { grade: 'F', labelKm: 'ខ្សោយ (ធ្លាក់)', labelEn: 'Needs Improvement / Fail', color: 'rose', percentage };
  },

  /**
   * Get Grading Scale Ranges for a given full score (for preview & UI documentation)
   */
  getGradingScaleSummary(fullScore = 100) {
    const fs = Number(fullScore) > 0 ? Number(fullScore) : 100;
    const round1 = num => Math.round(num * 10) / 10;

    return [
      { grade: 'A', labelKm: 'ល្អប្រសើរ', labelEn: 'Excellent', percentRange: '85% - 100%', minScore: round1(fs * 0.85), maxScore: fs, color: 'emerald' },
      { grade: 'B', labelKm: 'ល្អណាស់', labelEn: 'Very Good', percentRange: '80% - 84.9%', minScore: round1(fs * 0.80), maxScore: round1(fs * 0.849), color: 'blue' },
      { grade: 'C', labelKm: 'ល្អ', labelEn: 'Good', percentRange: '70% - 79.9%', minScore: round1(fs * 0.70), maxScore: round1(fs * 0.799), color: 'indigo' },
      { grade: 'D', labelKm: 'ល្អបង្គួរ', labelEn: 'Satisfactory', percentRange: '60% - 69.9%', minScore: round1(fs * 0.60), maxScore: round1(fs * 0.699), color: 'amber' },
      { grade: 'E', labelKm: 'មធ្យម', labelEn: 'Passing', percentRange: '50% - 59.9%', minScore: round1(fs * 0.50), maxScore: round1(fs * 0.599), color: 'orange' },
      { grade: 'F', labelKm: 'ខ្សោយ (ធ្លាក់)', labelEn: 'Fail', percentRange: '< 50%', minScore: 0, maxScore: round1(fs * 0.499), color: 'rose' }
    ];
  },

  /**
   * Helper to normalize scoreByGrade object
   */
  normalizeScoreByGrade(data, defaultScore = 100) {
    const res = {};
    const fallback = Number(defaultScore) > 0 ? Number(defaultScore) : 100;
    GRADES.forEach(g => {
      if (data && data[g] !== undefined && data[g] !== null && data[g] !== '') {
        const val = Number(data[g]);
        res[g] = !isNaN(val) && val >= 0 ? val : fallback;
      } else {
        res[g] = fallback;
      }
    });
    return res;
  },

  /**
   * Generate next Subject Code (e.g. SUB-120)
   */
  async generateCode() {
    const subjects = await this.getAll();
    const existingCodes = new Set(subjects.map(s => String(s.code || '').toUpperCase()));
    let nextNum = subjects.length + 101;
    let code = `SUB-${nextNum}`;
    while (existingCodes.has(code)) {
      nextNum++;
      code = `SUB-${nextNum}`;
    }
    return code;
  },

  /**
   * Get all subjects with auto-seeding if newly initialized
   */
  async getAll() {
    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        const list = await db.getAll('subjects');
        if (Array.isArray(list) && list.length > 0) {
          return list.map(s => ({
            ...s,
            scoreByGrade: this.normalizeScoreByGrade(s.scoreByGrade, s.maxScore || 100)
          }));
        }

        // Auto-seed default MoEYS standard subjects
        for (const item of DEFAULT_SUBJECTS) {
          try {
            await db.add('subjects', {
              ...item,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } catch (_) {}
        }
        const seededList = await db.getAll('subjects');
        if (Array.isArray(seededList) && seededList.length > 0) {
          return seededList.map(s => ({
            ...s,
            scoreByGrade: this.normalizeScoreByGrade(s.scoreByGrade, s.maxScore || 100)
          }));
        }
      }
    } catch (err) {
      console.warn('Subjects store access notice, falling back:', err);
    }

    // Fallback using settings store
    try {
      const stored = await SettingsService.get('subjects_catalog');
      if (Array.isArray(stored) && stored.length > 0) {
        return stored.map(s => ({
          ...s,
          scoreByGrade: this.normalizeScoreByGrade(s.scoreByGrade, s.maxScore || 100)
        }));
      }
      await SettingsService.set('subjects_catalog', DEFAULT_SUBJECTS);
      return DEFAULT_SUBJECTS;
    } catch (_) {}

    return DEFAULT_SUBJECTS;
  },

  /**
   * Get subject by ID or Code
   */
  async getById(idOrCode) {
    if (!idOrCode) return null;
    const list = await this.getAll();
    return list.find(s => s.id === idOrCode || s.code === idOrCode || s.name === idOrCode) || null;
  },

  /**
   * Create a new subject
   */
  async create(data) {
    if (!data || !data.name?.trim()) {
      throw new Error('សូមបញ្ចូលឈ្មោះមុខវិជ្ជា (Subject Name is required).');
    }

    const cleanName = data.name.trim();
    let cleanCode = (data.code || '').trim().toUpperCase();
    if (!cleanCode) {
      cleanCode = await this.generateCode();
    }

    const subjects = await this.getAll();
    const duplicate = subjects.find(s => s.code?.toUpperCase() === cleanCode);
    if (duplicate) {
      throw new Error(`កូដមុខវិជ្ជា "${cleanCode}" មានរួចហើយ (Subject code already exists).`);
    }

    const maxScore = Number(data.maxScore) > 0 ? Number(data.maxScore) : 100;
    const scoreByGrade = this.normalizeScoreByGrade(data.scoreByGrade, maxScore);

    const now = new Date().toISOString();
    const newSubject = {
      id: data.id || ('sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      code: cleanCode,
      name: cleanName,
      nameEn: data.nameEn?.trim() || '',
      maxScore,
      scoreByGrade,
      creditHours: Number(data.creditHours) > 0 ? Number(data.creditHours) : 2,
      notes: data.notes?.trim() || '',
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        await db.add('subjects', newSubject);
      }
    } catch (err) {
      console.warn('Could not add subject to IndexedDB:', err);
    }

    try {
      const updatedList = [...subjects, newSubject];
      await SettingsService.set('subjects_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('subjects.create');
    return newSubject;
  },

  /**
   * Update an existing subject
   */
  async update(id, data) {
    if (!id) throw new Error('Subject ID is required for update.');
    const subjects = await this.getAll();
    const existing = subjects.find(s => s.id === id || s.code === id);
    if (!existing) {
      throw new Error('រកមិនឃើញមុខវិជ្ជា (Subject not found).');
    }

    const cleanName = (data.name !== undefined ? data.name : existing.name).trim();
    if (!cleanName) {
      throw new Error('សូមបញ្ចូលឈ្មោះមុខវិជ្ជា (Subject Name is required).');
    }

    const cleanCode = (data.code !== undefined ? data.code : existing.code).trim().toUpperCase();
    const duplicate = subjects.find(s => s.id !== existing.id && s.code?.toUpperCase() === cleanCode);
    if (duplicate) {
      throw new Error(`កូដមុខវិជ្ជា "${cleanCode}" ត្រូវបានប្រើប្រាស់រួចហើយ (Subject code is already used).`);
    }

    const maxScore = data.maxScore !== undefined && Number(data.maxScore) > 0 ? Number(data.maxScore) : existing.maxScore;
    const scoreByGrade = this.normalizeScoreByGrade(data.scoreByGrade !== undefined ? data.scoreByGrade : existing.scoreByGrade, maxScore);

    const updatedSubject = {
      ...existing,
      code: cleanCode,
      name: cleanName,
      nameEn: data.nameEn !== undefined ? data.nameEn.trim() : (existing.nameEn || ''),
      maxScore,
      scoreByGrade,
      creditHours: data.creditHours !== undefined && Number(data.creditHours) > 0 ? Number(data.creditHours) : existing.creditHours,
      notes: data.notes !== undefined ? data.notes.trim() : (existing.notes || ''),
      updatedAt: new Date().toISOString()
    };

    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        await db.put('subjects', updatedSubject);
      }
    } catch (err) {
      console.warn('Could not update subject in IndexedDB:', err);
    }

    try {
      const updatedList = subjects.map(s => s.id === existing.id ? updatedSubject : s);
      await SettingsService.set('subjects_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('subjects.update');
    return updatedSubject;
  },

  /**
   * Delete a subject
   */
  async delete(id) {
    if (!id) return false;
    const subjects = await this.getAll();
    const target = subjects.find(s => s.id === id || s.code === id);
    if (!target) return false;

    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        await db.delete('subjects', target.id);
      }
    } catch (err) {
      console.warn('Could not delete subject from IndexedDB:', err);
    }

    try {
      const updatedList = subjects.filter(s => s.id !== target.id);
      await SettingsService.set('subjects_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('subjects.delete');
    return true;
  }
};
