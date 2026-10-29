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
  rescheduleEvent,
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
  escapeHTML,
  formatDisplayDate
} from './ui.js';

import {
  startCountdownLoop,
  stopCountdownLoop
} from './countdown.js';

import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  playAlertSound,
  triggerReminderNotification
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
    viewMode: 'grid', // 'grid' | 'table' | 'calendar'
    calendarDate: new Date(),
    selectedCalendarDate: null
  },
  editingId: null,
  reschedulingId: null,
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
  viewCalendarBtn: document.getElementById('view-mode-calendar'),

  // Direct Restore button & input
  directRestoreBtn: document.getElementById('direct-restore-btn'),
  directRestoreInput: document.getElementById('direct-restore-file-input'),

  // Add/Edit Event Modal
  eventModal: document.getElementById('event-modal'),
  eventForm: document.getElementById('event-form'),
  modalTitle: document.getElementById('modal-title'),
  closeModalBtns: document.querySelectorAll('[data-close-modal="event-modal"]'),
  openAddModalBtns: document.querySelectorAll('[data-open-modal="event-modal"]'),

  // Reschedule Modal
  rescheduleModal: document.getElementById('reschedule-modal'),
  rescheduleForm: document.getElementById('reschedule-form'),
  rescheduleDateInput: document.getElementById('reschedule-date'),
  rescheduleEventName: document.getElementById('reschedule-event-name'),
  closeRescheduleModalBtns: document.querySelectorAll('[data-close-modal="reschedule-modal"]'),
  presetBtns: document.querySelectorAll('.preset-btn'),

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
    DOM.eventForm.elements['repeat'].value = ev.repeat || 'none';
  } else {
    // Add Mode
    state.editingId = null;
    DOM.modalTitle.textContent = 'Add New Event';
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(0, 0, 0);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    DOM.eventForm.elements['date'].value = tomorrow.toISOString().slice(0, 16);
    DOM.eventForm.elements['category'].value = 'Exam';
    DOM.eventForm.elements['repeat'].value = 'none';
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
 * Open Reschedule Modal for Overdue / Past Event
 */
function openRescheduleModal(eventId) {
  const ev = getEventById(eventId);
  if (!ev) return;
  state.reschedulingId = eventId;

  if (DOM.rescheduleEventName) {
    DOM.rescheduleEventName.textContent = `"${ev.title}" (${ev.category})`;
  }

  // Set minimum date to now
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowStr = now.toISOString().slice(0, 16);

  // Default suggested reschedule date: Tomorrow at same time
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
  const tomorrowStr = tomorrow.toISOString().slice(0, 16);

  if (DOM.rescheduleDateInput) {
    DOM.rescheduleDateInput.min = nowStr;
    DOM.rescheduleDateInput.value = tomorrowStr;
  }

  const errEl = document.getElementById('error-reschedule-date');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.remove('visible');
  }

  if (DOM.rescheduleModal) {
    DOM.rescheduleModal.classList.add('open');
    DOM.rescheduleModal.setAttribute('aria-hidden', 'false');
  }
}

/**
 * Close Reschedule Modal
 */
function closeRescheduleModal() {
  if (DOM.rescheduleModal) {
    DOM.rescheduleModal.classList.remove('open');
    DOM.rescheduleModal.setAttribute('aria-hidden', 'true');
  }
  state.reschedulingId = null;
}

/**
 * Switch View Mode (Grid vs Table vs Monthly Calendar)
 */
function setViewMode(mode) {
  state.filters.viewMode = mode;
  saveSettings({ viewMode: mode });

  if (DOM.viewGridBtn) DOM.viewGridBtn.classList.toggle('active', mode === 'grid');
  if (DOM.viewTableBtn) DOM.viewTableBtn.classList.toggle('active', mode === 'table');
  if (DOM.viewCalendarBtn) DOM.viewCalendarBtn.classList.toggle('active', mode === 'calendar');

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
 * Close any open dropdown menus (Kebab and Calendar sync) on document click
 */
function closeAllDropdowns() {
  document.querySelectorAll('.calendar-dropdown.open, .card-dropdown-menu.open').forEach(menu => {
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
  if (DOM.viewCalendarBtn) {
    DOM.viewCalendarBtn.addEventListener('click', () => setViewMode('calendar'));
  }

  // 6b. Direct Restore Button
  if (DOM.directRestoreBtn && DOM.directRestoreInput) {
    DOM.directRestoreBtn.addEventListener('click', () => {
      DOM.directRestoreInput.click();
    });

    DOM.directRestoreInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target.result;
          const result = importEventsJSON(content, 'replace');

          if (result.success) {
            showToast('Backup Restored', `Successfully loaded ${result.count} events!`, 'success');
            refreshUI();
          } else {
            showToast('Restore Failed', result.error || 'Invalid backup JSON file.', 'danger');
          }
        } catch (err) {
          showToast('Invalid Backup', 'The selected file is not a valid JSON backup.', 'danger');
        }
        DOM.directRestoreInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // 6c. Reschedule Overdue Event Presets & Submission
  DOM.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const now = new Date();
      let target = new Date();

      if (preset === '1h') {
        target = new Date(now.getTime() + 60 * 60 * 1000);
      } else if (preset === 'tomorrow') {
        target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (preset === 'nextweek') {
        target = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      target.setMinutes(target.getMinutes() - target.getTimezoneOffset());
      if (DOM.rescheduleDateInput) {
        DOM.rescheduleDateInput.value = target.toISOString().slice(0, 16);
      }
    });
  });

  if (DOM.rescheduleForm) {
    DOM.rescheduleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.reschedulingId) return;

      const newDateVal = DOM.rescheduleDateInput ? DOM.rescheduleDateInput.value : '';
      const errEl = document.getElementById('error-reschedule-date');

      if (!newDateVal) {
        if (errEl) {
          errEl.textContent = 'Please choose a future date and time.';
          errEl.classList.add('visible');
        }
        return;
      }

      if (new Date(newDateVal).getTime() <= Date.now()) {
        if (errEl) {
          errEl.textContent = 'Rescheduled date must be in the future.';
          errEl.classList.add('visible');
        }
        return;
      }

      const updated = rescheduleEvent(state.reschedulingId, newDateVal);
      if (updated) {
        showToast('Event Rescheduled', `"${updated.title}" has been reactivated for ${formatDisplayDate(updated.date)}!`, 'success');
        closeRescheduleModal();
        refreshUI();
      }
    });
  }

  DOM.closeRescheduleModalBtns.forEach(btn => {
    btn.addEventListener('click', closeRescheduleModal);
  });

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
  [DOM.eventModal, DOM.rescheduleModal, DOM.backupModal, DOM.shortcutsModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        state.editingId = null;
        state.reschedulingId = null;
      }
    });
  });

  // Document click closes dropdowns (kebab and calendar)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.calendar-menu-container') && !e.target.closest('.card-kebab-container')) {
      closeAllDropdowns();
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
        repeat: DOM.eventForm.elements['repeat'].value || 'none',
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

  // 9. Delegated Card & Table Actions (Kebab, Reschedule, Calendar Navigation, Edit, Delete, Done)
  if (DOM.eventsGrid) {
    DOM.eventsGrid.addEventListener('click', (e) => {
      // 1. Calendar View internal controls (Prev, Next, Today, Select Day, Add Event for Day)
      const calPrev = e.target.closest('button[data-action="cal-prev"]');
      if (calPrev) {
        const d = state.filters.calendarDate || new Date();
        d.setMonth(d.getMonth() - 1);
        state.filters.calendarDate = new Date(d);
        refreshUI();
        return;
      }

      const calNext = e.target.closest('button[data-action="cal-next"]');
      if (calNext) {
        const d = state.filters.calendarDate || new Date();
        d.setMonth(d.getMonth() + 1);
        state.filters.calendarDate = new Date(d);
        refreshUI();
        return;
      }

      const calToday = e.target.closest('button[data-action="cal-today"]');
      if (calToday) {
        state.filters.calendarDate = new Date();
        state.filters.selectedCalendarDate = null;
        refreshUI();
        return;
      }

      const dayCell = e.target.closest('[data-action="cal-select-date"]');
      if (dayCell) {
        state.filters.selectedCalendarDate = dayCell.dataset.date;
        refreshUI();
        return;
      }

      const addForDayBtn = e.target.closest('#cal-add-event-btn');
      if (addForDayBtn) {
        const dateStr = addForDayBtn.dataset.date;
        openEventModal();
        if (dateStr && DOM.eventForm.elements['date']) {
          DOM.eventForm.elements['date'].value = `${dateStr}T09:00`;
        }
        return;
      }

      // 2. Action buttons
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

      if (action === 'toggle-card-menu') {
        const menu = document.getElementById(`card-menu-${eventId}`);
        if (menu) {
          const isOpen = menu.classList.contains('open');
          closeAllDropdowns();
          if (!isOpen) menu.classList.add('open');
        }
      } else if (action === 'open-reschedule') {
        closeAllDropdowns();
        openRescheduleModal(eventId);
      } else if (action === 'delete') {
        closeAllDropdowns();
        performOptimisticDelete(eventId);
      } else if (action === 'edit') {
        closeAllDropdowns();
        openEventModal(eventId);
      } else if (action === 'stage-mode') {
        closeAllDropdowns();
        openStageMode(ev);
      } else if (action === 'toggle-calendar-menu') {
        const menu = document.getElementById(`cal-menu-${eventId}`);
        if (menu) {
          const isOpen = menu.classList.contains('open');
          closeAllDropdowns();
          if (!isOpen) menu.classList.add('open');
        }
      } else if (action === 'sync-google') {
        closeAllDropdowns();
        const url = getGoogleCalendarUrl(ev);
        window.open(url, '_blank', 'noopener,noreferrer');
        showToast('Google Calendar', 'Opening Google Calendar event creator.', 'info', 3000);
      } else if (action === 'sync-ics') {
        closeAllDropdowns();
        downloadICSFile(ev);
        showToast('iCalendar (.ICS)', `Downloaded calendar event for "${ev.title}".`, 'success', 3000);
      } else if (action === 'toggle-complete') {
        closeAllDropdowns();
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
      closeRescheduleModal();
      closeBackupModal();
      closeShortcutsModal();
      closeStageMode();
      closeAllDropdowns();
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
      let nextMode = 'grid';
      if (state.filters.viewMode === 'grid') nextMode = 'table';
      else if (state.filters.viewMode === 'table') nextMode = 'calendar';
      else nextMode = 'grid';
      setViewMode(nextMode);
      showToast('View Mode', `Switched to ${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)} view.`, 'info', 2000);
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

  // 13. Notification Status Button (Bell Icon: 1 day, 1 hour, 10 minutes reminders)
  if (DOM.notifyStatusBtn) {
    DOM.notifyStatusBtn.addEventListener('click', async () => {
      const perm = getNotificationPermission();
      if (perm === 'default') {
        const res = await requestNotificationPermission();
        updateNotificationUI();
        if (res === 'granted') {
          showToast('Notifications Active', 'You will receive reminders 1 day, 1 hour, and 10 minutes before events!', 'success');
          triggerReminderNotification(
            'Reminders Active 🔔',
            'Browser notifications will remind you 1 day, 1 hour, and 10 minutes before every countdown.'
          );
        }
      } else if (perm === 'granted') {
        showToast('Notifications Active', 'Reminders are scheduled for 1 day, 1 hour, and 10 minutes before each event.', 'info');
        triggerReminderNotification(
          'Notification Test 🔔',
          'Browser alerts are operational! You will receive reminders 1 day, 1 hour, and 10 minutes before countdowns.'
        );
      } else {
        showToast('Notifications Blocked', 'Notifications are blocked in your browser site settings. In-app alerts and sounds will still notify you.', 'warning');
        playAlertSound();
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

  // Restore view mode (grid vs table vs calendar)
  state.filters.viewMode = state.settings.viewMode || 'grid';
  if (DOM.viewGridBtn) DOM.viewGridBtn.classList.toggle('active', state.filters.viewMode === 'grid');
  if (DOM.viewTableBtn) DOM.viewTableBtn.classList.toggle('active', state.filters.viewMode === 'table');
  if (DOM.viewCalendarBtn) DOM.viewCalendarBtn.classList.toggle('active', state.filters.viewMode === 'calendar');

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
