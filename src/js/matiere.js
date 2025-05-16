// Fonction pour ouvrir la fenêtre modale d'ajout de matière
function openMatiereModal() {
    document.getElementById('matiereModal').style.display = 'flex';
    
    // Charger les matières existantes
    chargerMatieres();
}

// Fonction pour fermer la fenêtre modale d'ajout de matière
function closeMatiereModal() {
    document.getElementById('matiereModal').style.display = 'none';
}

// Fonction pour ajouter une matière via AJAX
function ajouterMatiere(event) {
    event.preventDefault();
    
    const matiere = document.getElementById('matiereInput').value.trim();
    if (!matiere) {
        showToast('Veuillez entrer un nom de matière.', 'error');
        return;
    }
    
    // Créer un objet FormData pour envoyer les données
    const formData = new FormData();
    formData.append('action', 'ajouter');
    formData.append('matiere', matiere);
    
    // Envoyer la requête AJAX
    fetch('../db/matiere.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('matiereInput').value = '';
            showToast('Matière ajoutée avec succès !', 'success');
            chargerMatieres(); // Recharger la liste après ajout
        } else {
            showToast('Erreur: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showToast('Une erreur est survenue lors de l\'ajout de la matière.', 'error');
    });
}

// Fonction pour charger les matières existantes
function chargerMatieres() {
    fetch('../db/matiere.php?action=lister')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const listeMatieresElement = document.getElementById('listeMatieres');
                listeMatieresElement.innerHTML = '';
                
                if (data.matieres.length === 0) {
                    listeMatieresElement.innerHTML = '<p class="no-data">Aucune matière n\'est disponible.</p>';
                    return;
                }
                
                data.matieres.forEach(matiere => {
                    const matiereItem = document.createElement('div');
                    matiereItem.className = 'matiere-item';
                    matiereItem.innerHTML = `
                        <span class="matiere-nom">${matiere.matiere}</span>
                        <button class="delete-btn" onclick="supprimerMatiere(${matiere.idMatiere})">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    listeMatieresElement.appendChild(matiereItem);
                });
            } else {
                console.error('Erreur lors du chargement des matières:', data.message);
                showToast('Erreur lors du chargement des matières.', 'error');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            showToast('Erreur lors du chargement des matières.', 'error');
        });
}

// Fonction pour supprimer une matière
function supprimerMatiere(idMatiere) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette matière ?')) {
        const formData = new FormData();
        formData.append('action', 'supprimer');
        formData.append('idMatiere', idMatiere);
        
        fetch('../db/matiere.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Matière supprimée avec succès !', 'success');
                chargerMatieres(); // Recharger la liste après suppression
            } else {
                showToast('Erreur: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            showToast('Une erreur est survenue lors de la suppression.', 'error');
        });
    }
}

// Fonction pour afficher des notifications toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    // Définir le message
    toastMessage.textContent = message;
    
    // Définir le type de toast
    toast.className = 'toast-notification';
    if (type === 'success') {
        toast.classList.add('toast-success');
    } else if (type === 'error') {
        toast.classList.add('toast-error');
    }
    
    // Afficher le toast
    toast.classList.add('show');
    
    // Masquer le toast après 3 secondes
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Fermer la modale si l'utilisateur clique en dehors
window.addEventListener('click', function(event) {
    const modal = document.getElementById('matiereModal');
    if (event.target === modal) {
        closeMatiereModal();
    }
});

// S'assurer que le DOM est chargé avant d'ajouter des écouteurs d'événements
document.addEventListener('DOMContentLoaded', function() {
    // L'écouteur pour le badge est déjà dans le HTML avec onclick="openMatiereModal()"
    
    // Ajouter un écouteur pour le formulaire
    const matiereForm = document.getElementById('matiereForm');
    if (matiereForm) {
        matiereForm.addEventListener('submit', ajouterMatiere);
    }
    
    // Initialiser les écouteurs pour le compte utilisateur
    const accountIcon = document.getElementById('accountIcon');
    const accountDropdown = document.getElementById('accountDropdown');
    
    if (accountIcon && accountDropdown) {
        accountIcon.addEventListener('click', function() {
            accountDropdown.classList.toggle('active');
        });
        
        // Fermer le dropdown lorsqu'on clique ailleurs
        document.addEventListener('click', function(event) {
            if (!accountIcon.contains(event.target) && !accountDropdown.contains(event.target)) {
                accountDropdown.classList.remove('active');
            }
        });
    }
});