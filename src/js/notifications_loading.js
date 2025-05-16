document.addEventListener("DOMContentLoaded", () => {
    const notificationList = document.getElementById("notificationsList");
    const wrapper = document.querySelector(".notifications-container");

    // Create a container for category buttons
    const filterContainer = document.createElement("div");
    filterContainer.className = "notification-filters";

    // These must match your updated `type` values (rappel replaced with message)
    const categories = {
        convocation: "Convocation",
        planning: "Planning",
        message: "Message",  // Changed from rappel to message
    
    };

    // Create buttons for each category
    for (const [type, label] of Object.entries(categories)) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.classList.add("filter-btn");
        btn.dataset.type = type;

        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            showNotificationsByType(type);
        });

        filterContainer.appendChild(btn);
    }

    wrapper.insertBefore(filterContainer, notificationList);

    let groupedNotifications = {};

    fetch('../db/notification_data.php')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                notificationList.innerHTML = `<li>${data.error}</li>`;
                return;
            }

            groupedNotifications = data;
            // Default to convocation, or first available category if no convocations
            const defaultType = data.convocation && data.convocation.length > 0 ? 
                "convocation" : Object.keys(data)[0] || "general";
            
            document.querySelector(`[data-type="${defaultType}"]`).classList.add("active");
            showNotificationsByType(defaultType);
        })
        .catch(err => {
            notificationList.innerHTML = `<li>Erreur de chargement: ${err}</li>`;
        });

    function showNotificationsByType(type) {
        notificationList.innerHTML = "";

        const notifs = groupedNotifications[type] || [];

        if (notifs.length === 0) {
            notificationList.innerHTML = `<li>Aucune notification dans cette catégorie.</li>`;
            return;
        }

        notifs.forEach(notif => {
            const li = document.createElement("li");
            li.className = "notification-item";

            const content = `
                <div class="notification-header">
                    <strong>${notif.title}</strong>
                    <span class="notification-date">${notif.date}</span>
                </div>
                <div class="notification-body">${notif.message}</div>
                <div class="notification-actions">
                    <button class="reply-btn" data-id="${notif.idNotification}">
                        <i class="fas fa-reply"></i> Répondre
                    </button>
                    <button class="delete-btn" data-id="${notif.idNotification}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            li.innerHTML = content;
            
            // Handle click based on notification type
            li.addEventListener("click", (e) => {
                // If clicking the delete or reply button, don't navigate
                if (e.target.classList.contains("delete-btn") || 
                    e.target.classList.contains("reply-btn") || 
                    e.target.closest(".reply-btn") || 
                    e.target.closest(".delete-btn")) {
                    return;
                }

                if (notif.type === "convocation") {
                    window.location.href = `convocation.html?id=${notif.idReference}`;
                } else if (notif.type === "planning") {
                    window.location.href = `planning.html?id=${notif.idReference}`;
                } else {
                    console.log("Type inconnu:", notif.type);
                }
            });
            
            notificationList.appendChild(li);
        });

        // Attach reply events
        document.querySelectorAll(".reply-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const notifId = btn.dataset.id;
                
                // Find notification data
                let currentNotif = null;
                for (const category in groupedNotifications) {
                    const found = groupedNotifications[category].find(n => n.idNotification == notifId);
                    if (found) {
                        currentNotif = found;
                        break;
                    }
                }
                
                if (!currentNotif) return;
                
                // Show reply modal
                showReplyModal(currentNotif);
            });
        });

        // Attach delete events
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const notifId = btn.dataset.id;
                
                if (confirm("Êtes-vous sûr de vouloir supprimer cette notification ?")) {
                    fetch(`../db/delete_notification.php`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ id: notifId })
                    })
                    .then(response => response.json())
                    .then(res => {
                        if (res.success) {
                            const item = btn.closest(".notification-item");
                            item.remove();
                            
                            // Remove from groupedNotifications too
                            groupedNotifications[type] = groupedNotifications[type].filter(n => n.idNotification != notifId);
                            
                            // If no notifications left in this category, show message
                            if (groupedNotifications[type].length === 0) {
                                notificationList.innerHTML = `<li>Aucune notification dans cette catégorie.</li>`;
                            }
                        } else {
                            alert("Erreur lors de la suppression: " + res.error);
                        }
                    });
                }
            });
        });
    }

    // Create and show the reply modal
    function showReplyModal(notification) {
        // Create modal container if it doesn't exist
        let modal = document.getElementById("replyModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "replyModal";
            modal.className = "modal";
            document.body.appendChild(modal);
        }

        // Set modal content
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Répondre à la notification</h2>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="original-message">
                        <h4>Notification originale:</h4>
                        <h3>${notification.title}</h3>
                        <p>${notification.message}</p>
                    </div>
                    <div class="reply-form">
                        <label for="replyText">Votre réponse:</label>
                        <textarea id="replyText" placeholder="Écrivez votre réponse ici..." rows="5"></textarea>
                        <div class="modal-actions">
                            <button id="cancelReply" class="cancel-btn">Annuler</button>
                            <button id="sendReply" class="send-btn" data-id="${notification.idNotification}">Envoyer</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Show modal
        modal.style.display = "block";

        // Close modal when clicking the X
        modal.querySelector(".close-modal").addEventListener("click", () => {
            modal.style.display = "none";
        });

        // Close modal when clicking cancel button
        document.getElementById("cancelReply").addEventListener("click", () => {
            modal.style.display = "none";
        });

        // Close modal when clicking outside the modal content
        window.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
            }
        });

        // Handle send reply button
        document.getElementById("sendReply").addEventListener("click", () => {
            const replyText = document.getElementById("replyText").value.trim();
            if (!replyText) {
                alert("Veuillez entrer un message");
                return;
            }

            // Show loading state
            const sendBtn = document.getElementById("sendReply");
            sendBtn.textContent = "Envoi en cours...";
            sendBtn.disabled = true;

            // Send reply to server
            fetch('../db/send_reply.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notificationId: notification.idNotification,
                    message: replyText,
                    recipientRole: "chef_departement" // Default recipient role
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Reset button state
                    sendBtn.textContent = "Envoyer";
                    sendBtn.disabled = false;
                    
                    // Show success and close
                    modal.style.display = "none";
                    showToast("Réponse envoyée avec succès");
                } else {
                    // Reset button state
                    sendBtn.textContent = "Envoyer";
                    sendBtn.disabled = false;
                    
                    alert("Erreur lors de l'envoi de la réponse: " + data.error);
                }
            })
            .catch(err => {
                // Reset button state
                sendBtn.textContent = "Envoyer";
                sendBtn.disabled = false;
                
                alert("Erreur lors de l'envoi: " + err);
            });
        });
    }
    
    // Create a toast notification function
    function showToast(message) {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById("toast-container");
        if (!toastContainer) {
            toastContainer = document.createElement("div");
            toastContainer.id = "toast-container";
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => {
            toast.classList.add("show");
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 3000);
    }
});