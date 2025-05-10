<?php
/**
 * ExamEye Email Functions
 * This file contains all email sending functions used in the application
 */

// Email configuration constants - adjust these for your environment
define('EMAIL_FROM', 'noreply@exameye.example.com');
define('EMAIL_FROM_NAME', 'ExamEye System');
define('EMAIL_REPLY_TO', 'support@exameye.example.com');

/**
 * Main function to send an email
 * 
 * @param string $to Recipient email address
 * @param string $subject Email subject
 * @param string $htmlContent HTML email content
 * @param string $textContent Optional plain text version
 * @return bool Success status
 */
function sendEmail($to, $subject, $htmlContent, $textContent = '') {
    // Generate plain text version if not provided
    if (empty($textContent)) {
        $textContent = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $htmlContent));
    }
    
    // Set headers
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=utf-8',
        'From: ' . EMAIL_FROM_NAME . ' <' . EMAIL_FROM . '>',
        'Reply-To: ' . EMAIL_REPLY_TO,
        'X-Mailer: PHP/' . phpversion()
    ];
    
    try {
        // Use PHP mail function to send the email
        $success = mail($to, $subject, $htmlContent, implode("\r\n", $headers));
        
        // Log email status
        $logMessage = date('Y-m-d H:i:s') . " - Email to: {$to}, Subject: {$subject}, Status: " . 
                    ($success ? 'Sent' : 'Failed');
        error_log($logMessage, 3, __DIR__ . '/email_log.txt');
        
        return $success;
    } catch (Exception $e) {
        error_log(date('Y-m-d H:i:s') . " - Email error: " . $e->getMessage(), 3, __DIR__ . '/email_log.txt');
        return false;
    }
}

/**
 * Send approval email to user
 */
function sendApprovalEmail($email, $name, $role) {
    $subject = "ExamEye - Votre compte a été approuvé";
    
    $roleText = '';
    switch ($role) {
        case 'professeur':
            $roleText = "Vous pouvez maintenant accéder à votre espace professeur et gérer vos examens.";
            break;
        case 'etudiant':
            $roleText = "Vous pouvez maintenant accéder à votre espace étudiant et consulter vos examens.";
            break;
        case 'admin':
            $roleText = "Vous pouvez maintenant accéder à votre espace administrateur et gérer la plateforme.";
            break;
        default:
            $roleText = "Vous pouvez maintenant vous connecter à votre compte.";
    }
    
    $message = "
    <html>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
        <h2>Compte approuvé</h2>
        <p>Bonjour {$name},</p>
        <p>Nous avons le plaisir de vous informer que votre compte sur la plateforme ExamEye a été approuvé !</p>
        <p>{$roleText}</p>
        <p>Pour vous connecter, rendez-vous sur <a href='https://exameye.example.com/login.php'>notre site</a> et utilisez l'adresse email avec laquelle vous vous êtes inscrit.</p>
        <p>Cordialement,<br>L'équipe ExamEye</p>
    </body>
    </html>";
    
    return sendEmail($email, $subject, $message);
}

/**
 * Send rejection email to user
 */
function sendRejectionEmail($email, $name, $reason = '') {
    $subject = "ExamEye - Statut de votre demande d'inscription";
    
    $reasonText = '';
    if (!empty($reason)) {
        $reasonText = "<p>Motif : " . htmlspecialchars($reason) . "</p>";
    }
    
    $message = "
    <html>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
        <h2>Demande d'inscription non approuvée</h2>
        <p>Bonjour {$name},</p>
        <p>Nous vous informons que votre demande d'inscription sur la plateforme ExamEye n'a pas pu être approuvée.</p>
        {$reasonText}
        <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez fournir des informations supplémentaires, 
        n'hésitez pas à contacter notre équipe de support.</p>
        <p>Cordialement,<br>L'équipe ExamEye</p>
    </body>
    </html>";
    
    return sendEmail($email, $subject, $message);
}
?>