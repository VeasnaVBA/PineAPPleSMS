/**
 * Global Search Modal (Command Palette Ctrl+K)
 * Fast IndexedDB queries across Students, Teachers, and Classes.
 */
import { SearchService } from '../services/searchService.js';
import { getIcon } from './icons.js';
import { t } from '../i18n/i18n.js';

export class SearchModal {
  static open() {
    // Prevent duplicate modals
    if (document.getElementById('global-search-modal')) return;

    const modalEl = document.createElement('div');
    modalEl.id = 'global-search-modal';
    modalEl.className = 'fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-background/80 backdrop-blur-sm animate-fade-in select-none';

    modalEl.innerHTML = `
      <div class="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col transform transition-all animate-slide-down">
        <!-- Search Input Bar -->
        <div class="flex items-center px-4 py-3 border-b border-border gap-3">
          <span class="text-muted-foreground">${getIcon('search', 'w-4 h-4')}</span>
          <input type="text" 
                 id="cmd-search-input" 
                 placeholder="${t('topbar.searchPlaceholder')}"
                 class="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none border-0" />
          <kbd class="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        <!-- Search Results Container -->
        <div id="cmd-results-box" class="max-h-96 overflow-y-auto p-2 text-xs divide-y divide-border/60">
          <div class="p-6 text-center text-muted-foreground">
            <p>Type to search across students, teachers, and classes...</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-2 border-t border-border bg-muted/40 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>Search powered by <strong>IndexedDB</strong></span>
          <span class="font-mono">Press ESC to close</span>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    const input = modalEl.querySelector('#cmd-search-input');
    const resultsBox = modalEl.querySelector('#cmd-results-box');

    input.focus();

    const close = () => {
      modalEl.remove();
    };

    let isMouseDownOnBackdrop = false;
    modalEl.addEventListener('mousedown', (e) => {
      isMouseDownOnBackdrop = (e.target === modalEl);
    });

    modalEl.addEventListener('click', (e) => {
      if (isMouseDownOnBackdrop && e.target === modalEl) close();
      isMouseDownOnBackdrop = false;
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // Debounced search query
    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const q = e.target.value;
        if (!q.trim()) {
          resultsBox.innerHTML = `<div class="p-6 text-center text-muted-foreground"><p>Type to search...</p></div>`;
          return;
        }

        resultsBox.innerHTML = `<div class="p-4 text-center text-muted-foreground"><div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div></div>`;
        const res = await SearchService.search(q);
        SearchModal.renderResults(resultsBox, res, close);
      }, 150);
    });
  }

  static renderResults(container, res, closeFn) {
    if (res.totalCount === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-muted-foreground">
          <p>No results found.</p>
        </div>
      `;
      return;
    }

    let html = '';

    // Students
    if (res.students.length > 0) {
      html += `
        <div class="py-2">
          <span class="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Students (${res.students.length})</span>
          ${res.students.map(s => `
            <a href="#students" class="cmd-result-item flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-foreground group" data-route="students">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-primary">${getIcon('students', 'w-4 h-4')}</span>
                <div class="min-w-0">
                  <p class="font-medium text-xs font-khmer truncate">${s.khmerName || s.englishName}</p>
                  <p class="text-[11px] text-muted-foreground truncate font-mono">${s.studentId} • ${s.englishName || ''}</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">${s.status}</span>
            </a>
          `).join('')}
        </div>
      `;
    }

    // Teachers
    if (res.teachers.length > 0) {
      html += `
        <div class="py-2">
          <span class="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Faculty Teachers (${res.teachers.length})</span>
          ${res.teachers.map(t => `
            <a href="#teachers" class="cmd-result-item flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-foreground group" data-route="teachers">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-indigo-500">${getIcon('teachers', 'w-4 h-4')}</span>
                <div class="min-w-0">
                  <p class="font-medium text-xs font-khmer truncate">${t.khmerName || t.englishName}</p>
                  <p class="text-[11px] text-muted-foreground truncate">${t.teacherId} • ${t.subject || 'Faculty'}</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">${t.status}</span>
            </a>
          `).join('')}
        </div>
      `;
    }

    // Classes
    if (res.classes.length > 0) {
      html += `
        <div class="py-2">
          <span class="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Configured Classes (${res.classes.length})</span>
          ${res.classes.map(c => `
            <a href="#classes" class="cmd-result-item flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-foreground group" data-route="classes">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-amber-500">${getIcon('classes', 'w-4 h-4')}</span>
                <div class="min-w-0">
                  <p class="font-medium text-xs font-khmer truncate">${c.name}</p>
                  <p class="text-[11px] text-muted-foreground truncate">Room: ${c.room || 'N/A'}</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground font-mono">Class</span>
            </a>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;

    // Click item closes modal
    container.querySelectorAll('.cmd-result-item').forEach(item => {
      item.addEventListener('click', () => {
        closeFn();
      });
    });
  }
}
