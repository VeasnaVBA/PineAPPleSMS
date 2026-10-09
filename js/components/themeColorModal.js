/**
 * Theme Color Customizer Modal Component
 * Interactive shadcn/ui-styled dialog for selecting and previewing
 * primary brand and button colors with presets, custom picker, and live feedback.
 */
import { i18n, t } from '../i18n/i18n.js';
import { themeService, PRESET_PRIMARY_COLORS } from '../services/themeService.js';
import { getIcon } from './icons.js';
import { toast } from './toast.js';

export const ThemeColorModal = {
  activeModal: null,

  open() {
    this.close();

    const isKm = i18n.getLocale() === 'km';
    const activeColor = themeService.getEffectivePrimaryColor().toLowerCase();
    const currentColor = themeService.getPrimaryColor() ? themeService.getPrimaryColor().toLowerCase() : null;

    const overlay = document.createElement('div');
    overlay.id = 'theme-color-modal-overlay';
    overlay.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none';

    overlay.innerHTML = `
      <div class="bg-card text-card-foreground border border-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-scale-up" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-border flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              ${getIcon('palette', 'w-4 h-4')}
            </div>
            <div>
              <h3 class="font-bold text-base text-foreground leading-tight ${isKm ? 'font-khmer' : ''}">
                ${t('theme.colorTitle')}
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5 ${isKm ? 'font-khmer' : ''}">
                ${t('theme.colorSubtitle')}
              </p>
            </div>
          </div>
          <button id="btn-close-theme-modal" 
                  type="button" 
                  aria-label="Close" 
                  class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
            ${getIcon('x', 'w-4 h-4')}
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-5">
          <!-- 1. Preset Swatches -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-foreground uppercase tracking-wider ${isKm ? 'font-khmer' : ''}">
              ${t('theme.presetColors')}
            </label>
            <div class="grid grid-cols-7 gap-2 pt-1">
              ${PRESET_PRIMARY_COLORS.map(c => {
                const isSelected = (!currentColor && c.id === 'default') || (currentColor === c.hex.toLowerCase());
                return `
                  <button type="button"
                          class="preset-color-swatch group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 shadow-xs cursor-pointer border ${isSelected ? 'ring-2 ring-offset-2 ring-primary ring-offset-background scale-105 border-foreground' : 'border-border/60 hover:scale-105'}"
                          data-hex="${c.hex}"
                          title="${isKm ? c.nameKm : c.name}"
                          style="background-color: ${c.hex};">
                    ${isSelected ? `<span class="text-white drop-shadow-md">${getIcon('check', 'w-4 h-4')}</span>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 2. Custom Color Input -->
          <div class="space-y-2 pt-1">
            <label class="text-xs font-semibold text-foreground uppercase tracking-wider ${isKm ? 'font-khmer' : ''}">
              ${t('theme.customColor')}
            </label>
            <div class="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30">
              <input type="color" 
                     id="input-theme-custom-color" 
                     value="${activeColor}" 
                     class="w-10 h-10 rounded-md border border-border cursor-pointer p-0.5 bg-background shadow-xs shrink-0" />
              <div class="flex-1 min-w-0 flex items-center gap-2">
                <input type="text" 
                       id="input-theme-hex-text" 
                       value="${activeColor}" 
                       maxlength="7"
                       class="px-3 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono font-semibold w-28 uppercase text-center focus:outline-none focus:ring-1 focus:ring-ring" />
                <span class="text-[11px] text-muted-foreground truncate ${isKm ? 'font-khmer' : ''}">
                  ${t('theme.customColorHint')}
                </span>
              </div>
            </div>
          </div>

          <!-- 3. Live Preview Card -->
          <div class="space-y-2 pt-1">
            <label class="text-xs font-semibold text-foreground uppercase tracking-wider ${isKm ? 'font-khmer' : ''}">
              ${t('theme.preview')}
            </label>
            <div class="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" class="btn-primary px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 pointer-events-none">
                  ${getIcon('plus', 'w-3.5 h-3.5')}
                  <span class="${isKm ? 'font-khmer' : ''}">${t('theme.previewAddBtn')}</span>
                </button>
                <button type="button" class="btn-primary px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 pointer-events-none">
                  ${getIcon('save', 'w-3.5 h-3.5')}
                  <span class="${isKm ? 'font-khmer' : ''}">${t('theme.previewSaveBtn')}</span>
                </button>
                <button type="button" class="btn-outline px-3 py-1.5 rounded-md text-xs font-medium shadow-xs flex items-center gap-1.5 pointer-events-none">
                  ${getIcon('download', 'w-3.5 h-3.5')}
                  <span class="${isKm ? 'font-khmer' : ''}">${t('common.export')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
          <button id="btn-theme-reset" 
                  type="button" 
                  class="btn-outline px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer">
            ${getIcon('rotateCcw', 'w-3.5 h-3.5')}
            <span class="${isKm ? 'font-khmer' : ''}">${t('theme.resetDefault')}</span>
          </button>
          <button id="btn-theme-apply-done" 
                  type="button" 
                  class="btn-primary px-4 py-1.5 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer">
            ${getIcon('check', 'w-3.5 h-3.5')}
            <span class="${isKm ? 'font-khmer' : ''}">${t('common.done')}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.activeModal = overlay;
    this.bindEvents(overlay);
  },

  close() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  },

  bindEvents(overlay) {
    const isKm = i18n.getLocale() === 'km';
    const closeBtn = overlay.querySelector('#btn-close-theme-modal');
    const doneBtn = overlay.querySelector('#btn-theme-apply-done');
    const resetBtn = overlay.querySelector('#btn-theme-reset');
    const colorPicker = overlay.querySelector('#input-theme-custom-color');
    const hexInput = overlay.querySelector('#input-theme-hex-text');

    const updateActiveUI = (hex) => {
      const formattedHex = hex.toLowerCase();
      colorPicker.value = formattedHex;
      hexInput.value = formattedHex.toUpperCase();

      // Update swatch active state
      overlay.querySelectorAll('.preset-color-swatch').forEach(btn => {
        const swatchHex = btn.getAttribute('data-hex').toLowerCase();
        const isMatch = swatchHex === formattedHex;
        if (isMatch) {
          btn.className = 'preset-color-swatch group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 shadow-xs cursor-pointer border ring-2 ring-offset-2 ring-primary ring-offset-background scale-105 border-foreground';
          btn.innerHTML = `<span class="text-white drop-shadow-md">${getIcon('check', 'w-4 h-4')}</span>`;
        } else {
          btn.className = 'preset-color-swatch group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 shadow-xs cursor-pointer border border-border/60 hover:scale-105';
          btn.innerHTML = '';
        }
      });
    };

    // Close handlers
    closeBtn?.addEventListener('click', () => {
      import('../services/adminDataService.js').then(({ AdminDataService }) => {
        AdminDataService.queueAutoSync();
      }).catch(() => {});
      this.close();
    });
    doneBtn?.addEventListener('click', () => {
      import('../services/adminDataService.js').then(({ AdminDataService }) => {
        AdminDataService.queueAutoSync();
      }).catch(() => {});
      toast.success(isKm ? 'បានផ្លាស់ប្តូរពណ៌ចម្បងដោយជោគជ័យ!' : 'Primary theme color applied successfully!');
      this.close();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Preset Swatches
    overlay.querySelectorAll('.preset-color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-hex');
        if (hex === '#18181b' && !themeService.isDark()) {
          themeService.setPrimaryColor(hex);
        } else {
          themeService.setPrimaryColor(hex);
        }
        updateActiveUI(hex);
      });
    });

    // Custom Picker Input
    colorPicker?.addEventListener('input', (e) => {
      const hex = e.target.value;
      themeService.setPrimaryColor(hex);
      updateActiveUI(hex);
    });

    // Hex Text Input
    hexInput?.addEventListener('input', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        themeService.setPrimaryColor(val);
        updateActiveUI(val);
      }
    });

    // Reset button
    resetBtn?.addEventListener('click', () => {
      themeService.resetPrimaryColor();
      const defaultHex = themeService.getEffectivePrimaryColor();
      updateActiveUI(defaultHex);
      toast.info(isKm ? 'បានកំណត់ពណ៌ដើមឡើងវិញ' : 'Reset to default color');
    });

    // Escape key
    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', onKeydown);
      }
    };
    document.addEventListener('keydown', onKeydown);
  }
};
