// Dropdown compte
document.getElementById('accountIcon').addEventListener('click', function() {
    document.getElementById('accountDropdown').classList.toggle('show');
});

window.addEventListener('click', function(event) {
    if (!event.target.closest('#accountIcon') && !event.target.closest('#accountDropdown')) {
        document.getElementById('accountDropdown').classList.remove('show');
    }
});

// Charger les notifications
function loadNotifications() {
    const notificationsContainer = document.getElementById('notificationsContainer');
    
    // Afficher chargement
    notificationsContainer.innerHTML = '<div class="loading-notification">Chargement des notifications...</div>';
    
    fetch('db/gestion.php?action=getNotifications')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.notifications.length === 0) {
                    notificationsContainer.innerHTML = `
                        <div class="empty-notification">
                            <i class="fas fa-bell-slash"></i>
                            <p>Aucune notification en attente</p>
                        </div>
                    `;
                    return;
                }
                
                notificationsContainer.innerHTML = '';
                
                data.notifications.forEach(notification => {
                    const date = new Date(notification.dateEnvoi);
                    const formattedDate = date.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const notifCard = document.createElement('div');
                    notifCard.className = 'notification-card';
                    notifCard.dataset.id = notification.idNotification;
                    notifCard.dataset.reference = notification.idReference;
                    notifCard.dataset.type = notification.type;
                    
                    let notifType, actionButtons;
                    
                    if (notification.type === 'convocation_request') {
                        notifType = 'Demande de convocation';
                        actionButtons = `
                            <button class="action-btn approve-btn" data-type="convocation">
                                <i class="fas fa-check"></i> Approuver
                            </button>
                            <button class="action-btn reject-btn" data-type="convocation">
                                <i class="fas fa-times"></i> Rejeter
                            </button>
                        `;
                    } else if (notification.type === 'surveillance_request') {
                        notifType = 'Demande de surveillance';
                        actionButtons = `
                            <button class="action-btn approve-btn" data-type="surveillance">
                                <i class="fas fa-check"></i> Approuver
                            </button>
                            <button class="action-btn reject-btn" data-type="surveillance">
                                <i class="fas fa-times"></i> Rejeter
                            </button>
                        `;
                    } else {
                        notifType = 'Notification';
                        actionButtons = `
                            <button class="action-btn mark-read-btn">
                                <i class="fas fa-check"></i> Marquer comme lu
                            </button>
                        `;
                    }
                    
                    notifCard.innerHTML = `
                        <div class="notification-header">
                            <div class="notif-type">${notifType}</div>
                            <div class="notif-date">${formattedDate}</div>
                        </div>
                        <div class="notification-content">
                            <div class="notif-user">
                                <i class="fas fa-user-circle"></i>
                                <span>${notification.nom}</span> (${notification.email})
                            </div>
                            <div class="notif-message">${notification.message}</div>
                        </div>
                        <div class="notification-actions">
                            ${actionButtons}
                        </div>
                    `;
                    
                    notificationsContainer.appendChild(notifCard);
                });
                
                // Ajouter les event listeners
                setupNotificationButtons();
            } else {
                notificationsContainer.innerHTML = `
                    <div class="error-notification">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement des notifications: ${data.message}</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            notificationsContainer.innerHTML = `
                <div class="error-notification">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erreur de connexion au serveur</p>
                </div>
            `;
        });
}

// Configuration des boutons de notification
function setupNotificationButtons() {
    // Boutons pour marquer comme lu
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.notification-card');
            const id = card.dataset.id;
            
            markAsRead(id, card);
        });
    });
    
    // Boutons d'approbation
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.notification-card');
            const id = card.dataset.reference;
            const type = this.dataset.type;
            
            approveRequest(id, type, card);
        });
    });
    
    // Boutons de rejet
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.notification-card');
            const id = card.dataset.reference;
            const type = this.dataset.type;
            
            rejectRequest(id, type, card);
        });
    });
}

// Fonction pour marquer une notification comme lue
function markAsRead(id, card) {
    const formData = new FormData();
    formData.append('action', 'markAsRead');
    formData.append('id', id);
    
    fetch('db/gestion.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Animation de disparition
            card.classList.add('notification-fade-out');
            
            // Supprimer la carte après l'animation
            setTimeout(() => {
                card.remove();
                
                // Si plus de notifications, afficher le message vide
                if (document.querySelectorAll('.notification-card').length === 0) {
                    document.getElementById('notificationsContainer').innerHTML = `
                        <div class="empty-notification">
                            <i class="fas fa-bell-slash"></i>
                            <p>Aucune notification en attente</p>
                        </div>
                    `;
                }
            }, 300);
        } else {
            alert('Erreur: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Une erreur est survenue');
    });
}

// Fonction pour approuver une demande
function approveRequest(id, type, card) {
    if (!confirm('Êtes-vous sûr de vouloir approuver cette demande ?')) {
        return;
    }
    
    const formData = new FormData();
    formData.append('action', 'approveRequest');
    formData.append('id', id);
    formData.append('type', type);
    
    fetch('db/gestion.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Montrer un toast de succès
            showToast('Demande approuvée avec succès');
            
            // Animation de disparition
            card.classList.add('notification-fade-out');
            
            // Supprimer la carte après l'animation
            setTimeout(() => {
                card.remove();
                
                // Si plus de notifications, afficher le message vide
                if (document.querySelectorAll('.notification-card').length === 0) {
                    document.getElementById('notificationsContainer').innerHTML = `
                        <div class="empty-notification">
                            <i class="fas fa-bell-slash"></i>
                            <p>Aucune notification en attente</p>
                        </div>
                    `;
                }
            }, 300);
        } else {
            alert('Erreur: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Une erreur est survenue');
    });
}

// Fonction pour rejeter une demande
function rejectRequest(id, type, card) {
    if (!confirm('Êtes-vous sûr de vouloir rejeter cette demande ?')) {
        return;
    }
    
    const formData = new FormData();
    formData.append('action', 'rejectRequest');
    formData.append('id', id);
    formData.append('type', type);
    
    fetch('db/gestion.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Montrer un toast de succès
            showToast('Demande rejetée avec succès');
            
            // Animation de disparition
            card.classList.add('notification-fade-out');
            
            // Supprimer la carte après l'animation
            setTimeout(() => {
                card.remove();
                
                // Si plus de notifications, afficher le message vide
                if (document.querySelectorAll('.notification-card').length === 0) {
                    document.getElementById('notificationsContainer').innerHTML = `
                        <div class="empty-notification">
                            <i class="fas fa-bell-slash"></i>
                            <p>Aucune notification en attente</p>
                        </div>
                    `;
                }
            }, 300);
        } else {
            alert('Erreur: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Une erreur est survenue');
    });
}

// Fonction pour afficher un toast
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Déconnexion
document.querySelector('.account-dropdown li:last-child').addEventListener('click', function() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        window.location.href = 'logout.php';
    }
});

// Charger les notifications au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
    loadNotifications();
});