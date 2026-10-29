/**
 * notify.js - Notifications & Sound Alerts Module
 * Implements FR5, Web Notification API, Web Audio API chime, and fallback alerts
 */

import { getSettings } from './storage.js';

let audioCtx = null;

/**
 * Initialize Web Audio Context lazily on first user gesture
 */
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play alert chime using Web Audio API synthesized tones
 * (Guarantees reliable playback in modern browsers without broken path / CORS issues)
 */
export function playAlertSound() {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;

      // Note 1: E5 (659 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Note 2: A5 (880 Hz) with soft bell harmonics
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.15);
      gain2.gain.setValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.75);

      return;
    }
  } catch (err) {
    console.warn('Web Audio synthesis error, falling back to audio tag:', err);
  }

  // Fallback to audio element
  try {
    const audio = new Audio('assets/alert.mp3');
    audio.play().catch(() => {});
  } catch (e) {
    // Ignore autoplay policy restriction
  }
}

/**
 * Check browser notification support
 */
export function isNotificationSupported() {
  return 'Notification' in window;
}

/**
 * Get current notification permission state: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

/**
 * Trigger an event notification (Browser native Notification and/or fallback toast)
 */
export function triggerReminderNotification(title, body, fallbackCallback) {
  // Always play alert sound if enabled
  playAlertSound();

  // Attempt browser native notification
  if (isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234f46e5"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234f46e5"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E',
        silent: true // sound is handled via Web Audio
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.warn('Native notification failed:', err);
    }
  }

  // In-app visual alert (toast)
  if (typeof fallbackCallback === 'function') {
    fallbackCallback(title, body);
  }
}
