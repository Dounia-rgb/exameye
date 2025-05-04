<?php
session_start();
header('Content-Type: application/json');

include 'config.php';

// Check if user is an administrator
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// Get JSON input
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['idPlanning'])) {
    echo json_encode(['success' => false, 'message' => 'Missing planning ID']);
    exit;
}

$idPlanning = $data['idPlanning'];

try {
    $stmt = $conn->prepare("DELETE FROM planningexamen WHERE idPlanning = ?");
    $stmt->execute([$idPlanning]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Planning not found or already deleted']);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
