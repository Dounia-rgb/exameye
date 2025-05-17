<?php

ini_set('display_errors', 0);
error_reporting(0);

header("Content-Type: application/json");

require_once("config.php");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    $professorId = $_GET['professorId'] ?? null;

    // Move all GET actions inside this block
    if ($action === 'get_professor_plannings' && $professorId) {
        try {
            // Requête principale pour obtenir les plannings assignés au professeur
            $sql = "SELECT DISTINCT p.idPlanning, p.dateDebut, p.dateFin, p.duree, p.anneeUniversitaire, 
                    e.date, e.heureDebut AS heureDebut, ADDTIME(e.heureDebut, p.duree) AS heureFin,
                    e.cycle, e.semestre, e.idExamen, 
                    m.matiere AS matiere
                    FROM planningexamen p
                    JOIN examen e ON p.idExamen = e.idExamen
                    JOIN matiere m ON e.idMatiere = m.idMatiere
                    WHERE p.idProfesseur = ?
                    ORDER BY e.date, e.heureDebut";
            
            $stmt = $conn->prepare($sql);
            $stmt->execute([$professorId]);
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
                
                // Récupérer toutes les salles pour cet examen
                $sqlSalles = "SELECT DISTINCT s.idSalle, s.nomSalle 
                              FROM planningexamen pe 
                              JOIN salle s ON pe.idSalle = s.idSalle 
                              WHERE pe.idExamen = ?";
                              
                $stmtSalles = $conn->prepare($sqlSalles);
                $stmtSalles->execute([$row['idExamen']]);
                $salles = $stmtSalles->fetchAll(PDO::FETCH_ASSOC);
                
                $sallesArray = array_map(function($salle) {
                    return $salle['nomSalle'];
                }, $salles);
                
                // Récupérer tous les groupes pour cet examen
                $sqlGroupes = "SELECT DISTINCT g.idGroupe, g.section, g.groupe
                               FROM planningexamen pe
                               JOIN groupe g ON pe.idGroupe = g.idGroupe
                               WHERE pe.idExamen = ?
                               UNION
                               SELECT DISTINCT g.idGroupe, g.section, g.groupe
                               FROM planningexamen_groupes peg
                               JOIN planningexamen pe ON peg.idPlanning = pe.idPlanning
                               JOIN groupe g ON peg.idGroupe = g.idGroupe
                               WHERE pe.idExamen = ?";
                
                $stmtGroupes = $conn->prepare($sqlGroupes);
                $stmtGroupes->execute([$row['idExamen'], $row['idExamen']]);
                $groupes = $stmtGroupes->fetchAll(PDO::FETCH_ASSOC);
                
                $groupesArray = array_map(function($groupe) {
                    return $groupe['section'] . ' - ' . $groupe['groupe'];
                }, $groupes);
                
                // Identifiant unique pour l'examen
                $examId = $row['date'] . '_' . $row['heureDebut'] . '_' . $row['matiere'];
                
                // Vérifier si cet examen existe déjà dans le tableau
                $examExists = false;
                foreach ($plannings[$key]['exams'] as $index => $existingExam) {
                    $existingExamId = $existingExam['date'] . '_' . $existingExam['heureDebut'] . '_' . $existingExam['matiere'];
                    
                    if ($existingExamId === $examId) {
                        // L'examen existe déjà, on fusionne les salles et les groupes
                        $examExists = true;
                        
                        // Fusionner les salles (éviter les doublons)
                        $mergedSalles = array_unique(array_merge($existingExam['sallesArray'], $sallesArray));
                        $plannings[$key]['exams'][$index]['sallesArray'] = $mergedSalles;
                        $plannings[$key]['exams'][$index]['salles'] = implode(', ', $mergedSalles);
                        
                        // Fusionner les groupes (éviter les doublons)
                        $mergedGroupes = array_unique(array_merge($existingExam['groupesArray'], $groupesArray));
                        $plannings[$key]['exams'][$index]['groupesArray'] = $mergedGroupes;
                        $plannings[$key]['exams'][$index]['groupe'] = implode(', ', $mergedGroupes);
                        
                        break;
                    }
                }
                
                if (!$examExists) {
                    // Nouveau examen à ajouter
                    $plannings[$key]['exams'][] = [
                        'idExamen' => $row['idExamen'],
                        'date' => $row['date'],
                        'heureDebut' => $row['heureDebut'],
                        'heureFin' => $row['heureFin'],
                        'matiere' => $row['matiere'],
                        'sallesArray' => $sallesArray,
                        'salles' => implode(', ', $sallesArray),
                        'groupesArray' => $groupesArray,
                        'groupe' => implode(', ', $groupesArray)
                    ];
                }
            }
            
            echo json_encode(["success" => true, "plannings" => $plannings]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }

    else if ($action === 'get_planning_detail') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        
        if (!$id) {
            echo json_encode(["success" => false, "error" => "ID de planning non spécifié"]);
            exit;
        }    
    
        try {
            $sql = "SELECT p.idPlanning, p.dateDebut, p.dateFin, p.duree, p.anneeUniversitaire, 
                    e.date, e.heureDebut AS heureDebut, ADDTIME(e.heureDebut, p.duree) AS heureFin,
                    e.cycle, e.semestre, e.idExamen, 
                    m.matiere AS matiere
                    FROM planningexamen p
                    JOIN examen e ON p.idExamen = e.idExamen
                    JOIN matiere m ON e.idMatiere = m.idMatiere
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
                // Récupérer toutes les salles pour cet examen
                $sqlSalles = "SELECT DISTINCT s.idSalle, s.nomSalle 
                              FROM planningexamen pe 
                              JOIN salle s ON pe.idSalle = s.idSalle 
                              WHERE pe.idExamen = ?";
                              
                $stmtSalles = $conn->prepare($sqlSalles);
                $stmtSalles->execute([$row['idExamen']]);
                $salles = $stmtSalles->fetchAll(PDO::FETCH_ASSOC);
                
                $sallesArray = array_map(function($salle) {
                    return $salle['nomSalle'];
                }, $salles);
                
                // Récupérer tous les groupes pour cet examen
                $sqlGroupes = "SELECT DISTINCT g.idGroupe, g.section, g.groupe
                               FROM planningexamen pe
                               JOIN groupe g ON pe.idGroupe = g.idGroupe
                               WHERE pe.idExamen = ?
                               UNION
                               SELECT DISTINCT g.idGroupe, g.section, g.groupe
                               FROM planningexamen_groupes peg
                               JOIN planningexamen pe ON peg.idPlanning = pe.idPlanning
                               JOIN groupe g ON peg.idGroupe = g.idGroupe
                               WHERE pe.idExamen = ?";
                
                $stmtGroupes = $conn->prepare($sqlGroupes);
                $stmtGroupes->execute([$row['idExamen'], $row['idExamen']]);
                $groupes = $stmtGroupes->fetchAll(PDO::FETCH_ASSOC);
                
                $groupesArray = array_map(function($groupe) {
                    return $groupe['section'] . ' - ' . $groupe['groupe'];
                }, $groupes);
                
                // Identifiant unique pour l'examen
                $examId = $row['date'] . '_' . $row['heureDebut'] . '_' . $row['matiere'];
                
                // Vérifier si cet examen existe déjà dans le tableau
                $examExists = false;
                foreach ($planning['exams'] as $index => $existingExam) {
                    $existingExamId = $existingExam['date'] . '_' . $existingExam['heureDebut'] . '_' . $existingExam['matiere'];
                    
                    if ($existingExamId === $examId) {
                        // L'examen existe déjà, on fusionne les salles et les groupes
                        $examExists = true;
                        
                        // Fusionner les salles (éviter les doublons)
                        $mergedSalles = array_unique(array_merge($existingExam['sallesArray'], $sallesArray));
                        $planning['exams'][$index]['sallesArray'] = $mergedSalles;
                        $planning['exams'][$index]['salles'] = implode(', ', $mergedSalles);
                        
                        // Fusionner les groupes (éviter les doublons)
                        $mergedGroupes = array_unique(array_merge($existingExam['groupesArray'], $groupesArray));
                        $planning['exams'][$index]['groupesArray'] = $mergedGroupes;
                        $planning['exams'][$index]['groupe'] = implode(', ', $mergedGroupes);
                        
                        break;
                    }
                }
                
                if (!$examExists) {
                    // Nouveau examen à ajouter
                    $planning['exams'][] = [
                        'idExamen' => $row['idExamen'],
                        'date' => $row['date'],
                        'heureDebut' => $row['heureDebut'],
                        'heureFin' => $row['heureFin'],
                        'matiere' => $row['matiere'],
                        'sallesArray' => $sallesArray,
                        'salles' => implode(', ', $sallesArray),
                        'groupesArray' => $groupesArray,
                        'groupe' => implode(', ', $groupesArray)
                    ];
                }
            }
            
            echo json_encode(["success" => true, "planning" => $planning]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }

    // Move these endpoint handlers inside the GET block
    else if ($action === 'get_all_salles') {
        try {
            $sql = "SELECT idSalle, nomSalle FROM salle ORDER BY nomSalle";
            $stmt = $conn->query($sql);
            $salles = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "salles" => $salles]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }

    else if ($action === 'get_all_groupes') {
        try {
            $sql = "SELECT idGroupe, section, groupe FROM groupe ORDER BY section, groupe";
            $stmt = $conn->query($sql);
            $groupes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "groupes" => $groupes]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }

    else if ($action === 'get_all_matieres') {
        try {
            $sql = "SELECT idMatiere, matiere AS nom FROM matiere ORDER BY matiere";
            $stmt = $conn->query($sql);
            $matieres = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "matieres" => $matieres]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }

    else if ($action === 'get_recipients') {
        try {
            $sql = "SELECT u.idUtilisateur AS id, u.nom AS name, u.email 
                    FROM utilisateur u
                    JOIN professeur p ON u.idUtilisateur = p.idUtilisateur
                    WHERE u.role = 'professeur'";
            $stmt = $conn->query($sql);
            $recipients = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "recipients" => $recipients]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }

    else if ($action === 'get_plannings') {
        try {
            // First get unique plannings
            $sql = "SELECT DISTINCT e.cycle, p.anneeUniversitaire, e.semestre 
                    FROM planningexamen p
                    JOIN examen e ON p.idExamen = e.idExamen
                    ORDER BY e.cycle, p.anneeUniversitaire, e.semestre";
            $stmt = $conn->query($sql);
            $planningGroups = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Format the data as expected by your JavaScript
            $formattedPlannings = [];
            
            // For each planning group, get the exams
            foreach ($planningGroups as $planning) {
                $cycle = $planning['cycle'];
                $anneeUniv = $planning['anneeUniversitaire'];
                $semestre = $planning['semestre'];
                $key = $cycle . '_' . $anneeUniv . '_' . str_replace(' ', '_', $semestre);
                
                // Get the first planning ID for this group (we need one ID for reference)
                $sqlPlanningId = "SELECT MIN(p.idPlanning) as idPlanning 
                                  FROM planningexamen p 
                                  JOIN examen e ON p.idExamen = e.idExamen 
                                  WHERE e.cycle = ? AND p.anneeUniversitaire = ? AND e.semestre = ?";
                $stmtPlanningId = $conn->prepare($sqlPlanningId);
                $stmtPlanningId->execute([$cycle, $anneeUniv, $semestre]);
                $planningIdResult = $stmtPlanningId->fetch(PDO::FETCH_ASSOC);
                $planningId = $planningIdResult['idPlanning'];
                
                // Create the planning object
                $formattedPlannings[$key] = [
                    'id' => $planningId,
                    'cycle' => $cycle,
                    'anneeUniversitaire' => $anneeUniv,
                    'semester' => $semestre,
                    'exams' => []
                ];
                
                // Get all exams for this planning group
                $sqlExams = "SELECT DISTINCT e.idExamen, e.date, e.heureDebut, 
                                ADDTIME(e.heureDebut, p.duree) AS heureFin, 
                                m.matiere, p.duree
                             FROM planningexamen p
                             JOIN examen e ON p.idExamen = e.idExamen
                             JOIN matiere m ON e.idMatiere = m.idMatiere
                             WHERE e.cycle = ? AND p.anneeUniversitaire = ? AND e.semestre = ?
                             ORDER BY e.date, e.heureDebut";
                $stmtExams = $conn->prepare($sqlExams);
                $stmtExams->execute([$cycle, $anneeUniv, $semestre]);
                $exams = $stmtExams->fetchAll(PDO::FETCH_ASSOC);
                
                // Process each exam
                foreach ($exams as $exam) {
                    // Get rooms for this exam
                    $sqlSalles = "SELECT DISTINCT s.idSalle, s.nomSalle 
                                 FROM planningexamen pe 
                                 JOIN salle s ON pe.idSalle = s.idSalle 
                                 WHERE pe.idExamen = ?";
                    $stmtSalles = $conn->prepare($sqlSalles);
                    $stmtSalles->execute([$exam['idExamen']]);
                    $salles = $stmtSalles->fetchAll(PDO::FETCH_ASSOC);
                    $sallesArray = array_map(function($salle) {
                        return $salle['nomSalle'];
                    }, $salles);
                    
                    // Get groups for this exam
                    $sqlGroupes = "SELECT DISTINCT g.idGroupe, g.section, g.groupe
                                  FROM planningexamen pe
                                  JOIN groupe g ON pe.idGroupe = g.idGroupe
                                  WHERE pe.idExamen = ?
                                  UNION
                                  SELECT DISTINCT g.idGroupe, g.section, g.groupe
                                  FROM planningexamen_groupes peg
                                  JOIN planningexamen pe ON peg.idPlanning = pe.idPlanning
                                  JOIN groupe g ON peg.idGroupe = g.idGroupe
                                  WHERE pe.idExamen = ?";
                    $stmtGroupes = $conn->prepare($sqlGroupes);
                    $stmtGroupes->execute([$exam['idExamen'], $exam['idExamen']]);
                    $groupes = $stmtGroupes->fetchAll(PDO::FETCH_ASSOC);
                    $groupesArray = array_map(function($groupe) {
                        return $groupe['section'] . ' - ' . $groupe['groupe'];
                    }, $groupes);
                    
                    // Add the exam to the planning
                    $formattedPlannings[$key]['exams'][] = [
                        'idExamen' => $exam['idExamen'],
                        'date' => $exam['date'],
                        'heureDebut' => $exam['heureDebut'],
                        'heureFin' => $exam['heureFin'],
                        'matiere' => $exam['matiere'],
                        'sallesArray' => $sallesArray,
                        'salles' => implode(', ', $sallesArray),
                        'groupesArray' => $groupesArray,
                        'groupe' => implode(', ', $groupesArray)
                    ];
                }
            }
            
            echo json_encode(["success" => true, "plannings" => $formattedPlannings]);
        } catch (PDOException $e) {
            echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
        }
        exit;
    }
    
    // Default response for unrecognized GET actions
    echo json_encode(["success" => false, "error" => "Action non reconnue"]);
    exit;
}

// Les requêtes POST (s'il y en a pour le côté professeur)
if ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $action = $input['action'] ?? '';

    // Répondre par défaut pour les requêtes POST non reconnues
    echo json_encode(["success" => false, "error" => "Action non reconnue ou non autorisée"]);
}
?>