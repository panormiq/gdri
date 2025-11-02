<?php
/**
 * Test direct de connexion MongoDB
 */

require_once __DIR__ . '/../vendor/autoload.php';

echo "<h2>Test de connexion MongoDB</h2>";

// Test 1 : Sans authentification
echo "<h3>Test 1 : Sans authentification</h3>";
try {
    $client1 = new MongoDB\Client("mongodb://localhost:27017/");
    $result1 = $client1->admin->command(['ping' => 1]);
    echo "✅ Connexion sans auth OK<br>";
} catch (Exception $e) {
    echo "❌ Erreur sans auth : " . $e->getMessage() . "<br>";
}

// Test 2 : Avec authentification (authSource=admin)
echo "<h3>Test 2 : Avec auth (authSource=admin)</h3>";
try {
    $client2 = new MongoDB\Client("mongodb://gdri_admin:gdri2024@localhost:27017/?authSource=admin");
    $result2 = $client2->admin->command(['ping' => 1]);
    echo "✅ Connexion avec authSource=admin OK<br>";
} catch (Exception $e) {
    echo "❌ Erreur authSource=admin : " . $e->getMessage() . "<br>";
}

// Test 3 : Avec authentification (authSource=GDR-INNOVATION)
echo "<h3>Test 3 : Avec auth (authSource=GDR-INNOVATION)</h3>";
try {
    $client3 = new MongoDB\Client("mongodb://gdri_admin:gdri2024@localhost:27017/?authSource=GDR-INNOVATION");
    $result3 = $client3->admin->command(['ping' => 1]);
    echo "✅ Connexion avec authSource=GDR-INNOVATION OK<br>";
    
    // Lister les bases
    $databases = $client3->listDatabases();
    echo "<br><strong>Bases de données disponibles :</strong><br>";
    foreach ($databases as $db) {
        echo "- " . $db['name'] . "<br>";
    }
} catch (Exception $e) {
    echo "❌ Erreur authSource=GDR-INNOVATION : " . $e->getMessage() . "<br>";
}

// Test 4 : Avec authentification (base GDR-INNOVATION directement)
echo "<h3>Test 4 : Connexion à la base GDR-INNOVATION</h3>";
try {
    $client4 = new MongoDB\Client("mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION");
    $db = $client4->selectDatabase('GDR-INNOVATION');
    $result4 = $db->command(['ping' => 1]);
    echo "✅ Connexion à GDR-INNOVATION OK<br>";
    
    // Lister les collections
    $collections = $db->listCollections();
    echo "<br><strong>Collections dans GDR-INNOVATION :</strong><br>";
    foreach ($collections as $col) {
        echo "- " . $col->getName() . "<br>";
    }
} catch (Exception $e) {
    echo "❌ Erreur connexion GDR-INNOVATION : " . $e->getMessage() . "<br>";
}
?>



