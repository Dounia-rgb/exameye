document.addEventListener('DOMContentLoaded', function() {
    // Account dropdown toggle
    const accountIcon = document.getElementById('accountIcon');
    const accountDropdown = document.getElementById('accountDropdown');
    
    if (accountIcon && accountDropdown) {
        accountIcon.addEventListener('click', function() {
            accountDropdown.classList.toggle('show');
        });
        
        // Fermer le dropdown si on clique ailleurs
        document.addEventListener('click', function(event) {
            if (!event.target.closest('#accountContainer')) {
                accountDropdown.classList.remove('show');
            }
        });
    }
    
    // Éléments du DOM pour la notification
    const messageTextarea = document.getElementById('message-content');
    const selectRecipientsBtn = document.getElementById('select-recipients');
    const recipientsModal = document.getElementById('recipients-modal');
    const closeModal = document.querySelector('.close-modal');
    const confirmSelectionBtn = document.getElementById('confirm-selection');
    const cancelSelectionBtn = document.getElementById('cancel-selection');
    const sendNotificationBtn = document.getElementById('send-notification');
    const clearFormBtn = document.getElementById('clear-form');
    const predefinedMessageBtns = document.querySelectorAll('.message-btn');
    const selectAllBtn = document.getElementById('select-all');
    const deselectAllBtn = document.getElementById('deselect-all');
    const professorSearch = document.getElementById('professor-search');
    const professorsContainer = document.getElementById('professors-container');
    const recipientsCountSpan = document.getElementById('recipients-count');
    const notificationList = document.querySelector('.notification-list');

    // Données
    let professors = [];
    let selectedProfessors = [];

    // Charger les notifications récentes au chargement de la page
    loadRecentNotifications();

    // Fonction pour charger les notifications récentes depuis la base de données
    function loadRecentNotifications() {
        fetch('../db/get_recent_notifications.php')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    // Vider la liste des notifications
                    notificationList.innerHTML = '';
                    
                    // Ajouter chaque notification à la liste
                    data.forEach(notification => {
                        addNotificationToList(notification.message, notification.recipientCount, notification.dateEnvoi);
                    });
                } else {
                    notificationList.innerHTML = '<div class="no-notifications">Aucune notification récente</div>';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des notifications:', error);
                notificationList.innerHTML = '<div class="error">Erreur lors du chargement des notifications</div>';
            });
    }

    // Ajouter une notification à la liste des notifications récentes
    function addNotificationToList(message, recipientCount, dateStr) {
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item';
        
        // Formater la date
        let displayDate;
        if (dateStr) {
            const date = new Date(dateStr);
            // Aujourd'hui, Hier ou date complète
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (date.toDateString() === today.toDateString()) {
                displayDate = `Aujourd'hui, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else if (date.toDateString() === yesterday.toDateString()) {
                displayDate = `Hier, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else {
                displayDate = date.toLocaleString([], {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'});
            }
        } else {
            // Cas où la date n'est pas fournie
            const now = new Date();
            displayDate = `Aujourd'hui, ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
        
        notificationItem.innerHTML = `
            <div class="notification-info">
                <span class="notification-date">${displayDate}</span>
                <span class="notification-recipients">Envoyé à ${recipientCount} professeur(s)</span>
            </div>
            <div class="notification-content">
                ${message}
            </div>
        `;
        
        // Ajouter au début de la liste
        if (notificationList.firstChild) {
            notificationList.insertBefore(notificationItem, notificationList.firstChild);
        } else {
            notificationList.appendChild(notificationItem);
        }
        
        return notificationItem;
    }

    // Charger les professeurs depuis la base de données
    function loadProfessors() {
        // Afficher un indicateur de chargement
        professorsContainer.innerHTML = '<div class="loading">Chargement des professeurs...</div>';
        
        // Appel AJAX pour récupérer les professeurs depuis la base de données
        fetch('../db/get_professeurs.php')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data)) {
                    professors = data;
                    renderProfessorsList(professors);
                } else {
                    professorsContainer.innerHTML = '<div class="error">Erreur lors du chargement des professeurs</div>';
                    console.error('Format de données invalide:', data);
                }
            })
            .catch(error => {
                professorsContainer.innerHTML = '<div class="error">Erreur lors du chargement des professeurs</div>';
                console.error('Erreur:', error);
            });
    }

    // Afficher la liste des professeurs dans le modal
    function renderProfessorsList(professorsList) {
        professorsContainer.innerHTML = '';
        
        if (professorsList.length === 0) {
            professorsContainer.innerHTML = '<div class="no-results">Aucun professeur trouvé</div>';
            return;
        }
        
        professorsList.forEach(professor => {
            const isSelected = selectedProfessors.some(p => p.id === professor.id);
            
            const professorItem = document.createElement('div');
            professorItem.className = 'professor-item';
            professorItem.innerHTML = `
                <input type="checkbox" id="prof-${professor.id}" class="professor-checkbox" ${isSelected ? 'checked' : ''}>
                <div class="professor-info">
                    <span class="professor-name">${professor.nom}</span>
                    <span class="professor-email">${professor.email}</span>
                </div>
            `;
            
            const checkbox = professorItem.querySelector(`#prof-${professor.id}`);
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    if (!selectedProfessors.some(p => p.id === professor.id)) {
                        selectedProfessors.push(professor);
                    }
                } else {
                    selectedProfessors = selectedProfessors.filter(p => p.id !== professor.id);
                }
            });
            
            professorsContainer.appendChild(professorItem);
        });
    }

    // Filtrer les professeurs lors de la recherche
    function filterProfessors(query) {
        if (!query.trim()) {
            renderProfessorsList(professors);
            return;
        }
        
        const filteredProfessors = professors.filter(professor => {
            return professor.nom.toLowerCase().includes(query.toLowerCase()) || 
                   professor.email.toLowerCase().includes(query.toLowerCase()) ||
                   professor.matiereEnseignee.toLowerCase().includes(query.toLowerCase());
        });
        
        renderProfessorsList(filteredProfessors);
    }

    // Mettre à jour le compteur de destinataires sélectionnés
    function updateRecipientsCount() {
        recipientsCountSpan.textContent = selectedProfessors.length;
    }

    // Gérer les clics sur les messages prédéfinis
    if (predefinedMessageBtns) {
        predefinedMessageBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Si le bouton était déjà sélectionné, le désélectionner
                if (this.classList.contains('selected')) {
                    this.classList.remove('selected');
                    messageTextarea.value = '';
                } else {
                    // Désélectionner tous les autres boutons
                    predefinedMessageBtns.forEach(b => b.classList.remove('selected'));
                    
                    // Sélectionner ce bouton et afficher son message
                    this.classList.add('selected');
                    messageTextarea.value = this.getAttribute('data-message');
                }
            });
        });
    }

    // Ouvrir le modal pour sélectionner les destinataires
    if (selectRecipientsBtn) {
        selectRecipientsBtn.addEventListener('click', function() {
            loadProfessors();
            recipientsModal.style.display = 'block';
        });
    }

    // Fermer le modal
    function closeRecipientsModal() {
        recipientsModal.style.display = 'none';
    }

    if (closeModal) {
        closeModal.addEventListener('click', closeRecipientsModal);
    }

    if (cancelSelectionBtn) {
        cancelSelectionBtn.addEventListener('click', function() {
            // Annuler la sélection en cours et restaurer la sélection précédente
            closeRecipientsModal();
            // Ne pas mettre à jour selectedProfessors
        });
    }

    // Confirmer la sélection de destinataires
    if (confirmSelectionBtn) {
        confirmSelectionBtn.addEventListener('click', function() {
            closeRecipientsModal();
            updateRecipientsCount();
        });
    }

    // Recherche en temps réel
    if (professorSearch) {
        professorSearch.addEventListener('input', function() {
            filterProfessors(this.value);
        });
    }

    // Sélectionner tous les professeurs
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            selectedProfessors = [...professors]; // Copie de tous les professeurs
            renderProfessorsList(professors);
        });
    }

    // Désélectionner tous les professeurs
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', function() {
            selectedProfessors = [];
            renderProfessorsList(professors);
        });
    }

    // Envoyer la notification
    if (sendNotificationBtn) {
        sendNotificationBtn.addEventListener('click', function() {
            const message = messageTextarea.value.trim();
            
            if (!message) {
                alert('Veuillez saisir un message');
                return;
            }
            
            if (selectedProfessors.length === 0) {
                alert('Veuillez sélectionner au moins un destinataire');
                return;
            }
            
            // Préparer la notification
            const notification = {
                message: message,
                recipients: selectedProfessors.map(p => p.id),
                dateEnvoi: new Date().toISOString(),
                type: 'message' // Type 'message' pour ce cas
            };
            
            // Envoi de la notification au serveur
            fetch('../db/send_notification.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(notification)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Ajouter la notification à la liste des notifications récentes
                    const notificationItem = addNotificationToList(message, selectedProfessors.length);
                    
                    // Ajouter une classe pour mettre en évidence la nouvelle notification
                    notificationItem.classList.add('new-notification');
                    setTimeout(() => {
                        notificationItem.classList.remove('new-notification');
                    }, 3000);
                    
                    alert('Notification envoyée avec succès à ' + selectedProfessors.length + ' professeur(s)');
                    clearForm();
                } else {
                    alert('Erreur lors de l\'envoi : ' + (data.error || 'Veuillez réessayer.'));
                }
            })
            .catch(error => {
                console.error('Erreur:', error);
                alert('Une erreur est survenue lors de l\'envoi de la notification.');
            });
        });
    }

    // Effacer le formulaire
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearForm);
    }

    function clearForm() {
        messageTextarea.value = '';
        selectedProfessors = [];
        updateRecipientsCount();
        
        // Désélectionner tous les boutons de messages prédéfinis
        predefinedMessageBtns.forEach(btn => btn.classList.remove('selected'));
    }
});