/**
 * countdown.js - Real-time Timer & Milestone Checking Module
 * Implements FR3, FR5, FR7 per PDR Section 5.3
 * Extended with Table View updates and Celebration Confetti integration
 */

import { getAllEvents, saveEvents, updateEvent, getNextOccurrence, normalizeRepeat } from './storage.js';
import { triggerReminderNotification } from './notify.js';
import { fireCelebrationConfetti } from './confetti.js';

let intervalId = null;

/**
 * Calculates remaining time breakdown for a target date
 * @param {string|Date} eventDate
 * @returns {object|null} { days, hours, minutes, seconds, total } or null if passed
 */
export function getTimeLeft(eventDate) {
  const diff = new Date(eventDate).getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    minutes: Math.floor(diff / 60000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
    total: diff
  };
}

/**
 * Calculate progress percentage elapsed from createdAt to targetDate
 */
export function calculateProgress(createdAt, targetDate) {
  const now = Date.now();
  const start = new Date(createdAt || now).getTime();
  const end = new Date(targetDate).getTime();

  if (now >= end) return 100;
  if (now <= start) return 0;

  const total = end - start;
  if (total <= 0) return 100;

  const elapsed = now - start;
  const pct = (elapsed / total) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/**
 * Perform single-second tick: updates in-place DOM elements with zero layout thrashing
 * and checks 1-day / 1-hour / 10-minute milestone reminders, repeat roll-over, and overdue transitions
 */
export function tick(onStateChange, onToastAlert) {
  const events = getAllEvents();
  let stateModified = false;
  const now = Date.now();

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  events.forEach(ev => {
    // Only monitor non-completed events
    if (ev.status === 'completed') return;

    const eventTime = new Date(ev.date).getTime();
    const diff = eventTime - now;
    const repeatType = normalizeRepeat(ev.repeat);

    // Check if event reached zero or is in the past
    if (diff <= 0) {
      if (repeatType !== 'none') {
        // Recurring event: automatically jumps to its next date
        const nextDate = getNextOccurrence(ev.date, repeatType);
        if (nextDate) {
          ev.date = nextDate;
          ev.notified1d = false;
          ev.notified1h = false;
          ev.notified10m = false;
          ev.createdAt = now;
          ev.status = 'upcoming';
          stateModified = true;

          try {
            fireCelebrationConfetti();
          } catch (e) {}

          triggerReminderNotification(
            `Recurring Event: ${ev.title}`,
            `Event reached zero and automatically jumped to its next ${repeatType} date!`,
            (title, body) => onToastAlert && onToastAlert(title, body, 'info')
          );
        }
      } else {
        // Non-recurring: move event to "overdue" state
        if (ev.status !== 'overdue') {
          ev.status = 'overdue';
          stateModified = true;

          triggerReminderNotification(
            `Event Overdue: ${ev.title}`,
            `Countdown has reached zero! Moved to Overdue tab. You can mark it done or reschedule it.`,
            (title, body) => onToastAlert && onToastAlert(title, body, 'warning')
          );
        }
      }
      return;
    }

    // Milestone 1: 1 Day Reminder (FR5)
    if (diff <= ONE_DAY_MS && !ev.notified1d) {
      ev.notified1d = true;
      stateModified = true;
      triggerReminderNotification(
        `Upcoming Tomorrow: ${ev.title}`,
        `Event starts in less than 24 hours! (${ev.category})`,
        (title, body) => onToastAlert && onToastAlert(title, body, 'info')
      );
    }

    // Milestone 2: 1 Hour Reminder (FR5)
    if (diff <= ONE_HOUR_MS && !ev.notified1h) {
      ev.notified1h = true;
      stateModified = true;
      triggerReminderNotification(
        `Starting Soon (1h): ${ev.title}`,
        `Event starts in less than 1 hour! (${ev.category})`,
        (title, body) => onToastAlert && onToastAlert(title, body, 'warning')
      );
    }

    // Milestone 3: 10 Minutes Reminder
    if (diff <= TEN_MINUTES_MS && !ev.notified10m) {
      ev.notified10m = true;
      stateModified = true;
      triggerReminderNotification(
        `Starting in 10 Minutes: ${ev.title}`,
        `Event starts in 10 minutes! (${ev.category})`,
        (title, body) => onToastAlert && onToastAlert(title, body, 'warning')
      );
    }

    const pad = (n) => String(n).padStart(2, '0');
    const timeLeft = getTimeLeft(ev.date);

    // 1. In-place DOM update for Card View
    const cardEl = document.querySelector(`.event-card[data-id="${ev.id}"]`);
    if (cardEl && ev.status !== 'completed' && timeLeft) {
      const dEl = cardEl.querySelector('.val-days');
      const hEl = cardEl.querySelector('.val-hours');
      const mEl = cardEl.querySelector('.val-minutes');
      const sEl = cardEl.querySelector('.val-seconds');
      const barEl = cardEl.querySelector('.card-progress-bar');
      const pctEl = cardEl.querySelector('.card-progress-pct');

      if (dEl) dEl.textContent = pad(timeLeft.days);
      if (hEl) hEl.textContent = pad(timeLeft.hours);
      if (mEl) mEl.textContent = pad(timeLeft.minutes);
      if (sEl) sEl.textContent = pad(timeLeft.seconds);

      const progress = calculateProgress(ev.createdAt, ev.date);
      if (barEl) barEl.style.width = `${progress}%`;
      if (pctEl) pctEl.textContent = `${progress}%`;

      // Update urgency glow if < 24h
      if (diff <= ONE_DAY_MS) {
        cardEl.classList.add('urgent-glow');
      }
    }

    // 2. In-place DOM update for Table View
    const rowEl = document.querySelector(`.table-row[data-id="${ev.id}"]`);
    if (rowEl && ev.status !== 'completed' && timeLeft) {
      const tableCountdownEl = rowEl.querySelector('.val-table-countdown');
      if (tableCountdownEl) {
        tableCountdownEl.textContent = `${pad(timeLeft.days)}d ${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s`;
      }
    }
  });

  if (stateModified) {
    saveEvents(events);
    if (typeof onStateChange === 'function') {
      onStateChange();
    }
  }
}

/**
 * Start the 1-second countdown interval
 */
export function startCountdownLoop(onStateChange, onToastAlert) {
  stopCountdownLoop();
  tick(onStateChange, onToastAlert);
  intervalId = setInterval(() => {
    tick(onStateChange, onToastAlert);
  }, 1000);
}

/**
 * Stop the loop
 */
export function stopCountdownLoop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
