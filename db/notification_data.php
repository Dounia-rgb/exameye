<?php
session_start();
header('Content-Type: application/json');

include 'config.php';

if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'professeur') {
    echo json_encode(["error" => "Access denied or not logged in as professor"]);
    exit;
}

$idUtilisateur = $_SESSION['idUtilisateur'];

// Updated title map (replaced 'rappel' with 'message')
$titleMap = [
    'convocation' => 'Nouvelle Convocation',
    'message' => 'Message Important',
    'planning' => 'Planning d\'Examen',
    'compte' => 'Mise à jour du Compte',
    'general' => 'Notification Générale'
];

try {
    // Prepare SQL query to fetch notifications for the professor
    $stmt = $conn->prepare("
        SELECT n.idNotification, n.message, n.dateEnvoi, n.isRead, n.type, n.idReference 
        FROM notification n
        WHERE n.destinataire = ?
        ORDER BY n.dateEnvoi DESC
    ");
    $stmt->execute([$idUtilisateur]);

    $notifications = [];

    // Fetch all notifications
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Convert 'rappel' type to 'message' type
        if ($row['type'] === 'rappel') {
            $row['type'] = 'message';
        }
        
        // Map the 'type' to a more user-friendly title
        $title = isset($titleMap[$row['type']]) ? $titleMap[$row['type']] : 'Notification';

        // For convocation notifications, we need to make sure idReference points to convocationGroupId
        // instead of idExam (which appears to be the issue)
        $idReference = $row['idReference'] ?? null;
        
        // If this is a convocation notification, check if idReference refers to an idExam
        // If it does, we need to find the corresponding convocationGroupId
        if ($row['type'] === 'convocation' && $idReference) {
            // First, create a log to understand what we're working with
            error_log("Original idReference for convocation notification {$row['idNotification']}: $idReference");
            
            // Check if this is actually an idExam by looking for the convocationGroupId
            $checkStmt = $conn->prepare("
                SELECT DISTINCT convocationGroupId 
                FROM surveillance 
                WHERE idExamen = ? 
                AND idProfesseur = ? 
                AND convocationGroupId IS NOT NULL
                LIMIT 1
            ");
            $checkStmt->execute([$idReference, $idUtilisateur]);
            $convocationData = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            // If we found a convocationGroupId, use that instead
            if ($convocationData && $convocationData['convocationGroupId']) {
                $idReference = $convocationData['convocationGroupId'];
                error_log("Updated idReference to convocationGroupId: $idReference");
            }
        }
        
        // Prepare URL based on notification type (don't use this anymore, we handle in the JS)
        $url = '';
        if ($row['type'] === 'planning') {
            $url = 'planning.html'; // Base URL without parameters
        } elseif ($row['type'] === 'convocation') {
            $url = 'convocation.html'; // Base URL without parameters
        }
        
        // Prepare notification data
        $notifications[] = [
            'idNotification' => $row['idNotification'],
            'title' => $title,
            'message' => $row['message'],
            'date' => $row['dateEnvoi'],
            'isRead' => $row['isRead'] == 1,
            'type' => $row['type'],
            'idReference' => $idReference,
            'url' => $url // Include the base URL to be used for redirection
        ];
    }

    // Group notifications by type
    $groupedNotifications = [];
    foreach ($notifications as $notification) {
        $groupedNotifications[$notification['type']][] = $notification;
    }

    // Return the grouped notifications as JSON
    echo json_encode($groupedNotifications);

} catch (PDOException $e) {
    echo json_encode(["error" => "Query failed: " . $e->getMessage()]);
}
?>