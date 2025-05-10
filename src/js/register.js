document.addEventListener("DOMContentLoaded", function() {
    const registerForm = document.getElementById("registerForm");
    
    if (registerForm) {
        registerForm.addEventListener("submit", function(event) {
            event.preventDefault(); // Prevent default form submission
            
            let isValid = true;
            
            // Get input values
            const email = document.getElementById("email").value.trim();
            const nom = document.getElementById("nom").value.trim();
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm_password").value;
            
            // Get selected role
            let role = '';
            const roleOptions = document.querySelectorAll('input[name="role"]');
            for (const option of roleOptions) {
                if (option.checked) {
                    role = option.value;
                    break;
                }
            }
            
            // Define validation patterns
            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            
            // Perform validations
            if (!emailPattern.test(email)) {
                alert("Veuillez entrer une adresse email valide.");
                isValid = false;
            }
            else if (nom.length < 3) {
                alert("Le nom doit contenir au moins 3 caractères.");
                isValid = false;
            }
            else if (password.length < 8) {
                alert("Le mot de passe doit contenir au moins 8 caractères.");
                isValid = false;
            }
            else if (password !== confirmPassword) {
                alert("Les mots de passe ne correspondent pas.");
                isValid = false;
            }
            else if (!role) {
                alert("Veuillez sélectionner un rôle.");
                isValid = false;
            }
            
            // If validation passes, submit the form data using fetch
            if (isValid) {
                const formData = new FormData(registerForm);
                
                // Display loading message
                const submitBtn = document.querySelector('.register-btn');
                const originalBtnText = submitBtn.textContent;
                submitBtn.textContent = 'Traitement en cours...';
                submitBtn.disabled = true;
                
                fetch('../db/register.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
                    // Reset button state
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                    
                    // Process response
                    return response.text();
                })
                .then(data => {
                    console.log("Raw response:", data);
                    
                    // Check if response contains a redirect script
                    if (data.includes('window.location.href')) {
                        // Extract the alert message if present
                        const alertMatch = data.match(/alert\(['"](.*?)['"]\)/);
                        if (alertMatch && alertMatch[1]) {
                            alert(alertMatch[1]);
                        }
                        
                        // Extract the redirect URL
                        const urlMatch = data.match(/window\.location\.href\s*=\s*['"](.*?)['"]/);
                        if (urlMatch && urlMatch[1]) {
                            window.location.href = urlMatch[1];
                        }
                    } else if (data.includes('error') || data.includes('Error') || data.includes('ERROR')) {
                        // Handle error messages
                        alert("Erreur lors de l'inscription. Détails: " + data);
                    } else {
                        // Success but no redirect script
                        alert("Inscription réussie! Veuillez vous connecter.");
                        window.location.href = '../dashboards/login.html';
                    }
                })
                .catch(error => {
                    // Reset button state
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                    
                    console.error('Error:', error);
                    alert("Erreur lors de l'inscription: " + error.message);
                });
            }
        });
    } else {
        console.error("Formulaire d'inscription non trouvé! Assurez-vous que le formulaire a l'id='registerForm'");
    }
});