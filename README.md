# Event Countdown & Reminder Dashboard

A modern, responsive, client-side single-page web application designed and built in compliance with the **Preliminary Design Review (PDR)** specifications for the MCA Web Development course.

![EventTracker Preview](https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=1200&q=80)

---

## 📌 Project Overview

Users often miss crucial deadlines, exams, and personal events because they rely on memory, scattered sticky notes, or heavy calendar applications that require user accounts, internet access, and external server synchronization.

**EventTracker** is a lightweight, privacy-focused, offline-first dashboard running entirely in the browser using HTML5, CSS3, and modern modular ES6 JavaScript.

### Core Objectives
1. **Live Second-by-Second Countdowns**: Real-time breakdown of days, hours, minutes, and seconds for every event.
2. **Visual Progress Tracking**: Real-time progress bar displaying elapsed percentage from event creation to the target deadline.
3. **Persistent Local Storage**: Full CRUD (Create, Read, Update, Delete) persisting across browser refreshes and restarts without an external database.
4. **Smart Dual-Milestone Notifications**: Automated alerts **1 day** and **1 hour** before each event via the Web Notification API, accompanied by a Web Audio chime and non-blocking in-app toasts.
5. **Categorization & Filtering**: Distinct color-coded categories (*Exam = Red, Deadline = Orange, Birthday = Pink, Meeting = Blue, Other = Teal*), live search, status tabs (*Upcoming, Today / <24h, Completed*), and multiple sort modes.
6. **Data Portability**: Full JSON export and import capabilities for offline backup and device migration.
7. **Accessible Dark / Light Theming**: Smooth CSS custom property transitions with persistent theme memory.

---

## 🏛️ System Architecture

The application adopts a **three-layer client-side MVC architecture** running fully in the browser:

```
┌─────────────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER (HTML5 + CSS3)            │
│  • Sticky Header & Logo     • Statistics Cards Bar          │
│  • Search & Filter Pills    • Status Tabs (Upcoming/Today)  │
│  • Dynamic Events Grid      • Add/Edit Form & Backup Modals │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              APPLICATION LOGIC LAYER (JavaScript ES6)       │
│  • app.js        (Controller, event listeners & init)      │
│  • countdown.js  (getTimeLeft, 1000ms tick, milestone flags)│
│  • notify.js     (Notification API, Web Audio API chime)   │
│  • ui.js         (DOM renderer, toast stack, theme toggle)  │
│  • validate.js   (Input validation & error boundary)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 DATA LAYER (Browser Storage & APIs)         │
│  • storage.js    (localStorage CRUD & JSON export/import)   │
│  • Web Storage   (localStorage['events'], settings)         │
│  • Browser APIs  (Date API, Web Audio API, Notification API)│
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 File & Directory Structure

```
web project/
│
├── index.html                  # Semantic HTML5 single-page structure & modals
├── PDR_Event_Countdown_...pdf   # Preliminary Design Review reference document
├── README.md                   # Complete documentation & viva review guide
│
├── css/
│   └── style.css               # Design system, CSS variables, glassmorphism, responsive grid
│
├── js/
│   ├── app.js                  # Main controller & event dispatching
│   ├── countdown.js            # Timer calculation loop & milestone alert detection
│   ├── notify.js               # AudioContext sound synthesis & Notification API integration
│   ├── storage.js              # LocalStorage CRUD operations, JSON backup & sample data
│   ├── ui.js                   # DOM rendering, card templates, stats counters, toasts
│   └── validate.js             # Form validation (required title, future date constraint)
│
└── assets/
    ├── alert.mp3               # Audio chime fallback file
    └── alert.wav               # High fidelity chime waveform
```

---

## 📋 Requirements Baseline & Verification

| Requirement ID | Specification | Status | Implementation Details |
| :--- | :--- | :---: | :--- |
| **FR1** | Add an event (title, date-time, category, notes, repeat) | ✅ Complete | Accessible modal dialog with responsive form controls. |
| **FR2** | Input validation (title required, date must be in future) | ✅ Complete | Handled in `validate.js` with live error banners and field highlights. |
| **FR3** | Live countdown updating every second | ✅ Complete | `countdown.js` executes 1-second in-place DOM updates with zero layout reflow. |
| **FR4** | Save, load, edit, delete events in localStorage | ✅ Complete | `storage.js` provides JSON CRUD with error handling. |
| **FR5** | Notify 1 day and 1 hour before event, with sound | ✅ Complete | Automatic milestone checking triggers browser notifications, toasts, and Web Audio chimes. |
| **FR6** | Search, category filter, sort by date | ✅ Complete | Instant multi-condition client-side filter by title/notes, category pills, and sort modes. |
| **FR7** | Auto-move finished events to Completed / yearly repeat | ✅ Complete | Handled on countdown zero tick; recurring events roll over by +1 year automatically. |
| **FR8** | Dark / light theme toggle | ✅ Complete | Instant CSS variable switching with `data-theme` attribute and persistence. |
| **FR9** | Export and import events as JSON | ✅ Complete | File blob download and drag-and-drop import with merge/replace strategies. |

---

## 🎨 Color Coding System

As specified in the PDR wireframe:
- 🔴 **Exam**: Crimson Red (`#ef4444`)
- 🟠 **Deadline**: Vibrant Orange (`#f97316`)
- 🌸 **Birthday**: Lively Rose Pink (`#ec4899`)
- 🔵 **Meeting**: Electric Blue (`#3b82f6`)
- 🟢 **Other**: Teal Emerald (`#14b8a6`)

---

## 🚀 How to Run Locally

Because the project uses standard ES6 modules (`import`/`export`), it is best viewed via a local web server:

### Option 1: Visual Studio Code Live Server (Recommended)
1. Open the project folder in VS Code.
2. Right-click `index.html` and click **"Open with Live Server"**.
3. The dashboard opens automatically at `http://127.0.0.1:5500`.

### Option 2: Python HTTP Server
Run the following in PowerShell / Terminal:
```powershell
python -m http.server 8080
```
Then visit `http://localhost:8080` in your web browser.

### Option 3: Node.js (npx serve)
```bash
npx serve .
```

---

## 🛡️ Risk Mitigation Features

1. **Browser Blocks Notifications**: An in-app top fallback banner prompts users to enable notifications, while toast alerts and Web Audio synthesized chimes ensure alerts are never missed even if system permissions are denied.
2. **Tab Throttling in Background**: Countdowns recalculate the difference directly against `Date.now()` on every tick rather than incrementing a counter, eliminating timer drift.
3. **Data Loss Protection**: Users can download a JSON backup at any time with a single click, or restore previous backups.
4. **Offline Capability**: No external CDN dependencies required for core functionality; works completely offline.
