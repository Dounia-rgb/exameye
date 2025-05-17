<?php
// get_professor_replies.php
// Retrieves replies from professors to notifications sent by administrators

// Include database connection
require_once 'config.php';

// Set headers to handle JSON responses
header('Content-Type: application/json');

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

try {
    // Get the page from query parameters or default to 1
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10; // Default 10 items per page
    $offset = ($page - 1) * $limit;
    
    // Query to get replies from professors
    // These are notifications where an administrator is the destinataire
    // and a professor is the reference (or we can use a specific field to identify replies)
    $stmt = $pdo->prepare("
        SELECT n.idNotification, n.message, n.dateEnvoi, n.isRead,
               u.nom as senderName, u.idUtilisateur as senderId
        FROM notification n
        JOIN utilisateur u ON n.idReference = u.idUtilisateur
        WHERE n.destinataire = :adminId
        AND n.type = 'reply'
        AND EXISTS (
            SELECT 1 FROM professeur p WHERE p.idUtilisateur = n.idReference
        )
        ORDER BY n.dateEnvoi DESC
        LIMIT :offset, :limit
    ");
    
    $stmt->bindParam(':adminId', $adminId, PDO::PARAM_INT);
    $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $replies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Return the replies as JSON
    echo json_encode([
        'success' => true,
        'replies' => $replies
    ]);
    
} catch (PDOException $e) {
    // Log error
    error_log('Error fetching professor replies: ' . $e->getMessage());
    
    // Return error response
    echo json_encode([
        'success' => false, 
        'error' => 'Database error occurred while fetching replies'
    ]);
}
?>