<?php
// Désactive l'affichage des erreurs dans la sortie
ini_set('display_errors', 0);
error_reporting(0);

header("Content-Type: application/json");

require_once("config.php");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'get_all_matieres') {
        try {
            $stmt = $conn->prepare("SELECT idMatiere, matiere AS nom FROM matiere");
            $stmt->execute();
            $matieres = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "matieres" => $matieres]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        exit;
    }
    
    // Récupérer tous les groupes
    if ($action === 'get_all_groupes') {
        try {
            $stmt = $conn->prepare("SELECT idGroupe, section, groupe FROM groupe");
            $stmt->execute();
            $groupes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "groupes" => $groupes]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        exit;
    }
    
if ($action === 'get_all_salles') {
    try {
        $stmt = $conn->prepare("SELECT idSalle, nomSalle FROM salle");
        $stmt->execute();
        $salles = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(["success" => true, "salles" => $salles]);
    } catch (PDOException $e) {
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}
    if ($action === 'get_recipients') {
        $stmt = $conn->prepare("SELECT idUtilisateur AS id, nom AS name, email FROM utilisateur WHERE role = 'professeur'");
        $stmt->execute();
        $recipients = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(["success" => true, "recipients" => $recipients]);
        exit;
    }

    if ($action === 'get_plannings') {
        $sql = "SELECT p.idPlanning, p.dateDebut, p.dateFin, p.duree, p.anneeUniversitaire, p.idSalle,
            e.date, e.heureDebut AS heureDebut, ADDTIME(e.heureDebut, p.duree) AS heureFin,
            e.cycle, e.semestre, e.idMatiere, e.idExamen, 
            g.niveau AS groupeNiveau, g.section AS groupeSection, g.groupe AS groupeNum, 
            m.matiere AS matiere,
            s.nomSalle AS salle
            FROM planningexamen p
            JOIN examen e ON p.idExamen = e.idExamen
            JOIN groupe g ON p.idGroupe = g.idGroupe
            JOIN matiere m ON e.idMatiere = m.idMatiere
            LEFT JOIN salle s ON p.idSalle = s.idSalle";
        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $plannings = [];

            foreach ($rows as $row) {
                $key = $row['cycle'] . '_' . $row['anneeUniversitaire'] . '_' . str_replace(' ', '_', $row['semestre']);
                if (!isset($plannings[$key])) {
                    $plannings[$key] = [
                        'id' => $row['idPlanning'],
                        'cycle' => $row['cycle'],
                        'anneeUniversitaire' => $row['anneeUniversitaire'],
                        'semester' => $row['semestre'],
                        'exams' => []
                    ];
                }

                $plannings[$key]['exams'][] = [
                    'date' => $row['date'],
                    'heureDebut' => $row['heureDebut'],
                    'heureFin' => $row['heureFin'],
                    'matiere' => $row['matiere'],
                    'salle' => $row['salle'] ? $row['salle'] : 'Non spécifiée', // Utilise la valeur de la BD
                    'groupe' => $row['groupeSection'] . ' - ' . $row['groupeNum']
                ];
            }

            echo json_encode(["success" => true, "plannings" => $plannings]);
    } catch (PDOException $e) {
        echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
    }
    exit;
    }
    // Ajouter ceci dans la section "if ($method === 'GET')" de votre code
    if ($action === 'get_planning_detail') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        
        if (!$id) {
            echo json_encode(["success" => false, "error" => "ID de planning non spécifié"]);
            exit;
        }    
    
        try {
            $sql = "SELECT p.idPlanning, p.dateDebut, p.dateFin, p.duree, p.anneeUniversitaire, p.idSalle,
                    e.date, e.heureDebut AS heureDebut, ADDTIME(e.heureDebut, p.duree) AS heureFin,
                    e.cycle, e.semestre, e.idMatiere, e.idExamen, 
                    g.niveau AS groupeNiveau, g.section AS groupeSection, g.groupe AS groupeNum, 
                    m.matiere AS matiere,
                    s.nomSalle AS salle
                    FROM planningexamen p
                    JOIN examen e ON p.idExamen = e.idExamen
                    JOIN groupe g ON p.idGroupe = g.idGroupe
                    JOIN matiere m ON e.idMatiere = m.idMatiere
                    LEFT JOIN salle s ON p.idSalle = s.idSalle
                    WHERE p.idPlanning = ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([$id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($rows)) {
            echo json_encode(["success" => false, "error" => "Planning non trouvé"]);
            exit;
        }
        
        // Formater les données du planning
        $planning = [
            'id' => $rows[0]['idPlanning'],
            'cycle' => $rows[0]['cycle'],
            'anneeUniversitaire' => $rows[0]['anneeUniversitaire'],
            'semester' => $rows[0]['semestre'],
            'exams' => []
        ];
        
        foreach ($rows as $row) {
            $planning['exams'][] = [
                'date' => $row['date'],
                'heureDebut' => $row['heureDebut'],
                'heureFin' => $row['heureFin'],
                'matiere' => $row['matiere'],
                'salle' => $row['salle'] ?: 'Non spécifiée', // Utiliser la valeur de la BD ou "Non spécifiée" si null
                'groupe' => $row['groupeSection'] . ' - ' . $row['groupeNum']
            ];
        }
        
        echo json_encode(["success" => true, "planning" => $planning]);
    } catch (PDOException $e) {
        echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
    }
    exit;
}

    echo json_encode(["success" => false, "error" => "Action non reconnue"]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $action = $input['action'] ?? '';

    if ($action === 'save_planning') {
        $cycle = $input['cycle'];
        $anneeUniversitaire = $input['anneeUniversitaire'];
        $semester = $input['semester'];
        $exams = $input['exams'];

        try {
            $stmtExamen = $conn->prepare("INSERT INTO examen (date, heureDebut, cycle, semestre, idMatiere) VALUES (?, ?, ?, ?, ?)");
            $stmtPlanning = $conn->prepare("INSERT INTO planningexamen (dateDebut, dateFin, idAdministrateur, idProfesseur, idExamen, idGroupe, idSalle, duree, anneeUniversitaire) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($exams as $exam) {
                error_log(json_encode($exam)); // ← ajoute ça

                $date = $exam['date'] ?? null;
    $heureDebut = $exam['heureDebut'] ?? null;
    $idMatiere = $exam['idMatiere'] ?? null;
    $idGroupe = $exam['idGroupe'] ?? null;
    $idSalle = $exam['idSalle'] ?? null;

    if (!$idGroupe) {
        echo json_encode(["success" => false, "error" => "Le champ 'idGroupe' est vide ou non défini."]);
        exit;
    }
                // Étape 1 : Créer un nouvel examen
                $stmtExamen->execute([$date, $heureDebut, $cycle, $semester, $idMatiere]);
                $idExamen = $conn->lastInsertId();

                // Étape 2 : Lier cet examen à un planning
                $idAdministrateur = 1; // à ajuster dynamiquement si nécessaire
                $idProfesseur = null;
                $dateDebut = $date;
                $dateFin = $date;
                $duree = '01:00:00'; // à ajuster si nécessaire
               
                $stmtPlanning->execute([$dateDebut, $dateFin, $idAdministrateur, $idProfesseur, $idExamen, $idGroupe, $idSalle, $duree, $anneeUniversitaire]);

                $lastPlanningId = $conn->lastInsertId(); // ← ✅ Maintenant ici, après l'insertion du planning
            }
            echo json_encode(["success" => true, "planningId" => $lastPlanningId]);

        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'send_planning') {
        $planningId = $input['planningId']; // ID of the created planning
        $professorIds = $input['professorIds']; // Array of professor IDs to notify
    
        try {
            foreach ($professorIds as $id) {
                $planningUrl = "planning.html?id=" . $planningId; // URL to the planning page
                
                // Prepare SQL query to insert notification
                $stmt = $conn->prepare("INSERT INTO notification (destinataire, message, dateEnvoi, type, url, idReference) 
                                        VALUES (?, ?, NOW(), 'planning', ?, ?)");
                $stmt->execute([$id, "Un nouveau planning d'examen vous a été assigné (ID: $planningId)", $planningUrl, $planningId]);
            }
            echo json_encode(["success" => true, "planningId" => $lastPlanningId]);

        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }
    if (isset($input['planningId']) && isset($input['professorIds'])) {
        $planningId = $input['planningId']; // ID of the created planning
        $professorIds = $input['professorIds']; // Array of professor IDs to notify
    
        try {
            foreach ($professorIds as $id) {
                $planningUrl = "planning.html?id=" . $planningId; // URL to the planning page
                
                // Prepare SQL query to insert notification
                $stmt = $conn->prepare("INSERT INTO notification (destinataire, message, dateEnvoi, type, url, idReference) 
                                        VALUES (?, ?, NOW(), 'planning', ?, ?)");
                $stmt->execute([$id, "Un nouveau planning d'examen vous a été assigné (ID: $planningId)", $planningUrl, $planningId]);
            }
            echo json_encode(["success" => true, "planningId" => $planningId]);
    
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }
    
    // Réponse par défaut pour les requêtes POST non traitées
    echo json_encode(["success" => false, "error" => "Action non reconnue ou paramètres manquants"]);
}
?>
