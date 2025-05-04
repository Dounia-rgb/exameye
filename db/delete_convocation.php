<?php
require 'config.php';

header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);

// Vérifie si l'identifiant de groupe est fourni
if (isset($data['convocationGroupId']) && !empty($data['convocationGroupId'])) {
    $groupId = $data['convocationGroupId'];

    try {
        $stmt = $conn->prepare("DELETE FROM surveillance WHERE convocationGroupId = :groupId");
        $stmt->bindParam(':groupId', $groupId, PDO::PARAM_STR);

        if ($stmt->execute()) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "error" => "Échec de l'exécution de la requête."]);
        }
    } catch (PDOException $e) {
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
} else {
    echo json_encode(["success" => false, "error" => "Paramètre convocationGroupId manquant."]);
}
?>
