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

// Check if ID is provided
if (!isset($_GET['id']) || empty($_GET['id'])) {
    echo json_encode([
        'success' => false,
        'message' => 'ID du PV manquant'
    ]);
    exit;
}

$pvId = intval($_GET['id']);

try {
    // Get PV details
    $sql = "
        SELECT s.*, e.procesVerbal, 
               u.nom AS nomProfesseur, 
               sa.localisation, sa.nomSalle, sa.capacite
        FROM surveillance s
        LEFT JOIN examen e ON s.idExamen = e.idExamen
        LEFT JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
        LEFT JOIN salle sa ON s.idSalle = sa.idSalle
        WHERE s.idSurveillance = ?
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([$pvId]);
    $pv = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$pv) {
        echo json_encode([
            'success' => false,
            'message' => 'PV non trouvé'
        ]);
        exit;
    }
    
    // Return success with data
    echo json_encode([
        'success' => true,
        'pv' => $pv
    ]);
    
} catch (PDOException $e) {
    // Return error
    echo json_encode([
        'success' => false,
        'message' => 'Erreur de base de données: ' . $e->getMessage()
    ]);
    
    // Log detailed error for administrators
    error_log('Database error in get_pv_details.php: ' . $e->getMessage());
}
?>