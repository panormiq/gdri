<?php
/**
 * Script d'initialisation de la base de données MongoDB - GDRI
 * Fichier : install/init-db.php
 * 
 * À exécuter UNE SEULE FOIS après l'installation
 * Crée les collections et insère les données de base
 */

// Empêcher l'exécution multiple
$lockFile = __DIR__ . '/db-initialized.lock';
if (file_exists($lockFile)) {
    die('<h1>Base de données déjà initialisée</h1><p>Supprimez le fichier install/db-initialized.lock pour réinitialiser.</p>');
}

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Initialisation de la base de données - GDRI</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
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
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .info {
            background-color: #d1ecf1;
            color: #0c5460;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        .credentials {
            background-color: #fff3cd;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Initialisation de la base de données GDRI</h1>
        
        <?php
        try {
            echo '<div class="info">📡 Connexion à MongoDB...</div>';
            
            // Tester la connexion
            if (!testDatabaseConnection()) {
                throw new Exception('Impossible de se connecter à MongoDB. Vérifiez que MongoDB est démarré.');
            }
            
            echo '<div class="success">✅ Connexion à MongoDB réussie</div>';
            
            $db = getDatabase();
            
            // Créer les collections
            echo '<div class="info">📦 Création des collections...</div>';
            
            // Collection users
            echo '<p>- Création de la collection <code>users</code>...</p>';
            $usersCollection = $db->selectCollection('users');
            
            // Collection entities
            echo '<p>- Création de la collection <code>entities</code>...</p>';
            $entitiesCollection = $db->selectCollection('entities');
            
            // Collection services
            echo '<p>- Création de la collection <code>services</code>...</p>';
            $servicesCollection = $db->selectCollection('services');
            
            echo '<div class="success">✅ Collections créées</div>';
            
            // Créer les index
            echo '<div class="info">🔍 Création des index...</div>';
            
            $usersCollection->createIndex(['email' => 1], ['unique' => true]);
            $entitiesCollection->createIndex(['siret' => 1], ['unique' => true]);
            
            echo '<div class="success">✅ Index créés</div>';
            
            // Insérer les services de base
            echo '<div class="info">🤖 Insertion des services (agents IA)...</div>';
            
            $services = [
                [
                    'name' => 'Agent Analyse d\'intention',
                    'description' => 'Caractérise un message/texte afin de pouvoir le classer ou faire différentes actions sur mesure',
                    'icon' => '🎯',
                    'status' => 'active',
                    'created_at' => new MongoDB\BSON\UTCDateTime()
                ],
                [
                    'name' => 'Agent Mail',
                    'description' => 'Transfère le mail au bon service et prépare une réponse selon l\'analyse d\'intention',
                    'icon' => '✉️',
                    'status' => 'active',
                    'created_at' => new MongoDB\BSON\UTCDateTime()
                ],
                [
                    'name' => 'Agent Documentaire Dossier technique',
                    'description' => 'Transforme un document Word en modèle technique pour simplifier les rédactions futures',
                    'icon' => '📄',
                    'status' => 'active',
                    'created_at' => new MongoDB\BSON\UTCDateTime()
                ],
                [
                    'name' => 'Agent Facebook',
                    'description' => 'Récupère et analyse les notifications Facebook pour envoyer des alertes mail si nécessaire',
                    'icon' => '📱',
                    'status' => 'active',
                    'created_at' => new MongoDB\BSON\UTCDateTime()
                ]
            ];
            
            $servicesCollection->insertMany($services);
            echo '<div class="success">✅ 4 services insérés</div>';
            
            // Créer l'admin GDRI par défaut
            echo '<div class="info">👤 Création de l\'administrateur GDRI...</div>';
            
            $adminEmail = 'abaratte@gdr-innovation.fr';
            $adminPassword = 'Gdri2024!'; // Mot de passe par défaut (à changer après première connexion)
            
            $usersCollection->insertOne([
                'email' => $adminEmail,
                'password_hash' => password_hash($adminPassword, PASSWORD_DEFAULT),
                'role' => 'ADMIN_GDRI',
                'entity_id' => null,
                'status' => 'active',
                'created_at' => new MongoDB\BSON\UTCDateTime(),
                'last_login' => null
            ]);
            
            echo '<div class="success">✅ Administrateur GDRI créé</div>';
            
            // Afficher les credentials
            echo '<div class="credentials">';
            echo '<h2>🔐 Identifiants de l\'administrateur GDRI</h2>';
            echo '<p><strong>Email :</strong> <code>' . htmlspecialchars($adminEmail) . '</code></p>';
            echo '<p><strong>Mot de passe :</strong> <code>' . htmlspecialchars($adminPassword) . '</code></p>';
            echo '<p style="color: #856404; margin-top: 15px;">⚠️ <strong>IMPORTANT :</strong> Notez bien ces identifiants ! Changez le mot de passe après votre première connexion.</p>';
            echo '</div>';
            
            // Créer le fichier lock
            file_put_contents($lockFile, date('Y-m-d H:i:s'));
            
            echo '<div class="success">';
            echo '<h2>🎉 Installation terminée avec succès !</h2>';
            echo '<p>Vous pouvez maintenant :</p>';
            echo '<ol>';
            echo '<li>Copier vos identifiants ci-dessus</li>';
            echo '<li><a href="../index.php">Accéder au site</a></li>';
            echo '<li>Vous connecter avec les identifiants de l\'admin GDRI</li>';
            echo '</ol>';
            echo '</div>';
            
        } catch (Exception $e) {
            echo '<div class="error">';
            echo '<h2>❌ Erreur lors de l\'initialisation</h2>';
            echo '<p>' . htmlspecialchars($e->getMessage()) . '</p>';
            echo '<h3>Solutions possibles :</h3>';
            echo '<ul>';
            echo '<li>Vérifiez que MongoDB est démarré</li>';
            echo '<li>Vérifiez que l\'extension MongoDB PHP est activée dans php.ini</li>';
            echo '<li>Vérifiez que Composer a bien installé les dépendances</li>';
            echo '<li>Consultez le fichier INSTALLATION.md pour plus de détails</li>';
            echo '</ul>';
            echo '</div>';
        }
        ?>
    </div>
</body>
</html>


