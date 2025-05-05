/**
 * Notification Management System
 * Full version compatible with ExamEye structure
 */
;(function() {
    'use strict';

    // System configuration
    const config = {
        apiEndpoint: '../../db/notification_handler.php',
        pathsToTry: [
            '../../db/notification_handler.php',  // From /dashboards/
            '../db/notification_handler.php',     // From /dashboards/subdir/
            '/db/notification_handler.php'        // Absolute path
        ],
        currentPathIndex: 0,
        refreshInterval: 120000, // 2 minutes
        maxRetries: 3
    };

    // DOM Elements
    const dom = {
        container: document.getElementById('notificationsContainer'),
        count: document.getElementById('pendingCount'),
        noRequests: document.getElementById('no-requests'),
        accountIcon: document.getElementById('accountIcon'),
        accountDropdown: document.getElementById('accountDropdown'),
        retryBtn: null
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

        setupEventListeners();
        loadNotifications();
        startAutoRefresh();
    }

    // Set up event listeners
    function setupEventListeners() {
        // Account dropdown toggle
        if (dom.accountIcon && dom.accountDropdown) {
            dom.accountIcon.addEventListener('click', function(e) {
                e.stopPropagation();
                dom.accountDropdown.classList.toggle('show');
            });

            document.addEventListener('click', function() {
                dom.accountDropdown.classList.remove('show');
            });
        }

        // Network status monitoring
        window.addEventListener('online', handleNetworkOnline);
        window.addEventListener('offline', handleNetworkOffline);
    }

    // Main notification loader
    function loadNotifications() {
        if (state.retryCount >= config.maxRetries) {
            showErrorState('Maximum retries reached');
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
            throw new Error(data.message || 'Invalid response from server');
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

        // Clean up senderName if it contains unwanted prefixes
        if (request.senderName && 
            (request.senderName.includes('Matière:') || 
             request.senderName.includes('ID Matière:'))) {
            request.senderName = 'Utilisateur';
        }

        // Store reference data for subject requests
        if (request.type === 'subject_add_request') {
            // Parse the message to extract subject information if available
            let subjectData = null;
            try {
                // Try to extract JSON data from the message if possible
                const jsonMatch = request.message.match(/{.*}/);
                if (jsonMatch) {
                    subjectData = JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                console.warn('Could not parse subject data from message');
            }

            // Create the reference data object
            const referenceData = {
                subject_id: request.idReference,
                user_id: request.senderId
            };
            
            // Add extra information if available
            if (subjectData) {
                Object.assign(referenceData, subjectData);
            }
            
            element.dataset.reference = JSON.stringify(referenceData);
        }

        element.innerHTML = `
            <div class="notification-header">
                <span class="notification-type">${getRequestTypeLabel(request.type)}</span>
                <span class="notification-date">${formatDate(request.dateEnvoi)}</span>
            </div>
            <div class="notification-message">${escapeHtml(request.message) || 'No message provided'}</div>
            ${createNotificationDetails(request)}
            <div class="notification-actions">
                <button class="btn btn-approve" title="Approve request">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-reject" title="Reject request">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        `;

        return element;
    }

    // Create details section based on request type
    function createNotificationDetails(request) {
        if (request.type === 'subject_add_request') {
            // Extract just the name part if senderName contains additional info
            let displayName = request.senderName;
            
            // If senderName contains "Matière:" prefix, use the senderId instead
            if (displayName && displayName.includes('Matière:')) {
                // Try to find just a user name in the database via AJAX
                displayName = 'ID utilisateur: ' + request.senderId;
            }
            
            return `
                <div class="notification-details">
                    <h4>Détails de la matière:</h4>
                    
                    <p><strong>ID Matière:</strong> ${escapeHtml(request.idReference)}</p>
                </div>
            `;
        }
        return '';
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

        if (confirm('Êtes-vous sûr de vouloir approuver cette demande?')) {
            const formData = new FormData();
            formData.append('action', 'approveRequest');
            formData.append('notificationId', notification.dataset.id);
            formData.append('type', notification.dataset.type);

            // Fix: Correctly parse and handle the reference data
            if (notification.dataset.type === 'subject_add_request') {
                try {
                    // Get the reference data
                    const referenceString = notification.dataset.reference;
                    console.log('Reference data:', referenceString);
                    
                    if (referenceString) {
                        const referenceData = JSON.parse(referenceString);
                        
                        // Extract just the required fields for the PHP script
                        const simplifiedReference = {
                            subject_id: referenceData.subject_id, 
                            user_id: referenceData.user_id
                        };
                        
                        formData.append('referenceId', JSON.stringify(simplifiedReference));
                    } else {
                        throw new Error('Missing reference data for subject request');
                    }
                } catch (e) {
                    console.error('Error processing reference data:', e);
                    showToast('Error processing request data', 'error');
                    return;
                }
            }

            sendActionRequest(formData);
        }
    }

    // Handle reject action
    function handleRejectAction() {
        const notification = this.closest('.notification-item');
        if (!notification) return;

        if (confirm('Êtes-vous sûr de vouloir rejeter cette demande?')) {
            const formData = new FormData();
            formData.append('action', 'rejectRequest');
            formData.append('notificationId', notification.dataset.id);
            formData.append('type', notification.dataset.type);

            sendActionRequest(formData);
        }
    }

    // Send action request to server
    function sendActionRequest(formData) {
        showLoadingState();

        fetch(config.pathsToTry[config.currentPathIndex], {
            method: 'POST',
            body: formData
        })
        .then(response => {
            // Check for non-200 status
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            // Try to parse as JSON, but handle case where server returns invalid JSON
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error('Failed to parse server response as JSON:', text);
                    throw new Error('Invalid server response format');
                }
            });
        })
        .then(data => {
            if (data.success) {
                showToast('Action terminée avec succès', 'success');
                loadNotifications(); // Refresh the list
            } else {
                throw new Error(data.message || 'Action failed');
            }
        })
        .catch(error => {
            showToast(`Erreur: ${error.message}`, 'error');
            console.error('Action error:', error);
            // Show error state and enable retry
            showErrorState(error.message || 'Failed to complete action');
        });
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
            showErrorState(error.message || 'Failed to load notifications');
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
    }

    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
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
            'profile_edit_request': 'Demande de modification de profil',
            'subject_add_request': 'Demande d\'ajout de matière'
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