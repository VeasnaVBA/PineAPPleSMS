import { db } from '../database/db.js';
import { ScoreService } from './scoreService.js';
import { SettingsService } from './settingsService.js';
import { authService } from './authService.js';
import { normalizeStudentRecord } from './studentService.js';

export const ReportService = {
  /**
   * Helper to convert rows to CSV format and trigger browser download
   */
  exportToCSV(filename, headers, rows) {
    const escapeVal = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerLine = headers.map(h => escapeVal(h.label)).join(',');
    const dataLines = rows.map(row => {
      return headers.map(h => escapeVal(row[h.key])).join(',');
    });

    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * 1. Student Directory Report
   */
  async getStudentReport(classId = 'all', status = 'all') {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) classId = teacherClassId;
    }

    const [rawStudents, classes] = await Promise.all([
      db.getAll('students'),
      db.getAll('classes')
    ]);

    const students = (rawStudents || []).map(normalizeStudentRecord);
    const classMap = new Map(classes.map(c => [c.id, c.name]));

    let filtered = students;
    if (classId && classId !== 'all') filtered = filtered.filter(s => s.classId === classId);
    if (status && status !== 'all') {
      const target = String(status).trim().toLowerCase();
      filtered = filtered.filter(s => {
        if (!s.status) return false;
        const st = String(s.status).trim().toLowerCase();
        if (target === 'inactive') {
          return st === 'inactive' || st === 'dropout' || st === 'dropped' || st === 'left' ||
            String(s.status).includes('អសកម្ម') || String(s.status).includes('បោះបង់') || String(s.status).includes('ឈប់រៀន') ||
            Boolean(s.dropoutDate);
        }
        return st === target || s.status === status;
      });
    }

    return filtered.map((s, idx) => ({
      no: idx + 1,
      studentId: s.studentId,
      khmerName: s.khmerName || [s.lastNameKh, s.firstNameKh].filter(Boolean).join(' ') || s.englishName || s.name || '',
      englishName: s.englishName || [s.lastNameLatin, s.firstNameLatin].filter(Boolean).join(' ') || '',
      gender: s.gender || '',
      dob: s.dateOfBirth || '',
      className: classMap.get(s.classId) || s.classId || '',
      status: s.status || '',
      guardian: s.guardian || s.fatherName || '',
      parentPhone: s.parentPhone || '',
      birthplace: [s.birthVillage, s.birthCommune, s.birthDistrict, s.birthProvince].filter(Boolean).join(', ')
    }));
  },

  /**
   * 2. Teacher Faculty Report
   */
  async getTeacherReport() {
    const teachers = await db.getAll('teachers');
    return teachers.map((t, idx) => ({
      no: idx + 1,
      teacherId: t.teacherId,
      khmerName: t.khmerName || '',
      englishName: t.englishName || '',
      gender: t.gender || '',
      subject: t.subject || '',
      position: t.position || '',
      phone: t.phone || '',
      email: t.email || '',
      status: t.status || ''
    }));
  },

  /**
   * 3. Class Directory Report
   */
  async getClassReport() {
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    const [classes, teachers, students] = await Promise.all([
      db.getAll('classes'),
      db.getAll('teachers'),
      db.getAll('students')
    ]);

    let targetClasses = classes;
    if (isTeacher && teacherClassId) {
      targetClasses = classes.filter(c => c.id === teacherClassId);
    }

    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    return targetClasses.map((c, idx) => {
      const teacher = teacherMap.get(c.teacherId);
      const enrolled = students.filter(s => s.classId === c.id);
      const active = enrolled.filter(s => s.status === 'Active');

      return {
        no: idx + 1,
        className: c.name,
        academicYear: c.academicYear || '',
        room: c.room || '',
        homeroomTeacher: teacher ? `${teacher.khmerName} (${teacher.englishName})` : 'Unassigned',
        enrolledCount: enrolled.length,
        activeCount: active.length,
        status: c.status || 'Active'
      };
    });
  },

  /**
   * 4. Attendance Summary Report
   */
  async getAttendanceReport(classId = 'all') {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) classId = teacherClassId;
    }

    const [attendance, classes] = await Promise.all([
      db.getAll('attendance'),
      db.getAll('classes')
    ]);

    const classMap = new Map(classes.map(c => [c.id, c.name]));
    const filtered = classId && classId !== 'all' ? attendance.filter(a => a.classId === classId) : attendance;

    // Aggregate by date and class
    const groupMap = new Map();
    for (const a of filtered) {
      const key = `${a.date}_${a.classId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          date: a.date,
          classId: a.classId,
          className: classMap.get(a.classId) || a.classId,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0
        });
      }
      const item = groupMap.get(key);
      item.total++;
      if (a.status === 'Present') item.present++;
      else if (a.status === 'Absent') item.absent++;
      else if (a.status === 'Late') item.late++;
      else if (a.status === 'Excused') item.excused++;
    }

    return Array.from(groupMap.values()).map((item, idx) => {
      const rate = item.total > 0 ? Math.round(((item.present + item.late) / item.total) * 100) : 0;
      return {
        no: idx + 1,
        ...item,
        attendanceRate: `${rate}%`
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * 5. Student Ranking Report
   */
  async getRankingReport(classId, subjectId = 'all', month = 'October') {
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) classId = teacherClassId;
    }

    const activeYear = await SettingsService.getActiveAcademicYear();
    const [students, allScores, classes, subjects] = await Promise.all([
      db.getAll('students'),
      db.getAll('scores'),
      db.getAll('classes'),
      ScoreService.getSubjects()
    ]);

    const classStudents = students.filter(s => s.classId === classId && (s.status === 'Active' || s.status === 'Inactive'));
    const subjectMap = new Map(subjects.map(sub => [sub.id, sub.nameEn]));

    // Compute aggregated marks per student
    const studentScoreMap = new Map();
    for (const s of classStudents) {
      studentScoreMap.set(s.id, {
        student: s,
        totalScore: 0,
        subjectCount: 0,
        scoresList: []
      });
    }

    for (const sc of allScores) {
      if (sc.classId === classId && sc.month === month && sc.academicYear === activeYear) {
        if (subjectId === 'all' || sc.subjectId === subjectId) {
          const entry = studentScoreMap.get(sc.studentId);
          if (entry) {
            entry.totalScore += Number(sc.total) || 0;
            entry.subjectCount++;
            entry.scoresList.push(sc);
          }
        }
      }
    }

    // Rank students
    const rankedList = Array.from(studentScoreMap.values()).map(item => {
      const average = item.subjectCount > 0 ? Math.round(item.totalScore / item.subjectCount) : 0;
      const gradeInfo = ScoreService.calculateGrade(average);
      return {
        studentId: item.student.studentId,
        khmerName: item.student.khmerName || '',
        englishName: item.student.englishName || '',
        gender: item.student.gender || '',
        totalScore: item.totalScore,
        average,
        grade: gradeInfo.grade,
        gradeLabel: gradeInfo.label
      };
    }).sort((a, b) => b.average - a.average);

    // Assign rank numbers
    let currentRank = 1;
    for (let i = 0; i < rankedList.length; i++) {
      if (i > 0 && rankedList[i].average < rankedList[i - 1].average) {
        currentRank = i + 1;
      }
      rankedList[i].rank = `#${currentRank}`;
      rankedList[i].no = i + 1;
    }

    return rankedList;
  },

  /**
   * Get custom layout/format settings for a report type
   * @param {string} reportKey e.g. 'dropout_report', 'student_list', 'transcript'
   */
  async getReportSettings(reportKey) {
    if (!reportKey) return null;
    try {
      const record = await db.get('report_settings', reportKey);
      if (record) return record;
    } catch (err) {
      console.warn(`Failed to get report settings for ${reportKey} from db:`, err);
    }
    // Fallback to localStorage if db query fails or store hasn't initialized
    try {
      const local = localStorage.getItem(`report_settings_${reportKey}`);
      return local ? JSON.parse(local) : null;
    } catch (_) {
      return null;
    }
  },

  /**
   * Save customized layout/format preset for a report type
   * @param {string} reportKey
   * @param {Object} settings
   */
  async saveReportSettings(reportKey, settings) {
    if (!reportKey) throw new Error('reportKey is required');
    const data = {
      id: reportKey,
      padding: settings.padding || settings.margins || { top: 15, bottom: 15, left: 15, right: 15 },
      margins: settings.padding || settings.margins || { top: 15, bottom: 15, left: 15, right: 15 },
      orientation: settings.orientation || 'portrait',
      zoom: Number(settings.zoom) || 100,
      defaultFontFamily: settings.defaultFontFamily || 'Kantumruy Pro',
      defaultFontSize: Number(settings.defaultFontSize) || 14,
      savedHtmlContent: settings.savedHtmlContent || settings.customOverridesHtml || '',
      customOverridesHtml: settings.savedHtmlContent || settings.customOverridesHtml || '',
      savedImages: Array.isArray(settings.savedImages) ? settings.savedImages : [],
      savedTextBoxes: Array.isArray(settings.savedTextBoxes) ? settings.savedTextBoxes : [],
      updatedAt: new Date().toISOString()
    };
    try {
      await db.put('report_settings', data);
    } catch (err) {
      console.warn(`Database put error for report_settings ${reportKey}:`, err);
    }
    // Also save to localStorage as instant fallback
    try {
      localStorage.setItem(`report_settings_${reportKey}`, JSON.stringify(data));
    } catch (_) {
      try {
        const fallbackData = { ...data, savedImages: [] };
        localStorage.setItem(`report_settings_${reportKey}`, JSON.stringify(fallbackData));
      } catch (__) {}
    }
    return data;
  },

  /**
   * Reset report settings to system default
   * @param {string} reportKey
   */
  async resetReportSettings(reportKey) {
    if (!reportKey) return;
    try {
      await db.delete('report_settings', reportKey);
    } catch (err) {
      console.warn(`Database delete error for report_settings ${reportKey}:`, err);
    }
    try {
      localStorage.removeItem(`report_settings_${reportKey}`);
    } catch (_) {}
  }
};

export const reportService = ReportService;
