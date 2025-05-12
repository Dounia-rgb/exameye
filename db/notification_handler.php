<?php
session_start();

// Enable strict error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0); // Keep errors hidden in JSON responses
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

// Verify admin session - only admin role can access this handler
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
            throw new InvalidArgumentException('Action non valide spécifiée');
    }
} catch (Throwable $e) {
    error_log("[Notification Error] " . date('Y-m-d H:i:s') . " - " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Une erreur est survenue',
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
        $request['senderName'] = 'Inconnu';
        $request['senderId'] = null;
        
        if ($request['type'] === 'subject_add_request') {
            // For subject_add_request, get professor info
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
                
                // Try to find professor who requested this subject
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
                SELECT nom, role FROM utilisateur WHERE idUtilisateur = ?
            ");
            $userStmt->execute([$request['idReference']]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                $request['senderName'] = $user['nom'] . " (" . translateRole($user['role']) . ")";
                $request['senderId'] = $request['idReference'];
                $request['role'] = $user['role'];
            }
        } else if ($request['type'] === 'registration_request') {
            // For registration requests, the reference is the user ID
            $userStmt = $conn->prepare("
                SELECT nom, email, role FROM utilisateur WHERE idUtilisateur = ?
            ");
            $userStmt->execute([$request['idReference']]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                $request['senderName'] = $user['nom'] . " (" . translateRole($user['role']) . ")";
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
 * Translate role to more readable French version
 */
function translateRole($role) {
    $translations = [
        'administrateur' => 'Chef de Département',
        'professeur' => 'Professeur',
        'admin' => 'Administrateur',
        'student' => 'Étudiant'
    ];
    
    return $translations[$role] ?? $role;
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
            throw new InvalidArgumentException('Paramètres requis manquants');
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
                throw new InvalidArgumentException('Données de référence manquantes');
            }
            
            $referenceData = json_decode($referenceJson, true);
            
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($referenceData)) {
                throw new RuntimeException('Format de données de matière invalide: ' . json_last_error_msg());
            }
            
            // Validate that we have the required fields
            if (!isset($referenceData['subject_id']) || !isset($referenceData['user_id'])) {
                throw new InvalidArgumentException('Champs de référence requis manquants');
            }
            
            // Handle user_id format
            if (!is_numeric($referenceData['user_id'])) {
                if (is_string($referenceData['user_id']) && strpos($referenceData['user_id'], '{') !== false) {
                    $userData = json_decode($referenceData['user_id'], true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($userData['user_id'])) {
                        $referenceData['user_id'] = $userData['user_id'];
                    } else {
                        throw new InvalidArgumentException('Format d\'ID utilisateur invalide');
                    }
                } else {
                    throw new InvalidArgumentException('Format d\'ID utilisateur invalide');
                }
            }
            
            // Handle subject_id format
            if (!is_numeric($referenceData['subject_id'])) {
                if (is_string($referenceData['subject_id']) && strpos($referenceData['subject_id'], '{') !== false) {
                    $subjectData = json_decode($referenceData['subject_id'], true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($subjectData['subject_id'])) {
                        $referenceData['subject_id'] = $subjectData['subject_id'];
                    } else {
                        throw new InvalidArgumentException('Format d\'ID matière invalide');
                    }
                } else {
                    throw new InvalidArgumentException('Format d\'ID matière invalide');
                }
            }

            $subjectId = $referenceData['subject_id'];
            $professorId = $referenceData['user_id'];

            // Verify user exists and is a professor
            $stmt = $conn->prepare("
                SELECT u.idUtilisateur, u.role, u.email, u.nom FROM utilisateur u
                WHERE u.idUtilisateur = ? AND u.role = 'professeur'
            ");
            $stmt->execute([$professorId]);
            $professor = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$professor) {
                throw new RuntimeException("Professeur non trouvé avec ID: " . $professorId);
            }

            // Update or create professor's subjects
            $stmt = $conn->prepare("SELECT matiereEnseignee FROM professeur WHERE idUtilisateur = ?");
            $stmt->execute([$professorId]);
            $professorRecord = $stmt->fetch(PDO::FETCH_ASSOC);

            // Handle empty or null matiereEnseignee
            $currentSubjects = $professorRecord['matiereEnseignee'] ?? '';
            $subjects = !empty($currentSubjects) ? array_filter(explode(',', $currentSubjects)) : [];
            
            if (!in_array($subjectId, $subjects)) {
                $subjects[] = $subjectId;
                $newSubjects = implode(',', $subjects);

                if ($professorRecord) {
                    // Professor already exists in professeur table, update subjects
                    $stmt = $conn->prepare("
                        UPDATE professeur 
                        SET matiereEnseignee = ? 
                        WHERE idUtilisateur = ?
                    ");
                    $stmt->execute([$newSubjects, $professorId]);
                } else {
                    // Professor doesn't exist in professeur table, create new record
                    $stmt = $conn->prepare("
                        INSERT INTO professeur (idUtilisateur, matiereEnseignee)
                        VALUES (?, ?)
                    ");
                    $stmt->execute([$professorId, $newSubjects]);
                }
            }
            
            // Get subject name
            $subjectStmt = $conn->prepare("SELECT matiere FROM matiere WHERE idMatiere = ?");
            $subjectStmt->execute([$subjectId]);
            $subjectData = $subjectStmt->fetch(PDO::FETCH_ASSOC);
            $subjectName = $subjectData ? $subjectData['matiere'] : "ID: $subjectId";
            
            // Send notification email to professor
            $subject = "ExamEye - Attribution de Matière Approuvée";
            $message = "
            <html>
            <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
                    <div style='text-align: center; margin-bottom: 20px;'>
                        <img src='https://exameye.com/logo.png' alt='ExamEye Logo' style='max-width: 150px;'>
                    </div>
                    
                    <h2 style='color: #2c3e50; text-align: center;'>Attribution de Matière Approuvée</h2>
                    
                    <p>Bonjour {$professor['nom']},</p>
                    
                    <p>Nous avons le plaisir de vous informer que votre demande d'enseigner la matière <strong>{$subjectName}</strong> a été approuvée.</p>
                    
                    <p>Vous pouvez maintenant accéder à cette matière depuis votre tableau de bord.</p>
                    
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='https://exameye.com/login.html' style='background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;'>Accéder à Mon Compte</a>
                    </div>
                    
                    <p>Si vous avez des questions, n'hésitez pas à contacter notre équipe de support.</p>
                    
                    <p>Cordialement,<br>L'équipe ExamEye</p>
                </div>
            </body>
            </html>";
            
            sendEmail($professor['email'], $subject, $message);
            error_log("Email d'approbation envoyé au professeur {$professor['nom']} ({$professor['email']}) pour la matière $subjectName");
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
                    throw new InvalidArgumentException('ID utilisateur non trouvé');
                }
            }
            
            // Get user information
            $stmt = $conn->prepare("SELECT nom, email, role FROM utilisateur WHERE idUtilisateur = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                throw new RuntimeException("Utilisateur non trouvé avec ID: $userId");
            }
            
            // Update user status to approved
            $stmt = $conn->prepare("UPDATE utilisateur SET status = 'active' WHERE idUtilisateur = ?");
            $stmt->execute([$userId]);
            
            // Send approval email
            $emailSent = sendApprovalEmail($user['email'], $user['nom'], $user['role']);
            
            // Log the approval
            $logMessage = "Inscription approuvée pour l'utilisateur ID: $userId, Nom: {$user['nom']}, Rôle: {$user['role']}, Email envoyé: " . ($emailSent ? "Oui" : "Non");
            error_log($logMessage);
        }
        // Handle profile edit request
        else if ($type === 'profile_edit_request') {
            // Get the user ID from the reference
            $userId = filter_input(INPUT_POST, 'referenceId', FILTER_VALIDATE_INT);
            if (!$userId) {
                $stmt = $conn->prepare("SELECT idReference FROM notification WHERE idNotification = ?");
                $stmt->execute([$notificationId]);
                $notification = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($notification) {
                    $userId = $notification['idReference'];
                } else {
                    throw new InvalidArgumentException('ID utilisateur non trouvé pour modification de profil');
                }
            }
            
            // Get user information
            $stmt = $conn->prepare("SELECT nom, email, role FROM utilisateur WHERE idUtilisateur = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                // Translate role for email
                $roleFr = translateRole($user['role']);
                
                // Send profile edit approval email
                $subject = "ExamEye - Modification de Profil Approuvée";
                $message = "
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
                        <div style='text-align: center; margin-bottom: 20px;'>
                            <img src='https://exameye.com/logo.png' alt='ExamEye Logo' style='max-width: 150px;'>
                        </div>
                        
                        <h2 style='color: #2c3e50; text-align: center;'>Modification de Profil Approuvée</h2>
                        
                        <p>Bonjour {$user['nom']},</p>
                        
                        <p>Votre demande de modification des informations de votre profil a été <strong style='color: #27ae60;'>approuvée</strong>.</p>
                        
                        <p>Les changements que vous avez demandés ont été appliqués à votre compte.</p>
                        
                        <div style='text-align: center; margin: 30px 0;'>
                            <a href='https://exameye.com/login.html' style='background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;'>Accéder à Mon Compte</a>
                        </div>
                        
                        <p>Si vous avez des questions, n'hésitez pas à contacter notre équipe de support.</p>
                        
                        <p>Cordialement,<br>L'équipe ExamEye</p>
                    </div>
                </body>
                </html>
                ";
                
                sendEmail($user['email'], $subject, $message);
                error_log("Email d'approbation de modification de profil envoyé à {$user['nom']} ({$user['email']})");
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
    $conn->beginTransaction();
    
    try {
        $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
        $type = filter_input(INPUT_POST, 'type', FILTER_SANITIZE_STRING);
        
        if (!$notificationId || !$type) {
            throw new InvalidArgumentException('Paramètres requis manquants');
        }

        // Mark notification as read
        $stmt = $conn->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);
        
        // Get rejection reason if provided
        $reason = filter_input(INPUT_POST, 'reason', FILTER_SANITIZE_STRING) ?? '';
        
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
                    // Send rejection email
                    $emailSent = sendRejectionEmail($user['email'], $user['nom'], $reason);
                    
                    // Mark as rejected
                    $stmt = $conn->prepare("UPDATE utilisateur SET status = 'rejected' WHERE idUtilisateur = ?");
                    $stmt->execute([$userId]);
                    
                    // Log the rejection
                    $logMessage = "Inscription rejetée pour l'utilisateur ID: $userId, Nom: {$user['nom']}, Email envoyé: " . ($emailSent ? "Oui" : "Non");
                    error_log($logMessage);
                }
            }
        } else if ($type === 'subject_add_request') {
            // Get reference data
            error_log("Rejet de demande de matière - ID Notification: " . $notificationId);
            error_log("Données de référence reçues: " . (isset($_POST['referenceId']) ? $_POST['referenceId'] : 'Aucune'));
            
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
                        $subject = "ExamEye - Demande de Matière Non Approuvée";
                        $reasonHtml = !empty($reason) ? 
                            "<p>Motif: <em>\"" . htmlspecialchars($reason) . "\"</em></p>" : 
                            "";
                            
                        $message = "
                        <html>
                        <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                            <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
                                <div style='text-align: center; margin-bottom: 20px;'>
                                    <img src='https://exameye.com/logo.png' alt='ExamEye Logo' style='max-width: 150px;'>
                                </div>
                                
                                <h2 style='color: #2c3e50; text-align: center;'>Demande de Matière Non Approuvée</h2>
                                
                                <p>Bonjour {$userData['nom']},</p>
                                
                                <p>Nous regrettons de vous informer que votre demande d'enseigner la matière " . 
                                ($subjectName ? "<strong>$subjectName</strong>" : "demandée") . 
                                " n'a pas été approuvée pour le moment.</p>
                                
                                $reasonHtml
                                
                                <p>Si vous pensez qu'il s'agit d'une erreur ou si vous avez des questions, veuillez contacter l'administration.</p>
                                
                                <p>Cordialement,<br>L'équipe ExamEye</p>
                            </div>
                        </body>
                        </html>";
                        
                        $emailSent = sendEmail($userData['email'], $subject, $message);
                        error_log("Email de rejet de demande de matière envoyé à {$userData['nom']} ({$userData['email']}): " . ($emailSent ? "Oui" : "Non"));
                    }
                }
            }
        } else if ($type === 'profile_edit_request') {
            // Get user ID from the reference
            $userId = filter_input(INPUT_POST, 'referenceId', FILTER_VALIDATE_INT);
            if (!$userId) {
                $stmt = $conn->prepare("SELECT idReference FROM notification WHERE idNotification = ?");
                $stmt->execute([$notificationId]);
                $notification = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($notification) {
                    $userId = $notification['idReference'];
                } else {
                    throw new InvalidArgumentException('ID utilisateur non trouvé pour modification de profil');
                }
            }
            
            // Get user information
            $stmt = $conn->prepare("SELECT nom, email FROM utilisateur WHERE idUtilisateur = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                // Send profile edit rejection email
                $subject = "ExamEye - Demande de Modification de Profil Non Approuvée";
                $reasonHtml = !empty($reason) ? 
                    "<p>Motif: <em>\"" . htmlspecialchars($reason) . "\"</em></p>" : 
                    "";
                    
                $message = "
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
                        <div style='text-align: center; margin-bottom: 20px;'>
                            <img src='https://exameye.com/logo.png' alt='ExamEye Logo' style='max-width: 150px;'>
                        </div>
                        
                        <h2 style='color: #2c3e50; text-align: center;'>Modification de Profil Non Approuvée</h2>
                        
                        <p>Bonjour {$user['nom']},</p>
                        
                        <p>Votre demande de modification des informations de votre profil n'a <strong style='color: #e74c3c;'>pas été approuvée</strong>.</p>
                        
                        $reasonHtml
                        
                        <p>Si vous avez des questions, n'hésitez pas à contacter notre équipe de support.</p>
                        
                        <p>Cordialement,<br>L'équipe ExamEye</p>
                    </div>
                </body>
                </html>
                ";
                
                sendEmail($user['email'], $subject, $message);
                error_log("Email de rejet de modification de profil envoyé à {$user['nom']} ({$user['email']})");
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