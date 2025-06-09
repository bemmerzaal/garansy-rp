/**
 * ResourceScheduler - Clean Library Version
 * Exact same UI as original, but with separated data/logic
 */
class ResourceScheduler {
    constructor(container, options = {}) {
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
        this.selectedCell = null;
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
    }
    
    /**
     * Load data into scheduler
     */
    loadData(resources, tasks) {
        this.resources = resources || [];
        this.tasks = tasks || [];
        this.currentTaskId = Math.max(0, ...this.tasks.map(t => t.id || 0));
        this.render();
    }
    
    /**
     * Get current data
     */
    getData() {
        return {
            resources: [...this.resources],
            tasks: [...this.tasks]
        };
    }
    
    /**
     * Event system
     */
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
        return this; // Allow chaining
    }
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }
    
    /**
     * Initialize the scheduler
     */
    init() {
        this.createHTML();
        this.setupEventListeners();
    }
    
    createHTML() {
        this.container.innerHTML = `
            <div class="scheduler-container">
                <div class="scheduler-header">
                    <div class="resource-header">Resources</div>
                    <div class="days-header"></div>
                </div>
                <div class="scheduler-content">
                    <div class="resources-column"></div>
                    <div class="timeline-area">
                        <div class="timeline-grid"></div>
                        ${this.options.infiniteScroll ? '<div class="loading-indicator" style="display: none;">Loading more dates...</div>' : ''}
                    </div>
                </div>
            </div>
            
            <!-- Task Modal -->
            <div id="taskModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="close">&times;</span>
                        <h2>Nieuwe Taak</h2>
                    </div>
                    <form id="taskForm">
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="taskTitle">Titel:</label>
                                <input type="text" id="taskTitle" required>
                            </div>
                            <div class="form-group">
                                <label for="taskDuration">Duur (dagen):</label>
                                <input type="number" id="taskDuration" value="1" min="1" required>
                            </div>
                            <div class="form-group">
                                <label for="taskType">Type:</label>
                                <select id="taskType">
                                    <option value="project">Project</option>
                                    <option value="meeting">Meeting</option>
                                    <option value="vacation">Vakantie</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="scheduler.closeTaskModal()">Annuleren</button>
                            <button type="submit" class="btn btn-primary">Opslaan</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Modal events
        const modal = document.getElementById('taskModal');
        const closeBtn = modal.querySelector('.close');
        const form = document.getElementById('taskForm');
        
        closeBtn.onclick = () => this.closeTaskModal();
        window.onclick = (e) => {
            if (e.target === modal) this.closeTaskModal();
        };
        form.onsubmit = (e) => this.saveTask(e);
        
        // Global mouse events for dragging
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Infinite scroll events
        if (this.options.infiniteScroll) {
            // Add scroll listener to the main container (which now has overflow)
            this.container.addEventListener('scroll', this.handleScroll, { passive: true });
            
            // Also listen for horizontal scroll on timeline area
            const timelineArea = this.container.querySelector('.timeline-area');
            if (timelineArea) {
                timelineArea.addEventListener('scroll', this.handleScroll, { passive: true });
            }
        }
    }
    
    render() {
        this.renderDaysHeader();
        this.renderResources();
        this.renderTimeline();
        this.renderTasks();
    }
    
    renderDaysHeader() {
        const daysHeader = this.container.querySelector('.days-header');
        daysHeader.innerHTML = '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < this.options.daysToShow; i++) {
            const date = new Date(this.currentStartDate);
            date.setDate(date.getDate() + i);
            
            const dayEl = document.createElement('div');
            dayEl.className = 'day-column';
            
            // Add weekend class
            if (date.getDay() === 0 || date.getDay() === 6) {
                dayEl.classList.add('weekend');
            }
            
            // Add today class
            if (date.getTime() === today.getTime()) {
                dayEl.classList.add('today');
            }
            
            dayEl.innerHTML = `
                <div class="day-name">${date.toLocaleDateString('nl-NL', { weekday: 'short' })}</div>
                <div class="day-date">${date.getDate()}/${date.getMonth() + 1}</div>
            `;
            
            daysHeader.appendChild(dayEl);
        }
    }
    
    renderResources() {
        const resourcesColumn = this.container.querySelector('.resources-column');
        resourcesColumn.innerHTML = '';
        
        this.resources.forEach((resource, index) => {
            const resourceEl = document.createElement('div');
            resourceEl.className = 'resource-row';
            resourceEl.dataset.resourceIndex = index;
            resourceEl.textContent = resource.name;
            resourcesColumn.appendChild(resourceEl);
        });
    }
    
    renderTimeline() {
        const timelineGrid = this.container.querySelector('.timeline-grid');
        timelineGrid.innerHTML = '';
        
        this.resources.forEach((resource, resourceIndex) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'timeline-row';
            rowEl.dataset.resourceIndex = resourceIndex;
            
            for (let dayIndex = 0; dayIndex < this.options.daysToShow; dayIndex++) {
                const date = new Date(this.currentStartDate);
                date.setDate(date.getDate() + dayIndex);
                
                const cellEl = document.createElement('div');
                cellEl.className = 'timeline-cell';
                cellEl.dataset.resourceIndex = resourceIndex;
                cellEl.dataset.dayIndex = dayIndex;
                cellEl.dataset.date = date.toISOString().split('T')[0];
                
                // Add weekend class
                if (date.getDay() === 0 || date.getDay() === 6) {
                    cellEl.classList.add('weekend');
                }
                
                // Add today class
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (date.getTime() === today.getTime()) {
                    cellEl.classList.add('today');
                }
                
                cellEl.addEventListener('click', (e) => this.openTaskModal(e));
                rowEl.appendChild(cellEl);
            }
            
            timelineGrid.appendChild(rowEl);
        });
    }
    
    renderTasks() {
        // Remove existing task elements
        this.container.querySelectorAll('.task').forEach(el => el.remove());
        
        // Add all tasks
        this.tasks.forEach(task => this.addSingleTask(task));
        
        this.emit('tasksRendered', this.tasks);
    }
    
    addSingleTask(task) {
        const startDay = this.getTaskStartDayIndex(task);
        if (startDay < 0 || startDay >= this.options.daysToShow) return;
        
        const taskEl = document.createElement('div');
        taskEl.className = `task ${task.type || 'project'}`;
        taskEl.dataset.taskId = task.id;
        taskEl.textContent = task.title;
        taskEl.title = `${task.title} (${task.duration} dagen)`;
        
        // Calculate position
        const width = (task.duration || 1) * this.options.cellWidth;
        const left = startDay * this.options.cellWidth;
        const top = (task.resourceIndex || 0) * this.options.rowHeight;
        
        taskEl.style.cssText = `
            width: ${width}px;
            left: ${left}px;
            top: ${top}px;
        `;
        
        // Add drag functionality
        taskEl.addEventListener('mousedown', (e) => this.startDrag(e));
        
        // Add to timeline area
        const timelineArea = this.container.querySelector('.timeline-area');
        timelineArea.appendChild(taskEl);
        
        console.log('Adding single task - BEFORE create:', {
            id: task.id,
            title: task.title,
            start: task.start,
            startDay: startDay,
            duration: task.duration,
        });
        
        console.log('Added task element to DOM with forced positioning:', {
            id: task.id,
            correctLeft: left,
            taskStartDay: startDay,
            elementLeft: taskEl.style.left,
            elementWidth: taskEl.style.width
        });
    }
    
    getTaskStartDayIndex(task) {
        const [year, month, day] = task.start.split('-').map(Number);
        const taskDate = new Date(year, month - 1, day); // Remove the extra -1 day subtraction
        const diffTime = taskDate.getTime() - this.currentStartDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        console.log('getTaskStartDayIndex (FIXED):', {
            taskId: task.id,
            taskStart: task.start,
            taskDate: taskDate.toISOString().split('T')[0],
            currentStartDate: this.currentStartDate.toISOString().split('T')[0],
            diffTime: diffTime,
            diffDays: diffDays
        });
        
        return diffDays;
    }
    
    getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    
    openTaskModal(e) {
        const cell = e.target.closest('.timeline-cell');
        if (!cell || e.target.closest('.task')) return;
        
        this.selectedCell = {
            resourceIndex: parseInt(cell.dataset.resourceIndex),
            dayIndex: parseInt(cell.dataset.dayIndex),
            date: cell.dataset.date
        };
        
        console.log('Opening modal for cell:', this.selectedCell);
        
        const modal = document.getElementById('taskModal');
        modal.style.display = 'block';
        
        // Reset form
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDuration').value = '1';
        document.getElementById('taskType').value = 'project';
        document.getElementById('taskTitle').focus();
    }
    
    closeTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.selectedCell = null;
    }
    
    saveTask(e) {
        e.preventDefault();
        
        if (!this.selectedCell) return;
        
        const title = document.getElementById('taskTitle').value.trim();
        const duration = parseInt(document.getElementById('taskDuration').value);
        const type = document.getElementById('taskType').value;
        
        if (!title) return;
        
        // Parse cell date exact same way as getTaskStartDayIndex
        const cellElement = document.querySelector(`[data-resource-index="${this.selectedCell.resourceIndex}"][data-day-index="${this.selectedCell.dayIndex}"]`);
        const cellDate = cellElement.dataset.date;
        
        const [year, month, day] = cellDate.split('-').map(Number);
        const startDate = new Date(year, month - 1, day); // Month is 0-based
        
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + duration - 1);
        
        const task = {
            id: ++this.currentTaskId,
            title: title,
            duration: duration,
            resourceIndex: this.selectedCell.resourceIndex,
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            type: type
        };
        
        console.log('Saving new task (DOUBLE FIXED):', {
            task: task,
            selectedCell: this.selectedCell,
            cellDate: cellDate,
            startDateCalculated: startDate.toISOString().split('T')[0],
            shouldMatch: cellDate,
            matches: (startDate.toISOString().split('T')[0] === cellDate)
        });
        
        this.tasks.push(task);
        this.addSingleTask(task);
        this.closeTaskModal();
        
        this.emit('taskAdded', task);
    }
    
    startDrag(e) {
        const taskEl = e.target.closest('.task');
        const task = this.tasks.find(t => t.id == taskEl.dataset.taskId);
        
        if (!task) return;
        
        // Use current DOM position as starting point - NO corrections
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
        
        taskEl.classList.add('dragging');
        e.preventDefault();
        
        this.emit('dragStart', { task, element: taskEl });
    }
    
    handleMouseMove(e) {
        if (!this.dragState) return;
        
        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;
        
        const cellsDeltaX = Math.round(deltaX / this.options.cellWidth);
        const rowsDeltaY = Math.round(deltaY / this.options.rowHeight);
        
        // Update visual position
        const newLeft = (this.dragState.originalStartDay + cellsDeltaX) * this.options.cellWidth;
        const newTop = (this.dragState.originalResourceIndex + rowsDeltaY) * this.options.rowHeight;
        
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
    }
    
    handleMouseUp(e) {
        if (!this.dragState) return;
        
        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;
        
        const cellsDeltaX = Math.round(deltaX / this.options.cellWidth);
        const rowsDeltaY = Math.round(deltaY / this.options.rowHeight);
        
        // Calculate new values
        const newStartDay = Math.max(0, Math.min(this.options.daysToShow - this.dragState.task.duration, this.dragState.originalStartDay + cellsDeltaX));
        const newResourceIndex = Math.max(0, Math.min(this.resources.length - 1, this.dragState.originalResourceIndex + rowsDeltaY));
        
        // Calculate new dates
        const newStartDate = new Date(this.currentStartDate);
        newStartDate.setDate(newStartDate.getDate() + newStartDay);
        
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newStartDate.getDate() + this.dragState.task.duration - 1);
        
        // Update task data
        const oldStart = this.dragState.task.start;
        this.dragState.task.start = newStartDate.toISOString().split('T')[0];
        this.dragState.task.end = newEndDate.toISOString().split('T')[0];
        this.dragState.task.resourceIndex = newResourceIndex;
        
        console.log('Updated task after drag:', {
            id: this.dragState.task.id,
            oldStart: oldStart,
            newStart: this.dragState.task.start,
            newEnd: this.dragState.task.end,
            duration: this.dragState.task.duration,
            resourceIndex: newResourceIndex
        });
        
        // Clean up
        this.dragState.element.classList.remove('dragging');
        
        this.emit('taskMoved', {
            task: this.dragState.task,
            oldStart: oldStart,
            newStart: this.dragState.task.start,
            oldResourceIndex: this.dragState.originalResourceIndex,
            newResourceIndex: newResourceIndex
        });
        
        this.dragState = null;
    }
    
    // Public API Methods
    addTask(task) {
        task.id = task.id || ++this.currentTaskId;
        this.tasks.push(task);
        this.addSingleTask(task);
        this.emit('taskAdded', task);
        return task;
    }
    
    removeTask(taskId) {
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
    }
    
    updateTask(taskId, updates) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            const oldTask = { ...task };
            Object.assign(task, updates);
            
            // Re-render the task
            const taskEl = this.container.querySelector(`[data-task-id="${taskId}"]`);
            if (taskEl) taskEl.remove();
            this.addSingleTask(task);
            
            this.emit('taskUpdated', { task, oldTask });
            return task;
        }
        return null;
    }
    
    getTask(taskId) {
        return this.tasks.find(t => t.id === taskId) || null;
    }
    
    getTasksForResource(resourceIndex) {
        return this.tasks.filter(t => t.resourceIndex === resourceIndex);
    }
    
    getTasksForDate(date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        return this.tasks.filter(task => {
            return dateStr >= task.start && dateStr <= task.end;
        });
    }
    
    setDateRange(startDate, days) {
        this.currentStartDate = this.getMonday(startDate);
        this.options.daysToShow = days || this.options.daysToShow;
        this.render();
        this.emit('dateRangeChanged', {
            startDate: this.currentStartDate,
            endDate: new Date(this.currentStartDate.getTime() + (this.options.daysToShow - 1) * 24 * 60 * 60 * 1000),
            days: this.options.daysToShow
        });
    }
    
    goToToday() {
        this.setDateRange(new Date(), this.options.daysToShow);
    }
    
    goToNextWeek() {
        const nextWeek = new Date(this.currentStartDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        this.setDateRange(nextWeek, this.options.daysToShow);
    }
    
    goToPreviousWeek() {
        const prevWeek = new Date(this.currentStartDate);
        prevWeek.setDate(prevWeek.getDate() - 7);
        this.setDateRange(prevWeek, this.options.daysToShow);
    }
    
    refresh() {
        this.render();
        this.emit('refreshed');
    }
    
    destroy() {
        // Remove event listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        
        // Remove infinite scroll listener
        if (this.options.infiniteScroll) {
            this.container.removeEventListener('scroll', this.handleScroll);
        }
        
        // Remove modal if it exists
        const modal = document.getElementById('taskModal');
        if (modal) modal.remove();
        
        // Clear container
        this.container.innerHTML = '';
        
        // Clear state
        this.dragState = null;
        this.selectedCell = null;
        this.events = {};
        
        this.emit('destroyed');
    }
    
    // Infinite Scroll Methods
    
    /**
     * Handle scroll events for infinite scrolling
     */
    handleScroll() {
        if (!this.options.infiniteScroll || this.isLoading || this.hasReachedEnd) return;
        
        const timelineArea = this.container.querySelector('.timeline-area');
        if (!timelineArea) return;
        
        const scrollLeft = timelineArea.scrollLeft;
        const scrollWidth = timelineArea.scrollWidth;
        const clientWidth = timelineArea.clientWidth;
        
        // Calculate how many days from the right edge
        const daysFromEnd = Math.ceil((scrollWidth - scrollLeft - clientWidth) / this.options.cellWidth);
        
        console.log('Scroll check:', {
            scrollLeft,
            scrollWidth,
            clientWidth,
            daysFromEnd,
            threshold: this.options.loadThreshold
        });
        
        // Load more if we're within threshold
        if (daysFromEnd <= this.options.loadThreshold) {
            this.loadMoreDays();
        }
        
        // Clean up old days if we have too many
        this.cleanupOldDays();
    }
    
    /**
     * Load more days into the timeline
     */
    async loadMoreDays() {
        if (this.isLoading || this.hasReachedEnd) return;
        
        this.isLoading = true;
        console.log('Loading more days...');
        
        // Show loading indicator
        const loadingIndicator = this.container.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        this.emit('loadingStart', {
            currentRange: { ...this.loadedDateRange },
            requestedDays: this.options.chunkDays
        });
        
        try {
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
        if (this.options.daysToShow <= this.options.maxDaysInMemory) return;
        
        const timelineArea = this.container.querySelector('.timeline-area');
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
            const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
            
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
    }
    
    /**
     * Get the current visible date range
     */
    getVisibleDateRange() {
        const timelineArea = this.container.querySelector('.timeline-area');
        if (!timelineArea) return null;
        
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
    }
    
    /**
     * Scroll to a specific date
     */
    scrollToDate(date) {
        const targetDate = new Date(date);
        const diffTime = targetDate.getTime() - this.currentStartDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0 || diffDays >= this.options.daysToShow) {
            console.warn('Date outside of loaded range:', date);
            return false;
        }
        
        const timelineArea = this.container.querySelector('.timeline-area');
        if (!timelineArea) return false;
        
        const scrollPosition = diffDays * this.options.cellWidth;
        timelineArea.scrollLeft = scrollPosition;
        
        this.emit('scrolledToDate', {
            date: targetDate,
            scrollPosition,
            dayIndex: diffDays
        });
        
        return true;
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