<?php
/**
 * Test de connexion MongoDB et vérification de l'environnement
 * Fichier : install/test-connection.php
 */

?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test de connexion - GDRI</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #606163;
            border-bottom: 3px solid #9edbeb;
            padding-bottom: 10px;
        }
        h2 {
            color: #606163;
            margin-top: 30px;
        }
        .test-item {
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
            border-left: 4px solid #ccc;
        }
        .success {
            background-color: #d4edda;
            border-left-color: #28a745;
        }
        .error {
            background-color: #f8d7da;
            border-left-color: #dc3545;
        }
        .warning {
            background-color: #fff3cd;
            border-left-color: #ffc107;
        }
        .info {
            background-color: #d1ecf1;
            border-left-color: #17a2b8;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        .icon {
            font-size: 20px;
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Test de l'environnement GDRI</h1>
        
        <h2>1. Version PHP</h2>
        <?php
        $phpVersion = phpversion();
        if (version_compare($phpVersion, '8.0.0', '>=')) {
            echo '<div class="test-item success">';
            echo '<span class="icon">✅</span>';
            echo '<strong>PHP Version :</strong> ' . $phpVersion . ' (OK)';
            echo '</div>';
        } else {
            echo '<div class="test-item error">';
            echo '<span class="icon">❌</span>';
            echo '<strong>PHP Version :</strong> ' . $phpVersion . ' (Requis : 8.0+)';
            echo '</div>';
        }
        ?>
        
        <h2>2. Extensions PHP</h2>
        <?php
        $requiredExtensions = [
            'mongodb' => 'Extension MongoDB pour PHP',
            'json' => 'Extension JSON',
            'mbstring' => 'Extension mbstring',
            'curl' => 'Extension cURL'
        ];
        
        foreach ($requiredExtensions as $ext => $description) {
            if (extension_loaded($ext)) {
                echo '<div class="test-item success">';
                echo '<span class="icon">✅</span>';
                echo '<strong>' . $description . ' :</strong> Installée';
                echo '</div>';
            } else {
                echo '<div class="test-item error">';
                echo '<span class="icon">❌</span>';
                echo '<strong>' . $description . ' :</strong> NON installée';
                echo '</div>';
            }
        }
        ?>
        
        <h2>3. Composer</h2>
        <?php
        $composerInstalled = file_exists(__DIR__ . '/../vendor/autoload.php');
        if ($composerInstalled) {
            echo '<div class="test-item success">';
            echo '<span class="icon">✅</span>';
            echo '<strong>Composer :</strong> Dépendances installées';
            echo '</div>';
        } else {
            echo '<div class="test-item error">';
            echo '<span class="icon">❌</span>';
            echo '<strong>Composer :</strong> Dépendances NON installées. Lancez <code>composer install</code>';
            echo '</div>';
        }
        ?>
        
        <h2>4. Connexion MongoDB</h2>
        <?php
        if ($composerInstalled) {
            require_once __DIR__ . '/../vendor/autoload.php';
            require_once __DIR__ . '/../config/database.php';
            
            try {
                if (testDatabaseConnection()) {
                    echo '<div class="test-item success">';
                    echo '<span class="icon">✅</span>';
                    echo '<strong>MongoDB :</strong> Connexion réussie';
                    echo '</div>';
                    
                    // Vérifier si la base est initialisée
                    $db = getDatabase();
                    $collections = iterator_to_array($db->listCollections());
                    
                    if (count($collections) > 0) {
                        echo '<div class="test-item info">';
                        echo '<span class="icon">ℹ️</span>';
                        echo '<strong>Collections trouvées :</strong> ' . count($collections);
                        echo '<ul>';
                        foreach ($collections as $collection) {
                            echo '<li>' . $collection->getName() . '</li>';
                        }
                        echo '</ul>';
                        echo '</div>';
                    } else {
                        echo '<div class="test-item warning">';
                        echo '<span class="icon">⚠️</span>';
                        echo '<strong>Base de données vide :</strong> Lancez <a href="init-db.php">init-db.php</a> pour initialiser';
                        echo '</div>';
                    }
                } else {
                    throw new Exception('Test de connexion échoué');
                }
            } catch (Exception $e) {
                echo '<div class="test-item error">';
                echo '<span class="icon">❌</span>';
                echo '<strong>MongoDB :</strong> Erreur de connexion - ' . $e->getMessage();
                echo '<br><small>Vérifiez que MongoDB est démarré</small>';
                echo '</div>';
            }
        } else {
            echo '<div class="test-item warning">';
            echo '<span class="icon">⚠️</span>';
            echo '<strong>MongoDB :</strong> Impossible de tester (Composer non installé)';
            echo '</div>';
        }
        ?>
        
        <h2>5. Fichiers et dossiers</h2>
        <?php
        $requiredPaths = [
            '../assets/images/' => 'Dossier des images',
            '../assets/css/' => 'Dossier CSS',
            '../assets/js/' => 'Dossier JavaScript',
            '../config/config.php' => 'Configuration générale',
            '../config/database.php' => 'Configuration MongoDB'
        ];
        
        foreach ($requiredPaths as $path => $description) {
            $fullPath = __DIR__ . '/' . $path;
            if (file_exists($fullPath)) {
                echo '<div class="test-item success">';
                echo '<span class="icon">✅</span>';
                echo '<strong>' . $description . ' :</strong> Présent';
                echo '</div>';
            } else {
                echo '<div class="test-item error">';
                echo '<span class="icon">❌</span>';
                echo '<strong>' . $description . ' :</strong> MANQUANT';
                echo '</div>';
            }
        }
        
        // Vérifier le logo
        $logoPath = __DIR__ . '/../assets/images/logo-gdri.png';
        if (file_exists($logoPath)) {
            echo '<div class="test-item success">';
            echo '<span class="icon">✅</span>';
            echo '<strong>Logo GDRI :</strong> Présent (' . round(filesize($logoPath) / 1024, 2) . ' KB)';
            echo '</div>';
        } else {
            echo '<div class="test-item warning">';
            echo '<span class="icon">⚠️</span>';
            echo '<strong>Logo GDRI :</strong> NON trouvé. Copiez logo-gdri.png dans assets/images/';
            echo '</div>';
        }
        ?>
        
        <h2>📋 Résumé</h2>
        <?php
        $allOk = version_compare($phpVersion, '8.0.0', '>=') 
                 && extension_loaded('mongodb') 
                 && $composerInstalled;
        
        if ($allOk) {
            echo '<div class="test-item success">';
            echo '<span class="icon">🎉</span>';
            echo '<strong>Environnement prêt !</strong> Vous pouvez maintenant initialiser la base de données et utiliser le site.';
            echo '<br><br>';
            echo '<a href="init-db.php" style="background: #9edbeb; color: #606163; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 10px;">Initialiser la base de données</a>';
            echo '</div>';
        } else {
            echo '<div class="test-item error">';
            echo '<span class="icon">⚠️</span>';
            echo '<strong>Action requise :</strong> Corrigez les erreurs ci-dessus avant de continuer.';
            echo '<br><br>Consultez <code>INSTALLATION.md</code> pour plus de détails.';
            echo '</div>';
        }
        ?>
        
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 4px;">
            <strong>Prochaines étapes :</strong>
            <ol>
                <li>Si tout est ✅, cliquez sur "Initialiser la base de données"</li>
                <li>Notez les identifiants de l'admin GDRI</li>
                <li>Accédez au site : <a href="../index.php">http://localhost/gdri-dev/</a></li>
                <li>Connectez-vous avec les identifiants</li>
            </ol>
        </div>
    </div>
</body>
</html>




