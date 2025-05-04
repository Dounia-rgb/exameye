<?php
// Récupérer l'ID du PV depuis l'URL
$pvId = $_GET['id'] ?? null;

if (!$pvId) {
    die("ID du PV non spécifié");
}

// Connexion à la base de données
require_once 'config.php';

try {
    // Récupération des données du PV
    $stmt = $conn->prepare("
        SELECT s.*, u.nom AS nomProfesseur, sa.localisation
        FROM surveillance s
        LEFT JOIN utilisateur u ON s.idProfesseur = u.idUtilisateur
        LEFT JOIN salle sa ON s.idSalle = sa.idSalle
        WHERE s.idSurveillance = ?
    ");
    $stmt->execute([$pvId]);
    $pvData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pvData) {
        die("PV non trouvé");
    }

    // Récupération des surveillants (depuis le champ emargement de la table surveillance)
    $surveillants = [];
    if (!empty($pvData['emargement'])) {
        $emargements = json_decode($pvData['emargement'], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($emargements)) {
            foreach ($emargements as $emargement) {
                if (!empty($emargement['nom'])) {
                    $surveillants[] = ['nom' => $emargement['nom']];
                }
            }
        } else {
            // Fallback si le JSON est invalide - traitement comme texte simple
            $names = explode(',', $pvData['emargement']);
            foreach ($names as $name) {
                $surveillants[] = ['nom' => trim($name)];
            }
        }
    }

} catch (PDOException $e) {
    die("Erreur de base de données: " . $e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>PV de Surveillance - USTO</title>
    <style media="print">
        @page {
            size: A4;
            margin: 15mm;
        }
        body {
            font-size: 12pt;
        }
        button {
            display: none !important;
        }
    </style>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #fff;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        .logo {
            height: 80px;
            margin-bottom: 10px;
        }
        .university-name {
            font-weight: bold;
            font-size: 14px;
        }
        .faculty-dept {
            font-size: 12px;
        }
        .pv-title {
            text-align: center;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            text-decoration: underline;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        table, th, td {
            border: 1px solid black;
        }
        th, td {
            padding: 8px;
            text-align: left;
        }
        .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        .signature-line {
            border-top: 1px solid black;
            width: 200px;
            margin-top: 50px;
        }
        .footer {
            font-size: 10px;
            margin-top: 30px;
            text-align: justify;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="../src/img/usto.jpg" alt="Logo USTO" class="logo">
        <div class="university-name">Université des sciences et de la technologie d'Oran - Mohamed Boudiaf</div>
        <div class="faculty-dept">Faculté des Mathématiques et Informatique<br>Département d'Informatique</div>
    </div>

    <div class="pv-title">PROCÈS-VERBAL DE SURVEILLANCE</div>

    <table>
        <tr>
            <th>Matière</th>
            <td><?= htmlspecialchars($pvData['matiere'] ?? 'Non spécifié') ?></td>
        </tr>
        <tr>
            <th>Semestre</th>
            <td><?= htmlspecialchars($pvData['semestre'] ?? 'Non spécifié') ?></td>
            <th>Année</th>
            <td><?= htmlspecialchars($pvData['anneeUniversitaire'] ?? 'Non spécifié') ?></td>
            <th>Cycle</th>
            <td><?= htmlspecialchars($pvData['cycle'] ?? 'Non spécifié') ?></td>
        </tr>
        <tr>
            <th>Date</th>
            <td><?= isset($pvData['date']) ? date('d/m/Y', strtotime($pvData['date'])) : 'Non spécifié' ?></td>
            <th>Heure</th>
            <td>
                <?= htmlspecialchars($pvData['heureDebut'] ?? '') ?> - 
                <?= htmlspecialchars($pvData['heureFin'] ?? '') ?>
            </td>
            <th>Salle</th>
            <td><?= htmlspecialchars($pvData['localisation'] ?? 'Non spécifié') ?></td>
        </tr>
    </table>

    <table>
        <tr>
            <th>Nom et Prénom des Surveillants</th>
            <th>Emargement</th>
            <th>Statut (Réservé à l'administration)</th>
        </tr>
        <?php if (!empty($surveillants)): ?>
            <?php foreach ($surveillants as $surveillant): ?>
            <tr>
                <td><?= htmlspecialchars($surveillant['nom'] ?? '') ?></td>
                <td></td>
                <td></td>
            </tr>
            <?php endforeach; ?>
        <?php else: ?>
            <tr>
                <td colspan="3">Aucun surveillant enregistré</td>
            </tr>
        <?php endif; ?>
    </table>

    <div>
        <p><strong>Nombre d'étudiants présents :</strong> <?= htmlspecialchars($pvData['nombreEtudiantsPresents'] ?? 'Non spécifié') ?></p>
        <p><strong>Nombre de copies rendues :</strong> <?= htmlspecialchars($pvData['nombreCopiesRendues'] ?? 'Non spécifié') ?></p>
        <p><strong>Étudiants sans carte d'identité :</strong> <?= htmlspecialchars($pvData['nombreEtudiantsSansCI'] ?? '0') ?></p>
        <p><strong>Incidents signalés :</strong> <?= !empty($pvData['incidents']) ? 'Oui' : 'Non' ?></p>
        <?php if (!empty($pvData['incidents'])): ?>
            <p><strong>Détails des incidents :</strong> <?= htmlspecialchars($pvData['incidents']) ?></p>
        <?php endif; ?>
    </div>

    <div class="signature-section">
        <div>
            <p>Le chef de salle</p>
            <div class="signature-line"></div>
        </div>
        <div>
            <p>Le chef de département</p>
            <div class="signature-line"></div>
        </div>
    </div>

    <div class="footer">
        <p>La copie d'examen doit être conforme au règlement intérieur. L'enseignant responsable de la matière doit remettre ce PV accompagné de la liste des étudiants présents au département dans les délais requis.</p>
    </div>

    <script>
        // Auto-print if URL has ?print=1
        if (new URLSearchParams(window.location.search).has('print')) {
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 500);
            };
        }

        // Add print button dynamically
        document.addEventListener('DOMContentLoaded', function() {
            const printBtn = document.createElement('button');
            printBtn.textContent = 'Imprimer le PV';
            printBtn.style.position = 'fixed';
            printBtn.style.bottom = '20px';
            printBtn.style.right = '20px';
            printBtn.style.padding = '10px';
            printBtn.style.backgroundColor = '#4CAF50';
            printBtn.style.color = 'white';
            printBtn.style.border = 'none';
            printBtn.style.borderRadius = '4px';
            printBtn.style.cursor = 'pointer';
            
            printBtn.addEventListener('click', function() {
                window.print();
            });
            
            document.body.appendChild(printBtn);
        });
    </script>
</body>
</html>