<?php
// Database connection
require_once 'config.php';

// Start session for user info
session_start();

// Check if user is authenticated and is an admin
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    echo json_encode([
        'success' => false,
        'message' => 'Accès non autorisé'
    ]);
    exit;
}

// Process only POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Méthode non autorisée'
    ]);
    exit;
}

// Get JSON data from request body
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

// Check if required data is provided
if (!isset($data['id']) || !isset($data['status'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Données incomplètes'
    ]);
    exit;
}

$pvId = intval($data['id']);
$status = $data['status'];

// Validate status
$validStatuses = ['verified', 'rejected', 'pending'];
if (!in_array($status, $validStatuses)) {
    echo json_encode([
        'success' => false,
        'message' => 'Statut invalide'
    ]);
    exit;
}

try {
    // Begin transaction
    $conn->beginTransaction();
    
    // Update the surveillance status
    $updateSql = "UPDATE surveillance SET status = ? WHERE idSurveillance = ?";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->execute([$status, $pvId]);
    
    // Get surveillance details for notification
    $pvQuery = $conn->prepare("
        SELECT s.*, u.nom AS nomProfesseur, u.email AS emailProfesseur, u.idUtilisateur AS idProfesseur
        FROM surveillance s
        LEFT JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
        WHERE s.idSurveillance = ?
    ");
    $pvQuery->execute([$pvId]);
    $pv = $pvQuery->fetch(PDO::FETCH_ASSOC);
    
    if ($pv) {
        // Create notification for the professor
        $notifMessage = "";
        $notifType = "pv_status";
        
        if ($status === 'verified') {
            $notifMessage = "Votre PV pour {$pv['matiere']} ({$pv['cycle']} {$pv['semestre']}) a été approuvé par le chef de département.";
        } elseif ($status === 'rejected') {
            $notifMessage = "Votre PV pour {$pv['matiere']} ({$pv['cycle']} {$pv['semestre']}) a été rejeté par le chef de département. Veuillez le réviser.";
        }
        
        // Insert notification
        $notifSql = "
            INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead, url) 
            VALUES (?, ?, NOW(), ?, ?, 0, ?)
        ";
        $notifStmt = $conn->prepare($notifSql);
        $notifStmt->execute([
            $pv['idProfesseur'],
            $notifMessage,
            $notifType,
            $pvId,
            "view_pv.php?id=$pvId"
        ]);
    }
    
    // Commit transaction
    $conn->commit();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => $status === 'verified' ? 'PV approuvé avec succès' : ($status === 'rejected' ? 'PV rejeté avec succès' : 'Statut mis à jour')
    ]);
    
} catch (PDOException $e) {
    // Rollback transaction on error
    $conn->rollBack();
    
    // Return error
    echo json_encode([
        'success' => false,
        'message' => 'Erreur de base de données: ' . $e->getMessage()
    ]);
    
    // Log detailed error for administrators
    error_log('Database error in update_pv_status.php: ' . $e->getMessage());
}
?>