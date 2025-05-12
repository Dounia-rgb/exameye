/**
 * ExamEye Notification Management System
 * Enhanced version with user registration approval features
 */
;(function() {
    'use strict';

    // System configuration
    const config = {
        apiEndpoint: '../../db/notification_handler.php',
        pathsToTry: [
            '../../db/notification_handler.php',  // From /dashboards/
            '../db/notification_handler.php',     // From /dashboards/subdir/
            '/db/notification_handler.php',       // Absolute path
            'notification_handler.php'            // Same directory
        ],
        currentPathIndex: 0,
        refreshInterval: 60000, // 1 minute
        maxRetries: 3
    };

    // DOM Elements
    const dom = {
        container: document.getElementById('notificationsContainer'),
        count: document.getElementById('pendingCount'),
        noRequests: document.getElementById('no-requests'),
        accountIcon: document.getElementById('accountIcon'),
        accountDropdown: document.getElementById('accountDropdown'),
        retryBtn: null,
        modalContainer: null
    };

    // State management
    const state = {
        retryCount: 0,
        refreshTimer: null,
        currentRequests: []
    };

    // Initialize the system
    function init() {
        if (!dom.container) {
            console.error('Notification container not found');
            return;
        }

        createModalContainer();
        setupEventListeners();
        loadNotifications();
        startAutoRefresh();
    }

    // Create modal container for rejections
    // Create modal container for rejections
    function createModalContainer() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('modalContainer');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        modalContainer.className = 'modal-container';
        modalContainer.style.display = 'none';
        
        modalContainer.innerHTML = `
           <div class="modal-content">
            <span class="modal-close">&times;</span>
            <h3>Motif de rejet</h3>
            <p>Veuillez indiquer un motif pour le rejet de cette demande :</p>
            <textarea id="rejectionReason" rows="4" placeholder="Saisir un motif (optionnel)"></textarea>
            <div class="modal-actions">
                <button id="confirmReject" class="btn btn-danger">Confirmer le rejet</button>
                <button id="cancelReject" class="btn btn-secondary">Annuler</button>
            </div>
        </div>
        `;
        
        document.body.appendChild(modalContainer);
        dom.modalContainer = modalContainer;
        
        // Set up modal event listeners
        const closeBtn = modalContainer.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelReject');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        // Close modal if clicked outside
        window.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                closeModal();
            }
        });
        
        // Add missing CSS if needed
        addModalStyles();
    }
    
    // Add required modal styles
    function addModalStyles() {
        // Check if styles already exist
        if (document.getElementById('modal-styles')) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = 'modal-styles';
        styleElement.innerHTML = `
            .modal-container {
            display: none;
            position: fixed;
            z-index: 1050;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .modal-container.show {
            display: flex;
            opacity: 1;
        }
        
        .modal-content {
            background-color: #fff;
            padding: 25px;
            border-radius: 8px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            position: relative;
            animation: modalFadeIn 0.3s ease;
        }
        
        @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .modal-close {
            position: absolute;
            top: 15px;
            right: 20px;
            font-size: 24px;
            cursor: pointer;
            color: #777;
            transition: color 0.2s;
            background: none;
            border: none;
            padding: 0;
        }
        
        .modal-close:hover {
            color: #333;
        }
        
        .modal-content h3 {
            margin-top: 0;
            color: #2c3e50;
            font-size: 1.3rem;
            margin-bottom: 15px;
        }
        
        .modal-content p {
            margin-bottom: 15px;
            color: #555;
        }
        
        #rejectionReason {
            width: 100%;
            padding: 10px;
            margin: 10px 0 20px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
            min-height: 100px;
            font-family: inherit;
            font-size: 14px;
        }
        
        #rejectionReason:focus {
            border-color: #3498db;
            outline: none;
            box-shadow: 0 0 0 2px rgba(52,152,219,0.2);
        }
        
        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .btn {
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
            border: 1px solid transparent;
        }
        
        .btn-danger {
            background-color: #e74c3c;
            color: white;
            border-color: #c0392b;
        }
        
        .btn-danger:hover {
            background-color: #c0392b;
        }
        
        .btn-secondary {
            background-color: #f8f9fa;
            color: #333;
            border-color: #ddd;
        }
        
        .btn-secondary:hover {
            background-color: #e9ecef;
        }
        `;
        document.head.appendChild(styleElement);
    }

    // Set up event listeners
    function setupEventListeners() {
        // Account dropdown toggle
        if (dom.accountIcon && dom.accountDropdown) {
            dom.accountIcon.addEventListener('click', function(e) {
                e.stopPropagation();
                dom.accountDropdown.classList.toggle('show');
                
                // Update aria-expanded attribute for accessibility
                const expanded = dom.accountDropdown.classList.contains('show');
                dom.accountIcon.setAttribute('aria-expanded', expanded);
            });

            document.addEventListener('click', function() {
                dom.accountDropdown.classList.remove('show');
                dom.accountIcon.setAttribute('aria-expanded', 'false');
            });
        }

        // Logout functionality
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', function(e) {
                e.preventDefault();
                // Redirect to logout endpoint or clear session
                window.location.href = '../logout.php';
            });
        }

        // Network status monitoring
        window.addEventListener('online', handleNetworkOnline);
        window.addEventListener('offline', handleNetworkOffline);
    }

    // Main notification loader
    function loadNotifications() {
        if (state.retryCount >= config.maxRetries) {
            showErrorState('Nombre maximum de tentatives atteint');
            return;
        }

        showLoadingState();

        fetch(`${config.pathsToTry[config.currentPathIndex]}?action=getPendingRequests`)
            .then(handleApiResponse)
            .then(processNotifications)
            .catch(handleLoadError);
    }

    // Handle API response
    function handleApiResponse(response) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    }

    // Process notification data
    function processNotifications(data) {
        if (!data.success) {
            throw new Error(data.message || 'Réponse invalide du serveur');
        }

        state.retryCount = 0; // Reset retry counter on success
        state.currentRequests = data.requests || [];

        if (state.currentRequests.length > 0) {
            renderNotifications();
            updateCountDisplay();
        } else {
            showNoNotifications();
        }
    }

    // Render notifications to DOM
    function renderNotifications() {
        dom.container.innerHTML = '';
        if (dom.noRequests) {
            dom.noRequests.style.display = 'none';
        }

        state.currentRequests.forEach(request => {
            const notification = createNotificationElement(request);
            dom.container.appendChild(notification);
        });

        setupActionHandlers();
    }

    // Create individual notification element
    function createNotificationElement(request) {
        const element = document.createElement('div');
        element.className = 'notification-item';
        element.dataset.id = request.idNotification;
        element.dataset.type = request.type;
        element.dataset.senderId = request.senderId;

        // Store reference data for handling
        if (request.type === 'subject_add_request') {
            // Create the reference data object
            const referenceData = {
                subject_id: request.idReference,
                user_id: request.senderId
            };
            
            element.dataset.reference = JSON.stringify(referenceData);
        } else if (request.type === 'registration_request') {
            element.dataset.reference = request.idReference;
        }

        // Create the notification HTML based on type
        let detailsContent = '';
        let badgeClass = '';
        
        if (request.type === 'registration_request') {
            badgeClass = 'badge-registration';
            detailsContent = `
                <div class="notification-details">
                    <h4>Détails de l'utilisateur :</h4>
                    <p><strong>Nom :</strong> ${escapeHtml(request.senderName)}</p>
                    <p><strong>Email :</strong> ${escapeHtml(request.email || 'Non disponible')}</p>
                    <p><strong>Rôle :</strong> ${formatRole(request.role)}</p>
                </div>
            `;
        } else if (request.type === 'subject_add_request') {
            badgeClass = 'badge-subject';
            detailsContent = `
                <div class="notification-details">
                    <h4>Détails de la demande :</h4>
                    <p><strong>Professeur :</strong> ${escapeHtml(request.senderName)}</p>
                    <p><strong>ID Matière :</strong> ${escapeHtml(request.idReference)}</p>
                </div>
            `;
        } else if (request.type === 'profile_edit_request') {
            badgeClass = 'badge-profile';
            detailsContent = `
                <div class="notification-details">
                    <h4>Détails de la modification :</h4>
                    <p><strong>Utilisateur :</strong> ${escapeHtml(request.senderName)}</p>
                </div>
            `;
        }

        element.innerHTML = `
            <div class="notification-header">
                <span class="notification-type ${badgeClass}">${getRequestTypeLabel(request.type)}</span>
                <span class="notification-date">${formatDate(request.dateEnvoi)}</span>
            </div>
            <div class="notification-message">${escapeHtml(request.message) || 'Aucun message fourni'}</div>
            ${detailsContent}
            <div class="notification-actions">
                <button class="btn btn-approve" title="Approuver la demande">
                    <i class="fas fa-check"></i> Approuver
                </button>
                <button class="btn btn-reject" title="Rejeter la demande">
                    <i class="fas fa-times"></i> Rejeter
                </button>
            </div>
        `;

        return element;
    }

    // Format role for display
    function formatRole(role) {
        const roles = {
            'admin': 'Administrateur',
            'professeur': 'Professeur',
            'etudiant': 'Étudiant',
            'surveillant': 'Surveillant'
        };
        return roles[role] || role;
    }

    // Set up approve/reject button handlers
    function setupActionHandlers() {
        document.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', handleApproveAction);
        });

        document.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', handleRejectAction);
        });
    }

    // Handle approve action
    function handleApproveAction() {
        const notification = this.closest('.notification-item');
        if (!notification) return;

        if (confirm('Êtes-vous sûr de vouloir approuver cette demande ?')) {
            const formData = new FormData();
            formData.append('action', 'approveRequest');
            formData.append('notificationId', notification.dataset.id);
            formData.append('type', notification.dataset.type);

            // Handle different notification types
            if (notification.dataset.type === 'subject_add_request') {
                try {
                    // Get the reference data
                    const referenceString = notification.dataset.reference;
                    
                    if (referenceString) {
                        formData.append('referenceId', referenceString);
                    } else {
                        throw new Error('Données de référence manquantes pour la demande de matière');
                    }
                } catch (e) {
                    console.error('Error processing reference data:', e);
                    showToast('Erreur lors du traitement des données de la demande', 'error');
                    return;
                }
            } else if (notification.dataset.type === 'registration_request') {
                formData.append('referenceId', notification.dataset.reference);
            }

            sendActionRequest(formData);
        }
    }

    // Show rejection modal
    // Handle reject action
    function handleRejectAction() {
        const notification = this.closest('.notification-item');
        if (!notification) return;

        console.log('Reject button clicked for notification:', notification.dataset.id);
        
        // Store the notification reference for the modal
        dom.modalContainer.dataset.notificationId = notification.dataset.id;
        dom.modalContainer.dataset.notificationType = notification.dataset.type;
        dom.modalContainer.dataset.reference = notification.dataset.reference || '';

        // Show the modal
        openModal();

        // Set up confirmation button
        const confirmBtn = document.getElementById('confirmReject');
        if (confirmBtn) {
            // Remove existing event listeners to prevent duplicates
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            
            newConfirmBtn.addEventListener('click', function() {
                console.log('Confirm reject clicked');
                
                const formData = new FormData();
                formData.append('action', 'rejectRequest');
                formData.append('notificationId', dom.modalContainer.dataset.notificationId);
                formData.append('type', dom.modalContainer.dataset.notificationType);
                
                // Add reason if provided
                const reason = document.getElementById('rejectionReason').value.trim();
                if (reason) {
                    formData.append('reason', reason);
                }
                
                // Add reference data if available
                if (dom.modalContainer.dataset.reference) {
                    formData.append('referenceId', dom.modalContainer.dataset.reference);
                }
                
                closeModal();
                sendActionRequest(formData);
            });
        }
    }
    
    // Open the modal
    function openModal() {
        if (dom.modalContainer) {
            console.log('Opening modal');
            // Clear previous reason
            const reasonInput = document.getElementById('rejectionReason');
            if (reasonInput) {
                reasonInput.value = '';
            }
            
            dom.modalContainer.style.display = 'flex';
            // Fade in animation
            setTimeout(() => {
                dom.modalContainer.classList.add('show');
            }, 10);
        } else {
            console.error('Modal container not found');
        }
    }

    // Close the modal
    function closeModal() {
        if (dom.modalContainer) {
            console.log('Closing modal');
            dom.modalContainer.classList.remove('show');
            // Wait for animation before hiding
            setTimeout(() => {
                dom.modalContainer.style.display = 'none';
            }, 300);
        } else {
            console.error('Modal container not found when closing');
        }
    }

    // Send action request to server
    // Send action request to server with enhanced debugging
    function sendActionRequest(formData) {
        showLoadingState();
        
        // Debug what we're sending
        console.log('Sending request to endpoint:', config.pathsToTry[config.currentPathIndex]);
        console.log('Action:', formData.get('action'));
        console.log('Notification ID:', formData.get('notificationId'));
        console.log('Type:', formData.get('type'));
        
        if (formData.get('referenceId')) {
            console.log('Reference ID:', formData.get('referenceId'));
        }
        
        if (formData.get('reason')) {
            console.log('Reason provided:', formData.get('reason'));
        }

        fetch(config.pathsToTry[config.currentPathIndex], {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('Raw response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Le serveur a retourné ${response.status}: ${response.statusText}`);
            }
            
            return response.text().then(text => {
                // Log raw response for debugging
                console.log('Raw response text:', text);
                
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error('Failed to parse server response as JSON:', text);
                    throw new Error('Format de réponse du serveur invalide');
                }
            });
        })
        .then(data => {
            console.log('Parsed response data:', data);
            
            if (data.success) {
                showToast('Action terminée avec succès', 'success');
                // Short delay before refreshing to ensure server processing is complete
                setTimeout(() => {
                    loadNotifications(); // Refresh the list
                }, 500);
            } else {
                throw new Error(data.message || 'L\'action a échoué');
            }
        })
        .catch(error => {
            showToast(`Erreur: ${error.message}`, 'error');
            console.error('Action error:', error);
            showErrorState(error.message || 'Impossible de terminer l\'action');
        });
    }

    // Modal functions
    function openModal() {
        if (dom.modalContainer) {
            // Clear previous reason
            const reasonInput = document.getElementById('rejectionReason');
            if (reasonInput) {
                reasonInput.value = '';
            }
            
            dom.modalContainer.style.display = 'flex';
            // Fade in animation
            setTimeout(() => {
                dom.modalContainer.classList.add('show');
            }, 10);
        }
    }

    function closeModal() {
        if (dom.modalContainer) {
            dom.modalContainer.classList.remove('show');
            // Wait for animation before hiding
            setTimeout(() => {
                dom.modalContainer.style.display = 'none';
            }, 300);
        }
    }

    // Handle loading errors
    function handleLoadError(error) {
        console.error('Load error:', error);
        state.retryCount++;

        // Try next available path
        config.currentPathIndex++;
        if (config.currentPathIndex < config.pathsToTry.length) {
            console.log(`Trying alternative path: ${config.pathsToTry[config.currentPathIndex]}`);
            loadNotifications();
        } else {
            showErrorState(error.message || 'Impossible de charger les notifications');
        }
    }

    // Network status handlers
    function handleNetworkOnline() {
        showToast('Connexion rétablie. Rechargement...', 'success');
        loadNotifications();
    }

    function handleNetworkOffline() {
        showToast('Connexion perdue. Réessayer quand en ligne...', 'error');
    }

    // UI State Management
    function showLoadingState() {
        dom.container.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Chargement des notifications...</span>
            </div>
        `;
    }

    function showErrorState(message) {
        dom.container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${escapeHtml(message)}</p>
                <button class="btn retry-btn">Réessayer</button>
                <div class="error-details">
                    <p>Chemins essayés:</p>
                    <ul>
                        ${config.pathsToTry.map(path => `<li>${escapeHtml(path)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;

        // Set up retry button
        dom.retryBtn = document.querySelector('.retry-btn');
        if (dom.retryBtn) {
            dom.retryBtn.addEventListener('click', function() {
                config.currentPathIndex = 0;
                state.retryCount = 0;
                loadNotifications();
            });
        }
    }

    function showNoNotifications() {
        if (dom.noRequests) {
            dom.noRequests.style.display = 'flex';
        } else {
            dom.container.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-check-circle"></i>
                    <p>Aucune notification en attente</p>
                </div>
            `;
        }
        updateCountDisplay(0);
    }

    function updateCountDisplay(count) {
        if (dom.count) {
            dom.count.textContent = count !== undefined ? count : state.currentRequests.length;
        }
        
        // Update document title to show count
        if (count > 0) {
            document.title = `(${count}) ExamEye - Gestion des Demandes`;
        } else {
            document.title = 'ExamEye - Gestion des Demandes';
        }
    }

    function showToast(message, type) {
        // Remove existing toasts first
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => {
            toast.remove();
        });
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
            <span>${escapeHtml(message)}</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 10);
    }

    // Auto-refresh functionality
    function startAutoRefresh() {
        stopAutoRefresh();
        state.refreshTimer = setInterval(loadNotifications, config.refreshInterval);
    }

    function stopAutoRefresh() {
        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }
    }

    // Helper functions
    function getRequestTypeLabel(type) {
        const labels = {
            'profile_edit_request': 'Modification de profil',
            'subject_add_request': 'Ajout de matière',
            'registration_request': 'Inscription utilisateur'
        };
        return labels[type] || type;
    }

    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error('Date formatting error:', e);
            return dateString;
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();