<?php
session_start();

// Pour le débogage
error_log("Session ID: " . session_id());
error_log("Session data: " . print_r($_SESSION, true));

header('Content-Type: application/json');

// Si l'utilisateur n'est pas dans la session, essayer de récupérer depuis l'URL
if (!isset($_SESSION['idUtilisateur']) && isset($_GET['idUtilisateur'])) {
    require_once 'config.php';
    $userId = filter_input(INPUT_GET, 'idUtilisateur', FILTER_VALIDATE_INT);
    
    if ($userId) {
        $stmt = $conn->prepare("SELECT idUtilisateur, nom, email, role FROM utilisateur WHERE idUtilisateur = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            $_SESSION['idUtilisateur'] = $user['idUtilisateur'];
            $_SESSION['role'] = $user['role'];
            echo json_encode(['success' => true]);
            exit;
        }
    }
    
    echo json_encode(['success' => false, 'message' => 'Utilisateur non trouvé']);
    exit;
}

// Si l'utilisateur est déjà en session
if (isset($_SESSION['idUtilisateur'])) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Session non trouvée']);
}
?>