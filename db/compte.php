<?php
session_start();
header('Content-Type: application/json');

require 'config.php';

// Error handling
ini_set('display_errors', 0);
error_reporting(E_ALL);

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

// Verify database connection
try {
    $conn->query("SELECT 1");
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Database connection failed',
        'error' => $e->getMessage()
    ], 500);
}

// Enhanced session verification
function verifySession() {
    if (!isset($_SESSION['idUtilisateur']) || empty($_SESSION['idUtilisateur'])) {
        jsonResponse([
            'success' => false,
            'message' => 'Unauthorized - Please login first'
        ], 401);
    }
    
    if (!isset($_SESSION['role'])) {
        $_SESSION['role'] = 'guest';
    }
    
    if (!isset($_SESSION['nom'])) {
        $_SESSION['nom'] = 'User';
    }
}

// Handle POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifySession();
    
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $action = filter_var($input['action'] ?? null, FILTER_SANITIZE_STRING);

    if (!$action) {
        jsonResponse([
            'success' => false,
            'message' => 'No action specified'
        ], 400);
    }

    try {
        switch ($action) {
            case 'requestEdit':
                $name = filter_var($input['name'] ?? null, FILTER_SANITIZE_STRING);
                $email = filter_var($input['email'] ?? null, FILTER_SANITIZE_EMAIL);
                $password = filter_var($input['password'] ?? null, FILTER_SANITIZE_STRING);

                if (!$name || !$email) {
                    jsonResponse([
                        'success' => false,
                        'message' => 'Invalid name or email'
                    ], 400);
                }

                // Prepare changes data
                $changes = [
                    'current_name' => $_SESSION['nom'],
                    'current_email' => $_SESSION['email'] ?? '',
                    'new_name' => $name,
                    'new_email' => $email
                ];
                
                if (!empty($password)) {
                    $changes['new_password'] = $password;
                }

                // Get all administrators
                $stmt = $conn->prepare("
                    SELECT idUtilisateur 
                    FROM utilisateur 
                    WHERE role = 'admin'
                ");
                $stmt->execute();
                $admins = $stmt->fetchAll(PDO::FETCH_COLUMN);

                if (empty($admins)) {
                    jsonResponse([
                        'success' => false,
                        'message' => 'No administrators found'
                    ], 404);
                }

                // Create notification for each admin
                foreach ($admins as $adminId) {
                    $stmt = $conn->prepare("
                        INSERT INTO notification 
                        (destinataire, message, dateEnvoi, type, idReference, isRead, url)
                        VALUES (?, ?, NOW(), 'profile_edit_request', ?, 0, '/admin/approvals')
                    ");
                    $message = "Demande de modification de profil par ".$_SESSION['nom']." (ID: ".$_SESSION['idUtilisateur'].")";
                    $stmt->execute([$adminId, $message, json_encode($changes)]);
                }

                jsonResponse(['success' => true]);
                break;

            case 'requestAddSubject':
                $subject = filter_var($input['subject'] ?? null, FILTER_SANITIZE_STRING);
                
                if (!$subject) {
                    jsonResponse([
                        'success' => false,
                        'message' => 'Invalid subject name'
                    ], 400);
                }

                // Verify subject exists
                $stmt = $conn->prepare("SELECT idMatiere FROM matiere WHERE matiere = ?");
                $stmt->execute([$subject]);
                $matiere = $stmt->fetch();

                if (!$matiere) {
                    jsonResponse([
                        'success' => false,
                        'message' => 'Subject not found in system'
                    ], 404);
                }

                // Get all administrators
                $stmt = $conn->prepare("
                    SELECT idUtilisateur 
                    FROM utilisateur 
                    WHERE role = 'admin'
                ");
                $stmt->execute();
                $admins = $stmt->fetchAll(PDO::FETCH_COLUMN);

                if (empty($admins)) {
                    jsonResponse([
                        'success' => false,
                        'message' => 'No administrators found'
                    ], 404);
                }

                // Prepare subject data
                $subjectData = [
                    'subject_id' => $matiere['idMatiere'],
                    'subject_name' => $subject,
                    'user_id' => $_SESSION['idUtilisateur'],
                    'user_name' => $_SESSION['nom']
                ];

                // Create notification for each admin
                foreach ($admins as $adminId) {
                    $stmt = $conn->prepare("
                        INSERT INTO notification 
                        (destinataire, message, dateEnvoi, type, idReference, isRead, url)
                        VALUES (?, ?, NOW(), 'subject_add_request', ?, 0, '/admin/approvals')
                    ");
                    $message = "Demande d'ajout de matière: $subject par ".$_SESSION['nom']." (ID: ".$_SESSION['idUtilisateur'].")";
                    $stmt->execute([$adminId, $message, json_encode($subjectData)]);
                }

                jsonResponse(['success' => true, 'pendingSubject' => $subject]);
                break;

            default:
                jsonResponse([
                    'success' => false,
                    'message' => 'Unknown action'
                ], 400);
        }
    } catch (PDOException $e) {
        error_log('Database Error: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Database operation failed',
            'error' => $e->getMessage()
        ], 500);
    }
}

// Handle GET requests - Return user info
verifySession();

try {
    // Get user data
    $stmt = $conn->prepare("
        SELECT u.idUtilisateur, u.nom, u.email, u.role 
        FROM utilisateur u 
        WHERE u.idUtilisateur = ?
    ");
    $stmt->execute([$_SESSION['idUtilisateur']]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse([
            'error' => 'User not found'
        ], 404);
    }

    // Update session with fresh data
    $_SESSION['nom'] = $user['nom'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['email'] = $user['email'];

    // Get subjects if professor
    if ($user['role'] === 'professeur') {
        $stmt = $conn->prepare("SELECT matiereEnseignee FROM professeur WHERE idUtilisateur = ?");
        $stmt->execute([$_SESSION['idUtilisateur']]);
        $prof = $stmt->fetch();

        if ($prof && $prof['matiereEnseignee']) {
            $subjectIds = explode(',', $prof['matiereEnseignee']);
            $placeholders = implode(',', array_fill(0, count($subjectIds), '?'));
            
            $stmt = $conn->prepare("
                SELECT matiere FROM matiere 
                WHERE idMatiere IN ($placeholders)
            ");
            $stmt->execute($subjectIds);
            $subjects = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $user['matiereEnseignee'] = implode(', ', $subjects);
        } else {
            $user['matiereEnseignee'] = "";
        }
        
        // Check for pending subject requests
        $stmt = $conn->prepare("
            SELECT n.idReference, m.matiere 
            FROM notification n
            JOIN matiere m ON n.idReference = m.idMatiere
            WHERE n.type = 'subject_add_request' 
            AND n.isRead = 0
            AND n.idReference IN (
                SELECT idMatiere FROM matiere
            )
        ");
        $stmt->execute();
        $pendingSubjects = $stmt->fetchAll(PDO::FETCH_COLUMN, 1);
        
        if (!empty($pendingSubjects)) {
            $user['pendingSubjects'] = $pendingSubjects;
        }
        
        // Check for pending profile edit requests
        $stmt = $conn->prepare("
            SELECT COUNT(*) as count
            FROM notification 
            WHERE type = 'profile_edit_request' 
            AND idReference = ? 
            AND isRead = 0
        ");
        $stmt->execute([$_SESSION['idUtilisateur']]);
        $result = $stmt->fetch();
        
        if ($result && $result['count'] > 0) {
            $user['pendingProfileEdit'] = true;
        }
    }

    jsonResponse($user);
} catch (PDOException $e) {
    error_log('Database Error: ' . $e->getMessage());
    jsonResponse([
        'error' => 'Database operation failed',
        'details' => $e->getMessage()
    ], 500);
}