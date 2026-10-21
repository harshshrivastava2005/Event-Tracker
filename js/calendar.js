/**
 * calendar.js - Calendar Synchronization Module
 * Generates Google Calendar web intents and RFC-5545 .ics iCalendar files
 */

/**
 * Format a Date object to iCalendar UTC string format: YYYYMMDDTHHMMSSZ
 */
function toICSDate(date) {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate 1-click Google Calendar web intent URL
 */
export function getGoogleCalendarUrl(event) {
  const startDate = new Date(event.date);
  // Default duration: 1 hour
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatUTC = (d) => toICSDate(d);

  const details = `${event.notes ? event.notes + '\n\n' : ''}Tracked via EventTracker Dashboard.\nCategory: ${event.category}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[Countdown] ${event.title}`,
    dates: `${formatUTC(startDate)}/${formatUTC(endDate)}`,
    details: details
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate and download an RFC-5545 .ics file for Outlook, Apple Calendar, and iCal
 */
export function downloadICSFile(event) {
  const startUTC = toICSDate(event.date);
  const endUTC = toICSDate(new Date(new Date(event.date).getTime() + 60 * 60 * 1000));
  const nowUTC = toICSDate(new Date());
  const uid = `evt-${event.id}-${Math.random().toString(36).slice(2, 9)}@eventtracker.local`;

  const cleanNotes = (event.notes || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

  const cleanTitle = (event.title || 'Event')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventTracker//Event Countdown & Reminder Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowUTC}`,
    `DTSTART:${startUTC}`,
    `DTEND:${endUTC}`,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanNotes}`,
    `CATEGORIES:${event.category || 'General'}`,
    'STATUS:CONFIRMED',
    // 1-Day Reminder Alarm
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: 1 Day until ${cleanTitle}`,
    'END:VALARM',
    // 1-Hour Reminder Alarm
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Urgent: 1 Hour until ${cleanTitle}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsData = icsLines.join('\r\n');
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const safeFilename = (event.title || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 40);
  link.download = `${safeFilename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
