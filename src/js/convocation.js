document.addEventListener("DOMContentLoaded", () => {
    setupAccountDropdown();
    loadProfessorData();
    loadConvocations();
    checkNotificationSource();
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

function loadConvocations() {
    fetch("../db/convocation_data.php")
        .then(res => res.json())
        .then(data => {
            const container = document.querySelector(".convocation-table-container");
            container.innerHTML = "";

            if (data.length === 0) {
                container.innerHTML = "<p>Aucune convocation trouvée</p>";
                return;
            }

            const grouped = {};
            data.forEach(row => {
                const groupId = row.convocationGroupId || 'inconnu';
                if (!grouped[groupId]) {
                    grouped[groupId] = [];
                }
                grouped[groupId].push(row);
            });

            let total = 0;
            for (const groupId in grouped) {
                const rows = grouped[groupId];
                const titleDate = new Date(rows[0].date);
                const formattedDate = formatDate(titleDate);

                const section = document.createElement("div");
                section.classList.add("convocation-section");
                section.setAttribute("data-group-id", groupId);


                const sectionTitle = document.createElement("h3");
                sectionTitle.textContent = `Convocation du ${formattedDate}`;
                section.appendChild(sectionTitle);

                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "Supprimer";
                deleteBtn.classList.add("delete-convocation-btn");
                deleteBtn.addEventListener("click", () => {
                    if (confirm("Voulez-vous vraiment supprimer cette convocation ?")) {
                        deleteConvocation(groupId);
                    }
                });

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
                const deleteBtnWrapper = document.createElement("div");
deleteBtnWrapper.classList.add("delete-btn-wrapper");
deleteBtnWrapper.appendChild(deleteBtn);
section.appendChild(table);
section.appendChild(deleteBtnWrapper); // Now placed right *after* the table

                container.appendChild(section);
                total += rows.length;
            }

           
        })
        .catch(error => {
            console.error("Erreur lors du chargement des convocations:", error);
            document.querySelector(".convocation-table-container").innerHTML =
                "<p>Erreur lors du chargement des convocations</p>";
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
                updateFooterCount();
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





function checkNotificationSource() {
    const urlParams = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notification_id');

    if (notificationId) {
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
