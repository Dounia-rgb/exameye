<?php
/**
 * ExamEye Email Functions - MODIFIED WITH DEBUG
 * This file contains all the email-related functions used throughout the application
 * Updated to use PHPMailer instead of PHP's mail function
 */

// Set default character set
ini_set('default_charset', 'UTF-8');

// Required PHPMailer classes - autoloaded by Composer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

// Make sure Composer autoloader is included
// Adjust the path if necessary based on your actual folder structure
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';

define('LOGO_URL', 'https://i.imgur.com/4DdNUpc.jpg');

/**
 * Send an email using PHPMailer
 *
 * @param string $to Recipient email address
 * @param string $subject Email subject
 * @param string $message Email content (HTML format)
 * @param array $attachments Optional array of file paths to attach
 * @return bool True if email was sent successfully, false otherwise
 */
function sendEmail($to, $subject, $message, $attachments = []) {
    // Enhanced logging
    error_log("[Email] Attempting to send to: $to, Subject: $subject");
    
    // Check if we're in a development environment
    // TEMPORARY: For testing, send emails even in local environment
$isLocalhost = false;  // Uncomment this line to force email sending in localhost
    
    // TEMPORARY: For testing, send emails even in local environment
    // $isLocalhost = false;
    
    if ($isLocalhost) {
        // For local development, log instead of sending
        error_log("[DEV EMAIL] To: $to\nSubject: $subject\nMessage: " . substr($message, 0, 100) . "...");
        return true;
    }
    
    // For production, use PHPMailer
    try {
        // Create a new PHPMailer instance
        $mail = new PHPMailer(true); // true enables exceptions
      
        // DEBUGGING: Enable verbose debug output
        $mail->SMTPDebug = SMTP::DEBUG_SERVER;
        $mail->Debugoutput = function($str, $level) {
            error_log("PHPMailer [$level] : $str");
        };
        
        // Server settings
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USERNAME;
        $mail->Password   = SMTP_PASSWORD;
        $mail->SMTPSecure = SMTP_ENCRYPTION === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        
        // DEBUGGING: Additional Gmail-specific options
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );
        
        // Recipients
        $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        $mail->addAddress($to);
        $mail->addReplyTo(SMTP_REPLY_TO, SMTP_FROM_NAME . ' Support');
        
        // Content
        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = $subject;
        $mail->Body    = $message;
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $message));
        
        // Add attachments if any
        if (!empty($attachments) && is_array($attachments)) {
            foreach ($attachments as $attachment) {
                if (file_exists($attachment)) {
                    $mail->addAttachment($attachment);
                }
            }
        }
        
        // Send email
        $result = $mail->send();
        error_log("[Email] " . ($result ? "Success" : "Failed") . " sending to: $to");
        return $result;
        
    } catch (Exception $e) {
        error_log("[Email Error] " . $e->getMessage());
        // Log the complete error message from PHPMailer
        error_log("[Email Error Details] " . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Send registration approval email to user
 *
 * @param string $email User's email address
 * @param string $name User's name
 * @param string $role User's role
 * @return bool True if email was sent successfully, false otherwise
 */
function sendApprovalEmail($email, $name, $role) {
    // Translate role to French with proper descriptions
    $roleFr = [
        'administrateur' => 'Chef de Département',
        'professeur' => 'Professeur',
        'admin' => 'Administrateur'
    ][$role] ?? $role;
    
    $subject = "ExamEye - Votre inscription a été approuvée";
    
    // Customize message based on role
    $roleSpecificMsg = "";
    switch($role) {
        case 'administrateur':
            $roleSpecificMsg = "En tant que Chef de Département, vous avez accès à la gestion des matières et des professeurs de votre département.";
            break;
        case 'professeur':
            $roleSpecificMsg = "En tant que Professeur, vous pouvez gérer vos examens et surveiller les résultats des étudiants dans vos matières.";
            break;
        case 'admin':
            $roleSpecificMsg = "En tant qu'Administrateur, vous avez accès à toutes les fonctionnalités y compris la gestion des utilisateurs.";
            break;
    }
    
    $message = "
    <html>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
        <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <img src='" . LOGO_URL . "' alt='ExamEye Logo' style='max-width: 150px; height: auto; display: block; margin: 0 auto; border: none; object-fit: contain;'>
            </div>
            
            <h2 style='color: #2c3e50; text-align: center;'>Bienvenue sur ExamEye !</h2>
            
            <p>Bonjour $name,</p>
            
            <p>Nous avons le plaisir de vous informer que votre demande d'inscription a été <strong style='color: #27ae60;'>approuvée</strong>.</p>
            
            <p>Vous pouvez maintenant vous connecter à votre compte ExamEye avec le rôle de <strong>$roleFr</strong> en utilisant l'email et le mot de passe que vous avez fournis lors de votre inscription.</p>
            
            <p>$roleSpecificMsg</p>
            
            
            
            <p>Cordialement,<br>L'équipe ExamEye</p>
        </div>
    </body>
    </html>
    ";
    
    error_log("[Email Function] Sending approval email to: $email, Name: $name, Role: $role");
    return sendEmail($email, $subject, $message);
}

/**
 * Send registration rejection email to user
 *
 * @param string $email User's email address
 * @param string $name User's name
 * @param string $reason Optional reason for rejection
 * @return bool True if email was sent successfully, false otherwise
 */
function sendRejectionEmail($email, $name, $reason = '') {
    $subject = "ExamEye - Votre demande d'inscription";
    
    // Sanitize and escape the reason to prevent potential XSS
    $escapedReason = htmlspecialchars($reason, ENT_QUOTES, 'UTF-8');
    
    $reasonHtml = !empty($escapedReason) ? 
        "<p>Motif: <em>\"" . $escapedReason . "\"</em></p>" : 
        "<p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administrateur.</p>";
    
    $message = "
    <html>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
        <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <img src='" . LOGO_URL . "' alt='ExamEye Logo' style='max-width: 150px; height: auto; display: block; margin: 0 auto; border: none; object-fit: contain;'>
            </div>
            
            <h2 style='color: #2c3e50; text-align: center;'>Demande d'inscription</h2>
            
            <p>Bonjour " . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . ",</p>
            
            <p>Nous vous informons que votre demande d'inscription à ExamEye n'a pas été approuvée.</p>
            
            " . $reasonHtml . "
            
            <p>Cordialement,<br>L'équipe ExamEye</p>
        </div>
    </body>
    </html>
    ";
    
    error_log("[Email Function] Sending rejection email to: $email, Name: $name");
    return sendEmail($email, $subject, $message);
}
?>