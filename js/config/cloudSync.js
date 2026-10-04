/**
 * Google Drive / Sheets Cloud Synchronization Configuration
 * 
 * Account-Isolation & Naming Specification:
 * - File Name format: SchoolWorkspace_<username> (e.g. SchoolWorkspace_teacher1, SchoolWorkspace_director1)
 * - Individual module tabs/sheets inside the spreadsheet:
 *   1. students (All 29 fields)
 *   2. schools (7 columns)
 *   3. classes
 *   4. teachers
 *   5. attendance
 *   6. scores
 */

export const CLOUD_SYNC_CONFIG_KEY = 'GOOGLE_SCRIPT_WEBAPP_URL';
export const DEFAULT_GOOGLE_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyJ3lKrx1cfE5xRS9lma8w8zRpRTV0Pi4ISyXFx7l3jjQD-tZMS7XtHCYjMpSZZCXdZhg/exec';

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
 * SmartSchool Management System - Google Drive & Sheets Sync Backend
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Empty payload received' });
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var username = (payload.username || 'default').trim();
    var fileName = 'SchoolWorkspace_' + username;
    
    if (action === 'PULL_TO_DRIVE') {
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
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F1F5F9');
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
          // Try parse JSON strings (e.g. nested objects/arrays)
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

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
