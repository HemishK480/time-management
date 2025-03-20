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
});