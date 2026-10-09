/**
 * Reusable Inactive / Dropout Reason Modal Prompt
 * Allows users to choose:
 * - Date (កាលបរិច្ឆេទ)
 * - Semester (ឆមាសទី១ ឬ ឆមាសទី២)
 * - Reason (មូលហេតុបោះបង់ការសិក្សា)
 * - Remarks (សម្គាល់ផ្សេងៗ)
 */
import { getIcon } from './icons.js';
import { toInputDateFormat } from '../utils/dateUtils.js';

export function openInactiveReasonPrompt({ initialData = null, isKm = true, onConfirm, onCancel }) {
  const defaultDate = toInputDateFormat(initialData?.dropoutDate) || new Date().toISOString().split('T')[0];
  const currentSemester = initialData?.dropoutSemester || 'ឆមាសទី១';
  const currentReason = initialData?.dropoutReason || '';
  const currentRemarks = initialData?.dropoutRemarks || '';

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in select-none';
  overlay.innerHTML = `
    <div class="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-down">
      <!-- Header: Graduation Cap icon + Title + Close (X) button -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-border select-none">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            ${getIcon('graduationCap', 'w-5 h-5')}
          </div>
          <h3 class="text-base font-bold tracking-tight text-foreground font-khmer">
            មូលហេតុនៃការបោះបង់ <span class="text-xs font-normal text-muted-foreground font-sans">(Inactive Reason)</span>
          </h3>
        </div>
        <button type="button" id="btn-dropout-close" class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer" title="Close">
          ${getIcon('x', 'w-4 h-4')}
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4 text-foreground">
        <!-- Date & Semester Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-border/60">
          <!-- Calendar icon + Date input -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-foreground font-khmer">
              ${getIcon('calendar', 'w-3.5 h-3.5 text-primary')}
              <span>កាលបរិច្ឆេទ (ថ្ងៃនេះ):</span>
            </label>
            <input type="date" 
                   id="input-dropout-date" 
                   value="${defaultDate}" 
                   class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs font-mono font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
          </div>

          <!-- Semester Selector (ឆមាសទី១ / ឆមាសទី២) -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-foreground font-khmer">
              ឆមាស <span class="text-destructive">*</span>
            </label>
            <div class="grid grid-cols-2 gap-2 h-10">
              <button type="button" 
                      id="btn-semester-1" 
                      class="semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer ${currentSemester === 'ឆមាសទី១' ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-input bg-background hover:bg-muted text-foreground'}">
                <span>ឆមាសទី១</span>
              </button>
              <button type="button" 
                      id="btn-semester-2" 
                      class="semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer ${currentSemester === 'ឆមាសទី២' ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-input bg-background hover:bg-muted text-foreground'}">
                <span>ឆមាសទី២</span>
              </button>
            </div>
            <input type="hidden" id="input-dropout-semester" value="${currentSemester}" />
          </div>
        </div>

        <!-- Main Input: Reason (Required) -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-foreground font-khmer">
            មូលហេតុបោះបង់ការសិក្សា <span class="text-destructive font-bold">*</span>
          </label>
          <textarea id="input-dropout-reason" 
                    rows="3" 
                    placeholder="បញ្ចូលមូលហេតុនៃការបោះបង់ (ឧ. ជីវភាពគ្រួសារ, ផ្លាស់ប្តូរទីលំនៅ, ទៅធ្វើការ...)" 
                    class="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-khmer resize-none box-border shadow-xs leading-relaxed">${currentReason}</textarea>
          <p id="err-dropout-reason" class="text-xs text-destructive font-khmer hidden">សូមបញ្ចូលមូលហេតុនៃការបោះបង់ការសិក្សា</p>
        </div>

        <!-- Secondary Input: Remarks (Optional) -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-muted-foreground font-khmer">
            សម្គាល់ផ្សេងៗ (ប្រសិនបើមាន)
          </label>
          <input type="text" 
                 id="input-dropout-remarks" 
                 value="${currentRemarks}" 
                 placeholder="សម្គាល់ផ្សេងៗ..." 
                 class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-khmer box-border shadow-xs" />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20 select-none">
        <button type="button" 
                id="btn-dropout-cancel" 
                class="px-4 py-2 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors font-khmer shadow-xs cursor-pointer">
          បោះបង់
        </button>
        <button type="button" 
                id="btn-dropout-submit" 
                class="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-xs transition-colors font-khmer flex items-center gap-1.5 cursor-pointer">
          ${getIcon('check', 'w-3.5 h-3.5')}
          <span>យល់ព្រម</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const reasonInput = overlay.querySelector('#input-dropout-reason');
  const remarksInput = overlay.querySelector('#input-dropout-remarks');
  const dateInput = overlay.querySelector('#input-dropout-date');
  const semInput = overlay.querySelector('#input-dropout-semester');
  const errReason = overlay.querySelector('#err-dropout-reason');
  const btnSem1 = overlay.querySelector('#btn-semester-1');
  const btnSem2 = overlay.querySelector('#btn-semester-2');

  setTimeout(() => reasonInput?.focus(), 50);

  btnSem1?.addEventListener('click', () => {
    semInput.value = 'ឆមាសទី១';
    btnSem1.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-primary bg-primary text-primary-foreground font-bold cursor-pointer';
    btnSem2.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-input bg-background hover:bg-muted text-foreground cursor-pointer';
  });

  btnSem2?.addEventListener('click', () => {
    semInput.value = 'ឆមាសទី២';
    btnSem2.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-primary bg-primary text-primary-foreground font-bold cursor-pointer';
    btnSem1.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-input bg-background hover:bg-muted text-foreground cursor-pointer';
  });

  const handleCancel = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };

  overlay.querySelector('#btn-dropout-close')?.addEventListener('click', handleCancel);
  overlay.querySelector('#btn-dropout-cancel')?.addEventListener('click', handleCancel);

  overlay.querySelector('#btn-dropout-submit')?.addEventListener('click', () => {
    const reasonVal = reasonInput?.value.trim();
    if (!reasonVal) {
      errReason?.classList.remove('hidden');
      reasonInput?.focus();
      return;
    }
    errReason?.classList.add('hidden');

    const result = {
      dropoutDate: dateInput?.value || defaultDate,
      dropoutSemester: semInput?.value || 'ឆមាសទី១',
      dropoutReason: reasonVal,
      dropoutRemarks: remarksInput?.value.trim() || ''
    };

    overlay.remove();
    if (onConfirm) onConfirm(result);
  });
}
