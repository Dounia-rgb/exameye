<?php
session_start();
require_once 'config.php'; // PDO connection
header('Content-Type: application/json');

// Check if user is logged in and is an administrator
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied or not logged in as administrator']);
    exit;
}

$adminId = $_SESSION['idUtilisateur'];

try {
    // Query to get all replies sent to this administrator
    $stmt = $conn->prepare("
        SELECT 
            n.idNotification,
            n.message,
            n.dateEnvoi,
            n.type,
            n.idReference,
            n.isRead,
            u.nom as senderName
        FROM 
            notification n
        LEFT JOIN
            utilisateur u ON n.idReference = u.idUtilisateur
        WHERE 
            n.destinataire = ? 
            AND n.type = 'reponse'
        ORDER BY 
            n.dateEnvoi DESC
    ");
    
    $stmt->execute([$adminId]);
    $replies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['success' => true, 'replies' => $replies]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>