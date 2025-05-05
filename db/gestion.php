<?php
session_start();
// Débogage de la session
error_log("Session ID: " . session_id());
error_log("Session data: " . print_r($_SESSION, true));
require_once 'config.php';

// Vérifier que l'utilisateur est connecté et est admin
if (!isset($_SESSION['idUtilisateur'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Utilisateur non connecté']);
    exit;
} elseif ($_SESSION['role'] !== 'admin') {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Accès non autorisé. Rôle requis: admin, Rôle actuel: ' . $_SESSION['role']]);
    exit;
}

try {
    $pdo = $conn;
    
    // Récupérer action depuis POST ou GET en utilisant filter_input pour plus de sécurité
    $action = filter_input(INPUT_POST, 'action', FILTER_SANITIZE_SPECIAL_CHARS) ?? 
              filter_input(INPUT_GET, 'action', FILTER_SANITIZE_SPECIAL_CHARS) ?? '';
    
    switch ($action) {
        case 'getUsers':
            // Récupérer tous les utilisateurs par rôle
            $role = filter_input(INPUT_GET, 'role', FILTER_SANITIZE_SPECIAL_CHARS) ?? 'professeur';
            getUsers($pdo, $role);
            break;
            
        case 'edit':
            // Modifier un utilisateur
            if (!isset($_POST['id'], $_POST['name'], $_POST['email'], $_POST['role'])) {
                throw new Exception('Données incomplètes');
            }
            
            $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
            $name = filter_input(INPUT_POST, 'name', FILTER_SANITIZE_SPECIAL_CHARS);
            $email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
            $role = filter_input(INPUT_POST, 'role', FILTER_SANITIZE_SPECIAL_CHARS);
            
            if (!$id || !$name || !$email || !$role) {
                throw new Exception('Données invalides');
            }
            
            if ($role === 'professeur' && isset($_POST['field'])) {
                $field = filter_input(INPUT_POST, 'field', FILTER_SANITIZE_SPECIAL_CHARS);
                editProfesseur($pdo, $id, $name, $email, $field);
            } elseif ($role === 'administrateur' && isset($_POST['field'])) {
                $field = filter_input(INPUT_POST, 'field', FILTER_SANITIZE_SPECIAL_CHARS);
                editAdministrateur($pdo, $id, $name, $email, $field);
            } else {
                throw new Exception('Données de rôle invalides');
            }
            break;
            
        case 'delete':
            // Supprimer un utilisateur
            $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
            if (!$id) {
                throw new Exception('ID utilisateur invalide ou manquant');
            }
            
            deleteUser($pdo, $id);
            break;
            
        case 'getNotifications':
            // Récupérer les notifications non lues
            getNotifications($pdo);
            break;
            
        case 'markAsRead':
            // Marquer une notification comme lue
            $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
            if (!$id) {
                throw new Exception('ID notification invalide ou manquant');
            }
            
            markNotificationAsRead($pdo, $id);
            break;
            
        case 'approveRequest':
            // Approuver une demande
            $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
            $type = filter_input(INPUT_POST, 'type', FILTER_SANITIZE_SPECIAL_CHARS);
            
            if (!$id || !$type) {
                throw new Exception('Données incomplètes ou invalides');
            }
            
            approveRequest($pdo, $id, $type);
            break;
            
        case 'rejectRequest':
            // Rejeter une demande
            $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
            $type = filter_input(INPUT_POST, 'type', FILTER_SANITIZE_SPECIAL_CHARS);
            
            if (!$id || !$type) {
                throw new Exception('Données incomplètes ou invalides');
            }
            
            rejectRequest($pdo, $id, $type);
            break;

        /* NEW REQUEST MANAGEMENT ACTIONS */
        case 'getPendingRequests':
            getPendingRequests($pdo);
            break;

        case 'approveProfileEdit':
            $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
            if (!$notificationId) {
                throw new Exception('ID de notification invalide');
            }
            approveProfileEditRequest($pdo, $notificationId);
            break;
            
        case 'approveSubjectAdd':
            $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
            if (!$notificationId) {
                throw new Exception('ID de notification invalide');
            }
            approveSubjectAddRequest($pdo, $notificationId);
            break;
            
        case 'rejectProfileRequest':
            $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
            if (!$notificationId) {
                throw new Exception('ID de notification invalide');
            }
            rejectProfileRequest($pdo, $notificationId);
            break;
            
        case 'rejectSubjectRequest':
            $notificationId = filter_input(INPUT_POST, 'notificationId', FILTER_VALIDATE_INT);
            if (!$notificationId) {
                throw new Exception('ID de notification invalide');
            }
            rejectSubjectRequest($pdo, $notificationId);
            break;
            
        default:
            throw new Exception('Action non reconnue');
    }
} catch (PDOException $e) {
    header('Content-Type: application/json');
    // Ne pas exposer les détails de l'erreur en production
    echo json_encode(['success' => false, 'message' => 'Erreur de base de données']);
    error_log('PDO Error: ' . $e->getMessage());
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

/* ==============================================
   EXISTING FUNCTIONS - KEEP THESE EXACTLY AS IS
   ============================================== */

function getUsers($pdo, $role) {
    if (!in_array($role, ['professeur', 'administrateur'])) {
        throw new Exception('Rôle non valide');
    }
    
    if ($role === 'professeur') {
        $stmt = $pdo->prepare("
            SELECT u.idUtilisateur, u.nom, u.email, p.matiereEnseignee 
            FROM utilisateur u
            LEFT JOIN professeur p ON u.idUtilisateur = p.idUtilisateur
            WHERE u.role = :role
            ORDER BY u.nom
        ");
        $stmt->bindValue(':role', $role, PDO::PARAM_STR);
    } else {
        $stmt = $pdo->prepare("
            SELECT u.idUtilisateur, u.nom, u.email, 'Informatique' as departement
            FROM utilisateur u
            WHERE u.role = :role
            ORDER BY u.nom
        ");
        $stmt->bindValue(':role', $role, PDO::PARAM_STR);
    }
    
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'users' => $users]);
}

function editProfesseur($pdo, $id, $name, $email, $field) {
    $pdo->beginTransaction();
    
    try {
        // Vérifier d'abord si l'utilisateur existe et est un professeur
        $checkStmt = $pdo->prepare("
            SELECT idUtilisateur FROM utilisateur 
            WHERE idUtilisateur = :id AND role = 'professeur'
        ");
        $checkStmt->bindValue(':id', $id, PDO::PARAM_INT);
        $checkStmt->execute();
        
        if ($checkStmt->rowCount() === 0) {
            throw new Exception('Aucun professeur trouvé avec cet ID');
        }
        
        // Mettre à jour la table utilisateur
        $stmt = $pdo->prepare("
            UPDATE utilisateur 
            SET nom = :nom, email = :email 
            WHERE idUtilisateur = :id
        ");
        
        $stmt->bindValue(':nom', $name, PDO::PARAM_STR);
        $stmt->bindValue(':email', $email, PDO::PARAM_STR);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        
        // Vérifier si l'entrée existe dans la table professeur
        $checkProfStmt = $pdo->prepare("
            SELECT idUtilisateur FROM professeur 
            WHERE idUtilisateur = :id
        ");
        $checkProfStmt->bindValue(':id', $id, PDO::PARAM_INT);
        $checkProfStmt->execute();
        
        if ($checkProfStmt->rowCount() === 0) {
            // Si l'entrée n'existe pas, l'insérer
            $insertStmt = $pdo->prepare("
                INSERT INTO professeur (idUtilisateur, matiereEnseignee)
                VALUES (:id, :matiere)
            ");
            $insertStmt->bindValue(':id', $id, PDO::PARAM_INT);
            $insertStmt->bindValue(':matiere', $field, PDO::PARAM_STR);
            $insertStmt->execute();
        } else {
            // Si l'entrée existe, la mettre à jour
            $updateStmt = $pdo->prepare("
                UPDATE professeur 
                SET matiereEnseignee = :matiere 
                WHERE idUtilisateur = :id
            ");
            $updateStmt->bindValue(':matiere', $field, PDO::PARAM_STR);
            $updateStmt->bindValue(':id', $id, PDO::PARAM_INT);
            $updateStmt->execute();
        }
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function editAdministrateur($pdo, $id, $name, $email, $departement) {
    $stmt = $pdo->prepare("
        UPDATE utilisateur 
        SET nom = :nom, email = :email
        WHERE idUtilisateur = :id AND role = 'administrateur'
    ");
    
    $stmt->bindValue(':nom', $name, PDO::PARAM_STR);
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('Aucun chef de département trouvé avec cet ID');
    }
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true]);
}

function deleteUser($pdo, $id) {
    $pdo->beginTransaction();
    
    try {
        // Vérifier le rôle de l'utilisateur
        $stmt = $pdo->prepare("SELECT role FROM utilisateur WHERE idUtilisateur = :id");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            throw new Exception('Utilisateur non trouvé');
        }
        
        // Si c'est un professeur, supprimer d'abord les entrées dans la table professeur
        if ($user['role'] === 'professeur') {
            $stmt = $pdo->prepare("DELETE FROM professeur WHERE idUtilisateur = :id");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
        }
        
        // Supprimer l'utilisateur
        $stmt = $pdo->prepare("DELETE FROM utilisateur WHERE idUtilisateur = :id");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            throw new Exception('Échec de la suppression de l\'utilisateur');
        }
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function getNotifications($pdo) {
    $stmt = $pdo->prepare("
        SELECT n.idNotification, n.message, n.dateEnvoi, n.type, n.idReference, u.nom, u.email
        FROM notification n
        JOIN utilisateur u ON n.destinataire = u.idUtilisateur
        WHERE n.isRead = 0
        ORDER BY n.dateEnvoi DESC
    ");
    
    $stmt->execute();
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'notifications' => $notifications]);
}

function markNotificationAsRead($pdo, $id) {
    $stmt = $pdo->prepare("
        UPDATE notification 
        SET isRead = 1 
        WHERE idNotification = :id
    ");
    
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('Notification non trouvée ou déjà marquée comme lue');
    }
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true]);
}

function approveRequest($pdo, $id, $type) {
    $pdo->beginTransaction();
    
    try {
        if ($type === 'convocation') {
            // Traiter l'approbation d'une convocation
            $stmt = $pdo->prepare("UPDATE convocation SET statut = 'approuvé' WHERE idConvocation = :id");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            if ($stmt->rowCount() === 0) {
                throw new Exception('Convocation non trouvée ou déjà approuvée');
            }
            
            // Ajouter une notification pour informer le professeur
            $stmt = $pdo->prepare("
                SELECT idProfesseur FROM convocation WHERE idConvocation = :id
            ");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $convocation = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($convocation) {
                $stmt = $pdo->prepare("
                    INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead)
                    VALUES (:destinataire, 'Votre demande de convocation a été approuvée', NOW(), 'convocation_approved', :id, 0)
                ");
                
                $stmt->bindValue(':destinataire', $convocation['idProfesseur'], PDO::PARAM_INT);
                $stmt->bindValue(':id', $id, PDO::PARAM_INT);
                $stmt->execute();
            }
        } else if ($type === 'surveillance') {
            // Traiter l'approbation d'une surveillance
            $stmt = $pdo->prepare("UPDATE surveillance SET statut = 'approuvé' WHERE idSurveillance = :id");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            if ($stmt->rowCount() === 0) {
                throw new Exception('Surveillance non trouvée ou déjà approuvée');
            }
            
            // Ajouter une notification
            $stmt = $pdo->prepare("
                SELECT idProfesseur FROM surveillance WHERE idSurveillance = :id
            ");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $surveillance = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($surveillance) {
                $stmt = $pdo->prepare("
                    INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead)
                    VALUES (:destinataire, 'Votre demande concernant la surveillance a été approuvée', NOW(), 'surveillance_approved', :id, 0)
                ");
                
                $stmt->bindValue(':destinataire', $surveillance['idProfesseur'], PDO::PARAM_INT);
                $stmt->bindValue(':id', $id, PDO::PARAM_INT);
                $stmt->execute();
            }
        } else {
            throw new Exception('Type de demande non reconnu');
        }
        
        // Marquer la notification comme lue
        $stmt = $pdo->prepare("
            UPDATE notification 
            SET isRead = 1 
            WHERE type IN ('convocation_request', 'surveillance_request') AND idReference = :id
        ");
        
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function rejectRequest($pdo, $id, $type) {
    $pdo->beginTransaction();
    
    try {
        if ($type === 'convocation') {
            // Traiter le rejet d'une convocation
            $stmt = $pdo->prepare("UPDATE convocation SET statut = 'rejeté' WHERE idConvocation = :id");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            if ($stmt->rowCount() === 0) {
                throw new Exception('Convocation non trouvée ou déjà rejetée');
            }
            
            // Ajouter une notification pour informer le professeur
            $stmt = $pdo->prepare("
                SELECT idProfesseur FROM convocation WHERE idConvocation = :id
            ");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $convocation = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($convocation) {
                $stmt = $pdo->prepare("
                    INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead)
                    VALUES (:destinataire, 'Votre demande de convocation a été rejetée', NOW(), 'convocation_rejected', :id, 0)
                ");
                
                $stmt->bindValue(':destinataire', $convocation['idProfesseur'], PDO::PARAM_INT);
                $stmt->bindValue(':id', $id, PDO::PARAM_INT);
                $stmt->execute();
            }
        } else if ($type === 'surveillance') {
            // Traiter le rejet d'une surveillance
            $stmt = $pdo->prepare("UPDATE surveillance SET statut = 'rejeté' WHERE idSurveillance = :id");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            if ($stmt->rowCount() === 0) {
                throw new Exception('Surveillance non trouvée ou déjà rejetée');
            }
            
            // Ajouter une notification
            $stmt = $pdo->prepare("
                SELECT idProfesseur FROM surveillance WHERE idSurveillance = :id
            ");
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $surveillance = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($surveillance) {
                $stmt = $pdo->prepare("
                    INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead)
                    VALUES (:destinataire, 'Votre demande concernant la surveillance a été rejetée', NOW(), 'surveillance_rejected', :id, 0)
                ");
                
                $stmt->bindValue(':destinataire', $surveillance['idProfesseur'], PDO::PARAM_INT);
                $stmt->bindValue(':id', $id, PDO::PARAM_INT);
                $stmt->execute();
            }
        } else {
            throw new Exception('Type de demande non reconnu');
        }
        
        // Marquer la notification comme lue
        $stmt = $pdo->prepare("
            UPDATE notification 
            SET isRead = 1 
            WHERE type IN ('convocation_request', 'surveillance_request') AND idReference = :id
        ");
        
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/* ==============================================
   NEW REQUEST MANAGEMENT FUNCTIONS
   ============================================== */

function getPendingRequests($pdo) {
    $stmt = $pdo->prepare("
        SELECT n.idNotification, n.message, n.dateEnvoi, n.type, n.idReference, u.nom as senderName
        FROM notification n
        JOIN utilisateur u ON n.destinataire = u.idUtilisateur
        WHERE n.isRead = 0 
        AND n.type IN ('profile_edit_request', 'subject_add_request')
        ORDER BY n.dateEnvoi DESC
    ");
    
    $stmt->execute();
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'requests' => $requests]);
}

function approveProfileEditRequest($pdo, $notificationId) {
    $pdo->beginTransaction();
    
    try {
        // Get the notification with changes
        $stmt = $pdo->prepare("
            SELECT n.idReference, n.destinataire, u.nom 
            FROM notification n
            JOIN utilisateur u ON n.destinataire = u.idUtilisateur
            WHERE n.idNotification = ? AND n.type = 'profile_edit_request'
        ");
        $stmt->execute([$notificationId]);
        $notification = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$notification) {
            throw new Exception('Notification non trouvée');
        }
        
        $changes = json_decode($notification['idReference'], true);
        
        // Update user profile
        $updateSql = "UPDATE utilisateur SET nom = ?, email = ?";
        $params = [$changes['new_name'], $changes['new_email']];
        
        if (!empty($changes['new_password'])) {
            $updateSql .= ", motDePasse = ?";
            $params[] = password_hash($changes['new_password'], PASSWORD_DEFAULT);
        }
        
        $updateSql .= " WHERE idUtilisateur = ?";
        $params[] = $notification['destinataire'];
        
        $stmt = $pdo->prepare($updateSql);
        $stmt->execute($params);
        
        // Mark notification as read
        $stmt = $pdo->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);
        
        // Create success notification for user
        $stmt = $pdo->prepare("
            INSERT INTO notification 
            (destinataire, message, dateEnvoi, type, isRead, url)
            VALUES (?, 'Votre demande de modification de profil a été approuvée', NOW(), 'profile_edit_approved', 0, '/compte')
        ");
        $stmt->execute([$notification['destinataire']]);
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function approveSubjectAddRequest($pdo, $notificationId) {
    $pdo->beginTransaction();
    
    try {
        // Get the notification with subject info
        $stmt = $pdo->prepare("
            SELECT n.idReference, n.destinataire 
            FROM notification n
            WHERE n.idNotification = ? AND n.type = 'subject_add_request'
        ");
        $stmt->execute([$notificationId]);
        $notification = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$notification) {
            throw new Exception('Notification non trouvée');
        }
        
        $subjectInfo = json_decode($notification['idReference'], true);
        
        // Get current subjects for professor
        $stmt = $pdo->prepare("SELECT matiereEnseignee FROM professeur WHERE idUtilisateur = ?");
        $stmt->execute([$notification['destinataire']]);
        $professor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $currentSubjects = $professor ? explode(',', $professor['matiereEnseignee']) : [];
        
        // Add new subject if not already present
        if (!in_array($subjectInfo['idMatiere'], $currentSubjects)) {
            $currentSubjects[] = $subjectInfo['idMatiere'];
            $updatedSubjects = implode(',', $currentSubjects);
            
            // Update professor subjects
            $stmt = $pdo->prepare("
                INSERT INTO professeur (idUtilisateur, matiereEnseignee)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE matiereEnseignee = ?
            ");
            $stmt->execute([$notification['destinataire'], $updatedSubjects, $updatedSubjects]);
        }
        
        // Mark notification as read
        $stmt = $pdo->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);
        
        // Create success notification for user
        $stmt = $pdo->prepare("
            INSERT INTO notification 
            (destinataire, message, dateEnvoi, type, isRead, url)
            VALUES (?, CONCAT('Votre demande d\\'ajout de matière (', ?, ') a été approuvée'), NOW(), 'subject_add_approved', 0, '/compte')
        ");
        $stmt->execute([$notification['destinataire'], $subjectInfo['subject']]);
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function rejectProfileRequest($pdo, $notificationId) {
    $pdo->beginTransaction();
    
    try {
        // Get notification to find user
        $stmt = $pdo->prepare("
            SELECT destinataire, idReference 
            FROM notification 
            WHERE idNotification = ? AND type = 'profile_edit_request'
        ");
        $stmt->execute([$notificationId]);
        $notification = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$notification) {
            throw new Exception('Notification non trouvée');
        }
        
        // Mark notification as read
        $stmt = $pdo->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);
        
        // Create rejection notification for user
        $stmt = $pdo->prepare("
            INSERT INTO notification 
            (destinataire, message, dateEnvoi, type, isRead, url)
            VALUES (?, 'Votre demande de modification de profil a été rejetée', NOW(), 'profile_edit_rejected', 0, '/compte')
        ");
        $stmt->execute([$notification['destinataire']]);
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function rejectSubjectRequest($pdo, $notificationId) {
    $pdo->beginTransaction();
    
    try {
        // Get notification to find user
        $stmt = $pdo->prepare("
            SELECT destinataire, idReference 
            FROM notification 
            WHERE idNotification = ? AND type = 'subject_add_request'
        ");
        $stmt->execute([$notificationId]);
        $notification = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$notification) {
            throw new Exception('Notification non trouvée');
        }
        
        $subjectInfo = json_decode($notification['idReference'], true);
        
        // Mark notification as read
        $stmt = $pdo->prepare("UPDATE notification SET isRead = 1 WHERE idNotification = ?");
        $stmt->execute([$notificationId]);
        
        // Create rejection notification for user
        $stmt = $pdo->prepare("
            INSERT INTO notification 
            (destinataire, message, dateEnvoi, type, isRead, url)
            VALUES (?, CONCAT('Votre demande d\\'ajout de matière (', ?, ') a été rejetée'), NOW(), 'subject_add_rejected', 0, '/compte')
        ");
        $stmt->execute([$notification['destinataire'], $subjectInfo['subject']]);
        
        $pdo->commit();
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
?>