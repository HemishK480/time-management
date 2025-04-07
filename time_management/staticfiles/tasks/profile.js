document.addEventListener('DOMContentLoaded', function() {
    const modal = document.querySelector("#loginModal");
    const tasksModal = document.getElementById("tasksModal");

    const managebacBtn = document.querySelector("#managebac-button");
    const googleBtn = document.querySelector("#google-button");

    const span = document.getElementsByClassName("close")[0];
    const upcomingList = document.getElementById('upcomingList');
    const completedList = document.getElementById('completedList')
    const managebacForm = document.getElementById('managebac-form');

    let upcomingPage = 1;
    let completedPage = 1;
    let username, password, cookie; 

    let hasMoreUpcoming = true;
    let hasMoreCompleted = true;

    let source;

    // Open the modal when the button is clicked
    managebacBtn.onclick = function() {
        modal.style.display = "block";
        source = "managebac";
    }

    googleBtn.onclick = function() {
        showModal('loadingModal');
        source = "google";
        fetch(`/google/tasks/`, {
            method: "GET",
            headers: {
                "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                "Content-Type": "application/json",
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                hideModal('loadingModal');
                console.error("Error:", data.error);
                return;
            }
                        
            document.getElementById('upcomingList').innerHTML = "";
            document.getElementById('completedList').innerHTML = "";
            
            renderTasks(data.upcoming || [], 'upcomingList');
            renderTasks(data.completed || [], 'completedList');
            
            hideModal('loadingModal');
            showModal('tasksModal');
        })
        .catch(error => {
            hideModal('loadingModal');
            console.error("Error fetching Google tasks:", error);
        });
    }

    // Close the modal when the 'x' is clicked
    span.onclick = function() {
        modal.style.display = "none";
    }

    // Close the modal when clicking outside of the modal content
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        } else if (event.target == tasksModal) {
            tasksModal.style.display = "none";
            upcomingList.innerHTML = "";
            completedList.innerHTML = "";
        }
    }    


    managebacForm.addEventListener('submit', async function(event) {
        event.preventDefault(); 
        hasMoreUpcoming = true;
        hasMoreCompleted = true;
        
        // Retrieve input values
        username = document.getElementById('username').value;
        password = document.getElementById('password').value;
          
        showModal('loadingModal'); 
        upcomingPage = 1;
        completedPage = 1;

        cookie = await fetchManagebacCookie(username, password);

        const upcomingPromise1 = fetchManagebacTasks(upcomingPage, "upcoming", cookie);
        const upcomingPromise2 = fetchManagebacTasks(upcomingPage + 1, "upcoming", cookie);
        const completedPromise1 = fetchManagebacTasks(completedPage, "completed", cookie);
        const completedPromise2 = fetchManagebacTasks(completedPage + 1, "completed", cookie);
        

        const [upcomingResult1, upcomingResult2, completedResult1, completedResult2] =
            await Promise.all([upcomingPromise1, upcomingPromise2, completedPromise1, completedPromise2]);

        const upcomingResults = [upcomingResult1, upcomingResult2].sort((a, b) => a.page - b.page);
        upcomingResults.forEach(result => {
            renderTasks(result.tasks, 'upcomingList');
        });
        upcomingPage += 2;

        const completedResults = [completedResult1, completedResult2].sort((a, b) => a.page - b.page);
        completedResults.forEach(result => {
            renderTasks(result.tasks, 'completedList');
        });
        completedPage += 2;

        hideModal('loadingModal');
        showModal('tasksModal');
        
        modal.style.display = "none";
    })

    document.getElementById('submitTasks').addEventListener('click', function() {
        tasksModal.style.display = "none";
        const selectedTasks = [];
        document.querySelectorAll('.task-item.selected').forEach(task => {
            selectedTasks.push(task.getAttribute('data-id'));
        })

        upcomingList.innerHTML = "";
        completedList.innerHTML = "";

        if (source === "managebac") {
            fetch(`/managebac/add/`, {
                method: "POST",
                body: JSON.stringify({
                    selectedTasks: selectedTasks,
                    cookie: cookie
                }),
                headers: {
                    "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                    "Content-Type": "application/json",
                }
            })
        } else if (source === "google") {
            fetch(`/google/add/`, {
                method: "POST",
                body: JSON.stringify({
                    selectedTasks: selectedTasks
                }),
                headers: {
                    "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                    "Content-Type": "application/json",
                }
            })
        }
    });

    let isLoadingUpcoming = false;
    let isLoadingCompleted = false;

    upcomingList.addEventListener('scroll', async function() {
        const { scrollHeight, scrollTop, clientHeight } = this;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        
        if (distanceFromBottom < 40 && !isLoadingUpcoming && hasMoreUpcoming) {
            isLoadingUpcoming = true;

            const taskDiv = document.createElement('div');
            taskDiv.className = 'loading-tasks';

            taskDiv.innerHTML = "Loading..."
            document.getElementById("upcomingList").appendChild(taskDiv);

            const additionalTasks = await fetchManagebacTasks(upcomingPage, "upcoming", cookie) 
            renderTasks(additionalTasks.tasks, "upcomingList")
            upcomingPage += 1;

            hasMoreUpcoming = additionalTasks.hasMore;

            isLoadingUpcoming = false;
        }
        
    });

    completedList.addEventListener('scroll', async function() {
        const { scrollHeight, scrollTop, clientHeight } = this;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        
        if (distanceFromBottom < 40 && !isLoadingCompleted && hasMoreCompleted) {
            isLoadingCompleted = true;

            const taskDiv = document.createElement('div');
            taskDiv.className = 'loading-tasks';

            taskDiv.innerHTML = "Loading..."
            document.getElementById("completedList").appendChild(taskDiv);

            const additionalTasks = await fetchManagebacTasks(completedPage, "completed", cookie) 
            renderTasks(additionalTasks.tasks, "completedList")

            document.getElementById("completedList").removeChild(taskDiv)
            completedPage += 1;

            hasMoreCompleted = additionalTasks.hasMore;

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

async function fetchManagebacTasks(page_num, type, cookie) {
    try {
        const response = await fetch(`/managebac/tasks/`, {
            method: "POST",
            body: JSON.stringify({
                cookie: cookie,
                page_num: page_num,
                type: type
            }),
            headers: {
                "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                "Content-Type": "application/json",
            }
        });
        const data = await response.json();
        const listOfTasks = data.managebacTasks.tasks;
        const hasMore = listOfTasks.length > 0 && listOfTasks.length >= 5;

        return { 
            page: page_num, 
            tasks: listOfTasks, 
            type: type,
            hasMore: hasMore
        };

    } catch (error) {
        console.error("Error fetching tasks:", error);
    }
}

async function fetchManagebacCookie(username, password) {
    try {
        const response = await fetch(`/managebac/login/`, {
            method: "POST",
            body: JSON.stringify({  
                username: username, 
                password: password 
            }),
            headers: {
                "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                "Content-Type": "application/json",
            }
        });
        const data = await response.json();
        return data.cookie;
    } catch (error) {
        console.error("Error fetching cookie:", error);
    }
}

function renderTasks(tasks, containerId) {
    const container = document.getElementById(containerId);
    
    // Sort tasks - handle different date formats
    tasks.sort((a, b) => {
        let dayA, monthA, dayB, monthB;
        
        // Handle different date formats from ManageBac vs Google Classroom
        if (a["due-date"]) {
            // ManageBac format
            [dayA, monthA] = a["due-date"].split("/").map(Number);
        } else if (a.due_date) {
            // Google Classroom format
            [dayA, monthA] = a.due_date.split("/").map(Number);
        } else {
            // Default to today
            const today = new Date();
            dayA = today.getDate();
            monthA = today.getMonth() + 1;
        }
        
        if (b["due-date"]) {
            // ManageBac format
            [dayB, monthB] = b["due-date"].split("/").map(Number);
        } else if (b.due_date) {
            // Google Classroom format
            [dayB, monthB] = b.due_date.split("/").map(Number);
        } else {
            // Default to today
            const today = new Date();
            dayB = today.getDate();
            monthB = today.getMonth() + 1;
        }
        
        const academicMonthA = monthA < 9 ? monthA + 12 : monthA;
        const academicMonthB = monthB < 9 ? monthB + 12 : monthB;
        
        if (academicMonthA !== academicMonthB) {
            return academicMonthB - academicMonthA;  
        }
        
        return dayB - dayA;
    });

    const fragment = document.createDocumentFragment();

    tasks.forEach(task => {

        function getTruncated(words, maxChars) {
            if (words.length > maxChars) {
                return words.slice(0, maxChars) + '...';
            }
            return words;
        }

        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        taskDiv.setAttribute("data-id", task["id"])
        taskDiv.setAttribute("data-source", "managebac")

        const taskName = document.createElement('span');
        taskName.innerHTML = getTruncated(task.title, 20);
        taskName.title = task.title;
        taskName.className = 'task-name';

        const taskDescription = document.createElement('span');
        taskDescription.innerHTML = getTruncated(task.description, 40);
        taskDescription.title = task.description;
        taskDescription.style.cssText = 'margin-left: 40px';

        const taskDate = document.createElement('span');
        taskDate.innerHTML = task["due-date"];
        taskDate.style.cssText = 'margin-left: auto;'

        taskDiv.append(taskName, taskDescription, taskDate)

        taskDiv.addEventListener('click', function() {
            taskDiv.classList.toggle('selected');
        });

        fragment.appendChild(taskDiv);

    });

    container.appendChild(fragment);
}




