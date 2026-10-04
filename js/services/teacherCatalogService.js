/**
 * Teacher Catalog Service
 * Manages persistent, customizable lists for teacher civil service attributes:
 * - Work Status (ស្ថានភាពការងារ)
 * - Framework (ក្របខណ្ឌ)
 * - Rank & Grade (ឋាន្តរស័ក្តិ និងថ្នាក់)
 * - Position (មុខតំណែង)
 * - Training Level (កម្រិតបណ្តុះបណ្តាល)
 * - Specializations (ឯកទេសទី១ / ទី២)
 * - Highest Degree (សញ្ញាបត្រចុងក្រោយ)
 * - Degree Major (ឯកទេសសញ្ញាបត្រ)
 * - Task Assignment (បំណែងចែកភារកិច្ច)
 * - Additional Duties (ភារកិច្ចបន្ថែម)
 * - Subjects (មុខវិជ្ជាទី១ / ទី២ / ទី៣)
 * 
 * Persisted in IndexedDB Settings with cache for fast offline access.
 */
import { SettingsService } from './settingsService.js';

const STORAGE_KEY = 'teacher_catalogs_v2';

const DEFAULT_CATALOGS = {
  workStatuses: [],
  frameworks: [],
  rankAndGrades: [],
  positions: [],
  trainingLevels: [],
  specializations: [],
  degrees: [],
  degreeMajors: [],
  taskAssignments: [],
  additionalDuties: [],
  subjects: []
};

export const TeacherCatalogService = {
  _cache: null,

  clearCache() {
    this._cache = null;
  },

  async getAll() {
    if (this._cache) return this._cache;

    try {
      const fromDb = await SettingsService.get(STORAGE_KEY);
      if (fromDb && typeof fromDb === 'object') {
        this._cache = fromDb;
      }
    } catch (_) {}

    if (!this._cache) {
      this._cache = JSON.parse(JSON.stringify(DEFAULT_CATALOGS));
      await this._persist();
    } else {
      // Ensure all catalog keys exist as arrays
      for (const key of Object.keys(DEFAULT_CATALOGS)) {
        if (!Array.isArray(this._cache[key])) {
          this._cache[key] = [];
        }
      }
    }

    return this._cache;
  },

  async getItems(category) {
    const data = await this.getAll();
    return Array.isArray(data[category]) ? [...data[category]] : [];
  },

  async addItem(category, value) {
    const trimmed = (value || '').trim();
    if (!trimmed) throw new Error('Item name cannot be empty');

    const data = await this.getAll();
    if (!Array.isArray(data[category])) {
      data[category] = [];
    }

    const exists = data[category].some(
      item => item.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      throw new Error('ALREADY_EXISTS');
    }

    data[category].push(trimmed);
    data[category].sort((a, b) => a.localeCompare(b, 'km'));

    await this._persist();
    return [...data[category]];
  },

  async deleteItem(category, value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return [];

    const data = await this.getAll();
    if (!Array.isArray(data[category])) return [];

    data[category] = data[category].filter(
      item => item.toLowerCase() !== trimmed.toLowerCase()
    );

    await this._persist();
    return [...data[category]];
  },

  async harvestFromTeachers(teachers) {
    if (!Array.isArray(teachers) || teachers.length === 0) return;
    const data = await this.getAll();
    let changed = false;

    const harvestField = (category, val) => {
      if (!val || typeof val !== 'string') return;
      const clean = val.trim();
      if (!clean) return;
      if (!Array.isArray(data[category])) data[category] = [];
      if (!data[category].some(x => x.toLowerCase() === clean.toLowerCase())) {
        data[category].push(clean);
        changed = true;
      }
    };

    for (const t of teachers) {
      harvestField('workStatuses', t.workStatus);
      harvestField('frameworks', t.framework);
      harvestField('rankAndGrades', t.rankAndGrade);
      harvestField('positions', t.position);
      harvestField('trainingLevels', t.trainingLevel);
      harvestField('specializations', t.specialization1);
      harvestField('specializations', t.specialization2);
      harvestField('degrees', t.highestDegree);
      harvestField('degreeMajors', t.highestDegreeMajor);
      harvestField('taskAssignments', t.taskAssignment);
      harvestField('additionalDuties', t.additionalDuties);
      harvestField('subjects', t.subject1 || t.subject);
      harvestField('subjects', t.subject2);
      harvestField('subjects', t.subject3);
    }

    if (changed) {
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          data[key].sort((a, b) => a.localeCompare(b, 'km'));
        }
      }
      await this._persist();
    }
  },

  async _persist() {
    if (!this._cache) return;
    try {
      await SettingsService.set(STORAGE_KEY, this._cache);
    } catch (err) {
      console.warn('Could not persist teacher catalogs to IndexedDB:', err);
    }
  }
};
