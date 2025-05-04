<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['idUtilisateur'])) {
    http_response_code(401);
    echo json_encode(["error" => "Non autorisé"]);
    exit;
}

$idProfesseur = $_SESSION['idUtilisateur'];

$sql = "
SELECT 
    s.date,
    s.heureDebut, 
    s.cycle, 
    s.matiere, 
    s.semestre, 
    s.idGroupe,
    s.convocationGroupId, -- <-- NEW FIELD FOR GROUPING
    u.nom AS nomProfesseur
FROM surveillance s
JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
WHERE s.idProfesseur = ?
  AND DATE(s.date) >= CURDATE() -- ✅ Important pour ne comparer que la date
ORDER BY s.convocationGroupId, s.date, s.heureDebut
";

$stmt = $conn->prepare($sql);
$stmt->execute([$idProfesseur]);
$convocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($convocations);
