<?php
/**
 * Endpoint de lecture des logs d'activité admin
 * Fichier : auth/admin-activity-logs.php
 */

require_once '../config/config.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';
require_once 'session.php';

header('Content-Type: application/json');

function jsonResponse($success, $message, $data = []) {
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, 'Méthode non autorisée');
}

if (!isLoggedIn()) {
    jsonResponse(false, 'Non authentifié');
}

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    jsonResponse(false, 'Accès interdit');
}

try {
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
    if ($limit < 1) {
        $limit = 1;
    } elseif ($limit > 200) {
        $limit = 200;
    }

    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    if ($page < 1) {
        $page = 1;
    }
    $skip = ($page - 1) * $limit;

    $apiBase = rtrim(getApiBaseUrl(), '/');
    $jwt = getJWTToken();
    if (!$apiBase || !$jwt) {
        jsonResponse(false, 'Contexte API indisponible');
    }
    $params = ['limit' => $limit, 'page' => $page];
    foreach (['event_type', 'user_email', 'from', 'to'] as $k) {
        $v = trim((string) ($_GET[$k] ?? ''));
        if ($v !== '') {
            $params[$k] = $v;
        }
    }
    $url = $apiBase . '/activity-logs/admin?' . http_build_query($params);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $jwt,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        jsonResponse(false, 'Erreur API logs admin');
    }
    $decoded = json_decode((string) $raw, true);
    if (empty($decoded['success'])) {
        jsonResponse(false, $decoded['message'] ?? 'Erreur API logs admin');
    }
    jsonResponse(true, 'Logs chargés', [
        'logs' => is_array($decoded['logs'] ?? null) ? $decoded['logs'] : [],
        'total' => (int) ($decoded['total'] ?? 0),
        'page' => (int) ($decoded['page'] ?? $page),
        'limit' => (int) ($decoded['limit'] ?? $limit)
    ]);
} catch (Exception $e) {
    error_log('Erreur logs admin activity : ' . $e->getMessage());
    jsonResponse(false, 'Erreur serveur');
}

