/**
 * Login Page Component
 * Professional, shadcn-inspired authentication screen with demo quick-fill,
 * show/hide password, language toggle, and theme switching.
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
  }

  render() {
    if (!this.container) return;

    const currentLocale = i18n.getLocale();
    const currentTheme = themeService.getTheme();

    this.container.innerHTML = `
      <div class="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-background relative overflow-hidden select-none">
        <!-- Ambient Background Glows -->
        <div class="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Top Controls (Language & Theme) -->
        <div class="absolute top-4 right-4 flex items-center gap-2 z-10">
          <!-- Language Toggle -->
          <button id="login-btn-lang" 
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-muted text-xs font-medium text-foreground transition-all">
            ${getIcon('globe', 'w-3.5 h-3.5 text-muted-foreground')}
            <span class="uppercase font-semibold">${currentLocale === 'km' ? 'ខ្មែរ' : 'EN'}</span>
          </button>

          <!-- Theme Toggle -->
          <button id="login-btn-theme" 
                  class="p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
            ${getIcon(currentTheme === 'dark' ? 'moon' : 'sun', 'w-4 h-4')}
          </button>
        </div>

        <!-- Login Card -->
        <div class="w-full max-w-md bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 animate-scale-up">
          <!-- App Header -->
          <div class="flex flex-col items-center text-center mb-6">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25 mb-4">
              ${getIcon('school', 'w-8 h-8')}
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground ${currentLocale === 'km' ? 'font-khmer' : ''}">
              ${currentLocale === 'km' ? 'ប្រព័ន្ធគ្រប់គ្រងសាលារៀន' : 'SmartSchool System'}
            </h1>
            <p class="text-xs text-muted-foreground mt-1">
              ${currentLocale === 'km' ? 'សូមចូលប្រើប្រាស់គណនីរបស់អ្នកដើម្បីបន្ត' : 'Sign in with your credentials to continue'}
            </p>
          </div>

          <!-- Error Alert Banner -->
          <div id="login-error-alert" class="${this.errorMessage ? '' : 'hidden'} mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            ${getIcon('alert', 'w-4 h-4 flex-shrink-0')}
            <span id="login-error-text">${this.errorMessage}</span>
          </div>

          <!-- Form -->
          <form id="login-form" class="space-y-4">
            <!-- Username Input -->
            <div>
              <label for="login-username" class="block text-xs font-semibold text-foreground mb-1.5">
                ${currentLocale === 'km' ? 'ឈ្មោះគណនី (Username)' : 'Username'}
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  ${getIcon('user', 'w-4 h-4')}
                </span>
                <input type="text" 
                       id="login-username" 
                       required 
                       autocomplete="username"
                       placeholder="${currentLocale === 'km' ? 'បញ្ចូលឈ្មោះគណនី...' : 'Enter your username...'}" 
                       class="w-full h-10 pl-10 pr-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs transition-all" />
              </div>
            </div>

            <!-- Password Input -->
            <div>
              <label for="login-password" class="block text-xs font-semibold text-foreground mb-1.5">
                ${currentLocale === 'km' ? 'ពាក្យសម្ងាត់ (Password)' : 'Password'}
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  ${getIcon('key', 'w-4 h-4')}
                </span>
                <input type="${this.showPassword ? 'text' : 'password'}" 
                       id="login-password" 
                       required 
                       autocomplete="current-password"
                       placeholder="••••••••" 
                       class="w-full h-10 pl-10 pr-10 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs transition-all" />
                <button type="button" 
                        id="btn-toggle-password" 
                        class="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground">
                  ${getIcon(this.showPassword ? 'eyeOff' : 'eye', 'w-4 h-4')}
                </button>
              </div>
            </div>

            <!-- Submit Button -->
            <button type="submit" 
                    id="btn-login-submit"
                    ${this.isLoading ? 'disabled' : ''}
                    class="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              ${this.isLoading ? `
                <div class="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
                <span>${currentLocale === 'km' ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Signing in...'}</span>
              ` : `
                <span>${currentLocale === 'km' ? 'ចូលប្រព័ន្ធ' : 'Sign In'}</span>
                ${getIcon('arrowRight', 'w-4 h-4')}
              `}
            </button>
          </form>

          <!-- Predefined Accounts Quick Fill -->
          <div class="mt-6 pt-5 border-t border-border">
            <p class="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider text-center">
              ${currentLocale === 'km' ? 'គណនីគំរូដែលបានកំណត់ជាស្រេច (Default Predefined Accounts)' : 'Predefined Demo Accounts'}
            </p>
            <div class="space-y-2">
              <button type="button" data-demo="admin" data-demo-pass="admin123"
                      class="w-full px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-left transition-all text-xs flex items-center justify-between group">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-md bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-[10px]">
                    AD
                  </div>
                  <div>
                    <span class="font-bold text-foreground">admin</span>
                    <span class="text-[10px] text-muted-foreground ml-2 font-mono">admin123</span>
                  </div>
                </div>
                <span class="text-[10px] text-primary font-medium group-hover:underline">${currentLocale === 'km' ? 'បំពេញ' : 'Fill'}</span>
              </button>

              <button type="button" data-demo="director1" data-demo-pass="director123"
                      class="w-full px-3 py-2 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-left transition-all text-xs flex items-center justify-between group">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-[10px]">
                    DIR
                  </div>
                  <div>
                    <span class="font-bold text-foreground">director1</span>
                    <span class="text-[10px] text-muted-foreground ml-2 font-mono">director123</span>
                  </div>
                </div>
                <span class="text-[10px] text-purple-600 dark:text-purple-400 font-medium group-hover:underline">${currentLocale === 'km' ? 'បំពេញ' : 'Fill'}</span>
              </button>

              <button type="button" data-demo="teacher1" data-demo-pass="teacher123"
                      class="w-full px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-left transition-all text-xs flex items-center justify-between group">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[10px]">
                    TCH
                  </div>
                  <div>
                    <span class="font-bold text-foreground">teacher1</span>
                    <span class="text-[10px] text-muted-foreground ml-2 font-mono">teacher123</span>
                  </div>
                </div>
                <span class="text-[10px] text-blue-600 dark:text-blue-400 font-medium group-hover:underline">${currentLocale === 'km' ? 'បំពេញ' : 'Fill'}</span>
              </button>
            </div>

            <!-- Cloud Sync Accounts Button -->
            <div class="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-center">
              <button type="button" id="btn-login-cloud-sync"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold shadow-2xs transition-all cursor-pointer">
                <span class="btn-login-sync-icon flex items-center">${getIcon('cloudDownload', 'w-3.5 h-3.5')}</span>
                <span id="btn-login-cloud-sync-text">${currentLocale === 'km' ? 'Sync គណនីពី Google Sheet' : 'Sync Accounts from Google Sheet'}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <p class="text-[11px] text-muted-foreground/60 mt-6 relative z-10 text-center">
          SchoolFlow Local-First Architecture • Offline Ready
        </p>
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
      if (syncIcon) syncIcon.innerHTML = getIcon('loader2', 'w-3.5 h-3.5 animate-spin');
      if (syncText) syncText.textContent = i18n.getLocale() === 'km' ? 'កំពុងទាញទិន្នន័យ...' : 'Pulling accounts...';
      try {
        const res = await AdminDataService.pullFromGoogleSheet({ silent: false });
        if (res.success) {
          this.render();
        }
      } finally {
        syncBtn.disabled = false;
        if (syncIcon) syncIcon.innerHTML = getIcon('cloudDownload', 'w-3.5 h-3.5');
        if (syncText) syncText.textContent = i18n.getLocale() === 'km' ? 'Sync គណនីពី Google Sheet' : 'Sync Accounts from Google Sheet';
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
      toggleBtn.innerHTML = getIcon(this.showPassword ? 'eyeOff' : 'eye', 'w-4 h-4');
    });

    // Language Toggle
    const langBtn = document.getElementById('login-btn-lang');
    langBtn?.addEventListener('click', () => {
      const nextLang = i18n.getLocale() === 'km' ? 'en' : 'km';
      i18n.setLocale(nextLang);
      this.render();
    });

    // Theme Toggle
    const themeBtn = document.getElementById('login-btn-theme');
    themeBtn?.addEventListener('click', () => {
      const cur = themeService.getTheme();
      const next = cur === 'dark' ? 'light' : 'dark';
      themeService.setTheme(next);
      this.render();
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

    this.errorMessage = '';
    if (errorAlert) errorAlert.classList.add('hidden');

    if (!username || !password) {
      this.showError(i18n.getLocale() === 'km' ? 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់' : 'Please enter both username and password.');
      return;
    }

    try {
      this.isLoading = true;
      if (submitBtn) {
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.innerHTML = `
          <div class="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
          <span>Authenticating...</span>
        `;
      }

      const user = await authService.login(username, password);
      toast.success(
        i18n.getLocale() === 'km'
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
          <span>${i18n.getLocale() === 'km' ? 'ចូលប្រព័ន្ធ' : 'Sign In'}</span>
          ${getIcon('arrowRight', 'w-4 h-4')}
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
