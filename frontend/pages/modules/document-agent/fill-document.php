<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!isLoggedIn()) {
    redirect(url('auth/login-process.php'));
}

$returnRaw = trim((string) ($_GET['return'] ?? ''));
if ($returnRaw !== '') {
    $parts = parse_url($returnRaw);
    $host = isset($parts['host']) ? strtolower((string) $parts['host']) : '';
    $reqHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '' || $host === $reqHost) {
        redirect($returnRaw);
        exit;
    }
}

redirect(url('pages/modules/doc-template-v3/collections'));
exit;
