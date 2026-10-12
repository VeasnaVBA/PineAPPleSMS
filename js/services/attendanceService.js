import { db } from '../database/db.js';
import { ClassService } from './classService.js';
import { authService } from './authService.js';
import { syncStateManager } from './syncStateManager.js';
import { isStudentActive, EVALUATION_PERIODS } from './scoreService.js';

export const ATTENDANCE_MONTHS = EVALUATION_PERIODS.filter(p => p.group === 'month').map((m, idx) => ({
  ...m,
  monthNum: idx + 1
}));

export function classifyAttendanceMark(rawVal) {
  const v = String(rawVal ?? '').trim();
  if (!v) return { status: 'Present', mark: '' };
  const upper = v.toUpperCase();
  // Permission / Excused: P
  if (
    upper === 'P' ||
    upper === 'E' ||
    upper === 'EX' ||
    v.startsWith('ច') ||
    v.includes('ច្បាប់')
  ) {
    return { status: 'Excused', mark: 'P' };
  }
  // Absent / Unexcused: A
  if (
    upper === 'A' ||
    upper === 'X' ||
    upper === 'U' ||
    v.startsWith('អ') ||
    v.startsWith('ឥ')
  ) {
    return { status: 'Absent', mark: 'A' };
  }
  return { status: 'Present', mark: '' };
}

export function resolveCalendarYearForMonth(academicYear, monthNum) {
  const str = String(academicYear || '').trim();
  const matches = str.match(/\d{4}/g);
  if (matches && matches.length >= 2) {
    const startYear = parseInt(matches[0], 10);
    const endYear = parseInt(matches[1], 10);
    // Months Sep(9)–Dec(12) belong to startYear; Jan(1)–Aug(8) belong to endYear
    return monthNum >= 9 ? startYear : endYear;
  }
  if (matches && matches.length === 1) {
    return parseInt(matches[0], 10);
  }
  return new Date().getFullYear();
}

export function getDaysInMonth(yearNum, monthNum) {
  return new Date(yearNum, monthNum, 0).getDate();
}

export const AttendanceService = {
  getMonths() {
    return ATTENDANCE_MONTHS;
  },

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
   * Get monthly attendance grid sheet for a specific class, academicYear, month ID (e.g. 'October'), and calendar year (e.g. 2026).
   */
  async getMonthlyAttendanceSheet({ classId, academicYear, month, year }) {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        classId = teacherClassId;
      }
    }

    const monthObj = ATTENDANCE_MONTHS.find(m => m.id === month || String(m.monthNum) === String(month));
    const monthNum = monthObj ? monthObj.monthNum : 10;
    const parsedYear = parseInt(year, 10);
    const yearNum = (!isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100)
      ? parsedYear
      : resolveCalendarYearForMonth(academicYear, monthNum);
    const daysInMonth = getDaysInMonth(yearNum, monthNum);
    const ymPrefix = `${yearNum}-${String(monthNum).padStart(2, '0')}-`;

    const enrolled = await ClassService.getEnrolledStudents(classId);
    const activeStudents = (enrolled || []).filter(isStudentActive);

    // Sort in Khmer alphabetical order by full Khmer name
    activeStudents.sort((a, b) => {
      const nameA = (a.khmerName || `${a.lastNameKh || ''} ${a.firstNameKh || ''}`).trim();
      const nameB = (b.khmerName || `${b.lastNameKh || ''} ${b.firstNameKh || ''}`).trim();
      return nameA.localeCompare(nameB, 'km');
    });

    const allAtt = await db.getAll('attendance');
    const classMonthAtt = (allAtt || []).filter(r => {
      if (String(r.classId).trim() !== String(classId).trim()) return false;
      if (!r.date) return false;
      if (String(r.date).startsWith(ymPrefix)) return true;
      const d = new Date(r.date);
      return !isNaN(d.getTime()) && (d.getMonth() + 1 === monthNum) && (d.getFullYear() === yearNum);
    });

    const stuAttMap = new Map();
    for (const rec of classMonthAtt) {
      if (!stuAttMap.has(rec.studentId)) {
        stuAttMap.set(rec.studentId, []);
      }
      stuAttMap.get(rec.studentId).push(rec);
    }

    const rows = activeStudents.map(stu => {
      const surname = (stu.lastNameKh || '').trim();
      const givenName = (stu.firstNameKh || '').trim();
      const khmerFullName = (surname || givenName)
        ? `${surname} ${givenName}`.trim()
        : (stu.khmerName || stu.englishName || '—');

      const days = {};
      for (let d = 1; d <= daysInMonth; d++) {
        days[d] = { status: 'Present', mark: '' };
      }

      let manualExcused = 0;
      let manualAbsent = 0;
      const recs = stuAttMap.get(stu.id) || [];

      for (const rec of recs) {
        const st = String(rec.status || '').trim();
        const isExc = st === 'Excused' || st === 'មានច្បាប់';
        const isAbs = st === 'Absent' || st === 'ឥតច្បាប់';
        if (!isExc && !isAbs) continue;

        if (rec.isManualSummary) {
          if (isExc) manualExcused++;
          else if (isAbs) manualAbsent++;
          continue;
        }

        const dateParts = String(rec.date || '').split('-');
        const dayNum = dateParts.length === 3 ? parseInt(dateParts[2], 10) : new Date(rec.date).getDate();
        if (dayNum >= 1 && dayNum <= daysInMonth) {
          days[dayNum] = {
            status: isExc ? 'Excused' : 'Absent',
            mark: isExc ? 'P' : 'A'
          };
        }
      }

      let dayExcusedCount = 0;
      let dayAbsentCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        if (days[d].status === 'Excused') dayExcusedCount++;
        else if (days[d].status === 'Absent') dayAbsentCount++;
      }

      const permission = dayExcusedCount + manualExcused;
      const absent = dayAbsentCount + manualAbsent;
      const total = permission + absent;

      return {
        studentId: stu.id,
        studentNumber: stu.studentId || stu.code || '',
        khmerFullName,
        lastNameKh: surname,
        firstNameKh: givenName,
        englishName: stu.englishName || '',
        gender: stu.gender || 'Male',
        classId,
        academicYear,
        month,
        monthNum,
        yearNum,
        days,
        permission,
        absent,
        total
      };
    });

    return {
      classId,
      academicYear,
      month,
      monthNum,
      yearNum,
      daysInMonth,
      rows
    };
  },

  /**
   * Save monthly attendance sheet to IndexedDB 'attendance' store.
   */
  async saveMonthlyAttendanceSheet({ classId, academicYear, month, yearNum, monthNum, daysInMonth, rows }) {
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();
    if (isTeacher && teacherClassId) {
      if (String(classId).trim() !== String(teacherClassId).trim()) {
        throw new Error('Access denied: Cannot record attendance for another classroom.');
      }
      classId = teacherClassId;
    }

    const ymPrefix = `${yearNum}-${String(monthNum).padStart(2, '0')}-`;
    const allAtt = await db.getAll('attendance');
    const existingMonthRecs = (allAtt || []).filter(r => {
      if (String(r.classId).trim() !== String(classId).trim()) return false;
      return String(r.date || '').startsWith(ymPrefix);
    });

    const existingIdsToDelete = new Set(existingMonthRecs.map(r => r.id));
    const recordsToPut = [];
    const nowIso = new Date().toISOString();

    for (const row of (rows || [])) {
      let dayExcusedCount = 0;
      let dayAbsentCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const cell = row.days?.[d];
        const { status, mark } = classifyAttendanceMark(cell?.mark ?? '');
        if (status === 'Excused' || status === 'Absent') {
          if (status === 'Excused') dayExcusedCount++;
          else dayAbsentCount++;

          const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const id = `att-${dateStr}-${row.studentId}`;
          existingIdsToDelete.delete(id);
          recordsToPut.push({
            id,
            date: dateStr,
            classId,
            academicYear,
            month,
            studentId: row.studentId,
            status,
            mark,
            notes: '',
            updatedAt: nowIso
          });
        }
      }

      // If user manually typed a summary permission/absent count greater than the marked days
      const targetPerm = Math.max(0, parseInt(row.permission, 10) || 0);
      const targetAbs = Math.max(0, parseInt(row.absent, 10) || 0);
      const extraPerm = Math.max(0, targetPerm - dayExcusedCount);
      const extraAbs = Math.max(0, targetAbs - dayAbsentCount);
      const fallbackDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;

      for (let k = 1; k <= extraPerm; k++) {
        const id = `att-manual-exc-${yearNum}-${String(monthNum).padStart(2, '0')}-${k}-${row.studentId}`;
        existingIdsToDelete.delete(id);
        recordsToPut.push({
          id,
          date: fallbackDate,
          classId,
          academicYear,
          month,
          studentId: row.studentId,
          status: 'Excused',
          mark: 'ច',
          isManualSummary: true,
          notes: '',
          updatedAt: nowIso
        });
      }

      for (let k = 1; k <= extraAbs; k++) {
        const id = `att-manual-abs-${yearNum}-${String(monthNum).padStart(2, '0')}-${k}-${row.studentId}`;
        existingIdsToDelete.delete(id);
        recordsToPut.push({
          id,
          date: fallbackDate,
          classId,
          academicYear,
          month,
          studentId: row.studentId,
          status: 'Absent',
          mark: 'អ',
          isManualSummary: true,
          notes: '',
          updatedAt: nowIso
        });
      }
    }

    for (const delId of existingIdsToDelete) {
      await db.delete('attendance', delId);
    }
    for (const rec of recordsToPut) {
      await db.put('attendance', rec);
    }

    syncStateManager.markDirty('attendance.save');
    return true;
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
    syncStateManager.markDirty('attendance.save');
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
