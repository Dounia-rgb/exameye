// ==================== DATA STORAGE MODULE ====================
// This module handles storing PV data in local storage and sending notifications

// Initialize database structure in local storage if it doesn't exist
function initLocalDatabase() {
    // Check if the database structure exists
    if (!localStorage.getItem('pvDatabase')) {
        // Create initial database structure
        const initialDatabase = {
            surveillances: [],
            notifications: [],
            users: [
                // Default admin user (chef département)
                {
                    idUtilisateur: 1,
                    nom: "dounia",
                    email: "dounianis2@gmail.com",
                    motDePasse: "123456", // In a real app, this would be hashed
                    role: "administrateur"
                },
                // Example professor user
                {
                    idUtilisateur: 2,
                    nom: "Professeur Test",
                    email: "prof@universite.edu",
                    motDePasse: "prof123", // In a real app, this would be hashed
                    role: "professeur",
                    matiereEnseignee: "Mathématiques"
                }
            ],
            // Other initial data can be added here
            lastId: {
                surveillance: 0,
                notification: 0
            }
        };
        
        // Save to localStorage
        localStorage.setItem('pvDatabase', JSON.stringify(initialDatabase));
        console.log('Local database initialized');
    }
}

// Get current user (in a real app, this would use authentication)
// For demo purposes, we're simulating the professor as the current user
function getCurrentUser() {
    // Return the professor user (ID 2) for this demo
    return {
        idUtilisateur: 2,
        nom: "Professeur Test",
        email: "prof@universite.edu",
        role: "professeur",
        matiereEnseignee: "Mathématiques"
    };
}

// Get database from localStorage
function getDatabase() {
    return JSON.parse(localStorage.getItem('pvDatabase'));
}

// Save database to localStorage
function saveDatabase(database) {
    localStorage.setItem('pvDatabase', JSON.stringify(database));
}

// Save PV data to localStorage
// Save PV data to localStorage
function savePVData(pvData) {
    const database = getDatabase();
    const currentUser = getCurrentUser();
    
    // Generate a new surveillance ID
    const newSurveillanceId = database.lastId.surveillance + 1;
    
    // Create a new surveillance record WITHOUT the huge PDF data
    const surveillance = {
        idSurveillance: newSurveillanceId,
        idProfesseur: currentUser.idUtilisateur,
        date: pvData.date,
        heureDebut: pvData.heure,
        nombreEtudiantsPresents: pvData.etudiantsPresents,
        nombreCopiesRendues: pvData.copiesRemises,
        nombreEtudiantsSansCI: pvData.sansIdentite,
        incidents: pvData.incidents,
        semestre: pvData.semestre,
        cycle: pvData.cycle,
        matiere: pvData.matiere,
        nomEtudiantSansCI: pvData.sansIdentiteNoms,
        nomEtudiantAbsent: pvData.absents,
        emargement: pvData.emergement,
        // Don't store the PDF data in localStorage
        // pdfData: pvData.pdfData, 
        hasPDF: true, // Just indicate that a PDF was generated
        envoyeLe: new Date().toISOString(),
        status: "Envoyé" // Could be "Envoyé", "Vu", "Traité", etc.
    };
    
    // Add to surveillances array
    database.surveillances.push(surveillance);
    
    // Update last ID
    database.lastId.surveillance = newSurveillanceId;
    
    // Create notification for admin (chef département)
    const newNotificationId = database.lastId.notification + 1;
    const notification = {
        idNotification: newNotificationId,
        destinataire: 1, // ID of the admin (chef département)
        message: `Nouveau PV de surveillance soumis par ${currentUser.nom} pour ${pvData.matiere} (${pvData.cycle} ${pvData.annee})`,
        dateEnvoi: new Date().toISOString(),
        type: "pv_soumis",
        idReference: newSurveillanceId, // Reference to the surveillance
        isRead: false,
        url: `/admin/pv/${newSurveillanceId}`
    };
    
    // Add to notifications array
    database.notifications.push(notification);
    
    // Update last ID
    database.lastId.notification = newNotificationId;
    
    // Save updated database
    saveDatabase(database);
    
    // Return the new surveillance ID
    return newSurveillanceId;
}

// Check if PV was actually sent (for confirmation purposes)
function confirmPVSent(idSurveillance) {
    const database = getDatabase();
    
    // Check if surveillance exists in database
    const surveillance = database.surveillances.find(s => s.idSurveillance === idSurveillance);
    return !!surveillance; // Return true if found, false otherwise
}

// Get all pending PVs for the current user
function getPendingPVs() {
    const database = getDatabase();
    const currentUser = getCurrentUser();
    
    // Get all surveillances by this professor
    return database.surveillances.filter(s => s.idProfesseur === currentUser.idUtilisateur);
}

// Initialize database when script loads
initLocalDatabase();
