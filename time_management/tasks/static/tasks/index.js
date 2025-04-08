// Stopwatch functionality
let elapsedTime = 0; // Time in seconds
let timerInterval;
let isPaused = true;

let taskSelected = false;
// Store the current task ID for subtask creation
let currentTaskId = null;
// Store the current event listener function
let currentSubtaskListener = null;

// Add a flag to track when tasks are being generated
let isGeneratingTasks = false;

document.addEventListener('DOMContentLoaded', function() {    
    const timerDisplay = document.querySelector('.timer');
    const pauseBtn = document.querySelector('.pause-btn');
    const hoursInput = document.getElementById('hoursInput');
    const minutesInput = document.getElementById('minutesInput');
    const saveTimeBtn = document.getElementById('saveTimeBtn');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const timeDisplay = document.querySelector('.time-display');
    const timeText = document.querySelector('.time-text');
    const timeInputContainer = document.querySelector('.time-input-container');
    let totalMinutes = 0;
    let isEditing = false;

    // Create reset button
    const resetBtn = document.createElement('button');
    resetBtn.classList.add('reset-btn');
    resetBtn.textContent = 'Reset';
    resetBtn.style.cssText = `
        background-color: var(--dark-brown);
        color: white;
        border: none;
        padding: 0.5rem 2rem;
        border-radius: 0.5rem;
        cursor: pointer;
        display: block;
        margin: 1rem auto;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
    `;
    pauseBtn.parentNode.insertBefore(resetBtn, pauseBtn.nextSibling);

    // Load saved time values
    const savedHours = localStorage.getItem('availableHours');
    const savedMinutes = localStorage.getItem('availableMinutes');
    const savedTotalMinutes = localStorage.getItem('availableTotalMinutes');
    
    // If there is saved time, load it
    if (savedHours && savedMinutes) {
        hoursInput.value = savedHours;
        minutesInput.value = savedMinutes;
        totalMinutes = parseInt(savedTotalMinutes);
        updateTimeDisplay(parseInt(savedHours), parseInt(savedMinutes));
        
        // Load cached tasks if they exist
        const cachedTasks = localStorage.getItem('cachedTasks');
        if (cachedTasks) {
            const tasks = JSON.parse(cachedTasks);
            displayTasks(tasks);
            addTaskBtn.disabled = true;
            addTaskBtn.innerHTML = 'Tasks already generated';
            addTaskBtn.style.cursor = 'not-allowed';
        } else {
            addTaskBtn.disabled = false;
            addTaskBtn.innerHTML = '+ Add Tasks';
            addTaskBtn.style.cursor = 'pointer';
        }
    }
    
    function updateTimer() {
        const hours = Math.floor(elapsedTime / 3600);
        const minutes = Math.floor((elapsedTime % 3600) / 60);
        const seconds = elapsedTime % 60;
        timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function toggleTimer() {
        if (isPaused) {
            timerInterval = setInterval(() => {
                elapsedTime++;
                updateTimer();
            }, 1000);
            pauseBtn.textContent = 'Pause';
        } else {
            clearInterval(timerInterval);
            pauseBtn.textContent = 'Start';
        }
        isPaused = !isPaused;
    }

    function resetTimer() {
        clearInterval(timerInterval);
        elapsedTime = 0;
        updateTimer();
        isPaused = true;
        pauseBtn.textContent = 'Start';
    }

    function updateTimeDisplay(hours, minutes) {
        timeText.textContent = `${hours} hours ${minutes} minutes`;
    }

    function toggleEditMode() {
        isEditing = !isEditing;
        timeDisplay.classList.toggle('editing');
        timeInputContainer.classList.toggle('show');
        
        if (isEditing) {
            hoursInput.focus();
        }
    }

    // Add event listeners only if elements exist
    pauseBtn.addEventListener('click', toggleTimer);
    resetBtn.addEventListener('click', resetTimer);

    // Add click event listener to time display
    timeDisplay.addEventListener('click', function(e) {
        if (!e.target.classList.contains('time-input') && !e.target.classList.contains('save-time-btn')) {
            toggleEditMode();
        }
    });

    // Ensure minutes stay in range 0-59
    minutesInput.addEventListener('input', function() {
        if (this.value > 59) this.value = 59;
        if (this.value < 0) this.value = 0;
    });

    // Ensure hours stay in range 0-23
    hoursInput.addEventListener('input', function() {
        if (this.value > 23) this.value = 23;
        if (this.value < 0) this.value = 0;
    });

    // Handle save button
    saveTimeBtn.addEventListener('click', function() {
        const hours = parseInt(hoursInput.value) || 0;
        const minutes = parseInt(minutesInput.value) || 0;
        totalMinutes = (hours * 60) + minutes;
        
        // Save the time values
        localStorage.setItem('availableHours', hours);
        localStorage.setItem('availableMinutes', minutes);
        localStorage.setItem('availableTotalMinutes', totalMinutes);

        // Update the time display
        updateTimeDisplay(hours, minutes);
        
        // Exit edit mode
        toggleEditMode();

        // Clear any existing tasks and restore Add Task button
        clearTasks();

        addTaskBtn.disabled = false;
        addTaskBtn.innerHTML = '+ Add Tasks';
        addTaskBtn.style.cursor = 'pointer';

        // Remove any existing event listeners
        const newAddTaskBtn = addTaskBtn.cloneNode(true);
        addTaskBtn.parentNode.replaceChild(newAddTaskBtn, addTaskBtn);
        
        // Add the event listener to the new button
        newAddTaskBtn.addEventListener('click', () => {
            if (isGeneratingTasks) return;
            
            isGeneratingTasks = true;
            newAddTaskBtn.disabled = true;
            newAddTaskBtn.innerHTML = 'Generating tasks...';
            newAddTaskBtn.style.cursor = 'not-allowed';
            scheduleTasks(totalMinutes);
        });
    });

    if (totalMinutes > 0 && !localStorage.getItem('cachedTasks')) {
        // Remove any existing event listeners
        const newAddTaskBtn = addTaskBtn.cloneNode(true);
        addTaskBtn.parentNode.replaceChild(newAddTaskBtn, addTaskBtn);
        
        // Add the event listener to the new button
        newAddTaskBtn.addEventListener('click', () => {
            if (isGeneratingTasks) return; // Don't process if already generating
            
            isGeneratingTasks = true;
            newAddTaskBtn.disabled = true;
            newAddTaskBtn.innerHTML = 'Generating tasks...';
            newAddTaskBtn.style.cursor = 'not-allowed';
            scheduleTasks(totalMinutes);
        });
    } else {
        addTaskBtn.disabled = true;
        addTaskBtn.innerHTML = 'Add time to generate tasks';
        addTaskBtn.style.cursor = 'not-allowed';
    }

});

// Function to clear tasks and restore Add Task button
function clearTasks() {
    const tasksSidebar = document.querySelector('.tasks-sidebar');
    
    // Remove all task cards with fade out effect
    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach(card => {
        card.style.transition = "opacity 0.3s ease";
        card.style.opacity = "0";
    });
    
    // Wait for the fade out to complete before removing
    delay(300).then(() => {
        taskCards.forEach(card => {
            tasksSidebar.removeChild(card);
        });
        
        // Create and add the Add Task button with fade in effect
        if (document.querySelector('.add-task-btn')) {
            document.querySelector('.add-task-btn').remove();
        }
        const addTaskBtn = document.createElement('div');
        addTaskBtn.classList.add('add-task-btn');
        addTaskBtn.innerHTML = '+ Add Tasks';
        addTaskBtn.style.cursor = 'pointer';
        addTaskBtn.disabled = false;
        addTaskBtn.style.opacity = "0";
        
        tasksSidebar.appendChild(addTaskBtn);
        
        // Fade in the button
        setTimeout(() => {
            addTaskBtn.style.transition = "opacity 0.3s ease";
            addTaskBtn.style.opacity = "1";
        }, 50);
        
        // Add event listener to the new Add Task button
        addTaskBtn.addEventListener('click', () => {
            addTaskBtn.style.transition = "all 0.3s ease";
            addTaskBtn.disabled = true;
            addTaskBtn.innerHTML = 'Generating tasks...';
            addTaskBtn.style.cursor = 'not-allowed';
            addTaskBtn.style.opacity = "0.7";
            
            // Get the total minutes from localStorage
            const totalMinutes = parseInt(localStorage.getItem('availableTotalMinutes')) || 0;
            if (totalMinutes > 0) {
                scheduleTasks(totalMinutes);
            }
        });
    });
    
    // Clear cached tasks from localStorage
    localStorage.removeItem('cachedTasks');
    
    // Reset task header with fade effect - only the title text
    const taskHeader = document.getElementById('task-header');
    const titleSpan = taskHeader.querySelector('.task-title-text');
    
    titleSpan.style.transition = "opacity 0.3s ease";
    titleSpan.style.opacity = "0";
    
    delay(300).then(() => {
        titleSpan.innerHTML = 'Choose a task to create subtasks';
        titleSpan.style.opacity = "1";
    });
    
    // Reset subtask button with transition
    const addSubtaskBtn = document.getElementById('addSubtaskBtn');
    if (addSubtaskBtn) {
        addSubtaskBtn.style.transition = "all 0.3s ease";
        addSubtaskBtn.disabled = true;
        addSubtaskBtn.innerHTML = 'Select task to create subtasks';
        addSubtaskBtn.style.cursor = 'not-allowed';
        addSubtaskBtn.style.opacity = "0.6";
        
        // Remove any existing event listener
        if (currentSubtaskListener) {
            addSubtaskBtn.removeEventListener('click', currentSubtaskListener);
            currentSubtaskListener = null;
        }
    }
    
    // Reset current task ID
    currentTaskId = null;
}

// Display the tasks
function displayTasks(tasks) {
    const tasksSidebar = document.querySelector('.tasks-sidebar');
    const addTaskBtn = document.querySelector('.add-task-btn');
    
    if (addTaskBtn) {
        tasksSidebar.removeChild(addTaskBtn);
    }

    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.classList.add('task-card');
        
        // Create title
        const titleElement = document.createElement('h4');
        titleElement.textContent = task.task_title;
        
        // Create time label
        const timeLabel = document.createElement('span');
        timeLabel.textContent = `${task.estimated_minutes} minutes`;
        timeLabel.classList.add('time-label');
        
        // Create complete button
        const completeButton = document.createElement('button');
        completeButton.classList.add('complete-task-btn');
        completeButton.textContent = 'Complete Task';
        completeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent task selection when clicking the button
            updateTaskStatus(task.task_id, 'completed');
            taskCard.remove(); // Remove the task card from the sidebar
        });
        
        // Add elements to card
        taskCard.appendChild(titleElement);
        taskCard.appendChild(timeLabel);
        taskCard.appendChild(completeButton);
        
        taskCard.addEventListener('click', () => {
            if (taskCard.classList.contains('selected')) {
                // Deselect the task with transition
                taskCard.style.transition = "all 0.3s ease";
                taskCard.classList.remove('selected');
                
                // Only transition the title text, not the entire container
                const taskHeader = document.getElementById('task-header');
                const titleSpan = taskHeader.querySelector('.task-title-text');
                
                // Fade out just the title text
                titleSpan.style.transition = "opacity 0.3s ease";
                titleSpan.style.opacity = "0";
                
                // Wait for the fade out to complete
                delay(300).then(() => {
                    titleSpan.innerHTML = 'Choose a task to create subtasks';
                    titleSpan.style.opacity = "1";
                });
                
                taskSelected = false;            
                
                // Reset current task ID
                currentTaskId = null;
                
            } else {
                // Deselect all other task cards first
                document.querySelectorAll('.task-card').forEach(card => {
                    if (card !== taskCard) {
                        card.style.transition = "all 0.3s ease";
                        card.classList.remove('selected');
                    }
                });
                
                // Select this task card
                taskCard.style.transition = "all 0.3s ease";
                taskCard.classList.add('selected');
                
                // Update task header with fade effect
                const taskHeader = document.getElementById('task-header');
                const titleSpan = taskHeader.querySelector('.task-title-text');
                
                // Fade out current text
                titleSpan.style.transition = "opacity 0.3s ease";
                titleSpan.style.opacity = "0";
                
                // Wait for fade out, then update text and fade in
                delay(300).then(() => {
                    titleSpan.innerHTML = task.task_title;
                    titleSpan.style.opacity = "1";
                });
                
                taskSelected = true;
                
                // Store the current task ID
                currentTaskId = task.task_id;

            }
        });
        tasksSidebar.appendChild(taskCard);
    });
}

// Schedule the tasks
function scheduleTasks(totalMinutes) {
    // If already generating tasks, return immediately
    if (isGeneratingTasks) return;

    const loadingPhrases = [
        "Generating tasks.",
        "Generating tasks..",
        "Generating tasks...",
        "Generating tasks"
    ];
    let phraseIndex = 0;
    const addTaskBtn = document.querySelector('.add-task-btn');
    
    // Set the generating flag and disable button immediately
    isGeneratingTasks = true;
    addTaskBtn.disabled = true;
    addTaskBtn.style.opacity = "0.6";
    addTaskBtn.style.cursor = 'not-allowed';
    addTaskBtn.textContent = loadingPhrases[0]; 
    
    const loadingIntervalId = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % loadingPhrases.length; 
        addTaskBtn.textContent = loadingPhrases[phraseIndex];
    }, 500); 

    fetch('/schedule-tasks/', {
        method: 'POST',
        headers: {
            "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ totalMinutes })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log(data);
        const tasks = data.scheduled_tasks;
        
        // Cache the tasks
        localStorage.setItem('cachedTasks', JSON.stringify(tasks));
        
        // Display the tasks
        displayTasks(tasks);
        
        clearInterval(loadingIntervalId);
        isGeneratingTasks = false; // Reset the flag
    })
    .catch(error => {
        console.error('Error:', error);
        clearInterval(loadingIntervalId);
        
        // Re-enable the button if there's an error
        addTaskBtn.disabled = false;
        addTaskBtn.style.opacity = "1";
        addTaskBtn.style.cursor = 'pointer';
        addTaskBtn.textContent = '+ Add Tasks';
        isGeneratingTasks = false; // Reset the flag
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateTaskStatus(taskId, status) {
    fetch(`/update-task-status/${taskId}/`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify({ status: status })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Task status updated:', data);
    })
    .catch(error => {
        console.error('Error updating task status:', error);
    });
}









