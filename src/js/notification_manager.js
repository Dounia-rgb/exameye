document.addEventListener('DOMContentLoaded', function() {
    // Account dropdown toggle
    const accountIcon = document.getElementById('accountIcon');
    const accountDropdown = document.getElementById('accountDropdown');
    
    if (accountIcon && accountDropdown) {
        accountIcon.addEventListener('click', function() {
            accountDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking elsewhere
        document.addEventListener('click', function(event) {
            if (!event.target.closest('#accountContainer')) {
                accountDropdown.classList.remove('show');
            }
        });
    }
    
    // DOM elements for notification
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
    const repliesList = document.querySelector('.replies-list');
    const notificationTypeToggle = document.querySelector('.notification-type-toggle');
    
    // Data
    let professors = [];
    let selectedProfessors = [];
    
    // Load notifications on page load
    loadRecentNotifications();
    loadReceivedReplies();
    
    // Toggle between sent notifications and received replies
    if (notificationTypeToggle) {
        const sentTabBtn = notificationTypeToggle.querySelector('.sent-tab');
        const receivedTabBtn = notificationTypeToggle.querySelector('.received-tab');
        const sentNotificationsCard = document.querySelector('.recent-notifications');
        const receivedRepliesCard = document.querySelector('.received-replies');
        
        sentTabBtn.addEventListener('click', function() {
            sentTabBtn.classList.add('active');
            receivedTabBtn.classList.remove('active');
            sentNotificationsCard.style.display = 'block';
            receivedRepliesCard.style.display = 'none';
        });
        
        receivedTabBtn.addEventListener('click', function() {
            receivedTabBtn.classList.add('active');
            sentTabBtn.classList.remove('active');
            receivedRepliesCard.style.display = 'block';
            sentNotificationsCard.style.display = 'none';
        });
    }
    
    // Function to load recent sent notifications and received notifications
    function loadRecentNotifications() {
        if (!notificationList) return;
        
        // Show loading indicator
        notificationList.innerHTML = '<div class="loading">Chargement des notifications...</div>';
        
        fetch('../db/get_recent_notifications.php')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    // Clear notification list
                    notificationList.innerHTML = '';
                    
                    // Add each notification to the list
                    data.forEach(notification => {
                        // Process both sent and received notifications
                        if (notification.direction === 'sent') {
                            addSentNotificationToList(
                                notification.idNotification, 
                                notification.message, 
                                notification.recipientCount, 
                                notification.dateEnvoi,
                                notification.recipients || ''
                            );
                        } else {
                            addReceivedNotificationToList(
                                notification.idNotification, 
                                notification.message, 
                                notification.sender || 'Un professeur', 
                                notification.dateEnvoi
                            );
                        }
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
    
    // Add a sent notification to the list
    function addSentNotificationToList(id, message, recipientCount, dateStr, recipients) {
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item sent';
        
        const displayDate = formatDate(dateStr);
        
        // Make sure the delete button is properly added with correct styles
        notificationItem.innerHTML = `
            <div class="notification-info">
                <span class="notification-date">${displayDate}</span>
                <span class="notification-recipients">Envoyé à ${recipientCount} professeur(s): ${recipients}</span>
                <button class="delete-btn" data-id="${id}" title="Supprimer cette notification" style="display: inline-block; margin-left: 10px; color: red; background: none; border: none; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="notification-content">
                ${message}
            </div>
        `;
        
        // Add delete functionality
        addDeleteFunctionality(notificationItem, id);
        
        notificationList.appendChild(notificationItem);
        return notificationItem;
    }
    
    // Add a received notification to the list
    function addReceivedNotificationToList(id, message, sender, dateStr) {
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item received';
        
        const displayDate = formatDate(dateStr);
        
        // Make sure the delete button is properly added with correct styles
        notificationItem.innerHTML = `
            <div class="notification-info">
                <span class="notification-date">${displayDate}</span>
                <span class="notification-sender">Reçu de ${sender}</span>
                <button class="delete-btn" data-id="${id}" title="Supprimer cette notification" style="display: inline-block; margin-left: 10px; color: red; background: none; border: none; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="notification-content">
                ${message}
            </div>
        `;
        
        // Add delete functionality
        addDeleteFunctionality(notificationItem, id);
        
        notificationList.appendChild(notificationItem);
        return notificationItem;
    }
    
    // Add delete functionality to a notification item
    function addDeleteFunctionality(element, id) {
        const deleteBtn = element.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent event bubbling
                if (confirm('Êtes-vous sûr de vouloir supprimer cette notification ?')) {
                    deleteNotification(id, element);
                }
            });
        }
    }
    
    // Delete a notification
    function deleteNotification(id, element) {
        fetch('../db/delete_notificationchef.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notificationId: id })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove element with animation
                element.style.opacity = '0';
                setTimeout(() => {
                    element.remove();
                    // Check if list is now empty
                    if (document.querySelectorAll('.notification-item').length === 0) {
                        notificationList.innerHTML = '<div class="no-notifications">Aucune notification récente</div>';
                    }
                }, 300);
            } else {
                alert('Erreur lors de la suppression : ' + (data.error || 'Une erreur est survenue'));
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de la suppression.');
        });
    }
    
    // Function to load received replies
    function loadReceivedReplies() {
        if (!repliesList) return;
        
        // Show loading indicator
        repliesList.innerHTML = '<div class="loading">Chargement des réponses...</div>';
        
        fetch('../db/receive_reply.php')
            .then(response => response.json())
            .then(data => {
                if (data.success && Array.isArray(data.replies) && data.replies.length > 0) {
                    // Clear replies list
                    repliesList.innerHTML = '';
                    
                    // Add each reply to the list
                    data.replies.forEach(reply => {
                        addReplyToList(
                            reply.idNotification,
                            reply.message, 
                            reply.senderName, 
                            reply.dateEnvoi,
                            reply.isRead === '0' // isRead is a string in the database
                        );
                    });
                } else {
                    repliesList.innerHTML = '<div class="no-notifications">Aucune réponse reçue</div>';
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des réponses:', error);
                repliesList.innerHTML = '<div class="error">Erreur lors du chargement des réponses</div>';
            });
    }
    
    // Format date for display
    function formatDate(dateStr) {
        if (!dateStr) {
            const now = new Date();
            return `Aujourd'hui, ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
        
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return `Aujourd'hui, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (date.toDateString() === yesterday.toDateString()) {
            return `Hier, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            return date.toLocaleString([], {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'});
        }
    }
    
    // Add a notification to the list of recent notifications (Used by the send notification button)
   // Update the addNotificationToList function
function addNotificationToList(id, message, recipientCount, dateStr, recipients) {
    const notificationItem = document.createElement('div');
    notificationItem.className = 'notification-item sent';
    
    const displayDate = formatDate(dateStr);
    
    notificationItem.innerHTML = `
        <div class="notification-info">
            <span class="notification-date">${displayDate}</span>
            <span class="notification-recipients">Envoyé à ${recipientCount} professeur(s): ${recipients}</span>
            <button class="delete-btn" data-id="${id}" title="Supprimer cette notification">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="notification-content">
            ${message}
        </div>
    `;
    
    // Add delete functionality
    addDeleteFunctionality(notificationItem, id);
    
    notificationList.appendChild(notificationItem);
    return notificationItem;
}
    
    // Add a reply to the list of received replies
    function addReplyToList(id, message, senderName, dateStr, isUnread) {
        const replyItem = document.createElement('div');
        replyItem.className = 'reply-item';
        if (isUnread) {
            replyItem.classList.add('unread');
        }
        
        const displayDate = formatDate(dateStr);
        
        // Make sure the delete button is properly added with correct styles
        replyItem.innerHTML = `
            <div class="reply-info">
                <span class="reply-sender">${senderName || 'Un professeur'}</span>
                <span class="reply-date">${displayDate}</span>
                <button class="delete-btn" data-id="${id}" title="Supprimer cette réponse" style="display: inline-block; margin-left: 10px; color: red; background: none; border: none; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="reply-content">
                ${message}
            </div>
        `;
        
        // Add delete functionality
        addDeleteFunctionality(replyItem, id);
        
        // Mark as read when clicked
        replyItem.addEventListener('click', function() {
            if (this.classList.contains('unread')) {
                this.classList.remove('unread');
                markNotificationAsRead(id);
            }
        });
        
        // Add to beginning of list
        if (repliesList.firstChild) {
            repliesList.insertBefore(replyItem, repliesList.firstChild);
        } else {
            repliesList.appendChild(replyItem);
        }
        
        return replyItem;
    }
    
    // Mark a notification as read
    function markNotificationAsRead(id) {
        fetch('../db/mark_notification_read.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notificationId: id })
        })
        .then(response => response.json())
        .catch(error => {
            console.error('Erreur lors du marquage comme lu:', error);
        });
    }

    // Load professors from database
    function loadProfessors() {
        // Show loading indicator
        professorsContainer.innerHTML = '<div class="loading">Chargement des professeurs...</div>';
        
        // AJAX call to get professors from database
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

    // Display professor list in modal
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

    // Filter professors during search
    function filterProfessors(query) {
        if (!query.trim()) {
            renderProfessorsList(professors);
            return;
        }
        
        const filteredProfessors = professors.filter(professor => {
            return professor.nom.toLowerCase().includes(query.toLowerCase()) || 
                   professor.email.toLowerCase().includes(query.toLowerCase()) ||
                   (professor.matiereEnseignee && professor.matiereEnseignee.toLowerCase().includes(query.toLowerCase()));
        });
        
        renderProfessorsList(filteredProfessors);
    }

    // Update recipient count
    function updateRecipientsCount() {
        recipientsCountSpan.textContent = selectedProfessors.length;
    }

    // Handle predefined message button clicks
    if (predefinedMessageBtns) {
        predefinedMessageBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // If button was already selected, deselect it
                if (this.classList.contains('selected')) {
                    this.classList.remove('selected');
                    messageTextarea.value = '';
                } else {
                    // Deselect all other buttons
                    predefinedMessageBtns.forEach(b => b.classList.remove('selected'));
                    
                    // Select this button and display its message
                    this.classList.add('selected');
                    messageTextarea.value = this.getAttribute('data-message');
                }
            });
        });
    }

    // Open modal to select recipients
    if (selectRecipientsBtn) {
        selectRecipientsBtn.addEventListener('click', function() {
            loadProfessors();
            recipientsModal.style.display = 'block';
        });
    }

    // Close modal
    function closeRecipientsModal() {
        recipientsModal.style.display = 'none';
    }

    if (closeModal) {
        closeModal.addEventListener('click', closeRecipientsModal);
    }

    if (cancelSelectionBtn) {
        cancelSelectionBtn.addEventListener('click', function() {
            // Cancel current selection and restore previous selection
            closeRecipientsModal();
            // Don't update selectedProfessors
        });
    }

    // Confirm recipient selection
    if (confirmSelectionBtn) {
        confirmSelectionBtn.addEventListener('click', function() {
            closeRecipientsModal();
            updateRecipientsCount();
        });
    }

    // Real-time search
    if (professorSearch) {
        professorSearch.addEventListener('input', function() {
            filterProfessors(this.value);
        });
    }

    // Select all professors
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            selectedProfessors = [...professors]; // Copy all professors
            renderProfessorsList(professors);
        });
    }

    // Deselect all professors
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', function() {
            selectedProfessors = [];
            renderProfessorsList(professors);
        });
    }

    // Send notification
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
            
            // Prepare notification
            const notification = {
                message: message,
                recipients: selectedProfessors.map(p => p.id),
                dateEnvoi: new Date().toISOString(),
                type: 'message' // 'message' type for this case
            };
            
            // Send notification to server
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
                    // Add notification to recent notifications list
                    const notificationItem = addNotificationToList(data.notificationId || 'new', message, selectedProfessors.length);
                    
                    // Add highlight class to new notification
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

    // Clear form
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearForm);
    }

    function clearForm() {
        messageTextarea.value = '';
        selectedProfessors = [];
        updateRecipientsCount();
        
        // Deselect all predefined message buttons
        predefinedMessageBtns.forEach(btn => btn.classList.remove('selected'));
    }
});