/**
 * stage.js - Fullscreen Focus / Stage Presentation Mode
 * Provides a high-contrast, distraction-free live countdown for presentations, hackathons, and exams
 */

import { getTimeLeft, calculateProgress } from './countdown.js';
import { formatDisplayDate, escapeHTML } from './ui.js';

let activeEventId = null;
let stageIntervalId = null;

/**
 * Open Fullscreen Stage View for a given event
 */
export function openStageMode(event) {
  if (!event) return;
  activeEventId = event.id;

  let overlay = document.getElementById('stage-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'stage-overlay';
    overlay.className = 'stage-overlay';
    document.body.appendChild(overlay);
  }

  // Attempt browser native fullscreen if allowed
  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen policy restriction handled gracefully
    });
  }

  renderStageContent(overlay, event);
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');

  // Start dedicated 1-second update interval for stage mode
  if (stageIntervalId) clearInterval(stageIntervalId);
  stageIntervalId = setInterval(() => {
    updateStageTicker(event.id);
  }, 1000);
}

/**
 * Close Stage View
 */
export function closeStageMode() {
  const overlay = document.getElementById('stage-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  if (stageIntervalId) {
    clearInterval(stageIntervalId);
    stageIntervalId = null;
  }

  activeEventId = null;

  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

/**
 * Render the stage view overlay markup
 */
function renderStageContent(overlay, event) {
  const timeLeft = getTimeLeft(event.date);
  const progress = calculateProgress(event.createdAt, event.date);
  const pad = (n) => String(n || 0).padStart(2, '0');

  const days = timeLeft ? pad(timeLeft.days) : '00';
  const hours = timeLeft ? pad(timeLeft.hours) : '00';
  const mins = timeLeft ? pad(timeLeft.minutes) : '00';
  const secs = timeLeft ? pad(timeLeft.seconds) : '00';

  overlay.innerHTML = `
    <div class="stage-container" data-category="${escapeHTML(event.category)}">
      <header class="stage-header">
        <div class="stage-badge" data-category="${escapeHTML(event.category)}">
          <span>${escapeHTML(event.category)}</span>
        </div>
        <div class="stage-controls">
          <button type="button" class="stage-btn" id="stage-fullscreen-toggle" title="Toggle Fullscreen">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
          </button>
          <button type="button" class="stage-btn" id="stage-close-btn" title="Exit Stage Mode (Esc)">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Exit</span>
          </button>
        </div>
      </header>

      <main class="stage-body">
        <h1 class="stage-title">${escapeHTML(event.title)}</h1>
        ${event.notes ? `<p class="stage-notes">${escapeHTML(event.notes)}</p>` : ''}

        <div class="stage-datetime">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>Target Deadline: ${formatDisplayDate(event.date)}</span>
        </div>

        <!-- Big Countdown Grid -->
        <div class="stage-countdown-grid">
          <div class="stage-unit">
            <div class="stage-num" id="stage-val-days">${days}</div>
            <div class="stage-label">Days</div>
          </div>
          <div class="stage-sep">:</div>
          <div class="stage-unit">
            <div class="stage-num" id="stage-val-hours">${hours}</div>
            <div class="stage-label">Hours</div>
          </div>
          <div class="stage-sep">:</div>
          <div class="stage-unit">
            <div class="stage-num" id="stage-val-minutes">${mins}</div>
            <div class="stage-label">Minutes</div>
          </div>
          <div class="stage-sep">:</div>
          <div class="stage-unit">
            <div class="stage-num stage-num-seconds" id="stage-val-seconds">${secs}</div>
            <div class="stage-label">Seconds</div>
          </div>
        </div>

        <!-- Timeline Progress Bar -->
        <div class="stage-progress-wrapper">
          <div class="stage-progress-track">
            <div class="stage-progress-bar" id="stage-progress-bar" style="width: ${progress}%;"></div>
          </div>
          <div class="stage-progress-meta">
            <span>Elapsed Timeline</span>
            <span id="stage-progress-pct">${progress}%</span>
          </div>
        </div>
      </main>

      <footer class="stage-footer">
        <span class="stage-hint">Press <kbd>Esc</kbd> anytime to return to dashboard</span>
      </footer>
    </div>
  `;

  // Attach button listeners
  const closeBtn = overlay.querySelector('#stage-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeStageMode);

  const fsToggle = overlay.querySelector('#stage-fullscreen-toggle');
  if (fsToggle) {
    fsToggle.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }
}

/**
 * Ticks stage values each second
 */
function updateStageTicker(eventId) {
  const overlay = document.getElementById('stage-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;

  // Retrieve current event
  import('./storage.js').then(({ getEventById }) => {
    const event = getEventById(eventId);
    if (!event) return;

    const timeLeft = getTimeLeft(event.date);
    const progress = calculateProgress(event.createdAt, event.date);
    const pad = (n) => String(n || 0).padStart(2, '0');

    const dEl = document.getElementById('stage-val-days');
    const hEl = document.getElementById('stage-val-hours');
    const mEl = document.getElementById('stage-val-minutes');
    const sEl = document.getElementById('stage-val-seconds');
    const barEl = document.getElementById('stage-progress-bar');
    const pctEl = document.getElementById('stage-progress-pct');

    if (timeLeft) {
      if (dEl) dEl.textContent = pad(timeLeft.days);
      if (hEl) hEl.textContent = pad(timeLeft.hours);
      if (mEl) mEl.textContent = pad(timeLeft.minutes);
      if (sEl) sEl.textContent = pad(timeLeft.seconds);
    } else {
      if (dEl) dEl.textContent = '00';
      if (hEl) hEl.textContent = '00';
      if (mEl) mEl.textContent = '00';
      if (sEl) sEl.textContent = '00';
    }

    if (barEl) barEl.style.width = `${progress}%`;
    if (pctEl) pctEl.textContent = `${progress}%`;
  });
}
