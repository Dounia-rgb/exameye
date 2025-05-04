<?php
// Database connection details
require_once 'config.php';

// Process only POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get JSON data from request body
    $json_data = file_get_contents('php://input');
    $data = json_decode($json_data, true);
    
    if (!$data) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
        exit;
    }
    
    try {
        // Use existing connection from config.php
        global $conn;
        
        // Get current user ID (professor ID) from session
        session_start();
        $idProfesseur = $_SESSION['idUtilisateur'] ?? null;
        
        if (!$idProfesseur) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'User not authenticated']);
            exit;
        }
        
        // IMPORTANT: Check if user exists in the professeur table
        $checkProfessorQuery = $conn->prepare("SELECT idUtilisateur FROM professeur WHERE idUtilisateur = ?");
        $checkProfessorQuery->execute([$idProfesseur]);
        
        if ($checkProfessorQuery->rowCount() === 0) {
            // Professor not found in the professeur table
            // Option 1: Return an error
            http_response_code(403);
            echo json_encode([
                'success' => false, 
                'message' => 'Votre compte n\'est pas enregistré comme professeur. Veuillez contacter l\'administrateur.'
            ]);
            exit;
            
            /* Option 2: Add user to professeur table automatically 
            (uncomment this block if you want to automatically add users to the professeur table)
            
            $insertProfessor = $conn->prepare("INSERT INTO professeur (idUtilisateur, matiereEnseignee) VALUES (?, ?)");
            $insertProfessor->execute([
                $idProfesseur,
                $data['matiere'] ?? 'Non spécifiée'
            ]);
            
            // Log this auto-creation
            error_log("Auto-created professor record for user ID: $idProfesseur");
            */
        }
        
        // Get idExamen based on matiere, cycle, semestre
        $matiereQuery = $conn->prepare("SELECT idMatiere FROM matiere WHERE matiere = ?");
        $matiereQuery->execute([$data['matiere']]);
        $idMatiere = $matiereQuery->fetchColumn();
        
        if (!$idMatiere) {
            // Insert new matiere if it doesn't exist
            $insertMatiere = $conn->prepare("INSERT INTO matiere (matiere) VALUES (?)");
            $insertMatiere->execute([$data['matiere']]);
            $idMatiere = $conn->lastInsertId();
        }
        
        // Format date properly
        $formattedDate = $data['date'];
        // If date is in DD/MM/YYYY format, convert it
        if (strpos($formattedDate, '/') !== false) {
            $formattedDate = date('Y-m-d', strtotime(str_replace('/', '-', $formattedDate)));
        }
        
        // Find corresponding exam or create one if it doesn't exist
        $examQuery = $conn->prepare("
            SELECT idExamen 
            FROM examen 
            WHERE idMatiere = ? 
            AND cycle = ? 
            AND semestre = ? 
            AND date = ?
        ");
        $examQuery->execute([
            $idMatiere,
            $data['cycle'],
            $data['semestre'],
            $formattedDate
        ]);
        $idExamen = $examQuery->fetchColumn();
        
        if (!$idExamen) {
            // Create a new exam record
            $insertExam = $conn->prepare("
                INSERT INTO examen (date, heureDebut, cycle, idMatiere, semestre) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $insertExam->execute([
                $formattedDate,
                $data['heure'],
                $data['cycle'],
                $idMatiere,
                $data['semestre']
            ]);
            $idExamen = $conn->lastInsertId();
        }
        
        // Get idSalle based on location
        $salleQuery = $conn->prepare("SELECT idSalle FROM salle WHERE nomSalle = ? OR localisation = ?");
        $salleQuery->execute([$data['lieu'], $data['lieu']]);
        $idSalle = $salleQuery->fetchColumn();
        
        if (!$idSalle) {
            // Use a default salle ID or create one
            $insertSalle = $conn->prepare("INSERT INTO salle (localisation, nomSalle, capacite) VALUES (?, ?, ?)");
            $insertSalle->execute([$data['lieu'], substr($data['lieu'], 0, 10), 100]); // Default capacity
            $idSalle = $conn->lastInsertId();
        }
        
        // Cast numeric values to integers and ensure default values
        $etudiantsPresents = !empty($data['etudiantsPresents']) ? intval($data['etudiantsPresents']) : 0;
        $copiesRemises = !empty($data['copiesRemises']) ? intval($data['copiesRemises']) : 0;
        $sansIdentite = !empty($data['sansIdentite']) ? intval($data['sansIdentite']) : 0;
        
        // Calculate heureFin (2 hours after heureDebut by default)
        $heureDebut = $data['heure'] ?? '00:00';
        $heureFin = date('H:i', strtotime($heureDebut . ' + 2 hours'));
        
        // Insert into surveillance table
        $insertSurveillance = $conn->prepare("
            INSERT INTO surveillance (
                idProfesseur, 
                idExamen, 
                idSalle, 
                date, 
                heureDebut,
                heureFin,
                nombreEtudiantsPresents, 
                nombreCopiesRendues, 
                nombreEtudiantsSansCI, 
                incidents, 
                semestre, 
                cycle, 
                matiere,
                nomEtudiantSansCI,
                nomEtudiantAbsent,
                emargement
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $insertSurveillance->execute([
            $idProfesseur,
            $idExamen,
            $idSalle,
            $formattedDate,
            $heureDebut,
            $heureFin,
            $etudiantsPresents,
            $copiesRemises,
            $sansIdentite,
            $data['incidents'] ?? '',
            $data['semestre'],
            $data['cycle'],
            $data['matiere'],
            $data['sansIdentiteNoms'] ?? '',
            $data['absents'] ?? '',
            $data['emargement'] ?? ''
        ]);
        
        $idSurveillance = $conn->lastInsertId();
        
        // Get admin ID (chef département - role = administrateur)
        $adminQuery = $conn->prepare("
            SELECT idUtilisateur 
            FROM utilisateur
            WHERE role = 'administrateur'
            LIMIT 1
        ");
        $adminQuery->execute();
        $adminId = $adminQuery->fetchColumn();
        
        if (!$adminId) {
            // Default to admin ID 1 if no admin found
            $adminId = 1;
        }
        
        // Create notification for the admin
        $createNotification = $conn->prepare("
            INSERT INTO notification (
                destinataire, 
                message, 
                dateEnvoi, 
                type, 
                idReference, 
                isRead,
                url
            ) VALUES (?, ?, NOW(), ?, ?, 0, ?)
        ");
        
        $anneeValue = $data['annee'] ?? '';
        $notificationMessage = "Nouveau PV de surveillance pour {$data['matiere']} ({$data['cycle']} {$anneeValue} {$data['semestre']}) soumis par " . 
            ($_SESSION['nom'] ?? 'un professeur');
        
        $createNotification->execute([
            $adminId,
            $notificationMessage,
            'pv_surveillance',
            $idSurveillance,
            "view_pv.php?id=$idSurveillance"
        ]);
        
        // Return success
        echo json_encode([
            'success' => true, 
            'message' => 'PV enregistré avec succès',
            'id' => $idSurveillance
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false, 
            'message' => 'Erreur de base de données: ' . $e->getMessage()
        ]);
        
        // Log detailed error for administrators
        error_log('Database error in save_pv.php: ' . $e->getMessage());
    }
} else {
    // Not a POST request
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}