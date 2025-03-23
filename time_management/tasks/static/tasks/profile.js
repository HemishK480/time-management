document.addEventListener('DOMContentLoaded', function() {
    const modal = document.querySelector("#loginModal");
    const tasksModal = document.getElementById("tasksModal");
    const btn = document.querySelector("#managebac-button");
    const span = document.getElementsByClassName("close")[0];
    const upcomingList = document.getElementById('upcomingList');
    const completedList = document.getElementById('completedList')
    const managebacForm = document.getElementById('managebac-form');

    let upcomingPage = 1;
    let completedPage = 1;
    let username, password, cookie; 

    let hasMoreUpcoming = true;
    let hasMoreCompleted = true;

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

        console.time('fetching time');

        cookie = await fetchCookie(username, password);
        console.log(cookie);

        const upcomingPromise1 = fetchTasks(upcomingPage, "upcoming", cookie);
        const upcomingPromise2 = fetchTasks(upcomingPage + 1, "upcoming", cookie);
        const completedPromise1 = fetchTasks(completedPage, "completed", cookie);
        const completedPromise2 = fetchTasks(completedPage + 1, "completed", cookie);
        

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

        console.timeEnd('fetching time');
        hideModal('loadingModal');
        showModal('tasksModal');
        
        modal.style.display = "none";
    })

    document.getElementById('managebacSubmit').addEventListener('click', function() {
        tasksModal.style.display = "none";
        const selectedTasks = [];
        document.querySelectorAll('.task-item.selected').forEach(task => {
            selectedTasks.push(task.getAttribute('data-id'));
        })
        upcomingList.innerHTML = "";
        completedList.innerHTML = "";
        fetch(`/managebac/add`, {
            method: "POST",
            body: JSON.stringify({
                selectedTasks: selectedTasks
            }),
            headers: {
                "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                "Content-Type": "application/json",
            }
        })
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

            const additionalTasks = await fetchTasks(upcomingPage, "upcoming", cookie) 
            renderTasks(additionalTasks.tasks, "upcomingList")
            upcomingPage += 1;

            hasMoreUpcoming = additionalTasks.hasMore;

            isLoadingUpcoming = false;
        }
        
    });

    completedList.addEventListener('scroll', async function() {
        const scrollHeight = this.scrollHeight;
        const scrollTop = this.scrollTop;
        const clientHeight = this.clientHeight;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        
        if (distanceFromBottom < 40 && !isLoadingCompleted && hasMoreCompleted) {
            console.time('new task time');
            isLoadingCompleted = true;

            const taskDiv = document.createElement('div');
            taskDiv.className = 'loading-tasks';

            taskDiv.innerHTML = "Loading..."
            document.getElementById("completedList").appendChild(taskDiv);

            const additionalTasks = await fetchTasks(completedPage, "completed", cookie) 
            renderTasks(additionalTasks.tasks, "completedList")

            document.getElementById("completedList").removeChild(taskDiv)
            completedPage += 1;

            hasMoreCompleted = additionalTasks.hasMore;

            isLoadingCompleted = false;
            console.timeEnd('new task time');
        }

    });


});

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}
  
function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function fetchTasks(page_num, type, cookie) {
    return fetch(`/managebac/tasks`, {
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
    })
    .then(response => response.json())
    .then(data => {
        const listOfTasks = data.managebacTasks.tasks;
        console.log(listOfTasks)

        const hasMore = listOfTasks.length > 0 && listOfTasks.length >= 5;
        console.log(hasMore)

        return { 
            page: page_num, 
            tasks: listOfTasks, 
            type: type,
            hasMore: hasMore
        };
    })
    .catch(error => {
        console.error("Error fetching tasks:", error);
    });
}

async function fetchCookie(username, password) {
    return fetch(`/managebac/login`, {
        method: "POST",
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
        return data.cookie;
    })
    .catch(error => {
        console.error("Error fetching cookie:", error);
    });
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

        taskDiv.setAttribute("data-id", task["id"])

        taskDiv.append(taskName, taskDescription, taskDate)

        taskDiv.addEventListener('click', function() {
            taskDiv.classList.toggle('selected');
        });

        fragment.appendChild(taskDiv);

    });

    container.appendChild(fragment);
}



