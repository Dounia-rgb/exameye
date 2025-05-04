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

        // Prepare URL based on notification type
        $url = '';
        if ($row['type'] === 'planning') {
            $url = 'planning.html?id=' . $row['idReference']; // Redirection to planning page
        } elseif ($row['type'] === 'convocation') {
            $url = 'convocation.html?id=' . $row['idReference']; // Redirection to convocation page
        }
        // Prepare notification data
        $notifications[] = [
            'idNotification' => $row['idNotification'],
            'title' => $title,
            'message' => $row['message'],
            'date' => $row['dateEnvoi'],
            'isRead' => $row['isRead'] == 1,
            'type' => $row['type'],
            'idReference' => $row['idReference'] ?? null,
            'url' => $url // Include the URL to be used for redirection
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