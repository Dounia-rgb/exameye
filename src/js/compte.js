function toggleAddMatiereInput() {
    const container = document.getElementById('addMatiereInputContainer');
    container.style.display = container.style.display === 'none' ? 'flex' : 'none';
}

function goBack() {
    window.history.back();
}

function addMatiere() {
    const input = document.getElementById('newMatiereInput');
    const subject = input.value.trim();
    
    if (!subject) {
        alert('Veuillez entrer un nom de matière');
        return;
    }

    fetch('../db/compte.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=requestAddSubject&subject=${encodeURIComponent(subject)}`
    })
    .then(async response => {
        // First check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Expected JSON but got: ${text.substring(0, 100)}`);
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Request failed');
        }
        
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showDialog();
            const subjectList = document.getElementById('subjectList');
            const li = document.createElement('li');
            li.classList.add('pending-item');
            li.innerHTML = `
                ${subject}
                <span class="pending-badge">En attente</span>
                <i class="fas fa-times" style="cursor:pointer;color:#dc3545;" 
                   onclick="this.parentElement.remove()"></i>
            `;
            subjectList.appendChild(li);
            input.value = '';
            toggleAddMatiereInput();
        } else {
            throw new Error(data.message || "Erreur lors de l'ajout");
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert(`Erreur: ${error.message}`);
    });
}

function togglePassword() {
    const passwordSpan = document.getElementById('password');
    const eyeIcon = document.querySelector('.eye-icon');
    
    if (passwordSpan.getAttribute('data-shown') === 'false') {
        passwordSpan.textContent = passwordSpan.getAttribute('data-real-password');
        passwordSpan.setAttribute('data-shown', 'true');
        eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        passwordSpan.textContent = '********';
        passwordSpan.setAttribute('data-shown', 'false');
        eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function modifierProfil() {
    const nom = document.getElementById('nom').textContent;
    const email = document.getElementById('email').textContent;
    const password = document.getElementById('password').getAttribute('data-real-password');
    
    fetch('../db/compte.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=requestEdit&name=${encodeURIComponent(nom)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showDialog();
            
            // Add pending status indicator
            const profileContainer = document.querySelector('.profile-container');
            
            // Only add the pending status if it doesn't already exist
            if (!document.getElementById('profilePendingBadge')) {
                const pendingStatus = document.createElement('div');
                pendingStatus.id = 'profilePendingBadge';
                pendingStatus.className = 'pending-status';
                pendingStatus.innerHTML = '<i class="fas fa-clock"></i> Modifications en attente d\'approbation';
                profileContainer.insertBefore(pendingStatus, profileContainer.firstChild.nextSibling);
            }
        } else {
            alert(data.message || "Erreur lors de la modification du profil");
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Une erreur s'est produite");
    });
}

function showDialog() {
    const dialog = document.getElementById('dialogOverlay');
    dialog.classList.add('active');
}

function closeDialog() {
    const dialog = document.getElementById('dialogOverlay');
    dialog.classList.remove('active');
}

// Load user data when page loads
document.addEventListener('DOMContentLoaded', function() {
    fetch('../db/compte.php')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(data.error);
                return;
            }
            
            document.getElementById('nom').textContent = data.nom || '';
            document.getElementById('email').textContent = data.email || '';
            
            // Store real password and set attribute for toggle function
            const passwordSpan = document.getElementById('password');
            passwordSpan.setAttribute('data-real-password', data.motDePasse || '');
            passwordSpan.setAttribute('data-shown', 'false');
            passwordSpan.textContent = '********';
            
            // Add pending profile edit status if it exists
            if (data.pendingProfileEdit) {
                const profileContainer = document.querySelector('.profile-container');
                const pendingStatus = document.createElement('div');
                pendingStatus.id = 'profilePendingBadge';
                pendingStatus.className = 'pending-status';
                pendingStatus.innerHTML = '<i class="fas fa-clock"></i> Modifications en attente d\'approbation';
                profileContainer.insertBefore(pendingStatus, profileContainer.firstChild.nextSibling);
            }
            
            if (data.role === 'professeur') {
                const subjectList = document.getElementById('subjectList');
                
                // Handle regular approved subjects
                if (data.matiereEnseignee) {
                    const subjects = data.matiereEnseignee.split(', ');
                    subjects.forEach(subject => {
                        if (subject.trim() !== '') {
                            const li = document.createElement('li');
                            li.innerHTML = `
                                ${subject.trim()}
                                <i class="fas fa-times" style="cursor:pointer;color:#dc3545;" 
                                   onclick="this.parentElement.remove()"></i>
                            `;
                            subjectList.appendChild(li);
                        }
                    });
                }
                
                // Handle pending subjects
                if (data.pendingSubjects && data.pendingSubjects.length > 0) {
                    data.pendingSubjects.forEach(subject => {
                        const li = document.createElement('li');
                        li.classList.add('pending-item');
                        li.innerHTML = `
                            ${subject}
                            <span class="pending-badge">En attente</span>
                            <i class="fas fa-times" style="cursor:pointer;color:#dc3545;" 
                               onclick="this.parentElement.remove()"></i>
                        `;
                        subjectList.appendChild(li);
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
});