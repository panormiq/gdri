<?php
/**
 * Helper JWT pour PHP
 * Fichier : includes/jwt-helper.php
 * 
 * Génère des tokens JWT pour authentification PHP → Node.js
 */

// Secret partagé (doit être identique en Node.js)
// En production, utiliser une constante ou variable d'environnement
define('JWT_SECRET', 'gdri-2024-secret-key-change-in-production');

/**
 * Génère un token JWT pour l'utilisateur connecté
 * @return string|null Token JWT ou null si utilisateur non connecté
 */
function generateJWT() {
    if (!isset($_SESSION['user_id'])) {
        return null;
    }

    // Vérifier si la librairie JWT est disponible (firebase/php-jwt)
    if (class_exists('\Firebase\JWT\JWT')) {
        return generateJWTWithLibrary();
    }

    // Fallback : génération manuelle JWT
    return generateJWTManual();
}

/**
 * Génère un JWT avec la librairie firebase/php-jwt
 * @return string Token JWT
 */
function generateJWTWithLibrary() {
    // ✅ Format multi-entreprises : utiliser currentEntrepriseId
    $currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? $_SESSION['entrepriseId'] ?? null;
    
    $payload = [
        'user_id' => $_SESSION['user_id'],
        'currentEntrepriseId' => $currentEntrepriseId, // Format doc-template
        'entrepriseId' => $currentEntrepriseId, // Gardé pour compatibilité
        'role' => $_SESSION['user_role'] ?? 'USER_ENTITY',
        'email' => $_SESSION['user_email'] ?? '',
        'iat' => time(),
        'exp' => time() + (60 * 60 * 24) // 24 heures
    ];

    return \Firebase\JWT\JWT::encode($payload, JWT_SECRET, 'HS256');
}

/**
 * Génère un JWT manuellement (sans librairie externe)
 * Format JWT standard : base64(header).base64(payload).base64(signature)
 * @return string Token JWT
 */
function generateJWTManual() {
    // ✅ Format multi-entreprises : utiliser currentEntrepriseId
    $currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? $_SESSION['entrepriseId'] ?? null;
    
    $payload = [
        'user_id' => $_SESSION['user_id'],
        'currentEntrepriseId' => $currentEntrepriseId, // Format doc-template
        'entrepriseId' => $currentEntrepriseId, // Gardé pour compatibilité
        'role' => $_SESSION['user_role'] ?? 'USER_ENTITY',
        'email' => $_SESSION['user_email'] ?? '',
        'iat' => time(),
        'exp' => time() + (60 * 60 * 24) // 24 heures
    ];

    // Header JWT
    $header = [
        'typ' => 'JWT',
        'alg' => 'HS256'
    ];

    // Encoder header et payload en base64url (sans padding, avec remplacement caractères)
    $header_encoded = base64url_encode(json_encode($header));
    $payload_encoded = base64url_encode(json_encode($payload));

    // Créer la signature HMAC SHA256
    $data = $header_encoded . '.' . $payload_encoded;
    $signature = hash_hmac('sha256', $data, JWT_SECRET, true);
    $signature_encoded = base64url_encode($signature);

    // JWT final
    return $header_encoded . '.' . $payload_encoded . '.' . $signature_encoded;
}

/**
 * Encode en base64url (format JWT)
 * @param string $data Données à encoder
 * @return string Données encodées
 */
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Récupère le token JWT pour les requêtes API
 * @return string|null Token ou null
 */
function getJWTToken() {
    return generateJWT();
}

