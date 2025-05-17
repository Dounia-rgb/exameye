<?php
// Inclure le fichier de configuration pour la connexion à la base de données
require_once 'config.php';

// Déterminer l'action à effectuer
$action = isset($_POST['action']) ? $_POST['action'] : (isset($_GET['action']) ? $_GET['action'] : '');

// Traitement des actions
switch ($action) {
    case 'ajouter':
        ajouterMatiere($conn);
        break;
    case 'supprimer':
        supprimerMatiere($conn);
        break;
    case 'lister':
        listerMatieres($conn);
        break;
    default:
        // Si aucune action n'est spécifiée ou si c'est une requête POST sans action
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['matiere'])) {
            // Pour la rétrocompatibilité, considérer comme un ajout
            ajouterMatiere($conn);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Action non spécifiée ou non valide.'
            ]);
        }
}

// Fonction pour ajouter une matière
function ajouterMatiere($conn) {
    if (isset($_POST['matiere']) && !empty($_POST['matiere'])) {
        $matiere = trim($_POST['matiere']);
        
        try {
            // Vérifier d'abord si la matière existe déjà
            $checkStmt = $conn->prepare("SELECT COUNT(*) FROM matiere WHERE matiere = :matiere");
            $checkStmt->bindParam(':matiere', $matiere);
            $checkStmt->execute();
            
            if ($checkStmt->fetchColumn() > 0) {
                // La matière existe déjà
                echo json_encode([
                    'success' => false,
                    'message' => 'Cette matière existe déjà dans la base de données.'
                ]);
                return;
            }
            
            // Préparer et exécuter la requête d'insertion
            $stmt = $conn->prepare("INSERT INTO matiere (matiere) VALUES (:matiere)");
            $stmt->bindParam(':matiere', $matiere);
            $stmt->execute();
            
            // Vérifier si l'insertion a réussi
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Matière ajoutée avec succès.',
                    'id' => $conn->lastInsertId()
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Échec de l\'ajout de la matière.'
                ]);
            }
        } catch (PDOException $e) {
            // Gérer les erreurs de base de données
            echo json_encode([
                'success' => false,
                'message' => 'Erreur de base de données: ' . $e->getMessage()
            ]);
        }
    } else {
        // Le paramètre 'matiere' est manquant ou vide
        echo json_encode([
            'success' => false,
            'message' => 'Le nom de la matière est requis.'
        ]);
    }
}

// Fonction pour supprimer une matière
function supprimerMatiere($conn) {
    if (isset($_POST['idMatiere']) && !empty($_POST['idMatiere'])) {
        $idMatiere = intval($_POST['idMatiere']);
        
        try {
            // Début d'une transaction
            $conn->beginTransaction();
            
            // Vérifier si la matière est utilisée dans la table examen
            $checkExamen = $conn->prepare("SELECT COUNT(*) FROM examen WHERE idMatiere = :idMatiere");
            $checkExamen->bindParam(':idMatiere', $idMatiere);
            $checkExamen->execute();
            
            if ($checkExamen->fetchColumn() > 0) {
                $conn->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => 'Cette matière est utilisée dans des examens et ne peut pas être supprimée.'
                ]);
                return;
            }
            
            // Vérifier si la matière est utilisée dans la table surveillance
            $checkSurveillance = $conn->prepare("SELECT COUNT(*) FROM surveillance WHERE matiere = :idMatiere");
            $checkSurveillance->bindParam(':idMatiere', $idMatiere);
            $checkSurveillance->execute();
            
            if ($checkSurveillance->fetchColumn() > 0) {
                $conn->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => 'Cette matière est utilisée dans des surveillances et ne peut pas être supprimée.'
                ]);
                return;
            }
            
            // Vérifier si la matière est utilisée dans la table convocation
            $checkConvocation = $conn->prepare("SELECT COUNT(*) FROM convocation WHERE matiere = :idMatiere");
            $checkConvocation->bindParam(':idMatiere', $idMatiere);
            $checkConvocation->execute();
            
            if ($checkConvocation->fetchColumn() > 0) {
                $conn->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => 'Cette matière est utilisée dans des convocations et ne peut pas être supprimée.'
                ]);
                return;
            }
            
            // Vérification dans la table professeur - Adapter selon la structure réelle de votre base de données
            // Si matiereEnseignee contient des IDs séparés par des virgules, utilisez cette méthode:
            $checkProfesseur = $conn->prepare("SELECT COUNT(*) FROM professeur WHERE matiereEnseignee LIKE :pattern1 OR matiereEnseignee LIKE :pattern2 OR matiereEnseignee LIKE :pattern3 OR matiereEnseignee = :exact");
            $pattern1 = $idMatiere . ',%';  // au début
            $pattern2 = '%,' . $idMatiere . ',%';  // au milieu
            $pattern3 = '%,' . $idMatiere;  // à la fin
            $exact = (string)$idMatiere;  // exactement l'ID
            
            $checkProfesseur->bindParam(':pattern1', $pattern1);
            $checkProfesseur->bindParam(':pattern2', $pattern2);
            $checkProfesseur->bindParam(':pattern3', $pattern3);
            $checkProfesseur->bindParam(':exact', $exact);
            $checkProfesseur->execute();
            
            if ($checkProfesseur->fetchColumn() > 0) {
                $conn->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => 'Cette matière est enseignée par des professeurs et ne peut pas être supprimée.'
                ]);
                return;
            }
            
            // Supprimer la matière
            $stmt = $conn->prepare("DELETE FROM matiere WHERE idMatiere = :idMatiere");
            $stmt->bindParam(':idMatiere', $idMatiere);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                $conn->commit();
                echo json_encode([
                    'success' => true,
                    'message' => 'Matière supprimée avec succès.'
                ]);
            } else {
                $conn->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => 'Aucune matière trouvée avec cet ID.'
                ]);
            }
        } catch (PDOException $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            echo json_encode([
                'success' => false,
                'message' => 'Erreur de base de données: ' . $e->getMessage()
            ]);
        }
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'ID de matière manquant ou invalide.'
        ]);
    }
}

// Fonction pour lister toutes les matières
function listerMatieres($conn) {
    try {
        $stmt = $conn->query("SELECT idMatiere, matiere FROM matiere ORDER BY matiere ASC");
        $matieres = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'matieres' => $matieres
        ]);
    } catch (PDOException $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Erreur lors de la récupération des matières: ' . $e->getMessage()
        ]);
    }
}
?>