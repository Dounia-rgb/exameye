<?php
// Connexion à la base de données
require_once('config.php');

// Autoriser les requêtes CORS
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');

try {
    // Utiliser la connexion déjà établie dans config.php
    if (!isset($conn) || !($conn instanceof PDO)) {
        // Si la variable n'existe pas, on utilise les variables de config.php
        $conn = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }
    
    // Récupération des professeurs depuis la base de données
    $sql = "SELECT u.idUtilisateur, u.nom
            FROM utilisateur u 
            JOIN professeur p ON u.idUtilisateur = p.idUtilisateur 
            WHERE u.role = 'professeur'";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    // Récupération des résultats sous forme de tableau associatif
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // CORRECTION IMPORTANTE: Toujours forcer un tableau même si un seul résultat
    // Utiliser un tableau vide si aucun résultat n'est trouvé
    if (!is_array($result)) {
        $result = [$result]; // Transformer en tableau s'il ne l'est pas déjà
    }
    
    // Log pour le débogage
    error_log("Nombre de professeurs trouvés: " . count($result));
    error_log("Type de données: " . gettype($result));
    
    // Envoi de la réponse en JSON avec le paramètre JSON_FORCE_OBJECT désactivé
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    
} catch(PDOException $e) {
    // En cas d'erreur, renvoyer un message d'erreur en JSON
    error_log("Erreur dans professeurs.php: " . $e->getMessage());
    echo json_encode(['error' => "Erreur: " . $e->getMessage()]);
}
?>