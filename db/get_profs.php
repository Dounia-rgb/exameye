<?php
require 'config.php';

try {
    $stmt = $conn->prepare("
        SELECT u.idUtilisateur, u.nom
        FROM utilisateur u
        INNER JOIN professeur p ON u.idUtilisateur = p.idUtilisateur
        WHERE u.role = 'professeur'
    ");
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($results);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
