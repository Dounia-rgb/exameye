<?php
require_once 'config.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

$message = $data['message'] ?? '';
$recipients = $data['recipients'] ?? [];
$type = $data['type'] ?? 'message';
$dateEnvoi = date('Y-m-d H:i:s');

if (empty($message) || empty($recipients)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Données manquantes']);
    exit;
}

try {
    $stmt = $conn->prepare("INSERT INTO notification (destinataire, message, dateEnvoi, type) VALUES (?, ?, ?, ?)");

    foreach ($recipients as $idProfesseur) {
        $stmt->execute([$idProfesseur, $message, $dateEnvoi, $type]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>