/**
 * Location Service
 * Manages persistent, customizable lists for:
 * - Villages (shared between Birth Village and Current Village)
 * - Communes (shared between Birth Commune and Current Commune)
 * - Districts (shared between Birth District and Current District)
 * - Provinces (shared between Birth Province and Current Province)
 * 
 * Persisted in IndexedDB Settings with localStorage cache for offline speed.
 */
import { SettingsService } from './settingsService.js';

const STORAGE_KEY = 'locations_catalog_v1';

const DEFAULT_PROVINCES = [
  'ភ្នំពេញ (Phnom Penh)',
  'កណ្តាល (Kandal)',
  'កំពង់ចាម (Kampong Cham)',
  'កំពង់ឆ្នាំង (Kampong Chhnang)',
  'កំពង់ស្ពឺ (Kampong Speu)',
  'កំពង់ធំ (Kampong Thom)',
  'កំពត (Kampot)',
  'កោះកុង (Koh Kong)',
  'ក្រចេះ (Kratie)',
  'កែប (Kep)',
  'តាកែវ (Takeo)',
  'ត្បូងឃ្មុំ (Tboung Khmum)',
  'បន្ទាយមានជ័យ (Banteay Meanchey)',
  'បាត់ដំបង (Battambang)',
  'ប៉ៃលិន (Pailin)',
  'ពោធិ៍សាត់ (Pursat)',
  'ព្រះវិហារ (Preah Vihear)',
  'ព្រះសីហនុ (Preah Sihanouk)',
  'ព្រៃវែង (Prey Veng)',
  'មណ្ឌលគិរី (Mondulkiri)',
  'រតនគិរី (Ratanakiri)',
  'សៀមរាប (Siem Reap)',
  'ស្ទឹងត្រែង (Stung Treng)',
  'ស្វាយរៀង (Svay Rieng)',
  'ឧត្តរមានជ័យ (Oddar Meanchey)'
];

const DEFAULT_DATA = {
  provinces: DEFAULT_PROVINCES,
  districts: [],
  communes: [],
  villages: [],
  lastYearSchools: []
};

export const LocationService = {
  _cache: null,

  /**
   * Reset in-memory cache on account switch
   */
  clearCache() {
    this._cache = null;
  },

  /**
   * Load all categories from cache or IndexedDB settings
   */
  async getAll() {
    if (this._cache) return this._cache;

    // Try IndexedDB via SettingsService
    if (!this._cache) {
      try {
        const fromDb = await SettingsService.get(STORAGE_KEY);
        if (fromDb && typeof fromDb === 'object') {
          this._cache = fromDb;
        }
      } catch (_) {}
    }

    // Initialize with defaults if empty
    if (!this._cache) {
      this._cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
      await this._persist();
    } else {
      // Ensure all keys exist
      if (!Array.isArray(this._cache.provinces) || this._cache.provinces.length === 0) {
        this._cache.provinces = [...DEFAULT_PROVINCES];
      }
      if (!Array.isArray(this._cache.districts)) this._cache.districts = [];
      if (!Array.isArray(this._cache.communes)) this._cache.communes = [];
      if (!Array.isArray(this._cache.villages)) this._cache.villages = [];
      if (!Array.isArray(this._cache.lastYearSchools)) this._cache.lastYearSchools = [];
    }

    return this._cache;
  },

  /**
   * Get items for a specific category: 'provinces' | 'districts' | 'communes' | 'villages'
   */
  async getItems(category) {
    const data = await this.getAll();
    return Array.isArray(data[category]) ? [...data[category]] : [];
  },

  /**
   * Add a new item to a category
   */
  async addItem(category, value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      throw new Error('Item name cannot be empty');
    }

    const data = await this.getAll();
    if (!Array.isArray(data[category])) {
      data[category] = [];
    }

    // Check if already exists (case-insensitive)
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

  /**
   * Delete an item from a category
   */
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

  /**
   * Harvest existing values from existing student records so nothing is lost
   */
  async harvestFromStudents(students) {
    if (!Array.isArray(students) || students.length === 0) return;
    const data = await this.getAll();
    let changed = false;

    for (const s of students) {
      if (s.birthProvince && !data.provinces.includes(s.birthProvince.trim())) {
        data.provinces.push(s.birthProvince.trim());
        changed = true;
      }
      if (s.currentProvince && !data.provinces.includes(s.currentProvince.trim())) {
        data.provinces.push(s.currentProvince.trim());
        changed = true;
      }

      if (s.birthDistrict && !data.districts.includes(s.birthDistrict.trim())) {
        data.districts.push(s.birthDistrict.trim());
        changed = true;
      }
      if (s.currentDistrict && !data.districts.includes(s.currentDistrict.trim())) {
        data.districts.push(s.currentDistrict.trim());
        changed = true;
      }

      if (s.birthCommune && !data.communes.includes(s.birthCommune.trim())) {
        data.communes.push(s.birthCommune.trim());
        changed = true;
      }
      if (s.currentCommune && !data.communes.includes(s.currentCommune.trim())) {
        data.communes.push(s.currentCommune.trim());
        changed = true;
      }

      if (s.birthVillage && !data.villages.includes(s.birthVillage.trim())) {
        data.villages.push(s.birthVillage.trim());
        changed = true;
      }
      if (s.currentVillage && !data.villages.includes(s.currentVillage.trim())) {
        data.villages.push(s.currentVillage.trim());
        changed = true;
      }

      if (s.lastYearSchool && !data.lastYearSchools.includes(s.lastYearSchool.trim())) {
        data.lastYearSchools.push(s.lastYearSchool.trim());
        changed = true;
      }
    }

    if (changed) {
      data.provinces.sort((a, b) => a.localeCompare(b, 'km'));
      data.districts.sort((a, b) => a.localeCompare(b, 'km'));
      data.communes.sort((a, b) => a.localeCompare(b, 'km'));
      data.villages.sort((a, b) => a.localeCompare(b, 'km'));
      data.lastYearSchools.sort((a, b) => a.localeCompare(b, 'km'));
      await this._persist();
    }
  },

  /**
   * Harvest existing values from teacher records so nothing is lost
   */
  async harvestFromTeachers(teachers) {
    if (!Array.isArray(teachers) || teachers.length === 0) return;
    const data = await this.getAll();
    let changed = false;

    for (const t of teachers) {
      if (t.birthProvince && !data.provinces.includes(t.birthProvince.trim())) {
        data.provinces.push(t.birthProvince.trim());
        changed = true;
      }
      if (t.currentProvince && !data.provinces.includes(t.currentProvince.trim())) {
        data.provinces.push(t.currentProvince.trim());
        changed = true;
      }

      if (t.birthDistrict && !data.districts.includes(t.birthDistrict.trim())) {
        data.districts.push(t.birthDistrict.trim());
        changed = true;
      }
      if (t.currentDistrict && !data.districts.includes(t.currentDistrict.trim())) {
        data.districts.push(t.currentDistrict.trim());
        changed = true;
      }

      if (t.birthCommune && !data.communes.includes(t.birthCommune.trim())) {
        data.communes.push(t.birthCommune.trim());
        changed = true;
      }
      if (t.currentCommune && !data.communes.includes(t.currentCommune.trim())) {
        data.communes.push(t.currentCommune.trim());
        changed = true;
      }

      if (t.birthVillage && !data.villages.includes(t.birthVillage.trim())) {
        data.villages.push(t.birthVillage.trim());
        changed = true;
      }
      if (t.currentVillage && !data.villages.includes(t.currentVillage.trim())) {
        data.villages.push(t.currentVillage.trim());
        changed = true;
      }
    }

    if (changed) {
      data.provinces.sort((a, b) => a.localeCompare(b, 'km'));
      data.districts.sort((a, b) => a.localeCompare(b, 'km'));
      data.communes.sort((a, b) => a.localeCompare(b, 'km'));
      data.villages.sort((a, b) => a.localeCompare(b, 'km'));
      await this._persist();
    }
  },

  /**
   * Internal persist helper
   */
  async _persist() {
    if (!this._cache) return;
    try {
      await SettingsService.set(STORAGE_KEY, this._cache);
    } catch (err) {
      console.warn('Could not persist locations to IndexedDB:', err);
    }
  }
};
