document.getElementById("loginForm").addEventListener("submit", function(event) {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const messages = [];

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Email validation
    if (!emailPattern.test(email)) {
        messages.push("Invalid email format.");
    }

    // Password validation
    if (password.length < 6) {
        messages.push("Password must be at least 6 characters.");
    }

    if (messages.length > 0) {
        alert(messages.join("\n"));
        event.preventDefault(); // Stop form from submitting
    }
   // After successful login:
sessionStorage.setItem('idUtilisateur', idUtilisateur);
localStorage.setItem('idUtilisateur', idUtilisateur);
document.cookie = `idUtilisateur=${idUtilisateur}; path=/; max-age=86400`;
});
