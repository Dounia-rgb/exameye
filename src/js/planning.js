document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("planning-body");
    const planningTitleElement = document.getElementById("planning-title");
    
    if (!tableBody) {
        console.error("Élément #planning-body non trouvé dans le document");
        return;
    }
    
    // Récupérer l'ID du planning depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const planningId = urlParams.get('id');
    
    console.log("Chargement du planning avec ID:", planningId);
    
    // Déterminer l'URL à utiliser
    const fetchUrl = planningId 
        ? `../db/planning_admin.php?action=get_planning_detail&id=${planningId}`
        : '../db/planning_admin.php?action=get_plannings';
    
    fetch(fetchUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Données reçues:", data);
            
            // DÉBUGGAGE: Afficher la structure des données reçues
            console.log("Structure complète des données:", JSON.stringify(data));
            
            // Traiter les données selon la structure reçue
            if (planningId) {
                // Cas d'un planning spécifique
                if (!data.success) {
                    throw new Error(data.error || "Échec de récupération du planning");
                }
                
                const planning = data.planning;
                
                // DÉBUGGAGE: Afficher la structure du premier examen
                if (planning.exams && planning.exams.length > 0) {
                    console.log("Structure du premier examen:", JSON.stringify(planning.exams[0]));
                }
                
                // Mettre à jour le titre du planning
                if (planningTitleElement) {
                    planningTitleElement.textContent = `Planning - ${planning.cycle} ${planning.anneeUniversitaire} - Semestre ${planning.semester}`;
                    const deleteButton = document.createElement("button");
                    deleteButton.textContent = "Supprimer ce planning";
                    deleteButton.className = "delete-planning-btn";
                    deleteButton.onclick = function() {
                        if (confirm("Êtes-vous sûr de vouloir supprimer ce planning et tous ses examens ?")) {
                            deletePlanning(planningId);
                        }
                    };
                    planningTitleElement.appendChild(deleteButton);
                }
                
                // Afficher les examens
                if (!planning.exams || planning.exams.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="7" class="empty-message">Aucun examen dans ce planning</td></tr>`;
                    return;
                }
                
                tableBody.innerHTML = ""; // Effacer les données précédentes
                
                planning.exams.forEach(exam => {
                    const row = document.createElement("tr");
                    
                    // DÉBUGGAGE: Afficher la valeur brute de la salle pour cet examen
                    console.log(`Salle pour l'examen ${exam.matiere}:`, exam.salle, exam.salles);
                    
                    // Essayer les deux formes possibles (salle ou salles)
                    const salleValue = exam.salles !== undefined ? exam.salles : (exam.salle !== undefined ? exam.salle : 'Non spécifiée');
                    const sallesDisplay = formatSalles(salleValue);
                    
                    row.innerHTML = `
                        <td>${planning.semester}</td>
                        <td>${formatDate(exam.date)}</td>
                        <td>${exam.heureDebut}</td>
                        <td>${exam.heureFin}</td>
                        <td>${exam.matiere}</td>
                        <td>${sallesDisplay}</td>
                        <td>${exam.groupe}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                // Cas de tous les plannings (vue globale)
                if (Object.keys(data).length === 0 || !data.plannings || Object.keys(data.plannings).length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="7" class="empty-message">Aucun planning disponible</td></tr>`;
                    return;
                }
                
                tableBody.innerHTML = ""; // Effacer les données précédentes
                
                // DÉBUGGAGE: Afficher la structure du premier planning
                const firstPlanningKey = Object.keys(data.plannings)[0];
                if (firstPlanningKey && data.plannings[firstPlanningKey].exams && data.plannings[firstPlanningKey].exams.length > 0) {
                    console.log("Structure du premier examen (vue globale):", JSON.stringify(data.plannings[firstPlanningKey].exams[0]));
                }
                
                // Traiter la liste des plannings
                Object.values(data.plannings).forEach(planning => {
                    planning.exams.forEach(exam => {
                        const row = document.createElement("tr");
                        
                        // Essayer les deux formes possibles (salle ou salles)
                        const salleValue = exam.salles !== undefined ? exam.salles : (exam.salle !== undefined ? exam.salle : 'Non spécifiée');
                        const sallesDisplay = formatSalles(salleValue);
                        
                        row.innerHTML = ` 
                            <td>${planning.semester}</td>
                            <td>${formatDate(exam.date)}</td>
                            <td>${exam.heureDebut}</td>
                            <td>${exam.heureFin}</td>
                            <td>${exam.matiere}</td>
                            <td>${sallesDisplay}</td>
                            <td>${exam.groupe}</td>
                        `;
                        
                        tableBody.appendChild(row);
                    });
                });
            }
        })
        .catch(error => {
            console.error("Erreur lors du chargement du planning :", error);
            tableBody.innerHTML = `<tr><td colspan="7" class="error-message">Erreur de chargement des données: ${error.message}</td></tr>`;
        });
    
    // Fonction utilitaire pour formater la date
    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR');
    }
    
    // Fonction pour formater l'affichage des salles multiples
    function formatSalles(salles) {
        if (!salles) return '-';
        
        // DÉBUGGAGE: Afficher le type et la valeur des salles reçues
        console.log("Type des salles:", typeof salles, "Valeur:", salles);
        
        // Si c'est une chaîne de caractères simple
        if (typeof salles === 'string') {
            // Vérifier si c'est potentiellement une chaîne JSON (format array)
            if (salles.startsWith('[') && salles.endsWith(']')) {
                try {
                    const sallesArray = JSON.parse(salles);
                    return Array.isArray(sallesArray) ? sallesArray.join(', ') : salles;
                } catch (e) {
                    return salles; // Si ce n'est pas du JSON valide, retourner la chaîne telle quelle
                }
            }
            return salles;
        }
        
        // Si c'est déjà un tableau
        if (Array.isArray(salles)) {
            return salles.join(', ');
        }
        
        return String(salles);
    }
    
    function deletePlanning(id) {
        fetch(`../db/delete_planning.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: id })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Planning supprimé avec succès!");
                window.location.href = 'plannings.html'; // Redirect to the planning list page
            } else {
                alert("Erreur lors de la suppression: " + (data.error || "Erreur inconnue"));
            }
        })
        .catch(error => {
            console.error("Erreur:", error);
            alert("Une erreur est survenue lors de la communication avec le serveur.");
        });
    }
});