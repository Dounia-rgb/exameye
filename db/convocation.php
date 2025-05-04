<?php
// Set error reporting but buffer all output
ob_start();
ini_set('display_errors', 0); 
error_reporting(E_ALL);

// Only set header once
header('Content-Type: application/json');

require_once("config.php");

// Get and decode JSON input
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Clear any buffered output before sending JSON response
ob_clean();

// Debugging: Log the raw input
file_put_contents('debug_input.log', $json);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON received",
        "error" => json_last_error_msg()
    ]);
    exit;
}

// Debugging: Log the parsed data
file_put_contents('debug_parsed.log', print_r($data, true));

if (!$data) {
    echo json_encode(["success" => false, "message" => "Invalid JSON input."]);
    exit;
}

$idProfesseur = $data["idProfesseur"] ?? null;
$convocations = $data["convocations"] ?? [];

if (!$idProfesseur || empty($convocations)) {
    echo json_encode(["success" => false, "message" => "Missing required data: idProfesseur or convocations."]);
    exit;
}

// Get professor name for notification
try {
    $stmtProf = $conn->prepare("SELECT nom, prenom FROM utilisateur WHERE idUtilisateur = ?");
    $stmtProf->execute([$idProfesseur]);
    $prof = $stmtProf->fetch(PDO::FETCH_ASSOC);
    $profName = $prof ? $prof['nom'] . ' ' . $prof['prenom'] : 'Professeur';
} catch (PDOException $e) {
    $profName = 'Professeur';
}

$errors = [];

try {
    $conn->beginTransaction();

    // Generate new convocation group ID
    $stmtGroup = $conn->query("SELECT MAX(convocationGroupId) AS maxGroup FROM surveillance");
    $rowGroup = $stmtGroup->fetch(PDO::FETCH_ASSOC);
    $newGroupId = $rowGroup['maxGroup'] + 1;
    if (!$newGroupId) $newGroupId = 1;

    foreach ($convocations as $index => $conv) {
        // Debugging: Log each convocation
        file_put_contents('debug_conv_'.$index.'.log', print_r($conv, true));

        $matiere = $conv["matiere"] ?? null;
        $date = $conv["date"] ?? null;
        $heureDebut = $conv["heureDebut"] ?? $conv["heure"] ?? null;
        $heureFin = $conv["heureFin"] ?? null;
        $cycle = $conv["cycle"] ?? null;
        $semestre = $conv["semestre"] ?? null;

        if (!$matiere) $errors[] = "Matière manquante pour la convocation #".($index+1);
        if (!$date) $errors[] = "Date manquante pour la convocation #".($index+1);
        if (!$heureDebut) $errors[] = "Heure de début manquante pour la convocation #".($index+1);
        if (!$cycle) $errors[] = "Cycle manquant pour la convocation #".($index+1);
        if (!$semestre) $errors[] = "Semestre manquant pour la convocation #".($index+1);

        if (!$matiere || !$date || !$heureDebut || !$cycle || !$semestre) {
            continue;
        }

        // Format dates
        $dateFormatted = date('Y-m-d H:i:s', strtotime($date));
        $heureDebutFormatted = date('H:i:s', strtotime($heureDebut));
        $heureFinFormatted = $heureFin ? date('H:i:s', strtotime($heureFin)) : null;

        try {
            // Get idMatiere
            $stmtMatiere = $conn->prepare("SELECT idMatiere FROM matiere WHERE matiere = ?");
            $stmtMatiere->execute([$matiere]);
            $matiereRow = $stmtMatiere->fetch(PDO::FETCH_ASSOC);
            $idMatiere = $matiereRow ? $matiereRow["idMatiere"] : null;

            if (!$idMatiere) {
                $errors[] = "Matière '$matiere' non trouvée dans la base de données.";
                continue;
            }
        } catch (PDOException $e) {
            $errors[] = "Erreur lors de la recherche de la matière: " . $e->getMessage();
            continue;
        }

        try {
            // Insert into examen
            $stmtExam = $conn->prepare("INSERT INTO examen (date, heureDebut, cycle, idMatiere, semestre) VALUES (?, ?, ?, ?, ?)");
            $success = $stmtExam->execute([$dateFormatted, $heureDebutFormatted, $cycle, $idMatiere, $semestre]);
            if (!$success) {
                $errors[] = "Erreur lors de l'insertion dans examen pour $matiere le $date.";
                continue;
            }

            $idExamen = $conn->lastInsertId();
        } catch (PDOException $e) {
            $errors[] = "Erreur lors de l'insertion dans examen: " . $e->getMessage();
            continue;
        }

        try {
            // Insert into surveillance with convocationGroupId
            $stmtSurv = $conn->prepare("
                INSERT INTO surveillance (
                    idProfesseur, idExamen, date, heureDebut, heureFin,
                    nombreEtudiantsPresents, nombreCopiesRendues, nombreEtudiantsSansCI,
                    incidents, semestre, cycle, matiere, convocationGroupId
                ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, '', ?, ?, ?, ?)
            ");
            $success = $stmtSurv->execute([
                $idProfesseur, $idExamen, $dateFormatted, $heureDebutFormatted, $heureFinFormatted,
                $semestre, $cycle, $matiere, $newGroupId
            ]);

            if (!$success) {
                $errors[] = "Erreur lors de l'insertion dans surveillance pour $matiere le $date.";
                continue;
            }
        } catch (PDOException $e) {
            $errors[] = "Erreur lors de l'insertion dans surveillance: " . $e->getMessage();
            continue;
        }

        try {
            $displayDate = date('d/m/Y', strtotime($date));
            $displayTime = date('H:i', strtotime($heureDebut));

            $message = "Vous avez reçu une nouvelle convocation pour $matiere le $displayDate à $displayTime. (Groupe $newGroupId)";
            $stmtNotif = $conn->prepare("
                INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead) 
                VALUES (?, ?, NOW(), 'convocation', ?, 0)
            ");
            $stmtNotif->execute([$idProfesseur, $message, $idExamen]);
        } catch (PDOException $e) {
            $errors[] = "Erreur lors de l'insertion de la notification: " . $e->getMessage();
        }
    }

    if (empty($errors)) {
        $conn->commit();
        echo json_encode(["success" => true]);
    } else {
        $conn->rollBack();
        echo json_encode(["success" => false, "errors" => $errors]);
    }
} catch (Exception $e) {
    $conn->rollBack();
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
}
