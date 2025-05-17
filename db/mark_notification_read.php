<?php
session_start();
header('Content-Type: application/json');

include 'config.php';

if (!isset($_SESSION['idUtilisateur'])) {
    echo json_encode(["success" => false, "error" => "Not logged in"]);
    exit;
}

// Get the POST data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id']) || empty($data['id'])) {
    echo json_encode(["success" => false, "error" => "Notification ID is required"]);
    exit;
}

$notificationId = $data['id'];
$userId = $_SESSION['idUtilisateur'];

try {
    // First, verify that this notification belongs to the current user
    $checkStmt = $conn->prepare("SELECT destinataire FROM notification WHERE idNotification = ?");
    $checkStmt->execute([$notificationId]);
    $notification = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$notification) {
        echo json_encode(["success" => false, "error" => "Notification not found"]);
        exit;
    }
    
    if ($notification['destinataire'] != $userId) {
        echo json_encode(["success" => false, "error" => "Unauthorized"]);
        exit;
    }
    
    // Mark the notification as read
    $stmt = $conn->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
    $stmt->execute([$notificationId]);
    
    echo json_encode(["success" => true]);
    
} catch (PDOException $e) {
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
}
?>