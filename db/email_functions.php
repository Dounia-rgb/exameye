<?php
/**
 * ExamEye Email Functions
 * This file contains all the email-related functions used throughout the application
 */

// Set default character set and Content-Type header for emails
ini_set('default_charset', 'UTF-8');

/**
 * Send an email using PHP's mail function or a custom SMTP library
 *
 * @param string $to Recipient email address
 * @param string $subject Email subject
 * @param string $message Email content (HTML format)
 * @param array $attachments Optional array of file paths to attach
 * @return bool True if email was sent successfully, false otherwise
 */
function sendEmail($to, $subject, $message, $attachments = []) {
    // Base headers for all emails
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: ExamEye <support@exameye.com>',
        'Reply-To: support@exameye.com',
        'X-Mailer: PHP/' . phpversion()
    ];
    
    // Convert headers array to string
    $headers_str = implode("\r\n", $headers);
    
    try {
        // Log email attempt
        error_log("[Email] Sending to: $to, Subject: $subject");
        
        // Send the email
        $result = mail($to, $subject, $message, $headers_str);
        
        // Log result
        if ($result) {
            error_log("[Email] Successfully sent to: $to");
        } else {
            error_log("[Email] Failed to send to: $to");
        }
        
        return $result;
    } catch (Exception $e) {
        error_log("[Email Error] " . $e->getMessage());
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
    // Translate role to French
    $roleFr = [
        'administrateur' => 'Administrateur',
        'professeur' => 'Professeur',
        'surveillant' => 'Surveillant'
    ][$role] ?? $role;
    
    $subject = "ExamEye - Votre inscription a été approuvée";
    
    $message = "
    <html>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
        <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <img src='https://exameye.com/logo.png' alt='ExamEye Logo' style='max-width: 150px;'>
            </div>
            
            <h2 style='color: #2c3e50; text-align: center;'>Bienvenue sur ExamEye !</h2>
            
            <p>Bonjour $name,</p>
            
            <p>Nous avons le plaisir de vous informer que votre demande d'inscription a été <strong style='color: #27ae60;'>approuvée</strong>.</p>
            
            <p>Vous pouvez maintenant vous connecter à votre compte ExamEye avec le rôle de <strong>$roleFr</strong> en utilisant l'email et le mot de passe que vous avez fournis lors de votre inscription.</p>
            
            <div style='text-align: center; margin: 30px 0;'>
                <a href='https://exameye.com/login.html' style='background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;'>Se connecter</a>
            </div>
            
            <p>Si vous avez des questions ou besoin d'assistance, n'hésitez pas à contacter notre équipe de support à <a href='mailto:support@exameye.com'>support@exameye.com</a>.</p>
            
            <p>Cordialement,<br>L'équipe ExamEye</p>
        </div>
    </body>
    </html>
    ";
    
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
    
    $reasonHtml = !empty($reason) ? 
        "<p>Motif: <em>\"" . htmlspecialchars($reason) . "\"</em></p>" : 
        "<p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administrateur.</p>";
    
    $message = "
    <html>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
        <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;'>
            <div style='text-align: center; margin-bottom: 20px;'>
                <img src='https://exameye.com/logo.png' alt='ExamEye Logo' style='max-width: 150px;'>
            </div>
            
            <h2 style='color: #2c3e50; text-align: center;'>Demande d'inscription</h2>
            
            <p>Bonjour $name,</p>
            
            <p>Nous vous informons que votre demande d'inscription à ExamEye n'a pas été approuvée.</p>
            
            $reasonHtml
            
            <p>Pour toute question, vous pouvez contacter notre équipe à <a href='mailto:support@exameye.com'>support@exameye.com</a>.</p>
            
            <p>Cordialement,<br>L'équipe ExamEye</p>
        </div>
    </body>
    </html>
    ";
    
    return sendEmail($email, $subject, $message);
}
?>