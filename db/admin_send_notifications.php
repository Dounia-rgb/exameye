<?php
// admin_send_notifications.php
// File to handle sending notifications from administrators to professors

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
if (!isset($input['message']) || trim($input['message']) === '') {
    echo json_encode(['success' => false, 'error' => 'Message cannot be empty']);
    exit;
}

if (!isset($input['recipients']) || !is_array($input['recipients']) || count($input['recipients']) === 0) {
    echo json_encode(['success' => false, 'error' => 'Recipients list cannot be empty']);
    exit;
}

// Set default values
$message = trim($input['message']);
$recipients = $input['recipients'];
$type = isset($input['type']) ? trim($input['type']) : 'message';
$dateEnvoi = isset($input['dateEnvoi']) ? $input['dateEnvoi'] : date('Y-m-d H:i:s');
$idReference = isset($input['idReference']) ? $input['idReference'] : null;
$url = isset($input['url']) ? $input['url'] : null;

// Begin transaction
try {
    $pdo->beginTransaction();
    
    // Get the list of professors' names for confirmation message
    $recipientNames = [];
    $placeholders = implode(',', array_fill(0, count($recipients), '?'));
    
    $stmt = $pdo->prepare("
        SELECT u.idUtilisateur, u.nom
        FROM utilisateur u
        JOIN professeur p ON u.idUtilisateur = p.idUtilisateur
        WHERE u.idUtilisateur IN ($placeholders) AND u.role = 'professeur'
    ");
    
    foreach ($recipients as $index => $id) {
        $stmt->bindValue($index + 1, $id, PDO::PARAM_INT);
    }
    
    $stmt->execute();
    $validProfessors = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Check if any professors were found
    if (count($validProfessors) === 0) {
        echo json_encode(['success' => false, 'error' => 'No valid professors found']);
        $pdo->rollBack();
        exit;
    }
    
    // Extract names and IDs for valid professors
    $validRecipientIds = [];
    foreach ($validProfessors as $professor) {
        $recipientNames[] = $professor['nom'];
        $validRecipientIds[] = $professor['idUtilisateur'];
    }
    
    // Create a notification entry for each recipient
    $notificationIds = [];
    $stmt = $pdo->prepare("
        INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead, url)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    ");
    
    foreach ($validRecipientIds as $recipientId) {
        $stmt->execute([
            $recipientId,
            $message,
            $dateEnvoi,
            $type,
            $idReference,
            $url
        ]);
        
        $notificationIds[] = $pdo->lastInsertId();
    }
    
    // Record the notification as sent by this administrator
    // This could be a separate table to track who sent what notification
    // For now, we'll just use the first notification ID as a reference
    $firstNotificationId = $notificationIds[0] ?? null;
    
    // Commit transaction
    $pdo->commit();
    
    // Return success response with IDs and recipient names
    echo json_encode([
        'success' => true,
        'message' => 'Notification sent successfully',
        'notificationId' => $firstNotificationId,
        'recipientCount' => count($validRecipientIds),
        'recipients' => implode(', ', $recipientNames)
    ]);
    
} catch (PDOException $e) {
    // Rollback transaction on error
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    // Log error
    error_log('Error sending notification: ' . $e->getMessage());
    
    // Return error response
    echo json_encode([
        'success' => false, 
        'error' => 'Database error occurred while sending notification'
    ]);
}
?>