document.addEventListener('DOMContentLoaded', function() {

    // By default, load tasks
    fetchTasks(); 

    document.querySelectorAll(".new-task").forEach(function(new_button) {
        new_button.addEventListener('click', function(e) {
            // Add focus for ripple effect
            this.focus();
            
            // Add a small delay before showing the modal for better animation
            setTimeout(() => {
                let new_task_div = document.getElementById("taskModal");
                new_task_div.classList.add("show");
                
                const status = this.getAttribute("data-status"); 
        
                document.getElementById("status-selector").value = status;
                document.getElementById("task-title").value = "";
                document.getElementById("due-date").value = "";
                document.getElementById("task-description").value = "";
                document.getElementById("time-estimate").value = "";

                displayNewTaskModal();
            }, 300); // Delay to allow ripple animation to be visible
        });
    });
    
    
});

function getTruncated(words, maxChars) {
    if (words.length > maxChars) {
        return words.slice(0, maxChars) + '...';
    }
    return words;
}

function parseISOtoDuration(durationString) {
    if (!durationString) return "";
    
    // Handle ISO 8601 duration format like "P0DT00H15M00S"
    try {
        // Extract days, hours, minutes, seconds
        const dayMatch = durationString.match(/(\d+)D/);
        const hourMatch = durationString.match(/(\d+)H/);
        const minuteMatch = durationString.match(/(\d+)M/);
        const secondMatch = durationString.match(/(\d+)S/);
        
        const days = dayMatch ? parseInt(dayMatch[1]) : 0;
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
        const seconds = secondMatch ? parseInt(secondMatch[1]) : 0;
        
        let result = "";
        if (days > 0) result += `${days} day${days > 1 ? 's' : ''} `;
        if (hours > 0) result += `${hours} hour${hours > 1 ? 's' : ''} `;
        if (minutes > 0) result += `${minutes} minute${minutes > 1 ? 's' : ''} `;
        if (seconds > 0) result += `${seconds} second${seconds > 1 ? 's' : ''} `;
        
        return result.trim() || "0 minutes";
    } catch (e) {
        console.error("Error parsing duration:", e);
        return durationString; // Return original if parsing fails
    }
}

function parseDurationToISO(durationString) {
    if (!durationString) return 0;
    
    // Parse a human-readable duration string back to total seconds
    const dayRegex = /(\d+)\s*day[s]?/;
    const hourRegex = /(\d+)\s*hour[s]?/;
    const minuteRegex = /(\d+)\s*minute[s]?/;
    const secondRegex = /(\d+)\s*second[s]?/;
    
    const dayMatch = durationString.match(dayRegex);
    const hourMatch = durationString.match(hourRegex);
    const minuteMatch = durationString.match(minuteRegex);
    const secondMatch = durationString.match(secondRegex);
    
    const days = dayMatch ? parseInt(dayMatch[1]) : 0;
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    const seconds = secondMatch ? parseInt(secondMatch[1]) : 0;
    
    // Convert everything to seconds (Django will convert to timedelta)
    const totalSeconds = days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds;
    
    return totalSeconds;
}

function fetchTasks() {
    // Fetch assignments from backend
    fetch(`/fetch-assignments`)
    .then(response => response.json())
    .then(data => {
        const assignments = data.assignments; 

        assignments.forEach(assignment => {
            // Create a div, add class and draggable, as well as status and id
            const div = document.createElement('div');
            div.setAttribute("class", "task-card");
            div.setAttribute("draggable", "true");  
            div.setAttribute("data-id", assignment["id"])
            div.setAttribute("data-status", assignment["status"])

            // Create and append title and due date
            const title = document.createElement("h4");
            title.innerHTML = getTruncated(assignment["title"], 20);
            title.title = assignment["title"];

            const duedate = document.createElement("small");
            duedate.innerHTML = `Due: ${assignment["due_date"]}`;

            // Create delete button
            const deleteButton = document.createElement("button");
            deleteButton.setAttribute("class", "delete-task-btn");
            deleteButton.innerHTML = "×";
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening the task modal
                deleteTask(assignment["id"], div);
            });

            div.append(title, duedate, deleteButton);
            
            // Check which column to put task in depending on status
            if (assignment["status"] === 'not_started') {
                document.querySelector('#todo').append(div);
            } else if (assignment["status"] === 'in_progress') {
                document.querySelector('#in-progress').append(div);
            } else if (assignment["status"] === 'completed') {
                document.querySelector('#done').append(div);
            } else {
                document.querySelector('#no-status').append(div);
            }

            // Add an event listener to check if the task is clicked on
            div.addEventListener('click', () => openTask(assignment['id']));
        })

        let selected = null; 

        // Ability to drag and drop the task cards from one column to another
        document.querySelectorAll(".task-card").forEach(task => {
            task.addEventListener("dragstart", function(e) {
                selected = e.target;
                e.dataTransfer.setDragImage(e.target, 0, 0);            
            });
        });

        document.querySelectorAll(".task-column").forEach(column => {
            column.addEventListener("dragover", function(e) {
                e.preventDefault();
            });

            column.addEventListener("drop", function(e) {
                e.stopPropagation();
                if (selected) {
                    updateTaskStatus(selected.dataset.id, column.dataset.status)
                    column.querySelector(".task-add").appendChild(selected);
                    selected = null;
                }
            });
        });

    })
}

let currentTaskId = null;
let outsideClickHandler = null;

function openTask(taskId) {
    // If there is already an id, and it isn't the id of the clicked task, save it and then fetch new task
    // Otherwise, just fetch the task
    if (currentTaskId && currentTaskId !== taskId) {
        const title = document.getElementById("task-title").value;
        const description = document.getElementById("task-description").value;
        const dueDate = document.getElementById("due-date").value;
        const status = document.getElementById("status-selector").value;
        const timeEstimate = document.getElementById("time-estimate").value;

        updateTask(currentTaskId, title, description, dueDate, status, timeEstimate)
        .then(() => {
            fetchTask(taskId);
        })
    } else {
        fetchTask(taskId)
    }

    // Sets current task id to the one that has been clicked for future needs
    currentTaskId = taskId;
}

function fetchTask(taskId) {
    // Calls for the details of a specific task
    fetch(`/edit-assignment/${taskId}/`)
    .then(response => response.json())
    .then(data => {

        document.getElementById("task-title").value = data.title;
        document.getElementById("task-description").value = data.description;
        document.getElementById("due-date").value = data.due_date;
        document.getElementById("status-selector").value = data.status;
        document.getElementById("time-estimate").value = parseISOtoDuration(data.time_estimate);
    })
    
    // Shows the task modal 
    const taskModal = document.getElementById("taskModal");
    taskModal.classList.add("show");

    // If there is already a click handler, removes it
    if (outsideClickHandler) {
        window.removeEventListener("click", outsideClickHandler);
    }

    outsideClickHandler = function (event) {
        outsideClickListener(event, taskId, "edit");
    };

    // Adds a outside click listener to the window
    setTimeout(() => {
        window.addEventListener("click", outsideClickHandler);
    }, 10);
}

function outsideClickListener(e, taskId, use) {
    // Gets the task modal
    const taskModal = document.getElementById("taskModal");

    // Checks if the click isn't in the modal or another task card
    if (!taskModal.contains(e.target) && !e.target.closest(".task-card")) {
        // Closes the modal
        taskModal.classList.remove("show");
        window.removeEventListener("click", outsideClickHandler);
        
        const title = document.getElementById("task-title").value;
        const description = document.getElementById("task-description").value;
        const dueDate = document.getElementById("due-date").value;
        const status = document.getElementById("status-selector").value;
        const timeEstimate = document.getElementById("time-estimate").value;
        
        // Checks if there is enough data to create new task
        if (!title || !dueDate ){
            console.log("Title or Due Date is missing. Skipping the update.");
            return;
        } else {
            // Checks which use case and updates accordingly
            if (use === 'edit'){
                updateTask(taskId, title, description, dueDate, status, timeEstimate)
            } else if (use === 'new') {
                newTask(title, description, dueDate, status, timeEstimate)
            }
        }
    }


}

function updateTask(taskId, title, description, dueDate, status, timeEstimate) {
    // Gets the id of the task and the status
    const taskDiv = document.querySelector(`div[data-id="${taskId}"]`);
    const currentStatus = taskDiv.getAttribute('data-status'); 

    // Changes the task card details based on update
    taskDiv.querySelector('h4').innerHTML = getTruncated(title, 20);
    taskDiv.querySelector('small').innerHTML = `Due: ${dueDate}`;

    // Checks if the status is equal to the current status, if it isn't, updates the task card
    if (currentStatus !== status) {
        if (status === 'not_started') {
            document.querySelector('#todo').append(taskDiv);
        } else if (status === 'in_progress') {
            document.querySelector('#in-progress').append(taskDiv);
        } else if (status === 'completed') {
            document.querySelector('#done').append(taskDiv);
        } else {
            document.querySelector('#no-status').append(taskDiv);
        }

        taskDiv.setAttribute('data-status', status);
    }

    // Convert timeEstimate back to seconds for backend
    const timeEstimateSeconds = parseDurationToISO(timeEstimate);
    console.log("Time estimate in seconds:", timeEstimateSeconds);

    // Updates the task in the backend
    return fetch(`/edit-assignment/${taskId}/`, {  
        method: "PUT",  
        body: JSON.stringify({ 
            title: title,
            description: description,
            due_date: dueDate,
            status: status,
            time_estimate: timeEstimateSeconds
        }),  
        headers: {
            "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            "Content-Type": "application/json",
        },
    })
}

function updateTaskStatus(taskId, status) {
    // Changes task status when put in another column
    fetch(`/update-task-status/${taskId}/`, {  
        method: "PUT",  
        body: JSON.stringify({ status: status }),  
        headers: {
            "Content-Type": "application/json",
        },
    })
    .then(response => response.json())
    .then(data => {
        console.log("Task status updated:", data);
    })
    .catch(error => console.error("Error updating task status:", error));
}

function displayNewTaskModal () {
    // Displays task modal
    const taskModal = document.getElementById("taskModal");
    taskModal.classList.add("show");

    // Outside click handler to close modal
    if (outsideClickHandler) {
        window.removeEventListener("click", outsideClickHandler);
    }

    outsideClickHandler = function (event) {
        outsideClickListener(event, null, "new");
    };

    setTimeout(() => {
        window.addEventListener("click", outsideClickHandler);
    }, 10);
}

function newTask(title, description, dueDate, status, timeEstimate) {
    // Convert timeEstimate back to seconds for backend
    const timeEstimateSeconds = parseDurationToISO(timeEstimate);
    
    // Adds new task to backend
    fetch("/new-task/", {
        method: "POST",
        headers: {
            "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            title: title,
            description: description,
            due_date: dueDate,
            status: status,
            time_estimate: timeEstimateSeconds
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            // Creates a new task card
            const div = document.createElement('div');
            
            // Sets attributes and adds the task card to the necessary column
            div.setAttribute("class", "task-card");
            div.setAttribute("draggable", "true");  
            div.setAttribute("data-id", data.task_id);
            div.setAttribute("data-status", status)

            const title_container = document.createElement("h4");
            title_container.innerHTML = title;


            const duedate = document.createElement("small");
            duedate.innerHTML = `Due: ${dueDate}`;

            // Create delete button
            const deleteButton = document.createElement("button");
            deleteButton.setAttribute("class", "delete-task-btn");
            deleteButton.innerHTML = "×";
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening the task modal
                deleteTask(data.task_id, div);
            });

            div.append(title_container, duedate, deleteButton);
            
            if (status === 'not_started') {
                document.querySelector('#todo').append(div);
            } else if (status === 'in_progress') {
                document.querySelector('#in-progress').append(div);
            } else if (status === 'completed') {
                document.querySelector('#done').append(div);
            } else {
                document.querySelector('#no-status').append(div);
            }

            div.addEventListener('click', () => openTask(data.task_id));
        }
    })
}

// Function to delete a task
function deleteTask(taskId, taskElement) {
    fetch(`/delete-task/${taskId}/`, {
        method: "DELETE",
        headers: {
            "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // Remove the task element from the DOM
            taskElement.remove();
            console.log("Task deleted successfully");
        } else {
            console.error("Error deleting task:", data.error);
        }
    })
    .catch(error => {
        console.error("Error deleting task:", error);
    });
    
}

