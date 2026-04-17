<?php
/**
 * Debug runtime env PHP (temporaire)
 * Affiche uniquement la presence/longueur de CREDENTIALS_ENCRYPTION_KEY.
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    http_response_code(403);
    echo 'Access denied';
    exit;
}

$fromGetenv = getenv('CREDENTIALS_ENCRYPTION_KEY');
$fromEnv = $_ENV['CREDENTIALS_ENCRYPTION_KEY'] ?? null;
$fallback = 'CHANGER_EN_PRODUCTION_32_CHARS';
$effective = $fromGetenv !== false ? $fromGetenv : $fallback;
$envPath = realpath(__DIR__ . '/../../../backend/.env');
$envReadable = $envPath && is_readable($envPath);
$envFileKeyLength = 0;
if ($envReadable) {
    $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line === '' || strpos($line, '#') === 0) {
                continue;
            }
            if (strpos($line, 'CREDENTIALS_ENCRYPTION_KEY=') === 0) {
                $value = trim(substr($line, strlen('CREDENTIALS_ENCRYPTION_KEY=')));
                if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                    (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                    $value = substr($value, 1, -1);
                }
                $envFileKeyLength = strlen((string) $value);
                break;
            }
        }
    }
}

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'php_sapi' => PHP_SAPI,
    'config_file' => realpath(__DIR__ . '/../../config/config.php'),
    'config_mtime' => @filemtime(__DIR__ . '/../../config/config.php'),
    'backend_env_path' => $envPath ?: null,
    'backend_env_readable' => (bool) $envReadable,
    'backend_env_key_length' => $envFileKeyLength,
    'has_getenv_value' => $fromGetenv !== false && $fromGetenv !== '',
    'getenv_length' => $fromGetenv !== false ? strlen((string) $fromGetenv) : 0,
    'has__ENV_value' => !empty($fromEnv),
    '_ENV_length' => !empty($fromEnv) ? strlen((string) $fromEnv) : 0,
    'using_fallback' => $effective === $fallback,
    'effective_length' => strlen((string) $effective),
    'hint' => 'No secret value is returned here.'
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
