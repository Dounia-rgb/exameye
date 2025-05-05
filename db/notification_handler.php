<?php
session_start();

// Enable strict error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0); // Changed to 0 to prevent HTML errors in JSON response
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/notification_errors.log');

// Set JSON content type for all responses
header('Content-Type: application/json');

// Load config from same directory
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    die(json_encode([
        'success' => false,
        'message' => 'Configuration file not found',
        'path_tried' => $configFile
    ]));
}
require_once $configFile;

// Verify admin session
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'admin') {
    die(json_encode([
        'success' => false,
        'message' => 'Unauthorized: Admin access required'
    ]));
}

// Validate database connection
if (!isset($conn) || !($conn instanceof PDO)) {
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]));
}

// Main request handler
try {
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    $action = htmlspecialchars(strip_tags(trim($action)));

    switch ($action) {
        case 'getPendingRequests':
            handleGetRequests($conn);
            break;
            
        case 'approveRequest':
            handleApproveRequest($conn);
            break;
            
        case 'rejectRequest':
            handleRejectRequest($conn);
            break;
            
        default:
            throw new InvalidArgumentException('Invalid action specified');
    }
} catch (Throwable $e) {
    error_log("[Notification Error] " . date('Y-m-d H:i:s') . " - " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred',
        'error' => $e->getMessage()
    ]);
}

/**
 * Fetches pending requests from database with correct sender information
 */
function handleGetRequests(PDO $conn) {
    // Get all pending requests first
    $stmt = $conn->prepare("
        SELECT 
            n.idNotification, 
            n.message, 
            n.dateEnvoi, 
            n.type, 
            n.idReference, 
            n.destinataire
        FROM notification n
        WHERE n.isRead = 0 
        AND n.type IN ('profile_edit_request', 'subject_add_request')
        ORDER BY n.dateEnvoi DESC
    ");
    
    $stmt->execute();
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Process each request to add sender information
    foreach ($requests as &$request) {
        // Default values
        $request['senderName'] = 'Unknown';
        $request['senderId'] = null;
        
        if ($request['type'] === 'subject_add_request') {
            // For subject_add_request, the user ID is in the message or should be looked up
            // Based on your database, the user who wants to add a subject is likely the professor
            
            // Check if the reference ID is a user ID
            $userStmt = $conn->prepare("
                SELECT u.idUtilisateur, u.nom 
                FROM utilisateur u 
                WHERE u.idUtilisateur = ?
            ");
            $userStmt->execute([$request['idReference']]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                $request['senderName'] = $user['nom'];
                $request['senderId'] = $user['idUtilisateur'];
            } else {
                // If not a user ID, maybe it's a subject ID
                // Try to extract user ID from the message or look up related professor
                
                // Log for debugging
                error_log("Subject request details - ID: " . $request['idNotification'] . 
                          ", Reference: " . $request['idReference'] . 
                          ", Message: " . $request['message']);
                
                // Try to find professor who requested this subject
                // This logic depends on how your app creates these notifications
                // Using a basic fallback approach for now
                
                // Check if this is stored in database directly
                $professorStmt = $conn->prepare("
                    SELECT p.idUtilisateur, u.nom 
                    FROM professeur p
                    JOIN utilisateur u ON u.idUtilisateur = p.idUtilisateur
                    WHERE FIND_IN_SET(?, p.matiereEnseignee)
                ");
                $professorStmt->execute([$request['idReference']]);
                $professor = $professorStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($professor) {
                    $request['senderName'] = $professor['nom'];
                    $request['senderId'] = $professor['idUtilisateur'];
                }
                
                // Final fallback - if we still don't have sender info
                // This is where app-specific logic would be needed
                if (!$request['senderId']) {
                    // Store the subject ID as reference for approval process
                    $request['senderId'] = $request['idReference'];
                    
                    // Try to get matiere name for better display
                    $matiereStmt = $conn->prepare("
                        SELECT matiere FROM matiere WHERE idMatiere = ?
                    ");
                    $matiereStmt->execute([$request['idReference']]);
                    $matiere = $matiereStmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($matiere) {
                        $request['senderName'] = "Matière: " . $matiere['matiere'];
                    } else {
                        $request['senderName'] = "ID Matière: " . $request['idReference'];
                    }
                }
            }
        } else if ($request['type'] === 'profile_edit_request') {
            // For profile edits, the reference typically points to the user who requested the edit
            $userStmt = $conn->prepare("
                SELECT nom FROM utilisateur WHERE idUtilisateur = ?
            ");
            $userStmt->execute([$request['idReference']]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                $request['senderName'] = $user['nom'];
                $request['senderId'] = $request['idReference'];
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'requests' => $requests,
        'count' => count($requests)
    ]);
}

/**
 * Handles request approval logic
 */
function handleApproveRequest(PDO $conn) {
    $conn->beginTransaction();
    
    try {
        // Validate inputs
        $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
        $type = filter_input(INPUT_POST, 'type', FILTER_SANITIZE_STRING);
        
        if (!$notificationId || !$type) {
            throw new InvalidArgumentException('Missing required parameters');
        }

        // For subject_add_request, get the reference data
        $referenceData = null;
        if ($type === 'subject_add_request') {
            // Get and validate reference data
            $referenceJson = $_POST['referenceId'] ?? null;
            
            // Log received data for debugging
            error_log("Received reference data: " . $referenceJson);
            
            if (!$referenceJson) {
                throw new InvalidArgumentException('Missing reference data');
            }
            
            $referenceData = json_decode($referenceJson, true);
            
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($referenceData)) {
                throw new RuntimeException('Invalid subject data format: ' . json_last_error_msg());
            }
            
            // Validate that we have the required fields
            if (!isset($referenceData['subject_id']) || !isset($referenceData['user_id'])) {
                throw new InvalidArgumentException('Missing required reference fields');
            }
            
            // Make sure user_id is a valid integer
            if (!is_numeric($referenceData['user_id'])) {
                // Check if it's a stringified JSON object
                if (is_string($referenceData['user_id']) && strpos($referenceData['user_id'], '{') !== false) {
                    $userData = json_decode($referenceData['user_id'], true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($userData['user_id'])) {
                        $referenceData['user_id'] = $userData['user_id'];
                    } else {
                        throw new InvalidArgumentException('Invalid user ID format');
                    }
                } else {
                    throw new InvalidArgumentException('Invalid user ID format');
                }
            }
            
            // Make sure subject_id is a valid integer
            if (!is_numeric($referenceData['subject_id'])) {
                // Check if it's a stringified JSON object
                if (is_string($referenceData['subject_id']) && strpos($referenceData['subject_id'], '{') !== false) {
                    $subjectData = json_decode($referenceData['subject_id'], true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($subjectData['subject_id'])) {
                        $referenceData['subject_id'] = $subjectData['subject_id'];
                    } else {
                        throw new InvalidArgumentException('Invalid subject ID format');
                    }
                } else {
                    throw new InvalidArgumentException('Invalid subject ID format');
                }
            }
        }

        // Mark notification as read
        $stmt = $conn->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);

        // Handle subject add requests
        if ($type === 'subject_add_request') {
            $subjectId = $referenceData['subject_id'] ?? null;
            $professorId = $referenceData['user_id'] ?? null;

            // Debug - log final values
            error_log("Processing with subjectId: $subjectId, professorId: $professorId");

            if (!$subjectId || !$professorId) {
                throw new InvalidArgumentException('Missing subject or professor ID');
            }

            // Verify user exists (no role check needed)
            $stmt = $conn->prepare("
                SELECT idUtilisateur, role FROM utilisateur 
                WHERE idUtilisateur = ?
            ");
            $stmt->execute([$professorId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                throw new RuntimeException("User not found with ID: " . $professorId);
            }
            
            // Log the information for debugging
            error_log("Processing subject add request: Subject ID=$subjectId, User ID=$professorId, User Role=" . ($user['role'] ?? 'unknown'));
            

            // Update or create professor's subjects
            $stmt = $conn->prepare("SELECT matiereEnseignee FROM professeur WHERE idUtilisateur = ?");
            $stmt->execute([$professorId]);
            $professor = $stmt->fetch(PDO::FETCH_ASSOC);

            // Handle empty or null matiereEnseignee
            $currentSubjects = $professor['matiereEnseignee'] ?? '';
            $subjects = !empty($currentSubjects) ? array_filter(explode(',', $currentSubjects)) : [];
            
            // Log current subjects for debugging
            error_log("Current subjects: " . implode(',', $subjects));
            
            if (!in_array($subjectId, $subjects)) {
                $subjects[] = $subjectId;
                $newSubjects = implode(',', $subjects);
                
                error_log("New subjects: $newSubjects");

                if ($professor) {
                    // Professor exists, update subjects
                    $stmt = $conn->prepare("
                        UPDATE professeur 
                        SET matiereEnseignee = ? 
                        WHERE idUtilisateur = ?
                    ");
                    $result = $stmt->execute([$newSubjects, $professorId]);
                    error_log("Update result: " . ($result ? "success" : "failure"));
                } else {
                    // Professor doesn't exist, create new record
                    $stmt = $conn->prepare("
                        INSERT INTO professeur (idUtilisateur, matiereEnseignee)
                        VALUES (?, ?)
                    ");
                    $result = $stmt->execute([$professorId, $newSubjects]);
                    error_log("Insert result: " . ($result ? "success" : "failure"));
                }
            }
        }

        $conn->commit();
        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        $conn->rollBack();
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}

/**
 * Handles request rejection
 */
function handleRejectRequest(PDO $conn) {
    $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
    if (!$notificationId) {
        throw new InvalidArgumentException('Invalid notification ID');
    }

    $stmt = $conn->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
    $stmt->execute([$notificationId]);
    
    echo json_encode(['success' => true]);
}