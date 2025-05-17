<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['idUtilisateur'])) {
    http_response_code(401);
    echo json_encode(["error" => "Non autorisé"]);
    exit;
}

$idProfesseur = $_SESSION['idUtilisateur'];

// Ajouter un log pour déboguer les paramètres reçus
error_log("Requête reçue - groupId: " . (isset($_GET['groupId']) ? $_GET['groupId'] : 'non défini'));
error_log("idProfesseur: " . $idProfesseur);

// Check if a specific convocation group is requested
if (isset($_GET['groupId'])) {
    $groupId = $_GET['groupId'];
    
    // MODIFICATION: D'abord chercher avec l'ID professeur et le groupe
    $sql = "
    SELECT 
        s.date,
        s.heureDebut, 
        s.cycle, 
        s.matiere, 
        s.semestre, 
        s.idGroupe,
        s.convocationGroupId,
        u.nom AS nomProfesseur
    FROM surveillance s
    JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
    WHERE s.idProfesseur = ?
      AND s.convocationGroupId = ?
      AND DATE(s.date) >= CURDATE()
    ORDER BY s.date, s.heureDebut
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([$idProfesseur, $groupId]);
    $convocations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Si aucun résultat, chercher sans la contrainte de date
    if (empty($convocations)) {
        error_log("Aucune convocation trouvée avec date future, essai sans filtrage par date");
        $sql = "
        SELECT 
            s.date,
            s.heureDebut, 
            s.cycle, 
            s.matiere, 
            s.semestre, 
            s.idGroupe,
            s.convocationGroupId,
            u.nom AS nomProfesseur
        FROM surveillance s
        JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
        WHERE s.idProfesseur = ?
          AND s.convocationGroupId = ?
        ORDER BY s.date, s.heureDebut
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([$idProfesseur, $groupId]);
        $convocations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Si toujours aucun résultat, chercher seulement avec le convocationGroupId
    if (empty($convocations)) {
        error_log("Aucune convocation trouvée avec idProfesseur, essai avec juste le convocationGroupId");
        $sql = "
        SELECT 
            s.date,
            s.heureDebut, 
            s.cycle, 
            s.matiere, 
            s.semestre, 
            s.idGroupe,
            s.convocationGroupId,
            u.nom AS nomProfesseur
        FROM surveillance s
        JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
        WHERE s.convocationGroupId = ?
        ORDER BY s.date, s.heureDebut
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([$groupId]);
        $convocations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Journaliser le nombre de résultats trouvés
    error_log("Nombre de convocations trouvées: " . count($convocations));
} else {
    // Get all convocations
    $sql = "
    SELECT 
        s.date,
        s.heureDebut, 
        s.cycle, 
        s.matiere, 
        s.semestre, 
        s.idGroupe,
        s.convocationGroupId,
        u.nom AS nomProfesseur
    FROM surveillance s
    JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
    WHERE s.idProfesseur = ?
      AND DATE(s.date) >= CURDATE()
    ORDER BY s.convocationGroupId, s.date, s.heureDebut
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([$idProfesseur]);
    $convocations = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

echo json_encode($convocations);