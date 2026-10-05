/**
 * Login Page Component
 * Minimalist Resident X UI with full Light & Dark mode support:
 * - Dark Mode: Deep dark obsidian (#0c0c0e) with dark card (#18181b) and white button
 * - Light Mode: Clean crisp white background (#f4f4f5) with white card (#ffffff) and black button
 */
import { authService } from '../services/authService.js';
import { themeService } from '../services/themeService.js';
import { AdminDataService } from '../services/adminDataService.js';
import { i18n, t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { APP_LOGO_BASE64 } from '../config/appLogo.js';

export class LoginPage {
  constructor(containerId, onLoginSuccess) {
    this.container = document.getElementById(containerId);
    this.onLoginSuccess = onLoginSuccess;
    this.showPassword = false;
    this.errorMessage = '';
    this.isLoading = false;

    // Re-render when theme or language changes
    themeService.subscribe(() => this.render());
    i18n.subscribe(() => this.render());
  }

  render() {
    if (!this.container) return;

    const currentLocale = i18n.getLocale();
    const isKm = currentLocale === 'km';
    const isDark = themeService.isDark();

    // Theme-dependent design tokens
    const bgClass = isDark ? 'bg-[#0c0c0e] text-zinc-100' : 'bg-[#f4f4f5] text-zinc-900';
    const cardBgClass = isDark 
      ? 'bg-[#18181b] border-zinc-800/80 shadow-2xl' 
      : 'bg-white border-zinc-200/90 shadow-xl shadow-zinc-900/5';
    const brandTextClass = isDark ? 'text-white' : 'text-zinc-900';
    const scanIconClass = isDark ? 'text-zinc-400' : 'text-zinc-500';
    const titleClass = isDark ? 'text-white' : 'text-zinc-900';
    const subtitleClass = isDark ? 'text-zinc-400' : 'text-zinc-500';
    
    // Inputs
    const inputClass = isDark
      ? 'bg-[#27272a] text-white placeholder:text-zinc-500 border border-transparent focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400'
      : 'bg-zinc-100/90 text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300';
    const eyeIconClass = isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-800';
    const forgotPassClass = isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-500 hover:text-zinc-900';

    // Submit Button
    const btnSubmitClass = isDark
      ? 'bg-white hover:bg-zinc-200 text-black shadow-md'
      : 'bg-zinc-900 hover:bg-black text-white shadow-md';
    const btnSpinnerBorder = isDark ? 'border-black' : 'border-white';

    // Request Access Link
    const newToTextClass = isDark ? 'text-zinc-400' : 'text-zinc-500';
    const requestAccessClass = isDark ? 'text-[#3b82f6] hover:text-blue-400' : 'text-blue-600 hover:text-blue-700';

    // Demo Chips & Divider
    const dividerClass = isDark ? 'border-zinc-800/80' : 'border-zinc-200/80';
    const demoLabelClass = isDark ? 'text-zinc-500' : 'text-zinc-400';
    const demoSyncClass = isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900';
    const demoChipClass = isDark
      ? 'bg-zinc-800/70 hover:bg-zinc-700/90 text-zinc-300 hover:text-white border-zinc-700/40'
      : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 hover:text-zinc-900 border-zinc-200';

    // Footer
    const footerLinkClass = isDark ? 'text-zinc-500 hover:text-zinc-400' : 'text-zinc-400 hover:text-zinc-600';

    this.container.innerHTML = `
      <div class="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 ${bgClass} relative overflow-x-hidden select-none font-sans transition-colors duration-200">
        
        <!-- Main Login Card -->
        <div class="w-full max-w-[420px] border rounded-[28px] p-7 sm:p-9 relative z-10 my-auto animate-fade-in ${cardBgClass} transition-colors duration-200">
          
          <!-- Title & Logo Header Section -->
          <div class="mb-6 flex items-center justify-between gap-4">
            <div class="text-left flex-1 min-w-0">
              <h1 class="text-3xl font-semibold tracking-tight mb-1.5 ${titleClass} ${isKm ? 'font-khmer text-2xl' : ''}">
                ${isKm ? 'ចូលប្រព័ន្ធ' : 'Log in'}
              </h1>
              <p class="text-xs font-normal ${subtitleClass} ${isKm ? 'font-khmer' : ''}">
                ${isKm ? 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់ដើម្បីបន្ត' : 'Proceed to Admin Panel'}
              </p>
            </div>
            <div class="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 flex items-center justify-center">
              <img src="${APP_LOGO_BASE64}" alt="Logo" class="w-full h-full object-contain" />
            </div>
          </div>

          <!-- Error Alert Banner -->
          <div id="login-error-alert" class="${this.errorMessage ? '' : 'hidden'} mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs flex items-center gap-2">
            ${getIcon('alert', 'w-4 h-4 flex-shrink-0')}
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
                     class="w-full h-12 px-4 rounded-lg text-sm transition-all ${inputClass}" />
            </div>

            <!-- Password Input -->
            <div class="relative">
              <input type="${this.showPassword ? 'text' : 'password'}" 
                     id="login-password" 
                     required 
                     autocomplete="current-password"
                     placeholder="${isKm ? 'ពាក្យសម្ងាត់ (Password)' : 'Password'}" 
                     class="w-full h-12 pl-4 pr-11 rounded-lg text-sm transition-all ${inputClass}" />
              <button type="button" 
                      id="btn-toggle-password" 
                      class="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer transition-colors ${eyeIconClass}"
                      title="${this.showPassword ? 'Hide password' : 'Show password'}">
                ${getIcon(this.showPassword ? 'eye' : 'eyeClosedLashes', 'w-4 h-4')}
              </button>
            </div>

            <!-- Forgot Password Link -->
            <div class="pt-0.5 pb-1 text-left">
              <button type="button" id="link-forgot-password" class="text-xs transition-colors cursor-pointer inline-block bg-transparent border-none p-0 ${forgotPassClass}">
                ${isKm ? 'ភ្លេចពាក្យសម្ងាត់?' : 'Forgot password?'}
              </button>
            </div>

            <!-- Submit Button -->
            <button type="submit" 
                    id="btn-login-submit"
                    ${this.isLoading ? 'disabled' : ''}
                    class="w-full h-12 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 mt-2 ${btnSubmitClass}">
              ${this.isLoading ? `
                <div class="w-4 h-4 rounded-full border-2 ${btnSpinnerBorder} border-t-transparent animate-spin"></div>
                <span>${isKm ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Logging in...'}</span>
              ` : `
                <span>${isKm ? 'ចូលប្រព័ន្ធ' : 'Log in'}</span>
              `}
            </button>
          </form>

          <!-- Request Access Link -->
          <div class="mt-4 text-center text-xs ${newToTextClass}">
            <span>${isKm ? 'មិនទាន់មានគណនី?' : 'New to Resident X?'}</span>
            <button type="button" id="btn-request-access" class="hover:underline cursor-pointer font-medium ml-1 bg-transparent border-none p-0 ${requestAccessClass}">
              ${isKm ? 'ស្នើសុំសិទ្ធិចូល' : 'Request access'}
            </button>
          </div>

          <!-- Quick Demo Accounts Bar -->
          <div class="mt-6 pt-4 border-t ${dividerClass}">
            <div class="flex items-center justify-between text-[11px] ${demoLabelClass} mb-2">
              <span>${isKm ? 'គណនីគំរូរហ័ស:' : 'Demo quick fill:'}</span>
              <button type="button" id="btn-login-cloud-sync" class="inline-flex items-center gap-1 transition-colors cursor-pointer text-[11px] bg-transparent border-none p-0 ${demoSyncClass}">
                <span class="btn-login-sync-icon flex items-center">${getIcon('cloudDownload', 'w-3 h-3')}</span>
                <span id="btn-login-cloud-sync-text">${isKm ? 'Sync គណនី' : 'Sync Sheet'}</span>
              </button>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <button type="button" data-demo="admin" data-demo-pass="admin123" 
                      class="px-2 py-1.5 rounded-md text-[11px] font-medium transition-all text-center border cursor-pointer ${demoChipClass}">
                Admin
              </button>
              <button type="button" data-demo="director1" data-demo-pass="director123" 
                      class="px-2 py-1.5 rounded-md text-[11px] font-medium transition-all text-center border cursor-pointer ${demoChipClass}">
                Director
              </button>
              <button type="button" data-demo="teacher1" data-demo-pass="teacher123" 
                      class="px-2 py-1.5 rounded-md text-[11px] font-medium transition-all text-center border cursor-pointer ${demoChipClass}">
                Teacher
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom Footer Links -->
        <div class="w-full max-w-[420px] flex items-center justify-center gap-6 text-xs pb-4 z-10 mt-6">
          <button type="button" class="footer-link transition-colors bg-transparent border-none p-0 cursor-pointer ${footerLinkClass}">Customer Centre</button>
          <button type="button" class="footer-link transition-colors bg-transparent border-none p-0 cursor-pointer ${footerLinkClass}">Terms</button>
          <button type="button" class="footer-link transition-colors bg-transparent border-none p-0 cursor-pointer ${footerLinkClass}">Privacy</button>
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
    const isDark = themeService.isDark();
    const btnSpinnerBorder = isDark ? 'border-black' : 'border-white';

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
          <div class="w-4 h-4 rounded-full border-2 ${btnSpinnerBorder} border-t-transparent animate-spin"></div>
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
