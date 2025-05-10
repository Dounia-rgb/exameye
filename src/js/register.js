document.addEventListener("DOMContentLoaded", function() {
    const registerForm = document.getElementById("registerForm");
    
    // Check URL parameters for success/error messages
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('registration') && urlParams.get('registration') === 'pending') {
        showNotification("Votre demande d'inscription a été soumise avec succès. Un administrateur va examiner votre demande.", "success");
    } else if (urlParams.has('error')) {
        showNotification(urlParams.get('message') || "Une erreur s'est produite lors de l'inscription.", "error");
    }
    
    if (registerForm) {
        registerForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            
            // Hide previous notifications
            hideNotification();
            
            // Validate form before submission
            const validationErrors = validateForm();
            if (validationErrors.length > 0) {
                showNotification(validationErrors.join("\n"), "error");
                return;
            }
            
            // Prepare form data
            const formData = new FormData(registerForm);
            
            // Show loading state
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement en cours...';
            
            showNotification("Traitement de votre demande en cours...", "info");
            
            try {
                // Send the registration request
                const response = await fetch('../db/register.php', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                // Reset button state
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                
                if (data.success) {
                    // Show success message
                    showNotification(data.message, "success");
                    
                    // Reset form
                    registerForm.reset();
                    
                    // Redirect after delay
                    setTimeout(() => {
                        window.location.href = data.redirect || '../dashboards/login.html?registration=pending';
                    }, 2000);
                } else {
                    // Show error messages
                    showNotification(data.errors.join("\n"), "error");
                }
            } catch (error) {
                // Reset button state
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                
                // Show error message
                showNotification("Une erreur réseau s'est produite. Veuillez réessayer.", "error");
                console.error('Registration Error:', error);
            }
        });
    } else {
        console.error("Registration form not found!");
    }
    
    // Form validation function
    function validateForm() {
        const errors = [];
        
        // Get form values
        const nom = document.getElementById("nom").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm_password").value;
        const roleSelected = document.querySelector('input[name="role"]:checked');
        
        // Validation patterns
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const namePattern = /^[a-zA-ZÀ-ÿ\s'-]{3,}$/;
        
        // Validate name
        if (!nom) {
            errors.push("Le nom complet est requis.");
        } else if (!namePattern.test(nom)) {
            errors.push("Le nom doit contenir au moins 3 caractères alphabétiques.");
        }
        
        // Validate email
        if (!email) {
            errors.push("L'adresse email est requise.");
        } else if (!emailPattern.test(email)) {
            errors.push("Veuillez entrer une adresse email valide.");
        }
        
        // Validate password
        if (!password) {
            errors.push("Le mot de passe est requis.");
        } else if (password.length < 8) {
            errors.push("Le mot de passe doit contenir au moins 8 caractères.");
        } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            errors.push("Le mot de passe doit contenir des majuscules, minuscules et chiffres.");
        }
        
        // Validate password confirmation
        if (password !== confirmPassword) {
            errors.push("Les mots de passe ne correspondent pas.");
        }
        
        // Validate role selection
        if (!roleSelected) {
            errors.push("Veuillez sélectionner un rôle.");
        }
        
        return errors;
    }
    
    // Notification functions
    function showNotification(message, type) {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        let notificationMessage = document.getElementById('notification-message');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification ' + type;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 15px 25px;
                border-radius: 5px;
                color: white;
                z-index: 1000;
                display: none;
                max-width: 80%;
                text-align: center;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            `;
            
            notificationMessage = document.createElement('span');
            notificationMessage.id = 'notification-message';
            notification.appendChild(notificationMessage);
            document.body.appendChild(notification);
        }
        
        // Set notification style based on type
        const typeStyles = {
            'success': 'background-color: #4CAF50;',
            'error': 'background-color: #F44336;',
            'info': 'background-color: #2196F3;'
        };
        
        notification.className = 'notification ' + type;
        notification.setAttribute('style', `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            display: block;
            max-width: 80%;
            text-align: center;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            ${typeStyles[type] || 'background-color: #2196F3;'}
        `);
        
        notificationMessage.textContent = message;
        notification.style.display = 'block';
        
        // Auto-hide success/info notifications
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                hideNotification();
            }, 5000);
        }
        
        // Add close button
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            margin-left: 15px;
            color: white;
            font-weight: bold;
            float: right;
            cursor: pointer;
        `;
        closeBtn.addEventListener('click', hideNotification);
        
        // Add close button only if not already present
        if (!notification.querySelector('.close-btn')) {
            closeBtn.className = 'close-btn';
            notification.appendChild(closeBtn);
        }
    }
    
    function hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }
});