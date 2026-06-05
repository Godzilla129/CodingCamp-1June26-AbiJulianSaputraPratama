# Implementation Plan: New Tab Dashboard

## Overview

Build a zero-dependency, single-page New Tab Dashboard using plain HTML, CSS, and vanilla JavaScript across three files: `index.html`, `css/style.css`, and `js/app.js`. The implementation follows a Layered MVC-lite pattern with five widget controllers, a shared StorageModule, and a StateModule — all wired together on page load.

---

## Tasks

- [x] 1. Scaffold project structure and static HTML
  - Create `index.html` with semantic widget container sections: `#greeting-widget`, `#timer-widget`, `#task-manager`, `#quick-links`, and `#theme-toggle`
  - Add all static DOM elements per the design's Component interfaces (clock, date-display, greeting-text, name-form; timer-display, timer-controls, duration-form; task-input-area, sort-controls, task-list; links-grid, add-link-form; theme-toggle button)
  - Link `css/style.css` via `<link>` and `js/app.js` via `<script defer>`
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 2. Implement StorageModule and StateModule
  - [x] 2.1 Implement `StorageModule` with `read(key, fallback)`, `write(key, value)`, and `remove(key)` methods
    - Wrap `localStorage.getItem` in JSON.parse with try/catch; return `fallback` on error or missing key
    - Wrap `localStorage.setItem` in try/catch; throw a custom `StorageError` on failure
    - Define all `ntd_` storage keys as named constants
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ]* 2.2 Write property test for StorageModule.read fallback (Property 19)
    - **Property 19: Storage read returns fallback for any corrupt or missing data**
    - **Validates: Requirements 9.3**
  - [x] 2.3 Implement `StateModule` holding runtime state for all widgets with defined defaults
    - Fields: `name`, `timerDuration`, `tasks`, `sortPref`, `links`, `theme`
    - Provide `init()` method that populates all fields from `StorageModule`
    - _Requirements: 9.1_

- [x] 3. Implement ThemeController
  - [x] 3.1 Implement `ThemeController` with `init()`, `toggle()`, `apply(mode)`, and `getOSPref()` methods
    - `init()`: read `ntd_theme` from storage → fall back to `getOSPref()` → fall back to `"light"`
    - `apply(mode)`: add/remove `class="dark"` on `<html>`, update icon (☀️/🌙) and `aria-label`
    - `toggle()`: flip theme, call `StorageModule.write` before calling `apply`
    - Ensure the toggle button meets the 24×24 CSS pixel minimum touch target
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  - [ ]* 3.2 Write property test for theme persistence (Property 20)
    - **Property 20: Theme preference persists across simulated page reloads**
    - **Validates: Requirements 10.4, 10.5**

- [x] 4. Implement CSS for layout and theming
  - Write base layout styles in `css/style.css` for the dashboard grid, widget cards, and typography
  - Implement light mode (default) CSS custom properties (`--bg`, `--surface`, `--text`, etc.)
  - Implement dark mode overrides under `html.dark` selector using the same custom properties
  - Style all interactive elements: buttons, inputs, checkboxes, select, links
  - Apply strikethrough and muted styling for completed task items (`.task-item.completed`)
  - Ensure the theme toggle button has `min-width: 24px; min-height: 24px`
  - _Requirements: 10.1, 10.2, 10.3, 6.2, 6.3_

- [x] 5. Implement GreetingController
  - [x] 5.1 Implement pure helper functions: `formatTime(date)`, `formatDate(date)`, `getGreeting(hour)`
    - `formatTime`: zero-pad hours and minutes to produce `HH:MM`
    - `formatDate`: produce `"Weekday, D Month YYYY"` using `toLocaleDateString` or manual construction
    - `getGreeting`: map hour ranges 5–11 → morning, 12–17 → afternoon, 18–21 → evening, else → night
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4_
  - [ ]* 5.2 Write property test for `formatTime` (Property 1)
    - **Property 1: Time format is always valid HH:MM**
    - **Validates: Requirements 1.1**
  - [ ]* 5.3 Write property test for `formatDate` (Property 2)
    - **Property 2: Date string contains all required components**
    - **Validates: Requirements 1.3**
  - [ ]* 5.4 Write property test for `getGreeting` (Property 3)
    - **Property 3: Greeting is correct for every hour of the day**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  - [x] 5.5 Implement `GreetingController.init()`, `tick()`, and `saveName(raw)`
    - `init()`: read `ntd_name` from storage, start 1-second `setInterval` calling `tick()`
    - `tick()`: call `formatTime`, `formatDate`, `getGreeting` and update `#clock`, `#date-display`, `#greeting-text`; display `"--:--"` if `Date` is invalid
    - `saveName(raw)`: reject if `raw.trim().length > 50` (show `#name-error`); persist then update greeting within 100 ms
    - Dismiss `#name-error` on input event
    - _Requirements: 1.2, 1.4, 1.5, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  - [ ]* 5.6 Write property test for name validation (Property 4)
    - **Property 4: Name over 50 characters is always rejected**
    - **Validates: Requirements 2.10**

- [ ] 6. Checkpoint — Greeting and theme working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement TimerController
  - [x] 7.1 Implement pure helper `TimerController.formatTime(seconds)`
    - Convert total seconds to `MM:SS` with zero-padding; handle full range 0–7200
    - _Requirements: 3.3_
  - [ ]* 7.2 Write property test for timer `formatTime` (Property 5)
    - **Property 5: Timer format is always valid MM:SS**
    - **Validates: Requirements 3.3**
  - [x] 7.3 Implement `TimerController.setDuration(mins)` with validation and persistence
    - Accept integers 1–120 inclusive; reject others with `#duration-error` message; persist accepted values
    - _Requirements: 3.9, 3.10, 3.11_
  - [ ]* 7.4 Write property test for `setDuration` validation (Property 6)
    - **Property 6: Custom duration in [1, 120] is accepted; outside is rejected**
    - **Validates: Requirements 3.9, 3.10**
  - [x] 7.5 Implement `TimerController.init()`, `start()`, `stop()`, `reset()`, `tick()`, and `onComplete()`
    - `init()`: load persisted duration (default 25), render display; show `d * 60` seconds as MM:SS
    - `start()`: guard against double-start; begin/resume `setInterval` calling `tick()` each second
    - `stop()`: clear interval, retain remaining time (RUNNING → PAUSED)
    - `reset()`: clear interval, restore configured duration (any state → IDLE)
    - `tick()`: decrement remaining; call `onComplete()` when reaching 0
    - `onComplete()`: request notification permission → grant: `new Notification(…)`; deny/unavailable: on-screen alert
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.12_
  - [ ]* 7.6 Write property test for duration-display consistency (Property 7)
    - **Property 7: Custom duration is reflected in timer display after init**
    - **Validates: Requirements 3.8, 3.11**

- [x] 8. Implement TaskController — core CRUD
  - [x] 8.1 Implement `generateId()` using `crypto.randomUUID()`
    - _Requirements: 11.5_
  - [x] 8.2 Implement `TaskController.addTask(title)` with validation, deduplication, persistence, and render
    - Reject empty/whitespace (show `#task-add-error`), reject duplicates (case-insensitive trimmed match)
    - On success: create Task object `{id, title: title.trim(), completed: false, createdAt: Date.now()}`, write to storage, re-render, clear input
    - Dismiss error on input event
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ]* 8.3 Write property test for task add — valid input persists (Property 8)
    - **Property 8: Adding a valid task increases the task list and persists to storage**
    - **Validates: Requirements 4.2, 9.2**
  - [ ]* 8.4 Write property test for whitespace rejection (Property 9)
    - **Property 9: Whitespace-only input is always rejected for task add**
    - **Validates: Requirements 4.3**
  - [ ]* 8.5 Write property test for duplicate task rejection (Property 10)
    - **Property 10: Duplicate task title is always rejected on add**
    - **Validates: Requirements 4.4**
  - [x] 8.6 Implement `TaskController.editTask(id, newTitle)` with validation and persistence
    - Replace task title span with editable input pre-filled with current title
    - Confirm (Enter / confirm button): reject empty/whitespace (restore original silently), reject duplicate (show inline error), else update and persist
    - Cancel (Escape / cancel button): restore original title display
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 8.7 Write property test for valid edit persistence (Property 11)
    - **Property 11: Valid edit title persists correctly**
    - **Validates: Requirements 5.3**
  - [ ]* 8.8 Write property test for duplicate edit rejection (Property 12)
    - **Property 12: Duplicate title on edit is always rejected**
    - **Validates: Requirements 5.5**

- [ ] 9. Implement TaskController — complete, delete, and sort
  - [x] 9.1 Implement `TaskController.toggleComplete(id)` with storage write, revert on failure, and visual update
    - Flip `completed` flag; write to storage; on `StorageError` revert flag and show inline error
    - `renderTasks()` must apply `.completed` class (strikethrough + muted styling) per task state
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 9.2 Write property test for toggle round-trip (Property 13)
    - **Property 13: Completing then uncompleting a task is a round-trip**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [x] 9.3 Implement `TaskController.deleteTask(id)` with storage write and revert on failure
    - Remove task from state and persist; on `StorageError` restore task and show inline error
    - _Requirements: 6.5, 6.6, 6.7_
  - [x] 9.4 Implement `TaskController.getSortedTasks()`, `setSort(mode)`, and sort select control
    - `getSortedTasks()`: return sorted copy; `creation` → ascending `createdAt`; `active-first` → incomplete before complete then `createdAt`; `completed-first` → complete before incomplete then `createdAt`
    - `setSort(mode)`: persist to `ntd_sort_pref`, re-render within 100 ms
    - `init()`: load sort pref from storage (default `"creation"`), populate `#sort-select`, render tasks
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 9.5 Write property test for sort ordering (Property 14)
    - **Property 14: Sorted task list satisfies the selected ordering criterion**
    - **Validates: Requirements 7.1, 7.2**
  - [ ]* 9.6 Write property test for sort preference persistence (Property 15)
    - **Property 15: Sort preference persists across simulated page reloads**
    - **Validates: Requirements 7.3, 7.4**

- [ ] 10. Checkpoint — Task Manager fully functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement LinksController
  - [ ] 11.1 Implement `LinksController.isValidUrl(url)` and `isDuplicateUrl(url)` pure functions
    - `isValidUrl`: return `true` only if URL starts with `"http://"` or `"https://"`
    - `isDuplicateUrl`: case-insensitive match against existing saved link URLs
    - _Requirements: 8.6, 8.7_
  - [ ]* 11.2 Write property test for URL validation (Property 17)
    - **Property 17: URL without http/https prefix is always rejected**
    - **Validates: Requirements 8.6**
  - [ ] 11.3 Implement `LinksController.addLink(label, url)` with full validation, persistence, and render
    - Reject empty/whitespace label (show `#link-error`), invalid URL, duplicate URL, and when links.length === 50
    - On success: create Link object `{id, label: label.trim(), url}`, write to storage, re-render
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [ ]* 11.4 Write property test for valid link add (Property 16)
    - **Property 16: Adding a valid link increases the link list and persists to storage**
    - **Validates: Requirements 8.3, 8.4**
  - [ ]* 11.5 Write property test for whitespace label rejection (Property 9 — links branch)
    - **Property 9: Whitespace-only input is always rejected for link add**
    - **Validates: Requirements 8.5**
  - [ ]* 11.6 Write property test for duplicate URL rejection (Property 18)
    - **Property 18: Duplicate URL is always rejected on link add**
    - **Validates: Requirements 8.7**
  - [ ] 11.7 Implement `LinksController.deleteLink(id)` and `renderLinks()`
    - `renderLinks()`: build `#links-grid` with `.link-item` elements; each link button uses `target="_blank" rel="noopener noreferrer"`
    - Delete: remove from state and storage immediately, re-render
    - `init()`: load links from storage, render
    - _Requirements: 8.1, 8.2, 8.9, 8.10_

- [ ] 12. Wire everything together in `js/app.js`
  - [ ] 12.1 Implement the app bootstrap in `js/app.js`
    - Call `StorageModule` then `StateModule.init()` before any controller init
    - Call `ThemeController.init()` first so the correct theme is applied before content renders
    - Call `GreetingController.init()`, `TimerController.init()`, `TaskController.init()`, `LinksController.init()` in sequence
    - Attach global `window.onerror` and `window.addEventListener('unhandledrejection')` handlers that log to console without crashing the UI
    - _Requirements: 9.1, 9.2, 11.4_
  - [ ] 12.2 Attach all event listeners for widget controls
    - Name save button / Enter on name input → `GreetingController.saveName()`
    - Timer Start / Stop / Reset buttons → respective `TimerController` methods
    - Duration Set button → `TimerController.setDuration()`
    - Task Add button / Enter on task input → `TaskController.addTask()`
    - Sort select `change` → `TaskController.setSort()`
    - Link Add button → `LinksController.addLink()`
    - Theme toggle button → `ThemeController.toggle()`
    - _Requirements: 2.6, 3.2, 3.4, 3.5, 3.9, 4.1, 7.2, 8.3, 10.1_

- [ ] 13. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests should use **fast-check** loaded via CDN `<script>` in a separate test HTML file (e.g., `tests/index.test.html`), keeping `index.html` production-clean and dependency-free
- Each property test file should tag tests with `// Feature: new-tab-dashboard, Property N: ...`
- All `StorageModule.write` calls must complete before the corresponding DOM update — never render success state if the write threw a `StorageError`
- `crypto.randomUUID()` is used for ID generation; it is available in all modern browsers without polyfills
- The three production files (`index.html`, `css/style.css`, `js/app.js`) must contain zero third-party library references

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "4"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1", "5.1", "7.1", "8.1"] },
    { "id": 4, "tasks": ["3.2", "5.2", "5.3", "5.4", "7.2", "7.3"] },
    { "id": 5, "tasks": ["5.5", "7.4", "7.5", "8.2", "11.1"] },
    { "id": 6, "tasks": ["5.6", "7.6", "8.3", "8.4", "8.5", "8.6", "11.2", "11.3"] },
    { "id": 7, "tasks": ["8.7", "8.8", "9.1", "9.3", "9.4", "11.4", "11.5", "11.6", "11.7"] },
    { "id": 8, "tasks": ["9.2", "9.5", "9.6"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["12.2"] }
  ]
}
```
