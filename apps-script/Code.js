/**
 * SmartSchool Management System - Google Drive & Google Sheets Sync Backend
 * 
 * Supports:
 * 1. Admin Central Data Sheet (SchoolSystem_AdminData)
 *    - Automatically creates and manages this spreadsheet as the primary cloud database.
 *    - Every user (Admin, Director, Teacher) uses this sheet to verify credentials and settings.
 *    - Settings (Script URL, Theme, Primary Color, Font Size, Fonts, Language, Academic Year)
 *    - User Accounts (Admin, Director, Teachers, Usernames, Passwords, Roles, Status, Classes)
 *    - Role Permissions Matrix (Director & Teacher access)
 * 2. User Workspaces (SchoolWorkspace_<username>)
 *    - Students, Schools, Classes, Teachers, Attendance, Scores
 */

var ADMIN_SPREADSHEET_NAME = 'SchoolSystem_AdminData';

/**
 * Default Seed Users created when SchoolSystem_AdminData is first initialized
 */
var DEFAULT_SEED_USERS = [
  {
    id: "usr_admin_01",
    username: "admin",
    password: "admin123",
    displayName: "System Administrator",
    role: "ADMIN",
    status: "ACTIVE",
    classId: "",
    permissions: JSON.stringify({ settings: true, users: true })
  },
  {
    id: "usr_director_01",
    username: "director1",
    password: "director123",
    displayName: "School Director",
    role: "DIRECTOR",
    status: "ACTIVE",
    classId: "",
    permissions: JSON.stringify({ dashboard: true, schools: true, registration: true, promotion: true, students: true, teachers: true, classes: true, attendance: true, scores: true, reports: true, settings: true })
  },
  {
    id: "usr_teacher_01",
    username: "teacher1",
    password: "teacher123",
    displayName: "Lead Teacher",
    role: "TEACHER",
    status: "ACTIVE",
    classId: "class_7a",
    permissions: JSON.stringify({ dashboard: true, schools: true, students: true, classes: true, attendance: true, scores: true, reports: true })
  },
  {
    id: "usr_director_02",
    username: "king",
    password: "king123",
    displayName: "Director King",
    role: "DIRECTOR",
    status: "ACTIVE",
    classId: "",
    permissions: JSON.stringify({ dashboard: true, schools: true, registration: true, promotion: true, students: true, teachers: true, classes: true, attendance: true, scores: true, reports: true, settings: true })
  }
];

var DEFAULT_SEED_SETTINGS = [
  { key: "scriptUrl", value: "" },
  { key: "theme", value: "light" },
  { key: "primaryColor", value: "#18181b" },
  { key: "fontSize", value: "base" },
  { key: "fontEn", value: "Inter" },
  { key: "fontKm", value: "Kantumruy Pro" },
  { key: "locale", value: "km" },
  { key: "activeAcademicYear", value: "2024–2025" },
  { key: "autoBackup", value: "weekly" },
  { key: "schoolNameEn", value: "SmartSchool Management" },
  { key: "schoolNameKm", value: "ប្រព័ន្ធគ្រប់គ្រងសាលារៀន ស្មាតស្គូល" }
];

var DEFAULT_SEED_PERMISSIONS = [
  {
    role: "DIRECTOR",
    permissionsJson: JSON.stringify({ dashboard: true, schools: true, registration: true, promotion: true, students: true, teachers: true, classes: true, attendance: true, scores: true, reports: true, settings: true })
  },
  {
    role: "TEACHER",
    permissionsJson: JSON.stringify({ dashboard: true, schools: true, registration: false, promotion: false, students: true, teachers: false, classes: true, attendance: true, scores: true, reports: true, settings: false })
  }
];

/**
 * Optional: Run this function directly inside Google Apps Script editor
 * to immediately create and initialize the SchoolSystem_AdminData sheet in Google Drive!
 */
function initAdminSheet() {
  var res = getOrCreateAdminSpreadsheet();
  Logger.log("Admin Spreadsheet created/verified at URL: " + res.spreadsheet.getUrl());
  return res.spreadsheet.getUrl();
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'PING';
    
    if (action === 'GET_ADMIN_DATA' || action === 'FETCH_ADMIN_DATA') {
      return handleGetAdminData();
    } else if (action === 'INIT_ADMIN_DATA') {
      getOrCreateAdminSpreadsheet();
      return handleGetAdminData();
    } else if (action === 'LIST_ALL_WORKSPACE_FILES') {
      return handleListAllWorkspaceFiles();
    } else {
      // On ping, also ensure the Admin Spreadsheet is ready in Google Drive
      var adminInfo = getOrCreateAdminSpreadsheet();
      return jsonResponse({
        success: true,
        status: 'online',
        action: action,
        adminSpreadsheetUrl: adminInfo.spreadsheet.getUrl(),
        message: 'SmartSchool Google Apps Script Web App Backend is active and running.',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Empty payload received' });
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var username = (payload.username || 'default').trim();
    var fileName = 'SchoolWorkspace_' + username;
    
    if (action === 'SAVE_ADMIN_DATA') {
      return handleSaveAdminData(payload.data || {});
    } else if (action === 'GET_ADMIN_DATA' || action === 'FETCH_ADMIN_DATA') {
      return handleGetAdminData();
    } else if (action === 'INIT_ADMIN_DATA') {
      getOrCreateAdminSpreadsheet();
      return handleGetAdminData();
    } else if (action === 'PULL_TO_DRIVE') {
      return handlePullToDrive(fileName, username, payload.data || {});
    } else if (action === 'PUSH_TO_APP') {
      return handlePushToApp(fileName, username);
    } else if (action === 'DELETE_USER_DRIVE_FILE') {
      return handleDeleteUserDriveFile(fileName, username);
    } else if (action === 'LIST_ALL_WORKSPACE_FILES') {
      return handleListAllWorkspaceFiles();
    } else {
      return jsonResponse({ success: false, error: 'Unsupported action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Get existing SchoolSystem_AdminData or automatically create and seed it
 */
function getOrCreateAdminSpreadsheet() {
  var files = DriveApp.getFilesByName(ADMIN_SPREADSHEET_NAME);
  if (files.hasNext()) {
    return {
      spreadsheet: SpreadsheetApp.open(files.next()),
      isNew: false
    };
  }
  
  // Auto-create spreadsheet if missing
  var spreadsheet = SpreadsheetApp.create(ADMIN_SPREADSHEET_NAME);
  
  // 1. Seed Settings Sheet
  var settingsSheet = spreadsheet.getSheetByName('settings');
  if (!settingsSheet) settingsSheet = spreadsheet.insertSheet('settings');
  settingsSheet.clear();
  var settingsHeaders = ['key', 'value', 'updatedAt'];
  var settingsMatrix = [settingsHeaders];
  for (var s = 0; s < DEFAULT_SEED_SETTINGS.length; s++) {
    var st = DEFAULT_SEED_SETTINGS[s];
    settingsMatrix.push([st.key, st.value, new Date().toISOString()]);
  }
  settingsSheet.getRange(1, 1, settingsMatrix.length, settingsHeaders.length).setValues(settingsMatrix);
  formatSheetHeader(settingsSheet, settingsHeaders.length);
  
  // 2. Seed Users Sheet
  var usersSheet = spreadsheet.getSheetByName('users');
  if (!usersSheet) usersSheet = spreadsheet.insertSheet('users');
  usersSheet.clear();
  var usersHeaders = ['id', 'username', 'password', 'passwordHash', 'displayName', 'role', 'status', 'classId', 'permissions', 'createdAt', 'updatedAt'];
  var usersMatrix = [usersHeaders];
  for (var u = 0; u < DEFAULT_SEED_USERS.length; u++) {
    var usr = DEFAULT_SEED_USERS[u];
    usersMatrix.push([
      usr.id,
      usr.username,
      usr.password,
      '', // passwordHash
      usr.displayName,
      usr.role,
      usr.status,
      usr.classId,
      usr.permissions,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
  }
  usersSheet.getRange(1, 1, usersMatrix.length, usersHeaders.length).setValues(usersMatrix);
  formatSheetHeader(usersSheet, usersHeaders.length);
  
  // 3. Seed Permissions Sheet
  var permSheet = spreadsheet.getSheetByName('permissions');
  if (!permSheet) permSheet = spreadsheet.insertSheet('permissions');
  permSheet.clear();
  var permHeaders = ['role', 'permissionsJson', 'updatedAt'];
  var permMatrix = [permHeaders];
  for (var p = 0; p < DEFAULT_SEED_PERMISSIONS.length; p++) {
    var pItem = DEFAULT_SEED_PERMISSIONS[p];
    permMatrix.push([pItem.role, pItem.permissionsJson, new Date().toISOString()]);
  }
  permSheet.getRange(1, 1, permMatrix.length, permHeaders.length).setValues(permMatrix);
  formatSheetHeader(permSheet, permHeaders.length);
  
  // Remove default Sheet1
  var defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    try { spreadsheet.deleteSheet(defaultSheet); } catch (_) {}
  }
  
  return {
    spreadsheet: spreadsheet,
    isNew: true
  };
}

/**
 * Save Admin Central Data (Settings, User Accounts, Permissions) to SchoolSystem_AdminData
 */
function handleSaveAdminData(data) {
  var adminInfo = getOrCreateAdminSpreadsheet();
  var spreadsheet = adminInfo.spreadsheet;
  
  var settingsList = [];
  if (data.settings && typeof data.settings === 'object') {
    var rawSettings = data.settings;
    if (Array.isArray(rawSettings)) {
      settingsList = rawSettings;
    } else {
      for (var key in rawSettings) {
        if (rawSettings.hasOwnProperty(key)) {
          var val = rawSettings[key];
          if (typeof val === 'object' && val !== null) {
            val = JSON.stringify(val);
          }
          settingsList.push({
            key: key,
            value: String(val || ''),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  }
  
  var usersList = Array.isArray(data.users) ? data.users : [];
  var permissionsList = [];
  if (data.permissions && typeof data.permissions === 'object') {
    for (var roleKey in data.permissions) {
      if (data.permissions.hasOwnProperty(roleKey)) {
        permissionsList.push({
          role: roleKey,
          permissionsJson: JSON.stringify(data.permissions[roleKey] || {}),
          updatedAt: new Date().toISOString()
        });
      }
    }
  }
  
  // 1. Write Settings Sheet
  var settingsSheet = spreadsheet.getSheetByName('settings');
  if (!settingsSheet) settingsSheet = spreadsheet.insertSheet('settings');
  settingsSheet.clear();
  
  var settingsHeaders = ['key', 'value', 'updatedAt'];
  var settingsMatrix = [settingsHeaders];
  for (var s = 0; s < settingsList.length; s++) {
    var sItem = settingsList[s];
    settingsMatrix.push([
      sItem.key || '',
      sItem.value !== undefined ? String(sItem.value) : '',
      sItem.updatedAt || new Date().toISOString()
    ]);
  }
  settingsSheet.getRange(1, 1, settingsMatrix.length, settingsHeaders.length).setValues(settingsMatrix);
  formatSheetHeader(settingsSheet, settingsHeaders.length);
  
  // 2. Write Users Sheet
  var usersSheet = spreadsheet.getSheetByName('users');
  if (!usersSheet) usersSheet = spreadsheet.insertSheet('users');
  usersSheet.clear();
  
  var usersHeaders = ['id', 'username', 'password', 'passwordHash', 'displayName', 'role', 'status', 'classId', 'permissions', 'createdAt', 'updatedAt'];
  var usersMatrix = [usersHeaders];
  for (var u = 0; u < usersList.length; u++) {
    var uItem = usersList[u];
    usersMatrix.push([
      uItem.id || '',
      uItem.username || '',
      uItem.password || '',
      uItem.passwordHash || '',
      uItem.displayName || '',
      uItem.role || 'TEACHER',
      uItem.status || 'ACTIVE',
      uItem.classId || '',
      typeof uItem.permissions === 'object' ? JSON.stringify(uItem.permissions) : (uItem.permissions || ''),
      uItem.createdAt || new Date().toISOString(),
      uItem.updatedAt || new Date().toISOString()
    ]);
  }
  usersSheet.getRange(1, 1, usersMatrix.length, usersHeaders.length).setValues(usersMatrix);
  formatSheetHeader(usersSheet, usersHeaders.length);
  
  // 3. Write Permissions Sheet
  var permSheet = spreadsheet.getSheetByName('permissions');
  if (!permSheet) permSheet = spreadsheet.insertSheet('permissions');
  permSheet.clear();
  
  var permHeaders = ['role', 'permissionsJson', 'updatedAt'];
  var permMatrix = [permHeaders];
  for (var p = 0; p < permissionsList.length; p++) {
    var pItem = permissionsList[p];
    permMatrix.push([
      pItem.role || '',
      pItem.permissionsJson || '{}',
      pItem.updatedAt || new Date().toISOString()
    ]);
  }
  permSheet.getRange(1, 1, permMatrix.length, permHeaders.length).setValues(permMatrix);
  formatSheetHeader(permSheet, permHeaders.length);
  
  // Remove default Sheet1 if extra
  var defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    try { spreadsheet.deleteSheet(defaultSheet); } catch (_) {}
  }
  
  return jsonResponse({
    success: true,
    action: 'SAVE_ADMIN_DATA',
    fileName: ADMIN_SPREADSHEET_NAME,
    spreadsheetUrl: spreadsheet.getUrl(),
    counts: {
      settings: settingsList.length,
      users: usersList.length,
      permissions: permissionsList.length
    }
  });
}

/**
 * Retrieve Admin Central Data (Settings, User Accounts, Permissions) from SchoolSystem_AdminData
 */
function handleGetAdminData() {
  var adminInfo = getOrCreateAdminSpreadsheet();
  var spreadsheet = adminInfo.spreadsheet;
  
  var resultSettings = {};
  var resultUsers = [];
  var resultPermissions = {};
  
  // 1. Read Settings
  var settingsSheet = spreadsheet.getSheetByName('settings');
  if (settingsSheet) {
    var sValues = settingsSheet.getDataRange().getValues();
    if (sValues.length > 1) {
      for (var r = 1; r < sValues.length; r++) {
        var row = sValues[r];
        var sKey = row[0];
        var sVal = row[1];
        if (sKey) {
          if (typeof sVal === 'string' && ((sVal.startsWith('{') && sVal.endsWith('}')) || (sVal.startsWith('[') && sVal.endsWith(']')))) {
            try { sVal = JSON.parse(sVal); } catch (_) {}
          }
          resultSettings[sKey] = sVal;
        }
      }
    }
  }
  
  // 2. Read Users
  var usersSheet = spreadsheet.getSheetByName('users');
  if (usersSheet) {
    var uValues = usersSheet.getDataRange().getValues();
    if (uValues.length > 1) {
      var uHeaders = uValues[0];
      for (var ur = 1; ur < uValues.length; ur++) {
        var uRow = uValues[ur];
        var userObj = {};
        for (var uc = 0; uc < uHeaders.length; uc++) {
          var hKey = uHeaders[uc];
          var cellVal = uRow[uc];
          if (hKey === 'permissions' && typeof cellVal === 'string' && cellVal.startsWith('{')) {
            try { cellVal = JSON.parse(cellVal); } catch (_) {}
          }
          userObj[hKey] = cellVal !== undefined ? cellVal : '';
        }
        if (userObj.username || userObj.id) {
          resultUsers.push(userObj);
        }
      }
    }
  }
  
  // 3. Read Permissions
  var permSheet = spreadsheet.getSheetByName('permissions');
  if (permSheet) {
    var pValues = permSheet.getDataRange().getValues();
    if (pValues.length > 1) {
      for (var pr = 1; pr < pValues.length; pr++) {
        var pRow = pValues[pr];
        var pRole = pRow[0];
        var pJson = pRow[1];
        if (pRole) {
          var parsedPerms = {};
          try {
            parsedPerms = typeof pJson === 'string' ? JSON.parse(pJson) : (pJson || {});
          } catch (_) {}
          resultPermissions[pRole] = parsedPerms;
        }
      }
    }
  }
  
  return jsonResponse({
    success: true,
    found: true,
    action: 'GET_ADMIN_DATA',
    fileName: ADMIN_SPREADSHEET_NAME,
    spreadsheetUrl: spreadsheet.getUrl(),
    isNewlyCreated: adminInfo.isNew,
    data: {
      settings: resultSettings,
      users: resultUsers,
      permissions: resultPermissions
    }
  });
}

function handleListAllWorkspaceFiles() {
  var fileList = [];
  try {
    var searchIterator = DriveApp.searchFiles("title contains 'SchoolWorkspace_' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    while (searchIterator.hasNext()) {
      var file = searchIterator.next();
      var fname = file.getName();
      var user = fname.replace(/^SchoolWorkspace_/, '');
      fileList.push({
        id: file.getId(),
        name: fname,
        username: user,
        size: file.getSize ? file.getSize() : 0,
        lastUpdated: file.getLastUpdated().toISOString(),
        url: file.getUrl()
      });
    }
    fileList.sort(function(a, b) {
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });
  } catch (e) {
    Logger.log('handleListAllWorkspaceFiles error: ' + e);
    return jsonResponse({ success: false, error: e.toString(), files: [] });
  }
  return jsonResponse({
    success: true,
    action: 'LIST_ALL_WORKSPACE_FILES',
    count: fileList.length,
    files: fileList
  });
}

function handleDeleteUserDriveFile(fileName, username) {
  var deletedCount = 0;
  var targetName = (fileName || ('SchoolWorkspace_' + username)).trim();
  
  // 1. Direct exact name lookup
  try {
    var files = DriveApp.getFilesByName(targetName);
    while (files.hasNext()) {
      var file = files.next();
      try {
        if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.remove) {
          Drive.Files.remove(file.getId());
        } else {
          file.setTrashed(true);
        }
      } catch (_) {
        file.setTrashed(true);
      }
      deletedCount++;
    }
  } catch (e1) {
    Logger.log('Direct getFilesByName error: ' + e1);
  }
  
  // 2. Fallback search (case-insensitive & variant matching)
  if (deletedCount === 0 && username) {
    try {
      var cleanUser = username.trim().toLowerCase();
      var searchIterator = DriveApp.searchFiles("title contains '" + username.trim() + "' and trashed = false");
      while (searchIterator.hasNext()) {
        var f = searchIterator.next();
        var fname = f.getName().toLowerCase();
        if (fname === targetName.toLowerCase() || 
            fname === ('schoolworkspace_' + cleanUser) ||
            fname.indexOf(cleanUser) !== -1) {
          try {
            if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.remove) {
              Drive.Files.remove(f.getId());
            } else {
              f.setTrashed(true);
            }
          } catch (_) {
            f.setTrashed(true);
          }
          deletedCount++;
        }
      }
    } catch (e2) {
      Logger.log('SearchFiles error: ' + e2);
    }
  }
  
  return jsonResponse({
    success: true,
    deleted: true,
    action: 'DELETE_USER_DRIVE_FILE',
    username: username,
    fileName: targetName,
    deletedCount: deletedCount
  });
}

/**
 * Find existing user workspace spreadsheet in Drive (handling exact name and case variations),
 * or automatically create and format a new one if not found.
 */
function getOrCreateUserSpreadsheet(fileName, username) {
  var cleanUser = (username || '').trim();
  var targetName = (fileName || ('SchoolWorkspace_' + cleanUser)).trim();
  
  // 1. Exact match lookup
  try {
    var files = DriveApp.getFilesByName(targetName);
    while (files.hasNext()) {
      var file = files.next();
      if (!file.isTrashed()) {
        return {
          spreadsheet: SpreadsheetApp.open(file),
          isNew: false
        };
      }
    }
  } catch (e1) {
    Logger.log('Exact lookup error: ' + e1);
  }
  
  // 2. Fallback search (case-insensitive & whitespace tolerant)
  try {
    var lowerTarget = targetName.toLowerCase();
    var lowerUser = cleanUser.toLowerCase();
    var searchIterator = DriveApp.searchFiles("title contains 'SchoolWorkspace_' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    while (searchIterator.hasNext()) {
      var f = searchIterator.next();
      var fname = f.getName().trim();
      var fnameLower = fname.toLowerCase();
      var userPart = fname.replace(/^SchoolWorkspace_/i, '').trim().toLowerCase();
      if (fnameLower === lowerTarget || (lowerUser && userPart === lowerUser)) {
        return {
          spreadsheet: SpreadsheetApp.open(f),
          isNew: false
        };
      }
    }
  } catch (e2) {
    Logger.log('Fallback search error: ' + e2);
  }
  
  // 3. Not found in Google Drive -> "just create one"
  var spreadsheet = SpreadsheetApp.create(targetName);
  
  var sheetNames = [
    'students', 
    'schools', 
    'classes', 
    'teachers', 
    'attendance', 
    'scores',
    'academicYears',
    'subjects',
    'groups',
    'report_settings',
    'registration_queue',
    'settings'
  ];
  
  var defaultHeaders = {
    students: ['id', 'studentId', 'name', 'latinName', 'gender', 'dateOfBirth', 'classId', 'grade', 'academicYear', 'photo', 'parentPhone', 'phone', 'address', 'status', 'createdAt', 'updatedAt'],
    schools: ['id', 'code', 'name', 'nameEn', 'address', 'director', 'phone', 'notes', 'updatedAt'],
    classes: ['id', 'name', 'grade', 'academicYear', 'room', 'teacherId', 'capacity', 'shift', 'status', 'createdAt', 'updatedAt'],
    teachers: ['id', 'teacherId', 'name', 'gender', 'phone', 'email', 'subject', 'role', 'status', 'createdAt', 'updatedAt'],
    attendance: ['id', 'studentId', 'classId', 'date', 'status', 'reason', 'session', 'academicYear', 'createdAt', 'updatedAt'],
    scores: ['id', 'studentId', 'classId', 'subjectId', 'examType', 'semester', 'academicYear', 'score', 'maxScore', 'grade', 'evaluation', 'date', 'createdAt', 'updatedAt'],
    academicYears: ['id', 'name', 'startDate', 'endDate', 'isActive', 'status', 'createdAt', 'updatedAt'],
    subjects: ['id', 'code', 'name', 'nameEn', 'coefficient', 'passingScore', 'type', 'status', 'createdAt', 'updatedAt'],
    groups: ['id', 'name', 'classId', 'academicYear', 'leaderStudentId', 'members', 'description', 'status', 'createdAt', 'updatedAt'],
    report_settings: ['id', 'key', 'value', 'type', 'description', 'updatedAt'],
    registration_queue: ['id', 'studentId', 'name', 'gender', 'dateOfBirth', 'grade', 'appliedDate', 'status', 'notes', 'createdAt', 'updatedAt'],
    settings: ['id', 'key', 'value', 'category', 'updatedAt']
  };

  for (var i = 0; i < sheetNames.length; i++) {
    var sName = sheetNames[i];
    var sheet = spreadsheet.getSheetByName(sName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sName);
    }
    var headers = defaultHeaders[sName] || ['id', 'createdAt', 'updatedAt'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatSheetHeader(sheet, headers.length);
  }

  // Remove default 'Sheet1' if other sheets exist
  var defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    try { spreadsheet.deleteSheet(defaultSheet); } catch (_) {}
  }

  return {
    spreadsheet: spreadsheet,
    isNew: true
  };
}

function handlePullToDrive(fileName, username, data) {
  var fileInfo = getOrCreateUserSpreadsheet(fileName, username);
  var spreadsheet = fileInfo.spreadsheet;
  
  var sheetsDef = [
    { name: 'students', data: data.students || [] },
    { name: 'schools', data: data.schools || [] },
    { name: 'classes', data: data.classes || [] },
    { name: 'teachers', data: data.teachers || [] },
    { name: 'attendance', data: data.attendance || [] },
    { name: 'scores', data: data.scores || [] },
    { name: 'academicYears', data: data.academicYears || [] },
    { name: 'subjects', data: data.subjects || [] },
    { name: 'groups', data: data.groups || [] },
    { name: 'report_settings', data: data.report_settings || [] },
    { name: 'registration_queue', data: data.registration_queue || [] },
    { name: 'settings', data: data.settings || [] }
  ];
  
  var counts = {};
  
  for (var i = 0; i < sheetsDef.length; i++) {
    var def = sheetsDef[i];
    var sheet = spreadsheet.getSheetByName(def.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(def.name);
    }
    sheet.clear();
    
    var rows = def.data;
    counts[def.name] = rows.length;
    
    if (rows && rows.length > 0) {
      var headers = Object.keys(rows[0]);
      var matrix = [headers];
      for (var r = 0; r < rows.length; r++) {
        var rowObj = rows[r];
        var rowValues = [];
        for (var h = 0; h < headers.length; h++) {
          var val = rowObj[headers[h]];
          if (val === null || val === undefined) val = '';
          else if (typeof val === 'object') val = JSON.stringify(val);
          rowValues.push(val);
        }
        matrix.push(rowValues);
      }
      sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
      formatSheetHeader(sheet, headers.length);
    } else {
      sheet.getRange(1, 1).setValue('No records');
    }
  }
  
  // Remove initial default "Sheet1" if other sheets exist
  var defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    try { spreadsheet.deleteSheet(defaultSheet); } catch (_) {}
  }
  
  return jsonResponse({
    success: true,
    found: true,
    action: 'PULL_TO_DRIVE',
    username: username,
    fileName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    counts: counts
  });
}

function handlePushToApp(fileName, username) {
  var fileInfo = getOrCreateUserSpreadsheet(fileName, username);
  var spreadsheet = fileInfo.spreadsheet;
  var isNew = fileInfo.isNew;
  
  var sheetNames = [
    'students', 
    'schools', 
    'classes', 
    'teachers', 
    'attendance', 
    'scores',
    'academicYears',
    'subjects',
    'groups',
    'report_settings',
    'registration_queue',
    'settings'
  ];
  var resultData = {};
  
  for (var s = 0; s < sheetNames.length; s++) {
    var sheetName = sheetNames[s];
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      resultData[sheetName] = [];
      continue;
    }
    
    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      resultData[sheetName] = [];
      continue;
    }
    
    var headers = values[0];
    var items = [];
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var item = {};
      var hasValue = false;
      for (var c = 0; c < headers.length; c++) {
        var colKey = headers[c];
        if (!colKey) continue;
        var val = row[c];
        if (val !== '' && val !== null && val !== undefined) {
          hasValue = true;
          if (typeof val === 'string' && ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']')))) {
            try { val = JSON.parse(val); } catch (_) {}
          }
        }
        item[colKey] = val;
      }
      if (hasValue && (item.id || item.studentId || item.code || item.name || item.key || item.tempStudentId || item.date || item.classId || item.subjectId || item.teacherId)) {
        items.push(item);
      }
    }
    resultData[sheetName] = items;
  }
  
  return jsonResponse({
    success: true,
    found: true,
    isNewlyCreated: isNew,
    action: 'PUSH_TO_APP',
    username: username,
    fileName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    data: resultData
  });
}

function formatSheetHeader(sheet, numCols) {
  try {
    var headerRange = sheet.getRange(1, 1, 1, numCols);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1E293B');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  } catch (_) {}
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
