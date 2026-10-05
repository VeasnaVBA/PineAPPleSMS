/**
 * Subject Management Service
 * Manages school curriculum subjects, categories, max full scores, and weekly credit hours.
 * Persists data in the isolated user workspace IndexedDB (`subjects` store).
 */

import { db } from '../database/db.js';
import { SettingsService } from './settingsService.js';
import { syncStateManager } from './syncStateManager.js';

export const DEFAULT_SUBJECTS = [
  {
    id: 'sub_khmer_lit',
    code: 'SUB-101',
    name: 'ភាសាខ្មែរ',
    nameEn: 'Khmer Literature',
    category: 'ភាសាខ្មែរ',
    maxScore: 100,
    creditHours: 4,
    notes: 'មុខវិជ្ជាស្នូល'
  },
  {
    id: 'sub_math',
    code: 'SUB-102',
    name: 'គណិតវិទ្យា',
    nameEn: 'Mathematics',
    category: 'វិទ្យាសាស្ត្រពិត',
    maxScore: 100,
    creditHours: 6,
    notes: 'មុខវិជ្ជាស្នូល'
  },
  {
    id: 'sub_physics',
    code: 'SUB-103',
    name: 'រូបវិទ្យា',
    nameEn: 'Physics',
    category: 'វិទ្យាសាស្ត្រពិត',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_chemistry',
    code: 'SUB-104',
    name: 'គីមីវិទ្យា',
    nameEn: 'Chemistry',
    category: 'វិទ្យាសាស្ត្រពិត',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_biology',
    code: 'SUB-105',
    name: 'ជីវវិទ្យា',
    nameEn: 'Biology',
    category: 'វិទ្យាសាស្ត្រពិត',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_history',
    code: 'SUB-106',
    name: 'ប្រវត្តិវិទ្យា',
    nameEn: 'History',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_geography',
    code: 'SUB-107',
    name: 'ភូមិវិទ្យា',
    nameEn: 'Geography',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_morals',
    code: 'SUB-108',
    name: 'សីលធម៌-ពលរដ្ឋវិទ្យា',
    nameEn: 'Moral & Civics',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_earth_science',
    code: 'SUB-109',
    name: 'ផែនដីវិទ្យា',
    nameEn: 'Earth Science',
    category: 'វិទ្យាសាស្ត្រពិត',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_ict',
    code: 'SUB-110',
    name: 'ព័ត៌មានវិទ្យា',
    nameEn: 'Information Technology',
    category: 'បច្ចេកវិទ្យា',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_foreign_lang',
    code: 'SUB-111',
    name: 'ភាសាបរទេស (អង់គ្លេស)',
    nameEn: 'English Language',
    category: 'ភាសាបរទេស',
    maxScore: 50,
    creditHours: 4,
    notes: ''
  },
  {
    id: 'sub_pe',
    code: 'SUB-112',
    name: 'អប់រំកាយ និងកីឡា',
    nameEn: 'Physical Education',
    category: 'កីឡា និងសិល្បៈ',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_life_skills',
    code: 'SUB-113',
    name: 'បំណិនជីវិត',
    nameEn: 'Life Skills',
    category: 'បំណិនជីវិត',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_arts',
    code: 'SUB-114',
    name: 'សិល្បៈ',
    nameEn: 'Arts & Music',
    category: 'កីឡា និងសិល្បៈ',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_economics',
    code: 'SUB-115',
    name: 'សេដ្ឋកិច្ច',
    nameEn: 'Economics',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_home_ec',
    code: 'SUB-116',
    name: 'គេហវិជ្ជា',
    nameEn: 'Home Economics',
    category: 'បំណិនជីវិត',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  },
  {
    id: 'sub_agriculture',
    code: 'SUB-117',
    name: 'កសិកម្ម',
    nameEn: 'Agriculture',
    category: 'បំណិនជីវិត',
    maxScore: 50,
    creditHours: 2,
    notes: ''
  }
];

export const SubjectService = {
  /**
   * Generate next Subject Code (e.g. SUB-118)
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
          return list;
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
          return seededList;
        }
      }
    } catch (err) {
      console.warn('Subjects store access notice, falling back:', err);
    }

    // Fallback using settings store
    try {
      const stored = await SettingsService.get('subjects_catalog');
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
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

    const now = new Date().toISOString();
    const newSubject = {
      id: data.id || ('sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      code: cleanCode,
      name: cleanName,
      nameEn: data.nameEn?.trim() || '',
      category: data.category?.trim() || 'ទូទៅ',
      maxScore: Number(data.maxScore) > 0 ? Number(data.maxScore) : 100,
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

    const updatedSubject = {
      ...existing,
      code: cleanCode,
      name: cleanName,
      nameEn: data.nameEn !== undefined ? data.nameEn.trim() : existing.nameEn,
      category: data.category !== undefined ? data.category.trim() : existing.category,
      maxScore: data.maxScore !== undefined && Number(data.maxScore) > 0 ? Number(data.maxScore) : existing.maxScore,
      creditHours: data.creditHours !== undefined && Number(data.creditHours) > 0 ? Number(data.creditHours) : existing.creditHours,
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
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
