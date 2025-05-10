<?php
session_start();
ob_start(); // Prevent header issues

require_once 'config.php';
require_once 'email_functions.php';

// Process registration request
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect input data
    $nom = trim($_POST['nom']);
    $email = trim($_POST['email']);
    $password = trim($_POST['password']);
    $confirmPassword = trim($_POST['confirm_password']);
    $role = trim($_POST['role']);

    // Validation
    $errors = [];

    // Validate name
    if (empty($nom)) {
        $errors[] = "Le nom est requis.";
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
        $emailExists = $stmt->fetchColumn();
        
        if ($emailExists) {
            $errors[] = "Cet email est déjà utilisé.";
        }
    }

    // Validate password
    if (empty($password)) {
        $errors[] = "Le mot de passe est requis.";
    } elseif (strlen($password) < 8) {
        $errors[] = "Le mot de passe doit contenir au moins 8 caractères.";
    }

    // Validate password confirmation
    if ($password !== $confirmPassword) {
        $errors[] = "Les mots de passe ne correspondent pas.";
    }

    // Validate role
    $allowedRoles = ['etudiant', 'professeur', 'surveillant'];
    if (!in_array($role, $allowedRoles)) {
        $errors[] = "Rôle invalide.";
    }

    // Process registration if no errors
    if (empty($errors)) {
        try {
            $conn->beginTransaction();
            
            // Insert user into database with pending=1 (awaiting approval)
            $stmt = $conn->prepare("INSERT INTO utilisateur (nom, email, motDePasse, role, pending) VALUES (?, ?, ?, ?, 1)");
            $success = $stmt->execute([$nom, $email, $password, $role]);
            
            if ($success) {
                $userId = $conn->lastInsertId();
                
                // Create notification for admin to approve
                $notificationMessage = "Nouvelle demande d'inscription de $nom ($role).";
                $stmt = $conn->prepare("
                    INSERT INTO notification (destinataire, message, dateEnvoi, type, idReference, isRead) 
                    VALUES ('admin', ?, NOW(), 'registration_request', ?, 0)
                ");
                $stmt->execute([$notificationMessage, $userId]);
                
                // Send confirmation email to user
                $subject = "ExamEye - Confirmation de votre demande d'inscription";
                $message = "
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
                    <h2>Demande d'inscription reçue</h2>
                    <p>Bonjour $nom,</p>
                    <p>Nous avons bien reçu votre demande d'inscription sur la plateforme ExamEye.</p>
                    <p>Votre demande est actuellement en cours d'examen par notre équipe administrative. 
                    Vous recevrez un email de confirmation dès que votre compte sera activé.</p>
                    <p>Cordialement,<br>L'équipe ExamEye</p>
                </body>
                </html>";
                
                sendEmail($email, $subject, $message);
                
                $conn->commit();
                
                // Redirect to confirmation page
                echo "<script>
                    alert('Votre inscription a été soumise avec succès. Un administrateur va examiner votre demande.');
                    window.location.href = '../dashboards/login.html';
                </script>";
                exit();
            } else {
                throw new Exception("Échec de l'insertion dans la base de données.");
            }
        } catch (Exception $e) {
            $conn->rollBack();
            $errors[] = "Erreur d'inscription: " . $e->getMessage();
        }
    }
    
    // If there are errors, display them
    if (!empty($errors)) {
        $errorString = implode("\\n", $errors);
        echo "<script>alert('$errorString'); window.history.back();</script>";
    }
} else {
    // Redirect to registration form if not POST
    header("Location: ../dashboards/register.html");
    exit();
}
?>