<?php
session_start();
header('Content-Type: application/json');

include 'config.php';

// Check if user is logged in and is a professor
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'professeur') {
    echo json_encode(["error" => "Access denied or not logged in as professor"]);
    exit;
}

// Get the request data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($data['notificationId']) || !isset($data['message']) || empty($data['message'])) {
    echo json_encode(["error" => "Missing required fields"]);
    exit;
}

$notificationId = $data['notificationId'];
$replyMessage = $data['message'];
$professorId = $_SESSION['idUtilisateur'];

try {
    // Start transaction to ensure data consistency
    $conn->beginTransaction();
    
    // First, fetch the original notification
    $stmt = $conn->prepare("
        SELECT n.* 
        FROM notification n
        WHERE n.idNotification = ? AND n.destinataire = ?
    ");
    $stmt->execute([$notificationId, $professorId]);
    
    $notification = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$notification) {
        echo json_encode(["error" => "Notification not found or you don't have permission"]);
        exit;
    }
    
    // Find an administrator (chef département) to reply to
    $stmt = $conn->prepare("
        SELECT u.idUtilisateur 
        FROM utilisateur u
        WHERE u.role = 'administrateur' AND u.status = 'active'
        LIMIT 1
    ");
    $stmt->execute();
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$admin) {
        echo json_encode(["error" => "No department head found to send reply to"]);
        exit;
    }
    
    $departmentHeadId = $admin['idUtilisateur'];
    
    // Get information about the professor for the reply
    $stmt = $conn->prepare("
        SELECT u.nom, p.matiereEnseignee 
        FROM utilisateur u
        LEFT JOIN professeur p ON u.idUtilisateur = p.idUtilisateur
        WHERE u.idUtilisateur = ?
    ");
    $stmt->execute([$professorId]);
    $professor = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get the original notification type to include context in reply
    $originalType = $notification['type'];
    $originalMessage = $notification['message'];
    
    // Prepare reply message with context
    $fullReplyMessage = "Réponse du professeur " . $professor['nom'] . ":\n\n" . 
                        "Message original: " . $originalMessage . "\n\n" . 
                        "Réponse: " . $replyMessage;
    
    // Insert the reply as a new notification to the department head
    $stmt = $conn->prepare("
        INSERT INTO notification 
        (destinataire, message, dateEnvoi, type, idReference, isRead) 
        VALUES (?, ?, NOW(), 'reponse', ?, 0)
    ");
    $stmt->execute([
        $departmentHeadId,     // The department head is the recipient
        $fullReplyMessage,     // The full message with context
        $professorId           // Store the professor ID in idReference
    ]);
    
    // DELETE THE ORIGINAL NOTIFICATION after replying
    $stmt = $conn->prepare("
        DELETE FROM notification 
        WHERE idNotification = ? AND destinataire = ?
    ");
    $stmt->execute([$notificationId, $professorId]);
    
    // Commit transaction
    $conn->commit();
    
    // If successful, return success response
    echo json_encode([
        "success" => true,
        "message" => "Réponse envoyée avec succès au chef de département"
    ]);
    
} catch (PDOException $e) {
    // Rollback transaction on error
    $conn->rollBack();
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>