// Dropdown compte
document.getElementById('accountIcon').addEventListener('click', function() {
    document.getElementById('accountDropdown').classList.toggle('show');
});

window.addEventListener('click', function(event) {
    if (!event.target.closest('#accountIcon') && !event.target.closest('#accountDropdown')) {
        document.getElementById('accountDropdown').classList.remove('show');
    }
});

// Tabs
const professeursTab = document.getElementById('professeurs-tab');
const chefsTab = document.getElementById('chefs-tab');
const professeursTable = document.getElementById('professeurs-table');
const chefsTable = document.getElementById('chefs-table');

professeursTab.addEventListener('click', () => {
    professeursTab.classList.add('active');
    chefsTab.classList.remove('active');
    professeursTable.style.display = 'block';
    chefsTable.style.display = 'none';
    resetSearch();
    loadUsers('professeur');
});

chefsTab.addEventListener('click', () => {
    chefsTab.classList.add('active');
    professeursTab.classList.remove('active');
    chefsTable.style.display = 'block';
    professeursTable.style.display = 'none';
    resetSearch();
    loadUsers('administrateur'); // Modifié de 'chefDepartement' à 'administrateur'
});


// Highlight
function highlightText(cell, searchText) {
    const text = cell.textContent;
    const regex = new RegExp(`(${searchText})`, 'gi');
    cell.innerHTML = text.replace(regex, `<span class="highlight">$1</span>`);
}

function resetHighlighting() {
    document.querySelectorAll('.user-table td:not(.action-cell)').forEach(cell => {
        cell.innerHTML = cell.textContent;
    });
}

function resetSearch() {
    resetHighlighting();

    document.querySelectorAll('#professeursTableBody tr').forEach(row => row.style.display = '');
    document.querySelectorAll('#chefsTableBody tr').forEach(row => row.style.display = '');

    document.getElementById('noResultsProfs').style.display = 'none';
    document.getElementById('noResultsChefs').style.display = 'none';
    
    document.getElementById('searchInput').value = '';
}

function searchTable() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    resetHighlighting();

    const isProfShown = professeursTable.style.display !== 'none';
    const rows = document.querySelectorAll(isProfShown ? '#professeursTableBody tr' : '#chefsTableBody tr');
    let matchFound = false;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const combined = Array.from(cells).slice(0, 3).map(c => c.textContent.toLowerCase()).join(' ');
        if (combined.includes(input)) {
            row.style.display = '';
            matchFound = true;
            if (input !== '') {
                highlightText(cells[0], input);
                highlightText(cells[1], input);
                highlightText(cells[2], input);
            }
        } else {
            row.style.display = 'none';
        }
    });

    document.getElementById(isProfShown ? 'noResultsProfs' : 'noResultsChefs').style.display = matchFound ? 'none' : 'block';
}

document.getElementById('searchButton').addEventListener('click', searchTable);
document.getElementById('searchInput').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') searchTable();
});
// Ajouter au début de votre fichier gestion.js
function checkSession() {
    // Récupérer l'userId depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    
    fetch(`../db/check_session.php${userId ? '?userId=' + userId : ''}`)
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert('Votre session a expiré. Veuillez vous reconnecter.');
                window.location.href = '../dashboards/login.html';
            } else {
                // Session valide, on charge les utilisateurs
                loadUsers('professeur');
                setupActionButtons();
            }
        })
        .catch(error => {
            console.error('Error checking session:', error);
            alert('Erreur de connexion au serveur.');
        });
}

// Remplacer votre event listener existant par celui-ci
window.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
// Charger les utilisateurs depuis la base de données
function loadUsers(role) {
    const tableBody = role === 'professeur' ? 
        document.getElementById('professeursTableBody') : 
        document.getElementById('chefsTableBody');
    
    // Vider le tableau
    tableBody.innerHTML = '<tr><td colspan="4" class="loading-row">Chargement des données...</td></tr>';
    
    fetch(`../db/gestion.php?action=getUsers&role=${role}`)
        .then(response => response.json())
        .then(data => {
            console.log(`Réponse pour ${role}:`, data);
            if (data.success) {
                tableBody.innerHTML = '';
                
                if (data.users.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="4" class="empty-row">Aucun ${role} trouvé</td></tr>`;
                    return;
                }
                
                data.users.forEach(user => {
                    const row = document.createElement('tr');
                    row.dataset.id = user.idUtilisateur;
                    row.dataset.role = role;
                    
                    row.innerHTML = `
                        <td>${user.nom}</td>
                        <td>${user.email}</td>
                        <td>${role === 'professeur' ? user.matiereEnseignee : user.departement}</td>
                        <td class="action-cell">
                            <button class="action-btn edit-btn">
                                <i class="fas fa-edit"></i>
                                Modifier
                            </button>
                            <button class="action-btn delete-btn">
                                <i class="fas fa-trash"></i>
                                Supprimer
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Réinitialiser les event listeners pour les boutons d'action
                setupActionButtons();
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="error-row">Erreur: ${data.message}</td></tr>`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            tableBody.innerHTML = '<tr><td colspan="4" class="error-row">Erreur de connexion au serveur</td></tr>';
        });
}

// Modal functionality
const editModal = document.getElementById('editModal');
const closeModal = document.getElementById('closeModal');
const cancelEdit = document.getElementById('cancelEdit');
const editForm = document.getElementById('editForm');
const fieldLabel = document.getElementById('fieldLabel');

let currentRow = null;

function openEditModal(row) {
    currentRow = row;
    const cells = row.querySelectorAll('td');
    
    // Créer les champs cachés s'ils n'existent pas
    if (!document.getElementById('editId')) {
        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'editId';
        editForm.appendChild(idInput);
    }
    
    if (!document.getElementById('editRole')) {
        const roleInput = document.createElement('input');
        roleInput.type = 'hidden';
        roleInput.id = 'editRole';
        editForm.appendChild(roleInput);
    }
    
    // Set modal title
    document.getElementById('modalTitle').textContent = `Modifier ${cells[0].textContent}`;
    
    // Fill form with current values
    document.getElementById('editId').value = row.dataset.id;
    document.getElementById('editRole').value = row.dataset.role;
    document.getElementById('editName').value = cells[0].textContent;
    document.getElementById('editEmail').value = cells[1].textContent;
    document.getElementById('editField').value = cells[2].textContent;
    
    // Update field label based on current tab
    if (professeursTab.classList.contains('active')) {
        fieldLabel.textContent = 'Matière';
    } else {
        fieldLabel.textContent = 'Département';
    }
    
    // Show modal
    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
    currentRow = null;
}

// Event listeners for modal
closeModal.addEventListener('click', closeEditModal);
cancelEdit.addEventListener('click', closeEditModal);

// Submit form with AJAX
editForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('action', 'edit');
    formData.append('id', document.getElementById('editId').value);
    formData.append('name', document.getElementById('editName').value);
    formData.append('email', document.getElementById('editEmail').value);
    formData.append('field', document.getElementById('editField').value);
    formData.append('role', document.getElementById('editRole').value);
    
    fetch('../db/gestion.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update the row in the table
            if (currentRow) {
                const cells = currentRow.querySelectorAll('td');
                cells[0].textContent = document.getElementById('editName').value;
                cells[1].textContent = document.getElementById('editEmail').value;
                cells[2].textContent = document.getElementById('editField').value;
            }
            closeEditModal();
        } else {
            alert('Erreur: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Une erreur est survenue lors de la mise à jour');
    });
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target === editModal) {
        closeEditModal();
    }
});

// Action buttons
function setupActionButtons() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            openEditModal(this.closest('tr'));
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const id = row.dataset.id;
            const name = row.cells[0].textContent;
            
            if (confirm(`Êtes-vous sûr de vouloir supprimer ${name} ?`)) {
                const formData = new FormData();
                formData.append('action', 'delete');
                formData.append('id', id);
                
                fetch('../db/gestion.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        row.remove();
                    } else {
                        alert('Erreur: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Une erreur est survenue lors de la suppression');
                });
            }
        });
    });
}

// Déconnexion
document.querySelector('.account-dropdown li:last-child').addEventListener('click', function() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        window.location.href = 'logout.php';
    }
});

// Charger les professeurs au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
    loadUsers('professeur');
    setupActionButtons();
});