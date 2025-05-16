// Global variables
const allPlannings = {};
let currentPlanningKey = null;
let currentExamToEdit = null;
let selectedFieldsToEdit = [];
let recipients = [];
let allMatieres = [];
let allGroupes = [];
let allSalles = [];
let activeFilter = "all"; // Default to show all plannings
async function chargerSalles() {
    try {
        const res = await fetch('../db/planning_admin.php?action=get_all_salles');
        const data = await res.json();
        if (data.success) {
            allSalles = data.salles;
            remplirSelectSalles();
        }
    } catch (error) {
        console.error("Erreur lors du chargement des salles :", error);
    }
}

function remplirSelectSalles() {
    const selects = document.querySelectorAll('select[name="salle"]');
    
    selects.forEach(select => {
        // Add 'multiple' attribute
        select.setAttribute('multiple', 'true');
        // Add size attribute for better UX
        select.setAttribute('size', '4');
        
        // vider avant de remplir
        select.innerHTML = '<option value="">-- Choisir une ou plusieurs salles --</option>';
        allSalles.forEach(s => {
            const option = document.createElement('option');
            option.value = s.nomSalle;
            option.dataset.id = s.idSalle;
            option.textContent = s.nomSalle;
            select.appendChild(option);
        });
    });
}

function getIdSalle(nomSalles) {
    // If it's a string (single room), convert to array
    if (typeof nomSalles === 'string') {
        const salle = allSalles.find(s => s.nomSalle === nomSalles);
        return salle ? [salle.idSalle] : [];
    } 
    // If it's already an array (multiple rooms)
    return nomSalles.map(nomSalle => {
        const salle = allSalles.find(s => s.nomSalle === nomSalle);
        return salle ? salle.idSalle : null;
    }).filter(id => id !== null);
}


async function chargerGroupes() {
    try {
        const res = await fetch('../db/planning_admin.php?action=get_all_groupes');
        const data = await res.json();
        if (data.success) {
            allGroupes = data.groupes;
            remplirSelectGroupes();
        }
    } catch (error) {
        console.error("Erreur lors du chargement des groupes :", error);
    }
}

function remplirSelectGroupes() {
    const selects = document.querySelectorAll('select[name="groupe"]');
    if (!selects.length) return;

    selects.forEach(select => {
        // vider avant de remplir
        select.innerHTML = '<option value="">-- Choisir un groupe --</option>';
        allGroupes.forEach(g => {
            const label = `${g.section} - ${g.groupe}`;
            const option = document.createElement('option');
            option.value = label;
            option.textContent = label;
            select.appendChild(option);
        });
    });
}

window.addEventListener('DOMContentLoaded', chargerGroupes);


async function chargerMatieresEtGroupes() {
    try {
        const [matiereRes, groupeRes, salleRes] = await Promise.all([
            fetch('../db/planning_admin.php?action=get_all_matieres'),
            fetch('../db/planning_admin.php?action=get_all_groupes'),
            fetch('../db/planning_admin.php?action=get_all_salles')
        ]);

        const matiereData = await matiereRes.json();
        const groupeData = await groupeRes.json();
        const salleData = await salleRes.json();

        if (matiereData.success) allMatieres = matiereData.matieres;
        if (groupeData.success) allGroupes = groupeData.groupes;
        if (salleData.success) allSalles = salleData.salles;

        console.log("📚 Matières chargées:", allMatieres);
        console.log("👥 Groupes chargés:", allGroupes);
        console.log("🏢 Salles chargées:", allSalles);
        
        // Remplir les selects
        remplirSelectGroupes();
        remplirSelectSalles();
    } catch (error) {
        console.error("Erreur lors du chargement des données", error);
    }
}
function getIdMatiere(nomMatiere) {
    const matiere = allMatieres.find(m => m.nom === nomMatiere);
    return matiere ? matiere.idMatiere : null;
}

function getIdGroupe(nomGroupe) {
    const [section, groupe] = nomGroupe.split(' - ');
    const match = allGroupes.find(g => g.section === section && g.groupe === groupe);
    return match ? match.idGroupe : null;
}
// Appeler au démarrage
// Assurez-vous que cette fonction est appelée après que le DOM soit complètement chargé
window.addEventListener('DOMContentLoaded', async function() {
    await chargerMatieresEtGroupes();
    console.log("Chargement initial des données terminé");
});

// Update header with current year and cycle
function updateHeaderDates() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const nextYear = currentYear + 1;
    
    document.getElementById('currentYear').textContent = currentYear;
    document.getElementById('nextYear').textContent = nextYear;
}

// Update cycle subtitle based on selected cycle
function updateCycleSubtitle(cycle) {
    const subtitle = document.getElementById('cycleSubtitle');
    if (cycle === 'Licence') {
        subtitle.textContent = 'Licence';
    } else if (cycle === 'Master') {
        subtitle.textContent = 'Master';
    } else if (cycle === 'ING') {
        subtitle.textContent = 'Ingéniorat';
    } else {
        subtitle.textContent = 'Licence & Master';
    }
}
// Save planning to display area


// Check if two time periods overlap
function horairesChevauchent(debut1, fin1, debut2, fin2) {
    return (debut1 < fin2 && debut2 < fin1);
}
// Load recipients from database
// Helper function to convert promise-based fetch to async/await for cleaner code
async function loadRecipients() {
    try {
        const response = await fetch('../db/planning_admin.php?action=get_recipients');
        const text = await response.text();
        
        try {
            const data = JSON.parse(text);
            if (data.success) {
                recipients = data.recipients;
                console.log('Recipients loaded:', recipients);
            } else {
                console.error('Failed to load recipients:', data.error);
            }
        } catch (jsonError) {
            console.error('Invalid JSON response for recipients:', jsonError);
            console.error('Response text:', text.substring(0, 200) + '...'); // Log first 200 chars
        }
    } catch (error) {
        console.error('Error loading recipients:', error);
    }
}
function savePlanningToDisplay(cycle, anneeUniversitaire) {
    const planningKey = currentPlanningKey;
    if (!planningKey || !allPlannings[planningKey]) {
        console.error("No planning key or data to display");
        return;
    }
    
    const planningData = allPlannings[planningKey];
    
    // Check if a container already exists for this planning
    let planningContainer = document.getElementById(`planning-${planningKey}`);
    
    if (!planningContainer) {
        // Create new container for planning
        planningContainer = document.createElement('div');
        planningContainer.id = `planning-${planningKey}`;
        planningContainer.className = 'planning-container';
        
        // Find the saved plannings container and append
        const savedPlanningsContainer = document.getElementById('planningsContainer');

        if (savedPlanningsContainer) {
            savedPlanningsContainer.appendChild(planningContainer);
        } else {
            console.error("❌ Élément #planningsContainer introuvable dans le DOM.");
            return;
        }
        
        
        // Hide the "No plannings" message if exists
        const noPlanningsMessage = document.getElementById('noPlanningsMessage');
        if (noPlanningsMessage) {
            noPlanningsMessage.style.display = 'none';
        }
    }
    
    // Create the content for the planning
    let content = `
        <div class="planning-header">
            <h3>${cycle} ${anneeUniversitaire} - ${planningData.semester}</h3>
            <div class="planning-actions">
                <button class="action-btn print-btn" onclick="printPlanning('${planningKey}')">
                    <i class="fas fa-print"></i> Imprimer
                </button>
                <button class="action-btn send-btn" onclick="showRecipientModal('${planningKey}')">
                    <i class="fas fa-envelope"></i> Envoyer
                </button>
                <button class="action-btn delete-btn" onclick="deletePlanning('${planningKey}')">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        </div>
        <table class="planning-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Heure Début</th>
                    <th>Heure Fin</th>
                    <th>Matière</th>
                    <th>Salle</th>
                    <th>Groupe</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add each exam row
    if (planningData.exams.length === 0) {
        content += `
            <tr>
                <td colspan="7" class="no-exams">Aucun examen planifié</td>
            </tr>
        `;
    } else {
        // Sort exams by date and time
        const sortedExams = [...planningData.exams].sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.heureDebut);
            const dateB = new Date(b.date + 'T' + b.heureDebut);
            return dateA - dateB;
        });
        
        sortedExams.forEach((exam, index) => {
            content += `
                <tr>
                    <td>${formatDate(exam.date)}</td>
                    <td>${exam.heureDebut}</td>
                    <td>${exam.heureFin}</td>
                    <td>${exam.matiere}</td>
                    <td>${exam.salles || 'Non spécifiée'}</td>
                    <td>${exam.groupe}</td>
                    <td>
                        <button class="edit-btn" onclick="showEditOptions('${planningKey}', ${index})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="deleteExam('${planningKey}', ${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    content += `
            </tbody>
        </table>
    `;
    
    planningContainer.innerHTML = content;
    
    // Add some styling for the icons if Font Awesome isn't loaded
    if (!document.getElementById('fa-style')) {
        const style = document.createElement('style');
        style.id = 'fa-style';
        style.textContent = `
            .fas.fa-print:before { content: "🖨️"; }
            .fas.fa-envelope:before { content: "✉️"; }
            .fas.fa-trash:before { content: "🗑️"; }
            .fas.fa-edit:before { content: "✏️"; }
        `;
        document.head.appendChild(style);
    }
    
    return planningContainer;
}
// Load saved plannings from database
// Load saved plannings from database
async function loadSavedPlannings() {
    try {
        const response = await fetch('../db/planning_admin.php?action=get_plannings');
        const text = await response.text(); // Get raw text instead of JSON
        
        try {
            const data = JSON.parse(text); // Try to parse as JSON
            if (data.success) {
                Object.assign(allPlannings, data.plannings);
                for (const [key, planning] of Object.entries(data.plannings)) {
                    currentPlanningKey = key;
                    savePlanningToDisplay(planning.cycle, planning.anneeUniversitaire);
                }
                console.log("✅ Plannings chargés :", allPlannings);

                currentPlanningKey = null;
                const noPlanningsMessage = document.getElementById('noPlanningsMessage');
                if (noPlanningsMessage) {
                    noPlanningsMessage.style.display = Object.keys(allPlannings).length > 0 ? 'none' : 'block';
                }
            } else {
                console.error('Failed to load plannings:', data.error);
            }
        } catch (jsonError) {
            console.error('Invalid JSON response:', jsonError);
            console.error('Response text:', text.substring(0, 200) + '...'); // Log first 200 chars
        }
    } catch (error) {
        console.error('Error loading plannings:', error);
    }
}

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize header dates
    updateHeaderDates();
    
    // Account dropdown toggle
    document.getElementById('accountIcon').addEventListener('click', function() {
        const dropdown = document.getElementById('accountDropdown');
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('#accountContainer')) {
            document.getElementById('accountDropdown').style.display = 'none';
        }
    });
    
    // Initially hide the planning form and finish button
    document.getElementById('planningForm').style.display = 'none';
    document.getElementById('finishPlanningBtn').style.display = 'none';

    // Create modals on page load to ensure they exist
    createEditModal();
    createEditFieldsModal();
    createRecipientModal();
    
    // Load data from backend
    loadRecipients();
    loadSavedPlannings();
});

// Update year options based on selected cycle
function updateYearOptions() {
    const cycleSelect = document.getElementById('cycle');
    const yearSelect = document.getElementById('year');
    const semesterSelect = document.getElementById('semester');
    const startBtn = document.getElementById('startPlanningBtn');

    // Update cycle subtitle
    updateCycleSubtitle(cycleSelect.value);

    yearSelect.innerHTML = '<option value="">-- Sélectionnez une année --</option>';
    yearSelect.disabled = true;
    semesterSelect.innerHTML = '<option value="">-- Sélectionnez d\'abord l\'année --</option>';
    semesterSelect.disabled = true;
    startBtn.disabled = true;

    if (cycleSelect.value === 'Licence') {
        yearSelect.disabled = false;
        ['L1', 'L2', 'L3'].forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    } else if (cycleSelect.value === 'Master') {
        yearSelect.disabled = false;
        ['M1', 'M2'].forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    } else if (cycleSelect.value === 'ING') {
        yearSelect.disabled = false;
        ['ING1', 'ING2','ING3'].forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }
}

// Update semester options based on selected year
function updateSemesterOptions() {
    const yearSelect = document.getElementById('year');
    const semesterSelect = document.getElementById('semester');
    const startBtn = document.getElementById('startPlanningBtn');

    semesterSelect.innerHTML = '<option value="">-- Sélectionnez un semestre --</option>';
    semesterSelect.disabled = true;
    startBtn.disabled = true;

    if (yearSelect.value) {
        semesterSelect.disabled = false;
        ['1', '2'].forEach(semester => {
            const option = document.createElement('option');
            option.value = semester;
            option.textContent = semester;
            semesterSelect.appendChild(option);
        });
    }

    semesterSelect.addEventListener('change', function() {
        startBtn.disabled = !(document.getElementById('cycle').value && 
                             yearSelect.value && 
                             semesterSelect.value);
    });
}

// Start a new planning
function startPlanning() {
    const cycle = document.getElementById('cycle').value;
    const year = document.getElementById('year').value;
    const semester = document.getElementById('semester').value;
    const planningForm = document.getElementById('planningForm');
    const selectedCycleYear = document.getElementById('selectedCycleYear');
    const startBtn = document.getElementById('startPlanningBtn');
    const finishBtn = document.getElementById('finishPlanningBtn');

    const planningKey = `${cycle}_${year}_${semester.replace(/ /g, '_')}`;
    currentPlanningKey = planningKey;

    if (allPlannings[planningKey] && !confirm(`Un planning existe déjà pour ${cycle} ${year} ${semester}. Voulez-vous le modifier?`)) {
        return;
    }

    // Initialize if not exists
    if (!allPlannings[planningKey]) {
        allPlannings[planningKey] = {
            cycle: cycle,
            anneeUniversitaire: year,

            semester: semester,
            exams: []
        };
    }

    planningForm.style.display = 'block';
    selectedCycleYear.textContent = `${cycle} ${year} - ${semester}`;
    startBtn.style.display = 'none';
    finishBtn.style.display = 'inline-block';

    // Clear any temporary rows
    const oldTemps = document.querySelectorAll('[id^="temp-"]');
    oldTemps.forEach(temp => temp.remove());

    // Reset form inputs
    const formInputs = document.querySelectorAll('#planning-body input, #planning-body select');
    formInputs.forEach(input => {
        if (input.type !== 'button') input.value = '';
    });

    // Scroll to the form smoothly
    planningForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Finish current planning
async function finishPlanning() {
    const cycle = document.getElementById('cycle').value;
    const year = document.getElementById('year').value;
    const semester = document.getElementById('semester').value;
    const planningForm = document.getElementById('planningForm');
    const startBtn = document.getElementById('startPlanningBtn');
    const finishBtn = document.getElementById('finishPlanningBtn');

    if (!currentPlanningKey || !allPlannings[currentPlanningKey]) {
        alert("Aucun planning actif à terminer.");
        return;
    }

    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Sauvegarde en cours...</p>';
    document.body.appendChild(loadingIndicator);

    console.log("Données envoyées au backend :", {
  action: 'save_planning',
  planningKey: currentPlanningKey,
  cycle,
  anneeUniversitaire: year,
  semester,
  exams: allPlannings[currentPlanningKey].exams
});

    const response = await fetch('../db/planning_admin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'save_planning',
            planningKey: currentPlanningKey,
            cycle,
            anneeUniversitaire: year, 
            semester,
            exams: allPlannings[currentPlanningKey].exams
        })
    });

    const data = await response.json();
    document.getElementById('loadingIndicator').remove();

    if (data.success) {
        allPlannings[currentPlanningKey].id = data.planningId;
        planningForm.style.display = 'none';
        startBtn.style.display = 'inline-block';
        finishBtn.style.display = 'none';
        const tempTable = document.querySelector(`#temp-${currentPlanningKey.replace(/ /g, '_')}`);
        if (tempTable) tempTable.remove();
        savePlanningToDisplay(
            allPlannings[currentPlanningKey].cycle,
            allPlannings[currentPlanningKey].anneeUniversitaire
          );
          
        document.getElementById('cycle').value = '';
        document.getElementById('year').value = '';
        document.getElementById('year').disabled = true;
        document.getElementById('semester').value = '';
        document.getElementById('semester').disabled = true;
        startBtn.disabled = true;
        updateCycleSubtitle('');
        setTimeout(() => {
            const savedPlanning = document.getElementById(`planning-${currentPlanningKey}`);
            if (savedPlanning) {
                savedPlanning.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            currentPlanningKey = null;
        }, 100);
    } else {
        alert("Erreur lors de la sauvegarde du planning: " + data.error);
    }
}


// Save planning to display area (continued)
function savePlanning() {
    const planningKey = currentPlanningKey;
    const planningData = allPlannings[planningKey];
    
    if (!planningData) {
        console.error("No planning data to save");
        return;
    }

    const examsToSave = planningData.exams.map(exam => {
        return {
            date: exam.date,
            heureDebut: exam.heureDebut,
            idMatiere: exam.idMatiere, // Make sure this exists
            idGroupe: exam.idGroupe,    // This is the critical field
            idSalles: exam.idSalles    // Should be an array of room IDs
        };
    });

    const saveData = {
        action: 'save_planning',
        cycle: planningData.cycle,
        anneeUniversitaire: planningData.anneeUniversitaire,
        semester: planningData.semester,
        exams: examsToSave
    };

    console.log("Saving planning data:", saveData); // Debug log

    fetch('planning_admin.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Planning sauvegardé avec succès!');
            // Handle success (e.g., show the saved planning)
        } else {
            console.error('Erreur lors de la sauvegarde:', data.error);
            alert('Erreur: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        alert('Une erreur est survenue');
    });
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

// Add a new exam row
function ajouterLigne(event) {
    event.preventDefault();

    if (!currentPlanningKey) {
        alert("Aucun planning actif. Veuillez d'abord commencer une planification.");
        return;
    }

    const semester = allPlannings[currentPlanningKey].semester;
    const row = event.target.closest('tr');
    const inputs = {
        date: row.querySelector('input[name="date"]'),
        heureDebut: row.querySelector('input[name="heure_debut"]'),
        heureFin: row.querySelector('input[name="heure_fin"]'),
        matiere: row.querySelector('input[name="matiere"]'),
        salle: row.querySelector('select[name="salle"]'), // This is now a multiple select
        groupe: row.querySelector('select[name="groupe"]')
    };

    const selectedSalles = Array.from(inputs.salle.selectedOptions).map(option => option.value);
    if (selectedSalles.length === 0) {
        alert(`Veuillez sélectionner au moins une salle`);
        inputs.salle.focus();
        return;
    }
    // Validate required fields
    for (const [key, input] of Object.entries(inputs)) {
        if (!input.value) {
            alert(`Veuillez remplir le champ ${key}`);
            input.focus();
            return;
        }
    }

    // Validate time
    if (inputs.heureDebut.value >= inputs.heureFin.value) {
        alert("L'heure de fin doit être après l'heure de début");
        inputs.heureFin.focus();
        return;
    }

    const newExam = { 
        semestre: semester,
        date: inputs.date.value,
        heureDebut: inputs.heureDebut.value,
        heureFin: inputs.heureFin.value,
        matiere: inputs.matiere.value,
        salle: inputs.salle.value,
        groupe: inputs.groupe.value,
        idMatiere: getIdMatiere(inputs.matiere.value),
        idGroupe: getIdGroupe(inputs.groupe.value),
        idSalle: getIdSalle(inputs.salle.value), // Add this line
        salle: selectedSalles.join(', '), // Join for display
        salles: selectedSalles, // Store as array for data
        idSalles: getIdSalle(selectedSalles) // Get array of IDs
    };
    const exams = allPlannings[currentPlanningKey].exams;
    const conflit = exams.find(e =>
        e.date === newExam.date &&
        (
            // Conflit de salle
            (e.salle === newExam.salle && horairesChevauchent(e.heureDebut, e.heureFin, newExam.heureDebut, newExam.heureFin)) ||
            // Conflit de groupe
            (e.groupe === newExam.groupe && horairesChevauchent(e.heureDebut, e.heureFin, newExam.heureDebut, newExam.heureFin))
        )
    );

    if (conflit) {
        alert("⚠️ Conflit détecté : la salle ou le groupe est déjà occupé à cette date et heure.");
        return;
    }
    
    // Add to planning data
    allPlannings[currentPlanningKey].exams.push(newExam);

    // Find the table where we want to show added lines
    const planningTable = document.querySelector('#planningForm table');

    // Check if temp tbody already exists
    let tempTbody = document.getElementById(`temp-${currentPlanningKey}`);
    if (!tempTbody) {
        tempTbody = document.createElement('tbody');
        tempTbody.id = `temp-${currentPlanningKey}`;
        planningTable.appendChild(tempTbody);
    }

    // Create a new row to show the data just added
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${formatDate(newExam.date)}</td>
        <td>${newExam.heureDebut}</td>
        <td>${newExam.heureFin}</td>
        <td>${newExam.matiere}</td>
        <td>${newExam.salle}</td>
        <td>${newExam.groupe}</td>
        <td></td>
    `;
    tempTbody.appendChild(newRow);

    // Clear form inputs
    for (const input of Object.values(inputs)) {
        if (input.type !== 'button') input.value = '';
    }
    
    console.log("Added exam to planning:", currentPlanningKey, newExam);
}




// Show edit options modal
function showEditOptions(planningKey, examIndex) {
    currentPlanningKey = planningKey;
    currentExamToEdit = examIndex;
    
    // Get the modal
    let modal = document.getElementById('editModal');
    if (!modal) {
        modal = createEditModal();
    }
    
    // Set data attributes
    modal.dataset.planningKey = planningKey;
    modal.dataset.examIndex = examIndex;
    
    // Reset all checkboxes
    const checkboxes = document.querySelectorAll('#editOptions input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    // Display the modal
    modal.style.display = 'flex';
}

// Create edit modal if it doesn't exist
function createEditModal() {
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Sélectionnez les champs à modifier</h3>
                <span class="close-modal" onclick="closeEditModal()">&times;</span>
            </div>
            <div id="editOptions" class="edit-options-grid">
                <div><input type="checkbox" id="edit-date"> <label for="edit-date">Date</label></div>
                <div><input type="checkbox" id="edit-heureDebut"> <label for="edit-heureDebut">Heure de début</label></div>
                <div><input type="checkbox" id="edit-heureFin"> <label for="edit-heureFin">Heure de fin</label></div>
                <div><input type="checkbox" id="edit-matiere"> <label for="edit-matiere">Matière</label></div>
                <div><input type="checkbox" id="edit-salle"> <label for="edit-salle">Salle</label></div>
                <div><input type="checkbox" id="edit-groupe"> <label for="edit-groupe">Groupe</label></div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel-send" onclick="closeEditModal()">Annuler</button>
                <button class="modal-btn confirm-send" onclick="confirmEditSelection()">Continuer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// Create edit fields modal if it doesn't exist
function createEditFieldsModal() {
    const modal = document.createElement('div');
    modal.id = 'editFieldsModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Modifier les champs</h3>
                <span class="close-modal" onclick="closeEditFieldsModal()">&times;</span>
            </div>
            <div id="editFieldsContent">
                <!-- This will be filled dynamically -->
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel-send" onclick="closeEditFieldsModal()">Annuler</button>
                <button class="modal-btn confirm-send" onclick="saveEditedFields()">Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// Create recipient modal if it doesn't exist
function createRecipientModal() {
    const modal = document.createElement('div');
    modal.id = 'recipientModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Sélectionnez les destinataires</h3>
                <span class="close-modal" onclick="closeModal()">&times;</span>
            </div>
            <div class="search-container" style="margin: 15px 0;">
                <input type="text" id="recipientSearch" placeholder="Rechercher un professeur..." 
                       style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #ddd;">
            </div>
            <div class="select-all-container" style="margin-bottom: 10px;">
                <button class="select-all-btn" onclick="selectAllRecipients()">Sélectionner tous</button>
                <button class="deselect-all-btn" onclick="deselectAllRecipients()">Désélectionner tous</button>
            </div>
            <div id="recipientList" class="recipient-list">
                <!-- This will be filled dynamically -->
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel-send" onclick="closeModal()">Annuler</button>
                <button class="modal-btn confirm-send" onclick="sendPlanning()">Envoyer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}
function selectAllRecipients() {
    const checkboxes = document.querySelectorAll('#recipientList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

function deselectAllRecipients() {
    const checkboxes = document.querySelectorAll('#recipientList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

// Update the CSS to style the select all buttons
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .select-all-container {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .select-all-btn, .deselect-all-btn {
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f8f9fa;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .select-all-btn:hover {
            background-color: #e9ecef;
        }
        
        .deselect-all-btn:hover {
            background-color: #e9ecef;
        }
        
        .select-all-btn {
            background-color: #0d6efd;
            color: white;
            border-color: #0d6efd;
        }
        
        .select-all-btn:hover {
            background-color: #0b5ed7;
        }
    `;
    document.head.appendChild(style);
});
// Close edit modal
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

// Close edit fields modal
function closeEditFieldsModal() {
    const modal = document.getElementById('editFieldsModal');
    if (modal) modal.style.display = 'none';
}

// Confirm edit selection and proceed to edit
function confirmEditSelection() {
    const checkboxes = document.querySelectorAll('#editOptions input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert("Veuillez sélectionner au moins un élément à modifier");
        return;
    }

    selectedFieldsToEdit = Array.from(checkboxes).map(cb => cb.id.replace('edit-', ''));
    const modal = document.getElementById('editModal');
    const planningKey = modal.dataset.planningKey;
    const examIndex = parseInt(modal.dataset.examIndex);
    showEditFieldsModal(selectedFieldsToEdit, planningKey, examIndex);
    closeEditModal();
}

// Show edit fields modal with selected fields
function showEditFieldsModal(fields, planningKey, examIndex) {
    const exam = allPlannings[planningKey].exams[examIndex];
    
    // Make sure the modal exists
    let modal = document.getElementById('editFieldsModal');
    if (!modal) {
        modal = createEditFieldsModal();
    }
    
    let editForm = `
        <div class="edit-options">
            <h4>Modifier les champs sélectionnés</h4>
            <input type="hidden" id="edit-planning-key" value="${planningKey}">
            <input type="hidden" id="edit-exam-index" value="${examIndex}">
            <table class="edit-fields-table">
                <thead>
                    <tr>
                        <th>Champ</th>
                        <th>Nouvelle valeur</th>
                    </tr>
                </thead>
                <tbody>
    `;

    fields.forEach(field => {
        let inputField = '';
        if (field === 'date') {
            inputField = `<input type="date" name="${field}" value="${exam.date}" class="edit-field-input">`;
        } else if (field === 'heureDebut' || field === 'heureFin') {
            inputField = `<input type="time" name="${field}" value="${exam[field]}" class="edit-field-input">`;
        } else if (field === 'salle') {
            // Create a multiple select for salles when editing
            inputField = `<select name="${field}" multiple class="edit-field-input" size="4">`;
            // Create array of selected salles
            const selectedSalles = exam[field].split(', ');
            
            allSalles.forEach(s => {
                const isSelected = selectedSalles.includes(s.nomSalle) ? 'selected' : '';
                inputField += `<option value="${s.nomSalle}" ${isSelected}>${s.nomSalle}</option>`;
            });
            inputField += `</select>`;
        } else {
            inputField = `<input type="text" name="${field}" value="${exam[field]}" class="edit-field-input">`;
        }

        const fieldLabel = field.replace(/([A-Z])/g, ' $1').toLowerCase();
        const capitalizedLabel = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);

        editForm += `
            <tr>
                <td>${capitalizedLabel}</td>
                <td>${inputField}</td>
            </tr>
        `;
    });

    editForm += `
            </tbody>
        </table>
    </div>
    `;

    document.getElementById('editFieldsContent').innerHTML = editForm;
    modal.style.display = 'flex';
}

// Save edited fields
function saveEditedFields() {
    const planningKey = document.getElementById('edit-planning-key').value;
    const examIndex = parseInt(document.getElementById('edit-exam-index').value);
    const exam = allPlannings[planningKey].exams[examIndex];
    
    // Update each selected field
    selectedFieldsToEdit.forEach(field => {
        const input = document.querySelector(`#editFieldsContent input[name="${field}"], #editFieldsContent select[name="${field}"]`);
        if (input) {
            if (field === 'salle' && input.multiple) {
                const selectedOptions = Array.from(input.selectedOptions).map(opt => opt.value);
                exam[field] = selectedOptions.join(', ');
                exam.salles = selectedOptions;
                exam.idSalles = getIdSalle(selectedOptions);
            } else {
                exam[field] = input.value;
            }
        }
    });

    // Force a complete refresh of the display
    refreshPlanningDisplay(planningKey);
    
    closeEditFieldsModal();
}

// Completely refresh the planning display
function refreshPlanningDisplay(planningKey) {
    const planningData = allPlannings[planningKey];
    if (!planningData) {
        console.error("No planning data found for key:", planningKey);
        return;
    }
    
    const planningDiv = document.getElementById(`planning-${planningKey}`);
    if (planningDiv) {
        planningDiv.remove();
    }
    
    // Temporarily set current planning key to refresh display
    const tempKey = currentPlanningKey;
    currentPlanningKey = planningKey;
    savePlanningToDisplay(planningData.cycle, planningData.anneeUniversitaire    );
    currentPlanningKey = tempKey;
}

// Delete an exam
function deleteExam(planningKey, examIndex) {
    if (confirm("Voulez-vous vraiment supprimer cet examen ?")) {
        allPlannings[planningKey].exams.splice(examIndex, 1);
        refreshPlanningDisplay(planningKey);
    }
}

// Delete an entire planning
function deletePlanning(planningKey) {
    if (!confirm("Voulez-vous vraiment supprimer ce planning et tous ses examens ?")) {
        return;
    }
    
    const planningId = allPlannings[planningKey].id;
    
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Suppression en cours...</p>';
    document.body.appendChild(loadingIndicator);
    
    // Send delete request to server
    fetch('../db/planning_admin.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            planningId: planningId
        }),
    })
    .then(response => response.json())
    .then(data => {
        // Remove loading indicator
        document.getElementById('loadingIndicator').remove();
        
        if (data.success) {
            // Remove from global object
            delete allPlannings[planningKey];
            
            // Remove from DOM
            const planningDiv = document.getElementById(`planning-${planningKey}`);
            if (planningDiv) {
                planningDiv.remove();
            }
            
            // Show "no plannings" message if there are no more plannings
            const noPlanningsMessage = document.getElementById('noPlanningsMessage');
            if (noPlanningsMessage) {
                noPlanningsMessage.style.display = Object.keys(allPlannings).length > 0 ? 'none' : 'block';
            }
        } else {
            alert("Erreur lors de la suppression du planning: " + data.error);
        }
    })
    .catch(error => {
        // Remove loading indicator
        if (document.getElementById('loadingIndicator')) {
            document.getElementById('loadingIndicator').remove();
        }
        console.error('Error deleting planning:', error);
        alert("Erreur de connexion. Veuillez réessayer.");
    });
}

// Print a planning
function printPlanning(planningKey) {
    const planningData = allPlannings[planningKey];
    if (!planningData) {
        console.error("No planning data found for key:", planningKey);
        return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Create the print content
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
           <title>Planning - ${planningData.cycle} ${planningData.anneeUniversitaire} - ${planningData.semester}</title>

            <style>
                body { font-family: Arial, sans-serif; }
                h1, h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .university-header { text-align: center; margin-bottom: 20px; }
                .planning-title { font-weight: bold; margin-bottom: 15px; }
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="university-header">
                <h1>Université</h1>
                <h2>Planning des Examens</h2>
                <div class="planning-title">
                    ${planningData.cycle} ${planningData.anneeUniversitaire} - ${planningData.semester}<br>
                    Année Universitaire ${new Date().getFullYear()}-${new Date().getFullYear() + 1}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Heure Début</th>
                        <th>Heure Fin</th>
                        <th>Matière</th>
                        <th>Salle</th>
                        <th>Groupe</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add each exam row
    if (planningData.exams.length === 0) {
        printContent += `
            <tr>
                <td colspan="6" style="text-align: center;">Aucun examen planifié</td>
            </tr>
        `;
    } else {
        // Sort exams by date and time
        const sortedExams = [...planningData.exams].sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.heureDebut);
            const dateB = new Date(b.date + 'T' + b.heureDebut);
            return dateA - dateB;
        });
        
        sortedExams.forEach(exam => {
            printContent += `
                <tr>
                    <td>${formatDate(exam.date)}</td>
                    <td>${exam.heureDebut}</td>
                    <td>${exam.heureFin}</td>
                    <td>${exam.matiere}</td>
                    <td>${exam.salle || 'Non spécifiée'}</td>
                    <td>${exam.groupe}</td>
                </tr>
            `;
        });
    }
    
    printContent += `
                </tbody>
            </table>
            <script>
                window.onload = function() {
                    window.print();
                    // Optionally close the window after printing
                    // setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `;
    
    // Write to the new window and trigger print
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// Show recipient selection modal
function showRecipientModal(planningKey) {
    currentPlanningKey = planningKey;
    
    // Make sure the modal exists
    let modal = document.getElementById('recipientModal');
    if (!modal) {
        modal = createRecipientModal();
    }
    
    const recipientList = document.getElementById('recipientList');
    recipientList.innerHTML = '';

    // Verify if recipients have been loaded
    if (recipients.length === 0) {
        recipientList.innerHTML = '<div class="loading-message">Chargement des professeurs...</div>';
        
        // Try to load recipients again
        loadRecipients().then(() => {
            showRecipientModal(planningKey); // Recursive call after loading
        });
        return;
    }

    recipients.forEach(recipient => {
        const recipientItem = document.createElement('div');
        recipientItem.className = 'recipient-item';
        recipientItem.dataset.name = recipient.name.toLowerCase();
        recipientItem.dataset.email = recipient.email.toLowerCase();
        recipientItem.innerHTML = `
            <input type="checkbox" id="recip-${recipient.id}" value="${recipient.id}">
            <label for="recip-${recipient.id}">${recipient.name} (${recipient.email})</label>
        `;
        recipientList.appendChild(recipientItem);
    });

    // Add search functionality
    const searchInput = document.getElementById('recipientSearch');
    searchInput.value = ''; // Clear previous search
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const items = recipientList.querySelectorAll('.recipient-item');
        
        items.forEach(item => {
            const name = item.dataset.name;
            const email = item.dataset.email;
            if (name.includes(searchTerm) || email.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    modal.style.display = 'flex';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('recipientModal');
    if (modal) modal.style.display = 'none';
}

// Send planning to selected recipients
// Send planning to selected recipients
function sendPlanning() {
    const selectedRecipients = [];
    const checkboxes = document.querySelectorAll('#recipientList input[type="checkbox"]:checked');
    
    checkboxes.forEach(cb => {
        selectedRecipients.push(parseInt(cb.value));
    });

    if (selectedRecipients.length === 0) {
        alert("Veuillez sélectionner au moins un destinataire.");
        return;
    }

    const planningData = allPlannings[currentPlanningKey];
    const planningId = planningData.id;
    
    if (!planningId) {
        alert("Erreur: ID de planning non trouvé. Veuillez d'abord sauvegarder le planning.");
        return;
    }
    
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Envoi en cours...</p>';
    document.body.appendChild(loadingIndicator);
    
    // Send to server
    fetch('../db/planning_admin.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'send_planning',  // Ajout de cette ligne
            planningId: planningId,
            professorIds: selectedRecipients
        }),
    })
    .then(response => {
        // Vérifier si la réponse est OK avant de parser le JSON
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text().then(text => {
            if (!text) {
                throw new Error('Empty response received');
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Response text was:', text);
                throw new Error('Invalid JSON response: ' + e.message);
            }
        });
    })
    .then(data => {
        // Remove loading indicator
        document.getElementById('loadingIndicator').remove();
        
        if (data.success) {
            // Create a list of names for the success message
            const recipientNames = selectedRecipients.map(id => {
                const recipient = recipients.find(r => r.id === id);
                return recipient ? recipient.name : 'Inconnu';
            }).join("\n");
            
            alert(`Planning pour ${planningData.cycle} ${planningData.anneeUniversitaire} - ${planningData.semester} envoyé à:\n\n${recipientNames}`);
            closeModal();
        } else {
            alert("Erreur lors de l'envoi du planning: " + (data.error || 'Raison inconnue'));
        }
    })
    .catch(error => {
        // Remove loading indicator
        if (document.getElementById('loadingIndicator')) {
            document.getElementById('loadingIndicator').remove();
        }
        console.error('Error sending planning:', error);
        alert("Erreur de connexion: " + error.message);
    });
}

// Helper function to convert promise-based fetch to async/await for cleaner code
async function loadRecipients() {
    try {
        const response = await fetch('../db/planning_admin.php?action=get_recipients')
        ;
        const data = await response.json();
        
        if (data.success) {
            recipients = data.recipients;
            console.log('Recipients loaded:', recipients);
        } else {
            console.error('Failed to load recipients:', data.error);
        }
    } catch (error) {
        console.error('Error loading recipients:', error);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = [
        document.getElementById('recipientModal'),
        document.getElementById('editModal'),
        document.getElementById('editFieldsModal')
    ];
    
    modals.forEach(modal => {
        if (modal && event.target == modal) {
            modal.style.display = 'none';
        }
    });
}
function filterPlanningsByCycle(cycle) {
    activeFilter = cycle;
    const planningContainers = document.querySelectorAll('.planning-container');
    const noPlanningsMessage = document.getElementById('noPlanningsMessage');
    
    let visibleCount = 0;
    
    planningContainers.forEach(container => {
        const planningHeader = container.querySelector('.planning-header h3');
        if (!planningHeader) return;
        
        const planningText = planningHeader.textContent;
        
        if (cycle === "all" || planningText.startsWith(cycle)) {
            container.style.display = 'block';
            visibleCount++;
        } else {
            container.style.display = 'none';
        }
    });
    
    // Update filter buttons to show active state
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        if (btn.dataset.filter === cycle) {
            btn.classList.add('active-filter');
        } else {
            btn.classList.remove('active-filter');
        }
    });
    
    // Show or hide no plannings message
    if (noPlanningsMessage) {
        if (visibleCount === 0 && Object.keys(allPlannings).length > 0) {
            noPlanningsMessage.textContent = "Aucun planning trouvé pour ce filtre";
            noPlanningsMessage.style.display = 'block';
        } else if (Object.keys(allPlannings).length === 0) {
            noPlanningsMessage.textContent = "Aucun planning enregistré";
            noPlanningsMessage.style.display = 'block';
        } else {
            noPlanningsMessage.style.display = 'none';
        }
    }
}

// Add this function to create the filter bar
function createFilterBar() {
    const filterBar = document.createElement('div');
    filterBar.className = 'planning-filter-bar';
    filterBar.innerHTML = `
        <div class="filter-label">Filtrer par cycle :</div>
        <div class="filter-buttons">
            <button class="filter-btn active-filter" data-filter="all" onclick="filterPlanningsByCycle('all')">Tous</button>
            <button class="filter-btn" data-filter="Licence" onclick="filterPlanningsByCycle('Licence')">Licence</button>
            <button class="filter-btn" data-filter="Master" onclick="filterPlanningsByCycle('Master')">Master</button>
            <button class="filter-btn" data-filter="ING" onclick="filterPlanningsByCycle('ING')">Ingéniorat</button>
        </div>
    `;
    return filterBar;
}

// Modify the loadSavedPlannings function to respect active filter
async function loadSavedPlannings() {
    try {
        const response = await fetch('../db/planning_admin.php?action=get_plannings');
        const text = await response.text(); // Get raw text instead of JSON
        
        try {
            const data = JSON.parse(text); // Try to parse as JSON
            if (data.success) {
                Object.assign(allPlannings, data.plannings);
                for (const [key, planning] of Object.entries(data.plannings)) {
                    currentPlanningKey = key;
                    savePlanningToDisplay(planning.cycle, planning.anneeUniversitaire);
                }
                console.log("✅ Plannings chargés :", allPlannings);

                currentPlanningKey = null;
                const noPlanningsMessage = document.getElementById('noPlanningsMessage');
                if (noPlanningsMessage) {
                    noPlanningsMessage.style.display = Object.keys(allPlannings).length > 0 ? 'none' : 'block';
                }
                
                // Apply active filter after loading all plannings
                if (activeFilter !== "all") {
                    filterPlanningsByCycle(activeFilter);
                }
            } else {
                console.error('Failed to load plannings:', data.error);
            }
        } catch (jsonError) {
            console.error('Invalid JSON response:', jsonError);
            console.error('Response text:', text.substring(0, 200) + '...'); // Log first 200 chars
        }
    } catch (error) {
        console.error('Error loading plannings:', error);
    }
}

// Modify the DOM Ready event to add the filter bar
document.addEventListener('DOMContentLoaded', function() {
    // Initialize header dates
    updateHeaderDates();
    
    // Account dropdown toggle
    document.getElementById('accountIcon').addEventListener('click', function() {
        const dropdown = document.getElementById('accountDropdown');
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('#accountContainer')) {
            document.getElementById('accountDropdown').style.display = 'none';
        }
    });
    
    // Initially hide the planning form and finish button
    document.getElementById('planningForm').style.display = 'none';
    document.getElementById('finishPlanningBtn').style.display = 'none';

    // Create modals on page load to ensure they exist
    createEditModal();
    createEditFieldsModal();
    createRecipientModal();
    
    // Add filter bar to plannings container
    const planningsContainer = document.getElementById('planningsContainer');
    if (planningsContainer) {
        const filterBar = createFilterBar();
        planningsContainer.parentNode.insertBefore(filterBar, planningsContainer);
    }
    
    // Load data from backend
    loadRecipients();
    loadSavedPlannings();
});

// Add this to the finishPlanning function to respect active filter after adding new planning
async function finishPlanning() {
    const cycle = document.getElementById('cycle').value;
    const year = document.getElementById('year').value;
    const semester = document.getElementById('semester').value;
    const planningForm = document.getElementById('planningForm');
    const startBtn = document.getElementById('startPlanningBtn');
    const finishBtn = document.getElementById('finishPlanningBtn');

    if (!currentPlanningKey || !allPlannings[currentPlanningKey]) {
        alert("Aucun planning actif à terminer.");
        return;
    }

    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Sauvegarde en cours...</p>';
    document.body.appendChild(loadingIndicator);

    console.log("Données envoyées au backend :", {
        action: 'save_planning',
        planningKey: currentPlanningKey,
        cycle,
        anneeUniversitaire: year,
        semester,
        exams: allPlannings[currentPlanningKey].exams
    });

    const response = await fetch('../db/planning_admin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'save_planning',
            planningKey: currentPlanningKey,
            cycle,
            anneeUniversitaire: year, 
            semester,
            exams: allPlannings[currentPlanningKey].exams
        })
    });

    const data = await response.json();
    document.getElementById('loadingIndicator').remove();

    if (data.success) {
        allPlannings[currentPlanningKey].id = data.planningId;
        planningForm.style.display = 'none';
        startBtn.style.display = 'inline-block';
        finishBtn.style.display = 'none';
        const tempTable = document.querySelector(`#temp-${currentPlanningKey.replace(/ /g, '_')}`);
        if (tempTable) tempTable.remove();
        
        // Save the planning to display
        savePlanningToDisplay(
            allPlannings[currentPlanningKey].cycle,
            allPlannings[currentPlanningKey].anneeUniversitaire
        );
        
        // Apply filter if any is active
        if (activeFilter !== "all") {
            filterPlanningsByCycle(activeFilter);
        }
        
        document.getElementById('cycle').value = '';
        document.getElementById('year').value = '';
        document.getElementById('year').disabled = true;
        document.getElementById('semester').value = '';
        document.getElementById('semester').disabled = true;
        startBtn.disabled = true;
        updateCycleSubtitle('');
        setTimeout(() => {
            const savedPlanning = document.getElementById(`planning-${currentPlanningKey}`);
            if (savedPlanning && savedPlanning.style.display !== 'none') {
                savedPlanning.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            currentPlanningKey = null;
        }, 100);
    } else {
        alert("Erreur lors de la sauvegarde du planning: " + data.error);
    }
}

// Add CSS for the filter bar
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .planning-filter-bar {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px 15px;
            background-color: #f8f9fa;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .filter-label {
            font-weight: 600;
            margin-right: 15px;
            color: #495057;
        }
        
        .filter-buttons {
            display: flex;
            gap: 10px;
        }
        
        .filter-btn {
            padding: 6px 12px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background-color: white;
            color: #495057;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .filter-btn:hover {
            background-color: #e9ecef;
        }
        
        .filter-btn.active-filter {
            background-color: #0d6efd;
            color: white;
            border-color: #0d6efd;
        }
    `;
    document.head.appendChild(style);
});
// Add CSS for loading spinner
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .loading-indicator {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        .loading-indicator p {
            color: white;
            margin-top: 15px;
            font-size: 18px;
        }
        .spinner {
            border: 6px solid #f3f3f3;
            border-top: 6px solid #3498db;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
});