// Pomodoro Timer functionality
let time = 25 * 60; // 25 minutes in seconds
let timerInterval;
let isPaused = true;

let taskSelected = false;
// Store the current task ID for subtask creation
let currentTaskId = null;
// Store the current event listener function
let currentSubtaskListener = null;

document.addEventListener('DOMContentLoaded', function() {    
    const timerDisplay = document.querySelector('.timer');
    const pauseBtn = document.querySelector('.pause-btn');
    const hoursInput = document.getElementById('hoursInput');
    const minutesInput = document.getElementById('minutesInput');
    const saveTimeBtn = document.getElementById('saveTimeBtn');
    const addTaskBtn = document.getElementById('addTaskBtn');
    let totalMinutes = 0;

    // Load saved time values
    const savedHours = localStorage.getItem('availableHours');
    const savedMinutes = localStorage.getItem('availableMinutes');
    const savedTotalMinutes = localStorage.getItem('availableTotalMinutes');
    
    // If there is saved time, load it
    if (savedHours && savedMinutes) {
        hoursInput.value = savedHours;
        minutesInput.value = savedMinutes;
        totalMinutes = parseInt(savedTotalMinutes);
        
        // Load cached tasks if they exist
        const cachedTasks = localStorage.getItem('cachedTasks');
        // If there are cached tasks, display them
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
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function toggleTimer() {
        if (isPaused) {
            timerInterval = setInterval(() => {
                time--;
                updateTimer();
                if (time === 0) {
                    clearInterval(timerInterval);
                    alert('Time is up!');
                }
            }, 1000);
            pauseBtn.textContent = 'Pause';
        } else {
            clearInterval(timerInterval);
            pauseBtn.textContent = 'Start';
        }
        isPaused = !isPaused;
    }

    // Add event listeners only if elements exist
    pauseBtn.addEventListener('click', toggleTimer);

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

        // Clear any existing tasks and restore Add Task button
        clearTasks();

        addTaskBtn.disabled = false;
        addTaskBtn.innerHTML = '+ Add Tasks';
        addTaskBtn.style.cursor = 'pointer';

        addTaskBtn.addEventListener('click', () => {
            addTaskBtn.disabled = true;
            addTaskBtn.innerHTML = 'Generating tasks...';
            addTaskBtn.style.cursor = 'not-allowed';
            scheduleTasks(totalMinutes)
        });
    });

    if (totalMinutes > 0 && !localStorage.getItem('cachedTasks')) {
        addTaskBtn.addEventListener('click', () => {
            addTaskBtn.disabled = true;
            addTaskBtn.innerHTML = 'Generating tasks...';
            addTaskBtn.style.cursor = 'not-allowed';
            scheduleTasks(totalMinutes)
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
    
    // Remove all task cards
    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach(card => {
        tasksSidebar.removeChild(card);
    });
    
    // Create and add the Add Task button
    if (document.querySelector('.add-task-btn')) {
        document.querySelector('.add-task-btn').remove();
    }
    const addTaskBtn = document.createElement('div');
    addTaskBtn.classList.add('add-task-btn');
    addTaskBtn.innerHTML = '+ Add Tasks';
    addTaskBtn.style.cursor = 'pointer';
    addTaskBtn.disabled = false;
    
    // Add event listener to the new Add Task button
    addTaskBtn.addEventListener('click', () => {
        addTaskBtn.disabled = true;
        addTaskBtn.innerHTML = 'Generating tasks...';
        addTaskBtn.style.cursor = 'not-allowed';
        
        // Get the total minutes from localStorage
        const totalMinutes = parseInt(localStorage.getItem('availableTotalMinutes')) || 0;
        if (totalMinutes > 0) {
            scheduleTasks(totalMinutes);
        }
    });
    
    tasksSidebar.appendChild(addTaskBtn);
    
    // Clear cached tasks from localStorage
    localStorage.removeItem('cachedTasks');
    
    // Reset task header
    document.getElementById('task-header').innerHTML = 'Choose a task to create subtasks';
    
    // Reset subtask button
    const addSubtaskBtn = document.getElementById('addSubtaskBtn');
    if (addSubtaskBtn) {
        addSubtaskBtn.disabled = true;
        addSubtaskBtn.innerHTML = 'Select task to create subtasks';
        addSubtaskBtn.style.cursor = 'not-allowed';
        
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
    
    // Remove the add task button if it exists
    if (addTaskBtn) {
        tasksSidebar.removeChild(addTaskBtn);
    }

    // Create the task cards
    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.classList.add('task-card');
        taskCard.innerHTML = `
            <h4>${task.task_title}</h4>
            <p>${task.estimated_minutes} minutes</p>
        `;
        let addSubtaskBtn = document.getElementById('addSubtaskBtn');
        taskCard.addEventListener('click', () => {
            if (taskCard.classList.contains('selected')) {
                taskCard.classList.remove('selected');
                document.getElementById('task-header').innerHTML = 'Choose a task to create subtasks';
                taskSelected = false;
                
                addSubtaskBtn.disabled = true;
                addSubtaskBtn.innerHTML = 'Select task to create subtasks';
                addSubtaskBtn.style.cursor = 'not-allowed';
                
                // Remove the event listener if it exists
                if (currentSubtaskListener) {
                    addSubtaskBtn.removeEventListener('click', currentSubtaskListener);
                    currentSubtaskListener = null;
                }
                
                // Reset current task ID
                currentTaskId = null;
            } else {
                taskCard.classList.add('selected');
                document.getElementById('task-header').innerHTML = task.task_title;
                taskSelected = true;
                addSubtaskBtn.disabled = false;
                addSubtaskBtn.innerHTML = '+ Add Subtasks';
                addSubtaskBtn.style.cursor = 'pointer';
                
                // Store the current task ID
                currentTaskId = task.task_id;
                
                // Create a named function for the event listener
                const subtaskListener = function() {
                    createSubtasks(currentTaskId);
                };
                
                // Store the listener function for later removal
                currentSubtaskListener = subtaskListener;
                
                // Add the event listener
                addSubtaskBtn.addEventListener('click', subtaskListener);
            }

            document.querySelectorAll('.task-card').forEach(card => {
                if (card !== taskCard) {
                    card.classList.remove('selected');
                }
            });
        });
        tasksSidebar.appendChild(taskCard);
    });
}

// Schedule the tasks
function scheduleTasks(totalMinutes) {
    const loadingPhrases = [
        "Generating tasks.",
        "Generating tasks..",
        "Generating tasks...",
        "Generating tasks"
    ];
    let phraseIndex = 0;
    const addTaskBtn = document.querySelector('.add-task-btn');
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
    .then(response => response.json())
    .then(data => {
        console.log(data);
        const tasks = data.scheduled_tasks;
        
        // Cache the tasks
        localStorage.setItem('cachedTasks', JSON.stringify(tasks));
        
        // Display the tasks
        displayTasks(tasks);
        
        clearInterval(loadingIntervalId);
    })
    .catch(error => {
        console.error('Error:', error);
        clearInterval(loadingIntervalId);
    });
}

function createSubtasks(task_id) {
    fetch('/create-subtasks/', {
        method: 'POST',
        headers: {
            "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_id })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}