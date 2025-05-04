<?php
session_start();
header('Content-Type: application/json');

include 'config.php';

if (!isset($_SESSION['idUtilisateur'])) {
    echo json_encode(["error" => "Not logged in"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));
$notificationId = $data->id ?? null;

if (!$notificationId) {
    echo json_encode(["error" => "No notification ID provided"]);
    exit;
}

try {
    $stmt = $conn->prepare("DELETE FROM notification WHERE idNotification = ?");
    $stmt->execute([$notificationId]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["error" => "Notification not found"]);
    }
} catch (PDOException $e) {
    echo json_encode(["error" => "Query failed: " . $e->getMessage()]);
}
?>
