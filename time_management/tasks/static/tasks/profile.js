document.addEventListener('DOMContentLoaded', function() {
    const modal = document.querySelector(".managebac-modal");
    const btn = document.querySelector("#managebac-button");
    const span = document.getElementsByClassName("close")[0];

    // Open the modal when the button is clicked
    btn.onclick = function() {
        modal.style.display = "block";
    }

    // Close the modal when the 'x' is clicked
    span.onclick = function() {
        modal.style.display = "none";
    }

    // Close the modal when clicking outside of the modal content
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }    

    upcomingPage = 1;
    completedPage = 1;
    let username; 
    let password; 

    document.getElementById('managebac-form').addEventListener('submit', async function(event) {
        event.preventDefault(); 
        
        // fetchTasks((tasks) => {
        //     renderTasks(tasks.upcoming, 'upcomingList');
        //     renderTasks(tasks.completed, 'completedList');
        //     showModal('tasksModal');
        // });

        
        // Retrieve input values
        username = document.getElementById('username').value;
        password = document.getElementById('password').value;
          
        showModal('loadingModal'); 

        const upcomingPromise1 = fetchTasks(upcomingPage, "upcoming", username, password);
        const upcomingPromise2 = fetchTasks(upcomingPage + 1, "upcoming", username, password);
        const completedPromise1 = fetchTasks(completedPage, "completed", username, password);
        const completedPromise2 = fetchTasks(completedPage + 1, "completed", username, password);

        upcomingPage += 2;
        completedPage += 2;

        await Promise.all([
            upcomingPromise1,
            upcomingPromise2,
            completedPromise1,
            completedPromise2,
        ]);

        hideModal('loadingModal');
        showModal('tasksModal');

        console.log("Username:", username);
        console.log("Password:", password);
        
        modal.style.display = "none";
    })
    
    const upcomingList = document.getElementById('upcomingList');
    const completedList = document.getElementById('completedList')

    let isLoadingUpcoming = false;
    let isLoadingCompleted = false;


    upcomingList.addEventListener('scroll', async function() {
        const scrollHeight = this.scrollHeight;
        const scrollTop = this.scrollTop;
        const clientHeight = this.clientHeight;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        
        if (distanceFromBottom < 40 && !isLoadingUpcoming) {
            isLoadingUpcoming = true;

            const taskDiv = document.createElement('div');
            taskDiv.className = 'loading-tasks';

            taskDiv.innerHTML = "Loading..."
            document.getElementById("upcomingList").appendChild(taskDiv);

            await fetchTasks(upcomingPage, "upcoming", username, password) 
            upcomingPage += 1;
            isLoadingUpcoming = false;
        }
        
    });
    completedList.addEventListener('scroll', async function() {
        const scrollHeight = this.scrollHeight;
        const scrollTop = this.scrollTop;
        const clientHeight = this.clientHeight;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        
        if (distanceFromBottom < 40 && !isLoadingCompleted) {
            isLoadingCompleted = true;

            const taskDiv = document.createElement('div');
            taskDiv.className = 'loading-tasks';

            taskDiv.innerHTML = "Loading..."
            document.getElementById("completedList").appendChild(taskDiv);

            await fetchTasks(completedPage, "completed", username, password) 

            document.getElementById("completedList").removeChild(taskDiv)
            completedPage += 1;
            isLoadingCompleted = false;
        }

    });

});

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}
  
function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function fetchTasks(page_num, type, username, password) {
    return fetch(`/managebac/${page_num}/${type}`, {
        method: "PUT",
        body: JSON.stringify({
            username: username,
            password: password
        }),
        headers: {
            "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            "Content-Type": "application/json",
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
    
        const listOfTasks = data.managebacTasks.tasks;
        console.log(listOfTasks)
        
        if (type == "upcoming") {
            renderTasks(listOfTasks, 'upcomingList')
        } else if (type == "completed") {
            renderTasks(listOfTasks, 'completedList')
        }
    })
}

function renderTasks(tasks, containerId) {
    const container = document.getElementById(containerId);
    tasks.sort((a, b) => {
        const [dayA, monthA] = a["due-date"].split("/").map(Number);
        const [dayB, monthB] = b["due-date"].split("/").map(Number);
        
        const academicMonthA = monthA < 9 ? monthA + 12 : monthA;
        const academicMonthB = monthB < 9 ? monthB + 12 : monthB;
        
        if (academicMonthA !== academicMonthB) {
            return academicMonthB - academicMonthA;  
        }
        
        return dayB - dayA;
    });

    tasks.forEach(task => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';


        const taskName = document.createElement('span');
        taskName.innerHTML = task.title;
        taskName.className = 'task-name';

        const taskDescription = document.createElement('span');

        function getTruncatedDescription(description, maxChars) {
            if (description.length > maxChars) {
                return description.slice(0, maxChars) + '...';
            }
            return description;
        }
        
          
        taskDescription.innerHTML = getTruncatedDescription(task.description, 40);
        taskDescription.title = task.description;
        taskDescription.style.cssText = 'margin-left: 40px';

        const taskDate = document.createElement('span');
        taskDate.innerHTML = task["due-date"];
        taskDate.style.cssText = 'margin-left: auto;'

        taskDiv.append(taskName, taskDescription, taskDate)

        taskDiv.addEventListener('click', function() {
            taskDiv.classList.toggle('selected');
        });
        container.appendChild(taskDiv);
    });
}



