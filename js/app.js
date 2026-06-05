/* New Tab Dashboard - js/app.js */

// =============================================================================
// StorageError — custom error for localStorage write failures
// =============================================================================

class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

// =============================================================================
// KEYS — all localStorage keys namespaced under ntd_
// =============================================================================

const KEYS = {
  NAME:           'ntd_name',
  TIMER_DURATION: 'ntd_timer_duration',
  TASKS:          'ntd_tasks',
  SORT_PREF:      'ntd_sort_pref',
  LINKS:          'ntd_links',
  THEME:          'ntd_theme',
};

// =============================================================================
// StorageModule — thin wrapper around localStorage
// =============================================================================

const StorageModule = {
  /**
   * Read a value from localStorage and parse it as JSON.
   * Returns `fallback` if the key is missing, the value is null,
   * or JSON.parse throws (corrupt data).
   *
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      // If parsed comes back as null (e.g. stored literal "null"), use fallback
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * Serialise `value` as JSON and write it to localStorage.
   * Throws `StorageError` on any failure (e.g. QuotaExceededError).
   *
   * @param {string} key
   * @param {*} value
   * @throws {StorageError}
   */
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      throw new StorageError(
        `Failed to write key "${key}" to storage: ${err.message}`
      );
    }
  },

  /**
   * Remove a key from localStorage.
   *
   * @param {string} key
   */
  remove(key) {
    localStorage.removeItem(key);
  },
};

// =============================================================================
// StateModule — runtime state for all widgets (single source of truth)
// =============================================================================

/**
 * StateModule holds the in-memory state for every widget on the dashboard.
 * It acts as the single source of truth between Local Storage and the UI.
 *
 * On page load, call `StateModule.init()` once to hydrate all fields from
 * Local Storage via `StorageModule`. If a key is missing or corrupt,
 * `StorageModule.read` returns the defined default so the app always starts
 * in a valid state.
 *
 * Satisfies Requirement 9.1 — all persisted data is loaded into memory
 * before any widget controller renders its initial view.
 */
const StateModule = {
  /** @type {string} User's display name. Default: "" */
  name: '',

  /** @type {number} Pomodoro timer duration in minutes. Default: 25 */
  timerDuration: 25,

  /** @type {Array<{id:string, title:string, completed:boolean, createdAt:number}>} Task list. Default: [] */
  tasks: [],

  /** @type {"creation"|"active-first"|"completed-first"} Task sort preference. Default: "creation" */
  sortPref: 'creation',

  /** @type {Array<{id:string, label:string, url:string}>} Quick-links list. Default: [] */
  links: [],

  /** @type {"light"|"dark"|""} Active theme. Empty string means use OS preference. Default: "" */
  theme: '',

  /**
   * Populate all fields from Local Storage.
   * Must be called once at page load before any widget controller initialises.
   */
  init() {
    this.name          = StorageModule.read(KEYS.NAME,           '');
    this.timerDuration = StorageModule.read(KEYS.TIMER_DURATION, 25);
    this.tasks         = StorageModule.read(KEYS.TASKS,          []);
    this.sortPref      = StorageModule.read(KEYS.SORT_PREF,      'creation');
    this.links         = StorageModule.read(KEYS.LINKS,          []);
    this.theme         = StorageModule.read(KEYS.THEME,          '');
  },
};

// =============================================================================
// Utility — ID generation
// =============================================================================

/**
 * Generate a cryptographically secure UUID v4.
 * Uses the browser-native crypto.randomUUID() — no polyfill needed in modern browsers.
 * @returns {string} UUID v4 string
 */
function generateId() {
  return crypto.randomUUID();
}

// =============================================================================
// ThemeController — light/dark toggle, OS preference detection, persistence
// Satisfies Requirements 10.1 – 10.7
// =============================================================================

const ThemeController = {
  /**
   * Detect the operating-system colour-scheme preference.
   * Uses window.matchMedia so it works without any stored value.
   *
   * @returns {'dark'|'light'}
   */
  getOSPref() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  },

  /**
   * Apply `mode` to the document and update the toggle button.
   *
   * Dark  → add class "dark" on <html>, icon 🌙, label "Switch to light mode"
   * Light → remove class "dark" from <html>, icon ☀️, label "Switch to dark mode"
   *
   * @param {'dark'|'light'} mode
   */
  apply(mode) {
    const html   = document.documentElement;
    const btn    = document.getElementById('theme-toggle');
    const icon   = document.getElementById('theme-icon');

    if (mode === 'dark') {
      html.classList.add('dark');
      if (icon) icon.textContent = '🌙';
      if (btn)  btn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      html.classList.remove('dark');
      if (icon) icon.textContent = '☀️';
      if (btn)  btn.setAttribute('aria-label', 'Switch to dark mode');
    }
  },

  /**
   * Read persisted theme from Local Storage.
   * Falls back to OS preference, then to 'light'.
   * Applies the resolved theme visually WITHOUT writing to storage.
   *
   * Call once at page load after StateModule.init().
   */
  init() {
    const stored = StorageModule.read(KEYS.THEME, '');
    let resolved;

    if (stored === 'light' || stored === 'dark') {
      resolved = stored;
    } else {
      resolved = this.getOSPref();
    }

    // Sync StateModule so other controllers can read the current theme
    StateModule.theme = resolved;

    this.apply(resolved);
  },

  /**
   * Flip the current theme, persist it, then update the DOM.
   *
   * Reads the current theme from StateModule (set by init/previous toggle).
   * Write to storage BEFORE calling apply(), satisfying Requirement 9.2.
   */
  toggle() {
    const current  = StateModule.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const newTheme = current === 'dark' ? 'light' : 'dark';

    // Update runtime state
    StateModule.theme = newTheme;

    // Persist first, then update DOM (Requirement 9.2)
    StorageModule.write(KEYS.THEME, newTheme);

    this.apply(newTheme);
  },
};

// ============= GreetingController Helpers =============

/**
 * Format a Date object as a zero-padded HH:MM string.
 * Pure function — has no side effects.
 *
 * @param {Date} date
 * @returns {string} e.g. "09:05"
 */
function formatTime(date) {
  const hours   = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a Date object as a long-form date string.
 * Uses the en-GB locale which naturally produces "Weekday, D Month YYYY".
 * Pure function — has no side effects.
 *
 * @param {Date} date
 * @returns {string} e.g. "Monday, 2 June 2025"
 */
function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

/**
 * Return the appropriate greeting for the given hour of the day.
 * Pure function — has no side effects.
 *
 * Hour ranges (24-hour clock):
 *   05–11  → "Good morning"
 *   12–17  → "Good afternoon"
 *   18–21  → "Good evening"
 *   00–04, 22–23 → "Good night"
 *
 * @param {number} hour  Integer in the range 0–23.
 * @returns {string}
 */
function getGreeting(hour) {
  if (hour >= 5 && hour <= 11) return 'Good morning';
  if (hour >= 12 && hour <= 17) return 'Good afternoon';
  if (hour >= 18 && hour <= 21) return 'Good evening';
  return 'Good night';
}

// ============= TimerController Helpers =============

/**
 * Convert a total number of seconds into a zero-padded MM:SS string.
 * Handles the full range 0–7200 (00:00 through 120:00).
 *
 * @param {number} secs - Total seconds (integer, 0–7200)
 * @returns {string} e.g. "05:03", "120:00"
 * Satisfies Requirement 3.3
 */
function formatTimerSeconds(secs) {
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

// =============================================================================
// GreetingController — clock, date, greeting, name persistence
// Satisfies Requirements 1.2, 1.4, 1.5, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10
// =============================================================================

const GreetingController = {
  _intervalId: null,

  /**
   * Initialise the greeting widget.
   * - StateModule.init() has already hydrated StateModule.name from storage.
   * - Renders immediately via tick(), then starts a 1-second setInterval.
   * - Attaches an input listener on #name-input to dismiss #name-error.
   */
  init() {
    // Render immediately so the clock is visible before the first second elapses
    this.tick();

    // Start the 1-second clock interval
    this._intervalId = setInterval(() => this.tick(), 1000);

    // Dismiss name error whenever the user starts typing (Req 2.6)
    const nameInput = document.getElementById('name-input');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        const err = document.getElementById('name-error');
        if (err) err.textContent = '';
      });
    }
  },

  /**
   * Called every second by the interval.
   * Updates #clock, #date-display, and #greeting-text.
   * Displays "--:--" if the Date is somehow invalid (Req 1.4).
   */
  tick() {
    const now = new Date();
    const valid = !isNaN(now.getTime());

    const timeStr = valid ? formatTime(now)  : '--:--';
    const dateStr = valid ? formatDate(now)  : '';
    const hour    = valid ? now.getHours()   : 0;

    const clockEl  = document.getElementById('clock');
    const dateEl   = document.getElementById('date-display');
    const greetEl  = document.getElementById('greeting-text');

    if (clockEl)  clockEl.textContent = timeStr;
    if (dateEl)   dateEl.textContent  = dateStr;

    if (greetEl) {
      const base = getGreeting(hour);
      const name = StateModule.name ? StateModule.name.trim() : '';
      greetEl.textContent = name ? `${base}, ${name}` : base;
    }
  },

  /**
   * Validate, persist, and display the user's chosen display name.
   *
   * Rules:
   *   - raw.trim().length > 50  → show #name-error, abort (Req 2.10)
   *   - whitespace-only + no saved name → display without name (Req 2.9)
   *   - whitespace-only + name already saved → retain previous (Req 2.8)
   *   - valid name → persist trimmed value, update greeting immediately
   *
   * @param {string} raw  Raw value from #name-input.
   */
  saveName(raw) {
    const trimmed = raw.trim();
    const errEl   = document.getElementById('name-error');

    // Reject names that are too long (Req 2.10)
    if (trimmed.length > 50) {
      if (errEl) errEl.textContent = 'Name must be 50 characters or fewer.';
      return;
    }

    // Clear any previous error
    if (errEl) errEl.textContent = '';

    // If whitespace-only input:
    //   - if a name is already stored, keep it (Req 2.8)
    //   - if nothing was stored, store empty string / display without name (Req 2.9)
    // In both cases we just persist `trimmed` (which is "") and update.
    // The existing StateModule.name is preserved if trimmed is "" — see below.
    if (trimmed === '' && StateModule.name) {
      // Retain previous name — nothing to update
      return;
    }

    // Persist to StateModule and localStorage
    StateModule.name = trimmed;
    StorageModule.write(KEYS.NAME, trimmed);

    // Update the greeting immediately (within 100 ms — synchronous) (Req 2.5)
    this.tick();
  },
};

// =============================================================================
// TimerController — Pomodoro countdown timer
// Satisfies Requirements 3.1 – 3.12
// =============================================================================

const TimerController = {
  _intervalId: null,
  _state: 'IDLE',     // 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE'
  _remaining: 0,      // remaining seconds

  // Helper: update the #timer-display element and state label
  _render() {
    const el    = document.getElementById('timer-display');
    const label = document.getElementById('timer-state-label');
    if (el) el.textContent = formatTimerSeconds(this._remaining);

    // Update visual state classes and label
    if (el) {
      el.classList.remove('running', 'complete');
      if (this._state === 'RUNNING')  el.classList.add('running');
      if (this._state === 'COMPLETE') el.classList.add('complete');
    }
    if (label) {
      const map = { IDLE: 'Ready', RUNNING: 'Running…', PAUSED: 'Paused', COMPLETE: 'Done!' };
      label.textContent = map[this._state] || 'Ready';
    }
  },

  // On-screen alert fallback for when notifications are unavailable
  _showAlert(message) {
    // Remove any existing alert first to avoid duplicates
    const existing = document.getElementById('timer-alert');
    if (existing) existing.remove();

    const alertEl = document.createElement('div');
    alertEl.id = 'timer-alert';
    alertEl.setAttribute('role', 'alert');
    alertEl.textContent = message;
    alertEl.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px',
      'background:var(--primary,#2563eb)', 'color:#fff',
      'padding:12px 20px', 'border-radius:8px',
      'font-size:1rem', 'z-index:9999',
      'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
    ].join(';');
    document.body.appendChild(alertEl);
    setTimeout(() => alertEl.remove(), 5000);
  },

  /**
   * Called when the countdown reaches zero.
   * Transitions to COMPLETE, requests notification permission if available,
   * falls back to an on-screen alert if denied or API is unavailable.
   * Satisfies Requirements 3.7, 3.12
   */
  async onComplete() {
    this._state = 'COMPLETE';
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._remaining = 0;
    this._render();

    const msg = 'Timer complete! Time for a break.';

    if (!('Notification' in window)) {
      // Notification API unavailable (Req 3.12 fallback)
      this._showAlert(msg);
      return;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      // Request permission (Req 3.7)
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      // Req 3.7: show browser notification
      new Notification('⏰ Timer complete!', { body: 'Time for a break.' });
    } else {
      // Req 3.12: permission denied/dismissed → on-screen alert
      this._showAlert(msg);
    }
  },

  /**
   * Decrement remaining time by one second and re-render.
   * Calls onComplete() when remaining reaches 0.
   * Satisfies Requirements 3.5, 3.6
   */
  tick() {
    if (this._remaining <= 0) {
      this.onComplete();
      return;
    }
    this._remaining -= 1;
    this._render();
    if (this._remaining === 0) {
      this.onComplete();
    }
  },

  /**
   * Initialise the timer widget.
   * Loads persisted duration from StateModule (already hydrated by StateModule.init()),
   * sets remaining to duration * 60, renders the display, and attaches the
   * input listener that clears the #duration-error on change.
   * Satisfies Requirements 3.1, 3.2, 3.8
   */
  init() {
    this._remaining = StateModule.timerDuration * 60;
    this._state = 'IDLE';
    this._intervalId = null;
    this._render();

    // Dismiss duration error on input change (UX, pairs with Req 3.9/3.10 validation)
    const durationInput = document.getElementById('duration-input');
    if (durationInput) {
      durationInput.addEventListener('input', () => {
        const err = document.getElementById('duration-error');
        if (err) err.textContent = '';
      });
    }
  },

  /**
   * Begin or resume the countdown.
   * Guard: does nothing if already RUNNING or COMPLETE.
   * Satisfies Requirements 3.1, 3.2
   */
  start() {
    // Guard against double-start (Req 3.2)
    if (this._state === 'RUNNING') return;
    // Do not restart a completed timer without an explicit reset
    if (this._state === 'COMPLETE') return;

    this._state = 'RUNNING';
    this._intervalId = setInterval(() => this.tick(), 1000);
  },

  /**
   * Pause the countdown; retain the remaining time.
   * Transitions RUNNING → PAUSED.
   * Satisfies Requirement 3.4
   */
  stop() {
    if (this._state !== 'RUNNING') return;
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._state = 'PAUSED';
    // _remaining intentionally kept (Req 3.4)
  },

  /**
   * Cancel any running interval and restore the timer to the configured
   * duration, regardless of current state.
   * Transitions any state → IDLE.
   * Satisfies Requirement 3.5
   */
  reset() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._state = 'IDLE';
    // Restore to the currently configured duration
    this._remaining = StateModule.timerDuration * 60;
    this._render();
  },

  /**
   * Validate and persist a new countdown duration.
   * Accepts integers in [1, 120] inclusive; rejects anything outside that
   * range with an inline error in #duration-error.
   * On success, persists to storage and resets the display.
   * Satisfies Requirements 3.9, 3.10, 3.11
   *
   * @param {number|string} mins  The candidate duration in minutes.
   */
  setDuration(mins) {
    const errEl = document.getElementById('duration-error');
    const num   = Number(mins);

    // Validate: must be an integer in [1, 120] (Req 3.9, 3.10)
    if (!Number.isInteger(num) || num < 1 || num > 120) {
      if (errEl) errEl.textContent = 'Please enter a value between 1 and 120.';
      return;
    }

    // Clear any previous error
    if (errEl) errEl.textContent = '';

    // Persist BEFORE updating UI (Req 9.2)
    StateModule.timerDuration = num;
    StorageModule.write(KEYS.TIMER_DURATION, num);

    // Reset display to reflect new duration (Req 3.11)
    this.reset();
  },
};

// =============================================================================
// TaskController — To-Do List (add, edit, delete, complete, sort)
// Satisfies Requirements 4.1 – 4.6, 5.1 – 5.6, 6.1 – 6.7, 7.1 – 7.5
// =============================================================================

const TaskController = {
  // Check for duplicate task title (case-insensitive, trimmed)
  // excludeId is optional — used when editing to exclude the task being edited
  isDuplicate(title, excludeId = null) {
    const normalized = title.trim().toLowerCase();
    return StateModule.tasks.some(t =>
      t.id !== excludeId && t.title.trim().toLowerCase() === normalized
    );
  },

  // Return a sorted copy of StateModule.tasks based on StateModule.sortPref
  getSortedTasks() {
    const tasks = [...StateModule.tasks];
    const mode  = StateModule.sortPref;

    if (mode === 'active-first') {
      return tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.createdAt - b.createdAt;
      });
    }
    if (mode === 'completed-first') {
      return tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? -1 : 1;
        return a.createdAt - b.createdAt;
      });
    }
    // Default: creation order (oldest first)
    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  },

  // Rebuild the #task-list DOM from StateModule.tasks
  renderTasks() {
    const ul = document.getElementById('task-list');
    if (!ul) return;
    ul.innerHTML = '';

    // Update badge count
    const badge = document.getElementById('task-count');
    if (badge) badge.textContent = StateModule.tasks.filter(t => !t.completed).length;

    // Toggle empty state
    const empty = document.getElementById('task-empty');
    if (empty) empty.classList.toggle('hidden', StateModule.tasks.length > 0);

    const sorted = this.getSortedTasks();
    sorted.forEach(task => {
      const li = document.createElement('li');
      li.dataset.id = task.id;
      li.className = 'task-item' + (task.completed ? ' completed' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-check';
      checkbox.checked = task.completed;
      checkbox.addEventListener('change', () => this.toggleComplete(task.id));

      const titleSpan = document.createElement('span');
      titleSpan.className = 'task-title';
      titleSpan.textContent = task.title;

      const editBtn = document.createElement('button');
      editBtn.className = 'task-edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this._enterEditMode(li, task));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

      li.append(checkbox, titleSpan, editBtn, deleteBtn);
      ul.appendChild(li);
    });
  },

  // Enter inline edit mode for a task item
  _enterEditMode(li, task) {
    // Replace title span + edit btn with edit input + confirm + cancel + error
    const titleSpan = li.querySelector('.task-title');
    const editBtn   = li.querySelector('.task-edit-btn');

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.maxLength = 100;
    editInput.value = task.title;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'task-edit-confirm';
    confirmBtn.textContent = '✓';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'task-edit-cancel';
    cancelBtn.textContent = '✕';

    const editError = document.createElement('span');
    editError.className = 'task-edit-error';
    editError.setAttribute('role', 'alert');

    titleSpan.replaceWith(editInput);
    editBtn.replaceWith(confirmBtn, cancelBtn, editError);

    editInput.focus();

    const confirm = () => this.editTask(task.id, editInput.value, li);
    const cancel  = () => this.renderTasks();

    confirmBtn.addEventListener('click', confirm);
    cancelBtn.addEventListener('click', cancel);
    editInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') cancel();
    });
  },

  addTask(title) {
    const trimmed = title.trim();
    const errEl   = document.getElementById('task-add-error');

    // Reject empty/whitespace (Req 4.3)
    if (!trimmed) {
      if (errEl) errEl.textContent = 'Please enter a task title.';
      return;
    }

    // Reject duplicates (Req 4.4)
    if (this.isDuplicate(trimmed)) {
      if (errEl) errEl.textContent = 'This task already exists.';
      return;
    }

    // Clear error
    if (errEl) errEl.textContent = '';

    // Create task object
    const task = {
      id:        generateId(),
      title:     trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    // Write to storage BEFORE updating UI (Req 9.2)
    StateModule.tasks.push(task);
    StorageModule.write(KEYS.TASKS, StateModule.tasks);

    // Clear input (Req 4.5) and re-render
    const input = document.getElementById('task-input');
    if (input) input.value = '';

    this.renderTasks();
  },

  editTask(id, newTitle, li) {
    const trimmed = newTitle.trim();

    // Silent discard on empty/whitespace (Req 5.4)
    if (!trimmed) {
      this.renderTasks();
      return;
    }

    // Reject duplicate (Req 5.5)
    if (this.isDuplicate(trimmed, id)) {
      // Show inline error in the edit row
      const editError = li ? li.querySelector('.task-edit-error') : null;
      if (editError) editError.textContent = 'A task with this title already exists.';
      return;
    }

    const task = StateModule.tasks.find(t => t.id === id);
    if (!task) return;

    task.title = trimmed;
    StorageModule.write(KEYS.TASKS, StateModule.tasks);
    this.renderTasks();
  },

  deleteTask(id) {
    const idx = StateModule.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    // Snapshot for revert on failure
    const removed = StateModule.tasks.splice(idx, 1)[0];

    try {
      StorageModule.write(KEYS.TASKS, StateModule.tasks);
    } catch (err) {
      // Revert (Req 6.7)
      StateModule.tasks.splice(idx, 0, removed);
      this._showListError('Could not save data. Storage may be full.');
      return;
    }
    this.renderTasks();
  },

  toggleComplete(id) {
    const task = StateModule.tasks.find(t => t.id === id);
    if (!task) return;

    const prev = task.completed;
    task.completed = !prev;

    try {
      StorageModule.write(KEYS.TASKS, StateModule.tasks);
    } catch (err) {
      // Revert (Req 6.4)
      task.completed = prev;
      this._showListError('Could not save data. Storage may be full.');
      return;
    }
    this.renderTasks();
  },

  setSort(mode) {
    StateModule.sortPref = mode;
    StorageModule.write(KEYS.SORT_PREF, mode);
    this.renderTasks();
  },

  _showListError(msg) {
    const errEl = document.getElementById('task-add-error');
    if (errEl) errEl.textContent = msg;
  },

  init() {
    // StateModule already has tasks and sortPref from StateModule.init()
    // Set the sort select to the persisted value
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) sortSelect.value = StateModule.sortPref;

    // Dismiss add error on input
    const taskInput = document.getElementById('task-input');
    if (taskInput) {
      taskInput.addEventListener('input', () => {
        const err = document.getElementById('task-add-error');
        if (err) err.textContent = '';
      });
    }

    this.renderTasks();
  },
};

// =============================================================================
// LinksController — Quick Links CRUD
// Satisfies Requirements 8.1 – 8.10
// =============================================================================

const LinksController = {
  /**
   * Pure function: validate that a URL starts with http:// or https://
   * @param {string} url
   * @returns {boolean}
   */
  isValidUrl(url) {
    return url.startsWith('http://') || url.startsWith('https://');
  },

  /**
   * Pure function: check if a URL duplicates an existing saved link (case-insensitive)
   * @param {string} url
   * @returns {boolean}
   */
  isDuplicateUrl(url) {
    const lower = url.toLowerCase();
    return StateModule.links.some(l => l.url.toLowerCase() === lower);
  },

  /**
   * Rebuild the #links-grid DOM from StateModule.links
   */
  renderLinks() {
    const grid = document.getElementById('links-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Update badge count
    const badge = document.getElementById('links-count');
    if (badge) badge.textContent = StateModule.links.length;

    // Toggle empty state
    const empty = document.getElementById('links-empty');
    if (empty) empty.classList.toggle('hidden', StateModule.links.length > 0);

    StateModule.links.forEach(link => {
      const item = document.createElement('div');
      item.className = 'link-item';

      const anchor = document.createElement('a');
      anchor.className = 'link-btn';
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = link.label;

      const delBtn = document.createElement('button');
      delBtn.className = 'link-delete-btn';
      delBtn.setAttribute('aria-label', `Delete ${link.label}`);
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => this.deleteLink(link.id));

      item.append(anchor, delBtn);
      grid.appendChild(item);
    });
  },

  /**
   * Add a new link with full validation.
   * @param {string} label
   * @param {string} url
   */
  addLink(label, url) {
    const trimmedLabel = label.trim();
    const errEl        = document.getElementById('link-error');

    // Reject empty/whitespace label (Req 8.5)
    if (!trimmedLabel) {
      if (errEl) errEl.textContent = 'Please enter a label.';
      return;
    }

    // Reject invalid URL (Req 8.6)
    if (!this.isValidUrl(url)) {
      if (errEl) errEl.textContent = 'URL must start with http:// or https://';
      return;
    }

    // Reject duplicate URL (Req 8.7)
    if (this.isDuplicateUrl(url)) {
      if (errEl) errEl.textContent = 'This URL is already saved.';
      return;
    }

    // Enforce 50-link limit (Req 8.8)
    if (StateModule.links.length >= 50) {
      if (errEl) errEl.textContent = 'You have reached the 50-link limit.';
      return;
    }

    // Clear error
    if (errEl) errEl.textContent = '';

    const link = {
      id:    generateId(),
      label: trimmedLabel,
      url:   url,
    };

    // Write before render (Req 9.2)
    StateModule.links.push(link);
    StorageModule.write(KEYS.LINKS, StateModule.links);

    // Clear inputs
    const labelInput = document.getElementById('link-label-input');
    const urlInput   = document.getElementById('link-url-input');
    if (labelInput) labelInput.value = '';
    if (urlInput)   urlInput.value   = '';

    this.renderLinks();
  },

  /**
   * Delete a link by ID.
   * @param {string} id
   */
  deleteLink(id) {
    StateModule.links = StateModule.links.filter(l => l.id !== id);
    StorageModule.write(KEYS.LINKS, StateModule.links);
    this.renderLinks();
  },

  /**
   * Initialise: load links from StateModule and render.
   */
  init() {
    this.renderLinks();
  },
};

// =============================================================================
// Bootstrap — wire everything together on DOMContentLoaded
// Satisfies Requirements 9.1, 9.2, 11.4
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {

  // 1. Hydrate state from localStorage FIRST (Req 9.1)
  StateModule.init();

  // 2. Apply theme immediately to prevent flash of wrong theme (Req 10.5)
  ThemeController.init();

  // 3. Init all widget controllers
  GreetingController.init();
  TimerController.init();
  TaskController.init();
  LinksController.init();

  // 4. Global error boundary — prevent one widget crash from killing the whole app
  window.addEventListener('error', (e) => {
    console.error('[NTD] Unhandled error:', e.message, e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[NTD] Unhandled promise rejection:', e.reason);
  });

  // -------------------------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------------------------

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => ThemeController.toggle());
  }

  // Greeting — save name on button click or Enter
  const nameSaveBtn = document.getElementById('name-save-btn');
  const nameInput   = document.getElementById('name-input');
  if (nameSaveBtn) {
    nameSaveBtn.addEventListener('click', () => {
      GreetingController.saveName(nameInput ? nameInput.value : '');
    });
  }
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') GreetingController.saveName(nameInput.value);
    });
  }

  // Timer — Start / Stop / Reset buttons
  const timerStartBtn = document.getElementById('timer-start');
  const timerStopBtn  = document.getElementById('timer-stop');
  const timerResetBtn = document.getElementById('timer-reset');
  if (timerStartBtn) timerStartBtn.addEventListener('click', () => TimerController.start());
  if (timerStopBtn)  timerStopBtn.addEventListener('click',  () => TimerController.stop());
  if (timerResetBtn) timerResetBtn.addEventListener('click', () => TimerController.reset());

  // Timer — Set custom duration on button click or Enter
  const durationSaveBtn = document.getElementById('duration-save-btn');
  const durationInput   = document.getElementById('duration-input');
  if (durationSaveBtn) {
    durationSaveBtn.addEventListener('click', () => {
      TimerController.setDuration(durationInput ? durationInput.value : '');
    });
  }
  if (durationInput) {
    durationInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') TimerController.setDuration(durationInput.value);
    });
    // Show inline error on invalid input while typing (Req 3.10)
    durationInput.addEventListener('input', () => {
      const val = Number(durationInput.value);
      const errEl = document.getElementById('duration-error');
      if (durationInput.value !== '' && (!Number.isInteger(val) || val < 1 || val > 120)) {
        if (errEl) errEl.textContent = 'Please enter a value between 1 and 120.';
      } else {
        if (errEl) errEl.textContent = '';
      }
    });
  }

  // Task — Add on button click or Enter
  const taskAddBtn = document.getElementById('task-add-btn');
  const taskInput  = document.getElementById('task-input');
  if (taskAddBtn) {
    taskAddBtn.addEventListener('click', () => {
      TaskController.addTask(taskInput ? taskInput.value : '');
    });
  }
  if (taskInput) {
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') TaskController.addTask(taskInput.value);
    });
  }

  // Task — Sort select change
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => TaskController.setSort(sortSelect.value));
  }

  // Links — Add on button click or Enter on URL field
  const linkAddBtn    = document.getElementById('link-add-btn');
  const linkLabelInput = document.getElementById('link-label-input');
  const linkUrlInput   = document.getElementById('link-url-input');

  function submitLink() {
    LinksController.addLink(
      linkLabelInput ? linkLabelInput.value : '',
      linkUrlInput   ? linkUrlInput.value   : ''
    );
  }

  if (linkAddBtn) {
    linkAddBtn.addEventListener('click', submitLink);
  }
  if (linkUrlInput) {
    linkUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitLink();
    });
  }
  if (linkLabelInput) {
    linkLabelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitLink();
    });
  }

  // Dismiss link error on input change
  const linkError = document.getElementById('link-error');
  if (linkLabelInput && linkError) {
    linkLabelInput.addEventListener('input', () => { linkError.textContent = ''; });
  }
  if (linkUrlInput && linkError) {
    linkUrlInput.addEventListener('input', () => { linkError.textContent = ''; });
  }

});
