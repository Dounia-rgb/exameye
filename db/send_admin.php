<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database connection
require_once 'config.php';
session_start();

// Check if the request method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'error' => 'Méthode non autorisée'
    ]);
    exit;
}

// Get the JSON data from the request
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

// Debug output
error_log("Received data: " . print_r($data, true));

// Check if data is valid
if (!$data || !isset($data['message']) || !isset($data['recipients']) || empty($data['message']) || empty($data['recipients'])) {
    echo json_encode([
        'success' => false,
        'error' => 'Données invalides'
    ]);
    exit;
}

// Get the administrator ID from the session or default to a value for testing
$adminId = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 1;

// Get the message and recipients
$message = $data['message'];
$recipients = $data['recipients'];
$dateEnvoi = date('Y-m-d H:i:s'); // Current date and time

// Set the notification type to 'message'
$type = 'message';

// Initialize variables for tracking
$success = true;
$errorMsg = '';
$notificationIds = [];
$recipientNames = [];

// Begin a transaction to ensure all notifications are sent together
try {
    $conn->beginTransaction();

    // For each recipient, create a notification
    foreach ($recipients as $recipientId) {
        // Debug output
        error_log("Processing recipient ID: " . $recipientId);
        
        // Create the notification
        $stmt = $conn->prepare("INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead) VALUES (?, ?, ?, ?, ?, 0)");
        
        if (!$stmt) {
            throw new Exception("Erreur de préparation de la requête: " . $conn->errorInfo()[2]);
        }
        
        $stmt->execute([$recipientId, $message, $dateEnvoi, $type, $adminId]);
        
        $notificationId = $conn->lastInsertId();
        $notificationIds[] = $notificationId;
        
        // Get recipient name for confirmation message
        $nameStmt = $conn->prepare("SELECT nom FROM utilisateur WHERE idUtilisateur = ?");
        if (!$nameStmt) {
            throw new Exception("Erreur de préparation de la requête de nom: " . $conn->errorInfo()[2]);
        }
        
        $nameStmt->execute([$recipientId]);
        $row = $nameStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row) {
            $recipientNames[] = $row['nom'];
        } else {
            $recipientNames[] = "Professeur #" . $recipientId;
        }
    }
    
    // Commit the transaction
    $conn->commit();
    
    // Return success message with notification IDs and recipient names
    echo json_encode([
        'success' => true,
        'notificationId' => $notificationIds[0], // Return the first ID for compatibility
        'allNotificationIds' => $notificationIds,
        'recipients' => implode(', ', $recipientNames)
    ]);
    
} catch (Exception $e) {
    // If there was an exception, rollback the transaction
    $conn->rollBack();
    
    error_log("Error in send_admin.php: " . $e->getMessage());
    
    echo json_encode([
        'success' => false,
        'error' => "Une erreur est survenue: " . $e->getMessage()
    ]);
}
?>