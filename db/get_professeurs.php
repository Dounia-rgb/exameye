<?php
require_once 'config.php'; // Connexion PDO
header('Content-Type: application/json');

try {
    $stmt = $conn->prepare("
        SELECT u.idUtilisateur AS id, u.nom, u.email, p.matiereEnseignee
        FROM utilisateur u
        JOIN professeur p ON u.idUtilisateur = p.idUtilisateur
    ");
    $stmt->execute();
    $professeurs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($professeurs);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>