<?php
// Start output buffering to capture any unexpected output
ob_start();

session_start();

// Always set the content type to JSON
header('Content-Type: application/json');

// Function to return standardized JSON errors
function return_json_error($status_code, $message) {
    http_response_code($status_code);
    echo json_encode(['error' => $message]);
    exit;
}

// Check if user is authenticated as professor
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'professeur') {
    return_json_error(401, 'Not authenticated as professor');
}

// Debug information
$debug_info = [
    'session_data' => $_SESSION,
    'server_path' => $_SERVER['SCRIPT_FILENAME'],
    'server_name' => $_SERVER['SERVER_NAME'],
    'script_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown'
];

try {
    // Include the database configuration
    if (!file_exists('config.php')) {
        return_json_error(500, 'Database configuration file not found');
    }
    
    // Clear buffer before including config.php to prevent any unexpected output
    ob_clean();
    
    include 'config.php';
    
    // Check if $conn is initialized (using $conn from config.php)
    if (!isset($conn) || !($conn instanceof PDO)) {
        return_json_error(500, 'Database connection failed');
    }

    $idUtilisateur = $_SESSION['idUtilisateur'];

    $query = "SELECT u.idUtilisateur, u.nom, u.email, p.matiereEnseignee 
              FROM utilisateur u 
              JOIN professeur p ON u.idUtilisateur = p.idUtilisateur 
              WHERE u.idUtilisateur = :idUtilisateur";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':idUtilisateur', $idUtilisateur, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $professor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Clear any buffered output before sending JSON
        ob_end_clean();
        
        // Start fresh output
        echo json_encode($professor);
        exit;
    } else {
        return_json_error(404, 'Professor not found');
    }
} catch (PDOException $e) {
    // Include debug information in the error
    $error_data = [
        'error' => 'Database error',
        'message' => $e->getMessage(),
        'debug' => $debug_info
    ];
    
    ob_end_clean();
    http_response_code(500);
    echo json_encode($error_data);
    exit;
} catch (Exception $e) {
    $error_data = [
        'error' => 'General error',
        'message' => $e->getMessage(),
        'debug' => $debug_info
    ];
    
    ob_end_clean();
    http_response_code(500);
    echo json_encode($error_data);
    exit;
}

// This should never be reached if all the exit statements above work correctly
$output = ob_get_clean();
if (!empty($output)) {
    // If there was unexpected output, return it as an error
    http_response_code(500);
    echo json_encode([
        'error' => 'Unexpected output detected',
        'output' => $output,
        'debug' => $debug_info
    ]);
}
?>