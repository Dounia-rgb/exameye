<?php
// Set headers first to prevent any output
header('Content-Type: application/json');
session_start();

require_once 'config.php';
require_once 'email_functions.php';

// Process registration request
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    try {
        // Collect and sanitize input data
        $nom = trim($_POST['nom'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $password = trim($_POST['password'] ?? '');
        $confirmPassword = trim($_POST['confirm_password'] ?? '');
        $role = trim($_POST['role'] ?? '');

        // Validation
        $errors = [];

        // Validate name
        if (empty($nom)) {
            $errors[] = "Le nom est requis.";
        } elseif (strlen($nom) < 3) {
            $errors[] = "Le nom doit contenir au moins 3 caractères.";
        }

        // Validate email
        if (empty($email)) {
            $errors[] = "L'email est requis.";
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = "Format d'email invalide.";
        } else {
            // Check if email exists
            $stmt = $conn->prepare("SELECT COUNT(*) FROM utilisateur WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetchColumn() > 0) {
                $errors[] = "Cet email est déjà utilisé.";
            }
        }

        // Validate password
        if (empty($password)) {
            $errors[] = "Le mot de passe est requis.";
        } elseif (strlen($password) < 8) {
            $errors[] = "Le mot de passe doit contenir au moins 8 caractères.";
        } elseif ($password !== $confirmPassword) {
            $errors[] = "Les mots de passe ne correspondent pas.";
        }

        // Validate role
        $allowedRoles = ['administrateur', 'professeur'];
        if (!in_array($role, $allowedRoles)) {
            $errors[] = "Rôle invalide.";
        }

        // If validation errors, return them
        if (!empty($errors)) {
            echo json_encode([
                'success' => false,
                'errors' => $errors
            ]);
            exit();
        }

        // Start transaction
        $conn->beginTransaction();

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        // Insert into utilisateur table with consistent status field (pending = 1)
        $stmt = $conn->prepare("INSERT INTO utilisateur (nom, email, motDePasse, role, status) VALUES (?, ?, ?, ?, 'pending')");
        $stmt->execute([$nom, $email, $hashedPassword, $role]);
        $userId = $conn->lastInsertId();

        // Insert into role-specific table
        if ($role === 'administrateur') {
            $stmt = $conn->prepare("INSERT INTO administrateur (idUtilisateur) VALUES (?)");
            $stmt->execute([$userId]);
        } elseif ($role === 'professeur') {
            $stmt = $conn->prepare("INSERT INTO professeur (idUtilisateur, matiereEnseignee) VALUES (?, NULL)");
            $stmt->execute([$userId]);
        }

        // Create admin notifications by finding administrators
        $notificationMessage = "Nouvelle demande d'inscription de $nom ($role).";
        
        // Find active administrators to notify
        $stmt = $conn->prepare("SELECT idUtilisateur FROM utilisateur WHERE role = 'administrateur' AND status = 'active'");
        $stmt->execute();
        $adminIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (empty($adminIds)) {
            // Fallback to finding any administrator
            $stmt = $conn->prepare("SELECT idUtilisateur FROM administrateur");
            $stmt->execute();
            $adminIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }
        
        // Create notifications for each admin
        foreach ($adminIds as $adminId) {
            $stmt = $conn->prepare("
                INSERT INTO notification 
                (destinataire, message, dateEnvoi, type, idReference, isRead, url) 
                VALUES (?, ?, NOW(), 'registration_request', ?, 0, '../admin/gestion_demandes.php')
            ");
            $stmt->execute([$adminId, $notificationMessage, $userId]);
        }

        // Send confirmation email
        $subject = "ExamEye - Demande d'inscription reçue";
        $message = "
        <html>
        <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
            <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
                <h2 style='color: #2c3e50; text-align: center;'>Demande d'inscription reçue</h2>
                
                <p>Bonjour $nom,</p>
                
                <p>Nous avons bien reçu votre demande d'inscription à la plateforme ExamEye en tant que <strong>$role</strong>.</p>
                
                <p>Votre demande est actuellement <strong>en attente d'approbation</strong> par un administrateur.</p>
                
                <p>Vous recevrez un email dès que votre demande sera traitée.</p>
                
                <p>Cordialement,<br>L'équipe ExamEye</p>
            </div>
        </body>
        </html>";
        
        sendEmail($email, $subject, $message);

        // Commit transaction
        $conn->commit();

        // Return success
        echo json_encode([
            'success' => true,
            'message' => 'Inscription soumise avec succès. En attente de validation par un administrateur.',
            'redirect' => '../dashboards/login.html?registration=pending'
        ]);
        
    } catch (PDOException $e) {
        $conn->rollBack();
        error_log("Database error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'errors' => ["Erreur de base de données. Veuillez réessayer."]
        ]);
    } catch (Exception $e) {
        error_log("General error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'errors' => ["Une erreur est survenue. Veuillez réessayer."]
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'errors' => ["Méthode non autorisée"]
    ]);
}
?>