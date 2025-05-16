<?php
require_once 'config.php';
header('Content-Type: application/json');

session_start();

// Check if user is logged in as administrator
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$adminId = $_SESSION['idUtilisateur'];

try {
    // Get notifications sent by admin to professors
    $sentQuery = $conn->prepare("
        SELECT 
            n.idNotification,
            n.message,
            n.dateEnvoi,
            'sent' as direction,
            COUNT(DISTINCT n.destinataire) as recipientCount,
            GROUP_CONCAT(DISTINCT u.nom SEPARATOR ', ') as recipients
        FROM 
            notification n
        JOIN 
            utilisateur u ON n.destinataire = u.idUtilisateur
        WHERE 
            n.idReference = ? AND n.type = 'message'
        GROUP BY 
            n.message, n.dateEnvoi
        ORDER BY 
            n.dateEnvoi DESC
        LIMIT 5
    ");
    
    $sentQuery->execute([$adminId]);
    $sentNotifications = $sentQuery->fetchAll(PDO::FETCH_ASSOC);
    
    // Get replies received by admin from professors
    $receivedQuery = $conn->prepare("
        SELECT 
            n.idNotification,
            n.message,
            n.dateEnvoi,
            'received' as direction,
            1 as recipientCount,
            u.nom as sender
        FROM 
            notification n
        JOIN 
            utilisateur u ON n.idReference = u.idUtilisateur
        WHERE 
            n.destinataire = ? AND n.type = 'reponse'
        ORDER BY 
            n.dateEnvoi DESC
        LIMIT 5
    ");
    
    $receivedQuery->execute([$adminId]);
    $receivedNotifications = $receivedQuery->fetchAll(PDO::FETCH_ASSOC);
    
    // Combine both sets of notifications
    $allNotifications = array_merge($sentNotifications, $receivedNotifications);
    
    // Sort by date
    usort($allNotifications, function($a, $b) {
        return strtotime($b['dateEnvoi']) - strtotime($a['dateEnvoi']);
    });
    
    echo json_encode($allNotifications);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>