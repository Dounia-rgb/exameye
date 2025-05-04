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
        compte: "Compte",
        general: "Autres"
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
                <button class="delete-btn" data-id="${notif.idNotification}">🗑️</button>
            `;

            li.innerHTML = content;
            
            // Handle click based on notification type
            li.addEventListener("click", (e) => {
                if (e.target.classList.contains("delete-btn")) return; // ignore click on delete

                if (notif.type === "convocation") {
                    window.location.href = `convocation.html?id=${notif.idReference}`;
                } else if (notif.type === "planning") {
                    window.location.href = `planning.html?id=${notif.idReference}`;
                } else if (notif.type === "compte") {
                    window.location.href = `compte.html`;
                } else if (notif.type === "message") {  // Changed from rappel to message
                    alert("Message: " + notif.message);
                } else {
                    console.log("Type inconnu:", notif.type);
                }
            });
            
            notificationList.appendChild(li);
        });

        // Attach delete events
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const notifId = btn.dataset.id;
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
            });
        });
    }
});