/**
 * Database Seeder
 * Initializes clean database with the default Master Administrator account in SchoolSystem_Global
 * and baseline configurations (academic year, school defaults) in the user's isolated workspace.
 */
import { globalDb, db } from './db.js';
import { DEFAULT_USERS } from '../config/defaultUsers.js';
import { hashPassword } from '../services/authService.js';
import { DEFAULT_SUBJECTS } from '../services/subjectService.js';

export async function seedDefaultUsers() {
  try {
    const existingUsers = await globalDb.getAll('users');
    const existingUsernames = new Set(existingUsers.map(u => (u.username || '').toLowerCase()));

    for (const defUser of DEFAULT_USERS) {
      const cleanUsername = (defUser.username || '').toLowerCase();
      if (!cleanUsername) continue;

      const normalizedRole = (defUser.role || 'TEACHER').trim().toUpperCase();

      // If account already exists in DB, ensure role is uppercase if needed
      if (existingUsernames.has(cleanUsername)) {
        const existingRecord = existingUsers.find(u => (u.username || '').toLowerCase() === cleanUsername);
        if (existingRecord && existingRecord.role !== normalizedRole && (existingRecord.role || '').toUpperCase() === normalizedRole) {
          existingRecord.role = normalizedRole;
          await globalDb.put('users', existingRecord);
        }
        continue;
      }

      // Hash default plaintext password
      const passwordHash = await hashPassword(defUser.password);

      const userRecord = {
        id: defUser.id || ('usr_' + Date.now()),
        username: cleanUsername,
        passwordHash,
        displayName: defUser.displayName || cleanUsername,
        role: normalizedRole,
        status: (defUser.status || 'ACTIVE').trim().toUpperCase(),
        classId: defUser.classId || null,
        permissions: defUser.permissions || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: null
      };

      await globalDb.put('users', userRecord);
      existingUsernames.add(cleanUsername);
      console.log(`[Auth] Seeded default user account: ${cleanUsername} (${normalizedRole}) in SchoolSystem_Global.`);
    }
  } catch (err) {
    console.error('Error seeding default users in global database:', err);
  }
}

/**
 * Initializes baseline configuration within a specific user's isolated workspace
 * (academic years, base settings).
 */
export async function seedWorkspaceBaseline() {
  try {
    // 1. Ensure base Academic Year exists in active workspace
    const yearCount = await db.count('academicYears');
    if (yearCount === 0) {
      const academicYears = [
        { id: 'ay-2024-2025', name: '2024–2025', isActive: true, startDate: '2024-09-01', endDate: '2025-06-30' }
      ];
      for (const ay of academicYears) {
        await db.put('academicYears', ay);
      }
    }

    // 2. Default School Settings in active workspace
    const activeYear = await db.get('settings', 'active_academic_year');
    if (!activeYear) {
      await db.put('settings', { key: 'active_academic_year', value: '2024–2025' });
    }
    const schoolEn = await db.get('settings', 'school_name_en');
    if (!schoolEn) {
      await db.put('settings', { key: 'school_name_en', value: 'SmartSchool Management' });
    }
    const schoolKm = await db.get('settings', 'school_name_km');
    if (!schoolKm) {
      await db.put('settings', { key: 'school_name_km', value: 'ប្រព័ន្ធគ្រប់គ្រងសាលារៀន ស្មាតស្គូល' });
    }

    // 3. Ensure default Subjects exist in active workspace
    const subjectCount = await db.count('subjects');
    if (subjectCount === 0) {
      for (const item of DEFAULT_SUBJECTS) {
        await db.put('subjects', {
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    console.log('[Workspace] Baseline settings and default subjects initialized for active workspace.');
  } catch (err) {
    console.error('Error in seedWorkspaceBaseline:', err);
  }
}

export async function seedInitialData() {
  try {
    // 1. Ensure initial administrator account exists in global database
    await seedDefaultUsers();

    // 2. Ensure baseline setup in active workspace
    await seedWorkspaceBaseline();

    console.log('Database initialization complete (clean, ready for production use).');
  } catch (err) {
    console.error('Error in seedInitialData:', err);
  }
}
