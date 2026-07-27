<?php
/**
 * Compat : ancienne URL Automatisations → Agents automatiques.
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';
header('Location: ' . url('pages/user-agents-auto.php'), true, 302);
exit;
