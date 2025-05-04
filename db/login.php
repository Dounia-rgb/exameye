<?php
session_start();
ob_start(); // Prevent header issues

require 'config.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = trim($_POST['email']);
    $password = trim($_POST['password']);

    $stmt = $conn->prepare("SELECT * FROM utilisateur WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Add this right after $user = $stmt->fetch(PDO::FETCH_ASSOC);
if ($user) {
    error_log("User data: " . print_r($user, true));
    error_log("Role from DB: '" . $user['role'] . "'");
}
    if ($user && $password === $user['motDePasse']) { 
        // Utilisez les mêmes noms de variables que dans gestion.php
        $_SESSION['idUtilisateur'] = $user['idUtilisateur'];
        $_SESSION['role'] = $user['role'];
        error_log("Redirecting to: ../dashboards/videopage.html?role=" . urlencode($user['role']) . "&idUtilisateur=" . $user['idUtilisateur']);

        // Ajouter l'idUtilisateur pour la récupération après redirection
        header("Location: ../dashboards/videopage.html?role=" . urlencode($user['role']) . "&idUtilisateur=" . $user['idUtilisateur']);
        exit();
    } else {
        echo "<script>alert('Invalid email or password.'); window.location.href = '../dashboards/login.html';</script>";
    }
}
?>