<?php
session_start();
require 'config.php';

// Activer les erreurs pour le debug
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Si on demande les professeurs (via GET ?role=professeur)
if (isset($_GET['role']) && $_GET['role'] === 'professeur') {
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
    exit(); // ✅ Important: Stop here
}

// Sinon, retourner les infos de l'utilisateur connecté
if (!isset($_SESSION['idUtilisateur'])) {
    echo json_encode(["error" => "Utilisateur non connecté."]);
    exit();
}

$idUtilisateur = $_SESSION['idUtilisateur'];

$stmt = $conn->prepare("SELECT nom, email, motDePasse FROM utilisateur WHERE idUtilisateur = ?");
$stmt->execute([$idUtilisateur]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    echo json_encode($user);
} else {
    echo json_encode(["error" => "Utilisateur non trouvé."]);
}
?>
