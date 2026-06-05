# Design Document

## Overview

The New Tab Dashboard is a zero-dependency, single-page web application built with plain HTML, CSS, and vanilla JavaScript. It runs entirely client-side with no build step, no backend, and no external libraries. All user data is persisted using the Browser Local Storage API.

The dashboard gives users five core widgets on one screen:

- **Greeting_Widget** — live clock (HH:MM, updated every second), full date, time-based greeting, and optional personalised user name
- **Timer** — Pomodoro countdown (25 min default, 1–120 min configurable), start/stop/reset, browser notification or on-screen alert on completion
- **Task_Manager** — to-do list with add, inline-edit, delete, complete/incomplete toggle, and three sort modes
- **Quick_Links** — saved shortcut buttons (label + URL, open in new tab, up to 50 links)
- **Theme_Controller** — light/dark toggle, persisted, OS preference fallback

The entire app ships as three files: `index.html`, `css/style.css`, and `js/app.js`.

---

## Architecture

### High-Level Structure

The app follows a simple **Layered MVC-lite** pattern inside a single JS file:

```
┌─────────────────────────────────────────────────────────┐
│                      index.html                         │
│   Static markup + semantic widget containers            │
└────────────────────┬────────────────────────────────────┘
                     │ loads
┌────────────────────▼────────────────────────────────────┐
│                     js/app.js                           │
│                                                         │
│  ┌─────────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │  Storage    │  │   State   │  │    UI / Render   │  │
│  │  Module     │◄─┤  Module   │◄─┤    Module        │  │
│  │ (read/write │  │ (in-memory│  │ (DOM updates,    │  │
│  │  LocalStg.) │  │  truth)   │  │  event listeners)│  │
│  └─────────────┘  └───────────┘  └──────────────────┘  │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Widget Controllers                    │ │
│  │  GreetingController  TimerController               │ │
│  │  TaskController      LinksController               │ │
│  │  ThemeController                                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Data flow (single direction):**

1. On page load, `StorageModule` reads all keys from Local Storage into `StateModule`.
2. Each `WidgetController` initialises its DOM from `StateModule`.
3. User actions trigger a controller method → `StateModule` updated → `StorageModule.write()` called → DOM re-rendered.

This ensures that Local Storage writes always precede UI updates, satisfying Requirement 9.2.

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `StorageModule` | Wraps `localStorage.getItem/setItem/removeItem`; catches quota errors; provides typed read with fallback |
| `StateModule` | Holds runtime state for all widgets; single source of truth |
| `GreetingController` | 1-second `setInterval` clock; greeting logic; name persistence |
| `TimerController` | Countdown `setInterval`; start/stop/reset; notification permission; custom duration |
| `TaskController` | CRUD for tasks; duplicate detection; sort logic |
| `LinksController` | CRUD for links; URL validation; limit enforcement |
| `ThemeController` | Theme toggle; OS preference detection; persistence |

---

## Components and Interfaces

### Greeting_Widget

**DOM structure**
```html
<section id="greeting-widget">
  <div id="clock"></div>          <!-- HH:MM -->
  <div id="date-display"></div>   <!-- e.g., Monday, 2 June 2025 -->
  <div id="greeting-text"></div>  <!-- e.g., Good morning, Abi -->
  <div id="name-form">
    <input id="name-input" type="text" maxlength="50" />
    <button id="name-save-btn">Save</button>
    <span id="name-error" role="alert"></span>
  </div>
</section>
```

**GreetingController API**
```js
GreetingController.init()          // starts clock interval, renders initial state
GreetingController.tick()          // called every second; updates clock + date + greeting
GreetingController.saveName(raw)   // validates, persists, updates greeting
GreetingController.getGreeting(h)  // pure fn: hour (0–23) → greeting string
GreetingController.formatTime(d)   // pure fn: Date → "HH:MM"
GreetingController.formatDate(d)   // pure fn: Date → "Weekday, D Month YYYY"
```

**Greeting logic** (hour ranges, 24-h clock)

| Range | Greeting |
|---|---|
| 05:00 – 11:59 | Good morning |
| 12:00 – 17:59 | Good afternoon |
| 18:00 – 21:59 | Good evening |
| 22:00 – 04:59 | Good night |

---

### Timer

**DOM structure**
```html
<section id="timer-widget">
  <div id="timer-display">25:00</div>      <!-- MM:SS -->
  <div id="timer-controls">
    <button id="timer-start">Start</button>
    <button id="timer-stop">Stop</button>
    <button id="timer-reset">Reset</button>
  </div>
  <div id="duration-form">
    <input id="duration-input" type="number" min="1" max="120" />
    <button id="duration-save-btn">Set</button>
    <span id="duration-error" role="alert"></span>
  </div>
</section>
```

**TimerController API**
```js
TimerController.init()              // loads persisted duration, renders
TimerController.start()             // begins/resumes countdown interval
TimerController.stop()              // pauses, retains remaining time
TimerController.reset()             // clears interval, restores configured duration
TimerController.tick()              // decrements remaining; calls onComplete when 0
TimerController.onComplete()        // fires notification or alert
TimerController.setDuration(mins)   // validates 1–120, persists, resets display
TimerController.formatTime(secs)    // pure fn: seconds → "MM:SS"
TimerController.requestNotificationPermission() // async; requests browser permission
```

**Timer state machine**

```
     ┌─────────┐
     │  IDLE   │◄──────────────────────────────────┐
     └────┬────┘                                    │
          │ start()                                 │ reset()
          ▼                                         │
     ┌─────────┐    stop()    ┌──────────┐          │
     │ RUNNING │────────────► │  PAUSED  │──────────┘
     └────┬────┘              └────┬─────┘
          │ remaining==0            │ start()
          ▼                         │
     ┌──────────┐                   │
     │ COMPLETE │                   │
     └──────────┘                   │
          │ reset() ────────────────┘
```

---

### Task_Manager

**DOM structure**
```html
<section id="task-manager">
  <div id="task-input-area">
    <input id="task-input" type="text" maxlength="255" />
    <button id="task-add-btn">Add</button>
    <span id="task-add-error" role="alert"></span>
  </div>
  <div id="sort-controls">
    <select id="sort-select">
      <option value="creation">Default (oldest first)</option>
      <option value="active-first">Active first</option>
      <option value="completed-first">Completed first</option>
    </select>
  </div>
  <ul id="task-list"></ul>  <!-- task items rendered here -->
</section>
```

Each rendered task item:
```html
<li data-id="{id}" class="task-item [completed]">
  <input type="checkbox" class="task-check" />
  <span class="task-title"></span>
  <button class="task-edit-btn">Edit</button>
  <button class="task-delete-btn">Delete</button>
  <!-- inline edit mode replaces span with: -->
  <input type="text" class="task-edit-input" maxlength="100" />
  <button class="task-edit-confirm">✓</button>
  <button class="task-edit-cancel">✕</button>
  <span class="task-edit-error" role="alert"></span>
</li>
```

**TaskController API**
```js
TaskController.init()                 // loads tasks + sort pref, renders
TaskController.addTask(title)         // validates, deduplicates, persists, re-renders
TaskController.editTask(id, newTitle) // validates, deduplicates, persists, re-renders
TaskController.deleteTask(id)         // removes, persists
TaskController.toggleComplete(id)     // flips completed flag, persists
TaskController.setSort(mode)          // persists sort pref, re-renders
TaskController.getSortedTasks()       // pure fn: returns sorted copy of tasks array
TaskController.isDuplicate(title, excludeId?) // pure fn: case-insensitive trimmed match
TaskController.renderTasks()          // rebuilds task list DOM
```

**Sort logic**

| Mode | Comparator |
|---|---|
| `creation` | `a.createdAt - b.createdAt` (ascending) |
| `active-first` | incomplete before complete, then `createdAt` ascending |
| `completed-first` | complete before incomplete, then `createdAt` ascending |

---

### Quick_Links

**DOM structure**
```html
<section id="quick-links">
  <div id="links-grid"></div>  <!-- rendered link buttons -->
  <div id="add-link-form">
    <input id="link-label-input" type="text" maxlength="50" />
    <input id="link-url-input" type="url" maxlength="2048" />
    <button id="link-add-btn">Add Link</button>
    <span id="link-error" role="alert"></span>
  </div>
</section>
```

Each rendered link:
```html
<div class="link-item">
  <a class="link-btn" href="{url}" target="_blank" rel="noopener noreferrer">{label}</a>
  <button class="link-delete-btn" aria-label="Delete {label}">✕</button>
</div>
```

**LinksController API**
```js
LinksController.init()              // loads links, renders
LinksController.addLink(label, url) // validates, deduplicates, enforces cap, persists
LinksController.deleteLink(id)      // removes, persists
LinksController.isValidUrl(url)     // pure fn: checks http:// or https:// prefix
LinksController.isDuplicateUrl(url) // pure fn: case-insensitive match against saved links
LinksController.renderLinks()       // rebuilds links grid DOM
```

---

### Theme_Controller

**DOM structure**
```html
<button id="theme-toggle" aria-label="Switch to dark mode" style="min-width:24px;min-height:24px">
  <span id="theme-icon">☀️</span>
</button>
```

**ThemeController API**
```js
ThemeController.init()      // reads storage → OS pref → default light
ThemeController.toggle()    // flips theme, persists, updates DOM + icon
ThemeController.apply(mode) // adds/removes class on <html>, updates icon + aria-label
ThemeController.getOSPref() // returns 'dark' | 'light' from prefers-color-scheme
```

CSS theme classes applied to `<html>`:
- Light mode: default (no class)
- Dark mode: `class="dark"`

---

## Data Models

All data is stored in Local Storage as JSON strings. Keys are namespaced under `ntd_` (New Tab Dashboard) to avoid collisions.

### Storage Keys

| Key | Type | Default |
|---|---|---|
| `ntd_name` | `string` | `""` |
| `ntd_timer_duration` | `number` (minutes) | `25` |
| `ntd_tasks` | `Task[]` | `[]` |
| `ntd_sort_pref` | `"creation" \| "active-first" \| "completed-first"` | `"creation"` |
| `ntd_links` | `Link[]` | `[]` |
| `ntd_theme` | `"light" \| "dark"` | `""` (empty = use OS) |

### Task Object

```js
{
  id: string,           // UUID v4 generated at creation time
  title: string,        // 1–255 characters, user-supplied
  completed: boolean,   // false on creation
  createdAt: number     // Date.now() timestamp at creation
}
```

### Link Object

```js
{
  id: string,           // UUID v4 generated at creation time
  label: string,        // 1–50 characters, user-supplied
  url: string           // 1–2048 characters, must start with http:// or https://
}
```

### StorageModule Interface

```js
StorageModule = {
  read(key, fallback)  // JSON.parse(localStorage.getItem(key)) ?? fallback; returns fallback on parse error
  write(key, value)    // JSON.stringify → localStorage.setItem; throws StorageError on failure
  remove(key)          // localStorage.removeItem(key)
}
```

The `write` method wraps `setItem` in a `try/catch`. On `QuotaExceededError` or any other error, it throws a custom `StorageError` that widget controllers catch and surface to the user as an inline error message.

### UUID Generation

Since no third-party libraries are allowed, UUIDs are generated using the browser-native `crypto.randomUUID()` method (available in all modern browsers). This provides cryptographically secure unique IDs without any dependency.

```js
function generateId() {
  return crypto.randomUUID();
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Time format is always valid HH:MM

*For any* `Date` object with a valid local time, `GreetingController.formatTime(date)` SHALL return a string matching the pattern `HH:MM` where HH is a zero-padded hour (00–23) and MM is a zero-padded minute (00–59).

**Validates: Requirements 1.1**

---

### Property 2: Date string contains all required components

*For any* `Date` object with a valid date, `GreetingController.formatDate(date)` SHALL return a string that contains a valid English weekday name, a numeric day-of-month, an English month name, and a 4-digit year.

**Validates: Requirements 1.3**

---

### Property 3: Greeting is correct for every hour of the day

*For any* integer hour `h` in the range 0–23, `GreetingController.getGreeting(h)` SHALL return exactly:
- `"Good morning"` when `h` is in [5, 11]
- `"Good afternoon"` when `h` is in [12, 17]
- `"Good evening"` when `h` is in [18, 21]
- `"Good night"` when `h` is in [0, 4] or [22, 23]

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 4: Name over 50 characters is always rejected

*For any* string `s` where `s.length > 50`, `GreetingController.saveName(s)` SHALL return a validation error and SHALL NOT update the stored name in Local Storage.

**Validates: Requirements 2.10**

---

### Property 5: Timer format is always valid MM:SS

*For any* integer `seconds` in the range [0, 7200], `TimerController.formatTime(seconds)` SHALL return a string matching `MM:SS` where MM and SS are zero-padded integers and the total value in seconds equals the input.

**Validates: Requirements 3.3**

---

### Property 6: Custom duration in [1, 120] is accepted; outside is rejected

*For any* integer `d`, `TimerController.setDuration(d)` SHALL succeed and persist `d` to Local Storage when `1 ≤ d ≤ 120`, and SHALL return a validation error without updating storage when `d < 1` or `d > 120`.

**Validates: Requirements 3.9, 3.10**

---

### Property 7: Custom duration is reflected in timer display after init

*For any* valid duration `d` in [1, 120], after calling `TimerController.setDuration(d)` followed by `TimerController.init()`, the timer display SHALL show exactly `d * 60` seconds formatted as MM:SS.

**Validates: Requirements 3.8, 3.11**

---

### Property 8: Adding a valid task increases the task list and persists to storage

*For any* non-empty task title `t` with `t.trim().length` in [1, 255] that is not a duplicate of any existing active task, `TaskController.addTask(t)` SHALL increase `tasks.length` by exactly 1, and the task with title `t.trim()` SHALL be retrievable from Local Storage after the operation.

**Validates: Requirements 4.2, 9.2**

---

### Property 9: Whitespace-only input is always rejected for task add and link add

*For any* string `s` where `s.trim() === ""`, both `TaskController.addTask(s)` and `LinksController.addLink(s, anyUrl)` SHALL return a validation error and SHALL NOT modify their respective Local Storage collections.

**Validates: Requirements 4.3, 8.5**

---

### Property 10: Duplicate task title is always rejected on add

*For any* active task with title `t` already in the list, `TaskController.addTask(t2)` WHERE `t2.trim().toLowerCase() === t.trim().toLowerCase()` SHALL return a duplicate error and SHALL NOT increase `tasks.length`.

**Validates: Requirements 4.4**

---

### Property 11: Valid edit title persists correctly

*For any* task with id `id` in the list, and any non-empty string `v` with `v.trim().length` in [1, 100] that is not a duplicate of another active task, `TaskController.editTask(id, v)` SHALL update the task's title in Local Storage to `v.trim()`.

**Validates: Requirements 5.3**

---

### Property 12: Duplicate title on edit is always rejected

*For any* two distinct tasks A and B in the task list, `TaskController.editTask(A.id, t)` WHERE `t.trim().toLowerCase() === B.title.trim().toLowerCase()` SHALL return a duplicate error and the title of task A in Local Storage SHALL remain unchanged.

**Validates: Requirements 5.5**

---

### Property 13: Completing then uncompleting a task is a round-trip

*For any* task with id `id`, calling `TaskController.toggleComplete(id)` twice SHALL leave `task.completed` equal to its original value, and the final state in Local Storage SHALL match the original state.

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 14: Sorted task list satisfies the selected ordering criterion

*For any* array of tasks `T` and any valid sort mode `m` in `{"creation", "active-first", "completed-first"}`, the result of `TaskController.getSortedTasks(T, m)` SHALL be a permutation of `T` where all elements are ordered strictly according to the comparator for `m`:
- `"creation"`: `result[i].createdAt ≤ result[i+1].createdAt` for all i
- `"active-first"`: all incomplete tasks appear before all complete tasks
- `"completed-first"`: all complete tasks appear before all incomplete tasks

**Validates: Requirements 7.1, 7.2**

---

### Property 15: Sort preference persists across simulated page reloads

*For any* valid sort mode `m`, after calling `TaskController.setSort(m)` and reading the sort preference back from Local Storage via `StorageModule.read("ntd_sort_pref", "creation")`, the read value SHALL equal `m`.

**Validates: Requirements 7.3, 7.4**

---

### Property 16: Adding a valid link increases the link list and persists to storage

*For any* label `l` with `l.trim().length` in [1, 50] and URL `u` starting with `"http://"` or `"https://"` with `u.length ≤ 2048`, that is not a duplicate URL, and when total links count is less than 50, `LinksController.addLink(l, u)` SHALL increase `links.length` by exactly 1 and the link SHALL be retrievable from Local Storage.

**Validates: Requirements 8.3, 8.4**

---

### Property 17: URL without http/https prefix is always rejected

*For any* string `u` where `!u.startsWith("http://") && !u.startsWith("https://")`, `LinksController.isValidUrl(u)` SHALL return `false` and `LinksController.addLink(anyLabel, u)` SHALL return a validation error without modifying storage.

**Validates: Requirements 8.6**

---

### Property 18: Duplicate URL is always rejected on link add

*For any* existing link with URL `u` in the list, `LinksController.addLink(label, u2)` WHERE `u2.toLowerCase() === u.toLowerCase()` SHALL return a duplicate error and `links.length` SHALL remain unchanged.

**Validates: Requirements 8.7**

---

### Property 19: Storage read returns fallback for any corrupt or missing data

*For any* Local Storage key `k` and any non-JSON string or wrong-type value stored under `k`, `StorageModule.read(k, fallback)` SHALL return `fallback` without throwing an exception.

**Validates: Requirements 9.3**

---

### Property 20: Theme preference persists across simulated page reloads

*For any* theme `t` in `{"light", "dark"}`, after `ThemeController.toggle()` applies theme `t` and writes it to Local Storage, reading back via `StorageModule.read("ntd_theme", "")` SHALL return `t`, and `ThemeController.init()` SHALL apply theme `t` to the document.

**Validates: Requirements 10.4, 10.5**

---

## Error Handling

### Validation Errors

All user input is validated synchronously before any state mutation. Validation errors are displayed as inline messages next to the relevant input using elements with `role="alert"` for screen reader accessibility. Errors are dismissed when the user begins modifying the relevant input field.

| Scenario | Location | Message |
|---|---|---|
| Name > 50 chars | `#name-error` | "Name must be 50 characters or fewer." |
| Timer duration out of range | `#duration-error` | "Please enter a value between 1 and 120." |
| Empty task input | `#task-add-error` | "Please enter a task title." |
| Duplicate task | `#task-add-error` | "This task already exists." |
| Empty/whitespace edit | inline per task | Discarded silently, original restored |
| Duplicate task edit | inline per task | "A task with this title already exists." |
| Empty link label | `#link-error` | "Please enter a label." |
| Invalid URL | `#link-error` | "URL must start with http:// or https://" |
| Duplicate URL | `#link-error` | "This URL is already saved." |
| Link limit reached | `#link-error` | "You have reached the 50-link limit." |

### Storage Errors

`StorageModule.write()` wraps `localStorage.setItem` in a `try/catch`. On failure (e.g., `QuotaExceededError`), it throws a `StorageError`. Each controller catches this and:
1. Reverts in-memory state to its pre-action value (ensuring no partial updates)
2. Renders an inline error message such as "Could not save data. Storage may be full."

This satisfies the "write before render" ordering by never rendering the success state if the write fails.

### Timer Notification Fallback

```js
async function notifyOnComplete() {
  if (!("Notification" in window)) {
    showOnScreenAlert("Timer complete! Take a break.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    new Notification("Timer complete!", { body: "Take a break." });
  } else {
    showOnScreenAlert("Timer complete! Take a break.");
  }
}
```

### Unhandled Error Boundary

A global `window.onerror` and `window.addEventListener('unhandledrejection')` handler logs errors to the console without crashing the UI. Individual widgets are isolated enough that a failure in one does not cascade.

---

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit/example-based tests and property-based tests for comprehensive coverage.

**Unit Tests** focus on:
- Specific input/output examples for formatting functions
- State machine transitions (timer start → stop → reset)
- UI behavior examples (error messages shown, input cleared after add)
- Edge cases: empty input, 50-link boundary, quota error simulation
- Integration points: init reads storage, actions persist before render

**Property-Based Tests** focus on the 20 correctness properties listed above, verifying universal behaviors across hundreds of randomly generated inputs.

### Property-Based Testing Library

Because the app is vanilla JavaScript with no build tools, the recommended PBT library is **[fast-check](https://github.com/dubzzz/fast-check)** loaded via a CDN `<script>` tag in the test HTML file only (not in the production `index.html`). Alternatively, tests can run in a Node.js test harness (e.g., plain `node test.js`) that imports fast-check via npm — this keeps the production bundle completely dependency-free.

Each property test is configured to run a minimum of **100 iterations**.

### Property Test Tagging

Each property test is tagged with a comment in the following format:
```js
// Feature: new-tab-dashboard, Property 1: Time format is always valid HH:MM
```

### Test Coverage Map

| Requirement | Unit Tests | Property Tests |
|---|---|---|
| 1.1, 1.3 | Time/date render examples | P1, P2 |
| 2.1–2.4 | Boundary examples (4:59, 5:00, etc.) | P3 |
| 2.10 | 51-char name example | P4 |
| 3.3 | 00:00, 25:00, 120:00 examples | P5 |
| 3.8–3.11 | 1 min, 120 min, 25 min defaults | P6, P7 |
| 4.2–4.4 | Specific task add examples | P8, P9, P10 |
| 5.3, 5.5 | Specific edit examples | P11, P12 |
| 6.1–6.3 | Toggle on/off example | P13 |
| 7.2–7.4 | Sort examples with 3 tasks | P14, P15 |
| 8.3–8.8 | Valid link add, at-limit example | P16, P17, P18 |
| 9.3 | Corrupt JSON in storage | P19 |
| 10.4–10.5 | Theme toggle and reload | P20 |
| 3.7, 6.4, 6.7, 9.4 | Mock storage failure; mock Notification | Unit only |
| 10.6–10.7, 11.x | OS pref detection; smoke checks | Unit/Smoke only |
