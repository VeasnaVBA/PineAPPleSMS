# SchoolFlow — Offline School Management System

A professional, local-first offline School Management System built as a modern web application, completely capable of running in standard web browsers without Node.js at runtime, and fully packaged for Windows desktop execution with Electron.

---

## 🚀 Key Highlights & Architecture

- **100% Local-First & Offline**: All school data (students, teachers, classes, attendance, scores, settings, photos) is stored locally in client IndexedDB (`SchoolManagementDB`). Works with zero internet connectivity.
- **Modern Responsive UI**: Crafted with a sleek Obsidian dark / clean light design system inspired by shadcn/ui.
- **Bilingual i18n**: Seamless, instant live switching between **Khmer (ភាសាខ្មែរ)** and **English** across all modules and reports without full-page reloads.
- **Dual Runtime Support**:
  1. **Web Mode**: Run in Google Chrome, Microsoft Edge, or any modern browser via local static server or file.
  2. **Desktop Mode**: Packaged with Electron featuring secure `contextBridge` isolation, native printing, and window controls.

---

## 🌟 Modules & Features

### 1. Dashboard
- Real-time KPI summary cards computed directly from IndexedDB (Total Enrolled, Active Students, Faculty Teachers, Classes, Today's Attendance Rate).
- Attendance quick breakdown (Present, Late, Excused, Absent).
- Quick Action shortcuts and Live Activity Feed tracking all school management actions.

### 2. Student Management
- High-performance data table with debounced search, class filter, and enrollment status filter.
- Multi-column sorting (Name, ID, Class, Gender, Status) and customizable pagination (10, 25, 50 rows).
- Tabbed Add / Edit modal (Personal, Academic, Guardian, Photo) with real-time validation.
- Binary Blob photo optimizer: client-side image compression to lightweight JPEG/WebP blobs.
- Student Profile Drawer with full academic details, guardian contacts, and printable student ID badge.
- Bulk actions: Select all, bulk status change (Active / Inactive / Suspended), bulk delete with typed confirmation.
- Student JSON export and import.

### 3. Teacher Management
- Faculty directory with live search and department / subject specialization filters.
- Teacher profile modal and CRUD operations with photo blob storage.
- Active homeroom class assignments and teacher contact directory.

### 4. Classes, Groups & Academic Years
- Class management: homeroom teacher assignment, classroom room numbers, student rosters, and gender ratio breakdown.
- Student Study Groups: create group activities, appoint student leaders, add/remove member rosters.
- Academic Year management: create school years (e.g. `2024–2025`), set active session, archive past academic years.

### 5. Attendance Management
- Daily roll-call ledger with Present (P), Absent (A), Late (L), and Excused (E) status toggles.
- One-click **"Mark All Present"** for instant morning registration.
- Duplicate prevention via composite date + student indexing.
- Live real-time statistics banner and historical attendance log with date picker.

### 6. Score & Grade Management
- Interactive gradebook: enter Assignment (0-100) and Final Exam (0-100) scores.
- Dynamic client-side calculations: Total Score, Percentage, Letter Grade (A, B, C, D, F), and Class Dynamic Ranking.
- Subject-based filtering and Class Grade Distribution summaries.
- Individual Student Academic Transcript card with print-ready layout.

### 7. Global Search (Command Palette)
- Press `Ctrl + K` or click the search bar anywhere in the app to open the quick launcher.
- Searches across Students, Teachers, and Classes with instant keyboard navigation.

### 8. Reports & Printing Center
- Comprehensive school reports:
  - **Student Directory**: Complete listing with enrollment dates and guardian contacts.
  - **Faculty Roster**: Teacher credentials, departments, and homerooms.
  - **Class Rosters**: Class-by-class student breakdowns.
  - **Daily Attendance Ledger**: Full attendance audit trail for any selected date.
  - **Student Academic Rankings**: Honor roll and gradebook transcripts.
- One-click CSV Export and Print Preview optimized for clean A4 paper layouts (`css/print.css`).

### 9. Backup, Restore & Safety
- **Full JSON Database Backup**: Serializes all IndexedDB stores including binary photo blobs into a timestamped file (`schoolflow-backup-YYYY-MM-DD.json`).
- **Safe Pre-Restore Preview**: Inspects uploaded backup files, displays entity counts, and provides an automatic safety snapshot before restoring.
- **Backup Reminders**: Configurable reminder banners (Daily, Weekly, or Off).
- **Diagnostics & Storage Meter**: Real-time storage estimation and danger zone with typed `DELETE` confirmation.

### 10. Role-Based Access Control (RBAC) & Accounts
- **Three Account Roles**:
  - **ADMIN**: Unrestricted system administration, user accounts CRUD, role permissions matrix, audit logs, and Last Admin Protection.
  - **DIRECTOR**: School-wide oversight, full visibility across all classes, configurable menu permissions.
  - **TEACHER**: Strict classroom-scoped boundary across Students, Attendance, Scores, Groups, Reports, and Global Search.
- **Web Crypto Security**: High-standard SHA-256 password hashing and client-side session management.
- **Role Permissions Matrix**: Admin-controlled interactive checkbox matrix allowing live enabling/disabling of sidebar menus for Director and Teacher, persisted to IndexedDB with instant reactive UI updates.
- **Multi-Level Enforcement**: Guaranteed separation at UI, Client Hash Route, Service Layer, and Database Query levels.
- **Security Audit Logs**: Chronological log of security events (account creation, deletion, permission modifications, logins).
- **Demo Quick-Logins**: One-click instant login buttons on the login card for effortless testing of all 4 personas.

---

## 👥 Default Initial Administrator Account

The application initializes with a clean slate (0 students, 0 teachers, 0 classes) ready for real production use. A default master Administrator account is provided for initial setup:

| Role | Username | Password | Assigned Scope | Description |
|---|---|---|---|---|
| **ADMIN** | `admin` | `admin123` | Full System (`*`) | Master administrator with User Accounts management & permission control |

*Note: You can create Director and Teacher accounts with custom classroom assignments directly from the User Accounts management interface (`#users`).*

---

## 🛠️ Project Structure

```text
├── index.html                  # Main application shell
├── package.json                # Scripts & dependencies (Electron & Tailwind)
├── tailwind.config.js          # Tailwind design tokens & dark-mode config
├── server.js                   # Lightweight zero-dependency development server
├── css/
│   ├── app.css                 # Custom CSS variables, animations, Khmer typography
│   ├── tailwind.css            # Compiled standalone Tailwind utility stylesheet
│   ├── input.css               # Tailwind directives
│   └── print.css               # Dedicated print stylesheet for A4 reports & ID cards
├── electron/
│   ├── main.js                 # Electron main process (lifecycle, menu, IPC, window)
│   └── preload.js              # Secure contextBridge API bridge
├── js/
│   ├── app.js                  # Main application bootstrapper & auth lifecycle
│   ├── router.js               # Client-side hash router with RBAC route guards
│   ├── database/
│   │   ├── db.js               # IndexedDB Promise wrapper (SchoolManagementDB)
│   │   └── seed.js             # Initial realistic seed data (users, students, teachers, etc.)
│   ├── services/
│   │   ├── authService.js      # Session management, SHA-256 hash & capability checks
│   │   ├── permissionService.js# Role permissions matrix & IndexedDB sync
│   │   ├── userService.js      # User CRUD & Last Admin Protection
│   │   ├── studentService.js   # Student CRUD & query service (classroom-scoped)
│   │   ├── teacherService.js   # Teacher CRUD & query service
│   │   ├── classService.js     # Class & Group management service
│   │   ├── attendanceService.js# Daily roll-call & attendance stats (classroom-scoped)
│   │   ├── scoreService.js     # Score calculation, letter grades & ranking (classroom-scoped)
│   │   ├── reportService.js    # Report generator & CSV exporter (classroom-scoped)
│   │   ├── backupService.js    # JSON export, safe restore & diagnostics
│   │   ├── searchService.js    # Global unified search engine (classroom-scoped)
│   │   ├── photoService.js     # Client image compression & blob storage
│   │   ├── settingsService.js  # Settings & audit trail logging
│   │   └── themeService.js     # Theme switcher (Light / Dark / System)
│   ├── components/
│   │   ├── icons.js            # Standalone SVG Lucide icons
│   │   ├── sidebar.js          # Collapsible responsive sidebar with RBAC filtering
│   │   ├── topbar.js           # Topbar with i18n, theme, search, & user profile dropdown
│   │   ├── modal.js            # Reusable accessible modal dialogs
│   │   ├── searchModal.js      # Global Ctrl+K command palette
│   │   └── toast.js            # Animated toast notification manager
│   ├── pages/
│   │   ├── login.js            # Authentication card with quick demo login buttons
│   │   ├── users.js            # Accounts, Role Permissions Matrix & Security Audit Logs
│   │   ├── dashboard.js        # Dynamic metric cards & activity feed
│   │   ├── students.js         # Student table, filters, drawer & editor
│   │   ├── teachers.js         # Faculty directory & teacher modal
│   │   ├── classes.js          # Class rosters & teacher assignments
│   │   ├── groups.js           # Study groups & leader assignments
│   │   ├── attendance.js       # Daily attendance register & stats
│   │   ├── scores.js           # Gradebook, GPA/letter grades & transcripts
│   │   ├── reports.js          # Reports center & print layouts
│   │   └── settings.js         # Backup/restore, year switcher & diagnostics
│   └── i18n/
│       ├── i18n.js             # Reactive translation engine
│       ├── en.js               # English translation dictionary
│       └── km.js               # Khmer (ភាសាខ្មែរ) translation dictionary
```

---

## 💻 How to Run

### Method 1: Web Application (Browser)
Run the lightweight built-in HTTP server:
```bash
node server.js
```
or with npm:
```bash
npm start
```
Then navigate to: **`http://localhost:3000`** in Google Chrome, Microsoft Edge, or Mozilla Firefox.

### Method 2: Windows Desktop Application (Electron)
Launch the application inside native Electron window:
```bash
npm run electron
```
Features available in desktop mode:
- Native desktop window with customized Obsidian dark frame
- System menu with keyboard shortcuts (`Ctrl+P` for printing, `Ctrl+Shift+I` for DevTools)
- Secure IPC architecture (`nodeIntegration: false`, `contextIsolation: true`)

### Method 3: Build Tailwind CSS (Optional)
To regenerate the standalone `css/tailwind.css`:
```bash
npm run build:css
```
