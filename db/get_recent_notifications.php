<?php
require_once 'config.php'; // Connexion PDO
header('Content-Type: application/json');

try {
    // Requête pour récupérer les notifications récentes avec le nombre de destinataires
    $stmt = $conn->prepare("
        SELECT 
            n.idNotification,
            n.message,
            n.dateEnvoi,
            n.type,
            COUNT(DISTINCT n.destinataire) as recipientCount
        FROM 
            notification n
        GROUP BY 
            n.message, n.dateEnvoi, n.type
        ORDER BY 
            n.dateEnvoi DESC
        LIMIT 10
    ");
    
    $stmt->execute();
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($notifications);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>