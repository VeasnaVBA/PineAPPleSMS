/**
 * Static Predefined Default Users Configuration
 * 
 * Defines standard default accounts (Admin, Director, Teacher)
 * that are automatically seeded into the central system database (SchoolSystem_Global)
 * upon initial startup or when missing from the database.
 * 
 * Note:
 * - Passwords listed here are plaintext seeds and are automatically hashed with SHA-256
 *   before being stored in IndexedDB.
 * - If a username already exists in IndexedDB, seeding will SKIP it to avoid
 *   overwriting any changes made by the user (passwords, profiles, settings).
 */

export const DEFAULT_USERS = [
  {
    id: "usr_admin_01",
    username: "admin",
    password: "admin123", // Plain-text seed; will be hashed upon initial import
    displayName: "System Administrator",
    role: "ADMIN",
    status: "ACTIVE",
    classId: null,
    permissions: {
      dashboard: false,
      students: false,
      teachers: false,
      classes: false,
      schools: true,
      userManagement: true,
      settings: true
    }
  },
  {
    id: "usr_director_01",
    username: "director1",
    password: "123123",
    displayName: "Director Default",
    role: "DIRECTOR",
    status: "ACTIVE",
    classId: null,
    permissions: {
      dashboard: true,
      schools: true,
      registration: true,
      promotion: true,
      students: true,
      teachers: true,
      classes: true,
      courses: true,
      attendance: true,
      scores: true,
      reports: true,
      settings: true
    }
  },
  {
    id: "usr_teacher_01",
    username: "teacher1",
    password: "123123",
    displayName: "Teacher Default",
    role: "TEACHER",
    status: "ACTIVE",
    classId: "class_7a",
    permissions: {
      dashboard: true,
      schools: true,
      students: true,
      teachers: true,
      classes: true,
      courses: true,
      attendance: true,
      scores: true,
      reports: true,
      settings: false
    }
  },
  {
    id: "usr_director_02",
    username: "king",
    password: "king123",
    displayName: "KING ACC",
    role: "DIRECTOR",
    status: "ACTIVE",
    classId: null,
    permissions: {
      dashboard: true,
      schools: true,
      registration: true,
      promotion: true,
      students: true,
      teachers: true,
      classes: true,
      courses: true,
      attendance: true,
      scores: true,
      reports: true,
      settings: true
    }
  }
];
