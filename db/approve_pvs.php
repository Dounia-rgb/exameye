<?php
require_once 'config.php';
session_start();

// Check authentication and authorization
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['success' => false, 'message' => 'Accès non autorisé']);
    exit;
}

// Get input data
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['ids']) || !is_array($input['ids'])) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['success' => false, 'message' => 'Données invalides']);
    exit;
}

try {
    $conn->beginTransaction();
    
    // Prepare the update statement
    $stmt = $conn->prepare("UPDATE surveillance SET status = 'verified' WHERE idSurveillance = ?");
    
    // Update each PV
    foreach ($input['ids'] as $id) {
        $id = intval($id);
        if ($id > 0) {
            $stmt->execute([$id]);
        }
    }
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => count($input['ids']) . ' PV(s) approuvé(s) avec succès'
    ]);
    
} catch (PDOException $e) {
    $conn->rollBack();
    error_log('Database error in approve_pvs.php: ' . $e->getMessage());
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode([
        'success' => false,
        'message' => 'Erreur de base de données lors de l\'approbation'
    ]);
}
?>