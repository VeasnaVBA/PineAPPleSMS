/**
 * Login Page Component
 * Clean, modern dark aesthetic matching Resident X UI
 * with full authentication, show/hide password, language toggle, and quick-fill options.
 */
import { authService } from '../services/authService.js';
import { themeService } from '../services/themeService.js';
import { AdminDataService } from '../services/adminDataService.js';
import { i18n, t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';

export class LoginPage {
  constructor(containerId, onLoginSuccess) {
    this.container = document.getElementById(containerId);
    this.onLoginSuccess = onLoginSuccess;
    this.showPassword = false;
    this.errorMessage = '';
    this.isLoading = false;
    this.showDemoDrawer = false;
  }

  render() {
    if (!this.container) return;

    const currentLocale = i18n.getLocale();
    const currentTheme = themeService.getTheme();
    const isKm = currentLocale === 'km';

    this.container.innerHTML = `
      <div class="min-h-screen w-full flex flex-col justify-between items-center p-4 sm:p-6 bg-[#0c0c0e] text-zinc-100 relative overflow-x-hidden select-none font-sans">
        <!-- Ambient Subtle Background Glow -->
        <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-zinc-800/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Top Controls (Language & Quick Actions) -->
        <div class="w-full max-w-[420px] flex items-center justify-end gap-2 pt-2 z-10">
          <!-- Language Toggle -->
          <button id="login-btn-lang" 
                  type="button"
                  title="${isKm ? 'Switch to English' : 'ប្តូរទៅភាសាខ្មែរ'}"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-400 hover:text-white transition-all cursor-pointer">
            ${getIcon('globe', 'w-3.5 h-3.5 text-zinc-400')}
            <span class="font-semibold text-[11px]">${isKm ? 'ខ្មែរ' : 'EN'}</span>
          </button>
        </div>

        <!-- Main Login Card -->
        <div class="w-full max-w-[420px] bg-[#18181b] border border-zinc-800/80 rounded-[28px] shadow-2xl p-7 sm:p-9 relative z-10 my-auto animate-fade-in">
          <!-- Top Brand Header -->
          <div class="flex items-center justify-between mb-10">
            <div class="flex items-center gap-2 text-white font-medium text-lg tracking-tight">
              <span>Resident X</span>
              <span class="text-zinc-400 flex items-center">${getIcon('scanBarcode', 'w-4 h-4 text-zinc-400')}</span>
            </div>
          </div>

          <!-- Title Section -->
          <div class="mb-6 text-left">
            <h1 class="text-3xl font-semibold tracking-tight text-white mb-1.5 ${isKm ? 'font-khmer text-2xl' : ''}">
              ${isKm ? 'ចូលប្រព័ន្ធ' : 'Log in'}
            </h1>
            <p class="text-xs text-zinc-400 font-normal ${isKm ? 'font-khmer' : ''}">
              ${isKm ? 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់ដើម្បីបន្ត' : 'Proceed to Admin Panel'}
            </p>
          </div>

          <!-- Error Alert Banner -->
          <div id="login-error-alert" class="${this.errorMessage ? '' : 'hidden'} mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
            ${getIcon('alert', 'w-4 h-4 flex-shrink-0 text-red-400')}
            <span id="login-error-text">${this.errorMessage}</span>
          </div>

          <!-- Login Form -->
          <form id="login-form" class="space-y-3.5">
            <!-- Username Input -->
            <div>
              <input type="text" 
                     id="login-username" 
                     required 
                     autocomplete="username"
                     placeholder="${isKm ? 'ឈ្មោះគណនី (Username)' : 'Username'}" 
                     class="w-full h-12 px-4 rounded-lg bg-[#27272a] text-white placeholder:text-zinc-500 border border-transparent focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 text-sm transition-all" />
            </div>

            <!-- Password Input -->
            <div class="relative">
              <input type="${this.showPassword ? 'text' : 'password'}" 
                     id="login-password" 
                     required 
                     autocomplete="current-password"
                     placeholder="${isKm ? 'ពាក្យសម្ងាត់ (Password)' : 'Password'}" 
                     class="w-full h-12 pl-4 pr-11 rounded-lg bg-[#27272a] text-white placeholder:text-zinc-500 border border-transparent focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 text-sm transition-all" />
              <button type="button" 
                      id="btn-toggle-password" 
                      class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                      title="${this.showPassword ? 'Hide password' : 'Show password'}">
                ${getIcon(this.showPassword ? 'eye' : 'eyeClosedLashes', 'w-4 h-4')}
              </button>
            </div>

            <!-- Forgot Password Link -->
            <div class="pt-0.5 pb-1 text-left">
              <button type="button" id="link-forgot-password" class="text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer inline-block bg-transparent border-none p-0">
                ${isKm ? 'ភ្លេចពាក្យសម្ងាត់?' : 'Forgot password?'}
              </button>
            </div>

            <!-- Submit Button (Solid White with Black Text) -->
            <button type="submit" 
                    id="btn-login-submit"
                    ${this.isLoading ? 'disabled' : ''}
                    class="w-full h-12 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 mt-2">
              ${this.isLoading ? `
                <div class="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin"></div>
                <span>${isKm ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Logging in...'}</span>
              ` : `
                <span>${isKm ? 'ចូលប្រព័ន្ធ' : 'Log in'}</span>
              `}
            </button>
          </form>

          <!-- Request Access Link -->
          <div class="mt-4 text-center text-xs text-zinc-400">
            <span>${isKm ? 'មិនទាន់មានគណនី?' : 'New to Resident X?'}</span>
            <button type="button" id="btn-request-access" class="text-[#3b82f6] hover:text-blue-400 hover:underline cursor-pointer font-medium ml-1 bg-transparent border-none p-0">
              ${isKm ? 'ស្នើសុំសិទ្ធិចូល' : 'Request access'}
            </button>
          </div>

          <!-- Quick Demo Accounts Bar -->
          <div class="mt-6 pt-4 border-t border-zinc-800/80">
            <div class="flex items-center justify-between text-[11px] text-zinc-500 mb-2">
              <span>${isKm ? 'គណនីគំរូរហ័ស:' : 'Demo quick fill:'}</span>
              <button type="button" id="btn-login-cloud-sync" class="text-zinc-400 hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer text-[11px] bg-transparent border-none p-0">
                <span class="btn-login-sync-icon flex items-center">${getIcon('cloudDownload', 'w-3 h-3')}</span>
                <span id="btn-login-cloud-sync-text">${isKm ? 'Sync គណនី' : 'Sync Sheet'}</span>
              </button>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <button type="button" data-demo="admin" data-demo-pass="admin123" 
                      class="px-2 py-1.5 rounded-md bg-zinc-800/70 hover:bg-zinc-700/90 text-zinc-300 hover:text-white text-[11px] font-medium transition-all text-center border border-zinc-700/40 cursor-pointer">
                Admin
              </button>
              <button type="button" data-demo="director1" data-demo-pass="director123" 
                      class="px-2 py-1.5 rounded-md bg-zinc-800/70 hover:bg-zinc-700/90 text-zinc-300 hover:text-white text-[11px] font-medium transition-all text-center border border-zinc-700/40 cursor-pointer">
                Director
              </button>
              <button type="button" data-demo="teacher1" data-demo-pass="teacher123" 
                      class="px-2 py-1.5 rounded-md bg-zinc-800/70 hover:bg-zinc-700/90 text-zinc-300 hover:text-white text-[11px] font-medium transition-all text-center border border-zinc-700/40 cursor-pointer">
                Teacher
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom Footer Links -->
        <div class="w-full max-w-[420px] flex items-center justify-center gap-6 text-xs text-zinc-500 pb-4 z-10">
          <button type="button" class="footer-link hover:text-zinc-400 transition-colors bg-transparent border-none p-0 cursor-pointer">Customer Centre</button>
          <button type="button" class="footer-link hover:text-zinc-400 transition-colors bg-transparent border-none p-0 cursor-pointer">Terms</button>
          <button type="button" class="footer-link hover:text-zinc-400 transition-colors bg-transparent border-none p-0 cursor-pointer">Privacy</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Cloud Sync Accounts click on login page
    const syncBtn = document.getElementById('btn-login-cloud-sync');
    const syncText = document.getElementById('btn-login-cloud-sync-text');
    const syncIcon = syncBtn?.querySelector('.btn-login-sync-icon');
    syncBtn?.addEventListener('click', async () => {
      syncBtn.disabled = true;
      if (syncIcon) syncIcon.innerHTML = getIcon('loader2', 'w-3 h-3 animate-spin');
      if (syncText) syncText.textContent = i18n.getLocale() === 'km' ? 'កំពុងទាញ...' : 'Syncing...';
      try {
        const res = await AdminDataService.pullFromGoogleSheet({ silent: false });
        if (res.success) {
          this.render();
        }
      } finally {
        syncBtn.disabled = false;
        if (syncIcon) syncIcon.innerHTML = getIcon('cloudDownload', 'w-3 h-3');
        if (syncText) syncText.textContent = i18n.getLocale() === 'km' ? 'Sync គណនី' : 'Sync Sheet';
      }
    });

    // Password visibility toggle
    const toggleBtn = document.getElementById('btn-toggle-password');
    toggleBtn?.addEventListener('click', () => {
      this.showPassword = !this.showPassword;
      const passInput = document.getElementById('login-password');
      if (passInput) {
        passInput.type = this.showPassword ? 'text' : 'password';
      }
      toggleBtn.innerHTML = getIcon(this.showPassword ? 'eye' : 'eyeClosedLashes', 'w-4 h-4');
    });

    // Language Toggle
    const langBtn = document.getElementById('login-btn-lang');
    langBtn?.addEventListener('click', () => {
      const nextLang = i18n.getLocale() === 'km' ? 'en' : 'km';
      i18n.setLocale(nextLang);
      this.render();
    });

    // Forgot password info
    const forgotBtn = document.getElementById('link-forgot-password');
    forgotBtn?.addEventListener('click', () => {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin) ដើម្បីកំណត់ពាក្យសម្ងាត់ឡើងវិញ។' : 'Please contact the system administrator to reset your password.');
    });

    // Request access info
    const requestBtn = document.getElementById('btn-request-access');
    requestBtn?.addEventListener('click', () => {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមទាក់ទងអ្នកគ្រប់គ្រងសាលាដើម្បីទទួលបានគណនីប្រើប្រាស់។' : 'Please contact your school administrator to obtain an account.');
    });

    // Footer links
    this.container.querySelectorAll('.footer-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        toast.info(`${e.target.textContent} • SmartSchool SMS`);
      });
    });

    // Demo Account Quick Fill Click
    this.container.querySelectorAll('button[data-demo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const userInput = document.getElementById('login-username');
        const passInput = document.getElementById('login-password');
        const userVal = btn.getAttribute('data-demo') || 'admin';
        const passVal = btn.getAttribute('data-demo-pass') || 'admin123';

        if (userInput) userInput.value = userVal;
        if (passInput) passInput.value = passVal;

        // Auto submit for fast login
        this.handleLogin();
      });
    });

    // Form submission
    const form = document.getElementById('login-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
  }

  async handleLogin() {
    const userInput = document.getElementById('login-username');
    const passInput = document.getElementById('login-password');
    const errorAlert = document.getElementById('login-error-alert');
    const errorText = document.getElementById('login-error-text');
    const submitBtn = document.getElementById('btn-login-submit');

    const username = userInput?.value || '';
    const password = passInput?.value || '';
    const isKm = i18n.getLocale() === 'km';

    this.errorMessage = '';
    if (errorAlert) errorAlert.classList.add('hidden');

    if (!username || !password) {
      this.showError(isKm ? 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់' : 'Please enter both username and password.');
      return;
    }

    try {
      this.isLoading = true;
      if (submitBtn) {
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.innerHTML = `
          <div class="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin"></div>
          <span>${isKm ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Logging in...'}</span>
        `;
      }

      const user = await authService.login(username, password);
      toast.success(
        isKm
          ? `សូមស្វាគមន៍មកកាន់ប្រព័ន្ធ, ${user.displayName}!`
          : `Welcome back, ${user.displayName}!`
      );

      if (this.onLoginSuccess) {
        this.onLoginSuccess(user);
      }
    } catch (err) {
      console.error('Login error:', err);
      this.showError(err.message);
    } finally {
      this.isLoading = false;
      if (submitBtn) {
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = `
          <span>${isKm ? 'ចូលប្រព័ន្ធ' : 'Log in'}</span>
        `;
      }
    }
  }

  showError(msg) {
    this.errorMessage = msg;
    const errorAlert = document.getElementById('login-error-alert');
    const errorText = document.getElementById('login-error-text');
    if (errorAlert && errorText) {
      errorText.textContent = msg;
      errorAlert.classList.remove('hidden');
    }
  }
}
