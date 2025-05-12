<?php
session_start();
ob_start(); // Prevent header issues

require 'config.php';
require_once 'email_functions.php'; // Include email functions

// Function to log activity
function logActivity($message) {
    error_log('[' . date('Y-m-d H:i:s') . '] ' . $message);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = trim($_POST['email']);
    $password = trim($_POST['password']);

    // Validate inputs
    if (empty($email) || empty($password)) {
        echo "<script>alert('Email and password are required.'); window.location.href = '../dashboards/login.html';</script>";
        exit();
    }

    // Prepare statement with email
    $stmt = $conn->prepare("SELECT * FROM utilisateur WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Log attempt for debugging purposes
    if ($user) {
        logActivity("Login attempt for user: " . $user['idUtilisateur'] . " with role: " . $user['role']);
    } else {
        logActivity("Failed login attempt for email: " . $email . " - User not found");
    }

    // Verify user exists and password matches
    if ($user && $password === $user['motDePasse']) { 
        // Check user account status
        if ($user['pending'] == 1) {
            echo "<script>alert('Your account is pending approval. You will receive an email when your account is approved.'); window.location.href = '../dashboards/login.html';</script>";
            exit();
        }
        
        // Check if user account is rejected
        if ($user['status'] == 'rejected') {
            echo "<script>alert('Your account registration has been rejected by the administrator.'); window.location.href = '../dashboards/login.html';</script>";
            exit();
        }
        
        // Check if user account is active
        if ($user['status'] != 'active') {
            echo "<script>alert('Your account is currently inactive. Please contact the administrator.'); window.location.href = '../dashboards/login.html';</script>";
            exit();
        }
        
        // Set session variables
        $_SESSION['idUtilisateur'] = $user['idUtilisateur'];
        $_SESSION['nom'] = $user['nom'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role'] = $user['role'];
        
        // Log successful login
        logActivity("Successful login for user: " . $user['idUtilisateur'] . " with role: " . $user['role']);
        
        // Redirect based on role
        if ($user['role'] === 'admin') {
            // Check for pending notifications
            $stmt = $conn->prepare("SELECT COUNT(*) as count FROM notification WHERE isRead = 0");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result['count'] > 0) {
                // Admin has pending notifications, redirect to notification page
                header("Location: ../dashboards/notificationgestion.html?idUtilisateur=" . $user['idUtilisateur']);
            } else {
                // No pending notifications, proceed to video page
                header("Location: ../dashboards/videopage.html?role=" . urlencode($user['role']) . "&idUtilisateur=" . $user['idUtilisateur']);
            }
        } else {
            // For regular users, redirect to video page
            header("Location: ../dashboards/videopage.html?role=" . urlencode($user['role']) . "&idUtilisateur=" . $user['idUtilisateur']);
        }
        exit();
    } else {
        // Log failed login
        logActivity("Failed login attempt: Incorrect credentials for email: " . $email);
        echo "<script>alert('Invalid email or password.'); window.location.href = '../dashboards/login.html';</script>";
    }
}
?>