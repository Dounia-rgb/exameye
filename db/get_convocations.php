<?php
require 'config.php';
header('Content-Type: application/json');

if (!isset($_GET['idProfesseur'])) {
    echo json_encode(['error' => 'ID du professeur manquant']);
    exit();
}

$idProf = $_GET['idProfesseur'];

try {
    $stmt = $conn->prepare("
        SELECT s.date, s.heureDebut, s.matiere, s.semestre, s.cycle, sa.numero AS salle
        FROM surveillance s
        JOIN salle sa ON sa.idSalle = s.idSalle
        WHERE s.idProfesseur = ?
        ORDER BY s.date, s.heureDebut
    ");
    $stmt->execute([$idProf]);

    $convocations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($convocations);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}

