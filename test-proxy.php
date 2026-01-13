<?php
/**
 * Test de connexion au backend via proxy
 * Accéder à : https://www.gdri.fr/test-proxy.php
 */

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Test Proxy Backend</title>
    <style>
        body { font-family: Arial; padding: 20px; }
        .success { color: green; }
        .error { color: red; }
        .info { color: blue; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>🔧 Test de connexion au backend</h1>
    
    <h2>1. Test de connexion directe (curl depuis PHP)</h2>
    <?php
    $ch = curl_init('http://127.0.0.1:5005/api/auth/me');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $errno = curl_errno($ch);
    curl_close($ch);
    
    if ($errno) {
        echo '<p class="error">❌ Erreur de connexion : ' . htmlspecialchars($error) . ' (Code: ' . $errno . ')</p>';
    } else {
        echo '<p class="success">✅ Connexion réussie !</p>';
        echo '<p class="info">HTTP Code: ' . $httpCode . '</p>';
        echo '<p>Réponse :</p>';
        echo '<pre>' . htmlspecialchars($response) . '</pre>';
    }
    ?>
    
    <h2>2. Test via proxy Apache</h2>
    <?php
    // Tester si le proxy fonctionne
    $proxyUrl = '/api/auth/me';
    $ch = curl_init($proxyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    $response2 = curl_exec($ch);
    $httpCode2 = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error2 = curl_error($ch);
    curl_close($ch);
    
    if ($error2) {
        echo '<p class="error">❌ Erreur proxy : ' . htmlspecialchars($error2) . '</p>';
    } else {
        echo '<p class="success">✅ Proxy fonctionne !</p>';
        echo '<p class="info">HTTP Code: ' . $httpCode2 . '</p>';
        echo '<p>Réponse :</p>';
        echo '<pre>' . htmlspecialchars($response2) . '</pre>';
    }
    ?>
    
    <h2>3. Informations système</h2>
    <ul>
        <li>PHP Version: <?php echo phpversion(); ?></li>
        <li>cURL disponible: <?php echo function_exists('curl_init') ? '✅ Oui' : '❌ Non'; ?></li>
        <li>Backend URL: http://127.0.0.1:5005/api/auth/me</li>
        <li>Proxy URL: /api/auth/me</li>
        <li>DocumentRoot: <?php echo $_SERVER['DOCUMENT_ROOT'] ?? 'Non défini'; ?></li>
        <li>Script filename: <?php echo $_SERVER['SCRIPT_FILENAME'] ?? 'Non défini'; ?></li>
    </ul>
    
    <h2>4. Test avec file_get_contents</h2>
    <?php
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,
            'ignore_errors' => true
        ]
    ]);
    
    $result = @file_get_contents('http://127.0.0.1:5005/api/auth/me', false, $context);
    if ($result === false) {
        echo '<p class="error">❌ file_get_contents a échoué</p>';
        $lastError = error_get_last();
        if ($lastError) {
            echo '<p>Erreur: ' . htmlspecialchars($lastError['message']) . '</p>';
        }
    } else {
        echo '<p class="success">✅ file_get_contents fonctionne</p>';
        echo '<pre>' . htmlspecialchars($result) . '</pre>';
    }
    ?>
</body>
</html>


