<?php
require 'config.php'; 
session_start(); // Démarrer la session

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nom = trim($_POST['name']);
    $email = trim($_POST['email']);
    $password = trim($_POST['password']); 
    $role = trim($_POST['role']); 

    $stmt = $conn->prepare("SELECT idUtilisateur FROM utilisateur WHERE email = ?");
    $stmt->execute([$email]);

    if ($stmt->rowCount() > 0) {
        echo "Email already exists!";
    } else {
        $stmt = $conn->prepare("INSERT INTO utilisateur (nom, email, motDePasse, role) VALUES (?, ?, ?, ?)");
        if ($stmt->execute([$nom, $email, $password, $role])) {

            // Récupérer l'ID du nouvel utilisateur
            $user_id = $conn->lastInsertId();

            // Stocker les infos dans la session immédiatement après l'inscription
            $_SESSION['user_id'] = $user_id;
            $_SESSION['nom'] = $nom;
            $_SESSION['email'] = $email;
            $_SESSION['role'] = $role;

            // Redirection après l'inscription
            if ($role === "professeur") {
                header("Location: ../dashboards/prof.html");
                exit();
            } if ($role === "administrateur") {
                header("Location: ../dashboards/administrateur.html");
                exit();
            }if ($role === "admin") {
                header("Location: ../dashboards/gestion.html");
                exit();}
             else {
                echo "Invalid role!";
            }
        } else {
            echo "Error during registration.";
        }
    }
}
?>
