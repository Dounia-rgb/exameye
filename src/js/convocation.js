document.addEventListener("DOMContentLoaded", () => {
    setupAccountDropdown();
    loadProfessorData();
    
    // Check for notification_id OR id parameter from notification redirect
    const urlParams = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notification_id');
    const convocationId = urlParams.get('id');
    
    // Handle notification as read if coming from notification
    if (notificationId) {
        markNotificationAsRead(notificationId);
    }
    
    // Load specific convocation if id parameter is present
    if (convocationId) {
        loadSpecificConvocation(convocationId);
    } else {
        // Otherwise load all convocations
        loadConvocations();
    }
});

function setupAccountDropdown() {
    const accountContainer = document.getElementById("accountContainer");
    const accountDropdown = document.getElementById("accountDropdown");

    accountContainer.addEventListener("mouseenter", () => {
        accountDropdown.classList.add("show");
    });

    accountDropdown.addEventListener("mouseenter", () => {
        accountDropdown.classList.add("show");
    });

    accountContainer.addEventListener("mouseleave", () => {
        setTimeout(() => {
            if (!accountDropdown.matches(":hover")) {
                accountDropdown.classList.remove("show");
            }
        }, 200);
    });

    accountDropdown.addEventListener("mouseleave", () => {
        accountDropdown.classList.remove("show");
    });
}

function loadProfessorData() {
    fetch('../db/compte.php')
        .then(res => res.json())
        .then(data => {
            document.getElementById("profName").textContent = data.nom + ' ' + (data.prenom || '');
        })
        .catch(error => {
            console.error("Erreur lors du chargement des données professeur:", error);
        });
}

/**
 * Marks a notification as read
 */
function markNotificationAsRead(notificationId) {
    fetch('../db/mark_notification_read.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: notificationId })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Notification marked as read:', data);
        })
        .catch(error => {
            console.error('Erreur lors du marquage de la notification comme lue:', error);
        });
}

/**
 * Loads a specific convocation when redirected from a notification
 */
function loadSpecificConvocation(convocationGroupId) {
    console.log("Chargement convocation ID:", convocationGroupId);
    
    // Afficher un message de chargement
    const container = document.querySelector(".convocation-table-container");
    container.innerHTML = "<p>Chargement de la convocation...</p>";
    
    fetch(`../db/convocation_data.php?groupId=${convocationGroupId}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`Erreur HTTP: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log("Données reçues:", data);
            container.innerHTML = "";

            if (!data || data.length === 0 || data.error) {
                // Afficher un message plus descriptif
                container.innerHTML = `
                    <div class="error-message">
                        <p>Convocation non trouvée (ID: ${convocationGroupId})</p>
                        <p>La convocation a peut-être été supprimée ou n'existe pas.</p>
                        <p><a href="convocation.html">Voir toutes les convocations</a></p>
                    </div>`;
                return;
            }

            // Create a section for this specific convocation group
            const rows = data;
            const titleDate = new Date(rows[0].date);
            const formattedDate = formatDate(titleDate);

            const section = document.createElement("div");
            section.classList.add("convocation-section");
            section.setAttribute("data-group-id", convocationGroupId);

            // Add a "highlighted" class to indicate this is the targeted convocation
            section.classList.add("highlighted-convocation");

            const sectionTitle = document.createElement("h3");
            sectionTitle.textContent = `Convocation du ${formattedDate}`;
            section.appendChild(sectionTitle);

            // Create table for this convocation
            const table = document.createElement("table");
            table.classList.add("convocation-table");

            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Jour</th>
                        <th>Heure</th>
                        <th>Cycle</th>
                        <th>Matière</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => {
                        const date = new Date(row.date);
                        return `
                            <tr>
                                <td>${formatDate(date)}</td>
                                <td>${getDayOfWeek(date)}</td>
                                <td>${formatTime(row.heureDebut)}</td>
                                <td>${row.cycle}</td>
                                <td>${row.matiere}</td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            `;

            section.appendChild(table);

            // Add delete button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Supprimer";
            deleteBtn.classList.add("delete-convocation-btn");
            deleteBtn.addEventListener("click", () => {
                if (confirm("Voulez-vous vraiment supprimer cette convocation ?")) {
                    deleteConvocation(convocationGroupId);
                }
            });

            const deleteBtnWrapper = document.createElement("div");
            deleteBtnWrapper.classList.add("delete-btn-wrapper");
            deleteBtnWrapper.appendChild(deleteBtn);
            section.appendChild(deleteBtnWrapper);

            container.appendChild(section);
            
            // Add a link to view all convocations
            const viewAllLink = document.createElement("div");
            viewAllLink.classList.add("view-all-link");
            viewAllLink.innerHTML = `<a href="convocation.html">Voir toutes les convocations</a>`;
            container.appendChild(viewAllLink);
            
            // Scroll to the highlighted convocation
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        })
        .catch(error => {
            console.error("Erreur lors du chargement de la convocation:", error);
            container.innerHTML = `
                <div class="error-message">
                    <p>Erreur lors du chargement de la convocation</p>
                    <p>Détails: ${error.message || error}</p>
                    <p><a href="convocation.html">Voir toutes les convocations</a></p>
                </div>`;
        });
}

function loadConvocations() {
    // Afficher un message de chargement
    const container = document.querySelector(".convocation-table-container");
    container.innerHTML = "<p>Chargement des convocations...</p>";
    
    fetch("../db/convocation_data.php")
        .then(res => {
            if (!res.ok) {
                throw new Error(`Erreur HTTP: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            container.innerHTML = "";

            if (!data || data.length === 0) {
                container.innerHTML = "<p>Aucune convocation trouvée</p>";
                return;
            }

            // Group convocations by convocationGroupId
            const grouped = {};
            data.forEach(row => {
                const groupId = row.convocationGroupId || 'inconnu';
                if (!grouped[groupId]) {
                    grouped[groupId] = [];
                }
                grouped[groupId].push(row);
            });

            // Sort by convocationGroupId (ensures consistent order)
            const sortedGroupIds = Object.keys(grouped).sort((a, b) => {
                // Get the first convocation of each group to compare dates
                const dateA = new Date(grouped[a][0].date);
                const dateB = new Date(grouped[b][0].date);
                return dateB - dateA; // Most recent first
            });

            // Create a section for each group in sorted order
            sortedGroupIds.forEach(groupId => {
                const rows = grouped[groupId];
                const titleDate = new Date(rows[0].date);
                const formattedDate = formatDate(titleDate);

                const section = document.createElement("div");
                section.classList.add("convocation-section");
                section.setAttribute("data-group-id", groupId);

                const sectionTitle = document.createElement("h3");
                sectionTitle.textContent = `Convocation du ${formattedDate}`;
                section.appendChild(sectionTitle);

                // Create a single table for all convocations in this group
                const table = document.createElement("table");
                table.classList.add("convocation-table");

                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Jour</th>
                            <th>Heure</th>
                            <th>Cycle</th>
                            <th>Matière</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => {
                            const date = new Date(row.date);
                            return `
                                <tr>
                                    <td>${formatDate(date)}</td>
                                    <td>${getDayOfWeek(date)}</td>
                                    <td>${formatTime(row.heureDebut)}</td>
                                    <td>${row.cycle}</td>
                                    <td>${row.matiere}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                `;

                section.appendChild(table);

                // Add delete button after the table
                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "Supprimer";
                deleteBtn.classList.add("delete-convocation-btn");
                deleteBtn.addEventListener("click", () => {
                    if (confirm("Voulez-vous vraiment supprimer cette convocation ?")) {
                        deleteConvocation(groupId);
                    }
                });

                const deleteBtnWrapper = document.createElement("div");
                deleteBtnWrapper.classList.add("delete-btn-wrapper");
                deleteBtnWrapper.appendChild(deleteBtn);
                section.appendChild(deleteBtnWrapper);

                container.appendChild(section);
            });
        })
        .catch(error => {
            console.error("Erreur lors du chargement des convocations:", error);
            container.innerHTML = `
                <div class="error-message">
                    <p>Erreur lors du chargement des convocations</p>
                    <p>Détails: ${error.message || error}</p>
                </div>`;
        });
}

function deleteConvocation(groupId) {
    const section = document.querySelector(`[data-group-id="${groupId}"]`);

    fetch('../db/delete_convocation.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ convocationGroupId: groupId })
    })
    .then(res => res.json())
    .then(response => {
        if (response.success) {
            // Animate then remove
            section.style.transition = "opacity 0.5s ease";
            section.style.opacity = 0;
            setTimeout(() => {
                section.remove();
                
                // If we're on a specific convocation view, redirect back to all convocations
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('id')) {
                    window.location.href = 'convocation.html';
                }
                
                // Si plus aucune convocation, afficher un message
                const remainingConvocations = document.querySelectorAll('.convocation-section');
                if (remainingConvocations.length === 0) {
                    document.querySelector(".convocation-table-container").innerHTML = "<p>Aucune convocation trouvée</p>";
                }
            }, 500);
        } else {
            alert("Erreur lors de la suppression : " + response.error);
        }
    })
    .catch(err => {
        console.error("Erreur de requête :", err);
        alert("Une erreur est survenue.");
    });
}

function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function getDayOfWeek(date) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" });
}

function formatTime(timeString) {
    return timeString; // You can add formatting logic here if needed
}