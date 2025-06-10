/**
 * ResourceScheduler - Clean Library Version
 * Exact same UI as original, but with separated data/logic
 */
class ResourceScheduler {
    constructor(container, options = {}) {
        try {
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            if (!this.container) {
                throw new Error('Container element not found');
            }
            
            // Default options
            this.options = {
                cellWidth: 80,
                rowHeight: 50,
                daysToShow: 21,
                startDate: new Date(),
                // Modal options
                useBuiltInModal: true,
                cellClickAction: 'double', // 'single' or 'double' - when to open modal/emit event on cell click
                // Infinite scroll options
                infiniteScroll: true,
                loadThreshold: 7, // Load more when 7 days left
                bufferDays: 14, // Keep 14 days buffer on both sides
                maxDaysInMemory: 84, // Keep max 84 days (12 weeks) in memory
                chunkDays: 21, // Load 21 days at a time
                ...options
            };
            
            // State
            this.resources = [];
            this.tasks = [];
            this.currentTaskId = 0;
            this.dragState = null;
            this.resizeState = null;
            this.selectedCell = null;
            this.selectedTask = null;
            this.editingTask = null;
            this.events = {};
            
            // Infinite scroll state
            this.loadedDateRange = {
                start: null,
                end: null
            };
            this.isLoading = false;
            this.hasReachedEnd = false;
            
            // Calculate start date (Monday of current week)  
            this.currentStartDate = this.getMonday(this.options.startDate);
            
            // Initialize loaded range
            if (this.options.infiniteScroll) {
                this.loadedDateRange.start = new Date(this.currentStartDate);
                this.loadedDateRange.end = new Date(this.currentStartDate);
                this.loadedDateRange.end.setDate(this.loadedDateRange.end.getDate() + this.options.daysToShow - 1);
            }
            
            // Bind methods
            this.handleMouseMove = this.handleMouseMove.bind(this);
            this.handleMouseUp = this.handleMouseUp.bind(this);
            this.handleScroll = this.handleScroll.bind(this);
            
            this.init();
        } catch (error) {
            console.error('Error initializing ResourceScheduler:', error);
            this.emit('error', { type: 'initialization', error });
            throw error;
        }
    }
    
    /**
     * Validate task data
     */
    validateTask(task) {
        if (!task || typeof task !== 'object') {
            throw new Error('Task must be an object');
        }
        
        if (!task.title || typeof task.title !== 'string') {
            throw new Error('Task must have a valid title');
        }
        
        if (!task.start || !this.isValidDate(task.start)) {
            throw new Error('Task must have a valid start date (YYYY-MM-DD format)');
        }
        
        if (task.duration && (!Number.isInteger(task.duration) || task.duration < 1)) {
            throw new Error('Task duration must be a positive integer');
        }
        
        if (task.resourceIndex !== undefined && (!Number.isInteger(task.resourceIndex) || task.resourceIndex < 0)) {
            throw new Error('Task resourceIndex must be a non-negative integer');
        }
    }
    
    /**
     * Validate date string
     */
    isValidDate(dateString) {
        if (typeof dateString !== 'string') return false;
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        
        const date = new Date(dateString + 'T00:00:00');
        return !isNaN(date.getTime());
    }
    
    /**
     * Load data into scheduler
     */
    loadData(resources, tasks) {
        try {
            if (!Array.isArray(resources)) {
                throw new Error('Resources must be an array');
            }
            
            if (!Array.isArray(tasks)) {
                throw new Error('Tasks must be an array');
            }
            
            // Validate each task
            tasks.forEach((task, index) => {
                try {
                    this.validateTask(task);
                } catch (error) {
                    console.error(`Invalid task at index ${index}:`, error.message, task);
                    throw new Error(`Task validation failed at index ${index}: ${error.message}`);
                }
            });
            
            this.resources = resources || [];
            this.tasks = tasks || [];
            this.currentTaskId = Math.max(0, ...this.tasks.map(t => t.id || 0));
            this.render();
        } catch (error) {
            console.error('Error loading data:', error);
            this.emit('error', { type: 'dataLoading', error });
            throw error;
        }
    }
    
    /**
     * Get current data
     */
    getData() {
        try {
            return {
                resources: [...this.resources],
                tasks: [...this.tasks]
            };
        } catch (error) {
            console.error('Error getting data:', error);
            this.emit('error', { type: 'dataRetrieval', error });
            return { resources: [], tasks: [] };
        }
    }
    
    /**
     * Event system
     */
    on(event, callback) {
        try {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            if (!this.events[event]) this.events[event] = [];
            this.events[event].push(callback);
            return this; // Allow chaining
        } catch (error) {
            console.error('Error registering event handler:', error);
            return this;
        }
    }
    
    emit(event, data) {
        try {
            if (this.events[event]) {
                this.events[event].forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in event handler for ${event}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Error emitting event:', error);
        }
    }
    
    /**
     * Initialize the scheduler
     */
    init() {
        try {
            this.createHTML();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error during initialization:', error);
            this.emit('error', { type: 'initialization', error });
            throw error;
        }
    }
    
    createHTML() {
        try {
            this.container.innerHTML = `
                <div class="grp-scheduler-container">
                    <div class="grp-scheduler-header">
                        <div class="grp-resource-header">Resources</div>
                        <div class="grp-days-header-container">
                            <div class="grp-days-header"></div>
                        </div>
                    </div>
                    <div class="grp-scheduler-content">
                        <div class="grp-resources-column"></div>
                        <div class="grp-timeline-area">
                            <div class="grp-timeline-grid"></div>
                            ${this.options.infiniteScroll ? '<div class="grp-loading-indicator" style="display: none;">Loading more dates...</div>' : ''}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error creating HTML:', error);
            this.emit('error', { type: 'htmlCreation', error });
            throw error;
        }
    }
    
    setupEventListeners() {
        try {
            // Modal events (only if using built-in modal)
            if (this.options.useBuiltInModal) {
                // Remove any old modal from previous initializations
                const oldModal = document.getElementById('taskModal');
                if (oldModal) {
                    oldModal.remove();
                }
                
                // Create modal HTML and append to the body
                const modalHTML = `
                    <div id="taskModal" class="grp-modal">
                        <div class="grp-modal-content">
                            <div class="grp-modal-header">
                                <span class="grp-close">&times;</span>
                                <h2>Nieuwe Taak</h2>
                            </div>
                            <form id="taskForm">
                                <div class="grp-modal-body">
                                    <div class="grp-form-group">
                                        <label for="taskTitle">Titel</label>
                                        <input type="text" id="taskTitle" required>
                                    </div>
                                    <div class="grp-form-group">
                                        <label for="taskStart">Start Datum</label>
                                        <input type="date" id="taskStart" required>
                                    </div>
                                    <div class="grp-form-group">
                                        <label for="taskDuration">Duur (dagen)</label>
                                        <input type="number" id="taskDuration" min="1" value="1" required>
                                    </div>
                                    <div class="grp-form-group">
                                        <label for="taskResource">Resource</label>
                                        <select id="taskResource" required></select>
                                    </div>
                                    <div class="grp-form-group">
                                        <label for="taskType">Type</label>
                                        <select id="taskType">
                                            <option value="project">Project</option>
                                            <option value="meeting">Meeting</option>
                                            <option value="vacation">Vakantie</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="grp-modal-footer">
                                    <button type="button" class="grp-btn grp-btn-secondary" onclick="this.closest('.grp-modal').style.display='none'">Annuleren</button>
                                    <button type="submit" class="grp-btn grp-btn-primary">Opslaan</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                
                const modal = document.getElementById('taskModal');
                const closeBtn = modal ? modal.querySelector('.grp-close') : null;
                const form = document.getElementById('taskForm');
                
                if (closeBtn) {
                    closeBtn.onclick = () => this.closeTaskModal();
                }
                if (modal) {
                    window.onclick = (e) => {
                        if (e.target === modal) this.closeTaskModal();
                    };
                }
                if (form) {
                    form.onsubmit = (e) => this.saveTask(e);
                }
            }
            
            // Global mouse events for dragging
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
            
            // Keyboard events for task operations
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            
            // Setup scroll synchronization AFTER HTML is created
            this.syncScroll();
            
            // Always add scroll listener to timeline-area like the working example
            const timelineArea = this.container.querySelector('.grp-timeline-area');
            console.log('🔧 Adding scroll listener to timeline-area:', timelineArea);
            if (timelineArea) {
                timelineArea.addEventListener('scroll', this.handleScroll, { passive: true });
                
                // Debug: Test if timeline-area is scrollable
                setTimeout(() => {
                    console.log('📊 Timeline-area scroll info:', {
                        scrollWidth: timelineArea.scrollWidth,
                        clientWidth: timelineArea.clientWidth,
                        scrollHeight: timelineArea.scrollHeight,
                        clientHeight: timelineArea.clientHeight,
                        canScrollHorizontal: timelineArea.scrollWidth > timelineArea.clientWidth,
                        canScrollVertical: timelineArea.scrollHeight > timelineArea.clientHeight
                    });
                }, 100);
            }
        } catch (error) {
            console.error('Error setting up event listeners:', error);
            this.emit('error', { type: 'eventListeners', error });
        }
    }
    
    /**
     * Synchronize scroll between timeline-area and days-header
     */
    syncScroll() {
        try {
            const daysHeaderContainer = this.container.querySelector('.grp-days-header-container');
            const timelineArea = this.container.querySelector('.grp-timeline-area');
            
            console.log('🔗 Setting up scroll sync between:', { daysHeaderContainer, timelineArea });
            
            if (!daysHeaderContainer || !timelineArea) {
                console.warn('Could not find elements for scroll sync:', { daysHeaderContainer, timelineArea });
                return;
            }
            
            // Sync header container scroll with timeline-area scroll (like working example)
            timelineArea.addEventListener('scroll', () => {
                daysHeaderContainer.scrollLeft = timelineArea.scrollLeft;
                console.log('📜 Syncing scroll:', timelineArea.scrollLeft);
            });
        } catch (error) {
            console.error('Error setting up scroll sync:', error);
            this.emit('error', { type: 'scrollSync', error });
        }
    }
    
    render() {
        try {
            this.renderDaysHeader();
            this.renderResources();
            this.renderTimeline();
            this.renderTasks();
        } catch (error) {
            console.error('Error during render:', error);
            this.emit('error', { type: 'render', error });
        }
    }
    
    renderDaysHeader() {
        try {
            const daysHeader = this.container.querySelector('.grp-days-header');
            if (!daysHeader) {
                throw new Error('Days header element not found');
            }
            
            daysHeader.innerHTML = '';
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            console.log('🗓️ HEADER DEBUG - currentStartDate:', this.dateToYMD(this.currentStartDate));
            
            for (let i = 0; i < this.options.daysToShow; i++) {
                const date = new Date(this.currentStartDate.getTime() + (i * 24 * 60 * 60 * 1000));
                
                const dayEl = document.createElement('div');
                dayEl.className = 'grp-day-column';
                
                // Add weekend class
                if (date.getDay() === 0 || date.getDay() === 6) {
                    dayEl.classList.add('grp-weekend');
                }
                
                // Add today class
                if (date.getTime() === today.getTime()) {
                    dayEl.classList.add('grp-today');
                }
                
                const isoDate = this.dateToYMD(date);
                const displayDate = `${date.getDate()}/${date.getMonth() + 1}`;
                
                dayEl.innerHTML = `
                    <div class="grp-day-name">${date.toLocaleDateString('nl-NL', { weekday: 'short' })}</div>
                    <div class="grp-day-date">${displayDate}</div>
                `;
                
                console.log(`🗓️ HEADER[${i}]: Visual="${displayDate}", ISO="${isoDate}", DateObject="${date.toString()}", getDate="${date.getDate()}", getMonth="${date.getMonth() + 1}"`);
                
                daysHeader.appendChild(dayEl);
            }
        } catch (error) {
            console.error('Error rendering days header:', error);
            this.emit('error', { type: 'renderDaysHeader', error });
        }
    }
    
    renderResources() {
        try {
            const resourcesColumn = this.container.querySelector('.grp-resources-column');
            if (!resourcesColumn) {
                throw new Error('Resources column element not found');
            }
            
            resourcesColumn.innerHTML = '';
            
            this.resources.forEach((resource, index) => {
                if (!resource || typeof resource.name !== 'string') {
                    console.warn(`Invalid resource at index ${index}:`, resource);
                    return;
                }
                
                const resourceEl = document.createElement('div');
                resourceEl.className = 'grp-resource-row';
                resourceEl.dataset.resourceIndex = index;
                resourceEl.textContent = resource.name;
                resourcesColumn.appendChild(resourceEl);
            });
        } catch (error) {
            console.error('Error rendering resources:', error);
            this.emit('error', { type: 'renderResources', error });
        }
    }
    
    renderTimeline() {
        try {
            const timelineGrid = this.container.querySelector('.grp-timeline-grid');
            if (!timelineGrid) {
                throw new Error('Timeline grid element not found');
            }
            
            timelineGrid.innerHTML = '';
            
            console.log('🔲 TIMELINE DEBUG - currentStartDate:', this.dateToYMD(this.currentStartDate));
            
            this.resources.forEach((resource, resourceIndex) => {
                const rowEl = document.createElement('div');
                rowEl.className = 'grp-timeline-row';
                rowEl.dataset.resourceIndex = resourceIndex;
                
                for (let dayIndex = 0; dayIndex < this.options.daysToShow; dayIndex++) {
                    const date = new Date(this.currentStartDate.getTime() + (dayIndex * 24 * 60 * 60 * 1000));
                    
                    const cellEl = document.createElement('div');
                    cellEl.className = 'grp-timeline-cell';
                    cellEl.dataset.resourceIndex = resourceIndex;
                    cellEl.dataset.dayIndex = dayIndex;
                    cellEl.dataset.date = this.dateToYMD(date);
                    
                    // Add weekend class
                    if (date.getDay() === 0 || date.getDay() === 6) {
                        cellEl.classList.add('grp-weekend');
                    }
                    
                    // Add today class
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date.getTime() === today.getTime()) {
                        cellEl.classList.add('grp-today');
                    }
                    
                    if (resourceIndex === 0) { // Only log first row to avoid spam
                        console.log(`🔲 CELL[${dayIndex}]: dataset.date="${cellEl.dataset.date}", ISO="${this.dateToYMD(date)}"`);
                    }
                    
                    cellEl.addEventListener('click', (e) => this.handleCellClick(e));
                    cellEl.addEventListener('dblclick', (e) => this.handleCellDoubleClick(e));
                    rowEl.appendChild(cellEl);
                }
                
                timelineGrid.appendChild(rowEl);
            });
        } catch (error) {
            console.error('Error rendering timeline:', error);
            this.emit('error', { type: 'renderTimeline', error });
        }
    }
    
    renderTasks() {
        try {
            // Remove existing task elements
            this.container.querySelectorAll('.grp-task').forEach(el => el.remove());
            
            // Add all tasks
            this.tasks.forEach(task => {
                try {
                    this.addSingleTask(task);
                } catch (error) {
                    console.error(`Error rendering task ${task.id}:`, error, task);
                }
            });
            
            this.emit('tasksRendered', this.tasks);
        } catch (error) {
            console.error('Error rendering tasks:', error);
            this.emit('error', { type: 'renderTasks', error });
        }
    }
    
    addSingleTask(task) {
        try {
            if (!task) {
                throw new Error('Task is required');
            }
            
            const startDay = this.getTaskStartDayIndex(task);
            if (startDay < 0 || startDay >= this.options.daysToShow) return;
            
            const taskEl = document.createElement('div');
            taskEl.className = `grp-task${task.type ? ` grp-${task.type}` : ''}`;
            taskEl.dataset.taskId = task.id;
            taskEl.innerHTML = `
                <span class="grp-task-text">${task.title || 'Untitled'}</span>
                <button class="grp-task-delete-btn" title="Verwijder taak">&times;</button>
            `;
            taskEl.title = `${task.title || 'Untitled'} (${task.duration || 1} dagen)`;
            
            // Calculate position
            const width = (task.duration || 1) * this.options.cellWidth;
            const left = startDay * this.options.cellWidth;
            const top = (task.resourceIndex || 0) * (this.options.rowHeight + 1);
            
            taskEl.style.cssText = `
                width: ${width}px;
                left: ${left}px;
                top: ${top}px;
            `;
            
            // Add drag functionality
            taskEl.addEventListener('mousedown', (e) => this.startDrag(e));
            
            // Add delete functionality
            const deleteBtn = taskEl.querySelector('.grp-task-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteTask(task.id);
                });
            }
            
            // Add click to select functionality
            taskEl.addEventListener('click', (e) => {
                if (!e.target.closest('.grp-task-delete-btn')) {
                    this.selectTask(task.id);
                }
            });
            
            // Add double-click to edit functionality
            taskEl.addEventListener('dblclick', (e) => {
                if (!e.target.closest('.grp-task-delete-btn')) {
                    this.handleTaskDoubleClick(task.id);
                }
            });
            
            // Add to timeline area
            const timelineArea = this.container.querySelector('.grp-timeline-area');
            if (!timelineArea) {
                throw new Error('Timeline area not found');
            }
            timelineArea.appendChild(taskEl);
            
            console.log('🎯 ADD TASK DEBUG:', {
                id: task.id,
                title: task.title,
                taskStart: task.start,
                startDay: startDay,
                duration: task.duration,
                visualLeft: left,
                visualDay: Math.round(left / this.options.cellWidth),
                currentStartDate: this.dateToYMD(this.currentStartDate),
                shouldBeOnDay: `Visual day ${startDay} should show date ${this.dateToYMD(new Date(this.currentStartDate.getTime() + (startDay * 24 * 60 * 60 * 1000)))}`
            });
        } catch (error) {
            console.error('Error adding single task:', error, task);
            this.emit('error', { type: 'addSingleTask', error, task });
        }
    }
    
    getTaskStartDayIndex(task) {
        try {
            if (!task || !task.start) {
                throw new Error('Task must have a start date');
            }
            
            // Parse task date in local time
            const [year, month, day] = task.start.split('-').map(Number);
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                throw new Error('Invalid date format in task start');
            }
            
            const taskDate = new Date(year, month - 1, day);
            taskDate.setHours(0, 0, 0, 0); // Normalize to local midnight
            
            const startDate = new Date(this.currentStartDate);
            startDate.setHours(0, 0, 0, 0); // Normalize to local midnight
            
            const diffTime = taskDate.getTime() - startDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            console.log('📍 getTaskStartDayIndex DEBUG:', {
                taskId: task.id,
                taskStart: task.start,
                taskDateLocal: taskDate.toLocaleDateString('nl-NL'),
                startDateLocal: startDate.toLocaleDateString('nl-NL'),
                diffTime: diffTime,
                diffDays: diffDays,
                shouldBeVisualDay: diffDays
            });
            
            return diffDays;
        } catch (error) {
            console.error('Error calculating task start day index:', error, task);
            return -1; // Return invalid index to skip rendering
        }
    }
    
    getMonday(date) {
        try {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
            d.setHours(0, 0, 0, 0);
            return d;
        } catch (error) {
            console.error('Error getting Monday:', error);
            return new Date(); // Fallback to current date
        }
    }
    
    dateToYMD(date) {
        try {
            if (!date || isNaN(date.getTime())) {
                throw new Error('Invalid date object');
            }
            const y = date.getFullYear();
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            return `${y}-${m}-${d}`;
        } catch (error) {
            console.error('Error converting date to YMD:', error);
            return '1970-01-01'; // Fallback date
        }
    }
    
    calculateEndDate(startDateString, duration) {
        try {
            if (!startDateString || !this.isValidDate(startDateString)) {
                throw new Error('Invalid start date');
            }
            
            if (!duration || duration < 1) {
                throw new Error('Duration must be at least 1');
            }
            
            const [year, month, day] = startDateString.split('-').map(Number);
            const startDate = new Date(year, month - 1, day);
            startDate.setHours(0, 0, 0, 0); // Normalize to local midnight
            
            const endDate = new Date(startDate.getTime() + ((duration - 1) * 24 * 60 * 60 * 1000));
            return this.dateToYMD(endDate);
        } catch (error) {
            console.error('Error calculating end date:', error);
            return startDateString; // Fallback to start date
        }
    }
    
    openTaskModal(e, existingTask = null) {
        try {
            if (existingTask) {
                // Editing existing task
                this.editingTask = existingTask;
                this.selectedCell = null;
            } else {
                // Creating new task from cell click
                const cell = e ? e.target.closest('.grp-timeline-cell') : null;
                if (!cell || e.target.closest('.grp-task')) return;
                
                this.selectedCell = {
                    resourceIndex: parseInt(cell.dataset.resourceIndex),
                    dayIndex: parseInt(cell.dataset.dayIndex),
                    date: cell.dataset.date
                };
                
                this.editingTask = null;
            }
            
            const modal = document.getElementById('taskModal');
            if (!modal) {
                throw new Error('Task modal not found');
            }
            
            const modalTitle = modal.querySelector('h2');
            const titleInput = document.getElementById('taskTitle');
            const startInput = document.getElementById('taskStart');
            const durationInput = document.getElementById('taskDuration');
            const resourceSelect = document.getElementById('taskResource');
            const typeInput = document.getElementById('taskType');
            
            if (!titleInput || !startInput || !durationInput || !resourceSelect || !typeInput) {
                throw new Error('Modal form elements not found');
            }
            
            // Fill resource select options if not already filled
            if (resourceSelect.options.length === 0) {
                this.resources.forEach((resource, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = resource.name;
                    resourceSelect.appendChild(option);
                });
            }
            
            if (existingTask) {
                // Fill form with existing task data
                if (modalTitle) modalTitle.textContent = 'Taak Bewerken';
                titleInput.value = existingTask.title || '';
                startInput.value = existingTask.start || '';
                durationInput.value = existingTask.duration || 1;
                resourceSelect.value = existingTask.resourceIndex || 0;
                typeInput.value = existingTask.type || 'project';
            } else {
                // Reset form for new task and prefill with selected cell data
                if (modalTitle) modalTitle.textContent = 'Nieuwe Taak';
                titleInput.value = '';
                startInput.value = this.selectedCell.date;
                durationInput.value = '1';
                resourceSelect.value = this.selectedCell.resourceIndex;
                typeInput.value = 'project';
            }
            
            modal.style.display = 'block';
            titleInput.focus();
        } catch (error) {
            console.error('Error opening task modal:', error);
            this.emit('error', { type: 'modalOpen', error });
        }
    }
    
    closeTaskModal() {
        try {
            const modal = document.getElementById('taskModal');
            if (modal) {
                modal.style.display = 'none';
            }
            this.selectedCell = null;
            this.editingTask = null;
        } catch (error) {
            console.error('Error closing task modal:', error);
            this.emit('error', { type: 'modalClose', error });
        }
    }
    
    saveTask(e) {
        try {
            e.preventDefault();
            
            const titleInput = document.getElementById('taskTitle');
            const startInput = document.getElementById('taskStart');
            const durationInput = document.getElementById('taskDuration');
            const resourceSelect = document.getElementById('taskResource');
            const typeInput = document.getElementById('taskType');
            
            if (!titleInput || !startInput || !durationInput || !resourceSelect || !typeInput) {
                throw new Error('Form elements not found');
            }
            
            const title = titleInput.value.trim();
            const start = startInput.value;
            const duration = parseInt(durationInput.value);
            const resourceIndex = parseInt(resourceSelect.value);
            const type = typeInput.value;
            
            if (!title) {
                throw new Error('Task title is required');
            }
            
            if (!start) {
                throw new Error('Start date is required');
            }
            
            if (isNaN(duration) || duration < 1) {
                throw new Error('Task duration must be at least 1 day');
            }
            
            if (this.editingTask) {
                // Update existing task
                const oldTask = { ...this.editingTask };
                
                this.editingTask.title = title;
                this.editingTask.start = start;
                this.editingTask.duration = duration;
                this.editingTask.resourceIndex = resourceIndex;
                this.editingTask.type = type;
                
                // Recalculate end date based on new duration
                this.editingTask.end = this.calculateEndDate(start, duration);
                
                // Re-render the task
                const taskEl = this.container.querySelector(`[data-task-id="${this.editingTask.id}"]`);
                if (taskEl) taskEl.remove();
                this.addSingleTask(this.editingTask);
                
                this.emit('taskUpdated', { task: this.editingTask, oldTask });
                
            } else {
                // Create new task
                const task = {
                    id: ++this.currentTaskId,
                    title: title,
                    start: start,
                    duration: duration,
                    resourceIndex: resourceIndex,
                    type: type
                };
                
                // Calculate end date
                task.end = this.calculateEndDate(start, duration);
                
                this.tasks.push(task);
                this.addSingleTask(task);
                this.emit('taskAdded', task);
            }
            
            this.closeTaskModal();
        } catch (error) {
            console.error('Error saving task:', error);
            this.emit('error', { type: 'taskSave', error });
            alert(`Error saving task: ${error.message}`);
        }
    }
    
    startDrag(e) {
        try {
            // Don't start drag if clicking on delete button
            if (e.target.closest('.grp-task-delete-btn')) {
                return;
            }
            
            const taskEl = e.target.closest('.grp-task');
            if (!taskEl) {
                throw new Error('Task element not found');
            }
            
            const task = this.tasks.find(t => t.id == taskEl.dataset.taskId);
            if (!task) {
                throw new Error('Task data not found');
            }
            
            // Check if click is on resize handles
            const rect = taskEl.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const isLeftHandle = clickX <= 8;
            const isRightHandle = clickX >= rect.width - 8;
            
            if (isLeftHandle || isRightHandle) {
                this.startResize(e, taskEl, task, isLeftHandle ? 'left' : 'right');
                return;
            }
            
            // Regular drag logic
            const currentLeft = parseInt(taskEl.style.left) || 0;
            const currentStartDay = Math.round(currentLeft / this.options.cellWidth);
            
            console.log('Starting drag (SIMPLE):', {
                taskId: task.id,
                currentLeft: currentLeft,
                currentStartDay: currentStartDay,
                taskStart: task.start
            });
            
            this.dragState = {
                task: task,
                element: taskEl,
                startX: e.clientX,
                startY: e.clientY,
                originalResourceIndex: task.resourceIndex,
                currentResourceIndex: task.resourceIndex,
                originalStartDay: currentStartDay // Use DOM position
            };
            
            taskEl.classList.add('grp-dragging');
            e.preventDefault();
            
            this.emit('dragStart', { task, element: taskEl });
        } catch (error) {
            console.error('Error starting drag:', error);
            this.emit('error', { type: 'dragStart', error });
        }
    }
    
    startResize(e, taskEl, task, handle) {
        try {
            const currentLeft = parseInt(taskEl.style.left) || 0;
            const currentWidth = parseInt(taskEl.style.width) || 0;
            const currentStartDay = Math.round(currentLeft / this.options.cellWidth);
            const currentDuration = Math.round(currentWidth / this.options.cellWidth);
            
            this.resizeState = {
                task: task,
                element: taskEl,
                handle: handle,
                startX: e.clientX,
                originalStartDay: currentStartDay,
                originalDuration: currentDuration,
                originalLeft: currentLeft,
                originalWidth: currentWidth
            };
            
            taskEl.classList.add('grp-resizing');
            e.preventDefault();
            
            this.emit('resizeStart', { task, handle, element: taskEl });
        } catch (error) {
            console.error('Error starting resize:', error);
            this.emit('error', { type: 'resizeStart', error });
        }
    }
    
    handleMouseMove(e) {
        try {
            if (this.resizeState) {
                this.handleResizeMove(e);
                return;
            }
            
            if (!this.dragState) return;
            
            const deltaX = e.clientX - this.dragState.startX;
            const deltaY = e.clientY - this.dragState.startY;
            
            const cellsDeltaX = Math.round(deltaX / this.options.cellWidth);
            const rowsDeltaY = Math.round(deltaY / (this.options.rowHeight + 1));
            
            // Update visual position
            const newLeft = (this.dragState.originalStartDay + cellsDeltaX) * this.options.cellWidth;
            const newTop = (this.dragState.originalResourceIndex + rowsDeltaY) * (this.options.rowHeight + 1);
            
            this.dragState.element.style.left = newLeft + 'px';
            this.dragState.element.style.top = newTop + 'px';
            
            // Track resource changes
            const newResourceIndex = Math.max(0, Math.min(this.resources.length - 1, this.dragState.originalResourceIndex + rowsDeltaY));
            if (newResourceIndex !== this.dragState.currentResourceIndex) {
                console.log('Moving task to new row:', {
                    taskId: this.dragState.task.id,
                    fromResource: this.dragState.currentResourceIndex,
                    toResource: newResourceIndex
                });
                this.dragState.currentResourceIndex = newResourceIndex;
            }
            
            console.log('Drag move:', {
                taskId: this.dragState.task.id,
                deltaX: deltaX,
                deltaY: deltaY,
                cellsDeltaX: cellsDeltaX,
                rowsDeltaY: rowsDeltaY,
                newLeft: newLeft,
                newTop: newTop
            });
        } catch (error) {
            console.error('Error handling mouse move:', error);
            this.emit('error', { type: 'mouseMove', error });
        }
    }
    
    handleResizeMove(e) {
        try {
            const deltaX = e.clientX - this.resizeState.startX;
            const cellsDelta = Math.round(deltaX / this.options.cellWidth);
            
            let newLeft = this.resizeState.originalLeft;
            let newWidth = this.resizeState.originalWidth;
            let newStartDay = this.resizeState.originalStartDay;
            let newDuration = this.resizeState.originalDuration;
            
            if (this.resizeState.handle === 'left') {
                // Resize from left - change start position and duration
                const maxLeftMove = this.resizeState.originalDuration - 1; // Keep at least 1 day
                const actualDelta = Math.max(-maxLeftMove, Math.min(cellsDelta, this.resizeState.originalStartDay));
                
                newLeft = this.resizeState.originalLeft + (actualDelta * this.options.cellWidth);
                newWidth = this.resizeState.originalWidth - (actualDelta * this.options.cellWidth);
                newStartDay = this.resizeState.originalStartDay + actualDelta;
                newDuration = this.resizeState.originalDuration - actualDelta;
            } else {
                // Resize from right - change duration only
                const maxRightMove = this.options.daysToShow - this.resizeState.originalStartDay - 1;
                const actualDelta = Math.max(-(this.resizeState.originalDuration - 1), Math.min(cellsDelta, maxRightMove));
                
                newWidth = this.resizeState.originalWidth + (actualDelta * this.options.cellWidth);
                newDuration = this.resizeState.originalDuration + actualDelta;
            }
            
            // Ensure minimum size
            if (newDuration < 1) {
                newDuration = 1;
                if (this.resizeState.handle === 'left') {
                    newStartDay = this.resizeState.originalStartDay + this.resizeState.originalDuration - 1;
                    newLeft = newStartDay * this.options.cellWidth;
                }
                newWidth = this.options.cellWidth;
            }
            
            // Update visual
            this.resizeState.element.style.left = newLeft + 'px';
            this.resizeState.element.style.width = newWidth + 'px';
            
            // Store current values for mouse up
            this.resizeState.currentStartDay = newStartDay;
            this.resizeState.currentDuration = newDuration;
        } catch (error) {
            console.error('Error handling resize move:', error);
            this.emit('error', { type: 'resizeMove', error });
        }
    }
    
    handleMouseUp(e) {
        try {
            if (this.resizeState) {
                this.handleResizeEnd(e);
                return;
            }
            
            if (!this.dragState) return;
            
            const deltaX = e.clientX - this.dragState.startX;
            const deltaY = e.clientY - this.dragState.startY;
            
            const cellsDeltaX = Math.round(deltaX / this.options.cellWidth);
            const rowsDeltaY = Math.round(deltaY / (this.options.rowHeight + 1));
            
            // Calculate new values
            const newStartDay = Math.max(0, Math.min(this.options.daysToShow - this.dragState.task.duration, this.dragState.originalStartDay + cellsDeltaX));
            const newResourceIndex = Math.max(0, Math.min(this.resources.length - 1, this.dragState.originalResourceIndex + rowsDeltaY));
            
            // Calculate new dates using more reliable millisecond addition
            const newStartDate = new Date(this.currentStartDate.getTime() + (newStartDay * 24 * 60 * 60 * 1000));
            
            const newEndDate = new Date(newStartDate.getTime() + ((this.dragState.task.duration - 1) * 24 * 60 * 60 * 1000));
            
            // Update task data
            const oldStart = this.dragState.task.start;
            this.dragState.task.start = this.dateToYMD(newStartDate);
            this.dragState.task.end = this.dateToYMD(newEndDate);
            this.dragState.task.resourceIndex = newResourceIndex;
            
            console.log('🏃 DRAG COMPLETE DEBUG:', {
                taskId: this.dragState.task.id,
                oldStart: oldStart,
                newStartDay: newStartDay,
                currentStartDate: this.dateToYMD(this.currentStartDate),
                calculatedNewStart: this.dateToYMD(newStartDate),
                finalTaskStart: this.dragState.task.start,
                visualPosition: `left: ${this.dragState.element.style.left}, which is day ${Math.round(parseInt(this.dragState.element.style.left) / this.options.cellWidth)}`,
                debugManualCalc: `Day ${newStartDay} from ${this.dateToYMD(this.currentStartDate)} should be: ${this.dateToYMD(new Date(this.currentStartDate.getTime() + (newStartDay * 24 * 60 * 60 * 1000)))}`,
                actualNewStartDate: newStartDate.toString()
            });
            
            // Clean up
            this.dragState.element.classList.remove('grp-dragging');
            
            this.emit('taskMoved', {
                task: this.dragState.task,
                oldStart: oldStart,
                newStart: this.dragState.task.start,
                oldResourceIndex: this.dragState.originalResourceIndex,
                newResourceIndex: newResourceIndex
            });
            
            this.dragState = null;
        } catch (error) {
            console.error('Error handling mouse up:', error);
            this.emit('error', { type: 'mouseUp', error });
            
            // Clean up drag state on error
            if (this.dragState && this.dragState.element) {
                this.dragState.element.classList.remove('grp-dragging');
            }
            this.dragState = null;
        }
    }
    
    handleResizeEnd(e) {
        try {
            const task = this.resizeState.task;
            const element = this.resizeState.element;
            const handle = this.resizeState.handle;
            const oldStart = task.start;
            const oldEnd = task.end;
            const oldDuration = task.duration;
            
            // Calculate new dates
            const newStartDay = this.resizeState.currentStartDay || this.resizeState.originalStartDay;
            const newDuration = this.resizeState.currentDuration || this.resizeState.originalDuration;
            
            const newStartDate = new Date(this.currentStartDate.getTime() + (newStartDay * 24 * 60 * 60 * 1000));
            
            const newEndDate = new Date(newStartDate.getTime() + ((newDuration - 1) * 24 * 60 * 60 * 1000));
            
            // Update task data
            task.start = this.dateToYMD(newStartDate);
            task.end = this.dateToYMD(newEndDate);
            task.duration = newDuration;
            
            console.log('Updated task after resize:', {
                id: task.id,
                handle: handle,
                oldStart: oldStart,
                oldEnd: oldEnd,
                oldDuration: oldDuration,
                newStart: task.start,
                newEnd: task.end,
                newDuration: task.duration
            });
            
            // Clean up
            element.classList.remove('grp-resizing');
            
            this.emit('taskResized', {
                task: task,
                handle: handle,
                oldStart: oldStart,
                oldEnd: oldEnd,
                oldDuration: oldDuration,
                newStart: task.start,
                newEnd: task.end,
                newDuration: task.duration
            });
            
            this.resizeState = null;
        } catch (error) {
            console.error('Error handling resize end:', error);
            this.emit('error', { type: 'resizeEnd', error });
            
            // Clean up resize state on error
            if (this.resizeState && this.resizeState.element) {
                this.resizeState.element.classList.remove('grp-resizing');
            }
            this.resizeState = null;
        }
    }
    
    /**
     * Handle keyboard events
     */
    handleKeyDown(e) {
        try {
            // Don't handle keyboard shortcuts when typing in input fields or when modal is open
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
            const modal = document.getElementById('taskModal');
            const isModalOpen = modal && modal.style.display === 'block';
            
            if (isTyping || isModalOpen) {
                return; // Let the user type normally
            }
            
            // Delete selected task with Delete or Backspace key
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedTask) {
                e.preventDefault();
                this.deleteTask(this.selectedTask);
            }
            
            // Escape to deselect
            if (e.key === 'Escape') {
                this.selectTask(null);
            }
        } catch (error) {
            console.error('Error handling keyboard event:', error);
            this.emit('error', { type: 'keyboard', error });
        }
    }
    
    /**
     * Select a task
     */
    selectTask(taskId) {
        try {
            // Remove previous selection
            this.container.querySelectorAll('.grp-task.grp-selected').forEach(el => {
                el.classList.remove('grp-selected');
            });
            
            this.selectedTask = taskId;
            
            if (taskId) {
                const taskEl = this.container.querySelector(`[data-task-id="${taskId}"]`);
                if (taskEl) {
                    taskEl.classList.add('grp-selected');
                    this.emit('taskSelected', this.getTask(taskId));
                }
            } else {
                this.emit('taskDeselected');
            }
        } catch (error) {
            console.error('Error selecting task:', error);
            this.emit('error', { type: 'taskSelect', error });
        }
    }
    
    /**
     * Delete a task with confirmation
     */
    deleteTask(taskId) {
        try {
            const task = this.getTask(taskId);
            if (!task) return;
            
            // Show confirmation dialog
            const confirmed = confirm(`Weet je zeker dat je "${task.title}" wilt verwijderen?`);
            if (!confirmed) return;
            
            // If this was the selected task, deselect it
            if (this.selectedTask === taskId) {
                this.selectedTask = null;
            }
            
            // Remove the task
            this.removeTask(taskId);
        } catch (error) {
            console.error('Error deleting task:', error);
            this.emit('error', { type: 'taskDelete', error });
        }
    }
    
    /**
     * Edit an existing task
     */
    editTask(taskId) {
        try {
            const task = this.getTask(taskId);
            if (!task) return;
            
            this.editingTask = task;
            this.selectedCell = null; // Clear any selected cell
            
            this.openTaskModal(null, task);
        } catch (error) {
            console.error('Error editing task:', error);
            this.emit('error', { type: 'taskEdit', error });
        }
    }
    
    // Public API Methods
    addTask(task) {
        try {
            this.validateTask(task);
            
            // Allow custom fields by preserving all properties
            const newTask = {
                id: task.id || ++this.currentTaskId,
                title: task.title || 'Untitled Task',
                duration: task.duration || 1,
                resourceIndex: task.resourceIndex || 0,
                start: task.start,
                end: task.end || this.calculateEndDate(task.start, task.duration || 1),
                type: task.type || 'project',
                ...task // Spread to include any custom fields
            };
            
            this.tasks.push(newTask);
            this.addSingleTask(newTask);
            this.emit('taskAdded', newTask);
            return newTask;
        } catch (error) {
            console.error('Error adding task:', error);
            this.emit('error', { type: 'addTask', error, task });
            throw error;
        }
    }
    
    removeTask(taskId) {
        try {
            const index = this.tasks.findIndex(t => t.id === taskId);
            if (index > -1) {
                const task = this.tasks[index];
                this.tasks.splice(index, 1);
                
                const taskEl = this.container.querySelector(`[data-task-id="${taskId}"]`);
                if (taskEl) taskEl.remove();
                
                this.emit('taskRemoved', task);
                return task;
            }
            return null;
        } catch (error) {
            console.error('Error removing task:', error);
            this.emit('error', { type: 'removeTask', error, taskId });
            return null;
        }
    }
    
    updateTask(taskId, updates) {
        try {
            if (!updates || typeof updates !== 'object') {
                throw new Error('Updates must be an object');
            }
            
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                const oldTask = { ...task };
                
                // Validate updates if they contain critical fields
                if (updates.start && !this.isValidDate(updates.start)) {
                    throw new Error('Invalid start date in updates');
                }
                if (updates.duration && (!Number.isInteger(updates.duration) || updates.duration < 1)) {
                    throw new Error('Invalid duration in updates');
                }
                
                // Preserve all existing properties and apply updates
                Object.assign(task, updates);
                
                // Recalculate end date if start or duration changed
                if (updates.start || updates.duration) {
                    task.end = this.calculateEndDate(task.start, task.duration);
                }
                
                // Re-render the task
                const taskEl = this.container.querySelector(`[data-task-id="${taskId}"]`);
                if (taskEl) taskEl.remove();
                this.addSingleTask(task);
                
                this.emit('taskUpdated', { task, oldTask });
                return task;
            }
            return null;
        } catch (error) {
            console.error('Error updating task:', error);
            this.emit('error', { type: 'updateTask', error, taskId, updates });
            return null;
        }
    }
    
    getTask(taskId) {
        try {
            return this.tasks.find(t => t.id === taskId) || null;
        } catch (error) {
            console.error('Error getting task:', error);
            return null;
        }
    }
    
    getTasksForResource(resourceIndex) {
        try {
            if (!Number.isInteger(resourceIndex) || resourceIndex < 0) {
                throw new Error('Resource index must be a non-negative integer');
            }
            return this.tasks.filter(t => t.resourceIndex === resourceIndex);
        } catch (error) {
            console.error('Error getting tasks for resource:', error);
            return [];
        }
    }
    
    getTasksForDate(date) {
        try {
            const dateStr = typeof date === 'string' ? date : this.dateToYMD(date);
            if (!this.isValidDate(dateStr)) {
                throw new Error('Invalid date provided');
            }
            return this.tasks.filter(task => {
                return dateStr >= task.start && dateStr <= task.end;
            });
        } catch (error) {
            console.error('Error getting tasks for date:', error);
            return [];
        }
    }
    
    setDateRange(startDate, days) {
        try {
            if (!startDate || isNaN(new Date(startDate).getTime())) {
                throw new Error('Invalid start date');
            }
            if (days && (!Number.isInteger(days) || days < 1)) {
                throw new Error('Days must be a positive integer');
            }
            
            this.currentStartDate = this.getMonday(startDate);
            this.options.daysToShow = days || this.options.daysToShow;
            this.render();
            this.emit('dateRangeChanged', {
                startDate: this.currentStartDate,
                endDate: new Date(this.currentStartDate.getTime() + (this.options.daysToShow - 1) * 24 * 60 * 60 * 1000),
                days: this.options.daysToShow
            });
        } catch (error) {
            console.error('Error setting date range:', error);
            this.emit('error', { type: 'setDateRange', error });
        }
    }
    
    goToToday() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // First ensure today is within our date range
            const startDate = new Date(this.currentStartDate);
            const endDate = new Date(this.currentStartDate);
            endDate.setDate(endDate.getDate() + this.options.daysToShow - 1);
            
            // If today is not in the current range, update the range
            if (today < startDate || today > endDate) {
                this.setDateRange(today, this.options.daysToShow);
            }
            
            // Then scroll to today
            this.scrollToDate(today);
            
            this.emit('goToToday', { date: today });
        } catch (error) {
            console.error('Error going to today:', error);
            this.emit('error', { type: 'goToToday', error });
        }
    }
    
    goToNextWeek() {
        try {
            // If infinite scroll is disabled, check if we can go further
            if (!this.options.infiniteScroll) {
                const nextWeekStart = new Date(this.currentStartDate);
                nextWeekStart.setDate(nextWeekStart.getDate() + 7);
                
                const maxDate = new Date(this.loadedDateRange.end);
                maxDate.setDate(maxDate.getDate() - 7); // Keep at least a week visible
                
                if (nextWeekStart > maxDate) {
                    console.warn('Cannot go to next week - infinite scroll disabled and reached end of loaded range');
                    this.emit('navigationLimitReached', { direction: 'next', reason: 'infinite_scroll_disabled' });
                    return;
                }
            }
            
            const nextWeek = new Date(this.currentStartDate);
            nextWeek.setDate(nextWeek.getDate() + 7);
            this.setDateRange(nextWeek, this.options.daysToShow);
        } catch (error) {
            console.error('Error going to next week:', error);
            this.emit('error', { type: 'goToNextWeek', error });
        }
    }
    
    goToPreviousWeek() {
        try {
            // If infinite scroll is disabled, check if we can go back
            if (!this.options.infiniteScroll) {
                const prevWeekStart = new Date(this.currentStartDate);
                prevWeekStart.setDate(prevWeekStart.getDate() - 7);
                
                if (prevWeekStart < this.loadedDateRange.start) {
                    console.warn('Cannot go to previous week - infinite scroll disabled and reached start of loaded range');
                    this.emit('navigationLimitReached', { direction: 'previous', reason: 'infinite_scroll_disabled' });
                    return;
                }
            }
            
            const prevWeek = new Date(this.currentStartDate);
            prevWeek.setDate(prevWeek.getDate() - 7);
            this.setDateRange(prevWeek, this.options.daysToShow);
        } catch (error) {
            console.error('Error going to previous week:', error);
            this.emit('error', { type: 'goToPreviousWeek', error });
        }
    }
    
    refresh() {
        try {
            this.render();
            this.emit('refreshed');
        } catch (error) {
            console.error('Error refreshing:', error);
            this.emit('error', { type: 'refresh', error });
        }
    }
    
    destroy() {
        try {
            // Remove event listeners
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseup', this.handleMouseUp);
            document.removeEventListener('keydown', this.handleKeyDown.bind(this));
            
            // Remove scroll listener (always present now)
            const timelineArea = this.container.querySelector('.grp-timeline-area');
            if (timelineArea) {
                timelineArea.removeEventListener('scroll', this.handleScroll);
            }
            
            // Remove modal if it exists
            const modal = document.getElementById('taskModal');
            if (modal) modal.remove();
            
            // Clear container
            this.container.innerHTML = '';
            
            // Clear state
            this.dragState = null;
            this.resizeState = null;
            this.selectedCell = null;
            this.selectedTask = null;
            this.editingTask = null;
            this.events = {};
            
            this.emit('destroyed');
        } catch (error) {
            console.error('Error during destroy:', error);
            this.emit('error', { type: 'destroy', error });
        }
    }
    
    // Infinite Scroll Methods
    
    /**
     * Handle scroll events - always active for sync, infinite loading is optional
     */
    handleScroll(e) {
        try {
            console.log('🖱️ Scroll event triggered!', e.target);
            
            const element = e.target;
            const scrollLeft = element.scrollLeft;
            const scrollWidth = element.scrollWidth;
            const clientWidth = element.clientWidth;
            
            // Always log scroll info for debugging
            if (this.options.infiniteScroll) {
                const scrollPercentage = ((scrollLeft + clientWidth) / scrollWidth * 100);
                const shouldLoad = scrollLeft + clientWidth >= scrollWidth * 0.9;
                
                console.log('Scroll debug:', {
                    scrollLeft,
                    scrollWidth,
                    clientWidth,
                    scrollPercentage: scrollPercentage.toFixed(1) + '%',
                    shouldLoad,
                    isLoading: this.isLoading,
                    hasReachedEnd: this.hasReachedEnd,
                    threshold90: scrollWidth * 0.9,
                    currentPosition: scrollLeft + clientWidth
                });
            }
            
            // Only do infinite loading if enabled and not already loading
            if (this.options.infiniteScroll && !this.isLoading && !this.hasReachedEnd) {
                // Load more content when approaching the end (90% scrolled)
                if (scrollLeft + clientWidth >= scrollWidth * 0.9) {
                    console.log('🚀 Triggering loadMoreDays()');
                    this.loadMoreDays();
                }
                
                // Clean up old days if we have too many
                this.cleanupOldDays();
            }
        } catch (error) {
            console.error('Error handling scroll:', error);
            this.emit('error', { type: 'scroll', error });
        }
    }
    
    /**
     * Load more days into the timeline
     */
    async loadMoreDays() {
        if (this.isLoading || this.hasReachedEnd) return;
        
        try {
            this.isLoading = true;
            console.log('Loading more days...');
            
            // Show loading indicator
            const loadingIndicator = this.container.querySelector('.grp-loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'block';
            }
            
            this.emit('loadingStart', {
                currentRange: { ...this.loadedDateRange },
                requestedDays: this.options.chunkDays
            });
            
            // Calculate new end date
            const newEndDate = new Date(this.loadedDateRange.end);
            newEndDate.setDate(newEndDate.getDate() + this.options.chunkDays);
            
            // Update visible days
            const oldDaysToShow = this.options.daysToShow;
            this.options.daysToShow += this.options.chunkDays;
            
            // Update loaded range
            this.loadedDateRange.end = newEndDate;
            
            // Re-render the timeline with new days
            this.renderDaysHeader();
            this.renderTimeline();
            this.renderTasks();
            
            // Emit event for external systems to load data for new range
            this.emit('dateRangeExtended', {
                oldEnd: new Date(this.loadedDateRange.end.getTime() - (this.options.chunkDays * 24 * 60 * 60 * 1000)),
                newEnd: this.loadedDateRange.end,
                newDays: this.options.chunkDays,
                totalDays: this.options.daysToShow
            });
            
            console.log('Loaded more days:', {
                oldDaysToShow,
                newDaysToShow: this.options.daysToShow,
                newEndDate: this.loadedDateRange.end.toISOString().split('T')[0]
            });
            
        } catch (error) {
            console.error('Error loading more days:', error);
            this.emit('loadingError', error);
        } finally {
            this.isLoading = false;
            
            // Hide loading indicator
            const loadingIndicator = this.container.querySelector('.grp-loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            this.emit('loadingEnd', {
                currentRange: { ...this.loadedDateRange },
                totalDays: this.options.daysToShow
            });
        }
    }
    
    /**
     * Clean up old days to manage memory
     */
    cleanupOldDays() {
        try {
            if (this.options.daysToShow <= this.options.maxDaysInMemory) return;
            
            const timelineArea = this.container.querySelector('.grp-timeline-area');
            if (!timelineArea) return;
            
            const scrollLeft = timelineArea.scrollLeft;
            const visibleStartDay = Math.floor(scrollLeft / this.options.cellWidth);
            
            // Keep buffer days before visible area
            const keepFromDay = Math.max(0, visibleStartDay - this.options.bufferDays);
            
            if (keepFromDay > 0) {
                console.log('Cleaning up old days:', {
                    totalDays: this.options.daysToShow,
                    visibleStartDay,
                    keepFromDay,
                    daysToRemove: keepFromDay
                });
                
                // Update start date and days count
                this.currentStartDate.setDate(this.currentStartDate.getDate() + keepFromDay);
                this.options.daysToShow -= keepFromDay;
                this.loadedDateRange.start.setDate(this.loadedDateRange.start.getDate() + keepFromDay);
                
                // Filter tasks that are still visible
                const cutoffDate = new Date(this.currentStartDate);
                cutoffDate.setDate(cutoffDate.getDate() - 1);
                const cutoffDateStr = this.dateToYMD(cutoffDate);
                
                const visibleTasks = this.tasks.filter(task => task.end >= cutoffDateStr);
                const removedTasks = this.tasks.filter(task => task.end < cutoffDateStr);
                
                this.tasks = visibleTasks;
                
                // Re-render everything
                this.renderDaysHeader();
                this.renderTimeline();
                this.renderTasks();
                
                // Adjust scroll position to maintain visual position
                timelineArea.scrollLeft = scrollLeft - (keepFromDay * this.options.cellWidth);
                
                this.emit('daysCleanedUp', {
                    removedDays: keepFromDay,
                    removedTasks: removedTasks.length,
                    currentRange: { ...this.loadedDateRange },
                    totalDays: this.options.daysToShow
                });
            }
        } catch (error) {
            console.error('Error cleaning up old days:', error);
            this.emit('error', { type: 'cleanupOldDays', error });
        }
    }
    
    /**
     * Get the current visible date range
     */
    getVisibleDateRange() {
        try {
            const timelineArea = this.container.querySelector('.grp-timeline-area');
            if (!timelineArea) {
                throw new Error('Timeline area not found');
            }
            
            const scrollLeft = timelineArea.scrollLeft;
            const clientWidth = timelineArea.clientWidth;
            
            const startDay = Math.floor(scrollLeft / this.options.cellWidth);
            const endDay = Math.ceil((scrollLeft + clientWidth) / this.options.cellWidth);
            
            const startDate = new Date(this.currentStartDate);
            startDate.setDate(startDate.getDate() + startDay);
            
            const endDate = new Date(this.currentStartDate);
            endDate.setDate(endDate.getDate() + endDay);
            
            return {
                start: startDate,
                end: endDate,
                startDay,
                endDay
            };
        } catch (error) {
            console.error('Error getting visible date range:', error);
            this.emit('error', { type: 'getVisibleDateRange', error });
            return null;
        }
    }
    
    /**
     * Scroll to a specific date
     */
    scrollToDate(date) {
        try {
            const targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                throw new Error('Invalid date provided');
            }
            
            const diffTime = targetDate.getTime() - this.currentStartDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0 || diffDays >= this.options.daysToShow) {
                console.warn('Date outside of loaded range:', date);
                return false;
            }
            
            const timelineArea = this.container.querySelector('.grp-timeline-area');
            if (!timelineArea) {
                throw new Error('Timeline area not found');
            }
            
            const scrollPosition = diffDays * this.options.cellWidth;
            timelineArea.scrollLeft = scrollPosition;
            
            this.emit('scrolledToDate', {
                date: targetDate,
                scrollPosition,
                dayIndex: diffDays
            });
            
            return true;
        } catch (error) {
            console.error('Error scrolling to date:', error);
            this.emit('error', { type: 'scrollToDate', error });
            return false;
        }
    }
    
    handleCellClick(e) {
        try {
            const cell = e.target.closest('.grp-timeline-cell');
            if (!cell || e.target.closest('.grp-task')) return;
            
            const resourceIndex = parseInt(cell.dataset.resourceIndex);
            const dayIndex = parseInt(cell.dataset.dayIndex);
            
            if (isNaN(resourceIndex) || isNaN(dayIndex)) {
                throw new Error('Invalid cell data');
            }
            
            const cellData = {
                resourceIndex: resourceIndex,
                dayIndex: dayIndex,
                date: cell.dataset.date,
                resource: this.resources[resourceIndex]
            };
            
            // Emit event for external modal systems
            this.emit('cellClicked', cellData);
            
            // Use built-in modal if enabled and action is set to single click
            if (this.options.useBuiltInModal && this.options.cellClickAction === 'single') {
                this.openTaskModal(e);
            }
        } catch (error) {
            console.error('Error handling cell click:', error);
            this.emit('error', { type: 'cellClick', error });
        }
    }
    
    handleCellDoubleClick(e) {
        try {
            const cell = e.target.closest('.grp-timeline-cell');
            if (!cell || e.target.closest('.grp-task')) return;
            
            const resourceIndex = parseInt(cell.dataset.resourceIndex);
            const dayIndex = parseInt(cell.dataset.dayIndex);
            
            if (isNaN(resourceIndex) || isNaN(dayIndex)) {
                throw new Error('Invalid cell data');
            }
            
            const cellData = {
                resourceIndex: resourceIndex,
                dayIndex: dayIndex,
                date: cell.dataset.date,
                resource: this.resources[resourceIndex]
            };
            
            // Emit event for external modal systems
            this.emit('cellDoubleClicked', cellData);
            
            // Use built-in modal if enabled and action is set to double click
            if (this.options.useBuiltInModal && this.options.cellClickAction === 'double') {
                this.openTaskModal(e);
            }
        } catch (error) {
            console.error('Error handling cell double click:', error);
            this.emit('error', { type: 'cellDoubleClick', error });
        }
    }
    
    handleTaskDoubleClick(taskId) {
        try {
            const task = this.getTask(taskId);
            if (!task) return;
            
            // Emit event for external modal systems
            this.emit('taskDoubleClicked', task);
            
            // Use built-in modal if enabled
            if (this.options.useBuiltInModal) {
                this.editTask(taskId);
            }
        } catch (error) {
            console.error('Error handling task double click:', error);
            this.emit('error', { type: 'taskDoubleClick', error });
        }
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResourceScheduler;
} else if (typeof define === 'function' && define.amd) {
    define([], function() {
        return ResourceScheduler;
    });
} else if (typeof window !== 'undefined') {
    window.ResourceScheduler = ResourceScheduler;
}