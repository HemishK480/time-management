document.addEventListener('DOMContentLoaded', function() {
    var modal = document.querySelector(".managebac-modal");
    var btn = document.querySelector("#managebac-button");
    var span = document.getElementsByClassName("close")[0];

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

    document.getElementById('managebac-form').addEventListener('submit', function(event) {
        event.preventDefault(); 
        
        fetchTasks((tasks) => {
            renderTasks(tasks.upcoming, 'upcomingList');
            renderTasks(tasks.completed, 'completedList');
            showModal('tasksModal');
        });
        
        // Retrieve input values
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        console.log("Username:", username);
        console.log("Password:", password);
        fetch('/managebac/', {
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
        modal.style.display = "none";
    })

    document.getElementById('loadMoreUpcoming').addEventListener('click', function() {
        // Replace with API call to fetch more upcoming tasks
        renderTasks([{ id: 4, title: 'Upcoming Task 4' }], 'upcomingList');
    });
    document.getElementById('loadMoreCompleted').addEventListener('click', function() {
        // Replace with API call to fetch more completed tasks
        renderTasks([{ id: 103, title: 'Completed Task 3' }], 'completedList');
    });
    
    document.getElementById('upcomingList').addEventListener('scroll', function() {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight) {
          console.log('Scroll reached end of upcoming tasks - load more if available.');
          // Insert API call to load more upcoming tasks here
        }
    });
    document.getElementById('completedList').addEventListener('scroll', function() {
        if (this.scrollTop + this.clientHeight >= this.scrollHeight) {
            console.log('Scroll reached end of completed tasks - load more if available.');
            // Insert API call to load more completed tasks here
        }
    });

});

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}
  
function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function fetchTasks(callback) {
    showModal('loadingModal');
    setTimeout(() => {
      const tasks = {
        upcoming: [
          { id: 1, title: 'Upcoming Task 1' },
          { id: 2, title: 'Upcoming Task 2' },
          { id: 3, title: 'Upcoming Task 3' }
        ],
        completed: [
          { id: 101, title: 'Completed Task 1' },
          { id: 102, title: 'Completed Task 2' }
        ]
      };
      hideModal('loadingModal');
      callback(tasks);
    }, 2000);
}

function renderTasks(tasks, containerId) {
    const container = document.getElementById(containerId);
    tasks.forEach(task => {
      const taskDiv = document.createElement('div');
      taskDiv.className = 'task-item';
      taskDiv.textContent = task.title;
      container.appendChild(taskDiv);
    });
}



