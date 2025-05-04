<?php
require_once 'config.php';
session_start();

// Check authentication and authorization
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['success' => false, 'message' => 'Accès non autorisé']);
    exit;
}

// Get filter parameters
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$semestre = isset($_GET['semestre']) ? trim($_GET['semestre']) : '';
$matiere = isset($_GET['matiere']) ? trim($_GET['matiere']) : '';
$status = isset($_GET['status']) ? trim($_GET['status']) : '';

try {
    // Build the SQL query (same as get_pv_data.php)
    $sql = "
        SELECT s.*, e.procesVerbal, 
               u.nom AS nomProfesseur, 
               sa.localisation
        FROM surveillance s
        LEFT JOIN examen e ON s.idExamen = e.idExamen
        LEFT JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
        LEFT JOIN salle sa ON s.idSalle = sa.idSalle
        WHERE 1=1
    ";
    
    $params = [];
    
    // Add search filter
    if (!empty($search)) {
        $sql .= " AND (s.matiere LIKE ? OR u.nom LIKE ? OR s.cycle LIKE ? OR sa.localisation LIKE ?)";
        $searchParam = "%" . $search . "%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }
    
    // Add semester filter
    if (!empty($semestre)) {
        $sql .= " AND s.semestre = ?";
        $params[] = $semestre;
    }
    
    // Add subject filter
    if (!empty($matiere)) {
        $sql .= " AND s.matiere = ?";
        $params[] = $matiere;
    }
    
    // Add status filter
    if (!empty($status)) {
        switch ($status) {
            case 'verified':
                $sql .= " AND s.status = 'verified'";
                break;
            case 'pending':
                $sql .= " AND (s.status = 'pending' OR s.status IS NULL)";
                break;
            case 'rejected':
                $sql .= " AND s.status = 'rejected'";
                break;
            case 'incidents':
                $sql .= " AND s.incidents IS NOT NULL AND s.incidents != ''";
                break;
        }
    }
    
    // Order by date and time
    $sql .= " ORDER BY s.date DESC, s.heureDebut ASC";
    
    // Prepare and execute the query
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $pvs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($pvs)) {
        header('HTTP/1.1 404 Not Found');
        echo json_encode(['success' => false, 'message' => 'Aucun PV trouvé avec ces critères']);
        exit;
    }
    
    // Set headers for CSV download
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=pvs_export_' . date('Y-m-d') . '.csv');
    
    // Create output stream
    $output = fopen('php://output', 'w');
    
    // Write CSV header
    fputcsv($output, [
        'ID',
        'Matière',
        'Date',
        'Heure Début',
        'Heure Fin',
        'Professeur',
        'Salle',
        'Localisation',
        'Étudiants Présents',
        'Copies Rendues',
        'Étudiants Sans CI',
        'Incidents',
        'Statut',
        'Cycle',
        'Semestre'
    ], ';');
    
    // Write data rows
    foreach ($pvs as $pv) {
        fputcsv($output, [
            $pv['idSurveillance'],
            $pv['matiere'],
            $pv['date'],
            $pv['heureDebut'],
            $pv['heureFin'],
            $pv['nomProfesseur'],
            $pv['nomSalle'] ?? '',
            $pv['localisation'],
            $pv['nombreEtudiantsPresents'] ?? 0,
            $pv['nombreCopiesRendues'] ?? 0,
            $pv['nombreEtudiantsSansCI'] ?? 0,
            $pv['incidents'] ?? '',
            $pv['status'] ?? 'pending',
            $pv['cycle'],
            $pv['semestre']
        ], ';');
    }
    
    fclose($output);
    
} catch (PDOException $e) {
    error_log('Database error in export_pvs.php: ' . $e->getMessage());
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode([
        'success' => false,
        'message' => 'Erreur de base de données lors de l\'exportation'
    ]);
}
?>