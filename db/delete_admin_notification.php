<?php
// delete_admin_notification.php
// Handles the deletion of notifications by administrators

// Include database connection
require_once 'config.php';

// Set headers to handle JSON requests and responses
header('Content-Type: application/json');

// Check if the request is a POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

// Start session to check if user is logged in and is an administrator
session_start();
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    echo json_encode(['success' => false, 'error' => 'User not authenticated']);
    exit;
}

// Check if the user is an administrator
if ($_SESSION['role'] !== 'administrateur') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
    exit;
}

// Get the admin ID
$adminId = $_SESSION['user_id'];

// Parse the JSON data from the request
$input = json_decode(file_get_contents('php://input'), true);

// Validate input data
if (!isset($input['notificationId']) || !is_numeric($input['notificationId'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid notification ID']);
    exit;
}

$notificationId = (int)$input['notificationId'];

try {
    // Begin transaction
    $pdo->beginTransaction();
    
    // First, get the notification details to verify it can be deleted by this admin
    $stmt = $pdo->prepare("
        SELECT message, dateEnvoi, type
        FROM notification
        WHERE idNotification = ?
    ");
    $stmt->execute([$notificationId]);
    $notification = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$notification) {
        echo json_encode(['success' => false, 'error' => 'Notification not found']);
        $pdo->rollBack();
        exit;
    }
    
    // Find related notifications with the same message and timestamp
    // This is to handle group messages sent to multiple recipients
    $stmt = $pdo->prepare("
        SELECT idNotification
        FROM notification
        WHERE message = ? 
        AND ABS(TIMESTAMPDIFF(SECOND, dateEnvoi, ?)) < 5
        AND type = ?
    ");
    $stmt->execute([
        $notification['message'],
        $notification['dateEnvoi'],
        $notification['type']
    ]);
    $relatedNotifications = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($relatedNotifications)) {
        $relatedNotifications = [$notificationId]; // Just delete the specified one if no related found
    }
    
    // Delete all related notifications
    $placeholders = implode(',', array_fill(0, count($relatedNotifications), '?'));
    $stmt = $pdo->prepare("DELETE FROM notification WHERE idNotification IN ($placeholders)");
    
    foreach ($relatedNotifications as $index => $id) {
        $stmt->bindValue($index + 1, $id, PDO::PARAM_INT);
    }
    
    $stmt->execute();
    $deletedCount = $stmt->rowCount();
    
    // Commit transaction
    $pdo->commit();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Notification(s) deleted successfully',
        'deletedCount' => $deletedCount
    ]);
    
} catch (PDOException $e) {
    // Rollback transaction on error
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    // Log error
    error_log('Error deleting notification: ' . $e->getMessage());
    
    // Return error response
    echo json_encode([
        'success' => false, 
        'error' => 'Database error occurred while deleting notification'
    ]);
}
?>