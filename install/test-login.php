<?php
/**
 * Test de connexion utilisateur - Debug
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

echo "<h2>Test de connexion utilisateur</h2>";

$testEmail = 'abaratte@gdr-innovation.fr';
$testPassword = 'Gdri2024!';

echo "<p><strong>Email testé :</strong> " . htmlspecialchars($testEmail) . "</p>";
echo "<p><strong>Mot de passe testé :</strong> " . htmlspecialchars($testPassword) . "</p>";

try {
    // Connexion à MongoDB
    echo "<p>✅ Connexion à MongoDB...</p>";
    $db = getDatabase();
    
    echo "<p>✅ Base de données sélectionnée : " . $db->getDatabaseName() . "</p>";
    
    $usersCollection = $db->users;
    
    // Rechercher l'utilisateur par email
    echo "<p>🔍 Recherche de l'utilisateur...</p>";
    $user = $usersCollection->findOne(['email' => $testEmail]);
    
    if (!$user) {
        echo "<p>❌ Utilisateur NON trouvé dans la base !</p>";
        echo "<p>Vérification des utilisateurs existants :</p>";
        $allUsers = $usersCollection->find();
        echo "<ul>";
        foreach ($allUsers as $u) {
            echo "<li>" . htmlspecialchars($u['email']) . " - Role: " . htmlspecialchars($u['role']) . "</li>";
        }
        echo "</ul>";
        exit;
    }
    
    echo "<p>✅ Utilisateur trouvé !</p>";
    echo "<p><strong>Email :</strong> " . htmlspecialchars($user['email']) . "</p>";
    echo "<p><strong>Rôle :</strong> " . htmlspecialchars($user['role']) . "</p>";
    echo "<p><strong>Statut :</strong> " . htmlspecialchars($user['status']) . "</p>";
    
    // Vérifier le statut
    if ($user['status'] !== 'active') {
        echo "<p>❌ Compte inactif !</p>";
        exit;
    }
    
    echo "<p>✅ Compte actif</p>";
    
    // Vérifier le mot de passe
    echo "<p>🔑 Vérification du mot de passe...</p>";
    echo "<p><strong>Hash stocké :</strong> " . substr($user['password_hash'], 0, 50) . "...</p>";
    
    if (password_verify($testPassword, $user['password_hash'])) {
        echo "<p>✅ <strong>Mot de passe CORRECT !</strong></p>";
        echo "<p style='color: green; font-size: 20px;'>🎉 La connexion devrait fonctionner !</p>";
    } else {
        echo "<p>❌ <strong>Mot de passe INCORRECT !</strong></p>";
        echo "<p>Le hash ne correspond pas.</p>";
        
        // Tester de créer un nouveau hash
        $newHash = password_hash($testPassword, PASSWORD_DEFAULT);
        echo "<p><strong>Nouveau hash généré pour test :</strong> " . substr($newHash, 0, 50) . "...</p>";
        
        if (password_verify($testPassword, $newHash)) {
            echo "<p>✅ Le nouveau hash fonctionne correctement</p>";
        }
    }
    
} catch (Exception $e) {
    echo "<p style='color: red;'>❌ <strong>ERREUR :</strong> " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}
?>



