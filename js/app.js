/**
 * app.js - Main Application Controller
 * Orchestrates models, views, event listeners and timers per PDR Section 3 & 5.2
 * Extended with Industry-Ready Features: Calendar sync, Stage mode, Undo toasts, Confetti & PWA
 */

import {
  getAllEvents,
  saveEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  toggleEventStatus,
  getEventById,
  getSettings,
  saveSettings,
  exportEventsJSON,
  importEventsJSON,
  getSampleEvents
} from './storage.js';

import { validateEventInput, displayValidationErrors, clearValidationErrors } from './validate.js';
import {
  renderStats,
  renderEventsGrid,
  showToast,
  applyTheme,
  escapeHTML
} from './ui.js';

import {
  startCountdownLoop,
  stopCountdownLoop
} from './countdown.js';

import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  playAlertSound
} from './notify.js';

import { getGoogleCalendarUrl, downloadICSFile } from './calendar.js';
import { openStageMode, closeStageMode } from './stage.js';
import { fireCelebrationConfetti } from './confetti.js';

// Application State
const state = {
  events: [],
  filters: {
    search: '',
    category: 'All',
    statusTab: 'upcoming',
    sortBy: 'soonest',
    viewMode: 'grid' // 'grid' | 'table'
  },
  editingId: null,
  settings: {},
  // Buffer for optimistic deletion with undo
  undoBuffer: new Map()
};

// DOM Elements
const DOM = {
  eventsGrid: document.getElementById('events-grid'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear'),
  sortSelect: document.getElementById('sort-select'),
  categoryPills: document.querySelectorAll('.cat-pill'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  statCards: document.querySelectorAll('.stat-card'),

  // Header & Modals
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  soundToggleBtn: document.getElementById('sound-toggle-btn'),
  notifyStatusBtn: document.getElementById('notify-status-btn'),
  notifyBanner: document.getElementById('notify-banner'),
  enableNotifyBannerBtn: document.getElementById('banner-enable-notify'),
  dismissNotifyBannerBtn: document.getElementById('banner-dismiss-notify'),
  shortcutsBtn: document.getElementById('shortcuts-btn'),

  // View Mode Switcher
  viewGridBtn: document.getElementById('view-mode-grid'),
  viewTableBtn: document.getElementById('view-mode-table'),

  // Add/Edit Event Modal
  eventModal: document.getElementById('event-modal'),
  eventForm: document.getElementById('event-form'),
  modalTitle: document.getElementById('modal-title'),
  closeModalBtns: document.querySelectorAll('[data-close-modal="event-modal"]'),
  openAddModalBtns: document.querySelectorAll('[data-open-modal="event-modal"]'),

  // Backup Modal
  backupModal: document.getElementById('backup-modal'),
  openBackupModalBtn: document.getElementById('open-backup-modal-btn'),
  closeBackupModalBtns: document.querySelectorAll('[data-close-modal="backup-modal"]'),
  exportJsonBtn: document.getElementById('export-json-btn'),
  importFileInput: document.getElementById('import-file-input'),
  importDropzone: document.getElementById('import-dropzone'),
  importModeSelect: document.getElementById('import-mode-select'),
  loadSamplesBtn: document.getElementById('load-samples-btn'),

  // Shortcuts Modal
  shortcutsModal: document.getElementById('shortcuts-modal'),
  closeShortcutsModalBtns: document.querySelectorAll('[data-close-modal="shortcuts-modal"]')
};

/**
 * Update UI when data changes
 */
function refreshUI() {
  state.events = getAllEvents();
  renderStats(state.events, state.filters.statusTab);
  renderEventsGrid(state.events, DOM.eventsGrid, state.filters);
}

/**
 * Sets minimum allowed date on datetime-local input to right now
 */
function updateMinDatetime() {
  const dateInput = document.getElementById('event-date');
  if (!dateInput) return;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowFormatted = now.toISOString().slice(0, 16);
  dateInput.min = nowFormatted;
}

/**
 * Open Event Modal for Add or Edit
 */
function openEventModal(eventId = null) {
  clearValidationErrors(DOM.eventForm);
  DOM.eventForm.reset();
  updateMinDatetime();

  if (eventId) {
    // Edit Mode
    state.editingId = eventId;
    const ev = getEventById(eventId);
    if (!ev) return;

    DOM.modalTitle.textContent = 'Edit Event';
    DOM.eventForm.elements['title'].value = ev.title;
    DOM.eventForm.elements['date'].value = ev.date;
    DOM.eventForm.elements['category'].value = ev.category;
    DOM.eventForm.elements['notes'].value = ev.notes || '';
    DOM.eventForm.elements['repeat'].checked = Boolean(ev.repeat);
  } else {
    // Add Mode
    state.editingId = null;
    DOM.modalTitle.textContent = 'Add New Event';
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(0, 0, 0);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    DOM.eventForm.elements['date'].value = tomorrow.toISOString().slice(0, 16);
    DOM.eventForm.elements['category'].value = 'Exam';
  }

  DOM.eventModal.classList.add('open');
  DOM.eventModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => DOM.eventForm.elements['title'].focus(), 50);
}

/**
 * Close Event Modal
 */
function closeEventModal() {
  DOM.eventModal.classList.remove('open');
  DOM.eventModal.setAttribute('aria-hidden', 'true');
  state.editingId = null;
  clearValidationErrors(DOM.eventForm);
}

/**
 * Open Backup / Restore Modal
 */
function openBackupModal() {
  DOM.backupModal.classList.add('open');
  DOM.backupModal.setAttribute('aria-hidden', 'false');
}

/**
 * Close Backup / Restore Modal
 */
function closeBackupModal() {
  DOM.backupModal.classList.remove('open');
  DOM.backupModal.setAttribute('aria-hidden', 'true');
}

/**
 * Open Shortcuts Modal
 */
function openShortcutsModal() {
  if (!DOM.shortcutsModal) return;
  DOM.shortcutsModal.classList.add('open');
  DOM.shortcutsModal.setAttribute('aria-hidden', 'false');
}

/**
 * Close Shortcuts Modal
 */
function closeShortcutsModal() {
  if (!DOM.shortcutsModal) return;
  DOM.shortcutsModal.classList.remove('open');
  DOM.shortcutsModal.setAttribute('aria-hidden', 'true');
}

/**
 * Switch View Mode (Grid vs Table)
 */
function setViewMode(mode) {
  state.filters.viewMode = mode;
  saveSettings({ viewMode: mode });

  if (DOM.viewGridBtn && DOM.viewTableBtn) {
    DOM.viewGridBtn.classList.toggle('active', mode === 'grid');
    DOM.viewTableBtn.classList.toggle('active', mode === 'table');
  }

  refreshUI();
}

/**
 * Optimistic Deletion with 5-Second Interactive Undo Toast
 */
function performOptimisticDelete(eventId) {
  const ev = getEventById(eventId);
  if (!ev) return;

  // Immediate optimistic UI update
  deleteEvent(eventId);
  refreshUI();

  // Buffer in memory for undo window
  const timer = setTimeout(() => {
    state.undoBuffer.delete(eventId);
  }, 5000);

  state.undoBuffer.set(eventId, { event: ev, timer });

  showToast(
    'Event Deleted',
    `"${ev.title}" removed.`,
    'warning',
    5000,
    {
      label: 'Undo',
      onClick: () => {
        // Restore event
        const buffered = state.undoBuffer.get(eventId);
        if (buffered) {
          clearTimeout(buffered.timer);
          state.undoBuffer.delete(eventId);
          const currentEvents = getAllEvents();
          currentEvents.unshift(buffered.event);
          saveEvents(currentEvents);
          showToast('Restored', `"${ev.title}" has been restored.`, 'success');
          refreshUI();
        }
      }
    }
  );
}

/**
 * Handle Notification Permission UI & Banner
 */
function updateNotificationUI() {
  const perm = getNotificationPermission();

  if (DOM.notifyStatusBtn) {
    if (perm === 'granted') {
      DOM.notifyStatusBtn.classList.add('enabled');
      DOM.notifyStatusBtn.title = 'Notifications active. Click to test sound & alert.';
    } else if (perm === 'denied') {
      DOM.notifyStatusBtn.classList.remove('enabled');
      DOM.notifyStatusBtn.title = 'Notifications blocked in browser. Using on-screen alerts.';
    } else {
      DOM.notifyStatusBtn.classList.remove('enabled');
      DOM.notifyStatusBtn.title = 'Click to enable countdown notifications';
    }
  }

  if (DOM.notifyBanner) {
    if (perm === 'default' && !state.settings.bannerDismissed) {
      DOM.notifyBanner.classList.add('show');
    } else {
      DOM.notifyBanner.classList.remove('show');
    }
  }
}

/**
 * Close any open calendar dropdowns on document click
 */
function closeAllCalendarDropdowns() {
  document.querySelectorAll('.calendar-dropdown.open').forEach(menu => {
    menu.classList.remove('open');
  });
}

/**
 * Initialize all Event Listeners
 */
function initEventListeners() {
  // 1. Search Bar
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      if (DOM.searchClearBtn) {
        DOM.searchClearBtn.classList.toggle('visible', Boolean(e.target.value));
      }
      refreshUI();
    });
  }

  if (DOM.searchClearBtn) {
    DOM.searchClearBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      state.filters.search = '';
      DOM.searchClearBtn.classList.remove('visible');
      DOM.searchInput.focus();
      refreshUI();
    });
  }

  // 2. Category Filter Pills
  DOM.categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.category = pill.dataset.category;
      refreshUI();
    });
  });

  // 3. Status Tabs
  DOM.tabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.tabButtons.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.filters.statusTab = tab.dataset.tab;
      refreshUI();
    });
  });

  // 4. Quick Filter clicking on Stat Cards
  DOM.statCards.forEach(card => {
    card.addEventListener('click', () => {
      const tabTarget = card.dataset.tabTarget;
      if (tabTarget) {
        DOM.tabButtons.forEach(t => {
          t.classList.toggle('active', t.dataset.tab === tabTarget);
        });
        state.filters.statusTab = tabTarget;
        refreshUI();
      }
    });
  });

  // 5. Sort Selector
  if (DOM.sortSelect) {
    DOM.sortSelect.addEventListener('change', (e) => {
      state.filters.sortBy = e.target.value;
      refreshUI();
    });
  }

  // 6. View Mode Density Switcher
  if (DOM.viewGridBtn) {
    DOM.viewGridBtn.addEventListener('click', () => setViewMode('grid'));
  }
  if (DOM.viewTableBtn) {
    DOM.viewTableBtn.addEventListener('click', () => setViewMode('table'));
  }

  // 7. Modal Openers & Closers
  DOM.openAddModalBtns.forEach(btn => {
    btn.addEventListener('click', () => openEventModal());
  });

  DOM.closeModalBtns.forEach(btn => {
    btn.addEventListener('click', closeEventModal);
  });

  if (DOM.openBackupModalBtn) {
    DOM.openBackupModalBtn.addEventListener('click', openBackupModal);
  }

  DOM.closeBackupModalBtns.forEach(btn => {
    btn.addEventListener('click', closeBackupModal);
  });

  if (DOM.shortcutsBtn) {
    DOM.shortcutsBtn.addEventListener('click', openShortcutsModal);
  }

  DOM.closeShortcutsModalBtns.forEach(btn => {
    btn.addEventListener('click', closeShortcutsModal);
  });

  // Click outside modal to close
  [DOM.eventModal, DOM.backupModal, DOM.shortcutsModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        state.editingId = null;
      }
    });
  });

  // Document click closes calendar menus
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.calendar-menu-container')) {
      closeAllCalendarDropdowns();
    }
  });

  // 8. Event Form Submit (Add / Edit)
  if (DOM.eventForm) {
    DOM.eventForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = {
        title: DOM.eventForm.elements['title'].value,
        date: DOM.eventForm.elements['date'].value,
        category: DOM.eventForm.elements['category'].value,
        notes: DOM.eventForm.elements['notes'].value,
        repeat: DOM.eventForm.elements['repeat'].checked,
        isEditing: Boolean(state.editingId)
      };

      const validation = validateEventInput(formData);
      if (!validation.isValid) {
        displayValidationErrors(DOM.eventForm, validation.errors);
        return;
      }

      if (state.editingId) {
        const updated = updateEvent(state.editingId, formData);
        if (updated) {
          showToast('Event Updated', `"${updated.title}" has been saved.`, 'success');
        }
      } else {
        const created = addEvent(formData);
        showToast('Event Created', `"${created.title}" added to your countdowns.`, 'success');
      }

      closeEventModal();
      refreshUI();
    });
  }

  // 9. Delegated Card & Table Actions (Calendar Sync, Stage Mode, Edit, Delete, Done)
  if (DOM.eventsGrid) {
    DOM.eventsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) {
        if (e.target.closest('#empty-state-action-btn')) {
          openEventModal();
        }
        return;
      }

      const action = btn.dataset.action;
      const eventId = btn.dataset.id;
      const ev = getEventById(eventId);
      if (!ev) return;

      if (action === 'delete') {
        performOptimisticDelete(eventId);
      } else if (action === 'edit') {
        openEventModal(eventId);
      } else if (action === 'stage-mode') {
        openStageMode(ev);
      } else if (action === 'toggle-calendar-menu') {
        const menu = document.getElementById(`cal-menu-${eventId}`);
        if (menu) {
          const isOpen = menu.classList.contains('open');
          closeAllCalendarDropdowns();
          if (!isOpen) menu.classList.add('open');
        }
      } else if (action === 'sync-google') {
        closeAllCalendarDropdowns();
        const url = getGoogleCalendarUrl(ev);
        window.open(url, '_blank', 'noopener,noreferrer');
        showToast('Google Calendar', 'Opening Google Calendar event creator.', 'info', 3000);
      } else if (action === 'sync-ics') {
        closeAllCalendarDropdowns();
        downloadICSFile(ev);
        showToast('iCalendar (.ICS)', `Downloaded calendar event for "${ev.title}".`, 'success', 3000);
      } else if (action === 'toggle-complete') {
        const updated = toggleEventStatus(eventId);
        if (updated) {
          const isDone = updated.status === 'completed';
          if (isDone) {
            // Trigger celebration confetti on completion!
            try {
              const rect = btn.getBoundingClientRect();
              fireCelebrationConfetti(rect.left + rect.width / 2, rect.top);
            } catch (err) {}
          }
          showToast(
            isDone ? 'Marked Completed 🎉' : 'Moved to Upcoming',
            `"${updated.title}" is now ${updated.status}.`,
            'info'
          );
          refreshUI();
        }
      }
    });
  }

  // 10. Global Keyboard Shortcuts Power System
  window.addEventListener('keydown', (e) => {
    // Escape closes modals, stage mode, and dropdowns
    if (e.key === 'Escape') {
      closeEventModal();
      closeBackupModal();
      closeShortcutsModal();
      closeStageMode();
      closeAllCalendarDropdowns();
      return;
    }

    // Ignore shortcuts when user is typing in form controls
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
      return;
    }

    // Ignore if Ctrl / Cmd / Alt is pressed
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'n' || e.key === 'N' || e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      openEventModal();
    } else if (e.key === '/') {
      e.preventDefault();
      if (DOM.searchInput) {
        DOM.searchInput.focus();
        DOM.searchInput.select();
      }
    } else if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      saveSettings({ theme: newTheme });
      applyTheme(newTheme);
      showToast('Theme Changed', `Switched to ${newTheme} mode.`, 'info', 2000);
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      const nextMode = state.filters.viewMode === 'grid' ? 'table' : 'grid';
      setViewMode(nextMode);
      showToast('View Mode', `Switched to ${nextMode} view.`, 'info', 2000);
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      openBackupModal();
    } else if (e.key === '?') {
      e.preventDefault();
      openShortcutsModal();
    }
  });

  // 11. Theme Toggle
  if (DOM.themeToggleBtn) {
    DOM.themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      saveSettings({ theme: newTheme });
      applyTheme(newTheme);
      showToast('Theme Changed', `Switched to ${newTheme} mode.`, 'info', 2000);
    });
  }

  // 12. Sound Toggle
  if (DOM.soundToggleBtn) {
    DOM.soundToggleBtn.addEventListener('click', () => {
      const settings = getSettings();
      const newSoundState = !settings.soundEnabled;
      saveSettings({ soundEnabled: newSoundState });
      DOM.soundToggleBtn.title = newSoundState ? 'Sound alerts enabled' : 'Sound alerts muted';
      DOM.soundToggleBtn.style.opacity = newSoundState ? '1' : '0.5';
      if (newSoundState) {
        playAlertSound();
      }
      showToast('Sound Alerts', newSoundState ? 'Chime sound enabled' : 'Sound alerts muted', 'info', 2000);
    });
  }

  // 13. Notification Status Button (Quick Test / Request)
  if (DOM.notifyStatusBtn) {
    DOM.notifyStatusBtn.addEventListener('click', async () => {
      const perm = getNotificationPermission();
      if (perm === 'default') {
        const res = await requestNotificationPermission();
        updateNotificationUI();
        if (res === 'granted') {
          showToast('Notifications Active', 'You will receive reminders 1 day and 1 hour before events!', 'success');
          playAlertSound();
        }
      } else {
        playAlertSound();
        showToast('Notification System Test', 'Sound chime and alerts are operating properly.', 'info');
      }
    });
  }

  // 14. Notification Banner Actions
  if (DOM.enableNotifyBannerBtn) {
    DOM.enableNotifyBannerBtn.addEventListener('click', async () => {
      const res = await requestNotificationPermission();
      updateNotificationUI();
      if (res === 'granted') {
        showToast('Notifications Enabled', 'Event reminders will now alert you.', 'success');
        playAlertSound();
      }
    });
  }

  if (DOM.dismissNotifyBannerBtn) {
    DOM.dismissNotifyBannerBtn.addEventListener('click', () => {
      saveSettings({ bannerDismissed: true });
      if (DOM.notifyBanner) DOM.notifyBanner.classList.remove('show');
    });
  }

  // 15. Export JSON
  if (DOM.exportJsonBtn) {
    DOM.exportJsonBtn.addEventListener('click', () => {
      exportEventsJSON();
      showToast('Backup Exported', 'Your events JSON file has been downloaded.', 'success');
      closeBackupModal();
    });
  }

  // 16. Import JSON
  if (DOM.importFileInput) {
    DOM.importFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target.result;
        const mode = DOM.importModeSelect ? DOM.importModeSelect.value : 'merge';
        const result = importEventsJSON(content, mode);

        if (result.success) {
          showToast('Import Successful', `Imported ${result.count} events (${mode} mode).`, 'success');
          refreshUI();
          closeBackupModal();
        } else {
          showToast('Import Failed', result.error, 'danger');
        }
        DOM.importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Dropzone click
  if (DOM.importDropzone) {
    DOM.importDropzone.addEventListener('click', () => {
      if (DOM.importFileInput) DOM.importFileInput.click();
    });

    DOM.importDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      DOM.importDropzone.classList.add('dragover');
    });

    DOM.importDropzone.addEventListener('dragleave', () => {
      DOM.importDropzone.classList.remove('dragover');
    });

    DOM.importDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      DOM.importDropzone.classList.remove('dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target.result;
        const mode = DOM.importModeSelect ? DOM.importModeSelect.value : 'merge';
        const result = importEventsJSON(content, mode);

        if (result.success) {
          showToast('Import Successful', `Imported ${result.count} events!`, 'success');
          refreshUI();
          closeBackupModal();
        } else {
          showToast('Import Failed', result.error, 'danger');
        }
      };
      reader.readAsText(file);
    });
  }

  // 17. Load Sample Demo Data Button
  if (DOM.loadSamplesBtn) {
    DOM.loadSamplesBtn.addEventListener('click', () => {
      const samples = getSampleEvents();
      saveEvents(samples);
      showToast('Demo Data Loaded', 'Sample events across all categories loaded.', 'success');
      refreshUI();
      closeBackupModal();
    });
  }
}

/**
 * Register Service Worker for PWA Offline Reliability
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('EventTracker PWA ServiceWorker registered with scope:', reg.scope);
      }).catch((err) => {
        console.warn('ServiceWorker registration error:', err);
      });
    });
  }
}

/**
 * Main Application Startup
 */
function init() {
  // 1. Settings & Preferences
  state.settings = getSettings();
  applyTheme(state.settings.theme);

  // Restore view mode (grid vs table)
  state.filters.viewMode = state.settings.viewMode || 'grid';
  if (DOM.viewGridBtn && DOM.viewTableBtn) {
    DOM.viewGridBtn.classList.toggle('active', state.filters.viewMode === 'grid');
    DOM.viewTableBtn.classList.toggle('active', state.filters.viewMode === 'table');
  }

  if (DOM.soundToggleBtn) {
    DOM.soundToggleBtn.style.opacity = state.settings.soundEnabled ? '1' : '0.5';
  }

  // 2. Notification status
  updateNotificationUI();

  // 3. Render initial state
  refreshUI();

  // 4. Bind event listeners
  initEventListeners();

  // 5. Start countdown interval
  startCountdownLoop(
    () => refreshUI(),
    (title, body, type) => showToast(title, body, type)
  );

  // 6. Register PWA Service Worker
  registerServiceWorker();

  console.log('EventTracker SaaS Edition initialized successfully.');
}

// Kick off when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
