<?php
/**
 * Alias — redirige vers la console entité (Structurel ou Connecteurs).
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';

$tab = isset($_GET['tab']) ? strtolower(trim((string) $_GET['tab'])) : 'structurel';
$target = $tab === 'connecteurs' ? 'entity-connecteurs.php' : 'entity-structurel.php';
redirect(url('pages/' . $target));
