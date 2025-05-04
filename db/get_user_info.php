<?php
// Get user information from the database
require_once 'config.php';
session_start();

header('Content-Type: application/json');

// Check if user is logged in
if (!isset($_SESSION['idUtilisateur'])) {
    echo json_encode([
        'success' => false,
        'message' => 'User not logged in'
    ]);
    exit;
}

try {
    // Use existing connection from config.php
    global $conn;
    
    // Get user info from database
    $query = $conn->prepare("
        SELECT nom, email, role 
        FROM utilisateur 
        WHERE idUtilisateur = ?
    ");
    $query->execute([$_SESSION['idUtilisateur']]);
    $user = $query->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        // Get additional info based on role
        $additionalInfo = [];
        
        if ($user['role'] === 'professeur') {
            $profQuery = $conn->prepare("
                SELECT matiereEnseignee 
                FROM professeur 
                WHERE idUtilisateur = ?
            ");
            $profQuery->execute([$_SESSION['idUtilisateur']]);
            $profInfo = $profQuery->fetch(PDO::FETCH_ASSOC);
            
            if ($profInfo) {
                $additionalInfo = $profInfo;
            }
        }
        
        echo json_encode([
            'success' => true,
            'idUtilisateur' => $_SESSION['idUtilisateur'],
            'name' => $user['nom'],
            'email' => $user['email'],
            'role' => $user['role'],
            'additionalInfo' => $additionalInfo,
            // Profile image can be added if needed
            'profileImage' => null
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'User not found'
        ]);
    }
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}