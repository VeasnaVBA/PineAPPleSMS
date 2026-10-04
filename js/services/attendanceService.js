import { db } from '../database/db.js';
import { ClassService } from './classService.js';
import { authService } from './authService.js';

export const AttendanceService = {
  async getByDate(date) {
    let records = await db.queryByIndex('attendance', 'date', date);
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        records = records.filter(r => r.classId === teacherClassId);
      }
    }
    return records;
  },

  async getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    let records = await db.queryByIndex('attendance', 'date', today);
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        records = records.filter(r => r.classId === teacherClassId);
      }
    }
    if (!records || records.length === 0) {
      return { total: 0, present: 0, absent: 0, late: 0, excused: 0, percentage: 0 };
    }
    const total = records.length;
    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const late = records.filter(r => r.status === 'Late').length;
    const excused = records.filter(r => r.status === 'Excused').length;
    // Present + Late counts as attended
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, absent, late, excused, percentage };
  },

  /**
   * Get roll-call attendance sheet for a specific class and date.
   * Merges enrolled active students with existing attendance entries.
   */
  async getAttendanceSheet(date, classId, academicYear) {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        classId = teacherClassId;
      }
    }

    const students = await ClassService.getEnrolledStudents(classId);
    // Filter active students primarily
    const activeStudents = students.filter(s => s.status === 'Active' || s.status === 'Inactive');

    const dayRecords = await db.queryByIndex('attendance', 'date', date);
    const existingMap = new Map();
    for (const r of dayRecords) {
      if (r.classId === classId) {
        existingMap.set(r.studentId, r);
      }
    }

    return activeStudents.map(stu => {
      const existing = existingMap.get(stu.id);
      return {
        studentId: stu.id,
        studentNumber: stu.studentId,
        khmerName: stu.khmerName,
        englishName: stu.englishName,
        gender: stu.gender,
        photoBlob: stu.photoBlob,
        classId,
        academicYear,
        date,
        status: existing ? existing.status : 'Present',
        notes: existing ? existing.notes || '' : ''
      };
    });
  },

  /**
   * Save or update attendance records for a class on a date without duplicates.
   * Unique composite ID: att-${date}-${studentId}
   */
  async saveAttendanceSheet(records) {
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    for (const r of records) {
      if (isTeacher && teacherClassId && r.classId !== teacherClassId) {
        throw new Error('Access denied: Cannot record attendance for another classroom.');
      }
      const id = `att-${r.date}-${r.studentId}`;
      const record = {
        id,
        date: r.date,
        classId: isTeacher && teacherClassId ? teacherClassId : r.classId,
        academicYear: r.academicYear,
        studentId: r.studentId,
        status: r.status,
        notes: r.notes || '',
        updatedAt: new Date().toISOString()
      };
      await db.put('attendance', record);
    }
    return true;
  },

  /**
   * Get list of historical dates where attendance was recorded for a class
   */
  async getAttendanceHistory(classId, limit = 15) {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        classId = teacherClassId;
      }
    }

    const all = await db.getAll('attendance');
    const filtered = classId && classId !== 'all' ? all.filter(r => r.classId === classId) : all;

    const dateMap = new Map();
    for (const r of filtered) {
      if (!dateMap.has(r.date)) {
        dateMap.set(r.date, { date: r.date, classId: r.classId, total: 0, present: 0, absent: 0, late: 0, excused: 0 });
      }
      const item = dateMap.get(r.date);
      item.total++;
      if (r.status === 'Present') item.present++;
      else if (r.status === 'Absent') item.absent++;
      else if (r.status === 'Late') item.late++;
      else if (r.status === 'Excused') item.excused++;
    }

    return Array.from(dateMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }
};
