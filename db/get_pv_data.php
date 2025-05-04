<?php
// Database connection
require_once 'config.php';

// Start session for user info
session_start();

// Check if user is authenticated and is an admin
if (!isset($_SESSION['idUtilisateur']) || $_SESSION['role'] !== 'administrateur') {
    echo json_encode([
        'success' => false,
        'message' => 'Accès non autorisé'
    ]);
    exit;
}

try {
    // Get filter parameters
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $semestre = isset($_GET['semestre']) ? trim($_GET['semestre']) : '';
    $matiereFilter = isset($_GET['matiere']) ? trim($_GET['matiere']) : '';

    $status = isset($_GET['status']) ? trim($_GET['status']) : '';
    
    // Build the SQL query
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
    if (!empty($matiereFilter)) {
        $sql .= " AND matiere = :matiere";
        $params[':matiere'] = $matiereFilter;
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
    
    // Calculate statistics
    $stats = calculateStats($conn);
    
    // Return success with data
    echo json_encode([
        'success' => true,
        'pvs' => $pvs,
        'stats' => $stats
    ]);
    
} catch (PDOException $e) {
    // Return error
    echo json_encode([
        'success' => false,
        'message' => 'Erreur de base de données: ' . $e->getMessage()
    ]);
    
    // Log detailed error for administrators
    error_log('Database error in get_pvs.php: ' . $e->getMessage());
}

// Function to calculate PV statistics
function calculateStats($conn) {
    try {
        // Total number of PVs
        $totalQuery = $conn->query("SELECT COUNT(*) FROM surveillance");
        $total = $totalQuery->fetchColumn();
        
        // Verified PVs
        $verifiedQuery = $conn->query("SELECT COUNT(*) FROM surveillance WHERE status = 'verified'");
        $verified = $verifiedQuery->fetchColumn();
        
        // Pending PVs
        $pendingQuery = $conn->query("SELECT COUNT(*) FROM surveillance WHERE status = 'pending' OR status IS NULL");
        $pending = $pendingQuery->fetchColumn();
        
        // PVs with incidents
        $incidentsQuery = $conn->query("SELECT COUNT(*) FROM surveillance WHERE incidents IS NOT NULL AND incidents != ''");
        $incidents = $incidentsQuery->fetchColumn();
        
        return [
            'total' => $total,
            'verified' => $verified,
            'pending' => $pending,
            'incidents' => $incidents
        ];
    } catch (PDOException $e) {
        error_log('Error calculating stats: ' . $e->getMessage());
        return [
            'total' => 0,
            'verified' => 0,
            'pending' => 0, 
            'incidents' => 0
        ];
    }
}
?>