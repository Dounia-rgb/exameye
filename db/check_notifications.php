<?php
session_start();
require_once 'config.php'; // Fichier contenant la configuration de la connexion à la BDD

// Vérification de l'authentification
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Non autorisé']);
    exit;
}

// Connexion à la base de données
try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Erreur de connexion à la base de données']);
    exit;
}

// Récupération des notifications non lues pour l'administrateur
$adminId = $_SESSION['idUtilisateur'];
$stmt = $pdo->prepare("
    SELECT * FROM notification 
    WHERE destinataire = ? AND isRead = 0
    ORDER BY dateEnvoi DESC
");
$stmt->execute([$adminId]);
$notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Préparation de la réponse
$response = [
    'hasNewNotifications' => count($notifications) > 0,
    'notifications' => $notifications
];

header('Content-Type: application/json');
echo json_encode($response);
?>