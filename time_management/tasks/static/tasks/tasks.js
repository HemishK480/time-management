document.addEventListener('DOMContentLoaded', function() {

    // By default, load assignments
    fetchAssignments(); 

    document.querySelectorAll(".new-task").forEach(function(new_button) {
        new_button.addEventListener('click', function() {
            let new_task_div = document.getElementById("taskModal");
            new_task_div.classList.add("show");
            
            const status = this.getAttribute("data-status"); 
    
            document.getElementById("status-selector").value = status;
            document.getElementById("task-title").value = "";
            document.getElementById("due-date").value = "";
            document.getElementById("task-description").value = "";

            displayNewTaskModal()
        })
    })
    
    
});

function fetchAssignments() {
    // Fetch assignments from backend
    fetch(`/fetch-assignments`)
    .then(response => response.json())
    .then(data => {
        const assignments = data.assignments; 
        console.log(assignments)

        assignments.forEach(assignment => {
            // Create a div, add class and draggable, as well as status and id
            const div = document.createElement('div');
            div.setAttribute("class", "task-card");
            div.setAttribute("draggable", "true");  
            div.setAttribute("data-id", assignment["id"])
            div.setAttribute("data-status", assignment["status"])

            // Create and append title and due date
            const title = document.createElement("h4");
            title.innerHTML = assignment["title"];


            const duedate = document.createElement("small");
            duedate.innerHTML = `Due: ${assignment["due_date"]}`;

            div.append(title, duedate);
            
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
        updateTask(currentTaskId, title, description, dueDate, status)
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
    fetch(`/edit_assignment/${taskId}/`)
    .then(response => response.json())
    .then(data => {

        document.getElementById("task-title").value = data.title;
        document.getElementById("task-description").value = data.description;
        document.getElementById("due-date").value = data.due_date;
        document.getElementById("status-selector").value = data.status;

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

        // Checks if there is enough data to create new task
        if (!title || !dueDate ){
            console.log("Title or Due Date is missing. Skipping the update.");
            return;
        } else {
            // Checks which use case and updates accordingly
            if (use === 'edit'){
                updateTask(taskId, title, description, dueDate, status)
            } else if (use === 'new') {
                newTask(title, description, dueDate, status)
            }
        }
    }


}

function updateTask(taskId, title, description, dueDate, status) {
    // Gets the id of the task and the status
    const taskDiv = document.querySelector(`div[data-id="${taskId}"]`);
    const currentStatus = taskDiv.getAttribute('data-status'); 

    // Changes the task card details based on update
    taskDiv.querySelector('h4').innerHTML = title;
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

    // Updates the task in the backend
    return fetch(`/edit_assignment/${taskId}/`, {  
        method: "PUT",  
        body: JSON.stringify({ 
            title: title,
            description: description,
            due_date: dueDate,
            status: status
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

function newTask(title, description, dueDate, status) {
    // Creates a new task card
    const div = document.createElement('div');

    // Adds new task to backend
    fetch("/", {
        method: "POST",
        headers: {
            "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            title: title,
            description: description,
            due_date: dueDate,
            status: status
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            console.log("Task added")
            div.setAttribute("data-id", data.task_id)
        }
    })

    // Sets attributes and adds the task card to the necessary column
    div.setAttribute("class", "task-card");
    div.setAttribute("draggable", "true");  
    
    div.setAttribute("data-status", status)

    const title_container = document.createElement("h4");
    title_container.innerHTML = title;


    const duedate = document.createElement("small");
    duedate.innerHTML = `Due: ${dueDate}`;

    div.append(title_container, duedate);
    
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

