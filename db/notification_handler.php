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
require_once __DIR__ . '/email_functions.php';

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
    // Get all pending requests including registration requests
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
        AND n.type IN ('profile_edit_request', 'subject_add_request', 'registration_request')
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
        } else if ($request['type'] === 'registration_request') {
            // For registration requests, the reference is the user ID
            $userStmt = $conn->prepare("
                SELECT nom, email, role FROM utilisateur WHERE idUtilisateur = ?
            ");
            $userStmt->execute([$request['idReference']]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                $request['senderName'] = $user['nom'];
                $request['senderId'] = $request['idReference'];
                $request['email'] = $user['email'];
                $request['role'] = $user['role'];
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

        // Mark notification as read
        $stmt = $conn->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);

        // Handle subject add requests
        if ($type === 'subject_add_request') {
            // For subject add requests, get the reference data
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
            
            // Handle user_id format
            if (!is_numeric($referenceData['user_id'])) {
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
            
            // Handle subject_id format
            if (!is_numeric($referenceData['subject_id'])) {
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

            $subjectId = $referenceData['subject_id'];
            $professorId = $referenceData['user_id'];

            // Verify user exists
            $stmt = $conn->prepare("
                SELECT idUtilisateur, role FROM utilisateur 
                WHERE idUtilisateur = ?
            ");
            $stmt->execute([$professorId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                throw new RuntimeException("User not found with ID: " . $professorId);
            }

            // Update or create professor's subjects
            $stmt = $conn->prepare("SELECT matiereEnseignee FROM professeur WHERE idUtilisateur = ?");
            $stmt->execute([$professorId]);
            $professor = $stmt->fetch(PDO::FETCH_ASSOC);

            // Handle empty or null matiereEnseignee
            $currentSubjects = $professor['matiereEnseignee'] ?? '';
            $subjects = !empty($currentSubjects) ? array_filter(explode(',', $currentSubjects)) : [];
            
            if (!in_array($subjectId, $subjects)) {
                $subjects[] = $subjectId;
                $newSubjects = implode(',', $subjects);

                if ($professor) {
                    // Professor exists, update subjects
                    $stmt = $conn->prepare("
                        UPDATE professeur 
                        SET matiereEnseignee = ? 
                        WHERE idUtilisateur = ?
                    ");
                    $stmt->execute([$newSubjects, $professorId]);
                } else {
                    // Professor doesn't exist, create new record
                    $stmt = $conn->prepare("
                        INSERT INTO professeur (idUtilisateur, matiereEnseignee)
                        VALUES (?, ?)
                    ");
                    $stmt->execute([$professorId, $newSubjects]);
                }
            }
            
            // Notify the professor that their subject request was approved
            $notifyStmt = $conn->prepare("
                SELECT email, nom FROM utilisateur WHERE idUtilisateur = ?
            ");
            $notifyStmt->execute([$professorId]);
            $professorData = $notifyStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($professorData) {
                // Get subject name
                $subjectStmt = $conn->prepare("SELECT matiere FROM matiere WHERE idMatiere = ?");
                $subjectStmt->execute([$subjectId]);
                $subjectData = $subjectStmt->fetch(PDO::FETCH_ASSOC);
                $subjectName = $subjectData ? $subjectData['matiere'] : "ID: $subjectId";
                
                // Send notification email
                $subject = "ExamEye - Subject Assignment Approved";
                $message = "
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                    <h2>Subject Assignment Approved</h2>
                    <p>Dear {$professorData['nom']},</p>
                    <p>We are pleased to inform you that your request to teach the subject <strong>$subjectName</strong> has been approved.</p>
                    <p>You can now access this subject from your dashboard.</p>
                    <p>Best regards,<br>The ExamEye Team</p>
                </body>
                </html>";
                
                sendEmail($professorData['email'], $subject, $message);
            }
        } 
        // Handle registration approval
        else if ($type === 'registration_request') {
            // Get the user ID from the reference
            $userId = filter_input(INPUT_POST, 'referenceId', FILTER_VALIDATE_INT);
            if (!$userId) {
                // Try to get from notification information
                $stmt = $conn->prepare("SELECT idReference FROM notification WHERE idNotification = ?");
                $stmt->execute([$notificationId]);
                $notification = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($notification) {
                    $userId = $notification['idReference'];
                } else {
                    throw new InvalidArgumentException('User ID not found');
                }
            }
            
            // Get user information
            $stmt = $conn->prepare("SELECT nom, email, role FROM utilisateur WHERE idUtilisateur = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                throw new RuntimeException("User not found with ID: $userId");
            }
            
            // Update user status to approved
            $stmt = $conn->prepare("UPDATE utilisateur SET pending = 0 WHERE idUtilisateur = ?");
            $stmt->execute([$userId]);
            
            // Send approval email
            sendApprovalEmail($user['email'], $user['nom'], $user['role']);
            
            // Log the approval
            error_log("Registration approved for user ID: $userId, Name: {$user['nom']}, Role: {$user['role']}");
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
    $conn->beginTransaction();
    
    try {
        $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
        $type = filter_input(INPUT_POST, 'type', FILTER_SANITIZE_STRING);
        
        if (!$notificationId || !$type) {
            throw new InvalidArgumentException('Missing required parameters');
        }

        // Mark notification as read
        $stmt = $conn->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);
        
        // If this is a registration request, notify the user and update their status
        if ($type === 'registration_request') {
            // Get the user ID from the reference
            $stmt = $conn->prepare("SELECT idReference FROM notification WHERE idNotification = ?");
            $stmt->execute([$notificationId]);
            $notification = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($notification) {
                $userId = $notification['idReference'];
                
                // Get user information
                $stmt = $conn->prepare("SELECT nom, email FROM utilisateur WHERE idUtilisateur = ?");
                $stmt->execute([$userId]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($user) {
                    // Get rejection reason if provided
                    $reason = filter_input(INPUT_POST, 'reason', FILTER_SANITIZE_STRING) ?? '';
                    
                    // Send rejection email
                    sendRejectionEmail($user['email'], $user['nom'], $reason);
                    
                    // Delete or mark the user account (optional)
                    // Uncomment if you want to delete rejected users
                    // $stmt = $conn->prepare("DELETE FROM utilisateur WHERE idUtilisateur = ?");
                    // $stmt->execute([$userId]);
                    
                    // Or mark as rejected
                    $stmt = $conn->prepare("UPDATE utilisateur SET pending = 2 WHERE idUtilisateur = ?");
                    $stmt->execute([$userId]);
                    
                    // Log the rejection
                    error_log("Registration rejected for user ID: $userId, Name: {$user['nom']}");
                }
            }
        } else if ($type === 'subject_add_request') {
            // Get reference data
            $referenceJson = $_POST['referenceId'] ?? null;
            if ($referenceJson) {
                $referenceData = json_decode($referenceJson, true);
                
                if (is_array($referenceData) && isset($referenceData['user_id'])) {
                    $userId = $referenceData['user_id'];
                    $subjectId = $referenceData['subject_id'] ?? null;
                    
                    // Get user email
                    $stmt = $conn->prepare("SELECT email, nom FROM utilisateur WHERE idUtilisateur = ?");
                    $stmt->execute([$userId]);
                    $userData = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($userData) {
                        // Get subject name if available
                        $subjectName = "";
                        if ($subjectId) {
                            $stmt = $conn->prepare("SELECT matiere FROM matiere WHERE idMatiere = ?");
                            $stmt->execute([$subjectId]);
                            $subjectData = $stmt->fetch(PDO::FETCH_ASSOC);
                            $subjectName = $subjectData ? $subjectData['matiere'] : "ID: $subjectId";
                        }
                        
                        // Send rejection notification
                        $subject = "ExamEye - Subject Request Not Approved";
                        $message = "
                        <html>
                        <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                            <h2>Subject Request Not Approved</h2>
                            <p>Dear {$userData['nom']},</p>
                            <p>We regret to inform you that your request to teach the subject " . 
                            ($subjectName ? "<strong>$subjectName</strong>" : "requested") . 
                            " was not approved at this time.</p>
                            <p>If you believe this is an error or have questions, please contact the administration.</p>
                            <p>Best regards,<br>The ExamEye Team</p>
                        </body>
                        </html>";
                        
                        sendEmail($userData['email'], $subject, $message);
                    }
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
?>