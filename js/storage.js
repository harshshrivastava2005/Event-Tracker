/**
 * storage.js - Data Layer & Persistence Module
 * Manages localStorage CRUD operations, settings, export/import per Section 5.1 & 5.2
 */

const STORAGE_KEY = 'events';
const SETTINGS_KEY = 'eventtracker_settings';

/**
 * Initial sample events to give new users an immediate, rich experience
 */
export const getSampleEvents = () => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  // Format date for datetime-local
  const toLocalISO = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return [
    {
      id: now + 1,
      title: 'Web Development Project Review',
      date: toLocalISO(new Date(now + 4 * dayMs + 14 * hourMs)),
      category: 'Exam',
      notes: 'Final semester PDR presentation with faculty panel and live demonstration.',
      createdAt: now - 3 * dayMs,
      repeat: 'none',
      notified1d: false,
      notified1h: false,
      notified10m: false,
      status: 'upcoming'
    },
    {
      id: now + 2,
      title: 'Cloud Computing Assignment Due',
      date: toLocalISO(new Date(now + 1 * dayMs + 5 * hourMs)),
      category: 'Deadline',
      notes: 'Submit containerized deployment architecture diagram and PDF documentation.',
      createdAt: now - 2 * dayMs,
      repeat: 'none',
      notified1d: false,
      notified1h: false,
      notified10m: false,
      status: 'upcoming'
    },
    {
      id: now + 3,
      title: "Alex's Birthday Bash",
      date: toLocalISO(new Date(now + 18 * dayMs + 8 * hourMs)),
      category: 'Birthday',
      notes: 'Surprise celebration dinner at Skylight Bistro. Don’t forget the gift!',
      createdAt: now - 5 * dayMs,
      repeat: 'yearly',
      notified1d: false,
      notified1h: false,
      notified10m: false,
      status: 'upcoming'
    },
    {
      id: now + 4,
      title: 'Sprint Planning & Standup',
      date: toLocalISO(new Date(now + 3 * hourMs + 30 * 60 * 1000)),
      category: 'Meeting',
      notes: 'Weekly product roadmap review and milestone allocation with tech lead.',
      createdAt: now - 1 * dayMs,
      repeat: 'weekly',
      notified1d: false,
      notified1h: false,
      notified10m: false,
      status: 'upcoming'
    },
    {
      id: now + 5,
      title: 'Weekly Team Status Sync',
      date: toLocalISO(new Date(now - 1 * dayMs - 2 * hourMs)),
      category: 'Meeting',
      notes: 'Sync with frontend engineering team on deliverables.',
      createdAt: now - 8 * dayMs,
      repeat: 'none',
      notified1d: true,
      notified1h: true,
      notified10m: true,
      status: 'overdue'
    },
    {
      id: now + 6,
      title: 'Semester Registration Deadline',
      date: toLocalISO(new Date(now - 4 * dayMs)),
      category: 'Other',
      notes: 'Elective course selection and lab assignment confirmation.',
      createdAt: now - 10 * dayMs,
      repeat: 'none',
      notified1d: true,
      notified1h: true,
      notified10m: true,
      status: 'completed'
    }
  ];
};

/**
 * Helper to compute the next occurrence for recurring events
 * (Daily, Weekly, Monthly, Yearly)
 */
export function getNextOccurrence(dateStr, repeatType) {
  if (!repeatType || repeatType === 'none' || repeatType === false) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  const now = Date.now();

  // Advance date until it's strictly in the future
  while (d.getTime() <= now) {
    if (repeatType === 'daily') {
      d.setDate(d.getDate() + 1);
    } else if (repeatType === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (repeatType === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else if (repeatType === 'yearly' || repeatType === true) {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      return null;
    }
  }

  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Normalizes repeat field value to standard string
 */
export function normalizeRepeat(rep) {
  if (!rep || rep === 'none' || rep === false) return 'none';
  if (rep === true) return 'yearly';
  const val = String(rep).toLowerCase();
  return ['daily', 'weekly', 'monthly', 'yearly'].includes(val) ? val : 'none';
}

/**
 * Fetch all events from localStorage
 */
export const getAllEvents = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First run: pre-populate with sample events
      const samples = getSampleEvents();
      saveEvents(samples);
      return samples;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading events from localStorage:', err);
    return [];
  }
};

/**
 * Persist events array to localStorage
 */
export const saveEvents = (events) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch (err) {
    console.error('Error saving events to localStorage (quota exceeded?):', err);
    return false;
  }
};

/**
 * Retrieve a single event by ID
 */
export const getEventById = (id) => {
  const events = getAllEvents();
  return events.find(e => String(e.id) === String(id)) || null;
};

/**
 * Add a new event
 */
export const addEvent = (eventData) => {
  const events = getAllEvents();
  const newEvent = {
    id: Date.now(),
    title: eventData.title.trim(),
    date: eventData.date,
    category: eventData.category,
    notes: (eventData.notes || '').trim(),
    createdAt: Date.now(),
    repeat: normalizeRepeat(eventData.repeat),
    notified1d: false,
    notified1h: false,
    notified10m: false,
    status: 'upcoming'
  };

  events.unshift(newEvent);
  saveEvents(events);
  return newEvent;
};

/**
 * Update an existing event
 */
export const updateEvent = (id, updatedFields) => {
  const events = getAllEvents();
  const index = events.findIndex(e => String(e.id) === String(id));
  if (index === -1) return null;

  const repeatVal = updatedFields.repeat !== undefined ? normalizeRepeat(updatedFields.repeat) : events[index].repeat;

  // Merge fields
  events[index] = {
    ...events[index],
    ...updatedFields,
    repeat: repeatVal,
    title: updatedFields.title !== undefined ? updatedFields.title.trim() : events[index].title,
    notes: updatedFields.notes !== undefined ? updatedFields.notes.trim() : events[index].notes
  };

  saveEvents(events);
  return events[index];
};

/**
 * Reschedule an overdue or past event to a new future date
 */
export const rescheduleEvent = (id, newDate) => {
  const events = getAllEvents();
  const ev = events.find(e => String(e.id) === String(id));
  if (!ev) return null;

  ev.date = newDate;
  ev.status = 'upcoming';
  ev.notified1d = false;
  ev.notified1h = false;
  ev.notified10m = false;
  ev.createdAt = Date.now();

  saveEvents(events);
  return ev;
};

/**
 * Delete an event by ID
 */
export const deleteEvent = (id) => {
  const events = getAllEvents();
  const filtered = events.filter(e => String(e.id) !== String(id));
  saveEvents(filtered);
  return filtered;
};

/**
 * Mark event as completed or upcoming
 */
export const toggleEventStatus = (id) => {
  const events = getAllEvents();
  const ev = events.find(e => String(e.id) === String(id));
  if (!ev) return null;

  ev.status = ev.status === 'completed' ? 'upcoming' : 'completed';
  saveEvents(events);
  return ev;
};

/**
 * App Settings (theme, audio, notification preferences)
 */
export const getSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const defaults = {
      theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      soundEnabled: true,
      bannerDismissed: false
    };
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (e) {
    return { theme: 'light', soundEnabled: true, bannerDismissed: false };
  }
};

export const saveSettings = (newSettings) => {
  try {
    const current = getSettings();
    const merged = { ...current, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Error saving settings:', e);
    return null;
  }
};

/**
 * Export all events as a JSON file download (PDR FR9)
 */
export const exportEventsJSON = () => {
  const events = getAllEvents();
  const payload = {
    app: 'EventTracker',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    eventsCount: events.length,
    events
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const nowStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `eventtracker-backup-${nowStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

/**
 * Import events from JSON string (merge or replace)
 */
export const importEventsJSON = (jsonString, mode = 'merge') => {
  try {
    const parsed = JSON.parse(jsonString);
    const incomingEvents = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.events) ? parsed.events : null);

    if (!incomingEvents) {
      throw new Error('Invalid backup file: Could not find events list.');
    }

    // Validate minimum event structure
    const validEvents = incomingEvents.filter(ev => ev && ev.title && ev.date && ev.category);

    if (validEvents.length === 0) {
      throw new Error('No valid event records found in JSON.');
    }

    let finalEvents;
    if (mode === 'replace') {
      finalEvents = validEvents;
    } else {
      // Merge: avoid duplicates with identical id
      const existing = getAllEvents();
      const existingIds = new Set(existing.map(e => String(e.id)));
      const newItems = validEvents.filter(e => !existingIds.has(String(e.id)));
      finalEvents = [...existing, ...newItems];
    }

    saveEvents(finalEvents);
    return { success: true, count: validEvents.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
