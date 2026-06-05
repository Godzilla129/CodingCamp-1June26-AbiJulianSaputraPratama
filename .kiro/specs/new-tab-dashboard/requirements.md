# Requirements Document

## Introduction

The New Tab Dashboard is a client-side web application that replaces the browser's default new tab page (or runs as a standalone web app). It provides users with a productivity-focused interface featuring a time-based greeting, a Pomodoro focus timer, a to-do list, and quick-access links — all persisted locally using the Browser Local Storage API. The app is built with plain HTML, CSS, and vanilla JavaScript, requiring no backend or build tools.

---

## Glossary

- **App**: The New Tab Dashboard application as a whole.
- **Dashboard**: The single-page interface displayed to the user.
- **Greeting_Widget**: The UI section that shows the current time, date, and a personalized greeting.
- **Timer**: The Pomodoro Focus Timer widget.
- **Task_Manager**: The To-Do List widget responsible for managing tasks.
- **Task**: A single to-do item with a title, completion status, and creation timestamp.
- **Quick_Links**: The widget that displays user-saved shortcut buttons to external URLs.
- **Link**: A single quick-link item with a label and a URL.
- **Theme_Controller**: The component responsible for applying and persisting the light/dark mode preference.
- **Local_Storage**: The Browser Local Storage API used to persist all user data client-side.
- **Session**: A single Timer countdown from start to completion or reset.
- **Duplicate_Task**: A task whose title, after trimming leading/trailing whitespace and ignoring case, is identical to an existing active task.

---

## Requirements

### Requirement 1: Display Current Time and Date

**User Story:** As a user, I want to see the current time and date when I open a new tab, so that I stay aware of the time without switching apps.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current local time in 24-hour HH:MM format on page load.
2. WHEN the system clock advances by one second, THE Greeting_Widget SHALL update the displayed time to reflect the new value.
3. THE Greeting_Widget SHALL display the current local date including the day of the week, day number, month, and year (e.g., "Monday, 2 June 2025").
4. WHILE the Dashboard is open, THE Greeting_Widget SHALL refresh the displayed time at one-second intervals without requiring a page reload.
5. IF the browser cannot determine the local time, THEN THE Greeting_Widget SHALL display "--:--" in place of the time and omit the date.

---

### Requirement 2: Time-Based Greeting with Custom Name

**User Story:** As a user, I want to see a greeting that reflects the time of day and uses my name, so that the dashboard feels personalized.

#### Acceptance Criteria

1. WHEN the local time is between 05:00 and 11:59, THE Greeting_Widget SHALL display "Good morning".
2. WHEN the local time is between 12:00 and 17:59, THE Greeting_Widget SHALL display "Good afternoon".
3. WHEN the local time is between 18:00 and 21:59, THE Greeting_Widget SHALL display "Good evening".
4. WHEN the local time is between 22:00 and 04:59, THE Greeting_Widget SHALL display "Good night".
5. WHERE a custom name has been saved by the user, THE Greeting_Widget SHALL append the name to the greeting (e.g., "Good morning, Abi").
6. WHEN the user submits a new name via the name input field, THE App SHALL save the name to Local_Storage.
7. WHEN the name is saved to Local_Storage, THE Greeting_Widget SHALL reflect the updated name within 100 milliseconds.
8. IF the name input field is submitted with only whitespace and a name is already saved, THEN THE App SHALL discard the input and retain the previously saved name.
9. IF the name input field is submitted with only whitespace and no name is saved, THEN THE Greeting_Widget SHALL display the greeting without a name suffix.
10. IF the submitted name exceeds 50 characters, THEN THE App SHALL reject the input, display an inline validation message, and not update the stored name.

---

### Requirement 3: Pomodoro Focus Timer

**User Story:** As a user, I want a Pomodoro-style countdown timer, so that I can manage focused work sessions.

#### Acceptance Criteria

1. THE Timer SHALL initialize with a default duration of 25 minutes (1500 seconds).
2. WHEN the user clicks the Start button, THE Timer SHALL begin counting down in one-second intervals.
3. WHILE a Session is running, THE Timer SHALL display the remaining time in MM:SS format.
4. WHEN the user clicks the Stop button, THE Timer SHALL pause the countdown and retain the remaining time.
5. WHEN the user clicks the Reset button, THE Timer SHALL stop the countdown and restore the display to the configured duration.
6. WHEN the countdown reaches 00:00, THE Timer SHALL stop automatically.
7. WHEN the countdown reaches 00:00, THE App SHALL first attempt to notify the user via a browser notification; IF notification permission is denied or unavailable, THEN THE App SHALL display an on-screen alert instead.
8. WHERE the user has configured a custom duration, THE Timer SHALL initialize using that custom duration instead of the default.
9. WHEN the user sets a custom duration, THE App SHALL accept values between 1 minute and 120 minutes inclusive.
10. IF the user enters a duration outside the range of 1 to 120 minutes, THEN THE App SHALL display an inline validation message on input change and on submit attempt, and reject the input.
11. WHEN a custom duration is saved, THE App SHALL persist it to Local_Storage so it is restored on subsequent page loads.
12. WHEN the user clicks the Start button while the Timer is paused (after Stop), THE Timer SHALL resume counting down from the retained remaining time.

---

### Requirement 4: To-Do List — Adding Tasks

**User Story:** As a user, I want to add tasks to a to-do list, so that I can track what I need to accomplish.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide an input field and an Add button for entering new tasks.
2. WHEN the user submits a non-empty task title of 255 characters or fewer, THE Task_Manager SHALL add the task to the list and persist it to Local_Storage, verifiable across page reloads.
3. IF the task input field is empty or contains only whitespace, THEN THE Task_Manager SHALL not add a task and SHALL display an inline validation message.
4. IF the submitted task title matches a Duplicate_Task (case-insensitive, trimmed), THEN THE Task_Manager SHALL not add the task and SHALL display an inline message informing the user the task already exists.
5. WHEN a task is added, THE Task_Manager SHALL clear the input field.
6. WHEN the user modifies the input field after a validation message is shown, THE Task_Manager SHALL dismiss the validation message.

---

### Requirement 5: To-Do List — Editing Tasks

**User Story:** As a user, I want to edit existing task titles, so that I can correct or update them without deleting and re-adding.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide an Edit action for each task.
2. WHEN the user activates the Edit action on a task, THE Task_Manager SHALL replace the task title with an editable input field pre-filled with the current title.
3. WHEN the user confirms the edit (by pressing Enter or clicking a confirm button) with a non-empty, trimmed value of 100 characters or fewer, THE Task_Manager SHALL update the task title and persist the change to Local_Storage.
4. IF the confirmed edit value is empty or contains only whitespace, THEN THE Task_Manager SHALL discard the edit and restore the original task title.
5. IF the confirmed edit value matches a Duplicate_Task (case-insensitive, trimmed, other than the task being edited), THEN THE Task_Manager SHALL discard the edit and display an inline message informing the user.
6. WHEN the user cancels the edit (by pressing Escape or clicking a cancel button), THE Task_Manager SHALL discard any changes and restore the original task title display.

---

### Requirement 6: To-Do List — Completing and Deleting Tasks

**User Story:** As a user, I want to mark tasks as done and delete them, so that I can maintain a clean and accurate task list.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a checkbox or toggle for each task to mark it as complete or incomplete.
2. WHEN the user marks a task as complete, THE Task_Manager SHALL apply a strikethrough on the task text and a muted color/reduced opacity on the item to indicate completion, and persist the updated status to Local_Storage.
3. WHEN the user marks a completed task as incomplete, THE Task_Manager SHALL remove the strikethrough and muted styling, and persist the updated status to Local_Storage.
4. IF Local_Storage write fails on a completion toggle, THEN THE Task_Manager SHALL revert the toggle to its prior state and display an inline error message.
5. THE Task_Manager SHALL provide a Delete action for each task.
6. WHEN the user activates the Delete action, THE Task_Manager SHALL immediately remove the task from the list and from Local_Storage without a confirmation step.
7. IF Local_Storage write fails on delete, THEN THE Task_Manager SHALL retain the task in the list and display an inline error message.

---

### Requirement 7: To-Do List — Sorting Tasks

**User Story:** As a user, I want to sort my task list, so that I can organize tasks in a way that helps my workflow.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a sort control with exactly the following options: default order (by creation time, oldest first), active tasks first (incomplete before complete), and completed tasks first.
2. WHEN the user selects a sort option, THE Task_Manager SHALL reorder the displayed task list within 100 milliseconds.
3. THE Task_Manager SHALL persist the selected sort preference to Local_Storage when a sort option is selected.
4. WHEN the page loads, THE Task_Manager SHALL restore the previously saved sort preference from Local_Storage and apply it before rendering tasks.
5. IF no sort preference is found in Local_Storage or the stored value is unrecognized, THEN THE Task_Manager SHALL default to the default order (by creation time, oldest first).

---

### Requirement 8: Quick Links — Managing Links

**User Story:** As a user, I want to save and access my favorite websites as quick-link buttons, so that I can navigate to them with a single click.

#### Acceptance Criteria

1. THE Quick_Links widget SHALL display each saved Link as a clickable button showing the Link label.
2. WHEN the user clicks a Link button, THE App SHALL open the corresponding URL in a new browser tab.
3. THE Quick_Links widget SHALL provide an Add Link form with fields for a label (max 50 characters) and a URL (max 2048 characters).
4. WHEN the user submits a valid label and a valid URL, THE Quick_Links widget SHALL add the Link and persist it to Local_Storage.
5. IF the label field is empty or contains only whitespace, THEN THE Quick_Links widget SHALL display an inline validation message and not add the Link.
6. IF the URL field does not begin with "http://" or "https://", THEN THE Quick_Links widget SHALL display an inline validation message and not add the Link.
7. IF the submitted URL matches an existing saved Link URL (case-insensitive), THEN THE Quick_Links widget SHALL display an inline duplicate message and not add the Link.
8. IF the total number of saved Links has reached 50, THEN THE Quick_Links widget SHALL display an inline message indicating the limit and not add the Link.
9. THE Quick_Links widget SHALL provide a Delete action for each Link.
10. WHEN the user activates the Delete action on a Link, THE Quick_Links widget SHALL remove it from the display and from Local_Storage.

---

### Requirement 9: Data Persistence via Local Storage

**User Story:** As a user, I want my tasks, links, timer settings, and preferences saved automatically, so that my data is available every time I open a new tab.

#### Acceptance Criteria

1. THE App SHALL read all persisted data from Local_Storage on page load before rendering any widgets.
2. WHEN any user data changes (task added, edited, deleted, completed; link added or deleted; timer duration updated; name saved; theme changed; sort preference changed), THE App SHALL write the updated state to Local_Storage; the write SHALL complete before the triggering change is reflected in the UI.
3. IF Local_Storage data for a given key is absent or contains a value that cannot be parsed into the expected type, THEN THE App SHALL fall back to the defined default value for that widget's key and not throw an unhandled error.
4. IF a Local_Storage write operation fails (e.g., storage quota exceeded), THEN THE App SHALL display an inline error message indicating data could not be saved, and shall not silently lose data.

---

### Requirement 10: Light / Dark Mode Toggle

**User Story:** As a user, I want to switch between light and dark mode, so that I can use the dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a visible Theme_Controller toggle with a minimum touch/click target size of 24×24 CSS pixels.
2. WHEN the user activates the Theme_Controller, THE App SHALL switch the visual theme — including background colors, text colors, and widget surface colors — between light mode and dark mode.
3. THE Theme_Controller toggle SHALL visually reflect the currently active theme (e.g., showing a sun icon for light mode and a moon icon for dark mode).
4. WHEN the user activates the Theme_Controller, THE App SHALL persist the selected theme to Local_Storage before the visual update is applied.
5. WHEN the page loads, THE App SHALL restore the saved theme from Local_Storage and apply it before rendering any content.
6. IF no theme preference is stored in Local_Storage, THEN THE App SHALL apply the user's OS-level color scheme preference using the `prefers-color-scheme` media query as the default.
7. IF neither a stored preference nor a detectable OS preference is available, THEN THE App SHALL default to light mode.

---

### Requirement 11: File and Code Structure

**User Story:** As a developer, I want the project files organized clearly, so that the codebase is easy to navigate and maintain.

#### Acceptance Criteria

1. THE App SHALL be structured with exactly one HTML file at the project root (`index.html`).
2. THE App SHALL contain exactly one CSS file located at `css/style.css`.
3. THE App SHALL contain exactly one JavaScript file located at `js/app.js`.
4. THE App SHALL render all UI elements and execute all features without errors in the latest stable release of Chrome, Firefox, Edge, and Safari, without requiring a build step, compilation, or backend server.
5. THE App SHALL not depend on any third-party library, whether loaded via CDN, bundled, or otherwise included; all logic and styling SHALL be implemented using vanilla JavaScript and plain CSS.
