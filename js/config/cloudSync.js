/**
 * Google Drive / Sheets Cloud Synchronization Configuration
 * 
 * Account-Isolation & Naming Specification:
 * - File Name format: SchoolWorkspace_<username> (e.g. SchoolWorkspace_teacher1, SchoolWorkspace_director1)
 * - Individual module tabs/sheets inside user workspace:
 *   1. students (All 29 fields)
 *   2. schools (7 columns)
 *   3. classes
 *   4. teachers
 *   5. attendance
 *   6. scores
 * 
 * Central Admin Spreadsheet:
 * - File Name: SchoolSystem_AdminData
 * - Tabs:
 *   1. settings (URL, theme, font size, colors, locale, academic year, etc.)
 *   2. users (id, username, password, passwordHash, displayName, role, status, classId, permissions)
 *   3. permissions (role permissions matrix)
 */

export const CLOUD_SYNC_CONFIG_KEY = 'GOOGLE_SCRIPT_WEBAPP_URL';
export const DEFAULT_GOOGLE_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyJ3lKrx1cfE5xRS9lma8w8zRpRTV0Pi4ISyXFx7l3jjQD-tZMS7XtHCYjMpSZZCXdZhg/exec';

export const ADMIN_SPREADSHEET_NAME = 'SchoolSystem_AdminData';
export const ADMIN_DATA_LAST_SYNC_KEY = 'SCHOOL_ADMIN_DATA_LAST_SYNC';
export const ADMIN_DATA_SPREADSHEET_URL_KEY = 'SCHOOL_ADMIN_SPREADSHEET_URL';

export const CLOUD_SYNC_SHEET_NAMES = {
  STUDENTS: 'students',
  SCHOOLS: 'schools',
  CLASSES: 'classes',
  TEACHERS: 'teachers',
  ATTENDANCE: 'attendance',
  SCORES: 'scores'
};

/**
 * Returns spreadsheet name for a specific username
 * Example: SchoolWorkspace_teacher1
 */
export function getWorkspaceSpreadsheetName(username) {
  const cleanUsername = (username || 'guest').trim();
  return `SchoolWorkspace_${cleanUsername}`;
}

/**
 * Get configured Google Apps Script Web App URL from localStorage or default
 */
export function getCloudSyncUrl() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(CLOUD_SYNC_CONFIG_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    }
  } catch (_) {}
  return DEFAULT_GOOGLE_SCRIPT_WEBAPP_URL;
}

/**
 * Persist configured Google Apps Script Web App URL
 */
export function setCloudSyncUrl(url) {
  const cleanUrl = (url || '').trim();
  try {
    if (typeof localStorage !== 'undefined') {
      if (cleanUrl) {
        localStorage.setItem(CLOUD_SYNC_CONFIG_KEY, cleanUrl);
      } else {
        localStorage.removeItem(CLOUD_SYNC_CONFIG_KEY);
      }
    }
  } catch (_) {}
  return cleanUrl;
}

/**
 * Ready-to-deploy Google Apps Script Code for Google Drive / Google Sheets
 * Deploy instructions:
 * 1. Open Google Drive -> New -> More -> Google Apps Script (or script.google.com)
 * 2. Paste this code into Code.gs
 * 3. Click "Deploy" -> "New deployment" -> Select type: "Web app"
 * 4. Execute as: "Me"
 * 5. Who has access: "Anyone" (allows client-side fetch without OAuth prompts)
 * 6. Copy the Web App URL (ends in /exec) into the SmartSchool App settings.
 */
export const GOOGLE_APPS_SCRIPT_BACKEND_CODE = `
/**
 * SmartSchool Management System - Google Drive & Google Sheets Sync Backend
 * 
 * Supports:
 * 1. User Workspaces (SchoolWorkspace_<username>)
 *    - Students, Schools, Classes, Teachers, Attendance, Scores
 * 2. Admin Central Data Sheet (SchoolSystem_AdminData)
 *    - Settings (Script URL, Theme, Primary Color, Font Size, Fonts, Language, Academic Year)
 *    - User Accounts (Admin, Director, Teachers, Usernames, Passwords, Roles, Status, Classes)
 *    - Role Permissions Matrix (Director & Teacher access)
 */

var ADMIN_SPREADSHEET_NAME = 'SchoolSystem_AdminData';

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'PING';
    
    if (action === 'GET_ADMIN_DATA') {
      return handleGetAdminData();
    } else if (action === 'LIST_ALL_WORKSPACE_FILES') {
      return handleListAllWorkspaceFiles();
    } else {
      return jsonResponse({
        success: true,
        status: 'online',
        action: action,
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
    } else if (action === 'GET_ADMIN_DATA') {
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
 * Save Admin Central Data (Settings, User Accounts, Permissions) to SchoolSystem_AdminData
 */
function handleSaveAdminData(data) {
  var files = DriveApp.getFilesByName(ADMIN_SPREADSHEET_NAME);
  var spreadsheet;
  
  if (files.hasNext()) {
    spreadsheet = SpreadsheetApp.open(files.next());
  } else {
    spreadsheet = SpreadsheetApp.create(ADMIN_SPREADSHEET_NAME);
  }
  
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
  var files = DriveApp.getFilesByName(ADMIN_SPREADSHEET_NAME);
  if (!files.hasNext()) {
    return jsonResponse({
      success: true,
      found: false,
      fileName: ADMIN_SPREADSHEET_NAME,
      message: 'Admin spreadsheet ' + ADMIN_SPREADSHEET_NAME + ' does not exist on Google Drive yet.'
    });
  }
  
  var spreadsheet = SpreadsheetApp.open(files.next());
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

function handlePullToDrive(fileName, username, data) {
  var files = DriveApp.getFilesByName(fileName);
  var spreadsheet;
  
  if (files.hasNext()) {
    spreadsheet = SpreadsheetApp.open(files.next());
  } else {
    spreadsheet = SpreadsheetApp.create(fileName);
  }
  
  var sheetsDef = [
    { name: 'students', data: data.students || [] },
    { name: 'schools', data: data.schools || [] },
    { name: 'classes', data: data.classes || [] },
    { name: 'teachers', data: data.teachers || [] },
    { name: 'attendance', data: data.attendance || [] },
    { name: 'scores', data: data.scores || [] }
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
    fileName: fileName,
    spreadsheetUrl: spreadsheet.getUrl(),
    counts: counts
  });
}

function handlePushToApp(fileName, username) {
  var files = DriveApp.getFilesByName(fileName);
  if (!files.hasNext()) {
    return jsonResponse({
      success: true,
      found: false,
      username: username,
      fileName: fileName
    });
  }
  
  var spreadsheet = SpreadsheetApp.open(files.next());
  var sheetNames = ['students', 'schools', 'classes', 'teachers', 'attendance', 'scores'];
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
        var val = row[c];
        if (val !== '' && val !== null && val !== undefined) {
          hasValue = true;
          if (typeof val === 'string' && ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']')))) {
            try { val = JSON.parse(val); } catch (_) {}
          }
        }
        item[colKey] = val;
      }
      if (hasValue && (item.id || item.studentId || item.code || item.name)) {
        items.push(item);
      }
    }
    resultData[sheetName] = items;
  }
  
  return jsonResponse({
    success: true,
    found: true,
    action: 'PUSH_TO_APP',
    username: username,
    fileName: fileName,
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
`;
