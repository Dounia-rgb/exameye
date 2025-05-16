<?php
session_start();
require_once 'config.php'; // PDO connection
header('Content-Type: application/json');

// Check if user is logged in and is an administrator
if (!isset($_SESSION['idUtilisateur']) || ($_SESSION['role'] !== 'administrateur' && $_SESSION['role'] !== 'professeur')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied or not logged in with proper role']);
    exit;
}

// Get the notification ID from the request
$data = json_decode(file_get_contents('php://input'), true);
$notificationId = $data['notificationId'] ?? null;
$userId = $_SESSION['idUtilisateur'];

if (!$notificationId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Notification ID is required']);
    exit;
}

try {
    // Check if the notification belongs to the current user (either as sender or recipient)
    $stmt = $conn->prepare("
        SELECT * FROM notification
        WHERE idNotification = ? 
        AND (destinataire = ? OR idReference = ?)
    ");
    
    $stmt->execute([$notificationId, $userId, $userId]);
    $notification = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$notification) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You do not have permission to delete this notification']);
        exit;
    }
    
    // Delete the notification
    $stmt = $conn->prepare("DELETE FROM notification WHERE idNotification = ?");
    $stmt->execute([$notificationId]);
    
    echo json_encode(['success' => true, 'message' => 'Notification deleted successfully']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>