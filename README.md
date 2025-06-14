# ResourceScheduler.js

A powerful and flexible resource scheduling component built with vanilla JavaScript. It features a modern, interactive timeline for managing tasks and resources, with a clean separation of data and logic.

## Features

*   **Interactive Timeline**: Drag-and-drop tasks to move or reassign them. Resize tasks by dragging their edges.
*   **Dynamic Zooming**: Zoom in and out of the timeline to view by day, week, or month.
*   **Infinite Scroll**: Smoothly scroll forward and backward in time, with days being loaded on demand to maintain performance.
*   **Customizable Theming**: Easily configure task colors based on their type, with support for both solid colors and gradients.
*   **Event-Driven API**: A rich event system allows for easy integration with any backend or frontend framework.
*   **Built-in Modal**: Optional built-in modal for creating and editing tasks, or you can use the event system to trigger your own custom modals.
*   **Zero Dependencies**: Written in pure, vanilla JavaScript. No external libraries or frameworks are required.

## Quick Start

1.  **Include Files**: Add the `garansys_rp_schedular.js` and `garansys_rp_styles.css` files to your project.

    ```html
    <head>
        <!-- ... other head elements ... -->
        <link rel="stylesheet" href="path/to/garansys_rp_styles.css">
    </head>
    <body>
        <!-- ... your page content ... -->
        <script src="path/to/garansys_rp_schedular.js"></script>
    </body>
    ```

2.  **Add Container**: Place an empty `div` in your HTML where you want the scheduler to appear.

    ```html
    <div id="my-scheduler"></div>
    ```

3.  **Initialize**: Create a new instance of the scheduler in your script.

    ```javascript
    // Sample Data
    const resources = [
        { id: 1, name: 'Resource A' },
        { id: 2, name: 'Resource B' }
    ];

    const tasks = [
        { id: 1, title: 'Task 1', start: '2023-10-27', duration: 3, resourceIndex: 0, type: 'project' }
    ];

    // Initialize Scheduler
    const scheduler = new ResourceScheduler('#my-scheduler');

    // Load Data
    scheduler.loadData(resources, tasks);
    ```

## Configuration Options

You can pass an options object as the second argument to the constructor: `new ResourceScheduler(container, options)`.

| Option              | Type      | Default                               | Description                                                                                              |
| ------------------- | --------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `cellWidth`         | `Number`  | `80`                                  | The width of a single day cell in pixels.                                                                |
| `rowHeight`         | `Number`  | `50`                                  | The height of a resource row in pixels.                                                                  |
| `daysToShow`        | `Number`  | `21`                                  | The number of days to show initially.                                                                    |
| `startDate`         | `Date`    | `new Date()`                          | The initial start date for the view. The scheduler will start on the Monday of that week.                |
| `useBuiltInModal`   | `Boolean` | `true`                                | If `true`, uses the built-in modal for creating/editing tasks. If `false`, only emits events.            |
| `cellClickAction`   | `String`  | `'double'`                            | Action to open the modal on an empty cell. Can be `'single'` or `'double'`.                              |
| `minCellWidth`      | `Number`  | `40`                                  | The minimum allowed cell width when zooming out.                                                         |
| `maxCellWidth`      | `Number`  | `200`                                 | The maximum allowed cell width when zooming in.                                                          |
| `zoomLevels`        | `Array`   | `[40, 60, 80, 120, 160, 200]`          | An array of predefined cell widths for each zoom step.                                                   |
| `infiniteScroll`    | `Boolean` | `true`                                | Enables or disables infinite scrolling.                                                                  |
| `loadThreshold`     | `Number`  | `7`                                   | The number of days from the edge of the view that triggers loading more days.                            |
| `maxDaysInMemory`   | `Number`  | `84`                                  | The maximum number of days to keep in the DOM to preserve performance.                                   |
| `chunkDays`         | `Number`  | `21`                                  | The number of days to load at a time when scrolling to the edge.                                         |
| `taskColors`        | `Object`  | `{}`                                  | An object to define custom colors for tasks based on their `type`. See Theming section below.            |

### Theming with `taskColors`

You can define custom colors for tasks by passing a `taskColors` object. The keys must match the `type` property of your task objects.

```javascript
const scheduler = new ResourceScheduler('#scheduler', {
    taskColors: {
        'project': { start: '#5DADE2', end: '#3498DB' }, // Gradient
        'meeting': { start: '#F7DC6F' },                 // Solid color
        'vacation': { start: '#7D3C98', end: '#8E44AD' }
    }
});
```

## Data Format

### Resources
The `resources` array should contain objects, each representing a row in the scheduler.

```javascript
const resources = [
    { id: 1, name: 'Jan Janssen', department: 'Development' }, // 'name' is displayed
    { id: 2, name: 'Kees Keesen', department: 'Design' }
    // ... any other custom fields
];
```

### Tasks
The `tasks` array should contain objects with the following properties.

| Property        | Type     | Required | Description                                                    |
| --------------- | -------- | -------- | -------------------------------------------------------------- |
| `id`            | `Number` | Yes      | A unique identifier for the task.                              |
| `title`         | `String` | Yes      | The title of the task, displayed on the timeline.              |
| `start`         | `String` | Yes      | The start date of the task in `YYYY-MM-DD` format.             |
| `duration`      | `Number` | Yes      | The duration of the task in days (minimum 1).                  |
| `resourceIndex` | `Number` | Yes      | The zero-based index of the resource this task belongs to.     |
| `type`          | `String` | No       | A type string used for CSS styling and `taskColors` theming.   |
| `end`           | `String` | No       | The end date in `YYYY-MM-DD` format. Automatically calculated. |

## Public API Methods

You can call these methods on your scheduler instance (e.g., `scheduler.addTask(...)`).

| Method                        | Parameters                                | Description                                                                   |
| ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `loadData(resources, tasks)`  | `Array`, `Array`                          | Loads resources and tasks into the scheduler and renders them.                |
| `getData()`                   | -                                         | Returns an object containing the current `resources` and `tasks` arrays.      |
| `addTask(task)`               | `Object`                                  | Adds a new task to the scheduler.                                             |
| `removeTask(taskId)`          | `Number`                                  | Removes a task by its ID.                                                     |
| `updateTask(taskId, updates)` | `Number`, `Object`                        | Updates a task by its ID with the provided properties.                        |
| `getTask(taskId)`             | `Number`                                  | Retrieves a single task object by its ID.                                     |
| `getTasksForResource(index)`  | `Number`                                  | Returns an array of tasks for a specific resource index.                      |
| `setDateRange(startDate, days)` | `Date`, `Number`                          | Sets a new visible date range.                                                |
| `goToToday()`                 | -                                         | Scrolls the timeline to the current date.                                     |
| `goToNextWeek()`              | -                                         | Navigates the timeline forward by 7 days.                                     |
| `goToPreviousWeek()`          | -                                         | Navigates the timeline backward by 7 days.                                    |
| `zoomIn()`                    | -                                         | Zooms in to the next level defined in `zoomLevels`.                           |
| `zoomOut()`                   | -                                         | Zooms out to the previous level defined in `zoomLevels`.                      |
| `scrollToDate(date)`          | `Date`                                    | Scrolls the timeline to a specific date if it's within the loaded range.      |
| `refresh()`                   | -                                         | Forces a full re-render of the scheduler.                                     |
| `destroy()`                   | -                                         | Removes the scheduler, its elements, and all event listeners.                 |

## Events

Listen for events using the `.on()` method.

```javascript
scheduler.on('taskMoved', (data) => {
    console.log(`Task "${data.task.title}" was moved!`);
    // Example: send update to the server
});
```

| Event               | Data Payload                                                                 | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `taskAdded`         | `(task)`                                                                     | Fired after a new task is added.                                                         |
| `taskUpdated`       | `{ task, oldTask }`                                                          | Fired after a task's properties are updated.                                             |
| `taskMoved`         | `{ task, oldStart, newStart, oldResourceIndex, newResourceIndex }`            | Fired after a task has been dragged and dropped to a new date or resource.               |
| `taskResized`       | `{ task, handle, oldStart, oldEnd, oldDuration, newStart, newEnd, newDuration }` | Fired after a task has been resized.                                                     |
| `taskRemoved`       | `(task)`                                                                     | Fired after a task has been removed.                                                     |
| `cellClicked`       | `{ resourceIndex, dayIndex, date, resource }`                                | Fired when an empty timeline cell is clicked.                                            |
| `cellDoubleClicked` | `{ resourceIndex, dayIndex, date, resource }`                                | Fired when an empty timeline cell is double-clicked.                                     |
| `taskDoubleClicked` | `(task)`                                                                     | Fired when a task is double-clicked.                                                     |
| `zoomChanged`       | `{ oldWidth, newWidth, action }`                                             | Fired when the zoom level changes (`'zoomIn'`, `'zoomOut'`, or `'setZoom'`).            |
| `dateRangeChanged`  | `{ startDate, endDate, days }`                                               | Fired when the visible date range is changed via navigation.                             |
| `dateRangeExtended` | `{ newEnd, newDays, totalDays, direction }`                                  | Fired when infinite scroll loads new days (`'forward'` or `'backward'`).                 |
| `error`             | `{ type, error }`                                                            | Fired when an internal error occurs. `type` indicates the origin of the error.           | 