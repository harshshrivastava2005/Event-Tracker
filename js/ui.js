/**
 * ui.js - Presentation & DOM Rendering Module
 * Implements wireframe & UI layout specified in PDR Section 4
 * Extended with Industry-Ready Features: Calendar sync, Stage mode, Table view & Undo toasts
 */

import { getTimeLeft, calculateProgress } from './countdown.js';

/**
 * Format ISO datetime string to user-friendly human readable format
 */
export function formatDisplayDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;

  const options = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return d.toLocaleDateString(undefined, options);
}

/**
 * Escape HTML to prevent XSS injection
 */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the 4 summary statistics cards
 */
export function renderStats(events, activeTab = 'all') {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const total = events.length;
  const upcoming = events.filter(e => e.status !== 'completed' && new Date(e.date).getTime() > now).length;
  const today = events.filter(e => {
    if (e.status === 'completed') return false;
    const diff = new Date(e.date).getTime() - now;
    return diff > 0 && diff <= dayMs;
  }).length;
  const completed = events.filter(e => e.status === 'completed' || new Date(e.date).getTime() <= now).length;

  const totalEl = document.getElementById('stat-total-count');
  const upcomingEl = document.getElementById('stat-upcoming-count');
  const todayEl = document.getElementById('stat-today-count');
  const completedEl = document.getElementById('stat-completed-count');

  if (totalEl) totalEl.textContent = total;
  if (upcomingEl) upcomingEl.textContent = upcoming;
  if (todayEl) todayEl.textContent = today;
  if (completedEl) completedEl.textContent = completed;

  // Update tab counts
  const tabUpcomingCount = document.getElementById('tab-upcoming-count');
  const tabTodayCount = document.getElementById('tab-today-count');
  const tabCompletedCount = document.getElementById('tab-completed-count');

  if (tabUpcomingCount) tabUpcomingCount.textContent = upcoming;
  if (tabTodayCount) tabTodayCount.textContent = today;
  if (tabCompletedCount) tabCompletedCount.textContent = completed;
}

/**
 * Get category icon SVG
 */
function getCategoryIcon(category) {
  const icons = {
    Exam: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    Deadline: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    Birthday: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"></path><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"></path><path d="M2 21h20"></path><path d="M7 8v2"></path><path d="M12 8v2"></path><path d="M17 8v2"></path><path d="M7 4h.01"></path><path d="M12 4h.01"></path><path d="M17 4h.01"></path></svg>`,
    Meeting: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    Other: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
  };
  return icons[category] || icons.Other;
}

/**
 * Determine urgency level of event
 */
export function getUrgencyLevel(eventDate, isCompleted) {
  if (isCompleted) return 'safe';
  const diff = new Date(eventDate).getTime() - Date.now();
  if (diff <= 24 * 60 * 60 * 1000) return 'critical';
  if (diff <= 72 * 60 * 60 * 1000) return 'warning';
  return 'safe';
}

/**
 * Build HTML for a single event card (Grid View)
 */
export function createEventCardHTML(ev) {
  const isCompleted = ev.status === 'completed' || new Date(ev.date).getTime() <= Date.now();
  const timeLeft = getTimeLeft(ev.date);
  const progress = calculateProgress(ev.createdAt, ev.date);
  const urgency = getUrgencyLevel(ev.date, isCompleted);
  const isUrgent = urgency === 'critical' && !isCompleted;

  const pad = (n) => String(n || 0).padStart(2, '0');

  const daysStr = timeLeft ? pad(timeLeft.days) : '00';
  const hoursStr = timeLeft ? pad(timeLeft.hours) : '00';
  const minsStr = timeLeft ? pad(timeLeft.minutes) : '00';
  const secsStr = timeLeft ? pad(timeLeft.seconds) : '00';

  const catIcon = getCategoryIcon(ev.category);

  return `
    <article class="event-card ${isCompleted ? 'status-completed' : ''} ${isUrgent ? 'urgent-glow' : ''}" data-id="${ev.id}" data-category="${escapeHTML(ev.category)}">
      <div class="card-category-strip" data-category="${escapeHTML(ev.category)}"></div>
      
      <div class="card-body">
        <div class="card-meta-row">
          <span class="card-badge" data-category="${escapeHTML(ev.category)}">
            ${catIcon}
            <span>${escapeHTML(ev.category)}</span>
          </span>

          <div style="display: flex; align-items: center; gap: 0.35rem;">
            ${isUrgent ? `
              <span class="card-repeat-flag" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); font-weight: 700;">
                🔥 &lt;24h
              </span>
            ` : ''}

            ${ev.repeat ? `
              <span class="card-repeat-flag" title="Recurs yearly">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="17 1 21 5 17 9"></polyline>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                  <polyline points="7 23 3 19 7 15"></polyline>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>
                Yearly
              </span>
            ` : ''}
          </div>
        </div>

        <h3 class="card-title">${escapeHTML(ev.title)}</h3>
        
        <p class="card-notes">${escapeHTML(ev.notes)}</p>

        <div class="card-datetime" title="Target Date & Time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${formatDisplayDate(ev.date)}</span>
        </div>

        <!-- Live Countdown Block -->
        <div class="countdown-box">
          ${isCompleted ? `
            <div class="countdown-completed-message">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Event Completed</span>
            </div>
          ` : `
            <div class="countdown-label">
              <span>Time Remaining</span>
              <span class="countdown-pulse-dot" title="Live countdown active"></span>
            </div>
            <div class="countdown-timer">
              <div class="countdown-unit">
                <span class="countdown-val val-days">${daysStr}</span>
                <span class="countdown-txt">Days</span>
              </div>
              <div class="countdown-unit">
                <span class="countdown-val val-hours">${hoursStr}</span>
                <span class="countdown-txt">Hours</span>
              </div>
              <div class="countdown-unit">
                <span class="countdown-val val-minutes">${minsStr}</span>
                <span class="countdown-txt">Mins</span>
              </div>
              <div class="countdown-unit">
                <span class="countdown-val val-seconds">${secsStr}</span>
                <span class="countdown-txt">Secs</span>
              </div>
            </div>
          `}
        </div>

        <!-- Progress Bar -->
        <div class="card-progress-wrapper">
          <div class="card-progress-meta">
            <span>Timeline Elapsed</span>
            <span class="card-progress-pct">${progress}%</span>
          </div>
          <div class="card-progress-track">
            <div class="card-progress-bar" style="width: ${progress}%"></div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="card-actions">
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <button type="button" class="card-btn btn-toggle-complete" data-action="toggle-complete" data-id="${ev.id}" title="${isCompleted ? 'Mark as Upcoming' : 'Mark as Completed'}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>${isCompleted ? 'Reopen' : 'Done'}</span>
            </button>

            <!-- Fullscreen Stage View Button -->
            <button type="button" class="card-btn" data-action="stage-mode" data-id="${ev.id}" title="Open Fullscreen Focus / Stage Mode">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
              <span>Stage</span>
            </button>
          </div>

          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <!-- Calendar Sync Dropdown Menu -->
            <div class="calendar-menu-container">
              <button type="button" class="card-btn btn-calendar-toggle" data-action="toggle-calendar-menu" data-id="${ev.id}" title="Sync with Calendar">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>Sync</span>
              </button>
              <div class="calendar-dropdown" id="cal-menu-${ev.id}">
                <button type="button" class="calendar-dropdown-item" data-action="sync-google" data-id="${ev.id}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v8M8 12h8"></path>
                  </svg>
                  <span>Google Calendar</span>
                </button>
                <button type="button" class="calendar-dropdown-item" data-action="sync-ics" data-id="${ev.id}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Download .ICS (Apple/Outlook)</span>
                </button>
              </div>
            </div>

            <button type="button" class="card-btn btn-edit" data-action="edit" data-id="${ev.id}" title="Edit Event">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>

            <button type="button" class="card-btn btn-delete" data-action="delete" data-id="${ev.id}" title="Delete Event">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Build HTML for a single event row (Table View)
 */
export function createEventTableRowHTML(ev) {
  const isCompleted = ev.status === 'completed' || new Date(ev.date).getTime() <= Date.now();
  const timeLeft = getTimeLeft(ev.date);
  const urgency = getUrgencyLevel(ev.date, isCompleted);
  const pad = (n) => String(n || 0).padStart(2, '0');

  const countdownText = isCompleted
    ? 'Completed'
    : (timeLeft ? `${pad(timeLeft.days)}d ${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s` : '00d 00h 00m 00s');

  const catIcon = getCategoryIcon(ev.category);

  return `
    <tr class="table-row ${isCompleted ? 'status-completed' : ''}" data-id="${ev.id}">
      <td>
        <span class="urgency-dot urgency-${urgency}" title="Urgency status: ${urgency}"></span>
        <span class="card-badge" data-category="${escapeHTML(ev.category)}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">
          ${catIcon}
          <span>${escapeHTML(ev.category)}</span>
        </span>
      </td>
      <td class="table-col-title">
        <div>${escapeHTML(ev.title)}</div>
        ${ev.notes ? `<div class="table-subtext">${escapeHTML(ev.notes)}</div>` : ''}
      </td>
      <td style="white-space: nowrap; font-size: 0.8rem; color: var(--text-muted);">
        ${formatDisplayDate(ev.date)}
      </td>
      <td>
        <span class="table-countdown val-table-countdown">${countdownText}</span>
      </td>
      <td style="text-align: right; white-space: nowrap;">
        <button type="button" class="card-btn" data-action="toggle-complete" data-id="${ev.id}" title="${isCompleted ? 'Mark as Upcoming' : 'Mark Done'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </button>
        <button type="button" class="card-btn" data-action="stage-mode" data-id="${ev.id}" title="Stage Mode">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
        <button type="button" class="card-btn" data-action="sync-google" data-id="${ev.id}" title="Sync Google Calendar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
        <button type="button" class="card-btn btn-edit" data-action="edit" data-id="${ev.id}" title="Edit">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button type="button" class="card-btn btn-delete" data-action="delete" data-id="${ev.id}" title="Delete">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    </tr>
  `;
}

/**
 * Filter and sort events according to filter state
 */
export function getFilteredEvents(events, filterState) {
  const { search = '', category = 'All', statusTab = 'upcoming', sortBy = 'soonest' } = filterState;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // 1. Filter by Status Tab
  let filtered = events.filter(e => {
    const isCompleted = e.status === 'completed' || new Date(e.date).getTime() <= now;
    const diff = new Date(e.date).getTime() - now;

    if (statusTab === 'upcoming') {
      return !isCompleted;
    } else if (statusTab === 'today') {
      return !isCompleted && diff > 0 && diff <= dayMs;
    } else if (statusTab === 'completed') {
      return isCompleted;
    }
    return true;
  });

  // 2. Filter by Category
  if (category && category !== 'All') {
    filtered = filtered.filter(e => e.category === category);
  }

  // 3. Filter by Search Query
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(e => 
      e.title.toLowerCase().includes(q) || 
      (e.notes && e.notes.toLowerCase().includes(q))
    );
  }

  // 4. Sort Events
  filtered.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();

    if (sortBy === 'soonest') {
      return timeA - timeB;
    } else if (sortBy === 'furthest') {
      return timeB - timeA;
    } else if (sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    } else if (sortBy === 'created') {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
    return 0;
  });

  return filtered;
}

/**
 * Render the full grid or compact table of event cards or empty state
 */
export function renderEventsGrid(events, containerEl, filterState) {
  if (!containerEl) return;

  const filtered = getFilteredEvents(events, filterState);
  const viewMode = filterState.viewMode || 'grid';

  // Render Empty State if no cards match
  if (filtered.length === 0) {
    const search = filterState.search || '';
    const statusTab = filterState.statusTab || 'upcoming';

    containerEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 14 14"></polyline>
          </svg>
        </div>
        <h3>No Events Found</h3>
        <p>${search ? `No events match "${escapeHTML(search)}". Try searching for something else or reset your filters.` : `There are no ${statusTab} events in this view right now.`}</p>
        <button type="button" class="btn btn-primary" id="empty-state-action-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add New Event
        </button>
      </div>
    `;
    return;
  }

  // Render Table View or Grid View
  if (viewMode === 'table') {
    containerEl.innerHTML = `
      <div class="events-table-wrapper" style="grid-column: 1 / -1;">
        <table class="events-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Event Title</th>
              <th>Target Date</th>
              <th>Time Remaining</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(createEventTableRowHTML).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    containerEl.innerHTML = filtered.map(createEventCardHTML).join('');
  }
}

/**
 * Toast Notification Stack Manager with Interactive Undo Action & Timer Progress Bar
 */
export function showToast(title, message, type = 'info', duration = 4000, action = null) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    success: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    warning: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    danger: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHTML(title)}</div>
      <div class="toast-message">${escapeHTML(message)}</div>
      ${action ? `<button type="button" class="toast-action-btn" id="toast-action-btn">${escapeHTML(action.label || 'Undo')}</button>` : ''}
    </div>
    <div class="toast-close" title="Close">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
    ${action ? `<div class="toast-timer-bar"></div>` : ''}
  `;

  container.appendChild(toast);

  let timerId = null;

  const removeToast = () => {
    if (timerId) clearTimeout(timerId);
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };

  if (action && typeof action.onClick === 'function') {
    const actionBtn = toast.querySelector('#toast-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        action.onClick();
        removeToast();
      });
    }
  }

  toast.querySelector('.toast-close').addEventListener('click', removeToast);
  timerId = setTimeout(removeToast, duration);
}

/**
 * Apply theme to document element
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Theme (T)' : 'Switch to Dark Theme (T)');
    themeBtn.innerHTML = theme === 'dark' ? `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    ` : `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
  }
}
