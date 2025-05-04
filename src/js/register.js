document.getElementById("registerForm").addEventListener("submit", function(event) {
    let isValid = true;
    let messages = [];

    const email = document.getElementById("email").value.trim();
    const name = document.getElementById("name").value.trim();
    const password = document.getElementById("password").value;

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    document.getElementById("registerForm").addEventListener("submit", function(event) {
        let isValid = true;
    
        const email = document.getElementById("email");
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailPattern.test(email.value.trim())) {
            alert("Invalid email address.");
            isValid = false;
        }
    
      
        const name = document.getElementById("name");
        if (name.value.trim().length < 3) {
            alert("Name must be at least 3 characters.");
            isValid = false;
        }
    
        const password = document.getElementById("password");
        if (password.value.length < 6) {
            alert("Password must be at least 6 characters.");
            isValid = false;
        }
    
        if (!isValid) event.preventDefault();
    });
    

    if (!emailPattern.test(email)) {
        messages.push("Invalid email address.");
    }
    if (name.length < 3) {
        messages.push("Name must be at least 3 characters.");
    }
    if (password.length < 6) {
        messages.push("Password must be at least 6 characters.");
    }
    if (!isValid) {
        alert(messages.join("\n"));
        event.preventDefault();
      } else {
        event.preventDefault(); // Prevent actual submission
        window.location.href = "videoPage.html"; // Redirect if valid
      }
});
